'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { validateBody } = require('../_validation');
const { checkRateLimit } = require('../_rateLimit');
const { buildGuidedScenarioDraftWorkflow, normaliseGuidedScenarioDraftInput } = require('../_scenarioDraftWorkflow');
const { recordAiRouteReuse, withAiRouteMetrics } = require('../_aiRouteMetrics');
const { withWorkflowReuse } = require('../_workflowReuse');

const ALLOWED_FIELDS = [
  'riskStatement',
  'guidedInput',
  'scenarioLensHint',
  'businessUnit',
  'geography',
  'applicableRegulations',
  'citations',
  'adminSettings',
  'traceLabel',
  'priorMessages'
];

function getRateLimitKey(req, session) {
  return `ai-scenario-draft::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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
    maxPerWindow: 40,
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
    riskStatement:         { type: 'string', maxLength: 5000 },
    scenarioLensHint:      { type: 'string', maxLength: 200 },
    geography:             { type: 'string', maxLength: 500 },
    traceLabel:            { type: 'string', maxLength: 200 },
    guidedInput:           { type: 'object' },
    businessUnit:          { type: 'object' },
    adminSettings:         { type: 'object' },
    applicableRegulations: { type: 'array', maxItems: 100, itemType: 'string', itemMaxLength: 200 },
    citations:             { type: 'array', maxItems: 50 },
    priorMessages:         { type: 'array', maxItems: 50 }
  });
  if (validationErrors.length) {
    res.status(400).json({ error: validationErrors[0], validationErrors });
    return;
  }

  const normalisedInput = normaliseGuidedScenarioDraftInput({
    riskStatement: typeof body.riskStatement === 'string' ? body.riskStatement : '',
    guidedInput: isPlainObject(body.guidedInput) ? body.guidedInput : {},
    scenarioLensHint: body.scenarioLensHint,
    businessUnit: isPlainObject(body.businessUnit) ? body.businessUnit : null,
    geography: typeof body.geography === 'string' ? body.geography : '',
    applicableRegulations: Array.isArray(body.applicableRegulations) ? body.applicableRegulations : [],
    citations: Array.isArray(body.citations) ? body.citations : [],
    adminSettings: isPlainObject(body.adminSettings) ? body.adminSettings : {},
    traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : '',
    priorMessages: Array.isArray(body.priorMessages) ? body.priorMessages : []
  });
  const routeName = 'scenario-draft';
  const result = await withAiRouteMetrics(routeName, () => withWorkflowReuse({
    workflow: routeName,
    scopeKey: String(session?.username || 'anonymous').trim().toLowerCase(),
    fingerprintInput: normalisedInput,
    observeReuseEvent: (event) => recordAiRouteReuse(routeName, event),
    compute: () => buildGuidedScenarioDraftWorkflow({
      ...normalisedInput,
      session
    })
  }));
  res.status(200).json(result);
};
