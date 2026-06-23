'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { validatePasswordPolicy, generateStrongPassword } = require('../../api/_passwordPolicy');
const { buildErrorPayload, readAccountsDirectory, validateSessionFromRequest } = require('../../api/_apiAuth');
const { parseSessionToken } = require('../../api/_audit');

test('validatePasswordPolicy rejects weak passwords and accepts generated passwords', () => {
  const weak = validatePasswordPolicy('weakpass');
  assert.equal(weak.valid, false);
  assert.ok(weak.issues.length >= 1);

  const first = generateStrongPassword();
  const second = generateStrongPassword();
  const firstCheck = validatePasswordPolicy(first);
  const secondCheck = validatePasswordPolicy(second);
  assert.equal(firstCheck.valid, true);
  assert.deepEqual(firstCheck.issues, []);
  assert.equal(secondCheck.valid, true);
  assert.deepEqual(secondCheck.issues, []);
  assert.notEqual(first, second);
  assert.ok(first.length >= 14);
  assert.ok(second.length >= 14);
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

test('parseSessionToken accepts valid signed tokens and rejects tampering', () => {
  const originalSecret = process.env.SESSION_SIGNING_SECRET;
  process.env.SESSION_SIGNING_SECRET = 'unit-test-signing-secret';
  try {
    const payload = {
      username: 'alex',
      role: 'admin',
      exp: Date.now() + 60_000
    };
    const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(payloadPart).digest('base64url');
    const token = `${payloadPart}.${signature}`;
    const parsed = parseSessionToken(token);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.payload.username, 'alex');

    const tampered = parseSessionToken(`${payloadPart}.tampered`);
    assert.equal(tampered.valid, false);
    assert.equal(tampered.reason, 'invalid');
  } finally {
    if (typeof originalSecret === 'string') process.env.SESSION_SIGNING_SECRET = originalSecret;
    else delete process.env.SESSION_SIGNING_SECRET;
  }
});

test('parseSessionToken does not fall back to ADMIN_API_SECRET', () => {
  const originalSecret = process.env.SESSION_SIGNING_SECRET;
  const originalAdminSecret = process.env.ADMIN_API_SECRET;
  delete process.env.SESSION_SIGNING_SECRET;
  process.env.ADMIN_API_SECRET = 'admin-secret-is-not-a-session-secret';
  try {
    const payloadPart = Buffer.from(JSON.stringify({
      username: 'alex',
      role: 'admin',
      exp: Date.now() + 60_000
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.ADMIN_API_SECRET).update(payloadPart).digest('base64url');
    const parsed = parseSessionToken(`${payloadPart}.${signature}`);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.reason, 'unconfigured');
  } finally {
    if (typeof originalSecret === 'string') process.env.SESSION_SIGNING_SECRET = originalSecret;
    else delete process.env.SESSION_SIGNING_SECRET;
    if (typeof originalAdminSecret === 'string') process.env.ADMIN_API_SECRET = originalAdminSecret;
    else delete process.env.ADMIN_API_SECRET;
  }
});

test('validateSessionFromRequest rehydrates current account scope and revokes mismatched session versions', async () => {
  const originalSecret = process.env.SESSION_SIGNING_SECRET;
  const originalKvUrl = process.env.KV_REST_API_URL;
  const originalKvToken = process.env.KV_REST_API_TOKEN;
  const originalFetch = global.fetch;
  process.env.SESSION_SIGNING_SECRET = 'unit-test-signing-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(String(options.body || '[]'));
    const [command, key] = body;
    assert.equal(command, 'GET');
    assert.equal(key, 'risk_calculator_users');
    return {
      ok: true,
      json: async () => ({
        result: JSON.stringify([
          {
            username: 'alex',
            displayName: 'Alex',
            role: 'user',
            businessUnitEntityId: 'g42',
            departmentEntityId: 'ops',
            sessionVersion: 2
          }
        ])
      })
    };
  };
  try {
    const payloadPart = Buffer.from(JSON.stringify({
      username: 'alex',
      role: 'admin',
      businessUnitEntityId: 'legacy',
      departmentEntityId: 'legacy',
      sv: 2,
      exp: Date.now() + 60_000
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(payloadPart).digest('base64url');
    const validation = await validateSessionFromRequest({
      headers: {
        'x-session-token': `${payloadPart}.${signature}`
      }
    });
    assert.equal(validation.error, null);
    assert.equal(validation.session.role, 'user');
    assert.equal(validation.session.businessUnitEntityId, 'g42');
    assert.equal(validation.session.departmentEntityId, 'ops');

    const stalePayloadPart = Buffer.from(JSON.stringify({
      username: 'alex',
      role: 'user',
      sv: 1,
      exp: Date.now() + 60_000
    })).toString('base64url');
    const staleSignature = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(stalePayloadPart).digest('base64url');
    const staleValidation = await validateSessionFromRequest({
      headers: {
        'x-session-token': `${stalePayloadPart}.${staleSignature}`
      }
    });
    assert.equal(staleValidation.session, null);
    assert.equal(staleValidation.error?.code, 'SESSION_EXPIRED');
  } finally {
    global.fetch = originalFetch;
    if (typeof originalSecret === 'string') process.env.SESSION_SIGNING_SECRET = originalSecret;
    else delete process.env.SESSION_SIGNING_SECRET;
    if (typeof originalKvUrl === 'string') process.env.KV_REST_API_URL = originalKvUrl;
    else delete process.env.KV_REST_API_URL;
    if (typeof originalKvToken === 'string') process.env.KV_REST_API_TOKEN = originalKvToken;
    else delete process.env.KV_REST_API_TOKEN;
  }
});

test('readAccountsDirectory lets bootstrap accounts override stored managed accounts', async () => {
  const originalBootstrap = process.env.BOOTSTRAP_ACCOUNTS_JSON;
  const originalKvUrl = process.env.KV_REST_API_URL;
  const originalKvToken = process.env.KV_REST_API_TOKEN;
  const originalFetch = global.fetch;
  process.env.BOOTSTRAP_ACCOUNTS_JSON = JSON.stringify([{
    username: 'global.admin',
    displayName: 'Global Admin',
    role: 'admin',
    sessionVersion: 7
  }]);
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  global.fetch = async (_url, options = {}) => {
    const [command, key] = JSON.parse(String(options.body || '[]'));
    assert.equal(command, 'GET');
    assert.equal(key, 'risk_calculator_users');
    return {
      ok: true,
      json: async () => ({
        result: JSON.stringify([{
          username: 'global.admin',
          displayName: 'Stale Admin',
          role: 'user',
          sessionVersion: 1
        }])
      })
    };
  };
  try {
    const { accounts, enforce } = await readAccountsDirectory();
    const admin = accounts.find(account => account.username === 'global.admin');
    assert.equal(enforce, true);
    assert.equal(admin.role, 'admin');
    assert.equal(admin.displayName, 'Global Admin');
    assert.equal(admin.sessionVersion, 7);
  } finally {
    global.fetch = originalFetch;
    if (typeof originalBootstrap === 'string') process.env.BOOTSTRAP_ACCOUNTS_JSON = originalBootstrap;
    else delete process.env.BOOTSTRAP_ACCOUNTS_JSON;
    if (typeof originalKvUrl === 'string') process.env.KV_REST_API_URL = originalKvUrl;
    else delete process.env.KV_REST_API_URL;
    if (typeof originalKvToken === 'string') process.env.KV_REST_API_TOKEN = originalKvToken;
    else delete process.env.KV_REST_API_TOKEN;
  }
});
