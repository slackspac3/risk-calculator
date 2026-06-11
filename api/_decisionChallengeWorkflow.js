'use strict';

const { buildTraceEntry, callAi, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
const { buildFallbackFromError, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const AssessmentTypeModel = require('../assets/state/assessmentTypeModel.js');
const DecisionSupportModel = require('../assets/state/decisionSupportModel.js');

const MAX_PROMPT_CHARS = 28000;
const DECISION_CHALLENGE_SCHEMA = `{
  "challengeSummary": "string",
  "decisionRisks": [
    {
      "title": "string",
      "severity": "high|medium|low",
      "explanation": "string",
      "recommendedAction": "string"
    }
  ],
  "sensitivityFlags": [
    {
      "driver": "string",
      "whySensitive": "string",
      "metricAffected": "string",
      "direction": "increases_risk|decreases_risk|uncertain",
      "sourceStatus": "known|estimated|derived|benchmark_proxy|unknown|not_applicable|evidence_supported"
    }
  ],
  "missingEvidence": ["string"],
  "recommendedStressTests": [
    {
      "id": "string",
      "title": "string",
      "rationale": "string",
      "parameterPatch": {},
      "expectedDecisionImpact": "string",
      "confidence": "high|medium|low",
      "testsUnknownField": "string"
    }
  ],
  "changedDecisionIf": [
    {
      "condition": "string",
      "fromDecision": "string",
      "toDecision": "string",
      "reason": "string"
    }
  ]
}`;

const ASSESSMENT_TYPE_PROJECT_BUYER = AssessmentTypeModel.ASSESSMENT_TYPE_PROJECT_BUYER || 'project_buyer';
const ASSESSMENT_TYPE_PROJECT_SELLER = AssessmentTypeModel.ASSESSMENT_TYPE_PROJECT_SELLER || 'project_seller';
const SEVERITIES = new Set(['high', 'medium', 'low']);
const DIRECTIONS = new Set(['increases_risk', 'decreases_risk', 'uncertain']);
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const SOURCE_STATUSES = new Set(['known', 'estimated', 'derived', 'benchmark_proxy', 'unknown', 'not_applicable', 'evidence_supported']);
const NUMERIC_PATCH_KEYS = new Set([
  'iterations',
  'seed',
  'threshold',
  'annualReviewThreshold',
  'tefMin',
  'tefLikely',
  'tefMax',
  'vulnMin',
  'vulnLikely',
  'vulnMax',
  'threatCapMin',
  'threatCapLikely',
  'threatCapMax',
  'controlStrMin',
  'controlStrLikely',
  'controlStrMax',
  'irMin',
  'irLikely',
  'irMax',
  'biMin',
  'biLikely',
  'biMax',
  'dbMin',
  'dbLikely',
  'dbMax',
  'rlMin',
  'rlLikely',
  'rlMax',
  'tpMin',
  'tpLikely',
  'tpMax',
  'rcMin',
  'rcLikely',
  'rcMax',
  'secProbMin',
  'secProbLikely',
  'secProbMax',
  'secMagMin',
  'secMagLikely',
  'secMagMax',
  'corrBiIr',
  'corrRlRc',
  'projectDurationMonths',
  'projectHorizonYears',
  'projectValue',
  'projectMargin'
]);
const BOOLEAN_PATCH_KEYS = new Set(['vulnDirect', 'secondaryEnabled', 'projectHorizonEnabled']);
const STRING_PATCH_KEYS = new Set([
  'distType',
  'assessmentType',
  'projectDurationSourceStatus',
  'projectDurationConfidence',
  'projectValueSourceStatus',
  'projectMarginSourceStatus'
]);
const RANGE_GROUPS = Object.freeze([
  ['tefMin', 'tefLikely', 'tefMax'],
  ['vulnMin', 'vulnLikely', 'vulnMax'],
  ['threatCapMin', 'threatCapLikely', 'threatCapMax'],
  ['controlStrMin', 'controlStrLikely', 'controlStrMax'],
  ['irMin', 'irLikely', 'irMax'],
  ['biMin', 'biLikely', 'biMax'],
  ['dbMin', 'dbLikely', 'dbMax'],
  ['rlMin', 'rlLikely', 'rlMax'],
  ['tpMin', 'tpLikely', 'tpMax'],
  ['rcMin', 'rcLikely', 'rcMax'],
  ['secProbMin', 'secProbLikely', 'secProbMax'],
  ['secMagMin', 'secMagLikely', 'secMagMax']
]);
const RANGE_LIMITS = Object.freeze({
  tef: { min: 0 },
  vuln: { min: 0, max: 1 },
  threatCap: { min: 0, max: 1 },
  controlStr: { min: 0, max: 1 },
  secProb: { min: 0, max: 1 }
});
const BUYER_UNKNOWN_FIELDS = new Set([
  'delayCostPerDay',
  'delayDurationDays',
  'expectedBenefitPerDay',
  'remainingSpend',
  'reprocurementPremiumPct',
  'amountPaid',
  'amountCommitted',
  'supplierCredits',
  'insuranceRecoveries',
  'liquidatedDamagesRecoverable',
  'contractualRecoveryCap'
]);
const SELLER_UNKNOWN_FIELDS = new Set([
  'grossMarginPct',
  'contributionMargin',
  'costToCure',
  'liquidatedDamagesCap',
  'slaCreditsCap',
  'liabilityCap',
  'terminationExposure',
  'renewalValueAtRisk',
  'revenueRecognitionAtRisk',
  'contractValue',
  'expectedRevenue'
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function compactObject(value) {
  if (!isPlainObject(value)) return {};
  return Object.keys(value).reduce((output, key) => {
    const item = value[key];
    if (item !== undefined) output[key] = item;
    return output;
  }, {});
}

function cleanText(value = '', maxChars = 600) {
  return sanitizeAiText(String(value ?? '').replace(/\s+/g, ' ').trim(), { maxChars });
}

function cleanBlock(value = '', maxChars = 4000) {
  return sanitizeAiText(String(value ?? '').replace(/\r\n?/g, '\n').trim(), { maxChars });
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function cleanStringList(items = [], { maxItems = 12, maxChars = 240 } = {}) {
  const raw = Array.isArray(items) ? items : items === null || items === undefined ? [] : [items];
  const seen = new Set();
  const output = [];
  raw.forEach((item) => {
    const text = isPlainObject(item)
      ? cleanText(item.item || item.title || item.claim || item.field || item.label || item.statement || item.question || item.id || '', maxChars)
      : cleanText(item, maxChars);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (output.length < maxItems) output.push(text);
  });
  return output;
}

function normaliseLooseValue(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' || typeof value === 'bigint') return cleanText(value, 1200);
  if (Array.isArray(value)) {
    if (depth >= 3) return [];
    return value.slice(0, 30).map(item => normaliseLooseValue(item, depth + 1)).filter(item => item !== undefined && item !== '');
  }
  if (isPlainObject(value)) {
    if (depth >= 3) return {};
    const output = {};
    Object.keys(value).slice(0, 30).forEach((key) => {
      const cleanKey = cleanText(key, 120);
      if (!cleanKey) return;
      const item = normaliseLooseValue(value[key], depth + 1);
      if (item !== undefined && item !== '') output[cleanKey] = item;
    });
    return output;
  }
  return null;
}

function normaliseLooseObject(value = {}) {
  const result = normaliseLooseValue(value);
  return isPlainObject(result) ? result : {};
}

function normaliseConfidence(value, fallback = 'unknown') {
  const next = cleanText(value, 80).toLowerCase();
  return CONFIDENCE_VALUES.has(next) ? next : fallback;
}

function normaliseSourceStatus(value, fallback = 'unknown') {
  const next = DecisionSupportModel.normaliseSourceStatus(value || fallback);
  return SOURCE_STATUSES.has(next) ? next : fallback;
}

function normaliseSeverity(value, fallback = 'medium') {
  const next = cleanText(value, 80).toLowerCase();
  return SEVERITIES.has(next) ? next : fallback;
}

function normaliseDirection(value, fallback = 'uncertain') {
  const next = cleanText(value, 80).toLowerCase();
  return DIRECTIONS.has(next) ? next : fallback;
}

function normaliseParameters(value = {}) {
  if (!isPlainObject(value)) return {};
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    if (NUMERIC_PATCH_KEYS.has(key)) {
      const number = finiteNumber(item);
      if (number !== null) output[key] = number;
      return;
    }
    if (BOOLEAN_PATCH_KEYS.has(key)) {
      output[key] = item === true || item === 'true' || item === 1 || item === '1';
      return;
    }
    if (STRING_PATCH_KEYS.has(key)) {
      const text = cleanText(item, 120);
      if (text) output[key] = text;
    }
  });
  return output;
}

function clampPatchRangeValue(key, value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  const group = Object.keys(RANGE_LIMITS).find(prefix => key.startsWith(prefix));
  const limits = group ? RANGE_LIMITS[group] : { min: 0 };
  let next = number;
  if (limits.min !== undefined) next = Math.max(limits.min, next);
  if (limits.max !== undefined) next = Math.min(limits.max, next);
  return next;
}

function orderPatchRanges(patch = {}) {
  const output = { ...patch };
  RANGE_GROUPS.forEach(([minKey, likelyKey, maxKey]) => {
    const presentKeys = [minKey, likelyKey, maxKey].filter(key => Object.prototype.hasOwnProperty.call(output, key));
    if (presentKeys.length !== 3) return;
    const values = [minKey, likelyKey, maxKey].map(key => clampPatchRangeValue(key, output[key]));
    if (values.some(value => value === null)) {
      presentKeys.forEach(key => delete output[key]);
      return;
    }
    values.sort((left, right) => left - right);
    output[minKey] = values[0];
    output[likelyKey] = values[1];
    output[maxKey] = values[2];
  });
  return output;
}

function normaliseParameterPatch(value = {}) {
  if (!isPlainObject(value)) return {};
  const patch = {};
  Object.entries(value).forEach(([rawKey, rawValue]) => {
    const key = cleanText(rawKey, 80);
    if (NUMERIC_PATCH_KEYS.has(key)) {
      const number = finiteNumber(rawValue);
      if (number !== null) patch[key] = number;
      return;
    }
    if (BOOLEAN_PATCH_KEYS.has(key)) {
      if (rawValue === true || rawValue === false) patch[key] = rawValue;
      else if (typeof rawValue === 'string' && /^(true|false)$/i.test(rawValue.trim())) patch[key] = rawValue.trim().toLowerCase() === 'true';
      return;
    }
    if (STRING_PATCH_KEYS.has(key)) {
      const text = cleanText(rawValue, 120);
      if (!text) return;
      if (key === 'distType' && !['triangular', 'lognormal'].includes(text)) return;
      if (key.endsWith('SourceStatus') && !SOURCE_STATUSES.has(DecisionSupportModel.normaliseSourceStatus(text))) return;
      patch[key] = text;
    }
  });
  return orderPatchRanges(patch);
}

function normaliseDecisionRisk(item = {}, index = 0) {
  if (!isPlainObject(item)) return null;
  const title = cleanText(item.title || `Decision risk ${index + 1}`, 180);
  const explanation = cleanBlock(item.explanation || item.reason || item.detail || '', 800);
  if (!title && !explanation) return null;
  return {
    title: title || `Decision risk ${index + 1}`,
    severity: normaliseSeverity(item.severity),
    explanation,
    recommendedAction: cleanBlock(item.recommendedAction || item.action || '', 600)
  };
}

function normaliseSensitivityFlag(item = {}, index = 0) {
  if (!isPlainObject(item)) return null;
  const driver = cleanText(item.driver || item.field || item.label || `Sensitivity ${index + 1}`, 180);
  const whySensitive = cleanBlock(item.whySensitive || item.why || item.rationale || '', 700);
  if (!driver && !whySensitive) return null;
  return {
    driver: driver || `Sensitivity ${index + 1}`,
    whySensitive,
    metricAffected: cleanText(item.metricAffected || item.metric || item.mapsTo || '', 180),
    direction: normaliseDirection(item.direction),
    sourceStatus: normaliseSourceStatus(item.sourceStatus || item.status)
  };
}

function normaliseStressTest(item = {}, index = 0) {
  if (!isPlainObject(item)) return null;
  const parameterPatch = normaliseParameterPatch(item.parameterPatch || item.patch || {});
  if (!Object.keys(parameterPatch).length) return null;
  const id = cleanText(item.id || `stress_${index + 1}`, 120).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || `stress_${index + 1}`;
  return {
    id,
    title: cleanText(item.title || `Stress case ${index + 1}`, 180),
    rationale: cleanBlock(item.rationale || item.why || '', 700),
    parameterPatch,
    expectedDecisionImpact: cleanBlock(item.expectedDecisionImpact || item.impact || '', 700),
    confidence: normaliseConfidence(item.confidence, 'medium') === 'unknown' ? 'medium' : normaliseConfidence(item.confidence, 'medium'),
    testsUnknownField: cleanText(item.testsUnknownField || item.field || '', 180)
  };
}

function normaliseChangedDecisionIf(item = {}, index = 0) {
  if (!isPlainObject(item)) return null;
  const condition = cleanBlock(item.condition || item.if || `Condition ${index + 1}`, 500);
  if (!condition) return null;
  return {
    condition,
    fromDecision: cleanText(item.fromDecision || item.from || '', 180),
    toDecision: cleanText(item.toDecision || item.to || '', 180),
    reason: cleanBlock(item.reason || item.why || '', 600)
  };
}

function dedupeBy(items = [], keyFn = null, maxItems = 50) {
  const seen = new Set();
  const output = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item) return;
    const key = String(typeof keyFn === 'function' ? keyFn(item) : JSON.stringify(item)).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (output.length < maxItems) output.push(item);
  });
  return output;
}

