/**
 * app.js — Main application entry point
 * G42 Tech & Cyber Risk Quantifier PoC
 */

'use strict';

const TOLERANCE_THRESHOLD = 5_000_000;
const DEFAULT_FX_RATE = 3.6725;
const DEFAULT_COMPASS_PROXY_URL = resolveCompassProxyUrl();
const APP_ASSET_VERSION = '20260327g42a';
const APP_RELEASE = Object.freeze((typeof window !== 'undefined' && window.__RISK_CALCULATOR_RELEASE__) || {
  version: '0.10.0-pilot.1',
  channel: 'pilot',
  build: '2026-03-27-g42a',
  assetVersion: APP_ASSET_VERSION
});
const GLOBAL_ADMIN_STORAGE_KEY = 'rq_admin_settings';
const USER_SETTINGS_STORAGE_PREFIX = 'rq_user_settings';
const ASSESSMENTS_STORAGE_PREFIX = 'rq_assessments';
const LEARNING_STORAGE_PREFIX = 'rq_learning_store';
const DRAFT_STORAGE_PREFIX = 'rq_draft';
const DRAFT_RECOVERY_STORAGE_PREFIX = 'rq_draft_recovery';
const SESSION_LLM_STORAGE_PREFIX = 'rq_llm_session';
const MAX_AI_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_AI_UPLOAD_CHARS = 20000;
const DEFAULT_TYPICAL_DEPARTMENTS = [
  'Information Security',
  'Technology',
  'Operations',
  'Finance',
  'Procurement',
  'Legal',
  'Risk & Compliance',
  'Human Resources',
  'Internal Audit',
  'Data & AI',
  'Commercial',
  'Shared Services'
];

const DEFAULT_ADMIN_SETTINGS = {
  geography: 'United Arab Emirates',
  companyWebsiteUrl: '',
  companyContextProfile: '',
  companyContextSections: null,
  companyStructure: [],
  entityContextLayers: [],
  riskAppetiteStatement: 'Moderate. Escalate risks that threaten regulated operations, cross-border data movement, or strategic platforms.',
  applicableRegulations: ['UAE PDPL', 'BIS Export Controls', 'OFAC Sanctions', 'UAE Cybersecurity Council Guidance', 'NIST SP 800-53', 'NIST RMF', 'ISO 27001', 'ISO 27002', 'ISO 27005', 'ISO 27017', 'ISO 27018', 'ISO 27701', 'ISO 22301', 'ISO 22313', 'ISO 27036', 'ISO 28000', 'ISO 31000'],
  aiInstructions: 'Prioritise operational, regulatory, and strategic impact. Use British English.',
  benchmarkStrategy: 'Prefer GCC and UAE benchmark references where relevant. Where GCC data is thin, use the best available global benchmark and explain the fallback clearly.',
  defaultLinkMode: true,
  toleranceThresholdUsd: TOLERANCE_THRESHOLD,
  warningThresholdUsd: 3_000_000,
  annualReviewThresholdUsd: 12_000_000,
  adminContextSummary: 'Use this workspace to maintain geography, regulations, thresholds, and AI guidance for the platform.',
  adminContextVisibleToUsers: true,
  escalationGuidance: 'Escalate to leadership when the scenario is above tolerance, close to tolerance, or materially affects regulated services.',
  typicalDepartments: [...DEFAULT_TYPICAL_DEPARTMENTS]
};


function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSourceBasisSummary(value = null) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map(item => formatSourceBasisSummary(item))
      .filter(Boolean)
      .slice(0, 4)
      .join(' · ');
  }
  if (typeof value === 'object') {
    const preferred = [
      value.title,
      value.label,
      value.sourceTitle,
      value.name,
      value.origin,
      value.sourceTypeLabel,
      value.reason,
      value.relevanceReason,
      value.summary,
      value.evidenceSummary,
      value.uploadedDocumentName,
      value.text,
      value.type
    ]
      .map(item => String(item || '').trim())
      .filter(Boolean);
    if (preferred.length) return Array.from(new Set(preferred)).slice(0, 4).join(' · ');

    const flattened = Object.values(value)
      .flatMap(item => Array.isArray(item) ? item : [item])
      .map(item => (typeof item === 'object' && item ? (item.title || item.label || item.sourceTitle || item.name || item.text || '') : item))
      .map(item => String(item || '').trim())
      .filter(Boolean);
    if (flattened.length) return Array.from(new Set(flattened)).slice(0, 4).join(' · ');
  }
  return '';
}

function getReleaseInfo() {
  return APP_RELEASE;
}

function getReleaseLabel() {
  const release = getReleaseInfo();
  return `Version ${release.version} · ${String(release.channel || 'pilot').toUpperCase()} · Build ${release.build}`;
}

function formatRelativePilotTime(timestamp, fallback = 'just now') {
  const safeTimestamp = Number(timestamp || 0);
  if (!safeTimestamp) return fallback;
  const elapsedMs = Math.max(0, Date.now() - safeTimestamp);
  if (elapsedMs < 15000) return 'just now';
  const seconds = Math.round(elapsedMs / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function renderPilotWarningBanner(kind = 'poc', {
  text = '',
  title = '',
  compact = false
} = {}) {
  const resolved = {
    poc: {
      tone: 'poc',
      icon: '⚠',
      title: title || 'PoC limitation',
      text: text || 'This pilot supports structured discussion and testing. Validate important conclusions with expert review before using them in formal decisions.'
    },
    ai: {
      tone: 'info',
      icon: '✦',
      title: title || 'AI suggestions',
      text: text || 'Treat AI content as a suggested draft. Keep what helps, edit what does not, and confirm the assumptions before you rely on it.'
    },
    lowConfidence: {
      tone: 'warning',
      icon: '△',
      title: title || 'Low-confidence inputs',
      text: text || 'Some inputs still rely on weak evidence or broad assumptions. Tighten the ranges or gather better source material before you escalate this result.'
    }
  }[kind] || {
    tone: 'info',
    icon: 'ℹ',
    title: title || 'Working note',
    text
  };
  return `<div class="banner banner--${resolved.tone}${compact ? '' : ' mt-4'}"><span class="banner-icon">${resolved.icon}</span><span class="banner-text"><strong>${escapeHtml(resolved.title)}:</strong> ${escapeHtml(resolved.text)}</span></div>`;
}

function normaliseAdminSettings(settings = {}) {
  const mergedRegulations = Array.from(new Set([
    ...DEFAULT_ADMIN_SETTINGS.applicableRegulations,
    ...(Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [])
  ].map(value => String(value || '').trim()).filter(Boolean)));
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...settings,
    applicableRegulations: mergedRegulations,
    companyContextSections: settings.companyContextSections && typeof settings.companyContextSections === 'object' ? settings.companyContextSections : null,
    companyStructure: Array.isArray(settings.companyStructure) ? settings.companyStructure : [],
    entityContextLayers: Array.isArray(settings.entityContextLayers) ? settings.entityContextLayers : [],
    buOverrides: Array.isArray(settings.buOverrides) ? settings.buOverrides : [],
    docOverrides: Array.isArray(settings.docOverrides) ? settings.docOverrides : [],
    typicalDepartments: Array.isArray(settings.typicalDepartments) && settings.typicalDepartments.length
      ? settings.typicalDepartments.map(name => String(name || '').trim()).filter(Boolean)
      : [...(DEFAULT_ADMIN_SETTINGS.typicalDepartments || [])],
    _meta: {
      revision: Number(settings._meta?.revision || 0),
      updatedAt: Number(settings._meta?.updatedAt || 0)
    }
  };
}

function resolveCompassProxyUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin && origin.includes('vercel.app')) return `${origin}/api/compass`;
  return 'https://risk-calculator-eight.vercel.app/api/compass';
}

const AppState = {
  currency: 'USD',
  fxRate: DEFAULT_FX_RATE,
  mode: 'basic',
  currentUser: null,
  draft: {},
  buList: [],
  docList: [],
  benchmarkList: [],
  adminNewUserStatus: '',
  adminVisiblePasswords: {},
  settingsSectionState: {},
  settingsScrollState: {},
  disclosureState: {},
  resultsBoardroomMode: false,
  adminSettingsCache: null,
  userStateCache: { username: '', userSettings: null, assessments: null, learningStore: { templates: {}, scenarioPatterns: [] }, draft: null, _meta: { revision: 0, updatedAt: 0 } },
  userStateSyncTimer: null,
  userStateSyncRevision: 0,
  userStateSyncPending: null,
  userStateSyncInFlight: false,
  userStateLastConflict: null,
  userSettingsSavedAt: 0,
  auditLogCache: { loaded: false, loading: false, entries: [], summary: null, error: '' },
  clientRuntimeErrors: [],
  stateTransitionLog: [],
  draftLastSavedAt: 0,
  draftDirty: false,
  draftSaveTimer: null,
  simulation: createSimulationState()
};

function applyWorkspaceRuntimeState(nextState) {
  Object.assign(AppState, nextState || {});
  return AppState;
}

function cloneSerializableState(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}


function getSettingsApiUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin && origin.includes('vercel.app')) return `${origin}/api/settings`;
  return 'https://risk-calculator-eight.vercel.app/api/settings';
}

async function requestSharedSettings(method = 'GET', payload, { includeAdminSecret = false } = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (includeAdminSecret && AuthService.getAdminApiSecret()) {
    headers['x-admin-secret'] = AuthService.getAdminApiSecret();
  }
  if (AuthService.getApiSessionToken()) {
    headers['x-session-token'] = AuthService.getApiSessionToken();
  }
  const res = await fetch(getSettingsApiUrl(), {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    AuthService.handleApiAuthFailure(res.status, parsed);
    throw AuthService.buildApiError(res, parsed, text || `Settings request failed with HTTP ${res.status}`);
  }
  return parsed || {};
}

function buildExpectedMeta(meta = {}) {
  return {
    revision: Number(meta?.revision || 0),
    updatedAt: Number(meta?.updatedAt || 0)
  };
}

function applySharedSettingsLocally(settings = {}) {
  const normalised = normaliseAdminSettings(settings);
  updateAdminSettingsState(normalised);
  try {
    localStorage.setItem(GLOBAL_ADMIN_STORAGE_KEY, JSON.stringify(normalised));
  } catch {}
  return normalised;
}

function applyUserStateSnapshotLocally(username, state = {}) {
  const safeUsername = String(username || AuthService.getCurrentUser()?.username || '').trim().toLowerCase();
  if (!safeUsername) return null;
  const normalizedWorkspace = normaliseUserWorkspaceState(state);
  const nextCache = {
    username: safeUsername,
    userSettings: normalizedWorkspace.userSettings || null,
    assessments: Array.isArray(normalizedWorkspace.assessments) ? normalizedWorkspace.assessments : [],
    savedAssessments: normalizedWorkspace.savedAssessments,
    learningStore: normalizedWorkspace.learningStore && typeof normalizedWorkspace.learningStore === 'object' ? normalizedWorkspace.learningStore : { templates: {}, scenarioPatterns: [] },
    draft: normalizedWorkspace.draft && typeof normalizedWorkspace.draft === 'object' ? normalizedWorkspace.draft : null,
    draftWorkspace: normalizedWorkspace.draftWorkspace,
    _meta: buildExpectedMeta(normalizedWorkspace._meta)
  };
  updateUserStateCache(nextCache);
  AppState.userSettingsSavedAt = Number(nextCache._meta?.updatedAt || AppState.userSettingsSavedAt || 0);
  try {
    if (nextCache.userSettings) {
      localStorage.setItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX, safeUsername), JSON.stringify(nextCache.userSettings));
    } else {
      localStorage.removeItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX, safeUsername));
    }
    localStorage.setItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX, safeUsername), JSON.stringify(nextCache.assessments));
    localStorage.setItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX, safeUsername), JSON.stringify(nextCache.learningStore));
  } catch {}
  try {
    if (nextCache.draft) {
      sessionStorage.setItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX, safeUsername), JSON.stringify(nextCache.draft));
    } else {
      sessionStorage.removeItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX, safeUsername));
    }
  } catch {}
  if (nextCache.draft) {
    persistDraftRecoverySnapshot(nextCache.draft, safeUsername);
  }
  return nextCache;
}

async function loadSharedAdminSettings() {
  try {
    const data = await requestSharedSettings('GET');
    if (data?.settings) {
      let localSaved = null;
      try {
        localSaved = JSON.parse(localStorage.getItem(GLOBAL_ADMIN_STORAGE_KEY) || 'null');
      } catch {}
      const sharedSettings = {
        ...DEFAULT_ADMIN_SETTINGS,
        ...data.settings,
        applicableRegulations: Array.isArray(data.settings.applicableRegulations) ? data.settings.applicableRegulations : [...DEFAULT_ADMIN_SETTINGS.applicableRegulations]
      };
      const localHasStructure = Array.isArray(localSaved?.companyStructure) && localSaved.companyStructure.length;
      const sharedHasStructure = Array.isArray(sharedSettings.companyStructure) && sharedSettings.companyStructure.length;
      const localHasLayers = Array.isArray(localSaved?.entityContextLayers) && localSaved.entityContextLayers.length;
      const sharedHasLayers = Array.isArray(sharedSettings.entityContextLayers) && sharedSettings.entityContextLayers.length;
      const merged = {
        ...sharedSettings,
        companyStructure: sharedHasStructure ? sharedSettings.companyStructure : (localHasStructure ? localSaved.companyStructure : sharedSettings.companyStructure),
        entityContextLayers: sharedHasLayers ? sharedSettings.entityContextLayers : (localHasLayers ? localSaved.entityContextLayers : sharedSettings.entityContextLayers),
        companyContextSections: sharedSettings.companyContextSections || localSaved?.companyContextSections || null
      };
      const normalisedMerged = applySharedSettingsLocally(merged);
      if ((!sharedHasStructure && localHasStructure) || (!sharedHasLayers && localHasLayers)) {
        syncSharedAdminSettings(normalisedMerged, { category: 'settings', eventType: 'shared_settings_rehydrated', target: 'global_settings', details: { reason: 'local_backup_richer_than_shared' } }).catch(error => console.warn('shared settings rehydrate failed:', error.message));
      }
      return normalisedMerged;
    }
  } catch (error) {
    console.warn('loadSharedAdminSettings fallback:', error.message);
  }
  return null;
}

function syncSharedAdminSettings(settings, audit = null) {
  const normalised = normaliseAdminSettings(settings);
  return requestSharedSettings(
    'PUT',
    {
      settings: normalised,
      expectedMeta: buildExpectedMeta(getAdminSettings()._meta),
      audit
    },
    { includeAdminSecret: true }
  );
}

function getSafeRetryAfterMs(error) {
  const seconds = Number(error?.retryAfterSeconds || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 800;
}

function clearDraftRecoverySnapshot(username = AuthService.getCurrentUser()?.username || '') {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return;
  try {
    localStorage.removeItem(buildUserStorageKey(DRAFT_RECOVERY_STORAGE_PREFIX, safeUsername));
  } catch {}
}

function persistDraftRecoverySnapshot(draft = AppState.draft, username = AuthService.getCurrentUser()?.username || '') {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return;
  try {
    localStorage.setItem(buildUserStorageKey(DRAFT_RECOVERY_STORAGE_PREFIX, safeUsername), JSON.stringify({
      savedAt: Date.now(),
      draft: draft && typeof draft === 'object' ? draft : null
    }));
  } catch {}
}

function extractScenarioPattern(assessment) {
  if (!assessment || !assessment.results) return null;
  return {
    id: String(assessment.id || '').trim(),
    buId: String(assessment.buId || '').trim(),
    title: String(assessment.scenarioTitle || assessment.structuredScenario?.attackType || '').trim(),
    scenarioType: String(assessment.structuredScenario?.attackType || assessment.scenarioTitle || '').trim(),
    geography: String(assessment.geography || '').trim(),
    narrative: String(assessment.enhancedNarrative || assessment.narrative || '').trim(),
    guidedInput: assessment.guidedInput && typeof assessment.guidedInput === 'object'
      ? {
          event: String(assessment.guidedInput.event || '').trim(),
          asset: String(assessment.guidedInput.asset || '').trim(),
          cause: String(assessment.guidedInput.cause || '').trim(),
          impact: String(assessment.guidedInput.impact || '').trim(),
          urgency: String(assessment.guidedInput.urgency || '').trim()
        }
      : {},
    selectedRiskTitles: Array.isArray(assessment.selectedRisks)
      ? assessment.selectedRisks.map(item => String(item?.title || '').trim()).filter(Boolean).slice(0, 4)
      : [],
    posture: assessment.results.toleranceBreached
      ? 'above-tolerance'
      : assessment.results.nearTolerance
        ? 'near-tolerance'
        : 'within-tolerance',
    confidenceLabel: String(assessment.confidenceLabel || 'Moderate confidence').trim(),
    topGap: Array.isArray(assessment.missingInformation) && assessment.missingInformation.length
      ? String(assessment.missingInformation[0]).trim()
      : '',
    keyRecommendation: Array.isArray(assessment.recommendations) && assessment.recommendations.length
      ? String(assessment.recommendations[0]?.title || '').trim()
      : '',
    completedAt: Number(assessment.completedAt || Date.now())
  };
}

function persistScenarioPattern(assessment) {
  try {
    const pattern = extractScenarioPattern(assessment);
    if (!pattern || !pattern.buId) return;
    const username = AuthService.getCurrentUser()?.username || '';
    const key = buildUserStorageKey(LEARNING_STORAGE_PREFIX, username);
    let store = { templates: {}, scenarioPatterns: [] };
    try { store = JSON.parse(localStorage.getItem(key) || '{}') || { templates: {}, scenarioPatterns: [] }; } catch {}
    if (!store.scenarioPatterns) store.scenarioPatterns = [];
    store.scenarioPatterns = [
      pattern,
      ...(store.scenarioPatterns || []).filter(p => p.id !== pattern.id)
    ].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(store));
  } catch {}
}

function getRelevantScenarioPatterns(buId, limit = 3) {
  try {
    const username = AuthService.getCurrentUser()?.username || '';
    const key = buildUserStorageKey(LEARNING_STORAGE_PREFIX, username);
    const store = JSON.parse(localStorage.getItem(key) || '{}') || {};
    const patterns = Array.isArray(store.scenarioPatterns) ? store.scenarioPatterns : [];
    return patterns
      .filter(p => !buId || p.buId === buId)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// Scenario patterns are persisted from the shared assessment completion seam in assets/state/assessmentState.js.

function readDraftRecoverySnapshot(username = AuthService.getCurrentUser()?.username || '') {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(buildUserStorageKey(DRAFT_RECOVERY_STORAGE_PREFIX, safeUsername)) || 'null');
    if (!stored?.draft || typeof stored.draft !== 'object') return null;
    return stored;
  } catch {
    return null;
  }
}

function showPersistenceConflictDialog({ message = '', onReloadLatest, onRetry } = {}) {
  const footer = `
    <button type="button" class="btn btn--ghost" data-persistence-action="cancel">Keep Current Screen</button>
    <button type="button" class="btn btn--secondary" data-persistence-action="reload">Load Latest</button>
    <button type="button" class="btn btn--primary" data-persistence-action="retry">Try Again</button>
  `;
  const modal = UI.modal({
    title: 'Latest version available',
    body: `
      <p style="margin:0;color:var(--text-secondary);line-height:1.7">
        ${escapeHtml(message || 'This information was updated in another session before your changes finished saving.')}
      </p>
      <p style="margin:12px 0 0;color:var(--text-secondary);line-height:1.7">
        Load the latest version first, or try your save again if you want to keep working with your current copy.
      </p>
    `,
    footer
  });
  const root = document.querySelector('.modal-backdrop:last-of-type');
  if (!root) return;
  root.querySelector('[data-persistence-action="cancel"]')?.addEventListener('click', () => modal.close());
  root.querySelector('[data-persistence-action="reload"]')?.addEventListener('click', async () => {
    modal.close();
    if (typeof onReloadLatest === 'function') await onReloadLatest();
  });
  root.querySelector('[data-persistence-action="retry"]')?.addEventListener('click', async () => {
    modal.close();
    if (typeof onRetry === 'function') await onRetry();
  });
}


function recordClientRuntimeError(kind, error, extra = {}) {
  const message = String(error?.message || error || 'Unknown runtime error').trim();
  const entry = {
    kind: String(kind || 'runtime'),
    message,
    source: String(extra.source || '').trim(),
    route: typeof window !== 'undefined' ? String(window.location.hash || '#/').trim() : '#/',
    ts: new Date().toISOString()
  };
  const last = AppState.clientRuntimeErrors[0];
  if (last && last.kind === entry.kind && last.message === entry.message && last.source === entry.source) return;
  AppState.clientRuntimeErrors = [entry, ...(AppState.clientRuntimeErrors || [])].slice(0, 20);
}

if (typeof window !== 'undefined' && !window.__rqRuntimeInstrumentationInstalled) {
  window.__rqRuntimeInstrumentationInstalled = true;
  window.addEventListener('error', event => {
    recordClientRuntimeError('error', event.error || event.message, { source: event.filename || '' });
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled promise rejection'));
    recordClientRuntimeError('promise', reason);
  });
}


function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target.isContentEditable;
}

function focusAdminUserSearch() {
  const input = document.getElementById('admin-user-search');
  if (!input) return false;
  input.focus();
  input.select?.();
  return true;
}

function triggerResultsTab(tabName) {
  const button = document.querySelector(`[data-results-tab="${tabName}"]`);
  if (!button) return false;
  AppState.resultsFocusTarget = 'tab';
  button.click();
  return true;
}

function handleGlobalDesktopShortcut(event) {
  if (event.defaultPrevented || isEditableTarget(event.target)) return;
  if (!(event.altKey || event.metaKey)) return;
  if (event.ctrlKey) return;

  const key = String(event.key || '').toLowerCase();
  const route = typeof window !== 'undefined' ? String(window.location.hash || '#/').toLowerCase() : '#/';

  if (key === 'n') {
    const button = document.getElementById('btn-dashboard-new-assessment') || document.getElementById('btn-new-assess');
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
    return;
  }

  if (key === 'r' && route.includes('/dashboard')) {
    const button = document.getElementById('btn-dashboard-continue-draft');
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
    return;
  }

  if (key === 's' && (route.includes('/dashboard') || route.includes('/settings'))) {
    const button = document.getElementById('btn-dashboard-open-settings') || document.getElementById('btn-dashboard-settings-secondary');
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
    return;
  }

  if (key === '1' && route.includes('/results/')) {
    event.preventDefault();
    triggerResultsTab('executive');
    return;
  }

  if (key === '2' && route.includes('/results/')) {
    event.preventDefault();
    triggerResultsTab('technical');
    return;
  }

  if (key === '3' && route.includes('/results/')) {
    event.preventDefault();
    triggerResultsTab('appendix');
    return;
  }

  if (key === 'f' && route.includes('/admin/settings/users')) {
    if (focusAdminUserSearch()) {
      event.preventDefault();
    }
    return;
  }

  if (key === '/') {
    event.preventDefault();
    openShortcutHelpModal();
  }
}


function formatDraftSaveState() {
  if (AppState.userStateSyncInFlight) return 'Saving draft…';
  if (AppState.draftSaveTimer) return 'Saving draft soon…';
  if (AppState.draftDirty) return 'Changes not saved yet';
  if (!AppState.draftLastSavedAt) return 'Draft saves automatically';
  return `Saved ${formatRelativePilotTime(AppState.draftLastSavedAt)}`;
}

function formatWorkspaceSyncState(scope = 'settings') {
  if (AppState.userStateLastConflict?.code === 'WRITE_CONFLICT') return scope === 'wizard' ? 'Latest saved version available' : 'Sync needs attention';
  if (AppState.userStateSyncInFlight) return scope === 'wizard' ? 'Saving draft…' : 'Saving your changes…';
  if (AppState.userStateSyncPending || AppState.userStateSyncTimer) return scope === 'wizard' ? 'Saving draft soon…' : 'Changes queued to sync';
  if (scope === 'wizard') return formatDraftSaveState();
  const lastSavedAt = Number(AppState.userSettingsSavedAt || AppState.userStateCache?._meta?.updatedAt || 0);
  if (!lastSavedAt) return 'Autosave is on';
  return `Last synced ${formatRelativePilotTime(lastSavedAt)}`;
}

function updateWorkspaceSyncState(scope = null) {
  const selector = scope ? `[data-workspace-sync-state][data-scope="${scope}"]` : '[data-workspace-sync-state]';
  document.querySelectorAll(selector).forEach(node => {
    const nodeScope = node.dataset.scope || scope || 'settings';
    const text = formatWorkspaceSyncState(nodeScope);
    node.textContent = text;
    node.dataset.state = /latest saved version available/i.test(text)
      ? 'warning'
      : (AppState.userStateSyncInFlight || AppState.userStateSyncPending || AppState.userStateSyncTimer)
        ? 'syncing'
        : 'saved';
  });
}

function updateWizardSaveState() {
  const text = formatDraftSaveState();
  document.querySelectorAll('[data-draft-save-state]').forEach(node => {
    node.textContent = text;
    node.dataset.state = AppState.draftDirty ? 'dirty' : 'saved';
  });
  updateWorkspaceSyncState('wizard');
}

function markDraftDirty() {
  dispatchDraftAction('MARK_DRAFT_DIRTY');
  persistDraftRecoverySnapshot();
  updateWizardSaveState();
}

function scheduleDraftAutosave(delay = 700) {
  if (AppState.draftSaveTimer) window.clearTimeout(AppState.draftSaveTimer);
  dispatchDraftAction('SET_DRAFT_SAVE_TIMER', {
    timer: window.setTimeout(() => {
      dispatchDraftAction('SET_DRAFT_SAVE_TIMER', { timer: null });
      saveDraft();
    }, delay)
  });
}

function clearDraftAutosaveTimer() {
  if (AppState.draftSaveTimer) window.clearTimeout(AppState.draftSaveTimer);
  dispatchDraftAction('SET_DRAFT_SAVE_TIMER', { timer: null });
}

function getCurrentSimulationState() {
  return createSimulationState(AppState.simulation || {});
}

function resetSimulationState() {
  dispatchSimulationAction('RESET_SIMULATION');
}

function startSimulationState(total = 0) {
  dispatchSimulationAction('START_SIMULATION', { total, at: Date.now() });
}

function updateSimulationProgressState({ completed = 0, total = 0, ratio = 0, message = '' } = {}) {
  dispatchSimulationAction('UPDATE_SIMULATION_PROGRESS', { completed, total, ratio, message });
}

function completeSimulationState() {
  dispatchSimulationAction('COMPLETE_SIMULATION');
}

function failSimulationState(error) {
  dispatchSimulationAction('FAIL_SIMULATION', { error });
}

function cancelSimulationState(message = 'Cancellation requested…') {
  dispatchSimulationAction('CANCEL_SIMULATION', { message });
}

function openShortcutHelpModal() {
  UI.modal({
    title: 'Desktop shortcuts',
    body: `<div style="display:grid;gap:var(--sp-3)">
      <div class="context-panel-copy">These shortcuts are desktop-only and are ignored while you are typing in a field.</div>
      <div class="grid-2">
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><strong>Alt/Option + N</strong><div class="form-help" style="margin-top:6px">Start a new assessment</div></div>
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><strong>Alt/Option + R</strong><div class="form-help" style="margin-top:6px">Resume your current draft</div></div>
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><strong>Alt/Option + S</strong><div class="form-help" style="margin-top:6px">Open personal settings</div></div>
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><strong>Alt/Option + 1 / 2 / 3</strong><div class="form-help" style="margin-top:6px">Switch results tabs</div></div>
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><strong>Alt/Option + F</strong><div class="form-help" style="margin-top:6px">Focus admin user search</div></div>
        <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><strong>Alt/Option + /</strong><div class="form-help" style="margin-top:6px">Open this shortcuts guide</div></div>
      </div>
    </div>`
  });
}

if (typeof window !== 'undefined' && !window.__rqBeforeUnloadInstalled) {
  window.__rqBeforeUnloadInstalled = true;
  window.addEventListener('beforeunload', event => {
    if (!AppState.draftDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

if (typeof document !== 'undefined' && !document.__rqDesktopShortcutsInstalled) {
  document.__rqDesktopShortcutsInstalled = true;
  document.addEventListener('keydown', handleGlobalDesktopShortcut);
}

function getAuditApiUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin && origin.includes('vercel.app')) return `${origin}/api/audit-log`;
  return 'https://risk-calculator-eight.vercel.app/api/audit-log';
}

async function requestAuditLog(method = 'GET', payload, { includeAdminSecret = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (includeAdminSecret && AuthService.getAdminApiSecret()) headers['x-admin-secret'] = AuthService.getAdminApiSecret();
  if (AuthService.getApiSessionToken()) headers['x-session-token'] = AuthService.getApiSessionToken();
  const res = await fetch(getAuditApiUrl(), { method, headers, body: payload ? JSON.stringify(payload) : undefined });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    AuthService.handleApiAuthFailure(res.status, parsed);
    throw AuthService.buildApiError(res, parsed, text || `Audit request failed with HTTP ${res.status}`);
  }
  return parsed || {};
}

async function loadAuditLog() {
  AppState.auditLogCache.loading = true;
  try {
    const data = await requestAuditLog('GET', undefined, { includeAdminSecret: true });
    AppState.auditLogCache = {
      loaded: true,
      loading: false,
      entries: Array.isArray(data.entries) ? data.entries : [],
      summary: data.summary || null,
      error: ''
    };
    return AppState.auditLogCache;
  } catch (error) {
    AppState.auditLogCache = {
      loaded: true,
      loading: false,
      entries: [],
      summary: null,
      error: error instanceof Error ? error.message : String(error)
    };
    throw error;
  }
}

async function logAuditEvent(event = {}) {
  try {
    await requestAuditLog('POST', event, { includeAdminSecret: false });
  } catch (error) {
    console.warn('logAuditEvent failed:', error.message);
  }
}

function formatAuditDetails(details = {}) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ');
}

function buildAdminImpactAssessment(currentSettings = DEFAULT_ADMIN_SETTINGS, nextSettings = DEFAULT_ADMIN_SETTINGS) {
  const impacts = [];
  const currentStructure = Array.isArray(currentSettings.companyStructure) ? currentSettings.companyStructure : [];
  const nextStructure = Array.isArray(nextSettings.companyStructure) ? nextSettings.companyStructure : [];
  const currentEntities = getCompanyEntities(currentStructure);
  const nextEntities = getCompanyEntities(nextStructure);
  const currentDepartments = currentStructure.filter(node => isDepartmentEntityType(node.type));
  const nextDepartments = nextStructure.filter(node => isDepartmentEntityType(node.type));
  const currentEntityMap = new Map(currentEntities.map(item => [item.id, item]));
  const nextEntityMap = new Map(nextEntities.map(item => [item.id, item]));
  const currentDepartmentMap = new Map(currentDepartments.map(item => [item.id, item]));
  const nextDepartmentMap = new Map(nextDepartments.map(item => [item.id, item]));
  const nextEntityIds = new Set(nextEntities.map(item => item.id));
  const nextDepartmentIds = new Set(nextDepartments.map(item => item.id));
  const currentLayers = Array.isArray(currentSettings.entityContextLayers) ? currentSettings.entityContextLayers : [];
  const nextLayers = Array.isArray(nextSettings.entityContextLayers) ? nextSettings.entityContextLayers : [];
  const managedAccounts = getManagedAccountsForAdmin(nextSettings);
  const truncateNames = list => list.slice(0, 3).join(', ') + (list.length > 3 ? ` +${list.length - 3} more` : '');

  const removedEntities = currentEntities.filter(item => !nextEntityIds.has(item.id));
  const removedDepartments = currentDepartments.filter(item => !nextDepartmentIds.has(item.id));
  if (removedEntities.length) {
    impacts.push({
      severity: 'high',
      title: 'Businesses will disappear from the organisation tree',
      detail: `${removedEntities.length} business unit${removedEntities.length === 1 ? '' : 's'} will no longer be available to users, including ${truncateNames(removedEntities.map(item => item.name || 'Unnamed business'))}.`
    });
  }
  if (removedDepartments.length) {
    impacts.push({
      severity: 'high',
      title: 'Functions or departments will be removed',
      detail: `${removedDepartments.length} function${removedDepartments.length === 1 ? '' : 's'} will disappear from user selection, including ${truncateNames(removedDepartments.map(item => item.name || 'Unnamed function'))}.`
    });
  }

  const renamedEntities = nextEntities.filter(item => currentEntityMap.has(item.id) && String(currentEntityMap.get(item.id)?.name || '').trim() !== String(item.name || '').trim());
  if (renamedEntities.length) {
    impacts.push({
      severity: 'medium',
      title: 'Business-unit labels will change for users',
      detail: `${renamedEntities.length} business unit${renamedEntities.length === 1 ? '' : 's'} were renamed, which will change dashboard labels, assignments, and saved-context references.`
    });
  }
  const renamedDepartments = nextDepartments.filter(item => currentDepartmentMap.has(item.id) && String(currentDepartmentMap.get(item.id)?.name || '').trim() !== String(item.name || '').trim());
  if (renamedDepartments.length) {
    impacts.push({
      severity: 'medium',
      title: 'Function labels will change for users',
      detail: `${renamedDepartments.length} function${renamedDepartments.length === 1 ? '' : 's'} were renamed, which will change how saved assignments and reports appear to end users.`
    });
  }

  const reparentedDepartments = nextDepartments.filter(item => {
    const current = currentDepartmentMap.get(item.id);
    return current && String(current.parentId || '') !== String(item.parentId || '');
  });
  if (reparentedDepartments.length) {
    impacts.push({
      severity: 'high',
      title: 'Functions will move to different business units',
      detail: `${reparentedDepartments.length} function${reparentedDepartments.length === 1 ? '' : 's'} are being moved under a different BU, which can break user assignment and inherited context.`
    });
  }

  const orphanedUsers = managedAccounts.filter(account => account.businessUnitEntityId && !nextEntityIds.has(account.businessUnitEntityId));
  if (orphanedUsers.length) {
    impacts.push({
      severity: 'high',
      title: 'Some users would lose their BU assignment',
      detail: `${orphanedUsers.length} managed user${orphanedUsers.length === 1 ? '' : 's'} would no longer map to a valid business unit, including ${truncateNames(orphanedUsers.map(account => account.displayName || account.username))}.`
    });
  }
  const orphanedFunctions = managedAccounts.filter(account => account.departmentEntityId && !nextDepartmentIds.has(account.departmentEntityId));
  if (orphanedFunctions.length) {
    impacts.push({
      severity: 'high',
      title: 'Some users would lose their function assignment',
      detail: `${orphanedFunctions.length} managed user${orphanedFunctions.length === 1 ? '' : 's'} would no longer map to a valid function, including ${truncateNames(orphanedFunctions.map(account => account.displayName || account.username))}.`
    });
  }
  const mismatchedAssignments = managedAccounts.filter(account => {
    if (!account.businessUnitEntityId || !account.departmentEntityId) return false;
    const department = nextDepartmentMap.get(account.departmentEntityId);
    return !!department && String(department.parentId || '') !== String(account.businessUnitEntityId || '');
  });
  if (mismatchedAssignments.length) {
    impacts.push({
      severity: 'high',
      title: 'Some user assignments would no longer make sense',
      detail: `${mismatchedAssignments.length} managed user${mismatchedAssignments.length === 1 ? '' : 's'} would point to a function that sits under a different BU than the one assigned.`
    });
  }
  const displacedBuAdmins = managedAccounts.filter(account => account.role === 'bu_admin' && account.businessUnitEntityId && !nextEntityIds.has(account.businessUnitEntityId));
  if (displacedBuAdmins.length) {
    impacts.push({
      severity: 'high',
      title: 'BU admin ownership would be removed',
      detail: `${displacedBuAdmins.length} BU admin assignment${displacedBuAdmins.length === 1 ? '' : 's'} would be left without a valid managed business unit.`
    });
  }

  const currentLayerIds = new Set(currentLayers.map(item => item.entityId));
  const nextLayerIds = new Set(nextLayers.map(item => item.entityId));
  const removedLayers = currentLayers.filter(item => !nextLayerIds.has(item.entityId));
  if (removedLayers.length) {
    impacts.push({
      severity: 'medium',
      title: 'Some retained context layers will be removed',
      detail: `${removedLayers.length} saved entity or function context layer${removedLayers.length === 1 ? '' : 's'} will stop shaping user guidance and AI outputs.`
    });
  }
  const addedLayers = nextLayers.filter(item => !currentLayerIds.has(item.entityId));
  if (addedLayers.length) {
    impacts.push({
      severity: 'low',
      title: 'New retained context will shape future user outputs',
      detail: `${addedLayers.length} new context layer${addedLayers.length === 1 ? '' : 's'} will start influencing AI suggestions, summaries, and inherited context.`
    });
  }

  if ((currentSettings.geography || '') !== (nextSettings.geography || '')) {
    impacts.push({
      severity: 'medium',
      title: 'Default geography will change',
      detail: `Fallback geography will move from ${currentSettings.geography || 'unset'} to ${nextSettings.geography || 'unset'}, which changes default regional context for new or reset users.`
    });
  }
  if (!!currentSettings.defaultLinkMode !== !!nextSettings.defaultLinkMode) {
    impacts.push({
      severity: 'medium',
      title: 'Default linked-risk behaviour will change',
      detail: `New assessments will start with linked-risk mode ${nextSettings.defaultLinkMode ? 'enabled' : 'disabled'}, which changes how users see related-risk analysis by default.`
    });
  }
  if (Number(currentSettings.warningThresholdUsd || 0) !== Number(nextSettings.warningThresholdUsd || 0) || Number(currentSettings.toleranceThresholdUsd || 0) !== Number(nextSettings.toleranceThresholdUsd || 0) || Number(currentSettings.annualReviewThresholdUsd || 0) !== Number(nextSettings.annualReviewThresholdUsd || 0)) {
    impacts.push({
      severity: 'medium',
      title: 'Assessment thresholds will change',
      detail: 'Warning, tolerance, and annual review signals may shift for new, reopened, and compared scenarios.'
    });
  }

  const currentRegs = Array.isArray(currentSettings.applicableRegulations) ? currentSettings.applicableRegulations : [];
  const nextRegs = Array.isArray(nextSettings.applicableRegulations) ? nextSettings.applicableRegulations : [];
  if (JSON.stringify(currentRegs) !== JSON.stringify(nextRegs)) {
    impacts.push({
      severity: 'medium',
      title: 'Fallback regulations will change',
      detail: `Default regulatory guidance changed from ${currentRegs.length} to ${nextRegs.length} tags, which can alter how users see compliance context in assessments.`
    });
  }
  if ((currentSettings.aiInstructions || '') !== (nextSettings.aiInstructions || '') || (currentSettings.benchmarkStrategy || '') !== (nextSettings.benchmarkStrategy || '')) {
    impacts.push({
      severity: 'low',
      title: 'AI guidance will change',
      detail: 'Future AI-assisted drafts, explanations, and benchmark framing may read differently for users.'
    });
  }
  const currentTypicalDepartments = getTypicalDepartments(currentSettings);
  const nextTypicalDepartments = getTypicalDepartments(nextSettings);
  if (JSON.stringify(currentTypicalDepartments) !== JSON.stringify(nextTypicalDepartments)) {
    impacts.push({
      severity: 'low',
      title: 'Suggested department options will change',
      detail: 'Admins and BU admins will see a different suggested department list when creating new functions or departments.'
    });
  }
  if ((currentSettings.riskAppetiteStatement || '') !== (nextSettings.riskAppetiteStatement || '') || (currentSettings.escalationGuidance || '') !== (nextSettings.escalationGuidance || '')) {
    impacts.push({
      severity: 'low',
      title: 'Leadership guidance will change',
      detail: 'Executive summaries, escalation prompts, and results guidance will pick up the new governance wording.'
    });
  }

  const counts = {
    high: impacts.filter(item => item.severity === 'high').length,
    medium: impacts.filter(item => item.severity === 'medium').length,
    low: impacts.filter(item => item.severity === 'low').length
  };
  const severity = counts.high ? 'high' : counts.medium ? 'medium' : counts.low ? 'low' : 'none';
  const summary = !impacts.length
    ? 'No material end-user impact is currently detected.'
    : `${impacts.length} downstream change${impacts.length === 1 ? '' : 's'} detected for end users.`;

  return {
    impacts,
    counts,
    severity,
    summary
  };
}

function renderAdminImpactAssessment(assessment) {
  const items = Array.isArray(assessment?.impacts) ? assessment.impacts : [];
  if (!items.length) {
    return `<div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><div class="context-panel-title">End-user impact review</div><div class="form-help" style="margin-top:8px">${assessment?.summary || 'No material end-user impact is currently detected from these admin changes.'}</div></div>`;
  }
  return `<div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)"><div class="context-panel-title">End-user impact review</div><div class="form-help" style="margin-top:8px">${assessment.summary}</div><div class="citation-chips" style="margin-top:10px"><span class="badge badge--danger">High ${assessment.counts.high}</span><span class="badge badge--warning">Medium ${assessment.counts.medium}</span><span class="badge badge--neutral">Low ${assessment.counts.low}</span></div><div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">${items.slice(0, 8).map(item => `<div style="background:var(--bg-elevated);padding:var(--sp-3);border-radius:var(--radius-lg)"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="badge badge--${item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warning' : 'neutral'}">${item.severity}</span><div style="font-weight:600;color:var(--text-primary)">${item.title}</div></div><div class="form-help" style="margin-top:6px">${item.detail}</div></div>`).join('')}</div></div>`;
}

async function performLogout({ renderLoginScreen = false } = {}) {
  const currentUser = AuthService.getCurrentUser();
  if (currentUser?.username) {
    await logAuditEvent({ category: 'auth', eventType: 'logout', target: currentUser.username, status: 'success', source: 'client' });
  }
  AuthService.logout();
  resetAuthSessionState();
  resetSimulationState();
  activateAuthenticatedState();
  if (renderLoginScreen) renderLogin();
  else Router.navigate('/login');
}

function getUserStateApiUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin && origin.includes('vercel.app')) return `${origin}/api/user-state`;
  return 'https://risk-calculator-eight.vercel.app/api/user-state';
}

async function requestUserState(method = 'GET', username, payload, audit = null) {
  const safeUsername = String(username || '').trim().toLowerCase();
  const url = method === 'GET'
    ? `${getUserStateApiUrl()}?username=${encodeURIComponent(safeUsername)}`
    : getUserStateApiUrl();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (AuthService.getApiSessionToken()) headers['x-session-token'] = AuthService.getApiSessionToken();
  const res = await fetch(url, {
    method,
    headers,
    body: method === 'GET'
      ? undefined
      : JSON.stringify(
          method === 'PATCH'
            ? {
                username: safeUsername,
                patch: payload?.patch && typeof payload.patch === 'object' ? payload.patch : (payload || {}),
                expectedMeta: buildExpectedMeta(payload?.expectedMeta),
                audit
              }
            : {
                username: safeUsername,
                state: payload?.state && typeof payload.state === 'object' ? payload.state : (payload || {}),
                expectedMeta: buildExpectedMeta(payload?.expectedMeta || payload?.state?._meta),
                audit
              }
        )
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    AuthService.handleApiAuthFailure(res.status, parsed);
    throw AuthService.buildApiError(res, parsed, text || `User state request failed with HTTP ${res.status}`);
  }
  return parsed || {};
}

async function loadSharedUserState(username = AuthService.getCurrentUser()?.username || '') {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return null;
  try {
    const data = await requestUserState('GET', safeUsername);
    const state = data?.state || {};
    applyUserStateSnapshotLocally(safeUsername, state);
    return AppState.userStateCache;
  } catch (error) {
    console.warn('loadSharedUserState fallback:', error.message);
    return null;
  }
}

async function handleUserStateConflict(error, retry) {
  const safeUsername = String(AuthService.getCurrentUser()?.username || AppState.userStateCache.username || '').trim().toLowerCase();
  AppState.userStateLastConflict = error;
  showPersistenceConflictDialog({
    message: 'Your saved workspace was updated somewhere else before this save finished.',
    onReloadLatest: async () => {
      if (error?.latestState && safeUsername) applyUserStateSnapshotLocally(safeUsername, error.latestState);
      else if (safeUsername) await loadSharedUserState(safeUsername);
      if (typeof window !== 'undefined') {
        Router.render?.();
      }
      UI.toast('Loaded the latest saved workspace.', 'info');
    },
    onRetry: async () => {
      if (error?.latestState && safeUsername) {
        applyUserStateSnapshotLocally(safeUsername, error.latestState);
      }
      await new Promise(resolve => window.setTimeout(resolve, getSafeRetryAfterMs(error)));
      if (typeof retry === 'function') await retry();
    }
  });
}

function queueSharedUserStateSync(patch = {}, username = AuthService.getCurrentUser()?.username || '', options = {}) {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return;
  // Queue a cloned patch so later draft/settings mutations cannot rewrite the pending sync payload in place.
  const safePatch = patch && typeof patch === 'object' ? cloneSerializableState(patch, { ...(patch || {}) }) : {};
  applyWorkspaceRuntimeState(applyWorkspaceSyncQueuedTransition(AppState, safePatch));
  updateWorkspaceSyncState();
  if (AppState.userStateSyncTimer) clearTimeout(AppState.userStateSyncTimer);
  applyWorkspaceRuntimeState(applyWorkspaceSyncScheduledTransition(AppState, setTimeout(() => {
    applyWorkspaceRuntimeState(applyWorkspaceSyncScheduledTransition(AppState, null));
    if (AppState.userStateSyncInFlight) {
      queueSharedUserStateSync({}, safeUsername, options);
      return;
    }
    const pendingPatch = AppState.userStateSyncPending ? { ...AppState.userStateSyncPending } : null;
    applyWorkspaceRuntimeState(applyWorkspaceSyncClearedTransition(AppState));
    if (!pendingPatch || !Object.keys(pendingPatch).length) return;
    applyWorkspaceRuntimeState(applyWorkspaceSyncStartedTransition(AppState));
    updateWizardSaveState();
    updateWorkspaceSyncState();
    requestUserState(
      'PATCH',
      safeUsername,
      {
        patch: pendingPatch,
        expectedMeta: buildExpectedMeta(AppState.userStateCache._meta)
      },
      options.audit || null
    )
      .then(data => {
        applyUserStateSnapshotLocally(safeUsername, data?.state || {});
        applyWorkspaceRuntimeState(applyWorkspaceSyncFinishedTransition(AppState, data?.state?._meta || {}));
        updateWizardSaveState();
        updateWorkspaceSyncState();
      })
      .catch(async error => {
        applyWorkspaceRuntimeState(error?.code === 'WRITE_CONFLICT'
          ? applyWorkspaceSyncConflictTransition(AppState, error)
          : applyWorkspaceSyncFailedTransition(AppState));
        updateWizardSaveState();
        updateWorkspaceSyncState();
        if (error?.code === 'WRITE_CONFLICT') {
          await handleUserStateConflict(error, () => queueSharedUserStateSync(pendingPatch, safeUsername, options));
          return;
        }
        console.warn('queueSharedUserStateSync failed:', error.message);
      });
  }, 250)));
}

function ensureUserStateCache(username = AuthService.getCurrentUser()?.username || '') {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) {
    return createEmptyUserStateCache('');
  }
  if (AppState.userStateCache.username !== safeUsername) {
    updateUserStateCache({
      username: safeUsername,
      userSettings: null,
      assessments: null,
      savedAssessments: null,
      learningStore: null,
      draft: null,
      draftWorkspace: null,
      _meta: { revision: 0, updatedAt: 0 }
    });
  }
  return AppState.userStateCache;
}

const USER_SETTINGS_KEYS = [
  'geography',
  'companyWebsiteUrl',
  'companyContextProfile',
  'companyContextSections',
  'riskAppetiteStatement',
  'applicableRegulations',
  'aiInstructions',
  'benchmarkStrategy',
  'defaultLinkMode',
  'adminContextSummary',
  'userProfile',
  'onboardedAt'
];

const USER_SETTINGS_OVERRIDE_FIELDS = [
  'companyWebsiteUrl',
  'companyContextProfile',
  'companyContextSections',
  'riskAppetiteStatement',
  'applicableRegulations',
  'aiInstructions',
  'benchmarkStrategy',
  'defaultLinkMode',
  'adminContextSummary'
];

const USER_FOCUS_OPTIONS = [
  'Cyber risk',
  'Technology resilience',
  'Operational continuity',
  'Third-party risk',
  'Regulatory compliance',
  'Audit readiness',
  'Data protection',
  'Executive reporting'
];

const GEOGRAPHY_OPTIONS = [
  'United Arab Emirates',
  'Abu Dhabi',
  'Dubai',
  'GCC',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'Middle East',
  'North Africa',
  'Europe',
  'United Kingdom',
  'United States',
  'India',
  'Asia Pacific',
  'Global'
];

function normaliseUserGeographies(settings = {}, globalSettings = getAdminSettings()) {
  const primary = String(settings.geographyPrimary || settings.geography || globalSettings.geography || DEFAULT_ADMIN_SETTINGS.geography).trim() || DEFAULT_ADMIN_SETTINGS.geography;
  return {
    geographyPrimary: primary,
    geographySecondary: String(settings.geographySecondary || '').trim(),
    geographyTertiary: String(settings.geographyTertiary || '').trim(),
    geography: primary
  };
}

function renderGeographySelect(id, selected = '', placeholder = 'Choose geography', optional = false) {
  return `<select class="form-select" id="${id}">
    <option value="">${optional ? placeholder : 'Choose geography'}</option>
    ${GEOGRAPHY_OPTIONS.map(option => `<option value="${option}" ${option === selected ? 'selected' : ''}>${option}</option>`).join('')}
  </select>`;
}

const GEOGRAPHY_REGULATION_MAP = {
  'United Arab Emirates': ['UAE PDPL', 'UAE Cybersecurity Council Guidance'],
  'Abu Dhabi': ['UAE PDPL', 'UAE Cybersecurity Council Guidance'],
  'Dubai': ['UAE PDPL', 'UAE Cybersecurity Council Guidance'],
  'GCC': ['GCC cross-border data transfer obligations'],
  'Saudi Arabia': ['Saudi PDPL'],
  'Qatar': ['Qatar Personal Data Privacy Protection Law'],
  'Kuwait': ['Kuwait data privacy obligations'],
  'Bahrain': ['Bahrain PDPL'],
  'Oman': ['Oman Personal Data Protection Law'],
  'Middle East': ['Regional data localisation and sectoral obligations'],
  'North Africa': ['Jurisdiction-specific privacy and cyber obligations'],
  'Europe': ['GDPR', 'NIS2'],
  'United Kingdom': ['UK GDPR', 'UK NIS Regulations'],
  'United States': ['US state privacy laws', 'SEC cyber disclosure rules'],
  'India': ['DPDP Act 2023'],
  'Asia Pacific': ['APAC privacy and localisation obligations'],
  'Global': ['Cross-border data transfer and sanctions obligations']
};

function normaliseScenarioGeographies(geographies = [], fallback = DEFAULT_ADMIN_SETTINGS.geography) {
  const input = Array.isArray(geographies) ? geographies : [geographies];
  const clean = Array.from(new Set(input.map(value => String(value || '').trim()).filter(Boolean)));
  if (clean.length) return clean;
  return [String(fallback || DEFAULT_ADMIN_SETTINGS.geography).trim() || DEFAULT_ADMIN_SETTINGS.geography];
}

function formatScenarioGeographies(geographies = [], fallback = DEFAULT_ADMIN_SETTINGS.geography) {
  return normaliseScenarioGeographies(geographies, fallback).join(', ');
}

function getScenarioGeographies() {
  return normaliseScenarioGeographies(AppState.draft.geographies || AppState.draft.geography, getEffectiveSettings().geography);
}

function deriveGeographyRegulations(geographies = []) {
  return Array.from(new Set(normaliseScenarioGeographies(geographies).flatMap(geo => GEOGRAPHY_REGULATION_MAP[geo] || [])));
}

function getCurrentUserOrThrow() {
  const user = AuthService.getCurrentUser();
  if (!user?.username) {
    throw new Error('No authenticated user session found.');
  }
  return user;
}

function buildUserStorageKey(prefix, username = getCurrentUserOrThrow().username) {
  return `${prefix}__${username}`;
}

function clearUserPersistentState(username) {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return;
  try {
    localStorage.removeItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX, safeUsername));
    localStorage.removeItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX, safeUsername));
    localStorage.removeItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX, safeUsername));
    localStorage.removeItem(buildUserStorageKey(DRAFT_RECOVERY_STORAGE_PREFIX, safeUsername));
    sessionStorage.removeItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX, safeUsername));
    sessionStorage.removeItem(buildUserStorageKey(SESSION_LLM_STORAGE_PREFIX, safeUsername));
  } catch {}
  const expectedMeta = buildExpectedMeta(AppState.userStateCache.username === safeUsername ? AppState.userStateCache._meta : {});
  if (AppState.userStateCache.username === safeUsername) {
    resetUserStateCache(safeUsername);
  }
  requestUserState('PUT', safeUsername, {
    state: { userSettings: null, assessments: [], learningStore: { templates: {}, scenarioPatterns: [] }, draft: null },
    expectedMeta
  }, { category: 'user_admin', eventType: 'user_state_reset', target: safeUsername }).catch(error => console.warn('clearUserPersistentState sync failed:', error.message));
}

function getUserSettingsDefaults(globalSettings = getAdminSettings()) {
  return {
    geography: globalSettings.geography,
    geographyPrimary: globalSettings.geography,
    geographySecondary: '',
    geographyTertiary: '',
    companyWebsiteUrl: globalSettings.companyWebsiteUrl,
    companyContextProfile: globalSettings.companyContextProfile,
    companyContextSections: globalSettings.companyContextSections,
    riskAppetiteStatement: globalSettings.riskAppetiteStatement,
    applicableRegulations: [...globalSettings.applicableRegulations],
    aiInstructions: globalSettings.aiInstructions,
    benchmarkStrategy: globalSettings.benchmarkStrategy,
    defaultLinkMode: globalSettings.defaultLinkMode,
    adminContextSummary: globalSettings.adminContextSummary,
    onboardedAt: '',
    userProfile: {
      fullName: '',
      jobTitle: '',
      department: '',
      businessUnit: '',
      departmentEntityId: '',
      businessUnitEntityId: '',
      focusAreas: [],
      preferredOutputs: '',
      workingContext: ''
    }
  };
}

function normaliseUserProfile(profile = {}, currentUser = AuthService.getCurrentUser()) {
  return {
    fullName: String(profile.fullName || currentUser?.displayName || '').trim(),
    jobTitle: String(profile.jobTitle || '').trim(),
    department: String(profile.department || '').trim(),
    businessUnit: String(profile.businessUnit || '').trim(),
    departmentEntityId: String(profile.departmentEntityId || '').trim(),
    businessUnitEntityId: String(profile.businessUnitEntityId || '').trim(),
    focusAreas: Array.isArray(profile.focusAreas) ? profile.focusAreas.map(String).filter(Boolean) : [],
    preferredOutputs: String(profile.preferredOutputs || '').trim(),
    workingContext: String(profile.workingContext || '').trim()
  };
}

function buildUserProfileSummary(profile = {}) {
  const parts = [];
  if (profile.fullName) parts.push(`Name: ${profile.fullName}`);
  if (profile.jobTitle) parts.push(`Role: ${profile.jobTitle}`);
  if (profile.department) parts.push(`Department: ${profile.department}`);
  if (profile.businessUnit) parts.push(`Business unit: ${profile.businessUnit}`);
  if (profile.focusAreas?.length) parts.push(`Focus areas: ${profile.focusAreas.join(', ')}`);
  if (profile.preferredOutputs) parts.push(`Preferred outputs: ${profile.preferredOutputs}`);
  if (profile.workingContext) parts.push(`Working context: ${profile.workingContext}`);
  return parts.join('\n');
}

const LEARNING_PARAM_KEYS = [
  'tefLikely',
  'threatCapLikely',
  'controlStrLikely',
  'irLikely',
  'biLikely',
  'dbLikely',
  'rlLikely',
  'tpLikely',
  'rcLikely'
];

const ORG_ENTITY_TYPES = [
  'Holding company',
  'Wholly owned subsidiary',
  'Majority-owned operating company',
  'Joint venture',
  'Listed portfolio company (majority stake)',
  'Listed portfolio company (minority stake)',
  "Arm's-length business partner",
  'Department / function'
];

const DEPARTMENT_RELATIONSHIP_TYPES = [
  'In-house',
  'Outsourced',
  'Hybrid'
];

const TYPICAL_DEPARTMENTS = [...DEFAULT_TYPICAL_DEPARTMENTS];

function getTypicalDepartments(settings = getAdminSettings()) {
  if (Array.isArray(settings.typicalDepartments) && settings.typicalDepartments.length) {
    return settings.typicalDepartments.map(name => String(name || '').trim()).filter(Boolean);
  }
  return [...DEFAULT_TYPICAL_DEPARTMENTS];
}

function getStoredBUOverrides() {
  const settings = getAdminSettings();
  if (Array.isArray(settings.buOverrides)) return settings.buOverrides;
  try {
    const saved = JSON.parse(localStorage.getItem('rq_bu_override') || 'null');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function getCompanyEntities(structure = getAdminSettings().companyStructure || []) {
  return Array.isArray(structure) ? structure.filter(node => isCompanyEntityType(node.type)) : [];
}

function getDepartmentEntities(structure = getAdminSettings().companyStructure || [], parentId = '') {
  const list = Array.isArray(structure) ? structure.filter(node => isDepartmentEntityType(node.type)) : [];
  return parentId ? list.filter(node => node.parentId === parentId) : list;
}

function getEntityById(structure = getAdminSettings().companyStructure || [], entityId = '') {
  return (Array.isArray(structure) ? structure : []).find(node => node.id === entityId) || null;
}

function getCompanyEntityForDepartment(structure = getAdminSettings().companyStructure || [], departmentId = '') {
  const department = getEntityById(structure, departmentId);
  if (!department?.parentId) return null;
  return getEntityById(structure, department.parentId);
}

function applyEntityLayerToSettings(baseSettings, layer = null, node = null) {
  if (!layer && !node) return baseSettings;
  return {
    ...baseSettings,
    geography: layer?.geography || baseSettings.geography,
    companyContextProfile: node?.profile || baseSettings.companyContextProfile,
    companyContextSections: node?.contextSections || baseSettings.companyContextSections,
    riskAppetiteStatement: layer?.riskAppetiteStatement || baseSettings.riskAppetiteStatement,
    applicableRegulations: Array.from(new Set([...(baseSettings.applicableRegulations || []), ...(layer?.applicableRegulations || [])])),
    aiInstructions: layer?.aiInstructions || baseSettings.aiInstructions,
    benchmarkStrategy: layer?.benchmarkStrategy || baseSettings.benchmarkStrategy,
    adminContextSummary: layer?.contextSummary || node?.profile || baseSettings.adminContextSummary
  };
}

function applyBUOverrideToSettings(baseSettings, buOverride = null) {
  if (!buOverride) return baseSettings;
  const next = {
    ...baseSettings,
    geography: buOverride.geography || baseSettings.geography,
    riskAppetiteStatement: buOverride.riskAppetiteStatement || baseSettings.riskAppetiteStatement,
    applicableRegulations: Array.from(new Set([
      ...(baseSettings.applicableRegulations || []),
      ...(Array.isArray(buOverride.regulatoryTags) ? buOverride.regulatoryTags : [])
    ])),
    aiInstructions: buOverride.aiGuidance || baseSettings.aiInstructions,
    benchmarkStrategy: buOverride.benchmarkStrategy || baseSettings.benchmarkStrategy,
    adminContextSummary: buOverride.contextSummary || baseSettings.adminContextSummary,
    escalationGuidance: buOverride.escalationGuidance || baseSettings.escalationGuidance
  };
  if (typeof buOverride.defaultLinkMode === 'boolean') next.defaultLinkMode = buOverride.defaultLinkMode;
  if (Number.isFinite(Number(buOverride.warningThresholdUsd)) && Number(buOverride.warningThresholdUsd) > 0) next.warningThresholdUsd = Number(buOverride.warningThresholdUsd);
  if (Number.isFinite(Number(buOverride.toleranceThresholdUsd)) && Number(buOverride.toleranceThresholdUsd) > 0) next.toleranceThresholdUsd = Number(buOverride.toleranceThresholdUsd);
  if (Number.isFinite(Number(buOverride.annualReviewThresholdUsd)) && Number(buOverride.annualReviewThresholdUsd) > 0) next.annualReviewThresholdUsd = Number(buOverride.annualReviewThresholdUsd);
  return next;
}

function activateAuthenticatedState() {
  updateAuthSessionState({ currentUser: AuthService.getCurrentUser() });
  if (!AppState.currentUser) {
    resetUserStateCache('');
    updateDraftAssessmentState({ draft: {}, draftDirty: false, draftLastSavedAt: 0 });
    resetSimulationState();
    LLMService.clearCompassConfig();
    renderAppBar();
    return;
  }

  updateDraftAssessmentState({ draft: {}, draftDirty: false, draftLastSavedAt: 0 });
  resetSimulationState();
  loadDraft();
  if (!AppState.draft.id) resetDraft();
  ensureDraftShape();
  if (!AppState.draft.applicableRegulations?.length) {
    AppState.draft.applicableRegulations = [...getEffectiveSettings().applicableRegulations];
  }

  const sessionLLM = getSessionLLMConfig();
  if (sessionLLM.apiUrl || sessionLLM.apiKey || sessionLLM.model) {
    LLMService.setCompassConfig(sessionLLM);
  } else {
    LLMService.clearCompassConfig();
  }

  renderAppBar();
}

function ensureDraftShape() {
  AppState.draft = {
    id: AppState.draft.id || 'a_' + Date.now(),
    templateId: AppState.draft.templateId || null,
    buId: AppState.draft.buId || null,
    buName: AppState.draft.buName || null,
    contextNotes: AppState.draft.contextNotes || '',
    narrative: AppState.draft.narrative || '',
    structuredScenario: AppState.draft.structuredScenario || null,
    scenarioTitle: AppState.draft.scenarioTitle || '',
    loadedDryRunId: AppState.draft.loadedDryRunId || '',
    llmAssisted: !!AppState.draft.llmAssisted,
    citations: Array.isArray(AppState.draft.citations) ? AppState.draft.citations : [],
    recommendations: Array.isArray(AppState.draft.recommendations) ? AppState.draft.recommendations : [],
    fairParams: AppState.draft.fairParams || {},
    results: AppState.draft.results || null,
    geography: formatScenarioGeographies(AppState.draft.geographies || AppState.draft.geography, DEFAULT_ADMIN_SETTINGS.geography),
    geographies: normaliseScenarioGeographies(AppState.draft.geographies || AppState.draft.geography, DEFAULT_ADMIN_SETTINGS.geography),
    riskCandidates: Array.isArray(AppState.draft.riskCandidates) ? AppState.draft.riskCandidates : (Array.isArray(AppState.draft.selectedRisks) ? AppState.draft.selectedRisks : []),
    selectedRiskIds: Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : (Array.isArray(AppState.draft.selectedRisks) ? AppState.draft.selectedRisks.map(risk => risk?.id).filter(Boolean) : []),
    selectedRisks: Array.isArray(AppState.draft.selectedRisks) ? AppState.draft.selectedRisks : [],
    sourceNarrative: AppState.draft.sourceNarrative || AppState.draft.narrative || '',
    enhancedNarrative: AppState.draft.enhancedNarrative || '',
    uploadedRegisterName: AppState.draft.uploadedRegisterName || '',
    registerFindings: AppState.draft.registerFindings || '',
    registerMeta: AppState.draft.registerMeta || null,
    linkedRisks: AppState.draft.linkedRisks != null ? !!AppState.draft.linkedRisks : DEFAULT_ADMIN_SETTINGS.defaultLinkMode,
    applicableRegulations: Array.isArray(AppState.draft.applicableRegulations) ? AppState.draft.applicableRegulations : [...DEFAULT_ADMIN_SETTINGS.applicableRegulations],
    intakeSummary: AppState.draft.intakeSummary || '',
    linkAnalysis: AppState.draft.linkAnalysis || '',
    workflowGuidance: Array.isArray(AppState.draft.workflowGuidance) ? AppState.draft.workflowGuidance : [],
    benchmarkBasis: AppState.draft.benchmarkBasis || '',
    inputRationale: AppState.draft.inputRationale || null,
    confidenceLabel: AppState.draft.confidenceLabel || '',
    evidenceQuality: AppState.draft.evidenceQuality || '',
    evidenceSummary: AppState.draft.evidenceSummary || '',
    primaryGrounding: Array.isArray(AppState.draft.primaryGrounding) ? AppState.draft.primaryGrounding : [],
    supportingReferences: Array.isArray(AppState.draft.supportingReferences) ? AppState.draft.supportingReferences : [],
    inferredAssumptions: Array.isArray(AppState.draft.inferredAssumptions) ? AppState.draft.inferredAssumptions : [],
    missingInformation: Array.isArray(AppState.draft.missingInformation) ? AppState.draft.missingInformation : [],
    learningNote: AppState.draft.learningNote || '',
    treatmentImprovementRequest: AppState.draft.treatmentImprovementRequest || '',
    guidedInput: {
      event: AppState.draft.guidedInput?.event || '',
      asset: AppState.draft.guidedInput?.asset || '',
      cause: AppState.draft.guidedInput?.cause || '',
      impact: AppState.draft.guidedInput?.impact || '',
      urgency: AppState.draft.guidedInput?.urgency || 'medium'
    }
  };
}

function getBUList() {
  const settings = getAdminSettings();
  const companyStructure = Array.isArray(settings.companyStructure) ? settings.companyStructure : [];
  const companyEntities = getCompanyEntities(companyStructure);
  const overrides = getStoredBUOverrides();

  if (!companyEntities.length) {
    return overrides.length ? overrides : AppState.buList;
  }

  const syncedCompanies = companyEntities.map(entity => {
    const generated = buildBUFromOrgEntity(entity, settings);
    const override = overrides.find(bu => bu.orgEntityId === entity.id) || overrides.find(bu => bu.id === generated.id);
    return {
      ...generated,
      ...(override || {}),
      id: override?.id || generated.id,
      name: entity.name || override?.name || generated.name,
      orgEntityId: entity.id
    };
  });

  const legacyEntries = overrides.filter(bu => !bu.orgEntityId || !companyEntities.some(entity => entity.id === bu.orgEntityId));
  return [...syncedCompanies, ...legacyEntries];
}
function saveBUList(list) {
  const next = Array.isArray(list) ? cloneSerializableState(list, list.slice()) : [];
  try {
    localStorage.setItem('rq_bu_override', JSON.stringify(next));
  } catch {}
  const adminSettings = getAdminSettings();
  saveAdminSettings({ ...adminSettings, buOverrides: next, docOverrides: getDocList() });
  AppState.buList = getBUList();
  RAGService.init(getDocList(), AppState.buList);
}
function mergeDocCatalog(defaultDocs = [], storedDocs = []) {
  const base = Array.isArray(defaultDocs) ? defaultDocs : [];
  const overrides = Array.isArray(storedDocs) ? storedDocs : [];
  const byId = new Map(base.map(doc => [doc.id, { ...doc }]));
  overrides.forEach(doc => {
    const id = String(doc?.id || '').trim();
    if (!id) return;
    byId.set(id, { ...(byId.get(id) || {}), ...doc });
  });
  return Array.from(byId.values());
}

function getDocList() {
  const settings = getAdminSettings();
  if (Array.isArray(settings.docOverrides) && settings.docOverrides.length) return mergeDocCatalog(AppState.docList, settings.docOverrides);
  try {
    const ov = JSON.parse(localStorage.getItem('rq_doc_override') || 'null');
    return Array.isArray(ov) && ov.length ? mergeDocCatalog(AppState.docList, ov) : AppState.docList;
  } catch { return AppState.docList; }
}
function saveDocList(list) {
  const next = Array.isArray(list) ? cloneSerializableState(list, list.slice()) : [];
  try {
    localStorage.setItem('rq_doc_override', JSON.stringify(next));
  } catch {}
  const adminSettings = getAdminSettings();
  saveAdminSettings({ ...adminSettings, docOverrides: next, buOverrides: getStoredBUOverrides() });
  AppState.docList = next;
  RAGService.init(next, getBUList());
}

function getAdminSettings() {
  if (AppState.adminSettingsCache) {
    return normaliseAdminSettings(AppState.adminSettingsCache);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(GLOBAL_ADMIN_STORAGE_KEY) || 'null') || {};
    const merged = normaliseAdminSettings(saved);
    updateAdminSettingsState(merged);
    return merged;
  } catch {
    return normaliseAdminSettings();
  }
}

function applyManagedAccountAssignmentToSettings(account, updates = {}, baseSettings = getAdminSettings()) {
  const nextRole = updates.role || account.role || 'user';
  const nextBusinessUnitEntityId = updates.businessUnitEntityId !== undefined ? updates.businessUnitEntityId : (account.businessUnitEntityId || '');
  const nextDepartmentEntityId = updates.departmentEntityId !== undefined ? updates.departmentEntityId : (account.departmentEntityId || '');
  const nextStructure = (Array.isArray(baseSettings.companyStructure) ? baseSettings.companyStructure : []).map(node => {
    const ownsNodeNow = node.ownerUsername === account.username;
    const shouldOwnBusiness = isCompanyEntityType(node.type) && nextRole === 'bu_admin' && node.id === nextBusinessUnitEntityId;
    const shouldOwnDepartment = isDepartmentEntityType(node.type) && nextRole === 'function_admin' && node.id === nextDepartmentEntityId;
    if (!ownsNodeNow && !shouldOwnBusiness && !shouldOwnDepartment) return node;
    if (shouldOwnBusiness || shouldOwnDepartment) {
      return { ...node, ownerUsername: account.username };
    }
    if (ownsNodeNow) {
      return { ...node, ownerUsername: '' };
    }
    return node;
  });
  return {
    ...baseSettings,
    companyStructure: nextStructure
  };
}

async function saveAdminSettings(settings, options = {}) {
  const merged = normaliseAdminSettings(settings);
  updateAdminSettingsState(merged);
  try {
    localStorage.setItem(GLOBAL_ADMIN_STORAGE_KEY, JSON.stringify(merged));
  } catch {}
  if (AuthService.getAdminApiSecret() || AuthService.getApiSessionToken()) {
    try {
      const result = await syncSharedAdminSettings(merged, options.audit || null);
      if (result?.settings) {
        applySharedSettingsLocally(result.settings);
      }
    } catch (error) {
      if (error?.code === 'WRITE_CONFLICT') {
        showPersistenceConflictDialog({
          message: 'These platform settings were updated in another session before this save finished.',
          onReloadLatest: async () => {
            if (error?.latestSettings) applySharedSettingsLocally(error.latestSettings);
            else await loadSharedAdminSettings();
            Router.navigate(window.location.hash.replace(/^#/, '') || '/admin/settings/org');
            UI.toast('Loaded the latest platform settings.', 'info');
          },
          onRetry: async () => {
            if (error?.latestSettings) applySharedSettingsLocally(error.latestSettings);
            else await loadSharedAdminSettings();
            await new Promise(resolve => window.setTimeout(resolve, getSafeRetryAfterMs(error)));
            await saveAdminSettings(settings, options);
          }
        });
        return false;
      }
      console.warn('syncSharedAdminSettings failed:', error.message);
      return false;
    }
  }
  return true;
}

function normaliseComparableUserSettingValue(key, value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value ?? '';
}

function hasUserSettingOverride(key, settings = {}, defaults = {}) {
  return JSON.stringify(normaliseComparableUserSettingValue(key, settings[key])) !== JSON.stringify(normaliseComparableUserSettingValue(key, defaults[key]));
}

function getInheritedSettingsForUserSelection(user = AuthService.getCurrentUser(), candidateSettings = {}) {
  const globalSettings = getAdminSettings();
  if (!user || user.role === 'admin') {
    return globalSettings;
  }
  const selection = resolveUserOrganisationSelection(user, candidateSettings, globalSettings);
  const scopedBusinessUnitEntityId = String(selection.businessUnitEntityId || '').trim();
  const scopedDepartmentEntityId = String(selection.departmentEntityId || '').trim();
  const companyNode = getEntityById(globalSettings.companyStructure || [], scopedBusinessUnitEntityId);
  const departmentNode = getEntityById(globalSettings.companyStructure || [], scopedDepartmentEntityId);
  const companyLayer = getEntityLayerById(globalSettings, scopedBusinessUnitEntityId);
  const departmentLayer = getEntityLayerById(globalSettings, scopedDepartmentEntityId);
  const buOverride = getBUList().find(item => item.orgEntityId === scopedBusinessUnitEntityId) || null;
  return applyBUOverrideToSettings(
    applyEntityLayerToSettings(
      applyEntityLayerToSettings(globalSettings, companyLayer, companyNode),
      departmentLayer,
      departmentNode
    ),
    buOverride
  );
}

function buildResolvedUserSettings(saved = {}, defaults = getUserSettingsDefaults(), globalSettings = getAdminSettings()) {
  const resolved = {
    ...defaults,
    ...saved,
    ...normaliseUserGeographies(saved, globalSettings),
    applicableRegulations: Array.isArray(saved.applicableRegulations) ? saved.applicableRegulations : [...defaults.applicableRegulations],
    userProfile: normaliseUserProfile(saved.userProfile || defaults.userProfile),
    companyContextSections: saved.companyContextSections && typeof saved.companyContextSections === 'object'
      ? saved.companyContextSections
      : defaults.companyContextSections
  };
  const overrideKeys = Array.isArray(saved._overrideKeys)
    ? saved._overrideKeys.map(key => String(key || '').trim()).filter(key => USER_SETTINGS_OVERRIDE_FIELDS.includes(key))
    : [];
  USER_SETTINGS_OVERRIDE_FIELDS.forEach(key => {
    if (!overrideKeys.includes(key)) {
      resolved[key] = defaults[key];
    }
  });
  resolved._overrideKeys = overrideKeys;
  return resolved;
}

function buildStoredUserSettings(settings = {}, defaults = getUserSettingsDefaults(), globalSettings = getAdminSettings()) {
  const merged = {
    ...defaults,
    ...settings,
    ...normaliseUserGeographies(settings, globalSettings),
    applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [...defaults.applicableRegulations],
    userProfile: normaliseUserProfile(settings.userProfile || defaults.userProfile),
    companyContextSections: settings.companyContextSections && typeof settings.companyContextSections === 'object'
      ? settings.companyContextSections
      : defaults.companyContextSections
  };
  const stored = {
    geography: merged.geography,
    geographyPrimary: merged.geographyPrimary || merged.geography,
    geographySecondary: merged.geographySecondary || '',
    geographyTertiary: merged.geographyTertiary || '',
    userProfile: merged.userProfile,
    onboardedAt: merged.onboardedAt || '',
    _overrideKeys: []
  };
  USER_SETTINGS_OVERRIDE_FIELDS.forEach(key => {
    if (!hasUserSettingOverride(key, merged, defaults)) return;
    stored[key] = merged[key];
    stored._overrideKeys.push(key);
  });
  return stored;
}

function getUserSettings() {
  const globalSettings = getAdminSettings();
  const defaults = getUserSettingsDefaults(globalSettings);
  const cache = ensureUserStateCache();
  if (cache.userSettings) {
    return buildResolvedUserSettings(cache.userSettings, defaults, globalSettings);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX)) || 'null') || {};
    cache.userSettings = saved;
    return buildResolvedUserSettings(saved, defaults, globalSettings);
  } catch {
    return buildResolvedUserSettings({}, defaults, globalSettings);
  }
}

function saveUserSettings(settings) {
  const inheritedDefaults = getInheritedSettingsForUserSelection(AuthService.getCurrentUser(), settings);
  const stored = buildStoredUserSettings(settings, getUserSettingsDefaults(inheritedDefaults), getAdminSettings());
  const cache = ensureUserStateCache();
  cache.userSettings = stored;
  AppState.userSettingsSavedAt = Date.now();
  try {
    localStorage.setItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX), JSON.stringify(stored));
  } catch {}
  queueSharedUserStateSync({ userSettings: stored });
  updateWorkspaceSyncState('settings');
}

function confirmDestructiveAction(options = {}) {
  return UI.confirm({
    title: options.title || 'Confirm action',
    body: options.body || options.message || 'Please confirm this action.',
    confirmLabel: options.confirmLabel || 'Confirm',
    cancelLabel: options.cancelLabel || 'Cancel',
    tone: options.tone || 'danger'
  });
}

function loadScenarioTemplateById(templateId) {
  const template = Array.isArray(ScenarioTemplates)
    ? ScenarioTemplates.find(item => item.id === templateId)
    : null;
  if (!template) return false;
  loadTemplate(template);
  return true;
}

function launchPilotSampleAssessment() {
  resetDraft();
  Router.navigate('/wizard/1');
  window.setTimeout(() => {
    // The sample path should feel relevant to the user’s current function rather than always loading the same generic case.
    const experienceModel = typeof getStep1ExampleExperienceModel === 'function'
      ? getStep1ExampleExperienceModel(getEffectiveSettings(), AppState.draft)
      : null;
    const sampleScenario = experienceModel?.recommendedExamples?.[0]
      || (Array.isArray(STEP1_DRY_RUN_SCENARIOS) ? STEP1_DRY_RUN_SCENARIOS[0] : null);
    if (sampleScenario && typeof applyDryRunScenario === 'function') {
      applyDryRunScenario(sampleScenario);
      UI.toast(`Sample assessment path loaded for ${experienceModel?.functionLabel?.toLowerCase?.() || 'your workspace'}.`, 'info', 4500);
      return;
    }
    const fallbackTemplate = Array.isArray(ScenarioTemplates) ? ScenarioTemplates[0] : null;
    if (fallbackTemplate) {
      loadTemplate(fallbackTemplate);
      UI.toast('A sample assessment was loaded from the recommended template path.', 'info', 5000);
    }
  }, 0);
}

function getEffectiveSettings() {
  const globalSettings = getAdminSettings();
  const user = AuthService.getCurrentUser();
  if (!user || user.role === 'admin') {
    return globalSettings;
  }
  const userSettings = getUserSettings();
  const draftBu = AppState.draft?.buId ? getBUList().find(item => item.id === AppState.draft.buId) : null;
  const selection = resolveUserOrganisationSelection(user, userSettings, globalSettings);
  const scopedBusinessUnitEntityId = draftBu?.orgEntityId || selection.businessUnitEntityId;
  const companyNode = getEntityById(globalSettings.companyStructure || [], scopedBusinessUnitEntityId);
  const departmentNode = getEntityById(globalSettings.companyStructure || [], selection.departmentEntityId);
  const companyLayer = getEntityLayerById(globalSettings, scopedBusinessUnitEntityId);
  const departmentLayer = getEntityLayerById(globalSettings, selection.departmentEntityId);
  const buOverride = draftBu || getBUList().find(item => item.orgEntityId === scopedBusinessUnitEntityId) || null;
  const organisationScopedDefaults = applyBUOverrideToSettings(
    applyEntityLayerToSettings(
      applyEntityLayerToSettings(globalSettings, companyLayer, companyNode),
      departmentLayer,
      departmentNode
    ),
    buOverride
  );
  const merged = {
    ...organisationScopedDefaults,
    geography: userSettings.geography || organisationScopedDefaults.geography,
    geographyPrimary: userSettings.geographyPrimary || organisationScopedDefaults.geography,
    geographySecondary: userSettings.geographySecondary || '',
    geographyTertiary: userSettings.geographyTertiary || '',
    userProfile: normaliseUserProfile(userSettings.userProfile),
    userProfileSummary: buildUserProfileSummary(normaliseUserProfile(userSettings.userProfile)),
    selectedBusinessEntity: companyNode,
    selectedDepartmentEntity: departmentNode,
    onboardedAt: userSettings.onboardedAt || ''
  };
  const overrideKeys = Array.isArray(userSettings._overrideKeys) ? userSettings._overrideKeys : [];
  USER_SETTINGS_OVERRIDE_FIELDS.forEach(key => {
    if (!overrideKeys.includes(key)) return;
    const value = userSettings[key];
    if (Array.isArray(value)) {
      merged[key] = value.length ? value : organisationScopedDefaults[key];
      return;
    }
    if (typeof value === 'string') {
      merged[key] = value.trim() ? value : organisationScopedDefaults[key];
      return;
    }
    if (typeof value === 'boolean') {
      merged[key] = value;
      return;
    }
    merged[key] = value ?? organisationScopedDefaults[key];
  });
  return merged;
}

function joinDistinctText(parts = []) {
  const seen = new Set();
  return (Array.isArray(parts) ? parts : [])
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .filter(part => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n\n');
}

function isContextVisibleToChildUsers(flagValue) {
  return flagValue !== false;
}

function buildInheritedContextDisplayModel(options = {}) {
  const globalSettings = options.globalSettings || getAdminSettings();
  const user = options.user || AuthService.getCurrentUser();
  if (!user || user.role === 'admin') {
    return { highlights: [], visibleDetails: [], hasHiddenDetails: false };
  }
  const userSettings = options.userSettings || getUserSettings();
  const effective = options.effectiveSettings || getEffectiveSettings();
  const selection = resolveUserOrganisationSelection(user, userSettings, globalSettings);
  const draftBu = options.buId
    ? getBUList().find(item => item.id === options.buId)
    : (AppState.draft?.buId ? getBUList().find(item => item.id === AppState.draft.buId) : null);
  const scopedBusinessUnitEntityId = String(options.businessUnitEntityId || draftBu?.orgEntityId || selection.businessUnitEntityId || '').trim();
  const scopedDepartmentEntityId = String(options.departmentEntityId || selection.departmentEntityId || '').trim();
  const businessNode = getEntityById(globalSettings.companyStructure || [], scopedBusinessUnitEntityId);
  const departmentNode = getEntityById(globalSettings.companyStructure || [], scopedDepartmentEntityId);
  const businessLayer = getEntityLayerById(globalSettings, scopedBusinessUnitEntityId);
  const departmentLayer = getEntityLayerById(globalSettings, scopedDepartmentEntityId);
  const buOverride = draftBu || getBUList().find(item => item.orgEntityId === scopedBusinessUnitEntityId) || null;
  const highlights = [];
  const visibleDetails = [];
  let hasHiddenDetails = false;

  if (businessNode?.name || draftBu?.name) {
    highlights.push({ label: 'Business unit', value: draftBu?.name || businessNode?.name || 'Inherited' });
  }
  if (departmentNode?.name) {
    highlights.push({ label: 'Function', value: departmentNode.name });
  }
  if (effective?.geography) {
    highlights.push({ label: 'Geography', value: effective.geography });
  }
  const effectiveRegs = Array.isArray(effective?.applicableRegulations) ? effective.applicableRegulations.filter(Boolean) : [];
  if (effectiveRegs.length) {
    highlights.push({
      label: 'Regulations',
      value: effectiveRegs.length <= 3 ? effectiveRegs.join(', ') : `${effectiveRegs.length} inherited tags`
    });
  }

  const businessContextSource = String(businessLayer?.contextSummary || buOverride?.contextSummary || '').trim();
  if (businessContextSource) {
    if (isContextVisibleToChildUsers(businessLayer?.visibleToChildUsers) && isContextVisibleToChildUsers(buOverride?.contextVisibleToUsers)) {
      visibleDetails.push({ label: 'Business unit context', value: businessContextSource });
    } else {
      hasHiddenDetails = true;
    }
  }
  const departmentContextSource = String(departmentLayer?.contextSummary || '').trim();
  if (departmentContextSource) {
    if (isContextVisibleToChildUsers(departmentLayer?.visibleToChildUsers)) {
      visibleDetails.push({ label: 'Function context', value: departmentContextSource });
    } else {
      hasHiddenDetails = true;
    }
  }
  const organisationContextSource = String(globalSettings?.adminContextSummary || '').trim();
  if (organisationContextSource) {
    if (isContextVisibleToChildUsers(globalSettings?.adminContextVisibleToUsers)) {
      visibleDetails.push({ label: 'Organisation guidance', value: organisationContextSource });
    } else {
      hasHiddenDetails = true;
    }
  }
  if (!hasHiddenDetails && !isContextVisibleToChildUsers(globalSettings?.adminContextVisibleToUsers) && String(globalSettings?.companyContextProfile || '').trim()) {
    // The platform can still apply hidden company context even when the user-facing summary is suppressed.
    hasHiddenDetails = true;
  }
  return { highlights, visibleDetails, hasHiddenDetails };
}

function buildContextInfluencePreviewModel(options = {}) {
  const effective = options.effectiveSettings || getEffectiveSettings();
  const inherited = buildInheritedContextDisplayModel(options);
  const appliedItems = [];
  if (effective?.geography) {
    appliedItems.push({ label: 'Default geography', value: effective.geography });
  }
  const regulations = Array.isArray(effective?.applicableRegulations)
    ? effective.applicableRegulations.filter(Boolean)
    : [];
  if (regulations.length) {
    appliedItems.push({
      label: 'Regulations carried forward',
      value: regulations.length <= 3 ? regulations.join(', ') : `${regulations.length} regulation tags`
    });
  }
  const aiInstructions = String(effective?.aiInstructions || '').trim();
  if (aiInstructions) {
    appliedItems.push({
      label: 'AI guidance',
      value: 'Shared governance guidance is active'
    });
  }
  return {
    title: 'What is already shaping this assessment',
    summary: 'Inherited business, function, geography, and governance context are applied before your personal working context and edits.',
    appliedItems,
    visibleDetails: inherited.visibleDetails,
    hasHiddenDetails: inherited.hasHiddenDetails
  };
}

function renderContextInfluencePreview(model = {}) {
  const appliedItems = Array.isArray(model.appliedItems) ? model.appliedItems.filter(Boolean) : [];
  const visibleDetails = Array.isArray(model.visibleDetails) ? model.visibleDetails.filter(Boolean) : [];
  if (!appliedItems.length && !visibleDetails.length && !model.hasHiddenDetails) return '';
  return `<section class="card card--background wizard-context-preview anim-fade-in">
    <div class="wizard-premium-head">
      <div>
        <div class="context-panel-title">${escapeHtml(String(model.title || 'Context influence preview'))}</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">${escapeHtml(String(model.summary || 'Inherited platform context is active for this assessment.'))}</p>
      </div>
      <span class="badge badge--neutral">Applied context</span>
    </div>
    ${appliedItems.length ? `<div class="citation-chips" style="margin-top:var(--sp-4)">${appliedItems.map(item => `<span class="badge badge--neutral">${escapeHtml(String(item.label || 'Context'))}: ${escapeHtml(String(item.value || 'Active'))}</span>`).join('')}</div>` : ''}
    ${visibleDetails.length ? `<div class="wizard-context-preview__details">
      ${visibleDetails.map(item => `<div class="wizard-context-preview__detail">
        <div class="results-driver-label">${escapeHtml(String(item.label || 'Context detail'))}</div>
        <div class="results-summary-copy">${escapeHtml(String(item.value || ''))}</div>
      </div>`).join('')}
    </div>` : ''}
    ${model.hasHiddenDetails ? '<div class="form-help" style="margin-top:var(--sp-4)">Additional governed context is active for this assessment, but its detail is intentionally hidden in this workspace.</div>' : ''}
  </section>`;
}

function buildCurrentAIAssistContext(options = {}) {
  const globalSettings = getAdminSettings();
  const user = AuthService.getCurrentUser();
  const userSettings = getUserSettings();
  const effective = getEffectiveSettings();
  const selection = resolveUserOrganisationSelection(user, userSettings, globalSettings);
  const draftBu = options.buId ? getBUList().find(item => item.id === options.buId) : (AppState.draft?.buId ? getBUList().find(item => item.id === AppState.draft.buId) : null);
  const scopedBusinessUnitEntityId = String(options.businessUnitEntityId || draftBu?.orgEntityId || selection.businessUnitEntityId || '').trim();
  const scopedDepartmentEntityId = String(options.departmentEntityId || selection.departmentEntityId || '').trim();
  const businessNode = getEntityById(globalSettings.companyStructure || [], scopedBusinessUnitEntityId);
  const departmentNode = getEntityById(globalSettings.companyStructure || [], scopedDepartmentEntityId);
  const businessLayer = getEntityLayerById(globalSettings, scopedBusinessUnitEntityId);
  const departmentLayer = getEntityLayerById(globalSettings, scopedDepartmentEntityId);
  const buOverride = draftBu || getBUList().find(item => item.orgEntityId === scopedBusinessUnitEntityId) || null;
  const inherited = applyBUOverrideToSettings(
    applyEntityLayerToSettings(
      applyEntityLayerToSettings(globalSettings, businessLayer, businessNode),
      departmentLayer,
      departmentNode
    ),
    buOverride
  );
  const userProfile = normaliseUserProfile(userSettings.userProfile, user);
  const userProfileSummary = buildUserProfileSummary(userProfile);
  const businessUnitContext = String(businessLayer?.contextSummary || buOverride?.contextSummary || businessNode?.profile || '').trim();
  const departmentContext = String(departmentLayer?.contextSummary || departmentNode?.profile || '').trim();
  const inheritedContextSummary = String(inherited.adminContextSummary || '').trim();
  const personalContextSummary = String(userSettings.adminContextSummary || effective.adminContextSummary || '').trim();
  const combinedContextSummary = joinDistinctText([
    businessUnitContext ? `Business unit context: ${businessUnitContext}` : '',
    departmentContext ? `Function context: ${departmentContext}` : '',
    inheritedContextSummary ? `Inherited organisation context: ${inheritedContextSummary}` : '',
    personalContextSummary ? `User context: ${personalContextSummary}` : ''
  ]);
  const companyStructureContext = buildOrganisationContextSummary(globalSettings);
  const adminSettings = {
    ...effective,
    geography: inherited.geography || effective.geography,
    applicableRegulations: Array.from(new Set([
      ...(inherited.applicableRegulations || []),
      ...(effective.applicableRegulations || [])
    ].map(String).filter(Boolean))),
    aiInstructions: joinDistinctText([
      inherited.aiInstructions,
      effective.aiInstructions,
      userSettings.aiInstructions
    ]),
    benchmarkStrategy: String(userSettings.benchmarkStrategy || effective.benchmarkStrategy || inherited.benchmarkStrategy || '').trim(),
    riskAppetiteStatement: String(userSettings.riskAppetiteStatement || effective.riskAppetiteStatement || inherited.riskAppetiteStatement || '').trim(),
    adminContextSummary: combinedContextSummary || effective.adminContextSummary || inheritedContextSummary,
    inheritedContextSummary,
    personalContextSummary,
    businessUnitContext,
    departmentContext,
    companyStructureContext,
    userProfileSummary,
    selectedBusinessEntity: businessNode,
    selectedDepartmentEntity: departmentNode
  };
  const businessUnit = (() => {
    const base = draftBu || (businessNode ? buildBUFromOrgEntity(businessNode, globalSettings) : null);
    if (!base) return null;
    return {
      ...base,
      geography: String(base.geography || adminSettings.geography || '').trim(),
      regulatoryTags: Array.from(new Set([
        ...(base.regulatoryTags || []),
        ...(businessLayer?.applicableRegulations || []),
        ...(departmentLayer?.applicableRegulations || []),
        ...(adminSettings.applicableRegulations || [])
      ].map(String).filter(Boolean))),
      contextSummary: businessUnitContext || base.contextSummary || '',
      aiGuidance: joinDistinctText([businessLayer?.aiInstructions, departmentLayer?.aiInstructions, base.aiGuidance, adminSettings.aiInstructions]),
      benchmarkStrategy: String(base.benchmarkStrategy || adminSettings.benchmarkStrategy || '').trim(),
      companyStructureContext,
      userProfileSummary,
      selectedDepartmentContext: departmentContext
    };
  })();
  return {
    adminSettings,
    businessUnit,
    selectedBusinessEntity: businessNode,
    selectedDepartmentEntity: departmentNode,
    businessLayer,
    departmentLayer
  };
}

function getToleranceThreshold() {
  const value = Number(getEffectiveSettings().toleranceThresholdUsd);
  return Number.isFinite(value) && value > 0 ? value : TOLERANCE_THRESHOLD;
}

function getWarningThreshold() {
  const value = Number(getEffectiveSettings().warningThresholdUsd);
  return Number.isFinite(value) && value > 0 ? value : 3_000_000;
}

function getAnnualReviewThreshold() {
  const value = Number(getEffectiveSettings().annualReviewThresholdUsd);
  return Number.isFinite(value) && value > 0 ? value : 12_000_000;
}

function inferCompanyNameFromUrl(url) {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    const root = hostname.split('.')[0] || hostname;
    return root
      .split(/[-_]/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return '';
  }
}

function renderCompanyStructureSummary(structure = []) {
  if (!structure.length) {
    return `<div class="form-help">No organisation structure saved yet. Add a top-level entity such as a holding company or operating company, then attach subsidiaries, portfolio companies, partners, and departments beneath it.</div>`;
  }
  const settings = getAdminSettings();
  const managedAccounts = getManagedAccountsForAdmin(settings);
  const accountLabelByUsername = new Map(managedAccounts.map(account => [account.username, account.displayName]));
  const byParent = new Map();
  structure.forEach(node => {
    const key = node.parentId || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  });

  function sortNodes(nodes = []) {
    return [...nodes].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
  }

  function renderDepartmentList(parentNode) {
    const departments = sortNodes((byParent.get(parentNode.id) || []).filter(node => isDepartmentEntityType(node.type)));
    if (!departments.length) return '';
    return `
      <div class="org-accordion__section">
        <div class="org-accordion__label">Functions</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${departments.map(node => {
            const contextSummary = getEntityLayerById(settings, node.id)?.contextSummary || node.profile || '';
            const ownerLabel = node.ownerUsername ? (accountLabelByUsername.get(node.ownerUsername) || node.ownerUsername) : 'No owner';
            return `
              <div class="org-related-card org-related-card--compact org-theme--department">
                <div class="org-related-card__head">
                  <div>
                    <div class="org-related-card__title">${node.name}</div>
                    <div class="form-help">${node.departmentRelationshipType || 'In-house'} · ${ownerLabel} · ${contextSummary ? 'Saved context' : 'No saved context'}</div>
                  </div>
                  <div class="flex items-center gap-3" style="flex-wrap:wrap">
                    <button class="btn btn--ghost btn--sm org-entity-context" data-org-id="${node.id}" type="button">Context</button>
                    <button class="btn btn--ghost btn--sm org-entity-edit" data-org-id="${node.id}" type="button">Edit</button>
                    <button class="btn btn--ghost btn--sm org-entity-delete" data-org-id="${node.id}" type="button">Remove</button>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderNodes(parentId, depth = 0) {
    const childCompanies = sortNodes((byParent.get(parentId || 'root') || []).filter(node => isCompanyEntityType(node.type)));
    return childCompanies.map(node => {
      const childMarkup = renderNodes(node.id, depth + 1);
      const contextSummary = truncateText(getEntityLayerById(settings, node.id)?.contextSummary || node.profile || 'No saved context yet.', 100);
      return `
        <details class="org-accordion ${getOrgEntityThemeClass(node.type)}" ${depth < 1 ? 'open' : ''} style="margin-left:${depth * 16}px">
          <summary class="org-accordion__summary">
            <div class="org-accordion__identity">
              <span class="badge badge--gold">${node.type}</span>
              <strong>${node.name}</strong>
            </div>
            <div class="org-accordion__meta">
              <span class="form-help">${getEntityLayerById(settings, node.id)?.contextSummary ? 'Saved context' : 'No saved context'}</span>
              <button class="btn btn--secondary btn--sm org-entity-add-department org-summary-action" data-org-id="${node.id}" type="button">Add Function</button>
              <button class="btn btn--ghost btn--sm org-entity-context org-summary-action" data-org-id="${node.id}" type="button">Context</button>
              <button class="btn btn--ghost btn--sm org-entity-edit org-summary-action" data-org-id="${node.id}" type="button">Edit</button>
            </div>
          </summary>
          <div class="org-accordion__body">
            <div class="org-accordion__toolbar">
              <div class="form-help">${getEntityLineageLabel(structure, node.id) || node.name}</div>
            </div>
            <div class="org-accordion__snapshot">${contextSummary}</div>
            ${renderDepartmentList(node)}
            ${childMarkup ? `
              <div class="org-accordion__section">
                <div class="org-accordion__label">Child Entities</div>
                <div style="display:flex;flex-direction:column;gap:12px">${childMarkup}</div>
              </div>` : ''}
          </div>
        </details>`;
    }).join('');
  }
  return `<div class="org-accordion-list">${renderNodes('root')}</div>`;
}

function getEntityLineage(structure = [], entityId = '') {
  if (!entityId) return [];
  const byId = new Map(structure.map(node => [node.id, node]));
  const chain = [];
  let cursor = byId.get(entityId);
  const visited = new Set();
  while (cursor && !visited.has(cursor.id)) {
    chain.unshift(cursor);
    visited.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
  }
  return chain;
}

function getEntityLineageLabel(structure = [], entityId = '') {
  const chain = getEntityLineage(structure, entityId);
  return chain.length ? chain.map(node => node.name).join(' > ') : '';
}

function getChildCompanyEntities(structure = [], parentId = '') {
  return (Array.isArray(structure) ? structure : []).filter(node =>
    isCompanyEntityType(node.type) && String(node.parentId || '') === String(parentId || '')
  );
}

function getOrgEntityThemeClass(type = '') {
  const value = String(type || '').toLowerCase();
  if (value === 'holding company') return 'org-theme--holding';
  if (value.includes('subsidiary')) return 'org-theme--subsidiary';
  if (value.includes('operating company')) return 'org-theme--operating';
  if (value.includes('joint venture')) return 'org-theme--jointventure';
  if (value.includes('portfolio company')) return 'org-theme--portfolio';
  if (value.includes('partner')) return 'org-theme--partner';
  if (value === 'department / function') return 'org-theme--department';
  return 'org-theme--default';
}

function getEntityLayerById(settings = getAdminSettings(), entityId = '') {
  const layers = Array.isArray(settings.entityContextLayers) ? settings.entityContextLayers : [];
  return layers.find(layer => layer.entityId === entityId) || null;
}

function buildBUFromOrgEntity(entity, settings = getAdminSettings()) {
  const layer = getEntityLayerById(settings, entity?.id);
  const contextSections = entity?.contextSections || {};
  return {
    id: slugify(entity?.name || `bu-${Date.now()}`),
    name: entity?.name || '',
    orgEntityId: entity?.id || '',
    geography: layer?.geography || '',
    criticalServices: [],
    keySystems: [],
    dataTypes: [],
    regulatoryTags: [...new Set([
      ...(layer?.applicableRegulations || [])
    ])],
    contextSummary: layer?.contextSummary || contextSections.companySummary || entity?.profile || '',
    aiGuidance: layer?.aiInstructions || '',
    benchmarkStrategy: '',
    defaultLinkMode: null,
    riskAppetiteStatement: '',
    escalationGuidance: '',
    warningThresholdUsd: null,
    toleranceThresholdUsd: null,
    annualReviewThresholdUsd: null,
    notes: entity?.type ? `Mapped from organisation entity: ${entity.type}.` : '',
    defaultAssumptions: {
      tef: { min: 1, likely: 4, max: 10 },
      controlStrength: { min: 0.4, likely: 0.6, max: 0.85 },
      threatCapability: { min: 0.3, likely: 0.55, max: 0.9 },
      secondaryProbability: { min: 0.05, likely: 0.15, max: 0.3 }
    },
    docIds: []
  };
}

function isDepartmentEntityType(type = '') {
  return String(type).toLowerCase() === 'department / function';
}

function isCompanyEntityType(type = '') {
  return !!type && !isDepartmentEntityType(type);
}

function requiresParentEntity(type = '') {
  return [
    'Wholly owned subsidiary',
    'Majority-owned operating company',
    'Joint venture',
    'Listed portfolio company (majority stake)',
    'Listed portfolio company (minority stake)',
    "Arm's-length business partner",
    'Department / function'
  ].includes(type);
}

function buildCompanyStructureContext(structure = []) {
  if (!structure.length) return '';
  const idToNode = new Map(structure.map(node => [node.id, node]));
  return structure.map(node => {
    const parent = node.parentId ? idToNode.get(node.parentId) : null;
    const parts = [
      `${node.name} (${node.type})`,
      parent ? `sits under ${parent.name}` : 'top-level entity'
    ];
    if (node.websiteUrl) parts.push(`website: ${node.websiteUrl}`);
    if (node.departmentHint) parts.push(`department family: ${node.departmentHint}`);
    if (node.departmentRelationshipType) parts.push(`delivery model: ${node.departmentRelationshipType}`);
    if (node.profile) parts.push(`context: ${truncateText(node.profile, 220)}`);
    return `- ${parts.join(' | ')}`;
  }).join('\n');
}

function buildEntityLayerContext(layers = [], structure = []) {
  if (!layers.length) return '';
  const idToNode = new Map(structure.map(node => [node.id, node]));
  return layers.map(layer => {
    const node = idToNode.get(layer.entityId);
    const parts = [
      `${node?.name || layer.entityName || 'Unknown entity'} layer`
    ];
    if (layer.geography) parts.push(`geography: ${layer.geography}`);
    if (layer.riskAppetiteStatement) parts.push(`appetite: ${truncateText(layer.riskAppetiteStatement, 160)}`);
    if (layer.applicableRegulations?.length) parts.push(`regulations: ${layer.applicableRegulations.join(', ')}`);
    if (layer.aiInstructions) parts.push(`AI guidance: ${truncateText(layer.aiInstructions, 180)}`);
    if (layer.benchmarkStrategy) parts.push(`benchmark strategy: ${truncateText(layer.benchmarkStrategy, 180)}`);
    if (layer.contextSummary) parts.push(`context summary: ${truncateText(layer.contextSummary, 180)}`);
    return `- ${parts.join(' | ')}`;
  }).join('\n');
}

function buildOrganisationContextSummary(settings = getAdminSettings()) {
  const structureText = buildCompanyStructureContext(settings.companyStructure || []);
  const layerText = buildEntityLayerContext(settings.entityContextLayers || [], settings.companyStructure || []);
  return [structureText, layerText ? `Entity context layers:\n${layerText}` : ''].filter(Boolean).join('\n');
}

function buildCompanyContextSections(result = {}) {
  return {
    companySummary: String(result.companySummary || '').trim(),
    businessModel: String(result.businessProfile || '').trim(),
    operatingModel: String(result.operatingModel || '').trim(),
    publicCommitments: Array.isArray(result.publicCommitments) ? result.publicCommitments.map(String).join('\n') : String(result.publicCommitments || '').trim(),
    keyRiskSignals: Array.isArray(result.riskSignals) ? result.riskSignals.map(String).join('\n') : String(result.riskSignals || '').trim(),
    obligations: Array.isArray(result.likelyObligations) ? result.likelyObligations.map(String).join('\n') : String(result.likelyObligations || '').trim(),
    sources: Array.isArray(result.sources) ? result.sources.map(source => source.note || source.url).filter(Boolean).join('\n') : String(result.sources || '').trim()
  };
}

function serialiseCompanyContextSections(sections = {}) {
  return [
    sections.companySummary ? `Company summary:\n${sections.companySummary}` : '',
    sections.businessModel ? `Business model:\n${sections.businessModel}` : '',
    sections.operatingModel ? `Operating model:\n${sections.operatingModel}` : '',
    sections.publicCommitments ? `Public commitments:\n- ${sections.publicCommitments.split(/\r?\n/).filter(Boolean).join('\n- ')}` : '',
    sections.keyRiskSignals ? `Key public risk signals:\n- ${sections.keyRiskSignals.split(/\r?\n/).filter(Boolean).join('\n- ')}` : '',
    sections.obligations ? `Likely obligations and exposures:\n- ${sections.obligations.split(/\r?\n/).filter(Boolean).join('\n- ')}` : '',
    sections.sources ? `Sources reviewed:\n- ${sections.sources.split(/\r?\n/).filter(Boolean).join('\n- ')}` : ''
  ].filter(Boolean).join('\n\n');
}

function formatCompanyContextProfile(result) {
  return serialiseCompanyContextSections(buildCompanyContextSections(result));
}

function getRelationshipOptions(structure = [], type = '', excludeId = '') {
  const nodes = structure.filter(node => node.id !== excludeId);
  if (isDepartmentEntityType(type)) {
    return nodes.filter(node => isCompanyEntityType(node.type));
  }
  return nodes.filter(node => isCompanyEntityType(node.type));
}

function buildOrgParentOptions(structure = [], type = '', excludeId = '') {
  const options = getRelationshipOptions(structure, type, excludeId)
    .map(node => ({ id: node.id, name: `${node.name} (${node.type})` }));
  if (!requiresParentEntity(type)) {
    options.unshift({ id: '', name: 'No parent / top level' });
  }
  return options;
}

function openOrgEntityEditor({ structure = [], existingNode = null, seed = {}, onSave }) {
  const node = existingNode || {};
  const isSeedDepartment = isDepartmentEntityType(node.type || seed.type || '');
  const defaultType = isSeedDepartment ? 'Department / function' : (node.type || seed.type || 'Holding company');
  const defaultDepartmentRelationshipType = node.departmentRelationshipType || seed.departmentRelationshipType || 'In-house';
  const defaultName = node.name || seed.name || '';
  const defaultWebsite = node.websiteUrl || seed.websiteUrl || '';
  const defaultProfile = node.profile || seed.profile || '';
  const defaultSections = node.contextSections || seed.contextSections || null;
  const defaultDepartmentHint = node.departmentHint || seed.departmentHint || '';
  const defaultOwner = node.ownerUsername || seed.ownerUsername || '';
  const managedAccounts = getManagedAccountsForAdmin(getAdminSettings());
  const body = `
    <div class="context-panel-copy" style="margin-bottom:12px">Capture how this entity fits into the wider group so later assessments inherit the right business, ownership, and department context.</div>
    <div class="grid-2" style="gap:12px">
      <div class="form-group">
        <label class="form-label" for="org-entity-type">Relationship Type</label>
        <select class="form-select" id="org-entity-type">
          ${isSeedDepartment
            ? DEPARTMENT_RELATIONSHIP_TYPES.map(type => `<option value="${type}" ${type === defaultDepartmentRelationshipType ? 'selected' : ''}>${type}</option>`).join('')
            : ORG_ENTITY_TYPES.filter(type => !isDepartmentEntityType(type)).map(type => `<option value="${type}" ${type === defaultType ? 'selected' : ''}>${type}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="org-entity-name">Entity or Department Name</label>
        <input class="form-input" id="org-entity-name" value="${defaultName}" placeholder="e.g. Group Holding, Abu Dhabi Operations, Information Security">
      </div>
      <div class="form-group" id="org-parent-wrap">
        <label class="form-label" for="org-parent-id">Parent Business</label>
        <select class="form-select" id="org-parent-id"></select>
        <span class="form-help" id="org-parent-help"></span>
      </div>
      <div class="form-group" id="org-website-wrap">
        <label class="form-label" for="org-website-url">Website</label>
        <input class="form-input" id="org-website-url" value="${defaultWebsite}" placeholder="https://example.com">
      </div>
      <div class="form-group" id="org-department-wrap" style="display:none">
        <label class="form-label" for="org-department-template">Typical Department</label>
        <select class="form-select" id="org-department-template">
          <option value="">Choose a typical department or keep a custom name</option>
          ${getTypicalDepartments().map(name => `<option value="${name}" ${name === defaultDepartmentHint ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
        <span class="form-help">This helps standardise department naming, but you can still use your own wording.</span>
      </div>
      <div class="form-group" id="org-owner-wrap">
        <label class="form-label" for="org-owner-username" id="org-owner-label">Business Unit Admin</label>
        <select class="form-select" id="org-owner-username">
          <option value="">Choose a user account</option>
          ${managedAccounts.map(account => `<option value="${account.username}" ${account.username === defaultOwner ? 'selected' : ''}>${account.displayName} (${account.username})</option>`).join('')}
        </select>
        <span class="form-help" id="org-owner-help">The assigned user can manage the departments and retained context for this business unit from their Settings page.</span>
      </div>
    </div>
    <div class="form-group mt-4">
      <label class="form-label" for="org-profile">Context Summary</label>
      <textarea class="form-textarea" id="org-profile" rows="7" placeholder="Business profile, strategic role, technology dependence, ownership context, or department remit.">${defaultProfile}</textarea>
      <span class="form-help" id="org-profile-help">For company entities, this can be built from the public website and then refined by the admin user.</span>
    </div>
    <div class="card mt-4" style="padding:var(--sp-4);background:var(--bg-elevated)" id="org-context-sections-wrap">
      <div class="context-panel-title">Editable Company Brief Sections</div>
      <p class="form-help">These named sections can be edited any time and will be retained for this entity.</p>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-summary">Company Summary</label>
        <textarea class="form-textarea" id="org-section-summary" rows="3">${defaultSections?.companySummary || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-business-model">Business Model</label>
        <textarea class="form-textarea" id="org-section-business-model" rows="3">${defaultSections?.businessModel || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-operating-model">Operating Model</label>
        <textarea class="form-textarea" id="org-section-operating-model" rows="3">${defaultSections?.operatingModel || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-commitments">Public Commitments</label>
        <textarea class="form-textarea" id="org-section-commitments" rows="4" placeholder="One commitment per line">${defaultSections?.publicCommitments || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-risks">Key Risk Signals</label>
        <textarea class="form-textarea" id="org-section-risks" rows="4" placeholder="One risk signal per line">${defaultSections?.keyRiskSignals || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-obligations">Obligations and Exposures</label>
        <textarea class="form-textarea" id="org-section-obligations" rows="4" placeholder="One obligation or exposure per line">${defaultSections?.obligations || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="org-section-sources">Sources Reviewed</label>
        <textarea class="form-textarea" id="org-section-sources" rows="4" placeholder="One source note per line">${defaultSections?.sources || ''}</textarea>
      </div>
    </div>
    <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap" id="org-context-actions">
      <button class="btn btn--secondary" id="btn-org-build-context" type="button">Build Context from Website</button>
      <span class="form-help" id="org-context-actions-help">Use AI to gather website and public-source context before saving.</span>
    </div>
    ${UI.aiRefinementCard({
      intro: 'Use follow-up prompts to keep shaping the context until it is ready to save.',
      historyId: 'org-context-refinement-history',
      fileId: 'org-context-source-file',
      fileLabel: 'Upload supporting documents',
      fileAccept: '.txt,.csv,.json,.md,.tsv,.xlsx,.xls,.doc,.docx,.pdf',
      fileHelpId: 'org-context-source-help',
      fileHelp: 'Recommended: upload strategy, policy, procedure, or operating-model documents to ground the AI context.',
      promptId: 'org-context-followup',
      promptPlaceholder: 'Tell the AI what to change, emphasise, shorten, or make more specific.',
      buttonId: 'btn-org-refine-context',
      buttonLabel: 'Apply Follow-Up Now',
      statusId: 'org-context-refine-status',
      statusText: 'The context fields above will update in place each time you refine them.',
      className: 'card mt-4',
      style: 'padding:var(--sp-4);background:var(--bg-elevated)',
      title: 'Refine This Context With AI'
    })}`;
  const modal = UI.modal({
    title: isSeedDepartment
      ? (existingNode ? 'Edit Function / Department' : 'Add Function / Department')
      : (existingNode ? 'Edit Organisation Entity' : 'Add Organisation Entity'),
    body,
    footer: `<button class="btn btn--ghost" id="org-cancel">Cancel</button><button class="btn btn--primary" id="org-save">${isSeedDepartment ? 'Save Function' : 'Save Entity'}</button>`
  });

  const departmentEditorMode = isSeedDepartment;
  const typeEl = document.getElementById('org-entity-type');
  const nameEl = document.getElementById('org-entity-name');
  const parentEl = document.getElementById('org-parent-id');
  const parentHelpEl = document.getElementById('org-parent-help');
  const websiteWrapEl = document.getElementById('org-website-wrap');
  const websiteEl = document.getElementById('org-website-url');
  const profileEl = document.getElementById('org-profile');
  const profileHelpEl = document.getElementById('org-profile-help');
  const departmentWrapEl = document.getElementById('org-department-wrap');
  const departmentTemplateEl = document.getElementById('org-department-template');
  const ownerWrapEl = document.getElementById('org-owner-wrap');
  const ownerEl = document.getElementById('org-owner-username');
  const ownerLabelEl = document.getElementById('org-owner-label');
  const ownerHelpEl = document.getElementById('org-owner-help');
  const contextActionsEl = document.getElementById('org-context-actions');
  const contextActionsHelpEl = document.getElementById('org-context-actions-help');
  const contextSectionsWrapEl = document.getElementById('org-context-sections-wrap');
  const contextRefinementWrapEl = document.getElementById('org-context-refinement-wrap');
  const contextRefinementHelpEl = document.getElementById('org-context-refinement-help');
  const contextRefinementHistoryEl = document.getElementById('org-context-refinement-history');
  const contextFollowupEl = document.getElementById('org-context-followup');
  const contextRefineStatusEl = document.getElementById('org-context-refine-status');
  const contextRefinementHistory = [];

  function getSelectedNodeType() {
    return departmentEditorMode ? 'Department / function' : typeEl.value;
  }

  function getCurrentOrgCompanySections() {
    return {
      companySummary: document.getElementById('org-section-summary')?.value.trim() || '',
      businessModel: document.getElementById('org-section-business-model')?.value.trim() || '',
      operatingModel: document.getElementById('org-section-operating-model')?.value.trim() || '',
      publicCommitments: document.getElementById('org-section-commitments')?.value.trim() || '',
      keyRiskSignals: document.getElementById('org-section-risks')?.value.trim() || '',
      obligations: document.getElementById('org-section-obligations')?.value.trim() || '',
      sources: document.getElementById('org-section-sources')?.value.trim() || ''
    };
  }

  function applyOrgCompanyContextResult(result = {}) {
    const sections = buildCompanyContextSections(result);
    const profileText = serialiseCompanyContextSections(sections);
    profileEl.value = profileText;
    document.getElementById('org-section-summary').value = sections.companySummary || '';
    document.getElementById('org-section-business-model').value = sections.businessModel || '';
    document.getElementById('org-section-operating-model').value = sections.operatingModel || '';
    document.getElementById('org-section-commitments').value = sections.publicCommitments || '';
    document.getElementById('org-section-risks').value = sections.keyRiskSignals || '';
    document.getElementById('org-section-obligations').value = sections.obligations || '';
    document.getElementById('org-section-sources').value = sections.sources || '';
    return { sections, profileText };
  }

  function renderOrgContextRefinementHistory() {
    if (!contextRefinementHistoryEl) return;
    if (!contextRefinementHistory.length) {
      contextRefinementHistoryEl.innerHTML = '<div class="form-help">No follow-up prompts yet. Build the first draft, then iterate here until the context feels right.</div>';
      return;
    }
    contextRefinementHistoryEl.innerHTML = contextRefinementHistory.map(entry => `
      <div class="card" style="padding:var(--sp-3);background:var(--bg-canvas)">
        <div class="context-panel-title" style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${entry.role === 'user' ? 'Your prompt' : 'AI update'}</div>
        <div style="margin-top:6px;color:var(--text-primary);line-height:1.55">${escapeHtml(entry.text || '')}</div>
      </div>`).join('');
  }

  function refreshEntityEditorState() {
    const selectedNodeType = getSelectedNodeType();
    const parentOptions = buildOrgParentOptions(structure, selectedNodeType, node.id);
    const currentParentId = node.parentId || seed.parentId || '';
    parentEl.innerHTML = parentOptions.map(option => `<option value="${option.id}" ${option.id === currentParentId ? 'selected' : ''}>${option.name}</option>`).join('');
    parentEl.disabled = !parentOptions.length;
    parentHelpEl.textContent = departmentEditorMode
      ? 'Departments and functions must be attached to a business entity.'
      : requiresParentEntity(selectedNodeType)
        ? 'This relationship should sit under an existing business or holding entity.'
        : 'Use a parent when this entity sits within a wider group. Leave top level for the main holding business.';
    departmentWrapEl.style.display = departmentEditorMode ? '' : 'none';
    ownerWrapEl.style.display = isCompanyEntityType(selectedNodeType) || departmentEditorMode ? '' : 'none';
    websiteWrapEl.style.display = departmentEditorMode ? 'none' : '';
    contextActionsEl.style.display = '';
    contextSectionsWrapEl.style.display = departmentEditorMode ? 'none' : '';
    if (contextRefinementWrapEl) contextRefinementWrapEl.style.display = '';
    const buildContextBtn = document.getElementById('btn-org-build-context');
    if (buildContextBtn) buildContextBtn.textContent = departmentEditorMode ? 'AI Assist Context' : 'Build Context from Website';
    if (contextActionsHelpEl) {
      contextActionsHelpEl.textContent = departmentEditorMode
        ? 'Use AI to derive a starter function context from the parent business unit and its retained context.'
        : 'Use AI to gather website and public-source context before saving.';
    }
    if (contextRefinementHelpEl) {
      contextRefinementHelpEl.textContent = departmentEditorMode
        ? 'Use follow-up prompts to keep shaping the function summary until it reflects the remit and dependencies correctly.'
        : 'Use follow-up prompts to keep shaping the company context until it is ready to save.';
    }
    ownerLabelEl.textContent = departmentEditorMode ? 'Department Owner' : 'Business Unit Admin';
    ownerHelpEl.textContent = departmentEditorMode
      ? 'The assigned owner can maintain department context from their Settings page.'
      : 'The assigned user can manage the departments and retained context for this business unit from their Settings page.';
    profileHelpEl.textContent = departmentEditorMode
      ? 'Describe what this department owns, supports, or controls within the business.'
      : 'Capture public business profile, ownership context, strategic role, and major risk signals for this entity.';
  }

  if (!departmentEditorMode) typeEl.addEventListener('change', refreshEntityEditorState);
  departmentTemplateEl.addEventListener('change', () => {
    if (departmentTemplateEl.value && (!nameEl.value.trim() || TYPICAL_DEPARTMENTS.includes(nameEl.value.trim()))) {
      nameEl.value = departmentTemplateEl.value;
    }
  });
  document.getElementById('org-cancel').addEventListener('click', () => modal.close());
  async function buildDepartmentContextFromParent(uploaded = { text: '', name: '' }) {
    const parentId = parentEl.value || node.parentId || seed.parentId || '';
    if (!parentId) {
      UI.toast('Choose the parent business before using AI assist for a function.', 'warning');
      return;
    }
    const settings = getAdminSettings();
    const parentEntity = getEntityById(structure, parentId);
    const parentLayer = parentEntity?.id ? getEntityLayerById(settings, parentEntity.id) : null;
    const llmConfig = getSessionLLMConfig();
    LLMService.setCompassConfig({
      apiUrl: llmConfig.apiUrl || DEFAULT_COMPASS_PROXY_URL,
      model: llmConfig.model || 'gpt-5.1',
      apiKey: llmConfig.apiKey || ''
    });
    const result = await LLMService.buildEntityContext({
      entity: {
        id: node.id || '',
        name: nameEl.value.trim() || defaultDepartmentHint || 'New function',
        type: 'Department / function',
        profile: profileEl.value.trim(),
        departmentHint: departmentTemplateEl.value || defaultDepartmentHint || '',
        departmentRelationshipType: typeEl.value || defaultDepartmentRelationshipType,
        ownerUsername: ownerEl.value || ''
      },
      parentEntity: parentEntity ? {
        id: parentEntity.id,
        name: parentEntity.name,
        type: parentEntity.type,
        profile: parentEntity.profile || '',
        websiteUrl: parentEntity.websiteUrl || ''
      } : null,
      existingLayer: null,
      parentLayer: parentLayer || null,
      adminSettings: {
        geography: settings.geography || '',
        applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [],
        aiInstructions: settings.aiInstructions || '',
        benchmarkStrategy: settings.benchmarkStrategy || '',
        riskAppetiteStatement: settings.riskAppetiteStatement || ''
      },
      uploadedText: uploaded.text,
      uploadedDocumentName: uploaded.name
    });
    if (result.contextSummary) profileEl.value = result.contextSummary;
  }

  renderOrgContextRefinementHistory();

  if (departmentEditorMode) {
    document.getElementById('btn-org-build-context').addEventListener('click', async () => {
      const btn = document.getElementById('btn-org-build-context');
      btn.disabled = true;
      btn.textContent = 'Building context…';
      try {
        const uploaded = await loadContextSupportSource('org-context-source-file', 'org-context-source-help');
        await buildDepartmentContextFromParent(uploaded);
        contextRefinementHistory.length = 0;
        contextRefinementHistory.push({ role: 'assistant', text: uploaded.text ? 'Initial function context draft created and refined using the uploaded source material. Use follow-up prompts below if you want to reshape it further.' : 'Initial function context draft created. Use follow-up prompts below if you want to reshape it further.' });
        renderOrgContextRefinementHistory();
        if (contextRefineStatusEl) contextRefineStatusEl.textContent = 'Initial AI draft applied. Use the follow-up prompt box below to keep refining it.';
        UI.toast('Function context drafted from the parent business context.', 'success', 5000);
      } catch (error) {
        UI.toast('Context build failed. Try again or shorten the source material.', 'danger', 6000);
      } finally {
        btn.disabled = false;
        btn.textContent = 'AI Assist Context';
      }
    });
  } else {
    document.getElementById('btn-org-build-context').addEventListener('click', async () => {
      const btn = document.getElementById('btn-org-build-context');
      const llmConfig = getAdminLLMConfig();
      const targetUrl = websiteEl.value.trim();
      if (!targetUrl) {
        UI.toast('Enter a company website URL first.', 'warning');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Building context…';
      try {
        LLMService.setCompassConfig(llmConfig);
        const uploaded = await loadContextSupportSource('org-context-source-file', 'org-context-source-help');
        let result = await LLMService.buildCompanyContext(targetUrl);
        applyOrgCompanyContextResult(result);
        if (uploaded.text) {
          result = await LLMService.refineCompanyContext({
            websiteUrl: targetUrl,
            currentSections: getCurrentOrgCompanySections(),
            currentAiGuidance: getAdminSettings().aiInstructions || '',
            currentGeography: getAdminSettings().geography || '',
            currentRegulations: Array.isArray(getAdminSettings().applicableRegulations) ? getAdminSettings().applicableRegulations : [],
            history: [],
            userPrompt: 'Incorporate the uploaded strategy, policy, procedure, and operating-model material into this company context draft while keeping it concise and grounded.',
            uploadedText: uploaded.text,
            uploadedDocumentName: uploaded.name
          });
          applyOrgCompanyContextResult(result);
        }
        if (!nameEl.value.trim()) {
          nameEl.value = inferCompanyNameFromUrl(targetUrl);
        }
        contextRefinementHistory.length = 0;
        contextRefinementHistory.push({ role: 'assistant', text: uploaded.text ? 'Initial company context draft created and refined using the uploaded source material. Use follow-up prompts below if you want to reshape it further.' : 'Initial company context draft created. Use follow-up prompts below if you want to reshape it further.' });
        renderOrgContextRefinementHistory();
        if (contextRefineStatusEl) contextRefineStatusEl.textContent = 'Initial AI draft applied. Use the follow-up prompt box below to keep refining it.';
        UI.toast('Company context built. Review the entity details and save it into the organisation tree.', 'success', 5000);
      } catch (error) {
        UI.toast('Company context build failed. Try again or shorten the source material.', 'danger', 6000);
        if (contextRefineStatusEl) contextRefineStatusEl.textContent = 'Company context build failed. Try again or shorten the source material.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Build Context from Website';
      }
    });
  }

  document.getElementById('btn-org-refine-context').addEventListener('click', async () => {
    const prompt = contextFollowupEl?.value.trim() || '';
    if (!prompt) {
      UI.toast('Enter a follow-up prompt first.', 'warning');
      return;
    }
    const btn = document.getElementById('btn-org-refine-context');
    btn.disabled = true;
    btn.textContent = 'Applying…';
    try {
      if (contextRefineStatusEl) contextRefineStatusEl.textContent = 'Applying your latest instruction to the context…';
      contextRefinementHistory.push({ role: 'user', text: prompt });
      renderOrgContextRefinementHistory();
      const llmConfig = getAdminLLMConfig();
      LLMService.setCompassConfig(llmConfig);
      const uploaded = await loadContextSupportSource('org-context-source-file', 'org-context-source-help');
      if (departmentEditorMode) {
        const settings = getAdminSettings();
        const parentId = parentEl.value || node.parentId || seed.parentId || '';
        const parentEntity = getEntityById(structure, parentId);
        const parentLayer = parentEntity?.id ? getEntityLayerById(settings, parentEntity.id) : null;
        const refineInput = {
          entity: {
            id: node.id || '',
            name: nameEl.value.trim() || defaultDepartmentHint || 'New function',
            type: 'Department / function',
            profile: profileEl.value.trim(),
            departmentHint: departmentTemplateEl.value || defaultDepartmentHint || '',
            departmentRelationshipType: typeEl.value || defaultDepartmentRelationshipType,
            ownerUsername: ownerEl.value || ''
          },
          parentEntity: parentEntity ? {
            id: parentEntity.id,
            name: parentEntity.name,
            type: parentEntity.type,
            profile: parentEntity.profile || '',
            websiteUrl: parentEntity.websiteUrl || ''
          } : null,
          currentContext: {
            geography: settings.geography || '',
            contextSummary: profileEl.value.trim(),
            applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [],
            aiInstructions: settings.aiInstructions || '',
            benchmarkStrategy: settings.benchmarkStrategy || '',
            riskAppetiteStatement: settings.riskAppetiteStatement || ''
          },
          parentLayer: parentLayer || null,
          adminSettings: {
            geography: settings.geography || '',
            applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [],
            aiInstructions: settings.aiInstructions || '',
            benchmarkStrategy: settings.benchmarkStrategy || '',
            riskAppetiteStatement: settings.riskAppetiteStatement || ''
          },
          history: contextRefinementHistory,
          userPrompt: prompt,
          uploadedText: uploaded.text,
          uploadedDocumentName: uploaded.name
        };
        let result;
        try {
          result = await LLMService.refineEntityContext(refineInput);
        } catch {
          result = buildLocalEntityContextFallback(refineInput);
        }
        if (result.contextSummary) profileEl.value = result.contextSummary;
        contextRefinementHistory.push({ role: 'assistant', text: result.responseMessage || 'I refined the function context based on your latest prompt.' });
      } else {
        const settings = getAdminSettings();
        const refineInput = {
          websiteUrl: websiteEl?.value.trim() || '',
          currentSections: getCurrentOrgCompanySections(),
          currentAiGuidance: settings.aiInstructions || '',
          currentGeography: settings.geography || '',
          currentRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [],
          history: contextRefinementHistory,
          userPrompt: prompt,
          uploadedText: uploaded.text,
          uploadedDocumentName: uploaded.name
        };
        let result;
        try {
          result = await LLMService.refineCompanyContext(refineInput);
        } catch {
          result = buildLocalCompanyContextFallback(refineInput);
        }
        applyOrgCompanyContextResult(result);
        contextRefinementHistory.push({ role: 'assistant', text: result.responseMessage || 'I refined the company context based on your latest prompt.' });
      }
      renderOrgContextRefinementHistory();
      if (contextFollowupEl) contextFollowupEl.value = '';
      if (contextRefineStatusEl) contextRefineStatusEl.textContent = 'Latest follow-up applied. Keep iterating until the context feels right.';
      UI.toast(departmentEditorMode ? 'Function context refined.' : 'Entity context refined.', 'success', 5000);
    } catch (error) {
      UI.toast('Context refinement failed. Try again or shorten the prompt.', 'danger', 6000);
      if (contextRefineStatusEl) contextRefineStatusEl.textContent = 'Context refinement failed. Try again or shorten the prompt.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Follow-Up Now';
    }
  });

  document.getElementById('org-save').addEventListener('click', () => {
    const selectedNodeType = getSelectedNodeType();
    const parentId = parentEl.value;
    if (requiresParentEntity(selectedNodeType) && !parentId) {
      UI.toast(departmentEditorMode ? 'Choose the business this department sits under.' : 'Choose the parent business for this entity.', 'warning');
      return;
    }
    const name = nameEl.value.trim();
    if (!name) {
      UI.toast(departmentEditorMode ? 'Enter the department or function name.' : 'Enter the entity name.', 'warning');
      return;
    }
    onSave?.({
      ...node,
      id: node.id || `org_${Date.now()}`,
      type: selectedNodeType,
      name,
      parentId: parentId || null,
      websiteUrl: departmentEditorMode ? '' : websiteEl.value.trim(),
      profile: profileEl.value.trim(),
      ownerUsername: ownerEl.value,
      departmentRelationshipType: departmentEditorMode ? typeEl.value : '',
      contextSections: departmentEditorMode ? null : {
        companySummary: document.getElementById('org-section-summary').value.trim(),
        businessModel: document.getElementById('org-section-business-model').value.trim(),
        operatingModel: document.getElementById('org-section-operating-model').value.trim(),
        publicCommitments: document.getElementById('org-section-commitments').value.trim(),
        keyRiskSignals: document.getElementById('org-section-risks').value.trim(),
        obligations: document.getElementById('org-section-obligations').value.trim(),
        sources: document.getElementById('org-section-sources').value.trim()
      },
      departmentHint: departmentEditorMode ? (departmentTemplateEl.value || name) : ''
    }, modal);
  });
  refreshEntityEditorState();
  return {
    close: modal.close,
    setProfile(value) { profileEl.value = value || ''; },
    setSections(sections = {}) {
      document.getElementById('org-section-summary').value = sections.companySummary || '';
      document.getElementById('org-section-business-model').value = sections.businessModel || '';
      document.getElementById('org-section-operating-model').value = sections.operatingModel || '';
      document.getElementById('org-section-commitments').value = sections.publicCommitments || '';
      document.getElementById('org-section-risks').value = sections.keyRiskSignals || '';
      document.getElementById('org-section-obligations').value = sections.obligations || '';
      document.getElementById('org-section-sources').value = sections.sources || '';
    },
    setWebsite(value) { websiteEl.value = value || ''; },
    setName(value) { nameEl.value = value || ''; },
    setType(value) {
      if (departmentEditorMode) {
        if (DEPARTMENT_RELATIONSHIP_TYPES.includes(value)) {
          typeEl.value = value;
          refreshEntityEditorState();
        }
        return;
      }
      if (ORG_ENTITY_TYPES.includes(value) && !isDepartmentEntityType(value)) {
        typeEl.value = value;
        refreshEntityEditorState();
      }
    }
  };
}

function buildEntityContextRequest(entity, settings = getAdminSettings(), existingLayer = null) {
  const structure = Array.isArray(settings.companyStructure) ? settings.companyStructure : [];
  const parentEntity = entity?.parentId ? getEntityById(structure, entity.parentId) : null;
  const parentLayer = parentEntity?.id ? getEntityLayerById(settings, parentEntity.id) : null;
  return {
    entity: {
      id: entity?.id || '',
      name: entity?.name || '',
      type: entity?.type || '',
      profile: entity?.profile || '',
      departmentHint: entity?.departmentHint || '',
      departmentRelationshipType: entity?.departmentRelationshipType || '',
      ownerUsername: entity?.ownerUsername || ''
    },
    parentEntity: parentEntity ? {
      id: parentEntity.id,
      name: parentEntity.name,
      type: parentEntity.type,
      profile: parentEntity.profile || '',
      websiteUrl: parentEntity.websiteUrl || ''
    } : null,
    existingLayer: existingLayer || {},
    parentLayer: parentLayer || null,
    adminSettings: {
      geography: settings.geography || '',
      applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [],
      aiInstructions: settings.aiInstructions || '',
      benchmarkStrategy: settings.benchmarkStrategy || '',
      riskAppetiteStatement: settings.riskAppetiteStatement || ''
    }
  };
}

function openEntityContextLayerEditor({ entity, settings = getAdminSettings(), onSave, readOnlyIdentity = false }) {
  if (!entity?.id) return null;
  const existingLayer = getEntityLayerById(settings, entity.id) || {};
  const contextRequest = buildEntityContextRequest(entity, settings, existingLayer);
  const parentName = contextRequest.parentEntity?.name || '';
  const isDepartment = isDepartmentEntityType(entity.type);
  const refinementHistory = [];
  const modal = UI.modal({
    title: `Manage Context: ${entity.name}`,
    body: `
      <div class="context-panel-copy" style="margin-bottom:12px">This context sits under <strong>${entity.name}</strong> and helps the platform retain what is unique about this ${isDepartment ? 'department' : 'business unit'}.</div>
      ${parentName ? `<div class="form-help" style="margin-bottom:12px">AI assist will inherit context from <strong>${parentName}</strong> and specialise it for this ${isDepartment ? 'function' : 'entity'}.</div>` : ''}
      <div class="grid-2" style="gap:12px">
        <div class="form-group">
          <label class="form-label" for="entity-layer-name">Entity</label>
          <input class="form-input" id="entity-layer-name" value="${entity.name}" ${readOnlyIdentity ? 'readonly' : ''}>
        </div>
        <div class="form-group">
          <label class="form-label" for="entity-layer-geo">Geography</label>
          <input class="form-input" id="entity-layer-geo" value="${existingLayer.geography || ''}" placeholder="e.g. UAE, GCC, Global">
        </div>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="entity-layer-summary">Context Summary</label>
        <textarea class="form-textarea" id="entity-layer-summary" rows="4" placeholder="Describe the remit, critical processes, dependencies, and regulatory exposure.">${existingLayer.contextSummary || entity.profile || ''}</textarea>
        <label class="form-checkbox" style="margin-top:10px">
          <input type="checkbox" id="entity-layer-visible-users" ${existingLayer.visibleToChildUsers !== false ? 'checked' : ''}>
          <span>Show this retained context summary to lower-layer users</span>
        </label>
        <span class="form-help">When off, the context still applies to inherited assessment behavior and AI grounding, but users below this layer only see that governed context is active.</span>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="entity-layer-appetite">Risk Appetite</label>
        <textarea class="form-textarea" id="entity-layer-appetite" rows="3">${existingLayer.riskAppetiteStatement || ''}</textarea>
      </div>
      <div class="form-group mt-4">
        <label class="form-label">Applicable Regulations</label>
        <div class="tag-input-wrap" id="ti-entity-layer-regulations"></div>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="entity-layer-ai">AI Guidance</label>
        <textarea class="form-textarea" id="entity-layer-ai" rows="3">${existingLayer.aiInstructions || ''}</textarea>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="entity-layer-benchmark">Benchmark Strategy</label>
        <textarea class="form-textarea" id="entity-layer-benchmark" rows="3">${existingLayer.benchmarkStrategy || ''}</textarea>
      </div>
      <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-entity-layer-ai" type="button">Build with AI</button>
        <span class="form-help">Derive context from the entity, the parent BU, and the current admin baseline.</span>
      </div>
      ${UI.aiRefinementCard({
        title: 'Refine With Follow-Up Prompts',
        intro: 'Ask follow-up questions or give directions like “make this more specific to data residency”, “tighten the summary for a COO”, or “focus more on vendor dependencies”.',
        historyId: 'entity-layer-refinement-history',
        fileId: 'entity-layer-source-file',
        fileLabel: 'Upload supporting documents',
        fileAccept: '.txt,.csv,.json,.md,.tsv,.xlsx,.xls,.doc,.docx,.pdf',
        fileHelpId: 'entity-layer-source-help',
        fileHelp: 'Recommended: upload strategy, policy, procedure, or operating-model documents to ground the AI context.',
        promptId: 'entity-layer-followup',
        promptPlaceholder: 'Tell the AI how you want to improve or reshape this context.',
        buttonId: 'btn-entity-layer-refine',
        buttonLabel: 'Apply Follow-Up Now',
        statusId: 'entity-layer-refine-status',
        statusText: 'The current context fields above will be updated in place each time you refine.',
        className: 'card mt-4',
        style: 'padding:var(--sp-4);background:var(--bg-elevated)'
      })}`,
    footer: `<button class="btn btn--ghost" id="entity-layer-cancel">Cancel</button><button class="btn btn--primary" id="entity-layer-save">Save Context</button>`
  });

  const regsInput = UI.tagInput('ti-entity-layer-regulations', existingLayer.applicableRegulations || []);
  const summaryEl = document.getElementById('entity-layer-summary');
  const geoEl = document.getElementById('entity-layer-geo');
  const appetiteEl = document.getElementById('entity-layer-appetite');
  const aiEl = document.getElementById('entity-layer-ai');
  const benchmarkEl = document.getElementById('entity-layer-benchmark');
  const historyEl = document.getElementById('entity-layer-refinement-history');
  const followupEl = document.getElementById('entity-layer-followup');
  const refineStatusEl = document.getElementById('entity-layer-refine-status');

  function getCurrentContextDraft() {
    return {
      geography: geoEl.value.trim(),
      contextSummary: summaryEl.value.trim(),
      riskAppetiteStatement: appetiteEl.value.trim(),
      applicableRegulations: regsInput.getTags(),
      aiInstructions: aiEl.value.trim(),
      benchmarkStrategy: benchmarkEl.value.trim()
    };
  }

  function applyContextResult(result, { onlyEmptyGeography = false } = {}) {
    if (result.geography && (!onlyEmptyGeography || !geoEl.value.trim())) {
      geoEl.value = result.geography;
    }
    if (result.contextSummary) summaryEl.value = result.contextSummary;
    if (result.riskAppetiteStatement) appetiteEl.value = result.riskAppetiteStatement;
    if (Array.isArray(result.applicableRegulations) && result.applicableRegulations.length) {
      regsInput.setTags(Array.from(new Set(result.applicableRegulations)));
    }
    if (result.aiInstructions) aiEl.value = result.aiInstructions;
    if (result.benchmarkStrategy) benchmarkEl.value = result.benchmarkStrategy;
  }

  function renderRefinementHistory() {
    if (!historyEl) return;
    if (!refinementHistory.length) {
      historyEl.innerHTML = '<div class="form-help">No follow-up prompts yet. Build the first draft, then use this area to iterate until the context feels right.</div>';
      return;
    }
    historyEl.innerHTML = refinementHistory.map(entry => `
      <div class="card" style="padding:var(--sp-3);background:${entry.role === 'user' ? 'var(--bg-canvas)' : 'rgba(244,193,90,.08)'};border-color:${entry.role === 'user' ? 'var(--border-subtle)' : 'rgba(244,193,90,.18)'}">
        <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${entry.role === 'user' ? 'Your prompt' : 'AI update'}</div>
        <div class="context-panel-copy" style="margin-top:6px">${entry.text}</div>
      </div>`).join('');
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  renderRefinementHistory();
  document.getElementById('entity-layer-cancel').addEventListener('click', () => modal.close());
  document.getElementById('btn-entity-layer-ai').addEventListener('click', async () => {
    const btn = document.getElementById('btn-entity-layer-ai');
    const llmConfig = getSessionLLMConfig();
    btn.disabled = true;
    btn.textContent = 'Building context…';
    try {
      LLMService.setCompassConfig({
        apiUrl: llmConfig.apiUrl || DEFAULT_COMPASS_PROXY_URL,
        model: llmConfig.model || 'gpt-5.1',
        apiKey: llmConfig.apiKey || ''
      });
      const uploaded = await loadContextSupportSource('entity-layer-source-file', 'entity-layer-source-help');
      const result = await LLMService.buildEntityContext({
        ...contextRequest,
        uploadedText: uploaded.text,
        uploadedDocumentName: uploaded.name
      });
      applyContextResult(result, { onlyEmptyGeography: true });
      refinementHistory.push({ role: 'assistant', text: uploaded.text ? `Initial context draft created for ${entity.name} and grounded with the uploaded source material. Review it or use follow-up prompts below to shape it further.` : `Initial context draft created for ${entity.name}. Review it or use follow-up prompts below to shape it further.` });
      renderRefinementHistory();
      if (refineStatusEl) refineStatusEl.textContent = 'Initial AI draft applied. Use a follow-up prompt below if you want to reshape it further.';
      UI.toast(`Context built for ${entity.name}. Review and save it.`, 'success', 5000);
    } catch (error) {
      UI.toast('Context build failed. Try again or shorten the source material.', 'danger', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Build with AI';
    }
  });
  document.getElementById('btn-entity-layer-refine').addEventListener('click', async () => {
    const prompt = followupEl.value.trim();
    if (!prompt) {
      UI.toast('Enter a follow-up prompt first.', 'warning');
      return;
    }
    const btn = document.getElementById('btn-entity-layer-refine');
    const llmConfig = getSessionLLMConfig();
    btn.disabled = true;
    btn.textContent = 'Applying…';
    try {
      if (refineStatusEl) refineStatusEl.textContent = 'Applying your latest instruction to the context…';
      refinementHistory.push({ role: 'user', text: prompt });
      renderRefinementHistory();
      LLMService.setCompassConfig({
        apiUrl: llmConfig.apiUrl || DEFAULT_COMPASS_PROXY_URL,
        model: llmConfig.model || 'gpt-5.1',
        apiKey: llmConfig.apiKey || ''
      });
      const uploaded = await loadContextSupportSource('entity-layer-source-file', 'entity-layer-source-help');
      const refineInput = {
        ...contextRequest,
        currentContext: getCurrentContextDraft(),
        history: refinementHistory,
        userPrompt: prompt,
        uploadedText: uploaded.text,
        uploadedDocumentName: uploaded.name
      };
      let result;
      try {
        result = await LLMService.refineEntityContext(refineInput);
      } catch {
        result = buildLocalEntityContextFallback(refineInput);
      }
      applyContextResult(result);
      refinementHistory.push({ role: 'assistant', text: result.responseMessage || 'I refined the context based on your latest prompt.' });
      renderRefinementHistory();
      followupEl.value = '';
      if (refineStatusEl) refineStatusEl.textContent = 'Latest follow-up applied. Keep iterating until you are comfortable with the context.';
      UI.toast(`Context refined for ${entity.name}.`, 'success', 5000);
    } catch (error) {
      UI.toast('Context refinement failed. Try again or shorten the prompt.', 'danger', 6000);
      if (refineStatusEl) refineStatusEl.textContent = 'Context refinement failed. Try again or shorten the prompt.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Follow-Up Now';
    }
  });
  document.getElementById('entity-layer-save').addEventListener('click', () => {
    onSave?.({
      entityId: entity.id,
      entityName: entity.name,
      geography: geoEl.value.trim(),
      contextSummary: summaryEl.value.trim(),
      visibleToChildUsers: document.getElementById('entity-layer-visible-users')?.checked !== false,
      riskAppetiteStatement: appetiteEl.value.trim(),
      applicableRegulations: regsInput.getTags(),
      aiInstructions: aiEl.value.trim(),
      benchmarkStrategy: benchmarkEl.value.trim()
    }, modal);
  });
  return modal;
}


function getLocalRefinementDirectives(prompt = '') {
  const lower = String(prompt || '').toLowerCase();
  return {
    excludePrivacy: /(does not|doesn't|not|without|exclude|remove).{0,30}(data privacy|privacy|personal data|pii)/i.test(lower),
    excludeHealth: /(does not|doesn't|not|without|exclude|remove).{0,30}(health data|medical data|patient data|phi|health information)/i.test(lower),
    emphasise: ((lower.match(/(?:focus on|emphasise|emphasize|highlight)\s+([^.;]+)/i) || [])[1] || '').trim()
  };
}

function applyLocalRefinementToText(text = '', prompt = '') {
  const source = String(text || '').trim();
  if (!source) return '';
  const directives = getLocalRefinementDirectives(prompt);
  let sentences = source.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (directives.excludePrivacy) {
    sentences = sentences.filter((sentence) => !/(privacy|personal data|data protection|pii|gdpr|pdpl)/i.test(sentence));
  }
  if (directives.excludeHealth) {
    sentences = sentences.filter((sentence) => !/(health data|medical data|patient data|clinical|hospital|phi|health information)/i.test(sentence));
  }
  let result = sentences.join(' ').trim();
  if (!result) result = source;
  const clarifiers = [];
  if (directives.excludePrivacy) clarifiers.push('This context should not be framed as a primary data-privacy scenario.');
  if (directives.excludeHealth) clarifiers.push('This context should not be framed as handling health or patient data.');
  if (directives.emphasise) clarifiers.push(`Keep the emphasis on ${directives.emphasise}.`);
  if (clarifiers.length) {
    result = [result.replace(/\s+/g, ' ').trim(), ...clarifiers].filter(Boolean).join(' ').trim();
  }
  return result;
}

function buildLocalEntityContextFallback(refineInput = {}) {
  const current = refineInput.currentContext || {};
  const prompt = String(refineInput.userPrompt || '').trim();
  const updatedSummary = applyLocalRefinementToText(String(current.contextSummary || '').trim(), prompt);
  return {
    geography: String(current.geography || '').trim(),
    contextSummary: updatedSummary || String(current.contextSummary || '').trim(),
    riskAppetiteStatement: String(current.riskAppetiteStatement || '').trim(),
    applicableRegulations: Array.isArray(current.applicableRegulations) ? current.applicableRegulations : [],
    aiInstructions: String(current.aiInstructions || '').trim(),
    benchmarkStrategy: String(current.benchmarkStrategy || '').trim(),
    responseMessage: prompt
      ? 'I reworked the existing context locally using your latest instruction. Review the wording and tighten anything that still needs adjustment.'
      : 'I applied a local refinement to keep the context moving. Review the updated text and adjust anything else manually if needed.'
  };
}

function buildLocalCompanyContextFallback(refineInput = {}) {
  const current = refineInput.currentSections || {};
  const prompt = String(refineInput.userPrompt || '').trim();
  return {
    ...current,
    companySummary: applyLocalRefinementToText(String(current.companySummary || '').trim(), prompt),
    businessModel: applyLocalRefinementToText(String(current.businessModel || '').trim(), prompt),
    operatingModel: applyLocalRefinementToText(String(current.operatingModel || '').trim(), prompt),
    publicCommitments: applyLocalRefinementToText(String(current.publicCommitments || '').trim(), prompt),
    keyRiskSignals: applyLocalRefinementToText(String(current.keyRiskSignals || '').trim(), prompt),
    obligations: applyLocalRefinementToText(String(current.obligations || '').trim(), prompt),
    sources: String(current.sources || '').trim(),
    aiGuidance: String(refineInput.currentAiGuidance || '').trim(),
    suggestedGeography: String(refineInput.currentGeography || '').trim(),
    regulatorySignals: Array.isArray(refineInput.currentRegulations) ? refineInput.currentRegulations : [],
    responseMessage: prompt
      ? 'I reworked the existing company context locally using your latest instruction. Review the updated sections and tighten any remaining wording manually if needed.'
      : 'I applied a local refinement to keep the company context moving. Review the updated sections and tighten anything else manually if needed.'
  };
}

function getAdminLLMConfig() {
  const saved = getSessionLLMConfig();
  const apiUrlEl = document.getElementById('admin-compass-url');
  const modelEl = document.getElementById('admin-compass-model');
  const apiKeyEl = document.getElementById('admin-compass-key');
  return {
    apiUrl: apiUrlEl?.value.trim() || saved.apiUrl || DEFAULT_COMPASS_PROXY_URL,
    model: modelEl?.value.trim() || saved.model || 'gpt-5.1',
    apiKey: apiKeyEl?.value.trim() || saved.apiKey || ''
  };
}

function getSessionLLMConfig() {
  try {
    const storageKey = buildUserStorageKey(SESSION_LLM_STORAGE_PREFIX);
    const localConfig = JSON.parse(localStorage.getItem(storageKey) || 'null') || null;
    const sessionConfig = JSON.parse(sessionStorage.getItem(storageKey) || 'null') || null;
    const config = localConfig || sessionConfig || {};
    if (sessionConfig && !localConfig) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(config));
      } catch {}
    }
    if (typeof config.apiUrl === 'string' && config.apiUrl.includes('api.core42.ai/v1/chat/completions')) {
      config.apiUrl = DEFAULT_COMPASS_PROXY_URL;
      try {
        localStorage.setItem(storageKey, JSON.stringify(config));
        sessionStorage.setItem(storageKey, JSON.stringify(config));
      } catch {}
    }
    return config;
  } catch {
    return {};
  }
}

function saveSessionLLMConfig(config) {
  const storageKey = buildUserStorageKey(SESSION_LLM_STORAGE_PREFIX);
  try {
    localStorage.setItem(storageKey, JSON.stringify(config));
    sessionStorage.setItem(storageKey, JSON.stringify(config));
  } catch {}
}

function fmtCurrency(usdValue, currency = AppState.currency, fxRate = AppState.fxRate) {
  const displayValue = Math.round(currency === 'AED' ? Number(usdValue || 0) * fxRate : Number(usdValue || 0));
  return `${getCurrencyPrefix(currency)}${displayValue.toLocaleString(currency === 'AED' ? 'en-AE' : 'en-US')}`;
}

function parseFlexibleNumber(value) {
  const cleaned = String(value == null ? '' : value)
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return NaN;
  return Number(cleaned);
}

function formatGroupedNumber(value) {
  const raw = String(value == null ? '' : value).replace(/,/g, '').trim();
  if (!raw) return '';

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const parts = unsigned.split('.');
  const wholeRaw = (parts[0] || '').replace(/[^0-9]/g, '');
  const decimalRaw = parts.slice(1).join('').replace(/[^0-9]/g, '');
  const groupedWhole = wholeRaw ? wholeRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
  const hasTrailingDecimal = unsigned.endsWith('.') && !decimalRaw;
  const decimalPart = hasTrailingDecimal ? '.' : (decimalRaw ? `.${decimalRaw}` : '');
  return `${negative ? '-' : ''}${groupedWhole}${decimalPart}`;
}

function getCurrencyPrefix(currency = AppState.currency) {
  return currency === 'AED' ? 'AED ' : '$';
}

function convertUsdToDisplayCurrency(value, currency = AppState.currency) {
  const amount = Number(value || 0);
  return currency === 'AED' ? amount * AppState.fxRate : amount;
}

function convertDisplayCurrencyToUsd(value, currency = AppState.currency) {
  const amount = Number(value || 0);
  return currency === 'AED' ? amount / AppState.fxRate : amount;
}

function formatCurrencyInputValue(value, currency = AppState.currency) {
  const displayValue = convertUsdToDisplayCurrency(value, currency);
  return formatGroupedNumber(Math.round(displayValue));
}

function positionCaretFromNumericOffset(formatted, numericOffset) {
  if (numericOffset <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/[0-9.-]/.test(formatted[index])) {
      seen += 1;
      if (seen >= numericOffset) return index + 1;
    }
  }
  return formatted.length;
}

function attachFormattedMoneyInputs() {
  document.querySelectorAll('.money-input').forEach(input => {
    if (input.dataset.moneyBound === 'true') return;
    input.dataset.moneyBound = 'true';
    input.addEventListener('input', () => {
      const rawValue = input.value;
      const selectionStart = input.selectionStart ?? rawValue.length;
      const numericOffset = rawValue.slice(0, selectionStart).replace(/,/g, '').replace(/[^0-9.-]/g, '').length;
      input.value = formatGroupedNumber(rawValue);
      const nextCaret = positionCaretFromNumericOffset(input.value, numericOffset);
      input.setSelectionRange(nextCaret, nextCaret);
    });
    input.addEventListener('blur', () => {
      input.value = formatGroupedNumber(input.value);
    });
    input.value = formatGroupedNumber(input.value);
  });
}

function getRouteMeta() {
  if (typeof window === 'undefined') return { currentHash: '#/', previousHash: null, routeChanged: false, navigationKind: 'server' };
  return window.__RISK_ROUTE_META__ || {
    currentHash: String(window.location.hash || '#/').slice(1) || '/',
    previousHash: null,
    routeChanged: false,
    navigationKind: 'direct'
  };
}

function shouldRestoreScrollForRoute(routeHash) {
  const route = String(routeHash || '').toLowerCase();
  return route === '/settings' || route.startsWith('/admin/settings');
}

function getPageFocusTarget(root = document) {
  return root.querySelector('[data-page-focus], h1, h2, [role="main"]');
}

function applyPageNavigationEffects(root = document) {
  if (typeof window === 'undefined') return;
  const routeMeta = getRouteMeta();
  const currentHash = String(routeMeta.currentHash || '').trim() || '/';
  const routeChanged = routeMeta.routeChanged || AppState.lastRenderedRouteHash !== currentHash;
  AppState.lastRenderedRouteHash = currentHash;
  if (!routeChanged) return;

  if (!shouldRestoreScrollForRoute(currentHash)) {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }

  const focusTarget = getPageFocusTarget(root) || document.getElementById('main-content');
  if (!focusTarget) return;
  if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
  window.requestAnimationFrame(() => {
    try {
      focusTarget.focus({ preventScroll: true });
    } catch {
      focusTarget.focus();
    }
  });
}

function updateWizardProgressBar(step) {
  const bar = document.getElementById('app-bar');
  if (!bar) return;
  const currentStep = String(step || '');
  const normalisedStep = currentStep.startsWith('/results/')
    ? '/results'
    : currentStep;
  const progressMap = {
    '/wizard/1': '25%',
    '/wizard/2': '50%',
    '/wizard/3': '75%',
    '/wizard/review': '90%',
    '/wizard/4': '90%',
    '/results': '100%'
  };
  const progress = progressMap[normalisedStep] || '0%';
  bar.style.setProperty('--wizard-progress', progress);
}

function setPage(html) {
  const root = document.getElementById('main-content');
  root.innerHTML = html;
  // Route changes were visually abrupt; a lightweight entry class makes screen changes feel deliberate without changing layout or timing.
  const pageShell = root.querySelector('.page, .dashboard-shell, .wizard-layout, .admin-shell');
  if (pageShell) {
    pageShell.classList.add('page-enter');
    window.requestAnimationFrame(() => {
      pageShell.classList.add('page-enter-active');
      window.setTimeout(() => {
        pageShell.classList.remove('page-enter', 'page-enter-active');
      }, 280);
    });
  }
  bindDisclosureState(root);
  applyPageNavigationEffects(root);
  updateWizardProgressBar(window.location.hash.replace('#', ''));
}

async function loadJSON(path) {
  const separator = String(path).includes('?') ? '&' : '?';
  const res = await fetch(`${path}${separator}v=${APP_ASSET_VERSION}`);
  return res.json();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function prettifyRiskText(value) {
  return String(value || '')
    .replace(/^\d+\.\s*/,'')
    .replace(/\btitle:\s*/i, '')
    .replace(/\bcategory:\s*/i, '')
    .replace(/\bdescription:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseRiskText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!text || text === '-') return true;
  return /^sheet:|^columns:|^rows:|^no non-empty rows found/.test(text);
}

function parseStructuredRiskLine(raw) {
  const text = String(raw || '').trim();
  if (!text || isNoiseRiskText(text)) return null;
  const pieces = text.split('|').map(part => part.trim()).filter(Boolean);
  if (!pieces.some(part => /title:|category:|description:/i.test(part))) return null;
  const fields = {};
  pieces.forEach(part => {
    const match = part.match(/^(?:\d+\.\s*)?([^:]+):\s*(.+)$/);
    if (!match) return;
    fields[match[1].trim().toLowerCase()] = match[2].trim();
  });
  return {
    title: prettifyRiskText(fields.title || ''),
    category: prettifyRiskText(fields.category || 'Register'),
    description: prettifyRiskText(fields.description || '')
  };
}

function normaliseRisk(risk, source = 'manual') {
  const parsedLine = typeof risk === 'string' ? parseStructuredRiskLine(risk) : parseStructuredRiskLine(risk?.title);
  const title = prettifyRiskText(parsedLine?.title || risk?.title || risk?.name || risk || '');
  if (!title || isNoiseRiskText(title)) return null;
  const description = prettifyRiskText(parsedLine?.description || risk?.description || '');
  const category = prettifyRiskText(parsedLine?.category || risk?.category || 'General');
  if (title === '-' || category === '-') return null;
  return {
    id: risk?.id || ('risk-' + slugify(title) + '-' + Math.random().toString(36).slice(2, 7)),
    title,
    category,
    description,
    source: risk?.source || source,
    regulations: Array.isArray(risk?.regulations) ? risk.regulations : [],
    linkedTo: Array.isArray(risk?.linkedTo) ? risk.linkedTo : []
  };
}

function mergeRisks(existing, incoming) {
  const map = new Map();
  [...existing, ...incoming]
    .map(r => normaliseRisk(r))
    .filter(Boolean)
    .forEach(r => {
      const key = r.title.toLowerCase();
      if (!map.has(key)) {
        map.set(key, r);
        return;
      }
      const prev = map.get(key);
      map.set(key, {
        ...prev,
        ...r,
        regulations: Array.from(new Set([...(prev.regulations || []), ...(r.regulations || [])])),
        linkedTo: Array.from(new Set([...(prev.linkedTo || []), ...(r.linkedTo || [])]))
      });
    });
  return Array.from(map.values());
}

function getRiskCandidates() {
  return mergeRisks(AppState.draft.riskCandidates || [], AppState.draft.selectedRisks || []);
}

function syncRiskSelection(defaultSelectAll = false) {
  const candidates = getRiskCandidates();
  const validIds = new Set(candidates.map(risk => risk.id));
  let selectedIds = Array.isArray(AppState.draft.selectedRiskIds)
    ? AppState.draft.selectedRiskIds.filter(id => validIds.has(id))
    : [];
  if (!selectedIds.length && defaultSelectAll && candidates.length) {
    selectedIds = candidates.map(risk => risk.id);
  }
  AppState.draft.riskCandidates = candidates;
  AppState.draft.selectedRiskIds = selectedIds;
  AppState.draft.selectedRisks = candidates.filter(risk => selectedIds.includes(risk.id));
  return AppState.draft.selectedRisks;
}

function getSelectedRisks() {
  return syncRiskSelection().filter(Boolean);
}

const GENERIC_RISK_TITLES = new Set([
  'material technology and cyber risk requiring structured assessment',
  'technology outage affecting core business services'
]);

function appendRiskCandidates(incoming, { selectNew = true } = {}) {
  const incomingRisks = mergeRisks([], incoming || []);
  const incomingTitles = new Set(incomingRisks.map(risk => risk.title.toLowerCase()));
  const hasSpecificIncoming = incomingRisks.some(risk => !GENERIC_RISK_TITLES.has(risk.title.toLowerCase()));
  const baseCandidates = hasSpecificIncoming
    ? getRiskCandidates().filter(risk => !GENERIC_RISK_TITLES.has(String(risk.title || '').toLowerCase()))
    : getRiskCandidates();
  const merged = mergeRisks(baseCandidates, incomingRisks);
  const existingIds = new Set(Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
  const selectedIds = merged
    .filter(risk => existingIds.has(risk.id) || (selectNew && incomingTitles.has(risk.title.toLowerCase())))
    .map(risk => risk.id);
  AppState.draft.riskCandidates = merged;
  AppState.draft.selectedRiskIds = selectedIds;
  AppState.draft.selectedRisks = merged.filter(risk => selectedIds.includes(risk.id));
}

function getLinkedRiskRecommendations(selectedRisks) {
  const groups = [
    {
      label: 'Technology control weakness -> service disruption',
      test: risk => /patch|monitor|control|documentation|issue tracking|assessment/i.test(`${risk.title} ${risk.description}`)
    },
    {
      label: 'Third-party governance -> operational disruption',
      test: risk => /vendor|supplier|third-party|supplier assurance|due diligence/i.test(`${risk.title} ${risk.description}`)
    },
    {
      label: 'Compliance lapse -> regulatory exposure',
      test: risk => /compliance|certification|policy|attestation/i.test(`${risk.title} ${risk.description}`)
    }
  ];
  return groups
    .map(group => ({
      label: group.label,
      risks: selectedRisks.filter(group.test).map(risk => risk.title)
    }))
    .filter(group => group.risks.length > 1);
}

function getScenarioMultipliers() {
  const riskCount = Math.max(1, getSelectedRisks().length);
  const linked = !!AppState.draft.linkedRisks && riskCount > 1;
  return {
    riskCount,
    linked,
    tefMultiplier: 1 + (riskCount - 1) * (linked ? 0.35 : 0.18),
    lossMultiplier: 1 + (riskCount - 1) * (linked ? 0.22 : 0.10),
    secondaryMultiplier: 1 + (riskCount - 1) * (linked ? 0.25 : 0.08)
  };
}

function deriveApplicableRegulations(bu, selectedRisks = [], geographies = getScenarioGeographies()) {
  const settings = getEffectiveSettings();
  const tags = [
    ...settings.applicableRegulations,
    ...(AppState.draft.applicableRegulations || []),
    ...(bu?.regulatoryTags || []),
    ...deriveGeographyRegulations(geographies),
    ...selectedRisks.flatMap(r => r.regulations || [])
  ].filter(Boolean);
  return Array.from(new Set(tags));
}

function normaliseCitations(citations) {
  const list = Array.isArray(citations) ? citations : [];
  const seen = new Set();
  const unique = list.filter((citation) => {
    const key = [citation?.docId || '', citation?.title || '', citation?.url || '', citation?.excerpt || '']
      .join('|')
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const sourcePriority = (citation) => {
    const type = String(citation?.sourceType || '').toLowerCase();
    if (type.includes('standard') || type.includes('regulatory')) return 0;
    if (type.includes('internal')) return 1;
    if (type.includes('reference')) return 2;
    return 3;
  };
  return unique.sort((a, b) => {
    const scoreDiff = Number(b?.score || 0) - Number(a?.score || 0);
    if (scoreDiff) return scoreDiff;
    const sourceDiff = sourcePriority(a) - sourcePriority(b);
    if (sourceDiff) return sourceDiff;
    return new Date(b?.lastUpdated || 0).getTime() - new Date(a?.lastUpdated || 0).getTime();
  });
}

function getScenarioAssistSeedNarrative(currentValue) {
  const current = String(currentValue || '').trim();
  const enhanced = String(AppState.draft.enhancedNarrative || '').trim();
  const base = String(AppState.draft.narrative || '').trim();
  if (current && enhanced && base && current === enhanced) return base;
  return current || enhanced || base;
}

function normaliseScenarioSeedText(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const filtered = sentences.filter((sentence) => {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    if (/^in .*faces a material .*scenario in which/i.test(sentence)) return false;
    if (/^this scenario should be assessed/i.test(sentence)) return false;
    if (/^a likely progression is/i.test(sentence)) return false;
    if (/^in practice, this can drive/i.test(sentence)) return false;
    if (/^given the stated urgency/i.test(sentence)) return false;
    if (/^current urgency is assessed as /i.test(sentence)) return false;
    return true;
  });
  return (filtered.join(' ').trim() || raw);
}

function getIntakeAssistSeedNarrative(currentValue) {
  const current = normaliseScenarioSeedText(currentValue);
  const source = normaliseScenarioSeedText(AppState.draft.sourceNarrative || '');
  const base = normaliseScenarioSeedText(AppState.draft.narrative || '');
  const enhanced = normaliseScenarioSeedText(AppState.draft.enhancedNarrative || '');
  if (current && enhanced && current === enhanced && (source || base)) return source || base;
  return source || current || base || enhanced;
}

function buildScenarioNarrative(introOverride = '') {
  const selected = getSelectedRisks();
  const titles = selected.map(r => r.title);
  const intro = String(introOverride || AppState.draft.enhancedNarrative || AppState.draft.narrative || '').trim();
  if (!titles.length) return intro;
  const linkage = AppState.draft.linkedRisks && titles.length > 1
    ? 'These risks should be treated as linked and capable of cascading into one another.'
    : 'These risks may be assessed together but should be treated as distinct drivers.';
  return `${intro}\n\nSelected risks:\n- ${titles.join('\n- ')}\n\n${linkage}`.trim();
}

function guessRisksFromText(text) {
  const source = String(text || '').toLowerCase();
  const patterns = [
    { title: 'Strategic execution or market-position risk', category: 'Strategic', regulations: ['ISO 31000', 'COSO ERM'], terms: ['strategy', 'strategic', 'expansion', 'transformation', 'growth', 'market', 'competitive', 'portfolio', 'investment'] },
    { title: 'Operational breakdown affecting core services', category: 'Operational', regulations: ['ISO 31000', 'ISO 22301'], terms: ['outage', 'availability', 'disruption', 'failure', 'breakdown', 'backlog', 'capacity', 'process failure'] },
    { title: 'Cyber compromise of critical platforms or data', category: 'Cyber', regulations: ['UAE PDPL', 'ISO 27001'], terms: ['ransom', 'malware', 'phish', 'identity', 'credential', 'sso', 'entra', 'azure ad', 'breach', 'exfil', 'cloud', 'misconfig', 'vulnerability', 'privileged'] },
    { title: 'Third-party dependency or supplier failure', category: 'Third-Party', regulations: ['ISO 27036', 'ISO 28000'], terms: ['vendor', 'supplier', 'third-party', 'third party', 'outsourc', 'dependency', 'subprocessor', 'partner'] },
    { title: 'Regulatory or licensing exposure', category: 'Regulatory', regulations: ['BIS Export Controls', 'OFAC Sanctions'], terms: ['regulator', 'regulatory', 'licence', 'license', 'supervisory', 'filing', 'notification', 'sanction', 'export control'] },
    { title: 'Financial loss, fraud, or capital exposure', category: 'Financial', regulations: ['UAE AML/CFT', 'PCI-DSS 4.0'], terms: ['fraud', 'payment', 'invoice', 'treasury', 'liquidity', 'cash', 'capital', 'financial reporting', 'misstatement'] },
    { title: 'ESG or sustainability disclosure risk', category: 'ESG', regulations: ['IFRS S1', 'IFRS S2'], terms: ['esg', 'sustainability', 'climate', 'emission', 'carbon', 'greenwashing', 'social impact', 'governance failure'] },
    { title: 'Compliance control or policy breakdown', category: 'Compliance', regulations: ['ISO 37301', 'UAE PDPL'], terms: ['policy breach', 'control failure', 'non-compliance', 'compliance', 'obligation', 'conduct', 'ethics'] },
    { title: 'Supply chain resilience disruption', category: 'Supply Chain', regulations: ['ISO 28000', 'ISO 22301'], terms: ['supply chain', 'logistics', 'inventory', 'fulfilment', 'shipment', 'single source', 'upstream'] },
    { title: 'Procurement governance or sourcing risk', category: 'Procurement', regulations: ['ISO 20400', 'ISO 37301'], terms: ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'vendor selection', 'purchasing'] },
    { title: 'Business continuity and recovery failure', category: 'Business Continuity', regulations: ['ISO 22301', 'NFPA 1600'], terms: ['continuity', 'recovery', 'dr', 'disaster recovery', 'rto', 'rpo', 'crisis management'] },
    { title: 'Health, safety, and environmental incident exposure', category: 'HSE', regulations: ['ISO 45001', 'ISO 14001'], terms: ['hse', 'health and safety', 'safety', 'injury', 'environmental', 'spill', 'incident', 'worker'] }
  ];
  // Keep the fallback lens enterprise-wide so strategic or operational text is not silently forced into cyber.
  const found = patterns
    .filter(({ terms }) => terms.some(term => source.includes(term)))
    .map(({ title, category, regulations }) => ({
      title,
      category,
      regulations,
      description: 'Extracted from the provided narrative or risk register.'
    }));
  return found.length ? found : [{ title: 'Material enterprise risk requiring further triage', category: 'General', regulations: ['ISO 31000'] }];
}

function parseRegisterText(text) {
  return String(text || '')
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(line => line && !/^risk[\s,_-]*id/i.test(line) && line.length > 10 && !isNoiseRiskText(line))
    .slice(0, 25);
}

function getFileExtension(name = '') {
  const parts = String(name).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function looksLikeBinaryRegister(text) {
  const sample = String(text || '').slice(0, 400);
  if (!sample) return false;
  if (sample.startsWith('PK') || /docProps\/|word\/|xl\//i.test(sample)) return true;
  const controlChars = (sample.match(/[\u0000-\u0008\u000E-\u001F]/g) || []).length;
  return controlChars > 8;
}

function truncateText(value, max = 180) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function sanitiseHeaderCell(value, index) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text || /^__empty/i.test(text)) return `column_${index + 1}`;
  return text;
}

function scoreHeaderRow(cells) {
  const joined = cells.join(' ').toLowerCase();
  let score = 0;
  if (/risk title|risk name|risk description|risk category|risk id/.test(joined)) score += 8;
  if (/entity|business area|operating role|owner|function/.test(joined)) score += 3;
  if (/if .* then|template|provide a short|drop down/.test(joined)) score -= 6;
  return score;
}

function normaliseWorksheetRows(matrix) {
  const rows = (matrix || [])
    .map(row => Array.isArray(row) ? row.map(cell => String(cell == null ? '' : cell).trim()) : [])
    .filter(row => row.some(cell => cell));
  if (!rows.length) return [];

  let headerIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  rows.slice(0, 12).forEach((row, idx) => {
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = idx;
    }
  });

  const headers = rows[headerIndex].map((cell, idx) => sanitiseHeaderCell(cell, idx));
  return rows.slice(headerIndex + 1).map(row => {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = row[idx] != null ? row[idx] : '';
    });
    return record;
  });
}

function isLikelyTemplateRow(row) {
  const values = Object.entries(row || {})
    .map(([key, value]) => [String(key || '').trim().toLowerCase(), String(value || '').trim()])
    .filter(([, value]) => value);
  if (!values.length) return true;
  const joined = values.map(([, value]) => value).join(' ').toLowerCase();
  if (/risk register template|provide a short|drop down selection|automatic unique identifier|use the following structure/.test(joined)) return true;
  if (values.every(([key]) => /^column_\d+$/.test(key))) return true;
  return false;
}

function extractRiskFields(row) {
  const entries = Object.entries(row || {})
    .map(([key, value]) => [String(key || '').trim(), String(value == null ? '' : value).trim()])
    .filter(([, value]) => value);
  if (!entries.length || isLikelyTemplateRow(row)) return null;

  const titleEntry = entries.find(([key]) => /risk title|title|name/i.test(key));
  const descriptionEntry = entries.find(([key]) => /risk description|description|statement|summary/i.test(key));
  const categoryEntry = entries.find(([key]) => /risk category|category|taxonomy/i.test(key));
  const contextEntries = entries.filter(([key]) => /entity|business area|operating role|owner|function|affiliate/i.test(key));

  const title = titleEntry?.[1];
  const description = descriptionEntry?.[1];
  if (!title && !description) return null;
  if (title && /risk register template|entity \/ affiliate|business area|risk title/i.test(title.toLowerCase())) return null;

  const context = contextEntries.map(([key, value]) => `${key}: ${truncateText(value, 60)}`).slice(0, 3).join(' | ');
  return {
    title: title || truncateText(description, 90),
    category: categoryEntry?.[1] || 'Register',
    description: [description, context].filter(Boolean).join(' | ')
  };
}

function rowsToStructuredRegisterText(sheetName, rows) {
  const cleanedRows = rows
    .map(row => extractRiskFields(row))
    .filter(Boolean)
    .slice(0, 120);
  const trimmedRows = cleanedRows.length ? cleanedRows : rows
    .filter(row => row && Object.values(row).some(v => String(v ?? '').trim()))
    .slice(0, 120);
  if (!trimmedRows.length) return `Sheet: ${sheetName}\nNo non-empty rows found.`;
  const headers = Array.from(new Set(trimmedRows.flatMap(row => Object.keys(row).filter(Boolean)))).slice(0, 12);
  const renderedRows = trimmedRows.map((row, idx) => {
    const cols = headers
      .map(key => `${key}: ${truncateText(row[key])}`)
      .filter(entry => !entry.endsWith(':'))
      .slice(0, 6);
    return `${idx + 1}. ${cols.join(' | ')}`;
  });
  return [
    `Sheet: ${sheetName}`,
    `Columns: ${headers.join(', ')}`,
    `Rows:`,
    ...renderedRows
  ].join('\n');
}

function parseDelimitedText(text, delimiter = ',') {
  const lines = String(text || '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(delimiter).map(h => h.trim()).filter(Boolean);
  return lines.slice(1).map(line => {
    const values = line.split(delimiter);
    const row = {};
    headers.forEach((header, idx) => { row[header] = values[idx] != null ? values[idx].trim() : ''; });
    return row;
  });
}

function extractTextFromBinaryDocument(buffer) {
  const ascii = new TextDecoder('latin1').decode(buffer);
  const textChunks = [];
  const xmlChunks = ascii.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  if (xmlChunks.length) {
    xmlChunks.forEach(chunk => {
      const match = chunk.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/);
      if (match?.[1]) textChunks.push(match[1]);
    });
  }
  const pdfChunks = ascii.match(/\(([^()\\]{3,})\)/g) || [];
  pdfChunks.slice(0, 400).forEach(chunk => {
    const cleaned = chunk.slice(1, -1).replace(/\[nrtbf()\]/g, ' ').trim();
    if (cleaned.length > 3) textChunks.push(cleaned);
  });
  const plainChunks = ascii.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:()\/\-]{20,}/g) || [];
  plainChunks.slice(0, 400).forEach(chunk => textChunks.push(chunk));
  return textChunks.join('\n').replace(/\s+/g, ' ').trim();
}

async function parseRegisterFile(file) {
  if (Number(file?.size || 0) > MAX_AI_UPLOAD_BYTES) {
    throw new Error('The uploaded file is too large for pilot AI assist. Keep files under 5 MB.');
  }
  const sanitizeAiUploadText = value => {
    if (typeof AIGuardrails?.sanitizeText === 'function') {
      return AIGuardrails.sanitizeText(value, { maxChars: MAX_AI_UPLOAD_CHARS });
    }
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_AI_UPLOAD_CHARS);
  };
  const ext = getFileExtension(file.name);
  if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      throw new Error('Spreadsheet parser not loaded. Refresh the page and try again.');
    }
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const allSheetSummaries = workbook.SheetNames.map(sheetName => {
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const rows = normaliseWorksheetRows(rawRows);
      return {
        sheetName,
        rowCount: rows.length,
        text: rowsToStructuredRegisterText(sheetName, rows)
      };
    });
    const selectedWorkbookSheets = typeof selectRegisterWorkbookSheets === 'function'
      ? selectRegisterWorkbookSheets(allSheetSummaries)
      : {
          selectedSheets: allSheetSummaries,
          ignoredSheets: [],
          selectionMode: 'all_sheets'
        };
    const sheetSummaries = selectedWorkbookSheets.selectedSheets.length
      ? selectedWorkbookSheets.selectedSheets
      : allSheetSummaries;
    return {
      text: sanitizeAiUploadText(sheetSummaries.map(s => s.text).join('\n\n')),
      meta: {
        type: 'spreadsheet',
        extension: ext,
        sheetCount: sheetSummaries.length,
        workbookSheetCount: workbook.SheetNames.length,
        sheetSelectionMode: selectedWorkbookSheets.selectionMode || 'all_sheets',
        sheets: sheetSummaries.map(s => ({ sheetName: s.sheetName, rowCount: s.rowCount })),
        ignoredSheets: (selectedWorkbookSheets.ignoredSheets || []).map(s => ({ sheetName: s.sheetName, rowCount: s.rowCount }))
      }
    };
  }

  if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const extracted = extractTextFromBinaryDocument(buffer);
    return {
      text: sanitizeAiUploadText(extracted || `${file.name} was uploaded, but only limited text could be extracted in the browser.`),
      meta: {
        type: 'document',
        extension: ext,
        sheetCount: 1,
        sheets: [{ sheetName: file.name, rowCount: extracted ? extracted.split(/\r?\n/).length : 0 }]
      }
    };
  }

  const text = await file.text();
  if (ext === 'csv' || ext === 'tsv') {
    const rows = parseDelimitedText(text, ext === 'tsv' ? '\t' : ',');
    return {
      text: sanitizeAiUploadText(rowsToStructuredRegisterText(file.name, rows)),
      meta: {
        type: 'delimited',
        extension: ext,
        sheetCount: 1,
        sheets: [{ sheetName: file.name, rowCount: rows.length }]
      }
    };
  }

  return {
    text: sanitizeAiUploadText(text),
    meta: {
      type: 'text',
      extension: ext || 'txt',
      sheetCount: 1,
      sheets: [{ sheetName: file.name, rowCount: parseRegisterText(text).length }]
    }
  };
}

async function loadContextSupportSource(fileInputId, helpId) {
  const file = document.getElementById(fileInputId)?.files?.[0] || null;
  const helpEl = helpId ? document.getElementById(helpId) : null;
  if (!file) {
    if (helpEl) helpEl.textContent = 'Recommended: upload strategy, policy, procedure, or operating-model documents to ground the AI context.';
    return { text: '', name: '' };
  }
  const parsed = await parseRegisterFile(file);
  const ext = getFileExtension(file.name);
  if (looksLikeBinaryRegister(parsed.text) && !['xlsx', 'xls', 'pdf', 'doc', 'docx'].includes(ext)) {
    throw new Error('The uploaded file appears unreadable. Use PDF, DOC, DOCX, Excel, TXT, CSV, TSV, JSON, or Markdown.');
  }
  if (helpEl) helpEl.textContent = `Loaded ${file.name}. The AI will use it to build and refine this context.`;
  return { text: parsed.text || '', name: file.name };
}

function composeGuidedNarrative(guidedInput = {}) {
  const event = String(guidedInput.event || '').trim();
  const asset = String(guidedInput.asset || '').trim();
  const cause = String(guidedInput.cause || '').trim();
  const impact = String(guidedInput.impact || '').trim();
  const urgency = String(guidedInput.urgency || 'medium').trim().toLowerCase();
  const urgencyPrefix = urgency ? `${urgency.charAt(0).toUpperCase() + urgency.slice(1)}-urgency` : 'Material';
  if (!event && !asset && !cause && !impact) return '';

  let primaryClause = event;
  if (cause && event) {
    primaryClause = `${cause.toLowerCase()} could lead to ${event.charAt(0).toLowerCase() + event.slice(1)}`;
  } else if (cause) {
    primaryClause = `${cause} could trigger a material risk event`;
  } else if (event) {
    primaryClause = `${event.charAt(0).toLowerCase() + event.slice(1)}`;
  }

  const parts = [];
  if (primaryClause) {
    parts.push(`${urgencyPrefix} scenario: ${primaryClause.charAt(0).toUpperCase() + primaryClause.slice(1)}.`);
  }
  if (asset) {
    parts.push(`${asset} is the primary asset or service in scope.`);
  }
  if (impact) {
    parts.push(`The scenario could result in ${impact.charAt(0).toLowerCase() + impact.slice(1)}.`);
  }
  if (asset && /identity|directory|sso|email|azure ad|active directory/i.test(`${event} ${asset} ${cause}`.toLowerCase())) {
    parts.push('Likely knock-on effects include mailbox compromise, privileged misuse, downstream service disruption, and data exposure if the event is not contained quickly.');
  }
  return parts.join(' ');
}

// ─── APP BAR ──────────────────────────────────────────────────
function renderAppBar() {
  const currentUser = AuthService.getCurrentUser();
  const currentHash = String(window.location.hash || '#/');
  const homeHref = currentUser?.role === 'admin' ? '#/admin/home' : currentUser ? '#/dashboard' : '#/';
  const settingsHref = currentUser?.role === 'admin' ? '#/admin/settings/org' : '#/settings';
  const nonAdminCapability = currentUser && currentUser.role !== 'admin'
    ? getNonAdminCapabilityState(currentUser, getUserSettings(), getAdminSettings())
    : null;
  const isOversightUser = !!(nonAdminCapability?.canManageBusinessUnit || nonAdminCapability?.canManageDepartment);
  const navLinks = currentUser?.role === 'admin'
    ? [
        // Keep the app bar at the section level so detailed admin destinations only live in the sidebar.
        { href: '#/admin/home', label: 'Platform Home', active: currentHash.startsWith('#/admin/home') },
        { href: '#/admin/settings/org', label: 'Admin Console', active: currentHash.startsWith('#/admin/') }
      ]
    : currentUser
      ? [
          { href: '#/dashboard', label: isOversightUser ? 'Workspace' : 'Dashboard', active: currentHash.startsWith('#/dashboard') },
          { href: '#/settings', label: isOversightUser ? (nonAdminCapability?.experience?.primaryActionLabel || 'Role Context') : 'Personal Settings', active: currentHash.startsWith('#/settings') }
        ]
      : [
          { href: '#/', label: 'Home', active: currentHash === '#/' || currentHash === '' }
        ];
  const bar = document.getElementById('app-bar');
  bar.innerHTML = `
    <div class="bar-inner">
      <a href="${homeHref}" class="bar-logo">
        <span class="bar-logo-mark" aria-hidden="true">
          <img src="assets/brand/g42-catalyst-symbol-logo-inverted-rgb.svg" alt="">
        </span>
        <span class="bar-logo-text">Risk <span>Intelligence</span> Platform</span>
      </a>
      <nav class="flex items-center gap-3">
        ${navLinks.map(link => `<a href="${link.href}" class="bar-nav-link${link.active ? ' active' : ''}">${link.label}</a>`).join('')}
      </nav>
      <div class="bar-spacer"></div>
      ${currentUser ? `
        <a href="#/help" class="btn btn--ghost btn--sm${currentHash.startsWith('#/help') ? ' active' : ''}" id="btn-open-help">Help</a>
        <span class="bar-nav-link" style="pointer-events:none">${currentUser.displayName}</span>
        <button type="button" class="btn btn--ghost btn--sm" id="btn-sign-out">Sign Out</button>
      ` : `<a href="#/login" class="bar-nav-link bar-nav-link--admin">Sign In</a>`}
      <div class="currency-toggle" role="group" aria-label="Currency">
        <button id="cur-usd" class="${AppState.currency==='USD'?'active':''}">USD</button>
        <button id="cur-aed" class="${AppState.currency==='AED'?'active':''}">AED</button>
      </div>
      <span class="bar-poc-tag">PoC</span>
    </div>`;
  const pocTag = document.querySelector('.bar-poc-tag');
  if (pocTag && (
    (typeof DemoMode !== 'undefined' && DemoMode.isDemoRunning())
    || window.__RISK_CALCULATOR_RELEASE__?.channel === 'production'
  )) {
    pocTag.classList.add('bar-poc-tag--hidden');
  }
  document.getElementById('cur-usd').addEventListener('click', () => { AppState.currency='USD'; renderAppBar(); Router.resolve(); });
  document.getElementById('cur-aed').addEventListener('click', () => { AppState.currency='AED'; renderAppBar(); Router.resolve(); });
  document.getElementById('btn-sign-out')?.addEventListener('click', () => {
    performLogout();
  });
  updateWizardProgressBar(window.location.hash.replace('#', ''));
}

// ─── LANDING ──────────────────────────────────────────────────
function renderLanding() {
  const assessments = getAssessments().slice(0, 5);
  const learningStore = getLearningStore();
  setPage(`
    <main class="page">
      <div class="container">

        <!-- Hero -->
        <section class="landing-hero">
          <div class="landing-badge">🔐 Internal Tool — Start Here</div>
          <h1>Risk Intelligence Platform</h1>
          <p class="landing-subtitle">Use this guide to turn a plain-English risk idea, issue, or register into a quantified FAIR analysis. You do not need to know FAIR in advance; the platform guides you step by step.</p>
          <div class="flex items-center gap-4" style="flex-wrap:wrap">
            <button class="btn btn--primary btn--lg" id="btn-start-new">Start Guided Assessment</button>
            <button class="btn btn--secondary" id="btn-show-templates">⚡ Start from a Template</button>
          </div>
          <div class="flex items-center gap-4 mt-4" style="flex-wrap:wrap">
            <span style="font-size:.78rem;color:var(--text-muted)">First time using the tool?</span>
            <button class="btn btn--ghost btn--sm" id="btn-how-it-works">Open quick guide →</button>
          </div>
        </section>

        <!-- How it works (collapsible) -->
        <div id="how-it-works-panel" class="hidden" style="margin-bottom:var(--sp-8)">
          <div class="card card--elevated anim-fade-in">
            <h3 style="font-size:var(--text-lg);margin-bottom:var(--sp-5)">How it works</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--sp-5)">
              ${[
                ['1','Describe the issue','Start with a simple risk statement such as “A supplier with privileged access is compromised” or upload a risk register for AI review.'],
                ['2','Let the platform structure it','The AI builder enhances the wording, identifies candidate risks, and suggests which risks may be linked.'],
                ['3','Check the assumptions','Review the FAIR inputs. If you are unsure, stay in Basic mode and use the AI-preloaded values as your starting point.'],
                ['4','Run and interpret results','The simulation shows likely loss ranges, annual exposure, and whether the scenario breaches the configured tolerance threshold.']
              ].map(([n,title,desc]) => `
                <div style="display:flex;gap:var(--sp-4)">
                  <div style="width:32px;height:32px;background:rgba(26,86,219,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;color:var(--color-primary-300);flex-shrink:0">${n}</div>
                  <div><div style="font-weight:600;font-size:.9rem;margin-bottom:4px">${title}</div><p style="font-size:.8rem;line-height:1.6">${desc}</p></div>
                </div>`).join('')}
            </div>
            <div class="banner banner--info mt-6" style="font-size:.82rem">
              <span class="banner-icon">ℹ</span>
              <span class="banner-text"><strong>Beginner tip:</strong> if you are unsure what to enter, choose a template first or write the scenario in plain English. The tool will help translate it into FAIR-style inputs. Results are saved in your browser only.</span>
            </div>
          </div>
        </div>

        <section style="margin-bottom:var(--sp-8)">
          <div class="card card--elevated anim-fade-in">
            <div class="flex items-center justify-between mb-4" style="flex-wrap:wrap;gap:var(--sp-3)">
              <h3 style="font-size:var(--text-xl)">Quick Start Guide</h3>
              <span class="badge badge--neutral">For guided use</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--sp-4)">
              ${[
                ['What to prepare','A short risk statement, affected business unit, and any known business or regulatory impact.'],
                ['When to use templates','Use a template when the scenario is similar to ransomware, BEC, insider threat, cloud exposure, or supply chain compromise.'],
                ['When to upload a register','Upload a register when you want AI to extract multiple risks and let you assess several together.'],
                ['How to read the result','Focus first on P90 per-event loss, annual exposure, and whether the scenario sits above or within tolerance.']
              ].map(([title, desc]) => `
                <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:var(--sp-4)">
                  <div style="font-weight:600;color:var(--text-primary);margin-bottom:6px">${title}</div>
                  <p style="font-size:.84rem;line-height:1.6">${desc}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <!-- Scenario Templates -->
        <div id="templates-panel" class="hidden" style="margin-bottom:var(--sp-8)">
          <div class="flex items-center justify-between mb-4">
            <h3 style="font-size:var(--text-xl)">Scenario Templates</h3>
            <button class="btn btn--ghost btn--sm" id="btn-hide-templates">✕ Close</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp-4)">
            ${ScenarioTemplates.map(t => `
              ${(() => {
                const profile = learningStore.templates?.[t.id];
                const learnedLabel = profile?.completed ? `<span class="badge badge--gold" style="font-size:.6rem">Learnt from ${profile.completed}</span>` : '';
                return `
              <button class="template-card" data-template-id="${t.id}" aria-label="Use template: ${t.label}">
                <div style="display:flex;align-items:flex-start;gap:var(--sp-3);margin-bottom:var(--sp-3)">
                  <span style="font-size:14px;line-height:1;font-weight:700;letter-spacing:.08em;min-width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(26,86,219,.16);border:1px solid rgba(26,86,219,.28);color:var(--color-primary-300)">${t.icon}</span>
                  <div style="flex:1;text-align:left">
                    <div style="font-family:var(--font-display);font-size:.95rem;font-weight:600;color:var(--text-primary);margin-bottom:4px">${t.label}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">${t.tags.map(tag=>`<span class="badge badge--neutral" style="font-size:.6rem">${tag}</span>`).join('')}${learnedLabel}</div>
                  </div>
                </div>
                <p style="font-size:.8rem;color:var(--text-secondary);line-height:1.6;text-align:left">${t.description}</p>
                <div style="margin-top:var(--sp-3);text-align:right;font-size:.8rem;color:var(--color-primary-400);font-weight:600">Use this template →</div>
              </button>`;
              })()}
            `).join('')}
          </div>
        </div>

        <!-- Feature grid -->
        <div class="landing-grid">
          <div class="feature-card anim-fade-in anim-delay-1">
            <div class="feature-icon">🤖</div>
            <div class="feature-title">AI Risk Builder</div>
            <p class="feature-desc">Paste a simple description of the risk. The platform helps convert it into a structured assessment.</p>
          </div>
          <div class="feature-card anim-fade-in anim-delay-2">
            <div class="feature-icon">📊</div>
            <div class="feature-title">Monte Carlo Simulation</div>
            <p class="feature-desc">The model runs thousands of simulations so you can see a range of possible outcomes instead of a single guessed number.</p>
          </div>
          <div class="feature-card anim-fade-in anim-delay-3">
            <div class="feature-icon">🎯</div>
            <div class="feature-title">Tolerance Flagging</div>
            <p class="feature-desc">The platform shows clear threshold signals so users know when a scenario is within appetite, approaching concern, or above tolerance.</p>
          </div>
          <div class="feature-card anim-fade-in anim-delay-4">
            <div class="feature-icon">🔗</div>
            <div class="feature-title">Linked Risk Scenarios</div>
            <p class="feature-desc">Choose several related risks together when one issue can trigger another, such as a cyber event causing regulatory and operational impact.</p>
          </div>
        </div>

        <!-- Recent assessments -->
        ${assessments.length ? `
        <section style="margin-top:var(--sp-12)">
          <div class="flex items-center justify-between mb-4">
            <h3 style="font-size:var(--text-xl)">Recent Assessments <span class="badge badge--neutral" style="margin-left:8px;font-size:.65rem">Browser only</span></h3>
            <button class="btn btn--ghost btn--sm" id="btn-clear-all">Clear All</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
            ${assessments.map(a => `
              <div class="assessment-item" data-id="${a.id}" role="button" tabindex="0">
                <div class="assessment-meta">
                  <div class="assessment-title">${a.scenarioTitle || 'Untitled'}</div>
                  <div class="assessment-detail">${a.buName || '—'} · ${new Date(parseInt((a.id||'0').replace('a_',''))).toLocaleDateString('en-AE')}</div>
                </div>
                ${(() => {
                  const lifecycle = typeof getAssessmentLifecyclePresentation === 'function' ? getAssessmentLifecyclePresentation(a) : { label: a.results ? 'Simulated' : 'Draft', tone: a.results && a.results.toleranceBreached ? 'danger' : a.results ? 'success' : 'neutral' };
                  return `<span class="badge badge--${lifecycle.tone}">${lifecycle.label}</span>`;
                })()}
                <span style="color:var(--text-muted);font-size:20px">→</span>
              </div>`).join('')}
          </div>
        </section>` : ''}

      </div>
    </main>

    <style>
      .template-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-xl);
        padding: var(--sp-5);
        cursor: pointer;
        transition: all var(--transition-base);
        text-align: left;
        width: 100%;
      }
      .template-card:hover {
        border-color: var(--color-primary-600);
        background: var(--bg-overlay-hover);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
    </style>`);

  // Wiring
  document.getElementById('btn-start-new').addEventListener('click', () => { resetDraft(); Router.navigate('/wizard/1'); });

  document.getElementById('btn-how-it-works').addEventListener('click', () => {
    const panel = document.getElementById('how-it-works-panel');
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    document.getElementById('btn-how-it-works').textContent = isHidden ? 'Hide ↑' : 'How it works →';
  });

  document.getElementById('btn-show-templates').addEventListener('click', () => {
    document.getElementById('templates-panel').classList.remove('hidden');
    document.getElementById('templates-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('btn-hide-templates')?.addEventListener('click', () => {
    document.getElementById('templates-panel').classList.add('hidden');
  });

  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const tmpl = ScenarioTemplates.find(t => t.id === card.dataset.templateId);
      if (tmpl) loadTemplate(tmpl);
    });
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', async () => {
    if (await UI.confirm('Clear all saved assessments from this browser?')) {
      // Clearing only local storage left the in-memory/user-sync view stale until a hard reload.
      persistSavedAssessmentsCollection([]);
      Router.resolve();
    }
  });

  document.querySelectorAll('.assessment-item').forEach(el => {
    const open = () => Router.navigate('/results/' + el.dataset.id);
    el.addEventListener('click', open);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
  });
}



function loadTemplate(tmpl) {
  resetDraft();
  const learned = applyLearnedTemplateDraft(tmpl);
  recordTemplateLoad(tmpl.id);
  // Pick a sensible default BU if suggested ones are available
  const buList = getBUList();
  const preferredBU = tmpl.suggestedBUTypes
    .map(id => buList.find(b => b.id === id))
    .find(Boolean);

  Object.assign(AppState.draft, {
    ...learned.draft,
    templateId: tmpl.id,
    buId: preferredBU?.id || null,
    buName: preferredBU?.name || null,
    llmAssisted: false,
    learningNote: learned.note
  });
  saveDraft();
  Router.navigate('/wizard/1');
  UI.toast(learned.note ? `Template loaded with learned defaults: "${tmpl.label}".` : `Template loaded: "${tmpl.label}". Review inputs and run the simulation.`, 'info', 4500);
}

// ─── WIZARD 1 ─────────────────────────────────────────────────

// ─── WIZARD 2 ─────────────────────────────────────────────────

function renderCitationBlock(citations) {
  const unique = normaliseCitations(citations);
  if (!unique.length) return '';
  const primary = unique.slice(0, 4);
  const remaining = unique.length - primary.length;
  return `<div class="card mt-4 anim-fade-in">
    <div class="context-panel-title">Key references used</div>
    <div class="form-help" style="margin-top:6px">Most relevant sources are shown first so it is easier to see what grounded the AI output.</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:var(--sp-4)">
      ${primary.map(c => `<button class="citation-chip" style="justify-content:space-between;align-items:flex-start;padding:var(--sp-4);width:100%;text-align:left" data-doc-id="${c.docId || ''}" data-doc-title="${escapeHtml(c.title || '')}" data-doc-url="${escapeHtml(c.url || '')}">
        <span style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="citation-chip-icon">📄</span><span style="font-weight:600;color:var(--text-primary)">${escapeHtml(c.title || 'Untitled source')}</span><span class="badge badge--neutral">${escapeHtml(c.sourceType || 'Source')}</span></span>
          ${c.relevanceReason ? `<span style="font-size:.8rem;color:var(--text-secondary)">Why used: ${escapeHtml(c.relevanceReason)}</span>` : ''}
        </span>
      </button>`).join('')}
    </div>
    ${remaining > 0 ? `<div class="form-help" style="margin-top:12px">${remaining} additional source${remaining === 1 ? '' : 's'} are also attached to this assessment.</div>` : ''}
  </div>`;
}

function renderWorkflowGuidanceBlock(items, title = 'AI Guidance Through the Workflow') {
  if (!items?.length) return '';
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">${title}</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-4)">
      ${items.map((item, idx) => `<div style="display:flex;gap:var(--sp-3);align-items:flex-start"><span class="badge badge--gold" style="min-width:28px;justify-content:center">${idx + 1}</span><div class="context-panel-copy" style="margin:0">${item}</div></div>`).join('')}
    </div>
  </div>`;
}

function renderBenchmarkRationaleBlock(benchmarkBasis, inputRationale, benchmarkReferences = []) {
  if (!benchmarkBasis && !inputRationale && !benchmarkReferences?.length) return '';
  const rows = [
    ['Benchmark basis', benchmarkBasis],
    ['Why the frequency looks like this', inputRationale?.tef],
    ['Why vulnerability looks like this', inputRationale?.vulnerability],
    ['Why the loss ranges look like this', inputRationale?.lossComponents]
  ].filter(([, value]) => value);
  const refs = Array.isArray(benchmarkReferences) ? benchmarkReferences : [];
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">Benchmark Logic and Number Rationale</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-4);margin-top:var(--sp-4)">
      ${rows.map(([label, value]) => `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${label}</div><div style="font-size:.85rem;color:var(--text-secondary);margin-top:6px;line-height:1.7">${value}</div></div>`).join('')}
      ${refs.length ? `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Benchmark sources used</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${refs.map(ref => `<div><div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap"><strong style="font-size:.85rem;color:var(--text-primary)">${escapeHtml(String(ref.title || ref.sourceTitle || 'Benchmark source'))}</strong><span class="badge badge--neutral">${escapeHtml(String(ref.scope || 'benchmark'))}</span><span class="badge badge--gold">${escapeHtml(String(ref.sourceTypeLabel || ref.sourceType || 'Reference'))}</span>${ref.confidenceLabel ? `<span class="badge badge--success">${escapeHtml(String(ref.confidenceLabel))}</span>` : ''}${ref.freshnessLabel ? `<span class="badge badge--neutral">${escapeHtml(String(ref.freshnessLabel))}</span>` : ''}${ref.lastUpdated ? `<span class="badge badge--neutral">${escapeHtml(String(ref.lastUpdated))}</span>` : ''}</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(String(ref.sourceTitle || ''))}${ref.summary ? ` — ${escapeHtml(String(ref.summary))}` : ''}</div></div>`).join('')}</div></div>` : ''}
    </div>
  </div>`;
}

function renderInputProvenanceBlock(inputProvenance = []) {
  const items = Array.isArray(inputProvenance) ? inputProvenance.filter(Boolean) : [];
  if (!items.length) return '';
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">Where the key numbers came from</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">
      ${items.map(item => `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap"><strong style="font-size:.85rem;color:var(--text-primary)">${escapeHtml(String(item.label || 'Input'))}</strong><span class="badge badge--neutral">${escapeHtml(String(item.origin || 'Inference'))}</span>${item.scope ? `<span class="badge badge--gold">${escapeHtml(String(item.scope))}</span>` : ''}${item.sourceTypeLabel ? `<span class="badge badge--neutral">${escapeHtml(String(item.sourceTypeLabel))}</span>` : ''}${item.confidenceLabel ? `<span class="badge badge--success">${escapeHtml(String(item.confidenceLabel))}</span>` : ''}${item.freshnessLabel ? `<span class="badge badge--neutral">${escapeHtml(String(item.freshnessLabel))}</span>` : ''}</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(String(item.reason || 'Starting point generated from current scenario context.'))}</div>${item.supportingKinds?.length ? `<div class="form-help" style="margin-top:6px">Support used: ${escapeHtml(String(item.supportingKinds.join(', ')))}</div>` : ''}${item.sourceTitle ? `<div class="form-help" style="margin-top:6px">${escapeHtml(String(item.sourceTitle))}${item.lastUpdated ? ` · ${escapeHtml(String(item.lastUpdated))}` : ''}</div>` : ''}</div>`).join('')}
    </div>
  </div>`;
}

function renderEvidenceQualityBlock(confidenceLabel, evidenceQuality, evidenceSummary, missingInformation = [], title = 'AI Evidence Quality', evidenceBreakdown = null) {
  const breakdown = evidenceBreakdown || {};
  const primaryGrounding = Array.isArray(breakdown.primaryGrounding) ? breakdown.primaryGrounding : [];
  const supportingReferences = Array.isArray(breakdown.supportingReferences) ? breakdown.supportingReferences : [];
  const inferredAssumptions = Array.isArray(breakdown.inferredAssumptions) ? breakdown.inferredAssumptions : [];
  if (!confidenceLabel && !evidenceQuality && !evidenceSummary && !(missingInformation || []).length && !primaryGrounding.length && !supportingReferences.length && !inferredAssumptions.length) return '';
  const renderEvidenceRows = (items, heading) => items.length ? `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${heading}</div><div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-3)">${items.map((item, idx) => {
    const text = typeof item === 'string' ? item : `${item.title || 'Untitled source'}${item.relevanceReason ? ` — ${item.relevanceReason}` : ''}`;
    const badge = typeof item === 'string' ? idx + 1 : (item.sourceType || 'Source');
    return `<div style="display:flex;gap:var(--sp-3);align-items:flex-start"><span class="badge badge--neutral" style="min-width:24px;justify-content:center">${escapeHtml(String(badge))}</span><div class="context-panel-copy" style="margin:0">${escapeHtml(String(text))}</div></div>`;
  }).join('')}</div></div>` : '';
  const renderEvidenceDetails = (items, heading, summary) => items.length ? `<details style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)"><span>${heading}</span><span class="badge badge--neutral">${summary}</span></summary><div style="margin-top:var(--sp-3)">${renderEvidenceRows(items, heading).replace(/^<div style="background:var\(--bg-elevated\);padding:var\(--sp-4\);border-radius:var\(--radius-lg\)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var\(--text-muted\)">.*?<\/div>/, '').replace(/<\/div>$/, '')}</div></details>` : '';
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">${title}</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">
      ${confidenceLabel || evidenceQuality ? `<div class="citation-chips"><span class="badge badge--neutral">${confidenceLabel || 'AI confidence not stated'}</span><span class="badge badge--gold">${evidenceQuality || 'Evidence quality not stated'}</span></div>` : ''}
      ${evidenceSummary ? `<p class="context-panel-copy">${evidenceSummary}</p>` : ''}
      ${renderEvidenceRows(primaryGrounding, 'Primary grounding')}
      ${renderEvidenceDetails(supportingReferences, 'Supporting references', `${supportingReferences.length} source${supportingReferences.length === 1 ? '' : 's'}`)}
      ${renderEvidenceDetails(inferredAssumptions, 'Inferred without direct evidence', `${inferredAssumptions.length} item${inferredAssumptions.length === 1 ? '' : 's'}`)}
      ${(missingInformation || []).length ? `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">What would make this stronger</div><div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-3)">${missingInformation.map((item, idx) => `<div style="display:flex;gap:var(--sp-3);align-items:flex-start"><span class="badge badge--neutral" style="min-width:24px;justify-content:center">${idx + 1}</span><div class="context-panel-copy" style="margin:0">${escapeHtml(String(item))}</div></div>`).join('')}</div></div>` : ''}
    </div>
  </div>`;
}

function inferEvidenceGapOwner(text = '') {
  const source = String(text || '').toLowerCase();
  if (/(vendor|supplier|third[- ]party|partner|outsourc)/.test(source)) return 'Vendor management';
  if (/(legal|regulat|privacy|contract|obligation|counsel|compliance)/.test(source)) return 'Legal';
  if (/(cost|finance|revenue|budget|loss|exposure|insurance)/.test(source)) return 'Finance';
  if (/(control|access|security|threat|attack|detect|incident|contain|vulnerab)/.test(source)) return 'Security';
  return 'Operations';
}

function inferEvidenceGapProfile(text = '') {
  const source = String(text || '').trim();
  const lower = source.toLowerCase();
  if (/(frequency|how often|event frequency|history|incident data|occurrence|recurring|volume)/.test(lower)) {
    return {
      area: 'Event frequency',
      why: 'This changes how wide the annual loss range should be and whether the review trigger is truly credible.',
      collect: 'Recent incident counts, service disruption history, near misses, or control-monitoring trend data.',
      improves: 'Confidence and estimate bounds'
    };
  }
  if (/(control|detection|response|access|contain|resilien|recovery|capability|vulnerab|attack path)/.test(lower)) {
    return {
      area: 'Exposure and control strength',
      why: 'This changes how likely the event is to succeed and whether the current treatment view is realistic.',
      collect: 'Control test results, tabletop findings, response metrics, or recovery evidence from the owning team.',
      improves: 'Confidence and treatment decision quality'
    };
  }
  if (/(cost|financial|revenue|loss|business interruption|disruption|outage|customer impact|insurance)/.test(lower)) {
    return {
      area: 'Loss range',
      why: 'This changes the severe-case loss and can materially tighten the decision range.',
      collect: 'Finance estimates, outage cost assumptions, recovery cost evidence, or prior disruption impact records.',
      improves: 'Estimate bounds and threshold interpretation'
    };
  }
  if (/(regulat|legal|privacy|compliance|contract|obligation)/.test(lower)) {
    return {
      area: 'Regulatory and legal impact',
      why: 'This changes the severe-case tail and can shift how close the result sits to tolerance.',
      collect: 'Applicable obligations, counsel input, notification requirements, or contract penalty language.',
      improves: 'Treatment decision quality and threshold interpretation'
    };
  }
  if (/(vendor|supplier|third[- ]party|partner|outsourc)/.test(lower)) {
    return {
      area: 'Third-party dependency',
      why: 'This changes disruption duration, recovery confidence, and whether mitigation options are realistic.',
      collect: 'Supplier assurance evidence, recovery commitments, SLA terms, and dependency-specific continuity detail.',
      improves: 'Confidence and treatment decision quality'
    };
  }
  return {
    area: 'Scenario evidence base',
    why: 'This still affects how defensible the scenario and resulting estimate are in review.',
    collect: 'The most direct business, control, financial, or source evidence that confirms the scenario assumption.',
    improves: 'Confidence'
  };
}

function buildEvidenceGapActionPlan({
  confidenceLabel = '',
  evidenceQuality = '',
  missingInformation = [],
  primaryGrounding = [],
  supportingReferences = [],
  inputProvenance = [],
  inferredAssumptions = [],
  citations = [],
  assumptions = []
} = {}) {
  const plan = [];
  const seen = new Set();
  const addItem = (title, description, overrides = {}) => {
    const label = String(title || description || '').trim();
    if (!label) return;
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) return;
    const profile = inferEvidenceGapProfile(description || label);
    seen.add(dedupeKey);
    plan.push({
      title: label,
      why: overrides.why || profile.why,
      collect: overrides.collect || profile.collect,
      owner: overrides.owner || inferEvidenceGapOwner(description || label),
      area: overrides.area || profile.area,
      improves: overrides.improves || profile.improves
    });
  };

  (Array.isArray(missingInformation) ? missingInformation : [])
    .filter(Boolean)
    .slice(0, 4)
    .forEach(item => addItem(item, item));

  const provenanceCount = (Array.isArray(inputProvenance) ? inputProvenance : []).filter(Boolean).length;
  const citationCount = (Array.isArray(citations) ? citations : []).filter(Boolean).length
    + (Array.isArray(primaryGrounding) ? primaryGrounding : []).filter(Boolean).length
    + (Array.isArray(supportingReferences) ? supportingReferences : []).filter(Boolean).length;
  const inferred = Array.isArray(inferredAssumptions) ? inferredAssumptions.filter(Boolean) : [];
  const tracedAssumptions = Array.isArray(assumptions) ? assumptions.filter(Boolean) : [];
  const lowConfidence = /low/i.test(String(confidenceLabel || '')) || /thin/i.test(String(evidenceQuality || ''));

  if (plan.length < 3 && inferred.length) {
    addItem('One key assumption is still inferred', inferred[0], {
      area: 'Assumption quality',
      collect: 'The direct evidence, control record, or business input that turns this assumption into a defendable input.',
      improves: 'Confidence and treatment decision quality'
    });
  }
  if (plan.length < 3 && tracedAssumptions.length) {
    const topAssumption = tracedAssumptions[0]?.text || tracedAssumptions[0];
    addItem('The leading assumption still needs direct backing', topAssumption, {
      area: 'Assumption traceability',
      collect: 'Source-backed evidence that confirms or narrows the assumption before the next review.',
      improves: 'Confidence'
    });
  }
  if (plan.length < 3 && provenanceCount < 2) {
    addItem('Key inputs have thin provenance', 'The estimate is still relying on too little traced source basis.', {
      area: 'Input provenance',
      collect: 'A clearer source trail for the core estimate inputs, especially frequency, exposure, and largest loss drivers.',
      owner: 'Operations',
      improves: 'Confidence and estimate bounds'
    });
  }
  if (plan.length < 3 && (citationCount < 2 || lowConfidence)) {
    addItem('The external and internal evidence base is still light', 'More grounded evidence would make the result easier to defend in review.', {
      area: 'Evidence base',
      collect: 'One or two high-quality internal or external references that directly support the current scenario path.',
      owner: 'Operations',
      improves: 'Confidence and threshold interpretation'
    });
  }

  return plan.slice(0, 5);
}

function buildInputOriginMix(inputAssignments = []) {
  const assignments = Array.isArray(inputAssignments) ? inputAssignments.filter(Boolean) : [];
  const userEntered = assignments.filter(item => /user/i.test(String(item?.origin || ''))).length;
  const aiSuggested = assignments.filter(item => /ai/i.test(String(item?.origin || ''))).length;
  const inheritedContext = assignments.filter(item => !/user/i.test(String(item?.origin || '')) && !/ai/i.test(String(item?.origin || ''))).length;
  return {
    userEntered,
    aiSuggested,
    inheritedContext,
    total: userEntered + aiSuggested + inheritedContext
  };
}

function buildEvidenceTrustSummary({
  confidenceLabel = '',
  evidenceQuality = '',
  evidenceSummary = '',
  missingInformation = [],
  inputProvenance = [],
  citations = [],
  primaryGrounding = [],
  supportingReferences = [],
  inferredAssumptions = [],
  inputAssignments = []
} = {}) {
  const missing = Array.isArray(missingInformation) ? missingInformation.filter(Boolean) : [];
  const provenance = Array.isArray(inputProvenance) ? inputProvenance.filter(Boolean) : [];
  const citationList = normaliseCitations(citations);
  const primary = Array.isArray(primaryGrounding) ? primaryGrounding.filter(Boolean) : [];
  const supporting = Array.isArray(supportingReferences) ? supportingReferences.filter(Boolean) : [];
  const inferred = Array.isArray(inferredAssumptions) ? inferredAssumptions.filter(Boolean) : [];
  const inputOriginMix = buildInputOriginMix(inputAssignments);
  const sourceBasisCount = provenance.length + citationList.length + primary.length + supporting.length;
  const totalEvidenceCount = citationList.length + primary.length + supporting.length + provenance.length;
  return {
    confidenceLabel: String(confidenceLabel || '').trim() || 'Working estimate',
    evidenceQuality: String(evidenceQuality || '').trim(),
    evidenceSummary: String(evidenceSummary || '').trim(),
    missingInformation: missing,
    topGap: missing[0] || '',
    provenanceCount: provenance.length,
    citationCount: citationList.length,
    primaryGroundingCount: primary.length,
    supportingReferenceCount: supporting.length,
    inferredAssumptionsCount: inferred.length,
    sourceBasisCount,
    totalEvidenceCount,
    inputOriginMix,
    hasThinEvidence: /low/i.test(String(confidenceLabel || '')) || /thin|incomplete|weak/i.test(String(evidenceQuality || '')) || totalEvidenceCount < 2
  };
}

function buildQuantReadinessModel({
  draft = {},
  validation = {},
  selectedRisks = []
} = {}) {
  const citations = Array.isArray(draft.citations) ? draft.citations.filter(Boolean) : [];
  const provenance = Array.isArray(draft.inputProvenance) ? draft.inputProvenance.filter(Boolean) : [];
  const assumptions = Array.isArray(draft.inferredAssumptions) ? draft.inferredAssumptions.filter(Boolean) : [];
  const missing = Array.isArray(draft.missingInformation) ? draft.missingInformation.filter(Boolean) : [];
  const p = draft.fairParams || {};
  const narrativeReady = !!String(draft.enhancedNarrative || draft.narrative || '').trim();
  const requiredEstimateFields = [
    'tefLikely',
    'threatCapLikely',
    'controlStrLikely',
    'irLikely',
    'biLikely',
    'dbLikely'
  ];
  const estimateCoverage = requiredEstimateFields.filter(key => Number.isFinite(Number(p[key])) && Number(p[key]) > 0).length;
  const errors = Array.isArray(validation?.errors) ? validation.errors.filter(Boolean) : [];
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings.filter(Boolean) : [];

  const scenarioScore = narrativeReady ? 15 : 0;
  const scopeScore = selectedRisks.length ? 10 : 0;
  const evidenceScore = Math.min(15, citations.length * 5) + Math.min(10, provenance.length * 2);
  const estimateScore = Math.round((estimateCoverage / requiredEstimateFields.length) * 30);
  const challengeScore = Math.max(0, 15 - (missing.length * 4) - (errors.length * 8) - (warnings.length * 2)) + Math.min(5, assumptions.length * 2);
  const totalScore = Math.max(0, Math.min(100, scenarioScore + scopeScore + evidenceScore + estimateScore + challengeScore));
  const status = totalScore >= 80
    ? 'Run-ready'
    : totalScore >= 60
      ? 'Usable with challenge'
      : 'Needs more grounding';
  const tone = totalScore >= 80 ? 'success' : totalScore >= 60 ? 'warning' : 'danger';
  const nextFocus = errors[0]
    || missing[0]
    || warnings[0]
    || (!narrativeReady ? 'Tighten the scenario wording before relying on the estimate.' : '')
    || (!selectedRisks.length ? 'Confirm the risk shortlist so the estimate has a clear scope.' : '')
    || (estimateCoverage < requiredEstimateFields.length ? 'Complete the main frequency, exposure, and cost rows before you run.' : '')
    || 'The scenario is grounded enough to proceed into review and simulation.';
  return {
    totalScore,
    status,
    tone,
    nextFocus,
    factors: [
      {
        label: 'Scenario clarity',
        value: narrativeReady ? 'Defined' : 'Thin',
        copy: narrativeReady
          ? 'The scenario narrative is clear enough to quantify.'
          : 'Narrative wording is still too thin for a high-trust run.'
      },
      {
        label: 'Scope and context',
        value: selectedRisks.length ? `${selectedRisks.length} in scope` : 'Scope not locked',
        copy: selectedRisks.length
          ? 'Selected risks give the model a cleaner assessment boundary.'
          : 'Confirm which risks belong in this case before relying on the result.'
      },
      {
        label: 'Evidence posture',
        value: `${citations.length + provenance.length} basis item${citations.length + provenance.length === 1 ? '' : 's'}`,
        copy: citations.length || provenance.length
          ? 'Sources, citations, or tracked provenance are available for challenge.'
          : 'The model is still relying mainly on working judgement and seeded inputs.'
      },
      {
        label: 'Estimate coverage',
        value: `${estimateCoverage}/${requiredEstimateFields.length}`,
        copy: estimateCoverage === requiredEstimateFields.length
          ? 'The core FAIR input groups are complete enough for a useful pilot run.'
          : 'Finish the main frequency, exposure, and cost rows for a stronger run.'
      }
    ]
  };
}

function buildAssessmentReadinessModel({
  draft = {},
  selectedRisks = [],
  scenarioGeographies = [],
  validation = {}
} = {}) {
  const trust = buildEvidenceTrustSummary({
    confidenceLabel: draft.confidenceLabel,
    evidenceQuality: draft.evidenceQuality,
    evidenceSummary: draft.evidenceSummary,
    missingInformation: draft.missingInformation,
    inputProvenance: draft.inputProvenance,
    citations: draft.citations,
    primaryGrounding: draft.primaryGrounding,
    supportingReferences: draft.supportingReferences,
    inferredAssumptions: draft.inferredAssumptions,
    inputAssignments: draft.inputAssignments
  });
  const p = draft.fairParams || {};
  const narrativeReady = !!String(draft.enhancedNarrative || draft.narrative || '').trim();
  const hasContextScope = !!String(draft.buId || '').trim();
  const estimateSeedCount = [
    'tefLikely',
    'threatCapLikely',
    'controlStrLikely',
    'irLikely',
    'biLikely',
    'dbLikely'
  ].filter(key => Number.isFinite(Number(p[key])) && Number(p[key]) > 0).length;
  const errors = Array.isArray(validation?.errors) ? validation.errors.filter(Boolean) : [];
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings.filter(Boolean) : [];
  let score = 0;
  if (narrativeReady) score += 25;
  if (selectedRisks.length) score += 20;
  if (hasContextScope) score += 10;
  if (scenarioGeographies.length) score += 5;
  score += Math.min(20, trust.totalEvidenceCount * 4);
  score += Math.min(20, estimateSeedCount * 3);
  score -= Math.min(15, errors.length * 8);
  score -= Math.min(10, warnings.length * 3);
  score = Math.max(0, Math.min(100, score));
  const label = score >= 80
    ? 'Decision-ready'
    : score >= 55
      ? 'Well grounded'
      : 'Lightly grounded';
  const tone = score >= 80 ? 'success' : score >= 55 ? 'warning' : 'neutral';
  const summary = errors[0]
    || trust.topGap
    || warnings[0]
    || (!narrativeReady ? 'Add a coherent scenario narrative first.' : '')
    || (!selectedRisks.length ? 'Confirm which risks stay in scope.' : '')
    || (!hasContextScope ? 'Pick the business unit so inherited context and regulations carry forward.' : '')
    || (estimateSeedCount < 3 ? 'Pre-load or enter the core estimate ranges before the run.' : '')
    || 'The current scenario, context, and evidence are strong enough to support a management read.';
  return {
    label,
    tone,
    score,
    summary,
    stats: [
      { label: 'Narrative', value: narrativeReady ? 'In place' : 'Missing' },
      { label: 'Scope', value: selectedRisks.length ? `${selectedRisks.length} selected` : 'Not set' },
      { label: 'Evidence', value: trust.totalEvidenceCount ? `${trust.totalEvidenceCount} basis item${trust.totalEvidenceCount === 1 ? '' : 's'}` : 'Thin' }
    ]
  };
}

function renderAssessmentReadinessStrip(model = {}) {
  const stats = Array.isArray(model.stats) ? model.stats.filter(Boolean) : [];
  if (!model.label) return '';
  return `<section class="wizard-readiness-strip wizard-readiness-strip--${escapeHtml(String(model.tone || 'neutral'))} anim-fade-in">
    <div class="wizard-readiness-strip__main">
      <div class="wizard-readiness-strip__label">Assessment readiness</div>
      <strong>${escapeHtml(String(model.label || 'Working draft'))}</strong>
      <span>${escapeHtml(String(model.summary || ''))}</span>
    </div>
    ${stats.length ? `<div class="wizard-readiness-strip__meta">
      ${stats.map(item => `<div class="wizard-readiness-strip__stat">
        <span>${escapeHtml(String(item.label || 'Signal'))}</span>
        <strong>${escapeHtml(String(item.value || ''))}</strong>
      </div>`).join('')}
    </div>` : ''}
  </section>`;
}

function buildReviewReadinessModel({
  draft = {},
  validation = {},
  selectedRisks = [],
  safeIterations = 0
} = {}) {
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings.filter(Boolean) : [];
  const errors = Array.isArray(validation?.errors) ? validation.errors.filter(Boolean) : [];
  const trust = buildEvidenceTrustSummary({
    confidenceLabel: draft.confidenceLabel,
    evidenceQuality: draft.evidenceQuality,
    evidenceSummary: draft.evidenceSummary,
    missingInformation: draft.missingInformation,
    inputProvenance: draft.inputProvenance,
    citations: draft.citations,
    primaryGrounding: draft.primaryGrounding,
    supportingReferences: draft.supportingReferences,
    inferredAssumptions: draft.inferredAssumptions,
    inputAssignments: draft.inputAssignments
  });
  const reviewGateLabel = errors.length
    ? 'Needs changes before run'
    : warnings.length
      ? 'Ready, but challenge the flagged assumptions'
      : 'Ready to run';
  const reviewGateCopy = errors[0] || warnings[0] || 'The scenario, assumptions, and model settings are coherent enough for a pilot run. Use the checks below to decide whether to run now or tighten one input first.';
  const runDecisionLabel = errors.length
    ? 'Complete the flagged inputs before you run'
    : warnings.length
      ? 'Run now, but challenge the flagged assumptions'
      : 'Run now with the current assumptions';
  const runDecisionCopy = errors[0]
    ? errors[0]
    : warnings[0] || 'The run will save the current thresholds, distributions, and traced assumptions behind the result.';
  return {
    reviewGateLabel,
    reviewGateCopy,
    scopeLabel: selectedRisks.length ? `${selectedRisks.length} risk${selectedRisks.length === 1 ? '' : 's'} in scope` : 'Scenario scope only',
    scopeMeta: `${draft.geography || 'No geography stated'} · ${Number(safeIterations || 0).toLocaleString('en-US')} iterations · ${trust.confidenceLabel}`,
    runDecisionLabel,
    runDecisionCopy,
    toneClass: errors.length ? 'wizard-run-band--blocked' : warnings.length ? 'wizard-run-band--caution' : '',
    trustHeadline: trust.provenanceCount ? `${trust.provenanceCount} tracked provenance item${trust.provenanceCount === 1 ? '' : 's'}` : 'No tracked provenance yet',
    trustCopy: `${trust.citationCount ? `${trust.citationCount} supporting citation${trust.citationCount === 1 ? '' : 's'} are linked to the scenario.` : 'This run is still relying mainly on the scenario narrative and current judgement calls.'}${trust.inferredAssumptionsCount ? ` Main assumption to challenge: ${trust.topGap || (Array.isArray(draft.inferredAssumptions) ? draft.inferredAssumptions.filter(Boolean)[0] || '' : '')}` : ''}`,
    topGap: trust.topGap,
    trust,
    warnings,
    errors
  };
}

function buildResultTrustBasis({
  assessment = {},
  runMetadata = null,
  inputAssignments = []
} = {}) {
  const originMix = buildInputOriginMix(inputAssignments);
  const trust = buildEvidenceTrustSummary({
    confidenceLabel: assessment.confidenceLabel,
    evidenceQuality: assessment.evidenceQuality,
    evidenceSummary: assessment.evidenceSummary,
    missingInformation: assessment.missingInformation,
    inputProvenance: assessment.inputProvenance,
    citations: assessment.citations,
    primaryGrounding: assessment.primaryGrounding,
    supportingReferences: assessment.supportingReferences,
    inferredAssumptions: assessment.inferredAssumptions,
    inputAssignments
  });
  return {
    userEntered: originMix.userEntered,
    aiSuggested: originMix.aiSuggested,
    inheritedContext: originMix.inheritedContext,
    inferredAssumptions: trust.inferredAssumptionsCount,
    citations: trust.citationCount,
    provenance: trust.provenanceCount,
    seed: runMetadata?.seed ?? '—',
    iterations: Number(runMetadata?.iterations || 0).toLocaleString(),
    distribution: String(runMetadata?.distributions?.eventModel || 'triangular'),
    vulnerabilityMode: String(runMetadata?.distributions?.vulnerabilityMode || 'derived')
  };
}

function buildAssessmentWatchlist({
  assessments = [],
  excludeAssessmentIds = [],
  maxItems = 6,
  now = Date.now()
} = {}) {
  const excluded = new Set((Array.isArray(excludeAssessmentIds) ? excludeAssessmentIds : []).filter(Boolean).map(id => String(id)));
  const list = (Array.isArray(assessments) ? assessments : [])
    .filter(assessment => assessment && assessment.results && !excluded.has(String(assessment.id || '')))
    .map(assessment => {
      const lifecycleStatus = typeof deriveAssessmentLifecycleStatus === 'function'
        ? deriveAssessmentLifecycleStatus(assessment)
        : String(assessment.lifecycleStatus || '').trim().toLowerCase();
      if (lifecycleStatus === 'archived') return null;
      const results = assessment.results || {};
      const completedAt = new Date(assessment.completedAt || assessment.lifecycleUpdatedAt || assessment.createdAt || 0).getTime() || 0;
      const daysSinceReview = completedAt ? Math.max(0, Math.floor((now - completedAt) / 86400000)) : 0;
      const citationCount = Array.isArray(assessment.citations) ? assessment.citations.filter(Boolean).length : 0;
      const missingCount = Array.isArray(assessment.missingInformation) ? assessment.missingInformation.filter(Boolean).length : 0;
      const inferredCount = Array.isArray(assessment.inferredAssumptions) ? assessment.inferredAssumptions.filter(Boolean).length : 0;
      const confidenceLabel = String(assessment.confidenceLabel || assessment.assessmentIntelligence?.confidence?.label || '').trim();
      const evidenceQuality = String(assessment.evidenceQuality || assessment.assessmentIntelligence?.confidence?.evidenceQuality || '').trim();
      const weakConfidence = /low/i.test(confidenceLabel) || /thin|incomplete|weak/i.test(evidenceQuality) || missingCount >= 2;
      const reasons = [];
      const addReason = (key, label, priority, tone, summary, nextAction = '', family = 'review') => {
        if (!key || reasons.some(item => item.key === key)) return;
        reasons.push({ key, label, priority, tone, summary, nextAction, family });
      };

      if (results.toleranceBreached) {
        addReason(
          'above_tolerance',
          'Above tolerance',
          100,
          'danger',
          'The severe-case view is above tolerance and should return to active management review.',
          'Reopen the result and confirm the management response before conditions drift further.',
          'posture'
        );
      }
      if (results.nearTolerance) {
        addReason(
          'near_tolerance',
          'Near tolerance',
          90,
          'warning',
          'The position is still close enough to tolerance that it deserves another look before conditions drift.',
          'Check whether recent changes, new evidence, or weaker controls would push it over tolerance.',
          'posture'
        );
      }
      if (results.annualReviewTriggered) {
        addReason(
          'annual_review',
          'Annual review due',
          82,
          'gold',
          'The annual exposure view is at or above the review trigger, so this should come back into the formal review lane.',
          'Refresh the scenario against current operating conditions and confirm the existing posture still holds.',
          'timing'
        );
      }
      if (weakConfidence) {
        addReason(
          'confidence_gap',
          'Confidence gap',
          76,
          'neutral',
          'The result is still carrying weaker evidence or broader assumptions than you would want for a settled reference point.',
          'Open the result and tighten the highest-impact evidence gaps before treating it as a settled reference.',
          'evidence'
        );
      }
      if (lifecycleStatus === 'treatment_variant') {
        addReason(
          'treatment_validation',
          'Treatment needs validation',
          72,
          'gold',
          'A treatment variant is saved, but the future-state change still needs confirmation before it becomes the trusted path.',
          'Review the treatment delta and validate that the planned control change is still realistic and funded.',
          'validation'
        );
      }
      if (daysSinceReview >= 180 && (citationCount < 2 || weakConfidence)) {
        addReason(
          'stale_evidence',
          'Evidence basis is aging',
          68,
          'neutral',
          'The saved result is old enough that newer evidence or changed conditions may have shifted the decision read.',
          'Refresh the evidence basis or confirm the original sources are still representative.',
          'evidence'
        );
      }
      if (lifecycleStatus === 'baseline_locked' && daysSinceReview >= 120) {
        addReason(
          'baseline_refresh',
          'Baseline should be refreshed',
          64,
          'gold',
          'The locked baseline is still useful, but it has not been revisited recently enough to stay a confident comparison anchor.',
          'Recheck the baseline assumptions so future treatment comparisons stay anchored to a current reference point.',
          'baseline'
        );
      }
      if (daysSinceReview >= 120 && inferredCount >= 2) {
        addReason(
          'old_assumptions',
          'Assumptions should be challenged',
          58,
          'neutral',
          'This result still depends on older inferred assumptions that should be pressure-tested before reuse.',
          'Challenge the oldest inferred assumptions and replace them with fresher evidence where possible.',
          'evidence'
        );
      }

      if (!reasons.length) return null;
      reasons.sort((a, b) => b.priority - a.priority);
      const topReason = reasons[0];
      const reasonTrail = reasons.length > 1 ? ` +${reasons.length - 1} more signal${reasons.length - 1 === 1 ? '' : 's'}` : '';
      const urgency = topReason.tone === 'danger'
        ? { label: 'Act now', badgeClass: 'badge--danger' }
        : topReason.tone === 'warning'
          ? { label: 'Review soon', badgeClass: 'badge--warning' }
          : topReason.tone === 'gold'
            ? { label: 'Recheck', badgeClass: 'badge--gold' }
            : { label: 'Check basis', badgeClass: 'badge--neutral' };
      const actionLabel = topReason.key === 'treatment_validation'
        ? 'Validate treatment'
        : topReason.key === 'baseline_refresh'
          ? 'Refresh baseline'
          : topReason.family === 'evidence'
            ? 'Refresh evidence'
            : topReason.tone === 'danger'
              ? 'Review now'
              : 'Open Result';
      const reviewAgeLabel = completedAt
        ? (daysSinceReview >= 365
          ? `Reviewed ${Math.floor(daysSinceReview / 30)} months ago`
          : daysSinceReview >= 30
            ? `Reviewed ${Math.floor(daysSinceReview / 30)} months ago`
            : daysSinceReview >= 7
              ? `Reviewed ${Math.floor(daysSinceReview / 7)} weeks ago`
              : daysSinceReview > 0
                ? `Reviewed ${daysSinceReview} day${daysSinceReview === 1 ? '' : 's'} ago`
                : 'Reviewed recently')
        : 'Review date not available';
      return {
        id: assessment.id,
        title: assessment.scenarioTitle || 'Untitled assessment',
        priority: topReason.priority,
        updatedAt: completedAt,
        businessContext: assessment.buName || assessment.businessUnit || 'Saved assessment',
        badgeLabel: topReason.label,
        badgeClass: topReason.tone === 'danger'
          ? 'badge--danger'
          : topReason.tone === 'warning'
            ? 'badge--warning'
            : topReason.tone === 'gold'
              ? 'badge--gold'
              : 'badge--neutral',
        detail: `${topReason.summary}${reasonTrail ? ` ·${reasonTrail}` : ''}`,
        nextAction: topReason.nextAction,
        urgencyLabel: urgency.label,
        urgencyBadgeClass: urgency.badgeClass,
        actionLabel,
        reviewAgeLabel,
        reasonFamily: topReason.family || 'review',
        reasons
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  return list.slice(0, Math.max(0, Number(maxItems || 0) || 0));
}

function buildAssessmentWatchlistSummary(items = []) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const groups = [
    { key: 'posture', label: 'management review', order: 1 },
    { key: 'evidence', label: 'evidence refresh', order: 2 },
    { key: 'validation', label: 'validation check', order: 3 },
    { key: 'timing', label: 'scheduled revisit', order: 4 },
    { key: 'baseline', label: 'baseline refresh', order: 5 },
    { key: 'review', label: 'review follow-up', order: 6 }
  ];
  const counts = new Map();
  list.forEach(item => {
    const key = item?.reasonFamily || 'review';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return groups
    .map(group => {
      const count = counts.get(group.key) || 0;
      if (!count) return null;
      return {
        key: group.key,
        order: group.order,
        label: `${count} ${group.label}${count === 1 ? '' : 's'}`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
}

function buildScenarioQualityCoach({
  draft = {},
  selectedRisks = [],
  scenarioGeographies = [],
  citations = [],
  evidenceQuality = '',
  confidenceLabel = '',
  inputProvenance = [],
  primaryGrounding = [],
  supportingReferences = [],
  inferredAssumptions = []
} = {}) {
  const narrative = String(draft.enhancedNarrative || draft.narrative || '').trim();
  const structured = draft.structuredScenario || {};
  const wordCount = narrative ? narrative.split(/\s+/).filter(Boolean).length : 0;
  const totalEvidenceCount = (Array.isArray(citations) ? citations.filter(Boolean).length : 0)
    + (Array.isArray(primaryGrounding) ? primaryGrounding.filter(Boolean).length : 0)
    + (Array.isArray(supportingReferences) ? supportingReferences.filter(Boolean).length : 0)
    + (Array.isArray(inputProvenance) ? inputProvenance.filter(Boolean).length : 0);
  const assetPresent = !!String(structured.assetService || '').trim() || /platform|service|system|application|environment|identity|data|supplier|vendor|team|workflow/i.test(narrative);
  const causePresent = !!String(structured.attackType || '').trim() || /because|caused by|trigger|supplier|vendor|misconfig|phishing|ransomware|breach|comprom|failure|outage|attack/i.test(narrative);
  const impactPresent = /impact|disrupt|outage|loss|harm|exposure|breach|regulatory|customer|recovery|financial|penalt|scrutiny/i.test(narrative);
  const eventSignals = (narrative.match(/\b(and then|while also|at the same time|multiple|plus|as well as)\b/gi) || []).length;
  const tooBroadScope = selectedRisks.length > 3 || eventSignals > 1 || /\bmultiple scenarios|several events|across several\b/i.test(narrative);
  const tooVague = wordCount > 0 && wordCount < 18;
  const weakEvidence = /low/i.test(String(confidenceLabel || '')) || /thin|incomplete|weak/i.test(String(evidenceQuality || '')) || totalEvidenceCount < 2;
  const weakAssumptions = (Array.isArray(inferredAssumptions) ? inferredAssumptions.filter(Boolean).length : 0) > 1;
  const suggestions = [];
  const addSuggestion = (title, action, why) => {
    if (!title || suggestions.some(item => item.title === title)) return;
    suggestions.push({ title, action, why });
  };

  if (!narrative) {
    addSuggestion(
      'Write one coherent scenario first',
      'Describe one event path, what it affects, what triggers it, and the main impact you want to estimate.',
      'The estimate step works best when the scenario reads as one management discussion instead of a loose topic.'
    );
  }
  if (tooVague) {
    addSuggestion(
      'Add more specificity',
      'Name the affected service, the likely cause, and the business consequence in one or two extra sentences.',
      'Thin wording makes the estimate broader than it needs to be.'
    );
  }
  if (!assetPresent) {
    addSuggestion(
      'Name what is actually affected',
      'Add the asset, service, team, or dependency that carries the scenario.',
      'A visible asset or service keeps the estimate challengeable.'
    );
  }
  if (!causePresent) {
    addSuggestion(
      'Make the trigger explicit',
      'Add the likely cause, failure mode, or attacker path instead of leaving the event generic.',
      'Clear trigger logic helps the model separate frequency from exposure.'
    );
  }
  if (!impactPresent) {
    addSuggestion(
      'State the impact in management terms',
      'Say whether the main concern is disruption, regulatory harm, customer impact, or financial exposure.',
      'The estimate needs a visible consequence, not just a technical incident.'
    );
  }
  if (!selectedRisks.length) {
    addSuggestion(
      'Keep at least one risk in scope',
      'Select the risks that clearly belong in the same event path before you estimate.',
      'A scenario without scoped risks usually becomes too abstract to defend.'
    );
  } else if (tooBroadScope) {
    addSuggestion(
      'Narrow the scope before estimating',
      'Remove risks that do not belong in the same event path or management discussion.',
      'Too many linked issues make the output harder to interpret and defend.'
    );
  }
  if (!scenarioGeographies.length) {
    addSuggestion(
      'Anchor the geography',
      'Select the relevant country or region so regulations and benchmarks are less generic.',
      'Geography changes both the regulatory read and the cost context.'
    );
  }
  if (weakEvidence) {
    addSuggestion(
      'Ground one weak assumption with evidence',
      'Add one directly relevant source, operating note, or internal reference before estimating.',
      'A small amount of better evidence often improves the range more than more wording does.'
    );
  }
  if (weakAssumptions && suggestions.length < 4) {
    addSuggestion(
      'Reduce inferred assumptions',
      'Turn the weakest inferred assumption into a sourced statement or explicitly tighten the wording around it.',
      'Too many inferred assumptions weaken confidence even when the narrative sounds good.'
    );
  }

  let score = 0;
  if (narrative) score += 20;
  if (!tooVague && wordCount >= 18) score += 15;
  if (assetPresent) score += 12;
  if (causePresent) score += 12;
  if (impactPresent) score += 12;
  if (selectedRisks.length) score += 10;
  if (!tooBroadScope) score += 8;
  if (scenarioGeographies.length) score += 5;
  if (!weakEvidence) score += 6;
  if (!weakAssumptions) score += 5;
  score = Math.max(0, Math.min(100, score));

  const tone = score >= 80 ? 'success' : score >= 55 ? 'warning' : 'neutral';
  const status = score >= 80
    ? 'Ready to estimate'
    : score >= 55
      ? 'Needs one more pass'
      : 'Still too loose';
  const summary = score >= 80
    ? 'This scenario is coherent enough to estimate. Tighten only the most material weak point if it would change the range.'
    : score >= 55
      ? 'The scenario is close, but one or two scoped edits would make the estimate easier to defend.'
      : 'The scenario still needs clearer scope and specificity before the next step will feel reliable.';

  return {
    score,
    status,
    tone,
    summary,
    reasons: {
      wordCount,
      selectedRiskCount: selectedRisks.length,
      geographyCount: scenarioGeographies.length,
      evidenceCount: totalEvidenceCount
    },
    suggestions: suggestions.slice(0, 4)
  };
}

function renderScenarioQualityCoach(coach, {
  title = 'Scenario quality coach',
  subtitle = '',
  compact = false,
  lowEmphasis = false,
  disclosureTitle = 'Show coaching detail',
  className = ''
} = {}) {
  if (!coach || !Array.isArray(coach.suggestions)) return '';
  const visibleSuggestions = coach.suggestions.slice(0, compact ? 2 : 3);
  const hiddenSuggestions = coach.suggestions.slice(visibleSuggestions.length);
  const itemMarkup = item => `<article class="scenario-quality-coach__item">
    <div class="scenario-quality-coach__item-title">${escapeHtml(String(item.title || 'Quality suggestion'))}</div>
    <div class="scenario-quality-coach__item-copy"><strong>Do next:</strong> ${escapeHtml(String(item.action || 'Tighten the scenario before you estimate.'))}</div>
    ${item.why ? `<div class="scenario-quality-coach__item-copy"><strong>Why:</strong> ${escapeHtml(String(item.why))}</div>` : ''}
  </article>`;
  return `<div class="scenario-quality-coach ${compact ? 'scenario-quality-coach--compact' : ''} ${lowEmphasis ? 'scenario-quality-coach--quiet' : ''} ${className}".trim()>
    <div class="scenario-quality-coach__intro">
      <div>
        <div class="results-driver-label">${escapeHtml(String(title))}</div>
        ${subtitle ? `<div class="results-comparison-foot">${escapeHtml(String(subtitle))}</div>` : ''}
      </div>
      <div class="scenario-quality-coach__score">
        <span class="badge badge--${escapeHtml(String(coach.tone || 'neutral'))}">${escapeHtml(String(coach.status || 'Working'))}</span>
        <span class="scenario-quality-coach__score-value">${escapeHtml(String(coach.score || 0))}/100</span>
      </div>
    </div>
    <div class="scenario-quality-coach__summary">${escapeHtml(String(coach.summary || ''))}</div>
    <div class="scenario-quality-coach__meta">
      <span>${escapeHtml(String(coach.reasons?.wordCount || 0))} words</span>
      <span>${escapeHtml(String(coach.reasons?.selectedRiskCount || 0))} risk${coach.reasons?.selectedRiskCount === 1 ? '' : 's'} in scope</span>
      <span>${escapeHtml(String(coach.reasons?.geographyCount || 0))} geograph${coach.reasons?.geographyCount === 1 ? 'y' : 'ies'}</span>
      <span>${escapeHtml(String(coach.reasons?.evidenceCount || 0))} evidence item${coach.reasons?.evidenceCount === 1 ? '' : 's'}</span>
    </div>
    <div class="scenario-quality-coach__grid">${visibleSuggestions.map(itemMarkup).join('')}</div>
    ${hiddenSuggestions.length ? `<details class="results-detail-disclosure scenario-quality-coach__details">
      <summary>${escapeHtml(String(disclosureTitle))}</summary>
      <div class="results-detail-disclosure-copy">Open this only when you want the longer coaching list behind the immediate fixes.</div>
      <div class="results-disclosure-stack">${hiddenSuggestions.map(itemMarkup).join('')}</div>
    </details>` : ''}
  </div>`;
}

function renderEvidenceGapActionPlan(plan = [], {
  title = 'Best evidence to collect next',
  subtitle = '',
  compact = false,
  lowEmphasis = false,
  disclosureTitle = 'Show full evidence plan',
  className = ''
} = {}) {
  const items = Array.isArray(plan) ? plan.filter(Boolean) : [];
  if (!items.length) return '';
  const visibleItems = items.slice(0, 3);
  const hiddenItems = items.slice(3);
  const itemMarkup = item => `<article class="evidence-gap-plan__item">
    <div class="evidence-gap-plan__head">
      <div>
        <div class="evidence-gap-plan__title">${escapeHtml(String(item.title || 'Evidence gap'))}</div>
        <div class="evidence-gap-plan__meta">${escapeHtml(String(item.area || 'Scenario evidence'))}</div>
      </div>
      ${item.owner ? `<span class="badge badge--neutral">${escapeHtml(String(item.owner))}</span>` : ''}
    </div>
    <div class="evidence-gap-plan__copy"><strong>Why it matters:</strong> ${escapeHtml(String(item.why || 'This still affects the confidence of the result.'))}</div>
    <div class="evidence-gap-plan__copy"><strong>Collect next:</strong> ${escapeHtml(String(item.collect || 'Add the most direct evidence available for this assumption.'))}</div>
    ${item.improves ? `<div class="evidence-gap-plan__impact">${escapeHtml(String(item.improves))}</div>` : ''}
  </article>`;
  return `<div class="evidence-gap-plan ${compact ? 'evidence-gap-plan--compact' : ''} ${lowEmphasis ? 'evidence-gap-plan--quiet' : ''} ${className}".trim()>
    <div class="evidence-gap-plan__intro">
      <div>
        <div class="results-driver-label">${escapeHtml(String(title))}</div>
        ${subtitle ? `<div class="results-comparison-foot">${escapeHtml(String(subtitle))}</div>` : ''}
      </div>
      <span class="badge badge--neutral">${visibleItems.length} priority gap${visibleItems.length === 1 ? '' : 's'}</span>
    </div>
    <div class="evidence-gap-plan__grid">${visibleItems.map(itemMarkup).join('')}</div>
    ${hiddenItems.length ? `<details class="results-detail-disclosure evidence-gap-plan__details">
      <summary>${escapeHtml(String(disclosureTitle))}</summary>
      <div class="results-detail-disclosure-copy">Use this only when you want the longer challenge list behind the immediate evidence priorities.</div>
      <div class="results-disclosure-stack">${hiddenItems.map(itemMarkup).join('')}</div>
    </details>` : ''}
  </div>`;
}

function buildParameterChallengeEntries({
  technicalInputs = {},
  inputAssignments = [],
  confidence = null,
  missingInformation = [],
  citations = [],
  primaryGrounding = [],
  supportingReferences = [],
  assumptions = [],
  comparison = null
} = {}) {
  const assignmentList = Array.isArray(inputAssignments) ? inputAssignments.filter(Boolean) : [];
  const assumptionList = Array.isArray(assumptions) ? assumptions.filter(Boolean) : [];
  const missingList = Array.isArray(missingInformation) ? missingInformation.filter(Boolean) : [];
  const citationList = Array.isArray(citations) ? citations.filter(Boolean) : [];
  const groundingList = Array.isArray(primaryGrounding) ? primaryGrounding.filter(Boolean) : [];
  const supportingList = Array.isArray(supportingReferences) ? supportingReferences.filter(Boolean) : [];
  const assignmentById = new Map(assignmentList.map(item => [String(item.id || '').trim(), item]));
  const assignmentByLabel = new Map(assignmentList.map(item => [String(item.label || '').trim().toLowerCase(), item]));
  const confidenceWeakness = Array.isArray(confidence?.improvements) ? confidence.improvements.filter(Boolean) : [];
  const confidenceReasons = Array.isArray(confidence?.reasons) ? confidence.reasons.filter(Boolean) : [];
  const confidenceSummary = String(confidence?.summary || '').trim();
  const findAssignment = (...keys) => {
    for (const key of keys) {
      const normalised = String(key || '').trim();
      if (!normalised) continue;
      if (assignmentById.has(normalised)) return assignmentById.get(normalised);
      if (assignmentByLabel.has(normalised.toLowerCase())) return assignmentByLabel.get(normalised.toLowerCase());
    }
    return null;
  };
  const pickEvidenceSupport = (...needles) => {
    const pattern = new RegExp(needles.filter(Boolean).join('|'), 'i');
    const support = [];
    const addSupport = value => {
      const text = typeof value === 'string'
        ? value
        : (value?.title || value?.label || value?.sourceTitle || value?.relevanceReason || '');
      const trimmed = String(text || '').trim();
      if (!trimmed || support.includes(trimmed)) return;
      support.push(trimmed);
    };
    groundingList.forEach(item => { if (!needles.length || pattern.test(String(item))) addSupport(item); });
    supportingList.forEach(item => { if (!needles.length || pattern.test(String(item?.title || item?.sourceTitle || item?.relevanceReason || item))) addSupport(item); });
    citationList.forEach(item => { if (!needles.length || pattern.test(String(item?.title || item?.relevanceReason || item?.excerpt || ''))) addSupport(item); });
    return support.slice(0, 3);
  };
  const pickAssumptions = (...needles) => {
    const pattern = new RegExp(needles.filter(Boolean).join('|'), 'i');
    return assumptionList
      .map(item => String(item?.text || item || '').trim())
      .filter(Boolean)
      .filter(item => !needles.length || pattern.test(item))
      .slice(0, 2);
  };
  const buildEntry = ({
    id,
    title,
    currentValue,
    assignment = null,
    support = [],
    weakens = [],
    raise,
    lower
  }) => {
    const cleanedSupport = support.filter(Boolean).slice(0, 3);
    const cleanedWeakens = weakens.filter(Boolean).slice(0, 3);
    return {
      id,
      title,
      currentValue,
      sourceBasis: assignment
        ? `${assignment.origin || 'Saved input'}${assignment.sourceTypeLabel ? ` · ${assignment.sourceTypeLabel}` : ''}${assignment.reason ? ` · ${assignment.reason}` : ''}`
        : 'This parameter is using the currently saved model inputs.',
      support: cleanedSupport.length ? cleanedSupport : ['No direct supporting reference has been attached to this parameter yet.'],
      weakensConfidence: cleanedWeakens.length ? cleanedWeakens : ['No specific weakness is recorded for this parameter yet, so use general confidence posture and assumptions when you challenge it.'],
      raiseJustification: raise,
      lowerJustification: lower
    };
  };

  const entries = [];
  const eventFrequencyAssignment = findAssignment('event-frequency', 'Event frequency');
  entries.push(buildEntry({
    id: 'event-frequency',
    title: 'Event frequency',
    currentValue: `${technicalInputs.tefMin ?? '—'}–${technicalInputs.tefLikely ?? '—'}–${technicalInputs.tefMax ?? '—'} events/year`,
    assignment: eventFrequencyAssignment,
    support: [
      eventFrequencyAssignment?.reason,
      ...pickEvidenceSupport('frequency', 'incident', 'history', 'event'),
      ...pickAssumptions('Frequency', 'incident', 'year')
    ],
    weakens: [
      ...missingList.filter(item => /frequency|incident|history|internal/i.test(String(item))),
      ...confidenceWeakness.filter(item => /frequency|incident/i.test(String(item))),
      ...confidenceReasons.filter(item => /frequency range/i.test(String(item))),
      confidenceSummary
    ],
    raise: 'Raise this only if internal incident history, threat activity, or control drift shows the event path is more common than the current working case.',
    lower: 'Lower this only if operating evidence shows the triggering conditions are rarer, better contained, or no longer relevant at the current cadence.'
  }));
  const successAssignment = findAssignment('threat-capability', 'Threat capability');
  const controlAssignment = findAssignment('control-strength', 'Control strength');
  entries.push(buildEntry({
    id: 'event-success',
    title: 'Event success likelihood',
    currentValue: technicalInputs.vulnDirect
      ? `${technicalInputs.vulnMin ?? '—'}–${technicalInputs.vulnLikely ?? '—'}–${technicalInputs.vulnMax ?? '—'} direct exposure`
      : `Threat ${technicalInputs.threatCapMin ?? '—'}–${technicalInputs.threatCapLikely ?? '—'}–${technicalInputs.threatCapMax ?? '—'} vs control ${technicalInputs.controlStrMin ?? '—'}–${technicalInputs.controlStrLikely ?? '—'}–${technicalInputs.controlStrMax ?? '—'}`,
    assignment: controlAssignment || successAssignment,
    support: [
      successAssignment?.reason,
      controlAssignment?.reason,
      ...pickEvidenceSupport('control', 'threat', 'access', 'response', 'capability'),
      ...pickAssumptions('Exposure', 'Threat', 'control')
    ],
    weakens: [
      ...missingList.filter(item => /control|response|access|security|capability|evidence/i.test(String(item))),
      ...confidenceWeakness.filter(item => /control|response|evidence/i.test(String(item))),
      ...confidenceReasons.filter(item => /AI-assisted|control strength/i.test(String(item)))
    ],
    raise: 'Raise this only if control testing, incident response evidence, or attacker capability evidence shows the current controls are less effective than assumed.',
    lower: 'Lower this only if control strength, detection, containment, or resilience evidence shows attempted events are less likely to become successful loss events.'
  }));
  const biAssignment = findAssignment('business-interruption', 'Business interruption');
  entries.push(buildEntry({
    id: 'business-interruption',
    title: 'Business interruption',
    currentValue: `${fmtCurrency(technicalInputs.biMin || 0)}–${fmtCurrency(technicalInputs.biLikely || 0)}–${fmtCurrency(technicalInputs.biMax || 0)}`,
    assignment: biAssignment,
    support: [
      biAssignment?.reason,
      ...pickEvidenceSupport('business interruption', 'outage', 'service', 'recovery', 'downtime'),
      ...pickAssumptions('Loss', 'service', 'impact')
    ],
    weakens: [
      ...missingList.filter(item => /business|disruption|outage|recovery|service/i.test(String(item))),
      ...confidenceWeakness.filter(item => /loss ranges|operations|finance/i.test(String(item))),
      ...confidenceReasons.filter(item => /loss ranges/i.test(String(item)))
    ],
    raise: 'Raise this only if outage evidence, recovery sequencing, customer harm, or service dependency analysis shows the disruption would last longer or hit harder than currently assumed.',
    lower: 'Lower this only if recovery evidence, resilience controls, or service continuity planning shows the operational disruption would be shorter or less severe.'
  }));
  const rlAssignment = findAssignment('regulatory-legal', 'Regulatory and legal');
  entries.push(buildEntry({
    id: 'regulatory-legal',
    title: 'Regulatory and legal impact',
    currentValue: `${fmtCurrency(technicalInputs.rlMin || 0)}–${fmtCurrency(technicalInputs.rlLikely || 0)}–${fmtCurrency(technicalInputs.rlMax || 0)}`,
    assignment: rlAssignment,
    support: [
      rlAssignment?.reason,
      ...pickEvidenceSupport('regulat', 'legal', 'privacy', 'compliance', 'contract'),
      ...pickAssumptions('Regulatory', 'legal')
    ],
    weakens: [
      ...missingList.filter(item => /regulat|legal|privacy|compliance|contract|obligation/i.test(String(item))),
      ...confidenceWeakness.filter(item => /evidence|references/i.test(String(item))),
      confidenceSummary
    ],
    raise: 'Raise this only if counsel input, notification obligations, contract penalties, or regulatory exposure suggests the severe tail is materially larger than the current case.',
    lower: 'Lower this only if the applicable obligations are narrower, notification consequences are lighter, or contractual downside is better bounded than assumed.'
  }));
  if (comparison) {
    entries.push(buildEntry({
      id: 'treatment-delta',
      title: 'Treatment delta',
      currentValue: `${comparison.severeEvent.formatted} severe-event delta`,
      assignment: null,
      support: [
        comparison.treatmentNarrative,
        comparison.keyDriver,
        comparison.secondaryDriver
      ],
      weakens: [
        comparison.caveat,
        ...missingList.slice(0, 2)
      ],
      raise: 'Treat the treatment as more effective only if the changed controls, recovery steps, or resilience assumptions are realistic enough to hold in practice.',
      lower: 'Treat the treatment as less effective if the improved-state assumptions are optimistic, weakly evidenced, or not yet validated by the owning team.'
    }));
  }

  return entries.slice(0, comparison ? 5 : 4);
}

function renderParameterChallengePanel(entries = [], {
  title = 'Challenge a key parameter',
  subtitle = '',
  disclosureTitle = 'Open the challenge detail'
} = {}) {
  const items = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!items.length) return '';
  return `<section class="results-section-stack">
    <div class="results-section-heading">${escapeHtml(String(title))}</div>
    ${subtitle ? `<div class="results-detail-disclosure-copy">${escapeHtml(String(subtitle))}</div>` : ''}
    <div class="results-parameter-challenge-grid">
      ${items.map(item => `<details class="results-parameter-challenge-card">
        <summary>
          <div class="results-parameter-challenge-card__summary">
            <div>
              <div class="results-driver-label">${escapeHtml(String(item.title || 'Parameter'))}</div>
              <strong>${escapeHtml(String(item.currentValue || 'Current value not recorded'))}</strong>
            </div>
            <span class="badge badge--neutral">${escapeHtml(String(disclosureTitle))}</span>
          </div>
        </summary>
        <div class="results-parameter-challenge-card__body">
          <div class="results-parameter-challenge-card__row">
            <span>Current source basis</span>
            <p>${escapeHtml(formatSourceBasisSummary(item.sourceBasis) || 'No source basis recorded yet.')}</p>
          </div>
          <div class="results-parameter-challenge-card__row">
            <span>What supports it</span>
            <p>${item.support.map(value => `• ${escapeHtml(String(value))}`).join('<br>')}</p>
          </div>
          <div class="results-parameter-challenge-card__row">
            <span>What weakens confidence</span>
            <p>${item.weakensConfidence.map(value => `• ${escapeHtml(String(value))}`).join('<br>')}</p>
          </div>
          <div class="results-parameter-challenge-card__row">
            <span>What would justify raising it</span>
            <p>${escapeHtml(String(item.raiseJustification || 'Raise only when the direct evidence points clearly upward.'))}</p>
          </div>
          <div class="results-parameter-challenge-card__row">
            <span>What would justify lowering it</span>
            <p>${escapeHtml(String(item.lowerJustification || 'Lower only when the direct evidence points clearly downward.'))}</p>
          </div>
        </div>
      </details>`).join('')}
    </div>
  </section>`;
}


function renderScenarioAssistSummaryBlock({ workflowGuidance = [], confidenceLabel = '', evidenceQuality = '', evidenceSummary = '', missingInformation = [], benchmarkBasis = '', inputProvenance = [], citations = [] } = {}) {
  const guidance = Array.isArray(workflowGuidance) ? workflowGuidance.filter(Boolean).slice(0, 2) : [];
  const topInputs = Array.isArray(inputProvenance) ? inputProvenance.filter(Boolean).slice(0, 2) : [];
  const topSources = normaliseCitations(citations).slice(0, 3);
  if (!guidance.length && !confidenceLabel && !evidenceQuality && !evidenceSummary && !(missingInformation || []).length && !benchmarkBasis && !topInputs.length && !topSources.length) return '';
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">AI draft summary</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-4);margin-top:var(--sp-3)">
      ${guidance.length ? `<div><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">What to check next</div><div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-3)">${guidance.map((item, idx) => `<div style="display:flex;gap:var(--sp-3);align-items:flex-start"><span class="badge badge--gold" style="min-width:24px;justify-content:center">${idx + 1}</span><div class="context-panel-copy" style="margin:0">${escapeHtml(String(item))}</div></div>`).join('')}</div></div>` : ''}
      ${(confidenceLabel || evidenceQuality || evidenceSummary) ? `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">${confidenceLabel || evidenceQuality ? `<div class="citation-chips"><span class="badge badge--neutral">${escapeHtml(confidenceLabel || 'AI confidence not stated')}</span>${evidenceQuality ? `<span class="badge badge--gold">${escapeHtml(evidenceQuality)}</span>` : ''}</div>` : ''}${evidenceSummary ? `<p class="context-panel-copy" style="margin-top:${confidenceLabel || evidenceQuality ? '10px' : '0'}">${escapeHtml(String(evidenceSummary))}</p>` : ''}${(missingInformation || []).length ? `<div class="form-help" style="margin-top:8px">Best next evidence: ${escapeHtml(String(missingInformation[0]))}</div>` : ''}</div>` : ''}
      ${benchmarkBasis ? `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Benchmark approach</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(truncateText(benchmarkBasis, 220))}</div></div>` : ''}
      ${topInputs.length ? `<div><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Main number drivers</div><div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-3)">${topInputs.map(item => `<div style="background:var(--bg-elevated);padding:var(--sp-3);border-radius:var(--radius-md)"><div style="font-size:.82rem;font-weight:600;color:var(--text-primary)">${escapeHtml(String(item.label || 'Input'))}</div><div class="form-help" style="margin-top:4px">${escapeHtml(String(item.origin || 'Inference'))}${item.scope ? ` · ${escapeHtml(String(item.scope))}` : ''}${item.lastUpdated ? ` · ${escapeHtml(String(item.lastUpdated))}` : ''}</div></div>`).join('')}</div></div>` : ''}
      ${topSources.length ? `<div><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Top references used</div><div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-3)">${topSources.map(source => `<div style="background:var(--bg-elevated);padding:var(--sp-3);border-radius:var(--radius-md)"><div style="font-size:.82rem;font-weight:600;color:var(--text-primary)">${escapeHtml(String(source.title || 'Untitled source'))}</div>${source.relevanceReason ? `<div class="form-help" style="margin-top:4px">${escapeHtml(String(source.relevanceReason))}</div>` : ''}</div>`).join('')}</div></div>` : ''}
    </div>
  </div>`;
}

function averageRange(min, likely, max) {
  const values = [min, likely, max].map(Number).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateRelativeRange(min, likely, max) {
  const mn = Number(min);
  const lk = Number(likely);
  const mx = Number(max);
  if (![mn, lk, mx].every(Number.isFinite)) return 1;
  const baseline = Math.max(Math.abs(lk), 1);
  return Math.max(0, (mx - mn) / baseline);
}

function buildAssessmentConfidence(draft, results, modelInputs, scenarioMeta) {
  let score = 58;
  const citations = Array.isArray(draft.citations) ? draft.citations.length : 0;
  const selectedRisks = Array.isArray(draft.selectedRisks) ? draft.selectedRisks.length : 0;
  const hasStructuredScenario = !!draft.structuredScenario;
  const aiAssisted = !!draft.llmAssisted;
  const tefRange = calculateRelativeRange(modelInputs.tefMin, modelInputs.tefLikely, modelInputs.tefMax);
  const lossLikely = ['irLikely','biLikely','dbLikely','rlLikely','tpLikely','rcLikely'].reduce((sum, key) => sum + Number(modelInputs[key] || 0), 0);
  const lossMin = ['irMin','biMin','dbMin','rlMin','tpMin','rcMin'].reduce((sum, key) => sum + Number(modelInputs[key] || 0), 0);
  const lossMax = ['irMax','biMax','dbMax','rlMax','tpMax','rcMax'].reduce((sum, key) => sum + Number(modelInputs[key] || 0), 0);
  const lossRange = calculateRelativeRange(lossMin, lossLikely, lossMax);
  const reasons = [];
  const improvements = [];

  if (hasStructuredScenario) { score += 8; reasons.push('The scenario has been structured into asset, threat, attack type, and effect.'); }
  else improvements.push('Capture a more structured scenario definition so the estimate is anchored to one clear event path.');

  if (citations >= 2) { score += 8; reasons.push('Internal citations or source material are linked to the assessment.'); }
  else improvements.push('Add internal documents, incident evidence, or control references to strengthen the basis for the numbers.');

  if (selectedRisks >= 2) { score += 4; reasons.push('The scenario scope has been linked to multiple selected risks rather than a single generic risk statement.'); }

  if (aiAssisted) { score -= 4; reasons.push('Some starting values were AI-assisted, so they should still be treated as analyst-reviewed assumptions rather than facts.'); }

  if (tefRange <= 1.5) { score += 8; reasons.push('The event-frequency range is reasonably tight, which improves confidence in the annual view.'); }
  else { score -= 10; improvements.push('Tighten the event-frequency range using internal incident history or SME input.'); }

  if (lossRange <= 2.5) { score += 8; reasons.push('The loss ranges are not excessively wide, which makes the result more decision-useful.'); }
  else { score -= 12; improvements.push('Narrow the loss ranges, especially business interruption and response cost, with finance or operations input.'); }

  if (scenarioMeta?.linked) {
    score -= 4;
    reasons.push('This is a linked multi-risk scenario, so combined uplift adds more uncertainty than a single isolated scenario.');
  }

  if (results?.iterations >= 10000) score += 2;

  score = Math.max(18, Math.min(92, score));
  let label = 'Moderate confidence';
  if (score >= 75) label = 'High confidence';
  else if (score <= 44) label = 'Low confidence';

  const summary = label === 'High confidence'
    ? 'This assessment is well formed for decision support, although it is still based on modelled ranges rather than certainty.'
    : label === 'Low confidence'
      ? 'This result is directionally useful, but the ranges and evidence base are still too loose for strong decision-making.'
      : 'This assessment is useful for management discussion, but some assumptions still need tightening before stronger reliance.';

  return {
    score,
    label,
    summary,
    reasons: reasons.slice(0, 4),
    improvements: improvements.slice(0, 3)
  };
}

function buildAssessmentAssumptions(draft, results, modelInputs, scenarioMeta) {
  const assumptions = [];
  const geography = draft.geography || 'the selected geography';
  const asset = draft.structuredScenario?.assetService || 'the affected service';
  const threatCommunity = draft.structuredScenario?.threatCommunity || 'the relevant threat actor set';
  assumptions.push({ category: 'Scenario', text: `Assumes ${asset} remains the main point of impact across ${geography}.` });
  assumptions.push({ category: 'Threat', text: `Assumes ${threatCommunity} remains a realistic source of this scenario during the assessment period.` });
  assumptions.push({ category: 'Frequency', text: `Assumes the event could occur between ${modelInputs.tefMin ?? '—'} and ${modelInputs.tefMax ?? '—'} times per year, with ${modelInputs.tefLikely ?? '—'} as the working case after any linked-scenario uplift.` });
  if (modelInputs.vulnDirect) assumptions.push({ category: 'Exposure', text: `Assumes direct event success remains within the stated exposure range rather than changing materially because of control drift or attacker capability changes.` });
  else assumptions.push({ category: 'Exposure', text: `Assumes current control strength and attacker capability are reasonably represented by the selected FAIR ranges.` });
  assumptions.push({ category: 'Loss', text: `Assumes business interruption, response, legal, data, third-party, and reputation impacts can be represented as per-event ranges rather than one fixed value.` });
  if (scenarioMeta?.linked) assumptions.push({ category: 'Portfolio', text: 'Assumes the selected linked risks can escalate together and justify the applied scenario uplift in frequency and loss.' });
  if (Array.isArray(draft.applicableRegulations) && draft.applicableRegulations.length) assumptions.push({ category: 'Regulatory', text: `Assumes the currently selected regulatory set remains the most relevant set for this scenario: ${draft.applicableRegulations.slice(0, 4).join(', ')}${draft.applicableRegulations.length > 4 ? ' and others' : ''}.` });
  return assumptions.slice(0, 6);
}

function buildAssessmentDrivers(draft, results, modelInputs) {
  const upward = [];
  const stabilisers = [];
  const sensitivity = [];
  const uncertainty = [];
  const lossDrivers = [
    ['Business interruption', averageRange(modelInputs.biMin, modelInputs.biLikely, modelInputs.biMax)],
    ['Response and recovery', averageRange(modelInputs.irMin, modelInputs.irLikely, modelInputs.irMax)],
    ['Reputation and contract', averageRange(modelInputs.rcMin, modelInputs.rcLikely, modelInputs.rcMax)],
    ['Regulatory and legal', averageRange(modelInputs.rlMin, modelInputs.rlLikely, modelInputs.rlMax)],
    ['Data remediation', averageRange(modelInputs.dbMin, modelInputs.dbLikely, modelInputs.dbMax)],
    ['Third-party impact', averageRange(modelInputs.tpMin, modelInputs.tpLikely, modelInputs.tpMax)]
  ].sort((a, b) => b[1] - a[1]);

  if ((modelInputs.tefLikely || 0) >= 3) upward.push(`Threat frequency is materially lifting annual exposure because the working case assumes about ${modelInputs.tefLikely} events per year.`);
  if ((modelInputs.controlStrLikely ?? 1) <= 0.55) upward.push('Control strength is a major driver upward because the current controls are not strong enough to suppress event success consistently.');
  if (lossDrivers[0]?.[1] > 0) upward.push(`${lossDrivers[0][0]} is one of the biggest cost drivers in the current scenario.`);
  if (lossDrivers[1]?.[1] > 0) upward.push(`${lossDrivers[1][0]} is also materially contributing to the modelled loss range.`);
  if (modelInputs.secondaryEnabled) upward.push('Secondary loss is enabled, which increases the tail of the loss distribution.');
  if (results?.portfolioMeta?.linked) upward.push('Linked-risk uplift is increasing both frequency and loss because the scenario is being treated as connected rather than isolated.');

  if ((modelInputs.controlStrLikely ?? 0) >= 0.7) stabilisers.push('Current control strength is helping contain the scenario and reduce success likelihood.');
  if ((modelInputs.tefLikely || 0) <= 1) stabilisers.push('The working frequency assumption is relatively low, which helps contain annual exposure.');
  if (!modelInputs.secondaryEnabled) stabilisers.push('Secondary loss is disabled, so the model is not adding a follow-on loss tail beyond the primary event.');
  if ((modelInputs.rlLikely || 0) < (modelInputs.biLikely || 0)) stabilisers.push('Regulatory and legal costs are not the dominant driver in the current estimate.');

  sensitivity.push({ label: 'Event frequency', why: `The working case assumes about ${modelInputs.tefLikely || 0} events per year, so frequency is a direct multiplier on annual loss.` });
  sensitivity.push({ label: 'Event success likelihood', why: modelInputs.vulnDirect ? 'Direct exposure values determine how often attempts become successful loss events.' : 'Threat capability versus control strength determines how often attempted events convert into loss.' });
  if (lossDrivers[0]?.[1] > 0) sensitivity.push({ label: lossDrivers[0][0], why: `${lossDrivers[0][0]} is one of the largest per-event cost components in the current estimate.` });
  if (lossDrivers[1]?.[1] > 0) sensitivity.push({ label: lossDrivers[1][0], why: `${lossDrivers[1][0]} is also materially influencing the event-loss range.` });

  const rangeSpread = (minValue, maxValue) => Math.max(0, Number(maxValue || 0) - Number(minValue || 0));
  const uncertaintyCandidates = [
    {
      label: 'Event frequency range',
      spread: rangeSpread(modelInputs.tefMin, modelInputs.tefMax),
      why: `The event-frequency range spans from ${modelInputs.tefMin ?? '—'} to ${modelInputs.tefMax ?? '—'} events per year, so annual exposure can still move materially.`
    },
    {
      label: 'Control effectiveness range',
      spread: rangeSpread(modelInputs.controlStrMin, modelInputs.controlStrMax),
      why: `The control-strength range spans from ${modelInputs.controlStrMin ?? '—'} to ${modelInputs.controlStrMax ?? '—'}, so event success still depends heavily on judgement rather than hard evidence.`
    },
    {
      label: 'Business interruption range',
      spread: rangeSpread(modelInputs.biMin, modelInputs.biMax),
      why: `Business interruption ranges from ${fmtCurrency(modelInputs.biMin || 0)} to ${fmtCurrency(modelInputs.biMax || 0)}, making service-restoration assumptions one of the biggest uncertainty levers.`
    },
    {
      label: 'Reputation and contract range',
      spread: rangeSpread(modelInputs.rcMin, modelInputs.rcMax),
      why: `Reputation and contract costs range from ${fmtCurrency(modelInputs.rcMin || 0)} to ${fmtCurrency(modelInputs.rcMax || 0)}, so downstream commercial impact is still broad.`
    }
  ]
    .filter(item => item.spread > 0)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3);
  uncertainty.push(...uncertaintyCandidates);

  return {
    upward: upward.slice(0, 4),
    stabilisers: stabilisers.slice(0, 3),
    sensitivity: sensitivity.slice(0, 3),
    uncertainty
  };
}

function buildAssessmentIntelligence(draft, results, modelInputs, scenarioMeta) {
  return {
    confidence: buildAssessmentConfidence(draft, results, modelInputs, scenarioMeta),
    assumptions: buildAssessmentAssumptions(draft, results, modelInputs, scenarioMeta),
    drivers: buildAssessmentDrivers(draft, results, modelInputs)
  };
}

function renderAssessmentConfidenceBlock(confidence) {
  if (!confidence) return '';
  const badgeClass = confidence.label === 'High confidence' ? 'badge--success' : confidence.label === 'Low confidence' ? 'badge--danger' : 'badge--warning';
  return `<div class="results-decision-card">
    <div class="results-section-heading">How confident to be in this assessment</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap">
      <span class="badge ${badgeClass}">${confidence.label}</span>
      <strong style="font-family:var(--font-display);font-size:var(--text-lg);color:var(--text-primary)">${confidence.score}/100</strong>
    </div>
    <p class="results-decision-copy" style="margin-top:var(--sp-3)">${confidence.summary}</p>
    ${confidence.reasons?.length ? `<div class="results-decision-row"><span class="results-decision-label">Why it scored this way</span><div class="results-decision-copy">${confidence.reasons.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    ${confidence.improvements?.length ? `<div class="results-decision-row"><span class="results-decision-label">What would improve confidence</span><div class="results-decision-copy">${confidence.improvements.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
  </div>`;
}

function renderAssessmentDriversBlock(drivers) {
  if (!drivers) return '';
  return `<div class="results-summary-card">
    <div class="results-section-heading">What is pushing the result up or down</div>
    ${drivers.upward?.length ? `<div class="results-driver-group"><div class="results-driver-label">Main upward drivers</div><div class="results-summary-copy">${drivers.upward.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    ${drivers.stabilisers?.length ? `<div class="results-driver-group" style="margin-top:var(--sp-4)"><div class="results-driver-label">Main stabilisers</div><div class="results-summary-copy">${drivers.stabilisers.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
  </div>`;
}

function renderExecutiveDriversSummary(drivers, assessment) {
  const upward = Array.isArray(drivers?.upward) ? drivers.upward.slice(0, 3) : [];
  const stabilisers = Array.isArray(drivers?.stabilisers) ? drivers.stabilisers.slice(0, 2) : [];
  const risks = Array.isArray(assessment?.selectedRisks) ? assessment.selectedRisks : [];
  const regulations = Array.isArray(assessment?.applicableRegulations) ? assessment.applicableRegulations.slice(0, 4) : [];
  return `<div class="results-summary-card">
    <div class="results-section-heading">What changed the result most</div>
    ${upward.length ? `<div class="results-driver-group"><div class="results-driver-label">Main upward drivers</div><div class="results-summary-copy">${upward.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    ${stabilisers.length ? `<div class="results-driver-group" style="margin-top:var(--sp-4)"><div class="results-driver-label">Main stabilisers</div><div class="results-summary-copy">${stabilisers.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    <div class="results-driver-group" style="margin-top:var(--sp-4)">
      <div class="results-driver-label">Scenario scope</div>
      <div class="results-chip-block">${risks.length ? risks.map(risk => `<span class="badge badge--gold">${risk.title}</span>`).join('') : '<span class="badge badge--neutral">No linked risks selected</span>'}</div>
      ${regulations.length ? `<div class="results-chip-block">${regulations.map(tag => `<span class="badge badge--neutral">${tag}</span>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function renderAssessmentChallengeBlock(challenge) {
  if (!challenge) return '';
  return `<div class="results-summary-card">
    <div class="results-section-heading">Challenge and validate this assessment</div>
    <div class="results-chip-block">
      <span class="badge badge--warning">${challenge.challengeLevel || 'Challenge review'}</span>
      ${challenge.confidenceLabel ? `<span class="badge badge--neutral">${challenge.confidenceLabel}</span>` : ''}
      ${challenge.evidenceQuality ? `<span class="badge badge--gold">${challenge.evidenceQuality}</span>` : ''}
    </div>
    ${challenge.summary ? `<p class="results-summary-copy" style="margin-top:var(--sp-3)">${challenge.summary}</p>` : ''}
    ${challenge.weakestAssumptions?.length ? `<div class="results-driver-group"><div class="results-driver-label">Weakest assumptions</div><div class="results-summary-copy">${challenge.weakestAssumptions.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    ${challenge.committeeQuestions?.length ? `<div class="results-driver-group" style="margin-top:var(--sp-4)"><div class="results-driver-label">What a risk committee would ask</div><div class="results-summary-copy">${challenge.committeeQuestions.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    ${challenge.evidenceToGather?.length ? `<div class="results-driver-group" style="margin-top:var(--sp-4)"><div class="results-driver-label">Evidence to gather next</div><div class="results-summary-copy">${challenge.evidenceToGather.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
    ${challenge.reviewerGuidance?.length ? `<div class="results-driver-group" style="margin-top:var(--sp-4)"><div class="results-driver-label">Reviewer guidance</div><div class="results-summary-copy">${challenge.reviewerGuidance.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
  </div>`;
}

function cleanExecutiveNarrativeText(value) {
  return ReportPresentation.cleanExecutiveNarrativeText(value);
}

function buildExecutiveScenarioSummary(assessment) {
  return ReportPresentation.buildExecutiveScenarioSummary(assessment);
}

function buildExecutiveDecisionSupport(assessment, results, intelligence) {
  return ReportPresentation.buildExecutiveDecisionSupport(assessment, results, intelligence);
}

function formatComparisonDelta(currentValue, baselineValue, formatter = fmtCurrency) {
  const current = Number(currentValue || 0);
  const baseline = Number(baselineValue || 0);
  const delta = current - baseline;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const label = delta > 0 ? 'Higher' : delta < 0 ? 'Lower' : 'No change';
  return {
    direction,
    label,
    formatted: `${label} by ${formatter(Math.abs(delta))}`
  };
}



function renderLogin() {
  const currentUser = AuthService.getCurrentUser();
  if (currentUser) {
    if (userNeedsOrganisationSelection(currentUser)) {
      renderLoginOrganisationSelection(currentUser);
      return;
    }
    Router.navigate(getDefaultRouteForCurrentUser());
    return;
  }
  setPage(`
    <main class="page">
      <div class="container container--narrow" style="padding:var(--sp-16) var(--sp-6);max-width:640px">
        <div class="banner banner--poc mb-6"><span class="banner-icon">⚠</span><span class="banner-text"><strong>PoC Security:</strong> Shared team credentials only. Replace with Microsoft Entra ID before production. [ENTRA-INTEGRATION]</span></div>
        <div class="card card--elevated">
          <h2 style="margin-bottom:var(--sp-2)">Sign In</h2>
          <p style="margin-bottom:var(--sp-6);color:var(--text-muted)">Each user keeps their own draft state, saved assessments, and assigned BU/function context. Ask the global admin for your username and password.</p>
          <form id="login-form">
            <div class="form-group mb-4">
              <label class="form-label" for="login-user">Username</label>
              <input class="form-input" id="login-user" type="text" placeholder="Enter username" autocomplete="username">
            </div>
            <div class="form-group mb-4">
              <label class="form-label" for="login-pass">Password</label>
              <input class="form-input" id="login-pass" type="password" placeholder="Enter password" autocomplete="current-password">
              <span class="form-error hidden" id="login-err">⚠ Invalid username or password</span>
            </div>
            <button class="btn btn--primary w-full" id="btn-login" type="submit" style="justify-content:center">Sign In</button>
          </form>
        </div>
      </div>
    </main>`);

  const sessionNotice = AuthService.consumeSessionNotice();
  if (sessionNotice) {
    UI.toast(sessionNotice, 'warning', 5000);
  }

  const login = async () => {
    const username = document.getElementById('login-user').value;
    const pw = document.getElementById('login-pass').value;
    const result = await AuthService.login(username, pw);
    if (result.success) {
      await loadSharedUserState(result.user.username);
      activateAuthenticatedState();
      UI.toast(`Logged in as ${result.user.displayName}.`, 'success');
      if (userNeedsOrganisationSelection(AuthService.getCurrentUser())) {
        renderLogin();
      } else {
        Router.navigate(getDefaultRouteForCurrentUser());
      }
    }
    else {
      const loginMessage = /too many login attempts/i.test(String(result.error || ''))
        ? 'Too many login attempts. Please wait and try again.'
        : 'Invalid username or password';
      document.getElementById('login-err').textContent = `⚠ ${loginMessage}`;
      document.getElementById('login-err').classList.remove('hidden');
      document.getElementById('login-user').classList.add('error');
      document.getElementById('login-pass').classList.add('error');
    }
  };

  document.getElementById('login-form').addEventListener('submit', event => {
    event.preventDefault();
    login();
  });
  document.getElementById('btn-login').addEventListener('click', event => {
    event.preventDefault();
    login();
  });
}

function requireAdmin() {
  if (!requireAuth()) return false;
  if (!AuthService.isAdminAuthenticated()) { Router.navigate('/settings'); return false; }
  return true;
}

function withAuth(renderer) {
  return (params, hash) => {
    if (!requireAuth()) return;
    renderer(params, hash);
  };
}

function adminLayout(active, content, activeSettingsSection = 'org') {
  return `<div class="admin-shell">
    <nav class="admin-sidebar">
      <div class="admin-sidebar-head">
        <div class="admin-sidebar-kicker">Admin</div>
        <div class="admin-sidebar-title">Platform control</div>
      </div>
      <a href="#/admin/home" data-admin-route="/admin/home" class="admin-nav-link ${active==='home' ? 'active' : ''}">Overview</a>
      <div class="admin-nav-group-label">Setup</div>
      <a href="#/admin/settings/org" data-admin-route="/admin/settings/org" class="admin-nav-link ${active==='settings' && activeSettingsSection==='org' ? 'active' : ''}">Organisation Setup</a>
      <a href="#/admin/settings/company" data-admin-route="/admin/settings/company" class="admin-nav-link ${active==='settings' && activeSettingsSection==='company' ? 'active' : ''}">AI Company Builder</a>
      <a href="#/admin/settings/defaults" data-admin-route="/admin/settings/defaults" class="admin-nav-link ${active==='settings' && activeSettingsSection==='defaults' ? 'active' : ''}">Platform Defaults</a>
      <a href="#/admin/settings/governance" data-admin-route="/admin/settings/governance" class="admin-nav-link ${active==='settings' && activeSettingsSection==='governance' ? 'active' : ''}">Governance Inputs</a>
      <a href="#/admin/settings/access" data-admin-route="/admin/settings/access" class="admin-nav-link ${active==='settings' && activeSettingsSection==='access' ? 'active' : ''}">System Access</a>
      <a href="#/admin/settings/users" data-admin-route="/admin/settings/users" class="admin-nav-link ${active==='settings' && activeSettingsSection==='users' ? 'active' : ''}">User Accounts</a>
      <a href="#/admin/settings/audit" data-admin-route="/admin/settings/audit" class="admin-nav-link ${active==='settings' && activeSettingsSection==='audit' ? 'active' : ''}">Audit Log</a>
      <div class="admin-nav-group-label">Libraries</div>
      <a href="#/admin/bu" data-admin-route="/admin/bu" class="admin-nav-link ${active==='bu'?'active':''}">Org Customisation</a>
      <a href="#/admin/docs" data-admin-route="/admin/docs" class="admin-nav-link ${active==='docs'?'active':''}">Document Library</a>
      <div class="admin-sidebar-spacer"></div>
      <div class="admin-sidebar-foot">
        <div class="banner banner--poc admin-sidebar-banner">⚠ PoC — replace with Entra ID</div>
        <button class="btn btn--ghost btn--sm admin-logout-btn" id="btn-admin-logout">Sign Out</button>
      </div>
    </nav>
    <div class="admin-content-shell">${content}</div>
  </div>`;
}

function renderAdminHome() {
  if (!requireAdmin()) return;
  const settings = getAdminSettings();
  const companyStructure = Array.isArray(settings.companyStructure) ? settings.companyStructure : [];
  const assessments = getAssessments();
  const completedAssessments = assessments.filter(item => hasResults(item));
  const reviewQueue = completedAssessments.filter(item => {
    const results = item?.results || {};
    return results.toleranceBreached || results.nearTolerance || results.annualReviewTriggered;
  });
  const companyEntities = companyStructure.filter(node => isCompanyEntityType(node.type));
  const departmentEntities = companyStructure.filter(node => isDepartmentEntityType(node.type));
  const managedAccounts = getManagedAccountsForAdmin(settings);
  const preferredAdminRoute = `/admin/settings/${getPreferredAdminSection()}`;
  const docCount = getDocList().length;

  setPage(adminLayout('home', `
    <div class="settings-shell">
      <div class="settings-shell__header">
        <div class="flex items-center justify-between" style="gap:var(--sp-4);flex-wrap:wrap">
          <div>
            <h2>Platform Home</h2>
            <p style="margin-top:6px">A clean admin front door for starting assessments, checking the platform posture, and opening the admin console only when you need to change structure, defaults, access, or libraries.</p>
          </div>
          <div class="admin-shell-note">Keep administration deliberate: start assessment work from here, then open the console only for platform changes.</div>
        </div>
        <div class="admin-guidance-strip">
          <span class="admin-guidance-strip__label">Admin guidance</span>
          <strong>Assess first, administer second</strong>
          <span>This page is the admin workspace front door. Use it to start new analysis, review the current platform footprint, and then move into the console when a governed change is actually needed.</span>
        </div>
      </div>
      <div class="admin-overview-grid">
        ${[
          UI.dashboardOverviewCard({
            label: 'Assessments saved',
            value: assessments.length,
            foot: completedAssessments.length ? `${completedAssessments.length} completed result${completedAssessments.length === 1 ? '' : 's'} are currently available.` : 'No completed results are currently saved.'
          }),
          UI.dashboardOverviewCard({
            label: 'Needs review',
            value: reviewQueue.length,
            foot: reviewQueue.length ? 'Completed scenarios are waiting for management attention.' : 'No completed scenario currently needs escalation.'
          }),
          UI.dashboardOverviewCard({
            label: 'Businesses',
            value: companyEntities.length,
            foot: departmentEntities.length ? `${departmentEntities.length} departments are attached across the current structure.` : 'No departments are configured yet.'
          }),
          UI.dashboardOverviewCard({
            label: 'Managed users',
            value: managedAccounts.length,
            foot: managedAccounts.length ? 'Shared users and role assignments are active in the platform.' : 'No managed users are currently configured.'
          })
        ].join('')}
      </div>
      <div class="grid-2" style="margin-top:var(--sp-6);align-items:start">
        ${UI.dashboardSectionCard({
          title: 'Assessment workspace',
          description: 'Start a new guided assessment from here instead of dropping straight into the wizard on login.',
          className: 'dashboard-section-card--spotlight',
          body: `
            <div class="form-help">Use the same guided workflow as end users when you want to model a scenario directly or review the working experience from the front door.</div>
            <div class="flex items-center gap-3" style="flex-wrap:wrap">
              <button type="button" class="btn btn--primary" id="btn-admin-home-start-assessment">Start Guided Assessment</button>
              <a class="btn btn--secondary" href="#/dashboard">Open User Workspace</a>
            </div>
          `
        })}
        ${UI.dashboardSectionCard({
          title: 'Admin console',
          description: 'Key administration paths stay one click away without becoming the default landing page.',
          body: `
            <div class="flex items-center gap-3" style="flex-wrap:wrap">
              <button type="button" class="btn btn--secondary" id="btn-admin-home-open-console">Open Admin Console</button>
              <button type="button" class="btn btn--ghost" id="btn-admin-home-users">User Accounts</button>
              <button type="button" class="btn btn--ghost" id="btn-admin-home-defaults">Platform Defaults</button>
              <button type="button" class="btn btn--ghost" id="btn-admin-home-docs">Document Library</button>
            </div>
            <div class="form-help">Structure, defaults, user access, and libraries stay grouped behind the console so the top-level experience remains calm.</div>
          `
        })}
      </div>
      <div style="margin-top:var(--sp-6)">
        ${UI.dashboardSectionCard({
          title: 'Platform snapshot',
          description: 'A compact read on the current administration footprint before you go deeper.',
          body: `
            <div class="form-help">Structure: ${companyEntities.length} business entity${companyEntities.length === 1 ? '' : 'ies'} and ${departmentEntities.length} department${departmentEntities.length === 1 ? '' : 's'}.</div>
            <div class="form-help">Documents: ${docCount} library item${docCount === 1 ? '' : 's'} currently available for AI grounding.</div>
            <div class="form-help">Review queue: ${reviewQueue.length ? `${reviewQueue.length} completed assessment${reviewQueue.length === 1 ? '' : 's'} need management attention.` : 'No completed scenario currently needs escalation.'}</div>
          `
        })}
      </div>
    </div>`));

  // Admins should land on a real home view, not be thrown directly into a settings subsection or wizard step.
  document.getElementById('btn-admin-home-start-assessment')?.addEventListener('click', () => {
    resetDraft();
    openDraftWorkspaceRoute();
  });
  document.getElementById('btn-admin-home-open-console')?.addEventListener('click', () => {
    Router.navigate(preferredAdminRoute);
  });
  document.getElementById('btn-admin-home-users')?.addEventListener('click', () => {
    Router.navigate('/admin/settings/users');
  });
  document.getElementById('btn-admin-home-defaults')?.addEventListener('click', () => {
    Router.navigate('/admin/settings/defaults');
  });
  document.getElementById('btn-admin-home-docs')?.addEventListener('click', () => {
    Router.navigate('/admin/docs');
  });
  document.getElementById('btn-admin-logout')?.addEventListener('click', () => { performLogout(); });
  document.querySelectorAll('[data-admin-route]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const route = button.dataset.adminRoute || '/admin/home';
      if (route.startsWith('/admin/settings/')) {
        const section = route.split('/').pop() || 'org';
        setPreferredAdminSection(section);
      }
      Router.navigate(route);
    });
  });
}

function renderUserSettings() {
  if (!requireAuth()) return;
  if (AuthService.isAdminAuthenticated()) {
    Router.navigate(getDefaultRouteForCurrentUser());
    return;
  }

  const settings = getUserSettings();
  if (!settings.onboardedAt) {
    renderUserOnboarding(settings);
    return;
  }
  renderUserPreferences(settings);
}

function renderHelpCallout({ tone = 'best', title = '', body = '' } = {}) {
  if (!title && !body) return '';
  const label = tone === 'mistake'
    ? 'Common mistake'
    : tone === 'trust'
      ? 'How to use it well'
      : 'Best practice';
  return `<div class="help-callout help-callout--${escapeHtml(String(tone || 'best'))}">
    <div class="help-callout__label">${escapeHtml(label)}</div>
    <div class="help-callout__title">${escapeHtml(String(title || 'Helpful note'))}</div>
    <p class="help-callout__body">${escapeHtml(String(body || ''))}</p>
  </div>`;
}

function renderHelpExample({ title = '', body = '' } = {}) {
  if (!title && !body) return '';
  return `<div class="help-example">
    <div class="help-example__label">Worked example</div>
    <div class="help-example__title">${escapeHtml(String(title || 'Example'))}</div>
    <p class="help-example__body">${escapeHtml(String(body || ''))}</p>
  </div>`;
}

function renderHelpDisclosure(sectionId, {
  title = '',
  summary = '',
  body = '',
  open = false
} = {}) {
  const stateKey = getDisclosureStateKey('/help', `${sectionId}:${title}`);
  const isOpen = getDisclosureOpenState(stateKey, open);
  return `<details class="results-detail-disclosure help-disclosure" data-disclosure-state-key="${escapeHtml(stateKey)}"${isOpen ? ' open' : ''}>
    <summary>
      <div>
        <div class="help-disclosure__title">${escapeHtml(String(title || 'More detail'))}</div>
        ${summary ? `<div class="help-disclosure__summary">${escapeHtml(String(summary))}</div>` : ''}
      </div>
    </summary>
    <div class="results-disclosure-stack">${body}</div>
  </details>`;
}

function renderHelpSection({
  id,
  title,
  summary,
  intro = '',
  chips = [],
  disclosures = []
} = {}) {
  return `<section class="help-section" id="help-${escapeHtml(String(id || 'section'))}">
    <div class="help-section__head">
      <div>
        <div class="help-section__kicker">${escapeHtml(String(summary || 'Guide section'))}</div>
        <h2 class="help-section__title">${escapeHtml(String(title || 'Help'))}</h2>
        ${intro ? `<p class="help-section__intro">${escapeHtml(String(intro))}</p>` : ''}
      </div>
      ${chips.length ? `<div class="citation-chips help-chip-row">${chips.map(chip => `<span class="badge badge--neutral">${escapeHtml(String(chip))}</span>`).join('')}</div>` : ''}
    </div>
    <div class="help-section__body">
      ${disclosures.join('')}
    </div>
  </section>`;
}

function bindHelpPageInteractions(root = document) {
  root.querySelectorAll('[data-help-target]').forEach(button => {
    if (button.dataset.helpBound === 'true') return;
    button.dataset.helpBound = 'true';
    button.addEventListener('click', () => {
      const targetId = button.dataset.helpTarget || '';
      const section = document.getElementById(targetId);
      if (!section) return;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const heading = section.querySelector('h2');
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        try {
          heading.focus({ preventScroll: true });
        } catch {
          heading.focus();
        }
      }
    });
  });
  root.querySelectorAll('[data-open-shortcuts-help]').forEach(button => {
    if (button.dataset.helpBound === 'true') return;
    button.dataset.helpBound = 'true';
    button.addEventListener('click', () => openShortcutHelpModal());
  });
}

function renderHelpPage() {
  if (!requireAuth()) return;
  const currentUser = AuthService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const settings = !isAdmin ? getUserSettings() : null;
  const nonAdminCapability = currentUser && !isAdmin
    ? getNonAdminCapabilityState(currentUser, settings, getAdminSettings())
    : null;
  const roleSummary = isAdmin
    ? 'Global admin'
    : nonAdminCapability?.canManageBusinessUnit
      ? 'BU admin'
      : nonAdminCapability?.canManageDepartment
        ? 'Function admin'
        : 'Standard user';

  const sections = [
    renderHelpSection({
      id: 'overview',
      title: 'What this platform does',
      summary: 'Start here',
      intro: 'Use the platform to turn a real business risk scenario into a challengeable quantified assessment, review the result in executive and technical language, and compare whether a better outcome materially improves the decision.',
      chips: ['Dashboard to results', 'AI-assisted drafting', 'Monte Carlo simulation', 'Executive and technical views'],
      disclosures: [
        renderHelpDisclosure('overview', {
          title: 'What the platform is for',
          summary: 'What it handles, who it is for, and what you get out at the end.',
          open: true,
          body: `
            <p class="help-body-copy">This platform is for structured risk decisions, not generic brainstorming. It supports standard users, function owners, BU admins, and global admins who need a shared way to draft scenarios, estimate loss, review evidence strength, and export decision-ready outputs.</p>
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Good fit</strong><p>Cyber, resilience, vendor, control-failure, disruption, compliance, and third-party scenarios where management needs a defendable view of exposure and next steps.</p></div>
              <div class="help-mini-card"><strong>What you get</strong><p>A structured scenario, a plain-language estimate, Monte Carlo output, executive and technical results, treatment comparison, and exportable decision artefacts.</p></div>
            </div>
            ${renderHelpExample({
              title: 'A realistic use case',
              body: 'A team wants to understand whether a regulated customer platform outage driven by cloud misconfiguration is still within tolerance, what assumptions are carrying the estimate, and whether stronger controls materially improve the picture.'
            })}
          `
        }),
        renderHelpDisclosure('overview', {
          title: 'What the workflow looks like',
          summary: 'Dashboard, draft, refine, estimate, run, review, export.',
          body: `
            <div class="help-flow-grid">
              ${[
                'Dashboard: start, resume, or review work that needs attention.',
                'AI-Assisted Risk & Context Builder: create the first scenario draft and choose what stays in scope.',
                'Refine the Scenario: tighten the narrative into one coherent event.',
                'Estimate the Scenario: express the loss path in plain language or advanced tuning.',
                'Monte Carlo simulation: run the estimate through uncertainty ranges.',
                'Executive and technical review: interpret posture, confidence, drivers, and challenge points.',
                'Compare a better outcome: test whether a treatment materially changes the decision.',
                'Export: create a decision memo, printable output, or other supporting artefacts.'
              ].map((step, idx) => `<div class="help-flow-step"><span>${idx + 1}</span><p>${escapeHtml(step)}</p></div>`).join('')}
            </div>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'best-results',
      title: 'How to get the best result',
      summary: 'Set yourself up well',
      intro: 'The platform works best when you start with one coherent event, one clear business context, and enough detail to challenge the estimate without trying to write a full report up front.',
      chips: ['Use one event', 'Keep scope tight', 'Prefer specifics over adjectives'],
      disclosures: [
        renderHelpDisclosure('best-results', {
          title: 'How to start well',
          summary: 'When to use guided assessment, risk register upload, or preloaded scenarios.',
          open: true,
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Guided assessment</strong><p>Best for most users. Use it when you need help turning a real situation into a clear scenario and do not already have a structured source document.</p></div>
              <div class="help-mini-card"><strong>Upload a risk register</strong><p>Use this when you already have existing risks and want the platform to surface candidate scenarios quickly from your own source material.</p></div>
              <div class="help-mini-card"><strong>Preloaded scenarios</strong><p>Use these when you want a faster first pass, a worked example, or a realistic starting structure to adapt.</p></div>
            </div>
            ${renderHelpCallout({
              tone: 'best',
              title: 'Start narrow, then improve',
              body: 'A focused first draft is better than a vague comprehensive one. You can always add detail later, but it is harder to rescue a scenario that mixes multiple events at the start.'
            })}
          `
        }),
        renderHelpDisclosure('best-results', {
          title: 'What good input looks like',
          summary: 'Specific enough to model, but short enough to challenge.',
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Good</strong><p>“A privileged cloud configuration error exposes regulated customer data and disrupts service restoration for one business unit.”</p></div>
              <div class="help-mini-card"><strong>Weak</strong><p>“Cyber issues could hurt the business badly.” This is too broad, hides the event path, and does not tell the model what is actually in scope.</p></div>
            </div>
            ${renderHelpCallout({
              tone: 'mistake',
              title: 'Do not write three scenarios in one',
              body: 'If the draft mixes outage, data loss, fraud, and compliance failure as separate events, split them. The model works best when one coherent event stays in focus.'
            })}
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'context',
      title: 'How context is derived',
      summary: 'Where the platform gets its context',
      intro: 'The platform combines your direct inputs with saved role context, organisation context, benchmark-aware suggestions, and grounded source material. AI helps assemble and refine that context, but it does not replace user judgment.',
      chips: ['User input', 'Role and org context', 'Benchmarks', 'Grounded sources'],
      disclosures: [
        renderHelpDisclosure('context', {
          title: 'What comes from you, your settings, and the organisation',
          summary: 'Direct input and retained context are both active.',
          open: true,
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>User inputs</strong><p>Your prompts, selected risks, scenario narrative, parameter inputs, and any files you upload for the current assessment.</p></div>
              <div class="help-mini-card"><strong>Personal settings</strong><p>Your role, focus areas, working view, preferred output style, AI notes, and optional personal overlays.</p></div>
              <div class="help-mini-card"><strong>Organisation context</strong><p>Company, BU, and function context retained by admins or owners, including geography, regulations, appetite, and operating context.</p></div>
            </div>
          `
        }),
        renderHelpDisclosure('context', {
          title: 'What comes from AI, benchmarks, and source material',
          summary: 'AI suggests structure; grounded sources and benchmarks shape how confident to be.',
          body: `
            <p class="help-body-copy">AI in this app is assistive. It helps draft, structure, refine, and benchmark the scenario. It does not turn its own suggestions into facts. Grounding means the model can point to real context, uploaded material, retrieved references, or an explainable basis for the suggestion.</p>
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Primary grounding</strong><p>The strongest named source or context basis carrying a draft or result.</p></div>
              <div class="help-mini-card"><strong>Supporting references</strong><p>Additional retrieved or attached material that helps explain or support the current framing.</p></div>
              <div class="help-mini-card"><strong>Provenance</strong><p>A trace of where the current wording, estimate, or assumption came from: user input, AI suggestion, benchmark, uploaded document, or inherited context.</p></div>
            </div>
            ${renderHelpExample({
              title: 'How company context shapes output',
              body: 'If the company brief says the business operates regulated digital services in the UAE, the app will tend to surface geography, regulatory, resilience, and customer-impact considerations earlier than it would for a non-regulated internal-only service.'
            })}
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'results-logic',
      title: 'How results are derived',
      summary: 'How the platform moves from wording to quantification',
      intro: 'The platform moves from a scenario narrative into an estimate by asking: how often could this happen, how likely is it to succeed, what losses would follow, and how uncertain are those ranges. It then runs the model many times to show the likely spread of outcomes.',
      chips: ['Scenario to model', 'FAIR-style thinking', 'Simulation', 'Confidence and evidence'],
      disclosures: [
        renderHelpDisclosure('results-logic', {
          title: 'Plain-language quantification and FAIR-style thinking',
          summary: 'What the main modelling concepts mean in this app.',
          open: true,
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Threat capability and control strength</strong><p>Together these shape how exposed you are if the event occurs. Stronger controls usually reduce the chance that the event succeeds.</p></div>
              <div class="help-mini-card"><strong>Frequency</strong><p>How often the event path could realistically arise in a year.</p></div>
              <div class="help-mini-card"><strong>Primary and secondary loss</strong><p>Primary loss is the direct operational and recovery cost. Secondary loss includes regulatory, legal, customer, or reputational effects that follow.</p></div>
            </div>
            ${renderHelpCallout({
              tone: 'trust',
              title: 'What simulation does',
              body: 'The simulation does not create facts. It repeatedly samples within your ranges to show how the result behaves under uncertainty. That is why clear ranges and honest assumptions matter.'
            })}
          `
        }),
        renderHelpDisclosure('results-logic', {
          title: 'Executive, technical, and treatment comparison views',
          summary: 'What each result layer is for.',
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Executive Summary</strong><p>Use this for the decision surface: current posture, key metrics, recommendation, confidence posture, and what management should do next.</p></div>
              <div class="help-mini-card"><strong>Technical Detail</strong><p>Use this when you want to challenge assumptions, inspect drivers, understand the evidence basis, and review parameter-level reasoning.</p></div>
              <div class="help-mini-card"><strong>Treatment comparison</strong><p>Use this to test whether a better outcome materially changes the decision and why the delta happened.</p></div>
            </div>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'steps',
      title: 'How to use the main steps well',
      summary: 'Step-by-step help',
      intro: 'Each screen has one main job. Use the deeper detail only when it helps the current task.',
      chips: ['Dashboard', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Settings', 'Admin'],
      disclosures: [
        renderHelpDisclosure('steps', {
          title: 'Dashboard',
          summary: 'Start, resume, review, and keep an eye on what needs attention.',
          body: `
            <p class="help-body-copy"><strong>Purpose:</strong> know what to do next. Use the live work lane first, the watchlist second, and history last.</p>
            <p class="help-body-copy"><strong>Common mistake:</strong> treating the dashboard as a reporting page. It is a front door and oversight lane, not the place to inspect every detail.</p>
            ${renderHelpExample({
              title: 'Best use',
              body: 'Resume a live draft, open a result that needs review, or start a guided assessment only when there is no urgent queue item competing.'
            })}
          `
        }),
        renderHelpDisclosure('steps', {
          title: 'Step 1: AI-Assisted Risk & Context Builder',
          summary: 'Get to one plausible draft and choose what stays in scope.',
          body: `
            <p class="help-body-copy"><strong>What to do:</strong> answer the prompts in plain language, keep the scenario focused, then keep only the risks that clearly belong in this event path.</p>
            <p class="help-body-copy"><strong>Good input:</strong> one triggering condition, one main asset or service, one clear impact path.</p>
            <p class="help-body-copy"><strong>Common mistake:</strong> treating the shortlist as a basket of all possible issues instead of what genuinely belongs in this one scenario.</p>
          `
        }),
        renderHelpDisclosure('steps', {
          title: 'Step 2: Refine the Scenario',
          summary: 'Turn the draft into one coherent scenario that can be challenged.',
          body: `
            <p class="help-body-copy"><strong>What to do:</strong> write one scenario in your own words, then use the coach and evidence guidance to tighten what is vague.</p>
            <p class="help-body-copy"><strong>Common mistake:</strong> accepting AI structure without rewriting the parts that do not match the real business context.</p>
          `
        }),
        renderHelpDisclosure('steps', {
          title: 'Step 3: Estimate the Scenario',
          summary: 'Use plain language first; open advanced tuning only when it materially improves the model.',
          body: `
            <p class="help-body-copy"><strong>What to do:</strong> work from frequency to exposure to cost. Use basic mode unless there is a clear reason to open advanced tuning.</p>
            <p class="help-body-copy"><strong>Common mistake:</strong> forcing precise numbers without a rationale. If you cannot explain why a range is shaped the way it is, widen it and improve the evidence basis first.</p>
          `
        }),
        renderHelpDisclosure('steps', {
          title: 'Review & Run, Results, Settings, and Admin',
          summary: 'How to use the final stages and role-specific controls well.',
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Review & Run</strong><p>Challenge the assumptions that matter most, then run. Do not turn this into another writing stage.</p></div>
              <div class="help-mini-card"><strong>Results</strong><p>Read the executive story first, then challenge the technical detail, then export only after confidence and evidence feel good enough.</p></div>
              <div class="help-mini-card"><strong>Personal Settings</strong><p>Use this to shape how the assistant helps you and to maintain context you own. Keep optional overlays secondary.</p></div>
              <div class="help-mini-card"><strong>Admin</strong><p>Use admin screens as workbenches, not dashboards. Keep the organisation, defaults, governance, and document library current because they shape downstream suggestions.</p></div>
            </div>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'modeling',
      title: 'Modelling guidance for non-technical users',
      summary: 'Translate real-world controls into model inputs',
      intro: 'You do not need to think in equations. The useful question is whether the real world makes the event more likely, less likely, more costly, or easier to contain.',
      chips: ['Controls to ranges', 'Plain English first', 'Confidence matters'],
      disclosures: [
        renderHelpDisclosure('modeling', {
          title: 'How real controls map into the model',
          summary: 'Practical examples for non-technical users.',
          open: true,
          body: `
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Unpatched server, but EDR is in place</strong><p>Threat capability is still relevant because the weakness is exploitable. Control strength improves because detection and containment exist, but not enough to ignore the exposure.</p></div>
              <div class="help-mini-card"><strong>Strong backups</strong><p>Backups usually help reduce business interruption and recovery cost. They do not automatically reduce event frequency or stop the event from succeeding.</p></div>
              <div class="help-mini-card"><strong>MFA on privileged users</strong><p>This often improves control strength materially against identity-based compromise and can reduce how often a successful event path should be expected.</p></div>
              <div class="help-mini-card"><strong>Network segmentation</strong><p>This can reduce spread, lower interruption duration, and limit secondary loss if the segmentation is real and well operated.</p></div>
              <div class="help-mini-card"><strong>Weak monitoring</strong><p>Poor monitoring usually increases the chance the event succeeds for longer, raises interruption duration, and weakens confidence because detection assumptions become less certain.</p></div>
              <div class="help-mini-card"><strong>Vendor dependency with contractual controls</strong><p>Contractual controls may help legal recovery or assurance, but they do not necessarily reduce outage frequency or immediate operational impact.</p></div>
            </div>
          `
        }),
        renderHelpDisclosure('modeling', {
          title: 'What to do when you are unsure',
          summary: 'How to handle imperfect knowledge responsibly.',
          body: `
            <p class="help-body-copy">If you are unsure, do three things: widen the range, lower the confidence you place in the result, and note what evidence would make the estimate stronger. The platform already surfaces confidence, evidence gaps, and parameter challenge points to support that workflow.</p>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'confidence',
      title: 'Confidence, evidence, and when to trust the output',
      summary: 'Trust the output responsibly',
      intro: 'A strong-looking number is not enough. Confidence, evidence quality, assumptions, and provenance tell you how much to rely on the current result and what still needs validation.',
      chips: ['Confidence', 'Evidence quality', 'Assumptions', 'Provenance'],
      disclosures: [
        renderHelpDisclosure('confidence', {
          title: 'What low confidence and missing information mean',
          summary: 'Low confidence does not mean the result is useless. It means use it with the right level of caution.',
          open: true,
          body: `
            <p class="help-body-copy">Low confidence usually means one or more important parts of the estimate are thinly evidenced, weakly sourced, or still resting on broad assumptions. Missing information points to the evidence that would most improve the current decision view.</p>
            ${renderHelpCallout({
              tone: 'trust',
              title: 'What to validate before escalation',
              body: 'Before you escalate a severe result, check whether the scenario is coherent, the most material assumptions are visible, the key ranges are credible, and the evidence caveat is acceptable for the decision you are asking management to make.'
            })}
          `
        }),
        renderHelpDisclosure('confidence', {
          title: 'How to interpret AI suggestions and references responsibly',
          summary: 'AI assists; it does not certify.',
          body: `
            <p class="help-body-copy">Use AI suggestions as a working draft. Keep what matches the business reality, edit what does not, and treat references as support for challenge, not as automatic proof that the estimate is correct. Provenance and citations help you understand how the current draft was assembled.</p>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'mistakes',
      title: 'Best practices and common mistakes',
      summary: 'What separates strong assessments from weak ones',
      intro: 'Most weak outputs come from a small set of avoidable mistakes. If you know what to watch for, the workflow becomes much easier.',
      chips: ['Stay specific', 'Challenge AI', 'Do not over-tune'],
      disclosures: [
        renderHelpDisclosure('mistakes', {
          title: 'Common mistakes to avoid',
          summary: 'The most common ways users make the model harder to trust.',
          open: true,
          body: `
            ${renderHelpCallout({ tone: 'mistake', title: 'Making scenarios too broad', body: 'If you mix multiple events, the estimate becomes harder to challenge and easier to misunderstand.' })}
            ${renderHelpCallout({ tone: 'mistake', title: 'Treating AI suggestions as facts', body: 'AI should speed up drafting and structuring. It should not replace user confirmation or evidence checks.' })}
            ${renderHelpCallout({ tone: 'mistake', title: 'Overusing advanced tuning', body: 'Advanced mode is for challenge and refinement, not for turning every estimate into a modelling exercise.' })}
            ${renderHelpCallout({ tone: 'mistake', title: 'Entering numbers without rationale', body: 'If you cannot explain why a range should move up or down, the model cannot become more trustworthy just because the number is more precise.' })}
          `
        }),
        renderHelpDisclosure('mistakes', {
          title: 'A good working pattern',
          summary: 'A reliable way to use the platform well.',
          body: `
            <div class="help-flow-grid">
              ${[
                'Get to one coherent scenario first.',
                'Scope only the risks that genuinely belong in that event path.',
                'Refine the narrative until a reviewer can challenge it clearly.',
                'Estimate in plain language before touching advanced tuning.',
                'Run the model and read executive posture before diving into technical detail.',
                'Use evidence gaps and confidence posture to decide what to validate next.'
              ].map((item, idx) => `<div class="help-flow-step"><span>${idx + 1}</span><p>${escapeHtml(item)}</p></div>`).join('')}
            </div>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'shortcuts',
      title: 'Keyboard shortcuts and workflow tips',
      summary: 'Use the product faster',
      intro: 'Shortcuts are optional, but they are useful if you review many assessments or move through the workflow repeatedly.',
      chips: ['Desktop only', 'Ignored while typing', 'Save cues stay visible'],
      disclosures: [
        renderHelpDisclosure('shortcuts', {
          title: 'Current desktop shortcuts',
          summary: 'The same shortcuts shown in the in-app overlay.',
          open: true,
          body: `
            <div class="help-shortcut-grid">
              <div class="help-shortcut-card"><strong>Alt/Option + N</strong><span>Start a new assessment</span></div>
              <div class="help-shortcut-card"><strong>Alt/Option + R</strong><span>Resume your current draft</span></div>
              <div class="help-shortcut-card"><strong>Alt/Option + S</strong><span>Open personal settings</span></div>
              <div class="help-shortcut-card"><strong>Alt/Option + 1 / 2 / 3</strong><span>Switch results tabs</span></div>
              <div class="help-shortcut-card"><strong>Alt/Option + F</strong><span>Focus admin user search</span></div>
              <div class="help-shortcut-card"><strong>Alt/Option + /</strong><span>Open the shortcuts overlay</span></div>
            </div>
            <div class="flex items-center gap-3" style="margin-top:var(--sp-4);flex-wrap:wrap">
              <button type="button" class="btn btn--secondary btn--sm" data-open-shortcuts-help>Open shortcuts overlay</button>
              <span class="form-help">Drafts and settings save automatically. Watch the save and sync cues rather than repeatedly hunting for a manual save button.</span>
            </div>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'roles',
      title: 'Role-specific help',
      summary: 'What good use looks like by role',
      intro: 'Different roles should use the platform differently. The best use of the product depends on what you own and what decisions you support.',
      chips: ['Standard user', 'Function admin', 'BU admin', 'Global admin'],
      disclosures: [
        renderHelpDisclosure('roles', {
          title: 'Standard user',
          summary: 'Draft, estimate, review, and escalate with evidence.',
          body: `
            <p class="help-body-copy">Focus on getting one good scenario through the workflow, using your settings to shape how the assistant helps you, and escalating results only after checking confidence and evidence posture.</p>
          `
        }),
        renderHelpDisclosure('roles', {
          title: 'Function admin and BU admin',
          summary: 'Use the workspace as an oversight console, not as a general dashboard.',
          body: `
            <p class="help-body-copy">Prioritise queue items that need review, maintain the context you own, and use the dashboard watchlist and reassessment lane to keep important scenarios current. Keep owned context more up to date than optional personal overlays.</p>
          `
        }),
        renderHelpDisclosure('roles', {
          title: 'Global admin',
          summary: 'Maintain the platform workbench that shapes everyone else’s output.',
          body: `
            <p class="help-body-copy">Keep the organisation structure, platform defaults, governance inputs, company context, and document library current. These settings influence how the AI drafts, what guidance users see, and how grounded the output can become.</p>
          `
        })
      ]
    })
  ];

  setPage(`
    <main class="page help-page">
      <div class="container help-shell">
        <aside class="help-nav card">
          <div class="help-nav__kicker">Help</div>
          <div class="help-nav__title">Risk Intelligence guide</div>
          <div class="help-nav__copy">Follow the product flow, jump to what you need, and open deeper detail only when it helps the current task.</div>
          <div class="help-nav__role">
            <span class="badge badge--neutral">${escapeHtml(roleSummary)}</span>
            <span class="form-help">Tailored for the current product state</span>
          </div>
          <div class="help-nav__links">
            ${[
              ['help-overview', 'What this platform does'],
              ['help-best-results', 'Getting the best result'],
              ['help-context', 'How context works'],
              ['help-results-logic', 'How results work'],
              ['help-steps', 'Help by step'],
              ['help-modeling', 'Non-technical modelling'],
              ['help-confidence', 'Confidence and evidence'],
              ['help-mistakes', 'Best practices'],
              ['help-shortcuts', 'Shortcuts and workflow tips'],
              ['help-roles', 'Role-specific help']
            ].map(([id, label]) => `<button type="button" class="help-nav__link" data-help-target="${id}">${escapeHtml(label)}</button>`).join('')}
          </div>
        </aside>
        <div class="help-main">
          <section class="help-hero card">
            <div class="help-hero__head">
              <div>
                <div class="help-hero__kicker">Help and FAQ</div>
                <h1 class="help-hero__title" data-page-focus>Use the platform well without learning the whole model first.</h1>
                <p class="help-hero__copy">This guide is structured around the actual workflow in the current app: start, refine, estimate, run, review, and export. It explains what the platform is doing, what you should do, what strong input looks like, and how to know when the result is strong enough to use.</p>
              </div>
              <div class="help-hero__actions">
                <button type="button" class="btn btn--secondary" data-open-shortcuts-help>Shortcuts</button>
                <a href="#/dashboard" class="btn btn--ghost">Back to dashboard</a>
              </div>
            </div>
            <div class="help-hero__jump-strip">
              ${[
                ['help-best-results', 'Getting started'],
                ['help-context', 'How context works'],
                ['help-results-logic', 'How results work'],
                ['help-mistakes', 'Best practices'],
                ['help-steps', 'FAQ by step'],
                ['help-roles', 'Role-based help']
              ].map(([id, label]) => `<button type="button" class="help-jump-pill" data-help-target="${id}">${escapeHtml(label)}</button>`).join('')}
            </div>
          </section>
          ${sections.join('')}
        </div>
      </div>
    </main>
  `);
  bindHelpPageInteractions(document.getElementById('main-content'));
}

function getSettingsSectionStateKey(scope, title) {
  return `${scope}::${String(title || '').trim().toLowerCase()}`;
}

function getCurrentDisclosureScope() {
  const routeMeta = getRouteMeta();
  const currentHash = String(routeMeta.currentHash || '').trim();
  if (currentHash) return currentHash.toLowerCase();
  if (typeof window !== 'undefined') {
    return (String(window.location.hash || '#/').slice(1) || '/').toLowerCase();
  }
  return '/';
}

function getDisclosureStateKey(scope, title) {
  return `${String(scope || getCurrentDisclosureScope()).trim().toLowerCase()}::${String(title || '').trim().toLowerCase()}`;
}

function getDisclosureOpenState(stateKey, fallback = false) {
  if (!stateKey) return !!fallback;
  return Object.prototype.hasOwnProperty.call(AppState.disclosureState, stateKey)
    ? !!AppState.disclosureState[stateKey]
    : !!fallback;
}

function bindDisclosureState(root = document) {
  root.querySelectorAll('details[data-disclosure-state-key]').forEach(section => {
    const key = section.dataset.disclosureStateKey;
    if (!key || section.dataset.disclosureStateBound === 'true') return;
    section.dataset.disclosureStateBound = 'true';
    section.addEventListener('toggle', () => {
      AppState.disclosureState[key] = section.open;
    });
  });
}

function rememberSettingsScroll(scope) {
  AppState.settingsScrollState[scope] = window.scrollY || 0;
}

function restoreSettingsScroll(scope) {
  const nextY = Number(AppState.settingsScrollState[scope] || 0);
  window.requestAnimationFrame(() => window.scrollTo({ top: nextY, left: 0, behavior: 'auto' }));
}

function bindSettingsSectionState(scope, root = document) {
  root.querySelectorAll('.settings-section[data-settings-section-key]').forEach(section => {
    const key = section.dataset.settingsSectionKey;
    section.addEventListener('toggle', () => {
      AppState.settingsSectionState[key] = section.open;
      rememberSettingsScroll(scope);
    });
  });
}

function renderSettingsSection({ title, description = '', body = '', open = false, meta = '', scope = 'global-settings' }) {
  const key = getSettingsSectionStateKey(scope, title);
  const isOpen = Object.prototype.hasOwnProperty.call(AppState.settingsSectionState, key)
    ? !!AppState.settingsSectionState[key]
    : open;
  return `<details class="settings-section" data-settings-section-key="${key}"${isOpen ? ' open' : ''}>
    <summary class="settings-section__summary">
      <div>
        <div class="settings-section__title-row">
          <span class="settings-section__title">${title}</span>
          ${meta ? `<span class="settings-section__meta">${meta}</span>` : ''}
        </div>
        ${description ? `<p class="settings-section__description">${description}</p>` : ''}
      </div>
      <span class="settings-section__chevron">⌄</span>
    </summary>
    <div class="settings-section__body">${body}</div>
  </details>`;
}

function createDebouncedSaver(callback, delay = 350) {
  let timeoutId = null;
  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(), delay);
  };
}

function bindAutosave(container, callback, { events = ['input', 'change'] } = {}) {
  if (!container || typeof callback !== 'function') return () => {};
  const run = createDebouncedSaver(callback);
  const listeners = events.map(eventName => {
    const handler = event => {
      if (!event.target || !(event.target instanceof HTMLElement)) return;
      if (event.target.closest('.tag-input-chip button')) return;
      run();
    };
    container.addEventListener(eventName, handler);
    return { eventName, handler };
  });
  return () => listeners.forEach(({ eventName, handler }) => container.removeEventListener(eventName, handler));
}

function renderAdminSettings(activeSection = 'org') {
  if (!requireAdmin()) return;
  const settings = getAdminSettings();
  const companyStructure = Array.isArray(settings.companyStructure) ? [...settings.companyStructure] : [];
  const entityContextLayers = Array.isArray(settings.entityContextLayers) ? [...settings.entityContextLayers] : [];
  const companyContextSections = settings.companyContextSections || buildCompanyContextSections({
    companySummary: settings.adminContextSummary || '',
    businessProfile: settings.companyContextProfile || ''
  });
  const sessionLLM = getSessionLLMConfig();
  const directCompass = !sessionLLM.apiUrl || sessionLLM.apiUrl.includes('api.core42.ai');
  const buCount = getBUList().length;
  const docCount = getDocList().length;
  const managedAccounts = getManagedAccountsForAdmin(settings);
  const companyEntities = companyStructure.filter(node => isCompanyEntityType(node.type));
  const departmentEntities = companyStructure.filter(node => isDepartmentEntityType(node.type));
  const settingsSectionMeta = {
    org: { title: 'Organisation Setup', description: 'Build the organisation tree first, then tune risk context from the left navigation.' },
    company: { title: 'AI Company Context Builder', description: 'Build public company context and place it into the organisation structure.' },
    defaults: { title: 'Platform Defaults', description: 'Manage thresholds, escalation posture, geography, and global linked-risk fallback.' },
    governance: { title: 'Governance Inputs', description: 'Manage regulations, AI guidance, typical departments, and scoped governance overrides.' },
    access: { title: 'System Access', description: 'Configure the Compass proxy, model, and session-level access controls.' },
    users: { title: 'User Account Control', description: 'Manage shared users, roles, BU assignments, and issued passwords.' },
    audit: { title: 'Audit Log', description: 'Review short-retention PoC audit events and sign-in statistics.' }
  };
  const currentSettingsSection = setPreferredAdminSection(settingsSectionMeta[activeSection] ? activeSection : getPreferredAdminSection());
  const orgSetupSections = AdminOrgSetupSection.renderSections({
    companyEntities,
    departmentEntities,
    companyStructure
  });
  const companyBuilderSection = renderSettingsSection({
    title: 'AI Company Context Builder',
    scope: 'admin-settings',
    description: 'Build public context for a company website, then place it into the organisation tree as a holding company, subsidiary, portfolio company, partner, or operating business.',
    meta: settings.companyWebsiteUrl ? 'Website loaded' : 'Optional',
    body: `<div class="admin-workbench-strip admin-workbench-strip--compact">
      <div>
        <div class="admin-workbench-strip__label">Build first, refine second</div>
        <strong>Generate the company context from a website first, then open AI refinement only when the draft needs reshaping.</strong>
        <span>This keeps the workflow easier to control and avoids loading refinement tools before there is a usable draft.</span>
      </div>
    </div>
    <div class="grid-2 mt-4">
      <div class="form-group">
        <label class="form-label" for="admin-company-url">Company Website URL</label>
        <input class="form-input" id="admin-company-url" value="${settings.companyWebsiteUrl || ''}" placeholder="https://example.com">
        <span class="form-help">Works through the hosted proxy. Direct browser-to-Compass mode cannot build website context.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="admin-company-profile">Company Risk Context Profile</label>
        <textarea class="form-textarea" id="admin-company-profile" rows="6" placeholder="Public business profile, operating model, technology exposure, and likely risk signals.">${settings.companyContextProfile || ''}</textarea>
      </div>
    </div>
    <div class="card mt-4" style="padding:var(--sp-4);background:var(--bg-canvas)">
      <div class="context-panel-title">Editable Company Brief</div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-summary">Company Summary</label>
        <textarea class="form-textarea" id="admin-company-section-summary" rows="3">${companyContextSections.companySummary || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-business-model">Business Model</label>
        <textarea class="form-textarea" id="admin-company-section-business-model" rows="3">${companyContextSections.businessModel || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-operating-model">Operating Model</label>
        <textarea class="form-textarea" id="admin-company-section-operating-model" rows="3">${companyContextSections.operatingModel || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-commitments">Public Commitments</label>
        <textarea class="form-textarea" id="admin-company-section-commitments" rows="4">${companyContextSections.publicCommitments || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-risks">Key Risk Signals</label>
        <textarea class="form-textarea" id="admin-company-section-risks" rows="4">${companyContextSections.keyRiskSignals || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-obligations">Obligations And Exposures</label>
        <textarea class="form-textarea" id="admin-company-section-obligations" rows="4">${companyContextSections.obligations || ''}</textarea>
      </div>
      <div class="form-group mt-3">
        <label class="form-label" for="admin-company-section-sources">Sources Reviewed</label>
        <textarea class="form-textarea" id="admin-company-section-sources" rows="4">${companyContextSections.sources || ''}</textarea>
      </div>
    </div>
    <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
      <button class="btn btn--secondary" id="btn-build-company-context">Build from Website</button>
      <span class="form-help">This opens a review step so you can decide where the entity sits in the group.</span>
    </div>
    <details class="dashboard-disclosure card mt-4">
      <summary>Refine with AI <span class="badge badge--neutral">Advanced</span></summary>
      <div class="dashboard-disclosure-copy">Open this after you have a first company draft and want to refine it with uploaded sources or follow-up instructions.</div>
      <div class="dashboard-disclosure-body">
        ${UI.aiRefinementCard({
          intro: 'Use follow-up prompts to reshape the company context until it is ready for the admin baseline or organisation tree.',
          historyId: 'admin-company-refinement-history',
          fileId: 'admin-company-source-file',
          fileLabel: 'Upload supporting documents',
          fileAccept: '.txt,.csv,.json,.md,.tsv,.xlsx,.xls,.doc,.docx,.pdf',
          fileHelpId: 'admin-company-source-help',
          fileHelp: 'Recommended: upload strategy, policy, procedure, or operating-model documents to ground the AI context.',
          promptId: 'admin-company-followup',
          promptPlaceholder: 'Tell the AI what to change, emphasise, shorten, or make more specific.',
          buttonId: 'btn-refine-admin-company-context',
          buttonLabel: 'Apply Follow-Up Now',
          statusId: 'admin-company-refine-status',
          statusText: 'The fields above will be updated in place each time you refine the context.',
          className: '',
          style: 'padding:0;background:transparent;border:none;box-shadow:none',
          title: 'Refine This Context With AI'
        })}
      </div>
    </details>`
  });
  const platformDefaultsSection = AdminPlatformDefaultsSection.renderSection({ settings, mode: 'defaults' });
  const governanceSection = AdminPlatformDefaultsSection.renderSection({ settings, mode: 'governance' });
  const systemAccessSection = AdminSystemAccessSection.renderSection({
    directCompass,
    sessionLLM
  });
  const auditCache = AppState.auditLogCache || { loaded: false, loading: false, entries: [], summary: null, error: '' };
  const auditLogSection = AdminAuditLogSection.renderSection({ auditCache });


  const userControlsSection = AdminUserAccountsSection.renderSection({
    settings,
    companyEntities,
    companyStructure,
    managedAccounts
  });
  const adminSectionBody = {
    org: orgSetupSections,
    company: companyBuilderSection,
    defaults: platformDefaultsSection,
    governance: governanceSection,
    access: systemAccessSection,
    users: userControlsSection,
    audit: auditLogSection
  }[currentSettingsSection] || orgSetupSections;

  const adminGuidanceCopy = currentSettingsSection === 'org'
    ? 'Edit the organisation tree first. Context guidance and saved layer review stay below the workbench so structure remains the main task.'
    : currentSettingsSection === 'users'
      ? 'Review and search current accounts first. Creation and protected admin tools stay secondary so access changes remain controlled.'
      : currentSettingsSection === 'defaults'
        ? 'Set global thresholds and fallback posture here. Governance inputs and scoped overrides live separately to reduce cognitive load.'
        : currentSettingsSection === 'governance'
          ? 'Use this screen for regulations, AI guidance, and scoped defaults. Financial thresholds remain on Platform Defaults.'
          : currentSettingsSection === 'company'
            ? 'Generate first, refine second. Keep the main company-context draft simple before opening advanced AI refinement.'
            : currentSettingsSection === 'access'
              ? 'These are stronger platform controls. Make one intentional change at a time and verify the downstream effect before saving.'
              : 'Review short-retention audit activity without interrupting the main platform administration flow.';
  const platformSnapshotMarkup = `<details class="dashboard-disclosure card admin-snapshot-disclosure">
    <summary>Platform snapshot <span class="badge badge--neutral">Reference</span></summary>
    <div class="dashboard-disclosure-copy">A compact view of structure, context coverage, and where platform administration is concentrated. Open only when it helps the current task.</div>
    <div class="dashboard-disclosure-body">
      <div class="admin-overview-grid">
        <div class="admin-overview-card">
          <div class="admin-overview-label">Businesses</div>
          <div class="admin-overview-value">${companyEntities.length}</div>
          <div class="admin-overview-foot">Holding, operating, JV, listed, and partner entities in the structure</div>
        </div>
        <div class="admin-overview-card">
          <div class="admin-overview-label">Departments</div>
          <div class="admin-overview-value">${departmentEntities.length}</div>
          <div class="admin-overview-foot">Functions attached beneath business entities</div>
        </div>
        <div class="admin-overview-card">
          <div class="admin-overview-label">Context Layers</div>
          <div class="admin-overview-value">${entityContextLayers.length}</div>
          <div class="admin-overview-foot">Entity-specific overlays for regulations, appetite, and AI behaviour</div>
        </div>
        <div class="admin-overview-card">
          <div class="admin-overview-label">Org Customisation</div>
          <div class="admin-overview-value">${buCount}</div>
          <div class="admin-overview-foot">Assessment-ready BU context derived from the organisation tree</div>
        </div>
        <div class="admin-overview-card">
          <div class="admin-overview-label">Document Library</div>
          <div class="admin-overview-value">${docCount}</div>
          <div class="admin-overview-foot">Used for citations and document-grounded AI support</div>
        </div>
      </div>
    </div>
  </details>`;

  setPage(adminLayout('settings', `
    <div class="settings-shell">
      <div class="settings-shell__header">
        <div class="flex items-center justify-between" style="gap:var(--sp-4);flex-wrap:wrap">
          <div>
            <h2>${settingsSectionMeta[currentSettingsSection].title}</h2>
            <p style="margin-top:6px">${settingsSectionMeta[currentSettingsSection].description}</p>
          </div>
          <div class="admin-shell-note">Keep the main operating action simple: assess likely downstream impact, then save only when the end-user effect is clear.</div>
        </div>
        <div class="admin-guidance-strip">
          <span class="admin-guidance-strip__label">Admin guidance</span>
          <strong>${currentSettingsSection === 'org' ? 'Structure first' : currentSettingsSection === 'users' ? 'Access review first' : currentSettingsSection === 'defaults' ? 'Thresholds first' : currentSettingsSection === 'governance' ? 'Guidance first' : currentSettingsSection === 'company' ? 'Build first' : 'One intentional change at a time'}</strong>
          <span>${adminGuidanceCopy}</span>
        </div>
      </div>
      <div class="settings-accordion">
        ${adminSectionBody}
      </div>
      ${platformSnapshotMarkup}
      <div class="settings-shell__footer">
        <div id="admin-impact-assessment">${renderAdminImpactAssessment(buildAdminImpactAssessment(settings, settings))}</div>
        <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
          <button class="btn btn--primary" id="btn-save-settings">Save Settings</button>
          <button class="btn btn--secondary" id="btn-assess-admin-impact">Assess End-User Impact</button>
          <details class="results-actions-disclosure admin-footer-overflow">
            <summary class="btn btn--ghost btn--sm">Advanced admin actions</summary>
            <div class="results-actions-disclosure-menu">
              <button class="btn btn--secondary btn--sm" id="btn-export-platform-settings">Export JSON</button>
              <button class="btn btn--secondary btn--sm" id="btn-import-platform-settings">Import JSON</button>
              <button class="btn btn--secondary btn--sm" id="btn-reset-settings">Reset Defaults</button>
            </div>
          </details>
          <span class="form-help">Assess likely downstream impact first, then save admin configuration and user access changes for the platform.</span>
        </div>
      </div>
    </div>`, currentSettingsSection));
  bindSettingsSectionState('admin-settings', document);
  restoreSettingsScroll('admin-settings');

  function rerenderCurrentAdminSection() {
    rememberSettingsScroll('admin-settings');
    safeRenderAdminSettings(currentSettingsSection);
  }

  document.querySelectorAll('[data-admin-route]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      const route = button.dataset.adminRoute || '/admin/settings/org';
      if (route.startsWith('/admin/settings/')) {
        const section = route.split('/').pop() || 'org';
        setPreferredAdminSection(section);
      }
      Router.navigate(route);
    });
  });
  document.getElementById('btn-admin-logout').addEventListener('click', () => { performLogout(); });
  if (currentSettingsSection === 'audit') {
    AdminAuditLogSection.bind({ rerenderCurrentAdminSection });
  }
  const defaultsBindings = currentSettingsSection === 'defaults' || currentSettingsSection === 'governance'
    ? AdminPlatformDefaultsSection.bind({ settings, mode: currentSettingsSection })
    : { regsInput: null, typicalDepartmentsInput: null };
  const { regsInput, typicalDepartmentsInput } = defaultsBindings;
  const structureSummaryEl = currentSettingsSection === 'org' ? document.getElementById('admin-company-structure-summary') : null;
  const layerSummaryEl = currentSettingsSection === 'org' ? document.getElementById('admin-layer-summary-list') : null;
  const profileEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-profile') : null;
  const websiteEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-url') : null;
  const adminCompanyRefinementHistory = [];
  const adminCompanyRefinementHistoryEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-refinement-history') : null;
  const adminCompanyFollowupEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-followup') : null;
  const adminCompanyRefineStatusEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-refine-status') : null;

  AdminOrgSetupSection.configure({
    companyStructure,
    entityContextLayers,
    regsInput,
    profileEl,
    websiteEl,
    structureSummaryEl,
    layerSummaryEl
  });

  function getCurrentAdminCompanySections() {
    return {
      companySummary: document.getElementById('admin-company-section-summary')?.value.trim() || '',
      businessModel: document.getElementById('admin-company-section-business-model')?.value.trim() || '',
      operatingModel: document.getElementById('admin-company-section-operating-model')?.value.trim() || '',
      publicCommitments: document.getElementById('admin-company-section-commitments')?.value.trim() || '',
      keyRiskSignals: document.getElementById('admin-company-section-risks')?.value.trim() || '',
      obligations: document.getElementById('admin-company-section-obligations')?.value.trim() || '',
      sources: document.getElementById('admin-company-section-sources')?.value.trim() || ''
    };
  }

  function applyAdminCompanyContextResult(result = {}) {
    const sections = buildCompanyContextSections(result);
    const profileText = serialiseCompanyContextSections(sections);
    if (profileEl) profileEl.value = profileText;
    const adminCompanySummaryEl = document.getElementById('admin-company-section-summary');
    const adminBusinessModelEl = document.getElementById('admin-company-section-business-model');
    const adminOperatingModelEl = document.getElementById('admin-company-section-operating-model');
    const adminCommitmentsEl = document.getElementById('admin-company-section-commitments');
    const adminRisksEl = document.getElementById('admin-company-section-risks');
    const adminObligationsEl = document.getElementById('admin-company-section-obligations');
    const adminSourcesEl = document.getElementById('admin-company-section-sources');
    if (adminCompanySummaryEl) adminCompanySummaryEl.value = sections.companySummary || '';
    if (adminBusinessModelEl) adminBusinessModelEl.value = sections.businessModel || '';
    if (adminOperatingModelEl) adminOperatingModelEl.value = sections.operatingModel || '';
    if (adminCommitmentsEl) adminCommitmentsEl.value = sections.publicCommitments || '';
    if (adminRisksEl) adminRisksEl.value = sections.keyRiskSignals || '';
    if (adminObligationsEl) adminObligationsEl.value = sections.obligations || '';
    if (adminSourcesEl) adminSourcesEl.value = sections.sources || '';
    const adminContextSummaryEl = document.getElementById('admin-context-summary');
    if (result.companySummary && adminContextSummaryEl && !adminContextSummaryEl.value.trim()) {
      adminContextSummaryEl.value = result.companySummary;
    }
    const adminAiInstructionsEl = document.getElementById('admin-ai-instructions');
    if (result.aiGuidance && adminAiInstructionsEl) {
      adminAiInstructionsEl.value = result.aiGuidance;
    }
    const adminGeoEl = document.getElementById('admin-geo');
    if (result.suggestedGeography && adminGeoEl && !adminGeoEl.value.trim()) {
      adminGeoEl.value = result.suggestedGeography;
    }
    if (Array.isArray(result.regulatorySignals) && result.regulatorySignals.length && regsInput?.setTags) {
      regsInput.setTags(Array.from(new Set([...(regsInput.getTags() || []), ...result.regulatorySignals])));
    }
    return { sections, profileText };
  }

  function renderAdminCompanyRefinementHistory() {
    if (!adminCompanyRefinementHistoryEl) return;
    if (!adminCompanyRefinementHistory.length) {
      adminCompanyRefinementHistoryEl.innerHTML = '<div class="form-help">No follow-up prompts yet. Build the initial context, then iterate here until the summary feels right.</div>';
      return;
    }
    adminCompanyRefinementHistoryEl.innerHTML = adminCompanyRefinementHistory.map(entry => `
      <div class="card" style="padding:var(--sp-3);background:var(--bg-canvas)">
        <div class="context-panel-title" style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${entry.role === 'user' ? 'Your prompt' : 'AI update'}</div>
        <div style="margin-top:6px;color:var(--text-primary);line-height:1.55">${escapeHtml(entry.text || '')}</div>
      </div>`).join('');
  }

  renderAdminCompanyRefinementHistory();

  function buildAdminSettingsPayload() {
    const currentSettings = getAdminSettings();
    const getInputValue = (id, fallback = '') => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : fallback;
    };
    const getNumericValue = (id, fallback) => {
      const el = document.getElementById(id);
      const raw = String(el?.value || '').replace(/,/g, '').trim();
      return Math.max(0, parseFloat(raw) || fallback);
    };
    const warningThresholdUsd = getNumericValue('admin-warning-threshold', currentSettings.warningThresholdUsd || DEFAULT_ADMIN_SETTINGS.warningThresholdUsd);
    const toleranceThresholdUsd = getNumericValue('admin-tolerance-threshold', currentSettings.toleranceThresholdUsd || TOLERANCE_THRESHOLD);
    const annualReviewThresholdUsd = getNumericValue('admin-annual-threshold', currentSettings.annualReviewThresholdUsd || DEFAULT_ADMIN_SETTINGS.annualReviewThresholdUsd);
    const companyContextSections = {
      companySummary: getInputValue('admin-company-section-summary', currentSettings.companyContextSections?.companySummary || ''),
      businessModel: getInputValue('admin-company-section-business-model', currentSettings.companyContextSections?.businessModel || ''),
      operatingModel: getInputValue('admin-company-section-operating-model', currentSettings.companyContextSections?.operatingModel || ''),
      publicCommitments: getInputValue('admin-company-section-commitments', currentSettings.companyContextSections?.publicCommitments || ''),
      keyRiskSignals: getInputValue('admin-company-section-risks', currentSettings.companyContextSections?.keyRiskSignals || ''),
      obligations: getInputValue('admin-company-section-obligations', currentSettings.companyContextSections?.obligations || ''),
      sources: getInputValue('admin-company-section-sources', currentSettings.companyContextSections?.sources || '')
    };
    return {
      warningThresholdUsd,
      toleranceThresholdUsd,
      annualReviewThresholdUsd,
      payload: {
        ...currentSettings,
        companyContextSections,
        geography: getInputValue('admin-geo', currentSettings.geography || DEFAULT_ADMIN_SETTINGS.geography) || DEFAULT_ADMIN_SETTINGS.geography,
        companyWebsiteUrl: getInputValue('admin-company-url', currentSettings.companyWebsiteUrl || ''),
        companyContextProfile: serialiseCompanyContextSections(companyContextSections),
        companyStructure,
        entityContextLayers,
        defaultLinkMode: document.getElementById('admin-link-mode') ? document.getElementById('admin-link-mode').value === 'yes' : !!currentSettings.defaultLinkMode,
        toleranceThresholdUsd,
        warningThresholdUsd,
        annualReviewThresholdUsd,
        riskAppetiteStatement: getInputValue('admin-appetite', currentSettings.riskAppetiteStatement || DEFAULT_ADMIN_SETTINGS.riskAppetiteStatement) || DEFAULT_ADMIN_SETTINGS.riskAppetiteStatement,
        applicableRegulations: regsInput?.getTags ? regsInput.getTags() : (Array.isArray(currentSettings.applicableRegulations) ? currentSettings.applicableRegulations : [...DEFAULT_ADMIN_SETTINGS.applicableRegulations]),
        typicalDepartments: typicalDepartmentsInput?.getTags ? typicalDepartmentsInput.getTags() : getTypicalDepartments(currentSettings),
        aiInstructions: getInputValue('admin-ai-instructions', currentSettings.aiInstructions || ''),
        benchmarkStrategy: getInputValue('admin-benchmark-strategy', currentSettings.benchmarkStrategy || DEFAULT_ADMIN_SETTINGS.benchmarkStrategy) || DEFAULT_ADMIN_SETTINGS.benchmarkStrategy,
        adminContextSummary: getInputValue('admin-context-summary', currentSettings.adminContextSummary || DEFAULT_ADMIN_SETTINGS.adminContextSummary) || DEFAULT_ADMIN_SETTINGS.adminContextSummary,
        adminContextVisibleToUsers: document.getElementById('admin-context-visible-users') ? document.getElementById('admin-context-visible-users').checked : currentSettings.adminContextVisibleToUsers !== false,
        escalationGuidance: getInputValue('admin-escalation-guidance', currentSettings.escalationGuidance || DEFAULT_ADMIN_SETTINGS.escalationGuidance) || DEFAULT_ADMIN_SETTINGS.escalationGuidance
      }
    };
  }

  function assessAdminSettingsImpact() {
    const { payload } = buildAdminSettingsPayload();
    const assessment = buildAdminImpactAssessment(getAdminSettings(), payload);
    const host = document.getElementById('admin-impact-assessment');
    if (host) host.innerHTML = renderAdminImpactAssessment(assessment);
    return assessment;
  }

  async function persistAdminSettings(showToast = false) {
    const { warningThresholdUsd, toleranceThresholdUsd, annualReviewThresholdUsd, payload } = buildAdminSettingsPayload();
    if (warningThresholdUsd > toleranceThresholdUsd) return false;
    if (annualReviewThresholdUsd < toleranceThresholdUsd) return false;
    const saved = await saveAdminSettings(payload);
    if (!saved) return false;
    if (!AppState.draft.geography) AppState.draft.geography = getAdminSettings().geography;
    saveDraft();
    if (showToast) UI.toast('Settings saved.', 'success');
    return true;
  }

  const adminSettingsRoot = document.querySelector('.settings-shell');
  bindAutosave(adminSettingsRoot, () => persistAdminSettings(false));





  document.getElementById('btn-assess-admin-impact')?.addEventListener('click', () => {
    assessAdminSettingsImpact();
    UI.toast('End-user impact review updated.', 'info');
  });

  document.getElementById('btn-export-platform-settings')?.addEventListener('click', () => {
    ExportService.exportDataAsJson(getAdminSettings(), 'risk-calculator-platform-settings.json');
  });

  document.getElementById('btn-import-platform-settings')?.addEventListener('click', () => {
    ExportService.importJsonFile({
      onData: async parsed => {
        if (!parsed || typeof parsed !== 'object') {
          UI.toast('That file does not contain valid platform settings.', 'warning');
          return;
        }
        const saved = await saveAdminSettings(parsed);
        if (!saved) return;
        safeRenderAdminSettings(currentSettingsSection);
        UI.toast('Platform settings imported.', 'success');
      },
      onError: () => UI.toast('That JSON file could not be imported.', 'warning')
    });
  });

  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const { warningThresholdUsd, toleranceThresholdUsd, annualReviewThresholdUsd } = buildAdminSettingsPayload();
    if (warningThresholdUsd > toleranceThresholdUsd) {
      UI.toast('Warning trigger must be less than or equal to the tolerance threshold.', 'warning');
      return;
    }
    if (annualReviewThresholdUsd < toleranceThresholdUsd) {
      UI.toast('Annual review trigger should be greater than or equal to the tolerance threshold.', 'warning');
      return;
    }
    const impactAssessment = assessAdminSettingsImpact();
    if (impactAssessment.counts.high || impactAssessment.counts.medium >= 3) {
      const topItems = impactAssessment.impacts.slice(0, 3).map(item => `- ${item.title}`).join('\n');
      const proceed = await UI.confirm(`Review before saving:
${topItems}${impactAssessment.impacts.length > 3 ? `\n- +${impactAssessment.impacts.length - 3} more` : ''}\n\nSave these admin changes anyway?`);
      if (!proceed) return;
    }
    const accessSaved = await AdminUserAccountsSection.applyPendingChanges();
    if (!accessSaved) return;
    await persistAdminSettings(true);
  });
  if (currentSettingsSection === 'company') document.getElementById('btn-build-company-context')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-build-company-context');
    const websiteUrl = websiteEl.value.trim();
    const llmConfig = {
      apiUrl: document.getElementById('admin-compass-url')?.value.trim() || DEFAULT_COMPASS_PROXY_URL,
      model: document.getElementById('admin-compass-model')?.value.trim() || 'gpt-5.1',
      apiKey: document.getElementById('admin-compass-key')?.value.trim() || ''
    };
    if (!websiteUrl) {
      UI.toast('Enter a company website URL first.', 'warning');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Building context…';
    try {
      LLMService.setCompassConfig(llmConfig);
      const uploaded = await loadContextSupportSource('admin-company-source-file', 'admin-company-source-help');
      let result = await LLMService.buildCompanyContext(websiteUrl);
      let { sections, profileText } = applyAdminCompanyContextResult(result);
      if (uploaded.text) {
        result = await LLMService.refineCompanyContext({
          websiteUrl,
          currentSections: getCurrentAdminCompanySections(),
          currentAiGuidance: document.getElementById('admin-ai-instructions')?.value.trim() || '',
          currentGeography: document.getElementById('admin-geo')?.value.trim() || '',
          currentRegulations: regsInput?.getTags ? regsInput.getTags() : [],
          history: [],
          userPrompt: 'Incorporate the uploaded strategy, policy, procedure, and operating-model material into this company context draft while keeping it concise and grounded.',
          uploadedText: '',
          uploadedDocumentName: ''
        });
        ({ sections, profileText } = applyAdminCompanyContextResult(result));
      }
      adminCompanyRefinementHistory.length = 0;
      adminCompanyRefinementHistory.push({ role: 'assistant', text: uploaded.text ? 'Initial company context draft created and refined using the uploaded source material. Use follow-up prompts below if you want to reshape it further.' : 'Initial company context draft created. Use follow-up prompts below if you want to reshape it further.' });
      renderAdminCompanyRefinementHistory();
      if (adminCompanyRefineStatusEl) adminCompanyRefineStatusEl.textContent = 'Initial AI draft applied. Use the follow-up prompt box below to keep refining it.';
      AdminOrgSetupSection.openEntityEditor(null, {
        name: inferCompanyNameFromUrl(websiteUrl),
        websiteUrl,
        profile: profileText,
        contextSections: sections,
        type: 'Holding company'
      });
      UI.toast('Company context built from public sources. Review the entity and place it into the organisation tree.', 'success', 5000);
    } catch (error) {
      UI.toast('Company context build failed. Try again or shorten the source material.', 'danger', 6000);
      if (adminCompanyRefineStatusEl) adminCompanyRefineStatusEl.textContent = 'Company context build failed. Try again or shorten the source material.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Build from Website';
    }
  });
  if (currentSettingsSection === 'company') document.getElementById('btn-refine-admin-company-context')?.addEventListener('click', async () => {
    const prompt = adminCompanyFollowupEl?.value.trim() || '';
    const websiteUrl = websiteEl?.value.trim() || '';
    const llmConfig = {
      apiUrl: document.getElementById('admin-compass-url')?.value.trim() || DEFAULT_COMPASS_PROXY_URL,
      model: document.getElementById('admin-compass-model')?.value.trim() || 'gpt-5.1',
      apiKey: document.getElementById('admin-compass-key')?.value.trim() || ''
    };
    if (!websiteUrl) {
      UI.toast('Enter a company website URL first.', 'warning');
      return;
    }
    if (!prompt) {
      UI.toast('Enter a follow-up prompt first.', 'warning');
      return;
    }
    const btn = document.getElementById('btn-refine-admin-company-context');
    btn.disabled = true;
    btn.textContent = 'Applying…';
    try {
      if (adminCompanyRefineStatusEl) adminCompanyRefineStatusEl.textContent = 'Applying your latest instruction to the company context…';
      adminCompanyRefinementHistory.push({ role: 'user', text: prompt });
      renderAdminCompanyRefinementHistory();
      LLMService.setCompassConfig(llmConfig);
      const uploaded = await loadContextSupportSource('admin-company-source-file', 'admin-company-source-help');
      const refineInput = {
        websiteUrl,
        currentSections: getCurrentAdminCompanySections(),
        currentAiGuidance: document.getElementById('admin-ai-instructions')?.value.trim() || '',
        currentGeography: document.getElementById('admin-geo')?.value.trim() || '',
        currentRegulations: regsInput?.getTags ? regsInput.getTags() : [],
        history: adminCompanyRefinementHistory,
        userPrompt: prompt,
        uploadedText: uploaded.text,
        uploadedDocumentName: uploaded.name
      };
      let result;
      try {
        result = await LLMService.refineCompanyContext(refineInput);
      } catch {
        result = buildLocalCompanyContextFallback(refineInput);
      }
      applyAdminCompanyContextResult(result);
      adminCompanyRefinementHistory.push({ role: 'assistant', text: result.responseMessage || 'I refined the company context based on your latest prompt.' });
      renderAdminCompanyRefinementHistory();
      if (adminCompanyFollowupEl) adminCompanyFollowupEl.value = '';
      if (adminCompanyRefineStatusEl) adminCompanyRefineStatusEl.textContent = 'Latest follow-up applied. Keep iterating until the context feels right.';
      UI.toast('Admin company context refined.', 'success', 5000);
    } catch (error) {
      UI.toast('Company context refinement failed. Try again or shorten the prompt.', 'danger', 6000);
      if (adminCompanyRefineStatusEl) adminCompanyRefineStatusEl.textContent = 'Company context refinement failed. Try again or shorten the prompt.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Follow-Up Now';
    }
  });
  if (currentSettingsSection === 'access') {
    AdminSystemAccessSection.bind({ rerenderCurrentAdminSection });
  }


  if (currentSettingsSection === 'org') {
    AdminOrgSetupSection.bind({
      companyStructure,
      entityContextLayers,
      regsInput,
      profileEl,
      websiteEl,
      structureSummaryEl,
      layerSummaryEl
    });
  }

  if (currentSettingsSection === 'users') {
    AdminUserAccountsSection.bind({
      companyStructure,
      rerenderCurrentAdminSection
    });
  }


  document.getElementById('btn-reset-settings')?.addEventListener('click', async () => {
    if (await UI.confirm('Reset platform settings to defaults?')) {
      const resetSettings = JSON.parse(JSON.stringify(DEFAULT_ADMIN_SETTINGS));
      const saved = await saveAdminSettings(resetSettings);
      if (!saved) return;
      if (!AppState.draft.geography) AppState.draft.geography = resetSettings.geography;
      saveDraft();
      UI.toast('Settings reset.', 'success');
      rerenderCurrentAdminSection();
    }
  });
}

function safeRenderAdminSettings(section = getPreferredAdminSection()) {
  try {
    renderAdminSettings(section);
  } catch (error) {
    console.error('safeRenderAdminSettings fallback:', error);
    try {
      setPreferredAdminSection('org');
      renderAdminSettings('org');
      UI.toast('A problem affected the selected admin section, so the page reopened in Organisation Setup.', 'warning', 5000);
    } catch (fallbackError) {
      console.error('safeRenderAdminSettings hard failure:', fallbackError);
      const errorMessage = String(fallbackError?.message || error?.message || 'Unknown admin render error');
      setPage(`<main class="page"><div class="container" style="padding:var(--sp-12)"><div class="card"><h2>Admin Screen Error</h2><p style="margin-top:8px;color:var(--text-muted)">The selected admin screen could not be opened. Return to Organisation Setup and try again.</p><div class="form-help mt-4" style="word-break:break-word"><strong>Error:</strong> ${errorMessage}</div><div class="flex items-center gap-3 mt-6"><a class="btn btn--primary" href="#/admin/settings/org">Open Organisation Setup</a><a class="btn btn--ghost" href="#/dashboard">Home</a></div></div></div></main>`);
    }
  }
}

function renderAdminBU() {
  if (!requireAdmin()) return;
  const settings = getAdminSettings();
  const companyStructure = Array.isArray(settings.companyStructure) ? settings.companyStructure : [];
  const structureMap = new Map(companyStructure.map(node => [node.id, node]));
  const companyEntities = getCompanyEntities(companyStructure);
  const departmentEntities = getDepartmentEntities(companyStructure);
  const managedAccounts = getManagedAccountsForAdmin(settings);
  const accountLabelByUsername = new Map(managedAccounts.map(account => [account.username, account.displayName]));
  const topLevelCompanies = getChildCompanyEntities(companyStructure, '');

  function renderDepartmentCard(department) {
    const departmentLayer = getEntityLayerById(settings, department.id);
    const ownerLabel = department.ownerUsername ? (accountLabelByUsername.get(department.ownerUsername) || department.ownerUsername) : 'No owner';
    const contextLabel = departmentLayer?.contextSummary ? 'Saved context' : 'No saved context';
    return `
      <div class="org-related-card org-related-card--compact org-theme--department">
        <div class="org-related-card__head">
          <div>
            <div class="org-related-card__title">${department.name}</div>
            <div class="form-help">${department.departmentRelationshipType || 'In-house'} · ${ownerLabel} · ${contextLabel}</div>
          </div>
          <div class="flex items-center gap-3" style="flex-wrap:wrap">
            <button class="btn btn--ghost btn--sm btn-edit-department" data-department-id="${department.id}" type="button">Edit</button>
            <button class="btn btn--secondary btn--sm btn-edit-department-context" data-department-id="${department.id}" type="button">Context</button>
          </div>
        </div>
      </div>`;
  }

  function collectCompanySearchText(entity) {
    const entityLayer = getEntityLayerById(settings, entity.id);
    const departments = getDepartmentEntities(companyStructure, entity.id);
    const childCompanies = getChildCompanyEntities(companyStructure, entity.id);
    const ownerLabel = entity.ownerUsername ? (accountLabelByUsername.get(entity.ownerUsername) || entity.ownerUsername) : 'No owner';
    return [
      entity.name,
      entity.type,
      ownerLabel,
      entityLayer?.contextSummary || entity.profile || '',
      getEntityLineageLabel(companyStructure, entity.id) || '',
      ...departments.flatMap(department => {
        const departmentLayer = getEntityLayerById(settings, department.id);
        return [
          department.name,
          department.departmentRelationshipType || '',
          department.ownerUsername ? (accountLabelByUsername.get(department.ownerUsername) || department.ownerUsername) : '',
          departmentLayer?.contextSummary || ''
        ];
      }),
      ...childCompanies.map(child => collectCompanySearchText(child))
    ].flat().filter(Boolean).join(' ').toLowerCase();
  }

  function renderCompanyNode(entity, depth = 0) {
    const entityLayer = getEntityLayerById(settings, entity.id);
    const departments = getDepartmentEntities(companyStructure, entity.id);
    const childCompanies = getChildCompanyEntities(companyStructure, entity.id);
    const lineage = getEntityLineageLabel(companyStructure, entity.id) || entity.name;
    const summary = truncateText(entityLayer?.contextSummary || entity.profile || 'No saved context yet.', 120);
    const ownerLabel = entity.ownerUsername ? (accountLabelByUsername.get(entity.ownerUsername) || entity.ownerUsername) : 'No owner';
    const childMarkup = childCompanies.length ? childCompanies.map(child => renderCompanyNode(child, depth + 1)).join('') : '';
    return `
      <details class="org-accordion ${getOrgEntityThemeClass(entity.type)} org-company-row" data-search="${escapeHtml(collectCompanySearchText(entity))}" ${depth < 1 ? 'open' : ''} style="margin-left:${depth * 16}px">
        <summary class="org-accordion__summary">
          <div class="org-accordion__identity">
            <span class="badge badge--gold">${entity.type}</span>
            <strong>${entity.name}</strong>
            <span class="form-help">${departments.length} functions · ${childCompanies.length} child entities · ${ownerLabel}</span>
          </div>
          <div class="org-accordion__meta">
            <span class="form-help">${entityLayer?.contextSummary ? 'Saved context' : 'No saved context'}</span>
          </div>
        </summary>
        <div class="org-accordion__body">
          <div class="org-accordion__toolbar">
            <div class="form-help">${lineage}</div>
            <div class="flex items-center gap-3" style="flex-wrap:wrap">
              <button class="btn btn--secondary btn--sm btn-edit-company-context" data-company-id="${entity.id}" type="button">Manage Context</button>
              <button class="btn btn--primary btn--sm btn-create-department" data-company-id="${entity.id}" type="button">Add Function</button>
            </div>
          </div>
          <div class="org-accordion__snapshot">${summary}</div>
          ${departments.length ? `
            <div class="org-accordion__section">
              <div class="org-accordion__label">Functions</div>
              <div style="display:flex;flex-direction:column;gap:8px">${departments.map(renderDepartmentCard).join('')}</div>
            </div>` : ''}
          ${childMarkup ? `
            <div class="org-accordion__section">
              <div class="org-accordion__label">Child Entities</div>
              <div style="display:flex;flex-direction:column;gap:12px">${childMarkup}</div>
            </div>` : ''}
        </div>
      </details>`;
  }

  setPage(adminLayout('bu', `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2>Organisation Customisation</h2>
        <p style="margin-top:6px">Review entities and functions, then open context editing only on the node you need to change.</p>
      </div>
      <div class="flex gap-3">
        <a class="btn btn--primary btn--sm" href="#/admin/settings/org">Organisation Setup</a>
      </div>
    </div>
    <div class="admin-workbench-strip admin-workbench-strip--compact mb-5">
      <div>
        <div class="admin-workbench-strip__label">Workbench</div>
        <strong>Search the hierarchy, then edit the specific entity or function that needs attention.</strong>
        <span>${topLevelCompanies.length} top-level entities · ${companyEntities.length} entities · ${departmentEntities.length} functions.</span>
      </div>
      <div class="admin-workbench-strip__meta">
        <input class="form-input" id="org-customisation-search" type="search" placeholder="Search entity, type, owner, or context" style="min-width:min(320px,100%);max-width:420px">
      </div>
    </div>
    ${topLevelCompanies.length ? `
      <div class="org-accordion-list">
        ${topLevelCompanies.map(entity => renderCompanyNode(entity)).join('')}
      </div>` : `
      <div class="card card--elevated">
        <div class="context-panel-title">No organisation structure yet</div>
        <p class="context-panel-copy">Add entities first, then add functions underneath the owning entity.</p>
      </div>`}`));

  document.getElementById('btn-admin-logout').addEventListener('click', () => { performLogout(); });
  document.getElementById('org-customisation-search')?.addEventListener('input', event => {
    const query = String(event.target.value || '').trim().toLowerCase();
    document.querySelectorAll('.org-company-row').forEach(row => {
      row.hidden = !!query && !String(row.dataset.search || '').includes(query);
    });
  });
  document.querySelectorAll('.btn-edit-company-context').forEach(button => {
    button.addEventListener('click', () => {
      const entity = structureMap.get(button.dataset.companyId || '');
      if (!entity) return;
      openEntityContextLayerEditor({
        entity,
        settings,
        onSave: async (nextLayer, modal) => {
          const nextSettings = getAdminSettings();
          const layers = Array.isArray(nextSettings.entityContextLayers) ? [...nextSettings.entityContextLayers] : [];
          const index = layers.findIndex(item => item.entityId === nextLayer.entityId);
          if (index > -1) layers[index] = nextLayer;
          else layers.push(nextLayer);
          const saved = await saveAdminSettings({
            ...nextSettings,
            entityContextLayers: layers
          });
          if (!saved) return;
          modal.close();
          UI.toast(`Saved context for ${entity.name}.`, 'success');
          renderAdminBU();
        }
      });
    });
  });
  document.querySelectorAll('.btn-create-department').forEach(button => {
    button.addEventListener('click', () => {
      const company = structureMap.get(button.dataset.companyId || '');
      if (!company) return;
      openOrgEntityEditor({
        structure: companyStructure,
        seed: {
          type: 'Department / function',
          parentId: company.id
        },
        onSave: async (node, modal) => {
          const nextSettings = getAdminSettings();
          const nextStructure = Array.isArray(nextSettings.companyStructure) ? [...nextSettings.companyStructure] : [];
          nextStructure.push(node);
          const saved = await saveAdminSettings({
            ...nextSettings,
            companyStructure: nextStructure
          });
          if (!saved) return;
          modal.close();
          UI.toast(`${node.name} added beneath ${company.name}.`, 'success');
          renderAdminBU();
        }
      });
    });
  });
  document.querySelectorAll('.btn-edit-department').forEach(button => {
    button.addEventListener('click', () => {
      const department = structureMap.get(button.dataset.departmentId || '');
      if (!department) return;
      openOrgEntityEditor({
        structure: companyStructure,
        existingNode: department,
        onSave: async (node, modal) => {
          const nextSettings = getAdminSettings();
          const nextStructure = Array.isArray(nextSettings.companyStructure) ? [...nextSettings.companyStructure] : [];
          const index = nextStructure.findIndex(item => item.id === node.id);
          if (index > -1) nextStructure[index] = node;
          const saved = await saveAdminSettings({
            ...nextSettings,
            companyStructure: nextStructure
          });
          if (!saved) return;
          modal.close();
          UI.toast(`${node.name} updated.`, 'success');
          renderAdminBU();
        }
      });
    });
  });
  document.querySelectorAll('.btn-edit-department-context').forEach(button => {
    button.addEventListener('click', () => {
      const department = structureMap.get(button.dataset.departmentId || '');
      if (!department) return;
      openEntityContextLayerEditor({
        entity: department,
        settings,
        onSave: async (nextLayer, modal) => {
          const nextSettings = getAdminSettings();
          const layers = Array.isArray(nextSettings.entityContextLayers) ? [...nextSettings.entityContextLayers] : [];
          const index = layers.findIndex(item => item.entityId === nextLayer.entityId);
          if (index > -1) layers[index] = nextLayer;
          else layers.push(nextLayer);
          const saved = await saveAdminSettings({
            ...nextSettings,
            entityContextLayers: layers
          });
          if (!saved) return;
          modal.close();
          UI.toast(`Saved context for ${department.name}.`, 'success');
          renderAdminBU();
        }
      });
    });
  });
}

function openBUEditor(bu, options = {}) {
  const isNew = !bu;
  const settings = getAdminSettings();
  const companyStructure = Array.isArray(settings.companyStructure) ? settings.companyStructure : [];
  const structureMap = new Map(companyStructure.map(node => [node.id, node]));
  let ti = {};
  const m = UI.modal({
    title: isNew ? 'Add Business Unit Context' : `Manage BU Context: ${bu.name}`,
    body: `<form id="bu-form"><div class="grid-2" style="gap:12px">
      <div class="form-group"><label class="form-label">ID</label><input class="form-input" id="bu-id" value="${bu?.id||''}" placeholder="bu-example" ${!isNew?'readonly':''}></div>
      <div class="form-group"><label class="form-label">Business Unit Name</label><input class="form-input" id="bu-name" value="${bu?.name||''}"></div>
    </div>
    <div class="grid-2 mt-4" style="gap:12px">
      <div class="form-group">
        <label class="form-label">Mapped Company Entity</label>
        <select class="form-select" id="bu-org-entity">
          <option value="">Not linked yet</option>
          ${getCompanyEntities(companyStructure).map(node => `<option value="${node.id}" ${bu?.orgEntityId === node.id ? 'selected' : ''}>${node.name} (${node.type})</option>`).join('')}
        </select>
        <span class="form-help">Link this business unit to the company entity it represents in Organisation Setup.</span>
      </div>
      <div class="form-group">
        <label class="form-label">BU Geography Override</label>
        <input class="form-input" id="bu-geo" value="${bu?.geography || ''}" placeholder="Optional geography override">
      </div>
    </div>
    <div class="card mt-4" style="padding:var(--sp-4);background:var(--bg-canvas)">
      <div class="context-panel-title">Linked Entity Context</div>
      <div id="bu-linked-entity-summary" class="form-help">Select a mapped company entity to see inherited organisation context.</div>
      <div class="flex items-center gap-3 mt-3" style="flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" id="btn-apply-linked-context" type="button">Apply Linked Context</button>
        <span class="form-help">Fills empty or default business-unit fields from the linked company entity and its context layer.</span>
      </div>
    </div>
    <div class="form-group mt-4"><label class="form-label">Critical Services</label><div class="tag-input-wrap" id="ti-services"></div></div>
    <div class="form-group mt-4"><label class="form-label">Key Systems</label><div class="tag-input-wrap" id="ti-systems"></div></div>
    <div class="form-group mt-4"><label class="form-label">Data Types</label><div class="tag-input-wrap" id="ti-datatypes"></div></div>
    <div class="form-group mt-4"><label class="form-label">Regulatory Tags</label><div class="tag-input-wrap" id="ti-regtags"></div></div>
    <div class="form-group mt-4"><label class="form-label">Business Unit Context Summary</label><textarea class="form-textarea" id="bu-context" rows="3">${bu?.contextSummary||''}</textarea></div>
    <label class="form-checkbox mt-3">
      <input type="checkbox" id="bu-context-visible-users" ${bu?.contextVisibleToUsers !== false ? 'checked' : ''}>
      <span>Show this BU context summary to end users</span>
    </label>
    <div class="form-help" style="margin-top:6px">When off, the BU context still shapes inherited assessment behavior and AI grounding but is not shown verbatim in lower-layer dashboards.</div>
    <div class="grid-2 mt-4" style="gap:12px">
      <div class="form-group">
        <label class="form-label">BU Linked-Risk Default</label>
        <select class="form-select" id="bu-link-mode">
          <option value="inherit" ${typeof bu?.defaultLinkMode === 'boolean' ? '' : 'selected'}>Inherit platform default</option>
          <option value="yes" ${bu?.defaultLinkMode === true ? 'selected' : ''}>Enabled</option>
          <option value="no" ${bu?.defaultLinkMode === false ? 'selected' : ''}>Disabled</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">BU Benchmark Strategy</label>
        <textarea class="form-textarea" id="bu-benchmark-strategy" rows="2">${bu?.benchmarkStrategy||''}</textarea>
      </div>
    </div>
    <div class="form-group mt-4"><label class="form-label">Business Unit AI Guidance</label><textarea class="form-textarea" id="bu-ai-guidance" rows="3">${bu?.aiGuidance||''}</textarea></div>
    <div class="form-group mt-4"><label class="form-label">BU Risk Appetite Statement</label><textarea class="form-textarea" id="bu-risk-appetite" rows="3">${bu?.riskAppetiteStatement||''}</textarea></div>
    <div class="form-group mt-4"><label class="form-label">BU Escalation Guidance</label><textarea class="form-textarea" id="bu-escalation-guidance" rows="3">${bu?.escalationGuidance||''}</textarea></div>
    <div class="grid-3 mt-4" style="gap:12px">
      <div class="form-group"><label class="form-label">BU Warning Trigger (USD)</label><input class="form-input money-input" id="bu-warning-threshold" type="text" inputmode="numeric" value="${bu?.warningThresholdUsd ? formatCurrencyInputValue(bu.warningThresholdUsd, 'USD') : ''}" placeholder="Inherit platform default"></div>
      <div class="form-group"><label class="form-label">BU Tolerance Threshold (USD)</label><input class="form-input money-input" id="bu-tolerance-threshold" type="text" inputmode="numeric" value="${bu?.toleranceThresholdUsd ? formatCurrencyInputValue(bu.toleranceThresholdUsd, 'USD') : ''}" placeholder="Inherit platform default"></div>
      <div class="form-group"><label class="form-label">BU Annual Review Trigger (USD)</label><input class="form-input money-input" id="bu-annual-threshold" type="text" inputmode="numeric" value="${bu?.annualReviewThresholdUsd ? formatCurrencyInputValue(bu.annualReviewThresholdUsd, 'USD') : ''}" placeholder="Inherit platform default"></div>
    </div>
    <div class="form-group mt-4"><label class="form-label">Notes</label><textarea class="form-textarea" id="bu-notes" rows="2">${bu?.notes||''}</textarea></div>
    </form>`,
    footer: `<button class="btn btn--ghost" id="bu-cancel">Cancel</button><button class="btn btn--primary" id="bu-save">Save</button>`
  });
  requestAnimationFrame(() => {
    ti.services  = UI.tagInput('ti-services',  bu?.criticalServices||[]);
    ti.systems   = UI.tagInput('ti-systems',   bu?.keySystems||[]);
    ti.datatypes = UI.tagInput('ti-datatypes', bu?.dataTypes||[]);
    ti.regtags   = UI.tagInput('ti-regtags',   bu?.regulatoryTags||[]);
    attachFormattedMoneyInputs();
  });

  function renderLinkedEntitySummary() {
    const entityId = document.getElementById('bu-org-entity').value || '';
    const summaryEl = document.getElementById('bu-linked-entity-summary');
    const entity = structureMap.get(entityId);
    const layer = getEntityLayerById(settings, entityId);
    if (!entity || !summaryEl) {
      summaryEl.innerHTML = 'Select a mapped company entity to see inherited organisation context.';
      return;
    }
    const parts = [
      `<strong>${entity.name}</strong>`,
      entity.type,
      getEntityLineageLabel(companyStructure, entityId),
      layer?.geography ? `Layer geography: ${layer.geography}` : '',
      layer?.applicableRegulations?.length ? `Layer regulations: ${layer.applicableRegulations.join(', ')}` : '',
      layer?.contextSummary ? `Layer summary: ${layer.contextSummary}` : '',
      entity.profile ? `Entity profile captured` : ''
    ].filter(Boolean);
    summaryEl.innerHTML = parts.join('<br>');
  }

  function applyLinkedEntityContext(force = false) {
    const entityId = document.getElementById('bu-org-entity').value || '';
    const entity = structureMap.get(entityId);
    if (!entity) return;
    const layer = getEntityLayerById(settings, entityId);
    const geoEl = document.getElementById('bu-geo');
    const contextEl = document.getElementById('bu-context');
    const aiEl = document.getElementById('bu-ai-guidance');
    const notesEl = document.getElementById('bu-notes');
    const inheritedRegs = Array.from(new Set([...(layer?.applicableRegulations || [])]));
    if (force || !geoEl.value.trim()) geoEl.value = layer?.geography || geoEl.value;
    if (force || !contextEl.value.trim()) contextEl.value = layer?.contextSummary || entity.profile || contextEl.value;
    if (force || !aiEl.value.trim()) aiEl.value = layer?.aiInstructions || aiEl.value;
    if (force || !notesEl.value.trim()) notesEl.value = entity.type ? `Mapped from organisation entity: ${entity.type}.` : notesEl.value;
    if (inheritedRegs.length) {
      const nextTags = force
        ? inheritedRegs
        : Array.from(new Set([...(ti.regtags?.getTags() || []), ...inheritedRegs]));
      ti.regtags?.setTags(nextTags);
    }
    renderLinkedEntitySummary();
  }

  document.getElementById('bu-org-entity').addEventListener('change', () => {
    renderLinkedEntitySummary();
    if (isNew) applyLinkedEntityContext(false);
  });
  document.getElementById('btn-apply-linked-context').addEventListener('click', () => applyLinkedEntityContext(true));
  setTimeout(renderLinkedEntitySummary, 0);
  document.getElementById('bu-cancel').addEventListener('click', () => m.close());
  document.getElementById('bu-save').addEventListener('click', () => {
    const id = document.getElementById('bu-id').value.trim();
    const name = document.getElementById('bu-name').value.trim();
    if (!id||!name) { UI.toast('ID and Name required.','warning'); return; }
    const parseMoney = (id) => {
      const raw = String(document.getElementById(id)?.value || '').replace(/,/g, '').trim();
      const value = parseFloat(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    };
    const linkModeValue = document.getElementById('bu-link-mode').value;
    const updated = {
      id,
      name,
      orgEntityId: document.getElementById('bu-org-entity').value || '',
      geography: document.getElementById('bu-geo').value.trim(),
      criticalServices: ti.services.getTags(),
      keySystems: ti.systems.getTags(),
      dataTypes: ti.datatypes.getTags(),
      regulatoryTags: ti.regtags.getTags(),
      contextSummary: document.getElementById('bu-context').value.trim(),
      contextVisibleToUsers: document.getElementById('bu-context-visible-users')?.checked !== false,
      aiGuidance: document.getElementById('bu-ai-guidance').value.trim(),
      benchmarkStrategy: document.getElementById('bu-benchmark-strategy').value.trim(),
      defaultLinkMode: linkModeValue === 'inherit' ? null : linkModeValue === 'yes',
      riskAppetiteStatement: document.getElementById('bu-risk-appetite').value.trim(),
      escalationGuidance: document.getElementById('bu-escalation-guidance').value.trim(),
      warningThresholdUsd: parseMoney('bu-warning-threshold'),
      toleranceThresholdUsd: parseMoney('bu-tolerance-threshold'),
      annualReviewThresholdUsd: parseMoney('bu-annual-threshold'),
      notes: document.getElementById('bu-notes').value,
      defaultAssumptions: bu?.defaultAssumptions||{},
      docIds: bu?.docIds||[]
    };
    const list = getBUList();
    const idx = list.findIndex(b=>b.id===id);
    if (idx>-1) list[idx]=updated; else list.push(updated);
    saveBUList(list);
    options.onSave?.(updated);
    m.close();
    Router.resolve();
    UI.toast(`Context for "${name}" ${isNew?'added':'updated'}.`,'success');
  });
}

function renderAdminDocs() {
  return AdminDocumentLibrarySection.renderRoute();
}

function openDocEditor(doc) {
  return AdminDocumentLibrarySection.openEditor(doc);
}

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
  try {
    await AuthService.init();
    await loadSharedAdminSettings();
    if (AuthService.getCurrentUser()?.username) {
      await loadSharedUserState(AuthService.getCurrentUser().username);
    }
    AppState.buList  = await loadJSON('./data/bu.json');
    AppState.docList = await loadJSON('./data/docs.json');
    AppState.benchmarkList = await loadJSON('./data/benchmarks.json');
  } catch(e) {
    console.error('Failed to load JSON data:', e);
    AppState.buList = []; AppState.docList = []; AppState.benchmarkList = [];
  }
  RAGService.init(getDocList(), getBUList());
  BenchmarkService.init(AppState.benchmarkList);
  activateAuthenticatedState();

  Router
    .on('/login', renderLogin)
    .on('/', () => {
      if (!AuthService.isAuthenticated()) {
        Router.navigate('/login');
        return;
      }
      Router.navigate('/dashboard');
    })
    .on('/dashboard', renderUserDashboard)
    .on('/wizard/1', withAuth(renderWizard1))
    .on('/wizard/2', withAuth(renderWizard2))
    .on('/wizard/3', withAuth(renderWizard3))
    .on('/wizard/4', withAuth(renderWizard4))
    .on('/results/:id', withAuth(params => renderResults(params.id)))
    .on('/settings', renderUserSettings)
    .on('/help', withAuth(renderHelpPage))
    .on('/admin', renderLogin)
    .on('/admin/home', renderAdminHome)
    .on('/admin/settings', () => safeRenderAdminSettings(getPreferredAdminSection()))
    .on('/admin/settings/org', () => safeRenderAdminSettings('org'))
    .on('/admin/settings/company', () => safeRenderAdminSettings('company'))
    .on('/admin/settings/defaults', () => safeRenderAdminSettings('defaults'))
    .on('/admin/settings/governance', () => safeRenderAdminSettings('governance'))
    .on('/admin/settings/access', () => safeRenderAdminSettings('access'))
    .on('/admin/settings/users', () => safeRenderAdminSettings('users'))
    .on('/admin/settings/audit', () => safeRenderAdminSettings('audit'))
    .on('/admin/bu', renderAdminBU)
    .on('/admin/docs', renderAdminDocs)
    .notFound(() => {
      if (!AuthService.isAuthenticated()) {
        Router.navigate('/login');
        return;
      }
      setPage(`<div class="container" style="padding:var(--sp-12)"><h2>Page Not Found</h2><a href="#/dashboard" class="btn btn--primary" style="margin-top:var(--sp-4)">← Dashboard</a></div>`);
    });

  Router.init();
}

document.addEventListener('DOMContentLoaded', init);
