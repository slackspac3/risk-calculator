'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AiProductStateService = require('../../assets/services/aiProductStateService.js');

test('AI product state marks matching fingerprints as fresh', () => {
  const fingerprint = AiProductStateService.buildFingerprint({ scenario: 'supplier delay', value: 0 });
  const state = AiProductStateService.buildAiOutputState({
    key: 'projectExposure',
    label: 'Project exposure map',
    output: {
      sourceMode: 'live',
      inputFingerprint: fingerprint,
      projectExposureSummary: 'Delay exposure mapped.',
      generatedAt: '2026-06-10T00:00:00.000Z'
    },
    currentFingerprint: fingerprint
  });

  assert.equal(state.hasOutput, true);
  assert.equal(state.modeLabel, 'Live AI');
  assert.equal(state.freshnessStatus, 'fresh');
  assert.equal(state.refreshRecommended, false);
});

test('AI product state marks mismatched fingerprints as stale', () => {
  const state = AiProductStateService.buildAiOutputState({
    key: 'parameterCoach',
    label: 'Parameter Coach',
    output: {
      mode: 'deterministic_fallback',
      inputFingerprint: AiProductStateService.buildFingerprint({ biLikely: 10000 }),
      parameterRationales: [{ parameterKey: 'businessInterruption' }]
    },
    currentFingerprint: AiProductStateService.buildFingerprint({ biLikely: 25000 })
  });

  assert.equal(state.modeLabel, 'Deterministic fallback');
  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.recommendedAction, 'Refresh Parameter Coach');
  assert.match(state.refreshReason, /no longer matches/);
});

test('AI product state explains critical stale categories', () => {
  const saved = AiProductStateService.buildFingerprintBreakdown({
    scenario: { title: 'Supplier delay' },
    parameters: { businessInterruption: 10000 }
  });
  const current = AiProductStateService.buildFingerprintBreakdown({
    scenario: { title: 'Supplier delay' },
    parameters: { businessInterruption: 25000 }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'parameterCoach',
    label: 'Parameter Coach',
    output: {
      mode: 'deterministic_fallback',
      inputFingerprint: saved.fingerprint,
      inputFingerprintBreakdown: saved,
      parameterRationales: [{ parameterKey: 'businessInterruption' }]
    },
    currentFingerprint: current.fingerprint,
    currentFingerprintBreakdown: current
  });

  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.freshnessSeverity, 'critical');
  assert.deepEqual(state.staleCategories, ['parameters']);
  assert.match(state.refreshReason, /parameters changed/);
  assert.equal(state.recommendedAction, 'Refresh Parameter Coach');
});

test('AI product state treats evidence-only changes as review stale', () => {
  const saved = AiProductStateService.buildFingerprintBreakdown({
    scenario: { title: 'Supplier delay' },
    evidence: { citations: ['Contract v1'] }
  });
  const current = AiProductStateService.buildFingerprintBreakdown({
    scenario: { title: 'Supplier delay' },
    evidence: { citations: ['Contract v2'] }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'evidenceMap',
    label: 'Evidence Map',
    output: {
      mode: 'live',
      inputFingerprint: saved.fingerprint,
      inputFingerprintBreakdown: saved,
      supportedClaims: [{ claim: 'Budget is approved.' }]
    },
    currentFingerprint: current.fingerprint,
    currentFingerprintBreakdown: current
  });

  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.freshnessSeverity, 'review');
  assert.equal(state.freshnessLabel, 'Review recommended');
  assert.equal(state.recommendedAction, 'Review Evidence Map');
  assert.match(state.refreshReason, /evidence changed/);
});

