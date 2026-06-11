'use strict';

const { buildTraceEntry, callAi, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
const { buildFallbackFromError, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const AssessmentTypeModel = require('../assets/state/assessmentTypeModel.js');
const DecisionSupportModel = require('../assets/state/decisionSupportModel.js');

const MAX_PROMPT_CHARS = 28000;
const DECISION_BRIEF_SCHEMA = `{
  "recommendation": "string",
  "decisionPosture": "proceed|proceed_with_controls|defer|escalate|reject|needs_more_evidence",
  "why": "string",
  "quantSummary": {
    "eventLossP90": number|null,
    "annualLossMean": number|null,
    "annualLossP90": number|null,
    "toleranceExceeded": boolean,
    "annualReviewTriggered": boolean,
    "plainEnglish": "string"
  },
  "projectQuantSummary": {
    "projectHorizonLossMean": number|null,
    "projectHorizonLossP90": number|null,
    "lossAsPctOfProjectValue": number|null,
    "lossAsPctOfMargin": number|null,
    "primaryProjectDriver": "string",
    "projectInputQuality": "string",
    "proxyValuesUsed": ["string"],
    "unknownHighImpactInputs": ["string"],
    "plainEnglish": "string"
  },
  "mainDrivers": [
    {
      "driver": "string",
      "impact": "string",
      "evidenceStrength": "strong|partial|weak|none",
      "sourceStatus": "known|estimated|derived|benchmark_proxy|unknown|not_applicable|evidence_supported"
    }
  ],
  "sensitivity": {
    "summary": "string",
    "mostSensitiveAssumption": "string",
    "changedDecisionIf": "string"
  },
  "evidence": [],
  "openChallenges": [],
  "sparseDataWarning": "string",
  "nextAction": {
    "owner": "string",
    "action": "string",
    "due": "string",
    "controlOrTreatment": "string"
  },
  "confidence": "high|medium|low|unknown"
}`;

const ASSESSMENT_TYPE_GENERIC = AssessmentTypeModel.ASSESSMENT_TYPE_GENERIC || 'enterprise_generic';
const ASSESSMENT_TYPE_PROJECT_BUYER = AssessmentTypeModel.ASSESSMENT_TYPE_PROJECT_BUYER || 'project_buyer';
const ASSESSMENT_TYPE_PROJECT_SELLER = AssessmentTypeModel.ASSESSMENT_TYPE_PROJECT_SELLER || 'project_seller';
const POSTURES = new Set(['proceed', 'proceed_with_controls', 'defer', 'escalate', 'reject', 'needs_more_evidence']);
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const SOURCE_STATUSES = new Set(['known', 'estimated', 'derived', 'benchmark_proxy', 'unknown', 'not_applicable', 'evidence_supported']);
const EVIDENCE_STRENGTH = new Set(['strong', 'partial', 'weak', 'none']);

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
      ? cleanText(item.item || item.title || item.claim || item.field || item.label || item.statement || item.question || item.driver || item.id || '', maxChars)
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

function normalisePosture(value, fallback = 'needs_more_evidence') {
  const next = cleanText(value, 80).toLowerCase();
  return POSTURES.has(next) ? next : fallback;
}

function normaliseEvidenceStrength(value, fallback = 'none') {
  const next = cleanText(value, 80).toLowerCase();
  return EVIDENCE_STRENGTH.has(next) ? next : fallback;
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

function normaliseParameters(value = {}) {
  if (!isPlainObject(value)) return {};
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'number' || typeof item === 'string') {
      const number = finiteNumber(item);
      if (number !== null) output[key] = number;
      return;
    }
    if (typeof item === 'boolean') output[key] = item;
  });
  return output;
}

