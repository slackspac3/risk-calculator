'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens,
  normaliseScenarioHintKey
} = require('../../api/_scenarioClassification');

test('compatibility-only manual_error aliases cleanly to process_breakdown', () => {
  const classification = classifyScenario(
    'A manual processing error disrupts fulfilment and creates operational backlog.',
    { scenarioLensHint: 'manual_error' }
  );

  assert.equal(normaliseScenarioHintKey('manual_error'), 'operational');
  assert.equal(classification.primaryFamily?.key, 'process_breakdown');
  assert.equal(buildScenarioLens(classification).key, 'operational');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'backlog_growth'));
});

test('compatibility-only facility_access_lapse aliases cleanly to perimeter_breach', () => {
  const classification = classifyScenario(
    'A badge control lapse lets an unauthorised person enter a restricted operations area.',
    { scenarioLensHint: 'facility_access_lapse' }
  );

  assert.equal(normaliseScenarioHintKey('facility_access_lapse'), 'physical-security');
  assert.equal(classification.primaryFamily?.key, 'perimeter_breach');
  assert.equal(buildScenarioLens(classification).key, 'physical-security');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'control_breakdown'));
});

test('compatibility-only industrial_control_instability aliases cleanly to ot_resilience_failure', () => {
  const classification = classifyScenario(
    'Industrial control instability spreads through the OT environment and site operations cannot be sustained safely.',
    { scenarioLensHint: 'industrial_control_instability' }
  );

  assert.equal(normaliseScenarioHintKey('industrial_control_instability'), 'ot-resilience');
  assert.equal(classification.primaryFamily?.key, 'ot_resilience_failure');
  assert.equal(buildScenarioLens(classification).key, 'ot-resilience');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'recovery_strain'));
});

test('identity compromise remains primary when financial consequence is downstream', () => {
  const classification = classifyScenario(
    'Compromised global admin credentials are used to access the tenant, change approval settings, and trigger an unauthorised funds transfer with direct monetary loss.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(classification.primaryFamily?.key, 'identity_compromise');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'direct_monetary_loss'));
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('availability attack stays primary even when regulatory concern is present', () => {
  const classification = classifyScenario(
    'DDoS traffic overwhelms the public website, degrades customer-facing services, and triggers regulatory scrutiny over the outage.',
    { scenarioLensHint: 'regulatory' }
  );

  assert.equal(classification.primaryFamily?.key, 'availability_attack');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'regulatory_scrutiny'));
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('invoice-led deception beats generic payment control weakness', () => {
  const classification = classifyScenario(
    'A fake invoice is submitted into accounts payable and the invoice scam leads to a fraudulent payment release.',
    { scenarioLensHint: 'financial' }
  );

  assert.equal(classification.primaryFamily?.key, 'invoice_fraud');
  assert.equal(buildScenarioLens(classification).key, 'fraud-integrity');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'direct_monetary_loss'));
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('plain payment-control weakness stays in finance when deception is absent', () => {
  const classification = classifyScenario(
    'Weak treasury approval controls allow an unauthorised funds transfer and create direct monetary loss.',
    { scenarioLensHint: 'fraud-integrity' }
  );

  assert.equal(classification.primaryFamily?.key, 'payment_control_failure');
  assert.equal(buildScenarioLens(classification).key, 'financial');
  assert.equal(classification.primaryFamily?.cannotBePrimaryWith.includes('invoice_fraud'), true);
});

test('supplier delay with technology asset words stays delivery slippage rather than cyber', () => {
  const classification = classifyScenario(
    'A key supplier misses the committed delivery date for core network hardware, delaying infrastructure deployment and dependent projects.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'delivery_slippage');
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
  assert.equal(classification.primaryFamily?.forbiddenDriftFamilies.includes('identity_compromise'), true);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
});

test('privacy obligation failure stays compliance when no disclosure is explicit', () => {
  const classification = classifyScenario(
    'Customer records are retained beyond the allowed period and processed without lawful basis, creating regulatory scrutiny and remediation pressure.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'privacy_non_compliance');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'data_disclosure'), false);
  assert.ok(classification.blockedByAntiSignals.some((item) => item.familyKey === 'data_disclosure'));
});

test('explicit exfiltration and exposed records elevate to data disclosure', () => {
  const classification = classifyScenario(
    'Customer records are exfiltrated, exposed records are disclosed externally, and the incident creates legal exposure.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'data_disclosure');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'data_exposure'));
  assert.equal(classification.primaryFamily?.cannotBePrimaryWith.includes('data_disclosure'), false);
});

test('records retention wording selects the specific retention family over generic privacy', () => {
  const classification = classifyScenario(
    'Regulated records are kept too long and the retention schedule breach leaves deletion obligations unmet.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'records_retention_non_compliance');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('cross-border transfer wording selects the transfer family without implying disclosure', () => {
  const classification = classifyScenario(
    'Personal data is transferred cross-border without the required safeguards and the transfer impact assessment is missing.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'cross_border_transfer_non_compliance');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.overlays.some((overlay) => overlay.key === 'data_exposure'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('third-party access compromise beats vendor governance weakness when access abuse is explicit', () => {
  const classification = classifyScenario(
    'Vendor credentials are abused and a third-party remote access path is compromised to reach internal systems.',
    { scenarioLensHint: 'third-party' }
  );

  assert.equal(classification.primaryFamily?.key, 'third_party_access_compromise');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('vendor governance weakness near miss does not get promoted into access compromise', () => {
  const classification = classifyScenario(
    'Vendor access into the environment is weakly controlled and supplier governance is poor, but no compromise has occurred.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'vendor_access_weakness');
  assert.equal(buildScenarioLens(classification).key, 'third-party');
  assert.ok(classification.reasonCodes.includes('REQUIRED_SIGNAL_MATCH'));
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'third_party_access_compromise'), false);
});

test('greenwashing disclosure gap beats generic policy-breach wording', () => {
  const classification = classifyScenario(
    'Sustainability disclosure claims cannot be substantiated and greenwashing concerns trigger scrutiny.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.overlays.some((overlay) => overlay.key === 'data_exposure'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('forced labour stays in ESG rather than procurement concentration', () => {
  const classification = classifyScenario(
    'Modern slavery allegations and worker exploitation emerge in a supplier workforce and trigger stakeholder scrutiny.',
    { scenarioLensHint: 'procurement' }
  );

  assert.equal(classification.primaryFamily?.key, 'forced_labour_modern_slavery');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'single_source_dependency'), false);
  assert.ok(classification.overlays.some((overlay) => overlay.key === 'third_party_dependency'));
});
