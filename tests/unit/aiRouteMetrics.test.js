'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { getAiRouteMetricsSnapshot, resetAiRouteMetrics } = require('../../api/_aiRouteMetrics');
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

function buildRequest(body = {}, username = 'analyst') {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': buildSessionToken({
        username,
        role: 'user',
        exp: Date.now() + 60_000
      }),
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

test.beforeEach(() => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  resetAiRouteMetrics();
  resetWorkflowReuseState();
});

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetAiRouteMetrics();
  resetWorkflowReuseState();
});

test('scenario-draft route metrics count manual-mode invocations without logging payload content', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error(`Unexpected fetch in manual metrics test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const res = createRes();
  await handler(buildRequest({
    riskStatement: 'Outage'
  }), res);

  assert.equal(res.statusCode, 200);
  const metrics = getAiRouteMetricsSnapshot('scenario-draft');
  assert.equal(metrics.invocationCount, 1);
  assert.equal(metrics.manualCount, 1);
  assert.equal(metrics.deterministicFallbackCount, 0);
  assert.equal(metrics.timeoutCount, 0);
  assert.equal(metrics.cacheHitCount, 0);
  assert.equal(metrics.duplicateSuppressionCount, 0);
  assert.equal(typeof metrics.averageLatencyMs, 'number');
});

test('register-analysis route metrics count cache hits for repeated identical input', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    summary: 'Register shortlist',
    linkAnalysis: 'Directly extracted from the uploaded rows.',
    workflowGuidance: ['Keep only distinct material rows.'],
    benchmarkBasis: 'Prefer comparable enterprise controls.',
    risks: [
      {
        title: 'Privileged access review weakness',
        category: 'Identity & Access',
        description: 'The register shows stale privileged access review activity.',
        confidence: 'high',
        regulations: []
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
        choices: [{ message: { content: aiPayload } }]
      }),
      text: async () => aiPayload
    };
  };

  const handler = loadFresh('../../api/ai/register-analysis');
  const req = buildRequest({
    registerText: 'Privileged access review is incomplete and stale.'
  });
  await handler(req, createRes());
  const firstRequestFetchCount = aiFetchCount;
  await handler(req, createRes());

  assert.equal(firstRequestFetchCount >= 1, true);
  assert.equal(aiFetchCount, firstRequestFetchCount);
  const metrics = getAiRouteMetricsSnapshot('register-analysis');
  assert.equal(metrics.invocationCount, 2);
  assert.equal(metrics.cacheHitCount, 1);
  assert.equal(metrics.duplicateSuppressionCount, 0);
});

test('scenario-draft route metrics count duplicate suppression for identical in-flight requests', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    draftNarrative: 'Scenario narrative',
    summary: 'Short summary',
    linkAnalysis: 'Link analysis',
    workflowGuidance: ['Keep the scenario chain tight.'],
    benchmarkBasis: 'Use peer comparators.',
    scenarioLens: {
      key: 'identity',
      label: 'Cyber',
      functionKey: 'technology',
      estimatePresetKey: 'identity',
      secondaryKeys: []
    },
    structuredScenario: {
      assetService: 'Identity stack',
      primaryDriver: 'Credential theft',
      eventPath: 'Privilege abuse',
      effect: 'Disruption'
    },
    risks: [
      {
        title: 'Privileged account takeover',
        category: 'Identity & Access',
        description: 'Exposed credentials enable tenant misuse.',
        confidence: 'high',
        regulations: []
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
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: aiPayload } }]
      }),
      text: async () => aiPayload
    };
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const req = buildRequest({
    riskStatement: 'Azure global admin credentials found on the dark web.'
  });
  await Promise.all([
    handler(req, createRes()),
    handler(req, createRes())
  ]);

  assert.equal(aiFetchCount >= 1, true);
  const metrics = getAiRouteMetricsSnapshot('scenario-draft');
  assert.equal(metrics.invocationCount, 2);
  assert.equal(metrics.duplicateSuppressionCount, 1);
});

test('treatment-suggestion route metrics count timeout-driven deterministic fallback', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    throw new Error('AI assist timed out while contacting the hosted provider.');
  };

  const handler = loadFresh('../../api/ai/treatment-suggestion');
  const res = createRes();
  await handler(buildRequest({
    baselineAssessment: {
      scenarioTitle: 'Privileged access compromise',
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.45,
        biLikely: 120000
      }
    },
    improvementRequest: 'Stronger MFA and faster containment for admin accounts.'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  const metrics = getAiRouteMetricsSnapshot('treatment-suggestion');
  assert.equal(metrics.invocationCount, 1);
  assert.equal(metrics.deterministicFallbackCount, 1);
  assert.equal(metrics.timeoutCount, 1);
});

test('reviewer-brief route metrics are captured for reviewer workflows too', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in reviewer metrics test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/reviewer-brief');
  const res = createRes();
  await handler(buildRequest({
    assessmentData: 'Too short.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  }, 'reviewer'), res);

  assert.equal(res.statusCode, 200);
  const metrics = getAiRouteMetricsSnapshot('reviewer-brief');
  assert.equal(metrics.invocationCount, 1);
  assert.equal(metrics.manualCount, 1);
});
