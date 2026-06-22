'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

global.ReportPresentation = require('../../assets/services/reportPresentation.js');
const ExportService = require('../../assets/services/exportService.js');

function buildResults() {
  return {
    lm: { mean: 150000, p50: 120000, p90: 300000 },
    eventLoss: { mean: 150000, p50: 120000, p90: 300000 },
    ale: { mean: 90000, p50: 50000, p90: 240000 },
    annualLoss: { mean: 90000, p50: 50000, p90: 240000 },
    threshold: 1000000,
    warningThreshold: 750000,
    annualReviewThreshold: 3000000,
    toleranceDetail: { lmExceedProb: 0.04 },
    toleranceBreached: false,
    nearTolerance: false,
    annualReviewTriggered: false,
    projectHorizon: {
      enabled: true,
      loss: { mean: 85000, p90: 210000 },
      eventProbability: 0.2,
      durationMonths: 10,
      durationSourceStatus: 'benchmark_proxy',
      confidenceLabel: 'Proxy-based project horizon',
      lossAsPctOfProjectValue: { p90: 0.105 },
      caveats: ['Project duration is benchmark-proxied.']
    },
    inputs: {
      irLikely: 10000,
      biLikely: 50000,
      dbLikely: 10000,
      rlLikely: 5000,
      tpLikely: 20000,
      rcLikely: 15000
    },
    iterations: 1000
  };
}

test('decision memo export model includes project economics section for buyer assessments', () => {
  const memo = ExportService.buildDecisionMemoModel({
    id: 'a-export-buyer',
    assessmentType: 'project_buyer',
    scenarioTitle: 'Supplier delay may affect implementation',
    buName: 'Technology',
    geography: 'United Arab Emirates',
    completedAt: Date.UTC(2026, 5, 10),
    buyerEconomics: {
      approvedBudget: 2000000
    },
    buyerEconomicsMeta: {
      approvedBudget: { status: 'known', confidence: 'high', source: 'user' }
    },
    projectExposure: {
      projectExposureSummary: 'Buyer exposure is linked to delay and reprocurement.',
      projectInputQuality: { score: 55, label: 'Partial project economics' },
      financialDrivers: [
        {
          id: 'delay',
          label: 'Delay cost',
          driverType: 'delay',
          driverStatus: 'benchmark_proxy_driver',
          low: 25000,
          likely: 75000,
          high: 150000,
          confidence: 'low'
        }
      ],
      missingInputs: [
        { field: 'delayCostPerDay', label: 'Delay cost per day', importance: 'high' }
      ]
    },
    decisionBrief: {
      recommendation: 'Proceed only after confirming delay economics.',
      decisionPosture: 'proceed_with_controls',
      why: 'Project economics are sparse and delay cost can change the decision.',
      quantSummary: {
        eventLossP90: 300000,
        annualLossMean: 90000,
        annualLossP90: 240000,
        toleranceExceeded: false,
        annualReviewTriggered: false,
        plainEnglish: 'Within tolerance.'
      },
      projectQuantSummary: {
        projectHorizonLossP90: 210000,
        primaryProjectDriver: 'Delay cost',
        proxyValuesUsed: ['Delay cost: 25,000 / 75,000 / 150,000'],
        unknownHighImpactInputs: ['Delay cost per day'],
        plainEnglish: 'Project economics are thin.'
      },
      nextAction: {
        owner: 'Project owner',
        action: 'Confirm delay cost per day.',
        due: 'Before approval',
        controlOrTreatment: 'Project economics validation'
      },
      confidence: 'low'
    },
    decisionChallenge: {
      challengeSummary: 'Delay cost could change the decision if the critical path slips by several weeks.'
    },
    evidenceMap: {
      unsupportedClaims: [
        { claim: 'Delay cost per day is not evidenced', missingEvidence: 'Delay economics' }
      ]
    },
    assumptionRegister: {
      overallConfidence: 'low',
      assumptions: [
        { statement: 'Delay cost will be estimated until the project owner confirms it.' }
      ],
      missingEvidence: [
        { item: 'Critical path delay cost' }
      ]
    },
    aiAuditStory: {
      classification: 'project buyer',
      fallbackUsed: true,
      summary: 'Fallback project exposure was used.',
      proxyValuesUsed: ['Delay cost proxy'],
      unknownsCarriedForward: ['Delay cost per day'],
      evidenceUsed: ['Project plan']
    },
    results: buildResults()
  }, 'USD', 3.6725, { includeAppendix: true });

  assert.ok(memo.projectResultsModel.isProject);
  assert.equal(memo.decisionBrief.recommendation, 'Proceed only after confirming delay economics.');
  assert.equal(memo.decisionBrief.projectQuantSummary.unknownHighImpactInputs[0], 'Delay cost per day');
  assert.equal(memo.decisionBrief.nextAction.owner, 'Project owner');
  assert.equal(memo.projectResultsModel.title, 'Project buyer exposure');
  assert.ok(memo.projectResultsModel.estimatedValues.length === 0);
  assert.ok(memo.projectResultsModel.knownValues.some(item => item.label === 'Project spend / budget'));
  assert.ok(memo.projectResultsModel.driverGroups.proxyEstimated.some(item => item.label === 'Delay cost'));
  assert.ok(memo.metrics.some(item => item.label === 'Project-horizon expected loss'));
  assert.equal(memo.decisionSupportSummary.assessmentTypeLabel, 'Project risk - buyer');
  assert.equal(memo.decisionSupportSummary.projectInputQuality, 'Partial project economics');
  assert.ok(memo.decisionSupportSummary.proxyValuesUsed.some(item => /Delay cost/.test(item)));
  assert.ok(memo.decisionSupportSummary.unknownHighImpactValues.includes('Delay cost per day'));
  assert.match(memo.decisionSupportSummary.challengeSummary, /Delay cost could change/);
  assert.ok(memo.decisionSupportSummary.evidenceGaps.some(item => /Delay/.test(item)));
  assert.ok(memo.decisionSupportSummary.keyAssumptions.some(item => /Delay cost/.test(item)));
  assert.equal(memo.appendix.aiAuditStory.fallbackUsed, true);
  assert.ok(memo.appendix.proxyValuesUsed.includes('Delay cost proxy') || memo.appendix.proxyValuesUsed.some(item => /Delay cost/.test(item)));
});

