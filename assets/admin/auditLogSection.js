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

  function escape(value = '') {
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function getActiveFilter() {
    return AUDIT_FILTERS.find(filter => filter.key === activeFilterKey) || null;
  }

  function renderSummaryCard(filter, auditSummary = {}, activeFilter = null) {
    const isActive = Boolean(activeFilter && activeFilter.key === filter.key);
    return `<button class="admin-overview-card admin-overview-card--interactive${isActive ? ' is-active' : ''}" type="button" data-audit-filter-key="${escape(filter.key)}" aria-pressed="${isActive ? 'true' : 'false'}">
      <div class="admin-overview-label">${escape(filter.label)}</div>
      <div class="admin-overview-value">${escape(auditSummary[filter.countKey] || 0)}</div>
      <div class="admin-overview-foot">${escape(isActive ? 'Filtering the recent activity table below.' : filter.foot)}</div>
    </button>`;
  }

  function renderAuditRows(auditEntries = []) {
    if (auditEntries.length) {
      return auditEntries.map(entry => `<tr><td>${new Date(entry.ts).toLocaleString()}</td><td>${escape(entry.actorUsername || 'system')}</td><td>${escape(entry.actorRole || 'system')}</td><td>${escape(entry.eventType || 'event')}</td><td>${escape(entry.target || '—')}</td><td>${escape(entry.status || 'success')}</td><td>${formatAuditDetails(entry.details) || '—'}</td></tr>`).join('');
    }
    const activeFilter = getActiveFilter();
    return `<tr><td colspan="7"><div class="empty-state"><strong>${escape(activeFilter?.emptyTitle || 'No recent activity loaded yet.')}</strong><div style="margin-top:8px">${escape(activeFilter ? 'Clear the filter or refresh activity to inspect a wider audit window.' : 'Use Refresh Activity after the next sign-in, password reset, account change, or settings update to confirm the audit trail is moving.')}</div></div></td></tr>`;
  }

  function renderSection({ auditCache }) {
    const auditSummary = auditCache.summary || {};
    const loadedEntries = Array.isArray(auditCache.entries) ? auditCache.entries : [];
    const activeFilter = getActiveFilter();
    const filteredEntries = activeFilter ? loadedEntries.filter(entry => activeFilter.matches(entry)) : loadedEntries;
    const auditEntries = filteredEntries.slice(0, 25);
    const runtimeEntries = Array.isArray(AppState.clientRuntimeErrors) ? AppState.clientRuntimeErrors.slice(0, 5) : [];
    return renderSettingsSection({
      title: 'Activity Log',
      scope: 'admin-settings',
      description: 'Recent platform activity for sign-in events, user changes, and shared settings updates.',
      meta: activeFilter
        ? `${filteredEntries.length} matching loaded events · ${auditSummary.total || loadedEntries.length || 0} recent events`
        : (auditSummary.total ? `${auditSummary.total} recent events` : 'Recent activity only'),
      body: `<div class="admin-overview-grid" id="admin-audit-summary-grid">
        ${AUDIT_FILTERS.map(filter => renderSummaryCard(filter, auditSummary, activeFilter)).join('')}
      </div>
      <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
        <button class="btn btn--secondary" id="btn-refresh-audit-log" type="button">${auditCache.loading ? 'Refreshing…' : 'Refresh Activity'}</button>
        <span class="form-help" id="audit-log-status">${auditCache.error || `Shows up to ${auditSummary.retainedCapacity || 200} recent events. Older activity rolls off automatically.`}</span>
      </div>
      ${activeFilter ? `<div class="audit-log-filter-banner" id="audit-log-active-filter">
        <div>
          <strong>${escape(activeFilter.label)}</strong>
          <div class="form-help">Showing up to 25 matching events from the currently loaded audit window.</div>
        </div>
        <button class="btn btn--ghost btn--sm" id="btn-clear-audit-filter" type="button">Clear Filter</button>
      </div>` : ''}
      ${UI.adminTableCard({
        title: 'Runtime health',
        description: 'Recent browser-side errors captured in this admin session only.',
        table: runtimeEntries.length ? `<table class="data-table">
          <thead><tr><th>Time</th><th>Kind</th><th>Message</th><th>Route</th><th>Source</th></tr></thead>
          <tbody>${runtimeEntries.map(entry => `<tr><td>${new Date(entry.ts).toLocaleString()}</td><td>${entry.kind}</td><td>${entry.message}</td><td>${entry.route || '—'}</td><td>${entry.source || '—'}</td></tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state">No client-side runtime errors have been captured in this admin session.</div>'
      })}
      ${UI.adminTableCard({
        title: 'Recent activity',
        description: activeFilter
          ? `Filtered to ${activeFilter.label.toLowerCase()} in the current audit window.`
          : 'Use this view to confirm sign-ins, user changes, and shared-setting updates.',
        table: `<table class="data-table" id="admin-audit-activity-table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Activity</th><th>Target</th><th>Outcome</th><th>Details</th></tr></thead>
          <tbody>${renderAuditRows(auditEntries)}</tbody>
        </table>`
      })}`
    });
  }

  function bind({ rerenderCurrentAdminSection }) {
    document.getElementById('btn-refresh-audit-log')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-refresh-audit-log');
      const status = document.getElementById('audit-log-status');
      const originalText = btn?.textContent || 'Refresh Activity';
      const originalStatus = status?.textContent || '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Refreshing…';
      }
      if (status) status.textContent = 'Refreshing recent activity…';
      try {
        await loadAuditLog();
        rerenderCurrentAdminSection();
      } catch (error) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
        if (status) status.textContent = originalStatus;
        UI.toast('Audit log could not be refreshed right now.', 'warning');
      }
    });
    document.querySelectorAll('[data-audit-filter-key]').forEach(button => {
      button.addEventListener('click', () => {
        const nextKey = String(button.getAttribute('data-audit-filter-key') || '').trim();
        activeFilterKey = activeFilterKey === nextKey ? '' : nextKey;
        rerenderCurrentAdminSection();
      });
    });
    document.getElementById('btn-clear-audit-filter')?.addEventListener('click', () => {
      activeFilterKey = '';
      rerenderCurrentAdminSection();
    });
    if (!AppState.auditLogCache.loaded && !AppState.auditLogCache.loading) {
      loadAuditLog().then(() => {
        rerenderCurrentAdminSection();
      }).catch(() => {});
    }
  }

  return { renderSection, bind };
})();
