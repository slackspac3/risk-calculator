'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createEmptyUserStateCache,
  createSimulationState,
  applyAuthSessionState,
  applyUserStateCache,
  applyAdminSettingsState,
  applyDraftAssessmentState,
  applySimulationState,
  reduceDraftAction,
  reduceSimulationAction
} = require('../../assets/state/appStateStore.js');

const expectedLearningStore = {
  templates: {},
  scenarioPatterns: [],
  analystSignals: {
    keptRisks: [],
    removedRisks: [],
    narrativeEdits: [],
    rerunDeltas: []
  },
  aiFeedback: {
    events: []
  }
};

test('createEmptyUserStateCache normalises the username and default collections', () => {
  const cache = createEmptyUserStateCache(' Alex.Trafton ');
  assert.equal(cache.username, 'alex.trafton');
  assert.deepEqual(cache.assessments, []);
  assert.deepEqual(cache.learningStore, expectedLearningStore);
  assert.equal(cache._meta.revision, 0);
  assert.equal(cache._meta.updatedAt, 0);
});

test('createSimulationState merges progress overrides without dropping defaults', () => {
  const state = createSimulationState({
    status: 'running',
    progress: {
      completed: 20,
      total: 100
    }
  });
  assert.equal(state.status, 'running');
  assert.equal(state.canCancel, false);
  assert.equal(state.cancelRequested, false);
  assert.equal(state.progress.completed, 20);
  assert.equal(state.progress.total, 100);
  assert.equal(state.progress.ratio, 0);
  assert.equal(state.lastError, '');
});

test('applyAuthSessionState only updates auth-owned fields', () => {
  const current = {
    currentUser: { username: 'alex.trafton' },
    adminVisiblePasswords: { alex: 'secret' },
    draftDirty: true
  };
  const next = applyAuthSessionState(current, { currentUser: null });
  assert.equal(next.currentUser, null);
  assert.deepEqual(next.adminVisiblePasswords, { alex: 'secret' });
  assert.equal(next.draftDirty, true);
});

test('applyUserStateCache restores safe defaults for missing collections', () => {
  const next = applyUserStateCache({ userStateCache: createEmptyUserStateCache('alex.trafton') }, {
    username: 'alex.trafton',
    assessments: null,
    learningStore: null,
    draft: null,
    _meta: { revision: 3, updatedAt: 99 }
  });
  assert.deepEqual(next.userStateCache.assessments, []);
  assert.deepEqual(next.userStateCache.learningStore, expectedLearningStore);
  assert.equal(next.userStateCache._meta.revision, 3);
  assert.equal(next.userStateCache._meta.updatedAt, 99);
});

test('applyAdminSettingsState replaces only the admin settings cache', () => {
  const next = applyAdminSettingsState({ adminSettingsCache: null, draft: { id: 'a1' } }, { geography: 'UAE' });
  assert.deepEqual(next.adminSettingsCache, { geography: 'UAE' });
  assert.equal(next.adminSettingsCacheSource, 'local');
  assert.deepEqual(next.draft, { id: 'a1' });
});

test('applyDraftAssessmentState updates draft metadata together', () => {
  const next = applyDraftAssessmentState({
    draft: { id: 'a1' },
    draftDirty: false,
    draftLastSavedAt: 10,
    draftSaveTimer: null
  }, {
    draft: { id: 'a2' },
    draftDirty: true,
    draftLastSavedAt: 42
  });
  assert.deepEqual(next.draft, { id: 'a2' });
  assert.equal(next.draftDirty, true);
  assert.equal(next.draftLastSavedAt, 42);
  assert.equal(next.draftSaveTimer, null);
});

test('applySimulationState preserves prior values when partial updates are applied', () => {
  const next = applySimulationState({
    simulation: createSimulationState({
      status: 'running',
      progress: { completed: 30, total: 100, ratio: 0.3, message: 'Working' },
      lastRunAt: 50
    })
  }, {
    progress: {
      completed: 60,
      total: 100,
      ratio: 0.6
    }
  });
  assert.equal(next.simulation.status, 'running');
  assert.equal(next.simulation.progress.completed, 60);
  assert.equal(next.simulation.progress.total, 100);
  assert.equal(next.simulation.progress.ratio, 0.6);
  assert.equal(next.simulation.progress.message, '');
  assert.equal(next.simulation.lastRunAt, 50);
});

