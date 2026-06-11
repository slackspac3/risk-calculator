'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateEvalThresholds,
  RELEASE_EVAL_THRESHOLD_PROFILES
} = require('../../scripts/check-eval-thresholds.js');

function passingProjectDecisionSupport() {
  const requiredCases = [
    ['project-eval-b-buyer-supplier-delay-sparse', ['blankValuesNotTreatedAsZero', 'projectBuyerTotalSpendNotAutomaticLoss']],
    ['project-eval-c-seller-fixed-price-sparse', ['blankLdCapDoesNotMeanNoLdExposure', 'unknownMarginNoFalsePrecision', 'sellerRevenueAndMarginNotDoubleCounted']],
    ['project-eval-d-recovery-contradiction', ['contradictionDetected', 'unsupportedEvidenceNotOverstated']],
    ['project-eval-e-near-tolerance-project', ['nearToleranceChallengePresent', 'proxyValuesLabelled']],
    ['project-eval-g-explicit-zero-recovery', ['explicitZeroPreserved']],
    ['project-eval-a-generic-enterprise', ['genericPathDoesNotRequireProjectEconomics']],
    ['project-eval-f-thin-project-economics', ['blankValuesNotTreatedAsZero']]
  ];
  return {
    total: 7,
    summary: {
      total: 7,
      passed: 7,
      failed: 0,
      passRate: 1,
      dimensionTotal: 12,
      dimensionPassed: 12,
      dimensionPassRate: 1,
      failedCases: []
    },
    cases: requiredCases.map(([id, dimensions]) => ({
      id,
      score: {
        pass: true,
        dimensions: Object.fromEntries(dimensions.map(dimension => [dimension, true])),
        failures: []
      }
    }))
  };
}

test('stub eval thresholds ignore fallback rate but enforce core quality floors', () => {
  const result = evaluateEvalThresholds({
    mode: 'stub',
    summary: {
      total: 132,
      passRate: 0.12,
      primaryLensAccuracy: 0.7,
      avgValidRiskRecall: 0.4,
      avgInvalidRiskLeakageRate: 0.1,
      avgAnchorCoverage: 0.22,
      retrievalRows: 80,
      avgRetrievalF1: 0.48,
      fallbackRate: 1
    },
    projectDecisionSupport: passingProjectDecisionSupport()
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.profile, RELEASE_EVAL_THRESHOLD_PROFILES.stub);
  assert.equal(result.retrievalCoverage, 0.606);
});

test('live eval thresholds fail when fallback dependence remains too high', () => {
  const result = evaluateEvalThresholds({
    mode: 'live',
    summary: {
      total: 132,
      passRate: 0.28,
      primaryLensAccuracy: 0.8,
      avgValidRiskRecall: 0.54,
      avgInvalidRiskLeakageRate: 0.08,
      avgAnchorCoverage: 0.33,
      retrievalRows: 92,
      avgRetrievalF1: 0.57,
      fallbackRate: 0.24
    },
    projectDecisionSupport: passingProjectDecisionSupport()
  });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /fallbackRate/);
});

test('stub eval thresholds fail fast on weak classification and grounding quality', () => {
  const result = evaluateEvalThresholds({
    mode: 'stub',
    summary: {
      total: 132,
      passRate: 0,
      primaryLensAccuracy: 0.538,
      avgValidRiskRecall: 0.313,
      avgInvalidRiskLeakageRate: 0.156,
      avgAnchorCoverage: 0.082,
      retrievalRows: 75,
      avgRetrievalF1: 0.474,
      fallbackRate: 1
    },
    projectDecisionSupport: passingProjectDecisionSupport()
  });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /passRate/);
  assert.match(result.failures.join('\n'), /primaryLensAccuracy/);
  assert.match(result.failures.join('\n'), /avgAnchorCoverage/);
});

test('project decision-support thresholds fail bad sparse-economics report patterns', () => {
  const badProjectSupport = passingProjectDecisionSupport();
  badProjectSupport.summary.passed = 6;
  badProjectSupport.summary.failed = 1;
  badProjectSupport.summary.passRate = 0.857;
  badProjectSupport.summary.dimensionPassed = 11;
  badProjectSupport.summary.dimensionPassRate = 0.917;
  const buyer = badProjectSupport.cases.find(item => item.id === 'project-eval-b-buyer-supplier-delay-sparse');
  buyer.score.pass = false;
  buyer.score.dimensions.blankValuesNotTreatedAsZero = false;
  buyer.score.failures = ['blankValuesNotTreatedAsZero'];

  const result = evaluateEvalThresholds({
    mode: 'stub',
    summary: {
      total: 132,
      passRate: 0.12,
      primaryLensAccuracy: 0.7,
      avgValidRiskRecall: 0.4,
      avgInvalidRiskLeakageRate: 0.1,
      avgAnchorCoverage: 0.22,
      retrievalRows: 80,
      avgRetrievalF1: 0.48,
      fallbackRate: 1
    },
    projectDecisionSupport: badProjectSupport
  });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /blank delay cost becomes zero/);
  assert.match(result.failures.join('\n'), /project decision-support passRate/);
});
