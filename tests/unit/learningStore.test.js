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

test('recordStructuredAiFeedback normalises taxonomies and preserves sparse project correction metadata', () => {
  const saved = LearningStore.recordStructuredAiFeedback('alex', {
    eventType: 'project_missing_value_provided',
    targetType: 'project_exposure',
    targetId: 'delayCostPerDay',
    reasonCode: 'known_value_added',
    note: 'Delay cost provided after initial unknown.',
    before: { field: 'delayCostPerDay', value: null, status: 'unknown' },
    after: { field: 'delayCostPerDay', value: 0, status: 'known' },
    assessmentType: 'project_buyer',
    scenarioLens: { key: 'third-party', functionKey: 'procurement' },
    primaryFamily: 'Procurement',
    projectExposureRefs: ['delayCostPerDay', 'delayCostPerDay'],
    sourceStatusBefore: 'unknown',
    sourceStatusAfter: 'known',
    submittedBy: 'alex'
  });

  assert.equal(saved.reasonCode, 'known_value_added');
  assert.equal(saved.assessmentType, 'project_buyer');
  assert.equal(saved.sourceStatusBefore, 'unknown');
  assert.equal(saved.sourceStatusAfter, 'known');
  assert.equal(saved.after.value, 0);
  assert.deepEqual(saved.projectExposureRefs, ['delayCostPerDay']);

  const fallback = LearningStore.recordStructuredAiFeedback('alex', {
    eventType: 'decision_brief_regenerated',
    targetType: 'decision_brief',
    reasonCode: 'known_value_added',
    sourceStatusBefore: 'not_provided',
    sourceStatusAfter: 'evidence_supported'
  });

  assert.equal(fallback.reasonCode, 'other');
  assert.equal(fallback.sourceStatusBefore, 'unknown');
  assert.equal(fallback.sourceStatusAfter, 'evidence_supported');

  const events = LearningStore.getStructuredAiFeedbackEvents('alex', {
    assessmentType: 'project_buyer'
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].targetType, 'project_exposure');

  const normalisedOnly = LearningStore.recordStructuredAiFeedback({
    targetType: 'project_exposure',
    reasonCode: 'not_a_reason',
    after: { value: 0 }
  });
  assert.equal(normalisedOnly.reasonCode, 'other');
  assert.equal(normalisedOnly.after.value, 0);
});

test('buildCaseMemoryFromAssessment creates generic enterprise memory safely', () => {
  const memory = LearningStore.buildCaseMemoryFromAssessment({
    id: 'generic-1',
    scenarioTitle: 'Payroll platform outage',
    assessmentType: 'enterprise_generic',
    scenarioLens: { key: 'operational', functionKey: 'operations', label: 'Operational' },
    structuredScenario: {
      assetService: 'Payroll platform',
      eventPath: 'Business continuity failure',
      primaryDriver: 'Business interruption'
    },
    fairParams: {
      eventFreqLikely: 1.2,
      businessInterruptionLikely: 250000
    },
    missingInformation: ['Recovery time evidence'],
    recommendations: [{ title: 'Test payroll recovery plan' }],
    results: { nearTolerance: true },
    completedAt: 1000
  });

  assert.equal(memory.caseId, 'generic-1');
  assert.equal(memory.assessmentType, 'enterprise_generic');
  assert.equal(memory.primaryFamily, 'operations');
  assert.equal(memory.assetService, 'Payroll platform');
  assert.equal(memory.eventPath, 'Business continuity failure');
  assert.equal(memory.decisionPosture, 'proceed_with_controls');
  assert.deepEqual(memory.evidenceGaps, ['Recovery time evidence']);
  assert.deepEqual(memory.treatments, ['Test payroll recovery plan']);
  assert.equal(memory.parameterSummary.topLossDriver, 'Business interruption');
});

test('buildCaseMemoryFromAssessment preserves buyer project proxy and unknown values', () => {
  const memory = LearningStore.buildCaseMemoryFromAssessment({
    id: 'buyer-1',
    scenarioTitle: 'ERP implementation supplier delay',
    assessmentType: 'project_buyer',
    scenarioLens: { key: 'third-party', functionKey: 'procurement' },
    projectContext: {
      projectRole: 'buyer',
      projectStage: 'implementation'
    },
    structuredScenario: {
      assetService: 'ERP implementation',
      eventPath: 'Supplier delivery failure'
    },
    buyerEconomics: {
      expectedSpend: 0,
      delayCostPerDay: null
    },
    buyerEconomicsMeta: {
      expectedSpend: { status: 'estimated' },
      delayCostPerDay: { status: 'unknown' }
    },
    projectExposure: {
      projectExposureSummary: 'Delay and reprocurement exposure are relevant but sparse.',
      projectInputQuality: {
        unknownHighImpactInputs: ['Delay cost per day']
      },
      financialDrivers: [{
        id: 'delay_proxy',
        label: 'Delay cost benchmark proxy',
        driverStatus: 'benchmark_proxy_driver',
        confidence: 'low'
      }],
      missingInputs: [{
        field: 'delayCostPerDay',
        label: 'Delay cost per day'
      }]
    },
    completedAt: 2000
  });

  assert.equal(memory.assessmentType, 'project_buyer');
  assert.equal(memory.projectRole, 'buyer');
  assert.equal(memory.projectStage, 'implementation');
  assert.equal(memory.projectValueSourceStatus, 'estimated');
  assert.equal(memory.projectValueSourceLabel, 'estimated');
  assert.equal(memory.proxyValuesUsed[0].sourceStatus, 'benchmark_proxy');
  assert.equal(memory.proxyValuesUsed[0].reusableLabel, 'benchmark proxy');
  assert.equal(memory.unknownsCarriedForward.some(item => item.label === 'Delay cost per day'), true);
  assert.equal(memory.unknownsCarriedForward.find(item => item.label === 'Delay cost per day').reusable, false);
});

