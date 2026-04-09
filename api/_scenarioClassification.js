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
const { calibrateClassificationConfidence } = require('./_confidenceCalibration');

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
  'business continuity management': 'business_continuity',
  bcm: 'business_continuity',
  'crisis management': 'business_continuity',
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
  qhse: 'esg_hse_people',
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
  'responsible ai': 'general',
  erm: 'general',
  'enterprise risk': 'general',
  'risk management': 'general'
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
    if (hasExplicitThirdPartyAccessCompromiseSignals(raw)) {
      push({ text: 'compromised inherited access path', strength: 'strong' });
    }
  }
  if (familyKey === 'single_source_dependency') {
    if (hasExplicitSingleSourceDependencySignals(raw)) {
      push({ text: 'single-source dependency pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'supplier_concentration_risk') {
    if (hasExplicitSupplierConcentrationSignals(raw)) {
      push({ text: 'supplier concentration pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'delivery_slippage' || familyKey === 'programme_delivery_slippage') {
    if (hasExplicitDeliverySlippageSignals(raw)) {
      push({ text: 'delivery dependency slippage', strength: 'strong' });
    }
  }
  if (familyKey === 'logistics_disruption') {
    if (hasExplicitLogisticsDisruptionSignals(raw)) {
      push({ text: 'explicit logistics or transit disruption', strength: 'strong' });
    }
  }
  if (familyKey === 'supplier_control_weakness') {
    if (hasExplicitSupplierControlWeaknessSignals(raw)) {
      push({ text: 'supplier assurance or control weakness', strength: 'strong' });
    }
  }
  if (familyKey === 'vendor_access_weakness') {
    if (hasExplicitVendorAccessWeaknessSignals(raw)) {
      push({ text: 'external vendor access weakness', strength: 'strong' });
    }
  }
  if (familyKey === 'supplier_insolvency') {
    if (hasExplicitSupplierInsolvencySignals(raw)) {
      push({ text: 'supplier insolvency pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'policy_breach') {
    if (hasExplicitPolicyBreachSignals(raw)) {
      push({ text: 'internal policy or control-process breach', strength: 'strong' });
    }
  }
  if (familyKey === 'risk_governance_gap') {
    if (hasExplicitRiskGovernanceSignals(raw)) {
      push({ text: 'enterprise-risk governance pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'privacy_governance_gap') {
    if (hasExplicitPrivacyGovernanceSignals(raw)) {
      push({ text: 'privacy governance or sensitive-data oversight failure', strength: 'strong' });
    }
  }
  if (familyKey === 'continuity_planning_gap') {
    if (hasExplicitContinuityPlanningSignals(raw)) {
      push({ text: 'continuity planning or crisis-readiness gap', strength: 'strong' });
    }
  }
  if (familyKey === 'privacy_non_compliance') {
    if (hasExplicitPrivacyObligationSignals(raw)) {
      push({ text: 'privacy obligation failure', strength: 'strong' });
    }
  }
  if (familyKey === 'records_retention_non_compliance') {
    if (hasExplicitRecordsRetentionSignals(raw)) {
      push({ text: 'records retention obligation failure', strength: 'strong' });
    }
  }
  if (familyKey === 'cross_border_transfer_non_compliance') {
    if (hasExplicitCrossBorderTransferSignals(raw)) {
      push({ text: 'cross-border transfer obligation failure', strength: 'strong' });
    }
  }
  if (familyKey === 'regulatory_filing_failure') {
    if (hasExplicitRegulatoryFilingSignals(raw)) {
      push({ text: 'mandatory filing or notification failure', strength: 'strong' });
    }
  }
  if (familyKey === 'sanctions_breach') {
    if (hasExplicitSanctionsSignals(raw)) {
      push({ text: 'sanctions or restricted-party breach', strength: 'strong' });
    }
  }
  if (familyKey === 'licensing_permit_issue') {
    if (hasExplicitLicensingSignals(raw)) {
      push({ text: 'licensing or permit failure', strength: 'strong' });
    }
  }
  if (familyKey === 'contract_liability') {
    if (hasExplicitContractLiabilitySignals(raw)) {
      push({ text: 'contractual liability or indemnity exposure', strength: 'strong' });
    }
  }
  if (familyKey === 'forced_labour_modern_slavery') {
    if (hasExplicitForcedLabourSignals(raw)) {
      push({ text: 'modern slavery indicator', strength: 'strong' });
    }
  }
  if (familyKey === 'greenwashing_disclosure_gap') {
    if (hasExplicitGreenwashingSignals(raw)) {
      push({ text: 'unsupported ESG disclosure or claim pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'safety_incident') {
    if (hasExplicitSafetyIncidentSignals(raw)) {
      push({ text: 'explicit safety incident pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'environmental_spill') {
    if (hasExplicitEnvironmentalSpillSignals(raw)) {
      push({ text: 'explicit environmental spill or release', strength: 'strong' });
    }
  }
  if (familyKey === 'safety_control_weakness') {
    if (hasExplicitSafetyControlWeaknessSignals(raw)) {
      push({ text: 'explicit HSE control or emergency-readiness weakness', strength: 'strong' });
    }
  }
  if (familyKey === 'workforce_fatigue_staffing_weakness') {
    if (hasExplicitWorkforceFatigueSignals(raw)) {
      push({ text: 'fatigue or staffing weakness pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'critical_staff_dependency') {
    if (hasExplicitCriticalStaffDependencySignals(raw)) {
      push({ text: 'explicit key-person dependency pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'process_breakdown') {
    if (hasExplicitProcessBreakdownSignals(raw)) {
      push({ text: 'workflow breakdown pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'platform_instability') {
    if (hasExplicitPlatformInstabilitySignals(raw) && !hasExplicitOtResilienceSignals(raw)) {
      push({ text: 'platform instability pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'service_delivery_failure') {
    if (hasExplicitServiceDeliveryFailureSignals(raw)
      && !hasExplicitContinuityGapSignals(raw)
      && !hasExplicitPerimeterBreachSignals(raw)
      && !hasExplicitOtResilienceSignals(raw)) {
      push({ text: 'service delivery breakdown pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'critical_service_dependency_failure') {
    if (hasExplicitDependencyFailureSignals(raw) && !hasExplicitContinuityGapSignals(raw)) {
      push({ text: 'critical dependency failure pattern', strength: 'strong' });
    }
  }
  if (familyKey === 'dr_gap') {
    if (hasExplicitDrGapSignals(raw)) {
      push({ text: 'explicit disaster recovery gap', strength: 'strong' });
    }
  }
  if (familyKey === 'failover_failure') {
    if (hasExplicitFailoverSignals(raw)) {
      push({ text: 'explicit failover weakness', strength: 'strong' });
    }
  }
  if (familyKey === 'recovery_coordination_failure') {
    if (hasExplicitRecoveryCoordinationSignals(raw)) {
      push({ text: 'explicit recovery coordination failure', strength: 'strong' });
    }
  }
  if (familyKey === 'perimeter_breach') {
    if (hasExplicitPerimeterBreachSignals(raw)) {
      push({ text: 'physical intrusion or site-access breach', strength: 'strong' });
    }
  }
  if (familyKey === 'ot_resilience_failure') {
    if (hasExplicitOtResilienceSignals(raw) && !hasAvailabilityAttackSignals(raw)) {
      push({ text: 'explicit OT or industrial-control instability', strength: 'strong' });
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
  return /(exfiltration|data breach|personal data breach|unauthori[sz]ed disclosure|external disclosure|leaked data|exposed records|stolen data|data exposure|leak(?:ed)? records)/i.test(text);
}

function hasAvailabilityAttackSignals(text = '') {
  return /(ddos|d[\s-]*dos|denial[- ]of[- ]service|traffic flood|hostile traffic|volumetric attack|application-layer flood|botnet)/i.test(text)
    || ((/malicious actors?|threat actors?|attackers?/i.test(text))
      && /(website|web site|online services?|internet-facing|public-facing|customer portal|portal|site|online platform)/i.test(text)
      && /traffic/i.test(text)
      && /(slow(?:ing|ed)? down|slow to|crash|degrad|unavailable|availability|disrupt)/i.test(text));
}

function hasExplicitProcessBreakdownSignals(text = '') {
  return /(process breakdown|workflow failure|workflow fails repeatedly|manual processing error|manual workaround|rework cycle)/i.test(text)
    || ((/(workflow|process|fulfilment|fulfillment|handoff|manual process|internal workflow)/i.test(text))
      && /(fail(?:s|ed|ing)?|break(?:s|down)?|collapse(?:s|d)?|disrupt(?:s|ed)?|manual workaround|rework|backlog)/i.test(text));
}

function hasExplicitPlatformInstabilitySignals(text = '') {
  return /(platform instability|system instability|aging infrastructure|legacy infrastructure|repeated platform defects|recurring platform defects|repeated system failure)/i.test(text)
    || ((/(platform|system|application|service)/i.test(text))
      && /(unstable|instability|reliability issue|repeated defects|recurring defects|aging infrastructure|legacy infrastructure)/i.test(text));
}

function hasExplicitServiceDeliveryFailureSignals(text = '') {
  return /(service delivery failure|critical service disruption|service becomes unstable|delivery delays)/i.test(text)
    || ((/(service|delivery path|workflow|customer-facing service|core service|platform)/i.test(text))
      && /(fails repeatedly|repeated failure|service delays|degrad(?:e|es|ed|ing)|unstable|backlog|manual workaround|capacity shortfall|throughput constraint|resource bottleneck)/i.test(text));
}

function hasExplicitDependencyFailureSignals(text = '') {
  return /(critical dependency failure|core dependency unavailable|dependency becomes unavailable|upstream service unavailable|shared service unavailable|dependency outage)/i.test(text)
    || ((/(dependency|upstream|shared service|shared platform|supporting service)/i.test(text))
      && /(unavailable|down|fails?|failure|outage)/i.test(text));
}

function hasExplicitDrGapSignals(text = '') {
  return /(?:^|[^a-z0-9])no dr(?:$|[^a-z0-9])|without dr|dr gap|disaster recovery gap|missing disaster recovery|no disaster recovery capability|recovery capability missing/i.test(text);
}

function hasExplicitFailoverSignals(text = '') {
  return /failover failure|(?:^|[^a-z0-9])no failover(?:$|[^a-z0-9])|without failover|fallback not ready|fallback fails?|failover does not work|fallback unavailable/i.test(text);
}

function hasExplicitRecoveryCoordinationSignals(text = '') {
  return /(recovery coordination failure|recovery team not aligned|restoration teams not aligned|continuity communications break down|recovery effort breaks down)/i.test(text)
    || ((/(recovery|restoration|continuity communications)/i.test(text))
      && /(not aligned|breaks down|fails?|delayed|delay|poor coordination|coordination breakdown)/i.test(text));
}

function hasExplicitContinuityPlanningSignals(text = '') {
  return /(business impact analysis (?:is )?(?:outdated|stale|missing|not current)|\bbia\b(?: is)? (?:outdated|stale|missing|not current)|rto(?:s)? (?:are )?(?:undefined|not defined|missing|outdated)|rpo(?:s)? (?:are )?(?:undefined|not defined|missing|outdated)|recovery priorities (?:are )?(?:undefined|not defined)|alternate (?:site|workspace) (?:is )?(?:not approved|missing|unavailable)|manual fallback (?:is )?(?:not documented|missing)|(?:business continuity|continuity|disaster recovery|recovery|crisis communication) plan(?:ning)? (?:is )?(?:missing|stale|outdated|not tested|not exercised)|call tree (?:is )?(?:outdated|missing)|incident escalation matrix (?:is )?(?:missing|outdated)|(?:continuity|dr|recovery) exercise(?:s)? (?:are )?(?:overdue|not completed|not performed))/i.test(text)
    || ((/(business impact analysis|\bbia\b|rto|rpo|alternate site|alternate workspace|manual fallback|continuity plan|business continuity plan|disaster recovery plan|dr plan|recovery plan|call tree|incident escalation matrix|crisis communication plan|exercise|testing|recovery priorities)/i.test(text))
      && /(outdated|stale|missing|not current|not defined|undefined|not documented|not tested|overdue|not approved|incomplete|absent|not exercised|lapsed)/i.test(text));
}

function hasExplicitContinuityGapSignals(text = '') {
  return hasExplicitDrGapSignals(text) || hasExplicitFailoverSignals(text);
}

function hasFunctioningFallbackSignals(text = '') {
  return /(recovery controls? (?:are )?function(?:ing|al)|fallback (?:controls?|arrangements?) (?:are )?function(?:ing|al)|fallback (?:is )?(?:working|available|operational)|failover (?:is|remains) (?:working|available|functional)|recovery capability (?:exists|is in place)|dr (?:capability|controls?) (?:exists|is in place))/i.test(text);
}

function hasExplicitPerimeterBreachSignals(text = '') {
  return /(perimeter breach|site intrusion|intrusion into facility|unauthori[sz]ed site access|badge control lapse|visitor management failure|facility access lapse|restricted area entered|tailgating)/i.test(text)
    || ((/(facility|site|perimeter|badge|visitor|restricted (?:operations )?area|campus|loading bay)/i.test(text))
      && /(bypass(?:es|ed)?|intrusion|entered|enters|unauthori[sz]ed|tailgating|breach)/i.test(text));
}

function hasExplicitOtResilienceSignals(text = '') {
  return /(ot resilience failure|industrial control instability|industrial control environment becomes unstable|operational technology environment becomes unstable|ics instability|scada disruption|control room instability)/i.test(text)
    || ((/(\bot\b|operational technology|industrial control|ics|scada|control room|site systems)/i.test(text))
      && /(unstable|instability|outage|fails?|failure|cannot be sustained safely|resilience)/i.test(text));
}

function hasExplicitForcedLabourSignals(text = '') {
  return /(forced labour|forced labor|modern slavery|child labour|child labor|human rights abuse|labour exploitation|exploitative labour practices?|recruitment fees?|passports? held|passport retention|passport confiscation|withheld passports?|debt bondage)/i.test(text)
    || ((/(supplier|sub-tier|workforce|labou?r practices?|human rights|labou?r brokers?|labou?r agents?|grievance|recruitment fees?|passport)/i.test(text))
      && /(forced labour|modern slavery|child labour|worker exploitation|exploitative|recruitment fees?|passports? held|passport retention|passport confiscation|debt bondage|labou?r brokers?|labou?r agents?)/i.test(text));
}

function hasExplicitSafetyIncidentSignals(text = '') {
  return /(safety incident|site safety incident|contractor safety incident|unsafe operating conditions|worker harm|worker harmed|injury|unsafe condition)/i.test(text)
    || ((/(worker|contractor|site|safety)/i.test(text))
      && /(incident|harm|injur|unsafe)/i.test(text));
}

function hasExplicitEnvironmentalSpillSignals(text = '') {
  return /(environmental spill|release to environment|environmental discharge|harmful material release|pollution event|loss of containment|contamination)/i.test(text)
    || ((/(containment|spill|release|discharge|contamination|pollution)/i.test(text))
      && /(environment|surrounding environment|harmful material|material)/i.test(text));
}

function hasExplicitSafetyControlWeaknessSignals(text = '') {
  return /(permit to work (?:is )?(?:missing|bypassed|not followed)|management of change (?:is )?(?:missing|bypassed|not followed)|corrective actions? (?:remain )?overdue|hazard identification (?:is )?(?:incomplete|missing)|hazard controls? (?:are )?(?:missing|weak)|machine guards? (?:are )?missing|interlocks? (?:are )?(?:missing|not functioning)|emergency stop devices? (?:are )?(?:unavailable|missing)|emergency drills? (?:are )?(?:overdue|not executed)|emergency response plan (?:is )?(?:missing|outdated)|contractor safety controls? (?:are )?weak|unsafe worker accommodation|unsafe dormitory conditions)/i.test(text)
    || ((/(permit to work|management of change|corrective action|hazard identification|hazard controls?|machine guards?|interlocks?|emergency stop devices?|emergency drills?|emergency response plan|contractor safety|worker accommodation|dormitory)/i.test(text))
      && /(missing|bypassed|not followed|overdue|incomplete|weak|unsafe|unavailable|outdated|lapsed|not executed)/i.test(text));
}

function hasExplicitWorkforceFatigueSignals(text = '') {
  return /(workforce fatigue|staffing weakness|sustained understaffing|unsafe staffing levels|staffing pressure|workforce strain|shift coverage weakness)/i.test(text)
    || ((/(fatigue|understaffed|staffing|shift coverage|worker welfare|attrition)/i.test(text))
      && /(increase|weakness|pressure|strain|shortfall|unsafe|sustained)/i.test(text));
}

function hasExplicitCriticalStaffDependencySignals(text = '') {
  return /(critical staff dependency|single point of failure in the team|key-person dependency|only one person knows|knowledge concentration|absence would materially disrupt execution)/i.test(text)
    || ((/(small number of individuals|too few trained staff|critical process|critical team|specialist)/i.test(text))
      && /(depends on|dependence on|dependency|absence|disrupt execution|only one person knows)/i.test(text));
}

function hasExplicitSingleSourceDependencySignals(text = '') {
  return /(single-source dependency|single supplier|sole source|only supplier|no viable substitute|no alternative supplier|lack of alternate source)/i.test(text)
    || ((/(supplier|vendor|source|provider|material)/i.test(text))
      && /(single|sole|only|no viable substitute|no alternative|alternate source)/i.test(text));
}

function hasExplicitSupplierConcentrationSignals(text = '') {
  return /(supplier concentration|concentrated supplier base|small number of suppliers|too few suppliers|lack of supplier diversification|supplier portfolio concentration|most critical component exposure)/i.test(text)
    || ((/(suppliers?|vendors?|providers?)/i.test(text))
      && /(concentration|concentrated|too few|small number|not diversified|lack of diversification|most .* exposure)/i.test(text));
}

function hasExplicitDeliverySlippageSignals(text = '') {
  return /(supplier delay|miss(?:es|ed)? (?:committed )?delivery dates?|missed delivery date|delivery commitments? missed|late delivery|delayed deployment|delayed installation|delivery slippage|dependent projects? delayed)/i.test(text)
    || ((/(supplier|vendor|delivery|shipment)/i.test(text))
      && /(delay|delayed|late|missed|slippage)/i.test(text));
}

function hasExplicitLogisticsDisruptionSignals(text = '') {
  return /(logistics disruption|transport disruption|shipment delay|shipping disruption|route blockage|transit disruption|port closure|freight disruption|customs hold|shipment .* blocked)/i.test(text)
    || ((/(shipment|transport|logistics|shipping|route|transit|freight|port|customs)/i.test(text))
      && /(delay|blocked|disrupt(?:ed|ion)|held|closure|fail(?:s|ed)?|interruption)/i.test(text));
}

function hasExplicitSupplierControlWeaknessSignals(text = '') {
  return /(supplier control weakness|weak supplier controls?|weak control processes|supplier assurance gap|cannot evidence adequate assurance|insufficient supplier assurance|weak supplier governance|poor supplier governance|weak control posture at supplier|assurance evidence is incomplete|business partner due diligence|beneficial ownership checks missing|beneficial ownership red flags|approved through escalation|unresolved red flags|red flags remained unresolved)/i.test(text)
    || ((/(supplier|vendor|third-party|third party|business partner|beneficial ownership)/i.test(text))
      && /(weak controls?|control processes?|assurance|cannot evidence|insufficient assurance|governance weakness|control posture|red flags?|approved through escalation|beneficial ownership)/i.test(text)
      && !hasExplicitVendorAccessWeaknessSignals(text)
      && !hasExplicitThirdPartyAccessCompromiseSignals(text));
}

function hasExplicitVendorAccessWeaknessSignals(text = '') {
  return /(vendor access weakness|excessive third-party access|external vendor accounts? have excessive access|weak vendor access controls?|weak segregation across critical systems|poorly governed external access|third-party remote access weakness|supplier access is weakly controlled)/i.test(text)
    || ((/(vendor|supplier|third-party|third party|external support|partner)/i.test(text))
      && /(access|account|segregation|remote access|identity control|privilege)/i.test(text)
      && /(excessive|weak|poor|insufficient|ungoverned|not segregated|broad)/i.test(text)
      && !hasExplicitThirdPartyAccessCompromiseSignals(text));
}

function hasExplicitSupplierInsolvencySignals(text = '') {
  return /(supplier enters insolvency|supplier insolvency|vendor insolvency|supplier bankruptcy|vendor bankruptcy|financial distress .*supplier|cannot continue delivery commitments|unable to continue supply)/i.test(text)
    || ((/(supplier|vendor|provider)/i.test(text))
      && /(insolvency|bankruptcy|financial distress|administration|cannot continue|unable to continue supply)/i.test(text));
}

function hasIdentitySignals(text = '') {
  return /(credential theft|dark ?web credentials?|admin credentials?|global admin|tenant admin|account takeover|mailbox takeover|compromised account|token theft|stolen token)/i.test(text);
}

function hasExplicitDelaySignals(text = '') {
  return hasExplicitDeliverySlippageSignals(text) || hasExplicitLogisticsDisruptionSignals(text);
}

function hasExplicitPrivacyObligationSignals(text = '') {
  return /(privacy obligations?|data protection obligations?|privacy governance failure|privacy control failure|retention breach|unlawful processing|without lawful basis|processed without a lawful basis|processing without lawful basis|records retention)/i.test(text)
    || ((/(privacy|data protection|personal data)/i.test(text))
      && /(without lawful basis|unlawful processing|obligation|governance failure|control failure)/i.test(text));
}

function hasExplicitPolicyBreachSignals(text = '') {
  return /(policy breach|policy violation|required internal control process|internal governance requirement breached|control process is not followed|policy expectations|control non-compliance|whistleblowing process not followed|whistleblower|whistleblower retaliation|retaliation against a reporter|non-retaliation commitment breached|speak-?up concern mishandled|investigation protocol|code of conduct breach|compliance investigation protocol not followed|conflict of interest is not disclosed|insider information policy|insider information|inside information|blackout period|blackout period breached|material non-public information|material non public information|material non-public information handled improperly|disclosure controls)/i.test(text)
    || ((/(policy|internal control|governance requirement|control process|whistleblowing|whistleblower|speak-?up|retaliation|investigation protocol|code of conduct|conflict of interest|insider information|inside information|material non-public information|material non public information|blackout period|disclosure controls)/i.test(text))
      && /(breach|violation|not followed|not met|failure|non-compliance|mishandled|improper|not disclosed)/i.test(text));
}

function hasExplicitRiskGovernanceSignals(text = '') {
  return /(risk appetite|risk tolerance|outside tolerance|above tolerance|residual risk|inherent risk|risk owner|risk register|project risk register|risk treatment plan|risk treatment owner|key risk indicator|\bkri\b|\bkris\b|emerging risk|risk committee|erm committee|principal risk|risk reporting cadence|three lines|three lines model)/i.test(text)
    || ((/(enterprise risk|risk management|risk register|risk owner|risk treatment|risk reporting|risk appetite|risk tolerance|residual risk|emerging risk|\bkri\b|\bkris\b)/i.test(text))
      && /(escalat|report|monitor|track|threshold|tolerance|accept|ownership|register|treatment|committee|cadence|aggregation|breach|outdated|stale|overdue)/i.test(text));
}

function hasExplicitPrivacyGovernanceSignals(text = '') {
  return /(privacy by design|data protection impact assessment|privacy impact assessment|\bdpia\b|data subject rights|subject access request|subject access requests are delayed|right to erasure|erasure request|rectification request|portability request|record of processing activities|record of processing activities is incomplete|\bropa\b|controller and processor responsibilities|controller and processor responsibilities are unclear|processor responsibilities unclear|data processing agreement missing|data processing agreement has not been updated|privacy incident response|supervisory authority notification delayed|72[- ]hour notification|dpo not consulted|health data processing not assessed|high-risk biometric processing|high-risk assessment is not completed|patient data safeguards are incomplete|local safeguards for sensitive data are incomplete|medical[- ]records access logging is weak)/i.test(text)
    || ((/(privacy|data protection|personal data|health data|patient data|medical records|biometric data|sensitive data|special category data)/i.test(text))
      && /(privacy by design|assessment|impact assessment|rights request|subject access|erasure|rectification|portability|processor|controller|processing agreement|record of processing|supervisory authority|breach notification|dpo|access logging|localisation|safeguards|high-risk assessment)/i.test(text)
      && /(missing|not done|not completed|unclear|delayed|incomplete|weak|not followed|overdue|not assessed|not documented)/i.test(text));
}

function hasExplicitThirdPartyPathAbsentSignals(text = '') {
  return /(no third-party access path|no third party access path|without third-party access|without third party access|no vendor access path|external access is not involved|third-party access is not involved)/i.test(text);
}

function hasExplicitThirdPartyAccessCompromiseSignals(text = '') {
  if (hasExplicitThirdPartyPathAbsentSignals(text)) return false;
  if (/(no compromise|not compromised|without compromise|no intrusion|not abused|no compromise has occurred|has not been compromised)/i.test(text)) return false;
  return /(vendor access compromised|third-party access compromised|partner account compromised|external support account abused|vendor credentials abused|third-party remote access(?: path)?(?: is| becomes| was)? (?:compromised|abused)|supplier access path .*compromis|vendor access path .*compromis|vendor access path .* used to reach internal systems|third-party access path .* used to reach internal systems)/i.test(text)
    || ((/(vendor|third-party|third party|supplier|partner|support account)/i.test(text))
      && /(compromis|abused|unauthori[sz]ed access|intrusion|credentials? .*abused)/i.test(text));
}

function hasExplicitCyberCauseSignals(text = '') {
  return hasAvailabilityAttackSignals(text)
    || hasIdentitySignals(text)
    || /(ransomware|malware|phishing|phish|credential theft|stolen token|compromised|compromise|unauthori[sz]ed access|intrusion|breach|botnet|volumetric attack)/i.test(text);
}

function hasExplicitGreenwashingSignals(text = '') {
  return /(greenwashing|sustainability disclosure|climate disclosure|claim substantiation|esg disclosure gap|public sustainability claims?|unsupported sustainability claims?)/i.test(text)
    || ((/(sustainability|climate|esg)/i.test(text))
      && /(claim|claims|disclosure|statement)/i.test(text)
      && /(cannot be evidenced|cannot be supported|cannot be verified|unsupported|not supported|not reconciled|does not reconcile|differ materially|materially differ|actual operating practice|actual practice|assurance prep|assurance review|assurance challenge)/i.test(text))
    || ((/(scope 2|scope 3|supplier emissions|supplier data|activity factors|renewable energy attributes|transition plan|transition milestone|public transition claims|sustainability-linked loan|sustainability-linked financing|margin step-down|kpi)/i.test(text))
      && /(cannot be evidenced|cannot be supported|cannot be verified|unsupported|not supported|not reconciled|does not reconcile|evidence gap|assurance prep|assurance review|assurance challenge|differ materially|materially differ)/i.test(text));
}

function hasExplicitRecordsRetentionSignals(text = '') {
  return /(records retention|retention schedule|records kept too long|customer records are retained beyond required deletion periods|retained beyond required deletion periods|required deletion periods|deletion obligations? not met|retention breach)/i.test(text)
    || ((/(records|retention|deletion)/i.test(text))
      && /(beyond required|too long|not met|not followed|required deletion periods)/i.test(text));
}

function hasExplicitCrossBorderTransferSignals(text = '') {
  return /(cross-border transfer|cross border transfer|transferred across borders|across borders without required safeguards|international transfer|transfer without safeguards|data residency breach|transfer impact assessment)/i.test(text)
    || ((/(transfer|across borders|cross-border|cross border|international)/i.test(text))
      && /(without required safeguards|without safeguards|required safeguards|missing safeguards|transfer impact assessment)/i.test(text));
}

function hasExplicitRegulatoryFilingSignals(text = '') {
  return /(regulatory filing|mandatory regulatory filing|missed filing|late filing|filing is not submitted on time|reporting deadline failure|mandatory reporting obligation not met|notification failure)/i.test(text)
    || ((/(filing|notification|reporting|submission)/i.test(text))
      && /(mandatory|regulatory|not submitted on time|late|missed deadline|deadline failure|not met)/i.test(text));
}

function hasExplicitSanctionsSignals(text = '') {
  return /(sanctions breach|sanctions restrictions|sanctions screening|screening control failure|restricted-party|restricted party|prohibited transaction|entity list|export control breach|denied party screening|restricted jurisdiction|restricted jurisdictions|remote technical environment|work from home in a restricted jurisdiction|export-controlled technology|re-export)/i.test(text)
    || ((/(sanctions|screening|restricted party|entity list|export control|restricted jurisdiction|denied party|re-export)/i.test(text))
      && /(breach|failure|despite|proceeds|restriction|prohibited transaction|without clearance|without approval|missing clearance)/i.test(text));
}

function hasExplicitLicensingSignals(text = '') {
  return /(licence issue|license issue|permit issue|permit breach|licensing failure|required permit|invalid permit|expired licence|expired license|licence condition failure|operations continue without a required permit)/i.test(text)
    || ((/(permit|licence|license|licensing)/i.test(text))
      && /(required|valid|invalid|expired|without|condition failure|not met|breach)/i.test(text));
}

function hasExplicitContractLiabilitySignals(text = '') {
  return /(contract liability|contractual liability|supplier agreement breach|breach of contract|indemnity exposure|terms breach|contract dispute|contractual claim)/i.test(text)
    || ((/(contract|contractual|agreement|indemnity|terms)/i.test(text))
      && /(breach|liability|claim|dispute|exposure|indemnity)/i.test(text));
}

function hasGovernanceConsequenceOnlySignals(text = '') {
  return /(regulatory scrutiny|regulator attention|legal exposure|legal concern|possible liability|potential liability|downstream liability)/i.test(text)
    && !(
      hasExplicitPolicyBreachSignals(text)
      || hasExplicitPrivacyObligationSignals(text)
      || hasExplicitRecordsRetentionSignals(text)
      || hasExplicitCrossBorderTransferSignals(text)
      || hasExplicitRegulatoryFilingSignals(text)
      || hasExplicitSanctionsSignals(text)
      || hasExplicitLicensingSignals(text)
      || hasExplicitContractLiabilitySignals(text)
    );
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
  const processBreakdown = byKey.get('process_breakdown');
  const platformInstability = byKey.get('platform_instability');
  const serviceDelivery = byKey.get('service_delivery_failure');
  const criticalDependency = byKey.get('critical_service_dependency_failure');
  const drGap = byKey.get('dr_gap');
  const failoverFailure = byKey.get('failover_failure');
  const continuityPlanning = byKey.get('continuity_planning_gap');
  const recoveryCoordination = byKey.get('recovery_coordination_failure');
  const perimeterBreach = byKey.get('perimeter_breach');
  const otResilienceFailure = byKey.get('ot_resilience_failure');
  const continuityFamilies = ['dr_gap', 'failover_failure', 'continuity_planning_gap', 'recovery_coordination_failure', 'crisis_escalation']
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
  const privacyGovernance = byKey.get('privacy_governance_gap');
  const disclosure = byKey.get('data_disclosure');
  const policyBreach = byKey.get('policy_breach');
  const riskGovernance = byKey.get('risk_governance_gap');
  const regulatoryFiling = byKey.get('regulatory_filing_failure');
  const sanctionsBreach = byKey.get('sanctions_breach');
  const licensingIssue = byKey.get('licensing_permit_issue');
  const contractLiability = byKey.get('contract_liability');
  if (riskGovernance && policyBreach && hasExplicitRiskGovernanceSignals(text) && riskGovernance.score >= policyBreach.score - 2) {
    policyBreach.score -= 6;
    applied.push('risk_governance_gap beats generic policy_breach when appetite, KRI, register, or residual-risk governance is explicit');
  }
  if (policyBreach && hasExplicitPolicyBreachSignals(text)) {
    penalise(
      ['regulatory_filing_failure', 'sanctions_breach', 'licensing_permit_issue', 'contract_liability'],
      {
        against: policyBreach,
        penalty: 4,
        tolerance: 2,
        label: 'policy_breach stays primary only when no more specific privacy, regulatory, or contract event path is explicit'
      }
    );
  }
  if (privacyGovernance && policyBreach && hasExplicitPrivacyGovernanceSignals(text) && privacyGovernance.score >= policyBreach.score - 2) {
    policyBreach.score -= 6;
    applied.push('privacy_governance_gap beats generic policy_breach when DPIA, rights, processor, or sensitive-data oversight wording is explicit');
  }
  if (privacyGovernance && privacy && hasExplicitPrivacyGovernanceSignals(text) && !hasExplicitRecordsRetentionSignals(text) && !hasExplicitCrossBorderTransferSignals(text) && privacyGovernance.score >= privacy.score - 2) {
    privacy.score -= 5;
    applied.push('privacy_governance_gap beats generic privacy non-compliance when the primary issue is governance, rights handling, or privacy-by-design');
  }
  if (privacyGovernance && regulatoryFiling && hasExplicitPrivacyGovernanceSignals(text) && !hasExplicitDisclosureSignals(text) && privacyGovernance.score >= regulatoryFiling.score - 2) {
    regulatoryFiling.score -= 5;
    applied.push('privacy_governance_gap beats regulatory_filing_failure when authority-notification wording is part of a broader privacy-governance failure');
  }
  if (privacy && disclosure && hasExplicitPrivacyObligationSignals(text) && !hasExplicitDisclosureSignals(text) && privacy.score >= disclosure.score - 3) {
    disclosure.score -= 7;
    applied.push('privacy_non_compliance beats data_disclosure when obligation failure is primary');
  }
  if (privacy && policyBreach && hasExplicitPrivacyObligationSignals(text) && privacy.score >= policyBreach.score - 2) {
    policyBreach.score -= 5;
    applied.push('privacy_non_compliance beats generic policy_breach when privacy obligations are explicit');
  }
  const retention = byKey.get('records_retention_non_compliance');
  if (retention && privacyGovernance && hasExplicitRecordsRetentionSignals(text) && retention.score >= privacyGovernance.score - 2) {
    privacyGovernance.score -= 5;
    applied.push('records_retention_non_compliance beats privacy_governance_gap when retention obligations are explicit');
  }
  if (retention && privacy && hasExplicitRecordsRetentionSignals(text) && retention.score >= privacy.score - 2) {
    privacy.score -= 5;
    applied.push('records_retention_non_compliance beats generic privacy non-compliance when retention obligations are explicit');
  }
  if (retention && policyBreach && hasExplicitRecordsRetentionSignals(text) && retention.score >= policyBreach.score - 2) {
    policyBreach.score -= 5;
    applied.push('records_retention_non_compliance beats generic policy_breach when retention obligations are explicit');
  }
  const crossBorder = byKey.get('cross_border_transfer_non_compliance');
  if (crossBorder && privacyGovernance && hasExplicitCrossBorderTransferSignals(text) && crossBorder.score >= privacyGovernance.score - 2) {
    privacyGovernance.score -= 5;
    applied.push('cross_border_transfer_non_compliance beats privacy_governance_gap when transfer obligations are explicit');
  }
  if (crossBorder && privacy && hasExplicitCrossBorderTransferSignals(text) && crossBorder.score >= privacy.score - 2) {
    privacy.score -= 5;
    applied.push('cross_border_transfer_non_compliance beats generic privacy non-compliance when transfer obligations are explicit');
  }
  if (crossBorder && policyBreach && hasExplicitCrossBorderTransferSignals(text) && crossBorder.score >= policyBreach.score - 2) {
    policyBreach.score -= 5;
    applied.push('cross_border_transfer_non_compliance beats generic policy_breach when transfer obligations are explicit');
  }
  if (regulatoryFiling && hasExplicitRegulatoryFilingSignals(text)) {
    penalise(
      ['policy_breach', 'privacy_non_compliance'],
      {
        against: regulatoryFiling,
        penalty: 6,
        tolerance: 2,
        label: 'regulatory_filing_failure beats generic compliance when a filing or reporting obligation is explicitly missed'
      }
    );
  }
  if (sanctionsBreach && hasExplicitSanctionsSignals(text)) {
    penalise(
      ['policy_breach', 'regulatory_filing_failure', 'market_access_restriction'],
      {
        against: sanctionsBreach,
        penalty: 6,
        tolerance: 2,
        label: 'sanctions_breach beats generic policy or regulatory concern when sanctions signals are explicit'
      }
    );
  }
  if (licensingIssue && hasExplicitLicensingSignals(text)) {
    penalise(
      ['policy_breach', 'regulatory_filing_failure'],
      {
        against: licensingIssue,
        penalty: 6,
        tolerance: 2,
        label: 'licensing_permit_issue beats generic compliance or regulatory concern when permit or licence signals are explicit'
      }
    );
  }
  if (contractLiability && hasExplicitContractLiabilitySignals(text) && !hasExplicitDisclosureSignals(text)) {
    penalise(
      ['policy_breach', 'supplier_control_weakness', 'data_disclosure'],
      {
        against: contractLiability,
        penalty: 6,
        tolerance: 2,
        label: 'contract_liability beats generic compliance or disclosure drift when contractual obligation language is explicit'
      }
    );
  }

  const delivery = byKey.get('delivery_slippage');
  const singleSource = byKey.get('single_source_dependency');
  const supplierInsolvency = byKey.get('supplier_insolvency');
  const logisticsDisruption = byKey.get('logistics_disruption');
  const vendorAccessWeakness = byKey.get('vendor_access_weakness');
  const programmeDelivery = byKey.get('programme_delivery_slippage');
  if (delivery && riskGovernance && hasExplicitDeliverySlippageSignals(text)) {
    riskGovernance.score -= 12;
    applied.push('delivery_slippage beats enterprise-risk governance when an actual supplier delivery miss is explicit');
  }
  if (programmeDelivery && riskGovernance && /(programme delivery slip|project delivery delay|deployment delayed|milestone slip|go-live delay|dependent projects delayed)/i.test(text)) {
    riskGovernance.score -= 10;
    applied.push('programme_delivery_slippage beats enterprise-risk governance when a live programme delay is explicit');
  }
  if (delivery && singleSource && hasExplicitDelaySignals(text) && delivery.score >= singleSource.score - 2) {
    singleSource.score -= 5;
    applied.push('delivery_slippage beats single_source_dependency when actual delay is explicit');
  }
  const supplierConcentration = byKey.get('supplier_concentration_risk');
  if (delivery && supplierConcentration && hasExplicitDeliverySlippageSignals(text) && delivery.score >= supplierConcentration.score - 2) {
    supplierConcentration.score -= 5;
    applied.push('delivery_slippage beats supplier_concentration_risk when actual missed delivery is explicit');
  }
  if (singleSource
    && hasExplicitSingleSourceDependencySignals(text)
    && !hasExplicitDelaySignals(text)
    && !hasExplicitSupplierInsolvencySignals(text)
    && !hasExplicitThirdPartyAccessCompromiseSignals(text)) {
    penalise(
      ['delivery_slippage', 'logistics_disruption', 'programme_delivery_slippage', 'supplier_insolvency', 'third_party_access_compromise'],
      {
        against: singleSource,
        penalty: 6,
        tolerance: 2,
        label: 'single_source_dependency stays primary when the event path is sourcing fragility rather than a live delivery, insolvency, or compromise event'
      }
    );
  }
  if (supplierConcentration
    && hasExplicitSupplierConcentrationSignals(text)
    && !hasExplicitDelaySignals(text)
    && !hasExplicitSupplierInsolvencySignals(text)
    && !hasExplicitThirdPartyAccessCompromiseSignals(text)) {
    penalise(
      ['delivery_slippage', 'logistics_disruption', 'programme_delivery_slippage', 'supplier_insolvency', 'third_party_access_compromise'],
      {
        against: supplierConcentration,
        penalty: 6,
        tolerance: 2,
        label: 'supplier_concentration_risk stays primary when diversification weakness is explicit and no live supplier incident is stated'
      }
    );
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
  if (delivery
    && programmeDelivery
    && hasExplicitDeliverySlippageSignals(text)
    && /(supplier|vendor|shipment|delivery|hardware|equipment|material)/i.test(text)
    && !/(internal integration|integration work|portfolio|programme governance|benefits realisation|benefits realization)/i.test(text)
    && delivery.score >= programmeDelivery.score - 2) {
    programmeDelivery.score -= 5;
    applied.push('delivery_slippage beats programme_delivery_slippage when the event is supplier delivery rather than internal programme execution');
  }
  if (logisticsDisruption && hasExplicitLogisticsDisruptionSignals(text)) {
    penalise(
      ['delivery_slippage', 'programme_delivery_slippage'],
      {
        against: logisticsDisruption,
        penalty: 6,
        tolerance: 2,
        label: 'logistics_disruption beats generic delivery slippage when transport or transit failure is explicit'
      }
    );
  }
  if (supplierInsolvency && hasExplicitSupplierInsolvencySignals(text)) {
    penalise(
      ['delivery_slippage', 'counterparty_default'],
      {
        against: supplierInsolvency,
        penalty: 7,
        tolerance: 2,
        label: 'supplier_insolvency beats generic delivery or finance interpretations when supplier financial failure is explicit'
      }
    );
  }
  if (vendorAccessWeakness
    && hasExplicitVendorAccessWeaknessSignals(text)
    && !hasExplicitThirdPartyAccessCompromiseSignals(text)) {
    penalise(
      ['supplier_control_weakness', 'identity_compromise', 'cloud_control_failure'],
      {
        against: vendorAccessWeakness,
        penalty: 5,
        tolerance: 2,
        label: 'vendor_access_weakness beats generic governance or internal cyber interpretations when the external-access path is the issue'
      }
    );
  }
  const supplierControlWeakness = byKey.get('supplier_control_weakness');
  if (supplierControlWeakness
    && hasExplicitSupplierControlWeaknessSignals(text)
    && !hasExplicitVendorAccessWeaknessSignals(text)
    && !hasExplicitThirdPartyAccessCompromiseSignals(text)
    && !hasExplicitSupplierInsolvencySignals(text)
    && !hasExplicitDelaySignals(text)) {
    penalise(
      ['policy_breach', 'regulatory_filing_failure'],
      {
        against: supplierControlWeakness,
        penalty: 5,
        tolerance: 2,
        label: 'supplier_control_weakness beats generic compliance interpretations when inherited supplier assurance weakness is primary'
      }
    );
  }
  if (privacyGovernance && supplierControlWeakness && hasExplicitPrivacyGovernanceSignals(text) && privacyGovernance.score >= supplierControlWeakness.score - 2) {
    supplierControlWeakness.score -= 6;
    applied.push('privacy_governance_gap beats supplier_control_weakness when processor or controller wording is part of a privacy-accountability failure');
  }

  const thirdPartyAccessCompromise = byKey.get('third_party_access_compromise');
  if (thirdPartyAccessCompromise && hasExplicitThirdPartyAccessCompromiseSignals(text)) {
    penalise(
      ['vendor_access_weakness', 'supplier_control_weakness', 'identity_compromise'],
      {
        against: thirdPartyAccessCompromise,
        penalty: 6,
        tolerance: 2,
        label: 'third_party_access_compromise beats governance weakness or internal identity when an inherited access path is explicitly compromised'
      }
    );
  }
  if (hasExplicitThirdPartyPathAbsentSignals(text)) {
    if (thirdPartyAccessCompromise) thirdPartyAccessCompromise.score -= 8;
    if (vendorAccessWeakness) vendorAccessWeakness.score -= 6;
    applied.push('internal-only wording blocks third-party path interpretations');
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
  const forcedLabour = byKey.get('forced_labour_modern_slavery');
  const safetyIncident = byKey.get('safety_incident');
  const environmentalSpill = byKey.get('environmental_spill');
  const safetyControlWeakness = byKey.get('safety_control_weakness');
  const workforceFatigue = byKey.get('workforce_fatigue_staffing_weakness');
  const criticalStaffDependency = byKey.get('critical_staff_dependency');
  if (continuityPlanning && hasExplicitContinuityPlanningSignals(text)) {
    penalise(
      ['risk_governance_gap', 'policy_breach', 'process_breakdown', 'service_delivery_failure', 'platform_instability'],
      {
        against: continuityPlanning,
        penalty: 6,
        tolerance: 2,
        label: 'continuity_planning_gap beats generic governance or operational interpretations when BIA, recovery targets, plans, or exercises are explicitly stale or missing'
      }
    );
  }
  if (greenwashing && policyBreach && hasExplicitGreenwashingSignals(text) && greenwashing.score >= policyBreach.score - 2) {
    policyBreach.score -= 6;
    applied.push('greenwashing_disclosure_gap beats generic policy breach when disclosure substantiation is explicit');
  }
  if (greenwashing && hasExplicitGreenwashingSignals(text)) {
    penalise(
      ['regulatory_filing_failure', 'privacy_non_compliance'],
      {
        against: greenwashing,
        penalty: 5,
        tolerance: 2,
        label: 'greenwashing_disclosure_gap beats generic compliance or filing interpretations when ESG claims are explicitly unsupported'
      }
    );
  }
  if (forcedLabour && hasExplicitForcedLabourSignals(text)) {
    penalise(
      ['supplier_control_weakness', 'single_source_dependency', 'supplier_concentration_risk', 'policy_breach'],
      {
        against: forcedLabour,
        penalty: 6,
        tolerance: 2,
        label: 'forced_labour_modern_slavery beats procurement or generic compliance when human-rights abuse is explicit'
      }
    );
  }
  if (safetyIncident && hasExplicitSafetyIncidentSignals(text)) {
    penalise(
      ['process_breakdown', 'service_delivery_failure', 'platform_instability', 'safety_control_weakness'],
      {
        against: safetyIncident,
        penalty: 6,
        tolerance: 2,
        label: 'safety_incident beats generic operational disruption when safety harm or unsafe conditions are explicit'
      }
    );
  }
  if (environmentalSpill && hasExplicitEnvironmentalSpillSignals(text)) {
    penalise(
      ['policy_breach', 'regulatory_filing_failure', 'process_breakdown', 'service_delivery_failure', 'safety_control_weakness'],
      {
        against: environmentalSpill,
        penalty: 6,
        tolerance: 2,
        label: 'environmental_spill beats generic compliance or operational interpretations when a spill or release is explicit'
      }
    );
    if (safetyIncident && !hasExplicitSafetyIncidentSignals(text) && environmentalSpill.score >= safetyIncident.score - 2) {
      safetyIncident.score -= 4;
      applied.push('environmental_spill stays primary over safety_incident when release is explicit and worker harm is not');
    }
  }
  if (safetyControlWeakness && hasExplicitSafetyControlWeaknessSignals(text)) {
    penalise(
      ['policy_breach', 'process_breakdown', 'service_delivery_failure', 'risk_governance_gap'],
      {
        against: safetyControlWeakness,
        penalty: 6,
        tolerance: 2,
        label: 'safety_control_weakness beats generic compliance or operational interpretations when permit, hazard, drill, or corrective-action weakness is explicit'
      }
    );
  }
  if (workforceFatigue && hasExplicitWorkforceFatigueSignals(text)) {
    penalise(
      ['process_breakdown', 'service_delivery_failure', 'platform_instability'],
      {
        against: workforceFatigue,
        penalty: 6,
        tolerance: 2,
        label: 'workforce_fatigue_staffing_weakness beats generic operational backlog when fatigue or unsafe staffing is explicit'
      }
    );
  }
  if (criticalStaffDependency && hasExplicitCriticalStaffDependencySignals(text)) {
    penalise(
      ['process_breakdown', 'service_delivery_failure', 'platform_instability', 'portfolio_execution_drift'],
      {
        against: criticalStaffDependency,
        penalty: 6,
        tolerance: 2,
        label: 'critical_staff_dependency beats generic operational or strategic interpretations when key-person concentration is explicit'
      }
    );
    if (workforceFatigue && !hasExplicitWorkforceFatigueSignals(text) && criticalStaffDependency.score >= workforceFatigue.score - 2) {
      workforceFatigue.score -= 4;
      applied.push('critical_staff_dependency stays primary over generic workforce fatigue when key-person concentration is explicit');
    }
  }

  const strongestOperational = [criticalDependency, serviceDelivery, processBreakdown, platformInstability]
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0] || null;
  const strongestContinuity = [failoverFailure, drGap, continuityPlanning, recoveryCoordination]
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0] || null;

  if (strongestOperational && !hasExplicitContinuityGapSignals(text) && !hasExplicitRecoveryCoordinationSignals(text) && !hasExplicitContinuityPlanningSignals(text)) {
    penalise(
      ['dr_gap', 'failover_failure', 'continuity_planning_gap', 'recovery_coordination_failure', 'crisis_escalation'],
      {
        against: strongestOperational,
        penalty: 6,
        tolerance: 2,
        label: 'operational service or workflow failure beats business_continuity when explicit DR, failover, recovery-gap, or continuity-planning language is absent'
      }
    );
  }
  if (strongestOperational && hasFunctioningFallbackSignals(text) && !hasExplicitContinuityGapSignals(text) && !hasExplicitContinuityPlanningSignals(text)) {
    penalise(
      ['dr_gap', 'failover_failure', 'continuity_planning_gap', 'recovery_coordination_failure', 'crisis_escalation'],
      {
        against: strongestOperational,
        penalty: 7,
        tolerance: 2,
        label: 'functioning fallback or recovery controls block continuity promotion when the event path is operational and continuity planning is not the explicit weakness'
      }
    );
  }
  if (strongestContinuity && (hasExplicitContinuityGapSignals(text) || hasExplicitRecoveryCoordinationSignals(text) || hasExplicitContinuityPlanningSignals(text))) {
    penalise(
      ['process_breakdown', 'service_delivery_failure', 'platform_instability', 'critical_service_dependency_failure'],
      {
        against: strongestContinuity,
        penalty: 5,
        tolerance: 2,
        label: 'explicit continuity planning, DR, failover, or recovery-gap language beats generic operational instability'
      }
    );
  }
  if (criticalDependency && serviceDelivery && hasExplicitDependencyFailureSignals(text) && criticalDependency.score >= serviceDelivery.score - 2) {
    serviceDelivery.score -= 5;
    applied.push('critical_service_dependency_failure beats generic service_delivery_failure when the dependency failure is the event path');
  }
  if (serviceDelivery
    && platformInstability
    && hasExplicitServiceDeliveryFailureSignals(text)
    && hasExplicitPlatformInstabilitySignals(text)
    && /(customer-facing service|service delays|critical service|delivery path)/i.test(text)
    && serviceDelivery.score >= platformInstability.score - 4) {
    platformInstability.score -= 5;
    applied.push('service_delivery_failure beats platform_instability when the service path is failing and platform defects are the cause');
  }
  if (processBreakdown && serviceDelivery && hasExplicitProcessBreakdownSignals(text) && /(workflow|manual workaround|manual processing|handoff)/i.test(text) && processBreakdown.score >= serviceDelivery.score - 1) {
    serviceDelivery.score -= 3;
    applied.push('process_breakdown beats service_delivery_failure when workflow collapse or manual rework is explicit');
  }
  if (perimeterBreach && hasExplicitPerimeterBreachSignals(text)) {
    penalise(
      ['process_breakdown', 'service_delivery_failure', 'platform_instability', 'dr_gap', 'failover_failure', 'recovery_coordination_failure'],
      {
        against: perimeterBreach,
        penalty: 6,
        tolerance: 2,
        label: 'perimeter_breach beats generic operational or continuity wording when physical intrusion or restricted-area access failure is explicit'
      }
    );
  }
  if (otResilienceFailure && hasExplicitOtResilienceSignals(text)) {
    penalise(
      ['process_breakdown', 'service_delivery_failure', 'platform_instability', 'availability_attack'],
      {
        against: otResilienceFailure,
        penalty: 6,
        tolerance: 2,
        label: 'ot_resilience_failure beats generic operational or cyber wording when industrial-control instability is explicit'
      }
    );
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
    .filter((key) => !(key === 'third_party_dependency' && hasExplicitThirdPartyPathAbsentSignals(text)))
    .filter((key) => SCENARIO_TAXONOMY_OVERLAY_BY_KEY[key])
    .map((key) => SCENARIO_TAXONOMY_OVERLAY_BY_KEY[key]);
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
  const suppressGovernanceHintFallback = Boolean(
    !hasUsablePrimary
    && !weakExplicitPrimary
    && hintFamily
    && ['compliance', 'regulatory', 'legal_contract'].includes(String(hintFamily.domain || '').trim())
    && hasGovernanceConsequenceOnlySignals(text)
  );
  const primaryFamily = hasUsablePrimary
    ? best.family
    : (weakExplicitPrimary ? best.family : (suppressGovernanceHintFallback ? null : (hintFamily || null)));
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
  const usedHintFallback = Boolean(primaryFamily && !hasUsablePrimary && !weakExplicitPrimary && hintFamily?.key === primaryFamily.key);

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

  const matchedSignals = hasUsablePrimary ? best.matchedSignals : [];
  const blockedByAntiSignals = scoredFamilies
    .filter((item) => item.antiMatches.length)
    .map((item) => ({
      familyKey: item.family.key,
      signals: item.antiMatches.map((signal) => signal.text)
    }));
  const matchedAntiSignals = scoredFamilies
    .filter((item) => item.antiMatches.length)
    .slice(0, 4)
    .flatMap((item) => item.antiMatches.map((signal) => ({
      ...signal,
      familyKey: item.family.key
    })));
  const classification = {
    ...primaryProfile,
    domain: String(primaryFamily?.domain || '').trim(),
    primaryFamily,
    secondaryFamilies,
    mechanisms,
    overlays,
    matchedSignals,
    matchedAntiSignals,
    triggerSignals: uniqueStrings(matchedSignals.map((signal) => signal.text)),
    blockedByAntiSignals,
    reasonCodes: uniqueStrings(reasonCodes),
    ambiguityFlags: uniqueStrings(ambiguityFlags),
    taxonomyVersion: SCENARIO_TAXONOMY.taxonomyVersion,
    secondaryKeys: uniqueStrings(secondaryFamilies.map((family) => family.lensKey)).filter((key) => key && key !== primaryProfile.key)
  };
  const calibratedConfidence = calibrateClassificationConfidence({
    bestScore: Number(best?.score || 0),
    secondScore: Number(second?.score || 0),
    matchedSignalCount: matchedSignals.length,
    strongSignalCount: matchedSignals.filter((signal) => String(signal?.strength || '').toLowerCase() === 'strong').length,
    mechanismCount: mechanisms.length,
    antiSignalCount: Number(best?.antiMatches?.length || 0),
    blockedByAntiSignalCount: best?.blocked ? 1 : 0,
    topDomainCount: topDomainSet.size,
    hasUsablePrimary,
    weakExplicitPrimary,
    hasExplicitPrimarySignals,
    requiredSignalsMet: Boolean(best?.requiredMatches?.length),
    overlayHeavy,
    ambiguityFlags: classification.ambiguityFlags,
    reasonCodes: classification.reasonCodes,
    precedenceAppliedCount: precedence.applied.length,
    usedHintFallback
  });

  return {
    ...classification,
    confidence: calibratedConfidence.confidenceScore / 100,
    confidenceScore: calibratedConfidence.confidenceScore,
    confidenceBand: calibratedConfidence.confidenceBand,
    confidenceDrivers: calibratedConfidence.confidenceDrivers,
    calibrationMode: calibratedConfidence.calibrationMode,
    ambiguityFlags: uniqueStrings([
      ...classification.ambiguityFlags,
      ...(calibratedConfidence.confidenceScore < 60 ? ['LOW_PRIMARY_CONFIDENCE'] : [])
    ])
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
