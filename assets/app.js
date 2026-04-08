/**
 * app.js — Main application entry point
 * G42 Tech & Cyber Risk Quantifier PoC
 */

'use strict';

const TOLERANCE_THRESHOLD = 5_000_000;
const DEFAULT_FX_RATE = 3.6725;
const DEFAULT_COMPASS_PROXY_URL = resolveCompassProxyUrl();
const APP_ASSET_VERSION = '20260402v1';
const APP_RELEASE = Object.freeze((typeof window !== 'undefined' && window.__RISK_CALCULATOR_RELEASE__) || {
  version: '0.10.0-pilot.1',
  channel: 'pilot',
  build: '2026-03-29-roi1',
  assetVersion: APP_ASSET_VERSION,
  apiOrigin: globalThis?.ApiOriginResolver ? globalThis.ApiOriginResolver.DEFAULT_API_ORIGIN : ''
});
const GLOBAL_ADMIN_STORAGE_KEY = 'rq_admin_settings';
const USER_SETTINGS_STORAGE_PREFIX = 'rq_user_settings';
const ASSESSMENTS_STORAGE_PREFIX = 'rq_assessments';
const LEARNING_STORAGE_PREFIX = 'rq_learning_store';
const DRAFT_STORAGE_PREFIX = 'rq_draft';
const DRAFT_RECOVERY_STORAGE_PREFIX = 'rq_draft_recovery';
const SESSION_LLM_STORAGE_PREFIX = 'rq_llm_session';
const SESSION_LLM_HEALTH_STORAGE_PREFIX = 'rq_llm_health';
const SESSION_PILOT_AI_WARNING_STORAGE_PREFIX = 'rq_pilot_ai_warned';
const MAX_AI_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_AI_UPLOAD_CHARS = 20000;
const MAX_ASSESSMENT_VERSION_HISTORY = 5;
const DEFAULT_TYPICAL_DEPARTMENTS = [
  'Information Security',
  'Technology',
  'Operations',
  'Finance',
  'Procurement',
  'Legal',
  'Risk & Compliance',
  'ESG',
  'Business Continuity',
  'HSE',
  'Human Resources',
  'Internal Audit',
  'Data & AI',
  'Commercial',
  'Shared Services'
];
const DEFAULT_AI_FEEDBACK_TUNING = Object.freeze({
  alignmentPriority: 'strict',
  draftStyle: 'executive-brief',
  shortlistDiscipline: 'strict',
  learningSensitivity: 'balanced'
});
const OPERATIONAL_TIME_LOCALE = 'en-GB';
const OPERATIONAL_TIME_ZONE = 'Asia/Dubai';
const OPERATIONAL_TIME_LABEL = 'Dubai time (GST)';

const DEFAULT_ADMIN_SETTINGS = {
  geography: 'United Arab Emirates',
  companyWebsiteUrl: '',
  companyContextProfile: '',
  companyContextSections: null,
  companyStructure: [],
  entityContextLayers: [],
  entityObligations: [],
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
  typicalDepartments: [...DEFAULT_TYPICAL_DEPARTMENTS],
  aiFeedbackTuning: { ...DEFAULT_AI_FEEDBACK_TUNING },
  valueBenchmarkSettings: typeof window !== 'undefined' && window.ValueQuantService
    ? window.ValueQuantService.getDefaultBenchmarkSettings()
    : { internalHourlyRatesUsd: {}, externalDayRatesUsd: {} }
};

function buildDefaultLearningStoreState() {
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

function getReleaseChannel() {
  return String(getReleaseInfo()?.channel || 'pilot').trim().toLowerCase() || 'pilot';
}

function isPilotOrStagingRelease() {
  const channel = getReleaseChannel();
  return channel === 'pilot' || channel === 'staging';
}

function isLocalDevAiRuntimeConfigAllowed() {
  try {
    return typeof LLMService !== 'undefined'
      && LLMService
      && typeof LLMService.isLocalDevRuntimeConfigAllowed === 'function'
      && LLMService.isLocalDevRuntimeConfigAllowed();
  } catch {
    return false;
  }
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

function _normaliseOperationalDateInput(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatOperationalDateTime(value, {
  includeSeconds = true,
  dateOnly = false,
  fallback = 'Unknown time'
} = {}) {
  const date = _normaliseOperationalDateInput(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(OPERATIONAL_TIME_LOCALE, {
      timeZone: OPERATIONAL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(dateOnly
        ? {}
        : {
            hour: '2-digit',
            minute: '2-digit',
            ...(includeSeconds ? { second: '2-digit' } : {}),
            hourCycle: 'h23'
          })
    }).format(date);
  } catch {
    return fallback;
  }
}

function resolveLiveTimestampDisplayText(value, {
  mode = 'relative',
  includeSeconds = true,
  dateOnly = false,
  fallback = 'Unknown time'
} = {}) {
  const safeValue = Number(value || 0);
  if (!safeValue) return fallback;
  if (mode === 'absolute') {
    return formatOperationalDateTime(safeValue, { includeSeconds, dateOnly, fallback });
  }
  return formatRelativePilotTime(safeValue, fallback);
}

function renderLiveTimestampValue(value, {
  mode = 'relative',
  includeSeconds = true,
  dateOnly = false,
  fallback = 'Unknown time',
  tagName = 'span',
  className = '',
  staleAfterMs = 0,
  staleClass = ''
} = {}) {
  const safeTimestamp = Number(value || 0);
  const resolvedTag = String(tagName || '').trim().toLowerCase() === 'strong' ? 'strong' : 'span';
  const baseClass = String(className || '').trim();
  const resolvedStaleClass = String(staleClass || '').trim();
  const isStale = safeTimestamp > 0 && Number(staleAfterMs || 0) > 0 && (Date.now() - safeTimestamp) > Number(staleAfterMs || 0);
  const combinedClass = [baseClass, isStale ? resolvedStaleClass : ''].filter(Boolean).join(' ');
  const text = resolveLiveTimestampDisplayText(safeTimestamp, { mode, includeSeconds, dateOnly, fallback });
  return `<${resolvedTag}
    data-live-timestamp="true"
    data-live-timestamp-value="${escapeHtml(String(safeTimestamp))}"
    data-live-timestamp-mode="${escapeHtml(String(mode || 'relative'))}"
    data-live-timestamp-fallback="${escapeHtml(String(fallback || 'Unknown time'))}"
    data-live-timestamp-include-seconds="${includeSeconds ? 'true' : 'false'}"
    data-live-timestamp-date-only="${dateOnly ? 'true' : 'false'}"
    data-live-timestamp-class="${escapeHtml(baseClass)}"
    data-live-timestamp-stale-after-ms="${escapeHtml(String(Number(staleAfterMs || 0)))}"
    data-live-timestamp-stale-class="${escapeHtml(resolvedStaleClass)}"
    class="${escapeHtml(combinedClass)}">${escapeHtml(text)}</${resolvedTag}>`;
}

function refreshLiveTimestampNodes(root = document) {
  const host = root && typeof root.querySelectorAll === 'function' ? root : document;
  host.querySelectorAll('[data-live-timestamp="true"]').forEach((node) => {
    const safeTimestamp = Number(node.dataset.liveTimestampValue || 0);
    const mode = String(node.dataset.liveTimestampMode || 'relative').trim().toLowerCase();
    const fallback = String(node.dataset.liveTimestampFallback || 'Unknown time');
    const includeSeconds = node.dataset.liveTimestampIncludeSeconds !== 'false';
    const dateOnly = node.dataset.liveTimestampDateOnly === 'true';
    const baseClass = String(node.dataset.liveTimestampClass || '').trim();
    const staleAfterMs = Number(node.dataset.liveTimestampStaleAfterMs || 0);
    const staleClass = String(node.dataset.liveTimestampStaleClass || '').trim();
    const isStale = safeTimestamp > 0 && staleAfterMs > 0 && (Date.now() - safeTimestamp) > staleAfterMs;
    node.textContent = resolveLiveTimestampDisplayText(safeTimestamp, { mode, includeSeconds, dateOnly, fallback });
    node.className = [baseClass, isStale ? staleClass : ''].filter(Boolean).join(' ');
  });
}

const LIVE_TIMESTAMP_TICK_INTERVAL_MS = 30 * 1000;
let _liveTimestampTickHandle = 0;

function bindLiveTimestampTicker() {
  if (typeof window === 'undefined' || _liveTimestampTickHandle) return;
  _liveTimestampTickHandle = window.setInterval(() => {
    refreshLiveTimestampNodes(document);
  }, LIVE_TIMESTAMP_TICK_INTERVAL_MS);
}

function hasUnsafeWorkspaceEdits() {
  return !!(
    AppState.draftDirty
    || AppState.userStateSyncInFlight
    || AppState.userStateSyncPending
    || AppState.userStateSyncTimer
  );
}

function listWorkspacePatchSlices(patch = {}) {
  if (typeof listUserWorkspacePatchSlices === 'function') {
    return listUserWorkspacePatchSlices(patch);
  }
  const sourcePatch = patch && typeof patch === 'object' ? patch : {};
  const slices = [];
  if (Object.prototype.hasOwnProperty.call(sourcePatch, 'userSettings')) slices.push('userSettings');
  if (Object.prototype.hasOwnProperty.call(sourcePatch, 'learningStore')) slices.push('learningStore');
  if (Object.prototype.hasOwnProperty.call(sourcePatch, 'draftWorkspace') || Object.prototype.hasOwnProperty.call(sourcePatch, 'draft')) slices.push('draftWorkspace');
  if (Object.prototype.hasOwnProperty.call(sourcePatch, 'savedAssessments') || Object.prototype.hasOwnProperty.call(sourcePatch, 'assessments')) slices.push('savedAssessments');
  return slices;
}

function formatWorkspaceSliceSummary(changedSlices = []) {
  const labels = Array.from(new Set((Array.isArray(changedSlices) ? changedSlices : [])
    .map(slice => WORKSPACE_SLICE_LABELS[String(slice || '').trim()] || '')
    .filter(Boolean)));
  if (!labels.length) return 'Saved workspace content';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function getAdminSurfaceNoticeCopy(route = '') {
  const safeRoute = String(route || '').trim();
  if (/^#\/admin\/settings\/users/.test(safeRoute)) {
    return {
      title: 'Latest access settings available',
      body: 'User scope settings changed in another tab or session. Load the latest version before saving more access changes on this screen.'
    };
  }
  if (/^#\/admin\/settings\/feedback/.test(safeRoute)) {
    return {
      title: 'Latest feedback tuning settings available',
      body: 'Feedback and tuning settings changed in another tab or session. Load the latest version before saving more tuning changes on this screen.'
    };
  }
  if (/^#\/admin\/docs/.test(safeRoute)) {
    return {
      title: 'Latest document library settings available',
      body: 'The document library changed in another tab or session. Refresh this view before curating more references or saving another library change.'
    };
  }
  return {
    title: 'Latest platform settings available',
    body: 'Platform settings changed in another tab or session. Load the latest version before saving more edits on this screen.'
  };
}

function buildPassiveStateNoticeModel() {
  const route = String(window.location.hash || '').trim();
  const notices = [];
  const currentUsername = String(AuthService.getCurrentUser()?.username || AppState.userStateCache.username || '').trim().toLowerCase();

  if ((/^#\/admin\/settings/.test(route) || /^#\/admin\/docs/.test(route)) && AppState.adminSettingsStaleNotice) {
    const copy = getAdminSurfaceNoticeCopy(route);
    notices.push({
      tone: 'warning',
      title: copy.title,
      body: copy.body,
      meta: AppState.adminSettingsStaleNotice.updatedAt
        ? `Changed ${formatRelativePilotTime(AppState.adminSettingsStaleNotice.updatedAt)}`
        : 'Changed elsewhere'
    });
  }

  if (/^#\/admin\/settings\/users/.test(route) && AppState.managedAccountsStaleNotice) {
    notices.push({
      tone: 'warning',
      title: 'Latest account directory available',
      body: 'Managed user access or password state changed in another tab or session. Finish or discard local edits, then reload this section before applying more account changes.',
      meta: AppState.managedAccountsStaleNotice.updatedAt
        ? `Changed ${formatRelativePilotTime(AppState.managedAccountsStaleNotice.updatedAt)}`
        : 'Changed elsewhere'
    });
  }

  if (/^#\/(dashboard|settings|wizard|results)/.test(route) && AppState.workspaceStaleNotice) {
    const noticeUsername = String(AppState.workspaceStaleNotice.username || '').trim().toLowerCase();
    if (!noticeUsername || !currentUsername || noticeUsername === currentUsername) {
      const sliceSummary = formatWorkspaceSliceSummary(AppState.workspaceStaleNotice.changedSlices || []);
      notices.push({
        tone: 'warning',
        title: 'Saved workspace changed elsewhere',
        body: `${sliceSummary.charAt(0).toUpperCase()}${sliceSummary.slice(1)} changed in another tab or session. Current edits stay local here until you reload or finish syncing.`,
        meta: AppState.workspaceStaleNotice.updatedAt
          ? `Latest saved version ${formatRelativePilotTime(AppState.workspaceStaleNotice.updatedAt)}`
          : 'Latest saved version available'
      });
    }
  }

  return notices;
}

function renderPassiveStateNoticeMarkup(notice) {
  if (!notice) return '';
  return `<div class="passive-state-banner passive-state-banner--${escapeHtml(String(notice.tone || 'warning'))}" role="status">
    <div class="passive-state-banner__body">
      <strong>${escapeHtml(String(notice.title || 'Latest version available'))}</strong>
      <span>${escapeHtml(String(notice.body || 'This page changed elsewhere.'))}</span>
    </div>
    ${notice.meta ? `<div class="passive-state-banner__meta">${escapeHtml(String(notice.meta))}</div>` : ''}
  </div>`;
}

function buildPassiveStateNoticeMarkup() {
  return buildPassiveStateNoticeModel().map(renderPassiveStateNoticeMarkup).join('');
}

function refreshPassiveStateNotice() {
  const host = document.getElementById('app-passive-state-notice');
  if (!host) return;
  host.innerHTML = buildPassiveStateNoticeMarkup();
  refreshLiveTimestampNodes(host);
}

function setAdminSettingsStaleNotice(notice = null) {
  AppState.adminSettingsStaleNotice = notice && typeof notice === 'object'
    ? {
        revision: Number(notice.revision || 0),
        updatedAt: Number(notice.updatedAt || 0),
        detectedAt: Number(notice.detectedAt || Date.now())
      }
    : null;
  refreshPassiveStateNotice();
}

function clearAdminSettingsStaleNotice(revision = 0) {
  const notice = AppState.adminSettingsStaleNotice;
  if (!notice) return;
  if (!Number(revision || 0) || Number(revision || 0) >= Number(notice.revision || 0)) {
    AppState.adminSettingsStaleNotice = null;
    refreshPassiveStateNotice();
  }
}

function setManagedAccountsStaleNotice(notice = null) {
  AppState.managedAccountsStaleNotice = notice && typeof notice === 'object'
    ? {
        username: String(notice.username || '').trim().toLowerCase(),
        updatedAt: Number(notice.updatedAt || 0),
        detectedAt: Number(notice.detectedAt || Date.now()),
        action: String(notice.action || '').trim().toLowerCase()
      }
    : null;
  refreshPassiveStateNotice();
}

function clearManagedAccountsStaleNotice() {
  if (!AppState.managedAccountsStaleNotice) return;
  AppState.managedAccountsStaleNotice = null;
  refreshPassiveStateNotice();
}

function setWorkspaceStaleNotice(notice = null) {
  AppState.workspaceStaleNotice = notice && typeof notice === 'object'
    ? {
        username: String(notice.username || AuthService.getCurrentUser()?.username || AppState.userStateCache.username || '').trim().toLowerCase(),
        revision: Number(notice.revision || 0),
        updatedAt: Number(notice.updatedAt || 0),
        detectedAt: Number(notice.detectedAt || Date.now()),
        changedSlices: Array.isArray(notice.changedSlices)
          ? notice.changedSlices
          : listWorkspacePatchSlices(notice.changedSlices || notice.patch || {})
      }
    : null;
  refreshPassiveStateNotice();
}

function clearWorkspaceStaleNotice({ username = '', revision = 0 } = {}) {
  const notice = AppState.workspaceStaleNotice;
  if (!notice) return;
  const safeUsername = String(username || AuthService.getCurrentUser()?.username || AppState.userStateCache.username || '').trim().toLowerCase();
  const noticeUsername = String(notice.username || '').trim().toLowerCase();
  if (safeUsername && noticeUsername && safeUsername !== noticeUsername) return;
  if (!Number(revision || 0) || Number(revision || 0) >= Number(notice.revision || 0)) {
    AppState.workspaceStaleNotice = null;
    refreshPassiveStateNotice();
  }
}

function markReviewQueueSurfaceInvalidated(payload = {}) {
  const detectedAt = Date.now();
  AppState.reviewQueueStaleNotice = {
    reviewId: String(payload.reviewId || '').trim(),
    assessmentId: String(payload.assessmentId || '').trim(),
    updatedAt: Number(payload.updatedAt || 0),
    detectedAt,
    status: 'stale'
  };
  Object.values(REVIEW_QUEUE_SURFACE_KEYS).forEach((key) => {
    AppState[key] = buildReviewQueueSurfaceMeta({
      ...(AppState[key] || {}),
      lastInvalidatedAt: detectedAt,
      stale: Number(AppState[key]?.lastLoadedAt || 0) < detectedAt
    });
  });
}

function markReviewQueueSurfaceLoaded(scope = 'admin', details = {}) {
  const surfaceKey = REVIEW_QUEUE_SURFACE_KEYS[scope] || REVIEW_QUEUE_SURFACE_KEYS.admin;
  const loadedAt = Date.now();
  AppState[surfaceKey] = buildReviewQueueSurfaceMeta({
    ...(AppState[surfaceKey] || {}),
    lastLoadedAt: loadedAt,
    lastResolvedAt: loadedAt,
    stale: false,
    count: Number(details.count || 0),
    error: ''
  });
  if (AppState.reviewQueueStaleNotice?.status === 'stale') {
    AppState.reviewQueueStaleNotice = {
      ...AppState.reviewQueueStaleNotice,
      status: 'resolved',
      resolvedAt: loadedAt
    };
  } else if (AppState.reviewQueueStaleNotice?.status === 'resolved') {
    AppState.reviewQueueStaleNotice = null;
  }
  return AppState[surfaceKey];
}

function markReviewQueueSurfaceLoadFailed(scope = 'admin', errorMessage = '') {
  const surfaceKey = REVIEW_QUEUE_SURFACE_KEYS[scope] || REVIEW_QUEUE_SURFACE_KEYS.admin;
  AppState[surfaceKey] = buildReviewQueueSurfaceMeta({
    ...(AppState[surfaceKey] || {}),
    error: String(errorMessage || '').trim()
  });
  return AppState[surfaceKey];
}

function getReviewQueueSurfaceMeta(scope = 'admin') {
  const surfaceKey = REVIEW_QUEUE_SURFACE_KEYS[scope] || REVIEW_QUEUE_SURFACE_KEYS.admin;
  return buildReviewQueueSurfaceMeta(AppState[surfaceKey] || {});
}

if (typeof window !== 'undefined') {
  window.buildPassiveStateNoticeMarkup = buildPassiveStateNoticeMarkup;
  window.refreshPassiveStateNotice = refreshPassiveStateNotice;
  window.renderLiveTimestampValue = renderLiveTimestampValue;
  window.refreshLiveTimestampNodes = refreshLiveTimestampNodes;
  window.setManagedAccountsStaleNotice = setManagedAccountsStaleNotice;
  window.clearManagedAccountsStaleNotice = clearManagedAccountsStaleNotice;
  window.AppReviewQueueSync = {
    markSurfaceInvalidated: markReviewQueueSurfaceInvalidated,
    markSurfaceLoaded: markReviewQueueSurfaceLoaded,
    markSurfaceLoadFailed: markReviewQueueSurfaceLoadFailed,
    getSurfaceMeta: getReviewQueueSurfaceMeta,
    getNotice: () => AppState.reviewQueueStaleNotice
  };
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

function normaliseAiFeedbackTuning(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const pick = (input, allowed, fallback) => {
    const safe = String(input || '').trim().toLowerCase();
    return allowed.includes(safe) ? safe : fallback;
  };
  return {
    alignmentPriority: pick(source.alignmentPriority, ['strict', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.alignmentPriority),
    draftStyle: pick(source.draftStyle, ['executive-brief', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.draftStyle),
    shortlistDiscipline: pick(source.shortlistDiscipline, ['strict', 'balanced'], DEFAULT_AI_FEEDBACK_TUNING.shortlistDiscipline),
    learningSensitivity: pick(source.learningSensitivity, ['conservative', 'balanced', 'accelerated'], DEFAULT_AI_FEEDBACK_TUNING.learningSensitivity)
  };
}

function getAiFeedbackTuningSettings(settings = null) {
  const resolvedSettings = settings && typeof settings === 'object'
    ? settings
    : (typeof getEffectiveSettings === 'function'
        ? getEffectiveSettings()
        : getAdminSettings());
  return normaliseAiFeedbackTuning(resolvedSettings?.aiFeedbackTuning || DEFAULT_AI_FEEDBACK_TUNING);
}

function getObligationResolutionApi() {
  if (typeof window === 'undefined') return null;
  return window.ObligationResolution && typeof window.ObligationResolution === 'object'
    ? window.ObligationResolution
    : null;
}

function createEmptyResolvedObligationContext() {
  return {
    selectedBusinessEntityId: '',
    selectedDepartmentEntityId: '',
    lineageEntityIds: [],
    direct: [],
    inheritedMandatory: [],
    inheritedConditional: [],
    inheritedGuidance: [],
    allResolved: [],
    resolvedApplicableRegulations: [],
    summary: ''
  };
}

function cloneResolvedObligationItem(item = {}) {
  const source = item && typeof item === 'object' ? item : {};
  const normaliseOptionalBoolean = (value) => {
    if (value === true) return true;
    if (value === false) return false;
    return null;
  };
  return {
    id: String(source.id || '').trim(),
    sourceObligationId: String(source.sourceObligationId || '').trim(),
    sourceEntityId: String(source.sourceEntityId || '').trim(),
    sourceEntityName: String(source.sourceEntityName || '').trim(),
    appliesToEntityId: String(source.appliesToEntityId || '').trim(),
    appliesToDepartmentId: String(source.appliesToDepartmentId || '').trim(),
    title: String(source.title || '').trim(),
    familyKey: String(source.familyKey || '').trim(),
    type: String(source.type || '').trim(),
    requirementLevel: String(source.requirementLevel || '').trim(),
    text: String(source.text || '').trim(),
    jurisdictions: Array.isArray(source.jurisdictions) ? source.jurisdictions.map(value => String(value || '').trim()).filter(Boolean) : [],
    regulationTags: Array.isArray(source.regulationTags) ? source.regulationTags.map(value => String(value || '').trim()).filter(Boolean) : [],
    direct: !!source.direct,
    flowDownMode: String(source.flowDownMode || '').trim(),
    inheritanceType: String(source.inheritanceType || '').trim(),
    scenarioLensScoped: !!source.scenarioLensScoped,
    scenarioLensMatched: normaliseOptionalBoolean(source.scenarioLensMatched),
    geographyScoped: !!source.geographyScoped,
    departmentScoped: !!source.departmentScoped,
    visibleToChildUsers: source.visibleToChildUsers !== false,
    applicabilityReason: String(source.applicabilityReason || '').trim(),
    reviewedAt: Number(source.reviewedAt || 0)
  };
}

function normaliseResolvedObligationBucket(items = []) {
  const source = Array.isArray(items) ? items : [];
  const seen = new Set();
  return source
    .map(cloneResolvedObligationItem)
    .filter(item => item.title)
    .filter(item => {
      const key = item.id || `${item.sourceEntityId}::${item.familyKey || item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normaliseResolvedObligationSnapshot(snapshot = {}) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const direct = normaliseResolvedObligationBucket(source.direct);
  const inheritedMandatory = normaliseResolvedObligationBucket(source.inheritedMandatory);
  const inheritedConditional = normaliseResolvedObligationBucket(source.inheritedConditional);
  const inheritedGuidance = normaliseResolvedObligationBucket(source.inheritedGuidance);
  const allResolved = normaliseResolvedObligationBucket(
    Array.isArray(source.allResolved) && source.allResolved.length
      ? source.allResolved
      : [...direct, ...inheritedMandatory, ...inheritedConditional, ...inheritedGuidance]
  );
  const resolvedApplicableRegulations = Array.from(new Set(
    (
      Array.isArray(source.resolvedApplicableRegulations) && source.resolvedApplicableRegulations.length
        ? source.resolvedApplicableRegulations
        : allResolved.flatMap(item => item.regulationTags || [])
    )
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ));
  return {
    selectedBusinessEntityId: String(source.selectedBusinessEntityId || '').trim(),
    selectedDepartmentEntityId: String(source.selectedDepartmentEntityId || '').trim(),
    lineageEntityIds: Array.isArray(source.lineageEntityIds) ? source.lineageEntityIds.map(value => String(value || '').trim()).filter(Boolean) : [],
    direct,
    inheritedMandatory,
    inheritedConditional,
    inheritedGuidance,
    allResolved,
    resolvedApplicableRegulations,
    summary: String(source.summary || '').trim(),
    capturedAt: Number(source.capturedAt || 0)
  };
}

function buildResolvedObligationSnapshot(options = {}) {
  const rawContext = options.context
    || options.obligationContext
    || options.settings?.resolvedObligationContext
    || options.draft?.obligationBasis
    || options.assessment?.obligationBasis
    || null;
  const snapshot = normaliseResolvedObligationSnapshot(rawContext || createEmptyResolvedObligationContext());
  if (!snapshot.summary && snapshot.allResolved.length) {
    const resolver = getObligationResolutionApi();
    snapshot.summary = resolver?.buildResolvedObligationSummary
      ? String(resolver.buildResolvedObligationSummary(snapshot) || '').trim()
      : '';
  }
  snapshot.capturedAt = Number(options.capturedAt || snapshot.capturedAt || Date.now());
  return snapshot;
}

function resolveScopedObligationContext({
  settings = getAdminSettings(),
  businessUnitEntityId = '',
  departmentEntityId = '',
  geography = '',
  geographies = [],
  scenarioLens = ''
} = {}) {
  const resolver = getObligationResolutionApi();
  if (!resolver?.resolveObligationContext) return createEmptyResolvedObligationContext();
  return resolver.resolveObligationContext({
    settings,
    businessUnitEntityId,
    departmentEntityId,
    geography,
    geographies,
    scenarioLens
  });
}

function applyResolvedObligationContextToSettings(baseSettings, obligationContext = createEmptyResolvedObligationContext()) {
  const safeBase = baseSettings && typeof baseSettings === 'object' ? baseSettings : {};
  const resolvedApplicableRegulations = Array.isArray(obligationContext?.resolvedApplicableRegulations)
    ? obligationContext.resolvedApplicableRegulations
    : [];
  return {
    ...safeBase,
    resolvedObligationContext: obligationContext,
    resolvedObligations: Array.isArray(obligationContext?.allResolved) ? obligationContext.allResolved : [],
    resolvedObligationSummary: String(safeBase.resolvedObligationSummary || obligationContext?.summary || '').trim(),
    applicableRegulations: Array.from(new Set([
      ...(Array.isArray(safeBase.applicableRegulations) ? safeBase.applicableRegulations : []),
      ...resolvedApplicableRegulations
    ].map(value => String(value || '').trim()).filter(Boolean)))
  };
}

function normaliseAdminSettings(settings = {}) {
  const mergedRegulations = Array.from(new Set([
    ...DEFAULT_ADMIN_SETTINGS.applicableRegulations,
    ...(Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [])
  ].map(value => String(value || '').trim()).filter(Boolean)));
  const resolver = getObligationResolutionApi();
  return {
    ...DEFAULT_ADMIN_SETTINGS,
    ...settings,
    applicableRegulations: mergedRegulations,
    companyContextSections: settings.companyContextSections && typeof settings.companyContextSections === 'object' ? settings.companyContextSections : null,
    companyStructure: Array.isArray(settings.companyStructure) ? settings.companyStructure : [],
    entityContextLayers: Array.isArray(settings.entityContextLayers) ? settings.entityContextLayers : [],
    entityObligations: resolver?.normaliseEntityObligations
      ? resolver.normaliseEntityObligations(settings.entityObligations)
      : [],
    buOverrides: Array.isArray(settings.buOverrides) ? settings.buOverrides : [],
    docOverrides: Array.isArray(settings.docOverrides) ? settings.docOverrides : [],
    aiFeedbackTuning: normaliseAiFeedbackTuning(settings.aiFeedbackTuning),
    typicalDepartments: Array.isArray(settings.typicalDepartments) && settings.typicalDepartments.length
      ? mergeTypicalDepartmentList(settings.typicalDepartments)
      : [...(DEFAULT_ADMIN_SETTINGS.typicalDepartments || [])],
    valueBenchmarkSettings: typeof window !== 'undefined' && window.ValueQuantService
      ? window.ValueQuantService.normaliseBenchmarkSettings(settings.valueBenchmarkSettings || DEFAULT_ADMIN_SETTINGS.valueBenchmarkSettings)
      : cloneSerializableState(settings.valueBenchmarkSettings, DEFAULT_ADMIN_SETTINGS.valueBenchmarkSettings),
    _meta: {
      revision: Number(settings._meta?.revision || 0),
      updatedAt: Number(settings._meta?.updatedAt || 0)
    }
  };
}

function resolveHostedApiUrl(path = '') {
  const resolver = (typeof window !== 'undefined' && window?.ApiOriginResolver)
    || globalThis?.ApiOriginResolver
    || null;
  return resolver && typeof resolver.resolveApiUrl === 'function'
    ? resolver.resolveApiUrl(path)
    : '';
}

function resolveCompassProxyUrl() {
  return resolveHostedApiUrl('/api/compass');
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
  userStateCache: {
    username: '',
    userSettings: null,
    assessments: null,
    learningStore: buildDefaultLearningStoreState(),
    draft: null,
    _meta: { revision: 0, updatedAt: 0 }
  },
  userStateSyncTimer: null,
  userStateSyncRevision: 0,
  userStateSyncPending: null,
  userStateSyncInFlight: false,
  userStateLastConflict: null,
  userSettingsSavedAt: 0,
  adminSettingsStaleNotice: null,
  managedAccountsStaleNotice: null,
  workspaceStaleNotice: null,
  reviewQueueStaleNotice: null,
  adminReviewQueueMeta: { lastLoadedAt: 0, lastInvalidatedAt: 0, lastResolvedAt: 0, stale: false, count: 0, error: '' },
  dashboardReviewInboxMeta: { lastLoadedAt: 0, lastInvalidatedAt: 0, lastResolvedAt: 0, stale: false, count: 0, error: '' },
  auditLogCache: { loaded: false, loading: false, entries: [], summary: null, error: '', lastLoadedAt: 0 },
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

const WORKSPACE_SLICE_LABELS = Object.freeze({
  userSettings: 'personal settings',
  learningStore: 'AI feedback memory',
  draftWorkspace: 'draft workspace',
  savedAssessments: 'saved assessments'
});
const REVIEW_QUEUE_SURFACE_KEYS = Object.freeze({
  admin: 'adminReviewQueueMeta',
  dashboard: 'dashboardReviewInboxMeta'
});

function buildReviewQueueSurfaceMeta(overrides = {}) {
  return {
    lastLoadedAt: 0,
    lastInvalidatedAt: 0,
    lastResolvedAt: 0,
    stale: false,
    count: 0,
    error: '',
    ...((overrides && typeof overrides === 'object') ? overrides : {})
  };
}

function cloneSerializableState(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function clampAssessmentVersionNumber(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number(min || 0);
  return Math.min(Number(max), Math.max(Number(min), numeric));
}

function sumAssessmentVersionLossEdge(parameters = {}, suffix = 'Min') {
  return ['ir', 'bi', 'db', 'rl', 'tp', 'rc']
    .reduce((sum, key) => sum + Number(parameters?.[`${key}${suffix}`] || 0), 0);
}

function deriveAssessmentVersionVulnerability(parameters = {}) {
  if (parameters?.vulnDirect) {
    return clampAssessmentVersionNumber(parameters?.vulnLikely, 0.01, 0.99);
  }
  const threatCapability = clampAssessmentVersionNumber(parameters?.threatCapLikely, 0.01, 0.99);
  const controlStrength = clampAssessmentVersionNumber(parameters?.controlStrLikely, 0.01, 0.99);
  return clampAssessmentVersionNumber(1 / (1 + Math.exp(-(threatCapability - controlStrength))), 0.01, 0.99);
}

function extractAssessmentVersionKeyParameters(parameters = {}) {
  return {
    tefLikely: Number(parameters?.tefLikely || 0),
    vulnerability: deriveAssessmentVersionVulnerability(parameters),
    controlStrLikely: clampAssessmentVersionNumber(parameters?.controlStrLikely, 0.01, 0.99),
    lmLow: sumAssessmentVersionLossEdge(parameters, 'Min'),
    lmHigh: sumAssessmentVersionLossEdge(parameters, 'Max')
  };
}

function formatAssessmentVersionParameterValue(key = '', value = 0) {
  const numeric = Number(value || 0);
  if (key === 'tefLikely') return `${numeric.toFixed(2)} events/year`;
  if (key === 'vulnerability' || key === 'controlStrLikely') return `${Math.round(clampAssessmentVersionNumber(numeric, 0.01, 0.99) * 100)}%`;
  if (key === 'lmLow' || key === 'lmHigh') return fmtCurrency(Math.max(0, numeric));
  return String(numeric);
}

function buildAssessmentVersionAleLabel(aleResult = {}) {
  const mean = Number(aleResult?.mean || 0);
  const p90 = Number(aleResult?.p90 || 0);
  if (mean > 0 || p90 > 0) {
    return `${fmtCurrency(mean)} mean ALE · ${fmtCurrency(p90)} bad year`;
  }
  return 'ALE not recorded';
}

function buildAssessmentVersionSnapshot(assessment = {}) {
  const parameters = cloneSerializableState(assessment?.fairParams || assessment?.results?.inputs || {}, {}) || {};
  const results = assessment?.results || {};
  const aleResult = {
    mean: Number(results?.annualLoss?.mean || results?.ale?.mean || 0),
    p90: Number(results?.annualLoss?.p90 || results?.ale?.p90 || results?.eventLoss?.p90 || 0)
  };
  const scenarioSummary = String(
    assessment?.enhancedNarrative
    || assessment?.narrative
    || assessment?.scenarioTitle
    || ''
  ).trim().slice(0, 2000);
  if (!Object.keys(parameters).length && !scenarioSummary && !(aleResult.mean || aleResult.p90)) return null;
  return {
    savedAt: Number(assessment?.completedAt || assessment?.lifecycleUpdatedAt || assessment?.createdAt || Date.now()),
    parameters,
    scenarioSummary,
    aleResult
  };
}

function normaliseAssessmentVersionHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter(item => item && typeof item === 'object')
    .map((item) => ({
      savedAt: Number(item.savedAt || item.createdAt || item.updatedAt || 0),
      parameters: cloneSerializableState(item.parameters, {}) || {},
      scenarioSummary: String(item.scenarioSummary || item.summary || '').trim().slice(0, 2000),
      aleResult: {
        mean: Number(item?.aleResult?.mean || item?.aleMean || 0),
        p90: Number(item?.aleResult?.p90 || item?.aleP90 || 0)
      },
      aiNarrative: String(item.aiNarrative || '').trim(),
      narratedAt: Number(item.narratedAt || 0)
    }))
    .filter(item => item.savedAt || item.scenarioSummary || Object.keys(item.parameters || {}).length || item.aleResult.mean || item.aleResult.p90)
    .sort((left, right) => Number(left.savedAt || 0) - Number(right.savedAt || 0))
    .slice(-MAX_ASSESSMENT_VERSION_HISTORY);
}

function appendAssessmentVersionHistory(existingHistory = [], previousAssessment = null) {
  const history = normaliseAssessmentVersionHistory(existingHistory);
  const snapshot = buildAssessmentVersionSnapshot(previousAssessment);
  if (!snapshot) return history;
  const last = history[history.length - 1];
  const snapshotSignature = JSON.stringify({
    parameters: snapshot.parameters,
    scenarioSummary: snapshot.scenarioSummary,
    aleResult: snapshot.aleResult
  });
  const lastSignature = last ? JSON.stringify({
    parameters: last.parameters,
    scenarioSummary: last.scenarioSummary,
    aleResult: last.aleResult
  }) : '';
  if (snapshotSignature === lastSignature) return history;
  return normaliseAssessmentVersionHistory([...history, snapshot]);
}

function buildAssessmentVersionNarrationInput(previousVersion = {}, currentAssessment = {}) {
  const previousParameters = extractAssessmentVersionKeyParameters(previousVersion?.parameters || {});
  const currentParameters = extractAssessmentVersionKeyParameters(currentAssessment?.fairParams || currentAssessment?.results?.inputs || {});
  const parameterLabels = {
    tefLikely: 'Event frequency',
    vulnerability: 'Event success likelihood',
    controlStrLikely: 'Control strength',
    lmLow: 'Lower loss range',
    lmHigh: 'Upper loss range'
  };
  const diffLines = Object.keys(parameterLabels)
    .map((key) => {
      const previousValue = Number(previousParameters?.[key] || 0);
      const currentValue = Number(currentParameters?.[key] || 0);
      const changed = key === 'lmLow' || key === 'lmHigh'
        ? Math.abs(currentValue - previousValue) >= 1
        : Math.abs(currentValue - previousValue) >= 0.01;
      if (!changed) return '';
      return `${parameterLabels[key]}: ${formatAssessmentVersionParameterValue(key, previousValue)} -> ${formatAssessmentVersionParameterValue(key, currentValue)}`;
    })
    .filter(Boolean);
  return {
    previousScenarioSummary: String(previousVersion?.scenarioSummary || '').trim(),
    currentScenarioSummary: String(
      currentAssessment?.enhancedNarrative
      || currentAssessment?.narrative
      || currentAssessment?.scenarioTitle
      || ''
    ).trim(),
    previousAleLabel: buildAssessmentVersionAleLabel(previousVersion?.aleResult || {}),
    currentAleLabel: buildAssessmentVersionAleLabel({
      mean: Number(currentAssessment?.results?.annualLoss?.mean || currentAssessment?.results?.ale?.mean || 0),
      p90: Number(currentAssessment?.results?.annualLoss?.p90 || currentAssessment?.results?.ale?.p90 || currentAssessment?.results?.eventLoss?.p90 || 0)
    }),
    parameterDiffLines: diffLines,
    parameterDiffText: diffLines.join('\n')
  };
}


function getSettingsApiUrl() {
  return resolveHostedApiUrl('/api/settings');
}

async function requestSharedSettings(method = 'GET', payload, { includeAdminSecret = false } = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };
  const sessionToken = AuthService.getApiSessionToken();
  if (includeAdminSecret && !sessionToken && AuthService.getAdminApiSecret()) {
    headers['x-admin-secret'] = AuthService.getAdminApiSecret();
  }
  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
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

function buildComparableAdminSettingsSnapshot(settings = {}) {
  const normalised = normaliseAdminSettings(settings);
  return JSON.stringify({
    ...normalised,
    _meta: {
      revision: 0,
      updatedAt: 0
    }
  });
}

const CROSS_TAB_SYNC_CHANNEL_NAME = 'risk_calculator_sync';
const CROSS_TAB_SYNC_EVENT_TYPES = Object.freeze({
  settingsChanged: 'settings_changed',
  userStateChanged: 'user_state_changed',
  reviewQueueChanged: 'review_queue_changed',
  managedAccountsChanged: 'managed_accounts_changed'
});
const CROSS_TAB_WINDOW_EVENTS = Object.freeze({
  settingsChanged: 'rq:admin-settings-invalidated',
  userStateChanged: 'rq:user-state-invalidated',
  reviewQueueChanged: 'rq:review-queue-invalidated',
  managedAccountsChanged: 'rq:managed-accounts-invalidated'
});
const CROSS_TAB_SYNC_SOURCE_ID = `rq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let _crossTabSyncBound = false;
let _crossTabSyncChannel = null;

function getCrossTabSyncChannel() {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return null;
  if (_crossTabSyncChannel) return _crossTabSyncChannel;
  _crossTabSyncChannel = new window.BroadcastChannel(CROSS_TAB_SYNC_CHANNEL_NAME);
  return _crossTabSyncChannel;
}

function dispatchCrossTabWindowEvent(eventName, detail = {}) {
  if (typeof window === 'undefined' || !String(eventName || '').trim()) return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function broadcastCrossTabSyncEvent(eventType, payload = {}) {
  const channel = getCrossTabSyncChannel();
  if (!channel || !String(eventType || '').trim()) return false;
  channel.postMessage({
    sourceId: CROSS_TAB_SYNC_SOURCE_ID,
    eventType,
    payload: payload && typeof payload === 'object' ? payload : {},
    sentAt: Date.now()
  });
  return true;
}

const AppCrossTabSync = {
  broadcastSettingsChanged(payload = {}) {
    return broadcastCrossTabSyncEvent(CROSS_TAB_SYNC_EVENT_TYPES.settingsChanged, payload);
  },
  broadcastUserStateChanged(payload = {}) {
    return broadcastCrossTabSyncEvent(CROSS_TAB_SYNC_EVENT_TYPES.userStateChanged, payload);
  },
  broadcastReviewQueueChanged(payload = {}) {
    return broadcastCrossTabSyncEvent(CROSS_TAB_SYNC_EVENT_TYPES.reviewQueueChanged, payload);
  },
  broadcastManagedAccountsChanged(payload = {}) {
    return broadcastCrossTabSyncEvent(CROSS_TAB_SYNC_EVENT_TYPES.managedAccountsChanged, payload);
  }
};

if (typeof window !== 'undefined') {
  window.AppCrossTabSync = AppCrossTabSync;
}

function applySharedSettingsLocally(settings = {}) {
  const normalised = normaliseAdminSettings(settings);
  updateAdminSettingsState(normalised);
  clearAdminSettingsStaleNotice(Number(normalised?._meta?.revision || 0));
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
    learningStore: normalizedWorkspace.learningStore && typeof normalizedWorkspace.learningStore === 'object'
      ? normalizedWorkspace.learningStore
      : buildDefaultLearningStoreState(),
    draft: normalizedWorkspace.draft && typeof normalizedWorkspace.draft === 'object' ? normalizedWorkspace.draft : null,
    draftWorkspace: normalizedWorkspace.draftWorkspace,
    _meta: buildExpectedMeta(normalizedWorkspace._meta)
  };
  updateUserStateCache(nextCache);
  AppState.userSettingsSavedAt = Number(nextCache._meta?.updatedAt || AppState.userSettingsSavedAt || 0);
  clearWorkspaceStaleNotice({
    username: safeUsername,
    revision: Number(nextCache._meta?.revision || 0)
  });
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
      sessionStorage.setItem(
        buildUserStorageKey(DRAFT_STORAGE_PREFIX, safeUsername),
        JSON.stringify(
          typeof buildSessionDraftPayload === 'function'
            ? buildSessionDraftPayload(nextCache.draft, Number(nextCache.draftWorkspace?.lastSavedAt || Date.now()))
            : {
                savedAt: Number(nextCache.draftWorkspace?.lastSavedAt || Date.now()),
                draft: nextCache.draft
              }
        )
      );
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
  return window.AppSharedStateClient.loadSharedAdminSettings();
}

function syncSharedAdminSettings(settings, audit = null) {
  return window.AppSharedStateClient.syncSharedAdminSettings(settings, audit);
}

function bindCrossTabSync() {
  if (_crossTabSyncBound || typeof window === 'undefined') return;
  _crossTabSyncBound = true;
  const channel = getCrossTabSyncChannel();
  if (!channel) return;
  channel.addEventListener('message', (event) => {
    const message = event?.data && typeof event.data === 'object' ? event.data : {};
    if (String(message.sourceId || '') === CROSS_TAB_SYNC_SOURCE_ID) return;
    const eventType = String(message.eventType || '').trim();
    const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};

    if (eventType === CROSS_TAB_SYNC_EVENT_TYPES.settingsChanged) {
      dispatchCrossTabWindowEvent(CROSS_TAB_WINDOW_EVENTS.settingsChanged, payload);
      const currentRoute = String(window.location.hash || '');
      if (/^#\/admin\/settings/.test(currentRoute) || /^#\/admin\/docs/.test(currentRoute)) {
        setAdminSettingsStaleNotice({
          revision: Number(payload.revision || 0),
          updatedAt: Number(payload.updatedAt || Date.now()),
          detectedAt: Date.now()
        });
        const copy = getAdminSurfaceNoticeCopy(currentRoute);
        UI.toast(copy.body, 'warning', 5000);
        return;
      }
      refreshAuthenticatedContextFromServer({ force: true, rerender: true }).catch(error => {
        console.warn('cross-tab settings refresh failed:', error?.message || error);
      });
      return;
    }

    if (eventType === CROSS_TAB_SYNC_EVENT_TYPES.userStateChanged) {
      dispatchCrossTabWindowEvent(CROSS_TAB_WINDOW_EVENTS.userStateChanged, payload);
      const currentUsername = String(AuthService.getCurrentUser()?.username || AppState.userStateCache.username || '').trim().toLowerCase();
      if (!currentUsername || String(payload.username || '').trim().toLowerCase() !== currentUsername) return;
      if (hasUnsafeWorkspaceEdits()) {
        setWorkspaceStaleNotice({
          username: currentUsername,
          revision: Number(payload.revision || 0),
          updatedAt: Number(payload.updatedAt || Date.now()),
          detectedAt: Date.now(),
          changedSlices: payload.changedSlices
        });
        UI.toast('Your saved workspace changed in another tab. Save or reload before making more edits here.', 'warning', 5000);
        return;
      }
      loadSharedUserState(currentUsername)
        .then(() => Router.render?.())
        .catch(error => console.warn('cross-tab user-state refresh failed:', error?.message || error));
      return;
    }

    if (eventType === CROSS_TAB_SYNC_EVENT_TYPES.reviewQueueChanged) {
      markReviewQueueSurfaceInvalidated(payload);
      dispatchCrossTabWindowEvent(CROSS_TAB_WINDOW_EVENTS.reviewQueueChanged, payload);
      return;
    }

    if (eventType === CROSS_TAB_SYNC_EVENT_TYPES.managedAccountsChanged) {
      dispatchCrossTabWindowEvent(CROSS_TAB_WINDOW_EVENTS.managedAccountsChanged, payload);
      AuthService.refreshManagedAccounts?.().catch(error => console.warn('cross-tab managed-account refresh failed:', error?.message || error));
      const currentUsername = String(AuthService.getCurrentUser()?.username || '').trim().toLowerCase();
      if (currentUsername && (!payload.username || String(payload.username || '').trim().toLowerCase() === currentUsername)) {
        refreshAuthenticatedContextFromServer({
          force: true,
          rerender: !AppState.draftDirty,
          allowWorkspaceReload: !AppState.draftDirty && !AppState.userStateSyncInFlight
        }).catch(error => {
          console.warn('cross-tab managed-account context refresh failed:', error?.message || error);
        });
      }
    }
  });
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

function inferStoredScenarioFunctionKey(source = {}) {
  const direct = String(source?.scenarioLens?.functionKey || source?.functionKey || '').trim().toLowerCase();
  if (direct) return direct;
  const lensKey = String(source?.scenarioLens?.key || '').trim().toLowerCase();
  if (lensKey === 'financial') return 'finance';
  if (lensKey === 'fraud-integrity') return 'finance';
  if (['procurement', 'supply-chain', 'third-party'].includes(lensKey)) return 'procurement';
  if (lensKey === 'data-governance' || lensKey === 'legal-contract') return 'compliance';
  if (['compliance', 'regulatory'].includes(lensKey)) return 'compliance';
  if (lensKey === 'people-workforce') return 'hse';
  if (lensKey === 'hse') return 'hse';
  if (['strategic', 'esg', 'geopolitical', 'investment-jv', 'transformation-delivery'].includes(lensKey)) return 'strategic';
  if (['operational', 'business-continuity', 'physical-security', 'ot-resilience'].includes(lensKey)) return 'operations';
  if (lensKey === 'ai-model-risk') return 'technology';
  if (['ransomware', 'identity', 'phishing', 'insider', 'cloud', 'data-breach', 'cyber'].includes(lensKey)) return 'technology';
  const haystack = [
    source?.scenarioTitle,
    source?.title,
    source?.narrative,
    source?.enhancedNarrative,
    getStructuredScenarioField(source?.structuredScenario, 'eventPath'),
    getStructuredScenarioField(source?.structuredScenario, 'primaryDriver'),
    ...(Array.isArray(source?.selectedRisks) ? source.selectedRisks.map(item => item?.title || item?.category || '') : []),
    ...(Array.isArray(source?.selectedRiskTitles) ? source.selectedRiskTitles : [])
  ].filter(Boolean).join(' ').toLowerCase();
  if (/procurement|sourcing|vendor|supplier|purchase|third[- ]party|supply chain|supplier due diligence/.test(haystack)) return 'procurement';
  if (/compliance|regulatory|legal|privacy|policy|governance|controls|audit|contract|litigation|intellectual property|data governance/.test(haystack)) return 'compliance';
  if (/finance|treasury|accounting|financial|cash|payment|payroll|credit|collections|ledger|fraud|integrity|financial crime|aml/.test(haystack)) return 'finance';
  if (/hse|ehs|health|safety|environment|workplace safety|injury|spill|worker welfare|labou?r/.test(haystack)) return 'hse';
  if (/strategy|strategic|enterprise|portfolio|transformation|market|growth|investment|esg|sustainability|geopolitical|sanctions|market access|sovereign|merger|acquisition|joint venture|integration/.test(haystack)) return 'strategic';
  if (/technology|cyber|security|identity|cloud|infrastructure|it\b|digital|phishing|ransomware|breach|ai\b|model risk|responsible ai|machine learning|llm|algorithm/.test(haystack)) return 'technology';
  if (/operations|resilience|continuity|service delivery|manufacturing|logistics|facilities|workforce|process failure|backlog|physical security|executive protection|industrial control|ot\b|ics|scada|site systems/.test(haystack)) return 'operations';
  return 'general';
}

const SCENARIO_DISPLAY_TITLE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'your', 'have', 'will',
  'risk', 'scenario', 'assessment', 'about', 'after', 'before', 'when', 'what', 'could',
  'would', 'should', 'been', 'were', 'they', 'them', 'their', 'there', 'where', 'while',
  'only', 'also', 'than', 'then', 'because', 'through', 'across', 'still', 'team', 'current',
  'draft', 'built', 'using', 'used', 'high', 'urgency', 'general', 'enterprise', 'material',
  'view', 'read', 'context', 'most', 'likely', 'area', 'exposed'
]);

function tokeniseScenarioDisplayTitleText(text = '') {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(token => token.trim())
      .filter(token => token.length > 2 && !SCENARIO_DISPLAY_TITLE_STOPWORDS.has(token))
  ));
}

function buildScenarioHeadlineFromNarrative(text = '', { maxLength = 96 } = {}) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  let headline = sentences.find((sentence) => {
    const lower = sentence.toLowerCase();
    if (/^g\d+\b.*assessing\b/.test(lower)) return false;
    if (/^(the company|the organisation|the organization)\b.*assessing\b/.test(lower)) return false;
    if (/^assess(?: the)? potential impact of\b/.test(lower)) return false;
    if (/^selected risks:/i.test(sentence)) return false;
    if (/^this (?:view|scenario)\b/.test(lower)) return false;
    return true;
  }) || sentences[0] || cleaned;
  headline = headline
    .replace(/^[a-z- ]+risk scenario:\s*/i, '')
    .replace(/^[a-z- ]+scenario:\s*/i, '')
    .replace(/^assess(?: the)? potential impact of\s+/i, '')
    .replace(/^this points to\b/i, '')
    .replace(/[.]+$/g, '')
    .trim();
  if (!headline) return '';
  if (headline.length <= maxLength) return headline;
  const truncated = headline.slice(0, maxLength);
  const cutAt = truncated.lastIndexOf(' ');
  return `${(cutAt > 48 ? truncated.slice(0, cutAt) : truncated).trim()}…`;
}

function isScenarioTitleAlignedWithSource(title = '', source = {}) {
  const titleTokens = tokeniseScenarioDisplayTitleText(title);
  if (!titleTokens.length) return false;
  const contextText = [
    getStructuredScenarioField(source?.structuredScenario, 'eventPath'),
    getStructuredScenarioField(source?.structuredScenario, 'primaryDriver'),
    getStructuredScenarioField(source?.structuredScenario, 'assetService'),
    source?.enhancedNarrative,
    source?.narrative,
    source?.sourceNarrative,
    source?.scenarioLens?.label,
    source?.scenarioLens?.key,
    ...(Array.isArray(source?.selectedRisks) ? source.selectedRisks.map(item => item?.title || item?.category || '') : []),
    ...(Array.isArray(source?.selectedRiskTitles) ? source.selectedRiskTitles : [])
  ].map(item => String(item || '').trim()).filter(Boolean).join(' ');
  const contextTokens = new Set(tokeniseScenarioDisplayTitleText(contextText));
  const overlap = titleTokens.filter(token => contextTokens.has(token)).length;
  if (titleTokens.length === 1) return overlap === 1;
  return overlap >= Math.min(2, titleTokens.length);
}

function resolveScenarioDisplayTitle(source = {}) {
  const storedTitle = String(source?.scenarioTitle || source?.title || '').trim();
  if (storedTitle && isScenarioTitleAlignedWithSource(storedTitle, source)) return storedTitle;
  const narrativeHeadline = buildScenarioHeadlineFromNarrative(
    source?.enhancedNarrative || source?.narrative || source?.sourceNarrative || ''
  );
  if (narrativeHeadline) return narrativeHeadline;
  const eventPath = String(getStructuredScenarioField(source?.structuredScenario, 'eventPath') || '').trim();
  if (eventPath) return eventPath;
  const firstSelectedRisk = Array.isArray(source?.selectedRisks)
    ? source.selectedRisks.map(item => String(item?.title || item?.category || '').trim()).find(Boolean)
    : '';
  if (firstSelectedRisk) return firstSelectedRisk;
  if (storedTitle) return storedTitle;
  const lensLabel = String(source?.scenarioLens?.label || source?.scenarioLens?.key || '').trim();
  return lensLabel ? `${lensLabel} risk scenario` : 'Risk scenario';
}

function _smartPrefillClamp(value, min = 0, max = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function _smartPrefillSigmoid(x, k = 6) {
  return 1 / (1 + Math.exp(-k * Number(x || 0)));
}

function normaliseSmartParamScenarioType(source = {}) {
  const direct = String(
    source?.primaryRiskCategory
    || source?.scenarioLens?.key
    || source?.scenarioType
    || source?.scenarioFamily
    || ''
  ).trim().toLowerCase();
  if (direct) return direct;
  const eventPath = String(getStructuredScenarioField(source?.structuredScenario, 'eventPath') || '').trim().toLowerCase();
  if (/identity|credential|account|phishing|mailbox/.test(eventPath)) return 'identity';
  if (/cloud|bucket|tenant|misconfig|saas/.test(eventPath)) return 'cloud';
  if (/data|privacy|breach|exfil/.test(eventPath)) return 'data-breach';
  if (/ransom|continuity|outage|recovery/.test(eventPath)) return 'business-continuity';
  if (/procurement|supplier|vendor|third[- ]party|supply/.test(eventPath)) return 'third-party';
  const functionKey = inferStoredScenarioFunctionKey(source);
  return functionKey || 'general';
}

function deriveSmartPrefillVulnerabilityRange(fairParams = {}) {
  const p = fairParams && typeof fairParams === 'object' ? fairParams : {};
  if ([p.vulnMin, p.vulnLikely, p.vulnMax].some(value => Number.isFinite(Number(value)))) {
    return {
      min: _smartPrefillClamp(Number(p.vulnMin || 0), 0.01, 0.99),
      likely: _smartPrefillClamp(Number(p.vulnLikely || 0), 0.01, 0.99),
      max: _smartPrefillClamp(Number(p.vulnMax || 0), 0.01, 0.99)
    };
  }
  const tcMin = Number(p.threatCapMin);
  const tcLikely = Number(p.threatCapLikely);
  const tcMax = Number(p.threatCapMax);
  const csMin = Number(p.controlStrMin);
  const csLikely = Number(p.controlStrLikely);
  const csMax = Number(p.controlStrMax);
  if (![tcMin, tcLikely, tcMax, csMin, csLikely, csMax].every(Number.isFinite)) return null;
  return {
    min: Number(_smartPrefillClamp(_smartPrefillSigmoid(tcMin - csMax), 0.01, 0.99).toFixed(2)),
    likely: Number(_smartPrefillClamp(_smartPrefillSigmoid(tcLikely - csLikely), 0.01, 0.99).toFixed(2)),
    max: Number(_smartPrefillClamp(_smartPrefillSigmoid(tcMax - csMin), 0.01, 0.99).toFixed(2))
  };
}

function buildSmartParamScenarioSummary(source = {}) {
  const parts = [
    String(source?.scenarioTitle || source?.title || '').trim(),
    String(source?.enhancedNarrative || source?.narrative || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'assetService') || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'primaryDriver') || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'eventPath') || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'effect') || '').trim(),
    ...(Array.isArray(source?.selectedRisks) ? source.selectedRisks.map(item => item?.title || item?.category || '') : []),
    ...(Array.isArray(source?.selectedRiskTitles) ? source.selectedRiskTitles : [])
  ].map(item => String(item || '').trim()).filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 900);
}

function buildSmartParamHistoryRecord(source = {}) {
  const fairParams = source?.results?.inputs && typeof source.results.inputs === 'object'
    ? source.results.inputs
    : (source?.fairParams && typeof source.fairParams === 'object' ? source.fairParams : null);
  if (!fairParams) return null;
  const tef = {
    min: Number(fairParams.tefMin),
    likely: Number(fairParams.tefLikely),
    max: Number(fairParams.tefMax)
  };
  const controls = {
    min: Number(fairParams.controlStrMin),
    likely: Number(fairParams.controlStrLikely),
    max: Number(fairParams.controlStrMax)
  };
  const vulnerability = deriveSmartPrefillVulnerabilityRange(fairParams);
  const lossKeys = ['ir', 'bi', 'db', 'rl', 'tp', 'rc'];
  const sumLoss = suffix => lossKeys.reduce((sum, prefix) => {
    const value = Number(fairParams?.[`${prefix}${suffix}`]);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  if (![tef.min, tef.likely, tef.max, controls.min, controls.likely, controls.max].every(Number.isFinite)) return null;
  if (!vulnerability) return null;
  const lmLow = sumLoss('Min');
  const lmLikely = sumLoss('Likely');
  const lmHigh = sumLoss('Max');
  if (![lmLow, lmLikely, lmHigh].every(Number.isFinite)) return null;
  return {
    assessmentId: String(source?.id || '').trim(),
    scenarioType: normaliseSmartParamScenarioType(source),
    tef: {
      min: Number(tef.min.toFixed(2)),
      likely: Number(tef.likely.toFixed(2)),
      max: Number(tef.max.toFixed(2))
    },
    vulnerability: {
      min: Number(vulnerability.min.toFixed(2)),
      likely: Number(vulnerability.likely.toFixed(2)),
      max: Number(vulnerability.max.toFixed(2))
    },
    controls: {
      min: Number(controls.min.toFixed(2)),
      likely: Number(controls.likely.toFixed(2)),
      max: Number(controls.max.toFixed(2))
    },
    lm_low: Math.max(0, Math.round(lmLow)),
    lm_likely: Math.max(0, Math.round(lmLikely)),
    lm_high: Math.max(0, Math.round(lmHigh))
  };
}

const SCENARIO_MEMORY_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'your', 'have', 'will',
  'risk', 'scenario', 'assessment', 'about', 'after', 'before', 'when', 'what', 'could',
  'would', 'should', 'been', 'were', 'they', 'them', 'their', 'there', 'where', 'while',
  'only', 'also', 'than', 'then', 'because', 'through', 'across', 'still', 'team', 'current',
  'draft', 'built', 'using', 'used'
]);

const SCENARIO_MEMORY_FUNCTION_OPTIONS = [
  { key: 'technology', label: 'Technology' },
  { key: 'operations', label: 'Operations' },
  { key: 'finance', label: 'Finance' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'strategic', label: 'Strategic' },
  { key: 'hse', label: 'HSE' },
  { key: 'general', label: 'General' }
];

function tokeniseScenarioMemoryText(text = '') {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(token => token.trim())
      .filter(token => token.length > 2 && !SCENARIO_MEMORY_STOPWORDS.has(token))
  ));
}

