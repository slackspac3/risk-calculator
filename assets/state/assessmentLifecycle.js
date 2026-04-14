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
    if (!value || typeof value !== 'object') return {};
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      // Lifecycle transitions should still proceed if one field is not perfectly serializable.
      return { ...value };
    }
  }

  function buildAssessmentId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    next.structuredScenario = typeof normaliseStructuredScenario === 'function'
      ? normaliseStructuredScenario(next.structuredScenario, { preserveUnknown: true })
      : next.structuredScenario;
    // Saved assessments need stable minimum fields so partial drafts cannot silently corrupt the durable list.
    next.id = String(next.id || '').trim() || buildAssessmentId();
    // Prefer the actual draft start timestamp when it exists so measured cycle time is not reset on first save.
    next.createdAt = Number(next.createdAt || next.startedAt || Date.now());
    next.startedAt = Number(next.startedAt || next.createdAt || Date.now());
    const explicitScenarioTitle = String(next.scenarioTitle || '').trim();
    const preserveExplicitTitle = !!String(next.comparisonBaselineId || '').trim() || /\bcopy$/i.test(explicitScenarioTitle);
    const resolvedScenarioTitle = typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle({
          ...next,
          narrative: String(next.narrative || '').trim(),
          enhancedNarrative: String(next.enhancedNarrative || next.narrative || '').trim()
        })
      : '';
    if (!preserveExplicitTitle && resolvedScenarioTitle) {
      next.scenarioTitle = resolvedScenarioTitle;
    } else if (!String(next.scenarioTitle || '').trim()) {
      const eventPath = typeof getStructuredScenarioField === 'function'
        ? getStructuredScenarioField(next.structuredScenario, 'eventPath')
        : '';
      next.scenarioTitle = String(resolvedScenarioTitle || next.narrative || eventPath || 'Untitled assessment').trim() || 'Untitled assessment';
    }
    if (!String(next.buId || '').trim() && !String(next.buName || '').trim()) {
      next.buName = 'Business unit not set';
    }
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
    const normalized = normaliseAssessmentRecord(next);
    if (options.notificationType) {
      emitAssessmentDecisionNotification(options.notificationType, normalized);
    }
    return normalized;
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

  function emitAssessmentDecisionNotification(type, assessment) {
    if (typeof NotificationService === 'undefined' || !assessment) return null;
    const safeType = String(type || '').trim().toLowerCase();
    const title = String(
      assessment.title
      || assessment.scenarioTitle
      || assessment.draft?.title
      || 'Your assessment'
    ).trim();
    const linkHash = assessment.id ? `#/results/${assessment.id}` : '';
    const notificationMap = {
      review_requested: {
        title: 'Review requested',
        body: `"${title}" was sent for review.`
      },
      changes_requested: {
        title: 'Changes requested',
        body: `"${title}" needs updates before approval.`
      },
      approved: {
        title: 'Assessment approved',
        body: `"${title}" was approved.`
      },
      escalated: {
        title: 'Assessment escalated',
        body: `"${title}" was escalated for management attention.`
      }
    };
    const notification = notificationMap[safeType];
    if (!notification) return null;
    return NotificationService.addNotification(safeType, notification.title, notification.body, linkHash);
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
    emitAssessmentDecisionNotification,
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
