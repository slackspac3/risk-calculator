'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ASSESSMENT_LIFECYCLE_STATUS,
  normaliseAssessmentRecord,
  canTransitionAssessmentLifecycle,
  transitionAssessmentLifecycle,
  restoreAssessmentLifecycle,
  getAssessmentLifecyclePresentation
} = require('../../assets/state/assessmentLifecycle.js');

test('normaliseAssessmentRecord migrates legacy draft assessments', () => {
  const assessment = normaliseAssessmentRecord({
    id: 'a-1',
    scenarioTitle: 'Legacy draft'
  });
  assert.equal(assessment.lifecycleStatus, ASSESSMENT_LIFECYCLE_STATUS.DRAFT);
  assert.equal(assessment.lifecycleFlags.treatmentVariant, false);
  assert.equal(assessment.lifecycleFlags.baselineLocked, false);
});

test('normaliseAssessmentRecord derives review and treatment statuses from legacy fields', () => {
  const reviewCase = normaliseAssessmentRecord({
    id: 'a-2',
    results: { nearTolerance: true }
  });
  assert.equal(reviewCase.lifecycleStatus, ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW);

  const treatmentCase = normaliseAssessmentRecord({
    id: 'a-3',
    comparisonBaselineId: 'base-1',
    results: { nearTolerance: false }
  });
  assert.equal(treatmentCase.lifecycleStatus, ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT);
});

test('transitionAssessmentLifecycle archives and restores the prior active status', () => {
  const archived = transitionAssessmentLifecycle({
    id: 'a-4',
    results: { nearTolerance: true }
  }, ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED, {
    at: '2026-03-26T10:00:00.000Z'
  });
  assert.equal(archived.lifecycleStatus, ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED);
  assert.equal(archived.lifecycleMeta.previousStatus, ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW);
  assert.equal(archived.archivedAt, '2026-03-26T10:00:00.000Z');

  const restored = restoreAssessmentLifecycle(archived, {
    at: '2026-03-26T10:05:00.000Z'
  });
  assert.equal(restored.lifecycleStatus, ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW);
  assert.equal(restored.archivedAt, undefined);
});

test('baseline locking is only valid for simulated assessments', () => {
  const invalid = canTransitionAssessmentLifecycle({
    id: 'a-5',
    scenarioTitle: 'Unsimulated draft'
  }, ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED);
  assert.equal(invalid.ok, false);

  const locked = transitionAssessmentLifecycle({
    id: 'a-6',
    results: { nearTolerance: false }
  }, ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED, {
    at: '2026-03-26T11:00:00.000Z'
  });
  assert.equal(locked.lifecycleStatus, ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED);
  assert.equal(locked.lifecycleFlags.baselineLocked, true);
});

test('lifecycle presentation exposes stable UI labels', () => {
  const presentation = getAssessmentLifecyclePresentation({
    id: 'a-7',
    comparisonBaselineId: 'base-7'
  });
  assert.equal(presentation.label, 'Treatment variant');
  assert.equal(presentation.tone, 'gold');
});
