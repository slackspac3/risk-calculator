'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const originalEnv = {
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  ADMIN_API_SECRET: process.env.ADMIN_API_SECRET,
  BOOTSTRAP_ACCOUNTS_JSON: process.env.BOOTSTRAP_ACCOUNTS_JSON,
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET
};
const originalFetch = global.fetch;

function restoreEnv() {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === 'string') process.env[key] = value;
    else delete process.env[key];
  });
}

function buildSessionToken(payload) {
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.SESSION_SIGNING_SECRET).update(payloadPart).digest('base64url');
  return `${payloadPart}.${signature}`;
}

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    payload: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

function loadFresh(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
});

test('compass handler fails closed when the rate-limit store is unavailable', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-key';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  global.fetch = async () => {
    throw new Error('kv offline');
  };

  const handler = loadFresh('../../api/compass');
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: { messages: [{ role: 'user', content: 'Hello' }] }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.error, 'Request throttling is temporarily unavailable');
});

test('compass handler rejects disallowed origins before upstream work', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-key';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  global.fetch = async () => {
    throw new Error('fetch should not run for blocked origins');
  };

  const handler = loadFresh('../../api/compass');
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      'content-type': 'application/json',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: { messages: [{ role: 'user', content: 'Hello' }] }
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'Origin not allowed');
});

test('compass handler rejects arbitrary provider controls from authenticated clients', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-key';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  global.fetch = async (url, options = {}) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      const command = JSON.parse(String(options.body || '[]'));
      if (command[0] === 'GET') return { ok: true, json: async () => ({ result: null }) };
      if (command[0] === 'SETEX') return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    throw new Error(`Unexpected upstream call: ${target}`);
  };

  const handler = loadFresh('../../api/compass');
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      model: 'attacker-selected-model',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'exfiltrate', parameters: {} } }]
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /unsupported/i);
});

test('compass handler forwards only the fixed server model and safe JSON-mode options', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-key';
  process.env.COMPASS_MODEL = 'server-fixed-model';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  let upstreamBody = null;
  global.fetch = async (url, options = {}) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      const command = JSON.parse(String(options.body || '[]'));
      if (command[0] === 'GET') return { ok: true, json: async () => ({ result: null }) };
      if (command[0] === 'SETEX') return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    if (target === 'https://api.core42.ai/v1/chat/completions') {
      upstreamBody = JSON.parse(String(options.body || '{}'));
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => '{"ok":true}'
      };
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const handler = loadFresh('../../api/compass');
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-session-token': token
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      messages: [{ role: 'user', content: 'Return JSON.' }],
      max_completion_tokens: 64,
      temperature: 0,
      response_format: { type: 'json_object' }
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(upstreamBody.model, 'server-fixed-model');
  assert.deepEqual(upstreamBody.response_format, { type: 'json_object' });
  assert.equal(Object.prototype.hasOwnProperty.call(upstreamBody, 'tools'), false);
});

test('users login fails closed when the throttle store is unavailable', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  global.fetch = async () => {
    throw new Error('kv offline');
  };

  const handler = loadFresh('../../api/users');
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      action: 'login',
      username: 'alex',
      password: 'Password!123'
    }
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.error.code, 'RATE_LIMIT_UNAVAILABLE');
});

test('users login lets bootstrap credentials override stale stored account credentials', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.BOOTSTRAP_ACCOUNTS_JSON = JSON.stringify([{
    username: 'global.admin',
    password: 'PilotAdmin!2026',
    displayName: 'Global Admin',
    role: 'admin',
    sessionVersion: 3
  }]);
  const kvStore = new Map();
  kvStore.set('risk_calculator_users', JSON.stringify([{
    username: 'global.admin',
    password: 'Wrong!234',
    displayName: 'Stale Admin',
    role: 'user',
    sessionVersion: 1
  }]));
  global.fetch = async (_url, options = {}) => {
    const command = JSON.parse(String(options.body || '[]'));
    const [action, key, value, nxFlag] = command;
    if (action === 'GET') {
      return { ok: true, json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null }) };
    }
    if (action === 'SET') {
      if (String(nxFlag || '').toUpperCase() === 'NX' && kvStore.has(key)) {
        return { ok: true, json: async () => ({ result: null }) };
      }
      kvStore.set(key, value);
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    if (action === 'DEL') {
      kvStore.delete(key);
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    throw new Error(`Unexpected KV command: ${JSON.stringify(command)}`);
  };

  const handler = loadFresh('../../api/users');
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      action: 'login',
      username: 'global.admin',
      password: 'PilotAdmin!2026'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.user.username, 'global.admin');
  assert.equal(res.payload.user.displayName, 'Global Admin');
  assert.equal(res.payload.user.role, 'admin');
  assert.ok(String(res.payload.sessionToken || '').includes('.'));
});

