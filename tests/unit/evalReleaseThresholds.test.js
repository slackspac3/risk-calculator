'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateEvalThresholds,
  RELEASE_EVAL_THRESHOLD_PROFILES
} = require('../../scripts/check-eval-thresholds.js');

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
    }
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
    }
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
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /passRate/);
  assert.match(result.failures.join('\n'), /primaryLensAccuracy/);
  assert.match(result.failures.join('\n'), /avgAnchorCoverage/);
});
