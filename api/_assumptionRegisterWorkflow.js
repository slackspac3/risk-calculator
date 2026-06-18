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
const ProjectExposureService = require('../assets/services/projectExposureService.js');
const RiskEngine = require('../assets/engine/riskEngine.js');

const MAX_PROMPT_CHARS = 26000;
const ASSUMPTION_REGISTER_SCHEMA = `{
  "assumptions": [
    {
      "id": "string",
      "statement": "string",
      "type": "frequency|vulnerability|duration|cost|secondary_loss|control|evidence|project_value|margin|delay|contract|recovery|proxy_value|other",
      "confidence": "high|medium|low|unknown",
      "sourceStatus": "known|estimated|derived|benchmark_proxy|unknown|not_applicable|evidence_supported",
      "evidenceRefs": ["string"],
      "parameterLinks": ["string"],
      "projectExposureRefs": ["string"],
      "riskIfWrong": "string",
      "challengeQuestion": "string",
      "status": "open|supported|weak|needs_review|proxy_used"
    }
  ],
  "missingEvidence": [
    {
      "item": "string",
      "importance": "high|medium|low",
      "whyItMatters": "string",
      "whoMightKnow": "string",
      "suggestedQuestion": "string"
    }
  ],
  "overallConfidence": "high|medium|low|unknown",
  "nextBestQuestions": [
    {
      "question": "string",
      "whyItMatters": "string",
      "fieldTarget": "string",
      "impactIfAnswered": "string"
    }
  ]
}`;

const ASSESSMENT_TYPE_GENERIC = AssessmentTypeModel.ASSESSMENT_TYPE_GENERIC || 'enterprise_generic';
const ASSESSMENT_TYPE_PROJECT_BUYER = AssessmentTypeModel.ASSESSMENT_TYPE_PROJECT_BUYER || 'project_buyer';
const ASSESSMENT_TYPE_PROJECT_SELLER = AssessmentTypeModel.ASSESSMENT_TYPE_PROJECT_SELLER || 'project_seller';

const ASSUMPTION_TYPES = new Set([
  'frequency',
  'vulnerability',
  'duration',
  'cost',
  'secondary_loss',
  'control',
  'evidence',
  'project_value',
  'margin',
  'delay',
  'contract',
  'recovery',
  'proxy_value',
  'other'
]);

const ASSUMPTION_STATUSES = new Set(['open', 'supported', 'weak', 'needs_review', 'proxy_used']);
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const SOURCE_STATUSES = new Set(['known', 'estimated', 'derived', 'benchmark_proxy', 'unknown', 'not_applicable', 'evidence_supported']);
const IMPORTANCE_VALUES = new Set(['high', 'medium', 'low']);

const FIELD_LABELS = Object.freeze({
  delayDurationDays: 'Likely delay duration',
  delayCostPerDay: 'Delay cost per day',
  delayCostPerWeek: 'Delay cost per week',
  expectedBenefitPerDay: 'Expected benefit per day',
  expectedBenefitPerWeek: 'Expected benefit per week',
  remainingSpend: 'Remaining spend',
  expectedSpend: 'Expected project spend',
  approvedBudget: 'Approved project budget',
  reprocurementPremiumPct: 'Reprocurement premium percentage',
  amountPaid: 'Amount already paid',
  amountCommitted: 'Amount committed',
  legalDisputeEstimate: 'Legal or dispute estimate',
  supplierCredits: 'Supplier credits',
  insuranceRecoveries: 'Insurance recoveries',
  liquidatedDamagesRecoverable: 'Liquidated damages recoverable',
  contractualRecoveryCap: 'Contractual recovery cap',
  expectedRevenue: 'Expected revenue',
  contractValue: 'Contract value',
  grossMarginPct: 'Gross margin percentage',
  contributionMargin: 'Contribution margin',
  costToCure: 'Cost to cure',
  warrantyExposure: 'Warranty exposure',
  liquidatedDamagesCap: 'Liquidated damages cap',
  slaCreditsCap: 'SLA credits cap',
  liabilityCap: 'Liability cap',
  terminationExposure: 'Termination exposure',
  revenueRecognitionAtRisk: 'Revenue recognition at risk',
  renewalValueAtRisk: 'Renewal or future pipeline exposure'
});

const FIELD_OWNER_HINTS = Object.freeze({
  delayDurationDays: 'Project manager or delivery lead',
  delayCostPerDay: 'Finance business partner or project controls',
  expectedBenefitPerDay: 'Business sponsor or benefits owner',
  remainingSpend: 'Project finance or procurement',
  expectedSpend: 'Project sponsor or finance business partner',
  approvedBudget: 'Project sponsor or finance business partner',
  reprocurementPremiumPct: 'Procurement or commercial lead',
  amountPaid: 'Accounts payable or project finance',
  amountCommitted: 'Procurement or contract owner',
  legalDisputeEstimate: 'Legal or contract manager',
  supplierCredits: 'Commercial manager or supplier owner',
  insuranceRecoveries: 'Insurance or risk finance',
  liquidatedDamagesRecoverable: 'Legal or contract manager',
  contractualRecoveryCap: 'Legal or contract manager',
  expectedRevenue: 'Sales finance or deal owner',
  contractValue: 'Commercial or sales operations',
  grossMarginPct: 'Finance business partner',
  contributionMargin: 'Finance business partner',
  costToCure: 'Delivery lead or project controls',
  warrantyExposure: 'Service owner or legal',
  liquidatedDamagesCap: 'Legal or commercial manager',
  slaCreditsCap: 'Service owner or commercial manager',
  liabilityCap: 'Legal or commercial manager',
  terminationExposure: 'Legal, commercial, or account owner',
  revenueRecognitionAtRisk: 'Revenue accounting or finance',
  renewalValueAtRisk: 'Account owner or sales leadership'
});