test('decision memo export model omits project economics section for generic assessments', () => {
  const memo = ExportService.buildDecisionMemoModel({
    id: 'a-export-generic',
    assessmentType: 'enterprise_generic',
    scenarioTitle: 'Generic enterprise risk',
    buName: 'Technology',
    geography: 'United Arab Emirates',
    completedAt: Date.UTC(2026, 5, 10),
    results: buildResults()
  });

  assert.equal(memo.projectResultsModel.isProject, false);
  assert.equal(memo.projectResultsModel.title, 'Enterprise risk estimate');
  assert.equal(memo.decisionSupportSummary.assessmentTypeLabel, 'Generic enterprise risk');
  assert.equal(memo.decisionSupportSummary.projectInputQuality, 'Not applicable');
});

function buildCriticalAssessment() {
  return {
    id: 'a-critical-export',
    assessmentType: 'enterprise_generic',
    scenarioTitle: 'Azure admin credentials found for sale on the darkweb',
    narrative: 'Azure admin credentials for the tenant were found for sale on the darkweb. It is not yet confirmed whether the credentials are still valid.',
    buName: 'Security',
    geography: 'United Arab Emirates',
    selectedRisks: [
      { title: 'Privileged tenant takeover through leaked administrator credentials', category: 'Cyber' }
    ],
    results: buildResults()
  };
}

test('PPTX export marks critical gates even when the financial result is within tolerance', () => {
  const originalBlob = global.Blob;
  const originalUrl = global.URL;
  const originalDocument = global.document;
  global.Blob = class FakeBlob {};
  global.URL = {
    createObjectURL: () => 'blob:test',
    revokeObjectURL() {}
  };
  global.document = {
    createElement: () => ({
      click() {}
    })
  };
  let spec;
  try {
    spec = ExportService.exportPPTXSpec(buildCriticalAssessment(), 'USD', 3.6725);
  } finally {
    if (originalBlob) global.Blob = originalBlob;
    else delete global.Blob;
    if (originalUrl) global.URL = originalUrl;
    else delete global.URL;
    if (originalDocument) global.document = originalDocument;
    else delete global.document;
  }
  const executive = spec.slides.find(slide => slide.type === 'executive_summary');

  assert.equal(executive.tolerance, 'CRITICAL RESPONSE GATE');
  assert.equal(executive.toleranceColor, '#dc2626');
  assert.match(executive.decisionRead, /Revoke exposed access/i);
});

test('PDF export uses critical gate visual status instead of green within-tolerance cues', () => {
  const originalBlob = global.Blob;
  const originalUrl = global.URL;
  const originalWindow = global.window;
  let html = '';
  global.Blob = class FakeBlob {
    constructor(parts) {
      html = parts.join('');
    }
  };
  global.URL = {
    createObjectURL: () => 'blob:test',
    revokeObjectURL() {}
  };
  global.window = {
    open: () => ({})
  };
  try {
    ExportService.exportPDF(buildCriticalAssessment(), 'USD', 3.6725);
  } finally {
    if (originalBlob) global.Blob = originalBlob;
    else delete global.Blob;
    if (originalUrl) global.URL = originalUrl;
    else delete global.URL;
    if (originalWindow) global.window = originalWindow;
    else delete global.window;
  }

  assert.match(html, /badge danger">Critical access gate open/);
  assert.match(html, /signal-inner">!/);
  assert.doesNotMatch(html, /remains below the warning trigger/);
});
