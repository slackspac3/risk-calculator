'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  buildBuyerProjectExposure,
  buildProjectDoubleCountingWarnings,
  buildProjectExposure,
  buildProjectInputQuality,
  buildSellerProjectExposure,
  getFinancialFieldStatus,
  isKnownFinancialField,
  isUnknownFinancialField,
  mapProjectExposureToRiskParameters
} = require('../../assets/services/projectExposureService.js');

function driverById(exposure, id) {
  return exposure.financialDrivers.find(driver => driver.id === id);
}

test('buyer project exposure calculates delay and reprocurement drivers from known values', () => {
  const exposure = buildBuyerProjectExposure({
    assessmentType: 'project_buyer',
    projectHorizon: { delayDurationDays: 10, delayDurationStatus: 'known' },
    buyerEconomics: {
      delayCostPerDay: 1000,
      expectedBenefitPerDay: 500,
      remainingSpend: 200000,
      reprocurementPremiumPct: 0.25,
      supplierCredits: 10000
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' },
      expectedBenefitPerDay: { status: 'known', confidence: 'high', source: 'user' },
      remainingSpend: { status: 'known', confidence: 'high', source: 'user' },
      reprocurementPremiumPct: { status: 'known', confidence: 'high', source: 'user' },
      supplierCredits: { status: 'known', confidence: 'high', source: 'document' }
    }
  });

  assert.equal(driverById(exposure, 'buyer-delay-cost').likely, 10000);
  assert.equal(driverById(exposure, 'buyer-delay-cost').driverStatus, 'calculated_driver');
  assert.equal(driverById(exposure, 'buyer-delayed-benefit').likely, 5000);
  assert.equal(driverById(exposure, 'buyer-reprocurement-premium').likely, 50000);
  assert.equal(exposure.capsAndOffsets.find(item => item.id === 'buyer-supplier-credits').likely, 10000);
  assert.equal(exposure.mapsToRiskParameters.businessInterruption.likely, 15000);
  assert.ok(exposure.mapsToRiskParameters.thirdParty.likely >= 50000);
});

test('buyer delay with unknown delay cost creates an unquantified driver, not zero', () => {
  const exposure = buildBuyerProjectExposure({
    assessmentType: 'project_buyer',
    projectHorizon: { delayDurationDays: 14 },
    buyerEconomics: {
      delayCostPerDay: null
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  });

  const delay = driverById(exposure, 'buyer-delay-cost');
  assert.equal(delay.driverStatus, 'unquantified_driver');
  assert.equal(delay.low, null);
  assert.equal(delay.likely, null);
  assert.equal(delay.high, null);
  assert.ok(delay.missingInputs.some(input => input.field === 'delayCostPerDay'));
  assert.equal(Boolean(exposure.mapsToRiskParameters.businessInterruption), false);
});

test('seller project exposure calculates margin and capped penalty drivers from known values', () => {
  const exposure = buildSellerProjectExposure({
    assessmentType: 'project_seller',
    sellerEconomics: {
      expectedRevenue: 1000000,
      grossMarginPct: 0.3,
      liquidatedDamagesCap: 100000,
      slaCreditsCap: 20000,
      terminationExposure: 500000,
      liabilityCap: 250000
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'document' },
      grossMarginPct: { status: 'known', confidence: 'high', source: 'document' },
      liquidatedDamagesCap: { status: 'known', confidence: 'high', source: 'document' },
      slaCreditsCap: { status: 'known', confidence: 'high', source: 'document' },
      terminationExposure: { status: 'known', confidence: 'high', source: 'user' },
      liabilityCap: { status: 'known', confidence: 'high', source: 'document' }
    }
  });

  assert.equal(driverById(exposure, 'seller-margin-at-risk').likely, 300000);
  assert.equal(driverById(exposure, 'seller-liquidated-damages').likely, 100000);
  assert.equal(driverById(exposure, 'seller-sla-credits').likely, 20000);
  assert.equal(driverById(exposure, 'seller-termination-liability').likely, 250000);
  assert.equal(driverById(exposure, 'seller-termination-liability').formula, 'min(termination exposure, liability cap)');
  assert.equal(exposure.mapsToRiskParameters.reputationContract.likely, 670000);
});

test('seller unknown margin creates a missing input and no zero-margin precision', () => {
  const exposure = buildSellerProjectExposure({
    assessmentType: 'project_seller',
    sellerEconomics: {
      expectedRevenue: 1000000,
      grossMarginPct: null
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'user' },
      grossMarginPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  });

  const margin = driverById(exposure, 'seller-margin-at-risk');
  assert.equal(margin.driverStatus, 'unquantified_driver');
  assert.equal(margin.likely, null);
  assert.ok(margin.missingInputs.some(input => input.field === 'grossMarginPct'));
  assert.ok(exposure.missingInputs.some(input => input.field === 'grossMarginPct'));
});

test('explicit zero financial values are preserved as quantified values', () => {
  const buyer = buildBuyerProjectExposure({
    assessmentType: 'project_buyer',
    projectHorizon: { delayDurationDays: 5 },
    buyerEconomics: { delayCostPerDay: 0 },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' }
    }
  });
  const seller = buildSellerProjectExposure({
    assessmentType: 'project_seller',
    sellerEconomics: {
      expectedRevenue: 500000,
      grossMarginPct: 0
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'user' },
      grossMarginPct: { status: 'known', confidence: 'high', source: 'user' }
    }
  });

  assert.equal(driverById(buyer, 'buyer-delay-cost').driverStatus, 'calculated_driver');
  assert.equal(driverById(buyer, 'buyer-delay-cost').likely, 0);
  assert.equal(driverById(seller, 'seller-margin-at-risk').driverStatus, 'calculated_driver');
  assert.equal(driverById(seller, 'seller-margin-at-risk').likely, 0);
});

