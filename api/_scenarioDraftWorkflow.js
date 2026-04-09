'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const { buildTraceEntry, callAi, parseOrRepairStructuredJson, runStructuredQualityGate, sanitizeAiText } = require('./_aiOrchestrator');
const { buildDeterministicFallbackResult, buildFallbackFromError, buildManualModeResult, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const { buildFeedbackLearningPromptBlock, resolveHierarchicalFeedbackProfile, rerankRiskCardsWithFeedback } = require('./_learningAuthority');
const { calibrateCoherenceConfidence } = require('./_confidenceCalibration');
const ScenarioClassification = require('./_scenarioClassification');
const {
  SCENARIO_TAXONOMY_FAMILY_BY_KEY,
  SCENARIO_TAXONOMY_MECHANISM_BY_KEY,
  SCENARIO_TAXONOMY_OVERLAY_BY_KEY
} = require('./_scenarioTaxonomy');

function normaliseSentenceKey(sentence = '') {
  return String(sentence || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeSentences(text = '') {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const sentences = raw.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const seen = new Set();
  return sentences.filter((sentence) => {
    const key = normaliseSentenceKey(sentence);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' ').trim();
}

function titleCaseWord(word = '') {
  const value = String(word || '').trim();
  if (!value) return '';
  if (/^[A-Z0-9&/+.-]+$/.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function toDisplayLabel(value = '') {
  return String(value || '')
    .split(/[\s_-]+/)
    .map(titleCaseWord)
    .filter(Boolean)
    .join(' ')
    .trim();
}

function joinList(items = []) {
  const values = Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean)));
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function truncateText(value = '', maxChars = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

function stripScenarioLeadIns(value = '') {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text
    .replace(/^(?:critical|high|medium|low)-urgency\s+[a-z/& -]+ scenario:\s*/i, '')
    .replace(/^(?:strategic|operational|cyber|compliance|regulatory|financial|fraud|legal(?: \/ contract)?|business continuity|continuity|third-party|supply chain|procurement|esg|hse|people(?: and workforce)?|physical security|ot resilience|ai(?: \/ model)? risk|data governance(?: \/ privacy)?|geopolitical|investment(?: \/ jv)?|transformation delivery) scenario:\s*/i, '')
    .replace(/^in [^.]+?,\s*[^.]+? faces a material [^.]+? scenario in which\s*/i, '')
    .replace(/^in [^.]+?,\s*[^.]+? faces a material risk scenario in which\s*/i, '')
    .replace(/^a risk scenario is being assessed where\s*/i, '')
    .replace(/^the scenario is that\s*/i, '')
    .replace(/^scenario:\s*/i, '')
    .replace(/^risk statement:\s*/i, '')
    .trim();
  return text.replace(/^[,:;\-\s]+/, '').trim();
}

function ensureSentence(text = '') {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function cleanUserFacingText(value = '', { maxSentences = 0, stripTrailingPeriod = false } = {}) {
  let text = dedupeSentences(String(value || '').replace(/\s+/g, ' ').trim());
  if (!text) return '';

  text = text
    .replace(/candidate risk identified from (?:the )?(?:intake text|uploaded register|register analysis)[^.]*\.?/gi, '')
    .replace(/a risk scenario is being assessed where\s*/gi, '')
    .replace(/this scenario should be assessed for\s*/gi, 'Focus on ')
    .replace(/current urgency is assessed as\s*/gi, 'Urgency is ')
    .replace(/the main asset, service, or team affected is\s*/gi, 'The scenario affects ')
    .replace(/the likely trigger or threat driver is\s*/gi, 'The likely trigger is ')
    .replace(/the expected business, operational, or regulatory impact is\s*/gi, 'The likely impact is ')
    .replace(/given the stated urgency,?\s*/gi, '')
    .replace(/in practice, this can drive\s*/gi, 'This could lead to ')
    .replace(/a likely progression is\s*/gi, 'The most likely progression is ')
    .replace(/\s+\./g, '.')
    .replace(/\.\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (maxSentences > 0) {
    text = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, maxSentences).join(' ').trim();
  }
  if (stripTrailingPeriod) {
    text = text.replace(/[.]+$/g, '').trim();
  }
  return text;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normaliseInlineInputText(value = '') {
  return String(value || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseBlockInputText(value = '') {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactInputValue(value) {
  if (Array.isArray(value)) {
    const next = value
      .map((item) => compactInputValue(item))
      .filter((item) => item !== undefined);
    return next.length ? next : undefined;
  }
  if (isPlainObject(value)) {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      const compacted = compactInputValue(item);
      if (compacted !== undefined) next[key] = compacted;
    });
    return Object.keys(next).length ? next : undefined;
  }
  if (typeof value === 'string') {
    return value.trim() ? value : undefined;
  }
  if (value == null) return undefined;
  return value;
}

function normaliseStringListInput(items = [], { maxItems = 12, block = false, dedupe = true } = {}) {
  const source = Array.isArray(items) ? items : [];
  const seen = new Set();
  const result = [];
  source.forEach((item) => {
    const value = block ? normaliseBlockInputText(item) : normaliseInlineInputText(item);
    if (!value) return;
    const key = value.toLowerCase();
    if (dedupe && seen.has(key)) return;
    seen.add(key);
    if (result.length < maxItems) result.push(value);
  });
  return result;
}

function normaliseNumericInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normaliseCitationInput(item = {}) {
  if (!isPlainObject(item)) return undefined;
  return compactInputValue({
    title: normaliseInlineInputText(item.title || item.sourceTitle || item.note || ''),
    sourceTitle: normaliseInlineInputText(item.sourceTitle || ''),
    excerpt: normaliseBlockInputText(item.excerpt || item.description || item.text || item.note || ''),
    url: String(item.url || item.link || '').trim(),
    relevanceReason: normaliseBlockInputText(item.relevanceReason || ''),
    score: normaliseNumericInput(item.score)
  });
}

function normaliseCitationInputs(items = [], { maxItems = 8 } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normaliseCitationInput(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseResolvedObligationEntryInput(item = {}) {
  if (!isPlainObject(item)) return undefined;
  return compactInputValue({
    title: normaliseInlineInputText(item.title || ''),
    sourceEntityName: normaliseInlineInputText(item.sourceEntityName || ''),
    text: normaliseBlockInputText(item.text || '')
  });
}

function normaliseResolvedObligationContextInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    summary: normaliseBlockInputText(value.summary || ''),
    direct: (Array.isArray(value.direct) ? value.direct : []).map((item) => normaliseResolvedObligationEntryInput(item)).filter(Boolean).slice(0, 6),
    inheritedMandatory: (Array.isArray(value.inheritedMandatory) ? value.inheritedMandatory : []).map((item) => normaliseResolvedObligationEntryInput(item)).filter(Boolean).slice(0, 6),
    inheritedConditional: (Array.isArray(value.inheritedConditional) ? value.inheritedConditional : []).map((item) => normaliseResolvedObligationEntryInput(item)).filter(Boolean).slice(0, 6),
    inheritedGuidance: (Array.isArray(value.inheritedGuidance) ? value.inheritedGuidance : []).map((item) => normaliseResolvedObligationEntryInput(item)).filter(Boolean).slice(0, 6)
  });
}

function normaliseBusinessUnitInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    id: normaliseInlineInputText(value.id || ''),
    buId: normaliseInlineInputText(value.buId || ''),
    name: normaliseInlineInputText(value.name || ''),
    geography: normaliseInlineInputText(value.geography || ''),
    functionKey: normaliseInlineInputText(value.functionKey || ''),
    selectedDepartmentKey: normaliseInlineInputText(value.selectedDepartmentKey || ''),
    scenarioLensHint: normaliseInlineInputText(value.scenarioLensHint || ''),
    contextSummary: normaliseBlockInputText(value.contextSummary || ''),
    notes: normaliseBlockInputText(value.notes || ''),
    selectedDepartmentContext: normaliseBlockInputText(value.selectedDepartmentContext || ''),
    aiGuidance: normaliseBlockInputText(value.aiGuidance || '')
  });
}

function normaliseAdminSettingsInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    geography: normaliseInlineInputText(value.geography || ''),
    applicableRegulations: normaliseStringListInput(value.applicableRegulations, { maxItems: 12 }),
    businessUnitContext: normaliseBlockInputText(value.businessUnitContext || ''),
    departmentContext: normaliseBlockInputText(value.departmentContext || ''),
    companyContextProfile: normaliseBlockInputText(value.companyContextProfile || ''),
    companyStructureContext: normaliseBlockInputText(value.companyStructureContext || ''),
    inheritedContextSummary: normaliseBlockInputText(value.inheritedContextSummary || ''),
    personalContextSummary: normaliseBlockInputText(value.personalContextSummary || ''),
    userProfileSummary: normaliseBlockInputText(value.userProfileSummary || ''),
    adminContextSummary: normaliseBlockInputText(value.adminContextSummary || ''),
    benchmarkStrategy: normaliseBlockInputText(value.benchmarkStrategy || ''),
    resolvedObligationSummary: normaliseBlockInputText(value.resolvedObligationSummary || ''),
    resolvedObligationContext: normaliseResolvedObligationContextInput(value.resolvedObligationContext)
  });
}

function normalisePriorMessagesInput(items = [], { maxItems = 6 } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!isPlainObject(item)) return undefined;
      return compactInputValue({
        role: normaliseInlineInputText(item.role || '').toLowerCase(),
        content: normaliseBlockInputText(item.content || '')
      });
    })
    .filter((item) => item?.role && item?.content)
    .slice(-maxItems);
}

function normaliseGuidedInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    event: normaliseBlockInputText(value.event || ''),
    impact: normaliseBlockInputText(value.impact || ''),
    cause: normaliseBlockInputText(value.cause || ''),
    asset: normaliseBlockInputText(value.asset || ''),
    urgency: normaliseInlineInputText(value.urgency || '').toLowerCase()
  });
}

function normaliseGuidedScenarioDraftInput(input = {}) {
  return compactInputValue({
    session: input.session,
    riskStatement: normaliseBlockInputText(input.riskStatement || ''),
    guidedInput: normaliseGuidedInput(input.guidedInput),
    scenarioLensHint: normaliseInlineInputText(input.scenarioLensHint || ''),
    businessUnit: normaliseBusinessUnitInput(input.businessUnit),
    geography: normaliseInlineInputText(input.geography || ''),
    applicableRegulations: normaliseStringListInput(input.applicableRegulations, { maxItems: 12 }),
    citations: normaliseCitationInputs(input.citations),
    adminSettings: normaliseAdminSettingsInput(input.adminSettings),
    traceLabel: normaliseInlineInputText(input.traceLabel || ''),
    priorMessages: normalisePriorMessagesInput(input.priorMessages)
  }) || { session: input.session };
}

function normaliseScenarioHintKey(value) {
  return ScenarioClassification.normaliseScenarioHintKey(value);
}

function scenarioClassificationByKey(key = 'general', extra = {}) {
  const map = {
    ransomware: {
      key: 'ransomware',
      label: 'Cyber',
      scenarioType: 'Ransomware / Extortion Attack',
      primaryDriver: 'Organised cybercriminal groups',
      eventPath: 'Ransomware deployment after successful initial access',
      effect: 'Encryption, service unavailability, and extortion pressure'
    },
    identity: {
      key: 'identity',
      label: 'Cyber',
      scenarioType: 'Identity Platform Compromise',
      primaryDriver: 'Credential theft and account-takeover specialists',
      eventPath: 'Credential theft, token hijack, or federated identity abuse',
      effect: 'Privileged account takeover, mailbox misuse, and control disruption'
    },
    phishing: {
      key: 'phishing',
      label: 'Cyber',
      scenarioType: 'Phishing / Business Email Compromise',
      primaryDriver: 'Phishing or business-email-compromise actors',
      eventPath: 'Trust-channel compromise through email or impersonation',
      effect: 'Fraud, workflow compromise, and delayed detection'
    },
    cloud: {
      key: 'cloud',
      label: 'Cyber',
      scenarioType: 'Cloud Exposure Scenario',
      primaryDriver: 'Cloud control weakness or compromised access',
      eventPath: 'Cloud misuse, exposure, or compromised administrative control',
      effect: 'Service disruption, data exposure, and recovery effort'
    },
    'availability-attack': {
      key: 'availability-attack',
      label: 'Cyber',
      scenarioType: 'Availability Attack Scenario',
      primaryDriver: 'Hostile traffic flooding or denial-of-service actors',
      eventPath: 'Internet-facing service disruption through malicious traffic saturation',
      effect: 'Customer-facing outage, recovery strain, and incident-response pressure'
    },
    'data-breach': {
      key: 'data-breach',
      label: 'Cyber',
      scenarioType: 'Data Disclosure Scenario',
      primaryDriver: 'Unauthorised access or exfiltration',
      eventPath: 'Compromise or control failure leading to data disclosure',
      effect: 'Remediation, notification, and trust impact'
    },
    'ai-model-risk': {
      key: 'ai-model-risk',
      label: 'AI / model risk',
      scenarioType: 'AI / Model Risk Scenario',
      primaryDriver: 'Weak model governance, guardrails, or oversight',
      eventPath: 'Unsafe or low-trust model behaviour in a governed workflow',
      effect: 'Poor decisions, conduct risk, and regulatory challenge'
    },
    'data-governance': {
      key: 'data-governance',
      label: 'Data governance / privacy',
      scenarioType: 'Data Governance Scenario',
      primaryDriver: 'Weak data ownership, retention, or lineage control',
      eventPath: 'Data governance failure affecting use, quality, or privacy',
      effect: 'Remediation burden and lower trust in downstream analytics'
    },
    operational: {
      key: 'operational',
      label: 'Operational',
      scenarioType: 'Operational Risk Scenario',
      primaryDriver: 'Process breakdown or control weakness',
      eventPath: 'Service failure, disruption, or operational strain',
      effect: 'Execution disruption, backlog, and management escalation'
    },
    regulatory: {
      key: 'regulatory',
      label: 'Regulatory',
      scenarioType: 'Regulatory Risk Scenario',
      primaryDriver: 'Regulatory or licence requirement failure',
      eventPath: 'Control or reporting weakness triggering regulator attention',
      effect: 'Enforcement, remediation, and management scrutiny'
    },
    financial: {
      key: 'financial',
      label: 'Financial',
      scenarioType: 'Financial Risk Scenario',
      primaryDriver: 'Financial control or counterparty weakness',
      eventPath: 'Payment, receivables, or commercial exposure failure',
      effect: 'Direct monetary loss, control pressure, and delayed detection'
    },
    'fraud-integrity': {
      key: 'fraud-integrity',
      label: 'Fraud / integrity',
      scenarioType: 'Fraud / Integrity Scenario',
      primaryDriver: 'Fraud, collusion, or integrity control weakness',
      eventPath: 'Manipulation or override inside payment, approval, or conduct processes',
      effect: 'Direct loss and investigation pressure'
    },
    compliance: {
      key: 'compliance',
      label: 'Compliance',
      scenarioType: 'Compliance Risk Scenario',
      primaryDriver: 'Policy non-compliance or weak assurance',
      eventPath: 'Control or obligation failure surfacing through oversight',
      effect: 'Remediation burden and assurance pressure'
    },
    'legal-contract': {
      key: 'legal-contract',
      label: 'Legal / contract',
      scenarioType: 'Legal / Contract Scenario',
      primaryDriver: 'Ambiguous obligations or weak contractual control',
      eventPath: 'Dispute, delay, or liability challenge',
      effect: 'Legal cost, delivery delay, and commercial strain'
    },
    geopolitical: {
      key: 'geopolitical',
      label: 'Geopolitical / market access',
      scenarioType: 'Geopolitical Risk Scenario',
      primaryDriver: 'Cross-border restriction or sovereign pressure',
      eventPath: 'Market-access, sanctions, or trade restriction event',
      effect: 'Delayed execution and strategic pressure'
    },
    procurement: {
      key: 'procurement',
      label: 'Procurement',
      scenarioType: 'Procurement Risk Scenario',
      primaryDriver: 'Weak sourcing governance or supplier selection',
      eventPath: 'Commercial or procurement governance failure',
      effect: 'Commercial leakage, assurance pressure, or supplier misfit'
    },
    'supply-chain': {
      key: 'supply-chain',
      label: 'Supply chain',
      scenarioType: 'Supply Chain Risk Scenario',
      primaryDriver: 'Critical dependency or upstream disruption',
      eventPath: 'Delivery, logistics, or dependency failure',
      effect: 'Delay, service strain, and continuity pressure'
    },
    'third-party': {
      key: 'third-party',
      label: 'Third-party',
      scenarioType: 'Third-Party Risk Scenario',
      primaryDriver: 'Supplier failure or inherited control weakness',
      eventPath: 'Dependency or supplier access failure',
      effect: 'Operational, data, or contractual consequence'
    },
    'business-continuity': {
      key: 'business-continuity',
      label: 'Business continuity',
      scenarioType: 'Business Continuity Scenario',
      primaryDriver: 'Continuity or recovery weakness',
      eventPath: 'Incident outlasting recovery assumptions',
      effect: 'Extended outage and recovery strain'
    },
    'physical-security': {
      key: 'physical-security',
      label: 'Physical security',
      scenarioType: 'Physical Security Scenario',
      primaryDriver: 'Physical access or perimeter control weakness',
      eventPath: 'Intrusion, site control lapse, or facility breach',
      effect: 'Investigation, disruption, and leadership concern'
    },
    'ot-resilience': {
      key: 'ot-resilience',
      label: 'OT / site resilience',
      scenarioType: 'OT / Site Resilience Scenario',
      primaryDriver: 'Weak OT governance or site-system control',
      eventPath: 'Industrial control or site-system instability',
      effect: 'Operating instability and recovery strain'
    },
    'people-workforce': {
      key: 'people-workforce',
      label: 'People / workforce',
      scenarioType: 'People / Workforce Scenario',
      primaryDriver: 'Workforce, welfare, or staffing weakness',
      eventPath: 'People pressure reducing safe delivery or execution stability',
      effect: 'Operational strain, welfare concern, and management escalation'
    },
    hse: {
      key: 'hse',
      label: 'HSE',
      scenarioType: 'HSE Risk Scenario',
      primaryDriver: 'Safety or environmental control failure',
      eventPath: 'Unsafe condition, incident, or environmental failure',
      effect: 'Harm, interruption, and remediation exposure'
    },
    esg: {
      key: 'esg',
      label: 'ESG',
      scenarioType: 'ESG Risk Scenario',
      primaryDriver: 'Weak sustainability, human-rights, or disclosure governance',
      eventPath: 'ESG performance, claim, or supply-base conduct challenge',
      effect: 'Stakeholder scrutiny, remediation pressure, and governance challenge'
    },
    strategic: {
      key: 'strategic',
      label: 'Strategic',
      scenarioType: 'Strategic Risk Scenario',
      primaryDriver: 'Weak strategic assumption or market shift',
      eventPath: 'Strategy execution weakness or strategic drift',
      effect: 'Missed objectives, value erosion, and management pressure'
    },
    'investment-jv': {
      key: 'investment-jv',
      label: 'Investment / JV',
      scenarioType: 'Investment / JV Scenario',
      primaryDriver: 'Weak diligence or unrealistic integration assumptions',
      eventPath: 'Partnership or deal thesis underperforming',
      effect: 'Value erosion and delayed synergy'
    },
    'transformation-delivery': {
      key: 'transformation-delivery',
      label: 'Transformation delivery',
      scenarioType: 'Transformation Delivery Scenario',
      primaryDriver: 'Programme dependency or milestone control weakness',
      eventPath: 'Delivery slippage across a change programme',
      effect: 'Milestone delay and downstream execution pressure'
    },
    general: {
      key: 'general',
      label: 'General enterprise risk',
      scenarioType: 'Risk Scenario',
      primaryDriver: 'A material risk driver',
      eventPath: 'A material event path',
      effect: 'Business disruption or exposure'
    }
  };
  return {
    ...(map[key] || map.general),
    secondaryKeys: Array.isArray(extra.secondaryKeys) ? extra.secondaryKeys : []
  };
}

function hasOperationalOutageSignals(text = '') {
  return /(downtime|outage|service disruption|operational disruption|critical operational disruption|availability|unavailable|degrad|aging infrastructure|ageing infrastructure|legacy infrastructure|human error|manual error|platform instability|system instability|service failure|process failure|recovery effort|recovery strain|core service)/.test(String(text || '').toLowerCase());
}

function hasContinuityGapSignals(text = '') {
  return /(?:^|[^a-z0-9])no dr(?:$|[^a-z0-9])|without dr|dr gap|no disaster recovery|without disaster recovery|disaster recovery gap|continuity gap|recovery gap|failover gap|no failover|without failover|\brto\b|\brpo\b|recovery objective|disaster recovery|business continuity/.test(String(text || '').toLowerCase());
}

function hasCriticalMessagingServiceSignals(text = '') {
  return /(outlook(?: online)?|exchange(?: online)?|email system|mail system|mail service|messaging service|critical email|critical communication service|microsoft 365|office 365|email platform|messaging platform)/.test(String(text || '').toLowerCase());
}

function hasAvailabilityAttackSignals(text = '') {
  const value = String(text || '').toLowerCase();
  return /(ddos|d[\s-]*dos|denial[- ]of[- ]service|denial of service|traffic flood|flood(?:ed|ing)?.*traffic|botnet|volumetric|application[- ]layer attack|syn flood)/.test(value)
    || ((/malicious actors?|threat actors?|attackers?/.test(value))
      && /(website|web site|online services?|internet-facing|public-facing|customer portal|portal|site|online platform)/.test(value)
      && /traffic/.test(value)
      && /(slow(?:ing|ed)? down|slow to|crash|degrad|unavailable|availability|disrupt)/.test(value));
}

