'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyWorkspaceSyncQueuedTransition,
  applyWorkspaceSyncScheduledTransition,
  applyWorkspaceSyncStartedTransition,
  applyWorkspaceSyncClearedTransition,
  applyWorkspaceSyncFinishedTransition,
  applyWorkspaceSyncConflictTransition,
  applySimulationStartedTransition,
  applySimulationProgressTransition,
  applySimulationCompletedTransition,
  applySimulationFailedTransition,
  applySimulationCancelledTransition
} = require('../../assets/state/workspaceStateModel.js');

test('workspace sync queue merges patches without dropping the prior queue', () => {
  const next = applyWorkspaceSyncQueuedTransition({
    userStateSyncPending: { draftWorkspace: { draft: { scenarioTitle: 'Existing' }, status: 'active', lastSavedAt: 0, recoverySnapshotAt: 0 } }
  }, {
    userSettings: { geography: 'UAE' }
  });
  assert.deepEqual(next.userStateSyncPending.userSettings, { geography: 'UAE' });
  assert.equal(next.userStateSyncPending.draftWorkspace.schemaVersion, 2);
  assert.equal(next.userStateSyncPending.draftWorkspace.status, 'active');
  assert.equal(next.userStateSyncPending.draftWorkspace.lastSavedAt, 0);
  assert.equal(next.userStateSyncPending.draftWorkspace.recoverySnapshotAt, 0);
  assert.equal(next.userStateSyncPending.draftWorkspace.draft.scenarioTitle, 'Existing');
  assert.equal(next.userStateSyncPending.draftWorkspace.draft.assessmentType, 'enterprise_generic');
  assert.equal(next.userStateSyncPending.draftWorkspace.draft.projectContext.projectRole, 'none');
});

test('workspace sync queue normalises legacy draft and saved assessment patch slices without overwriting untouched slices', () => {
  const next = applyWorkspaceSyncQueuedTransition({
    userStateSyncPending: {
      userSettings: { geography: 'UAE' }
    }
  }, {
    draft: { scenarioTitle: 'New scenario' },
    assessments: [{ id: 'assessment-1', scenarioTitle: 'Saved' }]
  });
  assert.deepEqual(next.userStateSyncPending.userSettings, { geography: 'UAE' });
  assert.equal(next.userStateSyncPending.draftWorkspace.schemaVersion, 2);
  assert.equal(next.userStateSyncPending.draftWorkspace.draft.scenarioTitle, 'New scenario');
  assert.equal(next.userStateSyncPending.savedAssessments.schemaVersion, 2);
  assert.equal(next.userStateSyncPending.savedAssessments.index.length, 1);
  assert.equal(next.userStateSyncPending.savedAssessments.index[0].id, 'assessment-1');
});

test('workspace sync queue merges saved-assessment delta patches by assessment id', () => {
  const next = applyWorkspaceSyncQueuedTransition({
    userStateSyncPending: {
      savedAssessments: {
        upsertsById: {
          'assessment-1': { id: 'assessment-1', scenarioTitle: 'Existing saved assessment' }
        },
        removedIds: []
      }
    }
  }, {
    savedAssessments: {
      upsertsById: {
        'assessment-2': { id: 'assessment-2', scenarioTitle: 'New saved assessment' }
      },
      removedIds: []
    }
  });

  assert.equal(next.userStateSyncPending.savedAssessments.upsertsById['assessment-1'].scenarioTitle, 'Existing saved assessment');
  assert.equal(next.userStateSyncPending.savedAssessments.upsertsById['assessment-2'].scenarioTitle, 'New saved assessment');
  assert.deepEqual(next.userStateSyncPending.savedAssessments.removedIds, []);
});

test('workspace sync started clears the last conflict and marks the sync in flight', () => {
  const next = applyWorkspaceSyncStartedTransition({
    userStateSyncInFlight: false,
    userStateLastConflict: { code: 'WRITE_CONFLICT' }
  });
  assert.equal(next.userStateSyncInFlight, true);
  assert.equal(next.userStateLastConflict, null);
});

test('workspace sync finished clears timers and records the latest save metadata', () => {
  const next = applyWorkspaceSyncFinishedTransition({
    userStateSyncInFlight: true,
    userStateSyncPending: { draft: {} },
    userStateSyncTimer: 42,
    userSettingsSavedAt: 0
  }, {
    updatedAt: 1234
  });
  assert.equal(next.userStateSyncInFlight, false);
  assert.equal(next.userStateSyncPending, null);
  assert.equal(next.userStateSyncTimer, null);
  assert.equal(next.userSettingsSavedAt, 1234);
});

test('workspace sync conflict preserves the error for recovery UI', () => {
  const error = { code: 'WRITE_CONFLICT', message: 'Latest version available' };
  const next = applyWorkspaceSyncConflictTransition({
    userStateSyncInFlight: true,
    userStateLastConflict: null
  }, error);
  assert.equal(next.userStateSyncInFlight, false);
  assert.equal(next.userStateLastConflict, error);
});

test('simulation transitions stay explicit across start, progress, complete, fail, and cancel', () => {
  const started = applySimulationStartedTransition({}, 5000);
  assert.equal(started.simulation.status, 'running');
  assert.equal(started.simulation.progress.total, 5000);
  assert.equal(started.simulation.canCancel, true);

  const progressed = applySimulationProgressTransition(started, {
    completed: 1500,
    total: 5000,
    ratio: 0.3,
    message: 'Working'
  });
  assert.equal(progressed.simulation.progress.completed, 1500);
  assert.equal(progressed.simulation.progress.ratio, 0.3);
  assert.equal(progressed.simulation.progress.message, 'Working');

  const completed = applySimulationCompletedTransition(progressed);
  assert.equal(completed.simulation.status, 'completed');
  assert.equal(completed.simulation.progress.ratio, 1);
  assert.equal(completed.simulation.canCancel, false);

  const failed = applySimulationFailedTransition(started, new Error('Timed out'));
  assert.equal(failed.simulation.status, 'failed');
  assert.equal(failed.simulation.lastError, 'Timed out');

  const cancelled = applySimulationCancelledTransition(started, 'Cancellation requested…');
  assert.equal(cancelled.simulation.status, 'cancelled');
  assert.equal(cancelled.simulation.cancelRequested, true);
  assert.equal(cancelled.simulation.lastError, 'Cancellation requested…');
});

test('workspace sync timer scheduling and clearing are explicit state transitions', () => {
  const scheduled = applyWorkspaceSyncScheduledTransition({ userStateSyncTimer: null }, 99);
  assert.equal(scheduled.userStateSyncTimer, 99);
  const cleared = applyWorkspaceSyncClearedTransition(scheduled);
  assert.equal(cleared.userStateSyncTimer, null);
  assert.equal(cleared.userStateSyncPending, null);
});