function buildScenarioMemoryNarrative(source = {}) {
  return [
    String(source?.scenarioTitle || source?.title || '').trim(),
    String(source?.enhancedNarrative || source?.narrative || source?.sourceNarrative || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'assetService') || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'primaryDriver') || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'eventPath') || '').trim(),
    String(getStructuredScenarioField(source?.structuredScenario, 'effect') || '').trim(),
    ...(Array.isArray(source?.selectedRisks) ? source.selectedRisks.map(item => item?.title || item?.category || '') : []),
    ...(Array.isArray(source?.selectedRiskTitles) ? source.selectedRiskTitles : [])
  ].map(item => String(item || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function _buildScenarioMemoryCurrentContext(source = {}) {
  return {
    narrative: buildScenarioMemoryNarrative(source),
    buId: String(source?.buId || '').trim(),
    lensKey: String(source?.scenarioLens?.key || '').trim().toLowerCase(),
    functionKey: inferStoredScenarioFunctionKey(source)
  };
}

function _readAllScenarioMemoryAssessments() {
  const results = [];
  const seen = new Set();
  const prefix = `${ASSESSMENTS_STORAGE_PREFIX}__`;
  if (typeof localStorage === 'undefined') return results;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const username = key.slice(prefix.length);
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) continue;
      raw.forEach((entry) => {
        const assessment = typeof normaliseAssessmentRecord === 'function'
          ? normaliseAssessmentRecord(entry)
          : entry;
        if (!assessment?.id || !assessment?.results) return;
        if (seen.has(String(assessment.id))) return;
        seen.add(String(assessment.id));
        results.push({
          assessment,
          username: String(username || '').trim().toLowerCase(),
          storageKey: key
        });
      });
    }
  } catch {}
  return results;
}

function _resolveScenarioMemoryCompanyEntityId(assessment, settings = getAdminSettings()) {
  const bu = getBUList().find(item => item.id === String(assessment?.buId || '').trim()) || null;
  let node = bu?.orgEntityId ? getEntityById(settings.companyStructure || [], bu.orgEntityId) : null;
  let companyId = '';
  while (node) {
    if (typeof isCompanyEntityType === 'function' && isCompanyEntityType(node.type)) {
      companyId = String(node.id || '').trim();
    }
    const parentId = String(node.parentId || '').trim();
    node = parentId ? getEntityById(settings.companyStructure || [], parentId) : null;
  }
  return companyId;
}

function _buildScenarioMemoryAleRange(results = {}) {
  const ale = results?.ale && typeof results.ale === 'object' ? results.ale : {};
  const low = Number(ale.p50 || ale.mean || 0);
  const high = Number(ale.p90 || ale.mean || 0);
  if (!Number.isFinite(low) && !Number.isFinite(high)) return 'ALE not available';
  return `${fmtCurrency(Math.max(0, low || 0))}–${fmtCurrency(Math.max(0, high || 0))}`;
}

function _deriveScenarioMemoryTreatmentStatus(assessment = {}) {
  const reviewStatus = String(assessment?.reviewSubmission?.reviewStatus || '').trim().toLowerCase();
  if (reviewStatus === 'approved') return { label: 'Approved', tone: 'success' };
  if (reviewStatus === 'pending') return { label: 'Under review', tone: 'warning' };
  if (reviewStatus === 'changes_requested') return { label: 'Needs revision', tone: 'warning' };
  if (reviewStatus === 'escalated') return { label: 'Escalated', tone: 'danger' };
  if (String(assessment?.lifecycleStatus || '').trim().toLowerCase() === 'treatment_variant') {
    return { label: 'Treatment case', tone: 'gold' };
  }
  if (assessment?.results?.toleranceBreached) return { label: 'Needs treatment', tone: 'danger' };
  if (assessment?.results?.nearTolerance) return { label: 'Monitor closely', tone: 'warning' };
  if (Array.isArray(assessment?.recommendations) && assessment.recommendations.length) {
    return { label: 'Action identified', tone: 'neutral' };
  }
  return { label: 'Monitor', tone: 'neutral' };
}

