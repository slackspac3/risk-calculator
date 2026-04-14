function requireAuth() {
  const user = AuthService?.getCurrentUser?.();
  if (!user) {
    if (typeof AppState !== 'undefined' && AppState) AppState.currentUser = null;
    if (String(window.location.hash || '') !== '#/login') {
      window.location.hash = '#/login';
    }
    // Protected-route redirects can happen during initial resolution, so render the login surface immediately.
    if (typeof renderLogin === 'function') renderLogin();
    else Router?.navigate('/login');
    return false;
  }
  if (typeof AppState !== 'undefined' && AppState) AppState.currentUser = user;
  return true;
}

function requireAdmin() {
  if (!requireAuth()) return false;
  if (!AuthService?.isAdminAuthenticated?.()) {
    if (String(window.location.hash || '') !== '#/settings') {
      window.location.hash = '#/settings';
    }
    if (typeof renderUserSettings === 'function') renderUserSettings();
    else Router?.navigate('/settings');
    return false;
  }
  return true;
}

function withAuth(renderer) {
  return (params, hash) => {
    if (!requireAuth()) return;
    renderer(params, hash);
  };
}

function withAdmin(renderer) {
  return (params, hash) => {
    if (!requireAdmin()) return;
    renderer(params, hash);
  };
}

window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.withAuth = withAuth;
window.withAdmin = withAdmin;
