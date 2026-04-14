'use strict';

const OrgIntelligenceService = (() => {
  const CACHE_KEY_PREFIX = 'rq_org_intelligence_cache::';
  const LEGACY_CACHE_KEY = 'rq_org_intelligence_cache';
  const DEFAULT_AI_FEEDBACK_TUNING = Object.freeze({
    alignmentPriority: 'strict',
    draftStyle: 'executive-brief',
    shortlistDiscipline: 'strict',
    learningSensitivity: 'balanced'
  });
  const DEFAULT_STATE = Object.freeze({
    patterns: [],
    calibration: { updatedAt: 0, scenarioTypes: {} },
    decisions: [],
    coverageMap: { updatedAt: 0, scenarioTypes: {} },
    feedback: { updatedAt: 0, events: [] },
    updatedAt: 0
  });
  const RATIO_BOUNDED_FIELDS = new Set([
    'tefMin', 'tefLikely', 'tefMax',
    'threatCapMin', 'threatCapLikely', 'threatCapMax',
    'controlStrMin', 'controlStrLikely', 'controlStrMax',
    'vulnMin', 'vulnLikely', 'vulnMax'
  ]);
  let _memoryState = _clone(DEFAULT_STATE);
  let _memoryCacheKey = '';
  let _refreshPromise = null;

  function resolveOrgIntelligenceApiUrl(path) {
    const resolver = (typeof window !== 'undefined' && window?.ApiOriginResolver)
      || globalThis?.ApiOriginResolver
      || null;
    return resolver && typeof resolver.resolveApiUrl === 'function'
      ? resolver.resolveApiUrl(path)
      : '';
  }

  function _clone(value, fallback = null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return fallback;
    }
  }

  function _getCacheKey() {
    const username = typeof AuthService !== 'undefined' && AuthService && typeof AuthService.getCurrentUser === 'function'
      ? String(AuthService.getCurrentUser()?.username || '').trim().toLowerCase()
      : '';
    return `${CACHE_KEY_PREFIX}${username || 'anonymous'}`;
  }

  function _safeGetCache() {
    try {
      const raw = localStorage.getItem(_getCacheKey()) || localStorage.getItem(LEGACY_CACHE_KEY);
      if (!raw) return _clone(DEFAULT_STATE, {
        patterns: [],
        calibration: { updatedAt: 0, scenarioTypes: {} },
        decisions: [],
        coverageMap: { updatedAt: 0, scenarioTypes: {} },
        feedback: { updatedAt: 0, events: [] },
        updatedAt: 0
      });
      const parsed = JSON.parse(raw);
      return _normaliseState(parsed);
    } catch {
      return _clone(DEFAULT_STATE, {
        patterns: [],
        calibration: { updatedAt: 0, scenarioTypes: {} },
        decisions: [],
        coverageMap: { updatedAt: 0, scenarioTypes: {} },
        feedback: { updatedAt: 0, events: [] },
        updatedAt: 0
      });
    }
  }

  function _saveCache(state) {
    const next = _normaliseState(state);
    _memoryState = next;
    _memoryCacheKey = _getCacheKey();
    try {
      localStorage.setItem(_getCacheKey(), JSON.stringify(next));
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch {}
    return next;
  }

  function clearCache({ allUsers = false } = {}) {
    _memoryState = _clone(DEFAULT_STATE);
    _memoryCacheKey = '';
    try {
      localStorage.removeItem(_getCacheKey());
      localStorage.removeItem(LEGACY_CACHE_KEY);
      if (allUsers && typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
        const keys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (String(key || '').startsWith(CACHE_KEY_PREFIX)) keys.push(key);
        }
        keys.forEach(key => localStorage.removeItem(key));
      }
    } catch {}
  }

  function _normaliseScenarioKey(value) {
    return String(value || 'general').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general';
  }

  function _safeText(value, max = 240) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function _toNumber(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function _normalisePattern(pattern = {}) {
    return {
      id: _safeText(pattern.id || pattern.assessmentId || `pattern_${Date.now()}`, 120),
      assessmentId: _safeText(pattern.assessmentId || pattern.id, 120),
      buId: _safeText(pattern.buId, 80),
      buName: _safeText(pattern.buName, 160),
      functionKey: _safeText(pattern.functionKey || '', 80).toLowerCase(),
      scenarioLens: pattern?.scenarioLens && typeof pattern.scenarioLens === 'object'
        ? {
            key: _normaliseScenarioKey(pattern.scenarioLens.key || 'general'),
            label: _safeText(pattern.scenarioLens.label || 'General enterprise risk', 120),
            functionKey: _safeText(pattern.scenarioLens.functionKey || pattern.functionKey || '', 80).toLowerCase()
          }
        : null,
      title: _safeText(pattern.title, 220),
      scenarioType: _safeText(pattern.scenarioType, 220),
      geography: _safeText(pattern.geography, 120),
      narrative: _safeText(pattern.narrative, 800),
      guidedInput: pattern?.guidedInput && typeof pattern.guidedInput === 'object'
        ? {
            event: _safeText(pattern.guidedInput.event, 220),
            asset: _safeText(pattern.guidedInput.asset, 160),
            cause: _safeText(pattern.guidedInput.cause, 220),
            impact: _safeText(pattern.guidedInput.impact, 220),
            urgency: _safeText(pattern.guidedInput.urgency, 40)
          }
        : {},
      selectedRiskTitles: Array.isArray(pattern.selectedRiskTitles)
        ? pattern.selectedRiskTitles.map(item => _safeText(item, 160)).filter(Boolean).slice(0, 6)
        : [],
      applicableRegulations: Array.isArray(pattern.applicableRegulations)
        ? pattern.applicableRegulations.map(item => _safeText(item, 120)).filter(Boolean).slice(0, 8)
        : [],
      posture: _safeText(pattern.posture, 60),
      confidenceLabel: _safeText(pattern.confidenceLabel || 'Moderate confidence', 120),
      topGap: _safeText(pattern.topGap, 220),
      keyRecommendation: _safeText(pattern.keyRecommendation, 220),
      completedAt: Number(pattern.completedAt || Date.now()),
      submittedBy: _safeText(pattern.submittedBy, 120).toLowerCase()
    };
  }

  function _normaliseDecision(decision = {}) {
    return {
      id: _safeText(decision.id || `decision_${Date.now()}`, 120),
      assessmentId: _safeText(decision.assessmentId, 120),
      buId: _safeText(decision.buId, 80),
      buName: _safeText(decision.buName, 160),
      scenarioLensKey: _normaliseScenarioKey(decision.scenarioLensKey || decision.lensKey || decision.scenarioType || 'general'),
      scenarioLensLabel: _safeText(decision.scenarioLensLabel || decision.scenarioType || 'General enterprise risk', 160),
      scenarioTitle: _safeText(decision.scenarioTitle, 220),
      decision: _safeText(decision.decision, 80).toLowerCase(),
      reviewNote: _safeText(decision.reviewNote, 280),
      challengedAssumption: _safeText(decision.challengedAssumption || decision.reviewNote, 280),
      reviewedBy: _safeText(decision.reviewedBy, 120).toLowerCase(),
      reviewedAt: Number(decision.reviewedAt || Date.now()),
      submittedAt: Number(decision.submittedAt || 0),
      p90Loss: Number(decision.p90Loss || 0),
      aleMean: Number(decision.aleMean || 0)
    };
  }

  function _normaliseReasonTag(value = '') {
    return _safeText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function _normaliseRuntimeMode(value = '') {
    const raw = _safeText(value, 40).toLowerCase();
    if (raw === 'live_ai' || raw === 'live-ai' || raw === 'live') return 'live_ai';
    if (raw === 'fallback' || raw === 'stub') return 'fallback';
    return 'local';
  }

  function _normaliseFeedbackTarget(value = '') {
    const raw = _safeText(value, 40).toLowerCase();
    if (raw === 'shortlist') return 'shortlist';
    if (raw === 'risk' || raw === 'risk-card' || raw === 'risk_card') return 'risk';
    return 'draft';
  }

  function _normaliseAiFeedbackTuning(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const pick = (input, allowed, fallback) => {
      const safe = _safeText(input, 40).toLowerCase();
      return allowed.includes(safe) ? safe : fallback;
    };
    return {
      alignmentPriority: pick(source.alignmentPriority, ['strict', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.alignmentPriority),
      draftStyle: pick(source.draftStyle, ['executive-brief', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.draftStyle),
      shortlistDiscipline: pick(source.shortlistDiscipline, ['strict', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.shortlistDiscipline),
      learningSensitivity: pick(source.learningSensitivity, ['conservative', 'balanced', 'accelerated'], DEFAULT_AI_FEEDBACK_TUNING.learningSensitivity)
    };
  }

  function _getActiveAiFeedbackTuning(settings = null) {
    const resolvedSettings = settings && typeof settings === 'object'
      ? settings
      : (typeof getEffectiveSettings === 'function'
          ? getEffectiveSettings()
          : (typeof getAdminSettings === 'function' ? getAdminSettings() : null));
    return _normaliseAiFeedbackTuning(resolvedSettings?.aiFeedbackTuning || DEFAULT_AI_FEEDBACK_TUNING);
  }

  function _normaliseFeedbackTitleList(list = [], limit = 10, max = 160) {
    return Array.from(new Set(
      (Array.isArray(list) ? list : [])
        .map(item => _safeText(item, max))
        .filter(Boolean)
    )).slice(0, limit);
  }

  function _normaliseFeedbackCitationList(list = []) {
    return (Array.isArray(list) ? list : [])
      .map(item => ({
        docId: _safeText(item?.docId || item?.id || '', 120),
        title: _safeText(item?.title || item?.sourceTitle || '', 180),
        tags: _normaliseFeedbackTitleList(item?.tags, 8, 60)
      }))
      .filter(item => item.docId || item.title)
      .slice(0, 8);
  }

  function _normaliseFeedbackEvent(event = {}) {
    const score = Math.max(1, Math.min(5, Math.round(Number(event.score || 0))));
    return {
      id: _safeText(event.id || `feedback_${Date.now()}`, 120),
      target: _normaliseFeedbackTarget(event.target),
      recordedAt: Number(event.recordedAt || Date.now()),
      runtimeMode: _normaliseRuntimeMode(event.runtimeMode),
      buId: _safeText(event.buId, 80),
      buName: _safeText(event.buName, 160),
      functionKey: _safeText(event.functionKey, 80).toLowerCase(),
      lensKey: _normaliseScenarioKey(event.lensKey || event.scenarioLensKey || event.scenarioType || 'general'),
      score,
      reasons: Array.from(new Set((Array.isArray(event.reasons) ? event.reasons : []).map(_normaliseReasonTag).filter(Boolean))).slice(0, 6),
      scenarioFingerprint: _safeText(event.scenarioFingerprint, 260),
      outputFingerprint: _safeText(event.outputFingerprint, 260),
      riskId: _safeText(event.riskId, 120),
      riskTitle: _safeText(event.riskTitle, 180),
      riskCategory: _safeText(event.riskCategory, 90),
      riskSource: _safeText(event.riskSource, 40),
      selectedInAssessment: event.selectedInAssessment === true ? true : event.selectedInAssessment === false ? false : null,
      shownRiskTitles: _normaliseFeedbackTitleList(event.shownRiskTitles, 10),
      keptRiskTitles: _normaliseFeedbackTitleList(event.keptRiskTitles, 10),
      removedRiskTitles: _normaliseFeedbackTitleList(event.removedRiskTitles, 10),
      addedRiskTitles: _normaliseFeedbackTitleList(event.addedRiskTitles, 10),
      citations: _normaliseFeedbackCitationList(event.citations),
      submittedBy: _safeText(event.submittedBy, 120).toLowerCase()
    };
  }

  function _normaliseState(state) {
    const source = state && typeof state === 'object' ? state : {};
    return {
      patterns: Array.isArray(source.patterns) ? source.patterns.map(_normalisePattern).filter(item => item.assessmentId) : [],
      calibration: source.calibration && typeof source.calibration === 'object'
        ? {
            updatedAt: Number(source.calibration.updatedAt || 0),
            scenarioTypes: source.calibration.scenarioTypes && typeof source.calibration.scenarioTypes === 'object'
              ? source.calibration.scenarioTypes
              : {}
          }
        : { updatedAt: 0, scenarioTypes: {} },
      decisions: Array.isArray(source.decisions) ? source.decisions.map(_normaliseDecision).filter(item => item.assessmentId && item.decision) : [],
      coverageMap: source.coverageMap && typeof source.coverageMap === 'object'
        ? {
            updatedAt: Number(source.coverageMap.updatedAt || 0),
            scenarioTypes: source.coverageMap.scenarioTypes && typeof source.coverageMap.scenarioTypes === 'object'
              ? source.coverageMap.scenarioTypes
              : {}
          }
        : { updatedAt: 0, scenarioTypes: {} },
      feedback: source.feedback && typeof source.feedback === 'object'
        ? {
            updatedAt: Number(source.feedback.updatedAt || 0),
            events: Array.isArray(source.feedback.events)
              ? source.feedback.events.map(_normaliseFeedbackEvent).filter(item => item.score >= 1 && item.score <= 5).slice(0, 600)
              : []
          }
        : { updatedAt: 0, events: [] },
      updatedAt: Number(source.updatedAt || 0)
    };
  }

  function getCachedState() {
    const cacheKey = _getCacheKey();
    if (_memoryCacheKey !== cacheKey) {
      _memoryState = _clone(DEFAULT_STATE);
      _memoryCacheKey = cacheKey;
    }
    if (!_memoryState?.updatedAt && typeof localStorage !== 'undefined') {
      _memoryState = _safeGetCache();
    }
    return _normaliseState(_memoryState);
  }

  function _buildHeaders() {
    const token = typeof AuthService !== 'undefined' && typeof AuthService.getApiSessionToken === 'function'
      ? AuthService.getApiSessionToken()
      : '';
    return token ? { 'x-session-token': token } : {};
  }

  function _canUseSharedOrgIntelligence() {
    const hasAuthService = typeof AuthService !== 'undefined' && AuthService;
    const sessionToken = hasAuthService && typeof AuthService.getApiSessionToken === 'function'
      ? AuthService.getApiSessionToken()
      : '';
    const isAdmin = hasAuthService && typeof AuthService.isAdminAuthenticated === 'function'
      ? AuthService.isAdminAuthenticated()
      : true;
    return typeof AuthService !== 'undefined'
      && AuthService
      && typeof AuthService.getApiSessionToken === 'function'
      && isAdmin
      && !!sessionToken;
  }

  function _getApiUrl() {
    return resolveOrgIntelligenceApiUrl('/api/org-intelligence');
  }

  async function refresh(force = false) {
    const cached = getCachedState();
    if (!_canUseSharedOrgIntelligence()) return cached;
    const freshEnough = !force && cached.updatedAt && (Date.now() - cached.updatedAt) < 60_000;
    if (freshEnough) return cached;
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = fetch(_getApiUrl(), {
      headers: _buildHeaders()
    }).then(async response => {
      if (!response.ok) throw new Error('Org intelligence unavailable');
      const payload = await response.json();
      return _saveCache({
        patterns: payload.patterns || [],
        calibration: payload.calibration || { updatedAt: 0, scenarioTypes: {} },
        decisions: payload.decisions || [],
        coverageMap: payload.coverageMap || { updatedAt: 0, scenarioTypes: {} },
        feedback: payload.feedback || { updatedAt: 0, events: [] },
        updatedAt: Date.now()
      });
    }).catch(() => getCachedState()).finally(() => {
      _refreshPromise = null;
    });
    return _refreshPromise;
  }

  async function _post(type, payload = {}) {
    if (!_canUseSharedOrgIntelligence()) return null;
    try {
      const response = await fetch(_getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ..._buildHeaders()
        },
        body: JSON.stringify({ type, ...payload })
      });
      if (!response.ok) throw new Error('Org intelligence write failed');
      return response.json();
    } catch {
      return null;
    }
  }

  function _scenarioKeyFromSource(source = {}) {
    return _normaliseScenarioKey(
      source?.scenarioLens?.key
      || source?.scenarioKey
      || source?.scenarioLensKey
      || source?.lensKey
      || (typeof getStructuredScenarioField === 'function' ? getStructuredScenarioField(source?.structuredScenario, 'eventPath') : '')
      || source?.scenarioType
      || 'general'
    );
  }

  function _scenarioLabelFromSource(source = {}) {
    return _safeText(
      source?.scenarioLens?.label
      || source?.scenarioLabel
      || source?.scenarioLensLabel
      || (typeof getStructuredScenarioField === 'function' ? getStructuredScenarioField(source?.structuredScenario, 'eventPath') : '')
      || source?.scenarioType
      || 'General enterprise risk',
      160
    );
  }

  function _functionKeyFromSource(source = {}) {
    return _safeText(
      source?.scenarioLens?.functionKey
      || source?.functionKey
      || '',
      80
    ).toLowerCase();
  }

  function _resolveScenarioTitle(source = {}) {
    if (typeof resolveScenarioDisplayTitle === 'function') {
      const resolved = resolveScenarioDisplayTitle(source);
      if (String(resolved || '').trim()) return String(resolved).trim();
    }
    return String(
      source?.scenarioTitle
      || source?.title
      || (typeof getStructuredScenarioField === 'function'
        ? getStructuredScenarioField(source?.structuredScenario, 'eventPath')
        : '')
      || ''
    ).trim();
  }

  function _extractAssessmentPattern(assessment = {}) {
    const resolvedTitle = _resolveScenarioTitle(assessment);
    const scenarioType = typeof getStructuredScenarioField === 'function'
      ? getStructuredScenarioField(assessment.structuredScenario, 'eventPath')
      : '';
    return _normalisePattern({
      id: assessment.id,
      assessmentId: assessment.id,
      buId: assessment.buId,
      buName: assessment.buName,
      functionKey: _functionKeyFromSource(assessment),
      scenarioLens: assessment.scenarioLens,
      title: resolvedTitle,
      scenarioType: scenarioType || resolvedTitle,
      geography: assessment.geography,
      narrative: assessment.enhancedNarrative || assessment.narrative,
      guidedInput: assessment.guidedInput,
      selectedRiskTitles: Array.isArray(assessment.selectedRisks)
        ? assessment.selectedRisks.map(item => item?.title || '')
        : [],
      applicableRegulations: assessment.applicableRegulations,
      posture: assessment?.results?.toleranceBreached
        ? 'above-tolerance'
        : assessment?.results?.nearTolerance
          ? 'near-tolerance'
          : 'within-tolerance',
      confidenceLabel: assessment.confidenceLabel || assessment.results?.runMetadata?.confidenceLabel,
      topGap: Array.isArray(assessment.missingInformation) && assessment.missingInformation.length ? assessment.missingInformation[0] : '',
      keyRecommendation: Array.isArray(assessment.recommendations) && assessment.recommendations.length ? assessment.recommendations[0]?.title : '',
      completedAt: assessment.completedAt,
      submittedBy: assessment.submittedBy
    });
  }

  function _buildCoveragePayload(assessment = {}) {
    return {
      scenarioKey: _scenarioKeyFromSource(assessment),
      scenarioLabel: _scenarioLabelFromSource(assessment),
      buId: _safeText(assessment.buId, 80),
      buName: _safeText(assessment.buName, 160),
      completedAt: Number(assessment.completedAt || Date.now())
    };
  }

  function _buildCalibrationPayload(assessment = {}) {
    const suggested = assessment?.aiSuggestedFairParams && typeof assessment.aiSuggestedFairParams === 'object'
      ? assessment.aiSuggestedFairParams
      : null;
    const finalParams = assessment?.fairParams && typeof assessment.fairParams === 'object'
      ? assessment.fairParams
      : (assessment?.results?.inputs && typeof assessment.results.inputs === 'object' ? assessment.results.inputs : null);
    if (!suggested || !finalParams) return null;
    const fields = {};
    Object.keys(suggested).forEach(fieldName => {
      const suggestedValue = _toNumber(suggested[fieldName]);
      const finalValue = _toNumber(finalParams[fieldName]);
      if (!Number.isFinite(suggestedValue) || !Number.isFinite(finalValue)) return;
      if (Math.abs(finalValue - suggestedValue) < 0.0001) return;
      fields[fieldName] = { suggestedValue, finalValue };
    });
    if (!Object.keys(fields).length) return null;
    return {
      assessmentId: _safeText(assessment.id, 120),
      scenarioKey: _scenarioKeyFromSource(assessment),
      scenarioLabel: _scenarioLabelFromSource(assessment),
      buId: _safeText(assessment.buId, 80),
      buName: _safeText(assessment.buName, 160),
      recordedAt: Number(assessment.completedAt || Date.now()),
      fields
    };
  }

  async function recordCompletedAssessment(assessment = {}) {
    if (!assessment?.id || !assessment?.results) return null;
    const cached = getCachedState();
    const nextPattern = _extractAssessmentPattern(assessment);
    const nextCalibration = _buildCalibrationPayload(assessment);
    const nextCoverage = _buildCoveragePayload(assessment);
    const nextState = {
      ...cached,
      patterns: [nextPattern, ...cached.patterns.filter(item => item.assessmentId !== nextPattern.assessmentId)].slice(0, 180),
      coverageMap: _mergeCoverageMap(cached.coverageMap, nextCoverage),
      updatedAt: Date.now()
    };
    if (nextCalibration) {
      nextState.calibration = _mergeCalibrationStore(cached.calibration, nextCalibration);
    }
    _saveCache(nextState);
    return _post('record_assessment', {
      pattern: nextPattern,
      calibration: nextCalibration,
      coverage: nextCoverage
    });
  }

  function _mergeCoverageMap(coverageMap, payload = {}) {
    const next = _clone(coverageMap, { updatedAt: 0, scenarioTypes: {} }) || { updatedAt: 0, scenarioTypes: {} };
    next.scenarioTypes = next.scenarioTypes && typeof next.scenarioTypes === 'object' ? next.scenarioTypes : {};
    const key = _normaliseScenarioKey(payload.scenarioKey || 'general');
    const current = next.scenarioTypes[key] && typeof next.scenarioTypes[key] === 'object'
      ? { ...next.scenarioTypes[key] }
      : { label: _safeText(payload.scenarioLabel || key, 160), count: 0, lastAssessedAt: 0, byBu: {} };
    current.count = Number(current.count || 0) + 1;
    current.lastAssessedAt = Number(payload.completedAt || Date.now());
    current.byBu = current.byBu && typeof current.byBu === 'object' ? { ...current.byBu } : {};
    if (payload.buId) {
      const buEntry = current.byBu[payload.buId] && typeof current.byBu[payload.buId] === 'object'
        ? { ...current.byBu[payload.buId] }
        : { buId: payload.buId, buName: payload.buName, count: 0, lastAssessedAt: 0 };
      buEntry.count = Number(buEntry.count || 0) + 1;
      buEntry.lastAssessedAt = Number(payload.completedAt || Date.now());
      current.byBu[payload.buId] = buEntry;
    }
    next.scenarioTypes[key] = current;
    next.updatedAt = Date.now();
    return next;
  }

  function _mergeCalibrationStore(store, payload = {}) {
    const next = _clone(store, { updatedAt: 0, scenarioTypes: {} }) || { updatedAt: 0, scenarioTypes: {} };
    next.scenarioTypes = next.scenarioTypes && typeof next.scenarioTypes === 'object' ? next.scenarioTypes : {};
    const scenarioKey = _normaliseScenarioKey(payload.scenarioKey || 'general');
    const scenarioEntry = next.scenarioTypes[scenarioKey] && typeof next.scenarioTypes[scenarioKey] === 'object'
      ? _clone(next.scenarioTypes[scenarioKey], null)
      : { label: _safeText(payload.scenarioLabel || scenarioKey, 160), sampleCount: 0, fields: {} };
    scenarioEntry.fields = scenarioEntry.fields && typeof scenarioEntry.fields === 'object' ? scenarioEntry.fields : {};
    Object.entries(payload.fields || {}).forEach(([fieldName, fieldPayload]) => {
      const suggestedValue = _toNumber(fieldPayload?.suggestedValue);
      const finalValue = _toNumber(fieldPayload?.finalValue);
      if (!Number.isFinite(suggestedValue) || !Number.isFinite(finalValue)) return;
      const fieldEntry = scenarioEntry.fields[fieldName] && typeof scenarioEntry.fields[fieldName] === 'object'
        ? _clone(scenarioEntry.fields[fieldName], null)
        : { samples: [], byBu: {} };
      const sample = {
        assessmentId: _safeText(payload.assessmentId, 120),
        buId: _safeText(payload.buId, 80),
        buName: _safeText(payload.buName, 160),
        recordedAt: Number(payload.recordedAt || Date.now()),
        suggestedValue,
        finalValue,
        absoluteDelta: finalValue - suggestedValue,
        ratioDelta: Math.abs(suggestedValue) > 0.0001 ? ((finalValue - suggestedValue) / suggestedValue) : 0
      };
      fieldEntry.samples = [sample, ...((fieldEntry.samples) || [])].slice(0, 40);
      const averages = _computeAverages(fieldEntry.samples);
      fieldEntry.sampleCount = averages.sampleCount;
      fieldEntry.avgFinalValue = averages.avgFinalValue;
      fieldEntry.avgSuggestedValue = averages.avgSuggestedValue;
      fieldEntry.avgAbsoluteDelta = averages.avgAbsoluteDelta;
      fieldEntry.avgRatioDelta = averages.avgRatioDelta;
      fieldEntry.byBu = fieldEntry.byBu && typeof fieldEntry.byBu === 'object' ? fieldEntry.byBu : {};
      if (sample.buId) {
        const buEntry = fieldEntry.byBu[sample.buId] && typeof fieldEntry.byBu[sample.buId] === 'object'
          ? _clone(fieldEntry.byBu[sample.buId], null)
          : { buId: sample.buId, buName: sample.buName, samples: [] };
        buEntry.samples = [sample, ...((buEntry.samples) || [])].slice(0, 20);
        const buAverages = _computeAverages(buEntry.samples);
        buEntry.sampleCount = buAverages.sampleCount;
        buEntry.avgFinalValue = buAverages.avgFinalValue;
        buEntry.avgSuggestedValue = buAverages.avgSuggestedValue;
        buEntry.avgAbsoluteDelta = buAverages.avgAbsoluteDelta;
        buEntry.avgRatioDelta = buAverages.avgRatioDelta;
        fieldEntry.byBu[sample.buId] = buEntry;
      }
      scenarioEntry.fields[fieldName] = fieldEntry;
    });
    scenarioEntry.sampleCount = Object.values(scenarioEntry.fields).reduce((max, entry) => Math.max(max, Number(entry?.sampleCount || 0)), 0);
    next.scenarioTypes[scenarioKey] = scenarioEntry;
    next.updatedAt = Date.now();
    return next;
  }

  function _computeAverages(samples = []) {
    const list = Array.isArray(samples) ? samples : [];
    const count = list.length;
    const totals = list.reduce((acc, sample) => {
      acc.final += Number(sample.finalValue || 0);
      acc.suggested += Number(sample.suggestedValue || 0);
      acc.absolute += Number(sample.absoluteDelta || 0);
      acc.ratio += Number(sample.ratioDelta || 0);
      return acc;
    }, { final: 0, suggested: 0, absolute: 0, ratio: 0 });
    return {
      sampleCount: count,
      avgFinalValue: count ? totals.final / count : 0,
      avgSuggestedValue: count ? totals.suggested / count : 0,
      avgAbsoluteDelta: count ? totals.absolute / count : 0,
      avgRatioDelta: count ? totals.ratio / count : 0
    };
  }

  async function recordReviewDecision(payload = {}) {
    const decision = _normaliseDecision(payload);
    if (!decision.assessmentId || !decision.decision) return null;
    const cached = getCachedState();
    _saveCache({
      ...cached,
      decisions: [decision, ...cached.decisions.filter(item => item.id !== decision.id)].slice(0, 240),
      updatedAt: Date.now()
    });
    return _post('record_decision', { decision });
  }

  async function recordAiFeedback(payload = {}) {
    const event = _normaliseFeedbackEvent({
      ...payload,
      submittedBy: payload?.submittedBy || (typeof AuthService !== 'undefined' ? AuthService.getCurrentUser()?.username || '' : '')
    });
    if (!event.score) return null;
    const cached = getCachedState();
    const currentFeedback = cached.feedback && typeof cached.feedback === 'object'
      ? {
          updatedAt: Number(cached.feedback.updatedAt || 0),
          events: Array.isArray(cached.feedback.events) ? cached.feedback.events.slice() : []
        }
      : { updatedAt: 0, events: [] };
    const nextFeedback = {
      updatedAt: Date.now(),
      events: [event, ...currentFeedback.events.filter(item => item?.id !== event.id)].slice(0, 600)
    };
    _saveCache({
      ...cached,
      feedback: nextFeedback,
      updatedAt: Date.now()
    });
    return _post('record_feedback', { feedback: event });
  }

  async function resetAiFeedback(options = {}) {
    const includeUserTier = options?.includeUserTier === true;
    const response = await _post('reset_feedback', {
      includeUserTier
    });
    if (!response?.ok || !response.feedback || typeof response.feedback !== 'object') return false;
    const cached = getCachedState();
    _saveCache({
      ...cached,
      feedback: {
        updatedAt: Number(response.feedback.updatedAt || Date.now()),
        events: Array.isArray(response.feedback.events)
          ? response.feedback.events.map(_normaliseFeedbackEvent).filter(item => item.score >= 1 && item.score <= 5).slice(0, 600)
          : []
      },
      updatedAt: Date.now()
    });
    return {
      ok: true,
      includeUserTier,
      resetScope: _safeText(response.resetScope, 40) || (includeUserTier ? 'platform' : 'shared_only'),
      userTierReset: response.userTierReset && typeof response.userTierReset === 'object'
        ? {
            attemptedUsers: Number(response.userTierReset.attemptedUsers || 0),
            clearedUsers: Number(response.userTierReset.clearedUsers || 0),
            skippedUsers: Number(response.userTierReset.skippedUsers || 0),
            failedUsers: Array.isArray(response.userTierReset.failedUsers)
              ? response.userTierReset.failedUsers.map((item) => ({
                  username: _safeText(item?.username, 120),
                  reason: _safeText(item?.reason, 120)
                })).filter((item) => item.username || item.reason).slice(0, 20)
              : []
          }
        : {
            attemptedUsers: 0,
            clearedUsers: 0,
            skippedUsers: 0,
            failedUsers: []
          }
    };
  }

  function _feedbackMatches(event = {}, filters = {}) {
    const buId = _safeText(filters?.buId || filters?.businessUnitId, 80);
    const functionKey = _safeText(filters?.functionKey, 80).toLowerCase();
    const rawLensKey = _safeText(filters?.scenarioLensKey || filters?.scenarioLens?.key || filters?.lensKey || '', 120).toLowerCase();
    const lensKey = rawLensKey ? _normaliseScenarioKey(rawLensKey) : '';
    const target = _normaliseFeedbackTarget(filters?.target || '');
    const runtimeModes = Array.isArray(filters?.runtimeModes) && filters.runtimeModes.length
      ? filters.runtimeModes.map(_normaliseRuntimeMode)
      : [];
    if (buId && String(event?.buId || '').trim() && String(event.buId).trim() !== buId) return false;
    if (functionKey && String(event?.functionKey || '').trim().toLowerCase() && String(event.functionKey).trim().toLowerCase() !== functionKey) return false;
    if (lensKey && String(event?.lensKey || '').trim().toLowerCase() && String(event.lensKey).trim().toLowerCase() !== lensKey) return false;
    if (filters?.target && event.target !== target) return false;
    if (runtimeModes.length && !runtimeModes.includes(_normaliseRuntimeMode(event.runtimeMode))) return false;
    return true;
  }

  function _incrementWeightedMapValue(target, key, amount = 0, max = 180) {
    const safeKey = _safeText(key || '', max);
    if (!safeKey || !Number.isFinite(amount) || amount === 0) return;
    target[safeKey] = Number(target[safeKey] || 0) + amount;
  }

  function _createEmptyFeedbackProfile() {
    return {
      totalEvents: 0,
      liveAiEvents: 0,
      distinctUsers: 0,
      runtimeCounts: { live_ai: 0, fallback: 0, local: 0 },
      draft: { count: 0, totalScore: 0, averageScore: 0, reasons: {} },
      shortlist: { count: 0, totalScore: 0, averageScore: 0, reasons: {} },
      risk: { count: 0, totalScore: 0, averageScore: 0, reasons: {} },
      riskWeights: {},
      docWeights: {},
      docTagWeights: {},
      wrongDomainCount: 0,
      weakCitationCount: 0,
      missedRiskCount: 0,
      unrelatedRiskCount: 0,
      usefulWithEditsCount: 0,
      latestAt: 0,
      topPositiveRisks: [],
      topNegativeRisks: [],
      topPositiveDocs: [],
      topNegativeDocs: []
    };
  }

  function _feedbackScoreDelta(score) {
    return (Math.max(1, Math.min(5, Math.round(Number(score || 0)))) - 3) / 2;
  }

  function _buildFeedbackProfile(events = []) {
    const profile = _createEmptyFeedbackProfile();
    const submitters = new Set();
    (Array.isArray(events) ? events : []).forEach(event => {
      if (!event?.score) return;
      profile.totalEvents += 1;
      profile.latestAt = Math.max(profile.latestAt, Number(event.recordedAt || 0));
      const runtimeMode = _normaliseRuntimeMode(event.runtimeMode);
      profile.runtimeCounts[runtimeMode] = Number(profile.runtimeCounts[runtimeMode] || 0) + 1;
      if (runtimeMode === 'live_ai') profile.liveAiEvents += 1;
      if (event.submittedBy) submitters.add(event.submittedBy);
      const bucket = event.target === 'shortlist'
        ? profile.shortlist
        : event.target === 'risk'
          ? profile.risk
          : profile.draft;
      bucket.count += 1;
      bucket.totalScore += Number(event.score || 0);
      (Array.isArray(event.reasons) ? event.reasons : []).forEach(reason => {
        bucket.reasons[reason] = Number(bucket.reasons[reason] || 0) + 1;
        if (reason === 'wrong-domain') profile.wrongDomainCount += 1;
        if (reason === 'too-generic') {}
        if (reason === 'weak-citations') profile.weakCitationCount += 1;
        if (reason === 'missed-key-risk') profile.missedRiskCount += 1;
        if (reason === 'included-unrelated-risks') profile.unrelatedRiskCount += 1;
        if (reason === 'useful-with-edits') profile.usefulWithEditsCount += 1;
      });
      if (runtimeMode !== 'live_ai') return;
      const baseDelta = _feedbackScoreDelta(event.score);
      if (event.target === 'risk') {
        const riskTitle = _safeText(event.riskTitle, 180);
        if (riskTitle) {
          _incrementWeightedMapValue(profile.riskWeights, riskTitle, baseDelta * 1.5);
          if (event.selectedInAssessment === true) {
            _incrementWeightedMapValue(profile.riskWeights, riskTitle, 0.3 + Math.max(0, baseDelta) * 0.5);
          } else if (event.selectedInAssessment === false) {
            _incrementWeightedMapValue(profile.riskWeights, riskTitle, -0.3 + Math.min(0, baseDelta) * 0.5);
          }
        }
        return;
      }
      const draftWeight = event.target === 'draft' ? 0.9 : 0.45;
      const shortlistWeight = event.target === 'shortlist' ? 0.95 : 0.3;
      (Array.isArray(event.citations) ? event.citations : []).forEach((citation) => {
        const docDelta = baseDelta * (event.target === 'shortlist' ? 1.25 : 1);
        _incrementWeightedMapValue(profile.docWeights, citation.docId || citation.title, docDelta, 120);
        (Array.isArray(citation.tags) ? citation.tags : []).forEach((tag) => {
          _incrementWeightedMapValue(profile.docTagWeights, tag, docDelta * 0.65, 60);
        });
      });
      (Array.isArray(event.shownRiskTitles) ? event.shownRiskTitles : []).forEach((title) => {
        _incrementWeightedMapValue(profile.riskWeights, title, baseDelta * shortlistWeight);
      });
      (Array.isArray(event.keptRiskTitles) ? event.keptRiskTitles : []).forEach((title) => {
        _incrementWeightedMapValue(profile.riskWeights, title, 0.7 + Math.max(0, baseDelta) * 0.8);
      });
      (Array.isArray(event.removedRiskTitles) ? event.removedRiskTitles : []).forEach((title) => {
        _incrementWeightedMapValue(profile.riskWeights, title, -0.85 + Math.min(0, baseDelta) * 0.6);
      });
      (Array.isArray(event.addedRiskTitles) ? event.addedRiskTitles : []).forEach((title) => {
        _incrementWeightedMapValue(profile.riskWeights, title, 0.55 + draftWeight * Math.max(0, baseDelta));
      });
    });
    profile.distinctUsers = submitters.size;
    if (profile.draft.count) {
      profile.draft.averageScore = Number((profile.draft.totalScore / profile.draft.count).toFixed(2));
    }
    if (profile.shortlist.count) {
      profile.shortlist.averageScore = Number((profile.shortlist.totalScore / profile.shortlist.count).toFixed(2));
    }
    if (profile.risk.count) {
      profile.risk.averageScore = Number((profile.risk.totalScore / profile.risk.count).toFixed(2));
    }
    profile.topPositiveRisks = Object.entries(profile.riskWeights)
      .filter(([, value]) => Number(value) > 0.35)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([title, weight]) => ({ title, weight: Number(weight.toFixed(2)) }));
    profile.topNegativeRisks = Object.entries(profile.riskWeights)
      .filter(([, value]) => Number(value) < -0.35)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([title, weight]) => ({ title, weight: Number(weight.toFixed(2)) }));
    profile.topPositiveDocs = Object.entries(profile.docWeights)
      .filter(([, value]) => Number(value) > 0.35)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([docId, weight]) => ({ docId, weight: Number(weight.toFixed(2)) }));
    profile.topNegativeDocs = Object.entries(profile.docWeights)
      .filter(([, value]) => Number(value) < -0.35)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([docId, weight]) => ({ docId, weight: Number(weight.toFixed(2)) }));
    return profile;
  }

  function _buildInactiveFeedbackProfile(label = '') {
    return {
      active: false,
      label,
      minEvents: 0,
      minUsers: 0,
      profile: _createEmptyFeedbackProfile()
    };
  }

  function _buildTierProfile(events = [], { label = '', minEvents = 0, minUsers = 0 } = {}) {
    const profile = _buildFeedbackProfile(events);
    const active = profile.liveAiEvents >= minEvents && profile.distinctUsers >= minUsers;
    return {
      active,
      label,
      minEvents,
      minUsers,
      profile
    };
  }

  function _mergeFeedbackTier(combined, tierProfile, weight = 1) {
    const source = tierProfile?.profile;
    if (!tierProfile?.active || !source || !Number.isFinite(weight) || weight <= 0) return combined;
    combined.activeTiers.push(tierProfile.label || 'tier');
    combined.draftPressure += ((Number(source.draft.averageScore || 3) - 3) * weight);
    combined.shortlistPressure += ((Number(source.shortlist.averageScore || 3) - 3) * weight);
    combined.wrongDomainPressure += Number(source.wrongDomainCount || 0) * weight;
    combined.weakCitationPressure += Number(source.weakCitationCount || 0) * weight;
    combined.missedRiskPressure += Number(source.missedRiskCount || 0) * weight;
    combined.unrelatedRiskPressure += Number(source.unrelatedRiskCount || 0) * weight;
    Object.entries(source.riskWeights || {}).forEach(([title, value]) => {
      _incrementWeightedMapValue(combined.riskWeights, title, Number(value || 0) * weight);
    });
    Object.entries(source.docWeights || {}).forEach(([docId, value]) => {
      _incrementWeightedMapValue(combined.docWeights, docId, Number(value || 0) * weight, 120);
    });
    Object.entries(source.docTagWeights || {}).forEach(([tag, value]) => {
      _incrementWeightedMapValue(combined.docTagWeights, tag, Number(value || 0) * weight, 60);
    });
    Object.entries(source.draft.reasons || {}).forEach(([reason, count]) => {
      _incrementWeightedMapValue(combined.reasonWeights, `draft:${reason}`, Number(count || 0) * weight, 80);
    });
    Object.entries(source.shortlist.reasons || {}).forEach(([reason, count]) => {
      _incrementWeightedMapValue(combined.reasonWeights, `shortlist:${reason}`, Number(count || 0) * weight, 80);
    });
    return combined;
  }

  function _finaliseCombinedFeedback(combined = {}) {
    const next = combined && typeof combined === 'object' ? combined : {
      activeTiers: [],
      riskWeights: {},
      docWeights: {},
      docTagWeights: {},
      reasonWeights: {},
      draftPressure: 0,
      shortlistPressure: 0,
      wrongDomainPressure: 0,
      weakCitationPressure: 0,
      missedRiskPressure: 0,
      unrelatedRiskPressure: 0
    };
    next.preferredRiskTitles = Object.entries(next.riskWeights || {})
      .filter(([, value]) => Number(value) > 0.35)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([title, weight]) => ({ title, weight: Number(weight.toFixed(2)) }));
    next.avoidRiskTitles = Object.entries(next.riskWeights || {})
      .filter(([, value]) => Number(value) < -0.35)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([title, weight]) => ({ title, weight: Number(weight.toFixed(2)) }));
    next.preferredDocIds = Object.entries(next.docWeights || {})
      .filter(([, value]) => Number(value) > 0.35)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([docId, weight]) => ({ docId, weight: Number(weight.toFixed(2)) }));
    next.avoidDocIds = Object.entries(next.docWeights || {})
      .filter(([, value]) => Number(value) < -0.35)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([docId, weight]) => ({ docId, weight: Number(weight.toFixed(2)) }));
    next.topIssues = Object.entries(next.reasonWeights || {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([reason, weight]) => ({ reason, weight: Number(weight.toFixed(2)) }));
    return next;
  }

  function getFeedbackEvents(filters = {}) {
    const cached = getCachedState();
    return (cached.feedback?.events || []).filter(event => _feedbackMatches(event, filters));
  }

  function getFeedbackTierThresholds(settings = null) {
    const tuning = _getActiveAiFeedbackTuning(settings);
    if (tuning.learningSensitivity === 'accelerated') {
      return {
        learningSensitivity: tuning.learningSensitivity,
        function: { minEvents: 2, minUsers: 2 },
        businessUnit: { minEvents: 3, minUsers: 2 },
        global: { minEvents: 6, minUsers: 3 }
      };
    }
    if (tuning.learningSensitivity === 'conservative') {
      return {
        learningSensitivity: tuning.learningSensitivity,
        function: { minEvents: 4, minUsers: 2 },
        businessUnit: { minEvents: 6, minUsers: 3 },
        global: { minEvents: 10, minUsers: 5 }
      };
    }
    return {
      learningSensitivity: tuning.learningSensitivity,
      function: { minEvents: 3, minUsers: 2 },
      businessUnit: { minEvents: 4, minUsers: 2 },
      global: { minEvents: 8, minUsers: 4 }
    };
  }

  function buildFeedbackDashboardModel(filters = {}, settings = null) {
    const events = getFeedbackEvents(filters);
    const profile = _buildFeedbackProfile(events);
    const thresholds = getFeedbackTierThresholds(settings);
    const recentEvents = events
      .slice()
      .sort((left, right) => Number(right.recordedAt || 0) - Number(left.recordedAt || 0))
      .slice(0, 12)
      .map((event) => ({
        id: _safeText(event.id, 120),
        recordedAt: Number(event.recordedAt || 0),
        target: _normaliseFeedbackTarget(event.target),
        score: Number(event.score || 0),
        runtimeMode: _normaliseRuntimeMode(event.runtimeMode),
        buName: _safeText(event.buName || event.buId || 'Unscoped', 160),
        functionKey: _safeText(event.functionKey || 'general', 80).toLowerCase(),
        lensKey: _normaliseScenarioKey(event.lensKey || 'general'),
        submittedBy: _safeText(event.submittedBy, 120),
        reasons: Array.isArray(event.reasons) ? event.reasons.map((item) => _normaliseReasonTag(item)).filter(Boolean).slice(0, 6) : [],
        riskTitle: _safeText(event.riskTitle, 180),
        scenarioFingerprint: _safeText(event.scenarioFingerprint, 220),
        citations: _normaliseFeedbackCitationList(event.citations).slice(0, 3)
      }));
    const tallyBreakdown = (keySelector, formatter = (key) => key) => {
      const breakdown = new Map();
      events.forEach((event) => {
        const key = _safeText(keySelector(event), 120);
        if (!key) return;
        const current = breakdown.get(key) || { key, label: formatter(key, event), count: 0, totalScore: 0 };
        current.count += 1;
        current.totalScore += Number(event.score || 0);
        breakdown.set(key, current);
      });
      return Array.from(breakdown.values())
        .map((entry) => ({
          ...entry,
          averageScore: entry.count ? Number((entry.totalScore / entry.count).toFixed(2)) : 0
        }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
        .slice(0, 6);
    };
    const reasonWeights = {};
    events.forEach((event) => {
      (Array.isArray(event.reasons) ? event.reasons : []).forEach((reason) => {
        _incrementWeightedMapValue(reasonWeights, reason, 1, 80);
      });
    });
    const runtimeBreakdown = Object.entries(profile.runtimeCounts || {})
      .map(([key, count]) => ({ key, label: key === 'live_ai' ? 'Live AI' : key === 'fallback' ? 'Fallback' : 'Local', count: Number(count || 0) }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
    return {
      totalEvents: profile.totalEvents,
      liveAiEvents: profile.liveAiEvents,
      liveSharePct: profile.totalEvents ? Number(((profile.liveAiEvents / profile.totalEvents) * 100).toFixed(1)) : 0,
      distinctUsers: profile.distinctUsers,
      latestAt: profile.latestAt,
      profile,
      thresholds,
      runtimeBreakdown,
      lensBreakdown: tallyBreakdown((event) => event.lensKey, (key) => String(key || 'general').replace(/-/g, ' ')),
      functionBreakdown: tallyBreakdown((event) => event.functionKey, (key) => key || 'general'),
      businessUnitBreakdown: tallyBreakdown((event) => event.buName || event.buId, (key) => key || 'Unscoped'),
      recentEvents,
      lowScoreLiveEvents: recentEvents.filter((event) => event.runtimeMode === 'live_ai' && Number(event.score || 0) <= 2).slice(0, 8),
      topIssues: Object.entries(reasonWeights)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 6)
        .map(([reason, count]) => ({
          reason,
          label: String(reason || '').replace(/-/g, ' '),
          count: Number(count || 0)
        }))
    };
  }

  // Browser-shared feedback state remains useful for admin visibility and bounded
  // assistive UX, but it is not an authoritative inference input for server-owned flows.
  function getHierarchicalFeedbackProfile(context = {}) {
    const filters = {
      buId: context.buId || context.businessUnitId || '',
      functionKey: context.functionKey || context.scenarioLens?.functionKey || '',
      scenarioLensKey: context.scenarioLensKey || context.scenarioLens?.key || context.lensKey || ''
    };
    const thresholds = getFeedbackTierThresholds(context.settings || null);
    const orgEvents = getFeedbackEvents({ scenarioLensKey: filters.scenarioLensKey });
    const userProfile = _buildInactiveFeedbackProfile('user');
    const functionProfile = filters.functionKey
      ? _buildTierProfile(orgEvents.filter(event => _feedbackMatches(event, { ...filters, buId: '', functionKey: filters.functionKey })), {
          label: 'function',
          minEvents: thresholds.function.minEvents,
          minUsers: thresholds.function.minUsers
        })
      : _buildInactiveFeedbackProfile('function');
    const businessUnitProfile = filters.buId
      ? _buildTierProfile(orgEvents.filter(event => _feedbackMatches(event, { ...filters, buId: filters.buId, functionKey: '' })), {
          label: 'business-unit',
          minEvents: thresholds.businessUnit.minEvents,
          minUsers: thresholds.businessUnit.minUsers
        })
      : _buildInactiveFeedbackProfile('business-unit');
    const globalProfile = _buildTierProfile(orgEvents.filter(event => _feedbackMatches(event, { scenarioLensKey: filters.scenarioLensKey })), {
      label: 'global',
      minEvents: thresholds.global.minEvents,
      minUsers: thresholds.global.minUsers
    });
    const combined = _finaliseCombinedFeedback([
      { profile: globalProfile.profile, active: globalProfile.active, label: 'global', weight: 1 },
      { profile: businessUnitProfile.profile, active: businessUnitProfile.active, label: 'business-unit', weight: 1.15 },
      { profile: functionProfile.profile, active: functionProfile.active, label: 'function', weight: 1.1 },
      { profile: userProfile.profile, active: userProfile.active, label: 'user', weight: 1.25 }
    ].reduce((acc, item) => _mergeFeedbackTier(acc, item, item.weight), {
      activeTiers: [],
      riskWeights: {},
      docWeights: {},
      docTagWeights: {},
      reasonWeights: {},
      draftPressure: 0,
      shortlistPressure: 0,
      wrongDomainPressure: 0,
      weakCitationPressure: 0,
      missedRiskPressure: 0,
      unrelatedRiskPressure: 0
    }));
    return {
      user: userProfile,
      function: functionProfile,
      businessUnit: businessUnitProfile,
      global: globalProfile,
      thresholds,
      combined
    };
  }

  function _patternTokens(pattern = {}) {
    return Array.from(new Set([
      pattern.title,
      pattern.scenarioType,
      pattern.narrative,
      pattern.guidedInput?.event,
      pattern.guidedInput?.asset,
      pattern.guidedInput?.cause,
      pattern.guidedInput?.impact,
      ...(Array.isArray(pattern.selectedRiskTitles) ? pattern.selectedRiskTitles : [])
    ].filter(Boolean).join(' ').toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2)));
  }

  function getMergedScenarioPatterns(context = {}, limit = 12) {
    const cached = getCachedState();
    const buId = _safeText(context.buId || context.businessUnitId, 80);
    const scenarioLensKey = _normaliseScenarioKey(context.scenarioLensKey || context.scenarioLens?.key || '');
    const functionKey = _safeText(context.functionKey || context.scenarioLens?.functionKey || '', 80).toLowerCase();
    const combined = [...(Array.isArray(cached.patterns) ? cached.patterns : [])]
      .map(_normalisePattern)
      .filter(item => item.assessmentId)
      .reduce((acc, item) => {
        const key = item.assessmentId || item.id || `${item.title}:${item.completedAt}`;
        if (!acc.has(key)) acc.set(key, item);
        return acc;
      }, new Map());
    const contextTokens = _patternTokens({
      title: _resolveScenarioTitle(context),
      scenarioType: context.scenarioType || _resolveScenarioTitle(context),
      narrative: context.narrative,
      guidedInput: context.guidedInput,
      selectedRiskTitles: context.selectedRiskTitles || []
    });
    return Array.from(combined.values())
      .map(pattern => {
        let score = 0;
        if (buId && pattern.buId === buId) score += 40;
        if (scenarioLensKey && pattern.scenarioLens?.key === scenarioLensKey) score += 26;
        if (functionKey && pattern.functionKey === functionKey) score += 18;
        const tokens = _patternTokens(pattern);
        const overlap = tokens.filter(token => contextTokens.includes(token)).length;
        score += overlap * 3;
        const ageDays = Math.max(0, (Date.now() - Number(pattern.completedAt || 0)) / 86_400_000);
        score += Math.max(0, 12 - Math.min(12, ageDays / 14));
        return { pattern, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.pattern.completedAt || 0) - Number(a.pattern.completedAt || 0))
      .slice(0, limit)
      .map(item => item.pattern);
  }

  function buildDecisionPattern(assessment = {}) {
    const cached = getCachedState();
    const scenarioLensKey = _scenarioKeyFromSource(assessment);
    const scenarioLabel = _scenarioLabelFromSource(assessment);
    const relevant = (cached.decisions || []).filter(item => item.scenarioLensKey === scenarioLensKey);
    if (relevant.length < 3) return null;
    const approved = relevant.filter(item => item.decision === 'approved');
    const escalated = relevant.filter(item => item.decision === 'escalated');
    const changed = relevant.filter(item => item.decision === 'changes_requested');
    const currentP90 = Number(assessment?.results?.eventLoss?.p90 || 0);
    const avgApproved = approved.length ? approved.reduce((sum, item) => sum + Number(item.p90Loss || 0), 0) / approved.length : 0;
    const avgEscalated = escalated.length ? escalated.reduce((sum, item) => sum + Number(item.p90Loss || 0), 0) / escalated.length : 0;
    let tone = 'neutral';
    let summary = '';
    if (escalated.length >= 3 && escalated.length >= approved.length) {
      tone = 'warning';
      summary = `Your organisation has escalated ${escalated.length} ${scenarioLabel.toLowerCase()} assessment${escalated.length === 1 ? '' : 's'} averaging ${fmtCurrency(avgEscalated || currentP90)} P90.`;
    } else if (approved.length >= 3) {
      tone = currentP90 && avgApproved && currentP90 > avgApproved * 1.1 ? 'warning' : 'success';
      summary = `Your organisation has approved ${approved.length} ${scenarioLabel.toLowerCase()} assessment${approved.length === 1 ? '' : 's'} averaging ${fmtCurrency(avgApproved || currentP90)} P90.`;
    } else {
      summary = `${relevant.length} prior ${scenarioLabel.toLowerCase()} review decisions are now shaping the management context for this scenario.`;
    }
    const challengedAssumptions = relevant.map(item => item.challengedAssumption).filter(Boolean).slice(0, 2);
    const rangeHint = approved.length && currentP90
      ? (currentP90 <= avgApproved * 1.1
          ? 'This scenario sits within the organisation’s recent approval range.'
          : 'This scenario sits above the organisation’s recent approval range and is more likely to draw challenge.')
      : (escalated.length ? 'Escalation history is strong for this scenario type.' : 'Decision history is still building for this scenario type.');
    return {
      tone,
      sampleCount: relevant.length,
      summary,
      rangeHint,
      challengedAssumptions
    };
  }

  function buildDriftAlerts(limit = 3) {
    const cached = getCachedState();
    const alerts = [];
    const scenarioTypes = cached.calibration?.scenarioTypes || {};
    Object.entries(scenarioTypes).forEach(([scenarioKey, scenarioEntry]) => {
      Object.entries(scenarioEntry?.fields || {}).forEach(([fieldName, fieldEntry]) => {
        const buEntries = Object.values(fieldEntry?.byBu || {}).filter(item => Number(item?.sampleCount || 0) >= 2);
        if (buEntries.length < 2) return;
        const ordered = buEntries.slice().sort((a, b) => Number(b.avgFinalValue || 0) - Number(a.avgFinalValue || 0));
        const high = ordered[0];
        const low = ordered[ordered.length - 1];
        const highValue = Number(high.avgFinalValue || 0);
        const lowValue = Number(low.avgFinalValue || 0);
        if (!Number.isFinite(highValue) || !Number.isFinite(lowValue) || highValue <= 0 || lowValue < 0) return;
        const ratio = lowValue > 0 ? highValue / lowValue : Infinity;
        const absoluteGap = Math.abs(highValue - lowValue);
        const material = RATIO_BOUNDED_FIELDS.has(fieldName)
          ? absoluteGap >= 0.18
          : ratio >= 1.5;
        if (!material) return;
        alerts.push({
          scenarioKey,
          scenarioLabel: _safeText(scenarioEntry?.label || scenarioKey, 160),
          fieldName,
          highBuName: _safeText(high.buName || high.buId, 160),
          lowBuName: _safeText(low.buName || low.buId, 160),
          highValue,
          lowValue,
          ratio,
          sampleCount: Math.min(Number(high.sampleCount || 0), Number(low.sampleCount || 0))
        });
      });
    });
    return alerts
      .sort((a, b) => b.ratio - a.ratio || b.sampleCount - a.sampleCount)
      .slice(0, Math.max(1, Number(limit) || 0));
  }

  function getFieldLabel(fieldName = '') {
    const labels = {
      tefMin: 'TEF low case',
      tefLikely: 'TEF expected case',
      tefMax: 'TEF high case',
      threatCapLikely: 'Threat capability',
      controlStrLikely: 'Control strength',
      irLikely: 'Response and recovery cost',
      biLikely: 'Business disruption cost',
      dbLikely: 'Data remediation cost',
      rlLikely: 'Regulatory and legal cost',
      tpLikely: 'Third-party impact cost',
      rcLikely: 'Reputation and contract cost'
    };
    return labels[fieldName] || fieldName;
  }

  _memoryState = _safeGetCache();

  return {
    getCachedState,
    refresh,
    recordCompletedAssessment,
    recordReviewDecision,
    recordAiFeedback,
    resetAiFeedback,
    clearCache,
    getMergedScenarioPatterns,
    getFeedbackEvents,
    getFeedbackTierThresholds,
    buildFeedbackDashboardModel,
    getHierarchicalFeedbackProfile,
    buildDecisionPattern,
    buildDriftAlerts,
    getFieldLabel
  };
})();

if (typeof module !== 'undefined') module.exports = OrgIntelligenceService;