function _scoreScenarioMemoryMatch(currentContext, assessment = {}) {
  const queryTokens = tokeniseScenarioMemoryText(currentContext?.narrative || '');
  const candidateTokens = tokeniseScenarioMemoryText(buildScenarioMemoryNarrative(assessment));
  const candidateTokenSet = new Set(candidateTokens);
  const overlapTokens = queryTokens.filter(token => candidateTokenSet.has(token));
  const referenceCount = Math.max(
    0,
    Number(assessment?.scenarioMemory?.referenceCount || assessment?.referenceCount || 0)
  );
  let score = overlapTokens.length * 14;
  if (currentContext?.buId && String(assessment?.buId || '').trim() === currentContext.buId) score += 12;
  if (currentContext?.functionKey && inferStoredScenarioFunctionKey(assessment) === currentContext.functionKey) score += 10;
  if (currentContext?.lensKey && String(assessment?.scenarioLens?.key || '').trim().toLowerCase() === currentContext.lensKey) score += 8;
  score += Math.min(referenceCount * 4, 20);
  if (assessment?.scenarioMemory?.referenced || assessment?.referenced) score += 4;
  if (String(currentContext?.narrative || '').trim() && buildScenarioMemoryNarrative(assessment).toLowerCase().includes(String(currentContext.narrative || '').trim().toLowerCase().slice(0, 80))) {
    score += 6;
  }
  return {
    overlapTokens,
    overlapCount: overlapTokens.length,
    referenceCount,
    score
  };
}

function findSimilarScenarioMemoryMatches(source = {}, { limit = 3 } = {}) {
  const currentContext = _buildScenarioMemoryCurrentContext(source);
  const query = String(currentContext.narrative || '').trim();
  if (tokeniseScenarioMemoryText(query).length < 4) {
    return { query, totalMatches: 0, matches: [] };
  }
  const ranked = _readAllScenarioMemoryAssessments()
    .filter((entry) => entry?.assessment?.id && String(entry.assessment.id) !== String(source?.id || '').trim())
    .map((entry) => {
      const scoring = _scoreScenarioMemoryMatch(currentContext, entry.assessment);
      return {
        ...entry,
        ...scoring,
        companyEntityId: _resolveScenarioMemoryCompanyEntityId(entry.assessment),
        functionKey: inferStoredScenarioFunctionKey(entry.assessment),
        lastRunAt: Number(entry.assessment.completedAt || entry.assessment.createdAt || 0),
        aleRange: _buildScenarioMemoryAleRange(entry.assessment.results),
        treatmentStatus: _deriveScenarioMemoryTreatmentStatus(entry.assessment)
      };
    })
    .filter((entry) => entry.overlapCount >= 2 || entry.score >= 24)
    .sort((left, right) => (
      right.score - left.score
      || right.referenceCount - left.referenceCount
      || right.lastRunAt - left.lastRunAt
      || String(left.assessment?.scenarioTitle || '').localeCompare(String(right.assessment?.scenarioTitle || ''))
    ));
  return {
    query,
    totalMatches: ranked.length,
    matches: ranked.slice(0, Math.max(1, Number(limit || 0) || 3)).map((entry) => ({
      ...entry.assessment,
      _scenarioMemory: {
        storageKey: entry.storageKey,
        username: entry.username,
        score: entry.score,
        overlapCount: entry.overlapCount,
        overlapTokens: entry.overlapTokens,
        referenceCount: entry.referenceCount,
        functionKey: entry.functionKey,
        companyEntityId: entry.companyEntityId,
        aleRange: entry.aleRange,
        treatmentStatus: entry.treatmentStatus,
        lastRunAt: entry.lastRunAt
      }
    }))
  };
}

function markScenarioMemoryReference(assessmentId = '') {
  const targetId = String(assessmentId || '').trim();
  if (!targetId || typeof localStorage === 'undefined') return 0;
  const prefix = `${ASSESSMENTS_STORAGE_PREFIX}__`;
  let updated = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) continue;
      let changed = false;
      const next = raw.map((entry) => {
        const assessment = typeof normaliseAssessmentRecord === 'function'
          ? normaliseAssessmentRecord(entry)
          : entry;
        if (String(assessment?.id || '').trim() !== targetId) return assessment;
        changed = true;
        updated += 1;
        const currentCount = Math.max(
          0,
          Number(assessment?.scenarioMemory?.referenceCount || assessment?.referenceCount || 0)
        );
        return {
          ...assessment,
          referenced: true,
          referenceCount: currentCount + 1,
          lastReferencedAt: Date.now(),
          scenarioMemory: {
            ...(assessment?.scenarioMemory && typeof assessment.scenarioMemory === 'object' ? assessment.scenarioMemory : {}),
            referenced: true,
            referenceCount: currentCount + 1,
            lastReferencedAt: Date.now()
          }
        };
      });
      if (changed) localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {}
  return updated;
}

function getScenarioMemoryResetTargetOptions(scope = 'company', settings = getAdminSettings()) {
  const safeScope = String(scope || 'company').trim().toLowerCase();
  if (safeScope === 'bu') {
    return getBUList().map(bu => ({
      value: String(bu.id || '').trim(),
      label: String(bu.name || 'Business unit').trim()
    })).filter(item => item.value);
  }
  if (safeScope === 'function') {
    return SCENARIO_MEMORY_FUNCTION_OPTIONS.map(item => ({
      value: item.key,
      label: item.label
    }));
  }
  const companies = getCompanyEntities(settings.companyStructure || []);
  return companies.map(company => ({
    value: String(company.id || '').trim(),
    label: String(company.name || 'Company').trim()
  })).filter(item => item.value);
}

function resetScenarioMemorySignals({ scope = 'company', targetId = '' } = {}) {
  if (typeof localStorage === 'undefined') return { resetCount: 0 };
  const safeScope = String(scope || 'company').trim().toLowerCase();
  const safeTargetId = String(targetId || '').trim();
  const settings = getAdminSettings();
  const prefix = `${ASSESSMENTS_STORAGE_PREFIX}__`;
  let resetCount = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) continue;
      let changed = false;
      const next = raw.map((entry) => {
        const assessment = typeof normaliseAssessmentRecord === 'function'
          ? normaliseAssessmentRecord(entry)
          : entry;
        const matchesScope = safeScope === 'bu'
          ? String(assessment?.buId || '').trim() === safeTargetId
          : safeScope === 'function'
            ? inferStoredScenarioFunctionKey(assessment) === safeTargetId
            : (!safeTargetId || _resolveScenarioMemoryCompanyEntityId(assessment, settings) === safeTargetId);
        if (!matchesScope) return assessment;
        if (!(assessment?.scenarioMemory?.referenced || assessment?.referenced || assessment?.scenarioMemory?.referenceCount || assessment?.referenceCount)) {
          return assessment;
        }
        changed = true;
        resetCount += 1;
        const nextAssessment = { ...assessment };
        delete nextAssessment.referenced;
        delete nextAssessment.referenceCount;
        delete nextAssessment.lastReferencedAt;
        if (nextAssessment.scenarioMemory && typeof nextAssessment.scenarioMemory === 'object') {
          delete nextAssessment.scenarioMemory.referenced;
          delete nextAssessment.scenarioMemory.referenceCount;
          delete nextAssessment.scenarioMemory.lastReferencedAt;
          if (!Object.keys(nextAssessment.scenarioMemory).length) delete nextAssessment.scenarioMemory;
        }
        return nextAssessment;
      });
      if (changed) localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {}
  return { resetCount };
}

const AI_FLAG_FEEDBACK_STORAGE_PREFIX = 'rip_ai_flags_feedback';
const AI_FLAG_SNOOZE_STORAGE_PREFIX = 'rip_ai_flags_snooze';
const AI_FLAG_HISTORY_STORAGE_PREFIX = 'rip_ai_flags_history';

function getAiFlagStorageKey(prefix) {
  try {
    return buildUserStorageKey(prefix);
  } catch {
    return prefix;
  }
}

function readAiFlagFeedback() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(getAiFlagStorageKey(AI_FLAG_FEEDBACK_STORAGE_PREFIX)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function recordAiFlagFeedback({
  assessmentId = '',
  outcome = '',
  signalFamilies = []
} = {}) {
  if (typeof localStorage === 'undefined') return null;
  const entry = {
    id: `ai_flag_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    assessmentId: String(assessmentId || '').trim(),
    outcome: String(outcome || '').trim().toLowerCase(),
    signalFamilies: Array.isArray(signalFamilies) ? signalFamilies.map(item => String(item || '').trim().toLowerCase()).filter(Boolean) : []
  };
  try {
    const existing = readAiFlagFeedback();
    existing.unshift(entry);
    localStorage.setItem(getAiFlagStorageKey(AI_FLAG_FEEDBACK_STORAGE_PREFIX), JSON.stringify(existing.slice(0, 80)));
  } catch {}
  return entry;
}

function readAiFlagSnoozes() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(getAiFlagStorageKey(AI_FLAG_SNOOZE_STORAGE_PREFIX)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function snoozeAssessmentAiFlag(assessmentId = '', days = 30) {
  if (typeof localStorage === 'undefined') return 0;
  const safeId = String(assessmentId || '').trim();
  if (!safeId) return 0;
  const until = Date.now() + (Math.max(1, Number(days || 0) || 30) * 86400000);
  try {
    const next = { ...readAiFlagSnoozes(), [safeId]: until };
    localStorage.setItem(getAiFlagStorageKey(AI_FLAG_SNOOZE_STORAGE_PREFIX), JSON.stringify(next));
  } catch {}
  return until;
}

function readAiFlagGenerationHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(getAiFlagStorageKey(AI_FLAG_HISTORY_STORAGE_PREFIX)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function noteAiFlagGenerationSession({
  sessionId = '',
  generatedCount = 0
} = {}) {
  if (typeof localStorage === 'undefined') return null;
  const safeSessionId = String(sessionId || '').trim();
  if (!safeSessionId) return null;
  const existing = readAiFlagGenerationHistory();
  const alreadyRecorded = existing.find(item => String(item?.sessionId || '') === safeSessionId);
  if (alreadyRecorded) return alreadyRecorded;
  const entry = {
    id: `ai_flag_session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    sessionId: safeSessionId,
    timestamp: Date.now(),
    generatedCount: Math.max(0, Number(generatedCount || 0) || 0)
  };
  try {
    existing.unshift(entry);
    localStorage.setItem(getAiFlagStorageKey(AI_FLAG_HISTORY_STORAGE_PREFIX), JSON.stringify(existing.slice(0, 30)));
  } catch {}
  return entry;
}

function getAiFlagPromptBias({ minSessions = 3, limit = 3 } = {}) {
  const history = readAiFlagGenerationHistory();
  const sessionCount = new Set(history.map(item => String(item?.sessionId || '').trim()).filter(Boolean)).size;
  if (sessionCount < Math.max(1, Number(minSessions || 0) || 3)) {
    return { sessionCount, prioritised: [], deprioritised: [] };
  }
  const counts = new Map();
  readAiFlagFeedback().forEach((entry) => {
    const outcome = String(entry?.outcome || '').trim().toLowerCase();
    if (!outcome) return;
    const families = Array.isArray(entry?.signalFamilies) ? entry.signalFamilies : [];
    families.forEach((family) => {
      const key = String(family || '').trim().toLowerCase();
      if (!key) return;
      const current = counts.get(key) || { acted: 0, dismissed: 0 };
      if (outcome === 'acted') current.acted += 1;
      if (outcome === 'dismissed') current.dismissed += 1;
      counts.set(key, current);
    });
  });
  const ranked = Array.from(counts.entries()).map(([family, values]) => ({
    family,
    acted: values.acted || 0,
    dismissed: values.dismissed || 0,
    delta: (values.acted || 0) - (values.dismissed || 0)
  }));
  return {
    sessionCount,
    prioritised: ranked
      .filter(item => item.delta > 0)
      .sort((left, right) => right.delta - left.delta || right.acted - left.acted || left.family.localeCompare(right.family))
      .slice(0, Math.max(1, Number(limit || 0) || 3))
      .map(item => item.family),
    deprioritised: ranked
      .filter(item => item.delta < 0)
      .sort((left, right) => left.delta - right.delta || right.dismissed - left.dismissed || left.family.localeCompare(right.family))
      .slice(0, Math.max(1, Number(limit || 0) || 3))
      .map(item => item.family)
  };
}

function _coerceAssessmentReferenceTimestamp(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return 0;
  }
  const safe = String(value || '').trim();
  if (!safe) return 0;
  const direct = Date.parse(safe);
  if (Number.isFinite(direct)) return direct;
  if (/^\d{4}$/.test(safe)) {
    const yearOnly = Date.parse(`${safe}-01-01`);
    return Number.isFinite(yearOnly) ? yearOnly : 0;
  }
  return 0;
}

function _extractAssessmentEvidenceAgeDays(assessment = {}, now = Date.now()) {
  const sources = [
    ...(Array.isArray(assessment?.citations) ? normaliseCitations(assessment.citations) : []),
    ...(Array.isArray(assessment?.supportingReferences) ? assessment.supportingReferences : [])
  ].filter(Boolean);
  let maxAgeDays = 0;
  sources.forEach((item) => {
    const candidate = item && typeof item === 'object'
      ? [
          item.lastUpdated,
          item.publishedAt,
          item.sourceDate,
          item.date,
          item.effectiveDate,
          item.updatedAt
        ]
      : [];
    candidate.forEach((value) => {
      const ts = _coerceAssessmentReferenceTimestamp(value);
      if (!ts || ts > now) return;
      maxAgeDays = Math.max(maxAgeDays, Math.floor((now - ts) / 86400000));
    });
  });
  return maxAgeDays;
}

function _extractAssessmentConfidenceScore(assessment = {}) {
  const direct = [
    assessment?.assessmentIntelligence?.confidence?.score,
    assessment?.results?.confidence?.score,
    assessment?.confidenceScore
  ].map(Number).find(Number.isFinite);
  if (Number.isFinite(direct)) return direct;
  const label = String(assessment?.confidenceLabel || assessment?.assessmentIntelligence?.confidence?.label || '').trim().toLowerCase();
  if (label.includes('high')) return 82;
  if (label.includes('low')) return 42;
  return 58;
}

function _buildAssessmentTreatmentStatus(assessment = {}) {
  const reviewStatus = String(assessment?.reviewSubmission?.reviewStatus || '').trim();
  if (reviewStatus === 'changes_requested') return 'Changes requested';
  if (reviewStatus === 'approved') return 'Approved';
  if (reviewStatus === 'pending') return 'Pending review';
  const treatmentRequest = String(assessment?.treatmentImprovementRequest || '').trim();
  if (treatmentRequest) return treatmentRequest;
  const recommendation = Array.isArray(assessment?.recommendations) ? assessment.recommendations.find(Boolean) : null;
  if (recommendation?.title || recommendation?.why) {
    return String(recommendation.title || recommendation.why || '').trim();
  }
  return String(assessment?.assessmentIntelligence?.executiveAction || 'Current treatment state not stated').trim();
}

function _hasPlannedTreatmentWithoutFollowUp(assessment = {}, lifecycleStatus = '') {
  const text = [
    assessment?.treatmentImprovementRequest,
    assessment?.assessmentIntelligence?.executiveAction,
    ...(Array.isArray(assessment?.recommendations)
      ? assessment.recommendations.flatMap(item => [item?.title, item?.why, item?.impact])
      : [])
  ].map(item => String(item || '').trim()).filter(Boolean).join(' ');
  if (!/(planned|plan\b|roadmap|rollout|deploy|implementation|implement|in progress|pending)/i.test(text)) return false;
  if (/(completed|implemented|closed|validated|done)/i.test(text)) return false;
  const hasFollowUp = lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT
    || !!assessment?.comparisonBaselineId
    || !!assessment?.reviewSubmission?.reviewedAt
    || !!assessment?.nextReviewDue
    || !!assessment?.treatmentFollowUpAt;
  return !hasFollowUp;
}

function buildAssessmentAiFlagSignals(assessment, { now = Date.now() } = {}) {
  if (!assessment?.id || !assessment?.results) return null;
  const results = assessment.results || {};
  const completedAt = new Date(assessment.completedAt || assessment.lifecycleUpdatedAt || assessment.createdAt || 0).getTime() || 0;
  const ageInDays = completedAt ? Math.max(0, Math.floor((now - completedAt) / 86400000)) : 0;
  const evidenceAgeInDays = _extractAssessmentEvidenceAgeDays(assessment, now);
  const lifecycleStatus = typeof deriveAssessmentLifecycleStatus === 'function'
    ? deriveAssessmentLifecycleStatus(assessment)
    : String(assessment?.lifecycleStatus || '').trim().toLowerCase();
  const treatmentStatus = _buildAssessmentTreatmentStatus(assessment);
  const confidenceScore = _extractAssessmentConfidenceScore(assessment);
  const aleMean = Number(results?.ale?.mean || 0);
  const p90Loss = Number(results?.eventLoss?.p90 || 0);
  const signals = [];
  const addSignal = (key, label, family, weight) => {
    if (!key || signals.some(item => item.key === key)) return;
    signals.push({ key, label, family, weight: Number(weight || 0) || 0 });
  };

  if (ageInDays > 180) {
    addSignal('age', `Reviewed ${ageInDays} days ago`, 'age', 1);
  }
  if (evidenceAgeInDays > 365) {
    addSignal('evidence_age', `Evidence references are ${evidenceAgeInDays} days old`, 'evidence', 2);
  }
  if (_hasPlannedTreatmentWithoutFollowUp(assessment, lifecycleStatus)) {
    addSignal('planned_treatment', 'Treatment is planned but no follow-up is recorded', 'treatment', 2);
  }
  if (aleMean > 500000 && confidenceScore < 60) {
    addSignal('confidence_gap', 'Loss remains material while confidence is still low', 'confidence', 3);
  }
  if (!signals.length) return null;
  const severity = signals.reduce((sum, item) => sum + item.weight, 0);
  return {
    id: String(assessment.id || '').trim(),
    title: String(assessment.scenarioTitle || assessment.title || 'Untitled assessment').trim(),
    updatedAt: completedAt,
    ageInDays,
    evidenceAgeInDays,
    confidenceScore,
    aleMean,
    p90Loss,
    aleRange: `${fmtCurrency(aleMean || 0)} mean ALE · ${fmtCurrency(p90Loss || 0)} bad year`,
    treatmentStatus,
    signals,
    severity,
    assessment
  };
}

const PORTFOLIO_CORRELATION_ACTIONS_KEY = 'rip_corr_acted';

function getPortfolioCorrelationActionStorageKey() {
  try {
    return buildUserStorageKey(PORTFOLIO_CORRELATION_ACTIONS_KEY);
  } catch {
    return PORTFOLIO_CORRELATION_ACTIONS_KEY;
  }
}

function readPortfolioCorrelationActions() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(getPortfolioCorrelationActionStorageKey()) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function recordPortfolioCorrelationAction({
  clusterLabel = '',
  sharedDependency = '',
  assessmentIds = []
} = {}) {
  if (typeof localStorage === 'undefined') return null;
  const entry = {
    id: `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    clusterLabel: String(clusterLabel || '').trim(),
    sharedDependency: String(sharedDependency || '').trim(),
    assessmentIds: Array.isArray(assessmentIds) ? assessmentIds.map(id => String(id || '').trim()).filter(Boolean) : []
  };
  try {
    const existing = readPortfolioCorrelationActions();
    existing.unshift(entry);
    localStorage.setItem(getPortfolioCorrelationActionStorageKey(), JSON.stringify(existing.slice(0, 40)));
  } catch {}
  return entry;
}

function getPrioritisedPortfolioCorrelationDependencies(limit = 3) {
  const counts = new Map();
  readPortfolioCorrelationActions().forEach((entry) => {
    const key = String(entry?.sharedDependency || entry?.clusterLabel || '').trim().toLowerCase();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, Math.max(1, Number(limit || 0) || 3))
    .map(([dependency]) => dependency);
}

function inferCapabilityManagedFunctionKey(capability = {}) {
  const label = String(
    capability?.managedDepartment?.departmentHint
    || capability?.managedDepartment?.name
    || capability?.selectedDepartment?.departmentHint
    || capability?.selectedDepartment?.name
    || ''
  ).trim();
  if (!label) return '';
  return inferStoredScenarioFunctionKey({ title: label });
}

function getReviewerVisibleAssessmentEntries(capability = {}) {
  const allEntries = _readAllScenarioMemoryAssessments();
  const buList = Array.isArray(getBUList?.()) ? getBUList() : [];
  const managedBusinessEntityId = String(
    capability?.managedBusinessId
    || capability?.selection?.businessUnitEntityId
    || ''
  ).trim();
  const managedDepartmentParentId = String(
    capability?.managedDepartment?.parentId
    || capability?.selection?.businessUnitEntityId
    || ''
  ).trim();
  const managedFunctionKey = inferCapabilityManagedFunctionKey(capability);
  const canManageBusinessUnit = !!capability?.canManageBusinessUnit;
  const canManageDepartment = !!capability?.canManageDepartment;
  return allEntries.filter((entry) => {
    const assessment = entry?.assessment;
    if (!assessment?.id || !assessment?.results) return false;
    if (deriveAssessmentLifecycleStatus(assessment) === ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED) return false;
    const assessmentBu = buList.find(item => String(item?.id || '').trim() === String(assessment?.buId || '').trim()) || null;
    const assessmentBusinessEntityId = String(assessmentBu?.orgEntityId || '').trim();
    if (canManageBusinessUnit) {
      return !managedBusinessEntityId || assessmentBusinessEntityId === managedBusinessEntityId;
    }
    if (canManageDepartment) {
      if (managedDepartmentParentId && assessmentBusinessEntityId && assessmentBusinessEntityId !== managedDepartmentParentId) return false;
      if (managedFunctionKey) return inferStoredScenarioFunctionKey(assessment) === managedFunctionKey;
      return true;
    }
    return false;
  });
}

function _truncateCorrelationText(value = '', maxLength = 140) {
  const safe = String(value || '').replace(/\s+/g, ' ').trim();
  if (safe.length <= maxLength) return safe;
  return `${safe.slice(0, Math.max(24, maxLength - 1)).trimEnd()}…`;
}

function _extractPortfolioControlHints(assessment = {}) {
  const fairParams = assessment?.results?.inputs || assessment?.draft?.fairParams || assessment?.fairParams || {};
  const rationale = fairParams?.fieldRationale && typeof fairParams.fieldRationale === 'object'
    ? fairParams.fieldRationale
    : {};
  const controlStrength = fairParams?.controlStrLikely != null
    ? `Control strength likely ${fairParams.controlStrLikely}`
    : '';
  const hints = [
    controlStrength,
    rationale.controlStrLikely,
    rationale.controlStrMin,
    rationale.controlStrMax,
    ...(Array.isArray(assessment?.assessmentIntelligence?.assumptions) ? assessment.assessmentIntelligence.assumptions.map(item => item?.text || item) : []),
    ...(Array.isArray(assessment?.results?.runMetadata?.assumptions) ? assessment.results.runMetadata.assumptions : []),
    ...(Array.isArray(assessment?.citations) ? assessment.citations.map(item => item?.title || item?.sourceTitle || '') : [])
  ]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => /control|mfa|identity|monitor|vendor|backup|recovery|segregation|approval|detection|response|patch|access|encryption|screening|review/i.test(item));
  return Array.from(new Set(hints)).slice(0, 4);
}

function buildPortfolioCorrelationFingerprint(assessment = {}) {
  const topRisks = Array.isArray(assessment?.selectedRisks)
    ? assessment.selectedRisks.map(item => item?.title || item?.category || '').filter(Boolean).slice(0, 3)
    : [];
  const primaryThreat = [
    getStructuredScenarioField(assessment?.structuredScenario, 'primaryDriver'),
    getStructuredScenarioField(assessment?.structuredScenario, 'assetService'),
    getStructuredScenarioField(assessment?.structuredScenario, 'eventPath'),
    Array.isArray(assessment?.applicableRegulations) ? assessment.applicableRegulations.slice(0, 3).join(', ') : '',
    topRisks.join(', ')
  ].map(item => String(item || '').trim()).filter(Boolean).join(' · ');
  const treatmentStatus = _deriveScenarioMemoryTreatmentStatus(assessment);
  return {
    id: String(assessment?.id || '').trim(),
    title: String(assessment?.scenarioTitle || assessment?.title || 'Untitled assessment').trim(),
    primaryThreat: _truncateCorrelationText(primaryThreat || assessment?.narrative || assessment?.enhancedNarrative || 'Threat not stated', 180),
    controlsListed: _extractPortfolioControlHints(assessment).join('; ') || 'Controls not explicitly stated',
    treatmentStatus: treatmentStatus.label,
    aleRange: _buildScenarioMemoryAleRange(assessment?.results)
  };
}

function flagPortfolioCorrelationClusterForReview(assessmentIds = [], {
  clusterLabel = '',
  sharedDependency = ''
} = {}) {
  const ids = new Set((Array.isArray(assessmentIds) ? assessmentIds : []).map(id => String(id || '').trim()).filter(Boolean));
  if (!ids.size || typeof localStorage === 'undefined') return { updatedCount: 0 };
  const prefix = `${ASSESSMENTS_STORAGE_PREFIX}__`;
  let updatedCount = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(raw)) continue;
      let changed = false;
      const next = raw.map((entry) => {
        const assessment = typeof normaliseAssessmentRecord === 'function'
          ? normaliseAssessmentRecord(entry)
          : entry;
        if (!ids.has(String(assessment?.id || '').trim()) || !assessment?.results) return assessment;
        changed = true;
        updatedCount += 1;
        const flaggedCandidate = {
          ...assessment,
          portfolioCorrelationFlag: {
            clusterLabel: String(clusterLabel || '').trim(),
            sharedDependency: String(sharedDependency || '').trim(),
            flaggedAt: Date.now()
          }
        };
        if (typeof prepareAssessmentForSave === 'function') {
          return prepareAssessmentForSave(flaggedCandidate, {
            existingAssessment: assessment,
            targetStatus: ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW,
            at: new Date().toISOString()
          });
        }
        return {
          ...flaggedCandidate,
          lifecycleStatus: ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW
        };
      });
      if (changed) localStorage.setItem(key, JSON.stringify(next));
    }
  } catch {}
  if (updatedCount) {
    try {
      resetUserStateCache(AuthService.getCurrentUser()?.username || '');
    } catch {}
  }
  return { updatedCount };
}

function extractScenarioPattern(assessment) {
  if (!assessment || !assessment.results) return null;
  const resolvedTitle = typeof resolveScenarioDisplayTitle === 'function'
    ? resolveScenarioDisplayTitle({
        ...assessment,
        narrative: String(assessment?.narrative || '').trim(),
        enhancedNarrative: String(assessment?.enhancedNarrative || assessment?.narrative || '').trim()
      })
    : String(assessment.scenarioTitle || getStructuredScenarioField(assessment.structuredScenario, 'eventPath') || '').trim();
  return {
    id: String(assessment.id || '').trim(),
    buId: String(assessment.buId || '').trim(),
    functionKey: inferStoredScenarioFunctionKey(assessment),
    scenarioLens: assessment?.scenarioLens && typeof assessment.scenarioLens === 'object'
      ? { ...assessment.scenarioLens }
      : null,
    title: resolvedTitle,
    scenarioType: String(getStructuredScenarioField(assessment.structuredScenario, 'eventPath') || resolvedTitle || '').trim(),
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
    if (username && typeof LearningStore !== 'undefined' && typeof LearningStore.saveScenarioPattern === 'function') {
      LearningStore.saveScenarioPattern(username, pattern);
    }
    let patterns = Array.isArray(AppState.userStateCache?.learningStore?.scenarioPatterns)
      ? AppState.userStateCache.learningStore.scenarioPatterns
      : [];
    try {
      if (!patterns.length) {
        const key = buildUserStorageKey(LEARNING_STORAGE_PREFIX, username);
        const store = JSON.parse(localStorage.getItem(key) || '{}') || {};
        patterns = Array.isArray(store.scenarioPatterns) ? store.scenarioPatterns : [];
      }
    } catch {}
    const updatedPatternsArray = [
      pattern,
      ...patterns.filter(p => p.id !== pattern.id)
    ].slice(0, 20);
    patchLearningStore({ scenarioPatterns: updatedPatternsArray });
  } catch {}
}

function deepMergeLearningStore(current, updates) {
  const baseCurrent = current && typeof current === 'object' ? current : {};
  const sourceUpdates = updates && typeof updates === 'object' ? updates : {};
  const result = { ...baseCurrent };
  Object.keys(sourceUpdates).forEach(key => {
    const val = sourceUpdates[key];
    if (val && typeof val === 'object' && !Array.isArray(val)
        && baseCurrent[key] && typeof baseCurrent[key] === 'object'
        && !Array.isArray(baseCurrent[key])) {
      result[key] = { ...baseCurrent[key], ...val };
    } else {
      result[key] = val;
    }
  });
  return result;
}

function patchLearningStore(updates = {}) {
  const username = AuthService.getCurrentUser()?.username || '';
  if (!username) return;

  const current = typeof normaliseLearningStoreSection === 'function'
    ? normaliseLearningStoreSection(AppState.userStateCache?.learningStore || {})
    : (AppState.userStateCache?.learningStore || buildDefaultLearningStoreState());
  const next = typeof normaliseLearningStoreSection === 'function'
    ? normaliseLearningStoreSection(deepMergeLearningStore(current, updates))
    : deepMergeLearningStore(current, updates);

  updateUserStateCache({
    ...(AppState.userStateCache || {}),
    username: String(AppState.userStateCache?.username || username).trim().toLowerCase(),
    learningStore: next
  });

  try {
    const key = buildUserStorageKey(LEARNING_STORAGE_PREFIX, username);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}

  queueSharedUserStateSync({ learningStore: next }, username);
}

function getRelevantScenarioPatterns(buId, limit = 3) {
  void buId;
  void limit;
  return [];
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
  const helpAudience = getHelpAudienceModel({ currentUser, isAdmin, nonAdminCapability, roleSummary });
  UI.modal({
    title: 'Desktop shortcuts',
    body: `<div style="display:grid;gap:var(--sp-3)">
      <div class="context-panel-copy">These shortcuts are desktop-only and are ignored while you are typing in a field.</div>
      ${renderHelpShortcutCards(helpAudience.shortcutCards)}
      <div class="form-help">${escapeHtml(String(helpAudience.shortcutHint || 'These shortcuts are available only when the matching control is visible in your current workspace.'))}</div>
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
  return resolveHostedApiUrl('/api/audit-log');
}

async function requestAuditLog(method = 'GET', payload, { includeAdminSecret = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const sessionToken = AuthService.getApiSessionToken();
  if (includeAdminSecret && !sessionToken && AuthService.getAdminApiSecret()) headers['x-admin-secret'] = AuthService.getAdminApiSecret();
  if (sessionToken) headers['x-session-token'] = sessionToken;
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
  const previousCache = AppState.auditLogCache || { loaded: false, loading: false, entries: [], summary: null, error: '', lastLoadedAt: 0 };
  AppState.auditLogCache.loading = true;
  try {
    const data = await requestAuditLog('GET', undefined, { includeAdminSecret: true });
    AppState.auditLogCache = {
      loaded: true,
      loading: false,
      entries: Array.isArray(data.entries) ? data.entries : [],
      summary: data.summary || null,
      error: '',
      lastLoadedAt: Date.now()
    };
    return AppState.auditLogCache;
  } catch (error) {
    AppState.auditLogCache = {
      loaded: true,
      loading: false,
      entries: Array.isArray(previousCache.entries) ? previousCache.entries : [],
      summary: previousCache.summary || null,
      lastLoadedAt: Number(previousCache.lastLoadedAt || 0),
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
  return resolveHostedApiUrl('/api/user-state');
}

async function requestUserState(method = 'GET', username, payload, audit = null) {
  return window.AppSharedStateClient.requestUserState(method, username, payload, audit);
}

async function loadSharedUserState(username = AuthService.getCurrentUser()?.username || '') {
  return window.AppSharedStateClient.loadSharedUserState(username);
}

const SERVER_CONTEXT_REFRESH_THROTTLE_MS = 15 * 1000;
let _serverContextRefreshInFlight = null;
let _lastServerContextRefreshAt = 0;
let _serverContextRefreshBound = false;

function buildManagedAccessSignature(user = AuthService.getCurrentUser()) {
  return [
    String(user?.username || '').trim().toLowerCase(),
    String(user?.role || '').trim().toLowerCase(),
    String(user?.businessUnitEntityId || '').trim(),
    String(user?.departmentEntityId || '').trim()
  ].join('|');
}

async function refreshAuthenticatedContextFromServer(options = {}) {
  const currentUser = AuthService.getCurrentUser();
  if (!currentUser?.username) return false;

  const force = options.force === true;
  const allowWorkspaceReload = options.allowWorkspaceReload !== false && !hasUnsafeWorkspaceEdits();
  const shouldRerender = options.rerender !== false && allowWorkspaceReload;
  const now = Date.now();

  if (!force && _serverContextRefreshInFlight) return _serverContextRefreshInFlight;
  if (!force && now - _lastServerContextRefreshAt < SERVER_CONTEXT_REFRESH_THROTTLE_MS) return false;

  const beforeSignature = buildManagedAccessSignature(currentUser);
  const beforeSettingsRevision = Number(AppState.adminSettingsCache?._meta?.revision || 0);
  const beforeStateRevision = Number(AppState.userStateCache?._meta?.revision || 0);

  _serverContextRefreshInFlight = (async () => {
    let scopeChanged = false;
    let settingsChanged = false;
    let stateChanged = false;
    try {
      try {
        if (typeof AuthService.refreshCurrentSessionUser === 'function') {
          await AuthService.refreshCurrentSessionUser();
        } else {
          await AuthService.init();
        }
      } catch (error) {
        console.warn('refreshAuthenticatedContextFromServer user refresh fallback:', error?.message || error);
      }

      try {
        await loadSharedAdminSettings();
      } catch (error) {
        console.warn('refreshAuthenticatedContextFromServer admin settings fallback:', error?.message || error);
      }

      const safeUsername = String(AuthService.getCurrentUser()?.username || currentUser.username || '').trim().toLowerCase();
      if (safeUsername && allowWorkspaceReload) {
        try {
          await loadSharedUserState(safeUsername);
        } catch (error) {
          console.warn('refreshAuthenticatedContextFromServer user state fallback:', error?.message || error);
        }
      }

      scopeChanged = buildManagedAccessSignature(AuthService.getCurrentUser()) !== beforeSignature;
      settingsChanged = beforeSettingsRevision !== Number(AppState.adminSettingsCache?._meta?.revision || 0);
      stateChanged = beforeStateRevision !== Number(AppState.userStateCache?._meta?.revision || 0);

      if (allowWorkspaceReload) {
        activateAuthenticatedState();
      } else {
        updateAuthSessionState({ currentUser: AuthService.getCurrentUser() });
        renderAppBar();
      }

      if (scopeChanged && !allowWorkspaceReload) {
        UI.toast('Your admin-managed access changed on the server. Save your current work and refresh the page to apply the new scope.', 'warning', 6000);
      } else if (scopeChanged) {
        UI.toast('Your admin-managed access changed. The workspace has been refreshed from the server.', 'info', 5000);
      }

      if (shouldRerender && (scopeChanged || settingsChanged || stateChanged)) {
        Router.render?.();
      }

      return scopeChanged || settingsChanged || stateChanged;
    } finally {
      _lastServerContextRefreshAt = Date.now();
      _serverContextRefreshInFlight = null;
    }
  })();

  return _serverContextRefreshInFlight;
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
    const changedSlices = listWorkspacePatchSlices(pendingPatch);
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
        AppCrossTabSync.broadcastUserStateChanged({
          username: safeUsername,
          revision: Number(data?.state?._meta?.revision || 0),
          updatedAt: Number(data?.state?._meta?.updatedAt || Date.now()),
          changedSlices
        });
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

let _workspaceStorageSyncBound = false;

function bindWorkspaceStorageSync() {
  if (_workspaceStorageSyncBound || typeof window === 'undefined') return;
  _workspaceStorageSyncBound = true;
  window.addEventListener('storage', (event) => {
    const safeUsername = String(AuthService.getCurrentUser()?.username || AppState.userStateCache.username || '').trim().toLowerCase();
    const key = String(event?.key || '').trim();
    if (!key) return;

    if (key === GLOBAL_ADMIN_STORAGE_KEY) {
      try {
        const nextSettings = event.newValue ? JSON.parse(event.newValue) : null;
        if (nextSettings && typeof nextSettings === 'object') {
          applySharedSettingsLocally(nextSettings);
        } else {
          clearAdminSettingsState();
        }
      } catch {
        clearAdminSettingsState();
      }
      if (!/^#\/wizard\//.test(String(window.location.hash || ''))) Router.render?.();
      return;
    }

    if (!safeUsername) return;

    const nextCache = { ...(AppState.userStateCache || {}) };
    let changed = false;
    if (key === buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX, safeUsername)) {
      nextCache.userSettings = null;
      changed = true;
    }
    if (key === buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX, safeUsername)) {
      nextCache.assessments = null;
      nextCache.savedAssessments = null;
      changed = true;
    }
    if (key === buildUserStorageKey(LEARNING_STORAGE_PREFIX, safeUsername)) {
      nextCache.learningStore = null;
      changed = true;
    }
    if (key === buildUserStorageKey(DRAFT_RECOVERY_STORAGE_PREFIX, safeUsername) && !AppState.draftDirty) {
      nextCache.draft = null;
      nextCache.draftWorkspace = null;
      changed = true;
    }
    if (!changed) return;
    updateUserStateCache(nextCache);
    if (!/^#\/wizard\//.test(String(window.location.hash || ''))) {
      Router.render?.();
    }
  });
}

function bindServerContextRefresh() {
  if (_serverContextRefreshBound || typeof window === 'undefined') return;
  _serverContextRefreshBound = true;
  window.addEventListener('focus', () => {
    refreshAuthenticatedContextFromServer({ rerender: true }).catch(error => console.warn('server context refresh on focus failed:', error?.message || error));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    refreshAuthenticatedContextFromServer({ rerender: true }).catch(error => console.warn('server context refresh on visibility failed:', error?.message || error));
  });
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
  'Strategic risk',
  'Operational risk',
  'Cyber risk',
  'AI and model risk',
  'Technology resilience',
  'Data governance and privacy',
  'Financial risk',
  'Fraud and integrity',
  'Procurement and sourcing',
  'Supply chain resilience',
  'Business continuity',
  'Regulatory compliance',
  'Compliance assurance',
  'Legal and contract risk',
  'Geopolitical and market access',
  'Governance and controls',
  'ESG and sustainability',
  'Health, safety, and environment',
  'Physical security and facilities',
  'OT and site resilience',
  'People and workforce risk',
  'Investment and JV risk',
  'Transformation delivery',
  'Operational continuity',
  'Third-party risk',
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

async function clearUserPersistentState(username) {
  const safeUsername = String(username || '').trim().toLowerCase();
  if (!safeUsername) return null;
  try {
    localStorage.removeItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX, safeUsername));
    localStorage.removeItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX, safeUsername));
    localStorage.removeItem(buildUserStorageKey(LEARNING_STORAGE_PREFIX, safeUsername));
    localStorage.removeItem(buildUserStorageKey(DRAFT_RECOVERY_STORAGE_PREFIX, safeUsername));
    sessionStorage.removeItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX, safeUsername));
    sessionStorage.removeItem(buildUserStorageKey(SESSION_LLM_STORAGE_PREFIX, safeUsername));
    sessionStorage.removeItem(buildUserStorageKey(SESSION_LLM_HEALTH_STORAGE_PREFIX, safeUsername));
    sessionStorage.removeItem(buildUserStorageKey(SESSION_PILOT_AI_WARNING_STORAGE_PREFIX, safeUsername));
  } catch {}
  let expectedMeta = buildExpectedMeta(AppState.userStateCache.username === safeUsername ? AppState.userStateCache._meta : {});
  if (AppState.userStateCache.username !== safeUsername) {
    const currentState = await requestUserState('GET', safeUsername);
    expectedMeta = buildExpectedMeta(currentState?.state?._meta);
  }
  const result = await requestUserState('PUT', safeUsername, {
    state: {
      userSettings: null,
      assessments: [],
      learningStore: {
        ...buildDefaultLearningStoreState()
      },
      draft: null
    },
    expectedMeta
  }, { category: 'user_admin', eventType: 'user_state_reset', target: safeUsername });
  if (AppState.userStateCache.username === safeUsername) {
    applyUserStateSnapshotLocally(safeUsername, result?.state || {});
  }
  AppCrossTabSync.broadcastUserStateChanged({
    username: safeUsername,
    revision: Number(result?.state?._meta?.revision || 0),
    updatedAt: Number(result?.state?._meta?.updatedAt || Date.now()),
    changedSlices: ['userSettings', 'learningStore', 'draftWorkspace', 'savedAssessments']
  });
  return result?.state || null;
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

