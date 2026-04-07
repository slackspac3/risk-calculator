const crypto = require('crypto');
const { appendAuditEvent, getSessionSigningSecret } = require('./_audit');
const { isRequestSecretValid, sendApiError, resolveAdminActor, requireSession } = require('./_apiAuth');
const { validatePasswordPolicy, generateStrongPassword } = require('./_passwordPolicy');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');
const { del: kvDel, get: kvGet, getKvConfig, set: kvSet, withLock: withKvLock } = require('./_kvStore');

const DEFAULT_ACCOUNTS = [];
const PASSWORD_HASH_VERSION = 'scrypt-v1';

function getBootstrapAccounts() {
  try {
    const raw = String(process.env.BOOTSTRAP_ACCOUNTS_JSON || '').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normaliseAccount).filter(account => account.username && hasStoredCredential(account)) : [];
  } catch (error) {
    console.error('api/users.getBootstrapAccounts failed to parse bootstrap accounts:', error);
    return [];
  }
}

const USERS_KEY = process.env.USER_STORE_KEY || 'risk_calculator_users';
const USER_STATE_PREFIX = process.env.USER_STATE_PREFIX || 'risk_calculator_user_state';
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || '';
const LOGIN_WINDOW_MS = 30 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_ATTEMPT_PREFIX = 'login_attempts::';
const LOGIN_BACKOFF_STEPS_MS = [
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000
];
const RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS = 60;
const LOGIN_FIELDS = ['action', 'password', 'username'];
const ACCOUNT_FIELDS = ['businessUnitEntityId', 'departmentEntityId', 'displayName', 'password', 'role', 'username'];
const PATCH_FIELDS = ['action', 'updates', 'username'];
const UPDATE_FIELDS = ['businessUnitEntityId', 'departmentEntityId', 'displayName', 'role'];

function normaliseAccount(account = {}) {
  return {
    username: String(account.username || '').trim().toLowerCase(),
    password: String(account.password || ''),
    passwordHash: String(account.passwordHash || '').trim(),
    passwordSalt: String(account.passwordSalt || '').trim(),
    passwordVersion: String(account.passwordVersion || '').trim(),
    sessionVersion: Math.max(1, Number(account.sessionVersion || 1)),
    displayName: String(account.displayName || '').trim() || 'User',
    role: account.role === 'admin' ? 'admin' : (account.role === 'bu_admin' ? 'bu_admin' : (account.role === 'function_admin' ? 'function_admin' : 'user')),
    businessUnitEntityId: String(account.businessUnitEntityId || '').trim(),
    departmentEntityId: String(account.departmentEntityId || '').trim()
  };
}

function hasStoredCredential(account = {}) {
  return !!(String(account.passwordHash || '').trim() && String(account.passwordSalt || '').trim())
    || !!String(account.password || '');
}

function hashPassword(password = '', salt = crypto.randomBytes(16).toString('base64url')) {
  const passwordHash = crypto.scryptSync(String(password || ''), salt, 64).toString('base64url');
  return {
    passwordHash,
    passwordSalt: salt,
    passwordVersion: PASSWORD_HASH_VERSION
  };
}

function withStoredPassword(account = {}, password = '') {
  const normalised = normaliseAccount(account);
  const secret = String(password || normalised.password || '');
  if (!secret) return normalised;
  // Persist only a derived credential so the shared user store does not retain plaintext passwords.
  return {
    ...normalised,
    ...hashPassword(secret),
    password: ''
  };
}

function prepareAccountForStorage(account = {}) {
  const normalised = normaliseAccount(account);
  if (normalised.passwordHash && normalised.passwordSalt) {
    return {
      ...normalised,
      password: ''
    };
  }
  if (normalised.password) return withStoredPassword(normalised, normalised.password);
  return normalised;
}