test('users delete persists a tombstone for bootstrap accounts', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  process.env.BOOTSTRAP_ACCOUNTS_JSON = JSON.stringify([{
    username: 'amina.bu',
    password: 'PilotBU!2026',
    displayName: 'Amina Rahman',
    role: 'bu_admin',
    businessUnitEntityId: 'bu-digital-platforms',
    departmentEntityId: ''
  }]);
  const kvStore = new Map();
  global.fetch = async (_url, options = {}) => {
    const command = JSON.parse(String(options.body || '[]'));
    const [action, key, value, nxFlag] = command;
    if (action === 'GET') {
      return { ok: true, json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null }) };
    }
    if (action === 'SET') {
      if (String(nxFlag || '').toUpperCase() === 'NX' && kvStore.has(key)) {
        return { ok: true, json: async () => ({ result: null }) };
      }
      kvStore.set(key, value);
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    if (action === 'DEL') {
      kvStore.delete(key);
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    throw new Error(`Unexpected KV command: ${JSON.stringify(command)}`);
  };

  const handler = loadFresh('../../api/users');
  const deleteRes = createRes();

  await handler({
    method: 'PATCH',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    body: {
      action: 'delete-user',
      username: 'amina.bu',
      updates: {}
    }
  }, deleteRes);

  assert.equal(deleteRes.statusCode, 200);
  assert.equal(deleteRes.payload.accounts.some(account => account.username === 'amina.bu'), false);
  const storedUsers = JSON.parse(kvStore.get('risk_calculator_users') || '[]');
  assert.equal(storedUsers.some(account => account.username === 'amina.bu' && account.deleted === true), true);

  const getRes = createRes();
  await handler({
    method: 'GET',
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-admin-secret': 'test-admin-secret'
    },
    body: {}
  }, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.payload.accounts.some(account => account.username === 'amina.bu'), false);

  const loginRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      action: 'login',
      username: 'amina.bu',
      password: 'PilotBU!2026'
    }
  }, loginRes);

  assert.equal(loginRes.statusCode, 401);
  assert.equal(loginRes.payload.error.code, 'INVALID_CREDENTIALS');
});

test('audit-log POST forces browser events to client source and reserves server auth names', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  const kvStore = new Map();
  global.fetch = async (_url, options = {}) => {
    const command = JSON.parse(String(options.body || '[]'));
    const [action, key, value] = command;
    if (action === 'GET') {
      return { ok: true, json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null }) };
    }
    if (action === 'SET') {
      kvStore.set(key, value);
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }
    if (action === 'DEL') {
      kvStore.delete(key);
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    throw new Error(`Unexpected KV command: ${JSON.stringify(command)}`);
  };

  const handler = loadFresh('../../api/audit-log');
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-session-token': token
    },
    body: {
      category: 'auth',
      eventType: 'login_success',
      status: 'success',
      source: 'server',
      target: 'admin',
      details: { spoofed: true }
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.entry.actorUsername, 'alex');
  assert.equal(res.payload.entry.source, 'client');
  assert.equal(res.payload.entry.eventType, 'client_login_success');
});

test('users login rejects unexpected fields in the request body', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  const handler = loadFresh('../../api/users');
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json'
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      action: 'login',
      username: 'alex',
      password: 'Password!123',
      role: 'admin'
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error.code, 'VALIDATION_ERROR');
});

