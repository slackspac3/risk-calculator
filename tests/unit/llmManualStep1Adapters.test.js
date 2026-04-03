'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

function loadService({ origin = 'https://slackspac3.github.io', fetchImpl } = {}) {
  return loadLlmService({ origin, fetchImpl });
}

test('buildManualDraftRefinement uses the server manual-draft-refinement endpoint', async () => {
  const fetchCalls = [];
  const service = loadService({
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'live',
          scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
          trace: { label: 'Step 1 narrative refinement', response: 'refined' }
        })
      };
    }
  });

  await service.buildManualDraftRefinement({
    riskStatement: '  Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations. ',
    scenarioLensHint: { key: 'financial', label: 'Financial', functionKey: 'finance' },
    businessUnit: { id: ' tech ', name: ' Technology ' },
    priorMessages: [{ role: ' user ', content: '  refine this  ' }]
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/manual-draft-refinement');
  const requestBody = JSON.parse(fetchCalls[0].options.body);
  assert.equal(requestBody.riskStatement, 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.');
  assert.deepEqual(requestBody.scenarioLensHint, { key: 'financial', label: 'Financial', functionKey: 'finance' });
  assert.deepEqual(requestBody.businessUnit, { id: 'tech', name: 'Technology' });
  assert.deepEqual(requestBody.priorMessages, [{ role: 'user', content: 'refine this' }]);
});

test('buildManualIntakeAssist uses the server manual-intake-assist endpoint and normalises register context', async () => {
  const fetchCalls = [];
  const service = loadService({
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          scenarioLens: { key: 'operational', label: 'Operational', functionKey: 'operations' }
        })
      };
    }
  });

  await service.buildManualIntakeAssist({
    riskStatement: '  Key supplier misses a committed delivery date, delaying infrastructure deployment. ',
    registerText: '  Row 1\n\n  Row 2  ',
    registerMeta: { type: ' XLSX ', extension: ' XLSX ', debug: 'drop-me' },
    traceLabel: ' Step 1 intake assist '
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/manual-intake-assist');
  const requestBody = JSON.parse(fetchCalls[0].options.body);
  assert.equal(requestBody.riskStatement, 'Key supplier misses a committed delivery date, delaying infrastructure deployment.');
  assert.equal(requestBody.registerText, 'Row 1\n\nRow 2');
  assert.deepEqual(requestBody.registerMeta, { type: 'xlsx', extension: 'xlsx' });
  assert.equal(requestBody.traceLabel, 'Step 1 intake assist');
});

test('buildManualShortlist still uses the server manual-shortlist endpoint when direct Compass config is enabled locally', async () => {
  const fetchCalls = [];
  const service = loadService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'live',
          risks: []
        })
      };
    }
  });

  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: 'browser-secret'
  });

  await service.buildManualShortlist({
    riskStatement: 'A payment-control failure causes direct monetary loss and reconciliation pressure.'
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/manual-shortlist');
});
