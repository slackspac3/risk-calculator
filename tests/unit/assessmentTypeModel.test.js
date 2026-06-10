'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ASSESSMENT_TYPE_GENERIC,
  ASSESSMENT_TYPE_PROJECT_BUYER,
  ASSESSMENT_TYPE_PROJECT_SELLER,
  applyAssessmentTypeSelectionToDraft,
  buildAssessmentTypeChangePatch,
  getAssessmentTypeNextScreen,
  normaliseAssessmentType,
  normaliseAssessmentTypeState,
  normaliseBuyerEconomics,
  normaliseBuyerEconomicsMeta,
  normaliseProjectExposure,
  normaliseSellerEconomics,
  normaliseSellerEconomicsMeta,
  normaliseValuationMode
} = require('../../assets/state/assessmentTypeModel.js');

test('assessment type model returns the default enterprise shape for empty input', () => {
  const state = normaliseAssessmentTypeState();

  assert.equal(state.assessmentType, ASSESSMENT_TYPE_GENERIC);
  assert.deepEqual(state.projectContext, {
    projectName: '',
    projectDescription: '',
    projectRole: 'none',
    projectStage: '',
    contractType: '',
    currency: 'USD',
    projectDurationMonths: null,
    criticalMilestoneDate: '',
    strategicImportance: 'unknown'
  });
  assert.equal(state.buyerEconomics.expectedSpend, null);
  assert.equal(state.buyerEconomicsMeta.expectedSpend.status, 'unknown');
  assert.equal(state.buyerEconomicsMeta.expectedSpend.source, 'not_provided');
  assert.equal(state.sellerEconomics.contractValue, null);
  assert.equal(state.sellerEconomicsMeta.contractValue.status, 'unknown');
  assert.equal(state.buyerProxyQuestions.mainImpact, 'unknown');
  assert.equal(state.sellerProxyQuestions.mainImpact, 'unknown');
  assert.deepEqual(state.projectExposure.financialDrivers, []);
  assert.deepEqual(state.projectExposure.mapsToRiskParameters, {});
});

test('assessment type model never throws on malformed input', () => {
  assert.doesNotThrow(() => normaliseAssessmentTypeState('not an object'));
  assert.doesNotThrow(() => normaliseAssessmentTypeState({
    assessmentType: {},
    projectContext: 'bad',
    buyerEconomics: false,
    sellerEconomics: null,
    projectExposure: 42
  }));

  const state = normaliseAssessmentTypeState({
    assessmentType: {},
    projectContext: { projectName: {}, projectDurationMonths: 'forever' },
    buyerEconomics: { expectedSpend: 'NaN' },
    projectExposure: { financialDrivers: 'not-array' }
  });
  assert.equal(state.assessmentType, ASSESSMENT_TYPE_GENERIC);
  assert.equal(state.projectContext.projectName, '');
  assert.equal(state.projectContext.projectDurationMonths, null);
  assert.equal(state.buyerEconomics.expectedSpend, null);
  assert.deepEqual(state.projectExposure.financialDrivers, []);
});

test('assessment type model tolerates throwing object accessors', () => {
  const projectContext = {};
  Object.defineProperty(projectContext, 'projectName', {
    enumerable: true,
    get() {
      throw new Error('bad getter');
    }
  });
  const state = normaliseAssessmentTypeState({
    assessmentType: ASSESSMENT_TYPE_PROJECT_BUYER,
    projectContext
  });

  assert.equal(state.assessmentType, ASSESSMENT_TYPE_PROJECT_BUYER);
  assert.equal(state.projectContext.projectName, '');
  assert.equal(state.projectContext.projectRole, 'buyer');
});

