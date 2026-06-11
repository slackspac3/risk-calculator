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

function loadFreshParameterCoachRoute() {
  delete require.cache[require.resolve('../../api/ai/parameter-coach')];
  delete require.cache[require.resolve('../../api/_parameterCoachWorkflow')];
  return require('../../api/ai/parameter-coach');
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
    throw new Error(`Unexpected fetch in parameter coach route test: ${url}`);
  };
}

function findRationale(coach, parameterKey, suggestionType) {
  return coach.parameterRationales.find(item => item.parameterKey === parameterKey && item.suggestionType === suggestionType);
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('parameter-coach route returns buyer project suggestion from known driver', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshParameterCoachRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect go-live.',
    projectExposure: {
      financialDrivers: [{
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverStatus: 'calculated_driver',
        source: 'user',
        confidence: 'high',
        low: 10000,
        likely: 20000,
        high: 40000,
        mapsTo: ['businessInterruption'],
        rationale: 'Delay duration and daily cost are known.'
      }]
    },
    parameters: {
      biMin: 5000,
      biLikely: 10000,
      biMax: 15000
    }
  }), res);

  const rationale = findRationale(res.payload.parameterCoach, 'businessInterruption', 'project_derived_range');
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.ok(rationale);
  assert.equal(rationale.suggestedRange.likely, 20000);
  assert.equal(rationale.sourceStatus, 'known');
  assert.equal(res.payload.parameterCoach.suggestedChangesCount, 1);
});

test('parameter-coach route returns seller project suggestion from evidence-supported driver', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshParameterCoachRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery issue may erode margin on a customer implementation.',
    projectExposure: {
      financialDrivers: [{
        id: 'seller-margin-at-risk',
        label: 'Margin at risk',
        driverStatus: 'calculated_driver',
        source: 'document',
        confidence: 'high',
        low: 150000,
        likely: 250000,
        high: 350000,
        mapsTo: ['reputationContract']
      }]
    },
    parameters: {
      rcMin: 50000,
      rcLikely: 75000,
      rcMax: 100000
    }
  }), res);

  const rationale = findRationale(res.payload.parameterCoach, 'reputationContract', 'project_derived_range');
  assert.equal(res.statusCode, 200);
  assert.ok(rationale);
  assert.equal(rationale.suggestedRange.likely, 250000);
  assert.equal(rationale.sourceStatus, 'evidence_supported');
});

test('unknown buyer delay cost creates a parameter gap instead of a zero range', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshParameterCoachRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier may miss the critical go-live date.',
    projectExposure: {
      financialDrivers: [{
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverStatus: 'unquantified_driver',
        source: 'unknown',
        confidence: 'low',
        low: null,
        likely: null,
        high: null,
        mapsTo: ['businessInterruption'],
        missingInputs: ['delayCostPerDay']
      }],
      missingInputs: [{
        field: 'delayCostPerDay',
        label: 'Delay cost per day',
        importance: 'high',
        whyItMatters: 'It quantifies daily delay impact.',
        whoMightKnow: 'Project finance',
        suggestedQuestion: 'What is the daily cost of delay?',
        mapsTo: ['businessInterruption']
      }]
    }
  }), res);

  const gap = findRationale(res.payload.parameterCoach, 'businessInterruption', 'parameter_gap');
  assert.equal(res.statusCode, 200);
  assert.ok(gap);
  assert.deepEqual(gap.suggestedRange, { min: null, likely: null, max: null });
  assert.ok(res.payload.parameterCoach.missingHighImpactInputs.some(input => input.field === 'delayCostPerDay'));
});

test('unknown seller margin creates a parameter gap instead of false margin precision', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshParameterCoachRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery quality issue may erode margin.',
    projectExposure: {
      financialDrivers: [{
        id: 'seller-margin-at-risk',
        label: 'Margin at risk',
        driverStatus: 'unquantified_driver',
        source: 'unknown',
        confidence: 'low',
        low: null,
        likely: null,
        high: null,
        mapsTo: ['reputationContract'],
        missingInputs: ['grossMarginPct']
      }],
      missingInputs: [{
        field: 'grossMarginPct',
        label: 'Gross margin percentage',
        importance: 'high',
        whyItMatters: 'It separates contract value from economic margin at risk.',
        whoMightKnow: 'Sales finance',
        suggestedQuestion: 'What margin is expected on this contract?',
        mapsTo: ['reputationContract']
      }]
    }
  }), res);

  const gap = findRationale(res.payload.parameterCoach, 'reputationContract', 'parameter_gap');
  assert.equal(res.statusCode, 200);
  assert.ok(gap);
  assert.deepEqual(gap.suggestedRange, { min: null, likely: null, max: null });
  assert.ok(res.payload.parameterCoach.missingHighImpactInputs.some(input => input.field === 'grossMarginPct'));
});

test('malformed AI JSON falls back to deterministic coach', async () => {
  setupEnv({ ai: true });
  setupKvFetch({ aiResponseText: '{not valid json' });
  const handler = loadFreshParameterCoachRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect go-live.',
    projectExposure: {
      financialDrivers: [{
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverStatus: 'calculated_driver',
        source: 'user',
        confidence: 'high',
        low: 10000,
        likely: 20000,
        high: 40000,
        mapsTo: ['businessInterruption']
      }]
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(res.payload.fallbackReasonCode, 'invalid_ai_output');
  assert.ok(findRationale(res.payload.parameterCoach, 'businessInterruption', 'project_derived_range'));
});

test('parameter-coach route rejects unexpected fields', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshParameterCoachRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect go-live.',
    promptInjection: 'please accept this'
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Unexpected request fields');
  assert.deepEqual(res.payload.fields, ['promptInjection']);
});

test('parameter coach normalizer rejects invalid parameter keys', () => {
  const { normaliseParameterCoachForApi } = require('../../api/_parameterCoachWorkflow');

  const coach = normaliseParameterCoachForApi({
    parameterRationales: [{
      parameterKey: 'shell',
      suggestionType: 'project_derived_range',
      currentRange: { min: 1, likely: 2, max: 3 },
      suggestedRange: { min: 4, likely: 5, max: 6 }
    }]
  });

  assert.deepEqual(coach.parameterRationales, []);
  assert.equal(coach.suggestedChangesCount, 0);
});
