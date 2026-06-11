#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RELEASE_EVAL_THRESHOLD_PROFILES = Object.freeze({
  stub: Object.freeze({
    totalMin: 100,
    passRateMin: 0.08,
    primaryLensAccuracyMin: 0.65,
    avgValidRiskRecallMin: 0.35,
    avgInvalidRiskLeakageRateMax: 0.15,
    avgAnchorCoverageMin: 0.2,
    retrievalCoverageMin: 0.55,
    avgRetrievalF1Min: 0.45
  }),
  live: Object.freeze({
    totalMin: 100,
    passRateMin: 0.2,
    primaryLensAccuracyMin: 0.75,
    avgValidRiskRecallMin: 0.5,
    avgInvalidRiskLeakageRateMax: 0.12,
    avgAnchorCoverageMin: 0.3,
    retrievalCoverageMin: 0.6,
    avgRetrievalF1Min: 0.5,
    fallbackRateMax: 0.15
  })
});

const PROJECT_DECISION_EVAL_REQUIRED_CASES = Object.freeze([
  {
    id: 'project-eval-b-buyer-supplier-delay-sparse',
    dimension: 'blankValuesNotTreatedAsZero',
    failure: 'blank delay cost becomes zero or is not carried as an unknown project input'
  },
  {
    id: 'project-eval-b-buyer-supplier-delay-sparse',
    dimension: 'projectBuyerTotalSpendNotAutomaticLoss',
    failure: 'buyer project spend is treated as automatic loss'
  },
  {
    id: 'project-eval-c-seller-fixed-price-sparse',
    dimension: 'blankLdCapDoesNotMeanNoLdExposure',
    failure: 'blank LD cap becomes no LD exposure'
  },
  {
    id: 'project-eval-c-seller-fixed-price-sparse',
    dimension: 'unknownMarginNoFalsePrecision',
    failure: 'unknown margin produces false margin-at-risk precision'
  },
  {
    id: 'project-eval-c-seller-fixed-price-sparse',
    dimension: 'sellerRevenueAndMarginNotDoubleCounted',
    failure: 'seller contract value is double-counted with margin'
  },
  {
    id: 'project-eval-d-recovery-contradiction',
    dimension: 'contradictionDetected',
    failure: 'contradiction case does not flag contradiction'
  },
  {
    id: 'project-eval-e-near-tolerance-project',
    dimension: 'nearToleranceChallengePresent',
    failure: 'near-tolerance challenge missing'
  },
  {
    id: 'project-eval-d-recovery-contradiction',
    dimension: 'unsupportedEvidenceNotOverstated',
    failure: 'unsupported or contradicted evidence is overstated as strong'
  },
  {
    id: 'project-eval-e-near-tolerance-project',
    dimension: 'proxyValuesLabelled',
    failure: 'proxy values are not labelled'
  },
  {
    id: 'project-eval-g-explicit-zero-recovery',
    dimension: 'explicitZeroPreserved',
    failure: 'explicit zero recovery is not preserved'
  }
]);

function parseArgs(argv) {
  const args = {
    report: path.resolve(process.cwd(), 'test-results/eval/qa-release-report.json')
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [rawKey, inlineValue] = token.split('=');
    const key = rawKey.slice(2);
    const value = inlineValue != null ? inlineValue : argv[index + 1];
    if (inlineValue == null && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      index += 1;
    }
    if (key === 'report') args.report = path.resolve(String(value || args.report));
  }
  return args;
}

function formatMetric(value) {
  const safeValue = Number(value || 0);
  return Number.isFinite(safeValue) ? safeValue.toFixed(3) : 'n/a';
}

