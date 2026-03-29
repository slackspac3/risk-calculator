'use strict';

const LearningStore = (() => {
  const DEFAULT_STORE = {
    templates: {},
    scenarioPatterns: []
  };

  function _normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  function _buildStorageKey(username) {
    return `rq_learning_store_${_normalizeUsername(username)}`;
  }

  function _cloneDefaultStore() {
    return {
      templates: {},
      scenarioPatterns: []
    };
  }

  function _normalizeStore(store) {
    const source = store && typeof store === 'object' ? store : {};
    const templates = source.templates && typeof source.templates === 'object'
      ? source.templates
      : {};
    const scenarioPatterns = Array.isArray(source.scenarioPatterns)
      ? source.scenarioPatterns
      : [];
    return { templates, scenarioPatterns };
  }

  function _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function getLearningStore(username) {
    try {
      const raw = localStorage.getItem(_buildStorageKey(username));
      if (!raw) return _cloneDefaultStore();
      return _normalizeStore(JSON.parse(raw));
    } catch {
      return _cloneDefaultStore();
    }
  }

  function saveLearningStore(username, store) {
    try {
      localStorage.setItem(_buildStorageKey(username), JSON.stringify(_normalizeStore(store)));
    } catch {}
  }

  function getTemplates(username) {
    try {
      return Object.values(getLearningStore(username).templates || {})
        .filter(Boolean)
        .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
    } catch {
      return [];
    }
  }

  function saveTemplate(username, template) {
    const store = getLearningStore(username);
    const savedTemplate = {
      id: String(template?.id || _generateId('tmpl')).trim(),
      title: String(template?.title || '').trim(),
      scenarioType: String(template?.scenarioType || '').trim(),
      buId: String(template?.buId || '').trim(),
      buName: String(template?.buName || '').trim(),
      geography: String(template?.geography || '').trim(),
      narrative: String(template?.narrative || '').trim(),
      guidedInput: template?.guidedInput && typeof template.guidedInput === 'object'
        ? template.guidedInput
        : {},
      selectedRisks: Array.isArray(template?.selectedRisks) ? template.selectedRisks : [],
      applicableRegulations: Array.isArray(template?.applicableRegulations) ? template.applicableRegulations : [],
      savedAt: Date.now()
    };
    store.templates[savedTemplate.id] = savedTemplate;
    saveLearningStore(username, store);
    return savedTemplate;
  }

  function deleteTemplate(username, templateId) {
    try {
      const store = getLearningStore(username);
      delete store.templates[String(templateId || '').trim()];
      saveLearningStore(username, store);
    } catch {}
  }

  function templateFromDraft(draft) {
    return {
      id: String(draft?.templateId || '').trim(),
      title: String(draft?.scenarioTitle || '').trim(),
      scenarioType: String(draft?.structuredScenario?.attackType || '').trim(),
      buId: String(draft?.buId || '').trim(),
      buName: String(draft?.buName || '').trim(),
      geography: String(draft?.geography || '').trim(),
      narrative: String(draft?.enhancedNarrative || draft?.narrative || '').trim(),
      guidedInput: draft?.guidedInput && typeof draft.guidedInput === 'object'
        ? draft.guidedInput
        : {},
      selectedRisks: Array.isArray(draft?.selectedRisks) ? draft.selectedRisks : [],
      applicableRegulations: Array.isArray(draft?.applicableRegulations) ? draft.applicableRegulations : []
    };
  }

  function getScenarioPatterns(username, buId, limit = 3) {
    try {
      const patterns = getLearningStore(username).scenarioPatterns || [];
      const scopedBuId = String(buId || '').trim();
      return patterns
        .filter(pattern => !scopedBuId || String(pattern?.buId || '').trim() === scopedBuId)
        .sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0))
        .slice(0, Math.max(0, Number(limit) || 0));
    } catch {
      return [];
    }
  }

  function saveScenarioPattern(username, pattern) {
    try {
      const store = getLearningStore(username);
      const savedPattern = {
        id: String(pattern?.id || _generateId('pattern')).trim(),
        buId: String(pattern?.buId || '').trim(),
        title: String(pattern?.title || '').trim(),
        scenarioType: String(pattern?.scenarioType || '').trim(),
        geography: String(pattern?.geography || '').trim(),
        narrative: String(pattern?.narrative || '').trim(),
        guidedInput: pattern?.guidedInput && typeof pattern.guidedInput === 'object'
          ? {
              event: String(pattern.guidedInput.event || '').trim(),
              asset: String(pattern.guidedInput.asset || '').trim(),
              cause: String(pattern.guidedInput.cause || '').trim(),
              impact: String(pattern.guidedInput.impact || '').trim(),
              urgency: String(pattern.guidedInput.urgency || '').trim()
            }
          : {},
        selectedRiskTitles: Array.isArray(pattern?.selectedRiskTitles)
          ? pattern.selectedRiskTitles.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
          : [],
        posture: String(pattern?.posture || '').trim(),
        confidenceLabel: String(pattern?.confidenceLabel || 'Moderate confidence').trim(),
        topGap: String(pattern?.topGap || '').trim(),
        keyRecommendation: String(pattern?.keyRecommendation || '').trim(),
        completedAt: Number(pattern?.completedAt || Date.now())
      };
      store.scenarioPatterns = [
        savedPattern,
        ...(Array.isArray(store.scenarioPatterns) ? store.scenarioPatterns : []).filter(item => item?.id !== savedPattern.id)
      ].slice(0, 20);
      saveLearningStore(username, store);
      return savedPattern;
    } catch {
      return null;
    }
  }

  function patternFromAssessment(assessment) {
    if (!assessment || !assessment.results) return null;
    return {
      id: String(assessment.id || '').trim(),
      buId: String(assessment.buId || '').trim(),
      title: String(assessment.scenarioTitle || assessment.structuredScenario?.attackType || '').trim(),
      scenarioType: String(assessment.structuredScenario?.attackType || assessment.scenarioTitle || '').trim(),
      geography: String(assessment.geography || '').trim(),
      narrative: String(assessment.enhancedNarrative || assessment.narrative || '').trim(),
      guidedInput: assessment?.guidedInput && typeof assessment.guidedInput === 'object'
        ? {
            event: String(assessment.guidedInput.event || '').trim(),
            asset: String(assessment.guidedInput.asset || '').trim(),
            cause: String(assessment.guidedInput.cause || '').trim(),
            impact: String(assessment.guidedInput.impact || '').trim(),
            urgency: String(assessment.guidedInput.urgency || '').trim()
          }
        : {},
      selectedRiskTitles: Array.isArray(assessment?.selectedRisks)
        ? assessment.selectedRisks.map(item => String(item?.title || '').trim()).filter(Boolean).slice(0, 4)
        : [],
      posture: assessment.results.toleranceBreached
        ? 'above-tolerance'
        : assessment.results.nearTolerance
          ? 'near-tolerance'
          : 'within-tolerance',
      confidenceLabel: String(assessment.confidenceLabel || 'Moderate confidence').trim(),
      topGap: Array.isArray(assessment.missingInformation) && assessment.missingInformation.length
        ? String(assessment.missingInformation[0]).trim()
        : '',
      keyRecommendation: Array.isArray(assessment.recommendations) && assessment.recommendations.length
        ? String(assessment.recommendations[0]?.title || '').trim()
        : '',
      completedAt: Number(assessment.completedAt || Date.now())
    };
  }

  return {
    getLearningStore,
    saveLearningStore,
    getTemplates,
    saveTemplate,
    deleteTemplate,
    templateFromDraft,
    getScenarioPatterns,
    saveScenarioPattern,
    patternFromAssessment
  };
})();