test('AI product state treats project financial value changes as critical stale', () => {
  const saved = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    buyerEconomics: { approvedBudget: 1000000 },
    buyerEconomicsMeta: { approvedBudget: { status: 'known', confidence: 'high', source: 'user' } }
  });
  const current = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    buyerEconomics: { approvedBudget: 2000000 },
    buyerEconomicsMeta: { approvedBudget: { status: 'known', confidence: 'high', source: 'user' } }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'projectExposure',
    label: 'Project exposure map',
    output: {
      sourceMode: 'live',
      inputFingerprintBreakdown: saved,
      projectExposureSummary: 'Mapped.'
    },
    currentFingerprintBreakdown: current
  });

  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.freshnessSeverity, 'critical');
  assert.deepEqual(state.staleCategories, ['projectFinancialValues']);
  assert.match(state.refreshReason, /project financial values changed/);
});

test('AI product state treats project narrative-only changes as non-critical stale', () => {
  const saved = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    projectContext: { projectName: 'ERP rollout', projectDescription: 'Initial wording' },
    buyerEconomics: { approvedBudget: 1000000 }
  });
  const current = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    projectContext: { projectName: 'ERP rollout', projectDescription: 'Updated wording' },
    buyerEconomics: { approvedBudget: 1000000 }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'projectExposure',
    label: 'Project exposure map',
    output: {
      sourceMode: 'live',
      inputFingerprintBreakdown: saved,
      projectExposureSummary: 'Mapped.'
    },
    currentFingerprintBreakdown: current
  });

  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.freshnessSeverity, 'informational');
  assert.notEqual(state.freshnessTone, 'danger');
  assert.deepEqual(state.staleCategories, ['projectNarrativeContext']);
});

test('AI product state treats project financial status/source metadata as critical stale', () => {
  const saved = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    buyerEconomics: { delayCostPerDay: null },
    buyerEconomicsMeta: { delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided', note: 'Ask PMO.' } }
  });
  const current = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    buyerEconomics: { delayCostPerDay: null },
    buyerEconomicsMeta: { delayCostPerDay: { status: 'evidence_supported', confidence: 'high', source: 'document', note: 'Contract schedule.' } }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'projectExposure',
    label: 'Project exposure map',
    output: {
      sourceMode: 'live',
      inputFingerprintBreakdown: saved,
      projectExposureSummary: 'Mapped.'
    },
    currentFingerprintBreakdown: current
  });

  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.freshnessSeverity, 'critical');
  assert.ok(state.staleCategories.includes('projectFinancialStatusSource'));
  assert.match(state.refreshReason, /project financial status\/source/);
});

test('AI product state treats project financial note-only metadata changes as informational stale', () => {
  const saved = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    buyerEconomicsMeta: { delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided', note: 'Ask PMO.' } }
  });
  const current = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    buyerEconomicsMeta: { delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided', note: 'Ask finance.' } }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'projectExposure',
    label: 'Project exposure map',
    output: {
      sourceMode: 'live',
      inputFingerprintBreakdown: saved,
      projectExposureSummary: 'Mapped.'
    },
    currentFingerprintBreakdown: current
  });

  assert.equal(state.freshnessStatus, 'stale');
  assert.equal(state.freshnessSeverity, 'informational');
  assert.deepEqual(state.staleCategories, ['projectFinancialNotes']);
});

test('AI product state ignores dependency timestamp churn but detects useful dependency changes', () => {
  const saved = AiProductStateService.buildParameterCoachFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    parameters: { biLikely: 10000 },
    evidenceMap: {
      mode: 'live',
      generatedAt: '2026-06-10T00:00:00.000Z',
      inputFingerprint: 'evidence-input-a',
      supportedClaims: [{ claim: 'Budget is approved.' }]
    }
  });
  const currentTimestampOnly = AiProductStateService.buildParameterCoachFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    parameters: { biLikely: 10000 },
    evidenceMap: {
      mode: 'deterministic_fallback',
      generatedAt: '2026-06-11T00:00:00.000Z',
      inputFingerprint: 'evidence-input-a',
      supportedClaims: [{ claim: 'Budget is approved.' }]
    }
  });
  const currentUsefulChange = AiProductStateService.buildParameterCoachFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    parameters: { biLikely: 10000 },
    evidenceMap: {
      mode: 'live',
      generatedAt: '2026-06-11T00:00:00.000Z',
      inputFingerprint: 'evidence-input-b',
      supportedClaims: [{ claim: 'Budget is approved.' }, { claim: 'Delay clause applies.' }]
    }
  });
  const output = {
    mode: 'live',
    inputFingerprintBreakdown: saved,
    parameterRationales: [{ parameterKey: 'businessInterruption' }]
  };
  const timestampOnlyState = AiProductStateService.buildAiOutputState({
    key: 'parameterCoach',
    label: 'Parameter Coach',
    output,
    currentFingerprintBreakdown: currentTimestampOnly
  });
  const usefulChangeState = AiProductStateService.buildAiOutputState({
    key: 'parameterCoach',
    label: 'Parameter Coach',
    output,
    currentFingerprintBreakdown: currentUsefulChange
  });

  assert.equal(timestampOnlyState.freshnessStatus, 'fresh');
  assert.equal(usefulChangeState.freshnessStatus, 'stale');
  assert.equal(usefulChangeState.freshnessSeverity, 'review');
  assert.ok(usefulChangeState.staleCategories.includes('dependentAiOutputs'));
});

