'use strict';

const { buildTraceEntry, callAi, parseOrRepairStructuredJson } = require('./_aiOrchestrator');
const {
  buildFallbackFromError,
  buildWorkflowTimeoutProfile,
  cleanBlock,
  cleanText,
  compactObject,
  finiteNumber,
  isPlainObject,
  normaliseLooseObject,
  normaliseLooseValue
} = require('./_aiWorkflowSupport');
const AssessmentTypeModel = require('../assets/state/assessmentTypeModel.js');
const DecisionSupportModel = require('../assets/state/decisionSupportModel.js');
const ProjectParameterSuggestionService = require('../assets/services/projectParameterSuggestionService.js');
const RiskEngine = require('../assets/engine/riskEngine.js');

const MAX_PROMPT_CHARS = 26000;
const PARAMETER_COACH_SCHEMA = `{
  "parameterRationales": [
    {
      "parameterKey": "string",
      "currentRange": { "min": number|null, "likely": number|null, "max": number|null },
      "suggestedRange": { "min": number|null, "likely": number|null, "max": number|null },
      "suggestionType": "project_derived_range|benchmark_proxy_range|parameter_gap|stress_case_candidate|not_applicable",
      "confidence": "high|medium|low|unknown",
      "sourceStatus": "known|estimated|derived|benchmark_proxy|unknown|not_applicable|evidence_supported",
      "rationale": "string",
      "evidenceRefs": ["string"],
      "projectExposureRefs": ["string"],
      "challenge": "string",
      "userAction": "keep_current|consider_suggestion|needs_evidence|run_stress_case|ask_owner|upload_evidence"
    }
  ],
  "missingHighImpactInputs": [
    {
      "field": "string",
      "importance": "high|medium|low",
      "whyItMatters": "string",
      "whoMightKnow": "string",
      "suggestedQuestion": "string",
      "linkedParameter": "string"
    }
  ],
  "warnings": ["string"],
  "suggestedChangesCount": number
}`;

const VALID_PARAMETER_KEYS = new Set(Object.keys(ProjectParameterSuggestionService.BUCKET_MAP || {}));
const NUMERIC_SUGGESTION_TYPES = new Set(['project_derived_range', 'benchmark_proxy_range']);
const SUGGESTION_TYPES = new Set([
  'project_derived_range',
  'benchmark_proxy_range',
  'parameter_gap',
  'stress_case_candidate',
  'not_applicable'
]);
const USER_ACTIONS = new Set([
  'keep_current',
  'consider_suggestion',
  'needs_evidence',
  'run_stress_case',
  'ask_owner',
  'upload_evidence'
]);
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const SOURCE_STATUSES = new Set(['known', 'estimated', 'derived', 'benchmark_proxy', 'unknown', 'not_applicable', 'evidence_supported']);
const IMPORTANCE_VALUES = new Set(['high', 'medium', 'low']);

const FIELD_TO_PARAMETER = Object.freeze({
  delayDurationDays: 'businessInterruption',
  delayCostPerDay: 'businessInterruption',
  delayCostPerWeek: 'businessInterruption',
  expectedBenefitPerDay: 'secondaryLoss',
  expectedBenefitPerWeek: 'secondaryLoss',
  remainingSpend: 'thirdParty',
  expectedSpend: 'thirdParty',
  approvedBudget: 'thirdParty',
  reprocurementPremiumPct: 'thirdParty',
  amountPaid: 'thirdParty',
  amountCommitted: 'thirdParty',
  legalDisputeEstimate: 'regulatoryLegal',
  supplierCredits: 'thirdParty',
  insuranceRecoveries: 'thirdParty',
  liquidatedDamagesRecoverable: 'regulatoryLegal',
  contractualRecoveryCap: 'regulatoryLegal',
  expectedRevenue: 'reputationContract',
  contractValue: 'reputationContract',
  grossMarginPct: 'reputationContract',
  contributionMargin: 'reputationContract',
  costToCure: 'businessInterruption',
  warrantyExposure: 'businessInterruption',
  liquidatedDamagesCap: 'regulatoryLegal',
  slaCreditsCap: 'reputationContract',
  liabilityCap: 'regulatoryLegal',
  terminationExposure: 'reputationContract',
  revenueRecognitionAtRisk: 'businessInterruption',
  renewalValueAtRisk: 'secondaryLoss'
});

