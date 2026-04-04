'use strict';

const {
  SCENARIO_TAXONOMY,
  SCENARIO_TAXONOMY_DOMAINS,
  SCENARIO_TAXONOMY_OVERLAYS,
  SCENARIO_TAXONOMY_FAMILIES,
  SCENARIO_TAXONOMY_ACTIVE_FAMILIES,
  SCENARIO_TAXONOMY_FAMILY_BY_KEY,
  SCENARIO_TAXONOMY_MECHANISM_BY_KEY,
  SCENARIO_TAXONOMY_OVERLAY_BY_KEY
} = require('./_scenarioTaxonomy');

const STRENGTH_WEIGHTS = Object.freeze({
  strong: 9,
  medium: 5,
  weak: 2
});

const DOMAIN_DEFAULT_FAMILY = Object.freeze({
  cyber: 'identity_compromise',
  operational: 'service_delivery_failure',
  business_continuity: 'dr_gap',
  finance: 'payment_control_failure',
  fraud_integrity: 'payment_fraud',
  compliance: 'policy_breach',
  regulatory: 'regulatory_filing_failure',
  legal_contract: 'contract_liability',
  procurement: 'single_source_dependency',
  supply_chain: 'delivery_slippage',
  third_party: 'supplier_control_weakness',
  strategic_transformation: 'programme_delivery_slippage',
  esg_hse_people: 'forced_labour_modern_slavery',
  physical_ot: 'perimeter_breach'
});

const EXTRA_HINT_ALIASES = Object.freeze({
  technology: 'cyber',
  'cyber risk': 'cyber',
  'business continuity': 'business_continuity',
  continuity: 'business_continuity',
  'business-continuity': 'business_continuity',
  operations: 'operational',
  operational: 'operational',
  finance: 'finance',
  financial: 'finance',
  fraud: 'fraud_integrity',
  integrity: 'fraud_integrity',
  'fraud integrity': 'fraud_integrity',
  'fraud-integrity': 'fraud_integrity',
  compliance: 'compliance',
  privacy: 'compliance',
  regulatory: 'regulatory',
  legal: 'legal_contract',
  contract: 'legal_contract',
  'legal / contract': 'legal_contract',
  'legal-contract': 'legal_contract',
  procurement: 'procurement',
  'supply chain': 'supply_chain',
  'supply-chain': 'supply_chain',
  'third party': 'third_party',
  'third-party': 'third_party',
  strategic: 'strategic_transformation',
  transformation: 'strategic_transformation',
  'transformation-delivery': 'strategic_transformation',
  esg: 'esg_hse_people',
  hse: 'esg_hse_people',
  people: 'esg_hse_people',
  workforce: 'esg_hse_people',
  labour: 'esg_hse_people',
  labor: 'esg_hse_people',
  'human rights': 'esg_hse_people',
  physical: 'physical_ot',
  'physical security': 'physical_ot',
  'physical-security': 'physical_ot',
  ot: 'physical_ot',
  'ot resilience': 'physical_ot',
  'ot-resilience': 'physical_ot',
  general: 'general',
  ai: 'general',
  'ai risk': 'general',
  'model risk': 'general',
  'responsible ai': 'general'
});

const LENS_LABELS = Object.freeze({
  cyber: 'Cyber',
  operational: 'Operational',
  'business-continuity': 'Business continuity',
  financial: 'Financial',
  'fraud-integrity': 'Fraud / integrity',
  compliance: 'Compliance',
  regulatory: 'Regulatory',
  'legal-contract': 'Legal / contract',
  procurement: 'Procurement',
  'supply-chain': 'Supply chain',
  'third-party': 'Third-party',
  strategic: 'Strategic',
  'transformation-delivery': 'Transformation delivery',
  geopolitical: 'Geopolitical / market access',
  esg: 'ESG',
  hse: 'HSE',
  'physical-security': 'Physical security',
  'ot-resilience': 'OT / site resilience',
  'people-workforce': 'People / workforce',
  general: 'General enterprise risk'
});

const LENS_COMPATIBILITY = Object.freeze({
  cyber: ['identity', 'phishing', 'ransomware', 'cloud', 'data-breach', 'availability-attack'],
  identity: ['cyber', 'phishing', 'cloud', 'data-breach'],
  phishing: ['cyber', 'identity', 'fraud-integrity'],
  ransomware: ['cyber', 'data-breach', 'operational', 'business-continuity'],
  cloud: ['cyber', 'identity', 'data-breach', 'availability-attack'],
  'data-breach': ['cyber', 'identity', 'cloud', 'compliance'],
  'availability-attack': ['cyber', 'operational', 'business-continuity', 'ot-resilience'],
  operational: ['business-continuity', 'availability-attack', 'ot-resilience', 'physical-security', 'third-party', 'supply-chain'],
  'business-continuity': ['operational', 'availability-attack', 'supply-chain', 'ot-resilience', 'physical-security'],
  financial: ['fraud-integrity', 'compliance', 'regulatory', 'legal-contract'],
  'fraud-integrity': ['financial', 'compliance', 'regulatory'],
  compliance: ['regulatory', 'legal-contract', 'data-breach'],
  regulatory: ['compliance', 'legal-contract', 'geopolitical'],
  'legal-contract': ['compliance', 'regulatory', 'third-party', 'procurement'],
  procurement: ['supply-chain', 'third-party', 'transformation-delivery'],
  'supply-chain': ['procurement', 'third-party', 'transformation-delivery', 'business-continuity'],
  'third-party': ['procurement', 'supply-chain', 'cyber'],
  strategic: ['transformation-delivery', 'geopolitical', 'esg', 'people-workforce'],
  'transformation-delivery': ['strategic', 'supply-chain', 'procurement'],
  geopolitical: ['strategic', 'regulatory', 'supply-chain'],
  esg: ['compliance', 'third-party', 'procurement', 'hse', 'people-workforce'],
  hse: ['people-workforce', 'physical-security', 'ot-resilience', 'operational', 'esg'],
  'physical-security': ['operational', 'business-continuity', 'hse', 'ot-resilience'],
  'ot-resilience': ['operational', 'business-continuity', 'cyber', 'hse', 'physical-security'],
  'people-workforce': ['hse', 'esg', 'operational'],
  general: []
});

