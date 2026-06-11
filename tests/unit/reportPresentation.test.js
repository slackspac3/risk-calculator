'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ReportPresentation = require('../../assets/services/reportPresentation.js');

test('buildExecutiveScenarioSummary produces business-friendly wording', () => {
  const summary = ReportPresentation.buildExecutiveScenarioSummary({
    buName: 'Digital Platforms',
    geography: 'United Arab Emirates',
    structuredScenario: {
      assetService: 'customer-facing payments platform',
      eventPath: 'supplier compromise causing service outage',
      effect: 'service disruption and regulatory scrutiny'
    },
    narrative: 'The main asset, service, or team affected is the customer-facing payments platform. The likely trigger or threat driver is supplier compromise causing service outage.'
  });

  assert.match(summary, /Digital Platforms is assessing a material risk scenario/i);
  assert.doesNotMatch(summary, /identity and access scenario/i);
  assert.match(summary, /This view should be read in the context of United Arab Emirates/i);
});

test('buildExecutiveDecisionSupport uses uncertainty-aware business wording', () => {
  const decision = ReportPresentation.buildExecutiveDecisionSupport(
    {},
    { nearTolerance: true, annualReviewTriggered: false, toleranceBreached: false },
    {
      confidence: { label: 'Low confidence' },
      drivers: {
        upward: ['Business interruption is pushing the result upward.'],
        stabilisers: [],
        uncertainty: [{ label: 'Business interruption range' }]
      }
    }
  );

  assert.equal(decision.decision, 'Actively reduce and review');
  assert.match(decision.managementFocus, /Business interruption range/i);
});

test('buildExecutiveDecisionSupport gates privileged credential exposure independent of tolerance', () => {
  const assessment = {
    buName: 'G42',
    geography: 'United Arab Emirates',
    scenarioTitle: 'Azure admin credentials found for sale on the darkweb',
    narrative: 'Azure admin credentials for the tenant were found for sale on the darkweb. It is not yet confirmed whether the credentials are still valid.',
    selectedRisks: [
      { title: 'Privileged tenant takeover through leaked administrator credentials', category: 'Cyber' }
    ]
  };
  const critical = ReportPresentation.detectCriticalCondition(assessment);
  const decision = ReportPresentation.buildExecutiveDecisionSupport(
    assessment,
    {
      toleranceBreached: false,
      nearTolerance: false,
      annualReviewTriggered: false,
      eventLoss: { p90: 250000 },
      threshold: 1000000
    },
    { confidence: { label: 'Moderate confidence' }, drivers: { upward: [], stabilisers: [] } }
  );

  assert.equal(critical.key, 'privileged-access-exposure');
  assert.equal(decision.decision, 'Critical response required');
  assert.match(decision.rationale, /below tolerance/i);
  assert.match(decision.priority, /Revoke exposed access/i);
  assert.match(decision.criticalCondition.blockingGap, /revoked|disabled/i);
});

test('detectCriticalCondition keeps customer data exposure out of privileged credential gate', () => {
  const critical = ReportPresentation.detectCriticalCondition({
    scenarioTitle: 'Customer account records exposed in cloud storage',
    narrative: 'Customer records and personal data were exposed through a cloud storage configuration issue.'
  });

  assert.equal(critical.key, 'regulated-data-exposure');
  assert.doesNotMatch(critical.title, /credential/i);
});

test('buildExecutiveConfidenceFrame explains decision implications and evidence state', () => {
  const frame = ReportPresentation.buildExecutiveConfidenceFrame(
    { label: 'Low confidence', summary: 'Broad assumptions are still in play.' },
    'Useful but incomplete evidence base',
    ['Validate the current business interruption range with finance and operations input.'],
    [{ id: 'c1' }, { id: 'c2' }]
  );

  assert.equal(frame.label, 'Low confidence');
  assert.match(frame.implication, /directional management view/i);
  assert.match(frame.evidenceSummary, /2 supporting references attached/i);
  assert.match(frame.topGap, /business interruption range/i);
});

