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

function loadStep4Harness(draft, options = {}) {
  const aiProductStateSource = fs.readFileSync(path.resolve(__dirname, '../../assets/services/aiProductStateService.js'), 'utf8');
  const step4Source = fs.readFileSync(path.resolve(__dirname, '../../assets/wizard/step4.js'), 'utf8');
  const saves = [];
  const renders = [];
  const toasts = [];
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
      toast(message, tone) {
        toasts.push({ message, tone });
      }
    },
    LLMService: options.llmService || {},
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
    saveDraft() {
      saves.push(JSON.parse(JSON.stringify(context.AppState.draft)));
    },
    __recordStep4Render() {
      renders.push(true);
    },
    renderWizard4() {
      renders.push(true);
    },
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
    ;renderWizard4 = function () { globalThis.__recordStep4Render(); };
    ;globalThis.__step4AiFreshnessTest = {
      buildStep4ParameterCoachFingerprintBreakdown,
      buildStep4EvidenceMapFingerprintBreakdown,
      buildStep4EvidenceMapPayload,
      buildStep4EvidenceRagQueries,
      retrieveStep4EvidenceRagMatches,
      requestStep4EvidenceMap,
      renderStep4ParameterCoachPanel,
      renderStep4EvidenceMapPanel
    };`, context, { filename: 'step4.js' });
  context.__step4HarnessEvents = { saves, renders, toasts };
  return context;
}

function baseDraft(overrides = {}) {
  return {
    id: 'case-123',
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

test('Step 4 Evidence Map retrieves server-side RAG matches before generation', async () => {
  const draft = baseDraft({
    citations: [],
    ragMatches: []
  });
  const searchCalls = [];
  let evidenceMapPayload = null;
  const context = loadStep4Harness(draft, {
    llmService: {
      async searchEvidence(payload) {
        searchCalls.push(payload);
        return {
          ok: true,
          matches: [{
            evidenceId: 'DOC-1',
            documentId: 'DOC-1',
            chunkId: 'DOC-1_CHUNK_001',
            title: 'Supplier implementation contract',
            text: 'The contract does not state the delay cost per day, but it identifies the go-live milestone.',
            score: 0.92,
            metadata: { sourceType: 'uploaded_evidence', fileName: 'contract.pdf' }
          }]
        };
      },
      async generateEvidenceMap(payload) {
        evidenceMapPayload = payload;
        return {
          mode: 'live',
          usedFallback: false,
          aiUnavailable: false,
          generatedAt: '2026-06-10T00:00:00.000Z',
          evidenceMap: {
            unsupportedClaims: [{
              claim: 'Delay cost per day is known.',
              missingEvidence: 'The retrieved contract does not quantify delay cost per day.'
            }],
            citationQuality: {
              strong: [],
              weak: ['Supplier implementation contract'],
              decorative: []
            },
            projectFinancialEvidenceMap: [{
              field: 'delayCostPerDay',
              status: 'not_found',
              evidenceRefs: ['Supplier implementation contract'],
              commentary: 'No delay cost per day found.'
            }]
          }
        };
      }
    }
  });

  await context.__step4AiFreshnessTest.requestStep4EvidenceMap();

  assert.ok(searchCalls.length >= 1);
  assert.equal(searchCalls[0].caseId, 'case-123');
  assert.match(searchCalls[0].query, /Supplier may miss|budget spend delay cost|missing financial evidence/i);
  assert.equal(searchCalls[0].purpose, 'step4_evidence_map');
  assert.equal(evidenceMapPayload.ragMatches[0].title, 'Supplier implementation contract');
  assert.equal(evidenceMapPayload.ragMatches[0].evidenceId, 'DOC-1');
  assert.match(evidenceMapPayload.ragMatches[0].excerpt, /does not state the delay cost per day/i);
  assert.equal(draft.ragMatches[0].evidenceId, 'DOC-1');
  assert.equal(draft.evidenceRagSearch.retainedMatchCount, 1);
  assert.equal(draft.evidenceMap.inputFingerprintBreakdown.categories.evidence.length > 0, true);

  const html = context.__step4AiFreshnessTest.renderStep4EvidenceMapPanel(draft);
  assert.match(html, /1 retrieved/);
  assert.match(html, /Missing project value/);
  assert.match(html, /delayCostPerDay/);
  assert.equal(context.__step4HarnessEvents.saves.length, 1);
  assert.equal(context.__step4HarnessEvents.toasts[0].tone, 'success');
});

test('Step 4 Evidence Map continues when server-side RAG search is unavailable', async () => {
  const draft = baseDraft({
    ragMatches: []
  });
  let generated = false;
  let evidenceMapPayload = null;
  const context = loadStep4Harness(draft, {
    llmService: {
      async searchEvidence() {
        throw new Error('RAG unavailable');
      },
      async generateEvidenceMap(payload) {
        generated = true;
        evidenceMapPayload = payload;
        return {
          mode: 'deterministic_fallback',
          usedFallback: true,
          aiUnavailable: true,
          generatedAt: '2026-06-10T00:00:00.000Z',
          evidenceMap: {
            unsupportedClaims: [{ claim: 'No linked evidence found.' }],
            citationQuality: { strong: [], weak: [], decorative: [] }
          }
        };
      }
    }
  });

  await context.__step4AiFreshnessTest.requestStep4EvidenceMap();

  assert.equal(generated, true);
  assert.equal(Array.isArray(evidenceMapPayload.ragMatches), true);
  assert.equal(evidenceMapPayload.ragMatches.length, 0);
  assert.equal(draft.evidenceRagSearch.errors[0], 'RAG unavailable');
  assert.equal(draft.evidenceMap.usedFallback, true);
});
