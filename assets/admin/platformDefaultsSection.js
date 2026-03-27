const AdminPlatformDefaultsSection = (() => {
  function renderScopedDefaultsSummary(targetBu, settings) {
    if (!targetBu) {
      return '<div class="form-help">Choose a mapped business unit or entity to define scoped governance for that slice of the organisation.</div>';
    }
    const linkedEntity = targetBu.orgEntityId ? getEntityById(settings.companyStructure || [], targetBu.orgEntityId) : null;
    const rows = [
      ['Scope target', targetBu.name],
      ['Linked entity', linkedEntity ? `${linkedEntity.name} (${linkedEntity.type})` : 'No linked entity'],
      ['Geography override', targetBu.geography || 'Inherit platform default'],
      ['Linked-risk default', typeof targetBu.defaultLinkMode === 'boolean' ? (targetBu.defaultLinkMode ? 'Enabled' : 'Disabled') : 'Inherit platform default'],
      ['Warning trigger', targetBu.warningThresholdUsd ? `USD ${formatGroupedNumber(targetBu.warningThresholdUsd)}` : 'Inherit platform default'],
      ['Tolerance threshold', targetBu.toleranceThresholdUsd ? `USD ${formatGroupedNumber(targetBu.toleranceThresholdUsd)}` : 'Inherit platform default'],
      ['Annual review trigger', targetBu.annualReviewThresholdUsd ? `USD ${formatGroupedNumber(targetBu.annualReviewThresholdUsd)}` : 'Inherit platform default'],
      ['Regulations', Array.isArray(targetBu.regulatoryTags) && targetBu.regulatoryTags.length ? targetBu.regulatoryTags.join(', ') : 'Inherit platform defaults plus entity context'],
      ['AI guidance', targetBu.aiGuidance || 'Inherit platform default'],
      ['Benchmark strategy', targetBu.benchmarkStrategy || 'Inherit platform default'],
      ['Risk appetite', targetBu.riskAppetiteStatement || 'Inherit platform default'],
      ['Escalation guidance', targetBu.escalationGuidance || 'Inherit platform default']
    ];
    return `<div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)">
      <div class="context-panel-title">Scoped governance summary</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px">
        ${rows.map(([label, value]) => `<div><div class="form-help" style="margin:0 0 4px 0">${label}</div><div style="color:var(--text-primary);line-height:1.5">${escapeHtml(value)}</div></div>`).join('')}
      </div>
    </div>`;
  }

  function renderDefaultsBody(settings) {
    return `<div class="admin-workbench-strip">
      <div>
        <div class="admin-workbench-strip__label">Current fallback</div>
        <strong>${escapeHtml(settings.geography || 'Default geography not set')}</strong>
        <span>Adjust global thresholds and fallback posture here. Governance inputs stay in their own screen.</span>
      </div>
      <div class="admin-workbench-strip__meta">
        <span class="badge badge--neutral">${typeof settings.defaultLinkMode === 'boolean' ? (settings.defaultLinkMode ? 'Linked risk on' : 'Linked risk off') : 'Linked risk default'}</span>
      </div>
    </div>
    <div class="grid-3">
      <div class="form-group">
        <label class="form-label" for="admin-warning-threshold">Warning Trigger (USD)</label>
        <input class="form-input money-input" id="admin-warning-threshold" type="text" inputmode="numeric" value="${formatCurrencyInputValue(settings.warningThresholdUsd, 'USD')}">
        <span class="form-help">Amber signal when per-event P90 reaches this value.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="admin-tolerance-threshold">Tolerance Threshold (USD)</label>
        <input class="form-input money-input" id="admin-tolerance-threshold" type="text" inputmode="numeric" value="${formatCurrencyInputValue(settings.toleranceThresholdUsd, 'USD')}">
        <span class="form-help">Red trigger when per-event P90 exceeds this value.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="admin-annual-threshold">Annual Review Trigger (USD)</label>
        <input class="form-input money-input" id="admin-annual-threshold" type="text" inputmode="numeric" value="${formatCurrencyInputValue(settings.annualReviewThresholdUsd, 'USD')}">
        <span class="form-help">Used to flag high annual exposure in the results view.</span>
      </div>
    </div>
    <div class="grid-2 mt-4">
      <div class="form-group">
        <label class="form-label" for="admin-geo">Default Geography</label>
        <input class="form-input" id="admin-geo" value="${settings.geography}">
      </div>
      <div class="form-group">
        <label class="form-label" for="admin-link-mode">Default Linked-Risk Mode</label>
        <select class="form-select" id="admin-link-mode">
          <option value="yes" ${settings.defaultLinkMode ? 'selected' : ''}>Enabled</option>
          <option value="no" ${!settings.defaultLinkMode ? 'selected' : ''}>Disabled</option>
        </select>
      </div>
    </div>
    <div class="form-group mt-4">
      <label class="form-label" for="admin-escalation-guidance">Escalation Guidance</label>
      <textarea class="form-textarea" id="admin-escalation-guidance" rows="3">${settings.escalationGuidance}</textarea>
    </div>
    <div class="form-group mt-4">
      <label class="form-label" for="admin-appetite">Risk Appetite Statement</label>
      <textarea class="form-textarea" id="admin-appetite" rows="4">${settings.riskAppetiteStatement}</textarea>
    </div>`;
  }

  function renderGovernanceBody(settings) {
    const buList = getBUList();
    const firstScopedId = buList[0]?.id || '';
    return `<div class="admin-workbench-strip">
      <div>
        <div class="admin-workbench-strip__label">Governance inputs</div>
        <strong>Regulations, AI guidance, departments, and scoped overrides</strong>
        <span>Keep platform-level guidance and scoped defaults deliberate. Global financial thresholds stay on Platform Defaults.</span>
      </div>
      <div class="admin-workbench-strip__meta">
        <span class="badge badge--neutral">${Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations.length : 0} regulations</span>
      </div>
    </div>
    <div class="form-group mt-4">
      <label class="form-label" for="admin-context-summary">Admin Context Summary</label>
      <textarea class="form-textarea" id="admin-context-summary" rows="2">${settings.adminContextSummary}</textarea>
    </div>
    <div class="form-group mt-4">
      <label class="form-label">Applicable Regulations</label>
      <div class="tag-input-wrap" id="ti-admin-regulations"></div>
    </div>
    <div class="form-group mt-4">
      <label class="form-label">Typical Departments</label>
      <div class="tag-input-wrap" id="ti-admin-typical-departments"></div>
      <span class="form-help">These appear as suggested department names when BU admins or global admins add a new function or department.</span>
    </div>
    <div class="form-group mt-4">
      <label class="form-label" for="admin-ai-instructions">AI Guidance</label>
      <textarea class="form-textarea" id="admin-ai-instructions" rows="3">${settings.aiInstructions}</textarea>
    </div>
    <div class="form-group mt-4">
      <label class="form-label" for="admin-benchmark-strategy">Benchmark Strategy</label>
      <textarea class="form-textarea" id="admin-benchmark-strategy" rows="3">${settings.benchmarkStrategy}</textarea>
      <span class="form-help">Explain whether the AI should prefer GCC or UAE references first, and how it should justify any global fallback.</span>
    </div>
    <div class="card mt-5" style="padding:var(--sp-5);background:var(--bg-elevated)">
      <div class="context-panel-title">Scoped defaults for a BU or entity</div>
      <div class="form-help" style="margin-top:6px">Choose a BU or linked entity when that part of the organisation needs different thresholds, guidance, or regulatory defaults.</div>
      <div class="grid-2 mt-4" style="gap:12px">
        <div class="form-group">
          <label class="form-label" for="admin-scoped-default-target">Choose a BU or linked entity</label>
          <select class="form-select" id="admin-scoped-default-target">
            <option value="">Select a BU or linked entity</option>
            ${buList.map(bu => {
              const linkedEntity = bu.orgEntityId ? getEntityById(settings.companyStructure || [], bu.orgEntityId) : null;
              const label = linkedEntity ? `${bu.name} (${linkedEntity.name})` : bu.name;
              return `<option value="${bu.id}" ${bu.id === firstScopedId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group" style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
          <button class="btn btn--secondary" id="btn-edit-scoped-defaults" type="button">Edit Scoped Defaults</button>
          <a class="btn btn--ghost" href="#/admin/bu">Open Org Customisation</a>
        </div>
      </div>
      <div id="admin-scoped-default-summary" class="mt-4">${renderScopedDefaultsSummary(buList[0] || null, settings)}</div>
    </div>
    <div class="admin-inline-actions mt-4">
      <a class="btn btn--secondary" href="#/admin/docs">Open Document Library</a>
    </div>`;
  }

  function renderSection({ settings, mode = 'defaults' }) {
    const isGovernance = mode === 'governance';
    return renderSettingsSection({
      title: isGovernance ? 'Governance Inputs' : 'Platform Defaults',
      scope: 'admin-settings',
      description: isGovernance
        ? 'Manage regulations, AI guidance, typical departments, and scoped governance overrides without crowding the platform default controls.'
        : 'Set the global fallback thresholds and default posture first. Governance inputs and scoped overrides live separately so this screen stays easier to control.',
      meta: isGovernance ? `${Array.isArray(settings.applicableRegulations) ? settings.applicableRegulations.length : 0} regulation tags` : `${settings.geography} default geography`,
      body: isGovernance ? renderGovernanceBody(settings) : renderDefaultsBody(settings)
    });
  }

  function bind({ settings, mode = 'defaults' }) {
    attachFormattedMoneyInputs();
    const regsHost = document.getElementById('ti-admin-regulations');
    const regsInput = regsHost ? UI.tagInput('ti-admin-regulations', settings.applicableRegulations) : null;
    const typicalDepartmentsHost = document.getElementById('ti-admin-typical-departments');
    const typicalDepartmentsInput = typicalDepartmentsHost ? UI.tagInput('ti-admin-typical-departments', getTypicalDepartments(settings)) : null;
    const targetEl = document.getElementById('admin-scoped-default-target');
    const summaryEl = document.getElementById('admin-scoped-default-summary');
    const updateSummary = () => {
      if (!summaryEl) return;
      const targetBu = getBUList().find(item => item.id === (targetEl?.value || '')) || null;
      summaryEl.innerHTML = renderScopedDefaultsSummary(targetBu, getAdminSettings());
    };
    targetEl?.addEventListener('change', updateSummary);
    document.getElementById('btn-edit-scoped-defaults')?.addEventListener('click', () => {
      const targetBu = getBUList().find(item => item.id === (targetEl?.value || '')) || null;
      if (!targetBu) {
        UI.toast('Choose a BU or linked entity first.', 'warning');
        return;
      }
      openBUEditor(targetBu, {
        onSave: updated => {
          if (targetEl) targetEl.value = updated.id;
          updateSummary();
        }
      });
    });
    return {
      regsInput,
      typicalDepartmentsInput,
      updateScopedSummary: updateSummary,
      mode
    };
  }

  return { renderSection, bind };
})();
