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
          Router.navigate(typeof getDefaultRouteForCurrentUser === 'function'
            ? getDefaultRouteForCurrentUser()
            : '/dashboard');
        })
        .on('/dashboard', withAuth(renderUserDashboard))
        .on('/wizard/1', withAuth(renderWizard1))
        .on('/wizard/2', withAuth(renderWizard2))
        .on('/wizard/3', withAuth(renderWizard3))
        .on('/wizard/4', withAuth(renderWizard4))
        .on('/results/:id', withAuth(params => renderResults(params.id)))
        .on('/settings', withAuth(renderUserSettings))
        .on('/help', withAuth(renderHelpPage))
        .on('/admin', renderLogin)
        .on('/admin/home', withAdmin(renderAdminHome))
        .on('/admin/settings', withAdmin(() => safeRenderAdminSettings(getPreferredAdminSection())))
        .on('/admin/settings/org', withAdmin(() => safeRenderAdminSettings('org')))
        .on('/admin/settings/company', withAdmin(() => safeRenderAdminSettings('company')))
        .on('/admin/settings/defaults', withAdmin(() => safeRenderAdminSettings('defaults')))
        .on('/admin/settings/governance', withAdmin(() => safeRenderAdminSettings('governance')))
        .on('/admin/settings/feedback', withAdmin(() => safeRenderAdminSettings('feedback')))
        .on('/admin/settings/access', withAdmin(() => safeRenderAdminSettings('access')))
        .on('/admin/settings/users', withAdmin(() => safeRenderAdminSettings('users')))
        .on('/admin/settings/audit', withAdmin(() => safeRenderAdminSettings('audit')))
        .on('/admin/bu', withAdmin(renderAdminBU))
        .on('/admin/docs', withAdmin(renderAdminDocs))
        .notFound(() => {
          if (!AuthService.isAuthenticated()) {
            Router.navigate('/login');
            return;
          }
          const fallbackRoute = typeof getDefaultRouteForCurrentUser === 'function'
            ? getDefaultRouteForCurrentUser()
            : '/dashboard';
          const fallbackLabel = fallbackRoute === '/admin/home'
            ? '← Platform Home'
            : '← Dashboard';
          setPage(`<div class="container" style="padding:var(--sp-12)"><h2>Page Not Found</h2><a href="#${fallbackRoute}" class="btn btn--primary" style="margin-top:var(--sp-4)">${fallbackLabel}</a></div>`);
        });
    }
  };

  global.AppRoutes = AppRoutes;
})(window);