test('buyer assessment normalises project context and buyer economics without department assumptions', () => {
  const state = normaliseAssessmentTypeState({
    assessmentType: ASSESSMENT_TYPE_PROJECT_BUYER,
    projectContext: {
      projectName: '  ERP migration ',
      projectDescription: '  Replace finance platform ',
      projectRole: 'seller',
      projectStage: '  implementation ',
      contractType: '  fixed price ',
      currency: ' aed ',
      projectDurationMonths: '18',
      criticalMilestoneDate: ' 2026-12-31 ',
      strategicImportance: ' HIGH '
    },
    buyerEconomics: {
      expectedSpend: '0',
      approvedBudget: '1200000',
      remainingSpend: '450000',
      reprocurementPremiumPct: '0.35'
    },
    buyerEconomicsMeta: {
      expectedSpend: { status: 'known', confidence: 'high', source: 'user', note: 'approved business case' },
      remainingSpend: { status: 'estimated', confidence: 'medium', source: 'user' }
    },
    buyerProxyQuestions: {
      mainImpact: 'supplier_replacement',
      likelyDelay: 'weeks',
      supplierReplacementDifficulty: 'hard',
      contractualRecoveries: 'some',
      moneyPaidCommitted: 'most',
      criticalPath: 'yes'
    },
    projectExposure: {
      valuationMode: 'project_linked',
      projectExposureSummary: '  Linked to approved project budget ',
      financialDrivers: ['  reprocurement premium ', { label: ' delay ', amount: '5000' }],
      mapsToRiskParameters: { sle: '  expectedSpend ', ale: 25000 }
    }
  });

  assert.equal(state.assessmentType, ASSESSMENT_TYPE_PROJECT_BUYER);
  assert.equal(state.projectContext.projectRole, 'buyer');
  assert.equal(state.projectContext.projectName, 'ERP migration');
  assert.equal(state.projectContext.currency, 'AED');
  assert.equal(state.projectContext.projectDurationMonths, 18);
  assert.equal(state.projectContext.strategicImportance, 'high');
  assert.equal(state.buyerEconomics.expectedSpend, 0);
  assert.equal(state.buyerEconomics.approvedBudget, 1200000);
  assert.equal(state.buyerEconomics.reprocurementPremiumPct, 0.35);
  assert.equal(state.buyerEconomicsMeta.expectedSpend.status, 'known');
  assert.equal(state.buyerEconomicsMeta.remainingSpend.status, 'estimated');
  assert.equal(state.buyerProxyQuestions.mainImpact, 'supplier_replacement');
  assert.equal(state.buyerProxyQuestions.criticalPath, 'yes');
  assert.equal(state.projectExposure.valuationMode, 'project_linked');
  assert.equal(state.projectExposure.projectExposureSummary, 'Linked to approved project budget');
  assert.deepEqual(state.projectExposure.financialDrivers[0], 'reprocurement premium');
  assert.deepEqual(state.projectExposure.financialDrivers[1], { label: 'delay', amount: '5000' });
  assert.deepEqual(state.projectExposure.mapsToRiskParameters, { sle: 'expectedSpend', ale: 25000 });
});

test('seller assessment normalises project context and seller economics', () => {
  const state = normaliseAssessmentTypeState({
    assessmentType: ASSESSMENT_TYPE_PROJECT_SELLER,
    projectContext: {
      projectName: ' Managed services renewal ',
      projectRole: 'buyer',
      projectDurationMonths: 0,
      strategicImportance: 'medium'
    },
    sellerEconomics: {
      contractValue: '2500000',
      expectedRevenue: '1800000',
      grossMarginPct: '0.42',
      contributionMargin: '750000',
      costToCure: '0'
    },
    sellerProxyQuestions: {
      mainImpact: 'margin_erosion',
      expectedMargin: 'medium',
      penaltiesOrCredits: 'yes',
      terminationRight: 'unknown',
      extraDeliveryCost: 'high',
      commercialModel: 'fixed_price'
    }
  });

  assert.equal(state.assessmentType, ASSESSMENT_TYPE_PROJECT_SELLER);
  assert.equal(state.projectContext.projectRole, 'seller');
  assert.equal(state.projectContext.projectName, 'Managed services renewal');
  assert.equal(state.projectContext.projectDurationMonths, 0);
  assert.equal(state.sellerEconomics.contractValue, 2500000);
  assert.equal(state.sellerEconomics.expectedRevenue, 1800000);
  assert.equal(state.sellerEconomics.grossMarginPct, 0.42);
  assert.equal(state.sellerEconomics.costToCure, 0);
  assert.equal(state.sellerEconomicsMeta.costToCure.status, 'known');
  assert.equal(state.sellerProxyQuestions.mainImpact, 'margin_erosion');
  assert.equal(state.sellerProxyQuestions.commercialModel, 'fixed_price');
});

