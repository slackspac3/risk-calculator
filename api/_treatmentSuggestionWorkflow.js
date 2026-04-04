'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const { buildTraceEntry, callAi, normaliseAiError, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
const { buildDeterministicFallbackResult, buildFallbackFromError, buildManualModeResult, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const { calibrateCoherenceConfidence } = require('./_confidenceCalibration');
const { workflowUtils } = require('./_scenarioDraftWorkflow');
const {
  SCENARIO_TAXONOMY,
  SCENARIO_TAXONOMY_FAMILY_BY_KEY,
  SCENARIO_TAXONOMY_MECHANISM_BY_KEY,
  SCENARIO_TAXONOMY_OVERLAY_BY_KEY
} = require('./_scenarioTaxonomy');
const {
  buildScenarioLens,
  classifyScenario,
  isCompatibleScenarioLens
} = require('./_scenarioClassification');

const {
  buildContextPromptBlock,
  buildEvidenceMeta,
  cleanUserFacingText,
  compactInputValue,
  normaliseAdminSettingsInput,
  normaliseBlockInputText,
  normaliseBusinessUnitInput,
  normaliseCitationInputs,
  normaliseInlineInputText,
  normalisePriorMessagesInput,
  normaliseStringListInput,
  truncateText,
  withEvidenceMeta
} = workflowUtils;

function normaliseBenchmarkBasis(value = '') {
  return cleanUserFacingText(value, { maxSentences: 3 });
}

function normaliseInputRationale(value = {}) {
  return {
    tef: cleanUserFacingText(value?.tef || '', { maxSentences: 2 }),
    vulnerability: cleanUserFacingText(value?.vulnerability || '', { maxSentences: 2 }),
    lossComponents: cleanUserFacingText(value?.lossComponents || '', { maxSentences: 2 })
  };
}

function normaliseGuidance(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : [])
    .map((item) => cleanUserFacingText(item, { maxSentences: 1, stripTrailingPeriod: true }))
    .filter(Boolean)))
    .slice(0, 5);
}

function ensureRange(value, fallbackRange) {
  const toNumber = (next, fallback = 0) => {
    const parsed = Number(next);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    min: toNumber(value?.min, toNumber(fallbackRange?.min, 0)),
    likely: toNumber(value?.likely, toNumber(fallbackRange?.likely, 0)),
    max: toNumber(value?.max, toNumber(fallbackRange?.max, 0))
  };
}

function normaliseFairParamsInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  const next = {};
  Object.entries(value).forEach(([key, item]) => {
    const parsed = Number(item);
    if (Number.isFinite(parsed)) next[key] = parsed;
  });
  return Object.keys(next).length ? next : undefined;
}

function normaliseResultsInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  return compactInputValue({
    inputs: normaliseFairParamsInput(value.inputs)
  });
}

function normaliseScenarioLensInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  return compactInputValue({
    key: normaliseInlineInputText(value.key || ''),
    label: normaliseInlineInputText(value.label || ''),
    functionKey: normaliseInlineInputText(value.functionKey || ''),
    estimatePresetKey: normaliseInlineInputText(value.estimatePresetKey || ''),
    secondaryKeys: normaliseStringListInput(value.secondaryKeys, { maxItems: 4 })
  });
}

function normaliseStructuredScenarioInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  return compactInputValue({
    assetService: normaliseInlineInputText(value.assetService || ''),
    primaryDriver: normaliseInlineInputText(value.primaryDriver || ''),
    eventPath: normaliseBlockInputText(value.eventPath || ''),
    effect: normaliseBlockInputText(value.effect || '')
  });
}

function normaliseSelectedRiskInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  return compactInputValue({
    title: normaliseInlineInputText(value.title || ''),
    category: normaliseInlineInputText(value.category || ''),
    description: normaliseBlockInputText(value.description || '')
  });
}

function normaliseSelectedRisksInput(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normaliseSelectedRiskInput(item))
    .filter(Boolean)
    .slice(0, 8);
}

function normaliseBaselineAssessmentInput(value = {}) {
  if (!workflowUtils.isPlainObject || !workflowUtils.isPlainObject(value)) return undefined;
  return compactInputValue({
    scenarioTitle: normaliseInlineInputText(value.scenarioTitle || ''),
    narrative: normaliseBlockInputText(value.narrative || ''),
    enhancedNarrative: normaliseBlockInputText(value.enhancedNarrative || ''),
    structuredScenario: normaliseStructuredScenarioInput(value.structuredScenario),
    scenarioLens: normaliseScenarioLensInput(value.scenarioLens),
    selectedRisks: normaliseSelectedRisksInput(value.selectedRisks),
    geography: normaliseInlineInputText(value.geography || ''),
    applicableRegulations: normaliseStringListInput(value.applicableRegulations, { maxItems: 12 }),
    fairParams: normaliseFairParamsInput(value.fairParams),
    results: normaliseResultsInput(value.results)
  });
}

function uniqueStrings(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)));
}

