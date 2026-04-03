'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1AssistShortlistHarness() {
  const filePath = path.resolve(__dirname, '../../assets/wizard/step1Assist.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const capturedRequests = [];
  const output = { innerHTML: '' };
  const narrativeInput = {
    value: 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.'
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
        narrative: '',
        sourceNarrative: '',
        enhancedNarrative: '',
        scenarioLens: { key: 'financial', label: 'Financial', functionKey: 'finance' },
        guidedInput: {},
        llmContext: [],
        citations: []
      }
    },
    document: {
      querySelectorAll() {
        return [];
      },
      getElementById(id) {
        if (id === 'intake-risk-statement') return narrativeInput;
        if (id === 'intake-output') return output;
        return null;
      }
    },
    window: {
      DraftScenarioState: {
        applyScenarioShortlistResultToDraft() {
          return [{ title: 'Privileged account takeover through identity compromise' }];
        }
      },
      requestAnimationFrame(callback) {
        callback();
      },
      scrollTo() {},
      setTimeout,
      clearTimeout
    },
    UI: {
      toast() {}
    },
    AuthService: {
      getCurrentUser() {
        return { role: 'user' };
      }
    },
    AiWorkflowClient: null,
    LLMService: {
      async buildManualShortlist(payload) {
        capturedRequests.push(payload);
        return {
          mode: 'live',
          scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
          risks: [{ title: 'Privileged account takeover through identity compromise', confidence: 'high' }]
        };
      }
    },
    RAGService: {
      isReady: () => true
    },
    escapeHtml: (value) => String(value || ''),
    getAiUnavailableMessage: () => 'AI assistance is temporarily unavailable.',
    _setStep1ButtonBusy: () => () => {},
    getEffectiveSettings: () => ({}),
    getBUList: () => [],
    getStep1PreferredScenarioLens: () => ({ key: 'financial', label: 'Financial', functionKey: 'finance' }),
    getStep1ManualPreferredScenarioLens: () => ({ key: 'cyber', label: 'Cyber', functionKey: 'technology' }),
    buildCurrentAIAssistContext: () => ({ businessUnit: null, adminSettings: {} }),
    deriveApplicableRegulations: () => [],
    getSelectedRisks: () => [],
    getScenarioGeographies: () => [],
    formatScenarioGeographies: () => '',
    dispatchDraftAction() {},
    saveDraft() {},
    renderWizard1() {},
    buildEvidenceTrustSummary: null
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step1Assist.js' });

  return {
    generateShortlistFromDraft: context.window.Step1Assist.generateShortlistFromDraft,
    capturedRequests
  };
}

test('manual shortlist generation sends the fresh manual lens hint instead of stale stored lens state', async () => {
  const harness = loadStep1AssistShortlistHarness();

  await harness.generateShortlistFromDraft({
    narrative: 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.'
  });

  assert.equal(harness.capturedRequests.length, 1);
  assert.equal(harness.capturedRequests[0].scenarioLensHint?.key, 'cyber');
  assert.equal(harness.capturedRequests[0].scenarioLensHint?.functionKey, 'technology');
});