function normaliseDecisionChallengeForApi(challenge = {}, fallback = {}) {
  const source = isPlainObject(challenge) ? challenge : {};
  const fallbackSource = isPlainObject(fallback) ? fallback : {};
  const model = DecisionSupportModel.buildDecisionChallenge(source);
  const fallbackModel = DecisionSupportModel.buildDecisionChallenge(fallbackSource);
  return {
    challengeSummary: cleanBlock(source.challengeSummary || model.challengeSummary || fallbackSource.challengeSummary || fallbackModel.challengeSummary || '', 1000),
    decisionRisks: dedupeBy([
      ...(Array.isArray(source.decisionRisks) ? source.decisionRisks : model.decisionRisks),
      ...(Array.isArray(fallbackSource.decisionRisks) ? fallbackSource.decisionRisks : fallbackModel.decisionRisks)
    ].map(normaliseDecisionRisk).filter(Boolean), item => item.title, 8),
    sensitivityFlags: dedupeBy([
      ...(Array.isArray(source.sensitivityFlags) ? source.sensitivityFlags : model.sensitivityFlags),
      ...(Array.isArray(fallbackSource.sensitivityFlags) ? fallbackSource.sensitivityFlags : fallbackModel.sensitivityFlags)
    ].map(normaliseSensitivityFlag).filter(Boolean), item => `${item.driver}:${item.metricAffected}`, 10),
    missingEvidence: dedupeBy([
      ...cleanStringList(source.missingEvidence, { maxItems: 20, maxChars: 260 }),
      ...cleanStringList(fallbackSource.missingEvidence, { maxItems: 20, maxChars: 260 })
    ], item => item, 10),
    recommendedStressTests: dedupeBy([
      ...(Array.isArray(source.recommendedStressTests) ? source.recommendedStressTests : model.recommendedStressTests),
      ...(Array.isArray(fallbackSource.recommendedStressTests) ? fallbackSource.recommendedStressTests : fallbackModel.recommendedStressTests)
    ].map(normaliseStressTest).filter(Boolean), item => item.id || item.title, 3),
    changedDecisionIf: dedupeBy([
      ...(Array.isArray(source.changedDecisionIf) ? source.changedDecisionIf : model.changedDecisionIf),
      ...(Array.isArray(fallbackSource.changedDecisionIf) ? fallbackSource.changedDecisionIf : fallbackModel.changedDecisionIf)
    ].map(normaliseChangedDecisionIf).filter(Boolean), item => item.condition, 6)
  };
}

