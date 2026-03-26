'use strict';

// Shared assessment, draft, and learning-state helpers extracted from app.js.

function getAssessments() {
  const cache = ensureUserStateCache();
  if (Array.isArray(cache.assessments)) {
    cache.assessments = cache.assessments.map(item => normaliseAssessmentRecord(item));
    return cache.assessments;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX)) || '[]');
    cache.assessments = Array.isArray(saved) ? saved.map(item => normaliseAssessmentRecord(item)) : [];
  } catch {
    cache.assessments = [];
  }
  return cache.assessments;
}
function saveAssessment(a, options = {}) {
  const list = getAssessments().slice();
  const idx = list.findIndex(x => x.id === a.id);
  const current = idx > -1 ? list[idx] : null;
  const nextAssessment = prepareAssessmentForSave(a, {
    existingAssessment: current,
    targetStatus: options.targetStatus || '',
    at: options.at
  });
  if (idx > -1) list[idx] = nextAssessment; else list.unshift(nextAssessment);
  const cache = ensureUserStateCache();
  cache.assessments = list;
  localStorage.setItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX), JSON.stringify(list));
  queueSharedUserStateSync({ assessments: list });
  return nextAssessment;
}
function updateAssessmentRecord(id, updater, options = {}) {
  const list = getAssessments().slice();
  const idx = list.findIndex(item => item.id === id);
  if (idx < 0) return null;
  const current = list[idx];
  const candidate = typeof updater === 'function' ? updater(current) : { ...current, ...(updater || {}) };
  const next = prepareAssessmentForSave(candidate, {
    existingAssessment: current,
    targetStatus: options.targetStatus || '',
    at: options.at
  });
  list[idx] = next;
  const cache = ensureUserStateCache();
  cache.assessments = list;
  localStorage.setItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX), JSON.stringify(list));
  queueSharedUserStateSync({ assessments: list });
  return next;
}
function deleteAssessment(id) {
  const existing = getAssessments().slice();
  const list = existing.filter(item => item.id !== id);
  if (list.length === existing.length) return false;
  const cache = ensureUserStateCache();
  cache.assessments = list;
  localStorage.setItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX), JSON.stringify(list));
  queueSharedUserStateSync({ assessments: list });
  return true;
}
function archiveAssessment(id) {
  return Boolean(updateAssessmentRecord(id, assessment => assessment, {
    targetStatus: ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED,
    at: new Date().toISOString()
  }));
}
function unarchiveAssessment(id) {
  return updateAssessmentRecord(id, assessment => restoreAssessmentLifecycle(assessment, {
    at: new Date().toISOString()
  }));
}
function archiveCurrentDraft() {
  ensureDraftShape();
  const draftTitle = String(AppState.draft?.scenarioTitle || AppState.draft?.narrative || '').trim();
  if (!draftTitle) return null;
  const archived = prepareAssessmentForSave({
    ...JSON.parse(JSON.stringify(AppState.draft)),
    id: AppState.draft.id || ('a_' + Date.now()),
    scenarioTitle: draftTitle,
    completedAt: null,
    results: null
  }, {
    targetStatus: ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED,
    at: new Date().toISOString()
  });
  saveAssessment(archived);
  resetDraft();
  saveDraft();
  return archived;
}
function deleteCurrentDraft() {
  resetDraft();
  saveDraft();
}
function restoreArchivedDraftToWorkspace(id) {
  const archived = getAssessmentById(id);
  if (!archived || hasResults(archived)) return null;
  const restored = JSON.parse(JSON.stringify(archived));
  delete restored.archivedAt;
  delete restored.lifecycleMeta;
  delete restored.lifecycleUpdatedAt;
  restored.lifecycleStatus = deriveAssessmentLifecycleStatus(restored);
  dispatchDraftAction('SET_DRAFT', {
    draft: { ...ensureDraftShape(), ...restored, results: null, completedAt: null }
  });
  deleteAssessment(id);
  saveDraft();
  return AppState.draft;
}
function getAssessmentById(id) {
  return getAssessments().find(a => a.id === id) || null;
}

