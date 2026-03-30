'use strict';

const OrgIntelligenceService = (() => {
  const CACHE_KEY = 'rq_org_intelligence_cache';
  const DEFAULT_STATE = Object.freeze({
    patterns: [],
    calibration: { updatedAt: 0, scenarioTypes: {} },
    decisions: [],
    coverageMap: { updatedAt: 0, scenarioTypes: {} },
    updatedAt: 0
  });
  const RANGE_PREFIXES = ['tef', 'threatCap', 'controlStr', 'ir', 'bi', 'db', 'rl', 'tp', 'rc', 'vuln'];
  const RATIO_BOUNDED_FIELDS = new Set([
    'tefMin', 'tefLikely', 'tefMax',
    'threatCapMin', 'threatCapLikely', 'threatCapMax',
    'controlStrMin', 'controlStrLikely', 'controlStrMax',
    'vulnMin', 'vulnLikely', 'vulnMax'
  ]);
  let _memoryState = _clone(DEFAULT_STATE);
  let _refreshPromise = null;

  function _clone(value, fallback = null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return fallback;
    }
  }

  function _safeGetCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return _clone(DEFAULT_STATE, {
        patterns: [],
        calibration: { updatedAt: 0, scenarioTypes: {} },
        decisions: [],
        coverageMap: { updatedAt: 0, scenarioTypes: {} },
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
        updatedAt: 0
      });
    }
  }

  function _saveCache(state) {
    const next = _normaliseState(state);
    _memoryState = next;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
    return next;
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
      updatedAt: Number(source.updatedAt || 0)
    };
  }

  function getCachedState() {
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

  async function refresh(force = false) {
    const cached = getCachedState();
    const freshEnough = !force && cached.updatedAt && (Date.now() - cached.updatedAt) < 60_000;
    if (freshEnough) return cached;
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = fetch('/api/org-intelligence', {
      headers: _buildHeaders()
    }).then(async response => {
      if (!response.ok) throw new Error('Org intelligence unavailable');
      const payload = await response.json();
      return _saveCache({
        patterns: payload.patterns || [],
        calibration: payload.calibration || { updatedAt: 0, scenarioTypes: {} },
        decisions: payload.decisions || [],
        coverageMap: payload.coverageMap || { updatedAt: 0, scenarioTypes: {} },
        updatedAt: Date.now()
      });
    }).catch(() => getCachedState()).finally(() => {
      _refreshPromise = null;
    });
    return _refreshPromise;
  }

  async function _post(type, payload = {}) {
    try {
      const response = await fetch('/api/org-intelligence', {
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

  function _extractAssessmentPattern(assessment = {}) {
    return _normalisePattern({
      id: assessment.id,
      assessmentId: assessment.id,
      buId: assessment.buId,
      buName: assessment.buName,
      functionKey: _functionKeyFromSource(assessment),
      scenarioLens: assessment.scenarioLens,
      title: assessment.scenarioTitle || (typeof getStructuredScenarioField === 'function' ? getStructuredScenarioField(assessment.structuredScenario, 'eventPath') : ''),
      scenarioType: typeof getStructuredScenarioField === 'function'
        ? getStructuredScenarioField(assessment.structuredScenario, 'eventPath')
        : (assessment.scenarioTitle || ''),
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

  function _getLocalPatterns(limit = 20, buId = '') {
    try {
      const username = typeof AuthService !== 'undefined' && typeof AuthService.getCurrentUser === 'function'
        ? AuthService.getCurrentUser()?.username || ''
        : '';
      if (!username || typeof LearningStore === 'undefined' || typeof LearningStore.getScenarioPatterns !== 'function') return [];
      return LearningStore.getScenarioPatterns(username, buId, limit).map(_normalisePattern);
    } catch {
      return [];
    }
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
    const local = _getLocalPatterns(Math.max(limit * 2, 12), buId);
    const combined = [...local, ...(Array.isArray(cached.patterns) ? cached.patterns : [])]
      .map(_normalisePattern)
      .filter(item => item.assessmentId)
      .reduce((acc, item) => {
        const key = item.assessmentId || item.id || `${item.title}:${item.completedAt}`;
        if (!acc.has(key)) acc.set(key, item);
        return acc;
      }, new Map());
    const contextTokens = _patternTokens({
      title: context.scenarioTitle,
      scenarioType: context.scenarioType,
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

  function buildGhostDraftSuggestion(context = {}) {
    const patterns = getMergedScenarioPatterns(context, 8);
    if (!patterns.length) return null;
    const primary = patterns[0];
    const sourcePatternIds = patterns.slice(0, 4).map(item => item.assessmentId || item.id).filter(Boolean);
    const riskFrequency = {};
    const regulationFrequency = {};
    patterns.slice(0, 4).forEach(pattern => {
      (pattern.selectedRiskTitles || []).forEach(title => {
        const safe = _safeText(title, 160);
        if (!safe) return;
        riskFrequency[safe] = Number(riskFrequency[safe] || 0) + 1;
      });
      (pattern.applicableRegulations || []).forEach(tag => {
        const safe = _safeText(tag, 120);
        if (!safe) return;
        regulationFrequency[safe] = Number(regulationFrequency[safe] || 0) + 1;
      });
    });
    const selectedRiskTitles = Object.entries(riskFrequency)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([title]) => title);
    const regulations = Object.entries(regulationFrequency)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([tag]) => tag);
    const narrative = _safeText(
      primary.narrative
      || (typeof composeGuidedNarrative === 'function'
        ? composeGuidedNarrative(primary.guidedInput || {}, {
            lensKey: primary.scenarioLens?.key || '',
            lensLabel: primary.scenarioLens?.label || ''
          })
        : ''),
      800
    );
    const riskCandidates = selectedRiskTitles.map((title, index) => ({
      id: `ghost_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      category: 'Learned pattern',
      source: 'ghost-drafter',
      description: 'Suggested from similar completed assessments already seen in this organisation.'
    }));
    const scenarioTitle = primary.title || primary.scenarioType || 'Suggested starting point';
    return {
      patternCount: patterns.length,
      patternTitles: patterns.slice(0, 3).map(item => item.title || item.scenarioType).filter(Boolean),
      sourcePatternIds,
      draftPatch: {
        scenarioLens: primary.scenarioLens ? { ...primary.scenarioLens } : null,
        scenarioTitle,
        narrative,
        enhancedNarrative: narrative,
        sourceNarrative: narrative,
        guidedInput: primary.guidedInput && typeof primary.guidedInput === 'object'
          ? { ...primary.guidedInput }
          : {},
        riskCandidates,
        selectedRiskIds: riskCandidates.map(item => item.id),
        selectedRisks: riskCandidates.map(item => ({ ...item })),
        applicableRegulations: regulations.length
          ? regulations
          : (Array.isArray(context.applicableRegulations) ? context.applicableRegulations.slice(0, 6) : []),
        ghostDraftMeta: {
          appliedAt: Date.now(),
          patternCount: patterns.length,
          sourcePatternIds,
          sourcePatternTitles: patterns.slice(0, 3).map(item => item.title || item.scenarioType).filter(Boolean),
          sourceType: patterns.some(item => item.submittedBy && item.submittedBy !== (typeof AuthService !== 'undefined' ? AuthService.getCurrentUser()?.username || '' : ''))
            ? 'organisation'
            : 'personal'
        },
        guidedDraftSource: 'ghost-drafter',
        guidedDraftStatus: 'Pre-loaded from similar completed assessments.'
      }
    };
  }

  function applyGhostDraftToDraft(draft = {}, context = {}) {
    if (!draft || typeof draft !== 'object') return null;
    const suggestion = buildGhostDraftSuggestion({
      buId: draft.buId || context.buId,
      scenarioLens: draft.scenarioLens || context.scenarioLens,
      scenarioLensKey: draft.scenarioLens?.key || context.scenarioLensKey,
      functionKey: draft.scenarioLens?.functionKey || context.functionKey,
      applicableRegulations: draft.applicableRegulations || context.applicableRegulations || [],
      selectedRiskTitles: [],
      narrative: '',
      guidedInput: draft.guidedInput || {}
    });
    if (!suggestion) return null;
    Object.assign(draft, suggestion.draftPatch);
    return suggestion;
  }

  function getCalibrationProfile(source = {}) {
    const cached = getCachedState();
    const scenarioKey = _scenarioKeyFromSource(source);
    return cached.calibration?.scenarioTypes?.[scenarioKey] || null;
  }

  function _clampFieldValue(fieldName, value) {
    if (!Number.isFinite(value)) return value;
    if (RATIO_BOUNDED_FIELDS.has(fieldName)) {
      return Math.max(0.01, Math.min(0.99, value));
    }
    return Math.max(0, value);
  }

  function _sortRange(prefix, fairParams) {
    const minKey = `${prefix}Min`;
    const likelyKey = `${prefix}Likely`;
    const maxKey = `${prefix}Max`;
    const values = [fairParams[minKey], fairParams[likelyKey], fairParams[maxKey]].map(value => Number(value));
    if (!values.every(Number.isFinite)) return;
    values.sort((a, b) => a - b);
    fairParams[minKey] = values[0];
    fairParams[likelyKey] = values[1];
    fairParams[maxKey] = values[2];
  }

  function applyCalibrationToDraft(draft = {}) {
    if (!draft || typeof draft !== 'object') return null;
    if (draft.orgCalibrationApplied) return draft.orgCalibrationInfo || null;
    const fairParams = draft.fairParams;
    if (!fairParams || typeof fairParams !== 'object') return null;
    const profile = getCalibrationProfile(draft);
    if (!profile?.fields || typeof profile.fields !== 'object') return null;
    const appliedFields = [];
    Object.entries(profile.fields).forEach(([fieldName, fieldProfile]) => {
      if (Number(fieldProfile?.sampleCount || 0) < 5) return;
      const currentValue = _toNumber(fairParams[fieldName]);
      if (!Number.isFinite(currentValue)) return;
      const adjusted = Math.abs(currentValue) > 0.0001
        ? currentValue * (1 + Number(fieldProfile.avgRatioDelta || 0))
        : currentValue + Number(fieldProfile.avgAbsoluteDelta || 0);
      const nextValue = _clampFieldValue(fieldName, adjusted);
      if (!Number.isFinite(nextValue) || Math.abs(nextValue - currentValue) < 0.0001) return;
      fairParams[fieldName] = Number(nextValue.toFixed(RATIO_BOUNDED_FIELDS.has(fieldName) ? 2 : 0));
      appliedFields.push({
        fieldName,
        sampleCount: Number(fieldProfile.sampleCount || 0),
        avgRatioDelta: Number(fieldProfile.avgRatioDelta || 0)
      });
    });
    if (!appliedFields.length) return null;
    RANGE_PREFIXES.forEach(prefix => _sortRange(prefix, fairParams));
    draft.orgCalibrationApplied = true;
    draft.orgCalibrationInfo = {
      scenarioKey: _scenarioKeyFromSource(draft),
      scenarioLabel: _scenarioLabelFromSource(draft),
      appliedAt: Date.now(),
      appliedFields
    };
    return draft.orgCalibrationInfo;
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
    getMergedScenarioPatterns,
    buildGhostDraftSuggestion,
    applyGhostDraftToDraft,
    getCalibrationProfile,
    applyCalibrationToDraft,
    buildDecisionPattern,
    buildDriftAlerts,
    getFieldLabel
  };
})();

if (typeof module !== 'undefined') module.exports = OrgIntelligenceService;