function cleanPriorMessages(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter(isPlainObject)
    .map((item) => ({
      role: String(item.role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user',
      content: cleanBlock(item.content || '', 3000)
    }))
    .filter((item) => item.content)
    .slice(-8);
}

function normaliseDecisionChallengeWorkflowInput(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const assessmentType = AssessmentTypeModel.normaliseAssessmentType(source.assessmentType);
  return compactObject({
    assessmentType,
    scenario: cleanBlock(source.scenario || source.riskStatement || source.narrative || '', 5000),
    structuredScenario: normaliseLooseObject(source.structuredScenario),
    scenarioLens: normaliseLooseValue(source.scenarioLens),
    projectContext: AssessmentTypeModel.normaliseProjectContext(isPlainObject(source.projectContext) ? source.projectContext : {}, assessmentType),
    projectExposure: AssessmentTypeModel.normaliseProjectExposure(isPlainObject(source.projectExposure) ? source.projectExposure : {}),
    parameters: normaliseParameters(source.parameters),
    simulationResult: normaliseLooseObject(source.simulationResult || source.results),
    assumptionRegister: DecisionSupportModel.buildAssumptionRegister(isPlainObject(source.assumptionRegister) ? source.assumptionRegister : {}),
    parameterCoach: DecisionSupportModel.buildParameterCoach(isPlainObject(source.parameterCoach) ? source.parameterCoach : {}),
    evidenceMap: DecisionSupportModel.buildEvidenceMap(isPlainObject(source.evidenceMap) ? source.evidenceMap : {}),
    treatments: normaliseLooseValue(source.treatments),
    riskAppetite: normaliseLooseObject(source.riskAppetite),
    adminSettings: normaliseLooseObject(source.adminSettings),
    traceLabel: cleanText(source.traceLabel || '', 160) || 'Decision challenge',
    priorMessages: cleanPriorMessages(source.priorMessages)
  });
}

function getResultMean(results = {}) {
  return finiteNumber(results?.annualLoss?.mean) ?? finiteNumber(results?.ale?.mean) ?? 0;
}

function getResultP90(results = {}) {
  return finiteNumber(results?.annualLoss?.p90) ?? finiteNumber(results?.ale?.p90) ?? finiteNumber(results?.eventLoss?.p90) ?? 0;
}

function getThreshold(input = {}) {
  return finiteNumber(input?.simulationResult?.threshold)
    ?? finiteNumber(input?.parameters?.threshold)
    ?? finiteNumber(input?.riskAppetite?.threshold)
    ?? finiteNumber(input?.riskAppetite?.eventTolerance)
    ?? 5000000;
}

function isNearThreshold(input = {}) {
  const threshold = getThreshold(input);
  const p90 = getResultP90(input.simulationResult);
  const mean = getResultMean(input.simulationResult);
  const anchor = p90 || mean;
  if (!(threshold > 0) || !(anchor > 0)) return false;
  const ratio = anchor / threshold;
  return ratio >= 0.8 && ratio <= 1.2;
}

function projectMetricSensitivity(input = {}) {
  const horizon = input?.simulationResult?.projectHorizon;
  if (!isPlainObject(horizon)) return null;
  const spendPct = finiteNumber(horizon.lossAsPctOfProjectValue);
  const marginPct = finiteNumber(horizon.lossAsPctOfMargin);
  const pct = spendPct ?? marginPct;
  if (pct === null || pct < 0.1) return null;
  return {
    pct,
    label: marginPct !== null ? 'project margin' : 'project value',
    sourceStatus: normaliseSourceStatus(horizon.lossAsPctOfMarginSourceStatus || horizon.lossAsPctOfProjectValueSourceStatus || horizon.durationSourceStatus || 'estimated')
  };
}

function fieldLabel(value = '') {
  const text = cleanText(value, 120);
  if (!text) return '';
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/Pct\b/g, 'percentage')
    .replace(/\bld\b/i, 'LD')
    .toLowerCase();
}

