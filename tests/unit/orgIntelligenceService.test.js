'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createMemoryStorage(seed = {}) {
  const store = new Map(Object.entries(seed).map(([key, value]) => [String(key), String(value)]));
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    }
  };
}

function loadOrgIntelligenceService({ origin = 'https://slackspac3.github.io', fetchImpl, extraContext = {}, storageSeed = {} } = {}) {
  const filePath = path.resolve(__dirname, '../../assets/services/orgIntelligenceService.js');
  const source = `${fs.readFileSync(filePath, 'utf8')}\nmodule.exports = OrgIntelligenceService;\n`;
  const apiOriginResolver = {
    DEFAULT_API_ORIGIN: 'https://risk-calculator-eight.vercel.app',
    resolveApiUrl(path = '') {
      return `https://risk-calculator-eight.vercel.app${String(path || '').trim()}`;
    }
  };
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    localStorage: createMemoryStorage(storageSeed),
    window: {
      location: { origin },
      __RISK_CALCULATOR_RELEASE__: {
        apiOrigin: 'https://risk-calculator-eight.vercel.app'
      },
      ApiOriginResolver: apiOriginResolver
    },
    AuthService: {
      getApiSessionToken() {
        return 'session-token';
      },
      getCurrentUser() {
        return { username: 'alex' };
      }
    },
    fetch: fetchImpl,
    ApiOriginResolver: apiOriginResolver,
    ...extraContext
  };
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: filePath });
  return context.module.exports;
}

test('OrgIntelligenceService uses the Vercel API origin outside vercel.app for shared feedback writes', async () => {
  const calls = [];
  const service = loadOrgIntelligenceService({
    origin: 'https://slackspac3.github.io',
    fetchImpl: async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({ ok: true, feedback: { updatedAt: Date.now(), events: [] } }),
        text: async () => JSON.stringify({ ok: true, feedback: { updatedAt: Date.now(), events: [] } })
      };
    }
  });

  await service.recordAiFeedback({
    target: 'draft',
    score: 4,
    runtimeMode: 'live_ai',
    buId: 'g42',
    functionKey: 'technology',
    lensKey: 'cyber'
  });

  assert.equal(calls[0], 'https://risk-calculator-eight.vercel.app/api/org-intelligence');
});

test('OrgIntelligenceService uses the Vercel API origin outside vercel.app for shared feedback reads', async () => {
  const calls = [];
  const service = loadOrgIntelligenceService({
    origin: 'https://slackspac3.github.io',
    fetchImpl: async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({
          patterns: [],
          calibration: { updatedAt: 0, scenarioTypes: {} },
          decisions: [],
          coverageMap: { updatedAt: 0, scenarioTypes: {} },
          feedback: { updatedAt: Date.now(), events: [] }
        }),
        text: async () => JSON.stringify({
          patterns: [],
          calibration: { updatedAt: 0, scenarioTypes: {} },
          decisions: [],
          coverageMap: { updatedAt: 0, scenarioTypes: {} },
          feedback: { updatedAt: Date.now(), events: [] }
        })
      };
    }
  });

  await service.refresh(true);

  assert.equal(calls[0], 'https://risk-calculator-eight.vercel.app/api/org-intelligence');
});

test('OrgIntelligenceService ignores browser LearningStore feedback profiles for authoritative hierarchy resolution', async () => {
  const service = loadOrgIntelligenceService({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        patterns: [],
        calibration: { updatedAt: 0, scenarioTypes: {} },
        decisions: [],
        coverageMap: { updatedAt: 0, scenarioTypes: {} },
        feedback: {
          updatedAt: Date.now(),
          events: [
            {
              target: 'draft',
              score: 5,
              runtimeMode: 'live_ai',
              functionKey: 'technology',
              lensKey: 'cyber',
              submittedBy: 'morgan'
            },
            {
              target: 'draft',
              score: 4,
              runtimeMode: 'live_ai',
              functionKey: 'technology',
              lensKey: 'cyber',
              submittedBy: 'riley'
            },
            {
              target: 'draft',
              score: 4,
              runtimeMode: 'live_ai',
              functionKey: 'technology',
              lensKey: 'cyber',
              submittedBy: 'alex'
            }
          ]
        }
      }),
      text: async () => ''
    }),
    extraContext: {
      LearningStore: {
        getAiFeedbackProfile() {
          throw new Error('browser LearningStore should not be consulted for authoritative profile resolution');
        }
      }
    }
  });

  await service.refresh(true);
  const profile = service.getHierarchicalFeedbackProfile({
    functionKey: 'technology',
    scenarioLensKey: 'cyber'
  });

  assert.equal(profile.user.active, false);
  assert.equal(profile.function.active, true);
  assert.equal(profile.combined.activeTiers.includes('user'), false);
});