function normaliseSemanticText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countPhraseMatches(text = '', phrases = []) {
  const haystack = normaliseSemanticText(text);
  if (!haystack) return 0;
  return uniqueStrings(phrases).reduce((count, phrase) => {
    const cleanPhrase = normaliseSemanticText(phrase);
    if (!cleanPhrase) return count;
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(cleanPhrase).replace(/\\ /g, '\\s+')}(?:$|[^a-z0-9])`, 'i');
    return pattern.test(haystack) ? count + 1 : count;
  }, 0);
}

function extractContentTokens(value = '') {
  return uniqueStrings(
    String(value || '')
      .toLowerCase()
      .match(/[a-z0-9]{4,}/g) || []
  );
}

function countTokenOverlap(tokens = [], referenceTokens = []) {
  const referenceSet = new Set(Array.isArray(referenceTokens) ? referenceTokens : []);
  return uniqueStrings(tokens).filter((token) => referenceSet.has(token)).length;
}

function hasNegatedFamilyReference(text = '', phrase = '') {
  const cleanPhrase = normaliseSemanticText(phrase);
  const haystack = normaliseSemanticText(text);
  if (!cleanPhrase || !haystack) return false;
  return new RegExp(`(?:not|no|without|rather than|instead of|avoid|keeps? .* out of)\\s+[^.]{0,80}${escapeRegex(cleanPhrase).replace(/\\ /g, '\\s+')}`, 'i').test(haystack);
}

function joinList(values = []) {
  const items = uniqueStrings(values);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function collectFamilyThemePhrases(family = null) {
  if (!family || typeof family !== 'object') return [];
  return uniqueStrings([
    family.label,
    ...(Array.isArray(family.preferredRiskThemes) ? family.preferredRiskThemes : []),
    ...(Array.isArray(family.shortlistSeedThemes) ? family.shortlistSeedThemes : []),
    ...(Array.isArray(family.examplePhrases) ? family.examplePhrases.slice(0, 4) : []),
    ...(Array.isArray(family.positiveSignals) ? family.positiveSignals.slice(0, 6).map((signal) => signal?.text || '') : [])
  ])
    .map((item) => cleanUserFacingText(item, { maxSentences: 1 }))
    .filter(Boolean)
    .slice(0, 16);
}

function collectMechanismThemePhrases(mechanism = null) {
  if (!mechanism || typeof mechanism !== 'object') return [];
  return uniqueStrings([
    mechanism.label,
    ...(Array.isArray(mechanism.signals) ? mechanism.signals : [])
  ])
    .filter(Boolean)
    .slice(0, 10);
}

function collectOverlayThemePhrases(overlay = null) {
  if (!overlay || typeof overlay !== 'object') return [];
  return uniqueStrings([
    overlay.label,
    String(overlay.key || '').replace(/_/g, ' ')
  ]).filter(Boolean);
}

function collectAllowedSecondaryFamilyKeys(primaryFamily = null) {
  if (!primaryFamily || typeof primaryFamily !== 'object') return [];
  return uniqueStrings([
    ...(Array.isArray(primaryFamily.allowedSecondaryFamilies) ? primaryFamily.allowedSecondaryFamilies : []),
    ...(Array.isArray(primaryFamily.canCoExistWith) ? primaryFamily.canCoExistWith : []),
    ...(Array.isArray(primaryFamily.canEscalateTo) ? primaryFamily.canEscalateTo : [])
  ]);
}

function familyConflictsWith(left = null, right = null) {
  if (!left || !right || !left.key || !right.key || left.key === right.key) return false;
  const leftConflicts = new Set([
    ...(Array.isArray(left.cannotBePrimaryWith) ? left.cannotBePrimaryWith : []),
    ...(Array.isArray(left.forbiddenDriftFamilies) ? left.forbiddenDriftFamilies : [])
  ]);
  const rightConflicts = new Set([
    ...(Array.isArray(right.cannotBePrimaryWith) ? right.cannotBePrimaryWith : []),
    ...(Array.isArray(right.forbiddenDriftFamilies) ? right.forbiddenDriftFamilies : [])
  ]);
  return leftConflicts.has(right.key) || rightConflicts.has(left.key);
}

function buildSelectedRiskThemePhrases(selectedRisks = []) {
  return uniqueStrings(
    (Array.isArray(selectedRisks) ? selectedRisks : [])
      .flatMap((risk) => [risk?.title, risk?.category, risk?.description])
      .map((item) => cleanUserFacingText(item || '', { maxSentences: 1 }))
      .filter(Boolean)
  ).slice(0, 18);
}

function normaliseTreatmentSuggestionInput(input = {}) {
  return compactInputValue({
    baselineAssessment: normaliseBaselineAssessmentInput(input.baselineAssessment),
    improvementRequest: normaliseBlockInputText(input.improvementRequest || ''),
    businessUnit: normaliseBusinessUnitInput(input.businessUnit),
    adminSettings: normaliseAdminSettingsInput(input.adminSettings),
    citations: normaliseCitationInputs(input.citations),
    priorMessages: normalisePriorMessagesInput(input.priorMessages),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

function cloneValue(value = null) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getBaselineFairInputs(input = {}) {
  return input?.baselineAssessment?.fairParams || input?.baselineAssessment?.results?.inputs || {};
}

function buildAcceptedScenarioSourceText(input = {}) {
  const baseline = input?.baselineAssessment || {};
  const structured = baseline?.structuredScenario || {};
  return uniqueStrings([
    baseline?.scenarioTitle,
    baseline?.enhancedNarrative,
    baseline?.narrative,
    structured?.assetService,
    structured?.primaryDriver,
    structured?.eventPath,
    structured?.effect
  ]).join('. ');
}

function resolveTreatmentAcceptedFamily(input = {}) {
  const baseline = input?.baselineAssessment || {};
  const scenarioText = buildAcceptedScenarioSourceText(input);
  const hint = baseline?.scenarioLens?.key || baseline?.scenarioLens?.label || '';
  const classification = classifyScenario(scenarioText, {
    scenarioLensHint: hint
  });
  const primaryFamily = classification?.primaryFamily?.key
    ? SCENARIO_TAXONOMY_FAMILY_BY_KEY[classification.primaryFamily.key] || classification.primaryFamily
    : null;
  return {
    scenarioText,
    classification,
    primaryFamily
  };
}

function buildAcceptedTreatmentContext(input = {}) {
  const baseline = input?.baselineAssessment || {};
  const structured = baseline?.structuredScenario || {};
  const selectedRiskThemes = buildSelectedRiskThemePhrases(baseline?.selectedRisks);
  const accepted = resolveTreatmentAcceptedFamily(input);
  const primaryFamily = accepted.primaryFamily || null;
  const acceptedSecondaryFamilies = Array.isArray(accepted.classification?.secondaryFamilies)
    ? accepted.classification.secondaryFamilies
        .map((family) => family?.key ? SCENARIO_TAXONOMY_FAMILY_BY_KEY[family.key] || family : null)
        .filter(Boolean)
    : [];
  const acceptedSecondaryFamilyKeys = uniqueStrings(acceptedSecondaryFamilies.map((family) => family.key));
  const allowedSecondaryFamilyKeys = uniqueStrings([
    ...acceptedSecondaryFamilyKeys,
    ...collectAllowedSecondaryFamilyKeys(primaryFamily)
  ]);
  const mechanisms = Array.isArray(accepted.classification?.mechanisms) ? accepted.classification.mechanisms : [];
  const mechanismKeys = uniqueStrings(mechanisms.map((mechanism) => mechanism?.key));
  const overlays = Array.isArray(accepted.classification?.overlays) ? accepted.classification.overlays : [];
  const overlayKeys = uniqueStrings(overlays.map((overlay) => overlay?.key));
  const primaryThemePhrases = collectFamilyThemePhrases(primaryFamily);
  const secondaryThemePhrases = uniqueStrings(
    acceptedSecondaryFamilies.flatMap((family) => collectFamilyThemePhrases(family))
  );
  const mechanismThemePhrases = uniqueStrings(
    mechanismKeys.flatMap((key) => collectMechanismThemePhrases(SCENARIO_TAXONOMY_MECHANISM_BY_KEY[key]))
  );
  const overlayThemePhrases = uniqueStrings(
    overlayKeys.flatMap((key) => collectOverlayThemePhrases(SCENARIO_TAXONOMY_OVERLAY_BY_KEY[key]))
  );
  const blockedFamilyKeys = uniqueStrings([
    ...(Array.isArray(primaryFamily?.forbiddenDriftFamilies) ? primaryFamily.forbiddenDriftFamilies : []),
    ...(Array.isArray(primaryFamily?.cannotBePrimaryWith) ? primaryFamily.cannotBePrimaryWith : [])
  ]);
  const blockedFamilyEntries = blockedFamilyKeys
    .map((key) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[key])
    .filter(Boolean)
    .map((family) => ({
      key: family.key,
      phrases: collectFamilyThemePhrases(family)
    }));
  const anchorPhrases = uniqueStrings([
    baseline?.scenarioTitle,
    baseline?.enhancedNarrative,
    baseline?.narrative,
    structured?.assetService,
    structured?.primaryDriver,
    structured?.eventPath,
    structured?.effect,
    ...selectedRiskThemes
  ]);
  const anchorTokens = uniqueStrings(anchorPhrases.flatMap((item) => extractContentTokens(item)));
  const acceptedLens = buildScenarioLens(accepted.classification || baseline?.scenarioLens || {});
  return {
    acceptedPrimaryFamilyKey: String(primaryFamily?.key || '').trim(),
    acceptedPrimaryFamily: primaryFamily,
    acceptedSecondaryFamilyKeys,
    allowedSecondaryFamilyKeys,
    acceptedMechanismKeys: mechanismKeys,
    acceptedOverlayKeys: overlayKeys,
    acceptedLens,
    selectedRiskThemes,
    primaryThemePhrases,
    secondaryThemePhrases,
    mechanismThemePhrases,
    overlayThemePhrases,
    blockedFamilyEntries,
    anchorPhrases,
    anchorTokens,
    classification: accepted.classification,
    taxonomyVersion: SCENARIO_TAXONOMY.taxonomyVersion
  };
}

function resolveTreatmentProfile(context = {}) {
  const primaryKey = String(context?.acceptedPrimaryFamilyKey || '').trim();
  const hasDisclosureSecondary = (Array.isArray(context?.acceptedSecondaryFamilyKeys) ? context.acceptedSecondaryFamilyKeys : []).includes('data_disclosure');
  const overlaySet = new Set(Array.isArray(context?.acceptedOverlayKeys) ? context.acceptedOverlayKeys : []);
  const base = {
    scenarioLabel: context?.acceptedPrimaryFamily?.label || 'accepted scenario',
    summaryLead: 'The future-state case stays anchored to the accepted scenario event path.',
    changeLead: 'Suggested changes stay tied to the accepted control and resilience path rather than downstream consequences.',
    workflowGuidance: [
      'Keep the future-state case anchored to the accepted scenario rather than a different downstream consequence.',
      'Adjust only the assumptions the proposed treatment would credibly change first.',
      'Use the comparison view to test whether the treatment changes tolerance position materially.'
    ],
    benchmarkBasis: 'Use realistic future-state control and resilience improvements that directly address the accepted scenario path.',
    inputRationale: {
      tef: 'Frequency should only fall where the treatment would credibly reduce how often the accepted scenario succeeds.',
      vulnerability: 'Control and exposure assumptions should only improve where the treatment directly strengthens the accepted scenario path.',
      lossComponents: 'Loss components should improve only where the treatment plausibly limits the accepted event path or its direct downstream consequences.'
    },
    relevantLossComponents: ['incidentResponse', 'businessInterruption', 'reputationContract']
  };
  const profiles = {
    identity_compromise: {
      scenarioLabel: 'accepted identity compromise path',
      summaryLead: 'The future-state case stays anchored to privileged-identity protection, session control, and faster containment of the accepted identity compromise path.',
      changeLead: 'Suggested changes strengthen privileged-access control, reduce account-takeover success, and limit disruption from the same identity-led event path.',
      workflowGuidance: [
        'Prioritise treatments that materially harden privileged identity, session control, and recovery of admin access.',
        'Test whether the proposal reduces successful credential misuse rather than only reducing downstream finance or compliance consequences.',
        'Keep the future-state case anchored to identity restoration, privileged monitoring, and containment speed.'
      ],
      benchmarkBasis: 'Use realistic privileged-identity hardening, session-control, and containment improvements rather than finance-control or policy-remediation substitutes.',
      inputRationale: {
        tef: 'Frequency reduces only where the treatment makes privileged credential misuse or account takeover materially harder.',
        vulnerability: 'Exposure improves where privileged-access control, MFA, session governance, or segmentation is materially stronger.',
        lossComponents: 'Loss improves where containment is faster and access misuse is constrained, not because the scenario is recast as a finance issue.'
      },
      relevantLossComponents: ['incidentResponse', 'businessInterruption', 'reputationContract', ...(hasDisclosureSecondary ? ['dataBreachRemediation'] : [])]
    },
    payment_control_failure: {
      scenarioLabel: 'accepted payment-control failure path',
      summaryLead: 'The future-state case stays anchored to approval discipline, segregation, reconciliation, and payment-control design.',
      changeLead: 'Suggested changes strengthen finance-control design and reduce control breakdown in the same payment process.',
      workflowGuidance: [
        'Prioritise stronger approval, segregation, and reconciliation controls in the payment path.',
        'Do not assume fraud-specific treatments unless deception is explicit in the accepted scenario.',
        'Keep the future-state case focused on the same payment-control failure path.'
      ],
      benchmarkBasis: 'Use realistic finance-control design improvements rather than fraud-response measures unless deception is explicit.',
      inputRationale: {
        tef: 'Frequency reduces where stronger approval and reconciliation make payment-control failure less likely.',
        vulnerability: 'Exposure improves where finance controls, approvals, and oversight materially strengthen the payment path.',
        lossComponents: 'Loss improves where control failure is detected earlier and downstream liability or disruption is contained.'
      },
      relevantLossComponents: ['incidentResponse', 'thirdPartyLiability', 'reputationContract']
    },
    invoice_fraud: {
      scenarioLabel: 'accepted invoice-fraud path',
      summaryLead: 'The future-state case stays anchored to deception-resistant invoice verification, payee validation, and payment challenge controls.',
      changeLead: 'Suggested changes reduce successful deception in the same invoice-fraud event path.',
      workflowGuidance: [
        'Prioritise callback verification, payee-change challenge steps, and anti-deception control design.',
        'Keep the treatment focused on deceptive payment manipulation rather than generic finance-control wording.',
        'Use the future-state case to test whether fraud success becomes meaningfully harder.'
      ],
      benchmarkBasis: 'Use realistic anti-deception and payment-verification improvements rather than generic governance language.',
      inputRationale: {
        tef: 'Frequency reduces where deceptive invoice or payee-change attempts become harder to land successfully.',
        vulnerability: 'Exposure improves where verification, payee validation, and challenge controls materially strengthen the payment path.',
        lossComponents: 'Loss improves where deception is interrupted earlier and downstream payment leakage is reduced.'
      },
      relevantLossComponents: ['incidentResponse', 'thirdPartyLiability', 'reputationContract']
    },
    payment_fraud: {
      scenarioLabel: 'accepted payment-fraud path',
      summaryLead: 'The future-state case stays anchored to deception-resistant payment execution and verification.',
      changeLead: 'Suggested changes reduce successful payment manipulation in the same fraud event path.',
      workflowGuidance: [
        'Prioritise treatments that make deceptive payment manipulation materially harder.',
        'Keep the case anchored to the accepted fraud path instead of generic finance-control wording.',
        'Use the future-state case to test whether verification and challenge controls change the likelihood of successful fraud.'
      ],
      benchmarkBasis: 'Use realistic anti-fraud control improvements rather than generic finance remediation.',
      inputRationale: {
        tef: 'Frequency reduces where payment-deception attempts become less likely to succeed.',
        vulnerability: 'Exposure improves where verification, callback, or segregation controls materially strengthen the fraud path.',
        lossComponents: 'Loss improves where fraudulent execution is interrupted earlier and downstream exposure is limited.'
      },
      relevantLossComponents: ['incidentResponse', 'thirdPartyLiability', 'reputationContract']
    },
    delivery_slippage: {
      scenarioLabel: 'accepted supplier-delivery slippage path',
      summaryLead: 'The future-state case stays anchored to supplier delivery reliability, dependency contingency, and schedule protection.',
      changeLead: 'Suggested changes reduce the same supplier-delay exposure through contingency, visibility, and alternate-path resilience.',
      workflowGuidance: [
        'Prioritise supplier contingency, alternate sourcing, schedule buffers, and delivery visibility for the same dependency path.',
        'Do not recast the scenario as cyber or generic transformation execution unless the accepted narrative supports that path.',
        'Use the future-state case to test whether the same supplier delay would create less programme and deployment disruption.'
      ],
      benchmarkBasis: 'Use realistic supply-chain contingency and dependency improvements rather than cyber or generic programme controls.',
      inputRationale: {
        tef: 'Frequency reduces where supplier delivery failure becomes less likely through alternate sources, better planning, or earlier escalation.',
        vulnerability: 'Exposure improves where dependency visibility, buffer design, and contingency options materially strengthen the same delivery path.',
        lossComponents: 'Loss improves where the same supplier delay causes less rollout disruption, rework, or contract exposure.'
      },
      relevantLossComponents: ['incidentResponse', 'businessInterruption', 'thirdPartyLiability', 'reputationContract']
    },
    privacy_non_compliance: {
      scenarioLabel: 'accepted privacy-obligation failure path',
      summaryLead: 'The future-state case stays anchored to lawful-basis, processing governance, and privacy-control execution.',
      changeLead: 'Suggested changes improve privacy governance and processing control quality without turning the scenario into breach response.',
      workflowGuidance: [
        'Prioritise lawful-basis, processing-governance, and control-design improvements for the same privacy-obligation path.',
        'Do not assume breach-response treatments unless disclosure or exposure is explicit in the accepted scenario.',
        'Use the future-state case to test whether the same processing activity would be materially safer and better governed.'
      ],
      benchmarkBasis: 'Use realistic privacy-governance and processing-control improvements rather than incident-response or breach-remediation substitutes.',
      inputRationale: {
        tef: 'Frequency reduces where stronger privacy governance makes unsupported processing materially less likely.',
        vulnerability: 'Exposure improves where lawful-basis, processing controls, retention controls, or transfer safeguards materially strengthen the same privacy path.',
        lossComponents: 'Loss improves where non-compliant processing is prevented or corrected earlier, not because the scenario is reframed as a disclosure incident.'
      },
      relevantLossComponents: ['incidentResponse', 'regulatoryLegal', 'reputationContract', ...(hasDisclosureSecondary ? ['dataBreachRemediation'] : [])]
    },
    records_retention_non_compliance: {
      scenarioLabel: 'accepted records-retention failure path',
      summaryLead: 'The future-state case stays anchored to retention-rule execution, deletion discipline, and records-control governance.',
      changeLead: 'Suggested changes improve retention control execution without reframing the scenario as a disclosure incident.',
      workflowGuidance: [
        'Prioritise stronger retention scheduling, deletion control, and records-governance checks.',
        'Keep the treatment focused on retention obligation execution rather than generic privacy or breach-response language.',
        'Use the future-state case to test whether records would be deleted or retained correctly under the improved design.'
      ],
      benchmarkBasis: 'Use realistic retention-control and deletion-governance improvements tied to the accepted records path.',
      inputRationale: {
        tef: 'Frequency reduces where retention control failures become less likely under stronger deletion and records governance.',
        vulnerability: 'Exposure improves where records handling, deletion control, and auditability materially strengthen the same retention path.',
        lossComponents: 'Loss improves where retention issues are prevented or corrected earlier, not because the scenario is recast as a breach.'
      },
      relevantLossComponents: ['incidentResponse', 'regulatoryLegal', 'reputationContract', ...(hasDisclosureSecondary ? ['dataBreachRemediation'] : [])]
    },
    cross_border_transfer_non_compliance: {
      scenarioLabel: 'accepted transfer-governance failure path',
      summaryLead: 'The future-state case stays anchored to cross-border transfer safeguards, approval, and privacy-governance controls.',
      changeLead: 'Suggested changes improve transfer-governance execution without turning the scenario into a disclosure incident.',
      workflowGuidance: [
        'Prioritise transfer safeguards, approval discipline, and privacy-governance checks for the same transfer path.',
        'Do not assume breach-response measures unless disclosure is explicit in the accepted scenario.',
        'Use the future-state case to test whether transfers would be governed correctly under the improved control design.'
      ],
      benchmarkBasis: 'Use realistic transfer-governance and safeguard improvements tied to the accepted cross-border path.',
      inputRationale: {
        tef: 'Frequency reduces where non-compliant transfer events become less likely under stronger safeguards and approvals.',
        vulnerability: 'Exposure improves where transfer-governance controls and safeguard checks materially strengthen the same transfer path.',
        lossComponents: 'Loss improves where transfer failures are prevented or corrected earlier, not because the scenario changes into disclosure response.'
      },
      relevantLossComponents: ['incidentResponse', 'regulatoryLegal', 'reputationContract', ...(hasDisclosureSecondary ? ['dataBreachRemediation'] : [])]
    },
    forced_labour_modern_slavery: {
      scenarioLabel: 'accepted forced-labour / modern-slavery path',
      summaryLead: 'The future-state case stays anchored to human-rights due diligence, supplier remediation, and worker-protection control quality.',
      changeLead: 'Suggested changes improve detection, remediation, and supplier intervention for the same labour-abuse path rather than reducing it to procurement cost management.',
      workflowGuidance: [
        'Prioritise human-rights due diligence, supplier corrective action, worker-protection verification, and escalation pathways.',
        'Do not reduce the treatment to procurement-only cost or scheduling measures when the accepted event path is labour exploitation.',
        'Use the future-state case to test whether the same abuse indicators would be detected and remediated earlier.'
      ],
      benchmarkBasis: 'Use realistic human-rights, worker-protection, and supplier-remediation improvements rather than procurement-only process measures.',
      inputRationale: {
        tef: 'Frequency reduces where abuse indicators are identified earlier and supplier intervention becomes materially more effective.',
        vulnerability: 'Exposure improves where due diligence, worker-protection checks, escalation, and remediation controls materially strengthen the same human-rights path.',
        lossComponents: 'Loss improves where the same labour abuse is detected or remediated earlier and downstream legal, contract, and reputation harm is limited.'
      },
      relevantLossComponents: ['incidentResponse', 'regulatoryLegal', 'thirdPartyLiability', 'reputationContract']
    },
    safety_incident: {
      scenarioLabel: 'accepted safety-incident path',
      summaryLead: 'The future-state case stays anchored to hazard control, safe operating conditions, and safety-barrier reliability.',
      changeLead: 'Suggested changes improve safety control strength, barrier performance, and incident containment for the same safety path.',
      workflowGuidance: [
        'Prioritise hazard elimination, safe-system controls, supervision, and emergency response for the same safety event path.',
        'Do not reduce the treatment to generic operational efficiency language when explicit safety harm is central.',
        'Use the future-state case to test whether the same unsafe condition would be less likely to create a safety incident.'
      ],
      benchmarkBasis: 'Use realistic hazard-control and safety-barrier improvements tied to the accepted safety path.',
      inputRationale: {
        tef: 'Frequency reduces where unsafe conditions or barrier failures become materially less likely.',
        vulnerability: 'Exposure improves where hazard controls, supervision, or emergency response materially strengthen the same safety path.',
        lossComponents: 'Loss improves where the same safety event is prevented or contained earlier, not because the scenario is flattened into generic operational efficiency.'
      },
      relevantLossComponents: ['incidentResponse', 'businessInterruption', 'regulatoryLegal', 'reputationContract']
    },
    environmental_spill: {
      scenarioLabel: 'accepted environmental-spill path',
      summaryLead: 'The future-state case stays anchored to containment, release prevention, and environmental response controls.',
      changeLead: 'Suggested changes improve prevention and response for the same spill or release path.',
      workflowGuidance: [
        'Prioritise containment integrity, release prevention, monitoring, and spill-response readiness.',
        'Do not reduce the treatment to generic compliance language when the accepted event path is a spill or release.',
        'Use the future-state case to test whether the same release would be prevented or contained earlier.'
      ],
      benchmarkBasis: 'Use realistic containment, monitoring, and response improvements tied to the accepted spill path.',
      inputRationale: {
        tef: 'Frequency reduces where containment failure or release conditions become materially less likely.',
        vulnerability: 'Exposure improves where containment, monitoring, and response controls materially strengthen the same spill path.',
        lossComponents: 'Loss improves where the same release is prevented or contained earlier and downstream disruption or liability is limited.'
      },
      relevantLossComponents: ['incidentResponse', 'businessInterruption', 'regulatoryLegal', 'reputationContract']
    },
    workforce_fatigue_staffing_weakness: {
      scenarioLabel: 'accepted workforce-fatigue / staffing-weakness path',
      summaryLead: 'The future-state case stays anchored to staffing resilience, fatigue control, coverage design, and safe workload management.',
      changeLead: 'Suggested changes reduce fatigue-driven control weakness and unsafe delivery in the same people-resilience path.',
      workflowGuidance: [
        'Prioritise staffing resilience, fatigue limits, rota design, supervision, and coverage depth for the same event path.',
        'Do not reduce the treatment to generic backlog or cost pressure language when the accepted issue is workforce resilience.',
        'Use the future-state case to test whether unsafe delivery or control failure would be less likely under stronger staffing design.'
      ],
      benchmarkBasis: 'Use realistic staffing, fatigue-control, and coverage improvements tied to the accepted people-resilience path.',
      inputRationale: {
        tef: 'Frequency reduces where fatigue and staffing weakness become materially less likely to create unsafe delivery or control failure.',
        vulnerability: 'Exposure improves where coverage, supervision, and workload design materially strengthen the same workforce path.',
        lossComponents: 'Loss improves where the same staffing-driven failure is prevented or contained earlier, not because the scenario is flattened into generic operational capacity.'
      },
      relevantLossComponents: ['incidentResponse', 'businessInterruption', 'reputationContract']
    },
    critical_staff_dependency: {
      scenarioLabel: 'accepted critical-staff dependency path',
      summaryLead: 'The future-state case stays anchored to key-person resilience, cross-training, succession, and coverage depth.',
      changeLead: 'Suggested changes reduce single-person dependency and improve resilience for the same critical-staff path.',
      workflowGuidance: [
        'Prioritise cross-training, succession cover, access continuity, and knowledge distribution for the same key-person dependency path.',
        'Do not flatten the treatment into generic strategic or operational language when concentration of staff dependency is explicit.',
        'Use the future-state case to test whether absence or overload of critical staff would create materially less disruption.'
      ],
      benchmarkBasis: 'Use realistic resilience improvements tied to the accepted critical-staff dependency path.',
      inputRationale: {
        tef: 'Frequency reduces where key-person dependency becomes less likely to create disruption.',
        vulnerability: 'Exposure improves where knowledge concentration, coverage, and succession controls materially strengthen the same staff-dependency path.',
        lossComponents: 'Loss improves where the same staff dependency is absorbed with less disruption or contract harm.'
      },
      relevantLossComponents: ['incidentResponse', 'businessInterruption', 'reputationContract']
    }
  };
  const profile = {
    ...base,
    ...(profiles[primaryKey] || {})
  };
  if (overlaySet.has('regulatory_scrutiny') || overlaySet.has('legal_exposure')) {
    profile.relevantLossComponents = uniqueStrings([...profile.relevantLossComponents, 'regulatoryLegal']);
  }
  if (overlaySet.has('third_party_dependency')) {
    profile.relevantLossComponents = uniqueStrings([...profile.relevantLossComponents, 'thirdPartyLiability']);
  }
  if (overlaySet.has('service_outage') || overlaySet.has('operational_disruption')) {
    profile.relevantLossComponents = uniqueStrings([...profile.relevantLossComponents, 'businessInterruption']);
  }
  if (overlaySet.has('reputational_damage') || overlaySet.has('customer_harm')) {
    profile.relevantLossComponents = uniqueStrings([...profile.relevantLossComponents, 'reputationContract']);
  }
  if (hasDisclosureSecondary || overlaySet.has('data_exposure')) {
    profile.relevantLossComponents = uniqueStrings([...profile.relevantLossComponents, 'dataBreachRemediation']);
  }
  return profile;
}

function getRangeFromBaseline(baseline = {}, prefix = '') {
  return {
    min: Number(baseline?.[`${prefix}Min`]),
    likely: Number(baseline?.[`${prefix}Likely`]),
    max: Number(baseline?.[`${prefix}Max`])
  };
}

function hasAnyFiniteRangeValue(range = {}) {
  return ['min', 'likely', 'max'].some((key) => Number.isFinite(Number(range?.[key])));
}

function shapeTreatmentLossComponents(stub = {}, baseline = {}, profile = {}) {
  const relevant = new Set(Array.isArray(profile?.relevantLossComponents) ? profile.relevantLossComponents : []);
  const output = cloneValue(stub?.suggestedInputs?.lossComponents || {});
  const lossPrefixes = {
    incidentResponse: 'ir',
    businessInterruption: 'bi',
    dataBreachRemediation: 'db',
    regulatoryLegal: 'rl',
    thirdPartyLiability: 'tp',
    reputationContract: 'rc'
  };
  Object.entries(lossPrefixes).forEach(([key, prefix]) => {
    if (relevant.has(key)) return;
    const baselineRange = getRangeFromBaseline(baseline, prefix);
    if (hasAnyFiniteRangeValue(baselineRange)) output[key] = baselineRange;
  });
  return output;
}

function buildGenericTreatmentImprovementStub(input = {}) {
  const request = String(input.improvementRequest || '').toLowerCase();
  const baseline = getBaselineFairInputs(input);
  const next = JSON.parse(JSON.stringify(baseline || {}));
  const notes = [];
  const adjust = (key, factor, floor = null, ceil = null) => {
    const current = Number(next[key]);
    if (!Number.isFinite(current)) return;
    let value = current * factor;
    if (floor != null) value = Math.max(floor, value);
    if (ceil != null) value = Math.min(ceil, value);
    next[key] = Number(value.toFixed(2));
  };

  if (/control|mfa|access|identity|monitor|detect|response/.test(request)) {
    adjust('controlStrMin', 1.12, 0, 0.99);
    adjust('controlStrLikely', 1.15, 0, 0.99);
    adjust('controlStrMax', 1.1, 0, 0.995);
    adjust('vulnMin', 0.9, 0.01, 1);
    adjust('vulnLikely', 0.85, 0.01, 1);
    adjust('vulnMax', 0.82, 0.01, 1);
    notes.push('Control strength has been lifted to reflect stronger preventive and detective controls.');
  }
  if (/less exposure|lower exposure|reduc|contain|segmentation|hardening/.test(request)) {
    adjust('threatCapMin', 0.95, 0, 1);
    adjust('threatCapLikely', 0.92, 0, 1);
    adjust('threatCapMax', 0.9, 0, 1);
    adjust('vulnMin', 0.88, 0.01, 1);
    adjust('vulnLikely', 0.82, 0.01, 1);
    adjust('vulnMax', 0.78, 0.01, 1);
    notes.push('Exposure has been reduced to reflect better containment and lower successful attack opportunity.');
  }
  if (/less financial|lower loss|cheaper|reduce cost|lower disruption|resilience|faster recovery/.test(request)) {
    ['biMin', 'biLikely', 'biMax'].forEach((key, idx) => adjust(key, [0.75, 0.7, 0.68][idx], 0, null));
    ['irMin', 'irLikely', 'irMax'].forEach((key, idx) => adjust(key, [0.9, 0.88, 0.86][idx], 0, null));
    ['rcMin', 'rcLikely', 'rcMax'].forEach((key, idx) => adjust(key, [0.92, 0.88, 0.85][idx], 0, null));
    notes.push('Financial and disruption losses have been reduced to reflect faster containment, better resilience, or lower downstream harm.');
  }
  if (/less frequent|lower frequency|rarer|harder to happen|prevent/.test(request)) {
    ['tefMin', 'tefLikely', 'tefMax'].forEach((key, idx) => adjust(key, [0.85, 0.78, 0.72][idx], 0.1, null));
    notes.push('Event frequency has been reduced to reflect lower likelihood under the improved future state.');
  }
  if (!notes.length) {
    adjust('controlStrLikely', 1.08, 0, 0.99);
    adjust('tefLikely', 0.9, 0.1, null);
    adjust('biLikely', 0.9, 0, null);
    notes.push('The future-state case assumes moderately stronger controls, lower event success, and better operational containment.');
  }
  return {
    summary: 'The future-state case adjusts the baseline to reflect the improvement described by the user.',
    changesSummary: notes.join(' '),
    workflowGuidance: [
      'Review the adjusted values and make sure they reflect a credible future state rather than an ideal one.',
      'Focus on the one or two assumptions that would realistically improve first, then rerun the model.',
      'Use the comparison view to judge whether the improvement meaningfully changes tolerance position.'
    ],
    benchmarkBasis: 'The adjusted values represent a future-state comparison case. They should reflect plausible control or resilience improvements, not best-case assumptions.',
    inputRationale: {
      tef: 'Frequency was reduced only where the requested improvement would plausibly lower how often the scenario succeeds.',
      vulnerability: 'Exposure was reduced where stronger controls, better identity protection, or tighter containment were implied by the request.',
      lossComponents: 'Loss values were reduced where the request suggests faster recovery, lower disruption, or less downstream financial impact.'
    },
    suggestedInputs: {
      TEF: { min: next.tefMin, likely: next.tefLikely, max: next.tefMax },
      controlStrength: { min: next.controlStrMin, likely: next.controlStrLikely, max: next.controlStrMax },
      threatCapability: { min: next.threatCapMin, likely: next.threatCapLikely, max: next.threatCapMax },
      lossComponents: {
        incidentResponse: { min: next.irMin, likely: next.irLikely, max: next.irMax },
        businessInterruption: { min: next.biMin, likely: next.biLikely, max: next.biMax },
        dataBreachRemediation: { min: next.dbMin, likely: next.dbLikely, max: next.dbMax },
        regulatoryLegal: { min: next.rlMin, likely: next.rlLikely, max: next.rlMax },
        thirdPartyLiability: { min: next.tpMin, likely: next.tpLikely, max: next.tpMax },
        reputationContract: { min: next.rcMin, likely: next.rcLikely, max: next.rcMax }
      }
    },
    citations: Array.isArray(input.citations) ? input.citations : []
  };
}

function buildTreatmentImprovementStub(input = {}, context = null) {
  const stub = buildGenericTreatmentImprovementStub(input);
  const acceptedContext = context || buildAcceptedTreatmentContext(input);
  const profile = resolveTreatmentProfile(acceptedContext);
  const baseline = getBaselineFairInputs(input);
  return {
    ...stub,
    summary: profile.summaryLead || stub.summary,
    changesSummary: [profile.changeLead, stub.changesSummary].filter(Boolean).join(' '),
    workflowGuidance: Array.isArray(profile.workflowGuidance) && profile.workflowGuidance.length
      ? profile.workflowGuidance
      : stub.workflowGuidance,
    benchmarkBasis: profile.benchmarkBasis || stub.benchmarkBasis,
    inputRationale: {
      tef: profile.inputRationale?.tef || stub.inputRationale.tef,
      vulnerability: profile.inputRationale?.vulnerability || stub.inputRationale.vulnerability,
      lossComponents: profile.inputRationale?.lossComponents || stub.inputRationale.lossComponents
    },
    suggestedInputs: {
      ...stub.suggestedInputs,
      lossComponents: shapeTreatmentLossComponents(stub, baseline, profile)
    }
  };
}

function classifyTreatmentText(text = '', acceptedContext = {}) {
  const cleanText = cleanUserFacingText(text, { maxSentences: 6 });
  if (!cleanText) {
    return {
      status: 'empty',
      dominantFamilies: [],
      blockedFamilies: [],
      anchorOverlap: 0,
      primaryThemeMatches: 0,
      secondaryThemeMatches: 0,
      mechanismMatches: 0,
      overlayMatches: 0,
      riskThemeMatches: 0,
      reasonCodes: []
    };
  }

  const classification = classifyScenario(cleanText);
  const dominantFamilies = uniqueStrings([
    classification?.primaryFamily?.key,
    ...(Array.isArray(classification?.secondaryFamilies) ? classification.secondaryFamilies.map((family) => family?.key) : [])
  ]);
  const primaryThemeMatches = countPhraseMatches(cleanText, acceptedContext.primaryThemePhrases);
  const secondaryThemeMatches = countPhraseMatches(cleanText, acceptedContext.secondaryThemePhrases);
  const mechanismMatches = countPhraseMatches(cleanText, acceptedContext.mechanismThemePhrases);
  const overlayMatches = countPhraseMatches(cleanText, acceptedContext.overlayThemePhrases);
  const riskThemeMatches = countPhraseMatches(cleanText, acceptedContext.selectedRiskThemes);
  const anchorOverlap = countTokenOverlap(extractContentTokens(cleanText), acceptedContext.anchorTokens);
  const blockedFamilies = (Array.isArray(acceptedContext.blockedFamilyEntries) ? acceptedContext.blockedFamilyEntries : [])
    .filter((entry) => countPhraseMatches(cleanText, entry.phrases) > 0 && !entry.phrases.some((phrase) => hasNegatedFamilyReference(cleanText, phrase)))
    .map((entry) => entry.key);
  const classifiedPrimary = classification?.primaryFamily?.key || '';
  const classificationConfidence = Number(classification?.confidence || 0);
  const hasStrongClassifiedPrimary = Boolean(
    classifiedPrimary
    && classificationConfidence >= 0.55
    && !(Array.isArray(classification?.ambiguityFlags) && classification.ambiguityFlags.includes('WEAK_EVENT_PATH'))
  );
  const acceptedPrimary = String(acceptedContext.acceptedPrimaryFamilyKey || '').trim();
  const explicitSecondaryFamilyKeys = Array.isArray(acceptedContext.acceptedSecondaryFamilyKeys) ? acceptedContext.acceptedSecondaryFamilyKeys : [];
  const allowedSecondaryFamilyKeys = Array.isArray(acceptedContext.allowedSecondaryFamilyKeys) ? acceptedContext.allowedSecondaryFamilyKeys : [];
  const primaryAligned = Boolean(acceptedPrimary && ((hasStrongClassifiedPrimary && classifiedPrimary === acceptedPrimary) || primaryThemeMatches > 0));
  const explicitSecondaryAligned = Boolean(
    (hasStrongClassifiedPrimary && explicitSecondaryFamilyKeys.includes(classifiedPrimary))
    || secondaryThemeMatches > 0
  );
  const allowedSecondaryContext = Boolean(
    hasStrongClassifiedPrimary
    && classifiedPrimary
    && allowedSecondaryFamilyKeys.includes(classifiedPrimary)
    && (anchorOverlap >= 3 || mechanismMatches > 0 || riskThemeMatches > 0)
  );
  const secondaryAligned = explicitSecondaryAligned || allowedSecondaryContext;
  const lensKey = buildScenarioLens(classification || {}).key || '';
  const lensCompatible = isCompatibleScenarioLens(acceptedContext.acceptedLens?.key || '', lensKey);
  const classifiedFamily = hasStrongClassifiedPrimary && classifiedPrimary ? SCENARIO_TAXONOMY_FAMILY_BY_KEY[classifiedPrimary] || null : null;
  const familyConflict = familyConflictsWith(acceptedContext.acceptedPrimaryFamily, classifiedFamily);
  const genericWeak = !primaryAligned && !secondaryAligned && anchorOverlap < 2 && riskThemeMatches === 0 && mechanismMatches === 0;
  const consequenceLedWeak = overlayMatches > 0 && !primaryAligned && !secondaryAligned && anchorOverlap < 3 && mechanismMatches === 0;
  const blocked = blockedFamilies.length > 0 || familyConflict || (hasStrongClassifiedPrimary && !primaryAligned && !secondaryAligned && !lensCompatible && anchorOverlap < 2);
  let status = 'generic-but-acceptable';
  if (blocked) status = 'off-lane-mismatched';
  else if (primaryAligned || (anchorOverlap >= 2 && (mechanismMatches > 0 || riskThemeMatches > 0))) status = 'scenario-aligned';
  else if (consequenceLedWeak) status = 'consequence-led-but-weak';
  else if (genericWeak) status = 'generic-but-acceptable';

  const reasonCodes = [];
  if (blockedFamilies.length || familyConflict) reasonCodes.push('BLOCKED_DRIFT_FAMILIES');
  if (consequenceLedWeak) reasonCodes.push('CONSEQUENCE_LED_TREATMENT');
  if (genericWeak) reasonCodes.push('GENERIC_TREATMENT_LANGUAGE');
  if (anchorOverlap < 2) reasonCodes.push('LOW_SCENARIO_ANCHOR');
  if (!primaryAligned && secondaryAligned) reasonCodes.push('SECONDARY_LANE_CONTEXT');
  if (primaryAligned) reasonCodes.push('PRIMARY_FAMILY_ALIGNMENT');
  if (mechanismMatches) reasonCodes.push('MECHANISM_ALIGNMENT');
  if (riskThemeMatches) reasonCodes.push('RISK_THEME_ALIGNMENT');

  return {
    status,
    dominantFamilies: uniqueStrings([classifiedPrimary, ...blockedFamilies, ...dominantFamilies]),
    blockedFamilies,
    anchorOverlap,
    primaryThemeMatches,
    secondaryThemeMatches,
    mechanismMatches,
    overlayMatches,
    riskThemeMatches,
    reasonCodes
  };
}

const TREATMENT_SECTION_CONFIG = Object.freeze([
  { key: 'summary', priority: 'high' },
  { key: 'changesSummary', priority: 'high' },
  { key: 'workflowGuidance', priority: 'medium' },
  { key: 'benchmarkBasis', priority: 'medium' },
  { key: 'inputRationale.tef', priority: 'medium' },
  { key: 'inputRationale.vulnerability', priority: 'medium' },
  { key: 'inputRationale.lossComponents', priority: 'medium' }
]);

function getTreatmentSectionText(output = {}, key = '') {
  switch (key) {
    case 'summary':
      return String(output?.summary || '').trim();
    case 'changesSummary':
      return String(output?.changesSummary || '').trim();
    case 'workflowGuidance':
      return uniqueStrings(Array.isArray(output?.workflowGuidance) ? output.workflowGuidance : []).join('. ');
    case 'benchmarkBasis':
      return String(output?.benchmarkBasis || '').trim();
    case 'inputRationale.tef':
      return String(output?.inputRationale?.tef || '').trim();
    case 'inputRationale.vulnerability':
      return String(output?.inputRationale?.vulnerability || '').trim();
    case 'inputRationale.lossComponents':
      return String(output?.inputRationale?.lossComponents || '').trim();
    default:
      return '';
  }
}

function buildTreatmentCombinedText(output = {}) {
  return uniqueStrings(TREATMENT_SECTION_CONFIG.map((section) => getTreatmentSectionText(output, section.key))).join('. ');
}

function assessStructuredTreatmentOutput(output = {}, acceptedContext = {}) {
  const sections = TREATMENT_SECTION_CONFIG.map((section) => {
    const text = getTreatmentSectionText(output, section.key);
    return {
      ...section,
      text,
      assessment: classifyTreatmentText(text, acceptedContext)
    };
  });
  const combined = classifyTreatmentText(buildTreatmentCombinedText(output), acceptedContext);
  const combinedPrimaryAligned = Boolean(
    combined.dominantFamilies.includes(acceptedContext.acceptedPrimaryFamilyKey)
    || combined.reasonCodes.includes('PRIMARY_FAMILY_ALIGNMENT')
  );
  const correctedSectionKeys = sections
    .filter((section) => (
      section.assessment.status === 'off-lane-mismatched'
      || section.assessment.status === 'consequence-led-but-weak'
      || (section.priority === 'high' && section.assessment.status !== 'scenario-aligned' && !combinedPrimaryAligned)
    ))
    .map((section) => section.key);
  const blockedFamilies = uniqueStrings([
    ...combined.blockedFamilies,
    ...sections.flatMap((section) => section.assessment.blockedFamilies)
  ]);
  const dominantTreatmentFamilies = uniqueStrings([
    ...combined.dominantFamilies,
    ...sections.flatMap((section) => section.assessment.dominantFamilies)
  ]).slice(0, 5);
  const reasonCodes = uniqueStrings([
    ...combined.reasonCodes,
    ...sections.flatMap((section) => section.assessment.reasonCodes),
    ...(dominantTreatmentFamilies[0] && dominantTreatmentFamilies[0] !== acceptedContext.acceptedPrimaryFamilyKey
      && !acceptedContext.allowedSecondaryFamilyKeys?.includes(dominantTreatmentFamilies[0])
      ? ['DOMINANT_FAMILY_DRIFT']
      : [])
  ]);
  const highPriorityDriftCount = sections.filter((section) => section.priority === 'high' && section.assessment.status !== 'scenario-aligned').length;
  const offLaneCount = sections.filter((section) => section.assessment.status === 'off-lane-mismatched').length;
  const weakCount = sections.filter((section) => section.assessment.status === 'consequence-led-but-weak').length;
  const acceptedEnough = (
    (combined.status === 'scenario-aligned' || combinedPrimaryAligned)
    && !blockedFamilies.length
    && offLaneCount === 0
    && weakCount === 0
    && correctedSectionKeys.length === 0
  );
  const shouldReplace = (
    combined.status === 'off-lane-mismatched'
    || blockedFamilies.length > 1
    || (offLaneCount >= 2 && highPriorityDriftCount >= 1)
    || (highPriorityDriftCount >= 2 && !combinedPrimaryAligned && combined.anchorOverlap < 2)
  );
  return {
    sections,
    combined,
    combinedPrimaryAligned,
    correctedSectionKeys,
    blockedFamilies,
    dominantTreatmentFamilies,
    reasonCodes,
    acceptedEnough,
    shouldReplace,
    offLaneCount,
    weakCount
  };
}

function buildTreatmentCoherenceMetadata(mode = 'accepted', acceptedContext = {}, assessment = {}, {
  correctedSections = [],
  sourceMode = 'live'
} = {}) {
  const dominantTreatmentFamilies = Array.isArray(assessment?.dominantTreatmentFamilies) ? assessment.dominantTreatmentFamilies : [];
  const reasonCodes = Array.isArray(assessment?.reasonCodes) ? assessment.reasonCodes : [];
  const sections = Array.isArray(assessment?.sections) ? assessment.sections : [];
  const alignedCount = sections.filter((section) => section?.assessment?.status === 'scenario-aligned').length
    + (assessment?.combined?.status === 'scenario-aligned' ? 1 : 0);
  const totalCount = sections.length + (assessment?.combined ? 1 : 0);
  const calibratedConfidence = calibrateCoherenceConfidence({
    outputType: 'treatment',
    mode,
    sourceMode,
    totalCount,
    alignedCount,
    blockedCount: Array.isArray(assessment?.blockedFamilies) ? assessment.blockedFamilies.length : 0,
    weakOverlayOnlyCount: Number(assessment?.weakCount || 0),
    dominantFamilyAligned: !dominantTreatmentFamilies.length || dominantTreatmentFamilies[0] === acceptedContext.acceptedPrimaryFamilyKey
      || (Array.isArray(acceptedContext.allowedSecondaryFamilyKeys) && acceptedContext.allowedSecondaryFamilyKeys.includes(dominantTreatmentFamilies[0])),
    lowAnchorOverlap: Number(assessment?.combined?.anchorOverlap || 0) < 2,
    correctedSectionCount: correctedSections.length,
    reasonCodes,
    usedFallback: sourceMode !== 'live',
    strongAlignment: Boolean(assessment?.acceptedEnough || assessment?.combined?.status === 'scenario-aligned')
  });
  return {
    mode,
    acceptedPrimaryFamilyKey: acceptedContext.acceptedPrimaryFamilyKey || '',
    acceptedSecondaryFamilyKeys: Array.isArray(acceptedContext.acceptedSecondaryFamilyKeys) ? acceptedContext.acceptedSecondaryFamilyKeys : [],
    dominantTreatmentFamilies,
    blockedFamilies: Array.isArray(assessment?.blockedFamilies) ? assessment.blockedFamilies : [],
    reasonCodes,
    correctedSections: Array.isArray(correctedSections) ? correctedSections : [],
    taxonomyVersion: acceptedContext.taxonomyVersion || SCENARIO_TAXONOMY.taxonomyVersion,
    confidenceScore: calibratedConfidence.confidenceScore,
    confidenceBand: calibratedConfidence.confidenceBand,
    confidenceDrivers: calibratedConfidence.confidenceDrivers,
    calibrationMode: calibratedConfidence.calibrationMode
  };
}

function applyTreatmentCorrections(output = {}, fallback = {}, correctedSectionKeys = []) {
  const next = cloneValue(output) || {};
  if (correctedSectionKeys.includes('summary')) next.summary = fallback.summary;
  if (correctedSectionKeys.includes('changesSummary')) next.changesSummary = fallback.changesSummary;
  if (correctedSectionKeys.includes('workflowGuidance')) next.workflowGuidance = cloneValue(fallback.workflowGuidance);
  if (correctedSectionKeys.includes('benchmarkBasis')) next.benchmarkBasis = fallback.benchmarkBasis;
  if (correctedSectionKeys.includes('inputRationale.tef')) {
    next.inputRationale = next.inputRationale || {};
    next.inputRationale.tef = fallback.inputRationale?.tef || '';
  }
  if (correctedSectionKeys.includes('inputRationale.vulnerability')) {
    next.inputRationale = next.inputRationale || {};
    next.inputRationale.vulnerability = fallback.inputRationale?.vulnerability || '';
  }
  if (correctedSectionKeys.includes('inputRationale.lossComponents')) {
    next.inputRationale = next.inputRationale || {};
    next.inputRationale.lossComponents = fallback.inputRationale?.lossComponents || '';
  }
  return next;
}

function enforceTreatmentOutputCoherence(output = {}, {
  input = {},
  sourceMode = 'live'
} = {}) {
  const acceptedContext = buildAcceptedTreatmentContext(input);
  const fallbackOutput = buildTreatmentImprovementStub(input, acceptedContext);
  if (sourceMode === 'manual') {
    return {
      coherenceMode: 'manual',
      output: {
        ...output,
        treatmentCoherence: buildTreatmentCoherenceMetadata('manual', acceptedContext, {
          dominantTreatmentFamilies: [],
          blockedFamilies: [],
          reasonCodes: ['MANUAL_MODE']
        }, {
          sourceMode
        })
      }
    };
  }

  const assessment = assessStructuredTreatmentOutput(output, acceptedContext);
  if (assessment.acceptedEnough) {
    return {
      coherenceMode: 'accepted',
      output: {
        ...output,
        treatmentCoherence: buildTreatmentCoherenceMetadata('accepted', acceptedContext, assessment, {
          sourceMode
        })
      }
    };
  }

  if (assessment.shouldReplace) {
    return {
      coherenceMode: 'fallback_replaced',
      output: {
        ...output,
        ...fallbackOutput,
        treatmentCoherence: buildTreatmentCoherenceMetadata('fallback_replaced', acceptedContext, assessment, {
          correctedSections: TREATMENT_SECTION_CONFIG.map((section) => section.key),
          sourceMode
        })
      }
    };
  }

  const corrected = applyTreatmentCorrections(output, fallbackOutput, assessment.correctedSectionKeys);
  return {
    coherenceMode: 'corrected',
    output: {
      ...output,
      ...corrected,
      treatmentCoherence: buildTreatmentCoherenceMetadata('corrected', acceptedContext, assessment, {
        correctedSections: assessment.correctedSectionKeys,
        sourceMode
      })
    }
  };
}

function finaliseTreatmentSuggestionResult(result = {}, { input = {} } = {}) {
  const sourceMode = String(result?.mode || 'live').trim() || 'live';
  const enforced = enforceTreatmentOutputCoherence(result, {
    input,
    sourceMode
  });
  if (enforced.coherenceMode === 'fallback_replaced' && sourceMode === 'live') {
    return {
      ...result,
      ...enforced.output,
      mode: 'deterministic_fallback',
      usedFallback: true,
      aiUnavailable: false,
      fallbackReasonCode: 'treatment_coherence_fallback_replaced',
      fallbackReasonTitle: 'Deterministic fallback treatment suggestion loaded',
      fallbackReasonMessage: 'The generated treatment suggestion drifted away from the accepted scenario, so the server replaced it with a deterministic scenario-aligned treatment case.'
    };
  }
  if (enforced.coherenceMode === 'fallback_replaced') {
    return {
      ...result,
      ...enforced.output,
      mode: sourceMode,
      usedFallback: result?.usedFallback,
      aiUnavailable: result?.aiUnavailable
    };
  }
  return enforced.output;
}

function buildFallbackTreatmentSuggestionResult(input = {}, {
  aiUnavailable = false,
  traceLabel = 'Step 3 treatment suggestion',
  fallbackReason = null
} = {}) {
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.baselineAssessment?.geography || input.businessUnit?.geography,
    applicableRegulations: input.baselineAssessment?.applicableRegulations,
    organisationContext: input.baselineAssessment?.narrative,
    uploadedText: input.improvementRequest,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  const stub = buildTreatmentImprovementStub(input);
  return buildDeterministicFallbackResult({
    baseResult: {
      ...stub
    },
    fallbackReason: fallbackReason || {
      code: 'server_treatment_fallback',
      title: 'Deterministic fallback treatment suggestion loaded',
      message: 'The server used a deterministic future-state suggestion instead of live AI for this better-outcome case.',
      detail: ''
    },
    aiUnavailable,
    traceLabel,
    promptSummary: 'Server deterministic fallback used for Step 3 treatment suggestion.',
    response: stub.changesSummary || stub.summary,
    sources: input.citations || [],
    evidenceMeta,
    withEvidenceMeta
  });
}

function hasMeaningfulTreatmentBaseline(input = {}) {
  const baseline = input?.baselineAssessment || {};
  const fairInputs = baseline?.fairParams || baseline?.results?.inputs || {};
  const hasNumericInput = [
    'tefMin', 'tefLikely', 'tefMax',
    'controlStrMin', 'controlStrLikely', 'controlStrMax',
    'threatCapMin', 'threatCapLikely', 'threatCapMax',
    'biLikely', 'irLikely', 'rcLikely'
  ].some((key) => Number.isFinite(Number(fairInputs?.[key])));
  const baselineContext = cleanUserFacingText(
    baseline?.enhancedNarrative || baseline?.narrative || baseline?.scenarioTitle || '',
    { maxSentences: 2 }
  );
  return hasNumericInput || baselineContext.length >= 12;
}

function hasMeaningfulTreatmentRequest(input = {}) {
  const request = cleanUserFacingText(input?.improvementRequest || '', { maxSentences: 2 });
  return request.length >= 10;
}

function buildManualTreatmentSuggestionResult(input = {}, { traceLabel = 'Step 3 treatment suggestion' } = {}) {
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.baselineAssessment?.geography || input.businessUnit?.geography,
    applicableRegulations: input.baselineAssessment?.applicableRegulations,
    organisationContext: input.baselineAssessment?.narrative,
    uploadedText: input.improvementRequest,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  return buildManualModeResult({
    baseResult: {
      summary: 'The better-outcome case stayed manual because the current request or baseline data is incomplete.',
      changesSummary: 'No treatment adjustments were applied.',
      workflowGuidance: [
        'Describe the improvement you want to test in one plain sentence.',
        'Make sure the baseline scenario or FAIR inputs are filled in first.',
        'Then try the better-outcome assist again.'
      ],
      benchmarkBasis: 'This step stayed in manual mode because the current treatment request or baseline data is too limited for a reliable server suggestion.',
      inputRationale: {
        tef: '',
        vulnerability: '',
        lossComponents: ''
      },
      suggestedInputs: {},
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    manualReason: {
      code: 'incomplete_treatment_input',
      title: 'Manual treatment guidance only',
      message: 'Add a clearer improvement request and baseline scenario data before asking the server for a better-outcome suggestion.'
    },
    traceLabel,
    promptSummary: 'Server manual mode used for Step 3 treatment suggestion because the request or baseline data was incomplete.',
    response: 'The treatment-suggestion step stayed in manual mode because the input was incomplete.',
    sources: input.citations || [],
    evidenceMeta,
    withEvidenceMeta
  });
}

function classifyTreatmentFallbackReason(error = null) {
  const message = String(error?.message || error || '').trim();
  const safeMessage = sanitizeAiText(message, { maxChars: 220 });
  const withDetail = (base, detail) => ({
    ...base,
    detail: String(detail || '').trim()
  });
  if (!safeMessage) {
    return withDetail({
      code: 'no_ai_response',
      title: 'Deterministic fallback treatment suggestion loaded',
      message: 'The server did not receive a usable AI response, so it used deterministic future-state adjustments instead.'
    }, 'No response content was returned.');
  }
  if (/Hosted AI proxy is not configured|Missing COMPASS_API_KEY secret/i.test(safeMessage)) {
    return withDetail({
      code: 'proxy_missing_secret',
      title: 'Deterministic fallback treatment suggestion loaded',
      message: 'The hosted AI proxy is not configured, so the server used deterministic future-state adjustments instead.'
    }, 'The proxy is missing its Compass configuration.');
  }
  return withDetail({
    code: 'ai_runtime_error',
    title: 'Deterministic fallback treatment suggestion loaded',
    message: 'The AI treatment-suggestion step failed at runtime, so the server used deterministic future-state adjustments instead.'
  }, safeMessage);
}

function hasCompleteNumericRange(value = {}) {
  return ['min', 'likely', 'max'].every((key) => Number.isFinite(Number(value?.[key])));
}

function normaliseTreatmentSuggestionCandidate(parsed = {}, fallbackSource = null, input = {}) {
  let resolvedFallback = null;
  const getFallback = () => {
    if (resolvedFallback === null) {
      const next = typeof fallbackSource === 'function' ? fallbackSource() : fallbackSource;
      resolvedFallback = next && typeof next === 'object' ? next : {};
    }
    return resolvedFallback;
  };
  const parsedSummary = cleanUserFacingText(parsed.summary || '', { maxSentences: 2 });
  const parsedChangesSummary = cleanUserFacingText(parsed.changesSummary || '', { maxSentences: 3 });
  const parsedWorkflowGuidance = normaliseGuidance(parsed.workflowGuidance);
  const parsedBenchmarkBasis = normaliseBenchmarkBasis(parsed.benchmarkBasis || '');
  const parsedInputRationale = normaliseInputRationale(parsed.inputRationale || {});
  const parsedSuggestedInputs = parsed?.suggestedInputs && typeof parsed.suggestedInputs === 'object' ? parsed.suggestedInputs : {};
  const getFallbackSuggestedInputs = () => (getFallback().suggestedInputs || {});
  const getFallbackLossComponents = () => (getFallbackSuggestedInputs().lossComponents || {});
  return {
    summary: parsedSummary || cleanUserFacingText(getFallback().summary || '', { maxSentences: 2 }),
    changesSummary: parsedChangesSummary || cleanUserFacingText(getFallback().changesSummary || '', { maxSentences: 3 }),
    workflowGuidance: parsedWorkflowGuidance.length ? parsedWorkflowGuidance : normaliseGuidance(getFallback().workflowGuidance),
    benchmarkBasis: parsedBenchmarkBasis || normaliseBenchmarkBasis(getFallback().benchmarkBasis || ''),
    inputRationale: {
      tef: parsedInputRationale.tef || normaliseInputRationale(getFallback().inputRationale || {}).tef,
      vulnerability: parsedInputRationale.vulnerability || normaliseInputRationale(getFallback().inputRationale || {}).vulnerability,
      lossComponents: parsedInputRationale.lossComponents || normaliseInputRationale(getFallback().inputRationale || {}).lossComponents
    },
    suggestedInputs: {
      TEF: ensureRange(parsedSuggestedInputs.TEF, hasCompleteNumericRange(parsedSuggestedInputs.TEF) ? parsedSuggestedInputs.TEF : getFallbackSuggestedInputs().TEF),
      controlStrength: ensureRange(parsedSuggestedInputs.controlStrength, hasCompleteNumericRange(parsedSuggestedInputs.controlStrength) ? parsedSuggestedInputs.controlStrength : getFallbackSuggestedInputs().controlStrength),
      threatCapability: ensureRange(parsedSuggestedInputs.threatCapability, hasCompleteNumericRange(parsedSuggestedInputs.threatCapability) ? parsedSuggestedInputs.threatCapability : getFallbackSuggestedInputs().threatCapability),
      lossComponents: {
        incidentResponse: ensureRange(parsedSuggestedInputs?.lossComponents?.incidentResponse, hasCompleteNumericRange(parsedSuggestedInputs?.lossComponents?.incidentResponse) ? parsedSuggestedInputs.lossComponents.incidentResponse : getFallbackLossComponents().incidentResponse),
        businessInterruption: ensureRange(parsedSuggestedInputs?.lossComponents?.businessInterruption, hasCompleteNumericRange(parsedSuggestedInputs?.lossComponents?.businessInterruption) ? parsedSuggestedInputs.lossComponents.businessInterruption : getFallbackLossComponents().businessInterruption),
        dataBreachRemediation: ensureRange(parsedSuggestedInputs?.lossComponents?.dataBreachRemediation, hasCompleteNumericRange(parsedSuggestedInputs?.lossComponents?.dataBreachRemediation) ? parsedSuggestedInputs.lossComponents.dataBreachRemediation : getFallbackLossComponents().dataBreachRemediation),
        regulatoryLegal: ensureRange(parsedSuggestedInputs?.lossComponents?.regulatoryLegal, hasCompleteNumericRange(parsedSuggestedInputs?.lossComponents?.regulatoryLegal) ? parsedSuggestedInputs.lossComponents.regulatoryLegal : getFallbackLossComponents().regulatoryLegal),
        thirdPartyLiability: ensureRange(parsedSuggestedInputs?.lossComponents?.thirdPartyLiability, hasCompleteNumericRange(parsedSuggestedInputs?.lossComponents?.thirdPartyLiability) ? parsedSuggestedInputs.lossComponents.thirdPartyLiability : getFallbackLossComponents().thirdPartyLiability),
        reputationContract: ensureRange(parsedSuggestedInputs?.lossComponents?.reputationContract, hasCompleteNumericRange(parsedSuggestedInputs?.lossComponents?.reputationContract) ? parsedSuggestedInputs.lossComponents.reputationContract : getFallbackLossComponents().reputationContract)
      }
    },
    citations: Array.isArray(input.citations) ? input.citations : []
  };
}

const TREATMENT_SUGGESTION_TIMEOUTS = buildWorkflowTimeoutProfile({
  liveMs: 20000,
  repairMs: 10000
});

async function buildTreatmentSuggestionWorkflow(input = {}) {
  input = normaliseTreatmentSuggestionInput(input);
  const traceLabel = sanitizeAiText(input.traceLabel || 'Step 3 treatment suggestion', { maxChars: 120 }) || 'Step 3 treatment suggestion';
  if (!hasMeaningfulTreatmentRequest(input) || !hasMeaningfulTreatmentBaseline(input)) {
    return finaliseTreatmentSuggestionResult(
      buildManualTreatmentSuggestionResult(input, { traceLabel }),
      { input }
    );
  }
  const config = getCompassProviderConfig();
  if (!config.proxyConfigured) {
    return finaliseTreatmentSuggestionResult(
      buildFallbackTreatmentSuggestionResult(input, {
        aiUnavailable: true,
        traceLabel,
        fallbackReason: classifyTreatmentFallbackReason(new Error('Hosted AI proxy is not configured.'))
      }),
      { input }
    );
  }

  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.baselineAssessment?.geography || input.businessUnit?.geography,
    applicableRegulations: input.baselineAssessment?.applicableRegulations,
    organisationContext: input.baselineAssessment?.narrative,
    uploadedText: input.improvementRequest,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  const outputSchema = `{
  "summary": "string",
  "changesSummary": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "inputRationale": {
    "tef": "string",
    "vulnerability": "string",
    "lossComponents": "string"
  },
  "suggestedInputs": {
    "TEF": { "min": number, "likely": number, "max": number },
    "controlStrength": { "min": number, "likely": number, "max": number },
    "threatCapability": { "min": number, "likely": number, "max": number },
    "lossComponents": {
      "incidentResponse": { "min": number, "likely": number, "max": number },
      "businessInterruption": { "min": number, "likely": number, "max": number },
      "dataBreachRemediation": { "min": number, "likely": number, "max": number },
      "regulatoryLegal": { "min": number, "likely": number, "max": number },
      "thirdPartyLiability": { "min": number, "likely": number, "max": number },
      "reputationContract": { "min": number, "likely": number, "max": number }
    }
  }
}`;
  const systemPrompt = `You are a senior FAIR analyst helping a user model an improved future state.

Return JSON only with this schema:
${outputSchema}

Rules:
- treat this as a future-state comparison case, not a rewrite of the original scenario
- adjust only the FAIR inputs that are plausibly improved by the user's request
- keep changes credible and proportionate
- do not reduce every value automatically; preserve unchanged inputs where the request does not justify a shift
- explain the future-state logic in plain business language`;
  const fairInputs = input.baselineAssessment?.fairParams || input.baselineAssessment?.results?.inputs || {};
  const userPrompt = `Baseline scenario title: ${input.baselineAssessment?.scenarioTitle || 'Untitled scenario'}
Baseline narrative: ${truncateText(input.baselineAssessment?.enhancedNarrative || input.baselineAssessment?.narrative || '', 1400)}
Business unit: ${input.businessUnit?.name || 'Unknown'}
Geography: ${input.baselineAssessment?.geography || input.businessUnit?.geography || 'Unknown'}
User improvement request: ${truncateText(input.improvementRequest || '(none)', 1200)}
Current FAIR inputs:
${JSON.stringify(fairInputs, null, 2)}
Live scoped context:
${truncateText(buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null), 1400)}

Instructions:
- treat this as a future-state comparison case, not a rewrite of the original scenario
- adjust only the FAIR inputs that are plausibly improved by the user's request
- keep changes credible and proportionate
- explain what changed in plain language
- prefer stronger controls, lower event frequency, lower vulnerability, or lower loss only when justified by the user's request

Evidence quality context:
${truncateText(evidenceMeta.promptBlock || '', 320)}`;

  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'suggestTreatmentImprovement',
      temperature: 0.2,
      maxCompletionTokens: 1800,
      maxPromptChars: 10000,
      timeoutMs: TREATMENT_SUGGESTION_TIMEOUTS.liveMs,
      priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, outputSchema, {
      taskName: 'repairSuggestTreatmentImprovement',
      timeoutMs: TREATMENT_SUGGESTION_TIMEOUTS.repairMs
    });
    const candidate = normaliseTreatmentSuggestionCandidate(parsed?.parsed || {}, () => buildTreatmentImprovementStub(input), input);
    return finaliseTreatmentSuggestionResult(
      withEvidenceMeta({
        mode: 'live',
        ...candidate,
        usedFallback: false,
        aiUnavailable: false,
        trace: buildTraceEntry({
          label: traceLabel,
          promptSummary: generation.promptSummary,
          response: generation.text,
          sources: input.citations || []
        })
      }, evidenceMeta),
      { input }
    );
  } catch (error) {
    return buildFallbackFromError({
      error,
      classifyFallbackReason: classifyTreatmentFallbackReason,
      buildFallbackResult: ({ aiUnavailable, fallbackReason, normalisedError }) => {
        console.warn('buildTreatmentSuggestionWorkflow server fallback:', normalisedError.message);
        return finaliseTreatmentSuggestionResult(
          buildFallbackTreatmentSuggestionResult(input, {
            aiUnavailable,
            traceLabel,
            fallbackReason
          }),
          { input }
        );
      }
    });
  }
}

module.exports = {
  buildTreatmentSuggestionWorkflow,
  normaliseTreatmentSuggestionInput
};