function mergeTypicalDepartmentList(list = []) {
  const saved = Array.isArray(list) ? list.map(name => String(name || '').trim()).filter(Boolean) : [];
  const seen = new Set(saved.map(name => name.toLowerCase()));
  const merged = [...saved];
  DEFAULT_TYPICAL_DEPARTMENTS.forEach(name => {
    const key = String(name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(name);
  });
  return merged;
}

function getTypicalDepartments(settings = getAdminSettings()) {
  if (Array.isArray(settings.typicalDepartments) && settings.typicalDepartments.length) {
    return mergeTypicalDepartmentList(settings.typicalDepartments);
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
  if (isLocalDevAiRuntimeConfigAllowed() && (sessionLLM.apiUrl || sessionLLM.apiKey || sessionLLM.model)) {
    LLMService.setCompassConfig(sessionLLM);
  } else {
    LLMService.clearCompassConfig();
  }

  if (String(AppState.currentUser.role || '').trim().toLowerCase() === 'admin'
    && typeof LLMService.fetchServerAiStatus === 'function') {
    LLMService.fetchServerAiStatus({ force: false, probe: true }).catch(() => null);
  }

  renderAppBar();
  maybeWarnPilotAiExpectation();
}

function ensureDraftShape() {
  const draftStartedAt = Number(AppState.draft.startedAt || AppState.draft.createdAt || Date.now());
  const structuredScenario = normaliseStructuredScenario(AppState.draft.structuredScenario, { preserveUnknown: true });
  const obligationBasisSource = AppState.draft.obligationBasis && typeof AppState.draft.obligationBasis === 'object'
    ? AppState.draft.obligationBasis
    : (AppState.draft.resolvedObligationContext && typeof AppState.draft.resolvedObligationContext === 'object'
        ? {
            ...AppState.draft.resolvedObligationContext,
            allResolved: Array.isArray(AppState.draft.resolvedObligations) ? AppState.draft.resolvedObligations : AppState.draft.resolvedObligationContext.allResolved,
            summary: AppState.draft.resolvedObligationSummary || AppState.draft.resolvedObligationContext.summary || ''
          }
        : null);
  AppState.draft = {
    id: AppState.draft.id || 'a_' + Date.now(),
    startedAt: draftStartedAt,
    createdAt: Number(AppState.draft.createdAt || draftStartedAt),
    templateId: AppState.draft.templateId || null,
    buId: AppState.draft.buId || null,
    buName: AppState.draft.buName || null,
    contextNotes: AppState.draft.contextNotes || '',
    narrative: AppState.draft.narrative || '',
    structuredScenario,
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
    scenarioMemoryQuery: AppState.draft.scenarioMemoryQuery || '',
    scenarioMemorySignature: AppState.draft.scenarioMemorySignature || '',
    scenarioMemoryMatches: Array.isArray(AppState.draft.scenarioMemoryMatches) ? AppState.draft.scenarioMemoryMatches : [],
    scenarioMemoryPrecedent: AppState.draft.scenarioMemoryPrecedent || '',
    scenarioMemoryPrecedentSignature: AppState.draft.scenarioMemoryPrecedentSignature || '',
    scenarioMemoryPrecedentLoading: !!AppState.draft.scenarioMemoryPrecedentLoading,
    scenarioMemoryReferenceId: AppState.draft.scenarioMemoryReferenceId || '',
    scenarioMemoryComparisons: AppState.draft.scenarioMemoryComparisons && typeof AppState.draft.scenarioMemoryComparisons === 'object' ? AppState.draft.scenarioMemoryComparisons : {},
    scenarioMemoryComparisonLoadingId: AppState.draft.scenarioMemoryComparisonLoadingId || '',
    aiNarrativeBaseline: AppState.draft.aiNarrativeBaseline || '',
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
    aiFeedback: AppState.draft.aiFeedback && typeof AppState.draft.aiFeedback === 'object'
      ? AppState.draft.aiFeedback
      : {},
    confidenceLabel: AppState.draft.confidenceLabel || '',
    evidenceQuality: AppState.draft.evidenceQuality || '',
    evidenceSummary: AppState.draft.evidenceSummary || '',
    primaryGrounding: Array.isArray(AppState.draft.primaryGrounding) ? AppState.draft.primaryGrounding : [],
    supportingReferences: Array.isArray(AppState.draft.supportingReferences) ? AppState.draft.supportingReferences : [],
    inferredAssumptions: Array.isArray(AppState.draft.inferredAssumptions) ? AppState.draft.inferredAssumptions : [],
    missingInformation: Array.isArray(AppState.draft.missingInformation) ? AppState.draft.missingInformation : [],
    aiAlignment: AppState.draft.aiAlignment && typeof AppState.draft.aiAlignment === 'object' ? AppState.draft.aiAlignment : null,
    obligationBasis: obligationBasisSource ? buildResolvedObligationSnapshot({
      context: obligationBasisSource,
      capturedAt: Number(obligationBasisSource.capturedAt || 0)
    }) : null,
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

let adminSettingsSaveQueue = Promise.resolve(false);

async function saveAdminSettings(settings, options = {}) {
  const runSave = async () => {
    const expectedRenderToken = Number(options.renderToken || 0);
    const isStaleRenderContext = () => expectedRenderToken > 0 && expectedRenderToken !== activeAdminSettingsRenderToken;
    if (isStaleRenderContext()) return false;
    const merged = normaliseAdminSettings(settings);
    const requestedSnapshot = buildComparableAdminSettingsSnapshot(merged);
    const currentSettings = getAdminSettings();
    if (buildComparableAdminSettingsSnapshot(currentSettings) === requestedSnapshot) return true;
    if (AuthService.getAdminApiSecret() || AuthService.getApiSessionToken()) {
      try {
        const result = await syncSharedAdminSettings({
          ...merged,
          _meta: buildExpectedMeta(currentSettings._meta)
        }, options.audit || null);
        if (isStaleRenderContext()) return false;
        if (result?.settings) {
          applySharedSettingsLocally(result.settings);
        }
      } catch (error) {
        if (isStaleRenderContext()) return false;
        const latestSnapshot = error?.latestSettings
          ? buildComparableAdminSettingsSnapshot(error.latestSettings)
          : '';
        if (error?.code === 'WRITE_CONFLICT' && latestSnapshot && latestSnapshot === requestedSnapshot) {
          applySharedSettingsLocally(error.latestSettings);
          return true;
        }
        if (error?.code === 'WRITE_CONFLICT') {
          showPersistenceConflictDialog({
            message: 'These platform settings were updated in another session before this save finished.',
            onReloadLatest: async () => {
              if (expectedRenderToken > 0) activeAdminSettingsRenderToken += 1;
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
    } else {
      applySharedSettingsLocally(merged);
    }
    AppCrossTabSync.broadcastSettingsChanged({
      revision: Number(getAdminSettings()._meta?.revision || 0),
      updatedAt: Number(getAdminSettings()._meta?.updatedAt || Date.now())
    });
    return true;
  };

  adminSettingsSaveQueue = Promise.resolve(adminSettingsSaveQueue)
    .catch(() => false)
    .then(runSave);
  return adminSettingsSaveQueue;
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
  const inheritedSettings = applyBUOverrideToSettings(
    applyEntityLayerToSettings(
      applyEntityLayerToSettings(globalSettings, companyLayer, companyNode),
      departmentLayer,
      departmentNode
    ),
    buOverride
  );
  return applyResolvedObligationContextToSettings(inheritedSettings, resolveScopedObligationContext({
    settings: globalSettings,
    businessUnitEntityId: scopedBusinessUnitEntityId,
    departmentEntityId: scopedDepartmentEntityId,
    geography: inheritedSettings.geography || globalSettings.geography
  }));
}

function buildResolvedUserSettings(saved = {}, defaults = getUserSettingsDefaults(), globalSettings = getAdminSettings()) {
  const reconciledProfile = typeof reconcileUserProfileToManagedScope === 'function'
    ? reconcileUserProfileToManagedScope(saved.userProfile || defaults.userProfile, AuthService.getCurrentUser(), globalSettings)
    : normaliseUserProfile(saved.userProfile || defaults.userProfile);
  const resolved = {
    ...defaults,
    ...saved,
    ...normaliseUserGeographies(saved, globalSettings),
    applicableRegulations: Array.isArray(saved.applicableRegulations) ? saved.applicableRegulations : [...defaults.applicableRegulations],
    userProfile: reconciledProfile,
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
  const reconciledProfile = typeof reconcileUserProfileToManagedScope === 'function'
    ? reconcileUserProfileToManagedScope(settings.userProfile || defaults.userProfile, AuthService.getCurrentUser(), globalSettings)
    : normaliseUserProfile(settings.userProfile || defaults.userProfile);
  const merged = {
    ...defaults,
    ...settings,
    ...normaliseUserGeographies(settings, globalSettings),
    applicableRegulations: Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations : [...defaults.applicableRegulations],
    userProfile: reconciledProfile,
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

function launchGuidedAssessmentStart() {
  resetDraft();
  const settings = getEffectiveSettings();
  const buList = getBUList();
  if (typeof ensureStep1ContextPrefills === 'function') {
    ensureStep1ContextPrefills(AppState.draft, settings, buList);
  }
  saveDraft();
  openDraftWorkspaceRoute();
  OrgIntelligenceService?.refresh?.().catch?.(() => {});
  return null;
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
    const fallbackTemplate = typeof pickScenarioTemplateForContext === 'function'
      ? pickScenarioTemplateForContext({ functionKey: experienceModel?.functionKey || 'general' })
      : (Array.isArray(ScenarioTemplates) ? ScenarioTemplates[0] : null);
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
  const resolvedObligationContext = resolveScopedObligationContext({
    settings: globalSettings,
    businessUnitEntityId: scopedBusinessUnitEntityId,
    departmentEntityId: selection.departmentEntityId,
    geography: organisationScopedDefaults.geography || globalSettings.geography,
    scenarioLens: AppState.draft?.scenarioLens || ''
  });
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
  return applyResolvedObligationContextToSettings(merged, resolvedObligationContext);
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
  const inheritedBase = applyBUOverrideToSettings(
    applyEntityLayerToSettings(
      applyEntityLayerToSettings(globalSettings, businessLayer, businessNode),
      departmentLayer,
      departmentNode
    ),
    buOverride
  );
  const obligationContext = resolveScopedObligationContext({
    settings: globalSettings,
    businessUnitEntityId: scopedBusinessUnitEntityId,
    departmentEntityId: scopedDepartmentEntityId,
    geography: effective.geography || inheritedBase.geography || globalSettings.geography,
    scenarioLens: options.scenarioLens || AppState.draft?.scenarioLens || ''
  });
  const inherited = applyResolvedObligationContextToSettings(inheritedBase, obligationContext);
  const userProfile = typeof reconcileUserProfileToManagedScope === 'function'
    ? reconcileUserProfileToManagedScope(userSettings.userProfile, user, globalSettings)
    : normaliseUserProfile(userSettings.userProfile, user);
  const userProfileSummary = buildUserProfileSummary(userProfile);
  const businessUnitContext = String(businessLayer?.contextSummary || buOverride?.contextSummary || businessNode?.profile || '').trim();
  const departmentContext = String(departmentLayer?.contextSummary || departmentNode?.profile || '').trim();
  const inheritedContextSummary = String(inherited.adminContextSummary || '').trim();
  const personalContextSummary = String(userSettings.adminContextSummary || effective.adminContextSummary || '').trim();
  const combinedContextSummary = joinDistinctText([
    businessUnitContext ? `Business unit context: ${businessUnitContext}` : '',
    departmentContext ? `Function context: ${departmentContext}` : '',
    obligationContext.summary ? `Resolved obligations:\n${obligationContext.summary}` : '',
    inheritedContextSummary ? `Inherited organisation context: ${inheritedContextSummary}` : '',
    personalContextSummary ? `User context: ${personalContextSummary}` : ''
  ]);
  const companyStructureContext = buildOrganisationContextSummary(globalSettings);
  const adminSettings = applyResolvedObligationContextToSettings({
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
    resolvedObligationSummary: obligationContext.summary,
    companyStructureContext,
    userProfileSummary,
    selectedBusinessEntity: businessNode,
    selectedDepartmentEntity: departmentNode
  }, obligationContext);
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
      selectedDepartmentContext: departmentContext,
      resolvedObligationSummary: obligationContext.summary,
      resolvedObligationContext: obligationContext,
      resolvedObligations: Array.isArray(obligationContext?.allResolved) ? obligationContext.allResolved : []
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

function buildAssessmentRetrievalQuery(options = {}) {
  const guidedInput = options.guidedInput && typeof options.guidedInput === 'object'
    ? options.guidedInput
    : (AppState.draft?.guidedInput || {});
  const structuredScenario = normaliseStructuredScenario(options.structuredScenario || AppState.draft?.structuredScenario, {
    preserveUnknown: true
  });
  const selectedRiskTitles = Array.isArray(options.selectedRiskTitles)
    ? options.selectedRiskTitles.map(item => String(item || '').trim()).filter(Boolean)
    : (typeof getSelectedRisks === 'function'
        ? getSelectedRisks().map(risk => String(risk?.title || '').trim()).filter(Boolean)
        : []);
  const applicableRegulations = Array.isArray(options.applicableRegulations)
    ? options.applicableRegulations.map(item => String(item || '').trim()).filter(Boolean)
    : (Array.isArray(AppState.draft?.applicableRegulations) ? AppState.draft.applicableRegulations : []);
  const geography = String(options.geography || AppState.draft?.geography || '').trim();
  const businessUnitName = String(options.businessUnitName || AppState.draft?.buName || '').trim();
  const parts = [
    String(options.text || options.narrative || options.riskStatement || '').trim(),
    String(guidedInput.event || '').trim(),
    String(guidedInput.asset || '').trim(),
    String(guidedInput.cause || '').trim(),
    String(guidedInput.impact || '').trim(),
    String(getStructuredScenarioField(structuredScenario, 'assetService') || '').trim(),
    String(getStructuredScenarioField(structuredScenario, 'primaryDriver') || '').trim(),
    String(getStructuredScenarioField(structuredScenario, 'eventPath') || '').trim(),
    String(getStructuredScenarioField(structuredScenario, 'effect') || '').trim(),
    options.treatmentRequest ? `Better outcome request: ${String(options.treatmentRequest).trim()}` : '',
    selectedRiskTitles.length ? `Selected risks: ${selectedRiskTitles.join(', ')}` : '',
    geography ? `Geography: ${geography}` : '',
    applicableRegulations.length ? `Applicable regulations: ${applicableRegulations.join(', ')}` : '',
    businessUnitName ? `Business unit: ${businessUnitName}` : ''
  ].filter(Boolean);
  return {
    text: parts.join('\n'),
    scenarioLens: options.scenarioLens || AppState.draft?.scenarioLens || null,
    guidedInput: { ...guidedInput },
    structuredScenario,
    selectedRiskTitles,
    geography,
    applicableRegulations,
    businessUnitName,
    treatmentRequest: String(options.treatmentRequest || '').trim()
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
                    <div class="org-related-card__title">${escapeHtml(String(node.name || 'Unnamed department'))}</div>
                    <div class="form-help">${escapeHtml(String(node.departmentRelationshipType || 'In-house'))} · ${escapeHtml(String(ownerLabel || 'No owner'))} · ${contextSummary ? 'Saved context' : 'No saved context'}</div>
                  </div>
                  <div class="flex items-center gap-3" style="flex-wrap:wrap">
                    <button class="btn btn--ghost btn--sm org-entity-context" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Context</button>
                    <button class="btn btn--ghost btn--sm org-entity-obligations" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Obligations</button>
                    <button class="btn btn--ghost btn--sm org-entity-edit" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Edit</button>
                    <button class="btn btn--ghost btn--sm org-entity-delete" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Remove</button>
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
              <span class="badge badge--gold">${escapeHtml(String(node.type || 'Entity'))}</span>
              <strong>${escapeHtml(String(node.name || 'Unnamed entity'))}</strong>
            </div>
            <div class="org-accordion__meta">
              <span class="form-help">${getEntityLayerById(settings, node.id)?.contextSummary ? 'Saved context' : 'No saved context'}</span>
              <button class="btn btn--secondary btn--sm org-entity-add-department org-summary-action" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Add Function</button>
              <button class="btn btn--ghost btn--sm org-entity-context org-summary-action" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Context</button>
              <button class="btn btn--ghost btn--sm org-entity-obligations org-summary-action" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Obligations</button>
              <button class="btn btn--ghost btn--sm org-entity-edit org-summary-action" data-org-id="${escapeHtml(String(node.id || ''))}" type="button">Edit</button>
            </div>
          </summary>
          <div class="org-accordion__body">
            <div class="org-accordion__toolbar">
              <div class="form-help">${escapeHtml(String(getEntityLineageLabel(structure, node.id) || node.name || 'Unnamed entity'))}</div>
            </div>
            <div class="org-accordion__snapshot">${escapeHtml(String(contextSummary || ''))}</div>
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

function getEntityObligationsBySource(settings = getAdminSettings(), entityId = '') {
  const safeEntityId = String(entityId || '').trim();
  if (!safeEntityId) return [];
  return (Array.isArray(settings?.entityObligations) ? settings.entityObligations : [])
    .filter(item => String(item?.sourceEntityId || '').trim() === safeEntityId)
    .map(item => cloneSerializableState(item, item));
}

function getDescendantEntities(structure = getAdminSettings().companyStructure || [], entityId = '', { includeSelf = false } = {}) {
  const safeEntityId = String(entityId || '').trim();
  const list = Array.isArray(structure) ? structure : [];
  if (!safeEntityId) return [];
  const byParent = new Map();
  list.forEach(node => {
    const key = String(node?.parentId || '').trim();
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  });
  const queue = includeSelf ? [safeEntityId] : (byParent.get(safeEntityId) || []).map(node => String(node?.id || '').trim()).filter(Boolean);
  const descendants = [];
  const seen = new Set();
  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || seen.has(currentId)) continue;
    seen.add(currentId);
    const currentNode = getEntityById(list, currentId);
    if (!currentNode) continue;
    descendants.push(currentNode);
    (byParent.get(currentId) || []).forEach(child => {
      const childId = String(child?.id || '').trim();
      if (childId && !seen.has(childId)) queue.push(childId);
    });
  }
  return descendants;
}

function createModalScopedId(prefix = 'modal-scope') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildEntityObligationFlowdownPreview({ entity, obligation, settings = getAdminSettings() }) {
  const resolver = getObligationResolutionApi();
  const structure = Array.isArray(settings?.companyStructure) ? settings.companyStructure : [];
  const preview = {
    ready: !!entity?.id,
    directApplies: !!entity?.id,
    flowDownMode: String(obligation?.flowDownMode || 'none').trim().toLowerCase() || 'none',
    isActive: obligation?.active !== false,
    needsPartialFilter: false,
    companyMatches: [],
    departmentMatches: [],
    remainingCompanyCount: 0,
    remainingDepartmentCount: 0
  };
  if (!entity?.id || !resolver?.normaliseEntityObligation || !resolver?.resolveObligationContext) {
    return preview;
  }
  const normalised = resolver.normaliseEntityObligation({
    ...cloneSerializableState(obligation, obligation || {}),
    sourceEntityId: entity.id
  });
  preview.flowDownMode = normalised.flowDownMode;
  preview.isActive = normalised.active !== false;
  const hasPartialFilter = !!(
    normalised.flowDownTargets.entityTypes.length ||
    normalised.flowDownTargets.includeEntityIds.length ||
    normalised.flowDownTargets.excludeEntityIds.length ||
    normalised.flowDownTargets.departmentIds.length ||
    normalised.flowDownTargets.departmentNames.length ||
    normalised.flowDownTargets.geographies.length ||
    normalised.flowDownTargets.scenarioLenses.length
  );
  preview.needsPartialFilter = normalised.flowDownMode === 'partial' && !hasPartialFilter;
  if (!normalised.title || normalised.active === false || normalised.flowDownMode === 'none' || preview.needsPartialFilter) {
    return preview;
  }

  const descendants = getDescendantEntities(structure, entity.id);
  const descendantCompanies = descendants.filter(node => isCompanyEntityType(node.type));
  const descendantDepartments = descendants.filter(node => isDepartmentEntityType(node.type));
  const previewSettings = {
    ...settings,
    entityObligations: [normalised]
  };

  descendantCompanies.forEach(company => {
    const geography = getEntityLayerById(settings, company.id)?.geography || settings.geography || '';
    const resolved = resolver.resolveObligationContext({
      settings: previewSettings,
      businessUnitEntityId: company.id,
      geography
    });
    if (resolved.allResolved.some(item => item.sourceObligationId === normalised.id)) {
      preview.companyMatches.push({
        id: company.id,
        name: company.name,
        type: company.type
      });
    }
  });

  descendantDepartments.forEach(department => {
    const businessEntity = getCompanyEntityForDepartment(structure, department.id);
    const geography = getEntityLayerById(settings, department.id)?.geography
      || getEntityLayerById(settings, businessEntity?.id || '')?.geography
      || settings.geography
      || '';
    const resolved = resolver.resolveObligationContext({
      settings: previewSettings,
      businessUnitEntityId: businessEntity?.id || entity.id,
      departmentEntityId: department.id,
      geography
    });
    if (resolved.allResolved.some(item => item.sourceObligationId === normalised.id)) {
      preview.departmentMatches.push({
        id: department.id,
        name: department.name,
        parentName: businessEntity?.name || '',
        relationshipType: department.departmentRelationshipType || ''
      });
    }
  });

  preview.remainingCompanyCount = Math.max(0, preview.companyMatches.length - 4);
  preview.remainingDepartmentCount = Math.max(0, preview.departmentMatches.length - 4);
  preview.companyMatches = preview.companyMatches.slice(0, 4);
  preview.departmentMatches = preview.departmentMatches.slice(0, 4);
  return preview;
}

function renderEntityObligationPreview(preview = {}) {
  if (!preview?.ready) {
    return '<div class="form-help">Select an organisation node first.</div>';
  }
  if (preview.isActive === false) {
    return '<div class="form-help">This obligation is currently inactive, so it will not apply or flow down until you reactivate it.</div>';
  }
  if (preview.flowDownMode === 'none') {
    return '<div class="form-help">This obligation will stay attached only to the source entity or function.</div>';
  }
  if (preview.needsPartialFilter) {
    return '<div class="form-help">Partial flow-down needs at least one target filter before child entities or functions will inherit it.</div>';
  }
  const companyItems = Array.isArray(preview.companyMatches) ? preview.companyMatches : [];
  const departmentItems = Array.isArray(preview.departmentMatches) ? preview.departmentMatches : [];
  const companyMarkup = companyItems.length
    ? `<div class="citation-chips" style="margin-top:8px">${companyItems.map(item => `<span class="badge badge--neutral">${escapeHtml(String(item.name || 'Unnamed entity'))}</span>`).join('')}</div>`
    : '<div class="form-help" style="margin-top:8px">No child businesses currently match.</div>';
  const departmentMarkup = departmentItems.length
    ? `<div class="citation-chips" style="margin-top:8px">${departmentItems.map(item => `<span class="badge badge--neutral">${escapeHtml(String(item.name || 'Unnamed function'))}</span>`).join('')}</div>`
    : '<div class="form-help" style="margin-top:8px">No child functions currently match.</div>';
  return `
    <div class="card" style="padding:var(--sp-3);background:var(--bg-elevated)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="badge badge--gold">${escapeHtml(preview.flowDownMode === 'full' ? 'Full flow-down' : 'Partial flow-down')}</span>
        <span class="form-help" style="margin-top:0">Direct source still applies at the node where this obligation originates.</span>
      </div>
      <div class="context-grid" style="margin-top:12px">
        <div class="context-chip-panel">
          <div class="context-panel-title">Child businesses</div>
          <p class="context-panel-copy">${companyItems.length + Number(preview.remainingCompanyCount || 0)} current match${companyItems.length + Number(preview.remainingCompanyCount || 0) === 1 ? '' : 'es'}.</p>
          ${companyMarkup}
          ${preview.remainingCompanyCount ? `<div class="form-help" style="margin-top:8px">+${preview.remainingCompanyCount} more child businesses.</div>` : ''}
        </div>
        <div class="context-chip-panel">
          <div class="context-panel-title">Child functions</div>
          <p class="context-panel-copy">${departmentItems.length + Number(preview.remainingDepartmentCount || 0)} current match${departmentItems.length + Number(preview.remainingDepartmentCount || 0) === 1 ? '' : 'es'}.</p>
          ${departmentMarkup}
          ${preview.remainingDepartmentCount ? `<div class="form-help" style="margin-top:8px">+${preview.remainingDepartmentCount} more child functions.</div>` : ''}
        </div>
      </div>
    </div>`;
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
  const resolver = getObligationResolutionApi();
  const obligationText = resolver?.buildEntityObligationCatalogSummary
    ? resolver.buildEntityObligationCatalogSummary(settings.entityObligations || [], settings.companyStructure || [])
    : '';
  return [
    structureText,
    layerText ? `Entity context layers:\n${layerText}` : '',
    obligationText ? `Entity obligations:\n${obligationText}` : ''
  ].filter(Boolean).join('\n');
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

function openEntityObligationEditor({ entity, settings = getAdminSettings(), existingObligation = null, onSave }) {
  if (!entity?.id) return null;
  const resolver = getObligationResolutionApi();
  const structure = Array.isArray(settings?.companyStructure) ? settings.companyStructure : [];
  const descendants = getDescendantEntities(structure, entity.id);
  const descendantCompanies = descendants.filter(node => isCompanyEntityType(node.type));
  const descendantDepartments = descendants.filter(node => isDepartmentEntityType(node.type));
  const defaultObligation = {
    sourceEntityId: entity.id,
    title: '',
    familyKey: '',
    type: 'regulatory',
    requirementLevel: 'mandatory',
    text: '',
    regulationTags: [],
    sourceDocIds: [],
    active: true,
    visibleToChildUsers: true,
    flowDownMode: 'none',
    flowDownTargets: {
      entityTypes: [],
      includeEntityIds: [],
      excludeEntityIds: [],
      departmentIds: [],
      departmentNames: [],
      geographies: [],
      scenarioLenses: []
    },
    inheritedView: {
      childRequirementLevel: 'mandatory',
      childText: ''
    },
    review: {
      owner: '',
      lastReviewedAt: 0
    }
  };
  const baseObligation = resolver?.normaliseEntityObligation
    ? resolver.normaliseEntityObligation({
        ...defaultObligation,
        ...cloneSerializableState(existingObligation, existingObligation || {})
      })
    : { ...defaultObligation, ...cloneSerializableState(existingObligation, existingObligation || {}) };
  const modalKey = createModalScopedId('entity-obligation');
  const titleId = `${modalKey}-title`;
  const familyId = `${modalKey}-family`;
  const typeId = `${modalKey}-type`;
  const levelId = `${modalKey}-level`;
  const activeId = `${modalKey}-active`;
  const visibleId = `${modalKey}-visible`;
  const textId = `${modalKey}-text`;
  const flowDownId = `${modalKey}-flow-down`;
  const inheritedLevelId = `${modalKey}-child-level`;
  const inheritedTextId = `${modalKey}-child-text`;
  const ownerId = `${modalKey}-owner`;
  const entityTypesWrapId = `${modalKey}-entity-types`;
  const includeWrapId = `${modalKey}-include-entities`;
  const excludeWrapId = `${modalKey}-exclude-entities`;
  const departmentsWrapId = `${modalKey}-departments`;
  const partialWrapId = `${modalKey}-partial-wrap`;
  const regulationTagsId = `${modalKey}-reg-tags`;
  const sourceDocsId = `${modalKey}-source-docs`;
  const geographiesId = `${modalKey}-geographies`;
  const scenarioLensesId = `${modalKey}-scenario-lenses`;
  const previewId = `${modalKey}-preview`;
  const heading = existingObligation?.id ? `Edit Obligation: ${entity.name}` : `Add Obligation: ${entity.name}`;
  const companyTypes = Array.from(new Set(
    descendantCompanies.length
      ? descendantCompanies.map(node => String(node.type || '').trim()).filter(Boolean)
      : ORG_ENTITY_TYPES.filter(type => !isDepartmentEntityType(type))
  ));
  const renderCheckboxGroup = (name, options = [], selected = [], labelBuilder = null) => {
    const selectedSet = new Set((Array.isArray(selected) ? selected : []).map(value => String(value || '').trim()));
    if (!options.length) return '<div class="form-help">No child nodes available yet.</div>';
    return `<div style="display:flex;flex-direction:column;gap:8px">${options.map(option => {
      const value = String(option.value || '').trim();
      const label = typeof labelBuilder === 'function' ? labelBuilder(option) : option.label;
      return `<label class="form-checkbox">
        <input type="checkbox" name="${name}" value="${escapeHtml(value)}" ${selectedSet.has(value) ? 'checked' : ''}>
        <span>${escapeHtml(String(label || value || 'Unnamed option'))}</span>
      </label>`;
    }).join('')}</div>`;
  };

  const modal = UI.modal({
    title: heading,
    body: `
      <div class="form-help" style="margin-bottom:12px">Attach the obligation where it originates, then decide whether it stays direct, flows fully, or flows partially to child businesses and functions.</div>
      <div class="grid-2" style="gap:12px">
        <div class="form-group">
          <label class="form-label" for="${titleId}">Obligation Title</label>
          <input class="form-input" id="${titleId}" value="${escapeHtml(String(baseObligation.title || ''))}" placeholder="Example: Group export controls obligation">
        </div>
        <div class="form-group">
          <label class="form-label" for="${familyId}">Family Key</label>
          <input class="form-input" id="${familyId}" value="${escapeHtml(String(baseObligation.familyKey || ''))}" placeholder="Optional stable key for parent/child overrides">
        </div>
      </div>
      <div class="grid-2 mt-4" style="gap:12px">
        <div class="form-group">
          <label class="form-label" for="${typeId}">Obligation Type</label>
          <select class="form-select" id="${typeId}">
            ${['regulatory', 'policy', 'contractual', 'governance', 'operational'].map(type => `<option value="${type}" ${baseObligation.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="${levelId}">Requirement Level</label>
          <select class="form-select" id="${levelId}">
            ${['mandatory', 'conditional', 'guidance'].map(level => `<option value="${level}" ${baseObligation.requirementLevel === level ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="${textId}">Obligation Text</label>
        <textarea class="form-textarea" id="${textId}" rows="4" placeholder="Describe what the source entity must do, monitor, or evidence.">${escapeHtml(String(baseObligation.text || ''))}</textarea>
      </div>
      <div class="grid-2 mt-4" style="gap:12px">
        <div class="form-group">
          <label class="form-label">Regulation Tags</label>
          <div class="tag-input-wrap" id="${regulationTagsId}"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Source Document IDs</label>
          <div class="tag-input-wrap" id="${sourceDocsId}"></div>
        </div>
      </div>
      <div class="grid-2 mt-4" style="gap:12px">
        <label class="form-checkbox">
          <input type="checkbox" id="${activeId}" ${baseObligation.active !== false ? 'checked' : ''}>
          <span>Obligation is active</span>
        </label>
        <label class="form-checkbox">
          <input type="checkbox" id="${visibleId}" ${baseObligation.visibleToChildUsers !== false ? 'checked' : ''}>
          <span>Visible to child users when inherited</span>
        </label>
      </div>
      <div class="grid-2 mt-4" style="gap:12px">
        <div class="form-group">
          <label class="form-label" for="${flowDownId}">Flow-down Mode</label>
          <select class="form-select" id="${flowDownId}">
            <option value="none" ${baseObligation.flowDownMode === 'none' ? 'selected' : ''}>Direct only</option>
            <option value="full" ${baseObligation.flowDownMode === 'full' ? 'selected' : ''}>Full flow-down</option>
            <option value="partial" ${baseObligation.flowDownMode === 'partial' ? 'selected' : ''}>Partial flow-down</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="${ownerId}">Review Owner</label>
          <input class="form-input" id="${ownerId}" value="${escapeHtml(String(baseObligation.review?.owner || ''))}" placeholder="Example: group-compliance">
        </div>
      </div>
      <div id="${partialWrapId}" class="card mt-4" style="padding:var(--sp-4);background:var(--bg-elevated)">
        <div class="context-panel-title">Child Scope And Inherited View</div>
        <p class="context-panel-copy">Use these filters to control which subsidiaries or functions inherit this obligation and how it should read when it reaches them.</p>
        <div class="grid-2 mt-4" style="gap:12px">
          <div class="form-group">
            <label class="form-label" for="${inheritedLevelId}">Child Requirement Level</label>
            <select class="form-select" id="${inheritedLevelId}">
              ${['mandatory', 'conditional', 'guidance'].map(level => `<option value="${level}" ${baseObligation.inheritedView?.childRequirementLevel === level ? 'selected' : ''}>${escapeHtml(level)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Geographies</label>
            <div class="tag-input-wrap" id="${geographiesId}"></div>
          </div>
        </div>
        <div class="form-group mt-4">
          <label class="form-label" for="${inheritedTextId}">Inherited Child Text</label>
          <textarea class="form-textarea" id="${inheritedTextId}" rows="3" placeholder="Optional narrowed wording for subsidiaries or functions receiving this obligation.">${escapeHtml(String(baseObligation.inheritedView?.childText || ''))}</textarea>
        </div>
        <div class="form-group mt-4">
          <label class="form-label">Scenario Lenses</label>
          <div class="tag-input-wrap" id="${scenarioLensesId}"></div>
        </div>
        <div class="context-grid mt-4">
          <div class="context-chip-panel">
            <div class="context-panel-title">Entity Types</div>
            <div id="${entityTypesWrapId}" style="margin-top:10px">${renderCheckboxGroup(`${modalKey}-entity-type`, companyTypes.map(type => ({ value: String(type || '').toLowerCase(), label: type })), baseObligation.flowDownTargets?.entityTypes || [])}</div>
          </div>
          <div class="context-chip-panel">
            <div class="context-panel-title">Include Child Entities</div>
            <div id="${includeWrapId}" style="margin-top:10px">${renderCheckboxGroup(`${modalKey}-include-entity`, descendantCompanies.map(node => ({ value: node.id, label: getEntityLineageLabel(structure, node.id) || node.name })), baseObligation.flowDownTargets?.includeEntityIds || [])}</div>
          </div>
          <div class="context-chip-panel">
            <div class="context-panel-title">Exclude Child Entities</div>
            <div id="${excludeWrapId}" style="margin-top:10px">${renderCheckboxGroup(`${modalKey}-exclude-entity`, descendantCompanies.map(node => ({ value: node.id, label: getEntityLineageLabel(structure, node.id) || node.name })), baseObligation.flowDownTargets?.excludeEntityIds || [])}</div>
          </div>
          <div class="context-chip-panel">
            <div class="context-panel-title">Specific Functions</div>
            <div id="${departmentsWrapId}" style="margin-top:10px">${renderCheckboxGroup(`${modalKey}-department`, descendantDepartments.map(node => ({ value: node.id, label: getEntityLineageLabel(structure, node.id) || node.name })), baseObligation.flowDownTargets?.departmentIds || [])}</div>
          </div>
        </div>
      </div>
      <div class="mt-4">
        <div class="context-panel-title">Flow-Down Preview</div>
        <div id="${previewId}" style="margin-top:10px"></div>
      </div>`,
    footer: `<button class="btn btn--ghost" id="${modalKey}-cancel">Cancel</button><button class="btn btn--primary" id="${modalKey}-save">Save Obligation</button>`
  });

  const titleEl = document.getElementById(titleId);
  const familyEl = document.getElementById(familyId);
  const typeEl = document.getElementById(typeId);
  const levelEl = document.getElementById(levelId);
  const activeEl = document.getElementById(activeId);
  const visibleEl = document.getElementById(visibleId);
  const textEl = document.getElementById(textId);
  const flowDownEl = document.getElementById(flowDownId);
  const childLevelEl = document.getElementById(inheritedLevelId);
  const childTextEl = document.getElementById(inheritedTextId);
  const ownerEl = document.getElementById(ownerId);
  const partialWrapEl = document.getElementById(partialWrapId);
  const previewEl = document.getElementById(previewId);
  const regulationsInput = UI.tagInput(regulationTagsId, baseObligation.regulationTags || [], () => refreshPreview());
  const sourceDocsInput = UI.tagInput(sourceDocsId, baseObligation.sourceDocIds || [], () => refreshPreview());
  const geographiesInput = UI.tagInput(geographiesId, baseObligation.flowDownTargets?.geographies || [], () => refreshPreview());
  const scenarioLensesInput = UI.tagInput(scenarioLensesId, baseObligation.flowDownTargets?.scenarioLenses || [], () => refreshPreview());

  function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(input => String(input.value || '').trim()).filter(Boolean);
  }

  function collectDraft() {
    return {
      id: baseObligation.id,
      sourceEntityId: entity.id,
      title: titleEl?.value.trim() || '',
      familyKey: familyEl?.value.trim() || '',
      type: typeEl?.value || 'regulatory',
      requirementLevel: levelEl?.value || 'mandatory',
      text: textEl?.value.trim() || '',
      regulationTags: regulationsInput?.getTags ? regulationsInput.getTags() : [],
      sourceDocIds: sourceDocsInput?.getTags ? sourceDocsInput.getTags() : [],
      active: activeEl?.checked !== false,
      visibleToChildUsers: visibleEl?.checked !== false,
      flowDownMode: flowDownEl?.value || 'none',
      flowDownTargets: {
        entityTypes: getCheckedValues(`${modalKey}-entity-type`),
        includeEntityIds: getCheckedValues(`${modalKey}-include-entity`),
        excludeEntityIds: getCheckedValues(`${modalKey}-exclude-entity`),
        departmentIds: getCheckedValues(`${modalKey}-department`),
        departmentNames: [],
        geographies: geographiesInput?.getTags ? geographiesInput.getTags() : [],
        scenarioLenses: scenarioLensesInput?.getTags ? scenarioLensesInput.getTags() : []
      },
      inheritedView: {
        childRequirementLevel: childLevelEl?.value || levelEl?.value || 'mandatory',
        childText: childTextEl?.value.trim() || ''
      },
      review: {
        owner: ownerEl?.value.trim() || '',
        lastReviewedAt: Date.now()
      }
    };
  }

  function refreshPreview() {
    if (!partialWrapEl) return;
    const nonDirect = flowDownEl?.value !== 'none';
    partialWrapEl.style.display = nonDirect ? '' : 'none';
    previewEl.innerHTML = renderEntityObligationPreview(buildEntityObligationFlowdownPreview({
      entity,
      obligation: collectDraft(),
      settings
    }));
  }

  [
    titleEl,
    familyEl,
    typeEl,
    levelEl,
    activeEl,
    visibleEl,
    textEl,
    flowDownEl,
    childLevelEl,
    childTextEl,
    ownerEl
  ].forEach(element => {
    element?.addEventListener('input', refreshPreview);
    element?.addEventListener('change', refreshPreview);
  });
  document.querySelectorAll(`input[name="${modalKey}-entity-type"], input[name="${modalKey}-include-entity"], input[name="${modalKey}-exclude-entity"], input[name="${modalKey}-department"]`).forEach(input => {
    input.addEventListener('change', refreshPreview);
  });

  refreshPreview();

  document.getElementById(`${modalKey}-cancel`)?.addEventListener('click', () => modal.close());
  document.getElementById(`${modalKey}-save`)?.addEventListener('click', () => {
    const nextObligation = resolver?.normaliseEntityObligation
      ? resolver.normaliseEntityObligation(collectDraft())
      : collectDraft();
    if (!nextObligation.title) {
      UI.toast('Add an obligation title before saving.', 'warning');
      return;
    }
    onSave?.(nextObligation, modal);
  });
  return modal;
}

function openEntityObligationManager({ entity, settings = getAdminSettings(), onSaveAll }) {
  if (!entity?.id) return null;
  const resolver = getObligationResolutionApi();
  const modalKey = createModalScopedId('entity-obligation-manager');
  const bodyId = `${modalKey}-body`;
  const localItems = getEntityObligationsBySource(settings, entity.id);
  const otherItems = (Array.isArray(settings?.entityObligations) ? settings.entityObligations : [])
    .filter(item => String(item?.sourceEntityId || '').trim() !== String(entity.id || '').trim())
    .map(item => cloneSerializableState(item, item));

  function buildMergedObligations() {
    const merged = [...otherItems, ...localItems];
    return resolver?.normaliseEntityObligations ? resolver.normaliseEntityObligations(merged) : merged;
  }

  function renderListMarkup() {
    if (!localItems.length) {
      return '<div class="empty-state">No direct obligations are attached to this node yet. Add the first one here, then save the manager to persist it.</div>';
    }
    return `<div style="display:flex;flex-direction:column;gap:12px">${localItems.map(item => {
      const preview = buildEntityObligationFlowdownPreview({
        entity,
        obligation: item,
        settings: { ...settings, entityObligations: buildMergedObligations() }
      });
      const inheritedCount = (preview.companyMatches?.length || 0) + Number(preview.remainingCompanyCount || 0)
        + (preview.departmentMatches?.length || 0) + Number(preview.remainingDepartmentCount || 0);
      return `
        <div class="card" style="padding:var(--sp-4);background:var(--bg-elevated)">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <strong style="color:var(--text-primary)">${escapeHtml(String(item.title || 'Untitled obligation'))}</strong>
            <span class="badge badge--neutral">${escapeHtml(String(item.type || 'regulatory'))}</span>
            <span class="badge badge--neutral">${escapeHtml(String(item.requirementLevel || 'mandatory'))}</span>
            <span class="badge badge--neutral">${escapeHtml(String(item.flowDownMode || 'none'))} flow-down</span>
            ${item.active === false ? '<span class="badge badge--warning">Inactive</span>' : ''}
            <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn--ghost btn--sm" data-obligation-action="edit" data-obligation-id="${escapeHtml(String(item.id || ''))}" type="button">Edit</button>
              <button class="btn btn--ghost btn--sm" data-obligation-action="remove" data-obligation-id="${escapeHtml(String(item.id || ''))}" type="button">Remove</button>
            </div>
          </div>
          ${item.text ? `<div class="form-help" style="margin-top:8px">${escapeHtml(truncateText(String(item.text || ''), 260))}</div>` : ''}
          <div class="form-help" style="margin-top:8px">Direct on ${escapeHtml(String(entity.name || 'this node'))}. ${inheritedCount ? `Currently reaches ${inheritedCount} child target${inheritedCount === 1 ? '' : 's'}.` : 'Currently does not reach any child targets.'}</div>
          ${item.regulationTags?.length ? `<div class="citation-chips" style="margin-top:8px">${item.regulationTags.map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('')}</div>`;
  }

  const modal = UI.modal({
    title: `Manage Obligations: ${entity.name}`,
    body: `
      <div class="admin-workbench-strip admin-workbench-strip--compact">
        <div>
          <div class="admin-workbench-strip__label">Direct obligation management</div>
          <strong>Attach obligations where they originate, then decide how much should flow to subsidiaries or functions beneath this node.</strong>
          <span>Direct changes stay local inside this manager until you save them.</span>
        </div>
      </div>
      <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="${modalKey}-add" type="button">Add Obligation</button>
        <span class="form-help">Use family keys when a child obligation should intentionally override a parent obligation in the same family.</span>
      </div>
      <div id="${bodyId}" class="mt-4"></div>`,
    footer: `<button class="btn btn--ghost" id="${modalKey}-cancel">Close</button><button class="btn btn--primary" id="${modalKey}-save">Save Changes</button>`
  });

  const bodyEl = document.getElementById(bodyId);

  function renderManagerList() {
    bodyEl.innerHTML = renderListMarkup();
    bodyEl.querySelectorAll('[data-obligation-action="edit"]').forEach(button => {
      button.addEventListener('click', () => {
        const item = localItems.find(entry => entry.id === button.dataset.obligationId);
        if (!item) return;
        const editingId = item.id;
        openEntityObligationEditor({
          entity,
          settings: { ...settings, entityObligations: buildMergedObligations() },
          existingObligation: item,
          onSave: (nextObligation, editorModal) => {
            const index = localItems.findIndex(entry => entry.id === editingId);
            if (index > -1) localItems[index] = nextObligation;
            else localItems.push(nextObligation);
            editorModal.close();
            renderManagerList();
          }
        });
      });
    });
    bodyEl.querySelectorAll('[data-obligation-action="remove"]').forEach(button => {
      button.addEventListener('click', async () => {
        const index = localItems.findIndex(entry => entry.id === button.dataset.obligationId);
        if (index < 0) return;
        if (!await UI.confirm('Remove this obligation from the current node?')) return;
        localItems.splice(index, 1);
        renderManagerList();
      });
    });
  }

  renderManagerList();

  document.getElementById(`${modalKey}-add`)?.addEventListener('click', () => {
    openEntityObligationEditor({
      entity,
      settings: { ...settings, entityObligations: buildMergedObligations() },
      onSave: (nextObligation, editorModal) => {
        const index = localItems.findIndex(entry => entry.id === nextObligation.id);
        if (index > -1) localItems[index] = nextObligation;
        else localItems.push(nextObligation);
        editorModal.close();
        renderManagerList();
      }
    });
  });

  document.getElementById(`${modalKey}-cancel`)?.addEventListener('click', () => modal.close());
  document.getElementById(`${modalKey}-save`)?.addEventListener('click', async () => {
    const nextObligations = buildMergedObligations();
    const saved = await onSaveAll?.(nextObligations);
    if (saved === false) return;
    modal.close();
    UI.toast(`Saved obligations for ${entity.name}.`, 'success');
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
  if (!isLocalDevAiRuntimeConfigAllowed()) {
    return {
      apiUrl: DEFAULT_COMPASS_PROXY_URL,
      model: 'gpt-5.1',
      apiKey: ''
    };
  }
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
  const defaultConfig = {
    apiUrl: DEFAULT_COMPASS_PROXY_URL,
    model: 'gpt-5.1',
    apiKey: ''
  };
  if (!isLocalDevAiRuntimeConfigAllowed()) {
    return defaultConfig;
  }
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
    return {
      apiUrl: config.apiUrl || defaultConfig.apiUrl,
      model: config.model || defaultConfig.model,
      apiKey: config.apiKey || ''
    };
  } catch {
    return defaultConfig;
  }
}

function saveSessionLLMConfig(config) {
  const storageKey = buildUserStorageKey(SESSION_LLM_STORAGE_PREFIX);
  if (!isLocalDevAiRuntimeConfigAllowed()) {
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
    } catch {}
    return;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(config));
    sessionStorage.setItem(storageKey, JSON.stringify(config));
  } catch {}
}

function getSessionLLMHealth() {
  try {
    const storageKey = buildUserStorageKey(SESSION_LLM_HEALTH_STORAGE_PREFIX);
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveSessionLLMHealth(health) {
  try {
    const storageKey = buildUserStorageKey(SESSION_LLM_HEALTH_STORAGE_PREFIX);
    sessionStorage.setItem(storageKey, JSON.stringify({
      status: String(health?.status || '').trim(),
      checkedAt: Number(health?.checkedAt || Date.now()),
      message: String(health?.message || '').trim(),
      configFingerprint: String(health?.configFingerprint || '').trim()
    }));
  } catch {}
}

function clearSessionLLMHealth(username = getCurrentUserOrThrow().username) {
  try {
    sessionStorage.removeItem(buildUserStorageKey(SESSION_LLM_HEALTH_STORAGE_PREFIX, username));
  } catch {}
}

function clearPilotAiExpectationWarning(username = getCurrentUserOrThrow().username) {
  try {
    sessionStorage.removeItem(buildUserStorageKey(SESSION_PILOT_AI_WARNING_STORAGE_PREFIX, username));
  } catch {}
}

function getAiUnavailableMessage() {
  const cachedStatus = typeof LLMService !== 'undefined'
    && LLMService
    && typeof LLMService.getCachedServerAiStatus === 'function'
    ? LLMService.getCachedServerAiStatus()
    : null;
  if (cachedStatus?.mode === 'deterministic_fallback') {
    return 'Hosted AI is not configured right now. Continuity fallback may still support some workflows.';
  }
  if (cachedStatus?.mode === 'blocked' || cachedStatus?.mode === 'degraded') {
    return 'Hosted AI is temporarily unavailable right now.';
  }
  const runtimeStatus = typeof LLMService !== 'undefined' && LLMService && typeof LLMService.getRuntimeStatus === 'function'
    ? LLMService.getRuntimeStatus()
    : {
        usingStub: typeof LLMService !== 'undefined'
          && LLMService
          && typeof LLMService.isUsingStub === 'function'
          && LLMService.isUsingStub()
      };
  if (runtimeStatus.usingStub) {
    return 'Live AI is not configured for this session. Deterministic fallback or manual handling is active.';
  }
  return 'AI assistance is temporarily unavailable.';
}

async function maybeWarnPilotAiExpectation() {
  try {
    const user = AppState.currentUser || AuthService.getCurrentUser();
    if (!user?.username || String(user.role || '').trim().toLowerCase() !== 'admin') return;
    if (!isPilotOrStagingRelease()) return;
    const status = typeof LLMService !== 'undefined'
      && LLMService
      && typeof LLMService.fetchServerAiStatus === 'function'
      ? await LLMService.fetchServerAiStatus({ force: false, probe: true })
      : null;
    if (!status || status.mode === 'live') return;
    const warningKey = buildUserStorageKey(SESSION_PILOT_AI_WARNING_STORAGE_PREFIX, user.username);
    if (sessionStorage.getItem(warningKey) === '1') return;
    sessionStorage.setItem(warningKey, '1');
    UI.toast(
      String(status.message || 'Pilot channel is not currently in live AI mode. Check System Access before AI sign-off.'),
      'warning',
      7000
    );
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
  // Same-route rerenders reuse the last router meta object, so rely on the last rendered hash here instead of replaying an old navigation state.
  const routeChanged = AppState.lastRenderedRouteHash !== currentHash;
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
  window.AppShellPage.updateWizardProgressBar(step);
}

function setPage(html) {
  window.AppShellPage.setPage(html);
}

async function loadJSON(path) {
  const separator = String(path).includes('?') ? '&' : '?';
  const res = await fetch(`${path}${separator}v=${APP_ASSET_VERSION}`);
  if (!res.ok) {
    // Silent empty-data fallback makes grounding issues hard to diagnose during init.
    throw new Error(`Asset request failed for ${path} (${res.status})`);
  }
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

function normaliseScenarioLensHint(value) {
  const rawValues = value && typeof value === 'object'
    ? [value.key, value.label, value.functionKey, value.estimatePresetKey]
    : [value];
    const aliasMap = {
    ransomware: 'ransomware',
    identity: 'identity',
    phishing: 'phishing',
    insider: 'insider',
    cloud: 'cloud',
    'data breach': 'data-breach',
    'data-breach': 'data-breach',
    technology: 'cyber',
    'cyber risk': 'cyber',
      cyber: 'cyber',
      ai: 'ai-model-risk',
      'ai risk': 'ai-model-risk',
      'ai-risk': 'ai-model-risk',
      'ai / model risk': 'ai-model-risk',
      'ai-model-risk': 'ai-model-risk',
      'model risk': 'ai-model-risk',
      'responsible ai': 'ai-model-risk',
      'data governance': 'data-governance',
      'data-governance': 'data-governance',
      privacy: 'data-governance',
      'data privacy': 'data-governance',
      'data governance / privacy': 'data-governance',
      'fraud / integrity': 'fraud-integrity',
      'fraud integrity': 'fraud-integrity',
      'fraud-integrity': 'fraud-integrity',
      fraud: 'fraud-integrity',
      integrity: 'fraud-integrity',
      'financial crime': 'fraud-integrity',
      legal: 'legal-contract',
      contract: 'legal-contract',
      litigation: 'legal-contract',
      ip: 'legal-contract',
      'legal / contract': 'legal-contract',
      'legal-contract': 'legal-contract',
      geopolitical: 'geopolitical',
      sanctions: 'geopolitical',
      sovereign: 'geopolitical',
      'market access': 'geopolitical',
      'physical security': 'physical-security',
      'physical-security': 'physical-security',
      facilities: 'physical-security',
      'executive protection': 'physical-security',
      ot: 'ot-resilience',
      'ot resilience': 'ot-resilience',
      'ot-resilience': 'ot-resilience',
      'industrial control': 'ot-resilience',
      'site systems': 'ot-resilience',
      people: 'people-workforce',
      workforce: 'people-workforce',
      labour: 'people-workforce',
      labor: 'people-workforce',
      'human rights': 'people-workforce',
      'people / workforce': 'people-workforce',
      'people-workforce': 'people-workforce',
      investment: 'investment-jv',
      'joint venture': 'investment-jv',
      'joint-venture': 'investment-jv',
      'investment / jv': 'investment-jv',
      'investment-jv': 'investment-jv',
      'transformation delivery': 'transformation-delivery',
      'transformation-delivery': 'transformation-delivery',
      programme: 'transformation-delivery',
      program: 'transformation-delivery',
      'project delivery': 'transformation-delivery',
      'third party': 'third-party',
    'third-party': 'third-party',
    procurement: 'procurement',
    'supply chain': 'supply-chain',
    'supply-chain': 'supply-chain',
    strategic: 'strategic',
    operations: 'operational',
    operational: 'operational',
    regulatory: 'regulatory',
    finance: 'financial',
    financial: 'financial',
    esg: 'esg',
    compliance: 'compliance',
    continuity: 'business-continuity',
    'business continuity': 'business-continuity',
    'business-continuity': 'business-continuity',
    hse: 'hse',
    general: 'general'
  };
  for (const raw of rawValues) {
    const key = String(raw || '').trim().toLowerCase();
    if (!key) continue;
    if (aliasMap[key]) return aliasMap[key];
  }
  return '';
}

function guessRisksFromText(text, { lensHint = null } = {}) {
  const source = String(text || '').toLowerCase();
  const lensKey = normaliseScenarioLensHint(lensHint);
  const specialisedSeeds = (() => {
    if (/bankrupt|bankruptcy|insolv|insolven|receivable|bad debt|write[- ]?off|counterparty|credit loss|credit exposure|customer default|client default|collections|collectability|cashflow|working capital|provisioning|provision/.test(source)) {
      return [
        {
          title: 'Counterparty default and bad-debt exposure',
          category: 'Financial',
          regulations: ['COSO Internal Control Framework'],
          description: 'A customer insolvency or payment default could force a material write-off, provisioning review, and pressure on the control environment around receivables.'
        },
        {
          title: 'Receivables recovery shortfall after customer insolvency',
          category: 'Financial',
          regulations: ['COSO Internal Control Framework'],
          description: 'Collections may deteriorate quickly once a major client fails, creating cashflow strain and a weaker recovery path than management assumed.'
        },
        {
          title: 'Legal recovery or contractual claim uncertainty',
          category: 'Legal / Contract',
          regulations: ['ISO 37301'],
          description: 'Recovery may depend on enforceability of credit terms, guarantees, set-off rights, or the speed of insolvency-related legal action.'
        }
      ];
    }
    if (/exploitative labor|exploitative labour|forced labor|forced labour|child labor|child labour|modern slavery|labor practice|labour practice|worker exploitation|worker abuse|human rights/.test(source)) {
      return [
        {
          title: 'Supplier labor-practice and due-diligence failure',
          category: 'Procurement',
          regulations: ['ISO 20400', 'ISO 37301'],
          description: 'Weak sub-tier oversight or sourcing due diligence may have allowed exploitative labor practices to persist inside the supply base.'
        },
        {
          title: 'ESG and human-rights disclosure or remediation exposure',
          category: 'ESG',
          regulations: ['IFRS S1', 'GRI Universal Standards'],
          description: 'Once abusive labor practices are identified, management may face disclosure, remediation, and stakeholder scrutiny over the wider operating model.'
        },
        {
          title: 'Regulatory or compliance action over supplier conduct',
          category: 'Compliance',
          regulations: ['ISO 37301'],
          description: 'Exploitative labor practices can trigger investigation, fines, contract challenge, and assurance pressure around supplier governance.'
        }
      ];
    }
    if (/collud|price fix|bid rig|inflate (?:their |the )?bid|cartel|anti-?competitive|competition law/.test(source)) {
      return [
        {
          title: 'Procurement collusion or bid-rigging exposure',
          category: 'Procurement',
          regulations: ['ISO 20400', 'ISO 37301'],
          description: 'Competing suppliers may be coordinating bids or pricing in a way that distorts the award decision and weakens procurement integrity.'
        },
        {
          title: 'Commercial overpayment on a critical contract award',
          category: 'Financial',
          regulations: ['COSO Internal Control Framework'],
          description: 'Artificially inflated bids can lock the organisation into avoidable cost, weaker value-for-money, and downstream budget pressure.'
        },
        {
          title: 'Competition-law or sourcing-governance scrutiny',
          category: 'Regulatory',
          regulations: ['ISO 37301'],
          description: 'Suspicious bid behaviour can trigger challenge, remediation, and management scrutiny over how the sourcing decision was governed.'
        }
      ];
    }
    if (/single[- ]source|sole source|supplier shortfall|supplier concentration|critical supplier/.test(source)) {
      return [
        {
          title: 'Single-source supplier dependency on a critical spend category',
          category: 'Procurement',
          regulations: ['ISO 20400', 'ISO 28000'],
          description: 'One supplier now carries disproportionate delivery or commercial leverage over a critical category.'
        },
        {
          title: 'Supply chain resilience shortfall from limited fallback options',
          category: 'Supply Chain',
          regulations: ['ISO 28000', 'ISO 22301'],
          description: 'Weak substitution or delayed fallback could turn a supplier issue into a material continuity problem.'
        },
        {
          title: 'Contractual delivery or service failure from supplier concentration',
          category: 'Third-Party',
          regulations: ['ISO 27036', 'ISO 28000'],
          description: 'Concentrated dependency can create missed obligations, delayed delivery, and harder commercial escalation when the supplier slips.'
        }
      ];
    }
    return [];
  })();
  if (specialisedSeeds.length) return specialisedSeeds;
  const patterns = [
    { key: 'strategic', title: 'Strategic execution or market-position risk', category: 'Strategic', regulations: ['ISO 31000', 'COSO ERM'], terms: ['strategy', 'strategic', 'expansion', 'transformation', 'growth', 'market', 'competitive', 'portfolio', 'investment'] },
    { key: 'operational', title: 'Operational breakdown affecting core services', category: 'Operational', regulations: ['ISO 31000', 'ISO 22301'], terms: ['outage', 'downtime', 'availability', 'service disruption', 'operational disruption', 'failure', 'breakdown', 'backlog', 'capacity', 'process failure', 'human error', 'manual error', 'aging infrastructure', 'ageing infrastructure', 'legacy infrastructure', 'platform instability', 'system instability'] },
    { key: 'cyber', title: 'Cyber compromise of critical platforms or data', category: 'Cyber', regulations: ['UAE PDPL', 'ISO 27001'], terms: ['ransom', 'malware', 'phish', 'identity', 'credential', 'sso', 'entra', 'azure ad', 'breach', 'exfil', 'cloud compromise', 'cloud exposure', 'cloud breach', 'misconfig', 'vulnerability', 'privileged'] },
    { key: 'third-party', title: 'Third-party dependency or supplier failure', category: 'Third-Party', regulations: ['ISO 27036', 'ISO 28000'], terms: ['vendor', 'supplier', 'third-party', 'third party', 'outsourc', 'dependency', 'subprocessor', 'partner'] },
    { key: 'regulatory', title: 'Regulatory or licensing exposure', category: 'Regulatory', regulations: ['BIS Export Controls', 'OFAC Sanctions'], terms: ['regulator', 'regulatory', 'licence', 'license', 'supervisory', 'filing', 'notification', 'sanction', 'export control'] },
    { key: 'financial', title: 'Financial loss, fraud, or capital exposure', category: 'Financial', regulations: ['UAE AML/CFT', 'PCI-DSS 4.0'], terms: ['fraud', 'payment', 'invoice', 'treasury', 'liquidity', 'cash', 'capital', 'financial reporting', 'misstatement', 'bankruptcy', 'insolvency', 'receivable', 'bad debt', 'write-off', 'counterparty', 'customer default', 'client default', 'collections', 'working capital', 'provisioning'] },
    { key: 'fraud-integrity', title: 'Fraud, integrity, or financial-crime exposure', category: 'Fraud / Integrity', regulations: ['ISO 37001', 'UAE AML/CFT'], terms: ['fraud', 'integrity', 'financial crime', 'money laundering', 'kickback', 'bribery', 'corruption', 'collusion', 'embezzlement'] },
    { key: 'esg', title: 'ESG or sustainability disclosure risk', category: 'ESG', regulations: ['IFRS S1', 'IFRS S2'], terms: ['esg', 'sustainability', 'climate', 'emission', 'carbon', 'greenwashing', 'social impact', 'governance failure'] },
    { key: 'compliance', title: 'Compliance control or policy breakdown', category: 'Compliance', regulations: ['ISO 37301', 'UAE PDPL'], terms: ['policy breach', 'control failure', 'non-compliance', 'compliance', 'obligation', 'conduct', 'ethics', 'privacy', 'data protection', 'retention', 'lawful basis', 'cross-border transfer'] },
    { key: 'legal-contract', title: 'Legal, contract, or IP exposure', category: 'Legal / Contract', regulations: ['ISO 37301'], terms: ['contract', 'indemnity', 'litigation', 'ip', 'intellectual property', 'licensing dispute', 'dispute', 'terms breach'] },
    { key: 'geopolitical', title: 'Geopolitical, sanctions, or market-access exposure', category: 'Geopolitical', regulations: ['OFAC Sanctions', 'BIS Export Controls'], terms: ['geopolitical', 'market access', 'sanctions', 'export control', 'sovereign', 'cross-border restriction', 'entity list', 'tariff'] },
    { key: 'supply-chain', title: 'Supply chain resilience disruption', category: 'Supply Chain', regulations: ['ISO 28000', 'ISO 22301'], terms: ['supply chain', 'logistics', 'inventory', 'fulfilment', 'shipment', 'single source', 'upstream'] },
    { key: 'procurement', title: 'Procurement governance or sourcing risk', category: 'Procurement', regulations: ['ISO 20400', 'ISO 37301'], terms: ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'vendor selection', 'purchasing', 'critical spend', 'single-source spend'] },
    { key: 'business-continuity', title: 'Business continuity and recovery failure', category: 'Business Continuity', regulations: ['ISO 22301', 'NFPA 1600'], terms: ['continuity', 'recovery', 'dr', 'disaster recovery', 'rto', 'rpo', 'crisis management'] },
    { key: 'physical-security', title: 'Physical security or facilities-protection breakdown', category: 'Physical Security', regulations: ['ISO 22301', 'UAE Fire and Life Safety Code'], terms: ['physical security', 'perimeter', 'site intrusion', 'badge control', 'facility breach', 'executive protection', 'visitor management'] },
    { key: 'ot-resilience', title: 'OT or industrial-control resilience failure', category: 'OT Resilience', regulations: ['IEC 62443', 'ISO 22301'], terms: ['ot', 'industrial control', 'ics', 'scada', 'plant network', 'site systems', 'control room', 'operational technology'] },
    { key: 'people-workforce', title: 'People, workforce, or labour-practice exposure', category: 'People / Workforce', regulations: ['UN Guiding Principles', 'SA8000', 'ILO-OSH 2001'], terms: ['workforce', 'labour', 'labor', 'attrition', 'staffing', 'fatigue', 'strike', 'worker welfare', 'human rights'] },
    { key: 'investment-jv', title: 'Investment, JV, or integration-thesis exposure', category: 'Investment / JV', regulations: ['COSO ERM', 'ISO 31000'], terms: ['merger', 'acquisition', 'm&a', 'joint venture', 'jv', 'deal thesis', 'integration', 'valuation'] },
    { key: 'transformation-delivery', title: 'Transformation-delivery or programme-execution failure', category: 'Transformation Delivery', regulations: ['ISO 31010', 'COSO ERM'], terms: ['transformation', 'programme', 'program', 'project delivery', 'go-live', 'milestone', 'dependency slip', 'benefit realisation'] },
    { key: 'hse', title: 'Health, safety, and environmental incident exposure', category: 'HSE', regulations: ['ISO 45001', 'ISO 14001'], terms: ['hse', 'health and safety', 'safety', 'injury', 'environmental', 'spill', 'incident', 'worker'] }
  ];
  const compatibilityBoosts = {
    procurement: new Set(['procurement', 'supply-chain', 'third-party']),
    'supply-chain': new Set(['supply-chain', 'procurement', 'third-party']),
    compliance: new Set(['compliance', 'regulatory']),
    regulatory: new Set(['regulatory', 'compliance']),
    operational: new Set(['operational', 'business-continuity']),
    'business-continuity': new Set(['business-continuity', 'operational']),
    strategic: new Set(['strategic']),
    financial: new Set(['financial']),
    'fraud-integrity': new Set(['fraud-integrity', 'financial', 'compliance', 'regulatory']),
    'legal-contract': new Set(['legal-contract', 'compliance', 'regulatory', 'procurement']),
    geopolitical: new Set(['geopolitical', 'strategic', 'regulatory', 'supply-chain']),
    'physical-security': new Set(['physical-security', 'operational', 'business-continuity', 'hse']),
    'ot-resilience': new Set(['ot-resilience', 'operational', 'cyber', 'hse', 'business-continuity']),
    'people-workforce': new Set(['people-workforce', 'hse', 'esg', 'operational', 'compliance']),
    'investment-jv': new Set(['investment-jv', 'strategic', 'financial']),
    'transformation-delivery': new Set(['transformation-delivery', 'strategic', 'operational']),
    esg: new Set(['esg']),
    hse: new Set(['hse']),
    cyber: new Set(['cyber']),
    'third-party': new Set(['third-party', 'procurement', 'supply-chain'])
  };
  // Keep the fallback lens enterprise-wide and hint-aware so Step 1 does not swing back to the old cyber-default shortlist.
  const found = patterns
    .map(({ key, title, category, regulations, terms }) => {
      const hitCount = terms.filter(term => source.includes(term)).length;
      const lensBoost = lensKey && key === lensKey ? 3 : (compatibilityBoosts[lensKey]?.has(key) ? 1 : 0);
      return hitCount || lensBoost ? {
        key,
        title,
        category,
        regulations,
        score: hitCount + lensBoost
      } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .map(({ title, category, regulations }) => ({
      title,
      category,
      regulations,
      description: 'Extracted from the provided narrative or risk register.'
    }));
  if (found.length) return found;
  const hintedPattern = patterns.find(pattern => pattern.key === lensKey);
  return hintedPattern
    ? [{
        title: hintedPattern.title,
        category: hintedPattern.category,
        regulations: hintedPattern.regulations,
        description: 'Generated from the active assessment lens to provide a clearer shortlist.'
      }]
    : [{ title: 'Material enterprise risk requiring further triage', category: 'General', regulations: ['ISO 31000'] }];
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

function composeGuidedNarrative(guidedInput = {}, { lensLabel = '', lensKey = '' } = {}) {
  const event = String(guidedInput.event || '').trim();
  const asset = String(guidedInput.asset || '').trim();
  const cause = String(guidedInput.cause || '').trim();
  const impact = String(guidedInput.impact || '').trim();
  const urgency = String(guidedInput.urgency || 'medium').trim().toLowerCase();
  const urgencyPrefix = urgency ? `${urgency.charAt(0).toUpperCase() + urgency.slice(1)}-urgency` : 'Material';
  if (!event && !asset && !cause && !impact) return '';

  const resolvedLensLabel = String(lensLabel || '').trim();
  const resolvedLensKey = normaliseScenarioLensHint(lensKey || lensLabel);
  const lensPrefix = resolvedLensLabel ? `${resolvedLensLabel} ` : '';
  const lowerFirst = (value = '') => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.charAt(0).toLowerCase() + text.slice(1);
  };
  const inferScenarioContext = () => {
    const text = [event, asset, cause, impact, resolvedLensKey, resolvedLensLabel].filter(Boolean).join(' ').toLowerCase();
    if (/ai\b|model risk|responsible ai|hallucination|bias|drift|algorithm|llm|training data/.test(text)) {
      return {
        positioning: 'This points to an AI-governance and model-risk issue rather than a generic technology problem.',
        affected: 'the model-governance, monitoring, and human-override path around the AI-enabled workflow in scope',
        driver: 'weak guardrails, limited monitoring of model behaviour, or poor control over how outputs are reviewed and used',
        impact: 'unsafe decisions, regulatory scrutiny, customer or internal harm, and lower trust in AI-enabled operations',
        followOn: 'Once the model starts producing unsafe or low-trust outputs, management usually has to stabilise usage, review governance, and explain how the model was allowed to operate that way.'
      };
    }
    if (/data governance|data quality|data lineage|retention|purpose limitation|privacy|personal data|consent|residency|master data/.test(text)) {
      return {
        positioning: 'This points to a data-governance and privacy issue rather than only a classic cyber incident.',
        affected: 'the data lineage, retention, ownership, and approved-use path around the affected dataset',
        driver: 'weak ownership, poor retention enforcement, or unclear control over how sensitive data is reused and governed',
        impact: 'supervisory challenge, remediation cost, and lower confidence in analytics or reporting built on the data',
        followOn: 'Once data-governance weaknesses become visible, management often has to defend both privacy compliance and the reliability of downstream uses built on the same data.'
      };
    }
    if (/exploitative labor|exploitative labour|forced labor|forced labour|child labor|child labour|modern slavery|labor practice|labour practice|worker exploitation|worker abuse|human rights/.test(text)) {
      return {
        positioning: 'This points to a combined procurement, compliance, and ESG issue rather than a simple supplier-performance problem.',
        affected: 'the supplier due-diligence, sourcing-governance, and contract-management path around the affected category',
        driver: 'weak sub-tier supplier oversight, delayed escalation, or inadequate sourcing due diligence',
        impact: 'regulatory fines, supplier remediation cost, contract challenge, and stakeholder scrutiny',
        followOn: 'Once exploitative labor practices are confirmed, management usually has to make rapid supplier, remediation, and disclosure decisions under regulatory and reputational pressure.'
      };
    }
    if (/collud|price fix|bid rig|cartel|anti-?competitive|inflate (?:their |the )?bid|competition law/.test(text)) {
      return {
        positioning: 'This points to a procurement-integrity issue rather than a routine supplier-performance problem.',
        affected: 'the pricing challenge, sourcing-governance, and contract-award path for the category in scope',
        driver: 'supplier collusion, weak tender challenge, or poor detection of distorted pricing patterns',
        impact: 'commercial overpayment, challenge to the award decision, and regulatory scrutiny',
        followOn: 'If the pattern is not challenged quickly, the organisation can lock in avoidable cost and face questions about how the sourcing decision was governed.'
      };
    }
    if (/bankrupt|bankruptcy|insolv|insolven|receivable|bad debt|write[- ]?off|counterparty|credit loss|credit exposure|customer default|client default|collections|collectability|cashflow|working capital|provisioning|provision/.test(text)) {
      return {
        positioning: 'This points to a counterparty-credit and receivables-recovery issue, not a generic compliance breakdown.',
        affected: 'the customer exposure, receivables position, and recovery path in scope',
        driver: 'client insolvency, delayed collections, or weak visibility over concentration and recovery risk',
        impact: 'bad debt write-off, cashflow strain, and pressure on provisioning and reporting judgement',
        followOn: 'Once a major client fails, management usually has to move quickly on collections strategy, provisioning, legal recovery options, and wider concentration exposure.'
      };
    }
    if (/(supplier|vendor|third[- ]party|third party)/.test(text)
      && /(delivery date|delivery commitment|delay|delayed|deployment|go-live|rollout|milestone|dependent business project|dependent project|programme|program|project)/.test(text)
      && !/(procurement|sourcing|tender|bid|contract award|vendor selection|critical spend|award decision|single[- ]source|sole source|supplier concentration)/.test(text)) {
      return {
        positioning: 'This points to a supplier-dependency and delivery issue rather than a weak sourcing-governance or contract-award decision.',
        affected: 'the infrastructure deployment, milestone plan, and dependent business projects waiting on the supplier delivery path',
        driver: 'supplier delivery slippage, weak contingency planning, or late visibility over a dependency that matters to the programme',
        impact: 'deployment delay, project slippage, workaround cost, and pressure on downstream business commitments',
        followOn: 'Once a delivery-critical supplier slips, management usually has to decide whether to re-sequence the deployment, accelerate fallback options, or accept wider delay across dependent projects.'
      };
    }
    if (/single[- ]source|sole source|supplier shortfall|supplier concentration|critical supplier/.test(text)) {
      return {
        positioning: 'This points to a concentration and resilience issue in the supplier base, not just an isolated vendor problem.',
        affected: 'the supplier concentration, fallback options, and continuity posture for the category in scope',
        driver: 'weak substitution planning, concentrated spend, or late detection of supplier stress',
        impact: 'delivery pressure, continuity strain, and stronger commercial leverage for the supplier',
        followOn: 'Once a critical category becomes concentrated, continuity, pricing power, and contract performance usually deteriorate together.'
      };
    }
    if (/(downtime|outage|service disruption|operational disruption|availability|unavailable|aging infrastructure|ageing infrastructure|legacy infrastructure|human error|manual error|platform instability|system instability)/.test(text)
      && !/(ransom|malware|phish|identity|credential|breach|exfil|misconfigur|privileged|compromise)/.test(text)) {
      return {
        positioning: 'This points to an operational resilience issue in a technology-dependent service, not automatically a cyber event.',
        affected: 'the service availability, recovery, and incident-management path around the affected system or platform',
        driver: 'aging infrastructure, fragile platform dependencies, or human error during support or change activity',
        impact: 'customer disruption, operational backlog, recovery cost, and reputational strain',
        followOn: 'Once downtime becomes visible, management usually has to stabilise the service, manage customer impact, and decide whether deeper resilience or infrastructure remediation is needed.'
      };
    }
    if (/geopolitical|market access|sanctions|export control|entity list|sovereign|cross-border restriction|tariff/.test(text)) {
      return {
        positioning: 'This points to a geopolitical and market-access issue rather than only a narrow regulatory problem.',
        affected: 'the cross-border operating path, supplier access, and market-entry assumptions behind the initiative in scope',
        driver: 'sovereign restrictions, sanctions, export controls, or tightened approval conditions',
        impact: 'delayed execution, supply disruption, stranded investment, and management reprioritisation',
        followOn: 'Once geopolitical restrictions tighten, management often has to rethink suppliers, delivery timing, and whether the original business case is still realistic.'
      };
    }
    if (/physical security|facility breach|badge control|perimeter|executive protection|visitor management|site intrusion/.test(text)) {
      return {
        positioning: 'This points to a physical-security and facilities-control issue rather than a purely digital incident.',
        affected: 'the site-access, perimeter, visitor-management, and executive-protection path around the location in scope',
        driver: 'weak access controls, poor site coordination, or inadequate challenge over physical entry and movement',
        impact: 'site disruption, safety concern, investigation cost, and lower confidence in the operating environment',
        followOn: 'Once physical controls are shown to be weak, management usually has to stabilise access, reassess site posture, and decide whether broader facilities controls need urgent remediation.'
      };
    }
    if (/ot\b|industrial control|ics|scada|plant network|site systems|control room/.test(text)) {
      return {
        positioning: 'This points to an OT and site-resilience issue that sits between cyber, operations, and safety.',
        affected: 'the industrial-control, telemetry, and site-recovery path around the affected operating environment',
        driver: 'weak change governance, poor segregation between IT and OT, or limited fallback visibility over critical controls',
        impact: 'unstable operations, safety concern, and slower recovery of the site or process in scope',
        followOn: 'Once site-control confidence drops, management usually has to choose between degraded operation, manual fallback, or shutdown while recovery is brought back under control.'
      };
    }
    if (/workforce|labou?r|staffing|fatigue|attrition|strike|worker welfare/.test(text)) {
      return {
        positioning: 'This points to a people and workforce resilience issue rather than only a generic HSE or HR concern.',
        affected: 'the staffing model, contractor coverage, and shift-critical control path around the work in scope',
        driver: 'fatigue, attrition, weak workforce planning, or delayed escalation of labour and welfare pressure',
        impact: 'operational strain, wellbeing concern, and higher likelihood of error or unsafe work conditions',
        followOn: 'Once workforce pressure is visible, management usually has to make rapid decisions about staffing, safe coverage, contractor oversight, and whether work should continue as planned.'
      };
    }
    return null;
  };
  const inferredContext = inferScenarioContext();
  const defaultsByLens = {
    'ai-model-risk': {
      affected: 'the AI-enabled workflow, model-governance path, or decision process in scope',
      impact: 'unsafe outputs, conduct challenge, remediation work, and loss of trust in AI-enabled operations',
      followOn: 'This kind of AI issue usually weakens confidence in the model, the human-review path, and the governance needed to keep AI use defensible.'
    },
    'data-governance': {
      affected: 'the data lineage, retention, ownership, or approved-use path in scope',
      impact: 'privacy challenge, remediation cost, and lower confidence in analytics or reporting built on the same data',
      followOn: 'This kind of data-governance event often reveals weak ownership and poor control over how sensitive data is retained, reused, or challenged.'
    },
    procurement: {
      affected: 'the sourcing decision, contract award path, or spend category in scope',
      impact: 'commercial overpayment, award challenge, supplier-governance strain, and regulatory scrutiny',
      followOn: 'This kind of procurement event usually weakens challenge over pricing, supplier fit, and management confidence in the award decision.'
    },
    'supply-chain': {
      affected: 'the critical supply path, inventory position, or delivery commitment in scope',
      impact: 'delivery shortfall, customer or programme delay, and continuity pressure',
      followOn: 'This kind of supply-chain event often cascades into workaround cost, contractual pressure, and weaker fallback options.'
    },
    compliance: {
      affected: 'the control, policy, or obligation set in scope',
      impact: 'remediation burden, assurance pressure, and regulatory scrutiny',
      followOn: 'This usually becomes more serious when exceptions, approvals, or reporting quality are not challenged early.'
    },
    regulatory: {
      affected: 'the regulated activity, licence condition, or filing obligation in scope',
      impact: 'enforcement pressure, remediation cost, and management escalation'
    },
    financial: {
      affected: 'the financial process, transaction flow, or commercial exposure in scope',
      impact: 'direct monetary loss, control pressure, and delayed detection'
    },
    'fraud-integrity': {
      affected: 'the approval, payment, or conduct-control path in scope',
      impact: 'direct loss, investigation pressure, and lower confidence in the integrity of the operating model',
      followOn: 'This kind of integrity event usually exposes how easy it was to bypass controls, collude, or hide unusual activity inside trusted workflows.'
    },
    'legal-contract': {
      affected: 'the contract, indemnity, licensing, or rights position in scope',
      impact: 'legal cost, delivery delay, and pressure on commitments that depend on the disputed relationship',
      followOn: 'These scenarios usually become more serious when governance over changes, obligations, or ownership is weak.'
    },
    geopolitical: {
      affected: 'the cross-border operating plan, supplier access, or market-entry path in scope',
      impact: 'delayed execution, supplier disruption, and value erosion as policy conditions tighten',
      followOn: 'This kind of geopolitical event typically weakens timing, optionality, and management confidence in the original plan.'
    },
    strategic: {
      affected: 'the strategic objective, programme, or operating model in scope',
      impact: 'value erosion, management distraction, and corrective execution cost'
    },
    operational: {
      affected: 'the operating process or service in scope',
      impact: 'service degradation, backlog growth, and recovery effort'
    },
    'physical-security': {
      affected: 'the site-access, facilities, or executive-protection controls in scope',
      impact: 'site disruption, investigation cost, and safety or leadership concern',
      followOn: 'Physical-security events usually trigger wider review of access control, contractor oversight, and site operating confidence.'
    },
    'ot-resilience': {
      affected: 'the industrial-control or site-systems environment in scope',
      impact: 'operational instability, recovery strain, and possible safety escalation',
      followOn: 'This kind of OT issue often sits between cyber, operations, and safety, so containment and recovery decisions become tightly coupled.'
    },
    'business-continuity': {
      affected: 'the recovery-critical service or fallback operating model in scope',
      impact: 'extended disruption, missed recovery objectives, and continuity escalation'
    },
    hse: {
      affected: 'the people, site, or environment in scope',
      impact: 'harm, shutdown pressure, remediation cost, and regulatory attention'
    },
    'people-workforce': {
      affected: 'the workforce model, labour conditions, or staffing-critical activity in scope',
      impact: 'wellbeing concern, error risk, and lower confidence in sustained safe delivery',
      followOn: 'People and workforce issues often intensify quickly because staffing pressure, supervision, and welfare concerns amplify each other.'
    },
    'investment-jv': {
      affected: 'the transaction thesis, integration path, or shared governance model in scope',
      impact: 'value erosion, delayed synergy, and executive pressure to reset assumptions',
      followOn: 'These scenarios usually expose whether the deal logic, integration plan, and control assumptions were strong enough to justify the investment.'
    },
    'transformation-delivery': {
      affected: 'the programme roadmap, milestone control, or dependency path in scope',
      impact: 'delay, rising cost, and lower confidence in delivery of the intended change',
      followOn: 'Transformation issues become expensive when weak dependency control and unclear ownership are allowed to persist too long.'
    },
    cyber: {
      affected: 'the critical platform, dataset, or identity path in scope',
      impact: 'service disruption, data exposure, fraud risk, and response cost'
    },
    general: {
      affected: 'the business activity or dependency in scope',
      impact: 'material operational, financial, or regulatory consequences'
    }
  };
  const defaults = defaultsByLens[resolvedLensKey] || defaultsByLens.general;
  const resolvedArea = asset || inferredContext?.affected || defaults.affected;
  const resolvedDriver = cause || inferredContext?.driver || '';
  const resolvedImpact = impact
    ? (inferredContext?.impact && !String(impact).toLowerCase().includes(String(inferredContext.impact).toLowerCase())
        ? `${lowerFirst(impact)}, alongside ${lowerFirst(inferredContext.impact)}`
        : impact)
    : (inferredContext?.impact || defaults.impact);
  const parts = [];
  if (event) {
    parts.push(`${urgencyPrefix} ${lensPrefix}scenario: ${event.charAt(0).toUpperCase() + event.slice(1)}.`);
  } else if (cause) {
    parts.push(`${urgencyPrefix} ${lensPrefix}scenario: ${cause.charAt(0).toUpperCase() + cause.slice(1)} could trigger a material issue.`);
  }
  if (inferredContext?.positioning) {
    // Keep the draft preview closer to a real management scenario by naming the issue shape, not just restating the user's sentence.
    parts.push(inferredContext.positioning);
  }
  parts.push(`The area most exposed is ${resolvedArea}.`);
  if (resolvedDriver) {
    parts.push(`The most likely driver is ${lowerFirst(resolvedDriver)}.`);
  }
  parts.push(`If this develops, it could create ${lowerFirst(resolvedImpact)}.`);
  const followOn = inferredContext?.followOn || defaults.followOn;
  if (followOn) {
    parts.push(followOn);
  }
  if (asset && /identity|directory|sso|email|azure ad|active directory/i.test(`${event} ${asset} ${cause}`.toLowerCase())) {
    parts.push('Likely knock-on effects include mailbox compromise, privileged misuse, downstream service disruption, and data exposure if the event is not contained quickly.');
  }
  return parts.join(' ');
}

// ─── APP BAR ──────────────────────────────────────────────────
function renderAppBar() {
  return window.AppShellNavigation.renderAppBar();
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
                ['When to use templates','Use a template when the scenario is similar to procurement shortfall, compliance breakdown, AI governance failure, supply chain disruption, or a cyber/resilience event.'],
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
  document.getElementById('btn-start-new').addEventListener('click', () => { launchGuidedAssessmentStart(); });

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
        title: typeof resolveScenarioDisplayTitle === 'function'
          ? resolveScenarioDisplayTitle(assessment)
          : (assessment.scenarioTitle || 'Untitled assessment'),
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

function buildLivingRiskRegisterRows({
  assessments = [],
  now = Date.now()
} = {}) {
  const source = Array.isArray(assessments) ? assessments.filter(Boolean) : [];
  const watchlist = buildAssessmentWatchlist({
    assessments: source,
    maxItems: Math.max(source.length || 0, 12),
    now
  });
  const watchlistById = new Map(watchlist.map(item => [String(item.id || ''), item]));
  const dayMs = 86400000;
  const formatDateLabel = (value) => {
    const ts = Number(value || 0);
    if (!ts) return 'Not reviewed yet';
    return new Date(ts).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const describeDueDate = (dueAt) => {
    const ts = Number(dueAt || 0);
    if (!ts) return 'Due date not set';
    const diffDays = Math.floor((ts - now) / dayMs);
    if (diffDays <= 0) {
      const overdue = Math.abs(diffDays);
      return overdue <= 0 ? 'Due now' : `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`;
    }
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 14) return `Due in ${diffDays} days`;
    return `Due ${formatDateLabel(ts)}`;
  };
  const getTrendModel = (assessment, watchItem) => {
    const reviewStatus = String(assessment?.reviewSubmission?.reviewStatus || '').trim().toLowerCase();
    if (reviewStatus === 'changes_requested') return { label: 'Needs revision', tone: 'warning' };
    if (reviewStatus === 'escalated') return { label: 'Escalated', tone: 'neutral' };
    if (reviewStatus === 'pending') return { label: 'In review', tone: 'neutral' };
    const baselineResults = assessment?.comparisonBaseline?.results || null;
    const currentResults = assessment?.results || null;
    const currentP90 = Number(currentResults?.eventLoss?.p90 || currentResults?.lm?.p90 || 0);
    const baselineP90 = Number(baselineResults?.eventLoss?.p90 || baselineResults?.lm?.p90 || 0);
    if (baselineResults && currentP90 > 0 && baselineP90 > 0) {
      const deltaRatio = (currentP90 - baselineP90) / Math.max(baselineP90, 1);
      if (deltaRatio <= -0.1) return { label: 'Improving', tone: 'success' };
      if (deltaRatio >= 0.1) return { label: 'Deteriorating', tone: 'danger' };
      return { label: 'Stable vs baseline', tone: 'neutral' };
    }
    if (watchItem?.reasonFamily === 'evidence') return { label: 'Evidence refresh due', tone: 'warning' };
    if (watchItem?.reasonFamily === 'baseline') return { label: 'Baseline refresh due', tone: 'neutral' };
    if (watchItem?.reasonFamily === 'timing') return { label: 'Scheduled review', tone: 'neutral' };
    return { label: 'Stable', tone: 'success' };
  };
  const tonePriority = { danger: 5, warning: 4, gold: 3, neutral: 2, success: 1 };
  const statusPriority = { changes_requested: 6, escalated: 5, pending: 4, approved: 1, '': 0 };

  return source
    .filter(assessment => assessment?.results)
    .filter(assessment => {
      const lifecycleStatus = typeof deriveAssessmentLifecycleStatus === 'function'
        ? deriveAssessmentLifecycleStatus(assessment)
        : String(assessment?.lifecycleStatus || '').trim().toLowerCase();
      return lifecycleStatus !== 'archived';
    })
    .map(assessment => {
      const results = assessment.results || {};
      const lifecycle = typeof getAssessmentLifecyclePresentation === 'function'
        ? getAssessmentLifecyclePresentation(assessment)
        : {
            status: String(assessment.lifecycleStatus || '').trim().toLowerCase(),
            label: String(assessment.lifecycleStatus || 'Saved').trim() || 'Saved'
          };
      const watchItem = watchlistById.get(String(assessment.id || '')) || null;
      const reviewStatus = String(assessment.reviewSubmission?.reviewStatus || '').trim().toLowerCase();
      const postureTone = results.toleranceBreached
        ? 'danger'
        : results.nearTolerance
          ? 'warning'
          : results.annualReviewTriggered
            ? 'gold'
            : 'success';
      const postureLabel = results.toleranceBreached
        ? 'Above tolerance'
        : results.nearTolerance
          ? 'Near tolerance'
          : results.annualReviewTriggered
            ? 'Annual review'
            : 'Within tolerance';
      const lastReviewAt = Number(
        assessment.reviewSubmission?.reviewedAt
        || assessment.completedAt
        || assessment.lifecycleUpdatedAt
        || assessment.createdAt
        || 0
      );
      const dueIntervalDays = reviewStatus === 'changes_requested' || reviewStatus === 'escalated' || reviewStatus === 'pending'
        ? 0
        : results.toleranceBreached
          ? 0
          : results.nearTolerance
            ? 30
            : results.annualReviewTriggered
              ? 60
              : lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED
                ? 120
                : lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT
                  ? 45
                  : watchItem?.reasonFamily === 'evidence'
                    ? 60
                    : watchItem?.reasonFamily === 'baseline'
                      ? 120
                      : 365;
      const nextReviewDueAt = dueIntervalDays === 0
        ? now
        : ((lastReviewAt || now) + (dueIntervalDays * dayMs));
      const trend = getTrendModel(assessment, watchItem);
      const owner = String(
        assessment.submittedBy
        || assessment.createdBy
        || assessment.username
        || assessment.owner
        || ''
      ).trim().toLowerCase();
      return {
        id: String(assessment.id || '').trim(),
        title: String(assessment.scenarioTitle || assessment.title || 'Untitled assessment').trim(),
        owner: owner || 'unassigned',
        buName: String(assessment.buName || assessment.businessUnit || 'Business unit not set').trim(),
        lifecycleLabel: lifecycle.label,
        lifecycleStatus: lifecycle.status,
        postureLabel,
        postureTone,
        trendLabel: trend.label,
        trendTone: trend.tone,
        reviewStatus,
        lastReviewAt,
        lastReviewLabel: formatDateLabel(lastReviewAt),
        nextReviewDueAt,
        nextReviewLabel: describeDueDate(nextReviewDueAt),
        p90Loss: Number(results.eventLoss?.p90 || results.lm?.p90 || 0),
        aleMean: Number(results.ale?.mean || results.annualLoss?.mean || 0),
        toleranceBreached: Boolean(results.toleranceBreached),
        nearTolerance: Boolean(results.nearTolerance),
        annualReviewTriggered: Boolean(results.annualReviewTriggered),
        nextAction: String(
          watchItem?.nextAction
          || (reviewStatus === 'changes_requested'
            ? 'Revise the assessment and respond to the reviewer note.'
            : reviewStatus === 'escalated'
              ? 'Track the escalated review and prepare supporting evidence.'
              : reviewStatus === 'pending'
                ? 'Wait for management sign-off or respond to reviewer feedback.'
                : results.toleranceBreached
                  ? 'Reopen the result and confirm the immediate management response.'
                  : 'Open the result and confirm whether the current assumptions still hold.')
        ).trim(),
        statusNote: String(watchItem?.detail || '').trim()
      };
    })
    .sort((left, right) => {
      const toneDelta = (tonePriority[right.postureTone] || 0) - (tonePriority[left.postureTone] || 0);
      if (toneDelta) return toneDelta;
      const reviewDelta = (statusPriority[right.reviewStatus] || 0) - (statusPriority[left.reviewStatus] || 0);
      if (reviewDelta) return reviewDelta;
      return Number(left.nextReviewDueAt || 0) - Number(right.nextReviewDueAt || 0);
    });
}

function buildLivingRiskRegisterSummary(rows = []) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const countWhere = predicate => list.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
  return {
    total: list.length,
    aboveTolerance: countWhere(item => item.postureTone === 'danger'),
    nearTolerance: countWhere(item => item.postureTone === 'warning'),
    annualReview: countWhere(item => item.postureTone === 'gold'),
    dueNow: countWhere(item => /due now|overdue/i.test(String(item.nextReviewLabel || ''))),
    inReview: countWhere(item => item.reviewStatus === 'pending'),
    needsRevision: countWhere(item => item.reviewStatus === 'changes_requested')
  };
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
  const structured = normaliseStructuredScenario(draft.structuredScenario, { preserveUnknown: true }) || {};
  const wordCount = narrative ? narrative.split(/\s+/).filter(Boolean).length : 0;
  const totalEvidenceCount = (Array.isArray(citations) ? citations.filter(Boolean).length : 0)
    + (Array.isArray(primaryGrounding) ? primaryGrounding.filter(Boolean).length : 0)
    + (Array.isArray(supportingReferences) ? supportingReferences.filter(Boolean).length : 0)
    + (Array.isArray(inputProvenance) ? inputProvenance.filter(Boolean).length : 0);
  const assetPresent = !!String(structured.assetService || '').trim() || /platform|service|system|application|environment|identity|data|supplier|vendor|team|workflow/i.test(narrative);
  const causePresent = !!String(structured.eventPath || '').trim() || /because|caused by|trigger|supplier|vendor|misconfig|phishing|ransomware|breach|comprom|failure|outage|attack/i.test(narrative);
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
  const hasStructuredFields = hasStructuredScenario(draft.structuredScenario);
  const aiAssisted = !!draft.llmAssisted;
  const tefRange = calculateRelativeRange(modelInputs.tefMin, modelInputs.tefLikely, modelInputs.tefMax);
  const lossLikely = ['irLikely','biLikely','dbLikely','rlLikely','tpLikely','rcLikely'].reduce((sum, key) => sum + Number(modelInputs[key] || 0), 0);
  const lossMin = ['irMin','biMin','dbMin','rlMin','tpMin','rcMin'].reduce((sum, key) => sum + Number(modelInputs[key] || 0), 0);
  const lossMax = ['irMax','biMax','dbMax','rlMax','tpMax','rcMax'].reduce((sum, key) => sum + Number(modelInputs[key] || 0), 0);
  const lossRange = calculateRelativeRange(lossMin, lossLikely, lossMax);
  const reasons = [];
  const improvements = [];

  if (hasStructuredFields) { score += 8; reasons.push('The scenario has been structured into asset, primary driver, event path, and effect.'); }
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
  const asset = getStructuredScenarioField(draft.structuredScenario, 'assetService') || 'the affected service';
  const primaryDriver = getStructuredScenarioField(draft.structuredScenario, 'primaryDriver') || 'the relevant primary driver';
  assumptions.push({ category: 'Scenario', text: `Assumes ${asset} remains the main point of impact across ${geography}.` });
  assumptions.push({ category: 'Driver', text: `Assumes ${primaryDriver} remains a realistic source of this scenario during the assessment period.` });
  assumptions.push({ category: 'Frequency', text: `Assumes the event could occur between ${modelInputs.tefMin ?? '—'} and ${modelInputs.tefMax ?? '—'} times per year, with ${modelInputs.tefLikely ?? '—'} as the working case after any linked-scenario uplift.` });
  if (modelInputs.vulnDirect) assumptions.push({ category: 'Exposure', text: `Assumes direct event success remains within the stated exposure range rather than changing materially because of control drift or attacker capability changes.` });
  else assumptions.push({ category: 'Exposure', text: `Assumes current control strength and attacker capability are reasonably represented by the selected FAIR ranges.` });
  assumptions.push({ category: 'Loss', text: `Assumes business interruption, response, legal, data, third-party, and reputation impacts can be represented as per-event ranges rather than one fixed value.` });
  if (scenarioMeta?.linked) assumptions.push({ category: 'Portfolio', text: 'Assumes the selected linked risks can escalate together and justify the applied scenario uplift in frequency and loss.' });
  if (Array.isArray(draft.applicableRegulations) && draft.applicableRegulations.length) assumptions.push({ category: 'Regulatory', text: `Assumes the currently selected regulatory set remains the most relevant set for this scenario: ${draft.applicableRegulations.slice(0, 4).join(', ')}${draft.applicableRegulations.length > 4 ? ' and others' : ''}.` });
  const obligationBasis = buildResolvedObligationSnapshot({
    context: draft?.obligationBasis || draft?.resolvedObligationContext,
    capturedAt: Number(draft?.obligationBasis?.capturedAt || 0)
  });
  if (obligationBasis.allResolved.length) {
    const parts = [];
    if (obligationBasis.direct.length) parts.push(`${obligationBasis.direct.length} direct obligation${obligationBasis.direct.length === 1 ? '' : 's'}`);
    if (obligationBasis.inheritedMandatory.length) parts.push(`${obligationBasis.inheritedMandatory.length} inherited mandatory obligation${obligationBasis.inheritedMandatory.length === 1 ? '' : 's'}`);
    if (obligationBasis.inheritedConditional.length) parts.push(`${obligationBasis.inheritedConditional.length} inherited conditional obligation${obligationBasis.inheritedConditional.length === 1 ? '' : 's'}`);
    if (obligationBasis.inheritedGuidance.length) parts.push(`${obligationBasis.inheritedGuidance.length} inherited guidance obligation${obligationBasis.inheritedGuidance.length === 1 ? '' : 's'}`);
    assumptions.push({
      category: 'Obligations',
      text: `Assumes the resolved obligation basis remains valid for this scenario, including ${parts.join(', ')}${obligationBasis.resolvedApplicableRegulations.length ? ` and obligation-derived regulatory tags such as ${obligationBasis.resolvedApplicableRegulations.slice(0, 4).join(', ')}${obligationBasis.resolvedApplicableRegulations.length > 4 ? ' and others' : ''}` : ''}.`
    });
  }
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
  const mode = String(challenge?.mode || (challenge?.usedFallback ? 'deterministic_fallback' : '')).trim().toLowerCase() || 'live';
  const modeTone = mode === 'deterministic_fallback' ? 'warning' : mode === 'manual' ? 'neutral' : 'success';
  const modeLabel = mode === 'deterministic_fallback'
    ? 'Deterministic fallback challenge'
    : mode === 'manual'
      ? 'Manual challenge guidance'
      : 'Live AI challenge';
  const modeMessage = String(challenge?.fallbackReasonMessage || challenge?.manualReasonMessage || '').trim();
  return `<div class="results-summary-card">
    <div class="results-section-heading">Challenge and validate this assessment</div>
    <div class="results-chip-block">
      <span class="badge badge--warning">${challenge.challengeLevel || 'Challenge review'}</span>
      <span class="badge badge--${modeTone}">${modeLabel}</span>
      ${challenge.confidenceLabel ? `<span class="badge badge--neutral">${challenge.confidenceLabel}</span>` : ''}
      ${challenge.evidenceQuality ? `<span class="badge badge--gold">${challenge.evidenceQuality}</span>` : ''}
    </div>
    ${modeMessage ? `<div class="form-help" style="margin-top:8px">${modeMessage}</div>` : ''}
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
        <div class="banner banner--poc mb-6"><span class="banner-icon">⚠</span><span class="banner-text"><strong>PoC Notice:</strong> Pilot environment only. Use approved test credentials and dummy scenarios only.</span></div>
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

  function showPocUsageNotice() {
    return new Promise((resolve) => {
      const fallbackMessage = 'PoC only. Do not use real data. Create dummy scenarios only and avoid real company names. Use generic terms such as "supplier", "customer", or "business unit".';
      if (!UI || typeof UI.modal !== 'function') {
        window.alert(fallbackMessage);
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const dialog = UI.modal({
        title: 'PoC data warning',
        body: `
          <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
            <p class="help-body-copy" style="margin:0">This platform is still a proof of concept. Do not enter real company data, customer data, incident details, or other live sensitive information.</p>
            <div class="help-mini-grid">
              <div class="help-mini-card"><strong>Use dummy scenarios</strong><p>Create example scenarios only. Keep them illustrative rather than operationally real.</p></div>
              <div class="help-mini-card"><strong>Keep names generic</strong><p>Use neutral terms such as <strong>supplier</strong>, <strong>customer</strong>, <strong>business unit</strong>, or <strong>service provider</strong> instead of real company names.</p></div>
            </div>
            <div class="banner banner--warning" role="alert"><span class="banner-icon">△</span><span class="banner-text">Treat this environment as a PoC sandbox, not as a live production record.</span></div>
          </div>
        `,
        footer: `<button class="btn btn--primary" id="btn-poc-login-ack" type="button">I Understand</button>`,
        onClose: finish
      });
      document.getElementById('btn-poc-login-ack')?.addEventListener('click', () => {
        finish();
        dialog.close();
      });
    });
  }

  const login = async () => {
    const username = document.getElementById('login-user').value;
    const pw = document.getElementById('login-pass').value;
    const result = await AuthService.login(username, pw);
    if (result.success) {
      await loadSharedUserState(result.user.username);
      activateAuthenticatedState();
      await showPocUsageNotice();
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
      <a href="#/admin/settings/feedback" data-admin-route="/admin/settings/feedback" class="admin-nav-link ${active==='settings' && activeSettingsSection==='feedback' ? 'active' : ''}">AI Feedback &amp; Tuning</a>
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
  const valueSummary = typeof ValueQuantService !== 'undefined'
    ? ValueQuantService.buildWorkspaceValueSummary(completedAssessments, {
        benchmarkSettings: settings.valueBenchmarkSettings
      })
    : null;

  setPage(window.AdminHomeSection.render({
    settings,
    companyStructure,
    assessments,
    completedAssessments,
    reviewQueue,
    companyEntities,
    departmentEntities,
    managedAccounts,
    preferredAdminRoute,
    docCount,
    valueSummary
  }));
  // Admins should land on a real home view, not be thrown directly into a settings subsection or wizard step.
  window.AdminHomeSection.bind({ preferredAdminRoute, managedAccounts });
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

function renderHelpMiniCards(cards = []) {
  return `<div class="help-mini-grid">
    ${cards.map(card => `<div class="help-mini-card"><strong>${escapeHtml(String(card.title || 'Item'))}</strong><p>${escapeHtml(String(card.body || ''))}</p></div>`).join('')}
  </div>`;
}

function renderHelpShortcutCards(cards = []) {
  return `<div class="help-shortcut-grid">
    ${cards.map(card => `<div class="help-shortcut-card"><strong>${escapeHtml(String(card.keys || 'Shortcut'))}</strong><span>${escapeHtml(String(card.label || 'Action'))}</span></div>`).join('')}
  </div>`;
}

function getCommonHelpContent() {
  return {
    navCopy: 'Use this guide as the shared assessment reference for the PoC. The assessment workflow is the same for everyone, and the final section adds the extra responsibilities and controls relevant to your current role.',
    heroCopy: 'This page starts with the common assessment workflow used across the platform, then adds the extra oversight or admin guidance relevant to your role. Use the shared sections first, then open the final role-specific section when you need the additional layer.',
    overviewAudienceCopy: 'Every role uses the same core assessment path: turn one real scenario into a challengeable quantified view, review it in executive and technical language, and decide what needs to happen next.',
    overviewUseCase: 'A user wants to understand whether one plausible disruption, control failure, third-party issue, or cyber event is material enough to explain, challenge, and escalate with evidence.',
    contextExample: 'If the saved organisation context says the business runs regulated digital services in the UAE, the platform can surface geography, regulatory, resilience, and customer-impact considerations earlier before the user adds scenario-specific detail.',
    pilotReadinessBody: 'Admins check the server-reported AI mode in Admin > System Access. If the platform is running in deterministic fallback or manual mode, treat that as continuity support rather than pilot-quality AI for important review sessions.',
    feedbackChangeBody: 'Repeated feedback improves retrieval, ranking, and prompt assembly in stages. Stronger shared changes should come only after the same live-AI pattern repeats often enough to justify it.',
    dashboardPurpose: 'Use the dashboard as the front door: resume active work, review what needs attention, and start something new only when you have one real scenario to work through.',
    dashboardBestUse: 'Resume the assessment that already needs attention first, then start a new one only when there is a clear new scenario to model.',
    stepChips: ['Dashboard', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Settings'],
    stepFinalCards: [
      { title: 'Review & Run', body: 'Challenge the assumptions that matter most, then run. This is the place to tighten the decision before quantification, not to restart the drafting stage.' },
      { title: 'Results', body: 'Read the executive story first, then open the technical detail only when you need to validate ranges, evidence, or drivers.' },
      { title: 'Settings', body: 'Keep the context and preferences you own current so future drafts, guidance, and review cues stay grounded.' }
    ],
    shortcutCards: [
      { keys: 'Alt/Option + N', label: 'Start a new assessment' },
      { keys: 'Alt/Option + R', label: 'Resume your current draft' },
      { keys: 'Alt/Option + 1 / 2 / 3', label: 'Switch results tabs' },
      { keys: 'Alt/Option + /', label: 'Open the shortcuts overlay' }
    ],
    shortcutHint: 'These are the shared shortcuts available across the common assessment workflow. Role-specific tools may add extra controls in the relevant workspace.'
  };
}

function getHelpAudienceModel({
  currentUser = AuthService.getCurrentUser(),
  isAdmin = currentUser?.role === 'admin',
  nonAdminCapability = null,
  roleSummary = ''
} = {}) {
  const roleMode = isAdmin
    ? 'global_admin'
    : nonAdminCapability?.canManageBusinessUnit && nonAdminCapability?.canManageDepartment
      ? 'bu_and_function'
      : nonAdminCapability?.canManageBusinessUnit
        ? 'bu_admin'
        : nonAdminCapability?.canManageDepartment
          ? 'function_admin'
          : 'standard_user';
  const businessUnitName = String(
    nonAdminCapability?.managedBusiness?.name
    || nonAdminCapability?.selectedBusiness?.name
    || 'your business unit'
  );
  const functionName = String(
    nonAdminCapability?.managedDepartment?.name
    || nonAdminCapability?.selectedDepartment?.name
    || 'your function'
  );
  const baseShortcuts = [
    { keys: 'Alt/Option + N', label: 'Start a new assessment' },
    { keys: 'Alt/Option + R', label: 'Resume your current draft' },
    { keys: 'Alt/Option + 1 / 2 / 3', label: 'Switch results tabs' },
    { keys: 'Alt/Option + /', label: 'Open the shortcuts overlay' }
  ];

  if (roleMode === 'global_admin') {
    return {
      roleMode,
      roleSummary: roleSummary || 'Global admin',
      navCopy: 'Use this guide as a platform-workbench reference: keep organisation structure, defaults, access, documents, and AI readiness aligned for everyone else.',
      heroCopy: 'This guide is tailored to the global admin workbench. It focuses on the controls you can actually use: keep the platform baseline current, verify pilot AI readiness, monitor AI feedback quality, and maintain the context and documents that shape downstream drafting and review.',
      overviewAudienceCopy: 'This workspace is for the people shaping how the platform behaves for everyone else, not just for drafting one assessment at a time.',
      overviewUseCase: 'A global admin needs to verify pilot AI readiness, update the document library, and adjust shared context before BU teams start a new round of assessments.',
      contextExample: 'If the global baseline says the organisation runs regulated digital services in the UAE, that governed context can shape downstream drafting and evidence priorities before a BU adds its own overlay.',
      pilotReadinessBody: 'Use Admin > System Access to check the server-reported AI mode before demos, pilot reviews, or sign-off sessions where AI quality matters. If the platform reports fallback or degraded mode, treat it as continuity support and not as pilot-quality AI.',
      feedbackChangeBody: 'Repeated live-AI feedback can eventually influence the global baseline, but only after enough corroborating signals and review. Use AI Feedback & Tuning to watch the signal quality before you let it affect everyone else.',
      dashboardPurpose: 'Use Platform Home as the admin front door, then move into the admin console only when you need to change structure, defaults, access, or AI readiness.',
      dashboardBestUse: 'Open the next admin workbench that needs attention, or preview the user workspace only when you need to understand the downstream impact of an admin change.',
      stepChips: ['Platform Home', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Admin'],
      stepFinalCards: [
        { title: 'Review & Run', body: 'Use this to challenge assumptions before a scenario becomes a shared reference point.' },
        { title: 'Results', body: 'Read the executive story first, then validate the technical detail and evidence layers if you need to defend the result.' },
        { title: 'Admin Console', body: 'Keep organisation structure, platform defaults, governance inputs, and the document library current because they shape what everyone else sees.' },
        { title: 'AI Feedback & Tuning', body: 'Use the feedback dashboard to monitor draft, shortlist, and per-risk ratings before you tune alignment, writing style, or shared-learning sensitivity.' },
        { title: 'Pilot AI Readiness', body: 'Verify the live AI path before sessions where AI quality matters. Local fallback should remain honest and calm, but not mistaken for pilot sign-off quality.' }
      ],
      shortcutCards: [
        { keys: 'Alt/Option + N', label: 'Start a new assessment' },
        { keys: 'Alt/Option + 1 / 2 / 3', label: 'Switch results tabs' },
        { keys: 'Alt/Option + F', label: 'Focus admin user search' },
        { keys: 'Alt/Option + /', label: 'Open the shortcuts overlay' }
      ],
      shortcutHint: 'The admin shortcut list stays focused on the platform workbench and review surfaces available in the admin experience.',
      roleSectionIntro: 'This section is tuned to the admin workbench rather than the end-user workflow.',
      roleSectionChips: ['Platform baseline', 'AI readiness', 'Downstream impact'],
      roleDisclosures: [
        {
          title: 'Your global admin view',
          summary: 'Use admin space as the governed workbench for everyone else.',
          body: `<p class="help-body-copy">Keep organisation structure, company context, platform defaults, governance inputs, access, and the document library current. These settings shape how the AI drafts, how grounded the output can become, and what downstream users inherit.</p>`
        },
        {
          title: 'A good operating rhythm for this role',
          summary: 'Verify the live path, review shared signal quality, then tune carefully.',
          body: `<div class="help-mini-grid">
            <div class="help-mini-card"><strong>Before demos or sign-off</strong><p>Open System Access first and confirm the server-reported AI mode. If the platform says fallback or degraded mode is active, treat the output as continuity support rather than pilot-quality AI.</p></div>
            <div class="help-mini-card"><strong>Before changing shared tuning</strong><p>Open AI Feedback &amp; Tuning and check whether the weak pattern is repeated, live-AI based, and broad enough to justify a shared change. Tune one parameter at a time.</p></div>
            <div class="help-mini-card"><strong>Before blaming the model</strong><p>Check document coverage, company context, platform defaults, and user access. Weak outputs can come from thin grounding or stale shared context as much as from prompt quality.</p></div>
          </div>`
        },
        {
          title: 'Creating managed pilot users',
          summary: 'How usernames, passwords, and common create-user issues work.',
          body: `<div class="help-mini-grid">
            <div class="help-mini-card"><strong>Display name in, username out</strong><p>Enter the person’s display name and the platform generates the username automatically. Punctuation such as spaces or hyphens is normalised into dots, so “Andy Ben-Dyke” becomes <code>andy.ben.dyke</code>.</p></div>
            <div class="help-mini-card"><strong>Passwords are issued for you</strong><p>The platform generates a random policy-compliant password automatically and shows it only in the current admin session. If you lose it later, use Reset Password from the same user table.</p></div>
            <div class="help-mini-card"><strong>If creation fails</strong><p>Read the full error text shown under the create-user form. Scope issues, duplicate usernames, or a missing admin action secret are more likely causes than punctuation in the display name.</p></div>
          </div>`
        },
        {
          title: 'What to avoid in this role',
          summary: 'Do not use the admin workbench as a substitute for the normal assessment workflow.',
          body: `<p class="help-body-copy">Use preview and oversight to understand the downstream impact of changes, but keep direct assessment work in the user workflow unless you are deliberately testing that experience.</p>`
        }
      ]
    };
  }

  if (roleMode === 'bu_and_function') {
    return {
      roleMode,
      roleSummary: roleSummary || 'BU and function leadership view',
      navCopy: 'Use this guide as an oversight reference: review what needs attention across the business unit, keep the owned function context current, and challenge results before escalation.',
      heroCopy: `This guide is tailored to the oversight workspace you actually have. It focuses on reviewing what needs attention across ${businessUnitName}, keeping ${functionName} current, and using results, reassessment, and evidence well before management decisions are made.`,
      overviewAudienceCopy: `This workspace is for people who need both a business-unit view and a function-level view, so the guidance should help you move between oversight and owned execution without losing focus.`,
      overviewUseCase: `A leader needs to understand whether a service disruption affects ${businessUnitName} broadly, what it means for ${functionName} directly, and whether the current controls or response need escalation now.`,
      contextExample: `Because both ${businessUnitName} and ${functionName} context are retained, the app can surface the operating assumptions, regulations, and control patterns that matter across both layers earlier in the draft.`,
      pilotReadinessBody: 'Global admins check the server-reported AI mode in Admin > System Access. If a step is running in deterministic fallback or manual mode, treat it as continuity support and not as sign-off-quality AI for your oversight decisions.',
      feedbackChangeBody: 'Your repeated feedback improves your own workflow first. When similar live-AI patterns repeat across other users, the same signal can later influence your function, your business unit, and the wider platform.',
      dashboardPurpose: `Use the active queue as an oversight lane for ${businessUnitName} first, then keep the owned function context for ${functionName} current before new work starts.`,
      dashboardBestUse: `Open the next item that needs review, revisit the reassessment lane when assumptions drift, and start new work only when a fresh issue clearly belongs in your owned scope.`,
      stepChips: ['Dashboard', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Settings'],
      stepFinalCards: [
        { title: 'Review & Run', body: 'Challenge the assumptions that most affect the business-unit decision and the owned-function response before you run.' },
        { title: 'Results', body: 'Use the executive view for the BU decision first, then open technical detail only when you need to validate evidence or ranges.' },
        { title: 'Managed Context In Settings', body: `Keep both ${businessUnitName} and ${functionName} context current because they shape future drafts, review guidance, and inherited assumptions.` },
        { title: 'Watchlist And Reassessment', body: 'Use the watchlist and reassessment lane to keep important scenarios current instead of letting stale results drift.' }
      ],
      shortcutCards: [
        ...baseShortcuts.slice(0, 2),
        { keys: 'Alt/Option + S', label: 'Open your settings and managed context' },
        ...baseShortcuts.slice(2)
      ],
      shortcutHint: 'These shortcuts stay focused on the oversight workspace and managed context available to your role.',
      roleSectionIntro: 'This section is tailored to the combination of oversight and owned-function access available in your current workspace.',
      roleSectionChips: ['Oversight', 'Managed context', 'Reassessment'],
      roleDisclosures: [
        {
          title: 'Your oversight and function view',
          summary: 'Move between BU oversight and owned-function action without losing the thread.',
          body: `<p class="help-body-copy">Prioritise queue items that need review across <strong>${escapeHtml(businessUnitName)}</strong>, then keep the owned context for <strong>${escapeHtml(functionName)}</strong> current so new assessments stay grounded. Use the executive result for the BU decision first, then decide whether the owned function needs a more direct follow-up action.</p>`
        },
        {
          title: 'What still sits outside your access',
          summary: 'Global defaults, platform-wide access, and the admin workbench remain separate.',
          body: `<p class="help-body-copy">Use the settings and oversight tools you own in the workspace. Platform-wide defaults, system access controls, and the admin console still sit with the global admin role unless they deliberately delegate or test them with you.</p>`
        }
      ]
    };
  }

  if (roleMode === 'bu_admin') {
    return {
      roleMode,
      roleSummary: roleSummary || 'BU admin',
      navCopy: 'Use this guide as a business-unit oversight reference: review what needs attention, keep BU context current, and decide when scenarios need escalation or reassessment.',
      heroCopy: `This guide is tailored to the business-unit workspace you actually have. It focuses on reviewing the live queue for ${businessUnitName}, keeping the BU and function context aligned, and using results, reassessment, and evidence well before management decisions are made.`,
      overviewAudienceCopy: `This workspace is for people responsible for the quality of context and decision support across ${businessUnitName}, not just for drafting one scenario at a time.`,
      overviewUseCase: `A BU owner wants to understand whether a supplier or resilience issue is becoming material for ${businessUnitName}, which assumptions matter most, and whether the next step is treatment, escalation, or a scheduled reassessment.`,
      contextExample: `Because ${businessUnitName} context is retained, the app can surface the operating assumptions, geography, regulations, and control themes that matter to that business unit earlier in the draft and results.`,
      pilotReadinessBody: 'Global admins check the server-reported AI mode in Admin > System Access. If your current step is running in deterministic fallback or manual mode, treat it as continuity support and not as pilot-quality AI for BU sign-off.',
      feedbackChangeBody: 'Your repeated feedback improves your own workflow first. When similar live-AI patterns repeat across other users, the same signal can later influence your business unit and the wider platform.',
      dashboardPurpose: `Use the active queue as the primary review lane for ${businessUnitName}, then keep the business-unit and function context aligned before new work starts.`,
      dashboardBestUse: 'Open the next item that needs review, use the watchlist and reassessment lane to keep important scenarios current, and start a new assessment only when a new issue clearly needs its own decision path.',
      stepChips: ['Dashboard', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Settings'],
      stepFinalCards: [
        { title: 'Review & Run', body: 'Challenge the assumptions that most affect the business-unit decision before you run.' },
        { title: 'Results', body: 'Use the executive result to decide whether the business unit needs review, escalation, or treatment now, then open technical detail only when you need to validate drivers or evidence.' },
        { title: 'Managed Context In Settings', body: `Keep ${businessUnitName} context and the function summaries beneath it current so downstream drafting and review stay grounded.` },
        { title: 'Watchlist And Reassessment', body: 'Use the watchlist and reassessment lane to keep important scenarios current instead of letting stale results drift.' }
      ],
      shortcutCards: [
        ...baseShortcuts.slice(0, 2),
        { keys: 'Alt/Option + S', label: 'Open your settings and managed context' },
        ...baseShortcuts.slice(2)
      ],
      shortcutHint: 'These shortcuts stay focused on the business-unit workspace and managed context available to your role.',
      roleSectionIntro: 'This section is tailored to the business-unit oversight access available in your current workspace.',
      roleSectionChips: ['Business-unit view', 'Managed context', 'Reassessment'],
      roleDisclosures: [
        {
          title: 'Your business-unit admin view',
          summary: 'Use the workspace as an oversight lane for the business unit, not as a generic reporting page.',
          body: `<p class="help-body-copy">Prioritise queue items that need review across <strong>${escapeHtml(businessUnitName)}</strong>, keep business-unit context aligned, and use the watchlist and reassessment lane to keep important scenarios current. Open technical detail only when you need to validate the drivers, ranges, or evidence behind a management decision.</p>`
        },
        {
          title: 'What still sits outside your access',
          summary: 'Global defaults and the platform workbench remain separate.',
          body: `<p class="help-body-copy">Use the settings and oversight tools you own in the workspace. Platform-wide defaults, system access controls, and the admin console still sit with the global admin role unless they deliberately delegate or test them with you.</p>`
        }
      ]
    };
  }

  if (roleMode === 'function_admin') {
    return {
      roleMode,
      roleSummary: roleSummary || 'Function admin',
      navCopy: 'Use this guide as a function-oversight reference: review what needs attention, keep owned context current, and challenge results before escalation.',
      heroCopy: `This guide is tailored to the function workspace you actually have. It focuses on reviewing what needs attention for ${functionName}, keeping the owned context current, and using results, reassessment, and evidence well before escalation or treatment decisions are made.`,
      overviewAudienceCopy: `This workspace is for people who own a function or department context and need to keep assessments credible for ${functionName}.`,
      overviewUseCase: `A function owner wants to understand whether a control or resilience issue could push ${functionName} outside tolerance, what assumptions are carrying the result, and what the function should do next.`,
      contextExample: `Because ${functionName} context is retained, the app can surface the controls, operating assumptions, and regulations most relevant to that function earlier in the draft and results.`,
      pilotReadinessBody: 'Global admins check the server-reported AI mode in Admin > System Access. If your current step is running in deterministic fallback or manual mode, treat it as continuity support and not as sign-off-quality AI for function-level review.',
      feedbackChangeBody: 'Your repeated feedback improves your own workflow first. When similar live-AI patterns repeat across other users, the same signal can later influence your function, your business unit, and the wider platform.',
      dashboardPurpose: `Use the active queue as the primary review lane for ${functionName}, then keep the owned function context current before new work starts.`,
      dashboardBestUse: 'Open the next function-level item that needs review, revisit the reassessment lane when assumptions drift, and start a new assessment only when a fresh issue clearly belongs to the function you own.',
      stepChips: ['Dashboard', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Settings'],
      stepFinalCards: [
        { title: 'Review & Run', body: 'Challenge the assumptions that most affect the function-level decision before you run.' },
        { title: 'Results', body: 'Use the executive result to decide what the function needs to do now, then open technical detail only when you need to validate drivers, ranges, or evidence.' },
        { title: 'Managed Context In Settings', body: `Keep ${functionName} context current because it shapes how future drafts, evidence cues, and review guidance land for your team.` },
        { title: 'Watchlist And Reassessment', body: 'Use the watchlist and reassessment lane to keep important function scenarios current instead of letting stale results drift.' }
      ],
      shortcutCards: [
        ...baseShortcuts.slice(0, 2),
        { keys: 'Alt/Option + S', label: 'Open your settings and managed context' },
        ...baseShortcuts.slice(2)
      ],
      shortcutHint: 'These shortcuts stay focused on the function workspace and managed context available to your role.',
      roleSectionIntro: 'This section is tailored to the function-level access available in your current workspace.',
      roleSectionChips: ['Function ownership', 'Managed context', 'Review lane'],
      roleDisclosures: [
        {
          title: 'Your function admin view',
          summary: 'Use the workspace as a function review lane, not as a generic dashboard.',
          body: `<p class="help-body-copy">Prioritise the assessments that need attention for <strong>${escapeHtml(functionName)}</strong>, keep the owned context current in settings, and use the executive result first when deciding what the function needs to do next. Open technical detail only when you need to validate ranges, evidence, or assumptions.</p>`
        },
        {
          title: 'When to involve BU or global admins',
          summary: 'Escalate when the issue or context change is broader than the owned function.',
          body: `<p class="help-body-copy">If the scenario crosses function boundaries, needs business-unit escalation, or depends on platform-wide defaults, document the function view clearly and then involve the relevant BU or global admin rather than trying to force the issue through function-only context.</p>`
        }
      ]
    };
  }

  return {
    roleMode,
    roleSummary: roleSummary || 'Standard user',
    navCopy: 'Use this guide as a working reference for the assessment flow you can actually run: start, refine, estimate, review, and export.',
    heroCopy: 'This guide is tailored to the standard-user workspace. It focuses on the actions you can actually take directly: build one clear scenario, check confidence and evidence, and hand off decisions with a clean management story.',
    overviewAudienceCopy: 'This workspace is for people drafting, refining, and explaining a scenario they directly support.',
    overviewUseCase: 'A risk analyst wants to understand whether a supplier insolvency could create a material exposure, what assumptions are carrying the estimate, and whether the escalation case is strong enough to share.',
    contextExample: 'If your saved context says you support regulated digital services in the UAE, the app will surface geography, regulatory, resilience, and customer-impact considerations earlier than it would for a non-regulated internal-only service.',
    pilotReadinessBody: 'Admins check the server-reported AI mode in Admin > System Access. If your current step is running in deterministic fallback or manual mode, treat it as continuity support and ask for a live server mode when AI quality matters.',
    feedbackChangeBody: 'Your repeated feedback shapes your own guidance first. When similar live-AI patterns repeat across other users, the same signal can later influence function, BU, and wider platform behaviour.',
    dashboardPurpose: 'Know what to do next. Resume your draft or open the latest result that needs your attention before starting something new.',
    dashboardBestUse: 'Resume your current draft, reopen a result that needs explanation, or start a new assessment when you have one real scenario to work through.',
    stepChips: ['Dashboard', 'Step 1', 'Step 2', 'Step 3', 'Review & Run', 'Results', 'Settings'],
    stepFinalCards: [
      { title: 'Review & Run', body: 'Challenge the assumptions that matter most, then run. Do not turn this into another writing stage.' },
      { title: 'Results', body: 'Read the executive story first, then open technical detail only when you need to explain or challenge the result.' },
      { title: 'Personal Settings', body: 'Use settings to shape how the assistant helps you and to keep your personal working context current.' }
    ],
    shortcutCards: [
      ...baseShortcuts.slice(0, 2),
      { keys: 'Alt/Option + S', label: 'Open personal settings' },
      ...baseShortcuts.slice(2)
    ],
    shortcutHint: 'These shortcuts stay focused on the personal workspace available to your role.',
    roleSectionIntro: 'This section is tailored to the standard-user workflow rather than the admin or oversight workbench.',
    roleSectionChips: ['Your workflow', 'Personal settings', 'Escalation path'],
    roleDisclosures: [
      {
        title: 'Your standard user view',
        summary: 'Draft, estimate, review, and escalate with evidence.',
        body: `<p class="help-body-copy">Focus on getting one good scenario through the workflow, using your settings to shape how the assistant helps you, and escalating results only after checking confidence, evidence posture, and whether the story is clear enough for someone else to challenge.</p>`
      },
      {
        title: 'What stays outside your current access',
        summary: 'Managed BU/function context and the admin workbench remain separate.',
        body: `<p class="help-body-copy">Use the workflow and personal settings you own directly. Business-unit context, function context, system access checks, and the admin console are maintained by the relevant owners and global admins rather than by the standard-user workspace.</p>`
      }
    ]
  };
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
  const commonHelp = getCommonHelpContent();
  const helpAudience = getHelpAudienceModel({ currentUser, isAdmin, nonAdminCapability, roleSummary });

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
            <p class="help-body-copy">This platform is for structured risk decisions, not generic brainstorming. ${escapeHtml(commonHelp.overviewAudienceCopy)}</p>
            ${renderHelpMiniCards([
              { title: 'Good fit', body: 'Cyber, resilience, vendor, control-failure, disruption, compliance, and third-party scenarios where management needs a defendable view of exposure and next steps.' },
              { title: 'What you get', body: 'A structured scenario, a plain-language estimate, Monte Carlo output, executive and technical results, treatment comparison, and exportable decision artefacts.' }
            ])}
            ${renderHelpExample({
              title: 'A realistic use case',
              body: commonHelp.overviewUseCase
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
        }),
        renderHelpDisclosure('overview', {
          title: 'PoC-only data handling',
          summary: 'Use dummy scenarios and generic labels only.',
          body: `
            ${renderHelpMiniCards([
              { title: 'Do use', body: 'Illustrative scenarios with generic labels such as supplier, customer, service provider, business unit, or operating site.' },
              { title: 'Do not use', body: 'Real company names, customer names, live incident details, regulated data, or other sensitive operational information.' }
            ])}
            ${renderHelpCallout({
              tone: 'mistake',
              title: 'Practical rule',
              body: 'Treat this environment as a PoC sandbox. Build dummy scenarios only. If you need to describe a third party, say “supplier” rather than naming the real company.'
            })}
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
            ${renderHelpMiniCards([
              { title: 'Primary grounding', body: 'The strongest named source or context basis carrying a draft or result.' },
              { title: 'Supporting references', body: 'Additional retrieved or attached material that helps explain or support the current framing.' },
              { title: 'Provenance', body: 'A trace of where the current wording, estimate, or assumption came from: user input, AI suggestion, benchmark, uploaded document, or inherited context.' }
            ])}
            ${renderHelpExample({
              title: 'How company context shapes output',
              body: commonHelp.contextExample
            })}
          `
        }),
        renderHelpDisclosure('context', {
          title: 'How live AI and fallback behave in pilot',
          summary: 'Pilot-quality AI requires a verified live path; fallback keeps the workflow moving but should be treated differently.',
          body: `
            ${renderHelpMiniCards([
              { title: 'Live server mode', body: 'Use this state when Admin > System Access reports live mode from a server-side health check. This is the right state for pilot-quality AI review, provided the evidence and assumptions still hold up.' },
              { title: 'Fallback or degraded mode', body: 'The workflow may still continue, but the platform is no longer reporting a live server path. Treat this as continuity support, not as pilot-quality AI sign-off.' },
              { title: 'Who checks it', body: commonHelp.pilotReadinessBody }
            ])}
            ${renderHelpCallout({
              tone: 'trust',
              title: 'Practical rule for pilot and staging',
              body: 'If AI quality matters for the current session, confirm the server-reported mode first. If the platform says fallback or degraded mode is active, do not treat the AI output as equivalent to a live server run.'
            })}
          `
        }),
        renderHelpDisclosure('context', {
          title: 'How feedback improves AI over time',
          summary: 'Ratings improve retrieval and ranking in tiers; they do not instantly retrain the model.',
          body: `
            ${renderHelpMiniCards([
              { title: 'What you rate', body: 'In Step 1, rate the generated scenario draft and generated shortlist on a 1-5 scale, then add short reason tags if the issue was wrong domain, weak citations, missed risks, unrelated risks, or generic wording.' },
              { title: 'What changes first', body: commonHelp.feedbackChangeBody },
              { title: 'What the platform learns', body: 'The app uses repeated signals to improve retrieval relevance, shortlist ordering, and prompt/context priors. It does not treat every single rating as instant model retraining.' }
            ])}
            ${renderHelpCallout({
              tone: 'trust',
              title: 'What this does not mean',
              body: 'Saving feedback does not retrain the base model in real time. The platform is learning around the model first by changing retrieval, ranking, and prompt assembly. True model training, if introduced later, should come only from reviewed and curated feedback data.'
            })}
            ${renderHelpCallout({
              tone: 'best',
              title: 'Important guardrail',
              body: 'Live-AI feedback and fallback-mode feedback are tracked separately. Fallback keeps the workflow moving, but it does not automatically become shared pilot-quality learning for everyone.'
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
      chips: commonHelp.stepChips,
      disclosures: [
        renderHelpDisclosure('steps', {
          title: 'Dashboard',
          summary: 'Start, resume, review, and keep an eye on what needs attention.',
          body: `
            <p class="help-body-copy"><strong>Purpose:</strong> ${escapeHtml(commonHelp.dashboardPurpose)}</p>
            <p class="help-body-copy"><strong>Common mistake:</strong> treating the dashboard as a reporting page. It is a front door and oversight lane, not the place to inspect every detail.</p>
            ${renderHelpExample({
              title: 'Best use',
              body: commonHelp.dashboardBestUse
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
          title: 'Review & Run, Results, and Settings',
          summary: 'How to use the final assessment stages well before opening the role-specific add-on guidance below.',
          body: `
            ${renderHelpMiniCards(commonHelp.stepFinalCards)}
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
            ${renderHelpShortcutCards(commonHelp.shortcutCards)}
            <div class="flex items-center gap-3" style="margin-top:var(--sp-4);flex-wrap:wrap">
              <button type="button" class="btn btn--secondary btn--sm" data-open-shortcuts-help>Open shortcuts overlay</button>
              <span class="form-help">${escapeHtml(commonHelp.shortcutHint)} Drafts and settings save automatically. Watch the save and sync cues rather than repeatedly hunting for a manual save button.</span>
            </div>
          `
        })
      ]
    }),
    renderHelpSection({
      id: 'roles',
      title: 'Role-specific help',
      summary: 'What good use looks like by role',
      intro: `Everything above is shared assessment guidance. ${helpAudience.roleSectionIntro}`,
      chips: helpAudience.roleSectionChips,
      disclosures: helpAudience.roleDisclosures.map((disclosure, index) => renderHelpDisclosure('roles', {
        title: disclosure.title,
        summary: disclosure.summary,
        open: index === 0,
        body: disclosure.body
      }))
    })
  ];

  setPage(`
    <main class="page help-page">
      <div class="container help-shell">
        <aside class="help-nav card">
          <div class="help-nav__kicker">Help</div>
          <div class="help-nav__title">Risk Intelligence guide</div>
          <div class="help-nav__copy">${escapeHtml(commonHelp.navCopy)}</div>
          <div class="help-nav__role">
            <span class="badge badge--neutral">${escapeHtml(helpAudience.roleSummary)}</span>
            <span class="form-help">Common assessment guidance first, role-specific guidance last</span>
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
                <p class="help-hero__copy">${escapeHtml(commonHelp.heroCopy)}</p>
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

const FloatingActionDisclosureController = (() => {
  let isBound = false;
  let activeDisclosure = null;
  let backdropEl = null;
  const WIDE_MENU_SELECTOR = '.dashboard-hero-overflow, .dashboard-row-overflow, .admin-footer-overflow, .admin-frontdoor-overflow';

  function ensureBackdrop() {
    const host = getFloatingDisclosureHost();
    if (backdropEl && backdropEl.parentNode !== host) host.appendChild(backdropEl);
    if (backdropEl && host.contains(backdropEl)) return backdropEl;
    backdropEl = document.createElement('div');
    backdropEl.className = 'results-actions-disclosure-backdrop';
    backdropEl.setAttribute('aria-hidden', 'true');
    host.appendChild(backdropEl);
    return backdropEl;
  }

  function showBackdrop() {
    const backdrop = ensureBackdrop();
    backdrop.hidden = false;
  }

  function hideBackdrop() {
    if (!backdropEl) return;
    backdropEl.hidden = true;
  }

  function getFloatingDisclosureHost() {
    return document.querySelector('main.page') || document.getElementById('main-content') || document.body;
  }

  function getMenuState(disclosure) {
    return disclosure?._floatingActionMenuState || null;
  }

  function clearFloatingMenu(disclosure, { removeOnly = false } = {}) {
    const state = getMenuState(disclosure);
    if (!state) return;
    const { menu, originalParent, originalNextSibling } = state;
    menu.classList.remove('results-actions-disclosure-menu--floating');
    delete menu.dataset.menuPlacement;
    delete menu.dataset.menuVariant;
    menu.style.removeProperty('top');
    menu.style.removeProperty('left');
    menu.style.removeProperty('maxHeight');
    menu.style.removeProperty('visibility');
    if (!removeOnly && originalParent && originalParent.isConnected) {
      if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(menu, originalNextSibling);
      } else {
        originalParent.appendChild(menu);
      }
    } else {
      menu.remove();
    }
    delete disclosure._floatingActionMenuState;
    delete disclosure.dataset.menuPlacement;
    delete disclosure.dataset.floatingMenu;
  }

  function setActiveDisclosure(disclosure) {
    if (activeDisclosure && activeDisclosure !== disclosure) {
      if (activeDisclosure.isConnected && activeDisclosure.open) {
        activeDisclosure.open = false;
      } else {
        clearFloatingMenu(activeDisclosure, { removeOnly: true });
      }
    }
    activeDisclosure = disclosure;
  }

  function closeActiveDisclosure({ restoreFocus = false } = {}) {
    const disclosure = activeDisclosure;
    if (!disclosure) return;
    activeDisclosure = null;
    hideBackdrop();
    if (disclosure.isConnected && disclosure.open) {
      disclosure.open = false;
    } else {
      clearFloatingMenu(disclosure, { removeOnly: true });
    }
    if (restoreFocus && disclosure.isConnected) {
      disclosure.querySelector('summary')?.focus();
    }
  }

  function getMenuVariant(disclosure) {
    return disclosure.matches(WIDE_MENU_SELECTOR) ? 'wide' : 'default';
  }

  function ensureFloatingMenu(disclosure) {
    const existing = getMenuState(disclosure);
    if (existing?.menu?.isConnected) return existing.menu;
    const menu = disclosure.querySelector('.results-actions-disclosure-menu');
    if (!menu) return null;
    disclosure._floatingActionMenuState = {
      menu,
      originalParent: menu.parentNode,
      originalNextSibling: menu.nextSibling
    };
    menu.classList.add('results-actions-disclosure-menu--floating');
    menu.dataset.menuVariant = getMenuVariant(disclosure);
    getFloatingDisclosureHost().appendChild(menu);
    disclosure.dataset.floatingMenu = 'true';
    return menu;
  }

  function updateActiveDisclosurePosition() {
    const disclosure = activeDisclosure;
    if (!disclosure || !disclosure.open) return;
    const menu = ensureFloatingMenu(disclosure);
    const summary = disclosure.querySelector('summary');
    if (!menu || !summary) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = 8;
    const summaryRect = summary.getBoundingClientRect();
    const maxHeight = Math.max(160, viewportHeight - (gap * 2));

    menu.style.maxHeight = `${Math.round(maxHeight)}px`;
    menu.style.visibility = 'hidden';

    const measuredWidth = Math.max(menu.offsetWidth, Math.ceil(menu.getBoundingClientRect().width || 0), 180);
    const measuredHeight = Math.min(menu.scrollHeight || menu.offsetHeight || 0, maxHeight);
    const spaceBelow = viewportHeight - summaryRect.bottom - gap;
    const spaceAbove = summaryRect.top - gap;
    const placement = spaceBelow < measuredHeight && spaceAbove > spaceBelow ? 'up' : 'down';
    const left = Math.min(
      Math.max(gap, summaryRect.right - measuredWidth),
      Math.max(gap, viewportWidth - measuredWidth - gap)
    );
    const preferredTop = placement === 'up'
      ? summaryRect.top - measuredHeight - gap
      : summaryRect.bottom + gap;
    const top = Math.min(
      Math.max(gap, preferredTop),
      Math.max(gap, viewportHeight - measuredHeight - gap)
    );

    disclosure.dataset.menuPlacement = placement;
    menu.dataset.menuPlacement = placement;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.visibility = '';
  }

  function bindDocumentEvents() {
    if (isBound || typeof document === 'undefined') return;
    isBound = true;

    document.addEventListener('pointerdown', event => {
      if (!activeDisclosure) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const activeMenu = getMenuState(activeDisclosure)?.menu;
      if (activeMenu?.contains(target)) return;
      if (activeDisclosure.contains(target)) return;
      closeActiveDisclosure();
    }, true);

    document.addEventListener('click', event => {
      if (!activeDisclosure) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const activeMenu = getMenuState(activeDisclosure)?.menu;
      const actionTarget = target.closest('button, a, [role="menuitem"]');
      if (!actionTarget || !activeMenu?.contains(actionTarget)) return;
      window.setTimeout(() => {
        if (activeDisclosure) closeActiveDisclosure();
      }, 0);
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !activeDisclosure) return;
      event.preventDefault();
      closeActiveDisclosure({ restoreFocus: true });
    }, true);

    window.addEventListener('resize', () => {
      if (!activeDisclosure) return;
      updateActiveDisclosurePosition();
    });

    window.addEventListener('scroll', () => {
      if (!activeDisclosure) return;
      updateActiveDisclosurePosition();
    }, true);
  }

  function bindDisclosure(disclosure) {
    if (!disclosure || disclosure.dataset.floatingDisclosureBound === 'true') return;
    disclosure.dataset.floatingDisclosureBound = 'true';
    disclosure.addEventListener('toggle', () => {
      if (disclosure.open) {
        setActiveDisclosure(disclosure);
        showBackdrop();
        ensureFloatingMenu(disclosure);
        updateActiveDisclosurePosition();
        return;
      }
      if (activeDisclosure === disclosure) activeDisclosure = null;
      clearFloatingMenu(disclosure);
      if (!activeDisclosure) hideBackdrop();
    });
  }

  function bind(root = document) {
    bindDocumentEvents();
    if (activeDisclosure && !activeDisclosure.isConnected) {
      clearFloatingMenu(activeDisclosure, { removeOnly: true });
      activeDisclosure = null;
      hideBackdrop();
    }
    root.querySelectorAll('.results-actions-disclosure').forEach(bindDisclosure);
  }

  return { bind };
})();

function bindDisclosureState(root = document) {
  root.querySelectorAll('details[data-disclosure-state-key]').forEach(section => {
    const key = section.dataset.disclosureStateKey;
    if (!key || section.dataset.disclosureStateBound === 'true') return;
    section.dataset.disclosureStateBound = 'true';
    section.addEventListener('toggle', () => {
      AppState.disclosureState[key] = section.open;
    });
  });
  FloatingActionDisclosureController.bind(root);
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
  const run = () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      callback();
    }, delay);
  };
  run.cancel = () => {
    window.clearTimeout(timeoutId);
    timeoutId = null;
  };
  return run;
}

function bindAutosave(container, callback, { events = ['input', 'change'] } = {}) {
  if (!container || typeof callback !== 'function') return () => {};
  let active = true;
  const run = createDebouncedSaver(() => {
    if (!active || !container.isConnected) return;
    callback();
  });
  const listeners = events.map(eventName => {
    const handler = event => {
      if (!active || !container.isConnected) return;
      if (!event.target || !(event.target instanceof HTMLElement)) return;
      if (event.target.closest('.tag-input-chip button')) return;
      run();
    };
    container.addEventListener(eventName, handler);
    return { eventName, handler };
  });
  return () => {
    active = false;
    run.cancel?.();
    listeners.forEach(({ eventName, handler }) => container.removeEventListener(eventName, handler));
  };
}

let activeAdminSettingsRenderToken = 0;

function renderAdminSettings(activeSection = 'org') {
  if (!requireAdmin()) return;
  const renderToken = ++activeAdminSettingsRenderToken;
  const settings = getAdminSettings();
  const companyStructure = Array.isArray(settings.companyStructure) ? [...settings.companyStructure] : [];
  const entityContextLayers = Array.isArray(settings.entityContextLayers) ? [...settings.entityContextLayers] : [];
  const entityObligations = Array.isArray(settings.entityObligations) ? cloneSerializableState(settings.entityObligations, []) : [];
  const companyContextSections = settings.companyContextSections || buildCompanyContextSections({
    companySummary: settings.adminContextSummary || '',
    businessProfile: settings.companyContextProfile || ''
  });
  const sessionLLM = getSessionLLMConfig();
  const localDevMode = isLocalDevAiRuntimeConfigAllowed();
  const runtimeStatus = typeof LLMService !== 'undefined' && LLMService && typeof LLMService.getRuntimeStatus === 'function'
    ? LLMService.getRuntimeStatus()
    : null;
  const serverStatus = typeof LLMService !== 'undefined'
    && LLMService
    && typeof LLMService.getCachedServerAiStatus === 'function'
    ? LLMService.getCachedServerAiStatus()
    : null;
  const buCount = getBUList().length;
  const docCount = getDocList().length;
  const managedAccounts = getManagedAccountsForAdmin(settings);
  const companyEntities = companyStructure.filter(node => isCompanyEntityType(node.type));
  const departmentEntities = companyStructure.filter(node => isDepartmentEntityType(node.type));
  const settingsSectionMeta = window.AdminSettingsSection.SETTINGS_SECTION_META;
  const currentSettingsSection = setPreferredAdminSection(settingsSectionMeta[activeSection] ? activeSection : getPreferredAdminSection());
  const orgSetupSections = AdminOrgSetupSection.renderSections({
    companyEntities,
    departmentEntities,
    companyStructure,
    entityObligations
  });
  const companyBuilderSection = window.AdminSettingsSection.renderCompanyBuilderSection({ settings, companyContextSections });
  const platformDefaultsSection = AdminPlatformDefaultsSection.renderSection({ settings, mode: 'defaults' });
  const governanceSection = AdminPlatformDefaultsSection.renderSection({ settings, mode: 'governance' });
  const feedbackSection = typeof AdminAiFeedbackSection !== 'undefined' && AdminAiFeedbackSection && typeof AdminAiFeedbackSection.renderSection === 'function'
    ? AdminAiFeedbackSection.renderSection({ settings })
    : renderSettingsSection({
        title: 'AI Feedback & Tuning',
        scope: 'admin-settings',
        description: 'The AI feedback workbench is temporarily unavailable.',
        meta: 'Unavailable',
        body: '<div class="form-help">Reload the page to restore the feedback workbench.</div>'
      });
  const systemAccessSection = AdminSystemAccessSection.renderSection({
    localDevMode,
    sessionLLM,
    runtimeStatus,
    serverStatus
  });
  const auditCache = AppState.auditLogCache || { loaded: false, loading: false, entries: [], summary: null, error: '', lastLoadedAt: 0 };
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
    feedback: feedbackSection,
    access: systemAccessSection,
    users: userControlsSection,
    audit: auditLogSection
  }[currentSettingsSection] || orgSetupSections;

  const adminGuidanceCopy = window.AdminSettingsSection.getAdminGuidanceCopy(currentSettingsSection);
  const platformSnapshotMarkup = window.AdminSettingsSection.renderPlatformSnapshot({
    companyEntities,
    departmentEntities,
    entityContextLayers,
    buCount,
    docCount
  });

  setPage(window.AdminSettingsSection.renderSettingsShell({
    currentSettingsSection,
    settingsSectionMeta,
    adminSectionBody,
    adminGuidanceCopy,
    platformSnapshotMarkup,
    settings
  }));
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
  const obligationSummaryEl = currentSettingsSection === 'org' ? document.getElementById('admin-obligation-summary-list') : null;
  const profileEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-profile') : null;
  const websiteEl = currentSettingsSection === 'company' ? document.getElementById('admin-company-url') : null;

  AdminOrgSetupSection.configure({
    companyStructure,
    entityContextLayers,
    entityObligations,
    regsInput,
    profileEl,
    websiteEl,
    structureSummaryEl,
    layerSummaryEl,
    obligationSummaryEl
  });

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
    const benchmarkDomains = typeof ValueQuantService !== 'undefined'
      ? ValueQuantService.getBenchmarkDomains()
      : [];
    const valueBenchmarkSettings = typeof ValueQuantService !== 'undefined'
      ? ValueQuantService.normaliseBenchmarkSettings({
          internalHourlyRatesUsd: benchmarkDomains.reduce((acc, domain) => {
            acc[domain.key] = getNumericValue(
              `admin-value-internal-${domain.key}`,
              currentSettings.valueBenchmarkSettings?.internalHourlyRatesUsd?.[domain.key]
                || DEFAULT_ADMIN_SETTINGS.valueBenchmarkSettings?.internalHourlyRatesUsd?.[domain.key]
                || 0
            );
            return acc;
          }, {}),
          externalDayRatesUsd: benchmarkDomains.reduce((acc, domain) => {
            acc[domain.key] = getNumericValue(
              `admin-value-external-${domain.key}`,
              currentSettings.valueBenchmarkSettings?.externalDayRatesUsd?.[domain.key]
                || DEFAULT_ADMIN_SETTINGS.valueBenchmarkSettings?.externalDayRatesUsd?.[domain.key]
                || 0
            );
            return acc;
          }, {})
        })
      : currentSettings.valueBenchmarkSettings;
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
        entityObligations,
        defaultLinkMode: document.getElementById('admin-link-mode') ? document.getElementById('admin-link-mode').value === 'yes' : !!currentSettings.defaultLinkMode,
        toleranceThresholdUsd,
        warningThresholdUsd,
        annualReviewThresholdUsd,
        riskAppetiteStatement: getInputValue('admin-appetite', currentSettings.riskAppetiteStatement || DEFAULT_ADMIN_SETTINGS.riskAppetiteStatement) || DEFAULT_ADMIN_SETTINGS.riskAppetiteStatement,
        applicableRegulations: regsInput?.getTags ? regsInput.getTags() : (Array.isArray(currentSettings.applicableRegulations) ? currentSettings.applicableRegulations : [...DEFAULT_ADMIN_SETTINGS.applicableRegulations]),
        typicalDepartments: typicalDepartmentsInput?.getTags ? typicalDepartmentsInput.getTags() : getTypicalDepartments(currentSettings),
        aiInstructions: getInputValue('admin-ai-instructions', currentSettings.aiInstructions || ''),
        benchmarkStrategy: getInputValue('admin-benchmark-strategy', currentSettings.benchmarkStrategy || DEFAULT_ADMIN_SETTINGS.benchmarkStrategy) || DEFAULT_ADMIN_SETTINGS.benchmarkStrategy,
        aiFeedbackTuning: normaliseAiFeedbackTuning({
          alignmentPriority: getInputValue('admin-ai-alignment-priority', currentSettings.aiFeedbackTuning?.alignmentPriority || DEFAULT_AI_FEEDBACK_TUNING.alignmentPriority),
          draftStyle: getInputValue('admin-ai-draft-style', currentSettings.aiFeedbackTuning?.draftStyle || DEFAULT_AI_FEEDBACK_TUNING.draftStyle),
          shortlistDiscipline: getInputValue('admin-ai-shortlist-discipline', currentSettings.aiFeedbackTuning?.shortlistDiscipline || DEFAULT_AI_FEEDBACK_TUNING.shortlistDiscipline),
          learningSensitivity: getInputValue('admin-ai-learning-sensitivity', currentSettings.aiFeedbackTuning?.learningSensitivity || DEFAULT_AI_FEEDBACK_TUNING.learningSensitivity)
        }),
        adminContextSummary: getInputValue('admin-context-summary', currentSettings.adminContextSummary || DEFAULT_ADMIN_SETTINGS.adminContextSummary) || DEFAULT_ADMIN_SETTINGS.adminContextSummary,
        adminContextVisibleToUsers: document.getElementById('admin-context-visible-users') ? document.getElementById('admin-context-visible-users').checked : currentSettings.adminContextVisibleToUsers !== false,
        escalationGuidance: getInputValue('admin-escalation-guidance', currentSettings.escalationGuidance || DEFAULT_ADMIN_SETTINGS.escalationGuidance) || DEFAULT_ADMIN_SETTINGS.escalationGuidance,
        valueBenchmarkSettings
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
    if (renderToken !== activeAdminSettingsRenderToken) return false;
    const { warningThresholdUsd, toleranceThresholdUsd, annualReviewThresholdUsd, payload } = buildAdminSettingsPayload();
    if (warningThresholdUsd > toleranceThresholdUsd) return false;
    if (annualReviewThresholdUsd < toleranceThresholdUsd) return false;
    const saved = await saveAdminSettings(payload, { renderToken });
    if (!saved) return false;
    if (renderToken !== activeAdminSettingsRenderToken) return false;
    if (!AppState.draft.geography) AppState.draft.geography = getAdminSettings().geography;
    saveDraft();
    if (showToast) UI.toast('Settings saved.', 'success');
    return true;
  }

  const adminSettingsRoot = document.querySelector('.settings-shell');
  let adminAutosaveArmed = false;
  window.requestAnimationFrame(() => {
    if (renderToken === activeAdminSettingsRenderToken) adminAutosaveArmed = true;
  });
  const disposeAdminSettingsAutosave = bindAutosave(adminSettingsRoot, () => {
    if (!adminAutosaveArmed || renderToken !== activeAdminSettingsRenderToken) return;
    void persistAdminSettings(false);
  });
  window.AppShellPage?.registerCleanup?.(disposeAdminSettingsAutosave);





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
  if (currentSettingsSection === 'company') {
    window.AdminCompanyContextController.create({
      websiteEl,
      profileEl,
      regsInput
    }).bind();
  }
  if (currentSettingsSection === 'access') {
    AdminSystemAccessSection.bind({ rerenderCurrentAdminSection });
  }

  if (currentSettingsSection === 'feedback' && typeof AdminAiFeedbackSection !== 'undefined' && AdminAiFeedbackSection && typeof AdminAiFeedbackSection.bind === 'function') {
    AdminAiFeedbackSection.bind({ settings, rerenderCurrentAdminSection });
  }


  if (currentSettingsSection === 'org') {
    AdminOrgSetupSection.bind({
      companyStructure,
      entityContextLayers,
      entityObligations,
      regsInput,
      profileEl,
      websiteEl,
      structureSummaryEl,
      layerSummaryEl,
      obligationSummaryEl
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
      setPage(`<main class="page"><div class="container" style="padding:var(--sp-12)"><div class="card"><h2>Admin Screen Error</h2><p style="margin-top:8px;color:var(--text-muted)">The selected admin screen could not be opened. Return to Organisation Setup and try again.</p><div class="form-help mt-4">The platform logged the technical failure server-side or in the browser console for follow-up.</div><div class="flex items-center gap-3 mt-6"><a class="btn btn--primary" href="#/admin/settings/org">Open Organisation Setup</a><a class="btn btn--ghost" href="#/admin/home">Platform Home</a></div></div></div></main>`);
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
  if (!RAGService.isReady() && getDocList().length === 0) {
    console.warn('RAGService initialised with zero documents. Add documents via Admin > Document Library.');
  }
  BenchmarkService.init(AppState.benchmarkList);
  activateAuthenticatedState();
  bindLiveTimestampTicker();
  bindWorkspaceStorageSync();
  bindServerContextRefresh();
  bindCrossTabSync();

  window.AppRoutes.register(Router);

  Router.init();
}

document.addEventListener('DOMContentLoaded', init);
