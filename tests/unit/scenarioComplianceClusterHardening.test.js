'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('policy breach stays compliance-led when an internal control process is not followed', () => {
  const classification = classifyScenario(
    'A required internal control process is not followed, breaching policy expectations.',
    { scenarioLensHint: 'regulatory' }
  );

  assert.equal(classification.primaryFamily?.key, 'policy_breach');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'regulatory_filing_failure'), false);
});

test('privacy obligation failure stays compliance-led without explicit disclosure', () => {
  const classification = classifyScenario(
    'Customer records are processed without a lawful basis under stated privacy obligations.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'privacy_non_compliance');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'data_disclosure'), false);
  assert.ok(classification.blockedByAntiSignals.some((item) => item.familyKey === 'policy_breach'));
});

test('records retention wording selects the retention family over generic privacy', () => {
  const classification = classifyScenario(
    'Customer records are retained beyond required deletion periods.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'records_retention_non_compliance');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'privacy_non_compliance'), false);
});

test('cross-border transfer wording selects the transfer family over generic privacy', () => {
  const classification = classifyScenario(
    'Personal data is transferred across borders without required safeguards.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'cross_border_transfer_non_compliance');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'privacy_non_compliance'), false);
});

test('regulatory filing failure stays regulatory-led when the filing obligation is missed', () => {
  const classification = classifyScenario(
    'A mandatory regulatory filing is not submitted on time.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'regulatory_filing_failure');
  assert.equal(buildScenarioLens(classification).key, 'regulatory');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('sanctions wording stays regulatory-led rather than generic policy breach', () => {
  const classification = classifyScenario(
    'A transaction proceeds despite sanctions restrictions and screening control failure.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'sanctions_breach');
  assert.equal(buildScenarioLens(classification).key, 'regulatory');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('licensing wording stays regulatory-led rather than generic concern', () => {
  const classification = classifyScenario(
    'Operations continue without a required permit being valid.',
    { scenarioLensHint: 'operational' }
  );

  assert.equal(classification.primaryFamily?.key, 'licensing_permit_issue');
  assert.equal(buildScenarioLens(classification).key, 'regulatory');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('whistleblowing retaliation wording stays compliance-led rather than drifting into cyber insider wording', () => {
  const classification = classifyScenario(
    'A whistleblower reports misconduct and then faces retaliation while the investigation protocol is not followed.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'policy_breach');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'insider_misuse'), false);
});

test('public-official hospitality wording stays bribery-led rather than generic policy breach', () => {
  const classification = classifyScenario(
    'Sponsored travel and hospitality for a public official proceed without the required anti-bribery approvals.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'bribery_corruption');
  assert.equal(buildScenarioLens(classification).key, 'fraud-integrity');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('restricted-jurisdiction export-control wording stays regulatory-led rather than generic policy breach', () => {
  const classification = classifyScenario(
    'Remote technical access from a restricted jurisdiction was enabled for export-controlled systems before screening clearance was completed.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'sanctions_breach');
  assert.equal(buildScenarioLens(classification).key, 'regulatory');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('business-partner due-diligence red flags stay third-party-led rather than generic policy breach', () => {
  const classification = classifyScenario(
    'A business partner was approved through escalation even though beneficial ownership red flags remained unresolved.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'supplier_control_weakness');
  assert.equal(buildScenarioLens(classification).key, 'third-party');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('insider-information blackout wording stays compliance-led rather than cyber insider misuse', () => {
  const classification = classifyScenario(
    'An employee handles material non-public information during a blackout period before disclosure controls are complete.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'policy_breach');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'insider_misuse'), false);
});

test('contract liability stays legal-contract-led when contractual obligation language is explicit', () => {
  const classification = classifyScenario(
    'A supplier agreement breach creates contractual liability and indemnity exposure.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'contract_liability');
  assert.equal(buildScenarioLens(classification).key, 'legal-contract');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'data_disclosure'), false);
});

test('cyber incident with regulatory scrutiny does not become regulatory primary', () => {
  const classification = classifyScenario(
    'DDoS traffic overwhelms the public website and triggers regulatory scrutiny and legal exposure.',
    { scenarioLensHint: 'regulatory' }
  );

  assert.equal(classification.primaryFamily?.key, 'availability_attack');
  assert.equal(buildScenarioLens(classification).key, 'cyber');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'regulatory_filing_failure'), false);
});

test('ESG disclosure issue with legal exposure does not become contract liability', () => {
  const classification = classifyScenario(
    'Public sustainability claims cannot be evidenced and legal exposure follows.',
    { scenarioLensHint: 'legal-contract' }
  );

  assert.equal(classification.primaryFamily?.key, 'greenwashing_disclosure_gap');
  assert.equal(buildScenarioLens(classification).key, 'esg');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'contract_liability'), false);
});

test('generic legal concern without contract language does not become contract liability', () => {
  const classification = classifyScenario(
    'The organisation faces legal concern and possible liability if control weaknesses persist.',
    { scenarioLensHint: 'legal-contract' }
  );

  assert.notEqual(classification.primaryFamily?.key, 'contract_liability');
  assert.ok(classification.reasonCodes.includes('INSUFFICIENT_PRIMARY_SIGNAL'));
});
