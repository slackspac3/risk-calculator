'use strict';

const { buildTraceEntry, callAi, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
const { buildFallbackFromError, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const AssessmentTypeModel = require('../assets/state/assessmentTypeModel.js');
const DecisionSupportModel = require('../assets/state/decisionSupportModel.js');

const MAX_PROMPT_CHARS = 28000;
const EVIDENCE_MAP_SCHEMA = `{
  "supportedClaims": [
    {
      "claim": "string",
      "supportLevel": "strong|partial|weak",
      "evidenceRefs": ["string"],
      "whyItMatters": "string"
    }
  ],
  "unsupportedClaims": [
    {
      "claim": "string",
      "missingEvidence": "string",
      "impact": "string",
      "whoMightKnow": "string"
    }
  ],
  "contradictions": [
    {
      "claim": "string",
      "conflictingEvidence": "string",
      "evidenceRefs": ["string"],
      "recommendedAction": "string"
    }
  ],
  "parameterEvidenceMap": [
    {
      "parameterKey": "string",
      "evidenceRefs": ["string"],
      "projectExposureRefs": ["string"],
      "supportLevel": "strong|partial|weak|none",
      "commentary": "string"
    }
  ],
  "projectFinancialEvidenceMap": [
    {
      "field": "string",
      "status": "found|not_found|contradicted|unclear",
      "value": "string",
      "evidenceRefs": ["string"],
      "commentary": "string"
    }
  ],
  "citationQuality": {
    "strong": ["string"],
    "weak": ["string"],
    "decorative": ["string"]
  }
}`;

const SUPPORT_LEVELS = new Set(['strong', 'partial', 'weak', 'none']);
const PROJECT_FINANCIAL_STATUSES = new Set(['found', 'not_found', 'contradicted', 'unclear']);
const PARAMETER_KEYS = new Set([
  'incidentResponse',
  'businessInterruption',
  'dataRemediation',
  'regulatoryLegal',
  'thirdParty',
  'reputationContract',
  'secondaryLoss'
]);

const BUYER_FINANCIAL_FIELDS = Object.freeze([
  { field: 'delayCostPerDay', label: 'Delay cost', keywords: ['delay cost', 'cost of delay', 'daily delay', 'per day delay', 'delay damages'], who: 'Project finance or project controls' },
  { field: 'approvedBudget', label: 'Approved project budget', keywords: ['approved budget', 'project budget', 'budget'], who: 'Project sponsor or finance business partner' },
  { field: 'expectedSpend', label: 'Expected spend', keywords: ['expected spend', 'project spend', 'total spend', 'contract spend'], who: 'Project sponsor or procurement' },
  { field: 'remainingSpend', label: 'Remaining spend', keywords: ['remaining spend', 'remaining budget', 'unspent', 'balance to spend'], who: 'Project finance or procurement' },
  { field: 'amountPaid', label: 'Amount paid', keywords: ['amount paid', 'paid to date', 'already paid', 'payment made'], who: 'Accounts payable or project finance' },
  { field: 'amountCommitted', label: 'Amount committed', keywords: ['amount committed', 'committed spend', 'purchase order', 'po value'], who: 'Procurement or contract owner' },
  { field: 'reprocurementPremiumPct', label: 'Reprocurement premium', keywords: ['reprocurement premium', 'replacement premium', 'switching premium', 'replacement supplier'], who: 'Procurement or commercial lead' },
  { field: 'supplierCredits', label: 'Supplier credits', keywords: ['supplier credit', 'service credit', 'credit note', 'vendor credit'], who: 'Commercial manager or supplier owner' },
  { field: 'insuranceRecoveries', label: 'Insurance recoveries', keywords: ['insurance recovery', 'insurance recoveries', 'insurer', 'policy recovery'], who: 'Insurance or risk finance' },
  { field: 'liquidatedDamagesRecoverable', label: 'Liquidated damages recoverable', keywords: ['liquidated damages recoverable', 'liquidated damages', 'ld recoverable'], who: 'Legal or contract manager' },
  { field: 'contractualRecoveryCap', label: 'Contractual recovery cap', keywords: ['recovery cap', 'liability cap', 'cap on recovery', 'contractual cap'], who: 'Legal or contract manager' },
  { field: 'criticalMilestoneDate', label: 'Critical milestone date', keywords: ['go-live', 'milestone date', 'critical milestone', 'completion date'], who: 'Project manager or delivery lead' },
  { field: 'expectedBenefitPerDay', label: 'Expected benefit', keywords: ['benefit case', 'expected benefit', 'business case benefit', 'benefit per day'], who: 'Business sponsor or benefits owner' },
  { field: 'paymentTerms', label: 'Payment terms', keywords: ['payment terms', 'milestone payment', 'payment schedule'], who: 'Contract owner or procurement' },
  { field: 'reprocurementRights', label: 'Reprocurement rights', keywords: ['step-in right', 'termination for convenience', 'replacement supplier', 'reprocure'], who: 'Legal or procurement' }
]);

const SELLER_FINANCIAL_FIELDS = Object.freeze([
  { field: 'contractValue', label: 'Contract value', keywords: ['contract value', 'total contract value', 'tcv', 'deal value'], who: 'Commercial or sales operations' },
  { field: 'expectedRevenue', label: 'Expected revenue', keywords: ['expected revenue', 'revenue', 'recognized revenue', 'recognised revenue'], who: 'Sales finance or deal owner' },
  { field: 'grossMarginPct', label: 'Gross margin', keywords: ['gross margin', 'margin percentage', 'margin %', 'expected margin'], who: 'Finance business partner' },
  { field: 'contributionMargin', label: 'Contribution margin', keywords: ['contribution margin', 'margin contribution'], who: 'Finance business partner' },
  { field: 'liquidatedDamagesCap', label: 'Liquidated damages cap', keywords: ['liquidated damages cap', 'ld cap', 'liquidated damages'], who: 'Legal or commercial manager' },
  { field: 'slaCreditsCap', label: 'SLA credits cap', keywords: ['sla credit', 'service level credit', 'service credits cap', 'credit cap'], who: 'Service owner or commercial manager' },
  { field: 'liabilityCap', label: 'Liability cap', keywords: ['liability cap', 'cap on liability', 'aggregate liability'], who: 'Legal or commercial manager' },
  { field: 'terminationExposure', label: 'Termination exposure', keywords: ['termination', 'terminate', 'termination fee', 'termination exposure'], who: 'Legal, commercial, or account owner' },
  { field: 'costToCure', label: 'Cost to cure', keywords: ['cost to cure', 'remediation cost', 'cure cost', 'corrective work'], who: 'Delivery lead or project controls' },
  { field: 'warrantyExposure', label: 'Warranty exposure', keywords: ['warranty', 'warranty exposure', 'defect liability'], who: 'Service owner or legal' },
  { field: 'renewalValueAtRisk', label: 'Renewal or future work', keywords: ['renewal', 'future work', 'pipeline', 'extension value'], who: 'Account owner or sales leadership' },
  { field: 'revenueRecognitionAtRisk', label: 'Revenue recognition milestones', keywords: ['revenue recognition', 'recognition milestone', 'milestone acceptance'], who: 'Revenue accounting or finance' }
]);

const FIELD_TO_PARAMETER = Object.freeze({
  delayCostPerDay: 'businessInterruption',
  expectedBenefitPerDay: 'secondaryLoss',
  approvedBudget: 'thirdParty',
  expectedSpend: 'thirdParty',
  remainingSpend: 'thirdParty',
  amountPaid: 'thirdParty',
  amountCommitted: 'thirdParty',
  reprocurementPremiumPct: 'thirdParty',
  supplierCredits: 'thirdParty',
  insuranceRecoveries: 'thirdParty',
  liquidatedDamagesRecoverable: 'regulatoryLegal',
  contractualRecoveryCap: 'regulatoryLegal',
  contractValue: 'reputationContract',
  expectedRevenue: 'reputationContract',
  grossMarginPct: 'reputationContract',
  contributionMargin: 'reputationContract',
  liquidatedDamagesCap: 'regulatoryLegal',
  slaCreditsCap: 'reputationContract',
  liabilityCap: 'regulatoryLegal',
  terminationExposure: 'reputationContract',
  costToCure: 'businessInterruption',
  warrantyExposure: 'businessInterruption',
  renewalValueAtRisk: 'secondaryLoss',
  revenueRecognitionAtRisk: 'businessInterruption'
});

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'from', 'with', 'that', 'this', 'into', 'onto', 'will', 'would',
  'could', 'should', 'risk', 'project', 'scenario', 'issue', 'impact', 'value', 'cost',
  'loss', 'case', 'when', 'where', 'have', 'has', 'been', 'being', 'their', 'there'
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

function cleanStringList(items = [], { maxItems = 12, maxChars = 200 } = {}) {
  const raw = Array.isArray(items) ? items : items === null || items === undefined ? [] : [items];
  const seen = new Set();
  const output = [];
  raw.forEach((item) => {
    const text = isPlainObject(item)
      ? cleanText(item.id || item.label || item.field || item.title || item.claim || item.parameterKey || item.sourceTitle || '', maxChars)
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

function cleanCitation(item = {}, index = 0, sourceKind = 'citation') {
  if (!isPlainObject(item)) return null;
  const title = cleanText(item.title || item.sourceTitle || item.name || item.docTitle || item.documentTitle || item.note || `${sourceKind} ${index + 1}`, 180);
  const id = cleanText(item.id || item.docId || item.sourceId || item.chunkId || title || `${sourceKind}-${index + 1}`, 180);
  const excerpt = cleanBlock(item.excerpt || item.text || item.content || item.chunkText || item.description || item.note || '', 2000);
  const contentFull = cleanBlock(item.contentFull || item.fullText || '', 3000);
  const relevanceReason = cleanBlock(item.relevanceReason || item.reason || '', 500);
  const url = cleanText(item.url || item.sourceUrl || item.link || '', 400);
  const sourceType = cleanText(item.sourceType || item.type || sourceKind, 80);
  const text = [excerpt, contentFull].filter(Boolean).join('\n');
  return compactObject({
    id,
    title: title || id,
    evidenceRef: title || id,
    text,
    relevanceReason,
    url,
    sourceType,
    sourceKind
  });
}

function normaliseEvidenceEntries(citations = [], ragMatches = []) {
  const entries = [
    ...(Array.isArray(citations) ? citations : []).map((item, index) => cleanCitation(item, index, 'citation')),
    ...(Array.isArray(ragMatches) ? ragMatches : []).map((item, index) => cleanCitation(item, index, 'rag_match'))
  ].filter(Boolean);
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.id || ''}:${entry.title || ''}:${entry.text || ''}`.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

function tokenise(value = '') {
  return cleanText(value, 4000)
    .toLowerCase()
    .replace(/[^a-z0-9%.$-]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token))
    .slice(0, 80);
}

function overlapCount(left = '', right = '') {
  const leftTokens = new Set(tokenise(left));
  if (!leftTokens.size) return 0;
  return tokenise(right).filter(token => leftTokens.has(token)).length;
}

function evidenceText(entry = {}) {
  return [entry.title, entry.text, entry.relevanceReason].filter(Boolean).join(' ');
}

function evidenceRef(entry = {}) {
  return cleanText(entry.title || entry.id || 'Evidence', 180);
}

function findEvidenceForText(entries = [], text = '') {
  const target = cleanText(text, 1600);
  if (!target) return [];
  return entries
    .map(entry => ({
      entry,
      overlap: overlapCount(target, evidenceText(entry)),
      hasBody: cleanText(entry.text || '', 20).length > 0
    }))
    .filter(item => item.hasBody && item.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, 4)
    .map(item => item.entry);
}

function classifyCitationQuality(entries = [], contextText = '') {
  const strong = [];
  const weak = [];
  const decorative = [];
  entries.forEach((entry) => {
    const ref = evidenceRef(entry);
    const text = cleanText(entry.text || '', 1200);
    if (!text) {
      decorative.push(ref);
      return;
    }
    const overlap = overlapCount(contextText, evidenceText(entry));
    if (overlap >= 3 || text.length > 240 && overlap >= 2) strong.push(ref);
    else if (overlap > 0 || text.length > 120) weak.push(ref);
    else decorative.push(ref);
  });
  return {
    strong: strong.slice(0, 10),
    weak: weak.slice(0, 10),
    decorative: decorative.slice(0, 10)
  };
}

function normaliseSupportLevel(value, fallback = 'weak') {
  const next = cleanText(value, 80).toLowerCase();
  return SUPPORT_LEVELS.has(next) ? next : fallback;
}

function normaliseProjectFinancialStatus(value, fallback = 'not_found') {
  const next = cleanText(value, 80).toLowerCase();
  return PROJECT_FINANCIAL_STATUSES.has(next) ? next : fallback;
}

function normaliseParameterKey(value = '') {
  const key = cleanText(value, 120);
  return PARAMETER_KEYS.has(key) ? key : '';
}

function normaliseSupportedClaim(item = {}) {
  if (!isPlainObject(item)) return null;
  const claim = cleanBlock(item.claim || item.statement || item.text || '', 800);
  if (!claim) return null;
  return {
    claim,
    supportLevel: normaliseSupportLevel(item.supportLevel, 'weak') === 'none' ? 'weak' : normaliseSupportLevel(item.supportLevel, 'weak'),
    evidenceRefs: cleanStringList(item.evidenceRefs || item.citations || item.references, { maxItems: 8, maxChars: 180 }),
    whyItMatters: cleanBlock(item.whyItMatters || item.impact || '', 500)
  };
}

function normaliseUnsupportedClaim(item = {}) {
  if (!isPlainObject(item)) return null;
  const claim = cleanBlock(item.claim || item.statement || item.text || '', 800);
  if (!claim) return null;
  return {
    claim,
    missingEvidence: cleanBlock(item.missingEvidence || item.evidenceNeeded || '', 500),
    impact: cleanBlock(item.impact || item.whyItMatters || '', 500),
    whoMightKnow: cleanText(item.whoMightKnow || item.owner || 'Assessment owner', 180)
  };
}

function normaliseContradiction(item = {}) {
  if (!isPlainObject(item)) return null;
  const claim = cleanBlock(item.claim || item.statement || '', 800);
  const conflictingEvidence = cleanBlock(item.conflictingEvidence || item.conflict || '', 800);
  if (!claim && !conflictingEvidence) return null;
  return {
    claim,
    conflictingEvidence,
    evidenceRefs: cleanStringList(item.evidenceRefs || item.citations || item.references, { maxItems: 8, maxChars: 180 }),
    recommendedAction: cleanBlock(item.recommendedAction || item.action || 'Resolve the conflict before relying on this claim.', 500)
  };
}

function normaliseParameterEvidence(item = {}) {
  if (!isPlainObject(item)) return null;
  const parameterKey = normaliseParameterKey(item.parameterKey || item.mapsTo);
  if (!parameterKey) return null;
  return {
    parameterKey,
    evidenceRefs: cleanStringList(item.evidenceRefs || item.citations || item.references, { maxItems: 8, maxChars: 180 }),
    projectExposureRefs: cleanStringList(item.projectExposureRefs || item.projectExposureRef || item.driverIds, { maxItems: 8, maxChars: 180 }),
    supportLevel: normaliseSupportLevel(item.supportLevel, 'none'),
    commentary: cleanBlock(item.commentary || item.rationale || '', 700)
  };
}

function normaliseProjectFinancialEvidence(item = {}) {
  if (!isPlainObject(item)) return null;
  const field = cleanText(item.field || item.label || '', 160);
  if (!field) return null;
  return {
    field,
    status: normaliseProjectFinancialStatus(item.status, 'not_found'),
    value: cleanText(item.value || '', 240),
    evidenceRefs: cleanStringList(item.evidenceRefs || item.citations || item.references, { maxItems: 8, maxChars: 180 }),
    commentary: cleanBlock(item.commentary || item.rationale || '', 700)
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

function normaliseEvidenceMapForApi(evidenceMap = {}, fallback = {}) {
  const source = isPlainObject(evidenceMap) ? evidenceMap : {};
  const fallbackSource = isPlainObject(fallback) ? fallback : {};
  const model = DecisionSupportModel.buildEvidenceMap(source);
  const fallbackModel = DecisionSupportModel.buildEvidenceMap(fallbackSource);
  const supportedClaims = dedupeBy([
    ...(Array.isArray(source.supportedClaims) ? source.supportedClaims : model.supportedClaims),
    ...(Array.isArray(fallbackSource.supportedClaims) ? fallbackSource.supportedClaims : fallbackModel.supportedClaims)
  ].map(normaliseSupportedClaim).filter(Boolean), item => item.claim, 20);
  const unsupportedClaims = dedupeBy([
    ...(Array.isArray(source.unsupportedClaims) ? source.unsupportedClaims : model.unsupportedClaims),
    ...(Array.isArray(fallbackSource.unsupportedClaims) ? fallbackSource.unsupportedClaims : fallbackModel.unsupportedClaims)
  ].map(normaliseUnsupportedClaim).filter(Boolean), item => item.claim, 20);
  const contradictions = dedupeBy([
    ...(Array.isArray(source.contradictions) ? source.contradictions : model.contradictions),
    ...(Array.isArray(fallbackSource.contradictions) ? fallbackSource.contradictions : fallbackModel.contradictions)
  ].map(normaliseContradiction).filter(Boolean), item => `${item.claim}:${item.conflictingEvidence}`, 12);
  const parameterEvidenceMap = dedupeBy([
    ...(Array.isArray(source.parameterEvidenceMap) ? source.parameterEvidenceMap : model.parameterEvidenceMap),
    ...(Array.isArray(fallbackSource.parameterEvidenceMap) ? fallbackSource.parameterEvidenceMap : fallbackModel.parameterEvidenceMap)
  ].map(normaliseParameterEvidence).filter(Boolean), item => `${item.parameterKey}:${item.projectExposureRefs.join(',')}`, 20);
  const projectFinancialEvidenceMap = dedupeBy([
    ...(Array.isArray(source.projectFinancialEvidenceMap) ? source.projectFinancialEvidenceMap : model.projectFinancialEvidenceMap),
    ...(Array.isArray(fallbackSource.projectFinancialEvidenceMap) ? fallbackSource.projectFinancialEvidenceMap : fallbackModel.projectFinancialEvidenceMap)
  ].map(normaliseProjectFinancialEvidence).filter(Boolean), item => item.field, 30);
  const citationQuality = {
    strong: dedupeBy([
      ...cleanStringList(source.citationQuality?.strong, { maxItems: 20, maxChars: 180 }),
      ...cleanStringList(fallbackSource.citationQuality?.strong, { maxItems: 20, maxChars: 180 })
    ], item => item, 20),
    weak: dedupeBy([
      ...cleanStringList(source.citationQuality?.weak, { maxItems: 20, maxChars: 180 }),
      ...cleanStringList(fallbackSource.citationQuality?.weak, { maxItems: 20, maxChars: 180 })
    ], item => item, 20),
    decorative: dedupeBy([
      ...cleanStringList(source.citationQuality?.decorative, { maxItems: 20, maxChars: 180 }),
      ...cleanStringList(fallbackSource.citationQuality?.decorative, { maxItems: 20, maxChars: 180 })
    ], item => item, 20)
  };
  return {
    supportedClaims,
    unsupportedClaims,
    contradictions,
    parameterEvidenceMap,
    projectFinancialEvidenceMap,
    citationQuality
  };
}

function normaliseEvidenceMapWorkflowInput(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const assessmentType = AssessmentTypeModel.normaliseAssessmentType(source.assessmentType);
  return compactObject({
    assessmentType,
    scenario: cleanBlock(source.scenario || source.riskStatement || source.narrative || '', 5000),
    riskStatement: cleanBlock(source.riskStatement || source.scenario || '', 5000),
    structuredScenario: normaliseLooseObject(source.structuredScenario),
    projectContext: AssessmentTypeModel.normaliseProjectContext(isPlainObject(source.projectContext) ? source.projectContext : {}, assessmentType),
    projectExposure: AssessmentTypeModel.normaliseProjectExposure(isPlainObject(source.projectExposure) ? source.projectExposure : {}),
    assumptions: Array.isArray(source.assumptions) ? source.assumptions.slice(0, 30).map(normaliseLooseValue).filter(Boolean) : [],
    parameters: normaliseLooseObject(source.parameters),
    citations: (Array.isArray(source.citations) ? source.citations : []).map((item, index) => cleanCitation(item, index, 'citation')).filter(Boolean).slice(0, 30),
    ragMatches: (Array.isArray(source.ragMatches) ? source.ragMatches : []).map((item, index) => cleanCitation(item, index, 'rag_match')).filter(Boolean).slice(0, 30),
    businessContext: normaliseLooseObject(source.businessContext || source.businessUnit),
    adminSettings: normaliseLooseObject(source.adminSettings),
    traceLabel: cleanText(source.traceLabel || '', 160) || 'Evidence map'
  });
}

function buildClaimCandidates(input = {}) {
  const claims = [];
  const add = (claim, whyItMatters = '') => {
    const text = cleanBlock(claim, 800);
    if (!text) return;
    claims.push({
      claim: text,
      whyItMatters: cleanBlock(whyItMatters, 500)
    });
  };
  add(input.scenario || input.riskStatement, 'This is the main scenario statement being assessed.');
  const structured = isPlainObject(input.structuredScenario) ? input.structuredScenario : {};
  ['assetService', 'primaryDriver', 'eventPath', 'effect'].forEach((field) => {
    if (structured[field]) add(`${field}: ${structured[field]}`, 'Structured scenario fields shape downstream quantification.');
  });
  const projectContext = isPlainObject(input.projectContext) ? input.projectContext : {};
  if (projectContext.projectName) add(`Project: ${projectContext.projectName}`, 'Project identity anchors project-specific evidence.');
  if (projectContext.projectStage) add(`Project stage: ${projectContext.projectStage}`, 'Project stage affects exposure and mitigation choices.');
  if (projectContext.contractType) add(`Contract type: ${projectContext.contractType}`, 'Contract type affects caps, recoveries, and delivery exposure.');
  const projectExposure = isPlainObject(input.projectExposure) ? input.projectExposure : {};
  if (projectExposure.projectExposureSummary) add(projectExposure.projectExposureSummary, 'Project exposure summary should be evidence-grounded.');
  (Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers : [])
    .filter(isPlainObject)
    .slice(0, 12)
    .forEach(driver => add(driver.label || driver.rationale || driver.id, 'Financial drivers influence FAIR parameter ranges and project exposure.'));
  (Array.isArray(input.assumptions) ? input.assumptions : [])
    .slice(0, 10)
    .forEach(assumption => {
      if (isPlainObject(assumption)) add(assumption.statement || assumption.text || assumption.label, 'Explicit assumptions need evidence support or challenge.');
      else add(assumption, 'Explicit assumptions need evidence support or challenge.');
    });
  return dedupeBy(claims, item => item.claim, 18);
}

function classifyClaimSupport(claim, entries = []) {
  const supporting = findEvidenceForText(entries, claim.claim);
  if (!supporting.length) return null;
  const strongestOverlap = Math.max(...supporting.map(entry => overlapCount(claim.claim, evidenceText(entry))));
  const supportLevel = strongestOverlap >= 4 ? 'strong' : strongestOverlap >= 2 ? 'partial' : 'weak';
  return {
    claim: claim.claim,
    supportLevel,
    evidenceRefs: supporting.map(evidenceRef),
    whyItMatters: claim.whyItMatters || 'This claim affects the assessment framing.'
  };
}

function buildUnsupportedClaim(claim, assessmentType = '') {
  return {
    claim: claim.claim,
    missingEvidence: 'No citation or RAG match text directly supports this claim.',
    impact: assessmentType === 'enterprise_generic'
      ? 'Confidence in the enterprise risk framing remains limited until direct evidence is linked.'
      : 'Project-linked exposure remains directional until project evidence confirms this claim.',
    whoMightKnow: 'Assessment owner'
  };
}

function extractValueNearKeyword(text = '', keywords = []) {
  const source = cleanBlock(text, 4000);
  if (!source) return '';
  const lower = source.toLowerCase();
  const moneyPattern = /(?:usd|aed|gbp|eur|\$|£|€)\s?[\d,]+(?:\.\d+)?(?:\s?(?:m|million|k|thousand))?|[\d,]+(?:\.\d+)?\s?%/ig;
  for (const keyword of keywords) {
    const idx = lower.indexOf(String(keyword || '').toLowerCase());
    if (idx < 0) continue;
    const forwardWindow = source.slice(idx, idx + 180);
    const fallbackWindow = source.slice(Math.max(0, idx - 90), idx + 180);
    const moneyMatch = forwardWindow.match(moneyPattern) || fallbackWindow.match(moneyPattern);
    if (moneyMatch && moneyMatch[0]) return cleanText(moneyMatch[0], 120);
    const dateMatch = forwardWindow.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i)
      || fallbackWindow.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i);
    if (dateMatch && dateMatch[0]) return cleanText(dateMatch[0], 120);
    return cleanText(forwardWindow, 220);
  }
  return '';
}

function findFinancialEvidence(entries = [], definition = {}) {
  const keywords = Array.isArray(definition.keywords) ? definition.keywords : [];
  for (const entry of entries) {
    const text = cleanBlock(entry.text || '', 4000);
    if (!text) continue;
    const lower = text.toLowerCase();
    if (!keywords.some(keyword => lower.includes(String(keyword || '').toLowerCase()))) continue;
    return {
      entry,
      value: extractValueNearKeyword(text, keywords)
    };
  }
  return null;
}

function buildProjectFinancialEvidenceMap(input = {}, entries = []) {
  const type = cleanText(input.assessmentType).toLowerCase();
  const definitions = type === 'project_seller'
    ? SELLER_FINANCIAL_FIELDS
    : type === 'project_buyer'
      ? BUYER_FINANCIAL_FIELDS
      : [];
  const projectExposure = isPlainObject(input.projectExposure) ? input.projectExposure : {};
  const missingFields = new Set((Array.isArray(projectExposure.missingInputs) ? projectExposure.missingInputs : [])
    .map(item => cleanText(isPlainObject(item) ? item.field || item.label : item, 160))
    .filter(Boolean));
  const highImpactFields = new Set(definitions.slice(0, 8).map(item => item.field));
  missingFields.forEach(field => highImpactFields.add(field));
  return definitions
    .filter(definition => highImpactFields.has(definition.field) || missingFields.has(definition.field))
    .slice(0, 14)
    .map((definition) => {
      const found = findFinancialEvidence(entries, definition);
      if (found) {
        return {
          field: definition.field,
          status: 'found',
          value: found.value || '',
          evidenceRefs: [evidenceRef(found.entry)],
          commentary: `${definition.label} appears in evidence text. Treat the value as evidence-supported only after reviewing the cited document.`
        };
      }
      return {
        field: definition.field,
        status: 'not_found',
        value: '',
        evidenceRefs: [],
        commentary: `${definition.label} was not found in the provided citations or RAG matches, so it remains unknown. ${definition.who ? `Owner: ${definition.who}.` : ''}`
      };
    });
}

function buildParameterEvidenceMap(input = {}, entries = []) {
  const projectExposure = isPlainObject(input.projectExposure) ? input.projectExposure : {};
  const drivers = Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers.filter(isPlainObject) : [];
  const map = [];
  drivers.forEach((driver) => {
    const buckets = Array.isArray(driver.mapsTo) ? driver.mapsTo : [driver.mapsTo].filter(Boolean);
    buckets.forEach((bucket) => {
      const parameterKey = normaliseParameterKey(bucket);
      if (!parameterKey) return;
      const support = findEvidenceForText(entries, [driver.label, driver.rationale, driver.id].filter(Boolean).join(' '));
      map.push({
        parameterKey,
        evidenceRefs: support.map(evidenceRef),
        projectExposureRefs: [driver.id || driver.label].filter(Boolean),
        supportLevel: support.length ? (support.length >= 2 ? 'partial' : 'weak') : 'none',
        commentary: support.length
          ? 'Evidence text overlaps with the project financial driver.'
          : 'No linked evidence text supports this project financial driver yet.'
      });
    });
  });
  Object.entries(FIELD_TO_PARAMETER).forEach(([field, parameterKey]) => {
    const financial = buildProjectFinancialEvidenceMap(input, entries).find(item => item.field === field && item.status === 'found');
    if (!financial) return;
    map.push({
      parameterKey,
      evidenceRefs: financial.evidenceRefs,
      projectExposureRefs: [field],
      supportLevel: 'partial',
      commentary: `${field} was found in evidence and may support this FAIR bucket.`
    });
  });
  return dedupeBy(map, item => `${item.parameterKey}:${item.projectExposureRefs.join(',')}`, 20);
}

function detectContradictions(input = {}, entries = []) {
  const contradictions = [];
  const assumptionTexts = (Array.isArray(input.assumptions) ? input.assumptions : [])
    .map(item => isPlainObject(item) ? cleanBlock(item.statement || item.text || item.label || '', 800) : cleanBlock(item, 800))
    .filter(Boolean);
  const allEvidenceText = entries.map(entry => ({ entry, text: cleanBlock(entry.text || '', 3000).toLowerCase() })).filter(item => item.text);
  const extractRecoveryDays = (value = '') => {
    const text = cleanBlock(value, 1000).toLowerCase();
    const patterns = [
      /\b(?:recovery|restore|rto|recovery time objective)\b.{0,80}?\b(\d{1,3})\s*(?:business\s*)?days?\b/,
      /\b(\d{1,3})\s*(?:business\s*)?days?\b.{0,80}?\b(?:recovery|restore|rto|recovery time objective)\b/,
      /\b(\d{1,3})[-\s]*day\b.{0,80}?\b(?:recovery|restore|rto|recovery time objective)\b/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const days = Number(match[1]);
      if (Number.isFinite(days) && days >= 0) return days;
    }
    return null;
  };
  assumptionTexts.forEach((assumption) => {
    const lower = assumption.toLowerCase();
    const assumedRecoveryDays = extractRecoveryDays(lower);
    if (assumedRecoveryDays !== null) {
      const conflict = allEvidenceText.find(item => {
        const evidenceRecoveryDays = extractRecoveryDays(item.text);
        return evidenceRecoveryDays !== null && evidenceRecoveryDays !== assumedRecoveryDays;
      });
      if (conflict) {
        const evidenceRecoveryDays = extractRecoveryDays(conflict.text);
        contradictions.push({
          claim: assumption,
          conflictingEvidence: `Evidence references a ${evidenceRecoveryDays}-day recovery objective while the assumption uses ${assumedRecoveryDays} days.`,
          evidenceRefs: [evidenceRef(conflict.entry)],
          recommendedAction: 'Confirm the recovery objective before using recovery duration in scenario or parameter assumptions.'
        });
      }
    }
    if (/\b(no|none|not applicable|without)\b.*\b(liquidated damages|ld|sla credits?|service credits?|liability cap|termination)\b/.test(lower)) {
      const conflict = allEvidenceText.find(item => /\b(liquidated damages|ld cap|sla credits?|service credits?|liability cap|termination)\b/.test(item.text));
      if (conflict) {
        contradictions.push({
          claim: assumption,
          conflictingEvidence: 'Evidence text refers to penalties, credits, caps, or termination terms while the assumption says none/not applicable.',
          evidenceRefs: [evidenceRef(conflict.entry)],
          recommendedAction: 'Ask Legal or Commercial to confirm the contract position before treating this exposure as not applicable.'
        });
      }
    }
    if (/\b(no|none|not applicable|without)\b.*\b(recovery|recoveries|insurance|credit)\b/.test(lower)) {
      const conflict = allEvidenceText.find(item => /\b(recovery|recoveries|insurance|credit note|service credit|supplier credit)\b/.test(item.text));
      if (conflict) {
        contradictions.push({
          claim: assumption,
          conflictingEvidence: 'Evidence text refers to recoveries or credits while the assumption says none/not applicable.',
          evidenceRefs: [evidenceRef(conflict.entry)],
          recommendedAction: 'Confirm recoveries before treating unknown recovery as zero.'
        });
      }
    }
  });
  const projectContext = isPlainObject(input.projectContext) ? input.projectContext : {};
  if (projectContext.criticalMilestoneDate) {
    const claimDate = cleanText(projectContext.criticalMilestoneDate, 80).toLowerCase();
    const milestoneEvidence = allEvidenceText.find(item => item.text.includes('go-live') || item.text.includes('milestone'));
    if (milestoneEvidence && !milestoneEvidence.text.includes(claimDate)) {
      const dateMatch = milestoneEvidence.text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
      if (dateMatch) {
        contradictions.push({
          claim: `Critical milestone date: ${projectContext.criticalMilestoneDate}`,
          conflictingEvidence: `Evidence references a different milestone date: ${dateMatch[0]}.`,
          evidenceRefs: [evidenceRef(milestoneEvidence.entry)],
          recommendedAction: 'Confirm the current project schedule before calculating delay exposure.'
        });
      }
    }
  }
  return dedupeBy(contradictions, item => `${item.claim}:${item.conflictingEvidence}`, 8);
}

function buildDeterministicEvidenceMap(input = {}) {
  const entries = normaliseEvidenceEntries(input.citations, input.ragMatches);
  const contextText = [
    input.scenario,
    input.riskStatement,
    input.projectExposure?.projectExposureSummary,
    ...(Array.isArray(input.projectExposure?.financialDrivers) ? input.projectExposure.financialDrivers.map(item => `${item?.label || ''} ${item?.rationale || ''}`) : [])
  ].join(' ');
  const claims = buildClaimCandidates(input);
  if (!entries.length) {
    const projectFinancialEvidenceMap = buildProjectFinancialEvidenceMap(input, entries);
    return normaliseEvidenceMapForApi({
      supportedClaims: [],
      unsupportedClaims: claims.slice(0, 6).map(claim => buildUnsupportedClaim(claim, input.assessmentType)),
      contradictions: [],
      parameterEvidenceMap: buildParameterEvidenceMap(input, entries),
      projectFinancialEvidenceMap,
      citationQuality: { strong: [], weak: [], decorative: [] }
    });
  }
  const supportedClaims = [];
  const unsupportedClaims = [];
  claims.forEach((claim) => {
    const supported = classifyClaimSupport(claim, entries);
    if (supported) supportedClaims.push(supported);
    else unsupportedClaims.push(buildUnsupportedClaim(claim, input.assessmentType));
  });
  const projectFinancialEvidenceMap = buildProjectFinancialEvidenceMap(input, entries);
  return normaliseEvidenceMapForApi({
    supportedClaims: supportedClaims.slice(0, 10),
    unsupportedClaims: unsupportedClaims.slice(0, 8),
    contradictions: detectContradictions(input, entries),
    parameterEvidenceMap: buildParameterEvidenceMap(input, entries),
    projectFinancialEvidenceMap,
    citationQuality: classifyCitationQuality(entries, contextText)
  });
}

function classifyEvidenceMapFallbackReason(error = null) {
  const message = String(error?.message || error || '');
  if (/Hosted AI proxy is not configured|AI_PROXY_UNAVAILABLE|COMPASS_API_KEY/i.test(message)) {
    return {
      code: 'hosted_ai_unavailable',
      title: 'Hosted AI unavailable',
      message: 'Hosted AI is not configured, so deterministic evidence mapping was used.',
      detail: message
    };
  }
  if (/structured response|JSON|schema|unusable|Unexpected token|malformed/i.test(message)) {
    return {
      code: 'invalid_ai_output',
      title: 'AI output was not usable',
      message: 'The AI response could not be safely converted into the evidence map schema, so deterministic fallback was used.',
      detail: message
    };
  }
  if (/timed out|timeout/i.test(message)) {
    return {
      code: 'evidence_map_timeout',
      title: 'AI evidence map timed out',
      message: 'AI evidence mapping timed out, so deterministic fallback was used.',
      detail: message
    };
  }
  return {
    code: 'evidence_map_ai_failed',
    title: 'AI evidence map failed',
    message: 'AI evidence mapping failed, so deterministic fallback was used.',
    detail: message
  };
}

function buildDeterministicEvidenceMapResult(options = {}) {
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
  const evidenceMap = buildDeterministicEvidenceMap(input);
  const reason = fallbackReason || {
    code: aiUnavailable ? 'hosted_ai_unavailable' : 'deterministic_evidence_map',
    title: 'Deterministic evidence map',
    message: aiUnavailable
      ? 'Hosted AI was unavailable, so deterministic evidence mapping was used.'
      : 'The deterministic evidence map was used.',
    detail: normalisedError ? String(normalisedError.message || normalisedError) : ''
  };
  return {
    mode: 'deterministic_fallback',
    evidenceMap,
    trace: buildTraceEntry({
      label: input.traceLabel || 'Evidence map',
      promptSummary,
      response: response || JSON.stringify(evidenceMap, null, 2),
      sources: [...(input.citations || []), ...(input.ragMatches || [])]
    }),
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    fallbackReasonCode: reason.code || 'deterministic_evidence_map',
    fallbackReasonTitle: reason.title || 'Deterministic evidence map',
    fallbackReasonMessage: reason.message || '',
    fallbackReasonDetail: reason.detail || '',
    generatedAt: new Date().toISOString()
  };
}

function buildSystemPrompt() {
  return `You are an AI Evidence Map reviewer for enterprise and project-linked risk assessments.

Return JSON only. Do not include markdown.

Rules:
- Do not change auth/RBAC or RAG storage behavior.
- Never claim support unless citation or RAG match text supports it.
- Do not infer values from document titles alone.
- Flag decorative citations.
- Flag contradictions between user/project assumptions and evidence.
- Unknown project values remain unknown unless evidence supports them.
- For buyer risks, look for delay cost, budget, remaining spend, payment terms, reprocurement rights, recoveries, LD/recovery cap, milestone dates, and benefit case.
- For seller risks, look for contract value, revenue, margin, LD/SLA caps, liability cap, termination clause, cost to cure, warranty exposure, renewal/future work, and revenue recognition milestones.
- Return only JSON matching this schema:
${EVIDENCE_MAP_SCHEMA}`;
}

function buildUserPrompt(input = {}, deterministicMap = {}) {
  const compactInput = {
    assessmentType: input.assessmentType,
    scenario: input.scenario,
    riskStatement: input.riskStatement,
    structuredScenario: input.structuredScenario,
    projectContext: input.projectContext,
    projectExposure: input.projectExposure,
    assumptions: input.assumptions,
    parameters: input.parameters,
    citations: input.citations,
    ragMatches: input.ragMatches,
    businessContext: input.businessContext,
    adminSettings: input.adminSettings
  };
  return `Create an evidence map for the current assessment.

Use the deterministic baseline below as a conservative guardrail. You may improve wording and ranking, but do not upgrade support unless the citation or RAG match text supports it.

Deterministic baseline:
${JSON.stringify(deterministicMap, null, 2)}

Input:
${JSON.stringify(compactInput, null, 2)}

Return only the Evidence Map JSON object.`;
}

async function buildEvidenceMapWorkflow(input = {}) {
  const normalisedInput = normaliseEvidenceMapWorkflowInput(input);
  const deterministic = buildDeterministicEvidenceMap(normalisedInput);
  const timeouts = buildWorkflowTimeoutProfile({
    liveMs: Number(process.env.EVIDENCE_MAP_AI_TIMEOUT_MS || 22000),
    repairMs: Number(process.env.EVIDENCE_MAP_AI_REPAIR_TIMEOUT_MS || 8000)
  });
  try {
    const generation = await callAi(buildSystemPrompt(), buildUserPrompt(normalisedInput, deterministic), {
      taskName: 'evidenceMap',
      temperature: 0.1,
      maxCompletionTokens: 3000,
      maxPromptChars: MAX_PROMPT_CHARS,
      timeoutMs: timeouts.liveMs
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, EVIDENCE_MAP_SCHEMA, {
      taskName: 'evidenceMapRepair',
      timeoutMs: timeouts.repairMs,
      maxCompletionTokens: 3000,
      maxPromptChars: 14000
    });
    const evidenceMap = normaliseEvidenceMapForApi(parsed.parsed, deterministic);
    const traces = [
      buildTraceEntry({
        label: normalisedInput.traceLabel || 'Evidence map',
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: [...(normalisedInput.citations || []), ...(normalisedInput.ragMatches || [])]
      }),
      parsed.trace || null
    ].filter(Boolean);
    return {
      mode: 'live',
      evidenceMap,
      trace: traces[0] || null,
      traces,
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyEvidenceMapFallbackReason,
      buildFallbackResult: buildDeterministicEvidenceMapResult,
      fallbackOptions: {
        input: normalisedInput,
        promptSummary: buildUserPrompt(normalisedInput, deterministic),
        response: String(error?.message || error || '')
      }
    });
  }
}

module.exports = {
  EVIDENCE_MAP_SCHEMA,
  buildDeterministicEvidenceMap,
  buildDeterministicEvidenceMapResult,
  buildEvidenceMapWorkflow,
  classifyEvidenceMapFallbackReason,
  normaliseEvidenceMapForApi,
  normaliseEvidenceMapWorkflowInput
};
