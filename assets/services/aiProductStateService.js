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

  function hasUsefulOutput(value) {
    if (!isPlainObject(value)) return false;
    const ignored = new Set(['mode', 'sourceMode', 'usedFallback', 'aiUnavailable', 'generatedAt', 'inputFingerprint']);
    return Object.entries(value).some(([key, item]) => {
      if (ignored.has(key)) return false;
      if (Array.isArray(item)) return item.length > 0;
      if (isPlainObject(item)) return Object.keys(item).length > 0;
      if (typeof item === 'string') return cleanText(item).length > 0;
      return item !== null && item !== undefined;
    });
  }

  function resolveFreshness({ hasOutput, savedFingerprint = '', currentFingerprint = '', sourceMode = '' } = {}) {
    if (!hasOutput) {
      return {
        status: 'empty',
        label: 'No output',
        tone: 'neutral',
        refreshRecommended: true
      };
    }
    const saved = cleanText(savedFingerprint);
    const current = cleanText(currentFingerprint);
    if (saved && current && saved !== current) {
      return {
        status: 'stale',
        label: 'Needs refresh',
        tone: 'warning',
        refreshRecommended: true
      };
    }
    if (saved && current && saved === current) {
      return {
        status: 'fresh',
        label: 'Fresh',
        tone: 'success',
        refreshRecommended: false
      };
    }
    if (sourceMode === 'deterministic_preview' || sourceMode === 'local_preview') {
      return {
        status: 'preview',
        label: 'Preview',
        tone: 'neutral',
        refreshRecommended: false
      };
    }
    return {
      status: 'saved',
      label: 'Saved',
      tone: 'neutral',
      refreshRecommended: false
    };
  }

  function buildAiOutputState({
    key = '',
    label = '',
    output = null,
    meta = null,
    currentFingerprint = '',
    hasOutput
  } = {}) {
    const outputObject = isPlainObject(output) ? output : {};
    const metaObject = isPlainObject(meta) ? meta : {};
    const useful = typeof hasOutput === 'boolean' ? hasOutput : hasUsefulOutput(outputObject);
    const usedFallback = outputObject.usedFallback === true || metaObject.usedFallback === true;
    const aiUnavailable = outputObject.aiUnavailable === true || metaObject.aiUnavailable === true;
    const mode = normaliseMode(outputObject.sourceMode || outputObject.mode || metaObject.mode || '', {
      usedFallback,
      aiUnavailable,
      hasOutput: useful
    });
    const savedFingerprint = cleanText(outputObject.inputFingerprint || metaObject.inputFingerprint || outputObject.workflowFingerprint || metaObject.workflowFingerprint || '');
    const freshness = resolveFreshness({
      hasOutput: useful,
      savedFingerprint,
      currentFingerprint,
      sourceMode: mode
    });
    const outputLabel = cleanText(label || key || 'AI output');
    const generatedAt = cleanText(outputObject.generatedAt || metaObject.generatedAt || '');
    const recommendedAction = freshness.status === 'stale'
      ? `Refresh ${outputLabel}`
      : !useful
        ? `Generate ${outputLabel}`
        : `Review ${outputLabel}`;
    const refreshReason = freshness.status === 'stale'
      ? `${outputLabel} no longer matches the current inputs.`
      : !useful
        ? `${outputLabel} has not been generated yet.`
        : '';
    return {
      key: cleanText(key || outputLabel).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
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
      currentFingerprint: cleanText(currentFingerprint),
      freshnessStatus: freshness.status,
      freshnessLabel: freshness.label,
      freshnessTone: freshness.tone,
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
    const recommended = stale[0] || empty[0] || states.find((item) => item.refreshRecommended) || null;
    const modeLabel = !hasOutput
      ? 'No AI outputs'
      : live.length && fallback.length
        ? 'Mixed AI/fallback'
        : live.length
          ? 'Live AI'
          : fallback.length
            ? 'Deterministic fallback'
            : 'Saved support outputs';
    const tone = stale.length || unavailable.length || fallback.length ? 'warning' : live.length ? 'success' : 'neutral';
    return {
      outputs: states,
      hasOutput,
      staleCount: stale.length,
      emptyCount: empty.length,
      liveCount: live.length,
      fallbackCount: fallback.length,
      unavailableCount: unavailable.length,
      modeLabel,
      tone,
      recommendedAction: recommended?.recommendedAction || 'Review AI support',
      recommendedKey: recommended?.key || '',
      recommendedReason: recommended?.refreshReason || ''
    };
  }

  function buildAssessmentAiState(assessment = {}, { currentFingerprints = {} } = {}) {
    const outputs = [
      buildAiOutputState({
        key: 'projectExposure',
        label: 'Project exposure map',
        output: assessment.projectExposure,
        meta: assessment.projectExposureMeta,
        currentFingerprint: currentFingerprints.projectExposure
      }),
      buildAiOutputState({
        key: 'assumptionRegister',
        label: 'Assumption Register',
        output: assessment.assumptionRegister,
        meta: assessment.assumptionRegisterMeta,
        currentFingerprint: currentFingerprints.assumptionRegister
      }),
      buildAiOutputState({
        key: 'parameterCoach',
        label: 'Parameter Coach',
        output: assessment.parameterCoach,
        meta: assessment.parameterCoachMeta,
        currentFingerprint: currentFingerprints.parameterCoach
      }),
      buildAiOutputState({
        key: 'evidenceMap',
        label: 'Evidence Map',
        output: assessment.evidenceMap,
        meta: assessment.evidenceMapMeta,
        currentFingerprint: currentFingerprints.evidenceMap
      }),
      buildAiOutputState({
        key: 'decisionChallenge',
        label: 'Challenge Agent',
        output: assessment.decisionChallenge,
        meta: assessment.decisionChallengeMeta,
        currentFingerprint: currentFingerprints.decisionChallenge
      }),
      buildAiOutputState({
        key: 'decisionBrief',
        label: 'Decision Brief',
        output: assessment.decisionBrief,
        meta: assessment.decisionBriefMeta,
        currentFingerprint: currentFingerprints.decisionBrief
      })
    ];
    return buildAiJourneyState(outputs);
  }

  const api = {
    buildFingerprint,
    stableStringify,
    normaliseMode,
    getModeLabel,
    getModeTone,
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