function duplicateAssessmentToDraft(id) {
  const source = getAssessmentById(id);
  if (!source) return null;
  const duplicate = JSON.parse(JSON.stringify(source));
  delete duplicate.results;
  delete duplicate.completedAt;
  delete duplicate.archivedAt;
  delete duplicate.assessmentIntelligence;
  delete duplicate._shared;
  delete duplicate.lifecycleMeta;
  delete duplicate.lifecycleUpdatedAt;
  duplicate.id = 'a_' + Date.now();
  duplicate.scenarioTitle = `${duplicate.scenarioTitle || 'Untitled assessment'} copy`;
  duplicate.treatmentImprovementRequest = '';
  duplicate.lifecycleStatus = deriveAssessmentLifecycleStatus(duplicate);
  dispatchDraftAction('SET_DRAFT', {
    draft: { ...ensureDraftShape(), ...duplicate }
  });
  saveDraft();
  return AppState.draft;
}

function getLearningStore() {
  const cache = ensureUserStateCache();
  if (cache.learningStore && typeof cache.learningStore === 'object') return cache.learningStore;
  try {
    cache.learningStore = JSON.parse(localStorage.getItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX)) || '{"templates":{}}');
  } catch {
    cache.learningStore = { templates: {} };
  }
  return cache.learningStore;
}

function saveLearningStore(store) {
  const cache = ensureUserStateCache();
  cache.learningStore = store && typeof store === 'object' ? store : { templates: {} };
  localStorage.setItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX), JSON.stringify(cache.learningStore));
  queueSharedUserStateSync({ learningStore: cache.learningStore });
}

function getTemplateLearningProfile(templateId) {
  if (!templateId) return null;
  return getLearningStore().templates?.[templateId] || null;
}

function recordTemplateLoad(templateId) {
  if (!templateId) return;
  const store = getLearningStore();
  const profile = store.templates[templateId] || { loads: 0, completed: 0, avgParams: {}, lastUsed: null };
  profile.loads += 1;
  profile.lastUsed = Date.now();
  store.templates[templateId] = profile;
  saveLearningStore(store);
}

function recordLearningFromAssessment(draft) {
  if (!draft?.templateId || !draft?.fairParams) return;
  const store = getLearningStore();
  const profile = store.templates[draft.templateId] || { loads: 0, completed: 0, avgParams: {}, lastUsed: null };
  profile.completed += 1;
  profile.lastUsed = Date.now();
  LEARNING_PARAM_KEYS.forEach(key => {
    const value = Number(draft.fairParams[key]);
    if (!Number.isFinite(value)) return;
    const previous = Number(profile.avgParams[key]);
    profile.avgParams[key] = Number.isFinite(previous)
      ? ((previous * (profile.completed - 1)) + value) / profile.completed
      : value;
  });
  store.templates[draft.templateId] = profile;
  saveLearningStore(store);
}

function applyLearnedTemplateDraft(tmpl) {
  const profile = getTemplateLearningProfile(tmpl?.id);
  const draft = JSON.parse(JSON.stringify(tmpl?.draft || {}));
  if (!profile || profile.completed < 2 || !draft.fairParams) {
    return { draft, note: '' };
  }
  const learnedWeight = profile.completed >= 5 ? 0.45 : 0.30;
  LEARNING_PARAM_KEYS.forEach(key => {
    const learnedValue = Number(profile.avgParams?.[key]);
    const currentValue = Number(draft.fairParams[key]);
    if (!Number.isFinite(learnedValue) || !Number.isFinite(currentValue)) return;
    draft.fairParams[key] = Number((currentValue * (1 - learnedWeight)) + (learnedValue * learnedWeight)).toFixed(2);
  });
  return {
    draft,
    note: `This template has been adjusted using ${profile.completed} completed assessment${profile.completed === 1 ? '' : 's'} from this browser to provide better starting values.`
  };
}

