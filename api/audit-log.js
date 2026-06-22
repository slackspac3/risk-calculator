const { appendAuditEvent, readAuditLog, summariseAuditLog } = require('./_audit');
const { isRequestSecretValid, sendApiError, requireSession } = require('./_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || '';
const RESERVED_CLIENT_EVENT_TYPES = new Set([
  'login_success',
  'login_failure',
  'login_rate_limited',
  'login_rate_limit_unavailable',
  'managed_user_updated',
  'password_reset',
  'review_approved',
  'review_changes_requested',
  'review_escalated',
  'review_submitted',
  'settings_updated',
  'user_created',
  'user_deleted',
  'user_state_updated',
  'user_updated'
]);

function isAdminSecretValid(req) {
  return isRequestSecretValid(req, 'x-admin-secret', ADMIN_API_SECRET);
}

function normaliseClientEventType(value = '') {
  const eventType = String(value || 'event').trim().slice(0, 120) || 'event';
  return RESERVED_CLIENT_EVENT_TYPES.has(eventType.toLowerCase())
    ? `client_${eventType}`.slice(0, 120)
    : eventType;
}

module.exports = async function handler(req, res) {
  const body = parseRequestBody(req);
  applyCorsHeaders(req, res, {
    methods: 'GET,POST,OPTIONS',
    headers: 'content-type,x-admin-secret,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
    sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    return;
  }

  if (req.method === 'POST' && !isPlainObject(body)) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Invalid request body.');
    return;
  }

  try {
    if (req.method === 'GET') {
      const session = isAdminSecretValid(req) ? { username: 'admin', role: 'admin' } : await requireSession(req, res, { roles: ['admin'] });
      if (!session) return;
      const entries = await readAuditLog();
      res.status(200).json({ entries: [...entries].reverse(), summary: summariseAuditLog(entries) });
      return;
    }
    if (req.method === 'POST') {
      if (getUnexpectedFields(body, ['category', 'details', 'eventType', 'source', 'status', 'target']).length) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the audit request.');
        return;
      }
      const session = isAdminSecretValid(req) ? { username: 'admin', role: 'admin' } : await requireSession(req, res);
      if (!session) return;
      const adminSecretRequest = isAdminSecretValid(req);
      const entry = await appendAuditEvent({
        category: String(body.category || 'general').trim().slice(0, 80),
        eventType: adminSecretRequest
          ? String(body.eventType || 'event').trim().slice(0, 120)
          : normaliseClientEventType(body.eventType),
        // Actor identity must come from the authenticated session, not the client payload.
        actorUsername: session?.username || 'system',
        actorRole: session?.role || 'system',
        target: String(body.target || '').trim().slice(0, 160),
        status: String(body.status || 'success').trim().slice(0, 40),
        source: adminSecretRequest ? String(body.source || 'server').trim().slice(0, 40) : 'client',
        details: isPlainObject(body.details || {}) ? body.details : {}
      });
      res.status(201).json({ entry });
      return;
    }
    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    console.error('Audit-log API request failed.', error);
    sendApiError(res, 500, 'AUDIT_REQUEST_FAILED', 'The audit request could not be completed.');
  }
};
