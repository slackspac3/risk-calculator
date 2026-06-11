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
