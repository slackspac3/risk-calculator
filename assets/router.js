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
        route.handler(params, hash);
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
