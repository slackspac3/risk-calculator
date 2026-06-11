'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { validateBody } = require('../_validation');
const { checkRateLimit } = require('../_rateLimit');
const { recordAiRouteReuse, withAiRouteMetrics } = require('../_aiRouteMetrics');
const { withWorkflowReuse } = require('../_workflowReuse');
const {
  buildDecisionChallengeWorkflow,
  normaliseDecisionChallengeWorkflowInput
} = require('../_decisionChallengeWorkflow');

const MAX_BODY_CHARS = 180000;

const ALLOWED_FIELDS = [
  'assessmentType',
  'scenario',
  'structuredScenario',
  'scenarioLens',
  'projectContext',
  'projectExposure',
  'parameters',
  'simulationResult',
  'assumptionRegister',
  'parameterCoach',
  'evidenceMap',
  'treatments',
  'riskAppetite',
  'adminSettings',
  'traceLabel',
  'priorMessages'
];

function getHeaderValue(headers = {}, name = '') {
  const target = String(name || '').toLowerCase();
  return Object.entries(headers || {}).find(([key]) => String(key || '').toLowerCase() === target)?.[1] || '';
}

function hasJsonContentType(req) {
  const contentType = String(getHeaderValue(req.headers, 'content-type') || '').toLowerCase();
  return contentType.includes('application/json');
}

function getBodySize(req) {
  if (typeof req?.body === 'string') return req.body.length;
  try {
    return JSON.stringify(req?.body ?? {}).length;
  } catch {
    return MAX_BODY_CHARS + 1;
  }
}

function getRateLimitKey(req, session) {
  return `ai-decision-challenge::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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

  if (!hasJsonContentType(req)) {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return;
  }

  if (getBodySize(req) > MAX_BODY_CHARS) {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const rateLimit = await checkRateLimit(getRateLimitKey(req, session), {
    maxPerWindow: 35,
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
    assessmentType:       { type: 'string', maxLength: 80 },
    scenario:             { type: 'string', maxLength: 5000 },
    structuredScenario:   { type: 'object' },
    projectContext:       { type: 'object' },
    projectExposure:      { type: 'object' },
    parameters:           { type: 'object' },
    simulationResult:     { type: 'object' },
    assumptionRegister:   { type: 'object' },
    parameterCoach:       { type: 'object' },
    evidenceMap:          { type: 'object' },
    treatments:           { type: 'array', maxItems: 50 },
    riskAppetite:         { type: 'object' },
    adminSettings:        { type: 'object' },
    traceLabel:           { type: 'string', maxLength: 200 },
    priorMessages:        { type: 'array', maxItems: 50 }
  });
  if (validationErrors.length) {
    res.status(400).json({ error: validationErrors[0], validationErrors });
    return;
  }

  const normalisedInput = normaliseDecisionChallengeWorkflowInput(body);
  const routeName = 'decision-challenge';
  const result = await withAiRouteMetrics(routeName, () => withWorkflowReuse({
    workflow: routeName,
    scopeKey: String(session?.username || 'anonymous').trim().toLowerCase(),
    fingerprintInput: normalisedInput,
    observeReuseEvent: (event) => recordAiRouteReuse(routeName, event),
    compute: () => buildDecisionChallengeWorkflow({
      ...normalisedInput,
      session
    })
  }));

  res.status(200).json(result);
};
