'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1ProjectExposureHarness(draft) {
  const files = [
    '../../assets/state/assessmentTypeModel.js',
    '../../assets/services/aiProductStateService.js',
    '../../assets/services/projectExposureService.js',
    '../../assets/services/scenarioTaxonomyProjectionData.js',
    '../../assets/services/scenarioTaxonomyProjection.js',
    '../../assets/wizard/step1.js'
  ];
  const noopStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };
  const context = {
    console,
    Date,
    Intl,
    JSON,
    Math,
    URL,
    Set,
    Map,
    localStorage: noopStorage,
    sessionStorage: noopStorage,
    window: {
      Step1Assist: {},
      clearTimeout() {},
      setTimeout() { return 0; }
    },
    document: {},
    AppState: { draft },
    AuthService: {
      getCurrentUser: () => ({})
    },
    getEffectiveSettings: () => ({
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL']
    }),
    getBUList: () => [{ id: 'g42', name: 'G42', geography: 'United Arab Emirates' }],
    getSelectedRisks: () => [],
    getRiskCandidates: () => [],
    getScenarioGeographies: () => ['United Arab Emirates'],
    formatScenarioGeographies: () => 'United Arab Emirates',
    deriveApplicableRegulations: () => ['UAE PDPL'],
    composeGuidedNarrative: (guidedInput = {}) => String(guidedInput.event || '').trim(),
    escapeHtml: (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;'),
    getDisclosureStateKey: () => '',
    getDisclosureOpenState: () => false,
    UI: { toast() {} },
    saveDraft() {
      context.saved = true;
    },
    markDraftDirty() {
      context.dirty = true;
    },
    scheduleDraftAutosave() {},
    persistAndRenderStep1() {},
    clearScenarioAssistArtifacts: () => {},
    resetStep1RegulationSelectionState: () => {},
    dispatchDraftAction() {},
    normaliseUserProfile: () => ({
      jobTitle: '',
      department: '',
      businessUnit: '',
      workingContext: '',
      focusAreas: []
    }),
    normaliseAssessmentTokens: (text = '') => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    normaliseScenarioSeedText: (text = '') => String(text || '').trim(),
    guessRisksFromText: () => [],
    isNoiseRiskText: () => false,
    replaceSuggestedRiskCandidates: () => {},
    appendRiskCandidates: () => {},
    syncStep1ScenarioTitle: () => {}
  };
  vm.createContext(context);
  files.forEach((relativePath) => {
    const filePath = path.resolve(__dirname, relativePath);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: path.basename(filePath) });
    if (relativePath.includes('assessmentTypeModel.js')) {
      context.AssessmentTypeModel = context.window.AssessmentTypeModel;
      Object.assign(context, context.window.AssessmentTypeModel);
    }
    if (relativePath.includes('aiProductStateService.js')) {
      context.AiProductStateService = context.window.AiProductStateService;
      Object.assign(context, context.window.AiProductStateService);
    }
    if (relativePath.includes('projectExposureService.js')) {
      context.ProjectExposureService = context.window.ProjectExposureService;
      Object.assign(context, context.window.ProjectExposureService);
    }
  });
  return context;
}

function baseDraft(assessmentType) {
  return {
    assessmentType,
    buId: 'g42',
    buName: 'G42',
    geography: 'United Arab Emirates',
    geographies: ['United Arab Emirates'],
    guidedInput: {
      event: 'Supplier may miss the project go-live date.',
      impact: 'Delayed benefit and operational disruption.',
      cause: '',
      asset: '',
      urgency: 'medium'
    },
    projectContext: {
      projectName: 'ERP rollout',
      projectDescription: '',
      projectRole: assessmentType === 'project_seller' ? 'seller' : 'buyer',
      projectStage: 'delivery',
      contractType: '',
      currency: 'USD',
      projectDurationMonths: null,
      criticalMilestoneDate: '',
      strategicImportance: 'unknown'
    },
    projectRouteDetails: {
      supplierName: 'Implementation partner',
      customerName: 'Customer',
      mainConsequence: 'Go-live delay'
    },
    buyerProxyQuestions: {
      mainImpact: 'delay',
      likelyDelay: 'weeks',
      supplierReplacementDifficulty: 'unknown',
      contractualRecoveries: 'unknown',
      moneyPaidCommitted: 'unknown',
      criticalPath: 'yes'
    },
    sellerProxyQuestions: {
      mainImpact: 'margin_erosion',
      expectedMargin: 'unknown',
      penaltiesOrCredits: 'unknown',
      terminationRight: 'unknown',
      extraDeliveryCost: 'unknown',
      commercialModel: 'fixed_price'
    },
    buyerEconomics: {
      delayCostPerDay: null,
      remainingSpend: null,
      reprocurementPremiumPct: null
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided', note: '' }
    },
    sellerEconomics: {
      expectedRevenue: 500000,
      grossMarginPct: null
    },
    sellerEconomicsMeta: {
      expectedRevenue: { status: 'known', confidence: 'high', source: 'user', note: '' },
      grossMarginPct: { status: 'unknown', confidence: 'unknown', source: 'not_provided', note: '' }
    },
    projectExposure: {
      valuationMode: 'benchmark_led',
      projectExposureSummary: '',
      financialDrivers: [],
      capsAndOffsets: [],
      doubleCountingWarnings: [],
      missingInputs: [],
      mapsToRiskParameters: {}
    },
    citations: [],
    step1LlmContext: []
  };
}