function extractMissingProjectInputs(projectExposure = {}) {
  const rows = [];
  const add = (item) => {
    if (!item) return;
    if (isPlainObject(item)) {
      const field = cleanText(item.field || item.label || item.id || '', 140);
      const label = cleanText(item.label || item.field || field, 180);
      if (!field && !label) return;
      rows.push({
        field: field || label,
        label: label || field,
        importance: cleanText(item.importance || 'high', 40).toLowerCase() || 'high',
        whyItMatters: cleanBlock(item.whyItMatters || item.why || '', 400),
        whoMightKnow: cleanText(item.whoMightKnow || '', 160),
        suggestedQuestion: cleanBlock(item.suggestedQuestion || '', 400),
        mapsTo: cleanText(item.mapsTo || '', 100)
      });
      return;
    }
    const text = cleanText(item, 160);
    if (text) rows.push({ field: text, label: text, importance: 'high', whyItMatters: '', whoMightKnow: '', suggestedQuestion: '', mapsTo: '' });
  };
  (Array.isArray(projectExposure.missingInputs) ? projectExposure.missingInputs : []).forEach(add);
  const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
  (Array.isArray(quality.unknownHighImpactInputs) ? quality.unknownHighImpactInputs : []).forEach(add);
  const drivers = Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers : [];
  drivers
    .filter(driver => cleanText(driver?.driverStatus).toLowerCase() === 'unquantified_driver')
    .forEach((driver) => {
      const missing = Array.isArray(driver.missingInputs) ? driver.missingInputs : [];
      if (missing.length) missing.forEach(add);
      else add({
        field: driver.id || driver.label,
        label: driver.label || driver.id,
        importance: 'high',
        whyItMatters: driver.rationale || 'This project driver is relevant but not quantified.'
      });
    });
  return dedupeBy(rows, item => item.field || item.label, 12).sort((left, right) => {
    const weights = { high: 3, medium: 2, low: 1 };
    return (weights[right.importance] || 0) - (weights[left.importance] || 0);
  });
}

