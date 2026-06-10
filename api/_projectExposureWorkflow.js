'use strict';

const { buildTraceEntry, callAi, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
const { buildFallbackFromError, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const AssessmentTypeModel = require('../assets/state/assessmentTypeModel.js');
const ProjectExposureService = require('../assets/services/projectExposureService.js');

const MAX_PROMPT_CHARS = 24000;
const PROJECT_EXPOSURE_SCHEMA = `{
  "valuationMode": "project_linked|hybrid|benchmark_led",
  "projectExposureSummary": "string",
  "projectInputQuality": {
    "score": number,
    "label": "Thin project economics|Partial project economics|Usable project economics|Strong project economics",
    "knownHighImpactInputs": ["string"],
    "estimatedHighImpactInputs": ["string"],
    "unknownHighImpactInputs": ["string"],
    "canProceed": boolean,
    "recommendedNextInput": {
      "field": "string",
      "why": "string",
      "whoMightKnow": "string",
      "suggestedQuestion": "string"
    }
  },
  "financialDrivers": [
    {
      "id": "string",
      "label": "string",
      "driverType": "delay|budget_overrun|reprocurement|sunk_cost|margin_at_risk|revenue_at_risk|cost_to_cure|liquidated_damages|sla_credits|termination|legal_dispute|recovery_offset|other",
      "driverStatus": "calculated_driver|estimated_driver|benchmark_proxy_driver|unquantified_driver|not_applicable_driver",
      "formula": "string",
      "low": number|null,
      "likely": number|null,
      "high": number|null,
      "mapsTo": ["incidentResponse|businessInterruption|dataRemediation|regulatoryLegal|thirdParty|reputationContract|secondaryLoss|none"],
      "confidence": "high|medium|low|unknown",
      "source": "user|document|ai_inferred|project_exposure_mapper|benchmark|admin_default|not_provided|unknown",
      "missingInputs": ["string"],
      "rationale": "string"
    }
  ],
  "capsAndOffsets": [
    {
      "type": "string",
      "effect": "reduces_loss|caps_loss|increases_loss|informational",
      "low": number|null,
      "likely": number|null,
      "high": number|null,
      "confidence": "high|medium|low|unknown",
      "source": "string",
      "rationale": "string"
    }
  ],
  "doubleCountingWarnings": ["string"],
  "missingInputs": [
    {
      "field": "string",
      "label": "string",
      "importance": "high|medium|low",
      "whyItMatters": "string",
      "whoMightKnow": "string",
      "suggestedQuestion": "string",
      "mapsTo": ["string"]
    }
  ],
  "mapsToRiskParameters": {}
}`;

const DRIVER_STATUSES = new Set([
  'calculated_driver',
  'estimated_driver',
  'benchmark_proxy_driver',
  'unquantified_driver',
  'not_applicable_driver'
]);

const DRIVER_TYPES = new Set([
  'delay',
  'budget_overrun',
  'reprocurement',
  'sunk_cost',
  'margin_at_risk',
  'revenue_at_risk',
  'cost_to_cure',
  'liquidated_damages',
  'sla_credits',
  'termination',
  'legal_dispute',
  'recovery_offset',
  'other'
]);

const RISK_BUCKETS = new Set([
  'incidentResponse',
  'businessInterruption',
  'dataRemediation',
  'regulatoryLegal',
  'thirdParty',
  'reputationContract',
  'secondaryLoss',
  'none'
]);

const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const VALUATION_MODES = new Set(['project_linked', 'hybrid', 'benchmark_led']);
const OFFSET_EFFECTS = new Set(['reduces_loss', 'caps_loss', 'increases_loss', 'informational']);
const INPUT_QUALITY_LABELS = new Set([
  'Thin project economics',
  'Partial project economics',
  'Usable project economics',
  'Strong project economics'
]);

const DRIVER_TYPE_ALIASES = Object.freeze({
  delay_cost: 'delay',
  delayed_benefit: 'delay',
  reprocurement_premium: 'reprocurement',
  legal_dispute_cost: 'legal_dispute',
  termination_liability: 'termination',
  delayed_revenue_recognition: 'revenue_at_risk',
  future_pipeline: 'revenue_at_risk',
  warranty_cost: 'cost_to_cure'
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function compactObject(value) {
  if (!isPlainObject(value)) return {};
  return Object.keys(value).reduce((output, key) => {
    const item = value[key];
    if (item === undefined) return output;
    output[key] = item;
    return output;
  }, {});
}

function cleanText(value = '', maxChars = 600) {
  return sanitizeAiText(String(value || '').replace(/\s+/g, ' ').trim(), { maxChars });
}

function cleanBlock(value = '', maxChars = 3000) {
  return sanitizeAiText(String(value || '').replace(/\r\n?/g, '\n').trim(), { maxChars });
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function cleanStringList(items = [], { maxItems = 12, maxChars = 200 } = {}) {
  const seen = new Set();
  const output = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const value = cleanText(item, maxChars);
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (output.length < maxItems) output.push(value);
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
  return compactObject({
    title: cleanText(item.title || item.sourceTitle || item.note || '', 160),
    sourceTitle: cleanText(item.sourceTitle || '', 160),
    excerpt: cleanBlock(item.excerpt || item.description || item.text || item.note || '', 900),
    url: cleanText(item.url || item.link || '', 400),
    sourceType: cleanText(item.sourceType || '', 80),
    relevanceReason: cleanText(item.relevanceReason || '', 240)
  });
}

function cleanCitations(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(cleanCitation)
    .filter((item) => item && Object.keys(item).length)
    .slice(0, 10);
}

function normaliseProjectExposureWorkflowInput(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const buyerProxyQuestions = isPlainObject(source.buyerProxyAnswers)
    ? source.buyerProxyAnswers
    : source.buyerProxyQuestions;
  const sellerProxyQuestions = isPlainObject(source.sellerProxyAnswers)
    ? source.sellerProxyAnswers
    : source.sellerProxyQuestions;
  const state = AssessmentTypeModel.normaliseAssessmentTypeState({
    assessmentType: source.assessmentType,
    projectContext: isPlainObject(source.projectContext) ? source.projectContext : {},
    buyerEconomics: isPlainObject(source.buyerEconomics) ? source.buyerEconomics : {},
    buyerEconomicsMeta: isPlainObject(source.buyerEconomicsMeta) ? source.buyerEconomicsMeta : {},
    sellerEconomics: isPlainObject(source.sellerEconomics) ? source.sellerEconomics : {},
    sellerEconomicsMeta: isPlainObject(source.sellerEconomicsMeta) ? source.sellerEconomicsMeta : {},
    buyerProxyQuestions,
    sellerProxyQuestions,
    projectExposure: isPlainObject(source.projectExposure) ? source.projectExposure : {}
  });
  const horizon = isPlainObject(source.projectHorizon) ? source.projectHorizon : {};
  return compactObject({
    assessmentType: state.assessmentType,
    riskStatement: cleanBlock(source.riskStatement || '', 5000),
    projectContext: state.projectContext,
    buyerEconomics: state.buyerEconomics,
    buyerEconomicsMeta: state.buyerEconomicsMeta,
    sellerEconomics: state.sellerEconomics,
    sellerEconomicsMeta: state.sellerEconomicsMeta,
    buyerProxyAnswers: state.buyerProxyQuestions,
    buyerProxyQuestions: state.buyerProxyQuestions,
    sellerProxyAnswers: state.sellerProxyQuestions,
    sellerProxyQuestions: state.sellerProxyQuestions,
    projectHorizon: compactObject({
      delayDurationDays: finiteNumber(horizon.delayDurationDays ?? source.delayDurationDays ?? source.likelyDelayDays),
      delayDurationWeeks: finiteNumber(horizon.delayDurationWeeks ?? source.delayDurationWeeks ?? source.likelyDelayWeeks),
      delayDurationMonths: finiteNumber(horizon.delayDurationMonths ?? source.delayDurationMonths ?? source.likelyDelayMonths),
      delayDurationStatus: cleanText(horizon.delayDurationStatus || source.delayDurationStatus || '', 80)
    }),
    businessUnit: isPlainObject(source.businessUnit) ? compactObject({
      id: cleanText(source.businessUnit.id || source.businessUnit.buId || '', 100),
      name: cleanText(source.businessUnit.name || source.businessUnit.buName || '', 160),
      geography: cleanText(source.businessUnit.geography || '', 160),
      functionKey: cleanText(source.businessUnit.functionKey || '', 100),
      contextSummary: cleanBlock(source.businessUnit.contextSummary || source.businessUnit.notes || '', 1200)
    }) : undefined,
    geography: cleanText(source.geography || '', 300),
    applicableRegulations: cleanStringList(source.applicableRegulations, { maxItems: 40, maxChars: 180 }),
    citations: cleanCitations(source.citations),
    adminSettings: isPlainObject(source.adminSettings) ? compactObject({
      geography: cleanText(source.adminSettings.geography || '', 160),
      applicableRegulations: cleanStringList(source.adminSettings.applicableRegulations, { maxItems: 30, maxChars: 180 }),
      benchmarkStrategy: cleanBlock(source.adminSettings.benchmarkStrategy || '', 1000),
      businessUnitContext: cleanBlock(source.adminSettings.businessUnitContext || '', 1000),
      companyContextProfile: cleanBlock(source.adminSettings.companyContextProfile || '', 1000)
    }) : undefined,
    traceLabel: cleanText(source.traceLabel || '', 160) || 'Project exposure map',
    priorMessages: cleanPriorMessages(source.priorMessages)
  });
}

function deterministicProjectExposure(input = {}) {
  return ProjectExposureService.buildProjectExposure({
    ...input,
    buyerProxyQuestions: input.buyerProxyQuestions || input.buyerProxyAnswers,
    sellerProxyQuestions: input.sellerProxyQuestions || input.sellerProxyAnswers
  });
}

function normaliseValuationMode(value, fallback = 'hybrid') {
  const next = String(value || '').trim();
  return VALUATION_MODES.has(next) ? next : fallback;
}

function normaliseDriverStatus(value) {
  const next = String(value || '').trim();
  return DRIVER_STATUSES.has(next) ? next : 'unquantified_driver';
}

function normaliseDriverType(value) {
  const next = String(value || '').trim();
  const aliased = DRIVER_TYPE_ALIASES[next] || next;
  return DRIVER_TYPES.has(aliased) ? aliased : 'other';
}

function normaliseConfidence(value, fallback = 'unknown') {
  const next = String(value || '').trim().toLowerCase();
  return CONFIDENCE_VALUES.has(next) ? next : fallback;
}

function normaliseSource(value, fallback = 'not_provided') {
  const next = String(value || '').trim().toLowerCase();
  if (next === 'user_estimate') return 'user';
  if (next === 'evidence_supported') return 'document';
  if (['user', 'document', 'ai_inferred', 'project_exposure_mapper', 'benchmark', 'admin_default', 'not_provided', 'unknown'].includes(next)) return next;
  return fallback;
}

function normaliseMapsTo(value) {
  const raw = Array.isArray(value) ? value : [value];
  const result = raw
    .map((item) => String(item || '').trim())
    .filter((item) => RISK_BUCKETS.has(item));
  return result.length ? Array.from(new Set(result)).slice(0, 4) : ['none'];
}

function normaliseDriverMissingInputs(items = []) {
  const raw = Array.isArray(items) ? items : [];
  return raw
    .map((item) => {
      if (isPlainObject(item)) return cleanText(item.label || item.field || item.suggestedQuestion || '', 180);
      return cleanText(item, 180);
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normaliseDriver(item = {}) {
  if (!isPlainObject(item)) return null;
  let driverStatus = normaliseDriverStatus(item.driverStatus);
  const low = finiteNumber(item.low);
  const likely = finiteNumber(item.likely);
  const high = finiteNumber(item.high);
  const source = normaliseSource(item.source, driverStatus === 'unquantified_driver' ? 'unknown' : 'not_provided');
  const hasNumericRange = low !== null || likely !== null || high !== null;
  if (!hasNumericRange && !['unquantified_driver', 'not_applicable_driver'].includes(driverStatus)) {
    driverStatus = 'unquantified_driver';
  }
  const noNumbers = ['unquantified_driver', 'not_applicable_driver'].includes(driverStatus);
  return {
    id: cleanText(item.id || item.driverType || item.label || `driver_${Date.now()}`, 120),
    label: cleanText(item.label || 'Project financial driver', 180),
    driverType: normaliseDriverType(item.driverType),
    driverStatus,
    formula: noNumbers ? '' : cleanText(item.formula || '', 240),
    low: noNumbers ? null : low,
    likely: noNumbers ? null : likely,
    high: noNumbers ? null : high,
    mapsTo: normaliseMapsTo(item.mapsTo),
    confidence: driverStatus === 'unquantified_driver' ? 'low' : normaliseConfidence(item.confidence, 'unknown'),
    source: driverStatus === 'unquantified_driver' && source === 'not_provided' ? 'unknown' : source,
    missingInputs: normaliseDriverMissingInputs(item.missingInputs),
    rationale: cleanBlock(item.rationale || '', 600)
  };
}

function normaliseQualityList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (isPlainObject(item)) return cleanText(item.label || item.field || item.suggestedQuestion || '', 180);
      return cleanText(item, 180);
    })
    .filter(Boolean)
    .slice(0, 20);
}

function normaliseRecommendedNextInput(value = {}) {
  if (!isPlainObject(value)) return null;
  const field = cleanText(value.field || '', 120);
  const suggestedQuestion = cleanText(value.suggestedQuestion || '', 280);
  if (!field && !suggestedQuestion) return null;
  return {
    field,
    why: cleanText(value.why || value.whyItMatters || '', 300),
    whoMightKnow: cleanText(value.whoMightKnow || '', 160),
    suggestedQuestion
  };
}

function normaliseProjectInputQuality(value = {}, fallback = {}) {
  const source = isPlainObject(value) ? value : {};
  const fallbackQuality = isPlainObject(fallback) ? fallback : {};
  const rawScore = finiteNumber(source.score);
  const score = rawScore === null
    ? Math.max(0, Math.min(100, Number(fallbackQuality.score || 0)))
    : Math.max(0, Math.min(100, Math.round(rawScore)));
  const label = INPUT_QUALITY_LABELS.has(source.label)
    ? source.label
    : (INPUT_QUALITY_LABELS.has(fallbackQuality.label) ? fallbackQuality.label : 'Thin project economics');
  return {
    score,
    label,
    knownHighImpactInputs: normaliseQualityList(source.knownHighImpactInputs?.length ? source.knownHighImpactInputs : fallbackQuality.knownHighImpactInputs),
    estimatedHighImpactInputs: normaliseQualityList(source.estimatedHighImpactInputs?.length ? source.estimatedHighImpactInputs : fallbackQuality.estimatedHighImpactInputs),
    unknownHighImpactInputs: normaliseQualityList(source.unknownHighImpactInputs?.length ? source.unknownHighImpactInputs : fallbackQuality.unknownHighImpactInputs),
    canProceed: source.canProceed === false ? false : true,
    recommendedNextInput: normaliseRecommendedNextInput(source.recommendedNextInput) || normaliseRecommendedNextInput(fallbackQuality.recommendedNextInput)
  };
}

function normaliseOffset(item = {}) {
  if (!isPlainObject(item)) return null;
  const rawType = cleanText(item.type || item.offsetType || item.label || 'offset', 120);
  let effect = cleanText(item.effect || '', 80);
  if (!OFFSET_EFFECTS.has(effect)) {
    effect = /cap/i.test(rawType) ? 'caps_loss' : (/credit|recover|insurance/i.test(rawType) ? 'reduces_loss' : 'informational');
  }
  return {
    type: rawType,
    effect,
    low: finiteNumber(item.low),
    likely: finiteNumber(item.likely ?? item.amount),
    high: finiteNumber(item.high),
    confidence: normaliseConfidence(item.confidence, 'unknown'),
    source: normaliseSource(item.source, 'not_provided'),
    rationale: cleanBlock(item.rationale || '', 400)
  };
}

function normaliseWarningList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (isPlainObject(item)) return cleanText(item.message || item.label || item.id || '', 300);
      return cleanText(item, 300);
    })
    .filter(Boolean)
    .slice(0, 20);
}

function normaliseMissingInput(item = {}) {
  if (!isPlainObject(item)) return null;
  const field = cleanText(item.field || '', 120);
  const suggestedQuestion = cleanText(item.suggestedQuestion || '', 300);
  if (!field && !suggestedQuestion) return null;
  const importance = ['high', 'medium', 'low'].includes(String(item.importance || '').trim())
    ? String(item.importance || '').trim()
    : 'medium';
  return {
    field,
    label: cleanText(item.label || field, 160),
    importance,
    whyItMatters: cleanText(item.whyItMatters || item.why || '', 320),
    whoMightKnow: cleanText(item.whoMightKnow || '', 160),
    suggestedQuestion,
    mapsTo: normaliseMapsTo(item.mapsTo).filter((bucket) => bucket !== 'none')
  };
}

function mergeMissingInputs(primary = [], fallback = []) {
  const output = [];
  const add = (item) => {
    const next = normaliseMissingInput(item);
    if (!next) return;
    const key = `${next.field}:${next.suggestedQuestion}`.toLowerCase();
    if (!output.some((existing) => `${existing.field}:${existing.suggestedQuestion}`.toLowerCase() === key)) {
      output.push(next);
    }
  };
  (Array.isArray(primary) ? primary : []).forEach(add);
  (Array.isArray(fallback) ? fallback : []).forEach(add);
  return output.slice(0, 30);
}

function normaliseProjectExposureForApi(projectExposure = {}, fallbackExposure = null) {
  const fallback = isPlainObject(fallbackExposure) ? fallbackExposure : {};
  const source = isPlainObject(projectExposure) ? projectExposure : {};
  const fallbackWarnings = normaliseWarningList(fallback.doubleCountingWarnings);
  const warnings = normaliseWarningList(source.doubleCountingWarnings);
  const financialDrivers = (Array.isArray(source.financialDrivers) ? source.financialDrivers : [])
    .map(normaliseDriver)
    .filter(Boolean)
    .slice(0, 20);
  const fallbackDrivers = (Array.isArray(fallback.financialDrivers) ? fallback.financialDrivers : [])
    .map(normaliseDriver)
    .filter(Boolean)
    .slice(0, 20);
  const drivers = financialDrivers.length ? financialDrivers : fallbackDrivers;
  const capsAndOffsets = (Array.isArray(source.capsAndOffsets) ? source.capsAndOffsets : [])
    .map(normaliseOffset)
    .filter(Boolean)
    .slice(0, 20);
  const fallbackOffsets = (Array.isArray(fallback.capsAndOffsets) ? fallback.capsAndOffsets : [])
    .map(normaliseOffset)
    .filter(Boolean)
    .slice(0, 20);
  const exposure = {
    valuationMode: normaliseValuationMode(source.valuationMode, normaliseValuationMode(fallback.valuationMode, 'hybrid')),
    projectExposureSummary: cleanBlock(source.projectExposureSummary || fallback.projectExposureSummary || '', 1200),
    projectInputQuality: normaliseProjectInputQuality(source.projectInputQuality, fallback.projectInputQuality),
    financialDrivers: drivers,
    capsAndOffsets: capsAndOffsets.length ? capsAndOffsets : fallbackOffsets,
    doubleCountingWarnings: Array.from(new Set([...warnings, ...fallbackWarnings])).slice(0, 20),
    missingInputs: mergeMissingInputs(source.missingInputs, fallback.missingInputs),
    mapsToRiskParameters: {}
  };
  exposure.mapsToRiskParameters = ProjectExposureService.mapProjectExposureToRiskParameters(exposure);
  return exposure;
}

function buildDeterministicProjectExposureResult(options = {}) {
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
  const deterministic = deterministicProjectExposure(input);
  const projectExposure = normaliseProjectExposureForApi(deterministic, deterministic);
  const reason = fallbackReason || {
    code: aiUnavailable ? 'hosted_ai_unavailable' : 'deterministic_project_exposure',
    title: 'Deterministic project exposure map',
    message: aiUnavailable
      ? 'Hosted AI was unavailable, so the deterministic project exposure mapper was used.'
      : 'The deterministic project exposure mapper was used.',
    detail: normalisedError ? String(normalisedError.message || normalisedError) : ''
  };
  return {
    mode: 'deterministic_fallback',
    projectExposure,
    trace: buildTraceEntry({
      label: input.traceLabel || 'Project exposure map',
      promptSummary,
      response: response || JSON.stringify(projectExposure, null, 2),
      sources: input.citations || []
    }),
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    fallbackReasonCode: reason.code || 'deterministic_project_exposure',
    fallbackReasonTitle: reason.title || 'Deterministic project exposure map',
    fallbackReasonMessage: reason.message || '',
    fallbackReasonDetail: reason.detail || '',
    generatedAt: new Date().toISOString()
  };
}

function classifyProjectExposureFallbackReason(error = null) {
  const message = String(error?.message || error || '');
  if (/Hosted AI proxy is not configured|AI_PROXY_UNAVAILABLE|COMPASS_API_KEY/i.test(message)) {
    return {
      code: 'hosted_ai_unavailable',
      title: 'Hosted AI unavailable',
      message: 'Hosted AI is not configured, so deterministic project exposure mapping was used.',
      detail: message
    };
  }
  if (/structured response|JSON|schema|unusable|Unexpected token|malformed/i.test(message)) {
    return {
      code: 'invalid_ai_output',
      title: 'AI output was not usable',
      message: 'The AI response could not be safely converted into the project exposure schema, so deterministic fallback was used.',
      detail: message
    };
  }
  if (/timed out|timeout/i.test(message)) {
    return {
      code: 'project_exposure_timeout',
      title: 'AI project exposure timed out',
      message: 'AI project exposure mapping timed out, so deterministic fallback was used.',
      detail: message
    };
  }
  return {
    code: 'project_exposure_ai_failed',
    title: 'AI project exposure failed',
    message: 'AI project exposure mapping failed, so deterministic fallback was used.',
    detail: message
  };
}

function buildSystemPrompt() {
  return `You are a project financial exposure mapper for enterprise risk assessments.

Return JSON only. Do not include markdown.

Rules:
- Blank/null project economics mean unknown, not zero.
- Explicit numeric zero is valid and must be preserved.
- Do not invent exact values.
- For buyer risks, do not treat total project spend as automatic loss.
- For seller risks, do not treat total contract value as economic loss without separating revenue, margin, cost, penalties, and recoveries.
- Do not treat unknown recoveries as zero recoveries.
- Do not treat unknown LD caps as no LD exposure.
- Do not create precise numeric ranges from unknown values.
- Use qualitative proxy answers to infer relevant financial mechanisms, not precise amounts.
- If a benchmark proxy is used, label it benchmark_proxy_driver with low confidence unless evidence supports it.
- Explicitly identify missing high-impact financial inputs.
- Rank missingInputs by likely decision impact.
- Preserve deterministic drivers when they are correct; refine wording and add missing-input prioritisation where useful.
- Match this JSON schema exactly:
${PROJECT_EXPOSURE_SCHEMA}`;
}

function buildUserPrompt(input = {}, deterministic = {}) {
  const compactInput = {
    assessmentType: input.assessmentType,
    riskStatement: input.riskStatement,
    projectContext: input.projectContext,
    buyerEconomics: input.buyerEconomics,
    buyerEconomicsMeta: input.buyerEconomicsMeta,
    sellerEconomics: input.sellerEconomics,
    sellerEconomicsMeta: input.sellerEconomicsMeta,
    buyerProxyAnswers: input.buyerProxyAnswers,
    sellerProxyAnswers: input.sellerProxyAnswers,
    projectHorizon: input.projectHorizon,
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    citations: input.citations,
    adminSettings: input.adminSettings
  };
  return `Build a project financial exposure map for this sparse project risk input.

Use this deterministic baseline as a guardrail. You may improve summary, driver labels, missing-input prioritisation, and benchmark-proxy candidates, but do not override known values or convert unknowns into invented precision.

Deterministic baseline:
${JSON.stringify(normaliseProjectExposureForApi(deterministic, deterministic), null, 2)}

Input:
${JSON.stringify(compactInput, null, 2)}

Return only the project exposure JSON object.`;
}

async function buildProjectExposureMapWorkflow(input = {}) {
  const normalisedInput = normaliseProjectExposureWorkflowInput(input);
  const deterministic = deterministicProjectExposure(normalisedInput);
  const timeouts = buildWorkflowTimeoutProfile({
    liveMs: Number(process.env.PROJECT_EXPOSURE_AI_TIMEOUT_MS || 22000),
    repairMs: Number(process.env.PROJECT_EXPOSURE_AI_REPAIR_TIMEOUT_MS || 8000)
  });
  try {
    const generation = await callAi(buildSystemPrompt(), buildUserPrompt(normalisedInput, deterministic), {
      taskName: 'projectExposureMap',
      temperature: 0.1,
      maxCompletionTokens: 2600,
      maxPromptChars: MAX_PROMPT_CHARS,
      timeoutMs: timeouts.liveMs,
      priorMessages: normalisedInput.priorMessages
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, PROJECT_EXPOSURE_SCHEMA, {
      taskName: 'projectExposureMapRepair',
      timeoutMs: timeouts.repairMs,
      maxCompletionTokens: 2600,
      maxPromptChars: 14000
    });
    const projectExposure = normaliseProjectExposureForApi(parsed.parsed, deterministic);
    const traces = [
      buildTraceEntry({
        label: normalisedInput.traceLabel || 'Project exposure map',
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: normalisedInput.citations || []
      }),
      parsed.trace || null
    ].filter(Boolean);
    return {
      mode: 'live',
      projectExposure,
      trace: traces[0] || null,
      traces,
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyProjectExposureFallbackReason,
      buildFallbackResult: buildDeterministicProjectExposureResult,
      fallbackOptions: {
        input: normalisedInput,
        promptSummary: buildUserPrompt(normalisedInput, deterministic),
        response: String(error?.message || error || '')
      }
    });
  }
}

module.exports = {
  PROJECT_EXPOSURE_SCHEMA,
  buildDeterministicProjectExposureResult,
  buildProjectExposureMapWorkflow,
  classifyProjectExposureFallbackReason,
  normaliseProjectExposureForApi,
  normaliseProjectExposureWorkflowInput
};
