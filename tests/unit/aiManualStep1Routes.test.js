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

function buildLlmResponse(payload) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify(payload)
          }
        }
      ]
    })
  };
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  resetWorkflowReuseState();
});

test('manual-draft-refinement route lets explicit identity-led text beat a stale financial hint', async () => {
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
    throw new Error(`Unexpected fetch in manual-draft-refinement test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-draft-refinement');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.',
      scenarioLensHint: { key: 'financial', label: 'Financial', functionKey: 'finance' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.functionKey, 'technology');
  assert.notEqual(res.payload.scenarioLens?.key, 'financial');
  assert.match(String(res.payload.draftNarrative || ''), /credential|tenant|configuration|access/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /capital exposure|receivables/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /identity|credential|account|tenant/i);
  assert.doesNotMatch(titles, /financial|fraud|capital/i);
});

test('manual-draft-refinement route uses dedicated refinement orchestration and keeps identity-led wording close to the typed event path in live mode', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.4';
  const providerBodies = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    if (String(url) === 'https://example.test/ai') {
      providerBodies.push(JSON.parse(options.body));
      return buildLlmResponse({
        draftNarrative: 'Azure global admin credentials discovered on the dark web are used to gain privileged tenant access and modify critical settings.',
        summary: 'The draft remains centred on privileged identity takeover and downstream control disruption.',
        linkAnalysis: 'The main chain is credential theft, privileged tenant access, and unauthorised control change.',
        workflowGuidance: [
          'Keep the event path focused on identity compromise.',
          'Challenge any downstream consequence that tries to become the main scenario family.'
        ],
        benchmarkBasis: 'Stay close to the typed identity-compromise wording.',
        scenarioLens: {
          key: 'cyber',
          label: 'Cyber',
          functionKey: 'technology',
          estimatePresetKey: 'technology'
        },
        structuredScenario: {
          assetService: 'Azure tenant administrative controls',
          primaryDriver: 'Leaked global admin credentials',
          eventPath: 'Credential misuse enabling privileged tenant access and control change',
          effect: 'Unauthorized configuration change and broader control disruption'
        },
        risks: [
          {
            title: 'Privileged tenant takeover through leaked administrator credentials',
            category: 'Identity & Access',
            description: 'Leaked global admin credentials can enable privileged tenant access, control change, and wider disruption.',
            confidence: 'high'
          },
          {
            title: 'Unauthorized tenant configuration change after privileged access abuse',
            category: 'Cyber',
            description: 'An attacker with tenant administrator access can modify critical settings and weaken recovery or detection.',
            confidence: 'medium'
          }
        ]
      });
    }
    throw new Error(`Unexpected fetch in manual-draft-refinement live test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-draft-refinement');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials discovered on the dark web and used to modify critical tenant settings.',
      scenarioLensHint: { key: 'financial', label: 'Financial', functionKey: 'finance' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(res.payload.scenarioLens?.functionKey, 'technology');
  assert.match(String(res.payload.draftNarrative || ''), /azure|admin|tenant|credential|settings/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /receivables|capital exposure|supplier delay/i);
  assert.equal(String(res.payload.aiAlignment?.taxonomy?.primaryFamilyKey || ''), 'identity_compromise');
  assert.equal(providerBodies.length, 1);
  const systemPrompt = String(providerBodies[0]?.messages?.[0]?.content || '');
  const userPrompt = String(providerBodies[0]?.messages?.[1]?.content || '');
  assert.match(systemPrompt, /refining a user-authored step 1 scenario draft/i);
  assert.doesNotMatch(systemPrompt, /building a step 1 guided scenario draft/i);
  assert.match(userPrompt, /Current user-authored narrative:/);
});

test('manual-draft-refinement route keeps supplier slippage refinement in the delivery lane in live mode', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.4';
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    if (String(url) === 'https://example.test/ai') {
      return buildLlmResponse({
        draftNarrative: 'A key supplier misses committed delivery dates, delaying infrastructure deployment and dependent programme milestones.',
        summary: 'The draft stays in a delivery-slippage lane centred on supplier dependency and delayed deployment.',
        linkAnalysis: 'The main chain is supplier delay, delayed deployment, and downstream milestone pressure.',
        workflowGuidance: [
          'Keep the draft grounded in delivery delay rather than cyber compromise.',
          'Challenge any risk card that does not share the same dependency path.'
        ],
        benchmarkBasis: 'Keep the refinement centred on supplier dependency and delivery slippage.',
        scenarioLens: {
          key: 'supply-chain',
          label: 'Supply chain',
          functionKey: 'operations',
          estimatePresetKey: 'operations'
        },
        structuredScenario: {
          assetService: 'Infrastructure deployment programme',
          primaryDriver: 'Supplier delivery miss',
          eventPath: 'Delayed supplier delivery pushing deployment and milestone slippage',
          effect: 'Dependent project delay and execution pressure'
        },
        risks: [
          {
            title: 'Supplier delivery slippage delaying dependent deployment',
            category: 'Supply Chain',
            description: 'Missed supplier delivery dates can delay infrastructure deployment and dependent programme activity.',
            confidence: 'high'
          }
        ]
      });
    }
    throw new Error(`Unexpected fetch in supplier refinement live test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-draft-refinement');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Key supplier misses committed delivery date, delaying infrastructure deployment and dependent projects.',
      scenarioLensHint: { key: 'cyber', label: 'Cyber', functionKey: 'technology' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.notEqual(res.payload.scenarioLens?.key, 'cyber');
  assert.match(String(res.payload.draftNarrative || ''), /supplier|delivery|deployment|milestone/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /tenant|credential|mailbox|phishing/i);
});

test('manual-shortlist route keeps payment-control failure in the financial lane instead of stale cyber drift', async () => {
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
    throw new Error(`Unexpected fetch in manual-shortlist test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-shortlist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A payment-control failure causes direct monetary loss and reconciliation pressure.',
      scenarioLensHint: { key: 'cyber', label: 'Cyber', functionKey: 'technology' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.key, 'financial');
  assert.match(String(res.payload.draftNarrative || ''), /payment|monetary|loss|reconciliation/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /tenant|credential|mailbox|ransomware/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /payment|financial|loss|control/i);
  assert.doesNotMatch(titles, /cyber|identity|credential/i);
});

test('manual-intake-assist route keeps supplier delivery slippage out of cyber despite a stale hint', async () => {
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
    throw new Error(`Unexpected fetch in manual-intake-assist test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-intake-assist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A key supplier misses a committed delivery date, delaying infrastructure deployment and dependent projects.',
      scenarioLensHint: { key: 'cyber', label: 'Cyber', functionKey: 'technology' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.notEqual(res.payload.scenarioLens?.key, 'cyber');
  assert.notEqual(res.payload.scenarioLens?.functionKey, 'technology');
  assert.match(String(res.payload.draftNarrative || ''), /supplier|delivery|deployment|project/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /credential|identity|tenant|mailbox/i);
});

test('manual-shortlist route uses dedicated shortlist orchestration and does not rewrite the accepted draft narrative', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.4';
  const providerBodies = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    if (String(url) === 'https://example.test/ai') {
      providerBodies.push(JSON.parse(options.body));
      return buildLlmResponse({
        summary: 'Shortlist stays anchored to privileged identity takeover and downstream control change.',
        linkAnalysis: 'Keep only risk cards that share the same identity-compromise path.',
        workflowGuidance: [
          'Do not let downstream monetary loss become the main shortlist lane.'
        ],
        benchmarkBasis: 'Shortlist should remain aligned to the accepted draft.',
        risks: [
          {
            title: 'Privileged tenant takeover through leaked administrator credentials',
            category: 'Identity & Access',
            description: 'Leaked global admin credentials can enable privileged tenant access and control disruption.',
            confidence: 'high'
          },
          {
            title: 'Payment process exposure from downstream monetary loss',
            category: 'Financial',
            description: 'Direct monetary loss can emerge after disruption, but this is not the primary event path.',
            confidence: 'medium'
          }
        ]
      });
    }
    throw new Error(`Unexpected fetch in manual-shortlist live test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-shortlist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();
  const acceptedNarrative = 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.';

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: acceptedNarrative,
      scenarioLensHint: { key: 'financial', label: 'Financial', functionKey: 'finance' }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'live');
  assert.equal(String(res.payload.draftNarrative || ''), acceptedNarrative);
  assert.equal(String(res.payload.enhancedStatement || ''), acceptedNarrative);
  assert.equal(String(res.payload.shortlistCoherence?.mode || ''), 'filtered');
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /tenant|credential|identity|administrator/i);
  assert.doesNotMatch(titles, /payment process|financial/i);
  assert.equal(providerBodies.length, 1);
  const systemPrompt = String(providerBodies[0]?.messages?.[0]?.content || '');
  const userPrompt = String(providerBodies[0]?.messages?.[1]?.content || '');
  assert.match(systemPrompt, /do not rewrite the scenario/i);
  assert.match(userPrompt, /Accepted scenario draft:/);
});

test('manual-shortlist route returns manual mode for ambiguous short text instead of fake precision', async () => {
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
    throw new Error(`Unexpected fetch in manual-shortlist manual-mode test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/manual-shortlist');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Issue'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'manual');
  assert.equal(Array.isArray(res.payload.risks) ? res.payload.risks.length : 0, 0);
});
