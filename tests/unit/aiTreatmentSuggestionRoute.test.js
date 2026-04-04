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

test('treatment-suggestion route returns manual mode for incomplete baseline input before any upstream AI call', async () => {
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
    throw new Error(`Unexpected fetch in manual treatment-suggestion test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/treatment-suggestion');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      baselineAssessment: {
        scenarioTitle: 'Partial baseline'
      },
      improvementRequest: 'Fix'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, false);
  assert.deepEqual(res.payload.suggestedInputs, {});
  assert.equal(String(res.payload.manualReasonCode || ''), 'incomplete_treatment_input');
  assert.equal(res.payload.treatmentCoherence.mode, 'manual');
  assert.equal(typeof res.payload.treatmentCoherence.confidenceScore, 'number');
  assert.equal(res.payload.treatmentCoherence.confidenceBand, 'low');
  assert.ok(Array.isArray(res.payload.treatmentCoherence.confidenceDrivers));
  assert.equal(typeof res.payload.treatmentCoherence.calibrationMode, 'string');
  assert.equal(String(res.payload.trace?.label || ''), 'Step 3 treatment suggestion');
});

test('treatment-suggestion route returns deterministic server fallback when hosted AI proxy is not configured', async () => {
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
    throw new Error(`Unexpected fetch in fallback treatment-suggestion test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/treatment-suggestion');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      baselineAssessment: {
        scenarioTitle: 'Privileged access compromise',
        fairParams: {
          tefLikely: 4,
          controlStrLikely: 0.45,
          biLikely: 120000
        }
      },
      improvementRequest: 'Stronger MFA and faster containment for admin accounts.'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(String(res.payload.fallbackReasonTitle || ''), 'Deterministic fallback treatment suggestion loaded');
  assert.equal(res.payload.treatmentCoherence.mode, 'accepted');
  assert.equal(res.payload.treatmentCoherence.acceptedPrimaryFamilyKey, 'identity_compromise');
  assert.equal(typeof res.payload.treatmentCoherence.confidenceScore, 'number');
  assert.match(String(res.payload.treatmentCoherence.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(res.payload.treatmentCoherence.confidenceDrivers));
  assert.equal(typeof res.payload.treatmentCoherence.calibrationMode, 'string');
  assert.equal(typeof res.payload.suggestedInputs?.TEF?.likely, 'number');
  assert.equal(String(res.payload.trace?.label || ''), 'Step 3 treatment suggestion');
});

test('treatment-suggestion route orchestrates live generation server-side', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    summary: 'The future-state case improves identity control strength and lowers likely disruption costs.',
    changesSummary: 'Control strength rises for the privileged access layer, TEF falls slightly, and business interruption is reduced through faster containment.',
    workflowGuidance: [
      'Review the adjusted values and confirm the future-state controls are genuinely funded and planned.',
      'Rerun the scenario and compare whether tolerance position changes materially.'
    ],
    benchmarkBasis: 'Use realistic identity hardening and response improvements rather than best-case assumptions.',
    inputRationale: {
      tef: 'Frequency reduces slightly because stronger identity protection lowers successful event frequency.',
      vulnerability: 'Vulnerability improves because privileged access controls are stronger.',
      lossComponents: 'Loss values improve where faster containment lowers disruption.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 3, max: 5 },
      controlStrength: { min: 0.55, likely: 0.72, max: 0.88 },
      threatCapability: { min: 0.2, likely: 0.35, max: 0.6 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
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

  const handler = loadFresh('../../api/ai/treatment-suggestion');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      baselineAssessment: {
        scenarioTitle: 'Privileged access compromise',
        narrative: 'Privileged access abuse could disrupt critical services.',
        fairParams: {
          tefLikely: 4,
          controlStrLikely: 0.45,
          biLikely: 120000
        }
      },
      improvementRequest: 'Stronger MFA and faster containment for admin accounts.'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(res.payload.treatmentCoherence.mode, 'accepted');
  assert.equal(res.payload.treatmentCoherence.acceptedPrimaryFamilyKey, 'identity_compromise');
  assert.match(String(res.payload.summary || ''), /future-state case/i);
  assert.equal(typeof res.payload.suggestedInputs?.controlStrength?.likely, 'number');
  assert.equal(String(res.payload.trace?.label || ''), 'Step 3 treatment suggestion');
});

test('treatment-suggestion route does not reuse completed results when the normalized input changes', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  let aiFetchCount = 0;
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    aiFetchCount += 1;
    const aiPayload = JSON.stringify({
      summary: `Identity treatment response ${aiFetchCount} keeps the future-state case anchored to privileged access hardening.`,
      changesSummary: 'The future-state case improves privileged identity controls, lowers likely misuse success, and reduces disruption from the same access path.',
      workflowGuidance: ['Review the adjusted identity-control values before applying them.'],
      benchmarkBasis: 'Use realistic privileged-access and containment improvements.',
      inputRationale: {
        tef: 'Frequency reduces slightly because successful credential misuse becomes harder.',
        vulnerability: 'Vulnerability improves where privileged-access controls are stronger.',
        lossComponents: 'Disruption costs improve where the same identity-led event is contained faster.'
      },
      suggestedInputs: {
        TEF: { min: 1, likely: 3, max: 5 },
        controlStrength: { min: 0.55, likely: 0.72, max: 0.88 }
      }
    });
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

  const handler = loadFresh('../../api/ai/treatment-suggestion');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const baseBody = {
    baselineAssessment: {
      scenarioTitle: 'Privileged access compromise',
      narrative: 'Privileged access abuse could disrupt critical services.',
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.45,
        biLikely: 120000
      }
    },
    traceLabel: 'Step 3 treatment suggestion'
  };

  const firstRes = createRes();
  await handler({
    method: 'POST',
    body: JSON.stringify({
      ...baseBody,
      improvementRequest: 'Stronger MFA and faster containment for admin accounts.'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, firstRes);

  const secondRes = createRes();
  await handler({
    method: 'POST',
    body: JSON.stringify({
      ...baseBody,
      improvementRequest: 'Stronger MFA, faster containment, and tighter privileged access review.'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, secondRes);

  assert.equal(aiFetchCount, 2);
  assert.equal(firstRes.statusCode, 200);
  assert.equal(secondRes.statusCode, 200);
  assert.equal(firstRes.payload.mode, 'live');
  assert.equal(secondRes.payload.mode, 'live');
  assert.notEqual(String(firstRes.payload.summary || ''), String(secondRes.payload.summary || ''));
});
