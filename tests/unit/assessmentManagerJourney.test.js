'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAssessmentManagerHelpers() {
  const filePath = path.resolve(__dirname, '../../assets/app.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function buildInputOriginMix(');
  const end = source.indexOf('\nfunction buildReviewReadinessModel(', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate assessment manager helpers in app.js');
  }
  const context = {
    console,
    normaliseCitations(value = []) {
      return Array.isArray(value) ? value.filter(Boolean) : [];
    },
    ReportPresentation: require('../../assets/services/reportPresentation.js'),
    escapeHtml(value = '') {
      return String(value || '');
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context, { filename: 'app.js' });
  return context;
}

function buildSupplierOutageDraft() {
  return {
    buId: 'g42',
    buName: 'G42',
    geography: 'United Arab Emirates',
    geographies: ['United Arab Emirates'],
    narrative: 'A critical supplier for a customer-facing digital service experiences a prolonged platform outage during a peak business period, causing customer disruption and regulatory complaint risk.',
    citations: [{ title: 'Supplier outage log' }],
    inputProvenance: [{ origin: 'User edit', label: 'Event frequency' }],
    missingInformation: ['Confirm supplier recovery time objective and fallback service coverage.'],
    fairParams: {
      tefLikely: 2,
      threatCapLikely: 0.55,
      controlStrLikely: 0.62,
      irLikely: 250000,
      biLikely: 600000,
      dbLikely: 100000
    }
  };
}

test('assessment manager golden journey creates readiness, challenge, and replay trace', () => {
  const helpers = loadAssessmentManagerHelpers();
  const selectedRisks = [
    { title: 'Operational disruption across the affected service path', category: 'Operational' }
  ];
  const validation = {
    errors: [],
    warnings: ['Confirm the business interruption range before committee use.']
  };
  const readiness = helpers.buildDecisionReadinessModel({
    draft: buildSupplierOutageDraft(),
    selectedRisks,
    scenarioGeographies: ['United Arab Emirates'],
    validation,
    safeIterations: 10000
  });
  const challenge = helpers.buildAssessmentChallengePass({
    draft: buildSupplierOutageDraft(),
    selectedRisks,
    validation,
    readiness
  });
  const manager = helpers.buildAssessmentManagerRunModel({
    stage: 'review',
    draft: buildSupplierOutageDraft(),
    selectedRisks,
    validation,
    readiness,
    challenge,
    safeIterations: 10000
  });
  const workflow = helpers.buildAssessmentWorkflowStatusModel({
    stage: 'review',
    draft: buildSupplierOutageDraft(),
    selectedRisks,
    scenarioGeographies: ['United Arab Emirates'],
    validation,
    readiness,
    challenge
  });
  const decisionStack = helpers.buildAssessmentDecisionStackModel({
    assessment: {
      ...buildSupplierOutageDraft(),
      id: 'assessment-demo',
      completedAt: Date.now(),
      aiQualityState: 'ai'
    },
    selectedRisks,
    readiness,
    challenge,
    results: { toleranceBreached: true },
    executiveDecision: { decision: 'Escalate treatment', rationale: 'Breach likelihood is above tolerance.' },
    executiveAction: 'Assign a supplier resilience owner.',
    statusTitle: 'Above tolerance'
  });
  const challengeStory = helpers.buildAssessmentChallengeStory(challenge, readiness);

  assert.equal(readiness.status, 'Ready with challenge');
  assert.equal(readiness.blockingGaps.length, 0);
  assert.match(readiness.openGaps.join(' '), /supplier recovery time objective/i);
  assert.match(readiness.requiredControls.join(' '), /evidence pack|scope owner/i);
  assert.equal(challenge.status, 'Passed with review points');
  assert.match(challenge.changed, /readiness lowered|review points/i);
  assert.equal(manager.steps.length, 5);
  assert.equal(
    manager.steps.map(step => step.agent).join('|'),
    'Assessment Manager|Scenario Builder|Evidence Agent|Challenge Agent|Output Review'
  );
  assert.equal(manager.steps.find(step => step.key === 'challenge').state, 'done');
  assert.equal(manager.steps.find(step => step.key === 'output').state, 'active');
  assert.match(manager.subtitle, /One manager/i);
  assert.equal(workflow.cards.length, 4);
  assert.equal(workflow.cards.find(card => card.label === 'Workflow').value, 'Review and run');
  assert.equal(decisionStack.title, 'Decision Stack');
  assert.equal(decisionStack.cards.find(card => card.label === 'Source').value, 'Saved result');
  assert.match(challengeStory.reason, /Evidence gap remains|Estimate warning|Thin evidence basis/i);
});

test('assessment manager blocks decision readiness when context and scope are missing', () => {
  const helpers = loadAssessmentManagerHelpers();
  const draft = {
    narrative: '',
    fairParams: {}
  };
  const readiness = helpers.buildDecisionReadinessModel({
    draft,
    selectedRisks: [],
    scenarioGeographies: [],
    validation: { errors: [], warnings: [] }
  });
  const challenge = helpers.buildAssessmentChallengePass({
    draft,
    selectedRisks: [],
    validation: { errors: [], warnings: [] },
    readiness
  });

  assert.equal(readiness.status, 'Needs gating');
  assert.match(readiness.blockingGaps.join(' '), /business unit/i);
  assert.match(readiness.blockingGaps.join(' '), /scenario narrative/i);
  assert.match(readiness.blockingGaps.join(' '), /at least one risk/i);
  assert.equal(challenge.status, 'Challenge required');
});

test('assessment manager blocks decision readiness for critical control gates even below tolerance', () => {
  const helpers = loadAssessmentManagerHelpers();
  const draft = {
    buId: 'g42',
    buName: 'G42',
    geography: 'United Arab Emirates',
    narrative: 'Azure admin credentials for the tenant were found for sale on the darkweb. It is not confirmed whether the credentials are still valid.',
    citations: [{ title: 'SOC dark-web alert' }],
    inputProvenance: [{ origin: 'SOC alert', label: 'Credential exposure' }],
    fairParams: {
      tefLikely: 1,
      threatCapLikely: 0.5,
      controlStrLikely: 0.7,
      irLikely: 60000,
      biLikely: 120000,
      dbLikely: 10000
    }
  };
  const selectedRisks = [
    { title: 'Privileged tenant takeover through leaked administrator credentials', category: 'Cyber' }
  ];
  const readiness = helpers.buildDecisionReadinessModel({
    draft,
    selectedRisks,
    scenarioGeographies: ['United Arab Emirates'],
    validation: { errors: [], warnings: [] },
    safeIterations: 10000,
    results: {
      toleranceBreached: false,
      nearTolerance: false,
      annualReviewTriggered: false,
      eventLoss: { p90: 250000 },
      threshold: 1000000
    }
  });
  const challenge = helpers.buildAssessmentChallengePass({
    draft,
    selectedRisks,
    validation: { errors: [], warnings: [] },
    readiness
  });
  const manager = helpers.buildAssessmentManagerRunModel({
    stage: 'results',
    draft,
    selectedRisks,
    validation: { errors: [], warnings: [] },
    readiness,
    challenge,
    safeIterations: 10000,
    results: { toleranceBreached: false, nearTolerance: false }
  });

  assert.equal(readiness.status, 'Needs gating');
  assert.equal(readiness.tone, 'danger');
  assert.match(readiness.blockingGaps.join(' '), /credentials are revoked|tokens/i);
  assert.equal(challenge.status, 'Challenge required');
  assert.match(challenge.findings[0].title, /Privileged credential exposure/i);
  assert.equal(manager.status, 'Needs gating');
});
