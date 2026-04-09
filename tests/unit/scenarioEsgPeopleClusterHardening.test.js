'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('forced labour stays ESG-led even when supplier context is explicit', () => {
  const classification = classifyScenario(
    'Sub-tier suppliers are found to be using forced labour conditions that were not identified through due diligence.',
    { scenarioLensHint: 'procurement' }
  );

  assert.equal(classification.primaryFamily?.key, 'forced_labour_modern_slavery');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => ['single_source_dependency', 'supplier_concentration_risk'].includes(family.key)), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
});

test('greenwashing stays ESG-led when public sustainability claims are unsupported', () => {
  const classification = classifyScenario(
    'Public sustainability claims cannot be evidenced and differ materially from actual operating practice.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('scope 3 evidence gaps stay ESG-led rather than generic compliance', () => {
  const classification = classifyScenario(
    'Scope 3 reduction claims cannot be evidenced because supplier emissions data and activity factors do not reconcile.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('sustainability-linked financing KPI evidence gaps stay ESG-led instead of financial', () => {
  const classification = classifyScenario(
    'A sustainability-linked loan KPI cannot be evidenced and the claimed margin step-down is under assurance challenge.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => ['payment_control_failure', 'counterparty_default'].includes(family.key)), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('labour-broker recruitment fee and passport retention wording stays ESG-led', () => {
  const classification = classifyScenario(
    'Worker grievances reveal recruitment fees and passport retention in a labour-broker layer, and remediation is delayed.',
    { scenarioLensHint: 'third-party' }
  );

  assert.equal(classification.primaryFamily?.key, 'forced_labour_modern_slavery');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => ['supplier_control_weakness', 'supplier_concentration_risk'].includes(family.key)), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'legal_exposure'));
});

test('safety harm stays HSE-led rather than generic operational', () => {
  const classification = classifyScenario(
    'Unsafe operating conditions lead to a site safety incident with potential worker harm.',
    { scenarioLensHint: 'operational' }
  );

  assert.equal(classification.primaryFamily?.key, 'safety_incident');
  assert.equal(buildScenarioLens(classification).key, 'hse');
  assert.equal(classification.secondaryFamilies.some((family) => ['process_breakdown', 'service_delivery_failure'].includes(family.key)), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'regulatory_scrutiny'));
});

test('environmental spill stays HSE-led rather than generic compliance', () => {
  const classification = classifyScenario(
    'A containment failure leads to release of harmful material into the surrounding environment.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'environmental_spill');
  assert.equal(buildScenarioLens(classification).key, 'hse');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'legal_exposure'));
});

test('workforce fatigue stays in the people-workforce lane rather than generic operational capacity', () => {
  const classification = classifyScenario(
    'Sustained understaffing and fatigue increase the likelihood of unsafe delivery and control failure.',
    { scenarioLensHint: 'operational' }
  );

  assert.equal(classification.primaryFamily?.key, 'workforce_fatigue_staffing_weakness');
  assert.equal(buildScenarioLens(classification).key, 'people-workforce');
  assert.equal(classification.secondaryFamilies.some((family) => ['process_breakdown', 'service_delivery_failure'].includes(family.key)), false);
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'fatigue_staffing_pressure'));
});

test('critical staff dependency stays in the people-workforce lane when key-person concentration is explicit', () => {
  const classification = classifyScenario(
    'Delivery of a critical process depends on a small number of individuals whose absence would materially disrupt execution.',
    { scenarioLensHint: 'strategic' }
  );

  assert.equal(classification.primaryFamily?.key, 'critical_staff_dependency');
  assert.equal(buildScenarioLens(classification).key, 'people-workforce');
  assert.equal(classification.secondaryFamilies.some((family) => ['process_breakdown', 'service_delivery_failure'].includes(family.key)), false);
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'key_person_concentration'));
});

test('supplier delivery and documentation issues do not get promoted into forced labour', () => {
  const classification = classifyScenario(
    'A supplier misses delivery dates and documentation standards.',
    { scenarioLensHint: 'esg' }
  );

  assert.notEqual(classification.primaryFamily?.key, 'forced_labour_modern_slavery');
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
});

test('internal environmental reporting process failure does not become greenwashing without misleading public claims', () => {
  const classification = classifyScenario(
    'An internal environmental reporting process was not followed.',
    { scenarioLensHint: 'esg' }
  );

  assert.notEqual(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
});

test('internal transition-programme slippage without any external claim does not become greenwashing', () => {
  const classification = classifyScenario(
    'An internal transition programme milestone slipped and the implementation schedule is under pressure, but no public climate claim has been made.',
    { scenarioLensHint: 'esg' }
  );

  assert.notEqual(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL') || buildScenarioLens(classification).key !== 'esg');
});
