'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSharedStateClientContext({ responseSettings, localSaved = null } = {}) {
  const filePath = path.resolve(__dirname, '../../assets/services/sharedStateClient.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const applyCalls = [];
  const requestCalls = [];
  const context = {
    console,
    DEFAULT_ADMIN_SETTINGS: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      companyStructure: [],
      entityContextLayers: [],
      companyContextSections: null
    },
    GLOBAL_ADMIN_STORAGE_KEY: 'rq_admin_settings',
    AuthService: {
      getApiSessionToken: () => 'session-token',
      getAdminApiSecret: () => '',
      handleApiAuthFailure: () => {},
      buildApiError: () => new Error('api error'),
      getCurrentUser: () => ({ username: 'admin.user' })
    },
    requestSharedSettings: async (method) => {
      requestCalls.push(method);
      if (method !== 'GET') {
        throw new Error(`Unexpected shared settings method: ${method}`);
      }
      return {
        settings: responseSettings,
        scope: { redacted: false }
      };
    },
    applySharedSettingsLocally: (settings, options = {}) => {
      applyCalls.push({ settings, options });
      return settings;
    },
    normaliseAdminSettings: (settings = {}) => settings,
    buildExpectedMeta: () => ({ revision: 7 }),
    getAdminSettings: () => ({ _meta: { revision: 7 } }),
    fetch: async () => {
      throw new Error('Unexpected fetch call');
    },
    localStorage: {
      getItem: () => (localSaved ? JSON.stringify(localSaved) : 'null')
    }
  };
  context.window = context;
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'sharedStateClient.js' });
  return {
    context,
    applyCalls,
    requestCalls
  };
}

test('loadSharedAdminSettings uses the authoritative shared payload instead of merging stale local admin backups', async () => {
  const staleLocal = {
    companyStructure: [{ id: 'stale-co', name: 'Stale Co', type: 'Holding company' }],
    entityContextLayers: [{ entityId: 'stale-co', contextSummary: 'stale local layer' }],
    companyContextSections: { companySummary: 'stale local summary' }
  };
  const sharedSettings = {
    geography: 'United Kingdom',
    applicableRegulations: ['UK GDPR'],
    companyStructure: [],
    entityContextLayers: [],
    companyContextSections: null
  };
  const { context, applyCalls, requestCalls } = loadSharedStateClientContext({
    responseSettings: sharedSettings,
    localSaved: staleLocal
  });

  const result = await context.AppSharedStateClient.loadSharedAdminSettings();

  assert.deepEqual(requestCalls, ['GET']);
  assert.equal(applyCalls.length, 1);
  assert.deepEqual(applyCalls[0].settings.companyStructure, []);
  assert.deepEqual(applyCalls[0].settings.entityContextLayers, []);
  assert.equal(applyCalls[0].settings.companyContextSections, null);
  assert.equal(applyCalls[0].options.source, 'shared');
  assert.deepEqual(result.companyStructure, []);
});