test('invalid assessment type and valuation mode fall back to enterprise defaults', () => {
  assert.equal(normaliseAssessmentType('procurement'), ASSESSMENT_TYPE_GENERIC);
  assert.equal(normaliseValuationMode('market'), 'benchmark_led');

  const state = normaliseAssessmentTypeState({
    assessmentType: 'procurement',
    projectExposure: { valuationMode: 'market' }
  });
  assert.equal(state.assessmentType, ASSESSMENT_TYPE_GENERIC);
  assert.equal(state.projectContext.projectRole, 'none');
  assert.equal(state.projectExposure.valuationMode, 'benchmark_led');
});

test('assessment type route helper returns the correct next screen', () => {
  assert.equal(getAssessmentTypeNextScreen(ASSESSMENT_TYPE_GENERIC), 'generic_enterprise_inputs');
  assert.equal(getAssessmentTypeNextScreen(ASSESSMENT_TYPE_PROJECT_BUYER), 'project_buyer_inputs');
  assert.equal(getAssessmentTypeNextScreen(ASSESSMENT_TYPE_PROJECT_SELLER), 'project_seller_inputs');
  assert.equal(getAssessmentTypeNextScreen('unknown'), 'generic_enterprise_inputs');
});

test('assessment type selection stores the selected type and project role in draft state', () => {
  const draft = normaliseAssessmentTypeState({});
  applyAssessmentTypeSelectionToDraft(draft, ASSESSMENT_TYPE_PROJECT_BUYER);

  assert.equal(draft.assessmentType, ASSESSMENT_TYPE_PROJECT_BUYER);
  assert.equal(draft.projectContext.projectRole, 'buyer');

  applyAssessmentTypeSelectionToDraft(draft, ASSESSMENT_TYPE_PROJECT_SELLER);
  assert.equal(draft.assessmentType, ASSESSMENT_TYPE_PROJECT_SELLER);
  assert.equal(draft.projectContext.projectRole, 'seller');
});

test('assessment type changes clear incompatible economics only when necessary', () => {
  const buyerDraft = normaliseAssessmentTypeState({
    assessmentType: ASSESSMENT_TYPE_PROJECT_BUYER,
    buyerEconomics: {
      expectedSpend: 100,
      reprocurementPremiumPct: 0.2
    },
    sellerEconomics: {
      contractValue: 500,
      grossMarginPct: 0.4
    }
  });
  const sameType = buildAssessmentTypeChangePatch(buyerDraft, ASSESSMENT_TYPE_PROJECT_BUYER);
  assert.equal(sameType.buyerEconomics.expectedSpend, 100);
  assert.equal(sameType.sellerEconomics.contractValue, 500);

  const sellerType = buildAssessmentTypeChangePatch(buyerDraft, ASSESSMENT_TYPE_PROJECT_SELLER);
  assert.equal(sellerType.projectContext.projectRole, 'seller');
  assert.equal(sellerType.buyerEconomics.expectedSpend, null);
  assert.equal(sellerType.buyerEconomics.reprocurementPremiumPct, null);
  assert.equal(sellerType.sellerEconomics.contractValue, 500);
  assert.equal(sellerType.sellerEconomics.grossMarginPct, 0.4);

  const genericType = buildAssessmentTypeChangePatch(buyerDraft, ASSESSMENT_TYPE_GENERIC);
  assert.equal(genericType.projectContext.projectRole, 'none');
  assert.equal(genericType.buyerEconomics.expectedSpend, null);
  assert.equal(genericType.buyerEconomicsMeta.expectedSpend.status, 'unknown');
  assert.equal(genericType.sellerEconomics.contractValue, null);
});