test('OrgIntelligenceService ignores browser-local scenario patterns when merging patterns', async () => {
  const service = loadOrgIntelligenceService({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        patterns: [
          {
            id: 'org-pattern-1',
            assessmentId: 'org-pattern-1',
            buId: 'g42',
            scenarioLens: { key: 'cyber', label: 'Cyber risk' },
            title: 'Org pattern',
            narrative: 'Org-authored pattern'
          }
        ],
        calibration: { updatedAt: 0, scenarioTypes: {} },
        decisions: [],
        coverageMap: { updatedAt: 0, scenarioTypes: {} },
        feedback: { updatedAt: Date.now(), events: [] }
      }),
      text: async () => ''
    }),
    extraContext: {
      LearningStore: {
        getScenarioPatterns() {
          throw new Error('browser-local scenario patterns should not be consulted');
        }
      }
    }
  });

  await service.refresh(true);
  const patterns = service.getMergedScenarioPatterns({
    buId: 'g42',
    scenarioLensKey: 'cyber',
    narrative: 'Org-authored pattern'
  }, 4);

  assert.equal(Array.from(patterns, (item) => item.assessmentId).join(','), 'org-pattern-1');
});

test('OrgIntelligenceService can reset shared feedback and clears cached events', async () => {
  const calls = [];
  const service = loadOrgIntelligenceService({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', body: String(options.body || '') });
      if ((options.method || 'GET') === 'POST' && String(options.body || '').includes('record_feedback')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            feedback: {
              updatedAt: Date.now(),
              events: [
                {
                  id: 'fb-1',
                  target: 'draft',
                  score: 2,
                  runtimeMode: 'live_ai',
                  functionKey: 'technology',
                  lensKey: 'cyber',
                  submittedBy: 'alex'
                }
              ]
            }
          }),
          text: async () => ''
        };
      }
      if ((options.method || 'GET') === 'POST' && String(options.body || '').includes('reset_feedback')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            feedback: { updatedAt: Date.now(), events: [] },
            resetScope: 'platform',
            userTierReset: {
              attemptedUsers: 2,
              clearedUsers: 2,
              skippedUsers: 0,
              failedUsers: []
            }
          }),
          text: async () => JSON.stringify({
            ok: true,
            feedback: { updatedAt: Date.now(), events: [] },
            resetScope: 'platform',
            userTierReset: {
              attemptedUsers: 2,
              clearedUsers: 2,
              skippedUsers: 0,
              failedUsers: []
            }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({ ok: true, feedback: { updatedAt: Date.now(), events: [] } }),
        text: async () => ''
      };
    }
  });

  const saved = await service.recordAiFeedback({
    target: 'draft',
    score: 2,
    runtimeMode: 'live_ai',
    functionKey: 'technology',
    lensKey: 'cyber'
  });
  assert.ok(saved);
  assert.equal(service.getFeedbackEvents().length, 1);

  const reset = await service.resetAiFeedback({ includeUserTier: true });
  assert.equal(reset.ok, true);
  assert.equal(reset.resetScope, 'platform');
  assert.equal(reset.userTierReset.clearedUsers, 2);
  assert.equal(service.getFeedbackEvents().length, 0);
  assert.match(calls[calls.length - 1].body, /reset_feedback/);
  assert.match(calls[calls.length - 1].body, /"includeUserTier":true/);
});
