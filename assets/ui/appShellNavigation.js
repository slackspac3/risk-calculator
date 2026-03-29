(function(global) {
  'use strict';

  function getAppBarNavModel(currentUser, currentHash) {
    const nonAdminCapability = currentUser && currentUser.role !== 'admin'
      ? getNonAdminCapabilityState(currentUser, getUserSettings(), getAdminSettings())
      : null;
    const isOversightUser = !!(nonAdminCapability?.canManageBusinessUnit || nonAdminCapability?.canManageDepartment);
    const navLinks = currentUser?.role === 'admin'
      ? [
          // Keep the app bar at the section level so detailed admin destinations only live in the sidebar.
          { href: '#/admin/home', label: 'Platform Home', active: currentHash.startsWith('#/admin/home') },
          { href: '#/admin/settings/org', label: 'Admin Console', active: currentHash.startsWith('#/admin/') }
        ]
      : currentUser
        ? [
            { href: '#/dashboard', label: isOversightUser ? 'Workspace' : 'Dashboard', active: currentHash.startsWith('#/dashboard') },
            { href: '#/settings', label: isOversightUser ? (nonAdminCapability?.experience?.primaryActionLabel || 'Role Context') : 'Personal Settings', active: currentHash.startsWith('#/settings') }
          ]
        : [
            { href: '#/', label: 'Home', active: currentHash === '#/' || currentHash === '' }
          ];
    return {
      currentUser,
      currentHash,
      homeHref: currentUser?.role === 'admin' ? '#/admin/home' : currentUser ? '#/dashboard' : '#/',
      navLinks
    };
  }

  const AppShellNavigation = {
    renderAppBar() {
      const currentUser = AuthService.getCurrentUser();
      const currentHash = String(window.location.hash || '#/');
      const navModel = getAppBarNavModel(currentUser, currentHash);
      const bar = document.getElementById('app-bar');
      bar.innerHTML = `
        <div class="bar-inner">
          <a href="${navModel.homeHref}" class="bar-logo">
            <span class="bar-logo-mark" aria-hidden="true">
              <img src="assets/brand/g42-catalyst-symbol-logo-inverted-rgb.svg" alt="">
            </span>
            <span class="bar-logo-text">Risk <span>Intelligence</span> Platform</span>
          </a>
          <nav class="flex items-center gap-3">
            ${navModel.navLinks.map(link => `<a href="${link.href}" class="bar-nav-link${link.active ? ' active' : ''}">${link.label}</a>`).join('')}
          </nav>
          <div class="bar-spacer"></div>
          ${currentUser ? `
            <a href="#/help" class="btn btn--ghost btn--sm${currentHash.startsWith('#/help') ? ' active' : ''}" id="btn-open-help">Help</a>
            <span class="bar-nav-link" style="pointer-events:none">${currentUser.displayName}</span>
            <button type="button" class="btn btn--ghost btn--sm" id="btn-sign-out">Sign Out</button>
          ` : `<a href="#/login" class="bar-nav-link bar-nav-link--admin">Sign In</a>`}
          <div class="currency-toggle" role="group" aria-label="Currency">
            <button id="cur-usd" class="${AppState.currency==='USD'?'active':''}">USD</button>
            <button id="cur-aed" class="${AppState.currency==='AED'?'active':''}">AED</button>
          </div>
          <span class="bar-poc-tag">PoC</span>
        </div>`;
      const pocTag = document.querySelector('.bar-poc-tag');
      if (pocTag && (
        (typeof DemoMode !== 'undefined' && DemoMode.isDemoRunning())
        || window.__RISK_CALCULATOR_RELEASE__?.channel === 'production'
      )) {
        pocTag.classList.add('bar-poc-tag--hidden');
      }
      document.getElementById('cur-usd').addEventListener('click', () => { AppState.currency='USD'; AppShellNavigation.renderAppBar(); Router.resolve(); });
      document.getElementById('cur-aed').addEventListener('click', () => { AppState.currency='AED'; AppShellNavigation.renderAppBar(); Router.resolve(); });
      document.getElementById('btn-sign-out')?.addEventListener('click', () => {
        performLogout();
      });
      updateWizardProgressBar(window.location.hash.replace('#', ''));
    }
  };

  global.AppShellNavigation = AppShellNavigation;
})(window);
