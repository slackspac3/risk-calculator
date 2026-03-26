'use strict';

(function attachAssessmentLifecycle(globalScope) {
  const ASSESSMENT_LIFECYCLE_STATUS = Object.freeze({
    DRAFT: 'draft',
    READY_FOR_REVIEW: 'ready_for_review',
    SIMULATED: 'simulated',
    ARCHIVED: 'archived',
    BASELINE_LOCKED: 'baseline_locked',
    TREATMENT_VARIANT: 'treatment_variant'
  });

  const ACTIVE_STATUS_ORDER = [
    ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT,
    ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED,
    ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
    ASSESSMENT_LIFECYCLE_STATUS.SIMULATED,
    ASSESSMENT_LIFECYCLE_STATUS.DRAFT
  ];

  const VALID_TRANSITIONS = Object.freeze({
    [ASSESSMENT_LIFECYCLE_STATUS.DRAFT]: new Set([
      ASSESSMENT_LIFECYCLE_STATUS.DRAFT,
      ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
      ASSESSMENT_LIFECYCLE_STATUS.SIMULATED,
      ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED,
      ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT
    ]),
    [ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW]: new Set([
      ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
      ASSESSMENT_LIFECYCLE_STATUS.SIMULATED,
      ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED,
      ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED
    ]),
    [ASSESSMENT_LIFECYCLE_STATUS.SIMULATED]: new Set([
      ASSESSMENT_LIFECYCLE_STATUS.SIMULATED,
      ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
      ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED,
      ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED
    ]),
    [ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED]: new Set([
      ASSESSMENT_LIFECYCLE_STATUS.DRAFT,
      ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
      ASSESSMENT_LIFECYCLE_STATUS.SIMULATED,
      ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED,
      ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT,
      ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED
    ]),
    [ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED]: new Set([
      ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED,
      ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED,
      ASSESSMENT_LIFECYCLE_STATUS.SIMULATED
    ]),
    [ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT]: new Set([
      ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT,
      ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
      ASSESSMENT_LIFECYCLE_STATUS.SIMULATED,
      ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED
    ])
  });

  function cloneAssessment(value) {
    return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
  }

  function hasResults(assessment) {
    return !!(assessment && assessment.results && typeof assessment.results === 'object');
  }

  function needsReview(assessment) {
    return !!(assessment?.results && (
      assessment.results.toleranceBreached ||
      assessment.results.nearTolerance ||
      assessment.results.annualReviewTriggered
    ));
  }

  function isTreatmentVariantAssessment(assessment) {
    return !!String(assessment?.comparisonBaselineId || '').trim();
  }

  function isBaselineLockedAssessment(assessment) {
    return !!(assessment?.lifecycleFlags?.baselineLocked || assessment?.baselineLockedAt);
  }

  function deriveActiveAssessmentLifecycleStatus(assessment) {
    if (isTreatmentVariantAssessment(assessment)) return ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT;
    if (isBaselineLockedAssessment(assessment)) return ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED;
    if (hasResults(assessment) && needsReview(assessment)) return ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW;
    if (hasResults(assessment)) return ASSESSMENT_LIFECYCLE_STATUS.SIMULATED;
    return ASSESSMENT_LIFECYCLE_STATUS.DRAFT;
  }

  function isCompatibleExplicitLifecycleStatus(assessment, lifecycleStatus) {
    if (!Object.values(ASSESSMENT_LIFECYCLE_STATUS).includes(lifecycleStatus)) return false;
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED) return !!assessment?.archivedAt;
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED) return hasResults(assessment);
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT) return isTreatmentVariantAssessment(assessment);
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW) return hasResults(assessment);
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.SIMULATED) return hasResults(assessment);
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.DRAFT) return !hasResults(assessment);
    return false;
  }

  function deriveAssessmentLifecycleStatus(assessment) {
    if (assessment?.archivedAt) return ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED;
    const explicitStatus = String(assessment?.lifecycleStatus || '').trim().toLowerCase();
    if (isCompatibleExplicitLifecycleStatus(assessment, explicitStatus)) return explicitStatus;
    return deriveActiveAssessmentLifecycleStatus(assessment);
  }

  function normaliseLifecycleFlags(assessment) {
    return {
      baselineLocked: isBaselineLockedAssessment(assessment),
      treatmentVariant: isTreatmentVariantAssessment(assessment)
    };
  }

  function normaliseAssessmentRecord(assessment) {
    const next = cloneAssessment(assessment);
    const lifecycleStatus = deriveAssessmentLifecycleStatus(next);
    const lifecycleFlags = normaliseLifecycleFlags(next);
    const lifecycleMeta = next.lifecycleMeta && typeof next.lifecycleMeta === 'object' ? { ...next.lifecycleMeta } : {};
    return {
      ...next,
      lifecycleStatus,
      lifecycleFlags,
      lifecycleMeta,
      lifecycleUpdatedAt: Number(next.lifecycleUpdatedAt || next.archivedAt || next.completedAt || next.createdAt || Date.now())
    };
  }

  function canTransitionAssessmentLifecycle(assessment, targetStatus) {
    const current = normaliseAssessmentRecord(assessment);
    const target = String(targetStatus || '').trim().toLowerCase();
    if (!Object.values(ASSESSMENT_LIFECYCLE_STATUS).includes(target)) {
      return {
        ok: false,
        currentStatus: current.lifecycleStatus,
        reason: `Unknown assessment lifecycle status "${targetStatus}".`
      };
    }
    const allowedTargets = VALID_TRANSITIONS[current.lifecycleStatus] || new Set();
    if (!allowedTargets.has(target)) {
      return {
        ok: false,
        currentStatus: current.lifecycleStatus,
        reason: `Assessment cannot move from ${current.lifecycleStatus} to ${target}.`
      };
    }
    if (target === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED && !hasResults(current)) {
      return {
        ok: false,
        currentStatus: current.lifecycleStatus,
        reason: 'Only simulated assessments can be locked as a baseline.'
      };
    }
    if (target === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT && !isTreatmentVariantAssessment(current)) {
      return {
        ok: false,
        currentStatus: current.lifecycleStatus,
        reason: 'Treatment variants require a saved baseline reference.'
      };
    }
    return {
      ok: true,
      currentStatus: current.lifecycleStatus
    };
  }

  function transitionAssessmentLifecycle(assessment, targetStatus, options = {}) {
    const current = normaliseAssessmentRecord(assessment);
    const validation = canTransitionAssessmentLifecycle(current, targetStatus);
    if (!validation.ok) {
      const err = new Error(validation.reason || 'Invalid assessment lifecycle transition.');
      err.code = 'INVALID_ASSESSMENT_LIFECYCLE_TRANSITION';
      err.currentStatus = validation.currentStatus;
      err.targetStatus = targetStatus;
      throw err;
    }
    const at = options.at || new Date().toISOString();
    const next = cloneAssessment(current);
    const target = String(targetStatus || '').trim().toLowerCase();
    next.lifecycleMeta = next.lifecycleMeta && typeof next.lifecycleMeta === 'object' ? { ...next.lifecycleMeta } : {};
    next.lifecycleFlags = normaliseLifecycleFlags(next);
    if (target === ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED) {
      next.archivedAt = at;
      next.lifecycleMeta.previousStatus = current.lifecycleStatus;
    } else {
      delete next.archivedAt;
      if (target === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED) {
        next.baselineLockedAt = next.baselineLockedAt || at;
        next.lifecycleFlags.baselineLocked = true;
      } else if (target !== ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED) {
        delete next.baselineLockedAt;
        next.lifecycleFlags.baselineLocked = false;
      }
    }
    next.lifecycleStatus = target;
    next.lifecycleUpdatedAt = Date.parse(at) || Date.now();
    next.lifecycleFlags.treatmentVariant = isTreatmentVariantAssessment(next);
    return normaliseAssessmentRecord(next);
  }

  function restoreAssessmentLifecycle(assessment, options = {}) {
    const current = normaliseAssessmentRecord(assessment);
    const preferredStatus = current.lifecycleMeta?.previousStatus;
    const fallbackBase = cloneAssessment(current);
    delete fallbackBase.archivedAt;
    const fallbackStatus = deriveActiveAssessmentLifecycleStatus(fallbackBase);
    const targetStatus = Object.values(ASSESSMENT_LIFECYCLE_STATUS).includes(preferredStatus)
      && preferredStatus !== ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED
      ? preferredStatus
      : fallbackStatus;
    return transitionAssessmentLifecycle(current, targetStatus, options);
  }

  function getAssessmentLifecyclePresentation(assessment) {
    const current = normaliseAssessmentRecord(assessment);
    const map = {
      [ASSESSMENT_LIFECYCLE_STATUS.DRAFT]: {
        label: 'Draft',
        tone: 'neutral',
        summary: 'Work in progress'
      },
      [ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW]: {
        label: 'Ready for review',
        tone: 'warning',
        summary: 'Result needs review'
      },
      [ASSESSMENT_LIFECYCLE_STATUS.SIMULATED]: {
        label: 'Simulated',
        tone: 'success',
        summary: 'Saved result'
      },
      [ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED]: {
        label: 'Archived',
        tone: 'neutral',
        summary: 'Stored out of the main workspace'
      },
      [ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED]: {
        label: 'Baseline locked',
        tone: 'gold',
        summary: 'Protected as a comparison baseline'
      },
      [ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT]: {
        label: 'Treatment variant',
        tone: 'gold',
        summary: 'Alternative future-state case'
      }
    };
    return {
      status: current.lifecycleStatus,
      ...(map[current.lifecycleStatus] || map[ASSESSMENT_LIFECYCLE_STATUS.DRAFT])
    };
  }

  function prepareAssessmentForSave(assessment, options = {}) {
    const merged = options.existingAssessment
      ? { ...cloneAssessment(options.existingAssessment), ...cloneAssessment(assessment) }
      : cloneAssessment(assessment);
    if (options.targetStatus) {
      return transitionAssessmentLifecycle(merged, options.targetStatus, options);
    }
    return normaliseAssessmentRecord(merged);
  }

  const exported = {
    ASSESSMENT_LIFECYCLE_STATUS,
    ACTIVE_STATUS_ORDER,
    deriveAssessmentLifecycleStatus,
    normaliseAssessmentRecord,
    canTransitionAssessmentLifecycle,
    transitionAssessmentLifecycle,
    restoreAssessmentLifecycle,
    prepareAssessmentForSave,
    hasResults,
    needsReview,
    isTreatmentVariantAssessment,
    isBaselineLockedAssessment,
    getAssessmentLifecyclePresentation
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  Object.assign(globalScope, exported);
})(typeof globalThis !== 'undefined' ? globalThis : window);