function normaliseDecisionBriefWorkflowInput(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const assessmentType = AssessmentTypeModel.normaliseAssessmentType(source.assessmentType);
  return compactObject({
    assessmentType,
    scenario: cleanBlock(source.scenario || source.riskStatement || source.narrative || '', 5000),
    structuredScenario: normaliseLooseObject(source.structuredScenario),
    scenarioLens: normaliseLooseValue(source.scenarioLens),
    projectContext: AssessmentTypeModel.normaliseProjectContext(isPlainObject(source.projectContext) ? source.projectContext : {}, assessmentType),
    projectExposure: AssessmentTypeModel.normaliseProjectExposure(isPlainObject(source.projectExposure) ? source.projectExposure : {}),
    simulationResult: normaliseLooseObject(source.simulationResult || source.results),
    parameters: normaliseParameters(source.parameters),
    assumptionRegister: DecisionSupportModel.buildAssumptionRegister(isPlainObject(source.assumptionRegister) ? source.assumptionRegister : {}),
    parameterCoach: DecisionSupportModel.buildParameterCoach(isPlainObject(source.parameterCoach) ? source.parameterCoach : {}),
    evidenceMap: DecisionSupportModel.buildEvidenceMap(isPlainObject(source.evidenceMap) ? source.evidenceMap : {}),
    decisionChallenge: DecisionSupportModel.buildDecisionChallenge(isPlainObject(source.decisionChallenge) ? source.decisionChallenge : {}),
    treatments: normaliseLooseValue(source.treatments),
    riskAppetite: normaliseLooseObject(source.riskAppetite),
    adminSettings: normaliseLooseObject(source.adminSettings),
    traceLabel: cleanText(source.traceLabel || '', 160) || 'Decision brief',
    priorMessages: cleanPriorMessages(source.priorMessages)
  });
}

function getResultMetric(results = {}, path = []) {
  let cursor = results;
  for (const key of path) {
    if (!isPlainObject(cursor)) return null;
    cursor = cursor[key];
  }
  return finiteNumber(cursor);
}

function getEventLossP90(results = {}) {
  return getResultMetric(results, ['eventLoss', 'p90'])
    ?? getResultMetric(results, ['lm', 'p90'])
    ?? 0;
}

function getAnnualMean(results = {}) {
  return getResultMetric(results, ['annualLoss', 'mean'])
    ?? getResultMetric(results, ['ale', 'mean'])
    ?? 0;
}

function getAnnualP90(results = {}) {
  return getResultMetric(results, ['annualLoss', 'p90'])
    ?? getResultMetric(results, ['ale', 'p90'])
    ?? 0;
}

function getThreshold(input = {}) {
  return finiteNumber(input?.simulationResult?.threshold)
    ?? finiteNumber(input?.parameters?.threshold)
    ?? finiteNumber(input?.riskAppetite?.threshold)
    ?? finiteNumber(input?.riskAppetite?.eventTolerance)
    ?? 0;
}

function getAnnualThreshold(input = {}) {
  return finiteNumber(input?.simulationResult?.annualReviewThreshold)
    ?? finiteNumber(input?.parameters?.annualReviewThreshold)
    ?? finiteNumber(input?.riskAppetite?.annualReviewThreshold)
    ?? 0;
}

function getToleranceExceeded(input = {}) {
  if (input?.simulationResult?.toleranceBreached === true) return true;
  const threshold = getThreshold(input);
  return threshold > 0 && getEventLossP90(input.simulationResult) > threshold;
}

function getAnnualReviewTriggered(input = {}) {
  if (input?.simulationResult?.annualReviewTriggered === true) return true;
  const threshold = getAnnualThreshold(input);
  return threshold > 0 && getAnnualP90(input.simulationResult) > threshold;
}

function isNearTolerance(input = {}) {
  if (input?.simulationResult?.nearTolerance === true) return true;
  const threshold = getThreshold(input);
  if (!(threshold > 0)) return false;
  const ratio = getEventLossP90(input.simulationResult) / threshold;
  return ratio >= 0.75 && ratio <= 1;
}

function quantSummary(input = {}) {
  const eventLossP90 = getEventLossP90(input.simulationResult);
  const annualLossMean = getAnnualMean(input.simulationResult);
  const annualLossP90 = getAnnualP90(input.simulationResult);
  const toleranceExceeded = getToleranceExceeded(input);
  const annualReviewTriggered = getAnnualReviewTriggered(input);
  return {
    eventLossP90,
    annualLossMean,
    annualLossP90,
    toleranceExceeded,
    annualReviewTriggered,
    plainEnglish: toleranceExceeded
      ? 'The serious-event estimate is above tolerance, so the result should be escalated or actively treated.'
      : isNearTolerance(input)
        ? 'The serious-event estimate is close to tolerance. Treat the result as management-sensitive until the largest assumptions are challenged.'
        : annualReviewTriggered
          ? 'The single-event view is within tolerance, but the annualized view triggers review.'
          : 'The baseline enterprise-risk view is within the current tolerance and annual review thresholds.'
  };
}

function statusLabel(status = '') {
  return cleanText(status, 80).replace(/_/g, ' ') || 'unknown';
}

