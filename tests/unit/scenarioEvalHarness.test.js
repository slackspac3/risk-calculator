'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_DATASET_PATH,
  loadEvalDataset,
  buildEvalInput,
  scoreGeneratedScenario
} = require('../../scripts/eval/lib/scenarioEval.js');
const {
  PROJECT_DECISION_EVAL_FIXTURES,
  runProjectDecisionEvalFixtures
} = require('../../scripts/eval/lib/projectDecisionEval.js');

test('eval fixture stays structurally complete and balanced', () => {
  const dataset = loadEvalDataset(DEFAULT_DATASET_PATH);
  const counts = dataset.reduce((acc, row) => {
    acc[row.domain] = (acc[row.domain] || 0) + 1;
    return acc;
  }, {});
  assert.equal(dataset.length, 132);
  assert.equal(Object.keys(counts).length, 22);
  for (const count of Object.values(counts)) {
    assert.equal(count, 6);
  }
});

test('buildEvalInput maps dataset rows into the step-1 assist shape', () => {
  const [row] = loadEvalDataset(DEFAULT_DATASET_PATH);
  const input = buildEvalInput(row);
  assert.equal(input.riskStatement, row.scenario_text);
  assert.equal(input.businessUnit.scenarioLensHint.length > 0, true);
  assert.deepEqual(input.applicableRegulations, row.scenario_context.regulatory_overlay);
});

test('scoreGeneratedScenario rewards coherent outputs and flags invalid leakage', () => {
  const row = {
    expected_primary_lens: 'Financial',
    acceptable_secondary_lenses: ['Legal / Contract'],
    valid_risks: [
      { title: 'Counterparty default exposure', why_valid: 'A customer insolvency event threatens collections and recovery.' },
      { title: 'Receivables recovery shortfall', why_valid: 'The event directly reduces recoverable debt.' },
      { title: 'Legal recovery uncertainty', why_valid: 'Collections may depend on contested legal recovery.' }
    ],
    invalid_risks: [
      { title: 'Generic compliance breach', why_invalid: 'There is no direct compliance failure in the event path.' },
      { title: 'Cloud service misconfiguration', why_invalid: 'The scenario is not caused by cyber weakness.' },
      { title: 'Physical perimeter intrusion', why_invalid: 'The scenario has no site-security trigger.' },
      { title: 'Industrial telemetry instability', why_invalid: 'The scenario is not an OT failure.' }
    ],
    key_anchor_terms: ['bankruptcy', 'receivables', 'write-off']
  };

  const coherent = scoreGeneratedScenario(row, {
    primaryLens: 'financial',
    secondaryLensKeys: ['legal-contract'],
    scenarioTitle: 'Major customer bankruptcy drives receivables write-off exposure',
    draftNarrative: 'A major customer bankruptcy creates uncertainty over receivables recovery and likely write-offs.',
    summary: 'The financial downside is concentrated in collections, provisioning, and recovery timing.',
    linkAnalysis: 'The event path runs from insolvency to receivables recovery failure and write-off pressure.',
    riskTitles: [
      'Counterparty default exposure',
      'Receivables recovery shortfall',
      'Legal recovery uncertainty'
    ]
  });
  assert.equal(coherent.pass, true);
  assert.equal(coherent.invalidRiskLeakage, 0);

  const drifted = scoreGeneratedScenario(row, {
    primaryLens: 'compliance',
    secondaryLensKeys: ['cyber'],
    scenarioTitle: 'Control-policy weakness creates compliance pressure',
    draftNarrative: 'The main issue is generic compliance drift.',
    summary: 'A broad governance concern is emerging.',
    linkAnalysis: 'Weak compliance controls could drive wider issues.',
    riskTitles: [
      'Generic compliance breach',
      'Cloud service misconfiguration'
    ]
  });
  assert.equal(drifted.pass, false);
  assert.equal(drifted.primaryLensPass, false);
  assert.equal(drifted.invalidRiskLeakage > 0, true);
});

test('project decision-support eval fixtures run locally without live AI', () => {
  assert.equal(PROJECT_DECISION_EVAL_FIXTURES.length, 7);
  const report = runProjectDecisionEvalFixtures();
  assert.equal(report.summary.total, 7);
  assert.equal(report.summary.passed, 7);
  assert.equal(report.summary.passRate, 1);
  assert.equal(report.summary.dimensionPassRate, 1);
  assert.deepEqual(report.summary.failedCases, []);

  const buyerSparse = report.cases.find(item => item.id === 'project-eval-b-buyer-supplier-delay-sparse');
  assert.equal(buyerSparse.score.dimensions.blankValuesNotTreatedAsZero, true);
  assert.equal(buyerSparse.score.dimensions.projectBuyerTotalSpendNotAutomaticLoss, true);
  assert.equal(buyerSparse.score.dimensions.mappedRiskBucketsPresent, true);

  const sellerSparse = report.cases.find(item => item.id === 'project-eval-c-seller-fixed-price-sparse');
  assert.equal(sellerSparse.score.dimensions.blankLdCapDoesNotMeanNoLdExposure, true);
  assert.equal(sellerSparse.score.dimensions.unknownMarginNoFalsePrecision, true);
  assert.equal(sellerSparse.score.dimensions.sellerRevenueAndMarginNotDoubleCounted, true);

  const contradiction = report.cases.find(item => item.id === 'project-eval-d-recovery-contradiction');
  assert.equal(contradiction.score.dimensions.contradictionDetected, true);
  assert.equal(contradiction.score.dimensions.assumptionRegisterMarksWeakOrReview, true);

  const explicitZero = report.cases.find(item => item.id === 'project-eval-g-explicit-zero-recovery');
  assert.equal(explicitZero.score.dimensions.explicitZeroPreserved, true);
});