test('recoveries and credits are offsets, not additional loss drivers', () => {
  const exposure = buildBuyerProjectExposure({
    assessmentType: 'project_buyer',
    buyerEconomics: {
      supplierCredits: 15000,
      insuranceRecoveries: 25000,
      liquidatedDamagesRecoverable: 10000
    },
    buyerEconomicsMeta: {
      supplierCredits: { status: 'known', confidence: 'high', source: 'document' },
      insuranceRecoveries: { status: 'known', confidence: 'high', source: 'document' },
      liquidatedDamagesRecoverable: { status: 'known', confidence: 'medium', source: 'document' }
    }
  });

  assert.equal(exposure.capsAndOffsets.length, 3);
  assert.equal(Boolean(driverById(exposure, 'buyer-supplier-credits')), false);
  assert.equal(Boolean(driverById(exposure, 'buyer-insurance-recoveries')), false);
  assert.equal(
    Object.values(exposure.mapsToRiskParameters).some(bucket => bucket.driverIds.includes('buyer-supplier-credits')),
    false
  );
});

test('double-counting warnings cover buyer and seller project economics', () => {
  const buyerWarnings = buildProjectDoubleCountingWarnings({ assessmentType: 'project_buyer' });
  const sellerWarnings = buildProjectDoubleCountingWarnings({ assessmentType: 'project_seller' });

  assert.ok(buyerWarnings.some(warning => warning.id === 'buyer-total-spend-reprocurement'));
  assert.ok(buyerWarnings.some(warning => warning.id === 'buyer-recoveries-unknown-not-zero'));
  assert.ok(sellerWarnings.some(warning => warning.id === 'seller-revenue-margin'));
  assert.ok(sellerWarnings.some(warning => warning.id === 'seller-contract-value-not-loss'));
  assert.ok(sellerWarnings.some(warning => warning.id === 'seller-caps-bound-penalties'));
});

test('project input quality scores known, estimated, and unknown high-impact inputs', () => {
  const quality = buildProjectInputQuality({
    assessmentType: 'project_buyer',
    projectHorizon: { delayDurationDays: 30 },
    buyerEconomics: {
      delayCostPerDay: 1000,
      remainingSpend: 200000,
      reprocurementPremiumPct: null
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' },
      remainingSpend: { status: 'estimated', confidence: 'medium', source: 'user' },
      reprocurementPremiumPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    }
  });

  assert.equal(quality.canProceed, true);
  assert.ok(quality.score > 0);
  assert.ok(['Thin project economics', 'Partial project economics', 'Usable project economics', 'Strong project economics'].includes(quality.label));
  assert.ok(quality.knownHighImpactInputs.some(input => input.field === 'delayCostPerDay'));
  assert.ok(quality.estimatedHighImpactInputs.some(input => input.field === 'remainingSpend'));
  assert.ok(quality.unknownHighImpactInputs.some(input => input.field === 'reprocurementPremiumPct'));
  assert.equal(typeof quality.recommendedNextInput.field, 'string');
});

test('risk bucket mapping ignores unquantified drivers and maps quantified ranges', () => {
  const mapped = mapProjectExposureToRiskParameters({
    financialDrivers: [
      {
        id: 'known-bi',
        driverStatus: 'calculated_driver',
        low: 10,
        likely: 20,
        high: 30,
        mapsTo: ['businessInterruption']
      },
      {
        id: 'unknown-bi',
        driverStatus: 'unquantified_driver',
        low: null,
        likely: null,
        high: null,
        mapsTo: ['businessInterruption']
      },
      {
        id: 'known-legal',
        driverStatus: 'estimated_driver',
        low: 5,
        likely: 15,
        high: 25,
        mapsTo: ['regulatoryLegal', 'reputationContract']
      }
    ]
  });

  assert.deepEqual(mapped.businessInterruption, {
    low: 10,
    likely: 20,
    high: 30,
    driverIds: ['known-bi']
  });
  assert.equal(mapped.regulatoryLegal.likely, 15);
  assert.equal(mapped.reputationContract.likely, 15);
});

test('financial field helpers preserve zero and distinguish unknown fields', () => {
  const economics = { amountPaid: 0, delayCostPerDay: null };
  const meta = {
    amountPaid: { status: 'known', confidence: 'high', source: 'user' },
    delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
  };

  const amountPaid = getFinancialFieldStatus(economics, meta, 'amountPaid');
  assert.equal(amountPaid.value, 0);
  assert.equal(amountPaid.status, 'known');
  assert.equal(isKnownFinancialField(economics, meta, 'amountPaid'), true);
  assert.equal(isUnknownFinancialField(economics, meta, 'amountPaid'), false);
  assert.equal(isUnknownFinancialField(economics, meta, 'delayCostPerDay'), true);
});

test('project exposure service works as a browser global without CommonJS', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../assets/services/projectExposureService.js'), 'utf8');
  const context = {
    console,
    globalThis: {}
  };
  context.window = context.globalThis;
  vm.createContext(context);
  vm.runInContext(source, context);

  assert.equal(typeof context.globalThis.ProjectExposureService.buildProjectExposure, 'function');
  const exposure = context.globalThis.ProjectExposureService.buildProjectExposure({
    assessmentType: 'project_buyer',
    projectHorizon: { delayDurationDays: 1 },
    buyerEconomics: { delayCostPerDay: 1 },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'known', confidence: 'high', source: 'user' }
    }
  });
  assert.equal(driverById(exposure, 'buyer-delay-cost').likely, 1);
});
