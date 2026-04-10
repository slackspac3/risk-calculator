'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { validateBody } = require('../_validation');
const { checkRateLimit } = require('../_rateLimit');
const { withAiRouteMetrics } = require('../_aiRouteMetrics');
const { buildParameterChallengeRecordWorkflow } = require('../_reviewChallengeWorkflow');

const ALLOWED_FIELDS = ['parameterKey', 'parameterLabel', 'currentValue', 'currentValueLabel', 'scenarioSummary', 'reviewerConcern', 'currentAle', 'allowedParams', 'traceLabel'];

function getRateLimitKey(req, session) {
  return `ai-parameter-challenge::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res, { methods: 'POST,OPTIONS', headers: 'content-type,x-session-token' });
  if (req.method === 'OPTIONS') return void res.status(204).end();
  if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed' });
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) return void res.status(403).json({ error: 'Origin not allowed' });
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
  const { errors: validationErrors } = validateBody(body, {
    parameterKey:      { type: 'string', maxLength: 200 },
    parameterLabel:    { type: 'string', maxLength: 500 },
    currentValueLabel: { type: 'string', maxLength: 500 },
    scenarioSummary:   { type: 'string', maxLength: 5000 },
    reviewerConcern:   { type: 'string', maxLength: 3000 },
    currentAle:        { type: 'string', maxLength: 200 },
    traceLabel:        { type: 'string', maxLength: 200 },
    allowedParams:     { type: 'array', maxItems: 50 }
  });
  if (validationErrors.length) return void res.status(400).json({ error: validationErrors[0], validationErrors });
  const result = await withAiRouteMetrics('parameter-challenge', () => buildParameterChallengeRecordWorkflow({
    parameterKey: typeof body.parameterKey === 'string' ? body.parameterKey : '',
    parameterLabel: typeof body.parameterLabel === 'string' ? body.parameterLabel : '',
    currentValue: body.currentValue,
    currentValueLabel: typeof body.currentValueLabel === 'string' ? body.currentValueLabel : '',
    scenarioSummary: typeof body.scenarioSummary === 'string' ? body.scenarioSummary : '',
    reviewerConcern: typeof body.reviewerConcern === 'string' ? body.reviewerConcern : '',
    currentAle: typeof body.currentAle === 'string' ? body.currentAle : '',
    allowedParams: Array.isArray(body.allowedParams) ? body.allowedParams : [],
    traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : ''
  }));
  res.status(200).json(result);
};
