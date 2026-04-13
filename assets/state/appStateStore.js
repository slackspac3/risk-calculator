'use strict';

(function attachAppStateStore(globalScope) {
  const STATE_TRANSITION_LOG_LIMIT = 40;

  function createEmptyUserStateCache(username = '') {
    return {
      username: String(username || '').trim().toLowerCase(),
      userSettings: null,
      assessments: [],
      savedAssessments: null,
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
      draftWorkspace: null,
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

  function createStateTransitionEntry(scope, action, detail = {}) {
    return {
      ts: Date.now(),
      scope: String(scope || 'state'),
      action: String(action || 'UNKNOWN'),
      detail: detail && typeof detail === 'object' ? { ...detail } : {}
    };
  }

  function appendStateTransitionLog(state, scope, action, detail = {}) {
    const nextLog = Array.isArray(state?.stateTransitionLog) ? state.stateTransitionLog.slice() : [];
    nextLog.unshift(createStateTransitionEntry(scope, action, detail));
    if (nextLog.length > STATE_TRANSITION_LOG_LIMIT) {
      nextLog.splice(STATE_TRANSITION_LOG_LIMIT);
    }
    return {
      ...state,
      stateTransitionLog: nextLog
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
        savedAssessments: source.savedAssessments && typeof source.savedAssessments === 'object' ? source.savedAssessments : fallback.savedAssessments,
        learningStore: source.learningStore && typeof source.learningStore === 'object' ? source.learningStore : fallback.learningStore,
        draft: source.draft && typeof source.draft === 'object' ? normaliseDraftState(source.draft) : fallback.draft,
        draftWorkspace: source.draftWorkspace && typeof source.draftWorkspace === 'object' ? source.draftWorkspace : fallback.draftWorkspace,
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

  function normaliseLlmContext(messages = []) {
    const source = Array.isArray(messages) ? messages : [];
    return source
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        role: String(item.role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').trim()
      }))
      .filter(item => item.content)
      .slice(-20);
  }

  const DRAFT_LLM_CONTEXT_KEYS = new Set([
    'llmContext',
    'step1LlmContext',
    'step2LlmContext',
    'step3LlmContext'
  ]);

  function getDraftLlmContextKey(value = 'llmContext') {
    const key = String(value || '').trim();
    return DRAFT_LLM_CONTEXT_KEYS.has(key) ? key : 'llmContext';
  }

  function normaliseDraftState(draft) {
    const source = draft && typeof draft === 'object' ? draft : {};
    const legacyContext = normaliseLlmContext(source.llmContext);
    return {
      ...source,
      llmContext: legacyContext,
      step1LlmContext: normaliseLlmContext(
        Array.isArray(source.step1LlmContext) ? source.step1LlmContext : legacyContext
      ),
      step2LlmContext: normaliseLlmContext(source.step2LlmContext),
      step3LlmContext: normaliseLlmContext(source.step3LlmContext),
      step1ConversationFingerprint: String(source.step1ConversationFingerprint || '').trim(),
      step2ConversationFingerprint: String(source.step2ConversationFingerprint || '').trim(),
      step3ConversationFingerprint: String(source.step3ConversationFingerprint || '').trim()
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

  function reduceDraftAction(state, type, payload = {}) {
    const actionType = String(type || '').trim().toUpperCase();
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    if (actionType === 'SET_DRAFT') {
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draft: safePayload.draft,
        draftDirty: safePayload.draftDirty,
        draftLastSavedAt: safePayload.draftLastSavedAt,
        draftSaveTimer: safePayload.draftSaveTimer
      }), 'draft', actionType, {
        keys: Object.keys(safePayload.draft || {})
      });
    }
    if (actionType === 'MERGE_DRAFT') {
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draft: {
          ...(state?.draft || {}),
          ...(safePayload.patch || {})
        },
        draftDirty: safePayload.draftDirty,
        draftLastSavedAt: safePayload.draftLastSavedAt,
        draftSaveTimer: safePayload.draftSaveTimer
      }), 'draft', actionType, {
        keys: Object.keys(safePayload.patch || {})
      });
    }
    if (actionType === 'MARK_DRAFT_DIRTY') {
      return appendStateTransitionLog(applyDraftAssessmentState(state, { draftDirty: true }), 'draft', actionType);
    }
    if (actionType === 'MARK_DRAFT_SAVED') {
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draftDirty: false,
        draftLastSavedAt: Number(safePayload.at || Date.now())
      }), 'draft', actionType, {
        at: Number(safePayload.at || Date.now())
      });
    }
    if (actionType === 'SET_DRAFT_SAVE_TIMER') {
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draftSaveTimer: safePayload.timer ?? null
      }), 'draft', actionType, {
        active: !!safePayload.timer
      });
    }
    if (actionType === 'RESET_DRAFT') {
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draft: {
          ...(safePayload.draft && typeof safePayload.draft === 'object' ? safePayload.draft : {}),
          llmContext: [],
          step1LlmContext: [],
          step2LlmContext: [],
          step3LlmContext: [],
          step1ConversationFingerprint: '',
          step2ConversationFingerprint: '',
          step3ConversationFingerprint: ''
        },
        draftDirty: false,
        draftLastSavedAt: 0,
        draftSaveTimer: null
      }), 'draft', actionType, {
        id: safePayload.draft?.id || ''
      });
    }
    if (actionType === 'APPEND_LLM_CONTEXT') {
      const contextKey = getDraftLlmContextKey(safePayload.contextKey);
      const nextContext = normaliseLlmContext([
        ...(state?.draft?.[contextKey] || []),
        { role: 'user', content: String(safePayload.user || '').trim() },
        { role: 'assistant', content: String(safePayload.assistant || '').trim() }
      ]);
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draft: {
          ...(state?.draft || {}),
          [contextKey]: nextContext
        }
      }), 'draft', actionType, {
        contextKey,
        messages: nextContext.length
      });
    }
    if (actionType === 'CLEAR_LLM_CONTEXT') {
      if (safePayload.all === true) {
        return appendStateTransitionLog(applyDraftAssessmentState(state, {
          draft: {
            ...(state?.draft || {}),
            llmContext: [],
            step1LlmContext: [],
            step2LlmContext: [],
            step3LlmContext: []
          }
        }), 'draft', actionType, {
          contextKey: 'all'
        });
      }
      const contextKey = getDraftLlmContextKey(safePayload.contextKey);
      return appendStateTransitionLog(applyDraftAssessmentState(state, {
        draft: {
          ...(state?.draft || {}),
          [contextKey]: []
        }
      }), 'draft', actionType, {
        contextKey
      });
    }
    return state;
  }

  function reduceSimulationAction(state, type, payload = {}) {
    const actionType = String(type || '').trim().toUpperCase();
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    if (actionType === 'RESET_SIMULATION') {
      return appendStateTransitionLog(applySimulationState(state, createSimulationState()), 'simulation', actionType);
    }
    if (actionType === 'START_SIMULATION') {
      return appendStateTransitionLog(applySimulationState(state, {
        status: 'running',
        canCancel: true,
        cancelRequested: false,
        lastRunAt: Number(safePayload.at || Date.now()),
        lastError: '',
        progress: {
          completed: 0,
          total: Number(safePayload.total || 0),
          ratio: 0,
          message: ''
        }
      }), 'simulation', actionType, {
        total: Number(safePayload.total || 0)
      });
    }
    if (actionType === 'UPDATE_SIMULATION_PROGRESS') {
      return appendStateTransitionLog(applySimulationState(state, {
        status: 'running',
        canCancel: true,
        progress: {
          completed: Number(safePayload.completed || 0),
          total: Number(safePayload.total || 0),
          ratio: Number(safePayload.ratio || 0),
          message: String(safePayload.message || '').trim()
        }
      }), 'simulation', actionType, {
        completed: Number(safePayload.completed || 0),
        total: Number(safePayload.total || 0)
      });
    }
    if (actionType === 'COMPLETE_SIMULATION') {
      return appendStateTransitionLog(applySimulationState(state, {
        status: 'completed',
        canCancel: false,
        cancelRequested: false,
        lastError: ''
      }), 'simulation', actionType);
    }
    if (actionType === 'FAIL_SIMULATION') {
      return appendStateTransitionLog(applySimulationState(state, {
        status: 'failed',
        canCancel: false,
        cancelRequested: false,
        lastError: String(safePayload.error?.message || safePayload.error || '').trim()
      }), 'simulation', actionType, {
        error: String(safePayload.error?.message || safePayload.error || '').trim()
      });
    }
    if (actionType === 'CANCEL_SIMULATION') {
      return appendStateTransitionLog(applySimulationState(state, {
        status: 'cancelling',
        canCancel: false,
        cancelRequested: true,
        progress: {
          ...(state?.simulation?.progress || {}),
          message: String(safePayload.message || 'Cancellation requested…').trim()
        }
      }), 'simulation', actionType, {
        message: String(safePayload.message || 'Cancellation requested…').trim()
      });
    }
    return state;
  }

  function writeAppState(nextState) {
    Object.assign(AppState, nextState);
    const latestTransition = Array.isArray(nextState?.stateTransitionLog) ? nextState.stateTransitionLog[0] : null;
    if (latestTransition && globalScope.__RQ_DEBUG_STATE__ && typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[rq-state]', latestTransition.scope, latestTransition.action, latestTransition.detail || {});
    }
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

  function dispatchDraftAction(type, payload = {}) {
    const actionType = String(type || '').trim().toUpperCase();
    const preparedState = actionType === 'RESET_DRAFT'
      ? reduceDraftAction(AppState, 'CLEAR_LLM_CONTEXT', { all: true })
      : AppState;
    return writeAppState(reduceDraftAction(preparedState, type, payload));
  }

  function updateSimulationLifecycleState(updates = {}) {
    return writeAppState(applySimulationState(AppState, updates));
  }

  function dispatchSimulationAction(type, payload = {}) {
    return writeAppState(reduceSimulationAction(AppState, type, payload));
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
    reduceDraftAction,
    reduceSimulationAction,
    updateAuthSessionState,
    resetAuthSessionState,
    updateUserStateCache,
    resetUserStateCache,
    updateAdminSettingsState,
    clearAdminSettingsState,
    updateDraftAssessmentState,
    dispatchDraftAction,
    updateSimulationLifecycleState,
    dispatchSimulationAction,
    resetSimulationLifecycleState
  };

  Object.assign(globalScope, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
