function _setStep1ButtonBusy(button, busyLabel, idleLabel) {
  if (!button) return () => {};
  const originalLabel = idleLabel || button.dataset.idleLabel || button.textContent || '';
  button.dataset.idleLabel = originalLabel;
  button.classList?.add('btn--step1-ai-busy');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = busyLabel;
  return () => {
    button.classList?.remove('btn--step1-ai-busy');
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = originalLabel;
  };
}

function getStep1RecommendedAction(draft, selectedRisks) {
  const selectedCount = Array.isArray(selectedRisks) ? selectedRisks.length : 0;
  if (!String(draft.narrative || '').trim() && !selectedCount) {
    return {
      title: 'Start with the guided questions',
      copy: 'Answer the simple prompts first. That is the fastest path for most users and gives AI better context to work with.'
    };
  }
  if (String(draft.narrative || '').trim() && !selectedCount) {
    return {
      title: 'Use AI or add the risks you want to assess',
      copy: 'Your scenario wording is in place. Next, either let AI suggest risks from it or add the risks you already know belong in scope.'
    };
  }
  return {
    title: 'Review the selected risks and continue',
    copy: `You already have ${selectedCount} risk${selectedCount === 1 ? '' : 's'} selected. Remove anything out of scope, then continue to scenario review.`
  };
}

function renderStep1SelectedRisksSummary(selectedRisks, riskCandidates) {
  if (!selectedRisks.length) return '';
  const chosenRisks = (riskCandidates || []).filter(risk => selectedRisks.includes(risk.id)).slice(0, 3);
  return `<section class="wizard-summary-band anim-fade-in anim-delay-1">
    <div>
      <div class="wizard-summary-band__label">Selected for this assessment</div>
      <strong>${selectedRisks.length} risk${selectedRisks.length === 1 ? '' : 's'} currently in scope</strong>
      <div class="wizard-summary-band__copy">Keep only risks that belong in the same scenario and management discussion before you continue.</div>
    </div>
    <div class="wizard-summary-band__meta">
      ${chosenRisks.map(risk => `<span class="badge badge--neutral">${escapeHtml(String(risk.title || risk.name || 'Risk'))}</span>`).join('')}
      ${selectedRisks.length > chosenRisks.length ? `<span class="badge badge--neutral">+${selectedRisks.length - chosenRisks.length} more</span>` : ''}
    </div>
  </section>`;
}

const STEP1_DRY_RUN_FUNCTION_LABELS = {
  finance: 'Finance',
  procurement: 'Procurement',
  compliance: 'Compliance',
  operations: 'Operations',
  technology: 'Technology and cyber',
  strategic: 'Strategic',
  hse: 'HSE',
  general: 'Cross-functional'
};

const STEP1_FUNCTION_TO_SCENARIO_LENS = {
  finance: { key: 'financial', label: 'Financial', functionKey: 'finance', estimatePresetKey: 'financial' },
  procurement: { key: 'procurement', label: 'Procurement', functionKey: 'procurement', estimatePresetKey: 'procurement' },
  compliance: { key: 'compliance', label: 'Compliance', functionKey: 'compliance', estimatePresetKey: 'compliance' },
  operations: { key: 'operational', label: 'Operational', functionKey: 'operations', estimatePresetKey: 'operational' },
  technology: { key: 'cyber', label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'identity' },
  strategic: { key: 'strategic', label: 'Strategic', functionKey: 'strategic', estimatePresetKey: 'strategic' },
  hse: { key: 'hse', label: 'HSE', functionKey: 'hse', estimatePresetKey: 'hse' },
  general: { key: 'general', label: 'General enterprise risk', functionKey: 'general', estimatePresetKey: 'general' }
};

const STEP1_PROMPT_IDEA_CONFIDENCE_STATES = Object.freeze({
  high: 'high_confidence_family',
  candidate: 'candidate_families',
  low: 'low_confidence_unknown'
});

const STEP1_PROMPT_REFINEMENT_HINTS = Object.freeze([
  'Add what is affected',
  'Add the likely trigger',
  'Build the draft for stronger classification'
]);

const STEP1_RANSOMWARE_SIGNAL_RE = /(ransom|ransomware|extortion|ransom note|payment to unlock|unlock files?|encrypt(?:ed|s|ing)? (?:systems?|servers?|files?)|encrypted (?:systems?|servers?|files?)|decrypt(?:ion)? key|malware)/;
const STEP1_EXPLICIT_CYBER_SIGNAL_RE = /(cyber|security|identity|credential|ransom|malware|phish|breach|exfil|privileged|unauthori[sz]ed|misconfig|vulnerability|token theft|session hijack|compromise|account takeover|account hijack|hijack(?:ed|ing)?|mailbox|email compromise|email account|business email compromise|\bbec\b|dark ?web|credential dump|credential leak|leaked credential|stolen credential|admin account|tenant admin|azure admin|executive mailbox|ceo fraud)/;
const STEP1_PAYMENT_CONTROL_SIGNAL_RE = /(payment|payable|invoice|collections|settlement|treasury|disbursement).*(control|failure|breakdown|approval|fraud|manipulation)|(?:control|failure|breakdown|approval|fraud|manipulation).*(payment|payable|invoice|collections|settlement|treasury|disbursement)/;

function hasStep1RansomwareSignal(text = '') {
  return STEP1_RANSOMWARE_SIGNAL_RE.test(String(text || '').toLowerCase());
}

function hasStep1ExplicitCyberSignal(text = '') {
  const haystack = String(text || '').toLowerCase();
  return hasStep1RansomwareSignal(haystack) || STEP1_EXPLICIT_CYBER_SIGNAL_RE.test(haystack);
}

function hasStep1PaymentControlSignal(text = '') {
  return STEP1_PAYMENT_CONTROL_SIGNAL_RE.test(String(text || '').toLowerCase());
}

// Keep the authoritative draft build on the server, and also allow guided prompt-idea
// enrichment to use the live path when enough signal exists. The pre-build preview can
// still remain local when no stronger live result is returned.
const STEP1_USE_GUIDED_SERVER_HELPERS = true;

const STEP1_LENS_REGULATION_SUGGESTIONS = {
  cyber: ['UAE PDPL', 'UAE Information Assurance Standard', 'UAE National Cyber Security Governance Framework', 'NIST SP 800-53', 'NIST RMF', 'ISO 27001'],
  regulatory: ['BIS Export Controls', 'OFAC Sanctions'],
  financial: ['UAE AML/CFT', 'COSO Internal Control Framework'],
  'fraud-integrity': ['ISO 37001', 'UAE AML/CFT'],
  esg: ['IFRS S1', 'IFRS S2', 'GRI Universal Standards'],
  procurement: ['ISO 20400', 'ISO 37301'],
  'supply-chain': ['ISO 28000', 'ISO 27036'],
  'business-continuity': ['NCEMA 7000:2021 Business Continuity', 'ISO 22301', 'ISO 22313', 'NFPA 1600'],
  'physical-security': ['UAE Fire and Life Safety Code', 'ISO 22301'],
  'ot-resilience': ['IEC 62443', 'ISO 22301'],
  'people-workforce': ['UN Guiding Principles', 'SA8000', 'ILO-OSH 2001'],
  'investment-jv': ['COSO ERM', 'ISO 31000'],
  'transformation-delivery': ['ISO 31010', 'COSO ERM'],
  hse: ['ISO 45001', 'ISO 14001', 'Abu Dhabi EHSMS'],
  operational: ['ISO 31000', 'ISO 22301'],
  strategic: ['ISO 31000', 'COSO ERM'],
  compliance: ['ISO 37301', 'UAE PDPL'],
  'legal-contract': ['ISO 37301'],
  geopolitical: ['OFAC Sanctions', 'BIS Export Controls']
};

function getStep1ScenarioTaxonomyProjection() {
  if (typeof window !== 'undefined' && window?.ScenarioTaxonomyProjection) return window.ScenarioTaxonomyProjection;
  if (typeof globalThis !== 'undefined' && globalThis?.ScenarioTaxonomyProjection) return globalThis.ScenarioTaxonomyProjection;
  return null;
}

function evaluateStep1ScenarioWithProjection(text = '', scenarioLensHint = '') {
  const helper = getStep1ScenarioTaxonomyProjection();
  if (!helper || typeof helper.evaluateScenarioCompetition !== 'function') return null;
  const analysis = helper.evaluateScenarioCompetition(text, {
    scenarioLensHint,
    limit: 5
  });
  return analysis && (
    analysis.classification?.familyKey
    || analysis.topFamilyKey
    || (analysis.topLensKey && analysis.topLensKey !== 'general')
    || (Array.isArray(analysis.topFamilies) && analysis.topFamilies.length)
  )
    ? analysis
    : null;
}

function classifyStep1ScenarioWithProjection(text = '', scenarioLensHint = '') {
  const classification = evaluateStep1ScenarioWithProjection(text, scenarioLensHint)?.classification || null;
  return classification?.familyKey
    ? classification
    : null;
}

function mapStep1FunctionKeyFromProjection(classification = null, fallback = 'general') {
  const lensKey = String(classification?.lensKey || '').trim();
  const lensBucketMap = {
    cyber: 'technology',
    financial: 'finance',
    compliance: 'compliance',
    regulatory: 'compliance',
    'legal-contract': 'compliance',
    procurement: 'procurement',
    'third-party': 'procurement',
    operational: 'operations',
    'business-continuity': 'operations',
    'supply-chain': 'operations',
    'physical-security': 'operations',
    'ot-resilience': 'operations',
    hse: 'hse',
    'people-workforce': 'hse',
    strategic: 'strategic',
    geopolitical: 'strategic',
    esg: 'strategic',
    'investment-jv': 'strategic',
    'transformation-delivery': 'strategic'
  };
  return lensBucketMap[lensKey] || String(classification?.functionKey || fallback || 'general').trim() || 'general';
}

function buildStep1LensFromProjection(classification = null, fallback = null) {
  const helper = getStep1ScenarioTaxonomyProjection();
  if (!helper || typeof helper.buildScenarioLens !== 'function') return fallback;
  const lens = helper.buildScenarioLens(classification || {}, fallback?.key || fallback || '');
  return lens && lens.key
    ? {
        ...lens,
        functionKey: mapStep1FunctionKeyFromProjection(classification || lens, lens.functionKey || fallback?.functionKey || 'general')
      }
    : fallback;
}

function mergeStep1LensWithStored(lens = null, stored = null) {
  if (!lens?.key) return stored || lens;
  if (!stored?.key || stored.key === 'general' || stored.key === lens.key) return lens;
  return {
    ...lens,
    secondaryKeys: Array.from(new Set([
      ...(Array.isArray(lens.secondaryKeys) ? lens.secondaryKeys : []),
      ...(Array.isArray(stored.secondaryKeys) ? stored.secondaryKeys : []),
      stored.key
    ])).filter((key) => key && key !== lens.key)
  };
}

function uniqueStep1Keys(list = []) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));
}

function getStep1ProjectionFamilyOrder(analysis = null, limit = 3) {
  if (!analysis) return [];
  const ambiguityFlags = new Set(Array.isArray(analysis.ambiguityFlags) ? analysis.ambiguityFlags : []);
  const hardFamilyOrder = [
    analysis.classification?.familyKey,
    ...(Array.isArray(analysis.classification?.secondaryFamilyKeys) ? analysis.classification.secondaryFamilyKeys : [])
  ].filter(Boolean);
  const competitiveOrder = (Array.isArray(analysis.topFamilies) ? analysis.topFamilies : [])
    .map((family) => String(family?.familyKey || '').trim())
    .filter(Boolean);
  if (
    hardFamilyOrder.length
    && !ambiguityFlags.has('MIXED_TOP_FAMILIES')
  ) {
    return uniqueStep1Keys(hardFamilyOrder).slice(0, limit);
  }
  return uniqueStep1Keys(competitiveOrder).slice(0, limit);
}

function countStep1PatternMatches(haystack = '', patterns = []) {
  return (Array.isArray(patterns) ? patterns : []).reduce((count, pattern) => (
    pattern && pattern.test(haystack) ? count + 1 : count
  ), 0);
}

function hasStep1StrongCrossLensCompetition(topFamilies = []) {
  const rankedFamilies = Array.isArray(topFamilies) ? topFamilies : [];
  const primary = rankedFamilies[0] || null;
  if (!primary?.familyKey || !primary?.lensKey) return false;
  const runnerUp = rankedFamilies.find((family, index) => (
    index > 0
    && family?.familyKey
    && family?.lensKey
    && String(family.lensKey || '').trim() !== String(primary.lensKey || '').trim()
  )) || null;
  if (!runnerUp) return false;
  const primaryScore = Number(primary.score || 0);
  const runnerUpScore = Number(runnerUp.score || 0);
  const separation = primaryScore - runnerUpScore;
  const runnerUpSignalCount = Array.isArray(runnerUp.matchedSignals) ? runnerUp.matchedSignals.length : 0;
  const primarySignalCount = Array.isArray(primary.matchedSignals) ? primary.matchedSignals.length : 0;
  return (
    primaryScore >= 5
    && primarySignalCount >= 2
    && runnerUpScore >= 4.5
    && runnerUpSignalCount >= 2
    && separation <= 3.1
  );
}

function hasStep1SupplierProgrammeCompetition(text = '') {
  const haystack = String(text || '').toLowerCase();
  return (
    /(supplier|vendor|third[- ]party|third party)/.test(haystack)
    && /(delay|delayed|slip|slippage|missed|late)/.test(haystack)
    && /(transformation|programme|program|milestone|go-live|rollout|cutover|major project|dependent project|dependent projects)/.test(haystack)
  );
}

function buildStep1ProjectionHintModel(text = '', scenarioLensHint = '') {
  const analysis = evaluateStep1ScenarioWithProjection(text, scenarioLensHint);
  if (!analysis) return null;
  const topFamilies = Array.isArray(analysis.topFamilies) ? analysis.topFamilies : [];
  const competitiveTopFamilies = topFamilies.filter((family) => family?.qualified || family?.primary);
  const ambiguityFlags = uniqueStep1Keys([
    ...(analysis.ambiguityFlags || analysis.classification?.ambiguityFlags || []),
    ...(hasStep1StrongCrossLensCompetition(topFamilies) ? ['MIXED_TOP_FAMILIES'] : []),
    ...(hasStep1SupplierProgrammeCompetition(text) ? ['LOW_SEPARATION', 'MIXED_TOP_FAMILIES'] : [])
  ]);
  const familyOrder = getStep1ProjectionFamilyOrder(analysis, 3);
  const candidateLensKeys = uniqueStep1Keys([
    analysis.classification?.familyKey ? analysis.topLensKey : '',
    ...(Array.isArray(analysis.classification?.secondaryKeys) ? analysis.classification.secondaryKeys : []),
    ...competitiveTopFamilies.map((family) => String(family?.lensKey || '').trim())
  ].filter(Boolean));
  const lowConfidence = String(analysis.confidenceBand || analysis.classification?.confidence || '').trim().toLowerCase() === 'low'
    || ambiguityFlags.includes('LOW_PRIMARY_CONFIDENCE')
    || ambiguityFlags.includes('WEAK_EVENT_PATH')
    || ambiguityFlags.includes('NO_CLEAR_FAMILY');
  const ambiguous = ambiguityFlags.includes('MIXED_TOP_FAMILIES') || ambiguityFlags.includes('NO_CLEAR_FAMILY');
  const directional = !!analysis.classification?.familyKey && !ambiguityFlags.includes('NO_CLEAR_FAMILY') && !ambiguityFlags.includes('MIXED_TOP_FAMILIES');
  const preferredLens = analysis.classification?.familyKey
    ? buildStep1LensFromProjection(analysis.classification, analysis.topLens || null)
    : null;
  return {
    helper: getStep1ScenarioTaxonomyProjection(),
    analysis,
    topFamilies: competitiveTopFamilies,
    familyOrder,
    candidateLensKeys,
    preferredLens,
    preferredFunctionKey: preferredLens?.functionKey || mapStep1FunctionKeyFromProjection(analysis.classification || analysis.topLens || {}, 'general'),
    confidenceScore: Number(analysis.confidenceScore || 0),
    confidenceBand: String(analysis.confidenceBand || '').trim().toLowerCase() || 'low',
    separationScore: Number(analysis.separationScore || 0),
    ambiguityFlags,
    directional,
    ambiguous: !directional && (ambiguous || !!analysis.classification?.familyKey),
    weak: !analysis.classification?.familyKey || lowConfidence,
    topLens: analysis.topLens || preferredLens || null,
    topLensKey: String(analysis.topLensKey || preferredLens?.key || '').trim()
  };
}

function buildStep1PromptCandidateDirections(projectionHint = null, fallbackLens = null) {
  const topFamilies = Array.isArray(projectionHint?.topFamilies) ? projectionHint.topFamilies.slice(0, 3) : [];
  const distinctLensKeys = uniqueStep1Keys(topFamilies.map((family) => String(family?.lensKey || '').trim()).filter(Boolean));
  if (topFamilies.length) {
    if (distinctLensKeys.length > 1) {
      const seenLensKeys = new Set();
      return topFamilies
        .filter((family) => {
          const lensKey = String(family?.lensKey || '').trim();
          if (!lensKey || seenLensKeys.has(lensKey)) return false;
          seenLensKeys.add(lensKey);
          return true;
        })
        .slice(0, 2)
        .map((family) => ({
          key: String(family?.lensKey || '').trim(),
          label: String(family?.lensLabel || family?.familyLabel || '').trim(),
          kind: 'lane'
        }))
        .filter((item) => item.key && item.label);
    }
    return topFamilies
      .slice(0, 2)
      .map((family) => ({
        key: String(family?.familyKey || '').trim(),
        label: String(family?.familyLabel || family?.lensLabel || '').trim(),
        kind: 'family'
      }))
      .filter((item) => item.key && item.label);
  }
  if (fallbackLens?.key && fallbackLens.key !== 'general') {
    return [{
      key: String(fallbackLens.key || '').trim(),
      label: String(fallbackLens.label || fallbackLens.key || '').trim(),
      kind: 'lane'
    }];
  }
  return [];
}

function hasStep1EscalationConsistentCompetition(projectionHint = null) {
  const helper = projectionHint?.helper;
  const topFamilies = Array.isArray(projectionHint?.topFamilies) ? projectionHint.topFamilies : [];
  const primaryFamilyKey = String(projectionHint?.analysis?.classification?.familyKey || '').trim();
  const runnerUpFamilyKey = String(topFamilies.find((family, index) => index > 0 && family?.familyKey)?.familyKey || '').trim();
  if (!helper?.familyByKey || !primaryFamilyKey || !runnerUpFamilyKey) return false;
  const primaryFamily = helper.familyByKey[primaryFamilyKey];
  const runnerUpFamily = helper.familyByKey[runnerUpFamilyKey];
  if (!primaryFamily || !runnerUpFamily) return false;
  const relatedFamilyKeys = new Set([
    ...(Array.isArray(primaryFamily.allowedSecondaryFamilies) ? primaryFamily.allowedSecondaryFamilies : []),
    ...(Array.isArray(primaryFamily.canCoExistWith) ? primaryFamily.canCoExistWith : []),
    ...(Array.isArray(primaryFamily.canEscalateTo) ? primaryFamily.canEscalateTo : [])
  ].filter(Boolean));
  return (
    relatedFamilyKeys.has(runnerUpFamilyKey)
    || String(primaryFamily.legacyKey || '').trim() && String(primaryFamily.legacyKey || '').trim() === String(runnerUpFamily.legacyKey || '').trim()
  );
}

function getStep1PromptIdeaConfidenceState({
  projectionHint = null,
  fallbackLens = null,
  hasLiveSignal = false
} = {}) {
  const hasCompetitiveFamilies = Array.isArray(projectionHint?.topFamilies)
    && projectionHint.topFamilies.some((family) => family?.qualified || family?.primary);
  if (
    projectionHint?.analysis?.classification?.familyKey
    && String(projectionHint?.confidenceBand || '').trim().toLowerCase() === 'high'
    && Number(projectionHint?.separationScore || 0) >= 2
    && hasCompetitiveFamilies
    && hasStep1EscalationConsistentCompetition(projectionHint)
  ) {
    return STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high;
  }
  if (
    projectionHint?.directional
    && projectionHint.analysis?.classification?.familyKey
    && Number(projectionHint.separationScore || 0) >= 0.75
  ) {
    return STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high;
  }
  if (hasLiveSignal && hasCompetitiveFamilies) {
    return STEP1_PROMPT_IDEA_CONFIDENCE_STATES.candidate;
  }
  if (hasLiveSignal && fallbackLens?.key && fallbackLens.key !== 'general') {
    return STEP1_PROMPT_IDEA_CONFIDENCE_STATES.candidate;
  }
  return STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low;
}

function getStep1PromptIdeaStateLabel(state = STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low, projectionHint = null) {
  if (state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high) {
    return `Likely local direction: ${String(projectionHint?.preferredLens?.label || projectionHint?.topLens?.label || 'Current strongest fit').trim()}`;
  }
  if (state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.candidate) {
    if (Array.isArray(projectionHint?.ambiguityFlags) && projectionHint.ambiguityFlags.includes('MIXED_TOP_FAMILIES')) {
      return 'Mixed scenario';
    }
    return 'Possible directions';
  }
  return 'Need one more detail';
}

function getStep1PromptIdeaHelperText(state = STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low, projectionHint = null) {
  if (state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high) {
    return 'These local prompt ideas follow the strongest current taxonomy fit.';
  }
  if (state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.candidate) {
    if (Array.isArray(projectionHint?.ambiguityFlags) && projectionHint.ambiguityFlags.includes('MIXED_TOP_FAMILIES')) {
      return 'The wording looks mixed, so the browser is showing plausible directions instead of forcing one prompt idea.';
    }
    if (Array.isArray(projectionHint?.ambiguityFlags) && projectionHint.ambiguityFlags.includes('LOW_SEPARATION')) {
      return 'Two plausible directions are close. Add what is affected or the likely trigger, or build the draft for a stronger server classification.';
    }
    return 'The wording is still soft. The browser can see possible directions, but not a strong single lane yet.';
  }
  if (Array.isArray(projectionHint?.ambiguityFlags) && projectionHint.ambiguityFlags.includes('WEAK_EVENT_PATH')) {
    return 'The wording is consequence-heavy or too broad to separate the event path yet. Add what is affected or the likely trigger, or build the draft for a stronger server classification.';
  }
  return 'The wording is still too weak or novel for a trustworthy local lane. Add what is affected, add the likely trigger, or build the draft for a stronger server classification.';
}

function buildStep1HighConfidencePromptSuggestions({
  draft = AppState.draft || {},
  sourceText = '',
  projectionHint = null,
  expectedLens = null,
  fallbackExamples = []
} = {}) {
  const helper = getStep1ScenarioTaxonomyProjection();
  if (!helper || !projectionHint?.analysis) return [];
  const topFamilyKey = String(projectionHint.familyOrder?.[0] || projectionHint.analysis?.classification?.familyKey || '').trim();
  if (!topFamilyKey) return [];
  const localSuggestions = typeof helper.buildPromptIdeaSuggestionsForFamilyKeys === 'function'
    ? helper.buildPromptIdeaSuggestionsForFamilyKeys([topFamilyKey], {
        limit: 2,
        perFamilyLimit: 2
      })
    : (typeof helper.buildPromptIdeaSuggestions === 'function'
      ? helper.buildPromptIdeaSuggestions(projectionHint.analysis, {
          limit: 2,
          perFamilyLimit: 2,
          maxFamilies: 1
        })
      : []);
  const strictHint = {
    ...projectionHint,
    familyOrder: [topFamilyKey],
    topFamilies: (Array.isArray(projectionHint.topFamilies) ? projectionHint.topFamilies : []).filter((family) => String(family?.familyKey || '').trim() === topFamilyKey)
  };
  const filteredExamples = filterStep1PromptExamplesByHint(fallbackExamples, strictHint, expectedLens);
  return normaliseStep1PromptIdeaSuggestions([
    ...localSuggestions.map((suggestion) => ({ label: suggestion.label, prompt: suggestion.prompt })),
    ...filteredExamples
  ]).slice(0, 2);
}

function buildStep1AmbiguousProjectionLens(hint = null, stored = null) {
  if (!hint) return null;
  if (stored?.key && stored.key !== 'general') {
    return {
      ...stored,
      secondaryKeys: uniqueStep1Keys([
        ...(Array.isArray(stored.secondaryKeys) ? stored.secondaryKeys : []),
        ...hint.candidateLensKeys.filter((key) => key && key !== stored.key)
      ]).slice(0, 3)
    };
  }
  const secondaryKeys = hint.candidateLensKeys.filter((key) => key && key !== 'general').slice(0, 3);
  return secondaryKeys.length
    ? {
        ...STEP1_FUNCTION_TO_SCENARIO_LENS.general,
        secondaryKeys
      }
    : null;
}

function buildStep1BoundedFallbackLens(text = '') {
  const haystack = String(text || '').toLowerCase().trim();
  if (!haystack) return null;
  const hasExplicitCyberSignal = hasStep1ExplicitCyberSignal(haystack);
  const hasRansomwareSignal = hasStep1RansomwareSignal(haystack);
  const continuityGapSignal = /(?:^|[^a-z0-9])no dr(?:$|[^a-z0-9])|without dr|dr gap|no disaster recovery|without disaster recovery|no failover|without failover|failover gap|recovery gap|rto|rpo|business continuity|disaster recovery/.test(haystack);
  const criticalMessagingServiceSignal = /(outlook(?: online)?|exchange(?: online)?|email system|mail system|mail service|messaging service|critical email|critical communication service|microsoft 365)/.test(haystack);
  const financeProcessSignal = /(payment|payable|invoice|collections|settlement|treasury|disbursement|ledger|reconciliation)/.test(haystack);
  const financeControlSignal = /(control|failure|breakdown|approval|fraud|manipulation|override|segregation|reconciliation|unauthori[sz]ed invoice)/.test(haystack);
  const counterpartySignalCount = countStep1PatternMatches(haystack, [
    /(client|customer|buyer|counterparty)/,
    /(bankrupt|bankruptcy|insolv|default|receivable|write[- ]?off|collectability|collections|cashflow|working capital|provisioning|provision)/
  ]);
  const privacySignalCount = countStep1PatternMatches(haystack, [
    /(privacy|data protection|personal data|customer records?|processing)/,
    /(retention|retained too long|lawful basis|privacy obligations?|stated privacy obligations?)/,
    /(policy|governance|control|obligation|requirement|non[- ]compliance)/
  ]);
  const explicitDisclosureSignal = /(exfiltrat|unauthori[sz]ed disclosure|data exposure|exposed records?|stolen data|leaked data|public exposure|external disclosure)/.test(haystack);
  const supplierDelaySignalCount = countStep1PatternMatches(haystack, [
    /(supplier|vendor|third[- ]party|third party|supply chain)/,
    /(miss(?:es|ed)?|delay(?:ed|ing)?|slip(?:ped|page)?|late|delivery date|delivery commitment)/,
    /(deployment|go-live|rollout|milestone|dependent business project|dependent project|programme|program|project)/
  ]);
  const procurementGovernanceSignal = /(procurement|sourcing|tender|bid|contract award|vendor selection|critical spend|award decision|single[- ]source|sole source|supplier concentration|concentrated spend|fallback|substitute)/.test(haystack);
  const workforceSignalCount = countStep1PatternMatches(haystack, [
    /(workforce|staff|staffing|understaff|resourcing|crew|operator)/,
    /(fatigue|exhaust|burnout|overwork|overstretched)/,
    /(unsafe|safety|delivery|incident|error|service quality|quality drift)/
  ]);
  const geopoliticalSignalCount = countStep1PatternMatches(haystack, [
    /(geopolitical|market access|sanctions|export control|tariff|sovereign|entity list|cross-border restriction)/,
    /(shipment|delivery|execution|supplier access|route to market|cross-border)/
  ]);
  const esgSignalCount = countStep1PatternMatches(haystack, [
    /(esg|sustainability|greenwashing|climate disclosure|sustainability disclosure)/,
    /(carbon|emission|net zero|scope 1|scope 2|scope 3|social impact|human rights|forced labor|forced labour|child labor|child labour|modern slavery)/
  ]);
  const cyberSignalCount = hasRansomwareSignal ? 3 : countStep1PatternMatches(haystack, [
    /(credential|identity|privileged|admin account|tenant admin|azure admin|account takeover|account hijack|mailbox|email compromise|business email compromise|\bbec\b|dark ?web|token theft|session hijack)/,
    /(ddos|denial of service|phish|malware|ransom|breach|compromise|unauthori[sz]ed access|security incident|security breach)/,
    /(attacker|hackers?|threat actor|extortion|decrypt(?:ion)? key|unlock files?)/
  ]);

  if (hasRansomwareSignal || cyberSignalCount >= 2) return { ...STEP1_FUNCTION_TO_SCENARIO_LENS.technology };
  if (counterpartySignalCount >= 2) return { ...STEP1_FUNCTION_TO_SCENARIO_LENS.finance };
  if ((hasStep1PaymentControlSignal(haystack) || (financeProcessSignal && financeControlSignal)) && !hasExplicitCyberSignal && !hasRansomwareSignal) {
    return { ...STEP1_FUNCTION_TO_SCENARIO_LENS.finance };
  }
  if (privacySignalCount >= 2 && !explicitDisclosureSignal) return { ...STEP1_FUNCTION_TO_SCENARIO_LENS.compliance };
  if (supplierDelaySignalCount >= 2 && !procurementGovernanceSignal && !hasExplicitCyberSignal) {
    return {
      key: 'supply-chain',
      label: 'Supply chain / dependency',
      functionKey: 'operations',
      estimatePresetKey: 'supplyChain',
      secondaryKeys: ['operational']
    };
  }
  if (procurementGovernanceSignal && !hasExplicitCyberSignal && supplierDelaySignalCount >= 1) {
    return { ...STEP1_FUNCTION_TO_SCENARIO_LENS.procurement };
  }
  if (continuityGapSignal && criticalMessagingServiceSignal && !hasExplicitCyberSignal) {
    return {
      key: 'business-continuity',
      label: 'Business continuity',
      functionKey: 'operations',
      estimatePresetKey: 'businessContinuity',
      secondaryKeys: ['operational']
    };
  }
  if (workforceSignalCount >= 2) {
    return {
      key: 'people-workforce',
      label: 'People / workforce',
      functionKey: 'hse',
      estimatePresetKey: 'hse',
      secondaryKeys: ['operational']
    };
  }
  if (geopoliticalSignalCount >= 2) {
    return {
      key: 'geopolitical',
      label: 'Geopolitical / market access',
      functionKey: 'strategic',
      estimatePresetKey: 'geopolitical',
      secondaryKeys: ['regulatory', 'supply-chain']
    };
  }
  if (esgSignalCount >= 2) {
    return {
      key: 'esg',
      label: 'ESG',
      functionKey: 'strategic',
      estimatePresetKey: 'esg',
      secondaryKeys: ['compliance']
    };
  }
  return null;
}

function filterStep1PromptExamplesByHint(examples = [], hint = null, expectedLens = null) {
  const helper = getStep1ScenarioTaxonomyProjection();
  const candidateFamilies = new Set(Array.isArray(hint?.familyOrder) ? hint.familyOrder : []);
  const candidateLenses = new Set(Array.isArray(hint?.candidateLensKeys) ? hint.candidateLensKeys : []);
  return (Array.isArray(examples) ? examples : []).filter((example) => {
    const exampleText = [example?.promptLabel, example?.event].filter(Boolean).join('. ');
    const exampleHint = buildStep1ProjectionHintModel(exampleText, expectedLens || '');
    if (exampleHint?.analysis?.classification?.familyKey) {
      if (candidateFamilies.size) return exampleHint.familyOrder.some((familyKey) => candidateFamilies.has(familyKey));
      if (candidateLenses.size && candidateLenses.has(exampleHint.topLensKey)) return true;
      return !!expectedLens?.key && helper?.areLensesCompatible(expectedLens.key, exampleHint.topLensKey);
    }
    if (hint) return false;
    if (!expectedLens?.key) return !hint;
    return String(example?.functionKey || '').trim() === String(expectedLens.functionKey || '').trim();
  }).map((example) => ({
    label: example.promptLabel,
    prompt: example.event
  }));
}

const STEP1_REGULATION_CATEGORY_RULES = [
  {
    label: 'Trade, Sanctions, and Market Access',
    test: (tag) => /bis|ofac|sanction|export control|entity list|market[- ]access/i.test(tag)
  },
  {
    label: 'Privacy, Cyber, and Data Controls',
    test: (tag) => /pdpl|gdpr|cyber|nist|iso ?27|pci|data protection|privacy|iec 62443/i.test(tag)
  },
  {
    label: 'Business Continuity, Resilience, and Supply Chain',
    test: (tag) => /2230|nfpa 1600|28000|27036|continuity|resilience|recovery|crisis/i.test(tag)
  },
  {
    label: 'Sustainability and ESG',
    test: (tag) => /ifrs s|gri|csrd|esrs|sasb|tnfd|sustainable finance|esg|tcfd|ghg|cdp|14064|csddd/i.test(tag)
  },
  {
    label: 'HSE and Site Operations',
    test: (tag) => /45001|14001|45003|ehsms|fire and life safety|ilo-osh|psm|api rp|ccps|sa8000|safety|environment/i.test(tag)
  },
  {
    label: 'Financial Integrity and Conduct',
    test: (tag) => /aml|37001|anti-brib|internal control|bcbs|basel/i.test(tag)
  },
  {
    label: 'AI and Model Governance',
    test: (tag) => /42001|23894|ai act|ai rmf|sr 11-7|model risk/i.test(tag)
  },
  {
    label: 'Enterprise Governance and Risk',
    test: (tag) => /31000|31010|coso|37301/i.test(tag)
  }
];

function uniqueStep1Regulations(list = []) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildStep1AutoSuggestedRegulations({
  draft = AppState.draft || {},
  bu = null,
  selectedRisks = getSelectedRisks(),
  riskCandidates = getRiskCandidates(),
  scenarioGeographies = getScenarioGeographies()
} = {}) {
  const lensKey = String(draft?.scenarioLens?.key || getStep1PreferredScenarioLens(getEffectiveSettings(), draft)?.key || '').trim();
  const riskSource = Array.isArray(selectedRisks) && selectedRisks.length ? selectedRisks : (Array.isArray(riskCandidates) ? riskCandidates : []);
  return uniqueStep1Regulations([
    ...(bu?.regulatoryTags || []),
    ...deriveGeographyRegulations(scenarioGeographies),
    ...(STEP1_LENS_REGULATION_SUGGESTIONS[lensKey] || []),
    ...riskSource.flatMap((risk) => Array.isArray(risk?.regulations) ? risk.regulations : [])
  ]);
}

function ensureStep1RegulationSelectionState(draft = AppState.draft || {}, autoSuggested = []) {
  if (!draft.regulationSelectionState || typeof draft.regulationSelectionState !== 'object') {
    draft.regulationSelectionState = {};
  }
  const state = draft.regulationSelectionState;
  if (!state.initialised) {
    const currentSelected = uniqueStep1Regulations(draft.applicableRegulations || []);
    const autoSet = new Set(autoSuggested.map((tag) => tag.toLowerCase()));
    const currentSet = new Set(currentSelected.map((tag) => tag.toLowerCase()));
    state.manualSelected = currentSelected.filter((tag) => !autoSet.has(tag.toLowerCase()));
    state.manualDeselected = autoSuggested.filter((tag) => !currentSet.has(tag.toLowerCase()));
    state.initialised = true;
    return state;
  }
  state.manualSelected = uniqueStep1Regulations(state.manualSelected || []);
  state.manualDeselected = uniqueStep1Regulations(state.manualDeselected || [])
    .filter((tag) => !(state.manualSelected || []).some((selected) => selected.toLowerCase() === tag.toLowerCase()));
  return state;
}