test('financial metadata distinguishes blank, zero, estimated, unknown, and not applicable values', () => {
  const buyerMeta = normaliseBuyerEconomicsMeta({
    delayCostPerDay: '',
    amountPaid: '0',
    remainingSpend: '500'
  }, {
    delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' },
    amountPaid: { status: 'known', confidence: 'high', source: 'user' },
    remainingSpend: { status: 'estimated', confidence: 'medium', source: 'user', note: 'rough budget view' },
    supplierCredits: { status: 'not_applicable', confidence: 'unknown', source: 'not_provided' }
  });

  assert.equal(buyerMeta.delayCostPerDay.status, 'unknown');
  assert.equal(buyerMeta.delayCostPerDay.source, 'not_provided');
  assert.equal(buyerMeta.amountPaid.status, 'known');
  assert.equal(buyerMeta.remainingSpend.status, 'estimated');
  assert.equal(buyerMeta.remainingSpend.note, 'rough budget view');
  assert.equal(buyerMeta.supplierCredits.status, 'not_applicable');

  const state = normaliseAssessmentTypeState({
    assessmentType: ASSESSMENT_TYPE_PROJECT_BUYER,
    buyerEconomics: {
      delayCostPerDay: '',
      amountPaid: '0'
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown' },
      amountPaid: { status: 'known' }
    }
  });

  assert.equal(state.buyerEconomics.delayCostPerDay, null);
  assert.equal(state.buyerEconomics.amountPaid, 0);
  assert.equal(state.buyerEconomicsMeta.delayCostPerDay.status, 'unknown');
  assert.equal(state.buyerEconomicsMeta.amountPaid.status, 'known');
});

test('seller financial metadata preserves not applicable and estimated optional fields', () => {
  const sellerEconomics = normaliseSellerEconomics({
    liabilityCap: '',
    costToCure: '0',
    probabilityOfAward: '1.4'
  });
  const sellerMeta = normaliseSellerEconomicsMeta(sellerEconomics, {
    liabilityCap: { status: 'not_applicable' },
    costToCure: { status: 'estimated', confidence: 'low', source: 'user' },
    probabilityOfAward: { status: 'estimated', source: 'user' }
  });

  assert.equal(sellerEconomics.liabilityCap, null);
  assert.equal(sellerEconomics.costToCure, 0);
  assert.equal(sellerEconomics.probabilityOfAward, 1);
  assert.equal(sellerMeta.liabilityCap.status, 'not_applicable');
  assert.equal(sellerMeta.costToCure.status, 'estimated');
  assert.equal(sellerMeta.probabilityOfAward.status, 'estimated');
});

test('percentage normalization preserves zero and bounds values between zero and one', () => {
  assert.deepEqual(normaliseBuyerEconomics({
    reprocurementPremiumPct: '2',
    expectedSpend: '0'
  }), {
    expectedSpend: 0,
    approvedBudget: null,
    remainingSpend: null,
    amountCommitted: null,
    amountPaid: null,
    delayCostPerDay: null,
    delayCostPerWeek: null,
    expectedBenefitPerDay: null,
    expectedBenefitPerWeek: null,
    supplierCredits: null,
    insuranceRecoveries: null,
    liquidatedDamagesRecoverable: null,
    contractualRecoveryCap: null,
    legalDisputeEstimate: null,
    reprocurementPremiumPct: 1
  });
  assert.equal(normaliseSellerEconomics({ grossMarginPct: '-0.2' }).grossMarginPct, 0);
  assert.equal(normaliseSellerEconomics({ grossMarginPct: '0' }).grossMarginPct, 0);
});

test('project exposure arrays are capped and normalized', () => {
  const exposure = normaliseProjectExposure({
    financialDrivers: Array.from({ length: 25 }, (_, index) => ` item ${index} `),
    missingInputs: [' impact ', null, '', 0, false]
  });

  assert.equal(exposure.financialDrivers.length, 20);
  assert.equal(exposure.financialDrivers[0], 'item 0');
  assert.deepEqual(exposure.missingInputs, ['impact', 0, false]);
});
