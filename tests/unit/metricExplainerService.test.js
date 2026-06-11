'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MetricExplainerService = require('../../assets/services/metricExplainerService.js');

const SUPPORTED_KEYS = [
  'eventLoss.mean',
  'eventLoss.p50',
  'eventLoss.p90',
  'eventLoss.p95',
  'annualLoss.mean',
  'annualLoss.p50',
  'annualLoss.p90',
  'annualLoss.p95',
  'toleranceDetail.lmExceedProb',
  'toleranceDetail.aleExceedProb',
  'annualReviewDetail.annualExceedProb',
  'projectHorizon.loss.mean',
  'projectHorizon.loss.p90',
  'projectHorizon.eventProbability',
  'projectHorizon.lossAsPctOfProjectValue',
  'projectHorizon.lossAsPctOfMargin',
  'projectExposure.primaryDriver'
];

function buildProjectContext(overrides = {}) {
  return {
    assessmentType: 'project_buyer',
    results: {
      eventLoss: { mean: 120000, p50: 90000, p90: 300000, p95: 420000 },
      annualLoss: { mean: 80000, p50: 40000, p90: 180000, p95: 260000 },
      toleranceDetail: { lmExceedProb: 0.12, aleExceedProb: 0.04 },
      annualReviewDetail: { annualExceedProb: 0.08 },
      projectHorizon: {
        enabled: true,
        durationMonths: 8,
        durationSourceStatus: 'benchmark_proxy',
        durationConfidence: 'low',
        eventProbability: 0.18,
        loss: { mean: 70000, p90: 180000 },
        lossAsPctOfProjectValue: { mean: 0.03, p90: 0.09 },
        lossAsPctOfProjectValueSourceStatus: 'benchmark_proxy',
        lossAsPctOfMargin: { mean: 0.1, p90: 0.24 },
        lossAsPctOfMarginSourceStatus: 'derived',
        caveats: ['Duration is benchmark-proxied until the project plan is confirmed.']
      }
    },
    parameters: { biMin: 10000, biLikely: 40000, biMax: 120000 },
    projectExposure: {
      projectInputQuality: {
        label: 'Thin project economics',
        unknownHighImpactInputs: ['Delay cost per day']
      },
      financialDrivers: [
        {
          id: 'buyer-delay-cost',
          label: 'Delay cost',
          driverType: 'delay',
          driverStatus: 'benchmark_proxy_driver',
          low: 20000,
          likely: 50000,
          high: 160000,
          mapsTo: 'businessInterruption',
          confidence: 'low',
          source: 'benchmark',
          missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }]
        }
      ],
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day', importance: 'high' }]
    },
    decisionBrief: {
      mainDrivers: [{ driver: 'Delay cost', impact: 'Could change project timing.', sourceStatus: 'benchmark_proxy' }],
      projectQuantSummary: {
        proxyValuesUsed: ['Delay cost benchmark proxy'],
        unknownHighImpactInputs: ['Delay cost per day']
      }
    },
    evidenceMap: {
      supportedClaims: [{ claim: 'The project has a go-live dependency.', supportLevel: 'partial' }],
      projectFinancialEvidenceMap: [{ field: 'Delay cost per day', status: 'not_found' }]
    },
    ...overrides
  };
}

test('all supported metric keys return deterministic explanations', () => {
  const context = buildProjectContext();
  for (const key of SUPPORTED_KEYS) {
    const explanation = MetricExplainerService.explainMetric(key, context);
    assert.equal(explanation.metric, key);
    assert.ok(explanation.label);
    assert.ok(explanation.plainEnglish);
    assert.ok(explanation.calculationLogic);
    assert.ok(explanation.sourceContext);
    assert.ok(Array.isArray(explanation.mainDrivers));
  }
});

test('missing data is safe and preserves unknown source context', () => {
  const explanation = MetricExplainerService.explainMetric('eventLoss.mean', null);
  assert.equal(explanation.metric, 'eventLoss.mean');
  assert.ok(explanation.plainEnglish);
  assert.ok(Array.isArray(explanation.sourceContext.unknown));
});

test('annualized and project-horizon explanations are distinct', () => {
  const context = buildProjectContext();
  const annual = MetricExplainerService.explainMetric('annualLoss.mean', context);
  const horizon = MetricExplainerService.explainMetric('projectHorizon.loss.mean', context);
  assert.match(annual.plainEnglish, /annual exposure/i);
  assert.match(horizon.plainEnglish, /project horizon/i);
  assert.notEqual(annual.calculationLogic, horizon.calculationLogic);
});

test('project buyer and seller ratio labels are tailored', () => {
  const buyer = MetricExplainerService.explainMetric('projectHorizon.lossAsPctOfProjectValue', buildProjectContext());
  const seller = MetricExplainerService.explainMetric('projectHorizon.lossAsPctOfProjectValue', buildProjectContext({ assessmentType: 'project_seller' }));
  const margin = MetricExplainerService.explainMetric('projectHorizon.lossAsPctOfMargin', buildProjectContext({ assessmentType: 'project_seller' }));
  assert.equal(buyer.label, 'Loss as % of project spend/budget');
  assert.equal(seller.label, 'Loss as % of contract value');
  assert.equal(margin.label, 'Loss as % of expected margin');
});

test('benchmark proxy caveat is disclosed', () => {
  const explanation = MetricExplainerService.explainMetric('projectHorizon.loss.p90', buildProjectContext());
  assert.ok(explanation.sourceContext.benchmarkProxy.some(item => /benchmark/i.test(item)));
  assert.match(explanation.caveat, /benchmark proxies/i);
});

test('unknown high-impact fields are disclosed and not hidden as zero', () => {
  const explanation = MetricExplainerService.explainMetric('projectExposure.primaryDriver', buildProjectContext());
  assert.ok(explanation.sourceContext.unknown.some(item => /delay cost per day/i.test(item)));
  assert.match(explanation.caveat, /unknowns forward|remain unknown/i);
});

test('probability explanations do not imply certainty', () => {
  const tolerance = MetricExplainerService.explainMetric('toleranceDetail.lmExceedProb', buildProjectContext());
  const projectProbability = MetricExplainerService.explainMetric('projectHorizon.eventProbability', buildProjectContext());
  assert.match(tolerance.plainEnglish, /not the probability that an incident will occur/i);
  assert.match(tolerance.caveat, /not certainty/i);
  assert.match(projectProbability.plainEnglish, /not certainty/i);
});

test('service attaches to browser global', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../assets/services/metricExplainerService.js'), 'utf8');
  const context = { window: {}, globalThis: {}, console };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'metricExplainerService.js' });
  assert.equal(typeof context.window.MetricExplainerService.explainMetric, 'function');
  const explanation = context.window.MetricExplainerService.explainMetric('annualLoss.p90', {});
  assert.equal(explanation.metric, 'annualLoss.p90');
});
