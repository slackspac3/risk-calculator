#!/usr/bin/env node
'use strict';

const DEFAULT_PAGES_URL = 'https://slackspac3.github.io/risk-calculator/';
const DEFAULT_VERCEL_URL = 'https://risk-calculator-eight.vercel.app/';

const pagesUrl = normaliseBaseUrl(process.env.ONLINE_SMOKE_PAGES_URL || DEFAULT_PAGES_URL);
const vercelUrl = normaliseBaseUrl(process.env.ONLINE_SMOKE_VERCEL_URL || DEFAULT_VERCEL_URL);
const sessionToken = String(process.env.ONLINE_SMOKE_SESSION_TOKEN || '').trim();
const strictAi = /^(1|true|yes)$/i.test(String(process.env.ONLINE_SMOKE_STRICT_AI || ''));

const failures = [];
const notes = [];

function normaliseBaseUrl(value) {
  const url = String(value || '').trim();
  return url.endsWith('/') ? url : `${url}/`;
}

function absoluteUrl(baseUrl, assetPath) {
  return new URL(String(assetPath || '').replace(/^\.\//, ''), baseUrl).toString();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 15000));
  try {
    return await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function check(condition, message) {
  if (!condition) failures.push(message);
}

function headerIncludes(headers, name, expected) {
  return String(headers.get(name) || '').toLowerCase().includes(String(expected || '').toLowerCase());
}

function extractCriticalAssets(html) {
  const assets = new Set();
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["']/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) {
      const value = String(match[1] || '');
      if (/assets\/(?:releaseBootstrap|app|tokens|services\/assetLoader)\.(?:js|css)/.test(value)
        || /assets\/(?:app|tokens)\.css/.test(value)) {
        assets.add(value);
      }
    }
  }
  return [...assets];
}

async function checkIndex(label, baseUrl, { expectVercelHeaders = false } = {}) {
  const response = await fetchWithTimeout(baseUrl);
  await check(response.ok, `${label} index returned ${response.status}`);
  const html = await response.text();
  await check(html.includes('__RISK_CALCULATOR_RELEASE__') || html.includes('assets/releaseBootstrap.js'), `${label} index is missing release bootstrap`);
  await check(html.includes('assets/services/assetLoader.js'), `${label} index is missing the asset loader`);
  await check(!html.includes('cdnjs.cloudflare.com/ajax/libs/xlsx'), `${label} index still loads XLSX upfront`);
  await check(!html.includes('cdnjs.cloudflare.com/ajax/libs/jspdf'), `${label} index still loads jsPDF upfront`);

  if (expectVercelHeaders) {
    await check(headerIncludes(response.headers, 'content-security-policy', "default-src 'self'"), `${label} is missing CSP`);
    await check(headerIncludes(response.headers, 'x-frame-options', 'deny'), `${label} is missing X-Frame-Options DENY`);
    await check(headerIncludes(response.headers, 'x-content-type-options', 'nosniff'), `${label} is missing X-Content-Type-Options nosniff`);
  }

  const criticalAssets = extractCriticalAssets(html);
  await check(criticalAssets.length >= 3, `${label} did not expose the expected critical assets`);
  for (const assetPath of criticalAssets) {
    const assetUrl = absoluteUrl(baseUrl, assetPath);
    const assetResponse = await fetchWithTimeout(assetUrl);
    await check(assetResponse.ok, `${label} critical asset failed: ${assetPath} returned ${assetResponse.status}`);
    const body = await assetResponse.text();
    await check(body.length > 0, `${label} critical asset was empty: ${assetPath}`);
    if (expectVercelHeaders && /(^|\/)assets\//.test(assetPath)) {
      await check(headerIncludes(assetResponse.headers, 'cache-control', 'immutable'), `${label} asset cache header is not immutable for ${assetPath}`);
    }
  }
}

async function checkProtectedAiStatus() {
  const statusUrl = absoluteUrl(vercelUrl, 'api/ai/status?probe=0');
  const response = await fetchWithTimeout(statusUrl, {
    headers: {
      origin: pagesUrl.replace(/\/$/, '')
    }
  });
  await check(response.status === 401, `AI status without session should return 401, got ${response.status}`);
}

async function checkAuthenticatedAiStatus() {
  if (!sessionToken) {
    notes.push('Skipping authenticated AI/RAG status probe because ONLINE_SMOKE_SESSION_TOKEN is not set.');
    return;
  }
  const statusUrl = absoluteUrl(vercelUrl, 'api/ai/status?probe=1&ragProbe=1');
  const response = await fetchWithTimeout(statusUrl, {
    headers: {
      origin: pagesUrl.replace(/\/$/, ''),
      'x-session-token': sessionToken
    },
    timeoutMs: 25000
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    failures.push(`Authenticated AI status returned ${response.status}: ${body.slice(0, 180)}`);
    return;
  }
  const payload = await response.json().catch(() => null);
  await check(payload && typeof payload === 'object', 'Authenticated AI status did not return JSON');
  if (payload) {
    notes.push(`AI mode: ${String(payload.mode || payload.status || 'unknown')}`);
    notes.push(`RAG provider: ${String(payload.evidenceRag?.provider || 'unknown')}`);
    if (strictAi) {
      await check(payload.aiUnavailable !== true, 'Strict AI smoke failed: AI is unavailable');
      await check(payload.evidenceRag?.configured !== false, 'Strict AI smoke failed: evidence RAG is not configured');
    }
  }
}

(async () => {
  await checkIndex('GitHub Pages', pagesUrl);
  await checkIndex('Vercel production', vercelUrl, { expectVercelHeaders: true });
  await checkProtectedAiStatus();
  await checkAuthenticatedAiStatus();

  for (const note of notes) console.log(`- ${note}`);

  if (failures.length) {
    console.error('Online smoke check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('Online smoke check passed.');
})().catch((error) => {
  console.error('Online smoke check failed unexpectedly:', error?.message || error);
  process.exit(1);
});
