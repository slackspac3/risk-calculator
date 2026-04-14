'use strict';

const LearningStore = (() => {
  const DEFAULT_ANALYST_SIGNALS = {
    keptRisks: [],
    removedRisks: [],
    narrativeEdits: [],
    rerunDeltas: []
  };
  const DEFAULT_AI_FEEDBACK = {
    events: []
  };

  const DEFAULT_STORE = {
    templates: {},
    scenarioPatterns: [],
    analystSignals: DEFAULT_ANALYST_SIGNALS,
    aiFeedback: DEFAULT_AI_FEEDBACK
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
      },
      aiFeedback: {
        events: []
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

  function _normaliseReasonTag(value = '') {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  function _normaliseFeedbackTitleList(list = [], limit = 10, max = 160) {
    return Array.from(new Set(
      (Array.isArray(list) ? list : [])
        .map(item => _normaliseText(item, max))
        .filter(Boolean)
    )).slice(0, limit);
  }

  function _normaliseFeedbackCitationList(list = []) {
    return (Array.isArray(list) ? list : [])
      .map(item => ({
        docId: _normaliseText(item?.docId || item?.id || '', 120),
        title: _normaliseText(item?.title || item?.sourceTitle || '', 180),
        tags: _normaliseFeedbackTitleList(item?.tags, 8, 60)
      }))
      .filter(item => item.docId || item.title)
      .slice(0, 8);
  }

  function _normaliseRuntimeMode(value = '') {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'live_ai' || raw === 'live-ai' || raw === 'live') return 'live_ai';
    if (raw === 'fallback' || raw === 'stub') return 'fallback';
    return 'local';
  }

  function _normaliseFeedbackTarget(value = '') {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'shortlist') return 'shortlist';
    if (raw === 'risk' || raw === 'risk-card' || raw === 'risk_card') return 'risk';
    return 'draft';
  }

  function _clampScore(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return 0;
    return Math.max(1, Math.min(5, Math.round(score)));
  }

  function _normaliseAiFeedbackEvent(payload = {}) {
    const target = _normaliseFeedbackTarget(payload?.target);
    const score = _clampScore(payload?.score);
    return {
      id: _normaliseText(payload?.id || _generateId('feedback'), 120),
      target,
      recordedAt: Number(payload?.recordedAt || Date.now()),
      runtimeMode: _normaliseRuntimeMode(payload?.runtimeMode),
      buId: _normaliseText(payload?.buId || '', 64),
      functionKey: _inferFunctionKey(payload),
      lensKey: _normaliseLensKey(payload),
      score,
      reasons: Array.from(new Set(
        (Array.isArray(payload?.reasons) ? payload.reasons : [])
          .map(_normaliseReasonTag)
          .filter(Boolean)
      )).slice(0, 6),
      scenarioFingerprint: _normaliseText(payload?.scenarioFingerprint || '', 260),
      outputFingerprint: _normaliseText(payload?.outputFingerprint || '', 260),
      riskId: _normaliseText(payload?.riskId || '', 120),
      riskTitle: _normaliseText(payload?.riskTitle || '', 180),
      riskCategory: _normaliseText(payload?.riskCategory || '', 90),
      riskSource: _normaliseText(payload?.riskSource || '', 40),
      selectedInAssessment: payload?.selectedInAssessment === true ? true : payload?.selectedInAssessment === false ? false : null,
      shownRiskTitles: _normaliseFeedbackTitleList(payload?.shownRiskTitles, 10),
      keptRiskTitles: _normaliseFeedbackTitleList(payload?.keptRiskTitles, 10),
      removedRiskTitles: _normaliseFeedbackTitleList(payload?.removedRiskTitles, 10),
      addedRiskTitles: _normaliseFeedbackTitleList(payload?.addedRiskTitles, 10),
      citations: _normaliseFeedbackCitationList(payload?.citations),
      submittedBy: _normalizeUsername(payload?.submittedBy || '')
    };
  }

  function _normaliseAiFeedbackSection(section) {
    const source = section && typeof section === 'object' ? section : {};
    return {
      events: Array.isArray(source.events)
        ? source.events
            .map(_normaliseAiFeedbackEvent)
            .filter(item => item.score >= 1 && item.score <= 5)
            .slice(0, 120)
        : []
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
    const aiFeedback = _normaliseAiFeedbackSection(source.aiFeedback);
    return { templates, scenarioPatterns, analystSignals, aiFeedback };
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
      source: _normaliseText(payload?.source || '', 40),
      reason: _normaliseReasonTag(payload?.reason || payload?.decisionReason || ''),
      scenarioFingerprint: _normaliseText(payload?.scenarioFingerprint || '', 260)
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

  function _incrementWeightedMapValue(target, key, amount = 0, max = 180) {
    const safeKey = _normaliseText(key || '', max);
    if (!safeKey || !Number.isFinite(amount) || amount === 0) return;
    target[safeKey] = Number(target[safeKey] || 0) + amount;
  }

  function _feedbackMatches(event = {}, filters = {}) {
    if (_signalMatches(event, filters) === false) return false;
    const target = _normaliseFeedbackTarget(filters?.target || '');
    if (filters?.target && event.target !== target) return false;
    const runtimeModes = Array.isArray(filters?.runtimeModes) && filters.runtimeModes.length
      ? filters.runtimeModes.map(_normaliseRuntimeMode)
      : [];
    if (runtimeModes.length && !runtimeModes.includes(_normaliseRuntimeMode(event.runtimeMode))) return false;
    return true;
  }

  function _scoreDelta(score) {
    return (_clampScore(score) - 3) / 2;
  }

  function _buildEmptyAiFeedbackProfile() {
    return {
      totalEvents: 0,
      liveAiEvents: 0,
      distinctUsers: 0,
      runtimeCounts: {
        live_ai: 0,
        fallback: 0,
        local: 0
      },
      draft: {
        count: 0,
        averageScore: 0,
        totalScore: 0,
        reasons: {}
      },
      shortlist: {
        count: 0,
        averageScore: 0,
        totalScore: 0,
        reasons: {}
      },
      risk: {
        count: 0,
        averageScore: 0,
        totalScore: 0,
        reasons: {}
      },
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

  function _finaliseAiFeedbackProfile(profile = {}) {
    const next = profile && typeof profile === 'object' ? profile : _buildEmptyAiFeedbackProfile();
    if (next.draft.count) {
      next.draft.averageScore = Number((next.draft.totalScore / next.draft.count).toFixed(2));
    }
    if (next.shortlist.count) {
      next.shortlist.averageScore = Number((next.shortlist.totalScore / next.shortlist.count).toFixed(2));
    }
    if (next.risk.count) {
      next.risk.averageScore = Number((next.risk.totalScore / next.risk.count).toFixed(2));
    }
    next.topPositiveRisks = Object.entries(next.riskWeights || {})
      .filter(([, value]) => Number(value) > 0.35)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([title, weight]) => ({ title, weight: Number(weight.toFixed(2)) }));
    next.topNegativeRisks = Object.entries(next.riskWeights || {})
      .filter(([, value]) => Number(value) < -0.35)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([title, weight]) => ({ title, weight: Number(weight.toFixed(2)) }));
    next.topPositiveDocs = Object.entries(next.docWeights || {})
      .filter(([, value]) => Number(value) > 0.35)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([docId, weight]) => ({ docId, weight: Number(weight.toFixed(2)) }));
    next.topNegativeDocs = Object.entries(next.docWeights || {})
      .filter(([, value]) => Number(value) < -0.35)
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([docId, weight]) => ({ docId, weight: Number(weight.toFixed(2)) }));
    return next;
  }

  function _buildAiFeedbackProfile(events = []) {
    const profile = _buildEmptyAiFeedbackProfile();
    const submitters = new Set();
    (Array.isArray(events) ? events : []).forEach(event => {
      if (!event || !_clampScore(event.score)) return;
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
      const baseDelta = _scoreDelta(event.score);
      if (event.target === 'risk') {
        const riskTitle = _normaliseText(event.riskTitle || '', 180);
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
    return _finaliseAiFeedbackProfile(profile);
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
    const resolvedTitle = typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle({
          ...draft,
          narrative: String(draft?.narrative || '').trim(),
          enhancedNarrative: String(draft?.enhancedNarrative || draft?.narrative || '').trim()
        })
      : String(draft?.scenarioTitle || '').trim();
    return {
      id: String(draft?.templateId || '').trim(),
      title: resolvedTitle,
      scenarioType: String(getStructuredScenarioField(draft?.structuredScenario, 'eventPath') || resolvedTitle || '').trim(),
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
    const resolvedTitle = typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle({
          ...assessment,
          narrative: String(assessment?.narrative || '').trim(),
          enhancedNarrative: String(assessment?.enhancedNarrative || assessment?.narrative || '').trim()
        })
      : String(assessment.scenarioTitle || getStructuredScenarioField(assessment.structuredScenario, 'eventPath') || '').trim();
    return {
      id: String(assessment.id || '').trim(),
      buId: String(assessment.buId || '').trim(),
      functionKey: _inferFunctionKey(assessment),
      scenarioLens: assessment?.scenarioLens && typeof assessment.scenarioLens === 'object'
        ? { ...assessment.scenarioLens }
        : null,
      title: resolvedTitle,
      scenarioType: String(getStructuredScenarioField(assessment.structuredScenario, 'eventPath') || resolvedTitle || '').trim(),
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

  function recordAiFeedback(username, payload = {}) {
    try {
      const store = getLearningStore(username);
      const event = _normaliseAiFeedbackEvent({
        ...payload,
        submittedBy: payload?.submittedBy || username
      });
      if (!event.score) return null;
      const nextFeedback = _normaliseAiFeedbackSection(store.aiFeedback);
      nextFeedback.events = _appendSignal(nextFeedback.events, event, 120);
      store.aiFeedback = nextFeedback;
      saveLearningStore(username, store);
      return event;
    } catch {
      return null;
    }
  }

  function getAiFeedbackEvents(username, filters = {}) {
    const events = _normaliseAiFeedbackSection(getLearningStore(username).aiFeedback).events;
    return events.filter(event => _feedbackMatches(event, filters));
  }

  function getAiFeedbackProfile(username, filters = {}) {
    return _buildAiFeedbackProfile(getAiFeedbackEvents(username, filters));
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
    getRiskSignalSummary,
    recordAiFeedback,
    getAiFeedbackEvents,
    getAiFeedbackProfile
  };
})();

if (typeof module !== 'undefined') module.exports = LearningStore;