function hasExplicitCyberCompromiseSignals(text = '') {
  return /(cyber|security|identity|credential|ransom|malware|phish|breach|exfil|privileged|unauthori[sz]ed|misconfig|vulnerability|token theft|session hijack|attacker|threat actor|compromise|account takeover|tenant change|public exposure|storage exposure|data exposure)/.test(String(text || '').toLowerCase());
}

function hasCounterpartyCreditSignals(text = '') {
  return /(bankrupt|bankruptcy|insolv|insolven|receivable|bad debt|write-off|write off|counterparty|customer default|client default|credit loss|credit exposure|collections|collectability|provisioning|working capital|cashflow)/.test(String(text || '').toLowerCase());
}

function hasSupplierLabourSignals(text = '') {
  return /(exploitative labor|exploitative labour|forced labor|forced labour|child labor|child labour|modern slavery|labor practice|labour practice|worker exploitation|worker abuse|human rights|living wage|recruitment fees?|passports? held|passport retention|passport confiscation|withheld passports?|debt bondage|labou?r brokers?|labou?r agents?|grievance)/.test(String(text || '').toLowerCase());
}

function hasEsgDisclosureSignals(text = '') {
  return /(esg|sustainability|greenwashing|climate disclosure|sustainability disclosure|carbon|emission|net zero|scope 1|scope 2|scope 3|social impact|claim substantiation|renewable energy attributes|supplier emissions|supplier data|activity factors|transition plan|transition milestone|sustainability-linked loan|sustainability-linked financing|margin step-down|assurance prep|assurance review|assurance challenge|kpi)/.test(String(text || '').toLowerCase());
}

function collectScenarioSecondaryKeys({
  primaryKey = 'general',
  hintKey = '',
  activeKeys = []
} = {}) {
  const secondary = [];
  const pushKey = (value) => {
    const key = normaliseScenarioHintKey(value);
    if (!key || key === primaryKey || key === 'general' || secondary.includes(key)) return;
    secondary.push(key);
  };
  (Array.isArray(activeKeys) ? activeKeys : []).forEach(pushKey);
  if (hintKey) pushKey(hintKey);
  return secondary.slice(0, 3);
}

function classifyScenario(narrative = '', options = {}) {
  return ScenarioClassification.classifyScenario(narrative, options);
}

function buildScenarioLens(classification = {}) {
  return ScenarioClassification.buildScenarioLens(classification);
}

function isCompatibleScenarioLens(expected = '', actual = '') {
  return ScenarioClassification.isCompatibleScenarioLens(expected, actual);
}

function extractGuidedDraftAnchors(input = {}, seedNarrative = '') {
  const text = [
    input.guidedInput?.event,
    input.guidedInput?.impact,
    input.guidedInput?.cause,
    input.guidedInput?.asset,
    seedNarrative
  ].filter(Boolean).join(' ');
  const stopWords = new Set(['about', 'after', 'along', 'because', 'could', 'create', 'critical', 'current', 'event', 'from', 'have', 'into', 'issue', 'likely', 'main', 'material', 'might', 'more', 'most', 'risk', 'scenario', 'scope', 'should', 'their', 'there', 'these', 'this', 'what', 'which', 'with', 'would']);
  return Array.from(new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [])).filter((token) => token.length > 4 && !stopWords.has(token));
}

function extractScenarioAnchorTokens(value = '', {
  limit = 10
} = {}) {
  const stopWords = new Set([
    'about', 'after', 'along', 'because', 'could', 'create', 'critical', 'current', 'event', 'from', 'have', 'into',
    'issue', 'likely', 'main', 'material', 'might', 'more', 'most', 'risk', 'scenario', 'scope', 'should', 'their',
    'there', 'these', 'this', 'what', 'which', 'with', 'would'
  ]);
  return Array.from(new Set(String(value || '').toLowerCase().match(/[a-z0-9]+/g) || []))
    .filter((token) => token.length > 4 && !stopWords.has(token))
    .slice(0, limit);
}

function buildGuidedDraftAnchorGroups(input = {}, seedNarrative = '') {
  const eventText = String(input?.guidedInput?.event || seedNarrative || '').trim();
  const narrativeText = String(seedNarrative || input?.riskStatement || '').trim();
  const causeText = String(input?.guidedInput?.cause || '').trim();
  const impactText = String(input?.guidedInput?.impact || '').trim();
  const assetText = String(input?.guidedInput?.asset || '').trim();
  const event = extractScenarioAnchorTokens(eventText, { limit: 10 });
  const cause = extractScenarioAnchorTokens(causeText, { limit: 6 });
  const impact = extractScenarioAnchorTokens(impactText, { limit: 6 });
  const asset = extractScenarioAnchorTokens(assetText, { limit: 6 });
  const narrative = extractScenarioAnchorTokens(narrativeText, { limit: 10 });
  const critical = uniqueKeys([
    ...event.slice(0, 6),
    ...cause.slice(0, 4),
    ...asset.slice(0, 4),
    ...narrative.slice(0, 4)
  ]).slice(0, 12);
  return {
    event,
    cause,
    impact,
    asset,
    narrative,
    critical,
    all: uniqueKeys([
      ...event,
      ...cause,
      ...impact,
      ...asset,
      ...narrative
    ])
  };
}

function scoreGuidedDraftAnchorGroups(text = '', groups = {}) {
  const eventOverlap = countScenarioAnchorOverlap(text, groups.event || []);
  const causeOverlap = countScenarioAnchorOverlap(text, groups.cause || []);
  const impactOverlap = countScenarioAnchorOverlap(text, groups.impact || []);
  const assetOverlap = countScenarioAnchorOverlap(text, groups.asset || []);
  const narrativeOverlap = countScenarioAnchorOverlap(text, groups.narrative || []);
  const criticalOverlap = countScenarioAnchorOverlap(text, groups.critical || []);
  const populatedGroupCount = ['event', 'cause', 'impact', 'asset', 'narrative']
    .filter((key) => Array.isArray(groups[key]) && groups[key].length)
    .length;
  const matchedGroupCount = [
    eventOverlap > 0,
    causeOverlap > 0,
    impactOverlap > 0,
    assetOverlap > 0,
    narrativeOverlap > 0
  ].filter(Boolean).length;
  return {
    eventOverlap,
    causeOverlap,
    impactOverlap,
    assetOverlap,
    narrativeOverlap,
    criticalOverlap,
    populatedGroupCount,
    matchedGroupCount,
    totalOverlap: eventOverlap + causeOverlap + impactOverlap + assetOverlap + narrativeOverlap,
    eventLikeOverlap: Math.max(eventOverlap, narrativeOverlap)
  };
}

function countScenarioAnchorOverlap(text = '', anchors = []) {
  const haystack = String(text || '').toLowerCase();
  return (Array.isArray(anchors) ? anchors : []).filter((token) => token && haystack.includes(token)).length;
}

function extractExplicitScenarioLeadLens(value = '') {
  return ScenarioClassification.extractExplicitScenarioLeadLens(value);
}

function buildScenarioLead({ geography = '', businessUnit = '', asset = '', cause = '', impact = '', scenarioLabel = 'risk scenario' } = {}) {
  const place = geography ? `Across ${geography}` : 'Across the selected operating footprint';
  const org = businessUnit || 'the business unit';
  const focus = asset ? `${scenarioLabel} affecting ${asset}` : scenarioLabel;
  const causeText = cause ? `The most credible initial path is ${cause.toLowerCase()}` : '';
  const impactText = impact ? `The likely business effect is ${impact.toLowerCase()}` : '';
  return ensureSentence([`${place}, ${org} could face a material ${focus}`.replace(/\s+/g, ' ').trim(), causeText, impactText].filter(Boolean).join(' '));
}

function buildRiskContextSummary({ classification, asset = '', impact = '', riskTitles = [] } = {}) {
  const label = String(classification?.label || classification?.scenarioType || 'enterprise').trim().toLowerCase();
  const focus = asset ? ` around ${asset}` : '';
  const impactText = String(impact || classification?.effect || '').trim();
  const firstRisk = String(riskTitles?.[0]?.title || '').trim();
  const secondRisk = String(riskTitles?.[1]?.title || '').trim();
  const impactTail = impactText ? ` Likely consequences include ${impactText.charAt(0).toLowerCase() + impactText.slice(1)}.` : '';
  const riskTail = firstRisk ? ` Primary pressure points are ${firstRisk}${secondRisk ? ` and ${secondRisk.toLowerCase()}` : ''}.` : '';
  return cleanUserFacingText(`AI reframed this as a ${label} scenario${focus}.${impactTail}${riskTail}`, { maxSentences: 3 });
}

function buildRiskContextLinkAnalysis({ classification, riskTitles = [] } = {}) {
  const key = String(classification?.key || 'general').trim();
  const primaryFamilyKey = String(classification?.primaryFamily?.key || '').trim();
  if (primaryFamilyKey === 'identity_compromise') return 'The main chain is identity compromise, privileged access abuse, and downstream control disruption, fraud, or data exposure. Keep only the risks that share that same event path.';
  if (primaryFamilyKey === 'availability_attack') return 'The main chain is hostile traffic saturation of an internet-facing service, followed by customer-facing slowdown or outage. Keep only the risks that share that same event path and recovery burden.';
  if (primaryFamilyKey === 'payment_control_failure') return 'The main chain is payment-control weakness, an approval or release failure, and direct monetary loss. Keep only the risks that share that same control-failure path.';
  if (primaryFamilyKey === 'delivery_slippage' || primaryFamilyKey === 'programme_delivery_slippage') return 'The main chain is supplier or dependency slippage delaying delivery, deployment, or dependent work. Keep only the risks that share that same delivery path.';
  if (primaryFamilyKey === 'privacy_non_compliance') return 'The main chain is a privacy or data-protection obligation failure, the resulting control challenge, and likely regulatory or legal follow-up. Keep only the risks that share that event path.';
  if (primaryFamilyKey === 'forced_labour_modern_slavery') return 'The main chain is a human-rights issue in a supplier or workforce context, followed by remediation, scrutiny, and governance challenge. Keep only the risks that share that path.';
  if (key === 'operational' || key === 'business-continuity') return 'The main chain is process or service disruption, recovery pressure, and wider operational consequences. Keep only the risks that share that path.';
  if (key === 'transformation-delivery') return 'The main chain is dependency slippage, delayed delivery, and wider execution pressure. Keep only the risks that share that path.';
  if (key === 'procurement') return 'The main chain is sourcing or supplier-governance weakness, commercial downside, and assurance pressure. Keep only the risks that share that path.';
  if (key === 'financial') return 'The main chain is financial-control or counterparty weakness, direct loss, and delayed detection or recovery. Keep only the risks that share that path.';
  if (key === 'compliance' || key === 'regulatory') return 'The main chain is obligation or control failure, remediation burden, and regulator or assurance challenge. Keep only the risks that share that path.';
  if ((Array.isArray(riskTitles) ? riskTitles.length : 0) > 1) {
    return 'Several selected risks appear capable of cascading together. Keep only the risks that clearly belong in the same event path and business consequence chain.';
  }
  return 'A single primary risk driver was identified from the intake. Keep only the risk that best represents the same scenario and business consequence.';
}

function buildClassificationAnchor(classification = {}) {
  return {
    domain: String(classification?.domain || '').trim(),
    primaryFamily: String(classification?.primaryFamily?.key || '').trim(),
    secondaryFamilies: Array.isArray(classification?.secondaryFamilies)
      ? classification.secondaryFamilies.map((family) => family?.key).filter(Boolean)
      : [],
    overlays: Array.isArray(classification?.overlays)
      ? classification.overlays.map((overlay) => overlay?.key).filter(Boolean)
      : [],
    mechanisms: Array.isArray(classification?.mechanisms)
      ? classification.mechanisms.map((mechanism) => mechanism?.key).filter(Boolean)
      : [],
    confidence: Number(classification?.confidenceScore || classification?.confidence || 0),
    confidenceBand: String(classification?.confidenceBand || '').trim(),
    reasonCodes: Array.isArray(classification?.reasonCodes) ? classification.reasonCodes.slice(0, 8) : [],
    ambiguityFlags: Array.isArray(classification?.ambiguityFlags) ? classification.ambiguityFlags.slice(0, 6) : []
  };
}

function buildPromptSection(label = '', value = '', {
  maxChars = 600
} = {}) {
  const heading = String(label || '').trim();
  const body = truncateText(normaliseBlockInputText(value || ''), maxChars);
  if (!heading || !body) return '';
  return `${heading}:\n${body}`;
}

function buildGuidedScenarioContextPromptBlock(settings = {}, businessUnit = null) {
  const obligationBlock = buildResolvedObligationPromptBlock(settings);
  return [
    buildPromptSection('Live business-unit context', settings?.businessUnitContext || '', { maxChars: 640 }),
    buildPromptSection('Live function context', settings?.departmentContext || '', { maxChars: 520 }),
    buildPromptSection('Resolved obligation basis', obligationBlock, { maxChars: 960 }),
    buildPromptSection('Inherited organisation context', settings?.inheritedContextSummary || '', { maxChars: 560 }),
    buildPromptSection('User-specific working context', settings?.personalContextSummary || '', { maxChars: 360 }),
    buildPromptSection('Selected department context', businessUnit?.selectedDepartmentContext || '', { maxChars: 360 })
  ].filter(Boolean).join('\n\n') || '(no additional live BU/function/user context provided)';
}

function buildGuidedScenarioEvidencePromptBlock(evidenceMeta = {}) {
  const summary = [
    String(evidenceMeta?.promptBlock || '').trim(),
    Array.isArray(evidenceMeta?.missingInformation) && evidenceMeta.missingInformation.length
      ? `Known evidence gaps: ${evidenceMeta.missingInformation.slice(0, 2).join(' ')}`
      : ''
  ].filter(Boolean).join('\n');
  return truncateText(summary, 720) || '(no evidence summary available)';
}

function buildScenarioCitationRankingContext({
  citations = [],
  seedNarrative = '',
  input = {},
  classification = {}
} = {}) {
  const anchorGroups = buildGuidedDraftAnchorGroups(input, seedNarrative);
  const primaryFamily = classification?.primaryFamily || null;
  const secondaryFamilies = Array.isArray(classification?.secondaryFamilies) ? classification.secondaryFamilies.filter(Boolean) : [];
  const familyThemePhrases = uniqueKeys([
    ...collectFamilyThemePhrases(primaryFamily),
    ...secondaryFamilies.flatMap((family) => collectFamilyThemePhrases(family).slice(0, 6))
  ]);
  const mechanismThemePhrases = collectMechanismThemePhrases(
    uniqueKeys([
      ...(Array.isArray(classification?.mechanisms) ? classification.mechanisms.map((mechanism) => mechanism?.key) : []),
      ...(Array.isArray(primaryFamily?.defaultMechanisms) ? primaryFamily.defaultMechanisms : [])
    ])
  );
  return {
    citations: Array.isArray(citations) ? citations : [],
    anchorGroups,
    familyThemePhrases,
    mechanismThemePhrases,
    primaryFamilyLabel: String(primaryFamily?.label || '').trim(),
    primaryFamilyKey: String(primaryFamily?.key || '').trim()
  };
}

function scoreScenarioCitationForPrompt(citation = {}, rankingContext = {}) {
  const text = [
    citation?.title,
    citation?.relevanceReason,
    citation?.excerpt,
    citation?.description,
    citation?.note
  ].map((value) => String(value || '').trim()).filter(Boolean).join('. ');
  const anchorMetrics = scoreGuidedDraftAnchorGroups(text, rankingContext.anchorGroups || {});
  const familyThemeOverlap = countPhraseMatches(text, rankingContext.familyThemePhrases || []);
  const mechanismThemeOverlap = countPhraseMatches(text, rankingContext.mechanismThemePhrases || []);
  const familyLabelOverlap = rankingContext.primaryFamilyLabel
    ? countPhraseMatches(text, [rankingContext.primaryFamilyLabel])
    : 0;
  const baseScore = Number(citation?.score || 0);
  const directEventMatch = anchorMetrics.eventOverlap > 0 || anchorMetrics.causeOverlap > 0 || anchorMetrics.assetOverlap > 0;
  const eventGroupCoverage = [anchorMetrics.eventOverlap > 0, anchorMetrics.causeOverlap > 0, anchorMetrics.assetOverlap > 0].filter(Boolean).length;
  const genericGovernanceOnly = /(governance|policy|oversight|committee|assurance|generic|planning note|governance note|review only)/i.test(text)
    && !directEventMatch
    && mechanismThemeOverlap === 0
    && familyThemeOverlap === 0;
  let score = 0;
  score += anchorMetrics.eventOverlap * 16;
  score += anchorMetrics.causeOverlap * 12;
  score += anchorMetrics.assetOverlap * 10;
  score += anchorMetrics.impactOverlap * 5;
  score += anchorMetrics.narrativeOverlap * 6;
  score += anchorMetrics.criticalOverlap * 8;
  score += eventGroupCoverage * 10;
  score += mechanismThemeOverlap * 6;
  score += familyThemeOverlap * 5;
  score += familyLabelOverlap * 4;
  score += Math.min(10, baseScore);
  if (!directEventMatch && anchorMetrics.totalOverlap === 0) score -= 18;
  if (genericGovernanceOnly) score -= 28;
  return {
    score,
    anchorMetrics,
    familyThemeOverlap,
    mechanismThemeOverlap,
    familyLabelOverlap,
    genericGovernanceOnly
  };
}

function rankScenarioCitationsForPrompt(citations = [], options = {}) {
  const rankingContext = buildScenarioCitationRankingContext({
    citations,
    ...options
  });
  return rankingContext.citations
    .map((citation, index) => ({
      citation,
      index,
      ranking: scoreScenarioCitationForPrompt(citation, rankingContext)
    }))
    .sort((left, right) => (
      right.ranking.score - left.ranking.score
      || Number(right.citation?.score || 0) - Number(left.citation?.score || 0)
      || left.index - right.index
    ));
}

function buildGuidedCitationPromptBlock(citations = [], {
  limit = 4,
  seedNarrative = '',
  input = {},
  classification = {}
} = {}) {
  const items = rankScenarioCitationsForPrompt(citations, {
    seedNarrative,
    input,
    classification
  })
    .map(({ citation: item }, index) => {
      const title = String(item?.title || item?.note || `Reference ${index + 1}`).trim();
      const excerpt = truncateText(item?.excerpt || item?.description || item?.note || '', 180);
      const reason = truncateText(item?.relevanceReason || '', 120);
      return [`- ${title}`, reason ? `why used: ${reason}` : '', excerpt ? `summary: ${excerpt}` : ''].filter(Boolean).join(' | ');
    })
    .filter(Boolean)
    .slice(0, limit);
  return items.length ? items.join('\n') : '(no external citations available)';
}

function hasGenericGovernanceShortlistWording(risk = {}) {
  const title = String(risk?.title || '').trim();
  const category = String(risk?.category || '').trim();
  const description = String(risk?.description || '').trim();
  const titleText = `${title}. ${category}`.trim();
  const titleGovernance = /(governance|policy|oversight|committee|assurance|remediation|review|playbook|training|awareness|standard)/i.test(titleText);
  const eventPathTerms = /(credential|identity|tenant|configuration|outage|flood|traffic|availability|supplier|vendor|delivery|rollout|privacy|retention|transfer|fatigue|staff|labou?r|slavery|greenwashing|claims|safety|injury|payment|invoice|fraud|receivable|counterparty|environment|spill|control)/i.test(titleText);
  const descriptionEventTerms = /(credential|identity|tenant|configuration|outage|flood|traffic|availability|supplier|vendor|delivery|rollout|privacy|retention|transfer|fatigue|staff|labou?r|slavery|greenwashing|claims|safety|injury|payment|invoice|fraud|receivable|counterparty|environment|spill|control)/i.test(description);
  return titleGovernance && !eventPathTerms && !descriptionEventTerms;
}

function hasConsequenceDominantShortlistWording(risk = {}) {
  const title = String(risk?.title || '').trim();
  const category = String(risk?.category || '').trim();
  const description = String(risk?.description || '').trim();
  const titleText = `${title}. ${category}`.trim();
  const consequenceLead = /(reputational damage|reputation harm|regulatory scrutiny|legal exposure|financial loss|monetary loss|customer attrition|customer confidence loss|investor pressure|board pressure|management pressure|media scrutiny|external scrutiny|penalties?|fines?|litigation|lawsuits?|remediation costs?|stakeholder pressure|negative publicity)/i.test(titleText);
  const titleMechanismTerms = /(credential|identity|tenant|configuration|privileged access|hostile traffic|ddos|flood|supplier|vendor|delivery|rollout|retention|processing|transfer|records|dataset|privacy|lawful basis|fatigue|understaff|burnout|forced labou?r|slavery|claim substantiation|payment|invoice|receivable|counterparty|insolvency|shared support account|vendor access|remote access|failover|disaster recovery|manual fallback|platform defect|intrusion|perimeter|exfiltration|ransomware|encrypt|utility outage|relocation)/i.test(titleText);
  const descriptionMechanismTerms = /(credential|identity|tenant|configuration|privileged access|hostile traffic|ddos|supplier|vendor|delivery|rollout|retention|processing|transfer|records|dataset|privacy|lawful basis|fatigue|understaff|burnout|forced labou?r|slavery|claim substantiation|payment|invoice|receivable|counterparty|insolvency|shared support account|vendor access|remote access|failover|disaster recovery|manual fallback|platform defect|intrusion|perimeter|exfiltration|ransomware|encrypt|utility outage|relocation)/i.test(description);
  const descriptionConsequenceOnly = /(reputational damage|regulatory scrutiny|legal exposure|financial loss|monetary loss|customer attrition|customer confidence|investor pressure|board pressure|management pressure|penalties?|fines?|litigation|lawsuits?|remediation costs?)/i.test(description);
  return consequenceLead && !titleMechanismTerms && (!descriptionMechanismTerms || descriptionConsequenceOnly);
}

