const { appendAuditEvent, readAuditLog, summariseAuditLog } = require('./_audit');
const { sendApiError, requireSession } = require('./_apiAuth');

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || '';

function isAdminSecretValid(req) {
  return !!ADMIN_API_SECRET && req.headers['x-admin-secret'] === ADMIN_API_SECRET;
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const body = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })()
    : (req.body || {});

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-admin-secret,x-session-token');
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
    if (req.method === 'GET') {
      const session = isAdminSecretValid(req) ? { username: 'admin', role: 'admin' } : requireSession(req, res, { roles: ['admin'] });
      if (!session) return;
      const entries = await readAuditLog();
      res.status(200).json({ entries: [...entries].reverse(), summary: summariseAuditLog(entries) });
      return;
    }
    if (req.method === 'POST') {
      const session = isAdminSecretValid(req) ? { username: 'admin', role: 'admin' } : requireSession(req, res);
      if (!session) return;
      const entry = await appendAuditEvent({
        category: body.category || 'general',
        eventType: body.eventType || 'event',
        actorUsername: session?.username || body.actorUsername || 'system',
        actorRole: session?.role || body.actorRole || 'system',
        target: body.target || '',
        status: body.status || 'success',
        source: body.source || 'client',
        details: body.details || {}
      });
      res.status(201).json({ entry });
      return;
    }
    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    sendApiError(res, 500, 'AUDIT_REQUEST_FAILED', 'The audit request could not be completed.');
  }
};
