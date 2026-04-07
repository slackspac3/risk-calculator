'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const kvStore = new Map();
const originalFetch = global.fetch;

process.env.KV_REST_API_URL = 'https://example.test/kv';
process.env.KV_REST_API_TOKEN = 'test-token';
process.env.SESSION_SIGNING_SECRET = 'review-queue-test-secret';

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
  if (command === 'DEL') {
    kvStore.delete(key);
    return {
      ok: true,
      json: async () => ({ result: 1 })
    };
  }
  throw new Error(`Unsupported KV command: ${command}`);
};

const handler = require('../../api/review-queue');

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
  kvStore.set('risk_calculator_users', JSON.stringify([
    {
      username: 'holding-admin',
      displayName: 'Holding Admin',
      role: 'admin',
      businessUnitEntityId: '',
      departmentEntityId: '',
      sessionVersion: 1
    },
    {
      username: 'analyst',
      displayName: 'Analyst',
      role: 'user',
      businessUnitEntityId: 'g42',
      departmentEntityId: 'technology',
      sessionVersion: 1
    },
    {
      username: 'legal-analyst',
      displayName: 'Legal Analyst',
      role: 'user',
      businessUnitEntityId: 'g42',
      departmentEntityId: 'legal',
      sessionVersion: 1
    },
    {
      username: 'bu-admin',
      displayName: 'BU Admin',
      role: 'bu_admin',
      businessUnitEntityId: 'g42',
      departmentEntityId: '',
      sessionVersion: 1
    },
    {
      username: 'other-bu-admin',
      displayName: 'Other BU Admin',
      role: 'bu_admin',
      businessUnitEntityId: 'other-bu',
      departmentEntityId: '',
      sessionVersion: 1
    },
    {
      username: 'function-admin',
      displayName: 'Function Admin',
      role: 'function_admin',
      businessUnitEntityId: 'g42',
      departmentEntityId: 'technology',
      sessionVersion: 1
    },
    {
      username: 'finance-function-admin',
      displayName: 'Finance Function Admin',
      role: 'function_admin',
      businessUnitEntityId: 'g42',
      departmentEntityId: 'finance',
      sessionVersion: 1
    }
  ]));
});

test.after(() => {
  global.fetch = originalFetch;
});

test('review queue exposes reviewer targets by session scope and falls back from function to BU when needed', async () => {
  const analystToken = buildSessionToken({
    username: 'analyst',
    role: 'user',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'technology',
    sv: 1,
    exp: Date.now() + 60_000
  });
  const analystTargetsRes = createRes();
  await handler({
    method: 'GET',
    query: {
      view: 'targets',
      action: 'submit'
    },
    headers: {
      'x-session-token': analystToken
    }
  }, analystTargetsRes);

  assert.equal(analystTargetsRes.statusCode, 200);
  assert.equal(analystTargetsRes.payload.defaultTargetUsername, 'function-admin');
  assert.deepEqual(Array.from(analystTargetsRes.payload.targets, item => item.username), ['function-admin']);

  const financeToken = buildSessionToken({
    username: 'legal-analyst',
    role: 'user',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'legal',
    sv: 1,
    exp: Date.now() + 60_000
  });
  const financeTargetsRes = createRes();
  await handler({
    method: 'GET',
    query: {
      view: 'targets',
      action: 'submit'
    },
    headers: {
      'x-session-token': financeToken
    }
  }, financeTargetsRes);

  assert.equal(financeTargetsRes.statusCode, 200);
  assert.equal(financeTargetsRes.payload.defaultTargetUsername, 'bu-admin');
  assert.deepEqual(Array.from(financeTargetsRes.payload.targets, item => item.username), [
    'bu-admin',
    'finance-function-admin',
    'function-admin'
  ]);

  const functionAdminToken = buildSessionToken({
    username: 'function-admin',
    role: 'function_admin',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'technology',
    sv: 1,
    exp: Date.now() + 60_000
  });
  const functionTargetsRes = createRes();
  await handler({
    method: 'GET',
    query: {
      view: 'targets',
      action: 'submit'
    },
    headers: {
      'x-session-token': functionAdminToken
    }
  }, functionTargetsRes);

  assert.equal(functionTargetsRes.statusCode, 200);
  assert.equal(functionTargetsRes.payload.defaultTargetUsername, 'bu-admin');
  assert.deepEqual(Array.from(functionTargetsRes.payload.targets, item => item.username), [
    'bu-admin',
    'function-admin',
    'finance-function-admin'
  ]);
});