function buildGuidedScenarioPriorityPromptBlock(input = {}, {
  seedNarrative = '',
  classification = {}
} = {}) {
  const anchorGroups = buildGuidedDraftAnchorGroups(input, seedNarrative);
  return [
    'Priority details to preserve:',
    input?.guidedInput?.event
      ? `- Event path: ${cleanUserFacingText(input.guidedInput.event, { maxSentences: 1 })}`
      : (seedNarrative ? `- Event path: ${cleanUserFacingText(seedNarrative, { maxSentences: 1 })}` : ''),
    input?.guidedInput?.cause
      ? `- Trigger or cause: ${cleanUserFacingText(input.guidedInput.cause, { maxSentences: 1, stripTrailingPeriod: true })}`
      : '',
    input?.guidedInput?.asset
      ? `- Affected asset or service: ${cleanUserFacingText(input.guidedInput.asset, { maxSentences: 1, stripTrailingPeriod: true })}`
      : '',
    input?.guidedInput?.impact
      ? `- Main impact: ${cleanUserFacingText(input.guidedInput.impact, { maxSentences: 1 })}`
      : '',
    anchorGroups.critical.length
      ? `- Anchor terms to preserve when still accurate: ${anchorGroups.critical.join(', ')}`
      : '',
    `Accepted taxonomy anchor:\n${JSON.stringify(buildClassificationAnchor(classification), null, 2)}`
  ].filter(Boolean).join('\n');
}

function buildFallbackRiskCards(classification = {}, input = {}) {
  const regulations = Array.from(new Set((Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).map(String).filter(Boolean))).slice(0, 4);
  const intakeText = [
    input.riskStatement,
    input.guidedInput?.event,
    input.guidedInput?.asset,
    input.guidedInput?.cause,
    input.guidedInput?.impact
  ].filter(Boolean).join(' ').toLowerCase();
  const primaryFamilyKey = String(classification?.primaryFamily?.key || '').trim();
  if (primaryFamilyKey === 'identity_compromise') {
    return [
      { title: 'Privileged account takeover through identity compromise', category: 'Identity & Access', description: 'Compromised administrator or federated credentials could allow account takeover, privilege escalation, and control disruption across the tenant.' },
      { title: 'Unauthorized configuration changes after privileged access abuse', category: 'Cyber', description: 'An attacker with elevated access could change identity, tenant, or security controls and destabilise normal operating access.' },
      { title: 'Data exposure or downstream control escalation after identity takeover', category: 'Cyber', description: 'Once the identity path is compromised, the same foothold can support mailbox misuse, unauthorised workflow manipulation, or explicit data extraction.' }
    ];
  }
  if (primaryFamilyKey === 'availability_attack') {
    return [
      { title: 'Website service outage from traffic flooding', category: 'Cyber', description: 'Malicious traffic or botnet activity can overwhelm a public-facing website or online service until legitimate users are locked out or severely slowed down.' },
      { title: 'Customer-facing availability disruption during hostile traffic saturation', category: 'Operational Resilience', description: 'A sustained denial-of-service event can degrade core digital journeys, trigger support pressure, and disrupt normal service commitments.' },
      { title: 'Recovery strain and backlog growth after service saturation', category: 'Business Continuity', description: 'Once services are slowed or unavailable, mitigation, customer backlog, and recovery pressure can grow faster than teams can absorb.' }
    ];
  }
  if (primaryFamilyKey === 'payment_control_failure') {
    return [
      { title: 'Unauthorized funds transfer through payment-control weakness', category: 'Financial', description: 'Weak payment approval or release controls can allow an unauthorized transfer, direct loss, and a broader control challenge.' },
      { title: 'Control-breakdown exposure in the payment approval path', category: 'Compliance', description: 'Once the payment failure is visible, management may face scrutiny over segregation, approval evidence, and the wider control environment.' }
    ];
  }
  if (primaryFamilyKey === 'privacy_non_compliance') {
    return [
      { title: 'Privacy obligation failure in processing or retention controls', category: 'Compliance', description: 'A breach of privacy or data-protection obligations can create immediate remediation pressure over how data was processed, retained, or governed.' },
      { title: 'Regulatory or legal exposure after privacy non-compliance', category: 'Regulatory', description: 'Once the issue is visible, regulators or counsel may challenge the control basis, notifications, and evidence of lawful processing.' }
    ];
  }
  if (primaryFamilyKey === 'delivery_slippage' || primaryFamilyKey === 'programme_delivery_slippage') {
    return [
      { title: 'Supplier delivery slippage delaying dependent deployment', category: 'Supply Chain', description: 'A committed supplier miss can push back deployment activity, dependent milestones, and business readiness across the wider programme.' },
      { title: 'Backlog and execution pressure from delayed delivery dependencies', category: 'Transformation Delivery', description: 'Once a key dependency slips, downstream workarounds, re-sequencing, and backlog pressure can grow across dependent projects.' }
    ];
  }
  if (primaryFamilyKey === 'forced_labour_modern_slavery') {
    return [
      { title: 'Human-rights and supplier-remediation pressure after labour abuse findings', category: 'ESG', description: 'Forced-labour or modern-slavery findings can trigger urgent remediation, board attention, and challenge over supplier governance.' },
      { title: 'Third-party governance failure exposing the supply base', category: 'Third-party', description: 'The same event can expose a wider supplier-control weakness if due diligence, oversight, or escalation did not surface the issue sooner.' }
    ];
  }
  const byKey = {
    identity: [
      { title: 'Privileged account takeover through identity platform compromise', category: 'Identity & Access', description: 'Compromised administrator or federated credentials could allow account takeover, privilege escalation, and control disruption.' },
      { title: 'Business email compromise enabled by mailbox access', category: 'Financial Crime', description: 'Mailbox access can support fraud, executive impersonation, and manipulation of approvals or supplier instructions.' },
      { title: 'Administrative lockout or unauthorised tenant changes', category: 'Operational Resilience', description: 'An attacker with elevated access could change identity or tenant controls and disrupt normal user access and response operations.' }
    ],
    ransomware: [
      { title: 'Ransomware disruption of critical services', category: 'Cyber', description: 'A successful ransomware event could encrypt critical services and disrupt operations while recovery work is underway.' },
      { title: 'Data theft and extortion pressure after compromise', category: 'Cyber', description: 'The same incident could escalate into data theft and extortion pressure if the attacker can access sensitive information before encryption.' }
    ],
    cloud: [
      { title: 'Cloud control weakness leading to exposure or misuse', category: 'Cyber', description: 'Weak cloud administration or access controls could enable unauthorised changes, exposure, or misuse of the hosted service.' },
      { title: 'Service disruption during cloud recovery or control reset', category: 'Operational', description: 'Recovery from a cloud control event can create disruption while administrators restore trust in the environment.' }
    ],
    'availability-attack': [
      { title: 'Internet-facing service outage from traffic flooding', category: 'Cyber', description: 'Malicious traffic or botnet activity can overwhelm a public-facing website or online service until legitimate users are locked out or severely slowed down.' },
      { title: 'Customer-facing disruption during availability attack', category: 'Operational Resilience', description: 'A sustained denial-of-service event can degrade core digital journeys, trigger support pressure, and disrupt normal service commitments.' },
      { title: 'Recovery strain and backlog growth after service saturation', category: 'Business Continuity', description: 'Once services are slowed or unavailable, incident response, mitigation, and customer backlog can grow faster than the team can recover them.' }
    ],
    operational: [
      { title: 'Operational disruption across the affected service path', category: 'Operational', description: 'A breakdown in the current operating path could create service instability, manual workarounds, and management escalation.' },
      { title: 'Recovery strain and backlog growth after disruption', category: 'Business Continuity', description: 'Once disruption starts, backlog, error rates, and recovery burden can grow faster than management expects.' }
    ],
    'business-continuity': [
      { title: 'Business continuity and recovery failure', category: 'Business Continuity', description: 'Weak continuity planning or failover readiness could turn a contained incident into a prolonged service disruption.' },
      { title: 'Extended outage from missing fallback operations', category: 'Operational Resilience', description: 'When fallback operations are not ready, service restoration can take longer than management expects.' }
    ],
    'transformation-delivery': [
      { title: 'Programme delay from a delivery-critical supplier dependency', category: 'Transformation Delivery', description: 'A committed delivery miss can push back deployment activity and delay dependent projects or business milestones.' },
      { title: 'Supply dependency delay affecting deployment timing', category: 'Supply Chain', description: 'A late supplier delivery can create knock-on timing pressure across downstream projects, workarounds, and sequencing decisions.' }
    ],
    procurement: [
      { title: 'Commercial leakage from weak sourcing governance', category: 'Procurement', description: 'Weak supplier selection or contract governance can create avoidable cost, dependency risk, or assurance pressure.' },
      { title: 'Supplier-fit weakness affecting delivery or controls', category: 'Third-party', description: 'A poor procurement decision can surface later as service strain, delivery weakness, or weak third-party controls.' }
    ],
    'supply-chain': [
      { title: 'Critical supply dependency disruption', category: 'Supply Chain', description: 'A weak or late upstream dependency can disrupt delivery plans and create broader continuity pressure.' },
      { title: 'Knock-on service strain from dependency failure', category: 'Operational', description: 'Once a critical dependency slips, downstream services and commitments may come under pressure quickly.' }
    ],
    financial: [
      { title: 'Direct financial loss from control or counterparty weakness', category: 'Financial', description: 'The event could create direct monetary loss, provisioning pressure, or delayed recovery of expected value.' },
      { title: 'Assurance and management pressure after financial exposure', category: 'Compliance', description: 'Financial events often trigger stronger control challenge, assurance pressure, and scrutiny over the original decision path.' }
    ],
    'fraud-integrity': [
      { title: 'Fraud or integrity-control failure', category: 'Fraud / Integrity', description: 'The event suggests a financial-crime, bribery, or approval-integrity weakness that could create direct loss and investigation pressure.' },
      { title: 'Investigation and remediation burden after integrity failure', category: 'Compliance', description: 'Once the issue is visible, management may face assurance, disciplinary, and regulatory follow-up.' }
    ],
    compliance: [
      { title: 'Compliance lapse creating remediation burden', category: 'Compliance', description: 'A control or obligation failure could create immediate remediation effort and challenge over how the issue was governed.' },
      { title: 'Assurance or regulatory scrutiny after the lapse', category: 'Regulatory', description: 'The same event could attract regulatory or internal assurance attention once it becomes visible.' }
    ],
    regulatory: [
      { title: 'Regulatory challenge triggered by the event', category: 'Regulatory', description: 'The event could surface as a regulator-facing issue requiring explanation, remediation, or formal response.' },
      { title: 'Management strain from remediation and control challenge', category: 'Compliance', description: 'Responding to the issue may consume management attention and require fast control remediation.' }
    ],
    'ai-model-risk': [
      { title: 'AI governance weakness causing unsafe or low-trust output', category: 'AI / Model Risk', description: 'Weak model governance or guardrails can create unsafe outputs, challenge over oversight, and remediation pressure.' },
      { title: 'Data or conduct risk from AI-enabled decisions', category: 'Compliance', description: 'The same model issue can create wider data, conduct, or regulatory exposure if it affects real decisions.' }
    ],
    'data-governance': [
      { title: 'Data governance weakness undermining reliable output', category: 'Data Governance', description: 'Weak lineage, retention, or approved-use control can create lower confidence in decisions or reporting.' },
      { title: 'Privacy or approved-use challenge from poor data control', category: 'Compliance', description: 'The same issue can become a privacy or governance concern when use and ownership are not clearly controlled.' }
    ],
    'third-party': [
      { title: 'Third-party dependency failure affecting delivery or control', category: 'Third-party', description: 'A supplier or partner weakness could create downstream operational, contractual, or control consequences.' },
      { title: 'Operational disruption from inherited supplier weakness', category: 'Operational', description: 'Once the dependency fails, management may face a broader disruption problem rather than a contained supplier issue.' }
    ],
    strategic: [
      { title: 'Strategic execution drift against the intended objective', category: 'Strategic', description: 'A weak strategic assumption or execution path can reduce value, delay benefits, and trigger management challenge.' },
      { title: 'Operational or financial drag from the same strategic issue', category: 'Operational', description: 'Strategic issues often surface first through delayed delivery, cost pressure, or underperformance in the operating model.' }
    ],
    esg: [
      { title: 'ESG disclosure or governance challenge', category: 'ESG', description: 'The event could trigger sustainability, human-rights, or disclosure challenge over how the issue was governed and evidenced.' },
      { title: 'Remediation and stakeholder scrutiny after ESG failure', category: 'Compliance', description: 'Once visible, the issue may require remediation, assurance work, and stronger management response to stakeholder pressure.' }
    ],
    geopolitical: [
      { title: 'Market-access or sanctions-driven execution pressure', category: 'Geopolitical', description: 'A cross-border restriction, sanctions condition, or tariff shift could delay execution and reduce operating flexibility.' },
      { title: 'Supply or delivery disruption from geopolitical change', category: 'Supply Chain', description: 'Policy or market-access changes can create knock-on supplier, routing, or delivery strain across the footprint.' }
    ],
    general: [
      { title: 'Material enterprise risk requiring structured assessment', category: 'General', description: 'The event path described by the user requires a focused structured assessment before it can be quantified credibly.' }
    ]
  };
  const risks = classification?.key === 'business-continuity'
    && hasCriticalMessagingServiceSignals(intakeText)
    && !hasExplicitCyberCompromiseSignals(intakeText)
    ? [
        { title: 'Email outage business disruption', category: 'Operational Resilience', description: 'Prolonged unavailability of the core email and communications service could disrupt coordination, approvals, and incident response activity.' },
        { title: 'Business continuity and recovery failure', category: 'Business Continuity', description: 'Without disaster recovery or failover for the messaging platform, recovery could take materially longer than expected.' },
        { title: 'Elevated response and recovery cost', category: 'Financial and Resource Impact', description: 'A prolonged recovery effort may require emergency tooling, specialist support, and diverted internal resources to restore service.' }
      ]
    : classification?.key === 'financial'
      && hasCounterpartyCreditSignals(intakeText)
      ? [
          { title: 'Counterparty default and bad-debt exposure', category: 'Financial', description: 'A client insolvency or payment default could force a material write-off and a reassessment of expected recoveries.' },
          { title: 'Receivables recovery shortfall after customer insolvency', category: 'Financial', description: 'Collections may deteriorate quickly once the customer fails, creating cashflow strain and weaker recovery than management expected.' },
          { title: 'Legal recovery or contractual claim uncertainty', category: 'Legal / Contract', description: 'Recovery may depend on the enforceability of payment terms, guarantees, or the speed of insolvency-related legal action.' }
        ]
      : classification?.key === 'esg'
        && hasSupplierLabourSignals(intakeText)
        ? [
            { title: 'Supplier labour-practice and due-diligence failure', category: 'ESG', description: 'Weak sub-tier oversight or sourcing due diligence may have allowed exploitative labour practices to persist inside the supply base.' },
            { title: 'ESG and human-rights disclosure or remediation exposure', category: 'ESG', description: 'Once abusive labour practices are identified, management may face disclosure, remediation, and stakeholder scrutiny over the wider operating model.' },
            { title: 'Regulatory or compliance action over supplier conduct', category: 'Compliance', description: 'Exploitative labour practices can trigger investigation, fines, contract challenge, and assurance pressure around supplier governance.' }
          ]
    : (byKey[classification?.key] || byKey.general);
  return risks.map((risk, index) => ({
    id: `server-fallback-risk-${index + 1}`,
    title: risk.title,
    category: risk.category,
    description: risk.description,
    source: 'ai',
    confidence: 'medium',
    regulations
  }));
}

