'use strict';

(function attachUserWorkspacePersistence(globalScope) {
  const USER_WORKSPACE_SCHEMA_VERSION = 2;

  function cloneValue(value, fallback) {
    if (value === null || value === undefined) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return fallback;
    }
  }

  function buildDefaultLearningStore() {
    return {
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
      },
      aiMemory: {
        paramHistory: [],
        learnApplied: [],
        reviewerFocus: {},
        execModeUsers: {},
        cloneLearn: [],
        corrActed: [],
        flagSignals: []
      }
    };
  }

  function normaliseMeta(meta = {}) {
    return {
      revision: Number(meta?.revision || 0),
      updatedAt: Number(meta?.updatedAt || 0)
    };
  }

  function normaliseUserSettingsSection(userSettings) {
    return userSettings && typeof userSettings === 'object' ? cloneValue(userSettings, null) : null;
  }

  function normaliseLearningStoreSection(learningStore) {
    const fallback = buildDefaultLearningStore();
    if (!learningStore || typeof learningStore !== 'object') {
      return fallback;
    }
    const cloned = cloneValue(learningStore, {});
    return {
      ...fallback,
      ...cloned,
      templates: cloned.templates && typeof cloned.templates === 'object' ? cloned.templates : fallback.templates,
      scenarioPatterns: Array.isArray(cloned.scenarioPatterns) ? cloned.scenarioPatterns : fallback.scenarioPatterns,
      analystSignals: cloned.analystSignals && typeof cloned.analystSignals === 'object'
        ? { ...fallback.analystSignals, ...cloned.analystSignals }
        : fallback.analystSignals,
      aiFeedback: cloned.aiFeedback && typeof cloned.aiFeedback === 'object'
        ? {
            ...fallback.aiFeedback,
            ...cloned.aiFeedback,
            events: Array.isArray(cloned.aiFeedback.events) ? cloned.aiFeedback.events : fallback.aiFeedback.events
          }
        : fallback.aiFeedback,
      aiMemory: cloned.aiMemory && typeof cloned.aiMemory === 'object'
        ? { ...fallback.aiMemory, ...cloned.aiMemory }
        : fallback.aiMemory
    };
  }

  function normaliseDraftWorkspaceSection(draftWorkspace = {}, legacyDraft = null) {
    const source = draftWorkspace && typeof draftWorkspace === 'object' ? draftWorkspace : {};
    const draft = source.draft && typeof source.draft === 'object'
      ? cloneValue(source.draft, null)
      : legacyDraft && typeof legacyDraft === 'object'
        ? cloneValue(legacyDraft, null)
        : null;
    return {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      draft,
      status: String(source.status || (draft ? 'active' : 'empty')).trim().toLowerCase(),
      lastSavedAt: Number(source.lastSavedAt || 0),
      recoverySnapshotAt: Number(source.recoverySnapshotAt || 0)
    };
  }

  function createSavedAssessmentIndexEntry(assessment = {}) {
    return {
      id: String(assessment.id || '').trim(),
      scenarioTitle: String(assessment.scenarioTitle || '').trim(),
      buName: String(assessment.buName || '').trim(),
      lifecycleStatus: String(assessment.lifecycleStatus || '').trim().toLowerCase(),
      hasResults: !!(assessment.results && typeof assessment.results === 'object'),
      updatedAt: Number(
        assessment.lifecycleUpdatedAt ||
        assessment.completedAt ||
        assessment.archivedAt ||
        assessment.createdAt ||
        Date.now()
      ),
      completedAt: assessment.completedAt || null,
      archivedAt: assessment.archivedAt || null
    };
  }

  function normaliseSavedAssessmentsSection(savedAssessments = {}, legacyAssessments = []) {
    const source = savedAssessments && typeof savedAssessments === 'object' && !Array.isArray(savedAssessments)
      ? savedAssessments
      : {};
    const recordSource = source.itemsById && typeof source.itemsById === 'object'
      ? source.itemsById
      : source.records && typeof source.records === 'object'
        ? source.records
        : null;
    const records = {};
    if (recordSource) {
      Object.keys(recordSource).forEach(id => {
        const item = recordSource[id];
        if (!item || typeof item !== 'object') return;
        const safeId = String(item.id || id || '').trim();
        if (!safeId) return;
        records[safeId] = cloneValue({ ...item, id: safeId }, null);
      });
    } else {
      (Array.isArray(savedAssessments) ? savedAssessments : legacyAssessments).forEach(item => {
        if (!item || typeof item !== 'object' || !item.id) return;
        records[String(item.id).trim()] = cloneValue(item, null);
      });
    }

    const seen = new Set();
    const index = [];
    const sourceIndex = Array.isArray(source.index) ? source.index : [];
    sourceIndex.forEach(entry => {
      const safeId = String(entry?.id || '').trim();
      if (!safeId || !records[safeId] || seen.has(safeId)) return;
      seen.add(safeId);
      index.push({
        ...createSavedAssessmentIndexEntry(records[safeId]),
        ...cloneValue(entry, {})
      });
    });

    Object.keys(records)
      .filter(id => !seen.has(id))
      .sort((left, right) => {
        const a = records[left];
        const b = records[right];
        return Number(
          b?.lifecycleUpdatedAt ||
          b?.completedAt ||
          b?.archivedAt ||
          b?.createdAt ||
          0
        ) - Number(
          a?.lifecycleUpdatedAt ||
          a?.completedAt ||
          a?.archivedAt ||
          a?.createdAt ||
          0
        );
      })
      .forEach(id => {
        seen.add(id);
        index.push(createSavedAssessmentIndexEntry(records[id]));
      });

    return {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      index,
      itemsById: records
    };
  }

  function isSavedAssessmentsDeltaPatch(savedAssessments = {}) {
    const source = savedAssessments && typeof savedAssessments === 'object' && !Array.isArray(savedAssessments)
      ? savedAssessments
      : null;
    return Boolean(
      source && (
        (source.upsertsById && typeof source.upsertsById === 'object')
        || Array.isArray(source.removedIds)
      )
    );
  }

  function normaliseSavedAssessmentsDeltaPatch(savedAssessments = {}) {
    if (!isSavedAssessmentsDeltaPatch(savedAssessments)) return null;
    const source = savedAssessments && typeof savedAssessments === 'object' ? savedAssessments : {};
    const upsertsSource = source.upsertsById && typeof source.upsertsById === 'object'
      ? source.upsertsById
      : {};
    const upsertsById = {};
    Object.keys(upsertsSource).forEach(id => {
      const item = upsertsSource[id];
      if (!item || typeof item !== 'object') return;
      const safeId = String(item.id || id || '').trim();
      if (!safeId) return;
      upsertsById[safeId] = cloneValue({ ...item, id: safeId }, null);
    });
    const removedIds = Array.from(new Set(
      (Array.isArray(source.removedIds) ? source.removedIds : [])
        .map(id => String(id || '').trim())
        .filter(Boolean)
    ));
    removedIds.forEach(id => {
      delete upsertsById[id];
    });
    return {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      upsertsById,
      removedIds
    };
  }

  function buildSavedAssessmentsDeltaPatch(nextSavedAssessments = {}, previousSavedAssessments = {}) {
    const next = normaliseSavedAssessmentsSection(nextSavedAssessments);
    const previous = normaliseSavedAssessmentsSection(previousSavedAssessments);
    const upsertsById = {};
    Object.keys(next.itemsById).forEach(id => {
      const nextItem = next.itemsById[id];
      const previousItem = previous.itemsById[id];
      const nextSnapshot = cloneValue(nextItem, null);
      const previousSnapshot = cloneValue(previousItem, null);
      if (JSON.stringify(nextSnapshot) !== JSON.stringify(previousSnapshot)) {
        upsertsById[id] = nextSnapshot;
      }
    });
    const removedIds = Object.keys(previous.itemsById).filter(id => !next.itemsById[id]);
    return {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      upsertsById,
      removedIds
    };
  }

  function applySavedAssessmentsDeltaPatch(currentSavedAssessments = {}, deltaPatch = {}) {
    const current = normaliseSavedAssessmentsSection(currentSavedAssessments);
    const delta = normaliseSavedAssessmentsDeltaPatch(deltaPatch);
    if (!delta) return current;
    const itemsById = { ...current.itemsById };
    delta.removedIds.forEach(id => {
      delete itemsById[id];
    });
    Object.keys(delta.upsertsById).forEach(id => {
      itemsById[id] = cloneValue(delta.upsertsById[id], null);
    });
    return normaliseSavedAssessmentsSection({ itemsById });
  }

  function mergeSavedAssessmentsDeltaPatches(currentDeltaPatch = {}, nextDeltaPatch = {}) {
    const current = normaliseSavedAssessmentsDeltaPatch(currentDeltaPatch) || {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      upsertsById: {},
      removedIds: []
    };
    const next = normaliseSavedAssessmentsDeltaPatch(nextDeltaPatch) || {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      upsertsById: {},
      removedIds: []
    };
    const mergedUpsertsById = {
      ...current.upsertsById
    };
    const removedIds = new Set(current.removedIds);
    next.removedIds.forEach(id => {
      delete mergedUpsertsById[id];
      removedIds.add(id);
    });
    Object.keys(next.upsertsById).forEach(id => {
      mergedUpsertsById[id] = cloneValue(next.upsertsById[id], null);
      removedIds.delete(id);
    });
    return {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      upsertsById: mergedUpsertsById,
      removedIds: Array.from(removedIds)
    };
  }

  function materializeSavedAssessments(savedAssessments = {}) {
    const normalised = normaliseSavedAssessmentsSection(savedAssessments);
    const list = [];
    const seen = new Set();
    normalised.index.forEach(entry => {
      const safeId = String(entry?.id || '').trim();
      const item = safeId ? normalised.itemsById[safeId] : null;
      if (!item || seen.has(safeId)) return;
      seen.add(safeId);
      list.push(cloneValue(item, {}));
    });
    Object.keys(normalised.itemsById).forEach(id => {
      if (seen.has(id)) return;
      list.push(cloneValue(normalised.itemsById[id], {}));
    });
    return list;
  }

  function buildSavedAssessmentsSection(assessments = []) {
    return normaliseSavedAssessmentsSection({}, Array.isArray(assessments) ? assessments : []);
  }

  function buildDraftWorkspaceSection(draft = null, overrides = {}) {
    return normaliseDraftWorkspaceSection({
      ...(overrides && typeof overrides === 'object' ? overrides : {}),
      draft: draft && typeof draft === 'object' ? draft : null
    });
  }

  function normaliseUserWorkspaceState(state = {}) {
    const source = state && typeof state === 'object' ? state : {};
    const draftWorkspace = normaliseDraftWorkspaceSection(source.draftWorkspace, source.draft);
    const savedAssessments = normaliseSavedAssessmentsSection(source.savedAssessments, source.assessments);
    return {
      schemaVersion: Number(source.schemaVersion || USER_WORKSPACE_SCHEMA_VERSION),
      userSettings: normaliseUserSettingsSection(source.userSettings),
      learningStore: normaliseLearningStoreSection(source.learningStore),
      draftWorkspace,
      savedAssessments,
      draft: draftWorkspace.draft,
      assessments: materializeSavedAssessments(savedAssessments),
      _meta: normaliseMeta(source._meta)
    };
  }

  function applyUserWorkspacePatch(currentState = {}, patch = {}) {
    const current = normaliseUserWorkspaceState(currentState);
    const sourcePatch = patch && typeof patch === 'object' ? patch : {};
    const next = {
      ...current,
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION
    };
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'userSettings')) {
      next.userSettings = normaliseUserSettingsSection(sourcePatch.userSettings);
    }
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'learningStore')) {
      next.learningStore = normaliseLearningStoreSection(sourcePatch.learningStore);
    }
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'draftWorkspace')) {
      next.draftWorkspace = normaliseDraftWorkspaceSection(sourcePatch.draftWorkspace, null);
    } else if (Object.prototype.hasOwnProperty.call(sourcePatch, 'draft')) {
      next.draftWorkspace = buildDraftWorkspaceSection(sourcePatch.draft, {
        lastSavedAt: Number(sourcePatch.draftLastSavedAt || next.draftWorkspace.lastSavedAt || 0),
        recoverySnapshotAt: Number(sourcePatch.draftRecoveryAt || next.draftWorkspace.recoverySnapshotAt || 0)
      });
    }
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'savedAssessments')) {
      next.savedAssessments = isSavedAssessmentsDeltaPatch(sourcePatch.savedAssessments)
        ? applySavedAssessmentsDeltaPatch(next.savedAssessments, sourcePatch.savedAssessments)
        : normaliseSavedAssessmentsSection(sourcePatch.savedAssessments, []);
    } else if (Object.prototype.hasOwnProperty.call(sourcePatch, 'assessments')) {
      next.savedAssessments = buildSavedAssessmentsSection(sourcePatch.assessments);
    }
    next.assessments = materializeSavedAssessments(next.savedAssessments);
    next.draft = next.draftWorkspace.draft;
    return next;
  }

  function listUserWorkspacePatchSlices(patch = {}) {
    const sourcePatch = patch && typeof patch === 'object' ? patch : {};
    const slices = [];
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'userSettings')) slices.push('userSettings');
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'learningStore')) slices.push('learningStore');
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'draftWorkspace') || Object.prototype.hasOwnProperty.call(sourcePatch, 'draft')) slices.push('draftWorkspace');
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'savedAssessments') || Object.prototype.hasOwnProperty.call(sourcePatch, 'assessments')) slices.push('savedAssessments');
    return slices;
  }

  function normaliseUserWorkspacePatch(patch = {}) {
    const sourcePatch = patch && typeof patch === 'object' ? patch : {};
    const nextPatch = {};
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'userSettings')) {
      nextPatch.userSettings = normaliseUserSettingsSection(sourcePatch.userSettings);
    }
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'learningStore')) {
      nextPatch.learningStore = normaliseLearningStoreSection(sourcePatch.learningStore);
    }
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'draftWorkspace')) {
      nextPatch.draftWorkspace = normaliseDraftWorkspaceSection(sourcePatch.draftWorkspace, null);
    } else if (Object.prototype.hasOwnProperty.call(sourcePatch, 'draft')) {
      nextPatch.draftWorkspace = buildDraftWorkspaceSection(sourcePatch.draft, {
        lastSavedAt: Number(sourcePatch.draftLastSavedAt || 0),
        recoverySnapshotAt: Number(sourcePatch.draftRecoveryAt || 0)
      });
    }
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'savedAssessments')) {
      nextPatch.savedAssessments = isSavedAssessmentsDeltaPatch(sourcePatch.savedAssessments)
        ? normaliseSavedAssessmentsDeltaPatch(sourcePatch.savedAssessments)
        : normaliseSavedAssessmentsSection(sourcePatch.savedAssessments, []);
    } else if (Object.prototype.hasOwnProperty.call(sourcePatch, 'assessments')) {
      nextPatch.savedAssessments = buildSavedAssessmentsSection(sourcePatch.assessments);
    }
    return nextPatch;
  }

  function mergeUserWorkspacePatchSlices(currentPatch = {}, patch = {}) {
    const current = normaliseUserWorkspacePatch(currentPatch);
    const next = normaliseUserWorkspacePatch(patch);
    const merged = {
      ...current,
      ...next
    };
    if (Object.prototype.hasOwnProperty.call(current, 'savedAssessments') || Object.prototype.hasOwnProperty.call(next, 'savedAssessments')) {
      if (isSavedAssessmentsDeltaPatch(current.savedAssessments) || isSavedAssessmentsDeltaPatch(next.savedAssessments)) {
        merged.savedAssessments = mergeSavedAssessmentsDeltaPatches(current.savedAssessments, next.savedAssessments);
      } else if (Object.prototype.hasOwnProperty.call(next, 'savedAssessments')) {
        merged.savedAssessments = next.savedAssessments;
      } else {
        merged.savedAssessments = current.savedAssessments;
      }
    }
    return merged;
  }

  function serializeUserWorkspaceState(state = {}) {
    const normalised = normaliseUserWorkspaceState(state);
    return {
      schemaVersion: USER_WORKSPACE_SCHEMA_VERSION,
      userSettings: normalised.userSettings,
      learningStore: normalised.learningStore,
      draftWorkspace: normalised.draftWorkspace,
      savedAssessments: normalised.savedAssessments,
      _meta: normalised._meta
    };
  }

  const exported = {
    USER_WORKSPACE_SCHEMA_VERSION,
    normaliseMeta,
    normaliseUserSettingsSection,
    normaliseLearningStoreSection,
    normaliseDraftWorkspaceSection,
    createSavedAssessmentIndexEntry,
    normaliseSavedAssessmentsSection,
    isSavedAssessmentsDeltaPatch,
    normaliseSavedAssessmentsDeltaPatch,
    buildSavedAssessmentsDeltaPatch,
    applySavedAssessmentsDeltaPatch,
    mergeSavedAssessmentsDeltaPatches,
    materializeSavedAssessments,
    buildSavedAssessmentsSection,
    buildDraftWorkspaceSection,
    normaliseUserWorkspaceState,
    applyUserWorkspacePatch,
    listUserWorkspacePatchSlices,
    normaliseUserWorkspacePatch,
    mergeUserWorkspacePatchSlices,
    serializeUserWorkspaceState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  Object.assign(globalScope, exported);
})(typeof globalThis !== 'undefined' ? globalThis : window);
