'use strict';

function getPlaywrightBasePath() {
  const rawBaseUrl = String(process.env.PLAYWRIGHT_BASE_URL || '').trim();
  if (!rawBaseUrl) return '';
  try {
    const pathname = new URL(rawBaseUrl).pathname.replace(/\/+$/, '');
    return pathname === '/' ? '' : pathname;
  } catch {
    return '';
  }
}

function appRoute(route = '/') {
  const value = String(route || '/');
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (!value.startsWith('/')) return value;
  const basePath = getPlaywrightBasePath();
  if (!basePath || value === basePath || value.startsWith(`${basePath}/`)) return value;
  return `${basePath}${value}`;
}

module.exports = {
  appRoute,
  getPlaywrightBasePath
};
