'use strict';

const { requireSession } = require('../_apiAuth');
const { applyCorsHeaders, isAllowedOrigin } = require('../_request');
const { checkRateLimit } = require('../_rateLimit');
const { evaluateAiRuntimeStatus } = require('../_aiRuntime');
const { evidenceRagHealth, runEvidenceRagSmokeTest } = require('../_evidenceRag');

function getRateLimitKey(req, session) {
  return `ai-status::${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res, {
    methods: 'GET,OPTIONS',
    headers: 'content-type,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const session = await requireSession(req, res, {
    roles: ['admin'],
    forbiddenMessage: 'You are not allowed to view AI runtime status.'
  });
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

  const probe = String(req.query?.probe || '1').trim() !== '0';
  const ragProbe = String(req.query?.ragProbe || '0').trim() === '1';
  const status = await evaluateAiRuntimeStatus({ probe });
  const evidenceRag = evidenceRagHealth();
  if (ragProbe) {
    evidenceRag.lastSmokeStatus = await runEvidenceRagSmokeTest({ timeoutMs: 8000 });
  }
  res.status(200).json({
    ...status,
    evidenceRag
  });
};
