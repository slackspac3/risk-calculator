'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { checkRateLimit } = require('../_rateLimit');
const { buildManualShortlistWorkflow, normaliseManualStep1Input } = require('../_manualStep1Workflow');
const { recordAiRouteReuse, withAiRouteMetrics } = require('../_aiRouteMetrics');
const { withWorkflowReuse } = require('../_workflowReuse');

const ALLOWED_FIELDS = [
  'riskStatement',
  'registerText',
  'registerMeta',
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
  return `ai-manual-shortlist::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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

  const normalisedInput = normaliseManualStep1Input({
    riskStatement: typeof body.riskStatement === 'string' ? body.riskStatement : '',
    registerText: typeof body.registerText === 'string' ? body.registerText : '',
    registerMeta: isPlainObject(body.registerMeta) ? body.registerMeta : null,
    scenarioLensHint: body.scenarioLensHint,
    businessUnit: isPlainObject(body.businessUnit) ? body.businessUnit : null,
    geography: typeof body.geography === 'string' ? body.geography : '',
    applicableRegulations: Array.isArray(body.applicableRegulations) ? body.applicableRegulations : [],
    citations: Array.isArray(body.citations) ? body.citations : [],
    adminSettings: isPlainObject(body.adminSettings) ? body.adminSettings : {},
    traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : '',
    priorMessages: Array.isArray(body.priorMessages) ? body.priorMessages : []
  });
  const routeName = 'manual-shortlist';
  const result = await withAiRouteMetrics(routeName, () => withWorkflowReuse({
    workflow: routeName,
    scopeKey: String(session?.username || 'anonymous').trim().toLowerCase(),
    fingerprintInput: normalisedInput,
    observeReuseEvent: (event) => recordAiRouteReuse(routeName, event),
    compute: () => buildManualShortlistWorkflow({
      ...normalisedInput,
      session
    }, {
      traceLabelDefault: 'Step 1 manual shortlist'
    })
  }));
  res.status(200).json(result);
};