function buildScenarioExpansion(input = {}, classification = classifyScenario(input.riskStatement || '', input)) {
  const statement = stripScenarioLeadIns(cleanScenarioSeed(input.riskStatement || ''));
  const businessUnit = String(input.businessUnit?.name || 'the business unit').trim();
  const geography = joinList(String(input.geography || '').split(',').map((item) => item.trim()).filter(Boolean)) || 'the selected geography';
  const asset = cleanUserFacingText(String(input.guidedInput?.asset || '').trim(), { maxSentences: 1, stripTrailingPeriod: true });
  const cause = cleanUserFacingText(String(input.guidedInput?.cause || '').trim(), { maxSentences: 1, stripTrailingPeriod: true });
  const impact = cleanUserFacingText(String(input.guidedInput?.impact || '').trim(), { maxSentences: 1, stripTrailingPeriod: true });
  const urgency = String(input.guidedInput?.urgency || 'medium').trim().toLowerCase();
  const intakeText = [statement, asset, cause, impact].filter(Boolean).join(' ').toLowerCase();
  const primaryFamilyKey = String(classification?.primaryFamily?.key || '').trim();

  let scenarioExpansion = ensureSentence(statement) || buildScenarioLead({ geography, businessUnit });

  if (primaryFamilyKey === 'identity_compromise') {
    scenarioExpansion = [
      buildScenarioLead({
        geography,
        businessUnit,
        asset: asset || 'the identity platform',
        cause: cause || 'targeted credential theft or session hijack',
        impact: impact || 'operational disruption, fraud, and regulatory exposure',
        scenarioLabel: 'identity compromise'
      }),
      'The most likely progression is account takeover, privileged escalation, and unauthorised access to email, collaboration tools, cloud administration, and other federated business services.',
      ['high', 'critical'].includes(urgency)
        ? 'This should be treated as an active material scenario requiring rapid containment, privileged-account review, and assessment of downstream operational and financial exposure.'
        : 'This should be assessed as a gateway scenario that can trigger fraud, service disruption, data exposure, and regulatory consequences across connected services.'
    ].join(' ');
  } else if (primaryFamilyKey === 'availability_attack') {
    scenarioExpansion = [
      buildScenarioLead({
        geography,
        businessUnit,
        asset: asset || 'the public website or online service',
        cause: cause || 'hostile traffic flooding or denial-of-service activity',
        impact: impact || 'customer-facing slowdown, outage, and recovery strain',
        scenarioLabel: 'cyber availability attack scenario'
      }),
      'The most likely progression is malicious traffic saturating internet-facing services until legitimate users experience severe slowdown, service failure, or full unavailability.',
      'This should be assessed for customer-facing outage, mitigation and response strain, backlog growth, and whether recovery controls can restore availability before wider business disruption escalates.'
    ].join(' ');
  } else if (classification.key === 'business-continuity') {
    if (hasCriticalMessagingServiceSignals(intakeText) && !hasExplicitCyberCompromiseSignals(intakeText)) {
      scenarioExpansion = [
        buildScenarioLead({
          geography,
          businessUnit,
          asset: asset || 'the critical email and communications service',
          cause: cause || 'missing disaster recovery or failover capability',
          impact: impact || 'prolonged service outage and delayed recovery',
          scenarioLabel: 'business continuity risk scenario'
        }),
        'The most likely progression is a failure in the core messaging service outlasting normal incident handling because recovery, failover, or fallback communications are not ready.',
        'This should be assessed for business disruption, delayed decision-making, recovery pressure, and whether the lack of continuity cover turns a manageable outage into a wider resilience failure.'
      ].join(' ');
    } else {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the recovery-critical service or process', cause: cause || 'weak continuity or recovery execution', impact: impact || 'extended outage and recovery pressure', scenarioLabel: 'business continuity risk scenario' }),
        'The most likely progression is an incident outlasting recovery assumptions, exposing gaps in continuity planning, fallback operations, communications, and executive decision-making.',
        'This should be assessed for downtime, missed recovery objectives, workaround viability, and the cost of prolonged disruption.'
      ].join(' ');
    }
  } else if (classification.key === 'operational') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the affected operating process or service', cause: cause || 'process breakdown or control failure', impact: impact || 'service degradation and execution strain', scenarioLabel: 'operational risk scenario' }),
      'The most likely progression is control weakness, workflow failure, or backlog growth driving service deterioration, manual workarounds, increased error rates, and management escalation.',
      'This should be assessed for direct disruption, recovery effort, customer or internal stakeholder impact, and the risk of secondary compliance or continuity consequences.'
    ].join(' ');
  } else if (primaryFamilyKey === 'delivery_slippage') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the supplier delivery path or deployment dependency in scope', cause: cause || 'supplier delivery slippage against a committed date or milestone', impact: impact || 'delayed deployment, dependent project slippage, and operational knock-on pressure', scenarioLabel: 'supply-chain delivery scenario' }),
      'The most likely progression is a supplier miss delaying deployment activity, dependent projects, sequencing decisions, and business readiness while management searches for workarounds or substitute delivery paths.',
      'This should be assessed for milestone impact, backlog growth, third-party dependency, and whether the delay is now becoming a broader execution issue.'
    ].join(' ');
  } else if (primaryFamilyKey === 'payment_control_failure') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the payment approval and release path in scope', cause: cause || 'weak approval, segregation, or payment-release controls', impact: impact || 'unauthorised funds transfer and direct monetary loss', scenarioLabel: 'payment-control failure scenario' }),
      'The most likely progression is a payment or treasury control weakness allowing funds to be released incorrectly, followed by delayed detection, investigation, and challenge over the wider control environment.',
      'This should be assessed for direct loss, control breakdown, recoverability, and whether the issue could escalate into regulatory, legal, or fraud-related follow-up.'
    ].join(' ');
  } else if (primaryFamilyKey === 'privacy_non_compliance' || primaryFamilyKey === 'records_retention_non_compliance' || primaryFamilyKey === 'cross_border_transfer_non_compliance') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the personal-data process or governed records path in scope', cause: cause || 'privacy or data-protection obligation failure', impact: impact || 'regulatory scrutiny, remediation burden, and legal exposure', scenarioLabel: 'privacy compliance scenario' }),
      'The most likely progression is an obligation or governance failure in how data is processed, retained, transferred, or controlled, followed by remediation work, assurance pressure, and legal or supervisory challenge.',
      'This should be assessed for the strength of the legal basis, evidence of control, scope of affected processing, and whether explicit data exposure also occurred.'
    ].join(' ');
  } else if (classification.key === 'transformation-delivery') {
    if (/(supplier|vendor|third party|third-party)/.test(intakeText)
      && /(delivery date|delivery commitment|delay|delayed|deployment|go-live|rollout|milestone|dependent business project|dependent project|programme|program|project)/.test(intakeText)
      && !/procurement|sourcing|tender|bid|contract award|vendor selection|critical spend|single[- ]source|sole source|concentration/.test(intakeText)) {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the delivery-critical supplier dependency and deployment plan in scope', cause: cause || 'supplier delivery slippage against a committed milestone or deployment date', impact: impact || 'deployment delay, downstream project slippage, and pressure on business commitments', scenarioLabel: 'supplier-dependent delivery scenario' }),
        'The most likely progression is a supplier miss pushing back deployment activity, creating knock-on delay across dependent projects, re-sequencing pressure for the programme, and harder management decisions over workaround or fallback options.',
        'This should be assessed for milestone slippage, downstream operational impact, workaround cost, and whether a delivery dependency that looked manageable is now becoming a wider execution problem.'
      ].join(' ');
    } else {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the programme roadmap or delivery-critical dependency in scope', cause: cause || 'weak programme governance, ownership, or milestone control', impact: impact || 'delay, rising cost, and missed benefits', scenarioLabel: 'transformation delivery scenario' }),
        'The most likely progression is slippage in dependencies or decision-making turning into delayed milestones, weakened confidence, and a harder path to the intended operating change.',
        'This should be assessed for delivery pressure, benefit delay, management bandwidth, and whether the transformation is now creating operational strain while it slips.'
      ].join(' ');
    }
  } else if (classification.key === 'procurement') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the sourcing or procurement decision', cause: cause || 'weak procurement governance or supplier selection', impact: impact || 'commercial leakage and dependency risk', scenarioLabel: 'procurement risk scenario' }),
      'The most likely progression is weak sourcing governance, contract control failure, or poor supplier fit leading to commercial downside, assurance gaps, or downstream service issues.',
      'This should be assessed for commercial exposure, control weakness, supplier dependence, and whether the decision creates broader compliance or continuity risk.'
    ].join(' ');
  } else if (classification.key === 'financial') {
    if (hasCounterpartyCreditSignals(intakeText)) {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the customer exposure, receivables position, or commercial counterparty relationship in scope', cause: cause || 'customer insolvency, payment default, or weakening collectability', impact: impact || 'bad-debt write-off and cashflow strain', scenarioLabel: 'counterparty-credit risk scenario' }),
        'The most likely progression is a major client failure reducing collectability, forcing provisioning or write-off decisions, and escalating management scrutiny over concentration, recovery options, and the speed of financial response.',
        'This should be assessed for direct loss, collections recovery, working-capital strain, and whether legal or contractual action can materially reduce the downside.'
      ].join(' ');
    } else {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the affected financial process or exposure', cause: cause || 'fraud, financial control weakness, or commercial failure', impact: impact || 'direct financial loss and control pressure', scenarioLabel: 'financial risk scenario' }),
        'The most likely progression is payment manipulation, weak approvals, or financial-control failure leading to direct loss, delayed detection, escalation, and remediation work.',
        'This should be assessed for direct loss, control weakness, liquidity or capital impact, and any related regulatory or stakeholder consequences.'
      ].join(' ');
    }
  } else if (classification.key === 'regulatory') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the regulated activity or obligation', cause: cause || 'a breach of regulatory or licence requirements', impact: impact || 'enforcement and remediation exposure', scenarioLabel: 'regulatory risk scenario' }),
      'The most likely progression is a control or reporting failure triggering regulator attention, remediation demands, management scrutiny, and downstream cost or licensing pressure.',
      'This should be assessed for enforcement likelihood, remediation effort, operational interruption, and whether the issue could cascade into reputational or financial damage.'
    ].join(' ');
  } else if (classification.key === 'compliance') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the control framework or obligation', cause: cause || 'policy non-compliance or weak assurance', impact: impact || 'remediation and assurance pressure', scenarioLabel: 'compliance risk scenario' }),
      'The most likely progression is policy or control weakness surfacing through assurance, incident response, or management review, creating remediation burden and weaker trust in the control environment.',
      'This should be assessed for remediation cost, assurance impact, disciplinary or legal consequences, and any linked regulatory exposure.'
    ].join(' ');
  } else if (classification.key === 'cloud') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the exposed cloud service', cause: cause || 'cloud misconfiguration or weak access control', impact: impact || 'data exposure and operational recovery effort', scenarioLabel: 'cloud exposure' }),
      'The most likely progression is unauthorised discovery, misuse of cloud services, or persistence through compromised credentials or automation, followed by delayed detection caused by fragmented ownership.',
      'This should be assessed for operational recovery effort, regulatory response, and reputational consequences.'
    ].join(' ');
  } else if (classification.key === 'ai-model-risk') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the AI-enabled workflow or model in scope', cause: cause || 'weak model governance, guardrails, or monitoring', impact: impact || 'unsafe or low-trust outputs and regulatory challenge', scenarioLabel: 'AI or model-risk scenario' }),
      'The most likely progression is poor model behaviour, delayed challenge, or weak human oversight turning into unsafe decisions, remediation work, and pressure to explain how the model was governed.',
      'This should be assessed for decision quality, governance strength, stakeholder trust, and whether data, conduct, or regulatory consequences could follow once the issue becomes visible.'
    ].join(' ');
  } else if (classification.key === 'data-governance') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the dataset, reporting flow, or analytics environment in scope', cause: cause || 'weak data ownership, retention, or lineage control', impact: impact || 'privacy challenge and lower confidence in downstream analytics', scenarioLabel: 'data-governance scenario' }),
      'The most likely progression is poor lineage, approved-use drift, or retention weakness creating privacy pressure, remediation work, and management challenge over how the data was governed.',
      'This should be assessed for privacy exposure, data-control remediation, and whether the issue undermines the reliability of reporting or AI built on the same data.'
    ].join(' ');
  } else if (classification.key === 'third-party' || classification.key === 'supply-chain') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'a critical supplier-dependent service', cause: cause || 'third-party failure or compromise', impact: impact || 'operational disruption and commercial exposure', scenarioLabel: 'third-party disruption' }),
      'The most likely progression is service dependency failure, inherited control weakness, or privileged supplier access creating operational, data, and contractual consequences across connected processes.',
      'This should be assessed for immediate disruption as well as follow-on regulatory, commercial, and assurance impacts.'
    ].join(' ');
  } else if (classification.key === 'esg') {
    if (hasSupplierLabourSignals(intakeText)) {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the sourcing category or supplier relationship in scope', cause: cause || 'weak sub-tier supplier oversight or delayed detection of exploitative labour practices', impact: impact || 'remediation cost, stakeholder scrutiny, and governance pressure', scenarioLabel: 'ESG and human-rights scenario' }),
        'The most likely progression is discovery of abusive labour conditions in the supply base, followed by urgent due-diligence review, supplier remediation decisions, and challenge over how the relationship was governed.',
        'This should be assessed for remediation credibility, disclosure pressure, supplier continuity, and whether management can evidence a defensible human-rights response.'
      ].join(' ');
    } else {
      scenarioExpansion = [
        buildScenarioLead({ geography, businessUnit, asset: asset || 'the sustainability commitment or disclosure area', cause: cause || 'weak ESG controls or disclosure assumptions', impact: impact || 'stakeholder, disclosure, and remediation pressure', scenarioLabel: 'ESG risk scenario' }),
        'The most likely progression is a performance or disclosure gap becoming visible to regulators, investors, employees, or customers, with management forced into reactive remediation.',
        'This should be assessed for reporting credibility, remediation cost, stakeholder trust, and whether wider governance or operational issues are exposed.'
      ].join(' ');
    }
  } else if (classification.key === 'strategic') {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset: asset || 'the strategic initiative or business objective', cause: cause || 'strategy execution weakness or market shift', impact: impact || 'material pressure on objectives and value creation', scenarioLabel: 'strategic risk scenario' }),
      'The most likely progression is a weak strategic assumption, delayed response, or execution gap turning into missed objectives, financial drag, stakeholder pressure, and a harder recovery path.',
      'This should be assessed for strategic downside, cost of correction, management bandwidth, and how quickly the issue could spill into operational, regulatory, or reputational consequences.'
    ].join(' ');
  } else {
    scenarioExpansion = [
      buildScenarioLead({ geography, businessUnit, asset, cause, impact, scenarioLabel: 'risk scenario' }),
      ensureSentence(statement)
    ].join(' ');
  }

  const riskTitles = buildFallbackRiskCards(classification, input);
  return {
    scenarioExpansion: dedupeSentences(scenarioExpansion),
    summary: buildRiskContextSummary({ classification, asset, impact, riskTitles }),
    riskTitles
  };
}

function cleanScenarioSeed(statement = '') {
  const raw = String(statement || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const sentences = raw.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const seen = new Set();
  const filtered = sentences.filter((sentence) => {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    if (/^in .*faces a material .*scenario in which/i.test(sentence)) return false;
    if (/^this scenario should be assessed/i.test(sentence)) return false;
    if (/^a likely progression is/i.test(sentence)) return false;
    if (/^in practice, this can drive/i.test(sentence)) return false;
    if (/^given the stated urgency/i.test(sentence)) return false;
    if (/^current urgency is assessed as /i.test(sentence)) return false;
    return true;
  });
  return filtered.join(' ').trim() || raw;
}

function buildStructuredScenario(input = {}, classification = {}) {
  return {
    assetService: cleanUserFacingText(input.guidedInput?.asset || 'Core business service', { maxSentences: 1, stripTrailingPeriod: true }) || 'Core business service',
    primaryDriver: cleanUserFacingText(input.guidedInput?.cause || classification.primaryDriver || '', { maxSentences: 1, stripTrailingPeriod: true }) || classification.primaryDriver || 'A material risk driver',
    eventPath: cleanUserFacingText(input.guidedInput?.event || classification.eventPath || '', { maxSentences: 1, stripTrailingPeriod: true }) || classification.eventPath || 'A material event path',
    effect: cleanUserFacingText(input.guidedInput?.impact || classification.effect || '', { maxSentences: 2 }) || classification.effect || 'Business disruption or exposure'
  };
}

function buildCitationPromptBlock(citations = [], limit = 6) {
  const items = (Array.isArray(citations) ? citations : [])
    .slice()
    .sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0))
    .map((item) => {
      const title = String(item?.title || item?.note || 'Untitled source').trim();
      const excerpt = truncateText(item?.excerpt || item?.description || item?.note || '', 220);
      const url = String(item?.url || item?.link || '').trim();
      const reason = String(item?.relevanceReason || '').trim();
      return [`- ${title}`, reason ? `why used: ${reason}` : '', excerpt ? `summary: ${excerpt}` : '', url || ''].filter(Boolean).join(' | ');
    })
    .filter(Boolean)
    .slice(0, limit);
  return items.length ? items.join('\n') : '(no external citations available)';
}

function buildResolvedObligationPromptBlock(settings = {}) {
  const context = settings?.resolvedObligationContext && typeof settings.resolvedObligationContext === 'object'
    ? settings.resolvedObligationContext
    : {};
  const summary = String(settings?.resolvedObligationSummary || context?.summary || '').trim();
  const buckets = [
    ['Direct obligations', Array.isArray(context?.direct) ? context.direct : []],
    ['Inherited mandatory obligations', Array.isArray(context?.inheritedMandatory) ? context.inheritedMandatory : []],
    ['Inherited conditional obligations', Array.isArray(context?.inheritedConditional) ? context.inheritedConditional : []],
    ['Inherited guidance obligations', Array.isArray(context?.inheritedGuidance) ? context.inheritedGuidance : []]
  ].map(([label, items]) => {
    const source = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 3);
    if (!source.length) return '';
    return `${label}:\n${source.map((item) => {
      const parts = [
        item?.title,
        item?.sourceEntityName ? `source: ${item.sourceEntityName}` : '',
        item?.text ? truncateText(String(item.text || ''), 220) : ''
      ].filter(Boolean);
      return `- ${parts.join(' | ')}`;
    }).join('\n')}`;
  }).filter(Boolean);
  return [summary ? `Summary:\n${summary}` : '', ...buckets].filter(Boolean).join('\n\n');
}

function buildContextPromptBlock(settings = {}, businessUnit = null) {
  const obligationBlock = buildResolvedObligationPromptBlock(settings);
  return [
    settings?.businessUnitContext ? `Live business-unit context:\n${settings.businessUnitContext}` : '',
    settings?.departmentContext ? `Live function context:\n${settings.departmentContext}` : '',
    obligationBlock ? `Resolved obligation basis:\n${obligationBlock}` : '',
    settings?.inheritedContextSummary ? `Inherited organisation context:\n${settings.inheritedContextSummary}` : '',
    settings?.personalContextSummary ? `User-specific working context:\n${settings.personalContextSummary}` : '',
    businessUnit?.selectedDepartmentContext ? `Selected department context:\n${businessUnit.selectedDepartmentContext}` : ''
  ].filter(Boolean).join('\n\n') || '(no additional live BU/function/user context provided)';
}

function buildEvidenceMeta(options = {}) {
  const citations = Array.isArray(options.citations) ? options.citations : [];
  const hasBuContext = Boolean(options.businessUnit?.contextSummary || options.businessUnit?.notes || options.businessUnit?.aiGuidance || options.adminSettings?.businessUnitContext || options.adminSettings?.departmentContext);
  const hasOrgContext = Boolean(options.organisationContext || options.adminSettings?.companyContextProfile || options.adminSettings?.companyStructureContext || options.adminSettings?.inheritedContextSummary);
  const hasUserContext = Boolean(options.userProfile || options.adminSettings?.userProfileSummary || options.adminSettings?.personalContextSummary);
  const hasGeography = Boolean(String(options.geography || options.businessUnit?.geography || options.adminSettings?.geography || '').trim());
  const hasRegulations = Boolean((options.applicableRegulations || options.adminSettings?.applicableRegulations || []).length);
  let score = 0;
  score += hasBuContext ? 2 : 0;
  score += hasOrgContext ? 2 : 0;
  score += hasUserContext ? 1 : 0;
  score += hasGeography ? 1 : 0;
  score += hasRegulations ? 1 : 0;
  score += Math.min(3, citations.length);

  const missingInformation = [];
  if (!hasBuContext) missingInformation.push('BU or function context is still thin.');
  if (!hasGeography) missingInformation.push('Geographic scope is not well defined.');
  if (!hasRegulations) missingInformation.push('Relevant regulatory references are limited or missing.');
  if (!citations.length) missingInformation.push('No external citations were available to ground the output.');

  const confidenceLabel = score >= 7 ? 'High confidence' : score >= 4 ? 'Moderate confidence' : 'Low confidence';
  const evidenceQuality = score >= 7 ? 'Strong evidence base' : score >= 4 ? 'Useful but incomplete evidence base' : 'Thin evidence base';
  const evidenceParts = [];
  if (hasBuContext) evidenceParts.push('BU/function context');
  if (hasOrgContext) evidenceParts.push('organisation context');
  if (hasUserContext) evidenceParts.push('user-role context');
  if (hasGeography) evidenceParts.push('geographic scope');
  if (hasRegulations) evidenceParts.push('regulatory scope');
  if (citations.length) evidenceParts.push(`${citations.length} cited source${citations.length === 1 ? '' : 's'}`);
  const summary = evidenceParts.length ? `Evidence used: ${joinList(evidenceParts)}.` : 'Evidence used: limited contextual inputs only.';
  const rankedCitations = citations.slice().sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0));
  return {
    confidenceLabel,
    evidenceQuality,
    summary,
    missingInformation: missingInformation.slice(0, 4),
    primaryGrounding: rankedCitations.slice(0, 3).map((item) => ({
      title: String(item?.title || item?.note || 'Untitled source').trim(),
      sourceType: String(item?.sourceType || 'Source').trim(),
      relevanceReason: String(item?.relevanceReason || '').trim()
    })),
    supportingReferences: rankedCitations.slice(3, 6).map((item) => ({
      title: String(item?.title || item?.note || 'Untitled source').trim(),
      sourceType: String(item?.sourceType || 'Source').trim(),
      relevanceReason: String(item?.relevanceReason || '').trim()
    })),
    inferredAssumptions: [
      !hasGeography ? 'Geographic scope was inferred from current platform or business-unit defaults.' : null,
      !hasRegulations ? 'Applicable regulations were inferred from selected geography and scenario type.' : null,
      !hasBuContext ? 'Business-unit or function context was inferred from broader organisation context.' : null
    ].filter(Boolean).slice(0, 4),
    promptBlock: [
      `Evidence quality: ${evidenceQuality}.`,
      `Confidence: ${confidenceLabel}.`,
      `Available evidence: ${summary}`
    ].join('\n')
  };
}

function withEvidenceMeta(result = {}, evidenceMeta = null) {
  const meta = evidenceMeta || {};
  return {
    ...result,
    confidenceLabel: String(result.confidenceLabel || meta.confidenceLabel || 'Moderate confidence'),
    evidenceQuality: String(result.evidenceQuality || meta.evidenceQuality || 'Useful but incomplete evidence base'),
    evidenceSummary: String(result.evidenceSummary || meta.summary || 'Evidence used: limited contextual inputs only.'),
    primaryGrounding: Array.isArray(result.primaryGrounding) ? result.primaryGrounding.filter(Boolean).slice(0, 3) : (Array.isArray(meta.primaryGrounding) ? meta.primaryGrounding.filter(Boolean).slice(0, 3) : []),
    supportingReferences: Array.isArray(result.supportingReferences) ? result.supportingReferences.filter(Boolean).slice(0, 3) : (Array.isArray(meta.supportingReferences) ? meta.supportingReferences.filter(Boolean).slice(0, 3) : []),
    inferredAssumptions: Array.isArray(result.inferredAssumptions) ? result.inferredAssumptions.filter(Boolean).slice(0, 4) : (Array.isArray(meta.inferredAssumptions) ? meta.inferredAssumptions.filter(Boolean).slice(0, 4) : []),
    missingInformation: Array.isArray(result.missingInformation) ? result.missingInformation.filter(Boolean).slice(0, 4) : (Array.isArray(meta.missingInformation) ? meta.missingInformation.filter(Boolean).slice(0, 4) : [])
  };
}

