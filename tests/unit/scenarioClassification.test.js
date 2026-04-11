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

function assertConfidenceMetadata(classification = {}) {
  assert.equal(typeof classification.confidence, 'number');
  assert.equal(typeof classification.confidenceScore, 'number');
  assert.match(String(classification.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(classification.confidenceDrivers));
  assert.equal(typeof classification.calibrationMode, 'string');
}

test('canonical phase 1.1 taxonomy exposes the exact domain, overlay, mechanism, and family shape', () => {
  assert.equal(SCENARIO_TAXONOMY.taxonomyVersion, 'phase1.1.19-2026-04-10');
  assert.deepEqual(
    SCENARIO_TAXONOMY_DOMAINS.map((item) => item.key),
    [
      'cyber',
      'ai_model',
      'data_governance',
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
      'manual_processing_error',
      'capacity_constraint',
      'hostile_traffic_saturation',
      'dependency_failure',
      'coordination_breakdown',
      'fallback_gap',
      'records_retention_failure',
      'unlawful_processing',
      'sourcing_concentration',
      'fatigue_staffing_pressure',
      'key_person_concentration',
      'access_control_weakness',
      'industrial_control_instability'
    ]
  );

  assert.equal(SCENARIO_TAXONOMY_FAMILIES.length, 104);
  assert.equal(SCENARIO_TAXONOMY_ACTIVE_FAMILIES.length, 96);
  assert.deepEqual(
    SCENARIO_TAXONOMY_FAMILIES
      .filter((family) => family.status === 'compatibility_only')
      .map((family) => [family.key, family.preferredFamilyKey]),
    [
      ['privileged_misuse', 'identity_compromise'],
      ['capacity_shortfall', 'service_delivery_failure'],
      ['manual_error', 'process_breakdown'],
      ['backlog_escalation', 'service_delivery_failure'],
      ['crisis_escalation', 'recovery_coordination_failure'],
      ['approval_override', 'payment_control_failure'],
      ['facility_access_lapse', 'perimeter_breach'],
      ['industrial_control_instability', 'ot_resilience_failure']
    ]
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
  assert.equal(classification.confidenceBand, 'high');
  assert.ok(classification.confidenceDrivers.includes('STRONG_PRIMARY_SIGNALS'));
  assert.ok(classification.confidenceDrivers.includes('NO_STRONG_COMPETING_FAMILY'));
  assertConfidenceMetadata(classification);
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

test('ransomware extortion wording stays cyber even when payment is mentioned', () => {
  const classification = classifyScenario(
    'Hackers encrypt company servers, halt operations, and demand payment to unlock files.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(classification.domain, 'cyber');
  assert.equal(classification.primaryFamily?.key, 'ransomware');
  assert.ok(classification.reasonCodes.includes('DIRECT_SIGNAL_MATCH'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'service_outage'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'recovery_strain'));
  assert.equal(buildScenarioLens(classification).key, 'cyber');
});

test('canonical classification survives bounded paraphrase wording across high-drift families', () => {
  const cases = [
    {
      text: 'Systems locked and attackers ask for money before core operations can resume.',
      expectedFamily: 'ransomware',
      expectedLens: 'cyber'
    },
    {
      text: 'Key vendor delivery slips and blocks rollout for dependent projects.',
      expectedFamily: 'delivery_slippage',
      expectedLens: 'supply-chain'
    },
    {
      text: 'Staff exhaustion creates unsafe delivery conditions across repeated shifts.',
      expectedFamily: 'workforce_fatigue_staffing_weakness',
      expectedLens: 'people-workforce'
    },
    {
      text: 'Vendor accounts have broad access across critical systems without clear segregation.',
      expectedFamily: 'vendor_access_weakness',
      expectedLens: 'third-party'
    },
    {
      text: 'Support partner accounts can reach production systems through a shared external access path.',
      expectedFamily: 'vendor_access_weakness',
      expectedLens: 'third-party'
    },
    {
      text: 'Scope 2 reduction claims are unsupported because renewable energy attributes do not match the workload geography.',
      expectedFamily: 'greenwashing_disclosure_gap',
      expectedLens: 'esg'
    },
    {
      text: 'Scope 3 emissions claims cannot be evidenced because supplier data does not reconcile to activity assumptions.',
      expectedFamily: 'greenwashing_disclosure_gap',
      expectedLens: 'esg'
    },
    {
      text: 'Worker grievances reveal recruitment fees and passport retention in a labour-broker layer.',
      expectedFamily: 'forced_labour_modern_slavery',
      expectedLens: 'esg'
    },
    {
      text: 'A whistleblower reports misconduct and then faces retaliation while the investigation process is mishandled.',
      expectedFamily: 'policy_breach',
      expectedLens: 'compliance'
    },
    {
      text: 'Sponsored travel and hospitality for a public official proceed without anti-bribery approval.',
      expectedFamily: 'bribery_corruption',
      expectedLens: 'fraud-integrity'
    },
    {
      text: 'Remote technical access from a restricted jurisdiction is enabled for export-controlled systems before screening clearance is complete.',
      expectedFamily: 'sanctions_breach',
      expectedLens: 'regulatory'
    },
    {
      text: 'A business partner is approved through escalation even though beneficial ownership red flags remain unresolved.',
      expectedFamily: 'supplier_control_weakness',
      expectedLens: 'third-party'
    },
    {
      text: 'Material non-public information is handled during a blackout period before disclosure controls are complete.',
      expectedFamily: 'policy_breach',
      expectedLens: 'compliance'
    },
    {
      text: 'A DPIA is not completed for large-scale biometric processing and the DPO is not consulted before the rollout proceeds.',
      expectedFamily: 'privacy_governance_gap',
      expectedLens: 'compliance'
    },
    {
      text: 'Patient data safeguards are incomplete, medical-records access logging is weak, and high-risk health-data processing is not assessed.',
      expectedFamily: 'privacy_governance_gap',
      expectedLens: 'compliance'
    },
    {
      text: 'A third-party payroll processor applies a configuration change that misroutes salary payments, exposing bank details to the wrong employees and delaying correction because incident ownership is unclear.',
      expectedFamily: 'data_disclosure',
      expectedLens: 'cyber'
    }
  ];

  cases.forEach(({ text, expectedFamily, expectedLens }) => {
    const classification = classifyScenario(text, {});
    assert.equal(classification.primaryFamily?.key, expectedFamily);
    assert.equal(buildScenarioLens(classification).key, expectedLens);
  });
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

  assert.equal(privacy.domain, 'data_governance');
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
  assert.equal(classification.confidenceBand, 'high');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'reputational_damage'));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assertConfidenceMetadata(classification);
});

test('mixed identity scenarios keep the identity event path primary while surfacing secondary families and overlays', () => {
  const classification = classifyScenario(
    'Azure global admin credentials discovered on the dark web are used to access the tenant, modify critical configurations, and leaked data is extracted.'
  );

  assert.equal(classification.primaryFamily?.key, 'identity_compromise');
  assert.ok(classification.secondaryFamilies.some((family) => ['data_disclosure', 'cloud_control_failure'].includes(family.key)));
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'data_exposure'));
  assert.ok(Array.isArray(classification.matchedAntiSignals));
  assert.equal(classification.taxonomyVersion, 'phase1.1.19-2026-04-10');
});

test('consequence-heavy ambiguous text does not create fake precision', () => {
  const classification = classifyScenario(
    'The business could face customer harm, reputational damage, and regulatory scrutiny if this goes wrong.',
    { scenarioLensHint: 'operational' }
  );

  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
  assert.ok(classification.ambiguityFlags.includes('WEAK_EVENT_PATH'));
  assert.ok(classification.ambiguityFlags.includes('CONSEQUENCE_HEAVY_TEXT'));
  assert.equal(classification.confidenceBand, 'low');
  assert.ok(classification.confidenceDrivers.includes('CONSEQUENCE_HEAVY_TEXT'));
  assertConfidenceMetadata(classification);
});

test('weak text does not inherit default overlays from a stale hint family', () => {
  const classification = classifyScenario(
    'Service issue affecting operations.',
    { scenarioLensHint: 'financial' }
  );

  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
  assert.equal(classification.overlays.some((overlay) => overlay.key === 'direct_monetary_loss'), false);
  assert.equal(classification.overlays.some((overlay) => overlay.key === 'control_breakdown'), false);
  assert.equal(classification.confidenceBand, 'low');
  assertConfidenceMetadata(classification);
});

test('mixed identity and finance-consequence wording calibrates below high confidence', () => {
  const classification = classifyScenario(
    'Compromised privileged credentials could expose the tenant, trigger treasury review, and create direct financial loss if controls fail.'
  );

  assert.equal(classification.primaryFamily?.key, 'identity_compromise');
  assert.notEqual(classification.confidenceBand, 'high');
  assert.ok(classification.confidenceDrivers.includes('PRECEDENCE_RULE_NEEDED'));
  assertConfidenceMetadata(classification);
});

test('privacy-obligation wording near disclosure stays moderated rather than high-confidence breach framing', () => {
  const classification = classifyScenario(
    'Customer records are processed without a lawful basis and retained too long, creating concern that the retained data could later be exposed.'
  );

  assert.ok(['privacy_non_compliance', 'records_retention_non_compliance'].includes(classification.primaryFamily?.key));
  assert.notEqual(classification.confidenceBand, 'high');
  assertConfidenceMetadata(classification);
});

test('privacy-governance wording stays in a dedicated governance lane rather than collapsing into generic privacy or policy breach', () => {
  const classification = classifyScenario(
    'A data protection impact assessment is not completed for large-scale biometric and health-data processing, data subject rights requests are delayed, and the DPO is not consulted.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'privacy_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
  assertConfidenceMetadata(classification);
});

test('supplier delay with transformation spillover calibrates below high confidence when lanes compete closely', () => {
  const classification = classifyScenario(
    'A vendor delivery miss and internal integration slippage together threaten the transformation timeline for a critical rollout.'
  );

  assert.ok(['delivery_slippage', 'programme_delivery_slippage'].includes(classification.primaryFamily?.key));
  assert.notEqual(classification.confidenceBand, 'high');
  assertConfidenceMetadata(classification);
});

test('greenwashing near-miss policy wording stays moderated rather than overconfident', () => {
  const classification = classifyScenario(
    'An internal environmental reporting process was not followed, creating a possible policy issue that may later draw stakeholder questions.'
  );

  assert.notEqual(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.notEqual(classification.confidenceBand, 'high');
  assertConfidenceMetadata(classification);
});

test('risk appetite and KRI escalation wording stays in the general enterprise-risk lane', () => {
  const classification = classifyScenario(
    'KRIs move above tolerance and escalation to the risk committee does not happen while residual risk remains outside appetite.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'risk_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'general');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assertConfidenceMetadata(classification);
});

test('residual-risk acceptance wording stays in enterprise-risk governance rather than generic policy breach', () => {
  const classification = classifyScenario(
    'Residual risk above tolerance is accepted before the ERM committee reviews the treatment plan.',
    { scenarioLensHint: 'strategic' }
  );

  assert.equal(classification.primaryFamily?.key, 'risk_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'general');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assertConfidenceMetadata(classification);
});

test('explicit supplier delay does not get overwritten by enterprise-risk governance wording', () => {
  const classification = classifyScenario(
    'A key vendor misses committed delivery dates and, separately, the project risk register is stale and overdue for update.',
    { scenarioLensHint: 'general' }
  );

  assert.equal(classification.primaryFamily?.key, 'delivery_slippage');
  assert.notEqual(buildScenarioLens(classification).key, 'general');
  assertConfidenceMetadata(classification);
});