function buildStep1ApplicableRegulationModel({
  draft = AppState.draft || {},
  bu = null,
  selectedRisks = getSelectedRisks(),
  riskCandidates = getRiskCandidates(),
  scenarioGeographies = getScenarioGeographies(),
  settings = getEffectiveSettings()
} = {}) {
  const autoSuggested = buildStep1AutoSuggestedRegulations({ draft, bu, selectedRisks, riskCandidates, scenarioGeographies });
  const state = ensureStep1RegulationSelectionState(draft, autoSuggested);
  const manualSelected = uniqueStep1Regulations(state.manualSelected || []);
  const manualDeselected = uniqueStep1Regulations(state.manualDeselected || []);
  const manualDeselectedSet = new Set(manualDeselected.map((tag) => tag.toLowerCase()));
  const selected = uniqueStep1Regulations([
    ...autoSuggested.filter((tag) => !manualDeselectedSet.has(tag.toLowerCase())),
    ...manualSelected
  ]);
  const available = uniqueStep1Regulations([
    ...selected,
    ...autoSuggested,
    ...(settings?.applicableRegulations || []),
    ...(bu?.regulatoryTags || [])
  ]);
  const grouped = STEP1_REGULATION_CATEGORY_RULES
    .map((rule) => ({
      label: rule.label,
      tags: available.filter((tag) => rule.test(tag))
    }))
    .filter((group) => group.tags.length);
  const groupedKeys = new Set(grouped.flatMap((group) => group.tags.map((tag) => tag.toLowerCase())));
  const uncategorised = available.filter((tag) => !groupedKeys.has(tag.toLowerCase()));
  if (uncategorised.length) {
    grouped.push({
      label: 'Other Relevant References',
      tags: uncategorised
    });
  }
  return {
    autoSuggested,
    selected,
    groups: grouped
  };
}

function updateStep1ApplicableRegulations(buList = getBUList(), scenarioGeographies = getScenarioGeographies()) {
  const model = buildStep1ApplicableRegulationModel({
    draft: AppState.draft,
    bu: (Array.isArray(buList) ? buList : []).find((item) => item.id === AppState.draft.buId) || null,
    selectedRisks: getSelectedRisks(),
    riskCandidates: getRiskCandidates(),
    scenarioGeographies,
    settings: getEffectiveSettings()
  });
  AppState.draft.applicableRegulations = model.selected;
  return model;
}

function resetStep1RegulationSelectionState({ resetSpotlight = true } = {}) {
  delete AppState.draft.regulationSelectionState;
  AppState.draft.applicableRegulations = [];
  if (resetSpotlight) AppState.draft.step1RegulationSpotlighted = false;
}

