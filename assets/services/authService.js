/**
 * authService.js — Authentication stub
 * 
 * PoC: Admin protected by shared password only.
 * Users: no authentication required.
 * 
 * TODO: Replace with Microsoft Entra ID (MSAL.js) for production.
 * Integration points marked with [ENTRA-INTEGRATION].
 */

const AuthService = (() => {
  const ADMIN_PASSWORD = 'G42Risk2024!'; // [ENTRA-INTEGRATION] Replace with Entra app registration
  const SESSION_KEY = 'rq_admin_session';

  // [ENTRA-INTEGRATION] In production, call MSAL loginPopup() here
  function adminLogin(password) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        authenticated: true,
        ts: Date.now(),
        role: 'admin'
      }));
      return { success: true };
    }
    return { success: false, error: 'Invalid password' };
  }

  function adminLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    // [ENTRA-INTEGRATION] Call MSAL logout()
  }

  function isAdminAuthenticated() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s || !s.authenticated) return false;
      // Session expires after 4 hours
      if (Date.now() - s.ts > 4 * 60 * 60 * 1000) {
        adminLogout();
        return false;
      }
      return true;
    } catch { return false; }
  }

  // [ENTRA-INTEGRATION] In production, validate Entra token for user claims
  function getCurrentUser() {
    if (isAdminAuthenticated()) {
      return { role: 'admin', displayName: 'PoC Admin' };
    }
    return { role: 'user', displayName: 'Anonymous User' };
  }

  return { adminLogin, adminLogout, isAdminAuthenticated, getCurrentUser, ADMIN_PASSWORD };
})();
