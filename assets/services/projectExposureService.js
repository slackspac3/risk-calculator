'use strict';

(function attachProjectExposureService(globalScope) {
  const MODEL = (() => {
    if (globalScope && globalScope.AssessmentTypeModel) return globalScope.AssessmentTypeModel;
    if (typeof require === 'function') {
      try {
        return require('../state/assessmentTypeModel.js');
      } catch {
        return null;
      }
    }
    return null;
  })();

  const ASSESSMENT_TYPE_GENERIC = MODEL?.ASSESSMENT_TYPE_GENERIC || 'enterprise_generic';
  const ASSESSMENT_TYPE_PROJECT_BUYER = MODEL?.ASSESSMENT_TYPE_PROJECT_BUYER || 'project_buyer';
  const ASSESSMENT_TYPE_PROJECT_SELLER = MODEL?.ASSESSMENT_TYPE_PROJECT_SELLER || 'project_seller';

  const QUANTIFIED_STATUSES = new Set(['known', 'estimated', 'derived', 'benchmark_proxy', 'evidence_supported']);
  const KNOWN_STATUSES = new Set(['known', 'derived', 'evidence_supported']);
  const DRIVER_STATUSES = Object.freeze({
    calculated: 'calculated_driver',
    estimated: 'estimated_driver',
    benchmarkProxy: 'benchmark_proxy_driver',
    unquantified: 'unquantified_driver',
    notApplicable: 'not_applicable_driver'
  });

  const RISK_BUCKETS = Object.freeze([
    'incidentResponse',
    'businessInterruption',
    'dataRemediation',
    'regulatoryLegal',
    'thirdParty',
    'reputationContract',
    'secondaryLoss'
  ]);

  const BUYER_HIGH_IMPACT_FIELDS = Object.freeze([
    'delayDurationDays',
    'delayCostPerDay',
    'expectedBenefitPerDay',
    'remainingSpend',
    'reprocurementPremiumPct',
    'amountPaid',
    'amountCommitted',
    'contractualRecoveryCap',
    'supplierCredits',
    'insuranceRecoveries',
    'liquidatedDamagesRecoverable'
  ]);

  const SELLER_HIGH_IMPACT_FIELDS = Object.freeze([
    'expectedRevenue',
    'contractValue',
    'grossMarginPct',
    'contributionMargin',
    'costToCure',
    'liquidatedDamagesCap',
    'slaCreditsCap',
    'liabilityCap',
    'terminationExposure',
    'revenueRecognitionAtRisk',
    'renewalValueAtRisk'
  ]);

  const FIELD_LABELS = Object.freeze({
    delayDurationDays: 'Likely delay duration',
    delayCostPerDay: 'Delay cost per day',
    delayCostPerWeek: 'Delay cost per week',
    expectedBenefitPerDay: 'Expected benefit per day',
    expectedBenefitPerWeek: 'Expected benefit per week',
    remainingSpend: 'Remaining spend',
    reprocurementPremiumPct: 'Reprocurement premium percentage',
    amountPaid: 'Amount already paid',
    amountCommitted: 'Amount committed',
    legalDisputeEstimate: 'Legal or dispute estimate',
    supplierCredits: 'Supplier credits',
    insuranceRecoveries: 'Insurance recoveries',
    liquidatedDamagesRecoverable: 'Liquidated damages recoverable',
    contractualRecoveryCap: 'Contractual recovery cap',
    expectedRevenue: 'Expected revenue',
    contractValue: 'Contract value',
    grossMarginPct: 'Gross margin percentage',
    contributionMargin: 'Contribution margin',
    costToCure: 'Cost to cure',
    warrantyExposure: 'Warranty exposure',
    liquidatedDamagesCap: 'Liquidated damages cap',
    slaCreditsCap: 'SLA credits cap',
    liabilityCap: 'Liability cap',
    terminationExposure: 'Termination exposure',
    revenueRecognitionAtRisk: 'Revenue recognition at risk',
    renewalValueAtRisk: 'Renewal or future pipeline exposure'
  });

  const FIELD_OWNER_HINTS = Object.freeze({
    delayDurationDays: 'Project manager or delivery lead',
    delayCostPerDay: 'Finance business partner or project controls',
    expectedBenefitPerDay: 'Business sponsor or benefits owner',
    remainingSpend: 'Project finance or procurement',
    reprocurementPremiumPct: 'Procurement or commercial lead',
    amountPaid: 'Accounts payable or project finance',
    amountCommitted: 'Procurement or contract owner',
    legalDisputeEstimate: 'Legal or contract manager',
    supplierCredits: 'Commercial manager or supplier owner',
    insuranceRecoveries: 'Insurance or risk finance',
    liquidatedDamagesRecoverable: 'Legal or contract manager',
    contractualRecoveryCap: 'Legal or contract manager',
    expectedRevenue: 'Sales finance or deal owner',
    contractValue: 'Commercial or sales operations',
    grossMarginPct: 'Finance business partner',
    contributionMargin: 'Finance business partner',
    costToCure: 'Delivery lead or project controls',
    warrantyExposure: 'Service owner or legal',
    liquidatedDamagesCap: 'Legal or commercial manager',
    slaCreditsCap: 'Service owner or commercial manager',
    liabilityCap: 'Legal or commercial manager',
    terminationExposure: 'Legal, commercial, or account owner',
    revenueRecognitionAtRisk: 'Revenue accounting or finance',
    renewalValueAtRisk: 'Account owner or sales leadership'
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

  function normaliseText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
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
    if (typeof MODEL?.normaliseAssessmentType === 'function') return MODEL.normaliseAssessmentType(value);
    const next = normaliseText(value).toLowerCase();
    return [ASSESSMENT_TYPE_GENERIC, ASSESSMENT_TYPE_PROJECT_BUYER, ASSESSMENT_TYPE_PROJECT_SELLER].includes(next)
      ? next
      : ASSESSMENT_TYPE_GENERIC;
  }

  function normaliseValuationMode(value) {
    if (typeof MODEL?.normaliseValuationMode === 'function') return MODEL.normaliseValuationMode(value);
    const next = normaliseText(value).toLowerCase();
    return ['benchmark_led', 'project_linked', 'hybrid'].includes(next) ? next : 'benchmark_led';
  }

  function normaliseEconomics(economics = {}, type = 'buyer') {
    if (type === 'seller' && typeof MODEL?.normaliseSellerEconomics === 'function') {
      return MODEL.normaliseSellerEconomics(economics);
    }
    if (type === 'buyer' && typeof MODEL?.normaliseBuyerEconomics === 'function') {
      return MODEL.normaliseBuyerEconomics(economics);
    }
    const source = isPlainObject(economics) ? economics : {};
    return Object.keys(source).reduce((output, field) => {
      output[field] = /Pct|Probability/.test(field) ? normalisePercentage(readField(source, field)) : normaliseFiniteNumber(readField(source, field));
      return output;
    }, {});
  }

  function normaliseMeta(economics = {}, economicsMeta = {}, type = 'buyer') {
    if (type === 'seller' && typeof MODEL?.normaliseSellerEconomicsMeta === 'function') {
      return MODEL.normaliseSellerEconomicsMeta(economics, economicsMeta);
    }
    if (type === 'buyer' && typeof MODEL?.normaliseBuyerEconomicsMeta === 'function') {
      return MODEL.normaliseBuyerEconomicsMeta(economics, economicsMeta);
    }
    const fields = Object.keys(economics || {});
    const source = isPlainObject(economicsMeta) ? economicsMeta : {};
    return fields.reduce((output, field) => {
      const value = readField(economics, field);
      const raw = isPlainObject(readField(source, field)) ? readField(source, field) : {};
      const status = value === null
        ? (readField(raw, 'status') === 'not_applicable' ? 'not_applicable' : 'unknown')
        : (normaliseText(readField(raw, 'status')) || 'known');
      output[field] = {
        status,
        confidence: normaliseText(readField(raw, 'confidence')) || (value === null ? 'unknown' : 'medium'),
        source: status === 'unknown' || status === 'not_applicable' ? 'not_provided' : (normaliseText(readField(raw, 'source')) || 'user'),
        note: normaliseText(readField(raw, 'note'))
      };
      return output;
    }, {});
  }

  function buildState(input = {}) {
    const source = isPlainObject(input) ? input : {};
    if (typeof MODEL?.normaliseAssessmentTypeState === 'function') {
      return MODEL.normaliseAssessmentTypeState(source);
    }
    const assessmentType = normaliseAssessmentType(readField(source, 'assessmentType'));
    const buyerEconomics = normaliseEconomics(readField(source, 'buyerEconomics'), 'buyer');
    const sellerEconomics = normaliseEconomics(readField(source, 'sellerEconomics'), 'seller');
    return {
      assessmentType,
      projectContext: isPlainObject(readField(source, 'projectContext')) ? readField(source, 'projectContext') : {},
      buyerProxyQuestions: isPlainObject(readField(source, 'buyerProxyQuestions')) ? readField(source, 'buyerProxyQuestions') : {},
      sellerProxyQuestions: isPlainObject(readField(source, 'sellerProxyQuestions')) ? readField(source, 'sellerProxyQuestions') : {},
      buyerEconomics,
      buyerEconomicsMeta: normaliseMeta(buyerEconomics, readField(source, 'buyerEconomicsMeta'), 'buyer'),
      sellerEconomics,
      sellerEconomicsMeta: normaliseMeta(sellerEconomics, readField(source, 'sellerEconomicsMeta'), 'seller'),
      projectExposure: isPlainObject(readField(source, 'projectExposure')) ? readField(source, 'projectExposure') : {}
    };
  }

  function getFinancialFieldStatus(economics = {}, economicsMeta = {}, fieldName = '') {
    const field = normaliseText(fieldName);
    const value = normaliseFiniteNumber(readField(economics, field));
    const rawMeta = isPlainObject(readField(economicsMeta, field)) ? readField(economicsMeta, field) : {};
    let status = normaliseText(readField(rawMeta, 'status')).toLowerCase();
    if (!status) status = value === null ? 'unknown' : 'known';
    if (value === null && status !== 'not_applicable') status = 'unknown';
    if (value !== null && !QUANTIFIED_STATUSES.has(status) && status !== 'not_applicable') status = 'known';
    return {
      field,
      label: FIELD_LABELS[field] || field,
      value,
      status,
      confidence: normaliseText(readField(rawMeta, 'confidence')).toLowerCase() || (value === null ? 'unknown' : 'medium'),
      source: status === 'unknown' || status === 'not_applicable'
        ? 'not_provided'
        : (normaliseText(readField(rawMeta, 'source')).toLowerCase() || 'user'),
      note: normaliseText(readField(rawMeta, 'note'))
    };
  }

  function isKnownFinancialField(economics = {}, economicsMeta = {}, fieldName = '') {
    const field = getFinancialFieldStatus(economics, economicsMeta, fieldName);
    return field.value !== null && QUANTIFIED_STATUSES.has(field.status);
  }

  function isUnknownFinancialField(economics = {}, economicsMeta = {}, fieldName = '') {
    const field = getFinancialFieldStatus(economics, economicsMeta, fieldName);
    return field.status === 'unknown' || field.value === null;
  }

  function isNotApplicableField(economics = {}, economicsMeta = {}, fieldName = '') {
    return getFinancialFieldStatus(economics, economicsMeta, fieldName).status === 'not_applicable';
  }

  function driverStatusFromFields(fields = []) {
    const usable = fields.filter(Boolean);
    if (!usable.length || usable.every(field => field.status === 'not_applicable')) return DRIVER_STATUSES.notApplicable;
    if (usable.some(field => field.status === 'unknown' || field.value === null)) return DRIVER_STATUSES.unquantified;
    if (usable.some(field => field.status === 'benchmark_proxy')) return DRIVER_STATUSES.benchmarkProxy;
    if (usable.some(field => field.status === 'estimated')) return DRIVER_STATUSES.estimated;
    return DRIVER_STATUSES.calculated;
  }

  function confidenceFromFields(fields = []) {
    const statuses = fields.filter(Boolean).map(field => field.status);
    const confidences = fields.filter(Boolean).map(field => field.confidence);
    if (statuses.some(status => status === 'unknown')) return 'low';
    if (statuses.some(status => status === 'benchmark_proxy')) return 'low';
    if (confidences.some(confidence => confidence === 'low')) return 'low';
    if (statuses.some(status => status === 'estimated') || confidences.some(confidence => confidence === 'medium' || confidence === 'unknown')) return 'medium';
    return 'high';
  }

  function sourceFromFields(fields = []) {
    const statuses = fields.filter(Boolean).map(field => field.status);
    if (statuses.some(status => status === 'unknown')) return 'unknown';
    if (statuses.some(status => status === 'benchmark_proxy')) return 'benchmark';
    if (statuses.some(status => status === 'estimated')) return 'user_estimate';
    if (statuses.some(status => status === 'derived')) return 'project_exposure_mapper';
    if (statuses.some(status => status === 'evidence_supported')) return 'evidence_supported';
    return 'user';
  }

  function rangeFromAmount(amount, driverStatus) {
    const value = normaliseFiniteNumber(amount);
    if (value === null) return { low: null, likely: null, high: null };
    if (driverStatus === DRIVER_STATUSES.benchmarkProxy) {
      return {
        low: roundMoney(value * 0.7),
        likely: roundMoney(value),
        high: roundMoney(value * 1.4)
      };
    }
    if (driverStatus === DRIVER_STATUSES.estimated) {
      return {
        low: roundMoney(value * 0.8),
        likely: roundMoney(value),
        high: roundMoney(value * 1.2)
      };
    }
    return {
      low: roundMoney(value),
      likely: roundMoney(value),
      high: roundMoney(value)
    };
  }

  function roundMoney(value) {
    if (!Number.isFinite(Number(value))) return null;
    return Math.round(Number(value) * 100) / 100;
  }

  function makeMissingInput(field, options = {}) {
    const label = FIELD_LABELS[field] || normaliseText(options.label) || field;
    const mapsTo = options.mapsTo || [];
    return {
      field,
      label,
      importance: options.importance || 'high',
      whyItMatters: options.whyItMatters || `${label} is needed to quantify this project exposure without treating unknowns as zero.`,
      whoMightKnow: options.whoMightKnow || FIELD_OWNER_HINTS[field] || 'Assessment owner',
      suggestedQuestion: options.suggestedQuestion || `Can you confirm ${label.toLowerCase()} for this project, or mark it as unknown/not applicable?`,
      mapsTo: Array.isArray(mapsTo) ? mapsTo : [mapsTo].filter(Boolean)
    };
  }

  function missingInputsForFields(fields = [], mapsTo = [], overrides = {}) {
    return fields
      .filter(field => field && (field.status === 'unknown' || field.value === null))
      .map(field => makeMissingInput(field.field, {
        mapsTo,
        ...(overrides[field.field] || {})
      }));
  }

  function makeDriver({
    id,
    label,
    driverType,
    fields = [],
    amount = null,
    formula = '',
    mapsTo = [],
    rationale = '',
    missingInputs = [],
    forceStatus = ''
  }) {
    const driverStatus = forceStatus || driverStatusFromFields(fields);
    const numericRange = driverStatus === DRIVER_STATUSES.unquantified || driverStatus === DRIVER_STATUSES.notApplicable
      ? { low: null, likely: null, high: null }
      : rangeFromAmount(amount, driverStatus);
    return {
      id,
      label,
      driverType,
      driverStatus,
      formula: driverStatus === DRIVER_STATUSES.unquantified || driverStatus === DRIVER_STATUSES.notApplicable ? '' : formula,
      low: numericRange.low,
      likely: numericRange.likely,
      high: numericRange.high,
      mapsTo: Array.isArray(mapsTo) ? mapsTo : [mapsTo].filter(Boolean),
      confidence: driverStatus === DRIVER_STATUSES.unquantified ? 'low' : confidenceFromFields(fields),
      source: driverStatus === DRIVER_STATUSES.unquantified ? 'unknown' : sourceFromFields(fields),
      missingInputs,
      rationale
    };
  }

  function makeNotApplicableDriver(id, label, driverType, mapsTo, rationale) {
    return makeDriver({
      id,
      label,
      driverType,
      mapsTo,
      rationale,
      forceStatus: DRIVER_STATUSES.notApplicable
    });
  }

  function makeOffset({ id, label, offsetType, field, amount, appliesTo, economics, economicsMeta, rationale }) {
    const status = getFinancialFieldStatus(economics, economicsMeta, field);
    const driverStatus = driverStatusFromFields([status]);
    const range = driverStatus === DRIVER_STATUSES.unquantified || driverStatus === DRIVER_STATUSES.notApplicable
      ? { low: null, likely: null, high: null }
      : rangeFromAmount(amount, driverStatus);
    return {
      id,
      label,
      offsetType,
      offsetStatus: driverStatus === DRIVER_STATUSES.calculated ? 'calculated_offset' : driverStatus.replace('_driver', '_offset'),
      field,
      amount: status.value,
      low: range.low,
      likely: range.likely,
      high: range.high,
      appliesTo: Array.isArray(appliesTo) ? appliesTo : [appliesTo].filter(Boolean),
      confidence: driverStatus === DRIVER_STATUSES.unquantified ? 'low' : confidenceFromFields([status]),
      source: driverStatus === DRIVER_STATUSES.unquantified ? 'unknown' : sourceFromFields([status]),
      rationale
    };
  }

  function calculateProjectHorizonContext(input = {}) {
    const source = isPlainObject(input) ? input : {};
    const horizon = isPlainObject(readField(source, 'projectHorizon')) ? readField(source, 'projectHorizon') : {};
    const context = isPlainObject(readField(source, 'projectContext')) ? readField(source, 'projectContext') : {};
    const proxy = isPlainObject(readField(source, 'buyerProxyQuestions')) ? readField(source, 'buyerProxyQuestions') : {};
    const candidateDays = [
      readField(source, 'delayDurationDays'),
      readField(source, 'likelyDelayDays'),
      readField(source, 'delayDays'),
      readField(horizon, 'delayDurationDays'),
      readField(horizon, 'likelyDelayDays'),
      readField(context, 'delayDurationDays')
    ].map(normaliseFiniteNumber).find(value => value !== null);
    const candidateWeeks = [
      readField(source, 'delayDurationWeeks'),
      readField(source, 'likelyDelayWeeks'),
      readField(horizon, 'delayDurationWeeks'),
      readField(horizon, 'likelyDelayWeeks'),
      readField(context, 'delayDurationWeeks')
    ].map(normaliseFiniteNumber).find(value => value !== null);
    const candidateMonths = [
      readField(source, 'delayDurationMonths'),
      readField(source, 'likelyDelayMonths'),
      readField(horizon, 'delayDurationMonths'),
      readField(horizon, 'likelyDelayMonths'),
      readField(context, 'delayDurationMonths')
    ].map(normaliseFiniteNumber).find(value => value !== null);
    let delayDurationDays = candidateDays;
    let delaySourceField = 'delayDurationDays';
    if (delayDurationDays === undefined || delayDurationDays === null) {
      if (candidateWeeks !== undefined && candidateWeeks !== null) {
        delayDurationDays = candidateWeeks * 7;
        delaySourceField = 'delayDurationWeeks';
      } else if (candidateMonths !== undefined && candidateMonths !== null) {
        delayDurationDays = candidateMonths * 30;
        delaySourceField = 'delayDurationMonths';
      } else {
        delayDurationDays = null;
      }
    }
    const rawStatus = normaliseText(readField(horizon, 'delayDurationStatus') || readField(source, 'delayDurationStatus')).toLowerCase();
    const status = delayDurationDays === null ? 'unknown' : (QUANTIFIED_STATUSES.has(rawStatus) ? rawStatus : 'known');
    return {
      delayDurationDays: delayDurationDays === null ? null : roundMoney(delayDurationDays),
      delayDurationWeeks: delayDurationDays === null ? null : roundMoney(delayDurationDays / 7),
      delayDurationMonths: delayDurationDays === null ? null : roundMoney(delayDurationDays / 30),
      delayStatus: status,
      delaySourceField,
      qualitativeDelay: normaliseText(readField(proxy, 'likelyDelay')).toLowerCase() || 'unknown',
      projectDurationMonths: normaliseFiniteNumber(readField(context, 'projectDurationMonths')),
      criticalMilestoneDate: normaliseText(readField(context, 'criticalMilestoneDate')),
      missingInputs: delayDurationDays === null
        ? [makeMissingInput('delayDurationDays', {
            mapsTo: ['businessInterruption'],
            whyItMatters: 'Delay duration is needed before delay cost or delayed benefit can be quantified.',
            suggestedQuestion: 'If this risk materialises, is the expected delay measured in days, weeks, or months, and what planning value should be used?'
          })]
        : []
    };
  }

  function buildDelayField(horizonContext) {
    return {
      field: 'delayDurationDays',
      label: FIELD_LABELS.delayDurationDays,
      value: horizonContext.delayDurationDays,
      status: horizonContext.delayStatus,
      confidence: horizonContext.delayStatus === 'known' ? 'medium' : 'low',
      source: horizonContext.delayStatus === 'unknown' ? 'unknown' : 'user'
    };
  }

  function buildBuyerProjectExposure(input = {}) {
    const state = buildState({ ...input, assessmentType: ASSESSMENT_TYPE_PROJECT_BUYER });
    const economics = state.buyerEconomics || {};
    const meta = state.buyerEconomicsMeta || {};
    const horizonContext = calculateProjectHorizonContext({ ...input, projectContext: state.projectContext, buyerProxyQuestions: state.buyerProxyQuestions });
    const delayDuration = buildDelayField(horizonContext);
    const drivers = [];
    const capsAndOffsets = [];

    const delayCost = getFinancialFieldStatus(economics, meta, 'delayCostPerDay');
    if (isNotApplicableField(economics, meta, 'delayCostPerDay')) {
      drivers.push(makeNotApplicableDriver('buyer-delay-cost', 'Delay cost', 'delay_cost', ['businessInterruption'], 'Delay cost was marked not applicable.'));
    } else if (delayDuration.value !== null && isKnownFinancialField(economics, meta, 'delayCostPerDay')) {
      drivers.push(makeDriver({
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverType: 'delay_cost',
        fields: [delayDuration, delayCost],
        amount: delayDuration.value * delayCost.value,
        formula: 'delay duration days x delay cost per day',
        mapsTo: ['businessInterruption'],
        rationale: 'Buyer-side delay cost is linked to project delay duration and the daily cost of disruption.'
      }));
    } else {
      drivers.push(makeDriver({
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverType: 'delay_cost',
        fields: [delayDuration, delayCost],
        mapsTo: ['businessInterruption'],
        missingInputs: missingInputsForFields([delayDuration, delayCost], ['businessInterruption']),
        rationale: 'Delay cost is relevant but cannot be quantified without both duration and daily cost.'
      }));
    }

    const benefitPerDay = getFinancialFieldStatus(economics, meta, 'expectedBenefitPerDay');
    if (isNotApplicableField(economics, meta, 'expectedBenefitPerDay')) {
      drivers.push(makeNotApplicableDriver('buyer-delayed-benefit', 'Delayed benefit', 'delayed_benefit', ['businessInterruption', 'secondaryLoss'], 'Expected benefit was marked not applicable.'));
    } else if (delayDuration.value !== null && isKnownFinancialField(economics, meta, 'expectedBenefitPerDay')) {
      drivers.push(makeDriver({
        id: 'buyer-delayed-benefit',
        label: 'Delayed benefit',
        driverType: 'delayed_benefit',
        fields: [delayDuration, benefitPerDay],
        amount: delayDuration.value * benefitPerDay.value,
        formula: 'delay duration days x expected benefit per day',
        mapsTo: ['businessInterruption', 'secondaryLoss'],
        rationale: 'Delayed benefit is kept separate from disruption cost so the same delay is not counted twice.'
      }));
    } else if (state.buyerProxyQuestions?.mainImpact === 'delayed_benefit' || benefitPerDay.status !== 'not_applicable') {
      drivers.push(makeDriver({
        id: 'buyer-delayed-benefit',
        label: 'Delayed benefit',
        driverType: 'delayed_benefit',
        fields: [delayDuration, benefitPerDay],
        mapsTo: ['businessInterruption', 'secondaryLoss'],
        missingInputs: missingInputsForFields([delayDuration, benefitPerDay], ['businessInterruption', 'secondaryLoss']),
        rationale: 'Delayed benefit is potentially relevant but remains unquantified until the daily benefit and duration are known.'
      }));
    }

    const remainingSpend = getFinancialFieldStatus(economics, meta, 'remainingSpend');
    const premiumPct = getFinancialFieldStatus(economics, meta, 'reprocurementPremiumPct');
    if (isNotApplicableField(economics, meta, 'reprocurementPremiumPct')) {
      drivers.push(makeNotApplicableDriver('buyer-reprocurement-premium', 'Reprocurement premium', 'reprocurement_premium', ['thirdParty', 'reputationContract'], 'Reprocurement premium was marked not applicable.'));
    } else if (isKnownFinancialField(economics, meta, 'remainingSpend') && isKnownFinancialField(economics, meta, 'reprocurementPremiumPct')) {
      drivers.push(makeDriver({
        id: 'buyer-reprocurement-premium',
        label: 'Reprocurement premium',
        driverType: 'reprocurement_premium',
        fields: [remainingSpend, premiumPct],
        amount: remainingSpend.value * premiumPct.value,
        formula: 'remaining spend x reprocurement premium percentage',
        mapsTo: ['thirdParty', 'reputationContract'],
        rationale: 'Reprocurement premium captures incremental replacement cost, not the full remaining spend.'
      }));
    } else if (state.buyerProxyQuestions?.mainImpact === 'supplier_replacement' || state.buyerProxyQuestions?.supplierReplacementDifficulty !== 'easy') {
      drivers.push(makeDriver({
        id: 'buyer-reprocurement-premium',
        label: 'Reprocurement premium',
        driverType: 'reprocurement_premium',
        fields: [remainingSpend, premiumPct],
        mapsTo: ['thirdParty', 'reputationContract'],
        missingInputs: missingInputsForFields([remainingSpend, premiumPct], ['thirdParty', 'reputationContract']),
        rationale: 'Supplier replacement may create a premium, but unknown spend or premium percentage is not treated as zero.'
      }));
    }

    const amountPaid = getFinancialFieldStatus(economics, meta, 'amountPaid');
    const amountCommitted = getFinancialFieldStatus(economics, meta, 'amountCommitted');
    if (amountPaid.status === 'not_applicable' && amountCommitted.status === 'not_applicable') {
      drivers.push(makeNotApplicableDriver('buyer-sunk-cost-at-risk', 'Sunk cost at risk', 'sunk_cost', ['thirdParty'], 'Paid and committed amounts were marked not applicable.'));
    } else if (isKnownFinancialField(economics, meta, 'amountPaid') || isKnownFinancialField(economics, meta, 'amountCommitted')) {
      const paid = isKnownFinancialField(economics, meta, 'amountPaid') ? amountPaid.value : 0;
      const committed = isKnownFinancialField(economics, meta, 'amountCommitted') ? amountCommitted.value : 0;
      drivers.push(makeDriver({
        id: 'buyer-sunk-cost-at-risk',
        label: 'Sunk cost at risk',
        driverType: 'sunk_cost',
        fields: [amountPaid, amountCommitted].filter(field => field.value !== null),
        amount: Math.max(paid, committed),
        formula: 'max(amount paid, amount committed)',
        mapsTo: ['thirdParty'],
        rationale: 'Paid and committed amounts are treated as potentially overlapping, so the maximum is used to avoid double counting.'
      }));
    } else if (['some', 'most'].includes(state.buyerProxyQuestions?.moneyPaidCommitted)) {
      drivers.push(makeDriver({
        id: 'buyer-sunk-cost-at-risk',
        label: 'Sunk cost at risk',
        driverType: 'sunk_cost',
        fields: [amountPaid, amountCommitted],
        mapsTo: ['thirdParty'],
        missingInputs: missingInputsForFields([amountPaid, amountCommitted], ['thirdParty']),
        rationale: 'Money has probably been paid or committed, but the exposure stays unquantified until the value is known.'
      }));
    }

    const legalEstimate = getFinancialFieldStatus(economics, meta, 'legalDisputeEstimate');
    if (isKnownFinancialField(economics, meta, 'legalDisputeEstimate')) {
      drivers.push(makeDriver({
        id: 'buyer-legal-dispute-cost',
        label: 'Legal or dispute cost',
        driverType: 'legal_dispute_cost',
        fields: [legalEstimate],
        amount: legalEstimate.value,
        formula: 'legal/dispute estimate',
        mapsTo: ['regulatoryLegal', 'reputationContract'],
        rationale: 'Legal and dispute estimates are mapped separately from supplier replacement and delay cost.'
      }));
    } else if (state.buyerProxyQuestions?.mainImpact === 'legal_dispute') {
      drivers.push(makeDriver({
        id: 'buyer-legal-dispute-cost',
        label: 'Legal or dispute cost',
        driverType: 'legal_dispute_cost',
        fields: [legalEstimate],
        mapsTo: ['regulatoryLegal', 'reputationContract'],
        missingInputs: missingInputsForFields([legalEstimate], ['regulatoryLegal', 'reputationContract']),
        rationale: 'Legal dispute cost is relevant but unquantified until the estimate is supplied.'
      }));
    }

    [
      ['buyer-supplier-credits', 'Supplier credits', 'supplier_credit', 'supplierCredits', ['businessInterruption', 'thirdParty']],
      ['buyer-insurance-recoveries', 'Insurance recoveries', 'insurance_recovery', 'insuranceRecoveries', ['businessInterruption', 'thirdParty']],
      ['buyer-liquidated-damages-recoverable', 'Liquidated damages recoverable', 'liquidated_damages_recovery', 'liquidatedDamagesRecoverable', ['businessInterruption', 'thirdParty']],
      ['buyer-contractual-recovery-cap', 'Contractual recovery cap', 'contractual_recovery_cap', 'contractualRecoveryCap', ['businessInterruption', 'thirdParty']]
    ].forEach(([id, label, offsetType, field, appliesTo]) => {
      const fieldStatus = getFinancialFieldStatus(economics, meta, field);
      if (fieldStatus.status === 'unknown') return;
      capsAndOffsets.push(makeOffset({
        id,
        label,
        offsetType,
        field,
        amount: fieldStatus.value,
        appliesTo,
        economics,
        economicsMeta: meta,
        rationale: `${label} is treated as an offset or cap, not as an additional loss.`
      }));
    });

    return finalizeExposure({
      input,
      role: 'buyer',
      valuationMode: readField(state.projectExposure, 'valuationMode'),
      drivers,
      capsAndOffsets,
      horizonContext,
      state
    });
  }

  function buildSellerProjectExposure(input = {}) {
    const state = buildState({ ...input, assessmentType: ASSESSMENT_TYPE_PROJECT_SELLER });
    const economics = state.sellerEconomics || {};
    const meta = state.sellerEconomicsMeta || {};
    const drivers = [];
    const capsAndOffsets = [];

    const revenue = getFinancialFieldStatus(economics, meta, economics.expectedRevenue !== null ? 'expectedRevenue' : 'contractValue');
    const marginPct = getFinancialFieldStatus(economics, meta, 'grossMarginPct');
    const contributionMargin = getFinancialFieldStatus(economics, meta, 'contributionMargin');
    if (isKnownFinancialField(economics, meta, 'contributionMargin')) {
      drivers.push(makeDriver({
        id: 'seller-margin-at-risk',
        label: 'Margin at risk',
        driverType: 'margin_at_risk',
        fields: [contributionMargin],
        amount: contributionMargin.value,
        formula: 'contribution margin',
        mapsTo: ['reputationContract', 'businessInterruption'],
        rationale: 'Contribution margin is used directly when provided, avoiding total contract value as a loss proxy.'
      }));
    } else if (revenue.value !== null && isKnownFinancialField(economics, meta, 'grossMarginPct')) {
      drivers.push(makeDriver({
        id: 'seller-margin-at-risk',
        label: 'Margin at risk',
        driverType: 'margin_at_risk',
        fields: [revenue, marginPct],
        amount: revenue.value * marginPct.value,
        formula: `${revenue.field} x gross margin percentage`,
        mapsTo: ['reputationContract', 'businessInterruption'],
        rationale: 'Seller-side margin exposure uses revenue and margin, not gross contract value alone.'
      }));
    } else if (revenue.value !== null || marginPct.status !== 'not_applicable') {
      drivers.push(makeDriver({
        id: 'seller-margin-at-risk',
        label: 'Margin at risk',
        driverType: 'margin_at_risk',
        fields: [revenue, marginPct],
        mapsTo: ['reputationContract', 'businessInterruption'],
        missingInputs: missingInputsForFields([revenue, marginPct], ['reputationContract', 'businessInterruption']),
        rationale: 'Margin at risk is relevant but cannot be quantified without revenue/contract value and margin.'
      }));
    }

    const costToCure = getFinancialFieldStatus(economics, meta, 'costToCure');
    if (isKnownFinancialField(economics, meta, 'costToCure')) {
      drivers.push(makeDriver({
        id: 'seller-cost-to-cure',
        label: 'Cost to cure',
        driverType: 'cost_to_cure',
        fields: [costToCure],
        amount: costToCure.value,
        formula: 'cost to cure',
        mapsTo: ['incidentResponse', 'businessInterruption'],
        rationale: 'Cost to cure captures extra delivery effort needed to recover the project.'
      }));
    } else if (state.sellerProxyQuestions?.extraDeliveryCost && state.sellerProxyQuestions.extraDeliveryCost !== 'unknown') {
      drivers.push(makeDriver({
        id: 'seller-cost-to-cure',
        label: 'Cost to cure',
        driverType: 'cost_to_cure',
        fields: [costToCure],
        mapsTo: ['incidentResponse', 'businessInterruption'],
        missingInputs: missingInputsForFields([costToCure], ['incidentResponse', 'businessInterruption']),
        rationale: 'Extra delivery effort is likely, but remains unquantified until the cost to cure is supplied.'
      }));
    }

    const ldCap = getFinancialFieldStatus(economics, meta, 'liquidatedDamagesCap');
    if (isKnownFinancialField(economics, meta, 'liquidatedDamagesCap')) {
      drivers.push(makeDriver({
        id: 'seller-liquidated-damages',
        label: 'Liquidated damages',
        driverType: 'liquidated_damages',
        fields: [ldCap],
        amount: ldCap.value,
        formula: 'bounded by liquidated damages cap',
        mapsTo: ['regulatoryLegal', 'reputationContract'],
        rationale: 'Liquidated damages are bounded by the configured cap.'
      }));
    } else if (state.sellerProxyQuestions?.penaltiesOrCredits === 'yes') {
      drivers.push(makeDriver({
        id: 'seller-liquidated-damages',
        label: 'Liquidated damages',
        driverType: 'liquidated_damages',
        fields: [ldCap],
        mapsTo: ['regulatoryLegal', 'reputationContract'],
        missingInputs: missingInputsForFields([ldCap], ['regulatoryLegal', 'reputationContract']),
        rationale: 'Penalties may apply, but unknown caps are not treated as zero.'
      }));
    }

    const slaCap = getFinancialFieldStatus(economics, meta, 'slaCreditsCap');
    if (isKnownFinancialField(economics, meta, 'slaCreditsCap')) {
      drivers.push(makeDriver({
        id: 'seller-sla-credits',
        label: 'SLA credits',
        driverType: 'sla_credits',
        fields: [slaCap],
        amount: slaCap.value,
        formula: 'bounded by SLA credits cap',
        mapsTo: ['reputationContract'],
        rationale: 'SLA credit exposure is bounded by the configured cap.'
      }));
    } else if (state.sellerProxyQuestions?.penaltiesOrCredits === 'yes') {
      drivers.push(makeDriver({
        id: 'seller-sla-credits',
        label: 'SLA credits',
        driverType: 'sla_credits',
        fields: [slaCap],
        mapsTo: ['reputationContract'],
        missingInputs: missingInputsForFields([slaCap], ['reputationContract']),
        rationale: 'SLA credits may apply, but unknown caps are not treated as zero.'
      }));
    }

    const terminationExposure = getFinancialFieldStatus(economics, meta, 'terminationExposure');
    const liabilityCap = getFinancialFieldStatus(economics, meta, 'liabilityCap');
    if (isKnownFinancialField(economics, meta, 'terminationExposure')) {
      const boundedAmount = isKnownFinancialField(economics, meta, 'liabilityCap')
        ? Math.min(terminationExposure.value, liabilityCap.value)
        : terminationExposure.value;
      drivers.push(makeDriver({
        id: 'seller-termination-liability',
        label: 'Termination or liability exposure',
        driverType: 'termination_liability',
        fields: isKnownFinancialField(economics, meta, 'liabilityCap') ? [terminationExposure, liabilityCap] : [terminationExposure],
        amount: boundedAmount,
        formula: isKnownFinancialField(economics, meta, 'liabilityCap')
          ? 'min(termination exposure, liability cap)'
          : 'termination exposure',
        mapsTo: ['regulatoryLegal', 'reputationContract'],
        rationale: 'Termination exposure is bounded by the liability cap when that cap is available.'
      }));
    } else if (state.sellerProxyQuestions?.terminationRight === 'yes') {
      drivers.push(makeDriver({
        id: 'seller-termination-liability',
        label: 'Termination or liability exposure',
        driverType: 'termination_liability',
        fields: [terminationExposure, liabilityCap],
        mapsTo: ['regulatoryLegal', 'reputationContract'],
        missingInputs: missingInputsForFields([terminationExposure, liabilityCap], ['regulatoryLegal', 'reputationContract']),
        rationale: 'Termination may be available to the customer, but the exposure remains unquantified until the value and cap are known.'
      }));
    }

    const revenueRecognition = getFinancialFieldStatus(economics, meta, 'revenueRecognitionAtRisk');
    if (isKnownFinancialField(economics, meta, 'revenueRecognitionAtRisk')) {
      drivers.push(makeDriver({
        id: 'seller-revenue-recognition-at-risk',
        label: 'Revenue recognition at risk',
        driverType: 'delayed_revenue_recognition',
        fields: [revenueRecognition],
        amount: revenueRecognition.value,
        formula: 'revenue recognition at risk',
        mapsTo: ['businessInterruption'],
        rationale: 'Delayed revenue recognition is separated from margin loss and contract penalties.'
      }));
    }

    const renewal = getFinancialFieldStatus(economics, meta, 'renewalValueAtRisk');
    if (isKnownFinancialField(economics, meta, 'renewalValueAtRisk')) {
      drivers.push({
        ...makeDriver({
          id: 'seller-renewal-value-at-risk',
          label: 'Renewal or future pipeline exposure',
          driverType: 'future_pipeline',
          fields: [renewal],
          amount: renewal.value,
          formula: 'renewal value at risk',
          mapsTo: ['secondaryLoss'],
          rationale: 'Future pipeline impact is separated from core delivery economics and should carry low confidence unless evidenced.'
        }),
        confidence: renewal.status === 'evidence_supported' ? 'medium' : 'low'
      });
    }

    const warranty = getFinancialFieldStatus(economics, meta, 'warrantyExposure');
    if (isKnownFinancialField(economics, meta, 'warrantyExposure')) {
      drivers.push(makeDriver({
        id: 'seller-warranty-exposure',
        label: 'Warranty exposure',
        driverType: 'warranty_cost',
        fields: [warranty],
        amount: warranty.value,
        formula: 'warranty exposure',
        mapsTo: ['incidentResponse', 'reputationContract'],
        rationale: 'Warranty exposure is treated as remedial delivery cost, not as total contract loss.'
      }));
    }

    const insurance = getFinancialFieldStatus(economics, meta, 'insuranceRecoveries');
    if (insurance.status !== 'unknown') {
      capsAndOffsets.push(makeOffset({
        id: 'seller-insurance-recoveries',
        label: 'Insurance recoveries',
        offsetType: 'insurance_recovery',
        field: 'insuranceRecoveries',
        amount: insurance.value,
        appliesTo: ['regulatoryLegal', 'reputationContract', 'incidentResponse'],
        economics,
        economicsMeta: meta,
        rationale: 'Insurance recoveries are offsets, not additional losses.'
      }));
    }
    if (liabilityCap.status !== 'unknown') {
      capsAndOffsets.push(makeOffset({
        id: 'seller-liability-cap',
        label: 'Liability cap',
        offsetType: 'liability_cap',
        field: 'liabilityCap',
        amount: liabilityCap.value,
        appliesTo: ['regulatoryLegal', 'reputationContract'],
        economics,
        economicsMeta: meta,
        rationale: 'Liability cap constrains penalty and termination exposure where applicable.'
      }));
    }

    return finalizeExposure({
      input,
      role: 'seller',
      valuationMode: readField(state.projectExposure, 'valuationMode'),
      drivers,
      capsAndOffsets,
      state
    });
  }

  function buildProjectExposure(input = {}) {
    const state = buildState(input);
    if (state.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER || state.projectContext?.projectRole === 'seller') {
      return buildSellerProjectExposure(input);
    }
    if (state.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER || state.projectContext?.projectRole === 'buyer') {
      return buildBuyerProjectExposure(input);
    }
    return finalizeExposure({
      input,
      role: 'generic',
      valuationMode: readField(state.projectExposure, 'valuationMode'),
      drivers: [],
      capsAndOffsets: [],
      state
    });
  }

  function buildProjectDoubleCountingWarnings(input = {}) {
    const state = buildState(input);
    const role = state.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER || state.projectContext?.projectRole === 'seller' ? 'seller'
      : state.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER || state.projectContext?.projectRole === 'buyer' ? 'buyer'
        : 'generic';
    const warnings = [];
    const add = (id, message, severity = 'medium') => {
      if (!warnings.some(item => item.id === id)) warnings.push({ id, severity, message });
    };

    if (role === 'buyer') {
      add('buyer-total-spend-reprocurement', 'Do not count total project spend and reprocurement premium together unless spend is stranded and separately evidenced.');
      add('buyer-recoveries-unknown-not-zero', 'Do not treat unknown supplier credits, insurance, or contractual recoveries as zero recovery; keep them as uncertainty.');
      if (state.buyerEconomics?.contractualRecoveryCap !== null || state.buyerEconomics?.liquidatedDamagesRecoverable !== null) {
        add('buyer-recovery-cap', 'Do not count recoveries or penalties beyond contractual recovery caps.');
      }
    }

    if (role === 'seller') {
      add('seller-revenue-margin', 'Do not count gross revenue and margin loss together; margin or contribution logic should drive core seller loss.');
      add('seller-contract-value-not-loss', 'Do not treat total contract value as economic loss without margin, cost-to-cure, termination, or liability logic.');
      add('seller-caps-bound-penalties', 'Do not count liquidated damages, SLA credits, or liability exposure beyond known caps.');
      add('seller-pipeline-separate', 'Treat renewal and future pipeline impact separately and with low confidence unless evidence supports it.');
      add('seller-recoveries-unknown-not-zero', 'Do not treat unknown insurance or recoveries as zero recovery; flag the uncertainty.');
    }

    return warnings;
  }

  function buildProjectInputQuality(input = {}) {
    const state = buildState(input);
    const role = state.assessmentType === ASSESSMENT_TYPE_PROJECT_SELLER || state.projectContext?.projectRole === 'seller' ? 'seller'
      : state.assessmentType === ASSESSMENT_TYPE_PROJECT_BUYER || state.projectContext?.projectRole === 'buyer' ? 'buyer'
        : 'generic';
    const economics = role === 'seller' ? state.sellerEconomics : state.buyerEconomics;
    const meta = role === 'seller' ? state.sellerEconomicsMeta : state.buyerEconomicsMeta;
    const fields = role === 'seller' ? SELLER_HIGH_IMPACT_FIELDS : role === 'buyer' ? BUYER_HIGH_IMPACT_FIELDS : [];
    const horizonContext = role === 'buyer' ? calculateProjectHorizonContext({ ...input, projectContext: state.projectContext, buyerProxyQuestions: state.buyerProxyQuestions }) : null;
    const statuses = fields.map(field => {
      if (field === 'delayDurationDays' && horizonContext) return buildDelayField(horizonContext);
      return getFinancialFieldStatus(economics, meta, field);
    });
    const knownHighImpactInputs = statuses
      .filter(field => field.value !== null && KNOWN_STATUSES.has(field.status))
      .map(projectQualityField);
    const estimatedHighImpactInputs = statuses
      .filter(field => field.value !== null && ['estimated', 'benchmark_proxy'].includes(field.status))
      .map(projectQualityField);
    const unknownHighImpactInputs = statuses
      .filter(field => field.status === 'unknown' || field.value === null)
      .map(field => makeMissingInput(field.field, { mapsTo: defaultMapsForField(field.field, role) }));
    const weighted = statuses.reduce((sum, field) => {
      if (field.value === null || field.status === 'unknown') return sum;
      if (KNOWN_STATUSES.has(field.status)) return sum + 1;
      if (field.status === 'estimated') return sum + 0.75;
      if (field.status === 'benchmark_proxy') return sum + 0.55;
      return sum + 0.4;
    }, 0);
    const score = fields.length ? Math.round((weighted / fields.length) * 100) : 0;
    const label = score >= 80 ? 'Strong project economics'
      : score >= 55 ? 'Usable project economics'
        : score >= 25 ? 'Partial project economics'
          : 'Thin project economics';
    const recommendedNextInput = unknownHighImpactInputs[0]
      ? {
          field: unknownHighImpactInputs[0].field,
          why: unknownHighImpactInputs[0].whyItMatters,
          whoMightKnow: unknownHighImpactInputs[0].whoMightKnow,
          suggestedQuestion: unknownHighImpactInputs[0].suggestedQuestion
        }
      : null;

    return {
      score,
      label,
      knownHighImpactInputs,
      estimatedHighImpactInputs,
      unknownHighImpactInputs,
      canProceed: true,
      recommendedNextInput
    };
  }

  function projectQualityField(field) {
    return {
      field: field.field,
      label: field.label,
      status: field.status,
      confidence: field.confidence,
      source: field.source
    };
  }

  function defaultMapsForField(field, role) {
    const map = {
      delayDurationDays: ['businessInterruption'],
      delayCostPerDay: ['businessInterruption'],
      expectedBenefitPerDay: ['businessInterruption', 'secondaryLoss'],
      remainingSpend: ['thirdParty'],
      reprocurementPremiumPct: ['thirdParty', 'reputationContract'],
      amountPaid: ['thirdParty'],
      amountCommitted: ['thirdParty'],
      contractualRecoveryCap: ['thirdParty', 'regulatoryLegal'],
      supplierCredits: ['thirdParty'],
      insuranceRecoveries: role === 'seller' ? ['incidentResponse', 'regulatoryLegal'] : ['thirdParty'],
      liquidatedDamagesRecoverable: ['thirdParty', 'reputationContract'],
      expectedRevenue: ['reputationContract', 'businessInterruption'],
      contractValue: ['reputationContract', 'businessInterruption'],
      grossMarginPct: ['reputationContract', 'businessInterruption'],
      contributionMargin: ['reputationContract', 'businessInterruption'],
      costToCure: ['incidentResponse', 'businessInterruption'],
      liquidatedDamagesCap: ['regulatoryLegal', 'reputationContract'],
      slaCreditsCap: ['reputationContract'],
      liabilityCap: ['regulatoryLegal', 'reputationContract'],
      terminationExposure: ['regulatoryLegal', 'reputationContract'],
      revenueRecognitionAtRisk: ['businessInterruption'],
      renewalValueAtRisk: ['secondaryLoss']
    };
    return map[field] || [];
  }

  function mapProjectExposureToRiskParameters(projectExposure = {}) {
    const source = isPlainObject(projectExposure) ? projectExposure : {};
    const drivers = Array.isArray(readField(source, 'financialDrivers')) ? readField(source, 'financialDrivers') : [];
    return drivers.reduce((output, driver) => {
      if (!isPlainObject(driver)) return output;
      if (driver.driverStatus === DRIVER_STATUSES.unquantified || driver.driverStatus === DRIVER_STATUSES.notApplicable) return output;
      const mapsTo = Array.isArray(driver.mapsTo) ? driver.mapsTo : [driver.mapsTo].filter(Boolean);
      const low = normaliseFiniteNumber(driver.low);
      const likely = normaliseFiniteNumber(driver.likely);
      const high = normaliseFiniteNumber(driver.high);
      if (low === null || likely === null || high === null) return output;
      mapsTo.forEach(bucket => {
        if (!RISK_BUCKETS.includes(bucket)) return;
        if (!output[bucket]) output[bucket] = { low: 0, likely: 0, high: 0, driverIds: [] };
        output[bucket].low = roundMoney(output[bucket].low + low);
        output[bucket].likely = roundMoney(output[bucket].likely + likely);
        output[bucket].high = roundMoney(output[bucket].high + high);
        output[bucket].driverIds.push(driver.id);
      });
      return output;
    }, {});
  }

  function collectMissingInputs(drivers = [], quality = null, horizonContext = null) {
    const output = [];
    const add = item => {
      if (!isPlainObject(item) || !item.field) return;
      const key = `${item.field}:${Array.isArray(item.mapsTo) ? item.mapsTo.join('|') : ''}`;
      if (!output.some(existing => `${existing.field}:${Array.isArray(existing.mapsTo) ? existing.mapsTo.join('|') : ''}` === key)) {
        output.push(item);
      }
    };
    drivers.forEach(driver => {
      (Array.isArray(driver?.missingInputs) ? driver.missingInputs : []).forEach(add);
    });
    (Array.isArray(quality?.unknownHighImpactInputs) ? quality.unknownHighImpactInputs : []).forEach(add);
    (Array.isArray(horizonContext?.missingInputs) ? horizonContext.missingInputs : []).forEach(add);
    return output.slice(0, 30);
  }

  function projectSummary(role, drivers = [], quality = null) {
    const quantifiedCount = drivers.filter(driver => driver.low !== null && driver.likely !== null && driver.high !== null).length;
    const unquantifiedCount = drivers.filter(driver => driver.driverStatus === DRIVER_STATUSES.unquantified).length;
    if (role === 'buyer') {
      return `Buyer project exposure mapped ${quantifiedCount} quantified driver${quantifiedCount === 1 ? '' : 's'} and ${unquantifiedCount} unquantified driver${unquantifiedCount === 1 ? '' : 's'}; ${quality?.label || 'project economics quality unknown'}.`;
    }
    if (role === 'seller') {
      return `Seller project exposure mapped ${quantifiedCount} quantified driver${quantifiedCount === 1 ? '' : 's'} and ${unquantifiedCount} unquantified driver${unquantifiedCount === 1 ? '' : 's'}; ${quality?.label || 'project economics quality unknown'}.`;
    }
    return 'No project-specific exposure drivers were built because this is not a buyer or seller project assessment.';
  }

  function finalizeExposure({ input, role, valuationMode, drivers, capsAndOffsets, horizonContext = null, state }) {
    const projectInputQuality = buildProjectInputQuality({ ...input, assessmentType: state?.assessmentType });
    const doubleCountingWarnings = buildProjectDoubleCountingWarnings({ ...input, assessmentType: state?.assessmentType });
    const missingInputs = collectMissingInputs(drivers, projectInputQuality, horizonContext);
    const base = {
      valuationMode: normaliseValuationMode(valuationMode || readField(readField(input, 'projectExposure'), 'valuationMode')),
      projectExposureSummary: projectSummary(role, drivers, projectInputQuality),
      projectInputQuality,
      financialDrivers: drivers,
      capsAndOffsets,
      doubleCountingWarnings,
      missingInputs,
      mapsToRiskParameters: {}
    };
    base.mapsToRiskParameters = mapProjectExposureToRiskParameters(base);
    return base;
  }

  const exported = {
    DRIVER_STATUSES,
    RISK_BUCKETS,
    buildProjectExposure,
    buildBuyerProjectExposure,
    buildSellerProjectExposure,
    mapProjectExposureToRiskParameters,
    buildProjectDoubleCountingWarnings,
    calculateProjectHorizonContext,
    buildProjectInputQuality,
    getFinancialFieldStatus,
    isKnownFinancialField,
    isUnknownFinancialField
  };

  Object.assign(globalScope, {
    ProjectExposureService: exported,
    buildProjectExposure,
    buildBuyerProjectExposure,
    buildSellerProjectExposure,
    mapProjectExposureToRiskParameters,
    buildProjectDoubleCountingWarnings,
    calculateProjectHorizonContext,
    buildProjectInputQuality,
    getFinancialFieldStatus,
    isKnownFinancialField,
    isUnknownFinancialField
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
