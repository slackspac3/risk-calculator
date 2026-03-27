'use strict';

const AdminDocumentLibrarySection = (() => {
  function renderRoute() {
    if (!requireAdmin()) return;
    const docList = getDocList();
    const availableTags = Array.from(new Set(docList.flatMap(doc => Array.isArray(doc.tags) ? doc.tags : []))).sort((a, b) => String(a).localeCompare(String(b)));
    setPage(adminLayout('docs', `
      ${UI.adminSectionHeader({
        title: 'Document Library',
        description: 'Maintain the internal references used for AI retrieval, citation chips, and richer scenario grounding.',
        actions: `<button class="btn btn--primary" id="btn-add-doc">Add Document</button>
          <details class="results-actions-disclosure admin-footer-overflow">
            <summary class="btn btn--ghost btn--sm">More</summary>
            <div class="results-actions-disclosure-menu">
              <button class="btn btn--secondary btn--sm" id="btn-reindex">Re-index Library</button>
              <button class="btn btn--secondary btn--sm" id="btn-reset-docs">Reset Defaults</button>
            </div>
          </details>`
      })}
      <div class="admin-workbench-strip admin-workbench-strip--compact mb-6">
        <div>
          <div class="admin-workbench-strip__label">Library workspace</div>
          <strong>Search, filter, and curate the references the platform can retrieve and cite.</strong>
          <span>${docList.length} indexed documents are currently available for grounding, citation, and richer scenario support.</span>
        </div>
        <div class="admin-workbench-strip__meta">
          <span class="badge badge--neutral">${docList.filter(doc => String(doc.lastUpdated || '').startsWith(String(new Date().getFullYear()))).length} updated this year</span>
        </div>
      </div>
      ${UI.adminTableCard({
        title: 'Documents in the library',
        description: 'Keep titles, tags, and update dates current so the AI can choose better supporting references.',
        table: `<div class="admin-table-toolbar admin-table-toolbar--filters">
            <input class="form-input" id="admin-doc-search" type="search" placeholder="Search title, ID, or tag" style="min-width:min(300px,100%);max-width:420px">
            <select class="form-select" id="admin-doc-tag-filter" style="min-width:220px">
              <option value="">All tags</option>
              ${availableTags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}
            </select>
          </div>
          <table class="data-table">
            <thead><tr><th>Document</th><th>Tags</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>${docList.map(doc => `<tr class="admin-doc-row" data-search="${escapeHtml([doc.title, doc.id, ...(doc.tags || [])].join(' ').toLowerCase())}" data-tags="${escapeHtml((doc.tags || []).join('|').toLowerCase())}">
              <td><strong style="color:var(--text-primary);font-size:.875rem">${doc.title}</strong><br><span style="font-size:.68rem;color:var(--text-muted)">${doc.id}</span></td>
              <td>${(doc.tags || []).slice(0, 3).map(t => `<span class="badge badge--primary" style="font-size:.6rem;margin:2px">${t}</span>`).join('')}</td>
              <td style="font-size:.8rem;white-space:nowrap">${doc.lastUpdated || '—'}</td>
              <td>
                <button class="btn btn--ghost btn--sm" data-id="${doc.id}" id="edit-doc-${doc.id}">Edit</button>
                <details class="results-actions-disclosure dashboard-row-overflow" style="display:inline-flex;margin-left:8px">
                  <summary class="btn btn--ghost btn--sm">More</summary>
                  <div class="results-actions-disclosure-menu">
                    <button class="btn btn--secondary btn--sm" data-id="${doc.id}" id="del-doc-${doc.id}">Delete</button>
                  </div>
                </details>
              </td>
            </tr>`).join('')}</tbody>
          </table>`
      })}`));

    document.getElementById('btn-admin-logout').addEventListener('click', () => { performLogout(); });
    document.getElementById('btn-reindex').addEventListener('click', () => { RAGService.init(getDocList(), getBUList()); UI.toast('Index rebuilt.', 'success'); });
    document.getElementById('btn-reset-docs').addEventListener('click', async () => {
      if (await UI.confirm('Reset docs to defaults?')) {
        localStorage.removeItem('rq_doc_override');
        AppState.docList = await loadJSON('./data/docs.json');
        RAGService.init(AppState.docList, getBUList());
        Router.resolve();
        UI.toast('Reset to defaults.', 'success');
      }
    });
    const docSearchEl = document.getElementById('admin-doc-search');
    const docTagFilterEl = document.getElementById('admin-doc-tag-filter');
    const applyDocFilters = () => {
      const query = String(docSearchEl?.value || '').trim().toLowerCase();
      const tag = String(docTagFilterEl?.value || '').trim().toLowerCase();
      document.querySelectorAll('.admin-doc-row').forEach(row => {
        const matchesQuery = !query || String(row.dataset.search || '').includes(query);
        const matchesTag = !tag || String(row.dataset.tags || '').split('|').includes(tag);
        row.hidden = !(matchesQuery && matchesTag);
      });
    };
    docSearchEl?.addEventListener('input', applyDocFilters);
    docTagFilterEl?.addEventListener('change', applyDocFilters);
    document.getElementById('btn-add-doc').addEventListener('click', () => openEditor(null));
    docList.forEach(doc => {
      document.getElementById(`edit-doc-${doc.id}`)?.addEventListener('click', () => openEditor(doc));
      document.getElementById(`del-doc-${doc.id}`)?.addEventListener('click', async () => {
        if (await UI.confirm(`Delete "${doc.title}"?`)) {
          saveDocList(getDocList().filter(d => d.id !== doc.id));
          Router.resolve();
          UI.toast('Deleted.', 'success');
        }
      });
    });
  }

  function openEditor(doc) {
    const isNew = !doc;
    let tiTags;
    const m = UI.modal({
      title: isNew ? 'Add Document' : `Edit: ${doc.title}`,
      body: `<form id="doc-form">
        <div class="form-group"><label class="form-label">ID</label><input class="form-input" id="doc-id" value="${doc?.id || ''}" ${!isNew ? 'readonly' : ''}></div>
        <div class="form-group mt-3"><label class="form-label">Title</label><input class="form-input" id="doc-title" value="${doc?.title || ''}"></div>
        <div class="form-group mt-3"><label class="form-label">URL</label><input class="form-input" id="doc-url" type="url" value="${doc?.url || '#/admin/docs'}" placeholder="https://…"></div>
        <div class="form-group mt-3"><label class="form-label">Last Updated</label><input class="form-input" id="doc-updated" type="date" value="${doc?.lastUpdated || ''}"></div>
        <div class="form-group mt-3"><label class="form-label">Tags</label><div class="tag-input-wrap" id="ti-doc-tags"></div></div>
        <div class="form-group mt-3"><label class="form-label">Content Excerpt</label><textarea class="form-textarea" id="doc-excerpt" rows="4">${doc?.contentExcerpt || ''}</textarea></div>
      </form>`,
      footer: `<button class="btn btn--ghost" id="doc-cancel">Cancel</button><button class="btn btn--primary" id="doc-save">Save</button>`
    });
    requestAnimationFrame(() => { tiTags = UI.tagInput('ti-doc-tags', doc?.tags || []); });
    document.getElementById('doc-cancel').addEventListener('click', () => m.close());
    document.getElementById('doc-save').addEventListener('click', () => {
      const id = document.getElementById('doc-id').value.trim();
      const title = document.getElementById('doc-title').value.trim();
      if (!id || !title) { UI.toast('ID and Title required.', 'warning'); return; }
      const updated = {
        id,
        title,
        url: document.getElementById('doc-url').value || '#',
        tags: tiTags.getTags(),
        lastUpdated: document.getElementById('doc-updated').value,
        contentExcerpt: document.getElementById('doc-excerpt').value
      };
      const list = getDocList();
      const idx = list.findIndex(d => d.id === id);
      if (idx > -1) list[idx] = updated; else list.push(updated);
      saveDocList(list);
      m.close();
      Router.resolve();
      UI.toast(`Doc "${title}" ${isNew ? 'added' : 'updated'}.`, 'success');
    });
  }

  return { renderRoute, openEditor };
})();
