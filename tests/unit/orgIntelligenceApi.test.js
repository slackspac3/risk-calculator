'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const kvStore = new Map();
const originalFetch = global.fetch;

process.env.KV_REST_API_URL = 'https://example.test/kv';
process.env.KV_REST_API_TOKEN = 'test-token';
process.env.SESSION_SIGNING_SECRET = 'test-signing-secret';

global.fetch = async (_url, options = {}) => {
  const body = JSON.parse(String(options.body || '[]'));
  const [command, key, value] = body;
  if (command === 'GET') {
    return {
      ok: true,
      json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null })
    };
  }
  if (command === 'SET') {
    kvStore.set(key, value);
    return {
      ok: true,
      json: async () => ({ result: 'OK' })
    };
  }
  throw new Error(`Unsupported KV command: ${command}`);
};

const handler = require('../../api/org-intelligence');
const { readUserState } = require('../../api/user-state');

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
    end() {
      return this;
    }
  };
}

test.beforeEach(() => {
  kvStore.clear();
});

test.after(() => {
  global.fetch = originalFetch;
});

test('org intelligence stores and returns AI feedback events', async () => {
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });

  const postRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': token
    },
    body: {
      type: 'record_feedback',
      feedback: {
        target: 'shortlist',
        score: 4,
        runtimeMode: 'live_ai',
        buId: 'corp-fin',
        functionKey: 'finance',
        lensKey: 'financial',
        reasons: ['useful-with-edits'],
        shownRiskTitles: ['Counterparty default and bad-debt exposure'],
        citations: [{ docId: 'doc-fin-1', tags: ['financial'] }]
      }
    }
  }, postRes);

  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.payload.ok, true);
  assert.equal(postRes.payload.feedback.events.length, 1);
  assert.equal(postRes.payload.feedback.events[0].submittedBy, 'alex');

  const getRes = createRes();
  await handler({
    method: 'GET',
    headers: {
      'x-session-token': token
    }
  }, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.payload.feedback.events.length, 1);
  assert.equal(getRes.payload.feedback.events[0].lensKey, 'financial');
});

test('org intelligence stores per-risk AI feedback events with the explicit risk context', async () => {
  const token = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });

  const postRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': token
    },
    body: {
      type: 'record_feedback',
      feedback: {
        target: 'risk',
        score: 5,
        runtimeMode: 'live_ai',
        buId: 'corp-ops',
        functionKey: 'operations',
        lensKey: 'operational',
        riskId: 'risk-ops-1',
        riskTitle: 'Business continuity and recovery failure',
        riskCategory: 'Business Continuity',
        riskSource: 'ai',
        selectedInAssessment: true
      }
    }
  }, postRes);

  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.payload.ok, true);
  assert.equal(postRes.payload.feedback.events.length, 1);
  assert.equal(postRes.payload.feedback.events[0].target, 'risk');
  assert.equal(postRes.payload.feedback.events[0].riskTitle, 'Business continuity and recovery failure');
  assert.equal(postRes.payload.feedback.events[0].selectedInAssessment, true);
});

test('org intelligence reset_feedback requires admin and can clear shared and user-tier feedback', async () => {
  const userToken = buildSessionToken({
    username: 'alex',
    role: 'user',
    exp: Date.now() + 60_000
  });
  const adminToken = buildSessionToken({
    username: 'admin',
    role: 'admin',
    exp: Date.now() + 60_000
  });
  kvStore.set('risk_calculator_users', JSON.stringify([
    {
      username: 'alex',
      displayName: 'Alex',
      role: 'user',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      passwordVersion: 'scrypt-v1'
    },
    {
      username: 'maya',
      displayName: 'Maya',
      role: 'user',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      passwordVersion: 'scrypt-v1'
    }
  ]));
  kvStore.set('risk_calculator_user_state__alex', JSON.stringify({
    _meta: { revision: 1, updatedAt: Date.now() },
    learningStore: {
      aiFeedback: {
        events: [
          {
            id: 'user-feedback-1',
            target: 'draft',
            score: 2,
            runtimeMode: 'live_ai',
            lensKey: 'cyber'
          }
        ]
      },
      scenarioPatterns: [{ id: 'pattern-1', title: 'Keep me' }]
    }
  }));
  kvStore.set('risk_calculator_user_state__maya', JSON.stringify({
    _meta: { revision: 3, updatedAt: Date.now() },
    learningStore: {
      aiFeedback: {
        events: [
          {
            id: 'user-feedback-2',
            target: 'risk',
            score: 1,
            runtimeMode: 'live_ai',
            lensKey: 'operational'
          }
        ]
      }
    }
  }));

  const seedRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': userToken
    },
    body: {
      type: 'record_feedback',
      feedback: {
        target: 'draft',
        score: 4,
        runtimeMode: 'live_ai',
        lensKey: 'cyber'
      }
    }
  }, seedRes);
  assert.equal(seedRes.statusCode, 200);

  const forbiddenRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': userToken
    },
    body: {
      type: 'reset_feedback'
    }
  }, forbiddenRes);
  assert.equal(forbiddenRes.statusCode, 403);

  const resetRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': adminToken
    },
    body: {
      type: 'reset_feedback',
      includeUserTier: true
    }
  }, resetRes);

  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.payload.ok, true);
  assert.deepEqual(resetRes.payload.feedback.events, []);
  assert.equal(resetRes.payload.resetScope, 'platform');
  assert.equal(resetRes.payload.userTierReset.clearedUsers, 2);
  assert.equal(resetRes.payload.userTierReset.failedUsers.length, 0);

  const getRes = createRes();
  await handler({
    method: 'GET',
    headers: {
      'x-session-token': adminToken
    }
  }, getRes);
  assert.equal(getRes.statusCode, 200);
  assert.deepEqual(getRes.payload.feedback.events, []);

  const alexState = await readUserState('alex');
  const mayaState = await readUserState('maya');
  assert.deepEqual(alexState.learningStore.aiFeedback.events, []);
  assert.deepEqual(mayaState.learningStore.aiFeedback.events, []);
  assert.equal(Array.isArray(alexState.learningStore.scenarioPatterns), true);
  assert.equal(alexState.learningStore.scenarioPatterns.length, 1);
});