const DRIVER_TYPE_TO_ASSUMPTION_TYPE = Object.freeze({
  delay: 'delay',
  budget_overrun: 'cost',
  reprocurement: 'project_value',
  sunk_cost: 'project_value',
  margin_at_risk: 'margin',
  revenue_at_risk: 'project_value',
  cost_to_cure: 'cost',
  liquidated_damages: 'contract',
  sla_credits: 'contract',
  termination: 'contract',
  legal_dispute: 'contract',
  recovery_offset: 'recovery',
  other: 'other'
});

const FIELD_TO_ASSUMPTION_TYPE = Object.freeze({
  delayDurationDays: 'duration',
  delayCostPerDay: 'delay',
  delayCostPerWeek: 'delay',
  expectedBenefitPerDay: 'project_value',
  expectedBenefitPerWeek: 'project_value',
  remainingSpend: 'project_value',
  expectedSpend: 'project_value',
  approvedBudget: 'project_value',
  reprocurementPremiumPct: 'project_value',
  amountPaid: 'project_value',
  amountCommitted: 'project_value',
  legalDisputeEstimate: 'contract',
  supplierCredits: 'recovery',
  insuranceRecoveries: 'recovery',
  liquidatedDamagesRecoverable: 'recovery',
  contractualRecoveryCap: 'contract',
  expectedRevenue: 'project_value',
  contractValue: 'project_value',
  grossMarginPct: 'margin',
  contributionMargin: 'margin',
  costToCure: 'cost',
  warrantyExposure: 'cost',
  liquidatedDamagesCap: 'contract',
  slaCreditsCap: 'contract',
  liabilityCap: 'contract',
  terminationExposure: 'contract',
  revenueRecognitionAtRisk: 'project_value',
  renewalValueAtRisk: 'secondary_loss'
});