function driverRangeLabel(driver = {}) {
  const low = finiteNumber(driver.low);
  const likely = finiteNumber(driver.likely);
  const high = finiteNumber(driver.high);
  if (low === null || likely === null || high === null) return 'Unquantified';
  return `${Math.round(low).toLocaleString('en-US')} / ${Math.round(likely).toLocaleString('en-US')} / ${Math.round(high).toLocaleString('en-US')}`;
}

function getProjectHorizonLoss(results = {}) {
  const horizon = isPlainObject(results.projectHorizon) ? results.projectHorizon : {};
  return {
    mean: getResultMetric(horizon, ['loss', 'mean']),
    p90: getResultMetric(horizon, ['loss', 'p90']),
    valuePct: finiteNumber(horizon.lossAsPctOfProjectValue?.p90 ?? horizon.lossAsPctOfProjectValue),
    marginPct: finiteNumber(horizon.lossAsPctOfMargin?.p90 ?? horizon.lossAsPctOfMargin)
  };
}

function projectInputQualityLabel(projectExposure = {}) {
  const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
  return cleanText(quality.label || '', 180) || (Array.isArray(projectExposure.missingInputs) && projectExposure.missingInputs.length ? 'Thin project economics' : '');
}

function collectProjectDrivers(projectExposure = {}) {
  return (Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers : [])
    .filter(isPlainObject)
    .map((driver) => ({
      id: cleanText(driver.id || driver.label || '', 140),
      label: cleanText(driver.label || driver.id || 'Project driver', 180),
      type: cleanText(driver.driverType || 'other', 80),
      status: cleanText(driver.driverStatus || '', 80),
      sourceStatus: normaliseSourceStatus(driver.source || driver.sourceStatus || (driver.driverStatus === 'benchmark_proxy_driver' ? 'benchmark_proxy' : 'unknown')),
      confidence: normaliseConfidence(driver.confidence),
      likely: finiteNumber(driver.likely),
      rangeLabel: driverRangeLabel(driver),
      rationale: cleanBlock(driver.rationale || '', 500)
    }));
}

function collectUnknownHighImpactInputs(projectExposure = {}, decisionChallenge = {}) {
  const rows = [];
  const add = (item) => {
    if (!item) return;
    if (isPlainObject(item)) {
      const text = cleanText(item.label || item.field || item.driver || item.title || item.condition || '', 200);
      if (text) rows.push(text);
      return;
    }
    const text = cleanText(item, 200);
    if (text) rows.push(text);
  };
  (Array.isArray(projectExposure.missingInputs) ? projectExposure.missingInputs : []).forEach(add);
  const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
  (Array.isArray(quality.unknownHighImpactInputs) ? quality.unknownHighImpactInputs : []).forEach(add);
  (Array.isArray(decisionChallenge.sensitivityFlags) ? decisionChallenge.sensitivityFlags : [])
    .filter(item => normaliseSourceStatus(item.sourceStatus) === 'unknown')
    .forEach(add);
  return Array.from(new Set(rows)).slice(0, 6);
}

function collectProxyValues(projectExposure = {}) {
  const values = [];
  collectProjectDrivers(projectExposure)
    .filter(driver => driver.status === 'benchmark_proxy_driver' || driver.sourceStatus === 'benchmark_proxy')
    .forEach(driver => values.push(`${driver.label}: ${driver.rangeLabel}`));
  return Array.from(new Set(values)).slice(0, 6);
}

function getPrimaryProjectDriver(projectExposure = {}) {
  const drivers = collectProjectDrivers(projectExposure)
    .filter(driver => driver.likely !== null || driver.status === 'unquantified_driver')
    .sort((left, right) => (right.likely || 0) - (left.likely || 0));
  return drivers[0]?.label || '';
}

function projectQuantSummary(input = {}) {
  const isProject = input.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER || input.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER;
  const projectExposure = input.projectExposure || {};
  const horizon = getProjectHorizonLoss(input.simulationResult || {});
  const unknownHighImpactInputs = collectUnknownHighImpactInputs(projectExposure, input.decisionChallenge || {});
  const proxyValuesUsed = collectProxyValues(projectExposure);
  const qualityLabel = projectInputQualityLabel(projectExposure);
  const primaryProjectDriver = getPrimaryProjectDriver(projectExposure);
  return {
    projectHorizonLossMean: horizon.mean,
    projectHorizonLossP90: horizon.p90,
    lossAsPctOfProjectValue: horizon.valuePct,
    lossAsPctOfMargin: horizon.marginPct,
    primaryProjectDriver,
    projectInputQuality: qualityLabel,
    proxyValuesUsed,
    unknownHighImpactInputs,
    plainEnglish: !isProject
      ? ''
      : unknownHighImpactInputs.length
        ? `Project economics are thin. ${unknownHighImpactInputs[0]} is the unknown value most likely to change the recommendation and could change the recommendation if materially different.`
        : proxyValuesUsed.length
          ? 'Project exposure includes benchmark-proxy values. Treat those as directional until confirmed by the project owner or contract evidence.'
          : primaryProjectDriver
            ? `The main project-linked exposure appears to be ${primaryProjectDriver}.`
            : 'Project-linked metrics are available only where duration and value inputs were known, estimated, derived, or proxied.'
  };
}

