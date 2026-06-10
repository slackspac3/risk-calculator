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