function verifyAccountPassword(account = {}, password = '') {
  const normalised = normaliseAccount(account);
  const suppliedPassword = String(password || '');
  if (normalised.passwordHash && normalised.passwordSalt) {
    try {
      const suppliedHash = crypto.scryptSync(suppliedPassword, normalised.passwordSalt, 64);
      const storedHash = Buffer.from(normalised.passwordHash, 'base64url');
      if (storedHash.length !== suppliedHash.length) return { matched: false, needsUpgrade: false };
      return {
        matched: crypto.timingSafeEqual(storedHash, suppliedHash),
        needsUpgrade: false
      };
    } catch (error) {
      console.error('api/users.verifyAccountPassword failed to verify a stored hash:', error);
      return { matched: false, needsUpgrade: false };
    }
  }
  const storedPassword = Buffer.from(String(normalised.password || ''), 'utf8');
  const candidatePassword = Buffer.from(suppliedPassword, 'utf8');
  const matchedLegacy = storedPassword.length > 0
    && storedPassword.length === candidatePassword.length
    && crypto.timingSafeEqual(storedPassword, candidatePassword);
  return {
    matched: matchedLegacy,
    // Legacy plaintext credentials are upgraded after a successful login.
    needsUpgrade: matchedLegacy
  };
}

function sanitiseAccount(account = {}) {
  return {
    username: String(account.username || '').trim().toLowerCase(),
    displayName: String(account.displayName || '').trim() || 'User',
    role: account.role === 'admin' ? 'admin' : (account.role === 'bu_admin' ? 'bu_admin' : (account.role === 'function_admin' ? 'function_admin' : 'user')),
    businessUnitEntityId: String(account.businessUnitEntityId || '').trim(),
    departmentEntityId: String(account.departmentEntityId || '').trim()
  };
}

function isAdminSecretValid(req) {
  return isRequestSecretValid(req, 'x-admin-secret', ADMIN_API_SECRET);
}

function canSelfUpdateAccount(session, username) {
  const safeUsername = String(username || '').trim().toLowerCase();
  return !!session && (session.role === 'admin' || String(session.username || '').trim().toLowerCase() === safeUsername);
}

function encodeTokenSegment(value) {
  return Buffer.from(value).toString('base64url');
}

function createSessionToken(account) {
  const signingSecret = getSessionSigningSecret();
  if (!signingSecret) throw new Error('Session signing secret is not configured.');
  const payload = JSON.stringify({
    username: account.username,
    role: account.role,
    businessUnitEntityId: account.businessUnitEntityId || '',
    departmentEntityId: account.departmentEntityId || '',
    sv: Math.max(1, Number(account.sessionVersion || 1)),
    exp: Date.now() + SESSION_TTL_MS
  });
  const payloadPart = encodeTokenSegment(payload);
  const signature = crypto.createHmac('sha256', signingSecret).update(payloadPart).digest('base64url');
  return `${payloadPart}.${signature}`;
}

function getLoginThrottleKey(req, username) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim();
  return `${String(username || '').trim().toLowerCase()}::${ip || 'unknown'}`;
}

async function checkLoginThrottle(key) {
  try {
    const raw = await kvGet(LOGIN_ATTEMPT_PREFIX + key);
    if (!raw) return { blocked: false, retryAfterSeconds: 0, unavailable: false };
    const entry = JSON.parse(raw);
    if (Date.now() > Number(entry.lockUntil || 0)) return { blocked: false, retryAfterSeconds: 0, unavailable: false };
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((Number(entry.lockUntil || 0) - Date.now()) / 1000)),
      unavailable: false
    };
  } catch (error) {
    console.error('checkLoginThrottle failed closed:', error);
    return { blocked: true, retryAfterSeconds: RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS, unavailable: true };
  }
}

async function recordLoginAttempt(key, failed) {
  try {
    await withKvLock(LOGIN_ATTEMPT_PREFIX + key, async () => {
      const raw = await kvGet(LOGIN_ATTEMPT_PREFIX + key);
      let entry = raw
        ? JSON.parse(raw)
        : { count: 0, firstAttemptAt: Date.now(), lockUntil: 0 };
      const windowMs = LOGIN_WINDOW_MS;
      if (Date.now() - Number(entry.firstAttemptAt || 0) > windowMs) {
        entry = { count: 0, firstAttemptAt: Date.now(), lockUntil: 0 };
      }
      if (failed) {
        entry.count += 1;
        const stepIndex = Math.min(
          entry.count - LOGIN_MAX_ATTEMPTS,
          LOGIN_BACKOFF_STEPS_MS.length - 1
        );
        if (entry.count >= LOGIN_MAX_ATTEMPTS) {
          const lockMs = LOGIN_BACKOFF_STEPS_MS[Math.max(0, stepIndex)];
          entry.lockUntil = Date.now() + lockMs;
        }
      } else {
        entry = { count: 0, firstAttemptAt: Date.now(), lockUntil: 0 };
      }
      await kvSet(LOGIN_ATTEMPT_PREFIX + key, JSON.stringify(entry));
    }, {
      prefix: 'lock::login::',
      waitTimeoutMs: 2500
    });
    return true;
  } catch (error) {
    console.error('recordLoginAttempt failed closed:', error);
    return false;
  }
}

