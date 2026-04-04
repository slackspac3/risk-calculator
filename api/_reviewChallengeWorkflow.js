'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const { buildTraceEntry, callAi, normaliseAiError, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
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
  buildContextPromptBlock,
  buildEvidenceMeta,
  buildResolvedObligationPromptBlock,
  classifyScenario,
  cleanUserFacingText,
  compactInputValue,
  isCompatibleScenarioLens,
  isPlainObject,
  normaliseAdminSettingsInput,
  normaliseBlockInputText,
  normaliseBusinessUnitInput,
  normaliseCitationInputs,
  normaliseGuidance,
  normaliseInlineInputText,
  normaliseStringListInput,
  truncateText,
  withEvidenceMeta
} = workflowUtils;

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function normaliseNumericInput(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normaliseFairParamsInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  const next = {};
  Object.entries(value).forEach(([key, item]) => {
    const parsed = normaliseNumericInput(item);
    if (parsed !== undefined) next[key] = parsed;
  });
  return Object.keys(next).length ? next : undefined;
}

function normaliseResultsInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    ale: compactInputValue({
      mean: normaliseNumericInput(value?.ale?.mean)
    }),
    eventLoss: compactInputValue({
      p90: normaliseNumericInput(value?.eventLoss?.p90)
    })
  });
}

function normaliseConfidenceInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    label: normaliseInlineInputText(value.label || ''),
    summary: normaliseBlockInputText(value.summary || ''),
    score: normaliseNumericInput(value.score)
  });
}

function normaliseSensitivityDriverInput(item = {}) {
  if (!isPlainObject(item)) return undefined;
  return compactInputValue({
    label: normaliseInlineInputText(item.label || ''),
    why: normaliseBlockInputText(item.why || '')
  });
}

function normaliseDriversInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    upward: normaliseStringListInput(value.upward, { maxItems: 6, block: true }),
    stabilisers: normaliseStringListInput(value.stabilisers, { maxItems: 6, block: true }),
    sensitivity: (Array.isArray(value.sensitivity) ? value.sensitivity : [])
      .map((item) => normaliseSensitivityDriverInput(item))
      .filter(Boolean)
      .slice(0, 6)
  });
}

function normaliseAssumptionInput(item = {}) {
  if (!isPlainObject(item)) return undefined;
  return compactInputValue({
    category: normaliseInlineInputText(item.category || ''),
    text: normaliseBlockInputText(item.text || item.label || '')
  });
}

function normaliseAssumptionsInput(items = [], { maxItems = 8 } = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normaliseAssumptionInput(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseAssessmentIntelligenceInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    assumptions: normaliseAssumptionsInput(value.assumptions, { maxItems: 8 }),
    drivers: compactInputValue({
      sensitivity: (Array.isArray(value?.drivers?.sensitivity) ? value.drivers.sensitivity : [])
        .map((item) => normaliseSensitivityDriverInput(item))
        .filter(Boolean)
        .slice(0, 6)
    })
  });
}

function normaliseObligationBasisInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    resolvedObligationSummary: normaliseBlockInputText(value.resolvedObligationSummary || ''),
    resolvedObligationContext: workflowUtils.normaliseResolvedObligationContextInput
      ? workflowUtils.normaliseResolvedObligationContextInput(value.resolvedObligationContext)
      : undefined,
    direct: (Array.isArray(value.direct) ? value.direct : [])
      .map((item) => workflowUtils.normaliseResolvedObligationEntryInput
        ? workflowUtils.normaliseResolvedObligationEntryInput(item)
        : undefined)
      .filter(Boolean)
      .slice(0, 6),
    inheritedMandatory: (Array.isArray(value.inheritedMandatory) ? value.inheritedMandatory : [])
      .map((item) => workflowUtils.normaliseResolvedObligationEntryInput
        ? workflowUtils.normaliseResolvedObligationEntryInput(item)
        : undefined)
      .filter(Boolean)
      .slice(0, 6),
    inheritedConditional: (Array.isArray(value.inheritedConditional) ? value.inheritedConditional : [])
      .map((item) => workflowUtils.normaliseResolvedObligationEntryInput
        ? workflowUtils.normaliseResolvedObligationEntryInput(item)
        : undefined)
      .filter(Boolean)
      .slice(0, 6),
    inheritedGuidance: (Array.isArray(value.inheritedGuidance) ? value.inheritedGuidance : [])
      .map((item) => workflowUtils.normaliseResolvedObligationEntryInput
        ? workflowUtils.normaliseResolvedObligationEntryInput(item)
        : undefined)
      .filter(Boolean)
      .slice(0, 6)
  });
}

function normaliseScenarioLensInput(value = {}) {
  if (!isPlainObject(value)) return undefined;
  return compactInputValue({
    key: normaliseInlineInputText(value.key || ''),
    label: normaliseInlineInputText(value.label || '')
  });
}

