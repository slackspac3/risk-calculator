'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const originalEnv = {
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  COMPASS_API_URL: process.env.COMPASS_API_URL,
  COMPASS_MODEL: process.env.COMPASS_MODEL,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  RISK_RAG_EMBEDDINGS_API_KEY: process.env.RISK_RAG_EMBEDDINGS_API_KEY,
  RISK_RAG_QDRANT_API_KEY: process.env.RISK_RAG_QDRANT_API_KEY,
  RISK_RAG_QDRANT_COLLECTION: process.env.RISK_RAG_QDRANT_COLLECTION,
  RISK_RAG_QDRANT_URL: process.env.RISK_RAG_QDRANT_URL,
  RISK_RAG_SMOKE_STATUS_DIR: process.env.RISK_RAG_SMOKE_STATUS_DIR,
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
});

test('ai status reports deterministic fallback when the hosted proxy is not configured', async () => {
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
    throw new Error(`Unexpected fetch in fallback status test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/status');
  const token = buildSessionToken({
    username: 'admin',
    role: 'admin',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'GET',
    query: { probe: '1' },
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.providerReachable, false);
  assert.equal(res.payload.proxyConfigured, false);
});

test('ai status reports live mode when the hosted provider responds to the server-side probe', async () => {
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
    return {
      ok: true,
      status: 200,
      text: async () => '{"status":"ok"}'
    };
  };

  const handler = loadFresh('../../api/ai/status');
  const token = buildSessionToken({
    username: 'admin',
    role: 'admin',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'GET',
    query: { probe: '1' },
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.providerReachable, true);
  assert.equal(res.payload.proxyConfigured, true);
  assert.equal(res.payload.model, 'gpt-5.1');
});

test('ai status includes server-side evidence RAG operational health', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.RISK_RAG_QDRANT_URL = 'https://droplet.example/qdrant';
  process.env.RISK_RAG_QDRANT_API_KEY = 'qdrant-secret';
  process.env.RISK_RAG_QDRANT_COLLECTION = 'risk_status_test';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'risk-ai-status-rag-'));
  process.env.RISK_RAG_SMOKE_STATUS_DIR = tempDir;

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    if (String(url) === 'https://droplet.example/qdrant/collections/risk_status_test') {
      assert.equal(options.headers['api-key'], 'qdrant-secret');
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          result: {
            config: {
              params: {
                vectors: {
                  size: 3,
                  distance: 'Cosine'
                }
              }
            }
          }
        })
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => '{"status":"ok"}'
    };
  };

  const handler = loadFresh('../../api/ai/status');
  const token = buildSessionToken({
    username: 'admin',
    role: 'admin',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'GET',
    query: { probe: '1', ragProbe: '1' },
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.evidenceRag.configured, true);
  assert.equal(res.payload.evidenceRag.collection, 'risk_status_test');
  assert.equal(res.payload.evidenceRag.lastSmokeStatus.ok, true);
  assert.equal(res.payload.evidenceRag.lastSmokeStatus.vectorSize, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(res.payload.evidenceRag, 'qdrantApiKey'), false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
