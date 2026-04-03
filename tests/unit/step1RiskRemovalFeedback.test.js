'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1RemovalHarness() {
  const filePath = path.resolve(__dirname, '../../assets/wizard/step1.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const feedbackEvents = [];
  const riskDecisions = [];
  const sharedFeedbackEvents = [];
  const patchCalls = [];
  const persistCalls = [];
  const toastCalls = [];

  const noopStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };

  const appState = {
    draft: {
      buId: 'corp-tech',
      buName: 'Technology',
      aiQualityState: 'ai',
      scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
      guidedInput: {
        event: 'Azure global admin credentials discovered on darkweb',
        cause: 'Credential exposure',
        impact: 'Privileged access misuse'
      },
      enhancedNarrative: 'Privileged credentials are exposed and could be used to compromise the tenant.',
      selectedRiskIds: ['risk-1'],
      riskCandidates: [
        {
          id: 'risk-1',
          title: 'Privileged account takeover through identity platform compromise',
          category: 'Identity & Access',
          description: 'Compromised Azure AD or Entra credentials could let an attacker take over privileged identities.',
          source: 'ai'
        },
        {
          id: 'risk-2',
          title: 'Operational breakdown affecting core services',
          category: 'Operational',
          description: 'A broad service disruption follows.',
          source: 'ai'
        }
      ],
      aiFeedback: {}
    }
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
    document: {
      querySelectorAll() { return []; },
      querySelector() { return null; },
      getElementById() { return null; }
    },
    AppState: appState,
    AuthService: {
      getCurrentUser: () => ({ username: 'alex' })
    },
    LearningStore: {
      recordRiskDecision(_username, payload) {
        riskDecisions.push({ ...payload });
        return payload;
      },
      recordAiFeedback(_username, payload) {
        feedbackEvents.push({ ...payload });
        return payload;
      },
      getLearningStore() {
        return { aiFeedback: { events: feedbackEvents.slice() } };
      }
    },
    OrgIntelligenceService: {
      async recordAiFeedback(payload) {
        sharedFeedbackEvents.push({ ...payload });
        return true;
      }
    },
    UI: {
      toast(message, tone, duration) {
        toastCalls.push({ message, tone, duration });
      }
    },
    patchLearningStore(update) {
      patchCalls.push(update);
    },
    saveDraft() {},
    markDraftDirty() {},
    persistAndRenderStep1(args) {
      persistCalls.push(args);
    },
    syncRiskSelection() {},
    getRiskCandidates: () => appState.draft.riskCandidates,
    getSelectedRisks: () => appState.draft.riskCandidates.filter((risk) => appState.draft.selectedRiskIds.includes(risk.id)),
    getScenarioGeographies: () => ['United Arab Emirates'],
    getBUList: () => [{ id: 'corp-tech', name: 'Technology' }],
    getEffectiveSettings: () => ({}),
    normaliseUserProfile: () => ({
      jobTitle: '',
      department: '',
      businessUnit: '',
      workingContext: '',
      focusAreas: []
    }),
    composeGuidedNarrative: () => '',
    escapeHtml: (value) => String(value || ''),
    getDisclosureStateKey: () => '',
    getDisclosureOpenState: () => false,
    normaliseAssessmentTokens: (text = '') => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'step1.js' });
  context.persistAndRenderStep1 = (args) => {
    persistCalls.push(args);
  };
  context.syncRiskSelection = () => {};

  return {
    applyStep1RiskRemoval: context.applyStep1RiskRemoval,
    shouldRecordStep1RiskRemovalAsAiFeedback: context.shouldRecordStep1RiskRemovalAsAiFeedback,
    appState,
    riskDecisions,
    feedbackEvents,
    sharedFeedbackEvents,
    patchCalls,
    persistCalls,
    toastCalls
  };
}

test('incorrect-risk removal records analyst context and AI feedback before removing the risk', async () => {
  const harness = loadStep1RemovalHarness();

  const removed = await harness.applyStep1RiskRemoval('risk-1', 'incorrect-risk', {
    buList: [{ id: 'corp-tech', name: 'Technology' }],
    scenarioGeographies: ['United Arab Emirates']
  });

  assert.equal(removed, true);
  assert.equal(harness.riskDecisions.length, 1);
  assert.equal(harness.riskDecisions[0].action, 'remove');
  assert.equal(harness.riskDecisions[0].reason, 'incorrect-risk');
  assert.equal(harness.feedbackEvents.length, 1);
  assert.equal(harness.sharedFeedbackEvents.length, 1);
  assert.equal(harness.feedbackEvents[0].target, 'risk');
  assert.equal(harness.feedbackEvents[0].score, 1);
  assert.deepEqual(Array.from(harness.feedbackEvents[0].reasons || []), ['included-unrelated-risks']);
  assert.equal(harness.feedbackEvents[0].riskTitle, 'Privileged account takeover through identity platform compromise');
  assert.equal(harness.appState.draft.riskCandidates.some((risk) => risk.id === 'risk-1'), false);
  assert.equal(harness.appState.draft.selectedRiskIds.includes('risk-1'), false);
  assert.equal(harness.patchCalls.length, 1);
  assert.equal(harness.persistCalls.length, 1);
  assert.match(harness.toastCalls[0].message, /incorrect AI output/i);
});

test('scope-narrowing removal stays out of AI feedback and only records analyst context', async () => {
  const harness = loadStep1RemovalHarness();

  const removed = await harness.applyStep1RiskRemoval('risk-1', 'narrower-scope', {
    buList: [{ id: 'corp-tech', name: 'Technology' }],
    scenarioGeographies: ['United Arab Emirates']
  });

  assert.equal(removed, true);
  assert.equal(harness.shouldRecordStep1RiskRemovalAsAiFeedback('narrower-scope'), false);
  assert.equal(harness.riskDecisions.length, 1);
  assert.equal(harness.riskDecisions[0].reason, 'narrower-scope');
  assert.equal(harness.feedbackEvents.length, 0);
  assert.equal(harness.sharedFeedbackEvents.length, 0);
  assert.equal(harness.patchCalls.length, 0);
  assert.equal(harness.persistCalls.length, 1);
  assert.match(harness.toastCalls[0].message, /scope narrowing/i);
});
