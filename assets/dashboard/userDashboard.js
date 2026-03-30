function buildWatchlistDeltaLine(item) {
  const parts = [];
  const prevPosture = String(item.previousPosture || '').trim();
  const currentPosture = String(item.badgeLabel || item.urgencyLabel || '').trim();
  if (prevPosture && currentPosture && prevPosture !== currentPosture) {
    parts.push(`Posture shifted from ${prevPosture} to ${currentPosture}.`);
  }
  const reviewAge = String(item.reviewAgeLabel || '').trim();
  if (reviewAge) parts.push(`Last reviewed: ${reviewAge}.`);
  const confChange = String(item.confidenceChange || '').trim();
  if (confChange) parts.push(confChange);
  if (!parts.length) return '';
  return parts.slice(0, 2).join(' ');
}

function renderUserDashboard() {
  if (!requireAuth()) return;
  if (AuthService.isAdminAuthenticated()) {
    Router.navigate(getDefaultRouteForCurrentUser());
    return;
  }
  OrgIntelligenceService?.refresh?.().catch?.(() => {});

  const settings = getUserSettings();
  if (!settings.onboardedAt) {
    renderUserOnboarding(settings);
    return;
  }

  const user = AppState.currentUser || AuthService.getCurrentUser();
  const globalSettings = getAdminSettings();
  const profile = normaliseUserProfile(settings.userProfile, user);
  const capability = getNonAdminCapabilityState(user, settings, globalSettings);
  const isOversightUser = capability.canManageBusinessUnit || capability.canManageDepartment;
  const allAssessments = getAssessments();
  const assessments = allAssessments
    .filter(a => deriveAssessmentLifecycleStatus(a) !== ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED)
    .slice()
    .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime());
  const archivedAssessments = allAssessments
    .filter(a => deriveAssessmentLifecycleStatus(a) === ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED)
    .slice()
    .sort((a, b) => new Date(b.archivedAt || b.completedAt || b.createdAt || 0).getTime() - new Date(a.archivedAt || a.completedAt || a.createdAt || 0).getTime())
    .slice(0, 6);
  const completedAssessments = assessments.filter(item => item?.results);
  const recentAssessments = assessments.slice(0, 4);
  const latestAssessment = recentAssessments[0] || null;
  const compactRecentAssessments = assessments.slice(0, 3);
  const draftTitle = String(AppState.draft?.scenarioTitle || AppState.draft?.narrative || '').trim();
  const hasDraft = Boolean(draftTitle);
  const draftLifecycle = getAssessmentLifecyclePresentation(AppState.draft || {});
  const focusAreas = Array.isArray(profile.focusAreas) ? profile.focusAreas.filter(Boolean) : [];
  const normaliseDashboardScenarioKey = value => String(normaliseScenarioSeedText(value || ''))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(suggested draft|draft|scenario|assessment|risk)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const buildScenarioTokenSet = value => new Set(
    normaliseDashboardScenarioKey(value)
      .split(' ')
      .filter(token => token.length >= 4)
  );
  const hasMeaningfulScenarioOverlap = (left, right) => {
    const leftTokens = buildScenarioTokenSet(left);
    const rightTokens = buildScenarioTokenSet(right);
    if (!leftTokens.size || !rightTokens.size) return false;
    let overlap = 0;
    leftTokens.forEach(token => {
      if (rightTokens.has(token)) overlap += 1;
    });
    return overlap >= 2 || (overlap >= 1 && Math.min(leftTokens.size, rightTokens.size) <= 2);
  };
  const draftScenarioSignature = hasDraft
    ? {
        id: String(AppState.draft?.id || '').trim(),
        title: draftTitle,
        risks: new Set((Array.isArray(AppState.draft?.selectedRiskIds) ? AppState.draft.selectedRiskIds : []).filter(Boolean).map(String)),
        buName: String(AppState.draft?.buName || profile.businessUnit || user?.businessUnit || '').trim().toLowerCase()
      }
    : null;
  const isDuplicateOfLiveDraft = assessment => {
    if (!draftScenarioSignature || !assessment) return false;
    if (draftScenarioSignature.id && String(assessment.id || '') === draftScenarioSignature.id) return true;
    const assessmentRisks = new Set((Array.isArray(assessment.selectedRiskIds) ? assessment.selectedRiskIds : []).filter(Boolean).map(String));
    const sharedRiskCount = draftScenarioSignature.risks.size
      ? Array.from(draftScenarioSignature.risks).filter(id => assessmentRisks.has(id)).length
      : 0;
    const sameBusinessContext = !draftScenarioSignature.buName || String(assessment.buName || '').trim().toLowerCase() === draftScenarioSignature.buName;
    const titleOverlap = hasMeaningfulScenarioOverlap(draftScenarioSignature.title, assessment.scenarioTitle || assessment.narrative || '');
    return sameBusinessContext && (sharedRiskCount >= 1 || titleOverlap);
  };
  const buildWorkspaceMemoryCue = assessment => {
    if (!assessment || typeof assessment !== 'object') return '';
    if (assessment.comparisonBaselineId) {
      const baseline = allAssessments.find(item => item.id === assessment.comparisonBaselineId);
      return `Built as a treatment case from ${baseline?.scenarioTitle || 'a saved baseline'}.`;
    }
    const lifecycleStatus = deriveAssessmentLifecycleStatus(assessment);
    if (lifecycleStatus === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED) {
      return 'Protected as a comparison baseline for future better-outcome testing.';
    }
    const priorMatch = allAssessments.find(item => {
      if (!item || item.id === assessment.id) return false;
      const priorTs = new Date(item.completedAt || item.createdAt || 0).getTime();
      const currentTs = new Date(assessment.completedAt || assessment.createdAt || 0).getTime();
      return priorTs < currentTs && hasMeaningfulScenarioOverlap(
        item.scenarioTitle || item.narrative || '',
        assessment.scenarioTitle || assessment.narrative || ''
      );
    });
    if (priorMatch) {
      // Keep memory cues lightweight so the dashboard feels continuous without becoming a new analysis layer.
      return `Shares a scenario pattern with ${String(priorMatch.scenarioTitle || 'an earlier saved assessment').trim()}.`;
    }
    if (assessment.assessmentChallenge?.createdAt) {
      return 'A saved challenge review is attached to this result.';
    }
    return '';
  };
  const reviewEligibleAssessments = assessments.filter(a => a?.results && (a.results.toleranceBreached || a.results.nearTolerance || a.results.annualReviewTriggered) && !isDuplicateOfLiveDraft(a));
  const assessmentsNeedingReview = reviewEligibleAssessments.slice(0, 3);
  const lifecycleCounts = assessments.reduce((acc, assessment) => {
    const status = deriveAssessmentLifecycleStatus(assessment);
    if (status === ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW) acc.readyForReview += 1;
    else if (status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT) acc.treatmentCandidates += 1;
    else if (status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED) acc.baselines += 1;
    else if (status === ASSESSMENT_LIFECYCLE_STATUS.SIMULATED) acc.simulated += 1;
    return acc;
  }, {
    readyForReview: 0,
    simulated: 0,
    treatmentCandidates: 0,
    baselines: 0
  });
  const openAssessmentRows = [
    ...(hasDraft ? [{
      id: 'draft',
      title: draftTitle || 'Untitled draft',
      status: draftLifecycle.label,
      detail: 'Continue from where you left off and complete the next assessment step.',
      actionLabel: 'Resume Draft',
      action: 'draft'
    }] : []),
    ...assessmentsNeedingReview.map(a => {
      const lifecycle = getAssessmentLifecyclePresentation(a);
      return ({
      id: a.id,
      title: a.scenarioTitle || 'Untitled assessment',
      status: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW
        ? lifecycle.label
        : a.results?.toleranceBreached ? 'Above tolerance' : a.results?.nearTolerance ? 'Needs management review' : 'Annual review triggered',
      detail: `${a.buName || profile.businessUnit || user?.businessUnit || 'Business unit not set'} · ${new Date(a.completedAt || a.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}`,
      actionLabel: 'Open Result',
      action: a.id
    });
    })
  ].slice(0, 4);
  const activeQueueAssessmentIds = openAssessmentRows
    .map(item => item.action)
    .filter(id => id && id !== 'draft');
  const watchlistItems = buildAssessmentWatchlist({
    assessments,
    excludeAssessmentIds: activeQueueAssessmentIds,
    maxItems: 6
  });
  const watchlistSummary = buildAssessmentWatchlistSummary(watchlistItems);
  const visibleWatchlistItems = watchlistItems.slice(0, 3);
  const hiddenWatchlistItems = watchlistItems.slice(3);
  const livingRegisterRows = typeof buildLivingRiskRegisterRows === 'function'
    ? buildLivingRiskRegisterRows({ assessments, now: Date.now() })
    : [];
  const livingRegisterSummary = typeof buildLivingRiskRegisterSummary === 'function'
    ? buildLivingRiskRegisterSummary(livingRegisterRows)
    : {
        total: livingRegisterRows.length,
        aboveTolerance: 0,
        nearTolerance: 0,
        annualReview: 0,
        dueNow: 0,
        inReview: 0,
        needsRevision: 0
      };
  const visibleRegisterRows = livingRegisterRows.slice(0, 6);
  const hiddenRegisterRows = livingRegisterRows.slice(6);
  const watchlistTitle = isOversightUser ? 'Reassessment lane' : 'Needs revisit';
  const watchlistDescription = isOversightUser
    ? 'Secondary revisit queue for saved results that deserve another look after the active attention lane is clear. The lane stays compact, but now groups the strongest revisit patterns.'
    : 'Saved results worth revisiting soon, kept compact so they do not compete with live work. The lane groups the strongest revisit patterns and keeps the next move explicit.';
  const renderDashboardActionMenu = ({
    items = [],
    summaryLabel = 'More',
    summaryClassName = 'btn btn--ghost btn--sm',
    className = 'results-actions-disclosure dashboard-row-overflow'
  } = {}) => {
    const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
    if (!safeItems.length) return '';
    return `<details class="${className}">
      <summary class="${summaryClassName}">${summaryLabel}</summary>
      <div class="results-actions-disclosure-menu">
        ${safeItems.join('')}
      </div>
    </details>`;
  };
  const renderAssessmentRowMenu = ({ assessmentId = '', includeDuplicate = true, includeArchive = true, includeDelete = true, includeOpen = false } = {}) => renderDashboardActionMenu({
    items: [
      includeOpen ? `<button type="button" class="btn btn--secondary btn--sm dashboard-open-action" data-assessment-id="${assessmentId}">Open Result</button>` : '',
      includeDuplicate ? `<button type="button" class="btn btn--secondary btn--sm dashboard-duplicate-assessment" data-assessment-id="${assessmentId}">Duplicate</button>` : '',
      includeArchive ? `<button type="button" class="btn btn--secondary btn--sm dashboard-archive-assessment" data-assessment-id="${assessmentId}">Archive</button>` : '',
      includeDelete ? `<button type="button" class="btn btn--secondary btn--sm dashboard-delete-assessment" data-assessment-id="${assessmentId}">Delete</button>` : ''
    ]
  });
  const renderDraftRowMenu = () => renderDashboardActionMenu({
    items: [
      '<button type="button" class="btn btn--secondary btn--sm dashboard-archive-draft">Archive</button>',
      '<button type="button" class="btn btn--secondary btn--sm dashboard-delete-draft">Delete</button>'
    ]
  });
  const renderWorkspaceToolsMenu = ({ includeResumeDraft = false, includeSettings = true, useSupportIds = false, includeNewAssessment = true } = {}) => renderDashboardActionMenu({
    items: [
      includeResumeDraft ? '<button class="btn btn--secondary btn--sm" id="btn-dashboard-continue-draft">Resume Draft</button>' : '',
      typeof DemoMode !== 'undefined' ? `<button class="btn btn--ghost btn--sm" id="btn-dashboard-run-demo">Live Demo</button>` : '',
      includeSettings ? `<button class="btn btn--secondary btn--sm" id="btn-dashboard-open-settings">${primarySettingsLabel}</button>` : '',
      `<button class="btn btn--secondary btn--sm" id="${useSupportIds ? 'btn-dashboard-export-assessments-support' : 'btn-dashboard-export-assessments'}">Export Assessments</button>`,
      `<button class="btn btn--secondary btn--sm" id="${useSupportIds ? 'btn-dashboard-import-assessments-support' : 'btn-dashboard-import-assessments'}">Import Assessments</button>`,
      includeNewAssessment
        ? `<button class="btn btn--secondary btn--sm" id="${useSupportIds ? 'btn-dashboard-new-assessment-support' : 'btn-dashboard-new-assessment-oversight'}">Start New Assessment</button>`
        : ''
    ],
    summaryLabel: useSupportIds ? 'Workspace tools' : 'Workspace tools',
    summaryClassName: useSupportIds ? 'btn btn--ghost btn--sm' : 'btn btn--ghost',
    className: useSupportIds ? 'results-actions-disclosure dashboard-hero-overflow' : 'results-actions-disclosure dashboard-hero-overflow'
  });
  const exportAssessmentsCollection = () => {
    ExportService.exportDataAsJson(getAssessments(), `risk-calculator-assessments-${user?.username || 'user'}.json`);
  };
  const importAssessmentsCollection = () => {
    ExportService.importJsonFile({
      onData: parsed => {
        const importedItems = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' && parsed.id
            ? [parsed]
            : parsed && typeof parsed === 'object' && typeof parsed.itemsById === 'object'
              ? Object.values(parsed.itemsById)
              : [];
        if (!importedItems.length) {
          UI.toast('That file does not contain an assessment list.', 'warning');
          return;
        }
        const existing = getAssessments();
        const mergedById = new Map();
        [...existing, ...importedItems]
          .filter(item => item && typeof item === 'object' && item.id)
          .forEach(item => {
            const key = String(item.id || '').trim();
            const previous = mergedById.get(key);
            const previousTs = Number(previous?.lifecycleUpdatedAt || previous?.completedAt || previous?.createdAt || 0);
            const nextTs = Number(item?.lifecycleUpdatedAt || item?.completedAt || item?.createdAt || 0);
            // Import/export round-trips should keep the freshest copy when the same assessment exists in both sources.
            if (!previous || nextTs >= previousTs) mergedById.set(key, item);
          });
        const merged = Array.from(mergedById.values());
        persistSavedAssessmentsCollection(merged);
        renderUserDashboard();
        UI.toast('Assessments imported.', 'success');
      },
      onError: () => UI.toast('That JSON file could not be imported.', 'warning')
    });
  };
  const launchGuidedAssessmentStart = () => {
    if (typeof window.launchGuidedAssessmentStart === 'function') {
      window.launchGuidedAssessmentStart();
      return;
    }
    resetDraft();
    openDraftWorkspaceRoute();
  };
  const launchTemplateStart = () => {
    if (recommendedTemplate) loadTemplate(recommendedTemplate);
  };
  const launchSampleStart = () => launchPilotSampleAssessment();
  const escapeDashboardText = value => escapeHtml(String(value || ''));
  // TODO: extend buildAssessmentWatchlist to derive and attach confidenceTrajectory by comparing the current assessment confidenceLabel to the previous saved result for the same scenario.
  const renderWatchlistRows = items => items.map(item => UI.dashboardAssessmentRow({
    assessmentId: item.id,
    title: escapeDashboardText(item.title || 'Untitled assessment'),
    detail: `
      <div class="dashboard-watchlist-meta">
        <span>${escapeDashboardText(item.businessContext || 'Business context not set')}</span>
        <span>${escapeDashboardText(item.reviewAgeLabel || 'Reviewed recently')}</span>
        ${item.confidenceTrajectory
          ? `<span class="badge badge--neutral">${
              item.confidenceTrajectory === 'up' ? '↑ confidence improving'
              : item.confidenceTrajectory === 'down' ? '↓ confidence degraded'
              : '→ confidence stable'
            }</span>`
          : ''}
        <span class="badge ${escapeDashboardText(item.urgencyBadgeClass || 'badge--neutral')}">${escapeDashboardText(item.urgencyLabel || 'Check basis')}</span>
      </div>
      <div class="dashboard-watchlist-why"><strong>Why now:</strong> ${escapeDashboardText(item.detail || '')}</div>
      ${buildWatchlistDeltaLine(item)
        ? `<div class="dashboard-watchlist-delta">${escapeDashboardText(buildWatchlistDeltaLine(item))}</div>`
        : ''}
      <div class="dashboard-watchlist-next"><strong>Next:</strong> ${escapeDashboardText(item.nextAction || 'Open the result and confirm whether the underlying assumptions still hold.')}</div>
    `,
    badgeClass: item.badgeClass,
    badgeLabel: item.badgeLabel,
    className: 'dashboard-assessment-row--compact dashboard-watchlist-row',
    actions: `
      <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${escapeDashboardText(item.id || '')}">${escapeDashboardText(item.actionLabel || (item.urgencyLabel === 'Act now' ? 'Review now' : 'Open Result'))}</button>
      ${renderAssessmentRowMenu({ assessmentId: item.id })}
    `
  })).join('');
  const watchlistMarkup = visibleWatchlistItems.length ? `
    <div class="card card--elevated dashboard-section-card dashboard-section-card--secondary dashboard-watchlist-panel">
      <div class="flex items-center justify-between" style="gap:var(--sp-3);flex-wrap:wrap">
        <div>
          <div class="context-panel-title">${watchlistTitle}</div>
          <div class="form-help">${watchlistDescription}</div>
        </div>
        <span class="badge badge--neutral">${watchlistItems.length}</span>
      </div>
      ${watchlistSummary.length ? `<div class="dashboard-watchlist-summary" aria-label="Watchlist summary">
        ${watchlistSummary.map(item => `<span class="dashboard-watchlist-summary__item">${escapeDashboardText(item.label)}</span>`).join('')}
      </div>` : ''}
      <div class="dashboard-watchlist-list">
        ${renderWatchlistRows(visibleWatchlistItems)}
      </div>
      ${hiddenWatchlistItems.length ? `<details class="dashboard-disclosure dashboard-watchlist-disclosure">
        <summary>View full reassessment queue <span class="badge badge--neutral">+${hiddenWatchlistItems.length}</span></summary>
        <div class="dashboard-disclosure-copy">Open this only when you want the longer reassessment queue behind the immediate items. Each row keeps the trigger, urgency, and expected next move visible.</div>
        <div class="dashboard-disclosure-body">
          ${renderWatchlistRows(hiddenWatchlistItems)}
        </div>
      </details>` : ''}
    </div>` : '';
  const quickStatus = hasDraft
    ? 'You have a draft in progress and can resume it immediately.'
    : assessmentsNeedingReview.length
      ? 'You have completed assessments that need review.'
      : 'You are ready to start a new assessment.';


  const workspaceSummary = [
    profile.jobTitle || 'Role not yet set',
    profile.businessUnit || user?.businessUnit || 'Business unit not yet set',
    profile.department || user?.department || ''
  ].filter(Boolean).join(' · ');
  const guidanceSummary = focusAreas.length
    ? `Focus areas: ${focusAreas.slice(0, 3).join(', ')}${focusAreas.length > 3 ? ', and more.' : '.'}`
    : 'No focus areas saved yet.';
  const contextReadinessScore = [
    profile.jobTitle,
    profile.businessUnit || user?.businessUnit,
    profile.department || user?.department,
    focusAreas.length ? 'focus-areas' : '',
    profile.workingContext
  ].filter(Boolean).length;
  const contextReadinessLabel = contextReadinessScore >= 5
    ? 'Ready'
    : contextReadinessScore >= 3
      ? 'Partially set'
      : 'Needs setup';
  const contextNeedsAttention = contextReadinessScore < 3;
  const queueNeedsAttention = hasDraft || assessmentsNeedingReview.length > 0;
  const roleLaneTitle = hasDraft
    ? 'Resume the live draft'
    : assessmentsNeedingReview.length
      ? 'Review the latest result'
      : 'Start a guided assessment';
  const roleLaneCopy = hasDraft
    ? 'Continue the active assessment and move it toward a decision-ready result.'
    : assessmentsNeedingReview.length
      ? 'Open the highest-priority completed scenario and confirm the next management action.'
      : 'Use the guided path to get to a first useful result quickly, then refine only if needed.';
  const recommendedTemplate = typeof pickScenarioTemplateForContext === 'function'
    ? pickScenarioTemplateForContext({
        functionKey: typeof getStep1ExampleExperienceModel === 'function'
          ? getStep1ExampleExperienceModel(getEffectiveSettings(), AppState.draft || {}).functionKey
          : 'general'
      })
    : (Array.isArray(ScenarioTemplates) ? ScenarioTemplates[0] : null);
  const primarySettingsLabel = capability.canManageBusinessUnit || capability.canManageDepartment
    ? capability.experience.primaryActionLabel
    : 'Personal Settings';
  const oversightContextActionLabel = capability.canManageBusinessUnit ? 'Manage BU Context' : 'Manage Function Context';
  const oversightPrimaryActionLabel = contextNeedsAttention
    ? oversightContextActionLabel
    : queueNeedsAttention
      ? (hasDraft ? 'Resume Review' : (capability.canManageBusinessUnit ? 'Review BU Queue' : 'Review Function Queue'))
      : 'Start Guided Assessment';
  const roleFrontDoor = isOversightUser
    ? {
        badge: capability.canManageBusinessUnit ? 'BU Oversight Workspace' : 'Function Oversight Workspace',
        heroCopy: capability.canManageBusinessUnit
          ? 'A focused oversight space for reviewing flagged business-unit work, maintaining context, and starting new assessments only when needed.'
          : 'A focused oversight space for reviewing function-level work, maintaining context, and starting new assessments only when needed.',
        roleLaneCopy: hasDraft
          ? 'Continue the active draft, then bring it back into the review lane once the scenario is decision-ready.'
          : assessmentsNeedingReview.length
            ? 'Open the highest-priority completed scenario and decide whether the business context, function context, or next action needs to change.'
            : 'No item currently needs escalation, so keep the context current and start new work only when it is materially useful.',
        quickStatus: hasDraft
          ? 'A draft is in flight and should be either completed or archived before new work starts.'
          : assessmentsNeedingReview.length
            ? 'There are completed scenarios that need BU or function-level judgement.'
            : 'No urgent review item is currently competing for attention.',
        primaryActionLabel: oversightPrimaryActionLabel,
        heroHint: contextNeedsAttention
          ? 'Tighten the managed context first so drafting and review stay aligned to the function you own.'
          : queueNeedsAttention
            ? 'Keep the active review lane clear first. Start new work only after the current queue is under control.'
            : 'The queue is clear and context is in a good state, so you can start new work only when it is materially useful.',
        overviewCards: [
          {
            label: 'Needs attention',
            value: openAssessmentRows.length,
            foot: assessmentsNeedingReview.length ? 'Flagged scenarios or active drafts are ready for oversight review.' : 'No flagged scenario is currently competing for your attention.'
          },
          {
            label: capability.canManageBusinessUnit ? 'Active BU work' : 'Active function work',
            value: assessments.length,
            foot: latestAssessment ? `Latest reviewed: ${new Date(latestAssessment.completedAt || latestAssessment.createdAt || Date.now()).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No completed assessments are currently saved'
          },
          {
            label: capability.canManageBusinessUnit ? 'Managed scope' : 'Owned scope',
            value: capability.roleSummary,
            foot: capability.experience.dashboardLead
          }
        ],
        nextUpTitle: capability.canManageBusinessUnit ? 'BU attention queue' : 'Function attention queue',
        nextUpDescription: capability.canManageBusinessUnit
          ? 'Review the draft or result that most likely needs business-unit attention first.'
          : 'Review the draft or result that most likely needs function-level attention first.',
        recentTitle: capability.canManageBusinessUnit ? 'Recent BU work' : 'Recent function work',
        recentDescription: 'Recent in-scope work stays compact here so you can reopen or compare without sifting through the whole workspace.',
        contextTitle: capability.canManageBusinessUnit ? 'Business context and defaults' : 'Function context and defaults',
        contextDescription: capability.canManageBusinessUnit
          ? 'Keep the BU and working-function context current so teams see the right defaults and AI guidance.'
          : 'Keep the function context current so AI assistance and saved defaults stay grounded in how the team actually works.',
        playbookTitle: capability.canManageBusinessUnit ? 'Oversight playbook' : 'Function playbook',
        playbookDescription: 'Open this only when you need the role-specific guidance. The main oversight lane stays intentionally focused by default.',
        spotlightTitle: capability.canManageBusinessUnit ? 'BU defaults and context health' : 'Function defaults and context health',
        spotlightCopy: capability.canManageBusinessUnit
          ? 'Use this lane to keep business-unit defaults and working context clean before more assessments are started.'
          : 'Use this lane to keep function context and default guidance clean before more assessments are started.'
      }
    : {
        badge: 'Personal Workspace',
        heroCopy: 'A calm working space for moving from scenario framing to a decision-ready risk view. Start with the guided path, then open detail only when you need it.',
        roleLaneCopy,
        quickStatus,
        primaryActionLabel: 'Start Guided Assessment',
        heroHint: 'Use the guided path first. Templates, imports, and sample paths are still available when you need them.',
        secondaryActionLabel: recommendedTemplate ? 'View Worked Example' : 'Start from Template',
        secondaryActionId: recommendedTemplate ? 'sample' : 'template',
        overviewCards: [
          {
            label: 'Ready now',
            value: openAssessmentRows.length,
            foot: hasDraft ? 'Your live draft or priority review items are ready to open.' : 'No active draft right now. Start from the guided path when needed.'
          },
          {
            label: 'Completed assessments',
            value: assessments.length,
            foot: latestAssessment ? `Latest: ${new Date(latestAssessment.completedAt || latestAssessment.createdAt || Date.now()).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No completed assessments yet'
          },
          {
            label: 'Context quality',
            value: contextReadinessLabel,
            foot: contextReadinessScore >= 5 ? 'Your saved role and working context are ready to support AI-assisted drafting.' : 'Add more profile context to improve defaults and suggestion quality.'
          }
        ],
        nextUpTitle: 'Next up',
        nextUpDescription: 'Resume unfinished work or open the results that most likely need attention.',
        recentTitle: 'Recent work',
        recentDescription: 'Your latest saved assessments, kept compact so it is easy to reopen or compare them.',
        contextTitle: 'Your settings and saved context',
        contextDescription: 'Reference information that shapes assisted suggestions and your default working context.',
        playbookTitle: 'Role playbook',
        playbookDescription: 'Open this when you want role-specific guidance. The primary workflow stays intentionally simple by default.',
        spotlightTitle: 'Worked example and templates',
        spotlightCopy: 'Use the worked example when you want a fast demo path. Open templates when you want structure without starting from a blank assessment.'
      };
  const inheritedContextModel = buildInheritedContextDisplayModel({
    user,
    userSettings: settings,
    effectiveSettings: getEffectiveSettings(),
    globalSettings
  });
  const inheritedContextMarkup = (inheritedContextModel.highlights.length || inheritedContextModel.visibleDetails.length || inheritedContextModel.hasHiddenDetails) ? `
    <section class="dashboard-primary-band dashboard-primary-band--context">
      ${UI.dashboardSectionCard({
        title: 'Inherited assessment context',
        description: 'These shared defaults and retained summaries shape new assessments before your personal working context is applied.',
        className: 'dashboard-section-card--secondary',
        body: `
          ${inheritedContextModel.highlights.length ? `<div class="citation-chips">
            ${inheritedContextModel.highlights.map(item => `<span class="badge badge--neutral">${escapeDashboardText(item.label)}: ${escapeDashboardText(item.value)}</span>`).join('')}
          </div>` : ''}
          ${inheritedContextModel.visibleDetails.length ? `<div style="display:flex;flex-direction:column;gap:12px">
            ${inheritedContextModel.visibleDetails.map(item => `<div>
              <div class="results-driver-label">${escapeDashboardText(item.label)}</div>
              <div class="results-summary-copy">${escapeDashboardText(item.value)}</div>
            </div>`).join('')}
          </div>` : ''}
          ${inheritedContextModel.hasHiddenDetails ? `<div class="form-help">Additional governed context is applied to your assessments by the organisation, but its detail is intentionally hidden from this workspace.</div>` : ''}
        `
      })}
    </section>` : '';
  const portfolioListRows = completedAssessments.map(assessment => {
    const lifecycle = getAssessmentLifecyclePresentation(assessment);
    const memoryCue = buildWorkspaceMemoryCue(assessment);
    const rowTitle = String(assessment.scenarioTitle || assessment.title || 'Untitled assessment');
    const rowBusinessUnit = String(assessment.buName || profile.businessUnit || user?.businessUnit || 'Business unit not set');
    const rowDate = new Date(assessment.completedAt || assessment.createdAt || 0).getTime() || 0;
    const rowLoss = Number(assessment.results?.eventLoss?.p90 || 0);
    const rowStatus = String(assessment.lifecycleStatus || lifecycle.status || '');
    return `<div data-title="${escapeDashboardText(rowTitle.toLowerCase())}" data-bu="${escapeDashboardText(rowBusinessUnit.toLowerCase())}" data-date="${rowDate}" data-loss="${rowLoss}" data-status="${escapeDashboardText(rowStatus)}">${UI.dashboardAssessmentRow({
      assessmentId: assessment.id,
      title: escapeDashboardText(rowTitle),
      detail: `${escapeDashboardText(rowBusinessUnit)} · ${escapeDashboardText(new Date(assessment.completedAt || assessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }))}${memoryCue ? `<div class="dashboard-memory-cue">${escapeDashboardText(memoryCue)}</div>` : ''}`,
      badgeClass: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED ? 'badge--gold' : assessment.results?.toleranceBreached ? 'badge--danger' : assessment.results?.nearTolerance ? 'badge--warning' : lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT ? 'badge--gold' : 'badge--success',
      badgeLabel: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED || lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT ? lifecycle.label : assessment.results?.toleranceBreached ? 'Above tolerance' : assessment.results?.nearTolerance ? 'Close to tolerance' : lifecycle.label,
      actions: `
        <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${escapeDashboardText(assessment.id || '')}">Open</button>
        ${renderAssessmentRowMenu({ assessmentId: assessment.id })}
      `
    })}</div>`;
  }).join('');
  const portfolioChartWidth = 472;
  const portfolioChartHeight = 264;
  const portfolioChartLeft = 76;
  const portfolioChartTop = 30;
  const portfolioChartRight = portfolioChartLeft + portfolioChartWidth;
  const portfolioChartBottom = portfolioChartTop + portfolioChartHeight;
  const portfolioLogMin = Math.log10(1000);
  const portfolioLogMax = Math.log10(100000000);
  const portfolioHeatmapPoints = completedAssessments
    .map(assessment => {
      const aleMean = Number(assessment?.results?.ale?.mean);
      const exceedProb = Number(assessment?.results?.toleranceDetail?.aleExceedProb);
      if (!(aleMean > 0) || !Number.isFinite(exceedProb)) return null;
      const safeAleMean = Math.min(Math.max(aleMean, 1000), 100000000);
      const safeExceedProb = Math.min(Math.max(exceedProb, 0), 1);
      const x = portfolioChartLeft + ((Math.log10(safeAleMean) - portfolioLogMin) / (portfolioLogMax - portfolioLogMin)) * portfolioChartWidth;
      const y = portfolioChartTop + (1 - safeExceedProb) * portfolioChartHeight;
      const fill = assessment?.results?.toleranceBreached
        ? '#ef4444'
        : assessment?.results?.nearTolerance
          ? '#f59e0b'
          : '#22c55e';
      const title = `${assessment?.scenarioTitle || assessment?.title || 'Untitled'} · ALE ${fmtCurrency(aleMean)} · ${(safeExceedProb * 100).toFixed(1)}% chance > tolerance`;
      return {
        id: String(assessment?.id || '').trim(),
        x,
        y,
        fill,
        title
      };
    })
    .filter(item => item && item.id);
  const portfolioGridVerticals = Array.from({ length: 4 }, (_, index) => portfolioChartLeft + (((index + 1) / 5) * portfolioChartWidth));
  const portfolioGridHorizontals = Array.from({ length: 4 }, (_, index) => portfolioChartTop + (((index + 1) / 5) * portfolioChartHeight));
  const portfolioDefaultView = portfolioHeatmapPoints.length ? 'heatmap' : 'list';
  const portfolioHeatmapMarkup = `
    <div class="portfolio-view-shell">
      <div class="portfolio-toggle">
        <button class="portfolio-toggle-btn ${portfolioDefaultView === 'heatmap' ? 'active' : ''}" id="btn-view-heatmap" type="button">Heat Map</button>
        <button class="portfolio-toggle-btn ${portfolioDefaultView === 'list' ? 'active' : ''}" id="btn-view-list" type="button">List</button>
      </div>
      <svg id="portfolio-heatmap" viewBox="0 0 600 380" width="100%" aria-label="Portfolio heat map" style="${portfolioDefaultView === 'heatmap' ? '' : 'display:none'}">
        <rect x="${portfolioChartLeft}" y="${portfolioChartTop}" width="${portfolioChartWidth}" height="${portfolioChartHeight}" rx="16" fill="rgba(255,255,255,0.02)" stroke="rgba(229,231,235,0.14)" />
        ${portfolioGridVerticals.map(x => `<line x1="${x.toFixed(2)}" y1="${portfolioChartTop}" x2="${x.toFixed(2)}" y2="${portfolioChartBottom}" stroke="#e5e7eb" stroke-width="0.5" />`).join('')}
        ${portfolioGridHorizontals.map(y => `<line x1="${portfolioChartLeft}" y1="${y.toFixed(2)}" x2="${portfolioChartRight}" y2="${y.toFixed(2)}" stroke="#e5e7eb" stroke-width="0.5" />`).join('')}
        <line x1="${portfolioChartLeft}" y1="${portfolioChartBottom}" x2="${portfolioChartRight}" y2="${portfolioChartBottom}" stroke="#cbd5e1" stroke-width="1" />
        <line x1="${portfolioChartLeft}" y1="${portfolioChartTop}" x2="${portfolioChartLeft}" y2="${portfolioChartBottom}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${((portfolioChartLeft + portfolioChartRight) / 2).toFixed(2)}" y="356" text-anchor="middle" font-size="10" fill="#6b7280">Expected Annual Loss</text>
        <text x="24" y="${((portfolioChartTop + portfolioChartBottom) / 2).toFixed(2)}" text-anchor="middle" font-size="10" fill="#6b7280" transform="rotate(-90 24 ${((portfolioChartTop + portfolioChartBottom) / 2).toFixed(2)})">Probability &gt; Tolerance</text>
        <text x="${portfolioChartLeft}" y="338" font-size="10" fill="#6b7280">$1K</text>
        <text x="${(portfolioChartRight - 34).toFixed(2)}" y="338" font-size="10" fill="#6b7280">$100M</text>
        <text x="38" y="${(portfolioChartTop + 4).toFixed(2)}" font-size="10" fill="#6b7280">100%</text>
        <text x="48" y="${(portfolioChartBottom + 4).toFixed(2)}" font-size="10" fill="#6b7280">0%</text>
        ${portfolioHeatmapPoints.map(point => `
          <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="8" fill="${point.fill}" data-id="${escapeDashboardText(point.id)}" style="cursor:pointer">
            <title>${escapeDashboardText(point.title)}</title>
          </circle>
        `).join('')}
      </svg>
      <div class="dashboard-list-toolbar" id="dashboard-list-toolbar" style="${portfolioDefaultView === 'list' ? '' : 'display:none'}">
        <input type="search" id="dash-filter-input" class="form-input form-input--sm" placeholder="Filter by title or business unit…" style="max-width:240px">
        <select id="dash-sort-select" class="form-select form-select--sm" style="max-width:180px">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="loss-desc">Highest P90 loss</option>
          <option value="status">By status</option>
        </select>
      </div>
      <div id="portfolio-list-view" style="${portfolioDefaultView === 'list' ? '' : 'display:none'}">${portfolioListRows}</div>
    </div>
  `;
  const attentionCards = [
    {
      label: isOversightUser ? 'Needs attention' : 'Ready for review',
      value: lifecycleCounts.readyForReview + (hasDraft && isOversightUser ? 1 : 0),
      note: isOversightUser ? 'Flagged draft or result' : 'Completed items needing review',
      tone: lifecycleCounts.readyForReview ? 'warning' : 'neutral'
    },
    {
      label: 'Simulated',
      value: lifecycleCounts.simulated,
      note: 'Saved analysis outputs',
      tone: lifecycleCounts.simulated ? 'success' : 'neutral'
    },
    {
      label: 'Treatment candidates',
      value: lifecycleCounts.treatmentCandidates,
      note: 'Future-state comparisons',
      tone: lifecycleCounts.treatmentCandidates ? 'gold' : 'neutral'
    },
    {
      label: isOversightUser ? 'Locked baselines' : 'Baselines',
      value: lifecycleCounts.baselines,
      note: 'Protected comparison anchors',
      tone: lifecycleCounts.baselines ? 'gold' : 'neutral'
    }
  ];
  const workspaceValueSummary = typeof ValueQuantService !== 'undefined'
    ? ValueQuantService.buildWorkspaceValueSummary(completedAssessments, {
        benchmarkSettings: globalSettings.valueBenchmarkSettings
      })
    : null;
  const orientationCards = [
    {
      label: hasDraft ? 'Draft in progress' : assessmentsNeedingReview.length ? 'Review queue active' : 'Clear to start',
      value: roleLaneTitle,
      note: roleFrontDoor.quickStatus,
      tone: hasDraft ? 'gold' : assessmentsNeedingReview.length ? 'warning' : 'success'
    },
    {
      label: isOversightUser ? 'Managed scope' : 'Default context',
      value: isOversightUser ? capability.roleSummary : (settings.geographyPrimary || settings.geography || globalSettings.geography || 'Not set'),
      note: isOversightUser ? capability.experience.dashboardLead : 'Saved context shapes default wording and assisted guidance.',
      tone: 'neutral'
    },
    {
      label: 'Context readiness',
      value: contextReadinessLabel,
      note: guidanceSummary,
      tone: contextReadinessScore >= 5 ? 'success' : contextReadinessScore >= 3 ? 'neutral' : 'warning'
    }
  ];
  const oversightHealthItems = [
    {
      label: 'Attention queue',
      value: openAssessmentRows.length ? `${openAssessmentRows.length} item${openAssessmentRows.length === 1 ? '' : 's'}` : 'Nothing urgent',
      note: queueNeedsAttention ? roleFrontDoor.quickStatus : 'No active draft or flagged result is currently competing for attention.',
      tone: queueNeedsAttention ? 'warning' : 'success'
    },
    {
      label: 'Owned context',
      value: contextReadinessLabel,
      note: guidanceSummary,
      tone: contextNeedsAttention ? 'warning' : 'neutral'
    },
    {
      label: 'Managed scope',
      value: capability.roleSummary,
      note: capability.experience.dashboardLead,
      tone: 'neutral'
    }
  ];
  const renderDashboardEmptyState = ({ title, body, primaryId, primaryLabel, secondaryId = '', secondaryLabel = '' }) => `<div class="empty-state dashboard-empty-state">
    <strong>${title}</strong>
    <div style="margin-top:8px">${body}</div>
    <div class="flex items-center gap-3" style="margin-top:14px;flex-wrap:wrap">
      <button type="button" class="btn btn--secondary btn--sm" id="${primaryId}">${primaryLabel}</button>
      ${secondaryId ? `<button type="button" class="btn btn--ghost btn--sm" id="${secondaryId}">${secondaryLabel}</button>` : ''}
    </div>
  </div>`;
  const renderLivingRegisterRow = row => `
    <article class="living-register-row">
      <div class="living-register-row__head">
        <div>
          <div class="living-register-row__title">${escapeDashboardText(row.title)}</div>
          <div class="living-register-row__meta">${escapeDashboardText(row.buName)} · Owner: ${escapeDashboardText(row.owner)} · Last review: ${escapeDashboardText(row.lastReviewLabel)}</div>
        </div>
        <div class="living-register-row__values">
          <div class="living-register-row__value">
            <span>P90 event loss</span>
            <strong>${fmtCurrency(row.p90Loss || 0)}</strong>
          </div>
          <div class="living-register-row__value">
            <span>ALE mean</span>
            <strong>${fmtCurrency(row.aleMean || 0)}</strong>
          </div>
        </div>
      </div>
      <div class="living-register-row__chips">
        <span class="badge badge--${row.postureTone}">${escapeDashboardText(row.postureLabel)}</span>
        <span class="badge badge--${row.trendTone === 'danger' ? 'danger' : row.trendTone === 'warning' ? 'warning' : row.trendTone === 'success' ? 'success' : 'neutral'}">${escapeDashboardText(row.trendLabel)}</span>
        <span class="badge badge--neutral">${escapeDashboardText(row.lifecycleLabel)}</span>
        <span class="badge ${/due now|overdue/i.test(String(row.nextReviewLabel || '')) ? 'badge--warning' : 'badge--neutral'}">${escapeDashboardText(row.nextReviewLabel)}</span>
      </div>
      <div class="living-register-row__foot">
        <div class="living-register-row__note">${escapeDashboardText(row.statusNote || row.nextAction)}</div>
        <div class="living-register-row__actions">
          <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${escapeDashboardText(row.id || '')}">Open Result</button>
        </div>
      </div>
    </article>
  `;
  const livingRegisterBody = livingRegisterRows.length
    ? `
      <div class="living-register-summary" aria-label="Living risk register summary">
        <span class="living-register-summary__item">${livingRegisterSummary.total} row${livingRegisterSummary.total === 1 ? '' : 's'}</span>
        <span class="living-register-summary__item">${livingRegisterSummary.aboveTolerance} above tolerance</span>
        <span class="living-register-summary__item">${livingRegisterSummary.nearTolerance} near tolerance</span>
        <span class="living-register-summary__item">${livingRegisterSummary.dueNow} due now</span>
        <span class="living-register-summary__item">${livingRegisterSummary.inReview} in review</span>
      </div>
      <div class="living-register-actions">
        <button type="button" class="btn btn--secondary btn--sm" id="btn-export-living-register">Export Register</button>
        <button type="button" class="btn btn--ghost btn--sm" id="btn-export-living-register-csv">Download CSV</button>
      </div>
      <div class="living-register-list">
        ${visibleRegisterRows.map(renderLivingRegisterRow).join('')}
      </div>
      ${hiddenRegisterRows.length ? `<details class="dashboard-disclosure living-register-disclosure">
        <summary>Show the rest of the register <span class="badge badge--neutral">${hiddenRegisterRows.length}</span></summary>
        <div class="dashboard-disclosure-body">
          <div class="living-register-list">
            ${hiddenRegisterRows.map(renderLivingRegisterRow).join('')}
          </div>
        </div>
      </details>` : ''}
    `
    : renderDashboardEmptyState({
        title: 'No living register rows yet.',
        body: 'Completed assessments automatically appear here so you can scan posture, next review due, and owner without opening every result.',
        primaryId: 'btn-empty-register-new',
        primaryLabel: 'Start Guided Assessment',
        secondaryId: 'btn-empty-register-sample',
        secondaryLabel: 'Try Sample Assessment'
      });
  const portfolioRecentBody = compactRecentAssessments.length
    ? `
      <section class="dashboard-portfolio-band" style="margin-bottom:var(--sp-5)">
        <div class="results-section-heading">Portfolio View</div>
        <div class="form-help" style="margin-top:8px;margin-bottom:var(--sp-4)">See saved completed work as a portfolio first, then fall back to the list when you need row-level detail.</div>
        ${portfolioHeatmapMarkup}
      </section>
    `
    : renderDashboardEmptyState({
        title: 'No completed assessments yet.',
        body: 'Use a template if you want a structured starting point, or run the sample path once to see the full pilot workflow.',
        primaryId: 'btn-empty-recent-template',
        primaryLabel: 'Start from Template',
        secondaryId: 'btn-empty-recent-sample',
        secondaryLabel: 'Try Sample Assessment'
      });
  const standardStartModule = !isOversightUser ? `
    <div class="dashboard-start-module">
      <div class="dashboard-start-head">
        <div class="context-panel-title">Start a risk scenario</div>
        <p class="dashboard-start-copy">Guided assessment is recommended for most users. Use register upload when you already have source material, or start from a preloaded scenario when you want a faster first pass.</p>
      </div>
      <div class="dashboard-start-stack">
        <div class="dashboard-start-primary">
          <div class="dashboard-start-primary__content">
            <div class="dashboard-start-kicker">Recommended path</div>
            <h3>Guided assessment</h3>
            <p>Build a risk scenario step by step with AI-assisted guidance, then refine only where needed.</p>
            <div class="dashboard-start-primary__foot">Best for new scenarios, structured walkthroughs, and decision-ready outputs.</div>
          </div>
          <div class="dashboard-start-primary__actions">
            <button class="btn btn--primary btn--lg" id="btn-dashboard-new-assessment" aria-label="Start Guided Assessment">Start Guided Assessment</button>
            <span class="dashboard-start-inline-note">AI-assisted wizard</span>
          </div>
        </div>
          <div class="dashboard-start-secondary-grid">
            <div class="dashboard-start-secondary">
              <div>
                <div class="dashboard-start-kicker">Bring your own source material</div>
                <strong>Upload a risk register</strong>
              <p>Bring in existing risks and turn them into candidate scenarios for assessment.</p>
            </div>
            <button class="btn btn--secondary" id="btn-dashboard-upload-register">Upload risk register</button>
          </div>
            <div class="dashboard-start-tertiary">
              <div>
                <div class="dashboard-start-kicker">Faster starting point</div>
                <strong>Preloaded risk scenarios</strong>
                <p>Start from realistic example scenarios when you want a faster first pass.</p>
              </div>
              <div class="dashboard-start-tertiary__actions">
                <button class="btn btn--ghost" id="btn-dashboard-start-sample">Use preloaded scenario</button>
                <button class="btn btn--ghost" id="btn-dashboard-start-template">Start from Template</button>
              </div>
            </div>
          </div>
        <div class="dashboard-start-quiet-note">Use the guided path for most new work. Use register upload, templates, or preloaded scenarios only when they match how you are starting. Workspace tools stay lower on the page so they do not compete with the start decision.</div>
      </div>
    </div>` : '';

  setPage(`
    <main class="page">
      <div class="container container--wide dashboard-shell">
        <section class="card card--elevated dashboard-hero ${isOversightUser ? '' : 'dashboard-hero--start'}">
          <div class="dashboard-hero-grid ${isOversightUser ? 'dashboard-hero-grid--single' : 'dashboard-hero-grid--balanced'}">
            <div class="dashboard-hero-main">
              <div class="landing-badge">${roleFrontDoor.badge}</div>
              <h2 style="margin-top:var(--sp-4)">Welcome back, ${escapeDashboardText(user?.displayName || 'there')}.</h2>
              <p class="dashboard-hero-copy">${roleFrontDoor.heroCopy}</p>
              ${isOversightUser ? `<div class="dashboard-signal-strip dashboard-signal-strip--oversight">
                ${oversightHealthItems.map(item => `
                  <div class="dashboard-signal-pill dashboard-signal-pill--${item.tone}">
                    <span class="dashboard-signal-pill__label">${item.label}</span>
                    <strong>${item.value}</strong>
                    <span>${item.note}</span>
                  </div>
                `).join('')}
              </div>
              <div class="dashboard-hero-actions flex items-center gap-3 mt-6" style="flex-wrap:wrap">
                <button class="btn btn--primary btn--lg" id="btn-dashboard-new-assessment" aria-label="${roleFrontDoor.primaryActionLabel}">${roleFrontDoor.primaryActionLabel}</button>
                <!-- Keep start-new visible for oversight users instead of burying it in the overflow menu. -->
                <button class="btn btn--secondary btn--lg" id="btn-dashboard-new-assessment-oversight" aria-label="Start Guided Assessment">Start Guided Assessment</button>
                ${renderWorkspaceToolsMenu({ includeResumeDraft: hasDraft, includeSettings: true, useSupportIds: false, includeNewAssessment: false })}
              </div>
              <div class="form-help" style="margin-top:12px;color:rgba(255,255,255,.65)">${roleFrontDoor.heroHint}</div>` : standardStartModule}
            </div>
            ${isOversightUser ? '' : `<aside class="dashboard-hero-side dashboard-hero-side--support dashboard-hero-side--standard">
              <div class="context-panel-title">Workspace summary</div>
              <div class="dashboard-side-summary-list">
                ${orientationCards.map(card => `<div class="dashboard-side-summary-item dashboard-side-summary-item--${card.tone}">
                  <span class="dashboard-side-summary-item__label">${card.label}</span>
                  <strong>${card.value}</strong>
                  <span>${card.note}</span>
                </div>`).join('')}
              </div>
              <div class="dashboard-hero-side-foot">Saved workspace context shapes wording, guidance, and assisted suggestions across the wizard.</div>
            </aside>`}
          </div>
        </section>

        ${inheritedContextMarkup}

        <section class="dashboard-primary-band dashboard-primary-band--work">
          <div class="results-section-heading">Do the work</div>
          <div class="form-help" style="margin-top:8px;margin-bottom:var(--sp-4)">Start here for the next item to assess, review, or resume.</div>
          ${isOversightUser ? `<div class="card dashboard-section-card dashboard-section-card--spotlight" style="margin-bottom:var(--sp-4)">
            <div class="flex items-center justify-between" style="gap:var(--sp-4);flex-wrap:wrap;align-items:flex-start">
              <div style="max-width:60ch">
                <div class="context-panel-title">Need to start a fresh scenario?</div>
                <div class="form-help" style="margin-top:8px">The queue stays primary, but you can still open the guided builder directly from here when a new issue, escalation, or management question needs its own assessment.</div>
              </div>
              <!-- Give oversight users a full-width secondary work lane instead of a utility-style action row. -->
              <button class="btn btn--secondary btn--lg" id="btn-dashboard-new-assessment-support" type="button">Start Guided Assessment</button>
            </div>
          </div>` : ''}
          ${UI.dashboardSectionCard({
            title: roleFrontDoor.nextUpTitle,
            description: roleFrontDoor.nextUpDescription,
            badge: openAssessmentRows.length,
            className: 'dashboard-section-card--spotlight',
            body: openAssessmentRows.length ? openAssessmentRows.map(item => UI.dashboardAssessmentRow({
              assessmentId: item.action,
              title: escapeDashboardText(item.title || 'Untitled assessment'),
              detail: escapeDashboardText(item.detail || ''),
              badgeClass: /above tolerance/i.test(item.status) ? 'badge--danger' : /review/i.test(item.status) ? 'badge--warning' : 'badge--gold',
              badgeLabel: escapeDashboardText(item.status || 'Open'),
              actions: `
                <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${escapeDashboardText(item.action || '')}">${escapeDashboardText(item.actionLabel || 'Open')}</button>
                ${item.action === 'draft'
                  ? renderDraftRowMenu()
                  : renderAssessmentRowMenu({ assessmentId: item.action })}
              `
            })).join('') : renderDashboardEmptyState({
              title: 'Nothing needs attention right now.',
              body: 'Start a guided assessment, load the sample path, or use a template when you want a faster first pass.',
              primaryId: 'btn-empty-next-new',
              primaryLabel: 'Start Guided Assessment',
              secondaryId: 'btn-empty-next-sample',
              secondaryLabel: 'Try Sample Assessment'
            })
          })}
        </section>

        <section class="dashboard-primary-band dashboard-primary-band--recent">
          ${UI.dashboardSectionCard({
            title: roleFrontDoor.recentTitle,
            description: roleFrontDoor.recentDescription,
            badge: compactRecentAssessments.length,
            className: 'dashboard-section-card--recent',
            body: portfolioRecentBody
          })}
        </section>

        <section class="dashboard-primary-band dashboard-primary-band--register">
          ${UI.dashboardSectionCard({
            title: 'Living risk register',
            description: 'A continuously updated operating register built from saved results. Scan posture, owner, last review date, and next review due before you open the full assessment.',
            badge: livingRegisterRows.length,
            className: 'dashboard-section-card--secondary dashboard-section-card--support',
            body: livingRegisterBody
          })}
        </section>

        <section class="grid-2 dashboard-secondary-grid">
          <div class="dashboard-column">
            <details class="dashboard-disclosure card card--elevated dashboard-section-card dashboard-section-card--secondary" ${isOversightUser ? 'open' : ''}>
              <summary>${isOversightUser ? 'Context you own' : roleFrontDoor.contextTitle} <span class="badge badge--neutral">${focusAreas.length ? 'Ready' : 'Needs setup'}</span></summary>
              <div class="dashboard-disclosure-copy">${roleFrontDoor.contextDescription}</div>
              <div class="dashboard-disclosure-body">
                <div class="card card--elevated dashboard-context-card dashboard-context-card--nested">
                  <div class="results-section-heading">${isOversightUser ? 'Managed context' : 'Current profile'}</div>
                  <div class="context-panel-copy" style="margin-top:10px">${escapeDashboardText(workspaceSummary)}</div>
                  <div class="form-help" style="margin-top:12px">${escapeDashboardText(guidanceSummary)}</div>
                  <div class="form-help" style="margin-top:8px">${profile.workingContext ? 'Working context is saved and will be reused in assisted steps.' : 'Add working context in Personal Settings to improve assisted suggestions.'}</div>
                  <div class="flex items-center gap-3 mt-5" style="flex-wrap:wrap">
                    <button class="btn btn--secondary" id="btn-dashboard-settings-secondary">${isOversightUser ? oversightContextActionLabel : 'Open Settings'}</button>
                  </div>
                </div>
                <details class="dashboard-disclosure dashboard-disclosure--nested">
                  <summary>${roleFrontDoor.playbookTitle} <span class="badge badge--neutral">${capability.roleSummary}</span></summary>
                  <div class="dashboard-disclosure-copy">${roleFrontDoor.playbookDescription}</div>
                  <div class="dashboard-disclosure-body">
                    ${renderNonAdminHowToGuide(capability)}
                  </div>
                </details>
              </div>
            </details>
          </div>

          <div class="dashboard-column">
            ${watchlistMarkup}
            <div class="card card--elevated dashboard-section-card dashboard-section-card--secondary dashboard-section-card--support">
              <div class="results-section-heading">What you can start next</div>
              <div class="context-panel-copy" style="margin-top:10px">${queueNeedsAttention
                ? 'Keep new assessments secondary until the active review lane is clear. Start paths stay available here, while workspace tools stay separate.'
                : 'When the queue is clear and the owned context is current, start a guided assessment only when it will materially improve decision quality.'}</div>
              <div class="flex items-center gap-3 mt-5" style="flex-wrap:wrap">
                ${!queueNeedsAttention && !contextNeedsAttention ? '<button type="button" class="btn btn--ghost" id="btn-dashboard-start-next-guided">Start Guided Assessment</button>' : ''}
                <button type="button" class="btn btn--ghost" id="btn-dashboard-start-next-sample">${isOversightUser ? 'View Worked Example' : 'Try Sample Assessment'}</button>
                <details class="results-actions-disclosure dashboard-hero-overflow">
                  <summary class="btn btn--ghost btn--sm">Other start paths</summary>
                  <div class="results-actions-disclosure-menu">
                    <button class="btn btn--secondary btn--sm" id="btn-dashboard-start-template-support">Start from Template</button>
                  </div>
                </details>
              </div>
              <div class="form-help dashboard-support-note">Start actions live here. Export, import, and broader workspace tools stay in reference and history so this lane keeps one job.</div>
            </div>
          </div>
        </section>

        <section class="dashboard-open-band dashboard-open-band--compact" style="margin-top:var(--sp-12)">
          <div class="results-section-heading">At a glance</div>
          <div class="form-help" style="margin-top:8px">A compact view of current attention, completed work, and context quality.</div>
        </section>

        <section class="dashboard-glance-strip" style="margin-top:var(--sp-4)">
          ${roleFrontDoor.overviewCards.map(card => `
            <div class="dashboard-glance-stat">
              <span class="dashboard-glance-stat__label">${card.label}</span>
              <strong>${card.value}</strong>
              <span>${card.foot}</span>
            </div>
          `).join('')}
        </section>

        ${workspaceValueSummary && workspaceValueSummary.completedAssessments ? `
          <section class="dashboard-open-band dashboard-open-band--compact dashboard-value-band" style="margin-top:var(--sp-8)">
            <div class="results-section-heading">Workspace value so far</div>
            <div class="form-help" style="margin-top:8px">Use this to explain the working value of the platform without mixing measured cycle time, directional savings, and modelled better-outcome reduction into one inflated ROI number.</div>
          </section>
          <section class="dashboard-glance-strip dashboard-glance-strip--value" style="margin-top:var(--sp-4)">
            ${[
              {
                label: 'Completed outputs',
                value: workspaceValueSummary.completedAssessments,
                foot: `${workspaceValueSummary.completedAssessments} saved result${workspaceValueSummary.completedAssessments === 1 ? '' : 's'} are currently contributing to the workspace story.`
              },
              {
                label: 'Average cycle time',
                value: workspaceValueSummary.averageCycleLabel,
                foot: 'Measured from first saved draft to completed assessment.'
              },
              {
                label: 'Internal effort avoided',
                value: workspaceValueSummary.internalHoursAvoidedLabel,
                foot: 'Directional hours avoided versus the domain baseline library.'
              },
              {
                label: 'External specialist equivalent',
                value: workspaceValueSummary.externalEquivalentDaysLabel,
                foot: 'Directional Big 4-style UAE advisory effort benchmark.'
              }
            ].map(card => `
              <div class="dashboard-glance-stat">
                <span class="dashboard-glance-stat__label">${card.label}</span>
                <strong>${card.value}</strong>
                <span>${card.foot}</span>
              </div>
            `).join('')}
          </section>
          <div class="dashboard-value-note">
            <span>Directional value at the current Big 4-style UAE rate card: <strong>${fmtCurrency(workspaceValueSummary.internalCostAvoidedUsd)}</strong> internal cost avoided and <strong>${fmtCurrency(workspaceValueSummary.externalEquivalentValueUsd)}</strong> external-equivalent value.</span>
            <span>${workspaceValueSummary.trackedReductionCases ? `Modelled annual reduction from saved better-outcome cases: ${fmtCurrency(workspaceValueSummary.totalModelledReductionUsd)}.` : 'No saved better-outcome case is attached yet, so modelled reduction is not included.'}</span>
          </div>
        ` : ''}

        <section class="grid-2 dashboard-secondary-grid dashboard-secondary-grid--history">
          <div class="dashboard-column">
            <div class="results-section-heading">Reference and history</div>
            <div class="form-help" style="margin-top:8px;margin-bottom:var(--sp-4)">Open archived items and supporting context only when you need them.</div>
            <details class="dashboard-disclosure dashboard-history-panel dashboard-history-panel--tools">
              <summary>Workspace tools <span class="badge badge--neutral">Utilities</span></summary>
              <div class="dashboard-disclosure-copy">Use these when you need to move data, reopen settings, or manage the workspace outside the main work-start flow.</div>
              <div class="dashboard-disclosure-body">
                <div class="dashboard-utility-actions">
                  ${!isOversightUser ? `<button class="btn btn--secondary btn--sm" id="btn-dashboard-open-settings">${primarySettingsLabel}</button>` : ''}
                  <button class="btn btn--secondary btn--sm" id="btn-dashboard-export-assessments-support">Export Assessments</button>
                  <button class="btn btn--secondary btn--sm" id="btn-dashboard-import-assessments-support">Import Assessments</button>
                </div>
              </div>
            </details>
            <details class="dashboard-disclosure dashboard-history-panel" ${archivedAssessments.length ? '' : ''}>
              <summary>Archived items <span class="badge badge--neutral">${archivedAssessments.length}</span></summary>
              <div class="dashboard-disclosure-copy">Stored out of the way, but still available if you need them again.</div>
              <div class="dashboard-disclosure-body">${archivedAssessments.length ? archivedAssessments.map(assessment => UI.dashboardAssessmentRow({
                title: escapeDashboardText(assessment.scenarioTitle || 'Untitled scenario'),
                detail: `Archived ${escapeDashboardText(new Date(assessment.archivedAt || assessment.completedAt || assessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }))}${hasResults(assessment) ? ' · Completed assessment' : ' · Draft snapshot'}`,
                badgeClass: 'badge--neutral',
                badgeLabel: 'Archived',
                actions: `
                  <button type="button" class="btn btn--ghost btn--sm dashboard-restore-assessment" data-assessment-id="${escapeDashboardText(assessment.id || '')}">${hasResults(assessment) ? 'Restore to Dashboard' : 'Resume as Draft'}</button>
                  ${renderAssessmentRowMenu({ assessmentId: assessment.id, includeDuplicate: false, includeArchive: false, includeDelete: true, includeOpen: hasResults(assessment) })}
                `
              })).join('') : renderDashboardEmptyState({
                title: 'Nothing is archived right now.',
                body: 'Archived drafts and results stay here so you can restore them later without cluttering the active dashboard.',
                primaryId: 'btn-empty-archived-template',
                primaryLabel: 'Start from Template'
              })}</div>
            </details>
          </div>
        </section>
      </div>
    </main>`);
  document.getElementById('btn-dashboard-new-assessment')?.addEventListener('click', () => {
    if (isOversightUser && contextNeedsAttention) {
      Router.navigate('/settings');
      return;
    }
    if (isOversightUser && hasDraft) {
      openDraftWorkspaceRoute();
      return;
    }
    if (isOversightUser && assessmentsNeedingReview.length) {
      Router.navigate(`/results/${assessmentsNeedingReview[0].id}`);
      return;
    }
    resetDraft();
    openDraftWorkspaceRoute();
  });
  document.getElementById('btn-dashboard-upload-register')?.addEventListener('click', () => {
    resetDraft();
    AppState.dashboardStartIntent = 'register';
    openDraftWorkspaceRoute();
  });
  document.getElementById('btn-dashboard-start-template')?.addEventListener('click', () => {
    launchTemplateStart();
  });
  document.getElementById('btn-dashboard-start-template-support')?.addEventListener('click', () => {
    launchTemplateStart();
  });
  document.getElementById('btn-dashboard-start-sample')?.addEventListener('click', () => launchSampleStart());
  document.getElementById('btn-dashboard-start-next-sample')?.addEventListener('click', () => launchSampleStart());
  document.getElementById('btn-dashboard-start-next-guided')?.addEventListener('click', () => {
    launchGuidedAssessmentStart();
  });
  document.getElementById('btn-empty-next-new')?.addEventListener('click', () => {
    launchGuidedAssessmentStart();
  });
  document.getElementById('btn-empty-next-sample')?.addEventListener('click', () => launchSampleStart());
  document.getElementById('btn-empty-recent-template')?.addEventListener('click', () => {
    launchTemplateStart();
  });
  document.getElementById('btn-empty-recent-sample')?.addEventListener('click', () => launchSampleStart());
  document.getElementById('btn-empty-register-new')?.addEventListener('click', () => {
    launchGuidedAssessmentStart();
  });
  document.getElementById('btn-empty-register-sample')?.addEventListener('click', () => launchSampleStart());
  document.getElementById('btn-empty-archived-template')?.addEventListener('click', () => {
    launchTemplateStart();
  });
  document.getElementById('btn-dashboard-open-settings')?.addEventListener('click', () => Router.navigate('/settings'));
  document.getElementById('btn-dashboard-settings-secondary')?.addEventListener('click', () => Router.navigate('/settings'));
  document.getElementById('btn-dashboard-continue-draft')?.addEventListener('click', () => openDraftWorkspaceRoute());
  const _handleNewAssessmentOversight = () => {
    if (hasDraft) {
      UI.confirm(
        'You have a draft in progress. Starting a new assessment ' +
        'will clear the current draft. Continue?'
      ).then(confirmed => {
        if (confirmed) launchGuidedAssessmentStart();
      });
    } else {
      launchGuidedAssessmentStart();
    }
  };
  document.getElementById('btn-dashboard-new-assessment-oversight')
    ?.addEventListener('click', _handleNewAssessmentOversight);
  document.getElementById('btn-dashboard-new-assessment-support')
    ?.addEventListener('click', _handleNewAssessmentOversight);
  document.getElementById('btn-dashboard-run-demo')?.addEventListener('click', () => {
    if (typeof DemoMode === 'undefined') {
      UI.toast('Demo mode is not loaded.', 'warning');
      return;
    }
    if (DemoMode.isDemoRunning()) {
      UI.toast('Demo is already running.', 'warning');
      return;
    }
    UI.toast('Starting live demo — this will take about 20 seconds.', 'info', 4000);
    DemoMode.runDemo();
  });
  document.getElementById('btn-dashboard-export-assessments')?.addEventListener('click', () => {
    exportAssessmentsCollection();
  });
  document.getElementById('btn-dashboard-export-assessments-support')?.addEventListener('click', () => {
    exportAssessmentsCollection();
  });
  document.getElementById('btn-dashboard-import-assessments')?.addEventListener('click', () => {
    importAssessmentsCollection();
  });
  document.getElementById('btn-dashboard-import-assessments-support')?.addEventListener('click', () => {
    importAssessmentsCollection();
  });
  document.getElementById('btn-export-living-register')?.addEventListener('click', () => {
    try {
      ExportService.exportLivingRiskRegister(getAssessments(), AppState.currency, AppState.fxRate);
      UI.toast('Living register prepared for print or PDF save. Regenerate it after material changes.', 'success');
    } catch (error) {
      console.error('Living register export failed:', error);
      UI.toast('The living register could not be exported right now.', 'danger');
    }
  });
  document.getElementById('btn-export-living-register-csv')?.addEventListener('click', () => {
    try {
      ExportService.exportLivingRiskRegisterCsv(getAssessments(), AppState.currency, AppState.fxRate);
      UI.toast('Living register CSV downloaded.', 'success');
    } catch (error) {
      console.error('Living register CSV export failed:', error);
      UI.toast('The register CSV could not be exported right now.', 'danger');
    }
  });
  const portfolioHeatmap = document.getElementById('portfolio-heatmap');
  const portfolioListView = document.getElementById('portfolio-list-view');
  const dashboardListToolbar = document.getElementById('dashboard-list-toolbar');
  const portfolioHeatmapButton = document.getElementById('btn-view-heatmap');
  const portfolioListButton = document.getElementById('btn-view-list');
  const setPortfolioView = mode => {
    if (!portfolioHeatmap || !portfolioListView || !portfolioHeatmapButton || !portfolioListButton) return;
    const showHeatmap = mode !== 'list';
    portfolioHeatmap.style.display = showHeatmap ? 'block' : 'none';
    if (dashboardListToolbar) dashboardListToolbar.style.display = showHeatmap ? 'none' : 'flex';
    portfolioListView.style.display = showHeatmap ? 'none' : 'block';
    portfolioHeatmapButton.classList.toggle('active', showHeatmap);
    portfolioListButton.classList.toggle('active', !showHeatmap);
  };
  portfolioHeatmapButton?.addEventListener('click', () => setPortfolioView('heatmap'));
  portfolioListButton?.addEventListener('click', () => setPortfolioView('list'));
  document.getElementById('dash-filter-input')
    ?.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('[data-title]').forEach(row => {
        const match = !q ||
          row.dataset.title.includes(q) ||
          row.dataset.bu.includes(q);
        row.style.display = match ? '' : 'none';
      });
    });
  document.getElementById('dash-sort-select')
    ?.addEventListener('change', function() {
      const listEl = this.closest('.dashboard-list-toolbar')?.nextElementSibling;
      if (!listEl) return;
      const rows = Array.from(listEl.querySelectorAll('[data-title]'));
      rows.sort((a, b) => {
        if (this.value === 'date-desc') return Number(b.dataset.date) - Number(a.dataset.date);
        if (this.value === 'date-asc') return Number(a.dataset.date) - Number(b.dataset.date);
        if (this.value === 'loss-desc') return Number(b.dataset.loss) - Number(a.dataset.loss);
        if (this.value === 'status') return a.dataset.status.localeCompare(b.dataset.status);
        return 0;
      });
      rows.forEach(row => listEl.appendChild(row));
    });
  setPortfolioView(portfolioDefaultView);
  document.querySelectorAll('#portfolio-heatmap [data-id]').forEach(el =>
    el.addEventListener('click', () => Router.navigate('/results/' + el.dataset.id))
  );
  document.querySelector('main.page')?.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    const row = target.closest('.dashboard-assessment-row');
    const id = target.dataset.assessmentId || row?.dataset.assessmentId || '';
    event.preventDefault();
    event.stopPropagation();

    try {
      if (target.classList.contains('dashboard-open-action')) {
        if (id === 'draft') {
          openDraftWorkspaceRoute();
          return;
        }
        if (id) Router.navigate(`/results/${id}`);
        return;
      }

      if (target.classList.contains('dashboard-archive-assessment')) {
        if (!id) return;
        if (!await confirmDestructiveAction({
          title: 'Archive assessment',
          body: 'Move this assessment out of the main dashboard. You can still restore it later from Archived items.',
          confirmLabel: 'Archive'
        })) return;
        if (!archiveAssessment(id)) { UI.toast('Could not find that assessment to archive.', 'warning'); return; }
        renderUserDashboard();
        UI.toast('Assessment archived.', 'success');
        return;
      }

      if (target.classList.contains('dashboard-duplicate-assessment')) {
        if (!id) return;
        const duplicated = duplicateAssessmentToDraft(id);
        if (!duplicated) {
          UI.toast('That assessment could not be duplicated right now.', 'warning');
          return;
        }
        UI.toast('Assessment duplicated into a new draft.', 'success');
        openDraftWorkspaceRoute();
        return;
      }

      if (target.classList.contains('dashboard-delete-assessment')) {
        if (!id) return;
        if (!await confirmDestructiveAction({
          title: 'Delete assessment',
          body: 'Delete this saved assessment from your workspace. This cannot be undone from the dashboard.',
          confirmLabel: 'Delete'
        })) return;
        if (!deleteAssessment(id)) { UI.toast('Could not find that assessment to delete.', 'warning'); return; }
        renderUserDashboard();
        UI.toast('Assessment deleted.', 'success');
        return;
      }

      if (target.classList.contains('dashboard-archive-draft')) {
        if (!await confirmDestructiveAction({
          title: 'Archive current draft',
          body: 'Move the current draft out of the active dashboard while keeping it available in Archived items.',
          confirmLabel: 'Archive'
        })) return;
        const archived = archiveCurrentDraft();
        if (!archived) {
          UI.toast('There is no draft to archive yet.', 'warning');
          return;
        }
        renderUserDashboard();
        UI.toast('Draft archived.', 'success');
        return;
      }

      if (target.classList.contains('dashboard-delete-draft')) {
        if (!await confirmDestructiveAction({
          title: 'Delete current draft',
          body: 'Delete the current in-progress draft from this workspace. Use archive instead if you may want it later.',
          confirmLabel: 'Delete'
        })) return;
        deleteCurrentDraft();
        renderUserDashboard();
        UI.toast('Draft deleted.', 'success');
        return;
      }

      if (target.classList.contains('dashboard-restore-assessment')) {
        if (!id) return;
        const assessment = getAssessmentById(id);
        if (!assessment) return;
        if (hasResults(assessment)) {
          unarchiveAssessment(id);
          renderUserDashboard();
          UI.toast('Archived assessment restored to your dashboard.', 'success');
          return;
        }
        restoreArchivedDraftToWorkspace(id);
        UI.toast('Archived draft restored to your active workspace.', 'success');
        openDraftWorkspaceRoute();
      }
    } catch (error) {
      UI.toast('That action could not be completed. Try again in a moment.', 'danger');
    }
  });
}

function openDraftWorkspaceRoute() {
  Router.navigate('/wizard/1');
  if (typeof window !== 'undefined' && window.location.hash !== '#/wizard/1') {
    window.location.hash = '/wizard/1';
  }
  Router.resolve?.();
}

/* Add to app.css — dashboard-watchlist-delta */
/*
.dashboard-watchlist-delta {
  font-size: .78rem;
  color: var(--text-muted);
  margin-top: var(--sp-1);
  margin-bottom: var(--sp-1);
  line-height: 1.5;
  font-style: italic;
}
*/
