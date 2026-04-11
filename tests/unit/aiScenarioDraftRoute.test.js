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

test('scenario-draft route returns manual mode for incomplete scenario input before any upstream AI call', async () => {
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
    throw new Error(`Unexpected fetch in manual scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Outage'
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
  assert.equal(res.payload.draftNarrativeSource, 'manual');
  assert.equal(String(res.payload.manualReasonCode || ''), 'incomplete_scenario_input');
  assert.match(String(res.payload.manualReasonMessage || ''), /State what happened or could happen in one plain sentence/i);
  assert.match(String((res.payload.workflowGuidance || [])[0] || ''), /State what happened or could happen/i);
  assert.equal(String(res.payload.trace?.label || ''), 'Step 1 guided draft');
});

test('scenario-draft route returns deterministic server fallback when hosted AI proxy is not configured', async () => {
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
    throw new Error(`Unexpected fetch in fallback scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials found on the dark web.'
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
  assert.equal(res.payload.draftNarrativeSource, 'fallback');
  assert.equal(typeof res.payload.draftNarrative, 'string');
  assert.equal(String(res.payload.trace?.label || ''), 'Step 1 guided draft');
});

test('scenario-draft route keeps no-DR Outlook continuity scenarios out of cyber, AI, and fraud drift in deterministic fallback', async () => {
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
    throw new Error(`Unexpected fetch in continuity fallback scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'There is no DR for the critical email system in place, which is MS Outlook online.',
      guidedInput: {
        event: 'There is no DR for the critical email system in place, which is MS Outlook online.',
        asset: 'MS Outlook online',
        cause: 'No disaster recovery or failover capability',
        impact: 'Extended outage and recovery pressure'
      }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.key, 'business-continuity');
  assert.equal(res.payload.aiAlignment?.taxonomy?.primaryFamilyKey, 'dr_gap');
  assert.match(String(res.payload.draftNarrative || ''), /email|communications|recovery/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /responsible ai|model|fraud|data exposure/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /business continuity|email outage|recovery/i);
  assert.doesNotMatch(titles, /responsible ai|fraud|data exposure/i);
});

test('scenario-draft route keeps website traffic-flood attacks in a cyber availability lane without AI or compliance leakage', async () => {
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
    throw new Error(`Unexpected fetch in availability-attack fallback scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Malicious actors flood a company’s website or online services with traffic, causing them to slow down or crash.',
      guidedInput: {
        event: 'Malicious actors flood a company’s website or online services with traffic, causing them to slow down or crash.',
        asset: 'Company website and online services',
        cause: 'Hostile traffic flooding',
        impact: 'Customer-facing slowdown and outage'
      }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.key, 'cyber');
  assert.equal(res.payload.aiAlignment?.taxonomy?.primaryFamilyKey, 'availability_attack');
  assert.match(String(res.payload.draftNarrative || ''), /traffic|website|online service|availability|outage/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /responsible ai|policy breakdown|compliance control/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /traffic flooding|service outage|availability|website/i);
  assert.doesNotMatch(titles, /responsible ai|compliance control|policy breakdown/i);
});

test('scenario-draft route keeps counterparty default fallback in the credit-loss lane instead of payment-fraud drift', async () => {
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
    throw new Error(`Unexpected fetch in financial fallback scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A major client files for bankruptcy, creating receivables recovery pressure and a likely write-off.',
      guidedInput: {
        event: 'A major client files for bankruptcy, creating receivables recovery pressure and a likely write-off.',
        asset: 'Major customer receivables balance',
        cause: 'Customer insolvency',
        impact: 'Bad-debt write-off and cashflow strain'
      }
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
  assert.match(String(res.payload.draftNarrative || ''), /receivables|write-off|collectability|cashflow/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /payment manipulation|invoice fraud|responsible ai/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /counterparty|receivables|recovery/i);
  assert.doesNotMatch(titles, /payment fraud|responsible ai|cyber/i);
});

test('scenario-draft route keeps payroll disclosure fallback out of supplier-delivery drift', async () => {
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
    throw new Error(`Unexpected fetch in payroll disclosure fallback scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A third-party payroll processor applies a configuration change that misroutes salary payments, exposing bank details to the wrong employees and delaying correction because incident ownership is unclear.',
      guidedInput: {
        event: 'A third-party payroll processor applies a configuration change that misroutes salary payments, exposing bank details to the wrong employees and delaying correction because incident ownership is unclear.',
        asset: 'Payroll processing and employee payment data',
        cause: 'Third-party configuration change and unclear incident ownership',
        impact: 'Misdirected salary payments and bank-detail disclosure'
      }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.key, 'cyber');
  assert.equal(res.payload.aiAlignment?.taxonomy?.primaryFamilyKey, 'data_disclosure');
  assert.match(String(res.payload.draftNarrative || ''), /data disclosure|wrong party|data-handling controls/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /supplier-dependency and delivery issue|infrastructure deployment|milestone plan|dependent business projects/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /disclosure|bank|payroll|data/i);
  assert.doesNotMatch(titles, /supplier miss|deployment|milestone/i);
});

test('scenario-draft route keeps supplier labour fallback in the ESG lane instead of cyber or pure procurement drift', async () => {
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
    throw new Error(`Unexpected fetch in ESG fallback scenario-draft test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'A supplier is linked to forced labour practices in a critical sourcing category.',
      guidedInput: {
        event: 'A supplier is linked to forced labour practices in a critical sourcing category.',
        asset: 'Critical supplier relationship',
        cause: 'Weak sub-tier due diligence',
        impact: 'Human-rights scrutiny and remediation pressure'
      }
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.mode, 'deterministic_fallback');
  assert.equal(res.payload.scenarioLens?.key, 'esg');
  assert.match(String(res.payload.draftNarrative || ''), /labou?r|human-rights|remediation|supplier/i);
  assert.doesNotMatch(String(res.payload.draftNarrative || ''), /responsible ai|cyber|fraud/i);
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /labou?r|human-rights|supplier/i);
  assert.doesNotMatch(titles, /responsible ai|cyber compromise|payment fraud/i);
});

test('scenario-draft route orchestrates live generation and quality-gate server-side for Step 1 guided draft', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    draftNarrative: 'Azure global admin credentials found on the dark web are being used to access the tenant, escalate privileges, and modify critical controls.',
    summary: 'The scenario stays in the identity compromise lane.',
    linkAnalysis: 'The main chain is identity compromise, privileged escalation, and downstream disruption or fraud.',
    workflowGuidance: [
      'Confirm the scope of the compromised admin identity.',
      'Keep only the risks that share the same identity compromise path.'
    ],
    benchmarkBasis: 'Prefer identity-control and privileged-access comparators from GCC and global enterprise peers.',
    scenarioLens: {
      key: 'identity',
      label: 'Cyber',
      functionKey: 'technology',
      estimatePresetKey: 'identity',
      secondaryKeys: []
    },
    structuredScenario: {
      assetService: 'Azure tenant administration',
      primaryDriver: 'Credential theft and account takeover',
      eventPath: 'Privileged credential abuse to access the tenant',
      effect: 'Privilege misuse, disruption, and exposure'
    },
    risks: [
      {
        title: 'Privileged account takeover through exposed admin credentials',
        category: 'Identity & Access',
        description: 'Exposed global admin credentials could enable privilege escalation and control changes across the tenant.',
        confidence: 'high',
        regulations: ['ISO 27001']
      }
    ]
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

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials found on the dark web.',
      guidedInput: {
        event: 'Azure global admin credentials found on the dark web.',
        impact: 'Control disruption and fraud exposure'
      },
      traceLabel: 'Step 1 guided draft'
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
  assert.equal(res.payload.scenarioLens?.key, 'identity');
  assert.match(String(res.payload.draftNarrative || ''), /global admin credentials/i);
  assert.equal(String(res.payload.trace?.label || ''), 'Step 1 guided draft');
});

test('scenario-draft route sends preserve-details anchors and compact context to the hosted AI prompt', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.4';

  const providerBodies = [];
  const aiPayload = JSON.stringify({
    draftNarrative: 'Key vendor delivery slips are blocking a dependent rollout and delaying committed milestones.',
    summary: 'The scenario stays in the dependency-led delivery lane.',
    linkAnalysis: 'The main chain is supplier delivery slippage, dependent rollout delay, and wider programme disruption.',
    workflowGuidance: [
      'Keep the event path centred on the dependency delay.',
      'Avoid letting downstream programme pressure become a different primary family.'
    ],
    benchmarkBasis: 'Stay close to the typed dependency-led delivery wording.',
    scenarioLens: {
      key: 'transformation-delivery',
      label: 'Transformation delivery',
      functionKey: 'operations',
      estimatePresetKey: 'transformation-delivery',
      secondaryKeys: []
    },
    structuredScenario: {
      assetService: 'Dependent rollout programme',
      primaryDriver: 'Vendor delivery slippage',
      eventPath: 'A dependency misses committed dates and blocks rollout work',
      effect: 'Delayed milestones and wider delivery disruption'
    },
    risks: [
      {
        title: 'Dependency slippage delaying committed rollout milestones',
        category: 'Delivery',
        description: 'Vendor delivery delays block dependent rollout tasks and strain committed milestones.',
        confidence: 'high',
        regulations: ['ISO 27001']
      }
    ]
  });

  global.fetch = async (url, options = {}) => {
    if (String(url).includes('/kv')) {
      return {
        ok: true,
        json: async () => ({ result: null })
      };
    }
    if (String(url) === 'https://example.test/ai') {
      providerBodies.push(JSON.parse(options.body));
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
    }
    throw new Error(`Unexpected fetch in scenario-draft prompt packing test: ${url}`);
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Key vendor delivery slips are blocking a dependent rollout and delaying committed milestones.',
      guidedInput: {
        event: 'Key vendor delivery slips are blocking a dependent rollout',
        cause: 'A dependency missed committed delivery dates',
        asset: 'The dependent rollout programme',
        impact: 'Dependent teams cannot complete the rollout on time'
      },
      businessUnit: {
        name: 'Group Technology',
        contextSummary: 'Delivery dependency context. '.repeat(160),
        selectedDepartmentContext: 'Selected rollout context. '.repeat(120),
        aiGuidance: 'Stay focused on explicit dependency slippage. '.repeat(80)
      },
      adminSettings: {
        businessUnitContext: 'Business-unit rollout context. '.repeat(180),
        departmentContext: 'Department delivery context. '.repeat(160),
        inheritedContextSummary: 'Inherited organisation context. '.repeat(140),
        personalContextSummary: 'User context. '.repeat(120),
        resolvedObligationSummary: 'Programmes must track delivery obligations and escalations. '.repeat(120),
        resolvedObligationContext: {
          direct: [{ title: 'Delivery obligation', text: 'Critical programmes must retain delivery evidence and escalation triggers. '.repeat(60) }]
        }
      },
      citations: [
        { title: 'Generic governance note', score: 10, relevanceReason: 'General programme governance review only.', excerpt: 'A generic planning note without direct scenario evidence.' },
        { title: 'Most relevant source', score: 9, relevanceReason: 'Directly matches the dependency-led delay.', excerpt: 'The vendor missed committed dates and blocked rollout work.' },
        { title: 'Second source', score: 8, relevanceReason: 'Confirms the same dependent rollout blockage.', excerpt: 'Dependent teams cannot finish the rollout until the vendor deliverable lands.' },
        { title: 'Third source', score: 7, relevanceReason: 'Supports the same delivery event path.', excerpt: 'Programme leadership has already escalated the delay.' },
        { title: 'Fourth source', score: 6, relevanceReason: 'Supporting source only.', excerpt: 'Delivery governance note.' }
      ]
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(providerBodies.length >= 1, true);
  const userPrompt = String(providerBodies[0]?.messages?.[1]?.content || '');
  assert.match(userPrompt, /Priority details to preserve:/);
  assert.match(userPrompt, /Accepted taxonomy anchor:/);
  assert.match(userPrompt, /Retrieved references:/);
  assert.ok(userPrompt.length < 12000);
  assert.doesNotMatch(userPrompt, /Generic governance note/);
  assert.match(userPrompt, /Most relevant source/);
});

test('scenario-draft route repairs an off-lane live shortlist so it stays aligned with the accepted identity narrative', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    draftNarrative: 'Azure global admin credentials found on the dark web are being used to access the tenant, escalate privileges, and modify critical controls.',
    summary: 'The scenario stays in the identity compromise lane.',
    linkAnalysis: 'The main chain is identity compromise, privileged escalation, and downstream disruption or fraud.',
    workflowGuidance: [
      'Confirm the scope of the compromised admin identity.',
      'Keep only the risks that share the same identity compromise path.'
    ],
    benchmarkBasis: 'Prefer identity-control and privileged-access comparators from GCC and global enterprise peers.',
    scenarioLens: {
      key: 'identity',
      label: 'Cyber',
      functionKey: 'technology',
      estimatePresetKey: 'identity',
      secondaryKeys: []
    },
    structuredScenario: {
      assetService: 'Azure tenant administration',
      primaryDriver: 'Credential theft and account takeover',
      eventPath: 'Privileged credential abuse to access the tenant',
      effect: 'Privilege misuse, disruption, and exposure'
    },
    risks: [
      {
        title: 'Privileged account takeover through exposed admin credentials',
        category: 'Identity & Access',
        description: 'Exposed global admin credentials could enable privilege escalation and control changes across the tenant.',
        confidence: 'high',
        regulations: ['ISO 27001']
      },
      {
        title: 'Direct financial loss from payment-control weakness',
        category: 'Financial',
        description: 'Monetary loss could follow because payment controls are weak.',
        confidence: 'medium',
        regulations: ['ISO 27001']
      },
      {
        title: 'Compliance assurance gap and policy remediation',
        category: 'Compliance',
        description: 'Assurance activity is required because the event occurred.',
        confidence: 'medium',
        regulations: ['ISO 27001']
      },
      {
        title: 'AI model governance review',
        category: 'AI / Model Risk',
        description: 'Model governance should be reviewed after the incident.',
        confidence: 'low',
        regulations: ['ISO 27001']
      }
    ]
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

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials found on the dark web.',
      guidedInput: {
        event: 'Azure global admin credentials found on the dark web.',
        impact: 'Control disruption and fraud exposure'
      },
      traceLabel: 'Step 1 guided draft'
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
  assert.equal(String(res.payload.shortlistCoherence?.mode || ''), 'fallback_replaced');
  assert.equal(Boolean(res.payload.shortlistCoherence?.usedFallbackShortlist), true);
  assert.equal(String(res.payload.shortlistCoherence?.acceptedPrimaryFamilyKey || ''), 'identity_compromise');
  assert.equal(typeof res.payload.shortlistCoherence?.filteredOutCount, 'number');
  assert.equal(typeof res.payload.shortlistCoherence?.blockedCount, 'number');
  assert.equal(typeof res.payload.shortlistCoherence?.weakOverlayOnlyCount, 'number');
  assert.equal(typeof res.payload.shortlistCoherence?.confidenceScore, 'number');
  assert.match(String(res.payload.shortlistCoherence?.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(res.payload.shortlistCoherence?.confidenceDrivers));
  assert.equal(typeof res.payload.shortlistCoherence?.calibrationMode, 'string');
  assert.ok(Array.isArray(res.payload.shortlistCoherence?.dominantFamilies));
  assert.ok(Array.isArray(res.payload.shortlistCoherence?.acceptedSecondaryFamilyKeys));
  assert.equal(typeof res.payload.shortlistCoherence?.taxonomyVersion, 'string');
  assert.equal(typeof res.payload.aiAlignment?.taxonomy?.confidenceScore, 'number');
  assert.match(String(res.payload.aiAlignment?.taxonomy?.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(res.payload.aiAlignment?.taxonomy?.confidenceDrivers));
  assert.equal(typeof res.payload.aiAlignment?.taxonomy?.calibrationMode, 'string');
  const titles = (Array.isArray(res.payload.risks) ? res.payload.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
  assert.match(titles, /privileged|configuration|tenant/i);
  assert.doesNotMatch(titles, /payment-control|compliance assurance|ai model/i);
});

test('scenario-draft route rejects a finance-led rewrite when the guided event is explicitly identity compromise', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    draftNarrative: 'High-urgency Financial scenario: Azure global admin credentials discovered on darkweb. The area most exposed is the financial process, transaction flow, or commercial exposure in scope. If this develops, it could create direct monetary loss, control pressure, and delayed detection.',
    summary: 'The scenario points to financial loss exposure.',
    linkAnalysis: 'The main chain is financial-control weakness and fraud exposure.',
    workflowGuidance: [
      'Review payment controls.',
      'Assess fraud exposure.'
    ],
    benchmarkBasis: 'Prefer financial control comparators.',
    scenarioLens: {
      key: 'financial',
      label: 'Financial',
      functionKey: 'finance',
      estimatePresetKey: 'financial',
      secondaryKeys: []
    },
    structuredScenario: {
      assetService: 'Financial process',
      primaryDriver: 'Financial-control weakness',
      eventPath: 'Financial exposure',
      effect: 'Monetary loss'
    },
    risks: [
      {
        title: 'Direct financial loss from control weakness',
        category: 'Financial',
        description: 'Financial loss could follow from the event.',
        confidence: 'high',
        regulations: ['ISO 27001']
      }
    ]
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

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials discovered on darkweb.',
      guidedInput: {
        event: 'Azure global admin credentials discovered on darkweb',
        urgency: 'high'
      },
      scenarioLensHint: 'financial'
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
  assert.equal(String(res.payload.scenarioLens?.key || ''), 'cyber');
  assert.match(String(res.payload.draftNarrative || ''), /identity compromise/i);
});

test('scenario-draft route reuses identical in-flight work for simultaneous requests', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.1';

  const aiPayload = JSON.stringify({
    draftNarrative: 'Azure global admin credentials found on the dark web are being used to access the tenant, escalate privileges, and modify critical controls.',
    summary: 'The scenario stays in the identity compromise lane.',
    linkAnalysis: 'The main chain is identity compromise, privileged escalation, and downstream disruption or fraud.',
    workflowGuidance: [
      'Confirm the scope of the compromised admin identity.',
      'Keep only the risks that share the same identity compromise path.'
    ],
    benchmarkBasis: 'Prefer identity-control and privileged-access comparators from GCC and global enterprise peers.',
    scenarioLens: {
      key: 'identity',
      label: 'Cyber',
      functionKey: 'technology',
      estimatePresetKey: 'identity',
      secondaryKeys: []
    },
    structuredScenario: {
      assetService: 'Azure tenant administration',
      primaryDriver: 'Credential theft and account takeover',
      eventPath: 'Privileged credential abuse to access the tenant',
      effect: 'Privilege misuse, disruption, and exposure'
    },
    risks: [
      {
        title: 'Privileged account takeover through exposed admin credentials',
        category: 'Identity & Access',
        description: 'Exposed global admin credentials could enable privilege escalation and control changes across the tenant.',
        confidence: 'high',
        regulations: ['ISO 27001']
      }
    ]
  });

  let aiFetchCount = 0;
  global.fetch = (url) => {
    if (String(url).includes('/kv')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ result: null })
      });
    }
    aiFetchCount += 1;
    return new Promise((resolve) => {
      setTimeout(() => resolve({
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
      }), 50);
    });
  };

  const handler = loadFresh('../../api/ai/scenario-draft');
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const req = {
    method: 'POST',
    body: JSON.stringify({
      riskStatement: 'Azure global admin credentials found on the dark web.',
      guidedInput: {
        event: 'Azure global admin credentials found on the dark web.'
      },
      traceLabel: 'Step 1 guided draft'
    }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' }
  };
  const firstRes = createRes();
  const secondRes = createRes();

  const first = handler(req, firstRes);
  const second = handler(req, secondRes);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(aiFetchCount, 1);
  await Promise.all([first, second]);

  // This workflow may do one follow-up repair pass, but the duplicate request should not double the work.
  assert.equal(aiFetchCount <= 2, true);
  assert.equal(firstRes.statusCode, 200);
  assert.equal(secondRes.statusCode, 200);
  assert.equal(firstRes.payload.mode, 'live');
  assert.equal(secondRes.payload.mode, 'live');
});