function normaliseRiskCards(risks = [], fallbackRegulations = []) {
  const normaliseConfidence = (value) => {
    const lowered = String(value || '').trim().toLowerCase();
    return lowered === 'high' || lowered === 'low' || lowered === 'medium' ? lowered : 'medium';
  };
  const seen = new Set();
  return (Array.isArray(risks) ? risks : [])
    .map((risk) => ({
      ...risk,
      title: cleanUserFacingText(risk?.title || '', { maxSentences: 1, stripTrailingPeriod: true }),
      category: toDisplayLabel(cleanUserFacingText(risk?.category || 'General', { maxSentences: 1, stripTrailingPeriod: true }) || 'General') || 'General',
      description: cleanUserFacingText(risk?.description || '', { maxSentences: 2 }),
      confidence: normaliseConfidence(risk?.confidence),
      regulations: Array.from(new Set([...(Array.isArray(risk?.regulations) ? risk.regulations : []), ...fallbackRegulations].map(String).filter(Boolean))).slice(0, 5)
    }))
    .filter((risk) => risk.title)
    .filter((risk) => {
      const key = normaliseSentenceKey(risk.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalisePhraseKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(text = '', phrase = '') {
  const haystack = ` ${normalisePhraseKey(text)} `;
  const needle = normalisePhraseKey(phrase);
  if (!needle) return false;
  return haystack.includes(` ${needle} `);
}

function countPhraseMatches(text = '', phrases = []) {
  return Array.from(new Set((Array.isArray(phrases) ? phrases : [])
    .map((item) => typeof item === 'string' ? item : item?.text)
    .map((item) => String(item || '').trim())
    .filter(Boolean)))
    .filter((phrase) => hasPhrase(text, phrase))
    .length;
}

function uniqueKeys(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function collectFamilyThemePhrases(family = null) {
  if (!family) return [];
  return uniqueKeys([
    ...(Array.isArray(family.preferredRiskThemes) ? family.preferredRiskThemes : []),
    ...(Array.isArray(family.shortlistSeedThemes) ? family.shortlistSeedThemes : []),
    ...(Array.isArray(family.positiveSignals)
      ? family.positiveSignals
        .filter((signal) => ['strong', 'medium'].includes(String(signal?.strength || '').trim().toLowerCase()))
        .map((signal) => signal?.text)
      : [])
  ]).slice(0, 18);
}

function collectMechanismThemePhrases(mechanismKeys = []) {
  return uniqueKeys((Array.isArray(mechanismKeys) ? mechanismKeys : [])
    .map((key) => SCENARIO_TAXONOMY_MECHANISM_BY_KEY[String(key || '').trim()])
    .filter(Boolean)
    .flatMap((mechanism) => [
      mechanism.label,
      ...(Array.isArray(mechanism.examplePhrases) ? mechanism.examplePhrases : []),
      ...(Array.isArray(mechanism.positiveSignals)
        ? mechanism.positiveSignals
          .filter((signal) => ['strong', 'medium'].includes(String(signal?.strength || '').trim().toLowerCase()))
          .map((signal) => signal?.text)
        : [])
    ]));
}

function collectAllowedSecondaryFamilyKeys(primaryFamily = null) {
  return uniqueKeys([
    ...(Array.isArray(primaryFamily?.allowedSecondaryFamilies) ? primaryFamily.allowedSecondaryFamilies : []),
    ...(Array.isArray(primaryFamily?.canCoExistWith) ? primaryFamily.canCoExistWith : []),
    ...(Array.isArray(primaryFamily?.canEscalateTo) ? primaryFamily.canEscalateTo : [])
  ]);
}

function collectFamilyLensKeys(familyKeys = []) {
  return uniqueKeys((Array.isArray(familyKeys) ? familyKeys : [])
    .map((key) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[String(key || '').trim()]?.lensKey)
    .filter(Boolean));
}

function familyConflictsWith(referenceFamily = null, candidateFamilyKey = '') {
  const candidateKey = String(candidateFamilyKey || '').trim();
  if (!referenceFamily || !candidateKey || candidateKey === String(referenceFamily.key || '').trim()) return false;
  const candidateFamily = SCENARIO_TAXONOMY_FAMILY_BY_KEY[candidateKey] || null;
  return referenceFamily.forbiddenDriftFamilies.includes(candidateKey)
    || referenceFamily.cannotBePrimaryWith.includes(candidateKey)
    || !!(candidateFamily && (
      (Array.isArray(candidateFamily.forbiddenDriftFamilies) && candidateFamily.forbiddenDriftFamilies.includes(referenceFamily.key))
      || (Array.isArray(candidateFamily.cannotBePrimaryWith) && candidateFamily.cannotBePrimaryWith.includes(referenceFamily.key))
    ));
}

function classifyShortlistLead(risk = {}) {
  const leadText = [risk?.title, risk?.category]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('. ');
  if (!leadText) {
    return {
      primaryKey: '',
      domain: '',
      lensKey: normaliseScenarioHintKey(risk?.category || ''),
      classification: null
    };
  }
  const classification = classifyScenario(leadText, { scenarioLensHint: '' });
  const lens = buildScenarioLens(classification);
  return {
    primaryKey: String(classification?.primaryFamily?.key || '').trim(),
    domain: String(classification?.domain || '').trim(),
    lensKey: String(normaliseScenarioHintKey(risk?.category || '') || lens?.key || '').trim(),
    classification
  };
}

function summariseDominantFamilies(evaluations = [], {
  acceptedContext = null
} = {}) {
  const acceptedPrimaryKey = String(acceptedContext?.acceptedPrimaryKey || '').trim();
  const acceptedSecondaryKeys = acceptedContext?.acceptedSecondaryKeySet || new Set();
  const allowedSecondaryKeys = acceptedContext?.allowedSecondaryKeySet || new Set();
  const counts = new Map();

  (Array.isArray(evaluations) ? evaluations : []).forEach((evaluation) => {
    const familyKey = String(
      evaluation?.riskPrimaryKey
      || evaluation?.leadPrimaryKey
      || ''
    ).trim();
    if (!familyKey) return;
    const entry = counts.get(familyKey) || {
      familyKey,
      count: 0,
      alignedCount: 0,
      blockedCount: 0,
      weakOverlayOnlyCount: 0
    };
    entry.count += 1;
    if (evaluation?.familyAligned || evaluation?.secondaryAligned || evaluation?.secondaryContextAligned || evaluation?.allowedSecondaryAligned) {
      entry.alignedCount += 1;
    }
    if (evaluation?.blocked) entry.blockedCount += 1;
    if (evaluation?.weakOverlayOnly) entry.weakOverlayOnlyCount += 1;
    counts.set(familyKey, entry);
  });

  return Array.from(counts.values())
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (right.alignedCount !== left.alignedCount) return right.alignedCount - left.alignedCount;
      return left.familyKey.localeCompare(right.familyKey);
    })
    .slice(0, 5)
    .map((entry) => ({
      familyKey: entry.familyKey,
      count: entry.count,
      alignedCount: entry.alignedCount,
      blockedCount: entry.blockedCount,
      weakOverlayOnlyCount: entry.weakOverlayOnlyCount,
      alignment: entry.familyKey === acceptedPrimaryKey
        ? 'accepted_primary'
        : (acceptedSecondaryKeys.has(entry.familyKey)
            ? 'accepted_secondary'
            : (allowedSecondaryKeys.has(entry.familyKey) ? 'allowed_secondary' : 'off_lane'))
    }));
}

function buildShortlistCoherenceContext(acceptedClassification = {}, narrativeAnchors = []) {
  const primaryFamily = acceptedClassification?.primaryFamily || null;
  const acceptedLens = buildScenarioLens(acceptedClassification);
  const explicitSecondaryAllowance = new Set(collectAllowedSecondaryFamilyKeys(primaryFamily));
  const secondaryFamilies = Array.isArray(acceptedClassification?.secondaryFamilies)
    ? acceptedClassification.secondaryFamilies
      .filter(Boolean)
      .filter((family) => !primaryFamily || explicitSecondaryAllowance.has(String(family?.key || '').trim()))
    : [];
  const acceptedPrimaryKey = String(primaryFamily?.key || '').trim();
  const acceptedSecondaryFamilyKeys = uniqueKeys(secondaryFamilies.map((family) => family?.key));
  const allowedSecondaryFamilyKeys = collectAllowedSecondaryFamilyKeys(primaryFamily);
  const acceptedFamilyKeys = uniqueKeys([acceptedPrimaryKey, ...acceptedSecondaryFamilyKeys]);
  const allowedFamilyKeys = uniqueKeys([acceptedPrimaryKey, ...acceptedSecondaryFamilyKeys, ...allowedSecondaryFamilyKeys]);
  const acceptedOverlayKeys = uniqueKeys([
    ...(Array.isArray(primaryFamily?.defaultOverlays) ? primaryFamily.defaultOverlays : []),
    ...(Array.isArray(acceptedClassification?.overlays) ? acceptedClassification.overlays : []).map((overlay) => overlay?.key)
  ]);
  const acceptedMechanismKeys = uniqueKeys([
    ...(Array.isArray(acceptedClassification?.mechanisms) ? acceptedClassification.mechanisms.map((mechanism) => mechanism?.key) : []),
    ...(Array.isArray(primaryFamily?.defaultMechanisms) ? primaryFamily.defaultMechanisms : []),
    ...secondaryFamilies.flatMap((family) => Array.isArray(family?.defaultMechanisms) ? family.defaultMechanisms.slice(0, 1) : [])
  ]);
  const triggerSignalPhrases = uniqueKeys(
    (Array.isArray(acceptedClassification?.matchedSignals) ? acceptedClassification.matchedSignals : [])
      .filter((signal) => ['strong', 'medium'].includes(String(signal?.strength || '').trim().toLowerCase()))
      .map((signal) => signal?.text)
  );
  const mechanismThemePhrases = collectMechanismThemePhrases(acceptedMechanismKeys);
  const familyThemePhrases = uniqueKeys([
    ...collectFamilyThemePhrases(primaryFamily),
    ...secondaryFamilies.flatMap((family) => collectFamilyThemePhrases(family).slice(0, 8))
  ]);
  const anchorPhrases = uniqueKeys([
    ...(Array.isArray(narrativeAnchors) ? narrativeAnchors : []),
    ...triggerSignalPhrases,
    ...mechanismThemePhrases,
    ...familyThemePhrases
  ]).slice(0, 42);
  return {
    primaryFamily,
    acceptedPrimaryKey,
    acceptedPrimaryDomain: String(primaryFamily?.domain || '').trim(),
    acceptedLensKey: String(acceptedLens?.key || '').trim(),
    acceptedSecondaryFamilyKeys,
    acceptedSecondaryKeySet: new Set(acceptedSecondaryFamilyKeys),
    acceptedFamilyKeys,
    acceptedFamilyKeySet: new Set(acceptedFamilyKeys),
    acceptedDomainKeys: uniqueKeys(acceptedFamilyKeys.map((familyKey) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[familyKey]?.domain)),
    acceptedDomainKeySet: new Set(uniqueKeys(acceptedFamilyKeys.map((familyKey) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[familyKey]?.domain))),
    allowedSecondaryFamilyKeys,
    allowedSecondaryKeySet: new Set(allowedSecondaryFamilyKeys),
    allowedFamilyKeys,
    allowedFamilyKeySet: new Set(allowedFamilyKeys),
    allowedLensKeys: uniqueKeys([
      String(acceptedLens?.key || '').trim(),
      ...collectFamilyLensKeys(allowedFamilyKeys),
      ...(Array.isArray(acceptedLens?.secondaryKeys) ? acceptedLens.secondaryKeys : [])
    ]),
    allowedLensKeySet: new Set(uniqueKeys([
      String(acceptedLens?.key || '').trim(),
      ...collectFamilyLensKeys(allowedFamilyKeys),
      ...(Array.isArray(acceptedLens?.secondaryKeys) ? acceptedLens.secondaryKeys : [])
    ])),
    acceptedOverlayKeys,
    acceptedOverlayKeySet: new Set(acceptedOverlayKeys),
    acceptedMechanismKeys,
    acceptedMechanismKeySet: new Set(acceptedMechanismKeys),
    triggerSignalPhrases,
    familyThemePhrases,
    anchorPhrases,
    taxonomyVersion: String(acceptedClassification?.taxonomyVersion || '').trim()
  };
}

function buildDeterministicPrimaryShortlistCard(family = null, acceptedClassification = {}, input = {}, themeIndex = 0) {
  if (!family) return null;
  const theme = String(
    family.shortlistSeedThemes?.[themeIndex]
    || family.preferredRiskThemes?.[themeIndex]
    || family.shortlistSeedThemes?.[0]
    || family.preferredRiskThemes?.[0]
    || family.label
  ).trim();
  const asset = cleanUserFacingText(input?.guidedInput?.asset || family.typicalAssets?.[0] || '', {
    maxSentences: 1,
    stripTrailingPeriod: true
  });
  const cause = cleanUserFacingText(input?.guidedInput?.cause || family.typicalCauses?.[0] || '', {
    maxSentences: 1,
    stripTrailingPeriod: true
  });
  const effects = joinList((Array.isArray(family.typicalConsequences) ? family.typicalConsequences : []).slice(0, 2));
  const description = cleanUserFacingText([
    `${family.label} remains the accepted primary event path.`,
    family.description,
    cause ? `The same path is anchored to ${cause.toLowerCase()}.` : '',
    effects ? `Keep the shortlist tied to ${effects.toLowerCase()}, not to a different primary family.` : '',
    asset ? `The current focus stays on ${asset.toLowerCase()}.` : ''
  ].filter(Boolean).join(' '), { maxSentences: 3 });
  return {
    title: toDisplayLabel(theme),
    category: family.lensLabel || toDisplayLabel(family.domain || 'General'),
    description,
    source: 'server',
    confidence: 'medium'
  };
}

function buildDeterministicMechanismShortlistCard(primaryFamily = null, mechanism = null) {
  if (!primaryFamily || !mechanism) return null;
  const description = cleanUserFacingText([
    `${primaryFamily.label} remains the accepted primary family.`,
    mechanism.description,
    `Keep the shortlist tied to the same ${primaryFamily.label.toLowerCase()} path rather than downstream drift.`
  ].join(' '), { maxSentences: 3 });
  return {
    title: toDisplayLabel(`${mechanism.label} in ${primaryFamily.label}`),
    category: primaryFamily.lensLabel || toDisplayLabel(primaryFamily.domain || 'General'),
    description,
    source: 'server',
    confidence: 'medium'
  };
}

function buildDeterministicSecondaryShortlistCard(primaryFamily = null, secondaryFamily = null) {
  if (!primaryFamily || !secondaryFamily) return null;
  const description = cleanUserFacingText([
    `${secondaryFamily.label} stays secondary to the accepted ${primaryFamily.label.toLowerCase()} path.`,
    secondaryFamily.description,
    'Keep it only because the accepted narrative explicitly supports the same escalation, not because of generic downstream consequences.'
  ].join(' '), { maxSentences: 3 });
  return {
    title: toDisplayLabel(secondaryFamily.shortlistSeedThemes?.[0] || secondaryFamily.preferredRiskThemes?.[0] || secondaryFamily.label),
    category: secondaryFamily.lensLabel || toDisplayLabel(secondaryFamily.domain || 'General'),
    description,
    source: 'server',
    confidence: 'medium'
  };
}

function buildDeterministicOverlaySupportCard(primaryFamily = null, overlayKey = '') {
  if (!primaryFamily) return null;
  const overlay = SCENARIO_TAXONOMY_OVERLAY_BY_KEY[String(overlayKey || '').trim()] || null;
  if (!overlay) return null;
  const description = cleanUserFacingText([
    `${overlay.label} remains supporting context for the accepted ${primaryFamily.label.toLowerCase()} event path.`,
    `Do not let ${overlay.label.toLowerCase()} replace ${primaryFamily.label.toLowerCase()} as the primary family.`,
    primaryFamily.description
  ].join(' '), { maxSentences: 3 });
  return {
    title: toDisplayLabel(`${overlay.label} after ${primaryFamily.label}`),
    category: primaryFamily.lensLabel || toDisplayLabel(primaryFamily.domain || 'General'),
    description,
    source: 'server',
    confidence: 'medium'
  };
}

function buildDeterministicCoherentShortlist(acceptedClassification = {}, {
  input = {}
} = {}) {
  const primaryFamily = acceptedClassification?.primaryFamily || null;
  if (!primaryFamily) return [];

  const explicitSecondaryAllowance = new Set([
    ...(Array.isArray(primaryFamily?.allowedSecondaryFamilies) ? primaryFamily.allowedSecondaryFamilies : []),
    ...(Array.isArray(primaryFamily?.canCoExistWith) ? primaryFamily.canCoExistWith : []),
    ...(Array.isArray(primaryFamily?.canEscalateTo) ? primaryFamily.canEscalateTo : [])
  ]);
  const secondaryFamilies = Array.isArray(acceptedClassification?.secondaryFamilies)
    ? acceptedClassification.secondaryFamilies
      .filter(Boolean)
      .filter((family) => explicitSecondaryAllowance.has(String(family?.key || '').trim()))
    : [];
  const mechanismObjects = uniqueKeys([
    ...(Array.isArray(primaryFamily?.defaultMechanisms) ? primaryFamily.defaultMechanisms : []),
    ...secondaryFamilies.flatMap((family) => Array.isArray(family?.defaultMechanisms) ? family.defaultMechanisms.slice(0, 1) : [])
  ])
    .map((key) => SCENARIO_TAXONOMY_MECHANISM_BY_KEY[key])
    .filter(Boolean);
  const overlayKeys = uniqueKeys([
    ...(Array.isArray(primaryFamily?.defaultOverlays) ? primaryFamily.defaultOverlays : []),
    ...(Array.isArray(acceptedClassification?.overlays) ? acceptedClassification.overlays.map((overlay) => overlay?.key) : [])
  ]);
  const fallbackRiskCards = buildFallbackRiskCards(acceptedClassification, input);
  const trimmedFallbackRiskCards = fallbackRiskCards.length === 1
    && normaliseSentenceKey(fallbackRiskCards[0]?.title || '') === normaliseSentenceKey('Material enterprise risk requiring structured assessment')
    ? []
    : fallbackRiskCards;

  return normaliseRiskCards([
    ...trimmedFallbackRiskCards,
    buildDeterministicPrimaryShortlistCard(primaryFamily, acceptedClassification, input, 0),
    buildDeterministicMechanismShortlistCard(primaryFamily, mechanismObjects[0] || null),
    buildDeterministicSecondaryShortlistCard(primaryFamily, secondaryFamilies[0] || null),
    buildDeterministicPrimaryShortlistCard(primaryFamily, acceptedClassification, input, 1),
    buildDeterministicOverlaySupportCard(primaryFamily, overlayKeys[0] || ''),
    buildDeterministicMechanismShortlistCard(primaryFamily, mechanismObjects[1] || null)
  ].filter(Boolean), input.applicableRegulations || []).slice(0, 3);
}

function resolveAcceptedScenarioClassification(finalNarrative = '', input = {}, fallbackClassification = {}) {
  const accepted = classifyScenario(finalNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: input.scenarioLensHint || fallbackClassification?.primaryFamily?.key || fallbackClassification?.key || ''
  });
  if (accepted?.primaryFamily?.key) return accepted;
  return fallbackClassification;
}

function evaluateShortlistRiskCard(risk = {}, {
  acceptedClassification = {},
  acceptedContext = null,
  narrativeAnchors = []
} = {}) {
  const shortlistContext = acceptedContext || buildShortlistCoherenceContext(acceptedClassification, narrativeAnchors);
  const acceptedPrimaryFamily = shortlistContext.primaryFamily || null;
  const acceptedPrimaryKey = String(shortlistContext.acceptedPrimaryKey || '').trim();
  const acceptedSecondaryKeys = shortlistContext.acceptedSecondaryKeySet || new Set();
  const allowedSecondaryKeys = shortlistContext.allowedSecondaryKeySet || new Set();
  const acceptedOverlayKeys = shortlistContext.acceptedOverlayKeySet || new Set();
  const acceptedMechanismKeys = shortlistContext.acceptedMechanismKeySet || new Set();
  const acceptedDomainKeys = shortlistContext.acceptedDomainKeySet || new Set();
  const allowedLensKeys = shortlistContext.allowedLensKeySet || new Set();
  const acceptedLensKey = String(shortlistContext.acceptedLensKey || '').trim();
  const riskText = [risk?.title, risk?.category, risk?.description]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('. ');
  const riskClassification = classifyScenario(riskText, { scenarioLensHint: '' });
  const leadProfile = classifyShortlistLead(risk);
  const riskPrimaryKey = String(riskClassification?.primaryFamily?.key || '').trim();
  const riskPrimaryFamily = SCENARIO_TAXONOMY_FAMILY_BY_KEY[riskPrimaryKey] || null;
  const riskSecondaryKeys = new Set(
    (Array.isArray(riskClassification?.secondaryFamilies) ? riskClassification.secondaryFamilies : [])
      .map((family) => String(family?.key || '').trim())
      .filter(Boolean)
  );
  const riskOverlayKeys = uniqueKeys(
    (Array.isArray(riskClassification?.overlays) ? riskClassification.overlays : [])
      .map((overlay) => overlay?.key)
  );
  const riskMechanismKeys = uniqueKeys(
    (Array.isArray(riskClassification?.mechanisms) ? riskClassification.mechanisms : [])
      .map((mechanism) => mechanism?.key)
  );
  const riskDomainKey = String(riskClassification?.domain || riskPrimaryFamily?.domain || '').trim();
  const riskLensKey = String(buildScenarioLens(riskClassification)?.key || '').trim();
  const leadPrimaryKey = String(leadProfile.primaryKey || '').trim();
  const leadPrimaryFamily = SCENARIO_TAXONOMY_FAMILY_BY_KEY[leadPrimaryKey] || null;
  const leadDomainKey = String(leadProfile.domain || leadPrimaryFamily?.domain || '').trim();
  const leadLensKey = String(leadProfile.lensKey || '').trim();
  const familyAligned = !!acceptedPrimaryKey && riskPrimaryKey === acceptedPrimaryKey;
  const secondaryAligned = !!riskPrimaryKey && acceptedSecondaryKeys.has(riskPrimaryKey);
  const narrativeAnchorOverlap = countScenarioAnchorOverlap(riskText, narrativeAnchors);
  const classificationAnchorOverlap = countPhraseMatches(riskText, shortlistContext.anchorPhrases || []);
  const overlayOverlapCount = riskOverlayKeys.filter((key) => acceptedOverlayKeys.has(key)).length;
  const mechanismOverlapCount = riskMechanismKeys.filter((key) => acceptedMechanismKeys.has(key)).length;
  const triggerSignalOverlapCount = countPhraseMatches(riskText, shortlistContext.triggerSignalPhrases || []);
  const themeOverlapCount = countPhraseMatches(riskText, shortlistContext.familyThemePhrases || []);
  const familyContextOverlapCount = countPhraseMatches(riskText, shortlistContext.acceptedFamilyKeys || []);
  const titleAnchorOverlap = countScenarioAnchorOverlap(`${risk?.title || ''} ${risk?.category || ''}`, narrativeAnchors)
    + countPhraseMatches(`${risk?.title || ''} ${risk?.category || ''}`, shortlistContext.triggerSignalPhrases || []);
  const eventPathEvidenceCount = [
    narrativeAnchorOverlap > 0,
    classificationAnchorOverlap > 0,
    mechanismOverlapCount > 0,
    triggerSignalOverlapCount > 0,
    themeOverlapCount > 0,
    familyContextOverlapCount > 0
  ].filter(Boolean).length;
  const taxonomyPathOverlapCount = mechanismOverlapCount + triggerSignalOverlapCount + themeOverlapCount + familyContextOverlapCount;
  const allowedSecondaryAligned = !familyAligned
    && !secondaryAligned
    && !!riskPrimaryKey
    && allowedSecondaryKeys.has(riskPrimaryKey)
    && (eventPathEvidenceCount >= 2 || (classificationAnchorOverlap > 0 && taxonomyPathOverlapCount > 0));
  const secondaryContextAligned = !familyAligned && !secondaryAligned && !allowedSecondaryAligned
    && Array.from(riskSecondaryKeys).some((key) => key === acceptedPrimaryKey || acceptedSecondaryKeys.has(key));
  const eventAligned = familyAligned || secondaryAligned || secondaryContextAligned || allowedSecondaryAligned;
  const leadFamilyAligned = !!leadPrimaryKey && (leadPrimaryKey === acceptedPrimaryKey || acceptedSecondaryKeys.has(leadPrimaryKey));
  const leadAllowedSecondaryAligned = !!leadPrimaryKey && allowedSecondaryKeys.has(leadPrimaryKey);
  const riskDomainAligned = !!riskDomainKey && acceptedDomainKeys.has(riskDomainKey);
  const leadDomainAligned = !!leadDomainKey && acceptedDomainKeys.has(leadDomainKey);
  const riskLensAligned = !riskLensKey || !acceptedLensKey || allowedLensKeys.has(riskLensKey) || isCompatibleScenarioLens(acceptedLensKey, riskLensKey);
  const leadLensAligned = !leadLensKey || !acceptedLensKey || allowedLensKeys.has(leadLensKey) || isCompatibleScenarioLens(acceptedLensKey, leadLensKey);
  const blockedByAcceptedAntiSignals = countPhraseMatches(riskText, acceptedPrimaryFamily?.antiSignals || []);
  const blockedByRiskAntiSignals = (Array.isArray(riskClassification?.blockedByAntiSignals) ? riskClassification.blockedByAntiSignals : [])
    .some((entry) => entry?.familyKey === acceptedPrimaryKey || acceptedSecondaryKeys.has(String(entry?.familyKey || '').trim()) || allowedSecondaryKeys.has(String(entry?.familyKey || '').trim()));
  const primaryBoundaryBlocked = !!(acceptedPrimaryFamily && riskPrimaryKey && familyConflictsWith(acceptedPrimaryFamily, riskPrimaryKey));
  const leadBoundaryBlocked = !!(acceptedPrimaryFamily && leadPrimaryKey && familyConflictsWith(acceptedPrimaryFamily, leadPrimaryKey));
  const riskOffLanePrimary = !!(riskPrimaryKey && !eventAligned && !riskDomainAligned && !riskLensAligned);
  const leadOffLanePrimary = !!(leadPrimaryKey && !leadFamilyAligned && !leadAllowedSecondaryAligned && !leadDomainAligned && !leadLensAligned);
  const blockedFamily = primaryBoundaryBlocked
    ? riskPrimaryKey
    : (leadBoundaryBlocked ? leadPrimaryKey : '');
  const consequenceOnly = !riskPrimaryKey
    || riskClassification.reasonCodes?.includes('CONSEQUENCE_ONLY_NOT_PRIMARY')
    || (riskClassification.reasonCodes?.includes('INSUFFICIENT_PRIMARY_SIGNAL') && riskOverlayKeys.length > 0 && !eventAligned);
  const consequenceHeavy = Boolean(riskClassification.ambiguityFlags?.includes('CONSEQUENCE_HEAVY_TEXT'));
  const genericGovernanceTitle = hasGenericGovernanceShortlistWording(risk);
  const consequenceDominantTitle = hasConsequenceDominantShortlistWording(risk);
  const overlayDrivenDomainAllowed = !riskPrimaryKey
    || riskDomainAligned
    || leadDomainAligned
    || riskLensAligned
    || leadLensAligned;
  const blocked = Boolean(
    blockedFamily
    || blockedByAcceptedAntiSignals
    || blockedByRiskAntiSignals
    || ((riskOffLanePrimary || leadOffLanePrimary) && eventPathEvidenceCount === 0 && taxonomyPathOverlapCount === 0)
  );
  const familyFitReasonCodes = uniqueKeys([
    familyAligned ? 'PRIMARY_FAMILY_ALIGNED' : '',
    secondaryAligned ? 'SECONDARY_FAMILY_ALIGNED' : '',
    allowedSecondaryAligned ? 'ALLOWED_SECONDARY_FAMILY_ALIGNED' : '',
    secondaryContextAligned ? 'PRIMARY_PATH_AS_SECONDARY' : '',
    blockedFamily ? 'BLOCKED_BY_PRIMARY_DRIFT_BOUNDARY' : '',
    leadBoundaryBlocked ? 'BLOCKED_BY_LEAD_FAMILY_DRIFT' : '',
    leadOffLanePrimary ? 'OFF_LANE_LEAD_FAMILY' : '',
    !leadLensAligned && !!leadLensKey ? 'LEAD_LENS_CONFLICT' : '',
    blockedByAcceptedAntiSignals ? 'BLOCKED_BY_ACCEPTED_ANTI_SIGNAL' : '',
    blockedByRiskAntiSignals ? 'BLOCKED_BY_CLASSIFIER_ANTI_SIGNAL' : '',
    consequenceOnly ? 'CONSEQUENCE_ONLY_CARD' : '',
    consequenceHeavy ? 'CONSEQUENCE_HEAVY_CARD' : '',
    genericGovernanceTitle ? 'GENERIC_GOVERNANCE_TITLE' : '',
    consequenceDominantTitle ? 'CONSEQUENCE_DOMINANT_TITLE' : '',
    eventPathEvidenceCount ? 'HAS_EVENT_PATH_EVIDENCE' : 'NO_EVENT_PATH_EVIDENCE'
  ]);

  let score = 0;
  if (familyAligned) score += 58;
  else if (secondaryAligned) score += 40;
  else if (allowedSecondaryAligned) score += 34;
  else if (secondaryContextAligned) score += 28;
  else if (riskPrimaryKey) score -= 26;
  if (leadFamilyAligned) score += 12;
  else if (leadAllowedSecondaryAligned) score += 8;
  else if (leadPrimaryKey) score -= leadBoundaryBlocked ? 20 : 8;
  if (riskDomainAligned) score += 6;
  if (leadDomainAligned) score += 4;
  if (riskLensAligned) score += 8;
  if (leadLensAligned) score += 4;
  else if (leadLensKey) score -= 10;
  if (blocked) score -= 90;
  if (narrativeAnchorOverlap >= 2) score += 22;
  else if (narrativeAnchorOverlap === 1) score += 10;
  else if (classificationAnchorOverlap >= 2) score += 14;
  else if ((narrativeAnchors.length || shortlistContext.anchorPhrases?.length) && !eventAligned) score -= 14;
  score += Math.min(18, overlayOverlapCount * 6);
  score += Math.min(18, mechanismOverlapCount * 9);
  score += Math.min(18, triggerSignalOverlapCount * 6);
  score += Math.min(18, themeOverlapCount * 6);
  if (blockedByAcceptedAntiSignals) score -= Math.min(30, blockedByAcceptedAntiSignals * 12);
  if (blockedByRiskAntiSignals) score -= 24;
  if (consequenceOnly) score -= eventAligned ? 10 : 30;
  if (consequenceHeavy) score -= eventAligned ? 4 : 12;
  if (genericGovernanceTitle) score -= eventAligned ? 16 : 34;
  if (consequenceDominantTitle) score -= eventAligned ? 18 : 42;
  if (consequenceDominantTitle && mechanismOverlapCount === 0) score -= 10;
  if (consequenceDominantTitle && triggerSignalOverlapCount === 0) score -= 8;
  if (titleAnchorOverlap === 0 && genericGovernanceTitle) score -= 12;
  if (titleAnchorOverlap === 0 && consequenceDominantTitle) score -= 16;
  if (titleAnchorOverlap === 0 && consequenceOnly) score -= 10;

  const overlayDrivenAligned = !eventAligned
    && !blocked
    && overlayDrivenDomainAllowed
    && overlayOverlapCount >= 1
    && eventPathEvidenceCount >= 2
    && taxonomyPathOverlapCount >= 1
    && !consequenceHeavy
    && !consequenceDominantTitle
    && !(consequenceOnly && classificationAnchorOverlap === 0 && mechanismOverlapCount === 0);
  const stronglyAligned = !blocked
    && eventAligned
    && eventPathEvidenceCount >= 1
    && score >= (familyAligned ? 40 : (secondaryAligned || allowedSecondaryAligned ? 36 : 34))
    && !(genericGovernanceTitle && titleAnchorOverlap === 0 && mechanismOverlapCount === 0 && triggerSignalOverlapCount === 0)
    && !(consequenceDominantTitle && mechanismOverlapCount === 0 && triggerSignalOverlapCount === 0 && titleAnchorOverlap <= 1)
    && !(consequenceOnly && narrativeAnchorOverlap === 0 && classificationAnchorOverlap === 0 && mechanismOverlapCount === 0 && themeOverlapCount === 0);
  const weakOverlayOnly = overlayDrivenAligned && !eventAligned;
  const alignmentType = blocked
    ? 'blocked'
    : (familyAligned
        ? 'primary-aligned'
        : ((secondaryAligned || allowedSecondaryAligned || secondaryContextAligned)
            ? 'secondary-aligned'
            : (overlayDrivenAligned ? 'overlay-consistent-weak' : 'off-lane')));

  return {
    risk,
    score,
    riskClassification,
    riskPrimaryKey,
    leadPrimaryKey,
    riskSecondaryKeys: Array.from(riskSecondaryKeys),
    familyAligned,
    secondaryAligned,
    allowedSecondaryAligned,
    secondaryContextAligned,
    eventAligned,
    overlayDrivenAligned,
    weakOverlayOnly,
    consequenceOnly,
    consequenceHeavy,
    genericGovernanceTitle,
    consequenceDominantTitle,
    blockedFamily,
    blocked,
    narrativeAnchorOverlap,
    classificationAnchorOverlap,
    overlayOverlapCount,
    mechanismOverlapCount,
    triggerSignalOverlapCount,
    themeOverlapCount,
    eventPathEvidenceCount,
    taxonomyPathOverlapCount,
    acceptedReasonCodes: familyFitReasonCodes,
    stronglyAligned,
    alignmentType
  };
}

function assessShortlistCoherence(risks = [], {
  acceptedClassification = {},
  finalNarrative = '',
  seedNarrative = '',
  input = {}
} = {}) {
  const normalisedRisks = normaliseRiskCards(risks, input.applicableRegulations || []);
  const narrativeAnchors = extractGuidedDraftAnchors({ guidedInput: input.guidedInput }, `${seedNarrative || ''} ${finalNarrative || ''}`.trim());
  const acceptedContext = buildShortlistCoherenceContext(acceptedClassification, narrativeAnchors);
  const evaluations = normalisedRisks.map((risk) => evaluateShortlistRiskCard(risk, {
    acceptedClassification,
    acceptedContext,
    narrativeAnchors
  }));
  const strongEventAligned = evaluations.filter((evaluation) => evaluation.stronglyAligned).sort((left, right) => right.score - left.score);
  const hasStrongEventAligned = strongEventAligned.length > 0;
  const acceptedEvaluations = evaluations.filter((evaluation) => (
    evaluation.stronglyAligned
    || (
      hasStrongEventAligned
      && evaluation.overlayDrivenAligned
    )
  )).sort((left, right) => right.score - left.score);
  const acceptedRisks = acceptedEvaluations.map((evaluation) => evaluation.risk);
  const blockedFamilies = uniqueKeys(evaluations.map((evaluation) => evaluation.blockedFamily));
  const blockedCount = evaluations.filter((evaluation) => evaluation.blocked).length;
  const lowAnchorCount = (narrativeAnchors.length || acceptedContext.anchorPhrases.length)
    ? evaluations.filter((evaluation) => evaluation.narrativeAnchorOverlap === 0 && evaluation.classificationAnchorOverlap === 0).length
    : 0;
  const outsideFamilyCount = evaluations.filter((evaluation) => !evaluation.familyAligned && !evaluation.secondaryAligned && !evaluation.secondaryContextAligned && !evaluation.overlayDrivenAligned).length;
  const consequenceOnlyCount = evaluations.filter((evaluation) => evaluation.consequenceOnly).length;
  const weakOverlayOnlyCount = evaluations.filter((evaluation) => evaluation.weakOverlayOnly).length;
  const genericGovernanceTitleCount = evaluations.filter((evaluation) => evaluation.genericGovernanceTitle).length;
  const consequenceDominantTitleCount = evaluations.filter((evaluation) => evaluation.consequenceDominantTitle).length;
  const acceptedWeakOverlayOnlyCount = acceptedEvaluations.filter((evaluation) => evaluation.weakOverlayOnly).length;
  const acceptedStrongEventCount = acceptedEvaluations.filter((evaluation) => evaluation.stronglyAligned).length;
  const acceptedPrimaryOrSecondaryCount = acceptedEvaluations.filter((evaluation) => (
    evaluation.familyAligned
    || evaluation.secondaryAligned
    || evaluation.allowedSecondaryAligned
    || evaluation.secondaryContextAligned
  )).length;
  const weakMechanismAlignmentCount = evaluations.filter((evaluation) => evaluation.mechanismOverlapCount === 0 && !evaluation.familyAligned && !evaluation.secondaryAligned).length;
  const dominantFamilies = summariseDominantFamilies(evaluations, { acceptedContext });
  const acceptedDominantFamilies = summariseDominantFamilies(acceptedEvaluations, { acceptedContext });
  const dominantFamilyAligned = !dominantFamilies.length || dominantFamilies[0].alignment !== 'off_lane';
  const acceptedDominantFamilyAligned = !acceptedDominantFamilies.length || acceptedDominantFamilies[0].alignment !== 'off_lane';
  const weakOverlayOnlyDominant = acceptedWeakOverlayOnlyCount > acceptedStrongEventCount;
  const minimumAcceptedCount = normalisedRisks.length >= 3 ? 2 : (normalisedRisks.length ? 1 : 0);
  const enoughUsable = acceptedRisks.length >= minimumAcceptedCount
    && acceptedPrimaryOrSecondaryCount >= 1
    && acceptedStrongEventCount >= 1
    && acceptedDominantFamilyAligned
    && !weakOverlayOnlyDominant;
  const fullyAccepted = acceptedRisks.length === normalisedRisks.length
    && !blockedFamilies.length
    && !blockedCount
    && dominantFamilyAligned
    && !weakOverlayOnlyDominant;
  const reasonCodes = [];
  if (blockedFamilies.length) reasonCodes.push('BLOCKED_DRIFT_FAMILIES');
  if (blockedCount && blockedCount >= Math.ceil(Math.max(1, normalisedRisks.length) / 2)) reasonCodes.push('MAJORITY_BLOCKED');
  if (normalisedRisks.length && outsideFamilyCount >= Math.ceil(normalisedRisks.length / 2)) reasonCodes.push('MAJORITY_OUTSIDE_ACCEPTED_FAMILY');
  if (normalisedRisks.length && consequenceOnlyCount >= Math.ceil(normalisedRisks.length / 2)) reasonCodes.push('CONSEQUENCE_ONLY_DRIFT');
  if (normalisedRisks.length && genericGovernanceTitleCount >= Math.ceil(normalisedRisks.length / 2)) reasonCodes.push('GENERIC_GOVERNANCE_TITLE_DRIFT');
  if (normalisedRisks.length && consequenceDominantTitleCount >= Math.ceil(normalisedRisks.length / 2)) reasonCodes.push('CONSEQUENCE_DOMINANT_TITLE_DRIFT');
  if (!dominantFamilyAligned) reasonCodes.push('DOMINANT_FAMILY_DRIFT');
  if (weakOverlayOnlyCount > Math.floor(Math.max(1, normalisedRisks.length) / 2)) reasonCodes.push('WEAK_OVERLAY_ONLY_SHORTLIST');
  if (lowAnchorCount && lowAnchorCount >= Math.ceil(normalisedRisks.length / 2)) reasonCodes.push('LOW_EVENT_ANCHOR_OVERLAP');
  if (weakMechanismAlignmentCount && weakMechanismAlignmentCount >= Math.ceil(normalisedRisks.length / 2)) reasonCodes.push('LOW_MECHANISM_ALIGNMENT');
  if (!acceptedEvaluations.some((evaluation) => evaluation.familyAligned || evaluation.secondaryAligned)) reasonCodes.push('NO_PRIMARY_OR_ACCEPTED_SECONDARY_CARD');

  return {
    acceptedRisks,
    acceptedEvaluations,
    evaluations,
    blockedFamilies,
    blockedCount,
    enoughUsable,
    fullyAccepted,
    candidateCount: normalisedRisks.length,
    alignedCount: acceptedRisks.length,
    filteredOutCount: Math.max(0, normalisedRisks.length - acceptedRisks.length),
    reasonCodes,
    weakOverlayOnlyCount,
    dominantFamilies,
    acceptedDominantFamilies,
    acceptedContext,
    acceptedPrimaryFamilyKey: acceptedContext.acceptedPrimaryKey,
    acceptedSecondaryFamilyKeys: acceptedContext.acceptedSecondaryFamilyKeys.slice(),
    allowedSecondaryFamilyKeys: acceptedContext.allowedSecondaryFamilyKeys.slice(),
    acceptedMechanismKeys: acceptedContext.acceptedMechanismKeys.slice(),
    acceptedOverlayKeys: acceptedContext.acceptedOverlayKeys.slice(),
    narrativeAnchorCount: narrativeAnchors.length,
    taxonomyVersion: acceptedContext.taxonomyVersion || String(acceptedClassification?.taxonomyVersion || '').trim()
  };
}

function buildShortlistCoherenceResult(risks = [], {
  mode = 'accepted',
  candidateAssessment = null,
  acceptedClassification = {},
  finalNarrative = '',
  seedNarrative = '',
  input = {},
  reasonCodes = [],
  blockedFamilies = [],
  usedFallbackShortlist = false
} = {}) {
  const normalisedReturnedRisks = normaliseRiskCards(risks, input.applicableRegulations || []);
  const returnedAssessment = assessShortlistCoherence(normalisedReturnedRisks, {
    acceptedClassification,
    finalNarrative,
    seedNarrative,
    input
  });
  const candidateCount = Number(candidateAssessment?.candidateCount || 0);
  const candidateAlignedCount = Number(candidateAssessment?.alignedCount || 0);
  const filteredOutCount = mode === 'accepted'
    ? 0
    : (mode === 'filtered'
        ? Math.max(0, candidateCount - normalisedReturnedRisks.length)
        : Math.max(0, candidateCount - candidateAlignedCount));
  const metadataReasonCodes = uniqueKeys(reasonCodes);
  const metadataBlockedFamilies = uniqueKeys(blockedFamilies);
  const dominantFamilies = Array.isArray(returnedAssessment?.dominantFamilies) ? returnedAssessment.dominantFamilies : [];
  const dominantFamilyAligned = !dominantFamilies.length || dominantFamilies[0]?.alignment !== 'off_lane';
  const calibratedConfidence = calibrateCoherenceConfidence({
    outputType: 'shortlist',
    mode,
    sourceMode: usedFallbackShortlist ? 'deterministic_fallback' : 'live',
    totalCount: candidateCount || normalisedReturnedRisks.length,
    alignedCount: Number(returnedAssessment?.alignedCount || 0),
    blockedCount: Number(candidateAssessment?.blockedCount || 0),
    weakOverlayOnlyCount: Number(returnedAssessment?.weakOverlayOnlyCount || 0),
    dominantFamilyAligned,
    lowAnchorOverlap: metadataReasonCodes.includes('LOW_EVENT_ANCHOR_OVERLAP'),
    reasonCodes: metadataReasonCodes,
    usedFallback: usedFallbackShortlist,
    strongAlignment: Boolean(returnedAssessment?.enoughUsable && dominantFamilyAligned)
  });

  return {
    mode,
    risks: normalisedReturnedRisks,
    alignedCount: returnedAssessment.alignedCount,
    totalCount: candidateCount,
    returnedCount: normalisedReturnedRisks.length,
    filteredOutCount,
    candidateAlignedCount,
    blockedCount: Number(candidateAssessment?.blockedCount || 0),
    weakOverlayOnlyCount: Number(returnedAssessment?.weakOverlayOnlyCount || 0),
    candidateWeakOverlayOnlyCount: Number(candidateAssessment?.weakOverlayOnlyCount || 0),
    dominantFamilies,
    candidateDominantFamilies: Array.isArray(candidateAssessment?.dominantFamilies) ? candidateAssessment.dominantFamilies : [],
    reasonCodes: metadataReasonCodes,
    blockedFamilies: metadataBlockedFamilies,
    usedFallbackShortlist,
    acceptedPrimaryFamilyKey: String(candidateAssessment?.acceptedPrimaryFamilyKey || '').trim(),
    acceptedSecondaryFamilyKeys: Array.isArray(candidateAssessment?.acceptedSecondaryFamilyKeys) ? candidateAssessment.acceptedSecondaryFamilyKeys.slice() : [],
    allowedSecondaryFamilyKeys: Array.isArray(candidateAssessment?.allowedSecondaryFamilyKeys) ? candidateAssessment.allowedSecondaryFamilyKeys.slice() : [],
    acceptedMechanismKeys: Array.isArray(candidateAssessment?.acceptedMechanismKeys) ? candidateAssessment.acceptedMechanismKeys.slice() : [],
    acceptedOverlayKeys: Array.isArray(candidateAssessment?.acceptedOverlayKeys) ? candidateAssessment.acceptedOverlayKeys.slice() : [],
    narrativeAnchorCount: Number(candidateAssessment?.narrativeAnchorCount || 0),
    taxonomyVersion: String(candidateAssessment?.taxonomyVersion || acceptedClassification?.taxonomyVersion || '').trim(),
    confidenceScore: calibratedConfidence.confidenceScore,
    confidenceBand: calibratedConfidence.confidenceBand,
    confidenceDrivers: calibratedConfidence.confidenceDrivers,
    calibrationMode: calibratedConfidence.calibrationMode
  };
}

function enforceScenarioShortlistCoherence(candidateRisks = [], {
  acceptedClassification = {},
  finalNarrative = '',
  seedNarrative = '',
  input = {},
  fallbackRisks = []
} = {}) {
  const candidateAssessment = assessShortlistCoherence(candidateRisks, {
    acceptedClassification,
    finalNarrative,
    seedNarrative,
    input
  });
  const baseMetadata = {
    acceptedPrimaryFamilyKey: candidateAssessment.acceptedPrimaryFamilyKey,
    acceptedSecondaryFamilyKeys: candidateAssessment.acceptedSecondaryFamilyKeys,
    allowedSecondaryFamilyKeys: candidateAssessment.allowedSecondaryFamilyKeys,
    acceptedMechanismKeys: candidateAssessment.acceptedMechanismKeys,
    acceptedOverlayKeys: candidateAssessment.acceptedOverlayKeys,
    narrativeAnchorCount: candidateAssessment.narrativeAnchorCount,
    taxonomyVersion: candidateAssessment.taxonomyVersion
  };
  if (!candidateAssessment.candidateCount) {
    const replacementRisks = buildDeterministicCoherentShortlist(acceptedClassification, {
      input
    });
    return buildShortlistCoherenceResult(replacementRisks, {
      mode: replacementRisks.length ? 'fallback_replaced' : 'accepted',
      candidateAssessment,
      acceptedClassification,
      finalNarrative,
      seedNarrative,
      input,
      reasonCodes: replacementRisks.length ? ['EMPTY_SHORTLIST', 'DETERMINISTIC_SHORTLIST_REBUILT', 'FALLBACK_REPLACED'] : ['EMPTY_SHORTLIST'],
      blockedFamilies: [],
      usedFallbackShortlist: replacementRisks.length > 0,
      ...baseMetadata
    });
  }
  if (candidateAssessment.fullyAccepted) {
    return buildShortlistCoherenceResult(candidateRisks, {
      mode: 'accepted',
      candidateAssessment,
      acceptedClassification,
      finalNarrative,
      seedNarrative,
      input,
      reasonCodes: ['ACCEPTED_AS_ALIGNED'],
      blockedFamilies: candidateAssessment.blockedFamilies,
      usedFallbackShortlist: false,
      ...baseMetadata
    });
  }
  if (candidateAssessment.enoughUsable) {
    return buildShortlistCoherenceResult(candidateAssessment.acceptedRisks, {
      mode: 'filtered',
      candidateAssessment,
      acceptedClassification,
      finalNarrative,
      seedNarrative,
      input,
      reasonCodes: uniqueKeys([...candidateAssessment.reasonCodes, 'FILTERED_TO_ALIGNED_SET']),
      blockedFamilies: candidateAssessment.blockedFamilies,
      usedFallbackShortlist: false,
      ...baseMetadata
    });
  }

  const fallbackAssessment = assessShortlistCoherence(fallbackRisks, {
    acceptedClassification,
    finalNarrative,
    seedNarrative,
    input
  });
  const minimumReplacementCount = fallbackAssessment.candidateCount >= 2
    ? 2
    : (fallbackAssessment.candidateCount ? 1 : 0);
  const fallbackStrongEnough = fallbackAssessment.acceptedRisks.length >= minimumReplacementCount
    && fallbackAssessment.acceptedEvaluations.some((evaluation) => evaluation.familyAligned || evaluation.secondaryAligned || evaluation.allowedSecondaryAligned || evaluation.secondaryContextAligned)
    && (!fallbackAssessment.acceptedDominantFamilies.length || fallbackAssessment.acceptedDominantFamilies[0].alignment !== 'off_lane')
    && fallbackAssessment.acceptedEvaluations.filter((evaluation) => evaluation.weakOverlayOnly).length
      <= fallbackAssessment.acceptedEvaluations.filter((evaluation) => evaluation.stronglyAligned).length;
  const fallbackSelectedRisks = fallbackStrongEnough
    ? fallbackAssessment.acceptedRisks
    : buildDeterministicCoherentShortlist(acceptedClassification, {
      input
    });
  return buildShortlistCoherenceResult(fallbackSelectedRisks, {
    mode: 'fallback_replaced',
    candidateAssessment,
    acceptedClassification,
    finalNarrative,
    seedNarrative,
    input,
    reasonCodes: uniqueKeys([
      ...candidateAssessment.reasonCodes,
      ...(fallbackStrongEnough ? [] : ['DETERMINISTIC_SHORTLIST_REBUILT']),
      'FALLBACK_REPLACED'
    ]),
    blockedFamilies: uniqueKeys([...candidateAssessment.blockedFamilies, ...fallbackAssessment.blockedFamilies]),
    usedFallbackShortlist: true,
    ...baseMetadata
  });
}

function normaliseGuidance(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : [])
    .map((item) => cleanUserFacingText(item, { maxSentences: 1, stripTrailingPeriod: true }))
    .filter(Boolean)))
    .slice(0, 5);
}