function hasMissingField(missingInputs = [], fields = new Set()) {
  return missingInputs.find((item) => {
    const field = cleanText(item.field || item.label || '').toLowerCase();
    return Array.from(fields).some(candidate => field === candidate.toLowerCase() || field.includes(candidate.toLowerCase()));
  }) || null;
}

function getParamNumber(parameters = {}, key = '', fallback = 0) {
  const value = finiteNumber(parameters[key]);
  if (value !== null) return value;
  return fallback;
}

function scaleRangePatch(parameters = {}, prefix = '', factor = 1.5) {
  const minKey = `${prefix}Min`;
  const likelyKey = `${prefix}Likely`;
  const maxKey = `${prefix}Max`;
  const min = Math.max(0, getParamNumber(parameters, minKey, 0) * factor);
  const likely = Math.max(min, getParamNumber(parameters, likelyKey, min) * factor);
  const max = Math.max(likely, getParamNumber(parameters, maxKey, likely) * factor);
  return {
    [minKey]: Number(min.toFixed(2)),
    [likelyKey]: Number(likely.toFixed(2)),
    [maxKey]: Number(max.toFixed(2))
  };
}

function buildStressPatch(parameters = {}, type = '') {
  if (type === 'frequency') {
    const likely = getParamNumber(parameters, 'tefLikely', 1);
    return {
      tefLikely: Number(Math.max(0.01, likely * 1.5).toFixed(3)),
      tefMax: Number(Math.max(getParamNumber(parameters, 'tefMax', likely), likely * 2).toFixed(3))
    };
  }
  if (type === 'recovery') return { ...scaleRangePatch(parameters, 'tp', 1.35), ...scaleRangePatch(parameters, 'rl', 1.25) };
  if (type === 'contract') return scaleRangePatch(parameters, 'rl', 1.5);
  if (type === 'seller_margin') return scaleRangePatch(parameters, 'rc', 1.6);
  if (type === 'cost_to_cure') return scaleRangePatch(parameters, 'bi', 1.5);
  if (type === 'secondary') {
    return {
      secondaryEnabled: true,
      ...scaleRangePatch(parameters, 'secMag', 1.5),
      secProbLikely: Math.min(1, Number((getParamNumber(parameters, 'secProbLikely', 0.25) * 1.5).toFixed(3)))
    };
  }
  return scaleRangePatch(parameters, 'bi', 1.5);
}

function buildStressTest({
  id,
  title,
  rationale,
  patchType,
  parameters,
  expectedDecisionImpact,
  confidence = 'medium',
  testsUnknownField = ''
}) {
  return normaliseStressTest({
    id,
    title,
    rationale,
    parameterPatch: buildStressPatch(parameters, patchType),
    expectedDecisionImpact,
    confidence,
    testsUnknownField
  });
}

function collectMissingEvidence(input = {}) {
  const evidenceMap = isPlainObject(input.evidenceMap) ? input.evidenceMap : {};
  const missing = [
    ...cleanStringList(evidenceMap.missingEvidence, { maxItems: 8, maxChars: 260 }),
    ...cleanStringList(evidenceMap.unsupportedClaims, { maxItems: 8, maxChars: 260 })
  ];
  const financialMissing = Array.isArray(evidenceMap.projectFinancialEvidenceMap)
    ? evidenceMap.projectFinancialEvidenceMap
      .filter(item => ['not_found', 'unclear', 'contradicted'].includes(cleanText(item.status).toLowerCase()))
      .map(item => `${item.field || item.label || 'Project value'} is ${item.status || 'not supported by evidence'}.`)
    : [];
  return dedupeBy([...missing, ...financialMissing], item => item, 10);
}

