'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

test('buildCompanyContext throws when the hosted company-context route is unavailable instead of fabricating a local draft', async () => {
  const fetchCalls = [];
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      throw new Error('fetch should not run when the hosted company-context route is unavailable');
    }
  });

  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: 'browser-secret'
  });

  await assert.rejects(
    () => service.buildCompanyContext('https://example.com'),
    (error) => {
      assert.equal(error?.code, 'LLM_UNAVAILABLE');
      assert.match(String(error?.message || ''), /company-context building is unavailable/i);
      return true;
    }
  );

  assert.equal(fetchCalls.length, 0);
});

test('buildCompanyContext preserves fallback provenance returned by the hosted route', async () => {
  const service = loadLlmService({
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({
        companySummary: 'Public-source fallback summary.',
        businessProfile: 'Fallback business profile.',
        operatingModel: 'Fallback operating model.',
        aiGuidance: 'Review manually.',
        usedFallback: true,
        aiUnavailable: true,
        responseMessage: 'Live AI was unavailable.'
      })
    })
  });

  const result = await service.buildCompanyContext('https://example.com');

  assert.equal(result.usedFallback, true);
  assert.equal(result.aiEnvelope.fallbackUsed, true);
  assert.equal(result.aiUnavailable, true);
});

test('buildUserPreferenceAssist keeps the current settings unchanged when live AI is unavailable', async () => {
  const fetchCalls = [];
  const service = loadLlmService({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      throw new Error('fetch should not run for the direct-config no-key continuity path');
    }
  });

  service.setCompassConfig({
    apiUrl: 'https://api.core42.ai/v1/chat/completions',
    model: 'gpt-local-test',
    apiKey: ''
  });

  const result = await service.buildUserPreferenceAssist({
    userProfile: {
      workingContext: 'Current working context',
      preferredOutputs: 'Current preferred outputs'
    },
    currentSettings: {
      aiInstructions: 'Current AI instructions',
      adminContextSummary: 'Current personal defaults'
    }
  });

  assert.equal(result.aiUnavailable, true);
  assert.equal(result.continuityOnly, true);
  assert.equal(result.workingContext, 'Current working context');
  assert.equal(result.preferredOutputs, 'Current preferred outputs');
  assert.equal(result.aiInstructions, 'Current AI instructions');
  assert.equal(result.adminContextSummary, 'Current personal defaults');
  assert.match(String(result.responseMessage || ''), /kept unchanged/i);
  assert.equal(fetchCalls.length, 0);
});