test('AI product state treats empty outputs as generate prompts', () => {
  const state = AiProductStateService.buildAiOutputState({
    key: 'decisionBrief',
    label: 'Decision Brief',
    output: {}
  });

  assert.equal(state.hasOutput, false);
  assert.equal(state.freshnessStatus, 'empty');
  assert.equal(state.recommendedAction, 'Generate Decision Brief');
});

test('AI artifact registry exposes labels, useful paths, and snapshot builders', () => {
  const projectExposure = AiProductStateService.getAiArtifactDefinition('projectExposure');
  const decisionBrief = AiProductStateService.getAiArtifactDefinition('decision_brief');

  assert.equal(projectExposure.label, 'Project exposure map');
  assert.equal(projectExposure.modeField, 'sourceMode');
  assert.ok(projectExposure.usefulPaths.includes('financialDrivers'));
  assert.equal(typeof projectExposure.buildSnapshot, 'function');
  assert.equal(decisionBrief.label, 'Decision Brief');
  assert.ok(decisionBrief.usefulPaths.includes('recommendation'));
});

test('AI artifact persistence helper writes canonical metadata for draft artifacts', () => {
  const snapshot = AiProductStateService.buildParameterCoachFingerprintSnapshot({
    scenario: 'Supplier delay',
    parameters: { biLikely: 10000 }
  });
  const target = {};
  const record = AiProductStateService.saveAiArtifact({
    target,
    artifactKey: 'parameterCoach',
    result: {
      mode: 'live',
      usedFallback: false,
      aiUnavailable: false,
      generatedAt: '2026-06-11T00:00:00.000Z'
    },
    artifact: {
      parameterRationales: [{ parameterKey: 'businessInterruption' }]
    },
    fingerprintSnapshot: snapshot
  });

  assert.equal(target.parameterCoach, record);
  assert.equal(record.mode, 'live');
  assert.equal(record.usedFallback, false);
  assert.equal(record.aiUnavailable, false);
  assert.equal(record.generatedAt, '2026-06-11T00:00:00.000Z');
  assert.equal(record.inputFingerprint, snapshot.fingerprint);
  assert.deepEqual(record.inputFingerprintBreakdown, snapshot);
});

test('AI artifact persistence helper uses sourceMode for project exposure records', () => {
  const snapshot = AiProductStateService.buildProjectExposureFingerprintSnapshot({
    scenario: 'Supplier delay',
    buyerEconomics: { approvedBudget: 1000000 }
  });
  const record = AiProductStateService.buildAiArtifactRecord({
    artifactKey: 'projectExposure',
    result: {
      mode: 'deterministic_preview',
      usedFallback: true,
      generatedAt: '2026-06-11T00:00:00.000Z'
    },
    artifact: {
      projectExposureSummary: 'Delay exposure mapped.',
      financialDrivers: [{ id: 'delay' }]
    },
    fingerprintSnapshot: snapshot
  });

  assert.equal(record.sourceMode, 'deterministic_preview');
  assert.equal(Object.prototype.hasOwnProperty.call(record, 'mode'), false);
  assert.equal(record.inputFingerprint, snapshot.fingerprint);
});

