/**
 * router.js — Hash-based SPA router
 */

const Router = (() => {
  const routes = [];
  let _notFound = null;
  let currentHash = null;
  let pendingNavigationKind = 'load';

  function on(pattern, handler) {
    routes.push({ pattern: new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$'), raw: pattern, handler });
    return this;
  }

  function notFound(handler) {
    _notFound = handler;
  }

  function _getHash() {
    return window.location.hash.slice(1) || '/';
  }

  function navigate(path) {
    if (_getHash() === path) {
      pendingNavigationKind = 'refresh';
      resolve();
      return;
    }
    pendingNavigationKind = 'navigate';
    window.location.hash = path;
  }

  function resolve() {
    const hash = _getHash();
    const previousHash = currentHash;
    const routeChanged = previousHash !== hash;
    if (typeof window !== 'undefined') {
      window.__RISK_ROUTE_META__ = {
        currentHash: hash,
        previousHash,
        routeChanged,
        navigationKind: pendingNavigationKind
      };
    }
    currentHash = hash;
    pendingNavigationKind = 'resolve';
    for (const route of routes) {
      const m = hash.match(route.pattern);
      if (m) {
        const paramNames = (route.raw.match(/:[^/]+/g) || []).map(p => p.slice(1));
        const params = {};
        paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
        try {
          route.handler(params, hash);
        } catch (error) {
          console.error('Router: unhandled error in route handler for', hash, error);
          if (typeof setPage === 'function') {
            setPage(`<main class="page"><div class="container container--narrow" style="padding:var(--sp-12,3rem) var(--sp-6,1.5rem)"><div class="card card--elevated" style="padding:var(--sp-8,2rem)"><h2 style="margin-bottom:var(--sp-4,1rem)">Something went wrong</h2><p style="color:var(--text-muted,#888);line-height:1.7">This page could not be rendered. The error has been logged to the developer console.</p><div style="margin-top:var(--sp-6,1.5rem)"><a href="#/dashboard" class="btn btn--primary">← Dashboard</a></div></div></div></main>`);
          }
        }
        return;
      }
    }
    if (_notFound) _notFound(hash);
  }

  function init() {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.addEventListener('hashchange', () => {
      pendingNavigationKind = 'hashchange';
      resolve();
    });
    resolve();
  }

  return { on, notFound, navigate, init, resolve };
})();
