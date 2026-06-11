'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, enforceJsonPostBody, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { checkRateLimit } = require('../_rateLimit');
const { withAiRouteMetrics } = require('../_aiRouteMetrics');
const { buildReviewMediationWorkflow } = require('../_reviewChallengeWorkflow');

const ALLOWED_FIELDS = ['narrative', 'fairParams', 'results', 'assessmentIntelligence', 'reviewerView', 'analystView', 'disputedFocus', 'scenarioLens', 'citations', 'traceLabel'];

function getRateLimitKey(req, session) {
  return `ai-review-mediation::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res, { methods: 'POST,OPTIONS', headers: 'content-type,x-session-token' });
  if (req.method === 'OPTIONS') return void res.status(204).end();
  if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed' });
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) return void res.status(403).json({ error: 'Origin not allowed' });
  if (!enforceJsonPostBody(req, res, { maxBodyChars: 180000 })) return;
  const session = await requireSession(req, res);
  if (!session) return;
  const rateLimit = await checkRateLimit(getRateLimitKey(req, session), { maxPerWindow: 30, windowMs: 60000 });
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return void res.status(rateLimit.unavailable ? 503 : 429).json({ error: rateLimit.unavailable ? 'Request throttling is temporarily unavailable' : 'Rate limit exceeded' });
  }
  const body = parseRequestBody(req);
  if (!isPlainObject(body)) return void res.status(400).json({ error: 'Invalid JSON body' });
  const unexpectedFields = getUnexpectedFields(body, ALLOWED_FIELDS);
  if (unexpectedFields.length) return void res.status(400).json({ error: 'Unexpected request fields', fields: unexpectedFields });
  const result = await withAiRouteMetrics('review-mediation', () => buildReviewMediationWorkflow({
    narrative: typeof body.narrative === 'string' ? body.narrative : '',
    fairParams: isPlainObject(body.fairParams) ? body.fairParams : {},
    results: isPlainObject(body.results) ? body.results : {},
    assessmentIntelligence: isPlainObject(body.assessmentIntelligence) ? body.assessmentIntelligence : {},
    reviewerView: typeof body.reviewerView === 'string' ? body.reviewerView : '',
    analystView: typeof body.analystView === 'string' ? body.analystView : '',
    disputedFocus: typeof body.disputedFocus === 'string' ? body.disputedFocus : '',
    scenarioLens: isPlainObject(body.scenarioLens) ? body.scenarioLens : {},
    citations: Array.isArray(body.citations) ? body.citations : [],
    traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : ''
  }));
  res.status(200).json(result);
};