const OVERLAY_SIGNAL_MAP = Object.freeze({
  service_outage: ['outage', 'downtime', 'unavailable', 'service down', 'slow down', 'crash', 'degrade', 'degrades', 'degraded'],
  customer_harm: ['customer harm', 'customer impact', 'customer-facing', 'customers cannot', 'client impact'],
  direct_monetary_loss: ['direct monetary loss', 'financial loss', 'write-off', 'write off', 'funds transfer', 'cashflow strain', 'bad debt', 'loss event', 'monetary loss'],
  regulatory_scrutiny: ['regulatory scrutiny', 'regulator', 'regulatory', 'enforcement', 'sanctions', 'permit', 'licensing'],
  backlog_growth: ['backlog', 'queue growth', 'deferred work', 'delayed projects', 'downstream delay'],
  recovery_strain: ['recovery strain', 'recovery pressure', 'restoration delay', 'recovery burden', 'response strain'],
  reputational_damage: ['reputational', 'trust impact', 'brand damage', 'stakeholder scrutiny', 'public confidence'],
  data_exposure: ['data exposure', 'data breach', 'exfiltration', 'unauthorised disclosure', 'unauthorized disclosure', 'leaked data', 'exposed records', 'stolen data'],
  operational_disruption: ['operational disruption', 'service disruption', 'delayed delivery', 'instability', 'degraded service', 'dependent projects delayed'],
  control_breakdown: ['control failure', 'control breakdown', 'approval gap', 'policy breach', 'weak controls', 'override'],
  third_party_dependency: ['supplier', 'vendor', 'third-party', 'third party', 'dependency', 'outsourced'],
  legal_exposure: ['legal exposure', 'liability', 'litigation', 'contract claim', 'indemnity', 'legal challenge']
});

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function normaliseText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toHaystack(value = '') {
  const normalised = normaliseText(value);
  return normalised ? ` ${normalised} ` : ' ';
}

function hasSignal(text = '', signalText = '') {
  const needle = normaliseText(signalText);
  if (!needle) return false;
  return toHaystack(text).includes(` ${needle} `);
}

function signalText(signal = null) {
  if (!signal) return '';
  return String(signal.text || signal.signal || signal.value || signal || '').trim();
}

function signalStrength(signal = null) {
  const value = String(signal?.strength || 'medium').trim().toLowerCase();
  return STRENGTH_WEIGHTS[value] ? value : 'medium';
}

function strengthWeight(signal = null) {
  return STRENGTH_WEIGHTS[signalStrength(signal)] || STRENGTH_WEIGHTS.medium;
}

function matchSignalSet(text = '', signals = [], { familyKey = '', role = 'positive', source = 'family' } = {}) {
  return (Array.isArray(signals) ? signals : [])
    .filter((signal) => hasSignal(text, signalText(signal)))
    .map((signal) => ({
      text: signalText(signal),
      strength: signalStrength(signal),
      role,
      source,
      familyKey
    }));
}

