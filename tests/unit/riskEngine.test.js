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

test('validateRunParams surfaces lognormal tail and zero-low semantics without breaking compatibility', () => {
  const validation = RiskEngine.validateRunParams(buildValidParams({
    distType: 'lognormal',
    biMin: 0,
    biLikely: 50000,
    biMax: 2500000,
    dbMin: 0,
    dbLikely: 5000,
    dbMax: 200000,
    tpMin: 0,
    tpLikely: 15000,
    tpMax: 450000
  }));

  assert.equal(validation.valid, true);
  assert.ok(validation.semanticsWarnings.some(message => /near-zero planning floors/i.test(message)));
  assert.ok(validation.semanticsWarnings.some(message => /very wide severe tails/i.test(message)));
});

test('validateRunParams warns when derived vulnerability is effectively near-certain', () => {
  const validation = RiskEngine.validateRunParams(buildValidParams({
    threatCapMin: 0.9,
    threatCapLikely: 0.98,
    threatCapMax: 1,
    controlStrMin: 0,
    controlStrLikely: 0.02,
    controlStrMax: 0.08
  }));

  assert.equal(validation.valid, true);
  assert.ok(validation.semanticsWarnings.some(message => /near certainty or near-impossibility/i.test(message)));
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

test('generic risk results remain free of project-horizon output', () => {
  const result = RiskEngine.run(buildValidParams());
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'projectHorizon'), false);
  assert.equal(typeof result.annualLoss.mean, 'number');
  assert.equal(typeof result.eventLoss.p90, 'number');
});

test('project duration creates project-horizon output without changing annual loss shape', () => {
  const result = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 6,
    projectDurationSourceStatus: 'known',
    projectDurationConfidence: 'high',
    projectValue: 1000000,
    projectValueSourceStatus: 'known'
  }));

  assert.equal(result.projectHorizon.enabled, true);
  assert.equal(result.projectHorizon.durationMonths, 6);
  assert.equal(result.projectHorizon.durationYears, 0.5);
  assert.equal(result.projectHorizon.durationSourceStatus, 'known');
  assert.equal(typeof result.projectHorizon.eventProbability, 'number');
  assert.equal(typeof result.projectHorizon.loss.mean, 'number');
  assert.equal(typeof result.annualLoss.mean, 'number');
});

test('short project duration reduces project event probability', () => {
  const base = buildValidParams({
    iterations: 5000,
    seed: 78910,
    assessmentType: 'project_buyer',
    projectDurationSourceStatus: 'known',
    vulnDirect: true,
    vulnMin: 1,
    vulnLikely: 1,
    vulnMax: 1,
    tefMin: 1,
    tefLikely: 1,
    tefMax: 1
  });
  const oneMonth = RiskEngine.run({ ...base, projectDurationMonths: 1 });
  const oneYear = RiskEngine.run({ ...base, projectDurationMonths: 12 });

  assert.ok(oneMonth.projectHorizon.eventProbability < oneYear.projectHorizon.eventProbability);
  assert.ok(oneMonth.projectHorizon.loss.mean < oneYear.projectHorizon.loss.mean);
});

test('unknown or missing project duration skips project-horizon metrics gracefully', () => {
  const missing = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer'
  }));
  assert.equal(missing.projectHorizon.enabled, false);
  assert.equal(missing.projectHorizon.skippedReason, 'project_duration_missing');
  assert.equal(missing.projectHorizon.loss, null);

  const unknown = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 6,
    projectDurationSourceStatus: 'unknown'
  }));
  assert.equal(unknown.projectHorizon.enabled, false);
  assert.equal(unknown.projectHorizon.skippedReason, 'project_duration_source_unknown');
});

test('benchmark-proxy project duration is computed and clearly labelled', () => {
  const result = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 9,
    projectDurationSourceStatus: 'benchmark_proxy',
    projectValue: 750000,
    projectValueSourceStatus: 'estimated'
  }));

  assert.equal(result.projectHorizon.enabled, true);
  assert.equal(result.projectHorizon.durationSourceStatus, 'benchmark_proxy');
  assert.match(result.projectHorizon.confidenceLabel, /Proxy-based/i);
  assert.ok(result.projectHorizon.caveats.some(item => /benchmark-proxied/i.test(item)));
});

test('buyer project-horizon loss percentage uses known spend denominator', () => {
  const result = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 12,
    projectDurationSourceStatus: 'known',
    projectValue: 2000000,
    projectValueSourceStatus: 'known'
  }));

  assert.ok(result.projectHorizon.lossAsPctOfProjectValue);
  assert.equal(
    result.projectHorizon.lossAsPctOfProjectValue.p90,
    result.projectHorizon.loss.p90 / 2000000
  );
  assert.equal(result.projectHorizon.lossAsPctOfMargin, null);
});

test('seller project-horizon loss percentage uses contract value and margin denominators', () => {
  const result = RiskEngine.run(buildValidParams({
    assessmentType: 'project_seller',
    projectDurationMonths: 12,
    projectDurationSourceStatus: 'known',
    projectValue: 1000000,
    projectValueSourceStatus: 'known',
    projectMargin: 250000,
    projectMarginSourceStatus: 'derived'
  }));

  assert.ok(result.projectHorizon.lossAsPctOfProjectValue);
  assert.ok(result.projectHorizon.lossAsPctOfMargin);
  assert.equal(
    result.projectHorizon.lossAsPctOfMargin.p90,
    result.projectHorizon.loss.p90 / 250000
  );
  assert.equal(result.projectHorizon.lossAsPctOfMarginSourceStatus, 'derived');
});

test('missing project value omits percentages without treating value as zero', () => {
  const result = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 6,
    projectDurationSourceStatus: 'estimated'
  }));

  assert.equal(result.projectHorizon.enabled, true);
  assert.equal(result.projectHorizon.lossAsPctOfProjectValue, null);
  assert.ok(result.projectHorizon.caveats.some(item => /project value/i.test(item)));
});

test('invalid project duration stays a warning and skips project-horizon metrics', () => {
  const validation = RiskEngine.validateRunParams(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 0,
    projectDurationSourceStatus: 'known'
  }));
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some(item => /greater than zero/i.test(item)));

  const result = RiskEngine.run(buildValidParams({
    assessmentType: 'project_buyer',
    projectDurationMonths: 0,
    projectDurationSourceStatus: 'known'
  }));
  assert.equal(result.projectHorizon.enabled, false);
  assert.equal(result.projectHorizon.skippedReason, 'project_duration_invalid');
});
