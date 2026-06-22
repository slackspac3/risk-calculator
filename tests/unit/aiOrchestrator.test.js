'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { callAi } = require('../../api/_aiOrchestrator');

const originalEnv = {
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  COMPASS_API_URL: process.env.COMPASS_API_URL,
  COMPASS_MODEL: process.env.COMPASS_MODEL
};
const originalFetch = global.fetch;

test.afterEach(() => {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === 'string') process.env[key] = value;
    else delete process.env[key];
  });
  global.fetch = originalFetch;
});

test('callAi forwards JSON response_format for structured workflows', async () => {
  process.env.COMPASS_API_KEY = 'test-key';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_MODEL = 'gpt-test';
  let requestBody = null;
  global.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(String(options.body || '{}'));
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }]
      })
    };
  };

  const result = await callAi('Return JSON only.', 'Build the object.', {
    responseFormat: { type: 'json_object' }
  });

  assert.equal(result.text, '{"ok":true}');
  assert.deepEqual(requestBody.response_format, { type: 'json_object' });
});