const RANGE_DEFINITIONS = Object.freeze([
  { prefix: 'ir', key: 'incidentResponse', label: 'Incident response' },
  { prefix: 'bi', key: 'businessInterruption', label: 'Business interruption' },
  { prefix: 'db', key: 'dataRemediation', label: 'Data remediation' },
  { prefix: 'rl', key: 'regulatoryLegal', label: 'Regulatory and legal' },
  { prefix: 'tp', key: 'thirdParty', label: 'Third-party impact' },
  { prefix: 'rc', key: 'reputationContract', label: 'Reputation and contract' },
  { prefix: 'secMag', key: 'secondaryLoss', label: 'Secondary loss magnitude' }
]);

function cleanStringList(items = [], { maxItems = 12, maxChars = 200 } = {}) {
  const raw = Array.isArray(items) ? items : items === null || items === undefined ? [] : [items];
  const seen = new Set();
  const output = [];
  raw.forEach((item) => {
    const text = isPlainObject(item)
      ? cleanText(item.id || item.label || item.field || item.title || item.item || item.statement || item.question || '', maxChars)
      : cleanText(item, maxChars);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (output.length < maxItems) output.push(text);
  });
  return output;
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

function cleanCitation(item = {}) {
  if (!isPlainObject(item)) return null;
  const citation = compactObject({
    title: cleanText(item.title || item.sourceTitle || item.note || '', 160),
    sourceTitle: cleanText(item.sourceTitle || '', 160),
    excerpt: cleanBlock(item.excerpt || item.description || item.text || item.note || '', 900),
    url: cleanText(item.url || item.link || '', 400),
    sourceType: cleanText(item.sourceType || '', 80),
    relevanceReason: cleanText(item.relevanceReason || '', 240)
  });
  return Object.keys(citation).length ? citation : null;
}

function cleanCitations(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(cleanCitation)
    .filter(Boolean)
    .slice(0, 20);
}

function normaliseConfidence(value, fallback = 'unknown') {
  const next = cleanText(value, 80).toLowerCase();
  return CONFIDENCE_VALUES.has(next) ? next : fallback;
}

function normaliseSourceStatus(value, fallback = 'unknown') {
  const next = DecisionSupportModel.normaliseSourceStatus(value || fallback);
  return SOURCE_STATUSES.has(next) ? next : fallback;
}

function normaliseImportance(value, fallback = 'medium') {
  const next = cleanText(value, 80).toLowerCase();
  return IMPORTANCE_VALUES.has(next) ? next : fallback;
}

function normaliseSuggestionType(value, fallback = 'parameter_gap') {
  const next = cleanText(value, 80).toLowerCase();
  return SUGGESTION_TYPES.has(next) ? next : fallback;
}

function normaliseUserAction(value, fallback = 'needs_evidence') {
  const next = cleanText(value, 80).toLowerCase();
  return USER_ACTIONS.has(next) ? next : fallback;
}

function normaliseRangeObject(value = {}) {
  if (!isPlainObject(value)) return { min: null, likely: null, max: null };
  const min = finiteNumber(value.min ?? value.low);
  const likely = finiteNumber(value.likely);
  const max = finiteNumber(value.max ?? value.high);
  if (min === null || likely === null || max === null) return { min: null, likely: null, max: null };
  const ordered = [min, likely, max].map(item => Math.max(0, item)).sort((left, right) => left - right);
  return {
    min: ordered[0],
    likely: ordered[1],
    max: ordered[2]
  };
}

function emptyRange() {
  return { min: null, likely: null, max: null };
}

function rangeHasNumbers(range = {}) {
  return isPlainObject(range)
    && finiteNumber(range.min) !== null
    && finiteNumber(range.likely) !== null
    && finiteNumber(range.max) !== null;
}

function convertRange(range = {}) {
  if (!isPlainObject(range)) return emptyRange();
  return normaliseRangeObject({
    min: range.min ?? range.low,
    likely: range.likely,
    max: range.max ?? range.high
  });
}

function normaliseParameterKey(value = '') {
  const key = cleanText(value, 120);
  return VALID_PARAMETER_KEYS.has(key) ? key : '';
}

function normaliseParameterRationale(item = {}, index = 0) {
  if (!isPlainObject(item)) return null;
  const parameterKey = normaliseParameterKey(item.parameterKey || item.bucket || item.linkedParameter);
  if (!parameterKey) return null;
  let suggestionType = normaliseSuggestionType(item.suggestionType);
  const currentRange = convertRange(item.currentRange);
  let suggestedRange = convertRange(item.suggestedRange || item.projectRange);
  if (NUMERIC_SUGGESTION_TYPES.has(suggestionType) && !rangeHasNumbers(suggestedRange)) {
    suggestionType = 'parameter_gap';
    suggestedRange = emptyRange();
  }
  if (!NUMERIC_SUGGESTION_TYPES.has(suggestionType)) {
    suggestedRange = emptyRange();
  }
  const sourceStatus = normaliseSourceStatus(item.sourceStatus);
  const defaultAction = suggestionType === 'project_derived_range' || suggestionType === 'benchmark_proxy_range'
    ? 'consider_suggestion'
    : suggestionType === 'stress_case_candidate'
      ? 'run_stress_case'
      : suggestionType === 'not_applicable'
        ? 'keep_current'
        : 'ask_owner';
  return {
    id: cleanText(item.id || `parameter_rationale_${index + 1}`, 140),
    parameterKey,
    currentRange,
    suggestedRange,
    suggestionType,
    confidence: normaliseConfidence(item.confidence),
    sourceStatus,
    rationale: cleanBlock(item.rationale || '', 900),
    evidenceRefs: cleanStringList(item.evidenceRefs || item.evidence || item.citations, { maxItems: 8, maxChars: 180 }),
    projectExposureRefs: cleanStringList(item.projectExposureRefs || item.projectExposureRef || item.driverIds || item.sourceDriverId, { maxItems: 8, maxChars: 180 }),
    challenge: cleanBlock(item.challenge || item.challengeQuestion || '', 700),
    userAction: normaliseUserAction(item.userAction, defaultAction)
  };
}

function normaliseMissingHighImpactInput(item = {}, index = 0) {
  if (!isPlainObject(item)) {
    const text = cleanText(item, 200);
    if (!text) return null;
    return {
      field: text,
      importance: 'medium',
      whyItMatters: '',
      whoMightKnow: '',
      suggestedQuestion: `Can you confirm ${text.toLowerCase()}?`,
      linkedParameter: ''
    };
  }
  const field = cleanText(item.field || item.label || `missing_input_${index + 1}`, 160);
  if (!field) return null;
  return {
    field,
    importance: normaliseImportance(item.importance, 'medium'),
    whyItMatters: cleanBlock(item.whyItMatters || item.why || '', 500),
    whoMightKnow: cleanText(item.whoMightKnow || item.owner || '', 180),
    suggestedQuestion: cleanBlock(item.suggestedQuestion || item.question || `Can you confirm ${field.toLowerCase()}?`, 500),
    linkedParameter: normaliseParameterKey(item.linkedParameter || item.mapsTo || FIELD_TO_PARAMETER[field] || '')
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

function normaliseParameterCoachForApi(coach = {}, fallback = {}) {
  const source = isPlainObject(coach) ? coach : {};
  const fallbackSource = isPlainObject(fallback) ? fallback : {};
  const model = DecisionSupportModel.buildParameterCoach(source);
  const fallbackModel = DecisionSupportModel.buildParameterCoach(fallbackSource);
  const parameterRationales = dedupeBy([
    ...(Array.isArray(source.parameterRationales) ? source.parameterRationales : model.parameterRationales),
    ...(Array.isArray(fallbackSource.parameterRationales) ? fallbackSource.parameterRationales : fallbackModel.parameterRationales)
  ].map(normaliseParameterRationale).filter(Boolean), item => `${item.parameterKey}:${item.suggestionType}:${item.projectExposureRefs.join(',') || item.id}`, 30);
  const missingHighImpactInputs = dedupeBy([
    ...(Array.isArray(source.missingHighImpactInputs) ? source.missingHighImpactInputs : model.missingHighImpactInputs),
    ...(Array.isArray(fallbackSource.missingHighImpactInputs) ? fallbackSource.missingHighImpactInputs : fallbackModel.missingHighImpactInputs)
  ].map(normaliseMissingHighImpactInput).filter(Boolean), item => item.field, 3);
  const warnings = dedupeBy([
    ...cleanStringList(source.warnings, { maxItems: 20, maxChars: 400 }),
    ...cleanStringList(fallbackSource.warnings, { maxItems: 20, maxChars: 400 })
  ], item => item, 20);
  const suggestedChangesCount = parameterRationales.filter(item => NUMERIC_SUGGESTION_TYPES.has(item.suggestionType) && rangeHasNumbers(item.suggestedRange)).length;
  return {
    parameterRationales,
    missingHighImpactInputs,
    warnings,
    suggestedChangesCount
  };
}

function normaliseParameterCoachWorkflowInput(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const assessmentType = AssessmentTypeModel.normaliseAssessmentType(source.assessmentType);
  return compactObject({
    assessmentType,
    scenario: cleanBlock(source.scenario || source.riskStatement || source.narrative || '', 5000),
    structuredScenario: normaliseLooseObject(source.structuredScenario),
    scenarioLens: normaliseLooseValue(source.scenarioLens),
    projectContext: AssessmentTypeModel.normaliseProjectContext(isPlainObject(source.projectContext) ? source.projectContext : {}, assessmentType),
    projectExposure: AssessmentTypeModel.normaliseProjectExposure(isPlainObject(source.projectExposure) ? source.projectExposure : {}),
    parameters: normaliseLooseObject(source.parameters),
    validation: normaliseLooseObject(source.validation),
    assumptionRegister: DecisionSupportModel.buildAssumptionRegister(isPlainObject(source.assumptionRegister) ? source.assumptionRegister : {}),
    evidenceMap: DecisionSupportModel.buildEvidenceMap(isPlainObject(source.evidenceMap) ? source.evidenceMap : {}),
    citations: cleanCitations(source.citations),
    businessContext: normaliseLooseObject(source.businessContext),
    adminSettings: normaliseLooseObject(source.adminSettings),
    results: normaliseLooseObject(source.results),
    traceLabel: cleanText(source.traceLabel || '', 160) || 'Parameter coach',
    priorMessages: cleanPriorMessages(source.priorMessages)
  });
}

function buildValidationWarnings(input = {}) {
  const warnings = [];
  const provided = isPlainObject(input.validation) ? input.validation : {};
  if (Array.isArray(provided.errors)) warnings.push(...provided.errors);
  if (Array.isArray(provided.warnings)) warnings.push(...provided.warnings);
  if (isPlainObject(input.parameters) && Object.keys(input.parameters).length) {
    try {
      const validation = RiskEngine.validateRunParams(input.parameters);
      warnings.push(...(Array.isArray(validation.errors) ? validation.errors : []));
      warnings.push(...(Array.isArray(validation.warnings) ? validation.warnings : []));
    } catch {}
  }
  return cleanStringList(warnings, { maxItems: 12, maxChars: 420 });
}

function getCurrentRangeFromSuggestion(suggestion = {}) {
  return convertRange(suggestion.currentRange);
}

function getSuggestedRangeFromSuggestion(suggestion = {}) {
  return convertRange(suggestion.projectRange || suggestion.suggestedRange);
}

function buildRationaleFromSuggestion(suggestion = {}, index = 0) {
  const parameterKey = normaliseParameterKey(suggestion.bucket);
  if (!parameterKey) return null;
  const suggestionType = normaliseSuggestionType(suggestion.suggestionType);
  const sourceDriver = cleanText(suggestion.sourceDriver || suggestion.sourceDriverId || suggestion.bucketLabel || parameterKey, 180);
  const missingInputs = Array.isArray(suggestion.missingInputs) ? suggestion.missingInputs : [];
  const firstMissing = missingInputs[0] || {};
  return normaliseParameterRationale({
    id: suggestion.id || `fallback_${index + 1}`,
    parameterKey,
    currentRange: getCurrentRangeFromSuggestion(suggestion),
    suggestedRange: getSuggestedRangeFromSuggestion(suggestion),
    suggestionType,
    confidence: suggestion.confidence || 'unknown',
    sourceStatus: suggestion.sourceStatus || 'unknown',
    rationale: suggestion.rationale || (
      NUMERIC_SUGGESTION_TYPES.has(suggestionType)
        ? `${sourceDriver} supports a ${suggestionType === 'benchmark_proxy_range' ? 'benchmark proxy' : 'project-derived'} range for ${suggestion.bucketLabel || parameterKey}.`
        : `${sourceDriver} is relevant to ${suggestion.bucketLabel || parameterKey}, but the supporting project value is unknown.`
    ),
    evidenceRefs: suggestion.evidenceRefs || [],
    projectExposureRefs: [suggestion.sourceDriverId || sourceDriver].filter(Boolean),
    challenge: firstMissing.suggestedQuestion || (
      NUMERIC_SUGGESTION_TYPES.has(suggestionType)
        ? `Is ${sourceDriver.toLowerCase()} supported by evidence, or should it remain a stress case?`
        : `What evidence would quantify ${sourceDriver.toLowerCase()}?`
    ),
    userAction: suggestionType === 'project_derived_range' || suggestionType === 'benchmark_proxy_range'
      ? 'consider_suggestion'
      : suggestionType === 'stress_case_candidate'
        ? 'run_stress_case'
        : 'ask_owner'
  }, index);
}

function linkedParameterFromMissingInput(input = {}, fallback = '') {
  const mapsTo = Array.isArray(input.mapsTo) ? input.mapsTo : [input.mapsTo].filter(Boolean);
  const mapped = mapsTo.map(normaliseParameterKey).find(Boolean);
  return mapped || normaliseParameterKey(input.linkedParameter || fallback || FIELD_TO_PARAMETER[cleanText(input.field || input.label)] || '');
}

function collectMissingInputs(projectExposure = {}, suggestions = []) {
  const inputs = [];
  const add = (item, fallbackParameter = '') => {
    if (!item) return;
    const source = isPlainObject(item) ? item : { field: cleanText(item), label: cleanText(item) };
    const normalised = normaliseMissingHighImpactInput({
      field: source.field || source.label,
      importance: source.importance || 'medium',
      whyItMatters: source.whyItMatters || source.why || 'This project value can change the mapped FAIR parameter and should not be treated as zero.',
      whoMightKnow: source.whoMightKnow || 'Assessment owner',
      suggestedQuestion: source.suggestedQuestion || `Can you confirm ${cleanText(source.label || source.field || 'this project input').toLowerCase()}?`,
      linkedParameter: linkedParameterFromMissingInput(source, fallbackParameter)
    });
    if (normalised) inputs.push(normalised);
  };
  suggestions
    .filter(item => item.suggestionType === 'parameter_gap' || item.suggestionType === 'stress_case_candidate')
    .forEach((suggestion) => {
      (Array.isArray(suggestion.missingInputs) ? suggestion.missingInputs : []).forEach(item => add(item, suggestion.bucket));
    });
  (Array.isArray(projectExposure.missingInputs) ? projectExposure.missingInputs : []).forEach(add);
  const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
  (Array.isArray(quality.unknownHighImpactInputs) ? quality.unknownHighImpactInputs : []).forEach(add);
  return dedupeBy(inputs, item => item.field, 3).sort((left, right) => {
    const weights = { high: 3, medium: 2, low: 1 };
    return (weights[right.importance] || 0) - (weights[left.importance] || 0);
  }).slice(0, 3);
}

function getRange(parameters = {}, prefix = '') {
  const min = finiteNumber(parameters[`${prefix}Min`]);
  const likely = finiteNumber(parameters[`${prefix}Likely`]);
  const max = finiteNumber(parameters[`${prefix}Max`]);
  if (min === null || likely === null || max === null) return null;
  return { min, likely, max };
}

function isWideRange(range) {
  if (!range) return false;
  if (range.max <= range.min) return false;
  if (range.likely <= 0) return range.max > Math.max(1, range.min) * 10;
  return range.max / Math.max(range.likely, 1e-9) >= 5 || Math.max(range.likely, 1e-9) / Math.max(range.min, 1e-9) >= 10;
}

function buildWideRangeRationales(parameters = {}) {
  return RANGE_DEFINITIONS
    .map(definition => ({ definition, range: getRange(parameters, definition.prefix) }))
    .filter(item => isWideRange(item.range))
    .map(({ definition, range }, index) => normaliseParameterRationale({
      id: `wide_range_${definition.key}_${index + 1}`,
      parameterKey: definition.key,
      currentRange: range,
      suggestedRange: null,
      suggestionType: 'stress_case_candidate',
      confidence: 'low',
      sourceStatus: 'estimated',
      rationale: `${definition.label} has a wide current range. Treat this as uncertainty to challenge or stress-test, not as a project-derived replacement.`,
      challenge: `What evidence supports the severe case for ${definition.label.toLowerCase()}?`,
      userAction: 'run_stress_case'
    }, index))
    .filter(Boolean)
    .slice(0, 5);
}

function normaliseWarningText(value) {
  if (isPlainObject(value)) return cleanBlock(value.message || value.label || value.id || '', 400);
  return cleanBlock(value, 400);
}

function buildDeterministicParameterCoach(input = {}) {
  const projectExposure = isPlainObject(input.projectExposure) ? input.projectExposure : {};
  const parameters = isPlainObject(input.parameters) ? input.parameters : {};
  const suggestions = ProjectParameterSuggestionService.deriveParameterSuggestionsFromProjectExposure(projectExposure, parameters);
  const parameterRationales = [
    ...suggestions.map(buildRationaleFromSuggestion).filter(Boolean),
    ...buildWideRangeRationales(parameters)
  ];
  const missingHighImpactInputs = collectMissingInputs(projectExposure, suggestions);
  const doubleCountingWarnings = (Array.isArray(projectExposure.doubleCountingWarnings) ? projectExposure.doubleCountingWarnings : [])
    .map(normaliseWarningText)
    .filter(Boolean);
  const validationWarnings = buildValidationWarnings(input);
  const assumptionWarnings = (Array.isArray(input.assumptionRegister?.assumptions) ? input.assumptionRegister.assumptions : [])
    .filter(item => ['unknown', 'benchmark_proxy'].includes(item.sourceStatus))
    .slice(0, 4)
    .map(item => `Open assumption: ${item.statement || item.text || item.label || item.id}`);
  return normaliseParameterCoachForApi({
    parameterRationales,
    missingHighImpactInputs,
    warnings: [
      ...validationWarnings,
      ...doubleCountingWarnings,
      ...assumptionWarnings
    ]
  });
}

function classifyParameterCoachFallbackReason(error = null) {
  const message = String(error?.message || error || '');
  if (/Hosted AI proxy is not configured|AI_PROXY_UNAVAILABLE|COMPASS_API_KEY/i.test(message)) {
    return {
      code: 'hosted_ai_unavailable',
      title: 'Hosted AI unavailable',
      message: 'Hosted AI is not configured, so deterministic parameter coaching was used.',
      detail: message
    };
  }
  if (/structured response|JSON|schema|unusable|Unexpected token|malformed/i.test(message)) {
    return {
      code: 'invalid_ai_output',
      title: 'AI output was not usable',
      message: 'The AI response could not be safely converted into the parameter coach schema, so deterministic fallback was used.',
      detail: message
    };
  }
  if (/timed out|timeout/i.test(message)) {
    return {
      code: 'parameter_coach_timeout',
      title: 'AI parameter coach timed out',
      message: 'AI parameter coaching timed out, so deterministic fallback was used.',
      detail: message
    };
  }
  return {
    code: 'parameter_coach_ai_failed',
    title: 'AI parameter coach failed',
    message: 'AI parameter coaching failed, so deterministic fallback was used.',
    detail: message
  };
}

function buildDeterministicParameterCoachResult(options = {}) {
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
  const parameterCoach = buildDeterministicParameterCoach(input);
  const reason = fallbackReason || {
    code: aiUnavailable ? 'hosted_ai_unavailable' : 'deterministic_parameter_coach',
    title: 'Deterministic parameter coach',
    message: aiUnavailable
      ? 'Hosted AI was unavailable, so deterministic parameter coaching was used.'
      : 'The deterministic parameter coach was used.',
    detail: normalisedError ? String(normalisedError.message || normalisedError) : ''
  };
  return {
    mode: 'deterministic_fallback',
    parameterCoach,
    trace: buildTraceEntry({
      label: input.traceLabel || 'Parameter coach',
      promptSummary,
      response: response || JSON.stringify(parameterCoach, null, 2),
      sources: input.citations || []
    }),
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    fallbackReasonCode: reason.code || 'deterministic_parameter_coach',
    fallbackReasonTitle: reason.title || 'Deterministic parameter coach',
    fallbackReasonMessage: reason.message || '',
    fallbackReasonDetail: reason.detail || '',
    generatedAt: new Date().toISOString()
  };
}

function buildSystemPrompt() {
  return `You are an AI Parameter Coach for FAIR-style enterprise risk estimates.

Return JSON only. Do not include markdown.

Rules:
- Do not change auth/RBAC or user permissions.
- Do not invent precise project values.
- Do not create precise ranges from unknown project values.
- If a value is unknown, create parameter_gap or stress_case_candidate, not a fake range.
- Preserve low <= likely <= high.
- Explain which project financial driver supports each suggestion.
- Do not double-count project spend, revenue, margin, penalties, or recoveries.
- Rank the one to three missing project inputs that most improve decision confidence.
- Do not ask for every blank field.
- Suggestions are advisory only; never imply automatic overwrite.
- Return only JSON matching this schema:
${PARAMETER_COACH_SCHEMA}`;
}

function buildUserPrompt(input = {}, deterministicCoach = {}) {
  const compactInput = {
    assessmentType: input.assessmentType,
    scenario: input.scenario,
    structuredScenario: input.structuredScenario,
    scenarioLens: input.scenarioLens,
    projectContext: input.projectContext,
    projectExposure: input.projectExposure,
    parameters: input.parameters,
    validation: input.validation,
    assumptionRegister: input.assumptionRegister,
    evidenceMap: input.evidenceMap,
    citations: input.citations,
    businessContext: input.businessContext,
    adminSettings: input.adminSettings,
    results: input.results
  };
  return `Review these current parameter ranges, project-derived values, benchmark proxies, assumptions, and unknown high-impact inputs.

Use the deterministic baseline below as a guardrail. You may improve wording and ranking, but do not remove unknown high-impact project gaps unless the input marks them known, not applicable, or evidence-supported.

Deterministic baseline:
${JSON.stringify(deterministicCoach, null, 2)}

Input:
${JSON.stringify(compactInput, null, 2)}

Return only the Parameter Coach JSON object.`;
}

async function buildParameterCoachWorkflow(input = {}) {
  const normalisedInput = normaliseParameterCoachWorkflowInput(input);
  const deterministic = buildDeterministicParameterCoach(normalisedInput);
  const timeouts = buildWorkflowTimeoutProfile({
    liveMs: Number(process.env.PARAMETER_COACH_AI_TIMEOUT_MS || 22000),
    repairMs: Number(process.env.PARAMETER_COACH_AI_REPAIR_TIMEOUT_MS || 8000)
  });
  try {
    const generation = await callAi(buildSystemPrompt(), buildUserPrompt(normalisedInput, deterministic), {
      taskName: 'parameterCoach',
      temperature: 0.1,
      maxCompletionTokens: 2600,
      maxPromptChars: MAX_PROMPT_CHARS,
      timeoutMs: timeouts.liveMs,
      priorMessages: normalisedInput.priorMessages
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, PARAMETER_COACH_SCHEMA, {
      taskName: 'parameterCoachRepair',
      timeoutMs: timeouts.repairMs,
      maxCompletionTokens: 2600,
      maxPromptChars: 14000
    });
    const parameterCoach = normaliseParameterCoachForApi(parsed.parsed, deterministic);
    const traces = [
      buildTraceEntry({
        label: normalisedInput.traceLabel || 'Parameter coach',
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: normalisedInput.citations || []
      }),
      parsed.trace || null
    ].filter(Boolean);
    return {
      mode: 'live',
      parameterCoach,
      trace: traces[0] || null,
      traces,
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyParameterCoachFallbackReason,
      buildFallbackResult: buildDeterministicParameterCoachResult,
      fallbackOptions: {
        input: normalisedInput,
        promptSummary: buildUserPrompt(normalisedInput, deterministic),
        response: String(error?.message || error || '')
      }
    });
  }
}

module.exports = {
  PARAMETER_COACH_SCHEMA,
  buildDeterministicParameterCoach,
  buildDeterministicParameterCoachResult,
  buildParameterCoachWorkflow,
  classifyParameterCoachFallbackReason,
  normaliseParameterCoachForApi,
  normaliseParameterCoachWorkflowInput
};