function renderStep1ApplicableRegulationSelector(regulationModel) {
  const model = regulationModel && typeof regulationModel === 'object'
    ? regulationModel
    : buildStep1ApplicableRegulationModel();
  const selectedSet = new Set((model.selected || []).map((tag) => String(tag || '').toLowerCase()));
  const autoSet = new Set((model.autoSuggested || []).map((tag) => String(tag || '').toLowerCase()));
  return `<div class="step1-regulation-panel">
    <div class="step1-regulation-panel__status">
      <span class="badge badge--primary">${model.autoSuggested?.length ? 'Auto-selected from current scenario' : 'Select what applies'}</span>
      <span class="badge badge--neutral">${model.selected?.length || 0} selected</span>
    </div>
    <p class="context-panel-copy" style="margin-top:var(--sp-3)">The regulations most relevant to the current draft are already selected. Click any item to keep, remove, or add it before continuing.</p>
    <div class="step1-regulation-groups">
      ${(model.groups || []).map((group) => `<div class="step1-regulation-group">
        <div class="step1-regulation-group__title">
          <span>${escapeHtml(group.label)}</span>
          <span class="badge badge--neutral">${group.tags.length}</span>
        </div>
        <div class="citation-chips">
          ${group.tags.map((tag) => {
            const lowered = String(tag || '').toLowerCase();
            const isSelected = selectedSet.has(lowered);
            const isSuggested = autoSet.has(lowered);
            return `<button type="button" class="chip step1-regulation-chip ${isSelected ? 'step1-regulation-chip--selected' : ''} ${isSuggested ? 'step1-regulation-chip--suggested' : ''}" data-regulation-tag="${escapeHtml(tag)}" aria-pressed="${isSelected ? 'true' : 'false'}">${escapeHtml(tag)}</button>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>
    <div class="context-panel-foot">This selection is carried forward into AI assistance, evidence retrieval, and the later review steps.</div>
  </div>`;
}

function toggleStep1ApplicableRegulation(regulationTag, { buList = getBUList(), scenarioGeographies = getScenarioGeographies() } = {}) {
  const tag = String(regulationTag || '').trim();
  if (!tag) return;
  const bu = (Array.isArray(buList) ? buList : []).find((item) => item.id === AppState.draft.buId) || null;
  const model = buildStep1ApplicableRegulationModel({
    draft: AppState.draft,
    bu,
    selectedRisks: getSelectedRisks(),
    riskCandidates: getRiskCandidates(),
    scenarioGeographies,
    settings: getEffectiveSettings()
  });
  const state = ensureStep1RegulationSelectionState(AppState.draft, model.autoSuggested);
  const lowered = tag.toLowerCase();
  const autoSet = new Set((model.autoSuggested || []).map((item) => String(item || '').toLowerCase()));
  const selectedSet = new Set((model.selected || []).map((item) => String(item || '').toLowerCase()));
  const isAuto = autoSet.has(lowered);
  const isSelected = selectedSet.has(lowered);

  if (isSelected) {
    if (isAuto) {
      state.manualDeselected = uniqueStep1Regulations([...(state.manualDeselected || []), tag]);
    } else {
      state.manualSelected = uniqueStep1Regulations((state.manualSelected || []).filter((item) => String(item || '').toLowerCase() !== lowered));
    }
  } else if (isAuto) {
    state.manualDeselected = uniqueStep1Regulations((state.manualDeselected || []).filter((item) => String(item || '').toLowerCase() !== lowered));
  } else {
    state.manualSelected = uniqueStep1Regulations([...(state.manualSelected || []), tag]);
  }

  AppState.draft.regulationSelectionState = {
    ...state,
    initialised: true
  };
  updateStep1ApplicableRegulations(buList, scenarioGeographies);
  markDraftDirty();
  persistAndRenderStep1({ buList, scenarioGeographies, preserveScroll: true });
}

function createStep1DryRunScenario(input = {}) {
  return {
    id: String(input.id || '').trim(),
    functionKey: String(input.functionKey || 'general').trim(),
    lensKey: String(input.lensKey || '').trim(),
    lensLabel: String(input.lensLabel || '').trim(),
    title: String(input.title || 'Worked example').trim(),
    summary: String(input.summary || '').trim(),
    bestFor: String(input.bestFor || '').trim(),
    nextStep: String(input.nextStep || '').trim(),
    promptLabel: String(input.promptLabel || input.title || 'Load example').trim(),
    event: String(input.event || '').trim(),
    asset: String(input.asset || '').trim(),
    cause: String(input.cause || '').trim(),
    impact: String(input.impact || '').trim(),
    urgency: String(input.urgency || 'medium').trim(),
    geographies: Array.isArray(input.geographies) ? input.geographies : [],
    risks: Array.isArray(input.risks) ? input.risks : []
  };
}

function inferStep1FunctionKeyFromText(text = '') {
  const projectionHint = buildStep1ProjectionHintModel(text);
  if (projectionHint?.directional) return projectionHint.preferredFunctionKey;
  if (projectionHint && !projectionHint.weak) return 'general';
  const fallbackLens = buildStep1BoundedFallbackLens(text);
  if (fallbackLens?.functionKey) return fallbackLens.functionKey;
  return 'general';
}

function inferStep1FunctionKey(settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  const profile = normaliseUserProfile(settings?.userProfile, AuthService.getCurrentUser());
  const guidedInput = getStep1CurrentGuidedInput(draft);
  const isGuidedPath = String(draft?.step1Path || '').trim() === 'guided';
  const directGuidedSignals = [
    guidedInput.event,
    guidedInput.asset,
    guidedInput.cause,
    guidedInput.impact
  ].filter(Boolean).join(' ');
  if (isGuidedPath) {
    const directGuidedMatch = inferStep1FunctionKeyFromText(directGuidedSignals);
    if (directGuidedMatch !== 'general') return directGuidedMatch;
  }
  const scenarioSignals = isGuidedPath
    ? [
        directGuidedSignals,
        draft?.__step1NarrativeOverride
      ].filter(Boolean).join(' ')
    : [
        draft?.__step1NarrativeOverride,
        draft?.narrative,
        draft?.sourceNarrative,
        draft?.enhancedNarrative,
        directGuidedSignals
      ].filter(Boolean).join(' ');
  const scenarioMatch = inferStep1FunctionKeyFromText(scenarioSignals);
  if (scenarioMatch !== 'general') return scenarioMatch;
  const profileHaystack = [
    profile.jobTitle,
    profile.department,
    profile.businessUnit,
    profile.workingContext,
    ...(Array.isArray(profile.focusAreas) ? profile.focusAreas : []),
    draft?.buName,
    draft?.contextNotes
  ].filter(Boolean).join(' ');
  const combinedHaystack = [scenarioSignals, profileHaystack].filter(Boolean).join(' ');
  return inferStep1FunctionKeyFromText(combinedHaystack);
}

function buildStep1ExplicitNarrativeLens(narrativeText = '') {
  const projectionHint = buildStep1ProjectionHintModel(narrativeText);
  if (projectionHint?.directional && projectionHint.preferredLens?.key) return projectionHint.preferredLens;
  if (projectionHint && !projectionHint.weak) return null;
  return buildStep1BoundedFallbackLens(narrativeText);
}

function getStep1ManualPreferredScenarioLens(settings = getEffectiveSettings(), draft = AppState.draft || {}, narrativeOverride = '') {
  const narrativeText = String(narrativeOverride || '').trim();
  const stored = draft?.scenarioLens?.key ? { ...draft.scenarioLens } : null;
  const projectionHint = buildStep1ProjectionHintModel(narrativeText, stored || '');
  if (projectionHint?.directional && projectionHint.preferredLens?.key) {
    return mergeStep1LensWithStored(projectionHint.preferredLens, stored);
  }
  const ambiguousLens = buildStep1AmbiguousProjectionLens(projectionHint, stored);
  if (ambiguousLens?.key) {
    return ambiguousLens;
  }
  const fallbackLens = getStep1PreferredScenarioLens(settings, draft, narrativeText);
  const explicitLens = buildStep1ExplicitNarrativeLens(narrativeText);
  if (!explicitLens) return fallbackLens;
  if (!stored || !stored.key || stored.key === 'general' || stored.key === explicitLens.key) {
    return explicitLens;
  }
  return {
    ...explicitLens,
    secondaryKeys: Array.from(new Set([
      ...(Array.isArray(explicitLens.secondaryKeys) ? explicitLens.secondaryKeys : []),
      stored.key
    ])).filter(Boolean)
  };
}

function getStep1PreferredScenarioLens(settings = getEffectiveSettings(), draft = AppState.draft || {}, narrativeOverride = '') {
  const stored = draft?.scenarioLens?.key ? { ...draft.scenarioLens } : null;
  const guidedInput = getStep1CurrentGuidedInput(draft);
  const scenarioText = String([
    narrativeOverride,
    draft?.narrative,
    draft?.sourceNarrative,
    draft?.enhancedNarrative,
    guidedInput.event,
    guidedInput.asset,
    guidedInput.cause,
    guidedInput.impact
  ].filter(Boolean).join(' ')).trim();
  const projectionHint = scenarioText ? buildStep1ProjectionHintModel(scenarioText, stored || '') : null;
  if (projectionHint?.directional && projectionHint.preferredLens?.key) {
    return mergeStep1LensWithStored(projectionHint.preferredLens, stored);
  }
  const inferred = {
    ...(STEP1_FUNCTION_TO_SCENARIO_LENS[inferStep1FunctionKey(settings, {
      ...draft,
      __step1NarrativeOverride: narrativeOverride
    })] || STEP1_FUNCTION_TO_SCENARIO_LENS.general)
  };
  const hasScenarioContext = !!String(
    narrativeOverride
    || draft?.narrative
    || draft?.sourceNarrative
    || draft?.enhancedNarrative
    || guidedInput.event
    || guidedInput.asset
    || guidedInput.cause
    || guidedInput.impact
    || ''
  ).trim();
  const ambiguousProjectionLens = buildStep1AmbiguousProjectionLens(projectionHint, stored);
  if (ambiguousProjectionLens?.key) return ambiguousProjectionLens;
  const fallbackLens = ((!projectionHint || projectionHint.weak) && scenarioText) ? buildStep1BoundedFallbackLens(scenarioText) : null;
  const preferredInferred = fallbackLens || inferred;
  if (!stored) return preferredInferred;
  if (!hasScenarioContext) return stored;
  if (!stored.key || stored.key === 'general') return preferredInferred.key && preferredInferred.key !== 'general' ? preferredInferred : stored;
  if (preferredInferred.key && preferredInferred.key !== 'general' && preferredInferred.key !== stored.key) {
    return {
      ...preferredInferred,
      secondaryKeys: uniqueStep1Keys([
        ...(Array.isArray(preferredInferred.secondaryKeys) ? preferredInferred.secondaryKeys : []),
        ...(Array.isArray(stored.secondaryKeys) ? stored.secondaryKeys : []),
        stored.key
      ]).filter(Boolean)
    };
  }
  return stored;
}

function composeStep1GuidedNarrative(guidedInput = (AppState.draft?.guidedInput || {}), settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  const lens = getStep1PreferredScenarioLens(settings, draft);
  return composeGuidedNarrative(guidedInput, {
    lensKey: lens?.key || '',
    lensLabel: lens?.label || ''
  });
}

function buildStep1GuidedPromptIdeaModel(draft = AppState.draft || {}, exampleModel = null) {
  const sourceText = getStep1GuidedPromptIdeaSourceText(draft);
  const expectedLens = draft?.scenarioLens || getStep1PreferredScenarioLens(getEffectiveSettings(), draft, sourceText);
  const fallbackExamples = (exampleModel && Array.isArray(exampleModel.recommendedExamples))
    ? exampleModel.recommendedExamples
    : getStep1ExampleExperienceModel(getEffectiveSettings(), draft).recommendedExamples || [];
  const projectionHint = sourceText.trim()
    ? buildStep1ProjectionHintModel(sourceText, expectedLens || '')
    : null;
  const boundedFallbackLens = (projectionHint || !sourceText.trim())
    ? null
    : buildStep1BoundedFallbackLens(sourceText);
  const hasLiveSignal = normaliseAssessmentTokens(sourceText).length >= 2;
  const state = getStep1PromptIdeaConfidenceState({
    projectionHint,
    fallbackLens: boundedFallbackLens,
    hasLiveSignal
  });
  const promptSuggestions = state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high
    ? buildStep1HighConfidencePromptSuggestions({
        draft,
        sourceText,
        projectionHint,
        expectedLens,
        fallbackExamples
      })
    : [];
  const candidateDirections = state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.candidate
    ? buildStep1PromptCandidateDirections(projectionHint, boundedFallbackLens)
    : [];
  return {
    state,
    stateLabel: getStep1PromptIdeaStateLabel(state, projectionHint),
    helperText: getStep1PromptIdeaHelperText(state, projectionHint),
    promptSuggestions,
    candidateDirections,
    refinementHints: state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low
      ? STEP1_PROMPT_REFINEMENT_HINTS.slice()
      : [],
    preferredLens: expectedLens,
    projectionHint,
    sourceText,
    hasLiveSignal
  };
}

function buildStep1GuidedPromptSuggestions(draft = AppState.draft || {}, exampleModel = null) {
  return buildStep1GuidedPromptIdeaModel(draft, exampleModel).promptSuggestions;
}

function renderStep1GuidedPromptIdeaChips(promptSuggestions = []) {
  return (Array.isArray(promptSuggestions) ? promptSuggestions : [])
    .slice(0, 2)
    .map(prompt => `<button class="citation-chip guided-prompt-chip" data-prompt="${escapeHtml(prompt.prompt)}">${escapeHtml(prompt.label)}</button>`)
    .join('');
}

function normaliseStep1PromptIdeaConfidence(value = '') {
  const safeValue = String(value || '').trim().toLowerCase();
  return safeValue === 'low' || safeValue === 'medium' || safeValue === 'high'
    ? safeValue
    : '';
}

function normaliseStep1PromptIdeaRecommendedLens(lens = null, fallback = null) {
  if (!lens) return fallback || null;
  if (typeof lens === 'string') {
    return buildStep1LensFromProjection({ key: lens, lensKey: lens }, fallback || null);
  }
  const lensKey = String(lens?.key || lens?.lensKey || '').trim();
  if (!lensKey) return fallback || null;
  const projectedLens = buildStep1LensFromProjection({
    ...lens,
    key: lensKey,
    lensKey: lensKey
  }, fallback || null);
  return {
    ...(projectedLens || fallback || {}),
    ...(lens && typeof lens === 'object' ? lens : {}),
    key: lensKey,
    label: String(lens?.label || projectedLens?.label || fallback?.label || lensKey).trim() || lensKey,
    functionKey: String(lens?.functionKey || projectedLens?.functionKey || fallback?.functionKey || 'general').trim() || 'general',
    estimatePresetKey: String(lens?.estimatePresetKey || projectedLens?.estimatePresetKey || fallback?.estimatePresetKey || 'general').trim() || 'general',
    secondaryKeys: Array.from(new Set([
      ...(Array.isArray(projectedLens?.secondaryKeys) ? projectedLens.secondaryKeys : []),
      ...(Array.isArray(lens?.secondaryKeys) ? lens.secondaryKeys : [])
    ])).filter(Boolean)
  };
}

function buildStep1PromptIdeaConfidenceBadge(confidence = '') {
  const safeConfidence = normaliseStep1PromptIdeaConfidence(confidence);
  if (!safeConfidence) return '';
  return `<span class="badge badge--neutral">Confidence: ${escapeHtml(safeConfidence)}</span>`;
}

function buildStep1PromptIdeaSourceCopy(source = '') {
  const safeSource = String(source || '').trim().toLowerCase();
  if (safeSource === 'ai') return 'AI checked the current wording, suggested prompt ideas, and proposed the strongest lens fit.';
  if (safeSource === 'fallback') return 'AI prompt ideas are unavailable right now, so this panel is showing the local fallback lens check instead.';
  return 'Ask AI to suggest stronger prompt ideas and check the likely lens before you build the scenario.';
}

function renderStep1GuidedPromptIdeaPanel(promptIdeaModel = null) {
  const model = promptIdeaModel && typeof promptIdeaModel === 'object'
    ? promptIdeaModel
    : {
        state: STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low,
        stateLabel: 'Need one more detail',
        helperText: getStep1PromptIdeaHelperText(STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low),
        promptSuggestions: [],
        candidateDirections: [],
        refinementHints: STEP1_PROMPT_REFINEMENT_HINTS.slice()
      };
  const state = String(model.state || STEP1_PROMPT_IDEA_CONFIDENCE_STATES.low).trim();
  const promptSuggestions = normaliseStep1PromptIdeaSuggestions(model.promptSuggestions || []);
  const candidateDirections = Array.isArray(model.candidateDirections) ? model.candidateDirections : [];
  const refinementHints = Array.isArray(model.refinementHints) ? model.refinementHints : [];
  const explicitAiFlow = model.explicitAiFlow === true;
  const isLoading = model.loading === true;
  const source = String(model.source || '').trim().toLowerCase();
  const sourceCopy = buildStep1PromptIdeaSourceCopy(source);
  const recommendedLens = normaliseStep1PromptIdeaRecommendedLens(
    model.recommendedLens,
    model.preferredLens && model.source === 'fallback' ? model.preferredLens : null
  );
  const confidence = normaliseStep1PromptIdeaConfidence(model.confidence);
  const rationale = String(model.why || '').trim();
  const followUpQuestion = String(model.followUpQuestion || '').trim();
  const needsMoreDetail = model.needsMoreDetail === true;
  const hasAssistResult = explicitAiFlow && (
    !!source
    || !!recommendedLens?.key
    || !!confidence
    || !!rationale
    || !!followUpQuestion
    || promptSuggestions.length > 0
  );
  const chipMarkup = state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high
    ? renderStep1GuidedPromptIdeaChips(promptSuggestions)
    : state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.candidate
      ? candidateDirections
        .slice(0, 2)
        .map((candidate) => `<span class="badge badge--neutral">${escapeHtml(String(candidate?.label || '').trim())}</span>`)
        .join('')
      : refinementHints
        .slice(0, 3)
        .map((hint) => `<span class="badge badge--neutral">${escapeHtml(String(hint || '').trim())}</span>`)
        .join('');
  if (explicitAiFlow) {
    const displayedChipMarkup = source === 'fallback'
      ? chipMarkup
      : renderStep1GuidedPromptIdeaChips(promptSuggestions);
    const stepActionLabel = hasAssistResult ? 'Regenerate prompt ideas' : 'Generate prompt ideas';
    const lensMarkup = recommendedLens?.label
      ? `<span class="badge badge--neutral">AI lens check: ${escapeHtml(String(recommendedLens.label || '').trim())}</span>`
      : '';
    return `<div class="step1-ai-sequence">
      <div class="step1-ai-sequence__label">Step 1 of 2</div>
      <div class="step1-ai-sequence__title">Generate prompt ideas and check the lens</div>
      <div class="form-help" id="guided-prompt-ideas-status">${escapeHtml(sourceCopy)}</div>
      ${isLoading ? `<div class="step1-ai-thinking" role="status" aria-live="polite">
        <span class="step1-ai-thinking__spinner" aria-hidden="true"></span>
        <div class="step1-ai-thinking__copy">
          <strong>Thinking</strong>
          <span>Checking the event path and generating prompt ideas with AI…</span>
        </div>
      </div>` : ''}
      ${hasAssistResult ? `<div class="step1-ai-result-stack">
        ${(lensMarkup || confidence) ? `<div class="step1-ai-meta">
          ${lensMarkup}
          ${buildStep1PromptIdeaConfidenceBadge(confidence)}
          ${source === 'fallback' ? '<span class="badge badge--neutral">Fallback</span>' : ''}
        </div>` : ''}
        ${rationale ? `<div class="form-help">${escapeHtml(rationale)}</div>` : ''}
        ${followUpQuestion ? `<div class="step1-ai-follow-up">
          <strong>Clarifying question</strong>
          <span>${escapeHtml(followUpQuestion)}</span>
        </div>` : ''}
        ${displayedChipMarkup ? `<div class="citation-chips" id="guided-prompt-ideas">
          ${displayedChipMarkup}
        </div>` : ''}
      </div>` : ''}
      <div class="step1-ai-actions">
        <button class="btn btn--secondary" id="btn-generate-guided-prompt-ideas" type="button">${escapeHtml(stepActionLabel)}</button>
        <span class="form-help">${escapeHtml(
          needsMoreDetail
            ? 'Add one more detail if you want tighter ideas, or skip this step and build the scenario directly.'
            : 'You can use one of these ideas or ignore them and keep your own wording.'
        )}</span>
      </div>
    </div>`;
  }
  return `<div class="form-help" id="guided-prompt-ideas-status">${escapeHtml(String(model.stateLabel || 'Prompt ideas'))} ${escapeHtml(String(model.helperText || '').trim())}</div>
    <div class="citation-chips" id="guided-prompt-ideas">
      ${chipMarkup}
    </div>`;
}

const STEP1_LIVE_PROMPT_IDEA_DEBOUNCE_MS = 900;
const STEP1_LIVE_PROMPT_IDEA_MIN_TOKENS = 3;
const STEP1_LIVE_PROMPT_IDEA_CACHE_LIMIT = 24;
const STEP1_LIVE_PREVIEW_DEBOUNCE_MS = 1100;
const STEP1_LIVE_PREVIEW_MIN_TOKENS = 4;
const STEP1_LIVE_PREVIEW_CACHE_LIMIT = 24;

function createEmptyStep1LivePromptIdeaState() {
  return {
    signature: '',
    suggestions: [],
    loadingSignature: '',
    source: '',
    recommendedLens: null,
    confidence: '',
    why: '',
    followUpQuestion: '',
    needsMoreDetail: false
  };
}

function createEmptyStep1LivePreviewState() {
  return {
    signature: '',
    preview: '',
    status: '',
    source: '',
    loadingSignature: ''
  };
}

let _step1LivePromptIdeaDebounce = null;
let _step1LivePromptIdeaRequestId = 0;
let _step1LivePromptIdeaState = createEmptyStep1LivePromptIdeaState();
const _step1LivePromptIdeaCache = new Map();
let _step1LivePreviewDebounce = null;
let _step1LivePreviewRequestId = 0;
let _step1LivePreviewState = createEmptyStep1LivePreviewState();
const _step1LivePreviewCache = new Map();

function resetStep1LiveAssistState({ clearCaches = false } = {}) {
  window.clearTimeout(_step1LivePreviewDebounce);
  _step1LivePreviewDebounce = null;
  _step1LivePreviewRequestId += 1;
  _step1LivePreviewState = createEmptyStep1LivePreviewState();

  window.clearTimeout(_step1LivePromptIdeaDebounce);
  _step1LivePromptIdeaDebounce = null;
  _step1LivePromptIdeaRequestId += 1;
  _step1LivePromptIdeaState = createEmptyStep1LivePromptIdeaState();

  if (clearCaches) {
    _step1LivePreviewCache.clear();
    _step1LivePromptIdeaCache.clear();
  }
}

function normaliseStep1PromptIdeaSuggestions(suggestions = []) {
  const seen = new Set();
  return (Array.isArray(suggestions) ? suggestions : [])
    .map((suggestion) => ({
      label: String(suggestion?.label || '').trim(),
      prompt: String(suggestion?.prompt || '').trim()
    }))
    .filter((suggestion) => suggestion.label && suggestion.prompt)
    .filter((suggestion) => {
      const key = `${suggestion.label.toLowerCase()}::${suggestion.prompt.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function getStep1LivePreviewStatusCopy(source = '') {
  const safeSource = String(source || '').trim().toLowerCase();
  if (safeSource === 'ai') return 'AI-checked preview using the current function context, geography, regulations, and retrieved references.';
  if (safeSource === 'fallback') return 'Deterministic server fallback preview kept close to your wording because the live AI rewrite drifted too far from the event you described.';
  if (safeSource === 'manual') return 'AI draft generation is unavailable right now. Continue manually or try again.';
  return '';
}

function readStep1GuidedInputValueFromDom(id) {
  if (!document || typeof document.getElementById !== 'function') return null;
  const field = document.getElementById(id);
  if (!field || !Object.prototype.hasOwnProperty.call(field, 'value')) return null;
  return String(field.value || '');
}

function getStep1CurrentGuidedInput(draft = AppState.draft || {}) {
  const guidedInput = draft?.guidedInput || {};
  const readValue = (id, fallback = '') => {
    const domValue = readStep1GuidedInputValueFromDom(id);
    return domValue === null ? String(fallback || '') : domValue;
  };
  return {
    ...guidedInput,
    event: readValue('guided-event', guidedInput.event),
    asset: readValue('guided-asset', guidedInput.asset),
    cause: readValue('guided-cause', guidedInput.cause),
    impact: readValue('guided-impact', guidedInput.impact),
    urgency: readValue('guided-urgency', guidedInput.urgency || 'medium') || 'medium'
  };
}

function syncStep1GuidedInputStateFromDom(draft = AppState.draft || {}) {
  if (!draft || typeof draft !== 'object') {
    return {
      changed: false,
      guidedInput: getStep1CurrentGuidedInput(draft)
    };
  }
  const previousGuidedInput = draft?.guidedInput || {};
  const nextGuidedInput = getStep1CurrentGuidedInput(draft);
  const changed = ['event', 'asset', 'cause', 'impact', 'urgency'].some((key) => String(previousGuidedInput[key] || '') !== String(nextGuidedInput[key] || ''));
  if (changed) {
    draft.guidedInput = {
      ...previousGuidedInput,
      ...nextGuidedInput
    };
    const composed = composeStep1GuidedNarrative(draft.guidedInput, getEffectiveSettings(), draft);
    clearStep1StaleAssistState(composed);
    draft.scenarioLens = getStep1PreferredScenarioLens(getEffectiveSettings(), draft, composed);
  }
  return {
    changed,
    guidedInput: nextGuidedInput
  };
}

function getStep1GuidedPreviewText(draft = AppState.draft || {}) {
  return composeStep1GuidedNarrative(getStep1CurrentGuidedInput(draft), getEffectiveSettings(), draft);
}

function getStep1GuidedPreviewSignature(draft = AppState.draft || {}) {
  const guidedInput = getStep1CurrentGuidedInput(draft);
  return [
    String(draft?.step1Path || '').trim(),
    String(draft?.buId || '').trim(),
    String(draft?.scenarioLens?.key || draft?.scenarioLens || '').trim(),
    String(guidedInput.event || '').trim(),
    String(guidedInput.impact || '').trim(),
    String(guidedInput.cause || '').trim(),
    String(guidedInput.asset || '').trim(),
    String(guidedInput.urgency || '').trim()
  ].join('||');
}

function shouldUseStep1LivePreview(draft = AppState.draft || {}) {
  if (!STEP1_USE_GUIDED_SERVER_HELPERS) return false;
  if (String(draft?.step1Path || '').trim() !== 'guided') return false;
  if (String(draft?.guidedDraftSource || '').trim()) return false;
  if (!window.Step1Assist || typeof window.Step1Assist.previewGuidedScenarioDraft !== 'function') return false;
  return normaliseAssessmentTokens(getStep1GuidedPreviewText(draft)).length >= STEP1_LIVE_PREVIEW_MIN_TOKENS;
}

function rememberStep1LivePreview(signature, preview = '', status = '', source = 'ai') {
  const safeSignature = String(signature || '').trim();
  const safePreview = String(preview || '').trim();
  if (!safeSignature || !safePreview) return;
  const safeStatus = String(status || '').trim();
  const safeSource = String(source || '').trim() || 'ai';
  _step1LivePreviewState = {
    signature: safeSignature,
    preview: safePreview,
    status: safeStatus,
    source: safeSource,
    loadingSignature: ''
  };
  _step1LivePreviewCache.delete(safeSignature);
  _step1LivePreviewCache.set(safeSignature, {
    preview: safePreview,
    status: safeStatus,
    source: safeSource
  });
  while (_step1LivePreviewCache.size > STEP1_LIVE_PREVIEW_CACHE_LIMIT) {
    const oldestKey = _step1LivePreviewCache.keys().next().value;
    _step1LivePreviewCache.delete(oldestKey);
  }
}

function getStep1DisplayedGuidedPreviewModel(draft = AppState.draft || {}) {
  const builtPreview = String(draft?.guidedDraftPreview || '').trim();
  const builtStatus = String(draft?.guidedDraftStatus || '').trim();
  const builtSource = String(draft?.guidedDraftSource || '').trim();
  if (builtPreview) {
    return {
      preview: builtPreview,
      status: builtStatus,
      source: builtSource
    };
  }
  const signature = getStep1GuidedPreviewSignature(draft);
  if (signature && _step1LivePreviewState.signature === signature && _step1LivePreviewState.preview) {
    return {
      preview: _step1LivePreviewState.preview,
      status: _step1LivePreviewState.status,
      source: _step1LivePreviewState.source
    };
  }
  const cached = signature ? _step1LivePreviewCache.get(signature) : null;
  if (cached?.preview) {
    return {
      preview: cached.preview,
      status: cached.status || '',
      source: cached.source || ''
    };
  }
  return {
    preview: getStep1GuidedPreviewText(draft),
    status: '',
    source: ''
  };
}

async function refreshStep1LivePreview({ force = false } = {}) {
  const draft = AppState.draft || {};
  const signature = getStep1GuidedPreviewSignature(draft);
  if (!shouldUseStep1LivePreview(draft) || !signature) {
    _step1LivePreviewState = {
      ..._step1LivePreviewState,
      loadingSignature: ''
    };
    return;
  }
  if (!force && _step1LivePreviewState.signature === signature && _step1LivePreviewState.preview) return;
  if (!force && _step1LivePreviewState.loadingSignature === signature) return;
  const cached = !force ? _step1LivePreviewCache.get(signature) : null;
  if (cached?.preview) {
    rememberStep1LivePreview(signature, cached.preview, cached.status || '', cached.source || 'ai');
    updateStep1GuidedPreview();
    return;
  }
  const localPreview = getStep1GuidedPreviewText(draft);
  const settings = getEffectiveSettings();
  const preferredLens = getStep1PreferredScenarioLens(settings, draft, localPreview);
  const requestId = ++_step1LivePreviewRequestId;
  _step1LivePreviewState = {
    ..._step1LivePreviewState,
    loadingSignature: signature
  };
  const result = await window.Step1Assist?.previewGuidedScenarioDraft?.({
    buId: draft?.buId,
    riskStatement: localPreview,
    guidedInput: { ...(draft?.guidedInput || {}) },
    scenarioLensHint: preferredLens
  });
  if (requestId !== _step1LivePreviewRequestId) return;
  if (getStep1GuidedPreviewSignature(AppState.draft || {}) !== signature) return;
  _step1LivePreviewState = {
    ..._step1LivePreviewState,
    loadingSignature: ''
  };
  if (!result || result.aiUnavailable) return;
  const preview = String(result.preview || '').trim();
  if (!preview) return;
  rememberStep1LivePreview(signature, preview, getStep1LivePreviewStatusCopy(result.source || 'ai'), result.source || 'ai');
  updateStep1GuidedPreview();
}

function scheduleStep1LivePreviewRefresh({ immediate = false, force = false } = {}) {
  window.clearTimeout(_step1LivePreviewDebounce);
  if (immediate) {
    refreshStep1LivePreview({ force });
    return;
  }
  _step1LivePreviewDebounce = window.setTimeout(() => {
    refreshStep1LivePreview({ force });
  }, STEP1_LIVE_PREVIEW_DEBOUNCE_MS);
}

function getStep1GuidedPromptIdeaSourceText(draft = AppState.draft || {}) {
  const guidedInput = getStep1CurrentGuidedInput(draft);
  const isGuidedPath = String(draft?.step1Path || '').trim() === 'guided';
  const sourceText = isGuidedPath
    ? [
        guidedInput.event,
        guidedInput.impact,
        guidedInput.cause,
        guidedInput.asset,
        guidedInput.urgency
      ]
    : [
        guidedInput.event,
        guidedInput.impact,
        guidedInput.cause,
        guidedInput.asset,
        guidedInput.urgency,
        draft?.narrative,
        draft?.enhancedNarrative,
        draft?.sourceNarrative
      ];
  return sourceText.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function getStep1GuidedPromptIdeaSignature(draft = AppState.draft || {}) {
  const guidedInput = getStep1CurrentGuidedInput(draft);
  return [
    String(draft?.step1Path || '').trim(),
    String(draft?.buId || '').trim(),
    String(draft?.scenarioLens?.key || draft?.scenarioLens || '').trim(),
    String(guidedInput.event || '').trim(),
    String(guidedInput.impact || '').trim(),
    String(guidedInput.cause || '').trim(),
    String(guidedInput.asset || '').trim(),
    String(guidedInput.urgency || '').trim()
  ].join('||');
}

function shouldUseStep1LivePromptIdeas(draft = AppState.draft || {}) {
  if (!STEP1_USE_GUIDED_SERVER_HELPERS) return false;
  if (String(draft?.step1Path || '').trim() !== 'guided') return false;
  if (!window.Step1Assist || typeof window.Step1Assist.suggestGuidedPromptIdeas !== 'function') return false;
  return normaliseAssessmentTokens(getStep1GuidedPromptIdeaSourceText(draft)).length >= STEP1_LIVE_PROMPT_IDEA_MIN_TOKENS;
}

function rememberStep1LivePromptIdeaSuggestions(signature, suggestions = [], source = 'ai') {
  const safeSignature = String(signature || '').trim();
  const fallbackLens = getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft || {}, getStep1GuidedPromptIdeaSourceText(AppState.draft || {}));
  const rawResult = Array.isArray(suggestions)
    ? { ideas: suggestions, source }
    : { ...(suggestions && typeof suggestions === 'object' ? suggestions : {}), source: String(suggestions?.source || source || '').trim() };
  const safeSuggestions = normaliseStep1PromptIdeaSuggestions(rawResult.ideas || rawResult.suggestions || []);
  const safeSource = String(rawResult.source || source || '').trim() || 'ai';
  const recommendedLens = normaliseStep1PromptIdeaRecommendedLens(rawResult.recommendedLens, fallbackLens);
  const confidence = normaliseStep1PromptIdeaConfidence(rawResult.confidence);
  const why = String(rawResult.why || '').trim();
  const followUpQuestion = String(rawResult.followUpQuestion || '').trim();
  const needsMoreDetail = rawResult.needsMoreDetail === true;
  if (!safeSignature || (!safeSuggestions.length && !safeSource && !recommendedLens?.key && !why && !followUpQuestion && !needsMoreDetail)) return;
  _step1LivePromptIdeaState = {
    signature: safeSignature,
    suggestions: safeSuggestions,
    loadingSignature: '',
    source: safeSource,
    recommendedLens,
    confidence,
    why,
    followUpQuestion,
    needsMoreDetail
  };
  _step1LivePromptIdeaCache.delete(safeSignature);
  _step1LivePromptIdeaCache.set(safeSignature, {
    suggestions: safeSuggestions,
    source: safeSource,
    recommendedLens,
    confidence,
    why,
    followUpQuestion,
    needsMoreDetail
  });
  while (_step1LivePromptIdeaCache.size > STEP1_LIVE_PROMPT_IDEA_CACHE_LIMIT) {
    const oldestKey = _step1LivePromptIdeaCache.keys().next().value;
    _step1LivePromptIdeaCache.delete(oldestKey);
  }
}

function getStep1DisplayedPromptIdeaModel(draft = AppState.draft || {}, exampleModel = null) {
  const localModel = buildStep1GuidedPromptIdeaModel(draft, exampleModel);
  const signature = getStep1GuidedPromptIdeaSignature(draft);
  const isLoading = !!signature && _step1LivePromptIdeaState.loadingSignature === signature;
  if (signature && _step1LivePromptIdeaState.signature === signature && (
    _step1LivePromptIdeaState.suggestions.length
    || _step1LivePromptIdeaState.source
    || _step1LivePromptIdeaState.recommendedLens?.key
    || _step1LivePromptIdeaState.followUpQuestion
  )) {
    return {
      ...localModel,
      promptSuggestions: _step1LivePromptIdeaState.source === 'fallback' && !_step1LivePromptIdeaState.suggestions.length
        ? localModel.promptSuggestions
        : _step1LivePromptIdeaState.suggestions,
      source: _step1LivePromptIdeaState.source || 'ai',
      recommendedLens: _step1LivePromptIdeaState.recommendedLens || null,
      confidence: _step1LivePromptIdeaState.confidence || '',
      why: _step1LivePromptIdeaState.why || '',
      followUpQuestion: _step1LivePromptIdeaState.followUpQuestion || '',
      needsMoreDetail: _step1LivePromptIdeaState.needsMoreDetail === true,
      loading: isLoading,
      explicitAiFlow: true
    };
  }
  const cached = signature ? _step1LivePromptIdeaCache.get(signature) : null;
  if (cached && (
    cached.suggestions?.length
    || cached.source
    || cached.recommendedLens?.key
    || cached.followUpQuestion
  )) {
    return {
      ...localModel,
      promptSuggestions: cached.source === 'fallback' && !(cached.suggestions || []).length
        ? localModel.promptSuggestions
        : (cached.suggestions || []),
      source: cached.source || 'ai',
      recommendedLens: cached.recommendedLens || null,
      confidence: cached.confidence || '',
      why: cached.why || '',
      followUpQuestion: cached.followUpQuestion || '',
      needsMoreDetail: cached.needsMoreDetail === true,
      loading: isLoading,
      explicitAiFlow: true
    };
  }
  return {
    ...localModel,
    loading: isLoading,
    explicitAiFlow: true
  };
}

function getStep1DisplayedPromptSuggestions(draft = AppState.draft || {}, exampleModel = null) {
  return getStep1DisplayedPromptIdeaModel(draft, exampleModel).promptSuggestions;
}

async function refreshStep1LivePromptIdeaSuggestions({ force = false } = {}) {
  const draft = AppState.draft || {};
  const signature = getStep1GuidedPromptIdeaSignature(draft);
  if (!shouldUseStep1LivePromptIdeas(draft) || !signature) {
    _step1LivePromptIdeaState = {
      ..._step1LivePromptIdeaState,
      loadingSignature: ''
    };
    return;
  }
  if (!force && _step1LivePromptIdeaState.signature === signature && _step1LivePromptIdeaState.suggestions.length) return;
  if (!force && _step1LivePromptIdeaState.loadingSignature === signature) return;
  const cached = !force ? _step1LivePromptIdeaCache.get(signature) : null;
  if (cached && (
    cached.suggestions?.length
    || cached.source
    || cached.recommendedLens?.key
    || cached.followUpQuestion
  )) {
    rememberStep1LivePromptIdeaSuggestions(signature, cached, cached.source || 'ai');
    updateStep1GuidedPreview();
    return;
  }

  const localSuggestions = buildStep1GuidedPromptSuggestions(draft);
  const sourceText = getStep1GuidedPromptIdeaSourceText(draft);
  const settings = getEffectiveSettings();
  const preferredLens = getStep1PreferredScenarioLens(settings, draft, sourceText);
  const requestId = ++_step1LivePromptIdeaRequestId;
  _step1LivePromptIdeaState = {
    ..._step1LivePromptIdeaState,
    loadingSignature: signature
  };

  const result = await window.Step1Assist?.suggestGuidedPromptIdeas?.({
    buId: draft?.buId,
    riskStatement: sourceText,
    guidedInput: { ...(draft?.guidedInput || {}) },
    scenarioLensHint: preferredLens,
    fallbackSuggestions: localSuggestions
  });

  if (requestId !== _step1LivePromptIdeaRequestId) return;
  if (getStep1GuidedPromptIdeaSignature(AppState.draft || {}) !== signature) return;

  _step1LivePromptIdeaState = {
    ..._step1LivePromptIdeaState,
    loadingSignature: ''
  };
  if (!result || result.usedFallback) return;
  const suggestions = normaliseStep1PromptIdeaSuggestions(result.ideas);
  if (!suggestions.length && !result.recommendedLens && !result.followUpQuestion) return;
  rememberStep1LivePromptIdeaSuggestions(signature, result, 'ai');
  updateStep1GuidedPreview();
}

function scheduleStep1LivePromptIdeaRefresh({ immediate = false, force = false } = {}) {
  window.clearTimeout(_step1LivePromptIdeaDebounce);
  if (immediate) {
    refreshStep1LivePromptIdeaSuggestions({ force });
    return;
  }
  _step1LivePromptIdeaDebounce = window.setTimeout(() => {
    refreshStep1LivePromptIdeaSuggestions({ force });
  }, STEP1_LIVE_PROMPT_IDEA_DEBOUNCE_MS);
}

function scheduleStep1GuidedLiveHelperRefresh({ immediate = false, force = false } = {}) {
  scheduleStep1LivePreviewRefresh({ immediate, force });
}

function getStep1ActiveGuidedPromptIdeaLensHint(draft = AppState.draft || {}) {
  const promptIdeaModel = getStep1DisplayedPromptIdeaModel(draft);
  return promptIdeaModel?.recommendedLens?.key
    ? promptIdeaModel.recommendedLens
    : getStep1PreferredScenarioLens(getEffectiveSettings(), draft, getStep1GuidedPromptIdeaSourceText(draft));
}

function getStep1AiTuningSettings() {
  return typeof getAiFeedbackTuningSettings === 'function'
    ? getAiFeedbackTuningSettings()
    : {
        alignmentPriority: 'strict',
        draftStyle: 'executive-brief',
        shortlistDiscipline: 'strict',
        learningSensitivity: 'balanced'
      };
}

function getStep1LearnedExampleSummary(pattern = {}) {
  const parts = [
    pattern.geography ? `Completed in ${pattern.geography}` : '',
    pattern.posture === 'above-tolerance'
      ? 'previously finished above tolerance'
      : pattern.posture === 'near-tolerance'
        ? 'previously finished near tolerance'
        : 'previously finished within tolerance'
  ].filter(Boolean);
  return parts.join(' and ') || 'Learnt from a previous completed assessment.';
}

function buildStep1LearnedDryRunExamples(functionKey, buId, limit = 3) {
  const patterns = (() => {
    try {
      if (typeof getRelevantScenarioPatterns === 'function') {
        return getRelevantScenarioPatterns(buId, limit * 2);
      }
    } catch {}
    return [];
  })();
  return patterns
    .filter(pattern => {
      if (!String(pattern?.title || pattern?.scenarioType || pattern?.narrative || '').trim()) return false;
      if (functionKey === 'general') return true;
      if (String(pattern?.functionKey || '').trim().toLowerCase() === functionKey) return true;
      const haystack = [
        pattern?.functionKey,
        pattern?.title,
        pattern?.scenarioType,
        pattern?.narrative,
        ...(Array.isArray(pattern?.selectedRiskTitles) ? pattern.selectedRiskTitles : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(functionKey.replace('-', ' ')) || inferStep1FunctionKey({
        userProfile: {
          department: haystack,
          workingContext: haystack,
          focusAreas: []
        }
      }) === functionKey;
    })
    .slice(0, limit)
    .map((pattern, index) => createStep1DryRunScenario({
      id: `learned-${pattern.id || index}`,
      functionKey,
      title: String(pattern.title || pattern.scenarioType || 'Recent completed scenario').trim(),
      summary: getStep1LearnedExampleSummary(pattern),
      bestFor: pattern.confidenceLabel ? `${pattern.confidenceLabel} precedent` : 'Recent precedent',
      nextStep: pattern.keyRecommendation
        ? `Use this when you want a similar starting point. Most recent recommendation: ${pattern.keyRecommendation}`
        : 'Use this when you want to start from a recent pattern already seen in this workspace.',
      promptLabel: 'Recent pattern',
      event: String(pattern.guidedInput?.event || pattern.narrative || pattern.title || pattern.scenarioType || '').trim(),
      asset: String(pattern.guidedInput?.asset || '').trim(),
      cause: String(pattern.guidedInput?.cause || '').trim(),
      impact: String(pattern.guidedInput?.impact || pattern.topGap || '').trim(),
      urgency: pattern.posture === 'above-tolerance' ? 'high' : pattern.posture === 'near-tolerance' ? 'medium' : 'low',
      geographies: pattern.geography ? [String(pattern.geography).trim()] : [],
      risks: (Array.isArray(pattern.selectedRiskTitles) ? pattern.selectedRiskTitles : []).slice(0, 3).map(title => ({
        title,
        category: 'Learned',
        source: 'learned-pattern',
        description: 'Recovered from a recent completed assessment to provide a faster starting point.'
      }))
    }));
}

function getStep1ExampleExperienceModel(settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  const functionKey = inferStep1FunctionKey(settings, draft);
  const preferredGeneralOrder = [
    'procurement-single-source-shortfall',
    'compliance-monitoring-breach',
    'finance-payments-control-breakdown',
    'strategic-market-entry-delay',
    'ai-model-governance-failure',
    'hse-contractor-safety-incident'
  ];
  const orderExamples = (examples = []) => {
    if (functionKey !== 'general') return examples;
    // Keep the broad default starter path stable for anonymous or unspecialised users without collapsing back to legacy cyber-only examples.
    const preferred = preferredGeneralOrder
      .map((id) => examples.find((example) => example.id === id))
      .filter(Boolean);
    const rest = examples.filter((example) => !preferredGeneralOrder.includes(example.id));
    return [...preferred, ...rest];
  };
  const recommendedPool = functionKey === 'general'
    ? orderExamples(STEP1_DRY_RUN_SCENARIOS)
    : orderExamples(STEP1_DRY_RUN_SCENARIOS.filter(example => example.functionKey === functionKey));
  const recommended = recommendedPool.slice(0, 4);
  const fallback = functionKey === 'general'
    ? STEP1_DRY_RUN_SCENARIOS.filter(example => !preferredGeneralOrder.includes(example.id)).slice(0, 4)
    : orderExamples(STEP1_DRY_RUN_SCENARIOS).slice(0, 2);
  const learned = buildStep1LearnedDryRunExamples(functionKey, draft?.buId, 3);
  const seenIds = new Set();
  const availableExamples = [...recommended, ...learned, ...fallback, ...STEP1_DRY_RUN_SCENARIOS].filter(example => {
    if (!example?.id || seenIds.has(example.id)) return false;
    seenIds.add(example.id);
    return true;
  });
  return {
    functionKey,
    functionLabel: STEP1_DRY_RUN_FUNCTION_LABELS[functionKey] || STEP1_DRY_RUN_FUNCTION_LABELS.general,
    recommendedExamples: recommended.length ? recommended : availableExamples.slice(0, 4),
    learnedExamples: learned,
    availableExamples
  };
}

function renderStep1FeaturedExampleCard(example, recommendedExamples = [], learnedExamples = [], functionLabel = 'your function') {
  if (!example) return '';
  const disclosureKey = getDisclosureStateKey('/wizard/1', 'worked example');
  return `<details class="wizard-disclosure wizard-disclosure--support anim-fade-in" data-disclosure-state-key="${escapeHtml(disclosureKey)}" ${getDisclosureOpenState(disclosureKey, false) ? 'open' : ''}>
    <summary>Worked examples <span class="badge badge--neutral">${escapeHtml(functionLabel)} starter set</span></summary>
    <div class="wizard-disclosure-body">
      <div class="wizard-summary-band wizard-summary-band--quiet" style="margin-top:0">
        <div>
          <div class="wizard-summary-band__label">Featured example</div>
          <strong>${escapeHtml(example.title)}</strong>
          <div class="wizard-summary-band__copy">${escapeHtml(example.summary)} Best for: ${escapeHtml(example.bestFor)}.</div>
        </div>
        <div class="wizard-summary-band__meta">
          <button class="btn btn--secondary btn-load-dry-run" data-dry-run-id="${escapeHtml(example.id)}" type="button">Load Example</button>
        </div>
      </div>
      <div class="form-help" style="margin-top:var(--sp-4)">${escapeHtml(example.nextStep)}</div>
      ${recommendedExamples.length ? `<div class="risk-selection-grid" style="margin-top:var(--sp-4)">
        <div class="form-help" style="grid-column:1 / -1">Recommended for ${escapeHtml(functionLabel.toLowerCase())}. Choose any of these if you want the starter scenario to reflect the function you work in.</div>
        ${recommendedExamples.map(item => `<div class="risk-pick-card">
          <div class="risk-pick-head" style="align-items:flex-start">
            <div style="flex:1">
              <div class="risk-pick-title">${escapeHtml(item.title)}</div>
              <div class="form-help" style="margin-top:6px">${escapeHtml(item.summary)}</div>
            </div>
            <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(item.id)}" type="button">Load</button>
          </div>
          <div class="citation-chips" style="margin-top:var(--sp-3)">
            <span class="badge badge--neutral">${escapeHtml(item.promptLabel)}</span>
            <span class="badge badge--neutral">${escapeHtml(item.bestFor)}</span>
          </div>
        </div>`).join('')}
      </div>` : ''}
      ${learnedExamples.length ? `<div class="card card--background" style="margin-top:var(--sp-4);padding:var(--sp-4)">
        <div class="context-panel-title">Learnt from recent completed assessments</div>
        <div class="form-help" style="margin-top:6px">Recent scenarios now feed this picker so the preloaded examples stay closer to the work your team actually runs.</div>
        <div class="risk-selection-grid" style="margin-top:var(--sp-4)">
          ${learnedExamples.map(item => `<div class="risk-pick-card">
            <div class="risk-pick-head" style="align-items:flex-start">
              <div style="flex:1">
                <div class="risk-pick-title">${escapeHtml(item.title)}</div>
                <div class="form-help" style="margin-top:6px">${escapeHtml(item.summary)}</div>
              </div>
              <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(item.id)}" type="button">Load</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </details>`;
}

function renderStep1AiAlignmentCard(alignment = {}) {
  const model = alignment && typeof alignment === 'object' ? alignment : {};
  const checks = Array.isArray(model.checks) ? model.checks.filter(Boolean).slice(0, 4) : [];
  if (!model.label && !checks.length) return '';
  const needsReview = checks.some(check => check?.status !== 'ok');
  // These checks need their own structured layout; generic summary-band styles made
  // the label/detail pairs collapse into a dense paragraph-like block.
  return `<div class="wizard-summary-band wizard-summary-band--support premium-guidance-strip premium-guidance-strip--${needsReview ? 'warning' : 'support'} mt-4 wizard-ai-alignment-card">
    <div class="wizard-ai-alignment-card__intro">
      <div class="wizard-summary-band__label">AI coherence check</div>
      <strong>${escapeHtml(String(model.label || 'Working draft'))}</strong>
      <div class="wizard-summary-band__copy">${escapeHtml(String(model.summary || 'The platform checked whether the draft, lens, structure, and shortlist still agree.'))}</div>
    </div>
    <div class="wizard-summary-band__meta wizard-ai-alignment-card__meta">
      ${checks.map(check => `<div class="wizard-ai-alignment-card__check wizard-ai-alignment-card__check--${check.status === 'ok' ? 'ok' : 'review'}">
        <span class="wizard-ai-alignment-card__check-label">${escapeHtml(String(check.label || 'Check'))}</span>
        <p class="wizard-ai-alignment-card__check-detail">${escapeHtml(String(check.detail || ''))}</p>
      </div>`).join('')}
    </div>
  </div>`;
}

function getStep1ScenarioWordSet(value = '') {
  return new Set(
    normaliseScenarioSeedText(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map(token => token.trim())
      .filter(token => token.length >= 4)
  );
}

function getStep1ScenarioOverlap(a = '', b = '') {
  const left = getStep1ScenarioWordSet(a);
  const right = getStep1ScenarioWordSet(b);
  if (!left.size || !right.size) return 1;
  let common = 0;
  left.forEach(token => {
    if (right.has(token)) common += 1;
  });
  return common / Math.max(left.size, right.size, 1);
}

function isStep1AiDraftMateriallyReshaped(draft = {}) {
  const baseline = normaliseScenarioSeedText(draft.aiNarrativeBaseline || draft.guidedDraftPreview || '');
  const current = normaliseScenarioSeedText(draft.narrative || draft.enhancedNarrative || draft.guidedDraftPreview || '');
  if (!baseline || !current || baseline === current) return false;
  const overlap = getStep1ScenarioOverlap(baseline, current);
  const baselineSize = getStep1ScenarioWordSet(baseline).size;
  const currentSize = getStep1ScenarioWordSet(current).size;
  const lengthDrift = Math.abs(baselineSize - currentSize) / Math.max(baselineSize, currentSize, 1);
  return overlap < 0.68 || lengthDrift > 0.34;
}

function buildStep1AiQualityModel(draft = {}) {
  const tuning = getStep1AiTuningSettings();
  const citations = Array.isArray(draft.citations) ? draft.citations.filter(Boolean) : [];
  const primaryGrounding = Array.isArray(draft.primaryGrounding) ? draft.primaryGrounding.filter(Boolean) : [];
  const supportingReferences = Array.isArray(draft.supportingReferences) ? draft.supportingReferences.filter(Boolean) : [];
  const evidenceCount = new Set([
    ...citations.map(item => item?.docId || item?.title || item?.sourceTitle || JSON.stringify(item)),
    ...primaryGrounding.map(item => item?.docId || item?.title || item?.sourceTitle || item?.label || JSON.stringify(item)),
    ...supportingReferences.map(item => item?.docId || item?.title || item?.sourceTitle || item?.label || JSON.stringify(item))
  ].filter(Boolean)).size;
  const source = String(draft.aiQualityState || draft.guidedDraftSource || (draft.llmAssisted ? 'ai' : 'local')).trim() || 'local';
  const validationMode = String(draft.aiValidationMode || '').trim() || 'local_checks';
  const confidence = String(draft.confidenceLabel || '').trim() || 'Moderate confidence';
  const evidenceQuality = String(draft.evidenceQuality || '').trim() || 'Evidence quality not yet stated';
  const alignmentChecks = Array.isArray(draft.aiAlignment?.checks) ? draft.aiAlignment.checks.filter(Boolean) : [];
  const needsReview = alignmentChecks.some(check => check?.status !== 'ok');
  const secondaryLensLabels = (Array.isArray(draft.scenarioLens?.secondaryKeys) ? draft.scenarioLens.secondaryKeys : [])
    .map(key => {
      const alias = typeof STEP1_FUNCTION_TO_SCENARIO_LENS === 'object'
        ? Object.values(STEP1_FUNCTION_TO_SCENARIO_LENS).find(item => item?.key === key)
        : null;
      return alias?.label || String(key || '').replace(/[-_]+/g, ' ');
    })
    .filter(Boolean)
    .slice(0, 2);
  const analystReshaped = source === 'analyst-reshaped'
    || (source !== 'local' && isStep1AiDraftMateriallyReshaped(draft));

  let tone = 'support';
  let title = 'Lightly grounded';
  let copy = 'AI has shaped the draft, but it still needs judgement and challenge before you treat it as a finished scenario.';
  if (analystReshaped) {
    tone = 'warning';
    title = 'Materially analyst-reshaped';
    copy = 'The current wording has moved materially away from the earlier AI draft, so treat this as an analyst-led scenario with AI support in the background.';
  } else if (source === 'fallback') {
    tone = 'warning';
    title = 'Fallback-generated';
    copy = 'The platform kept a tighter fallback draft because the live AI rewrite did not stay close enough to the event and impact you described.';
  } else if (source === 'local') {
    tone = 'quiet';
    title = 'Locally structured';
    copy = 'This draft is currently shaped from your inputs and saved context. Run the AI build when you want a stronger structured rewrite and refreshed shortlist.';
  } else if (validationMode === 'live_quality_gate' && !needsReview) {
    tone = 'success';
    title = 'Live-AI validated';
    copy = tuning.alignmentPriority === 'strict'
      ? 'The draft and shortlist passed a second live AI logic and framing check before they were shown, with strict event-path alignment active.'
      : 'The draft and shortlist passed a second live AI logic and framing check before they were shown.';
  } else if (!needsReview && (/high/i.test(confidence) || /strong/i.test(evidenceQuality)) && evidenceCount >= 2) {
    tone = 'success';
    title = 'Strongly grounded';
    copy = 'The draft, lens, and shortlist are currently aligned with the saved evidence base and inherited context.';
  } else if (needsReview) {
    tone = 'warning';
    title = 'Needs review';
    copy = 'The platform found at least one mismatch between the draft, lens, structure, or shortlist, so this scenario still needs challenge before you continue.';
  }

  return {
    tone,
    title,
    copy,
    facts: [
      { label: 'Draft source', value: source === 'ai' ? 'Live AI rewrite' : source === 'fallback' ? 'Fallback guidance' : source === 'analyst-reshaped' ? 'Analyst reshaped' : 'Local composition' },
      { label: 'Validation', value: validationMode === 'live_quality_gate' ? 'Live AI quality gate' : validationMode === 'local_fallback' ? 'Local fallback checks' : 'Local logic checks' },
      { label: 'Evidence', value: `${evidenceCount} support item${evidenceCount === 1 ? '' : 's'}` },
      { label: 'Lens fit', value: `${draft.aiAlignment?.label || (needsReview ? 'Review suggested' : 'Working alignment')}${secondaryLensLabels.length ? ` · also ${secondaryLensLabels.join(' / ')}` : ''}` }
    ]
  };
}

function renderStep1AiQualityStrip(draft = {}) {
  const model = buildStep1AiQualityModel(draft);
  const facts = Array.isArray(model.facts) ? model.facts.slice(0, 4) : [];
  return `<div class="premium-guidance-strip premium-guidance-strip--${escapeHtml(String(model.tone || 'support'))} wizard-ai-quality-strip">
    <div class="premium-guidance-strip__main">
      <div class="premium-guidance-strip__label">AI quality signal</div>
      <strong>${escapeHtml(String(model.title || 'Working guidance'))}</strong>
      <div class="premium-guidance-strip__copy">${escapeHtml(String(model.copy || 'The platform is showing how strongly the current scenario is grounded before you carry it into the next step.'))}</div>
      ${facts.length ? `<details class="results-detail-disclosure wizard-ai-quality-disclosure">
        <summary>View evidence and validation posture</summary>
        <div class="results-detail-disclosure-copy">Open this when you want to understand how the current draft was validated and how much support sits behind it.</div>
        <div class="premium-guidance-strip__meta wizard-ai-quality-strip__meta">
          ${facts.map(fact => `<div class="premium-guidance-strip__fact"><span>${escapeHtml(String(fact.label || 'Signal'))}</span><strong>${escapeHtml(String(fact.value || '—'))}</strong></div>`).join('')}
        </div>
      </details>` : ''}
    </div>
  </div>`;
}

function renderStep1AiIntakeSummary(draft = {}) {
  if (!String(draft.intakeSummary || '').trim()) return '';
  const model = buildStep1AiQualityModel(draft);
  const secondaryLenses = (Array.isArray(draft.scenarioLens?.secondaryKeys) ? draft.scenarioLens.secondaryKeys : [])
    .map(key => String(key || '').replace(/[-_]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2);
  return `<div class="premium-guidance-strip premium-guidance-strip--${escapeHtml(String(model.tone === 'quiet' ? 'support' : model.tone || 'support'))} wizard-intake-summary">
    <div class="premium-guidance-strip__main">
      <div class="premium-guidance-strip__label">AI intake summary</div>
      <strong>${escapeHtml(String(draft.intakeSummary || 'Suggested summary'))}</strong>
      ${draft.linkAnalysis ? `<div class="premium-guidance-strip__copy">${escapeHtml(String(draft.linkAnalysis))}</div>` : ''}
    </div>
    <div class="premium-guidance-strip__meta">
      <span class="badge badge--neutral">${escapeHtml(String(model.title || 'Working guidance'))}</span>
      ${draft.scenarioLens?.label ? `<span class="badge badge--gold">${escapeHtml(String(draft.scenarioLens.label))}</span>` : ''}
      ${secondaryLenses.map(label => `<span class="badge badge--neutral">Also ${escapeHtml(label)}</span>`).join('')}
      ${draft.evidenceQuality ? `<span class="badge badge--neutral">${escapeHtml(String(draft.evidenceQuality))}</span>` : ''}
    </div>
  </div>`;
}

const STEP1_AI_FEEDBACK_REASON_OPTIONS = Object.freeze({
  draft: [
    { key: 'wrong-domain', label: 'Wrong domain' },
    { key: 'too-generic', label: 'Too generic' },
    { key: 'weak-citations', label: 'Weak citations' },
    { key: 'useful-with-edits', label: 'Useful with edits' }
  ],
  shortlist: [
    { key: 'wrong-domain', label: 'Wrong domain' },
    { key: 'too-generic', label: 'Too generic' },
    { key: 'missed-key-risk', label: 'Missed key risk' },
    { key: 'included-unrelated-risks', label: 'Unrelated risks' },
    { key: 'weak-citations', label: 'Weak citations' },
    { key: 'useful-with-edits', label: 'Useful with edits' }
  ]
});

const STEP1_RISK_REMOVAL_REASON_OPTIONS = Object.freeze([
  {
    key: 'incorrect-risk',
    label: 'Incorrect risk',
    description: 'This risk does not belong in the current scenario and should count as AI correction.',
    aiFeedbackReason: 'included-unrelated-risks',
    tuningSignal: true
  },
  {
    key: 'narrower-scope',
    label: 'Correct, but narrowing scope',
    description: 'This risk could matter, but I want a tighter scenario discussion right now.',
    aiFeedbackReason: '',
    tuningSignal: false
  },
  {
    key: 'partially-relevant',
    label: 'Only partially relevant',
    description: 'This risk overlaps with the scenario, but it is not central enough to keep in scope.',
    aiFeedbackReason: '',
    tuningSignal: false
  }
]);

function normaliseStep1AiFeedbackReason(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normaliseStep1RiskRemovalReason(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getStep1RiskRemovalReasonOption(reason = '') {
  const safeReason = normaliseStep1RiskRemovalReason(reason);
  return STEP1_RISK_REMOVAL_REASON_OPTIONS.find((option) => option.key === safeReason) || null;
}

function shouldRecordStep1RiskRemovalAsAiFeedback(reason = '') {
  return !!getStep1RiskRemovalReasonOption(reason)?.tuningSignal;
}

function getStep1AiRuntimeMode(draft = AppState.draft) {
  const source = String(draft?.aiQualityState || draft?.guidedDraftSource || (draft?.llmAssisted ? 'ai' : 'local')).trim().toLowerCase();
  if (source === 'ai') return 'live_ai';
  if (source === 'fallback') return 'fallback';
  return 'local';
}

function getStep1AiFeedbackTargetState(target = 'draft', draft = AppState.draft) {
  const feedback = draft?.aiFeedback && typeof draft.aiFeedback === 'object' ? draft.aiFeedback : {};
  return feedback[target] && typeof feedback[target] === 'object' ? feedback[target] : null;
}

function isStep1GeneratedRiskFeedbackEligible(risk) {
  const source = String(risk?.source || '').trim().toLowerCase();
  return !!String(risk?.id || '').trim() && !['manual', 'dry-run'].includes(source);
}

function getStep1AiRiskFeedbackState(riskId = '', draft = AppState.draft) {
  const feedback = draft?.aiFeedback && typeof draft.aiFeedback === 'object' ? draft.aiFeedback : {};
  const riskMap = feedback.risks && typeof feedback.risks === 'object' ? feedback.risks : {};
  const key = String(riskId || '').trim();
  return key && riskMap[key] && typeof riskMap[key] === 'object' ? riskMap[key] : null;
}

function buildStep1AiFeedbackScenarioFingerprint(draft = AppState.draft) {
  return [
    String(draft?.buId || '').trim(),
    String(draft?.scenarioLens?.key || '').trim(),
    String(draft?.guidedInput?.event || '').trim(),
    String(draft?.guidedInput?.cause || '').trim(),
    String(draft?.guidedInput?.impact || '').trim(),
    String(draft?.enhancedNarrative || draft?.narrative || draft?.sourceNarrative || '').trim()
  ].filter(Boolean).join(' | ').slice(0, 260);
}

function buildStep1DraftFeedbackOutputFingerprint(draft = AppState.draft) {
  return String(draft?.guidedDraftPreview || draft?.enhancedNarrative || draft?.narrative || draft?.sourceNarrative || '').trim().slice(0, 260);
}

function buildStep1ShortlistFeedbackOutputFingerprint(riskCandidates = [], selectedRisks = []) {
  const shown = (Array.isArray(riskCandidates) ? riskCandidates : []).map(risk => String(risk?.title || '').trim()).filter(Boolean).slice(0, 10);
  const kept = (Array.isArray(selectedRisks) ? selectedRisks : []).map(risk => String(risk?.title || '').trim()).filter(Boolean).slice(0, 10);
  return [`shown:${shown.join(', ')}`, `kept:${kept.join(', ')}`].join(' | ').slice(0, 260);
}

function buildStep1RiskFeedbackOutputFingerprint(risk = {}) {
  return [
    String(risk?.title || '').trim(),
    String(risk?.category || '').trim(),
    String(risk?.description || '').trim()
  ].filter(Boolean).join(' | ').slice(0, 260);
}

function getStep1AiFeedbackReasons(target = 'draft') {
  return STEP1_AI_FEEDBACK_REASON_OPTIONS[target] || STEP1_AI_FEEDBACK_REASON_OPTIONS.draft;
}

function buildStep1AiFeedbackModel(target = 'draft', draft = AppState.draft, riskCandidates = [], selectedRisks = []) {
  const saved = getStep1AiFeedbackTargetState(target, draft);
  const source = String(draft?.aiQualityState || draft?.guidedDraftSource || (draft?.llmAssisted ? 'ai' : 'local')).trim().toLowerCase();
  const visible = target === 'draft'
    ? !!String(draft?.guidedDraftPreview || draft?.enhancedNarrative || draft?.narrative || '').trim() && source !== 'local'
    : (Array.isArray(riskCandidates) ? riskCandidates : []).some(risk => !['manual', 'dry-run'].includes(String(risk?.source || '').trim().toLowerCase()));
  if (!visible) return { visible: false };
  return {
    visible: true,
    target,
    title: target === 'draft' ? 'Rate the AI scenario draft' : 'Rate the AI risk shortlist',
    description: target === 'draft'
      ? 'Score how well the generated draft matches the event path you are trying to assess.'
      : 'Score how well the generated shortlist stays in scope for this scenario.',
    score: Number(saved?.score || 3),
    reasons: Array.isArray(saved?.reasons) ? saved.reasons.map(normaliseStep1AiFeedbackReason).filter(Boolean) : [],
    savedAt: Number(saved?.savedAt || 0),
    runtimeMode: String(saved?.runtimeMode || getStep1AiRuntimeMode(draft)).trim(),
    reasonOptions: getStep1AiFeedbackReasons(target)
  };
}

function renderStep1AiFeedbackCard(target = 'draft', draft = AppState.draft, riskCandidates = [], selectedRisks = []) {
  const model = buildStep1AiFeedbackModel(target, draft, riskCandidates, selectedRisks);
  if (!model.visible) return '';
  const savedLabel = model.savedAt
    ? `Saved ${new Date(model.savedAt).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}`
    : 'Not yet rated';
  const scaleCopy = { 1: 'Poor fit', 2: 'Weak', 3: 'Mixed', 4: 'Good', 5: 'Strong' };
  return `<div class="card wizard-ai-feedback-card mt-4" style="padding:var(--sp-4);background:var(--bg-subtle)">
    <div class="context-panel-title">${escapeHtml(model.title)}</div>
    <div class="form-help" style="margin-top:6px">${escapeHtml(model.description)} This improves AI for you first, then for your function, BU, and the shared platform once similar live-AI signals repeat.</div>
    <div style="display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap;margin-top:var(--sp-4)">
      <label class="form-help" for="ai-feedback-score-${escapeHtml(target)}" style="margin:0;min-width:84px">Score 1-5</label>
      <input id="ai-feedback-score-${escapeHtml(target)}" class="ai-feedback-score" data-feedback-target="${escapeHtml(target)}" type="range" min="1" max="5" step="1" value="${escapeHtml(String(model.score))}" style="flex:1;min-width:180px">
      <strong id="ai-feedback-score-label-${escapeHtml(target)}">${escapeHtml(scaleCopy[model.score] || 'Mixed')}</strong>
    </div>
    <div class="citation-chips" style="margin-top:var(--sp-4)">
      ${model.reasonOptions.map((reason) => {
        const active = model.reasons.includes(reason.key);
        return `<button class="btn ${active ? 'btn--secondary' : 'btn--ghost'} btn--sm ai-feedback-reason" data-feedback-target="${escapeHtml(target)}" data-feedback-reason="${escapeHtml(reason.key)}" type="button" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(reason.label)}</button>`;
      }).join('')}
    </div>
    <div class="admin-inline-actions mt-4" style="align-items:center">
      <button class="btn btn--secondary btn--sm btn-save-ai-feedback" data-feedback-target="${escapeHtml(target)}" type="button">Save feedback</button>
      <span class="form-help" id="ai-feedback-status-${escapeHtml(target)}">${escapeHtml(savedLabel)} · ${escapeHtml(String(model.runtimeMode === 'live_ai' ? 'Live AI' : model.runtimeMode === 'fallback' ? 'Fallback guidance' : 'Local guidance'))}</span>
    </div>
  </div>`;
}

function buildStep1AiRiskFeedbackModel(risk, draft = AppState.draft) {
  if (!isStep1GeneratedRiskFeedbackEligible(risk)) return { visible: false };
  const saved = getStep1AiRiskFeedbackState(risk?.id, draft);
  return {
    visible: true,
    riskId: String(risk?.id || '').trim(),
    score: Number(saved?.score || 0),
    savedAt: Number(saved?.savedAt || 0),
    runtimeMode: String(saved?.runtimeMode || getStep1AiRuntimeMode(draft)).trim()
  };
}

function renderStep1AiRiskFeedback(risk, draft = AppState.draft) {
  const model = buildStep1AiRiskFeedbackModel(risk, draft);
  if (!model.visible) return '';
  const currentScore = Math.max(0, Math.min(5, Math.round(Number(model.score || 0))));
  const savedLabel = model.savedAt
    ? `Saved ${new Date(model.savedAt).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}`
    : 'Not yet rated';
  const runtimeLabel = String(model.runtimeMode === 'live_ai' ? 'Live AI' : model.runtimeMode === 'fallback' ? 'Fallback guidance' : 'Local guidance');
  return `<div class="step1-risk-feedback" data-risk-feedback-id="${escapeHtml(model.riskId)}">
    <div class="step1-risk-feedback__row">
      <span class="step1-risk-feedback__label">Rate this suggestion</span>
      <div class="step1-risk-feedback__stars" role="radiogroup" aria-label="Rate ${escapeHtml(String(risk?.title || 'this risk suggestion'))} from 1 to 5 stars">
        ${[1, 2, 3, 4, 5].map((score) => {
          const active = score <= currentScore;
          return `<button class="step1-risk-feedback__star ${active ? 'is-active' : ''}" data-risk-feedback-id="${escapeHtml(model.riskId)}" data-risk-feedback-score="${score}" type="button" role="radio" aria-checked="${currentScore === score ? 'true' : 'false'}" aria-label="Rate ${score} star${score === 1 ? '' : 's'}">&#9733;</button>`;
        }).join('')}
      </div>
    </div>
    <div class="step1-risk-feedback__status" id="risk-feedback-status-${escapeHtml(model.riskId)}">${escapeHtml(savedLabel)} · ${escapeHtml(runtimeLabel)}</div>
  </div>`;
}

function getStep1ScenarioMemoryNarrative(draft = AppState.draft) {
  return String(
    draft?.enhancedNarrative
    || draft?.narrative
    || draft?.sourceNarrative
    || composeStep1GuidedNarrative(draft?.guidedInput, getEffectiveSettings(), draft)
    || ''
  ).trim();
}

function buildStep1ScenarioMemorySignature(query = '', matches = []) {
  return [
    String(query || '').trim().toLowerCase().slice(0, 240),
    (Array.isArray(matches) ? matches : []).map(match => String(match?.id || '').trim()).filter(Boolean).join('|')
  ].join('::');
}

function ensureStep1ScenarioMemoryState(draft = AppState.draft) {
  const currentScenario = {
    id: draft?.id || '',
    buId: draft?.buId || '',
    scenarioTitle: draft?.scenarioTitle || '',
    scenarioLens: draft?.scenarioLens || null,
    structuredScenario: draft?.structuredScenario || null,
    narrative: draft?.narrative || '',
    sourceNarrative: draft?.sourceNarrative || '',
    enhancedNarrative: draft?.enhancedNarrative || '',
    selectedRisks: Array.isArray(draft?.selectedRisks) ? draft.selectedRisks : getSelectedRisks()
  };
  const matchState = typeof findSimilarScenarioMemoryMatches === 'function'
    ? findSimilarScenarioMemoryMatches(currentScenario, { limit: 3 })
    : { query: '', totalMatches: 0, matches: [] };
  const signature = buildStep1ScenarioMemorySignature(matchState.query, matchState.matches);
  const previousSignature = String(draft?.scenarioMemorySignature || '').trim();
  const signatureChanged = signature !== previousSignature;
  draft.scenarioMemoryQuery = matchState.query;
  draft.scenarioMemoryMatches = Array.isArray(matchState.matches) ? matchState.matches : [];
  draft.scenarioMemorySignature = signature;
  if (signatureChanged) {
    if (String(draft.scenarioMemoryPrecedentSignature || '').trim() !== signature) {
      draft.scenarioMemoryPrecedent = '';
      draft.scenarioMemoryPrecedentLoading = false;
    }
    const stillSelected = draft.scenarioMemoryReferenceId
      && draft.scenarioMemoryMatches.some(match => String(match?.id || '').trim() === String(draft.scenarioMemoryReferenceId || '').trim());
    if (!stillSelected) {
      draft.scenarioMemoryReferenceId = '';
    }
    const nextComparisons = {};
    const currentComparisons = draft.scenarioMemoryComparisons && typeof draft.scenarioMemoryComparisons === 'object'
      ? draft.scenarioMemoryComparisons
      : {};
    draft.scenarioMemoryMatches.forEach((match) => {
      const key = String(match?.id || '').trim();
      if (key && currentComparisons[key]) nextComparisons[key] = currentComparisons[key];
    });
    draft.scenarioMemoryComparisons = nextComparisons;
    if (!nextComparisons[String(draft.scenarioMemoryComparisonLoadingId || '').trim()]) {
      draft.scenarioMemoryComparisonLoadingId = '';
    }
  }
  return {
    query: matchState.query,
    totalMatches: Number(matchState.totalMatches || 0),
    matches: draft.scenarioMemoryMatches,
    signature,
    reference: draft.scenarioMemoryMatches.find(match => String(match?.id || '').trim() === String(draft.scenarioMemoryReferenceId || '').trim()) || null,
    precedent: String(draft.scenarioMemoryPrecedent || '').trim(),
    precedentLoading: !!draft.scenarioMemoryPrecedentLoading,
    comparisons: draft.scenarioMemoryComparisons && typeof draft.scenarioMemoryComparisons === 'object'
      ? draft.scenarioMemoryComparisons
      : {},
    comparisonLoadingId: String(draft.scenarioMemoryComparisonLoadingId || '').trim()
  };
}

function formatStep1ScenarioMemoryDate(timestamp = 0) {
  const value = Number(timestamp || 0);
  if (!value) return 'Date not available';
  try {
    return new Date(value).toLocaleDateString('en-GB');
  } catch {
    return 'Date not available';
  }
}

function renderStep1ScenarioMemoryPrecedent(state = {}) {
  if (!state?.precedentLoading && !String(state?.precedent || '').trim()) return '';
  const headline = state.precedentLoading
    ? 'Reviewing precedent from similar completed scenarios…'
    : String(state.precedent || '').trim();
  return `<div class="premium-guidance-strip premium-guidance-strip--support" style="margin-bottom:var(--sp-4)">
    <div class="premium-guidance-strip__main">
      <div class="premium-guidance-strip__label">Org precedent</div>
      <strong>${escapeHtml(headline)}</strong>
    </div>
    <div class="premium-guidance-strip__meta">
      <span class="badge badge--gold">${state.precedentLoading ? 'Analysing history' : 'Adjusted from your history'}</span>
    </div>
  </div>`;
}

function renderStep1ScenarioMemoryReferencePanel(reference = null, comparison = '', comparisonLoading = false) {
  if (!reference) {
    return `<details class="wizard-disclosure wizard-disclosure--support" id="scenario-memory-reference-panel">
      <summary>Reference panel <span class="badge badge--neutral">Load a past scenario</span></summary>
      <div class="wizard-disclosure-body">
        <div class="form-help">Load a similar past scenario to inspect its structured event path, ALE range, and shortlisted risks without changing the current draft.</div>
      </div>
    </details>`;
  }
  const structured = normaliseStructuredScenario(reference.structuredScenario, { preserveUnknown: true }) || {};
  const risks = Array.isArray(reference.selectedRisks)
    ? reference.selectedRisks.map(item => String(item?.title || item?.category || '').trim()).filter(Boolean).slice(0, 4)
    : [];
  return `<details class="wizard-disclosure wizard-disclosure--support" id="scenario-memory-reference-panel" open>
    <summary>Reference panel <span class="badge badge--gold">Read only</span></summary>
    <div class="wizard-disclosure-body">
      <div class="context-panel-title">${escapeHtml(String(reference.scenarioTitle || 'Untitled scenario'))}</div>
      <div class="form-help" style="margin-top:6px">Last run ${escapeHtml(formatStep1ScenarioMemoryDate(reference?._scenarioMemory?.lastRunAt || reference.completedAt || reference.createdAt))} · ${escapeHtml(String(reference?._scenarioMemory?.aleRange || 'ALE not available'))}</div>
      <div class="grid-2 mt-4" style="gap:12px">
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)">
          <div class="context-panel-title">Structured model</div>
          <div class="form-help" style="margin-top:8px">Event path</div>
          <div style="color:var(--text-primary);line-height:1.6">${escapeHtml(String(getStructuredScenarioField(structured, 'eventPath') || reference.scenarioTitle || 'Not stated'))}</div>
          <div class="form-help" style="margin-top:10px">Primary driver</div>
          <div style="color:var(--text-primary);line-height:1.6">${escapeHtml(String(getStructuredScenarioField(structured, 'primaryDriver') || 'Not stated'))}</div>
          <div class="form-help" style="margin-top:10px">Effect</div>
          <div style="color:var(--text-primary);line-height:1.6">${escapeHtml(String(getStructuredScenarioField(structured, 'effect') || 'Not stated'))}</div>
        </div>
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)">
          <div class="context-panel-title">Reference read</div>
          <div class="citation-chips" style="margin-top:10px">
            <span class="badge badge--${escapeHtml(String(reference?._scenarioMemory?.treatmentStatus?.tone || 'neutral'))}">${escapeHtml(String(reference?._scenarioMemory?.treatmentStatus?.label || 'Monitor'))}</span>
            ${reference.buName ? `<span class="badge badge--neutral">${escapeHtml(String(reference.buName))}</span>` : ''}
          </div>
          <div class="form-help" style="margin-top:12px">Top shortlisted risks</div>
          <div class="citation-chips" style="margin-top:8px">
            ${risks.length ? risks.map(risk => `<span class="badge badge--neutral">${escapeHtml(risk)}</span>`).join('') : '<span class="badge badge--neutral">No saved shortlist</span>'}
          </div>
        </div>
      </div>
      ${comparisonLoading ? `<div class="card" style="padding:var(--sp-4);background:var(--bg-canvas);margin-top:var(--sp-4)"><div class="context-panel-title">What changed since then?</div><div class="form-help" style="margin-top:8px">Reviewing the current draft against this saved scenario…</div></div>` : ''}
      ${comparison && !comparisonLoading ? `<div class="card" style="padding:var(--sp-4);background:var(--bg-canvas);margin-top:var(--sp-4)"><div class="context-panel-title">What changed since then?</div><div class="context-panel-copy" style="margin-top:8px">${escapeHtml(String(comparison))}</div></div>` : ''}
    </div>
  </details>`;
}

function renderStep1ScenarioMemoryBand(draft = AppState.draft, state = ensureStep1ScenarioMemoryState(draft)) {
  const matches = Array.isArray(state?.matches) ? state.matches : [];
  if (matches.length < 2) return '';
  return `<div class="card card--elevated anim-fade-in" style="padding:var(--sp-5);background:linear-gradient(180deg, rgba(93,212,176,0.08), rgba(255,255,255,0.02))">
    <div class="flex items-center justify-between" style="gap:var(--sp-3);flex-wrap:wrap">
      <div>
        <div class="results-section-heading" style="margin:0">Similar past scenarios</div>
        <div class="form-help" style="margin-top:8px">The organisation has worked through related cases before. Use them as reference, not as a locked answer.</div>
      </div>
      <div class="citation-chips">
        <span class="badge badge--gold">${state.totalMatches} match${state.totalMatches === 1 ? '' : 'es'}</span>
      </div>
    </div>
    <div style="margin-top:var(--sp-4)">
      ${renderStep1ScenarioMemoryPrecedent(state)}
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,0.9fr);gap:var(--sp-4);align-items:start">
      <div class="risk-selection-grid">
        ${matches.map((match) => `<div class="card org-related-card--compact" style="padding:var(--sp-4);background:var(--bg-canvas)">
          <div class="context-panel-title">${escapeHtml(String(match.scenarioTitle || 'Untitled scenario'))}</div>
          <div class="form-help" style="margin-top:6px">Last run ${escapeHtml(formatStep1ScenarioMemoryDate(match?._scenarioMemory?.lastRunAt || match.completedAt || match.createdAt))}</div>
          <div class="citation-chips" style="margin-top:10px">
            <span class="badge badge--neutral">${escapeHtml(String(match?._scenarioMemory?.aleRange || 'ALE not available'))}</span>
            <span class="badge badge--${escapeHtml(String(match?._scenarioMemory?.treatmentStatus?.tone || 'neutral'))}">${escapeHtml(String(match?._scenarioMemory?.treatmentStatus?.label || 'Monitor'))}</span>
            ${match.referenceCount || match?._scenarioMemory?.referenceCount ? `<span class="badge badge--neutral">${escapeHtml(String(match?._scenarioMemory?.referenceCount || match.referenceCount || 0))} referenced</span>` : ''}
          </div>
          <div class="form-help" style="margin-top:10px">${escapeHtml(String(match.narrative || match.enhancedNarrative || '').trim().slice(0, 180) || 'No narrative summary saved.')}${String(match.narrative || match.enhancedNarrative || '').trim().length > 180 ? '…' : ''}</div>
          <div class="admin-inline-actions" style="margin-top:var(--sp-4)">
            <button class="btn btn--secondary btn--sm btn-scenario-memory-load" data-scenario-memory-id="${escapeHtml(String(match.id || ''))}" type="button">${String(draft.scenarioMemoryReferenceId || '') === String(match.id || '') ? 'Reference loaded' : 'Load as reference'}</button>
            <button class="btn btn--ghost btn--sm btn-scenario-memory-compare" data-scenario-memory-id="${escapeHtml(String(match.id || ''))}" type="button">What changed since then?</button>
          </div>
        </div>`).join('')}
      </div>
      <div>
        ${renderStep1ScenarioMemoryReferencePanel(
          state.reference,
          state.reference ? String(state.comparisons?.[String(state.reference.id || '').trim()] || '').trim() : '',
          state.reference ? state.comparisonLoadingId === String(state.reference.id || '').trim() : false
        )}
      </div>
    </div>
  </div>`;
}

function getStep1PortfolioAssessmentEntries() {
  const currentUser = AuthService.getCurrentUser?.() || null;
  const role = String(currentUser?.role || '').trim().toLowerCase();
  if ((role === 'bu_admin' || role === 'function_admin')
    && typeof getNonAdminCapabilityState === 'function'
    && typeof getReviewerVisibleAssessmentEntries === 'function') {
    const settings = typeof getUserSettings === 'function' ? getUserSettings() : {};
    const capability = getNonAdminCapabilityState(currentUser, settings, getAdminSettings());
    return getReviewerVisibleAssessmentEntries(capability)
      .map(entry => entry?.assessment || null)
      .filter(assessment => assessment?.id && assessment?.results);
  }
  return (typeof getAssessments === 'function' ? getAssessments() : [])
    .filter(assessment => assessment?.id && assessment?.results);
}

function getStep1AssessmentPrimaryRiskCategory(assessment = {}) {
  return String(
    assessment?.scenarioLens?.label
    || assessment?.scenarioLens?.key
    || assessment?.structuredScenario?.primaryRiskCategory
    || assessment?.selectedRisks?.[0]?.category
    || assessment?.selectedRisks?.[0]?.title
    || 'General enterprise'
  ).trim();
}

function buildStep1ScenarioCrossReferenceSignature(narrative = '', assessments = []) {
  return [
    normaliseScenarioSeedText(narrative).toLowerCase().slice(0, 260),
    (Array.isArray(assessments) ? assessments : [])
      .map(item => `${String(item?.id || '').trim()}:${Number(item?.lifecycleUpdatedAt || item?.completedAt || item?.createdAt || 0)}`)
      .join('|')
  ].join('::');
}

function resolveStep1ScenarioCrossReferenceMatch(assessments = [], matchTitle = '') {
  const safeTitle = String(matchTitle || '').trim();
  if (!safeTitle) return null;
  const exact = (Array.isArray(assessments) ? assessments : []).find(item => String(item?.scenarioTitle || item?.title || '').trim().toLowerCase() === safeTitle.toLowerCase());
  if (exact) return exact;
  return (Array.isArray(assessments) ? assessments : [])
    .map((item) => ({
      assessment: item,
      score: getStep1ScenarioOverlap(safeTitle, String(item?.scenarioTitle || item?.title || ''))
    }))
    .sort((left, right) => right.score - left.score)[0]?.assessment || null;
}

function getStep1ScenarioCrossReferenceContext({ draft = AppState.draft, narrativeOverride = '' } = {}) {
  const narrative = String(narrativeOverride || getStep1ScenarioMemoryNarrative(draft)).trim();
  const assessments = getStep1PortfolioAssessmentEntries()
    .filter(assessment => String(assessment?.id || '').trim() !== String(draft?.id || '').trim())
    .filter(assessment => deriveAssessmentLifecycleStatus(assessment) !== ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED);
  const signature = buildStep1ScenarioCrossReferenceSignature(narrative, assessments);
  return {
    narrative,
    assessments,
    signature,
    portfolio: assessments.map((assessment) => ({
      title: String(assessment?.scenarioTitle || assessment?.title || 'Untitled assessment').trim(),
      primaryRiskCategory: getStep1AssessmentPrimaryRiskCategory(assessment)
    }))
  };
}

function renderStep1ScenarioCrossReferenceBand(draft = AppState.draft, context = getStep1ScenarioCrossReferenceContext({ draft })) {
  const hasSignals = normaliseAssessmentTokens(context?.narrative || '').length >= 4;
  if (!hasSignals || !(context?.assessments || []).length) return '';
  const dismissals = draft?.scenarioCrossReferenceDismissals && typeof draft.scenarioCrossReferenceDismissals === 'object'
    ? draft.scenarioCrossReferenceDismissals
    : {};
  const activeInsight = String(draft?.scenarioCrossReferenceSignature || '').trim() === String(context?.signature || '').trim()
    ? (draft?.scenarioCrossReference && typeof draft.scenarioCrossReference === 'object' ? draft.scenarioCrossReference : null)
    : null;
  const overlap = activeInsight?.overlap && activeInsight.overlap.found ? activeInsight.overlap : null;
  const gap = activeInsight?.gap && activeInsight.gap.isNew ? activeInsight.gap : null;
  const showOverlap = overlap && String(dismissals.overlap || '').trim() !== String(context?.signature || '').trim();
  const showGap = gap && String(dismissals.gap || '').trim() !== String(context?.signature || '').trim();
  const isLoading = !!draft?.scenarioCrossReferenceLoading
    && String(draft?.scenarioCrossReferenceLoadingSignature || '').trim() === String(context?.signature || '').trim();
  if (!isLoading && !showOverlap && !showGap) return '';
  return `<div class="wizard-summary-stack">
    ${isLoading ? `<div class="premium-guidance-strip premium-guidance-strip--support">
      <div class="premium-guidance-strip__main">
        <div class="premium-guidance-strip__label">Portfolio cross-reference</div>
        <strong>Checking the current scenario against saved assessment coverage…</strong>
      </div>
    </div>` : ''}
    ${showOverlap ? `<div class="premium-guidance-strip premium-guidance-strip--warning">
      <div class="premium-guidance-strip__main">
        <div class="premium-guidance-strip__label">Portfolio overlap</div>
        <strong>Heads up — this looks similar to '${escapeHtml(String(overlap.matchTitle || 'an existing assessment'))}'.</strong>
        <div class="premium-guidance-strip__copy">${escapeHtml(String(overlap.overlapSummary || 'A saved assessment already covers much of the same scenario path.'))}</div>
      </div>
      <div class="premium-guidance-strip__meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${overlap.matchId ? `<button type="button" class="btn btn--secondary btn--sm" data-scenario-cross-reference-view="${escapeHtml(String(overlap.matchId || ''))}">View it</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-scenario-cross-reference-dismiss="overlap">Continue with new assessment</button>
      </div>
    </div>` : ''}
    ${showGap ? `<div class="premium-guidance-strip premium-guidance-strip--success">
      <div class="premium-guidance-strip__main">
        <div class="premium-guidance-strip__label">New coverage area</div>
        <strong>This scenario appears to fill a gap in the current risk portfolio.</strong>
        <div class="premium-guidance-strip__copy">${escapeHtml(String(gap.gapSummary || 'This adds a scenario the current portfolio does not yet appear to cover directly.'))}</div>
      </div>
      <div class="premium-guidance-strip__meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn--ghost btn--sm" data-scenario-cross-reference-dismiss="gap">Dismiss</button>
      </div>
    </div>` : ''}
  </div>`;
}

function renderStep1GuidedBuilderCard(draft, recommendation, functionLabel = 'your role', promptIdeaModel = null) {
  const previewModel = getStep1DisplayedGuidedPreviewModel(draft);
  const draftPreview = String(previewModel.preview || '').trim();
  const draftPreviewStatus = String(previewModel.status || '').trim();
  const draftPreviewSource = String(previewModel.source || '').trim();
  const draftSourceBanner = draftPreviewSource === 'fallback' && typeof renderAIStatusBanner === 'function'
    ? renderAIStatusBanner()
    : '';
  const optionalContextDisclosureKey = getDisclosureStateKey('/wizard/1', 'add more context only if you need it');
  const safePromptIdeaModel = promptIdeaModel && typeof promptIdeaModel === 'object'
    ? promptIdeaModel
    : buildStep1GuidedPromptIdeaModel(draft);
  const promptCards = Array.isArray(safePromptIdeaModel.promptSuggestions) ? safePromptIdeaModel.promptSuggestions : [];
  const primaryPrompt = String(
    safePromptIdeaModel.state === STEP1_PROMPT_IDEA_CONFIDENCE_STATES.high
      ? (promptCards[0]?.prompt || 'Describe what happened or what could happen.')
      : 'Describe what happened or what could happen.'
  ).trim();
  return `<div class="card card--primary wizard-primary-card anim-fade-in anim-delay-1">
    <div class="wizard-premium-head" style="margin-bottom:var(--sp-5)">
      <div>
        <h3>Guided scenario builder</h3>
        <p>Answer a few plain-language prompts. The platform will turn them into a structured starting point you can edit before continuing.</p>
        <div class="wizard-builder-note">
          <strong>${recommendation.title}</strong>
      <span>${recommendation.copy} Your current examples are tuned for ${escapeHtml(functionLabel.toLowerCase())} work.</span>
    </div>
      </div>
      <span class="badge badge--gold">Recommended</span>
    </div>
    ${draftSourceBanner}
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label" for="guided-event">What happened or what could happen?</label>
        <textarea class="form-textarea" id="guided-event" rows="3" placeholder="Example: ${escapeHtml(primaryPrompt)}">${draft.guidedInput?.event || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="guided-impact">What is the main impact you care about?</label>
        <input class="form-input" id="guided-impact" type="text" placeholder="Example: service outage, regulatory breach, customer harm, financial exposure, recovery strain" value="${draft.guidedInput?.impact || ''}">
      </div>
    </div>
    <details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(optionalContextDisclosureKey)}" data-disclosure-default-open="false" ${getDisclosureOpenState(optionalContextDisclosureKey, false) ? 'open' : ''} style="margin-top:var(--sp-4)">
      <summary>Add more context only if you need it <span class="badge badge--neutral">Optional</span></summary>
      <div class="wizard-disclosure-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" for="guided-asset">What is affected?</label>
            <input class="form-input" id="guided-asset" type="text" placeholder="Example: payment platform, shared identity service, cloud data store" value="${draft.guidedInput?.asset || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="guided-cause">What is the likely cause or trigger?</label>
            <input class="form-input" id="guided-cause" type="text" placeholder="Example: supplier breach, phishing-led compromise, weak recovery process, control gap" value="${draft.guidedInput?.cause || ''}">
          </div>
        </div>
        <div class="grid-2 mt-4">
          <div class="form-group">
            <label class="form-label" for="guided-urgency">How urgent does it feel?</label>
            <select class="form-select" id="guided-urgency">
              <option value="low" ${draft.guidedInput?.urgency === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${!draft.guidedInput?.urgency || draft.guidedInput?.urgency === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${draft.guidedInput?.urgency === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${draft.guidedInput?.urgency === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>
      </div>
    </details>
    <div class="step1-guided-stage mt-4">
      <div id="guided-prompt-ideas-panel">
        ${renderStep1GuidedPromptIdeaPanel({
          ...safePromptIdeaModel,
          explicitAiFlow: true
        })}
      </div>
    </div>
    <div class="step1-guided-stage mt-4">
      <div class="step1-ai-sequence__label">Step 2 of 2</div>
      <div class="step1-ai-sequence__title">Build the scenario with AI</div>
      <div class="admin-inline-actions step1-guided-actions">
        <button class="btn btn--primary" id="btn-build-guided-narrative" type="button">Build scenario with AI</button>
        <span class="form-help">Use a prompt idea if it helps, or ignore the suggestions and build straight from your own wording.</span>
      </div>
    </div>
    ${draftPreview ? `${renderStep1AiQualityStrip(draft)}<div class="card mt-4 wizard-draft-preview" style="padding:var(--sp-4);background:var(--bg-elevated)">
      <div class="context-panel-title">Draft preview</div>
      <div class="form-help" id="guided-preview-status" style="margin-top:4px;${draftPreviewStatus ? '' : 'display:none'}">${draftPreviewStatus ? `${draftPreviewSource === 'ai' ? 'AI-built draft' : draftPreviewSource === 'fallback' ? 'Deterministic fallback draft' : draftPreviewSource === 'manual' ? 'Manual draft' : draftPreviewSource === 'local' ? 'Local draft' : 'AI-checked preview'} · ${escapeHtml(draftPreviewStatus)}` : ''}</div>
      <p class="context-panel-copy" id="guided-preview">${escapeHtml(String(draftPreview))}</p>
    </div>${renderStep1AiFeedbackCard('draft', draft)}` : '<div class="form-help wizard-preview-placeholder" id="guided-preview">Answer the prompts and build the scenario with AI. The platform will create a clean starting statement for you.</div>'}
  </div>`;
}

function renderStep1SupportBand({ draft, hasScenarioDraft, hasImportedSource, featuredDryRun, recommendedDryRuns, learnedDryRuns, availableDryRuns, functionLabel, activeDryRun, buList, scenarioGeographies, regs, settings, riskCandidates, regulationModel, scenarioMemoryState }) {
  return `<section class="wizard-support-band anim-fade-in">
    <div class="results-section-heading">Support and alternate starts</div>
    <div class="form-help" style="margin-top:8px">Use these only when you need existing context, a faster starting point, or a different source for the shortlist.</div>
    <div class="wizard-support-band__stack">
      ${activeDryRun ? renderLoadedDryRunBanner(activeDryRun) : ''}
      ${draft.learningNote ? `<div class="wizard-summary-band wizard-summary-band--quiet"><div><div class="wizard-summary-band__label">Learnt from prior use</div><strong>Saved guidance from earlier use</strong><div class="wizard-summary-band__copy">${draft.learningNote}</div></div></div>` : ''}
      ${renderStep1FeaturedExampleCard(featuredDryRun, recommendedDryRuns, learnedDryRuns, functionLabel)}
      ${renderStep1OtherWaysToStart(draft, hasScenarioDraft, hasImportedSource, availableDryRuns, functionLabel)}
      <div id="scenario-cross-reference-host">
        ${renderStep1ScenarioCrossReferenceBand(draft)}
      </div>
      <div id="scenario-memory-host">
        ${renderStep1ScenarioMemoryBand(draft, scenarioMemoryState)}
      </div>
      <div id="intake-output">
        ${renderStep1AiIntakeSummary(draft)}
      </div>
    </div>
  </section>`;
}

function renderStep1ScopeBand({ draft, selectedRisks, riskCandidates, regs }) {
  const hasCandidates = riskCandidates.length > 0;
  if (!hasCandidates) return '';
  return `<section class="wizard-scope-band anim-fade-in">
    <div class="wizard-ia-section">
      <div class="results-section-heading">Choose what stays in scope</div>
      <div class="form-help" style="margin-top:8px">Carry forward only the risks that belong in the same scenario and management discussion.</div>
    </div>
    <div class="card anim-fade-in anim-delay-2">
      <div class="flex items-center justify-between mb-4" style="flex-wrap:wrap;gap:var(--sp-3)">
        <div>
          <div class="context-panel-title">Choose the risks for this assessment</div>
          <p class="context-panel-copy">Keep only risks that share the same event, scope, or business impact. Remove anything that is out of scope before continuing.</p>
        </div>
        <label class="toggle-row">
          <span class="toggle-label">Treat as linked scenario</span>
          <label class="toggle"><input type="checkbox" id="linked-risks-toggle" ${draft.linkedRisks ? 'checked' : ''}><div class="toggle-track"></div></label>
        </label>
      </div>
      <div id="selected-risks-wrap">
        ${renderSelectedRiskCards(riskCandidates, selectedRisks, regs)}
      </div>
      ${renderStep1AiFeedbackCard('shortlist', draft, riskCandidates, selectedRisks)}
    </div>
  </section>`;
}

function renderStep1OtherWaysToStart(draft, hasScenarioDraft, hasImportedSource, availableExamples = STEP1_DRY_RUN_SCENARIOS, functionLabel = 'your function', options = {}) {
  const disclosureKey = getDisclosureStateKey('/wizard/1', 'other ways to start');
  const importDisclosureKey = getDisclosureStateKey('/wizard/1', 'import or add risks directly');
  const examplesDisclosureKey = getDisclosureStateKey('/wizard/1', 'browse more worked examples');
  if (options?.examplesOnly) {
    return `<details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(examplesDisclosureKey)}" data-disclosure-default-open="false" ${getDisclosureOpenState(examplesDisclosureKey, false) ? 'open' : ''}>
      <summary>Browse more worked examples <span class="badge badge--neutral">Optional</span></summary>
      <div class="wizard-disclosure-body">
        <div class="form-help">Use these when you want a fast, high-quality starting point. The first examples are tuned for ${escapeHtml(functionLabel.toLowerCase())} work, with recent learnt cases mixed in when available.</div>
        <div class="risk-selection-grid" style="margin-top:var(--sp-4)">
          ${availableExamples.map(example => `<div class="risk-pick-card">
            <div class="risk-pick-head" style="align-items:flex-start">
              <div style="flex:1">
                <div class="risk-pick-title">${escapeHtml(example.title)}</div>
                <div class="form-help" style="margin-top:6px">${escapeHtml(example.summary)}</div>
                <div class="form-help" style="margin-top:6px"><strong>Best for:</strong> ${escapeHtml(example.bestFor)}</div>
              </div>
              <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(example.id)}" type="button">Load Example</button>
            </div>
            <div class="citation-chips" style="margin-top:var(--sp-3)">
              <span class="badge badge--neutral">${escapeHtml(STEP1_DRY_RUN_FUNCTION_LABELS[example.functionKey] || STEP1_DRY_RUN_FUNCTION_LABELS.general)}</span>
              ${(example.geographies || []).map(geo => `<span class="badge badge--neutral">${escapeHtml(geo)}</span>`).join('')}
              <span class="badge badge--neutral">${Array.isArray(example.risks) ? example.risks.length : 0} starter risks</span>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </details>`;
  }
  const isOpen = getDisclosureOpenState(disclosureKey, AppState.dashboardStartIntent === 'register' || hasScenarioDraft || hasImportedSource);
  return `<details class="wizard-disclosure anim-fade-in anim-delay-1" data-disclosure-state-key="${escapeHtml(disclosureKey)}" data-disclosure-default-open="${isOpen ? 'true' : 'false'}" ${isOpen ? 'open' : ''}>
    <summary>Other ways to start <span class="badge badge--neutral">Optional</span></summary>
    <div class="wizard-disclosure-body">
      <div class="form-help">Open this only if you already have a scenario draft, a register, or a known list of risks. The guided builder remains the easiest path for most users.</div>
      <div class="card" style="padding:var(--sp-5);background:var(--bg-elevated)">
        <div class="context-panel-title">Bring your own scenario wording</div>
        <div class="form-help" style="margin-top:6px">Use AI only if you want help tightening the draft or extracting the shortlist.</div>
        <div class="form-group" style="margin-top:var(--sp-4)">
          <label class="form-label" for="intake-risk-statement">Scenario draft</label>
          <textarea class="form-textarea" id="intake-risk-statement" rows="6" placeholder="If you already know the scenario, describe it here in plain English. Include what could happen, what is affected, likely triggers, and the business or regulatory impact.">${draft.narrative || ''}</textarea>
        </div>
        <div class="flex items-center gap-3" style="flex-wrap:wrap">
          <button class="btn btn--secondary" id="btn-enhance-risk-statement" type="button">Use AI to refine this draft</button>
          <button class="btn btn--ghost" id="btn-generate-risks-from-draft" type="button">Generate shortlist from this draft</button>
        </div>
      </div>
      <details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(importDisclosureKey)}" data-disclosure-default-open="false" ${getDisclosureOpenState(importDisclosureKey, false) ? 'open' : ''}>
        <summary>Import or add risks directly <span class="badge badge--neutral">Advanced start</span></summary>
        <div class="wizard-disclosure-body">
          <div class="form-help">Use this only when your source material already exists in a register, spreadsheet, or known risk list.</div>
          <div class="grid-2" style="margin-top:var(--sp-4)">
            <div class="form-group">
              <label class="form-label" for="risk-register-file">Risk register upload</label>
              <input class="form-input" id="risk-register-file" type="file" accept=".txt,.csv,.json,.md,.tsv,.xlsx,.xls">
              <div class="form-help">${draft.uploadedRegisterName ? `Current file: ${draft.uploadedRegisterName}${draft.registerMeta?.sheetCount ? ` · ${draft.registerMeta.sheetCount} sheet(s)` : ''}` : 'Upload TXT, CSV, TSV, JSON, Markdown, or Excel. Word and PDF still need conversion before upload.'}</div>
              <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
                <button class="btn btn--secondary" id="btn-register-analyse">Upload, extract, analyse and enhance risks</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="manual-risk-add">Add risk manually</label>
              <div class="inline-action-row">
                <input class="form-input" id="manual-risk-add" type="text" placeholder="e.g. Export control screening failure">
                <button class="btn btn--secondary" id="btn-add-manual-risk" type="button">Add</button>
              </div>
              <div class="form-help" style="margin-top:10px">Manual risks are added to the same candidate list and selected by default.</div>
            </div>
          </div>
          <p class="form-help" style="margin-top:var(--sp-4)">Uses runtime AI if a key has been set with <code>LLMService.setOpenAIKey(...)</code>. Otherwise the local extraction stub is used.</p>
        </div>
      </details>
      <details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(examplesDisclosureKey)}" data-disclosure-default-open="false" ${getDisclosureOpenState(examplesDisclosureKey, false) ? 'open' : ''}>
        <summary>Browse more worked examples <span class="badge badge--neutral">Optional</span></summary>
        <div class="wizard-disclosure-body">
          <div class="form-help">Use these when you want a fast, high-quality starting point. The first examples are tuned for ${escapeHtml(functionLabel.toLowerCase())} work, with recent learnt cases mixed in when available.</div>
          <div class="risk-selection-grid" style="margin-top:var(--sp-4)">
            ${availableExamples.map(example => `<div class="risk-pick-card">
              <div class="risk-pick-head" style="align-items:flex-start">
                <div style="flex:1">
                  <div class="risk-pick-title">${escapeHtml(example.title)}</div>
                  <div class="form-help" style="margin-top:6px">${escapeHtml(example.summary)}</div>
                  <div class="form-help" style="margin-top:6px"><strong>Best for:</strong> ${escapeHtml(example.bestFor)}</div>
                </div>
                <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(example.id)}" type="button">Load Example</button>
              </div>
              <div class="citation-chips" style="margin-top:var(--sp-3)">
                <span class="badge badge--neutral">${escapeHtml(STEP1_DRY_RUN_FUNCTION_LABELS[example.functionKey] || STEP1_DRY_RUN_FUNCTION_LABELS.general)}</span>
                ${(example.geographies || []).map(geo => `<span class="badge badge--neutral">${escapeHtml(geo)}</span>`).join('')}
                <span class="badge badge--neutral">${Array.isArray(example.risks) ? example.risks.length : 0} starter risks</span>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </details>
    </div>
  </details>`;
}

function ensureStep1ContextPrefills(draft, settings, buList) {
  let changed = false;
  const preferredBusinessUnitId = settings.userProfile?.businessUnitEntityId || AppState.currentUser?.businessUnitEntityId || '';
  if (!draft.buId && preferredBusinessUnitId) {
    const preferredBU = buList.find(bu => bu.orgEntityId === preferredBusinessUnitId || bu.id === preferredBusinessUnitId);
    if (preferredBU) {
      draft.buId = preferredBU.id;
      draft.buName = preferredBU.name;
      changed = true;
    }
  }
  const currentGeographies = getScenarioGeographies();
  if (!currentGeographies.length && settings.geography) {
    draft.geographies = normaliseScenarioGeographies([settings.geography], settings.geography);
    draft.geography = formatScenarioGeographies(draft.geographies, settings.geography);
    changed = true;
  }
  if (!Array.isArray(draft.applicableRegulations) || !draft.applicableRegulations.length || changed) {
    updateStep1ApplicableRegulations(buList, getScenarioGeographies());
    changed = true;
  }
  return changed;
}

function renderStep1ContextCard(settings, draft, scenarioGeographies, regs, buList) {
  const businessUnit = buList.find(bu => bu.id === draft.buId) || null;
  const geographies = scenarioGeographies.length ? scenarioGeographies : normaliseScenarioGeographies([settings.geography], settings.geography);
  const regulations = Array.isArray(regs) ? regs : [];
  return `<div class="card card--elevated anim-fade-in">
    <div class="wizard-premium-head">
      <div>
        <div class="wizard-summary-band__label">Required before continuing</div>
        <h3>Assessment context</h3>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">Set the business unit and geographies first. The appetite statement and applicable regulations update from that context and carry forward into the rest of the assessment.</p>
      </div>
      <span class="badge badge--gold">Required</span>
    </div>
    <div class="grid-2" style="margin-top:var(--sp-4)">
      <div class="form-group">
        <label class="form-label" for="wizard-bu">Business Unit <span class="required">*</span></label>
        <select class="form-select" id="wizard-bu">
          <option value="">— Select —</option>
          ${buList.map(b => `<option value="${b.id}" ${draft.buId===b.id?'selected':''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Geographies</label>
        <div class="tag-input-wrap" id="ti-wizard-geographies"></div>
        <div class="citation-chips" style="margin-top:10px">
          ${GEOGRAPHY_OPTIONS.map(option => `<button type="button" class="chip wizard-geo-chip" data-geo="${option}">${option}</button>`).join('')}
        </div>
        <span class="form-help">Select all countries or regions relevant to this scenario. Applicable regulations update from the combined footprint.</span>
      </div>
    </div>
    <div class="context-grid mt-4">
      <div class="context-chip-panel">
        <div class="context-panel-title">Risk appetite statement</div>
        <p class="context-panel-copy">${escapeHtml(String(settings.riskAppetiteStatement || 'No risk appetite statement configured.'))}</p>
        <div class="context-panel-foot">Current P90 per-event tolerance: ${fmtCurrency(getToleranceThreshold())}. Warning trigger: ${fmtCurrency(getWarningThreshold())}.</div>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Applicable regulations</div>
        ${regulations.length ? `<div class="citation-chips">${regulations.map(tag => `<span class="badge badge--gold">${escapeHtml(tag)}</span>`).join('')}</div>` : '<div class="form-help">Applicable regulations will appear here once the business unit, geography, and current scenario signals are in place.</div>'}
        <div class="context-panel-foot">${businessUnit?.name ? `Current business context: ${escapeHtml(businessUnit.name)}.` : 'Regulations are read-only here and update from the current assessment context.'}</div>
      </div>
    </div>
  </div>`;
}

function initStep1Path(draft = AppState.draft || {}) {
  const current = String(draft.step1Path || '').trim();
  if (current === 'guided' || current === 'draft' || current === 'import') return false;
  draft.step1Path = AppState.dashboardStartIntent === 'register'
    ? 'import'
    : 'guided';
  return true;
}

function renderStep1PathSelector(currentPath = 'guided') {
  const activePath = currentPath === 'draft' || currentPath === 'import' ? currentPath : 'guided';
  const cards = [
    {
      path: 'guided',
      eyebrow: '▸ Recommended',
      title: 'Guide me through it',
      copy: 'Answer a few questions. AI builds your scenario draft.'
    },
    {
      path: 'draft',
      eyebrow: '◌ I know what I want',
      title: 'Bring my own draft',
      copy: 'Paste or type a scenario. AI can refine it.'
    },
    {
      path: 'import',
      eyebrow: '○ Load existing material',
      title: 'Start from a register or example',
      copy: 'Upload a register, or pick a worked example to edit.'
    }
  ];
  return `<section class="anim-fade-in">
    <div class="results-section-heading">Choose how you want to start</div>
    <div class="form-help" style="margin-top:8px">Pick one path, commit to it, and the page will show only the controls relevant to that start method.</div>
    <div class="step1-path-grid">
      ${cards.map((card) => `<button type="button" class="card step1-path-card" data-path="${card.path}" aria-pressed="${activePath === card.path ? 'true' : 'false'}">
        <div class="wizard-summary-band__label">${escapeHtml(card.eyebrow)}</div>
        <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:var(--text-primary);margin-top:6px">${escapeHtml(card.title)}</div>
        <div class="context-panel-copy" style="margin-top:8px">${escapeHtml(card.copy)}</div>
      </button>`).join('')}
    </div>
  </section>`;
}

function renderStep1HiddenNarrativeField(draft = AppState.draft || {}) {
  return `<textarea class="form-textarea" id="intake-risk-statement" hidden aria-hidden="true" tabindex="-1">${escapeHtml(String(draft.narrative || ''))}</textarea>`;
}

function renderStep1DraftPathCard(draft = AppState.draft || {}) {
  return `<div class="card card--primary anim-fade-in anim-delay-1">
    <div class="wizard-premium-head" style="margin-bottom:var(--sp-5)">
      <div>
        <div class="wizard-summary-band__label">Bring your own draft</div>
        <h3>Your scenario draft</h3>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">Paste or write the scenario in plain English. AI can tighten the wording and generate the first shortlist when you are ready.</p>
      </div>
      <span class="badge badge--neutral">Draft path</span>
    </div>
    <div class="form-group">
      <label class="form-label" for="intake-risk-statement">Scenario draft</label>
      <textarea class="form-textarea" id="intake-risk-statement" rows="8" placeholder="Describe what could happen, what is affected, what causes it, and the business or regulatory impact you care about.">${escapeHtml(String(draft.narrative || ''))}</textarea>
    </div>
    <div class="flex items-center gap-3" style="flex-wrap:wrap">
      <button class="btn btn--secondary" id="btn-enhance-risk-statement" type="button">Use AI to refine this draft</button>
      <button class="btn btn--ghost" id="btn-generate-risks-from-draft" type="button">Generate risk shortlist from this draft</button>
    </div>
  </div>`;
}

function renderStep1ImportPathCard({
  draft = AppState.draft || {},
  featuredDryRun = null,
  recommendedDryRuns = [],
  learnedDryRuns = [],
  availableDryRuns = STEP1_DRY_RUN_SCENARIOS,
  functionLabel = 'your function',
  activeDryRun = null
} = {}) {
  return `<div class="wizard-summary-stack">
    ${activeDryRun ? renderLoadedDryRunBanner(activeDryRun) : ''}
    <div class="card card--primary anim-fade-in anim-delay-1">
      <div class="wizard-premium-head" style="margin-bottom:var(--sp-5)">
        <div>
          <div class="wizard-summary-band__label">Load existing material</div>
          <h3>Start from a register or example</h3>
          <p class="context-panel-copy" style="margin-top:var(--sp-2)">Upload an existing register, or load a worked example and edit it into the current assessment context.</p>
        </div>
        <span class="badge badge--neutral">Import path</span>
      </div>
      <div class="wizard-summary-stack">
        <section class="context-chip-panel">
          <div class="context-panel-title">Upload a risk register</div>
          <div class="form-group" style="margin-top:var(--sp-3)">
            <label class="form-label" for="risk-register-file">Risk register upload</label>
            <input class="form-input" id="risk-register-file" type="file" accept=".txt,.csv,.json,.md,.tsv,.xlsx,.xls">
            <div class="form-help">${draft.uploadedRegisterName ? `Current file: ${escapeHtml(draft.uploadedRegisterName)}${draft.registerMeta?.sheetCount ? ` · ${draft.registerMeta.sheetCount} sheet(s)` : ''}` : 'Upload TXT, CSV, TSV, JSON, Markdown, or Excel. Word and PDF still need conversion before upload.'}</div>
          </div>
          <div class="flex items-center gap-3" style="flex-wrap:wrap;margin-top:var(--sp-4)">
            <button class="btn btn--secondary" id="btn-register-analyse" type="button">Upload, extract, analyse and enhance risks</button>
          </div>
          <div class="form-group" style="margin-top:var(--sp-4)">
            <label class="form-label" for="manual-risk-add">Add risk manually</label>
            <div class="inline-action-row">
              <input class="form-input" id="manual-risk-add" type="text" placeholder="e.g. Export control screening failure">
              <button class="btn btn--secondary" id="btn-add-manual-risk" type="button">Add</button>
            </div>
            <div class="form-help" style="margin-top:10px">Manual risks are added to the same candidate list and selected by default.</div>
          </div>
        </section>
        <section class="context-chip-panel">
          <div class="context-panel-title">Or load a worked example</div>
          <div class="form-help" style="margin-top:6px">Use a worked example when you want a strong starting point and then edit it into the current assessment.</div>
          <div style="margin-top:var(--sp-4)">
            ${renderStep1FeaturedExampleCard(featuredDryRun, recommendedDryRuns, learnedDryRuns, functionLabel)}
          </div>
          <div style="margin-top:var(--sp-4)">
            ${renderStep1OtherWaysToStart(draft, false, true, availableDryRuns, functionLabel, { examplesOnly: true })}
          </div>
        </section>
      </div>
    </div>
    ${renderStep1HiddenNarrativeField(draft)}
  </div>`;
}

function renderStep1InsightWorkbench(draft, scenarioMemoryState, activePath = 'guided') {
  const disclosureKey = getDisclosureStateKey('/wizard/1', 'review ai reasoning and context');
  const alignmentMarkup = activePath === 'guided' ? '' : renderStep1AiAlignmentCard(draft.aiAlignment);
  const crossReferenceMarkup = renderStep1ScenarioCrossReferenceBand(draft);
  const scenarioMemoryMarkup = renderStep1ScenarioMemoryBand(draft, scenarioMemoryState);
  const intakeSummaryMarkup = activePath === 'guided' ? '' : renderStep1AiIntakeSummary(draft);
  const activeCount = [alignmentMarkup, crossReferenceMarkup, scenarioMemoryMarkup, intakeSummaryMarkup]
    .filter(section => String(section || '').trim().length > 0)
    .length;
  const summaryLabel = activeCount
    ? `${activeCount} support view${activeCount === 1 ? '' : 's'} available`
    : 'No extra context yet';
  return `<details class="wizard-disclosure wizard-disclosure--support wizard-secondary-workbench" data-disclosure-state-key="${escapeHtml(disclosureKey)}" data-disclosure-default-open="false" ${getDisclosureOpenState(disclosureKey, false) ? 'open' : ''}>
    <summary>Review AI reasoning and related context <span class="badge badge--neutral" id="step1-insight-summary-count">${escapeHtml(summaryLabel)}</span></summary>
    <div class="wizard-disclosure-body wizard-secondary-workbench__body">
      <div id="step1-insight-empty-state" class="form-help"${activeCount ? ' hidden' : ''}>Extra reasoning appears here only when the platform has AI checks, similar past scenarios, or portfolio overlap worth showing.</div>
      <div id="step1-insight-alignment-host">
        ${alignmentMarkup}
      </div>
      <div id="scenario-cross-reference-host">
        ${crossReferenceMarkup}
      </div>
      <div id="scenario-memory-host">
        ${scenarioMemoryMarkup}
      </div>
      <div id="intake-output">
        ${intakeSummaryMarkup}
      </div>
    </div>
  </details>`;
}

function renderStep1PathContent(path, {
  draft,
  recommendation,
  functionLabel,
  promptIdeaModel,
  exampleModel,
  hasScenarioDraft,
  hasImportedSource,
  settings,
  scenarioMemoryState,
  activeDryRun,
  featuredDryRun
}) {
  const activePath = path === 'draft' || path === 'import' ? path : 'guided';
  let content = '';
  if (activePath === 'draft') {
    content = renderStep1DraftPathCard(draft);
  } else if (activePath === 'import') {
    content = renderStep1ImportPathCard({
      draft,
      featuredDryRun: featuredDryRun
        || activeDryRun
        || exampleModel.recommendedExamples[0]
        || exampleModel.learnedExamples[0]
        || exampleModel.availableExamples[0]
        || null,
      recommendedDryRuns: exampleModel.recommendedExamples,
      learnedDryRuns: exampleModel.learnedExamples,
      availableDryRuns: exampleModel.availableExamples,
      functionLabel: exampleModel.functionLabel,
      activeDryRun
    });
  } else {
    content = `${renderStep1GuidedBuilderCard(draft, recommendation, functionLabel, promptIdeaModel)}
      ${renderStep1HiddenNarrativeField(draft)}`;
  }
  return `<section class="wizard-summary-stack">
    ${draft.learningNote ? `<div class="wizard-summary-band wizard-summary-band--quiet"><div><div class="wizard-summary-band__label">Learnt from prior use</div><strong>Saved guidance from earlier use</strong><div class="wizard-summary-band__copy">${escapeHtml(String(draft.learningNote || ''))}</div></div></div>` : ''}
    ${renderGhostDraftBanner(draft)}
    ${content}
    ${renderStep1InsightWorkbench(draft, scenarioMemoryState, activePath)}
  </section>`;
}

function getRegisterFallbackToastCopy(result = {}) {
  const title = String(result.fallbackReasonTitle || 'Deterministic fallback register analysis loaded').trim();
  const detail = String(result.fallbackReasonMessage || '').trim();
  const diagnostic = String(result.fallbackReasonDetail || '').trim();
  const shortDiagnostic = diagnostic ? ` Diagnostic: ${diagnostic}` : '';
  return detail ? `${title}. ${detail}${shortDiagnostic} Review the suggested risks before continuing.` : `${title}.${shortDiagnostic} Review the suggested risks before continuing.`;
}

function renderStep1ReadinessBanner(draft, selectedRisks) {
  const warnings = [];
  const narrative = String(draft.narrative || draft.sourceNarrative || '').trim();
  if (!String(draft.buId || '').trim()) warnings.push('Pick the business unit first so the right context and regulations carry forward.');
  if (!narrative && !String(draft.guidedInput?.event || '').trim()) warnings.push('Add at least the event prompt or load a sample example to get a useful scenario draft quickly.');
  if (narrative && narrative.split(/\s+/).filter(Boolean).length < 12) warnings.push('The scenario draft is still very short. Add what is affected, what causes it, and the impact you care about.');
  if (narrative && !selectedRisks.length) warnings.push('No risks are selected yet. Use the shortlist below or generate risks from the current draft before continuing.');
  if (!warnings.length) return '';
  return renderPilotWarningBanner('lowConfidence', {
    compact: true,
    text: warnings[0]
  });
}

function renderGhostDraftBanner(draft) {
  const meta = draft?.ghostDraftMeta;
  if (!meta || !Number(meta.patternCount || 0)) return '';
  const sourceLabel = meta.sourceType === 'organisation' ? 'your team has' : 'you have';
  const sourceTitles = Array.isArray(meta.sourcePatternTitles) ? meta.sourcePatternTitles.filter(Boolean).slice(0, 3) : [];
  return `<section class="wizard-summary-band anim-fade-in">
    <div>
      <div class="wizard-summary-band__label">Ghost drafter</div>
      <strong>Pre-loaded from ${Number(meta.patternCount || 0)} similar assessment${Number(meta.patternCount || 0) === 1 ? '' : 's'} ${sourceLabel} already built</strong>
      <div class="wizard-summary-band__copy">The platform prepared a starting narrative, lens, shortlist, and regulation set before you opened a blank page. Keep what fits and change what does not.</div>
    </div>
    <div class="wizard-summary-band__meta">
      ${sourceTitles.map(title => `<span class="badge badge--neutral">${escapeHtml(title)}</span>`).join('')}
      <button class="btn btn--ghost btn--sm" id="btn-clear-ghost-draft" type="button">Start blank instead</button>
    </div>
  </section>`;
}

function clearGhostDraftSuggestion() {
  const draft = AppState.draft || {};
  draft.scenarioTitle = '';
  draft.narrative = '';
  draft.enhancedNarrative = '';
  draft.sourceNarrative = '';
  draft.structuredScenario = null;
  draft.scenarioLens = null;
  draft.riskCandidates = [];
  draft.selectedRiskIds = [];
  draft.selectedRisks = [];
  draft.ghostDraftMeta = null;
  draft.guidedDraftSource = '';
  draft.guidedDraftStatus = '';
  draft.guidedInput = {
    event: '',
    asset: '',
    cause: '',
    impact: '',
    urgency: 'medium'
  };
  resetStep1RegulationSelectionState();
  updateStep1ApplicableRegulations(getBUList(), getScenarioGeographies());
}

const STEP1_DRY_RUN_SCENARIOS = [
  createStep1DryRunScenario({
    id: 'finance-liquidity-shock',
    functionKey: 'finance',
    title: 'Liquidity pressure after a sudden market shock',
    summary: 'Tailored to treasury and finance teams managing funding, cash, and escalation posture.',
    bestFor: 'Treasury, liquidity, and executive escalation walkthroughs',
    nextStep: 'Use this when you want finance-led guidance on funding pressure, liquidity actions, and confidence in management response.',
    promptLabel: 'Liquidity shock',
    event: 'A sudden market move forces faster-than-expected collateral and liquidity demands across critical financing lines.',
    asset: 'Treasury funding lines, cash buffers, and short-term liquidity operations',
    cause: 'Market volatility, tighter funding conditions, and delayed liquidity response triggers',
    impact: 'Funding strain, management escalation, and possible disruption to planned business activity',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Liquidity buffer shortfall', category: 'Financial', source: 'dry-run', description: 'Available buffers may not cover the pace of cash outflows or collateral calls.' },
      { title: 'Treasury decision delay', category: 'Operational', source: 'dry-run', description: 'Escalation sequencing and approvals slow down the funding response.' },
      { title: 'Market confidence strain', category: 'Strategic', source: 'dry-run', description: 'Stakeholders may question resilience if the response appears reactive or fragmented.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'finance-payments-control-breakdown',
    functionKey: 'finance',
    title: 'Payments control breakdown enabling duplicate transfers',
    summary: 'Designed for controllership, finance operations, and payment integrity teams.',
    bestFor: 'Payment control, fraud, and remediation walkthroughs',
    nextStep: 'Load this to see how a finance-control issue becomes a loss, confidence, and remediation planning case.',
    promptLabel: 'Payment control failure',
    event: 'A payments workflow control fails and high-value transfers are released twice before the issue is detected.',
    asset: 'Payment approval workflow, finance operations controls, and treasury accounts',
    cause: 'Control design weakness, alert fatigue, and incomplete segregation checks',
    impact: 'Financial loss, recovery effort, and governance scrutiny',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Duplicate payment loss', category: 'Financial', source: 'dry-run', description: 'Transfer errors create direct financial exposure and recovery work.' },
      { title: 'Control assurance failure', category: 'Compliance', source: 'dry-run', description: 'Control breakdown weakens confidence in the finance operating model.' },
      { title: 'Management reporting gap', category: 'Governance', source: 'dry-run', description: 'Leaders need clear facts fast to decide on containment and communication.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'finance-close-delay',
    functionKey: 'finance',
    title: 'Quarter-close delay after a ledger control issue',
    summary: 'Useful for finance teams working through reporting deadlines and control dependency failures.',
    bestFor: 'Reporting, control, and executive-readiness walkthroughs',
    nextStep: 'Use this to model the downstream impact of a late reporting close and the actions needed to restore confidence.',
    promptLabel: 'Close delay',
    event: 'A ledger reconciliation control fails late in the reporting cycle and delays the quarter-close process.',
    asset: 'General ledger, close process controls, and finance reporting outputs',
    cause: 'Data quality issues, control exceptions, and slow escalation of reconciliation gaps',
    impact: 'Reporting delay, assurance pressure, and management intervention',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Financial reporting delay', category: 'Financial', source: 'dry-run', description: 'Close activities miss expected timelines and increase reporting risk.' },
      { title: 'Assurance confidence erosion', category: 'Compliance', source: 'dry-run', description: 'Confidence in the control environment weakens during remediation.' },
      { title: 'Decision support disruption', category: 'Operational', source: 'dry-run', description: 'Leadership receives late or incomplete reporting for management decisions.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'finance-credit-loss-reserve',
    functionKey: 'finance',
    title: 'Credit loss reserve shortfall after a portfolio deterioration signal',
    summary: 'Good for finance, risk, and controllership users balancing model risk with management response.',
    bestFor: 'Provisioning, portfolio risk, and governance walkthroughs',
    nextStep: 'Load this when you want a finance-heavy case that is strategic and regulatory rather than cyber-led.',
    promptLabel: 'Reserve shortfall',
    event: 'A portfolio deterioration signal suggests credit loss reserves may be understated heading into a reporting and planning cycle.',
    asset: 'Credit portfolio analytics, reserve models, and finance planning assumptions',
    cause: 'Late risk signal recognition, model drift, and weak management challenge',
    impact: 'Provisioning gap, earnings pressure, and governance action',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'United States'],
    risks: [
      { title: 'Reserve adequacy risk', category: 'Financial', source: 'dry-run', description: 'Loss reserves may not reflect the true portfolio deterioration.' },
      { title: 'Model governance challenge', category: 'Compliance', source: 'dry-run', description: 'Management challenge and oversight may be weaker than expected.' },
      { title: 'Strategic capital planning strain', category: 'Strategic', source: 'dry-run', description: 'Reserve changes alter planning choices and management posture.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-single-source-shortfall',
    functionKey: 'procurement',
    title: 'Single-source supplier shortfall on a critical spend category',
    summary: 'Built for procurement teams managing concentration, sourcing continuity, and supplier fallback.',
    bestFor: 'Supplier concentration, continuity, and sourcing walkthroughs',
    nextStep: 'Use this when you want a procurement-led case with supply continuity, escalation, and contract action built in.',
    promptLabel: 'Single-source shortfall',
    event: 'A single-source supplier cannot meet a critical delivery commitment and no ready substitute is available in the current sourcing plan.',
    asset: 'Critical supplier contract, inbound material flow, and dependent operational plans',
    cause: 'Supplier capacity failure, weak contingency sourcing, and slow contract escalation',
    impact: 'Supply disruption, cost pressure, and executive intervention',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Critical supply disruption', category: 'Supply Chain', source: 'dry-run', description: 'A concentrated supplier dependency blocks timely delivery of key goods or services.' },
      { title: 'Contract leverage weakness', category: 'Procurement', source: 'dry-run', description: 'Commercial protections are not strong enough to support rapid remediation.' },
      { title: 'Operational backlog growth', category: 'Business Continuity', source: 'dry-run', description: 'Downstream plans slow down while replacement options are arranged.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-tender-integrity',
    functionKey: 'procurement',
    title: 'Tender integrity concern in a high-value sourcing round',
    summary: 'Useful for procurement, compliance, and governance users overseeing sourcing fairness and challenge.',
    bestFor: 'Tender integrity, governance, and escalation walkthroughs',
    nextStep: 'Load this when you want to assess the management response to a procurement fairness and control challenge.',
    promptLabel: 'Tender integrity',
    event: 'A high-value tender process shows signs of inconsistent evaluation and incomplete conflict-of-interest declarations.',
    asset: 'Strategic sourcing process, vendor evaluation controls, and procurement approvals',
    cause: 'Weak governance discipline, incomplete declarations, and rushed evaluation activity',
    impact: 'Challenge risk, contract delay, and governance scrutiny',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Sourcing fairness breach', category: 'Procurement', source: 'dry-run', description: 'Tender integrity concerns undermine confidence in the award process.' },
      { title: 'Compliance and challenge exposure', category: 'Compliance', source: 'dry-run', description: 'Formal challenge or review could delay award and create obligations.' },
      { title: 'Reputational procurement risk', category: 'Strategic', source: 'dry-run', description: 'Stakeholders may question the robustness of sourcing governance.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-sanctions-screening-gap',
    functionKey: 'procurement',
    title: 'Supplier onboarding proceeds with a sanctions screening gap',
    summary: 'A procurement and compliance example focused on onboarding controls and third-party exposure.',
    bestFor: 'Third-party onboarding, sanctions, and compliance walkthroughs',
    nextStep: 'Use this to see how supplier onboarding control gaps affect procurement, compliance, and executive decisions together.',
    promptLabel: 'Onboarding screening gap',
    event: 'A supplier onboarding workflow bypasses a sanctions screening step and procurement activity continues before the issue is identified.',
    asset: 'Supplier onboarding controls, screening workflow, and active sourcing requests',
    cause: 'Process workarounds, incomplete workflow automation, and weak exception monitoring',
    impact: 'Compliance exposure, sourcing delay, and urgent remediation',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Sanctions screening breach', category: 'Regulatory', source: 'dry-run', description: 'Third-party onboarding proceeds without a mandatory compliance control.' },
      { title: 'Supplier activation delay', category: 'Procurement', source: 'dry-run', description: 'Urgent remediation slows operational sourcing and contract start.' },
      { title: 'Management assurance gap', category: 'Compliance', source: 'dry-run', description: 'Leaders need confidence that no further onboarding exceptions exist.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-contract-cover-gap',
    functionKey: 'procurement',
    title: 'Critical service continues without adequate contract cover',
    summary: 'Tailored to procurement teams managing renewals, obligations, and service continuity.',
    bestFor: 'Contract governance, third-party continuity, and remediation walkthroughs',
    nextStep: 'Load this when you want a case that starts in procurement but ends in a broader service and governance decision.',
    promptLabel: 'Contract cover gap',
    event: 'A critical outsourced service continues under expired commercial terms while renewal negotiations and risk review remain incomplete.',
    asset: 'Critical service contract, renewal governance, and dependent service commitments',
    cause: 'Slow renewal process, incomplete obligation tracking, and weak escalation discipline',
    impact: 'Commercial exposure, service uncertainty, and management intervention',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Uncovered service obligation', category: 'Procurement', source: 'dry-run', description: 'The organisation carries service dependency without adequate contractual cover.' },
      { title: 'Third-party continuity strain', category: 'Third-Party', source: 'dry-run', description: 'Service continuity depends on weakly governed interim arrangements.' },
      { title: 'Commercial dispute exposure', category: 'Financial', source: 'dry-run', description: 'Unclear terms may increase cost, recovery, or dispute risk.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-monitoring-breach',
    functionKey: 'compliance',
    title: 'Monitoring control failure leaves a repeat compliance breach undetected',
    summary: 'Designed for compliance teams managing control monitoring and repeat findings.',
    bestFor: 'Monitoring, repeat findings, and remediation walkthroughs',
    nextStep: 'Use this to test how the platform handles recurring compliance issues and management challenge.',
    promptLabel: 'Monitoring failure',
    event: 'A compliance monitoring control fails to identify a repeat breach until the issue has already widened across multiple teams.',
    asset: 'Monitoring controls, issue tracking, and first-line compliance reporting',
    cause: 'Weak control design, incomplete ownership, and poor issue escalation',
    impact: 'Repeat breach, remediation pressure, and management challenge',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Repeat compliance breach', category: 'Compliance', source: 'dry-run', description: 'A known issue recurs because monitoring and escalation are not strong enough.' },
      { title: 'Regulatory scrutiny', category: 'Regulatory', source: 'dry-run', description: 'The organisation may need to explain why repeat remediation did not hold.' },
      { title: 'Control owner fatigue', category: 'Operational', source: 'dry-run', description: 'Teams struggle to remediate sustainably while current operations continue.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-obligations-map-gap',
    functionKey: 'compliance',
    title: 'Regulatory obligations mapping misses a new requirement',
    summary: 'Useful for compliance and legal teams updating obligations and control ownership.',
    bestFor: 'Obligations management, legal change, and governance walkthroughs',
    nextStep: 'Load this to explore how an obligations-mapping issue becomes a practical management decision problem.',
    promptLabel: 'Obligations gap',
    event: 'A new regulatory requirement is not fully captured in the obligations map and key control owners continue operating against the previous standard.',
    asset: 'Obligations inventory, control mapping, and business implementation plans',
    cause: 'Late rule interpretation, incomplete governance handoff, and weak update discipline',
    impact: 'Implementation gap, management remediation, and regulatory concern',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Requirement implementation gap', category: 'Compliance', source: 'dry-run', description: 'Teams are not working to the updated requirement set.' },
      { title: 'Control ownership ambiguity', category: 'Governance', source: 'dry-run', description: 'Responsibility for implementation and challenge is not clear enough.' },
      { title: 'Regulatory response risk', category: 'Regulatory', source: 'dry-run', description: 'A late fix may create disclosure, remediation, or supervisory pressure.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-recordkeeping-shortfall',
    functionKey: 'compliance',
    title: 'Recordkeeping controls fail during a supervisory request',
    summary: 'A compliance-heavy case focused on evidence readiness and control design.',
    bestFor: 'Evidence readiness, control assurance, and remediation walkthroughs',
    nextStep: 'Use this when you want a non-cyber example centred on evidence quality and governance readiness.',
    promptLabel: 'Recordkeeping shortfall',
    event: 'A supervisory request exposes that required records cannot be assembled quickly or completely from current systems and procedures.',
    asset: 'Recordkeeping controls, evidence stores, and regulatory response workflow',
    cause: 'Process fragmentation, weak retention discipline, and unclear ownership',
    impact: 'Response delay, supervisory concern, and remediation effort',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Evidence readiness failure', category: 'Compliance', source: 'dry-run', description: 'Required evidence is incomplete or slow to retrieve.' },
      { title: 'Supervisory confidence erosion', category: 'Regulatory', source: 'dry-run', description: 'Regulators may doubt the organisation’s control discipline.' },
      { title: 'Operational rework pressure', category: 'Operational', source: 'dry-run', description: 'Teams must reconstruct records while managing business-as-usual work.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-privacy-reuse',
    functionKey: 'compliance',
    title: 'Customer data is reused outside the intended consent basis',
    summary: 'Useful for privacy, compliance, and marketing-governance teams.',
    bestFor: 'Privacy, consent, and customer trust walkthroughs',
    nextStep: 'Load this to test a compliance-led scenario that still carries operational and reputational consequence.',
    promptLabel: 'Consent breakdown',
    event: 'Customer data is reused for a new purpose before teams confirm the required consent and control basis.',
    asset: 'Customer data, consent records, and downstream campaign or workflow logic',
    cause: 'Weak data-use governance, unclear control approvals, and rushed implementation',
    impact: 'Privacy exposure, remediation effort, and customer trust strain',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Consent governance breach', category: 'Compliance', source: 'dry-run', description: 'Data use proceeds without a strong enough legal or policy basis.' },
      { title: 'Regulatory inquiry exposure', category: 'Regulatory', source: 'dry-run', description: 'Data-use concerns may trigger reporting or supervisory attention.' },
      { title: 'Customer trust erosion', category: 'Strategic', source: 'dry-run', description: 'Stakeholders may react negatively once the misuse becomes visible.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-warehouse-automation',
    functionKey: 'operations',
    title: 'Warehouse automation outage disrupts fulfilment commitments',
    summary: 'Designed for operations leaders balancing service continuity, backlog, and recovery.',
    bestFor: 'Operations, backlog, and continuity walkthroughs',
    nextStep: 'Use this when you want an operational disruption case rather than a cyber-first incident.',
    promptLabel: 'Automation outage',
    event: 'A warehouse automation platform fails during a peak period and manual workarounds cannot keep pace with outbound demand.',
    asset: 'Warehouse automation systems, fulfilment workflows, and customer commitments',
    cause: 'Platform failure, weak manual fallback capacity, and delayed recovery coordination',
    impact: 'Backlog growth, customer delay, and management escalation',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Operational backlog growth', category: 'Operational', source: 'dry-run', description: 'Backlog rises faster than teams can clear it using fallback processes.' },
      { title: 'Service commitment breach', category: 'Business Continuity', source: 'dry-run', description: 'Customer obligations slip during the outage period.' },
      { title: 'Recovery coordination shortfall', category: 'Operational', source: 'dry-run', description: 'Recovery decisions and sequencing are less mature than expected.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-workforce-availability',
    functionKey: 'operations',
    title: 'Workforce availability shortfall during a critical operating window',
    summary: 'A practical operational case for service, field, and support teams.',
    bestFor: 'Workforce resilience, continuity, and escalation walkthroughs',
    nextStep: 'Load this when you want to model how people dependency and continuity planning affect the scenario.',
    promptLabel: 'Workforce shortfall',
    event: 'A sudden workforce availability shortfall hits a critical operating window and service delivery falls behind committed levels.',
    asset: 'Front-line operations teams, shift planning, and dependent service workflows',
    cause: 'Absence spike, thin contingency coverage, and weak prioritisation rules',
    impact: 'Service degradation, backlog, and urgent management intervention',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Service delivery degradation', category: 'Operational', source: 'dry-run', description: 'Front-line service performance falls below expected levels.' },
      { title: 'Continuity staffing weakness', category: 'Business Continuity', source: 'dry-run', description: 'Fallback staffing and role coverage prove weaker than expected.' },
      { title: 'Customer escalation pressure', category: 'Commercial', source: 'dry-run', description: 'Customers escalate when service delays persist.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-utilities-interruption',
    functionKey: 'operations',
    title: 'Utilities interruption exposes recovery planning shortfalls',
    summary: 'Built for resilience and operations teams managing facility and service dependencies.',
    bestFor: 'Continuity, recovery, and dependency walkthroughs',
    nextStep: 'Use this to test recovery discipline where the trigger is physical or operational rather than cyber.',
    promptLabel: 'Utilities interruption',
    event: 'A utilities interruption affects a critical operating site and recovery plans do not restore service within the expected timeline.',
    asset: 'Critical site operations, continuity runbooks, and dependent customer services',
    cause: 'Infrastructure outage, weak dependency mapping, and under-tested recovery playbooks',
    impact: 'Service delay, management escalation, and continuity strain',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Continuity plan shortfall', category: 'Business Continuity', source: 'dry-run', description: 'Recovery and fallback plans do not restore service quickly enough.' },
      { title: 'Dependent service outage', category: 'Operational', source: 'dry-run', description: 'Downstream services remain constrained while site recovery continues.' },
      { title: 'Executive recovery decision pressure', category: 'Governance', source: 'dry-run', description: 'Leadership needs to decide on interim service posture and escalation.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-dispatch-backlog',
    functionKey: 'operations',
    title: 'Dispatch backlog builds after a planning system disruption',
    summary: 'Useful for service operations teams handling scheduling, dispatch, and customer impact.',
    bestFor: 'Service operations, backlog, and treatment-planning walkthroughs',
    nextStep: 'Load this when you want an operational case with a clear treatment and recovery story.',
    promptLabel: 'Dispatch backlog',
    event: 'A planning and dispatch system disruption causes field work to be scheduled manually and service commitments quickly fall behind.',
    asset: 'Planning system, dispatch coordination, and field service commitments',
    cause: 'System disruption, manual-workaround overload, and weak exception triage',
    impact: 'Missed appointments, backlog growth, and customer dissatisfaction',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Dispatch coordination failure', category: 'Operational', source: 'dry-run', description: 'Manual scheduling cannot maintain expected dispatch discipline.' },
      { title: 'Customer appointment breach', category: 'Commercial', source: 'dry-run', description: 'Customer commitments are missed while planning remains degraded.' },
      { title: 'Recovery prioritisation gap', category: 'Business Continuity', source: 'dry-run', description: 'Teams lack a clear rule set for restoring the highest-value work first.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-identity-takeover',
    functionKey: 'technology',
    title: 'Privileged identity takeover affecting shared platforms',
    summary: 'Helpful for identity, control, and rapid containment walkthroughs.',
    bestFor: 'Identity, access, fraud, and executive-visibility walkthroughs',
    nextStep: 'Use this to see how one privileged identity event can become both a technology and continuity problem.',
    promptLabel: 'Identity takeover',
    event: 'A privileged identity is compromised and used to access shared cloud and productivity platforms.',
    asset: 'Privileged identity tier, shared collaboration services, and cloud administration consoles',
    cause: 'Credential theft, session hijack, and weak privileged-access recovery processes',
    impact: 'Administrative misuse, fraud potential, service disruption, and urgent containment activity',
    urgency: 'critical',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Privileged account misuse', category: 'Cyber', source: 'dry-run', description: 'Administrative access is used to change controls or access sensitive systems.' },
      { title: 'Fraud or payment manipulation', category: 'Financial', source: 'dry-run', description: 'Mailbox or workflow access creates financial manipulation risk.' },
      { title: 'Containment-driven disruption', category: 'Business Continuity', source: 'dry-run', description: 'Emergency containment actions disrupt shared business services.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-cloud-exposure',
    functionKey: 'technology',
    title: 'Cloud misconfiguration exposing sensitive data',
    summary: 'Useful for privacy, security, and legal-impact walkthroughs.',
    bestFor: 'Privacy, legal, and notification-impact walkthroughs',
    nextStep: 'Use this to see how a common cloud-control failure turns into regulatory, customer, and response-cost estimates in the next steps.',
    promptLabel: 'Cloud exposure',
    event: 'A cloud storage configuration error exposes sensitive data to unauthorised parties after a routine deployment change.',
    asset: 'Cloud data store containing customer, employee, and operational records',
    cause: 'Misconfiguration, weak change control, and delayed exposure detection',
    impact: 'Data exposure, legal obligations, customer notification, and trust impact',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Sensitive data exposure', category: 'Cyber', source: 'dry-run', description: 'Sensitive records become accessible outside intended controls.' },
      { title: 'Regulatory notification breach', category: 'Compliance', source: 'dry-run', description: 'Notification and remediation obligations increase quickly.' },
      { title: 'Customer trust erosion', category: 'Strategic', source: 'dry-run', description: 'Customer and partner confidence is strained once the exposure becomes public.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-ransomware-services',
    functionKey: 'technology',
    title: 'Ransomware disrupting core business services',
    summary: 'Helpful for service interruption and recovery modelling.',
    bestFor: 'Outage, recovery, and business interruption walkthroughs',
    nextStep: 'Continue after loading to see how the platform frames recovery cost, service dependency, and management action in a severe outage case.',
    promptLabel: 'Ransomware outage',
    event: 'A ransomware event disrupts core business services and slows operational recovery across shared support teams.',
    asset: 'Core business systems, shared files, service operations, and customer-support workflows',
    cause: 'Phishing-led compromise, privilege escalation, and weak endpoint containment',
    impact: 'Business interruption, recovery cost, customer-service degradation, and executive escalation',
    urgency: 'critical',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Critical service outage', category: 'Business Continuity', source: 'dry-run', description: 'Essential services are unavailable during containment and recovery.' },
      { title: 'Recovery cost escalation', category: 'Financial', source: 'dry-run', description: 'Recovery, response, and overtime costs rise quickly.' },
      { title: 'Customer backlog growth', category: 'Operational', source: 'dry-run', description: 'Service backlog and missed commitments build while systems remain constrained.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-release-failure',
    functionKey: 'technology',
    title: 'Critical release failure breaks a shared digital service',
    summary: 'A technology operations example focused on change risk and service recovery.',
    bestFor: 'Change management, release risk, and continuity walkthroughs',
    nextStep: 'Load this when you want a technology-led example that is operationally heavy but not a cyber intrusion case.',
    promptLabel: 'Release failure',
    event: 'A major release introduces a fault into a shared digital service and rollback steps do not restore stability quickly enough.',
    asset: 'Shared digital service, release pipeline, and dependent customer journeys',
    cause: 'Release defect, incomplete rollback readiness, and weak deployment guardrails',
    impact: 'Service instability, recovery effort, and management escalation',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Change-induced outage', category: 'Operational', source: 'dry-run', description: 'Release activity directly destabilises a critical service.' },
      { title: 'Rollback preparedness gap', category: 'Business Continuity', source: 'dry-run', description: 'Rollback plans do not restore service as expected.' },
      { title: 'Customer service disruption', category: 'Commercial', source: 'dry-run', description: 'Customer-facing journeys remain degraded while recovery continues.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-market-entry-delay',
    functionKey: 'strategic',
    title: 'A strategic market entry stalls after key dependencies slip',
    summary: 'Designed for strategy and transformation teams managing execution risk and value erosion.',
    bestFor: 'Strategy execution, dependency, and escalation walkthroughs',
    nextStep: 'Use this when the scenario is primarily strategic and execution-led rather than operationally tactical.',
    promptLabel: 'Market entry delay',
    event: 'A strategic market entry programme falls behind after regulatory, supplier, and operating dependencies slip at the same time.',
    asset: 'Market entry plan, investment case, and launch-critical dependencies',
    cause: 'Execution delays, weak dependency governance, and late management challenge',
    impact: 'Value erosion, delay cost, and executive reprioritisation',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Strategic delivery slippage', category: 'Strategic', source: 'dry-run', description: 'The programme misses critical milestones against the strategic plan.' },
      { title: 'Dependency governance weakness', category: 'Operational', source: 'dry-run', description: 'Key dependencies are not owned or escalated strongly enough.' },
      { title: 'Investment-case erosion', category: 'Financial', source: 'dry-run', description: 'Delay and rework weaken the expected value case.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-partnership-underperformance',
    functionKey: 'strategic',
    title: 'A major partnership underperforms after go-live',
    summary: 'Useful for leaders testing strategic dependency, commercial impact, and response options.',
    bestFor: 'Partnership, strategic dependency, and management-action walkthroughs',
    nextStep: 'Load this to assess a case where the issue is strategic performance rather than a discrete cyber or control incident.',
    promptLabel: 'Partnership underperformance',
    event: 'A flagship strategic partnership underperforms after launch and key growth and service assumptions no longer look credible.',
    asset: 'Strategic partnership model, joint operating plan, and growth commitments',
    cause: 'Weak assumptions, dependency misalignment, and slow governance response',
    impact: 'Strategic value loss, reputational strain, and leadership intervention',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'United States'],
    risks: [
      { title: 'Strategic value erosion', category: 'Strategic', source: 'dry-run', description: 'The partnership no longer supports the expected business case.' },
      { title: 'Commercial performance shortfall', category: 'Financial', source: 'dry-run', description: 'Commercial outcomes fall behind what was committed.' },
      { title: 'Governance response delay', category: 'Governance', source: 'dry-run', description: 'Leadership decisions do not adapt quickly enough to changed facts.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-transformation-drift',
    functionKey: 'strategic',
    title: 'Transformation programme drift weakens the target operating model',
    summary: 'Built for strategic and enterprise-change users managing programme coherence.',
    bestFor: 'Transformation, operating model, and steering walkthroughs',
    nextStep: 'Use this when you need a more enterprise-wide, strategic lens than a local operational incident.',
    promptLabel: 'Transformation drift',
    event: 'A multi-year transformation programme drifts away from its target operating model and benefits case while delivery continues.',
    asset: 'Transformation roadmap, target operating model, and dependent business change plans',
    cause: 'Scope drift, inconsistent governance, and weak benefit challenge',
    impact: 'Delivery confusion, benefit erosion, and leadership reset pressure',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Operating model inconsistency', category: 'Strategic', source: 'dry-run', description: 'The intended future-state model no longer matches delivery choices.' },
      { title: 'Benefit realisation shortfall', category: 'Financial', source: 'dry-run', description: 'The programme may not deliver the value that justified investment.' },
      { title: 'Change fatigue and execution strain', category: 'Operational', source: 'dry-run', description: 'Teams absorb change without enough clarity or prioritisation.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-product-quality-crisis',
    functionKey: 'strategic',
    title: 'Product quality concerns threaten a flagship launch',
    summary: 'A strategic case linking quality signals, brand risk, and launch decisions.',
    bestFor: 'Strategic launch, quality, and decision-memo walkthroughs',
    nextStep: 'Load this when you want a strategic scenario that still leads to concrete management action choices.',
    promptLabel: 'Launch quality risk',
    event: 'Quality concerns emerge shortly before a flagship launch and leadership must decide whether to pause, contain, or proceed.',
    asset: 'Flagship product launch, quality assurance evidence, and market commitments',
    cause: 'Late defect signals, weak challenge of launch assumptions, and limited contingency planning',
    impact: 'Launch delay risk, brand impact, and executive decision pressure',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Strategic launch decision risk', category: 'Strategic', source: 'dry-run', description: 'Leadership must decide under uncertainty with high visible downside.' },
      { title: 'Reputational brand impact', category: 'Strategic', source: 'dry-run', description: 'A weak launch decision could affect external confidence materially.' },
      { title: 'Operational contingency gap', category: 'Operational', source: 'dry-run', description: 'Fallback plans for a delayed or phased launch are not mature enough.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-contractor-safety-incident',
    functionKey: 'hse',
    title: 'A contractor safety incident halts activity at a critical site',
    summary: 'Designed for HSE and operations leaders managing workforce safety and continuity together.',
    bestFor: 'Safety, incident response, and continuity walkthroughs',
    nextStep: 'Use this when the scenario needs an HSE lens first, with operational and governance consequences following.',
    promptLabel: 'Safety incident',
    event: 'A contractor safety incident at a critical site triggers an immediate work stoppage and formal investigation.',
    asset: 'Critical operating site, contractor activity, and safety management controls',
    cause: 'Unsafe work conditions, weak permit discipline, and incomplete contractor oversight',
    impact: 'Work stoppage, investigation burden, and leadership action',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Workplace safety incident', category: 'HSE', source: 'dry-run', description: 'Safety controls fail to prevent a serious contractor incident.' },
      { title: 'Operational stoppage', category: 'Business Continuity', source: 'dry-run', description: 'Critical activity pauses while the site is made safe and investigated.' },
      { title: 'Regulatory investigation pressure', category: 'Regulatory', source: 'dry-run', description: 'External scrutiny may follow a visible safety incident.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-environmental-release',
    functionKey: 'hse',
    title: 'An environmental release from logistics handling prompts urgent containment',
    summary: 'Useful for HSE, supply chain, and operations teams managing environmental response.',
    bestFor: 'Environmental, third-party, and response-governance walkthroughs',
    nextStep: 'Load this to test how environmental containment and service continuity interact under pressure.',
    promptLabel: 'Environmental release',
    event: 'A third-party logistics handling failure causes an environmental release that requires containment and reporting.',
    asset: 'Logistics operation, environmental controls, and dependent service commitments',
    cause: 'Handling failure, weak oversight, and slow incident escalation',
    impact: 'Containment effort, operational disruption, and compliance exposure',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Environmental control breach', category: 'HSE', source: 'dry-run', description: 'Environmental protections fail during outsourced activity.' },
      { title: 'Third-party oversight gap', category: 'Third-Party', source: 'dry-run', description: 'Third-party controls are not governed strongly enough.' },
      { title: 'Operational recovery pressure', category: 'Business Continuity', source: 'dry-run', description: 'Operations remain constrained while containment proceeds.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-heat-stress-operations',
    functionKey: 'hse',
    title: 'Heat-stress exposure disrupts field operations during a critical window',
    summary: 'Tailored to HSE and operations users dealing with field safety and productivity together.',
    bestFor: 'Field safety, planning, and workforce continuity walkthroughs',
    nextStep: 'Use this when you need a people-and-safety scenario rather than a technology or supplier event.',
    promptLabel: 'Heat-stress disruption',
    event: 'Extreme conditions increase heat-stress exposure in field operations and work plans must be curtailed during a critical delivery window.',
    asset: 'Field workforce, shift plans, and critical outdoor operating activity',
    cause: 'Extreme conditions, weak exposure controls, and thin operational contingency',
    impact: 'Safety risk, work slowdown, and delivery pressure',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Worker safety exposure', category: 'HSE', source: 'dry-run', description: 'Current controls do not reduce field exposure enough for safe work.' },
      { title: 'Operational capacity reduction', category: 'Operational', source: 'dry-run', description: 'Safe operating limits reduce available delivery capacity.' },
      { title: 'Service commitment pressure', category: 'Commercial', source: 'dry-run', description: 'Customers may feel the impact while safe work rules are enforced.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-fire-system-impairment',
    functionKey: 'hse',
    title: 'A fire and life safety system impairment weakens site readiness',
    summary: 'A continuity and safety example for facilities, HSE, and site operations leaders.',
    bestFor: 'Facility safety, continuity, and remediation walkthroughs',
    nextStep: 'Load this to assess how a safety impairment changes the operating posture and decision thresholds for a site.',
    promptLabel: 'Life safety impairment',
    event: 'A fire and life safety system impairment remains unresolved longer than expected at a site that supports critical operations.',
    asset: 'Life safety systems, site readiness controls, and critical facility operations',
    cause: 'Maintenance failure, delayed remediation, and weak escalation of the residual risk',
    impact: 'Reduced site readiness, operating constraints, and management action',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Life safety readiness gap', category: 'HSE', source: 'dry-run', description: 'The site is operating with weaker life safety assurance than intended.' },
      { title: 'Operating restriction pressure', category: 'Business Continuity', source: 'dry-run', description: 'Operations may need to be reduced or reconfigured until remediation completes.' },
      { title: 'Governance escalation need', category: 'Governance', source: 'dry-run', description: 'Leadership must decide whether the residual risk is still acceptable.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'supplier-platform-outage',
    functionKey: 'general',
    title: 'Supplier outage on a regulated platform',
    summary: 'Good first example for third-party and resilience risk.',
    bestFor: 'Third-party, resilience, and escalation walkthroughs',
    nextStep: 'Review the starter risks, then continue to see how the platform turns a supplier resilience issue into linked loss and management actions.',
    promptLabel: 'Supplier outage',
    event: 'A critical supplier with privileged access is compromised and disrupts a regulated digital platform during a peak operating period.',
    asset: 'Customer-facing regulated platform, supplier integration layer, and dependent support workflows',
    cause: 'Supplier compromise leading to service disruption, delayed response, and uncertain recovery sequencing',
    impact: 'Service outage, customer disruption, manual-workaround strain, and regulatory scrutiny',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Third-party service disruption', category: 'Third-Party', source: 'dry-run', description: 'Supplier dependency leads to a material service outage.' },
      { title: 'Regulatory reporting delay', category: 'Compliance', source: 'dry-run', description: 'Incident handling delays increase regulatory exposure.' },
      { title: 'Manual recovery backlog', category: 'Business Continuity', source: 'dry-run', description: 'Fallback operations create sustained pressure on service teams and restoration priorities.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'dc-recovery-failure',
    functionKey: 'general',
    title: 'Data centre recovery shortfall during a critical outage',
    summary: 'Useful for resilience, continuity, and executive recovery planning walkthroughs.',
    bestFor: 'Resilience, continuity, and treatment-planning walkthroughs',
    nextStep: 'Load this when you want a continuity-heavy case that tests recovery capability more than a pure cyber intrusion.',
    promptLabel: 'Recovery shortfall',
    event: 'A critical hosting location suffers a prolonged outage and recovery does not meet the expected service timeline.',
    asset: 'Primary hosting environment, recovery runbooks, and customer-facing digital services',
    cause: 'Facility or infrastructure failure combined with weak recovery preparedness',
    impact: 'Extended outage, backlog growth, contract pressure, and management scrutiny',
    urgency: 'critical',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Recovery capability shortfall', category: 'Business Continuity', source: 'dry-run', description: 'Recovery dependencies are slower or weaker than assumed.' },
      { title: 'Contractual service breach', category: 'Commercial', source: 'dry-run', description: 'Customer commitments are missed during a prolonged outage.' },
      { title: 'Executive escalation pressure', category: 'Governance', source: 'dry-run', description: 'Leadership needs to decide on interim service, communication, and investment actions.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'ai-model-governance-failure',
    functionKey: 'technology',
    lensKey: 'ai-model-risk',
    lensLabel: 'AI / model risk',
    title: 'AI assistant gives unsafe regulated guidance at scale',
    summary: 'Useful for responsible AI, model-governance, and human-override assurance reviews.',
    bestFor: 'Responsible AI and model-risk walkthroughs',
    nextStep: 'Load this when you want a scenario that links model behaviour, governance assurance, and downstream regulatory exposure.',
    promptLabel: 'Responsible AI drift',
    event: 'A generative AI assistant starts producing unsafe or non-compliant guidance across a regulated workflow.',
    asset: 'The customer-facing AI assistant, approval controls, and model-governance workflow',
    cause: 'Weak model guardrails, limited human oversight, and poor monitoring of drift or unsafe outputs',
    impact: 'Regulatory scrutiny, customer harm, rework cost, and loss of trust in AI-enabled operations',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Europe'],
    risks: [
      { title: 'Responsible AI governance breakdown', category: 'AI / Model Risk', source: 'dry-run', description: 'The model can produce unsafe or non-compliant outputs without timely human intervention.' },
      { title: 'Model monitoring and assurance shortfall', category: 'AI / Model Risk', source: 'dry-run', description: 'Weak drift detection and challenge routines leave management blind to deteriorating output quality.' },
      { title: 'Regulatory or conduct exposure from AI-enabled decisions', category: 'Compliance', source: 'dry-run', description: 'The organisation may face challenge over how AI outputs were governed and reviewed.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'data-governance-retention-failure',
    functionKey: 'compliance',
    lensKey: 'data-governance',
    lensLabel: 'Data governance / privacy',
    title: 'Sensitive data is reused beyond approved purpose in a shared data lake',
    summary: 'Useful for privacy, data-governance, retention, and data-lineage challenge sessions.',
    bestFor: 'Data governance and privacy walkthroughs',
    nextStep: 'Load this when you want a scenario about consent, retention, lineage, or cross-use of sensitive data rather than a classic breach event.',
    promptLabel: 'Data governance lapse',
    event: 'Sensitive customer and employee data is retained and reused in a shared analytics environment beyond the approved purpose.',
    asset: 'The shared data lake, lineage controls, consent records, and access governance workflow',
    cause: 'Weak retention enforcement, unclear data ownership, and poor lineage between source systems and analytics use',
    impact: 'Privacy challenge, remediation cost, supervisory scrutiny, and lower confidence in downstream analytics',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Europe'],
    risks: [
      { title: 'Data-governance and lineage-control failure', category: 'Data Governance', source: 'dry-run', description: 'Management cannot show that sensitive data use remains within approved retention and purpose boundaries.' },
      { title: 'Privacy and cross-border handling exposure', category: 'Regulatory', source: 'dry-run', description: 'Supervisors may challenge how the organisation governed personal data reuse and residency.' },
      { title: 'Analytics and reporting decisions built on weak data controls', category: 'Operational', source: 'dry-run', description: 'Poor data lineage can undermine confidence in the outputs built on the affected dataset.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'fraud-integrity-payment-collusion',
    functionKey: 'finance',
    lensKey: 'fraud-integrity',
    lensLabel: 'Fraud / integrity',
    title: 'False invoices and approval collusion distort payments on a critical supplier account',
    summary: 'Useful for fraud, integrity, financial-crime, and control-breakdown discussions.',
    bestFor: 'Fraud and control-integrity walkthroughs',
    nextStep: 'Load this when you want a finance-led scenario that focuses on collusion, override, and recovery pressure rather than generic financial volatility.',
    promptLabel: 'Fraud and integrity',
    event: 'False invoices are approved on a critical supplier account after collusion between an internal approver and an external counterparty.',
    asset: 'The accounts-payable workflow, vendor master controls, and approval chain',
    cause: 'Weak segregation of duties, poor exception monitoring, and collusive override of payment controls',
    impact: 'Direct financial loss, investigation cost, recovery pressure, and possible financial-crime scrutiny',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Fraud and integrity breakdown in payment approvals', category: 'Fraud / Integrity', source: 'dry-run', description: 'Controls designed to prevent collusive payment release are bypassed or weakly challenged.' },
      { title: 'Financial-crime or anti-bribery investigation exposure', category: 'Compliance', source: 'dry-run', description: 'The pattern may trigger formal review of gifts, collusion, corruption, or money-flow controls.' },
      { title: 'Recovery and liquidity pressure after delayed detection', category: 'Financial', source: 'dry-run', description: 'Late discovery makes recovery harder and increases downstream commercial disruption.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'legal-contract-ip-dispute',
    functionKey: 'compliance',
    lensKey: 'legal-contract',
    lensLabel: 'Legal / contract',
    title: 'A strategic technology partner challenges IP ownership and indemnity after a major build',
    summary: 'Useful for contract, litigation, indemnity, and IP-rights challenge scenarios.',
    bestFor: 'Legal, contract, and commercial-governance walkthroughs',
    nextStep: 'Load this when you want a scenario about contractual rights, indemnity, and dispute posture rather than a pure compliance breach.',
    promptLabel: 'Contract and IP dispute',
    event: 'A strategic technology partner challenges IP ownership and indemnity commitments after a major joint build.',
    asset: 'The partnership agreement, IP clauses, delivery milestones, and dependent product roadmap',
    cause: 'Ambiguous contract drafting, weak governance over changes, and misaligned expectations over deliverables and rights',
    impact: 'Legal cost, delayed delivery, contract strain, and pressure on product or market commitments',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'United States'],
    risks: [
      { title: 'Contractual dispute over indemnity or delivery obligations', category: 'Legal / Contract', source: 'dry-run', description: 'The commercial relationship may escalate into formal dispute over ownership, scope, or remedy rights.' },
      { title: 'Intellectual-property or licensing exposure', category: 'Legal / Contract', source: 'dry-run', description: 'Ownership, reuse, or licensing terms may not support the current product or operating assumptions.' },
      { title: 'Programme delay from unresolved partner obligations', category: 'Strategic', source: 'dry-run', description: 'The dispute can slow product delivery and undermine the intended business case.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'geopolitical-market-access-shift',
    functionKey: 'strategic',
    lensKey: 'geopolitical',
    lensLabel: 'Geopolitical / market access',
    title: 'New export and market-access restrictions disrupt a priority expansion plan',
    summary: 'Useful for geopolitical, sanctions, sovereign, and market-access decisions.',
    bestFor: 'Geopolitical and cross-border strategy walkthroughs',
    nextStep: 'Load this when you want a scenario about sovereign restrictions, export controls, or market-access pressure rather than generic competition risk.',
    promptLabel: 'Market-access restriction',
    event: 'New export and market-access restrictions disrupt a priority expansion plan and limit access to critical technology inputs.',
    asset: 'The expansion programme, key supplier relationships, and target-market operating plan',
    cause: 'Geopolitical restrictions, sovereign policy shifts, and tighter cross-border approvals',
    impact: 'Delayed market entry, stranded investment, supplier disruption, and executive reprioritisation',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'United States', 'Europe'],
    risks: [
      { title: 'Geopolitical or sanctions-driven market-access exposure', category: 'Geopolitical', source: 'dry-run', description: 'Policy shifts can block planned expansion, supplier access, or deployment rights in a priority market.' },
      { title: 'Export-control dependency on restricted technology inputs', category: 'Regulatory', source: 'dry-run', description: 'Critical components, tooling, or capabilities may become harder to source or deploy lawfully.' },
      { title: 'Strategic value erosion from delayed expansion timing', category: 'Strategic', source: 'dry-run', description: 'The business case weakens as approvals, supplier certainty, and market timing deteriorate.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'physical-security-site-breach',
    functionKey: 'operations',
    lensKey: 'physical-security',
    lensLabel: 'Physical security',
    title: 'A facilities access-control lapse exposes an executive visit and a critical site',
    summary: 'Useful for facilities, physical security, and executive-protection response planning.',
    bestFor: 'Physical security and facilities walkthroughs',
    nextStep: 'Load this when you want a scenario about perimeter, site, and travel-security controls rather than digital compromise.',
    promptLabel: 'Physical security lapse',
    event: 'A facilities access-control lapse exposes an executive visit and a critical operating site to unauthorised physical access.',
    asset: 'The site perimeter, visitor-management controls, and executive movement plan',
    cause: 'Weak badge controls, contractor access gaps, and poor coordination between site and executive-protection teams',
    impact: 'Safety risk, operational disruption, investigative cost, and leadership concern over site security posture',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Physical-security control breakdown at a critical site', category: 'Physical Security', source: 'dry-run', description: 'Weak perimeter or access controls allow unauthorised entry into a sensitive operating environment.' },
      { title: 'Facilities disruption from incident response or site lockdown', category: 'Operational', source: 'dry-run', description: 'The event can interrupt operations while access, investigation, and remediation are stabilised.' },
      { title: 'Executive-protection and leadership assurance exposure', category: 'Physical Security', source: 'dry-run', description: 'Leadership confidence can fall quickly when executive movement and site controls are not aligned.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'ot-site-systems-failure',
    functionKey: 'operations',
    lensKey: 'ot-resilience',
    lensLabel: 'OT / site resilience',
    title: 'A site-systems change breaks visibility across critical OT controls',
    summary: 'Useful for industrial-control, facilities-technology, and site-resilience scenarios.',
    bestFor: 'OT and industrial-resilience walkthroughs',
    nextStep: 'Load this when you want a scenario that sits between cyber, operations, safety, and continuity at a physical site.',
    promptLabel: 'OT resilience gap',
    event: 'A network or control-system change breaks visibility across critical OT controls at a high-value site.',
    asset: 'Industrial control systems, site telemetry, and recovery procedures',
    cause: 'Weak change governance, poor segregation between IT and OT, and limited fallback monitoring',
    impact: 'Operational instability, safety concern, recovery effort, and reduced confidence in site resilience',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'OT resilience failure across critical site systems', category: 'OT Resilience', source: 'dry-run', description: 'The site may no longer have reliable visibility or control over critical industrial processes.' },
      { title: 'Operational disruption during manual fallback or isolation', category: 'Operational', source: 'dry-run', description: 'Recovery may require degraded operation, manual checks, or production slowdown.' },
      { title: 'Safety or shutdown escalation from unstable site controls', category: 'HSE', source: 'dry-run', description: 'If control confidence drops further, management may face stop-work or shutdown decisions.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'people-workforce-labour-pressure',
    functionKey: 'hse',
    lensKey: 'people-workforce',
    lensLabel: 'People / workforce',
    title: 'Unsafe staffing levels and contractor churn begin to threaten safe operations',
    summary: 'Useful for workforce, labour-practice, fatigue, and safe-operations discussions.',
    bestFor: 'People-risk and workforce-pressure walkthroughs',
    nextStep: 'Load this when you want a scenario about staffing, fatigue, labour welfare, or key-person dependency rather than only site-safety controls.',
    promptLabel: 'Workforce pressure',
    event: 'Unsafe staffing levels and contractor churn begin to threaten safe operations at a critical site.',
    asset: 'The operating roster, contractor workforce, and shift-critical control activities',
    cause: 'Attrition, fatigue, weak contractor coverage, and delayed escalation of staffing pressure',
    impact: 'Higher error risk, wellbeing concern, continuity strain, and leadership pressure to intervene',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'People and workforce resilience shortfall', category: 'People / Workforce', source: 'dry-run', description: 'The workforce model may no longer support safe, reliable, or sustainable delivery.' },
      { title: 'Labour-welfare or human-rights assurance concern', category: 'ESG', source: 'dry-run', description: 'Staffing pressure can expose weak welfare, supervision, or contractor-management practices.' },
      { title: 'Operational continuity risk from unsafe coverage levels', category: 'Operational', source: 'dry-run', description: 'The business may struggle to maintain service or site stability without intervention.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'investment-jv-integration-risk',
    functionKey: 'strategic',
    lensKey: 'investment-jv',
    lensLabel: 'Investment / JV',
    title: 'A planned acquisition reveals governance and integration gaps that threaten deal value',
    summary: 'Useful for M&A, JV, and integration-thesis challenge scenarios.',
    bestFor: 'Investment and integration walkthroughs',
    nextStep: 'Load this when you want a scenario about deal value, governance quality, and integration readiness rather than generic market risk.',
    promptLabel: 'M&A and JV risk',
    event: 'A planned acquisition reveals governance and integration gaps that threaten the expected deal value.',
    asset: 'The deal thesis, integration plan, and shared control environment',
    cause: 'Weak diligence over controls, unclear operating-model assumptions, and delayed integration planning',
    impact: 'Value erosion, delayed synergies, management distraction, and pressure on investor confidence',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'Europe'],
    risks: [
      { title: 'Investment or JV thesis erosion', category: 'Investment / JV', source: 'dry-run', description: 'The expected value of the transaction may weaken materially once integration assumptions are challenged.' },
      { title: 'Governance and control mismatch after deal close', category: 'Strategic', source: 'dry-run', description: 'A weak post-close control model can create costly surprises in execution and assurance.' },
      { title: 'Integration delay or synergy slippage', category: 'Transformation Delivery', source: 'dry-run', description: 'Management may need to reset the timetable, benefits, or operating model for the deal.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'transformation-delivery-slip',
    functionKey: 'strategic',
    lensKey: 'transformation-delivery',
    lensLabel: 'Transformation delivery',
    title: 'A major transformation programme slips after weak dependency control and unclear ownership',
    summary: 'Useful for programme-delivery, milestone, and benefits-realisation discussions.',
    bestFor: 'Transformation and programme walkthroughs',
    nextStep: 'Load this when you want a scenario about delivery execution, dependencies, and governance rather than generic strategic downside.',
    promptLabel: 'Programme slippage',
    event: 'A major transformation programme slips after weak dependency control and unclear ownership across workstreams.',
    asset: 'The transformation roadmap, milestone controls, and dependent operating changes',
    cause: 'Unclear decision rights, weak programme controls, and late escalation of dependency slippage',
    impact: 'Missed milestones, rising cost, delayed benefits, and loss of confidence in the change programme',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Transformation-delivery control failure', category: 'Transformation Delivery', source: 'dry-run', description: 'The programme may no longer have enough governance discipline to deliver the intended outcomes on time.' },
      { title: 'Strategic value erosion from delayed execution', category: 'Strategic', source: 'dry-run', description: 'Benefits, market timing, or operating improvements weaken as the programme slips.' },
      { title: 'Operational strain from unmanaged transition dependencies', category: 'Operational', source: 'dry-run', description: 'Workarounds and parallel operations create additional pressure while the programme is delayed.' }
    ]
  })
];

STEP1_DRY_RUN_SCENARIOS.sort((left, right) => {
  const preferredDefaultOrder = {
    'supplier-platform-outage': 0,
    'dc-recovery-failure': 1
  };
  const leftRank = Object.prototype.hasOwnProperty.call(preferredDefaultOrder, left?.id) ? preferredDefaultOrder[left.id] : Number.MAX_SAFE_INTEGER;
  const rightRank = Object.prototype.hasOwnProperty.call(preferredDefaultOrder, right?.id) ? preferredDefaultOrder[right.id] : Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return String(left.title || '').localeCompare(String(right.title || ''));
});

function buildDryRunNarrative(example) {
  return composeGuidedNarrative({
    event: example.event,
    asset: example.asset,
    cause: example.cause,
    impact: example.impact,
    urgency: example.urgency
  }, {
    lensKey: example.lensKey || STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey]?.key || '',
    lensLabel: example.lensLabel || STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey]?.label || ''
  });
}

function getLoadedDryRunScenario(draft = AppState.draft) {
  const loadedId = draft?.loadedDryRunId;
  const availableExamples = getStep1ExampleExperienceModel(getEffectiveSettings(), draft).availableExamples || [];
  const matched = availableExamples.find(example => example.id === loadedId) || null;
  if (matched) return matched;
  if (!loadedId) return null;
  return createStep1DryRunScenario({
    id: loadedId,
    functionKey: inferStep1FunctionKey(getEffectiveSettings(), draft),
    lensKey: String(draft?.scenarioLens?.key || '').trim(),
    lensLabel: String(draft?.scenarioLens?.label || '').trim(),
    title: String(draft?.scenarioTitle || 'Loaded worked example').trim(),
    summary: 'A worked example is active in this draft.',
    bestFor: 'Sample path',
    nextStep: 'Clear the example if you want to return to a fresh Step 1 start.',
    event: String(draft?.guidedInput?.event || '').trim(),
    asset: String(draft?.guidedInput?.asset || '').trim(),
    cause: String(draft?.guidedInput?.cause || '').trim(),
    impact: String(draft?.guidedInput?.impact || '').trim(),
    urgency: String(draft?.guidedInput?.urgency || 'medium').trim(),
    geographies: Array.isArray(draft?.geographies) ? draft.geographies : [],
    risks: getRiskCandidates()
  });
}

function clearLoadedDryRunFlag({ save = false } = {}) {
  if (!AppState.draft?.loadedDryRunId) return;
  delete AppState.draft.loadedDryRunId;
  if (save) saveDraft();
}

function resetStep1DryRunContent() {
  AppState.draft.guidedInput = { event: '', asset: '', cause: '', impact: '', urgency: 'medium' };
  AppState.draft.narrative = '';
  AppState.draft.sourceNarrative = '';
  AppState.draft.enhancedNarrative = '';
  AppState.draft.scenarioLens = null;
  AppState.draft.intakeSummary = '';
  AppState.draft.linkAnalysis = '';
  AppState.draft.scenarioTitle = '';
  AppState.draft.riskCandidates = [];
  AppState.draft.selectedRiskIds = [];
  AppState.draft.selectedRisks = [];
  resetStep1RegulationSelectionState();
  clearLoadedDryRunFlag();
  saveDraft();
  renderWizard1();
  UI.toast('Dry-run example cleared. You can start a fresh assessment now.', 'success');
}

function renderLoadedDryRunBanner(example) {
  if (!example) return '';
  return `<div class="card card--elevated anim-fade-in" style="border-color:var(--accent-gold);background:linear-gradient(180deg, rgba(187,149,74,0.12), rgba(255,255,255,0.02))">
    <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:var(--sp-3)">
      <div>
        <div class="context-panel-title">Dry-run example loaded</div>
        <p class="context-panel-copy" style="margin-top:6px"><strong>${escapeHtml(example.title)}</strong> is active. ${escapeHtml(example.nextStep)}</p>
      </div>
      <button class="btn btn--ghost btn--sm" id="btn-clear-dry-run" type="button">Clear Example</button>
    </div>
    <div class="citation-chips" style="margin-top:var(--sp-4)">
      <span class="badge badge--gold">Dry run</span>
      <span class="badge badge--neutral">Best for: ${escapeHtml(example.bestFor)}</span>
      <span class="badge badge--neutral">${Array.isArray(example.risks) ? example.risks.length : 0} starter risks</span>
    </div>
  </div>`;
}

function hasStep1Content() {
  const draft = AppState.draft || {};
  return !!(
    String(draft.narrative || draft.sourceNarrative || '').trim() ||
    String(draft.guidedInput?.event || '').trim() ||
    getRiskCandidates().length
  );
}

function applyDryRunScenario(example) {
  const settings = getEffectiveSettings();
  const nextNarrative = buildDryRunNarrative(example);
  AppState.draft.step1Path = 'import';
  AppState.draft.guidedInput = {
    event: example.event,
    asset: example.asset,
    cause: example.cause,
    impact: example.impact,
    urgency: example.urgency
  };
  AppState.draft.narrative = nextNarrative;
  AppState.draft.sourceNarrative = nextNarrative;
  AppState.draft.enhancedNarrative = '';
  AppState.draft.intakeSummary = '';
  AppState.draft.linkAnalysis = '';
  AppState.draft.geographies = normaliseScenarioGeographies(example.geographies, settings.geography);
  AppState.draft.geography = formatScenarioGeographies(AppState.draft.geographies, settings.geography);
  const seededRisks = mergeRisks([], example.risks.map(risk => ({ ...risk })));
  AppState.draft.riskCandidates = seededRisks;
  AppState.draft.selectedRiskIds = seededRisks.map(risk => risk.id);
  AppState.draft.selectedRisks = seededRisks.slice();
  AppState.draft.scenarioTitle = example.title;
  AppState.draft.scenarioLens = example.lensKey
    ? {
        ...(STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey] || STEP1_FUNCTION_TO_SCENARIO_LENS.general),
        key: String(example.lensKey || '').trim(),
        label: String(example.lensLabel || '').trim() || (STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey] || STEP1_FUNCTION_TO_SCENARIO_LENS.general).label
      }
    : {
        ...(STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey] || STEP1_FUNCTION_TO_SCENARIO_LENS.general)
      };
  AppState.draft.loadedDryRunId = example.id;
  resetStep1RegulationSelectionState();
  updateStep1ApplicableRegulations(getBUList(), AppState.draft.geographies);
  saveDraft();
  renderWizard1();
  UI.toast(`Loaded dry-run example: ${example.title}.`, 'success');
}


function seedRisksFromScenarioDraft(narrative, { force = false, replaceGenerated = false } = {}) {
  const draftText = String(narrative || '').trim();
  if (!draftText) return 0;
  const existingCandidates = getRiskCandidates();
  const selectedRisks = getSelectedRisks();
  if (!force && (selectedRisks.length || existingCandidates.length)) return 0;
  const preferredLens = getStep1ManualPreferredScenarioLens(getEffectiveSettings(), AppState.draft, draftText);
  if (preferredLens?.key) AppState.draft.scenarioLens = preferredLens;
  const extractedRisks = guessRisksFromText(draftText, { lensHint: preferredLens || AppState.draft.scenarioLens })
    .filter(risk => !isNoiseRiskText(risk.title))
    .map(risk => ({
      ...risk,
      source: risk.source || 'scenario-draft',
      description: risk.description || 'Generated from the current scenario draft to give you a clear shortlist for the next step.'
    }));
  if (!extractedRisks.length) return 0;
  if (replaceGenerated || force) replaceSuggestedRiskCandidates(extractedRisks, { selectNew: true });
  else appendRiskCandidates(extractedRisks, { selectNew: true });
  syncStep1ScenarioTitle(draftText);
  return extractedRisks.length;
}

function hasReusableAiBuiltShortlistForCurrentDraft(draft = AppState.draft || {}) {
  const source = String(draft?.guidedDraftSource || draft?.aiQualityState || '').trim().toLowerCase();
  if (!['ai', 'fallback'].includes(source)) return false;
  if (isStep1AiDraftMateriallyReshaped(draft)) return false;
  return getRiskCandidates().some((risk) => {
    const riskSource = String(risk?.source || '').trim().toLowerCase();
    return riskSource === 'ai' || riskSource === 'scenario-draft';
  });
}

function syncStep1ScenarioTitle(narrative = '') {
  const nextNarrative = String(narrative || AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || '').trim();
  const matchingEnhancedNarrative = normaliseScenarioSeedText(AppState.draft.enhancedNarrative || '') === normaliseScenarioSeedText(nextNarrative)
    ? AppState.draft.enhancedNarrative
    : '';
  AppState.draft.scenarioTitle = typeof resolveScenarioDisplayTitle === 'function'
    ? resolveScenarioDisplayTitle({
        ...AppState.draft,
        narrative: nextNarrative || AppState.draft.narrative,
        sourceNarrative: nextNarrative || AppState.draft.sourceNarrative,
        enhancedNarrative: matchingEnhancedNarrative,
        selectedRisks: getSelectedRisks()
      })
    : (nextNarrative || getSelectedRisks()[0]?.title || AppState.draft.scenarioTitle || '');
  return String(AppState.draft.scenarioTitle || '').trim();
}

function persistAndRenderStep1({
  buList = getBUList(),
  scenarioGeographies = getScenarioGeographies(),
  refreshRegulations = false,
  preserveScroll = false
} = {}) {
  const scrollY = preserveScroll ? (window.scrollY || window.pageYOffset || 0) : 0;
  if (refreshRegulations) updateStep1ApplicableRegulations(buList, scenarioGeographies);
  saveDraft();
  renderWizard1();
  if (preserveScroll) {
    // Step 1 shortlist actions rerender the whole page shell; restoring the previous scroll keeps the user anchored in the risk review area.
    window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
  }
}

function getStep1NarrativeContinuityScore(left = '', right = '') {
  const leftTokens = Array.from(new Set(normaliseAssessmentTokens(left)));
  const rightTokens = Array.from(new Set(normaliseAssessmentTokens(right)));
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightTokenSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  return (overlap * 2) / (leftTokens.length + rightTokens.length);
}

function clearStep1ConversationContext() {
  AppState.draft.step1ConversationFingerprint = '';
  if (typeof dispatchDraftAction === 'function') {
    dispatchDraftAction('CLEAR_LLM_CONTEXT', { contextKey: 'step1LlmContext' });
  } else if (Array.isArray(AppState.draft?.step1LlmContext)) {
    AppState.draft.step1LlmContext = [];
  } else if (Array.isArray(AppState.draft?.llmContext)) {
    AppState.draft.llmContext = [];
  }
}

function clearStep1StaleAssistState(nextNarrative, {
  clearGeneratedRisks = false,
  clearNarrative = false,
  forceClearConversation = false
} = {}) {
  resetStep1LiveAssistState();
  const nextSeed = normaliseScenarioSeedText(nextNarrative);
  const currentSeeds = [
    AppState.draft.sourceNarrative,
    AppState.draft.narrative,
    AppState.draft.enhancedNarrative
  ].map(normaliseScenarioSeedText).filter(Boolean);
  const shouldClearConversation = forceClearConversation
    || !nextSeed
    || (
      currentSeeds.length > 0
      && !currentSeeds.some((seed) => seed === nextSeed)
      && currentSeeds.every((seed) => getStep1NarrativeContinuityScore(seed, nextSeed) < 0.55)
    );
  if (!nextSeed) {
    if (shouldClearConversation) clearStep1ConversationContext();
    if (clearNarrative) {
      AppState.draft.narrative = '';
      AppState.draft.sourceNarrative = '';
      AppState.draft.enhancedNarrative = '';
      AppState.draft.scenarioLens = null;
    }
    AppState.draft.guidedDraftPreview = '';
    AppState.draft.guidedDraftSource = '';
    AppState.draft.guidedDraftStatus = '';
    AppState.draft.scenarioTitle = '';
    resetStep1RegulationSelectionState();
    clearScenarioAssistArtifacts({ clearGeneratedRisks });
    return;
  }
  if (currentSeeds.some(seed => seed === nextSeed)) return;
  // Once the underlying scenario changes, stale AI summaries and generated cards become misleading against the visible draft.
  if (shouldClearConversation) clearStep1ConversationContext();
  if (String(AppState.draft?.step1Path || '').trim() === 'guided' || clearNarrative) {
    AppState.draft.narrative = '';
    AppState.draft.sourceNarrative = '';
    AppState.draft.enhancedNarrative = '';
    if (clearNarrative) AppState.draft.scenarioLens = null;
  }
  AppState.draft.guidedDraftPreview = '';
  AppState.draft.guidedDraftSource = '';
  AppState.draft.guidedDraftStatus = '';
  syncStep1ScenarioTitle(nextSeed);
  resetStep1RegulationSelectionState();
  clearScenarioAssistArtifacts({ clearGeneratedRisks });
}

async function generateStep1GuidedPromptIdeas() {
  const draft = AppState.draft || {};
  syncStep1GuidedInputStateFromDom(draft);
  const sourceText = getStep1GuidedPromptIdeaSourceText(draft);
  if (normaliseAssessmentTokens(sourceText).length < STEP1_LIVE_PROMPT_IDEA_MIN_TOKENS) {
    UI.toast('Add a little more event detail first, then generate prompt ideas.', 'warning');
    return;
  }

  const signature = getStep1GuidedPromptIdeaSignature(draft);
  if (!signature || !window.Step1Assist || typeof window.Step1Assist.suggestGuidedPromptIdeas !== 'function') {
    UI.toast('Prompt ideas are unavailable right now. Build the scenario directly or try again.', 'warning');
    return;
  }

  const button = document.getElementById('btn-generate-guided-prompt-ideas');
  const resetButton = _setStep1ButtonBusy(button, 'Thinking…');
  const localModel = buildStep1GuidedPromptIdeaModel(draft);
  const preferredLens = getStep1PreferredScenarioLens(getEffectiveSettings(), draft, sourceText);
  _step1LivePromptIdeaState = {
    ...createEmptyStep1LivePromptIdeaState(),
    loadingSignature: signature
  };
  updateStep1GuidedPreview();

  try {
    const result = await window.Step1Assist.suggestGuidedPromptIdeas({
      buId: draft?.buId,
      riskStatement: sourceText,
      guidedInput: { ...(draft?.guidedInput || {}) },
      scenarioLensHint: preferredLens,
      fallbackSuggestions: localModel.promptSuggestions
    });

    if (getStep1GuidedPromptIdeaSignature(AppState.draft || {}) !== signature) return;

    _step1LivePromptIdeaState = {
      ..._step1LivePromptIdeaState,
      loadingSignature: ''
    };
    rememberStep1LivePromptIdeaSuggestions(signature, result || {}, String(result?.source || (result?.usedFallback ? 'fallback' : 'ai')).trim() || 'ai');
    updateStep1GuidedPreview();

    const displayedModel = getStep1DisplayedPromptIdeaModel(AppState.draft || {});
    UI.toast(
      displayedModel.source === 'fallback'
        ? 'AI prompt ideas are unavailable right now. Showing the local fallback view.'
        : 'Prompt ideas are ready. Use one or ignore them before building the scenario.',
      displayedModel.source === 'fallback' ? 'warning' : 'success',
      4500
    );
  } catch (error) {
    _step1LivePromptIdeaState = {
      ..._step1LivePromptIdeaState,
      loadingSignature: ''
    };
    updateStep1GuidedPreview();
    UI.toast('Prompt ideas are unavailable right now. Build the scenario directly or try again.', 'warning', 5000);
  } finally {
    resetButton();
  }
}

function updateStep1GuidedPreview() {
  const preview = document.getElementById('guided-preview');
  const previewStatus = document.getElementById('guided-preview-status');
  const previewModel = getStep1DisplayedGuidedPreviewModel(AppState.draft);
  if (preview) {
    preview.textContent = String(previewModel.preview || '').trim()
      || 'Complete the guided questions and click “Build scenario with AI”.';
  }
  if (previewStatus) {
    const source = String(previewModel.source || '').trim().toLowerCase();
    const status = String(previewModel.status || '').trim();
    previewStatus.textContent = status
      ? `${source === 'ai' ? 'AI-built draft' : source === 'fallback' ? 'Deterministic fallback draft' : source === 'manual' ? 'Manual draft' : source === 'local' ? 'Local draft' : 'AI-checked preview'} · ${status}`
      : '';
    previewStatus.style.display = status ? '' : 'none';
  }
  const promptIdeasPanel = document.getElementById('guided-prompt-ideas-panel');
  if (promptIdeasPanel) {
    promptIdeasPanel.innerHTML = renderStep1GuidedPromptIdeaPanel(getStep1DisplayedPromptIdeaModel(AppState.draft));
    bindStep1PromptIdeaPanelActions(promptIdeasPanel, getEffectiveSettings());
  }
}

function createStep1GeographySyncHandler({ buList, settings }) {
  return nextGeographies => {
    AppState.draft.geographies = normaliseScenarioGeographies(nextGeographies, settings.geography);
    AppState.draft.geography = formatScenarioGeographies(AppState.draft.geographies, settings.geography);
    persistAndRenderStep1({ buList, scenarioGeographies: AppState.draft.geographies, refreshRegulations: true });
  };
}

let _scenarioMemoryDebounce = null;
let _scenarioCrossReferenceDebounce = null;

function getStep1InsightWorkbenchActiveCount() {
  return ['step1-insight-alignment-host', 'scenario-cross-reference-host', 'scenario-memory-host', 'intake-output']
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .filter((node) => String(node.innerHTML || '').replace(/\s+/g, '').trim().length > 0)
    .length;
}

function refreshStep1InsightWorkbenchSummary() {
  const label = document.getElementById('step1-insight-summary-count');
  const emptyState = document.getElementById('step1-insight-empty-state');
  if (!label && !emptyState) return;
  const activeCount = getStep1InsightWorkbenchActiveCount();
  if (label) {
    label.textContent = activeCount
      ? `${activeCount} support view${activeCount === 1 ? '' : 's'} available`
      : 'No extra context yet';
  }
  if (emptyState) {
    emptyState.hidden = activeCount > 0;
  }
}

function refreshStep1ScenarioCrossReferenceHost({ includeAi = true, force = false, narrativeOverride = '' } = {}) {
  const host = document.getElementById('scenario-cross-reference-host');
  const context = getStep1ScenarioCrossReferenceContext({
    draft: AppState.draft,
    narrativeOverride
  });
  if (host) {
    host.innerHTML = renderStep1ScenarioCrossReferenceBand(AppState.draft, context);
  }
  refreshStep1InsightWorkbenchSummary();
  bindStep1ScenarioCrossReferenceActions();
  if (!includeAi || !context.signature || normaliseAssessmentTokens(context.narrative).length < 4 || !context.portfolio.length) return;
  if (!force && String(AppState.draft.scenarioCrossReferenceSignature || '').trim() === String(context.signature || '').trim()) return;
  if (!force && AppState.draft.scenarioCrossReferenceLoading && String(AppState.draft.scenarioCrossReferenceLoadingSignature || '').trim() === String(context.signature || '').trim()) return;
  AppState.draft.scenarioCrossReferenceLoading = true;
  AppState.draft.scenarioCrossReferenceLoadingSignature = context.signature;
  if (host) {
    host.innerHTML = renderStep1ScenarioCrossReferenceBand(AppState.draft, context);
  }
  refreshStep1InsightWorkbenchSummary();
  bindStep1ScenarioCrossReferenceActions();
  const capturedSignature = context.signature;
  const capturedAssessments = context.assessments.slice();
  window.setTimeout(async () => {
    const result = await window.Step1Assist?.checkScenarioPortfolioOverlap?.({
      scenarioText: context.narrative,
      portfolio: context.portfolio
    });
    if (String(AppState.draft.scenarioCrossReferenceLoadingSignature || '').trim() !== capturedSignature) return;
    const overlap = result?.overlap && result.overlap.found
      ? {
          found: true,
          matchTitle: String(result.overlap.matchTitle || '').trim(),
          overlapSummary: String(result.overlap.overlapSummary || '').trim()
        }
      : { found: false, matchTitle: '', overlapSummary: '' };
    const matchedAssessment = overlap.found
      ? resolveStep1ScenarioCrossReferenceMatch(capturedAssessments, overlap.matchTitle)
      : null;
    AppState.draft.scenarioCrossReference = {
      overlap: {
        ...overlap,
        matchId: String(matchedAssessment?.id || '').trim()
      },
      gap: result?.gap && result.gap.isNew
        ? {
            isNew: true,
            gapSummary: String(result.gap.gapSummary || '').trim()
          }
        : {
            isNew: false,
            gapSummary: ''
          }
    };
    AppState.draft.scenarioCrossReferenceSignature = capturedSignature;
    AppState.draft.scenarioCrossReferenceLoading = false;
    AppState.draft.scenarioCrossReferenceLoadingSignature = '';
    const nextHost = document.getElementById('scenario-cross-reference-host');
    if (nextHost) {
      nextHost.innerHTML = renderStep1ScenarioCrossReferenceBand(AppState.draft, getStep1ScenarioCrossReferenceContext({ draft: AppState.draft }));
    }
    refreshStep1InsightWorkbenchSummary();
    bindStep1ScenarioCrossReferenceActions();
  }, 0);
}

function refreshStep1ScenarioMemoryHost({ includeAi = true } = {}) {
  const host = document.getElementById('scenario-memory-host');
  const state = ensureStep1ScenarioMemoryState(AppState.draft);
  if (host) {
    host.innerHTML = renderStep1ScenarioMemoryBand(AppState.draft, state);
  }
  refreshStep1InsightWorkbenchSummary();
  bindStep1ScenarioMemoryActions();
  if (!includeAi || state.matches.length < 2 || !state.signature) return;
  if (String(AppState.draft.scenarioMemoryPrecedentSignature || '').trim() === state.signature) return;
  AppState.draft.scenarioMemoryPrecedentLoading = true;
  if (host) {
    host.innerHTML = renderStep1ScenarioMemoryBand(AppState.draft, ensureStep1ScenarioMemoryState(AppState.draft));
  }
  refreshStep1InsightWorkbenchSummary();
  bindStep1ScenarioMemoryActions();
  const capturedSignature = state.signature;
  const currentScenario = getStep1ScenarioMemoryNarrative(AppState.draft);
  window.setTimeout(async () => {
    const precedent = await window.Step1Assist?.generateScenarioMemoryPrecedent?.({
      currentScenario,
      matches: state.matches
    });
    if (String(AppState.draft.scenarioMemorySignature || '').trim() !== capturedSignature) return;
    AppState.draft.scenarioMemoryPrecedent = String(precedent || '').trim();
    AppState.draft.scenarioMemoryPrecedentSignature = capturedSignature;
    AppState.draft.scenarioMemoryPrecedentLoading = false;
    const nextHost = document.getElementById('scenario-memory-host');
    if (nextHost) nextHost.innerHTML = renderStep1ScenarioMemoryBand(AppState.draft, ensureStep1ScenarioMemoryState(AppState.draft));
    refreshStep1InsightWorkbenchSummary();
    bindStep1ScenarioMemoryActions();
  }, 0);
}

function scheduleStep1ScenarioMemoryRefresh({ immediate = false } = {}) {
  window.clearTimeout(_scenarioMemoryDebounce);
  if (immediate) {
    refreshStep1ScenarioMemoryHost({ includeAi: true });
    return;
  }
  _scenarioMemoryDebounce = window.setTimeout(() => {
    refreshStep1ScenarioMemoryHost({ includeAi: true });
  }, 500);
}

function scheduleStep1ScenarioCrossReferenceRefresh({ immediate = false, force = false, narrativeOverride = '' } = {}) {
  window.clearTimeout(_scenarioCrossReferenceDebounce);
  if (immediate) {
    refreshStep1ScenarioCrossReferenceHost({ includeAi: true, force, narrativeOverride });
    return;
  }
  _scenarioCrossReferenceDebounce = window.setTimeout(() => {
    refreshStep1ScenarioCrossReferenceHost({ includeAi: true, force, narrativeOverride });
  }, 500);
}

function bindStep1ScenarioCrossReferenceActions() {
  document.querySelectorAll('[data-scenario-cross-reference-view]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const id = String(button.dataset.scenarioCrossReferenceView || '').trim();
      if (!id) return;
      Router.navigate(`/results/${id}`);
    });
  });
  document.querySelectorAll('[data-scenario-cross-reference-dismiss]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const kind = String(button.dataset.scenarioCrossReferenceDismiss || '').trim();
      if (!kind) return;
      const signature = String(AppState.draft.scenarioCrossReferenceSignature || '').trim();
      AppState.draft.scenarioCrossReferenceDismissals = {
        ...(AppState.draft.scenarioCrossReferenceDismissals && typeof AppState.draft.scenarioCrossReferenceDismissals === 'object' ? AppState.draft.scenarioCrossReferenceDismissals : {}),
        [kind]: signature
      };
      refreshStep1ScenarioCrossReferenceHost({ includeAi: false });
    });
  });
}

function bindStep1ScenarioMemoryActions() {
  document.querySelectorAll('.btn-scenario-memory-load').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = String(button.dataset.scenarioMemoryId || '').trim();
      if (!targetId) return;
      AppState.draft.scenarioMemoryReferenceId = targetId;
      if (typeof markScenarioMemoryReference === 'function') {
        markScenarioMemoryReference(targetId);
      }
      refreshStep1ScenarioMemoryHost({ includeAi: false });
    });
  });
  document.querySelectorAll('.btn-scenario-memory-compare').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = String(button.dataset.scenarioMemoryId || '').trim();
      const state = ensureStep1ScenarioMemoryState(AppState.draft);
      const reference = state.matches.find(match => String(match?.id || '').trim() === targetId) || null;
      if (!reference) return;
      AppState.draft.scenarioMemoryReferenceId = targetId;
      AppState.draft.scenarioMemoryComparisonLoadingId = targetId;
      refreshStep1ScenarioMemoryHost({ includeAi: false });
      const capturedSignature = String(AppState.draft.scenarioMemorySignature || '').trim();
      const difference = await window.Step1Assist?.compareScenarioMemory?.({
        currentScenario: getStep1ScenarioMemoryNarrative(AppState.draft),
        referenceScenario: reference,
        scenarioLens: AppState.draft.scenarioLens
      });
      if (String(AppState.draft.scenarioMemorySignature || '').trim() !== capturedSignature) return;
      AppState.draft.scenarioMemoryComparisonLoadingId = '';
      AppState.draft.scenarioMemoryComparisons = {
        ...(AppState.draft.scenarioMemoryComparisons && typeof AppState.draft.scenarioMemoryComparisons === 'object' ? AppState.draft.scenarioMemoryComparisons : {}),
        [targetId]: String(difference || '').trim()
      };
      refreshStep1ScenarioMemoryHost({ includeAi: false });
    });
  });
}

function bindStep1PathSelector() {
  document.querySelectorAll('[data-path]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = String(btn.dataset.path || '').trim();
      if (!next || next === AppState.draft.step1Path) return;
      const hasContent = !!(AppState.draft.narrative ||
        AppState.draft.guidedInput?.event ||
        getRiskCandidates().length);
      if (hasContent && !window.confirm(
        'Switch start method? Your current draft is kept but path-specific fields will be cleared.'
      )) return;
      if (AppState.draft.step1Path === 'guided') {
        AppState.draft.guidedInput = { event:'', asset:'', cause:'', impact:'', urgency:'medium' };
      } else if (AppState.draft.step1Path === 'draft') {
        AppState.draft.narrative = '';
        AppState.draft.sourceNarrative = '';
        AppState.draft.enhancedNarrative = '';
      } else if (AppState.draft.step1Path === 'import') {
        AppState.draft.loadedDryRunId = '';
        AppState.draft.uploadedRegisterName = '';
      }
      AppState.draft.step1Path = next;
      saveDraft();
      renderWizard1();
    });
  });
}

function bindStep1PrimaryInputs({ buList, wizardGeographyInput }) {
  document.getElementById('wizard-bu').addEventListener('change', function() {
    const bu = buList.find(b => b.id === this.value) || null;
    AppState.draft.buId = bu?.id || null;
    AppState.draft.buName = bu?.name || null;
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
  });

  document.querySelectorAll('.wizard-geo-chip').forEach(button => {
    button.addEventListener('click', () => {
      const next = Array.from(new Set([...(wizardGeographyInput.getTags() || []), button.dataset.geo]));
      wizardGeographyInput.setTags(next);
    });
  });

  ['event', 'asset', 'cause', 'impact'].forEach(key => {
    document.getElementById(`guided-${key}`)?.addEventListener('input', function() {
      const hadGuidedAiDraft = !!(AppState.draft.guidedDraftSource || AppState.draft.aiNarrativeBaseline);
      AppState.draft.guidedInput[key] = this.value;
      clearLoadedDryRunFlag();
      const composed = composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft);
      clearStep1StaleAssistState(composed);
      AppState.draft.scenarioLens = getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft, composed);
      if (hadGuidedAiDraft) AppState.draft.aiQualityState = 'analyst-reshaped';
      updateStep1GuidedPreview();
      markDraftDirty();
      scheduleDraftAutosave();
    });
  });

  document.getElementById('guided-urgency')?.addEventListener('change', function() {
    const hadGuidedAiDraft = !!(AppState.draft.guidedDraftSource || AppState.draft.aiNarrativeBaseline);
    AppState.draft.guidedInput.urgency = this.value;
    clearLoadedDryRunFlag();
    const composed = composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft);
    clearStep1StaleAssistState(composed);
    AppState.draft.scenarioLens = getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft, composed);
    if (hadGuidedAiDraft) AppState.draft.aiQualityState = 'analyst-reshaped';
    updateStep1GuidedPreview();
    markDraftDirty();
    scheduleDraftAutosave();
  });

  document.getElementById('intake-risk-statement').addEventListener('input', function() {
    const hadAssistedDraft = !!(AppState.draft.guidedDraftSource || AppState.draft.aiNarrativeBaseline || AppState.draft.llmAssisted);
    clearStep1StaleAssistState(this.value);
    AppState.draft.narrative = this.value;
    AppState.draft.sourceNarrative = this.value;
    // Strong fresh narrative text should beat stale lens memory, while weaker text still falls back to the current draft context.
    AppState.draft.scenarioLens = getStep1ManualPreferredScenarioLens(getEffectiveSettings(), AppState.draft, this.value);
    if (hadAssistedDraft) AppState.draft.aiQualityState = 'analyst-reshaped';
    clearLoadedDryRunFlag();
    markDraftDirty();
    scheduleDraftAutosave();
  });
}

function bindStep1ScenarioActions({ buList, settings, exampleModel }) {
  document.getElementById('btn-build-guided-narrative')?.addEventListener('click', () => Step1Assist.buildGuidedScenarioDraft());

  bindStep1PromptIdeaPanelActions(document, settings);

  document.querySelectorAll('.btn-load-dry-run').forEach(button => {
    button.addEventListener('click', () => {
      const neutralStarter = !AppState.draft.loadedDryRunId && String(button.textContent || '').trim() === 'Load Example'
        ? (exampleModel.availableExamples || []).find(entry => entry.id === 'supplier-platform-outage')
        : null;
      const example = neutralStarter || (exampleModel.availableExamples || []).find(entry => entry.id === button.dataset.dryRunId);
      if (!example) return;
      if (hasStep1Content() && !window.confirm('Load this dry-run example and replace the current step-1 scenario draft and shortlist?')) return;
      applyDryRunScenario(example);
    });
  });

  document.getElementById('btn-clear-dry-run')?.addEventListener('click', () => {
    resetStep1DryRunContent();
  });

  document.getElementById('linked-risks-toggle')?.addEventListener('change', function() {
    AppState.draft.linkedRisks = this.checked;
    saveDraft();
  });

  document.getElementById('btn-add-manual-risk')?.addEventListener('click', () => {
    const input = document.getElementById('manual-risk-add');
    const value = input.value.trim();
    if (!value) return;
    clearLoadedDryRunFlag();
    appendRiskCandidates([{ title: value, category: 'Manual', source: 'manual' }], { selectNew: true });
    input.value = '';
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
  });

  document.getElementById('risk-register-file')?.addEventListener('change', handleRegisterUpload);
  document.getElementById('btn-enhance-risk-statement')?.addEventListener('click', enhanceNarrativeWithAI);

  document.getElementById('btn-generate-risks-from-draft')?.addEventListener('click', async (event) => {
    const narrative = document.getElementById('intake-risk-statement')?.value.trim() || AppState.draft.narrative || '';
    if (!narrative) {
      UI.toast('Enter or build a scenario draft first.', 'warning');
      return;
    }
    if (hasReusableAiBuiltShortlistForCurrentDraft(AppState.draft)) {
      UI.toast('The current shortlist already reflects the latest AI-built draft. Change the draft first if you want a different shortlist.', 'info', 5000);
      return;
    }
    await generateShortlistFromDraftWithAI({
      narrative,
      button: event?.currentTarget || document.getElementById('btn-generate-risks-from-draft'),
      replaceGenerated: true,
      preserveScroll: true
    });
  });

  document.getElementById('btn-register-analyse')?.addEventListener('click', analyseUploadedRegister);
  document.querySelectorAll('[data-regulation-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleStep1ApplicableRegulation(button.dataset.regulationTag, {
        buList,
        scenarioGeographies: getScenarioGeographies()
      });
    });
  });
}

function bindStep1PromptIdeaChips(root = document, settings = getEffectiveSettings()) {
  root.querySelectorAll('.guided-prompt-chip').forEach(btn => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      AppState.draft.guidedInput.event = btn.dataset.prompt;
      document.getElementById('guided-event').value = btn.dataset.prompt;
      const composed = composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft);
      clearStep1StaleAssistState(composed);
      AppState.draft.scenarioLens = getStep1PreferredScenarioLens(settings, AppState.draft, composed);
      updateStep1GuidedPreview();
      markDraftDirty();
      scheduleDraftAutosave();
    });
  });
}

function bindStep1PromptIdeaPanelActions(root = document, settings = getEffectiveSettings()) {
  bindStep1PromptIdeaChips(root, settings);
  root.querySelectorAll('#btn-generate-guided-prompt-ideas').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      generateStep1GuidedPromptIdeas();
    });
  });
}

function applyStep1FreshDisclosureDefaults(root = document) {
  if (!AppState?.forceWizardDisclosureDefaults) return;
  root.querySelectorAll('details[data-disclosure-state-key][data-disclosure-default-open]').forEach((section) => {
    const key = String(section.dataset.disclosureStateKey || '').trim().toLowerCase();
    if (!key.startsWith('/wizard/1::')) return;
    section.open = section.dataset.disclosureDefaultOpen === 'true';
  });
  AppState.forceWizardDisclosureDefaults = false;
}

function bindStep1NavigationActions({ buList, settings, wizardGeographyInput }) {
  document.getElementById('btn-next-1').addEventListener('click', async (event) => {
    const buId = document.getElementById('wizard-bu').value;
    let narrative = document.getElementById('intake-risk-statement').value.trim();
    let selected = getSelectedRisks();
    if (!buId) {
      const framingDisclosure = Array.from(document.querySelectorAll('.wizard-support-band details'))
        .find(node => /assessment framing and defaults/i.test(node.querySelector('summary')?.textContent || ''));
      if (framingDisclosure) framingDisclosure.open = true;
      document.getElementById('wizard-bu')?.focus();
      UI.toast('Select the business unit in the support section before continuing.', 'warning');
      return;
    }
    if (!narrative) {
      const composed = composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft);
      if (composed) {
        AppState.draft.narrative = composed;
        AppState.draft.sourceNarrative = composed;
        document.getElementById('intake-risk-statement').value = composed;
        narrative = composed;
      }
    }
    if (narrative && !selected.length && !getRiskCandidates().length) {
      await generateShortlistFromDraftWithAI({
        narrative,
        button: event?.currentTarget || document.getElementById('btn-next-1'),
        replaceGenerated: true,
        suppressToast: true
      });
      selected = getSelectedRisks();
    }
    if (!narrative && selected.length) {
      const selectedTitles = selected.slice(0, 3).map(item => item.title).filter(Boolean);
      const buLabel = buList.find(b => b.id === buId)?.name || AppState.draft.buName || 'the selected business unit';
      const geographyLabel = formatScenarioGeographies(wizardGeographyInput.getTags(), settings.geography);
      // Selected-risk-only starts left Step 2 with a blank narrative, so seed a minimal editable scenario before continuing.
      narrative = `Assess the potential impact of ${selectedTitles.join(', ') || 'the selected risks'} affecting ${buLabel}${geographyLabel ? ` in ${geographyLabel}` : ''}.`;
      AppState.draft.narrative = narrative;
      AppState.draft.sourceNarrative = narrative;
      document.getElementById('intake-risk-statement').value = narrative;
    }
    if (!String(AppState.draft.narrative || narrative || '').trim() && !selected.length) { UI.toast('Please complete the guided questions, enter a risk statement, or select at least one risk.', 'warning'); return; }
    AppState.draft.geographies = normaliseScenarioGeographies(wizardGeographyInput.getTags(), settings.geography);
    AppState.draft.geography = formatScenarioGeographies(AppState.draft.geographies, settings.geography);
    AppState.draft.narrative = AppState.draft.narrative.trim();
    AppState.draft.sourceNarrative = normaliseScenarioSeedText(AppState.draft.sourceNarrative || AppState.draft.narrative);
    AppState.draft.enhancedNarrative = AppState.draft.enhancedNarrative || AppState.draft.narrative;
    updateStep1ApplicableRegulations(buList, AppState.draft.geographies);
    syncStep1ScenarioTitle(AppState.draft.enhancedNarrative || AppState.draft.narrative || narrative);
    saveDraft();
    Router.navigate('/wizard/2');
  });
}

function renderWizard1() {
  ensureDraftShape();
  const draft = AppState.draft;
  const pathInitialised = initStep1Path(draft);
  const settings = getEffectiveSettings();
  const buList = getBUList();
  if (ensureStep1ContextPrefills(draft, settings, buList) || pathInitialised) saveDraft();
  const selectedRisks = syncRiskSelection(!Array.isArray(draft.selectedRiskIds));
  const riskCandidates = getRiskCandidates();
  const scenarioGeographies = getScenarioGeographies();
  const regulationModel = buildStep1ApplicableRegulationModel({
    draft,
    bu: buList.find((item) => item.id === draft.buId) || null,
    selectedRisks,
    riskCandidates,
    scenarioGeographies,
    settings
  });
  const regs = regulationModel.selected;
  const recommendation = getStep1RecommendedAction(draft, selectedRisks);
  const exampleModel = getStep1ExampleExperienceModel(settings, draft);
  const scenarioMemoryState = ensureStep1ScenarioMemoryState(draft);
  const activeDryRun = getLoadedDryRunScenario(draft);
  const starterFeaturedExample = !activeDryRun && !draft.buId
    ? exampleModel.availableExamples.find(example => example.id === 'supplier-platform-outage')
    : null;
  // Keep a neutral supplier/resilience example as the front-door sample until the business context is chosen, then follow the tailored function-aware path.
  const featuredDryRun = activeDryRun
    || starterFeaturedExample
    || exampleModel.recommendedExamples[0]
    || exampleModel.learnedExamples[0]
    || exampleModel.availableExamples[0]
    || null;
  const narrative = String(draft.narrative || '').trim();
  const hasScenarioDraft = !!narrative;
  const hasImportedSource = !!String(draft.uploadedRegisterName || draft.loadedDryRunId || '').trim()
    || (riskCandidates || []).some(risk => risk.source === 'register' || risk.source === 'ai+register' || risk.source === 'manual');
  const canContinue = !!String(draft.buId || '').trim() && (!!narrative || selectedRisks.length > 0);
  const promptIdeaModel = getStep1DisplayedPromptIdeaModel(draft, exampleModel);

  setPage(`
    <main class="page" aria-label="Step 1: AI-Assisted Risk and Context Builder">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(1)}
          <h2 class="wizard-step-title">AI-Assisted Risk &amp; Context Builder</h2>
          <p class="wizard-step-desc">Set the context first, choose how you want to start, then commit to one path before you shape the shortlist.</p>
          <div class="wizard-status-stack">
            <div class="form-help" data-draft-save-state>Draft saves automatically</div>
            ${renderPilotWarningBanner('ai', { compact: true })}
          </div>
        </div>
        <div class="wizard-body">
          ${renderStep1ContextCard(settings, draft, scenarioGeographies, regs, buList)}
          ${renderStep1PathSelector(draft.step1Path)}
          ${renderStep1PathContent(draft.step1Path, {
            draft,
            recommendation,
            functionLabel: exampleModel.functionLabel,
            promptIdeaModel,
            exampleModel,
            hasScenarioDraft,
            hasImportedSource,
            settings,
            scenarioMemoryState,
            activeDryRun,
            featuredDryRun
          })}
          ${riskCandidates.length ? renderStep1ScopeBand({ draft, selectedRisks, riskCandidates, regs }) : ''}
          ${renderStep1SelectedRisksSummary(selectedRisks, riskCandidates)}
        </div>
        <div class="step1-sticky-footer">
          <button class="btn btn--primary" id="btn-next-1" ${canContinue ? '' : 'disabled'} aria-disabled="${canContinue ? 'false' : 'true'}">Continue to Scenario Review</button>
          ${renderStep1ReadinessBanner(draft, selectedRisks)}
        </div>
      </div>
    </main>`);

  if (AppState.dashboardStartIntent === 'register') {
    AppState.dashboardStartIntent = '';
    window.setTimeout(() => {
      document.getElementById('risk-register-file')?.focus();
    }, 0);
  }

  const syncWizardGeographies = createStep1GeographySyncHandler({ buList, settings });
  const wizardGeographyInput = UI.tagInput('ti-wizard-geographies', scenarioGeographies, syncWizardGeographies);
  updateWizardSaveState();
  bindStep1PathSelector();
  bindStep1PrimaryInputs({ buList, wizardGeographyInput });
  bindStep1ScenarioActions({ buList, settings, exampleModel });
  bindStep1NavigationActions({ buList, settings, wizardGeographyInput });
  bindRiskCardActions({ buList });
  bindStep1AiFeedbackActions({ buList });
  bindStep1ScenarioCrossReferenceActions();
  bindStep1ScenarioMemoryActions();
  applyStep1FreshDisclosureDefaults();
  // Keep heavier Step 1 workbench assists local by default.
  refreshStep1ScenarioCrossReferenceHost({ includeAi: false });
  window.Step1Assist?.mountAiTraceLinks?.();
  document.getElementById('btn-clear-ghost-draft')?.addEventListener('click', () => {
    clearGhostDraftSuggestion();
    persistAndRenderStep1();
  });
  document.getElementById('btn-risk-empty-add')
    ?.addEventListener('click', () => {
      const input = document.getElementById('risk-empty-manual-input');
      const value = (input?.value || '').trim();
      if (!value) return;
      clearLoadedDryRunFlag();
      appendRiskCandidates(
        [{ title: value, category: 'Manual', source: 'manual' }],
        { selectNew: true }
      );
      if (input) input.value = '';
      persistAndRenderStep1();
    });
}

window.scheduleStep1ScenarioCrossReferenceRefresh = scheduleStep1ScenarioCrossReferenceRefresh;
window.resetStep1LiveAssistState = resetStep1LiveAssistState;
window.getStep1ActiveGuidedPromptIdeaLensHint = getStep1ActiveGuidedPromptIdeaLensHint;
window.syncStep1GuidedInputStateFromDom = syncStep1GuidedInputStateFromDom;

function normaliseAssessmentTokens(text) {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2 && !['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'your', 'have', 'will', 'risk'].includes(token))
  ));
}

function buildStep1AssessmentSignals(narrative) {
  const guidedInput = getStep1CurrentGuidedInput(AppState.draft || {});
  return {
    scenarioLens: AppState.draft?.scenarioLens || getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft),
    eventTokens: normaliseAssessmentTokens(guidedInput.event || narrative).slice(0, 14),
    assetTokens: normaliseAssessmentTokens(guidedInput.asset).slice(0, 10),
    causeTokens: normaliseAssessmentTokens(guidedInput.cause).slice(0, 10),
    impactTokens: normaliseAssessmentTokens(guidedInput.impact).slice(0, 10),
    narrativeTokens: normaliseAssessmentTokens([
      narrative,
      guidedInput.event,
      guidedInput.asset,
      guidedInput.cause,
      guidedInput.impact
    ].filter(Boolean).join(' ')).slice(0, 18)
  };
}

function normaliseLearningRiskKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getStep1RiskSignalSummary(assessmentSignals = {}) {
  void assessmentSignals;
  return null;
}

function getStep1HierarchicalFeedbackProfile(assessmentSignals = {}) {
  void assessmentSignals;
  return null;
}

function recordStep1RiskDecision(risk, action = 'keep', options = {}) {
  const username = AuthService.getCurrentUser()?.username || '';
  if (!username || typeof LearningStore === 'undefined' || typeof LearningStore.recordRiskDecision !== 'function' || !risk) return;
  LearningStore.recordRiskDecision(username, {
    action,
    buId: AppState.draft?.buId || '',
    scenarioLens: AppState.draft?.scenarioLens || null,
    riskTitle: risk.title,
    riskCategory: risk.category,
    source: risk.source || '',
    reason: normaliseStep1RiskRemovalReason(options?.reason || ''),
    scenarioFingerprint: buildStep1AiFeedbackScenarioFingerprint(AppState.draft)
  });
}

function promptStep1RiskRemovalReason(risk = {}) {
  const options = STEP1_RISK_REMOVAL_REASON_OPTIONS;
  const riskTitle = String(risk?.title || 'this risk').trim();
  if (!UI || typeof UI.modal !== 'function') {
    const raw = typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt(
          `Why are you removing "${riskTitle}"?\n1 = Incorrect risk\n2 = Correct, but narrowing scope\n3 = Only partially relevant`,
          ''
        )
      : '';
    const trimmed = String(raw || '').trim().toLowerCase();
    if (!trimmed) return Promise.resolve(null);
    const aliases = {
      '1': 'incorrect-risk',
      incorrect: 'incorrect-risk',
      'incorrect-risk': 'incorrect-risk',
      '2': 'narrower-scope',
      narrower: 'narrower-scope',
      'narrower-scope': 'narrower-scope',
      '3': 'partially-relevant',
      partial: 'partially-relevant',
      'partially-relevant': 'partially-relevant'
    };
    return Promise.resolve(aliases[trimmed] || null);
  }
  return new Promise((resolve) => {
    const modalKey = `risk-removal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const titleId = `${modalKey}-title`;
    const confirmId = `${modalKey}-confirm`;
    const cancelId = `${modalKey}-cancel`;
    let selectedReason = '';
    let settled = false;
    const finish = (value = null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const dialog = UI.modal({
      title: 'Why are you removing this risk?',
      body: `
        <div aria-labelledby="${titleId}" style="display:flex;flex-direction:column;gap:12px">
          <p id="${titleId}" class="help-body-copy" style="margin:0">Choose the reason that best matches why <strong>${escapeHtml(riskTitle)}</strong> is leaving the shortlist.</p>
          <div style="display:grid;gap:10px">
            ${options.map((option) => `
              <button
                class="btn btn--ghost"
                data-risk-removal-reason="${escapeHtml(option.key)}"
                type="button"
                aria-pressed="false"
                style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;white-space:normal;padding:14px 16px"
              >
                <strong>${escapeHtml(option.label)}</strong>
                <span class="form-help" style="margin:0">${escapeHtml(option.description)}</span>
              </button>
            `).join('')}
          </div>
          <div class="banner banner--neutral" role="note">
            <span class="banner-text">Only <strong>Incorrect risk</strong> feeds shared AI tuning. Scope choices stay as analyst context only.</span>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" id="${cancelId}" type="button">Cancel</button>
        <button class="btn btn--primary" id="${confirmId}" type="button" disabled>Remove risk</button>
      `,
      onClose: () => finish(null)
    });
    const root = document.querySelector('.modal-backdrop:last-of-type');
    const confirmButton = root?.querySelector(`#${confirmId}`);
    const updateSelection = (reasonKey = '') => {
      selectedReason = normaliseStep1RiskRemovalReason(reasonKey);
      Array.from(root?.querySelectorAll('[data-risk-removal-reason]') || []).forEach((button) => {
        const active = String(button.dataset.riskRemovalReason || '') === selectedReason;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.classList.toggle('btn--secondary', active);
        button.classList.toggle('btn--ghost', !active);
      });
      if (confirmButton) confirmButton.disabled = !selectedReason;
    };
    Array.from(root?.querySelectorAll('[data-risk-removal-reason]') || []).forEach((button) => {
      button.addEventListener('click', () => updateSelection(button.dataset.riskRemovalReason || ''));
    });
    root?.querySelector(`#${cancelId}`)?.addEventListener('click', () => dialog.close());
    confirmButton?.addEventListener('click', () => {
      if (!selectedReason) return;
      finish(selectedReason);
      dialog.close();
    });
  });
}

async function applyStep1RiskRemoval(riskId = '', reason = '', {
  buList = getBUList(),
  scenarioGeographies = getScenarioGeographies()
} = {}) {
  const safeRiskId = String(riskId || '').trim();
  const risk = getRiskCandidates().find((item) => String(item?.id || '').trim() === safeRiskId);
  const reasonOption = getStep1RiskRemovalReasonOption(reason);
  if (!risk || !reasonOption) return false;
  recordStep1RiskDecision(risk, 'remove', { reason: reasonOption.key });
  if (shouldRecordStep1RiskRemovalAsAiFeedback(reasonOption.key) && isStep1GeneratedRiskFeedbackEligible(risk)) {
    await saveStep1AiRiskFeedback(safeRiskId, 1, {
      buList,
      reasons: [reasonOption.aiFeedbackReason].filter(Boolean),
      silent: true
    });
  }
  AppState.draft.riskCandidates = getRiskCandidates().filter((item) => item.id !== safeRiskId);
  AppState.draft.selectedRiskIds = (AppState.draft.selectedRiskIds || []).filter((id) => id !== safeRiskId);
  syncRiskSelection();
  persistAndRenderStep1({ buList, scenarioGeographies, refreshRegulations: true, preserveScroll: true });
  const removalMessage = reasonOption.key === 'incorrect-risk'
    ? 'Removed risk and recorded it as incorrect AI output.'
    : reasonOption.key === 'narrower-scope'
      ? 'Removed risk and recorded it as analyst scope narrowing only.'
      : 'Removed risk and recorded it as partially relevant only.';
  UI.toast(removalMessage, 'success', 3000);
  return true;
}

function getRiskAssessmentHaystack(risk) {
  return `${risk.title || ''} ${risk.description || ''} ${risk.category || ''}`.toLowerCase();
}

function countAssessmentMatches(tokens, haystack) {
  if (!Array.isArray(tokens) || !tokens.length) return 0;
  return tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
}

function lookupStep1FeedbackRiskWeight(feedbackProfile = null, riskTitle = '') {
  if (!feedbackProfile || typeof feedbackProfile !== 'object' || !riskTitle) return 0;
  const target = normaliseLearningRiskKey(riskTitle);
  return Object.entries(feedbackProfile.riskWeights || {}).reduce((best, [title, value]) => {
    return normaliseLearningRiskKey(title) === target ? Number(value || 0) : best;
  }, 0);
}

function scoreRiskForCurrentAssessment(risk, assessmentSignals, selectedIds, feedbackSummary = null, feedbackProfile = null) {
  const tuning = getStep1AiTuningSettings();
  let score = 0;
  const reasons = [];
  const haystack = getRiskAssessmentHaystack(risk);
  if (selectedIds.has(risk.id)) {
    score += 8;
    reasons.push('Already part of the current shortlist.');
  }
  if (risk.source === 'manual') {
    score += 3;
    reasons.push('Added directly for this assessment.');
  }
  if (risk.source === 'ai+register' || risk.source === 'register') {
    score += 2;
  }
  const hasLensMatch = typeof riskMatchesLens === 'function'
    ? riskMatchesLens(risk, assessmentSignals.scenarioLens)
    : true;
  const lensLabel = String(assessmentSignals?.scenarioLens?.label || 'current').trim().toLowerCase();
  if (!hasLensMatch) {
    score -= 6;
    reasons.push(`Sits outside the current ${lensLabel} scenario lens.`);
  } else if (assessmentSignals?.scenarioLens?.key && assessmentSignals.scenarioLens.key !== 'general') {
    score += 2;
    reasons.push(`Matches the current ${lensLabel} scenario lens.`);
  }

  const eventMatches = countAssessmentMatches(assessmentSignals.eventTokens, haystack);
  const assetMatches = countAssessmentMatches(assessmentSignals.assetTokens, haystack);
  const causeMatches = countAssessmentMatches(assessmentSignals.causeTokens, haystack);
  const impactMatches = countAssessmentMatches(assessmentSignals.impactTokens, haystack);
  const narrativeMatches = countAssessmentMatches(assessmentSignals.narrativeTokens, haystack);

  if (assetMatches) {
    score += 4 + Math.min(assetMatches, 2);
    reasons.push('Matches the same affected asset or service.');
  }
  if (causeMatches) {
    score += 4 + Math.min(causeMatches, 2);
    reasons.push('Matches the same likely cause or attack path.');
  }
  if (impactMatches) {
    score += 3 + Math.min(impactMatches, 2);
    reasons.push('Matches the same business or regulatory impact.');
  }
  if (eventMatches) {
    score += 2 + Math.min(eventMatches, 2);
  }
  if (narrativeMatches >= 2) {
    score += 2;
    reasons.push('Shares the same event wording as the current scenario draft.');
  }
  if (tuning.shortlistDiscipline === 'strict' && !selectedIds.has(risk.id) && !hasLensMatch) {
    score -= 2;
  }
  if (tuning.alignmentPriority === 'strict' && !selectedIds.has(risk.id) && !hasLensMatch && (causeMatches + impactMatches + narrativeMatches) === 0) {
    score -= 1.5;
    reasons.push('Strict alignment is pushing off-path risks out of the recommended set.');
  }

  const riskKey = normaliseLearningRiskKey(risk.title);
  const keptCount = Number(feedbackSummary?.keptByTitle?.[riskKey] || 0);
  const removedCount = Number(feedbackSummary?.removedByTitle?.[riskKey] || 0);
  if (keptCount > removedCount) {
    score += Math.min(5, keptCount * 1.5);
    reasons.push('Analysts in similar scenarios usually keep this risk in scope.');
  } else if (removedCount > keptCount) {
    score -= Math.min(5, removedCount * 1.5);
    reasons.push('Analysts in similar scenarios often remove this risk as out of scope.');
  }
  const sharedRiskWeight = lookupStep1FeedbackRiskWeight(feedbackProfile?.combined, risk.title);
  if (sharedRiskWeight > 0.35) {
    score += Math.min(4.5, sharedRiskWeight * 1.7);
    reasons.push('Repeated live-AI feedback across similar scenarios tends to keep this risk in scope.');
  } else if (sharedRiskWeight < -0.35) {
    score -= Math.min(4.5, Math.abs(sharedRiskWeight) * 1.7);
    reasons.push('Repeated live-AI feedback across similar scenarios tends to remove this risk as out of scope.');
  }
  if (!hasLensMatch && Number(feedbackProfile?.combined?.wrongDomainPressure || 0) > 0) {
    score -= Math.min(2.5, Number(feedbackProfile.combined.wrongDomainPressure || 0) * 0.12);
  }

  const fit = selectedIds.has(risk.id)
    ? (score >= 8 ? 'selected' : 'selected-review')
    : score >= 8
      ? 'strong'
      : score >= 4
        ? 'possible'
        : 'weak';
  return {
    score,
    fit,
    reasons: Array.from(new Set(reasons)).slice(0, 2)
  };
}

function explainRiskFit(match, selected) {
  if (selected && match?.reasons?.length) return `Already included in this assessment. ${match.reasons.join(' ')}`;
  if (selected) return 'Already included in this assessment.';
  if (match?.reasons?.length) return match.reasons.join(' ');
  if (match?.fit === 'strong') return 'Good fit because it closely matches the current scenario draft.';
  if (match?.fit === 'possible') return 'Possibly in scope, but review whether it shares the same event and business impact.';
  return 'Likely separate or lower-confidence. Include it only if it clearly belongs in the same assessment.';
}

function explainSelectedReviewRisk(risk, match) {
  if (match?.fit !== 'selected-review') return '';
  const lensLabel = String(AppState.draft?.scenarioLens?.label || 'current').trim().toLowerCase();
  const source = String(risk?.source || '').trim().toLowerCase();
  if (source === 'manual') {
    return `Still shown because it was added manually earlier, but it does not align strongly with the current ${lensLabel} scenario.`;
  }
  if (source === 'dry-run') {
    return `Still shown because it came from the loaded example, but it does not align strongly with the current ${lensLabel} scenario.`;
  }
  if (source === 'register' || source === 'ai+register') {
    return `Still shown because it came from uploaded material, but it does not align strongly with the current ${lensLabel} scenario.`;
  }
  // Make retained legacy AI cards explicit so users understand why they appeared at all.
  return `Still shown because it was selected from an earlier shortlist, but it does not align strongly with the current ${lensLabel} scenario.`;
}

function renderRiskSelectionSection(title, subtitle, risks, selectedIds, regulations, sectionClass = '') {
  if (!risks.length) return '';
  const sourceLabel = risk => risk.source === 'manual'
    ? 'Manual'
    : risk.source === 'dry-run'
      ? 'Example'
      : risk.source === 'scenario-draft'
      ? 'Built draft'
      : risk.source === 'register' || risk.source === 'ai+register'
        ? 'Upload'
        : 'AI generated';
  const renderConfidenceBadge = (risk) => risk?.confidence === 'high'
    ? '<span class="risk-confidence risk-confidence--high">Strong match</span>'
    : risk?.confidence === 'low'
      ? '<span class="risk-confidence risk-confidence--low">Speculative</span>'
      : '';
  // Risk titles, descriptions, and regulation labels can come from uploaded files or AI suggestions, so escape before rendering.
  return `<div class="${escapeHtml(String(sectionClass))}" style="display:flex;flex-direction:column;gap:var(--sp-4)"><div><div class="context-panel-title">${escapeHtml(String(title))}</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(String(subtitle))}</div></div><div class="risk-selection-grid">${risks.map(({ risk, match }) => {
    const needsReview = match?.fit === 'selected-review';
    const retainedReason = explainSelectedReviewRisk(risk, match);
    return `<div class="risk-pick-card ${needsReview ? 'risk-pick-card--review' : ''}"><div class="risk-pick-head" style="align-items:flex-start"><label style="display:flex;gap:12px;align-items:flex-start;flex:1;cursor:pointer"><input type="checkbox" class="risk-select-checkbox" data-risk-id="${escapeHtml(String(risk.id || ''))}" ${selectedIds.has(risk.id) ? 'checked' : ''} style="margin-top:4px"><div><div class="risk-pick-title">${escapeHtml(String(risk.title || 'Untitled risk'))}${renderConfidenceBadge(risk)}</div><div class="risk-pick-badges"><span class="risk-pick-badge ${needsReview ? 'risk-pick-badge--review' : ''}">${escapeHtml(String(risk.category || 'Uncategorized'))}</span><span class="risk-pick-badge risk-pick-badge--source">${escapeHtml(String(sourceLabel(risk)))}</span>${needsReview ? '<span class="risk-pick-badge risk-pick-badge--review">Needs review</span>' : ''}</div></div></label><button class="btn btn--ghost btn--sm btn-remove-risk" data-risk-id="${escapeHtml(String(risk.id || ''))}" type="button">Remove</button></div>${risk.description ? `<p class="risk-pick-desc">${escapeHtml(String(risk.description))}</p>` : ''}${retainedReason ? `<div class="risk-pick-review-note">${escapeHtml(retainedReason)}</div>` : ''}${renderStep1AiRiskFeedback(risk)}<div class="form-help" style="margin-bottom:10px">${escapeHtml(String(explainRiskFit(match, selectedIds.has(risk.id))))}</div><div class="citation-chips">${(risk.regulations || []).length ? risk.regulations.slice(0, 4).map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('') : regulations.slice(0, 2).map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('')}</div></div>`;
  }).join('')}</div></div>`;
}

function renderSelectedRiskCards(riskCandidates, selectedRisks, regulations) {
  const cleanedRisks = (riskCandidates || []).filter(risk => !isNoiseRiskText(risk.title) && risk.title !== '-');
  const selectedIds = new Set((selectedRisks || []).map(risk => risk.id));
  if (!cleanedRisks.length) {
    const hasDraft = !!String(AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || '').trim();
    return `<div class="empty-state"><div>No candidate risks yet. Start with the guided builder, refine a scenario draft with AI, or import a register to build your shortlist.</div>${hasDraft ? `<div style="margin-top:var(--sp-4)"><button class="btn btn--secondary" id="btn-generate-risks-empty-state" type="button">Generate Risks From Current Draft</button></div>` : ''}<div class="risk-empty-manual" style="margin-top:var(--sp-5);padding-top:var(--sp-4);border-top:1px solid var(--border)"><div class="form-help" style="margin-bottom:8px">Know the exact risk? Add it directly:</div><div class="inline-action-row"><input class="form-input" id="risk-empty-manual-input" type="text" placeholder="e.g. Export control screening failure"><button class="btn btn--secondary" id="btn-risk-empty-add" type="button">Add Risk</button></div></div></div>`;
  }
  const linkedRecommendations = getLinkedRiskRecommendations(selectedRisks || []);
  const narrative = AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft) || '';
  const assessmentSignals = buildStep1AssessmentSignals(narrative);
  const feedbackSummary = getStep1RiskSignalSummary(assessmentSignals);
  const hierarchicalFeedback = getStep1HierarchicalFeedbackProfile(assessmentSignals);
  const ranked = cleanedRisks
    .map(risk => {
      const match = scoreRiskForCurrentAssessment(risk, assessmentSignals, selectedIds, feedbackSummary, hierarchicalFeedback);
      return { risk, match, score: match.score };
    })
    .sort((a, b) => b.score - a.score || String(a.risk.title || '').localeCompare(String(b.risk.title || '')));
  const selectedReviewCount = ranked.filter(item => selectedIds.has(item.risk.id) && item.match.fit === 'selected-review').length;
  const tuning = getStep1AiTuningSettings();
  const recommendationThreshold = tuning.shortlistDiscipline === 'strict' ? 5 : 4;
  const recommended = ranked.filter(item => selectedIds.has(item.risk.id) || item.match.fit === 'strong' || item.score >= recommendationThreshold);
  const extras = ranked.filter(item => !recommended.includes(item));
  const selectedCount = selectedRisks.length;
  const scopeHint = selectedCount > 4
    ? 'This looks broad. Remove risks that do not share the same event, scope, or business impact.'
    : selectedCount >= 1
      ? 'Good scope so far. Keep only the risks that clearly belong in one coherent assessment.'
      : 'Choose the risks that share the same event, scope, or business impact.';
  const additionalRisksDisclosureKey = getDisclosureStateKey('/wizard/1', 'show additional possible risks');
  return `${linkedRecommendations.length ? `<div class="card mb-4" style="background:var(--bg-elevated)"><div class="context-panel-title">Suggested linked-risk groupings</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${linkedRecommendations.map(group => `<div><div style="font-size:.78rem;font-weight:600;color:var(--text-primary)">${escapeHtml(String(group.label || 'Linked risks'))}</div><div class="context-panel-copy" style="margin-top:4px">${escapeHtml(String((Array.isArray(group.risks) ? group.risks : []).join(', ')))}</div></div>`).join('')}</div><div class="context-panel-foot">${escapeHtml(String(AppState.draft.linkAnalysis || 'Treat these as linked where one control or event could trigger the others in the same scenario.'))}</div></div>` : ''}
  ${selectedReviewCount ? `<div class="wizard-summary-band wizard-summary-band--quiet premium-guidance-strip premium-guidance-strip--warning mb-4"><div><div class="wizard-summary-band__label">Scope review suggested</div><strong>${selectedReviewCount} selected risk${selectedReviewCount === 1 ? '' : 's'} may sit outside the current scenario lens</strong><div class="wizard-summary-band__copy">Keep them only if they clearly belong in the same event path, business impact, and management discussion.</div></div></div>` : ''}
  <div class="flex items-center gap-3 mb-4" style="flex-wrap:wrap">
    <button class="btn btn--ghost btn--sm" id="btn-select-all-risks" type="button">Select All</button>
    <button class="btn btn--ghost btn--sm" id="btn-clear-all-risks" type="button">Clear All</button>
    <span class="badge badge--neutral">${selectedCount} selected</span>
    <span class="form-help">${scopeHint}</span>
  </div>
  <div id="shortlist-coach-banner" class="shortlist-coach-banner" style="display:none" role="status" aria-live="polite"></div>
  ${renderRiskSelectionSection('Recommended for this assessment', 'These are the strongest candidates based on the current event, asset, cause, and impact you described.', recommended, selectedIds, regulations)}
  ${extras.length ? `<details class="wizard-disclosure" data-disclosure-state-key="${escapeHtml(additionalRisksDisclosureKey)}" ${getDisclosureOpenState(additionalRisksDisclosureKey, false) ? 'open' : ''}><summary>Show additional possible risks <span class="badge badge--neutral">${extras.length}</span></summary><div class="wizard-disclosure-body">${renderRiskSelectionSection('Available but likely out of scope', 'Keep these only if they clearly belong in the same event path or business outcome.', extras, selectedIds, regulations)}</div></details>` : ''}`;
}

