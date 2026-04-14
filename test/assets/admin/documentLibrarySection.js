'use strict';

const AdminDocumentLibrarySection = (() => {
  const LENS_TAG_ORDER = [
    'strategic',
    'operational',
    'cyber',
    'ai-model-risk',
    'data-governance',
    'third-party',
    'regulatory',
    'financial',
    'fraud-integrity',
    'esg',
    'compliance',
    'legal-contract',
    'geopolitical',
    'supply-chain',
    'procurement',
    'business-continuity',
    'physical-security',
    'ot-resilience',
    'people-workforce',
    'investment-jv',
    'transformation-delivery',
    'hse'
  ];

  function sortDocumentTags(tags = []) {
    const values = Array.from(new Set((Array.isArray(tags) ? tags : []).map(tag => String(tag || '').trim()).filter(Boolean)));
    return values.sort((a, b) => {
      const ai = LENS_TAG_ORDER.indexOf(String(a).toLowerCase());
      const bi = LENS_TAG_ORDER.indexOf(String(b).toLowerCase());
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        if (ai !== bi) return ai - bi;
      }
      return String(a).localeCompare(String(b));
    });
  }

  function renderRoute() {
    if (!requireAdmin()) return;
    const docList = getDocList();
    const snapshotLoadedAt = Date.now();
    const settingsUpdatedAt = Number(getAdminSettings()?._meta?.updatedAt || 0);
    if (typeof RAGService !== 'undefined' && typeof RAGService.init === 'function') {
      const storedDocs = typeof getDocList === 'function' ? getDocList() : (AppState.docList || []);
      RAGService.init(storedDocs, getBUList());
    }
    const availableTags = sortDocumentTags(docList.flatMap(doc => Array.isArray(doc.tags) ? doc.tags : []));
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
      <div class="review-queue-sync-meta review-queue-sync-meta--compact">
        <span>Library view refreshed ${typeof renderLiveTimestampValue === 'function'
          ? renderLiveTimestampValue(snapshotLoadedAt, { tagName: 'strong', mode: 'absolute', includeSeconds: true, fallback: 'Unknown time' })
          : `<strong>${escapeHtml(typeof formatOperationalDateTime === 'function' ? formatOperationalDateTime(snapshotLoadedAt, { includeSeconds: true, fallback: 'Unknown time' }) : 'Unknown time')}</strong>`}</span>
        <span>Data age ${typeof renderLiveTimestampValue === 'function'
          ? renderLiveTimestampValue(snapshotLoadedAt, { tagName: 'strong', mode: 'relative', fallback: 'just now', staleAfterMs: 120000, staleClass: 'live-timestamp--stale' })
          : `<strong>${escapeHtml(typeof formatRelativePilotTime === 'function' ? formatRelativePilotTime(snapshotLoadedAt, 'just now') : 'just now')}</strong>`}</span>
        <span>Latest shared library update ${typeof renderLiveTimestampValue === 'function'
          ? renderLiveTimestampValue(settingsUpdatedAt, { tagName: 'strong', mode: 'relative', fallback: 'not recorded yet', staleAfterMs: 300000, staleClass: 'live-timestamp--stale' })
          : `<strong>${escapeHtml(typeof formatRelativePilotTime === 'function' ? formatRelativePilotTime(settingsUpdatedAt, 'not recorded yet') : 'not recorded yet')}</strong>`}</span>
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
          <table class="data-table data-table--workbench">
            <thead><tr><th>Document</th><th>Tags</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>${docList.map(doc => `<tr class="admin-doc-row" data-search="${escapeHtml([doc.title, doc.id, ...(doc.tags || [])].join(' ').toLowerCase())}" data-tags="${escapeHtml((doc.tags || []).join('|').toLowerCase())}">
              <td><div class="table-primary-cell"><strong style="color:var(--text-primary);font-size:.875rem">${doc.title}</strong><span>${doc.id}</span></div></td>
              <td><div class="table-tag-stack">${sortDocumentTags(doc.tags || []).slice(0, 2).map(t => `<span class="badge badge--primary" style="font-size:.6rem">${t}</span>`).join('')}${(doc.tags || []).length > 2 ? `<span class="table-more-pill">+${(doc.tags || []).length - 2} more</span>` : ''}</div></td>
              <td style="font-size:.8rem;white-space:nowrap">${doc.lastUpdated || '—'}</td>
              <td class="table-actions-cell">
                <div class="table-actions-row">
                  <button class="btn btn--ghost btn--sm" data-id="${doc.id}" id="edit-doc-${doc.id}">Edit</button>
                  <details class="results-actions-disclosure dashboard-row-overflow" style="display:inline-flex">
                    <summary class="btn btn--ghost btn--sm">More</summary>
                    <div class="results-actions-disclosure-menu">
                      <button class="btn btn--secondary btn--sm" data-id="${doc.id}" id="del-doc-${doc.id}">Delete</button>
                    </div>
                  </details>
                </div>
              </td>
            </tr>`).join('')}</tbody>
          </table>`
      })}`));

    document.getElementById('btn-admin-logout')?.addEventListener('click', () => { performLogout(); });
    document.getElementById('btn-reindex')?.addEventListener('click', async () => {
      RAGService.init(getDocList(), getBUList());
      const adminSettings = typeof getAdminSettings === 'function'
        ? getAdminSettings() : {};
    const entityLayers = Array.isArray(adminSettings.entityContextLayers)
      ? adminSettings.entityContextLayers : [];
      const staleCount = entityLayers.filter(layer => {
        const age = Date.now() - Number(layer.refreshedAt || 0);
        return age > 7 * 24 * 60 * 60 * 1000;
      }).length;
      const message = staleCount > 0
        ? `Index rebuilt. ${staleCount} entity context${staleCount === 1 ? '' : 's'} may be stale — consider rebuilding from the Organisation Setup section.`
        : 'Index rebuilt. All entity contexts are recent.';
      UI.toast(message, staleCount > 0 ? 'warning' : 'success', 6000);
    });
    document.getElementById('btn-reset-docs')?.addEventListener('click', async () => {
      if (await UI.confirm('Reset docs to defaults?')) {
        try {
          localStorage.removeItem('rq_doc_override');
        } catch {}
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
    document.getElementById('btn-add-doc')?.addEventListener('click', () => openEditor(null));
    docList.forEach(doc => {
      document.getElementById(`edit-doc-${doc.id}`)?.addEventListener('click', () => openEditor(doc));
      document.getElementById(`del-doc-${doc.id}`)?.addEventListener('click', async () => {
        if (await UI.confirm(`Delete "${doc.title}"?`)) {
          const deletedId = doc.id;
          saveDocList(getDocList().filter(d => d.id !== deletedId));
          RAGService.init(getDocList(), getBUList());
          Router.resolve();
          UI.toast('Deleted.', 'success');
          if (typeof logAuditEvent === 'function') {
            logAuditEvent({
              category: 'admin',
              eventType: 'document_deleted',
              target: deletedId,
              status: 'success',
              source: 'client',
              detail: { title: doc.title || deletedId }
            }).catch(err => console.warn('document delete audit failed:', err.message));
          }
          refreshAffectedEntityContexts(deletedId).catch(err =>
            console.warn('Background context refresh failed:', err.message)
          );
        }
      });
    });
  }

  async function extractDocumentText(file) {
    const maxChars = 12000;
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    try {
      if (['txt', 'md', 'csv', 'json'].includes(ext)) {
        const text = await file.text();
        return text.slice(0, maxChars).trim();
      }
      if (ext === 'pdf') {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let text = '';
        for (let i = 0; i < bytes.length - 1; i++) {
          const c = bytes[i];
          if (c >= 32 && c < 127) text += String.fromCharCode(c);
          else if (c === 10 || c === 13) text += ' ';
        }
        const readable = text.match(/[A-Za-z0-9 .,;:'"!?(){}\[\]\-]{4,}/g) || [];
        return readable.join(' ').replace(/\s+/g, ' ').slice(0, maxChars).trim();
      }
      if (['doc', 'docx', 'xlsx', 'xls'].includes(ext)) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const chunks = [];
        let current = '';
        for (let i = 0; i < bytes.length; i++) {
          const c = bytes[i];
          if (c >= 32 && c < 127) {
            current += String.fromCharCode(c);
          } else {
            if (current.length >= 5) chunks.push(current);
            current = '';
          }
        }
        if (current.length >= 5) chunks.push(current);
        return chunks
          .filter(chunk => /[a-zA-Z]{3,}/.test(chunk))
          .join(' ')
          .replace(/\s+/g, ' ')
          .slice(0, maxChars)
          .trim();
      }
    } catch (err) {
      console.warn('extractDocumentText failed:', err.message);
    }
    return '';
  }

  async function refreshAffectedEntityContexts(docId) {
    try {
      const buList = typeof getBUList === 'function' ? getBUList() : [];
      const adminSettings = typeof getAdminSettings === 'function'
        ? getAdminSettings() : {};
      const entityLayers = Array.isArray(adminSettings.entityContextLayers)
        ? adminSettings.entityContextLayers : [];

      const affectedBuIds = buList
        .filter(bu => Array.isArray(bu.docIds) && bu.docIds.includes(docId))
        .map(bu => bu.id);

    if (!affectedBuIds.length) return;

    let refreshCount = 0;
    let updatedEntityLayers = entityLayers.slice();
    for (const buId of affectedBuIds) {
      const bu = buList.find(b => b.id === buId);
      if (!bu) continue;
      const existingLayer = updatedEntityLayers.find(l => l.entityId === buId) || {};
      const parentLayer = updatedEntityLayers.find(
        l => l.entityId === adminSettings.companyStructure?.[0]?.id
      ) || {};
        try {
          if (typeof LLMService === 'undefined' || typeof LLMService.buildEntityContext !== 'function') continue;
          const refreshed = await LLMService.buildEntityContext({
            entity: bu,
            parentEntity: { name: adminSettings.companyContextProfile
              ? 'the organisation' : bu.name },
            existingLayer,
            parentLayer,
            adminSettings,
            uploadedText: '',
            uploadedDocumentName: ''
          });
          updatedEntityLayers = updatedEntityLayers.filter(l => l.entityId !== buId);
          updatedEntityLayers.push({
            ...existingLayer,
            ...refreshed,
            entityId: buId,
            refreshedAt: Date.now()
          });
          adminSettings.entityContextLayers = updatedEntityLayers;
          refreshCount++;
        } catch (err) {
          console.warn(
            `refreshAffectedEntityContexts: failed for BU ${buId}:`,
            err.message
          );
        }
      }

      if (refreshCount > 0) {
        if (typeof syncSharedAdminSettings === 'function') {
          await syncSharedAdminSettings(adminSettings, {
            category: 'admin',
            eventType: 'entity_context_refreshed',
            target: 'entity_context_layers',
            details: {
              reason: 'document_library_change',
              docId,
              affectedBuIds
            }
          });
        }
        if (typeof updateAdminSettingsState === 'function') {
          updateAdminSettingsState(adminSettings);
        }
        UI.toast(
          `Context refreshed for ${refreshCount} business unit${refreshCount === 1 ? '' : 's'} affected by this document change.`,
          'info',
          5000
        );
      }
    } catch (err) {
      console.warn('refreshAffectedEntityContexts failed:', err.message);
    }
  }

  function openEditor(doc) {
    const isNew = !doc;
    let tiTags;
    const m = UI.modal({
      title: isNew ? 'Add Document' : `Edit: ${escapeHtml(String(doc?.title || 'Document'))}`,
      body: `<form id="doc-form">
        <div class="form-group"><label class="form-label" for="doc-id">ID</label><input class="form-input" id="doc-id" value="${escapeHtml(String(doc?.id || ''))}" ${!isNew ? 'readonly' : ''}></div>
        <div class="form-group mt-3"><label class="form-label" for="doc-title">Title</label><input class="form-input" id="doc-title" value="${escapeHtml(String(doc?.title || ''))}"></div>
        <div class="form-group mt-3"><label class="form-label" for="doc-url">URL</label><input class="form-input" id="doc-url" type="url" value="${escapeHtml(String(doc?.url || '#/admin/docs'))}" placeholder="https://…"></div>
        <div class="form-group mt-3"><label class="form-label" for="doc-updated">Last Updated</label><input class="form-input" id="doc-updated" type="date" value="${escapeHtml(String(doc?.lastUpdated || ''))}"></div>
        <div class="form-group mt-3"><label class="form-label">Tags</label><div class="tag-input-wrap" id="ti-doc-tags"></div></div>
        <div class="form-group mt-3">
          <label class="form-label" for="doc-file-upload">Upload document <span class="badge badge--neutral" style="margin-left:6px">Optional</span></label>
          <input class="form-input" id="doc-file-upload" type="file"
            accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xlsx,.xls">
          <div class="form-help" style="margin-top:6px">
            Upload to extract full text for AI grounding. Supports TXT, MD,
            CSV, JSON, PDF, Word, and Excel. Text is extracted and stored
            locally — no file is transmitted.
          </div>
          <div id="doc-extract-status" class="form-help"
            style="margin-top:4px;color:var(--color-success)"></div>
        </div>
        <div class="form-group mt-3"><label class="form-label" for="doc-excerpt">Content Excerpt</label><textarea class="form-textarea" id="doc-excerpt" rows="4">${escapeHtml(String(doc?.contentExcerpt || ''))}</textarea></div>
      </form>`,
      footer: `<button class="btn btn--ghost" id="doc-cancel">Cancel</button><button class="btn btn--primary" id="doc-save">Save</button>`
    });
    requestAnimationFrame(() => {
      tiTags = UI.tagInput('ti-doc-tags', doc?.tags || []);
      const fileInput = document.getElementById('doc-file-upload');
      const statusEl = document.getElementById('doc-extract-status');
      if (fileInput) {
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          if (statusEl) statusEl.textContent = 'Extracting text...';
          const extracted = await extractDocumentText(file);
          if (extracted) {
            const excerptEl = document.getElementById('doc-excerpt');
            if (excerptEl && !excerptEl.value.trim()) {
              excerptEl.value = extracted.slice(0, 400);
            }
            fileInput.dataset.fullText = extracted;
            if (statusEl) {
              statusEl.textContent =
                `Extracted ${extracted.length.toLocaleString()} characters.` +
                ` Full text will be stored for AI grounding.`;
            }
          } else {
            if (statusEl) {
              statusEl.textContent =
                'Could not extract text from this file type.' +
                ' You can still type an excerpt manually.';
            }
          }
        });
      }
    });
    document.getElementById('doc-cancel')?.addEventListener('click', () => m.close());
    document.getElementById('doc-save')?.addEventListener('click', () => {
      const id = document.getElementById('doc-id')?.value.trim() || '';
      const title = document.getElementById('doc-title')?.value.trim() || '';
      if (!id || !title) { UI.toast('ID and Title required.', 'warning'); return; }
      const extractedText = document.getElementById('doc-excerpt')?.value || '';
      const fileInput = document.getElementById('doc-file-upload');
      const contentFull = fileInput?.dataset.fullText
        || doc?.contentFull
        || '';
      const updated = {
        id,
        title,
        url: document.getElementById('doc-url')?.value || '#',
        tags: tiTags.getTags(),
        lastUpdated: document.getElementById('doc-updated')?.value || '',
        contentExcerpt: extractedText,
        contentFull: contentFull.slice(0, 12000)
      };
      const list = getDocList();
      const idx = list.findIndex(d => d.id === id);
      if (idx > -1) list[idx] = updated; else list.push(updated);
      saveDocList(list);
      RAGService.init(getDocList(), getBUList());
      const savedDoc = updated;
      // Ingest into RAGService immediately after save
      if (typeof RAGService !== 'undefined' && RAGService.addDocument) {
        RAGService.addDocument({
          id: savedDoc.id || `uploaded-${Date.now()}`,
          title: savedDoc.title || title,
          url: savedDoc.url || '',
          contentExcerpt: String(extractedText || '').slice(0, 500),
          contentFull: String(savedDoc.contentFull || '').slice(0, 8000),
          tags: Array.isArray(savedDoc.tags) ? savedDoc.tags : ['internal', 'uploaded'],
          lastUpdated: new Date().toISOString(),
          buIds: Array.isArray(savedDoc.buIds) ? savedDoc.buIds : []
        });
      }
      m.close();
      Router.resolve();
      UI.toast(`Doc "${title}" ${isNew ? 'added' : 'updated'}.`, 'success');
      if (typeof logAuditEvent === 'function') {
        logAuditEvent({
          category: 'admin',
          eventType: isNew ? 'document_added' : 'document_updated',
          target: id,
          status: 'success',
          source: 'client',
          detail: { title }
        }).catch(err => console.warn('document save audit failed:', err.message));
      }
      refreshAffectedEntityContexts(id).catch(err =>
        console.warn('Background context refresh failed:', err.message)
      );
    });
  }

  return { renderRoute, openEditor };
})();