test('review queue submission uses the session actor, stores the assignee, and rejects invalid targets', async () => {
  const token = buildSessionToken({
    username: 'analyst',
    role: 'user',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'technology',
    sv: 1,
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
      assignedReviewerUsername: 'function-admin',
      assessment: {
        id: 'assessment-1',
        submittedBy: 'impersonated-user',
        buId: 'wrong-bu',
        scenarioTitle: 'Tolerance breach',
        results: {
          toleranceBreached: true
        }
      },
      sharedAssessment: {
        id: 'assessment-1',
        scenarioTitle: 'Tolerance breach',
        buName: 'G42',
        narrative: 'A scenario snapshot for review.',
        results: {
          toleranceBreached: true
        }
      }
    }
  }, postRes);

  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.payload.item.submittedBy, 'analyst');
  assert.equal(postRes.payload.item.buId, 'g42');
  assert.equal(postRes.payload.item.departmentEntityId, 'technology');
  assert.equal(postRes.payload.item.assignedReviewerUsername, 'function-admin');
  assert.equal(postRes.payload.item.assignedReviewerDisplayName, 'Function Admin');
  assert.equal(postRes.payload.item.reviewScope, 'function');
  assert.equal(postRes.payload.item.sharedAssessment.scenarioTitle, 'Tolerance breach');
  const auditEntries = JSON.parse(kvStore.get('risk_calculator_audit_log') || '[]');
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].eventType, 'review_submitted');
  assert.equal(auditEntries[0].category, 'review_queue');
  assert.equal(auditEntries[0].actorUsername, 'analyst');
  assert.equal(auditEntries[0].details.assignedReviewerUsername, 'function-admin');

  const invalidTargetRes = createRes();
  await handler({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': token
    },
    body: {
      assignedReviewerUsername: 'holding-admin',
      assessment: {
        id: 'assessment-2',
        scenarioTitle: 'Wrong target'
      }
    }
  }, invalidTargetRes);

  assert.equal(invalidTargetRes.statusCode, 403);
});

test('review queue GET is visible to the submitter and assigned reviewer, but only the assignee can approve', async () => {
  kvStore.set('risk_calculator_review_queue', JSON.stringify([
    {
      id: 'rq-1',
      assessmentId: 'a-1',
      submittedBy: 'analyst',
      submittedByDisplayName: 'Analyst',
      submittedAt: Date.now(),
      buId: 'g42',
      buName: 'G42',
      departmentEntityId: 'technology',
      scenarioTitle: 'In-scope review',
      assignedReviewerUsername: 'function-admin',
      assignedReviewerDisplayName: 'Function Admin',
      assignedReviewerRole: 'function_admin',
      reviewScope: 'function',
      reviewStatus: 'pending',
      sharedAssessment: {
        id: 'a-1',
        scenarioTitle: 'In-scope review',
        results: {
          toleranceBreached: true
        }
      }
    },
    {
      id: 'rq-2',
      assessmentId: 'a-2',
      submittedBy: 'finance-analyst',
      submittedByDisplayName: 'Finance Analyst',
      submittedAt: Date.now(),
      buId: 'other-bu',
      buName: 'Other',
      departmentEntityId: 'finance',
      scenarioTitle: 'Out-of-scope review',
      assignedReviewerUsername: 'other-bu-admin',
      assignedReviewerDisplayName: 'Other BU Admin',
      assignedReviewerRole: 'bu_admin',
      reviewScope: 'business_unit',
      reviewStatus: 'pending'
    }
  ]));

  const analystToken = buildSessionToken({
    username: 'analyst',
    role: 'user',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'technology',
    sv: 1,
    exp: Date.now() + 60_000
  });
  const getRes = createRes();
  await handler({
    method: 'GET',
    headers: {
      'x-session-token': analystToken
    }
  }, getRes);

  assert.equal(getRes.statusCode, 200);
  assert.deepEqual(Array.from(getRes.payload.items, item => item.id), ['rq-1']);
  assert.equal(getRes.payload.items[0].currentUserCanReview, false);

  const forbiddenPatchRes = createRes();
  await handler({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-session-token': analystToken
    },
    body: {
      id: 'rq-1',
      reviewStatus: 'approved'
    }
  }, forbiddenPatchRes);
  assert.equal(forbiddenPatchRes.statusCode, 403);

  const functionAdminToken = buildSessionToken({
    username: 'function-admin',
    role: 'function_admin',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'technology',
    sv: 1,
    exp: Date.now() + 60_000
  });
  const assigneeGetRes = createRes();
  await handler({
    method: 'GET',
    headers: {
      'x-session-token': functionAdminToken
    }
  }, assigneeGetRes);

  assert.equal(assigneeGetRes.statusCode, 200);
  assert.deepEqual(Array.from(assigneeGetRes.payload.items, item => item.id), ['rq-1']);
  assert.equal(assigneeGetRes.payload.items[0].currentUserCanReview, true);

  const patchRes = createRes();
  await handler({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-session-token': functionAdminToken
    },
    body: {
      id: 'rq-1',
      reviewStatus: 'approved'
    }
  }, patchRes);

  assert.equal(patchRes.statusCode, 200);
  assert.equal(patchRes.payload.item.reviewedBy, 'function-admin');
});

