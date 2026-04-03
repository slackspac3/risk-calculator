'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { resetWorkflowReuseState } = require('../../api/_workflowReuse');

const originalEnv = {
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  COMPASS_API_URL: process.env.COMPASS_API_URL,
  COMPASS_MODEL: process.env.COMPASS_MODEL,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET
};
const originalFetch = global.fetch;

function restoreEnv() {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === 'string') process.env[key] = value;
    else delete process.env[key];
  });
}

function buildSessionToken(payload) {
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(payloadPart).digest('base64url');
  return `${payloadPart}.${signature}`;
}

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    payload: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

function loadFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('manual-draft-refinement route lets explicit identity-led text beat a stale financial hint', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error(`Unexpected fetch in manual-draft-refinement test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-draft-refinement');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.',
      scenarioLensHint: { key: 'financial', label: 'Financial', functionKey: 'finance' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.functionKey, 'technology');
  assert.notEqual(res.payload.scenarioLens?.key, 'financial');
  assert.match(String(res.payload.draftNarrative || ''), /credential|tenant|configuration|access/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /capital exposure|receivables/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /identity|credential|account|tenant/i);
  assert.doesNotMatch(titles, /financial|fraud|capital/i);
});

test('manual-shortlist route keeps payment-control failure in the financial lane instead of stale cyber drift', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error(`Unexpected fetch in manual-shortlist test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-shortlist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A payment-control failure causes direct monetary loss and reconciliation pressure.',
      scenarioLensHint: { key: 'cyber', label: 'Cyber', functionKey: 'technology' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.key, 'financial');
  assert.match(String(res.payload.draftNarrative || ''), /payment|monetary|loss|reconciliation/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /tenant|credential|mailbox|ransomware/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /payment|financial|loss|control/i);
  assert.doesNotMatch(titles, /cyber|identity|credential/i);
});

test('manual-intake-assist route keeps supplier delivery slippage out of cyber despite a stale hint', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error(`Unexpected fetch in manual-intake-assist test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-intake-assist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A key supplier misses a committed delivery date, delaying infrastructure deployment and dependent projects.',
      scenarioLensHint: { key: 'cyber', label: 'Cyber', functionKey: 'technology' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.notEqual(res.payload.scenarioLens?.key, 'cyber');
  assert.notEqual(res.payload.scenarioLens?.functionKey, 'technology');
  assert.match(String(res.payload.draftNarrative || ''), /supplier|delivery|deployment|project/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /credential|identity|tenant|mailbox/i);
});

test('manual-shortlist route returns manual mode for ambiguous short text instead of fake precision', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error(`Unexpected fetch in manual-shortlist manual-mode test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-shortlist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Issue'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(Array.isArray(res.payload.risks) ? res.payload.risks.length : 0, 0);
});
