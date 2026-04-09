'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('BIA, RTO, and call-tree weakness stays in the business continuity lane', () => {
  const classification = classifyScenario(
    'The business impact analysis is stale, RTOs are not defined, and the incident escalation call tree has not been exercised for a critical service.',
    { scenarioLensHint: 'general' }
  );

  assert.equal(classification.primaryFamily?.key, 'continuity_planning_gap');
  assert.equal(buildScenarioLens(classification).key, 'business-continuity');
  assert.equal(classification.secondaryFamilies.some((family) => ['risk_governance_gap', 'process_breakdown'].includes(family.key)), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('alternate-site and manual-fallback readiness wording stays in the business continuity lane', () => {
  const classification = classifyScenario(
    'Alternate site arrangements are not approved, manual fallback is not documented, and continuity exercises are overdue for the service.',
    { scenarioLensHint: 'operational' }
  );

  assert.equal(classification.primaryFamily?.key, 'continuity_planning_gap');
  assert.equal(buildScenarioLens(classification).key, 'business-continuity');
  assert.ok(classification.overlays.some((overlay) => ['recovery_strain', 'control_breakdown'].includes(overlay.key)));
});

test('explicit no-failover wording stays in failover or DR gap rather than planning gap', () => {
  const classification = classifyScenario(
    'A critical messaging platform fails and there is no failover or disaster recovery capability.',
    { scenarioLensHint: 'business-continuity' }
  );

  assert.ok(['dr_gap', 'failover_failure'].includes(classification.primaryFamily?.key));
  assert.notEqual(classification.primaryFamily?.key, 'continuity_planning_gap');
});

test('permit-to-work and management-of-change weakness stays in the HSE lane before harm occurs', () => {
  const classification = classifyScenario(
    'Permit-to-work controls are bypassed, management of change is not followed, and corrective actions remain overdue on contractor maintenance activity.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'safety_control_weakness');
  assert.equal(buildScenarioLens(classification).key, 'hse');
  assert.equal(classification.secondaryFamilies.some((family) => ['policy_breach', 'process_breakdown'].includes(family.key)), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('explicit safety harm stays safety-incident led rather than safety-control weakness', () => {
  const classification = classifyScenario(
    'A contractor is injured after unsafe operating conditions develop during site work.',
    { scenarioLensHint: 'hse' }
  );

  assert.equal(classification.primaryFamily?.key, 'safety_incident');
  assert.notEqual(classification.primaryFamily?.key, 'safety_control_weakness');
});

test('explicit spill stays environmental-spill led rather than safety-control weakness', () => {
  const classification = classifyScenario(
    'A containment failure causes a harmful release to the environment during site operations.',
    { scenarioLensHint: 'hse' }
  );

  assert.equal(classification.primaryFamily?.key, 'environmental_spill');
  assert.notEqual(classification.primaryFamily?.key, 'safety_control_weakness');
});