test('AI artifact meta helper writes Results meta without artifact body fields', () => {
  const snapshot = AiProductStateService.buildDecisionBriefFingerprintSnapshot({
    scenario: 'Supplier delay',
    simulationResult: { annualLoss: { mean: 100000 } }
  });
  const meta = AiProductStateService.buildAiArtifactMeta({
    artifactKey: 'decisionBrief',
    result: {
      mode: 'deterministic_fallback',
      usedFallback: true,
      generatedAt: '2026-06-11T00:00:00.000Z'
    },
    artifact: {
      recommendation: 'Review before proceeding.',
      why: 'The simulation changed.'
    },
    fingerprintSnapshot: snapshot,
    extra: {
      fallbackReasonTitle: 'Fallback used'
    }
  });

  assert.equal(meta.mode, 'deterministic_fallback');
  assert.equal(meta.usedFallback, true);
  assert.equal(meta.fallbackReasonTitle, 'Fallback used');
  assert.equal(meta.inputFingerprint, snapshot.fingerprint);
  assert.equal(Object.prototype.hasOwnProperty.call(meta, 'recommendation'), false);
});

test('AI product state works with breakdowns even when flat fingerprint is absent', () => {
  const saved = AiProductStateService.buildParameterCoachFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    parameters: { biLikely: 10000 }
  });
  const current = AiProductStateService.buildParameterCoachFingerprintSnapshot({
    assessmentType: 'project_buyer',
    scenario: 'Supplier delay',
    parameters: { biLikely: 10000 }
  });
  const state = AiProductStateService.buildAiOutputState({
    key: 'parameterCoach',
    label: 'Parameter Coach',
    output: {
      mode: 'live',
      inputFingerprintBreakdown: saved,
      parameterRationales: [{ parameterKey: 'businessInterruption' }]
    },
    currentFingerprintBreakdown: current
  });

  assert.equal(state.hasOutput, true);
  assert.equal(state.freshnessStatus, 'fresh');
  assert.equal(state.inputFingerprint, '');
});

test('AI product state does not treat metadata-only objects as useful artefacts', () => {
  const state = AiProductStateService.buildAiOutputState({
    key: 'decisionBrief',
    label: 'Decision Brief',
    output: {
      sourceMetadata: { confidence: 'unknown' },
      generatedAt: '2026-06-10T00:00:00.000Z'
    }
  });

  assert.equal(state.hasOutput, false);
  assert.equal(state.freshnessStatus, 'empty');
});

test('AI journey state aggregates live, fallback, stale, and empty outputs', () => {
  const freshFingerprint = AiProductStateService.buildFingerprint({ a: 1 });
  const journey = AiProductStateService.buildAiJourneyState([
    AiProductStateService.buildAiOutputState({
      key: 'decisionBrief',
      label: 'Decision Brief',
      output: { mode: 'live', inputFingerprint: freshFingerprint, recommendation: 'Proceed.' },
      currentFingerprint: freshFingerprint
    }),
    AiProductStateService.buildAiOutputState({
      key: 'evidenceMap',
      label: 'Evidence Map',
      output: { mode: 'deterministic_fallback', inputFingerprint: 'old', supportedClaims: ['Claim'] },
      currentFingerprint: 'new'
    }),
    AiProductStateService.buildAiOutputState({
      key: 'challenge',
      label: 'Challenge Agent',
      output: {}
    })
  ]);

  assert.equal(journey.modeLabel, 'Mixed AI/fallback');
  assert.equal(journey.liveCount, 1);
  assert.equal(journey.fallbackCount, 1);
  assert.equal(journey.staleCount, 1);
  assert.equal(journey.criticalStaleCount, 1);
  assert.equal(journey.emptyCount, 1);
  assert.equal(journey.recommendedAction, 'Refresh Evidence Map');
  assert.match(journey.summaryLabel, /stale/);
});
