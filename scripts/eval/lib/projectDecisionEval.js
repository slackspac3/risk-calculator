'use strict';

const AssessmentTypeModel = require('../../../assets/state/assessmentTypeModel.js');
const ProjectExposureService = require('../../../assets/services/projectExposureService.js');
const RiskEngine = require('../../../assets/engine/riskEngine.js');
const {
  buildDeterministicAssumptionRegister
} = require('../../../api/_assumptionRegisterWorkflow.js');
const {
  buildDeterministicDecisionBrief
} = require('../../../api/_decisionBriefWorkflow.js');
const {
  BOOLEAN_PATCH_KEYS,
  NUMERIC_PATCH_KEYS,
  STRING_PATCH_KEYS,
  buildDeterministicDecisionChallenge
} = require('../../../api/_decisionChallengeWorkflow.js');
const {
  buildDeterministicEvidenceMap
} = require('../../../api/_evidenceMapWorkflow.js');
const {
  buildDeterministicParameterCoach
} = require('../../../api/_parameterCoachWorkflow.js');

const PROJECT_DECISION_EVAL_FIXTURES = Object.freeze([
  {
    id: 'project-eval-a-generic-enterprise',
    title: 'Generic enterprise cyber/operational risk',
    input: {
      assessmentType: 'enterprise_generic',
      scenarioLens: 'cyber',
      riskStatement: 'Privileged access misuse could disrupt production operations and trigger incident response work.',
      eventPathSummary: 'privileged access misuse disrupts production operations',
      projectContext: {},
      citations: [{
        title: 'Access control review',
        excerpt: 'Privileged access reviews found stale production administrator access and weak recertification evidence.'
      }]
    },
    expected: {
      assessmentType: 'enterprise_generic',
      projectRole: 'none',
      eventAnchors: ['privileged access', 'production'],
      genericNoProjectEconomics: true,
      benchmarkLedAcceptable: true,
      unsupportedEvidenceNotStrong: false,
      allowedDecisionPostures: ['proceed', 'proceed_with_controls', 'needs_more_evidence', 'escalate']
    }
  },
  {
    id: 'project-eval-b-buyer-supplier-delay-sparse',
    title: 'Buyer supplier delay project with sparse economics',
    input: {
      assessmentType: 'project_buyer',
      scenarioLens: 'supply-chain',
      riskStatement: 'ERP implementation supplier delay may miss go-live and delay expected operational benefits.',
      eventPathSummary: 'supplier delay threatens ERP go-live',
      projectContext: {
        projectName: 'ERP implementation',
        projectRole: 'buyer',
        projectStage: 'implementation',
        projectDurationMonths: 7,
        strategicImportance: 'high'
      },
      buyerEconomics: {
        approvedBudget: 2400000,
        remainingSpend: 1100000,
        delayCostPerDay: null,
        reprocurementPremiumPct: null,
        supplierCredits: null,
        insuranceRecoveries: null,
        liquidatedDamagesRecoverable: null
      },
      buyerEconomicsMeta: {
        approvedBudget: { status: 'known', confidence: 'high', source: 'user' },
        remainingSpend: { status: 'estimated', confidence: 'medium', source: 'user' },
        delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        reprocurementPremiumPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        supplierCredits: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
      },
      buyerProxyAnswers: {
        mainImpact: 'delay',
        likelyDelay: 'weeks',
        supplierReplacement: 'hard',
        contractualRecoveries: 'unknown',
        criticalPath: 'yes'
      }
    },
    expected: {
      assessmentType: 'project_buyer',
      projectRole: 'buyer',
      eventAnchors: ['supplier delay', 'go-live'],
      unknownFields: ['delayCostPerDay'],
      likelyDriverTerms: ['delay', 'reprocurement', 'recover'],
      mappedBuckets: ['businessInterruption', 'thirdParty'],
      buyerSpendNotAutomaticLoss: true,
      doubleCountingWarningPresent: true,
      evidenceGapDetected: true,
      parameterLinksExpected: true,
      allowedDecisionPostures: ['proceed_with_controls', 'needs_more_evidence', 'escalate', 'defer']
    }
  },
  {
    id: 'project-eval-c-seller-fixed-price-sparse',
    title: 'Seller fixed-price delivery risk with sparse economics',
    input: {
      assessmentType: 'project_seller',
      scenarioLens: 'legal-contract',
      riskStatement: 'Fixed-price customer delivery risk may create cost-to-cure work, LD or SLA credits, and margin erosion.',
      eventPathSummary: 'fixed-price delivery issue may trigger LD/SLA and cost-to-cure',
      projectContext: {
        projectName: 'Customer cloud migration',
        projectRole: 'seller',
        projectStage: 'delivery',
        contractType: 'fixed_price',
        projectDurationMonths: 9,
        strategicImportance: 'high'
      },
      sellerEconomics: {
        contractValue: 3000000,
        expectedRevenue: null,
        grossMarginPct: null,
        liquidatedDamagesCap: null,
        slaCreditsCap: null,
        costToCure: null
      },
      sellerEconomicsMeta: {
        contractValue: { status: 'known', confidence: 'high', source: 'user' },
        grossMarginPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        liquidatedDamagesCap: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        slaCreditsCap: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        costToCure: { status: 'unknown', confidence: 'low', source: 'not_provided', note: 'Proxy answer says high effort but no amount is known.' }
      },
      sellerProxyAnswers: {
        mainImpact: 'margin_erosion',
        expectedMargin: 'unknown',
        customerClaimPenalties: 'yes',
        customerTerminate: 'unknown',
        extraDeliveryCost: 'high',
        contractType: 'fixed_price'
      }
    },
    expected: {
      assessmentType: 'project_seller',
      projectRole: 'seller',
      eventAnchors: ['fixed-price', 'delivery'],
      unknownFields: ['grossMarginPct', 'liquidatedDamagesCap'],
      likelyDriverTerms: ['margin', 'LD', 'SLA', 'cost to cure'],
      sellerRevenueMarginNotDoubleCounted: true,
      blankLdCapNotNoExposure: true,
      unknownMarginNoFalsePrecision: true,
      doubleCountingWarningPresent: true,
      parameterLinksExpected: true,
      allowedDecisionPostures: ['proceed_with_controls', 'needs_more_evidence', 'escalate', 'defer']
    }
  },
  {
    id: 'project-eval-d-recovery-contradiction',
    title: 'Recovery contradiction',
    input: {
      assessmentType: 'enterprise_generic',
      scenarioLens: 'business-continuity',
      riskStatement: 'Payment processing outage could disrupt customer transactions during a recovery event.',
      eventPathSummary: 'payment processing outage with recovery duration uncertainty',
      assumptions: ['Recovery will complete within 2 days based on current continuity planning.'],
      citations: [{
        title: 'Business continuity standard',
        excerpt: 'The current recovery time objective for the payment processing platform is 5 days and has not been retested this quarter.'
      }]
    },
    expected: {
      assessmentType: 'enterprise_generic',
      projectRole: 'none',
      eventAnchors: ['payment processing', 'recovery'],
      contradictionExpected: true,
      assumptionWeakExpected: true,
      stressCaseExpected: true,
      unsupportedEvidenceNotStrong: true,
      allowedDecisionPostures: ['proceed_with_controls', 'needs_more_evidence', 'escalate', 'defer']
    }
  },
  {
    id: 'project-eval-e-near-tolerance-project',
    title: 'Near tolerance project risk',
    input: {
      assessmentType: 'project_buyer',
      scenarioLens: 'transformation-delivery',
      riskStatement: 'Core data migration instability may delay a high-value transformation go-live near tolerance.',
      eventPathSummary: 'data migration instability delays project go-live',
      forceNearTolerance: true,
      projectContext: {
        projectName: 'Core data migration',
        projectRole: 'buyer',
        projectStage: 'cutover',
        projectDurationMonths: 6,
        strategicImportance: 'high'
      },
      buyerEconomics: {
        approvedBudget: 1800000,
        remainingSpend: 700000,
        delayCostPerDay: 12000,
        expectedBenefitPerDay: null
      },
      buyerEconomicsMeta: {
        approvedBudget: { status: 'known', confidence: 'high', source: 'user' },
        remainingSpend: { status: 'estimated', confidence: 'medium', source: 'user' },
        delayCostPerDay: { status: 'estimated', confidence: 'medium', source: 'user' },
        expectedBenefitPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
      },
      simulationParams: {
        projectDurationMonths: 6,
        projectDurationSourceStatus: 'benchmark_proxy',
        projectDurationConfidence: 'low',
        projectValue: 1800000,
        projectValueSourceStatus: 'known'
      }
    },
    expected: {
      assessmentType: 'project_buyer',
      projectRole: 'buyer',
      eventAnchors: ['data migration', 'go-live'],
      unknownFields: ['expectedBenefitPerDay'],
      nearToleranceChallengeExpected: true,
      projectHorizonExpected: true,
      proxyValuesLabelled: true,
      confidenceNotHigh: true,
      allowedDecisionPostures: ['proceed_with_controls', 'needs_more_evidence', 'escalate', 'defer']
    }
  },
  {
    id: 'project-eval-f-thin-project-economics',
    title: 'Thin project economics',
    input: {
      assessmentType: 'project_seller',
      scenarioLens: 'operational',
      riskStatement: 'Managed service transition quality issue could require additional delivery work and customer escalation.',
      eventPathSummary: 'managed service transition issue with thin economics',
      projectContext: {
        projectName: 'Managed service transition',
        projectRole: 'seller',
        projectStage: 'transition',
        contractType: 'recurring_service'
      },
      sellerEconomics: {
        contractValue: null,
        expectedRevenue: null,
        grossMarginPct: null,
        costToCure: null,
        liquidatedDamagesCap: null
      },
      sellerEconomicsMeta: {
        contractValue: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        expectedRevenue: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        grossMarginPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
        costToCure: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
      },
      sellerProxyAnswers: {
        mainImpact: 'delivery_cost_overrun',
        extraDeliveryCost: 'unknown',
        customerClaimPenalties: 'unknown'
      }
    },
    expected: {
      assessmentType: 'project_seller',
      projectRole: 'seller',
      eventAnchors: ['managed service', 'transition'],
      unknownFields: ['contractValue', 'grossMarginPct', 'costToCure'],
      missingInputsExpected: true,
      confidenceNotHigh: true,
      nextActionFinancialInputExpected: true,
      allowedDecisionPostures: ['needs_more_evidence', 'proceed_with_controls', 'escalate', 'defer']
    }
  },
  {
    id: 'project-eval-g-explicit-zero-recovery',
    title: 'Explicit zero supplier recovery',
    input: {
      assessmentType: 'project_buyer',
      scenarioLens: 'third-party',
      riskStatement: 'Implementation partner failure may require replacement, and supplier recovery has been confirmed as zero.',
      eventPathSummary: 'partner failure with confirmed zero supplier recovery',
      projectContext: {
        projectName: 'Warehouse automation',
        projectRole: 'buyer',
        projectStage: 'implementation',
        projectDurationMonths: 5
      },
      buyerEconomics: {
        approvedBudget: 900000,
        remainingSpend: 500000,
        reprocurementPremiumPct: 0.15,
        supplierCredits: 0,
        delayCostPerDay: null
      },
      buyerEconomicsMeta: {
        approvedBudget: { status: 'known', confidence: 'high', source: 'user' },
        remainingSpend: { status: 'known', confidence: 'medium', source: 'user' },
        reprocurementPremiumPct: { status: 'estimated', confidence: 'medium', source: 'user' },
        supplierCredits: { status: 'known', confidence: 'high', source: 'user' },
        delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
      },
      buyerProxyAnswers: {
        mainImpact: 'supplier replacement',
        supplierReplacement: 'hard',
        contractualRecoveries: 'no'
      }
    },
    expected: {
      assessmentType: 'project_buyer',
      projectRole: 'buyer',
      eventAnchors: ['partner failure', 'supplier recovery'],
      unknownFields: ['delayCostPerDay'],
      explicitZeroFields: [{ objectName: 'buyerEconomics', metaName: 'buyerEconomicsMeta', field: 'supplierCredits' }],
      explicitZeroPreserved: true,
      buyerSpendNotAutomaticLoss: true,
      allowedDecisionPostures: ['proceed_with_controls', 'needs_more_evidence', 'escalate', 'defer']
    }
  }
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function lower(value = '') {
  return String(value || '').trim().toLowerCase();
}

function compact(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function textFrom(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(textFrom).join(' ');
  if (typeof value === 'object') return Object.values(value).map(textFrom).join(' ');
  return '';
}

function hasTerm(haystack, term) {
  return lower(haystack).includes(lower(term));
}

function hasAnyTerm(haystack, terms = []) {
  return (Array.isArray(terms) ? terms : [terms]).some(term => hasTerm(haystack, term));
}

function valuesList(value) {
  return Array.isArray(value) ? value : [];
}

function fieldNamesFromMissingInputs(projectExposure = {}) {
  const quality = projectExposure.projectInputQuality || {};
  return Array.from(new Set([
    ...valuesList(projectExposure.missingInputs).map(item => item?.field || item?.label || item),
    ...valuesList(quality.unknownHighImpactInputs).map(item => item?.field || item?.label || item)
  ].map(lower).filter(Boolean)));
}

function financialDrivers(projectExposure = {}) {
  return valuesList(projectExposure.financialDrivers).filter(item => item && typeof item === 'object');
}

function doubleCountingWarningText(projectExposure = {}) {
  return valuesList(projectExposure.doubleCountingWarnings)
    .map(item => item?.message || item?.label || item?.id || item)
    .join(' ');
}

function driverText(projectExposure = {}) {
  return [
    projectExposure.projectExposureSummary,
    textFrom(projectExposure.financialDrivers),
    textFrom(projectExposure.capsAndOffsets),
    textFrom(projectExposure.doubleCountingWarnings),
    textFrom(projectExposure.missingInputs)
  ].join(' ');
}

function defaultSimulationParams(overrides = {}) {
  return {
    iterations: 1000,
    seed: 42042,
    distType: 'triangular',
    tefMin: 0.4,
    tefLikely: 1,
    tefMax: 1.8,
    vulnDirect: true,
    vulnMin: 0.2,
    vulnLikely: 0.45,
    vulnMax: 0.7,
    irMin: 10000,
    irLikely: 30000,
    irMax: 60000,
    biMin: 50000,
    biLikely: 140000,
    biMax: 300000,
    dbMin: 0,
    dbLikely: 10000,
    dbMax: 30000,
    rlMin: 0,
    rlLikely: 20000,
    rlMax: 80000,
    tpMin: 0,
    tpLikely: 50000,
    tpMax: 150000,
    rcMin: 0,
    rcLikely: 20000,
    rcMax: 70000,
    secondaryEnabled: false,
    threshold: 450000,
    annualReviewThreshold: 900000,
    ...overrides
  };
}

function runSimulationForFixture(fixture, assessmentType) {
  const input = fixture.input || {};
  const params = defaultSimulationParams({
    assessmentType,
    ...(input.simulationParams || {})
  });
  const result = RiskEngine.run(params);
  const threshold = input.forceNearTolerance
    ? Math.max(1, Number(result.eventLoss?.p90 || result.lm?.p90 || params.threshold) / 0.95)
    : params.threshold;
  return {
    ...result,
    threshold,
    annualReviewThreshold: params.annualReviewThreshold,
    nearTolerance: input.forceNearTolerance === true
  };
}

function buildProjectDecisionEvalCase(fixture = {}) {
  const input = clone(fixture.input || {});
  const assessmentType = AssessmentTypeModel.normaliseAssessmentType(input.assessmentType);
  const assessmentState = AssessmentTypeModel.normaliseAssessmentTypeState({
    assessmentType,
    projectContext: input.projectContext || {},
    buyerEconomics: input.buyerEconomics || {},
    buyerEconomicsMeta: input.buyerEconomicsMeta || {},
    buyerProxyAnswers: input.buyerProxyAnswers || {},
    sellerEconomics: input.sellerEconomics || {},
    sellerEconomicsMeta: input.sellerEconomicsMeta || {},
    sellerProxyAnswers: input.sellerProxyAnswers || {},
    projectExposure: input.projectExposure || {}
  });
  const exposureInput = {
    ...input,
    ...assessmentState,
    riskStatement: input.riskStatement
  };
  const projectExposure = ProjectExposureService.buildProjectExposure(exposureInput);
  const simulationResult = runSimulationForFixture(fixture, assessmentType);
  const parameters = defaultSimulationParams({
    assessmentType,
    ...(input.simulationParams || {})
  });
  const evidenceMap = buildDeterministicEvidenceMap({
    assessmentType,
    scenario: input.riskStatement,
    riskStatement: input.riskStatement,
    structuredScenario: {
      eventPath: input.eventPathSummary || input.riskStatement,
      summary: input.riskStatement
    },
    projectContext: assessmentState.projectContext,
    projectExposure,
    assumptions: input.assumptions || [],
    parameters,
    citations: input.citations || [],
    ragMatches: input.ragMatches || []
  });
  const assumptionRegister = buildDeterministicAssumptionRegister({
    assessmentType,
    scenario: input.riskStatement,
    structuredScenario: {
      eventPath: input.eventPathSummary || input.riskStatement,
      summary: input.riskStatement
    },
    projectContext: assessmentState.projectContext,
    buyerEconomics: assessmentState.buyerEconomics,
    buyerEconomicsMeta: assessmentState.buyerEconomicsMeta,
    sellerEconomics: assessmentState.sellerEconomics,
    sellerEconomicsMeta: assessmentState.sellerEconomicsMeta,
    projectExposure,
    evidenceMap,
    parameters,
    results: simulationResult,
    citations: input.citations || []
  });
  const parameterCoach = buildDeterministicParameterCoach({
    assessmentType,
    scenario: input.riskStatement,
    projectContext: assessmentState.projectContext,
    projectExposure,
    parameters,
    validation: RiskEngine.validateRunParams(parameters),
    assumptionRegister,
    evidenceMap,
    citations: input.citations || [],
    results: simulationResult
  });
  const decisionChallenge = buildDeterministicDecisionChallenge({
    assessmentType,
    scenario: input.riskStatement,
    structuredScenario: {
      eventPath: input.eventPathSummary || input.riskStatement,
      summary: input.riskStatement
    },
    scenarioLens: input.scenarioLens || '',
    projectContext: assessmentState.projectContext,
    projectExposure,
    parameters,
    simulationResult,
    assumptionRegister,
    parameterCoach,
    evidenceMap
  });
  const decisionBrief = buildDeterministicDecisionBrief({
    assessmentType,
    scenario: input.riskStatement,
    structuredScenario: {
      eventPath: input.eventPathSummary || input.riskStatement,
      summary: input.riskStatement
    },
    scenarioLens: input.scenarioLens || '',
    projectContext: assessmentState.projectContext,
    projectExposure,
    simulationResult,
    parameters,
    assumptionRegister,
    parameterCoach,
    evidenceMap,
    decisionChallenge
  });

  return {
    id: fixture.id,
    title: fixture.title,
    expected: clone(fixture.expected || {}),
    input: compact({
      assessmentType,
      riskStatement: input.riskStatement,
      eventPathSummary: input.eventPathSummary,
      scenarioLens: input.scenarioLens
    }),
    assessmentState,
    projectExposure,
    evidenceMap,
    assumptionRegister,
    parameterCoach,
    decisionChallenge,
    decisionBrief,
    simulationResult
  };
}

function validStressPatch(patch = {}) {
  if (!patch || typeof patch !== 'object') return false;
  const validKeys = new Set([
    ...Array.from(NUMERIC_PATCH_KEYS || []),
    ...Array.from(BOOLEAN_PATCH_KEYS || []),
    ...Array.from(STRING_PATCH_KEYS || [])
  ]);
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every(key => validKeys.has(key));
}

function scoreUnknownField(output, field) {
  const fieldKey = lower(field);
  const missingFields = fieldNamesFromMissingInputs(output.projectExposure);
  const representedAsMissing = missingFields.includes(fieldKey)
    || hasTerm(textFrom(output.assumptionRegister), field)
    || hasTerm(textFrom(output.parameterCoach), field)
    || hasTerm(textFrom(output.decisionChallenge), field);
  const zeroDriver = financialDrivers(output.projectExposure).some(driver => {
    const text = lower(`${driver.id || ''} ${driver.label || ''} ${textFrom(driver.missingInputs)}`);
    if (!text.includes(fieldKey)) return false;
    return driver.low != null
      && driver.likely != null
      && driver.high != null
      && Number(driver.low) === 0
      && Number(driver.likely) === 0
      && Number(driver.high) === 0;
  });
  return representedAsMissing && !zeroDriver;
}

function scoreExplicitZero(output, expectedField = {}) {
  const objectName = expectedField.objectName || 'buyerEconomics';
  const metaName = expectedField.metaName || `${objectName}Meta`;
  const field = expectedField.field;
  const economics = output.assessmentState?.[objectName] || {};
  const meta = output.assessmentState?.[metaName] || {};
  const offset = valuesList(output.projectExposure?.capsAndOffsets).find(item => item?.field === field);
  const status = lower(meta?.[field]?.status || meta?.[field]?.sourceStatus || offset?.source || '');
  return economics[field] === 0
    && ['known', 'estimated', 'evidence_supported'].includes(status)
    && (!offset || Number(offset.amount ?? offset.likely ?? 0) === 0);
}

function scoreProjectDecisionEvalCase(output = {}) {
  const expected = output.expected || {};
  const assessmentType = output.assessmentState?.assessmentType || output.input?.assessmentType || '';
  const projectRole = output.assessmentState?.projectContext?.projectRole || 'none';
  const allText = [
    output.input?.riskStatement,
    output.input?.eventPathSummary,
    output.projectExposure?.projectExposureSummary,
    textFrom(output.projectExposure),
    textFrom(output.evidenceMap),
    textFrom(output.assumptionRegister),
    textFrom(output.parameterCoach),
    textFrom(output.decisionChallenge),
    textFrom(output.decisionBrief)
  ].join(' ');
  const warningText = doubleCountingWarningText(output.projectExposure);
  const dimensions = {};

  dimensions.assessmentTypeSelectedCorrectly = assessmentType === expected.assessmentType;
  dimensions.eventPathPreserved = valuesList(expected.eventAnchors).every(term => hasTerm(allText, term));
  dimensions.projectRolePreserved = expected.projectRole === 'none'
    ? projectRole === 'none' || assessmentType === 'enterprise_generic'
    : projectRole === expected.projectRole;
  dimensions.blankValuesNotTreatedAsZero = valuesList(expected.unknownFields).every(field => scoreUnknownField(output, field));
  dimensions.explicitZeroPreserved = valuesList(expected.explicitZeroFields).length
    ? valuesList(expected.explicitZeroFields).every(field => scoreExplicitZero(output, field))
    : true;
  dimensions.projectBuyerTotalSpendNotAutomaticLoss = expected.buyerSpendNotAutomaticLoss
    ? !financialDrivers(output.projectExposure).some(driver => /total project spend|approved budget|expected spend/i.test(`${driver.id || ''} ${driver.label || ''}`) && Number(driver.likely) > 0)
      && /total project spend|reprocurement premium/i.test(warningText)
    : true;
  dimensions.sellerRevenueAndMarginNotDoubleCounted = expected.sellerRevenueMarginNotDoubleCounted
    ? /gross revenue and margin|total contract value/i.test(warningText)
    : true;
  dimensions.doubleCountingWarningPresent = expected.doubleCountingWarningPresent
    ? valuesList(output.projectExposure?.doubleCountingWarnings).length > 0
    : true;
  dimensions.evidenceGapDetected = expected.evidenceGapDetected || expected.missingInputsExpected
    ? valuesList(output.projectExposure?.missingInputs).length > 0
      || valuesList(output.evidenceMap?.unsupportedClaims).length > 0
      || valuesList(output.assumptionRegister?.missingEvidence).length > 0
    : true;
  dimensions.contradictionDetected = expected.contradictionExpected
    ? valuesList(output.evidenceMap?.contradictions).length > 0
    : true;
  dimensions.assumptionRegisterMarksWeakOrReview = expected.assumptionWeakExpected
    ? valuesList(output.assumptionRegister?.assumptions).some(item => ['weak', 'needs_review'].includes(item?.status))
    : true;
  dimensions.parameterLinksPresent = expected.parameterLinksExpected
    ? valuesList(output.evidenceMap?.parameterEvidenceMap).length > 0
      || valuesList(output.parameterCoach?.parameterRationales).some(item => valuesList(item?.projectExposureRefs).length > 0 || item?.parameterKey)
    : true;
  dimensions.decisionPosturePlausible = valuesList(expected.allowedDecisionPostures).length
    ? valuesList(expected.allowedDecisionPostures).includes(output.decisionBrief?.decisionPosture)
    : true;
  dimensions.stressCasePatchValid = expected.stressCaseExpected || expected.nearToleranceChallengeExpected
    ? valuesList(output.decisionChallenge?.recommendedStressTests).some(item => validStressPatch(item?.parameterPatch))
    : true;
  dimensions.proxyValuesLabelled = expected.proxyValuesLabelled
    ? /proxy/i.test(textFrom(output.simulationResult?.projectHorizon))
      || valuesList(output.decisionBrief?.projectQuantSummary?.proxyValuesUsed).length > 0
      || financialDrivers(output.projectExposure).some(driver => /benchmark_proxy/i.test(`${driver.driverStatus || ''} ${driver.source || ''}`))
    : true;
  dimensions.projectHorizonMetricsConsidered = expected.projectHorizonExpected
    ? output.simulationResult?.projectHorizon?.enabled === true
    : true;
  dimensions.nearToleranceChallengePresent = expected.nearToleranceChallengeExpected
    ? hasTerm(textFrom(output.decisionChallenge), 'tolerance')
    : true;
  dimensions.decisionBriefConfidenceNotHigh = expected.confidenceNotHigh
    ? output.decisionBrief?.confidence !== 'high'
    : true;
  dimensions.nextActionAsksForFinancialInputs = expected.nextActionFinancialInputExpected
    ? /margin|contract|revenue|cost|finance|financial/i.test(`${textFrom(output.decisionBrief?.nextAction)} ${textFrom(output.assumptionRegister?.nextBestQuestions)}`)
    : true;
  dimensions.buyerDriversPresent = expected.likelyDriverTerms && expected.assessmentType === 'project_buyer'
    ? valuesList(expected.likelyDriverTerms).every(term => hasTerm(driverText(output.projectExposure), term))
    : true;
  dimensions.sellerDriversPresent = expected.likelyDriverTerms && expected.assessmentType === 'project_seller'
    ? valuesList(expected.likelyDriverTerms).every(term => hasTerm(driverText(output.projectExposure), term))
    : true;
  dimensions.mappedRiskBucketsPresent = valuesList(expected.mappedBuckets).length
    ? valuesList(expected.mappedBuckets).every(bucket => hasTerm(textFrom(output.projectExposure?.financialDrivers), bucket))
    : true;
  dimensions.blankLdCapDoesNotMeanNoLdExposure = expected.blankLdCapNotNoExposure
    ? scoreUnknownField(output, 'liquidatedDamagesCap') && /liquidated damages|LD|SLA/i.test(allText)
    : true;
  dimensions.unknownMarginNoFalsePrecision = expected.unknownMarginNoFalsePrecision
    ? scoreUnknownField(output, 'grossMarginPct')
      && financialDrivers(output.projectExposure)
        .filter(driver => /margin/i.test(`${driver.id || ''} ${driver.label || ''}`))
        .every(driver => driver.driverStatus === 'unquantified_driver' || driver.low == null || driver.likely == null || driver.high == null)
    : true;
  dimensions.unsupportedEvidenceNotOverstated = expected.unsupportedEvidenceNotStrong
    ? !valuesList(output.evidenceMap?.unsupportedClaims).some(item => item?.supportLevel === 'strong')
      && !valuesList(output.evidenceMap?.citationQuality?.decorative)
        .some(ref => valuesList(output.evidenceMap?.citationQuality?.strong).includes(ref))
    : true;
  dimensions.genericPathDoesNotRequireProjectEconomics = expected.genericNoProjectEconomics
    ? assessmentType === 'enterprise_generic'
      && valuesList(output.projectExposure?.financialDrivers).length === 0
      && valuesList(output.projectExposure?.missingInputs).length === 0
    : true;
  dimensions.benchmarkLedValuationAcceptable = expected.benchmarkLedAcceptable
    ? ['benchmark_led', 'hybrid', ''].includes(output.projectExposure?.valuationMode || '')
    : true;

  const failures = Object.entries(dimensions)
    .filter(([, passed]) => !passed)
    .map(([dimension]) => dimension);
  return {
    pass: failures.length === 0,
    dimensions,
    failures
  };
}

function summariseProjectDecisionEvalScores(cases = []) {
  const totals = {
    total: cases.length,
    passed: 0,
    failed: 0,
    passRate: 0,
    dimensionTotal: 0,
    dimensionPassed: 0,
    dimensionPassRate: 0,
    failedCases: []
  };
  cases.forEach(item => {
    if (item.score?.pass) totals.passed += 1;
    else {
      totals.failed += 1;
      totals.failedCases.push({ id: item.id, failures: item.score?.failures || [] });
    }
    Object.values(item.score?.dimensions || {}).forEach(passed => {
      totals.dimensionTotal += 1;
      if (passed) totals.dimensionPassed += 1;
    });
  });
  totals.passRate = cases.length ? Number((totals.passed / cases.length).toFixed(3)) : 0;
  totals.dimensionPassRate = totals.dimensionTotal ? Number((totals.dimensionPassed / totals.dimensionTotal).toFixed(3)) : 0;
  return totals;
}

function compactCaseOutput(output = {}) {
  return {
    id: output.id,
    title: output.title,
    expected: output.expected,
    actual: {
      assessmentType: output.assessmentState?.assessmentType,
      projectRole: output.assessmentState?.projectContext?.projectRole,
      valuationMode: output.projectExposure?.valuationMode,
      projectExposureSummary: output.projectExposure?.projectExposureSummary,
      decisionPosture: output.decisionBrief?.decisionPosture,
      decisionConfidence: output.decisionBrief?.confidence,
      projectHorizon: output.simulationResult?.projectHorizon
        ? {
            enabled: output.simulationResult.projectHorizon.enabled === true,
            skippedReason: output.simulationResult.projectHorizon.skippedReason || '',
            confidenceLabel: output.simulationResult.projectHorizon.confidenceLabel || '',
            eventProbability: output.simulationResult.projectHorizon.eventProbability ?? null
          }
        : null,
      financialDrivers: financialDrivers(output.projectExposure).map(driver => ({
        id: driver.id,
        label: driver.label,
        driverType: driver.driverType,
        driverStatus: driver.driverStatus,
        low: driver.low,
        likely: driver.likely,
        high: driver.high,
        mapsTo: driver.mapsTo,
        source: driver.source
      })),
      missingInputs: valuesList(output.projectExposure?.missingInputs).map(item => ({
        field: item?.field || '',
        label: item?.label || '',
        importance: item?.importance || '',
        mapsTo: item?.mapsTo || []
      })),
      doubleCountingWarnings: valuesList(output.projectExposure?.doubleCountingWarnings).map(item => item?.message || item),
      contradictions: output.evidenceMap?.contradictions || [],
      parameterLinks: output.evidenceMap?.parameterEvidenceMap || [],
      stressTests: valuesList(output.decisionChallenge?.recommendedStressTests).map(item => ({
        id: item.id,
        title: item.title,
        testsUnknownField: item.testsUnknownField,
        parameterPatch: item.parameterPatch
      }))
    },
    score: output.score
  };
}

function runProjectDecisionEvalFixtures(fixtures = PROJECT_DECISION_EVAL_FIXTURES) {
  const cases = fixtures.map(fixture => {
    const output = buildProjectDecisionEvalCase(fixture);
    const score = scoreProjectDecisionEvalCase(output);
    return compactCaseOutput({ ...output, score });
  });
  return {
    total: cases.length,
    summary: summariseProjectDecisionEvalScores(cases),
    cases
  };
}

module.exports = {
  PROJECT_DECISION_EVAL_FIXTURES,
  buildProjectDecisionEvalCase,
  scoreProjectDecisionEvalCase,
  summariseProjectDecisionEvalScores,
  runProjectDecisionEvalFixtures
};
