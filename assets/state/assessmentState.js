'use strict';

// Shared assessment, draft, and learning-state helpers extracted from app.js.

const _assessmentPersistenceWarnings = new Set();
const SMART_PARAM_HISTORY_KEY = 'rip_param_history';
const workspacePersistenceApi = typeof require === 'function'
  ? (() => {
      try {
        return require('./userWorkspacePersistence.js');
      } catch {
        return null;
      }
    })()
  : null;

function getCurrentScopedLocalKey(baseKey) {
  const username = String((typeof AuthService !== 'undefined' && AuthService.getCurrentUser?.()?.username) || '').trim().toLowerCase();
  return username ? `${baseKey}_${username}` : baseKey;
}

function migrateLegacyLocalArrayKey(baseKey, scopedKey) {
  if (!scopedKey || scopedKey === baseKey || typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(scopedKey) != null) return;
    const legacy = localStorage.getItem(baseKey);
    if (!legacy) return;
    localStorage.setItem(scopedKey, legacy);
  } catch {}
}

function getSmartParamHistoryStorageKey() {
  const scopedKey = getCurrentScopedLocalKey(SMART_PARAM_HISTORY_KEY);
  migrateLegacyLocalArrayKey(SMART_PARAM_HISTORY_KEY, scopedKey);
  return scopedKey;
}

function buildSessionDraftPayload(draft, savedAt = Date.now()) {
  return {
    savedAt: Number(savedAt || 0),
    draft: draft && typeof draft === 'object' ? draft : null
  };
}

function normaliseSessionDraftPayload(payload) {
  if (payload && typeof payload === 'object' && payload.draft && typeof payload.draft === 'object') {
    return {
      draft: payload.draft,
      savedAt: Number(payload.savedAt || payload.lastSavedAt || 0)
    };
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      draft: payload,
      savedAt: Number(payload.savedAt || payload.lastSavedAt || 0)
    };
  }
  return { draft: null, savedAt: 0 };
}

function warnAssessmentPersistenceOnce(key, message, error = null) {
  if (typeof window === 'undefined') return;
  if (_assessmentPersistenceWarnings.has(key)) return;
  _assessmentPersistenceWarnings.add(key);
  console.warn(message, error?.message || error || '');
}

