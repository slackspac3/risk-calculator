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
  applySimulationState
} = require('../../assets/state/appStateStore.js');

test('createEmptyUserStateCache normalises the username and default collections', () => {
  const cache = createEmptyUserStateCache(' Alex.Trafton ');
  assert.equal(cache.username, 'alex.trafton');
  assert.deepEqual(cache.assessments, []);
  assert.deepEqual(cache.learningStore, { templates: {} });
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
  assert.deepEqual(next.userStateCache.learningStore, { templates: {} });
  assert.equal(next.userStateCache._meta.revision, 3);
  assert.equal(next.userStateCache._meta.updatedAt, 99);
});

test('applyAdminSettingsState replaces only the admin settings cache', () => {
  const next = applyAdminSettingsState({ adminSettingsCache: null, draft: { id: 'a1' } }, { geography: 'UAE' });
  assert.deepEqual(next.adminSettingsCache, { geography: 'UAE' });
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
