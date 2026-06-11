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

test('register-analysis route returns manual mode for header-only uploads before any upstream AI call', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error(`Unexpected fetch in manual register-analysis test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/register-analysis');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      registerText: 'Risk title\nDescription\nOwner\nStatus'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token,
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, false);
  assert.deepEqual(res.payload.risks, []);
  assert.equal(String(res.payload.manualReasonCode || ''), 'incomplete_register_input');
  assert.equal(String(res.payload.trace?.label || ''), 'Step 2 register analysis');
});

test('register-analysis route returns deterministic server fallback when hosted AI proxy is not configured', async () => {
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
    throw new Error(`Unexpected fetch in fallback register-analysis test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/register-analysis');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      registerText: 'Privileged access review is incomplete and stale.\nThird-party dependency control is weak.'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token,
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(String(res.payload.fallbackReasonTitle || ''), 'Deterministic fallback register analysis loaded');
  assert.equal(Array.isArray(res.payload.risks), true);
  assert.equal(String(res.payload.trace?.label || ''), 'Step 2 register analysis');
});

test('register-analysis route orchestrates live extraction and quality-gate server-side', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    summary: 'The uploaded register highlights two identity and third-party control issues that should be shortlisted.',
    linkAnalysis: 'The extracted risks come directly from the uploaded register rows and should be deduplicated before linking them into a common scenario.',
    workflowGuidance: [
      'Remove duplicate rows before selecting the final shortlist.',
      'Keep only the risks that materially change loss, disruption, or control exposure.'
    ],
    benchmarkBasis: 'Prefer GCC control and resilience benchmarks where comparable evidence exists.',
    risks: [
      {
        title: 'Privileged access review weakness',
        category: 'Identity & Access',
        description: 'The register shows stale privileged access review activity.',
        confidence: 'high',
        regulations: ['ISO 27001']
      },
      {
        title: 'Third-party dependency control weakness',
        category: 'Third-party',
        description: 'The register shows weak monitoring of a third-party dependency.',
        confidence: 'high',
        regulations: ['ISO 22301']
      }
    ]
  });

  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: aiPayload
            }
          }
        ]
      }),
      text: async () => aiPayload
    };
  };

  const handler = loadFresh('../../api/ai/register-analysis');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      registerText: 'Privileged access review is incomplete and stale.\nThird-party dependency control is weak.',
      registerMeta: {
        extension: 'csv',
        sheets: [{ sheetName: 'Risk Register', rowCount: 2 }]
      },
      traceLabel: 'Step 2 register analysis'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token,
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(Array.isArray(res.payload.risks), true);
  assert.equal(res.payload.risks.length >= 1, true);
  assert.match(String(res.payload.summary || ''), /uploaded register/i);
  assert.equal(String(res.payload.trace?.label || ''), 'Step 2 register analysis');
});

test('register-analysis route trims repeated headers, noisy columns, and excess rows before the upstream AI call', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    summary: 'The uploaded register highlights two material issues.',
    linkAnalysis: 'The extracted risks come directly from the uploaded register rows.',
    workflowGuidance: ['Shortlist only the materially distinct rows.'],
    benchmarkBasis: 'Prefer comparable GCC controls where available.',
    risks: [
      {
        title: 'Risk 1',
        category: 'Register',
        description: 'Gap 1',
        confidence: 'high',
        regulations: []
      }
    ]
  });

  let capturedUserPrompt = '';
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    const payload = JSON.parse(options.body);
    capturedUserPrompt = String(payload?.messages?.[payload.messages.length - 1]?.content || '');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: aiPayload
            }
          }
        ]
      }),
      text: async () => aiPayload
    };
  };

  const noisyRows = Array.from({ length: 90 }, (_, index) => `${index + 1}. Risk title: Risk ${index + 1} | Description: Gap ${index + 1} | Owner: Team ${index + 1} | Status: Open | Due Date: 2026-06-30`).join('\n');
  const handler = loadFresh('../../api/ai/register-analysis');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      registerText: [
        'Sheet: Register A',
        'Columns: Risk title, Description, Owner, Status, Due Date',
        'Rows:',
        '1. Risk title: Risk title | Description: Description | Owner: Owner | Status: Status | Due Date: Due Date',
        '',
        noisyRows
      ].join('\n')
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token,
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.match(capturedUserPrompt, /Sheet: Register A/);
  assert.match(capturedUserPrompt, /Columns: Risk title, Description/);
  assert.doesNotMatch(capturedUserPrompt, /\bRows:\b/);
  assert.doesNotMatch(capturedUserPrompt, /Risk title: Risk title \| Description: Description/i);
  assert.doesNotMatch(capturedUserPrompt, /Owner: Team 1/);
  assert.doesNotMatch(capturedUserPrompt, /\bStatus: Open\b/);
  assert.match(capturedUserPrompt, /Risk title: Risk 1 \| Description: Gap 1/);
  assert.match(capturedUserPrompt, /Risk title: Risk 80 \| Description: Gap 80/);
  assert.doesNotMatch(capturedUserPrompt, /Risk title: Risk 81 \| Description: Gap 81/);
});

test('register-analysis route reuses the recent identical result for the same user and input', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    summary: 'The uploaded register highlights one identity-control issue that should remain shortlisted.',
    linkAnalysis: 'The extracted risk comes directly from the uploaded register row.',
    workflowGuidance: ['Confirm the row is still current before keeping it in scope.'],
    benchmarkBasis: 'Prefer like-for-like control benchmarks.',
    risks: [
      {
        title: 'Privileged access review weakness',
        category: 'Identity & Access',
        description: 'The register shows stale privileged access review activity.',
        confidence: 'high',
        regulations: ['ISO 27001']
      }
    ]
  });

  let aiFetchCount = 0;
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    aiFetchCount += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: aiPayload
            }
          }
        ]
      }),
      text: async () => aiPayload
    };
  };

  const handler = loadFresh('../../api/ai/register-analysis');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const req = {
    method: 'POST',
    body: JSON.stringify({
      registerText: ' Privileged access review is incomplete and stale.\n\n',
      registerMeta: {
        extension: 'csv',
        sheets: [{ sheetName: 'Risk Register', rowCount: 1 }]
      },
      traceLabel: 'Step 2 register analysis'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token,
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' }
  };
  const firstRes = createRes();
  const secondRes = createRes();

  await handler(req, firstRes);
  const firstCallAiFetches = aiFetchCount;
  await handler(req, secondRes);

  assert.equal(firstCallAiFetches >= 1, true);
  assert.equal(aiFetchCount, firstCallAiFetches);
  assert.equal(firstRes.statusCode, 200);
  assert.equal(secondRes.statusCode, 200);
  assert.equal(firstRes.payload.mode, 'live');
  assert.equal(secondRes.payload.mode, 'live');
  assert.deepEqual(secondRes.payload.risks, firstRes.payload.risks);
});