function evidenceStrengthForDriver(driver = {}, evidenceMap = {}) {
  const parameterEvidence = Array.isArray(evidenceMap.parameterEvidenceMap) ? evidenceMap.parameterEvidenceMap : [];
  const match = parameterEvidence.find(item => {
    const refs = cleanStringList(item.projectExposureRefs || item.evidenceRefs, { maxItems: 8 });
    return refs.some(ref => ref.toLowerCase().includes(String(driver.id || driver.label || '').toLowerCase()));
  });
  return normaliseEvidenceStrength(match?.supportLevel, driver.sourceStatus === 'evidence_supported' ? 'strong' : driver.sourceStatus === 'unknown' ? 'none' : 'partial');
}

function buildMainDrivers(input = {}) {
  const projectDrivers = collectProjectDrivers(input.projectExposure || {});
  if (projectDrivers.length) {
    return projectDrivers.slice(0, 4).map(driver => ({
      driver: driver.label,
      impact: driver.status === 'unquantified_driver'
        ? `${driver.label} is relevant but not quantified yet.`
        : `${driver.label} is ${driver.rangeLabel}; ${driver.rationale || 'review the supporting project economics before relying on it.'}`,
      evidenceStrength: evidenceStrengthForDriver(driver, input.evidenceMap || {}),
      sourceStatus: driver.status === 'benchmark_proxy_driver' ? 'benchmark_proxy' : driver.sourceStatus
    }));
  }
  const params = input.parameters || {};
  const rows = [
    ['Business interruption', finiteNumber(params.biLikely), 'businessInterruption'],
    ['Regulatory and legal', finiteNumber(params.rlLikely), 'regulatoryLegal'],
    ['Third-party impact', finiteNumber(params.tpLikely), 'thirdParty'],
    ['Reputation and contract', finiteNumber(params.rcLikely), 'reputationContract'],
    ['Incident response', finiteNumber(params.irLikely), 'incidentResponse']
  ].filter(([, value]) => value !== null)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
  return rows.map(([label, value]) => ({
    driver: label,
    impact: `${label} is one of the larger current likely loss components at ${Math.round(value).toLocaleString('en-US')}.`,
    evidenceStrength: 'partial',
    sourceStatus: 'estimated'
  }));
}

function buildEvidenceSummary(input = {}) {
  const evidenceMap = input.evidenceMap || {};
  const supported = Array.isArray(evidenceMap.supportedClaims) ? evidenceMap.supportedClaims.slice(0, 3) : [];
  const unsupported = Array.isArray(evidenceMap.unsupportedClaims) ? evidenceMap.unsupportedClaims.slice(0, 3) : [];
  const contradictions = Array.isArray(evidenceMap.contradictions) ? evidenceMap.contradictions.slice(0, 2) : [];
  return [
    ...supported.map(item => ({
      type: 'supported',
      claim: cleanText(item.claim || item.text || '', 240),
      strength: normaliseEvidenceStrength(item.supportLevel, 'partial')
    })),
    ...unsupported.map(item => ({
      type: 'unsupported',
      claim: cleanText(item.claim || item.text || '', 240),
      strength: 'none'
    })),
    ...contradictions.map(item => ({
      type: 'contradiction',
      claim: cleanText(item.claim || item.conflictingEvidence || '', 240),
      strength: 'weak'
    }))
  ].filter(item => item.claim).slice(0, 6);
}

function buildOpenChallenges(input = {}) {
  const challenge = input.decisionChallenge || {};
  const assumptions = input.assumptionRegister || {};
  const coach = input.parameterCoach || {};
  return [
    ...cleanStringList(challenge.decisionRisks, { maxItems: 4, maxChars: 260 }),
    ...cleanStringList(challenge.sensitivityFlags, { maxItems: 4, maxChars: 260 }),
    ...cleanStringList(assumptions.nextBestQuestions, { maxItems: 3, maxChars: 260 }),
    ...cleanStringList(coach.missingHighImpactInputs, { maxItems: 3, maxChars: 260 })
  ].slice(0, 8);
}

