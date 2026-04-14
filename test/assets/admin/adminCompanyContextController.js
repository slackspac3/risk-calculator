(function(global) {
  'use strict';

  function getCompassConfigFromAdminInputs() {
    return {
      apiUrl: document.getElementById('admin-compass-url')?.value.trim() || DEFAULT_COMPASS_PROXY_URL,
      model: document.getElementById('admin-compass-model')?.value.trim() || AiStatusClient.DEFAULT_MODEL,
      apiKey: document.getElementById('admin-compass-key')?.value.trim() || ''
    };
  }

  function create({ websiteEl, profileEl, regsInput }) {
    const history = [];
    const historyEl = document.getElementById('admin-company-refinement-history');
    const followupEl = document.getElementById('admin-company-followup');
    const statusEl = document.getElementById('admin-company-refine-status');
    const reviewBadgeEl = document.getElementById('admin-company-review-badge');
    const reviewCopyEl = document.getElementById('admin-company-review-copy');
    const reviewToggleWrapEl = document.getElementById('admin-company-review-toggle-wrap');
    const reviewApprovedEl = document.getElementById('admin-company-review-approved');
    const reviewLabelEl = document.getElementById('admin-company-review-label');
    let currentContextMeta = typeof normaliseContextReviewMeta === 'function'
      ? normaliseContextReviewMeta({
          status: document.getElementById('admin-company-context-status')?.value || '',
          source: document.getElementById('admin-company-context-source')?.value || '',
          generatedAt: Number(document.getElementById('admin-company-context-generated-at')?.value || 0),
          reviewedAt: Number(document.getElementById('admin-company-context-reviewed-at')?.value || 0),
          reviewDueAt: Number(document.getElementById('admin-company-context-review-due-at')?.value || 0),
          fallbackUsed: document.getElementById('admin-company-context-fallback-used')?.value === 'true',
          sourceUrl: document.getElementById('admin-company-context-source-url')?.value || ''
        })
      : null;

    function getCurrentSections() {
      return {
        companySummary: document.getElementById('admin-company-section-summary')?.value.trim() || '',
        businessModel: document.getElementById('admin-company-section-business-model')?.value.trim() || '',
        operatingModel: document.getElementById('admin-company-section-operating-model')?.value.trim() || '',
        publicCommitments: document.getElementById('admin-company-section-commitments')?.value.trim() || '',
        keyRiskSignals: document.getElementById('admin-company-section-risks')?.value.trim() || '',
        obligations: document.getElementById('admin-company-section-obligations')?.value.trim() || '',
        sources: document.getElementById('admin-company-section-sources')?.value.trim() || ''
      };
    }

    function writeContextMeta(meta = null) {
      currentContextMeta = typeof normaliseContextReviewMeta === 'function' ? normaliseContextReviewMeta(meta) : null;
      const model = typeof getContextReviewDisplayModel === 'function'
        ? getContextReviewDisplayModel(currentContextMeta, { subject: 'Shared company context' })
        : {
            badge: 'Review needed',
            badgeClass: 'badge--warning',
            message: 'Review this company context before relying on it as inherited grounding.',
            showApprovalToggle: true,
            approvalLabel: 'I reviewed this shared company context and approve it for inherited grounding.',
            reviewApprovedChecked: false
          };
      if (reviewBadgeEl) {
        reviewBadgeEl.className = `badge ${model.badgeClass}`;
        reviewBadgeEl.textContent = model.badge;
      }
      if (reviewCopyEl) reviewCopyEl.textContent = model.message;
      if (reviewToggleWrapEl) reviewToggleWrapEl.style.display = model.showApprovalToggle ? '' : 'none';
      if (reviewLabelEl) reviewLabelEl.textContent = model.approvalLabel || '';
      if (reviewApprovedEl) reviewApprovedEl.checked = !!model.reviewApprovedChecked;
      const hiddenValues = {
        'admin-company-context-status': currentContextMeta?.status || '',
        'admin-company-context-source': currentContextMeta?.source || '',
        'admin-company-context-generated-at': String(Number(currentContextMeta?.generatedAt || 0)),
        'admin-company-context-reviewed-at': String(Number(currentContextMeta?.reviewedAt || 0)),
        'admin-company-context-review-due-at': String(Number(currentContextMeta?.reviewDueAt || 0)),
        'admin-company-context-fallback-used': currentContextMeta?.fallbackUsed === true ? 'true' : 'false',
        'admin-company-context-source-url': currentContextMeta?.sourceUrl || (websiteEl?.value.trim() || '')
      };
      Object.entries(hiddenValues).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (field) field.value = value;
      });
    }

    function applyResult(result = {}) {
      const sections = buildCompanyContextSections(result);
      const profileText = serialiseCompanyContextSections(sections);
      if (profileEl) profileEl.value = profileText;
      const fieldValues = {
        'admin-company-section-summary': sections.companySummary || '',
        'admin-company-section-business-model': sections.businessModel || '',
        'admin-company-section-operating-model': sections.operatingModel || '',
        'admin-company-section-commitments': sections.publicCommitments || '',
        'admin-company-section-risks': sections.keyRiskSignals || '',
        'admin-company-section-obligations': sections.obligations || '',
        'admin-company-section-sources': sections.sources || ''
      };
      Object.entries(fieldValues).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (field) field.value = value;
      });
      const adminContextSummaryEl = document.getElementById('admin-context-summary');
      if (result.companySummary && adminContextSummaryEl && !adminContextSummaryEl.value.trim()) {
        adminContextSummaryEl.value = result.companySummary;
      }
      const adminAiInstructionsEl = document.getElementById('admin-ai-instructions');
      if (result.aiGuidance && adminAiInstructionsEl) {
        adminAiInstructionsEl.value = result.aiGuidance;
      }
      const adminGeoEl = document.getElementById('admin-geo');
      if (result.suggestedGeography && adminGeoEl && !adminGeoEl.value.trim()) {
        adminGeoEl.value = result.suggestedGeography;
      }
      if (Array.isArray(result.regulatorySignals) && result.regulatorySignals.length && regsInput?.setTags) {
        regsInput.setTags(Array.from(new Set([...(regsInput.getTags() || []), ...result.regulatorySignals])));
      }
      if (typeof buildAiContextReviewMeta === 'function') {
        writeContextMeta(buildAiContextReviewMeta(result, {
          existingMeta: currentContextMeta,
          sourceUrl: websiteEl?.value.trim() || ''
        }));
      }
      return { sections, profileText };
    }

    function renderHistory() {
      if (!historyEl) return;
      if (!history.length) {
        historyEl.innerHTML = '<div class="form-help">No follow-up prompts yet. Build the initial context, then iterate here until the summary feels right.</div>';
        return;
      }
      historyEl.innerHTML = history.map((entry) => `
        <div class="card" style="padding:var(--sp-3);background:var(--bg-canvas)">
          <div class="context-panel-title" style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${entry.role === 'user' ? 'Your prompt' : 'AI update'}</div>
          <div style="margin-top:6px;color:var(--text-primary);line-height:1.55">${escapeHtml(entry.text || '')}</div>
        </div>`).join('');
    }

    async function buildFromWebsite() {
      const button = document.getElementById('btn-build-company-context');
      const websiteUrl = websiteEl?.value.trim() || '';
      if (!button) return;
      if (!websiteUrl) {
        UI.toast('Enter a company website URL first.', 'warning');
        return;
      }
      button.disabled = true;
      button.textContent = 'Building context…';
      try {
        LLMService.setCompassConfig(getCompassConfigFromAdminInputs());
        const uploaded = await loadContextSupportSource('admin-company-source-file', 'admin-company-source-help');
        let result = await LLMService.buildCompanyContext(websiteUrl);
        let { sections, profileText } = applyResult(result);
        if (uploaded.text) {
          result = await LLMService.refineCompanyContext({
            websiteUrl,
            currentSections: getCurrentSections(),
            currentAiGuidance: document.getElementById('admin-ai-instructions')?.value.trim() || '',
            currentGeography: document.getElementById('admin-geo')?.value.trim() || '',
            currentRegulations: regsInput?.getTags ? regsInput.getTags() : [],
            history: [],
            userPrompt: 'Incorporate the uploaded strategy, policy, procedure, and operating-model material into this company context draft while keeping it concise and grounded.',
            uploadedText: '',
            uploadedDocumentName: ''
          });
          ({ sections, profileText } = applyResult(result));
        }
        const degraded = result?.aiUnavailable === true || result?.usedFallback === true;
        history.length = 0;
        history.push({
          role: 'assistant',
          text: degraded && uploaded.text
            ? 'Initial company context draft was built, but the uploaded-source refinement could not run because live AI was unavailable. Retry when live AI is available if you want the uploaded material folded in.'
            : (uploaded.text
              ? 'Initial company context draft created and refined using the uploaded source material. Use follow-up prompts below if you want to reshape it further.'
              : 'Initial company context draft created. Use follow-up prompts below if you want to reshape it further.')
        });
        renderHistory();
        if (statusEl) {
          statusEl.textContent = degraded
            ? 'Initial company draft is in place, but the latest refinement could not run because live AI was unavailable.'
            : 'Initial AI draft applied. Use the follow-up prompt box below to keep refining it.';
        }
        AdminOrgSetupSection.openEntityEditor(null, {
          name: inferCompanyNameFromUrl(websiteUrl),
          websiteUrl,
          profile: profileText,
          contextSections: sections,
          type: 'Holding company'
        });
        UI.toast(
          degraded
            ? 'Company context built, but the latest refinement could not run because live AI was unavailable.'
            : 'Company context built from public sources. Review the entity and place it into the organisation tree.',
          degraded ? 'warning' : 'success',
          5000
        );
      } catch (error) {
        UI.toast('Company context build failed. Try again or shorten the source material.', 'danger', 6000);
        if (statusEl) statusEl.textContent = 'Company context build failed. Try again or shorten the source material.';
      } finally {
        button.disabled = false;
        button.textContent = 'Build from Website';
      }
    }

    async function refineContext() {
      const prompt = followupEl?.value.trim() || '';
      const websiteUrl = websiteEl?.value.trim() || '';
      const button = document.getElementById('btn-refine-admin-company-context');
      if (!button) return;
      if (!websiteUrl) {
        UI.toast('Enter a company website URL first.', 'warning');
        return;
      }
      if (!prompt) {
        UI.toast('Enter a follow-up prompt first.', 'warning');
        return;
      }
      button.disabled = true;
      button.textContent = 'Applying…';
      try {
        if (statusEl) statusEl.textContent = 'Applying your latest instruction to the company context…';
        history.push({ role: 'user', text: prompt });
        renderHistory();
        LLMService.setCompassConfig(getCompassConfigFromAdminInputs());
        const uploaded = await loadContextSupportSource('admin-company-source-file', 'admin-company-source-help');
        const refineInput = {
          websiteUrl,
          currentSections: getCurrentSections(),
          currentAiGuidance: document.getElementById('admin-ai-instructions')?.value.trim() || '',
          currentGeography: document.getElementById('admin-geo')?.value.trim() || '',
          currentRegulations: regsInput?.getTags ? regsInput.getTags() : [],
          history,
          userPrompt: prompt,
          uploadedText: uploaded.text,
          uploadedDocumentName: uploaded.name
        };
        let result;
        try {
          result = await LLMService.refineCompanyContext(refineInput);
        } catch {
          result = buildLocalCompanyContextFallback(refineInput);
        }
        const continuityOnly = result?.continuityOnly === true;
        const degraded = result?.aiUnavailable === true || result?.usedFallback === true;
        applyResult(result);
        history.push({ role: 'assistant', text: result.responseMessage || 'I refined the company context based on your latest prompt.' });
        renderHistory();
        if (followupEl) followupEl.value = '';
        if (statusEl) {
          statusEl.textContent = continuityOnly
            ? 'Live AI was unavailable, so the current company context was kept unchanged.'
            : 'Latest follow-up applied. Keep iterating until the context feels right.';
        }
        UI.toast(
          continuityOnly
            ? 'Live AI was unavailable. The current admin company context stayed unchanged.'
            : degraded
              ? 'Admin company context updated with fallback support. Review it carefully.'
              : 'Admin company context refined.',
          degraded ? 'warning' : 'success',
          5000
        );
      } catch (error) {
        UI.toast('Company context refinement failed. Try again or shorten the prompt.', 'danger', 6000);
        if (statusEl) statusEl.textContent = 'Company context refinement failed. Try again or shorten the prompt.';
      } finally {
        button.disabled = false;
        button.textContent = 'Apply Follow-Up Now';
      }
    }

    renderHistory();
    writeContextMeta(currentContextMeta);

    return {
      bind() {
        // Keep company-context handlers in one controller so admin settings rendering stays declarative.
        document.getElementById('btn-build-company-context')?.addEventListener('click', buildFromWebsite);
        document.getElementById('btn-refine-admin-company-context')?.addEventListener('click', refineContext);
      }
    };
  }

  global.AdminCompanyContextController = { create };
})(window);
