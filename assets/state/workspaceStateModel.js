'use strict';

(function attachWorkspaceStateModel(globalScope) {
  const storeApi = typeof require === 'function'
    ? (() => {
        try {
          return require('./appStateStore.js');
        } catch {
          return null;
        }
      })()
    : null;

  const createSimulation = (overrides = {}) => {
    if (storeApi?.createSimulationState) return storeApi.createSimulationState(overrides);
    if (typeof globalScope.createSimulationState === 'function') return globalScope.createSimulationState(overrides);
    const progress = overrides.progress && typeof overrides.progress === 'object' ? overrides.progress : {};
    return {
      status: 'idle',
      canCancel: false,
      cancelRequested: false,
      progress: {
        completed: 0,
        total: 0,
        ratio: 0,
        message: '',
        ...progress
      },
      lastRunAt: 0,
      lastError: '',
      ...overrides
    };
  };

  function applyWorkspaceSyncQueuedTransition(state, patch = {}) {
    return {
      ...state,
      userStateSyncPending: {
        ...(state?.userStateSyncPending || {}),
        ...(patch && typeof patch === 'object' ? patch : {})
      }
    };
  }

  function applyWorkspaceSyncScheduledTransition(state, timer) {
    return {
      ...state,
      userStateSyncTimer: timer ?? null
    };
  }

  function applyWorkspaceSyncStartedTransition(state) {
    return {
      ...state,
      userStateSyncInFlight: true,
      userStateLastConflict: null
    };
  }

  function applyWorkspaceSyncClearedTransition(state) {
    return {
      ...state,
      userStateSyncPending: null,
      userStateSyncTimer: null
    };
  }

  function applyWorkspaceSyncFinishedTransition(state, meta = {}) {
    return {
      ...state,
      userStateSyncInFlight: false,
      userStateSyncPending: null,
      userStateSyncTimer: null,
      userSettingsSavedAt: Number(meta.updatedAt || state?.userSettingsSavedAt || 0)
    };
  }

  function applyWorkspaceSyncFailedTransition(state) {
    return {
      ...state,
      userStateSyncInFlight: false
    };
  }

  function applyWorkspaceSyncConflictTransition(state, error = null) {
    return {
      ...state,
      userStateSyncInFlight: false,
      userStateLastConflict: error || null
    };
  }

  function applySimulationStartedTransition(state, total = 0) {
    return {
      ...state,
      simulation: createSimulation({
        ...(state?.simulation || {}),
        status: 'running',
        canCancel: true,
        cancelRequested: false,
        lastRunAt: Date.now(),
        lastError: '',
        progress: {
          completed: 0,
          total: Number(total || 0),
          ratio: 0,
          message: ''
        }
      })
    };
  }

  function applySimulationProgressTransition(state, progress = {}) {
    return {
      ...state,
      simulation: createSimulation({
        ...(state?.simulation || {}),
        status: 'running',
        canCancel: true,
        progress: {
          completed: Number(progress.completed || 0),
          total: Number(progress.total || 0),
          ratio: Number(progress.ratio || 0),
          message: String(progress.message || '').trim()
        }
      })
    };
  }

  function applySimulationCompletedTransition(state) {
    return {
      ...state,
      simulation: createSimulation({
        ...(state?.simulation || {}),
        status: 'completed',
        canCancel: false,
        cancelRequested: false,
        lastError: '',
        progress: {
          ...(state?.simulation?.progress || {}),
          ratio: 1
        }
      })
    };
  }

  function applySimulationFailedTransition(state, error = null) {
    return {
      ...state,
      simulation: createSimulation({
        ...(state?.simulation || {}),
        status: 'failed',
        canCancel: false,
        cancelRequested: false,
        lastError: String(error?.message || error?.code || 'Simulation failed')
      })
    };
  }

  function applySimulationCancelledTransition(state, message = 'Cancellation requested…') {
    return {
      ...state,
      simulation: createSimulation({
        ...(state?.simulation || {}),
        status: 'cancelled',
        canCancel: false,
        cancelRequested: true,
        lastError: String(message || 'Cancellation requested…')
      })
    };
  }

  const api = {
    applyWorkspaceSyncQueuedTransition,
    applyWorkspaceSyncScheduledTransition,
    applyWorkspaceSyncStartedTransition,
    applyWorkspaceSyncClearedTransition,
    applyWorkspaceSyncFinishedTransition,
    applyWorkspaceSyncFailedTransition,
    applyWorkspaceSyncConflictTransition,
    applySimulationStartedTransition,
    applySimulationProgressTransition,
    applySimulationCompletedTransition,
    applySimulationFailedTransition,
    applySimulationCancelledTransition
  };

  Object.assign(globalScope, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
