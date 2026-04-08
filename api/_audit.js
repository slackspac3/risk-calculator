const crypto = require('crypto');
const { getKvConfig, withLock: withKvLock } = require('./_kvStore');

const AUDIT_KEY = process.env.AUDIT_LOG_KEY || 'risk_calculator_audit_log';
const AUDIT_CAPACITY = Number(process.env.AUDIT_LOG_CAPACITY || 500);
const AUTH_EVENT_TYPES = new Set(['login_success', 'login_failure', 'logout']);

async function runKvCommand(command) {
  let config = null;
  try {
    config = getKvConfig();
  } catch (error) {
    console.error('api/_audit.runKvCommand missing KV config:', error);
    return null;
  }
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
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

async function readAuditLog() {
  const response = await runKvCommand(['GET', AUDIT_KEY]);
  const raw = response?.result;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('api/_audit.readAuditLog failed to parse audit log payload:', error);
    return [];
  }
}

async function writeAuditLog(entries) {
  const next = Array.isArray(entries) ? entries.slice(-AUDIT_CAPACITY) : [];
  await runKvCommand(['SET', AUDIT_KEY, JSON.stringify(next)]);
  return next;
}

async function appendAuditEvent(event = {}) {
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    category: event.category || 'general',
    eventType: event.eventType || 'event',
    actorUsername: event.actorUsername || 'system',
    actorRole: event.actorRole || 'system',
    target: event.target || '',
    status: event.status || 'success',
    source: event.source || 'server',
    details: event.details && typeof event.details === 'object' ? event.details : {}
  };
  try {
    await withKvLock(AUDIT_KEY, async () => {
      const entries = await readAuditLog();
      entries.push(entry);
      await writeAuditLog(entries);
    }, {
      prefix: 'lock::audit::',
      waitTimeoutMs: 2500
    });
  } catch (error) {
    console.error('api/_audit.appendAuditEvent failed to persist audit event:', error);
  }
  return entry;
}

function summariseAuditLog(entries = []) {
  const recent = [...entries].reverse();
  const summary = {
    total: recent.length,
    retainedCapacity: AUDIT_CAPACITY,
    loginSuccessCount: 0,
    loginFailureCount: 0,
    logoutCount: 0,
    adminActionCount: 0,
    buAdminActionCount: 0,
    userActionCount: 0
  };
  for (const entry of recent) {
    if (entry.eventType === 'login_success') summary.loginSuccessCount += 1;
    if (entry.eventType === 'login_failure') summary.loginFailureCount += 1;
    if (entry.eventType === 'logout') summary.logoutCount += 1;
    if (AUTH_EVENT_TYPES.has(String(entry.eventType || '').trim().toLowerCase())) continue;
    if (entry.actorRole === 'admin') summary.adminActionCount += 1;
    else if (entry.actorRole === 'bu_admin') summary.buAdminActionCount += 1;
    else if (entry.actorRole === 'user') summary.userActionCount += 1;
  }
  return summary;
}

function getSessionSigningSecret() {
  return process.env.SESSION_SIGNING_SECRET || process.env.ADMIN_API_SECRET || '';
}

function parseSessionToken(token) {
  const signingSecret = getSessionSigningSecret();
  if (!signingSecret) return { valid: false, reason: 'unconfigured', payload: null };
  const value = String(token || '').trim();
  if (!value || !value.includes('.')) return { valid: false, reason: 'missing', payload: null };
  const [payloadPart, signature] = value.split('.', 2);
  const expected = crypto.createHmac('sha256', signingSecret).update(payloadPart).digest('base64url');
  const actualBuffer = Buffer.from(String(signature || ''), 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (actualBuffer.length !== expectedBuffer.length) return { valid: false, reason: 'invalid', payload: null };
  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return { valid: false, reason: 'invalid', payload: null };
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (!payload?.username) return { valid: false, reason: 'invalid', payload: null };
    if (Number(payload.exp || 0) < Date.now()) {
      return { valid: false, reason: 'expired', payload };
    }
    return { valid: true, reason: '', payload };
  } catch (error) {
    console.error('api/_audit.parseSessionToken failed to parse token payload:', error);
    return { valid: false, reason: 'invalid', payload: null };
  }
}

function verifySessionToken(token) {
  const parsed = parseSessionToken(token);
  return parsed.valid ? parsed.payload : null;
}

module.exports = {
  AUDIT_CAPACITY,
  appendAuditEvent,
  getSessionSigningSecret,
  parseSessionToken,
  readAuditLog,
  summariseAuditLog,
  verifySessionToken
};
