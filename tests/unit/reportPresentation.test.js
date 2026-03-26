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
      attackType: 'supplier compromise causing service outage',
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
