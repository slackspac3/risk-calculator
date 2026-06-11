'use strict';

(function attachProjectParameterSuggestionService(globalScope) {
  const VALUATION_MODES = new Set(['benchmark_led', 'project_linked', 'hybrid']);
  const NUMERIC_DRIVER_STATUSES = new Set(['calculated_driver', 'estimated_driver', 'benchmark_proxy_driver']);
  const UNKNOWN_SOURCES = new Set(['unknown', 'not_provided']);
  const COACH_NUMERIC_SUGGESTION_TYPES = new Set(['project_derived_range', 'benchmark_proxy_range']);

  const BUCKET_MAP = Object.freeze({
    incidentResponse: {
      label: 'Incident response',
      minKey: 'irMin',
      likelyKey: 'irLikely',
      maxKey: 'irMax'
    },
    businessInterruption: {
      label: 'Business interruption',
      minKey: 'biMin',
      likelyKey: 'biLikely',
      maxKey: 'biMax'
    },
    dataRemediation: {
      label: 'Data remediation',
      minKey: 'dbMin',
      likelyKey: 'dbLikely',
      maxKey: 'dbMax'
    },
    regulatoryLegal: {
      label: 'Regulatory and legal',
      minKey: 'rlMin',
      likelyKey: 'rlLikely',
      maxKey: 'rlMax'
    },
    thirdParty: {
      label: 'Third-party impact',
      minKey: 'tpMin',
      likelyKey: 'tpLikely',
      maxKey: 'tpMax'
    },
    reputationContract: {
      label: 'Reputation and contract',
      minKey: 'rcMin',
      likelyKey: 'rcLikely',
      maxKey: 'rcMax'
    },
    secondaryLoss: {
      label: 'Secondary loss magnitude',
      minKey: 'secMagMin',
      likelyKey: 'secMagLikely',
      maxKey: 'secMagMax'
    }
  });

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normaliseRange(low, likely, high) {
    const values = [finiteNumber(low), finiteNumber(likely), finiteNumber(high)];
    if (values.some(value => value === null)) return null;
    const ordered = values.map(value => Math.max(0, value)).sort((a, b) => a - b);
    return {
      low: ordered[0],
      likely: ordered[1],
      high: ordered[2]
    };
  }

  function normaliseCoachRange(range = {}) {
    if (!isPlainObject(range)) return null;
    return normaliseRange(range.min ?? range.low, range.likely, range.max ?? range.high);
  }

  function rangeFromParams(params = {}, bucket = '') {
    const mapping = BUCKET_MAP[bucket];
    if (!mapping) return null;
    return normaliseRange(params[mapping.minKey], params[mapping.likelyKey], params[mapping.maxKey]);
  }

  function normaliseValuationMode(value = '', fallback = 'benchmark_led') {
    const next = cleanText(value).toLowerCase();
    return VALUATION_MODES.has(next) ? next : fallback;
  }

  function getDefaultValuationMode(assessmentType = '', explicitMode = '') {
    const explicit = normaliseValuationMode(explicitMode, '');
    if (explicit) return explicit;
    const type = cleanText(assessmentType).toLowerCase();
    if (type === 'project_buyer' || type === 'project_seller') return 'hybrid';
    return 'benchmark_led';
  }

  function getDriverSourceStatus(driver = {}) {
    const status = cleanText(driver.driverStatus).toLowerCase();
    const source = cleanText(driver.source).toLowerCase();
    if (UNKNOWN_SOURCES.has(source)) return 'unknown';
    if (status === 'benchmark_proxy_driver') return 'benchmark_proxy';
    if (status === 'estimated_driver') return 'estimated';
    if (status === 'calculated_driver') {
      if (source === 'project_exposure_mapper') return 'derived';
      if (source === 'evidence_supported' || source === 'document') return 'evidence_supported';
      return 'known';
    }
    if (status === 'not_applicable_driver') return 'not_applicable';
    return 'unknown';
  }

  function isNumericSourceStatus(sourceStatus = '') {
    return ['known', 'estimated', 'derived', 'evidence_supported', 'benchmark_proxy'].includes(sourceStatus);
  }

  function normaliseMapsTo(mapsTo) {
    const source = Array.isArray(mapsTo) ? mapsTo : [mapsTo];
    const seen = new Set();
    return source
      .map(item => cleanText(item))
      .filter(bucket => bucket && BUCKET_MAP[bucket])
      .filter(bucket => {
        if (seen.has(bucket)) return false;
        seen.add(bucket);
        return true;
      });
  }

  function normaliseMissingInput(item = {}, projectMissingInputs = []) {
    const raw = isPlainObject(item) ? item : { field: cleanText(item), label: cleanText(item) };
    const field = cleanText(raw.field || raw.label);
    const matched = projectMissingInputs.find(input => {
      if (!isPlainObject(input)) return false;
      const inputField = cleanText(input.field || input.label).toLowerCase();
      return inputField && inputField === field.toLowerCase();
    }) || {};
    return {
      field,
      label: cleanText(raw.label || matched.label || field),
      importance: cleanText(raw.importance || matched.importance || 'high') || 'high',
      whyItMatters: cleanText(raw.whyItMatters || matched.whyItMatters || 'This input is needed before project exposure can be quantified without false precision.'),
      whoMightKnow: cleanText(raw.whoMightKnow || matched.whoMightKnow || 'Assessment owner'),
      suggestedQuestion: cleanText(raw.suggestedQuestion || matched.suggestedQuestion || `Can you confirm ${cleanText(raw.label || matched.label || field).toLowerCase() || 'this project input'}?`)
    };
  }

  function getSuggestionGapSeverity(projectRange, currentRange) {
    if (!projectRange || !currentRange) return 'unknown';
    const currentLikely = finiteNumber(currentRange.likely);
    const projectLikely = finiteNumber(projectRange.likely);
    if (currentLikely === null || projectLikely === null) return 'unknown';
    if (currentLikely === 0 && projectLikely > 0) return 'major';
    if (currentLikely <= 0) return 'unknown';
    const ratio = projectLikely / currentLikely;
    if (ratio >= 2 || ratio <= 0.5) return 'major';
    if (ratio >= 1.4 || ratio <= 0.75) return 'moderate';
    return 'minor';
  }

  function buildSuggestionId(driver, bucket, type, index) {
    const driverId = cleanText(driver.id || driver.label || `driver-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${type}::${bucket}::${driverId || index}`;
  }

  function deriveParameterSuggestionsFromProjectExposure(projectExposure = {}, currentParams = {}) {
    const exposure = isPlainObject(projectExposure) ? projectExposure : {};
    const drivers = Array.isArray(exposure.financialDrivers) ? exposure.financialDrivers.filter(isPlainObject) : [];
    const projectMissingInputs = Array.isArray(exposure.missingInputs) ? exposure.missingInputs : [];
    const suggestions = [];

    drivers.forEach((driver, index) => {
      const mapsTo = normaliseMapsTo(driver.mapsTo);
      if (!mapsTo.length) return;
      const sourceStatus = getDriverSourceStatus(driver);
      const driverStatus = cleanText(driver.driverStatus).toLowerCase();
      const range = normaliseRange(driver.low, driver.likely, driver.high);
      const missingInputs = (Array.isArray(driver.missingInputs) ? driver.missingInputs : [])
        .map(item => normaliseMissingInput(item, projectMissingInputs))
        .filter(item => item.field || item.label);

      mapsTo.forEach(bucket => {
        const bucketInfo = BUCKET_MAP[bucket];
        const base = {
          bucket,
          bucketLabel: bucketInfo.label,
          mappedFields: [bucketInfo.minKey, bucketInfo.likelyKey, bucketInfo.maxKey],
          sourceDriverId: cleanText(driver.id || ''),
          sourceDriver: cleanText(driver.label || driver.id || bucketInfo.label),
          sourceStatus,
          driverStatus,
          confidence: cleanText(driver.confidence || 'unknown') || 'unknown',
          rationale: cleanText(driver.rationale || ''),
          currentRange: rangeFromParams(currentParams, bucket)
        };

        if (driverStatus === 'not_applicable_driver' || sourceStatus === 'not_applicable') {
          suggestions.push({
            ...base,
            id: buildSuggestionId(driver, bucket, 'not_applicable', index),
            suggestionType: 'not_applicable',
            projectRange: null,
            missingInputs,
            suggestedActions: ['mark not applicable'],
            canApply: false
          });
          return;
        }

        if (NUMERIC_DRIVER_STATUSES.has(driverStatus) && isNumericSourceStatus(sourceStatus) && range) {
          const suggestionType = sourceStatus === 'benchmark_proxy' ? 'benchmark_proxy_range' : 'project_derived_range';
          suggestions.push({
            ...base,
            id: buildSuggestionId(driver, bucket, suggestionType, index),
            suggestionType,
            projectRange: range,
            missingInputs: [],
            suggestedActions: suggestionType === 'benchmark_proxy_range' ? ['use benchmark proxy', 'upload evidence'] : ['apply project-derived range'],
            gapSeverity: getSuggestionGapSeverity(range, base.currentRange),
            canApply: true
          });
          return;
        }

        const gapInputs = missingInputs.length
          ? missingInputs
          : [normaliseMissingInput({ field: cleanText(driver.missingInputs?.[0] || driver.label || bucketInfo.label) }, projectMissingInputs)];
        suggestions.push({
          ...base,
          id: buildSuggestionId(driver, bucket, 'parameter_gap', index),
          suggestionType: 'parameter_gap',
          projectRange: null,
          missingInputs: gapInputs,
          suggestedActions: ['ask owner', 'upload evidence', 'use benchmark proxy', 'run stress case'],
          gapSeverity: 'unknown',
          canApply: false
        });
        suggestions.push({
          ...base,
          id: buildSuggestionId(driver, bucket, 'stress_case_candidate', index),
          suggestionType: 'stress_case_candidate',
          projectRange: null,
          missingInputs: gapInputs,
          suggestedActions: ['run stress case'],
          gapSeverity: 'unknown',
          canApply: false
        });
      });
    });

    return suggestions;
  }

  function applyProjectParameterSuggestion(currentParams = {}, suggestion = {}) {
    const params = { ...(isPlainObject(currentParams) ? currentParams : {}) };
    if (!isPlainObject(suggestion) || suggestion.canApply !== true) {
      return { params, applied: false, appliedFields: [], reason: 'not_applicable' };
    }
    const range = isPlainObject(suggestion.projectRange)
      ? normaliseRange(suggestion.projectRange.low, suggestion.projectRange.likely, suggestion.projectRange.high)
      : null;
    const fields = Array.isArray(suggestion.mappedFields) ? suggestion.mappedFields : [];
    if (!range || fields.length < 3) {
      return { params, applied: false, appliedFields: [], reason: 'invalid_range' };
    }
    const [minKey, likelyKey, maxKey] = fields;
    if (![minKey, likelyKey, maxKey].every(key => typeof key === 'string' && key)) {
      return { params, applied: false, appliedFields: [], reason: 'invalid_mapping' };
    }
    params[minKey] = range.low;
    params[likelyKey] = range.likely;
    params[maxKey] = range.high;
    return {
      params,
      applied: true,
      appliedFields: [minKey, likelyKey, maxKey],
      range
    };
  }

  function applyParameterCoachSuggestion(currentParams = {}, rationale = {}) {
    const params = { ...(isPlainObject(currentParams) ? currentParams : {}) };
    if (!isPlainObject(rationale)) {
      return { params, applied: false, appliedFields: [], reason: 'invalid_suggestion' };
    }
    const suggestionType = cleanText(rationale.suggestionType).toLowerCase();
    if (!COACH_NUMERIC_SUGGESTION_TYPES.has(suggestionType)) {
      return { params, applied: false, appliedFields: [], reason: 'not_numeric_suggestion' };
    }
    const parameterKey = cleanText(rationale.parameterKey);
    const mapping = BUCKET_MAP[parameterKey];
    if (!mapping) {
      return { params, applied: false, appliedFields: [], reason: 'invalid_parameter_key' };
    }
    const range = normaliseCoachRange(rationale.suggestedRange);
    if (!range) {
      return { params, applied: false, appliedFields: [], reason: 'invalid_range' };
    }
    params[mapping.minKey] = range.low;
    params[mapping.likelyKey] = range.likely;
    params[mapping.maxKey] = range.high;
    return {
      params,
      applied: true,
      appliedFields: [mapping.minKey, mapping.likelyKey, mapping.maxKey],
      range,
      parameterKey
    };
  }

  const exported = {
    BUCKET_MAP,
    getDefaultValuationMode,
    normaliseValuationMode,
    deriveParameterSuggestionsFromProjectExposure,
    applyProjectParameterSuggestion,
    applyParameterCoachSuggestion
  };

  Object.assign(globalScope, {
    ProjectParameterSuggestionService: exported,
    deriveParameterSuggestionsFromProjectExposure,
    applyProjectParameterSuggestion,
    applyParameterCoachSuggestion
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
