'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep2Runtime(draft = {}) {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../assets/wizard/step2.js'),
    'utf8'
  );
  const context = {
    console,
    Date,
    JSON,
    Math,
    AppState: { draft: { ...draft } },
    getStructuredScenarioField() {
      return '';
    },
    getSelectedRisks() {
      return [];
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step2.js' });
  return context;
}

function loadStep3Runtime(draft = {}) {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../assets/wizard/step3.js'),
    'utf8'
  );
  const context = {
    console,
    Date,
    JSON,
    Math,
    AppState: { draft: { ...draft } }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step3.js' });
  return context;
}

test('step 2 prior messages ignore legacy shared context and stale fingerprints', () => {
  const context = loadStep2Runtime({
    id: 'a_step2',
    narrative: 'Legacy scenario narrative',
    scenarioLens: { key: 'cyber' },
    llmContext: [{ role: 'user', content: 'Legacy shared wizard context.' }],
    step2LlmContext: [{ role: 'assistant', content: 'Prior step 2 reply.' }],
    step2ConversationFingerprint: 'stale fingerprint'
  });

  const freshFingerprint = context.buildStep2ConversationFingerprint({
    narrative: 'Fresh scenario narrative',
    draft: context.AppState.draft
  });

  assert.deepEqual(
    Array.from(context.getStep2PriorMessages({ conversationFingerprint: freshFingerprint })),
    []
  );

  context.AppState.draft.step2ConversationFingerprint = freshFingerprint;
  assert.deepEqual(
    Array.from(context.getStep2PriorMessages({ conversationFingerprint: freshFingerprint })),
    [{ role: 'assistant', content: 'Prior step 2 reply.' }]
  );
});

test('step 3 prior messages stay isolated from earlier wizard steps', () => {
  const context = loadStep3Runtime({
    id: 'a_step3',
    scenarioTitle: 'Vendor access misuse',
    scenarioLens: { key: 'third-party' },
    llmContext: [{ role: 'user', content: 'Shared legacy wizard context.' }],
    step3LlmContext: [{ role: 'assistant', content: 'Prior step 3 treatment reply.' }],
    step3ConversationFingerprint: 'baseline-1 | request-1'
  });

  const freshFingerprint = context.buildStep3ConversationFingerprint({
    draft: context.AppState.draft,
    baselineAssessment: { id: 'baseline-2' },
    request: 'Reduce blast radius and remove dormant access.'
  });

  assert.deepEqual(
    Array.from(context.getStep3PriorMessages({ conversationFingerprint: freshFingerprint })),
    []
  );

  context.AppState.draft.step3ConversationFingerprint = freshFingerprint;
  assert.deepEqual(
    Array.from(context.getStep3PriorMessages({ conversationFingerprint: freshFingerprint })),
    [{ role: 'assistant', content: 'Prior step 3 treatment reply.' }]
  );
});