function cloneDraftStateSnapshot(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function getAssessments() {
  const cache = ensureUserStateCache();
  if (cache.savedAssessments && typeof cache.savedAssessments === 'object') {
    cache.savedAssessments = normaliseSavedAssessmentsSection(cache.savedAssessments, cache.assessments || []);
    cache.assessments = materializeSavedAssessments(cache.savedAssessments).map(item => normaliseAssessmentRecord(item));
    return cache.assessments;
  }
  if (Array.isArray(cache.assessments)) {
    cache.assessments = cache.assessments.map(item => normaliseAssessmentRecord(item));
    cache.savedAssessments = buildSavedAssessmentsSection(cache.assessments);
    return cache.assessments;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX)) || '[]');
    cache.assessments = Array.isArray(saved) ? saved.map(item => normaliseAssessmentRecord(item)) : [];
    cache.savedAssessments = buildSavedAssessmentsSection(cache.assessments);
  } catch (error) {
    warnAssessmentPersistenceOnce('assessments-read', 'getAssessments local read failed:', error);
    cache.assessments = [];
    cache.savedAssessments = buildSavedAssessmentsSection([]);
  }
  return cache.assessments;
}
function persistSavedAssessmentsCollection(list) {
  const buildDeltaPatch = workspacePersistenceApi?.buildSavedAssessmentsDeltaPatch
    || (typeof buildSavedAssessmentsDeltaPatch === 'function' ? buildSavedAssessmentsDeltaPatch : null);
  const cache = ensureUserStateCache();
  const previousSavedAssessments = cache.savedAssessments && typeof cache.savedAssessments === 'object'
    ? normaliseSavedAssessmentsSection(cache.savedAssessments, cache.assessments || [])
    : buildSavedAssessmentsSection(Array.isArray(cache.assessments) ? cache.assessments : []);
  const normalizedList = Array.isArray(list) ? list.map(item => normaliseAssessmentRecord(item)) : [];
  cache.assessments = normalizedList;
  cache.savedAssessments = buildSavedAssessmentsSection(normalizedList);
  try {
    // Storage can be unavailable in hardened/private contexts; keep the in-memory cache authoritative.
    localStorage.setItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX), JSON.stringify(normalizedList));
  } catch (error) {
    warnAssessmentPersistenceOnce('assessments-write', 'persistSavedAssessmentsCollection local write failed:', error);
  }
  const savedAssessmentsPatch = buildDeltaPatch
    ? buildDeltaPatch(cache.savedAssessments, previousSavedAssessments)
    : cache.savedAssessments;
  if (Object.keys(savedAssessmentsPatch.upsertsById || {}).length || (savedAssessmentsPatch.removedIds || []).length) {
    queueSharedUserStateSync({ savedAssessments: savedAssessmentsPatch });
  }
  return normalizedList;
}
function saveAssessment(a, options = {}) {
  const list = getAssessments().slice();
  const idx = list.findIndex(x => x.id === a.id);
  const current = idx > -1 ? list[idx] : null;
  const versionHistory = current && typeof appendAssessmentVersionHistory === 'function'
    ? appendAssessmentVersionHistory(current.versionHistory, current)
    : (typeof normaliseAssessmentVersionHistory === 'function'
      ? normaliseAssessmentVersionHistory(a?.versionHistory || [])
      : (Array.isArray(a?.versionHistory) ? a.versionHistory : []));
  const submittingUser = (typeof AuthService !== 'undefined' && AuthService.getCurrentUser()?.username) || '';
  const assessmentWithOwner = {
    ...a,
    submittedBy: String(a.submittedBy || submittingUser || '').trim().toLowerCase(),
    versionHistory
  };
  const nextAssessment = prepareAssessmentForSave(assessmentWithOwner, {
    existingAssessment: current,
    targetStatus: options.targetStatus || '',
    at: options.at
  });
  if (idx > -1) list[idx] = nextAssessment; else list.unshift(nextAssessment);
  persistSavedAssessmentsCollection(list);
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
  persistSavedAssessmentsCollection(list);
  return next;
}
function deleteAssessment(id) {
  const existing = getAssessments().slice();
  const list = existing.filter(item => item.id !== id);
  if (list.length === existing.length) return false;
  persistSavedAssessmentsCollection(list);
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
  const draftTitle = typeof resolveScenarioDisplayTitle === 'function'
    ? resolveScenarioDisplayTitle({
        ...AppState.draft,
        narrative: String(AppState.draft?.narrative || '').trim(),
        enhancedNarrative: String(AppState.draft?.enhancedNarrative || AppState.draft?.narrative || '').trim()
      })
    : String(AppState.draft?.scenarioTitle || AppState.draft?.narrative || '').trim();
  if (!draftTitle) return null;
  let archivedDraft = null;
  try {
    archivedDraft = JSON.parse(JSON.stringify(AppState.draft));
  } catch {
    // Fallback keeps archive available if one transient field cannot be serialized.
    archivedDraft = { ...AppState.draft };
  }
  const archived = prepareAssessmentForSave({
    ...archivedDraft,
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
  let restored = null;
  try {
    restored = JSON.parse(JSON.stringify(archived));
  } catch {
    // Fallback to a shallow copy if stored draft metadata is malformed but still recoverable.
    restored = { ...archived };
  }
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
  let duplicate = null;
  try {
    duplicate = JSON.parse(JSON.stringify(source));
  } catch {
    // Fallback keeps duplication available even if one saved field cannot be serialized cleanly.
    duplicate = { ...source };
  }
  delete duplicate.results;
  delete duplicate.completedAt;
  delete duplicate.archivedAt;
  delete duplicate.assessmentIntelligence;
  delete duplicate._shared;
  delete duplicate.lifecycleMeta;
  delete duplicate.lifecycleUpdatedAt;
  const duplicateStartedAt = Date.now();
  duplicate.id = 'a_' + Date.now();
  duplicate.startedAt = duplicateStartedAt;
  duplicate.createdAt = duplicateStartedAt;
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
    cache.learningStore = JSON.parse(localStorage.getItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX)) || '{"templates":{},"scenarioPatterns":[],"analystSignals":{"keptRisks":[],"removedRisks":[],"narrativeEdits":[],"rerunDeltas":[]},"aiFeedback":{"events":[]}}');
  } catch (error) {
    warnAssessmentPersistenceOnce('learning-store-read', 'getLearningStore local read failed:', error);
    cache.learningStore = {
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
    };
  }
  return cache.learningStore;
}

function saveLearningStore(store) {
  const cache = ensureUserStateCache();
  cache.learningStore = store && typeof store === 'object'
    ? cloneDraftStateSnapshot(store, {
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
    })
    : {
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
      };
  try {
    localStorage.setItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX), JSON.stringify(cache.learningStore));
  } catch (error) {
    warnAssessmentPersistenceOnce('learning-store-write', 'saveLearningStore local write failed:', error);
  }
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

function getSmartParamHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getSmartParamHistoryStorageKey()) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function saveSmartParamHistory(history) {
  try {
    localStorage.setItem(getSmartParamHistoryStorageKey(), JSON.stringify(Array.isArray(history) ? history.slice(0, 80) : []));
  } catch (error) {
    warnAssessmentPersistenceOnce('smart-param-history-write', 'saveSmartParamHistory local write failed:', error);
  }
}

function recordSmartParamHistoryFromAssessment(assessment) {
  try {
    const record = typeof buildSmartParamHistoryRecord === 'function'
      ? buildSmartParamHistoryRecord(assessment)
      : null;
    if (!record?.scenarioType) return;
    const existing = getSmartParamHistory();
    const filtered = record.assessmentId
      ? existing.filter(item => String(item?.assessmentId || '').trim() !== record.assessmentId)
      : existing;
    saveSmartParamHistory([{ ...record, recordedAt: Date.now() }, ...filtered]);
  } catch (error) {
    warnAssessmentPersistenceOnce('smart-param-history-record', 'recordSmartParamHistoryFromAssessment failed:', error);
  }
}

function recordLearningFromAssessment(draft) {
  // Completed assessments should always feed the lightweight scenario-pattern store, even when no template was used.
  if (typeof persistScenarioPattern === 'function') persistScenarioPattern(draft);
  recordSmartParamHistoryFromAssessment(draft);
  try {
    const username = AuthService.getCurrentUser()?.username || '';
    if (username && typeof LearningStore !== 'undefined' && typeof LearningStore.patternFromAssessment === 'function' && typeof LearningStore.saveScenarioPattern === 'function') {
      const pattern = LearningStore.patternFromAssessment(draft);
      if (pattern) LearningStore.saveScenarioPattern(username, pattern);
    }
  } catch {}
  OrgIntelligenceService?.recordCompletedAssessment?.(draft);
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
  const savedAt = Date.now();
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX), JSON.stringify(buildSessionDraftPayload(AppState.draft, savedAt)));
    }
  } catch (error) {
    warnAssessmentPersistenceOnce('draft-write', 'saveDraft session write failed:', error);
  }
  if (typeof persistDraftRecoverySnapshot === 'function') persistDraftRecoverySnapshot(AppState.draft);
  const cache = ensureUserStateCache();
  // Keep the cache snapshot detached from the live draft so later nested edits do not mutate the “saved” copy in memory.
  cache.draft = cloneDraftStateSnapshot(AppState.draft, { ...(AppState.draft || {}) });
  dispatchDraftAction('MARK_DRAFT_SAVED', { at: savedAt });
  cache.draftWorkspace = buildDraftWorkspaceSection(cache.draft, {
    lastSavedAt: Number(AppState.draftLastSavedAt || 0),
    recoverySnapshotAt: savedAt
  });
  if (typeof updateWizardSaveState === 'function') updateWizardSaveState();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('rq:draft-saved', { detail: { at: AppState.draftLastSavedAt } }));
  }
  queueSharedUserStateSync({ draftWorkspace: cache.draftWorkspace });
}
function loadDraft() {
  const withDraftIdentity = draft => ({
    id: draft?.id || ('a_' + Date.now()),
    ...(draft || {}),
    lifecycleStatus: deriveAssessmentLifecycleStatus(draft || {})
  });
  const cache = ensureUserStateCache();
  const sharedWorkspaceDraft = cache.draftWorkspace?.draft && typeof cache.draftWorkspace.draft === 'object'
    ? cache.draftWorkspace.draft
    : null;
  if (sharedWorkspaceDraft) {
    dispatchDraftAction('SET_DRAFT', {
      draft: {
        ...(AppState.draft || {}),
        ...withDraftIdentity(sharedWorkspaceDraft)
      }
    });
    if (typeof clearDraftRecoverySnapshot === 'function') {
      clearDraftRecoverySnapshot();
    }
    return;
  }
  const candidates = [];
  const cachedDraft = cache.draft && typeof cache.draft === 'object'
    ? cache.draft
    : null;
  if (cachedDraft && typeof cachedDraft === 'object') {
    candidates.push({
      source: 'cache',
      savedAt: Number(cache.draftWorkspace?.lastSavedAt || 0),
      draft: cachedDraft,
      priority: 1
    });
  }
  try {
    const rawDraft = typeof sessionStorage !== 'undefined'
      ? JSON.parse(sessionStorage.getItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX)) || 'null')
      : null;
    const sessionDraft = normaliseSessionDraftPayload(rawDraft);
    if (sessionDraft.draft && typeof sessionDraft.draft === 'object' && Object.keys(sessionDraft.draft).length) {
      candidates.push({
        source: 'session',
        savedAt: Number(sessionDraft.savedAt || 0),
        draft: sessionDraft.draft,
        priority: 3
      });
    }
  } catch (error) {
    warnAssessmentPersistenceOnce('draft-session-read', 'loadDraft session read failed:', error);
  }
  try {
    const recovered = typeof readDraftRecoverySnapshot === 'function' ? readDraftRecoverySnapshot() : null;
    if (recovered?.draft) {
      candidates.push({
        source: 'recovery',
        savedAt: Number(recovered.savedAt || 0),
        draft: recovered.draft,
        priority: 2
      });
    }
  } catch (error) {
    warnAssessmentPersistenceOnce('draft-recovery-read', 'loadDraft recovery read failed:', error);
  }
  if (!candidates.length) return;
  const chosen = candidates
    .filter(item => item?.draft && typeof item.draft === 'object')
    .sort((left, right) => (
      Number(right.savedAt || 0) - Number(left.savedAt || 0)
      || Number(right.priority || 0) - Number(left.priority || 0)
    ))[0];
  if (!chosen?.draft) return;
  dispatchDraftAction('SET_DRAFT', {
    draft: {
      ...(AppState.draft || {}),
      ...withDraftIdentity(chosen.draft)
    }
  });
  if (chosen.source === 'recovery') {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
          buildUserStorageKey(DRAFT_STORAGE_PREFIX),
          JSON.stringify(buildSessionDraftPayload(chosen.draft, chosen.savedAt || Date.now()))
        );
      }
    } catch (error) {
      warnAssessmentPersistenceOnce('draft-session-write', 'loadDraft session write failed:', error);
    }
    if (typeof clearDraftRecoverySnapshot === 'function') {
      clearDraftRecoverySnapshot();
    }
    if (typeof updateWizardSaveState === 'function') updateWizardSaveState();
    if (typeof UI?.toast === 'function') {
      UI.toast('Recovered your latest draft from this browser.', 'info', 4500);
    }
  }
}

