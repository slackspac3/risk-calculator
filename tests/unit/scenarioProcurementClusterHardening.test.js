'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('single-source dependency stays procurement-led when no live supplier incident is explicit', () => {
  const classification = classifyScenario(
    'A critical material is sourced from a single supplier with no viable substitute.',
    { scenarioLensHint: 'supply-chain' }
  );

  assert.equal(classification.primaryFamily?.key, 'single_source_dependency');
  assert.equal(buildScenarioLens(classification).key, 'procurement');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'delivery_slippage'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('supplier concentration stays procurement-led when diversification weakness is explicit', () => {
  const classification = classifyScenario(
    'A small number of suppliers account for most critical component exposure.',
    { scenarioLensHint: 'third-party' }
  );

  assert.equal(classification.primaryFamily?.key, 'supplier_concentration_risk');
  assert.equal(buildScenarioLens(classification).key, 'procurement');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'delivery_slippage'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('supplier delivery miss stays supply-chain-led rather than cyber or transformation-only', () => {
  const classification = classifyScenario(
    'A key supplier misses committed delivery dates, delaying infrastructure deployment and dependent projects.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'delivery_slippage');
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'programme_delivery_slippage'), false);
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'identity_compromise'), false);
});

test('logistics disruption stays distinct from generic delivery slippage when transport cause is explicit', () => {
  const classification = classifyScenario(
    'Transport disruption blocks shipment of critical equipment and delays installation.',
    { scenarioLensHint: 'operational' }
  );

  assert.equal(classification.primaryFamily?.key, 'logistics_disruption');
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'delivery_slippage'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('supplier control weakness stays third-party-led rather than compliance-primary', () => {
  const classification = classifyScenario(
    'A supplier has weak control processes and cannot evidence adequate assurance over critical services.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'supplier_control_weakness');
  assert.equal(buildScenarioLens(classification).key, 'third-party');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'control_breakdown'));
});

test('vendor access weakness stays third-party-led rather than generic cyber control failure', () => {
  const classification = classifyScenario(
    'External vendor accounts have excessive access and weak segregation across critical systems.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'vendor_access_weakness');
  assert.equal(buildScenarioLens(classification).key, 'third-party');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'cloud_control_failure'), false);
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'identity_compromise'), false);
});

test('supplier insolvency stays third-party-led rather than finance-primary', () => {
  const classification = classifyScenario(
    'A critical supplier enters insolvency and cannot continue delivery commitments.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(classification.primaryFamily?.key, 'supplier_insolvency');
  assert.equal(buildScenarioLens(classification).key, 'third-party');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'counterparty_default'), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'direct_monetary_loss'));
});

test('third-party access compromise stays on the inherited access path rather than generic identity only', () => {
  const classification = classifyScenario(
    'A vendor access path is compromised and used to reach internal systems.',
    { scenarioLensHint: 'third-party' }
  );

  assert.equal(classification.primaryFamily?.key, 'third_party_access_compromise');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'identity_compromise'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('supplier delay near miss does not become procurement concentration when actual delay is explicit', () => {
  const classification = classifyScenario(
    'A supplier misses delivery dates and documentation standards.',
    { scenarioLensHint: 'procurement' }
  );

  assert.equal(classification.primaryFamily?.key, 'delivery_slippage');
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
  assert.equal(classification.secondaryFamilies.some((family) => ['single_source_dependency', 'supplier_concentration_risk'].includes(family.key)), false);
});

test('vendor governance weakness near miss does not become access weakness when access is not the issue', () => {
  const classification = classifyScenario(
    'Supplier governance is poor and assurance evidence is incomplete, but external access is not involved.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'supplier_control_weakness');
  assert.equal(buildScenarioLens(classification).key, 'third-party');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'vendor_access_weakness'), false);
  assert.ok(classification.blockedByAntiSignals.some((item) => item.familyKey === 'vendor_access_weakness'));
});

test('internal cyber issue with no third-party path does not become a third-party access compromise', () => {
  const classification = classifyScenario(
    'Admin credentials are abused to reach internal systems with no third-party access path involved.',
    { scenarioLensHint: 'third-party' }
  );

  assert.equal(classification.primaryFamily?.key, 'identity_compromise');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'third_party_access_compromise'), false);
  assert.equal(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'), false);
});

test('internal programme delay near miss does not become supplier delivery slippage', () => {
  const classification = classifyScenario(
    'A programme milestone slips because internal integration work is late.',
    { scenarioLensHint: 'supply-chain' }
  );

  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
  assert.ok(classification.blockedByAntiSignals.some((item) => item.familyKey === 'delivery_slippage'));
});
