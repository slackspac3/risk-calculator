'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validatePasswordPolicy, generateStrongPassword } = require('../../api/_passwordPolicy');
const { buildErrorPayload } = require('../../api/_apiAuth');

test('validatePasswordPolicy rejects weak passwords and accepts generated passwords', () => {
  const weak = validatePasswordPolicy('weakpass');
  assert.equal(weak.valid, false);
  assert.ok(weak.issues.length >= 1);

  const strong = validatePasswordPolicy(generateStrongPassword());
  assert.equal(strong.valid, true);
  assert.deepEqual(strong.issues, []);
});

test('buildErrorPayload returns the safe API error schema', () => {
  const payload = buildErrorPayload('SESSION_EXPIRED', 'Your session expired. Please sign in again.', { retryAfterSeconds: 60 });
  assert.deepEqual(payload, {
    error: {
      code: 'SESSION_EXPIRED',
      message: 'Your session expired. Please sign in again.'
    },
    retryAfterSeconds: 60
  });
});