test('buildLifecycleNextStepPlan adapts guidance for treatment variants', () => {
  const plan = ReportPresentation.buildLifecycleNextStepPlan({
    lifecycle: { status: 'treatment_variant' },
    results: { toleranceBreached: false, nearTolerance: false, annualReviewTriggered: false },
    executiveDecision: { priority: 'Test stronger prevention and resilience actions.' },
    comparison: {
      severeEvent: { direction: 'down' },
      treatmentNarrative: 'The treatment case is improving the position through stronger controls and lower disruption.'
    },
    confidenceFrame: {
      topGap: 'Validate the treatment assumptions with the service owner.'
    },
    missingInformation: ['Validate the treatment assumptions with the service owner.']
  });

  assert.equal(plan.length, 3);
  assert.match(plan[0].title, /sponsor this improvement path/i);
  assert.match(plan[1].copy, /service owner/i);
  assert.match(plan[2].copy, /locked baseline/i);
});

test('buildTreatmentDecisionSummary explains materially improved treatment paths', () => {
  const summary = ReportPresentation.buildTreatmentDecisionSummary({
    severeEvent: { direction: 'down' },
    annualExposure: { direction: 'down' },
    severeAnnual: { direction: 'down' },
    treatmentNarrative: 'The treatment case is reducing both the severe event and the annual burden.',
    keyDriver: 'Stronger prevention and response controls are reducing the main loss path.',
    secondaryDriver: 'Lower business interruption is improving the severe annual view.'
  });

  assert.match(summary.title, /materially improving the management position/i);
  assert.match(summary.summary, /reducing both the severe event and the annual burden/i);
  assert.match(summary.action, /Stronger prevention and response controls/i);
});

test('buildTreatmentDecisionSummary explains stalled treatment paths', () => {
  const summary = ReportPresentation.buildTreatmentDecisionSummary({
    severeEvent: { direction: 'flat' },
    annualExposure: { direction: 'flat' },
    severeAnnual: { direction: 'flat' },
    keyDriver: 'No single control or resilience lever is moving the baseline yet.'
  });

  assert.match(summary.title, /not yet materially changing the position/i);
  assert.match(summary.action, /Adjust the assumptions/i);
});

test('buildAnalystAdvisorySummary layers meaning confidence and treatment context', () => {
  const summary = ReportPresentation.buildAnalystAdvisorySummary({
    assessment: { scenarioTitle: 'Identity compromise' },
    results: {
      toleranceBreached: false,
      nearTolerance: true,
      eventLoss: { p90: 1450000 },
      annualLoss: { mean: 620000 }
    },
    executiveDecision: {
      decision: 'Actively reduce and review',
      rationale: 'The scenario is near tolerance and should be actively reduced before it worsens.'
    },
    confidenceFrame: {
      label: 'Moderate confidence',
      implication: 'Use this as a working management view and challenge the largest assumptions first.',
      topGap: 'Validate the business interruption range with finance.'
    },
    comparison: {
      severeEvent: { direction: 'down' },
      keyDriver: 'Stronger response coverage reduces interruption duration.'
    },
    missingInformation: ['Validate the business interruption range with finance.'],
    lifecycle: { label: 'Simulated' }
  });

  assert.equal(summary.title, 'Analyst Summary');
  assert.match(summary.opening, /close to tolerance/i);
  assert.match(summary.confidence, /Moderate confidence/i);
  assert.match(summary.evidence, /business interruption range/i);
  assert.match(summary.treatment, /improves the severe-event position/i);
  assert.match(summary.close, /simulated status/i);
});

function buildProjectResultFixture(overrides = {}) {
  return {
    eventLoss: { p90: 250000 },
    annualLoss: { mean: 120000, p90: 400000 },
    lm: { p90: 250000 },
    ale: { mean: 120000, p90: 400000 },
    toleranceDetail: { lmExceedProb: 0.12 },
    annualReviewTriggered: false,
    projectHorizon: {
      enabled: true,
      loss: { mean: 90000, p90: 220000 },
      eventProbability: 0.18,
      durationMonths: 9,
      durationSourceStatus: 'estimated',
      confidenceLabel: 'Estimate-led project horizon',
      lossAsPctOfProjectValue: { p90: 0.11 },
      lossAsPctOfMargin: { p90: 0.44 },
      caveats: []
    },
    ...overrides
  };
}

