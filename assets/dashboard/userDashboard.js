function renderUserDashboard() {
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

  const user = AppState.currentUser || AuthService.getCurrentUser();
  const globalSettings = getAdminSettings();
  const profile = normaliseUserProfile(settings.userProfile, user);
  const capability = getNonAdminCapabilityState(user, settings, globalSettings);
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
  const recentAssessments = assessments.slice(0, 4);
  const latestAssessment = recentAssessments[0] || null;
  const compactRecentAssessments = assessments.slice(0, 3);
  const draftTitle = String(AppState.draft?.scenarioTitle || AppState.draft?.narrative || '').trim();
  const hasDraft = Boolean(draftTitle);
  const draftLifecycle = getAssessmentLifecyclePresentation(AppState.draft || {});
  const focusAreas = Array.isArray(profile.focusAreas) ? profile.focusAreas.filter(Boolean) : [];
  const assessmentsNeedingReview = assessments.filter(a => a?.results && (a.results.toleranceBreached || a.results.nearTolerance || a.results.annualReviewTriggered)).slice(0, 3);
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
  const recommendedTemplate = Array.isArray(ScenarioTemplates) ? ScenarioTemplates[0] : null;
  const primarySettingsLabel = capability.canManageBusinessUnit || capability.canManageDepartment
    ? capability.experience.primaryActionLabel
    : 'Personal Settings';
  const isOversightUser = capability.canManageBusinessUnit || capability.canManageDepartment;
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
        primaryActionLabel: assessmentsNeedingReview.length ? 'Review Priority Item' : hasDraft ? 'Resume Draft' : primarySettingsLabel,
        heroHint: 'Keep the front door focused on attention, context, and oversight. Templates, imports, and other utilities stay available only when you need them.',
        secondaryActionLabel: primarySettingsLabel,
        secondaryActionId: 'settings',
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
            label: 'Context coverage',
            value: contextReadinessLabel,
            foot: contextReadinessScore >= 5 ? 'Saved context is strong enough to support grounded drafting and review.' : 'Tighten role or context settings before relying too heavily on assisted output.'
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
  const compactRecentRows = compactRecentAssessments.map(assessment => {
    const lifecycle = getAssessmentLifecyclePresentation(assessment);
    return UI.dashboardAssessmentRow({
      assessmentId: assessment.id,
      title: assessment.scenarioTitle || 'Untitled assessment',
      detail: `${assessment.buName || profile.businessUnit || user?.businessUnit || 'Business unit not set'} · ${new Date(assessment.completedAt || assessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}`,
      badgeClass: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED ? 'badge--gold' : assessment.results?.toleranceBreached ? 'badge--danger' : assessment.results?.nearTolerance ? 'badge--warning' : lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT ? 'badge--gold' : 'badge--success',
      badgeLabel: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED || lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT ? lifecycle.label : assessment.results?.toleranceBreached ? 'Above tolerance' : assessment.results?.nearTolerance ? 'Close to tolerance' : lifecycle.label,
      actions: `
        <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${assessment.id}">Open</button>
        <details class="results-actions-disclosure dashboard-row-overflow">
          <summary class="btn btn--ghost btn--sm">More</summary>
          <div class="results-actions-disclosure-menu">
            <button type="button" class="btn btn--secondary btn--sm dashboard-duplicate-assessment" data-assessment-id="${assessment.id}">Duplicate</button>
            <button type="button" class="btn btn--secondary btn--sm dashboard-archive-assessment" data-assessment-id="${assessment.id}">Archive</button>
            <button type="button" class="btn btn--secondary btn--sm dashboard-delete-assessment" data-assessment-id="${assessment.id}">Delete</button>
          </div>
        </details>
      `
    });
  }).join('');
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
  const renderDashboardEmptyState = ({ title, body, primaryId, primaryLabel, secondaryId = '', secondaryLabel = '' }) => `<div class="empty-state">
    <strong>${title}</strong>
    <div style="margin-top:8px">${body}</div>
    <div class="flex items-center gap-3" style="margin-top:14px;flex-wrap:wrap">
      <button type="button" class="btn btn--secondary btn--sm" id="${primaryId}">${primaryLabel}</button>
      ${secondaryId ? `<button type="button" class="btn btn--ghost btn--sm" id="${secondaryId}">${secondaryLabel}</button>` : ''}
    </div>
  </div>`;

  setPage(`
    <main class="page">
      <div class="container container--wide dashboard-shell">
        <section class="card card--elevated dashboard-hero">
          <div class="dashboard-hero-grid">
            <div class="dashboard-hero-main">
              <div class="landing-badge">${roleFrontDoor.badge}</div>
              <h2 style="margin-top:var(--sp-4)">Welcome back, ${user?.displayName || 'there'}.</h2>
              <p class="dashboard-hero-copy">${roleFrontDoor.heroCopy}</p>
              <div class="dashboard-signal-strip">
                <div class="dashboard-signal-pill">
                  <span class="dashboard-signal-pill__label">Primary lane</span>
                  <strong>${roleLaneTitle}</strong>
                  <span>${roleFrontDoor.roleLaneCopy}</span>
                </div>
                <div class="dashboard-signal-pill">
                  <span class="dashboard-signal-pill__label">Workspace status</span>
                  <strong>${hasDraft ? 'Draft in progress' : assessmentsNeedingReview.length ? 'Review queue active' : 'Clear to start'}</strong>
                  <span>${roleFrontDoor.quickStatus}</span>
                </div>
                <div class="dashboard-signal-pill">
                  <span class="dashboard-signal-pill__label">Context readiness</span>
                  <strong>${contextReadinessLabel}</strong>
                  <span>${guidanceSummary}</span>
                </div>
              </div>
              <div class="dashboard-hero-actions flex items-center gap-3 mt-6" style="flex-wrap:wrap">
                <button class="btn btn--primary btn--lg" id="btn-dashboard-new-assessment" aria-label="${roleFrontDoor.primaryActionLabel}">${roleFrontDoor.primaryActionLabel}</button>
                <button class="btn btn--secondary" id="btn-dashboard-hero-secondary">${roleFrontDoor.secondaryActionLabel}</button>
                <details class="results-actions-disclosure dashboard-hero-overflow">
                  <summary class="btn btn--ghost">${isOversightUser ? 'More oversight tools' : 'More workspace tools'}</summary>
                  <div class="results-actions-disclosure-menu">
                    ${hasDraft ? `<button class="btn btn--secondary btn--sm" id="btn-dashboard-continue-draft">Resume Draft</button>` : ''}
                    <button class="btn btn--secondary btn--sm" id="btn-dashboard-start-template">Start from Template</button>
                    <button class="btn btn--secondary btn--sm" id="btn-dashboard-start-sample">${isOversightUser ? 'View Worked Example' : 'Try Sample Assessment'}</button>
                    <button class="btn btn--secondary btn--sm" id="btn-dashboard-export-assessments">Export Assessments</button>
                    <button class="btn btn--secondary btn--sm" id="btn-dashboard-import-assessments">Import Assessments</button>
                    <button class="btn btn--secondary btn--sm" id="btn-dashboard-open-settings">${primarySettingsLabel}</button>
                  </div>
                </details>
              </div>
              <div class="form-help" style="margin-top:12px;color:rgba(255,255,255,.65)">${roleFrontDoor.heroHint}</div>
            </div>
            <div class="card dashboard-hero-side">
              <div class="context-panel-title">${isOversightUser ? 'Oversight picture' : 'Today&apos;s operating picture'}</div>
              <div class="dashboard-focus-stack">
                <div class="dashboard-focus-card">
                  <span class="dashboard-focus-card__label">Recommended next move</span>
                  <strong>${roleLaneTitle}</strong>
                  <div class="context-panel-copy">${roleFrontDoor.quickStatus}</div>
                </div>
                <div class="dashboard-focus-card">
                  <span class="dashboard-focus-card__label">${isOversightUser ? 'Managed scope' : 'Role lens'}</span>
                  <strong>${capability.roleSummary}</strong>
                  <div class="context-panel-copy">${capability.experience.dashboardLead}</div>
                </div>
                <div class="dashboard-focus-card">
                  <span class="dashboard-focus-card__label">Default context in use</span>
                  <strong>${settings.geographyPrimary || settings.geography || globalSettings.geography}</strong>
                  <div class="context-panel-copy">This geography and your saved profile shape default wording, guidance, and assisted suggestions.</div>
                </div>
                <div class="dashboard-focus-card dashboard-focus-card--spotlight">
                  <span class="dashboard-focus-card__label">${roleFrontDoor.spotlightTitle}</span>
                  <strong>${isOversightUser ? primarySettingsLabel : (recommendedTemplate ? 'Worked example ready' : 'Template-ready workspace')}</strong>
                  <div class="context-panel-copy">${roleFrontDoor.spotlightCopy}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="dashboard-status-band" aria-label="Status overview">
          ${attentionCards.map(card => `
            <div class="dashboard-status-chip dashboard-status-chip--${card.tone}">
              <span class="dashboard-status-chip__label">${card.label}</span>
              <strong>${card.value}</strong>
              <span>${card.note}</span>
            </div>
          `).join('')}
        </section>

        <section class="admin-overview-grid dashboard-at-a-glance" style="margin-top:var(--sp-8)">
          ${roleFrontDoor.overviewCards.map(card => UI.dashboardOverviewCard(card)).join('')}
        </section>

        <section class="grid-2 dashboard-main-grid">
          <div class="dashboard-column">
            ${UI.dashboardSectionCard({
              title: roleFrontDoor.nextUpTitle,
              description: roleFrontDoor.nextUpDescription,
              badge: openAssessmentRows.length,
              body: openAssessmentRows.length ? openAssessmentRows.map(item => UI.dashboardAssessmentRow({
                assessmentId: item.action,
                title: item.title,
                detail: item.detail,
                badgeClass: /above tolerance/i.test(item.status) ? 'badge--danger' : /review/i.test(item.status) ? 'badge--warning' : 'badge--gold',
                badgeLabel: item.status,
                actions: `
                  <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${item.action}">${item.actionLabel}</button>
                  <details class="results-actions-disclosure dashboard-row-overflow">
                    <summary class="btn btn--ghost btn--sm">More</summary>
                    <div class="results-actions-disclosure-menu">
                      ${item.action === 'draft'
                        ? '<button type="button" class="btn btn--secondary btn--sm dashboard-archive-draft">Archive</button><button type="button" class="btn btn--secondary btn--sm dashboard-delete-draft">Delete</button>'
                        : `<button type="button" class="btn btn--secondary btn--sm dashboard-duplicate-assessment" data-assessment-id="${item.action}">Duplicate</button><button type="button" class="btn btn--secondary btn--sm dashboard-archive-assessment" data-assessment-id="${item.action}">Archive</button><button type="button" class="btn btn--secondary btn--sm dashboard-delete-assessment" data-assessment-id="${item.action}">Delete</button>`}
                    </div>
                  </details>
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

            ${UI.dashboardSectionCard({
              title: roleFrontDoor.recentTitle,
              description: roleFrontDoor.recentDescription,
              badge: compactRecentAssessments.length,
              body: compactRecentRows || renderDashboardEmptyState({
                title: 'No completed assessments yet.',
                body: 'Use a template if you want a structured starting point, or run the sample path once to see the full pilot workflow.',
                primaryId: 'btn-empty-recent-template',
                primaryLabel: 'Start from Template',
                secondaryId: 'btn-empty-recent-sample',
                secondaryLabel: 'Try Sample Assessment'
              })
            })}

            <details class="dashboard-disclosure card card--elevated dashboard-section-card">
              <summary>${roleFrontDoor.contextTitle} <span class="badge badge--neutral">${focusAreas.length ? 'Ready' : 'Needs setup'}</span></summary>
              <div class="dashboard-disclosure-copy">${roleFrontDoor.contextDescription}</div>
              <div class="dashboard-disclosure-body">
                <div class="card card--elevated dashboard-context-card dashboard-context-card--nested">
                  <div class="results-section-heading">Current profile</div>
                  <div class="context-panel-copy" style="margin-top:10px">${workspaceSummary}</div>
                  <div class="form-help" style="margin-top:12px">${guidanceSummary}</div>
                  <div class="form-help" style="margin-top:8px">${profile.workingContext ? 'Working context is saved and will be reused in assisted steps.' : 'Add working context in Personal Settings to improve assisted suggestions.'}</div>
                  <div class="flex items-center gap-3 mt-5" style="flex-wrap:wrap">
                    <button class="btn btn--secondary" id="btn-dashboard-settings-secondary">Open Settings</button>
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
            <details class="dashboard-disclosure card card--elevated dashboard-section-card" ${archivedAssessments.length ? '' : ''}>
              <summary>Archived items <span class="badge badge--neutral">${archivedAssessments.length}</span></summary>
              <div class="dashboard-disclosure-copy">Stored out of the way, but still available if you need them again.</div>
              <div class="dashboard-disclosure-body">${archivedAssessments.length ? archivedAssessments.map(assessment => UI.dashboardAssessmentRow({
                title: assessment.scenarioTitle || 'Untitled scenario',
                detail: `Archived ${new Date(assessment.archivedAt || assessment.completedAt || assessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}${hasResults(assessment) ? ' · Completed assessment' : ' · Draft snapshot'}`,
                badgeClass: 'badge--neutral',
                badgeLabel: 'Archived',
                actions: `
                  <button type="button" class="btn btn--ghost btn--sm dashboard-restore-assessment" data-assessment-id="${assessment.id}">${hasResults(assessment) ? 'Restore to Dashboard' : 'Resume as Draft'}</button>
                  <details class="results-actions-disclosure dashboard-row-overflow">
                    <summary class="btn btn--ghost btn--sm">More</summary>
                    <div class="results-actions-disclosure-menu">
                      ${hasResults(assessment) ? `<button type="button" class="btn btn--secondary btn--sm dashboard-open-action" data-assessment-id="${assessment.id}">Open Result</button>` : ''}
                      <button type="button" class="btn btn--secondary btn--sm dashboard-delete-assessment" data-assessment-id="${assessment.id}">Delete</button>
                    </div>
                  </details>
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
    if (isOversightUser && hasDraft) {
      openDraftWorkspaceRoute();
      return;
    }
    if (isOversightUser && !hasDraft && assessmentsNeedingReview.length) {
      Router.navigate(`/results/${assessmentsNeedingReview[0].id}`);
      return;
    }
    if (isOversightUser && !hasDraft && !assessmentsNeedingReview.length) {
      Router.navigate('/settings');
      return;
    }
    resetDraft();
    openDraftWorkspaceRoute();
  });
  document.getElementById('btn-dashboard-hero-secondary')?.addEventListener('click', () => {
    if (roleFrontDoor.secondaryActionId === 'settings') {
      Router.navigate('/settings');
      return;
    }
    if (roleFrontDoor.secondaryActionId === 'template') {
      if (recommendedTemplate) loadTemplate(recommendedTemplate);
      return;
    }
    launchPilotSampleAssessment();
  });
  document.getElementById('btn-dashboard-start-template')?.addEventListener('click', () => {
    if (recommendedTemplate) loadTemplate(recommendedTemplate);
  });
  document.getElementById('btn-dashboard-start-sample')?.addEventListener('click', () => launchPilotSampleAssessment());
  document.getElementById('btn-empty-next-new')?.addEventListener('click', () => {
    resetDraft();
    openDraftWorkspaceRoute();
  });
  document.getElementById('btn-empty-next-sample')?.addEventListener('click', () => launchPilotSampleAssessment());
  document.getElementById('btn-empty-recent-template')?.addEventListener('click', () => {
    if (recommendedTemplate) loadTemplate(recommendedTemplate);
  });
  document.getElementById('btn-empty-recent-sample')?.addEventListener('click', () => launchPilotSampleAssessment());
  document.getElementById('btn-empty-archived-template')?.addEventListener('click', () => {
    if (recommendedTemplate) loadTemplate(recommendedTemplate);
  });
  document.getElementById('btn-dashboard-open-settings')?.addEventListener('click', () => Router.navigate('/settings'));
  document.getElementById('btn-dashboard-settings-secondary')?.addEventListener('click', () => Router.navigate('/settings'));
  document.getElementById('btn-dashboard-continue-draft')?.addEventListener('click', () => openDraftWorkspaceRoute());
  document.getElementById('btn-dashboard-export-assessments')?.addEventListener('click', () => {
    ExportService.exportDataAsJson(getAssessments(), `risk-calculator-assessments-${user?.username || 'user'}.json`);
  });
  document.getElementById('btn-dashboard-import-assessments')?.addEventListener('click', () => {
    ExportService.importJsonFile({
      onData: parsed => {
        if (!Array.isArray(parsed)) {
          UI.toast('That file does not contain an assessment list.', 'warning');
          return;
        }
        const existing = getAssessments();
        const merged = [...parsed, ...existing]
          .filter(item => item && typeof item === 'object' && item.id)
          .reduce((acc, item) => {
            if (!acc.find(existingItem => existingItem.id === item.id)) acc.push(item);
            return acc;
          }, []);
        persistSavedAssessmentsCollection(merged);
        renderUserDashboard();
        UI.toast('Assessments imported.', 'success');
      },
      onError: () => UI.toast('That JSON file could not be imported.', 'warning')
    });
  });
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
