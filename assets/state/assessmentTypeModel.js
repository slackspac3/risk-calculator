'use strict';

(function attachAssessmentTypeModel(globalScope) {
  const ASSESSMENT_TYPE_GENERIC = 'enterprise_generic';
  const ASSESSMENT_TYPE_PROJECT_BUYER = 'project_buyer';
  const ASSESSMENT_TYPE_PROJECT_SELLER = 'project_seller';

  const VALUATION_MODE_BENCHMARK_LED = 'benchmark_led';
  const VALUATION_MODE_PROJECT_LINKED = 'project_linked';
  const VALUATION_MODE_HYBRID = 'hybrid';

  const MAX_PROJECT_EXPOSURE_ARRAY_ITEMS = 20;
  const MAX_PROJECT_EXPOSURE_MAP_KEYS = 30;
  const MAX_NESTED_ARRAY_ITEMS = 8;
  const MAX_NESTED_OBJECT_KEYS = 12;

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

  function normaliseText(value) {
    if (value === null || value === undefined) return '';
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
      return String(value).trim();
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

  function normaliseAssessmentType(value) {
    const next = normaliseText(value).toLowerCase();
    return VALID_ASSESSMENT_TYPES.has(next) ? next : ASSESSMENT_TYPE_GENERIC;
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
        const key = normaliseText(rawKey);
        if (!key) return;
        const item = normaliseLooseValue(readField(value, rawKey), depth + 1);
        if (item === null || item === '') return;
        output[key] = item;
      });
      return output;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'bigint') return String(value);
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
      const key = normaliseText(rawKey);
      if (!key) return;
      const item = normaliseLooseValue(readField(value, rawKey), 0);
      if (item === null || item === '') return;
      output[key] = item;
    });
    return output;
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

  function normaliseBuyerEconomics(buyerEconomics = {}) {
    const source = isPlainObject(buyerEconomics) ? buyerEconomics : {};
    return {
      expectedSpend: normaliseFiniteNumber(readField(source, 'expectedSpend')),
      approvedBudget: normaliseFiniteNumber(readField(source, 'approvedBudget')),
      remainingSpend: normaliseFiniteNumber(readField(source, 'remainingSpend')),
      amountCommitted: normaliseFiniteNumber(readField(source, 'amountCommitted')),
      amountPaid: normaliseFiniteNumber(readField(source, 'amountPaid')),
      delayCostPerDay: normaliseFiniteNumber(readField(source, 'delayCostPerDay')),
      expectedBenefitPerDay: normaliseFiniteNumber(readField(source, 'expectedBenefitPerDay')),
      reprocurementPremiumPct: normalisePercentage(readField(source, 'reprocurementPremiumPct')),
      supplierCredits: normaliseFiniteNumber(readField(source, 'supplierCredits')),
      insuranceRecoveries: normaliseFiniteNumber(readField(source, 'insuranceRecoveries')),
      liquidatedDamagesRecoverable: normaliseFiniteNumber(readField(source, 'liquidatedDamagesRecoverable')),
      contractualRecoveryCap: normaliseFiniteNumber(readField(source, 'contractualRecoveryCap'))
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
      costToCure: normaliseFiniteNumber(readField(source, 'costToCure'))
    };
  }

  function normaliseProjectExposure(projectExposure = {}) {
    const source = isPlainObject(projectExposure) ? projectExposure : {};
    return {
      valuationMode: normaliseValuationMode(readField(source, 'valuationMode')),
      projectExposureSummary: normaliseText(readField(source, 'projectExposureSummary')),
      financialDrivers: normaliseCappedArray(readField(source, 'financialDrivers')),
      capsAndOffsets: normaliseCappedArray(readField(source, 'capsAndOffsets')),
      doubleCountingWarnings: normaliseCappedArray(readField(source, 'doubleCountingWarnings')),
      missingInputs: normaliseCappedArray(readField(source, 'missingInputs')),
      mapsToRiskParameters: normaliseRiskParameterMap(readField(source, 'mapsToRiskParameters'))
    };
  }

  function normaliseAssessmentTypeState(value = {}) {
    const source = isPlainObject(value) ? value : {};
    const assessmentType = normaliseAssessmentType(readField(source, 'assessmentType'));
    return {
      assessmentType,
      projectContext: normaliseProjectContext(readField(source, 'projectContext'), assessmentType),
      buyerEconomics: normaliseBuyerEconomics(readField(source, 'buyerEconomics')),
      sellerEconomics: normaliseSellerEconomics(readField(source, 'sellerEconomics')),
      projectExposure: normaliseProjectExposure(readField(source, 'projectExposure'))
    };
  }

  function buildAssessmentTypeState(value = {}) {
    return normaliseAssessmentTypeState(value);
  }

  function buildDefaultAssessmentTypeState(assessmentType = ASSESSMENT_TYPE_GENERIC) {
    return normaliseAssessmentTypeState({ assessmentType });
  }

  const exported = {
    ASSESSMENT_TYPE_GENERIC,
    ASSESSMENT_TYPE_PROJECT_BUYER,
    ASSESSMENT_TYPE_PROJECT_SELLER,
    VALUATION_MODE_BENCHMARK_LED,
    VALUATION_MODE_PROJECT_LINKED,
    VALUATION_MODE_HYBRID,
    MAX_PROJECT_EXPOSURE_ARRAY_ITEMS,
    normaliseAssessmentType,
    normalizeAssessmentType: normaliseAssessmentType,
    normaliseValuationMode,
    normalizeValuationMode: normaliseValuationMode,
    normaliseProjectRole,
    normalizeProjectRole: normaliseProjectRole,
    normaliseProjectContext,
    normalizeProjectContext: normaliseProjectContext,
    normaliseBuyerEconomics,
    normalizeBuyerEconomics: normaliseBuyerEconomics,
    normaliseSellerEconomics,
    normalizeSellerEconomics: normaliseSellerEconomics,
    normaliseProjectExposure,
    normalizeProjectExposure: normaliseProjectExposure,
    normaliseAssessmentTypeState,
    normalizeAssessmentTypeState: normaliseAssessmentTypeState,
    buildAssessmentTypeState,
    buildDefaultAssessmentTypeState
  };

  Object.assign(globalScope, exported, {
    AssessmentTypeModel: exported
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
