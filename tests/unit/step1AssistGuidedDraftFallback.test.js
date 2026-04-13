'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1AssistHarness() {
  const filePath = path.resolve(__dirname, '../../assets/wizard/step1Assist.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const toasts = [];
  const clearCalls = [];
  const rerenderCalls = [];
  const saveCalls = [];
  const seedCalls = [];
  const refreshCalls = [];
  const retryHandlers = [];

  const fakeBanner = {
    querySelector(selector) {
      if (selector === '#btn-retry-ai') {
        return {
          addEventListener(_event, handler) {
            retryHandlers.push(handler);
          }
        };
      }
      return null;
    }
  };

  const guidedPreview = {
    id: 'guided-preview',
    insertAdjacentHTML() {},
    parentElement: {
      querySelector(selector) {
        return selector === '.ai-unavailable-banner' ? fakeBanner : null;
      }
    },
    nextElementSibling: fakeBanner
  };

  const buildButton = {
    dataset: {},
    textContent: 'Build scenario with AI',
    disabled: false,
    setAttribute() {},
    removeAttribute() {}
  };

  const documentStub = {
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      if (id === 'btn-build-guided-narrative') return buildButton;
      if (id === 'guided-preview') return guidedPreview;
      return null;
    }
  };

  const context = {
    console,
    Date,
    JSON,
    Math,
    URL,
    setTimeout,
    clearTimeout,
    AppState: {
      draft: {
        guidedInput: {
          event: 'Azure global admin credentials found on darkweb',
          asset: '',
          cause: '',
          impact: '',
          urgency: 'high'
        },
        step1Path: 'guided',
        guidedDraftPreview: '',
        guidedDraftSource: '',
        guidedDraftStatus: '',
        aiQualityState: 'fallback',
        narrative: '',
        sourceNarrative: '',
        enhancedNarrative: ''
      }
    },
    document: documentStub,
    window: {
      scheduleStep1ScenarioCrossReferenceRefresh(args) {
        refreshCalls.push(args);
      }
    },
    DraftScenarioState: {},
    UI: {
      toast(message, tone, duration) {
        toasts.push({ message, tone, duration });
      }
    },
    AuthService: {
      getCurrentUser() {
        return { role: 'user' };
      }
    },
    LLMService: {
      async buildGuidedScenarioDraft() {
        const error = new Error('AI assistance is temporarily unavailable.');
        error.code = 'LLM_UNAVAILABLE';
        throw error;
      }
    },
    RAGService: {
      isReady: () => true,
      retrieveRelevantDocs: async () => []
    },
    escapeHtml: (value) => String(value || ''),
    composeStep1GuidedNarrative: () => 'Local guided draft preview',
    _setStep1ButtonBusy: () => () => {},
    getEffectiveSettings: () => ({}),
    getBUList: () => [],
    getStep1PreferredScenarioLens: () => ({ key: 'cyber', label: 'Cyber', functionKey: 'technology' }),
    buildCurrentAIAssistContext: () => ({ businessUnit: null, adminSettings: {} }),
    buildAssessmentRetrievalQuery: () => 'query',
    deriveApplicableRegulations: () => [],
    getSelectedRisks: () => [],
    getScenarioGeographies: () => [],
    formatScenarioGeographies: () => '',
    clearStep1StaleAssistState(nextNarrative, options) {
      clearCalls.push({ nextNarrative, options });
    },
    saveDraft() {
      saveCalls.push(true);
    },
    renderWizard1() {
      rerenderCalls.push(true);
    },
    seedRisksFromScenarioDraft() {
      seedCalls.push(true);
      return 2;
    },
    dispatchDraftAction() {},
    buildEvidenceTrustSummary: null
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step1Assist.js' });

  return {
    buildGuidedScenarioDraft: context.window.Step1Assist.buildGuidedScenarioDraft,
    appState: context.AppState,
    toasts,
    clearCalls,
    rerenderCalls,
    saveCalls,
    seedCalls,
    refreshCalls,
    retryHandlers
  };
}

test('guided draft server failure keeps Step 1 in manual mode instead of building a local fallback draft', async () => {
  const harness = loadStep1AssistHarness();

  await harness.buildGuidedScenarioDraft();

  assert.equal(harness.clearCalls.length, 1);
  assert.equal(harness.clearCalls[0].nextNarrative, 'Local guided draft preview');
  assert.equal(harness.clearCalls[0].options?.clearGeneratedRisks, true);
  assert.equal(harness.seedCalls.length, 0);
  assert.equal(harness.appState.draft.guidedDraftPreview, '');
  assert.equal(harness.appState.draft.guidedDraftSource, '');
  assert.equal(harness.appState.draft.guidedDraftStatus, '');
  assert.equal(harness.appState.draft.aiQualityState, '');
  assert.equal(harness.appState.draft.narrative, '');
  assert.equal(harness.appState.draft.sourceNarrative, '');
  assert.equal(harness.appState.draft.enhancedNarrative, '');
  assert.equal(harness.saveCalls.length, 1);
  assert.equal(harness.rerenderCalls.length, 1);
  assert.equal(harness.refreshCalls.length, 2);
  assert.equal(harness.retryHandlers.length, 1);
  assert.deepEqual(harness.toasts, [
    {
      message: 'AI draft generation is unavailable right now. Continue manually or try again.',
      tone: 'warning',
      duration: 5000
    }
  ]);
});
