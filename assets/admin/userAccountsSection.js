const AdminUserAccountsSection = (() => {
  let latestContext = null;

  function renderSection({ settings, companyEntities, companyStructure, managedAccounts }) {
    return renderSettingsSection({
      title: 'User Accounts',
      scope: 'admin-settings',
      description: 'Create users, assign access, and keep role changes aligned with the rest of the platform.',
      meta: `${managedAccounts.length} managed accounts`,
      body: `${UI.adminTableCard({
        title: 'Current users',
        description: 'Review assigned role, business unit, and function before applying access changes.',
        table: `<div class="admin-table-toolbar">
          <input class="form-input" id="admin-user-search" type="search" placeholder="Search name, username, role, BU, or function" style="min-width:min(320px,100%);max-width:420px">
        </div>
        <table class="data-table data-table--dense data-table--workbench">
          <thead>
            <tr>
              <th>User</th>
              <th>Access role</th>
              <th>Scope</th>
              <th>Issued password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${managedAccounts.length ? managedAccounts.map(account => {
              const departmentsForAccount = getDepartmentEntities(companyStructure, account.businessUnitEntityId || '');
              return `
              <tr class="managed-account-row" data-username="${account.username}">
                <td>
                  <div class="table-primary-cell">
                    <strong>${account.displayName}</strong>
                    <span><code>${account.username}</code></span>
                  </div>
                </td>
                <td>
                  <select class="form-select form-select--sm account-role-select" data-username="${account.username}">
                    <option value="user" ${account.role === 'user' ? 'selected' : ''}>Standard user</option>
                    <option value="bu_admin" ${account.role === 'bu_admin' ? 'selected' : ''}>BU admin</option>
                    <option value="function_admin" ${account.role === 'function_admin' ? 'selected' : ''}>Function admin</option>
                  </select>
                </td>
                <td>
                  <div class="table-scope-stack">
                    <select class="form-select form-select--sm account-bu-select" data-username="${account.username}">
                      <option value="">Choose BU</option>
                      ${companyEntities.map(entity => `<option value="${entity.id}" ${entity.id === (account.businessUnitEntityId || '') ? 'selected' : ''}>${entity.name}</option>`).join('')}
                    </select>
                    <select class="form-select form-select--sm account-department-select" data-username="${account.username}">
                      <option value="">${account.role === 'bu_admin' ? 'Optional for BU admin' : 'Choose function'}</option>
                      ${departmentsForAccount.map(entity => `<option value="${entity.id}" ${entity.id === (account.departmentEntityId || '') ? 'selected' : ''}>${entity.name}</option>`).join('')}
                    </select>
                  </div>
                </td>
                <td><code>${AppState.adminVisiblePasswords[account.username] || 'Reset to issue'}</code></td>
                <td class="table-actions-cell">
                  <div class="table-actions-row">
                    <button class="btn btn--secondary btn--sm btn-apply-user-access" data-username="${account.username}" data-display-name="${account.displayName}" type="button">Apply Access</button>
                    <details class="results-actions-disclosure dashboard-row-overflow" style="display:inline-flex">
                      <summary class="btn btn--ghost btn--sm">More</summary>
                      <div class="results-actions-disclosure-menu">
                        <button class="btn btn--secondary btn--sm btn-reset-user-password" data-username="${account.username}" data-display-name="${account.displayName}" type="button">Reset Password</button>
                        <button class="btn btn--secondary btn--sm btn-reset-user-account" data-username="${account.username}" data-display-name="${account.displayName}" type="button">Reset User</button>
                        <button class="btn btn--secondary btn--sm btn-delete-user-account" data-username="${account.username}" data-display-name="${account.displayName}" type="button">Delete User</button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>No managed users yet.</strong><div style="margin-top:8px">Create the first pilot user below, then return here to assign their role, business-unit scope, and function ownership.</div></div></td></tr>'}
          </tbody>
        </table>`
      })}
      <details class="dashboard-disclosure card mt-4">
        <summary>Create a user <span class="badge badge--neutral">Optional</span></summary>
        <div class="dashboard-disclosure-copy">Create a new account only when you need to add someone to the platform.</div>
        <div class="dashboard-disclosure-body">
          <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)">
            <div class="grid-4 mt-1">
              <div class="form-group">
                <label class="form-label" for="admin-new-user-name">Display name</label>
                <input class="form-input" id="admin-new-user-name" placeholder="e.g. Sara Finance">
              </div>
              <div class="form-group">
                <label class="form-label" for="admin-new-user-role">Role</label>
                <select class="form-select" id="admin-new-user-role">
                  <option value="user">Standard user</option>
                  <option value="bu_admin">BU admin</option>
                  <option value="function_admin">Function admin</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="admin-new-user-bu">Business unit</label>
                <select class="form-select" id="admin-new-user-bu">
                  <option value="">Choose BU</option>
                  ${companyEntities.map(entity => `<option value="${entity.id}">${entity.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="admin-new-user-department">Function / department</label>
                <select class="form-select" id="admin-new-user-department"><option value="">Choose function</option></select>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
              <button class="btn btn--secondary" id="btn-admin-add-user">Add User</button>
              <span class="form-help" id="admin-new-user-result">${AppState.adminNewUserStatus || 'A username and password are generated automatically. New or reset passwords are shown only in this admin session.'}</span>
            </div>
          </div>
        </div>
      </details>
      <details class="dashboard-disclosure card mt-4">
        <summary>Admin account tools <span class="badge badge--neutral">Advanced</span></summary>
        <div class="dashboard-disclosure-copy">Normal signed-in admin actions use your current session. The secret below is a current-tab fallback for protected account actions only.</div>
        <div class="dashboard-disclosure-body">
          <div class="card" style="padding:var(--sp-4);background:var(--bg-canvas)">
            <div class="grid-2 mt-1">
              <div class="form-group">
                <label class="form-label" for="admin-api-secret">Admin action secret</label>
                <input class="form-input" id="admin-api-secret" type="password" placeholder="Paste the admin action secret for this tab if needed" value="${AuthService.getAdminApiSecret() || ''}">
                <span class="form-help">Saved only for this tab. Signed-in admin requests use the session token first and fall back to the secret only when needed.</span>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-3" style="flex-wrap:wrap">
              <button class="btn btn--secondary" id="btn-save-admin-secret" type="button">Save Admin Secret</button>
              <button class="btn btn--ghost" id="btn-clear-admin-secret" type="button">Clear Admin Secret</button>
              <button class="btn btn--secondary" id="btn-test-users-store" type="button">Check Account Sync</button>
              <span class="form-help" id="admin-users-store-status">Checks whether account changes are available for this admin session.</span>
            </div>
          </div>
        </div>
      </details>
      <div class="form-help mt-3">Reset clears this user's saved working state and returns them to a first-time setup experience.</div>`
    });
  }
  function _renderAdminNewUserDepartments(companyStructure) {
    const buId = document.getElementById('admin-new-user-bu')?.value || '';
    const role = document.getElementById('admin-new-user-role')?.value || 'user';
    const departmentEl = document.getElementById('admin-new-user-department');
    if (!departmentEl) return;
    const departments = getDepartmentEntities(companyStructure, buId);
    const placeholder = role === 'bu_admin' ? 'Optional for BU admin' : 'Choose function';
    departmentEl.innerHTML = `<option value="">${departments.length || role === 'bu_admin' ? placeholder : 'No functions configured'}</option>${departments.map(entity => `<option value="${entity.id}">${entity.name}</option>`).join('')}`;
    departmentEl.disabled = !buId || (!departments.length && role !== 'bu_admin');
  }


  function _selectedLabel(selectEl) {
    return selectEl?.options?.[selectEl.selectedIndex]?.textContent?.trim() || '';
  }

  function _describeAccessChange(currentAccount, nextAssignment, row) {
    const roleLabel = nextAssignment.role === 'bu_admin' ? 'BU admin' : nextAssignment.role === 'function_admin' ? 'Function admin' : 'Standard user';
    const buLabel = _selectedLabel(row?.querySelector('.account-bu-select')) || 'No business unit selected';
    const departmentLabel = nextAssignment.role === 'bu_admin'
      ? 'No fixed function ownership'
      : (_selectedLabel(row?.querySelector('.account-department-select')) || 'No function selected');
    const changed = [];
    if ((currentAccount.role || 'user') !== nextAssignment.role) changed.push(`Role: ${currentAccount.role || 'user'} → ${nextAssignment.role}`);
    if ((currentAccount.businessUnitEntityId || '') !== (nextAssignment.businessUnitEntityId || '')) changed.push('Business unit scope will change.');
    if (((currentAccount.role === 'bu_admin' ? '' : currentAccount.departmentEntityId) || '') !== ((nextAssignment.role === 'bu_admin' ? '' : nextAssignment.departmentEntityId) || '')) changed.push('Function ownership will change.');
    return { roleLabel, buLabel, departmentLabel, changed };
  }

  function _renderManagedAccountDepartmentOptions(row, companyStructure) {
    if (!row) return;
    const role = row.querySelector('.account-role-select')?.value || 'user';
    const buId = row.querySelector('.account-bu-select')?.value || '';
    const departmentEl = row.querySelector('.account-department-select');
    if (!departmentEl) return;
    const departments = getDepartmentEntities(companyStructure, buId);
    const currentValue = departmentEl.value || departmentEl.dataset.currentValue || '';
    const placeholder = role === 'bu_admin' ? 'Optional for BU admin' : 'Choose function';
    departmentEl.innerHTML = `<option value="">${departments.length || role === 'bu_admin' ? placeholder : 'No functions configured'}</option>${departments.map(entity => `<option value="${entity.id}" ${entity.id === currentValue ? 'selected' : ''}>${entity.name}</option>`).join('')}`;
    departmentEl.disabled = !buId || (!departments.length && role !== 'bu_admin');
    if (!departments.some(entity => entity.id === currentValue)) departmentEl.value = '';
  }

  async function _applyManagedAccountAccess(button) {
    const username = button.dataset.username || '';
    const displayName = button.dataset.displayName || username;
    const row = button.closest('.managed-account-row');
    if (!row) return false;
    const role = row.querySelector('.account-role-select')?.value || 'user';
    const businessUnitEntityId = row.querySelector('.account-bu-select')?.value || '';
    const departmentEntityId = row.querySelector('.account-department-select')?.value || '';
    if (!businessUnitEntityId) {
      UI.toast(role === 'bu_admin' ? 'Choose the business unit this BU admin will manage.' : role === 'function_admin' ? 'Choose the business unit this function admin sits within.' : 'Choose a business unit for this user.', 'warning');
      return false;
    }
    if ((role === 'user' || role === 'function_admin') && !departmentEntityId) {
      UI.toast(role === 'function_admin' ? 'Choose the function or department this function admin will own.' : 'Choose a function or department for this standard user.', 'warning');
      return false;
    }
    button.disabled = true;
    button.textContent = 'Applying…';
    const currentSettings = getAdminSettings();
    const currentAccount = getManagedAccountsForAdmin(currentSettings).find(account => account.username === username) || { username, role: 'user', businessUnitEntityId: '', departmentEntityId: '' };
    const nextAssignment = { role, businessUnitEntityId, departmentEntityId: role === 'bu_admin' ? '' : departmentEntityId };
    const nextSettings = applyManagedAccountAssignmentToSettings(currentAccount, nextAssignment, currentSettings);
    const changeSummary = _describeAccessChange(currentAccount, nextAssignment, row);
    if (changeSummary.changed.length) {
      const confirmed = await UI.confirm(`Apply access for ${displayName}?

Role: ${changeSummary.roleLabel}
Business unit: ${changeSummary.buLabel}
Function: ${changeSummary.departmentLabel}

${changeSummary.changed.join(' ')}`);
      if (!confirmed) return false;
    }
    try {
      await AuthService.adminUpdateManagedAccount(username, nextAssignment);
      const saved = await saveAdminSettings(nextSettings);
      if (!saved) {
        AppState.adminNewUserStatus = 'Access changed on the account service, but shared platform settings could not be saved. Reload the latest settings and try again.';
        const resultEl = document.getElementById('admin-new-user-result');
        if (resultEl) resultEl.textContent = AppState.adminNewUserStatus;
        UI.toast('Shared access settings were not saved.', 'warning');
        button.disabled = false;
        button.textContent = 'Apply Access';
        return false;
      }
    } catch (error) {
      AppState.adminNewUserStatus = 'User access could not be updated. Check the assigned role and scope, then try again.';
      const resultEl = document.getElementById('admin-new-user-result');
      if (resultEl) resultEl.textContent = AppState.adminNewUserStatus;
      UI.toast('User update failed.', 'danger');
      button.disabled = false;
      button.textContent = 'Apply Access';
      return false;
    }
    row.dataset.dirty = 'false';
    button.textContent = 'Applied';
    AppState.adminNewUserStatus = `Applied ${role === 'bu_admin' ? 'BU admin' : role === 'function_admin' ? 'function admin' : 'standard user'} access for ${displayName}.`;
    const resultEl = document.getElementById('admin-new-user-result');
    if (resultEl) resultEl.textContent = AppState.adminNewUserStatus;
    return true;
  }

  async function applyPendingChanges() {
    const rows = Array.from(document.querySelectorAll('.managed-account-row')).filter(row => row.dataset.dirty === 'true');
    for (const row of rows) {
      const button = row.querySelector('.btn-apply-user-access');
      if (!button) continue;
      const ok = await _applyManagedAccountAccess(button);
      if (!ok) return false;
    }
    return true;
  }

  function bind(context) {
    latestContext = context;
    const { companyStructure, rerenderCurrentAdminSection } = context;
    document.getElementById('admin-new-user-bu')?.addEventListener('change', () => _renderAdminNewUserDepartments(companyStructure));
    document.getElementById('admin-new-user-role')?.addEventListener('change', () => _renderAdminNewUserDepartments(companyStructure));
    _renderAdminNewUserDepartments(companyStructure);


    document.getElementById('admin-user-search')?.addEventListener('input', event => {
      const query = String(event.target.value || '').trim().toLowerCase();
      document.querySelectorAll('.managed-account-row').forEach(row => {
        const haystack = [
          row.children[0]?.textContent || '',
          row.children[1]?.textContent || '',
          row.querySelector('.account-role-select option:checked')?.textContent || '',
          row.querySelector('.account-bu-select option:checked')?.textContent || '',
          row.querySelector('.account-department-select option:checked')?.textContent || ''
        ].join(' ').toLowerCase();
        row.style.display = !query || haystack.includes(query) ? '' : 'none';
      });
    });

    document.querySelectorAll('.managed-account-row').forEach(row => {
      const markDirty = () => {
        row.dataset.dirty = 'true';
        const button = row.querySelector('.btn-apply-user-access');
        if (button) {
          button.disabled = false;
          button.textContent = 'Apply Access';
        }
      };
      row.querySelector('.account-bu-select')?.addEventListener('change', () => { _renderManagedAccountDepartmentOptions(row, companyStructure); markDirty(); });
      row.querySelector('.account-role-select')?.addEventListener('change', () => { _renderManagedAccountDepartmentOptions(row, companyStructure); markDirty(); });
      row.querySelector('.account-department-select')?.addEventListener('change', markDirty);
      row.dataset.dirty = 'false';
      _renderManagedAccountDepartmentOptions(row, companyStructure);
    });

    document.querySelectorAll('.btn-reset-user-account').forEach(button => {
      button.addEventListener('click', async () => {
        const username = button.dataset.username || '';
        const displayName = button.dataset.displayName || username;
        if (!await UI.confirm(`Reset ${displayName} to a first-time user state? This will clear their stored context, memory, assessments, and session settings in this browser.`)) return;
        clearUserPersistentState(username);
        UI.toast(`${displayName} was reset.`, 'success');
        rerenderCurrentAdminSection();
      });
    });

    document.querySelectorAll('.btn-reset-user-password').forEach(button => {
      button.addEventListener('click', async () => {
        const username = button.dataset.username || '';
        const displayName = button.dataset.displayName || username;
        if (!await UI.confirm(`Issue a new password for ${displayName}? The old password will stop working.`)) return;
        try {
          const result = await AuthService.resetManagedPassword(username);
          AppState.adminVisiblePasswords[username] = result.password || '';
          AppState.adminNewUserStatus = `Password reset for ${displayName}: username ${username} / password ${result.password}`;
          UI.toast(`Password reset for ${username}.`, 'success');
          rerenderCurrentAdminSection();
        } catch (error) {
          AppState.adminNewUserStatus = 'Password could not be reset right now. Try again in a moment.';
          const resultEl = document.getElementById('admin-new-user-result');
          if (resultEl) resultEl.textContent = AppState.adminNewUserStatus;
          UI.toast('Password reset failed.', 'danger');
        }
      });
    });

    document.querySelectorAll('.btn-apply-user-access').forEach(button => {
      button.addEventListener('click', async () => {
        const ok = await _applyManagedAccountAccess(button);
        if (!ok) return;
        UI.toast(`Updated access for ${button.dataset.displayName || button.dataset.username || 'user'}.`, 'success');
        rerenderCurrentAdminSection();
      });
    });

    document.querySelectorAll('.btn-delete-user-account').forEach(button => {
      button.addEventListener('click', async () => {
        const username = button.dataset.username || '';
        const displayName = button.dataset.displayName || username;
        if (!await UI.confirm(`Delete ${displayName}? This removes their account, saved state, and any BU or function ownership assigned to them.`)) return;
        try {
          const currentSettings = getAdminSettings();
          const clearedSettings = {
            ...currentSettings,
            companyStructure: (Array.isArray(currentSettings.companyStructure) ? currentSettings.companyStructure : []).map(node => node.ownerUsername === username ? { ...node, ownerUsername: '' } : node)
          };
          await AuthService.deleteManagedAccount(username);
          const saved = await saveAdminSettings(clearedSettings);
          if (!saved) {
            UI.toast('The account was removed, but shared ownership settings could not be saved.', 'warning');
            return;
          }
          clearUserPersistentState(username);
          UI.toast(`${displayName} deleted.`, 'success');
          rerenderCurrentAdminSection();
        } catch (error) {
          UI.toast('User could not be deleted right now.', 'danger');
        }
      });
    });

    document.getElementById('btn-save-admin-secret')?.addEventListener('click', async () => {
      const secret = document.getElementById('admin-api-secret')?.value || '';
      AuthService.setAdminApiSecret(secret);
      if (!secret) {
        UI.toast('Admin action secret cleared for this tab.', 'success');
        return;
      }
      try {
        await syncSharedAdminSettings(getAdminSettings());
        UI.toast('Admin action secret saved for this tab and current admin settings synced.', 'success');
      } catch (error) {
        UI.toast('Admin action secret was saved for this tab, but the latest platform settings could not be refreshed right now.', 'warning');
      }
    });

    document.getElementById('btn-clear-admin-secret')?.addEventListener('click', () => {
      AuthService.setAdminApiSecret('');
      const input = document.getElementById('admin-api-secret');
      if (input) input.value = '';
      UI.toast('Admin action secret cleared for this tab.', 'success');
    });

    document.getElementById('btn-test-users-store')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-test-users-store');
      const statusEl = document.getElementById('admin-users-store-status');
      if (!btn || !statusEl) return;
      btn.disabled = true;
      btn.textContent = 'Checking…';
      statusEl.textContent = 'Checking whether account updates are available for this admin session…';
      const result = await AuthService.testUsersStoreHealth();
      if (result.ok) {
        if (result.writable) {
          statusEl.textContent = 'Account changes are available and should appear across the platform.';
          UI.toast('Account sync is available.', 'success');
        } else {
          statusEl.textContent = 'Account information is reachable, but changes cannot be saved right now.';
          UI.toast('Account sync is reachable but not writable.', 'warning');
        }
      } else {
        statusEl.textContent = 'The platform could not confirm account sync right now. Try again in a moment.';
        UI.toast('Account sync check failed.', 'warning');
      }
      btn.disabled = false;
      btn.textContent = 'Check Account Sync';
    });

    document.getElementById('btn-admin-add-user')?.addEventListener('click', async () => {
      const button = document.getElementById('btn-admin-add-user');
      const resultEl = document.getElementById('admin-new-user-result');
      const displayName = document.getElementById('admin-new-user-name').value.trim();
      const role = document.getElementById('admin-new-user-role').value.trim() || 'user';
      const businessUnitEntityId = document.getElementById('admin-new-user-bu').value.trim();
      const departmentEntityId = document.getElementById('admin-new-user-department').value.trim();
      if (!displayName) {
        AppState.adminNewUserStatus = 'Enter a display name for the new user.';
        resultEl.textContent = AppState.adminNewUserStatus;
        UI.toast(AppState.adminNewUserStatus, 'warning');
        return;
      }
      if (!businessUnitEntityId) {
        AppState.adminNewUserStatus = role === 'bu_admin' ? 'Choose the business unit this BU admin will manage.' : role === 'function_admin' ? 'Choose the business unit this function admin sits within.' : 'Choose a business unit before creating the user.';
        resultEl.textContent = AppState.adminNewUserStatus;
        UI.toast(AppState.adminNewUserStatus, 'warning');
        return;
      }
      if ((role === 'user' || role === 'function_admin') && !departmentEntityId) {
        AppState.adminNewUserStatus = role === 'function_admin' ? 'Choose the function or department this function admin will own.' : 'Choose a function or department before creating the user.';
        resultEl.textContent = AppState.adminNewUserStatus;
        UI.toast(AppState.adminNewUserStatus, 'warning');
        return;
      }
      const roleLabel = role === 'bu_admin' ? 'BU admin' : role === 'function_admin' ? 'Function admin' : 'Standard user';
      const buLabel = document.getElementById('admin-new-user-bu')?.selectedOptions?.[0]?.textContent?.trim() || 'No business unit selected';
      const departmentLabel = role === 'bu_admin' ? 'No fixed function ownership' : (document.getElementById('admin-new-user-department')?.selectedOptions?.[0]?.textContent?.trim() || 'No function selected');
      const confirmed = await UI.confirm(`Create ${displayName}?

Role: ${roleLabel}
Business unit: ${buLabel}
Function: ${departmentLabel}`);
      if (!confirmed) return;
      button.disabled = true;
      button.textContent = 'Creating…';
      resultEl.textContent = 'Creating shared user account…';
      try {
        const account = await AuthService.createManagedAccount({ displayName, role, businessUnitEntityId, departmentEntityId: role === 'bu_admin' ? '' : departmentEntityId });
        const nextSettings = applyManagedAccountAssignmentToSettings(account, { role: account.role, businessUnitEntityId: account.businessUnitEntityId, departmentEntityId: account.role === 'bu_admin' ? '' : account.departmentEntityId }, getAdminSettings());
        const saved = await saveAdminSettings(nextSettings);
        if (!saved) {
          AppState.adminNewUserStatus = 'The account was created, but shared ownership settings could not be saved. Reload the latest settings and reapply the assignment.';
          resultEl.textContent = AppState.adminNewUserStatus;
          UI.toast('Shared access settings were not saved.', 'warning');
          button.disabled = false;
          button.textContent = 'Add User';
          return;
        }
        AppState.adminVisiblePasswords[account.username] = account.password || '';
        AppState.adminNewUserStatus = `Created ${account.displayName}: username ${account.username} / password ${account.password}`;
        UI.toast(`Created ${account.username}.`, 'success');
        rerenderCurrentAdminSection();
      } catch (error) {
        AppState.adminNewUserStatus = 'User could not be created right now. Check the assigned role and scope, then try again.';
        resultEl.textContent = AppState.adminNewUserStatus;
        UI.toast('User creation failed.', 'danger');
        button.disabled = false;
        button.textContent = 'Add User';
      }
    });
  }

  return {
    renderSection,
    bind,
    applyPendingChanges
  };
})();
