'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1Internals() {
  const filePath = path.resolve(__dirname, '../../assets/wizard/step1.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const noopStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };

  const context = {
    console,
    Date,
    JSON,
    Math,
    URL,
    Set,
    Map,
    localStorage: noopStorage,
    sessionStorage: noopStorage,
    window: { Step1Assist: {} },
    document: {},
    AppState: { draft: {} },
    AuthService: {
      getCurrentUser: () => ({})
    },
    getEffectiveSettings: () => ({}),
    normaliseUserProfile: () => ({
      jobTitle: '',
      department: '',
      businessUnit: '',
      workingContext: '',
      focusAreas: []
    }),
    getSelectedRisks: () => [],
    getRiskCandidates: () => [],
    getScenarioGeographies: () => [],
    getBUList: () => [],
    composeGuidedNarrative: (guidedInput = {}, { lensLabel = '' } = {}) => `${lensLabel || 'Scenario'} preview: ${String(guidedInput.event || '').trim()}`.trim(),
    escapeHtml: (value) => String(value || ''),
    getDisclosureStateKey: () => '',
    getDisclosureOpenState: () => false,
    UI: {},
    saveDraft: () => {},
    markDraftDirty: () => {},
    persistAndRenderStep1: () => {},
    normaliseAssessmentTokens: (text = '') => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step1.js' });
  return {
    inferStep1FunctionKeyFromText: context.inferStep1FunctionKeyFromText,
    getStep1PreferredScenarioLens: context.getStep1PreferredScenarioLens,
    getStep1GuidedPreviewSignature: context.getStep1GuidedPreviewSignature,
    rememberStep1LivePreview: context.rememberStep1LivePreview,
    getStep1DisplayedGuidedPreviewModel: context.getStep1DisplayedGuidedPreviewModel,
    buildStep1GuidedPromptSuggestions: context.buildStep1GuidedPromptSuggestions
  };
}

test('CEO mailbox hijack stays in the identity/cyber prompt lane', () => {
  const internals = loadStep1Internals();
  const functionKey = internals.inferStep1FunctionKeyFromText('CEO email account hijacked');
  assert.equal(functionKey, 'technology');

  const suggestions = internals.buildStep1GuidedPromptSuggestions({
    guidedInput: {
      event: 'CEO email account hijacked',
      asset: '',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Contract cover gap', event: 'A contract gap emerges.', functionKey: 'procurement' },
      { promptLabel: 'Single-source shortfall', event: 'A single source fails.', functionKey: 'procurement' },
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' }
    ]
  });

  const labels = suggestions.map(item => item.label);
  assert.ok(labels.includes('Identity takeover'));
  assert.ok(labels.includes('Executive mailbox compromise'));
  assert.equal(labels.includes('Contract cover gap'), false);
  assert.equal(labels.includes('Single-source shortfall'), false);
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('dark-web Azure admin credential discovery does not leak AI-model prompt ideas', () => {
  const internals = loadStep1Internals();
  const suggestions = internals.buildStep1GuidedPromptSuggestions({
    guidedInput: {
      event: 'An Azure admin account credential were found on the darkweb',
      asset: '',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' }
    ]
  });

  const labels = suggestions.map(item => item.label);
  assert.ok(labels.includes('Privileged credential exposure'));
  assert.ok(labels.includes('Admin account takeover'));
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('dark-web Azure global admin credential misuse stays in the technology/cyber lane', () => {
  const internals = loadStep1Internals();
  const event = 'Azure global admin credentials discovered on the dark web are actively used to log into the tenant, escalate privileges, and modify critical configurations across G42\'s environment.';
  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'technology');

  const lens = internals.getStep1PreferredScenarioLens({}, {
    guidedInput: {
      event,
      asset: '',
      cause: '',
      impact: ''
    },
    scenarioLens: null
  }, event);

  assert.equal(lens.key, 'cyber');
  assert.equal(lens.functionKey, 'technology');
});

test('displayed guided preview prefers the live AI-checked preview for the current signature', () => {
  const internals = loadStep1Internals();
  const draft = {
    step1Path: 'guided',
    buId: 'g42',
    scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
    guidedInput: {
      event: 'CEO email account hijacked',
      asset: '',
      cause: '',
      impact: '',
      urgency: 'high'
    },
    guidedDraftPreview: '',
    guidedDraftSource: '',
    guidedDraftStatus: ''
  };
  const signature = internals.getStep1GuidedPreviewSignature(draft);
  internals.rememberStep1LivePreview(
    signature,
    'AI-checked preview: A senior executive mailbox is compromised and used to manipulate approvals.',
    'AI-checked preview using the current function context, geography, regulations, and retrieved references.',
    'ai'
  );

  const preview = internals.getStep1DisplayedGuidedPreviewModel(draft);
  assert.equal(preview.preview, 'AI-checked preview: A senior executive mailbox is compromised and used to manipulate approvals.');
  assert.equal(preview.source, 'ai');
});
