'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ReportPresentation = require('../../assets/services/reportPresentation.js');
const DecisionSupportModel = require('../../assets/state/decisionSupportModel.js');
const AiProductStateService = require('../../assets/services/aiProductStateService.js');

function buildResults(overrides = {}) {
  return {
    eventLoss: { mean: 150000, p50: 120000, p90: 300000 },
    annualLoss: { mean: 90000, p50: 50000, p90: 240000 },
    lm: { mean: 150000, p50: 120000, p90: 300000 },
    ale: { mean: 90000, p50: 50000, p90: 240000 },
    threshold: 1000000,
    warningThreshold: 750000,
    annualReviewThreshold: 3000000,
    toleranceDetail: { lmExceedProb: 0.04 },
    annualReviewTriggered: false,
    toleranceBreached: false,
    nearTolerance: false,
    inputs: {
      irLikely: 10000,
      biLikely: 50000,
      dbLikely: 10000,
      rlLikely: 5000,
      tpLikely: 20000,
      rcLikely: 15000
    },
    ...overrides
  };
}

function buildViewModel() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../assets/results/resultsViewModel.js'), 'utf8');
  const sandbox = {
    window: { AiProductStateService },
    AuthService: { getCurrentUser: () => null },
    AppState: { resultsTab: 'executive', resultsBoardroomMode: false },
    ReportPresentation,
    DecisionSupportModel,
    AiProductStateService,
    hydrateResultsRuntimeState: assessment => assessment.results,
    getWarningThreshold: () => 750000,
    getToleranceThreshold: () => 1000000,
    getAnnualReviewThreshold: () => 3000000,
    fmtCurrency: value => `$${Math.round(Number(value || 0)).toLocaleString('en-US')}`,
    getAssessmentLifecyclePresentation: () => ({ status: 'simulated', label: 'Simulated' }),
    buildAssessmentIntelligence: () => ({
      confidence: { label: 'Moderate confidence', score: 70, summary: 'Working confidence.' },
      drivers: { upward: [], stabilisers: [] },
      assumptions: []
    }),
    buildEvidenceGapActionPlan: () => [],
    getAssessments: () => [],
    deriveAssessmentLifecycleStatus: () => 'simulated',
    ASSESSMENT_LIFECYCLE_STATUS: { ARCHIVED: 'archived' },
    renderResultsActionBlock: () => '',
    renderResultsConfidenceNeedsBlock: () => '',
    renderResultsComparisonHighlight: () => '',
    renderTreatmentRecommendationLens: () => '',
    renderResultsExplanationPanel: () => '',
    ValueQuantService: undefined,
    RiskEngine: { createRunMetadata: () => ({}) }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.ResultsViewModel;
}

test('results view model includes normalized decision brief', () => {
  const ResultsViewModel = buildViewModel();
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-brief',
    assessmentType: 'project_buyer',
    scenarioTitle: 'Supplier delay',
    buName: 'Technology',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    decisionBrief: {
      recommendation: 'Proceed with controls.',
      decisionPosture: 'proceed_with_controls',
      quantSummary: {
        eventLossP90: 300000
      },
      projectQuantSummary: {
        unknownHighImpactInputs: ['Delay cost per day']
      },
      confidence: 'low'
    },
    results: buildResults()
  });

  assert.equal(model.decisionBrief.recommendation, 'Proceed with controls.');
  assert.equal(model.decisionBrief.decisionPosture, 'proceed_with_controls');
  assert.deepEqual(model.decisionBrief.projectQuantSummary.unknownHighImpactInputs, ['Delay cost per day']);
});

test('results cockpit keeps generic enterprise assessment project-free', () => {
  const ResultsViewModel = buildViewModel();
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-generic-cockpit',
    assessmentType: 'enterprise_generic',
    scenarioTitle: 'Generic operational outage',
    buName: 'Operations',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    decisionBrief: {
      recommendation: 'Monitor and improve controls.',
      decisionPosture: 'proceed_with_controls',
      why: 'The result is within tolerance but the main driver should stay visible.',
      mainDrivers: [{ driver: 'Business interruption', impact: 'Largest modelled cost bucket.' }],
      nextAction: { owner: 'Risk owner', action: 'Confirm recovery evidence.' }
    },
    results: buildResults()
  });

  assert.equal(model.decisionCockpitModel.assessmentType, 'enterprise_generic');
  assert.equal(model.decisionCockpitModel.isProject, false);
  assert.equal(model.decisionCockpitModel.assessmentTypeLabel, 'Generic enterprise risk');
  assert.ok(model.decisionCockpitModel.economicsMetrics.some(item => item.label === 'Event loss'));
  assert.equal(model.decisionCockpitModel.knownValues.length, 0);
});

