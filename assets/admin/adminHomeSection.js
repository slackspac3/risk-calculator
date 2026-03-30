(function(global) {
  'use strict';

  function escapeAdminHomeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const AdminHomeSection = {
    render({
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
    }) {
      return adminLayout('home', `
        <style>
          .review-queue-item {
            padding:var(--sp-4); border-bottom:1px solid var(--border);
            display:flex; flex-direction:column; gap:6px;
          }
          .review-queue-item:last-child { border-bottom:none; }
          .review-queue-item__meta { display:flex; align-items:center; gap:8px; font-size:14px; }
          .review-queue-item__detail { font-size:12px; color:var(--text-secondary); }
          .review-queue-item__status { font-size:12px; color:var(--text-secondary); }
          .review-queue-item__actions { display:flex; gap:8px; margin-top:4px; }
        </style>
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
          ${valueSummary && valueSummary.completedAssessments ? `<div style="margin-top:var(--sp-6)">
            ${UI.dashboardSectionCard({
              title: 'Platform value snapshot',
              description: 'Measured cycle time, directional effort avoided, and modelled better-outcome value stay separate so the pilot story is easier to defend with leadership.',
              className: 'dashboard-section-card--secondary admin-value-summary',
              body: `
                <div class="admin-overview-grid admin-overview-grid--compact">
                  ${[
                    UI.dashboardOverviewCard({
                      label: 'Decision-ready outputs',
                      value: valueSummary.completedAssessments,
                      foot: `${valueSummary.completedAssessments} completed assessment${valueSummary.completedAssessments === 1 ? '' : 's'} are contributing to the platform value story.`
                    }),
                    UI.dashboardOverviewCard({
                      label: 'Average cycle time',
                      value: valueSummary.averageCycleLabel,
                      foot: 'Measured from the first saved draft to the completed result.'
                    }),
                    UI.dashboardOverviewCard({
                      label: 'Internal effort avoided',
                      value: valueSummary.internalHoursAvoidedLabel,
                      foot: 'Directional hours avoided versus the domain baseline library.'
                    }),
                    UI.dashboardOverviewCard({
                      label: 'External specialist equivalent',
                      value: valueSummary.externalEquivalentDaysLabel,
                      foot: 'Directional Big 4-style UAE advisory effort benchmark across the completed set.'
                    })
                  ].join('')}
                </div>
                <div class="admin-value-summary__foot">
                  <span>Directional value at the current Big 4-style UAE rate card: <strong>${fmtCurrency(valueSummary.internalCostAvoidedUsd)}</strong> internal cost avoided and <strong>${fmtCurrency(valueSummary.externalEquivalentValueUsd)}</strong> external-equivalent value.</span>
                  <span>${valueSummary.trackedReductionCases ? `Modelled annual exposure reduction from saved better-outcome cases: ${fmtCurrency(valueSummary.totalModelledReductionUsd)}.` : 'No saved better-outcome case is attached yet, so modelled reduction is not included.'}</span>
                </div>
              `
            })}
          </div>` : ''}
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
              `
            })}
          </div>
          <div style="margin-top:var(--sp-6)">
            ${UI.dashboardSectionCard({
              title: 'Review queue',
              description: 'Assessments submitted for management sign-off.',
              body: `<div id="admin-review-queue-list">
                <div class="form-help">Loading review queue…</div>
              </div>`
            })}
          </div>
          <div style="margin-top:var(--sp-6)">
            ${UI.dashboardSectionCard({
              title: 'Assumption drift alerts',
              description: 'Cross-team calibration variance that may need a challenge or calibration session.',
              body: `<div id="admin-drift-alert-list">
                <div class="form-help">Loading calibration alerts…</div>
              </div>`
            })}
          </div>
        </div>`);
    },

    bind({ preferredAdminRoute, managedAccounts }) {
      document.getElementById('btn-admin-home-start-assessment')?.addEventListener('click', () => {
        if (typeof window.launchGuidedAssessmentStart === 'function') {
          window.launchGuidedAssessmentStart();
          return;
        }
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

      async function loadDriftAlerts() {
        const listEl = document.getElementById('admin-drift-alert-list');
        if (!listEl) return;
        try {
          await OrgIntelligenceService?.refresh?.();
          const alerts = OrgIntelligenceService?.buildDriftAlerts?.(3) || [];
          if (!alerts.length) {
            listEl.innerHTML = '<div class="form-help">No material cross-team calibration drift is visible yet.</div>';
            return;
          }
          listEl.innerHTML = alerts.map(alert => `
            <div class="review-queue-item">
              <div class="review-queue-item__meta">
                <strong>${escapeAdminHomeText(alert.scenarioLabel || 'Scenario family')}</strong>
                <span class="badge badge--warning">Drift alert</span>
              </div>
              <div class="review-queue-item__detail">
                ${escapeAdminHomeText(OrgIntelligenceService?.getFieldLabel?.(alert.fieldName) || alert.fieldName)} varies materially across teams.
              </div>
              <div class="review-queue-item__status visible">
                ${escapeAdminHomeText(alert.highBuName)} averages ${escapeAdminHomeText(String(alert.highValue.toFixed(2)))} while ${escapeAdminHomeText(alert.lowBuName)} averages ${escapeAdminHomeText(String(alert.lowValue.toFixed(2)))}.
                This is a ${escapeAdminHomeText(alert.ratio.toFixed(1))}x spread across at least ${escapeAdminHomeText(String(alert.sampleCount))} completed assessments.
              </div>
            </div>
          `).join('');
        } catch {
          listEl.innerHTML = '<div class="form-help">Could not load calibration alerts right now.</div>';
        }
      }

      async function loadReviewQueue() {
        const listEl = document.getElementById('admin-review-queue-list');
        if (!listEl) return;
        try {
          const sessionToken = typeof AuthService !== 'undefined' && typeof AuthService.getApiSessionToken === 'function'
            ? AuthService.getApiSessionToken()
            : '';
          const currentUsername = AuthService.getCurrentUser()?.username || '';
          const res = await fetch('/api/review-queue', {
            headers: { 'x-session-token': sessionToken }
          });
          if (!res.ok) throw new Error('Failed to load queue');
          const { items } = await res.json();
          if (!items || !items.length) {
            listEl.innerHTML = '<div class="form-help">No assessments are currently waiting for review.</div>';
            return;
          }
          listEl.innerHTML = items.map(item => `
            <div class="review-queue-item" data-queue-id="${escapeAdminHomeText(item.id)}"
                 data-assessment-id="${escapeAdminHomeText(item.assessmentId)}">
              <div class="review-queue-item__meta">
                <strong>${escapeAdminHomeText(item.scenarioTitle || 'Untitled assessment')}</strong>
                <span class="badge ${item.toleranceBreached ? 'badge--danger' : item.nearTolerance ? 'badge--warning' : 'badge--neutral'}">
                  ${item.toleranceBreached ? 'Above tolerance' : item.nearTolerance ? 'Near tolerance' : 'Annual review'}
                </span>
              </div>
              <div class="review-queue-item__detail">
                Submitted by <strong>${escapeAdminHomeText(item.submittedBy)}</strong> ·
                ${escapeAdminHomeText(item.buName || 'Business unit not set')} ·
                ${new Date(item.submittedAt).toLocaleDateString('en-GB')}
              </div>
              <div class="review-queue-item__status ${item.reviewStatus !== 'pending' ? 'visible' : 'hidden'}">
                Status: <strong>${escapeAdminHomeText(item.reviewStatus)}</strong>
                ${item.reviewNote ? `· ${escapeAdminHomeText(item.reviewNote)}` : ''}
              </div>
              <div class="review-queue-item__actions">
                <button class="btn btn--ghost btn--sm" data-queue-action="view"
                  data-assessment-id="${escapeAdminHomeText(item.assessmentId)}">View Result</button>
                ${item.reviewStatus === 'pending' ? `
                  <button class="btn btn--sm btn--success" data-queue-action="approve"
                    data-queue-id="${escapeAdminHomeText(item.id)}">Approve</button>
                  <button class="btn btn--sm btn--warning" data-queue-action="changes"
                    data-queue-id="${escapeAdminHomeText(item.id)}">Request Changes</button>
                  <button class="btn btn--sm btn--secondary" data-queue-action="escalate"
                    data-queue-id="${escapeAdminHomeText(item.id)}">Escalate</button>
                ` : ''}
              </div>
            </div>
          `).join('');

          listEl.querySelectorAll('[data-queue-action="view"]').forEach(btn => {
            btn.addEventListener('click', () => {
              Router.navigate('/results/' + btn.dataset.assessmentId);
            });
          });

          async function syncLocalReviewDecision(queueItem) {
            if (!queueItem) return;
            const localAssessment = typeof getAssessmentById === 'function'
              ? getAssessmentById(queueItem.assessmentId)
              : null;
            if (localAssessment && typeof updateAssessmentRecord === 'function') {
              updateAssessmentRecord(localAssessment.id, current => ({
                ...current,
                reviewSubmission: {
                  ...(current.reviewSubmission || {}),
                  reviewStatus: queueItem.reviewStatus || '',
                  reviewNote: queueItem.reviewNote || '',
                  reviewedBy: queueItem.reviewedBy || currentUsername,
                  reviewedAt: queueItem.reviewedAt || Date.now(),
                  escalatedTo: queueItem.escalatedTo || ''
                },
                reviewDecision: {
                  decision: queueItem.reviewStatus || '',
                  timeToDecide: queueItem.submittedAt && queueItem.reviewedAt
                    ? Math.max(0, Number(queueItem.reviewedAt) - Number(queueItem.submittedAt))
                    : 0,
                  challengedAssumption: queueItem.reviewNote || '',
                  reviewedBy: queueItem.reviewedBy || currentUsername,
                  reviewedAt: queueItem.reviewedAt || Date.now()
                }
              }));
            }
            await OrgIntelligenceService?.recordReviewDecision?.({
              id: `${queueItem.id}_${queueItem.reviewedAt || Date.now()}`,
              assessmentId: queueItem.assessmentId,
              buId: queueItem.buId || localAssessment?.buId || '',
              buName: queueItem.buName || localAssessment?.buName || '',
              scenarioLensKey: localAssessment?.scenarioLens?.key || '',
              scenarioLensLabel: localAssessment?.scenarioLens?.label || localAssessment?.scenarioTitle || queueItem.scenarioTitle || '',
              scenarioTitle: localAssessment?.scenarioTitle || queueItem.scenarioTitle || '',
              decision: queueItem.reviewStatus || '',
              reviewNote: queueItem.reviewNote || '',
              challengedAssumption: queueItem.reviewStatus === 'changes_requested' ? (queueItem.reviewNote || '') : '',
              reviewedBy: queueItem.reviewedBy || currentUsername,
              reviewedAt: queueItem.reviewedAt || Date.now(),
              submittedAt: queueItem.submittedAt || 0,
              p90Loss: queueItem.p90Loss || localAssessment?.results?.eventLoss?.p90 || 0,
              aleMean: queueItem.aleMean || localAssessment?.results?.ale?.mean || 0
            });
          }

          async function patchQueueItem(id, patch) {
            const nextSessionToken = typeof AuthService !== 'undefined' && typeof AuthService.getApiSessionToken === 'function'
              ? AuthService.getApiSessionToken()
              : '';
            const response = await fetch('/api/review-queue', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'x-session-token': nextSessionToken
              },
              body: JSON.stringify({ id, reviewedBy: currentUsername, ...patch })
            });
            if (!response.ok) throw new Error('Action failed');
            return response.json();
          }

          listEl.querySelectorAll('[data-queue-action="approve"]').forEach(btn => {
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              try {
                const { item } = await patchQueueItem(btn.dataset.queueId, { reviewStatus: 'approved' });
                await syncLocalReviewDecision(item);
                UI.toast('Assessment approved.', 'success');
                loadReviewQueue();
                loadDriftAlerts();
              } catch {
                UI.toast('Could not approve. Try again in a moment.', 'danger');
                btn.disabled = false;
              }
            });
          });

          listEl.querySelectorAll('[data-queue-action="changes"]').forEach(btn => {
            btn.addEventListener('click', () => {
              const modal = UI.modal({
                title: 'Request changes',
                body: `
                  <label for="changes-reason" class="form-label">
                    Reason <span style="color:var(--danger)">*</span>
                  </label>
                  <textarea id="changes-reason" class="form-textarea" rows="4"
                    placeholder="Describe what needs to change before this can be approved…"
                    style="width:100%;margin-bottom:var(--sp-4)"></textarea>
                  <div class="flex gap-3">
                    <button type="button" class="btn btn--primary" id="btn-confirm-changes">
                      Send Request
                    </button>
                    <button type="button" class="btn btn--ghost" id="btn-cancel-changes">Cancel</button>
                  </div>
                `
              });
              document.getElementById('btn-cancel-changes')?.addEventListener('click', () => modal.close());
              document.getElementById('btn-confirm-changes')?.addEventListener('click', async () => {
                const reason = (document.getElementById('changes-reason')?.value || '').trim();
                if (!reason) {
                  UI.toast('Please enter a reason before sending.', 'warning');
                  return;
                }
                const confirmBtn = document.getElementById('btn-confirm-changes');
                if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Sending…'; }
                try {
                  const { item } = await patchQueueItem(btn.dataset.queueId, {
                    reviewStatus: 'changes_requested',
                    reviewNote: reason
                  });
                  await syncLocalReviewDecision(item);
                  modal.close();
                  UI.toast('Changes requested.', 'success');
                  loadReviewQueue();
                  loadDriftAlerts();
                } catch {
                  UI.toast('Could not send request. Try again.', 'danger');
                  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Send Request'; }
                }
              });
            });
          });

          listEl.querySelectorAll('[data-queue-action="escalate"]').forEach(btn => {
            const currentUser = typeof AuthService !== 'undefined' && typeof AuthService.getCurrentUser === 'function'
              ? AuthService.getCurrentUser()
              : null;
            const resolvedManagedAccounts = Array.isArray(managedAccounts) && managedAccounts.length
              ? managedAccounts
              : (typeof getManagedAccountsForAdmin === 'function'
                ? getManagedAccountsForAdmin(getAdminSettings())
                  : (typeof AuthService !== 'undefined' && typeof AuthService.getManagedAccounts === 'function'
                    ? AuthService.getManagedAccounts()
                    : []));
            const targets = (resolvedManagedAccounts || []).filter(u =>
              u.role === 'admin' || u.role === 'bu_admin'
            );
            if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'bu_admin') && !targets.some(u => u.username === currentUser.username)) {
              targets.unshift({
                username: currentUser.username,
                displayName: currentUser.displayName || currentUser.username,
                role: currentUser.role
              });
            }
            const options = targets.length
              ? targets.map(u => `<option value="${escapeAdminHomeText(u.username)}">${escapeAdminHomeText(u.displayName || u.username)} (${escapeAdminHomeText(u.role)})</option>`).join('')
              : '<option disabled>No escalation targets configured</option>';
            btn.addEventListener('click', () => {
              const modal = UI.modal({
                title: 'Escalate assessment',
                body: `
                  <label for="escalate-target" class="form-label">Escalate to</label>
                  <select id="escalate-target" class="form-select"
                    style="width:100%;margin-bottom:var(--sp-4)">
                    ${options}
                  </select>
                  <div class="flex gap-3">
                    <button type="button" class="btn btn--primary" id="btn-confirm-escalate">
                      Escalate
                    </button>
                    <button type="button" class="btn btn--ghost" id="btn-cancel-escalate">Cancel</button>
                  </div>
                `
              });
              document.getElementById('btn-cancel-escalate')?.addEventListener('click', () => modal.close());
              document.getElementById('btn-confirm-escalate')?.addEventListener('click', async () => {
                const target = document.getElementById('escalate-target')?.value || '';
                if (!target) {
                  UI.toast('Select a target first.', 'warning');
                  return;
                }
                const confirmBtn = document.getElementById('btn-confirm-escalate');
                if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Escalating…'; }
                try {
                  const { item } = await patchQueueItem(btn.dataset.queueId, {
                    reviewStatus: 'escalated',
                    escalatedTo: target
                  });
                  await syncLocalReviewDecision(item);
                  modal.close();
                  UI.toast('Assessment escalated.', 'success');
                  loadReviewQueue();
                  loadDriftAlerts();
                } catch {
                  UI.toast('Could not escalate. Try again.', 'danger');
                  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Escalate'; }
                }
              });
            });
          });
        } catch {
          listEl.innerHTML = '<div class="form-help">Could not load the review queue right now.</div>';
        }
      }

      loadReviewQueue();
      loadDriftAlerts();
    }
  };

  global.AdminHomeSection = AdminHomeSection;
})(window);
