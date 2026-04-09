'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('DPIA and data-subject-rights wording stays in privacy governance rather than generic privacy or policy breach', () => {
  const classification = classifyScenario(
    'A data protection impact assessment is not completed for high-risk biometric processing, subject access requests are delayed, and the DPO is not consulted.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'privacy_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
  assert.ok(classification.reasonCodes.includes('PRECEDENCE_RULE_APPLIED'));
});

test('controller-processor and RoPA wording stays in privacy governance rather than third-party or generic compliance drift', () => {
  const classification = classifyScenario(
    'Controller and processor responsibilities are unclear, the record of processing activities is incomplete, and the data processing agreement has not been updated.',
    { scenarioLensHint: 'third-party' }
  );

  assert.equal(classification.primaryFamily?.key, 'privacy_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'supplier_control_weakness'), false);
});

test('UAE health-data safeguard wording stays in privacy governance rather than cyber or legal drift', () => {
  const classification = classifyScenario(
    'Patient-data processing proceeds without the required high-risk assessment, medical-records access logging is weak, and local safeguards for sensitive data are incomplete.',
    { scenarioLensHint: 'cyber' }
  );

  assert.equal(classification.primaryFamily?.key, 'privacy_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.equal(classification.secondaryFamilies.some((family) => ['data_disclosure', 'contract_liability'].includes(family.key)), false);
});

test('explicit cross-border health-data transfer still stays in transfer non-compliance rather than privacy governance', () => {
  const classification = classifyScenario(
    'Patient data is transferred across borders without the required safeguards, localisation controls, or transfer assessment.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'cross_border_transfer_non_compliance');
  assert.notEqual(classification.primaryFamily?.key, 'privacy_governance_gap');
});

test('explicit health-data exposure does not get promoted into privacy governance when disclosure is the event path', () => {
  const classification = classifyScenario(
    'Medical records are leaked externally after unauthorised disclosure from a shared repository.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'data_disclosure');
  assert.notEqual(classification.primaryFamily?.key, 'privacy_governance_gap');
});
