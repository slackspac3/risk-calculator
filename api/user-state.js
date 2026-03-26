const USER_STATE_PREFIX = process.env.USER_STATE_PREFIX || 'risk_calculator_user_state';
const { appendAuditEvent } = require('./_audit');
const { sendApiError, requireSession, sendConflictError } = require('./_apiAuth');

function getKvUrl() {
  return process.env.APPLE_CAT || process.env.FOO_URL_TEST || process.env.RC_USER_STORE_URL || process.env.USER_STORE_KV_URL || process.env.KV_REST_API_URL || '';
}

function getKvToken() {
  return process.env.BANANA_DOG || process.env.FOO_TOKEN_TEST || process.env.RC_USER_STORE_TOKEN || process.env.USER_STORE_KV_TOKEN || process.env.KV_REST_API_TOKEN || '';
}

async function runKvCommand(command) {
  const url = getKvUrl();
  const token = getKvToken();
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `KV request failed with HTTP ${res.status}`);
  }
  return res.json();
}

function buildStateKey(username = '') {
  return `${USER_STATE_PREFIX}__${String(username || '').trim().toLowerCase()}`;
}

function normaliseState(state = {}) {
  return {
    userSettings: state.userSettings && typeof state.userSettings === 'object' ? state.userSettings : null,
    assessments: Array.isArray(state.assessments) ? state.assessments : [],
    learningStore: state.learningStore && typeof state.learningStore === 'object' ? state.learningStore : { templates: {} },
    draft: state.draft && typeof state.draft === 'object' ? state.draft : null,
    _meta: {
      revision: Number(state._meta?.revision || 0),
      updatedAt: Number(state._meta?.updatedAt || 0)
    }
  };
}

async function readUserState(username) {
  const response = await runKvCommand(['GET', buildStateKey(username)]);
  const raw = response?.result;
  if (!raw) return normaliseState();
  try {
    return normaliseState(JSON.parse(raw));
  } catch {
    return normaliseState();
  }
}

function buildConflictDetails(currentState, conflictFields = []) {
  return {
    latestState: currentState,
    latestMeta: currentState?._meta || { revision: 0, updatedAt: 0 },
    conflictFields: Array.isArray(conflictFields) ? conflictFields : []
  };
}

function isStaleWrite(currentState, expectedMeta = {}) {
  const currentRevision = Number(currentState?._meta?.revision || 0);
  const expectedRevision = Number(expectedMeta?.revision || 0);
  return currentRevision !== expectedRevision;
}

function buildNextState(current, candidateState) {
  return normaliseState({
    ...candidateState,
    _meta: {
      revision: Number(current?._meta?.revision || 0) + 1,
      updatedAt: Date.now()
    }
  });
}

function applyStatePatch(current, patch = {}) {
  const next = normaliseState(current);
  if (Object.prototype.hasOwnProperty.call(patch, 'userSettings')) {
    next.userSettings = patch.userSettings && typeof patch.userSettings === 'object' ? patch.userSettings : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'assessments')) {
    next.assessments = Array.isArray(patch.assessments) ? patch.assessments : [];
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'learningStore')) {
    next.learningStore = patch.learningStore && typeof patch.learningStore === 'object' ? patch.learningStore : { templates: {} };
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'draft')) {
    next.draft = patch.draft && typeof patch.draft === 'object' ? patch.draft : null;
  }
  return next;
}

async function writeUserState(username, state, expectedMeta = {}) {
  const current = await readUserState(username);
  if (isStaleWrite(current, expectedMeta)) {
    return {
      ok: false,
      conflict: true,
      state: current
    };
  }
  const next = buildNextState(current, state);
  await runKvCommand(['SET', buildStateKey(username), JSON.stringify(next)]);
  return {
    ok: true,
    conflict: false,
    state: next
  };
}

async function patchUserState(username, patch, expectedMeta = {}) {
  const current = await readUserState(username);
  if (isStaleWrite(current, expectedMeta)) {
    return {
      ok: false,
      conflict: true,
      state: current
    };
  }
  const patched = applyStatePatch(current, patch);
  const next = buildNextState(current, patched);
  await runKvCommand(['SET', buildStateKey(username), JSON.stringify(next)]);
  return {
    ok: true,
    conflict: false,
    state: next
  };
}


function canAccessUserState(session, username) {
  const safeUsername = String(username || '').trim().toLowerCase();
  return !!session && (session.role === 'admin' || String(session.username || '').trim().toLowerCase() === safeUsername);
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const body = typeof req.body === 'string'
    ? (() => {
        try { return JSON.parse(req.body || '{}'); } catch { return {}; }
      })()
    : (req.body || {});

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-session-token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  try {
    const username = String(req.method === 'GET' ? req.query?.username : body.username || '').trim().toLowerCase();
    const session = requireSession(req, res);
    if (!session) return;
    if (!username) {
      sendApiError(res, 400, 'VALIDATION_ERROR', 'Username is required.');
      return;
    }
    if (!canAccessUserState(session, username)) {
      sendApiError(res, 403, 'FORBIDDEN', 'You are not allowed to access this user state.');
      return;
    }

    if (req.method === 'GET') {
      const state = await readUserState(username);
      res.status(200).json({ state });
      return;
    }

    if (req.method === 'PUT') {
      const writeResult = await writeUserState(username, body.state || {}, body.expectedMeta || body.state?._meta || {});
      if (writeResult.conflict) {
        sendConflictError(
          res,
          'Your workspace changed in another session. Reload the latest version and try again.',
          buildConflictDetails(writeResult.state)
        );
        return;
      }
      const state = writeResult.state;
      if (body.audit && session) {
        await appendAuditEvent({
          category: body.audit.category || 'user_state',
          eventType: body.audit.eventType || 'user_state_updated',
          actorUsername: session.username,
          actorRole: session.role || 'user',
          target: body.audit.target || username,
          status: 'success',
          source: 'server',
          details: body.audit.details || {}
        });
      }
      res.status(200).json({ state });
      return;
    }

    if (req.method === 'PATCH') {
      const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
      const writeResult = await patchUserState(username, patch, body.expectedMeta || {});
      if (writeResult.conflict) {
        sendConflictError(
          res,
          'Your workspace changed in another session. Reload the latest version and try again.',
          buildConflictDetails(writeResult.state, Object.keys(patch))
        );
        return;
      }
      const state = writeResult.state;
      if (body.audit && session) {
        await appendAuditEvent({
          category: body.audit.category || 'user_state',
          eventType: body.audit.eventType || 'user_state_updated',
          actorUsername: session.username,
          actorRole: session.role || 'user',
          target: body.audit.target || username,
          status: 'success',
          source: 'server',
          details: body.audit.details || {}
        });
      }
      res.status(200).json({ state });
      return;
    }

    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    sendApiError(res, 500, 'USER_STATE_REQUEST_FAILED', 'The user-state request could not be completed.');
  }
};

module.exports.normaliseState = normaliseState;
module.exports.writeUserState = writeUserState;
module.exports.patchUserState = patchUserState;
