'use strict';

(function attachDecisionSupportModel(globalScope) {
  const ASSESSMENT_TYPE_GENERIC = 'enterprise_generic';
  const ASSESSMENT_TYPE_PROJECT_BUYER = 'project_buyer';
  const ASSESSMENT_TYPE_PROJECT_SELLER = 'project_seller';

  const VALUATION_MODE_BENCHMARK_LED = 'benchmark_led';
  const VALUATION_MODE_PROJECT_LINKED = 'project_linked';
  const VALUATION_MODE_HYBRID = 'hybrid';

  const MAX_MODEL_ARRAY_ITEMS = 20;
  const MAX_REFERENCE_ARRAY_ITEMS = 20;
  const MAX_MISSING_INPUTS = 20;
  const MAX_TEXT_LENGTH = 1600;
  const MAX_SHORT_TEXT_LENGTH = 320;
  const MAX_LOOSE_OBJECT_KEYS = 24;
  const MAX_LOOSE_DEPTH = 3;

  const VALID_ASSESSMENT_TYPES = new Set([
    ASSESSMENT_TYPE_GENERIC,
    ASSESSMENT_TYPE_PROJECT_BUYER,
    ASSESSMENT_TYPE_PROJECT_SELLER
  ]);

  const VALID_VALUATION_MODES = new Set([
    VALUATION_MODE_BENCHMARK_LED,
    VALUATION_MODE_PROJECT_LINKED,
    VALUATION_MODE_HYBRID
  ]);

  const VALID_SOURCE_STATUSES = new Set([
    'known',
    'estimated',
    'derived',
    'benchmark_proxy',
    'unknown',
    'not_applicable',
    'evidence_supported'
  ]);

  const VALID_CONFIDENCES = new Set(['high', 'medium', 'low', 'unknown']);
  const VALID_IMPORTANCE = new Set(['high', 'medium', 'low']);
  const VALID_PROJECT_FINANCIAL_EVIDENCE_STATUSES = new Set(['found', 'not_found', 'contradicted', 'unclear']);
  const VALID_DECISION_RISK_SEVERITIES = new Set(['high', 'medium', 'low']);
  const VALID_DECISION_POSTURES = new Set(['proceed', 'proceed_with_controls', 'defer', 'escalate', 'reject', 'needs_more_evidence']);
  const VALID_DECISION_CHALLENGE_DIRECTIONS = new Set(['increases_risk', 'decreases_risk', 'uncertain']);
  const VALID_STRESS_TEST_CONFIDENCES = new Set(['high', 'medium', 'low']);
  const DECISION_CHALLENGE_NUMERIC_PATCH_KEYS = new Set([
    'iterations',
    'seed',
    'threshold',
    'annualReviewThreshold',
    'tefMin',
    'tefLikely',
    'tefMax',
    'vulnMin',
    'vulnLikely',
    'vulnMax',
    'threatCapMin',
    'threatCapLikely',
    'threatCapMax',
    'controlStrMin',
    'controlStrLikely',
    'controlStrMax',
    'irMin',
    'irLikely',
    'irMax',
    'biMin',
    'biLikely',
    'biMax',
    'dbMin',
    'dbLikely',
    'dbMax',
    'rlMin',
    'rlLikely',
    'rlMax',
    'tpMin',
    'tpLikely',
    'tpMax',
    'rcMin',
    'rcLikely',
    'rcMax',
    'secProbMin',
    'secProbLikely',
    'secProbMax',
    'secMagMin',
    'secMagLikely',
    'secMagMax',
    'corrBiIr',
    'corrRlRc',
    'projectDurationMonths',
    'projectHorizonYears',
    'projectValue',
    'projectMargin'
  ]);
  const DECISION_CHALLENGE_BOOLEAN_PATCH_KEYS = new Set(['vulnDirect', 'secondaryEnabled', 'projectHorizonEnabled']);
  const DECISION_CHALLENGE_STRING_PATCH_KEYS = new Set([
    'distType',
    'assessmentType',
    'projectDurationSourceStatus',
    'projectDurationConfidence',
    'projectValueSourceStatus',
    'projectMarginSourceStatus'
  ]);

  const SOURCE_STATUS_ALIASES = Object.freeze({
    benchmark: 'benchmark_proxy',
    benchmarked: 'benchmark_proxy',
    benchmark_proxy_driver: 'benchmark_proxy',
    benchmark_proxied: 'benchmark_proxy',
    benchmarked_proxy: 'benchmark_proxy',
    proxy: 'benchmark_proxy',
    proxied: 'benchmark_proxy',
    not_applicable_driver: 'not_applicable',
    not_provided: 'unknown',
    missing: 'unknown',
    evidence: 'evidence_supported',
    supported: 'evidence_supported',
    evidence_supported_driver: 'evidence_supported'
  });

  const NUMERIC_ITEM_FIELDS = new Set([
    'amount',
    'annualizedLoss',
    'change',
    'count',
    'expected',
    'high',
    'impact',
    'likely',
    'loss',
    'low',
    'max',
    'mean',
    'min',
    'p50',
    'p90',
    'p95',
    'probability',
    'projectHorizonLoss',
    'score',
    'value',
    'weight'
  ]);

  const BOOLEAN_ITEM_FIELDS = new Set([
    'accepted',
    'applied',
    'benchmarkProxyUsed',
    'evidenceSupported',
    'needsEvidence',
    'proxyUsed',
    'selected'
  ]);

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function readField(source, field) {
    try {
      return source && typeof source === 'object' ? source[field] : undefined;
    } catch {
      return undefined;
    }
  }

  function normaliseText(value, maxLength = MAX_TEXT_LENGTH) {
    if (value === null || value === undefined) return '';
    const valueType = typeof value;
    if (!['string', 'number', 'boolean', 'bigint'].includes(valueType)) return '';
    return String(value).trim().slice(0, maxLength);
  }

  function normaliseFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }

  function normaliseNonNegativeInteger(value, fallback = 0) {
    const next = normaliseFiniteNumber(value);
    if (next === null) return fallback;
    return Math.max(0, Math.round(next));
  }

  function normaliseBoolean(value, fallback = false) {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
      const next = value.trim().toLowerCase();
      if (['true', 'yes', '1', 'y'].includes(next)) return true;
      if (['false', 'no', '0', 'n'].includes(next)) return false;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    return fallback;
  }

  function normaliseEnum(value, validValues, fallback) {
    const next = normaliseText(value).toLowerCase().replace(/[\s-]+/g, '_');
    return validValues.has(next) ? next : fallback;
  }

  function normaliseAssessmentType(value) {
    return normaliseEnum(value, VALID_ASSESSMENT_TYPES, ASSESSMENT_TYPE_GENERIC);
  }

  function normaliseValuationMode(value) {
    return normaliseEnum(value, VALID_VALUATION_MODES, VALUATION_MODE_BENCHMARK_LED);
  }

  function normaliseSourceStatus(value, fallback = 'unknown') {
    const next = normaliseText(value).toLowerCase().replace(/[\s-]+/g, '_');
    const aliased = SOURCE_STATUS_ALIASES[next] || next;
    return VALID_SOURCE_STATUSES.has(aliased) ? aliased : fallback;
  }

  function normaliseConfidence(value, fallback = 'unknown') {
    return normaliseEnum(value, VALID_CONFIDENCES, fallback);
  }

  function normaliseStringArray(value, maxItems = MAX_MODEL_ARRAY_ITEMS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(item => normaliseText(item))
      .filter(Boolean);
  }

  function normaliseLooseValue(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().slice(0, MAX_TEXT_LENGTH);
    if (typeof value === 'bigint') return String(value);
    if (Array.isArray(value)) {
      if (depth >= MAX_LOOSE_DEPTH) return [];
      return value
        .slice(0, MAX_MODEL_ARRAY_ITEMS)
        .map(item => normaliseLooseValue(item, depth + 1))
        .filter(item => item !== '' && item !== undefined);
    }
    if (isPlainObject(value)) {
      if (depth >= MAX_LOOSE_DEPTH) return {};
      const output = {};
      Object.keys(value).slice(0, MAX_LOOSE_OBJECT_KEYS).forEach(rawKey => {
        const key = normaliseText(rawKey, MAX_SHORT_TEXT_LENGTH);
        if (!key) return;
        const item = normaliseLooseValue(readField(value, rawKey), depth + 1);
        if (item === undefined || item === '') return;
        output[key] = item;
      });
      return output;
    }
    return null;
  }

  function hasUsefulReferenceObject(value) {
    return Object.keys(value).some(key => {
      const item = readField(value, key);
      return item !== '' && item !== null && item !== undefined;
    });
  }

  function normaliseReference(value) {
    if (isPlainObject(value)) {
      const output = {};
      [
        'id',
        'label',
        'title',
        'field',
        'driverId',
        'mapsTo',
        'source',
        'sourceId',
        'traceId',
        'url'
      ].forEach(field => {
        const text = normaliseText(readField(value, field), MAX_SHORT_TEXT_LENGTH);
        if (text) output[field] = text;
      });
      return hasUsefulReferenceObject(output) ? output : null;
    }
    const text = normaliseText(value, MAX_SHORT_TEXT_LENGTH);
    return text || null;
  }

  function normaliseReferenceArray(value, maxItems = MAX_REFERENCE_ARRAY_ITEMS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(normaliseReference)
      .filter(Boolean);
  }

  function normaliseMissingInput(value) {
    if (isPlainObject(value)) {
      const field = normaliseText(readField(value, 'field'), MAX_SHORT_TEXT_LENGTH);
      const label = normaliseText(readField(value, 'label'), MAX_SHORT_TEXT_LENGTH);
      const output = {
        field,
        label,
        importance: normaliseEnum(readField(value, 'importance'), VALID_IMPORTANCE, 'medium'),
        whyItMatters: normaliseText(readField(value, 'whyItMatters')),
        whoMightKnow: normaliseText(readField(value, 'whoMightKnow'), MAX_SHORT_TEXT_LENGTH),
        suggestedQuestion: normaliseText(readField(value, 'suggestedQuestion')),
        mapsTo: normaliseText(readField(value, 'mapsTo'), MAX_SHORT_TEXT_LENGTH)
      };
      if (!output.field && output.label) output.field = output.label;
      if (!output.label && output.field) output.label = output.field;
      return output.field || output.label || output.whyItMatters || output.suggestedQuestion ? output : null;
    }
    const text = normaliseText(value, MAX_SHORT_TEXT_LENGTH);
    if (!text) return null;
    return {
      field: text,
      label: text,
      importance: 'medium',
      whyItMatters: '',
      whoMightKnow: '',
      suggestedQuestion: '',
      mapsTo: ''
    };
  }

  function normaliseMissingInputs(value, maxItems = MAX_MISSING_INPUTS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(normaliseMissingInput)
      .filter(Boolean);
  }

  function normaliseQuestion(value) {
    if (isPlainObject(value)) {
      const output = {
        question: normaliseText(readField(value, 'question') || readField(value, 'text') || readField(value, 'suggestedQuestion')),
        whyItMatters: normaliseText(readField(value, 'whyItMatters') || readField(value, 'why')),
        fieldTarget: normaliseText(readField(value, 'fieldTarget') || readField(value, 'field'), MAX_SHORT_TEXT_LENGTH),
        impactIfAnswered: normaliseText(readField(value, 'impactIfAnswered') || readField(value, 'impact')),
        sourceStatus: normaliseSourceStatus(readField(value, 'sourceStatus') || readField(value, 'status')),
        confidence: normaliseConfidence(readField(value, 'confidence')),
        needsEvidence: normaliseBoolean(readField(value, 'needsEvidence'), true),
        proxyUsed: normaliseBoolean(readField(value, 'proxyUsed'), false),
        missingInputs: normaliseMissingInputs(readField(value, 'missingInputs'))
      };
      return output.question || output.fieldTarget ? output : null;
    }
    const text = normaliseText(value);
    if (!text) return null;
    return {
      question: text,
      whyItMatters: '',
      fieldTarget: '',
      impactIfAnswered: '',
      sourceStatus: 'unknown',
      confidence: 'unknown',
      needsEvidence: true,
      proxyUsed: false,
      missingInputs: []
    };
  }

  function normaliseQuestionArray(value, maxItems = MAX_MODEL_ARRAY_ITEMS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(normaliseQuestion)
      .filter(Boolean);
  }

  function normaliseSourceMetadata(value = {}, fallback = {}) {
    const source = isPlainObject(value) ? value : {};
    const fallbackSource = isPlainObject(fallback) ? fallback : {};
    const sourceStatus = normaliseSourceStatus(
      readField(source, 'sourceStatus') ?? readField(source, 'status') ?? readField(fallbackSource, 'sourceStatus') ?? readField(fallbackSource, 'status')
    );
    const confidence = normaliseConfidence(
      readField(source, 'confidence') ?? readField(fallbackSource, 'confidence')
    );
    const missingInputs = normaliseMissingInputs(
      readField(source, 'missingInputs') ?? readField(fallbackSource, 'missingInputs')
    );
    const explicitNeedsEvidence = normaliseBoolean(
      readField(source, 'needsEvidence') ?? readField(fallbackSource, 'needsEvidence'),
      null
    );
    const explicitProxyUsed = normaliseBoolean(
      readField(source, 'proxyUsed') ?? readField(source, 'benchmarkProxyUsed') ?? readField(fallbackSource, 'proxyUsed') ?? readField(fallbackSource, 'benchmarkProxyUsed'),
      null
    );
    const proxyUsed = explicitProxyUsed === null ? sourceStatus === 'benchmark_proxy' : explicitProxyUsed;
    const needsEvidence = explicitNeedsEvidence === null
      ? ['unknown', 'estimated', 'benchmark_proxy'].includes(sourceStatus) || missingInputs.length > 0
      : explicitNeedsEvidence;

    return {
      assessmentType: normaliseAssessmentType(readField(source, 'assessmentType') ?? readField(fallbackSource, 'assessmentType')),
      valuationMode: normaliseValuationMode(readField(source, 'valuationMode') ?? readField(fallbackSource, 'valuationMode')),
      projectContextSummary: normaliseText(readField(source, 'projectContextSummary') ?? readField(fallbackSource, 'projectContextSummary')),
      projectExposureRefs: normaliseReferenceArray(readField(source, 'projectExposureRefs') ?? readField(fallbackSource, 'projectExposureRefs')),
      sourceStatus,
      confidence,
      needsEvidence,
      proxyUsed,
      missingInputs
    };
  }

  function buildBase(source = {}) {
    const safeSource = isPlainObject(source) ? source : {};
    const sourceMetadata = normaliseSourceMetadata(readField(safeSource, 'sourceMetadata'), safeSource);
    return {
      assessmentType: sourceMetadata.assessmentType,
      valuationMode: sourceMetadata.valuationMode,
      projectContextSummary: sourceMetadata.projectContextSummary,
      projectExposureRefs: sourceMetadata.projectExposureRefs,
      sourceStatus: sourceMetadata.sourceStatus,
      confidence: sourceMetadata.confidence,
      proxyUsed: sourceMetadata.proxyUsed,
      needsEvidence: sourceMetadata.needsEvidence,
      missingInputs: sourceMetadata.missingInputs,
      sourceMetadata
    };
  }

  function normaliseDecisionItem(value) {
    if (!isPlainObject(value)) {
      const text = normaliseText(value);
      return text ? {
        text,
        sourceStatus: 'unknown',
        confidence: 'unknown',
        needsEvidence: true,
        proxyUsed: false,
        missingInputs: []
      } : null;
    }

    const output = {};
    Object.keys(value).slice(0, MAX_LOOSE_OBJECT_KEYS).forEach(rawKey => {
      const key = normaliseText(rawKey, MAX_SHORT_TEXT_LENGTH);
      if (!key) return;
      const raw = readField(value, rawKey);

      if (key === 'sourceMetadata') {
        output.sourceMetadata = normaliseSourceMetadata(raw, value);
        return;
      }
      if (key === 'sourceStatus' || key === 'status') {
        output.sourceStatus = normaliseSourceStatus(raw);
        return;
      }
      if (key === 'confidence') {
        output.confidence = normaliseConfidence(raw);
        return;
      }
      if (key === 'missingInputs') {
        output.missingInputs = normaliseMissingInputs(raw);
        return;
      }
      if (key === 'projectExposureRefs' || key === 'evidenceRefs' || key === 'citations' || key === 'references') {
        output[key] = normaliseReferenceArray(raw);
        return;
      }
      if (NUMERIC_ITEM_FIELDS.has(key)) {
        output[key] = normaliseFiniteNumber(raw);
        return;
      }
      if (BOOLEAN_ITEM_FIELDS.has(key)) {
        output[key] = normaliseBoolean(raw, false);
        return;
      }

      const normalised = normaliseLooseValue(raw);
      if (normalised === undefined || normalised === '') return;
      output[key] = normalised;
    });

    if (!output.sourceStatus) output.sourceStatus = normaliseSourceStatus(readField(value, 'sourceStatus') ?? readField(value, 'status'));
    if (!output.confidence) output.confidence = normaliseConfidence(readField(value, 'confidence'));
    if (!Object.prototype.hasOwnProperty.call(output, 'proxyUsed')) {
      output.proxyUsed = output.sourceStatus === 'benchmark_proxy';
    }
    if (!Object.prototype.hasOwnProperty.call(output, 'needsEvidence')) {
      output.needsEvidence = ['unknown', 'estimated', 'benchmark_proxy'].includes(output.sourceStatus);
    }
    if (!output.missingInputs) output.missingInputs = [];

    return hasUsefulReferenceObject(output) ? output : null;
  }

  function normaliseItemArray(value, maxItems = MAX_MODEL_ARRAY_ITEMS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(normaliseDecisionItem)
      .filter(Boolean);
  }

  function normaliseCitationQuality(value = {}) {
    const source = isPlainObject(value) ? value : {};
    return {
      strong: normaliseItemArray(readField(source, 'strong')),
      weak: normaliseItemArray(readField(source, 'weak')),
      decorative: normaliseItemArray(readField(source, 'decorative'))
    };
  }

  function normaliseProjectFinancialEvidenceItem(value) {
    if (!isPlainObject(value)) return null;
    const field = normaliseText(readField(value, 'field') || readField(value, 'label'), MAX_SHORT_TEXT_LENGTH);
    if (!field) return null;
    return {
      field,
      status: normaliseEnum(readField(value, 'status'), VALID_PROJECT_FINANCIAL_EVIDENCE_STATUSES, 'not_found'),
      value: normaliseText(readField(value, 'value'), MAX_SHORT_TEXT_LENGTH),
      evidenceRefs: normaliseReferenceArray(readField(value, 'evidenceRefs') || readField(value, 'citations') || readField(value, 'references')),
      commentary: normaliseText(readField(value, 'commentary') || readField(value, 'rationale'))
    };
  }

  function normaliseProjectFinancialEvidenceArray(value, maxItems = MAX_MODEL_ARRAY_ITEMS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(normaliseProjectFinancialEvidenceItem)
      .filter(Boolean);
  }

  function normaliseDecisionChallengeParameterPatch(value) {
    if (!isPlainObject(value)) return {};
    const output = {};
    Object.keys(value).slice(0, MAX_LOOSE_OBJECT_KEYS).forEach(rawKey => {
      const key = normaliseText(rawKey, MAX_SHORT_TEXT_LENGTH);
      if (!key) return;
      const raw = readField(value, rawKey);
      if (DECISION_CHALLENGE_NUMERIC_PATCH_KEYS.has(key)) {
        const number = normaliseFiniteNumber(raw);
        if (number !== null) output[key] = number;
        return;
      }
      if (DECISION_CHALLENGE_BOOLEAN_PATCH_KEYS.has(key)) {
        output[key] = normaliseBoolean(raw, false);
        return;
      }
      if (DECISION_CHALLENGE_STRING_PATCH_KEYS.has(key)) {
        const text = normaliseText(raw, MAX_SHORT_TEXT_LENGTH);
        if (!text) return;
        if (key === 'distType' && !['triangular', 'lognormal'].includes(text)) return;
        if (key.endsWith('SourceStatus') && !VALID_SOURCE_STATUSES.has(normaliseSourceStatus(text))) return;
        output[key] = text;
      }
    });
    return output;
  }

  function normaliseDecisionRisk(value) {
    if (!isPlainObject(value)) return normaliseDecisionItem(value);
    const title = normaliseText(readField(value, 'title') || readField(value, 'label'), MAX_SHORT_TEXT_LENGTH);
    const explanation = normaliseText(readField(value, 'explanation') || readField(value, 'detail') || readField(value, 'rationale'));
    const output = {
      title,
      severity: normaliseEnum(readField(value, 'severity'), VALID_DECISION_RISK_SEVERITIES, 'medium'),
      explanation,
      recommendedAction: normaliseText(readField(value, 'recommendedAction') || readField(value, 'action'))
    };
    return output.title || output.explanation || output.recommendedAction ? output : null;
  }

  function normaliseSensitivityFlag(value) {
    if (!isPlainObject(value)) return normaliseDecisionItem(value);
    const driver = normaliseText(readField(value, 'driver') || readField(value, 'field') || readField(value, 'label'), MAX_SHORT_TEXT_LENGTH);
    const whySensitive = normaliseText(readField(value, 'whySensitive') || readField(value, 'why') || readField(value, 'rationale'));
    const output = {
      driver,
      whySensitive,
      metricAffected: normaliseText(readField(value, 'metricAffected') || readField(value, 'metric') || readField(value, 'mapsTo'), MAX_SHORT_TEXT_LENGTH),
      direction: normaliseEnum(readField(value, 'direction'), VALID_DECISION_CHALLENGE_DIRECTIONS, 'uncertain'),
      sourceStatus: normaliseSourceStatus(readField(value, 'sourceStatus') || readField(value, 'status'))
    };
    return output.driver || output.whySensitive ? output : null;
  }

  function normaliseRecommendedStressTest(value, index = 0) {
    if (!isPlainObject(value)) return normaliseDecisionItem(value);
    const parameterPatch = normaliseDecisionChallengeParameterPatch(readField(value, 'parameterPatch') || readField(value, 'patch'));
    if (!Object.keys(parameterPatch).length) return null;
    const id = normaliseText(readField(value, 'id') || `stress_${index + 1}`, MAX_SHORT_TEXT_LENGTH)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || `stress_${index + 1}`;
    return {
      id,
      title: normaliseText(readField(value, 'title') || `Stress case ${index + 1}`, MAX_SHORT_TEXT_LENGTH),
      rationale: normaliseText(readField(value, 'rationale') || readField(value, 'why')),
      parameterPatch,
      expectedDecisionImpact: normaliseText(readField(value, 'expectedDecisionImpact') || readField(value, 'impact')),
      confidence: normaliseEnum(readField(value, 'confidence'), VALID_STRESS_TEST_CONFIDENCES, 'medium'),
      testsUnknownField: normaliseText(readField(value, 'testsUnknownField') || readField(value, 'field'), MAX_SHORT_TEXT_LENGTH)
    };
  }

  function normaliseChangedDecisionCondition(value) {
    if (!isPlainObject(value)) return normaliseDecisionItem(value);
    const condition = normaliseText(readField(value, 'condition') || readField(value, 'if'));
    return condition ? {
      condition,
      fromDecision: normaliseText(readField(value, 'fromDecision') || readField(value, 'from'), MAX_SHORT_TEXT_LENGTH),
      toDecision: normaliseText(readField(value, 'toDecision') || readField(value, 'to'), MAX_SHORT_TEXT_LENGTH),
      reason: normaliseText(readField(value, 'reason') || readField(value, 'why'))
    } : null;
  }

  function normaliseQuantSummary(value = {}) {
    if (!isPlainObject(value)) {
      return {
        eventLossP90: null,
        annualLossMean: null,
        annualLossP90: null,
        toleranceExceeded: false,
        annualReviewTriggered: false,
        plainEnglish: normaliseText(value)
      };
    }
    return {
      eventLossP90: normaliseFiniteNumber(readField(value, 'eventLossP90')),
      annualLossMean: normaliseFiniteNumber(readField(value, 'annualLossMean')),
      annualLossP90: normaliseFiniteNumber(readField(value, 'annualLossP90')),
      toleranceExceeded: normaliseBoolean(readField(value, 'toleranceExceeded'), false),
      annualReviewTriggered: normaliseBoolean(readField(value, 'annualReviewTriggered'), false),
      plainEnglish: normaliseText(readField(value, 'plainEnglish'))
    };
  }

  function normaliseProjectQuantSummary(value = {}) {
    if (!isPlainObject(value)) {
      return {
        projectHorizonLossMean: null,
        projectHorizonLossP90: null,
        lossAsPctOfProjectValue: null,
        lossAsPctOfMargin: null,
        primaryProjectDriver: '',
        projectInputQuality: '',
        proxyValuesUsed: [],
        unknownHighImpactInputs: [],
        plainEnglish: normaliseText(value)
      };
    }
    return {
      projectHorizonLossMean: normaliseFiniteNumber(readField(value, 'projectHorizonLossMean')),
      projectHorizonLossP90: normaliseFiniteNumber(readField(value, 'projectHorizonLossP90')),
      lossAsPctOfProjectValue: normaliseFiniteNumber(readField(value, 'lossAsPctOfProjectValue')),
      lossAsPctOfMargin: normaliseFiniteNumber(readField(value, 'lossAsPctOfMargin')),
      primaryProjectDriver: normaliseText(readField(value, 'primaryProjectDriver'), MAX_SHORT_TEXT_LENGTH),
      projectInputQuality: normaliseText(readField(value, 'projectInputQuality'), MAX_SHORT_TEXT_LENGTH),
      proxyValuesUsed: normaliseStringArray(readField(value, 'proxyValuesUsed'), MAX_REFERENCE_ARRAY_ITEMS),
      unknownHighImpactInputs: normaliseStringArray(readField(value, 'unknownHighImpactInputs'), MAX_REFERENCE_ARRAY_ITEMS),
      plainEnglish: normaliseText(readField(value, 'plainEnglish'))
    };
  }

  function normaliseBriefDriver(value) {
    if (!isPlainObject(value)) return normaliseDecisionItem(value);
    const driver = normaliseText(readField(value, 'driver') || readField(value, 'label') || readField(value, 'title'), MAX_SHORT_TEXT_LENGTH);
    const impact = normaliseText(readField(value, 'impact') || readField(value, 'rationale'));
    return driver || impact ? {
      driver,
      impact,
      evidenceStrength: normaliseEnum(readField(value, 'evidenceStrength') || readField(value, 'supportLevel'), new Set(['strong', 'partial', 'weak', 'none']), 'none'),
      sourceStatus: normaliseSourceStatus(readField(value, 'sourceStatus') || readField(value, 'status'))
    } : null;
  }

  function normaliseBriefSensitivity(value = {}) {
    if (!isPlainObject(value)) {
      return {
        summary: normaliseText(value),
        mostSensitiveAssumption: '',
        changedDecisionIf: ''
      };
    }
    return {
      summary: normaliseText(readField(value, 'summary')),
      mostSensitiveAssumption: normaliseText(readField(value, 'mostSensitiveAssumption'), MAX_SHORT_TEXT_LENGTH),
      changedDecisionIf: normaliseText(readField(value, 'changedDecisionIf'))
    };
  }

  function normaliseBriefNextAction(value = {}) {
    if (!isPlainObject(value)) {
      return {
        owner: '',
        action: normaliseText(value),
        due: '',
        controlOrTreatment: ''
      };
    }
    return {
      owner: normaliseText(readField(value, 'owner'), MAX_SHORT_TEXT_LENGTH),
      action: normaliseText(readField(value, 'action')),
      due: normaliseText(readField(value, 'due'), MAX_SHORT_TEXT_LENGTH),
      controlOrTreatment: normaliseText(readField(value, 'controlOrTreatment'), MAX_SHORT_TEXT_LENGTH)
    };
  }

  function normaliseMappedArray(value, mapper, maxItems = MAX_MODEL_ARRAY_ITEMS) {
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return values
      .slice(0, maxItems)
      .map(mapper)
      .filter(Boolean);
  }

  function normaliseAssumptionRegister(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    return {
      ...base,
      assumptions: normaliseItemArray(readField(source, 'assumptions')),
      missingEvidence: normaliseItemArray(readField(source, 'missingEvidence')),
      overallConfidence: normaliseConfidence(readField(source, 'overallConfidence') ?? base.confidence, base.confidence),
      nextBestQuestions: normaliseQuestionArray(readField(source, 'nextBestQuestions'))
    };
  }

  function normaliseParameterCoach(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    const parameterRationales = normaliseItemArray(readField(source, 'parameterRationales'));
    return {
      ...base,
      parameterRationales,
      warnings: normaliseItemArray(readField(source, 'warnings')),
      suggestedChangesCount: normaliseNonNegativeInteger(readField(source, 'suggestedChangesCount'), 0),
      missingHighImpactInputs: normaliseMissingInputs(readField(source, 'missingHighImpactInputs') ?? base.missingInputs)
    };
  }

  function normaliseEvidenceMap(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    return {
      ...base,
      supportedClaims: normaliseItemArray(readField(source, 'supportedClaims')),
      unsupportedClaims: normaliseItemArray(readField(source, 'unsupportedClaims')),
      contradictions: normaliseItemArray(readField(source, 'contradictions')),
      parameterEvidenceMap: normaliseItemArray(readField(source, 'parameterEvidenceMap')),
      projectFinancialEvidenceMap: normaliseProjectFinancialEvidenceArray(readField(source, 'projectFinancialEvidenceMap')),
      citationQuality: normaliseCitationQuality(readField(source, 'citationQuality'))
    };
  }

  function normaliseDecisionChallenge(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    return {
      ...base,
      challengeSummary: normaliseText(readField(source, 'challengeSummary')),
      decisionRisks: normaliseMappedArray(readField(source, 'decisionRisks'), normaliseDecisionRisk),
      sensitivityFlags: normaliseMappedArray(readField(source, 'sensitivityFlags'), normaliseSensitivityFlag),
      missingEvidence: normaliseStringArray(readField(source, 'missingEvidence')),
      recommendedStressTests: normaliseMappedArray(readField(source, 'recommendedStressTests'), normaliseRecommendedStressTest),
      changedDecisionIf: normaliseMappedArray(readField(source, 'changedDecisionIf'), normaliseChangedDecisionCondition)
    };
  }

  function normaliseDecisionBrief(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    const confidence = normaliseConfidence(readField(source, 'confidence') ?? base.confidence, base.confidence);
    return {
      ...base,
      recommendation: normaliseText(readField(source, 'recommendation')),
      decisionPosture: normaliseEnum(readField(source, 'decisionPosture'), VALID_DECISION_POSTURES, 'needs_more_evidence'),
      why: normaliseText(readField(source, 'why')),
      quantSummary: normaliseQuantSummary(readField(source, 'quantSummary')),
      projectQuantSummary: normaliseProjectQuantSummary(readField(source, 'projectQuantSummary')),
      mainDrivers: normaliseMappedArray(readField(source, 'mainDrivers'), normaliseBriefDriver),
      sensitivity: normaliseBriefSensitivity(readField(source, 'sensitivity')),
      evidence: normaliseItemArray(readField(source, 'evidence')),
      openChallenges: normaliseItemArray(readField(source, 'openChallenges')),
      nextAction: normaliseBriefNextAction(readField(source, 'nextAction')),
      confidence,
      sparseDataWarning: normaliseText(readField(source, 'sparseDataWarning')),
      sourceMetadata: {
        ...base.sourceMetadata,
        confidence
      }
    };
  }

  function normaliseStressCases(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    return {
      ...base,
      cases: normaliseItemArray(readField(source, 'cases'))
    };
  }

  function auditText(value, maxLength = MAX_SHORT_TEXT_LENGTH) {
    const text = normaliseText(value, maxLength);
    if (!text) return '';
    if (/\b(system|developer|assistant|user)\s*prompt\b/i.test(text)) return '';
    if (/\bprior\s*messages?\b|\braw\s*messages?\b|\bchat\s*messages?\b/i.test(text)) return '';
    return text;
  }

  function addAuditItem(target, value, extra = {}) {
    if (!Array.isArray(target)) return;
    const text = auditText(
      isPlainObject(value)
        ? readField(value, 'text')
          || readField(value, 'label')
          || readField(value, 'title')
          || readField(value, 'statement')
          || readField(value, 'claim')
          || readField(value, 'field')
          || readField(value, 'driver')
          || readField(value, 'item')
          || readField(value, 'summary')
        : value
    );
    if (!text) return;
    const key = text.toLowerCase();
    if (target.some(item => auditText(readField(item, 'text') || item).toLowerCase() === key)) return;
    target.push({
      text,
      ...extra
    });
  }

  function addAuditItems(target, values, extra = {}, maxItems = MAX_MODEL_ARRAY_ITEMS) {
    const list = Array.isArray(values) ? values : values === null || values === undefined ? [] : [values];
    list.slice(0, maxItems).forEach(item => addAuditItem(target, item, extra));
  }

  function hasFallbackSignal(value = {}) {
    if (!isPlainObject(value)) return false;
    const mode = normaliseText(readField(value, 'mode') || readField(value, 'sourceMode') || readField(value, 'runtimeMode') || readField(value, 'source')).toLowerCase();
    const quality = normaliseText(readField(value, 'aiQualityState') || readField(value, 'guidedDraftSource') || readField(value, 'draftNarrativeSource')).toLowerCase();
    return normaliseBoolean(readField(value, 'fallbackUsed') ?? readField(value, 'usedFallback') ?? readField(value, 'aiUnavailable'), false)
      || /fallback|deterministic/.test(mode)
      || /fallback|deterministic/.test(quality);
  }

  function resolveAuditAssessmentType(source = {}, assessment = {}) {
    return normaliseAssessmentType(
      readField(source, 'assessmentType')
      ?? readField(assessment, 'assessmentType')
      ?? readField(readField(assessment, 'projectFraming') || {}, 'assessmentType')
      ?? readField(readField(assessment, 'results') || {}, 'runConfig')?.assessmentType
    );
  }

  function auditAssessmentLabel(type = ASSESSMENT_TYPE_GENERIC) {
    if (type === ASSESSMENT_TYPE_PROJECT_BUYER) return 'Project buyer assessment';
    if (type === ASSESSMENT_TYPE_PROJECT_SELLER) return 'Project seller assessment';
    return 'Generic enterprise assessment';
  }

  function resolveAuditCollection(source = {}, assessment = {}, key = '') {
    const direct = readField(source, key);
    if (isPlainObject(direct) || Array.isArray(direct)) return direct;
    return readField(assessment, key);
  }

  function countRisksFiltered(source = {}, assessment = {}) {
    const explicit = normaliseFiniteNumber(readField(source, 'risksFiltered') ?? readField(assessment, 'risksFiltered'));
    if (explicit !== null) return Math.max(0, Math.round(explicit));
    const shortlistCoherence = readField(source, 'shortlistCoherence') || readField(assessment, 'shortlistCoherence') || {};
    const filtered = normaliseNonNegativeInteger(readField(shortlistCoherence, 'filteredOutCount'), 0);
    const blocked = normaliseNonNegativeInteger(readField(shortlistCoherence, 'blockedCount'), 0);
    const weak = normaliseNonNegativeInteger(readField(shortlistCoherence, 'weakOverlayOnlyCount'), 0);
    if (filtered || blocked || weak) return filtered + blocked + weak;
    const candidates = Array.isArray(readField(assessment, 'riskCandidates')) ? assessment.riskCandidates : [];
    const selected = Array.isArray(readField(assessment, 'selectedRiskIds'))
      ? assessment.selectedRiskIds
      : (Array.isArray(readField(assessment, 'selectedRisks')) ? assessment.selectedRisks : []);
    return Math.max(0, candidates.length - selected.length);
  }

  function buildAiAuditStoryFromContext(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const assessment = isPlainObject(readField(source, 'assessment'))
      ? readField(source, 'assessment')
      : (isPlainObject(readField(source, 'draft')) ? readField(source, 'draft') : source);
    const assessmentType = resolveAuditAssessmentType(source, assessment);
    const valuationMode = normaliseValuationMode(
      readField(source, 'valuationMode')
      ?? readField(assessment, 'step4ValuationMode')
      ?? readField(resolveAuditCollection(source, assessment, 'projectExposure') || {}, 'valuationMode')
    );
    const projectExposure = isPlainObject(resolveAuditCollection(source, assessment, 'projectExposure'))
      ? resolveAuditCollection(source, assessment, 'projectExposure')
      : {};
    const assumptionRegister = isPlainObject(resolveAuditCollection(source, assessment, 'assumptionRegister'))
      ? resolveAuditCollection(source, assessment, 'assumptionRegister')
      : {};
    const parameterCoach = isPlainObject(resolveAuditCollection(source, assessment, 'parameterCoach'))
      ? resolveAuditCollection(source, assessment, 'parameterCoach')
      : {};
    const evidenceMap = isPlainObject(resolveAuditCollection(source, assessment, 'evidenceMap'))
      ? resolveAuditCollection(source, assessment, 'evidenceMap')
      : {};
    const decisionChallenge = isPlainObject(resolveAuditCollection(source, assessment, 'decisionChallenge'))
      ? resolveAuditCollection(source, assessment, 'decisionChallenge')
      : (isPlainObject(readField(assessment, 'decisionChallenge')) ? assessment.decisionChallenge : {});
    const decisionBrief = isPlainObject(resolveAuditCollection(source, assessment, 'decisionBrief'))
      ? resolveAuditCollection(source, assessment, 'decisionBrief')
      : {};
    const projectFraming = isPlainObject(readField(source, 'projectFraming'))
      ? readField(source, 'projectFraming')
      : (isPlainObject(readField(assessment, 'projectFraming')) ? assessment.projectFraming : {});
    const scenarioLens = isPlainObject(readField(assessment, 'scenarioLens')) ? assessment.scenarioLens : {};
    const structuredScenario = isPlainObject(readField(assessment, 'structuredScenario')) ? assessment.structuredScenario : {};
    const projectContext = isPlainObject(readField(assessment, 'projectContext')) ? assessment.projectContext : {};

    const humanEdits = [];
    const evidenceUsed = [];
    const openWarnings = [];
    const projectEconomicsUsed = [];
    const proxyValuesUsed = [];
    const unknownsCarriedForward = [];

    addAuditItems(humanEdits, readField(source, 'humanEdits'));
    addAuditItems(evidenceUsed, readField(source, 'evidenceUsed'));
    addAuditItems(openWarnings, readField(source, 'openWarnings'));
    addAuditItems(projectEconomicsUsed, readField(source, 'projectEconomicsUsed'));
    addAuditItems(proxyValuesUsed, readField(source, 'proxyValuesUsed'), { sourceStatus: 'benchmark_proxy', proxyUsed: true });
    addAuditItems(unknownsCarriedForward, readField(source, 'unknownsCarriedForward'), { sourceStatus: 'unknown' });

    const assessmentInputMeta = [
      source,
      assessment,
      projectExposure,
      assumptionRegister,
      parameterCoach,
      evidenceMap,
      decisionChallenge,
      decisionBrief,
      readField(assessment, 'decisionBriefMeta') || {},
      readField(assessment, 'decisionChallengeMeta') || {}
    ];
    const fallbackUsed = assessmentInputMeta.some(hasFallbackSignal)
      || normaliseBoolean(readField(source, 'fallbackUsed'), false)
      || normaliseBoolean(readField(assessment, 'llmFallbackUsed'), false);

    if (normaliseText(readField(assessment, 'enhancedNarrative')) && normaliseText(readField(assessment, 'enhancedNarrative')) !== normaliseText(readField(assessment, 'narrative'))) {
      addAuditItem(humanEdits, 'Scenario narrative was edited or enhanced after the initial draft.');
    }
    if (normaliseText(readField(assessment, 'aiQualityState')).toLowerCase() === 'analyst-reshaped') {
      addAuditItem(humanEdits, 'Analyst materially reshaped the AI-assisted draft.');
    }
    addAuditItems(humanEdits, readField(source, 'userEdits') ?? readField(source, 'humanEdits') ?? readField(assessment, 'humanEdits'));

    addAuditItems(evidenceUsed, readField(assessment, 'primaryGrounding'), { sourceStatus: 'evidence_supported' });
    addAuditItems(evidenceUsed, readField(assessment, 'supportingReferences'), { sourceStatus: 'evidence_supported' });
    addAuditItems(evidenceUsed, readField(assessment, 'citations'), { sourceStatus: 'evidence_supported' });
    addAuditItems(evidenceUsed, readField(evidenceMap, 'supportedClaims'), { sourceStatus: 'evidence_supported' });
    addAuditItems(evidenceUsed, readField(readField(evidenceMap, 'citationQuality') || {}, 'strong'), { sourceStatus: 'evidence_supported' });
    (Array.isArray(readField(evidenceMap, 'projectFinancialEvidenceMap')) ? evidenceMap.projectFinancialEvidenceMap : []).forEach(item => {
      const status = normaliseText(readField(item, 'status')).toLowerCase();
      if (status === 'found') addAuditItem(evidenceUsed, `${readField(item, 'field') || 'Project financial value'} found in evidence${readField(item, 'value') ? `: ${readField(item, 'value')}` : ''}.`, { sourceStatus: 'evidence_supported' });
      if (['not_found', 'unclear', 'contradicted'].includes(status)) addAuditItem(unknownsCarriedForward, `${readField(item, 'field') || 'Project financial value'} was ${status.replace(/_/g, ' ')} in evidence.`, { sourceStatus: 'unknown' });
    });

    const drivers = Array.isArray(readField(projectExposure, 'financialDrivers')) ? projectExposure.financialDrivers : [];
    drivers.forEach(driver => {
      const label = readField(driver, 'label') || readField(driver, 'id') || 'Project financial driver';
      const status = normaliseText(readField(driver, 'driverStatus') || readField(driver, 'sourceStatus')).toLowerCase();
      addAuditItem(projectEconomicsUsed, `${label}${status ? ` (${status.replace(/_/g, ' ')})` : ''}`, {
        sourceStatus: status === 'benchmark_proxy_driver' ? 'benchmark_proxy' : status === 'unquantified_driver' ? 'unknown' : 'derived',
        confidence: normaliseConfidence(readField(driver, 'confidence'))
      });
      if (status === 'benchmark_proxy_driver') addAuditItem(proxyValuesUsed, `${label} used a benchmark proxy.`, { sourceStatus: 'benchmark_proxy', proxyUsed: true });
      if (status === 'unquantified_driver') addAuditItem(unknownsCarriedForward, `${label} remains unquantified.`, { sourceStatus: 'unknown' });
      addAuditItems(unknownsCarriedForward, readField(driver, 'missingInputs'), { sourceStatus: 'unknown' });
    });
    addAuditItems(projectEconomicsUsed, readField(projectExposure, 'capsAndOffsets'), { sourceStatus: 'derived' });
    addAuditItems(proxyValuesUsed, readField(readField(decisionBrief, 'projectQuantSummary') || {}, 'proxyValuesUsed'), { sourceStatus: 'benchmark_proxy', proxyUsed: true });
    addAuditItems(unknownsCarriedForward, readField(readField(decisionBrief, 'projectQuantSummary') || {}, 'unknownHighImpactInputs'), { sourceStatus: 'unknown' });
    addAuditItems(unknownsCarriedForward, readField(readField(projectExposure, 'projectInputQuality') || {}, 'unknownHighImpactInputs'), { sourceStatus: 'unknown' });
    addAuditItems(unknownsCarriedForward, readField(projectExposure, 'missingInputs'), { sourceStatus: 'unknown' });
    addAuditItems(unknownsCarriedForward, readField(parameterCoach, 'missingHighImpactInputs'), { sourceStatus: 'unknown' });
    addAuditItems(unknownsCarriedForward, readField(assumptionRegister, 'missingEvidence'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(projectExposure, 'doubleCountingWarnings'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(parameterCoach, 'warnings'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(evidenceMap, 'unsupportedClaims'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(evidenceMap, 'contradictions'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(decisionChallenge, 'decisionRisks'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(decisionChallenge, 'sensitivityFlags'), { sourceStatus: 'unknown' });
    addAuditItem(openWarnings, readField(decisionBrief, 'sparseDataWarning'), { sourceStatus: 'unknown' });
    addAuditItems(openWarnings, readField(readField(assessment, 'results') || {}, 'runMetadata')?.runtimeGuardrails, { sourceStatus: 'unknown' });

    (Array.isArray(readField(parameterCoach, 'parameterRationales')) ? parameterCoach.parameterRationales : []).forEach(item => {
      if (normaliseSourceStatus(readField(item, 'sourceStatus')) === 'benchmark_proxy' || normaliseText(readField(item, 'suggestionType')).toLowerCase() === 'benchmark_proxy_range') {
        addAuditItem(proxyValuesUsed, `${readField(item, 'parameterKey') || 'Parameter'} used a benchmark proxy suggestion.`, { sourceStatus: 'benchmark_proxy', proxyUsed: true });
      }
    });
    const horizon = isPlainObject(readField(readField(assessment, 'results') || {}, 'projectHorizon')) ? assessment.results.projectHorizon : {};
    ['durationSourceStatus', 'lossAsPctOfProjectValueSourceStatus', 'lossAsPctOfMarginSourceStatus'].forEach(key => {
      if (normaliseSourceStatus(readField(horizon, key)) === 'benchmark_proxy') {
        addAuditItem(proxyValuesUsed, `${key.replace(/([A-Z])/g, ' $1').replace(/ source status/i, '')} used a benchmark proxy.`, { sourceStatus: 'benchmark_proxy', proxyUsed: true });
      }
    });

    const classificationParts = [
      auditAssessmentLabel(assessmentType),
      normaliseText(readField(projectFraming, 'economicLens') || readField(projectFraming, 'primaryFinancialExposure'), 120),
      normaliseText(readField(scenarioLens, 'label') || readField(scenarioLens, 'familyLabel') || readField(structuredScenario, 'domain'), 120)
    ].filter(Boolean);
    const classification = auditText(readField(source, 'classification')) || Array.from(new Set(classificationParts)).join(' · ');
    const risksFiltered = countRisksFiltered(source, assessment);
    const aiTouched = normaliseBoolean(readField(assessment, 'llmAssisted'), false)
      || fallbackUsed
      || !!normaliseText(readField(assessment, 'guidedDraftSource'))
      || !!normaliseText(readField(projectExposure, 'projectExposureSummary'))
      || !!Object.keys(assumptionRegister).length
      || !!Object.keys(parameterCoach).length
      || !!Object.keys(evidenceMap).length
      || !!Object.keys(decisionChallenge).length
      || !!Object.keys(decisionBrief).length;
    const summary = auditText(readField(source, 'summary'))
      || (aiTouched
        ? `${classification || auditAssessmentLabel(assessmentType)} used ${fallbackUsed ? 'deterministic fallback and AI-assisted' : 'AI-assisted or deterministic'} decision support. Evidence, project economics, proxies, and unknowns are listed here without exposing raw prompts.`
        : `${auditAssessmentLabel(assessmentType)} has no saved AI decision-support outputs yet. The audit story will update as AI-assisted steps, deterministic fallbacks, evidence maps, and project exposure mapping are saved.`);

    return normaliseAiAuditStory({
      ...source,
      assessmentType,
      valuationMode,
      projectContextSummary: normaliseText(readField(projectContext, 'projectName') || readField(projectContext, 'projectDescription'), MAX_SHORT_TEXT_LENGTH),
      classification,
      fallbackUsed,
      humanEdits,
      evidenceUsed,
      risksFiltered,
      openWarnings,
      projectEconomicsUsed,
      proxyValuesUsed,
      unknownsCarriedForward,
      summary,
      sourceMetadata: {
        assessmentType,
        valuationMode,
        sourceStatus: fallbackUsed ? 'derived' : 'known',
        confidence: unknownsCarriedForward.length ? 'low' : evidenceUsed.length ? 'medium' : 'unknown',
        proxyUsed: proxyValuesUsed.length > 0,
        needsEvidence: unknownsCarriedForward.length > 0 || openWarnings.length > 0,
        missingInputs: unknownsCarriedForward.map(item => readField(item, 'text') || item).slice(0, MAX_MISSING_INPUTS)
      }
    });
  }

  function normaliseAiAuditStory(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const base = buildBase(source);
    return {
      ...base,
      classification: normaliseText(readField(source, 'classification'), MAX_SHORT_TEXT_LENGTH),
      fallbackUsed: normaliseBoolean(readField(source, 'fallbackUsed'), false),
      humanEdits: normaliseItemArray(readField(source, 'humanEdits')),
      evidenceUsed: normaliseItemArray(readField(source, 'evidenceUsed')),
      risksFiltered: normaliseNonNegativeInteger(readField(source, 'risksFiltered'), 0),
      openWarnings: normaliseItemArray(readField(source, 'openWarnings')),
      projectEconomicsUsed: normaliseItemArray(readField(source, 'projectEconomicsUsed')),
      proxyValuesUsed: normaliseItemArray(readField(source, 'proxyValuesUsed')),
      unknownsCarriedForward: normaliseItemArray(readField(source, 'unknownsCarriedForward')),
      summary: normaliseText(readField(source, 'summary'))
    };
  }

  const exported = {
    ASSESSMENT_TYPE_GENERIC,
    ASSESSMENT_TYPE_PROJECT_BUYER,
    ASSESSMENT_TYPE_PROJECT_SELLER,
    VALUATION_MODE_BENCHMARK_LED,
    VALUATION_MODE_PROJECT_LINKED,
    VALUATION_MODE_HYBRID,
    MAX_MODEL_ARRAY_ITEMS,
    MAX_MISSING_INPUTS,
    VALID_SOURCE_STATUSES: Array.from(VALID_SOURCE_STATUSES),
    VALID_CONFIDENCES: Array.from(VALID_CONFIDENCES),
    normaliseAssessmentType,
    normalizeAssessmentType: normaliseAssessmentType,
    normaliseValuationMode,
    normalizeValuationMode: normaliseValuationMode,
    normaliseSourceStatus,
    normalizeSourceStatus: normaliseSourceStatus,
    normaliseConfidence,
    normalizeConfidence: normaliseConfidence,
    normaliseSourceMetadata,
    normalizeSourceMetadata: normaliseSourceMetadata,
    buildSourceMetadata: normaliseSourceMetadata,
    normaliseMissingInput,
    normalizeMissingInput: normaliseMissingInput,
    normaliseMissingInputs,
    normalizeMissingInputs: normaliseMissingInputs,
    normaliseQuestion,
    normalizeQuestion: normaliseQuestion,
    normaliseQuestionArray,
    normalizeQuestionArray: normaliseQuestionArray,
    normaliseAssumptionRegister,
    normalizeAssumptionRegister: normaliseAssumptionRegister,
    buildAssumptionRegister: normaliseAssumptionRegister,
    normaliseParameterCoach,
    normalizeParameterCoach: normaliseParameterCoach,
    buildParameterCoach: normaliseParameterCoach,
    normaliseEvidenceMap,
    normalizeEvidenceMap: normaliseEvidenceMap,
    buildEvidenceMap: normaliseEvidenceMap,
    normaliseDecisionChallenge,
    normalizeDecisionChallenge: normaliseDecisionChallenge,
    buildDecisionChallenge: normaliseDecisionChallenge,
    normaliseDecisionBrief,
    normalizeDecisionBrief: normaliseDecisionBrief,
    buildDecisionBrief: normaliseDecisionBrief,
    normaliseStressCases,
    normalizeStressCases: normaliseStressCases,
    buildStressCases: normaliseStressCases,
    normaliseAiAuditStory,
    normalizeAiAuditStory: normaliseAiAuditStory,
    normaliseAIAuditStory: normaliseAiAuditStory,
    normalizeAIAuditStory: normaliseAiAuditStory,
    buildAiAuditStory: buildAiAuditStoryFromContext,
    buildAIAuditStory: buildAiAuditStoryFromContext
  };

  Object.assign(globalScope, exported, {
    DecisionSupportModel: exported
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
