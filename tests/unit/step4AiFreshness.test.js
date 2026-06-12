'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadStep4Harness(draft) {
  const aiProductStateSource = fs.readFileSync(path.resolve(__dirname, '../../assets/services/aiProductStateService.js'), 'utf8');
  const step4Source = fs.readFileSync(path.resolve(__dirname, '../../assets/wizard/step4.js'), 'utf8');
  const context = {
    console,
    Date,
    Intl,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
    window: {},
    document: {
      querySelector() {
        return null;
      }
    },
    AppState: {
      draft,
      step4ParameterCoachLoading: false,
      step4EvidenceMapLoading: false,
      currency: 'USD',
      fxRate: 3.67
    },
    AuthService: { getCurrentUser: () => ({ username: 'tester' }) },
    LearningStore: {
      normaliseStructuredAiFeedbackReason: (_targetType, value) => value || 'other'
    },
    UI: {
      disclosureSection({ title = '', body = '' } = {}) {
        return `<section data-title="${escapeHtml(title)}">${body}</section>`;
      },
      toast() {}
    },
    RiskEngine: {
      validateRunParams() {
        return { valid: true, errors: [], warnings: [], normalizedParams: { iterations: 10000 } };
      }
    },
    getSelectedRisks: () => [],
    getEffectiveSettings: () => ({}),
    getScenarioMultipliers: () => ({ tefMultiplier: 1, lossMultiplier: 1, secondaryMultiplier: 1 }),
    getToleranceThreshold: () => 1000000,
    getWarningThreshold: () => 750000,
    getAnnualReviewThreshold: () => 3000000,
    fmtCurrency: value => `$${Math.round(Number(value || 0)).toLocaleString('en-US')}`,
    escapeHtml,
    saveDraft() {},
    renderWizard4() {},
    ProjectParameterSuggestionService: {
      normaliseValuationMode: (value, fallback) => value || fallback,
      getDefaultValuationMode: (_assessmentType, value) => value || 'hybrid',
      deriveParameterSuggestionsFromProjectExposure: () => []
    }
  };
  vm.createContext(context);
  vm.runInContext(aiProductStateSource, context, { filename: 'aiProductStateService.js' });
  context.AiProductStateService = context.window.AiProductStateService;
  vm.runInContext(`${step4Source}
    ;globalThis.__step4AiFreshnessTest = {
      buildStep4ParameterCoachFingerprintBreakdown,
      buildStep4EvidenceMapFingerprintBreakdown,
      renderStep4ParameterCoachPanel,
      renderStep4EvidenceMapPanel
    };`, context, { filename: 'step4.js' });
  return context;
}

function baseDraft(overrides = {}) {
  return {
    assessmentType: 'project_buyer',
    scenarioTitle: 'Supplier delay',
    narrative: 'Supplier may miss the project go-live date.',
    enhancedNarrative: 'Supplier may miss the project go-live date.',
    buId: 'g42',
    buName: 'G42',
    geography: 'United Arab Emirates',
    applicableRegulations: ['UAE PDPL'],
    projectContext: {
      projectName: 'ERP rollout',
      projectRole: 'buyer',
      projectStage: 'delivery',
      projectDurationMonths: null,
      currency: 'USD'
    },
    projectRouteDetails: {
      supplierName: 'Implementation partner',
      mainConsequence: 'Go-live delay'
    },
    buyerEconomics: {
      approvedBudget: 2000000,
      delayCostPerDay: null
    },
    buyerEconomicsMeta: {
      approvedBudget: { status: 'known', confidence: 'high', source: 'user' },
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' }
    },
    sellerEconomics: {},
    sellerEconomicsMeta: {},
    buyerProxyQuestions: {
      mainImpact: 'delay',
      likelyDelay: 'weeks'
    },
    sellerProxyQuestions: {},
    projectExposure: {
      projectExposureSummary: 'Delay exposure is relevant.',
      financialDrivers: [
        {
          id: 'buyer-delay-cost',
          label: 'Delay cost',
          driverStatus: 'unquantified_driver',
          likely: null
        }
      ],
      missingInputs: [
        { field: 'delayCostPerDay', label: 'Delay cost per day', importance: 'high' }
      ]
    },
    fairParams: {
      biMin: 10000,
      biLikely: 50000,
      biMax: 200000
    },
    citations: ['Contract v1'],
    primaryGrounding: [],
    supportingReferences: [],
    ragMatches: [],
    results: {},
    ...overrides
  };
}

test('Step 4 Parameter Coach is critical-stale after FAIR parameter changes', () => {
  const draft = baseDraft();
  const context = loadStep4Harness(draft);
  const helpers = context.__step4AiFreshnessTest;
  const validation = { valid: true, errors: [], warnings: [] };
  const savedBreakdown = helpers.buildStep4ParameterCoachFingerprintBreakdown(draft, validation);
  draft.parameterCoach = {
    mode: 'live',
    inputFingerprint: savedBreakdown.fingerprint,
    inputFingerprintBreakdown: savedBreakdown,
    generatedAt: '2026-06-10T00:00:00.000Z',
    parameterRationales: [
      {
        id: 'bi',
        parameterKey: 'businessInterruption',
        currentRange: { min: 10000, likely: 50000, max: 200000 },
        suggestedRange: { min: 15000, likely: 80000, max: 260000 },
        suggestionType: 'project_derived_range',
        sourceStatus: 'derived',
        confidence: 'medium',
        rationale: 'Mapped from project delay exposure.'
      }
    ]
  };
  draft.fairParams = {
    ...draft.fairParams,
    biLikely: 90000
  };

  const html = helpers.renderStep4ParameterCoachPanel(draft, validation);

  assert.match(html, /Refresh recommended|Refresh Parameter Coach/);
  assert.match(html, /parameters changed/);
  assert.match(html, /ai-product-state-strip--danger/);
});

test('Step 4 Evidence Map is review-stale after evidence changes without danger tone', () => {
  const draft = baseDraft();
  const context = loadStep4Harness(draft);
  const helpers = context.__step4AiFreshnessTest;
  const savedBreakdown = helpers.buildStep4EvidenceMapFingerprintBreakdown(draft);
  draft.evidenceMap = {
    mode: 'live',
    inputFingerprint: savedBreakdown.fingerprint,
    inputFingerprintBreakdown: savedBreakdown,
    generatedAt: '2026-06-10T00:00:00.000Z',
    supportedClaims: [
      { claim: 'Contract references the project.', supportLevel: 'partial' }
    ],
    citationQuality: {
      strong: ['Contract v1'],
      weak: [],
      decorative: []
    }
  };
  draft.citations = ['Contract v2'];

  const html = helpers.renderStep4EvidenceMapPanel(draft);

  assert.match(html, /Review recommended/);
  assert.match(html, /evidence changed/);
  assert.doesNotMatch(html, /ai-product-state-strip--danger/);
  assert.match(html, /ai-product-state-strip--warning/);
});
