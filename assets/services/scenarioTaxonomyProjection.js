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
  const EXTRA_HINT_ALIASES = Object.freeze({
    technology: 'cyber',
    cyber: 'cyber',
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
    'business-continuity': 'business-continuity',
    esg: 'esg',
    hse: 'hse',
    strategic: 'strategic',
    geopolitical: 'strategic',
    'transformation delivery': 'transformation-delivery',
    'transformation-delivery': 'transformation-delivery',
    'physical security': 'physical-security',
    'physical-security': 'physical-security',
    'ot resilience': 'ot-resilience',
    'ot-resilience': 'ot-resilience',
    'ai-model-risk': 'general',
    'data-governance': 'compliance',
    privacy: 'compliance',
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
    const haystackTokens = Array.from(new Set(
      (String(haystack || '').toLowerCase().match(/[a-z0-9]+/g) || [])
        .map(stemToken)
        .filter((token) => token.length >= 4)
    ));
    return meaningfulTokens.every((token) => haystackTokens.some((haystackToken) => {
      if (haystackToken === token) return true;
      const shorter = haystackToken.length <= token.length ? haystackToken : token;
      const longer = shorter === haystackToken ? token : haystackToken;
      return shorter.length >= 6 && longer.startsWith(shorter);
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
      score: eventScore + (Number(family.priorityScore || 0) / 100),
      strongPositiveMatchCount,
      qualified: !blockedByRequiredSignals && !blockedByAntiSignals && !blockedByExplicitDisclosureRule && eventMatches.length > 0 && eventScore >= 2
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

  function classifyScenarioText(text = '', options = {}) {
    const haystack = normaliseText(text);
    const hintKey = normaliseHintKey(options.scenarioLensHint);
    const unsupportedSignals = detectUnsupportedSignals(haystack);
    if (!haystack) {
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
        matchedAntiSignals: [],
        ambiguityFlags: ['WEAK_EVENT_PATH'],
        unsupportedSignals,
        taxonomyVersion: DATA.taxonomyVersion
      };
    }
    const evaluations = activeFamilies.map((family) => buildFamilyEvaluation(family, haystack));
    const qualified = evaluations.filter((evaluation) => evaluation.qualified).sort((left, right) => right.score - left.score);
    const primaryEvaluation = applyPrecedenceRules(qualified[0] || null, qualified, haystack);
    const ambiguous = qualified.length > 1 && Math.abs((qualified[0]?.score || 0) - (qualified[1]?.score || 0)) < 1.25;
    if (!primaryEvaluation) {
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
        matchedAntiSignals: evaluations.flatMap((evaluation) => evaluation.antiMatches).slice(0, 6),
        ambiguityFlags: ['WEAK_EVENT_PATH'],
        unsupportedSignals,
        taxonomyVersion: DATA.taxonomyVersion
      };
    }

    const primaryFamily = primaryEvaluation.family;
    const secondaryFamilyKeys = deriveSecondaryFamilies(primaryEvaluation, qualified);
    const secondaryKeys = secondaryFamilyKeys
      .map((familyKey) => familyByKey[familyKey])
      .map((family) => String(family?.legacyKey || '').trim())
      .filter((key, index, values) => key && key !== primaryFamily.legacyKey && values.indexOf(key) === index)
      .slice(0, 3);

    return {
      familyKey: primaryFamily.key,
      familyLabel: primaryFamily.label,
      domain: primaryFamily.domain,
      legacyKey: primaryFamily.legacyKey,
      key: primaryFamily.legacyKey,
      lensKey: primaryFamily.lensKey,
      lensLabel: primaryFamily.lensLabel,
      functionKey: primaryFamily.functionKey,
      estimatePresetKey: primaryFamily.estimatePresetKey,
      secondaryFamilyKeys,
      secondaryKeys,
      confidence: primaryEvaluation.score >= 6 ? 'high' : primaryEvaluation.score >= 3 ? 'medium' : 'low',
      matchedSignals: primaryEvaluation.eventMatches.length ? primaryEvaluation.eventMatches : primaryEvaluation.positiveMatches,
      matchedAntiSignals: primaryEvaluation.antiMatches,
      ambiguityFlags: [
        ...(ambiguous ? ['MIXED_DOMAIN_SIGNALS'] : []),
        ...(primaryEvaluation.score < 3 ? ['LOW_PRIMARY_CONFIDENCE'] : []),
        ...(primaryEvaluation.eventMatches.length === 0 ? ['CONSEQUENCE_HEAVY_TEXT'] : [])
      ],
      unsupportedSignals,
      taxonomyVersion: DATA.taxonomyVersion
    };
  }

  function buildScenarioLens(classification = {}, fallback = null) {
    const hintKey = normaliseHintKey(classification?.lensKey || classification?.key || fallback);
    const profile = lensProfileByKey[hintKey] || lensProfileByKey.general || {
      key: 'general',
      label: 'General enterprise risk',
      functionKey: 'general',
      estimatePresetKey: 'general'
    };
    const secondaryFamilyKeys = Array.isArray(classification?.secondaryFamilyKeys) ? classification.secondaryFamilyKeys : [];
    const secondaryKeys = secondaryFamilyKeys
      .map((familyKey) => familyByKey[familyKey]?.lensKey)
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

  function buildPromptIdeaSuggestions(text = '', options = {}) {
    const classification = classifyScenarioText(text, options);
    const familyOrder = [classification.familyKey, ...(Array.isArray(classification.secondaryFamilyKeys) ? classification.secondaryFamilyKeys : [])].filter(Boolean);
    const suggestions = [];
    const seen = new Set();
    familyOrder.forEach((familyKey) => {
      const family = familyByKey[familyKey];
      if (!family) return;
      const promptSources = family.promptIdeaTemplates?.length
        ? family.promptIdeaTemplates
        : (family.examplePhrases?.length ? family.examplePhrases : family.shortlistSeedThemes || []);
      promptSources.forEach((prompt, index) => {
        const cleanPrompt = String(prompt || '').trim();
        if (!cleanPrompt) return;
        const label = humaniseTheme(family.shortlistSeedThemes?.[index] || family.shortlistSeedThemes?.[0] || family.label);
        const key = label.toLowerCase() + '::' + cleanPrompt.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        suggestions.push({ label, prompt: cleanPrompt, familyKey: family.key, lensKey: family.lensKey });
      });
    });
    return suggestions.slice(0, Math.max(1, Number(options.limit || 3)));
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
    classifyScenarioText,
    buildScenarioLens,
    areLensesCompatible,
    buildPromptIdeaSuggestions,
    detectUnsupportedSignals
  });

  globalScope.ScenarioTaxonomyProjection = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
