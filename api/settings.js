const crypto = require('crypto');

const SETTINGS_KEY = process.env.SETTINGS_STORE_KEY || 'risk_calculator_settings';
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || '';

function getKvUrl() {
  return process.env.APPLE_CAT || process.env.FOO_URL_TEST || process.env.RC_USER_STORE_URL || process.env.USER_STORE_KV_URL || process.env.KV_REST_API_URL || '';
}

function getKvToken() {
  return process.env.BANANA_DOG || process.env.FOO_TOKEN_TEST || process.env.RC_USER_STORE_TOKEN || process.env.USER_STORE_KV_TOKEN || process.env.KV_REST_API_TOKEN || '';
}

async function runKvCommand(command) {
  const url = getKvUrl();
  const token = getKvToken();
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `KV request failed with HTTP ${res.status}`);
  }
  return res.json();
}

function hasWritableKv() {
  return !!(getKvUrl() && getKvToken());
}

function getDefaultSettings() {
  return {
    geography: 'United Arab Emirates',
    companyWebsiteUrl: '',
    companyContextProfile: '',
    companyContextSections: null,
    companyStructure: [],
    entityContextLayers: [],
    riskAppetiteStatement: 'Moderate. Escalate risks that threaten regulated operations, cross-border data movement, or strategic platforms.',
    applicableRegulations: ['UAE PDPL', 'BIS Export Controls', 'OFAC Sanctions', 'UAE Cybersecurity Council Guidance'],
    aiInstructions: 'Prioritise operational, regulatory, and strategic impact. Use British English.',
    benchmarkStrategy: 'Prefer GCC and UAE benchmark references where relevant. Where GCC data is thin, use the best available global benchmark and explain the fallback clearly.',
    defaultLinkMode: true,
    toleranceThresholdUsd: 5000000,
    warningThresholdUsd: 3000000,
    annualReviewThresholdUsd: 12000000,
    adminContextSummary: 'Use this workspace to maintain geography, regulations, thresholds, and AI guidance for the platform.',
    escalationGuidance: 'Escalate to leadership when the scenario is above tolerance, close to tolerance, or materially affects regulated services.'
  };
}

function normaliseSettings(settings = {}) {
  const defaults = getDefaultSettings();
  return {
    ...defaults,
    ...settings,
    applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [...defaults.applicableRegulations],
    companyContextSections: settings.companyContextSections && typeof settings.companyContextSections === 'object' ? settings.companyContextSections : null,
    companyStructure: Array.isArray(settings.companyStructure) ? settings.companyStructure : [],
    entityContextLayers: Array.isArray(settings.entityContextLayers) ? settings.entityContextLayers : []
  };
}

async function readSettings() {
  const response = await runKvCommand(['GET', SETTINGS_KEY]);
  const raw = response?.result;
  if (!raw) return getDefaultSettings();
  try {
    return normaliseSettings(JSON.parse(raw));
  } catch {
    return getDefaultSettings();
  }
}

async function writeSettings(settings) {
  if (!hasWritableKv()) {
    throw new Error('Shared settings store is not writable. Configure the shared store environment variables in Vercel.');
  }
  const next = normaliseSettings(settings);
  await runKvCommand(['SET', SETTINGS_KEY, JSON.stringify(next)]);
  return next;
}

function isAdminSecretValid(req) {
  return !!ADMIN_API_SECRET && req.headers['x-admin-secret'] === ADMIN_API_SECRET;
}

function getSessionSigningSecret() {
  return ADMIN_API_SECRET || getKvToken() || 'risk-calculator-poc-session-secret';
}

function verifySessionToken(token) {
  const value = String(token || '').trim();
  if (!value || !value.includes('.')) return null;
  const [payloadPart, signature] = value.split('.', 2);
  const expected = crypto.createHmac('sha256', getSessionSigningSecret()).update(payloadPart).digest('base64url');
  if (signature !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (!payload?.username || Number(payload.exp || 0) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const body = typeof req.body === 'string'
    ? (() => {
        try {
          return JSON.parse(req.body || '{}');
        } catch {
          return {};
        }
      })()
    : (req.body || {});

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-admin-secret,x-session-token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const settings = await readSettings();
      res.status(200).json({
        settings,
        storage: {
          writable: hasWritableKv(),
          mode: hasWritableKv() ? 'shared-kv' : 'fallback-defaults'
        }
      });
      return;
    }

    if (req.method === 'PUT') {
      const session = verifySessionToken(req.headers['x-session-token']);
      if (!isAdminSecretValid(req) && !session) {
        res.status(403).json({ error: 'Admin secret or valid session token required.' });
        return;
      }
      const settings = await writeSettings(body.settings || {});
      res.status(200).json({ settings });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({
      error: 'Settings store request failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
};
