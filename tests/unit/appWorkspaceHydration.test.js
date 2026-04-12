'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadWorkspaceHydrationHelpers({ isAuthenticated = false, adminSettings = {}, overrides = [], builtInBuList = [] } = {}) {
  const filePath = path.resolve(__dirname, '../../assets/app.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('async function hydrateAuthenticatedWorkspaceContext(');
  const end = source.indexOf('\nfunction saveBUList(', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate workspace hydration helpers in app.js');
  }
  const snippet = source.slice(start, end);
  const callOrder = [];
  const context = {
    console,
    AppState: {
      sharedAdminSettingsLoadedForSession: false,
      buList: builtInBuList
    },
    AuthService: {
      isAuthenticated: () => isAuthenticated,
      getCurrentUser: () => null
    },
    getAdminSettings: () => adminSettings,
    getCompanyEntities: (structure = []) => (Array.isArray(structure) ? structure : []).filter((node) => !String(node?.type || '').toLowerCase().includes('department')),
    getStoredBUOverrides: () => overrides,
    buildBUFromOrgEntity: (entity) => ({
      id: String(entity?.id || ''),
      name: String(entity?.name || ''),
      orgEntityId: String(entity?.id || '')
    }),
    loadSharedAdminSettings: async () => {
      callOrder.push('settings');
      context.AppState.sharedAdminSettingsLoadedForSession = true;
      return { companyStructure: [{ id: 'g42', name: 'G42', type: 'Holding company' }] };
    },
    loadSharedUserState: async (username) => {
      callOrder.push(`user:${username}`);
      return { username };
    }
  };
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'app.js' });
  return { context, callOrder };
}

test('hydrateAuthenticatedWorkspaceContext loads shared admin settings before user state', async () => {
  const { context, callOrder } = loadWorkspaceHydrationHelpers();

  const result = await context.hydrateAuthenticatedWorkspaceContext('tarun.gupta');

  assert.deepEqual(callOrder, ['settings', 'user:tarun.gupta']);
  assert.equal(result.adminSettingsLoaded, true);
  assert.equal(result.userStateLoaded, true);
  assert.equal(result.username, 'tarun.gupta');
});

test('getBUList does not fall back to bundled generic BUs for authenticated sessions before shared settings hydrate', () => {
  const { context } = loadWorkspaceHydrationHelpers({
    isAuthenticated: true,
    adminSettings: {
      companyStructure: []
    },
    overrides: [],
    builtInBuList: [
      { id: 'technology', name: 'Technology' },
      { id: 'operations', name: 'Operations' }
    ]
  });

  assert.deepEqual(Array.from(context.getBUList()), []);
});

test('getBUList still allows bundled BU fallback before authentication', () => {
  const { context } = loadWorkspaceHydrationHelpers({
    isAuthenticated: false,
    adminSettings: {
      companyStructure: []
    },
    builtInBuList: [
      { id: 'technology', name: 'Technology' }
    ]
  });

  assert.deepEqual(context.getBUList(), [{ id: 'technology', name: 'Technology' }]);
});
