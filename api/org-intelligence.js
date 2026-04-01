const crypto = require('crypto');
const { sendApiError, requireSession } = require('./_apiAuth');
const { applyCorsHeaders, getUnexpectedFields, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');
const { get: kvGet, set: kvSet } = require('./_kvStore');

const ORG_PATTERNS_KEY = 'risk_calculator_org_patterns';
const ORG_CALIBRATION_KEY = 'risk_calculator_org_calibration';
const DECISION_HISTORY_KEY = 'risk_calculator_decision_history';
const COVERAGE_MAP_KEY = 'org_coverage_map';
const AI_FEEDBACK_KEY = 'risk_calculator_ai_feedback';

async function readJsonKey(key, fallback) {
  try {
    const raw = await kvGet(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`api/org-intelligence.readJsonKey failed for ${key}:`, error);
    return fallback;
  }
}

async function writeJsonKey(key, value) {
  await kvSet(key, JSON.stringify(value));
}

function toSafeString(value, max = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function toSafeUsername(value) {
  return toSafeString(value, 120).toLowerCase();
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseScenarioKey(value) {
  return toSafeString(value || 'general', 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general';
}

function createEmptyCalibrationStore() {
  return {
    updatedAt: 0,
    scenarioTypes: {}
  };
}

function createEmptyFeedbackStore() {
  return {
    updatedAt: 0,
    events: []
  };
}

function buildEntityId(prefix) {
  return toSafeString(`${prefix}_${crypto.randomUUID()}`, 120);
}

function normalisePattern(pattern = {}) {
  return {
    id: toSafeString(pattern.id || buildEntityId('pattern'), 120),
    assessmentId: toSafeString(pattern.assessmentId || pattern.id, 120),
    buId: toSafeString(pattern.buId, 80),
    buName: toSafeString(pattern.buName, 160),
    functionKey: toSafeString(pattern.functionKey || 'general', 80).toLowerCase(),
    scenarioLens: pattern.scenarioLens && typeof pattern.scenarioLens === 'object'
      ? {
          key: normaliseScenarioKey(pattern.scenarioLens.key || pattern.lensKey || 'general'),
          label: toSafeString(pattern.scenarioLens.label || pattern.lensLabel || 'General enterprise risk', 120),
          functionKey: toSafeString(pattern.scenarioLens.functionKey || pattern.functionKey || '', 80).toLowerCase()
        }
      : null,
    title: toSafeString(pattern.title, 220),
    scenarioType: toSafeString(pattern.scenarioType, 220),
    geography: toSafeString(pattern.geography, 120),
    narrative: toSafeString(pattern.narrative, 800),
    guidedInput: isPlainObject(pattern.guidedInput)
      ? {
          event: toSafeString(pattern.guidedInput.event, 220),
          asset: toSafeString(pattern.guidedInput.asset, 160),
          cause: toSafeString(pattern.guidedInput.cause, 220),
          impact: toSafeString(pattern.guidedInput.impact, 220),
          urgency: toSafeString(pattern.guidedInput.urgency, 40)
        }
      : {},
    selectedRiskTitles: Array.isArray(pattern.selectedRiskTitles)
      ? pattern.selectedRiskTitles.map(item => toSafeString(item, 160)).filter(Boolean).slice(0, 6)
      : [],
    applicableRegulations: Array.isArray(pattern.applicableRegulations)
      ? pattern.applicableRegulations.map(item => toSafeString(item, 120)).filter(Boolean).slice(0, 8)
      : [],
    posture: toSafeString(pattern.posture, 60),
    confidenceLabel: toSafeString(pattern.confidenceLabel || 'Moderate confidence', 120),
    topGap: toSafeString(pattern.topGap, 220),
    keyRecommendation: toSafeString(pattern.keyRecommendation, 220),
    completedAt: Number(pattern.completedAt || Date.now()),
    submittedBy: toSafeUsername(pattern.submittedBy)
  };
}

function appendPattern(patterns, pattern) {
  const next = [pattern, ...(Array.isArray(patterns) ? patterns : []).filter(item => item?.id !== pattern.id)];
  return next.slice(0, 180);
}

function computeCalibrationAverages(samples = []) {
  const validSamples = Array.isArray(samples) ? samples : [];
  const count = validSamples.length;
  const total = validSamples.reduce((acc, sample) => {
    acc.final += Number(sample.finalValue || 0);
    acc.suggested += Number(sample.suggestedValue || 0);
    acc.absolute += Number(sample.absoluteDelta || 0);
    acc.ratio += Number(sample.ratioDelta || 0);
    return acc;
  }, { final: 0, suggested: 0, absolute: 0, ratio: 0 });
  return {
    sampleCount: count,
    avgFinalValue: count ? total.final / count : 0,
    avgSuggestedValue: count ? total.suggested / count : 0,
    avgAbsoluteDelta: count ? total.absolute / count : 0,
    avgRatioDelta: count ? total.ratio / count : 0
  };
}

function updateCalibrationStore(store, payload = {}) {
  const next = isPlainObject(store) ? { ...store } : createEmptyCalibrationStore();
  next.scenarioTypes = isPlainObject(next.scenarioTypes) ? { ...next.scenarioTypes } : {};
  const scenarioKey = normaliseScenarioKey(
    payload.scenarioKey
    || payload.scenarioLensKey
    || payload.lensKey
    || payload.scenarioType
    || 'general'
  );
  const scenarioEntry = isPlainObject(next.scenarioTypes[scenarioKey])
    ? { ...next.scenarioTypes[scenarioKey] }
    : { label: toSafeString(payload.scenarioLabel || payload.scenarioLensLabel || payload.scenarioType || scenarioKey, 160), sampleCount: 0, fields: {} };
  scenarioEntry.fields = isPlainObject(scenarioEntry.fields) ? { ...scenarioEntry.fields } : {};
  const fields = isPlainObject(payload.fields) ? payload.fields : {};
  Object.entries(fields).forEach(([fieldName, fieldPayload]) => {
    const suggestedValue = toNumberOrNull(fieldPayload?.suggestedValue);
    const finalValue = toNumberOrNull(fieldPayload?.finalValue);
    if (!Number.isFinite(suggestedValue) || !Number.isFinite(finalValue)) return;
    const absoluteDelta = Number(finalValue - suggestedValue);
    const ratioDelta = Math.abs(suggestedValue) > 0.0001 ? ((finalValue - suggestedValue) / suggestedValue) : 0;
    const fieldEntry = isPlainObject(scenarioEntry.fields[fieldName])
      ? { ...scenarioEntry.fields[fieldName] }
      : { samples: [], byBu: {} };
    const sample = {
      recordedAt: Number(payload.recordedAt || Date.now()),
      assessmentId: toSafeString(payload.assessmentId, 120),
      buId: toSafeString(payload.buId, 80),
      buName: toSafeString(payload.buName, 160),
      suggestedValue,
      finalValue,
      absoluteDelta,
      ratioDelta
    };
    const samples = [sample, ...(Array.isArray(fieldEntry.samples) ? fieldEntry.samples : [])].slice(0, 40);
    const averages = computeCalibrationAverages(samples);
    const byBu = isPlainObject(fieldEntry.byBu) ? { ...fieldEntry.byBu } : {};
    if (sample.buId) {
      const nextBuSamples = [sample, ...((byBu[sample.buId]?.samples) || [])].slice(0, 20);
      const buAverages = computeCalibrationAverages(nextBuSamples);
      byBu[sample.buId] = {
        buId: sample.buId,
        buName: sample.buName,
        samples: nextBuSamples,
        sampleCount: buAverages.sampleCount,
        avgFinalValue: buAverages.avgFinalValue,
        avgSuggestedValue: buAverages.avgSuggestedValue,
        avgAbsoluteDelta: buAverages.avgAbsoluteDelta,
        avgRatioDelta: buAverages.avgRatioDelta
      };
    }
    scenarioEntry.fields[fieldName] = {
      ...fieldEntry,
      ...averages,
      samples,
      byBu
    };
  });
  scenarioEntry.sampleCount = Object.values(scenarioEntry.fields).reduce((max, entry) => Math.max(max, Number(entry?.sampleCount || 0)), 0);
  next.scenarioTypes[scenarioKey] = scenarioEntry;
  next.updatedAt = Date.now();
  return next;
}

function appendDecision(decisions, decision = {}) {
  const item = {
    id: toSafeString(decision.id || buildEntityId('decision'), 120),
    assessmentId: toSafeString(decision.assessmentId, 120),
    buId: toSafeString(decision.buId, 80),
    buName: toSafeString(decision.buName, 160),
    scenarioLensKey: normaliseScenarioKey(decision.scenarioLensKey || decision.lensKey || decision.scenarioType || 'general'),
    scenarioLensLabel: toSafeString(decision.scenarioLensLabel || decision.scenarioType || 'General enterprise risk', 160),
    scenarioTitle: toSafeString(decision.scenarioTitle, 220),
    decision: toSafeString(decision.decision, 80).toLowerCase(),
    reviewNote: toSafeString(decision.reviewNote, 280),
    challengedAssumption: toSafeString(decision.challengedAssumption || decision.reviewNote, 280),
    reviewedBy: toSafeUsername(decision.reviewedBy),
    reviewedAt: Number(decision.reviewedAt || Date.now()),
    submittedAt: Number(decision.submittedAt || 0),
    p90Loss: Number(decision.p90Loss || 0),
    aleMean: Number(decision.aleMean || 0)
  };
  return [item, ...(Array.isArray(decisions) ? decisions : [])].slice(0, 240);
}

function normaliseReasonTag(value) {
  return toSafeString(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normaliseRuntimeMode(value) {
  const raw = toSafeString(value, 40).toLowerCase();
  if (raw === 'live_ai' || raw === 'live-ai' || raw === 'live') return 'live_ai';
  if (raw === 'fallback' || raw === 'stub') return 'fallback';
  return 'local';
}

function normaliseFeedbackTarget(value) {
  const raw = toSafeString(value, 40).toLowerCase();
  if (raw === 'shortlist') return 'shortlist';
  if (raw === 'risk' || raw === 'risk-card' || raw === 'risk_card') return 'risk';
  return 'draft';
}

function normaliseTitleList(list, limit = 10, max = 160) {
  return Array.from(new Set(
    (Array.isArray(list) ? list : [])
      .map(item => toSafeString(item, max))
      .filter(Boolean)
  )).slice(0, limit);
}

function normaliseCitationList(list) {
  return (Array.isArray(list) ? list : [])
    .map(item => ({
      docId: toSafeString(item?.docId || item?.id, 120),
      title: toSafeString(item?.title || item?.sourceTitle, 180),
      tags: normaliseTitleList(item?.tags, 8, 60)
    }))
    .filter(item => item.docId || item.title)
    .slice(0, 8);
}

function normaliseFeedbackEvent(event = {}, session = {}) {
  const score = Math.max(1, Math.min(5, Math.round(Number(event.score || 0))));
  return {
    id: toSafeString(event.id || buildEntityId('feedback'), 120),
    target: normaliseFeedbackTarget(event.target),
    recordedAt: Number(event.recordedAt || Date.now()),
    runtimeMode: normaliseRuntimeMode(event.runtimeMode),
    buId: toSafeString(event.buId, 80),
    buName: toSafeString(event.buName, 160),
    functionKey: toSafeString(event.functionKey, 80).toLowerCase(),
    lensKey: normaliseScenarioKey(event.lensKey || event.scenarioLensKey || event.scenarioType || 'general'),
    score,
    reasons: Array.from(new Set((Array.isArray(event.reasons) ? event.reasons : []).map(normaliseReasonTag).filter(Boolean))).slice(0, 6),
    scenarioFingerprint: toSafeString(event.scenarioFingerprint, 260),
    outputFingerprint: toSafeString(event.outputFingerprint, 260),
    riskId: toSafeString(event.riskId, 120),
    riskTitle: toSafeString(event.riskTitle, 180),
    riskCategory: toSafeString(event.riskCategory, 90),
    riskSource: toSafeString(event.riskSource, 40),
    selectedInAssessment: event.selectedInAssessment === true ? true : event.selectedInAssessment === false ? false : null,
    shownRiskTitles: normaliseTitleList(event.shownRiskTitles, 10),
    keptRiskTitles: normaliseTitleList(event.keptRiskTitles, 10),
    removedRiskTitles: normaliseTitleList(event.removedRiskTitles, 10),
    addedRiskTitles: normaliseTitleList(event.addedRiskTitles, 10),
    citations: normaliseCitationList(event.citations),
    submittedBy: toSafeUsername(event.submittedBy || session?.username)
  };
}

function appendFeedbackEvent(store, event = {}, session = {}) {
  const next = isPlainObject(store) ? { ...store } : createEmptyFeedbackStore();
  next.events = Array.isArray(next.events) ? next.events.slice() : [];
  const item = normaliseFeedbackEvent(event, session);
  if (!item.score) return next;
  next.events = [item, ...next.events.filter(existing => existing?.id !== item.id)].slice(0, 600);
  next.updatedAt = Date.now();
  return next;
}

function updateCoverageMap(map, payload = {}) {
  const next = isPlainObject(map) ? { ...map } : { updatedAt: 0, scenarioTypes: {} };
  next.scenarioTypes = isPlainObject(next.scenarioTypes) ? { ...next.scenarioTypes } : {};
  const scenarioKey = normaliseScenarioKey(
    payload.scenarioKey
    || payload.scenarioLensKey
    || payload.lensKey
    || payload.scenarioType
    || 'general'
  );
  const current = isPlainObject(next.scenarioTypes[scenarioKey])
    ? { ...next.scenarioTypes[scenarioKey] }
    : { label: toSafeString(payload.scenarioLabel || payload.scenarioLensLabel || payload.scenarioType || scenarioKey, 160), count: 0, lastAssessedAt: 0, byBu: {} };
  current.count = Number(current.count || 0) + 1;
  current.lastAssessedAt = Number(payload.completedAt || Date.now());
  current.byBu = isPlainObject(current.byBu) ? { ...current.byBu } : {};
  const buId = toSafeString(payload.buId, 80);
  if (buId) {
    const buEntry = isPlainObject(current.byBu[buId]) ? { ...current.byBu[buId] } : { buId, buName: toSafeString(payload.buName, 160), count: 0, lastAssessedAt: 0 };
    buEntry.count = Number(buEntry.count || 0) + 1;
    buEntry.lastAssessedAt = Number(payload.completedAt || Date.now());
    current.byBu[buId] = buEntry;
  }
  next.scenarioTypes[scenarioKey] = current;
  next.updatedAt = Date.now();
  return next;
}

module.exports = async function handler(req, res) {
  const body = parseRequestBody(req);
  applyCorsHeaders(req, res, {
    methods: 'GET,POST,OPTIONS',
    headers: 'content-type,x-session-token'
  });

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    sendApiError(res, 403, 'FORBIDDEN', 'Request origin is not allowed.');
    return;
  }

  if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
    sendApiError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    return;
  }

  if (req.method === 'POST' && !isPlainObject(body)) {
    sendApiError(res, 400, 'VALIDATION_ERROR', 'Invalid request body.');
    return;
  }

  try {
    if (req.method === 'GET') {
      const session = requireSession(req, res);
      if (!session) return;
      const [patterns, calibration, decisions, coverageMap, feedback] = await Promise.all([
        readJsonKey(ORG_PATTERNS_KEY, []),
        readJsonKey(ORG_CALIBRATION_KEY, createEmptyCalibrationStore()),
        readJsonKey(DECISION_HISTORY_KEY, []),
        readJsonKey(COVERAGE_MAP_KEY, { updatedAt: 0, scenarioTypes: {} }),
        readJsonKey(AI_FEEDBACK_KEY, createEmptyFeedbackStore())
      ]);
      res.status(200).json({
        patterns: Array.isArray(patterns) ? patterns : [],
        calibration: isPlainObject(calibration) ? calibration : createEmptyCalibrationStore(),
        decisions: Array.isArray(decisions) ? decisions : [],
        coverageMap: isPlainObject(coverageMap) ? coverageMap : { updatedAt: 0, scenarioTypes: {} },
        feedback: isPlainObject(feedback) ? feedback : createEmptyFeedbackStore()
      });
      return;
    }

    if (req.method === 'POST') {
      const session = requireSession(req, res);
      if (!session) return;
      if (getUnexpectedFields(body, ['calibration', 'coverage', 'decision', 'feedback', 'pattern', 'type']).length) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'Unexpected fields were included in the org intelligence request.');
        return;
      }
      const type = toSafeString(body.type, 80).toLowerCase();
      if (!type) {
        sendApiError(res, 400, 'VALIDATION_ERROR', 'type is required.');
        return;
      }
      if (type === 'record_assessment') {
        const pattern = normalisePattern(body.pattern || {});
        const calibrationPayload = isPlainObject(body.calibration) ? body.calibration : null;
        const coveragePayload = isPlainObject(body.coverage) ? body.coverage : null;
        const [patterns, calibration, coverageMap] = await Promise.all([
          readJsonKey(ORG_PATTERNS_KEY, []),
          readJsonKey(ORG_CALIBRATION_KEY, createEmptyCalibrationStore()),
          readJsonKey(COVERAGE_MAP_KEY, { updatedAt: 0, scenarioTypes: {} })
        ]);
        const nextPatterns = pattern.assessmentId ? appendPattern(patterns, pattern) : patterns;
        const nextCalibration = calibrationPayload ? updateCalibrationStore(calibration, calibrationPayload) : calibration;
        const nextCoverage = coveragePayload ? updateCoverageMap(coverageMap, coveragePayload) : coverageMap;
        await Promise.all([
          writeJsonKey(ORG_PATTERNS_KEY, nextPatterns),
          writeJsonKey(ORG_CALIBRATION_KEY, nextCalibration),
          writeJsonKey(COVERAGE_MAP_KEY, nextCoverage)
        ]);
        res.status(200).json({ ok: true, patterns: nextPatterns, calibration: nextCalibration, coverageMap: nextCoverage });
        return;
      }
      if (type === 'record_decision') {
        const decision = body.decision || {};
        const decisions = await readJsonKey(DECISION_HISTORY_KEY, []);
        const nextDecisions = appendDecision(decisions, decision);
        await writeJsonKey(DECISION_HISTORY_KEY, nextDecisions);
        res.status(200).json({ ok: true, decisions: nextDecisions });
        return;
      }
      if (type === 'record_feedback') {
        const feedback = await readJsonKey(AI_FEEDBACK_KEY, createEmptyFeedbackStore());
        const nextFeedback = appendFeedbackEvent(feedback, body.feedback || {}, session);
        await writeJsonKey(AI_FEEDBACK_KEY, nextFeedback);
        res.status(200).json({ ok: true, feedback: nextFeedback });
        return;
      }
      sendApiError(res, 400, 'VALIDATION_ERROR', 'Unsupported type.');
      return;
    }

    sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  } catch (error) {
    console.error('Org intelligence request failed.', error);
    sendApiError(res, 500, 'ORG_INTELLIGENCE_ERROR', 'The org intelligence request could not be processed.');
  }
};
