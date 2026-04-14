'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGetAdminSettingsContext({ isAuthenticated = true, localSaved = null } = {}) {
  const filePath = path.resolve(__dirname, '../../assets/app.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function getAdminSettings() {');
  const end = source.indexOf('\nfunction applyManagedAccountAssignmentToSettings(', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate getAdminSettings in app.js');
  }
  const snippet = source.slice(start, end);
  let localReadCount = 0;
  let updateCount = 0;
  const context = {
    AppState: {
      adminSettingsCache: null,
      sharedAdminSettingsLoadedForSession: false
    },
    AuthService: {
      isAuthenticated: () => isAuthenticated
    },
    localStorage: {
      getItem: () => {
        localReadCount += 1;
        return localSaved ? JSON.stringify(localSaved) : 'null';
      }
    },
    GLOBAL_ADMIN_STORAGE_KEY: 'rq_admin_settings',
    normaliseAdminSettings: (value = {}) => ({
      geography: 'United Arab Emirates',
      ...value
    }),
    updateAdminSettingsState: () => {
      updateCount += 1;
    },
    console
  };
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'app.js' });
  return {
    context,
    getLocalReadCount: () => localReadCount,
    getUpdateCount: () => updateCount
  };
}

test('getAdminSettings does not read stale local admin settings before authenticated shared hydration completes', () => {
  const { context, getLocalReadCount, getUpdateCount } = loadGetAdminSettingsContext({
    isAuthenticated: true,
    localSaved: { geography: 'Stale local geography' }
  });

  const settings = context.getAdminSettings();

  assert.equal(settings.geography, 'United Arab Emirates');
  assert.equal(getLocalReadCount(), 0);
  assert.equal(getUpdateCount(), 0);
});

test('getAdminSettings still allows local fallback before authentication', () => {
  const { context, getLocalReadCount, getUpdateCount } = loadGetAdminSettingsContext({
    isAuthenticated: false,
    localSaved: { geography: 'United Kingdom' }
  });

  const settings = context.getAdminSettings();

  assert.equal(settings.geography, 'United Kingdom');
  assert.equal(getLocalReadCount(), 1);
  assert.equal(getUpdateCount(), 1);
});