const RANGE_DEFINITIONS = Object.freeze([
  { prefix: 'tef', label: 'Event frequency', type: 'frequency', parameter: 'tef' },
  { prefix: 'vuln', label: 'Event success likelihood', type: 'vulnerability', parameter: 'vulnerability' },
  { prefix: 'threatCap', label: 'Threat capability', type: 'vulnerability', parameter: 'threatCap' },
  { prefix: 'controlStr', label: 'Control strength', type: 'control', parameter: 'controlStr' },
  { prefix: 'ir', label: 'Incident response cost', type: 'cost', parameter: 'incidentResponse' },
  { prefix: 'bi', label: 'Business interruption cost', type: 'cost', parameter: 'businessInterruption' },
  { prefix: 'db', label: 'Data remediation cost', type: 'cost', parameter: 'dataRemediation' },
  { prefix: 'rl', label: 'Regulatory and legal cost', type: 'cost', parameter: 'regulatoryLegal' },
  { prefix: 'tp', label: 'Third-party impact cost', type: 'cost', parameter: 'thirdParty' },
  { prefix: 'rc', label: 'Reputation and contract cost', type: 'cost', parameter: 'reputationContract' },
  { prefix: 'secProb', label: 'Secondary-loss probability', type: 'secondary_loss', parameter: 'secondaryLossProbability' },
  { prefix: 'secMag', label: 'Secondary-loss magnitude', type: 'secondary_loss', parameter: 'secondaryLossMagnitude' }
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

function normaliseAssessmentType(value) {
  return AssessmentTypeModel.normaliseAssessmentType(value);
}

function normaliseConfidence(value, fallback = 'unknown') {
  const next = cleanText(value, 80).toLowerCase();
  return CONFIDENCE_VALUES.has(next) ? next : fallback;
}

function normaliseSourceStatus(value, fallback = 'unknown') {
  const next = DecisionSupportModel.normaliseSourceStatus(value || fallback);
  return SOURCE_STATUSES.has(next) ? next : fallback;
}

function normaliseAssumptionType(value, fallback = 'other') {
  const next = cleanText(value, 80).toLowerCase().replace(/[\s-]+/g, '_');
  return ASSUMPTION_TYPES.has(next) ? next : fallback;
}

function normaliseAssumptionStatus(value, sourceStatus = 'unknown') {
  const next = cleanText(value, 80).toLowerCase().replace(/[\s-]+/g, '_');
  if (ASSUMPTION_STATUSES.has(next)) return next;
  if (sourceStatus === 'evidence_supported' || sourceStatus === 'known' || sourceStatus === 'derived') return 'supported';
  if (sourceStatus === 'benchmark_proxy') return 'proxy_used';
  if (sourceStatus === 'estimated') return 'weak';
  return 'open';
}

function normaliseImportance(value, fallback = 'medium') {
  const next = cleanText(value, 80).toLowerCase();
  return IMPORTANCE_VALUES.has(next) ? next : fallback;
}

function sourceStatusFromDriver(driver = {}) {
  const status = cleanText(driver.driverStatus || '', 80);
  const source = cleanText(driver.source || '', 80);
  if (status === 'benchmark_proxy_driver' || source === 'benchmark') return 'benchmark_proxy';
  if (status === 'estimated_driver') return 'estimated';
  if (status === 'calculated_driver') return source === 'document' ? 'evidence_supported' : 'derived';
  if (status === 'not_applicable_driver') return 'not_applicable';
  return 'unknown';
}

function assumptionTypeFromField(field = '') {
  return FIELD_TO_ASSUMPTION_TYPE[field] || 'other';
}

function assumptionTypeFromDriver(driverType = '') {
  return DRIVER_TYPE_TO_ASSUMPTION_TYPE[driverType] || 'other';
}

function normaliseMapsTo(value = []) {
  return cleanStringList(value, { maxItems: 6, maxChars: 80 });
}

function normaliseAssumption(item = {}, index = 0) {
  if (!isPlainObject(item)) {
    const text = cleanText(item, 800);
    if (!text) return null;
    return {
      id: `assumption_${index + 1}`,
      statement: text,
      type: 'other',
      confidence: 'unknown',
      sourceStatus: 'unknown',
      evidenceRefs: [],
      parameterLinks: [],
      projectExposureRefs: [],
      riskIfWrong: '',
      challengeQuestion: '',
      status: 'open'
    };
  }
  const sourceStatus = normaliseSourceStatus(item.sourceStatus || item.source_status || item.sourceStatusHint || '');
  const statement = cleanBlock(item.statement || item.text || item.label || item.summary || '', 1200);
  if (!statement) return null;
  return {
    id: cleanText(item.id || `assumption_${index + 1}`, 120),
    statement,
    type: normaliseAssumptionType(item.type, 'other'),
    confidence: normaliseConfidence(item.confidence),
    sourceStatus,
    evidenceRefs: cleanStringList(item.evidenceRefs || item.evidence || item.citations, { maxItems: 10, maxChars: 180 }),
    parameterLinks: cleanStringList(item.parameterLinks || item.parameters || item.mapsTo, { maxItems: 10, maxChars: 120 }),
    projectExposureRefs: cleanStringList(item.projectExposureRefs || item.projectExposureRef || item.driverIds, { maxItems: 10, maxChars: 160 }),
    riskIfWrong: cleanBlock(item.riskIfWrong || item.risk || '', 600),
    challengeQuestion: cleanBlock(item.challengeQuestion || item.question || item.suggestedQuestion || '', 600),
    status: normaliseAssumptionStatus(item.status, sourceStatus)
  };
}

function normaliseMissingEvidence(item = {}, index = 0) {
  if (!isPlainObject(item)) {
    const text = cleanText(item, 300);
    if (!text) return null;
    return {
      item: text,
      importance: 'medium',
      whyItMatters: '',
      whoMightKnow: '',
      suggestedQuestion: ''
    };
  }
  const itemText = cleanText(item.item || item.label || item.field || item.text || `Missing evidence ${index + 1}`, 240);
  if (!itemText) return null;
  return {
    item: itemText,
    importance: normaliseImportance(item.importance, 'medium'),
    whyItMatters: cleanBlock(item.whyItMatters || item.why || '', 500),
    whoMightKnow: cleanText(item.whoMightKnow || item.owner || '', 180),
    suggestedQuestion: cleanBlock(item.suggestedQuestion || item.question || '', 500)
  };
}

function normaliseNextQuestion(item = {}, index = 0) {
  if (!isPlainObject(item)) {
    const text = cleanText(item, 500);
    if (!text) return null;
    return {
      question: text,
      whyItMatters: '',
      fieldTarget: '',
      impactIfAnswered: ''
    };
  }
  const question = cleanBlock(item.question || item.suggestedQuestion || item.text || '', 500);
  if (!question) return null;
  return {
    question,
    whyItMatters: cleanBlock(item.whyItMatters || item.why || '', 500),
    fieldTarget: cleanText(item.fieldTarget || item.field || item.target || `question_${index + 1}`, 160),
    impactIfAnswered: cleanBlock(item.impactIfAnswered || item.impact || '', 500)
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

function normaliseAssumptionRegisterForApi(register = {}, fallback = {}) {
  const source = isPlainObject(register) ? register : {};
  const fallbackRegister = isPlainObject(fallback) ? fallback : {};
  const sourceModel = DecisionSupportModel.buildAssumptionRegister(source);
  const fallbackModel = DecisionSupportModel.buildAssumptionRegister(fallbackRegister);

  const assumptions = dedupeBy([
    ...(Array.isArray(source.assumptions) ? source.assumptions : sourceModel.assumptions),
    ...(Array.isArray(fallbackRegister.assumptions) ? fallbackRegister.assumptions : fallbackModel.assumptions)
  ].map(normaliseAssumption).filter(Boolean), item => item.id || item.statement, 30);

  const missingEvidence = dedupeBy([
    ...(Array.isArray(source.missingEvidence) ? source.missingEvidence : sourceModel.missingEvidence),
    ...(Array.isArray(fallbackRegister.missingEvidence) ? fallbackRegister.missingEvidence : fallbackModel.missingEvidence)
  ].map(normaliseMissingEvidence).filter(Boolean), item => item.item, 30);

  const nextBestQuestions = dedupeBy([
    ...(Array.isArray(source.nextBestQuestions) ? source.nextBestQuestions : sourceModel.nextBestQuestions),
    ...(Array.isArray(fallbackRegister.nextBestQuestions) ? fallbackRegister.nextBestQuestions : fallbackModel.nextBestQuestions)
  ].map(normaliseNextQuestion).filter(Boolean), item => item.fieldTarget || item.question, 3);

  return {
    assumptions,
    missingEvidence,
    overallConfidence: normaliseConfidence(source.overallConfidence, normaliseConfidence(fallbackRegister.overallConfidence, fallbackModel.overallConfidence || 'unknown')),
    nextBestQuestions
  };
}

function normaliseAssumptionRegisterWorkflowInput(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const state = AssessmentTypeModel.normaliseAssessmentTypeState({
    assessmentType: source.assessmentType,
    projectContext: isPlainObject(source.projectContext) ? source.projectContext : {},
    buyerEconomics: isPlainObject(source.buyerEconomics) ? source.buyerEconomics : {},
    buyerEconomicsMeta: isPlainObject(source.buyerEconomicsMeta) ? source.buyerEconomicsMeta : {},
    sellerEconomics: isPlainObject(source.sellerEconomics) ? source.sellerEconomics : {},
    sellerEconomicsMeta: isPlainObject(source.sellerEconomicsMeta) ? source.sellerEconomicsMeta : {},
    projectExposure: isPlainObject(source.projectExposure) ? source.projectExposure : {}
  });
  const scenario = cleanBlock(source.scenario || source.riskStatement || source.narrative || '', 5000);
  return compactObject({
    assessmentType: state.assessmentType,
    scenario,
    structuredScenario: normaliseLooseObject(source.structuredScenario),
    scenarioLens: normaliseLooseValue(source.scenarioLens),
    projectContext: state.projectContext,
    buyerEconomics: state.buyerEconomics,
    buyerEconomicsMeta: state.buyerEconomicsMeta,
    sellerEconomics: state.sellerEconomics,
    sellerEconomicsMeta: state.sellerEconomicsMeta,
    projectExposure: state.projectExposure,
    businessUnit: normaliseLooseObject(source.businessUnit),
    geography: cleanText(source.geography || '', 300),
    applicableRegulations: cleanStringList(source.applicableRegulations, { maxItems: 40, maxChars: 180 }),
    citations: cleanCitations(source.citations),
    evidenceMap: DecisionSupportModel.buildEvidenceMap(isPlainObject(source.evidenceMap) ? source.evidenceMap : {}),
    parameters: normaliseLooseObject(source.parameters),
    results: normaliseLooseObject(source.results),
    adminSettings: normaliseLooseObject(source.adminSettings),
    traceLabel: cleanText(source.traceLabel || '', 160) || 'Assumption register',
    priorMessages: cleanPriorMessages(source.priorMessages)
  });
}

function deterministicProjectExposure(input = {}) {
  if (![ASSESSMENT_TYPE_PROJECT_BUYER, ASSESSMENT_TYPE_PROJECT_SELLER].includes(input.assessmentType)) {
    return AssessmentTypeModel.normaliseProjectExposure(input.projectExposure);
  }
  return ProjectExposureService.buildProjectExposure(input);
}

function mergeProjectExposure(provided = {}, deterministic = {}) {
  const source = isPlainObject(provided) ? provided : {};
  const fallback = isPlainObject(deterministic) ? deterministic : {};
  const mergeArray = (primary, secondary, keyFn) => dedupeBy([
    ...(Array.isArray(primary) ? primary : []),
    ...(Array.isArray(secondary) ? secondary : [])
  ], keyFn, 40);
  return {
    valuationMode: cleanText(source.valuationMode || fallback.valuationMode || 'benchmark_led', 80),
    projectExposureSummary: cleanBlock(source.projectExposureSummary || fallback.projectExposureSummary || '', 1200),
    projectInputQuality: isPlainObject(source.projectInputQuality) && Object.keys(source.projectInputQuality).length
      ? source.projectInputQuality
      : (fallback.projectInputQuality || {}),
    financialDrivers: mergeArray(source.financialDrivers, fallback.financialDrivers, item => item?.id || item?.label || JSON.stringify(item)),
    capsAndOffsets: mergeArray(source.capsAndOffsets, fallback.capsAndOffsets, item => item?.id || item?.type || item?.label || JSON.stringify(item)),
    doubleCountingWarnings: mergeArray(source.doubleCountingWarnings, fallback.doubleCountingWarnings, item => item?.id || item?.message || item?.label || String(item)),
    missingInputs: mergeArray(source.missingInputs, fallback.missingInputs, item => item?.field || item?.label || item?.suggestedQuestion || String(item)),
    mapsToRiskParameters: isPlainObject(source.mapsToRiskParameters) && Object.keys(source.mapsToRiskParameters).length
      ? source.mapsToRiskParameters
      : (fallback.mapsToRiskParameters || {})
  };
}

function normaliseProjectMissingInput(item = {}) {
  if (!isPlainObject(item)) {
    const text = cleanText(item, 240);
    if (!text) return null;
    return {
      field: text,
      label: text,
      importance: 'medium',
      whyItMatters: `${text} is missing and should not be treated as zero.`,
      whoMightKnow: 'Assessment owner',
      suggestedQuestion: `Can you confirm ${text.toLowerCase()}, or mark it as unknown/not applicable?`,
      mapsTo: []
    };
  }
  const field = cleanText(item.field || item.id || item.label || '', 140);
  const label = cleanText(item.label || FIELD_LABELS[field] || field || 'Missing project input', 180);
  if (!field && !label) return null;
  return {
    field: field || label,
    label,
    importance: normaliseImportance(item.importance, 'medium'),
    whyItMatters: cleanBlock(item.whyItMatters || item.why || `${label} is needed to quantify this project exposure without treating unknowns as zero.`, 500),
    whoMightKnow: cleanText(item.whoMightKnow || FIELD_OWNER_HINTS[field] || 'Assessment owner', 180),
    suggestedQuestion: cleanBlock(item.suggestedQuestion || `Can you confirm ${label.toLowerCase()} for this project, or mark it as unknown/not applicable?`, 500),
    mapsTo: normaliseMapsTo(item.mapsTo)
  };
}

function collectProjectMissingInputs(projectExposure = {}) {
  const inputs = [];
  const add = (item) => {
    const normalised = normaliseProjectMissingInput(item);
    if (normalised) inputs.push(normalised);
  };
  (Array.isArray(projectExposure.missingInputs) ? projectExposure.missingInputs : []).forEach(add);
  const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
  (Array.isArray(quality.unknownHighImpactInputs) ? quality.unknownHighImpactInputs : []).forEach(add);
  (Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers : []).forEach((driver) => {
    (Array.isArray(driver?.missingInputs) ? driver.missingInputs : []).forEach((item) => {
      if (isPlainObject(item)) add(item);
      else add({
        field: cleanText(item, 140),
        label: cleanText(item, 180),
        importance: 'high',
        mapsTo: driver.mapsTo || [],
        whyItMatters: `${cleanText(item, 180)} is needed to quantify ${cleanText(driver.label || 'this driver', 180)} without false precision.`,
        suggestedQuestion: `Can you confirm ${cleanText(item, 180).toLowerCase()}, or mark it as unknown/not applicable?`
      });
    });
  });
  return dedupeBy(inputs, item => item.field || item.label, 20);
}

function buildMissingProjectAssumption(item = {}, index = 0) {
  const field = cleanText(item.field || item.label || `missing_project_input_${index + 1}`, 140);
  const label = cleanText(item.label || FIELD_LABELS[field] || field, 180);
  const type = assumptionTypeFromField(field);
  return {
    id: `project_unknown_${field.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`.slice(0, 120),
    statement: `${label} is unknown and is carried forward as an explicit assumption, not as zero.`,
    type,
    confidence: 'low',
    sourceStatus: 'unknown',
    evidenceRefs: [],
    parameterLinks: normaliseMapsTo(item.mapsTo),
    projectExposureRefs: [field],
    riskIfWrong: 'The decision may understate or overstate project exposure if this value is materially different from the implicit assumption.',
    challengeQuestion: item.suggestedQuestion || `Can you confirm ${label.toLowerCase()}?`,
    status: 'open'
  };
}

function buildMissingEvidenceFromProjectInput(item = {}) {
  return {
    item: item.label || item.field,
    importance: item.importance || 'medium',
    whyItMatters: item.whyItMatters || `${item.label || item.field} affects the project exposure map and should not be assumed to be zero.`,
    whoMightKnow: item.whoMightKnow || FIELD_OWNER_HINTS[item.field] || 'Assessment owner',
    suggestedQuestion: item.suggestedQuestion || `Can you confirm ${String(item.label || item.field || '').toLowerCase()}?`
  };
}

function buildNextQuestionFromProjectInput(item = {}) {
  return {
    question: item.suggestedQuestion || `Can you confirm ${String(item.label || item.field || '').toLowerCase()}?`,
    whyItMatters: item.whyItMatters || `${item.label || item.field} is a decision-sensitive project input.`,
    fieldTarget: item.field || item.label,
    impactIfAnswered: 'It can convert an unknown project exposure into a known, estimated, not-applicable, or benchmark-proxy assumption.'
  };
}

function buildDriverAssumption(driver = {}, index = 0) {
  if (!isPlainObject(driver)) return null;
  const label = cleanText(driver.label || driver.id || `Project driver ${index + 1}`, 180);
  const sourceStatus = sourceStatusFromDriver(driver);
  return {
    id: `driver_${cleanText(driver.id || label, 100).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
    statement: sourceStatus === 'unknown'
      ? `${label} is relevant but not yet quantified.`
      : `${label} is included using ${sourceStatus.replace(/_/g, ' ')} project exposure inputs.`,
    type: assumptionTypeFromDriver(cleanText(driver.driverType || 'other', 80)),
    confidence: normaliseConfidence(driver.confidence, sourceStatus === 'unknown' ? 'low' : 'medium'),
    sourceStatus,
    evidenceRefs: [],
    parameterLinks: normaliseMapsTo(driver.mapsTo),
    projectExposureRefs: cleanStringList([driver.id || label], { maxItems: 1, maxChars: 160 }),
    riskIfWrong: 'Mapped risk parameters may be directionally wrong if the driver is misclassified or unsupported.',
    challengeQuestion: sourceStatus === 'unknown'
      ? `What evidence would quantify ${label.toLowerCase()}?`
      : `Is the ${label.toLowerCase()} driver supported by evidence or only by an analyst estimate?`,
    status: normaliseAssumptionStatus('', sourceStatus)
  };
}

function normaliseWarningText(value) {
  if (isPlainObject(value)) return cleanBlock(value.message || value.label || value.id || '', 500);
  return cleanBlock(value, 500);
}

function buildDoubleCountingAssumption(warning, index = 0) {
  const text = normaliseWarningText(warning);
  if (!text) return null;
  return {
    id: `double_counting_warning_${index + 1}`,
    statement: text,
    type: 'control',
    confidence: 'medium',
    sourceStatus: 'derived',
    evidenceRefs: [],
    parameterLinks: [],
    projectExposureRefs: [],
    riskIfWrong: 'The estimate may overstate or understate the result if this modelling caveat is ignored.',
    challengeQuestion: 'Has this double-counting or cap limitation been reviewed before using the result?',
    status: 'needs_review'
  };
}

function buildRiskEngineAssumptions(parameters = {}) {
  if (!isPlainObject(parameters) || !Object.keys(parameters).length) {
    return { assumptions: [], missingEvidence: [], nextBestQuestions: [] };
  }
  let validation = null;
  try {
    validation = RiskEngine.validateRunParams(parameters);
  } catch {
    validation = null;
  }
  const warnings = [
    ...(Array.isArray(validation?.warnings) ? validation.warnings : []),
    ...(Array.isArray(validation?.errors) ? validation.errors : [])
  ];
  const assumptions = warnings.slice(0, 10).map((warning, index) => ({
    id: `risk_engine_warning_${index + 1}`,
    statement: warning,
    type: /frequency|iterations/i.test(warning) ? 'frequency' : /control|vulnerability|threat/i.test(warning) ? 'vulnerability' : 'cost',
    confidence: 'medium',
    sourceStatus: 'derived',
    evidenceRefs: [],
    parameterLinks: [],
    projectExposureRefs: [],
    riskIfWrong: 'The simulation may be unstable, invalid, or difficult to defend if this warning is not resolved.',
    challengeQuestion: 'Can the parameter owner confirm or correct this input before relying on the result?',
    status: 'needs_review'
  }));
  const missingEvidence = warnings.slice(0, 5).map((warning) => ({
    item: 'Risk engine parameter warning',
    importance: 'medium',
    whyItMatters: warning,
    whoMightKnow: 'Risk analyst or model owner',
    suggestedQuestion: 'Which parameter input should be corrected or evidenced before sign-off?'
  }));
  return { assumptions, missingEvidence, nextBestQuestions: [] };
}

function getRange(parameters = {}, prefix = '') {
  const low = finiteNumber(parameters[`${prefix}Min`]);
  const likely = finiteNumber(parameters[`${prefix}Likely`]);
  const high = finiteNumber(parameters[`${prefix}Max`]);
  if (low === null || likely === null || high === null) return null;
  return { low, likely, high };
}

function isWideRange(range) {
  if (!range) return false;
  if (range.high <= range.low) return false;
  if (range.likely <= 0) return range.high > Math.max(1, range.low) * 10;
  return range.high / Math.max(range.likely, 1e-9) >= 5 || Math.max(range.likely, 1e-9) / Math.max(range.low, 1e-9) >= 10;
}

function buildWideRangeAssumptions(parameters = {}) {
  if (!isPlainObject(parameters)) return { assumptions: [], missingEvidence: [], nextBestQuestions: [] };
  const wideRanges = RANGE_DEFINITIONS
    .map(definition => ({ definition, range: getRange(parameters, definition.prefix) }))
    .filter(item => isWideRange(item.range));
  return {
    assumptions: wideRanges.slice(0, 8).map(({ definition, range }, index) => ({
      id: `wide_range_${definition.parameter}_${index + 1}`,
      statement: `${definition.label} has a wide range (${range.low} to ${range.high}); the result is sensitive to this assumption.`,
      type: definition.type,
      confidence: 'low',
      sourceStatus: 'estimated',
      evidenceRefs: [],
      parameterLinks: [definition.parameter],
      projectExposureRefs: [],
      riskIfWrong: 'A wide range can move the p90/p95 result and tolerance decision materially.',
      challengeQuestion: `What evidence supports the severe case for ${definition.label.toLowerCase()}?`,
      status: 'weak'
    })),
    missingEvidence: wideRanges.slice(0, 5).map(({ definition }) => ({
      item: `${definition.label} range evidence`,
      importance: 'medium',
      whyItMatters: 'Wide ranges are useful for uncertainty, but need an evidence basis before decision sign-off.',
      whoMightKnow: 'Risk analyst or business owner',
      suggestedQuestion: `What evidence supports the low, expected, and severe values for ${definition.label.toLowerCase()}?`
    })),
    nextBestQuestions: wideRanges.slice(0, 2).map(({ definition }) => ({
      question: `What evidence supports the severe case for ${definition.label.toLowerCase()}?`,
      whyItMatters: 'This can materially change the tail result.',
      fieldTarget: definition.parameter,
      impactIfAnswered: 'It will make the parameter range more defensible or identify a stress case.'
    }))
  };
}

function buildEvidenceContradictionPieces(input = {}) {
  const evidenceMap = isPlainObject(input.evidenceMap) ? input.evidenceMap : {};
  const contradictions = Array.isArray(evidenceMap.contradictions) ? evidenceMap.contradictions : [];
  if (!contradictions.length) return { assumptions: [], missingEvidence: [], nextBestQuestions: [] };
  return {
    assumptions: contradictions.slice(0, 6).map((item, index) => {
      const claim = cleanBlock(item.claim || 'Evidence contradiction', 500);
      const conflict = cleanBlock(item.conflictingEvidence || '', 500);
      return {
        id: `evidence_contradiction_${index + 1}`,
        statement: conflict ? `${claim} conflicts with evidence: ${conflict}` : claim,
        type: /recover|rto|duration/i.test(`${claim} ${conflict}`) ? 'duration' : 'evidence',
        confidence: 'low',
        sourceStatus: 'unknown',
        evidenceRefs: cleanStringList(item.evidenceRefs, { maxItems: 5, maxChars: 180 }),
        parameterLinks: [],
        projectExposureRefs: [],
        riskIfWrong: 'A contradicted assumption can move the scenario framing, recovery duration, or loss estimate in the wrong direction.',
        challengeQuestion: cleanBlock(item.recommendedAction || 'Which source is authoritative for this assumption?', 400),
        status: 'needs_review'
      };
    }),
    missingEvidence: contradictions.slice(0, 4).map((item) => ({
      item: 'Contradicted evidence',
      importance: 'high',
      whyItMatters: cleanBlock(item.conflictingEvidence || 'A claim conflicts with available evidence.', 500),
      whoMightKnow: 'Assessment owner, control owner, or evidence owner',
      suggestedQuestion: cleanBlock(item.recommendedAction || 'Which source is authoritative for this assumption?', 400)
    })),
    nextBestQuestions: contradictions.slice(0, 2).map((item) => ({
      question: cleanBlock(item.recommendedAction || 'Which source is authoritative for this assumption?', 400),
      whyItMatters: 'Resolving the contradiction can change the decision-support narrative or parameter basis.',
      fieldTarget: 'evidenceContradiction',
      impactIfAnswered: 'It can convert a weak assumption into a supported assumption or update the scenario.'
    }))
  };
}

function hasEvidence(input = {}) {
  const evidenceMap = isPlainObject(input.evidenceMap) ? input.evidenceMap : {};
  return Boolean(
    (Array.isArray(input.citations) && input.citations.length)
    || (Array.isArray(evidenceMap.supportedClaims) && evidenceMap.supportedClaims.length)
    || (Array.isArray(evidenceMap.parameterEvidenceMap) && evidenceMap.parameterEvidenceMap.length)
  );
}

function buildGenericFallbackPieces(input = {}) {
  const scenario = cleanBlock(input.scenario || input.structuredScenario?.summary || '', 900);
  const assumptions = [];
  const missingEvidence = [];
  const nextBestQuestions = [];
  if (scenario) {
    assumptions.push({
      id: 'scenario_scope_assumption',
      statement: `The assessment scenario is based on the submitted scenario: ${scenario}`,
      type: 'evidence',
      confidence: hasEvidence(input) ? 'medium' : 'low',
      sourceStatus: hasEvidence(input) ? 'evidence_supported' : 'unknown',
      evidenceRefs: cleanStringList(input.citations, { maxItems: 5, maxChars: 160 }),
      parameterLinks: [],
      projectExposureRefs: [],
      riskIfWrong: 'If the scenario scope is wrong, frequency, vulnerability, and loss assumptions may be aimed at the wrong event.',
      challengeQuestion: 'What source confirms the event path, affected asset, and business impact?',
      status: hasEvidence(input) ? 'supported' : 'open'
    });
  }
  if (!hasEvidence(input)) {
    missingEvidence.push({
      item: 'Scenario evidence',
      importance: 'high',
      whyItMatters: 'The assumption register cannot distinguish asserted facts from analyst judgement without at least one supporting source.',
      whoMightKnow: 'Assessment owner or control owner',
      suggestedQuestion: 'What document, incident record, risk register entry, or owner statement supports the scenario?'
    });
    nextBestQuestions.push({
      question: 'What evidence supports the scenario and the main business impact?',
      whyItMatters: 'It separates supported claims from assumptions before review.',
      fieldTarget: 'scenarioEvidence',
      impactIfAnswered: 'It can upgrade open assumptions to supported assumptions or reveal contradictions.'
    });
  }
  const riskEngine = buildRiskEngineAssumptions(input.parameters);
  const wideRanges = buildWideRangeAssumptions(input.parameters);
  const contradictions = buildEvidenceContradictionPieces(input);
  return {
    assumptions: [...assumptions, ...riskEngine.assumptions, ...wideRanges.assumptions, ...contradictions.assumptions],
    missingEvidence: [...missingEvidence, ...riskEngine.missingEvidence, ...wideRanges.missingEvidence, ...contradictions.missingEvidence],
    nextBestQuestions: [...nextBestQuestions, ...contradictions.nextBestQuestions, ...riskEngine.nextBestQuestions, ...wideRanges.nextBestQuestions]
  };
}

function buildProjectFallbackPieces(input = {}, projectExposure = {}) {
  const missingInputs = collectProjectMissingInputs(projectExposure);
  const assumptions = [];
  const missingEvidence = [];
  const nextBestQuestions = [];
  missingInputs.forEach((item, index) => {
    assumptions.push(buildMissingProjectAssumption(item, index));
    missingEvidence.push(buildMissingEvidenceFromProjectInput(item));
  });
  (Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers : [])
    .slice(0, 12)
    .map(buildDriverAssumption)
    .filter(Boolean)
    .forEach(item => assumptions.push(item));
  (Array.isArray(projectExposure.doubleCountingWarnings) ? projectExposure.doubleCountingWarnings : [])
    .slice(0, 8)
    .map(buildDoubleCountingAssumption)
    .filter(Boolean)
    .forEach(item => assumptions.push(item));
  const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
  if (quality.recommendedNextInput) {
    nextBestQuestions.push(buildNextQuestionFromProjectInput(quality.recommendedNextInput));
  }
  missingInputs
    .filter(item => item.importance === 'high')
    .slice(0, 3)
    .forEach(item => nextBestQuestions.push(buildNextQuestionFromProjectInput(item)));

  const roleLabel = input.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER ? 'seller' : 'buyer';
  if (!hasEvidence(input)) {
    missingEvidence.push({
      item: `${roleLabel === 'buyer' ? 'Buyer' : 'Seller'} project economics evidence`,
      importance: 'high',
      whyItMatters: 'Sparse project economics can proceed, but decision confidence depends on whether key values are known, estimated, proxied, or not applicable.',
      whoMightKnow: roleLabel === 'buyer' ? 'Project sponsor, procurement, finance, or legal' : 'Deal owner, delivery lead, finance, or legal',
      suggestedQuestion: roleLabel === 'buyer'
        ? 'Which business case, contract, purchase order, or project plan supports the spend, delay, recovery, and milestone assumptions?'
        : 'Which contract, statement of work, margin model, or delivery forecast supports revenue, margin, penalty, and recovery assumptions?'
    });
  }

  return {
    assumptions,
    missingEvidence,
    nextBestQuestions
  };
}

function determineOverallConfidence(register = {}, input = {}) {
  const assumptions = Array.isArray(register.assumptions) ? register.assumptions : [];
  const missingEvidence = Array.isArray(register.missingEvidence) ? register.missingEvidence : [];
  const unknownCount = assumptions.filter(item => item.sourceStatus === 'unknown').length;
  const proxyCount = assumptions.filter(item => item.sourceStatus === 'benchmark_proxy').length;
  if (unknownCount >= 3 || missingEvidence.some(item => item.importance === 'high')) return 'low';
  if (proxyCount || unknownCount || !hasEvidence(input)) return 'medium';
  return assumptions.length ? 'high' : 'unknown';
}

function buildDeterministicAssumptionRegister(input = {}) {
  const deterministicExposure = deterministicProjectExposure(input);
  const projectExposure = mergeProjectExposure(input.projectExposure, deterministicExposure);
  const genericPieces = buildGenericFallbackPieces(input);
  const projectPieces = [ASSESSMENT_TYPE_PROJECT_BUYER, ASSESSMENT_TYPE_PROJECT_SELLER].includes(input.assessmentType)
    ? buildProjectFallbackPieces(input, projectExposure)
    : { assumptions: [], missingEvidence: [], nextBestQuestions: [] };
  const register = {
    assumptions: [
      ...genericPieces.assumptions,
      ...projectPieces.assumptions
    ],
    missingEvidence: [
      ...genericPieces.missingEvidence,
      ...projectPieces.missingEvidence
    ],
    overallConfidence: 'unknown',
    nextBestQuestions: [
      ...projectPieces.nextBestQuestions,
      ...genericPieces.nextBestQuestions
    ]
  };
  const normalised = normaliseAssumptionRegisterForApi(register);
  normalised.overallConfidence = determineOverallConfidence(normalised, input);
  normalised.nextBestQuestions = normalised.nextBestQuestions.slice(0, 3);
  return normalised;
}

function classifyAssumptionRegisterFallbackReason(error = null) {
  const message = String(error?.message || error || '');
  if (/Hosted AI proxy is not configured|AI_PROXY_UNAVAILABLE|COMPASS_API_KEY/i.test(message)) {
    return {
      code: 'hosted_ai_unavailable',
      title: 'Hosted AI unavailable',
      message: 'Hosted AI is not configured, so a deterministic assumption register was used.',
      detail: message
    };
  }
  if (/structured response|JSON|schema|unusable|Unexpected token|malformed/i.test(message)) {
    return {
      code: 'invalid_ai_output',
      title: 'AI output was not usable',
      message: 'The AI response could not be safely converted into the assumption register schema, so deterministic fallback was used.',
      detail: message
    };
  }
  if (/timed out|timeout/i.test(message)) {
    return {
      code: 'assumption_register_timeout',
      title: 'AI assumption register timed out',
      message: 'AI assumption register generation timed out, so deterministic fallback was used.',
      detail: message
    };
  }
  return {
    code: 'assumption_register_ai_failed',
    title: 'AI assumption register failed',
    message: 'AI assumption register generation failed, so deterministic fallback was used.',
    detail: message
  };
}

function buildDeterministicAssumptionRegisterResult(options = {}) {
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
  const assumptionRegister = buildDeterministicAssumptionRegister(input);
  const reason = fallbackReason || {
    code: aiUnavailable ? 'hosted_ai_unavailable' : 'deterministic_assumption_register',
    title: 'Deterministic assumption register',
    message: aiUnavailable
      ? 'Hosted AI was unavailable, so the deterministic assumption register was used.'
      : 'The deterministic assumption register was used.',
    detail: normalisedError ? String(normalisedError.message || normalisedError) : ''
  };
  return {
    mode: 'deterministic_fallback',
    assumptionRegister,
    trace: buildTraceEntry({
      label: input.traceLabel || 'Assumption register',
      promptSummary,
      response: response || JSON.stringify(assumptionRegister, null, 2),
      sources: input.citations || []
    }),
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    fallbackReasonCode: reason.code || 'deterministic_assumption_register',
    fallbackReasonTitle: reason.title || 'Deterministic assumption register',
    fallbackReasonMessage: reason.message || '',
    fallbackReasonDetail: reason.detail || '',
    generatedAt: new Date().toISOString()
  };
}

function buildSystemPrompt() {
  return `You build assumption registers for enterprise risk decisions.

Return JSON only. Do not include markdown.

Rules:
- Do not invent evidence.
- Blank/null project economics mean unknown, not zero.
- Every unknown high-impact project value must become an explicit assumption, missing-evidence item, or next-best question.
- Do not ask for every blank field; rank nextBestQuestions by likely decision impact.
- Generic path: capture scenario, frequency, vulnerability, control, evidence, parameter, and result assumptions.
- Buyer project path: cover delay, spend at risk, reprocurement, sunk cost, recoveries, and unknown delay cost.
- Seller project path: cover revenue, margin, cost to cure, LD/SLA, termination, recoveries, and unknown margin or penalty caps.
- Map assumptions to risk-engine parameters where possible.
- Preserve deterministic fallback assumptions unless you can make them clearer.
- Return only JSON matching this schema:
${ASSUMPTION_REGISTER_SCHEMA}`;
}

function buildUserPrompt(input = {}, deterministicRegister = {}) {
  const compactInput = {
    assessmentType: input.assessmentType,
    scenario: input.scenario,
    structuredScenario: input.structuredScenario,
    scenarioLens: input.scenarioLens,
    projectContext: input.projectContext,
    buyerEconomics: input.buyerEconomics,
    buyerEconomicsMeta: input.buyerEconomicsMeta,
    sellerEconomics: input.sellerEconomics,
    sellerEconomicsMeta: input.sellerEconomicsMeta,
    projectExposure: input.projectExposure,
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    citations: input.citations,
    evidenceMap: input.evidenceMap,
    parameters: input.parameters,
    results: input.results,
    adminSettings: input.adminSettings
  };
  return `Build an assumption register for this assessment.

Use the deterministic baseline below as a guardrail. You may improve wording, prioritisation, and mapping, but do not remove unknown high-impact project assumptions unless the input explicitly marks the value as known, not applicable, or evidence-supported.

Deterministic baseline:
${JSON.stringify(deterministicRegister, null, 2)}

Input:
${JSON.stringify(compactInput, null, 2)}

Return only the assumption register JSON object.`;
}

async function buildAssumptionRegisterWorkflow(input = {}) {
  const normalisedInput = normaliseAssumptionRegisterWorkflowInput(input);
  const deterministic = buildDeterministicAssumptionRegister(normalisedInput);
  const timeouts = buildWorkflowTimeoutProfile({
    liveMs: Number(process.env.ASSUMPTION_REGISTER_AI_TIMEOUT_MS || 22000),
    repairMs: Number(process.env.ASSUMPTION_REGISTER_AI_REPAIR_TIMEOUT_MS || 8000)
  });
  try {
    const generation = await callAi(buildSystemPrompt(), buildUserPrompt(normalisedInput, deterministic), {
      taskName: 'assumptionRegister',
      temperature: 0.1,
      maxCompletionTokens: 2600,
      maxPromptChars: MAX_PROMPT_CHARS,
      timeoutMs: timeouts.liveMs,
      priorMessages: normalisedInput.priorMessages
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, ASSUMPTION_REGISTER_SCHEMA, {
      taskName: 'assumptionRegisterRepair',
      timeoutMs: timeouts.repairMs,
      maxCompletionTokens: 2600,
      maxPromptChars: 14000
    });
    const assumptionRegister = normaliseAssumptionRegisterForApi(parsed.parsed, deterministic);
    const traces = [
      buildTraceEntry({
        label: normalisedInput.traceLabel || 'Assumption register',
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: normalisedInput.citations || []
      }),
      parsed.trace || null
    ].filter(Boolean);
    return {
      mode: 'live',
      assumptionRegister,
      trace: traces[0] || null,
      traces,
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyAssumptionRegisterFallbackReason,
      buildFallbackResult: buildDeterministicAssumptionRegisterResult,
      fallbackOptions: {
        input: normalisedInput,
        promptSummary: buildUserPrompt(normalisedInput, deterministic),
        response: String(error?.message || error || '')
      }
    });
  }
}

module.exports = {
  ASSUMPTION_REGISTER_SCHEMA,
  buildAssumptionRegisterWorkflow,
  buildDeterministicAssumptionRegister,
  buildDeterministicAssumptionRegisterResult,
  classifyAssumptionRegisterFallbackReason,
  normaliseAssumptionRegisterForApi,
  normaliseAssumptionRegisterWorkflowInput
};