test('buyer project exposure panel persists a deterministic preview with sparse economics', () => {
  const context = loadStep1ProjectExposureHarness(baseDraft('project_buyer'));

  const exposure = context.ensureStep1ProjectExposurePreview('buyer', context.AppState.draft, { persist: true });
  const html = context.renderStep1ProjectExposurePanel('buyer', context.AppState.draft);
  const delay = exposure.financialDrivers.find(driver => driver.id === 'buyer-delay-cost');

  assert.equal(context.AppState.draft.projectExposure.inputFingerprint, exposure.inputFingerprint);
  assert.equal(delay.driverStatus, 'unquantified_driver');
  assert.equal(delay.likely, null);
  assert.match(html, /Project financial exposure/);
  assert.match(html, /Unknown/);
  assert.doesNotMatch(html, /\$0/);
  assert.match(html, /data-project-exposure-action="continue"/);
  assert.doesNotMatch(html, /data-project-exposure-action="continue"[^>]*disabled/);
});

test('seller project exposure panel persists missing margin as unknown, not zero', () => {
  const context = loadStep1ProjectExposureHarness(baseDraft('project_seller'));

  const exposure = context.ensureStep1ProjectExposurePreview('seller', context.AppState.draft, { persist: true });
  const html = context.renderStep1ProjectExposurePanel('seller', context.AppState.draft);
  const margin = exposure.financialDrivers.find(driver => driver.id === 'seller-margin-at-risk');

  assert.equal(context.AppState.draft.projectExposure.sourceMode, 'deterministic_preview');
  assert.equal(margin.driverStatus, 'unquantified_driver');
  assert.equal(margin.likely, null);
  assert.ok(exposure.missingInputs.some(input => input.field === 'grossMarginPct'));
  assert.match(html, /margin at risk|Gross margin/i);
  assert.doesNotMatch(html, /\$0/);
});

test('generic enterprise path does not render or build project exposure panel', () => {
  const draft = baseDraft('enterprise_generic');
  draft.projectExposure = {};
  const context = loadStep1ProjectExposureHarness(draft);
  let calls = 0;
  context.ProjectExposureService = {
    ...context.ProjectExposureService,
    buildProjectExposure() {
      calls += 1;
      return {};
    }
  };

  const html = context.renderStep1RouteSpecificInputs(context.AppState.draft);

  assert.equal(calls, 0);
  assert.equal(html.includes('data-project-exposure-panel'), false);
});

test('missing input actions update economics metadata without treating blank as zero', () => {
  const context = loadStep1ProjectExposureHarness(baseDraft('project_buyer'));

  context.setStep1MissingInputMeta('buyer', 'delayCostPerDay', 'not_applicable');
  assert.equal(context.AppState.draft.buyerEconomics.delayCostPerDay, null);
  assert.equal(context.AppState.draft.buyerEconomicsMeta.delayCostPerDay.status, 'not_applicable');

  context.setStep1MissingInputMeta('buyer', 'remainingSpend', 'estimated');
  assert.equal(context.AppState.draft.buyerEconomics.remainingSpend, null);
  assert.equal(context.AppState.draft.buyerEconomicsMeta.remainingSpend.status, 'estimated');
  assert.equal(context.AppState.draft.buyerEconomicsMeta.remainingSpend.confidence, 'low');
});

test('project exposure panel shows smart refresh prompt for stale saved AI map', () => {
  const draft = baseDraft('project_buyer');
  draft.projectExposure = {
    sourceMode: 'live',
    inputFingerprint: 'old-project-fingerprint',
    projectExposureSummary: 'Previous live map.',
    financialDrivers: [{ id: 'delay', label: 'Delay cost', driverStatus: 'unquantified_driver', likely: null }],
    capsAndOffsets: [],
    doubleCountingWarnings: [],
    missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }],
    mapsToRiskParameters: {},
    generatedAt: '2026-06-10T00:00:00.000Z'
  };
  const context = loadStep1ProjectExposureHarness(draft);

  const html = context.renderStep1ProjectExposurePanel('buyer', context.AppState.draft);

  assert.match(html, /Refresh Project exposure map/);
  assert.match(html, /Needs refresh/);
  assert.match(html, /Smart prompt/);
});
