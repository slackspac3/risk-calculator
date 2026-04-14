const AdminOrgSetupSection = (() => {
  let latestContext = null;

  function configure(context) {
    latestContext = context;
  }

  function renderSections({ companyEntities, departmentEntities, companyStructure, entityObligations = [] }) {
    const treeSection = renderSettingsSection({
      title: 'Organisation Tree',
      scope: 'admin-settings',
      description: "Use this as the main structure-editing workspace. Add businesses and departments here, then manage each node's retained context and obligations from the same tree.",
      meta: `${companyEntities.length} businesses · ${departmentEntities.length} departments · ${entityObligations.length} obligations`,
      open: true,
      body: `<div class="card" style="padding:var(--sp-5);background:var(--bg-elevated)">
        <div class="admin-workbench-strip admin-workbench-strip--compact">
          <div>
            <div class="admin-workbench-strip__label">Structure editing</div>
            <strong>Build the tree first, then edit retained context and obligations from the node you are working on.</strong>
            <span>Keep the organisation structure current here. Deeper context guidance, saved layer review, and obligation flow-down review are available below when needed.</span>
          </div>
        </div>
        <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
          <button class="btn btn--secondary" id="btn-add-org-entity">Add Entity</button>
          <button class="btn btn--secondary" id="btn-add-org-function">Add Function / Department</button>
          <span class="form-help">Context is now managed directly inside the tree.</span>
        </div>
        <div id="admin-company-structure-summary" class="mt-4">${renderCompanyStructureSummary(companyStructure)}</div>
        <details class="settings-inline-disclosure mt-4">
          <summary>Structure guidance and saved context layers</summary>
          <div class="dashboard-disclosure-copy">Open this only when you need a quick reminder of the operating pattern or want to review which saved context layers already exist.</div>
          <div class="dashboard-disclosure-body">
            <div class="context-grid">
              <div class="context-chip-panel">
                <div class="context-panel-title">1. Build the organisation tree</div>
                <p class="context-panel-copy">Add holdings, subsidiaries, portfolio companies, partners, and departments in one place.</p>
              </div>
              <div class="context-chip-panel">
                <div class="context-panel-title">2. Manage context from each node</div>
                <p class="context-panel-copy">Use the tree actions to edit retained business or department context directly on the entity you are working on.</p>
              </div>
              <div class="context-chip-panel">
                <div class="context-panel-title">3. Assign obligations where they originate</div>
                <p class="context-panel-copy">Direct obligations stay attached to the source entity, with selective full or partial flow-down to child entities and functions.</p>
              </div>
            </div>
            <div id="admin-layer-summary-list" class="mt-4"></div>
            <div id="admin-obligation-summary-list" class="mt-4"></div>
          </div>
        </details>
      </div>`
    });
    return treeSection;
  }

  async function _persistAdminTreeState() {
    const { companyStructure, entityContextLayers, entityObligations } = latestContext;
    return saveAdminSettings({
      ...getAdminSettings(),
      companyStructure,
      entityContextLayers,
      entityObligations
    });
  }

  function _renderEntityLayerSummary() {
    const { layerSummaryEl, entityContextLayers, companyStructure } = latestContext;
    if (!layerSummaryEl) return;
    if (!entityContextLayers.length) {
      layerSummaryEl.innerHTML = `<div class="empty-state">No business or function context layers have been saved yet.</div>`;
      return;
    }
    const idToNode = new Map(companyStructure.map(node => [node.id, node]));
    layerSummaryEl.innerHTML = entityContextLayers.map(layer => {
      const node = idToNode.get(layer.entityId);
      const reviewModel = typeof getContextReviewDisplayModel === 'function'
        ? getContextReviewDisplayModel(layer.contextMeta, {
            subject: String(node?.type || '').toLowerCase() === 'department / function' ? 'Function context' : 'Business context'
          })
        : null;
      // Entity context can come from admin-managed free text, so escape it before injecting into the summary panel.
      return `
        <div class="card" style="padding:var(--sp-4);margin-top:12px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge badge--gold">${escapeHtml(String(node?.type || 'Saved layer'))}</span>
            <strong style="color:var(--text-primary)">${escapeHtml(String(node?.name || layer.entityName || 'Saved layer'))}</strong>
            ${layer.geography ? `<span class="form-help" style="margin-top:0">${escapeHtml(String(layer.geography))}</span>` : ''}
            <span class="badge ${layer.visibleToChildUsers === false ? 'badge--warning' : 'badge--neutral'}">${layer.visibleToChildUsers === false ? 'Hidden from child users' : 'Visible to child users'}</span>
            ${reviewModel ? `<span class="badge ${reviewModel.badgeClass}">${escapeHtml(String(reviewModel.badge || 'Review state'))}</span>` : ''}
            <button class="btn btn--ghost btn--sm admin-layer-edit" data-layer-id="${escapeHtml(String(layer.entityId || ''))}" type="button">Edit</button>
            <button class="btn btn--ghost btn--sm admin-layer-delete" data-layer-id="${escapeHtml(String(layer.entityId || ''))}" type="button">Remove</button>
          </div>
          ${layer.contextSummary ? `<div class="form-help" style="margin-top:8px">${escapeHtml(String(layer.contextSummary))}</div>` : ''}
          ${reviewModel?.message ? `<div class="form-help" style="margin-top:8px">${escapeHtml(String(reviewModel.message))}</div>` : ''}
          ${layer.applicableRegulations?.length ? `<div class="citation-chips" style="margin-top:8px">${layer.applicableRegulations.map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
    _bindLayerActionHandlers();
  }

  function _bindLayerActionHandlers() {
    const { layerSummaryEl, companyStructure, entityContextLayers } = latestContext;
    layerSummaryEl?.querySelectorAll('.admin-layer-edit').forEach(button => {
      button.addEventListener('click', () => {
        const target = companyStructure.find(item => item.id === button.dataset.layerId);
        if (!target) return;
        openEntityContextLayerEditor({
          entity: target,
          settings: getAdminSettings(),
          onSave: async (nextLayer, modal) => {
            const existingIndex = entityContextLayers.findIndex(item => item.entityId === nextLayer.entityId);
            const previousLayer = existingIndex > -1 ? { ...entityContextLayers[existingIndex] } : null;
            if (existingIndex > -1) entityContextLayers[existingIndex] = nextLayer;
            else entityContextLayers.push(nextLayer);
            // The editor mutates the local tree immediately, so wait for shared persistence before claiming success.
            const saved = await _persistAdminTreeState();
            if (!saved) {
              if (existingIndex > -1) entityContextLayers[existingIndex] = previousLayer;
              else entityContextLayers.pop();
              return;
            }
            modal.close();
            _renderEntityLayerSummary();
            UI.toast(`Saved context for ${target.name}.`, 'success');
          }
        });
      });
    });
    layerSummaryEl?.querySelectorAll('.admin-layer-delete').forEach(button => {
      button.addEventListener('click', async () => {
        const entityId = button.dataset.layerId;
        const index = entityContextLayers.findIndex(item => item.entityId === entityId);
        if (index < 0) return;
        if (!await UI.confirm('Remove this business or department context layer?')) return;
        const removed = entityContextLayers[index];
        entityContextLayers.splice(index, 1);
        const saved = await _persistAdminTreeState();
        if (!saved) {
          entityContextLayers.splice(index, 0, removed);
          return;
        }
        _renderEntityLayerSummary();
        UI.toast('Context layer removed.', 'success');
      });
    });
  }

  function _renderEntityObligationSummary() {
    const { obligationSummaryEl, entityObligations, companyStructure } = latestContext;
    if (!obligationSummaryEl) return;
    const obligations = Array.isArray(entityObligations) ? entityObligations : [];
    if (!obligations.length) {
      obligationSummaryEl.innerHTML = `<div class="empty-state">No direct obligations have been attached to organisation entities yet.</div>`;
      return;
    }
    const idToNode = new Map(companyStructure.map(node => [node.id, node]));
    const grouped = obligations.reduce((acc, obligation) => {
      const key = String(obligation.sourceEntityId || '');
      if (!key) return acc;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key).push(obligation);
      return acc;
    }, new Map());
    obligationSummaryEl.innerHTML = Array.from(grouped.entries()).map(([entityId, items]) => {
      const node = idToNode.get(entityId);
      const sortedItems = [...items].sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')));
      return `
        <div class="card" style="padding:var(--sp-4);margin-top:12px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge badge--gold">${escapeHtml(String(node?.type || 'Entity obligations'))}</span>
            <strong style="color:var(--text-primary)">${escapeHtml(String(node?.name || entityId || 'Unknown entity'))}</strong>
            <span class="form-help" style="margin-top:0">${sortedItems.length} obligation${sortedItems.length === 1 ? '' : 's'}</span>
            <button class="btn btn--ghost btn--sm admin-obligation-manage" data-entity-id="${escapeHtml(String(entityId || ''))}" type="button">Manage</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
            ${sortedItems.map(item => `
              <div style="padding:var(--sp-3);border-radius:var(--radius-lg);background:var(--bg-canvas);border:1px solid var(--border-subtle)">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <strong style="color:var(--text-primary)">${escapeHtml(String(item.title || 'Untitled obligation'))}</strong>
                  <span class="badge badge--neutral">${escapeHtml(String(item.requirementLevel || 'mandatory'))}</span>
                  <span class="badge badge--neutral">${escapeHtml(String(item.flowDownMode || 'none'))} flow-down</span>
                </div>
                ${item.text ? `<div class="form-help" style="margin-top:6px">${escapeHtml(String(item.text).slice(0, 220))}${String(item.text).length > 220 ? '…' : ''}</div>` : ''}
                ${item.regulationTags?.length ? `<div class="citation-chips" style="margin-top:8px">${item.regulationTags.map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('')}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
    _bindObligationActionHandlers();
  }

  function _openEntityObligationManager(entityId) {
    const { companyStructure, entityObligations } = latestContext;
    const target = companyStructure.find(node => node.id === entityId);
    if (!target) return;
    openEntityObligationManager({
      entity: target,
      settings: {
        ...getAdminSettings(),
        companyStructure,
        entityContextLayers: latestContext.entityContextLayers,
        entityObligations
      },
      onSaveAll: async nextObligations => {
        const previous = entityObligations.map(item => ({ ...item }));
        entityObligations.splice(0, entityObligations.length, ...nextObligations);
        const saved = await _persistAdminTreeState();
        if (!saved) {
          entityObligations.splice(0, entityObligations.length, ...previous);
          return false;
        }
        _renderEntityObligationSummary();
        _refreshStructureSummary();
        return true;
      }
    });
  }

  function _bindObligationActionHandlers() {
    const { obligationSummaryEl } = latestContext;
    obligationSummaryEl?.querySelectorAll('.admin-obligation-manage').forEach(button => {
      button.addEventListener('click', () => _openEntityObligationManager(button.dataset.entityId || ''));
    });
  }

  function _refreshStructureSummary() {
    const { structureSummaryEl, companyStructure } = latestContext;
    if (!structureSummaryEl) return;
    structureSummaryEl.innerHTML = renderCompanyStructureSummary(companyStructure);
    _bindStructureActionHandlers();
  }

  async function _upsertCompanyStructureNode(node, derivedContextResult = null) {
    const { companyStructure, entityContextLayers } = latestContext;
    const index = companyStructure.findIndex(item => item.id === node.id);
    const previousNode = index > -1 ? { ...companyStructure[index] } : null;
    const previousLayers = entityContextLayers.map(layer => ({ ...layer }));
    if (index > -1) companyStructure[index] = node;
    else companyStructure.push(node);
    if (derivedContextResult) {
      const nextLayers = mergeDerivedEntityContextLayer({
        ...buildEntityContextAdminSettings(getAdminSettings()),
        entityContextLayers
      }, node, derivedContextResult);
      entityContextLayers.splice(0, entityContextLayers.length, ...nextLayers);
    }
    const saved = await _persistAdminTreeState();
    if (!saved) {
      if (index > -1) companyStructure[index] = previousNode;
      else companyStructure.pop();
      entityContextLayers.splice(0, entityContextLayers.length, ...previousLayers);
      return false;
    }
    _refreshStructureSummary();
    _renderEntityLayerSummary();
    _renderEntityObligationSummary();
    return true;
  }

  function openEntityEditor(existingNode = null, seed = {}) {
    const { companyStructure, regsInput, profileEl, websiteEl, entityContextLayers } = latestContext;
    const departmentEditorMode = isDepartmentEntityType(existingNode?.type || seed.type || '');
    const editor = openOrgEntityEditor({
      structure: companyStructure,
      existingNode,
      seed,
      onSave: async (node, modal, derivedContextResult) => {
        if (node.contextSections) {
          node.profile = serialiseCompanyContextSections(node.contextSections);
        }
        const saved = await _upsertCompanyStructureNode(node, derivedContextResult);
        if (!saved) return;
        if (node.profile && profileEl) profileEl.value = node.profile;
        if (node.websiteUrl && websiteEl) websiteEl.value = node.websiteUrl;
        modal.close();
        UI.toast(`${node.name} saved to the organisation tree.`, 'success', 5000);
      }
    });
  }

  function _bindStructureActionHandlers() {
    const { structureSummaryEl, companyStructure, entityContextLayers, entityObligations } = latestContext;
    if (!structureSummaryEl) return;
    structureSummaryEl.querySelectorAll('.org-summary-action').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    structureSummaryEl.querySelectorAll('.org-entity-context').forEach(button => {
      button.addEventListener('click', () => {
        const target = companyStructure.find(node => node.id === button.dataset.orgId);
        if (!target) return;
        openEntityContextLayerEditor({
          entity: target,
          settings: getAdminSettings(),
          onSave: async (nextLayer, modal) => {
            const existingIndex = entityContextLayers.findIndex(item => item.entityId === nextLayer.entityId);
            const previousLayer = existingIndex > -1 ? { ...entityContextLayers[existingIndex] } : null;
            if (existingIndex > -1) entityContextLayers[existingIndex] = nextLayer;
            else entityContextLayers.push(nextLayer);
            // The editor mutates the local tree immediately, so wait for shared persistence before claiming success.
            const saved = await _persistAdminTreeState();
            if (!saved) {
              if (existingIndex > -1) entityContextLayers[existingIndex] = previousLayer;
              else entityContextLayers.pop();
              return;
            }
            modal.close();
            _renderEntityLayerSummary();
            UI.toast(`Saved context for ${target.name}.`, 'success');
          }
        });
      });
    });
    structureSummaryEl.querySelectorAll('.org-entity-obligations').forEach(button => {
      button.addEventListener('click', () => {
        _openEntityObligationManager(button.dataset.orgId || '');
      });
    });
    structureSummaryEl.querySelectorAll('.org-entity-add-department').forEach(button => {
      button.addEventListener('click', () => {
        openEntityEditor(null, { type: 'Department / function', parentId: button.dataset.orgId || '' });
      });
    });
    structureSummaryEl.querySelectorAll('.org-entity-edit').forEach(button => {
      button.addEventListener('click', () => {
        const target = companyStructure.find(node => node.id === button.dataset.orgId);
        if (target) openEntityEditor(target);
      });
    });
    structureSummaryEl.querySelectorAll('.org-entity-delete').forEach(button => {
      button.addEventListener('click', async () => {
        const targetId = button.dataset.orgId;
        const target = companyStructure.find(node => node.id === targetId);
        if (!target) return;
        if (!await UI.confirm(`Remove ${target.name} and anything nested beneath it from the organisation tree?`)) return;
        const previousStructure = companyStructure.map(node => ({ ...node }));
        const previousLayers = entityContextLayers.map(layer => ({ ...layer }));
        const previousObligations = entityObligations.map(item => ({ ...item }));
        const removeIds = new Set([targetId]);
        let changed = true;
        while (changed) {
          changed = false;
          companyStructure.forEach(node => {
            if (node.parentId && removeIds.has(node.parentId) && !removeIds.has(node.id)) {
              removeIds.add(node.id);
              changed = true;
            }
          });
        }
        for (let i = companyStructure.length - 1; i >= 0; i -= 1) {
          if (removeIds.has(companyStructure[i].id)) companyStructure.splice(i, 1);
        }
        for (let i = entityContextLayers.length - 1; i >= 0; i -= 1) {
          if (removeIds.has(entityContextLayers[i].entityId)) entityContextLayers.splice(i, 1);
        }
        for (let i = entityObligations.length - 1; i >= 0; i -= 1) {
          if (removeIds.has(entityObligations[i].sourceEntityId)) entityObligations.splice(i, 1);
        }
        const saved = await _persistAdminTreeState();
        if (!saved) {
          companyStructure.splice(0, companyStructure.length, ...previousStructure);
          entityContextLayers.splice(0, entityContextLayers.length, ...previousLayers);
          entityObligations.splice(0, entityObligations.length, ...previousObligations);
          return;
        }
        _refreshStructureSummary();
        _renderEntityLayerSummary();
        _renderEntityObligationSummary();
        UI.toast(`${target.name} removed from the organisation tree.`, 'success');
      });
    });
  }

  function bind(context) {
    configure(context);
    document.getElementById('btn-add-org-entity')?.addEventListener('click', () => openEntityEditor());
    document.getElementById('btn-add-org-function')?.addEventListener('click', () => openEntityEditor(null, { type: 'Department / function' }));
    _bindStructureActionHandlers();
    _renderEntityLayerSummary();
    _renderEntityObligationSummary();
  }

  return {
    configure,
    renderSections,
    bind,
    openEntityEditor
  };
})();
