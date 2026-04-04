'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('workflow breakdown stays operational rather than continuity when service delay and backlog are downstream', () => {
  const classification = classifyScenario(
    'A core internal workflow fails repeatedly, creating service delays, manual workarounds, and rising backlog.',
    { scenarioLensHint: 'business-continuity' }
  );

  assert.equal(classification.primaryFamily?.key, 'process_breakdown');
  assert.equal(buildScenarioLens(classification).key, 'operational');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'backlog_growth'));
  assert.equal(classification.secondaryFamilies.some((family) => ['dr_gap', 'failover_failure', 'recovery_coordination_failure'].includes(family.key)), false);
});

test('explicit failover and disaster-recovery gap selects business continuity over generic operational outage', () => {
  const classification = classifyScenario(
    'A critical messaging platform fails and there is no failover or disaster recovery capability.',
    { scenarioLensHint: 'operational' }
  );

  assert.ok(['dr_gap', 'failover_failure'].includes(classification.primaryFamily?.key));
  assert.equal(classification.domain, 'business_continuity');
  assert.equal(buildScenarioLens(classification).key, 'business-continuity');
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'fallback_gap'));
});

test('physical intrusion owns the scenario when restricted-area access failure is explicit', () => {
  const classification = classifyScenario(
    'An unauthorised person bypasses facility controls and enters a restricted operations area.',
    { scenarioLensHint: 'operational' }
  );

  assert.equal(classification.primaryFamily?.key, 'perimeter_breach');
  assert.equal(buildScenarioLens(classification).key, 'physical-security');
  assert.equal(classification.secondaryFamilies.some((family) => ['process_breakdown', 'service_delivery_failure'].includes(family.key)), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'control_breakdown'));
});

test('industrial-control instability owns the scenario when OT resilience language is explicit', () => {
  const classification = classifyScenario(
    'An industrial control environment becomes unstable and site operations cannot be sustained safely.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'ot_resilience_failure');
  assert.equal(buildScenarioLens(classification).key, 'ot-resilience');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'availability_attack'), false);
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'industrial_control_instability'));
});

test('severe outage with functioning fallback stays service-delivery-led rather than continuity-led', () => {
  const classification = classifyScenario(
    'A customer-facing service becomes unstable due to repeated platform defects, but recovery controls and fallback are functioning.',
    { scenarioLensHint: 'business-continuity' }
  );

  assert.equal(classification.primaryFamily?.key, 'service_delivery_failure');
  assert.equal(buildScenarioLens(classification).key, 'operational');
  assert.equal(classification.secondaryFamilies.some((family) => ['dr_gap', 'failover_failure', 'recovery_coordination_failure'].includes(family.key)), false);
  assert.ok(classification.secondaryFamilies.some((family) => family.key === 'platform_instability'));
});

test('generic crisis escalation language does not auto-promote recovery coordination failure', () => {
  const classification = classifyScenario(
    'Management escalates a severe service incident.',
    { scenarioLensHint: 'business-continuity' }
  );

  assert.notEqual(classification.primaryFamily?.key, 'recovery_coordination_failure');
  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
  assert.ok(classification.ambiguityFlags.includes('WEAK_EVENT_PATH'));
});

test('critical dependency failure beats generic service failure when the dependency is the explicit event path', () => {
  const classification = classifyScenario(
    'A critical internal service fails because a core dependency becomes unavailable.',
    { scenarioLensHint: 'business-continuity' }
  );

  assert.equal(classification.primaryFamily?.key, 'critical_service_dependency_failure');
  assert.equal(buildScenarioLens(classification).key, 'operational');
  assert.equal(classification.secondaryFamilies.some((family) => ['dr_gap', 'failover_failure'].includes(family.key)), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'service_outage'));
});
