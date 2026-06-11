'use strict';

const LearningStore = (() => {
  const DEFAULT_ANALYST_SIGNALS = {
    keptRisks: [],
    removedRisks: [],
    narrativeEdits: [],
    rerunDeltas: []
  };
  const DEFAULT_AI_FEEDBACK = {
    events: [],
    structuredEvents: []
  };

  const STRUCTURED_AI_FEEDBACK_REASON_TAXONOMIES = Object.freeze({
    risk_card_removal: Object.freeze([
      'wrong_domain',
      'too_generic',
      'not_material',
      'duplicate',
      'missing_evidence',
      'wrong_consequence',
      'wrong_event_path',
      'wrong_project_economics',
      'other'
    ]),
    narrative_edit: Object.freeze([
      'event_wording',
      'impact_wording',
      'asset_service',
      'cause_trigger',
      'regulatory_framing',
      'project_framing',
      'management_recommendation',
      'tone_clarity',
      'other'
    ]),
    parameter_change: Object.freeze([
      'better_internal_data',
      'expert_judgement',
      'too_conservative',
      'too_optimistic',
      'not_applicable',
      'weak_evidence',
      'project_financial_input',
      'benchmark_too_high',
      'benchmark_too_low',
      'stress_case',
      'other'
    ]),
    project_exposure_correction: Object.freeze([
      'missing_project_value',
      'known_value_added',
      'wrong_proxy_assumption',
      'incorrect_financial_driver',
      'not_applicable_field',
      'recovery_missing',
      'cap_missing',
      'margin_missing',
      'double_counting_risk',
      'other'
    ]),
    decision_brief_feedback: Object.freeze([
      'wrong_recommendation',
      'missing_action',
      'weak_evidence',
      'unclear_driver',
      'wrong_project_interpretation',
      'overstates_confidence',
      'too_verbose',
      'too_generic',
      'other'
    ])
  });

  const STRUCTURED_SOURCE_STATUSES = Object.freeze([
    'known',
    'estimated',
    'derived',
    'benchmark_proxy',
    'unknown',
    'not_applicable',
    'evidence_supported'
  ]);

  const DEFAULT_STORE = {
    templates: {},
    scenarioPatterns: [],
    caseMemories: [],
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
      caseMemories: [],
      analystSignals: {
        keptRisks: [],
        removedRisks: [],
        narrativeEdits: [],
        rerunDeltas: []
      },
      aiFeedback: {
        events: [],
        structuredEvents: []
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

  function _normaliseStructuredToken(value = '', max = 80) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, max);
  }

  function _normaliseStructuredTargetType(value = '') {
    const raw = _normaliseStructuredToken(value, 80);
    const aliases = {
      risk: 'risk_card',
      risk_card_removed: 'risk_card',
      risk_card_removal: 'risk_card',
      risk_removal: 'risk_card',
      narrative: 'narrative',
      narrative_edit: 'narrative',
      parameter: 'parameter',
      parameter_change: 'parameter',
      parameter_suggestion: 'parameter',
      parameter_coach: 'parameter',
      project_exposure: 'project_exposure',
      project_exposure_map: 'project_exposure',
      decision_brief: 'decision_brief',
      brief: 'decision_brief'
    };
    return aliases[raw] || raw || 'correction';
  }

  function _resolveStructuredTaxonomyKey(targetType = '', eventType = '') {
    const target = _normaliseStructuredTargetType(targetType);
    const event = _normaliseStructuredToken(eventType, 80);
    if (target === 'risk_card' || /risk.*(remove|reject|dismiss)/.test(event)) return 'risk_card_removal';
    if (target === 'narrative' || /narrative|draft|wording/.test(event)) return 'narrative_edit';
    if (target === 'parameter' || /parameter|range|suggestion/.test(event)) return 'parameter_change';
    if (target === 'project_exposure' || /project.*exposure|missing.*value|proxy|cap|margin|recovery/.test(event)) return 'project_exposure_correction';
    if (target === 'decision_brief' || /decision.*brief|brief/.test(event)) return 'decision_brief_feedback';
    return 'project_exposure_correction';
  }

  function _normaliseStructuredReasonCode(targetType = '', reasonCode = '', eventType = '') {
    const taxonomyKey = _resolveStructuredTaxonomyKey(targetType, eventType);
    const taxonomy = STRUCTURED_AI_FEEDBACK_REASON_TAXONOMIES[taxonomyKey] || ['other'];
    const safeReason = _normaliseStructuredToken(reasonCode || 'other', 80);
    return taxonomy.includes(safeReason) ? safeReason : 'other';
  }

  function _normaliseStructuredSourceStatus(value = '') {
    const safe = _normaliseStructuredToken(value, 80);
    if (safe === 'not_provided') return 'unknown';
    if (safe === 'benchmark' || safe === 'proxy') return 'benchmark_proxy';
    return STRUCTURED_SOURCE_STATUSES.includes(safe) ? safe : 'unknown';
  }

  function _normaliseStructuredAssessmentType(value = '') {
    const safe = _normaliseStructuredToken(value, 80);
    if (safe === 'project_buyer' || safe === 'project_seller' || safe === 'enterprise_generic') return safe;
    return safe || '';
  }

  function _normaliseStructuredScenarioLens(value) {
    if (value && typeof value === 'object') {
      return {
        key: _normaliseText(value.key || value.lensKey || '', 80),
        label: _normaliseText(value.label || value.name || '', 120),
        functionKey: _normaliseText(value.functionKey || '', 80).toLowerCase()
      };
    }
    return _normaliseText(value || '', 120);
  }

  function _normaliseStructuredValue(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return _normaliseText(value, 900);
    if (depth >= 2) return _normaliseText(JSON.stringify(value).slice(0, 900), 900);
    if (Array.isArray(value)) {
      return value.slice(0, 12).map(item => _normaliseStructuredValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      return Object.keys(value).slice(0, 24).reduce((accumulator, key) => {
        const safeKey = _normaliseText(key, 80);
        if (!safeKey) return accumulator;
        accumulator[safeKey] = _normaliseStructuredValue(value[key], depth + 1);
        return accumulator;
      }, {});
    }
    return null;
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

  function _safeStructuredScenarioField(structuredScenario, fieldName) {
    const key = String(fieldName || '').trim();
    if (!key) return '';
    try {
      if (typeof getStructuredScenarioField === 'function') {
        return _normaliseText(getStructuredScenarioField(structuredScenario, key) || '', 220);
      }
    } catch {}
    const source = structuredScenario && typeof structuredScenario === 'object' ? structuredScenario : {};
    const direct = source[key];
    if (direct !== null && direct !== undefined && typeof direct !== 'object') {
      return _normaliseText(direct, 220);
    }
    const fields = source.fields && typeof source.fields === 'object' ? source.fields : {};
    const nested = fields[key];
    if (nested !== null && nested !== undefined && typeof nested !== 'object') {
      return _normaliseText(nested, 220);
    }
    return '';
  }

  function _normaliseAssessmentType(value = '') {
    const safe = _normaliseStructuredToken(value, 80);
    if (safe === 'project_buyer' || safe === 'project_seller' || safe === 'enterprise_generic') return safe;
    return 'enterprise_generic';
  }

  function _normaliseCaseScenarioLens(value) {
    if (value && typeof value === 'object') {
      return {
        key: _normaliseText(value.key || value.lensKey || '', 90).toLowerCase(),
        label: _normaliseText(value.label || value.name || '', 140),
        functionKey: _normaliseText(value.functionKey || '', 90).toLowerCase()
      };
    }
    const key = _normaliseText(value || '', 90).toLowerCase();
    return { key, label: key, functionKey: '' };
  }

  function _normaliseCaseSourceStatus(value = '') {
    const safe = _normaliseStructuredSourceStatus(value || '');
    if (safe === 'not_provided') return 'unknown';
    return safe || 'unknown';
  }

  function _sourceStatusFromMeta(meta, fieldName, fallbackValue = null) {
    const field = String(fieldName || '').trim();
    const source = meta && typeof meta === 'object' ? meta : {};
    const raw = source[field]?.status || source[field]?.sourceStatus || source[field] || '';
    const normalised = _normaliseCaseSourceStatus(raw);
    if (normalised !== 'unknown') return normalised;
    if (fallbackValue === 0) return 'known';
    if (fallbackValue !== null && fallbackValue !== undefined && fallbackValue !== '' && Number.isFinite(Number(fallbackValue))) return 'known';
    return 'unknown';
  }

  function _formatCaseSourceStatus(value = '') {
    const status = _normaliseCaseSourceStatus(value);
    if (status === 'known' || status === 'evidence_supported' || status === 'derived') return 'confirmed';
    if (status === 'estimated') return 'estimated';
    if (status === 'benchmark_proxy') return 'benchmark proxy';
    return 'unknown / not reusable';
  }

  function _caseStatusReusable(value = '') {
    const status = _normaliseCaseSourceStatus(value);
    return status === 'known' || status === 'estimated' || status === 'derived' || status === 'evidence_supported';
  }

  function _caseTextFromItem(item, max = 220) {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      return _normaliseText(item, max);
    }
    if (typeof item !== 'object') return '';
    return _normaliseText(
      item.statement
      || item.title
      || item.label
      || item.item
      || item.claim
      || item.field
      || item.driver
      || item.question
      || item.action
      || item.summary
      || item.text
      || '',
      max
    );
  }

  function _normaliseCaseTextList(list = [], limit = 6, max = 220) {
    const source = Array.isArray(list) ? list : (list ? [list] : []);
    return Array.from(new Set(
      source
        .map(item => _caseTextFromItem(item, max))
        .filter(Boolean)
    )).slice(0, limit);
  }

  function _normaliseCaseSourceList(list = [], defaultStatus = 'unknown', limit = 8) {
    const source = Array.isArray(list) ? list : (list ? [list] : []);
    const seen = new Set();
    const output = [];
    source.forEach((item) => {
      const label = _caseTextFromItem(item, 220);
      if (!label) return;
      const rawStatus = item && typeof item === 'object'
        ? item.sourceStatus || item.status || item.driverStatus || item.source || defaultStatus
        : defaultStatus;
      const sourceStatus = String(rawStatus || '').trim() === 'benchmark_proxy_driver'
        ? 'benchmark_proxy'
        : _normaliseCaseSourceStatus(rawStatus);
      const key = `${label.toLowerCase()}::${sourceStatus}`;
      if (seen.has(key)) return;
      seen.add(key);
      output.push({
        label,
        sourceStatus,
        confidence: item && typeof item === 'object'
          ? _normaliseStructuredToken(item.confidence || '', 40) || 'unknown'
          : 'unknown',
        reusableLabel: _formatCaseSourceStatus(sourceStatus),
        reusable: _caseStatusReusable(sourceStatus)
      });
    });
    return output.slice(0, limit);
  }

  function _normaliseCaseMemoryArray(value = [], limit = 80) {
    return (Array.isArray(value) ? value : [])
      .map(_normaliseCaseMemory)
      .filter(Boolean)
      .slice(0, limit);
  }

  function _tokeniseCaseMemoryText(value = '') {
    return Array.from(new Set(
      String(value || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 2)
        .filter(token => !['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'your', 'have', 'will', 'risk', 'case', 'assessment'].includes(token))
    ));
  }

  function _countCaseTokenOverlap(left = '', right = '') {
    const leftTokens = _tokeniseCaseMemoryText(left);
    const rightSet = new Set(_tokeniseCaseMemoryText(right));
    return leftTokens.filter(token => rightSet.has(token)).length;
  }

  function _normaliseCaseSecondaryFamilies(value = []) {
    const source = Array.isArray(value) ? value : (value ? [value] : []);
    return Array.from(new Set(
      source
        .map(item => _normaliseText(item?.key || item?.functionKey || item?.label || item, 90).toLowerCase())
        .filter(Boolean)
    )).slice(0, 6);
  }

  function _extractDecisionPosture(assessment = {}) {
    const direct = _normaliseText(
      assessment?.decisionPosture
      || assessment?.decisionBrief?.decisionPosture
      || assessment?.decisionBrief?.recommendationPosture
      || '',
      80
    ).toLowerCase();
    if (direct) return direct;
    if (assessment?.results?.toleranceBreached) return 'escalate';
    if (assessment?.results?.nearTolerance) return 'proceed_with_controls';
    if (assessment?.results) return 'proceed';
    return '';
  }

  function _extractTopLossDriver(assessment = {}) {
    const direct = _normaliseText(
      assessment?.topLossDriver
      || assessment?.results?.topLossDriver
      || assessment?.structuredScenario?.primaryDriver
      || _safeStructuredScenarioField(assessment?.structuredScenario, 'primaryDriver')
      || '',
      160
    );
    if (direct) return direct;
    const params = assessment?.fairParams || assessment?.results?.inputs || assessment?.parameters || {};
    const buckets = [
      ['incidentResponseLikely', 'Incident response'],
      ['businessInterruptionLikely', 'Business interruption'],
      ['dataRemediationLikely', 'Data remediation'],
      ['regulatoryLegalLikely', 'Regulatory/legal'],
      ['thirdPartyLikely', 'Third party'],
      ['reputationContractLikely', 'Reputation/contract'],
      ['secondaryLossLikely', 'Secondary loss']
    ];
    return buckets
      .map(([key, label]) => ({ label, value: Number(params?.[key]) }))
      .filter(item => Number.isFinite(item.value))
      .sort((a, b) => b.value - a.value)[0]?.label || '';
  }

  function _extractPrimaryProjectDriver(projectExposure = {}) {
    const drivers = Array.isArray(projectExposure?.financialDrivers) ? projectExposure.financialDrivers : [];
    const driver = drivers.find(item => item && typeof item === 'object' && String(item.driverType || '').trim() !== 'recovery_offset')
      || drivers.find(item => item && typeof item === 'object')
      || null;
    return _normaliseText(driver?.label || driver?.id || driver?.driverType || '', 180);
  }

  function _extractEvidenceGaps(assessment = {}) {
    return _normaliseCaseTextList([
      ...(Array.isArray(assessment?.missingInformation) ? assessment.missingInformation : []),
      ...(Array.isArray(assessment?.evidenceMap?.unsupportedClaims) ? assessment.evidenceMap.unsupportedClaims : []),
      ...(Array.isArray(assessment?.evidenceMap?.projectFinancialEvidenceMap)
        ? assessment.evidenceMap.projectFinancialEvidenceMap.filter(item => String(item?.status || '').trim() !== 'found')
        : []),
      ...(Array.isArray(assessment?.projectExposure?.missingInputs) ? assessment.projectExposure.missingInputs : [])
    ], 8, 220);
  }

  function _extractAssumptionWeaknesses(assessment = {}) {
    const weakAssumptions = Array.isArray(assessment?.assumptionRegister?.assumptions)
      ? assessment.assumptionRegister.assumptions.filter(item => {
          const confidence = String(item?.confidence || '').trim().toLowerCase();
          const status = String(item?.status || '').trim().toLowerCase();
          const sourceStatus = String(item?.sourceStatus || '').trim().toLowerCase();
          return confidence === 'low' || confidence === 'unknown' || status === 'open' || status === 'weak' || status === 'needs_review' || sourceStatus === 'unknown' || sourceStatus === 'benchmark_proxy';
        })
      : [];
    return _normaliseCaseTextList([
      ...weakAssumptions,
      ...(Array.isArray(assessment?.parameterCoach?.missingHighImpactInputs) ? assessment.parameterCoach.missingHighImpactInputs : []),
      ...(Array.isArray(assessment?.decisionChallenge?.sensitivityFlags) ? assessment.decisionChallenge.sensitivityFlags : []),
      ...(Array.isArray(assessment?.projectExposure?.projectInputQuality?.unknownHighImpactInputs)
        ? assessment.projectExposure.projectInputQuality.unknownHighImpactInputs
        : [])
    ], 8, 240);
  }

  function _extractTreatmentList(assessment = {}) {
    const source = [
      ...(Array.isArray(assessment?.treatments) ? assessment.treatments : []),
      ...(Array.isArray(assessment?.recommendations) ? assessment.recommendations : []),
      ...(Array.isArray(assessment?.treatmentPlan?.items) ? assessment.treatmentPlan.items : [])
    ];
    return _normaliseCaseTextList(source, 6, 180);
  }

  function _extractParameterSummary(assessment = {}) {
    const params = assessment?.fairParams || assessment?.results?.inputs || assessment?.parameters || {};
    const topLossDriver = _extractTopLossDriver(assessment);
    const readNumber = key => {
      const value = Number(params?.[key]);
      return Number.isFinite(value) ? value : null;
    };
    return {
      topLossDriver,
      eventFrequency: {
        min: readNumber('eventFreqMin'),
        likely: readNumber('eventFreqLikely'),
        max: readNumber('eventFreqMax')
      },
      controlStrength: {
        min: readNumber('controlStrMin'),
        likely: readNumber('controlStrLikely'),
        max: readNumber('controlStrMax')
      },
      topCostBucket: topLossDriver
    };
  }

  function _extractProjectValueSourceStatus(assessment = {}) {
    const type = _normaliseAssessmentType(assessment?.assessmentType || '');
    if (assessment?.projectValueSourceStatus) return _normaliseCaseSourceStatus(assessment.projectValueSourceStatus);
    if (type === 'project_seller') {
      const economics = assessment?.sellerEconomics || {};
      const meta = assessment?.sellerEconomicsMeta || {};
      const contract = _sourceStatusFromMeta(meta, 'contractValue', economics.contractValue);
      if (contract !== 'unknown') return contract;
      return _sourceStatusFromMeta(meta, 'expectedRevenue', economics.expectedRevenue);
    }
    if (type === 'project_buyer') {
      const economics = assessment?.buyerEconomics || {};
      const meta = assessment?.buyerEconomicsMeta || {};
      const expected = _sourceStatusFromMeta(meta, 'expectedSpend', economics.expectedSpend);
      if (expected !== 'unknown') return expected;
      return _sourceStatusFromMeta(meta, 'approvedBudget', economics.approvedBudget);
    }
    return 'unknown';
  }

  function _extractMarginSourceStatus(assessment = {}) {
    if (assessment?.marginSourceStatus) return _normaliseCaseSourceStatus(assessment.marginSourceStatus);
    const economics = assessment?.sellerEconomics || {};
    const meta = assessment?.sellerEconomicsMeta || {};
    const gross = _sourceStatusFromMeta(meta, 'grossMarginPct', economics.grossMarginPct);
    if (gross !== 'unknown') return gross;
    return _sourceStatusFromMeta(meta, 'contributionMargin', economics.contributionMargin);
  }

  function _extractProxyValuesUsed(assessment = {}) {
    const driverProxies = Array.isArray(assessment?.projectExposure?.financialDrivers)
      ? assessment.projectExposure.financialDrivers.filter(item => String(item?.driverStatus || item?.sourceStatus || '').trim() === 'benchmark_proxy_driver' || String(item?.sourceStatus || item?.source || '').trim() === 'benchmark_proxy' || String(item?.source || '').trim() === 'benchmark')
      : [];
    return _normaliseCaseSourceList([
      ...(Array.isArray(assessment?.aiAuditStory?.proxyValuesUsed) ? assessment.aiAuditStory.proxyValuesUsed : []),
      ...(Array.isArray(assessment?.decisionBrief?.projectQuantSummary?.proxyValuesUsed) ? assessment.decisionBrief.projectQuantSummary.proxyValuesUsed : []),
      ...driverProxies
    ], 'benchmark_proxy', 8);
  }

  function _extractUnknownsCarriedForward(assessment = {}) {
    return _normaliseCaseSourceList([
      ...(Array.isArray(assessment?.aiAuditStory?.unknownsCarriedForward) ? assessment.aiAuditStory.unknownsCarriedForward : []),
      ...(Array.isArray(assessment?.decisionBrief?.projectQuantSummary?.unknownHighImpactInputs) ? assessment.decisionBrief.projectQuantSummary.unknownHighImpactInputs : []),
      ...(Array.isArray(assessment?.projectExposure?.projectInputQuality?.unknownHighImpactInputs) ? assessment.projectExposure.projectInputQuality.unknownHighImpactInputs : []),
      ...(Array.isArray(assessment?.projectExposure?.missingInputs) ? assessment.projectExposure.missingInputs : [])
    ], 'unknown', 10);
  }

  function _normaliseCaseMemory(memory = {}) {
    const source = memory && typeof memory === 'object' ? memory : {};
    const caseId = _normaliseText(source.caseId || source.id || source.assessmentId || '', 140);
    const scenarioLens = _normaliseCaseScenarioLens(source.scenarioLens || source.scenarioLensKey || source.lensKey || '');
    const assessmentType = _normaliseAssessmentType(source.assessmentType || '');
    const projectRole = _normaliseStructuredToken(source.projectRole || source.projectContext?.projectRole || (assessmentType === 'project_buyer' ? 'buyer' : assessmentType === 'project_seller' ? 'seller' : 'none'), 40) || 'none';
    const projectValueSourceStatus = _normaliseCaseSourceStatus(source.projectValueSourceStatus || '');
    const marginSourceStatus = _normaliseCaseSourceStatus(source.marginSourceStatus || '');
    const scenarioTitle = _normaliseText(source.scenarioTitle || source.title || source.eventPath || 'Untitled assessment', 180);
    const eventPath = _normaliseText(source.eventPath || source.scenarioType || scenarioTitle, 220);
    if (!caseId && !scenarioTitle && !eventPath) return null;
    return {
      caseId: caseId || _generateId('case_memory'),
      scenarioTitle,
      assessmentType,
      scenarioLens,
      primaryFamily: _normaliseText(source.primaryFamily || scenarioLens.functionKey || '', 100).toLowerCase(),
      secondaryFamilies: _normaliseCaseSecondaryFamilies(source.secondaryFamilies),
      projectRole,
      projectStage: _normaliseText(source.projectStage || source.projectContext?.projectStage || '', 100),
      assetService: _normaliseText(source.assetService || '', 160),
      eventPath,
      topLossDriver: _normaliseText(source.topLossDriver || '', 160),
      primaryProjectDriver: _normaliseText(source.primaryProjectDriver || '', 180),
      decisionPosture: _normaliseText(source.decisionPosture || '', 80).toLowerCase(),
      evidenceGaps: _normaliseCaseTextList(source.evidenceGaps, 8, 220),
      assumptionWeaknesses: _normaliseCaseTextList(source.assumptionWeaknesses, 8, 240),
      parameterSummary: source.parameterSummary && typeof source.parameterSummary === 'object'
        ? _normaliseStructuredValue(source.parameterSummary)
        : {},
      projectExposureSummary: _normaliseText(source.projectExposureSummary || '', 320),
      projectValueSourceStatus,
      projectValueSourceLabel: _formatCaseSourceStatus(projectValueSourceStatus),
      marginSourceStatus,
      marginSourceLabel: _formatCaseSourceStatus(marginSourceStatus),
      proxyValuesUsed: _normaliseCaseSourceList(source.proxyValuesUsed, 'benchmark_proxy', 8),
      unknownsCarriedForward: _normaliseCaseSourceList(source.unknownsCarriedForward, 'unknown', 10),
      treatments: _normaliseCaseTextList(source.treatments, 6, 180),
      reviewOutcome: _normaliseText(source.reviewOutcome || '', 140),
      completedAt: Number.isFinite(Number(source.completedAt)) ? Number(source.completedAt) : Date.now()
    };
  }

  function buildCaseReusableValues(memory = {}) {
    const normalised = _normaliseCaseMemory(memory);
    if (!normalised) return {
      assumptions: [],
      treatments: [],
      evidenceGaps: [],
      sourceStatuses: []
    };
    return {
      assumptions: normalised.assumptionWeaknesses.map(label => ({
        label,
        sourceStatus: 'unknown',
        reusableLabel: 'unknown / not reusable',
        reusable: false
      })),
      treatments: normalised.treatments.map(label => ({
        label,
        sourceStatus: 'known',
        reusableLabel: 'confirmed',
        reusable: true
      })),
      evidenceGaps: normalised.evidenceGaps.map(label => ({
        label,
        sourceStatus: 'unknown',
        reusableLabel: 'unknown / not reusable',
        reusable: false
      })),
      sourceStatuses: [
        {
          field: 'project value',
          sourceStatus: normalised.projectValueSourceStatus,
          reusableLabel: normalised.projectValueSourceLabel,
          reusable: _caseStatusReusable(normalised.projectValueSourceStatus)
        },
        {
          field: 'margin',
          sourceStatus: normalised.marginSourceStatus,
          reusableLabel: normalised.marginSourceLabel,
          reusable: _caseStatusReusable(normalised.marginSourceStatus)
        }
      ].filter(item => item.sourceStatus && item.sourceStatus !== 'unknown')
    };
  }

  function _normaliseStructuredRefList(list = [], limit = 10) {
    return Array.from(new Set(
      (Array.isArray(list) ? list : [])
        .map(item => _normaliseText(item?.id || item?.field || item?.label || item, 140))
        .filter(Boolean)
    )).slice(0, limit);
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

  function _normaliseStructuredAiFeedbackEvent(payload = {}) {
    const targetType = _normaliseStructuredTargetType(payload?.targetType || payload?.target || '');
    const eventType = _normaliseStructuredToken(payload?.eventType || `${targetType}_correction`, 90) || 'correction';
    const recordedAt = Number(payload?.timestamp || payload?.recordedAt || Date.now());
    return {
      id: _normaliseText(payload?.id || _generateId('structured_feedback'), 120),
      eventType,
      targetType,
      targetId: _normaliseText(payload?.targetId || payload?.id || '', 140),
      reasonCode: _normaliseStructuredReasonCode(targetType, payload?.reasonCode || payload?.reason || '', eventType),
      note: _normaliseText(payload?.note || '', 600),
      before: _normaliseStructuredValue(payload?.before),
      after: _normaliseStructuredValue(payload?.after),
      buId: _normaliseText(payload?.buId || '', 64),
      functionKey: _inferFunctionKey(payload),
      lensKey: _normaliseLensKey(payload),
      assessmentType: _normaliseStructuredAssessmentType(payload?.assessmentType || ''),
      scenarioLens: _normaliseStructuredScenarioLens(payload?.scenarioLens || payload?.scenarioLensKey || payload?.lensKey || ''),
      primaryFamily: _normaliseText(payload?.primaryFamily || payload?.functionKey || '', 100).toLowerCase(),
      projectExposureRefs: _normaliseStructuredRefList(payload?.projectExposureRefs, 12),
      sourceStatusBefore: _normaliseStructuredSourceStatus(payload?.sourceStatusBefore || payload?.beforeSourceStatus || ''),
      sourceStatusAfter: _normaliseStructuredSourceStatus(payload?.sourceStatusAfter || payload?.afterSourceStatus || ''),
      timestamp: Number.isFinite(recordedAt) ? recordedAt : Date.now(),
      recordedAt: Number.isFinite(recordedAt) ? recordedAt : Date.now(),
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
        : [],
      structuredEvents: Array.isArray(source.structuredEvents)
        ? source.structuredEvents
            .map(_normaliseStructuredAiFeedbackEvent)
            .slice(0, 180)
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
    const caseMemories = _normaliseCaseMemoryArray(source.caseMemories, 80);
    const analystSignals = _normaliseAnalystSignals(source.analystSignals);
    const aiFeedback = _normaliseAiFeedbackSection(source.aiFeedback);
    return { templates, scenarioPatterns, caseMemories, analystSignals, aiFeedback };
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
      typeof getStructuredScenarioField === 'function' ? getStructuredScenarioField(source?.structuredScenario, 'eventPath') : '',
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

  function _structuredFeedbackMatches(event = {}, filters = {}) {
    if (_signalMatches(event, filters) === false) return false;
    const targetType = _normaliseStructuredTargetType(filters?.targetType || '');
    if (filters?.targetType && event.targetType !== targetType) return false;
    const eventType = _normaliseStructuredToken(filters?.eventType || '', 90);
    if (eventType && event.eventType !== eventType) return false;
    const reasonCode = _normaliseStructuredReasonCode(event.targetType, filters?.reasonCode || '', event.eventType);
    if (filters?.reasonCode && event.reasonCode !== reasonCode) return false;
    const assessmentType = _normaliseStructuredAssessmentType(filters?.assessmentType || '');
    if (assessmentType && event.assessmentType !== assessmentType) return false;
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

  function buildCaseMemoryFromAssessment(assessment) {
    try {
      if (!assessment || typeof assessment !== 'object') return null;
      const source = assessment && typeof assessment === 'object' ? assessment : {};
      const assessmentType = _normaliseAssessmentType(source.assessmentType || '');
      const scenarioLens = _normaliseCaseScenarioLens(source.scenarioLens || source.scenarioLensKey || source.lensKey || '');
      const resolvedTitle = typeof resolveScenarioDisplayTitle === 'function'
        ? resolveScenarioDisplayTitle({
            ...source,
            narrative: String(source?.narrative || '').trim(),
            enhancedNarrative: String(source?.enhancedNarrative || source?.narrative || '').trim()
          })
        : _normaliseText(
            source.scenarioTitle
            || source.title
            || _safeStructuredScenarioField(source.structuredScenario, 'eventPath')
            || source.enhancedNarrative
            || source.narrative
            || '',
            180
          );
      const projectExposure = source.projectExposure && typeof source.projectExposure === 'object'
        ? source.projectExposure
        : {};
      const memory = _normaliseCaseMemory({
        caseId: source.id || source.caseId,
        scenarioTitle: resolvedTitle || 'Untitled assessment',
        assessmentType,
        scenarioLens,
        primaryFamily: source.primaryFamily || scenarioLens.functionKey || _inferFunctionKey(source),
        secondaryFamilies: source.secondaryFamilies || source.scenarioLens?.secondaryKeys || source.structuredScenario?.secondaryFamilies || [],
        projectRole: source.projectContext?.projectRole || (assessmentType === 'project_buyer' ? 'buyer' : assessmentType === 'project_seller' ? 'seller' : 'none'),
        projectStage: source.projectContext?.projectStage || '',
        assetService: _safeStructuredScenarioField(source.structuredScenario, 'assetService') || source.guidedInput?.asset || source.enterpriseRiskContext?.affectedArea || '',
        eventPath: _safeStructuredScenarioField(source.structuredScenario, 'eventPath') || source.guidedInput?.event || resolvedTitle || '',
        topLossDriver: _extractTopLossDriver(source),
        primaryProjectDriver: _extractPrimaryProjectDriver(projectExposure),
        decisionPosture: _extractDecisionPosture(source),
        evidenceGaps: _extractEvidenceGaps(source),
        assumptionWeaknesses: _extractAssumptionWeaknesses(source),
        parameterSummary: _extractParameterSummary(source),
        projectExposureSummary: projectExposure.projectExposureSummary || '',
        projectValueSourceStatus: _extractProjectValueSourceStatus(source),
        marginSourceStatus: _extractMarginSourceStatus(source),
        proxyValuesUsed: _extractProxyValuesUsed(source),
        unknownsCarriedForward: _extractUnknownsCarriedForward(source),
        treatments: _extractTreatmentList(source),
        reviewOutcome: source.reviewOutcome || source.reviewSubmission?.reviewStatus || source.lifecycleStatus || '',
        completedAt: Number(source.completedAt || source.lifecycleUpdatedAt || source.createdAt || Date.now())
      });
      if (!memory) return null;
      const hasSignal = [
        memory.scenarioTitle,
        memory.eventPath,
        memory.assetService,
        memory.primaryFamily,
        memory.topLossDriver,
        memory.primaryProjectDriver
      ].some(value => String(value || '').trim());
      return hasSignal ? memory : null;
    } catch {
      return null;
    }
  }

  function getCaseMemories(username, limit = 50) {
    try {
      return _normaliseCaseMemoryArray(getLearningStore(username).caseMemories, Math.max(1, Number(limit || 0) || 50));
    } catch {
      return [];
    }
  }

  function saveCaseMemory(username, memoryOrAssessment) {
    try {
      const memory = memoryOrAssessment?.caseId
        ? _normaliseCaseMemory(memoryOrAssessment)
        : buildCaseMemoryFromAssessment(memoryOrAssessment);
      if (!memory?.caseId) return null;
      const store = getLearningStore(username);
      const existing = _normaliseCaseMemoryArray(store.caseMemories, 80)
        .filter(item => String(item.caseId || '').trim() !== String(memory.caseId || '').trim());
      store.caseMemories = [memory, ...existing]
        .sort((left, right) => Number(right.completedAt || 0) - Number(left.completedAt || 0))
        .slice(0, 80);
      saveLearningStore(username, store);
      return memory;
    } catch {
      return null;
    }
  }

  function _scoreSimilarCaseMemory(seedMemory = {}, candidateMemory = {}) {
    const seed = _normaliseCaseMemory(seedMemory);
    const candidate = _normaliseCaseMemory(candidateMemory);
    if (!seed || !candidate) return null;
    if (seed.caseId && candidate.caseId && seed.caseId === candidate.caseId) return null;
    const assetOverlap = _countCaseTokenOverlap(seed.assetService, candidate.assetService);
    const eventOverlap = _countCaseTokenOverlap(seed.eventPath || seed.scenarioTitle, candidate.eventPath || candidate.scenarioTitle);
    const lossOverlap = _countCaseTokenOverlap(seed.topLossDriver || seed.primaryProjectDriver, candidate.topLossDriver || candidate.primaryProjectDriver);
    let score = 0;
    if (seed.assessmentType === candidate.assessmentType) score += 28;
    if (seed.scenarioLens?.key && seed.scenarioLens.key === candidate.scenarioLens?.key) score += 16;
    if (seed.primaryFamily && seed.primaryFamily === candidate.primaryFamily) score += 14;
    score += Math.min(assetOverlap * 6, 24);
    score += Math.min(eventOverlap * 5, 25);
    score += Math.min(lossOverlap * 7, 21);
    if (seed.projectRole && seed.projectRole !== 'none' && seed.projectRole === candidate.projectRole) score += 8;
    if (seed.projectStage && candidate.projectStage && seed.projectStage.toLowerCase() === candidate.projectStage.toLowerCase()) score += 6;
    if (seed.primaryProjectDriver && candidate.primaryProjectDriver && _countCaseTokenOverlap(seed.primaryProjectDriver, candidate.primaryProjectDriver)) score += 8;
    const completedAt = Number(candidate.completedAt || 0);
    const ageDays = completedAt > 0 ? Math.max(0, (Date.now() - completedAt) / 86400000) : 3650;
    score += Math.max(0, 12 - Math.min(12, ageDays / 30));
    return {
      score,
      assetOverlap,
      eventOverlap,
      lossOverlap,
      reusableValues: buildCaseReusableValues(candidate)
    };
  }

  function findSimilarCaseMemories(seed, memories = [], options = {}) {
    const seedMemory = _normaliseCaseMemory(seed) || buildCaseMemoryFromAssessment(seed);
    if (!seedMemory) return [];
    const seedSignalText = [
      seedMemory.scenarioTitle,
      seedMemory.assetService,
      seedMemory.eventPath,
      seedMemory.topLossDriver,
      seedMemory.primaryProjectDriver
    ].filter(Boolean).join(' ');
    if (_tokeniseCaseMemoryText(seedSignalText).length < 3) return [];
    const limit = Math.max(1, Number(options?.limit || 3) || 3);
    return (Array.isArray(memories) ? memories : [])
      .map((memory) => {
        const candidate = _normaliseCaseMemory(memory);
        const scoring = candidate ? _scoreSimilarCaseMemory(seedMemory, candidate) : null;
        if (!candidate || !scoring) return null;
        return {
          ...candidate,
          _caseMemory: {
            score: Number(scoring.score.toFixed(2)),
            assetOverlap: scoring.assetOverlap,
            eventOverlap: scoring.eventOverlap,
            lossOverlap: scoring.lossOverlap,
            reusableValues: scoring.reusableValues
          }
        };
      })
      .filter(Boolean)
      .filter(item => Number(item?._caseMemory?.score || 0) >= 24 || Number(item?._caseMemory?.eventOverlap || 0) >= 2 || Number(item?._caseMemory?.assetOverlap || 0) >= 2)
      .sort((left, right) => (
        Number(right?._caseMemory?.score || 0) - Number(left?._caseMemory?.score || 0)
        || Number(right.completedAt || 0) - Number(left.completedAt || 0)
        || String(left.scenarioTitle || '').localeCompare(String(right.scenarioTitle || ''))
      ))
      .slice(0, limit);
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

  function recordStructuredAiFeedback(usernameOrEvent, payload = null) {
    try {
      const eventPayload = payload && typeof payload === 'object'
        ? payload
        : (usernameOrEvent && typeof usernameOrEvent === 'object' ? usernameOrEvent : {});
      const username = typeof usernameOrEvent === 'string'
        ? _normalizeUsername(usernameOrEvent)
        : _normalizeUsername(
            eventPayload?.submittedBy
            || eventPayload?.username
            || (typeof AuthService !== 'undefined' && AuthService?.getCurrentUser ? AuthService.getCurrentUser()?.username : '')
          );
      const event = _normaliseStructuredAiFeedbackEvent({
        ...eventPayload,
        submittedBy: eventPayload?.submittedBy || username
      });
      if (!username) return event;
      const store = getLearningStore(username);
      const nextFeedback = _normaliseAiFeedbackSection(store.aiFeedback);
      nextFeedback.structuredEvents = _appendSignal(nextFeedback.structuredEvents, event, 180);
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

  function getStructuredAiFeedbackEvents(username, filters = {}) {
    const events = _normaliseAiFeedbackSection(getLearningStore(username).aiFeedback).structuredEvents;
    return events.filter(event => _structuredFeedbackMatches(event, filters));
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
    getCaseMemories,
    saveCaseMemory,
    buildCaseMemoryFromAssessment,
    findSimilarCaseMemories,
    buildCaseReusableValues,
    formatCaseMemorySourceStatus: _formatCaseSourceStatus,
    normaliseCaseMemory: _normaliseCaseMemory,
    normalizeCaseMemory: _normaliseCaseMemory,
    recordRiskDecision,
    recordNarrativeEdit,
    recordRerunDelta,
    getRiskSignalSummary,
    recordAiFeedback,
    recordStructuredAiFeedback,
    getAiFeedbackEvents,
    getStructuredAiFeedbackEvents,
    getAiFeedbackProfile,
    normaliseStructuredAiFeedbackEvent: _normaliseStructuredAiFeedbackEvent,
    normalizeStructuredAiFeedbackEvent: _normaliseStructuredAiFeedbackEvent,
    normaliseStructuredAiFeedbackReason: _normaliseStructuredReasonCode,
    normalizeStructuredAiFeedbackReason: _normaliseStructuredReasonCode,
    STRUCTURED_AI_FEEDBACK_REASON_TAXONOMIES
  };
})();

if (typeof window !== 'undefined') {
  window.LearningStore = window.LearningStore || LearningStore;
  window.recordStructuredAiFeedback = window.recordStructuredAiFeedback || function recordStructuredAiFeedback(event = {}) {
    const username = event?.submittedBy
      || event?.username
      || (typeof AuthService !== 'undefined' && AuthService?.getCurrentUser ? AuthService.getCurrentUser()?.username : '');
    const saved = LearningStore.recordStructuredAiFeedback(username, event);
    if (saved && username && typeof patchLearningStore === 'function' && typeof LearningStore.getLearningStore === 'function') {
      try {
        patchLearningStore({ aiFeedback: LearningStore.getLearningStore(username).aiFeedback });
      } catch {}
    }
    return saved;
  };
}

if (typeof module !== 'undefined') module.exports = LearningStore;
