(function (globalScope) {
  'use strict';

  const DATA = globalScope.__SCENARIO_TAXONOMY_PROJECTION_DATA__ || {
    taxonomyVersion: 'unknown',
    domains: [],
    overlays: [],
    families: [],
    unsupportedSignals: []
  };
  const STRENGTH_SCORE = Object.freeze({ strong: 3, medium: 2, weak: 1 });
  const TOKEN_EQUIVALENTS = Object.freeze({
    hijack: 'takeover',
    hijacked: 'takeover',
    hijacking: 'takeover',
    mailbox: 'email',
    credentials: 'credential'
  });
  const MORPHOLOGICAL_SUFFIXES = Object.freeze([
    'ation',
    'ition',
    'tion',
    'sion',
    'ment',
    'ness',
    'ality',
    'ility',
    'ance',
    'ence',
    'ive',
    'al',
    'ing',
    'ed',
    'es',
    's',
    'ly'
  ]);
  const COMPLIANCE_LED_PRIVACY_FAMILY_KEYS = new Set([
    'privacy_governance_gap',
    'privacy_non_compliance',
    'records_retention_non_compliance',
    'cross_border_transfer_non_compliance'
  ]);
  const EXTRA_HINT_ALIASES = Object.freeze({
    technology: 'cyber',
    cyber: 'cyber',
    ai: 'ai-model-risk',
    'ai risk': 'ai-model-risk',
    'ai / model risk': 'ai-model-risk',
    'ai-model-risk': 'ai-model-risk',
    'model risk': 'ai-model-risk',
    'model governance': 'ai-model-risk',
    'responsible ai': 'ai-model-risk',
    copilot: 'ai-model-risk',
    'agentic ai': 'ai-model-risk',
    'llm assistant': 'ai-model-risk',
    finance: 'financial',
    financial: 'financial',
    operations: 'operational',
    operational: 'operational',
    compliance: 'compliance',
    regulatory: 'regulatory',
    procurement: 'procurement',
    'supply chain': 'supply-chain',
    'supply-chain': 'supply-chain',
    'third party': 'third-party',
    'third-party': 'third-party',
    continuity: 'business-continuity',
    'business continuity': 'business-continuity',
    'business continuity management': 'business-continuity',
    'business-continuity': 'business-continuity',
    bcm: 'business-continuity',
    esg: 'esg',
    hse: 'hse',
    qhse: 'hse',
    strategic: 'strategic',
    investment: 'investment-jv',
    'investment / jv': 'investment-jv',
    'investment-jv': 'investment-jv',
    'joint venture': 'investment-jv',
    jv: 'investment-jv',
    'm&a': 'investment-jv',
    merger: 'investment-jv',
    acquisition: 'investment-jv',
    geopolitical: 'geopolitical',
    sanctions: 'geopolitical',
    sovereign: 'geopolitical',
    'market access': 'geopolitical',
    'transformation delivery': 'transformation-delivery',
    'transformation-delivery': 'transformation-delivery',
    'physical security': 'physical-security',
    'physical-security': 'physical-security',
    'ot resilience': 'ot-resilience',
    'ot-resilience': 'ot-resilience',
    'data governance': 'data-governance',
    'data-governance': 'data-governance',
    privacy: 'data-governance',
    'data privacy': 'data-governance',
    'data protection': 'data-governance',
    'data governance / privacy': 'data-governance',
    general: 'general'
  });

  const families = Array.isArray(DATA.families) ? DATA.families : [];
  const activeFamilies = Object.freeze(
    families.filter((family) => String(family?.status || 'active') === 'active')
  );
  const overlays = Array.isArray(DATA.overlays) ? DATA.overlays : [];
  const familyByKey = Object.freeze(families.reduce((accumulator, family) => {
    accumulator[family.key] = family;
    return accumulator;
  }, {}));
  function resolvePreferredFamily(family = null, visited = new Set()) {
    if (!family) return null;
    if (String(family.status || 'active') !== 'compatibility_only') return family;
    const preferredFamilyKey = String(family.preferredFamilyKey || '').trim();
    if (!preferredFamilyKey || visited.has(family.key)) return family;
    visited.add(family.key);
    return resolvePreferredFamily(familyByKey[preferredFamilyKey] || null, visited) || family;
  }
  const familiesByLegacyKey = Object.freeze(families.reduce((accumulator, family) => {
    const legacyKey = String(family.legacyKey || '').trim();
    if (!legacyKey) return accumulator;
    accumulator[legacyKey] = accumulator[legacyKey] || [];
    accumulator[legacyKey].push(family);
    accumulator[legacyKey].sort((left, right) => {
      const resolvedRight = resolvePreferredFamily(right) || right;
      const resolvedLeft = resolvePreferredFamily(left) || left;
      return Number(resolvedRight.priorityScore || right.priorityScore || 0) - Number(resolvedLeft.priorityScore || left.priorityScore || 0);
    });
    return accumulator;
  }, {}));
  const lensProfiles = Object.freeze(Object.values(activeFamilies.reduce((accumulator, family) => {
    const lensKey = String(family.lensKey || '').trim();
    if (!lensKey) return accumulator;
    const current = accumulator[lensKey];
    if (!current || Number(family.priorityScore || 0) > Number(current.priorityScore || 0)) {
      accumulator[lensKey] = {
        key: lensKey,
        label: family.lensLabel,
        functionKey: family.functionKey,
        estimatePresetKey: family.estimatePresetKey,
        priorityScore: family.priorityScore,
        familyKey: family.key,
        legacyKey: family.legacyKey
      };
    }
    return accumulator;
  }, {})));
  const lensProfileByKey = Object.freeze(lensProfiles.reduce((accumulator, profile) => {
    accumulator[profile.key] = profile;
    return accumulator;
  }, {}));
  const compatibilityByLensKey = activeFamilies.reduce((accumulator, family) => {
    const lensKey = String(family.lensKey || '').trim();
    if (!lensKey) return accumulator;
    accumulator[lensKey] = accumulator[lensKey] || new Set([lensKey]);
    [family.allowedSecondaryFamilies, family.canCoExistWith, family.canEscalateTo].forEach((collection) => {
      (Array.isArray(collection) ? collection : []).forEach((relatedKey) => {
        const relatedFamily = familyByKey[relatedKey];
        const relatedLens = String(relatedFamily?.lensKey || '').trim();
        if (relatedLens) accumulator[lensKey].add(relatedLens);
      });
    });
    return accumulator;
  }, {});
  Object.keys(compatibilityByLensKey).forEach((lensKey) => {
    Array.from(compatibilityByLensKey[lensKey]).forEach((relatedLens) => {
      compatibilityByLensKey[relatedLens] = compatibilityByLensKey[relatedLens] || new Set([relatedLens]);
      compatibilityByLensKey[relatedLens].add(lensKey);
    });
  });
  Object.freeze(compatibilityByLensKey);

  function normaliseText(value = '') {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function escapeRegex(value = '') {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function signalPattern(signal = '') {
    return new RegExp('(?:^|[^a-z0-9])' + escapeRegex(String(signal || '').toLowerCase()).replace(/\\ /g, '\\s+') + '(?:$|[^a-z0-9])', 'i');
  }

  function stemToken(value = '') {
    const stemmed = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(?:ing|ers|ies|ied|ed|es|s)$/i, '')
      .trim();
    return TOKEN_EQUIVALENTS[stemmed] || stemmed;
  }

  function matchesSignal(haystack = '', signal = '') {
    const value = String(signal || '').trim();
    if (!value) return false;
    if (signalPattern(value).test(haystack)) return true;
    const signalTokens = value
      .toLowerCase()
      .match(/[a-z0-9]+/g) || [];
    const meaningfulTokens = signalTokens
      .map(stemToken)
      .filter((token) => token.length >= 4);
    if (!meaningfulTokens.length) return false;
    if (signalTokens.length > 1 && meaningfulTokens.length < 2) return false;
    const haystackTokens = Array.from(new Set(
      (String(haystack || '').toLowerCase().match(/[a-z0-9]+/g) || [])
        .map(stemToken)
        .filter((token) => token.length >= 4)
    ));
    return meaningfulTokens.every((token) => haystackTokens.some((haystackToken) => {
      if (haystackToken === token) return true;
      const shorter = haystackToken.length <= token.length ? haystackToken : token;
      const longer = shorter === haystackToken ? token : haystackToken;
      if (shorter.length < 6 || !longer.startsWith(shorter)) return false;
      const suffix = longer.slice(shorter.length);
      return MORPHOLOGICAL_SUFFIXES.some((candidate) => suffix === candidate);
    }));
  }

  function scoreSignalSet(haystack = '', signals = []) {
    const matches = [];
    const details = [];
    let score = 0;
    (Array.isArray(signals) ? signals : []).forEach((signal) => {
      if (!signal?.text) return;
      if (!matchesSignal(haystack, signal.text)) return;
      matches.push(signal.text);
      details.push({
        text: signal.text,
        strength: String(signal.strength || 'medium').toLowerCase()
      });
      score += STRENGTH_SCORE[String(signal.strength || 'medium').toLowerCase()] || 1;
    });
    return { matches, details, score };
  }

  function normaliseHintKey(value = '') {
    const rawValues = value && typeof value === 'object'
      ? [value.key, value.label, value.functionKey, value.estimatePresetKey, value.legacyKey, value.familyKey]
      : [value];
    for (const raw of rawValues) {
      const token = normaliseText(raw);
      if (!token) continue;
      if (lensProfileByKey[token]) return token;
      const legacyFamily = (familiesByLegacyKey[token] || [])
        .map((family) => resolvePreferredFamily(family))
        .find((family) => family?.lensKey);
      if (legacyFamily?.lensKey) return legacyFamily.lensKey;
      const family = resolvePreferredFamily(familyByKey[token] || null);
      if (family?.lensKey) return family.lensKey;
      if (EXTRA_HINT_ALIASES[token]) return EXTRA_HINT_ALIASES[token];
    }
    return '';
  }

  function detectUnsupportedSignals(haystack = '') {
    return (Array.isArray(DATA.unsupportedSignals) ? DATA.unsupportedSignals : [])
      .filter((signal) => signal?.pattern && new RegExp(signal.pattern, 'i').test(haystack))
      .map((signal) => signal.key);
  }

  function isConsequenceLikeSignal(signalText = '') {
    const token = normaliseText(signalText);
    if (!token) return false;
    return overlays.some((overlay) => token.includes(normaliseText(overlay.label)) || token.includes(normaliseText(overlay.key).replace(/_/g, ' ')));
  }

  function buildFamilyEvaluation(family = {}, haystack = '') {
    const positive = scoreSignalSet(haystack, family.positiveSignals);
    const anti = scoreSignalSet(haystack, family.antiSignals);
    const required = scoreSignalSet(haystack, family.requiredSignals);
    const eventMatches = positive.matches.filter((match) => !isConsequenceLikeSignal(match));
    const strongPositiveMatchCount = positive.details.filter((detail) => detail.strength === 'strong').length;
    const mediumOrStrongPositiveMatchCount = positive.details.filter((detail) => detail.strength === 'medium' || detail.strength === 'strong').length;
    const blockedByRequiredSignals = Array.isArray(family.requiredSignals) && family.requiredSignals.length > 0 && required.matches.length === 0;
    const blockedByAntiSignals = anti.score >= Math.max(3, positive.score) && anti.matches.length > 0 && eventMatches.length === 0;
    const blockedByExplicitDisclosureRule = family.key === 'data_disclosure'
      && strongPositiveMatchCount === 0
      && mediumOrStrongPositiveMatchCount < 2;
    const eventScore = positive.score + required.score - (anti.score * 1.5);
    return {
      familyKey: family.key,
      family,
      positiveMatches: positive.matches,
      antiMatches: anti.matches,
      requiredMatches: required.matches,
      eventMatches,
      positiveScore: positive.score,
      antiScore: anti.score,
      requiredScore: required.score,
      eventScore,
      score: eventScore + (Number(family.priorityScore || 0) / 100),
      strongPositiveMatchCount,
      mediumOrStrongPositiveMatchCount,
      blockedByRequiredSignals,
      blockedByAntiSignals,
      blockedByExplicitDisclosureRule,
      qualified: !blockedByRequiredSignals && !blockedByAntiSignals && !blockedByExplicitDisclosureRule && eventMatches.length > 0 && eventScore >= 2
    };
  }

  function clamp(value = 0, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number(value || 0)));
  }

  function roundScore(value = 0) {
    return Number(Number(value || 0).toFixed(2));
  }

  function buildWeakClassification(hintKey = '', unsupportedSignals = [], matchedAntiSignals = []) {
    const hintProfile = hintKey ? lensProfileByKey[hintKey] : null;
    return {
      familyKey: '',
      legacyKey: hintProfile?.legacyKey || 'general',
      key: hintProfile?.legacyKey || 'general',
      lensKey: hintProfile?.key || 'general',
      lensLabel: hintProfile?.label || 'General enterprise risk',
      functionKey: hintProfile?.functionKey || 'general',
      estimatePresetKey: hintProfile?.estimatePresetKey || 'general',
      secondaryFamilyKeys: [],
      secondaryKeys: [],
      confidence: 'low',
      matchedSignals: [],
      matchedAntiSignals,
      ambiguityFlags: ['WEAK_EVENT_PATH'],
      unsupportedSignals,
      taxonomyVersion: DATA.taxonomyVersion
    };
  }

  function serialiseEvaluation(evaluation = null, primaryFamilyKey = '') {
    if (!evaluation?.familyKey || !evaluation?.family) return null;
    const operationalLens = getOperationalLensProfile(evaluation.family);
    return {
      familyKey: evaluation.familyKey,
      familyLabel: String(evaluation.family.label || '').trim(),
      domain: String(evaluation.family.domain || '').trim(),
      legacyKey: String(evaluation.family.legacyKey || '').trim(),
      lensKey: operationalLens.key,
      lensLabel: operationalLens.label,
      functionKey: operationalLens.functionKey,
      estimatePresetKey: operationalLens.estimatePresetKey,
      score: roundScore(evaluation.score),
      eventScore: roundScore(evaluation.eventScore),
      positiveScore: roundScore(evaluation.positiveScore),
      antiScore: roundScore(evaluation.antiScore),
      requiredScore: roundScore(evaluation.requiredScore),
      qualified: !!evaluation.qualified,
      primary: evaluation.familyKey === primaryFamilyKey,
      strongPositiveMatchCount: Number(evaluation.strongPositiveMatchCount || 0),
      mediumOrStrongPositiveMatchCount: Number(evaluation.mediumOrStrongPositiveMatchCount || 0),
      matchedSignals: (Array.isArray(evaluation.eventMatches) && evaluation.eventMatches.length ? evaluation.eventMatches : evaluation.positiveMatches).slice(0, 6),
      matchedAntiSignals: (Array.isArray(evaluation.antiMatches) ? evaluation.antiMatches : []).slice(0, 6),
      matchedRequiredSignals: (Array.isArray(evaluation.requiredMatches) ? evaluation.requiredMatches : []).slice(0, 4),
      blockedByRequiredSignals: !!evaluation.blockedByRequiredSignals,
      blockedByAntiSignals: !!evaluation.blockedByAntiSignals,
      blockedByExplicitDisclosureRule: !!evaluation.blockedByExplicitDisclosureRule
    };
  }

  function rankCompetitiveEvaluations(primaryEvaluation = null, qualified = [], competitive = []) {
    const ranked = [];
    const seen = new Set();
    [primaryEvaluation, ...(Array.isArray(qualified) ? qualified : []), ...(Array.isArray(competitive) ? competitive : [])].forEach((evaluation) => {
      if (!evaluation?.familyKey || seen.has(evaluation.familyKey)) return;
      seen.add(evaluation.familyKey);
      ranked.push(evaluation);
    });
    return ranked;
  }

  function buildCompetitionAmbiguityFlags({
    primaryEvaluation = null,
    topEvaluation = null,
    runnerUpEvaluation = null,
    unsupportedSignals = []
  } = {}) {
    const flags = new Set();
    if (!topEvaluation) {
      flags.add('WEAK_EVENT_PATH');
      flags.add('NO_CLEAR_FAMILY');
      return Array.from(flags);
    }
    const topScore = Number(topEvaluation.score || 0);
    const runnerUpScore = Number(runnerUpEvaluation?.score || 0);
    const separationScore = topScore - runnerUpScore;
    if (!primaryEvaluation) flags.add('NO_CLEAR_FAMILY');
    if (runnerUpEvaluation && separationScore < 1.25) {
      flags.add('LOW_SEPARATION');
      if (String(topEvaluation.family?.lensKey || '').trim() !== String(runnerUpEvaluation.family?.lensKey || '').trim()) {
        flags.add('MIXED_TOP_FAMILIES');
      }
    }
    if (Number(topEvaluation.eventMatches?.length || 0) < 2 && Number(topEvaluation.strongPositiveMatchCount || 0) === 0) {
      flags.add('LIMITED_EVENT_EVIDENCE');
    }
    if (topScore < 3) flags.add('LOW_PRIMARY_CONFIDENCE');
    if (Array.isArray(unsupportedSignals) && unsupportedSignals.length) flags.add('UNSUPPORTED_SIGNAL_PRESENT');
    return Array.from(flags);
  }

  function buildCompetitionConfidence({
    primaryEvaluation = null,
    topEvaluation = null,
    runnerUpEvaluation = null,
    ambiguityFlags = [],
    unsupportedSignals = []
  } = {}) {
    const evaluation = primaryEvaluation || topEvaluation;
    if (!evaluation) {
      return {
        confidenceScore: 0,
        confidenceBand: 'low',
        separationScore: 0
      };
    }
    const separationScore = Math.max(0, Number(evaluation.score || 0) - Number(runnerUpEvaluation?.score || 0));
    const baseScore = clamp((Number(evaluation.score || 0) - 1.5) / 4.5, 0, 1);
    const eventEvidence = clamp((Number(evaluation.eventMatches?.length || 0) + Number(evaluation.strongPositiveMatchCount || 0)) / 4, 0, 1);
    const separationStrength = clamp(separationScore / 2, 0, 1);
    const ambiguityPenalty = Array.isArray(ambiguityFlags) && ambiguityFlags.includes('LOW_SEPARATION') ? 0.18 : 0;
    const weakPrimaryPenalty = Array.isArray(ambiguityFlags) && ambiguityFlags.includes('LOW_PRIMARY_CONFIDENCE') ? 0.08 : 0;
    const unsupportedPenalty = Array.isArray(unsupportedSignals) && unsupportedSignals.length ? 0.06 : 0;
    const noPrimaryPenalty = primaryEvaluation ? 0 : 0.15;
    const confidenceScore = clamp(
      (baseScore * 0.45)
      + (eventEvidence * 0.3)
      + (separationStrength * 0.25)
      - ambiguityPenalty
      - weakPrimaryPenalty
      - unsupportedPenalty
      - noPrimaryPenalty,
      0,
      1
    );
    const confidenceBand = primaryEvaluation && confidenceScore >= 0.74 && separationScore >= 1.25 && Number(evaluation.eventMatches?.length || 0) >= 2
      ? 'high'
      : primaryEvaluation && confidenceScore >= 0.46 && separationScore >= 0.55
        ? 'medium'
        : 'low';
    return {
      confidenceScore: roundScore(confidenceScore),
      confidenceBand,
      separationScore: roundScore(separationScore)
    };
  }

  function hasExplicitDisclosureContext(haystack = '', evaluation = null) {
    const explicitDisclosureSignals = new Set([
      'exfiltration',
      'disclosure',
      'leaked data',
      'exposed records',
      'stolen data',
      'data exposure'
    ]);
    const explicitFromMatches = (Array.isArray(evaluation?.positiveMatches) ? evaluation.positiveMatches : [])
      .map((match) => normaliseText(match))
      .some((match) => explicitDisclosureSignals.has(match));
    if (explicitFromMatches) return true;
    return /(exfiltrat|unauthori[sz]ed disclosure|data exposure|exposed records?|stolen data|leaked data|public exposure|external disclosure)/i.test(haystack);
  }

  function hasPrivacyObligationContext(haystack = '') {
    return /(privacy|data protection|lawful basis|retention|records|personal data|processing|cross-border transfer)/i.test(haystack);
  }

  function getOperationalLensProfile(family = null, fallbackKey = '') {
    const familyKey = String(family?.key || '').trim();
    if (familyKey && COMPLIANCE_LED_PRIVACY_FAMILY_KEYS.has(familyKey)) {
      return {
        key: 'compliance',
        label: 'Compliance',
        functionKey: 'compliance',
        estimatePresetKey: String(family?.estimatePresetKey || 'compliance').trim() || 'compliance'
      };
    }
    const lensKey = String(family?.lensKey || fallbackKey || '').trim();
    const profile = lensProfileByKey[lensKey] || null;
    return {
      key: lensKey || String(profile?.key || 'general').trim() || 'general',
      label: String(family?.lensLabel || profile?.label || 'General enterprise risk').trim() || 'General enterprise risk',
      functionKey: String(family?.functionKey || profile?.functionKey || 'general').trim() || 'general',
      estimatePresetKey: String(family?.estimatePresetKey || profile?.estimatePresetKey || 'general').trim() || 'general'
    };
  }

  function selectCompliancePrimary(qualified = []) {
    return (Array.isArray(qualified) ? qualified : [])
      .filter((evaluation) => [
        'privacy_non_compliance',
        'records_retention_non_compliance',
        'cross_border_transfer_non_compliance'
      ].includes(evaluation.familyKey))
      .sort((left, right) => right.score - left.score)[0] || null;
  }

  function applyPrecedenceRules(primaryEvaluation = null, qualified = [], haystack = '') {
    if (!primaryEvaluation) return primaryEvaluation;
    if (primaryEvaluation.familyKey === 'data_disclosure') {
      const compliancePrimary = selectCompliancePrimary(qualified);
      const genericDisclosureOnly = (Array.isArray(primaryEvaluation.positiveMatches) ? primaryEvaluation.positiveMatches : [])
        .map((match) => normaliseText(match))
        .every((match) => match === 'breach' || match === 'disclosure');
      if (
        compliancePrimary
        && !hasExplicitDisclosureContext(haystack, primaryEvaluation)
        && (hasPrivacyObligationContext(haystack) || genericDisclosureOnly)
      ) {
        return compliancePrimary;
      }
    }
    return primaryEvaluation;
  }

  function deriveSecondaryFamilies(primaryEvaluation = null, evaluations = []) {
    const primaryFamily = primaryEvaluation?.family || null;
    if (!primaryFamily) return [];
    const allowed = new Set([
      ...(Array.isArray(primaryFamily.allowedSecondaryFamilies) ? primaryFamily.allowedSecondaryFamilies : []),
      ...(Array.isArray(primaryFamily.canCoExistWith) ? primaryFamily.canCoExistWith : []),
      ...(Array.isArray(primaryFamily.canEscalateTo) ? primaryFamily.canEscalateTo : [])
    ].filter(Boolean));
    const minimumScore = Math.max(2.5, Number(primaryEvaluation?.score || 0) * 0.45);
    return (Array.isArray(evaluations) ? evaluations : [])
      .filter((evaluation) => evaluation.familyKey !== primaryFamily.key)
      .filter((evaluation) => evaluation.qualified && allowed.has(evaluation.familyKey) && evaluation.score >= minimumScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map((evaluation) => evaluation.familyKey);
  }

  function evaluateScenarioCompetition(text = '', options = {}) {
    const haystack = normaliseText(text);
    const hintKey = normaliseHintKey(options.scenarioLensHint);
    const unsupportedSignals = detectUnsupportedSignals(haystack);
    if (!haystack) {
      const classification = buildWeakClassification(hintKey, unsupportedSignals);
      const topLens = buildScenarioLens(classification, hintKey);
      return {
        text: String(text || ''),
        classification,
        topFamilyKey: '',
        topFamily: null,
        topFamilies: [],
        topLens,
        topLensKey: topLens.key,
        topLensLabel: topLens.label,
        confidenceScore: 0,
        confidenceBand: 'low',
        separationScore: 0,
        ambiguityFlags: classification.ambiguityFlags.slice(),
        matchedSignals: [],
        matchedAntiSignals: [],
        unsupportedSignals,
        taxonomyVersion: DATA.taxonomyVersion
      };
    }
    const evaluations = activeFamilies.map((family) => buildFamilyEvaluation(family, haystack));
    const qualified = evaluations.filter((evaluation) => evaluation.qualified).sort((left, right) => right.score - left.score);
    const primaryEvaluation = applyPrecedenceRules(qualified[0] || null, qualified, haystack);
    const competitive = evaluations
      .filter((evaluation) => evaluation.eventMatches.length || evaluation.requiredMatches.length || evaluation.positiveMatches.length)
      .sort((left, right) => right.score - left.score);
    const rankedCompetitive = rankCompetitiveEvaluations(primaryEvaluation, qualified, competitive);
    const topEvaluation = primaryEvaluation || rankedCompetitive[0] || null;
    const runnerUpEvaluation = (
      qualified.find((evaluation) => evaluation.familyKey !== topEvaluation?.familyKey)
      || rankedCompetitive.find((evaluation) => evaluation.familyKey !== topEvaluation?.familyKey)
      || null
    );
    const ambiguityFlags = buildCompetitionAmbiguityFlags({
      primaryEvaluation,
      topEvaluation,
      runnerUpEvaluation,
      unsupportedSignals
    });
    const confidence = buildCompetitionConfidence({
      primaryEvaluation,
      topEvaluation,
      runnerUpEvaluation,
      ambiguityFlags,
      unsupportedSignals
    });
    let classification = null;
    if (!primaryEvaluation) {
      classification = buildWeakClassification(
        hintKey,
        unsupportedSignals,
        evaluations.flatMap((evaluation) => evaluation.antiMatches).slice(0, 6)
      );
    } else {
      const primaryFamily = primaryEvaluation.family;
      const operationalLens = getOperationalLensProfile(primaryFamily);
      const legacyKey = COMPLIANCE_LED_PRIVACY_FAMILY_KEYS.has(String(primaryFamily?.key || '').trim())
        ? operationalLens.key
        : String(primaryFamily?.legacyKey || '').trim();
      const secondaryFamilyKeys = deriveSecondaryFamilies(primaryEvaluation, qualified);
      const secondaryKeys = secondaryFamilyKeys
        .map((familyKey) => familyByKey[familyKey])
        .map((family) => getOperationalLensProfile(family).key)
        .filter((key, index, values) => key && key !== operationalLens.key && values.indexOf(key) === index)
        .slice(0, 3);
      classification = {
        familyKey: primaryFamily.key,
        familyLabel: primaryFamily.label,
        domain: primaryFamily.domain,
        legacyKey,
        key: legacyKey,
        lensKey: operationalLens.key,
        lensLabel: operationalLens.label,
        functionKey: operationalLens.functionKey,
        estimatePresetKey: operationalLens.estimatePresetKey,
        secondaryFamilyKeys,
        secondaryKeys,
        confidence: primaryEvaluation.score >= 6 ? 'high' : primaryEvaluation.score >= 3 ? 'medium' : 'low',
        matchedSignals: primaryEvaluation.eventMatches.length ? primaryEvaluation.eventMatches : primaryEvaluation.positiveMatches,
        matchedAntiSignals: primaryEvaluation.antiMatches,
        ambiguityFlags: [
          ...(runnerUpEvaluation && Math.abs((primaryEvaluation.score || 0) - (runnerUpEvaluation.score || 0)) < 1.25 ? ['MIXED_DOMAIN_SIGNALS'] : []),
          ...(primaryEvaluation.score < 3 ? ['LOW_PRIMARY_CONFIDENCE'] : []),
          ...(primaryEvaluation.eventMatches.length === 0 ? ['CONSEQUENCE_HEAVY_TEXT'] : [])
        ],
        unsupportedSignals,
        taxonomyVersion: DATA.taxonomyVersion
      };
    }
    const topLens = topEvaluation
      ? buildScenarioLens({
          familyKey: topEvaluation.familyKey,
          key: topEvaluation.family?.legacyKey || topEvaluation.familyKey,
          lensKey: topEvaluation.family?.lensKey || classification.lensKey,
          secondaryFamilyKeys: classification.secondaryFamilyKeys || []
        }, hintKey)
      : buildScenarioLens(classification, hintKey);
    return {
      text: String(text || ''),
      classification,
      topFamilyKey: topEvaluation?.familyKey || '',
      topFamily: serialiseEvaluation(topEvaluation, primaryEvaluation?.familyKey || ''),
      topFamilies: rankedCompetitive.slice(0, Math.max(3, Number(options.limit || 5))).map((evaluation) => serialiseEvaluation(evaluation, primaryEvaluation?.familyKey || '')).filter(Boolean),
      topLens,
      topLensKey: topLens.key,
      topLensLabel: topLens.label,
      confidenceScore: confidence.confidenceScore,
      confidenceBand: confidence.confidenceBand,
      separationScore: confidence.separationScore,
      ambiguityFlags: Array.from(new Set([
        ...(Array.isArray(classification.ambiguityFlags) ? classification.ambiguityFlags : []),
        ...ambiguityFlags
      ])),
      matchedSignals: topEvaluation ? ((topEvaluation.eventMatches.length ? topEvaluation.eventMatches : topEvaluation.positiveMatches).slice(0, 6)) : [],
      matchedAntiSignals: topEvaluation ? topEvaluation.antiMatches.slice(0, 6) : classification.matchedAntiSignals || [],
      unsupportedSignals,
      taxonomyVersion: DATA.taxonomyVersion
    };
  }

  function classifyScenarioText(text = '', options = {}) {
    return evaluateScenarioCompetition(text, options).classification;
  }

  function buildScenarioLens(classification = {}, fallback = null) {
    const family = classification?.familyKey ? familyByKey[classification.familyKey] || null : null;
    const hintKey = normaliseHintKey(classification?.lensKey || classification?.key || fallback);
    const profile = family
      ? getOperationalLensProfile(family, hintKey)
      : (lensProfileByKey[hintKey] || lensProfileByKey.general || {
          key: 'general',
          label: 'General enterprise risk',
          functionKey: 'general',
          estimatePresetKey: 'general'
        });
    const secondaryFamilyKeys = Array.isArray(classification?.secondaryFamilyKeys) ? classification.secondaryFamilyKeys : [];
    const secondaryKeys = secondaryFamilyKeys
      .map((familyKey) => getOperationalLensProfile(familyByKey[familyKey] || null).key)
      .filter((key, index, values) => key && key !== profile.key && values.indexOf(key) === index)
      .slice(0, 3);
    return {
      key: profile.key,
      label: profile.label,
      functionKey: profile.functionKey,
      estimatePresetKey: profile.estimatePresetKey,
      familyKey: classification?.familyKey || profile.familyKey || '',
      secondaryKeys
    };
  }

  function areLensesCompatible(expected = '', actual = '') {
    const expectedKey = normaliseHintKey(expected);
    const actualKey = normaliseHintKey(actual);
    if (!expectedKey || !actualKey || expectedKey === 'general' || actualKey === 'general') return true;
    if (expectedKey === actualKey) return true;
    return !!(compatibilityByLensKey[expectedKey]?.has(actualKey) || compatibilityByLensKey[actualKey]?.has(expectedKey));
  }

  function humaniseTheme(value = '') {
    return String(value || '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ');
  }

  function selectPromptIdeaFamilyOrder(analysis = {}, options = {}) {
    const maxFamilies = Math.max(1, Number(options.maxFamilies || 3));
    const classification = analysis?.classification?.familyKey
      ? analysis.classification
      : (analysis?.familyKey ? analysis : null);
    const ambiguityFlags = Array.isArray(analysis?.ambiguityFlags) ? analysis.ambiguityFlags : [];
    const lowConfidence = String(analysis?.confidenceBand || classification?.confidence || '').trim().toLowerCase() === 'low';
    if (classification?.familyKey && !lowConfidence && !ambiguityFlags.includes('LOW_SEPARATION')) {
      return [classification.familyKey, ...(Array.isArray(classification.secondaryFamilyKeys) ? classification.secondaryFamilyKeys : [])]
        .filter(Boolean)
        .slice(0, maxFamilies);
    }
    return (Array.isArray(analysis?.topFamilies) ? analysis.topFamilies : [])
      .map((family) => String(family?.familyKey || '').trim())
      .filter(Boolean)
      .slice(0, maxFamilies);
  }

  function buildPromptIdeaSuggestionsForFamilyKeys(familyKeys = [], options = {}) {
    const limit = Math.max(1, Number(options.limit || 3));
    const perFamilyLimit = Math.max(1, Number(options.perFamilyLimit || (familyKeys.length > 1 ? 1 : limit)));
    const suggestions = [];
    const seen = new Set();
    (Array.isArray(familyKeys) ? familyKeys : []).forEach((familyKey) => {
      const family = familyByKey[familyKey];
      if (!family) return;
      const promptSources = family.promptIdeaTemplates?.length
        ? family.promptIdeaTemplates
        : (family.examplePhrases?.length ? family.examplePhrases : family.shortlistSeedThemes || []);
      promptSources.slice(0, perFamilyLimit).forEach((prompt, index) => {
        const cleanPrompt = String(prompt || '').trim();
        if (!cleanPrompt) return;
        const label = humaniseTheme(family.shortlistSeedThemes?.[index] || family.shortlistSeedThemes?.[0] || family.label);
        const key = label.toLowerCase() + '::' + cleanPrompt.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        suggestions.push({ label, prompt: cleanPrompt, familyKey: family.key, lensKey: family.lensKey });
      });
    });
    return suggestions.slice(0, limit);
  }

  function buildPromptIdeaSuggestions(textOrAnalysis = '', options = {}) {
    const analysis = typeof textOrAnalysis === 'string'
      ? evaluateScenarioCompetition(textOrAnalysis, options)
      : (textOrAnalysis || {});
    const familyOrder = selectPromptIdeaFamilyOrder(analysis, options);
    return buildPromptIdeaSuggestionsForFamilyKeys(familyOrder, options);
  }

  const api = Object.freeze({
    taxonomyVersion: DATA.taxonomyVersion,
    domains: Object.freeze((Array.isArray(DATA.domains) ? DATA.domains : []).slice()),
    overlays: Object.freeze(overlays.slice()),
    families: Object.freeze(families.slice()),
    activeFamilies: Object.freeze(activeFamilies.slice()),
    familyByKey,
    lensProfiles: Object.freeze(lensProfiles.slice()),
    normaliseHintKey,
    evaluateScenarioCompetition,
    classifyScenarioText,
    buildScenarioLens,
    areLensesCompatible,
    buildPromptIdeaSuggestionsForFamilyKeys,
    buildPromptIdeaSuggestions,
    detectUnsupportedSignals
  });

  globalScope.ScenarioTaxonomyProjection = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