function saveDraft() {
  try { sessionStorage.setItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX), JSON.stringify(AppState.draft)); } catch {}
  if (typeof persistDraftRecoverySnapshot === 'function') persistDraftRecoverySnapshot(AppState.draft);
  const cache = ensureUserStateCache();
  cache.draft = { ...AppState.draft };
  dispatchDraftAction('MARK_DRAFT_SAVED', { at: Date.now() });
  if (typeof updateWizardSaveState === 'function') updateWizardSaveState();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('rq:draft-saved', { detail: { at: AppState.draftLastSavedAt } }));
  }
  queueSharedUserStateSync({ draft: cache.draft });
}
function loadDraft() {
  const withDraftIdentity = draft => ({
    id: draft?.id || ('a_' + Date.now()),
    ...(draft || {}),
    lifecycleStatus: deriveAssessmentLifecycleStatus(draft || {})
  });
  const cache = ensureUserStateCache();
  if (cache.draft && typeof cache.draft === 'object') {
    dispatchDraftAction('SET_DRAFT', {
      draft: {
        ...(AppState.draft || {}),
        ...withDraftIdentity(cache.draft)
      }
    });
    return;
  }
  try {
    const d = JSON.parse(sessionStorage.getItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX)) || 'null');
    if (d && typeof d === 'object' && Object.keys(d).length) {
      dispatchDraftAction('SET_DRAFT', {
        draft: {
          ...(AppState.draft || {}),
          ...withDraftIdentity(d)
        }
      });
      return;
    }
  } catch {}
  try {
    const recovered = typeof readDraftRecoverySnapshot === 'function' ? readDraftRecoverySnapshot() : null;
    if (recovered?.draft) {
      dispatchDraftAction('SET_DRAFT', {
        draft: {
          ...(AppState.draft || {}),
          ...withDraftIdentity(recovered.draft)
        }
      });
      if (typeof updateWizardSaveState === 'function') updateWizardSaveState();
      if (typeof UI?.toast === 'function') {
        UI.toast('Recovered your latest draft from this browser.', 'info', 4500);
      }
    }
  } catch {}
}
function resetDraft() {
  dispatchDraftAction('RESET_DRAFT', {
    draft: {
    id: 'a_' + Date.now(),
    lifecycleStatus: ASSESSMENT_LIFECYCLE_STATUS.DRAFT,
    templateId: null,
    buId: null, buName: null, contextNotes: '',
    narrative: '', structuredScenario: null,
    scenarioTitle: '', loadedDryRunId: '', llmAssisted: false,
    citations: [], recommendations: [],
    fairParams: {}, results: null,
    geography: DEFAULT_ADMIN_SETTINGS.geography,
    geographies: [DEFAULT_ADMIN_SETTINGS.geography],
    riskCandidates: [],
    selectedRiskIds: [],
    selectedRisks: [],
    sourceNarrative: '',
    enhancedNarrative: '',
    uploadedRegisterName: '',
    registerFindings: '',
    registerMeta: null,
    linkedRisks: DEFAULT_ADMIN_SETTINGS.defaultLinkMode,
    applicableRegulations: [...DEFAULT_ADMIN_SETTINGS.applicableRegulations],
    intakeSummary: '',
    linkAnalysis: '',
    workflowGuidance: [],
    benchmarkBasis: '',
    benchmarkReferences: [],
    inputProvenance: [],
    inputRationale: null,
    confidenceLabel: '',
    evidenceQuality: '',
    evidenceSummary: '',
    primaryGrounding: [],
    supportingReferences: [],
    inferredAssumptions: [],
    missingInformation: [],
    learningNote: '',
    comparisonBaselineId: '',
    treatmentImprovementRequest: '',
    guidedInput: {
      event: '',
      asset: '',
      cause: '',
      impact: '',
      urgency: 'medium'
    }
    }
  });
  saveDraft();
}

Object.assign(window, {
  getAssessments,
  saveAssessment,
  updateAssessmentRecord,
  deleteAssessment,
  archiveAssessment,
  unarchiveAssessment,
  archiveCurrentDraft,
  deleteCurrentDraft,
  restoreArchivedDraftToWorkspace,
  getAssessmentById,
  duplicateAssessmentToDraft,
  getLearningStore,
  saveLearningStore,
  getTemplateLearningProfile,
  recordTemplateLoad,
  recordLearningFromAssessment,
  applyLearnedTemplateDraft,
  saveDraft,
  loadDraft,
  resetDraft
});