let _coachDebounce = null;

function bindRiskCardActions({ buList = getBUList() } = {}) {
  document.getElementById('btn-generate-risks-empty-state')?.addEventListener('click', async (event) => {
    const narrative = AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft) || '';
    await generateShortlistFromDraftWithAI({
      narrative,
      button: event?.currentTarget || document.getElementById('btn-generate-risks-empty-state'),
      replaceGenerated: true,
      preserveScroll: true
    });
  });
  document.querySelectorAll('.risk-select-checkbox').forEach(box => {
    box.addEventListener('change', () => {
      const risk = getRiskCandidates().find(item => item.id === box.dataset.riskId);
      const selectedIds = new Set(Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
      if (box.checked) {
        selectedIds.add(box.dataset.riskId);
        // Keep/skip choices are one of the highest-signal learning loops, so record them when analysts confirm scope.
        recordStep1RiskDecision(risk, 'keep');
      } else {
        selectedIds.delete(box.dataset.riskId);
        recordStep1RiskDecision(risk, 'remove');
      }
      AppState.draft.selectedRiskIds = Array.from(selectedIds);
      syncRiskSelection();
      persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true, preserveScroll: true });
      clearTimeout(_coachDebounce);
      const coachEl = document.getElementById('shortlist-coach-banner');
      if (coachEl) {
        coachEl.className = 'shortlist-coach-banner';
        coachEl.innerHTML = '';
        coachEl.style.display = 'none';
      }
    });
  });
  document.getElementById('btn-select-all-risks')?.addEventListener('click', () => {
    const risks = getRiskCandidates();
    AppState.draft.selectedRiskIds = risks.map(risk => risk.id);
    risks.forEach(risk => recordStep1RiskDecision(risk, 'keep'));
    syncRiskSelection();
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true, preserveScroll: true });
  });
  document.getElementById('btn-clear-all-risks')?.addEventListener('click', () => {
    getRiskCandidates().forEach(risk => recordStep1RiskDecision(risk, 'remove'));
    AppState.draft.selectedRiskIds = [];
    syncRiskSelection();
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true, preserveScroll: true });
  });
  document.querySelectorAll('.btn-remove-risk').forEach(btn => {
    btn.addEventListener('click', async () => {
      const risk = getRiskCandidates().find(item => item.id === btn.dataset.riskId);
      const reason = await promptStep1RiskRemovalReason(risk);
      if (!reason) return;
      await applyStep1RiskRemoval(btn.dataset.riskId, reason, {
        buList,
        scenarioGeographies: getScenarioGeographies()
      });
    });
  });
}

