'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyScenario,
  buildScenarioLens
} = require('../../api/_scenarioClassification');

test('risk appetite and KRI threshold wording stays in enterprise-risk governance rather than generic compliance', () => {
  const classification = classifyScenario(
    'Key risk indicators move above tolerance, but the risk committee does not receive the escalation while residual risk stays outside appetite.',
    { scenarioLensHint: 'compliance' }
  );

  assert.equal(classification.primaryFamily?.key, 'risk_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'general');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'policy_breach'), false);
});

test('residual-risk acceptance wording stays in enterprise-risk governance rather than transformation drift', () => {
  const classification = classifyScenario(
    'Residual risk above tolerance is accepted before the ERM committee reviews the treatment plan and ownership remains unclear.',
    { scenarioLensHint: 'strategic' }
  );

  assert.equal(classification.primaryFamily?.key, 'risk_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'general');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'programme_delivery_slippage'), false);
});

test('project risk register and emerging-risk wording stays in enterprise-risk governance when no live delay is explicit', () => {
  const classification = classifyScenario(
    'The project risk register is stale, treatment plans are overdue, and emerging risks are not being aggregated into reporting.',
    { scenarioLensHint: 'transformation-delivery' }
  );

  assert.equal(classification.primaryFamily?.key, 'risk_governance_gap');
  assert.equal(buildScenarioLens(classification).key, 'general');
  assert.equal(classification.secondaryFamilies.some((family) => family.key === 'programme_delivery_slippage'), false);
});

test('actual supplier delay remains supply-chain primary even when project risk governance language is present', () => {
  const classification = classifyScenario(
    'A key vendor misses committed delivery dates, delaying rollout, while the project risk register is stale and overdue for update.',
    { scenarioLensHint: 'general' }
  );

  assert.equal(classification.primaryFamily?.key, 'delivery_slippage');
  assert.equal(buildScenarioLens(classification).key, 'supply-chain');
});

test('whistleblowing wording remains compliance-led even if governance language is adjacent', () => {
  const classification = classifyScenario(
    'A whistleblower reports misconduct, retaliation follows, and governance reporting is weak.',
    { scenarioLensHint: 'general' }
  );

  assert.equal(classification.primaryFamily?.key, 'policy_breach');
  assert.equal(buildScenarioLens(classification).key, 'compliance');
  assert.notEqual(classification.primaryFamily?.key, 'risk_governance_gap');
});
