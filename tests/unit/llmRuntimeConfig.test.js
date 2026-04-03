'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

function loadService(origin = 'https://slackspac3.github.io', { apiOrigin = 'https://risk-calculator-eight.vercel.app' } = {}) {
  return loadLlmService({
    origin,
    apiOrigin,
    fetchImpl: async () => {
      throw new Error('fetch should not be called in llmRuntimeConfig.test.js');
    }
  });
}

test('pilot and production origins ignore browser-direct Compass configuration', () => {
  const service = loadService('https://slackspac3.github.io');
  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: 'browser-secret'
  });

  const runtimeStatus = service.getRuntimeStatus();
  assert.equal(service.isLocalDevRuntimeConfigAllowed(), false);
  assert.equal(runtimeStatus.usingDirectCompass, false);
  assert.equal(runtimeStatus.hasApiKey, false);
  assert.equal(runtimeStatus.apiUrl.includes('/api/compass'), true);
  assert.equal(runtimeStatus.model, 'gpt-5.1');
});

test('localhost can still opt into direct Compass configuration for explicit local development', () => {
  const service = loadService('http://127.0.0.1:8080');
  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: 'browser-secret'
  });

  const runtimeStatus = service.getRuntimeStatus();
  assert.equal(service.isLocalDevRuntimeConfigAllowed(), true);
  assert.equal(runtimeStatus.usingDirectCompass, true);
  assert.equal(runtimeStatus.hasApiKey, true);
  assert.equal(runtimeStatus.model, 'gpt-local-test');
});

test('GitHub Pages runtime uses the configured hosted API origin for browser proxy calls', () => {
  const service = loadService('https://slackspac3.github.io', {
    apiOrigin: 'https://api.example.test'
  });

  const runtimeStatus = service.getRuntimeStatus();
  assert.equal(runtimeStatus.apiUrl, 'https://api.example.test/api/compass');
  assert.equal(runtimeStatus.usingProxy, true);
  assert.equal(runtimeStatus.usingDirectCompass, false);
});
