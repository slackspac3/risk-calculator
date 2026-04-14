(function(global) {
  'use strict';

  let notifOutsideClickHandler = null;
  let notifViewportHandler = null;
  let notifSyncBound = false;

  function escapeNavText(value) {
    const text = String(value || '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function relativeTime(ts) {
    const value = Number(new Date(ts || 0).getTime());
    if (!value) return 'Just now';
    const diffMs = Math.max(0, Date.now() - value);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < minute) return 'Just now';
    if (diffMs < hour) {
      const count = Math.max(1, Math.round(diffMs / minute));
      return `${count} minute${count === 1 ? '' : 's'} ago`;
    }
    if (diffMs < day) {
      const count = Math.max(1, Math.round(diffMs / hour));
      return `${count} hour${count === 1 ? '' : 's'} ago`;
    }
    const count = Math.max(1, Math.round(diffMs / day));
    return `${count} day${count === 1 ? '' : 's'} ago`;
  }

  function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge || typeof NotificationService === 'undefined') return;
    const count = NotificationService.getUnread().length;
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count <= 0);
  }

  function closeNotifDrawer() {
    document.getElementById('notif-drawer')?.remove();
    if (notifOutsideClickHandler) {
      document.removeEventListener('click', notifOutsideClickHandler, true);
      notifOutsideClickHandler = null;
    }
    if (notifViewportHandler) {
      window.removeEventListener('resize', notifViewportHandler);
      notifViewportHandler = null;
    }
  }

  function positionNotifDrawer(drawer, bell) {
    if (!drawer || !bell) return;
    const rect = bell.getBoundingClientRect();
    const drawerWidth = Math.min(window.innerWidth - 32, drawer.offsetWidth || 320);
    const preferredLeft = rect.left;
    const left = Math.max(16, Math.min(preferredLeft, window.innerWidth - drawerWidth - 16));
    const top = Math.max(56, rect.bottom + 10);
    drawer.style.left = `${left}px`;
    drawer.style.top = `${top}px`;
    drawer.style.right = 'auto';
  }

  function navigateToNotifLink(linkHash) {
    const safeLink = String(linkHash || '').trim();
    if (!safeLink) return;
    if (safeLink.startsWith('#/')) {
      Router.navigate(safeLink.slice(1));
      return;
    }
    window.location.hash = safeLink;
  }

  function renderNotifDrawer() {
    closeNotifDrawer();
    const bell = document.getElementById('btn-notif-bell');
    if (!bell || typeof NotificationService === 'undefined') return;
    const notifications = NotificationService.getAll();
    const drawer = document.createElement('div');
    drawer.id = 'notif-drawer';
    drawer.className = 'notif-drawer';
    drawer.innerHTML = `
      <div class="flex items-center justify-between" style="padding:8px 16px 12px 16px;border-bottom:1px solid var(--border);margin-bottom:4px">
        <strong style="font-size:13px">Notifications</strong>
        <button type="button" class="btn btn--ghost btn--sm" id="btn-notif-mark-all">Mark all read</button>
      </div>
      ${notifications.length ? notifications.map(n => `
        <div class="notif-item ${n.read ? '' : 'notif-item--unread'}" data-nid="${escapeNavText(n.id)}" data-link="${escapeNavText(n.linkHash || '')}">
          <div class="notif-title">${escapeNavText(n.title)}</div>
          <div class="notif-body">${escapeNavText(n.body)}</div>
          <div class="notif-time">${escapeNavText(relativeTime(n.createdAt))}</div>
        </div>
      `).join('') : `<div class="notif-item"><div class="notif-title">No notifications yet</div><div class="notif-body">New review, change, approval, or escalation updates will appear here.</div></div>`}
    `;
    document.body.appendChild(drawer);
    positionNotifDrawer(drawer, bell);
    drawer.querySelector('#btn-notif-mark-all')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      NotificationService.markAllRead();
      updateNotifBadge();
      renderNotifDrawer();
    });
    drawer.querySelectorAll('.notif-item[data-nid]').forEach(item => {
      item.addEventListener('click', event => {
        event.preventDefault();
        const notificationId = item.dataset.nid || '';
        const linkHash = item.dataset.link || '';
        NotificationService.markRead(notificationId);
        updateNotifBadge();
        closeNotifDrawer();
        if (linkHash) navigateToNotifLink(linkHash);
      });
    });
    notifOutsideClickHandler = event => {
      const nextDrawer = document.getElementById('notif-drawer');
      const nextBell = document.getElementById('btn-notif-bell');
      if (!nextDrawer) return;
      if (nextDrawer.contains(event.target) || nextBell?.contains(event.target)) return;
      closeNotifDrawer();
    };
    notifViewportHandler = () => {
      const nextDrawer = document.getElementById('notif-drawer');
      const nextBell = document.getElementById('btn-notif-bell');
      if (!nextDrawer || !nextBell) return;
      positionNotifDrawer(nextDrawer, nextBell);
    };
    document.addEventListener('click', notifOutsideClickHandler, true);
    window.addEventListener('resize', notifViewportHandler);
  }

  function toggleNotifDrawer() {
    if (document.getElementById('notif-drawer')) {
      closeNotifDrawer();
      return;
    }
    renderNotifDrawer();
  }

  function bindNotifSync() {
    if (notifSyncBound || typeof window === 'undefined') return;
    notifSyncBound = true;
    const refreshNotifications = (event) => {
      const currentUsername = String(AuthService.getCurrentUser()?.username || '').trim().toLowerCase();
      if (!currentUsername) return;
      const changedUsername = String(event?.detail?.username || '').trim().toLowerCase();
      const changedKey = String(event?.key || '').trim();
      if (changedUsername && changedUsername !== currentUsername) return;
      if (changedKey && changedKey !== `rq_notifications_${currentUsername}`) return;
      updateNotifBadge();
      if (document.getElementById('notif-drawer')) renderNotifDrawer();
    };
    window.addEventListener('rq:notifications-changed', refreshNotifications);
    window.addEventListener('storage', refreshNotifications);
  }

  function handleCurrencyChange(newCurrency) {
    if (AppState.currency === newCurrency) return;
    const hash = String(window.location.hash || '');
    const onWizard = /^#\/wizard\/[1-4]/.test(hash);
    if (onWizard) {
      const narrativeEl = document.getElementById('narrative')
        || document.getElementById('intake-risk-statement');
      if (narrativeEl && narrativeEl.value.trim()) {
        AppState.draft.enhancedNarrative = narrativeEl.value;
        AppState.draft.narrative = AppState.draft.narrative || narrativeEl.value;
      }
    }
    AppState.currency = newCurrency;
    AppShellNavigation.renderAppBar();
    Router.resolve();
  }

  function isAdminHomeRoute(currentHash = '') {
    const hash = String(currentHash || '').trim();
    return hash === '#/admin/home' || hash === '#/admin/home/';
  }

  function isAdminConsoleRoute(currentHash = '') {
    const hash = String(currentHash || '').trim();
    return hash.startsWith('#/admin/') && !isAdminHomeRoute(hash);
  }

  function getAppBarNavModel(currentUser, currentHash) {
    const nonAdminCapability = currentUser && currentUser.role !== 'admin'
      ? getNonAdminCapabilityState(currentUser, getUserSettings(), getAdminSettings())
      : null;
    const isOversightUser = !!(nonAdminCapability?.canManageBusinessUnit || nonAdminCapability?.canManageDepartment);
    const navLinks = currentUser?.role === 'admin'
      ? [
          // Keep the app bar at the section level so detailed admin destinations only live in the sidebar.
          { href: '#/admin/home', label: 'Platform Home', active: isAdminHomeRoute(currentHash) },
          { href: '#/admin/settings/org', label: 'Admin Console', active: isAdminConsoleRoute(currentHash) }
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
      closeNotifDrawer();
      bar.innerHTML = `
        <div class="bar-inner">
          <a href="${navModel.homeHref}" class="bar-logo">
            <span class="bar-logo-mark" aria-hidden="true">
              <img src="assets/brand/g42-catalyst-symbol-logo-inverted-rgb.svg" alt="">
            </span>
            <span class="bar-logo-text">Risk <span>Intelligence</span> Platform</span>
          </a>
          <nav class="bar-nav" aria-label="Primary">
            ${navModel.navLinks.map(link => `<a href="${link.href}" class="bar-nav-link${link.active ? ' active' : ''}"${link.active ? ' aria-current="page"' : ''}>${link.label}</a>`).join('')}
          </nav>
          <div class="bar-spacer"></div>
          ${currentUser ? `
            <button class="notif-bell" id="btn-notif-bell" aria-label="Notifications" type="button">
              🔔
              <span class="notif-badge hidden" id="notif-badge">0</span>
            </button>
            <a href="#/help" class="btn btn--ghost btn--sm bar-top-action${currentHash.startsWith('#/help') ? ' active' : ''}" id="btn-open-help"${currentHash.startsWith('#/help') ? ' aria-current="page"' : ''}>Help</a>
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
      updateNotifBadge();
      bindNotifSync();
      document.getElementById('cur-usd').addEventListener('click', () => handleCurrencyChange('USD'));
      document.getElementById('cur-aed').addEventListener('click', () => handleCurrencyChange('AED'));
      document.getElementById('btn-notif-bell')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleNotifDrawer();
      });
      document.getElementById('btn-sign-out')?.addEventListener('click', () => {
        performLogout();
      });
      updateWizardProgressBar(window.location.hash.replace('#', ''));
    }
  };

  global.AppShellNavigation = AppShellNavigation;
})(window);
