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

function loadFreshProjectExposureRoute() {
  delete require.cache[require.resolve('../../api/ai/project-exposure-map')];
  delete require.cache[require.resolve('../../api/_projectExposureWorkflow')];
  return require('../../api/ai/project-exposure-map');
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
    throw new Error(`Unexpected fetch in project exposure route test: ${url}`);
  };
}

function driverById(exposure, id) {
  return exposure.financialDrivers.find(driver => driver.id === id);
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('project-exposure-map route returns buyer deterministic fallback when AI is unavailable', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    riskStatement: 'Implementation partner may miss the go-live date.',
    projectHorizon: { delayDurationDays: 10 },
    buyerEconomics: {
      delayCostPerDay: 1000,
      remainingSpend: 200000,
      reprocurementPremiumPct: 0.2
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' },
      remainingSpend: { status: 'known', confidence: 'high', source: 'user' },
      reprocurementPremiumPct: { status: 'known', confidence: 'medium', source: 'user' }
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(driverById(res.payload.projectExposure, 'buyer-delay-cost').likely, 10000);
  assert.equal(driverById(res.payload.projectExposure, 'buyer-reprocurement-premium').likely, 40000);
});

test('project-exposure-map route returns seller deterministic fallback when AI is unavailable', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    riskStatement: 'Delivery quality issue may trigger penalties on a customer implementation.',
    sellerEconomics: {
      expectedRevenue: 1000000,
      grossMarginPct: 0.25,
      liquidatedDamagesCap: 100000
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'document' },
      grossMarginPct: { status: 'known', confidence: 'high', source: 'document' },
      liquidatedDamagesCap: { status: 'known', confidence: 'high', source: 'document' }
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(driverById(res.payload.projectExposure, 'seller-margin-at-risk').likely, 250000);
  assert.equal(driverById(res.payload.projectExposure, 'seller-liquidated-damages').likely, 100000);
});

test('sparse buyer input creates unquantified drivers instead of zero values', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    riskStatement: 'Supplier may miss the implementation date.',
    projectHorizon: { delayDurationDays: 20 },
    buyerEconomics: {
      delayCostPerDay: null
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    },
    buyerProxyAnswers: {
      mainImpact: 'delay',
      likelyDelay: 'weeks',
      criticalPath: 'yes'
    }
  }), res);

  const delay = driverById(res.payload.projectExposure, 'buyer-delay-cost');
  assert.equal(delay.driverStatus, 'unquantified_driver');
  assert.equal(delay.likely, null);
  assert.ok(delay.missingInputs.includes('Delay cost per day'));
});

test('sparse seller input creates missing inputs for unknown margin', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    riskStatement: 'A delivery issue may erode margin on a fixed-price project.',
    sellerEconomics: {
      expectedRevenue: 500000,
      grossMarginPct: null
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'user' },
      grossMarginPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  }), res);

  const margin = driverById(res.payload.projectExposure, 'seller-margin-at-risk');
  assert.equal(margin.driverStatus, 'unquantified_driver');
  assert.equal(margin.likely, null);
  assert.ok(res.payload.projectExposure.missingInputs.some(input => input.field === 'grossMarginPct'));
});

test('invalid assessment type defaults safely to generic project exposure shape', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'procurement',
    riskStatement: 'General risk statement without project role.'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.deepEqual(res.payload.projectExposure.financialDrivers, []);
  assert.match(res.payload.projectExposure.projectExposureSummary, /not a buyer or seller project assessment/i);
});

test('malformed AI JSON falls back without losing deterministic exposure', async () => {
  setupEnv({ ai: true });
  setupKvFetch({ aiResponseText: '{not valid json' });
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    riskStatement: 'Implementation partner may miss go-live.',
    projectHorizon: { delayDurationDays: 5 },
    buyerEconomics: { delayCostPerDay: 200 },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' }
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(res.payload.fallbackReasonCode, 'invalid_ai_output');
  assert.equal(driverById(res.payload.projectExposure, 'buyer-delay-cost').likely, 1000);
});

test('unexpected request fields are rejected', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    riskStatement: 'Supplier delay.',
    departmentRoute: 'procurement'
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Unexpected request fields');
  assert.deepEqual(res.payload.fields, ['departmentRoute']);
});

test('explicit zero is preserved through the route fallback', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    riskStatement: 'Delay has no direct daily cost but still needs review.',
    projectHorizon: { delayDurationDays: 7 },
    buyerEconomics: { delayCostPerDay: 0 },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' }
    }
  }), res);

  const delay = driverById(res.payload.projectExposure, 'buyer-delay-cost');
  assert.equal(delay.driverStatus, 'calculated_driver');
  assert.equal(delay.likely, 0);
});

test('live AI response can label benchmark proxy drivers', async () => {
  setupEnv({ ai: true });
  const aiExposure = {
    valuationMode: 'hybrid',
    projectExposureSummary: 'Use a benchmark proxy because direct project economics are sparse.',
    projectInputQuality: {
      score: 20,
      label: 'Thin project economics',
      knownHighImpactInputs: [],
      estimatedHighImpactInputs: [],
      unknownHighImpactInputs: ['Delay cost per day'],
      canProceed: true,
      recommendedNextInput: {
        field: 'delayCostPerDay',
        why: 'It drives business interruption exposure.',
        whoMightKnow: 'Project finance',
        suggestedQuestion: 'What is the daily cost of delay?'
      }
    },
    financialDrivers: [
      {
        id: 'ai-delay-proxy',
        label: 'Benchmark delay proxy',
        driverType: 'delay',
        driverStatus: 'benchmark_proxy_driver',
        formula: 'benchmark proxy stress case',
        low: 10000,
        likely: 20000,
        high: 40000,
        mapsTo: ['businessInterruption'],
        confidence: 'low',
        source: 'benchmark',
        missingInputs: ['Delay cost per day'],
        rationale: 'Sparse input supports only a low-confidence proxy.'
      }
    ],
    capsAndOffsets: [],
    doubleCountingWarnings: ['Do not treat total project spend as automatic loss.'],
    missingInputs: [
      {
        field: 'delayCostPerDay',
        label: 'Delay cost per day',
        importance: 'high',
        whyItMatters: 'It drives the delay exposure.',
        whoMightKnow: 'Project finance',
        suggestedQuestion: 'What is the daily delay cost?',
        mapsTo: ['businessInterruption']
      }
    ],
    mapsToRiskParameters: {}
  };
  setupKvFetch({ aiResponseText: JSON.stringify(aiExposure) });
  const handler = loadFreshProjectExposureRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    riskStatement: 'Supplier delay with sparse economics.'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  const proxy = driverById(res.payload.projectExposure, 'ai-delay-proxy');
  assert.equal(proxy.driverStatus, 'benchmark_proxy_driver');
  assert.equal(proxy.confidence, 'low');
  assert.equal(proxy.source, 'benchmark');
  assert.equal(res.payload.projectExposure.mapsToRiskParameters.businessInterruption.likely, 20000);
});
