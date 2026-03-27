
function buildLocalUserCompanyContextFallback(refineInput = {}) {
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

function renderSettingsSummaryChips(items = [], emptyLabel = 'Not set', maxVisible = 3) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<span class="badge badge--neutral">${escapeHtml(emptyLabel)}</span>`;
  const visible = list.slice(0, maxVisible);
  const hiddenCount = Math.max(0, list.length - visible.length);
  return `${visible.map(item => `<span class="badge badge--neutral">${escapeHtml(String(item))}</span>`).join('')}${hiddenCount ? `<span class="badge badge--neutral">+${hiddenCount} more</span>` : ''}`;
}

function renderSettingsSnapshotCard({ label, value, foot = '', accent = false }) {
  return `<div class="settings-snapshot-card${accent ? ' settings-snapshot-card--accent' : ''}">
    <div class="settings-snapshot-card__label">${label}</div>
    <div class="settings-snapshot-card__value">${value}</div>
    ${foot ? `<div class="settings-snapshot-card__foot">${foot}</div>` : ''}
  </div>`;
}

function renderUserPreferences(existingSettings = getUserSettings()) {
  if (!requireAuth()) return;
  if (AuthService.isAdminAuthenticated()) {
    Router.navigate(getDefaultRouteForCurrentUser());
    return;
  }
  const globalSettings = getAdminSettings();
  const settings = existingSettings;
  const profile = normaliseUserProfile(settings.userProfile);
  const companyStructure = Array.isArray(globalSettings.companyStructure) ? globalSettings.companyStructure : [];
  const companyOptions = getCompanyEntities(companyStructure);
  const capability = getNonAdminCapabilityState(AppState.currentUser, settings, globalSettings);
  const selectedBusinessId = capability.managedBusinessId || capability.selection.businessUnitEntityId || profile.businessUnitEntityId;
  const selectedBusinessEntity = getEntityById(companyStructure, selectedBusinessId);
  const selectedBusinessDepartments = getDepartmentEntities(companyStructure, selectedBusinessId);
  const businessOwner = !!capability.canManageBusinessUnit && (!!capability.managedBusinessId ? capability.managedBusinessId === selectedBusinessId : true);
  const selectedDepartment = getEntityById(companyStructure, capability.managedDepartmentId || capability.selection.departmentEntityId || profile.departmentEntityId);
  const departmentOwner = !!capability.canManageDepartment;
  const companyContextSections = settings.companyContextSections || buildCompanyContextSections({
    companySummary: settings.adminContextSummary || '',
    businessProfile: settings.companyContextProfile || ''
  });
  const focusAreas = Array.isArray(profile.focusAreas) ? profile.focusAreas.filter(Boolean) : [];
  const workingViewSummary = truncateText(profile.workingContext || capability.experience.settingsLead || 'No working context saved yet.', 120);
  const outputStyleSummary = truncateText(profile.preferredOutputs || 'No preferred output style saved yet.', 120);
  const aiPersonalizationSummary = truncateText(settings.aiInstructions || settings.adminContextSummary || 'Using shared baseline guidance until you add personal notes.', 130);
  const defaultsSummary = [
    settings.geographyPrimary || settings.geography || globalSettings.geography,
    settings.defaultLinkMode ? 'Linked-risk mode on' : 'Linked-risk mode off',
    (Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations.length : 0) ? `${settings.applicableRegulations.length} regulations` : 'No regulations selected'
  ].join(' · ');
  let inlineValidationMessage = AppState.settingsValidationMessage || '';
  const userContextSection = renderSettingsSection({
    title: 'Profile And Role Context',
    description: capability.experience.settingsLead,
    open: true,
    meta: `${profile.jobTitle || 'Role not set'} · ${profile.businessUnit || 'No BU selected'}`,
    body: `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label" for="user-full-name">Name</label>
          <input class="form-input" id="user-full-name" value="${profile.fullName || AppState.currentUser?.displayName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="user-job-title">Role</label>
          <input class="form-input" id="user-job-title" value="${profile.jobTitle || ''}" placeholder="e.g. Risk Manager">
        </div>
      </div>
      <div class="grid-2 mt-4">
        <div class="form-group">
          <label class="form-label" for="user-business-unit">Business unit or entity</label>
          <select class="form-select" id="user-business-unit" disabled>
            <option value="">Choose your business unit</option>
            ${companyOptions.map(entity => `<option value="${entity.id}" ${entity.id === selectedBusinessId ? 'selected' : ''}>${entity.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="user-department">Department or function</label>
          <select class="form-select" id="user-department" ${capability.canManageBusinessUnit && !capability.canManageDepartment ? '' : 'disabled'}></select>
          <span class="form-help">${capability.canManageBusinessUnit && !capability.canManageDepartment ? 'You can choose the function context you want to work within inside your assigned business unit.' : 'Your business-unit and function assignment is controlled by your current role.'}</span>
        </div>
      </div>
      <div class="form-group mt-4">
        <label class="form-label">Focus areas</label>
        <div class="tag-input-wrap" id="ti-user-focus-areas"></div>
        <details class="settings-inline-disclosure mt-3">
          <summary>Add from suggested focus areas</summary>
          <div class="citation-chips" style="margin-top:10px">
            ${USER_FOCUS_OPTIONS.map(option => `<button type="button" class="chip user-focus-chip" data-focus="${option}">${option}</button>`).join('')}
          </div>
        </details>
      </div>
      <div class="form-help mt-4">Save your role and focus areas first. Working-view guidance and deeper AI tailoring sit below so the page stays calmer.</div>`
  });
  const workingViewSection = renderSettingsSection({
    title: 'Working View And Output Style',
    scope: 'user-settings',
    description: 'Describe how you work, what needs emphasis, and how outputs should read back to you.',
    meta: profile.workingContext || profile.preferredOutputs ? 'Configured' : 'Recommended',
    open: false,
    body: `
      <div class="form-group">
        <label class="form-label" for="user-working-context">Working context</label>
        <textarea class="form-textarea" id="user-working-context" rows="4" placeholder="e.g. I support technology and cyber risk decisions across shared platforms, work closely with control owners, and often need outputs that balance resilience, compliance, and executive reporting.">${profile.workingContext || ''}</textarea>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="user-preferred-outputs">Preferred output style</label>
        <textarea class="form-textarea" id="user-preferred-outputs" rows="4" placeholder="e.g. Keep answers concise, highlight key risk drivers, call out business impact and dependencies, and end with practical actions I can take with stakeholders.">${profile.preferredOutputs || ''}</textarea>
      </div>
      <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-user-role-ai">AI Assist Role Context</button>
        <span class="form-help">Use your role, BU, department, and uploaded source material to draft these fields.</span>
      </div>`
  });
  const defaultsSection = renderSettingsSection({
    title: 'Core Defaults And AI Notes',
    description: 'These defaults shape new assessments for this account.',
    meta: settings.geography || globalSettings.geography,
    open: false,
    body: `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label" for="user-geo-primary">Primary Geography</label>
          ${renderGeographySelect('user-geo-primary', settings.geographyPrimary || settings.geography || globalSettings.geography)}
        </div>
        <div class="form-group">
          <label class="form-label" for="user-link-mode">Default Linked-Risk Mode</label>
          <select class="form-select" id="user-link-mode">
            <option value="yes" ${settings.defaultLinkMode ? 'selected' : ''}>Enabled</option>
            <option value="no" ${!settings.defaultLinkMode ? 'selected' : ''}>Disabled</option>
          </select>
        </div>
      </div>
      <div class="grid-2 mt-4">
        <div class="form-group">
          <label class="form-label" for="user-geo-secondary">Secondary Geography</label>
          ${renderGeographySelect('user-geo-secondary', settings.geographySecondary || '', 'Optional', true)}
        </div>
        <div class="form-group">
          <label class="form-label" for="user-geo-tertiary">Tertiary Geography</label>
          ${renderGeographySelect('user-geo-tertiary', settings.geographyTertiary || '', 'Optional', true)}
        </div>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="user-context-summary">Personal Context Summary</label>
        <textarea class="form-textarea" id="user-context-summary" rows="3">${settings.adminContextSummary || ''}</textarea>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="user-appetite">Risk Appetite Statement</label>
        <textarea class="form-textarea" id="user-appetite" rows="4">${settings.riskAppetiteStatement || ''}</textarea>
      </div>
      <details class="settings-inline-disclosure mt-4">
        <summary>Show AI guidance, regulations, and benchmark strategy</summary>
        <div class="form-group mt-4">
          <label class="form-label">Applicable Regulations</label>
          <div class="tag-input-wrap" id="ti-user-regulations"></div>
        </div>
        <div class="form-group mt-4">
          <label class="form-label" for="user-ai-instructions">AI Guidance</label>
          <textarea class="form-textarea" id="user-ai-instructions" rows="3">${settings.aiInstructions || ''}</textarea>
        </div>
        <div class="form-group mt-4">
          <label class="form-label" for="user-benchmark-strategy">Benchmark Strategy</label>
          <textarea class="form-textarea" id="user-benchmark-strategy" rows="3">${settings.benchmarkStrategy || ''}</textarea>
        </div>
      </details>`
  });
  const aiWorkspaceSection = renderSettingsSection({
    title: 'AI Personalization Workspace',
    scope: 'user-settings',
    description: capability.canManageBusinessUnit || capability.canManageDepartment ? 'Upload role, team, or operating material, then use AI assist to keep your managed context aligned.' : 'Upload role notes or planning material, then use AI assist to tailor this workspace to how you work.',
    meta: 'Advanced',
    open: false,
    body: `
      ${renderPilotWarningBanner('ai', { compact: true, text: 'AI assist drafts personal defaults from your notes and uploaded material. Review the wording before you save it as part of your profile.' })}
      <div class="form-group">
        <label class="form-label" for="user-ai-source-notes">Notes for AI assist</label>
        <textarea class="form-textarea" id="user-ai-source-notes" rows="4" placeholder="Paste role notes, remit details, team responsibilities, reporting expectations, or any other useful context."></textarea>
      </div>
      <div class="form-group mt-4">
        <label class="form-label" for="user-ai-source-file">Upload source material</label>
        <input class="form-input" id="user-ai-source-file" type="file" accept=".txt,.csv,.json,.md,.tsv,.xlsx,.xls">
        <div class="form-help" id="user-ai-source-file-help">Upload TXT, CSV, TSV, JSON, Markdown, or Excel. The content will be used only to draft your personal settings.</div>
      </div>
      <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-user-defaults-ai">AI Assist Personal Defaults</button>
        <span class="form-help">Fills personal context summary and AI guidance from the same source material.</span>
      </div>`
  });
  const companyContextSection = renderSettingsSection({
    title: 'Personal Company Context',
    scope: 'user-settings',
    description: capability.canManageBusinessUnit || capability.canManageDepartment ? 'Optional personal overlay on top of the shared baseline for the area you help lead.' : 'Optional personal overlay on top of the shared baseline for this account only.',
    meta: settings.companyWebsiteUrl ? 'Advanced · website linked' : 'Advanced · optional',
    open: false,
    body: `
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label" for="user-company-url">Company Website URL</label>
          <input class="form-input" id="user-company-url" value="${settings.companyWebsiteUrl || ''}" placeholder="https://example.com">
        </div>
        <div class="form-group">
          <label class="form-label" for="user-company-profile">Company Risk Context Profile</label>
          <textarea class="form-textarea" id="user-company-profile" rows="6">${settings.companyContextProfile || ''}</textarea>
        </div>
      </div>
      <details class="mt-4">
        <summary style="cursor:pointer;font-weight:600;color:var(--text-primary)">Edit detailed company brief</summary>
        <div class="card mt-4" style="padding:var(--sp-4);background:var(--bg-canvas)">
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-summary">Company Summary</label>
            <textarea class="form-textarea" id="user-company-section-summary" rows="3">${companyContextSections.companySummary || ''}</textarea>
          </div>
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-business-model">Business Model</label>
            <textarea class="form-textarea" id="user-company-section-business-model" rows="3">${companyContextSections.businessModel || ''}</textarea>
          </div>
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-operating-model">Operating Model</label>
            <textarea class="form-textarea" id="user-company-section-operating-model" rows="3">${companyContextSections.operatingModel || ''}</textarea>
          </div>
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-commitments">Public Commitments</label>
            <textarea class="form-textarea" id="user-company-section-commitments" rows="4">${companyContextSections.publicCommitments || ''}</textarea>
          </div>
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-risks">Key Risk Signals</label>
            <textarea class="form-textarea" id="user-company-section-risks" rows="4">${companyContextSections.keyRiskSignals || ''}</textarea>
          </div>
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-obligations">Obligations and Exposures</label>
            <textarea class="form-textarea" id="user-company-section-obligations" rows="4">${companyContextSections.obligations || ''}</textarea>
          </div>
          <div class="form-group mt-3">
            <label class="form-label" for="user-company-section-sources">Sources Reviewed</label>
            <textarea class="form-textarea" id="user-company-section-sources" rows="4">${companyContextSections.sources || ''}</textarea>
          </div>
        </div>
      </details>
      <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-build-user-context">Build from Website</button>
        <span class="form-help">Builds a personal context draft for this account only.</span>
      </div>
      ${UI.aiRefinementCard({
        intro: 'Use follow-up prompts to reshape the company context until it reflects the framing you want for this account.',
        historyId: 'user-company-refinement-history',
        fileId: 'user-company-source-file',
        fileLabel: 'Upload supporting documents',
        fileAccept: '.txt,.csv,.json,.md,.tsv,.xlsx,.xls,.doc,.docx,.pdf',
        fileHelpId: 'user-company-source-help',
        fileHelp: 'Recommended: upload strategy, policy, procedure, or operating-model documents to ground the AI context.',
        promptId: 'user-company-followup',
        promptPlaceholder: 'Tell the AI what to change, emphasise, shorten, or make more specific.',
        buttonId: 'btn-refine-user-context',
        buttonLabel: 'Apply Follow-Up Now',
        statusId: 'user-company-refine-status',
        statusText: 'The fields above will be updated in place each time you refine the context.'
      })}`
  });
  const businessOwnerSection = businessOwner ? renderSettingsSection({
    title: 'Business Unit Admin Controls',
    scope: 'user-settings',
    description: `You can add functions beneath ${selectedBusinessEntity?.name || profile.businessUnit} and maintain their retained context.`,
    meta: `${selectedBusinessDepartments.length} department${selectedBusinessDepartments.length === 1 ? '' : 's'}`,
    open: false,
    body: `
      <div class="flex items-center gap-3" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-user-add-department">Add Function / Department</button>
      </div>
      <div class="mt-4" style="display:flex;flex-direction:column;gap:12px">
        ${selectedBusinessDepartments.length ? selectedBusinessDepartments.map(department => `
          <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div>
                <div class="context-panel-title">${department.name}</div>
                <div class="form-help">${department.ownerUsername ? `Owner: ${department.ownerUsername}` : 'Owner not assigned yet'}</div>
                <div class="form-help">${getEntityLayerById(globalSettings, department.id)?.contextSummary || department.profile || 'No saved function context yet'}</div>
              </div>
              <div class="flex items-center gap-3" style="flex-wrap:wrap">
                <button class="btn btn--ghost btn--sm btn-user-edit-department" data-department-id="${department.id}" type="button">Edit Department</button>
                <button class="btn btn--secondary btn--sm btn-user-edit-department-context" data-department-id="${department.id}" type="button">Manage Context</button>
              </div>
            </div>
          </div>`).join('') : '<div class="form-help">No functions have been added under this business unit yet.</div>'}
      </div>`
  }) : '';
  const ownedDepartmentSection = departmentOwner ? renderSettingsSection({
    title: 'Department Context You Own',
    description: `You are the assigned owner for ${selectedDepartment?.name || profile.department}.`,
    meta: 'Department owner',
    open: true,
    body: `<div class="flex items-center gap-3" style="flex-wrap:wrap"><button class="btn btn--secondary" id="btn-manage-owned-department">Manage Department Context</button></div>`
  }) : '';
  setPage(`
    <main class="page">
      <div class="container container--narrow" style="padding:var(--sp-10) var(--sp-6);max-width:960px">
        <div class="settings-shell">
          <div class="settings-shell__header">
            <div>
              <h2>Personal Settings</h2>
              <p style="margin-top:6px;color:var(--text-muted)">${departmentOwner || businessOwner
                ? `Keep your personal workspace clear, then maintain the ${departmentOwner ? 'function' : 'business-unit'} context you own without mixing it with optional personal overlays.`
                : `These settings apply only to ${AppState.currentUser?.displayName || 'your account'}. Keep your profile clear, your working view current, and deeper context hidden until you need it.`}</p>
            </div>
          </div>

          <section class="settings-profile-snapshot">
            <div class="settings-profile-snapshot__intro">
              <div class="results-section-heading">Personal profile snapshot</div>
              <h3 class="settings-profile-snapshot__title">${profile.jobTitle || 'Personalize this workspace for how you work.'}</h3>
              <p class="settings-profile-snapshot__copy">${capability.experience.settingsLead}</p>
              <div class="settings-profile-snapshot__chips">
                ${renderSettingsSummaryChips(focusAreas, 'No focus areas yet')}
              </div>
            </div>
            <div class="settings-profile-snapshot__grid">
              ${renderSettingsSnapshotCard({ label: 'Working view', value: profile.businessUnit || 'Shared view', foot: workingViewSummary, accent: true })}
              ${renderSettingsSnapshotCard({ label: 'Context readiness', value: settings.geographyPrimary || settings.geography || globalSettings.geography, foot: defaultsSummary })}
              ${renderSettingsSnapshotCard({ label: 'AI personalization', value: settings.aiInstructions ? 'Personalized' : 'Using shared baseline', foot: aiPersonalizationSummary })}
              ${renderSettingsSnapshotCard({ label: 'Output style', value: profile.preferredOutputs ? 'Saved' : 'Default', foot: outputStyleSummary })}
            </div>
          </section>

          <div class="settings-level-band">
            <div class="results-section-heading">About me</div>
            <div class="form-help" style="margin-top:8px">Start with your role, focus areas, working view, and output style so the workspace reflects how you actually operate.</div>
          </div>

          <div class="settings-accordion">
            ${userContextSection}
            ${workingViewSection}
          </div>

          <div class="settings-support-strip">
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Role alignment</span>
              <strong>${profile.jobTitle || 'Role still needs setup'}</strong>
            </div>
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Working view</span>
              <strong>${profile.businessUnit || 'Shared view'}${profile.department ? ` · ${profile.department}` : ''}</strong>
            </div>
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Output style</span>
              <strong>${profile.preferredOutputs ? 'Customized' : 'Using shared default tone'}</strong>
            </div>
          </div>

          ${(businessOwner || departmentOwner) ? `
          <div class="settings-level-band">
            <div class="results-section-heading">Context you own operationally</div>
            <div class="form-help" style="margin-top:8px">Keep the managed function or business-unit context current so downstream drafting, review, and defaults stay aligned to the area you own.</div>
          </div>

          <div class="settings-support-strip">
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Owned context</span>
              <strong>${departmentOwner ? (selectedDepartment?.name || profile.department || 'Department owner') : (selectedBusinessEntity?.name || profile.businessUnit || 'Business unit owner')}</strong>
            </div>
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Managed scope</span>
              <strong>${capability.roleSummary}</strong>
            </div>
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Operational priority</span>
              <strong>${departmentOwner ? 'Maintain function framing and retained context' : 'Maintain BU framing and function structure'}</strong>
            </div>
          </div>

          <div class="settings-accordion">
            ${ownedDepartmentSection}
            ${businessOwnerSection}
          </div>` : ''}

          <div class="settings-level-band">
            <div class="results-section-heading">How the assistant should work for me</div>
            <div class="form-help" style="margin-top:8px">Tune defaults, AI notes, and optional overlays only when you need more tailored drafting or review support.</div>
          </div>

          <div class="settings-support-strip">
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Core defaults</span>
              <strong>${settings.geographyPrimary || settings.geography || globalSettings.geography || 'Not set'}</strong>
            </div>
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">AI personalization</span>
              <strong>${settings.aiInstructions ? 'Personalized' : 'Using shared baseline guidance'}</strong>
            </div>
            <div class="settings-support-strip__item">
              <span class="settings-support-strip__label">Personal overlays</span>
              <strong>${settings.companyWebsiteUrl ? 'Website-linked overlay available' : 'Optional and kept secondary'}</strong>
            </div>
          </div>

          <div class="settings-accordion">
            ${defaultsSection}
            ${aiWorkspaceSection}
            ${companyContextSection}
          </div>

          <div class="settings-shell__footer settings-sticky-savebar">
            <div class="flex items-center gap-3" style="flex-wrap:wrap">
              <button class="btn btn--primary" id="btn-save-user-settings">Save My Settings</button>
              <button class="btn btn--ghost" id="btn-rerun-onboarding">Re-run Setup</button>
              <details class="results-actions-disclosure admin-footer-overflow">
                <summary class="btn btn--ghost btn--sm">Advanced actions</summary>
                <div class="results-actions-disclosure-menu">
                  <button class="btn btn--secondary btn--sm" id="btn-export-user-settings">Export JSON</button>
                  <button class="btn btn--secondary btn--sm" id="btn-import-user-settings">Import JSON</button>
                  <button class="btn btn--secondary btn--sm" id="btn-reset-user-settings">Reset My Settings</button>
                </div>
              </details>
              <span class="form-help">These values shape your personal defaults and AI framing in future assessments.</span>
            </div>
            ${inlineValidationMessage ? `<div class="banner banner--warning mt-4"><span class="banner-icon">△</span><span class="banner-text">${escapeHtml(inlineValidationMessage)}</span></div>` : ''}
            <div class="form-help" data-workspace-sync-state data-scope="settings" style="margin-top:var(--sp-4)">Changes save automatically</div>
            <div class="form-help" style="margin-top:var(--sp-4)">Pilot release: ${escapeHtml(getReleaseLabel())}</div>
          </div>
        </div>
      </div>
    </main>`);

  const regsInput = UI.tagInput('ti-user-regulations', settings.applicableRegulations);
  const focusInput = UI.tagInput('ti-user-focus-areas', profile.focusAreas || []);
  const profileEl = document.getElementById('user-company-profile');
  const websiteEl = document.getElementById('user-company-url');
  const businessUnitEl = document.getElementById('user-business-unit');
  const departmentEl = document.getElementById('user-department');
  const companyRefinementHistory = [];
  const companyRefinementHistoryEl = document.getElementById('user-company-refinement-history');
  const companyFollowupEl = document.getElementById('user-company-followup');
  const companyRefineStatusEl = document.getElementById('user-company-refine-status');
  let userAiSourceText = '';
  let userAiSourceName = '';

  function getCurrentUserCompanySections() {
    return {
      companySummary: document.getElementById('user-company-section-summary')?.value.trim() || '',
      businessModel: document.getElementById('user-company-section-business-model')?.value.trim() || '',
      operatingModel: document.getElementById('user-company-section-operating-model')?.value.trim() || '',
      publicCommitments: document.getElementById('user-company-section-commitments')?.value.trim() || '',
      keyRiskSignals: document.getElementById('user-company-section-risks')?.value.trim() || '',
      obligations: document.getElementById('user-company-section-obligations')?.value.trim() || '',
      sources: document.getElementById('user-company-section-sources')?.value.trim() || ''
    };
  }

  function getUserSettingsValidationMessage() {
    const fullName = String(document.getElementById('user-full-name')?.value || '').trim();
    const role = String(document.getElementById('user-job-title')?.value || '').trim();
    if (!fullName) return 'Add your name so saved settings and generated drafts stay clearly attributable.';
    if (!role) return 'Add your role so the pilot can frame outputs around the work you do.';
    return '';
  }

  function applyUserCompanyContextResult(result) {
    const sections = buildCompanyContextSections(result);
    const profileText = serialiseCompanyContextSections(sections);
    profileEl.value = profileText;
    document.getElementById('user-company-section-summary').value = sections.companySummary || '';
    document.getElementById('user-company-section-business-model').value = sections.businessModel || '';
    document.getElementById('user-company-section-operating-model').value = sections.operatingModel || '';
    document.getElementById('user-company-section-commitments').value = sections.publicCommitments || '';
    document.getElementById('user-company-section-risks').value = sections.keyRiskSignals || '';
    document.getElementById('user-company-section-obligations').value = sections.obligations || '';
    document.getElementById('user-company-section-sources').value = sections.sources || '';
    if (!document.getElementById('user-context-summary').value.trim() && result.companySummary) {
      document.getElementById('user-context-summary').value = result.companySummary;
    }
    if (result.aiGuidance) {
      document.getElementById('user-ai-instructions').value = result.aiGuidance;
    }
    const userGeoPrimaryEl = document.getElementById('user-geo-primary');
    if (result.suggestedGeography && userGeoPrimaryEl && !userGeoPrimaryEl.value.trim()) {
      userGeoPrimaryEl.value = result.suggestedGeography;
    }
    if (Array.isArray(result.regulatorySignals) && result.regulatorySignals.length) {
      regsInput.setTags(Array.from(new Set([...(regsInput.getTags() || []), ...result.regulatorySignals])));
    }
  }

  function renderUserCompanyRefinementHistory() {
    if (!companyRefinementHistoryEl) return;
    if (!companyRefinementHistory.length) {
      companyRefinementHistoryEl.innerHTML = '<div class="form-help">No follow-up prompts yet. Build the first draft, then iterate here until the context feels right.</div>';
      return;
    }
    companyRefinementHistoryEl.innerHTML = companyRefinementHistory.map(entry => `
      <div class="card" style="padding:var(--sp-3);background:${entry.role === 'user' ? 'var(--bg-canvas)' : 'rgba(244,193,90,.08)'};border-color:${entry.role === 'user' ? 'var(--border-subtle)' : 'rgba(244,193,90,.18)'}">
        <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${entry.role === 'user' ? 'Your prompt' : 'AI update'}</div>
        <div class="context-panel-copy" style="margin-top:6px">${entry.text}</div>
      </div>`).join('');
  }

  function renderUserDepartmentOptions() {
    const departments = getDepartmentEntities(companyStructure, businessUnitEl.value);
    const preferredDepartmentId = profile.departmentEntityId;
    const fallbackDepartmentId = departments.some(entity => entity.id === preferredDepartmentId) ? preferredDepartmentId : (departments[0]?.id || '');
    departmentEl.innerHTML = departments.length
      ? departments.map(entity => `<option value="${entity.id}" ${entity.id === fallbackDepartmentId ? 'selected' : ''}>${entity.name}</option>`).join('')
      : '<option value="">No functions configured yet</option>';
    departmentEl.disabled = !departments.length || !(capability.canManageBusinessUnit && !capability.canManageDepartment);
  }
  if (capability.canManageBusinessUnit && !capability.canManageDepartment) businessUnitEl.addEventListener('change', renderUserDepartmentOptions);
  renderUserDepartmentOptions();
  renderUserCompanyRefinementHistory();

  document.querySelectorAll('.user-focus-chip').forEach(button => {
    button.addEventListener('click', () => {
      const next = Array.from(new Set([...(focusInput.getTags() || []), button.dataset.focus]));
      focusInput.setTags(next);
    });
  });

  async function loadUserAiSource() {
    const notes = document.getElementById('user-ai-source-notes')?.value.trim() || '';
    const file = document.getElementById('user-ai-source-file')?.files?.[0];
    let uploadedText = '';
    if (file) {
      const parsed = await parseRegisterFile(file);
      if (looksLikeBinaryRegister(parsed.text) && !['xlsx', 'xls'].includes(getFileExtension(file.name))) {
        throw new Error('The uploaded file appears unreadable. Please use Excel, TXT, CSV, TSV, JSON, or Markdown.');
      }
      uploadedText = parsed.text;
      userAiSourceText = uploadedText;
      userAiSourceName = file.name;
      const help = document.getElementById('user-ai-source-file-help');
      if (help) help.textContent = `Loaded ${file.name}. AI assist will use this content for your personal settings.`;
    }
    return [notes, uploadedText || userAiSourceText].filter(Boolean).join('\n\n');  }

  function buildUserAssistInput(sourceText = '') {
    const businessEntity = getEntityById(companyStructure, businessUnitEl.value.trim());
    const departmentEntity = getEntityById(companyStructure, departmentEl.value.trim());
    return {
      userProfile: {
        fullName: document.getElementById('user-full-name').value.trim() || AppState.currentUser?.displayName || '',
        jobTitle: document.getElementById('user-job-title').value.trim(),
        businessUnit: businessEntity?.name || profile.businessUnit || '',
        department: departmentEntity?.name || profile.department || '',
        focusAreas: focusInput.getTags(),
        preferredOutputs: document.getElementById('user-preferred-outputs').value.trim(),
        workingContext: document.getElementById('user-working-context').value.trim()
      },
      organisationContext: {
        businessUnitContext: businessEntity?.profile || getEntityLayerById(globalSettings, businessEntity?.id || '')?.contextSummary || '',
        departmentContext: departmentEntity?.profile || getEntityLayerById(globalSettings, departmentEntity?.id || '')?.contextSummary || '',
        companyStructureContext: buildOrganisationContextSummary(globalSettings),
        companyContextProfile: globalSettings.companyContextProfile || ''
      },
      currentSettings: {
        aiInstructions: document.getElementById('user-ai-instructions').value.trim(),
        adminContextSummary: document.getElementById('user-context-summary').value.trim(),
        userProfileSummary: buildUserProfileSummary(normaliseUserProfile(profile, AppState.currentUser))
      },
      uploadedText: sourceText
    };
  }

  function buildUserSettingsPayload() {
    const selectedBusinessUnitEntityId = businessUnitEl.value.trim();
    const selectedDepartmentEntityId = departmentEl.value.trim();
    const canSelectDepartment = capability.canManageBusinessUnit && !capability.canManageDepartment;
    const businessUnitEntityId = capability.managedBusinessId || capability.selection.businessUnitEntityId || '';
    const departmentEntityId = canSelectDepartment ? selectedDepartmentEntityId : (capability.managedDepartmentId || capability.selection.departmentEntityId || '');
    const businessEntity = getEntityById(companyStructure, businessUnitEntityId);
    const departmentEntity = getEntityById(companyStructure, departmentEntityId);
    return {
      payload: {
        companyContextSections: {
          companySummary: document.getElementById('user-company-section-summary').value.trim(),
          businessModel: document.getElementById('user-company-section-business-model').value.trim(),
          operatingModel: document.getElementById('user-company-section-operating-model').value.trim(),
          publicCommitments: document.getElementById('user-company-section-commitments').value.trim(),
          keyRiskSignals: document.getElementById('user-company-section-risks').value.trim(),
          obligations: document.getElementById('user-company-section-obligations').value.trim(),
          sources: document.getElementById('user-company-section-sources').value.trim()
        },
        geographyPrimary: document.getElementById('user-geo-primary').value.trim() || globalSettings.geography,
        geographySecondary: document.getElementById('user-geo-secondary').value.trim(),
        geographyTertiary: document.getElementById('user-geo-tertiary').value.trim(),
        geography: document.getElementById('user-geo-primary').value.trim() || globalSettings.geography,
        companyWebsiteUrl: websiteEl.value.trim(),
        companyContextProfile: serialiseCompanyContextSections({
          companySummary: document.getElementById('user-company-section-summary').value.trim(),
          businessModel: document.getElementById('user-company-section-business-model').value.trim(),
          operatingModel: document.getElementById('user-company-section-operating-model').value.trim(),
          publicCommitments: document.getElementById('user-company-section-commitments').value.trim(),
          keyRiskSignals: document.getElementById('user-company-section-risks').value.trim(),
          obligations: document.getElementById('user-company-section-obligations').value.trim(),
          sources: document.getElementById('user-company-section-sources').value.trim()
        }),
        userProfile: {
          fullName: document.getElementById('user-full-name').value.trim() || AppState.currentUser?.displayName || '',
          jobTitle: document.getElementById('user-job-title').value.trim(),
          department: departmentEntity?.name || '',
          businessUnit: businessEntity?.name || '',
          departmentEntityId: departmentEntity?.id || '',
          businessUnitEntityId,
          focusAreas: focusInput.getTags(),
          preferredOutputs: document.getElementById('user-preferred-outputs').value.trim(),
          workingContext: document.getElementById('user-working-context').value.trim()
        },
        defaultLinkMode: document.getElementById('user-link-mode').value === 'yes',
        riskAppetiteStatement: document.getElementById('user-appetite').value.trim() || globalSettings.riskAppetiteStatement,
        applicableRegulations: regsInput.getTags(),
        aiInstructions: document.getElementById('user-ai-instructions').value.trim(),
        benchmarkStrategy: document.getElementById('user-benchmark-strategy').value.trim() || globalSettings.benchmarkStrategy,
        adminContextSummary: document.getElementById('user-context-summary').value.trim() || globalSettings.adminContextSummary
      },
      businessUnitEntityId,
      departmentEntityId: departmentEntity?.id || ''
    };
  }


  async function persistUserSettings(showToast = false) {
    const { payload, businessUnitEntityId, departmentEntityId } = buildUserSettingsPayload();
    saveUserSettings(payload);
    if (!AppState.draft.geography) AppState.draft.geography = getEffectiveSettings().geography;
    saveDraft();
    if (showToast) UI.toast('Personal settings saved.', 'success');
  }

  const userSettingsRoot = document.querySelector('.settings-shell');
  bindAutosave(userSettingsRoot, () => persistUserSettings(false));
  bindSettingsSectionState('user-settings', document);
  restoreSettingsScroll('user-settings');
  updateWorkspaceSyncState('settings');

  document.getElementById('btn-save-user-settings').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-user-settings');
    const originalText = btn?.textContent || 'Save Personal Settings';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    }
    try {
      inlineValidationMessage = getUserSettingsValidationMessage();
      if (inlineValidationMessage) {
        AppState.settingsValidationMessage = inlineValidationMessage;
        rememberSettingsScroll('user-settings');
        renderUserPreferences(getUserSettings());
        return;
      }
      AppState.settingsValidationMessage = '';
      await persistUserSettings(true);
      await logAuditEvent({ category: 'profile', eventType: 'personal_settings_saved', target: AuthService.getCurrentUser()?.username || '', status: 'success', source: 'client' });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });

  document.getElementById('btn-export-user-settings')?.addEventListener('click', () => {
    ExportService.exportDataAsJson(getUserSettings(), `risk-calculator-user-settings-${AuthService.getCurrentUser()?.username || 'user'}.json`);
  });

  document.getElementById('btn-import-user-settings')?.addEventListener('click', () => {
    ExportService.importJsonFile({
      onData: async parsed => {
        if (!parsed || typeof parsed !== 'object') {
          UI.toast('That file does not contain valid personal settings.', 'warning');
          return;
        }
        rememberSettingsScroll('user-settings');
        await saveUserSettings(parsed);
        renderUserPreferences(getUserSettings());
        UI.toast('Personal settings imported.', 'success');
      },
      onError: () => UI.toast('That JSON file could not be imported.', 'warning')
    });
  });

  document.getElementById('btn-user-add-department')?.addEventListener('click', () => {
    if (!selectedBusinessEntity) return;
    openOrgEntityEditor({
      structure: companyStructure,
      seed: {
        type: 'Department / function',
        parentId: selectedBusinessEntity.id
      },
      onSave: (node, modal) => {
        const nextSettings = getAdminSettings();
        const nextStructure = Array.isArray(nextSettings.companyStructure) ? [...nextSettings.companyStructure] : [];
        nextStructure.push(node);
        saveAdminSettings({
          ...nextSettings,
          companyStructure: nextStructure
        });
        modal.close();
        UI.toast(`${node.name} added beneath ${selectedBusinessEntity.name}.`, 'success');
        renderUserPreferences(getUserSettings());
      }
    });
  });

  document.querySelectorAll('.btn-user-edit-department').forEach(button => {
    button.addEventListener('click', () => {
      const department = getEntityById(companyStructure, button.dataset.departmentId || '');
      if (!department) return;
      openOrgEntityEditor({
        structure: companyStructure,
        existingNode: department,
        onSave: (node, modal) => {
          const nextSettings = getAdminSettings();
          const nextStructure = Array.isArray(nextSettings.companyStructure) ? [...nextSettings.companyStructure] : [];
          const index = nextStructure.findIndex(item => item.id === node.id);
          if (index > -1) nextStructure[index] = node;
          saveAdminSettings({
            ...nextSettings,
            companyStructure: nextStructure
          });
          modal.close();
          UI.toast(`${node.name} updated.`, 'success');
          renderUserPreferences(getUserSettings());
        }
      });
    });
  });

  document.querySelectorAll('.btn-user-edit-department-context').forEach(button => {
    button.addEventListener('click', () => {
      const department = getEntityById(companyStructure, button.dataset.departmentId || '');
      if (!department) return;
      openEntityContextLayerEditor({
        entity: department,
        settings: globalSettings,
        onSave: (nextLayer, modal) => {
          const nextSettings = getAdminSettings();
          const layers = Array.isArray(nextSettings.entityContextLayers) ? [...nextSettings.entityContextLayers] : [];
          const index = layers.findIndex(item => item.entityId === nextLayer.entityId);
          if (index > -1) layers[index] = nextLayer;
          else layers.push(nextLayer);
          saveAdminSettings({
            ...nextSettings,
            entityContextLayers: layers
          });
          modal.close();
          UI.toast(`Saved context for ${department.name}.`, 'success');
          renderUserPreferences(getUserSettings());
        }
      });
    });
  });

  document.getElementById('btn-manage-owned-department')?.addEventListener('click', () => {
    if (!selectedDepartment) return;
    openEntityContextLayerEditor({
      entity: selectedDepartment,
      onSave: (nextLayer, modal) => {
        const nextSettings = getAdminSettings();
        const layers = Array.isArray(nextSettings.entityContextLayers) ? [...nextSettings.entityContextLayers] : [];
        const index = layers.findIndex(item => item.entityId === nextLayer.entityId);
        if (index > -1) layers[index] = nextLayer;
        else layers.push(nextLayer);
        saveAdminSettings({
          ...nextSettings,
          entityContextLayers: layers
        });
        modal.close();
        UI.toast(`Saved context for ${selectedDepartment.name}.`, 'success');
        renderUserPreferences(getUserSettings());
      },
      readOnlyIdentity: true
    });
  });

  document.getElementById('btn-build-user-context').addEventListener('click', async () => {
    const btn = document.getElementById('btn-build-user-context');
    const websiteUrl = websiteEl.value.trim();
    const llmConfig = getSessionLLMConfig();
    if (!websiteUrl) {
      UI.toast('Enter a company website URL first.', 'warning');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Building context…';
    try {
      LLMService.setCompassConfig(llmConfig);
      const uploaded = await loadContextSupportSource('user-company-source-file', 'user-company-source-help');
      let result = await LLMService.buildCompanyContext(websiteUrl);
      applyUserCompanyContextResult(result);
      if (uploaded.text) {
        result = await LLMService.refineCompanyContext({
          websiteUrl,
          currentSections: getCurrentUserCompanySections(),
          currentAiGuidance: document.getElementById('user-ai-instructions').value.trim(),
          currentGeography: document.getElementById('user-geo-primary').value.trim(),
          currentRegulations: regsInput.getTags(),
          history: [],
          userPrompt: 'Incorporate the uploaded strategy, policy, procedure, and operating-model material into this company context draft while keeping it concise and grounded.',
          uploadedText: uploaded.text,
          uploadedDocumentName: uploaded.name
        });
        applyUserCompanyContextResult(result);
      }
      companyRefinementHistory.push({ role: 'assistant', text: uploaded.text ? 'Initial company context draft created and refined using the uploaded source material. Use follow-up prompts below if you want to reshape it further.' : 'Initial company context draft created. Use follow-up prompts below if you want to reshape it further.' });
      renderUserCompanyRefinementHistory();
      if (companyRefineStatusEl) companyRefineStatusEl.textContent = 'Initial AI draft applied. Use the follow-up prompt box below to keep refining it.';
      UI.toast('Personal company context built from public sources.', 'success', 5000);
    } catch (error) {
      UI.toast('Company context build failed. Try again or shorten the source material.', 'danger', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Build from Website';
    }
  });

  document.getElementById('btn-refine-user-context').addEventListener('click', async () => {
    const prompt = companyFollowupEl.value.trim();
    const websiteUrl = websiteEl.value.trim();
    const llmConfig = getSessionLLMConfig();
    if (!websiteUrl) {
      UI.toast('Enter a company website URL first.', 'warning');
      return;
    }
    if (!prompt) {
      UI.toast('Enter a follow-up prompt first.', 'warning');
      return;
    }
    const btn = document.getElementById('btn-refine-user-context');
    btn.disabled = true;
    btn.textContent = 'Applying…';
    try {
      if (companyRefineStatusEl) companyRefineStatusEl.textContent = 'Applying your latest instruction to the company context…';
      companyRefinementHistory.push({ role: 'user', text: prompt });
      renderUserCompanyRefinementHistory();
      LLMService.setCompassConfig(llmConfig);
      const uploaded = await loadContextSupportSource('user-company-source-file', 'user-company-source-help');
      const refineInput = {
        websiteUrl,
        currentSections: getCurrentUserCompanySections(),
        currentAiGuidance: document.getElementById('user-ai-instructions').value.trim(),
        currentGeography: document.getElementById('user-geo-primary').value.trim(),
        currentRegulations: regsInput.getTags(),
        history: companyRefinementHistory,
        userPrompt: prompt,
        uploadedText: uploaded.text,
        uploadedDocumentName: uploaded.name
      };
      let result;
      try {
        result = await LLMService.refineCompanyContext(refineInput);
      } catch {
        result = buildLocalUserCompanyContextFallback(refineInput);
      }
      applyUserCompanyContextResult(result);
      companyRefinementHistory.push({ role: 'assistant', text: result.responseMessage || 'I refined the company context based on your latest prompt.' });
      renderUserCompanyRefinementHistory();
      companyFollowupEl.value = '';
      if (companyRefineStatusEl) companyRefineStatusEl.textContent = 'Latest follow-up applied. Keep iterating until the context feels right.';
      UI.toast('Personal company context refined.', 'success', 5000);
    } catch (error) {
      UI.toast('Company context refinement failed. Try again or shorten the prompt.', 'danger', 6000);
      if (companyRefineStatusEl) companyRefineStatusEl.textContent = 'Company context refinement failed. Try again or shorten the prompt.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Follow-Up Now';
    }
  });

  document.getElementById('btn-user-role-ai').addEventListener('click', async () => {
    const btn = document.getElementById('btn-user-role-ai');
    btn.disabled = true;
    btn.textContent = 'Building…';
    try {
      const sourceText = await loadUserAiSource();
      const llmConfig = getSessionLLMConfig();
      LLMService.setCompassConfig({
        apiUrl: llmConfig.apiUrl || DEFAULT_COMPASS_PROXY_URL,
        model: llmConfig.model || 'gpt-5.1',
        apiKey: llmConfig.apiKey || ''
      });
      const result = await LLMService.buildUserPreferenceAssist(buildUserAssistInput(sourceText));
      document.getElementById('user-working-context').value = result.workingContext || document.getElementById('user-working-context').value;
      document.getElementById('user-preferred-outputs').value = result.preferredOutputs || document.getElementById('user-preferred-outputs').value;
      if (result.aiInstructions && !document.getElementById('user-ai-instructions').value.trim()) {
        document.getElementById('user-ai-instructions').value = result.aiInstructions;
      }
      UI.toast(result.usedFallback ? 'Suggested role-context draft loaded with fallback guidance.' : 'Suggested role-context draft loaded.', result.usedFallback ? 'warning' : 'success', 5000);
    } catch (error) {
      UI.toast('AI assist failed. Try again in a moment.', 'danger', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI Assist Role Context';
    }
  });

  document.getElementById('btn-user-defaults-ai').addEventListener('click', async () => {
    const btn = document.getElementById('btn-user-defaults-ai');
    btn.disabled = true;
    btn.textContent = 'Building…';
    try {
      const sourceText = await loadUserAiSource();
      const llmConfig = getSessionLLMConfig();
      LLMService.setCompassConfig({
        apiUrl: llmConfig.apiUrl || DEFAULT_COMPASS_PROXY_URL,
        model: llmConfig.model || 'gpt-5.1',
        apiKey: llmConfig.apiKey || ''
      });
      const result = await LLMService.buildUserPreferenceAssist(buildUserAssistInput(sourceText));
      document.getElementById('user-context-summary').value = result.adminContextSummary || document.getElementById('user-context-summary').value;
      document.getElementById('user-ai-instructions').value = result.aiInstructions || document.getElementById('user-ai-instructions').value;
      UI.toast(result.usedFallback ? 'Suggested personal-defaults draft loaded with fallback guidance.' : 'Suggested personal-defaults draft loaded.', result.usedFallback ? 'warning' : 'success', 5000);
    } catch (error) {
      UI.toast('AI assist failed. Try again in a moment.', 'danger', 6000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'AI Assist Personal Defaults';
    }
  });

  document.getElementById('btn-reset-user-settings').addEventListener('click', async () => {
    if (await UI.confirm('Reset your personal settings to the global admin defaults?')) {
      localStorage.removeItem(buildUserStorageKey(USER_SETTINGS_STORAGE_PREFIX));
      UI.toast('Your personal settings were reset.', 'success');
      rememberSettingsScroll('user-settings');
      renderUserOnboarding(getUserSettings(), 0);
    }
  });

  document.getElementById('btn-rerun-onboarding').addEventListener('click', () => {
    rememberSettingsScroll('user-settings');
    renderUserOnboarding(getUserSettings(), 0);
  });
}
