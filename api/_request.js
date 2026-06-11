'use strict';

const DEFAULT_ALLOWED_ORIGIN = 'https://slackspac3.github.io';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseRequestBody(req) {
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch (error) {
      console.error('api/_request.parseRequestBody failed:', error);
      return null;
    }
  }
  return req?.body ?? {};
}

function getHeaderValue(headers = {}, name = '') {
  const target = String(name || '').toLowerCase();
  return Object.entries(headers || {}).find(([key]) => String(key || '').toLowerCase() === target)?.[1] || '';
}

function hasJsonContentType(req) {
  const contentType = String(getHeaderValue(req?.headers || {}, 'content-type') || '').toLowerCase();
  return contentType.includes('application/json');
}

function getBodySize(req, fallbackLimit = 160000) {
  if (typeof req?.body === 'string') return req.body.length;
  try {
    return JSON.stringify(req?.body ?? {}).length;
  } catch {
    return fallbackLimit + 1;
  }
}

function enforceJsonPostBody(req, res, { maxBodyChars = 160000 } = {}) {
  if (req?.method !== 'POST') return true;
  if (!hasJsonContentType(req)) {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return false;
  }
  if (getBodySize(req, maxBodyChars) > maxBodyChars) {
    res.status(413).json({ error: 'Request body is too large' });
    return false;
  }
  return true;
}

function getAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN).trim();
  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : [DEFAULT_ALLOWED_ORIGIN];
}

function isAllowedOrigin(origin, allowedOrigins = getAllowedOrigins()) {
  const safeOrigin = String(origin || '').trim();
  if (!safeOrigin || safeOrigin === 'null') return false;
  return allowedOrigins.includes(safeOrigin);
}

function applyCorsHeaders(req, res, {
  methods = 'GET,POST,OPTIONS',
  headers = 'content-type'
} = {}) {
  const origin = String(req?.headers?.origin || '').trim();
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
  res.setHeader('Vary', 'Origin');
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  return origin;
}

function getUnexpectedFields(value, allowedFields = []) {
  if (!isPlainObject(value)) return [];
  const allowed = new Set((Array.isArray(allowedFields) ? allowedFields : []).map((item) => String(item || '').trim()).filter(Boolean));
  return Object.keys(value).filter((key) => !allowed.has(key));
}

module.exports = {
  applyCorsHeaders,
  enforceJsonPostBody,
  getAllowedOrigins,
  getBodySize,
  getHeaderValue,
  getUnexpectedFields,
  hasJsonContentType,
  isAllowedOrigin,
  isPlainObject,
  parseRequestBody
};
