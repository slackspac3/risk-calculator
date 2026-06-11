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

function loadFreshDecisionBriefRoute() {
  delete require.cache[require.resolve('../../api/ai/decision-brief')];
  delete require.cache[require.resolve('../../api/_decisionBriefWorkflow')];
  return require('../../api/ai/decision-brief');
}

function setupEnv({ ai = false } = {}) {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  if (ai) {
    process.env.COMPASS_API_URL = 'https://example.test/ai';
    process.env.COMPASS_API_KEY = 'proxy-secret';
    process.env.COMPASS_MODEL = 'gpt-5.1';
  } else {
    delete process.env.COMPASS_API_URL;
    delete process.env.COMPASS_API_KEY;
    delete process.env.COMPASS_MODEL;
  }
}

function buildReq(body) {
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function setupKvFetch({ aiResponseText = null } = {}) {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    if (String(url).includes('/ai')) {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: aiResponseText == null ? '{}' : aiResponseText
              }
            }
          ]
        })
      };
    }
    throw new Error(`Unexpected fetch in decision brief route test: ${url}`);
  };
}

function simulationResult(overrides = {}) {
  return {
    eventLoss: { p90: 300000 },
    annualLoss: { mean: 90000, p90: 240000 },
    threshold: 1000000,
    annualReviewThreshold: 3000000,
    toleranceBreached: false,
    nearTolerance: false,
    annualReviewTriggered: false,
    ...overrides
  };
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('decision-brief route returns generic deterministic fallback', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionBriefRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'Privileged access misuse could disrupt production.',
    simulationResult: simulationResult(),
    parameters: { biLikely: 100000, rlLikely: 50000 }
  }), res);

  const brief = res.payload.decisionBrief;
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(brief.decisionPosture, 'proceed');
  assert.match(brief.why, /enterprise risk decision support/i);
  assert.equal(brief.quantSummary.eventLossP90, 300000);
});

test('buyer brief fallback is honest about sparse economics', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionBriefRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect go-live.',
    simulationResult: simulationResult({
      projectHorizon: {
        enabled: true,
        loss: { mean: 80000, p90: 180000 },
        lossAsPctOfProjectValue: { p90: 0.09 }
      }
    }),
    projectExposure: {
      projectInputQuality: { label: 'Thin project economics' },
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day', importance: 'high' }]
    },
    decisionChallenge: {
      sensitivityFlags: [{ driver: 'Delay cost per day', sourceStatus: 'unknown', whySensitive: 'Delay cost can change the result.' }]
    }
  }), res);

  const brief = res.payload.decisionBrief;
  assert.equal(res.statusCode, 200);
  assert.match(brief.sparseDataWarning, /Project economics are thin/i);
  assert.ok(brief.projectQuantSummary.unknownHighImpactInputs.includes('Delay cost per day'));
  assert.match(brief.projectQuantSummary.plainEnglish, /could change the recommendation/i);
  assert.equal(brief.projectQuantSummary.projectHorizonLossP90, 180000);
});

test('seller brief fallback is honest about sparse margin economics', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionBriefRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery issue may erode implementation margin.',
    simulationResult: simulationResult(),
    projectExposure: {
      projectInputQuality: { label: 'Thin project economics' },
      missingInputs: [{ field: 'grossMarginPct', label: 'Gross margin percentage', importance: 'high' }]
    }
  }), res);

  const brief = res.payload.decisionBrief;
  assert.equal(res.statusCode, 200);
  assert.match(brief.why, /Seller-side project exposure/i);
  assert.ok(brief.projectQuantSummary.unknownHighImpactInputs.includes('Gross margin percentage'));
  assert.equal(brief.confidence, 'low');
});

test('decision brief lists proxy values without treating them as confirmed', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionBriefRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect go-live.',
    simulationResult: simulationResult(),
    projectExposure: {
      financialDrivers: [{
        id: 'delay',
        label: 'Delay cost',
        driverType: 'delay',
        driverStatus: 'benchmark_proxy_driver',
        low: 25000,
        likely: 75000,
        high: 150000,
        confidence: 'low',
        source: 'benchmark'
      }]
    }
  }), res);

  const brief = res.payload.decisionBrief;
  assert.equal(res.statusCode, 200);
  assert.equal(brief.projectQuantSummary.proxyValuesUsed.length, 1);
  assert.match(brief.projectQuantSummary.plainEnglish, /benchmark-proxy/i);
  assert.equal(brief.mainDrivers[0].sourceStatus, 'benchmark_proxy');
});

test('decision-brief route rejects unexpected fields', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionBriefRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'Test',
    writeToRagStorage: true
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Unexpected request fields');
  assert.deepEqual(res.payload.fields, ['writeToRagStorage']);
});