function getFamilyExtraMatches(familyKey = '', text = '') {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) return [];
  const extra = [];
  const push = (signal) => extra.push({
    text: signal.text,
    strength: signal.strength || 'strong',
    role: signal.role || 'heuristic',
    source: 'heuristic',
    familyKey
  });

  if (familyKey === 'availability_attack') {
    if ((/malicious actors?|threat actors?|attackers?/.test(raw))
      && /(website|web site|online services?|internet-facing|public-facing|customer portal|portal|site|online platform)/.test(raw)
      && /traffic/.test(raw)
      && /(slow(?:ing|ed)? down|slow to|crash|degrad|unavailable|availability|disrupt)/.test(raw)) {
      push({ text: 'hostile traffic saturation', strength: 'strong' });
    }
  }
  if (familyKey === 'identity_compromise') {
    if (/(azure ad|entra|tenant|global admin|admin credentials|dark ?web|credential leak|stolen credential|account takeover|mailbox takeover)/.test(raw)) {
      push({ text: 'identity compromise path', strength: 'strong' });
    }
  }
  if (familyKey === 'cloud_control_failure') {
    if (/(tenant|azure|cloud|configuration|admin controls?|control plane|management plane)/.test(raw)
      && /(modify critical configurations?|unauthori[sz]ed configuration change|control change|misconfig|misconfiguration)/.test(raw)) {
      push({ text: 'cloud control change pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'data_disclosure') {
    if (/(leaked data|data (?:is )?extracted|data extraction|records extracted|stolen data|data exfiltration|exfiltrat|exposed records)/.test(raw)) {
      push({ text: 'explicit data extraction pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'payment_control_failure') {
    if (/(payment|funds transfer|treasury|invoice|approval)/.test(raw) && /(control|failed|failure|approval gap|weak(?:ness)?|unauthori[sz]ed)/.test(raw)) {
      push({ text: 'payment control weakness', strength: 'strong' });
    }
  }
  if (familyKey === 'invoice_fraud') {
    if (/(fake invoice|false invoice|invoice scam|duplicate invoice)/.test(raw)) {
      push({ text: 'invoice deception pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'payment_fraud') {
    if (/(fraudulent payment|deceptive payment|payment fraud|deception|approval abuse)/.test(raw)) {
      push({ text: 'deceptive payment pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'third_party_access_compromise') {
    if (/(vendor|third-party|third party|supplier|partner|support account)/.test(raw)
      && /(compromis|abused|unauthori[sz]ed access|intrusion|credentials? .*abused)/.test(raw)
      && !/(no compromise|not compromised|without compromise|no intrusion|not abused)/.test(raw)) {
      push({ text: 'compromised inherited access path', strength: 'strong' });
    }
  }
  if (familyKey === 'delivery_slippage' || familyKey === 'programme_delivery_slippage') {
    if (/(supplier|vendor|delivery|shipment|logistics)/.test(raw)
      && /(delay|delayed|missed delivery|delivery date|late|slippage|milestone|deployment|go-live|rollout|dependent project|dependent projects)/.test(raw)) {
      push({ text: 'delivery dependency slippage', strength: 'strong' });
    }
  }
  if (familyKey === 'privacy_non_compliance') {
    if (/(privacy|data protection|lawful basis|retention|processing)/.test(raw)
      && /(breach|without|fail|failure|unlawful)/.test(raw)) {
      push({ text: 'privacy obligation failure', strength: 'strong' });
    }
  }
  if (familyKey === 'records_retention_non_compliance') {
    if (/(records|retention|deletion)/.test(raw) && /(breach|fail|failure|too long|not met)/.test(raw)) {
      push({ text: 'records retention obligation failure', strength: 'strong' });
    }
  }
  if (familyKey === 'cross_border_transfer_non_compliance') {
    if (/(cross-border|cross border|international transfer|transfer)/.test(raw) && /(without|missing|fail|failure|safeguard)/.test(raw)) {
      push({ text: 'cross-border transfer obligation failure', strength: 'strong' });
    }
  }
  if (familyKey === 'forced_labour_modern_slavery') {
    if (/(forced labour|forced labor|modern slavery|child labour|child labor|human rights)/.test(raw)) {
      push({ text: 'modern slavery indicator', strength: 'strong' });
    }
  }
  return extra;
}

function buildTextBundle(narrative = '', options = {}) {
  return [
    narrative,
    options.guidedInput?.event,
    options.guidedInput?.asset,
    options.guidedInput?.cause,
    options.guidedInput?.impact,
    options.businessUnit?.name,
    options.businessUnit?.contextSummary,
    options.businessUnit?.selectedDepartmentContext
  ].filter(Boolean).join(' ').trim();
}

function buildHintAliasMap() {
  const aliasMap = new Map();
  Object.entries(EXTRA_HINT_ALIASES).forEach(([alias, value]) => aliasMap.set(normaliseText(alias), value));
  SCENARIO_TAXONOMY_DOMAINS.forEach((domain) => {
    aliasMap.set(normaliseText(domain.key), domain.key);
    aliasMap.set(normaliseText(domain.label), domain.key);
  });
  SCENARIO_TAXONOMY_FAMILIES.forEach((family) => {
    const resolvedFamily = resolveFamilyByKey(family.key) || family;
    [
      family.key,
      family.label,
      family.domain,
      family.legacyKey,
      family.lensKey,
      family.lensLabel,
      family.functionKey,
      family.estimatePresetKey,
      family.preferredFamilyKey
    ].forEach((alias) => {
      const normalisedAlias = normaliseText(alias);
      if (!normalisedAlias) return;
      if (!aliasMap.has(normalisedAlias)) aliasMap.set(normalisedAlias, resolvedFamily.key);
    });
  });
  return aliasMap;
}

const HINT_ALIAS_MAP = buildHintAliasMap();

function findFamilyByHint(value) {
  const candidates = value && typeof value === 'object'
    ? [value.key, value.label, value.functionKey, value.estimatePresetKey, value.domain, value.primaryFamily?.key, value.legacyKey, value.familyKey]
    : [value];
  for (const candidate of candidates) {
    const normalised = normaliseText(candidate);
    if (!normalised) continue;
    const resolved = HINT_ALIAS_MAP.get(normalised);
    if (!resolved || resolved === 'general') continue;
    if (SCENARIO_TAXONOMY_FAMILY_BY_KEY[resolved]) return resolveFamilyByKey(resolved);
    const defaultFamilyKey = DOMAIN_DEFAULT_FAMILY[resolved];
    if (defaultFamilyKey && SCENARIO_TAXONOMY_FAMILY_BY_KEY[defaultFamilyKey]) {
      return resolveFamilyByKey(defaultFamilyKey);
    }
  }
  return null;
}

function normaliseScenarioHintKey(value) {
  const family = findFamilyByHint(value);
  if (family?.lensKey) return family.lensKey;
  const candidates = value && typeof value === 'object'
    ? [value.key, value.label, value.functionKey, value.estimatePresetKey, value.legacyKey, value.familyKey]
    : [value];
  for (const candidate of candidates) {
    const normalised = HINT_ALIAS_MAP.get(normaliseText(candidate));
    if (!normalised) continue;
    if (SCENARIO_TAXONOMY_FAMILY_BY_KEY[normalised]) {
      return resolveFamilyByKey(normalised)?.lensKey || 'general';
    }
    if (DOMAIN_DEFAULT_FAMILY[normalised]) {
      return resolveFamilyByKey(DOMAIN_DEFAULT_FAMILY[normalised])?.lensKey || 'general';
    }
  }
  return '';
}

function collectMatchedMechanisms(text = '', family = null) {
  const preferredKeys = new Set(Array.isArray(family?.defaultMechanisms) ? family.defaultMechanisms : []);
  const matches = [];
  Object.values(SCENARIO_TAXONOMY_MECHANISM_BY_KEY).forEach((mechanism) => {
    const positiveMatches = matchSignalSet(text, mechanism.positiveSignals, {
      familyKey: family?.key || '',
      role: 'mechanism',
      source: 'mechanism'
    });
    const antiMatches = matchSignalSet(text, mechanism.antiSignals, {
      familyKey: family?.key || '',
      role: 'anti',
      source: 'mechanism'
    });
    if (!positiveMatches.length || antiMatches.length) return;
    const score = positiveMatches.reduce((sum, signal) => sum + strengthWeight(signal), 0)
      + (preferredKeys.has(mechanism.key) ? 3 : 0);
    matches.push({
      mechanism,
      score,
      matchedSignals: positiveMatches
    });
  });
  return matches.sort((left, right) => right.score - left.score);
}

function scoreFamily(family, text = '', hintFamily = null) {
  const positiveMatches = matchSignalSet(text, family.positiveSignals, { familyKey: family.key, role: 'positive' });
  const requiredMatches = matchSignalSet(text, family.requiredSignals, { familyKey: family.key, role: 'required' });
  const antiMatches = matchSignalSet(text, family.antiSignals, { familyKey: family.key, role: 'anti' });
  const exampleMatches = family.examplePhrases
    .filter((phrase) => hasSignal(text, phrase))
    .map((phrase) => ({ text: String(phrase), strength: 'strong', role: 'example', source: 'example', familyKey: family.key }));
  const causeMatches = family.typicalCauses
    .filter((phrase) => hasSignal(text, phrase))
    .map((phrase) => ({ text: String(phrase), strength: 'medium', role: 'cause', source: 'cause', familyKey: family.key }));
  const assetMatches = family.typicalAssets
    .filter((phrase) => hasSignal(text, phrase))
    .map((phrase) => ({ text: String(phrase), strength: 'weak', role: 'asset', source: 'asset', familyKey: family.key }));
  const heuristicMatches = getFamilyExtraMatches(family.key, text);
  const mechanismMatches = collectMatchedMechanisms(text, family);
  const matchedMechanisms = mechanismMatches.slice(0, 4).map((item) => item.mechanism);

  const directSignalScore = positiveMatches.reduce((sum, signal) => sum + strengthWeight(signal), 0);
  const auxiliaryScore = exampleMatches.length * 5
    + causeMatches.reduce((sum, signal) => sum + Math.max(1, strengthWeight(signal) - 2), 0)
    + assetMatches.reduce((sum, signal) => sum + Math.max(1, strengthWeight(signal) - 1), 0)
    + heuristicMatches.reduce((sum, signal) => sum + strengthWeight(signal), 0)
    + mechanismMatches.reduce((sum, item) => sum + Math.min(4, item.score), 0);
  const antiPenalty = antiMatches.reduce((sum, signal) => sum + (strengthWeight(signal) + 1), 0);
  const requiredMet = !family.requiredSignals.length || requiredMatches.length > 0;
  const hintBoost = hintFamily?.key === family.key || hintFamily?.domain === family.domain ? 1 : 0;

  let score = directSignalScore + auxiliaryScore + hintBoost - antiPenalty + Math.round((family.priorityScore || 50) / 25);
  const reasonCodes = [];
  const ambiguityFlags = [];
  let blocked = false;

  if (positiveMatches.length || exampleMatches.length || heuristicMatches.length) reasonCodes.push('DIRECT_SIGNAL_MATCH');
  if (requiredMatches.length) reasonCodes.push('REQUIRED_SIGNAL_MATCH');
  if (antiMatches.length) reasonCodes.push('BLOCKED_BY_ANTI_SIGNAL');
  if (!requiredMet) {
    blocked = true;
    score -= 12;
    reasonCodes.push('INSUFFICIENT_PRIMARY_SIGNAL');
  }
  if (!positiveMatches.length && antiMatches.length && score <= 0) {
    blocked = true;
  }
  if (!directSignalScore && (exampleMatches.length || causeMatches.length || assetMatches.length)) {
    reasonCodes.push('SECONDARY_ONLY');
    ambiguityFlags.push('WEAK_EVENT_PATH');
  }

  return {
    family,
    score,
    blocked,
    positiveMatches,
    requiredMatches,
    antiMatches,
    matchedSignals: [...positiveMatches, ...requiredMatches, ...exampleMatches, ...causeMatches, ...assetMatches, ...heuristicMatches, ...mechanismMatches.flatMap((item) => item.matchedSignals)],
    matchedAntiSignals: antiMatches,
    matchedMechanisms,
    reasonCodes: uniqueStrings(reasonCodes),
    ambiguityFlags: uniqueStrings(ambiguityFlags)
  };
}

function hasExplicitFraudSignals(text = '') {
  return /(fraud|fake invoice|false invoice|bribery|embezzlement|manipulation|collusion|approval abuse|deception|kickback|invoice scam)/i.test(text);
}

function hasExplicitDisclosureSignals(text = '') {
  return /(exfiltration|breach|disclosure|leaked data|exposed records|stolen data|data exposure|leak(?:ed)? records)/i.test(text);
}

function hasAvailabilityAttackSignals(text = '') {
  return /(ddos|d[\s-]*dos|denial[- ]of[- ]service|traffic flood|hostile traffic|volumetric attack|application-layer flood|botnet)/i.test(text)
    || ((/malicious actors?|threat actors?|attackers?/i.test(text))
      && /(website|web site|online services?|internet-facing|public-facing|customer portal|portal|site|online platform)/i.test(text)
      && /traffic/i.test(text)
      && /(slow(?:ing|ed)? down|slow to|crash|degrad|unavailable|availability|disrupt)/i.test(text));
}

function hasContinuitySignals(text = '') {
  return /(?:^|[^a-z0-9])no dr(?:$|[^a-z0-9])|without dr|dr gap|disaster recovery|failover|fallback|outage survival|recovery continuity|crisis coordination/i.test(text);
}

function hasIdentitySignals(text = '') {
  return /(credential theft|dark ?web credentials?|admin credentials?|global admin|tenant admin|account takeover|mailbox takeover|compromised account|token theft|stolen token)/i.test(text);
}

function hasExplicitDelaySignals(text = '') {
  return /(supplier delay|missed delivery date|delayed deployment|delayed programme milestone|logistics disruption|dependent projects delayed|shipment delay|late delivery|delivery slippage)/i.test(text);
}

function hasExplicitPrivacyObligationSignals(text = '') {
  return /(privacy obligations?|data protection obligations?|retention breach|unlawful processing|without lawful basis|cross-border transfer|transfer without safeguards|records retention)/i.test(text);
}

function hasExplicitThirdPartyAccessCompromiseSignals(text = '') {
  return /(vendor access compromised|third-party access compromised|partner account compromised|external support account abused|vendor credentials abused|third-party remote access(?: path)?(?: is| becomes| was)? (?:compromised|abused)|supplier access path)/i.test(text);
}

function hasExplicitCyberCauseSignals(text = '') {
  return hasAvailabilityAttackSignals(text)
    || hasIdentitySignals(text)
    || /(ransomware|malware|phishing|phish|credential theft|stolen token|compromised|compromise|unauthori[sz]ed access|intrusion|breach|botnet|volumetric attack)/i.test(text);
}

function hasExplicitGreenwashingSignals(text = '') {
  return /(greenwashing|sustainability disclosure|climate disclosure|claim substantiation|esg disclosure gap)/i.test(text);
}

function hasExplicitRecordsRetentionSignals(text = '') {
  return /(records retention|retention schedule|records kept too long|deletion obligations? not met|retention breach)/i.test(text);
}

function hasExplicitCrossBorderTransferSignals(text = '') {
  return /(cross-border transfer|cross border transfer|international transfer|transfer without safeguards|data residency breach|transfer impact assessment)/i.test(text);
}

function hasExplicitInvoiceSignals(text = '') {
  return /(fake invoice|false invoice|invoice scam|duplicate invoice)/i.test(text);
}

function applyPrecedence(scoredFamilies = [], text = '', meta = {}) {
  const byKey = new Map(scoredFamilies.map((item) => [item.family.key, item]));
  const applied = [];
  const penalise = (keys = [], { against = null, penalty = 5, tolerance = 2, label = '' } = {}) => {
    if (!against) return;
    let changed = false;
    keys
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .forEach((candidate) => {
        if (against.score >= candidate.score - tolerance) {
          candidate.score -= penalty;
          changed = true;
        }
      });
    if (changed && label) applied.push(label);
  };

  const identity = byKey.get('identity_compromise');
  const paymentControl = byKey.get('payment_control_failure');
  if (identity && paymentControl && hasIdentitySignals(text) && identity.score >= paymentControl.score - 3) {
    paymentControl.score -= 6;
    applied.push('identity_compromise beats payment_control_failure when financial harm is downstream');
  }

  const availability = byKey.get('availability_attack');
  const continuityFamilies = ['dr_gap', 'failover_failure', 'recovery_coordination_failure', 'crisis_escalation']
    .map((key) => byKey.get(key))
    .filter(Boolean);
  if (availability && hasAvailabilityAttackSignals(text)) {
    continuityFamilies.forEach((candidate) => {
      if (availability.score >= candidate.score - 3) candidate.score -= 6;
    });
    applied.push('availability_attack beats business_continuity when hostile traffic is the event path');
    penalise(
      ['policy_breach', 'privacy_non_compliance', 'regulatory_filing_failure', 'greenwashing_disclosure_gap'],
      {
        against: availability,
        penalty: 6,
        tolerance: 3,
        label: 'availability_attack beats compliance or regulatory consequence wording when hostile traffic is the event path'
      }
    );
  }

  const privacy = byKey.get('privacy_non_compliance');
  const disclosure = byKey.get('data_disclosure');
  if (privacy && disclosure && hasExplicitPrivacyObligationSignals(text) && !hasExplicitDisclosureSignals(text) && privacy.score >= disclosure.score - 3) {
    disclosure.score -= 7;
    applied.push('privacy_non_compliance beats data_disclosure when obligation failure is primary');
  }
  const retention = byKey.get('records_retention_non_compliance');
  if (retention && privacy && hasExplicitRecordsRetentionSignals(text) && retention.score >= privacy.score - 2) {
    privacy.score -= 5;
    applied.push('records_retention_non_compliance beats generic privacy non-compliance when retention obligations are explicit');
  }
  const crossBorder = byKey.get('cross_border_transfer_non_compliance');
  if (crossBorder && privacy && hasExplicitCrossBorderTransferSignals(text) && crossBorder.score >= privacy.score - 2) {
    privacy.score -= 5;
    applied.push('cross_border_transfer_non_compliance beats generic privacy non-compliance when transfer obligations are explicit');
  }

  const delivery = byKey.get('delivery_slippage');
  const singleSource = byKey.get('single_source_dependency');
  if (delivery && singleSource && hasExplicitDelaySignals(text) && delivery.score >= singleSource.score - 2) {
    singleSource.score -= 5;
    applied.push('delivery_slippage beats single_source_dependency when actual delay is explicit');
  }
  if (delivery && hasExplicitDelaySignals(text) && !hasExplicitCyberCauseSignals(text)) {
    penalise(
      ['availability_attack', 'identity_compromise', 'cloud_control_failure', 'unauthorized_configuration_change', 'third_party_access_compromise'],
      {
        against: delivery,
        penalty: 6,
        tolerance: 2,
        label: 'delivery_slippage beats cyber-leaning interpretation when supplier delay is explicit and cyber cause is absent'
      }
    );
  }

  const thirdPartyAccessCompromise = byKey.get('third_party_access_compromise');
  if (thirdPartyAccessCompromise && hasExplicitThirdPartyAccessCompromiseSignals(text)) {
    penalise(
      ['vendor_access_weakness', 'supplier_control_weakness'],
      {
        against: thirdPartyAccessCompromise,
        penalty: 6,
        tolerance: 2,
        label: 'third_party_access_compromise beats governance weakness when an inherited access path is explicitly compromised'
      }
    );
  }

  const invoiceFraud = byKey.get('invoice_fraud');
  const paymentFraud = byKey.get('payment_fraud');
  if (paymentControl && hasExplicitFraudSignals(text)) {
    if (invoiceFraud && invoiceFraud.score >= paymentControl.score - 2) {
      paymentControl.score -= 5;
      applied.push('invoice_fraud beats payment_control_failure when deception is explicit');
    }
    if (paymentFraud && paymentFraud.score >= paymentControl.score - 2) {
      paymentControl.score -= 5;
      applied.push('payment_fraud beats payment_control_failure when deception is explicit');
    }
  }
  if (invoiceFraud && paymentFraud && hasExplicitInvoiceSignals(text) && invoiceFraud.score >= paymentFraud.score - 1) {
    paymentFraud.score -= 4;
    applied.push('invoice_fraud beats payment_fraud when the deception is explicitly invoice-led');
  }

  const greenwashing = byKey.get('greenwashing_disclosure_gap');
  const policyBreach = byKey.get('policy_breach');
  if (greenwashing && policyBreach && hasExplicitGreenwashingSignals(text) && greenwashing.score >= policyBreach.score - 2) {
    policyBreach.score -= 6;
    applied.push('greenwashing_disclosure_gap beats generic policy breach when disclosure substantiation is explicit');
  }

  return {
    scoredFamilies: scoredFamilies.sort((left, right) => right.score - left.score),
    applied
  };
}

function resolveOverlays(text = '', primaryFamily = null, secondaryFamilies = [], { includeDefaultOverlays = true } = {}) {
  const explicit = Object.entries(OVERLAY_SIGNAL_MAP)
    .filter(([, signals]) => signals.some((signal) => hasSignal(text, signal)))
    .map(([key]) => key);
  const defaults = includeDefaultOverlays
    ? [
        ...(Array.isArray(primaryFamily?.defaultOverlays) ? primaryFamily.defaultOverlays : []),
        ...secondaryFamilies.flatMap((family) => Array.isArray(family?.defaultOverlays) ? family.defaultOverlays.slice(0, 1) : [])
      ]
    : [];
  return uniqueStrings([...defaults, ...explicit])
    .filter((key) => SCENARIO_TAXONOMY_OVERLAY_BY_KEY[key])
    .map((key) => SCENARIO_TAXONOMY_OVERLAY_BY_KEY[key]);
}

function buildConfidence(best = null, second = null, hasExplicitSignals = false) {
  const bestScore = Number(best?.score || 0);
  const secondScore = Number(second?.score || 0);
  const margin = bestScore - secondScore;
  if (bestScore >= 26 && margin >= 6) return 0.96;
  if (bestScore >= 20 && margin >= 5) return 0.9;
  if (bestScore >= 14 && margin >= 4) return 0.8;
  if (bestScore >= 10 && margin >= 2) return hasExplicitSignals ? 0.68 : 0.58;
  if (bestScore >= 6) return hasExplicitSignals ? 0.54 : 0.42;
  return 0.24;
}

function buildPrimaryProfile(family = null) {
  if (!family) {
    return {
      key: 'general',
      label: LENS_LABELS.general,
      scenarioType: 'Risk Scenario',
      primaryDriver: 'A material risk driver',
      eventPath: 'A material event path',
      effect: 'Business disruption or exposure'
    };
  }
  const effect = Array.isArray(family.typicalConsequences) && family.typicalConsequences.length
    ? uniqueStrings(family.typicalConsequences).slice(0, 3).join(', ')
    : family.description;
  return {
    key: String(family.lensKey || 'general'),
    label: String(family.lensLabel || LENS_LABELS[family.lensKey] || LENS_LABELS.general),
    scenarioType: `${String(family.label || 'Risk').trim()} Scenario`,
    primaryDriver: cleanSentenceFragment(family.typicalCauses?.[0] || family.description),
    eventPath: cleanSentenceFragment(family.description),
    effect: cleanSentenceFragment(effect),
    familyKey: family.key,
    domain: family.domain
  };
}

function cleanSentenceFragment(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function resolveFamilyByKey(key = '', visited = new Set()) {
  const family = SCENARIO_TAXONOMY_FAMILY_BY_KEY[String(key || '').trim()] || null;
  if (!family) return null;
  if (String(family.status || 'active') !== 'compatibility_only') return family;
  const preferredFamilyKey = String(family.preferredFamilyKey || '').trim();
  if (!preferredFamilyKey || visited.has(family.key)) return family;
  visited.add(family.key);
  return resolveFamilyByKey(preferredFamilyKey, visited) || family;
}

function buildSecondaryFamilies(scoredFamilies = [], primaryFamily = null) {
  if (!primaryFamily) return [];
  return scoredFamilies
    .filter((item) => item.family.key !== primaryFamily.key)
    .filter((item) => !item.blocked && item.score >= Math.max(8, Math.floor(scoredFamilies[0]?.score * 0.6)))
    .filter((item) => {
      if (primaryFamily.forbiddenDriftFamilies.includes(item.family.key)) return false;
      if (primaryFamily.cannotBePrimaryWith.includes(item.family.key)) return false;
      return primaryFamily.allowedSecondaryFamilies.includes(item.family.key)
        || primaryFamily.canCoExistWith.includes(item.family.key)
        || item.family.domain === primaryFamily.domain;
    })
    .map((item) => item.family)
    .filter((family, index, list) => list.findIndex((candidate) => candidate.key === family.key) === index)
    .slice(0, 3);
}

function classifyScenario(narrative = '', options = {}) {
  const text = buildTextBundle(narrative, options);
  const hintFamily = findFamilyByHint(options.scenarioLensHint);
  const scoredInitial = SCENARIO_TAXONOMY_ACTIVE_FAMILIES.map((family) => scoreFamily(family, text, hintFamily));
  const precedence = applyPrecedence(scoredInitial, text, options);
  const scoredFamilies = precedence.scoredFamilies;
  const best = scoredFamilies[0] || null;
  const second = scoredFamilies[1] || null;
  const overlayMatches = Object.entries(OVERLAY_SIGNAL_MAP)
    .filter(([, signals]) => signals.some((signal) => hasSignal(text, signal)))
    .map(([key]) => key);
  const overlayHeavy = overlayMatches.length >= 2 && (!best || best.score < 10);
  const hasExplicitPrimarySignals = Boolean(
    best?.positiveMatches?.length
    || best?.requiredMatches?.length
    || (Array.isArray(best?.matchedSignals) && best.matchedSignals.some((signal) => signal?.source === 'heuristic'))
  );
  const hasUsablePrimary = Boolean(best && !best.blocked && best.score >= 8 && (hasExplicitPrimarySignals || best.matchedSignals.length >= 2));
  const weakExplicitPrimary = Boolean(best && !best.blocked && best.score >= 5 && best.matchedSignals.length > 0);
  const primaryFamily = hasUsablePrimary
    ? best.family
    : (weakExplicitPrimary ? best.family : (hintFamily || null));
  const secondaryFamilies = hasUsablePrimary ? buildSecondaryFamilies(scoredFamilies, primaryFamily) : [];
  const mechanisms = hasUsablePrimary
    ? uniqueStrings([
        ...best.matchedMechanisms.map((mechanism) => mechanism.key),
        ...secondaryFamilies.flatMap((family) => family.defaultMechanisms || [])
      ])
        .map((key) => SCENARIO_TAXONOMY_MECHANISM_BY_KEY[key])
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const overlays = resolveOverlays(text, primaryFamily, secondaryFamilies, {
    includeDefaultOverlays: hasUsablePrimary || weakExplicitPrimary
  });
  const primaryProfile = buildPrimaryProfile(primaryFamily);
  const confidence = hasUsablePrimary
    ? buildConfidence(best, second, hasExplicitPrimarySignals)
    : (hintFamily ? 0.32 : 0.18);

  const topDomainSet = new Set(
    scoredFamilies
      .filter((item) => !item.blocked && item.score >= Math.max(8, Number(best?.score || 0) - 3))
      .map((item) => item.family.domain)
  );

  const reasonCodes = [];
  const ambiguityFlags = [];

  if (hasExplicitPrimarySignals) reasonCodes.push('DIRECT_SIGNAL_MATCH');
  if (best?.requiredMatches?.length) reasonCodes.push('REQUIRED_SIGNAL_MATCH');
  if (precedence.applied.length) reasonCodes.push('PRECEDENCE_RULE_APPLIED');
  if (overlayHeavy) reasonCodes.push('CONSEQUENCE_ONLY_NOT_PRIMARY');
  if (!hasUsablePrimary) reasonCodes.push('INSUFFICIENT_PRIMARY_SIGNAL');
  if (!hasUsablePrimary && best?.matchedSignals?.length) reasonCodes.push('SECONDARY_ONLY');
  if (topDomainSet.size > 1) reasonCodes.push('MIXED_DOMAIN_SIGNALS');
  if (!hasUsablePrimary && topDomainSet.size > 1) reasonCodes.push('AMBIGUOUS_EVENT_PATH');

  if (!hasUsablePrimary) ambiguityFlags.push('WEAK_EVENT_PATH');
  if (overlayHeavy) ambiguityFlags.push('CONSEQUENCE_HEAVY_TEXT');
  if (topDomainSet.size > 1) ambiguityFlags.push('MIXED_DOMAIN_SIGNALS');
  if (confidence < 0.6) ambiguityFlags.push('LOW_PRIMARY_CONFIDENCE');

  const matchedSignals = hasUsablePrimary ? best.matchedSignals : [];
  const matchedAntiSignals = scoredFamilies
    .filter((item) => item.antiMatches.length)
    .slice(0, 4)
    .flatMap((item) => item.antiMatches.map((signal) => ({
      ...signal,
      familyKey: item.family.key
    })));

  return {
    ...primaryProfile,
    domain: String(primaryFamily?.domain || '').trim(),
    primaryFamily,
    secondaryFamilies,
    mechanisms,
    overlays,
    confidence,
    matchedSignals,
    matchedAntiSignals,
    triggerSignals: uniqueStrings(matchedSignals.map((signal) => signal.text)),
    blockedByAntiSignals: scoredFamilies
      .filter((item) => item.antiMatches.length)
      .map((item) => ({
        familyKey: item.family.key,
        signals: item.antiMatches.map((signal) => signal.text)
      })),
    reasonCodes: uniqueStrings(reasonCodes),
    ambiguityFlags: uniqueStrings(ambiguityFlags),
    taxonomyVersion: SCENARIO_TAXONOMY.taxonomyVersion,
    secondaryKeys: uniqueStrings(secondaryFamilies.map((family) => family.lensKey)).filter((key) => key && key !== primaryProfile.key)
  };
}

function buildScenarioLens(classification = {}) {
  const family = classification?.primaryFamily?.key
    ? SCENARIO_TAXONOMY_FAMILY_BY_KEY[classification.primaryFamily.key] || null
    : findFamilyByHint(classification?.key || classification?.domain || classification?.primaryFamily || '');
  const key = String(family?.lensKey || normaliseScenarioHintKey(classification?.key || classification) || 'general').trim() || 'general';
  const label = String(family?.lensLabel || LENS_LABELS[key] || LENS_LABELS.general).trim();
  const functionKey = String(family?.functionKey || 'general').trim() || 'general';
  const estimatePresetKey = String(family?.estimatePresetKey || 'general').trim() || 'general';
  const secondaryKeys = uniqueStrings([
    ...(Array.isArray(classification?.secondaryFamilies) ? classification.secondaryFamilies.map((item) => item?.lensKey || item?.key || item) : []),
    ...(Array.isArray(classification?.secondaryKeys) ? classification.secondaryKeys : [])
  ])
    .map((item) => normaliseScenarioHintKey(item) || String(item || '').trim())
    .filter((item) => item && item !== key);

  return {
    key,
    label,
    functionKey,
    estimatePresetKey,
    secondaryKeys
  };
}

function isCompatibleScenarioLens(expected = '', actual = '') {
  const expectedKey = normaliseScenarioHintKey(expected) || String(expected || '').trim();
  const actualKey = normaliseScenarioHintKey(actual) || String(actual || '').trim();
  if (!expectedKey || expectedKey === 'general' || !actualKey) return true;
  if (expectedKey === actualKey) return true;
  return (LENS_COMPATIBILITY[expectedKey] || []).includes(actualKey);
}

function extractExplicitScenarioLeadLens(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(?:[a-z-]+-urgency\s+)?([a-z0-9 /-]+?)\s+(?:risk\s+)?scenario:/i);
  return match?.[1] ? normaliseScenarioHintKey(match[1]) : '';
}

module.exports = {
  classifyScenario,
  buildScenarioLens,
  extractExplicitScenarioLeadLens,
  isCompatibleScenarioLens,
  normaliseScenarioHintKey
};
