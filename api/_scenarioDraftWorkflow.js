'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const { buildTraceEntry, callAi, parseOrRepairStructuredJson, runStructuredQualityGate, sanitizeAiText } = require('./_aiOrchestrator');
const { buildDeterministicFallbackResult, buildFallbackFromError, buildManualModeResult, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const { buildFeedbackLearningPromptBlock, resolveHierarchicalFeedbackProfile, rerankRiskCardsWithFeedback } = require('./_learningAuthority');
const ScenarioClassification = require('./_scenarioClassification');

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
  return /(exploitative labor|exploitative labour|forced labor|forced labour|child labor|child labour|modern slavery|labor practice|labour practice|worker exploitation|worker abuse|human rights|living wage)/.test(String(text || '').toLowerCase());
}

function hasEsgDisclosureSignals(text = '') {
  return /(esg|sustainability|greenwashing|climate disclosure|sustainability disclosure|carbon|emission|net zero|scope 1|scope 2|scope 3|social impact)/.test(String(text || '').toLowerCase());
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
  const anchors = extractGuidedDraftAnchors({ guidedInput }, seedNarrative);
  const overlap = anchors.filter((token) => cleanedCandidate.toLowerCase().includes(token));
  const minOverlap = anchors.length >= 5 ? 2 : anchors.length ? 1 : 0;
  if (overlap.length < minOverlap) {
    return { accepted: false, reason: 'low-overlap', narrative: cleanedCandidate };
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
  fallbackScenarioExpansion = null
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
      status: risks.length && alignedRiskCount >= Math.max(1, Math.ceil(risks.length / 2)) ? 'ok' : 'warning',
      detail: risks.length
        ? `${alignedRiskCount} of ${risks.length} suggested risks stay aligned with the current event path and scenario lens.`
        : 'No candidate risks were returned, so the shortlist falls back to deterministic server seeds.'
    }
  ];
  const score = checks.reduce((sum, check) => sum + (check.status === 'ok' ? 25 : 10), 0);
  return {
    label: score >= 85 ? 'Aligned and grounded' : score >= 65 ? 'Mostly aligned' : 'Needs review',
    score,
    summary: `AI kept the draft in the ${resolvedLens.label.toLowerCase()} lens and aligned ${alignedRiskCount} of ${Math.max(risks.length, 1)} suggested risks.`,
    checks,
    taxonomy: {
      version: String(classification?.taxonomyVersion || '').trim(),
      domain: String(classification?.domain || '').trim(),
      primaryFamilyKey: String(classification?.primaryFamily?.key || '').trim(),
      secondaryFamilyKeys: Array.isArray(classification?.secondaryFamilies) ? classification.secondaryFamilies.map((family) => family?.key).filter(Boolean) : [],
      overlays: Array.isArray(classification?.overlays) ? classification.overlays.map((overlay) => overlay?.key).filter(Boolean) : [],
      mechanisms: Array.isArray(classification?.mechanisms) ? classification.mechanisms.map((mechanism) => mechanism?.key).filter(Boolean) : [],
      reasonCodes: Array.isArray(classification?.reasonCodes) ? classification.reasonCodes.slice(0, 8) : [],
      ambiguityFlags: Array.isArray(classification?.ambiguityFlags) ? classification.ambiguityFlags.slice(0, 6) : []
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
      risks: fallbackRisks,
      regulations: Array.from(new Set([...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []), ...fallbackRisks.flatMap((risk) => risk.regulations || [])].map(String).filter(Boolean))),
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
  result.aiAlignment = buildAiAlignment(input, result, {
    classification,
    seedNarrative,
    fallbackScenarioExpansion
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
  return buildManualModeResult({
    baseResult: {
      seedNarrative,
      draftNarrative: '',
      draftNarrativeSource: 'manual',
      draftNarrativeReason: 'input_incomplete',
      enhancedStatement: '',
      summary: 'The current scenario text is too limited for the server to draft a useful scenario.',
      linkAnalysis: 'Add the event, affected asset or service, and main impact before trying AI draft generation again.',
      workflowGuidance: [
        'Describe the event or issue you are assessing in one plain sentence.',
        'Add the main impact or the asset, service, or team affected.',
        'Then try the guided draft again.'
      ],
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
      message: 'Add a clearer event, affected asset or service, or main impact before asking the server to draft the scenario.'
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
  const userPrompt = `Guided scenario seed:
${seedNarrative || '(none)'}

Guided intake:
${JSON.stringify(input.guidedInput || {}, null, 2)}

Business unit:
${JSON.stringify({
    name: input.businessUnit?.name || '',
    contextSummary: input.businessUnit?.contextSummary || input.businessUnit?.notes || '',
    selectedDepartmentContext: input.businessUnit?.selectedDepartmentContext || '',
    aiGuidance: input.businessUnit?.aiGuidance || ''
  }, null, 2)}

Geography:
${sanitizeAiText(input.geography || '', { maxChars: 200 }) || '(none)'}

Applicable regulations:
${Array.isArray(input.applicableRegulations) && input.applicableRegulations.length ? input.applicableRegulations.map((item) => `- ${item}`).join('\n') : '(none)'}

Live scoped context:
${buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null)}

Evidence quality context:
${evidenceMeta.promptBlock}

Retrieved references:
${buildCitationPromptBlock(input.citations || [])}

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
          `Business unit: ${input.businessUnit?.name || 'Unknown'}`,
          `Geography: ${input.geography || 'Unknown'}`,
          `Applicable regulations: ${(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).join(', ') || '(none)'}`,
          `Live context: ${truncateText(buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null), 1800)}`
        ].join('\n'),
        checklist: [
          'Keep the draft in the same event path as the user narrative.',
          'Do not drift into compliance, operational, financial, or cyber framing unless the event clearly supports it.',
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
    const fallbackExpansion = (useFallbackNarrative || !rerankedCandidateRisks.length)
      ? getFallbackScenarioExpansion()
      : null;
    const rerankedFallbackRisks = fallbackExpansion
      ? rerankRiskCardsWithFeedback(fallbackExpansion.riskTitles, feedbackProfile)
      : [];
    const finalNarrative = useFallbackNarrative
      ? fallbackExpansion.scenarioExpansion
      : (selectedDraft.narrative || candidate.draftNarrative || candidate.enhancedStatement || seedNarrative);
    const finalRisks = useFallbackNarrative || !rerankedCandidateRisks.length
      ? rerankedFallbackRisks
      : rerankedCandidateRisks;
    const finalScenarioLens = useFallbackNarrative
      ? normaliseScenarioLens({
          secondaryKeys: [
            candidate?.scenarioLens?.key,
            ...(Array.isArray(candidate?.scenarioLens?.secondaryKeys) ? candidate.scenarioLens.secondaryKeys : [])
          ]
        }, buildScenarioLens(classification))
      : candidate.scenarioLens;
    const result = withEvidenceMeta({
      mode: useFallbackNarrative ? 'deterministic_fallback' : 'live',
      seedNarrative,
      draftNarrative: finalNarrative,
      draftNarrativeSource: useFallbackNarrative ? 'fallback' : 'ai',
      draftNarrativeReason: useFallbackNarrative ? (selectedDraft.reason || 'quality_fallback') : 'accepted',
      enhancedStatement: finalNarrative,
      summary: candidate.summary || (fallbackExpansion?.summary || ''),
      linkAnalysis: candidate.linkAnalysis || buildRiskContextLinkAnalysis({ classification, riskTitles: finalRisks }),
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
    result.aiAlignment = buildAiAlignment(input, result, {
      classification,
      seedNarrative,
      fallbackScenarioExpansion: fallbackExpansion
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
    buildResolvedObligationPromptBlock,
    buildContextPromptBlock,
    buildEvidenceMeta,
    compactInputValue,
    cleanUserFacingText,
    isPlainObject,
    normaliseAdminSettingsInput,
    normaliseBlockInputText,
    normaliseBusinessUnitInput,
    normaliseCitationInputs,
    normaliseGuidance,
    normaliseInlineInputText,
    normalisePriorMessagesInput,
    normaliseResolvedObligationContextInput,
    normaliseResolvedObligationEntryInput,
    normaliseRiskCards,
    normaliseStringListInput,
    truncateText,
    withEvidenceMeta
  }
};
