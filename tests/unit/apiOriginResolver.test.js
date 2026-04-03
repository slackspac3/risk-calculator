'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ApiOriginResolver = require('../../assets/services/apiOriginResolver.js');

test('GitHub Pages frontend uses the configured hosted API origin', () => {
  const windowRef = {
    location: { origin: 'https://slackspac3.github.io' },
    __RISK_CALCULATOR_RELEASE__: {
      apiOrigin: 'https://api.example.test'
    }
  };

  assert.equal(
    ApiOriginResolver.resolveApiUrl('/api/ai/status', { windowRef }),
    'https://api.example.test/api/ai/status'
  );
});

test('explicit browser API origin override wins over release metadata', () => {
  const windowRef = {
    location: { origin: 'https://slackspac3.github.io' },
    __RISK_API_ORIGIN__: 'https://override.example.test',
    __RISK_CALCULATOR_RELEASE__: {
      apiOrigin: 'https://api.example.test'
    }
  };

  assert.equal(
    ApiOriginResolver.resolveApiUrl('/api/settings', { windowRef }),
    'https://override.example.test/api/settings'
  );
});

test('Vercel-hosted frontend keeps same-origin API routing', () => {
  const windowRef = {
    location: { origin: 'https://risk-calculator-preview.vercel.app' },
    __RISK_CALCULATOR_RELEASE__: {
      apiOrigin: 'https://api.example.test'
    }
  };

  assert.equal(
    ApiOriginResolver.resolveApiUrl('/api/compass', { windowRef }),
    'https://risk-calculator-preview.vercel.app/api/compass'
  );
});

test('invalid configured origin falls back to the default hosted backend origin', () => {
  const windowRef = {
    location: { origin: 'https://slackspac3.github.io' },
    __RISK_API_ORIGIN__: 'not a url',
    __RISK_CALCULATOR_RELEASE__: {
      apiOrigin: 'still not a url'
    }
  };

  assert.equal(
    ApiOriginResolver.resolveApiUrl('/api/users', { windowRef }),
    `${ApiOriginResolver.DEFAULT_API_ORIGIN}/api/users`
  );
});
