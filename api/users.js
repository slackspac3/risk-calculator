const crypto = require('crypto');
const { appendAuditEvent } = require('./_audit');
const { sendApiError, resolveAdminActor, requireSession } = require('./_apiAuth');
const { validatePasswordPolicy, generateStrongPassword } = require('./_passwordPolicy');

const DEFAULT_ACCOUNTS = [];

function getBootstrapAccounts() {
  try {
    const raw = String(process.env.BOOTSTRAP_ACCOUNTS_JSON || '').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normaliseAccount).filter(account => account.username && account.password) : [];
  } catch {
    return [];
  }
}

const USERS_KEY = process.env.USER_STORE_KEY || 'risk_calculator_users';
const USER_STATE_PREFIX = process.env.USER_STATE_PREFIX || 'risk_calculator_user_state';
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || '';
const LOGIN_WINDOW_MS = 30 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map();
const LOGIN_BACKOFF_STEPS_MS = [
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000
];

function getKvUrl() {
  return process.env.APPLE_CAT || process.env.FOO_URL_TEST || process.env.RC_USER_STORE_URL || process.env.USER_STORE_KV_URL || process.env.KV_REST_API_URL || '';
}

function getKvToken() {
  return process.env.BANANA_DOG || process.env.FOO_TOKEN_TEST || process.env.RC_USER_STORE_TOKEN || process.env.USER_STORE_KV_TOKEN || process.env.KV_REST_API_TOKEN || '';
}

function normaliseAccount(account = {}) {
  return {
    username: String(account.username || '').trim().toLowerCase(),
    password: String(account.password || ''),
    displayName: String(account.displayName || '').trim() || 'User',
    role: account.role === 'admin' ? 'admin' : (account.role === 'bu_admin' ? 'bu_admin' : (account.role === 'function_admin' ? 'function_admin' : 'user')),
    businessUnitEntityId: String(account.businessUnitEntityId || '').trim(),
    departmentEntityId: String(account.departmentEntityId || '').trim()
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
  return !!ADMIN_API_SECRET && req.headers['x-admin-secret'] === ADMIN_API_SECRET;
}

function canSelfUpdateAccount(session, username) {
  const safeUsername = String(username || '').trim().toLowerCase();
  return !!session && (session.role === 'admin' || String(session.username || '').trim().toLowerCase() === safeUsername);
}

function encodeTokenSegment(value) {
  return Buffer.from(value).toString('base64url');
}

function createSessionToken(account) {
  const signingSecret = process.env.SESSION_SIGNING_SECRET || ADMIN_API_SECRET || getKvToken() || '';
  if (!signingSecret) throw new Error('Session signing secret is not configured.');
  const payload = JSON.stringify({
    username: account.username,
    role: account.role,
    businessUnitEntityId: account.businessUnitEntityId || '',
    departmentEntityId: account.departmentEntityId || '',
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

function getLoginLockoutMs(count = 0) {
  if (count < LOGIN_MAX_ATTEMPTS) return 0;
  const index = Math.min(count - LOGIN_MAX_ATTEMPTS, LOGIN_BACKOFF_STEPS_MS.length - 1);
  return LOGIN_BACKOFF_STEPS_MS[index];
}

function getLoginRateLimitState(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return { limited: false, retryAfterMs: 0, count: 0 };
  if (Date.now() - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { limited: false, retryAfterMs: 0, count: 0 };
  }
  const retryAfterMs = Math.max(0, Number(entry.lockUntil || 0) - Date.now());
  return {
    limited: retryAfterMs > 0,
    retryAfterMs,
    count: Number(entry.count || 0)
  };
}

function recordFailedLogin(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAttemptAt > LOGIN_WINDOW_MS) {
    const count = 1;
    const lockMs = getLoginLockoutMs(count);
    loginAttempts.set(key, { count, firstAttemptAt: now, lockUntil: lockMs ? now + lockMs : 0 });
    return;
  }
  entry.count += 1;
  const lockMs = getLoginLockoutMs(entry.count);
  entry.lockUntil = lockMs ? now + lockMs : 0;
  loginAttempts.set(key, entry);
}

function clearFailedLogin(key) {
  loginAttempts.delete(key);
}

async function runKvCommand(command) {
  const url = getKvUrl();
  const token = getKvToken();
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `KV request failed with HTTP ${res.status}`);
  }
  return res.json();
}

function hasWritableKv() {
  return !!(getKvUrl() && getKvToken());
}

async function readAccounts() {
  const response = await runKvCommand(['GET', USERS_KEY]);
  const raw = response?.result;
  if (!raw) return getBootstrapAccounts();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed.map(normaliseAccount) : getBootstrapAccounts();
  } catch {
    return getBootstrapAccounts();
  }
}

