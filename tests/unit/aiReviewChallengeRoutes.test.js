'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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

function buildRequest(body = {}) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': buildSessionToken({
        username: 'reviewer',
        role: 'user',
        exp: Date.now() + 60_000
      })
    },
    socket: { remoteAddress: '127.0.0.1' }
  };
}

function buildAiFetch(aiPayload) {
  return async (url) => {
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
}

test.beforeEach(() => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
});

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
});

test('reviewer-brief route returns deterministic fallback when hosted AI proxy is not configured', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in reviewer brief fallback test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/reviewer-brief');
  const res = createRes();
  await handler(buildRequest({
    assessmentData: 'Assessment data for quick review.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(res.payload.reviewerCoherence.mode, 'accepted');
  assert.equal(typeof res.payload.reviewerCoherence.confidenceScore, 'number');
  assert.match(String(res.payload.reviewerCoherence.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(res.payload.reviewerCoherence.confidenceDrivers));
  assert.equal(typeof res.payload.reviewerCoherence.calibrationMode, 'string');
  assert.match(String(res.payload.whatMatters || ''), /assessment|risk/i);
});

test('reviewer-brief route returns manual mode for incomplete assessment content before any upstream AI call', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in reviewer brief manual test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/reviewer-brief');
  const res = createRes();
  await handler(buildRequest({
    assessmentData: 'Too short.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(res.payload.reviewerCoherence.mode, 'manual');
  assert.equal(typeof res.payload.reviewerCoherence.confidenceScore, 'number');
  assert.equal(res.payload.reviewerCoherence.confidenceBand, 'low');
  assert.ok(Array.isArray(res.payload.reviewerCoherence.confidenceDrivers));
  assert.equal(typeof res.payload.reviewerCoherence.calibrationMode, 'string');
  assert.equal(String(res.payload.manualReasonCode || ''), 'incomplete_assessment_data');
});

test('reviewer-brief route orchestrates live reviewer brief generation server-side', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = buildAiFetch(JSON.stringify({
    whatMatters: 'The current risk remains above the board attention threshold.',
    whatsUncertain: 'Loss assumptions still depend on weak incident recovery evidence.',
    whatToDo: 'Challenge the recovery assumptions before approving the current view.'
  }));

  const handler = loadFresh('../../api/ai/reviewer-brief');
  const res = createRes();
  await handler(buildRequest({
    assessmentData: 'Assessment data for quick review.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.whatMatters, 'The current risk remains above the board attention threshold.');
  assert.equal(res.payload.reviewerCoherence.mode, 'accepted');
  assert.equal(String(res.payload.trace?.label || ''), 'Reviewer decision brief');
});

test('challenge-assessment route returns deterministic fallback for executive and review modes when hosted AI is unavailable', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in challenge assessment fallback test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/challenge-assessment');

  const executiveRes = createRes();
  await handler(buildRequest({
    narrative: 'Identity compromise through exposed global admin credentials.',
    results: { eventLoss: { p90: 9000000 }, ale: { mean: 3200000 } },
    fairParams: { controlStrLikely: 0.42, tefLikely: 5 },
    assessmentIntelligence: { assumptions: [{ text: 'Privileged access abuse would spread quickly.' }] },
    traceLabel: 'Assessment challenge'
  }), executiveRes);

  assert.equal(executiveRes.statusCode, 200);
  assert.equal(executiveRes.payload.mode, 'deterministic_fallback');
  assert.equal(executiveRes.payload.usedFallback, true);
  assert.equal(executiveRes.payload.aiUnavailable, true);
  assert.equal(executiveRes.payload.reviewerCoherence.mode, 'corrected');
  assert.match(String(executiveRes.payload.challengeSummary || ''), /committee should challenge/i);

  const reviewRes = createRes();
  await handler(buildRequest({
    scenarioTitle: 'Identity compromise',
    narrative: 'Identity compromise through exposed global admin credentials.',
    geography: 'UAE',
    businessUnitName: 'G42',
    confidence: { label: 'Low confidence', summary: 'Recovery evidence is weak.' },
    drivers: { upward: ['Privileged access remains exposed'], stabilisers: [] },
    assumptions: [{ category: 'Controls', text: 'Recovery controls operate consistently.' }],
    missingInformation: ['Current privileged access logs'],
    applicableRegulations: ['ISO 27001'],
    citations: [{ title: 'Privileged access policy' }],
    adminSettings: { geography: 'UAE' },
    traceLabel: 'Assessment challenge'
  }), reviewRes);

  assert.equal(reviewRes.statusCode, 200);
  assert.equal(reviewRes.payload.mode, 'deterministic_fallback');
  assert.equal(reviewRes.payload.usedFallback, true);
  assert.equal(reviewRes.payload.aiUnavailable, true);
  assert.equal(reviewRes.payload.reviewerCoherence.mode, 'corrected');
  assert.equal(String(reviewRes.payload.trace?.label || ''), 'Assessment challenge');
});

test('challenge-assessment route orchestrates live executive challenge generation server-side', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = buildAiFetch(JSON.stringify({
    challengeSummary: 'The assessment is directionally credible but relies too heavily on recovery timing assumptions.',
    weakestAssumption: 'Recovery timing is the weakest current assumption.',
    alternativeView: 'A slower recovery path would keep losses elevated for longer and likely move the bad-year view higher.',
    confidenceVerdict: 'Likely understated',
    oneQuestion: 'What current evidence proves recovery can happen within the stated window?'
  }));

  const handler = loadFresh('../../api/ai/challenge-assessment');
  const res = createRes();
  await handler(buildRequest({
    narrative: 'Identity compromise through exposed global admin credentials.',
    results: { eventLoss: { p90: 9000000 }, ale: { mean: 3200000 } },
    fairParams: { controlStrLikely: 0.42, tefLikely: 5 },
    assessmentIntelligence: { assumptions: [{ text: 'Privileged access abuse would spread quickly.' }] },
    obligationBasis: { direct: [{ title: 'Privileged access governance' }] },
    traceLabel: 'Assessment challenge'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.confidenceVerdict, 'Likely understated');
  assert.equal(res.payload.reviewerCoherence.mode, 'corrected');
  assert.equal(String(res.payload.trace?.label || ''), 'Assessment challenge');
});

test('parameter-challenge route returns deterministic fallback when hosted AI proxy is not configured', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in parameter challenge fallback test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/parameter-challenge');
  const res = createRes();
  await handler(buildRequest({
    parameterKey: 'controlStrLikely',
    parameterLabel: 'Control strength',
    currentValue: 0.62,
    currentValueLabel: '0.62',
    scenarioSummary: 'Identity compromise through exposed admin credentials.',
    reviewerConcern: 'This control strength looks too optimistic.',
    currentAle: '$3.2M mean ALE',
    allowedParams: ['controlStrLikely'],
    traceLabel: 'Parameter challenge record'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(res.payload.reviewerCoherence.mode, 'fallback_replaced');
  assert.equal(Array.isArray(res.payload.analystQuestions), true);
  assert.equal(String(res.payload.trace?.label || ''), 'Parameter challenge record');
});

test('parameter-challenge route returns manual mode for incomplete challenge input before any upstream AI call', async () => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in parameter challenge manual test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/parameter-challenge');
  const res = createRes();
  await handler(buildRequest({
    parameterKey: 'controlStrLikely',
    parameterLabel: 'Control strength',
    currentValue: 0.62,
    currentValueLabel: '0.62',
    scenarioSummary: '',
    reviewerConcern: '',
    currentAle: '',
    allowedParams: ['controlStrLikely'],
    traceLabel: 'Parameter challenge record'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, false);
  assert.equal(res.payload.reviewerCoherence.mode, 'manual');
  assert.equal(String(res.payload.manualReasonCode || ''), 'incomplete_parameter_challenge_input');
});

test('challenge-synthesis route returns deterministic fallback when hosted AI proxy is not configured', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in challenge synthesis fallback test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/challenge-synthesis');
  const res = createRes();
  await handler(buildRequest({
    scenarioTitle: 'Identity compromise',
    scenarioSummary: 'Identity compromise through exposed admin credentials.',
    baseAleRange: '$3.2M mean ALE · $9.0M bad year',
    records: [
      { parameter: 'Control strength', concern: 'Too optimistic', reviewerAdjustment: { param: 'controlStrLikely', suggestedValue: 0.54 } },
      { parameter: 'Loss magnitude', concern: 'Recovery cost understated', reviewerAdjustment: { param: 'lmHigh', suggestedValue: 2200000 } }
    ],
    traceLabel: 'Challenge synthesis'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(res.payload.reviewerCoherence.mode, 'corrected');
  assert.match(String(res.payload.overallConcern || ''), /reviewer/i);
  assert.equal(String(res.payload.trace?.label || ''), 'Challenge synthesis');
});

test('consensus-recommendation route returns deterministic fallback when hosted AI proxy is not configured', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in consensus fallback test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/consensus-recommendation');
  const res = createRes();
  await handler(buildRequest({
    scenarioTitle: 'Identity compromise',
    scenarioSummary: 'Identity compromise through exposed admin credentials.',
    originalAleRange: '$3.2M mean ALE',
    adjustedAleRange: '$4.1M mean ALE',
    projectedAleRange: '$3.7M mean ALE',
    aleChangePct: 12,
    originalParameters: { controlStrLikely: 0.62 },
    adjustedParameters: { controlStrLikely: 0.54 },
    challenges: [
      { ref: 'C1', parameter: 'Control strength', concern: 'Too optimistic', proposedValue: '0.54', impactPct: 8, aleImpact: 'ALE rises modestly.' },
      { ref: 'C2', parameter: 'Loss magnitude', concern: 'Recovery cost understated', proposedValue: '2.2M', impactPct: 22, aleImpact: 'ALE rises materially.' }
    ],
    traceLabel: 'Consensus recommendation'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(res.payload.reviewerCoherence.mode, 'fallback_replaced');
  assert.deepEqual(res.payload.acceptChallenges, ['C1']);
  assert.equal(String(res.payload.trace?.label || ''), 'Consensus recommendation');
});

test('review-mediation route returns manual guidance when hosted AI proxy is not configured and live mediation when configured', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/kv')) {
      return { ok: true, json: async () => ({ result: null }) };
    }
    throw new Error(`Unexpected fetch in review mediation fallback test: ${url}`);
  };

  let handler = loadFresh('../../api/ai/review-mediation');
  let res = createRes();
  await handler(buildRequest({
    narrative: 'Identity compromise through exposed admin credentials.',
    fairParams: { controlStrLikely: 0.62, tefLikely: 5 },
    results: { eventLoss: { p90: 9000000 }, ale: { mean: 3200000 } },
    assessmentIntelligence: { assumptions: [{ text: 'Recovery is fast.' }], drivers: { sensitivity: [{ label: 'Recovery timing', why: 'Drives the high end.' }] } },
    reviewerView: 'The recovery estimate is too optimistic.',
    analystView: 'Recent drills support the current timing.',
    disputedFocus: 'Recovery timing',
    scenarioLens: { label: 'Cyber' },
    citations: [{ title: 'Drill summary' }],
    traceLabel: 'Review mediation'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(res.payload.usedFallback, false);
  assert.equal(res.payload.aiUnavailable, true);
  assert.equal(res.payload.reviewerCoherence.mode, 'manual');
  assert.match(String(res.payload.proposedMiddleGround || ''), /manual mediation/i);

  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';
  global.fetch = buildAiFetch(JSON.stringify({
    reconciliationSummary: 'Both sides agree the identity-compromise scenario remains primary and recovery timing is the main source of uncertainty within that path.',
    proposedMiddleGround: 'Use a slower but still plausible recovery estimate for the accepted identity-compromise path until fresh evidence is reviewed.',
    whyReasonable: 'It reflects the reviewer concern without discarding the analyst evidence or changing the primary scenario family.',
    recommendedField: 'controlStrLikely',
    recommendedValue: 0.58,
    recommendedValueLabel: 'Moderately weaker control strength',
    evidenceToVerify: 'The latest recovery drill results',
    continueDiscussionPrompt: 'What evidence from the last drill most directly supports the faster recovery view?'
  }));

  handler = loadFresh('../../api/ai/review-mediation');
  res = createRes();
  await handler(buildRequest({
    narrative: 'Identity compromise through exposed admin credentials.',
    fairParams: { controlStrLikely: 0.62, tefLikely: 5 },
    results: { eventLoss: { p90: 9000000 }, ale: { mean: 3200000 } },
    assessmentIntelligence: { assumptions: [{ text: 'Recovery is fast.' }], drivers: { sensitivity: [{ label: 'Recovery timing', why: 'Drives the high end.' }] } },
    reviewerView: 'The recovery estimate is too optimistic.',
    analystView: 'Recent drills support the current timing.',
    disputedFocus: 'Recovery timing',
    scenarioLens: { label: 'Cyber' },
    citations: [{ title: 'Drill summary' }],
    traceLabel: 'Review mediation'
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.recommendedField, 'controlStrLikely');
  assert.equal(res.payload.reviewerCoherence.mode, 'corrected');
  assert.equal(String(res.payload.trace?.label || ''), 'Review mediation');
});
