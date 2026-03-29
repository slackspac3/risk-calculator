(function(global) {
  'use strict';

  const AppRoutes = {
    register(router) {
      return router
        .on('/login', renderLogin)
        .on('/', () => {
          if (!AuthService.isAuthenticated()) {
            Router.navigate('/login');
            return;
          }
          Router.navigate('/dashboard');
        })
        .on('/dashboard', renderUserDashboard)
        .on('/wizard/1', withAuth(renderWizard1))
        .on('/wizard/2', withAuth(renderWizard2))
        .on('/wizard/3', withAuth(renderWizard3))
        .on('/wizard/4', withAuth(renderWizard4))
        .on('/results/:id', withAuth(params => renderResults(params.id)))
        .on('/settings', renderUserSettings)
        .on('/help', withAuth(renderHelpPage))
        .on('/admin', renderLogin)
        .on('/admin/home', renderAdminHome)
        .on('/admin/settings', () => safeRenderAdminSettings(getPreferredAdminSection()))
        .on('/admin/settings/org', () => safeRenderAdminSettings('org'))
        .on('/admin/settings/company', () => safeRenderAdminSettings('company'))
        .on('/admin/settings/defaults', () => safeRenderAdminSettings('defaults'))
        .on('/admin/settings/governance', () => safeRenderAdminSettings('governance'))
        .on('/admin/settings/access', () => safeRenderAdminSettings('access'))
        .on('/admin/settings/users', () => safeRenderAdminSettings('users'))
        .on('/admin/settings/audit', () => safeRenderAdminSettings('audit'))
        .on('/admin/bu', renderAdminBU)
        .on('/admin/docs', renderAdminDocs)
        .notFound(() => {
          if (!AuthService.isAuthenticated()) {
            Router.navigate('/login');
            return;
          }
          setPage(`<div class="container" style="padding:var(--sp-12)"><h2>Page Not Found</h2><a href="#/dashboard" class="btn btn--primary" style="margin-top:var(--sp-4)">← Dashboard</a></div>`);
        });
    }
  };

  global.AppRoutes = AppRoutes;
})(window);
