'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { validateBody } = require('../_validation');
const { checkRateLimit } = require('../_rateLimit');
const { buildTreatmentSuggestionWorkflow, normaliseTreatmentSuggestionInput } = require('../_treatmentSuggestionWorkflow');
const { recordAiRouteReuse, withAiRouteMetrics } = require('../_aiRouteMetrics');
const { withWorkflowReuse } = require('../_workflowReuse');

const ALLOWED_FIELDS = [
  'baselineAssessment',
  'improvementRequest',
  'businessUnit',
  'adminSettings',
  'citations',
  'priorMessages',
  'traceLabel'
];

function getRateLimitKey(req, session) {
  return `ai-treatment-suggestion::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
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
    res.status(rateLimit.unavailable ? 503 : 429).json({
      error: rateLimit.unavailable ? 'Request throttling is temporarily unavailable' : 'Rate limit exceeded'
    });
    return;
  }

  const body = parseRequestBody(req);
  if (!isPlainObject(body)) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  const unexpectedFields = getUnexpectedFields(body, ALLOWED_FIELDS);
  if (unexpectedFields.length) {
    res.status(400).json({
      error: 'Unexpected request fields',
      fields: unexpectedFields
    });
    return;
  }

  const { errors: validationErrors } = validateBody(body, {
    improvementRequest: { type: 'string', maxLength: 5000 },
    traceLabel:         { type: 'string', maxLength: 200 },
    baselineAssessment: { type: 'object' },
    businessUnit:       { type: 'object' },
    adminSettings:      { type: 'object' },
    citations:          { type: 'array', maxItems: 50 },
    priorMessages:      { type: 'array', maxItems: 50 }
  });
  if (validationErrors.length) {
    res.status(400).json({ error: validationErrors[0], validationErrors });
    return;
  }

  const normalisedInput = normaliseTreatmentSuggestionInput({
    baselineAssessment: isPlainObject(body.baselineAssessment) ? body.baselineAssessment : {},
    improvementRequest: typeof body.improvementRequest === 'string' ? body.improvementRequest : '',
    businessUnit: isPlainObject(body.businessUnit) ? body.businessUnit : null,
    adminSettings: isPlainObject(body.adminSettings) ? body.adminSettings : {},
    citations: Array.isArray(body.citations) ? body.citations : [],
    priorMessages: Array.isArray(body.priorMessages) ? body.priorMessages : [],
    traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : ''
  });

  try {
    const routeName = 'treatment-suggestion';
    const result = await withAiRouteMetrics(routeName, () => withWorkflowReuse({
      workflow: routeName,
      scopeKey: String(session?.username || 'anonymous').trim().toLowerCase(),
      fingerprintInput: normalisedInput,
      observeReuseEvent: (event) => recordAiRouteReuse(routeName, event),
      compute: () => buildTreatmentSuggestionWorkflow(normalisedInput)
    }));
    res.status(200).json(result);
  } catch (error) {
    res.status(503).json({
      error: String(error?.message || 'AI treatment suggestion is unavailable right now.')
    });
  }
};
