const AdminAuditLogSection = (() => {
  const AUDIT_FILTERS = [
    {
      key: 'login_success',
      label: 'Login Success',
      countKey: 'loginSuccessCount',
      foot: 'Show successful sign-ins.',
      emptyTitle: 'No successful sign-ins are visible in the current audit window.',
      matches: entry => String(entry?.eventType || '') === 'login_success'
    },
    {
      key: 'login_failure',
      label: 'Login Failure',
      countKey: 'loginFailureCount',
      foot: 'Show failed sign-ins.',
      emptyTitle: 'No failed sign-ins are visible in the current audit window.',
      matches: entry => String(entry?.eventType || '') === 'login_failure'
    },
    {
      key: 'logout',
      label: 'Logout',
      countKey: 'logoutCount',
      foot: 'Show sign-outs.',
      emptyTitle: 'No sign-outs are visible in the current audit window.',
      matches: entry => String(entry?.eventType || '') === 'logout'
    },
    {
      key: 'admin',
      label: 'Admin Actions',
      countKey: 'adminActionCount',
      foot: 'Show platform admin activity.',
      emptyTitle: 'No admin actions are visible in the current audit window.',
      matches: entry => String(entry?.actorRole || '') === 'admin'
    },
    {
      key: 'bu_admin',
      label: 'BU Admin Actions',
      countKey: 'buAdminActionCount',
      foot: 'Show BU admin activity.',
      emptyTitle: 'No BU admin actions are visible in the current audit window.',
      matches: entry => String(entry?.actorRole || '') === 'bu_admin'
    },
    {
      key: 'user',
      label: 'User Actions',
      countKey: 'userActionCount',
      foot: 'Show standard-user activity.',
      emptyTitle: 'No standard-user actions are visible in the current audit window.',
      matches: entry => String(entry?.actorRole || '') === 'user'
    }
  ];
  let activeFilterKey = '';
  let activeSearchQuery = '';
  let activeRoleFilter = 'all';
  let activeCategoryFilter = 'all';
  let activeStatusFilter = 'all';
  let activeSourceFilter = 'all';
  const expandedEntryIds = new Set();

  function escape(value = '') {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function formatLogTimestamp(value, fallback = 'Unknown time') {
    return typeof formatOperationalDateTime === 'function'
      ? formatOperationalDateTime(value, { includeSeconds: true, fallback })
      : fallback;
  }

  function getActiveFilter() {
    return AUDIT_FILTERS.find(filter => filter.key === activeFilterKey) || null;
  }

  function formatFilterLabel(value = '', fallback = 'Unknown') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    return text
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function normaliseFilterValue(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function formatAuditValue(value = '') {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value ?? '');
  }

  function formatAuditDetailDisplayValue(key = '', value = '') {
    const safeKey = String(key || '').trim().toLowerCase();
    if (['reviewscope', 'assignedreviewerrole', 'actorrole', 'role', 'category', 'source', 'status'].includes(safeKey)) {
      return formatFilterLabel(value, 'Unknown');
    }
    return formatAuditValue(value);
  }

  function buildAuditSearchHaystack(entry = {}) {
    return [
      entry.ts,
      entry.actorUsername,
      entry.actorRole,
      entry.category,
      entry.eventType,
      entry.target,
      entry.status,
      entry.source,
      ...Object.entries(entry.details || {}).flatMap(([key, value]) => [key, formatAuditValue(value)])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function getActiveSecondaryFilters() {
    return {
      search: activeSearchQuery.trim(),
      actorRole: activeRoleFilter,
      category: activeCategoryFilter,
      status: activeStatusFilter,
      source: activeSourceFilter
    };
  }

  function hasAnySecondaryFilters() {
    const filters = getActiveSecondaryFilters();
    return !!(filters.search || filters.actorRole !== 'all' || filters.category !== 'all' || filters.status !== 'all' || filters.source !== 'all');
  }

  function buildFilterOptions(entries = [], field = '') {
    return Array.from(new Set(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => normaliseFilterValue(entry?.[field]))
        .filter(Boolean)
    ))
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value, label: formatFilterLabel(value) }));
  }

  function renderSelectOptions(options = [], activeValue = 'all', placeholder = 'All') {
    return [
      `<option value="all"${activeValue === 'all' ? ' selected' : ''}>${escape(placeholder)}</option>`,
      ...options.map((option) => `<option value="${escape(option.value)}"${option.value === activeValue ? ' selected' : ''}>${escape(option.label)}</option>`)
    ].join('');
  }

  function renderSummaryCard(filter, auditSummary = {}, activeFilter = null) {
    const isActive = Boolean(activeFilter && activeFilter.key === filter.key);
    return `<button class="admin-overview-card admin-overview-card--interactive${isActive ? ' is-active' : ''}" type="button" data-audit-filter-key="${escape(filter.key)}" aria-pressed="${isActive ? 'true' : 'false'}">
      <div class="admin-overview-label">${escape(filter.label)}</div>
      <div class="admin-overview-value">${escape(auditSummary[filter.countKey] || 0)}</div>
      <div class="admin-overview-foot">${escape(isActive ? 'Filtering the recent activity table below.' : filter.foot)}</div>
    </button>`;
  }

  function renderAuditDetailRows(entry = {}) {
    const detailEntries = Object.entries(entry.details || {})
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `<div class="audit-log-detail-item"><div class="audit-log-detail-key">${escape(formatFilterLabel(key))}</div><div class="audit-log-detail-value">${escape(formatAuditDetailDisplayValue(key, value))}</div></div>`)
      .join('');
    return `<div class="audit-log-detail-panel">
      <div class="audit-log-chip-row">
        <span class="audit-log-chip">${escape(formatFilterLabel(entry.category, 'General'))}</span>
        <span class="audit-log-chip">${escape(formatFilterLabel(entry.source, 'Server'))}</span>
        <span class="audit-log-chip">${escape(formatFilterLabel(entry.actorRole, 'System'))}</span>
        <span class="audit-log-chip audit-log-chip--status audit-log-chip--${escape(normaliseFilterValue(entry.status) || 'success')}">${escape(formatFilterLabel(entry.status, 'Success'))}</span>
      </div>
      <div class="audit-log-detail-grid">
        <div class="audit-log-detail-item">
          <div class="audit-log-detail-key">Activity</div>
          <div class="audit-log-detail-value">${escape(entry.eventType || 'event')}</div>
        </div>
        <div class="audit-log-detail-item">
          <div class="audit-log-detail-key">Target</div>
          <div class="audit-log-detail-value">${escape(entry.target || '—')}</div>
        </div>
        ${detailEntries || '<div class="audit-log-detail-item"><div class="audit-log-detail-key">Details</div><div class="audit-log-detail-value">No additional details were recorded for this event.</div></div>'}
      </div>
    </div>`;
  }

  function renderAuditRows(auditEntries = []) {
    if (auditEntries.length) {
      return auditEntries.map((entry) => {
        const entryId = escape(entry.id || `${entry.ts || ''}-${entry.eventType || 'event'}`);
        const expanded = expandedEntryIds.has(entry.id || `${entry.ts || ''}-${entry.eventType || 'event'}`);
        const detailSummary = formatAuditDetails(entry.details) || 'No extra details';
        return `<tr class="audit-log-row${expanded ? ' is-expanded' : ''}" data-audit-entry-id="${entryId}">
          <td>${escape(formatLogTimestamp(entry.ts))}</td>
          <td>
            <div class="audit-log-user-cell">
              <strong>${escape(entry.actorUsername || 'system')}</strong>
              <div class="form-help">${escape(formatFilterLabel(entry.actorRole, 'System'))}</div>
            </div>
          </td>
          <td>
            <div class="audit-log-activity-cell">
              <strong>${escape(entry.eventType || 'event')}</strong>
              <div class="audit-log-inline-meta">${escape(detailSummary)}</div>
            </div>
          </td>
          <td>${escape(entry.target || '—')}</td>
          <td><span class="audit-log-chip audit-log-chip--status audit-log-chip--${escape(normaliseFilterValue(entry.status) || 'success')}">${escape(formatFilterLabel(entry.status, 'Success'))}</span></td>
          <td><button class="btn btn--ghost btn--sm" type="button" data-audit-detail-toggle="${entryId}" aria-expanded="${expanded ? 'true' : 'false'}">${expanded ? 'Hide details' : 'Details'}</button></td>
        </tr>${expanded ? `<tr class="audit-log-detail-row" data-audit-detail-row="${entryId}"><td colspan="6">${renderAuditDetailRows(entry)}</td></tr>` : ''}`;
      }).join('');
    }
    const activeFilter = getActiveFilter();
    return `<tr><td colspan="6"><div class="empty-state"><strong>${escape(activeFilter?.emptyTitle || 'No recent activity loaded yet.')}</strong><div style="margin-top:8px">${escape(activeFilter || hasAnySecondaryFilters() ? 'Clear the filters or refresh logs to inspect a wider audit window.' : 'Use Refresh Logs after the next sign-in, review action, password reset, account change, or settings update to confirm the audit trail is moving.')}</div></div></td></tr>`;
  }

  function renderSection({ auditCache }) {
    const auditSummary = auditCache.summary || {};
    const loadedEntries = Array.isArray(auditCache.entries) ? auditCache.entries : [];
    const activeFilter = getActiveFilter();
    const secondaryFilters = getActiveSecondaryFilters();
    const filteredEntries = loadedEntries.filter((entry) => {
      if (activeFilter && !activeFilter.matches(entry)) return false;
      if (secondaryFilters.actorRole !== 'all' && normaliseFilterValue(entry.actorRole) !== secondaryFilters.actorRole) return false;
      if (secondaryFilters.category !== 'all' && normaliseFilterValue(entry.category) !== secondaryFilters.category) return false;
      if (secondaryFilters.status !== 'all' && normaliseFilterValue(entry.status) !== secondaryFilters.status) return false;
      if (secondaryFilters.source !== 'all' && normaliseFilterValue(entry.source) !== secondaryFilters.source) return false;
      if (secondaryFilters.search && !buildAuditSearchHaystack(entry).includes(secondaryFilters.search.toLowerCase())) return false;
      return true;
    });
    const auditEntries = filteredEntries.slice(0, 25);
    const runtimeEntries = Array.isArray(AppState.clientRuntimeErrors) ? AppState.clientRuntimeErrors.slice(0, 5) : [];
    const roleOptions = buildFilterOptions(loadedEntries, 'actorRole');
    const categoryOptions = buildFilterOptions(loadedEntries, 'category');
    const statusOptions = buildFilterOptions(loadedEntries, 'status');
    const sourceOptions = buildFilterOptions(loadedEntries, 'source');
    const hasActiveFilters = !!activeFilter || hasAnySecondaryFilters();
    const lastLoadedLabel = Number(auditCache.lastLoadedAt || 0)
      ? formatLogTimestamp(auditCache.lastLoadedAt, 'Unknown time')
      : 'Not refreshed yet';
    return renderSettingsSection({
      title: 'Activity Log',
      scope: 'admin-settings',
      description: 'Recent platform activity for sign-in events, review workflow actions, user changes, and shared settings updates.',
      meta: activeFilter
        ? `${filteredEntries.length} matching loaded events · ${auditSummary.total || loadedEntries.length || 0} recent events`
        : (auditSummary.total ? `${auditSummary.total} recent events` : 'Recent activity only'),
      body: `<div class="admin-overview-grid" id="admin-audit-summary-grid">
        ${AUDIT_FILTERS.map(filter => renderSummaryCard(filter, auditSummary, activeFilter)).join('')}
      </div>
      <div class="audit-log-toolbar">
        <div class="audit-log-toolbar__actions">
          <button class="btn btn--secondary" id="btn-refresh-audit-log" type="button">${auditCache.loading ? 'Refreshing…' : 'Refresh Logs'}</button>
          <div class="form-help audit-log-toolbar__meta">Last refreshed: <strong>${escape(lastLoadedLabel)}</strong></div>
          <div class="form-help audit-log-toolbar__meta">Loaded ${escape(String(loadedEntries.length || 0))} / ${escape(String(auditSummary.retainedCapacity || 200))} retained</div>
        </div>
        <span class="form-help" id="audit-log-status">${auditCache.error || 'Older activity rolls off automatically. All timestamps use Dubai time (GST) with UK date order.'}</span>
      </div>
      <div class="audit-log-controls">
        <label class="field audit-log-control">
          <span>Search logs</span>
          <input class="input" id="audit-log-search" type="search" value="${escape(activeSearchQuery)}" placeholder="Search user, event, target, or detail">
        </label>
        <label class="field audit-log-control">
          <span>Category</span>
          <select class="input" id="audit-log-category-filter">${renderSelectOptions(categoryOptions, activeCategoryFilter, 'All categories')}</select>
        </label>
        <label class="field audit-log-control">
          <span>Status</span>
          <select class="input" id="audit-log-status-filter">${renderSelectOptions(statusOptions, activeStatusFilter, 'All outcomes')}</select>
        </label>
        <label class="field audit-log-control">
          <span>Source</span>
          <select class="input" id="audit-log-source-filter">${renderSelectOptions(sourceOptions, activeSourceFilter, 'All sources')}</select>
        </label>
        <label class="field audit-log-control">
          <span>Actor role</span>
          <select class="input" id="audit-log-role-filter">${renderSelectOptions(roleOptions, activeRoleFilter, 'All roles')}</select>
        </label>
      </div>
      ${hasActiveFilters ? `<div class="audit-log-filter-banner" id="audit-log-active-filter">
        <div>
          <strong>${escape(activeFilter ? activeFilter.label : 'Filtered audit view')}</strong>
          <div class="form-help">Showing up to 25 matching events from the currently loaded audit window.</div>
        </div>
        <button class="btn btn--ghost btn--sm" id="btn-clear-audit-filters" type="button">Clear All Filters</button>
      </div>` : ''}
      ${UI.adminTableCard({
        title: 'Runtime health',
        description: 'Recent browser-side errors captured in this admin session only.',
        table: runtimeEntries.length ? `<table class="data-table">
          <thead><tr><th>Time</th><th>Kind</th><th>Message</th><th>Route</th><th>Source</th></tr></thead>
          <tbody>${runtimeEntries.map(entry => `<tr><td>${escape(formatLogTimestamp(entry.ts))}</td><td>${escape(entry.kind)}</td><td>${escape(entry.message)}</td><td>${escape(entry.route || '—')}</td><td>${escape(entry.source || '—')}</td></tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state">No client-side runtime errors have been captured in this admin session.</div>'
      })}
      ${UI.adminTableCard({
        title: 'Recent activity',
        description: hasActiveFilters
          ? 'Filtered within the currently loaded audit window.'
          : 'Use this view to confirm sign-ins, review actions, user changes, and shared-setting updates.',
        table: `<table class="data-table" id="admin-audit-activity-table">
          <thead><tr><th>Time</th><th>User</th><th>Activity</th><th>Target</th><th>Outcome</th><th>More</th></tr></thead>
          <tbody>${renderAuditRows(auditEntries)}</tbody>
        </table>`
      })}`
    });
  }

  function bind({ rerenderCurrentAdminSection }) {
    document.getElementById('btn-refresh-audit-log')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-refresh-audit-log');
      const status = document.getElementById('audit-log-status');
      const originalText = btn?.textContent || 'Refresh Logs';
      const originalStatus = status?.textContent || '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Refreshing…';
      }
      if (status) status.textContent = 'Refreshing recent logs…';
      try {
        await loadAuditLog();
        rerenderCurrentAdminSection();
      } catch (error) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
        if (status) status.textContent = originalStatus;
        UI.toast('Audit logs could not be refreshed right now.', 'warning');
      }
    });
    document.querySelectorAll('[data-audit-filter-key]').forEach(button => {
      button.addEventListener('click', () => {
        const nextKey = String(button.getAttribute('data-audit-filter-key') || '').trim();
        activeFilterKey = activeFilterKey === nextKey ? '' : nextKey;
        rerenderCurrentAdminSection();
      });
    });
    document.getElementById('audit-log-search')?.addEventListener('input', (event) => {
      activeSearchQuery = String(event?.target?.value || '');
      rerenderCurrentAdminSection();
    });
    document.getElementById('audit-log-role-filter')?.addEventListener('change', (event) => {
      activeRoleFilter = normaliseFilterValue(event?.target?.value) || 'all';
      rerenderCurrentAdminSection();
    });
    document.getElementById('audit-log-category-filter')?.addEventListener('change', (event) => {
      activeCategoryFilter = normaliseFilterValue(event?.target?.value) || 'all';
      rerenderCurrentAdminSection();
    });
    document.getElementById('audit-log-status-filter')?.addEventListener('change', (event) => {
      activeStatusFilter = normaliseFilterValue(event?.target?.value) || 'all';
      rerenderCurrentAdminSection();
    });
    document.getElementById('audit-log-source-filter')?.addEventListener('change', (event) => {
      activeSourceFilter = normaliseFilterValue(event?.target?.value) || 'all';
      rerenderCurrentAdminSection();
    });
    document.getElementById('btn-clear-audit-filters')?.addEventListener('click', () => {
      activeFilterKey = '';
      activeSearchQuery = '';
      activeRoleFilter = 'all';
      activeCategoryFilter = 'all';
      activeStatusFilter = 'all';
      activeSourceFilter = 'all';
      expandedEntryIds.clear();
      rerenderCurrentAdminSection();
    });
    document.querySelectorAll('[data-audit-detail-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const entryId = String(button.getAttribute('data-audit-detail-toggle') || '').trim();
        if (!entryId) return;
        if (expandedEntryIds.has(entryId)) expandedEntryIds.delete(entryId);
        else expandedEntryIds.add(entryId);
        rerenderCurrentAdminSection();
      });
    });
    if (!AppState.auditLogCache.loaded && !AppState.auditLogCache.loading) {
      loadAuditLog().then(() => {
        rerenderCurrentAdminSection();
      }).catch(() => {});
    }
  }

  return { renderSection, bind };
})();