test('buildProjectResultsModel keeps generic enterprise results project-free', () => {
  const model = ReportPresentation.buildProjectResultsModel(
    { assessmentType: 'enterprise_generic' },
    buildProjectResultFixture({ projectHorizon: null }),
    value => `$${Number(value || 0).toLocaleString('en-US')}`
  );

  assert.equal(model.isProject, false);
  assert.equal(model.title, 'Enterprise risk estimate');
  assert.ok(model.metrics.some(item => item.label === 'Event loss'));
  assert.ok(model.metrics.some(item => item.label === 'Annualized loss'));
});

test('buildProjectResultsModel renders buyer economics without turning sparse unknowns into zero', () => {
  const model = ReportPresentation.buildProjectResultsModel(
    {
      assessmentType: 'project_buyer',
      buyerEconomics: { expectedSpend: null, approvedBudget: null },
      buyerEconomicsMeta: {
        expectedSpend: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
      },
      projectExposure: {
        projectExposureSummary: 'Buyer exposure is delay-led but economics are sparse.',
        projectInputQuality: {
          score: 35,
          label: 'Thin project economics',
          unknownHighImpactInputs: [{ field: 'expectedSpend', label: 'Expected spend' }]
        },
        financialDrivers: [
          {
            id: 'buyer-delay',
            label: 'Delay cost',
            driverType: 'delay',
            driverStatus: 'unquantified_driver',
            low: null,
            likely: null,
            high: null,
            confidence: 'low',
            missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }]
          }
        ],
        missingInputs: [
          { field: 'expectedSpend', label: 'Expected spend', importance: 'high', whyItMatters: 'Needed for spend denominator.' }
        ]
      }
    },
    buildProjectResultFixture(),
    value => `$${Number(value || 0).toLocaleString('en-US')}`
  );

  assert.equal(model.isProject, true);
  assert.equal(model.title, 'Project buyer exposure');
  assert.equal(model.knownValues.length, 0);
  assert.ok(model.unknownHighImpactValues.includes('Expected spend'));
  assert.equal(model.driverGroups.unquantified[0].rangeLabel, 'Not quantified');
  assert.doesNotMatch(JSON.stringify(model), /\$0/);
});

test('buildProjectResultsModel renders seller economics with proxy and margin context', () => {
  const model = ReportPresentation.buildProjectResultsModel(
    {
      assessmentType: 'project_seller',
      sellerEconomics: {
        contractValue: 1000000,
        contributionMargin: 250000
      },
      sellerEconomicsMeta: {
        contractValue: { status: 'benchmark_proxy', confidence: 'low', source: 'benchmark' },
        contributionMargin: { status: 'estimated', confidence: 'medium', source: 'user' }
      },
      projectExposure: {
        projectExposureSummary: 'Seller exposure is margin and LD led.',
        projectInputQuality: { score: 65, label: 'Partial project economics' },
        financialDrivers: [
          {
            id: 'seller-margin',
            label: 'Margin at risk',
            driverType: 'margin_at_risk',
            driverStatus: 'estimated_driver',
            low: 100000,
            likely: 180000,
            high: 250000,
            confidence: 'medium',
            rationale: 'Uses estimated contribution margin.'
          }
        ],
        doubleCountingWarnings: ['Do not count total contract value and margin together.']
      }
    },
    buildProjectResultFixture(),
    value => `$${Number(value || 0).toLocaleString('en-US')}`
  );

  assert.equal(model.title, 'Project seller exposure');
  assert.ok(model.estimatedValues.some(item => item.label === 'Contract value'));
  assert.ok(model.estimatedValues.some(item => item.label === 'Expected margin'));
  assert.equal(model.driverGroups.proxyEstimated[0].label, 'Margin at risk');
  assert.equal(model.projectHorizon.lossAsPctOfMarginLabel, '44.0%');
  assert.match(model.doubleCountingWarnings[0], /contract value and margin/i);
});

test('buildProjectResultsModel tolerates missing projectExposure safely', () => {
  const model = ReportPresentation.buildProjectResultsModel(
    {
      assessmentType: 'project_buyer',
      buyerEconomics: {},
      buyerEconomicsMeta: {}
    },
    buildProjectResultFixture({ projectHorizon: { enabled: false, skippedReason: 'project_duration_missing' } }),
    value => `$${Number(value || 0).toLocaleString('en-US')}`
  );

  assert.equal(model.isProject, true);
  assert.match(model.summary, /Project economics are thin/i);
  assert.equal(model.driverGroups.quantified.length, 0);
  assert.equal(model.projectHorizon.enabled, false);
});
