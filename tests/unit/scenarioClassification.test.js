'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SCENARIO_TAXONOMY,
  SCENARIO_TAXONOMY_DOMAINS,
  SCENARIO_TAXONOMY_OVERLAYS,
  SCENARIO_TAXONOMY_MECHANISMS,
  SCENARIO_TAXONOMY_FAMILIES,
  SCENARIO_TAXONOMY_ACTIVE_FAMILIES
} = require('../../api/_scenarioTaxonomy');
const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('canonical phase 1 taxonomy exposes the exact domain, overlay, mechanism, and family shape', () => {
  assert.equal(SCENARIO_TAXONOMY.taxonomyVersion, 'phase1-2026-04-03');
  assert.deepEqual(
    SCENARIO_TAXONOMY_DOMAINS.map((item) => item.key),
    [
      'cyber',
      'operational',
      'business_continuity',
      'finance',
      'fraud_integrity',
      'compliance',
      'regulatory',
      'legal_contract',
      'procurement',
      'supply_chain',
      'third_party',
      'strategic_transformation',
      'esg_hse_people',
      'physical_ot'
    ]
  );
  assert.deepEqual(
    SCENARIO_TAXONOMY_OVERLAYS.map((item) => item.key),
    [
      'service_outage',
      'customer_harm',
      'direct_monetary_loss',
      'regulatory_scrutiny',
      'backlog_growth',
      'recovery_strain',
      'reputational_damage',
      'data_exposure',
      'operational_disruption',
      'control_breakdown',
      'third_party_dependency',
      'legal_exposure'
    ]
  );
  assert.deepEqual(
    SCENARIO_TAXONOMY_MECHANISMS.map((item) => item.key),
    [
      'privileged_access_abuse',
      'approval_override',
      'credential_theft',
      'token_theft',
      'control_change',
      'process_bypass',
      'manual_workaround',
      'hostile_traffic_saturation',
      'dependency_failure',
      'coordination_breakdown',
      'fallback_gap',
      'records_retention_failure',
      'unlawful_processing',
      'sourcing_concentration',
      'access_control_weakness'
    ]
  );

  assert.equal(SCENARIO_TAXONOMY_FAMILIES.length, 63);
  assert.equal(SCENARIO_TAXONOMY_ACTIVE_FAMILIES.length, 61);
  assert.deepEqual(
    SCENARIO_TAXONOMY_FAMILIES
      .filter((family) => family.status === 'compatibility_only')
      .map((family) => family.key),
    ['privileged_misuse', 'approval_override']
  );
});

test('identity compromise stays cyber, exposes mechanisms, and keeps finance as downstream only', () => {
  const classification = classifyScenario(
    'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(classification.domain, 'cyber');
  assert.equal(classification.primaryFamily?.key, 'identity_compromise');
  assert.ok(Number(classification.confidence || 0) >= 0.8);
  assert.ok(classification.reasonCodes.includes('DIRECT_SIGNAL_MATCH'));
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
  assert.ok(classification.matchedSignals.some((signal) => /identity compromise path|dark web credentials|admin credentials/i.test(String(signal.text || ''))));
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'privileged_access_abuse'));
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'control_change'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'control_breakdown'));
  assert.equal(buildScenarioLens(classification).key, 'cyber');
});

