'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmServiceContext } = require('./helpers/loadLlmServiceHarness');

function loadTraceRuntime() {
  const forbiddenStorage = {
    getItem() {
      throw new Error('trace runtime test should not read browser storage');
    },
    setItem() {
      throw new Error('trace runtime test should not write browser storage');
    },
    removeItem() {
      throw new Error('trace runtime test should not remove browser storage');
    }
  };

  const context = loadLlmServiceContext({
    origin: 'https://slackspac3.github.io',
    fetchImpl: async () => {
      throw new Error('fetch should not be called in llmTraceRuntime.test.js');
    },
    sessionStorage: forbiddenStorage,
    localStorage: forbiddenStorage,
    transformLlmService(source) {
      return source.replace(
        '  return {\n    buildGuidedScenarioDraft,',
        '  globalThis.__llmTraceInternals = { _storeAiTraceEntry, _readAiTrace };\n\n  return {\n    buildGuidedScenarioDraft,'
      );
    }
  });
  return {
    service: context.__llmService,
    internals: context.__llmTraceInternals
  };
}

test('AI traces stay in runtime memory and do not require browser storage', () => {
  const { service, internals } = loadTraceRuntime();
  const traceEntry = internals._storeAiTraceEntry({
    label: 'Step 2 guided draft',
    promptSummary: 'System: classify the scenario.\n\nUser: Azure admin credentials found on the dark web.',
    response: 'High-urgency Cyber scenario: Privileged credentials are actively exposed.',
    sources: [
      {
        title: 'Identity source',
        url: 'https://example.com/source',
        sourceType: 'rag',
        relevanceReason: 'Recent identity exposure reference'
      }
    ]
  });

  assert.equal(typeof traceEntry?.id, 'string');
  assert.equal(internals._readAiTrace().length, 1);
  assert.deepEqual(service.getLatestTrace('Step 2 guided draft'), traceEntry);
  assert.equal(service.getLatestTrace('Missing trace'), null);
});