function buildDeterministicDecisionChallenge(input = {}) {
  const assessmentType = input.assessmentType || AssessmentTypeModel.ASSESSMENT_TYPE_GENERIC || 'enterprise_generic';
  const isBuyer = assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER;
  const isSeller = assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER;
  const parameters = isPlainObject(input.parameters) ? input.parameters : {};
  const missingInputs = extractMissingProjectInputs(input.projectExposure || {});
  const missingEvidence = collectMissingEvidence(input);
  const decisionRisks = [];
  const sensitivityFlags = [];
  const stressTests = [];
  const changedDecisionIf = [];

  if (isNearThreshold(input)) {
    decisionRisks.push({
      title: 'Decision is close to tolerance',
      severity: 'high',
      explanation: 'The simulated result sits close enough to the tolerance threshold that modest movement in frequency, vulnerability, or loss magnitude could change the management posture.',
      recommendedAction: 'Run at least one threshold sensitivity stress case before approving the baseline decision.'
    });
    sensitivityFlags.push({
      driver: 'Tolerance threshold',
      whySensitive: 'A small movement in the bad-year or annualized loss estimate could move the result across the review threshold.',
      metricAffected: 'Tolerance exceedance',
      direction: 'uncertain',
      sourceStatus: 'estimated'
    });
    const test = buildStressTest({
      id: 'stress_frequency_near_tolerance',
      title: 'Higher recurrence near tolerance',
      rationale: 'Checks whether a modest increase in event frequency changes the recommendation.',
      patchType: 'frequency',
      parameters,
      expectedDecisionImpact: 'May move the result from proceed/review to active management attention if the threshold is crossed.',
      testsUnknownField: 'event frequency'
    });
    if (test) stressTests.push(test);
    changedDecisionIf.push({
      condition: 'The bad-year or annualized loss estimate moves above the tolerance threshold.',
      fromDecision: 'Current baseline decision',
      toDecision: 'Escalate for management review',
      reason: 'The current decision appears threshold-sensitive.'
    });
  }

  const projectSensitivity = projectMetricSensitivity(input);
  if (projectSensitivity) {
    decisionRisks.push({
      title: 'Project-horizon impact may be decision-sensitive',
      severity: projectSensitivity.pct >= 0.25 ? 'high' : 'medium',
      explanation: `The project-horizon loss is material relative to ${projectSensitivity.label}. Confirm the project value or margin before treating the result as stable.`,
      recommendedAction: 'Compare the project-horizon view with the annualized enterprise view and confirm the value base.'
    });
    sensitivityFlags.push({
      driver: `Loss as percentage of ${projectSensitivity.label}`,
      whySensitive: 'Project-linked percentages can change materially if duration, spend, contract value, or margin is revised.',
      metricAffected: 'Project-horizon loss percentage',
      direction: 'uncertain',
      sourceStatus: projectSensitivity.sourceStatus
    });
  }

  if (missingEvidence.length) {
    decisionRisks.push({
      title: 'Evidence support is incomplete',
      severity: 'medium',
      explanation: 'Some claims or project-financial inputs are unsupported, unclear, or contradicted by the current evidence map.',
      recommendedAction: 'Confirm the top unsupported claim or upload the contract/business case before relying on the decision.'
    });
  }

  const buyerDelay = isBuyer ? hasMissingField(missingInputs, new Set(['delayCostPerDay', 'delayDurationDays', 'expectedBenefitPerDay'])) : null;
  const buyerRecovery = isBuyer ? hasMissingField(missingInputs, new Set(['supplierCredits', 'insuranceRecoveries', 'liquidatedDamagesRecoverable', 'contractualRecoveryCap'])) : null;
  const buyerReprocurement = isBuyer ? hasMissingField(missingInputs, new Set(['remainingSpend', 'reprocurementPremiumPct', 'amountPaid', 'amountCommitted'])) : null;
  const sellerMargin = isSeller ? hasMissingField(missingInputs, new Set(['grossMarginPct', 'contributionMargin', 'contractValue', 'expectedRevenue'])) : null;
  const sellerPenalty = isSeller ? hasMissingField(missingInputs, new Set(['liquidatedDamagesCap', 'slaCreditsCap', 'liabilityCap', 'terminationExposure'])) : null;
  const sellerCure = isSeller ? hasMissingField(missingInputs, new Set(['costToCure', 'warrantyExposure', 'revenueRecognitionAtRisk'])) : null;

  [
    buyerDelay,
    buyerRecovery,
    buyerReprocurement,
    sellerMargin,
    sellerPenalty,
    sellerCure
  ].filter(Boolean).forEach((item) => {
    sensitivityFlags.push({
      driver: item.label || item.field,
      whySensitive: item.whyItMatters || 'This project input is unknown and can change the mapped FAIR loss bucket. It must not be treated as zero.',
      metricAffected: item.mapsTo || 'Project financial exposure',
      direction: 'uncertain',
      sourceStatus: 'unknown'
    });
  });

  if (buyerDelay) {
    const test = buildStressTest({
      id: 'stress_buyer_delay_cost',
      title: 'Higher delay impact',
      rationale: 'Unknown delay cost or duration could make the project buyer exposure materially larger than the baseline.',
      patchType: 'delay',
      parameters,
      expectedDecisionImpact: 'Tests whether the recommendation changes if delay cost is materially higher than currently represented.',
      testsUnknownField: buyerDelay.field || 'delayCostPerDay'
    });
    if (test) stressTests.push(test);
  }
  if (buyerRecovery) {
    const test = buildStressTest({
      id: 'stress_buyer_recovery_gap',
      title: 'No or delayed recovery',
      rationale: 'Unknown recoveries, credits, insurance, or recovery caps should be treated as uncertainty rather than zero or guaranteed offset.',
      patchType: 'recovery',
      parameters,
      expectedDecisionImpact: 'Shows whether the decision changes if recoveries are lower or delayed.',
      testsUnknownField: buyerRecovery.field || 'recoveries'
    });
    if (test) stressTests.push(test);
  }
  if (buyerReprocurement) {
    const test = buildStressTest({
      id: 'stress_buyer_reprocurement',
      title: 'Supplier replacement pressure',
      rationale: 'Unknown remaining spend, committed spend, or reprocurement premium could increase third-party project exposure.',
      patchType: 'recovery',
      parameters,
      expectedDecisionImpact: 'Tests whether supplier replacement economics move the decision into escalation.',
      testsUnknownField: buyerReprocurement.field || 'reprocurement exposure'
    });
    if (test) stressTests.push(test);
  }
  if (sellerMargin) {
    const test = buildStressTest({
      id: 'stress_seller_margin',
      title: 'Margin-at-risk escalation',
      rationale: 'Unknown margin should not be treated as zero margin exposure. This stress case increases reputation/contract loss to reflect margin sensitivity.',
      patchType: 'seller_margin',
      parameters,
      expectedDecisionImpact: 'Tests whether a lower or more exposed margin changes the result.',
      testsUnknownField: sellerMargin.field || 'grossMarginPct'
    });
    if (test) stressTests.push(test);
  }
  if (sellerPenalty) {
    const test = buildStressTest({
      id: 'stress_seller_penalty_cap',
      title: 'LD/SLA or liability cap applies',
      rationale: 'Unknown LD, SLA, liability, or termination exposure should stay a sensitivity flag until the contract confirms the cap.',
      patchType: 'contract',
      parameters,
      expectedDecisionImpact: 'Tests whether penalties or termination exposure change the management posture.',
      testsUnknownField: sellerPenalty.field || 'liquidatedDamagesCap'
    });
    if (test) stressTests.push(test);
  }
  if (sellerCure) {
    const test = buildStressTest({
      id: 'stress_seller_cost_to_cure',
      title: 'Cost-to-cure escalation',
      rationale: 'Unknown delivery recovery effort could increase business interruption or delivery cost exposure.',
      patchType: 'cost_to_cure',
      parameters,
      expectedDecisionImpact: 'Tests whether remediation effort changes the result enough to escalate.',
      testsUnknownField: sellerCure.field || 'costToCure'
    });
    if (test) stressTests.push(test);
  }

  if (!stressTests.length) {
    const test = buildStressTest({
      id: 'stress_secondary_loss',
      title: 'Secondary-loss escalation',
      rationale: 'Checks whether secondary effects, recurrence, or follow-on loss mechanisms change the decision.',
      patchType: 'secondary',
      parameters,
      expectedDecisionImpact: 'May widen the tail and change whether review or treatment is needed.',
      confidence: 'low',
      testsUnknownField: 'secondary loss'
    });
    if (test) stressTests.push(test);
  }

  if (missingInputs.length) {
    decisionRisks.push({
      title: 'High-impact project economics are unknown',
      severity: missingInputs.some(item => item.importance === 'high') ? 'high' : 'medium',
      explanation: 'One or more project economics that could change the decision are still unknown. They should become stress cases, owner questions, or evidence requests.',
      recommendedAction: `Confirm ${fieldLabel(missingInputs[0].label || missingInputs[0].field) || 'the most important project input'} first.`
    });
    changedDecisionIf.push({
      condition: `${missingInputs[0].label || missingInputs[0].field} is materially higher or lower than the current baseline implies.`,
      fromDecision: 'Current baseline decision',
      toDecision: 'Reclassify decision posture after stress case',
      reason: 'The baseline carries this project value as uncertainty, not as zero.'
    });
  }

  const challengeSummary = decisionRisks.length
    ? 'The result can be used as a baseline, but the decision is sensitive to threshold proximity, evidence support, or unresolved project economics. Stress cases should be reviewed before management sign-off.'
    : 'No blocker was found in deterministic challenge review, but the baseline should still be challenged against event frequency, loss magnitude, and evidence support before management reliance.';

  return normaliseDecisionChallengeForApi({
    challengeSummary,
    decisionRisks,
    sensitivityFlags,
    missingEvidence,
    recommendedStressTests: stressTests,
    changedDecisionIf
  });
}

