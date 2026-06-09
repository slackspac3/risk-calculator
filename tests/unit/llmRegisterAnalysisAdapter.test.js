'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

function loadService({ origin = 'https://slackspac3.github.io', fetchImpl } = {}) {
  return loadLlmService({ origin, fetchImpl });
}

test('analyseRiskRegister uses the server register-analysis endpoint and stores returned trace in runtime memory', async () => {
  const fetchCalls = [];
  const service = loadService({
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'live',
          summary: 'Server-owned register analysis summary',
          risks: [
            {
              title: 'Privileged access review weakness',
              category: 'Identity & Access',
              description: 'Stale access review activity is visible in the register.',
              confidence: 'high',
              source: 'ai+register'
            }
          ],
          trace: {
            label: 'Step 2 register analysis',
            promptSummary: 'Server prompt summary',
            response: 'Server returned register shortlist'
          }
        })
      };
    }
  });

  const result = await service.analyseRiskRegister({
    registerText: '  Privileged access review is incomplete and stale.  \n\n Third-party dependency control is weak. ',
    registerMeta: {
      extension: ' CSV ',
      sheetSelectionMode: ' all_sheets ',
      sheets: [{ sheetName: 'Risk Register', rowCount: 2 }]
    },
    businessUnit: {
      name: ' Technology ',
      selectedDepartmentKey: ' iam ',
      notes: '  Access reviews lag quarterly. '
    },
    adminSettings: {
      adminContextSummary: '  Imported from IAM register ',
      benchmarkStrategy: '  Use identity comparators first ',
      debugOnly: 'drop-me'
    },
    citations: [{ title: ' Identity policy ', note: '  Review access quarterly. ' }],
    priorMessages: [{ role: ' user ', content: '  shortlist identity items  ' }],
    traceLabel: ' Step 2 register analysis '
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/register-analysis');
  assert.equal(fetchCalls[0].options.method, 'POST');
  assert.equal(fetchCalls[0].options.headers['x-session-token'], 'session-token');
  const requestBody = JSON.parse(fetchCalls[0].options.body);
  assert.equal(requestBody.registerText, 'Privileged access review is incomplete and stale.\n\nThird-party dependency control is weak.');
  assert.deepEqual(requestBody.registerMeta, {
    extension: 'csv',
    sheetSelectionMode: 'all_sheets'
  });
  assert.deepEqual(requestBody.businessUnit, {
    name: 'Technology',
    selectedDepartmentKey: 'iam',
    notes: 'Access reviews lag quarterly.'
  });
  assert.deepEqual(requestBody.adminSettings, {
    adminContextSummary: 'Imported from IAM register',
    benchmarkStrategy: 'Use identity comparators first'
  });
  assert.deepEqual(requestBody.citations, [{
    title: 'Identity policy',
    excerpt: 'Review access quarterly.'
  }]);
  assert.deepEqual(requestBody.priorMessages, [{ role: 'user', content: 'shortlist identity items' }]);
  assert.equal(requestBody.traceLabel, 'Step 2 register analysis');
  assert.equal(result.mode, 'live');
  assert.equal(Array.isArray(result.risks), true);
  assert.equal(service.getLatestTrace('Step 2 register analysis')?.response, 'Server returned register shortlist');
});

test('analyseRiskRegister still uses the server register-analysis endpoint even when local-dev direct Compass config is enabled', async () => {
  const fetchCalls = [];
  const service = loadService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          summary: 'Fallback register analysis',
          usedFallback: true,
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

  await service.analyseRiskRegister({
    registerText: 'Third-party dependency control is weak.'
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://risk-calculator-eight.vercel.app/api/ai/register-analysis');
});
