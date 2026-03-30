'use strict';

const LearningStore = (() => {
  const DEFAULT_ANALYST_SIGNALS = {
    keptRisks: [],
    removedRisks: [],
    narrativeEdits: [],
    rerunDeltas: []
  };

  const DEFAULT_STORE = {
    templates: {},
    scenarioPatterns: [],
    analystSignals: DEFAULT_ANALYST_SIGNALS
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
      scenarioPatterns: [],
      analystSignals: {
        keptRisks: [],
        removedRisks: [],
        narrativeEdits: [],
        rerunDeltas: []
      }
    };
  }

  function _normaliseText(value = '', max = 220) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function _normaliseAnalystSignals(signals) {
    const source = signals && typeof signals === 'object' ? signals : {};
    return {
      keptRisks: Array.isArray(source.keptRisks) ? source.keptRisks.filter(Boolean) : [],
      removedRisks: Array.isArray(source.removedRisks) ? source.removedRisks.filter(Boolean) : [],
      narrativeEdits: Array.isArray(source.narrativeEdits) ? source.narrativeEdits.filter(Boolean) : [],
      rerunDeltas: Array.isArray(source.rerunDeltas) ? source.rerunDeltas.filter(Boolean) : []
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
    const analystSignals = _normaliseAnalystSignals(source.analystSignals);
    return { templates, scenarioPatterns, analystSignals };
  }

  function _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function _inferFunctionKey(source = {}) {
    const direct = String(source?.scenarioLens?.functionKey || source?.functionKey || '').trim().toLowerCase();
    if (direct) return direct;
    const lensKey = String(source?.scenarioLens?.key || '').trim().toLowerCase();
    if (lensKey === 'financial') return 'finance';
    if (lensKey === 'fraud-integrity') return 'finance';
    if (['procurement', 'supply-chain', 'third-party'].includes(lensKey)) return 'procurement';
    if (lensKey === 'data-governance' || lensKey === 'legal-contract') return 'compliance';
    if (['compliance', 'regulatory'].includes(lensKey)) return 'compliance';
    if (lensKey === 'people-workforce') return 'hse';
    if (lensKey === 'hse') return 'hse';
    if (['strategic', 'esg', 'geopolitical', 'investment-jv', 'transformation-delivery'].includes(lensKey)) return 'strategic';
    if (['operational', 'business-continuity', 'physical-security', 'ot-resilience'].includes(lensKey)) return 'operations';
    if (lensKey === 'ai-model-risk') return 'technology';
    if (['ransomware', 'identity', 'phishing', 'insider', 'cloud', 'data-breach', 'cyber'].includes(lensKey)) return 'technology';
    const haystack = [
      source?.title,
      source?.scenarioTitle,
      source?.scenarioType,
      source?.narrative,
      getStructuredScenarioField(source?.structuredScenario, 'eventPath'),
      ...(Array.isArray(source?.selectedRiskTitles) ? source.selectedRiskTitles : [])
    ].filter(Boolean).join(' ').toLowerCase();
    if (/procurement|sourcing|vendor|supplier|purchase|third[- ]party|supply chain|supplier due diligence/.test(haystack)) return 'procurement';
    if (/compliance|regulatory|legal|privacy|policy|governance|controls|audit|contract|litigation|intellectual property|data governance/.test(haystack)) return 'compliance';
    if (/finance|treasury|accounting|financial|cash|payment|payroll|credit|collections|ledger|fraud|integrity|financial crime|aml/.test(haystack)) return 'finance';
    if (/hse|ehs|health|safety|environment|workplace safety|injury|spill|worker welfare|labou?r/.test(haystack)) return 'hse';
    if (/strategy|strategic|enterprise|portfolio|transformation|market|growth|investment|esg|sustainability|geopolitical|sanctions|market access|sovereign|merger|acquisition|joint venture|integration/.test(haystack)) return 'strategic';
    if (/technology|cyber|security|identity|cloud|infrastructure|it\b|digital|phishing|ransomware|breach|ai\b|model risk|responsible ai|machine learning|llm|algorithm/.test(haystack)) return 'technology';
    if (/operations|resilience|continuity|service delivery|manufacturing|logistics|facilities|workforce|process failure|backlog|physical security|executive protection|industrial control|ot\b|ics|scada|site systems/.test(haystack)) return 'operations';
    return 'general';
  }

  function _normaliseLensKey(source = {}) {
    const raw = String(
      source?.lensKey ||
      source?.scenarioLens?.key ||
      source?.scenarioLensKey ||
      ''
    ).trim().toLowerCase();
    const aliases = {
      technology: 'cyber',
      'ai-model-risk': 'ai-model-risk',
      'model risk': 'ai-model-risk',
      'data governance': 'data-governance',
      privacy: 'data-governance',
      'fraud-integrity': 'fraud-integrity',
      fraud: 'fraud-integrity',
      integrity: 'fraud-integrity',
      legal: 'legal-contract',
      contract: 'legal-contract',
      geopolitical: 'geopolitical',
      sanctions: 'geopolitical',
      'physical security': 'physical-security',
      ot: 'ot-resilience',
      workforce: 'people-workforce',
      labour: 'people-workforce',
      labor: 'people-workforce',
      investment: 'investment-jv',
      'transformation delivery': 'transformation-delivery',
      operations: 'operational',
      finance: 'financial',
      continuity: 'business-continuity',
      'business continuity': 'business-continuity',
      'supply chain': 'supply-chain',
      'third party': 'third-party'
    };
    return aliases[raw] || raw || '';
  }

  function _appendSignal(list, item, limit = 40) {
    return [item, ...(Array.isArray(list) ? list : [])].slice(0, limit);
  }

  function _normaliseRiskSignal(payload = {}, action = 'keep') {
    return {
      action,
      recordedAt: Number(payload?.recordedAt || Date.now()),
      buId: _normaliseText(payload?.buId || '', 64),
      functionKey: _inferFunctionKey(payload),
      lensKey: _normaliseLensKey(payload),
      riskTitle: _normaliseText(payload?.riskTitle || payload?.title || '', 180),
      riskCategory: _normaliseText(payload?.riskCategory || payload?.category || '', 90),
      source: _normaliseText(payload?.source || '', 40)
    };
  }

  function _normaliseNarrativeEdit(payload = {}) {
    return {
      recordedAt: Number(payload?.recordedAt || Date.now()),
      buId: _normaliseText(payload?.buId || '', 64),
      functionKey: _inferFunctionKey(payload),
      lensKey: _normaliseLensKey(payload),
      before: _normaliseText(payload?.before || '', 400),
      after: _normaliseText(payload?.after || '', 400),
      changeSummary: _normaliseText(payload?.changeSummary || '', 240)
    };
  }

  function _normaliseRerunDelta(payload = {}) {
    return {
      recordedAt: Number(payload?.recordedAt || Date.now()),
      buId: _normaliseText(payload?.buId || '', 64),
      functionKey: _inferFunctionKey(payload),
      lensKey: _normaliseLensKey(payload),
      baselineTitle: _normaliseText(payload?.baselineTitle || '', 180),
      deltaDirection: _normaliseText(payload?.deltaDirection || '', 40),
      annualDirection: _normaliseText(payload?.annualDirection || '', 40),
      keyDriver: _normaliseText(payload?.keyDriver || '', 240),
      summary: _normaliseText(payload?.summary || '', 260)
    };
  }

  function _signalMatches(signal = {}, filters = {}) {
    const buId = _normaliseText(filters?.buId || '', 64);
    const functionKey = _normaliseText(filters?.functionKey || '', 64).toLowerCase();
    const lensKey = _normaliseLensKey(filters);
    if (buId && String(signal?.buId || '').trim() && String(signal.buId).trim() !== buId) return false;
    if (functionKey && String(signal?.functionKey || '').trim().toLowerCase() && String(signal.functionKey).trim().toLowerCase() !== functionKey) return false;
    if (lensKey && String(signal?.lensKey || '').trim().toLowerCase() && String(signal.lensKey).trim().toLowerCase() !== lensKey) return false;
    return true;
  }

  function _incrementMapValue(target, key) {
    const safeKey = _normaliseText(key || '', 180);
    if (!safeKey) return;
    target[safeKey] = Number(target[safeKey] || 0) + 1;
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
      functionKey: _inferFunctionKey(template),
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
      scenarioType: String(getStructuredScenarioField(draft?.structuredScenario, 'eventPath') || '').trim(),
      functionKey: _inferFunctionKey(draft),
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
        functionKey: _inferFunctionKey(pattern),
        scenarioLens: pattern?.scenarioLens && typeof pattern.scenarioLens === 'object'
          ? { ...pattern.scenarioLens }
          : null,
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
      functionKey: _inferFunctionKey(assessment),
      scenarioLens: assessment?.scenarioLens && typeof assessment.scenarioLens === 'object'
        ? { ...assessment.scenarioLens }
        : null,
      title: String(assessment.scenarioTitle || getStructuredScenarioField(assessment.structuredScenario, 'eventPath') || '').trim(),
      scenarioType: String(getStructuredScenarioField(assessment.structuredScenario, 'eventPath') || assessment.scenarioTitle || '').trim(),
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

  function recordRiskDecision(username, payload = {}) {
    try {
      const store = getLearningStore(username);
      const signal = _normaliseRiskSignal(payload, payload?.action === 'remove' ? 'remove' : 'keep');
      if (!signal.riskTitle) return null;
      const nextSignals = _normaliseAnalystSignals(store.analystSignals);
      if (signal.action === 'remove') {
        nextSignals.removedRisks = _appendSignal(nextSignals.removedRisks, signal);
      } else {
        nextSignals.keptRisks = _appendSignal(nextSignals.keptRisks, signal);
      }
      store.analystSignals = nextSignals;
      saveLearningStore(username, store);
      return signal;
    } catch {
      return null;
    }
  }

  function recordNarrativeEdit(username, payload = {}) {
    try {
      const store = getLearningStore(username);
      const signal = _normaliseNarrativeEdit(payload);
      if (!signal.before || !signal.after || signal.before === signal.after) return null;
      const nextSignals = _normaliseAnalystSignals(store.analystSignals);
      nextSignals.narrativeEdits = _appendSignal(nextSignals.narrativeEdits, signal);
      store.analystSignals = nextSignals;
      saveLearningStore(username, store);
      return signal;
    } catch {
      return null;
    }
  }

  function recordRerunDelta(username, payload = {}) {
    try {
      const store = getLearningStore(username);
      const signal = _normaliseRerunDelta(payload);
      if (!signal.baselineTitle && !signal.keyDriver && !signal.summary) return null;
      const nextSignals = _normaliseAnalystSignals(store.analystSignals);
      nextSignals.rerunDeltas = _appendSignal(nextSignals.rerunDeltas, signal);
      store.analystSignals = nextSignals;
      saveLearningStore(username, store);
      return signal;
    } catch {
      return null;
    }
  }

  function getRiskSignalSummary(username, filters = {}) {
    const signals = _normaliseAnalystSignals(getLearningStore(username).analystSignals);
    const keptByTitle = {};
    const removedByTitle = {};
    const kept = signals.keptRisks.filter(signal => _signalMatches(signal, filters));
    const removed = signals.removedRisks.filter(signal => _signalMatches(signal, filters));
    kept.forEach(signal => _incrementMapValue(keptByTitle, signal.riskTitle));
    removed.forEach(signal => _incrementMapValue(removedByTitle, signal.riskTitle));
    const narrativeEdits = signals.narrativeEdits.filter(signal => _signalMatches(signal, filters));
    const rerunDeltas = signals.rerunDeltas.filter(signal => _signalMatches(signal, filters));
    return {
      keptByTitle,
      removedByTitle,
      narrativeEditCount: narrativeEdits.length,
      latestNarrativeEdit: narrativeEdits[0] || null,
      rerunCount: rerunDeltas.length,
      rerunDrivers: Array.from(new Set(rerunDeltas.map(signal => String(signal.keyDriver || '').trim()).filter(Boolean))).slice(0, 3)
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
    patternFromAssessment,
    recordRiskDecision,
    recordNarrativeEdit,
    recordRerunDelta,
    getRiskSignalSummary
  };
})();
