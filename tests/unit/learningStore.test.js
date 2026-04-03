'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

global.localStorage = createStorage();
const LearningStore = require('../../assets/state/learningStore.js');

test.beforeEach(() => {
  global.localStorage.clear();
});

test('recordAiFeedback stores bounded structured events and builds a profile from live AI signals', () => {
  LearningStore.recordAiFeedback('alex', {
    target: 'shortlist',
    score: 2,
    runtimeMode: 'live_ai',
    buId: 'corp-fin',
    functionKey: 'finance',
    lensKey: 'financial',
    reasons: ['wrong-domain', 'included unrelated risks'],
    shownRiskTitles: ['Counterparty default and bad-debt exposure', 'Privileged account takeover'],
    keptRiskTitles: ['Counterparty default and bad-debt exposure'],
    removedRiskTitles: ['Privileged account takeover'],
    citations: [{ docId: 'doc-fin-1', tags: ['financial', 'collections'] }],
    submittedBy: 'alex'
  });
  LearningStore.recordAiFeedback('alex', {
    target: 'shortlist',
    score: 5,
    runtimeMode: 'live_ai',
    buId: 'corp-fin',
    functionKey: 'finance',
    lensKey: 'financial',
    reasons: ['useful-with-edits'],
    shownRiskTitles: ['Counterparty default and bad-debt exposure', 'Receivables recovery shortfall'],
    keptRiskTitles: ['Counterparty default and bad-debt exposure', 'Receivables recovery shortfall'],
    citations: [{ docId: 'doc-fin-1', tags: ['financial'] }],
    submittedBy: 'alex'
  });
  LearningStore.recordAiFeedback('alex', {
    target: 'draft',
    score: 1,
    runtimeMode: 'fallback',
    buId: 'corp-fin',
    functionKey: 'finance',
    lensKey: 'financial',
    reasons: ['too-generic'],
    submittedBy: 'alex'
  });

  const profile = LearningStore.getAiFeedbackProfile('alex', {
    buId: 'corp-fin',
    functionKey: 'finance',
    lensKey: 'financial'
  });

  assert.equal(profile.totalEvents, 3);
  assert.equal(profile.liveAiEvents, 2);
  assert.equal(profile.shortlist.count, 2);
  assert.equal(profile.runtimeCounts.fallback, 1);
  assert.equal(profile.wrongDomainCount, 1);
  assert.equal(profile.unrelatedRiskCount, 1);
  assert.ok(profile.topPositiveRisks.some(item => item.title === 'Counterparty default and bad-debt exposure'));
  assert.ok(profile.topNegativeRisks.some(item => item.title === 'Privileged account takeover'));
  assert.ok(profile.topPositiveDocs.some(item => item.docId === 'doc-fin-1'));
});

test('recordAiFeedback captures per-risk star ratings and feeds explicit risk weights', () => {
  LearningStore.recordAiFeedback('alex', {
    target: 'risk',
    score: 5,
    runtimeMode: 'live_ai',
    buId: 'corp-ops',
    functionKey: 'operations',
    lensKey: 'operational',
    riskId: 'risk-ops-1',
    riskTitle: 'Business continuity and recovery failure',
    riskCategory: 'Business Continuity',
    riskSource: 'ai',
    selectedInAssessment: true,
    submittedBy: 'alex'
  });
  LearningStore.recordAiFeedback('alex', {
    target: 'risk',
    score: 1,
    runtimeMode: 'live_ai',
    buId: 'corp-ops',
    functionKey: 'operations',
    lensKey: 'operational',
    riskId: 'risk-ops-2',
    riskTitle: 'Cyber compromise of critical platforms or data',
    riskCategory: 'Cyber',
    riskSource: 'ai',
    selectedInAssessment: false,
    submittedBy: 'alex'
  });

  const profile = LearningStore.getAiFeedbackProfile('alex', {
    buId: 'corp-ops',
    functionKey: 'operations',
    lensKey: 'operational'
  });

  assert.equal(profile.totalEvents, 2);
  assert.equal(profile.liveAiEvents, 2);
  assert.equal(profile.risk.count, 2);
  assert.equal(profile.risk.averageScore, 3);
  assert.ok(profile.topPositiveRisks.some(item => item.title === 'Business continuity and recovery failure'));
  assert.ok(profile.topNegativeRisks.some(item => item.title === 'Cyber compromise of critical platforms or data'));
});

test('recordRiskDecision preserves removal reason as analyst-only context', () => {
  LearningStore.recordRiskDecision('alex', {
    action: 'remove',
    buId: 'corp-tech',
    functionKey: 'technology',
    lensKey: 'cyber',
    riskTitle: 'Operational breakdown affecting core services',
    riskCategory: 'Operational',
    source: 'ai',
    reason: 'narrower scope',
    scenarioFingerprint: 'corp-tech | cyber | Azure global admin credentials discovered on darkweb'
  });

  const store = LearningStore.getLearningStore('alex');
  assert.equal(store.analystSignals.removedRisks.length, 1);
  assert.equal(store.analystSignals.removedRisks[0].reason, 'narrower-scope');
  assert.match(store.analystSignals.removedRisks[0].scenarioFingerprint, /Azure global admin credentials/i);
});
