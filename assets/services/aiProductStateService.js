(function(globalScope) {
  'use strict';

  const MODE_LABELS = Object.freeze({
    live: 'Live AI',
    deterministic_fallback: 'Deterministic fallback',
    fallback: 'Fallback',
    deterministic_preview: 'Deterministic preview',
    local_preview: 'Local preview',
    saved: 'Saved output',
    unavailable: 'AI unavailable',
    none: 'No output'
  });

  const MODE_TONES = Object.freeze({
    live: 'success',
    deterministic_fallback: 'warning',
    fallback: 'warning',
    deterministic_preview: 'neutral',
    local_preview: 'neutral',
    saved: 'neutral',
    unavailable: 'warning',
    none: 'neutral'
  });

  const STALE_CATEGORY_LABELS = Object.freeze({
    scenario: 'scenario',
    projectEconomics: 'project economics',
    projectFinancialValues: 'project financial values',
    projectFinancialMetadata: 'project financial metadata',
    projectProxyAnswers: 'project proxy answers',
    projectContext: 'project context',
    projectNarrativeContext: 'project narrative context',
    parameters: 'parameters',
    simulation: 'simulation result',
    results: 'simulation result',
    evidence: 'evidence',
    citations: 'citations',
    dependentAiOutputs: 'related AI outputs',
    businessContext: 'business context',
    adminSettings: 'admin settings',
    metadata: 'metadata'
  });

  const STALE_CATEGORY_SEVERITY = Object.freeze({
    scenario: 'critical',
    projectEconomics: 'critical',
    projectFinancialValues: 'critical',
    projectFinancialMetadata: 'review',
    projectProxyAnswers: 'review',
    projectContext: 'review',
    projectNarrativeContext: 'informational',
    parameters: 'critical',
    simulation: 'critical',
    results: 'critical',
    evidence: 'review',
    citations: 'review',
    dependentAiOutputs: 'review',
    businessContext: 'informational',
    adminSettings: 'informational',
    metadata: 'informational'
  });

  const SEVERITY_RANK = Object.freeze({
    critical: 3,
    review: 2,
    informational: 1,
    none: 0
  });

  const SEVERITY_PRESENTATION = Object.freeze({
    critical: {
      label: 'Needs refresh',
      tone: 'danger',
      actionVerb: 'Refresh'
    },
    review: {
      label: 'Review recommended',
      tone: 'warning',
      actionVerb: 'Review'
    },
    informational: {
      label: 'Context changed',
      tone: 'neutral',
      actionVerb: 'Review'
    },
    none: {
      label: 'Saved',
      tone: 'neutral',
      actionVerb: 'Review'
    }
  });

  const ARTIFACT_USEFUL_PATHS = Object.freeze({
    projectexposure: [
      'projectExposureSummary',
      'financialDrivers',
      'missingInputs',
      'doubleCountingWarnings',
      'capsAndOffsets'
    ],
    assumptionregister: [
      'assumptions',
      'missingEvidence',
      'nextBestQuestions'
    ],
    parametercoach: [
      'parameterRationales',
      'missingHighImpactInputs',
      'warnings'
    ],
    evidencemap: [
      'supportedClaims',
      'unsupportedClaims',
      'contradictions',
      'parameterEvidenceMap',
      'projectFinancialEvidenceMap',
      'citationQuality.strong',
      'citationQuality.weak',
      'citationQuality.decorative'
    ],
    decisionchallenge: [
      'challengeSummary',
      'decisionRisks',
      'sensitivityFlags',
      'recommendedStressTests',
      'changedDecisionIf'
    ],
    challengeagent: [
      'challengeSummary',
      'decisionRisks',
      'sensitivityFlags',
      'recommendedStressTests',
      'changedDecisionIf'
    ],
    decisionbrief: [
      'recommendation',
      'why',
      'mainDrivers',
      'nextAction.action',
      'quantSummary.plainEnglish',
      'projectQuantSummary.plainEnglish'
    ]
  });

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (isPlainObject(value)) {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    }
    if (typeof value === 'string') {
      return JSON.stringify(cleanText(value));
    }
    if (typeof value === 'boolean' || value === null) return JSON.stringify(value);
    return 'null';
  }

  function hashString(value = '') {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function buildFingerprint(value) {
    return hashString(stableStringify(value));
  }

  function normaliseArtifactKey(value = '') {
    return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function valueHasContent(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (isPlainObject(value)) return Object.values(value).some(valueHasContent);
    if (typeof value === 'string') return cleanText(value).length > 0;
    return value !== null && value !== undefined;
  }

  function getPathValue(source = {}, path = '') {
    return cleanText(path).split('.').filter(Boolean).reduce((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return current[key];
    }, source);
  }

  function buildFingerprintBreakdown(categories = {}) {
    const source = isPlainObject(categories) ? categories : {};
    const categoryFingerprints = {};
    Object.keys(source).sort().forEach((key) => {
      const cleanKey = cleanText(key);
      if (!cleanKey) return;
      categoryFingerprints[cleanKey] = buildFingerprint(source[key]);
    });
    return {
      fingerprint: buildFingerprint(categoryFingerprints),
      categories: categoryFingerprints
    };
  }

  function pickFields(source = {}, keys = []) {
    const input = isPlainObject(source) ? source : {};
    const output = {};
    (Array.isArray(keys) ? keys : []).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
    });
    return output;
  }

  function compactObject(source = {}) {
    const input = isPlainObject(source) ? source : {};
    const output = {};
    Object.keys(input).sort().forEach((key) => {
      const value = input[key];
      if (value === undefined) return;
      if (typeof value === 'function') return;
      output[key] = value;
    });
    return output;
  }

  function resolveScenarioInput(context = {}) {
    const source = isPlainObject(context) ? context : {};
    return {
      assessmentType: source.assessmentType || 'enterprise_generic',
      scenario: source.scenario || source.riskStatement || source.enhancedNarrative || source.narrative || source.scenarioTitle || '',
      structuredScenario: isPlainObject(source.structuredScenario) ? source.structuredScenario : {},
      scenarioLens: isPlainObject(source.scenarioLens) ? source.scenarioLens : {}
    };
  }

  function resolveBusinessContextInput(context = {}) {
    const source = isPlainObject(context) ? context : {};
    const businessUnit = isPlainObject(source.businessUnit)
      ? source.businessUnit
      : {
          id: source.buId || '',
          name: source.buName || ''
        };
    return {
      businessUnit,
      geography: source.geography || '',
      geographies: Array.isArray(source.geographies) ? source.geographies : [],
      applicableRegulations: Array.isArray(source.applicableRegulations) ? source.applicableRegulations : []
    };
  }

  function resolveEvidenceInput(context = {}) {
    const source = isPlainObject(context) ? context : {};
    return {
      citations: Array.isArray(source.citations) ? source.citations : [],
      primaryGrounding: Array.isArray(source.primaryGrounding) ? source.primaryGrounding : [],
      supportingReferences: Array.isArray(source.supportingReferences) ? source.supportingReferences : [],
      ragMatches: Array.isArray(source.ragMatches) ? source.ragMatches : []
    };
  }

  function resolveParametersInput(context = {}) {
    const source = isPlainObject(context) ? context : {};
    return {
      parameters: isPlainObject(source.parameters) ? source.parameters : (isPlainObject(source.fairParams) ? source.fairParams : {}),
      validation: isPlainObject(source.validation) ? source.validation : {}
    };
  }

  function resolveSimulationInput(context = {}) {
    const source = isPlainObject(context) ? context : {};
    const result = isPlainObject(source.simulationResult) ? source.simulationResult : (isPlainObject(source.results) ? source.results : source);
    return {
      eventLoss: result.eventLoss || result.lm || {},
      annualLoss: result.annualLoss || result.ale || {},
      projectHorizon: result.projectHorizon || {},
      toleranceDetail: result.toleranceDetail || {},
      annualReviewDetail: result.annualReviewDetail || {},
      runMetadata: result.runMetadata || source.runMetadata || {}
    };
  }

  function resolveDependentAiOutputs(context = {}, keys = []) {
    const source = isPlainObject(context) ? context : {};
    const output = {};
    (Array.isArray(keys) ? keys : []).forEach((key) => {
      output[key] = isPlainObject(source[key]) ? source[key] : {};
    });
    return output;
  }

  function resolveProjectFingerprintCategories(context = {}) {
    const source = isPlainObject(context) ? context : {};
    const projectContext = isPlainObject(source.projectContext) ? source.projectContext : {};
    const routeDetails = isPlainObject(source.projectRouteDetails) ? source.projectRouteDetails : {};
    const buyerProxy = isPlainObject(source.buyerProxyQuestions)
      ? source.buyerProxyQuestions
      : (isPlainObject(source.buyerProxyAnswers) ? source.buyerProxyAnswers : {});
    const sellerProxy = isPlainObject(source.sellerProxyQuestions)
      ? source.sellerProxyQuestions
      : (isPlainObject(source.sellerProxyAnswers) ? source.sellerProxyAnswers : {});
    return {
      projectFinancialValues: {
        buyerEconomics: compactObject(source.buyerEconomics),
        sellerEconomics: compactObject(source.sellerEconomics)
      },
      projectFinancialMetadata: {
        buyerEconomicsMeta: compactObject(source.buyerEconomicsMeta),
        sellerEconomicsMeta: compactObject(source.sellerEconomicsMeta)
      },
      projectProxyAnswers: {
        buyerProxyQuestions: compactObject(buyerProxy),
        sellerProxyQuestions: compactObject(sellerProxy)
      },
      projectContext: pickFields(projectContext, [
        'projectRole',
        'projectStage',
        'contractType',
        'currency',
        'projectDurationMonths',
        'projectHorizonYears',
        'criticalMilestoneDate',
        'strategicImportance'
      ]),
      projectNarrativeContext: {
        ...pickFields(projectContext, [
          'projectName',
          'projectDescription',
          'supplierName',
          'vendorName',
          'contractorName',
          'customerName',
          'mainConsequence',
          'notes'
        ]),
        ...pickFields(routeDetails, [
          'supplierName',
          'vendorName',
          'contractorName',
          'customerName',
          'mainConsequence',
          'notes'
        ])
      }
    };
  }

  function buildProjectExposureFingerprintSnapshot(context = {}) {
    return buildFingerprintBreakdown({
      scenario: resolveScenarioInput(context),
      ...resolveProjectFingerprintCategories(context),
      citations: Array.isArray(context?.citations) ? context.citations : [],
      businessContext: resolveBusinessContextInput(context)
    });
  }

  function buildAssumptionRegisterFingerprintSnapshot(context = {}) {
    return buildFingerprintBreakdown({
      scenario: resolveScenarioInput(context),
      ...resolveProjectFingerprintCategories(context),
      parameters: resolveParametersInput(context),
      simulation: resolveSimulationInput(context),
      evidence: resolveEvidenceInput(context),
      dependentAiOutputs: resolveDependentAiOutputs(context, ['projectExposure'])
    });
  }

  function buildParameterCoachFingerprintSnapshot(context = {}) {
    return buildFingerprintBreakdown({
      scenario: resolveScenarioInput(context),
      ...resolveProjectFingerprintCategories(context),
      parameters: resolveParametersInput(context),
      evidence: resolveEvidenceInput(context),
      dependentAiOutputs: resolveDependentAiOutputs(context, ['projectExposure', 'assumptionRegister', 'evidenceMap']),
      businessContext: resolveBusinessContextInput(context)
    });
  }

  function buildEvidenceMapFingerprintSnapshot(context = {}) {
    return buildFingerprintBreakdown({
      scenario: resolveScenarioInput(context),
      ...resolveProjectFingerprintCategories(context),
      parameters: resolveParametersInput(context),
      evidence: resolveEvidenceInput(context),
      dependentAiOutputs: resolveDependentAiOutputs(context, ['assumptionRegister']),
      businessContext: resolveBusinessContextInput(context)
    });
  }

  function buildDecisionChallengeFingerprintSnapshot(context = {}) {
    return buildFingerprintBreakdown({
      scenario: resolveScenarioInput(context),
      ...resolveProjectFingerprintCategories(context),
      parameters: resolveParametersInput(context),
      simulation: resolveSimulationInput(context),
      dependentAiOutputs: resolveDependentAiOutputs(context, ['projectExposure', 'assumptionRegister', 'parameterCoach', 'evidenceMap'])
    });
  }

  function buildDecisionBriefFingerprintSnapshot(context = {}) {
    return buildFingerprintBreakdown({
      scenario: resolveScenarioInput(context),
      ...resolveProjectFingerprintCategories(context),
      simulation: resolveSimulationInput(context),
      dependentAiOutputs: resolveDependentAiOutputs(context, ['projectExposure', 'assumptionRegister', 'parameterCoach', 'evidenceMap', 'decisionChallenge'])
    });
  }

  function normaliseFingerprintCategories(categories = {}) {
    if (!isPlainObject(categories)) return {};
    const output = {};
    Object.entries(categories).forEach(([key, value]) => {
      const cleanKey = cleanText(key);
      const cleanValue = cleanText(value);
      if (!cleanKey || !cleanValue) return;
      output[cleanKey] = cleanValue;
    });
    return output;
  }

  function normaliseFingerprintSnapshot(value, fallbackFingerprint = '') {
    if (isPlainObject(value)) {
      const categories = normaliseFingerprintCategories(value.categories || value.breakdown || {});
      const fingerprint = cleanText(value.fingerprint || value.inputFingerprint || '')
        || (Object.keys(categories).length ? buildFingerprint(categories) : cleanText(fallbackFingerprint));
      return { fingerprint, categories };
    }
    return {
      fingerprint: cleanText(value || fallbackFingerprint),
      categories: {}
    };
  }

  function resolveChangedCategories(savedSnapshot = {}, currentSnapshot = {}) {
    const savedCategories = normaliseFingerprintCategories(savedSnapshot.categories);
    const currentCategories = normaliseFingerprintCategories(currentSnapshot.categories);
    const savedKeys = Object.keys(savedCategories);
    const currentKeys = Object.keys(currentCategories);
    if (!savedKeys.length || !currentKeys.length) return [];
    const keys = Array.from(new Set([...savedKeys, ...currentKeys])).sort();
    return keys.filter((key) => cleanText(savedCategories[key]) !== cleanText(currentCategories[key]));
  }

  function resolveStaleSeverity(changedCategories = [], fallback = 'critical') {
    const changes = Array.isArray(changedCategories) ? changedCategories : [];
    return changes.reduce((current, category) => {
      const next = STALE_CATEGORY_SEVERITY[category] || 'review';
      return SEVERITY_RANK[next] > SEVERITY_RANK[current] ? next : current;
    }, changes.length ? 'none' : fallback);
  }

  function labelChangedCategories(changedCategories = []) {
    return (Array.isArray(changedCategories) ? changedCategories : [])
      .map((category) => STALE_CATEGORY_LABELS[category] || humanizeCategory(category))
      .filter(Boolean);
  }

  function humanizeCategory(value = '') {
    return cleanText(value)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .toLowerCase();
  }

  function buildStaleReason(outputLabel = 'AI output', severity = 'critical', changedLabels = []) {
    const labels = Array.isArray(changedLabels) ? changedLabels.filter(Boolean) : [];
    const subject = cleanText(outputLabel) || 'AI output';
    if (labels.length) {
      const listed = labels.length === 1
        ? labels[0]
        : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
      if (severity === 'critical') return `${subject} should be refreshed because ${listed} changed.`;
      if (severity === 'review') return `Review ${subject} because ${listed} changed.`;
      return `${subject} has newer context from ${listed}.`;
    }
    return `${subject} no longer matches the current inputs.`;
  }

  function normaliseMode(value = '', { usedFallback = false, aiUnavailable = false, hasOutput = false } = {}) {
    const mode = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (aiUnavailable) return usedFallback || hasOutput ? 'deterministic_fallback' : 'unavailable';
    if (mode === 'live_ai' || mode === 'ai_live' || mode === 'ai') return 'live';
    if (mode === 'deterministic' || mode === 'deterministic_fallback') return 'deterministic_fallback';
    if (mode === 'fallback') return 'fallback';
    if (mode === 'preview' || mode === 'deterministic_preview') return 'deterministic_preview';
    if (mode === 'local' || mode === 'local_preview') return 'local_preview';
    if (usedFallback) return 'deterministic_fallback';
    if (mode && MODE_LABELS[mode]) return mode;
    return hasOutput ? 'saved' : 'none';
  }

  function getModeLabel(mode = 'none') {
    return MODE_LABELS[mode] || MODE_LABELS.none;
  }

  function getModeTone(mode = 'none') {
    return MODE_TONES[mode] || 'neutral';
  }

  function formatGeneratedAt(value = '') {
    const generatedAt = cleanText(value);
    if (!generatedAt) return '';
    const date = new Date(generatedAt);
    if (!Number.isFinite(date.getTime())) return generatedAt;
    const ageMs = Date.now() - date.getTime();
    if (ageMs >= 0 && ageMs < 60000) return 'Just now';
    if (ageMs >= 0 && ageMs < 3600000) return `${Math.max(1, Math.round(ageMs / 60000))}m ago`;
    if (ageMs >= 0 && ageMs < 86400000) return `${Math.max(1, Math.round(ageMs / 3600000))}h ago`;
    return date.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
  }

  function hasUsefulOutput(value, artifactKey = '') {
    if (!isPlainObject(value)) return false;
    const usefulPaths = ARTIFACT_USEFUL_PATHS[normaliseArtifactKey(artifactKey)] || [];
    if (usefulPaths.length) {
      return usefulPaths.some((path) => valueHasContent(getPathValue(value, path)));
    }
    const ignored = new Set([
      'mode',
      'sourceMode',
      'usedFallback',
      'aiUnavailable',
      'generatedAt',
      'inputFingerprint',
      'inputFingerprintBreakdown',
      'fingerprintBreakdown',
      'workflowFingerprint',
      'sourceMetadata'
    ]);
    return Object.entries(value).some(([key, item]) => {
      if (ignored.has(key)) return false;
      if (Array.isArray(item)) return item.length > 0;
      if (isPlainObject(item)) return Object.keys(item).length > 0;
      if (typeof item === 'string') return cleanText(item).length > 0;
      return item !== null && item !== undefined;
    });
  }

  function resolveFreshness({
    hasOutput,
    savedFingerprint = '',
    currentFingerprint = '',
    savedFingerprintBreakdown = null,
    currentFingerprintBreakdown = null,
    sourceMode = '',
    outputLabel = 'AI output'
  } = {}) {
    if (!hasOutput) {
      return {
        status: 'empty',
        label: 'No output',
        tone: 'neutral',
        refreshRecommended: true
      };
    }
    const savedSnapshot = normaliseFingerprintSnapshot(savedFingerprintBreakdown, savedFingerprint);
    const currentSnapshot = normaliseFingerprintSnapshot(currentFingerprintBreakdown, currentFingerprint);
    const saved = cleanText(savedSnapshot.fingerprint || savedFingerprint);
    const current = cleanText(currentSnapshot.fingerprint || currentFingerprint);
    if (saved && current && saved !== current) {
      const staleCategories = resolveChangedCategories(savedSnapshot, currentSnapshot);
      const freshnessSeverity = resolveStaleSeverity(staleCategories, 'critical');
      const presentation = SEVERITY_PRESENTATION[freshnessSeverity] || SEVERITY_PRESENTATION.critical;
      const staleCategoryLabels = labelChangedCategories(staleCategories);
      return {
        status: 'stale',
        label: presentation.label,
        tone: presentation.tone,
        refreshRecommended: true,
        severity: freshnessSeverity,
        staleCategories,
        staleCategoryLabels,
        refreshReason: buildStaleReason(outputLabel, freshnessSeverity, staleCategoryLabels)
      };
    }
    if (saved && current && saved === current) {
      return {
        status: 'fresh',
        label: 'Fresh',
        tone: 'success',
        refreshRecommended: false,
        severity: 'none',
        staleCategories: [],
        staleCategoryLabels: []
      };
    }
    if (sourceMode === 'deterministic_preview' || sourceMode === 'local_preview') {
      return {
        status: 'preview',
        label: 'Preview',
        tone: 'neutral',
        refreshRecommended: false,
        severity: 'none',
        staleCategories: [],
        staleCategoryLabels: []
      };
    }
    return {
      status: 'saved',
      label: 'Saved',
      tone: 'neutral',
      refreshRecommended: false,
      severity: 'none',
      staleCategories: [],
      staleCategoryLabels: []
    };
  }

  function buildAiOutputState({
    key = '',
    label = '',
    output = null,
    meta = null,
    currentFingerprint = '',
    currentFingerprintBreakdown = null,
    hasOutput
  } = {}) {
    const outputObject = isPlainObject(output) ? output : {};
    const metaObject = isPlainObject(meta) ? meta : {};
    const outputLabel = cleanText(label || key || 'AI output');
    const stateKey = cleanText(key || outputLabel).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const useful = typeof hasOutput === 'boolean' ? hasOutput : hasUsefulOutput(outputObject, key || outputLabel);
    const usedFallback = outputObject.usedFallback === true || metaObject.usedFallback === true;
    const aiUnavailable = outputObject.aiUnavailable === true || metaObject.aiUnavailable === true;
    const mode = normaliseMode(outputObject.sourceMode || outputObject.mode || metaObject.mode || '', {
      usedFallback,
      aiUnavailable,
      hasOutput: useful
    });
    const savedFingerprint = cleanText(outputObject.inputFingerprint || metaObject.inputFingerprint || outputObject.workflowFingerprint || metaObject.workflowFingerprint || '');
    const savedFingerprintBreakdown = outputObject.inputFingerprintBreakdown || metaObject.inputFingerprintBreakdown || outputObject.fingerprintBreakdown || metaObject.fingerprintBreakdown || null;
    const currentSnapshot = isPlainObject(currentFingerprint)
      ? currentFingerprint
      : currentFingerprintBreakdown;
    const freshness = resolveFreshness({
      hasOutput: useful,
      savedFingerprint,
      currentFingerprint,
      savedFingerprintBreakdown,
      currentFingerprintBreakdown: currentSnapshot,
      sourceMode: mode,
      outputLabel
    });
    const generatedAt = cleanText(outputObject.generatedAt || metaObject.generatedAt || '');
    const recommendedAction = freshness.status === 'stale'
      ? `${(SEVERITY_PRESENTATION[freshness.severity] || SEVERITY_PRESENTATION.critical).actionVerb} ${outputLabel}`
      : !useful
        ? `Generate ${outputLabel}`
        : `Review ${outputLabel}`;
    const refreshReason = freshness.status === 'stale'
      ? (freshness.refreshReason || `${outputLabel} no longer matches the current inputs.`)
      : !useful
        ? `${outputLabel} has not been generated yet.`
        : '';
    return {
      key: stateKey,
      label: outputLabel,
      hasOutput: useful,
      mode,
      modeLabel: getModeLabel(mode),
      modeTone: getModeTone(mode),
      usedFallback,
      aiUnavailable,
      generatedAt,
      generatedLabel: formatGeneratedAt(generatedAt),
      inputFingerprint: savedFingerprint,
      inputFingerprintBreakdown: normaliseFingerprintSnapshot(savedFingerprintBreakdown, savedFingerprint),
      currentFingerprint: cleanText(isPlainObject(currentFingerprint) ? currentFingerprint.fingerprint : currentFingerprint),
      currentFingerprintBreakdown: normaliseFingerprintSnapshot(currentSnapshot, isPlainObject(currentFingerprint) ? currentFingerprint.fingerprint : currentFingerprint),
      freshnessStatus: freshness.status,
      freshnessLabel: freshness.label,
      freshnessTone: freshness.tone,
      freshnessSeverity: freshness.severity || 'none',
      staleCategories: freshness.staleCategories || [],
      staleCategoryLabels: freshness.staleCategoryLabels || [],
      refreshRecommended: freshness.refreshRecommended,
      refreshReason,
      recommendedAction
    };
  }

  function buildAiJourneyState(outputs = []) {
    const states = (Array.isArray(outputs) ? outputs : []).filter(Boolean);
    const hasOutput = states.some((item) => item.hasOutput);
    const stale = states.filter((item) => item.freshnessStatus === 'stale');
    const empty = states.filter((item) => !item.hasOutput);
    const live = states.filter((item) => item.mode === 'live');
    const fallback = states.filter((item) => item.mode === 'deterministic_fallback' || item.mode === 'fallback');
    const unavailable = states.filter((item) => item.aiUnavailable);
    const criticalStale = stale.filter((item) => item.freshnessSeverity === 'critical');
    const reviewStale = stale.filter((item) => item.freshnessSeverity === 'review');
    const informationalStale = stale.filter((item) => item.freshnessSeverity === 'informational');
    const fresh = states.filter((item) => item.freshnessStatus === 'fresh');
    const saved = states.filter((item) => item.freshnessStatus === 'saved' || item.freshnessStatus === 'preview');
    const recommended = criticalStale[0] || reviewStale[0] || stale[0] || empty[0] || states.find((item) => item.refreshRecommended) || null;
    const modeLabel = !hasOutput
      ? 'No AI outputs'
      : live.length && fallback.length
        ? 'Mixed AI/fallback'
        : live.length
          ? 'Live AI'
          : fallback.length
            ? 'Deterministic fallback'
            : 'Saved support outputs';
    const tone = criticalStale.length ? 'danger' : stale.length || unavailable.length || fallback.length ? 'warning' : live.length ? 'success' : 'neutral';
    const summaryLabel = `${fresh.length + saved.length} fresh · ${stale.length} stale · ${empty.length} not generated`;
    return {
      outputs: states,
      hasOutput,
      staleCount: stale.length,
      criticalStaleCount: criticalStale.length,
      reviewStaleCount: reviewStale.length,
      informationalStaleCount: informationalStale.length,
      emptyCount: empty.length,
      freshCount: fresh.length,
      savedCount: saved.length,
      liveCount: live.length,
      fallbackCount: fallback.length,
      unavailableCount: unavailable.length,
      modeLabel,
      tone,
      summaryLabel,
      recommendedAction: recommended?.recommendedAction || 'Review AI support',
      recommendedKey: recommended?.key || '',
      recommendedReason: recommended?.refreshReason || ''
    };
  }

  function splitCurrentFingerprint(currentFingerprints = {}, key = '') {
    const value = isPlainObject(currentFingerprints) ? currentFingerprints[key] : '';
    if (isPlainObject(value)) {
      return {
        currentFingerprint: value.fingerprint || '',
        currentFingerprintBreakdown: value
      };
    }
    return {
      currentFingerprint: value || '',
      currentFingerprintBreakdown: null
    };
  }

  function buildAssessmentAiState(assessment = {}, { currentFingerprints = {} } = {}) {
    const projectExposureFingerprint = splitCurrentFingerprint(currentFingerprints, 'projectExposure');
    const assumptionRegisterFingerprint = splitCurrentFingerprint(currentFingerprints, 'assumptionRegister');
    const parameterCoachFingerprint = splitCurrentFingerprint(currentFingerprints, 'parameterCoach');
    const evidenceMapFingerprint = splitCurrentFingerprint(currentFingerprints, 'evidenceMap');
    const decisionChallengeFingerprint = splitCurrentFingerprint(currentFingerprints, 'decisionChallenge');
    const decisionBriefFingerprint = splitCurrentFingerprint(currentFingerprints, 'decisionBrief');
    const outputs = [
      buildAiOutputState({
        key: 'projectExposure',
        label: 'Project exposure map',
        output: assessment.projectExposure,
        meta: assessment.projectExposureMeta,
        ...projectExposureFingerprint
      }),
      buildAiOutputState({
        key: 'assumptionRegister',
        label: 'Assumption Register',
        output: assessment.assumptionRegister,
        meta: assessment.assumptionRegisterMeta,
        ...assumptionRegisterFingerprint
      }),
      buildAiOutputState({
        key: 'parameterCoach',
        label: 'Parameter Coach',
        output: assessment.parameterCoach,
        meta: assessment.parameterCoachMeta,
        ...parameterCoachFingerprint
      }),
      buildAiOutputState({
        key: 'evidenceMap',
        label: 'Evidence Map',
        output: assessment.evidenceMap,
        meta: assessment.evidenceMapMeta,
        ...evidenceMapFingerprint
      }),
      buildAiOutputState({
        key: 'decisionChallenge',
        label: 'Challenge Agent',
        output: assessment.decisionChallenge,
        meta: assessment.decisionChallengeMeta,
        ...decisionChallengeFingerprint
      }),
      buildAiOutputState({
        key: 'decisionBrief',
        label: 'Decision Brief',
        output: assessment.decisionBrief,
        meta: assessment.decisionBriefMeta,
        ...decisionBriefFingerprint
      })
    ];
    return buildAiJourneyState(outputs);
  }

  const api = {
    buildFingerprint,
    buildFingerprintBreakdown,
    buildProjectExposureFingerprintSnapshot,
    buildAssumptionRegisterFingerprintSnapshot,
    buildParameterCoachFingerprintSnapshot,
    buildEvidenceMapFingerprintSnapshot,
    buildDecisionChallengeFingerprintSnapshot,
    buildDecisionBriefFingerprintSnapshot,
    stableStringify,
    normaliseMode,
    getModeLabel,
    getModeTone,
    hasUsefulOutput,
    buildAiOutputState,
    buildAiJourneyState,
    buildAssessmentAiState,
    formatGeneratedAt
  };

  globalScope.AiProductStateService = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
