'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { resetWorkflowReuseState } = require('../../api/_workflowReuse');
const {
  normaliseDecisionChallengeForApi,
  normaliseParameterPatch
} = require('../../api/_decisionChallengeWorkflow');

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

function loadFreshDecisionChallengeRoute() {
  delete require.cache[require.resolve('../../api/ai/decision-challenge')];
  delete require.cache[require.resolve('../../api/_decisionChallengeWorkflow')];
  return require('../../api/ai/decision-challenge');
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
    throw new Error(`Unexpected fetch in decision challenge route test: ${url}`);
  };
}

function baseParams() {
  return {
    iterations: 1000,
    tefMin: 0.2,
    tefLikely: 1,
    tefMax: 2,
    threatCapMin: 0.2,
    threatCapLikely: 0.5,
    threatCapMax: 0.8,
    controlStrMin: 0.2,
    controlStrLikely: 0.5,
    controlStrMax: 0.8,
    irMin: 10000,
    irLikely: 25000,
    irMax: 60000,
    biMin: 50000,
    biLikely: 120000,
    biMax: 300000,
    dbMin: 10000,
    dbLikely: 25000,
    dbMax: 50000,
    rlMin: 20000,
    rlLikely: 75000,
    rlMax: 200000,
    tpMin: 30000,
    tpLikely: 100000,
    tpMax: 240000,
    rcMin: 25000,
    rcLikely: 90000,
    rcMax: 180000,
    threshold: 1000000
  };
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('decision-challenge route returns generic near-threshold fallback', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionChallengeRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'Privileged access misuse could disrupt production.',
    parameters: baseParams(),
    simulationResult: {
      annualLoss: { mean: 700000, p90: 950000 },
      threshold: 1000000
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.ok(res.payload.decisionChallenge.decisionRisks.some(item => /tolerance/i.test(item.title)));
  assert.ok(res.payload.decisionChallenge.recommendedStressTests.some(item => item.parameterPatch.tefLikely));
});

test('buyer unknown delay cost creates sensitivity flag and stress case', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionChallengeRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may miss go-live.',
    parameters: baseParams(),
    simulationResult: { annualLoss: { mean: 250000, p90: 450000 }, threshold: 1000000 },
    projectExposure: {
      missingInputs: [{
        field: 'delayCostPerDay',
        label: 'Delay cost per day',
        importance: 'high',
        whyItMatters: 'Delay cost can change business interruption exposure.',
        mapsTo: 'businessInterruption'
      }]
    }
  }), res);

  const challenge = res.payload.decisionChallenge;
  assert.equal(res.statusCode, 200);
  assert.ok(challenge.sensitivityFlags.some(item => item.driver === 'Delay cost per day' && item.sourceStatus === 'unknown'));
  assert.ok(challenge.recommendedStressTests.some(item => item.testsUnknownField === 'delayCostPerDay'));
  assert.ok(challenge.recommendedStressTests.every(item => item.parameterPatch.biLikely !== 0));
});

test('seller unknown margin creates margin stress case', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionChallengeRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery issue may erode customer implementation margin.',
    parameters: baseParams(),
    simulationResult: { annualLoss: { mean: 300000, p90: 600000 }, threshold: 2000000 },
    projectExposure: {
      missingInputs: [{
        field: 'grossMarginPct',
        label: 'Gross margin percentage',
        importance: 'high',
        whyItMatters: 'Margin at risk cannot be quantified until margin is known.',
        mapsTo: 'reputationContract'
      }]
    }
  }), res);

  const stress = res.payload.decisionChallenge.recommendedStressTests.find(item => item.testsUnknownField === 'grossMarginPct');
  assert.equal(res.statusCode, 200);
  assert.ok(stress);
  assert.ok(stress.parameterPatch.rcLikely > baseParams().rcLikely);
});

test('invalid parameter patch keys are rejected', () => {
  const patch = normaliseParameterPatch({
    biLikely: 200000,
    eval: 'bad',
    writeToRagStorage: true,
    madeUpParameter: 123,
    distType: 'invalid'
  });
  assert.deepEqual(patch, { biLikely: 200000 });

  const challenge = normaliseDecisionChallengeForApi({
    recommendedStressTests: [{
      id: 'bad_patch',
      title: 'Bad patch',
      parameterPatch: {
        madeUpParameter: 1
      }
    }, {
      id: 'good_patch',
      title: 'Good patch',
      parameterPatch: {
        biLikely: 150000
      }
    }]
  });
  assert.equal(challenge.recommendedStressTests.length, 1);
  assert.equal(challenge.recommendedStressTests[0].id, 'good_patch');
});

test('baseline parameter object is preserved while building fallback', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionChallengeRoute();
  const res = createRes();
  const params = baseParams();
  const before = JSON.stringify(params);

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may miss go-live.',
    parameters: params,
    simulationResult: { annualLoss: { mean: 250000, p90: 450000 }, threshold: 1000000 },
    projectExposure: {
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day', importance: 'high' }]
    }
  }), res);

  assert.equal(JSON.stringify(params), before);
  assert.equal(res.statusCode, 200);
});

test('unknown recovery is carried as uncertainty, not zero', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionChallengeRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier failure may trigger replacement and recovery uncertainty.',
    parameters: baseParams(),
    simulationResult: { annualLoss: { mean: 200000, p90: 400000 }, threshold: 1500000 },
    projectExposure: {
      missingInputs: [{
        field: 'supplierCredits',
        label: 'Supplier credits',
        importance: 'high',
        whyItMatters: 'Recoveries may reduce loss but are not confirmed.',
        mapsTo: 'thirdParty'
      }]
    }
  }), res);

  const challenge = res.payload.decisionChallenge;
  assert.ok(challenge.sensitivityFlags.some(item => /Supplier credits/i.test(item.driver) && item.sourceStatus === 'unknown'));
  assert.ok(challenge.recommendedStressTests.some(item => /recovery/i.test(item.title)));
  assert.ok(challenge.challengeSummary.includes('baseline'));
});

test('unexpected fields are rejected', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshDecisionChallengeRoute();
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
