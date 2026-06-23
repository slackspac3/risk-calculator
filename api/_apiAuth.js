const crypto = require('crypto');
const { parseSessionToken } = require('./_audit');
const { get: kvGet } = require('./_kvStore');

const USERS_KEY = process.env.USER_STORE_KEY || 'risk_calculator_users';

function normaliseAccount(account = {}) {
  return {
    username: String(account.username || '').trim().toLowerCase(),
    displayName: String(account.displayName || '').trim() || 'User',
    role: account.role === 'admin' ? 'admin' : (account.role === 'bu_admin' ? 'bu_admin' : (account.role === 'function_admin' ? 'function_admin' : 'user')),
    businessUnitEntityId: String(account.businessUnitEntityId || '').trim(),
    departmentEntityId: String(account.departmentEntityId || '').trim(),
    sessionVersion: Math.max(1, Number(account.sessionVersion || 1))
  };
}

function getBootstrapAccounts() {
  try {
    const raw = String(process.env.BOOTSTRAP_ACCOUNTS_JSON || '').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normaliseAccount).filter(account => account.username) : [];
  } catch (error) {
    console.error('api/_apiAuth.getBootstrapAccounts failed to parse bootstrap accounts:', error);
    return [];
  }
}

function mergeBootstrapAccounts(accounts = []) {
  const merged = new Map();
  (Array.isArray(accounts) ? accounts : [])
    .map(normaliseAccount)
    .filter(account => account.username)
    .forEach(account => merged.set(account.username, account));
  getBootstrapAccounts().forEach(account => merged.set(account.username, account));
  return [...merged.values()];
}

async function readCurrentAccount(username = '') {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return { account: null, enforce: false };
  try {
    const { accounts, enforce } = await readAccountsDirectory();
    const match = accounts.find(account => String(account?.username || '').trim().toLowerCase() === safeUsername);
    return {
      account: match || null,
      enforce
    };
  } catch (error) {
    console.error('api/_apiAuth.readCurrentAccount failed to read account store:', error);
    return { account: null, enforce: false };
  }
}

async function readAccountsDirectory() {
  try {
    const raw = await kvGet(USERS_KEY);
    let accounts = getBootstrapAccounts();
    let enforce = accounts.length > 0;
    if (raw) {
      const parsed = JSON.parse(raw);
      accounts = Array.isArray(parsed) ? mergeBootstrapAccounts(parsed) : [];
      enforce = true;
    }
    return { accounts, enforce };
  } catch (error) {
    console.error('api/_apiAuth.readAccountsDirectory failed to read account store:', error);
    return {
      accounts: getBootstrapAccounts(),
      enforce: false
    };
  }
}

function buildErrorPayload(code, message, extra = {}) {
  return {
    error: {
      code: String(code || 'REQUEST_FAILED'),
      message: String(message || 'The request could not be completed.')
    },
    ...extra
  };
}

function sendApiError(res, status, code, message, extra = {}) {
  res.status(Number(status || 500)).json(buildErrorPayload(code, message, extra));
}

function sendConflictError(res, message, extra = {}) {
  sendApiError(
    res,
    409,
    'WRITE_CONFLICT',
    message || 'This information changed somewhere else. Reload the latest version and try again.',
    extra
  );
}

function isRequestSecretValid(req, headerName, expectedSecret) {
  const safeHeaderName = String(headerName || '').trim().toLowerCase();
  const provided = String(req?.headers?.[safeHeaderName] || '').trim();
  const expected = String(expectedSecret || '').trim();
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

async function validateSessionFromRequest(req) {
  const token = String(req.headers['x-session-token'] || '').trim();
  if (!token) {
    return {
      session: null,
      error: { status: 401, code: 'AUTH_REQUIRED', message: 'Please sign in and try again.' }
    };
  }
  const parsed = parseSessionToken(token);
  if (parsed.valid) {
    const { account: currentAccount, enforce } = await readCurrentAccount(parsed.payload.username);
    if (enforce && !currentAccount) {
      return {
        session: null,
        error: { status: 401, code: 'INVALID_SESSION', message: 'Please sign in and try again.' }
      };
    }
    if (!enforce) {
      return { session: parsed.payload, error: null };
    }
    const tokenSessionVersion = Math.max(1, Number(parsed.payload.sv || 1));
    if (tokenSessionVersion !== Math.max(1, Number(currentAccount.sessionVersion || 1))) {
      return {
        session: null,
        error: { status: 401, code: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' }
      };
    }
    return {
      session: {
        username: currentAccount.username,
        displayName: currentAccount.displayName || '',
        role: currentAccount.role,
        businessUnitEntityId: currentAccount.businessUnitEntityId || '',
        departmentEntityId: currentAccount.departmentEntityId || '',
        sessionVersion: currentAccount.sessionVersion
      },
      error: null
    };
  }
  if (parsed.reason === 'expired') {
    return {
      session: null,
      error: { status: 401, code: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' }
    };
  }
  return {
    session: null,
    error: { status: 401, code: 'INVALID_SESSION', message: 'Please sign in and try again.' }
  };
}

async function requireSession(req, res, options = {}) {
  const validation = await validateSessionFromRequest(req);
  if (validation.error) {
    sendApiError(res, validation.error.status, validation.error.code, validation.error.message);
    return null;
  }
  const allowedRoles = Array.isArray(options.roles) ? options.roles.filter(Boolean) : [];
  if (allowedRoles.length && !allowedRoles.includes(validation.session.role)) {
    sendApiError(res, 403, 'FORBIDDEN', options.forbiddenMessage || 'You are not allowed to perform this action.');
    return null;
  }
  return validation.session;
}

async function resolveAdminActor(req, res, { isAdminSecretValid, allowRoles = ['admin'], forbiddenMessage = 'You are not allowed to perform this action.' } = {}) {
  if (typeof isAdminSecretValid === 'function' && isAdminSecretValid(req)) {
    return {
      username: 'admin',
      role: 'admin',
      authType: 'admin_secret'
    };
  }
  return requireSession(req, res, {
    roles: allowRoles,
    forbiddenMessage
  });
}

module.exports = {
  buildErrorPayload,
  isRequestSecretValid,
  sendApiError,
  sendConflictError,
  readAccountsDirectory,
  validateSessionFromRequest,
  requireSession,
  resolveAdminActor
};