function normaliseScenarioLens(lens = {}, fallback = {}) {
  const merged = {
    ...fallback,
    ...(lens && typeof lens === 'object' ? lens : {})
  };
  return {
    key: String(merged.key || fallback.key || 'general').trim() || 'general',
    label: cleanUserFacingText(merged.label || fallback.label || 'General enterprise risk', { maxSentences: 1, stripTrailingPeriod: true }) || 'General enterprise risk',
    functionKey: String(merged.functionKey || fallback.functionKey || 'general').trim() || 'general',
    estimatePresetKey: String(merged.estimatePresetKey || fallback.estimatePresetKey || 'general').trim() || 'general',
    secondaryKeys: Array.from(new Set([
      ...(Array.isArray(fallback.secondaryKeys) ? fallback.secondaryKeys : []),
      ...(Array.isArray(merged.secondaryKeys) ? merged.secondaryKeys : [])
    ].map((item) => normaliseScenarioHintKey(item)).filter((item) => item && item !== (String(merged.key || fallback.key || 'general').trim() || 'general'))))
  };
}

function evaluateGuidedDraftCandidate(candidate = '', {
  seedNarrative = '',
  guidedInput = {},
  scenarioLensHint = '',
  businessUnit = null
} = {}) {
  const explicitLeadLens = extractExplicitScenarioLeadLens(candidate);
  const cleanedCandidate = cleanUserFacingText(stripScenarioLeadIns(candidate || ''), { maxSentences: 6 });
  if (!cleanedCandidate) return { accepted: false, reason: 'empty', narrative: '' };
  const classifiedExpectedLens = classifyScenario(seedNarrative, { guidedInput, businessUnit, scenarioLensHint }).key;
  const expectedLens = classifiedExpectedLens && classifiedExpectedLens !== 'general'
    ? classifiedExpectedLens
    : (normaliseScenarioHintKey(scenarioLensHint) || classifiedExpectedLens || 'general');
  if (explicitLeadLens && !isCompatibleScenarioLens(expectedLens, explicitLeadLens)) {
    return { accepted: false, reason: 'explicit-lens-drift', narrative: cleanedCandidate };
  }
  const anchorGroups = buildGuidedDraftAnchorGroups({ guidedInput }, seedNarrative);
  const anchorMetrics = scoreGuidedDraftAnchorGroups(cleanedCandidate, anchorGroups);
  const minTotalOverlap = anchorGroups.all.length >= 6 ? 2 : anchorGroups.all.length ? 1 : 0;
  const minGroupMatches = anchorMetrics.populatedGroupCount >= 3 ? 2 : (anchorMetrics.populatedGroupCount ? 1 : 0);
  const minCriticalOverlap = anchorGroups.critical.length >= 6 ? 2 : (anchorGroups.critical.length ? 1 : 0);
  const minEventOverlap = anchorGroups.event.length >= 4 ? 2 : (anchorGroups.event.length ? 1 : 0);
  if (anchorMetrics.totalOverlap < minTotalOverlap) {
    return { accepted: false, reason: 'low-overlap', narrative: cleanedCandidate };
  }
  if (anchorMetrics.matchedGroupCount < minGroupMatches) {
    return { accepted: false, reason: 'narrow-anchor-coverage', narrative: cleanedCandidate };
  }
  if (anchorMetrics.eventLikeOverlap === 0 && (anchorGroups.event.length || anchorGroups.narrative.length)) {
    return { accepted: false, reason: 'missing-event-anchor', narrative: cleanedCandidate };
  }
  if (minEventOverlap && anchorMetrics.eventOverlap < minEventOverlap && anchorMetrics.causeOverlap === 0) {
    return { accepted: false, reason: 'weak-event-anchor-coverage', narrative: cleanedCandidate };
  }
  if (anchorMetrics.criticalOverlap < minCriticalOverlap) {
    return { accepted: false, reason: 'weak-critical-anchor-overlap', narrative: cleanedCandidate };
  }
  const actualLens = classifyScenario(cleanedCandidate, { guidedInput, businessUnit, scenarioLensHint: expectedLens }).key;
  if (!isCompatibleScenarioLens(expectedLens, actualLens)) {
    return { accepted: false, reason: 'lens-drift', narrative: cleanedCandidate };
  }
  return { accepted: true, reason: 'accepted', narrative: cleanedCandidate };
}

