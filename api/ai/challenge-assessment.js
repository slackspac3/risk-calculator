'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, enforceJsonPostBody, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('../_request');
const { checkRateLimit } = require('../_rateLimit');
const { withAiRouteMetrics } = require('../_aiRouteMetrics');
const { buildChallengeAssessmentWorkflow } = require('../_reviewChallengeWorkflow');

const ALLOWED_FIELDS = [
  'scenarioTitle',
  'narrative',
  'geography',
  'businessUnitName',
  'businessUnit',
  'adminSettings',
  'confidence',
  'drivers',
  'assumptions',
  'missingInformation',
  'applicableRegulations',
  'citations',
  'results',
  'fairParams',
  'assessmentIntelligence',
  'obligationBasis',
  'traceLabel'
];

function getRateLimitKey(req, session) {
  return `ai-challenge-assessment::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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
  try {
    const result = await withAiRouteMetrics('challenge-assessment', () => buildChallengeAssessmentWorkflow({
      scenarioTitle: typeof body.scenarioTitle === 'string' ? body.scenarioTitle : '',
      narrative: typeof body.narrative === 'string' ? body.narrative : '',
      geography: typeof body.geography === 'string' ? body.geography : '',
      businessUnitName: typeof body.businessUnitName === 'string' ? body.businessUnitName : '',
      businessUnit: isPlainObject(body.businessUnit) ? body.businessUnit : null,
      adminSettings: isPlainObject(body.adminSettings) ? body.adminSettings : {},
      confidence: isPlainObject(body.confidence) ? body.confidence : {},
      drivers: isPlainObject(body.drivers) ? body.drivers : {},
      assumptions: Array.isArray(body.assumptions) ? body.assumptions : [],
      missingInformation: Array.isArray(body.missingInformation) ? body.missingInformation : [],
      applicableRegulations: Array.isArray(body.applicableRegulations) ? body.applicableRegulations : [],
      citations: Array.isArray(body.citations) ? body.citations : [],
      results: isPlainObject(body.results) ? body.results : {},
      fairParams: isPlainObject(body.fairParams) ? body.fairParams : {},
      assessmentIntelligence: isPlainObject(body.assessmentIntelligence) ? body.assessmentIntelligence : {},
      obligationBasis: isPlainObject(body.obligationBasis) ? body.obligationBasis : {},
      traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : ''
    }));
    res.status(200).json(result);
  } catch (error) {
    res.status(503).json({ error: String(error?.message || 'AI challenge assessment is unavailable right now.') });
  }
};