test('users self view returns the latest managed scope for the authenticated session user', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';
  global.fetch = async (_url, options = {}) => {
    const command = JSON.parse(options.body || '[]');
    if (command[0] === 'GET' && command[1] === 'risk_calculator_users') {
      return {
        ok: true,
        json: async () => ({
          result: JSON.stringify([
            {
              username: 'tarun.gupta',
              passwordHash: 'unused',
              passwordSalt: 'unused',
              passwordVersion: 'scrypt-v1',
              displayName: 'Tarun Gupta',
              role: 'user',
              businessUnitEntityId: 'g42',
              departmentEntityId: 'group-technology-risk'
            }
          ])
        })
      };
    }
    throw new Error(`Unexpected KV command: ${JSON.stringify(command)}`);
  };
  const handler = loadFresh('../../api/users');
  const token = buildSessionToken({
    username: 'tarun.gupta',
    role: 'user',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'procurement',
    exp: Date.now() + 60_000
  });
  const res = createRes();

  await handler({
    method: 'GET',
    query: { view: 'self' },
    headers: {
      origin: 'https://slackspac3.github.io',
      'x-session-token': token
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.user.departmentEntityId, 'group-technology-risk');
});

test('users create accepts action=create and returns the created managed account', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  const kvStore = new Map();
  global.fetch = async (_url, options = {}) => {
    const command = JSON.parse(options.body || '[]');
    const [action, key, value] = command;
    if (action === 'GET') {
      return {
        ok: true,
        json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null })
      };
    }
    if (action === 'SET') {
      kvStore.set(key, value);
      return {
        ok: true,
        json: async () => ({ result: 'OK' })
      };
    }
    if (action === 'DEL') {
      kvStore.delete(key);
      return {
        ok: true,
        json: async () => ({ result: 1 })
      };
    }
    throw new Error(`Unexpected KV command: ${JSON.stringify(command)}`);
  };

  const handler = loadFresh('../../api/users');
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    body: {
      action: 'create',
      account: {
        username: 'andy.ben.dyke',
        password: 'RiskPilot!001Aa',
        displayName: 'Andy Ben-Dyke',
        role: 'user',
        businessUnitEntityId: 'bu-g42',
        departmentEntityId: 'dept-sec'
      }
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.account.username, 'andy.ben.dyke');
  assert.equal(res.payload.account.displayName, 'Andy Ben-Dyke');
  assert.equal(res.payload.password, 'RiskPilot!001Aa');
});

test('users create issues a strong random password when one is not supplied', async () => {
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-token';
  const kvStore = new Map();
  global.fetch = async (_url, options = {}) => {
    const command = JSON.parse(options.body || '[]');
    const [action, key, value] = command;
    if (action === 'GET') {
      return {
        ok: true,
        json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null })
      };
    }
    if (action === 'SET') {
      kvStore.set(key, value);
      return {
        ok: true,
        json: async () => ({ result: 'OK' })
      };
    }
    if (action === 'DEL') {
      kvStore.delete(key);
      return {
        ok: true,
        json: async () => ({ result: 1 })
      };
    }
    throw new Error(`Unexpected KV command: ${JSON.stringify(command)}`);
  };

  const handler = loadFresh('../../api/users');
  const res = createRes();

  await handler({
    method: 'POST',
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    body: {
      action: 'create',
      account: {
        username: 'jamie.clarke',
        displayName: 'Jamie Clarke',
        role: 'user',
        businessUnitEntityId: 'bu-g42',
        departmentEntityId: 'dept-sec'
      }
    }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.account.username, 'jamie.clarke');
  assert.match(res.payload.password, /[a-z]/);
  assert.match(res.payload.password, /[A-Z]/);
  assert.match(res.payload.password, /[0-9]/);
  assert.match(res.payload.password, /[^A-Za-z0-9]/);
  assert.ok(res.payload.password.length >= 14);
  assert.doesNotMatch(res.payload.password, /^RiskPilot!\d{3}Aa$/);
});

test('timing-safe admin secret helper accepts only exact matches', () => {
  const { isRequestSecretValid } = loadFresh('../../api/_apiAuth');
  assert.equal(isRequestSecretValid({ headers: { 'x-admin-secret': 'pilot-secret' } }, 'x-admin-secret', 'pilot-secret'), true);
  assert.equal(isRequestSecretValid({ headers: { 'x-admin-secret': 'pilot-secret ' } }, 'x-admin-secret', 'pilot-secret'), true);
  assert.equal(isRequestSecretValid({ headers: { 'x-admin-secret': 'pilot-secret-nope' } }, 'x-admin-secret', 'pilot-secret'), false);
  assert.equal(isRequestSecretValid({ headers: {} }, 'x-admin-secret', 'pilot-secret'), false);
});