function clearDraftScopedWizardUiState(scopePrefix = '/wizard/1::') {
  if (!AppState || !AppState.disclosureState || typeof AppState.disclosureState !== 'object') return;
  const safePrefixes = (Array.isArray(scopePrefix) ? scopePrefix : [scopePrefix])
    .map(prefix => String(prefix || '').trim().toLowerCase())
    .filter(Boolean);
  if (!safePrefixes.length) return;
  Object.keys(AppState.disclosureState).forEach(key => {
    const normalizedKey = String(key || '').trim().toLowerCase();
    if (safePrefixes.some(prefix => normalizedKey.startsWith(prefix))) {
      delete AppState.disclosureState[key];
    }
  });
}

function resetDraft() {
  const resetAt = Date.now();
  if (typeof window?.resetStep1LiveAssistState === 'function') {
    window.resetStep1LiveAssistState({ clearCaches: true });
  }
  clearDraftScopedWizardUiState([
    '/wizard/1::',
    '/wizard/2::',
    '/wizard/3::',
    '/wizard/4::'
  ]);
  if (AppState && Object.prototype.hasOwnProperty.call(AppState, 'mode')) {
    AppState.mode = 'basic';
  }
  if (AppState) {
    AppState.forceWizardDisclosureDefaults = true;
  }
  dispatchDraftAction('RESET_DRAFT', {
    draft: {
    id: 'a_' + Date.now(),
    startedAt: resetAt,
    createdAt: resetAt,
    lifecycleStatus: ASSESSMENT_LIFECYCLE_STATUS.DRAFT,
    templateId: null,
    buId: null, buName: null, contextNotes: '',
    narrative: '', structuredScenario: null,
    scenarioLens: null,
    scenarioTitle: '', loadedDryRunId: '', llmAssisted: false,
    llmContext: [],
    step1LlmContext: [],
    step2LlmContext: [],
    step3LlmContext: [],
    step1ConversationFingerprint: '',
    step2ConversationFingerprint: '',
    step3ConversationFingerprint: '',
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
    ghostDraftMeta: null,
    aiSuggestedFairParams: null,
    orgCalibrationApplied: false,
    orgCalibrationInfo: null,
    smartPrefillState: null,
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
  persistSavedAssessmentsCollection,
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