test('availability attack stays cyber and blocks compliance-style drift', () => {
  const classification = classifyScenario(
    'DDoS traffic overwhelms the public website and degrades customer-facing services.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.domain, 'cyber');
  assert.equal(classification.primaryFamily?.key, 'availability_attack');
  assert.ok(classification.reasonCodes.includes('DIRECT_SIGNAL_MATCH'));
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
  assert.ok(classification.mechanisms.some((mechanism) => mechanism.key === 'hostile_traffic_saturation'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'service_outage'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'reputational_damage'));
  assert.equal(classification.primaryFamily?.forbiddenDriftFamilies.includes('policy_breach'), true);
  assert.equal(buildScenarioLens(classification).key, 'cyber');
});

test('payment control failure remains finance while explicit invoice deception elevates to fraud', () => {
  const controlFailure = classifyScenario(
    'Weak payment approval controls allow unauthorised funds transfer and direct monetary loss.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(controlFailure.domain, 'finance');
  assert.equal(controlFailure.primaryFamily?.key, 'payment_control_failure');
  assert.ok(controlFailure.overlays.some((overlay) => overlay.key === 'direct_monetary_loss'));
  assert.equal(buildScenarioLens(controlFailure).key, 'financial');

  const fraud = classifyScenario(
    'A fake invoice and deceptive approval abuse lead to a fraudulent payment release.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(fraud.domain, 'fraud_integrity');
  assert.ok(['invoice_fraud', 'payment_fraud'].includes(fraud.primaryFamily?.key));
  assert.ok(fraud.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
  assert.equal(buildScenarioLens(fraud).key, 'fraud-integrity');
});

test('delivery slippage stays supply chain and does not collapse into cyber from stale hints', () => {
  const classification = classifyScenario(
    'Key supplier misses committed delivery date, delaying infrastructure deployment and dependent projects.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.domain, 'supply_chain');
  assert.equal(classification.primaryFamily?.key, 'delivery_slippage');
  assert.ok(classification.reasonCodes.includes('DIRECT_SIGNAL_MATCH'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'operational_disruption'));
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
});

test('privacy non-compliance stays in compliance when obligation failure is primary and exposure is only downstream', () => {
  const privacy = classifyScenario(
    'Personal data is processed without lawful basis and retention controls fail.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(privacy.domain, 'compliance');
  assert.equal(privacy.primaryFamily?.key, 'privacy_non_compliance');
  assert.ok(privacy.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
  assert.ok(privacy.mechanisms.some((mechanism) => mechanism.key === 'unlawful_processing'));
  assert.ok(privacy.mechanisms.some((mechanism) => mechanism.key === 'records_retention_failure'));
  assert.ok(privacy.overlays.some((overlay) => overlay.key === 'regulatory_scrutiny'));

  const ddosNearMiss = classifyScenario(
    'Hostile traffic floods the website and slows down customer services.',
    { scenarioLensHint: 'compliance' }
  );
  assert.notEqual(ddosNearMiss.primaryFamily?.key, 'privacy_non_compliance');
});

test('forced labour stays ESG / people and does not collapse into procurement-only classification', () => {
  const classification = classifyScenario(
    'Modern slavery allegations emerge in a supplier workforce and trigger stakeholder scrutiny.',
    { scenarioLensHint: 'procurement' }
  );

  assert.equal(classification.domain, 'esg_hse_people');
  assert.equal(classification.primaryFamily?.key, 'forced_labour_modern_slavery');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'reputational_damage'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
  assert.equal(buildScenarioLens(classification).key, 'esg');
});

test('mixed identity scenarios keep the identity event path primary while surfacing secondary families and overlays', () => {
  const classification = classifyScenario(
    'Azure global admin credentials discovered on the dark web are used to access the tenant, modify critical configurations, and leaked data is extracted.'
  );

  assert.equal(classification.primaryFamily?.key, 'identity_compromise');
  assert.ok(classification.secondaryFamilies.some((family) => ['data_disclosure', 'cloud_control_failure'].includes(family.key)));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'data_exposure'));
  assert.ok(Array.isArray(classification.matchedAntiSignals));
  assert.equal(classification.taxonomyVersion, 'phase1-2026-04-03');
});

test('consequence-heavy ambiguous text does not create fake precision', () => {
  const classification = classifyScenario(
    'The business could face customer harm, reputational damage, and regulatory scrutiny if this goes wrong.',
    { scenarioLensHint: 'operational' }
  );

  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
  assert.ok(classification.ambiguityFlags.includes('WEAK_EVENT_PATH'));
  assert.ok(classification.ambiguityFlags.includes('CONSEQUENCE_HEAVY_TEXT'));
});
