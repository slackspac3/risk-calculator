'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1AssistPromptIdeaHarness({ suggestGuidedPromptIdeasImpl }) {
  const filePath = path.resolve(__dirname, '../../assets/wizard/step1Assist.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const capturedRequests = [];

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
        buId: 'bu-1',
        llmContext: [],
        step1ConversationFingerprint: ''
      }
    },
    document: {
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      }
    },
    window: {},
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
      async suggestGuidedPromptIdeas(payload) {
        capturedRequests.push(payload);
        return suggestGuidedPromptIdeasImpl(payload);
      }
    },
    getBUList: () => [{ id: 'bu-1', name: 'Technology' }],
    buildCurrentAIAssistContext: ({ buId } = {}) => ({
      businessUnit: buId ? { id: buId, name: 'Technology' } : null,
      adminSettings: {}
    }),
    getScenarioGeographies: () => ['UAE'],
    formatScenarioGeographies: (items = []) => Array.isArray(items) ? items.join(', ') : '',
    escapeHtml: (value) => String(value || ''),
    getAiUnavailableMessage: () => 'AI assistance is temporarily unavailable.',
    buildEvidenceTrustSummary: null
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step1Assist.js' });

  return {
    suggestGuidedPromptIdeas: context.window.Step1Assist.suggestGuidedPromptIdeas,
    capturedRequests
  };
}

test('guided prompt ideas use the live helper path when it returns a live result', async () => {
  const harness = loadStep1AssistPromptIdeaHarness({
    suggestGuidedPromptIdeasImpl: async () => ({
      ideas: [{ label: 'AI suggestion', prompt: 'A live AI prompt idea.' }],
      recommendedLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
      confidence: 'high',
      why: 'The wording is anchored to privileged identity compromise.',
      usedFallback: false,
      aiUnavailable: false,
      source: 'ai'
    })
  });

  const result = await harness.suggestGuidedPromptIdeas({
    buId: 'bu-1',
    riskStatement: 'Azure global admin credentials found on the dark web',
    guidedInput: {
      event: 'Azure global admin credentials found on the dark web',
      impact: 'Privilege abuse across critical systems'
    },
    scenarioLensHint: { key: 'cyber', functionKey: 'technology' },
    fallbackSuggestions: [{ label: 'Local suggestion', prompt: 'A local prompt idea.' }]
  });

  assert.equal(harness.capturedRequests.length, 1);
  assert.equal(harness.capturedRequests[0].businessUnit?.id, 'bu-1');
  assert.equal(harness.capturedRequests[0].traceLabel, 'Step 1 prompt ideas');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ideas: [{ label: 'AI suggestion', prompt: 'A live AI prompt idea.' }],
    recommendedLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
    confidence: 'high',
    why: 'The wording is anchored to privileged identity compromise.',
    usedFallback: false,
    aiUnavailable: false,
    source: 'ai'
  });
});

test('guided prompt ideas fall back locally when the live helper path is unavailable', async () => {
  const harness = loadStep1AssistPromptIdeaHarness({
    suggestGuidedPromptIdeasImpl: async () => {
      const error = new Error('AI assistance is temporarily unavailable.');
      error.code = 'LLM_UNAVAILABLE';
      throw error;
    }
  });

  const fallbackSuggestions = [{ label: 'Local suggestion', prompt: 'A local prompt idea.' }];
  const result = await harness.suggestGuidedPromptIdeas({
    buId: 'bu-1',
    riskStatement: 'Azure global admin credentials found on the dark web',
    guidedInput: {
      event: 'Azure global admin credentials found on the dark web'
    },
    scenarioLensHint: { key: 'cyber', functionKey: 'technology' },
    fallbackSuggestions
  });

  assert.equal(harness.capturedRequests.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ideas: fallbackSuggestions,
    usedFallback: true,
    aiUnavailable: true,
    source: 'fallback'
  });
});