test('reduceDraftAction applies named draft lifecycle transitions and records them', () => {
  const base = {
    draft: { id: 'a1', scenarioTitle: 'Draft 1' },
    draftDirty: false,
    draftLastSavedAt: 0,
    draftSaveTimer: null,
    stateTransitionLog: []
  };
  const merged = reduceDraftAction(base, 'MERGE_DRAFT', {
    patch: { narrative: 'Updated narrative' },
    draftDirty: true
  });
  assert.equal(merged.draft.narrative, 'Updated narrative');
  assert.equal(merged.draftDirty, true);
  assert.equal(merged.stateTransitionLog[0].scope, 'draft');
  assert.equal(merged.stateTransitionLog[0].action, 'MERGE_DRAFT');

  const saved = reduceDraftAction(merged, 'MARK_DRAFT_SAVED', { at: 123 });
  assert.equal(saved.draftDirty, false);
  assert.equal(saved.draftLastSavedAt, 123);
  assert.equal(saved.stateTransitionLog[0].action, 'MARK_DRAFT_SAVED');
});

test('reduceDraftAction keeps step-scoped AI conversation contexts separate', () => {
  const base = {
    draft: {
      id: 'a1',
      llmContext: [{ role: 'user', content: 'legacy step' }],
      step1LlmContext: [{ role: 'assistant', content: 'step 1 reply' }],
      step2LlmContext: [{ role: 'user', content: 'step 2 prompt' }],
      step3LlmContext: [{ role: 'user', content: 'step 3 prompt' }]
    },
    draftDirty: false,
    draftLastSavedAt: 0,
    draftSaveTimer: null,
    stateTransitionLog: []
  };

  const appended = reduceDraftAction(base, 'APPEND_LLM_CONTEXT', {
    contextKey: 'step2LlmContext',
    user: 'Refine the scenario narrative.',
    assistant: 'Here is the refined scenario narrative.'
  });

  assert.equal(appended.draft.step2LlmContext.length, 3);
  assert.deepEqual(appended.draft.step1LlmContext, base.draft.step1LlmContext);
  assert.deepEqual(appended.draft.step3LlmContext, base.draft.step3LlmContext);
  assert.deepEqual(appended.draft.llmContext, base.draft.llmContext);

  const cleared = reduceDraftAction(appended, 'CLEAR_LLM_CONTEXT', {
    contextKey: 'step2LlmContext'
  });

  assert.deepEqual(cleared.draft.step2LlmContext, []);
  assert.deepEqual(cleared.draft.step1LlmContext, base.draft.step1LlmContext);
  assert.deepEqual(cleared.draft.step3LlmContext, base.draft.step3LlmContext);
});

test('reduceSimulationAction applies named simulation lifecycle transitions and records them', () => {
  const base = {
    simulation: createSimulationState(),
    stateTransitionLog: []
  };
  const started = reduceSimulationAction(base, 'START_SIMULATION', { total: 5000, at: 50 });
  assert.equal(started.simulation.status, 'running');
  assert.equal(started.simulation.progress.total, 5000);
  assert.equal(started.stateTransitionLog[0].scope, 'simulation');
  assert.equal(started.stateTransitionLog[0].action, 'START_SIMULATION');

  const progressed = reduceSimulationAction(started, 'UPDATE_SIMULATION_PROGRESS', {
    completed: 2500,
    total: 5000,
    ratio: 0.5,
    message: 'Halfway'
  });
  assert.equal(progressed.simulation.progress.completed, 2500);
  assert.equal(progressed.simulation.progress.message, 'Halfway');

  const cancelled = reduceSimulationAction(progressed, 'CANCEL_SIMULATION', { message: 'Stopping' });
  assert.equal(cancelled.simulation.status, 'cancelling');
  assert.equal(cancelled.simulation.cancelRequested, true);
  assert.equal(cancelled.simulation.progress.message, 'Stopping');
});