function normaliseReviewerDecisionBriefInput(input = {}) {
  return compactInputValue({
    assessmentData: normaliseBlockInputText(input.assessmentData || ''),
    preferredSection: normaliseInlineInputText(input.preferredSection || ''),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

function normaliseChallengeAssessmentInput(input = {}) {
  return compactInputValue({
    scenarioTitle: normaliseInlineInputText(input.scenarioTitle || ''),
    narrative: normaliseBlockInputText(input.narrative || ''),
    geography: normaliseInlineInputText(input.geography || ''),
    businessUnitName: normaliseInlineInputText(input.businessUnitName || ''),
    businessUnit: normaliseBusinessUnitInput(input.businessUnit),
    adminSettings: normaliseAdminSettingsInput(input.adminSettings),
    confidence: normaliseConfidenceInput(input.confidence),
    drivers: normaliseDriversInput(input.drivers),
    assumptions: normaliseAssumptionsInput(input.assumptions, { maxItems: 8 }),
    missingInformation: normaliseStringListInput(input.missingInformation, { maxItems: 8, block: true }),
    applicableRegulations: normaliseStringListInput(input.applicableRegulations, { maxItems: 12 }),
    citations: normaliseCitationInputs(input.citations),
    results: normaliseResultsInput(input.results),
    fairParams: normaliseFairParamsInput(input.fairParams),
    assessmentIntelligence: normaliseAssessmentIntelligenceInput(input.assessmentIntelligence),
    obligationBasis: normaliseObligationBasisInput(input.obligationBasis),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

function normaliseParameterChallengeRecordInput(input = {}) {
  return compactInputValue({
    parameterKey: normaliseInlineInputText(input.parameterKey || ''),
    parameterLabel: normaliseInlineInputText(input.parameterLabel || ''),
    currentValue: input.currentValue,
    currentValueLabel: normaliseInlineInputText(input.currentValueLabel || ''),
    scenarioSummary: normaliseBlockInputText(input.scenarioSummary || ''),
    reviewerConcern: normaliseBlockInputText(input.reviewerConcern || ''),
    currentAle: normaliseInlineInputText(input.currentAle || ''),
    allowedParams: normaliseStringListInput(input.allowedParams, { maxItems: 8 }),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

function normaliseChallengeRecordInput(item = {}) {
  if (!isPlainObject(item)) return undefined;
  return compactInputValue({
    parameter: normaliseInlineInputText(item.parameter || ''),
    concern: normaliseBlockInputText(item.concern || ''),
    reviewerAdjustment: compactInputValue({
      param: normaliseInlineInputText(item?.reviewerAdjustment?.param || ''),
      suggestedValue: normaliseNumericInput(item?.reviewerAdjustment?.suggestedValue),
      aleImpact: normaliseBlockInputText(item?.reviewerAdjustment?.aleImpact || ''),
      rationale: normaliseBlockInputText(item?.reviewerAdjustment?.rationale || '')
    })
  });
}

function normaliseChallengeSynthesisInput(input = {}) {
  return compactInputValue({
    scenarioTitle: normaliseInlineInputText(input.scenarioTitle || ''),
    scenarioSummary: normaliseBlockInputText(input.scenarioSummary || ''),
    baseAleRange: normaliseInlineInputText(input.baseAleRange || ''),
    records: (Array.isArray(input.records) ? input.records : [])
      .map((item) => normaliseChallengeRecordInput(item))
      .filter(Boolean)
      .slice(0, 8),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

function normaliseConsensusChallengeInput(item = {}) {
  if (!isPlainObject(item)) return undefined;
  return compactInputValue({
    ref: normaliseInlineInputText(item.ref || ''),
    parameter: normaliseInlineInputText(item.parameter || ''),
    concern: normaliseBlockInputText(item.concern || ''),
    proposedValue: normaliseInlineInputText(item.proposedValue || ''),
    impactPct: normaliseNumericInput(item.impactPct),
    aleImpact: normaliseBlockInputText(item.aleImpact || '')
  });
}

function normaliseConsensusRecommendationInput(input = {}) {
  return compactInputValue({
    scenarioTitle: normaliseInlineInputText(input.scenarioTitle || ''),
    scenarioSummary: normaliseBlockInputText(input.scenarioSummary || ''),
    originalAleRange: normaliseInlineInputText(input.originalAleRange || ''),
    adjustedAleRange: normaliseInlineInputText(input.adjustedAleRange || ''),
    projectedAleRange: normaliseInlineInputText(input.projectedAleRange || ''),
    aleChangePct: normaliseNumericInput(input.aleChangePct),
    originalParameters: normaliseFairParamsInput(input.originalParameters),
    adjustedParameters: normaliseFairParamsInput(input.adjustedParameters),
    challenges: (Array.isArray(input.challenges) ? input.challenges : [])
      .map((item) => normaliseConsensusChallengeInput(item))
      .filter(Boolean)
      .slice(0, 8),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

function normaliseReviewMediationInput(input = {}) {
  return compactInputValue({
    narrative: normaliseBlockInputText(input.narrative || ''),
    fairParams: normaliseFairParamsInput(input.fairParams),
    results: normaliseResultsInput(input.results),
    assessmentIntelligence: normaliseAssessmentIntelligenceInput(input.assessmentIntelligence),
    reviewerView: normaliseBlockInputText(input.reviewerView || ''),
    analystView: normaliseBlockInputText(input.analystView || ''),
    disputedFocus: normaliseInlineInputText(input.disputedFocus || ''),
    scenarioLens: normaliseScenarioLensInput(input.scenarioLens),
    citations: normaliseCitationInputs(input.citations, { maxItems: 4 }),
    traceLabel: normaliseInlineInputText(input.traceLabel || '')
  }) || {};
}

const REVIEW_STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'almost', 'along', 'also', 'although', 'among', 'another', 'because', 'before',
  'being', 'between', 'beyond', 'could', 'continue', 'despite', 'during', 'either', 'enough', 'every', 'general', 'generic',
  'given', 'having', 'however', 'issue', 'issues', 'itself', 'later', 'likely', 'mainly', 'might', 'needs', 'other', 'other',
  'overall', 'remain', 'remains', 'same', 'should', 'since', 'still', 'their', 'there', 'these', 'those', 'through', 'under',
  'unless', 'until', 'using', 'where', 'which', 'while', 'without', 'would'
]);

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function joinList(items = []) {
  const values = uniqueStrings(items);
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function normaliseSemanticText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countPhraseMatches(text = '', phrases = []) {
  const haystack = ` ${normaliseSemanticText(text)} `;
  if (!haystack.trim()) return 0;
  return uniqueStrings((Array.isArray(phrases) ? phrases : [])
    .map((phrase) => {
      if (phrase && typeof phrase === 'object') return phrase.text || phrase.label || phrase.value || '';
      return phrase;
    }))
    .filter((phrase) => {
      const needle = normaliseSemanticText(phrase);
      return needle && haystack.includes(` ${needle} `);
    }).length;
}

function hasNegatedFamilyReference(text = '', phrases = []) {
  const haystack = normaliseSemanticText(text);
  if (!haystack) return false;
  return uniqueStrings((Array.isArray(phrases) ? phrases : [])
    .map((phrase) => {
      if (phrase && typeof phrase === 'object') return phrase.text || phrase.label || phrase.value || '';
      return phrase;
    }))
    .some((phrase) => {
      const needle = normaliseSemanticText(phrase);
      if (!needle) return false;
      const pattern = new RegExp(`(?:do not|dont|not|without|rather than|instead of|avoid|avoiding|stop|never)\\s+(?:[a-z0-9]+\\s+){0,10}${escapeRegex(needle).replace(/\\ /g, '\\s+')}`);
      return pattern.test(haystack);
    });
}

function extractContentTokens(value = '', { maxItems = 24 } = {}) {
  const tokens = normaliseSemanticText(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !REVIEW_STOPWORDS.has(token));
  return Array.from(new Set(tokens)).slice(0, maxItems);
}

function countTokenOverlap(text = '', tokens = []) {
  const haystackTokens = new Set(extractContentTokens(text, { maxItems: 64 }));
  return uniqueStrings(tokens).filter((token) => haystackTokens.has(String(token || '').trim().toLowerCase())).length;
}

function collectAllowedSecondaryFamilyKeys(primaryFamily = null) {
  return uniqueStrings([
    ...(Array.isArray(primaryFamily?.allowedSecondaryFamilies) ? primaryFamily.allowedSecondaryFamilies : []),
    ...(Array.isArray(primaryFamily?.canCoExistWith) ? primaryFamily.canCoExistWith : []),
    ...(Array.isArray(primaryFamily?.canEscalateTo) ? primaryFamily.canEscalateTo : [])
  ]);
}

function collectFamilyThemePhrases(family = null) {
  if (!family) return [];
  return uniqueStrings([
    family.label,
    ...(Array.isArray(family.preferredRiskThemes) ? family.preferredRiskThemes : []),
    ...(Array.isArray(family.shortlistSeedThemes) ? family.shortlistSeedThemes : []),
    ...(Array.isArray(family.examplePhrases) ? family.examplePhrases : []),
    ...(Array.isArray(family.typicalAssets) ? family.typicalAssets : []),
    ...(Array.isArray(family.typicalCauses) ? family.typicalCauses : []),
    ...(Array.isArray(family.positiveSignals)
      ? family.positiveSignals
        .filter((signal) => ['strong', 'medium'].includes(String(signal?.strength || '').trim().toLowerCase()))
        .map((signal) => signal?.text)
      : [])
  ]);
}

function collectMechanismThemePhrases(mechanismKeys = []) {
  return uniqueStrings((Array.isArray(mechanismKeys) ? mechanismKeys : [])
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

function buildAcceptedScenarioSourceText(input = {}) {
  return [
    input?.narrative,
    input?.scenarioSummary,
    input?.assessmentData
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ').trim();
}

function buildSelectedRiskThemePhrases(input = {}) {
  const selectedRisks = Array.isArray(input?.selectedRisks)
    ? input.selectedRisks
    : (Array.isArray(input?.risks) ? input.risks : []);
  return uniqueStrings(selectedRisks.flatMap((risk) => [
    risk?.title,
    risk?.category,
    risk?.description
  ]));
}

function buildAcceptedScenarioContext(input = {}) {
  const sourceText = buildAcceptedScenarioSourceText(input);
  const scenarioLensHint = String(input?.scenarioLens?.key || input?.scenarioLens?.label || '').trim();
  const acceptedClassification = classifyScenario(sourceText, { scenarioLensHint });
  const acceptedPrimaryFamily = acceptedClassification?.primaryFamily || null;
  const acceptedLens = buildScenarioLens(acceptedClassification);
  const allowedSecondaryFamilyKeys = collectAllowedSecondaryFamilyKeys(acceptedPrimaryFamily);
  const acceptedSecondaryFamilies = (Array.isArray(acceptedClassification?.secondaryFamilies) ? acceptedClassification.secondaryFamilies : [])
    .filter(Boolean)
    .filter((family) => allowedSecondaryFamilyKeys.includes(String(family?.key || '').trim()));
  const acceptedSecondaryFamilyKeys = uniqueStrings(acceptedSecondaryFamilies.map((family) => family?.key));
  const acceptedMechanismKeys = uniqueStrings([
    ...(Array.isArray(acceptedClassification?.mechanisms) ? acceptedClassification.mechanisms.map((mechanism) => mechanism?.key) : []),
    ...(Array.isArray(acceptedPrimaryFamily?.defaultMechanisms) ? acceptedPrimaryFamily.defaultMechanisms : []),
    ...acceptedSecondaryFamilies.flatMap((family) => Array.isArray(family?.defaultMechanisms) ? family.defaultMechanisms.slice(0, 1) : [])
  ]);
  const acceptedOverlayKeys = uniqueStrings([
    ...(Array.isArray(acceptedPrimaryFamily?.defaultOverlays) ? acceptedPrimaryFamily.defaultOverlays : []),
    ...(Array.isArray(acceptedClassification?.overlays) ? acceptedClassification.overlays.map((overlay) => overlay?.key) : [])
  ]);
  const triggerSignalPhrases = uniqueStrings(
    (Array.isArray(acceptedClassification?.matchedSignals) ? acceptedClassification.matchedSignals : [])
      .filter((signal) => ['strong', 'medium'].includes(String(signal?.strength || '').trim().toLowerCase()))
      .map((signal) => signal?.text)
  );
  const familyThemePhrases = uniqueStrings([
    ...collectFamilyThemePhrases(acceptedPrimaryFamily),
    ...acceptedSecondaryFamilies.flatMap((family) => collectFamilyThemePhrases(family).slice(0, 8))
  ]);
  const mechanismThemePhrases = collectMechanismThemePhrases(acceptedMechanismKeys);
  const overlayThemePhrases = uniqueStrings(acceptedOverlayKeys
    .map((key) => SCENARIO_TAXONOMY_OVERLAY_BY_KEY[key])
    .filter(Boolean)
    .flatMap((overlay) => [overlay.label, overlay.key]));
  const selectedRiskThemePhrases = buildSelectedRiskThemePhrases(input);
  const anchorPhrases = uniqueStrings([
    ...triggerSignalPhrases,
    ...familyThemePhrases,
    ...mechanismThemePhrases,
    ...overlayThemePhrases,
    ...selectedRiskThemePhrases
  ]).slice(0, 48);
  const anchorTokens = uniqueStrings([
    ...extractContentTokens(sourceText, { maxItems: 20 }),
    ...extractContentTokens(triggerSignalPhrases.join(' '), { maxItems: 16 }),
    ...extractContentTokens(familyThemePhrases.join(' '), { maxItems: 20 }),
    ...extractContentTokens(mechanismThemePhrases.join(' '), { maxItems: 16 }),
    ...extractContentTokens(selectedRiskThemePhrases.join(' '), { maxItems: 12 })
  ]).slice(0, 36);
  const acceptedFamilyKeys = uniqueStrings([
    String(acceptedPrimaryFamily?.key || '').trim(),
    ...acceptedSecondaryFamilyKeys
  ]);
  const allowedFamilyKeys = uniqueStrings([
    String(acceptedPrimaryFamily?.key || '').trim(),
    ...acceptedSecondaryFamilyKeys,
    ...allowedSecondaryFamilyKeys
  ]);
  const allowedLensKeys = uniqueStrings([
    String(acceptedLens?.key || '').trim(),
    ...(Array.isArray(acceptedLens?.secondaryKeys) ? acceptedLens.secondaryKeys : []),
    ...allowedFamilyKeys.map((familyKey) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[familyKey]?.lensKey)
  ]);
  const forbiddenFamilyKeys = acceptedPrimaryFamily
    ? uniqueStrings([
        ...(Array.isArray(acceptedPrimaryFamily.forbiddenDriftFamilies) ? acceptedPrimaryFamily.forbiddenDriftFamilies : []),
        ...(Array.isArray(acceptedPrimaryFamily.cannotBePrimaryWith) ? acceptedPrimaryFamily.cannotBePrimaryWith : [])
      ])
    : [];
  const forbiddenFamilyThemeMap = forbiddenFamilyKeys.reduce((accumulator, familyKey) => {
    const family = SCENARIO_TAXONOMY_FAMILY_BY_KEY[familyKey] || null;
    if (family) accumulator[familyKey] = collectFamilyThemePhrases(family).slice(0, 16);
    return accumulator;
  }, {});
  return {
    sourceText,
    acceptedClassification,
    primaryFamily: acceptedPrimaryFamily,
    acceptedPrimaryKey: String(acceptedPrimaryFamily?.key || '').trim(),
    acceptedSecondaryFamilyKeys,
    acceptedSecondaryKeySet: new Set(acceptedSecondaryFamilyKeys),
    allowedSecondaryFamilyKeys,
    allowedSecondaryKeySet: new Set(allowedSecondaryFamilyKeys),
    acceptedMechanismKeys,
    acceptedMechanismKeySet: new Set(acceptedMechanismKeys),
    acceptedOverlayKeys,
    acceptedOverlayKeySet: new Set(acceptedOverlayKeys),
    acceptedLensKey: String(acceptedLens?.key || '').trim(),
    allowedLensKeys,
    allowedLensKeySet: new Set(allowedLensKeys),
    acceptedDomainKeys: new Set(uniqueStrings(allowedFamilyKeys.map((familyKey) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[familyKey]?.domain))),
    triggerSignalPhrases,
    familyThemePhrases,
    mechanismThemePhrases,
    overlayThemePhrases,
    selectedRiskThemePhrases,
    anchorPhrases,
    anchorTokens,
    narrativeSummary: cleanUserFacingText(sourceText, { maxSentences: 1 }),
    forbiddenFamilyThemeMap,
    taxonomyVersion: String(acceptedClassification?.taxonomyVersion || SCENARIO_TAXONOMY.taxonomyVersion || '').trim()
  };
}

function describeAcceptedScenarioPath(context = {}) {
  const narrativeSummary = cleanUserFacingText(context?.narrativeSummary || context?.sourceText || '', {
    maxSentences: 1,
    stripTrailingPeriod: true
  });
  if (narrativeSummary) return narrativeSummary;
  const triggerSummary = uniqueStrings(context?.triggerSignalPhrases || []).slice(0, 2).join(' and ');
  if (triggerSummary) return triggerSummary;
  const familyLabel = String(context?.primaryFamily?.label || 'accepted scenario').trim();
  return familyLabel;
}

function describeAcceptedLane(context = {}) {
  const familyLabel = String(context?.primaryFamily?.label || '').trim();
  const lensLabel = String(context?.primaryFamily?.lensLabel || '').trim();
  if (familyLabel && lensLabel && familyLabel.toLowerCase() !== lensLabel.toLowerCase()) {
    return `${familyLabel} (${lensLabel})`;
  }
  return familyLabel || lensLabel || 'accepted scenario';
}

function getOutputDominantFamilies(evaluations = [], acceptedContext = {}) {
  const counts = new Map();
  (Array.isArray(evaluations) ? evaluations : []).forEach((evaluation) => {
    const familyKey = String(evaluation?.primaryFamilyKey || '').trim();
    if (!familyKey) return;
    const current = counts.get(familyKey) || { familyKey, count: 0, blockedCount: 0 };
    current.count += 1;
    if (evaluation?.blocked) current.blockedCount += 1;
    counts.set(familyKey, current);
  });
  return Array.from(counts.values())
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.familyKey.localeCompare(right.familyKey);
    })
    .slice(0, 5)
    .map((entry) => ({
      familyKey: entry.familyKey,
      count: entry.count,
      blockedCount: entry.blockedCount,
      alignment: entry.familyKey === acceptedContext.acceptedPrimaryKey
        ? 'accepted_primary'
        : (acceptedContext.acceptedSecondaryKeySet?.has(entry.familyKey)
            ? 'accepted_secondary'
            : (acceptedContext.allowedSecondaryKeySet?.has(entry.familyKey) ? 'allowed_secondary' : 'off_lane'))
    }));
}

function assessReviewSemanticText(text = '', acceptedContext = {}, {
  sectionKey = ''
} = {}) {
  const cleanText = cleanUserFacingText(text, { maxSentences: 4 });
  if (!cleanText) {
    return {
      sectionKey,
      text: '',
      classification: null,
      primaryFamilyKey: '',
      blocked: false,
      offLane: false,
      consequenceHeavy: false,
      weakOverlayOnly: false,
      stronglyAligned: false,
      status: 'empty',
      score: 0,
      reasonCodes: []
    };
  }

  const classification = classifyScenario(cleanText, { scenarioLensHint: '' });
  const rawPrimaryFamilyKey = String(classification?.primaryFamily?.key || '').trim();
  const rawPrimaryFamily = SCENARIO_TAXONOMY_FAMILY_BY_KEY[rawPrimaryFamilyKey] || null;
  const lensKey = String(buildScenarioLens(classification)?.key || '').trim();
  const secondaryKeys = uniqueStrings((Array.isArray(classification?.secondaryFamilies) ? classification.secondaryFamilies : [])
    .map((family) => family?.key));
  const mechanismKeys = uniqueStrings((Array.isArray(classification?.mechanisms) ? classification.mechanisms : [])
    .map((mechanism) => mechanism?.key));
  const overlayKeys = uniqueStrings((Array.isArray(classification?.overlays) ? classification.overlays : [])
    .map((overlay) => overlay?.key));
  const explicitBlockedFamilyMentions = Object.entries(acceptedContext.forbiddenFamilyThemeMap || {})
    .filter(([, phrases]) => countPhraseMatches(cleanText, phrases) > 0 && !hasNegatedFamilyReference(cleanText, phrases))
    .map(([familyKey]) => familyKey);
  const negatedOffLaneReference = Boolean(
    rawPrimaryFamilyKey
    && rawPrimaryFamily
    && rawPrimaryFamilyKey !== acceptedContext.acceptedPrimaryKey
    && hasNegatedFamilyReference(cleanText, collectFamilyThemePhrases(rawPrimaryFamily).slice(0, 16))
  );
  const primaryFamilyKey = negatedOffLaneReference ? '' : rawPrimaryFamilyKey;
  const primaryFamily = negatedOffLaneReference ? null : rawPrimaryFamily;
  const familyAligned = !!acceptedContext.acceptedPrimaryKey && primaryFamilyKey === acceptedContext.acceptedPrimaryKey;
  const secondaryAligned = !!primaryFamilyKey && acceptedContext.acceptedSecondaryKeySet?.has(primaryFamilyKey);
  const allowedSecondaryAligned = !!primaryFamilyKey
    && acceptedContext.allowedSecondaryKeySet?.has(primaryFamilyKey)
    && (countPhraseMatches(cleanText, acceptedContext.anchorPhrases) > 0
      || countTokenOverlap(cleanText, acceptedContext.anchorTokens) >= 2
      || mechanismKeys.some((key) => acceptedContext.acceptedMechanismKeySet?.has(key)));
  const secondaryContextAligned = secondaryKeys.some((key) => (
    key === acceptedContext.acceptedPrimaryKey
    || acceptedContext.acceptedSecondaryKeySet?.has(key)
    || acceptedContext.allowedSecondaryKeySet?.has(key)
  ));
  const tokenOverlapCount = countTokenOverlap(cleanText, acceptedContext.anchorTokens);
  const anchorPhraseOverlap = countPhraseMatches(cleanText, acceptedContext.anchorPhrases);
  const triggerOverlap = countPhraseMatches(cleanText, acceptedContext.triggerSignalPhrases);
  const themeOverlap = countPhraseMatches(cleanText, acceptedContext.familyThemePhrases);
  const mechanismOverlapCount = mechanismKeys.filter((key) => acceptedContext.acceptedMechanismKeySet?.has(key)).length
    + countPhraseMatches(cleanText, acceptedContext.mechanismThemePhrases);
  const overlayOverlapCount = overlayKeys.filter((key) => acceptedContext.acceptedOverlayKeySet?.has(key)).length
    + countPhraseMatches(cleanText, acceptedContext.overlayThemePhrases);
  const eventPathEvidenceCount = [
    anchorPhraseOverlap > 0,
    tokenOverlapCount >= 2,
    triggerOverlap > 0,
    themeOverlap > 0,
    mechanismOverlapCount > 0
  ].filter(Boolean).length;
  const blockedFamily = explicitBlockedFamilyMentions[0]
    || (acceptedContext.primaryFamily && primaryFamilyKey && familyConflictsWith(acceptedContext.primaryFamily, primaryFamilyKey) ? primaryFamilyKey : '');
  const blockedByAcceptedAntiSignals = countPhraseMatches(cleanText, acceptedContext.primaryFamily?.antiSignals || []);
  const blockedByClassifierAntiSignals = (Array.isArray(classification?.blockedByAntiSignals) ? classification.blockedByAntiSignals : [])
    .some((entry) => entry?.familyKey === acceptedContext.acceptedPrimaryKey);
  const domainAligned = !primaryFamily
    || !primaryFamily.domain
    || acceptedContext.acceptedDomainKeys?.has(String(primaryFamily.domain || '').trim());
  const lensAligned = !lensKey
    || !acceptedContext.acceptedLensKey
    || acceptedContext.allowedLensKeySet?.has(lensKey)
    || isCompatibleScenarioLens(acceptedContext.acceptedLensKey, lensKey);
  const consequenceHeavy = classification?.reasonCodes?.includes('CONSEQUENCE_ONLY_NOT_PRIMARY')
    || classification?.ambiguityFlags?.includes('CONSEQUENCE_HEAVY_TEXT');
  const consequenceOnly = !primaryFamilyKey
    && consequenceHeavy
    && overlayOverlapCount > 0
    && eventPathEvidenceCount <= 1;
  const blocked = Boolean(blockedFamily || blockedByAcceptedAntiSignals || blockedByClassifierAntiSignals);
  const offLane = Boolean(
    !blocked
    && !negatedOffLaneReference
    && primaryFamilyKey
    && !familyAligned
    && !secondaryAligned
    && !allowedSecondaryAligned
    && !secondaryContextAligned
    && !domainAligned
    && !lensAligned
  );
  const weakOverlayOnly = !blocked
    && !familyAligned
    && !secondaryAligned
    && !allowedSecondaryAligned
    && !secondaryContextAligned
    && consequenceHeavy
    && overlayOverlapCount > 0
    && eventPathEvidenceCount >= 1;

  let score = 0;
  if (familyAligned) score += 48;
  else if (secondaryAligned) score += 34;
  else if (allowedSecondaryAligned) score += 28;
  else if (secondaryContextAligned) score += 22;
  else if (primaryFamilyKey) score -= 18;
  if (anchorPhraseOverlap > 0) score += Math.min(18, anchorPhraseOverlap * 6);
  if (tokenOverlapCount >= 2) score += Math.min(14, tokenOverlapCount * 2);
  if (triggerOverlap > 0) score += Math.min(12, triggerOverlap * 6);
  if (themeOverlap > 0) score += Math.min(10, themeOverlap * 5);
  if (mechanismOverlapCount > 0) score += Math.min(14, mechanismOverlapCount * 5);
  if (overlayOverlapCount > 0) score += Math.min(8, overlayOverlapCount * 3);
  if (!domainAligned && primaryFamilyKey) score -= 10;
  if (!lensAligned && lensKey) score -= 10;
  if (consequenceOnly) score -= 16;
  else if (consequenceHeavy) score -= 8;
  if (blocked) score -= 80;
  if (offLane) score -= 36;

  const reasonCodes = uniqueStrings([
    familyAligned ? 'PRIMARY_FAMILY_ALIGNED' : '',
    secondaryAligned ? 'SECONDARY_FAMILY_ALIGNED' : '',
    allowedSecondaryAligned ? 'ALLOWED_SECONDARY_FAMILY_ALIGNED' : '',
    secondaryContextAligned ? 'PRIMARY_CONTEXT_RETAINED' : '',
    anchorPhraseOverlap > 0 || tokenOverlapCount >= 2 ? 'HAS_EVENT_ANCHOR_OVERLAP' : 'LOW_EVENT_ANCHOR_OVERLAP',
    blockedFamily ? 'BLOCKED_BY_FAMILY_CONFLICT' : '',
    blockedByAcceptedAntiSignals ? 'BLOCKED_BY_ACCEPTED_ANTI_SIGNAL' : '',
    blockedByClassifierAntiSignals ? 'BLOCKED_BY_CLASSIFIER_ANTI_SIGNAL' : '',
    negatedOffLaneReference ? 'NEGATED_OFF_LANE_REFERENCE' : '',
    offLane ? 'OFF_LANE_FAMILY_DRIFT' : '',
    consequenceOnly ? 'CONSEQUENCE_ONLY_DRIFT' : '',
    consequenceHeavy && !consequenceOnly ? 'CONSEQUENCE_HEAVY_DRIFT' : '',
    explicitBlockedFamilyMentions.length ? 'EXPLICIT_BLOCKED_FAMILY_MENTION' : ''
  ]);

  const stronglyAligned = !blocked
    && !offLane
    && (familyAligned || secondaryAligned || allowedSecondaryAligned || secondaryContextAligned || eventPathEvidenceCount >= 2)
    && score >= 20;
  const status = blocked
    ? 'off-lane-incoherent'
    : (offLane
        ? 'off-lane-incoherent'
        : (stronglyAligned
            ? 'reinforces-accepted-scenario'
            : (weakOverlayOnly
                ? 'consequence-heavy-recoverable'
                : ((consequenceHeavy && eventPathEvidenceCount <= 1)
                    ? 'consequence-heavy-recoverable'
                    : 'mixed-but-valid'))));

  return {
    sectionKey,
    text: cleanText,
    classification,
    primaryFamilyKey,
    familyAligned,
    secondaryAligned,
    allowedSecondaryAligned,
    secondaryContextAligned,
    blockedFamily,
    blocked,
    offLane,
    consequenceHeavy,
    consequenceOnly,
    weakOverlayOnly,
    stronglyAligned,
    score,
    status,
    reasonCodes,
    eventPathEvidenceCount
  };
}

const REVIEW_OUTPUT_SECTION_CONFIG = Object.freeze({
  reviewer_brief: [
    {
      key: 'whatMatters',
      priority: 'high',
      getText: (output = {}) => output.whatMatters,
      copyFromFallback(target = {}, fallback = {}) { target.whatMatters = String(fallback.whatMatters || '').trim(); }
    },
    {
      key: 'whatsUncertain',
      priority: 'normal',
      getText: (output = {}) => output.whatsUncertain,
      copyFromFallback(target = {}, fallback = {}) { target.whatsUncertain = String(fallback.whatsUncertain || '').trim(); }
    },
    {
      key: 'whatToDo',
      priority: 'normal',
      getText: (output = {}) => output.whatToDo,
      copyFromFallback(target = {}, fallback = {}) { target.whatToDo = String(fallback.whatToDo || '').trim(); }
    }
  ],
  challenge_assessment_review: [
    {
      key: 'summary',
      priority: 'high',
      getText: (output = {}) => output.summary,
      copyFromFallback(target = {}, fallback = {}) { target.summary = String(fallback.summary || '').trim(); }
    },
    {
      key: 'weakestAssumptions',
      priority: 'normal',
      getText: (output = {}) => Array.isArray(output.weakestAssumptions) ? output.weakestAssumptions.join(' ') : '',
      copyFromFallback(target = {}, fallback = {}) { target.weakestAssumptions = Array.isArray(fallback.weakestAssumptions) ? fallback.weakestAssumptions.slice() : []; }
    },
    {
      key: 'committeeQuestions',
      priority: 'normal',
      getText: (output = {}) => Array.isArray(output.committeeQuestions) ? output.committeeQuestions.join(' ') : '',
      copyFromFallback(target = {}, fallback = {}) { target.committeeQuestions = Array.isArray(fallback.committeeQuestions) ? fallback.committeeQuestions.slice() : []; }
    },
    {
      key: 'reviewerGuidance',
      priority: 'normal',
      getText: (output = {}) => Array.isArray(output.reviewerGuidance) ? output.reviewerGuidance.join(' ') : '',
      copyFromFallback(target = {}, fallback = {}) { target.reviewerGuidance = Array.isArray(fallback.reviewerGuidance) ? fallback.reviewerGuidance.slice() : []; }
    }
  ],
  challenge_assessment_executive: [
    {
      key: 'challengeSummary',
      priority: 'high',
      getText: (output = {}) => output.challengeSummary,
      copyFromFallback(target = {}, fallback = {}) { target.challengeSummary = String(fallback.challengeSummary || '').trim(); }
    },
    {
      key: 'weakestAssumption',
      priority: 'normal',
      getText: (output = {}) => output.weakestAssumption,
      copyFromFallback(target = {}, fallback = {}) { target.weakestAssumption = String(fallback.weakestAssumption || '').trim(); }
    },
    {
      key: 'alternativeView',
      priority: 'normal',
      getText: (output = {}) => output.alternativeView,
      copyFromFallback(target = {}, fallback = {}) { target.alternativeView = String(fallback.alternativeView || '').trim(); }
    },
    {
      key: 'oneQuestion',
      priority: 'normal',
      getText: (output = {}) => output.oneQuestion,
      copyFromFallback(target = {}, fallback = {}) { target.oneQuestion = String(fallback.oneQuestion || '').trim(); }
    }
  ],
  parameter_challenge: [
    {
      key: 'analystQuestions',
      priority: 'high',
      getText: (output = {}) => Array.isArray(output.analystQuestions) ? output.analystQuestions.join(' ') : '',
      copyFromFallback(target = {}, fallback = {}) { target.analystQuestions = Array.isArray(fallback.analystQuestions) ? fallback.analystQuestions.slice() : []; }
    },
    {
      key: 'reviewerAdjustment.aleImpact',
      priority: 'normal',
      getText: (output = {}) => output?.reviewerAdjustment?.aleImpact || '',
      copyFromFallback(target = {}, fallback = {}) {
        target.reviewerAdjustment = target.reviewerAdjustment && typeof target.reviewerAdjustment === 'object' ? target.reviewerAdjustment : {};
        target.reviewerAdjustment.aleImpact = String(fallback?.reviewerAdjustment?.aleImpact || '').trim();
      }
    },
    {
      key: 'reviewerAdjustment.rationale',
      priority: 'high',
      getText: (output = {}) => output?.reviewerAdjustment?.rationale || '',
      copyFromFallback(target = {}, fallback = {}) {
        target.reviewerAdjustment = target.reviewerAdjustment && typeof target.reviewerAdjustment === 'object' ? target.reviewerAdjustment : {};
        target.reviewerAdjustment.rationale = String(fallback?.reviewerAdjustment?.rationale || '').trim();
      }
    }
  ],
  challenge_synthesis: [
    {
      key: 'overallConcern',
      priority: 'high',
      getText: (output = {}) => output.overallConcern,
      copyFromFallback(target = {}, fallback = {}) { target.overallConcern = String(fallback.overallConcern || '').trim(); }
    },
    {
      key: 'revisedAleRange',
      priority: 'normal',
      getText: (output = {}) => output.revisedAleRange,
      copyFromFallback(target = {}, fallback = {}) { target.revisedAleRange = String(fallback.revisedAleRange || '').trim(); }
    },
    {
      key: 'keyEvidence',
      priority: 'normal',
      getText: (output = {}) => output.keyEvidence,
      copyFromFallback(target = {}, fallback = {}) { target.keyEvidence = String(fallback.keyEvidence || '').trim(); }
    }
  ],
  consensus_recommendation: [
    {
      key: 'summaryBullets',
      priority: 'high',
      getText: (output = {}) => Array.isArray(output.summaryBullets) ? output.summaryBullets.join(' ') : '',
      copyFromFallback(target = {}, fallback = {}) { target.summaryBullets = Array.isArray(fallback.summaryBullets) ? fallback.summaryBullets.slice() : []; }
    },
    {
      key: 'meetInTheMiddleAleRange',
      priority: 'normal',
      getText: (output = {}) => output.meetInTheMiddleAleRange,
      copyFromFallback(target = {}, fallback = {}) { target.meetInTheMiddleAleRange = String(fallback.meetInTheMiddleAleRange || '').trim(); }
    }
  ],
  review_mediation: [
    {
      key: 'reconciliationSummary',
      priority: 'high',
      getText: (output = {}) => output.reconciliationSummary,
      copyFromFallback(target = {}, fallback = {}) { target.reconciliationSummary = String(fallback.reconciliationSummary || '').trim(); }
    },
    {
      key: 'proposedMiddleGround',
      priority: 'high',
      getText: (output = {}) => output.proposedMiddleGround,
      copyFromFallback(target = {}, fallback = {}) { target.proposedMiddleGround = String(fallback.proposedMiddleGround || '').trim(); }
    },
    {
      key: 'whyReasonable',
      priority: 'normal',
      getText: (output = {}) => output.whyReasonable,
      copyFromFallback(target = {}, fallback = {}) { target.whyReasonable = String(fallback.whyReasonable || '').trim(); }
    },
    {
      key: 'evidenceToVerify',
      priority: 'normal',
      getText: (output = {}) => output.evidenceToVerify,
      copyFromFallback(target = {}, fallback = {}) { target.evidenceToVerify = String(fallback.evidenceToVerify || '').trim(); }
    },
    {
      key: 'continueDiscussionPrompt',
      priority: 'normal',
      getText: (output = {}) => output.continueDiscussionPrompt,
      copyFromFallback(target = {}, fallback = {}) { target.continueDiscussionPrompt = String(fallback.continueDiscussionPrompt || '').trim(); }
    }
  ]
});

function getReviewSections(outputType = '', output = {}) {
  const config = REVIEW_OUTPUT_SECTION_CONFIG[String(outputType || '').trim()] || [];
  return config.map((entry) => ({
    key: entry.key,
    priority: entry.priority || 'normal',
    text: cleanUserFacingText(entry.getText(output) || '', { maxSentences: 4 }),
    copyFromFallback: entry.copyFromFallback
  })).filter((entry) => entry.text);
}

function buildReviewOutputCombinedText(outputType = '', output = {}) {
  return getReviewSections(outputType, output).map((section) => section.text).join(' ').trim();
}

function assessStructuredReviewOutput(outputType = '', output = {}, acceptedContext = {}) {
  const sections = getReviewSections(outputType, output);
  const sectionEvaluations = sections.map((section) => ({
    ...assessReviewSemanticText(section.text, acceptedContext, {
      sectionKey: section.key
    }),
    priority: section.priority
  }));
  const combinedEvaluation = assessReviewSemanticText(buildReviewOutputCombinedText(outputType, output), acceptedContext, {
    sectionKey: '__combined__'
  });
  const blockedFamilies = uniqueStrings([
    combinedEvaluation.blockedFamily,
    ...sectionEvaluations.map((evaluation) => evaluation.blockedFamily)
  ]);
  const blockedCount = sectionEvaluations.filter((evaluation) => evaluation.blocked || evaluation.offLane).length
    + (combinedEvaluation.blocked || combinedEvaluation.offLane ? 1 : 0);
  const weakOverlayOnlyCount = sectionEvaluations.filter((evaluation) => evaluation.weakOverlayOnly).length
    + (combinedEvaluation.weakOverlayOnly ? 1 : 0);
  const dominantOutputFamilies = getOutputDominantFamilies([
    combinedEvaluation,
    ...sectionEvaluations
  ], acceptedContext);
  const reasonCodes = uniqueStrings([
    ...combinedEvaluation.reasonCodes,
    ...sectionEvaluations.flatMap((evaluation) => evaluation.reasonCodes),
    blockedFamilies.length ? 'BLOCKED_DRIFT_FAMILIES' : '',
    dominantOutputFamilies[0]?.alignment === 'off_lane' ? 'DOMINANT_OUTPUT_FAMILY_DRIFT' : '',
    combinedEvaluation.eventPathEvidenceCount === 0 ? 'LOW_EVENT_PATH_ANCHOR_OVERLAP' : '',
    sectionEvaluations.some((evaluation) => evaluation.priority === 'high' && ['off-lane-incoherent', 'consequence-heavy-recoverable'].includes(evaluation.status))
      ? 'PRIORITY_SECTION_DRIFT'
      : ''
  ]);
  const priorityDriftSections = sectionEvaluations
    .filter((evaluation) => evaluation.priority === 'high' && (
      ['off-lane-incoherent', 'consequence-heavy-recoverable'].includes(evaluation.status)
      || (!evaluation.familyAligned && !evaluation.secondaryAligned && !evaluation.secondaryContextAligned && !evaluation.stronglyAligned)
    ))
    .map((evaluation) => evaluation.sectionKey);
  const acceptedEnough = !combinedEvaluation.blocked
    && !combinedEvaluation.offLane
    && blockedCount === 0
    && combinedEvaluation.eventPathEvidenceCount >= 1
    && priorityDriftSections.length === 0
    && dominantOutputFamilies[0]?.alignment !== 'off_lane';
  const correctableSectionKeys = sectionEvaluations
    .filter((evaluation) => ['off-lane-incoherent', 'consequence-heavy-recoverable'].includes(evaluation.status) || priorityDriftSections.includes(evaluation.sectionKey))
    .map((evaluation) => evaluation.sectionKey);
  return {
    sectionEvaluations,
    combinedEvaluation,
    blockedFamilies,
    blockedCount,
    weakOverlayOnlyCount,
    dominantOutputFamilies,
    priorityDriftSections,
    reasonCodes,
    acceptedEnough,
    correctableSectionKeys
  };
}

function buildReviewCoherenceMetadata(mode = 'accepted', acceptedContext = {}, assessment = {}, {
  correctedSections = [],
  sourceMode = 'live'
} = {}) {
  const dominantOutputFamilies = Array.isArray(assessment?.dominantOutputFamilies) ? assessment.dominantOutputFamilies : [];
  const reasonCodes = uniqueStrings(assessment?.reasonCodes || []);
  const sectionEvaluations = Array.isArray(assessment?.sectionEvaluations) ? assessment.sectionEvaluations : [];
  const alignedCount = sectionEvaluations.filter((evaluation) => (
    evaluation?.stronglyAligned
    || evaluation?.familyAligned
    || evaluation?.secondaryAligned
    || evaluation?.allowedSecondaryAligned
    || evaluation?.secondaryContextAligned
  )).length + (assessment?.combinedEvaluation?.stronglyAligned ? 1 : 0);
  const totalCount = sectionEvaluations.length + (assessment?.combinedEvaluation ? 1 : 0);
  const calibratedConfidence = calibrateCoherenceConfidence({
    outputType: 'review',
    mode,
    sourceMode,
    totalCount,
    alignedCount,
    blockedCount: Number(assessment?.blockedCount || 0),
    weakOverlayOnlyCount: Number(assessment?.weakOverlayOnlyCount || 0),
    dominantFamilyAligned: !dominantOutputFamilies.length || dominantOutputFamilies[0]?.alignment !== 'off_lane',
    lowAnchorOverlap: reasonCodes.includes('LOW_EVENT_PATH_ANCHOR_OVERLAP') || Number(assessment?.combinedEvaluation?.eventPathEvidenceCount || 0) === 0,
    correctedSectionCount: correctedSections.length,
    reasonCodes,
    usedFallback: sourceMode !== 'live',
    strongAlignment: Boolean(assessment?.acceptedEnough || assessment?.combinedEvaluation?.stronglyAligned)
  });
  return {
    mode,
    acceptedPrimaryFamilyKey: String(acceptedContext?.acceptedPrimaryKey || '').trim(),
    acceptedSecondaryFamilyKeys: Array.isArray(acceptedContext?.acceptedSecondaryFamilyKeys)
      ? acceptedContext.acceptedSecondaryFamilyKeys.slice()
      : [],
    dominantOutputFamilies,
    blockedFamilies: Array.isArray(assessment?.blockedFamilies) ? assessment.blockedFamilies.slice() : [],
    reasonCodes,
    correctedSections: uniqueStrings(correctedSections),
    taxonomyVersion: String(acceptedContext?.taxonomyVersion || SCENARIO_TAXONOMY.taxonomyVersion || '').trim(),
    confidenceScore: calibratedConfidence.confidenceScore,
    confidenceBand: calibratedConfidence.confidenceBand,
    confidenceDrivers: calibratedConfidence.confidenceDrivers,
    calibrationMode: calibratedConfidence.calibrationMode
  };
}

function buildAssessmentChallengeStub(input = {}) {
  const confidence = input.confidence || {};
  const assumptions = Array.isArray(input.assumptions) ? input.assumptions : [];
  const drivers = input.drivers || { upward: [], stabilisers: [] };
  const weakestAssumptions = assumptions.slice(0, 3).map((item) => `${item.category}: ${item.text}`);
  const committeeQuestions = [];
  if (drivers.upward?.[0]) committeeQuestions.push(`What evidence supports the conclusion that ${drivers.upward[0].charAt(0).toLowerCase()}${drivers.upward[0].slice(1)}`);
  if (confidence.label === 'Low confidence') committeeQuestions.push('Which ranges are still too uncertain for strong decision-making and why are they still broad?');
  if ((input.missingInformation || []).length) committeeQuestions.push(`What missing evidence would change the assessment most: ${(input.missingInformation || []).slice(0, 2).join(' and ')}?`);
  if (!committeeQuestions.length) committeeQuestions.push('Which one or two assumptions would most change the tolerance position if they proved wrong?');
  const evidenceToGather = [];
  if ((input.missingInformation || []).length) evidenceToGather.push(...input.missingInformation.slice(0, 3));
  if (!evidenceToGather.length) {
    evidenceToGather.push('Internal incident history or loss data for similar scenarios.');
    evidenceToGather.push('Control evidence showing how consistently the key controls operate in practice.');
    evidenceToGather.push('Finance or operational data to validate the biggest cost assumptions.');
  }
  const challengeLevel = confidence.label === 'Low confidence' ? 'High challenge needed' : confidence.label === 'High confidence' ? 'Moderate challenge still warranted' : 'Targeted challenge recommended';
  return {
    summary: confidence.label === 'Low confidence'
      ? 'The assessment is directionally useful, but a risk committee should challenge the broadest assumptions before relying on it for strong decisions.'
      : 'The assessment is decision-useful, but a risk committee should still test the assumptions that are driving the result most.',
    challengeLevel,
    weakestAssumptions,
    committeeQuestions,
    evidenceToGather,
    reviewerGuidance: [
      'Focus first on the assumptions most likely to move the tolerance position.',
      'Challenge whether the cost and frequency assumptions are supported by internal evidence rather than only judgement.',
      'Confirm that the selected regulatory and business scope still matches the scenario being discussed.'
    ]
  };
}

function buildParameterChallengeStub(input = {}) {
  const parameterLabel = String(input?.parameterLabel || 'parameter').trim();
  const currentValueLabel = String(input?.currentValueLabel || input?.currentValue || '').trim();
  const concern = String(input?.reviewerConcern || '').trim();
  const concernLower = concern.toLowerCase();
  const parameterKey = String(input?.parameterKey || '').trim();
  const numericValue = Number(input?.currentValue);
  const adjustmentDirection = /too low|understat|optimistic|higher|increase|more severe|too weak|not enough/i.test(concernLower)
    ? 'up'
    : /too high|overstat|conservative|lower|decrease|too strong/i.test(concernLower)
      ? 'down'
      : (parameterKey === 'controlStrLikely' ? 'down' : 'up');
  const questions = [
    `What direct evidence supports keeping ${parameterLabel} at ${currentValueLabel || 'the current value'}?`,
    `Which internal record, test result, or source would satisfy the reviewer if you defend this ${parameterLabel.toLowerCase()} estimate?`,
    parameterKey === 'lmLow' || parameterKey === 'lmHigh'
      ? 'Which loss component is doing most of the work in this range, and do you have finance or operations evidence for it?'
      : parameterKey === 'controlStrLikely'
        ? 'What control test, operating evidence, or recent incident data shows the current control strength is realistic?'
        : 'What evidence would make you revise this estimate instead of defending it?'
  ].filter(Boolean).slice(0, 3);
  let suggestedValue = Number.isFinite(numericValue) ? numericValue : 0;
  if (Number.isFinite(numericValue)) {
    if (parameterKey === 'controlStrLikely') {
      suggestedValue = adjustmentDirection === 'up'
        ? Math.min(0.99, numericValue + 0.08)
        : Math.max(0.01, numericValue - 0.08);
    } else if (parameterKey === 'vulnerability') {
      suggestedValue = adjustmentDirection === 'up'
        ? Math.min(0.99, numericValue + 0.08)
        : Math.max(0.01, numericValue - 0.08);
    } else {
      const factor = adjustmentDirection === 'up' ? 1.12 : 0.9;
      suggestedValue = numericValue * factor;
    }
  }
  return {
    analystQuestions: questions,
    reviewerAdjustment: {
      param: parameterKey || parameterLabel,
      suggestedValue: Number.isFinite(suggestedValue) ? Number(suggestedValue.toFixed(parameterKey === 'lmLow' || parameterKey === 'lmHigh' ? 0 : 2)) : numericValue,
      aleImpact: adjustmentDirection === 'up'
        ? 'ALE would likely move upward unless the analyst can narrow the evidence base and defend the current estimate.'
        : 'ALE would likely move downward if the reviewer concern is accepted without new evidence.',
      rationale: concern
        ? `This is the smallest directional adjustment that reflects the reviewer concern: ${concern}`
        : `This is the smallest directional adjustment that reflects a cautious reviewer challenge to ${parameterLabel.toLowerCase()}.`
    }
  };
}

function buildChallengeSynthesisStub(input = {}) {
  const records = Array.isArray(input?.records) ? input.records : [];
  return {
    overallConcern: records.length
      ? `Reviewers are consistently challenging ${String(records[0]?.parameter || 'the current assumptions').toLowerCase()} and the overall severity looks more exposed than the base case suggests.`
      : 'Reviewers are questioning whether the current estimate is too optimistic overall.',
    revisedAleRange: String(input?.baseAleRange || '').trim()
      ? `A prudent committee view would treat the outcome as materially higher than the current ${String(input.baseAleRange).trim()} planning range until the challenged assumptions are defended.`
      : 'A prudent committee view would treat the annual loss range as materially higher until the challenged assumptions are defended.',
    keyEvidence: 'The single best way to resolve most of these challenges is to produce one current evidence pack that proves the disputed control performance and loss-range assumptions together.'
  };
}

function buildConsensusRecommendationStub(input = {}) {
  const challenges = Array.isArray(input?.challenges) ? input.challenges : [];
  const acceptable = challenges
    .filter((item) => Math.abs(Number(item?.impactPct || 0)) <= 15)
    .map((item) => String(item?.ref || '').trim())
    .filter(Boolean);
  const defend = challenges
    .filter((item) => !acceptable.includes(String(item?.ref || '').trim()))
    .map((item) => String(item?.ref || '').trim())
    .filter(Boolean);
  const meetInMiddleAleRange = String(input?.projectedAleRange || input?.adjustedAleRange || input?.originalAleRange || '').trim()
    || 'Use the projected consensus path as the working annual loss range until new evidence closes the challenge.';
  return {
    summaryBullets: [
      challenges.length
        ? 'Accept the smaller committee adjustments first, then defend the changes that would materially reshape the current result without new evidence.'
        : 'Accept the smallest defensible reviewer adjustments first, then defend the assumptions that would materially change the outcome.',
      defend.length
        ? `Defend ${defend.join(', ')} unless the reviewer can show stronger evidence, because those changes would move the outcome materially beyond the current management read.`
        : 'Defend any remaining large-impact changes until stronger evidence shows the base case is too optimistic.',
      `A workable middle ground is ${meetInMiddleAleRange}.`
    ],
    acceptChallenges: acceptable,
    defendChallenges: defend,
    meetInTheMiddleAleRange: meetInMiddleAleRange
  };
}

function buildReviewerDecisionBriefStub(input = {}) {
  const assessmentData = cleanUserFacingText(String(input?.assessmentData || '').trim(), { maxSentences: 4 });
  const sentences = assessmentData
    ? assessmentData.split(/(?<=[.!?])\s+/).map((item) => cleanUserFacingText(item, { maxSentences: 1 })).filter(Boolean)
    : [];
  return {
    whatMatters: sentences[0] || 'The assessment still needs a concise headline risk statement before review.',
    whatsUncertain: sentences[1] || 'The weakest assumption still needs clearer evidence before approval.',
    whatToDo: 'Use the technical detail view to challenge the weakest assumption before approving the current position.'
  };
}

function buildExecutiveChallengeStub(input = {}) {
  const assumptions = Array.isArray(input?.assessmentIntelligence?.assumptions)
    ? input.assessmentIntelligence.assumptions
    : [];
  const firstAssumption = assumptions[0]?.text || assumptions[0] || '';
  const p90 = Number(input?.results?.eventLoss?.p90 || 0);
  const weakestAssumption = cleanUserFacingText(firstAssumption || 'Recovery timing and control-performance assumptions still need direct evidence.', { maxSentences: 1 })
    || 'Recovery timing and control-performance assumptions still need direct evidence.';
  return {
    challengeSummary: p90 > 0
      ? `The assessment may be directionally useful, but the committee should challenge the assumptions carrying the ${p90.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} bad-year view before relying on it.`
      : 'The assessment may be directionally useful, but the committee should challenge the assumptions carrying the severe-loss view before relying on it.',
    weakestAssumption,
    alternativeView: 'A more conservative committee view would assume slower recovery or weaker control performance until direct evidence narrows the range.',
    confidenceVerdict: 'Likely understated',
    oneQuestion: cleanUserFacingText(
      input?.obligationBasis
        ? 'Which direct evidence proves the current control and recovery assumptions still meet the obligations in scope?'
        : 'Which direct evidence proves the current control and recovery assumptions are realistic enough for committee use?',
      { maxSentences: 1 }
    ) || 'Which direct evidence proves the current control and recovery assumptions are realistic enough for committee use?'
  };
}

function buildAcceptedPathReference(context = {}) {
  const lane = describeAcceptedLane(context).toLowerCase();
  const path = describeAcceptedScenarioPath(context);
  if (lane && path) return `the accepted ${lane} path: ${path}`;
  if (lane) return `the accepted ${lane} path`;
  if (path) return path;
  return 'the accepted scenario path';
}

function buildAcceptedSecondarySummary(context = {}) {
  const secondaryLabels = (Array.isArray(context?.acceptedSecondaryFamilyKeys) ? context.acceptedSecondaryFamilyKeys : [])
    .map((key) => SCENARIO_TAXONOMY_FAMILY_BY_KEY[String(key || '').trim()]?.label)
    .filter(Boolean);
  return secondaryLabels.length ? joinList(secondaryLabels).toLowerCase() : '';
}

function buildAcceptedMechanismSummary(context = {}) {
  const labels = (Array.isArray(context?.acceptedMechanismKeys) ? context.acceptedMechanismKeys : [])
    .map((key) => SCENARIO_TAXONOMY_MECHANISM_BY_KEY[String(key || '').trim()]?.label)
    .filter(Boolean);
  return labels.length ? joinList(labels).toLowerCase() : '';
}

function buildCoherentReviewerDecisionBriefFallback(input = {}, context = {}) {
  const stub = buildReviewerDecisionBriefStub(input);
  if (!context?.acceptedPrimaryKey) return stub;
  const primaryLabel = describeAcceptedLane(context).toLowerCase();
  const acceptedPath = buildAcceptedPathReference(context);
  return {
    whatMatters: cleanUserFacingText(`Keep the review anchored to ${acceptedPath}.`, { maxSentences: 1 }) || stub.whatMatters,
    whatsUncertain: cleanUserFacingText(`The main uncertainty is whether the evidence changes the severity or accepted escalation within that ${primaryLabel} path, not whether this is a different primary scenario.`, { maxSentences: 1 }) || stub.whatsUncertain,
    whatToDo: cleanUserFacingText(`Challenge the weakest assumptions in the ${primaryLabel} path and keep downstream consequences in supporting context only.`, { maxSentences: 1 }) || stub.whatToDo
  };
}

function buildCoherentExecutiveChallengeFallback(input = {}, context = {}) {
  const stub = buildExecutiveChallengeStub(input);
  if (!context?.acceptedPrimaryKey) return stub;
  const acceptedPath = buildAcceptedPathReference(context);
  const secondarySummary = buildAcceptedSecondarySummary(context);
  return {
    challengeSummary: cleanUserFacingText(`The committee should challenge the current estimate against ${acceptedPath}, not against a different downstream issue.`, { maxSentences: 2 }) || stub.challengeSummary,
    weakestAssumption: cleanUserFacingText(`The weakest assumption is whether the current evidence really supports ${acceptedPath}.`, { maxSentences: 1 }) || stub.weakestAssumption,
    alternativeView: cleanUserFacingText(secondarySummary
      ? `A more conservative view would keep the same primary path while testing whether ${secondarySummary} should remain only supported escalation rather than a different primary family.`
      : `A more conservative view would keep the same primary path while testing whether severity or mechanisms are understated.`, { maxSentences: 2 }) || stub.alternativeView,
    confidenceVerdict: stub.confidenceVerdict,
    oneQuestion: cleanUserFacingText(`What direct evidence best proves ${acceptedPath}?`, { maxSentences: 1 }) || stub.oneQuestion
  };
}

function buildCoherentAssessmentChallengeFallback(input = {}, context = {}) {
  const stub = buildAssessmentChallengeStub(input);
  if (!context?.acceptedPrimaryKey) return stub;
  const acceptedPath = buildAcceptedPathReference(context);
  const mechanismSummary = buildAcceptedMechanismSummary(context);
  return {
    summary: cleanUserFacingText(`The review should challenge the evidence for ${acceptedPath} without reframing the scenario into a different primary lane.`, { maxSentences: 2 }) || stub.summary,
    challengeLevel: stub.challengeLevel,
    weakestAssumptions: uniqueStrings([
      cleanUserFacingText(`Whether the evidence really supports ${acceptedPath}.`, { maxSentences: 1 }),
      mechanismSummary
        ? cleanUserFacingText(`Whether ${mechanismSummary} is being treated as the right supporting mechanism rather than a different scenario.`, { maxSentences: 1 })
        : ''
    ]).slice(0, 3).concat(stub.weakestAssumptions || []).slice(0, 3),
    committeeQuestions: uniqueStrings([
      cleanUserFacingText(`Which evidence most directly proves ${acceptedPath}?`, { maxSentences: 1 }),
      cleanUserFacingText('What evidence would change the primary scenario family rather than only its severity or accepted escalation?', { maxSentences: 1 })
    ]).concat(stub.committeeQuestions || []).slice(0, 4),
    evidenceToGather: uniqueStrings([
      cleanUserFacingText(`Current evidence that directly supports ${acceptedPath}.`, { maxSentences: 1 })
    ]).concat(stub.evidenceToGather || []).slice(0, 4),
    reviewerGuidance: uniqueStrings([
      cleanUserFacingText(`Keep the challenge anchored to ${acceptedPath}.`, { maxSentences: 1 }),
      'Do not let downstream scrutiny, liability, loss, or reputation effects redefine the primary scenario.'
    ]).concat(Array.isArray(stub.reviewerGuidance) ? stub.reviewerGuidance : []).slice(0, 4)
  };
}

function buildCoherentParameterChallengeFallback(input = {}, context = {}) {
  const stub = buildParameterChallengeStub(input);
  if (!context?.acceptedPrimaryKey) return stub;
  const acceptedPath = buildAcceptedPathReference(context);
  return {
    analystQuestions: uniqueStrings([
      cleanUserFacingText(`What direct evidence supports the challenged parameter for ${acceptedPath}?`, { maxSentences: 1 }),
      cleanUserFacingText('What evidence would change the accepted scenario path rather than only the severity estimate?', { maxSentences: 1 }),
      ...(Array.isArray(stub.analystQuestions) ? stub.analystQuestions : [])
    ]).slice(0, 3),
    reviewerAdjustment: {
      ...(stub.reviewerAdjustment || {}),
      aleImpact: cleanUserFacingText(`Assess the ALE impact against ${acceptedPath}, not against a different scenario family.`, { maxSentences: 1 }) || stub?.reviewerAdjustment?.aleImpact,
      rationale: cleanUserFacingText(`This challenge stays anchored to ${acceptedPath} while testing the disputed parameter.`, { maxSentences: 2 }) || stub?.reviewerAdjustment?.rationale
    }
  };
}

function buildCoherentChallengeSynthesisFallback(input = {}, context = {}) {
  const stub = buildChallengeSynthesisStub(input);
  if (!context?.acceptedPrimaryKey) return stub;
  const acceptedPath = buildAcceptedPathReference(context);
  return {
    overallConcern: cleanUserFacingText(`Reviewer challenges still concern ${acceptedPath} and should not be synthesised into a different primary scenario.`, { maxSentences: 1 }) || stub.overallConcern,
    revisedAleRange: cleanUserFacingText(`Any revised range should stay tied to ${acceptedPath} while testing severity and accepted escalation.`, { maxSentences: 1 }) || stub.revisedAleRange,
    keyEvidence: cleanUserFacingText(`The best evidence is whatever most directly proves or weakens ${acceptedPath}.`, { maxSentences: 1 }) || stub.keyEvidence
  };
}

function buildCoherentConsensusRecommendationFallback(input = {}, context = {}) {
  const stub = buildConsensusRecommendationStub(input);
  if (!context?.acceptedPrimaryKey) return stub;
  const acceptedPath = buildAcceptedPathReference(context);
  const middleRange = String(stub.meetInTheMiddleAleRange || input?.projectedAleRange || '').trim() || 'the projected consensus range';
  return {
    summaryBullets: [
      cleanUserFacingText(`Keep the consensus anchored to ${acceptedPath}.`, { maxSentences: 1 }),
      cleanUserFacingText('Accept only the reviewer points that improve the accepted scenario view without redefining the primary family.', { maxSentences: 1 }),
      cleanUserFacingText(`Use ${middleRange} only as the working range for that accepted scenario path.`, { maxSentences: 1 })
    ].filter(Boolean),
    acceptChallenges: Array.isArray(stub.acceptChallenges) ? stub.acceptChallenges.slice() : [],
    defendChallenges: Array.isArray(stub.defendChallenges) ? stub.defendChallenges.slice() : [],
    meetInTheMiddleAleRange: middleRange
  };
}

function buildCoherentReviewMediationFallback(input = {}, context = {}) {
  const acceptedPath = buildAcceptedPathReference(context);
  const disputedFocus = cleanUserFacingText(String(input?.disputedFocus || 'the disputed assumption').trim(), {
    maxSentences: 1,
    stripTrailingPeriod: true
  }) || 'the disputed assumption';
  return {
    reconciliationSummary: cleanUserFacingText(`Both sides should resolve ${disputedFocus.toLowerCase()} within ${acceptedPath} rather than reframing the scenario into a different lane.`, { maxSentences: 2 }),
    proposedMiddleGround: cleanUserFacingText(`Use a middle-ground position that stays anchored to ${acceptedPath}.`, { maxSentences: 1 }),
    whyReasonable: cleanUserFacingText('It tests the disputed assumption without changing the accepted primary family or promoting downstream consequences into a new scenario.', { maxSentences: 2 }),
    recommendedField: '',
    recommendedValue: null,
    recommendedValueLabel: '',
    evidenceToVerify: cleanUserFacingText(`Verify the evidence that most directly proves ${acceptedPath}.`, { maxSentences: 1 }),
    continueDiscussionPrompt: cleanUserFacingText(`Ask which one fact would change ${acceptedPath}, rather than only its consequences.`, { maxSentences: 1 })
  };
}

function buildCoherentReviewFallback(outputType = '', input = {}, context = {}) {
  switch (String(outputType || '').trim()) {
    case 'reviewer_brief':
      return buildCoherentReviewerDecisionBriefFallback(input, context);
    case 'challenge_assessment_executive':
      return buildCoherentExecutiveChallengeFallback(input, context);
    case 'challenge_assessment_review':
      return buildCoherentAssessmentChallengeFallback(input, context);
    case 'parameter_challenge':
      return buildCoherentParameterChallengeFallback(input, context);
    case 'challenge_synthesis':
      return buildCoherentChallengeSynthesisFallback(input, context);
    case 'consensus_recommendation':
      return buildCoherentConsensusRecommendationFallback(input, context);
    case 'review_mediation':
      return buildCoherentReviewMediationFallback(input, context);
    default:
      return {};
  }
}

function applyReviewOutputCorrections(outputType = '', output = {}, fallbackOutput = {}, correctedSectionKeys = []) {
  const corrected = JSON.parse(JSON.stringify(output || {}));
  const sectionKeySet = new Set(uniqueStrings(correctedSectionKeys));
  const config = REVIEW_OUTPUT_SECTION_CONFIG[String(outputType || '').trim()] || [];
  config.forEach((entry) => {
    if (!sectionKeySet.has(entry.key)) return;
    entry.copyFromFallback(corrected, fallbackOutput);
  });
  return corrected;
}

function enforceReviewOutputCoherence(outputType = '', output = {}, {
  input = {},
  sourceMode = 'live'
} = {}) {
  const acceptedContext = buildAcceptedScenarioContext(input);
  const fallbackOutput = buildCoherentReviewFallback(outputType, input, acceptedContext);

  if (sourceMode === 'manual') {
    return {
      output: {
        ...output,
        reviewerCoherence: buildReviewCoherenceMetadata('manual', acceptedContext, {
          dominantOutputFamilies: [],
          blockedFamilies: [],
          reasonCodes: ['MANUAL_MODE']
        }, {
          sourceMode
        })
      },
      coherenceMode: 'manual'
    };
  }

  if (!acceptedContext.acceptedPrimaryKey) {
    return {
      output: {
        ...output,
        reviewerCoherence: buildReviewCoherenceMetadata('accepted', acceptedContext, {
          dominantOutputFamilies: [],
          blockedFamilies: [],
          reasonCodes: ['NO_ACCEPTED_SCENARIO_CONTEXT']
        }, {
          sourceMode
        })
      },
      coherenceMode: 'accepted'
    };
  }

  const candidateAssessment = assessStructuredReviewOutput(outputType, output, acceptedContext);
  if (candidateAssessment.acceptedEnough) {
    return {
      output: {
        ...output,
        reviewerCoherence: buildReviewCoherenceMetadata('accepted', acceptedContext, candidateAssessment, {
          sourceMode
        })
      },
      coherenceMode: 'accepted'
    };
  }

  const sectionKeys = getReviewSections(outputType, output).map((section) => section.key);
  const severeSectionCount = candidateAssessment.sectionEvaluations
    .filter((evaluation) => evaluation.blocked || evaluation.offLane).length;
  const strongSectionCount = candidateAssessment.sectionEvaluations
    .filter((evaluation) => evaluation.stronglyAligned).length;
  const shouldReplaceWholeOutput = candidateAssessment.correctableSectionKeys.length >= Math.max(1, sectionKeys.length)
    || (candidateAssessment.combinedEvaluation.eventPathEvidenceCount === 0 && strongSectionCount === 0)
    || (candidateAssessment.dominantOutputFamilies[0]?.alignment === 'off_lane' && severeSectionCount >= Math.max(1, sectionKeys.length - 1))
    || (candidateAssessment.combinedEvaluation.blocked && severeSectionCount >= 2)
    || (candidateAssessment.combinedEvaluation.offLane && severeSectionCount >= 2);

  if (!shouldReplaceWholeOutput && candidateAssessment.correctableSectionKeys.length) {
    const correctedOutput = applyReviewOutputCorrections(outputType, output, fallbackOutput, candidateAssessment.correctableSectionKeys);
    const correctedAssessment = assessStructuredReviewOutput(outputType, correctedOutput, acceptedContext);
    if (correctedAssessment.acceptedEnough) {
      return {
        output: {
          ...correctedOutput,
          reviewerCoherence: buildReviewCoherenceMetadata('corrected', acceptedContext, {
            ...correctedAssessment,
            reasonCodes: uniqueStrings([...candidateAssessment.reasonCodes, 'SERVER_SECTION_CORRECTION'])
          }, {
            correctedSections: candidateAssessment.correctableSectionKeys,
            sourceMode
          })
        },
        coherenceMode: 'corrected'
      };
    }
  }

  const fallbackAssessment = assessStructuredReviewOutput(outputType, fallbackOutput, acceptedContext);
  return {
    output: {
      ...fallbackOutput,
      reviewerCoherence: buildReviewCoherenceMetadata('fallback_replaced', acceptedContext, {
        ...fallbackAssessment,
        reasonCodes: uniqueStrings([...candidateAssessment.reasonCodes, 'DETERMINISTIC_COHERENCE_REPLACEMENT'])
      }, {
        correctedSections: sectionKeys,
        sourceMode
      })
    },
      coherenceMode: 'fallback_replaced'
  };
}

function finaliseReviewWorkflowOutput(result = {}, {
  outputType = '',
  input = {}
} = {}) {
  const sourceMode = String(result?.mode || 'live').trim() || 'live';
  const enforced = enforceReviewOutputCoherence(outputType, result, {
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
      fallbackReasonCode: `${String(outputType || 'review_output').trim()}_coherence_fallback_replaced`,
      fallbackReasonTitle: 'Deterministic fallback review output loaded',
      fallbackReasonMessage: 'The generated review output drifted away from the accepted scenario, so the server replaced it with a deterministic scenario-aligned version.'
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

function normaliseReviewerBrief(parsed = {}) {
  return {
    whatMatters: cleanUserFacingText(parsed.whatMatters || '', { maxSentences: 1 }),
    whatsUncertain: cleanUserFacingText(parsed.whatsUncertain || '', { maxSentences: 1 }),
    whatToDo: cleanUserFacingText(parsed.whatToDo || '', { maxSentences: 1 })
  };
}

function normaliseExecutiveChallenge(parsed = {}) {
  const allowedVerdict = new Set(['Reasonable given evidence', 'Likely overstated', 'Likely understated']);
  const verdict = cleanUserFacingText(parsed.confidenceVerdict || '', { maxSentences: 1 });
  return {
    challengeSummary: cleanUserFacingText(parsed.challengeSummary || '', { maxSentences: 3 }),
    weakestAssumption: cleanUserFacingText(parsed.weakestAssumption || '', { maxSentences: 1 }),
    alternativeView: cleanUserFacingText(parsed.alternativeView || '', { maxSentences: 2 }),
    confidenceVerdict: allowedVerdict.has(verdict) ? verdict : '',
    oneQuestion: cleanUserFacingText(parsed.oneQuestion || '', { maxSentences: 1 })
  };
}

function normaliseReviewChallenge(parsed = {}, stub = {}) {
  return {
    summary: cleanUserFacingText(parsed.summary || stub.summary || '', { maxSentences: 3 }),
    challengeLevel: cleanUserFacingText(parsed.challengeLevel || stub.challengeLevel || '', { maxSentences: 1 }),
    weakestAssumptions: (Array.isArray(parsed.weakestAssumptions) ? parsed.weakestAssumptions : stub.weakestAssumptions).slice(0, 4).map((item) => cleanUserFacingText(item || '', { maxSentences: 1 })).filter(Boolean),
    committeeQuestions: (Array.isArray(parsed.committeeQuestions) ? parsed.committeeQuestions : stub.committeeQuestions).slice(0, 4).map((item) => cleanUserFacingText(item || '', { maxSentences: 1 })).filter(Boolean),
    evidenceToGather: (Array.isArray(parsed.evidenceToGather) ? parsed.evidenceToGather : stub.evidenceToGather).slice(0, 4).map((item) => cleanUserFacingText(item || '', { maxSentences: 1 })).filter(Boolean),
    reviewerGuidance: normaliseGuidance(Array.isArray(parsed.reviewerGuidance) && parsed.reviewerGuidance.length ? parsed.reviewerGuidance : stub.reviewerGuidance)
  };
}

function normaliseParameterChallengeRecord(parsed = {}, stub = {}, allowedParams = []) {
  const analystQuestions = (Array.isArray(parsed?.analystQuestions) ? parsed.analystQuestions : stub.analystQuestions)
    .map((item) => cleanUserFacingText(item || '', { maxSentences: 1 }))
    .filter(Boolean)
    .slice(0, 3);
  const adjustment = parsed?.reviewerAdjustment && typeof parsed.reviewerAdjustment === 'object'
    ? parsed.reviewerAdjustment
    : stub.reviewerAdjustment;
  const param = String(adjustment?.param || stub.reviewerAdjustment.param || '').trim();
  return {
    analystQuestions: analystQuestions.length ? analystQuestions : stub.analystQuestions,
    reviewerAdjustment: {
      param: allowedParams.length && allowedParams.includes(param) ? param : (stub.reviewerAdjustment.param || param),
      suggestedValue: Number.isFinite(Number(adjustment?.suggestedValue))
        ? Number(adjustment.suggestedValue)
        : stub.reviewerAdjustment.suggestedValue,
      aleImpact: cleanUserFacingText(adjustment?.aleImpact || stub.reviewerAdjustment.aleImpact || '', { maxSentences: 1 }) || stub.reviewerAdjustment.aleImpact,
      rationale: cleanUserFacingText(adjustment?.rationale || stub.reviewerAdjustment.rationale || '', { maxSentences: 2 }) || stub.reviewerAdjustment.rationale
    }
  };
}

function normaliseChallengeSynthesis(parsed = {}, stub = {}) {
  return {
    overallConcern: cleanUserFacingText(parsed?.overallConcern || '', { maxSentences: 1 }) || stub.overallConcern,
    revisedAleRange: cleanUserFacingText(parsed?.revisedAleRange || '', { maxSentences: 1 }) || stub.revisedAleRange,
    keyEvidence: cleanUserFacingText(parsed?.keyEvidence || '', { maxSentences: 1 }) || stub.keyEvidence
  };
}

function normaliseConsensusRecommendation(parsed = {}, stub = {}, allowedRefs = []) {
  const cleanRefs = (values) => (Array.isArray(values) ? values : [])
    .map((item) => String(item || '').trim())
    .filter((item) => allowedRefs.includes(item));
  const acceptChallenges = cleanRefs(parsed?.acceptChallenges);
  const defendChallenges = cleanRefs(parsed?.defendChallenges).filter((item) => !acceptChallenges.includes(item));
  const summaryBullets = (Array.isArray(parsed?.summaryBullets) ? parsed.summaryBullets : stub.summaryBullets)
    .map((item) => cleanUserFacingText(item || '', { maxSentences: 1 }))
    .filter(Boolean)
    .slice(0, 3);
  return {
    summaryBullets: summaryBullets.length ? summaryBullets : stub.summaryBullets,
    acceptChallenges: acceptChallenges.length ? acceptChallenges : stub.acceptChallenges,
    defendChallenges: defendChallenges.length ? defendChallenges : stub.defendChallenges,
    meetInTheMiddleAleRange: cleanUserFacingText(parsed?.meetInTheMiddleAleRange || '', { maxSentences: 1 }) || stub.meetInTheMiddleAleRange
  };
}

function normaliseMediation(parsed = {}) {
  const allowedFieldPattern = /^(tef|threatCap|controlStr|vuln|ir|bi|db|rl|tp|rc)(Min|Likely|Max)$/;
  const rawValue = parsed?.recommendedValue;
  const recommendedValue = rawValue == null || rawValue === '' ? null : Number(rawValue);
  return {
    reconciliationSummary: cleanUserFacingText(parsed?.reconciliationSummary || '', { maxSentences: 3 }),
    proposedMiddleGround: cleanUserFacingText(parsed?.proposedMiddleGround || '', { maxSentences: 2 }),
    whyReasonable: cleanUserFacingText(parsed?.whyReasonable || '', { maxSentences: 2 }),
    recommendedField: allowedFieldPattern.test(String(parsed?.recommendedField || '').trim())
      ? String(parsed.recommendedField || '').trim()
      : '',
    recommendedValue: Number.isFinite(recommendedValue) ? recommendedValue : null,
    recommendedValueLabel: cleanUserFacingText(parsed?.recommendedValueLabel || '', { maxSentences: 1 }),
    evidenceToVerify: cleanUserFacingText(parsed?.evidenceToVerify || '', { maxSentences: 1 }),
    continueDiscussionPrompt: cleanUserFacingText(parsed?.continueDiscussionPrompt || '', { maxSentences: 1 })
  };
}

function hasExecutiveChallengeShape(input = {}) {
  if (!input || typeof input !== 'object') return false;
  const hasMeaningfulObject = (value) => !!(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
  return hasMeaningfulObject(input.results)
    || hasMeaningfulObject(input.fairParams)
    || hasMeaningfulObject(input.assessmentIntelligence);
}

function hasMeaningfulReviewerBriefInput(assessmentData = '') {
  const text = cleanUserFacingText(String(assessmentData || '').trim(), { maxSentences: 4 });
  const tokens = (text.match(/[a-z0-9]{2,}/gi) || []).length;
  return !!text && (text.length >= 24 || tokens >= 5);
}

function hasMeaningfulParameterChallengeInput(input = {}) {
  const parameterIdentity = String(input?.parameterLabel || input?.parameterKey || '').trim();
  const reviewerConcern = cleanUserFacingText(String(input?.reviewerConcern || '').trim(), { maxSentences: 2 });
  const scenarioSummary = cleanUserFacingText(String(input?.scenarioSummary || '').trim(), { maxSentences: 2 });
  const currentAle = cleanUserFacingText(String(input?.currentAle || '').trim(), { maxSentences: 1 });
  return !!parameterIdentity && !!reviewerConcern && !!(scenarioSummary || currentAle);
}

async function buildReviewerDecisionBriefWorkflow(input = {}) {
  input = normaliseReviewerDecisionBriefInput(input);
  const config = getCompassProviderConfig();
  const traceLabel = sanitizeAiText(input.traceLabel || 'Reviewer decision brief', { maxChars: 120 }) || 'Reviewer decision brief';
  const assessmentData = String(input?.assessmentData || '').trim().slice(0, 2400);
  const stub = buildReviewerDecisionBriefStub(input);
  if (!hasMeaningfulReviewerBriefInput(assessmentData)) {
    return finaliseReviewWorkflowOutput({
      mode: 'manual',
      ...stub,
      usedFallback: false,
      aiUnavailable: false,
      manualReasonCode: 'incomplete_assessment_data',
      manualReasonTitle: 'Manual reviewer brief only',
      manualReasonMessage: 'The server needs a fuller assessment summary before it can generate a reviewer brief.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server manual mode used for reviewer brief because assessment data was too short or incomplete.',
        response: 'The reviewer brief stayed in manual mode because the assessment summary was incomplete.'
      })
    }, {
      outputType: 'reviewer_brief',
      input
    });
  }
  if (!config.proxyConfigured) {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'proxy_missing_secret',
      fallbackReasonTitle: 'Deterministic fallback reviewer brief loaded',
      fallbackReasonMessage: 'The hosted AI proxy is not configured, so the server used a deterministic reviewer brief instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used for reviewer brief.',
        response: `${stub.whatMatters} ${stub.whatsUncertain} ${stub.whatToDo}`
      })
    }, {
      outputType: 'reviewer_brief',
      input
    });
  }
  const preferredSection = String(input?.preferredSection || '').trim().toLowerCase();
  const preferredPrompt = preferredSection
    ? `The reviewer usually spends the most time on the ${preferredSection.replace(/-/g, ' ')} section, so make that section especially concrete and decision-useful.`
    : '';
  const schema = `{
  "whatMatters": "string",
  "whatsUncertain": "string",
  "whatToDo": "string"
}`;
  const systemPrompt = `You are a risk reviewer at a large technology company. You have 30 seconds to decide whether to approve, challenge, or escalate this assessment. Generate a structured brief with exactly three sections:
WHAT MATTERS: [1 sentence - the headline risk and magnitude]
WHAT'S UNCERTAIN: [1 sentence - the weakest assumption]
WHAT TO DO: [1 sentence - approve / challenge parameter X / escalate]

Return JSON only with this schema:
${schema}`;
  const userPrompt = `${preferredPrompt ? `${preferredPrompt}\n\n` : ''}Assessment data:\n${assessmentData}`;
  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'generateReviewerDecisionBrief',
      maxCompletionTokens: 220,
      timeoutMs: 12000
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
      taskName: 'repairReviewerDecisionBrief'
    });
    return finaliseReviewWorkflowOutput({
      mode: 'live',
      ...normaliseReviewerBrief(parsed?.parsed || {}),
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: generation.text
      })
    }, {
      outputType: 'reviewer_brief',
      input
    });
  } catch (error) {
    const normalisedError = normaliseAiError(error);
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'reviewer_brief_runtime_error',
      fallbackReasonTitle: 'Deterministic fallback reviewer brief loaded',
      fallbackReasonMessage: 'The reviewer-brief step failed at runtime, so the server used a deterministic reviewer brief instead.',
      fallbackReasonDetail: sanitizeAiText(normalisedError?.message || '', { maxChars: 220 }),
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used after reviewer brief generation failed.',
        response: `${stub.whatMatters} ${stub.whatsUncertain} ${stub.whatToDo}`
      })
    }, {
      outputType: 'reviewer_brief',
      input
    });
  }
}

async function buildChallengeAssessmentWorkflow(input = {}) {
  input = normaliseChallengeAssessmentInput(input);
  const config = getCompassProviderConfig();
  const traceLabel = sanitizeAiText(input.traceLabel || 'Assessment challenge', { maxChars: 120 }) || 'Assessment challenge';
  if (hasExecutiveChallengeShape(input)) {
    const stub = buildExecutiveChallengeStub(input);
    if (!config.proxyConfigured) {
      return finaliseReviewWorkflowOutput({
        mode: 'deterministic_fallback',
        ...stub,
        usedFallback: true,
        aiUnavailable: true,
        fallbackReasonCode: 'proxy_missing_secret',
        fallbackReasonTitle: 'Deterministic fallback executive challenge loaded',
        fallbackReasonMessage: 'The hosted AI proxy is not configured, so the server used a deterministic committee challenge instead.',
        trace: buildTraceEntry({
          label: traceLabel,
          promptSummary: 'Server deterministic fallback used for executive challenge.',
          response: stub.challengeSummary
        })
      }, {
        outputType: 'challenge_assessment_executive',
        input
      });
    }
    const p90 = Number(input?.results?.eventLoss?.p90 || 0);
    const assumptions = Array.isArray(input?.assessmentIntelligence?.assumptions) ? input.assessmentIntelligence.assumptions : [];
    const obligationBasis = buildResolvedObligationPromptBlock(input?.obligationBasis || {}) || '(none)';
    const schema = `{
  "challengeSummary": "string",
  "weakestAssumption": "string",
  "alternativeView": "string",
  "confidenceVerdict": "string",
  "oneQuestion": "string"
}`;
    const userPrompt = [
      `Scenario: ${String(input?.narrative || '').slice(0, 600)}`,
      `P90 loss: ${p90.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      `Key assumptions: ${assumptions.slice(0, 3).map((item) => item?.text || item).filter(Boolean).join('; ')}`,
      `Resolved obligations: ${obligationBasis}`,
      `Control strength: ${input?.fairParams?.controlStrLikely || 'not set'}`,
      `TEF: ${input?.fairParams?.tefMin || ''}–${input?.fairParams?.tefMax || ''}/yr`
    ].join('\n');
    const systemPrompt = `You are a senior risk committee reviewer. Your job is to
challenge this assessment - not accept it. Be constructive but skeptical.
Return JSON only:
${schema}`;
    try {
      const generation = await callAi(systemPrompt, userPrompt, {
        taskName: 'challengeAssessmentExecutive',
        maxCompletionTokens: 400,
        timeoutMs: 20000
      });
      const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
        taskName: 'repairChallengeAssessmentExecutive'
      });
      return finaliseReviewWorkflowOutput({
        mode: 'live',
        ...normaliseExecutiveChallenge(parsed?.parsed || {}),
        usedFallback: false,
        aiUnavailable: false,
        trace: buildTraceEntry({
          label: traceLabel,
          promptSummary: generation.promptSummary,
          response: generation.text
        })
      }, {
        outputType: 'challenge_assessment_executive',
        input
      });
    } catch (error) {
      const normalisedError = normaliseAiError(error);
      return finaliseReviewWorkflowOutput({
        mode: 'deterministic_fallback',
        ...stub,
        usedFallback: true,
        aiUnavailable: true,
        fallbackReasonCode: 'executive_challenge_runtime_error',
        fallbackReasonTitle: 'Deterministic fallback executive challenge loaded',
        fallbackReasonMessage: 'The executive challenge step failed at runtime, so the server used a deterministic committee challenge instead.',
        fallbackReasonDetail: sanitizeAiText(normalisedError?.message || '', { maxChars: 220 }),
        trace: buildTraceEntry({
          label: traceLabel,
          promptSummary: 'Server deterministic fallback used after executive challenge generation failed.',
          response: stub.challengeSummary
        })
      }, {
        outputType: 'challenge_assessment_executive',
        input
      });
    }
  }

  const stub = buildAssessmentChallengeStub(input);
  const evidenceMeta = buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    organisationContext: input.narrative,
    uploadedText: Array.isArray(input.assumptions) ? input.assumptions.map((item) => item.text).join('\n') : '',
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  if (!config.proxyConfigured) {
    return finaliseReviewWorkflowOutput(withEvidenceMeta({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'proxy_missing_secret',
      fallbackReasonTitle: 'Deterministic fallback challenge review loaded',
      fallbackReasonMessage: 'The hosted AI proxy is not configured, so the server used a deterministic challenge review instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used for assessment challenge.',
        response: stub.summary,
        sources: input.citations || []
      })
    }, evidenceMeta), {
      outputType: 'challenge_assessment_review',
      input
    });
  }

  const schema = `{
  "summary": "string",
  "challengeLevel": "string",
  "weakestAssumptions": ["string"],
  "committeeQuestions": ["string"],
  "evidenceToGather": ["string"],
  "reviewerGuidance": ["string"]
}`;
  const userPrompt = `Assessment title: ${input.scenarioTitle || 'Untitled assessment'}
Business unit: ${input.businessUnit?.name || input.businessUnitName || 'Unknown'}
Geography: ${input.geography || 'Unknown'}
Scenario narrative: ${input.narrative || ''}
Confidence summary: ${input.confidence?.summary || ''}
Confidence label: ${input.confidence?.label || ''}
Main upward drivers:
${(input.drivers?.upward || []).map((item) => `- ${item}`).join('\n')}
Main stabilisers:
${(input.drivers?.stabilisers || []).map((item) => `- ${item}`).join('\n')}
Assumptions:
${(input.assumptions || []).map((item) => `- ${item.category}: ${item.text}`).join('\n')}
Missing information:
${(input.missingInformation || []).map((item) => `- ${item}`).join('\n')}
Live scoped context:
${buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null)}
Resolved obligations:
${buildResolvedObligationPromptBlock(input.adminSettings || input.businessUnit || {}) || '(none)'}

Evidence quality context:
${evidenceMeta.promptBlock}`;
  const systemPrompt = `You are a senior risk committee reviewer. Return JSON only with this schema:
${schema}

Instructions:
- act like a risk committee or challenge session reviewer
- do not restate the full scenario
- identify the assumptions most worth challenging
- propose the questions a committee would ask
- suggest the evidence that would most improve confidence
- keep the tone practical, concise, and decision-oriented`;
  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'challengeAssessment',
      maxCompletionTokens: 900,
      timeoutMs: 20000
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
      taskName: 'repairChallengeAssessment'
    });
    return finaliseReviewWorkflowOutput(withEvidenceMeta({
      mode: 'live',
      ...normaliseReviewChallenge(parsed?.parsed || {}, stub),
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: generation.text,
        sources: input.citations || []
      })
    }, evidenceMeta), {
      outputType: 'challenge_assessment_review',
      input
    });
  } catch (error) {
    const normalisedError = normaliseAiError(error);
    return finaliseReviewWorkflowOutput(withEvidenceMeta({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'challenge_review_runtime_error',
      fallbackReasonTitle: 'Deterministic fallback challenge review loaded',
      fallbackReasonMessage: 'The challenge-review step failed at runtime, so the server used a deterministic challenge review instead.',
      fallbackReasonDetail: sanitizeAiText(normalisedError?.message || '', { maxChars: 220 }),
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used after assessment challenge generation failed.',
        response: stub.summary,
        sources: input.citations || []
      })
    }, evidenceMeta), {
      outputType: 'challenge_assessment_review',
      input
    });
  }
}

async function buildParameterChallengeRecordWorkflow(input = {}) {
  input = normaliseParameterChallengeRecordInput(input);
  const config = getCompassProviderConfig();
  const traceLabel = sanitizeAiText(input.traceLabel || 'Parameter challenge record', { maxChars: 120 }) || 'Parameter challenge record';
  const stub = buildParameterChallengeStub(input);
  const allowedParams = Array.isArray(input?.allowedParams)
    ? input.allowedParams.map((item) => String(item || '').trim()).filter(Boolean)
    : ['tefLikely', 'vulnerability', 'lmLow', 'lmHigh', 'controlStrLikely'];
  if (!hasMeaningfulParameterChallengeInput(input)) {
    return finaliseReviewWorkflowOutput({
      mode: 'manual',
      ...stub,
      usedFallback: false,
      aiUnavailable: false,
      manualReasonCode: 'incomplete_parameter_challenge_input',
      manualReasonTitle: 'Manual parameter challenge only',
      manualReasonMessage: 'Add the challenged parameter, reviewer concern, and a short scenario summary before the server can build a parameter challenge record.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server manual mode used for parameter challenge because the request was incomplete.',
        response: 'The parameter challenge stayed in manual mode because the request was incomplete.'
      })
    }, {
      outputType: 'parameter_challenge',
      input
    });
  }
  if (!config.proxyConfigured) {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'proxy_missing_secret',
      fallbackReasonTitle: 'Deterministic fallback parameter challenge loaded',
      fallbackReasonMessage: 'The hosted AI proxy is not configured, so the server used a deterministic parameter challenge instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used for parameter challenge record.',
        response: stub.reviewerAdjustment?.rationale || '',
      })
    }, {
      outputType: 'parameter_challenge',
      input
    });
  }
  const schema = `{
  "analystQuestions": ["string"],
  "reviewerAdjustment": {
    "param": "string",
    "suggestedValue": "number",
    "aleImpact": "string",
    "rationale": "string"
  }
}`;
  const userPrompt = [
    `Parameter challenged: ${String(input?.parameterLabel || 'Parameter').trim()}`,
    `Current value: ${String(input?.currentValueLabel || input?.currentValue || '').trim()}`,
    String(input?.currentAle || '').trim() ? `Current ALE: ${String(input.currentAle).trim()}` : '',
    `Scenario summary: ${String(input?.scenarioSummary || '').trim().slice(0, 900)}`,
    `Reviewer concern: ${String(input?.reviewerConcern || '').trim().slice(0, 1000)}`
  ].filter(Boolean).join('\n');
  const systemPrompt = `A reviewer has challenged a key parameter in a quantified risk assessment.
Generate two outputs:
A) For the ANALYST: 1-3 specific questions they must answer to defend or revise the estimate. Be precise about what evidence would satisfy the reviewer.
B) For the REVIEWER: the minimum parameter adjustment that would reflect the concern if the analyst cannot provide new evidence. Show the impact on ALE.

Return JSON only with this schema:
${schema}

Allowed reviewerAdjustment.param values: ${allowedParams.join(', ')}`;
  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'generateParameterChallengeRecord',
      maxCompletionTokens: 500,
      timeoutMs: 16000
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
      taskName: 'repairParameterChallengeRecord'
    });
    return finaliseReviewWorkflowOutput({
      mode: 'live',
      ...normaliseParameterChallengeRecord(parsed?.parsed || {}, stub, allowedParams),
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: generation.text
      })
    }, {
      outputType: 'parameter_challenge',
      input
    });
  } catch {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'parameter_challenge_runtime_error',
      fallbackReasonTitle: 'Deterministic fallback parameter challenge loaded',
      fallbackReasonMessage: 'The parameter-challenge step failed at runtime, so the server used a deterministic parameter challenge instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used after parameter challenge generation failed.',
        response: stub.reviewerAdjustment?.rationale || ''
      })
    }, {
      outputType: 'parameter_challenge',
      input
    });
  }
}

async function buildChallengeSynthesisWorkflow(input = {}) {
  input = normaliseChallengeSynthesisInput(input);
  const config = getCompassProviderConfig();
  const traceLabel = sanitizeAiText(input.traceLabel || 'Challenge synthesis', { maxChars: 120 }) || 'Challenge synthesis';
  const stub = buildChallengeSynthesisStub(input);
  const records = Array.isArray(input?.records)
    ? input.records.filter((item) => item && typeof item === 'object').slice(0, 8)
    : [];
  if (!config.proxyConfigured) {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'proxy_missing_secret',
      fallbackReasonTitle: 'Deterministic fallback challenge synthesis loaded',
      fallbackReasonMessage: 'The hosted AI proxy is not configured, so the server used a deterministic challenge synthesis instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used for challenge synthesis.',
        response: stub.overallConcern
      })
    }, {
      outputType: 'challenge_synthesis',
      input
    });
  }
  if (records.length < 2) {
    return finaliseReviewWorkflowOutput({
      mode: 'manual',
      ...stub,
      usedFallback: false,
      aiUnavailable: false,
      manualReasonCode: 'insufficient_challenge_records',
      manualReasonTitle: 'Manual challenge synthesis only',
      manualReasonMessage: 'At least two saved challenge records are needed before the server can synthesise them.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server manual mode used for challenge synthesis because there were not enough challenge records.',
        response: 'At least two challenge records are needed before synthesis can run.'
      })
    }, {
      outputType: 'challenge_synthesis',
      input
    });
  }
  const schema = `{
  "overallConcern": "string",
  "revisedAleRange": "string",
  "keyEvidence": "string"
}`;
  const systemPrompt = `A risk assessment has received separate parameter challenges from reviewers.
Synthesise them into one coherent alternative view for a risk committee.

Return JSON only with this schema:
${schema}

Requirements:
- overallConcern: one sentence on the reviewer's combined concern
- revisedAleRange: one sentence stating the revised ALE range or direction implied by the combined challenges
- keyEvidence: one sentence naming the single most useful new evidence item to resolve most of the challenge

Write as if advising a risk committee. Keep the total to 3 sentences.`;
  const userPrompt = safeJson({
    scenarioTitle: String(input?.scenarioTitle || '').trim(),
    scenarioSummary: String(input?.scenarioSummary || '').trim().slice(0, 1200),
    currentAleRange: String(input?.baseAleRange || '').trim(),
    challenges: records.map((item) => ({
      parameter: String(item?.parameter || '').trim(),
      concern: String(item?.concern || '').trim(),
      reviewerAdjustment: item?.reviewerAdjustment || {}
    }))
  });
  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'generateChallengeSynthesis',
      maxCompletionTokens: 260,
      timeoutMs: 14000
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
      taskName: 'repairChallengeSynthesis'
    });
    return finaliseReviewWorkflowOutput({
      mode: 'live',
      ...normaliseChallengeSynthesis(parsed?.parsed || {}, stub),
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: generation.text
      })
    }, {
      outputType: 'challenge_synthesis',
      input
    });
  } catch {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'challenge_synthesis_runtime_error',
      fallbackReasonTitle: 'Deterministic fallback challenge synthesis loaded',
      fallbackReasonMessage: 'The challenge-synthesis step failed at runtime, so the server used a deterministic synthesis instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used after challenge synthesis failed.',
        response: stub.overallConcern
      })
    }, {
      outputType: 'challenge_synthesis',
      input
    });
  }
}

async function buildConsensusRecommendationWorkflow(input = {}) {
  input = normaliseConsensusRecommendationInput(input);
  const config = getCompassProviderConfig();
  const traceLabel = sanitizeAiText(input.traceLabel || 'Consensus recommendation', { maxChars: 120 }) || 'Consensus recommendation';
  const stub = buildConsensusRecommendationStub(input);
  const challenges = Array.isArray(input?.challenges)
    ? input.challenges.filter((item) => item && typeof item === 'object').slice(0, 8)
    : [];
  if (!config.proxyConfigured) {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'proxy_missing_secret',
      fallbackReasonTitle: 'Deterministic fallback consensus recommendation loaded',
      fallbackReasonMessage: 'The hosted AI proxy is not configured, so the server used a deterministic consensus recommendation instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used for consensus recommendation.',
        response: stub.summaryBullets.join(' ')
      })
    }, {
      outputType: 'consensus_recommendation',
      input
    });
  }
  if (!challenges.length) {
    return finaliseReviewWorkflowOutput({
      mode: 'manual',
      ...stub,
      usedFallback: false,
      aiUnavailable: false,
      manualReasonCode: 'no_open_challenges',
      manualReasonTitle: 'Manual consensus only',
      manualReasonMessage: 'At least one open reviewer challenge is needed before the server can suggest a consensus path.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server manual mode used for consensus recommendation because there were no open reviewer challenges.',
        response: 'At least one reviewer challenge is needed before consensus can run.'
      })
    }, {
      outputType: 'consensus_recommendation',
      input
    });
  }
  const allowedRefs = challenges.map((item) => String(item?.ref || '').trim()).filter(Boolean);
  const schema = `{
  "summaryBullets": ["string", "string", "string"],
  "acceptChallenges": ["${allowedRefs[0] || 'C1'}"],
  "defendChallenges": ["${allowedRefs[1] || 'C2'}"],
  "meetInTheMiddleAleRange": "string"
}`;
  const systemPrompt = `An analyst's assessment has reviewer challenges.
Original parameters: current estimate.
Original ALE: current estimate.
If all reviewer adjustments applied: adjusted estimate.
Adjusted ALE: adjusted estimate.

Generate a consensus recommendation:
- Which adjustments should the analyst accept? (small ALE impact)
- Which should they defend? (large ALE impact, needs evidence)
- What is the "meet in the middle" ALE range both sides could accept?

Return JSON only with this schema:
${schema}

Rules:
- Use only the supplied challenge refs in acceptChallenges and defendChallenges.
- Write exactly 3 direct bullets for a risk committee.
- Put the committee-friendly projected range in meetInTheMiddleAleRange.`;
  const userPrompt = safeJson({
    scenarioTitle: String(input?.scenarioTitle || '').trim(),
    scenarioSummary: String(input?.scenarioSummary || '').trim().slice(0, 1000),
    originalAleRange: String(input?.originalAleRange || '').trim(),
    adjustedAleRange: String(input?.adjustedAleRange || '').trim(),
    projectedAleRange: String(input?.projectedAleRange || '').trim(),
    aleChangePct: Number(input?.aleChangePct || 0),
    originalParameters: input?.originalParameters || {},
    adjustedParameters: input?.adjustedParameters || {},
    challenges: challenges.map((item) => ({
      ref: String(item?.ref || '').trim(),
      parameter: String(item?.parameter || '').trim(),
      concern: String(item?.concern || '').trim(),
      proposedValue: String(item?.proposedValue || '').trim(),
      impactPct: Number(item?.impactPct || 0),
      aleImpact: String(item?.aleImpact || '').trim()
    }))
  });
  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'generateConsensusRecommendation',
      maxCompletionTokens: 320,
      timeoutMs: 14000
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
      taskName: 'repairConsensusRecommendation'
    });
    return finaliseReviewWorkflowOutput({
      mode: 'live',
      ...normaliseConsensusRecommendation(parsed?.parsed || {}, stub, allowedRefs),
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: generation.text
      })
    }, {
      outputType: 'consensus_recommendation',
      input
    });
  } catch {
    return finaliseReviewWorkflowOutput({
      mode: 'deterministic_fallback',
      ...stub,
      usedFallback: true,
      aiUnavailable: true,
      fallbackReasonCode: 'consensus_runtime_error',
      fallbackReasonTitle: 'Deterministic fallback consensus recommendation loaded',
      fallbackReasonMessage: 'The consensus step failed at runtime, so the server used a deterministic consensus recommendation instead.',
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: 'Server deterministic fallback used after consensus recommendation failed.',
        response: stub.summaryBullets.join(' ')
      })
    }, {
      outputType: 'consensus_recommendation',
      input
    });
  }
}

async function buildReviewMediationWorkflow(input = {}) {
  input = normaliseReviewMediationInput(input);
  const config = getCompassProviderConfig();
  const reviewerView = String(input?.reviewerView || '').trim();
  const analystView = String(input?.analystView || '').trim();
  const traceLabel = sanitizeAiText(input.traceLabel || 'Review mediation', { maxChars: 120 }) || 'Review mediation';
  const buildManualResult = ({ code, title, message, detail = '' } = {}) => finaliseReviewWorkflowOutput({
    mode: 'manual',
    usedFallback: false,
    aiUnavailable: code !== 'missing_positions',
    reconciliationSummary: message || 'The mediation stayed manual because the server could not produce a live or deterministic proposal.',
    proposedMiddleGround: title || 'Manual mediation recommended',
    whyReasonable: detail || 'Use the reviewer note, analyst response, and current evidence to settle the disagreement manually.',
    recommendedField: '',
    recommendedValue: null,
    recommendedValueLabel: '',
    evidenceToVerify: detail || 'Review the disputed assumption, the current evidence pack, and the latest reviewer note together.',
    continueDiscussionPrompt: 'Keep the discussion manual: restate the disputed assumption, cite the strongest evidence on each side, and agree the one fact that would resolve it.',
    manualReasonCode: code || 'manual_review_required',
    manualReasonTitle: title || 'Manual mediation recommended',
    manualReasonMessage: message || 'The server could not produce a mediation proposal for this discussion.',
    manualReasonDetail: detail,
    trace: buildTraceEntry({
      label: traceLabel,
      promptSummary: 'Server manual mode used for review mediation.',
      response: message || 'The server could not produce a mediation proposal for this discussion.'
    })
  }, {
    outputType: 'review_mediation',
    input
  });
  if (!reviewerView || !analystView) {
    return buildManualResult({
      code: 'missing_positions',
      title: 'Manual mediation only',
      message: 'Both the reviewer view and the analyst view are needed before the server can mediate the disagreement.'
    });
  }
  if (!config.proxyConfigured) {
    return buildManualResult({
      code: 'proxy_missing_secret',
      title: 'Manual mediation recommended',
      message: 'The hosted AI proxy is not configured, so this mediation discussion must stay manual for now.',
      detail: 'Use the reviewer note, analyst response, and current evidence pack to work through the disputed assumption.'
    });
  }
  const fairParams = input?.fairParams || {};
  const assumptions = Array.isArray(input?.assessmentIntelligence?.assumptions) ? input.assessmentIntelligence.assumptions : [];
  const drivers = Array.isArray(input?.assessmentIntelligence?.drivers?.sensitivity) ? input.assessmentIntelligence.drivers.sensitivity : [];
  const citations = Array.isArray(input?.citations) ? input.citations.slice(0, 4) : [];
  const schema = `{
  "reconciliationSummary": "string",
  "proposedMiddleGround": "string",
  "whyReasonable": "string",
  "recommendedField": "string",
  "recommendedValue": "number",
  "recommendedValueLabel": "string",
  "evidenceToVerify": "string",
  "continueDiscussionPrompt": "string"
}`;
  const systemPrompt = `You are an AI mediation assistant for enterprise risk reviews.
Resolve focused disagreements between the analyst and the reviewer. Be constructive, specific, and concise.
Return JSON only with this schema:
${schema}`;
  const userPrompt = [
    `Scenario: ${String(input?.narrative || '').slice(0, 700)}`,
    `Scenario lens: ${String(input?.scenarioLens?.label || input?.scenarioLens?.key || 'general')}`,
    `Disputed focus: ${String(input?.disputedFocus || 'Overall assessment').slice(0, 120)}`,
    `Reviewer view: ${reviewerView}`,
    `Analyst view: ${analystView}`,
    `Current P90 event loss: ${Number(input?.results?.eventLoss?.p90 || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
    `Current ALE mean: ${Number(input?.results?.ale?.mean || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
    `Current control strength likely: ${fairParams?.controlStrLikely ?? 'not set'}`,
    `Current TEF likely: ${fairParams?.tefLikely ?? 'not set'}`,
    `Key assumptions: ${assumptions.slice(0, 3).map((item) => item?.text || item).filter(Boolean).join('; ') || 'Not stated'}`,
    `Top drivers: ${drivers.slice(0, 3).map((item) => `${item?.label || 'Driver'} - ${item?.why || ''}`).filter(Boolean).join('; ') || 'Not stated'}`,
    `Relevant evidence: ${citations.map((item) => item?.title || item?.sourceTitle || '').filter(Boolean).join('; ') || 'No named evidence provided'}`
  ].join('\n');
  try {
    const generation = await callAi(systemPrompt, userPrompt, {
      taskName: 'mediateAssessmentDispute',
      maxCompletionTokens: 420,
      timeoutMs: 20000
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, schema, {
      taskName: 'repairMediationAssessmentDispute'
    });
    return finaliseReviewWorkflowOutput({
      mode: 'live',
      usedFallback: false,
      aiUnavailable: false,
      ...normaliseMediation(parsed?.parsed || {}),
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: generation.text
      })
    }, {
      outputType: 'review_mediation',
      input
    });
  } catch (error) {
    const normalisedError = normaliseAiError(error);
    return buildManualResult({
      code: 'mediation_runtime_error',
      title: 'Manual mediation recommended',
      message: 'The AI mediation step failed at runtime, so this discussion should stay manual for now.',
      detail: sanitizeAiText(normalisedError?.message || '', { maxChars: 220 })
    });
  }
}

module.exports = {
  buildReviewerDecisionBriefWorkflow,
  buildChallengeAssessmentWorkflow,
  buildParameterChallengeRecordWorkflow,
  buildChallengeSynthesisWorkflow,
  buildConsensusRecommendationWorkflow,
  buildReviewMediationWorkflow
};