test('buildCaseMemoryFromAssessment preserves seller margin unknowns as not reusable facts', () => {
  const memory = LearningStore.buildCaseMemoryFromAssessment({
    id: 'seller-1',
    scenarioTitle: 'Managed services SLA breach',
    assessmentType: 'project_seller',
    scenarioLens: { key: 'legal-contract', functionKey: 'compliance' },
    projectContext: {
      projectRole: 'seller',
      projectStage: 'delivery'
    },
    sellerEconomics: {
      contractValue: 500000,
      grossMarginPct: null
    },
    sellerEconomicsMeta: {
      contractValue: { status: 'known' },
      grossMarginPct: { status: 'unknown' }
    },
    projectExposure: {
      projectInputQuality: {
        unknownHighImpactInputs: ['Gross margin percentage']
      },
      financialDrivers: [{
        id: 'margin_at_risk',
        label: 'Margin at risk',
        driverStatus: 'unquantified_driver'
      }]
    },
    decisionBrief: {
      projectQuantSummary: {
        unknownHighImpactInputs: ['Gross margin percentage']
      }
    },
    completedAt: 3000
  });

  assert.equal(memory.assessmentType, 'project_seller');
  assert.equal(memory.projectValueSourceStatus, 'known');
  assert.equal(memory.projectValueSourceLabel, 'confirmed');
  assert.equal(memory.marginSourceStatus, 'unknown');
  assert.equal(memory.marginSourceLabel, 'unknown / not reusable');
  assert.equal(memory.unknownsCarriedForward.some(item => item.label === 'Gross margin percentage'), true);
});

test('findSimilarCaseMemories ranks deterministic matches and keeps unknowns labelled', () => {
  const seed = LearningStore.buildCaseMemoryFromAssessment({
    id: 'draft-seed',
    scenarioTitle: 'ERP supplier misses go-live',
    assessmentType: 'project_buyer',
    scenarioLens: { key: 'third-party', functionKey: 'procurement' },
    projectContext: { projectRole: 'buyer', projectStage: 'implementation' },
    structuredScenario: {
      assetService: 'ERP supplier',
      eventPath: 'Supplier delivery delay'
    }
  });
  const close = LearningStore.buildCaseMemoryFromAssessment({
    id: 'close',
    scenarioTitle: 'ERP supplier delivery delay',
    assessmentType: 'project_buyer',
    scenarioLens: { key: 'third-party', functionKey: 'procurement' },
    projectContext: { projectRole: 'buyer', projectStage: 'implementation' },
    structuredScenario: {
      assetService: 'ERP supplier',
      eventPath: 'Supplier delivery delay'
    },
    buyerEconomicsMeta: {
      expectedSpend: { status: 'benchmark_proxy' }
    },
    buyerEconomics: {
      expectedSpend: 1000000
    },
    projectExposure: {
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }]
    },
    completedAt: Date.now()
  });
  const far = LearningStore.buildCaseMemoryFromAssessment({
    id: 'far',
    scenarioTitle: 'Privacy filing issue',
    assessmentType: 'enterprise_generic',
    scenarioLens: { key: 'data-governance', functionKey: 'compliance' },
    structuredScenario: {
      assetService: 'Privacy notice',
      eventPath: 'Regulatory breach'
    },
    completedAt: Date.now()
  });

  const matches = LearningStore.findSimilarCaseMemories(seed, [far, close], { limit: 2 });
  assert.equal(matches[0].caseId, 'close');
  assert.equal(matches[0].projectValueSourceLabel, 'benchmark proxy');
  assert.equal(matches[0]._caseMemory.reusableValues.sourceStatuses[0].reusable, false);
});

test('case memory persistence normalises malformed input and saved shape', () => {
  assert.equal(LearningStore.buildCaseMemoryFromAssessment(null), null);
  const saved = LearningStore.saveCaseMemory('alex', {
    caseId: 'persisted-1',
    scenarioTitle: '  Cloud migration delay  ',
    assessmentType: 'not-real',
    scenarioLens: { key: 'third-party', functionKey: 'procurement' },
    projectValueSourceStatus: 'benchmark',
    unknownsCarriedForward: ['Contractual recovery cap']
  });
  const store = LearningStore.getLearningStore('alex');

  assert.equal(saved.assessmentType, 'enterprise_generic');
  assert.equal(saved.scenarioTitle, 'Cloud migration delay');
  assert.equal(saved.projectValueSourceStatus, 'benchmark_proxy');
  assert.equal(store.caseMemories.length, 1);
  assert.equal(store.caseMemories[0].unknownsCarriedForward[0].reusableLabel, 'unknown / not reusable');
});
