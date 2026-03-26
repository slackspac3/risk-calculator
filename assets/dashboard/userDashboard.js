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
  const draftTitle = String(AppState.draft?.scenarioTitle || AppState.draft?.narrative || '').trim();
  const hasDraft = Boolean(draftTitle);
  const draftLifecycle = getAssessmentLifecyclePresentation(AppState.draft || {});
  const focusAreas = Array.isArray(profile.focusAreas) ? profile.focusAreas.filter(Boolean) : [];
  const assessmentsNeedingReview = assessments.filter(a => a?.results && (a.results.toleranceBreached || a.results.nearTolerance || a.results.annualReviewTriggered)).slice(0, 3);
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
  const recommendedTemplate = Array.isArray(ScenarioTemplates) ? ScenarioTemplates[0] : null;
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
              <div class="landing-badge">Personal Dashboard</div>
              <h2 style="margin-top:var(--sp-4)">Welcome back, ${user?.displayName || 'there'}.</h2>
              <p style="margin-top:10px;color:rgba(255,255,255,.74);max-width:680px">This is your main working space. Start a new assessment, resume unfinished work, or review completed results from here.</p>
              <div class="dashboard-hero-actions flex items-center gap-3 mt-6" style="flex-wrap:wrap">
                <button class="btn btn--primary btn--lg" id="btn-dashboard-new-assessment" aria-label="Start a New Risk Assessment">Start Guided Assessment</button>
                <button class="btn btn--secondary" id="btn-dashboard-start-template">Start from Template</button>
                <button class="btn btn--ghost" id="btn-dashboard-start-sample">Try Sample Assessment</button>
                <button class="btn btn--secondary" id="btn-dashboard-continue-draft" ${hasDraft ? '' : 'disabled'}>Resume Draft</button>
                <button class="btn btn--ghost" id="btn-dashboard-open-settings">${capability.experience.primaryActionLabel}</button>
                <button class="btn btn--ghost" id="btn-dashboard-export-assessments">Export Assessments</button>
                <button class="btn btn--ghost" id="btn-dashboard-import-assessments">Import Assessments</button>
              </div>
            </div>
            <div class="card dashboard-hero-side">
              <div class="context-panel-title">What to do next</div>
              <div class="context-panel-copy" style="margin-top:8px">${quickStatus}</div>
              <div class="form-help" style="margin-top:10px;color:rgba(255,255,255,.65)">${capability.experience.dashboardLead}</div>
              <div class="form-help" style="margin-top:10px;color:rgba(255,255,255,.65)">Current access: ${capability.roleSummary} · Default geography: ${settings.geographyPrimary || settings.geography || globalSettings.geography}</div>
            </div>
          </div>
        </section>

        <section class="admin-overview-grid dashboard-at-a-glance" style="margin-top:var(--sp-8)">
          ${UI.dashboardOverviewCard({
            label: 'Open work',
            value: openAssessmentRows.length,
            foot: 'Drafts and results that are most likely to need attention now.'
          })}
          ${UI.dashboardOverviewCard({
            label: 'Completed assessments',
            value: assessments.length,
            foot: latestAssessment ? `Latest: ${new Date(latestAssessment.completedAt || latestAssessment.createdAt || Date.now()).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No completed assessments yet'
          })}
          ${UI.dashboardOverviewCard({
            label: 'Needs review',
            value: assessmentsNeedingReview.length,
            foot: assessmentsNeedingReview.length ? 'Scenarios near or above tolerance are ready for review.' : 'Nothing currently stands out for urgent review.'
          })}
        </section>

        <section class="grid-2 dashboard-main-grid">
          <div class="dashboard-column">
            ${UI.dashboardSectionCard({
              title: 'Next up',
              description: 'Resume unfinished work or open the results that most likely need attention.',
              badge: openAssessmentRows.length,
              body: openAssessmentRows.length ? openAssessmentRows.map(item => UI.dashboardAssessmentRow({
                assessmentId: item.action,
                title: item.title,
                detail: item.detail,
                badgeClass: /above tolerance/i.test(item.status) ? 'badge--danger' : /review/i.test(item.status) ? 'badge--warning' : 'badge--gold',
                badgeLabel: item.status,
                actions: `
                  <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${item.action}">${item.actionLabel}</button>
                  ${item.action === 'draft'
                    ? '<button type="button" class="btn btn--ghost btn--sm dashboard-archive-draft">Archive</button><button type="button" class="btn btn--ghost btn--sm dashboard-delete-draft">Delete</button>'
                    : `<button type="button" class="btn btn--ghost btn--sm dashboard-duplicate-assessment" data-assessment-id="${item.action}">Duplicate</button><button type="button" class="btn btn--ghost btn--sm dashboard-archive-assessment" data-assessment-id="${item.action}">Archive</button><button type="button" class="btn btn--ghost btn--sm dashboard-delete-assessment" data-assessment-id="${item.action}">Delete</button>`}
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
              title: 'Recent assessments',
              description: 'Your latest saved analysis outputs.',
              badge: recentAssessments.length,
              body: recentAssessments.length ? recentAssessments.map(assessment => {
                const lifecycle = getAssessmentLifecyclePresentation(assessment);
                return UI.dashboardAssessmentRow({
                assessmentId: assessment.id,
                title: assessment.scenarioTitle || 'Untitled assessment',
                detail: `${assessment.buName || profile.businessUnit || user?.businessUnit || 'Business unit not set'} · ${new Date(assessment.completedAt || assessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}`,
                badgeClass: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED ? 'badge--gold' : assessment.results?.toleranceBreached ? 'badge--danger' : assessment.results?.nearTolerance ? 'badge--warning' : lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT ? 'badge--gold' : 'badge--success',
                badgeLabel: lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED || lifecycle.status === ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT ? lifecycle.label : assessment.results?.toleranceBreached ? 'Above tolerance' : assessment.results?.nearTolerance ? 'Close to tolerance' : lifecycle.label,
                actions: `
                  <button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${assessment.id}">Open Result</button>
                  <button type="button" class="btn btn--ghost btn--sm dashboard-duplicate-assessment" data-assessment-id="${assessment.id}">Duplicate</button>
                  <button type="button" class="btn btn--ghost btn--sm dashboard-archive-assessment" data-assessment-id="${assessment.id}">Archive</button>
                  <button type="button" class="btn btn--ghost btn--sm dashboard-delete-assessment" data-assessment-id="${assessment.id}">Delete</button>
                `
                });
              }).join('') : renderDashboardEmptyState({
                title: 'No completed assessments yet.',
                body: 'Use a template if you want a structured starting point, or run the sample path once to see the full pilot workflow.',
                primaryId: 'btn-empty-recent-template',
                primaryLabel: 'Start from Template',
                secondaryId: 'btn-empty-recent-sample',
                secondaryLabel: 'Try Sample Assessment'
              })
            })}

            <details class="dashboard-disclosure card card--elevated dashboard-section-card">
              <summary>Your settings and saved context <span class="badge badge--neutral">${focusAreas.length ? 'Ready' : 'Needs setup'}</span></summary>
              <div class="dashboard-disclosure-copy">Reference information that shapes AI-assisted output and your default working context.</div>
              <div class="dashboard-disclosure-body">
                <div class="card card--elevated dashboard-context-card dashboard-context-card--nested">
                  <div class="results-section-heading">Current profile</div>
                  <div class="context-panel-copy" style="margin-top:10px">${workspaceSummary}</div>
                  <div class="form-help" style="margin-top:12px">${guidanceSummary}</div>
                  <div class="form-help" style="margin-top:8px">${profile.workingContext ? 'Working context is saved and will be reused in AI-assisted steps.' : 'Add working context in Personal Settings to improve AI-assisted outputs.'}</div>
                  <div class="flex items-center gap-3 mt-5" style="flex-wrap:wrap">
                    <button class="btn btn--secondary" id="btn-dashboard-settings-secondary">Open Settings</button>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <div class="dashboard-column">
            <details class="dashboard-disclosure card card--elevated dashboard-section-card" open>
              <summary>How to use this platform <span class="badge badge--neutral">${capability.roleSummary}</span></summary>
              <div class="dashboard-disclosure-copy">Guidance matched to the access and responsibilities you currently have.</div>
              <div class="dashboard-disclosure-body">
                ${renderNonAdminHowToGuide(capability)}
              </div>
            </details>

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
                  ${hasResults(assessment) ? `<button type="button" class="btn btn--ghost btn--sm dashboard-open-action" data-assessment-id="${assessment.id}">Open Result</button>` : ''}
                  <button type="button" class="btn btn--ghost btn--sm dashboard-delete-assessment" data-assessment-id="${assessment.id}">Delete</button>
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
    resetDraft();
    Router.navigate('/wizard/1');
  });
  document.getElementById('btn-dashboard-start-template')?.addEventListener('click', () => {
    if (recommendedTemplate) loadTemplate(recommendedTemplate);
  });
  document.getElementById('btn-dashboard-start-sample')?.addEventListener('click', () => launchPilotSampleAssessment());
  document.getElementById('btn-empty-next-new')?.addEventListener('click', () => {
    resetDraft();
    Router.navigate('/wizard/1');
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
  document.getElementById('btn-dashboard-continue-draft')?.addEventListener('click', () => Router.navigate('/wizard/1'));
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
        const cache = ensureUserStateCache();
        cache.assessments = merged;
        localStorage.setItem(buildUserStorageKey(ASSESSMENTS_STORAGE_PREFIX), JSON.stringify(merged));
        queueSharedUserStateSync({ assessments: merged });
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
          Router.navigate('/wizard/1');
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
        Router.navigate('/wizard/1');
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
        Router.navigate('/wizard/1');
      }
    } catch (error) {
      UI.toast('That action could not be completed. Try again in a moment.', 'danger');
    }
  });
}