async function clearLoginAttempts(key) {
  try {
    await withKvLock(LOGIN_ATTEMPT_PREFIX + key, async () => {
      await kvSet(
        LOGIN_ATTEMPT_PREFIX + key,
        JSON.stringify({ count: 0, firstAttemptAt: 0, lockUntil: 0 })
      );
    }, {
      prefix: 'lock::login::',
      waitTimeoutMs: 2500
    });
    return true;
  } catch (error) {
    console.error('clearLoginAttempts failed closed:', error);
    return false;
  }
}

function hasWritableKv() {
  try {
    return !!getKvConfig();
  } catch (error) {
    console.error('api/users.hasWritableKv failed to resolve KV config:', error);
    return false;
  }
}

async function readAccounts() {
  const raw = await kvGet(USERS_KEY);
  if (!raw) return getBootstrapAccounts();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed.map(normaliseAccount) : getBootstrapAccounts();
  } catch (error) {
    console.error('api/users.readAccounts failed to parse stored accounts:', error);
    return getBootstrapAccounts();
  }
}

async function persistAccounts(accounts) {
  if (!hasWritableKv()) {
    throw new Error('Shared user store is not writable. Configure the shared store environment variables in Vercel.');
  }
  const storedAccounts = accounts.map(prepareAccountForStorage);
  await kvSet(USERS_KEY, JSON.stringify(storedAccounts));
  return storedAccounts.map(normaliseAccount);
}

async function writeAccounts(accounts) {
  return withKvLock(USERS_KEY, async () => persistAccounts(accounts), {
    prefix: 'lock::users::',
    waitTimeoutMs: 2500
  });
}

function hasAuthScopeChanged(current = {}, next = {}) {
  return String(current.role || '') !== String(next.role || '')
    || String(current.businessUnitEntityId || '') !== String(next.businessUnitEntityId || '')
    || String(current.departmentEntityId || '') !== String(next.departmentEntityId || '');
}

function bumpSessionVersion(account = {}) {
  return {
    ...account,
    sessionVersion: Math.max(1, Number(account.sessionVersion || 1)) + 1
  };
}


function buildUserStateKey(username = '') {
  return `${USER_STATE_PREFIX}__${String(username || '').trim().toLowerCase()}`;
}

async function deleteUserState(username) {
  if (!hasWritableKv()) return;
  await kvDel(buildUserStateKey(username));
}

function hasUnexpectedFields(payload, allowedFields = []) {
  return getUnexpectedFields(payload, allowedFields).length > 0;
}