function updateStep1AiFeedbackScoreLabel(target = 'draft', score = 3) {
  const labelEl = document.getElementById(`ai-feedback-score-label-${target}`);
  if (!labelEl) return;
  const safeScore = Math.max(1, Math.min(5, Math.round(Number(score || 3))));
  const labels = { 1: 'Poor fit', 2: 'Weak', 3: 'Mixed', 4: 'Good', 5: 'Strong' };
  labelEl.textContent = labels[safeScore] || 'Mixed';
}

function getSelectedStep1AiFeedbackReasons(target = 'draft') {
  return Array.from(document.querySelectorAll(`.ai-feedback-reason[data-feedback-target="${target}"][aria-pressed="true"]`))
    .map(button => normaliseStep1AiFeedbackReason(button.dataset.feedbackReason || ''))
    .filter(Boolean);
}

async function saveStep1AiFeedback(target = 'draft', { buList = getBUList() } = {}) {
  const scoreEl = document.getElementById(`ai-feedback-score-${target}`);
  if (!scoreEl) return;
  const score = Math.max(1, Math.min(5, Math.round(Number(scoreEl.value || 3))));
  const reasons = getSelectedStep1AiFeedbackReasons(target);
  const username = AuthService.getCurrentUser()?.username || '';
  const runtimeMode = getStep1AiRuntimeMode(AppState.draft);
  const riskCandidates = getRiskCandidates();
  const selectedRisks = getSelectedRisks();
  const bu = (Array.isArray(buList) ? buList : []).find(item => item?.id === AppState.draft?.buId) || null;
  const payload = {
    target,
    score,
    reasons,
    runtimeMode,
    buId: AppState.draft?.buId || '',
    buName: bu?.name || AppState.draft?.buName || '',
    functionKey: AppState.draft?.scenarioLens?.functionKey || '',
    lensKey: AppState.draft?.scenarioLens?.key || '',
    scenarioFingerprint: buildStep1AiFeedbackScenarioFingerprint(AppState.draft),
    outputFingerprint: target === 'draft'
      ? buildStep1DraftFeedbackOutputFingerprint(AppState.draft)
      : buildStep1ShortlistFeedbackOutputFingerprint(riskCandidates, selectedRisks),
    shownRiskTitles: riskCandidates.map(risk => risk?.title || ''),
    keptRiskTitles: selectedRisks.map(risk => risk?.title || ''),
    removedRiskTitles: riskCandidates
      .filter(risk => !selectedRisks.some(selected => selected?.id === risk?.id))
      .map(risk => risk?.title || ''),
    addedRiskTitles: selectedRisks
      .filter(risk => String(risk?.source || '').trim().toLowerCase() === 'manual')
      .map(risk => risk?.title || ''),
    citations: Array.isArray(AppState.draft?.citations) ? AppState.draft.citations : [],
    submittedBy: username
  };
  const feedbackSync = await persistStep1AiFeedbackPayload(username, payload);
  AppState.draft.aiFeedback = {
    ...(AppState.draft.aiFeedback && typeof AppState.draft.aiFeedback === 'object' ? AppState.draft.aiFeedback : {}),
    [target]: {
      score,
      reasons,
      runtimeMode,
      savedAt: Date.now()
    }
  };
  saveDraft();
  if (feedbackSync.shared === false) {
    UI.toast(target === 'draft'
      ? 'Saved scenario-draft feedback locally. Shared learning sync is unavailable right now.'
      : 'Saved shortlist feedback locally. Shared learning sync is unavailable right now.', 'warning', 5000);
  } else {
    UI.toast(target === 'draft' ? 'Saved scenario-draft feedback.' : 'Saved shortlist feedback.', 'success');
  }
  persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: false, preserveScroll: true });
}

