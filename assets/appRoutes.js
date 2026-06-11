(function(global) {
  'use strict';

  function getCurrentHash() {
    return String(global.location?.hash || '#/').slice(1) || '/';
  }

  function renderRouteAssetLoading(label = 'Loading workspace') {
    if (typeof setPage !== 'function') return;
    setPage(`<main class="page"><div class="container container--narrow" style="padding:var(--sp-12,3rem) var(--sp-6,1.5rem)"><div class="card card--elevated" style="padding:var(--sp-8,2rem)"><div class="skeleton-line" style="width:128px;height:12px;margin-bottom:var(--sp-4,1rem)"></div><h2 style="margin-bottom:var(--sp-3,0.75rem)">${label}</h2><p style="color:var(--text-muted,#888);line-height:1.7">Preparing the tools for this section.</p></div></div></main>`);
  }

  function renderRouteAssetError(error) {
    console.error('AppRoutes: route asset load failed:', error);
    if (typeof setPage === 'function') {
      setPage(`<main class="page"><div class="container container--narrow" style="padding:var(--sp-12,3rem) var(--sp-6,1.5rem)"><div class="card card--elevated" style="padding:var(--sp-8,2rem)"><h2 style="margin-bottom:var(--sp-4,1rem)">This section could not load</h2><p style="color:var(--text-muted,#888);line-height:1.7">Refresh the page and try again. If the problem continues, the latest deployment may still be propagating.</p><div style="margin-top:var(--sp-6,1.5rem);display:flex;gap:var(--sp-3,0.75rem);flex-wrap:wrap"><button class="btn btn--primary" onclick="window.location.reload()">Refresh</button><a href="#/dashboard" class="btn btn--secondary">Dashboard</a></div></div></div></main>`);
    }
  }

  function withRouteAssets(routeKey, renderer, options = {}) {
    return async (params, hash) => {
      try {
        if (!global.AppAssetLoader || typeof global.AppAssetLoader.loadRouteAssets !== 'function') {
          throw new Error('AppAssetLoader is not available.');
        }
        if (options.loading !== false) renderRouteAssetLoading(options.label || 'Loading workspace');
        await global.AppAssetLoader.loadRouteAssets(routeKey);
        if (hash && getCurrentHash() !== hash) return;
        return renderer(params, hash);
      } catch (error) {
        renderRouteAssetError(error);
      }
    };
  }

  const AppRoutes = {
    register(router) {
      return router
        .on('/login', renderLogin)
        .on('/about', renderPublicAboutPage)
        .on('/privacy', renderPublicPrivacyPage)
        .on('/contact', renderPublicContactPage)
        .on('/', () => {
          if (!AuthService.isAuthenticated()) {
            renderLanding();
            return;
          }
          Router.navigate(typeof getDefaultRouteForCurrentUser === 'function'
            ? getDefaultRouteForCurrentUser()
            : '/dashboard');
        })
        .on('/dashboard', withAuth(withRouteAssets('dashboard', () => renderUserDashboard(), { label: 'Loading dashboard' })))
        .on('/wizard/1', withAuth(withRouteAssets('wizardStep1', () => renderWizardGuide(), { label: 'Loading assessment start' })))
        .on('/wizard/2', withAuth(withRouteAssets('wizardStep1', () => renderWizard1(), { label: 'Loading intake workspace' })))
        .on('/wizard/3', withAuth(withRouteAssets('wizardStep2', () => renderWizard2(), { label: 'Loading scenario workspace' })))
        .on('/wizard/4', withAuth(withRouteAssets('wizardStep3', () => renderWizard3(), { label: 'Loading estimate workspace' })))
        .on('/wizard/5', withAuth(withRouteAssets('wizardStep4', () => renderWizard4(), { label: 'Loading run workspace' })))
        .on('/results/:id', withAuth(withRouteAssets('results', params => renderResults(params.id), { label: 'Loading results' })))
        .on('/settings', withAuth(withRouteAssets('settings', () => renderUserSettings(), { label: 'Loading settings' })))
        .on('/help', withAuth(renderHelpPage))
        .on('/admin', renderLogin)
        .on('/admin/home', withAdmin(withRouteAssets('admin', () => renderAdminHome(), { label: 'Loading admin console' })))
        .on('/admin/settings', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings(getPreferredAdminSection()), { label: 'Loading admin settings' })))
        .on('/admin/settings/org', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('org'), { label: 'Loading admin settings' })))
        .on('/admin/settings/company', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('company'), { label: 'Loading admin settings' })))
        .on('/admin/settings/defaults', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('defaults'), { label: 'Loading admin settings' })))
        .on('/admin/settings/governance', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('governance'), { label: 'Loading admin settings' })))
        .on('/admin/settings/feedback', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('feedback'), { label: 'Loading admin settings' })))
        .on('/admin/settings/access', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('access'), { label: 'Loading admin settings' })))
        .on('/admin/settings/users', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('users'), { label: 'Loading admin settings' })))
        .on('/admin/settings/audit', withAdmin(withRouteAssets('admin', () => safeRenderAdminSettings('audit'), { label: 'Loading admin settings' })))
        .on('/admin/bu', withAdmin(withRouteAssets('admin', () => renderAdminBU(), { label: 'Loading admin console' })))
        .on('/admin/docs', withAdmin(withRouteAssets('admin', () => renderAdminDocs(), { label: 'Loading document library' })))
        .notFound(() => {
          if (!AuthService.isAuthenticated()) {
            Router.navigate('/');
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