function derivePosture(input = {}) {
  const unknowns = collectUnknownHighImpactInputs(input.projectExposure || {}, input.decisionChallenge || {});
  const evidenceMap = input.evidenceMap || {};
  const contradictions = Array.isArray(evidenceMap.contradictions) ? evidenceMap.contradictions.length : 0;
  if (contradictions > 0) return 'needs_more_evidence';
  if (getToleranceExceeded(input)) return 'escalate';
  if (input.assessmentType !== ASSESSMENT_TYPE_GENERIC && unknowns.length >= 3) return 'needs_more_evidence';
  if (isNearTolerance(input) || getAnnualReviewTriggered(input)) return 'proceed_with_controls';
  return unknowns.length ? 'proceed_with_controls' : 'proceed';
}

function deriveConfidence(input = {}) {
  const unknowns = collectUnknownHighImpactInputs(input.projectExposure || {}, input.decisionChallenge || {});
  const proxies = collectProxyValues(input.projectExposure || {});
  const evidenceMap = input.evidenceMap || {};
  const contradictions = Array.isArray(evidenceMap.contradictions) ? evidenceMap.contradictions.length : 0;
  const unsupported = Array.isArray(evidenceMap.unsupportedClaims) ? evidenceMap.unsupportedClaims.length : 0;
  if (contradictions || unknowns.length >= 3) return 'low';
  if ((input.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER || input.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER) && unknowns.length) return 'low';
  if (unknowns.length || proxies.length || unsupported) return 'medium';
  const supported = Array.isArray(evidenceMap.supportedClaims) ? evidenceMap.supportedClaims.length : 0;
  return supported ? 'high' : 'medium';
}

function postureLabel(posture = '') {
  return statusLabel(posture).replace(/\b\w/g, char => char.toUpperCase());
}

function buildSensitivity(input = {}) {
  const challenge = input.decisionChallenge || {};
  const firstFlag = Array.isArray(challenge.sensitivityFlags) ? challenge.sensitivityFlags[0] : null;
  const firstChanged = Array.isArray(challenge.changedDecisionIf) ? challenge.changedDecisionIf[0] : null;
  const unknowns = collectUnknownHighImpactInputs(input.projectExposure || {}, challenge);
  return {
    summary: firstFlag?.whySensitive || (unknowns.length
      ? `${unknowns[0]} could change the recommendation and should be confirmed before formal sign-off.`
      : 'The largest sensitivity is the current loss magnitude and event-frequency range.'),
    mostSensitiveAssumption: cleanText(firstFlag?.driver || unknowns[0] || '', 180),
    changedDecisionIf: cleanText(firstChanged?.condition || firstChanged || (unknowns.length ? `${unknowns[0]} is materially different from the current assumption.` : ''), 500)
  };
}

function nextAction(input = {}, posture = '') {
  const projectUnknowns = collectUnknownHighImpactInputs(input.projectExposure || {}, input.decisionChallenge || {});
  const missingEvidence = cleanStringList(input.evidenceMap?.unsupportedClaims || input.decisionChallenge?.missingEvidence, { maxItems: 3, maxChars: 240 });
  const challengeRisks = Array.isArray(input.decisionChallenge?.decisionRisks) ? input.decisionChallenge.decisionRisks : [];
  if (projectUnknowns.length) {
    return {
      owner: input.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER ? 'Commercial owner or finance business partner' : 'Project owner or finance business partner',
      action: `Confirm ${projectUnknowns[0]} and update the project exposure before management sign-off.`,
      due: 'Before approval',
      controlOrTreatment: 'Project economics validation'
    };
  }
  if (missingEvidence.length) {
    return {
      owner: 'Assessment owner',
      action: `Collect evidence for: ${missingEvidence[0]}.`,
      due: 'Before formal reliance',
      controlOrTreatment: 'Evidence validation'
    };
  }
  if (posture === 'escalate') {
    return {
      owner: 'Risk owner',
      action: 'Escalate the result and agree treatment ownership.',
      due: 'Now',
      controlOrTreatment: challengeRisks[0]?.recommendedAction || 'Management review'
    };
  }
  return {
    owner: 'Assessment owner',
    action: 'Keep the baseline under review and rerun if scope, evidence, or controls change.',
    due: 'Next review cycle',
    controlOrTreatment: 'Monitoring'
  };
}

