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
const { writeSettings } = require('../../api/settings');

test.beforeEach(() => {
  kvStore.clear();
});

test('writeUserState rejects stale revisions and returns the latest state', async () => {
  const initial = await writeUserState('alex', {
    userSettings: { geography: 'UAE' },
    assessments: [],
    learningStore: { templates: {} },
    draft: null
  }, { revision: 0 });

  assert.equal(initial.ok, true);
  assert.equal(initial.state._meta.revision, 1);

  const stale = await writeUserState('alex', {
    userSettings: { geography: 'USA' },
    assessments: [],
    learningStore: { templates: {} },
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
    learningStore: { templates: {} },
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