function classifyDecisionChallengeFallbackReason(error = null) {
  const message = String(error?.message || error || '');
  if (/Hosted AI proxy is not configured|AI_PROXY_UNAVAILABLE|COMPASS_API_KEY/i.test(message)) {
    return {
      code: 'hosted_ai_unavailable',
      title: 'Hosted AI unavailable',
      message: 'Hosted AI is not configured, so deterministic decision challenge was used.',
      detail: message
    };
  }
  if (/structured response|JSON|schema|unusable|Unexpected token|malformed/i.test(message)) {
    return {
      code: 'invalid_ai_output',
      title: 'AI output was not usable',
      message: 'The AI response could not be safely converted into the decision challenge schema, so deterministic fallback was used.',
      detail: message
    };
  }
  if (/timed out|timeout/i.test(message)) {
    return {
      code: 'decision_challenge_timeout',
      title: 'AI decision challenge timed out',
      message: 'AI decision challenge timed out, so deterministic fallback was used.',
      detail: message
    };
  }
  return {
    code: 'decision_challenge_ai_failed',
    title: 'AI decision challenge failed',
    message: 'AI decision challenge failed, so deterministic fallback was used.',
    detail: message
  };
}

function buildDeterministicDecisionChallengeResult(options = {}) {
  const wrapped = Object.prototype.hasOwnProperty.call(options, 'input')
    || Object.prototype.hasOwnProperty.call(options, 'aiUnavailable')
    || Object.prototype.hasOwnProperty.call(options, 'fallbackReason')
    || Object.prototype.hasOwnProperty.call(options, 'normalisedError');
  const {
    input = wrapped ? {} : options,
    aiUnavailable = false,
    fallbackReason = null,
    normalisedError = null,
    promptSummary = '',
    response = ''
  } = wrapped ? options : {};
  const decisionChallenge = buildDeterministicDecisionChallenge(input);
  const reason = fallbackReason || {
    code: aiUnavailable ? 'hosted_ai_unavailable' : 'deterministic_decision_challenge',
    title: 'Deterministic decision challenge',
    message: aiUnavailable
      ? 'Hosted AI was unavailable, so deterministic decision challenge was used.'
      : 'The deterministic decision challenge was used.',
    detail: normalisedError ? String(normalisedError.message || normalisedError) : ''
  };
  return {
    mode: 'deterministic_fallback',
    decisionChallenge,
    trace: buildTraceEntry({
      label: input.traceLabel || 'Decision challenge',
      promptSummary,
      response: response || JSON.stringify(decisionChallenge, null, 2),
      sources: []
    }),
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    fallbackReasonCode: reason.code || 'deterministic_decision_challenge',
    fallbackReasonTitle: reason.title || 'Deterministic decision challenge',
    fallbackReasonMessage: reason.message || '',
    fallbackReasonDetail: reason.detail || '',
    generatedAt: new Date().toISOString()
  };
}

