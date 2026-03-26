'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const RiskEngine = require('../../assets/engine/riskEngine.js');

function buildValidParams(overrides = {}) {
  return {
    distType: 'triangular',
    iterations: 1000,
    seed: 424242,
    tefMin: 0.5,
    tefLikely: 1,
    tefMax: 2,
    vulnDirect: false,
    threatCapMin: 0.3,
    threatCapLikely: 0.5,
    threatCapMax: 0.7,
    controlStrMin: 0.35,
    controlStrLikely: 0.55,
    controlStrMax: 0.75,
    irMin: 10000,
    irLikely: 30000,
    irMax: 80000,
    biMin: 25000,
    biLikely: 100000,
    biMax: 300000,
    dbMin: 10000,
    dbLikely: 35000,
    dbMax: 100000,
    rlMin: 0,
    rlLikely: 15000,
    rlMax: 90000,
    tpMin: 5000,
    tpLikely: 20000,
    tpMax: 70000,
    rcMin: 10000,
    rcLikely: 50000,
    rcMax: 180000,
    corrBiIr: 0.3,
    corrRlRc: 0.2,
    secondaryEnabled: false,
    secProbMin: 0,
    secProbLikely: 0,
    secProbMax: 0,
    secMagMin: 0,
    secMagLikely: 0,
    secMagMax: 0,
    threshold: 5000000,
    annualReviewThreshold: 12000000,
    ...overrides
  };
}

test('validateRunParams rejects malformed model inputs and expensive settings stay warnings', () => {
  const invalid = RiskEngine.validateRunParams(buildValidParams({
    iterations: 120000,
    tefMin: 3,
    tefLikely: 2,
    tefMax: 1
  }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /Iterations must stay between/);
  assert.match(invalid.errors.join(' '), /Event frequency/);

  const warningOnly = RiskEngine.validateRunParams(buildValidParams({
    iterations: 60000,
    distType: 'lognormal',
    secondaryEnabled: true,
    secProbMin: 0.1,
    secProbLikely: 0.2,
    secProbMax: 0.3,
    secMagMin: 5000,
    secMagLikely: 20000,
    secMagMax: 90000
  }));
  assert.equal(warningOnly.valid, true);
  assert.ok(warningOnly.warnings.length >= 2);
});

test('runAsync preserves reproducibility when the saved seed is reused', async () => {
  const first = await RiskEngine.runAsync(buildValidParams({ seed: null }));
  assert.equal(typeof first.runConfig.seed, 'number');
  const second = await RiskEngine.runAsync(buildValidParams({ seed: first.runConfig.seed }));

  assert.equal(first.runConfig.seed, second.runConfig.seed);
  assert.equal(first.eventLoss.p90, second.eventLoss.p90);
  assert.equal(first.annualLoss.mean, second.annualLoss.mean);
  assert.equal(first.histogram[0].count, second.histogram[0].count);
});

test('runAsync can be cancelled at a safe checkpoint', async () => {
  const signal = { aborted: false };
  const runPromise = RiskEngine.runAsync(buildValidParams({ iterations: 2000 }), {
    yieldEvery: 100,
    signal,
    onProgress: () => {
      signal.aborted = true;
    }
  });
  await assert.rejects(runPromise, error => error && error.code === 'SIMULATION_CANCELLED');
});

test('createRunMetadata captures the saved execution context', () => {
  const metadata = RiskEngine.createRunMetadata(buildValidParams(), {
    assumptions: [{ text: 'Business interruption remains the main cost driver.' }],
    scenarioMultipliers: { tefMultiplier: 1.15, lossMultiplier: 1.2, secondaryMultiplier: 1, linked: true },
    thresholdConfigUsed: {
      warningThreshold: 2000000,
      eventToleranceThreshold: 5000000,
      annualReviewThreshold: 12000000
    },
    runtimeGuardrails: ['High iteration count selected.']
  });
  assert.equal(metadata.seed, 424242);
  assert.equal(metadata.distributions.eventModel, 'triangular');
  assert.equal(metadata.thresholdConfigUsed.warningThreshold, 2000000);
  assert.equal(metadata.scenarioMultipliers.lossMultiplier, 1.2);
  assert.deepEqual(metadata.assumptions, ['Business interruption remains the main cost driver.']);
});