function buildAiAlignment(input = {}, result = {}, {
  classification = {},
  seedNarrative = '',
  fallbackScenarioExpansion = null,
  shortlistCoherence = null
} = {}) {
  const expectedLens = (classification?.key && classification.key !== 'general')
    ? classification.key
    : (normaliseScenarioHintKey(input.scenarioLensHint) || classification.key || 'general');
  const resolvedLens = normaliseScenarioLens(result?.scenarioLens, buildScenarioLens(classification));
  const draftNarrative = cleanUserFacingText(result?.draftNarrative || result?.enhancedStatement || seedNarrative, { maxSentences: 6 });
  const draftCandidate = evaluateGuidedDraftCandidate(draftNarrative, {
    seedNarrative,
    guidedInput: input.guidedInput,
    scenarioLensHint: expectedLens,
    businessUnit: input.businessUnit
  });
  const actualNarrativeLens = classifyScenario(draftNarrative || seedNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: expectedLens
  }).key;
  const structured = result?.structuredScenario && typeof result.structuredScenario === 'object' ? result.structuredScenario : {};
  const structuredCount = ['assetService', 'primaryDriver', 'eventPath', 'effect'].filter((field) => cleanUserFacingText(structured[field] || '', { maxSentences: field === 'effect' ? 2 : 1, stripTrailingPeriod: field !== 'effect' })).length;
  const risks = normaliseRiskCards(Array.isArray(result?.risks) && result.risks.length ? result.risks : (fallbackScenarioExpansion?.riskTitles || []), input.applicableRegulations || []);
  const narrativeAnchors = extractGuidedDraftAnchors({ guidedInput: input.guidedInput }, seedNarrative || draftNarrative);
  const alignedRiskCount = risks.filter((risk) => {
    const riskText = `${risk?.title || ''} ${risk?.description || ''}`;
    const riskLens = classifyScenario(riskText, {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: expectedLens
    }).key;
    const lensCompatible = !riskLens || isCompatibleScenarioLens(resolvedLens.key, riskLens) || (Array.isArray(resolvedLens.secondaryKeys) && resolvedLens.secondaryKeys.some((key) => key === riskLens || isCompatibleScenarioLens(key, riskLens)));
    const anchorCompatible = !narrativeAnchors.length || countScenarioAnchorOverlap(riskText, narrativeAnchors) > 0;
    return lensCompatible && anchorCompatible;
  }).length;
  const shortlistAlignedCount = Number(shortlistCoherence?.alignedCount || alignedRiskCount);
  const shortlistTotalCount = Number(shortlistCoherence?.returnedCount || risks.length);
  const shortlistMode = String(shortlistCoherence?.mode || 'accepted').trim();
  const checks = [
    {
      label: 'Primary lens',
      status: isCompatibleScenarioLens(expectedLens, resolvedLens.key) && isCompatibleScenarioLens(expectedLens, actualNarrativeLens) ? 'ok' : 'warning',
      detail: isCompatibleScenarioLens(expectedLens, resolvedLens.key) && isCompatibleScenarioLens(expectedLens, actualNarrativeLens)
        ? `${resolvedLens.label} stayed consistent with the intended scenario domain.`
        : `The draft was corrected back toward the ${buildScenarioLens({ key: expectedLens }).label.toLowerCase()} lens.`
    },
    {
      label: 'Scenario draft',
      status: draftCandidate.accepted ? 'ok' : 'warning',
      detail: draftCandidate.accepted
        ? 'The draft stayed close to the user event, impact, and current function context.'
        : 'The draft was forced back toward the user statement because the first rewrite was too generic or too far from the described event.'
    },
    {
      label: 'Structured scenario',
      status: structuredCount >= 3 ? 'ok' : 'warning',
      detail: structuredCount >= 3
        ? `${structuredCount} core scenario fields were filled for downstream quantification.`
        : 'The draft needed fallback structure because too much scenario detail was missing.'
    },
    {
      label: 'Shortlist fit',
      status: shortlistTotalCount && shortlistAlignedCount >= Math.max(1, Math.ceil(shortlistTotalCount / 2)) ? 'ok' : 'warning',
      detail: shortlistTotalCount
        ? `${shortlistAlignedCount} of ${shortlistTotalCount} suggested risks stay aligned with the current event path and scenario lens${shortlistMode === 'accepted' ? '.' : (shortlistMode === 'filtered' ? ', after server filtering.' : ', after the raw shortlist was replaced with taxonomy-safe seeds.')}`
        : 'No candidate risks were returned, so the shortlist falls back to deterministic server seeds.'
    }
  ];
  const score = checks.reduce((sum, check) => sum + (check.status === 'ok' ? 25 : 10), 0);
  return {
    label: score >= 85 ? 'Aligned and grounded' : score >= 65 ? 'Mostly aligned' : 'Needs review',
    score,
    summary: `AI kept the draft in the ${resolvedLens.label.toLowerCase()} lens and aligned ${shortlistAlignedCount} of ${Math.max(shortlistTotalCount, 1)} suggested risks.`,
    checks,
    taxonomy: {
      version: String(classification?.taxonomyVersion || '').trim(),
      domain: String(classification?.domain || '').trim(),
      primaryFamilyKey: String(classification?.primaryFamily?.key || '').trim(),
      secondaryFamilyKeys: Array.isArray(classification?.secondaryFamilies) ? classification.secondaryFamilies.map((family) => family?.key).filter(Boolean) : [],
      overlays: Array.isArray(classification?.overlays) ? classification.overlays.map((overlay) => overlay?.key).filter(Boolean) : [],
      mechanisms: Array.isArray(classification?.mechanisms) ? classification.mechanisms.map((mechanism) => mechanism?.key).filter(Boolean) : [],
      reasonCodes: Array.isArray(classification?.reasonCodes) ? classification.reasonCodes.slice(0, 8) : [],
      ambiguityFlags: Array.isArray(classification?.ambiguityFlags) ? classification.ambiguityFlags.slice(0, 6) : [],
      confidenceScore: Number(classification?.confidenceScore || 0),
      confidenceBand: String(classification?.confidenceBand || '').trim(),
      confidenceDrivers: Array.isArray(classification?.confidenceDrivers) ? classification.confidenceDrivers.slice(0, 8) : [],
      calibrationMode: String(classification?.calibrationMode || '').trim()
    }
  };
}

