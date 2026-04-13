'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function loadAssessmentStateRuntime() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../assets/state/assessmentState.js'),
    'utf8'
  );

  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const toasts = [];
  const step1LiveAssistResets = [];
  const cache = {
    username: 'alex.trafton',
    assessments: [],
    savedAssessments: { index: [], itemsById: {} },
    learningStore: {
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
    },
    draft: null,
    _meta: { revision: 1, updatedAt: 1 }
  };
  const appState = {
    draft: null,
    disclosureState: {}
  };

  const context = {
    console,
    Date,
    JSON,
    Math,
    setTimeout,
    clearTimeout,
    window: {
      resetStep1LiveAssistState(options = {}) {
        step1LiveAssistResets.push({ ...options });
      }
    },
    localStorage,
    sessionStorage,
    AppState: appState,
    ASSESSMENT_LIFECYCLE_STATUS: {
      DRAFT: 'draft',
      ARCHIVED: 'archived'
    },
    DEFAULT_ADMIN_SETTINGS: {
      geography: 'United Arab Emirates',
      defaultLinkMode: 'linked',
      applicableRegulations: []
    },
    ensureUserStateCache() {
      return cache;
    },
    normaliseSavedAssessmentsSection(section, legacyAssessments = []) {
      const list = Array.isArray(legacyAssessments) ? legacyAssessments.slice() : [];
      if (section && section.itemsById) {
        return section;
      }
      const itemsById = {};
      list.forEach(item => {
        itemsById[item.id] = { ...item };
      });
      return {
        index: list.map(item => ({ id: item.id })),
        itemsById
      };
    },
    materializeSavedAssessments(section = {}) {
      return Object.values(section.itemsById || {}).map(item => ({ ...item }));
    },
    buildSavedAssessmentsSection(list = []) {
      const itemsById = {};
      list.forEach(item => {
        itemsById[item.id] = { ...item };
      });
      return {
        index: list.map(item => ({ id: item.id })),
        itemsById
      };
    },
    buildDraftWorkspaceSection(draft = null, overrides = {}) {
      return {
        schemaVersion: 2,
        draft: draft && typeof draft === 'object' ? { ...draft } : null,
        status: draft ? 'active' : 'empty',
        lastSavedAt: Number(overrides.lastSavedAt || 0),
        recoverySnapshotAt: Number(overrides.recoverySnapshotAt || 0)
      };
    },
    normaliseAssessmentRecord(item) {
      return item ? { ...item } : item;
    },
    buildUserStorageKey(prefix, username = 'alex.trafton') {
      return `${prefix}__${username}`;
    },
    ASSESSMENTS_STORAGE_PREFIX: 'rq_assessments',
    LEARNING_STORAGE_PREFIX: 'rq_learning_store',
    DRAFT_STORAGE_PREFIX: 'rq_draft',
    DRAFT_RECOVERY_STORAGE_PREFIX: 'rq_draft_recovery',
    queueSharedUserStateSync() {},
    prepareAssessmentForSave(assessment, options = {}) {
      const next = { ...assessment };
      if (options.targetStatus) {
        next.lifecycleStatus = options.targetStatus;
        if (options.targetStatus === 'archived' && options.at) {
          next.archivedAt = options.at;
        }
      }
      return next;
    },
    restoreAssessmentLifecycle(assessment) {
      const next = { ...assessment };
      delete next.archivedAt;
      next.lifecycleStatus = 'draft';
      return next;
    },
    ensureDraftShape() {
      return {
        id: 'a_draft',
        scenarioTitle: '',
        narrative: '',
        lifecycleStatus: 'draft',
        fairParams: {},
        results: null,
        selectedRiskIds: [],
        selectedRisks: [],
        geographies: ['United Arab Emirates'],
        applicableRegulations: []
      };
    },
    deriveAssessmentLifecycleStatus(record = {}) {
      if (record.archivedAt) return 'archived';
      if (record.results || record.completedAt) return record.lifecycleStatus || 'simulated';
      return 'draft';
    },
    dispatchDraftAction(action, payload) {
      if (action === 'SET_DRAFT') {
        appState.draft = payload.draft;
      }
      if (action === 'RESET_DRAFT') {
        appState.draft = payload.draft;
      }
    },
    readDraftRecoverySnapshot(username = 'alex.trafton') {
      try {
        const raw = localStorage.getItem(`rq_draft_recovery__${username}`);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    clearDraftRecoverySnapshot(username = 'alex.trafton') {
      localStorage.removeItem(`rq_draft_recovery__${username}`);
    },
    saveDraft() {},
    UI: {
      toast(message, tone, duration) {
        toasts.push({ message, tone, duration });
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'assessmentState.js' });

  return { api: context.window, cache, appState, localStorage, sessionStorage, toasts, step1LiveAssistResets };
}

test('archiveAssessment marks the saved assessment as archived', () => {
  const { api, cache } = loadAssessmentStateRuntime();
  cache.assessments = [{
    id: 'assess-1',
    scenarioTitle: 'Ransomware on shared ERP',
    lifecycleStatus: 'simulated'
  }];
  cache.savedAssessments = api.buildSavedAssessmentsSection
    ? api.buildSavedAssessmentsSection(cache.assessments)
    : {
        index: [{ id: 'assess-1' }],
        itemsById: { 'assess-1': { ...cache.assessments[0] } }
      };

  const archived = api.archiveAssessment('assess-1');
  assert.equal(archived, true);

  const updated = api.getAssessmentById('assess-1');
  assert.equal(updated.lifecycleStatus, 'archived');
  assert.ok(updated.archivedAt);
});

test('duplicateAssessmentToDraft creates a new draft copy with draft lifecycle status', () => {
  const { api, cache, appState } = loadAssessmentStateRuntime();
  cache.assessments = [{
    id: 'assess-2',
    scenarioTitle: 'Cloud exposure in shared platform',
    lifecycleStatus: 'simulated',
    results: { toleranceBreached: false }
  }];
  cache.savedAssessments = {
    index: [{ id: 'assess-2' }],
    itemsById: { 'assess-2': { ...cache.assessments[0] } }
  };

  const duplicated = api.duplicateAssessmentToDraft('assess-2');
  assert.ok(duplicated);
  assert.match(duplicated.scenarioTitle, /copy/i);
  assert.equal(duplicated.lifecycleStatus, 'draft');
  assert.equal(duplicated.results, null);
  assert.equal(appState.draft.lifecycleStatus, 'draft');
});

test('resetDraft clears Step 1 live assist state for fresh SPA assessments', () => {
  const { api, step1LiveAssistResets } = loadAssessmentStateRuntime();

  api.resetDraft();

  assert.deepEqual(step1LiveAssistResets, [{ clearCaches: true }]);
});

test('resetDraft clears Step 1 disclosure state without touching other disclosure scopes', () => {
  const { api, appState } = loadAssessmentStateRuntime();
  appState.disclosureState['/wizard/1::add more context only if you need it'] = true;
  appState.disclosureState['/wizard/1::review ai reasoning and context'] = true;
  appState.disclosureState['/wizard/2::use ai to structure the scenario'] = true;
  appState.disclosureState['/wizard/3::quick start, presets, and guidance'] = true;
  appState.disclosureState['/wizard/4::how the result is built'] = true;
  appState.disclosureState['/help::step 1 overview'] = true;

  api.resetDraft();

  assert.equal(appState.disclosureState['/wizard/1::add more context only if you need it'], undefined);
  assert.equal(appState.disclosureState['/wizard/1::review ai reasoning and context'], undefined);
  assert.equal(appState.disclosureState['/wizard/2::use ai to structure the scenario'], undefined);
  assert.equal(appState.disclosureState['/wizard/3::quick start, presets, and guidance'], undefined);
  assert.equal(appState.disclosureState['/wizard/4::how the result is built'], undefined);
  assert.equal(appState.disclosureState['/help::step 1 overview'], true);
});

test('resetDraft returns Step 3 modelling mode to basic for a fresh assessment', () => {
  const { api, appState } = loadAssessmentStateRuntime();
  appState.mode = 'advanced';

  api.resetDraft();

  assert.equal(appState.mode, 'basic');
});

test('resetDraft flags a fresh wizard render to reapply disclosure defaults', () => {
  const { api, appState } = loadAssessmentStateRuntime();
  appState.forceWizardDisclosureDefaults = false;

  api.resetDraft();

  assert.equal(appState.forceWizardDisclosureDefaults, true);
});

test('loadDraft prefers shared workspace draft over recovery and session state', () => {
  const { api, cache, appState, localStorage, sessionStorage, toasts } = loadAssessmentStateRuntime();
  cache.draftWorkspace = {
    draft: {
      id: 'server-draft',
      scenarioTitle: 'Server copy',
      lifecycleStatus: 'draft'
    },
    lastSavedAt: Date.now() - 10_000
  };
  localStorage.setItem('rq_draft_recovery__alex.trafton', JSON.stringify({
    savedAt: Date.now(),
    draft: {
      id: 'recovery-draft',
      scenarioTitle: 'Recovery copy',
      lifecycleStatus: 'draft'
    }
  }));
  sessionStorage.setItem('rq_draft__alex.trafton', JSON.stringify({
    savedAt: Date.now(),
    draft: {
      id: 'session-draft',
      scenarioTitle: 'Session copy',
      lifecycleStatus: 'draft'
    }
  }));

  api.loadDraft();

  assert.equal(appState.draft.id, 'server-draft');
  assert.equal(appState.draft.scenarioTitle, 'Server copy');
  assert.equal(localStorage.getItem('rq_draft_recovery__alex.trafton'), null);
  assert.equal(toasts.length, 0);
});

test('loadDraft promotes recovery draft into session storage and clears the recovery snapshot', () => {
  const { api, appState, localStorage, sessionStorage, toasts } = loadAssessmentStateRuntime();
  localStorage.setItem('rq_draft_recovery__alex.trafton', JSON.stringify({
    savedAt: 123456,
    draft: {
      id: 'recovery-draft',
      scenarioTitle: 'Recovered pilot draft',
      lifecycleStatus: 'draft'
    }
  }));

  api.loadDraft();

  assert.equal(appState.draft.id, 'recovery-draft');
  assert.equal(localStorage.getItem('rq_draft_recovery__alex.trafton'), null);
  const restoredSession = JSON.parse(sessionStorage.getItem('rq_draft__alex.trafton'));
  assert.equal(restoredSession.savedAt, 123456);
  assert.equal(restoredSession.draft.scenarioTitle, 'Recovered pilot draft');
  assert.equal(toasts.length, 1);
  assert.match(toasts[0].message, /recovered your latest draft from this browser/i);
});
