const ApiOriginResolver = (() => {
  const DEFAULT_API_ORIGIN = 'https://risk-calculator-eight.vercel.app';

  function _normaliseOrigin(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw).origin;
    } catch {
      return '';
    }
  }

  function _getWindowRef(explicitWindow = null) {
    if (explicitWindow && typeof explicitWindow === 'object') return explicitWindow;
    if (typeof window !== 'undefined' && window) return window;
    return null;
  }

  function _readMetaApiOrigin(windowRef = null) {
    try {
      const meta = windowRef?.document?.querySelector?.('meta[name="risk-api-origin"]');
      return _normaliseOrigin(meta?.content || '');
    } catch {
      return '';
    }
  }

  function _readConfiguredApiOrigin(windowRef = null) {
    return _normaliseOrigin(
      windowRef?.__RISK_API_ORIGIN__
      || _readMetaApiOrigin(windowRef)
      || windowRef?.__RISK_CALCULATOR_RELEASE__?.apiOrigin
      || ''
    );
  }

  function _getCurrentOrigin(windowRef = null) {
    return _normaliseOrigin(windowRef?.location?.origin || '');
  }

  function isVercelHostedOrigin(origin = '') {
    try {
      return /\.vercel\.app$/i.test(new URL(String(origin || '')).hostname || '');
    } catch {
      return false;
    }
  }

  function resolveApiOrigin({ windowRef = null, fallbackOrigin = DEFAULT_API_ORIGIN } = {}) {
    const resolvedWindow = _getWindowRef(windowRef);
    const currentOrigin = _getCurrentOrigin(resolvedWindow);
    if (currentOrigin && isVercelHostedOrigin(currentOrigin)) return currentOrigin;

    const configuredOrigin = _readConfiguredApiOrigin(resolvedWindow);
    if (configuredOrigin) return configuredOrigin;

    return _normaliseOrigin(fallbackOrigin) || currentOrigin;
  }

  function resolveApiUrl(path = '', options = {}) {
    const safePath = String(path || '').trim();
    if (!safePath) return '';
    try {
      return new URL(safePath, `${resolveApiOrigin(options)}/`).toString();
    } catch {
      return '';
    }
  }

  return {
    DEFAULT_API_ORIGIN,
    isVercelHostedOrigin,
    resolveApiOrigin,
    resolveApiUrl
  };
})();

if (typeof globalThis !== 'undefined' && globalThis) globalThis.ApiOriginResolver = ApiOriginResolver;
if (typeof window !== 'undefined' && window) window.ApiOriginResolver = ApiOriginResolver;
if (typeof module !== 'undefined') module.exports = ApiOriginResolver;