function sparseDataWarning(input = {}) {
  const isProject = input.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER || input.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER;
  const unknowns = collectUnknownHighImpactInputs(input.projectExposure || {}, input.decisionChallenge || {});
  const proxies = collectProxyValues(input.projectExposure || {});
  if (!isProject) return '';
  if (unknowns.length) return `Project economics are thin. ${unknowns[0]} is unknown and could change the recommendation.`;
  if (proxies.length) return 'Some project values are benchmark-proxied. Treat them as directional until confirmed.';
  return '';
}

function buildRecommendation(input = {}, posture = '') {
  if (posture === 'escalate') return 'Escalate and actively review the risk because the current quantitative view is above tolerance.';
  if (posture === 'needs_more_evidence') return 'Pause formal reliance and close the highest-impact evidence or project-economics gap first.';
  if (posture === 'proceed_with_controls') return 'Proceed only with explicit controls, owner review, and follow-up on the main uncertainty.';
  if (posture === 'reject') return 'Reject the current path until the decision-sensitive assumptions are corrected.';
  if (posture === 'defer') return 'Defer the decision until key assumptions are supported.';
  return 'Proceed with monitoring under the current baseline assumptions.';
}

function buildWhy(input = {}, posture = '') {
  const q = quantSummary(input);
  const pq = projectQuantSummary(input);
  if (input.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER) {
    return `${q.plainEnglish} Buyer-side project exposure should be read through incremental delay, reprocurement, sunk cost, and recovery mechanics. ${pq.plainEnglish}`.trim();
  }
  if (input.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER) {
    return `${q.plainEnglish} Seller-side project exposure should separate revenue, margin, delivery cost, LD/SLA, termination, and recoveries. ${pq.plainEnglish}`.trim();
  }
  return `${q.plainEnglish} Use this as enterprise risk decision support; project-specific economics are not part of this route.`;
}

function buildDeterministicDecisionBrief(input = {}) {
  const posture = derivePosture(input);
  const brief = {
    recommendation: buildRecommendation(input, posture),
    decisionPosture: posture,
    why: buildWhy(input, posture),
    quantSummary: quantSummary(input),
    projectQuantSummary: projectQuantSummary(input),
    mainDrivers: buildMainDrivers(input),
    sensitivity: buildSensitivity(input),
    evidence: buildEvidenceSummary(input),
    openChallenges: buildOpenChallenges(input),
    sparseDataWarning: sparseDataWarning(input),
    nextAction: nextAction(input, posture),
    confidence: deriveConfidence(input)
  };
  return normaliseDecisionBriefForApi(brief);
}

function normaliseQuantSummary(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    eventLossP90: finiteNumber(source.eventLossP90),
    annualLossMean: finiteNumber(source.annualLossMean),
    annualLossP90: finiteNumber(source.annualLossP90),
    toleranceExceeded: source.toleranceExceeded === true,
    annualReviewTriggered: source.annualReviewTriggered === true,
    plainEnglish: cleanBlock(source.plainEnglish || '', 800)
  };
}

function normaliseProjectQuantSummaryForApi(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    projectHorizonLossMean: finiteNumber(source.projectHorizonLossMean),
    projectHorizonLossP90: finiteNumber(source.projectHorizonLossP90),
    lossAsPctOfProjectValue: finiteNumber(source.lossAsPctOfProjectValue),
    lossAsPctOfMargin: finiteNumber(source.lossAsPctOfMargin),
    primaryProjectDriver: cleanText(source.primaryProjectDriver || '', 180),
    projectInputQuality: cleanText(source.projectInputQuality || '', 180),
    proxyValuesUsed: cleanStringList(source.proxyValuesUsed, { maxItems: 8, maxChars: 220 }),
    unknownHighImpactInputs: cleanStringList(source.unknownHighImpactInputs, { maxItems: 8, maxChars: 220 }),
    plainEnglish: cleanBlock(source.plainEnglish || '', 900)
  };
}

function normaliseDriverForApi(item = {}) {
  if (!isPlainObject(item)) return null;
  const driver = cleanText(item.driver || item.label || item.title || '', 180);
  const impact = cleanBlock(item.impact || item.rationale || '', 700);
  if (!driver && !impact) return null;
  return {
    driver: driver || 'Driver',
    impact,
    evidenceStrength: normaliseEvidenceStrength(item.evidenceStrength || item.supportLevel),
    sourceStatus: normaliseSourceStatus(item.sourceStatus || item.status)
  };
}

