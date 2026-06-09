'use strict';

const { appendAuditEvent } = require('../_audit');
const { requireSession, sendApiError } = require('../_apiAuth');
const { searchEvidenceServerSide } = require('../_evidenceRag');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { checkRateLimit } = require('../_rateLimit');

const SEARCH_BODY_MAX_CHARS = Number(process.env.RISK_RAG_SEARCH_BODY_MAX_CHARS || 120_000);

function getRateLimitKey(req, session) {
  return `evidence-search::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
}

function mapEvidenceRagError(error = {}) {
  const status = Number(error.statusCode || 0) || (/timed out|timeout/i.test(String(error.message || '')) ? 504 : 502);
  return {
    status,
    code: error.code || (status === 503 ? 'RAG_UNCONFIGURED' : status === 400 ? 'VALIDATION_ERROR' : 'EVIDENCE_SEARCH_FAILED'),
    message: error.message || 'Evidence search failed.'
  };
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res, {
    methods: 'POST,OPTIONS',
    headers: 'content-type,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    return;
  }
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }
  if (!req.headers['content-type']?.includes('application/json')) {
    sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const rateLimit = await checkRateLimit(getRateLimitKey(req, session), {
    maxPerWindow: 30,
    windowMs: 60000
  });
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendApiError(
      res,
      rateLimit.unavailable ? 503 : 429,
      rateLimit.unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMIT_EXCEEDED',
      rateLimit.unavailable ? 'Request throttling is temporarily unavailable.' : 'Rate limit exceeded.'
    );
    return;
  }

  const body = parseRequestBody(req);
  if (!isPlainObject(body)) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Invalid request body.');
    return;
  }
  const unexpected = getUnexpectedFields(body, ['caseId', 'query', 'topK', 'limit', 'purpose']);
  if (unexpected.length) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the evidence search request.', { unexpectedFields: unexpected });
    return;
  }
  if (JSON.stringify(body).length > SEARCH_BODY_MAX_CHARS) {
    sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', 'Evidence search request body is too large.');
    return;
  }

  try {
    const result = await searchEvidenceServerSide(body, { session });
    await appendAuditEvent({
      category: 'evidence_rag',
      eventType: 'evidence_searched',
      actorUsername: session.username,
      actorRole: session.role,
      target: result.context?.caseId || body.caseId || '',
      status: 'success',
      source: 'server',
      details: {
        provider: result.index?.provider || '',
        collection: result.index?.collection || '',
        matchCount: result.matches?.length || 0,
        evidenceIds: result.index?.evidenceIds || [],
        browserEmbeddingsRetained: false
      }
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('api/evidence/search failed:', error);
    const mapped = mapEvidenceRagError(error);
    await appendAuditEvent({
      category: 'evidence_rag',
      eventType: 'evidence_search_failed',
      actorUsername: session.username,
      actorRole: session.role,
      target: String(body.caseId || '').trim(),
      status: 'failure',
      source: 'server',
      details: {
        code: mapped.code,
        message: mapped.message
      }
    });
    sendApiError(res, mapped.status, mapped.code, mapped.message);
  }
};
