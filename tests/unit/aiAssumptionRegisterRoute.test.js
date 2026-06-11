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

function loadFreshAssumptionRegisterRoute() {
  delete require.cache[require.resolve('../../api/ai/assumption-register')];
  delete require.cache[require.resolve('../../api/_assumptionRegisterWorkflow')];
  return require('../../api/ai/assumption-register');
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
    throw new Error(`Unexpected fetch in assumption register route test: ${url}`);
  };
}

function findAssumption(register, matcher) {
  return register.assumptions.find(matcher);
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('assumption-register route returns generic deterministic fallback when AI is unavailable', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'A critical SaaS platform outage disrupts customer onboarding for a business unit.'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.ok(findAssumption(res.payload.assumptionRegister, assumption => assumption.id === 'scenario_scope_assumption'));
  assert.ok(res.payload.assumptionRegister.missingEvidence.some(item => item.item === 'Scenario evidence'));
  assert.ok(res.payload.assumptionRegister.nextBestQuestions.some(item => /evidence/i.test(item.question)));
});

test('buyer project fallback turns sparse project economics into assumptions', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Implementation partner may miss the go-live date.',
    projectContext: {
      projectName: 'ERP implementation',
      projectRole: 'buyer'
    },
    buyerEconomics: {
      delayCostPerDay: null
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  }), res);

  const register = res.payload.assumptionRegister;
  const delayAssumption = findAssumption(register, assumption => assumption.projectExposureRefs.includes('delayCostPerDay'));
  assert.equal(res.statusCode, 200);
  assert.ok(delayAssumption);
  assert.equal(delayAssumption.type, 'delay');
  assert.equal(delayAssumption.sourceStatus, 'unknown');
  assert.match(delayAssumption.statement, /not as zero/i);
  assert.ok(register.missingEvidence.some(item => /delay cost per day/i.test(item.item)));
  assert.ok(register.nextBestQuestions.length >= 1);
  assert.ok(register.nextBestQuestions.length <= 3);
});

test('seller project fallback turns sparse margin economics into assumptions', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'A delivery quality issue may erode margin on a fixed-price customer implementation.',
    projectContext: {
      projectName: 'Customer implementation',
      projectRole: 'seller'
    },
    sellerEconomics: {
      expectedRevenue: 500000,
      grossMarginPct: null
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'user' },
      grossMarginPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  }), res);

  const register = res.payload.assumptionRegister;
  const marginAssumption = findAssumption(register, assumption => assumption.projectExposureRefs.includes('grossMarginPct'));
  assert.equal(res.statusCode, 200);
  assert.ok(marginAssumption);
  assert.equal(marginAssumption.type, 'margin');
  assert.equal(marginAssumption.sourceStatus, 'unknown');
  assert.ok(register.missingEvidence.some(item => /gross margin percentage/i.test(item.item)));
});

test('missing project economics produce one to three ranked next-best questions', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier failure could delay a strategic platform migration.',
    projectContext: {
      projectName: 'Platform migration',
      projectRole: 'buyer'
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.payload.assumptionRegister.nextBestQuestions.length >= 1);
  assert.ok(res.payload.assumptionRegister.nextBestQuestions.length <= 3);
  assert.equal(typeof res.payload.assumptionRegister.nextBestQuestions[0].question, 'string');
  assert.ok(res.payload.assumptionRegister.nextBestQuestions[0].fieldTarget);
});

test('unknown delay cost becomes an explicit project assumption', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Critical-path supplier delay could affect go-live.',
    projectExposure: {
      missingInputs: [
        {
          field: 'delayCostPerDay',
          label: 'Delay cost per day',
          importance: 'high',
          whyItMatters: 'It quantifies delay impact.',
          whoMightKnow: 'Project finance',
          suggestedQuestion: 'What is the daily cost of delay?',
          mapsTo: ['businessInterruption']
        }
      ]
    }
  }), res);

  const delayAssumption = findAssumption(res.payload.assumptionRegister, assumption => assumption.projectExposureRefs.includes('delayCostPerDay'));
  assert.ok(delayAssumption);
  assert.equal(delayAssumption.type, 'delay');
  assert.equal(delayAssumption.sourceStatus, 'unknown');
  assert.match(delayAssumption.challengeQuestion, /daily cost of delay/i);
});

test('unknown margin becomes an explicit seller assumption', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery issue could reduce deal profitability.',
    projectExposure: {
      missingInputs: [
        {
          field: 'grossMarginPct',
          label: 'Gross margin percentage',
          importance: 'high',
          whyItMatters: 'It determines margin at risk.',
          whoMightKnow: 'Finance business partner',
          suggestedQuestion: 'What is the expected gross margin?',
          mapsTo: ['reputationContract']
        }
      ]
    }
  }), res);

  const marginAssumption = findAssumption(res.payload.assumptionRegister, assumption => assumption.projectExposureRefs.includes('grossMarginPct'));
  assert.ok(marginAssumption);
  assert.equal(marginAssumption.type, 'margin');
  assert.equal(marginAssumption.sourceStatus, 'unknown');
  assert.match(marginAssumption.challengeQuestion, /gross margin/i);
});

test('malformed AI JSON falls back to the deterministic assumption register', async () => {
  setupEnv({ ai: true });
  setupKvFetch({ aiResponseText: '{not valid json' });
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier may miss go-live.',
    buyerEconomics: { delayCostPerDay: null },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(res.payload.fallbackReasonCode, 'invalid_ai_output');
  assert.ok(findAssumption(res.payload.assumptionRegister, assumption => assumption.projectExposureRefs.includes('delayCostPerDay')));
});

test('assumption-register route rejects unexpected fields', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshAssumptionRegisterRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'Generic risk.',
    departmentRoute: 'finance'
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Unexpected request fields');
  assert.deepEqual(res.payload.fields, ['departmentRoute']);
});
