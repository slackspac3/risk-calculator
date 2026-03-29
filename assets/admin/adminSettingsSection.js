(function(global) {
  'use strict';

  const SETTINGS_SECTION_META = {
    org: { title: 'Organisation Setup', description: 'Build the organisation tree first, then tune risk context from the left navigation.' },
    company: { title: 'AI Company Context Builder', description: 'Build public company context and place it into the organisation structure.' },
    defaults: { title: 'Platform Defaults', description: 'Manage thresholds, escalation posture, geography, and global linked-risk fallback.' },
    governance: { title: 'Governance Inputs', description: 'Manage regulations, AI guidance, typical departments, and scoped governance overrides.' },
    access: { title: 'System Access', description: 'Configure the Compass proxy, model, and session-level access controls.' },
    users: { title: 'User Account Control', description: 'Manage shared users, roles, BU assignments, and issued passwords.' },
    audit: { title: 'Audit Log', description: 'Review short-retention PoC audit events and sign-in statistics.' }
  };

  function getAdminGuidanceCopy(currentSettingsSection) {
    return currentSettingsSection === 'org'
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
  }

  function getAdminGuidanceHeadline(currentSettingsSection) {
    return currentSettingsSection === 'org'
      ? 'Structure first'
      : currentSettingsSection === 'users'
        ? 'Access review first'
        : currentSettingsSection === 'defaults'
          ? 'Thresholds first'
          : currentSettingsSection === 'governance'
            ? 'Guidance first'
            : currentSettingsSection === 'company'
              ? 'Build first'
              : 'One intentional change at a time';
  }

  function renderCompanyBuilderSection({ settings, companyContextSections }) {
    return renderSettingsSection({
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
  }

  function renderPlatformSnapshot({ companyEntities, departmentEntities, entityContextLayers, buCount, docCount }) {
    return `<details class="dashboard-disclosure card admin-snapshot-disclosure">
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
  }

  function renderSettingsShell({
    currentSettingsSection,
    settingsSectionMeta,
    adminSectionBody,
    adminGuidanceCopy,
    platformSnapshotMarkup,
    settings
  }) {
    return adminLayout('settings', `
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
            <strong>${getAdminGuidanceHeadline(currentSettingsSection)}</strong>
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
      </div>`, currentSettingsSection);
  }

  global.AdminSettingsSection = {
    SETTINGS_SECTION_META,
    getAdminGuidanceCopy,
    renderCompanyBuilderSection,
    renderPlatformSnapshot,
    renderSettingsShell
  };
})(window);
