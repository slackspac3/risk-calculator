'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const kvStore = new Map();

process.env.KV_REST_API_URL = 'https://example.test/kv';
process.env.KV_REST_API_TOKEN = 'test-token';

global.fetch = async (url, options = {}) => {
  const body = JSON.parse(String(options.body || '[]'));
  const [command, key, value] = body;
  if (command === 'GET') {
    return {
      ok: true,
      json: async () => ({ result: kvStore.has(key) ? kvStore.get(key) : null })
    };
  }
  if (command === 'SET') {
    kvStore.set(key, value);
    return {
      ok: true,
      json: async () => ({ result: 'OK' })
    };
  }
  throw new Error(`Unsupported KV command: ${command}`);
};

const { writeUserState, patchUserState } = require('../../api/user-state');
const { materializeSavedAssessments } = require('../../assets/state/userWorkspacePersistence.js');
const { writeSettings } = require('../../api/settings');

const learningStore = {
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

test.beforeEach(() => {
  kvStore.clear();
});

test('writeUserState rejects stale revisions and returns the latest state', async () => {
  const initial = await writeUserState('alex', {
    userSettings: { geography: 'UAE' },
    assessments: [],
    learningStore,
    draft: null
  }, { revision: 0 });

  assert.equal(initial.ok, true);
  assert.equal(initial.state._meta.revision, 1);

  const stale = await writeUserState('alex', {
    userSettings: { geography: 'USA' },
    assessments: [],
    learningStore,
    draft: null
  }, { revision: 0 });

  assert.equal(stale.conflict, true);
  assert.equal(stale.state.userSettings.geography, 'UAE');
  assert.equal(stale.state._meta.revision, 1);
});

test('patchUserState updates only the requested section and increments revision', async () => {
  const initial = await writeUserState('alex', {
    userSettings: { geography: 'UAE' },
    assessments: [{ id: 'a-1', scenarioTitle: 'Initial' }],
    learningStore,
    draft: { id: 'draft-1', scenarioTitle: 'Draft one' }
  }, { revision: 0 });

  const patched = await patchUserState('alex', {
    draft: { id: 'draft-2', scenarioTitle: 'Recovered draft' }
  }, { revision: initial.state._meta.revision });

  assert.equal(patched.ok, true);
  assert.equal(patched.state._meta.revision, 2);
  assert.deepEqual(patched.state.userSettings, { geography: 'UAE' });
  assert.deepEqual(patched.state.assessments, [{ id: 'a-1', scenarioTitle: 'Initial' }]);
  assert.equal(patched.state.draft.id, 'draft-2');
});

test('user-state persistence stores bounded draft and saved-assessment sections while keeping legacy reads compatible', async () => {
  const initial = await writeUserState('alex', {
    userSettings: { geography: 'UAE' },
    assessments: [{ id: 'a-1', scenarioTitle: 'Initial', lifecycleStatus: 'draft' }],
    learningStore,
    draft: { id: 'draft-1', scenarioTitle: 'Draft one' }
  }, { revision: 0 });

  const rawStored = JSON.parse(Array.from(kvStore.values())[0]);
  assert.equal(Boolean(rawStored.savedAssessments && rawStored.savedAssessments.itemsById), true);
  assert.equal(Boolean(rawStored.draftWorkspace && rawStored.draftWorkspace.draft), true);
  assert.equal(Object.prototype.hasOwnProperty.call(rawStored, 'assessments'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rawStored, 'draft'), false);

  assert.equal(initial.state.draft.id, 'draft-1');
  assert.deepEqual(materializeSavedAssessments(initial.state.savedAssessments), initial.state.assessments);
});

test('writeSettings rejects stale revisions and preserves the latest settings', async () => {
  const initial = await writeSettings({
    geography: 'United Arab Emirates',
    typicalDepartments: ['Security']
  }, { revision: 0 });

  assert.equal(initial.ok, true);
  assert.equal(initial.settings._meta.revision, 1);

  const stale = await writeSettings({
    geography: 'United States',
    typicalDepartments: ['Security', 'Finance']
  }, { revision: 0 });

  assert.equal(stale.conflict, true);
  assert.equal(stale.settings.geography, 'United Arab Emirates');
  assert.equal(stale.settings._meta.revision, 1);
});

test('writeSettings normalises and persists AI feedback tuning controls', async () => {
  const saved = await writeSettings({
    geography: 'United Arab Emirates',
    aiFeedbackTuning: {
      alignmentPriority: 'BALANCED',
      draftStyle: 'executive-brief',
      shortlistDiscipline: 'strict',
      learningSensitivity: 'accelerated'
    }
  }, { revision: 0 });

  assert.equal(saved.ok, true);
  assert.deepEqual(saved.settings.aiFeedbackTuning, {
    alignmentPriority: 'balanced',
    draftStyle: 'executive-brief',
    shortlistDiscipline: 'strict',
    learningSensitivity: 'accelerated'
  });
});
