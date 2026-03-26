'use strict';

(function attachAppStateStore(globalScope) {
  function createEmptyUserStateCache(username = '') {
    return {
      username: String(username || '').trim().toLowerCase(),
      userSettings: null,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: {
        revision: 0,
        updatedAt: 0
      }
    };
  }

  function createSimulationState(overrides = {}) {
    const base = {
      status: 'idle',
      canCancel: false,
      cancelRequested: false,
      progress: {
        completed: 0,
        total: 0,
        ratio: 0,
        message: ''
      },
      lastRunAt: 0,
      lastError: ''
    };
    const next = overrides && typeof overrides === 'object' ? overrides : {};
    const progress = next.progress && typeof next.progress === 'object' ? next.progress : {};
    return {
      ...base,
      ...next,
      progress: {
        ...base.progress,
        ...progress
      }
    };
  }

  function applyAuthSessionState(state, updates = {}) {
    return {
      ...state,
      currentUser: updates.currentUser !== undefined ? updates.currentUser : state.currentUser,
      adminVisiblePasswords: updates.adminVisiblePasswords !== undefined ? updates.adminVisiblePasswords : state.adminVisiblePasswords
    };
  }

  function applyUserStateCache(state, nextCache) {
    const fallback = createEmptyUserStateCache(nextCache?.username || state?.userStateCache?.username || '');
    const source = nextCache && typeof nextCache === 'object' ? nextCache : {};
    return {
      ...state,
      userStateCache: {
        ...fallback,
        ...source,
        username: String(source.username || fallback.username || '').trim().toLowerCase(),
        assessments: Array.isArray(source.assessments) ? source.assessments : fallback.assessments,
        learningStore: source.learningStore && typeof source.learningStore === 'object' ? source.learningStore : fallback.learningStore,
        draft: source.draft && typeof source.draft === 'object' ? source.draft : fallback.draft,
        _meta: {
          revision: Number(source._meta?.revision || fallback._meta.revision || 0),
          updatedAt: Number(source._meta?.updatedAt || fallback._meta.updatedAt || 0)
        }
      }
    };
  }

  function applyAdminSettingsState(state, adminSettingsCache) {
    return {
      ...state,
      adminSettingsCache: adminSettingsCache || null
    };
  }

  function applyDraftAssessmentState(state, updates = {}) {
    const nextDraft = updates.draft !== undefined ? updates.draft : state.draft;
    return {
      ...state,
      draft: nextDraft && typeof nextDraft === 'object' ? nextDraft : {},
      draftDirty: updates.draftDirty !== undefined ? !!updates.draftDirty : state.draftDirty,
      draftLastSavedAt: updates.draftLastSavedAt !== undefined ? Number(updates.draftLastSavedAt || 0) : state.draftLastSavedAt,
      draftSaveTimer: updates.draftSaveTimer !== undefined ? updates.draftSaveTimer : state.draftSaveTimer
    };
  }

  function applySimulationState(state, updates = {}) {
    return {
      ...state,
      simulation: createSimulationState({
        ...(state?.simulation || {}),
        ...(updates && typeof updates === 'object' ? updates : {})
      })
    };
  }

  function writeAppState(nextState) {
    Object.assign(AppState, nextState);
    return AppState;
  }

  function updateAuthSessionState(updates = {}) {
    return writeAppState(applyAuthSessionState(AppState, updates));
  }

  function resetAuthSessionState() {
    return updateAuthSessionState({
      currentUser: null,
      adminVisiblePasswords: {}
    });
  }

  function updateUserStateCache(nextCache) {
    return writeAppState(applyUserStateCache(AppState, nextCache));
  }

  function resetUserStateCache(username = '') {
    return updateUserStateCache(createEmptyUserStateCache(username));
  }

  function updateAdminSettingsState(nextSettings) {
    return writeAppState(applyAdminSettingsState(AppState, nextSettings));
  }

  function clearAdminSettingsState() {
    return updateAdminSettingsState(null);
  }

  function updateDraftAssessmentState(updates = {}) {
    return writeAppState(applyDraftAssessmentState(AppState, updates));
  }

  function updateSimulationLifecycleState(updates = {}) {
    return writeAppState(applySimulationState(AppState, updates));
  }

  function resetSimulationLifecycleState() {
    return updateSimulationLifecycleState(createSimulationState());
  }

  const api = {
    createEmptyUserStateCache,
    createSimulationState,
    applyAuthSessionState,
    applyUserStateCache,
    applyAdminSettingsState,
    applyDraftAssessmentState,
    applySimulationState,
    updateAuthSessionState,
    resetAuthSessionState,
    updateUserStateCache,
    resetUserStateCache,
    updateAdminSettingsState,
    clearAdminSettingsState,
    updateDraftAssessmentState,
    updateSimulationLifecycleState,
    resetSimulationLifecycleState
  };

  Object.assign(globalScope, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