function normaliseSensitivityForApi(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    summary: cleanBlock(source.summary || '', 700),
    mostSensitiveAssumption: cleanText(source.mostSensitiveAssumption || '', 180),
    changedDecisionIf: cleanBlock(source.changedDecisionIf || '', 700)
  };
}

function normaliseNextActionForApi(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    owner: cleanText(source.owner || '', 180),
    action: cleanBlock(source.action || '', 700),
    due: cleanText(source.due || '', 120),
    controlOrTreatment: cleanText(source.controlOrTreatment || '', 180)
  };
}

function normaliseDecisionBriefForApi(brief = {}, fallback = {}) {
  const source = isPlainObject(brief) ? brief : {};
  const fallbackSource = isPlainObject(fallback) ? fallback : {};
  const merged = { ...fallbackSource, ...source };
  const model = DecisionSupportModel.buildDecisionBrief(merged);
  return {
    recommendation: cleanBlock(source.recommendation || model.recommendation || fallbackSource.recommendation || '', 900),
    decisionPosture: normalisePosture(source.decisionPosture || model.decisionPosture || fallbackSource.decisionPosture),
    why: cleanBlock(source.why || model.why || fallbackSource.why || '', 1200),
    quantSummary: normaliseQuantSummary(source.quantSummary || model.quantSummary || fallbackSource.quantSummary),
    projectQuantSummary: normaliseProjectQuantSummaryForApi(source.projectQuantSummary || model.projectQuantSummary || fallbackSource.projectQuantSummary),
    mainDrivers: [
      ...(Array.isArray(source.mainDrivers) ? source.mainDrivers : []),
      ...(Array.isArray(fallbackSource.mainDrivers) ? fallbackSource.mainDrivers : [])
    ].map(normaliseDriverForApi).filter(Boolean).slice(0, 6),
    sensitivity: normaliseSensitivityForApi(source.sensitivity || model.sensitivity || fallbackSource.sensitivity),
    evidence: cleanStringList(source.evidence || model.evidence || fallbackSource.evidence, { maxItems: 8, maxChars: 360 }),
    openChallenges: cleanStringList(source.openChallenges || model.openChallenges || fallbackSource.openChallenges, { maxItems: 8, maxChars: 360 }),
    sparseDataWarning: cleanBlock(source.sparseDataWarning || model.sparseDataWarning || fallbackSource.sparseDataWarning || '', 900),
    nextAction: normaliseNextActionForApi(source.nextAction || model.nextAction || fallbackSource.nextAction),
    confidence: normaliseConfidence(source.confidence || model.confidence || fallbackSource.confidence)
  };
}

function classifyDecisionBriefFallbackReason(error = null) {
  const message = String(error?.message || error || '');
  if (/Hosted AI proxy is not configured|AI_PROXY_UNAVAILABLE|COMPASS_API_KEY/i.test(message)) {
    return {
      code: 'hosted_ai_unavailable',
      title: 'Hosted AI unavailable',
      message: 'Hosted AI is not configured, so deterministic decision brief was used.',
      detail: message
    };
  }
  if (/structured response|JSON|schema|unusable|Unexpected token|malformed/i.test(message)) {
    return {
      code: 'invalid_ai_output',
      title: 'AI output was not usable',
      message: 'The AI response could not be safely converted into the decision brief schema, so deterministic fallback was used.',
      detail: message
    };
  }
  if (/timed out|timeout/i.test(message)) {
    return {
      code: 'decision_brief_timeout',
      title: 'AI decision brief timed out',
      message: 'AI decision brief timed out, so deterministic fallback was used.',
      detail: message
    };
  }
  return {
    code: 'decision_brief_ai_failed',
    title: 'AI decision brief failed',
    message: 'AI decision brief failed, so deterministic fallback was used.',
    detail: message
  };
}

function buildDeterministicDecisionBriefResult(options = {}) {
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
  const decisionBrief = buildDeterministicDecisionBrief(input);
  const reason = fallbackReason || {
    code: aiUnavailable ? 'hosted_ai_unavailable' : 'deterministic_decision_brief',
    title: 'Deterministic decision brief',
    message: aiUnavailable
      ? 'Hosted AI was unavailable, so deterministic decision brief was used.'
      : 'The deterministic decision brief was used.',
    detail: normalisedError ? String(normalisedError.message || normalisedError) : ''
  };
  return {
    mode: 'deterministic_fallback',
    decisionBrief,
    trace: buildTraceEntry({
      label: input.traceLabel || 'Decision brief',
      promptSummary,
      response: response || JSON.stringify(decisionBrief, null, 2),
      sources: []
    }),
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    fallbackReasonCode: reason.code || 'deterministic_decision_brief',
    fallbackReasonTitle: reason.title || 'Deterministic decision brief',
    fallbackReasonMessage: reason.message || '',
    fallbackReasonDetail: reason.detail || '',
    generatedAt: new Date().toISOString()
  };
}