function loadEvalReport(reportPath) {
  const resolved = path.resolve(reportPath);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function getEvalThresholdProfile(mode = '') {
  const safeMode = String(mode || '').trim().toLowerCase();
  return RELEASE_EVAL_THRESHOLD_PROFILES[safeMode] || RELEASE_EVAL_THRESHOLD_PROFILES.stub;
}

function evaluateProjectDecisionSupportThresholds(report = {}) {
  const failures = [];
  const support = report && typeof report.projectDecisionSupport === 'object'
    ? report.projectDecisionSupport
    : null;
  if (!support) {
    return {
      ok: false,
      failures: ['project decision-support eval section is missing']
    };
  }
  const cases = Array.isArray(support.cases) ? support.cases : [];
  const summary = support.summary && typeof support.summary === 'object' ? support.summary : {};
  const total = Number(summary.total ?? support.total ?? cases.length ?? 0);
  if (total < 7) {
    failures.push(`project decision-support eval cases ${formatMetric(total)} is below the release minimum 7.000`);
  }
  if (Number(summary.passRate ?? 0) < 1) {
    failures.push(`project decision-support passRate ${formatMetric(summary.passRate)} is below the release minimum 1.000`);
  }
  if (Number(summary.dimensionPassRate ?? 0) < 1) {
    failures.push(`project decision-support dimensionPassRate ${formatMetric(summary.dimensionPassRate)} is below the release minimum 1.000`);
  }

  cases.forEach((testCase) => {
    const score = testCase && typeof testCase.score === 'object' ? testCase.score : {};
    if (score.pass === false) {
      const failuresForCase = Array.isArray(score.failures) ? score.failures.join(', ') : 'unknown dimensions';
      failures.push(`project decision-support case ${testCase.id || 'unknown'} failed: ${failuresForCase}`);
    }
  });

  PROJECT_DECISION_EVAL_REQUIRED_CASES.forEach((requirement) => {
    const testCase = cases.find(item => String(item?.id || '') === requirement.id);
    if (!testCase) {
      failures.push(`${requirement.failure}: required eval case ${requirement.id} is missing`);
      return;
    }
    const dimensions = testCase.score && typeof testCase.score.dimensions === 'object'
      ? testCase.score.dimensions
      : {};
    if (dimensions[requirement.dimension] !== true) {
      failures.push(`${requirement.failure}: ${requirement.id}.${requirement.dimension} did not pass`);
    }
  });

  return {
    ok: failures.length === 0,
    failures
  };
}

function evaluateEvalThresholds(report = {}) {
  const summary = report && typeof report.summary === 'object' ? report.summary : {};
  const mode = String(report.mode || 'stub').trim().toLowerCase() || 'stub';
  const profile = getEvalThresholdProfile(mode);
  const total = Number(summary.total || 0);
  const retrievalRows = Number(summary.retrievalRows || 0);
  const retrievalCoverage = total > 0 ? Number((retrievalRows / total).toFixed(3)) : 0;
  const failures = [];

  function checkMin(label, actual, minimum) {
    if (actual < minimum) {
      failures.push(`${label} ${formatMetric(actual)} is below the release minimum ${formatMetric(minimum)}`);
    }
  }

  function checkMax(label, actual, maximum) {
    if (actual > maximum) {
      failures.push(`${label} ${formatMetric(actual)} exceeds the release maximum ${formatMetric(maximum)}`);
    }
  }

  checkMin('evaluated rows', total, profile.totalMin);
  checkMin('passRate', Number(summary.passRate || 0), profile.passRateMin);
  checkMin('primaryLensAccuracy', Number(summary.primaryLensAccuracy || 0), profile.primaryLensAccuracyMin);
  checkMin('avgValidRiskRecall', Number(summary.avgValidRiskRecall || 0), profile.avgValidRiskRecallMin);
  checkMax('avgInvalidRiskLeakageRate', Number(summary.avgInvalidRiskLeakageRate || 0), profile.avgInvalidRiskLeakageRateMax);
  checkMin('avgAnchorCoverage', Number(summary.avgAnchorCoverage || 0), profile.avgAnchorCoverageMin);
  checkMin('retrievalCoverage', retrievalCoverage, profile.retrievalCoverageMin);
  checkMin('avgRetrievalF1', Number(summary.avgRetrievalF1 || 0), profile.avgRetrievalF1Min);

  if (typeof profile.fallbackRateMax === 'number') {
    checkMax('fallbackRate', Number(summary.fallbackRate || 0), profile.fallbackRateMax);
  }

  const projectDecisionSupport = evaluateProjectDecisionSupportThresholds(report);
  projectDecisionSupport.failures.forEach((failure) => failures.push(failure));

  return {
    ok: failures.length === 0,
    mode,
    profile,
    retrievalCoverage,
    projectDecisionSupport,
    failures
  };
}

function runCli() {
  const args = parseArgs(process.argv);
  const report = loadEvalReport(args.report);
  const result = evaluateEvalThresholds(report);
  if (result.ok) {
    console.log(JSON.stringify({
      report: path.resolve(args.report),
      mode: result.mode,
      thresholds: result.profile,
      retrievalCoverage: result.retrievalCoverage,
      status: 'passed'
    }, null, 2));
    return;
  }
  console.error('Eval release thresholds failed:');
  result.failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  console.error(JSON.stringify({
    report: path.resolve(args.report),
    mode: result.mode,
    thresholds: result.profile,
    retrievalCoverage: result.retrievalCoverage,
    summary: report.summary || {}
  }, null, 2));
  process.exit(1);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  RELEASE_EVAL_THRESHOLD_PROFILES,
  PROJECT_DECISION_EVAL_REQUIRED_CASES,
  getEvalThresholdProfile,
  evaluateEvalThresholds,
  evaluateProjectDecisionSupportThresholds,
  loadEvalReport
};