test('BU heads can escalate in-scope items to holding-company reviewers without becoming the assignee', async () => {
  kvStore.set('risk_calculator_review_queue', JSON.stringify([
    {
      id: 'rq-1',
      assessmentId: 'a-1',
      submittedBy: 'function-admin',
      submittedByDisplayName: 'Function Admin',
      submittedAt: Date.now(),
      buId: 'g42',
      buName: 'G42',
      departmentEntityId: 'technology',
      scenarioTitle: 'Escalation candidate',
      assignedReviewerUsername: 'function-admin',
      assignedReviewerDisplayName: 'Function Admin',
      assignedReviewerRole: 'function_admin',
      reviewScope: 'function',
      reviewStatus: 'pending'
    }
  ]));

  const buAdminToken = buildSessionToken({
    username: 'bu-admin',
    role: 'bu_admin',
    businessUnitEntityId: 'g42',
    sv: 1,
    exp: Date.now() + 60_000
  });

  const buQueueRes = createRes();
  await handler({
    method: 'GET',
    headers: {
      'x-session-token': buAdminToken
    }
  }, buQueueRes);

  assert.equal(buQueueRes.statusCode, 200);
  assert.equal(buQueueRes.payload.items[0].currentUserCanReview, false);
  assert.equal(buQueueRes.payload.items[0].currentUserCanEscalate, true);

  const escalationTargetsRes = createRes();
  await handler({
    method: 'GET',
    query: {
      view: 'targets',
      action: 'escalate'
    },
    headers: {
      'x-session-token': buAdminToken
    }
  }, escalationTargetsRes);

  assert.equal(escalationTargetsRes.statusCode, 200);
  assert.deepEqual(Array.from(escalationTargetsRes.payload.targets, item => item.username), ['holding-admin']);

  const forbiddenApproveRes = createRes();
  await handler({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-session-token': buAdminToken
    },
    body: {
      id: 'rq-1',
      reviewStatus: 'approved'
    }
  }, forbiddenApproveRes);

  assert.equal(forbiddenApproveRes.statusCode, 403);

  const invalidEscalationRes = createRes();
  await handler({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-session-token': buAdminToken
    },
    body: {
      id: 'rq-1',
      reviewStatus: 'escalated',
      escalatedTo: 'function-admin'
    }
  }, invalidEscalationRes);

  assert.equal(invalidEscalationRes.statusCode, 403);

  const escalationRes = createRes();
  await handler({
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-session-token': buAdminToken
    },
    body: {
      id: 'rq-1',
      reviewStatus: 'escalated',
      escalatedTo: 'holding-admin'
    }
  }, escalationRes);

  assert.equal(escalationRes.statusCode, 200);
  assert.equal(escalationRes.payload.item.assignedReviewerUsername, 'holding-admin');
  assert.equal(escalationRes.payload.item.escalatedTo, 'holding-admin');
  assert.equal(escalationRes.payload.item.escalatedBy, 'bu-admin');
  assert.equal(escalationRes.payload.item.reviewScope, 'holding_company');
  const auditEntries = JSON.parse(kvStore.get('risk_calculator_audit_log') || '[]');
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].eventType, 'review_escalated');
  assert.equal(auditEntries[0].actorUsername, 'bu-admin');
  assert.equal(auditEntries[0].details.escalatedTo, 'holding-admin');
});