async function persistStep1AiFeedbackPayload(username = '', payload = {}) {
  const result = { local: false, shared: null };
  if (username && typeof LearningStore !== 'undefined' && typeof LearningStore.recordAiFeedback === 'function') {
    const localEvent = LearningStore.recordAiFeedback(username, payload);
    if (localEvent && typeof patchLearningStore === 'function' && typeof LearningStore.getLearningStore === 'function') {
      patchLearningStore({ aiFeedback: LearningStore.getLearningStore(username).aiFeedback });
    }
    result.local = !!localEvent;
  }
  if (typeof OrgIntelligenceService !== 'undefined' && typeof OrgIntelligenceService.recordAiFeedback === 'function') {
    try {
      result.shared = !!(await OrgIntelligenceService.recordAiFeedback(payload));
    } catch {
      result.shared = false;
    }
  }
  return result;
}

function updateStep1RiskFeedbackUi(riskId = '', score = 0, savedAt = 0, runtimeMode = 'local') {
  const safeRiskId = String(riskId || '').trim();
  if (!safeRiskId) return;
  const safeScore = Math.max(0, Math.min(5, Math.round(Number(score || 0))));
  Array.from(document.querySelectorAll('.step1-risk-feedback__star'))
    .filter((button) => String(button.dataset.riskFeedbackId || '').trim() === safeRiskId)
    .forEach((button) => {
      const buttonScore = Number(button.dataset.riskFeedbackScore || 0);
      button.classList.toggle('is-active', buttonScore <= safeScore);
      button.setAttribute('aria-checked', buttonScore === safeScore ? 'true' : 'false');
    });
  const statusEl = document.getElementById(`risk-feedback-status-${safeRiskId}`);
  if (statusEl) {
    const savedLabel = savedAt
      ? `Saved ${new Date(savedAt).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}`
      : 'Not yet rated';
    const runtimeLabel = runtimeMode === 'live_ai' ? 'Live AI' : runtimeMode === 'fallback' ? 'Fallback guidance' : 'Local guidance';
    statusEl.textContent = `${savedLabel} · ${runtimeLabel}`;
  }
}

