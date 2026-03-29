(function(global) {
  'use strict';

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
                <div class="form-help">Review queue: ${reviewQueue.length ? `${reviewQueue.length} completed assessment${reviewQueue.length === 1 ? '' : 's'} need management attention.` : 'No completed scenario currently needs escalation.'}</div>
              `
            })}
          </div>
        </div>`);
    },

    bind({ preferredAdminRoute }) {
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
  };

  global.AdminHomeSection = AdminHomeSection;
})(window);