test('results cockpit exposes no-AI empty state safely', () => {
  const ResultsViewModel = buildViewModel();
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-no-ai-cockpit',
    assessmentType: 'enterprise_generic',
    scenarioTitle: 'Manual assessment',
    buName: 'Operations',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    results: buildResults()
  });

  assert.equal(model.decisionCockpitModel.aiMode.label, 'No AI outputs');
  assert.ok(model.decisionCockpitModel.emptyStates.some(item => item.key === 'no_ai'));
  assert.ok(model.decisionCockpitModel.emptyStates.some(item => item.key === 'no_challenge'));
});

test('results cockpit exposes unified AI journey state and stale prompts', () => {
  const ResultsViewModel = buildViewModel();
  const staleFingerprint = AiProductStateService.buildFingerprint({ old: true });
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-ai-journey',
    assessmentType: 'project_buyer',
    scenarioTitle: 'Supplier delay',
    buName: 'Technology',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    projectContext: { projectRole: 'buyer', projectName: 'ERP rollout' },
    buyerEconomics: { approvedBudget: 2000000 },
    buyerEconomicsMeta: { approvedBudget: { status: 'known', confidence: 'high', source: 'user' } },
    projectExposure: {
      sourceMode: 'live',
      inputFingerprint: staleFingerprint,
      projectExposureSummary: 'Old project map.',
      projectInputQuality: { score: 50, label: 'Partial project economics' },
      financialDrivers: []
    },
    decisionBrief: {
      mode: 'deterministic_fallback',
      recommendation: 'Confirm the project economics.',
      decisionPosture: 'needs_more_evidence',
      why: 'Inputs changed after the map was generated.'
    },
    results: buildResults()
  });

  assert.equal(model.decisionCockpitModel.aiJourney.staleCount >= 1, true);
  assert.equal(model.decisionCockpitModel.aiJourney.recommendedAction, 'Refresh Project exposure map');
  assert.ok(model.decisionCockpitModel.badges.some(item => item.label === 'AI mode'));
});

test('results cockpit explains project-economics stale reasons when fingerprint breakdowns exist', () => {
  const ResultsViewModel = buildViewModel();
  const savedBreakdown = AiProductStateService.buildFingerprintBreakdown({
    scenario: {
      assessmentType: 'project_buyer',
      scenario: 'Supplier delay',
      structuredScenario: {},
      scenarioLens: {}
    },
    projectEconomics: {
      assessmentType: 'project_buyer',
      projectContext: { projectRole: 'buyer', projectName: 'ERP rollout' },
      buyerEconomics: { approvedBudget: 1000000 },
      buyerEconomicsMeta: { approvedBudget: { status: 'known', confidence: 'high', source: 'user' } },
      sellerEconomics: {},
      sellerEconomicsMeta: {},
      buyerProxyQuestions: {},
      sellerProxyQuestions: {}
    },
    citations: [],
    businessContext: {
      buId: '',
      buName: 'Technology',
      geography: 'United Arab Emirates',
      geographies: [],
      applicableRegulations: []
    }
  });
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-ai-breakdown',
    assessmentType: 'project_buyer',
    scenarioTitle: 'Supplier delay',
    buName: 'Technology',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    projectContext: { projectRole: 'buyer', projectName: 'ERP rollout' },
    buyerEconomics: { approvedBudget: 2000000 },
    buyerEconomicsMeta: { approvedBudget: { status: 'known', confidence: 'high', source: 'user' } },
    projectExposure: {
      sourceMode: 'live',
      inputFingerprint: savedBreakdown.fingerprint,
      inputFingerprintBreakdown: savedBreakdown,
      projectExposureSummary: 'Old project map.',
      projectInputQuality: { score: 50, label: 'Partial project economics' },
      financialDrivers: [{ id: 'delay', label: 'Delay cost' }]
    },
    results: buildResults()
  });
  const projectState = model.decisionCockpitModel.aiJourney.outputs.find(item => item.key === 'projectexposure' || item.key === 'project_exposure');

  assert.ok(projectState);
  assert.equal(projectState.freshnessStatus, 'stale');
  assert.equal(projectState.freshnessSeverity, 'critical');
  assert.ok(projectState.staleCategoryLabels.includes('project economics'));
  assert.match(projectState.refreshReason, /project economics changed/);
});

