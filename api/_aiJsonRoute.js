'use strict';

const { requireSession } = require('./_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');
const { validateBody } = require('./_validation');
const { checkRateLimit } = require('./_rateLimit');
const { recordAiRouteReuse, withAiRouteMetrics } = require('./_aiRouteMetrics');
const { withWorkflowReuse } = require('./_workflowReuse');

function getHeaderValue(headers = {}, name = '') {
  const target = String(name || '').toLowerCase();
  return Object.entries(headers || {}).find(([key]) => String(key || '').toLowerCase() === target)?.[1] || '';
}

function hasJsonContentType(req) {
  const contentType = String(getHeaderValue(req.headers, 'content-type') || '').toLowerCase();
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

function getRateLimitKey(routeName, req, session) {
  return `ai-${routeName}::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
}

function createAiJsonRouteHandler({
  routeName,
  allowedFields,
  validationSchema,
  maxBodyChars = 160000,
  rateLimit = { maxPerWindow: 35, windowMs: 60000 },
  normaliseInput,
  buildWorkflow
}) {
  if (!routeName) throw new Error('routeName is required');
  if (!Array.isArray(allowedFields)) throw new Error('allowedFields must be an array');
  if (!validationSchema || typeof validationSchema !== 'object') throw new Error('validationSchema is required');
  if (typeof normaliseInput !== 'function') throw new Error('normaliseInput is required');
  if (typeof buildWorkflow !== 'function') throw new Error('buildWorkflow is required');

  return async function handler(req, res) {
    applyCorsHeaders(req, res, {
      methods: 'POST,OPTIONS',
      headers: 'content-type,x-session-token'
    });

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const origin = req.headers.origin;
    if (!origin || !isAllowedOrigin(origin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }

    if (!hasJsonContentType(req)) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return;
    }

    if (getBodySize(req, maxBodyChars) > maxBodyChars) {
      res.status(413).json({ error: 'Request body is too large' });
      return;
    }

    const session = await requireSession(req, res);
    if (!session) return;

    const limiter = await checkRateLimit(getRateLimitKey(routeName, req, session), rateLimit);
    if (!limiter.allowed) {
      res.setHeader('Retry-After', String(limiter.retryAfterSeconds));
      res.status(limiter.unavailable ? 503 : 429).json({
        error: limiter.unavailable ? 'Request throttling is temporarily unavailable' : 'Rate limit exceeded'
      });
      return;
    }

    const body = parseRequestBody(req);
    if (!isPlainObject(body)) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const unexpectedFields = getUnexpectedFields(body, allowedFields);
    if (unexpectedFields.length) {
      res.status(400).json({
        error: 'Unexpected request fields',
        fields: unexpectedFields
      });
      return;
    }

    const { errors: validationErrors } = validateBody(body, validationSchema);
    if (validationErrors.length) {
      res.status(400).json({ error: validationErrors[0], validationErrors });
      return;
    }

    const normalisedInput = normaliseInput(body);
    const result = await withAiRouteMetrics(routeName, () => withWorkflowReuse({
      workflow: routeName,
      scopeKey: String(session?.username || 'anonymous').trim().toLowerCase(),
      fingerprintInput: normalisedInput,
      observeReuseEvent: (event) => recordAiRouteReuse(routeName, event),
      compute: () => buildWorkflow({
        ...normalisedInput,
        session
      })
    }));

    res.status(200).json(result);
  };
}

module.exports = {
  createAiJsonRouteHandler,
  getBodySize,
  hasJsonContentType
};