async function writeAccounts(accounts) {
  if (!hasWritableKv()) {
    throw new Error('Shared user store is not writable. Configure the shared store environment variables in Vercel.');
  }
  await runKvCommand(['SET', USERS_KEY, JSON.stringify(accounts.map(normaliseAccount))]);
  return accounts.map(normaliseAccount);
}


function buildUserStateKey(username = '') {
  return `${USER_STATE_PREFIX}__${String(username || '').trim().toLowerCase()}`;
}

async function deleteUserState(username) {
  if (!hasWritableKv()) return;
  await runKvCommand(['DEL', buildUserStateKey(username)]);
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const body = typeof req.body === 'string'
    ? (() => {
        try {
          return JSON.parse(req.body || '{}');
        } catch {
          return {};
        }
      })()
    : (req.body || {});

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-admin-secret,x-session-token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  try {
    if (req.method === 'GET') {
      const actor = resolveAdminActor(req, res, {
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
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        const throttleKey = getLoginThrottleKey(req, username);
        const throttle = getLoginRateLimitState(throttleKey);
        if (throttle.limited) {
          const retryAfterSeconds = Math.max(1, Math.ceil(throttle.retryAfterMs / 1000));
          await appendAuditEvent({
            category: 'auth',
            eventType: 'login_rate_limited',
            actorUsername: username || 'unknown',
            actorRole: 'anonymous',
            status: 'blocked',
            source: 'server',
            details: { retryAfterSeconds }
          });
          sendApiError(res, 429, 'ACCOUNT_LOCKED', 'Too many login attempts. Please wait and try again.', { retryAfterSeconds });
          return;
        }
        const accounts = await readAccounts();
        const matched = accounts.find(account => account.username === username && account.password === password);
        if (!matched) {
          recordFailedLogin(throttleKey);
          const state = getLoginRateLimitState(throttleKey);
          await appendAuditEvent({
            category: 'auth',
            eventType: 'login_failure',
            actorUsername: username || 'unknown',
            actorRole: 'anonymous',
            status: 'failed',
            source: 'server',
            details: state.limited ? { retryAfterSeconds: Math.max(1, Math.ceil(state.retryAfterMs / 1000)) } : {}
          });
          sendApiError(res, 401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
          return;
        }
        clearFailedLogin(throttleKey);
        await appendAuditEvent({ category: 'auth', eventType: 'login_success', actorUsername: matched.username, actorRole: matched.role, status: 'success', source: 'server' });
        res.status(200).json({
          user: sanitiseAccount(matched),
          sessionToken: createSessionToken(matched)
        });
        return;
      }

      const actor = resolveAdminActor(req, res, {
        isAdminSecretValid,
        allowRoles: ['admin']
      });
      if (!actor) {
        return;
      }

      const accounts = await readAccounts();
      const account = normaliseAccount(body.account || {});
      if (!account.username || !account.password) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Username and password are required.');
        return;
      }
      if (accounts.some(item => item.username === account.username)) {
        sendApiError(res, 409, 'USERNAME_EXISTS', 'That username is already in use.');
        return;
      }
      const passwordCheck = validatePasswordPolicy(account.password);
      if (!passwordCheck.valid) {
        sendApiError(res, 400, 'PASSWORD_POLICY_FAILED', 'Password does not meet the current policy.');
        return;
      }
      accounts.push(account);
      await writeAccounts(accounts);
      await appendAuditEvent({ category: 'user_admin', eventType: 'user_created', actorUsername: actor.username, actorRole: actor.role, target: account.username, status: 'success', source: 'server', details: { role: account.role, businessUnitEntityId: account.businessUnitEntityId, departmentEntityId: account.departmentEntityId } });
      res.status(201).json({
        account: sanitiseAccount(account),
        password: account.password,
        accounts: accounts.map(sanitiseAccount)
      });
      return;
    }

    if (req.method === 'PATCH') {
      const username = String(body.username || '').trim().toLowerCase();
      const updates = body.updates || {};
      const accounts = await readAccounts();
      const index = accounts.findIndex(account => account.username === username);
      if (index < 0) {
        sendApiError(res, 404, 'NOT_FOUND', 'User not found.');
        return;
      }
      if (body.action === 'self-update') {
        const session = requireSession(req, res);
        if (!session) return;
        if (!canSelfUpdateAccount(session, username)) {
          sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to modify this account.');
          return;
        }
        if (typeof updates.businessUnitEntityId === 'string' || typeof updates.departmentEntityId === 'string') {
          sendApiError(res, 403, 'FORBIDDEN', 'Organisation assignment can only be changed by an admin.');
          return;
        }
        if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
          accounts[index] = normaliseAccount({
            ...accounts[index],
            displayName: updates.displayName.trim()
          });
          await writeAccounts(accounts);
          await appendAuditEvent({ category: 'profile', eventType: 'self_profile_updated', actorUsername: accounts[index].username, actorRole: accounts[index].role, target: accounts[index].username, status: 'success', source: 'server', details: { displayName: accounts[index].displayName } });
        }
        res.status(200).json({ accounts: accounts.map(sanitiseAccount) });
        return;
      }
      const actor = resolveAdminActor(req, res, {
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
        accounts[index] = normaliseAccount({
          ...accounts[index],
          password: nextPassword
        });
        await writeAccounts(accounts);
        await appendAuditEvent({ category: 'user_admin', eventType: 'password_reset', actorUsername: actor.username, actorRole: actor.role, target: accounts[index].username, status: 'success', source: 'server' });
        res.status(200).json({
          account: sanitiseAccount(accounts[index]),
          password: nextPassword,
          accounts: accounts.map(sanitiseAccount)
        });
        return;
      }
      if (body.action === 'delete-user') {
        const removed = accounts.splice(index, 1)[0];
        await writeAccounts(accounts);
        await deleteUserState(removed.username);
        await appendAuditEvent({ category: 'user_admin', eventType: 'user_deleted', actorUsername: actor.username, actorRole: actor.role, target: removed.username, status: 'success', source: 'server' });
        res.status(200).json({ accounts: accounts.map(sanitiseAccount) });
        return;
      }
      accounts[index] = normaliseAccount({
        ...accounts[index],
        displayName: typeof updates.displayName === 'string' && updates.displayName.trim() ? updates.displayName.trim() : accounts[index].displayName,
        role: typeof updates.role === 'string' ? updates.role : accounts[index].role,
        businessUnitEntityId: typeof updates.businessUnitEntityId === 'string' ? updates.businessUnitEntityId : accounts[index].businessUnitEntityId,
        departmentEntityId: typeof updates.departmentEntityId === 'string' ? updates.departmentEntityId : accounts[index].departmentEntityId
      });
      await writeAccounts(accounts);
      await appendAuditEvent({ category: 'user_admin', eventType: body.action === 'admin-update' ? 'managed_user_updated' : 'user_updated', actorUsername: actor.username, actorRole: actor.role, target: accounts[index].username, status: 'success', source: 'server', details: { role: accounts[index].role, businessUnitEntityId: accounts[index].businessUnitEntityId, departmentEntityId: accounts[index].departmentEntityId } });
      res.status(200).json({ accounts: accounts.map(sanitiseAccount) });
      return;
    }

    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    sendApiError(res, 500, 'USER_STORE_REQUEST_FAILED', 'The user request could not be completed.');
  }
};