test('results cockpit surfaces buyer sparse economics without zeroing unknowns', () => {
  const ResultsViewModel = buildViewModel();
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-buyer-cockpit',
    assessmentType: 'project_buyer',
    scenarioTitle: 'Supplier delay',
    buName: 'Technology',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    buyerEconomics: { approvedBudget: 2000000, delayCostPerDay: null },
    buyerEconomicsMeta: {
      approvedBudget: { status: 'known', confidence: 'high', source: 'user' },
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    },
    projectExposure: {
      valuationMode: 'hybrid',
      projectExposureSummary: 'Buyer exposure is linked to delay and reprocurement.',
      projectInputQuality: { score: 45, label: 'Thin project economics' },
      financialDrivers: [
        {
          id: 'delay',
          label: 'Delay cost',
          driverType: 'delay',
          driverStatus: 'unquantified_driver',
          low: null,
          likely: null,
          high: null,
          missingInputs: ['Delay cost per day']
        }
      ],
      missingInputs: [
        { field: 'delayCostPerDay', label: 'Delay cost per day', importance: 'high' }
      ]
    },
    decisionBrief: {
      recommendation: 'Proceed only after confirming delay economics.',
      decisionPosture: 'needs_more_evidence',
      why: 'Delay cost can change the project decision.',
      projectQuantSummary: {
        primaryProjectDriver: 'Delay cost',
        unknownHighImpactInputs: ['Delay cost per day'],
        plainEnglish: 'Project economics are thin.'
      },
      sparseDataWarning: 'Project economics are thin.',
      nextAction: { owner: 'Project owner', action: 'Confirm delay cost per day.' }
    },
    results: buildResults()
  });

  assert.equal(model.decisionCockpitModel.assessmentType, 'project_buyer');
  assert.equal(model.decisionCockpitModel.inputQualityLabel, 'Thin project economics');
  assert.ok(model.decisionCockpitModel.knownValues.some(item => item.label === 'Project spend / budget'));
  assert.ok(model.decisionCockpitModel.unknownHighImpactValues.includes('Delay cost per day'));
  assert.ok(model.decisionCockpitModel.economicsMetrics.some(item => item.value === 'Unknown' || /Not computed/.test(item.value)));
});

test('results cockpit labels seller proxy values and unknown margin', () => {
  const ResultsViewModel = buildViewModel();
  const model = ResultsViewModel.buildResultsRenderModel({
    id: 'a-seller-cockpit',
    assessmentType: 'project_seller',
    scenarioTitle: 'Fixed-price delivery risk',
    buName: 'Commercial',
    geography: 'United Arab Emirates',
    createdAt: Date.now(),
    sellerEconomics: { contractValue: 5000000, contributionMargin: null },
    sellerEconomicsMeta: {
      contractValue: { status: 'known', confidence: 'high', source: 'user' },
      contributionMargin: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    },
    projectExposure: {
      valuationMode: 'benchmark_led',
      projectExposureSummary: 'Seller exposure is linked to margin, LD/SLA, and cost to cure.',
      projectInputQuality: { score: 50, label: 'Partial project economics' },
      financialDrivers: [
        {
          id: 'ld',
          label: 'LD/SLA exposure',
          driverType: 'liquidated_damages',
          driverStatus: 'benchmark_proxy_driver',
          low: 50000,
          likely: 150000,
          high: 350000,
          confidence: 'low'
        }
      ],
      missingInputs: [
        { field: 'contributionMargin', label: 'Expected margin', importance: 'high' }
      ]
    },
    decisionBrief: {
      recommendation: 'Defer until margin and penalty caps are confirmed.',
      decisionPosture: 'defer',
      why: 'Unknown margin can change the seller decision.',
      projectQuantSummary: {
        primaryProjectDriver: 'LD/SLA exposure',
        proxyValuesUsed: ['LD/SLA exposure proxy'],
        unknownHighImpactInputs: ['Expected margin'],
        plainEnglish: 'Seller economics are partial.'
      },
      nextAction: { owner: 'Commercial owner', action: 'Confirm expected margin.' }
    },
    results: buildResults()
  });

  assert.equal(model.decisionCockpitModel.assessmentType, 'project_seller');
  assert.ok(model.decisionCockpitModel.proxyValuesUsed.some(item => /LD\/SLA/.test(item)));
  assert.ok(model.decisionCockpitModel.unknownHighImpactValues.includes('Expected margin'));
  assert.ok(model.decisionCockpitModel.badges.some(item => item.label === 'Proxy values used' && item.value !== 'None'));
});