function buildServerFallbackResult(input = {}, { aiUnavailable = false, feedbackProfile = null, traceLabel = 'Step 1 guided draft' } = {}) {
  const seedNarrative = cleanUserFacingText(cleanScenarioSeed(input.riskStatement || ''), { maxSentences: 5 });
  const classification = classifyScenario(seedNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: input.scenarioLensHint
  });
  const fallbackScenarioExpansion = buildScenarioExpansion({
    ...input,
    riskStatement: seedNarrative
  }, classification);
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  const fallbackRisks = rerankRiskCardsWithFeedback(fallbackScenarioExpansion.riskTitles, feedbackProfile);
  const shortlistCoherence = enforceScenarioShortlistCoherence(fallbackRisks, {
    acceptedClassification: classification,
    finalNarrative: fallbackScenarioExpansion.scenarioExpansion,
    seedNarrative,
    input,
    fallbackRisks
  });
  const result = buildDeterministicFallbackResult({
    baseResult: {
      seedNarrative,
      draftNarrative: fallbackScenarioExpansion.scenarioExpansion,
      draftNarrativeSource: 'fallback',
      draftNarrativeReason: aiUnavailable ? 'proxy_unavailable' : 'quality_fallback',
      enhancedStatement: fallbackScenarioExpansion.scenarioExpansion,
      summary: fallbackScenarioExpansion.summary,
      linkAnalysis: buildRiskContextLinkAnalysis({
        classification,
        riskTitles: fallbackRisks
      }),
      workflowGuidance: [
        'Confirm the scenario wording in plain English before moving on.',
        'Keep only the risks that clearly belong in the same event path and business consequence chain.',
        'Challenge any assumption that does not fit the business context or known incident history.'
      ],
      benchmarkBasis: 'This Step 1 draft is in deterministic server fallback mode. Treat it as a bounded working draft until live AI is available again.',
      scenarioLens: buildScenarioLens(classification),
      structuredScenario: buildStructuredScenario(input, classification),
      risks: shortlistCoherence.risks,
      regulations: Array.from(new Set([...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []), ...shortlistCoherence.risks.flatMap((risk) => risk.regulations || [])].map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    aiUnavailable,
    traceLabel,
    promptSummary: 'Server deterministic fallback used for Step 1 guided draft.',
    response: fallbackScenarioExpansion.scenarioExpansion,
    sources: input.citations || [],
    evidenceMeta,
    withEvidenceMeta,
    includeReasonFields: false
  });
  result.shortlistCoherence = shortlistCoherence;
  result.aiAlignment = buildAiAlignment(input, result, {
    classification,
    seedNarrative,
    fallbackScenarioExpansion,
    shortlistCoherence
  });
  return result;
}

function buildScenarioDraftValidationText(input = {}) {
  return cleanUserFacingText(cleanScenarioSeed([
    input.riskStatement,
    input?.guidedInput?.event,
    input?.guidedInput?.asset,
    input?.guidedInput?.cause,
    input?.guidedInput?.impact
  ].filter(Boolean).join('. ')), { maxSentences: 5 });
}

function inferStep1MissingDetailPlan(input = {}, {
  seedNarrative = '',
  evidenceMeta = null,
  purpose = 'guided_draft'
} = {}) {
  const eventText = cleanUserFacingText(input?.guidedInput?.event || seedNarrative || '', { maxSentences: 1 });
  const assetText = cleanUserFacingText(input?.guidedInput?.asset || '', { maxSentences: 1, stripTrailingPeriod: true });
  const impactText = cleanUserFacingText(input?.guidedInput?.impact || '', { maxSentences: 1 });
  const causeText = cleanUserFacingText(input?.guidedInput?.cause || '', { maxSentences: 1, stripTrailingPeriod: true });
  const text = String(seedNarrative || '').trim();
  const tooThin = !text || text.length < 35;
  const classification = classifyScenario(
    [eventText, assetText, causeText, impactText, text]
      .filter(Boolean)
      .join('. '),
    {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: input.scenarioLensHint
    }
  );
  const lensKey = String(buildScenarioLens(classification)?.key || 'general').trim();
  const primaryFamilyKey = String(classification?.primaryFamily?.key || '').trim();
  const isThirdParty = lensKey === 'third-party' || /(supplier|vendor|third_party|procurement)/i.test(primaryFamilyKey);
  const isFinancial = lensKey === 'financial' || /(payment|receivable|counterparty|credit|invoice)/i.test(primaryFamilyKey);
  const isWorkforce = lensKey === 'people-workforce' || /(fatigue|workforce|forced_labou?r|slavery|staff)/i.test(primaryFamilyKey);
  const isContinuity = lensKey === 'business-continuity' || /(business_continuity|dr_gap|failover|recovery)/i.test(primaryFamilyKey);
  const isCyber = lensKey === 'cyber' || /(identity|credential|availability_attack|ransom|malware|phishing|cyber)/i.test(primaryFamilyKey);
  const isTransformation = lensKey === 'transformation-delivery' || /(transformation|programme|delivery_slippage|rollout)/i.test(primaryFamilyKey);
  const isPrivacy = /(privacy|retention|transfer|disclosure|personal_data|records)/i.test(primaryFamilyKey);
  const isEsgOrHse = ['esg', 'hse'].includes(lensKey) || /(greenwashing|forced_labou?r|safety|environment)/i.test(primaryFamilyKey);
  const resolveAssetPrompt = () => {
    if (isThirdParty) return 'Name the supplier, dependency, milestone, or service affected.';
    if (isFinancial) return 'Name the payment step, receivable, counterparty, or control affected.';
    if (isWorkforce) return 'Name the team, role, site, or activity under strain.';
    if (isContinuity) return 'Name the site, service, process, or critical task affected.';
    if (isCyber) return 'Name the account, system, service, or tenant affected.';
    if (isTransformation) return 'Name the rollout, programme, milestone, site, or dependency affected.';
    if (isPrivacy) return 'Name the records, dataset, transfer path, or processing activity affected.';
    if (isEsgOrHse) return 'Name the claim, site, supplier, workforce group, or activity affected.';
    return 'Name the asset, service, dependency, or process affected.';
  };
  const resolveCausePrompt = () => {
    if (isThirdParty) return 'Add the delivery miss, supplier trigger, access weakness, or third-party failure that started it.';
    if (isFinancial) return 'Add the approval gap, control failure, insolvency trigger, or fraud driver.';
    if (isWorkforce) return 'Add the staffing weakness, fatigue driver, labour issue, or operating pressure that triggered it.';
    if (isContinuity) return 'Add the outage trigger, failover gap, recovery weakness, or site event that triggered it.';
    if (isCyber) return 'Add the attack path, control weakness, credential issue, or hostile trigger.';
    if (isTransformation) return 'Add the delivery miss, exception, site-access constraint, or programme trigger.';
    if (isPrivacy) return 'Add the retention weakness, transfer step, or control gap that triggered it.';
    if (isEsgOrHse) return 'Add the unsupported claim, supplier abuse, safety trigger, or environmental control gap.';
    return 'Add the likely trigger or threat driver.';
  };
  let focusKey = '';
  let focusPrompt = '';
  if (!eventText || tooThin) {
    focusKey = 'event';
    focusPrompt = 'State what happened or could happen in one plain sentence.';
  } else if (!assetText) {
    focusKey = 'asset';
    focusPrompt = resolveAssetPrompt();
  } else if (!impactText) {
    focusKey = 'impact';
    focusPrompt = 'Add the main business impact or why it matters.';
  } else if (!causeText) {
    focusKey = 'cause';
    focusPrompt = resolveCausePrompt();
  } else if (Array.isArray(evidenceMeta?.missingInformation) && evidenceMeta.missingInformation.some((item) => /Geographic scope/i.test(String(item || '')))) {
    focusKey = 'geography';
    focusPrompt = 'Add the geography if the exposure or obligations change by location.';
  } else {
    focusKey = 'event';
    focusPrompt = 'Tighten the event wording so the same event path stays explicit.';
  }

  const actionTextByPurpose = {
    guided_draft: 'before trying AI draft generation again',
    refinement: 'before asking the server to refine the draft',
    intake_assist: 'before asking the server to shape the intake draft',
    shortlist: 'before generating a shortlist'
  };
  const actionText = actionTextByPurpose[purpose] || actionTextByPurpose.guided_draft;
  return {
    focusKey,
    focusPrompt,
    summary: focusKey === 'event'
      ? 'The current scenario text is still too vague about the main event path.'
      : focusKey === 'asset'
        ? 'The current draft does not clearly name what is affected.'
        : focusKey === 'impact'
          ? 'The current draft does not clearly state the main business impact.'
          : focusKey === 'cause'
            ? 'The current draft is missing the likely trigger or threat driver.'
            : 'The current draft needs one more concrete detail before the server should shape it further.',
    linkAnalysis: `${focusPrompt} ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}.`,
    guidance: uniqueKeys([
      focusPrompt,
      focusKey !== 'event' ? 'Keep the scenario to one clear event path.' : 'Avoid listing only consequences without the triggering event.',
      focusKey !== 'asset' ? resolveAssetPrompt() : '',
      focusKey !== 'impact' ? 'Add the main business impact so the draft can stay aligned.' : '',
      focusKey !== 'cause' ? resolveCausePrompt() : ''
    ]).slice(0, 3),
    reasonMessage: `${focusPrompt} ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`
  };
}

function hasMeaningfulScenarioDraftInput(input = {}) {
  const text = buildScenarioDraftValidationText(input);
  const tokens = (text.match(/[a-z0-9]{2,}/gi) || []).length;
  return !!text && ((text.length >= 10 && tokens >= 2) || tokens >= 3);
}

function buildManualScenarioDraftResult(input = {}, { traceLabel = 'Step 1 guided draft' } = {}) {
  const seedNarrative = buildScenarioDraftValidationText(input);
  const classification = classifyScenario(seedNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: input.scenarioLensHint
  });
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  const missingDetailPlan = inferStep1MissingDetailPlan(input, {
    seedNarrative,
    evidenceMeta,
    purpose: 'guided_draft'
  });
  return buildManualModeResult({
    baseResult: {
      seedNarrative,
      draftNarrative: '',
      draftNarrativeSource: 'manual',
      draftNarrativeReason: 'input_incomplete',
      enhancedStatement: '',
      summary: missingDetailPlan.summary,
      linkAnalysis: missingDetailPlan.linkAnalysis,
      workflowGuidance: missingDetailPlan.guidance,
      benchmarkBasis: 'This step stayed in manual mode because the current scenario text is too limited for a reliable server draft.',
      scenarioLens: buildScenarioLens(classification),
      structuredScenario: buildStructuredScenario({ ...input, riskStatement: seedNarrative }, classification),
      risks: [],
      regulations: Array.from(new Set((Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    manualReason: {
      code: 'incomplete_scenario_input',
      title: 'Manual draft only',
      message: missingDetailPlan.reasonMessage
    },
    traceLabel,
    promptSummary: 'Server manual mode used for Step 1 guided draft because the input was too short or incomplete.',
    response: 'The guided draft stayed in manual mode because the scenario input was incomplete.',
    sources: input.citations || [],
    evidenceMeta,
    withEvidenceMeta
  });
}

function normaliseScenarioDraftCandidate(parsed = {}, fallback = {}, input = {}, classification = {}) {
  const fallbackLens = buildScenarioLens(classification);
  const risks = normaliseRiskCards(parsed?.risks, input.applicableRegulations || []);
  return {
    draftNarrative: cleanUserFacingText(parsed?.draftNarrative || parsed?.enhancedStatement || '', { maxSentences: 6 }),
    enhancedStatement: cleanUserFacingText(parsed?.enhancedStatement || parsed?.draftNarrative || '', { maxSentences: 6 }),
    summary: cleanUserFacingText(parsed?.summary || fallback.summary || '', { maxSentences: 3 }),
    linkAnalysis: cleanUserFacingText(parsed?.linkAnalysis || buildRiskContextLinkAnalysis({ classification, riskTitles: risks.length ? risks : fallback.riskTitles }), { maxSentences: 3 }),
    workflowGuidance: normaliseGuidance(parsed?.workflowGuidance?.length ? parsed.workflowGuidance : fallback.workflowGuidance || []),
    benchmarkBasis: cleanUserFacingText(parsed?.benchmarkBasis || fallback.benchmarkBasis || '', { maxSentences: 3 }),
    scenarioLens: normaliseScenarioLens(parsed?.scenarioLens, fallbackLens),
    structuredScenario: {
      assetService: cleanUserFacingText(parsed?.structuredScenario?.assetService || fallback.structuredScenario?.assetService || '', { maxSentences: 1, stripTrailingPeriod: true }),
      primaryDriver: cleanUserFacingText(parsed?.structuredScenario?.primaryDriver || fallback.structuredScenario?.primaryDriver || '', { maxSentences: 1, stripTrailingPeriod: true }),
      eventPath: cleanUserFacingText(parsed?.structuredScenario?.eventPath || fallback.structuredScenario?.eventPath || '', { maxSentences: 1, stripTrailingPeriod: true }),
      effect: cleanUserFacingText(parsed?.structuredScenario?.effect || fallback.structuredScenario?.effect || '', { maxSentences: 2 })
    },
    risks,
    citations: Array.isArray(input.citations) ? input.citations : []
  };
}

const SCENARIO_DRAFT_TIMEOUTS = buildWorkflowTimeoutProfile({
  liveMs: 24000,
  repairMs: 10000,
  qualityMs: 12000,
  qualityRepairMs: 8000
});

async function buildGuidedScenarioDraftWorkflow(input = {}) {
  input = normaliseGuidedScenarioDraftInput(input);
  const traceLabel = sanitizeAiText(input.traceLabel || 'Step 1 guided draft', { maxChars: 120 }) || 'Step 1 guided draft';
  if (!hasMeaningfulScenarioDraftInput(input)) {
    return buildManualScenarioDraftResult(input, { traceLabel });
  }
  const feedbackProfile = await resolveHierarchicalFeedbackProfile({
    username: input.session?.username || '',
    buId: input.businessUnit?.id || input.businessUnit?.buId || '',
    functionKey: input.businessUnit?.selectedDepartmentKey || input.businessUnit?.functionKey || '',
    scenarioLensKey: input.scenarioLensHint || ''
  });
  const config = getCompassProviderConfig();
  if (!config.proxyConfigured) {
    return buildServerFallbackResult(input, { aiUnavailable: true, feedbackProfile, traceLabel });
  }

  const seedNarrative = cleanUserFacingText(cleanScenarioSeed(input.riskStatement || ''), { maxSentences: 5 });
  const classification = classifyScenario(seedNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: input.scenarioLensHint
  });
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  const defaultWorkflowGuidance = [
    'Confirm the scenario wording in plain English before moving on.',
    'Keep only the risks that clearly belong in the same event path and business consequence chain.',
    'Challenge any assumption that does not fit the business context or known incident history.'
  ];
  const defaultBenchmarkBasis = 'Prefer GCC and UAE benchmark references where credible, then fall back to the closest global enterprise comparator.';
  const defaultStructuredScenario = buildStructuredScenario(input, classification);
  let fallbackScenarioExpansion = null;
  const getFallbackScenarioExpansion = () => {
    if (!fallbackScenarioExpansion) {
      fallbackScenarioExpansion = buildScenarioExpansion({
        ...input,
        riskStatement: seedNarrative
      }, classification);
    }
    return fallbackScenarioExpansion;
  };
  const outputSchema = `{
  "draftNarrative": "string",
  "summary": "string",
  "linkAnalysis": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "scenarioLens": {
    "key": "string",
    "label": "string",
    "functionKey": "string",
    "estimatePresetKey": "string",
    "secondaryKeys": ["string"]
  },
  "structuredScenario": {
    "assetService": "string",
    "primaryDriver": "string",
    "eventPath": "string",
    "effect": "string"
  },
  "risks": [
    {
      "title": "string",
      "category": "string",
      "description": "string",
      "confidence": "high|medium|low",
      "regulations": ["string"]
    }
  ]
}`;
  const systemPrompt = `You are a senior enterprise risk analyst building a Step 1 guided scenario draft.

Return JSON only with this schema:
${outputSchema}

Rules:
- keep the user's described event path primary
- do not drift into adjacent domains
- technical assets like cloud, Azure, systems, infrastructure, admin accounts, or email do not by themselves justify changing the scenario domain
- if the user describes identity compromise, account takeover, mailbox compromise, leaked credentials, or dark-web credential discovery, stay in that lane
- if the user describes outage, aging infrastructure, supplier delivery slippage, human error, or service instability without explicit compromise signals, do not force cyber
- write the draft like a concise management briefing
- keep risk titles short, card-friendly, and aligned to the same event path`;
  const priorityPromptBlock = buildGuidedScenarioPriorityPromptBlock(input, {
    seedNarrative,
    classification
  });
  const scopedContextPromptBlock = buildGuidedScenarioContextPromptBlock(input.adminSettings || {}, input.businessUnit || null);
  const evidencePromptBlock = buildGuidedScenarioEvidencePromptBlock(evidenceMeta);
  const citationPromptBlock = buildGuidedCitationPromptBlock(input.citations || [], {
    seedNarrative,
    input,
    classification
  });
  const userPrompt = `Guided scenario seed:
${seedNarrative || '(none)'}

Guided intake:
${truncateText(JSON.stringify(input.guidedInput || {}, null, 2), 900)}

${priorityPromptBlock}

Business unit:
${JSON.stringify({
    name: input.businessUnit?.name || '',
    contextSummary: truncateText(input.businessUnit?.contextSummary || input.businessUnit?.notes || '', 420),
    selectedDepartmentContext: truncateText(input.businessUnit?.selectedDepartmentContext || '', 280),
    aiGuidance: truncateText(input.businessUnit?.aiGuidance || '', 280)
  }, null, 2)}

Geography:
${sanitizeAiText(input.geography || '', { maxChars: 200 }) || '(none)'}

Applicable regulations:
${Array.isArray(input.applicableRegulations) && input.applicableRegulations.length ? input.applicableRegulations.map((item) => `- ${item}`).join('\n') : '(none)'}

Live scoped context:
${scopedContextPromptBlock}

Evidence quality context:
${evidencePromptBlock}

Retrieved references:
${citationPromptBlock}

If you are unsure, stay closer to the user's explicit event wording than to adjacent profile, compliance, or technology context.`;
  const feedbackPromptBlock = buildFeedbackLearningPromptBlock(feedbackProfile);
  const learningAwareUserPrompt = `${userPrompt}

${feedbackPromptBlock}`;

  try {
    const generation = await callAi(systemPrompt, learningAwareUserPrompt, {
      taskName: 'guidedScenarioDraft',
      temperature: 0.2,
      maxCompletionTokens: 2200,
      maxPromptChars: 18000,
      timeoutMs: SCENARIO_DRAFT_TIMEOUTS.liveMs,
      priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, outputSchema, {
      taskName: 'repairGuidedScenarioDraft',
      timeoutMs: SCENARIO_DRAFT_TIMEOUTS.repairMs
    });
    let candidate = normaliseScenarioDraftCandidate(parsed?.parsed || {}, {
      summary: buildRiskContextSummary({
        classification,
        asset: defaultStructuredScenario.assetService,
        impact: defaultStructuredScenario.effect,
        riskTitles: []
      }),
      linkAnalysis: buildRiskContextLinkAnalysis({ classification, riskTitles: [] }),
      workflowGuidance: defaultWorkflowGuidance,
      benchmarkBasis: defaultBenchmarkBasis,
      structuredScenario: defaultStructuredScenario
    }, input, classification);

    try {
      const qualityChecked = await runStructuredQualityGate({
        taskName: 'guidedScenarioDraftQualityGate',
        schemaHint: outputSchema,
        originalContext: [
          `Guided seed: ${seedNarrative || '(none)'}`,
          `Guided intake: ${JSON.stringify(input.guidedInput || {})}`,
          priorityPromptBlock,
          `Business unit: ${input.businessUnit?.name || 'Unknown'}`,
          `Geography: ${input.geography || 'Unknown'}`,
          `Applicable regulations: ${(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).join(', ') || '(none)'}`,
          `Live context: ${truncateText(scopedContextPromptBlock, 1800)}`,
          `Evidence quality context: ${truncateText(evidencePromptBlock, 600)}`,
          `Retrieved references: ${truncateText(citationPromptBlock, 1200)}`
        ].join('\n'),
        checklist: [
          'Keep the draft in the same event path as the user narrative.',
          'Preserve the explicit event anchor before consequence, regulatory, or technology context.',
          'Do not accept impact-only or consequence-heavy rewrites if they drop the user event, cause, or affected asset.',
          'Do not drift into compliance, operational, financial, or cyber framing unless the event clearly supports it.',
          'Use the strongest directly matched grounding sources first and avoid decorative citations.',
          'Keep the risk shortlist tightly aligned to the same event tree.',
          'Keep the structured scenario populated enough for downstream quantification.'
        ],
        candidatePayload: candidate,
        timeoutMs: SCENARIO_DRAFT_TIMEOUTS.qualityMs,
        repairTimeoutMs: SCENARIO_DRAFT_TIMEOUTS.qualityRepairMs
      });
      if (qualityChecked?.parsed) {
        candidate = normaliseScenarioDraftCandidate(qualityChecked.parsed, {
          summary: candidate.summary,
          linkAnalysis: candidate.linkAnalysis,
          workflowGuidance: candidate.workflowGuidance,
          benchmarkBasis: candidate.benchmarkBasis,
          structuredScenario: defaultStructuredScenario
        }, input, classification);
      }
    } catch (qualityGateError) {
      console.warn('guided scenario draft quality gate fallback:', qualityGateError.message);
    }

    const selectedDraft = evaluateGuidedDraftCandidate(candidate.draftNarrative || candidate.enhancedStatement || '', {
      seedNarrative,
      guidedInput: input.guidedInput,
      scenarioLensHint: input.scenarioLensHint || classification.key,
      businessUnit: input.businessUnit
    });
    const useFallbackNarrative = !selectedDraft.accepted;
    const rerankedCandidateRisks = rerankRiskCardsWithFeedback(candidate.risks, feedbackProfile);
    const finalNarrative = useFallbackNarrative
      ? getFallbackScenarioExpansion().scenarioExpansion
      : (selectedDraft.narrative || candidate.draftNarrative || candidate.enhancedStatement || seedNarrative);
    const finalClassification = resolveAcceptedScenarioClassification(finalNarrative, input, classification);
    const fallbackExpansion = buildScenarioExpansion({
      ...input,
      riskStatement: finalNarrative
    }, finalClassification);
    const rerankedFallbackRisks = rerankRiskCardsWithFeedback(fallbackExpansion.riskTitles, feedbackProfile);
    const shortlistCoherence = enforceScenarioShortlistCoherence(rerankedCandidateRisks, {
      acceptedClassification: finalClassification,
      finalNarrative,
      seedNarrative,
      input,
      fallbackRisks: rerankedFallbackRisks
    });
    const finalRisks = shortlistCoherence.risks;
    const finalSummary = useFallbackNarrative
      ? (fallbackExpansion.summary || candidate.summary || '')
      : (candidate.summary || fallbackExpansion.summary || '');
    const finalLinkAnalysis = (useFallbackNarrative || shortlistCoherence.mode !== 'accepted')
      ? buildRiskContextLinkAnalysis({ classification: finalClassification, riskTitles: finalRisks })
      : (candidate.linkAnalysis || buildRiskContextLinkAnalysis({ classification: finalClassification, riskTitles: finalRisks }));
    const finalScenarioLens = useFallbackNarrative
      ? normaliseScenarioLens({
          secondaryKeys: [
            candidate?.scenarioLens?.key,
            ...(Array.isArray(candidate?.scenarioLens?.secondaryKeys) ? candidate.scenarioLens.secondaryKeys : [])
          ]
        }, buildScenarioLens(finalClassification))
      : normaliseScenarioLens(candidate.scenarioLens, buildScenarioLens(finalClassification));
    const result = withEvidenceMeta({
      mode: useFallbackNarrative ? 'deterministic_fallback' : 'live',
      seedNarrative,
      draftNarrative: finalNarrative,
      draftNarrativeSource: useFallbackNarrative ? 'fallback' : 'ai',
      draftNarrativeReason: useFallbackNarrative ? (selectedDraft.reason || 'quality_fallback') : 'accepted',
      enhancedStatement: finalNarrative,
      summary: finalSummary,
      linkAnalysis: finalLinkAnalysis,
      workflowGuidance: candidate.workflowGuidance?.length ? candidate.workflowGuidance : defaultWorkflowGuidance,
      benchmarkBasis: candidate.benchmarkBasis || defaultBenchmarkBasis,
      scenarioLens: finalScenarioLens,
      structuredScenario: {
        ...defaultStructuredScenario,
        ...(candidate.structuredScenario || {})
      },
      risks: finalRisks,
      regulations: Array.from(new Set([...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []), ...finalRisks.flatMap((risk) => risk.regulations || [])].map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : [],
      usedFallback: useFallbackNarrative,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: finalNarrative,
        sources: input.citations || []
      })
    }, evidenceMeta);
    result.shortlistCoherence = shortlistCoherence;
    result.aiAlignment = buildAiAlignment(input, result, {
      classification: finalClassification,
      seedNarrative,
      fallbackScenarioExpansion: fallbackExpansion,
      shortlistCoherence
    });
    return result;
  } catch (error) {
    return buildFallbackFromError({
      error,
      buildFallbackResult: ({ normalisedError }) => {
        console.warn('buildGuidedScenarioDraftWorkflow server fallback:', normalisedError.message);
        return buildServerFallbackResult(input, { aiUnavailable: true, feedbackProfile, traceLabel });
      }
    });
  }
}

module.exports = {
  buildGuidedScenarioDraftWorkflow,
  normaliseGuidedScenarioDraftInput,
  workflowUtils: {
    buildAiAlignment,
    buildClassificationAnchor,
    buildGuidedCitationPromptBlock,
    buildGuidedDraftAnchorGroups,
    buildGuidedScenarioContextPromptBlock,
    buildGuidedScenarioEvidencePromptBlock,
    buildGuidedScenarioPriorityPromptBlock,
    buildResolvedObligationPromptBlock,
    buildContextPromptBlock,
    buildEvidenceMeta,
    buildRiskContextLinkAnalysis,
    buildRiskContextSummary,
    buildScenarioDraftValidationText,
    buildScenarioExpansion,
    buildScenarioLens,
    buildStructuredScenario,
    classifyScenario,
    cleanScenarioSeed,
    compactInputValue,
    cleanUserFacingText,
    evaluateGuidedDraftCandidate,
    inferStep1MissingDetailPlan,
    isCompatibleScenarioLens,
    isPlainObject,
    normaliseAdminSettingsInput,
    normaliseBlockInputText,
    normaliseBusinessUnitInput,
    normaliseCitationInputs,
    normaliseGuidance,
    normaliseInlineInputText,
    normaliseScenarioLens,
    normalisePriorMessagesInput,
    normaliseResolvedObligationContextInput,
    normaliseResolvedObligationEntryInput,
    normaliseRiskCards,
    rankScenarioCitationsForPrompt,
    enforceScenarioShortlistCoherence,
    normaliseStringListInput,
    truncateText,
    withEvidenceMeta
  }
};
