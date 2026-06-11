'use strict';

(function attachAssessmentTypeModel(globalScope) {
  const ASSESSMENT_TYPE_GENERIC = 'enterprise_generic';
  const ASSESSMENT_TYPE_PROJECT_BUYER = 'project_buyer';
  const ASSESSMENT_TYPE_PROJECT_SELLER = 'project_seller';

  const VALUATION_MODE_BENCHMARK_LED = 'benchmark_led';
  const VALUATION_MODE_PROJECT_LINKED = 'project_linked';
  const VALUATION_MODE_HYBRID = 'hybrid';

  const ASSESSMENT_SCREEN_GENERIC_INPUTS = 'generic_enterprise_inputs';
  const ASSESSMENT_SCREEN_PROJECT_BUYER_INPUTS = 'project_buyer_inputs';
  const ASSESSMENT_SCREEN_PROJECT_SELLER_INPUTS = 'project_seller_inputs';

  const MAX_PROJECT_EXPOSURE_ARRAY_ITEMS = 20;
  const MAX_PROJECT_EXPOSURE_MAP_KEYS = 30;
  const MAX_NESTED_ARRAY_ITEMS = 8;
  const MAX_NESTED_OBJECT_KEYS = 12;
  const MAX_PROJECT_EXPOSURE_TEXT_LENGTH = 1600;
  const MAX_PROJECT_EXPOSURE_SHORT_TEXT_LENGTH = 320;

  const FINANCIAL_VALUE_STATUSES = new Set([
    'known',
    'estimated',
    'unknown',
    'not_applicable',
    'derived',
    'benchmark_proxy',
    'evidence_supported'
  ]);

  const FINANCIAL_VALUE_CONFIDENCES = new Set(['high', 'medium', 'low', 'unknown']);

  const FINANCIAL_VALUE_SOURCES = new Set([
    'user',
    'document',
    'ai_inferred',
    'project_exposure_mapper',
    'benchmark',
    'admin_default',
    'not_provided'
  ]);

  const BUYER_ECONOMICS_FIELDS = [
    'expectedSpend',
    'approvedBudget',
    'remainingSpend',
    'amountCommitted',
    'amountPaid',
    'delayCostPerDay',
    'delayCostPerWeek',
    'expectedBenefitPerDay',
    'expectedBenefitPerWeek',
    'reprocurementPremiumPct',
    'supplierCredits',
    'insuranceRecoveries',
    'liquidatedDamagesRecoverable',
    'contractualRecoveryCap',
    'legalDisputeEstimate'
  ];

  const SELLER_ECONOMICS_FIELDS = [
    'contractValue',
    'expectedRevenue',
    'grossMarginPct',
    'contributionMargin',
    'deliveryCostBudget',
    'costIncurredToDate',
    'remainingDeliveryCost',
    'revenueRecognitionAtRisk',
    'liquidatedDamagesCap',
    'slaCreditsCap',
    'liabilityCap',
    'terminationExposure',
    'renewalValueAtRisk',
    'costToCure',
    'warrantyExposure',
    'insuranceRecoveries',
    'probabilityOfAward'
  ];

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

  const VALID_PROJECT_ROLES = new Set(['buyer', 'seller', 'none']);
  const VALID_STRATEGIC_IMPORTANCE = new Set(['low', 'medium', 'high', 'unknown']);
  const BUYER_DELAY_OPTIONS = new Set(['days', 'weeks', 'months', 'unknown']);
  const BUYER_IMPACT_OPTIONS = new Set(['delay', 'cost_increase', 'supplier_replacement', 'wasted_spend', 'delayed_benefit', 'legal_dispute', 'operational_disruption', 'unknown']);
  const BUYER_REPLACEMENT_OPTIONS = new Set(['easy', 'moderate', 'hard', 'unknown']);
  const BUYER_RECOVERY_OPTIONS = new Set(['yes', 'no', 'some', 'unknown']);
  const BUYER_PAID_OPTIONS = new Set(['none', 'some', 'most', 'unknown']);
  const YES_NO_UNKNOWN_OPTIONS = new Set(['yes', 'no', 'unknown']);
  const SELLER_IMPACT_OPTIONS = new Set(['margin_erosion', 'delivery_cost_overrun', 'delayed_revenue', 'ld_sla_credits', 'termination', 'warranty_cost_to_cure', 'renewal_impact', 'non_payment', 'unknown']);
  const LOW_MEDIUM_HIGH_UNKNOWN_OPTIONS = new Set(['low', 'medium', 'high', 'unknown']);
  const SELLER_COMMERCIAL_MODEL_OPTIONS = new Set(['fixed_price', 'time_and_materials', 'milestone_based', 'recurring_service', 'unknown']);

  const ASSESSMENT_TYPE_CARD_COPY = Object.freeze({
    [ASSESSMENT_TYPE_GENERIC]: {
      title: 'Generic enterprise risk',
      guidance: 'Use this when the risk affects a process, function, system, supplier, obligation, business unit, control, or operation, but is not tied to a specific project value, spend, revenue opportunity, or contract.',
      label: 'Enterprise',
      nextScreen: ASSESSMENT_SCREEN_GENERIC_INPUTS
    },
    [ASSESSMENT_TYPE_PROJECT_BUYER]: {
      title: 'Project risk - we are the buyer',
      guidance: 'Use this when your organisation is buying, procuring, implementing, investing in, or depending on a project, supplier, contractor, platform, or delivery partner.',
      label: 'Buyer',
      nextScreen: ASSESSMENT_SCREEN_PROJECT_BUYER_INPUTS
    },
    [ASSESSMENT_TYPE_PROJECT_SELLER]: {
      title: 'Project risk - we are the seller',
      guidance: 'Use this when your organisation is delivering a project, service, implementation, contract, bid, or revenue commitment to a customer.',
      label: 'Seller',
      nextScreen: ASSESSMENT_SCREEN_PROJECT_SELLER_INPUTS
    }
  });

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

  function normaliseText(value, maxLength = MAX_PROJECT_EXPOSURE_TEXT_LENGTH) {
    if (value === null || value === undefined) return '';
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
      return String(value).trim().slice(0, maxLength);
    }
    return '';
  }

  function normaliseFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }

  function normalisePercentage(value) {
    const next = normaliseFiniteNumber(value);
    if (next === null) return null;
    return Math.min(1, Math.max(0, next));
  }

  function normaliseEnum(value, validValues, fallback = 'unknown') {
    const next = normaliseText(value).toLowerCase();
    return validValues.has(next) ? next : fallback;
  }

  function normaliseAssessmentType(value) {
    const next = normaliseText(value).toLowerCase();
    return VALID_ASSESSMENT_TYPES.has(next) ? next : ASSESSMENT_TYPE_GENERIC;
  }

  function getAssessmentTypeNextScreen(value) {
    const assessmentType = normaliseAssessmentType(value);
    return ASSESSMENT_TYPE_CARD_COPY[assessmentType]?.nextScreen || ASSESSMENT_SCREEN_GENERIC_INPUTS;
  }

  function getAssessmentTypeNextRoute(value) {
    normaliseAssessmentType(value);
    return '/wizard/2';
  }

  function getAssessmentTypeCards() {
    return [
      ASSESSMENT_TYPE_GENERIC,
      ASSESSMENT_TYPE_PROJECT_BUYER,
      ASSESSMENT_TYPE_PROJECT_SELLER
    ].map((assessmentType, index) => ({
      assessmentType,
      index: index + 1,
      ...ASSESSMENT_TYPE_CARD_COPY[assessmentType],
      projectRole: projectRoleForAssessmentType(assessmentType),
      nextRoute: getAssessmentTypeNextRoute(assessmentType)
    }));
  }

  function normaliseValuationMode(value) {
    const next = normaliseText(value).toLowerCase();
    return VALID_VALUATION_MODES.has(next) ? next : VALUATION_MODE_BENCHMARK_LED;
  }

  function projectRoleForAssessmentType(assessmentType) {
    const nextType = normaliseAssessmentType(assessmentType);
    if (nextType === ASSESSMENT_TYPE_PROJECT_BUYER) return 'buyer';
    if (nextType === ASSESSMENT_TYPE_PROJECT_SELLER) return 'seller';
    return 'none';
  }

  function normaliseProjectRole(value, assessmentType = ASSESSMENT_TYPE_GENERIC) {
    const roleForType = projectRoleForAssessmentType(assessmentType);
    if (roleForType !== 'none') return roleForType;
    const next = normaliseText(value).toLowerCase();
    return VALID_PROJECT_ROLES.has(next) ? next : 'none';
  }

  function normaliseStrategicImportance(value) {
    const next = normaliseText(value).toLowerCase();
    return VALID_STRATEGIC_IMPORTANCE.has(next) ? next : 'unknown';
  }

  function normaliseCurrency(value) {
    return normaliseText(value).toUpperCase() || 'USD';
  }

  function normaliseLooseValue(value, depth = 0) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      if (depth >= 2) return [];
      return value
        .slice(0, MAX_NESTED_ARRAY_ITEMS)
        .map(item => normaliseLooseValue(item, depth + 1))
        .filter(item => item !== null && item !== '');
    }
    if (isPlainObject(value)) {
      if (depth >= 2) return {};
      const output = {};
      Object.keys(value).slice(0, MAX_NESTED_OBJECT_KEYS).forEach(rawKey => {
        const key = normaliseText(rawKey, MAX_PROJECT_EXPOSURE_SHORT_TEXT_LENGTH);
        if (!key) return;
        const item = normaliseLooseValue(readField(value, rawKey), depth + 1);
        if (item === null || item === '') return;
        output[key] = item;
      });
      return output;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().slice(0, MAX_PROJECT_EXPOSURE_TEXT_LENGTH);
    if (typeof value === 'bigint') return String(value).slice(0, MAX_PROJECT_EXPOSURE_TEXT_LENGTH);
    return null;
  }

  function normaliseCappedArray(value, maxItems = MAX_PROJECT_EXPOSURE_ARRAY_ITEMS) {
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, maxItems)
      .map(item => normaliseLooseValue(item, 0))
      .filter(item => item !== null && item !== '');
  }

  function normaliseRiskParameterMap(value) {
    if (!isPlainObject(value)) return {};
    const output = {};
    Object.keys(value).slice(0, MAX_PROJECT_EXPOSURE_MAP_KEYS).forEach(rawKey => {
      const key = normaliseText(rawKey, MAX_PROJECT_EXPOSURE_SHORT_TEXT_LENGTH);
      if (!key) return;
      const item = normaliseLooseValue(readField(value, rawKey), 0);
      if (item === null || item === '') return;
      output[key] = item;
    });
    return output;
  }

  function normaliseProjectInputQuality(value = {}) {
    const source = isPlainObject(value) ? value : {};
    const score = normaliseFiniteNumber(readField(source, 'score'));
    const recommended = isPlainObject(readField(source, 'recommendedNextInput')) ? readField(source, 'recommendedNextInput') : {};
    return {
      score: score === null ? 0 : Math.max(0, Math.min(100, Math.round(score))),
      label: normaliseText(readField(source, 'label')),
      knownHighImpactInputs: normaliseCappedArray(readField(source, 'knownHighImpactInputs')),
      estimatedHighImpactInputs: normaliseCappedArray(readField(source, 'estimatedHighImpactInputs')),
      unknownHighImpactInputs: normaliseCappedArray(readField(source, 'unknownHighImpactInputs')),
      canProceed: readField(source, 'canProceed') === false ? false : true,
      recommendedNextInput: {
        field: normaliseText(readField(recommended, 'field')),
        why: normaliseText(readField(recommended, 'why') || readField(recommended, 'whyItMatters')),
        whoMightKnow: normaliseText(readField(recommended, 'whoMightKnow')),
        suggestedQuestion: normaliseText(readField(recommended, 'suggestedQuestion'))
      }
    };
  }

  function normaliseProjectContext(projectContext = {}, assessmentType = ASSESSMENT_TYPE_GENERIC) {
    const source = isPlainObject(projectContext) ? projectContext : {};
    const nextAssessmentType = normaliseAssessmentType(assessmentType);
    return {
      projectName: normaliseText(readField(source, 'projectName')),
      projectDescription: normaliseText(readField(source, 'projectDescription')),
      projectRole: normaliseProjectRole(readField(source, 'projectRole'), nextAssessmentType),
      projectStage: normaliseText(readField(source, 'projectStage')),
      contractType: normaliseText(readField(source, 'contractType')),
      currency: normaliseCurrency(readField(source, 'currency')),
      projectDurationMonths: normaliseFiniteNumber(readField(source, 'projectDurationMonths')),
      criticalMilestoneDate: normaliseText(readField(source, 'criticalMilestoneDate')),
      strategicImportance: normaliseStrategicImportance(readField(source, 'strategicImportance'))
    };
  }

  function normaliseEnterpriseRiskContext(enterpriseRiskContext = {}) {
    const source = isPlainObject(enterpriseRiskContext) ? enterpriseRiskContext : {};
    return {
      affectedArea: normaliseText(readField(source, 'affectedArea')),
      likelyCause: normaliseText(readField(source, 'likelyCause')),
      mainBusinessImpact: normaliseText(readField(source, 'mainBusinessImpact')),
      existingControls: normaliseText(readField(source, 'existingControls')),
      evidenceNotes: normaliseText(readField(source, 'evidenceNotes')),
      obligationNotes: normaliseText(readField(source, 'obligationNotes'))
    };
  }

  function normaliseProjectRouteDetails(projectRouteDetails = {}) {
    const source = isPlainObject(projectRouteDetails) ? projectRouteDetails : {};
    return {
      supplierName: normaliseText(readField(source, 'supplierName')),
      customerName: normaliseText(readField(source, 'customerName')),
      mainConsequence: normaliseText(readField(source, 'mainConsequence'))
    };
  }

  function inferFinancialMetaStatus(value, rawMeta = {}) {
    const status = normaliseEnum(readField(rawMeta, 'status'), FINANCIAL_VALUE_STATUSES, '');
    if (value === null) return status === 'not_applicable' ? 'not_applicable' : 'unknown';
    if (['known', 'estimated', 'derived', 'benchmark_proxy', 'evidence_supported'].includes(status)) return status;
    return 'known';
  }

  function normaliseFinancialFieldMeta(value, rawMeta = {}) {
    const source = isPlainObject(rawMeta) ? rawMeta : {};
    const status = inferFinancialMetaStatus(value, source);
    const defaultSource = value === null ? 'not_provided' : 'user';
    return {
      status,
      confidence: normaliseEnum(readField(source, 'confidence'), FINANCIAL_VALUE_CONFIDENCES, 'unknown'),
      source: status === 'unknown' || status === 'not_applicable'
        ? 'not_provided'
        : normaliseEnum(readField(source, 'source'), FINANCIAL_VALUE_SOURCES, defaultSource),
      note: normaliseText(readField(source, 'note'))
    };
  }

  function normaliseEconomicsMeta(economics = {}, economicsMeta = {}, fields = []) {
    const safeEconomics = isPlainObject(economics) ? economics : {};
    const safeMeta = isPlainObject(economicsMeta) ? economicsMeta : {};
    return fields.reduce((output, field) => {
      output[field] = normaliseFinancialFieldMeta(readField(safeEconomics, field), readField(safeMeta, field));
      return output;
    }, {});
  }

  function normaliseBuyerEconomics(buyerEconomics = {}) {
    const source = isPlainObject(buyerEconomics) ? buyerEconomics : {};
    return {
      expectedSpend: normaliseFiniteNumber(readField(source, 'expectedSpend')),
      approvedBudget: normaliseFiniteNumber(readField(source, 'approvedBudget')),
      remainingSpend: normaliseFiniteNumber(readField(source, 'remainingSpend')),
      amountCommitted: normaliseFiniteNumber(readField(source, 'amountCommitted')),
      amountPaid: normaliseFiniteNumber(readField(source, 'amountPaid')),
      delayCostPerDay: normaliseFiniteNumber(readField(source, 'delayCostPerDay')),
      delayCostPerWeek: normaliseFiniteNumber(readField(source, 'delayCostPerWeek')),
      expectedBenefitPerDay: normaliseFiniteNumber(readField(source, 'expectedBenefitPerDay')),
      expectedBenefitPerWeek: normaliseFiniteNumber(readField(source, 'expectedBenefitPerWeek')),
      reprocurementPremiumPct: normalisePercentage(readField(source, 'reprocurementPremiumPct')),
      supplierCredits: normaliseFiniteNumber(readField(source, 'supplierCredits')),
      insuranceRecoveries: normaliseFiniteNumber(readField(source, 'insuranceRecoveries')),
      liquidatedDamagesRecoverable: normaliseFiniteNumber(readField(source, 'liquidatedDamagesRecoverable')),
      contractualRecoveryCap: normaliseFiniteNumber(readField(source, 'contractualRecoveryCap')),
      legalDisputeEstimate: normaliseFiniteNumber(readField(source, 'legalDisputeEstimate'))
    };
  }

  function normaliseSellerEconomics(sellerEconomics = {}) {
    const source = isPlainObject(sellerEconomics) ? sellerEconomics : {};
    return {
      contractValue: normaliseFiniteNumber(readField(source, 'contractValue')),
      expectedRevenue: normaliseFiniteNumber(readField(source, 'expectedRevenue')),
      grossMarginPct: normalisePercentage(readField(source, 'grossMarginPct')),
      contributionMargin: normaliseFiniteNumber(readField(source, 'contributionMargin')),
      deliveryCostBudget: normaliseFiniteNumber(readField(source, 'deliveryCostBudget')),
      costIncurredToDate: normaliseFiniteNumber(readField(source, 'costIncurredToDate')),
      remainingDeliveryCost: normaliseFiniteNumber(readField(source, 'remainingDeliveryCost')),
      revenueRecognitionAtRisk: normaliseFiniteNumber(readField(source, 'revenueRecognitionAtRisk')),
      liquidatedDamagesCap: normaliseFiniteNumber(readField(source, 'liquidatedDamagesCap')),
      slaCreditsCap: normaliseFiniteNumber(readField(source, 'slaCreditsCap')),
      liabilityCap: normaliseFiniteNumber(readField(source, 'liabilityCap')),
      terminationExposure: normaliseFiniteNumber(readField(source, 'terminationExposure')),
      renewalValueAtRisk: normaliseFiniteNumber(readField(source, 'renewalValueAtRisk')),
      costToCure: normaliseFiniteNumber(readField(source, 'costToCure')),
      warrantyExposure: normaliseFiniteNumber(readField(source, 'warrantyExposure')),
      insuranceRecoveries: normaliseFiniteNumber(readField(source, 'insuranceRecoveries')),
      probabilityOfAward: normalisePercentage(readField(source, 'probabilityOfAward'))
    };
  }

  function normaliseBuyerEconomicsMeta(buyerEconomics = {}, buyerEconomicsMeta = {}) {
    return normaliseEconomicsMeta(normaliseBuyerEconomics(buyerEconomics), buyerEconomicsMeta, BUYER_ECONOMICS_FIELDS);
  }

  function normaliseSellerEconomicsMeta(sellerEconomics = {}, sellerEconomicsMeta = {}) {
    return normaliseEconomicsMeta(normaliseSellerEconomics(sellerEconomics), sellerEconomicsMeta, SELLER_ECONOMICS_FIELDS);
  }

  function normaliseBuyerProxyQuestions(buyerProxyQuestions = {}) {
    const source = isPlainObject(buyerProxyQuestions) ? buyerProxyQuestions : {};
    return {
      mainImpact: normaliseEnum(readField(source, 'mainImpact'), BUYER_IMPACT_OPTIONS, 'unknown'),
      likelyDelay: normaliseEnum(readField(source, 'likelyDelay'), BUYER_DELAY_OPTIONS, 'unknown'),
      supplierReplacementDifficulty: normaliseEnum(readField(source, 'supplierReplacementDifficulty'), BUYER_REPLACEMENT_OPTIONS, 'unknown'),
      contractualRecoveries: normaliseEnum(readField(source, 'contractualRecoveries'), BUYER_RECOVERY_OPTIONS, 'unknown'),
      moneyPaidCommitted: normaliseEnum(readField(source, 'moneyPaidCommitted'), BUYER_PAID_OPTIONS, 'unknown'),
      criticalPath: normaliseEnum(readField(source, 'criticalPath'), YES_NO_UNKNOWN_OPTIONS, 'unknown')
    };
  }

  function normaliseSellerProxyQuestions(sellerProxyQuestions = {}) {
    const source = isPlainObject(sellerProxyQuestions) ? sellerProxyQuestions : {};
    return {
      mainImpact: normaliseEnum(readField(source, 'mainImpact'), SELLER_IMPACT_OPTIONS, 'unknown'),
      expectedMargin: normaliseEnum(readField(source, 'expectedMargin'), LOW_MEDIUM_HIGH_UNKNOWN_OPTIONS, 'unknown'),
      penaltiesOrCredits: normaliseEnum(readField(source, 'penaltiesOrCredits'), YES_NO_UNKNOWN_OPTIONS, 'unknown'),
      terminationRight: normaliseEnum(readField(source, 'terminationRight'), YES_NO_UNKNOWN_OPTIONS, 'unknown'),
      extraDeliveryCost: normaliseEnum(readField(source, 'extraDeliveryCost'), LOW_MEDIUM_HIGH_UNKNOWN_OPTIONS, 'unknown'),
      commercialModel: normaliseEnum(readField(source, 'commercialModel'), SELLER_COMMERCIAL_MODEL_OPTIONS, 'unknown')
    };
  }

  function normaliseProjectExposure(projectExposure = {}) {
    const source = isPlainObject(projectExposure) ? projectExposure : {};
    return {
      valuationMode: normaliseValuationMode(readField(source, 'valuationMode')),
      projectExposureSummary: normaliseText(readField(source, 'projectExposureSummary')),
      projectInputQuality: normaliseProjectInputQuality(readField(source, 'projectInputQuality')),
      financialDrivers: normaliseCappedArray(readField(source, 'financialDrivers')),
      capsAndOffsets: normaliseCappedArray(readField(source, 'capsAndOffsets')),
      doubleCountingWarnings: normaliseCappedArray(readField(source, 'doubleCountingWarnings')),
      missingInputs: normaliseCappedArray(readField(source, 'missingInputs')),
      mapsToRiskParameters: normaliseRiskParameterMap(readField(source, 'mapsToRiskParameters')),
      sourceMode: normaliseText(readField(source, 'sourceMode')),
      inputFingerprint: normaliseText(readField(source, 'inputFingerprint')),
      generatedAt: normaliseText(readField(source, 'generatedAt')),
      usedFallback: readField(source, 'usedFallback') === true,
      aiUnavailable: readField(source, 'aiUnavailable') === true
    };
  }

  function normaliseAssessmentTypeState(value = {}) {
    const source = isPlainObject(value) ? value : {};
    const assessmentType = normaliseAssessmentType(readField(source, 'assessmentType'));
    const buyerEconomics = normaliseBuyerEconomics(readField(source, 'buyerEconomics'));
    const sellerEconomics = normaliseSellerEconomics(readField(source, 'sellerEconomics'));
    return {
      assessmentType,
      projectContext: normaliseProjectContext(readField(source, 'projectContext'), assessmentType),
      enterpriseRiskContext: normaliseEnterpriseRiskContext(readField(source, 'enterpriseRiskContext')),
      projectRouteDetails: normaliseProjectRouteDetails(readField(source, 'projectRouteDetails')),
      buyerProxyQuestions: normaliseBuyerProxyQuestions(readField(source, 'buyerProxyQuestions')),
      sellerProxyQuestions: normaliseSellerProxyQuestions(readField(source, 'sellerProxyQuestions')),
      buyerEconomics,
      buyerEconomicsMeta: normaliseEconomicsMeta(buyerEconomics, readField(source, 'buyerEconomicsMeta'), BUYER_ECONOMICS_FIELDS),
      sellerEconomics,
      sellerEconomicsMeta: normaliseEconomicsMeta(sellerEconomics, readField(source, 'sellerEconomicsMeta'), SELLER_ECONOMICS_FIELDS),
      projectExposure: normaliseProjectExposure(readField(source, 'projectExposure'))
    };
  }

  function buildAssessmentTypeState(value = {}) {
    return normaliseAssessmentTypeState(value);
  }

  function buildDefaultAssessmentTypeState(assessmentType = ASSESSMENT_TYPE_GENERIC) {
    return normaliseAssessmentTypeState({ assessmentType });
  }

  function buildAssessmentTypeChangePatch(currentDraft = {}, nextAssessmentType = ASSESSMENT_TYPE_GENERIC) {
    const current = normaliseAssessmentTypeState(currentDraft);
    const targetType = normaliseAssessmentType(nextAssessmentType);
    if (current.assessmentType === targetType) return current;

    const defaults = buildDefaultAssessmentTypeState(targetType);
    return {
      assessmentType: targetType,
      projectContext: normaliseProjectContext({
        ...current.projectContext,
        projectRole: projectRoleForAssessmentType(targetType)
      }, targetType),
      enterpriseRiskContext: current.enterpriseRiskContext,
      projectRouteDetails: current.projectRouteDetails,
      buyerProxyQuestions: targetType === ASSESSMENT_TYPE_PROJECT_BUYER
        ? current.buyerProxyQuestions
        : defaults.buyerProxyQuestions,
      sellerProxyQuestions: targetType === ASSESSMENT_TYPE_PROJECT_SELLER
        ? current.sellerProxyQuestions
        : defaults.sellerProxyQuestions,
      buyerEconomics: targetType === ASSESSMENT_TYPE_PROJECT_BUYER
        ? current.buyerEconomics
        : defaults.buyerEconomics,
      buyerEconomicsMeta: targetType === ASSESSMENT_TYPE_PROJECT_BUYER
        ? current.buyerEconomicsMeta
        : defaults.buyerEconomicsMeta,
      sellerEconomics: targetType === ASSESSMENT_TYPE_PROJECT_SELLER
        ? current.sellerEconomics
        : defaults.sellerEconomics,
      sellerEconomicsMeta: targetType === ASSESSMENT_TYPE_PROJECT_SELLER
        ? current.sellerEconomicsMeta
        : defaults.sellerEconomicsMeta,
      projectExposure: current.projectExposure
    };
  }

  function applyAssessmentTypeSelectionToDraft(draft = {}, nextAssessmentType = ASSESSMENT_TYPE_GENERIC) {
    const target = draft && typeof draft === 'object' ? draft : {};
    const patch = buildAssessmentTypeChangePatch(target, nextAssessmentType);
    Object.assign(target, patch);
    return target;
  }

  const exported = {
    ASSESSMENT_TYPE_GENERIC,
    ASSESSMENT_TYPE_PROJECT_BUYER,
    ASSESSMENT_TYPE_PROJECT_SELLER,
    VALUATION_MODE_BENCHMARK_LED,
    VALUATION_MODE_PROJECT_LINKED,
    VALUATION_MODE_HYBRID,
    ASSESSMENT_SCREEN_GENERIC_INPUTS,
    ASSESSMENT_SCREEN_PROJECT_BUYER_INPUTS,
    ASSESSMENT_SCREEN_PROJECT_SELLER_INPUTS,
    MAX_PROJECT_EXPOSURE_ARRAY_ITEMS,
    MAX_PROJECT_EXPOSURE_TEXT_LENGTH,
    MAX_PROJECT_EXPOSURE_SHORT_TEXT_LENGTH,
    BUYER_ECONOMICS_FIELDS,
    SELLER_ECONOMICS_FIELDS,
    normaliseAssessmentType,
    normalizeAssessmentType: normaliseAssessmentType,
    normaliseValuationMode,
    normalizeValuationMode: normaliseValuationMode,
    getAssessmentTypeNextScreen,
    getAssessmentTypeNextRoute,
    getAssessmentTypeCards,
    normaliseProjectRole,
    normalizeProjectRole: normaliseProjectRole,
    normaliseProjectContext,
    normalizeProjectContext: normaliseProjectContext,
    normaliseEnterpriseRiskContext,
    normalizeEnterpriseRiskContext: normaliseEnterpriseRiskContext,
    normaliseProjectRouteDetails,
    normalizeProjectRouteDetails: normaliseProjectRouteDetails,
    normaliseBuyerEconomics,
    normalizeBuyerEconomics: normaliseBuyerEconomics,
    normaliseBuyerEconomicsMeta,
    normalizeBuyerEconomicsMeta: normaliseBuyerEconomicsMeta,
    normaliseBuyerProxyQuestions,
    normalizeBuyerProxyQuestions: normaliseBuyerProxyQuestions,
    normaliseSellerEconomics,
    normalizeSellerEconomics: normaliseSellerEconomics,
    normaliseSellerEconomicsMeta,
    normalizeSellerEconomicsMeta: normaliseSellerEconomicsMeta,
    normaliseSellerProxyQuestions,
    normalizeSellerProxyQuestions: normaliseSellerProxyQuestions,
    normaliseProjectExposure,
    normalizeProjectExposure: normaliseProjectExposure,
    normaliseAssessmentTypeState,
    normalizeAssessmentTypeState: normaliseAssessmentTypeState,
    buildAssessmentTypeState,
    buildDefaultAssessmentTypeState,
    buildAssessmentTypeChangePatch,
    applyAssessmentTypeSelectionToDraft
  };

  Object.assign(globalScope, exported, {
    AssessmentTypeModel: exported
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
