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

function loadFreshEvidenceMapRoute() {
  delete require.cache[require.resolve('../../api/ai/evidence-map')];
  delete require.cache[require.resolve('../../api/_evidenceMapWorkflow')];
  return require('../../api/ai/evidence-map');
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
    throw new Error(`Unexpected fetch in evidence map route test: ${url}`);
  };
}

function projectField(map, field) {
  return map.projectFinancialEvidenceMap.find(item => item.field === field);
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('evidence-map route marks claims unsupported when no citations are provided', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect the ERP go-live.',
    projectExposure: {
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }]
    }
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.ok(res.payload.evidenceMap.unsupportedClaims.length >= 1);
  assert.equal(projectField(res.payload.evidenceMap, 'delayCostPerDay').status, 'not_found');
});

test('evidence-map route flags contradiction between assumptions and contract evidence', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery defect may trigger customer penalties.',
    assumptions: ['No liquidated damages are applicable to this contract.'],
    citations: [{
      title: 'Customer MSA',
      excerpt: 'The agreement includes liquidated damages capped at USD 100,000 and termination rights for material delay.'
    }]
  }), res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.payload.evidenceMap.contradictions.length >= 1);
  assert.match(res.payload.evidenceMap.contradictions[0].recommendedAction, /Legal|Commercial/i);
});

test('evidence-map route treats title-only references as decorative', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'Privileged access misuse could disrupt production systems.',
    citations: [{ title: 'Access policy' }]
  }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.evidenceMap.citationQuality.decorative, ['Access policy']);
  assert.ok(res.payload.evidenceMap.unsupportedClaims.length >= 1);
});

test('evidence-map route finds buyer project financial values in evidence text', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay may affect the ERP go-live.',
    projectExposure: {
      missingInputs: [{ field: 'delayCostPerDay' }, { field: 'approvedBudget' }]
    },
    citations: [{
      title: 'ERP business case',
      excerpt: 'The approved budget is USD 1,200,000. The go-live milestone is 2026-09-30. Finance estimates the delay cost at USD 10,000 per day.'
    }]
  }), res);

  const map = res.payload.evidenceMap;
  assert.equal(res.statusCode, 200);
  assert.equal(projectField(map, 'approvedBudget').status, 'found');
  assert.match(projectField(map, 'approvedBudget').value, /USD 1,200,000/i);
  assert.equal(projectField(map, 'delayCostPerDay').status, 'found');
  assert.match(projectField(map, 'delayCostPerDay').value, /USD 10,000/i);
});

test('evidence-map route finds seller project financial values in evidence text', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery issue may erode margin and trigger customer remedies.',
    projectExposure: {
      missingInputs: [{ field: 'contractValue' }, { field: 'grossMarginPct' }, { field: 'liquidatedDamagesCap' }]
    },
    citations: [{
      title: 'Signed SOW',
      excerpt: 'The total contract value is USD 2,000,000 with expected gross margin of 25%. Liquidated damages cap is USD 100,000 and the liability cap is USD 500,000.'
    }]
  }), res);

  const map = res.payload.evidenceMap;
  assert.equal(res.statusCode, 200);
  assert.equal(projectField(map, 'contractValue').status, 'found');
  assert.match(projectField(map, 'contractValue').value, /USD 2,000,000/i);
  assert.equal(projectField(map, 'grossMarginPct').status, 'found');
  assert.match(projectField(map, 'grossMarginPct').value, /25%/);
  assert.equal(projectField(map, 'liquidatedDamagesCap').status, 'found');
});

test('evidence-map route keeps unknown financial values not found when evidence is unrelated', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'project_seller',
    scenario: 'Delivery issue may erode margin.',
    projectExposure: {
      missingInputs: [{ field: 'grossMarginPct' }]
    },
    citations: [{
      title: 'Project steering note',
      excerpt: 'The customer wants weekly status updates and a revised implementation plan.'
    }]
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(projectField(res.payload.evidenceMap, 'grossMarginPct').status, 'not_found');
  assert.equal(projectField(res.payload.evidenceMap, 'grossMarginPct').value, '');
});

test('evidence-map route rejects unexpected fields', async () => {
  setupEnv({ ai: false });
  setupKvFetch();
  const handler = loadFreshEvidenceMapRoute();
  const res = createRes();

  await handler(buildReq({
    assessmentType: 'enterprise_generic',
    scenario: 'Privileged access misuse could disrupt production systems.',
    writeToRagStorage: true
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Unexpected request fields');
  assert.deepEqual(res.payload.fields, ['writeToRagStorage']);
});