function buildSystemPrompt() {
  return `You are an AI Decision Brief writer for FAIR-style risk results.

Return JSON only. Do not include markdown.

Rules:
- Do not change auth/RBAC or user permissions.
- Do not remove existing result tabs or change baseline results.
- Generic: write as enterprise risk decision support.
- Project buyer: explain spend/budget, delay, reprocurement, sunk cost, recoveries, and unknown high-impact values.
- Project seller: explain contract value, revenue, margin, delivery cost, LD/SLA, termination, recoveries, and unknown high-impact values.
- Explain annualized versus project-horizon loss where relevant.
- If proxy values are used, identify them as proxy values.
- If high-impact inputs are unknown, identify the one most likely to change the recommendation.
- Do not present benchmark-proxy numbers as confirmed project values.
- Do not overstate confidence.
- Return only JSON matching this schema:
${DECISION_BRIEF_SCHEMA}`;
}

function buildUserPrompt(input = {}, deterministicBrief = {}) {
  const compactInput = {
    assessmentType: input.assessmentType,
    scenario: input.scenario,
    structuredScenario: input.structuredScenario,
    scenarioLens: input.scenarioLens,
    projectContext: input.projectContext,
    projectExposure: input.projectExposure,
    simulationResult: input.simulationResult,
    parameters: input.parameters,
    assumptionRegister: input.assumptionRegister,
    parameterCoach: input.parameterCoach,
    evidenceMap: input.evidenceMap,
    decisionChallenge: input.decisionChallenge,
    treatments: input.treatments,
    riskAppetite: input.riskAppetite,
    adminSettings: input.adminSettings
  };
  return `Write the primary management Decision Brief for these results.

Use the deterministic baseline below as a guardrail. You may improve clarity and wording, but do not remove sparse-data warnings, proxy labels, or unknown high-impact project inputs unless the input marks them known, not applicable, or evidence-supported.

Deterministic baseline:
${JSON.stringify(deterministicBrief, null, 2)}

Input:
${JSON.stringify(compactInput, null, 2)}

Return only the Decision Brief JSON object.`;
}

async function buildDecisionBriefWorkflow(input = {}) {
  const normalisedInput = normaliseDecisionBriefWorkflowInput(input);
  const deterministic = buildDeterministicDecisionBrief(normalisedInput);
  const timeouts = buildWorkflowTimeoutProfile({
    liveMs: Number(process.env.DECISION_BRIEF_AI_TIMEOUT_MS || 22000),
    repairMs: Number(process.env.DECISION_BRIEF_AI_REPAIR_TIMEOUT_MS || 8000)
  });
  try {
    const generation = await callAi(buildSystemPrompt(), buildUserPrompt(normalisedInput, deterministic), {
      taskName: 'decisionBrief',
      temperature: 0.1,
      maxCompletionTokens: 3000,
      maxPromptChars: MAX_PROMPT_CHARS,
      timeoutMs: timeouts.liveMs,
      priorMessages: normalisedInput.priorMessages
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, DECISION_BRIEF_SCHEMA, {
      taskName: 'decisionBriefRepair',
      timeoutMs: timeouts.repairMs,
      maxCompletionTokens: 3000,
      maxPromptChars: 14000
    });
    const decisionBrief = normaliseDecisionBriefForApi(parsed.parsed, deterministic);
    const traces = [
      buildTraceEntry({
        label: normalisedInput.traceLabel || 'Decision brief',
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: []
      }),
      parsed.trace || null
    ].filter(Boolean);
    return {
      mode: 'live',
      decisionBrief,
      trace: traces[0] || null,
      traces,
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyDecisionBriefFallbackReason,
      buildFallbackResult: buildDeterministicDecisionBriefResult,
      fallbackOptions: {
        input: normalisedInput,
        promptSummary: buildUserPrompt(normalisedInput, deterministic),
        response: String(error?.message || error || '')
      }
    });
  }
}

module.exports = {
  DECISION_BRIEF_SCHEMA,
  buildDecisionBriefWorkflow,
  buildDeterministicDecisionBrief,
  buildDeterministicDecisionBriefResult,
  classifyDecisionBriefFallbackReason,
  normaliseDecisionBriefForApi,
  normaliseDecisionBriefWorkflowInput
};
