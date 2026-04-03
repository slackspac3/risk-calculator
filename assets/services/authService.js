/**
 * authService.js — Local PoC authentication stub
 *
 * PoC: user accounts are loaded from the shared Vercel user store when available.
 * Production: replace with Microsoft Entra ID (MSAL.js).
 * Integration points marked with [ENTRA-INTEGRATION].
 */

const AuthService = (() => {
  const SESSION_KEY = 'rq_auth_session';
  const ACCOUNTS_CACHE_KEY = 'rq_auth_accounts_cache';
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
  const ADMIN_SECRET_KEY = 'rq_admin_api_secret';
  const SESSION_NOTICE_KEY = 'rq_auth_notice';
  const DEFAULT_USERS_API_URL = resolveApiUrl('/api/users');
  const DEFAULT_ACCOUNTS = [];
  let accountsCache = DEFAULT_ACCOUNTS.slice();
  let adminSecretMemory = '';
  const warnedAuthIssues = new Set();

function resolveApiUrl(path) {
  const resolver = (typeof window !== 'undefined' && window?.ApiOriginResolver)
    || globalThis?.ApiOriginResolver
    || null;
  return resolver && typeof resolver.resolveApiUrl === 'function'
    ? resolver.resolveApiUrl(path)
    : '';
}

  function warnAuthIssueOnce(key, message, error = null) {
    if (warnedAuthIssues.has(key)) return;
    warnedAuthIssues.add(key);
    console.warn(message, error?.message || error || '');
  }

  function clearSessionStorageEntries({ exactKeys = [], prefixKeys = [] } = {}) {
    try {
      exactKeys.filter(Boolean).forEach(key => sessionStorage.removeItem(key));
      const safePrefixes = prefixKeys.map(prefix => String(prefix || '').trim()).filter(Boolean);
      if (!safePrefixes.length) return;
      const sessionKeys = [];
      if (typeof sessionStorage.length === 'number' && typeof sessionStorage.key === 'function') {
        for (let index = 0; index < sessionStorage.length; index += 1) {
          const key = sessionStorage.key(index);
          if (key) sessionKeys.push(String(key));
        }
      }
      sessionKeys.forEach((key) => {
        if (safePrefixes.some(prefix => key.startsWith(prefix))) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      warnAuthIssueOnce('session-clear-supplemental', 'AuthService supplemental session cleanup failed:', error);
    }
  }

  function getUsersApiUrl() {
    return DEFAULT_USERS_API_URL;
  }

  function getAdminApiSecret() {
    try {
      const sessionSecret = sessionStorage.getItem(ADMIN_SECRET_KEY) || '';
      if (sessionSecret) {
        adminSecretMemory = sessionSecret;
        return sessionSecret;
      }
    } catch (error) {
      warnAuthIssueOnce('admin-secret-read-session', 'AuthService admin-secret session read failed:', error);
    }
    try {
      const legacySecret = localStorage.getItem(ADMIN_SECRET_KEY) || '';
      if (legacySecret) {
        adminSecretMemory = legacySecret;
        try {
          sessionStorage.setItem(ADMIN_SECRET_KEY, legacySecret);
        } catch (sessionError) {
          warnAuthIssueOnce('admin-secret-migrate-session', 'AuthService admin-secret migration to session storage failed:', sessionError);
        }
        try {
          localStorage.removeItem(ADMIN_SECRET_KEY);
        } catch (cleanupError) {
          warnAuthIssueOnce('admin-secret-cleanup-local', 'AuthService admin-secret local cleanup failed:', cleanupError);
        }
        return legacySecret;
      }
    } catch (error) {
      warnAuthIssueOnce('admin-secret-read-local', 'AuthService admin-secret local read failed:', error);
    }
    return adminSecretMemory;
  }

  function setAdminApiSecret(secret) {
    const value = String(secret || '').trim();
    adminSecretMemory = value;
    try {
      if (value) sessionStorage.setItem(ADMIN_SECRET_KEY, value);
      else sessionStorage.removeItem(ADMIN_SECRET_KEY);
    } catch (error) {
      warnAuthIssueOnce('admin-secret-write-session', 'AuthService admin-secret session write failed:', error);
    }
    try {
      localStorage.removeItem(ADMIN_SECRET_KEY);
    } catch (error) {
      warnAuthIssueOnce('admin-secret-remove-local', 'AuthService admin-secret local removal failed:', error);
    }
    return value;
  }


  function sanitiseAccount(account) {
    if (!account) return null;
    return {
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      businessUnitEntityId: account.businessUnitEntityId || '',
      departmentEntityId: account.departmentEntityId || ''
    };
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

  function saveCache(accounts) {
    accountsCache = Array.isArray(accounts) && accounts.length ? accounts.map(normaliseAccount) : [];
    try {
      localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(accountsCache));
    } catch (error) {
      warnAuthIssueOnce('accounts-cache-write', 'AuthService account cache write failed:', error);
    }
  }

  function readCachedAccounts() {
    try {
      const stored = JSON.parse(localStorage.getItem(ACCOUNTS_CACHE_KEY) || 'null');
      if (Array.isArray(stored) && stored.length) {
        accountsCache = stored.map(normaliseAccount);
      }
    } catch (error) {
      warnAuthIssueOnce('accounts-cache-read', 'AuthService account cache read failed:', error);
    }
    return accountsCache;
  }

  async function requestUsers(method = 'GET', payload, { includeAdminSecret = false, query = '' } = {}) {
    const headers = {
      'Content-Type': 'application/json'
    };
    const sessionToken = getApiSessionToken();
    if (includeAdminSecret && !sessionToken && getAdminApiSecret()) {
      headers['x-admin-secret'] = getAdminApiSecret();
    }
    if (sessionToken) {
      headers['x-session-token'] = sessionToken;
    }
    const res = await fetch(`${getUsersApiUrl()}${query || ''}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      warnAuthIssueOnce('users-response-parse', 'AuthService users response parse failed:', error);
    }
    if (!res.ok) {
      handleApiAuthFailure(res.status, parsed);
      throw buildApiError(res, parsed, text || `User store request failed with HTTP ${res.status}`);
    }
    return parsed || {};
  }

  function buildApiError(response, parsed, fallbackMessage = 'The request could not be completed.') {
    const error = new Error(parsed?.error?.message || parsed?.error || fallbackMessage);
    error.status = Number(response?.status || 0);
    error.code = String(parsed?.error?.code || '').trim();
    error.retryAfterSeconds = Number(parsed?.retryAfterSeconds || 0);
    error.details = parsed || null;
    if (parsed?.latestState) error.latestState = parsed.latestState;
    if (parsed?.latestSettings) error.latestSettings = parsed.latestSettings;
    if (parsed?.latestMeta) error.latestMeta = parsed.latestMeta;
    if (Array.isArray(parsed?.conflictFields)) error.conflictFields = parsed.conflictFields;
    return error;
  }

  function forceSessionExpiry(message = 'Your session expired. Please sign in again.') {
    logout();
    try {
      sessionStorage.setItem(SESSION_NOTICE_KEY, String(message || '').trim());
    } catch (error) {
      warnAuthIssueOnce('session-notice-write', 'AuthService session notice write failed:', error);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rq:session-expired', { detail: { message } }));
      if (!String(window.location.hash || '').includes('/login')) {
        window.location.hash = '#/login';
      }
    }
  }

  function handleApiAuthFailure(status, parsed) {
    const code = String(parsed?.error?.code || '').trim();
    if (status === 401 && ['SESSION_EXPIRED', 'INVALID_SESSION', 'AUTH_REQUIRED'].includes(code) && getApiSessionToken()) {
      forceSessionExpiry(parsed?.error?.message || 'Your session expired. Please sign in again.');
      return true;
    }
    return false;
  }

  function consumeSessionNotice() {
    try {
      const value = sessionStorage.getItem(SESSION_NOTICE_KEY) || '';
      if (value) sessionStorage.removeItem(SESSION_NOTICE_KEY);
      return value;
    } catch (error) {
      warnAuthIssueOnce('session-notice-read', 'AuthService session notice read failed:', error);
      return '';
    }
  }

  async function refreshManagedAccounts() {
    const data = await requestUsers('GET');
    if (Array.isArray(data?.accounts)) {
      saveCache(data.accounts);
    } else {
      saveCache([]);
    }
    return accountsCache;
  }

  async function refreshCurrentSessionUser() {
    const session = readSession();
    if (!session?.user?.username || !session.apiSessionToken) {
      return session?.user ? sanitiseAccount(session.user) : null;
    }
    const data = await requestUsers('GET', undefined, { query: '?view=self' });
    if (!data?.user) return sanitiseAccount(session.user);
    const nextUser = sanitiseAccount(data.user);
    const cachedAccounts = readCachedAccounts().filter(account => account.username !== nextUser.username);
    saveCache([...cachedAccounts, nextUser]);
    session.user = nextUser;
    session.ts = Date.now();
    persistSession(session, 'session-user-refresh-write', 'AuthService session refresh write failed:');
    return nextUser;
  }

  async function init() {
    readCachedAccounts();
    if (!readSession()?.user) return accountsCache;
    try {
      await refreshCurrentSessionUser();
    } catch (error) {
      console.warn('AuthService.init current-user refresh fallback:', error.message);
    }
    if (isAdminAuthenticated()) {
      try {
        await refreshManagedAccounts();
      } catch (error) {
        console.warn('AuthService.init fallback:', error.message);
      }
    }
    return accountsCache;
  }

  async function testUsersStoreHealth() {
    try {
      const data = await requestUsers('GET');
      return {
        ok: true,
        apiUrl: getUsersApiUrl(),
        accountCount: Array.isArray(data?.accounts) ? data.accounts.length : 0,
        writable: !!data?.storage?.writable,
        mode: data?.storage?.mode || 'unknown'
      };
    } catch (error) {
      return {
        ok: false,
        apiUrl: getUsersApiUrl(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function buildUsername(displayName, accounts) {
    const base = String(displayName || 'user')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'user';
    let candidate = base;
    let index = 1;
    while (accounts.some(account => account.username === candidate)) {
      index += 1;
      candidate = `${base}.${index}`;
    }
    return candidate;
  }

  function generatePassword(accounts) {
    const nextNumber = accounts.filter(account => account.role !== 'admin').length + 1;
    return `RiskUser@${String(nextNumber).padStart(2, '0')}`;
  }

  function persistSession(session, warningKey = 'session-write', warningMessage = 'AuthService session write failed:') {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      warnAuthIssueOnce(warningKey, warningMessage, error);
    }
  }

  function writeSession(account) {
    persistSession({
      authenticated: true,
      ts: Date.now(),
      user: sanitiseAccount(account),
      apiSessionToken: account.apiSessionToken || '',
      context: {}
    }, 'session-write', 'AuthService session write failed:');
  }

  function readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!session?.authenticated || !session.user?.username) return null;
      if (Date.now() - Number(session.ts || 0) > SESSION_TTL_MS) {
        logout();
        return null;
      }
      return session;
    } catch {
      warnAuthIssueOnce('session-read', 'AuthService session read failed.');
      return null;
    }
  }

  // [ENTRA-INTEGRATION] Replace with Entra loginPopup() and claim validation.
  async function login(username, password) {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');
    try {
      const data = await requestUsers('POST', {
        action: 'login',
        username: normalizedUsername,
        password: normalizedPassword
      });
      if (!data?.user) return { success: false, error: 'Invalid username or password' };
      const knownAccounts = readCachedAccounts().filter(account => account.username !== data.user.username);
      saveCache([...knownAccounts, data.user]);
      writeSession({ ...data.user, apiSessionToken: data.sessionToken || '' });
      if (data.user.role === 'admin') {
        try {
          await refreshManagedAccounts();
        } catch (refreshError) {
          console.warn('AuthService.login admin refresh failed:', refreshError.message);
        }
      }
      return { success: true, user: sanitiseAccount(data.user) };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if ((error && error.code === 'ACCOUNT_LOCKED') || /too many login attempts/i.test(message)) {
        return { success: false, error: message || 'Too many login attempts. Please wait and try again.' };
      }
      return { success: false, error: 'Invalid username or password' };
    }
  }

  function logout() {
    try {
      clearSessionStorageEntries({
        exactKeys: [
          SESSION_KEY,
          ADMIN_SECRET_KEY,
          SESSION_NOTICE_KEY,
          'rq_admin_workspace_preview',
          'rip_ai_trace',
          'rip_flags_generated',
          'rip_flags_session_id',
          'rip_rag_warned'
        ],
        prefixKeys: [
          'rq_results_tab__',
          'rq_boardroom__'
        ]
      });
      localStorage.removeItem(ACCOUNTS_CACHE_KEY);
      localStorage.removeItem(ADMIN_SECRET_KEY);
    } catch (error) {
      warnAuthIssueOnce('session-clear', 'AuthService session cleanup failed:', error);
    }
    accountsCache = [];
    adminSecretMemory = '';

  }

  function isAuthenticated() {
    return !!readSession();
  }

  function isAdminAuthenticated() {
    return readSession()?.user?.role === 'admin';
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session?.user) return null;
    return {
      ...session.user,
      ...(session.context || {})
    };
  }

  function updateSessionContext(context = {}) {
    const session = readSession();
    if (!session?.user) return null;
    session.context = {
      ...(session.context || {}),
      ...context
    };
    session.ts = Date.now();
    persistSession(session, 'session-context-write', 'AuthService session context write failed:');
    return getCurrentUser();
  }

  function getApiSessionToken() {
    return readSession()?.apiSessionToken || '';
  }


  function getManagedAccounts() {
    if (!isAdminAuthenticated()) return [];
    return readCachedAccounts()
      .filter(account => account.role !== 'admin')
      .map(account => sanitiseAccount(account));
  }

  async function createManagedAccount({ displayName, businessUnitEntityId = '', departmentEntityId = '', role = 'user' } = {}) {
    const accounts = await refreshManagedAccounts().catch(() => readCachedAccounts());
    const username = buildUsername(displayName, accounts);
    const password = generatePassword(accounts);
    const account = normaliseAccount({
      username,
      password,
      displayName,
      role: role === 'bu_admin' ? 'bu_admin' : (role === 'function_admin' ? 'function_admin' : 'user'),
      businessUnitEntityId,
      departmentEntityId
    });
    const data = await requestUsers('POST', { action: 'create', account }, { includeAdminSecret: true });
    if (Array.isArray(data?.accounts)) saveCache(data.accounts);
    return { ...(data?.account || sanitiseAccount(account)), password: data?.password || password };
  }

  async function updateManagedAccount(username, updates = {}) {
    const data = await requestUsers('PATCH', {
      action: 'self-update',
      username: String(username || '').trim().toLowerCase(),
      updates: {
        displayName: typeof updates.displayName === 'string' ? updates.displayName.trim() : undefined
      }
    });
    if (Array.isArray(data?.accounts)) saveCache(data.accounts);
    const updated = readCachedAccounts().find(account => account.username === String(username || '').trim().toLowerCase()) || null;
    const session = readSession();
    if (session?.user?.username === updated?.username) {
      session.user = sanitiseAccount(updated);
      persistSession(session, 'session-user-refresh-write', 'AuthService session refresh write failed:');
    }
    return updated ? sanitiseAccount(updated) : null;
  }


  async function adminUpdateManagedAccount(username, updates = {}) {
    const data = await requestUsers('PATCH', {
      action: 'admin-update',
      username: String(username || '').trim().toLowerCase(),
      updates: {
        displayName: typeof updates.displayName === 'string' ? updates.displayName.trim() : undefined,
        role: typeof updates.role === 'string' ? updates.role.trim() : undefined,
        businessUnitEntityId: typeof updates.businessUnitEntityId === 'string' ? updates.businessUnitEntityId.trim() : undefined,
        departmentEntityId: typeof updates.departmentEntityId === 'string' ? updates.departmentEntityId.trim() : undefined
      }
    }, { includeAdminSecret: true });
    if (Array.isArray(data?.accounts)) saveCache(data.accounts);
    else await refreshManagedAccounts().catch(() => {});
    const updated = readCachedAccounts().find(account => account.username === String(username || '').trim().toLowerCase()) || null;
    return updated ? sanitiseAccount(updated) : null;
  }

  async function resetManagedPassword(username) {
    const data = await requestUsers('PATCH', {
      action: 'reset-password',
      username: String(username || '').trim().toLowerCase()
    }, { includeAdminSecret: true });
    if (Array.isArray(data?.accounts)) saveCache(data.accounts);
    else await refreshManagedAccounts().catch(() => {});
    return {
      account: data?.account ? sanitiseAccount(data.account) : null,
      password: data?.password || ''
    };
  }

  async function deleteManagedAccount(username) {
    const data = await requestUsers('PATCH', {
      action: 'delete-user',
      username: String(username || '').trim().toLowerCase()
    }, { includeAdminSecret: true });
    if (Array.isArray(data?.accounts)) saveCache(data.accounts);
    else await refreshManagedAccounts().catch(() => {});
    return true;
  }

  return {
    init,
    refreshCurrentSessionUser,
    testUsersStoreHealth,
    login,
    logout,
    isAuthenticated,
    isAdminAuthenticated,
    getCurrentUser,
    updateSessionContext,
    getApiSessionToken,
    getManagedAccounts,
    createManagedAccount,
    updateManagedAccount,
    adminUpdateManagedAccount,
    resetManagedPassword,
    deleteManagedAccount,
    buildApiError,
    consumeSessionNotice,
    forceSessionExpiry,
    getAdminApiSecret,
    handleApiAuthFailure,
    setAdminApiSecret
  };
})();