function buildSystemPrompt() {
  return `You are a post-simulation Decision Challenge Agent for FAIR-style risk estimates.

Return JSON only. Do not include markdown.

Rules:
- Do not change auth/RBAC or user permissions.
- Do not auto-change the baseline result.
- Focus on what could change the management decision.
- For project buyer risks, challenge sparse delay cost, delay duration, reprocurement premium, recoveries, sunk cost, and remaining spend.
- For project seller risks, challenge sparse margin, cost to cure, LD/SLA cap, termination, renewal, and revenue recognition.
- Unknown recovery, LD caps, delay cost, margin, or cost-to-cure must become sensitivity flags or stress cases; do not treat them as zero.
- Suggest bounded stress cases as parameterPatch objects using only existing FAIR parameter keys.
- Do not generate invalid parameter keys.
- Preserve valid parameter ranges.
- Return only JSON matching this schema:
${DECISION_CHALLENGE_SCHEMA}`;
}

function buildUserPrompt(input = {}, deterministicChallenge = {}) {
  const compactInput = {
    assessmentType: input.assessmentType,
    scenario: input.scenario,
    structuredScenario: input.structuredScenario,
    scenarioLens: input.scenarioLens,
    projectContext: input.projectContext,
    projectExposure: input.projectExposure,
    parameters: input.parameters,
    simulationResult: input.simulationResult,
    assumptionRegister: input.assumptionRegister,
    parameterCoach: input.parameterCoach,
    evidenceMap: input.evidenceMap,
    treatments: input.treatments,
    riskAppetite: input.riskAppetite,
    adminSettings: input.adminSettings
  };
  return `Critique the simulated decision and propose stress cases that could change the management posture.

Use the deterministic baseline below as a guardrail. You may improve wording and ranking, but do not remove unknown high-impact project gaps unless the input marks them known, not applicable, or evidence-supported.

Deterministic baseline:
${JSON.stringify(deterministicChallenge, null, 2)}

Input:
${JSON.stringify(compactInput, null, 2)}

Return only the Decision Challenge JSON object.`;
}

async function buildDecisionChallengeWorkflow(input = {}) {
  const normalisedInput = normaliseDecisionChallengeWorkflowInput(input);
  const deterministic = buildDeterministicDecisionChallenge(normalisedInput);
  const timeouts = buildWorkflowTimeoutProfile({
    liveMs: Number(process.env.DECISION_CHALLENGE_AI_TIMEOUT_MS || 22000),
    repairMs: Number(process.env.DECISION_CHALLENGE_AI_REPAIR_TIMEOUT_MS || 8000)
  });
  try {
    const generation = await callAi(buildSystemPrompt(), buildUserPrompt(normalisedInput, deterministic), {
      taskName: 'decisionChallenge',
      temperature: 0.1,
      maxCompletionTokens: 2800,
      maxPromptChars: MAX_PROMPT_CHARS,
      timeoutMs: timeouts.liveMs,
      priorMessages: normalisedInput.priorMessages
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, DECISION_CHALLENGE_SCHEMA, {
      taskName: 'decisionChallengeRepair',
      timeoutMs: timeouts.repairMs,
      maxCompletionTokens: 2800,
      maxPromptChars: 14000
    });
    const decisionChallenge = normaliseDecisionChallengeForApi(parsed.parsed, deterministic);
    const traces = [
      buildTraceEntry({
        label: normalisedInput.traceLabel || 'Decision challenge',
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: []
      }),
      parsed.trace || null
    ].filter(Boolean);
    return {
      mode: 'live',
      decisionChallenge,
      trace: traces[0] || null,
      traces,
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyDecisionChallengeFallbackReason,
      buildFallbackResult: buildDeterministicDecisionChallengeResult,
      fallbackOptions: {
        input: normalisedInput,
        promptSummary: buildUserPrompt(normalisedInput, deterministic),
        response: String(error?.message || error || '')
      }
    });
  }
}

module.exports = {
  DECISION_CHALLENGE_SCHEMA,
  NUMERIC_PATCH_KEYS,
  BOOLEAN_PATCH_KEYS,
  STRING_PATCH_KEYS,
  buildDecisionChallengeWorkflow,
  buildDeterministicDecisionChallenge,
  buildDeterministicDecisionChallengeResult,
  classifyDecisionChallengeFallbackReason,
  normaliseDecisionChallengeForApi,
  normaliseDecisionChallengeWorkflowInput,
  normaliseParameterPatch
};
