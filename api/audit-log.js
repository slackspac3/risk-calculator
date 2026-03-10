const { appendAuditEvent, readAuditLog, summariseAuditLog, verifySessionToken } = require('./_audit');

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
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  try {
    const session = verifySessionToken(req.headers['x-session-token']);
    if (req.method === 'GET') {
      if (!isAdminSecretValid(req) && session?.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required.' });
        return;
      }
      const entries = await readAuditLog();
      res.status(200).json({ entries: [...entries].reverse(), summary: summariseAuditLog(entries) });
      return;
    }
    if (req.method === 'POST') {
      if (!isAdminSecretValid(req) && !session) {
        res.status(403).json({ error: 'Valid session required.' });
        return;
      }
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
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: 'Audit log request failed.', detail: error instanceof Error ? error.message : String(error) });
  }
};
