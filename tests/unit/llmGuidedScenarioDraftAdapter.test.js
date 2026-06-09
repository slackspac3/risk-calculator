'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

function loadService({ origin = 'https://slackspac3.github.io', fetchImpl } = {}) {
  return loadLlmService({ origin, fetchImpl });
}

test('buildGuidedScenarioDraft uses the server scenario-draft endpoint and stores returned trace in runtime memory', async () => {
  const fetchCalls = [];
  const service = loadService({
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'live',
          draftNarrative: 'High-urgency Cyber scenario: Azure global admin credentials found on the dark web are being used to access the tenant.',
          scenarioLens: {
            key: 'identity',
            label: 'Cyber',
            functionKey: 'technology',
            estimatePresetKey: 'identity',
            secondaryKeys: []
          },
          trace: {
            label: 'Step 2 guided draft',
            promptSummary: 'Server prompt summary',
            response: 'Server returned guided draft',
            sources: [
              {
                title: 'Identity reference',
                url: 'https://example.com/source'
              }
            ]
          }
        })
      };
    }
  });

  const result = await service.buildGuidedScenarioDraft({
    riskStatement: '  Azure   global admin credentials found on the dark web.  ',
    guidedInput: {
      event: '  Azure global admin credentials found on the dark web. ',
      impact: '  Control disruption   and fraud exposure  ',
      asset: '   ',
      uiOnly: 'drop-me'
    },
    businessUnit: {
      id: ' bu-1 ',
      name: ' Identity Operations ',
      contextSummary: '  Privileged identities support the Azure tenant.  ',
      junk: 'drop-me'
    },
    applicableRegulations: [' ISO 27001 ', '', 'ISO 27001'],
    citations: [
      {
        title: ' Identity reference ',
        excerpt: '  Admin credential exposure guidance. ',
        url: 'https://example.com/source',
        debug: 'drop-me'
      },
      null
    ],
    adminSettings: {
      businessUnitContext: '  Cloud identity context ',
      resolvedObligationContext: {
        direct: [{ title: ' Access review ', text: '  Review privileged access quarterly. ', debug: 'drop-me' }]
      },
      debug: 'drop-me'
    },
    priorMessages: [
      { role: ' user ', content: '  First prompt  ', debug: 'drop-me' },
      { role: 'assistant', content: '   ' }
    ],
    traceLabel: ' Step 2 guided draft '
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/scenario-draft');
  assert.equal(fetchCalls[0].options.method, 'POST');
  assert.equal(fetchCalls[0].options.headers['x-session-token'], 'session-token');
  const requestBody = JSON.parse(fetchCalls[0].options.body);
  assert.equal(requestBody.riskStatement, 'Azure global admin credentials found on the dark web.');
  assert.deepEqual(requestBody.guidedInput, {
    event: 'Azure global admin credentials found on the dark web.',
    impact: 'Control disruption and fraud exposure'
  });
  assert.deepEqual(requestBody.businessUnit, {
    id: 'bu-1',
    name: 'Identity Operations',
    contextSummary: 'Privileged identities support the Azure tenant.'
  });
  assert.deepEqual(requestBody.applicableRegulations, ['ISO 27001']);
  assert.deepEqual(requestBody.citations, [{
    title: 'Identity reference',
    excerpt: 'Admin credential exposure guidance.',
    url: 'https://example.com/source'
  }]);
  assert.deepEqual(requestBody.adminSettings, {
    businessUnitContext: 'Cloud identity context',
    resolvedObligationContext: {
      direct: [{ title: 'Access review', text: 'Review privileged access quarterly.' }]
    }
  });
  assert.deepEqual(requestBody.priorMessages, [{ role: 'user', content: 'First prompt' }]);
  assert.equal(requestBody.traceLabel, 'Step 2 guided draft');
  assert.equal(result.mode, 'live');
  assert.equal(result.scenarioLens?.key, 'identity');
  assert.equal(service.getLatestTrace('Step 2 guided draft')?.response, 'Server returned guided draft');
});

test('buildGuidedScenarioDraft still uses the server scenario-draft endpoint even when local-dev direct Compass config is enabled', async () => {
  const fetchCalls = [];
  const service = loadService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          draftNarrative: 'Server-owned guided draft',
          usedFallback: true
        })
      };
    }
  });

  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: 'browser-secret'
  });

  await service.buildGuidedScenarioDraft({
    riskStatement: 'A key supplier misses a delivery date.'
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/scenario-draft');
});