module.exports = async function handler(req, res) {
  const body = parseRequestBody(req);
  applyCorsHeaders(req, res, {
    methods: 'GET,POST,PATCH,OPTIONS',
    headers: 'content-type,x-admin-secret,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  if ((req.method === 'POST' || req.method === 'PATCH') && !req.headers['content-type']?.includes('application/json')) {
    sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    return;
  }

  if ((req.method === 'POST' || req.method === 'PATCH') && !isPlainObject(body)) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Invalid request body.');
    return;
  }

  try {
    if (req.method === 'GET') {
      if (String(req.query?.view || '').trim().toLowerCase() === 'self') {
        const session = await requireSession(req, res);
        if (!session) {
          return;
        }
        const accounts = await readAccounts();
        const account = accounts.find(item => item.username === String(session.username || '').trim().toLowerCase());
        if (!account) {
          sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
          return;
        }
        res.status(200).json({
          user: sanitiseAccount(account)
        });
        return;
      }
      const actor = await resolveAdminActor(req, res, {
        isAdminSecretValid,
        allowRoles: ['admin']
      });
      if (!actor) {
        return;
      }
      const accounts = await readAccounts();
      res.status(200).json({
        accounts: accounts.map(sanitiseAccount),
        storage: {
          writable: hasWritableKv(),
          mode: hasWritableKv() ? 'shared-kv' : (accounts.length ? 'bootstrap-fallback' : 'empty')
        }
      });
      return;
    }

    if (req.method === 'POST') {
      if (body.action === 'login') {
        if (hasUnexpectedFields(body, LOGIN_FIELDS)) {
          sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the login request.');
          return;
        }
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        const throttleKey = getLoginThrottleKey(req, username);
        const throttleState = await checkLoginThrottle(throttleKey);
        if (throttleState.blocked) {
          await appendAuditEvent({
            category: 'auth',
            eventType: throttleState.unavailable ? 'login_rate_limit_unavailable' : 'login_rate_limited',
            actorUsername: username || 'unknown',
            actorRole: 'anonymous',
            status: 'blocked',
            source: 'server',
            details: { retryAfterSeconds: throttleState.retryAfterSeconds }
          });
          sendApiError(
            res,
            throttleState.unavailable ? 503 : 429,
            throttleState.unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'ACCOUNT_LOCKED',
            throttleState.unavailable
              ? 'Login is temporarily unavailable. Please try again shortly.'
              : 'Too many login attempts. Please wait and try again.',
            { retryAfterSeconds: throttleState.retryAfterSeconds }
          );
          return;
        }
        const accounts = await readAccounts();
        const matchIndex = accounts.findIndex(account => {
          if (account.username !== username) return false;
          return verifyAccountPassword(account, password).matched;
        });
        const matched = matchIndex > -1 ? accounts[matchIndex] : null;
        if (!matched) {
          const recorded = await recordLoginAttempt(throttleKey, true);
          if (!recorded) {
            sendApiError(res, 503, 'RATE_LIMIT_UNAVAILABLE', 'Login is temporarily unavailable. Please try again shortly.', {
              retryAfterSeconds: RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS
            });
            return;
          }
          const nextThrottle = await checkLoginThrottle(throttleKey);
          await appendAuditEvent({
            category: 'auth',
            eventType: 'login_failure',
            actorUsername: username || 'unknown',
            actorRole: 'anonymous',
            status: 'failed',
            source: 'server',
            details: nextThrottle.blocked ? { retryAfterSeconds: nextThrottle.retryAfterSeconds } : {}
          });
          sendApiError(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
          return;
        }
        if (!(await clearLoginAttempts(throttleKey))) {
          sendApiError(res, 503, 'RATE_LIMIT_UNAVAILABLE', 'Login is temporarily unavailable. Please try again shortly.', {
            retryAfterSeconds: RATE_LIMIT_UNAVAILABLE_RETRY_SECONDS
          });
          return;
        }
        const verification = verifyAccountPassword(matched, password);
        if (verification.needsUpgrade && hasWritableKv()) {
          const upgradedAccounts = accounts.slice();
          upgradedAccounts[matchIndex] = {
            ...withStoredPassword(matched, password),
            sessionVersion: Math.max(1, Number(matched.sessionVersion || 1))
          };
          try {
            await withKvLock(USERS_KEY, async () => {
              const latestAccounts = await readAccounts();
              const latestIndex = latestAccounts.findIndex(account => account.username === matched.username);
              if (latestIndex < 0) return;
              latestAccounts[latestIndex] = {
                ...withStoredPassword(latestAccounts[latestIndex], password),
                sessionVersion: Math.max(1, Number(latestAccounts[latestIndex].sessionVersion || 1))
              };
              await persistAccounts(latestAccounts);
            }, {
              prefix: 'lock::users::',
              waitTimeoutMs: 2500
            });
          } catch (upgradeError) {
            console.warn('User login credential upgrade failed:', upgradeError.message);
          }
        }
        await appendAuditEvent({ category: 'auth', eventType: 'login_success', actorUsername: matched.username, actorRole: matched.role, status: 'success', source: 'server' });
        res.status(200).json({
          user: sanitiseAccount(matched),
          sessionToken: createSessionToken(matched)
        });
        return;
      }

      const actor = await resolveAdminActor(req, res, {
        isAdminSecretValid,
        allowRoles: ['admin']
      });
      if (!actor) {
        return;
      }

      if (hasUnexpectedFields(body, ['action', 'account'])) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the account request.');
        return;
      }
      if (String(body.action || '').trim().toLowerCase() !== 'create') {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'User creation requests must include action=create.');
        return;
      }
      if (!isPlainObject(body.account || {})) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Account payload is required.');
        return;
      }
      if (hasUnexpectedFields(body.account, ACCOUNT_FIELDS)) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the account payload.');
        return;
      }
      const account = normaliseAccount(body.account || {});
      if (!account.username) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Username is required.');
        return;
      }
      const issuedPassword = account.password || generateStrongPassword();
      const passwordCheck = validatePasswordPolicy(issuedPassword);
      if (!passwordCheck.valid) {
        sendApiError(res, 400, 'PASSWORD_POLICY_FAILED', 'Password does not meet the current policy.');
        return;
      }
      let storedAccounts = null;
      const duplicateExists = await withKvLock(USERS_KEY, async () => {
        const accounts = await readAccounts();
        if (accounts.some(item => item.username === account.username)) return true;
        accounts.push({
          ...account,
          password: issuedPassword,
          sessionVersion: Math.max(1, Number(account.sessionVersion || 1))
        });
        storedAccounts = await persistAccounts(accounts);
        return false;
      }, {
        prefix: 'lock::users::',
        waitTimeoutMs: 2500
      });
      if (duplicateExists) {
        sendApiError(res, 409, 'USERNAME_EXISTS', 'That username is already in use.');
        return;
      }
      await appendAuditEvent({ category: 'user_admin', eventType: 'user_created', actorUsername: actor.username, actorRole: actor.role, target: account.username, status: 'success', source: 'server', details: { role: account.role, businessUnitEntityId: account.businessUnitEntityId, departmentEntityId: account.departmentEntityId } });
      res.status(201).json({
        account: sanitiseAccount({
          ...account,
          password: issuedPassword
        }),
        password: issuedPassword,
        accounts: storedAccounts.map(sanitiseAccount)
      });
      return;
    }

    if (req.method === 'PATCH') {
      if (hasUnexpectedFields(body, PATCH_FIELDS)) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the user update request.');
        return;
      }
      const username = String(body.username || '').trim().toLowerCase();
      const updates = isPlainObject(body.updates || {}) ? body.updates : {};
      if (hasUnexpectedFields(updates, UPDATE_FIELDS)) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the user update payload.');
        return;
      }
      if (body.action === 'self-update') {
        const session = await requireSession(req, res);
        if (!session) return;
        if (!canSelfUpdateAccount(session, username)) {
          sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to modify this account.');
          return;
        }
        if (typeof updates.businessUnitEntityId === 'string' || typeof updates.departmentEntityId === 'string') {
          sendApiError(res, 403, 'FORBIDDEN', 'Organisation assignment can only be changed by an admin.');
          return;
        }
        let updatedAccount = null;
        let allAccounts = null;
        if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
          const updated = await withKvLock(USERS_KEY, async () => {
            const accounts = await readAccounts();
            const index = accounts.findIndex(account => account.username === username);
            if (index < 0) return null;
            accounts[index] = normaliseAccount({
              ...accounts[index],
              displayName: updates.displayName.trim(),
              sessionVersion: Math.max(1, Number(accounts[index].sessionVersion || 1))
            });
            allAccounts = await persistAccounts(accounts);
            return allAccounts[index];
          }, {
            prefix: 'lock::users::',
            waitTimeoutMs: 2500
          });
          if (!updated) {
            sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
            return;
          }
          updatedAccount = updated;
          await appendAuditEvent({ category: 'profile', eventType: 'self_profile_updated', actorUsername: updated.username, actorRole: updated.role, target: updated.username, status: 'success', source: 'server', details: { displayName: updated.displayName } });
        }
        if (!allAccounts) {
          allAccounts = await readAccounts();
          if (!allAccounts.some(account => account.username === username)) {
            sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
            return;
          }
        }
        res.status(200).json({ accounts: allAccounts.map(sanitiseAccount) });
        return;
      }
      const actor = await resolveAdminActor(req, res, {
        isAdminSecretValid,
        allowRoles: ['admin']
      });
      if (!actor) {
        return;
      }
      if (body.action === 'reset-password') {
        const nextPassword = generateStrongPassword();
        const passwordCheck = validatePasswordPolicy(nextPassword);
        if (!passwordCheck.valid) {
          throw new Error('Generated password failed policy validation.');
        }
        let updatedAccount = null;
        const storedAccounts = await withKvLock(USERS_KEY, async () => {
          const accounts = await readAccounts();
          const index = accounts.findIndex(account => account.username === username);
          if (index < 0) return null;
          accounts[index] = bumpSessionVersion(normaliseAccount({
            ...accounts[index],
            password: nextPassword
          }));
          updatedAccount = accounts[index];
          return persistAccounts(accounts);
        }, {
          prefix: 'lock::users::',
          waitTimeoutMs: 2500
        });
        if (!storedAccounts || !updatedAccount) {
          sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
          return;
        }
        await appendAuditEvent({ category: 'user_admin', eventType: 'password_reset', actorUsername: actor.username, actorRole: actor.role, target: updatedAccount.username, status: 'success', source: 'server' });
        res.status(200).json({
          account: sanitiseAccount(updatedAccount),
          password: nextPassword,
          accounts: storedAccounts.map(sanitiseAccount)
        });
        return;
      }
      if (body.action === 'delete-user') {
        let removed = null;
        const storedAccounts = await withKvLock(USERS_KEY, async () => {
          const accounts = await readAccounts();
          const index = accounts.findIndex(account => account.username === username);
          if (index < 0) return null;
          removed = accounts.splice(index, 1)[0];
          await persistAccounts(accounts);
          return accounts;
        }, {
          prefix: 'lock::users::',
          waitTimeoutMs: 2500
        });
        if (!storedAccounts || !removed) {
          sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
          return;
        }
        await deleteUserState(removed.username);
        await appendAuditEvent({ category: 'user_admin', eventType: 'user_deleted', actorUsername: actor.username, actorRole: actor.role, target: removed.username, status: 'success', source: 'server' });
        res.status(200).json({ accounts: storedAccounts.map(sanitiseAccount) });
        return;
      }
      let updatedAccount = null;
      const storedAccounts = await withKvLock(USERS_KEY, async () => {
        const accounts = await readAccounts();
        const index = accounts.findIndex(account => account.username === username);
        if (index < 0) return null;
        const currentAccount = accounts[index];
        const nextAccount = normaliseAccount({
          ...currentAccount,
          displayName: typeof updates.displayName === 'string' && updates.displayName.trim() ? updates.displayName.trim() : currentAccount.displayName,
          role: typeof updates.role === 'string' ? updates.role : currentAccount.role,
          businessUnitEntityId: typeof updates.businessUnitEntityId === 'string' ? updates.businessUnitEntityId : currentAccount.businessUnitEntityId,
          departmentEntityId: typeof updates.departmentEntityId === 'string' ? updates.departmentEntityId : currentAccount.departmentEntityId,
          sessionVersion: Math.max(1, Number(currentAccount.sessionVersion || 1))
        });
        accounts[index] = hasAuthScopeChanged(currentAccount, nextAccount)
          ? bumpSessionVersion(nextAccount)
          : nextAccount;
        updatedAccount = accounts[index];
        return persistAccounts(accounts);
      }, {
        prefix: 'lock::users::',
        waitTimeoutMs: 2500
      });
      if (!storedAccounts || !updatedAccount) {
        sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
        return;
      }
      await appendAuditEvent({ category: 'user_admin', eventType: body.action === 'admin-update' ? 'managed_user_updated' : 'user_updated', actorUsername: actor.username, actorRole: actor.role, target: updatedAccount.username, status: 'success', source: 'server', details: { role: updatedAccount.role, businessUnitEntityId: updatedAccount.businessUnitEntityId, departmentEntityId: updatedAccount.departmentEntityId } });
      res.status(200).json({ accounts: storedAccounts.map(sanitiseAccount) });
      return;
    }

    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    console.error('User API request failed.', error);
    sendApiError(res, 500, 'USER_STORE_REQUEST_FAILED', 'The user request could not be completed.');
  }
};

module.exports.readAccounts = readAccounts;
module.exports.writeAccounts = writeAccounts;
module.exports.sanitiseAccount = sanitiseAccount;