async function saveStep1AiRiskFeedback(riskId = '', score = 0, {
  buList = getBUList(),
  reasons = [],
  silent = false
} = {}) {
  const safeRiskId = String(riskId || '').trim();
  const risk = getRiskCandidates().find((item) => String(item?.id || '').trim() === safeRiskId);
  if (!risk || !isStep1GeneratedRiskFeedbackEligible(risk)) return;
  const safeScore = Math.max(1, Math.min(5, Math.round(Number(score || 0))));
  const username = AuthService.getCurrentUser()?.username || '';
  const runtimeMode = getStep1AiRuntimeMode(AppState.draft);
  const selectedRiskIds = new Set(Array.isArray(AppState.draft?.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
  const bu = (Array.isArray(buList) ? buList : []).find(item => item?.id === AppState.draft?.buId) || null;
  const safeReasons = Array.from(new Set(
    (Array.isArray(reasons) ? reasons : [])
      .map(normaliseStep1AiFeedbackReason)
      .filter(Boolean)
  )).slice(0, 6);
  const payload = {
    target: 'risk',
    score: safeScore,
    reasons: safeReasons,
    runtimeMode,
    buId: AppState.draft?.buId || '',
    buName: bu?.name || AppState.draft?.buName || '',
    functionKey: AppState.draft?.scenarioLens?.functionKey || '',
    lensKey: AppState.draft?.scenarioLens?.key || '',
    scenarioFingerprint: buildStep1AiFeedbackScenarioFingerprint(AppState.draft),
    outputFingerprint: buildStep1RiskFeedbackOutputFingerprint(risk),
    riskId: safeRiskId,
    riskTitle: risk?.title || '',
    riskCategory: risk?.category || '',
    riskSource: risk?.source || '',
    selectedInAssessment: selectedRiskIds.has(safeRiskId),
    submittedBy: username
  };
  const feedbackSync = await persistStep1AiFeedbackPayload(username, payload);
  const savedAt = Date.now();
  AppState.draft.aiFeedback = {
    ...(AppState.draft.aiFeedback && typeof AppState.draft.aiFeedback === 'object' ? AppState.draft.aiFeedback : {}),
    risks: {
      ...((AppState.draft.aiFeedback && typeof AppState.draft.aiFeedback.risks === 'object') ? AppState.draft.aiFeedback.risks : {}),
      [safeRiskId]: {
        score: safeScore,
        reasons: safeReasons,
        runtimeMode,
        savedAt
      }
    }
  };
  if (!silent) saveDraft();
  if (!silent) updateStep1RiskFeedbackUi(safeRiskId, safeScore, savedAt, runtimeMode);
  if (!silent && feedbackSync.shared === false) {
    UI.toast('Saved risk feedback locally. Shared learning sync is unavailable right now.', 'warning', 5000);
  }
  return {
    shared: feedbackSync.shared,
    local: feedbackSync.local,
    savedAt,
    runtimeMode,
    reasons: safeReasons
  };
}

function bindStep1AiFeedbackActions({ buList = getBUList() } = {}) {
  document.querySelectorAll('.ai-feedback-score').forEach((input) => {
    updateStep1AiFeedbackScoreLabel(input.dataset.feedbackTarget || 'draft', input.value);
    input.addEventListener('input', () => {
      updateStep1AiFeedbackScoreLabel(input.dataset.feedbackTarget || 'draft', input.value);
    });
  });
  document.querySelectorAll('.ai-feedback-reason').forEach((button) => {
    button.addEventListener('click', () => {
      const active = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', active ? 'false' : 'true');
      button.classList.toggle('btn--secondary', !active);
      button.classList.toggle('btn--ghost', active);
    });
  });
  document.querySelectorAll('.btn-save-ai-feedback').forEach((button) => {
    button.addEventListener('click', async () => {
      await saveStep1AiFeedback(button.dataset.feedbackTarget || 'draft', { buList });
    });
  });
  document.querySelectorAll('.step1-risk-feedback__star').forEach((button) => {
    button.addEventListener('click', async () => {
      await saveStep1AiRiskFeedback(
        button.dataset.riskFeedbackId || '',
        button.dataset.riskFeedbackScore || 0,
        { buList }
      );
    });
  });
}

async function handleRegisterUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = getFileExtension(file.name);
  const unsupported = ['docx', 'pptx', 'pdf', 'zip'];
  if (unsupported.includes(ext)) {
    AppState.draft.uploadedRegisterName = '';
    AppState.draft.registerFindings = '';
    AppState.draft.registerMeta = null;
    saveDraft();
    e.target.value = '';
    UI.toast('This file type is not supported for direct browser parsing. Please export the register as Excel, TXT, CSV, TSV, JSON, or Markdown first.', 'warning', 7000);
    return;
  }
  let parsed;
  try {
    parsed = await parseRegisterFile(file);
  } catch (parseError) {
    console.error('parseRegisterFile failed:', parseError);
    AppState.draft.uploadedRegisterName = '';
    AppState.draft.registerFindings = '';
    AppState.draft.registerMeta = null;
    saveDraft();
    e.target.value = '';
    UI.toast(
      'The file could not be read. Try saving as CSV or plain text first.',
      'danger',
      7000
    );
    return;
  }
  if (looksLikeBinaryRegister(parsed.text) && !['xlsx', 'xls'].includes(ext)) {
    AppState.draft.uploadedRegisterName = '';
    AppState.draft.registerFindings = '';
    AppState.draft.registerMeta = null;
    saveDraft();
    e.target.value = '';
    UI.toast('The uploaded file appears to be binary or unreadable. Please convert it to Excel, TXT, CSV, TSV, JSON, or Markdown before uploading.', 'warning', 7000);
    return;
  }
  clearLoadedDryRunFlag();
  clearStep1StaleAssistState(parsed.text, {
    clearGeneratedRisks: true,
    clearNarrative: true,
    forceClearConversation: true
  });
  AppState.draft.uploadedRegisterName = file.name;
  AppState.draft.registerFindings = parsed.text;
  AppState.draft.registerMeta = parsed.meta;
  saveDraft();
  const sheetInfo = parsed.meta?.sheetCount > 1 ? ` (${parsed.meta.sheetCount} sheets parsed)` : '';
  UI.toast(`Loaded ${file.name}${sheetInfo}.`, 'success');
}

async function runIntakeAssist() {
  return window.Step1Assist.runIntakeAssist();
}

async function enhanceNarrativeWithAI() {
  return window.Step1Assist.enhanceNarrativeWithAI();
}

async function generateShortlistFromDraftWithAI(options = {}) {
  return window.Step1Assist.generateShortlistFromDraft(options);
}

async function analyseUploadedRegister() {
  return window.Step1Assist.analyseUploadedRegister();
}
