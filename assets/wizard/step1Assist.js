(function(global) {
  'use strict';

  const draftScenarioState = global.DraftScenarioState;
  const STEP1_TRACE_LABELS = {
    guidedDraft: 'Step 1 guided draft',
    promptIdeas: 'Step 1 prompt ideas',
    intakeAssist: 'Step 1 intake assist',
    narrativeRefinement: 'Step 1 narrative refinement',
    registerAnalysis: 'Step 1 register analysis'
  };
  const STEP1_AI_ACTION_COOLDOWN_MS = 4000;
  const _step1AiActionCooldowns = typeof AiWorkflowClient !== 'undefined' && AiWorkflowClient && typeof AiWorkflowClient.createActionCooldownStore === 'function'
    ? AiWorkflowClient.createActionCooldownStore({ cooldownMs: STEP1_AI_ACTION_COOLDOWN_MS, maxEntries: 24 })
    : null;

  function _setStep1TransientButtonState(button, label, durationMs = 1200) {
    if (!button) return;
    const idleLabel = String(button.dataset.idleLabel || button.textContent || '').trim() || String(button.textContent || '').trim();
    button.dataset.idleLabel = idleLabel;
    button.disabled = true;
    button.textContent = String(label || '').trim() || idleLabel;
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.disabled = false;
      button.textContent = idleLabel;
    }, Math.max(400, Number(durationMs || 0)));
  }

  function _getStep1AiActionCooldownMs(endpoint = '', payload = {}, scope = '') {
    if (!_step1AiActionCooldowns) return 0;
    return _step1AiActionCooldowns.getRemainingMs(endpoint, payload, { scope });
  }

  function _markStep1AiActionCooldown(endpoint = '', payload = {}, scope = '') {
    if (!_step1AiActionCooldowns) return 0;
    return _step1AiActionCooldowns.markCompleted(endpoint, payload, { scope });
  }

  function _guardStep1AiActionCooldown({
    button = null,
    endpoint = '',
    payload = {},
    scope = '',
    cooldownLabel = 'Just ran…',
    message = 'This AI action just ran for the current inputs. Review the result or change the inputs before rerunning.'
  } = {}) {
    const remainingMs = _getStep1AiActionCooldownMs(endpoint, payload, scope);
    if (!remainingMs) return false;
    _setStep1TransientButtonState(button, cooldownLabel, Math.min(remainingMs, 1400));
    UI.toast(message, 'info', 3500);
    return true;
  }

  function _buildGuidedDraftStatusCopy(source = '') {
    if (source === 'ai') return 'Built with AI using the current function context, geography, regulations, and retrieved references.';
    if (source === 'fallback') return 'Built in deterministic server fallback mode because the live AI rewrite did not stay close enough to the event you described.';
    if (source === 'manual') return 'AI draft generation is unavailable right now. Continue manually or try again.';
    return 'Preview based on your current guided inputs.';
  }

  function _getStep1AiFailureMessage(error = null) {
    const message = String(error?.message || '').replace(/\s+/g, ' ').trim();
    const unavailableMessage = typeof getAiUnavailableMessage === 'function'
      ? getAiUnavailableMessage()
      : 'AI assistance is temporarily unavailable.';
    if (!message) return unavailableMessage;
    if (/temporarily unavailable/i.test(message) || /No Compass API key configured/i.test(message)) return unavailableMessage;
    if (/Sign in again|session is no longer valid/i.test(message)) {
      return 'Your session is no longer valid for AI requests. Sign in again, then retry.';
    }
    if (/unusable structured response/i.test(message)) {
      return 'AI replied, but the structured draft could not be used for this task. Try again.';
    }
    return message;
  }

  function _buildAiUnavailableBannerHtml(error = null) {
    return `<div class="ai-unavailable-banner banner banner--warning mt-4" role="alert"><span class="banner-icon">△</span><span class="banner-text">${escapeHtml(_getStep1AiFailureMessage(error))} You can continue manually or <button class="link-btn" id="btn-retry-ai" type="button" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">try again</button>.</span></div>`;
  }

  function renderAIStatusBanner() {
    const qualityState = String(AppState?.draft?.aiQualityState || '').trim().toLowerCase();
    if (qualityState === 'fallback') {
      return '<div class="ai-status-banner ai-status-banner--fallback" role="alert">' +
        '<span>⚠ This step is currently showing deterministic fallback output rather than a live AI rewrite. Review the wording and selected risks before continuing.</span>' +
        '</div>';
    }
    return '';
  }

  function _clearStep1AiUnavailableBanners() {
    document.querySelectorAll('.ai-unavailable-banner').forEach(node => node.remove());
  }

  function _normaliseScenarioFingerprintText(value = '') {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function _buildStep1ScenarioFingerprint({
    narrative = '',
    guidedInput = null,
    registerText = '',
    registerMeta = null,
    businessUnit = null,
    geography = '',
    scenarioLensHint = null
  } = {}) {
    const safeGuidedInput = guidedInput && typeof guidedInput === 'object' ? guidedInput : {};
    const scenarioLens = scenarioLensHint && typeof scenarioLensHint === 'object'
      ? String(scenarioLensHint.key || scenarioLensHint.label || scenarioLensHint.functionKey || '').trim()
      : String(scenarioLensHint || '').trim();
    return [
      String(businessUnit?.id || businessUnit?.buId || AppState?.draft?.buId || '').trim(),
      String(geography || '').trim(),
      scenarioLens,
      _normaliseScenarioFingerprintText(safeGuidedInput.event || ''),
      _normaliseScenarioFingerprintText(safeGuidedInput.cause || ''),
      _normaliseScenarioFingerprintText(safeGuidedInput.impact || ''),
      _normaliseScenarioFingerprintText(safeGuidedInput.asset || ''),
      _normaliseScenarioFingerprintText(narrative || ''),
      _normaliseScenarioFingerprintText(registerText || ''),
      String(registerMeta?.extension || registerMeta?.type || '').trim().toLowerCase()
    ].filter(Boolean).join(' | ').slice(0, 320);
  }

  function _getStep1PriorMessages({ scenarioFingerprint = '' } = {}) {
    const priorMessages = Array.isArray(AppState?.draft?.step1LlmContext)
      ? AppState.draft.step1LlmContext
      : (Array.isArray(AppState?.draft?.llmContext) ? AppState.draft.llmContext : []);
    const currentFingerprint = String(scenarioFingerprint || '').trim();
    const storedFingerprint = String(AppState?.draft?.step1ConversationFingerprint || '').trim();
    if (!currentFingerprint || !storedFingerprint || currentFingerprint !== storedFingerprint) return [];
    return priorMessages;
  }

  function _appendStep1LlmContext(userText, assistantText, { scenarioFingerprint = '' } = {}) {
    if (typeof dispatchDraftAction !== 'function') return;
    const user = String(userText || '').trim();
    const assistant = String(assistantText || '').trim();
    if (!user || !assistant) return;
    AppState.draft.step1ConversationFingerprint = String(scenarioFingerprint || '').trim();
    dispatchDraftAction('APPEND_LLM_CONTEXT', { contextKey: 'step1LlmContext', user, assistant });
  }

  function _normaliseRiskConfidence(value) {
    const lowered = String(value || '').trim().toLowerCase();
    return lowered === 'high' || lowered === 'low' || lowered === 'medium' ? lowered : 'medium';
  }

  function _ensureRiskConfidence(result = {}) {
    return {
      ...result,
      risks: (Array.isArray(result.risks) ? result.risks : []).map((risk) => ({
        ...risk,
        confidence: _normaliseRiskConfidence(risk?.confidence)
      }))
    };
  }

  function _syncRiskConfidenceToDraft(risks = []) {
    const confidenceByTitle = new Map(
      (Array.isArray(risks) ? risks : [])
        .map((risk) => {
          const titleKey = String(risk?.title || '').trim().toLowerCase();
          return titleKey ? [titleKey, _normaliseRiskConfidence(risk?.confidence)] : null;
        })
        .filter(Boolean)
    );
    if (!confidenceByTitle.size) return;
    const applyConfidence = (risk) => {
      const titleKey = String(risk?.title || '').trim().toLowerCase();
      if (!titleKey || !confidenceByTitle.has(titleKey)) return risk;
      return {
        ...risk,
        confidence: confidenceByTitle.get(titleKey)
      };
    };
    if (Array.isArray(AppState?.draft?.riskCandidates)) {
      AppState.draft.riskCandidates = AppState.draft.riskCandidates.map(applyConfidence);
    }
    if (Array.isArray(AppState?.draft?.selectedRisks)) {
      AppState.draft.selectedRisks = AppState.draft.selectedRisks.map(applyConfidence);
    }
  }

  function _renderStep1AiUnavailableBanner(target, retryHandler, error = null) {
    const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
    if (!targetEl) return;
    _clearStep1AiUnavailableBanners();
    let bannerEl = null;
    if (targetEl.id === 'guided-preview') {
      targetEl.insertAdjacentHTML('afterend', _buildAiUnavailableBannerHtml(error));
      bannerEl = targetEl.parentElement?.querySelector('.ai-unavailable-banner') || targetEl.nextElementSibling;
    } else {
      targetEl.innerHTML = _buildAiUnavailableBannerHtml(error);
      bannerEl = targetEl.querySelector('.ai-unavailable-banner');
    }
    bannerEl?.querySelector('#btn-retry-ai')?.addEventListener('click', event => {
      event.preventDefault();
      retryHandler();
    });
  }

  function _buildStep1TraceConfidenceBasis() {
    if (typeof buildEvidenceTrustSummary !== 'function') {
      return 'This is still a working draft. Review the current evidence and assumptions before you rely on it.';
    }
    const trust = buildEvidenceTrustSummary({
      confidenceLabel: AppState?.draft?.confidenceLabel,
      evidenceQuality: AppState?.draft?.evidenceQuality,
      evidenceSummary: AppState?.draft?.evidenceSummary,
      missingInformation: AppState?.draft?.missingInformation,
      inputProvenance: AppState?.draft?.inputProvenance,
      citations: AppState?.draft?.citations,
      primaryGrounding: AppState?.draft?.primaryGrounding,
      supportingReferences: AppState?.draft?.supportingReferences,
      inferredAssumptions: AppState?.draft?.inferredAssumptions,
      inputAssignments: AppState?.draft?.inputAssignments
    });
    const evidenceCount = Number(trust.totalEvidenceCount || 0);
    return `${trust.confidenceLabel}${trust.evidenceQuality ? ` · ${trust.evidenceQuality}` : ''}. ${evidenceCount ? `This suggestion was grounded in ${evidenceCount} cited or tracked basis item${evidenceCount === 1 ? '' : 's'}.` : 'This suggestion is still relying mainly on working judgement and current context.'}`;
  }

  function _getLatestStep1Trace(labels = []) {
    if (!LLMService || typeof LLMService.getLatestTrace !== 'function') return null;
    return (Array.isArray(labels) ? labels : [])
      .map((label) => LLMService.getLatestTrace(label))
      .filter(Boolean)
      .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))[0] || null;
  }

  function _buildWhyThisLinkHtml(id) {
    return `<div class="form-help js-ai-trace-link" style="margin-top:8px"><button type="button" class="link-btn" id="${id}" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Why this?</button></div>`;
  }

  function _warnIfRagNotReady() {
    const ready = !!(typeof RAGService !== 'undefined'
      && RAGService
      && typeof RAGService.isReady === 'function'
      && RAGService.isReady());
    if (ready) return;
    console.warn('RAGService not ready — AI will run without document citations.');
    const role = String(AuthService?.getCurrentUser?.()?.role || '').trim().toLowerCase();
    if (role !== 'admin') return;
    try {
      if (sessionStorage.getItem('rip_rag_warned') === '1') return;
      sessionStorage.setItem('rip_rag_warned', '1');
    } catch {}
    UI.toast(
      'Document library not loaded — AI is running without citations. Check the Admin document library.',
      'warning',
      6000
    );
  }

  function _buildManualStep1RequestPayload({
    narrative = '',
    registerText = '',
    registerMeta = null,
    bu = null,
    aiContext = null,
    preferredLens = null,
    citations = [],
    traceLabel = ''
  } = {}) {
    const geography = formatScenarioGeographies(getScenarioGeographies());
    const scenarioFingerprint = _buildStep1ScenarioFingerprint({
      narrative,
      guidedInput: AppState.draft.guidedInput,
      registerText,
      registerMeta,
      businessUnit: aiContext?.businessUnit || bu,
      geography,
      scenarioLensHint: preferredLens
    });
    return {
      riskStatement: String(narrative || '').trim(),
      registerText: String(registerText || '').trim(),
      registerMeta: registerMeta && typeof registerMeta === 'object' ? registerMeta : null,
      scenarioLensHint: preferredLens,
      businessUnit: aiContext?.businessUnit || bu,
      geography,
      applicableRegulations: deriveApplicableRegulations(aiContext?.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
      guidedInput: { ...AppState.draft.guidedInput },
      citations: Array.isArray(citations) ? citations : [],
      adminSettings: aiContext?.adminSettings || {},
      scenarioFingerprint,
      priorMessages: _getStep1PriorMessages({ scenarioFingerprint }),
      traceLabel
    };
  }

  function _renderStep1PostApply({ preserveScroll = false } = {}) {
    const scrollY = preserveScroll ? (window.scrollY || window.pageYOffset || 0) : 0;
    saveDraft();
    renderWizard1();
    if (!preserveScroll) return;
    window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
  }

  function mountAiTraceLinks() {
    document.querySelectorAll('.js-ai-trace-link').forEach((node) => node.remove());
    if (!UI || typeof UI.openAiTraceModal !== 'function') return;

    const guidedDraftSource = String(AppState?.draft?.guidedDraftSource || '').trim().toLowerCase();
    const guidedTrace = guidedDraftSource === 'ai' || guidedDraftSource === 'fallback'
      ? _getLatestStep1Trace([STEP1_TRACE_LABELS.guidedDraft])
      : null;
    const guidedPreview = document.getElementById('guided-preview');
    if (guidedPreview && guidedTrace) {
      guidedPreview.insertAdjacentHTML('afterend', _buildWhyThisLinkHtml('btn-why-this-guided-draft'));
      document.getElementById('btn-why-this-guided-draft')?.addEventListener('click', () => {
        UI.openAiTraceModal(guidedTrace, { confidenceBasis: _buildStep1TraceConfidenceBasis() });
      });
    }

    const intakeTrace = _getLatestStep1Trace([
      STEP1_TRACE_LABELS.registerAnalysis,
      STEP1_TRACE_LABELS.narrativeRefinement,
      STEP1_TRACE_LABELS.intakeAssist
    ]);
    const intakeOutput = document.getElementById('intake-output');
    if (intakeOutput?.querySelector('.wizard-intake-summary') && intakeTrace) {
      intakeOutput.insertAdjacentHTML('beforeend', _buildWhyThisLinkHtml('btn-why-this-intake'));
      document.getElementById('btn-why-this-intake')?.addEventListener('click', () => {
        UI.openAiTraceModal(intakeTrace, { confidenceBasis: _buildStep1TraceConfidenceBasis() });
      });
    }
  }

  async function generateScenarioMemoryPrecedent({ currentScenario = '', matches = [] } = {}) {
    if (!LLMService || typeof LLMService.generateScenarioMemoryPrecedent !== 'function') return null;
    return LLMService.generateScenarioMemoryPrecedent({
      currentScenario,
      matches
    });
  }

  async function compareScenarioMemory({ currentScenario = '', referenceScenario = null, scenarioLens = null } = {}) {
    if (!LLMService || typeof LLMService.compareScenarioMemory !== 'function') return null;
    return LLMService.compareScenarioMemory({
      currentScenario,
      referenceScenario,
      scenarioLens
    });
  }

  async function checkScenarioPortfolioOverlap({ scenarioText = '', portfolio = [] } = {}) {
    if (!LLMService || typeof LLMService.checkScenarioPortfolioOverlap !== 'function') return null;
    return LLMService.checkScenarioPortfolioOverlap({
      scenarioText,
      portfolio
    });
  }

  async function buildGuidedScenarioDraft() {
    _clearStep1AiUnavailableBanners();
    const settings = getEffectiveSettings();
    window.syncStep1GuidedInputStateFromDom?.(AppState.draft);
    const localDraft = composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft);
    if (!localDraft) {
      UI.toast('Answer at least one guided question first.', 'warning');
      return;
    }

    const button = document.getElementById('btn-build-guided-narrative');
    const preview = document.getElementById('guided-preview');
    const bu = getBUList().find(b => b.id === (document.getElementById('wizard-bu')?.value || AppState.draft.buId));
    const preferredLens = window.getStep1ActiveGuidedPromptIdeaLensHint?.(AppState.draft)
      || getStep1PreferredScenarioLens(settings, AppState.draft, localDraft);
    const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
    const geography = formatScenarioGeographies(getScenarioGeographies());
    const scenarioFingerprint = _buildStep1ScenarioFingerprint({
      narrative: localDraft,
      guidedInput: AppState.draft.guidedInput,
      businessUnit: aiContext.businessUnit || bu,
      geography,
      scenarioLensHint: preferredLens
    });
    const requestPayload = {
      riskStatement: localDraft,
      guidedInput: { ...AppState.draft.guidedInput },
      scenarioLensHint: preferredLens,
      businessUnit: aiContext.businessUnit || bu,
      geography,
      applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
      adminSettings: aiContext.adminSettings,
      scenarioFingerprint,
      traceLabel: STEP1_TRACE_LABELS.guidedDraft
    };
    if (_guardStep1AiActionCooldown({
      button,
      endpoint: '/api/ai/scenario-draft',
      payload: requestPayload,
      scope: `step1-guided-draft::${scenarioFingerprint}`,
      cooldownLabel: 'Built just now',
      message: 'This guided draft already reflects the current answers. Review it or change the guided inputs before rebuilding.'
    })) return;
    const resetButton = _setStep1ButtonBusy(button, 'Building with AI…');

    if (preview) {
      preview.textContent = 'Building a scenario draft from the current event, impact, and context…';
    }
    window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: localDraft });

    try {
      _warnIfRagNotReady();
      const citations = await RAGService.retrieveRelevantDocs(bu?.id, buildAssessmentRetrievalQuery({
        narrative: localDraft,
        guidedInput: AppState.draft.guidedInput,
        scenarioLens: preferredLens,
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
      }), 5);
      const rawResult = await LLMService.buildGuidedScenarioDraft({
        ...requestPayload,
        citations
      });
      const result = _ensureRiskConfidence(rawResult);
      _markStep1AiActionCooldown('/api/ai/scenario-draft', requestPayload, `step1-guided-draft::${scenarioFingerprint}`);
      const finalDraft = String(result.draftNarrative || result.enhancedStatement || localDraft).trim() || localDraft;
      const resultMode = String(result.mode || '').trim().toLowerCase();
      const guidedDraftSource = resultMode === 'deterministic_fallback'
        ? 'fallback'
        : resultMode === 'manual'
          ? 'manual'
          : (String(result.draftNarrativeSource || (result.usedFallback ? 'fallback' : 'ai')).trim() || 'local');
      clearStep1StaleAssistState(finalDraft, { clearGeneratedRisks: true });
      const appliedResult = {
        ...result,
        summary: result.summary || `Suggested draft: ${_buildGuidedDraftStatusCopy(guidedDraftSource)}`,
        linkAnalysis: result.linkAnalysis || 'The shortlist was refreshed around the same event path, impact, and current scenario lens.'
      };
      draftScenarioState.applyScenarioAssistResultToDraft(appliedResult, {
        narrative: localDraft,
        assistSeed: localDraft,
        bu,
        citations,
        nextNarrative: finalDraft
      });
      _syncRiskConfidenceToDraft(appliedResult.risks);
      AppState.draft.guidedDraftPreview = finalDraft;
      AppState.draft.guidedDraftSource = guidedDraftSource;
      AppState.draft.guidedDraftStatus = _buildGuidedDraftStatusCopy(guidedDraftSource);
      AppState.draft.aiQualityState = guidedDraftSource;
      AppState.draft.narrative = finalDraft;
      AppState.draft.sourceNarrative = localDraft;
      AppState.draft.enhancedNarrative = finalDraft;
      _appendStep1LlmContext(localDraft, finalDraft, { scenarioFingerprint });
      document.getElementById('intake-risk-statement').value = finalDraft;
      saveDraft();
      renderWizard1();
      window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: finalDraft });
      mountAiTraceLinks();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('guided-preview', buildGuidedScenarioDraft);
      }
      const selectedCount = getSelectedRisks().length;
      const toastTone = resultMode === 'live' && !result.usedFallback ? 'success' : 'warning';
      const toastCopy = resultMode === 'deterministic_fallback'
        ? (selectedCount
          ? `Deterministic fallback draft loaded and shortlist refreshed with ${selectedCount} aligned risk${selectedCount === 1 ? '' : 's'}. Review before continuing.`
          : 'Deterministic fallback draft loaded. Review before continuing.')
        : (selectedCount
          ? `Scenario draft built and shortlist refreshed with ${selectedCount} aligned risk${selectedCount === 1 ? '' : 's'}.`
          : 'Scenario draft built from the guided answers.');
      UI.toast(toastCopy, toastTone, 5000);
    } catch (error) {
      clearStep1StaleAssistState(localDraft, { clearGeneratedRisks: true });
      AppState.draft.aiQualityState = '';
      saveDraft();
      renderWizard1();
      window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: localDraft });
      _renderStep1AiUnavailableBanner('guided-preview', buildGuidedScenarioDraft, error);
      UI.toast(
        'AI draft generation is unavailable right now. Continue manually or try again.',
        'warning',
        5000
      );
    } finally {
      resetButton();
    }
  }

  async function previewGuidedScenarioDraft(input = {}) {
    const guidedInput = input?.guidedInput && typeof input.guidedInput === 'object'
      ? { ...input.guidedInput }
      : { ...(AppState.draft.guidedInput || {}) };
    const localDraft = String(input?.riskStatement || '').trim()
      || composeStep1GuidedNarrative(guidedInput, getEffectiveSettings(), AppState.draft);
    if (!localDraft) return null;
    // Guided preview is intentionally local-only. The authoritative Step 1 intelligence
    // comes from the explicit "Build scenario draft" server workflow, not background preview traffic.
    return {
      preview: localDraft,
      source: 'local',
      status: '',
      aiUnavailable: false,
      usedFallback: true
    };
  }

  async function suggestGuidedPromptIdeas(input = {}) {
    const fallbackSuggestions = Array.isArray(input?.fallbackSuggestions) ? input.fallbackSuggestions : [];
    try {
      if (!LLMService || typeof LLMService.suggestGuidedPromptIdeas !== 'function') {
        return {
          ideas: fallbackSuggestions,
          usedFallback: true,
          aiUnavailable: false,
          source: 'fallback'
        };
      }
      const buId = String(input?.buId || AppState?.draft?.buId || '').trim();
      const bu = typeof getBUList === 'function'
        ? (getBUList() || []).find((item) => item?.id === buId) || null
        : null;
      const aiContext = typeof buildCurrentAIAssistContext === 'function'
        ? buildCurrentAIAssistContext({ buId })
        : { businessUnit: bu, adminSettings: {} };
      const geography = typeof formatScenarioGeographies === 'function' && typeof getScenarioGeographies === 'function'
        ? formatScenarioGeographies(getScenarioGeographies())
        : '';
      const scenarioFingerprint = _buildStep1ScenarioFingerprint({
        narrative: String(input?.riskStatement || '').trim(),
        guidedInput: input?.guidedInput,
        businessUnit: input?.businessUnit || aiContext.businessUnit || bu,
        geography,
        scenarioLensHint: input?.scenarioLensHint
      });
      const result = await LLMService.suggestGuidedPromptIdeas({
        ...input,
        businessUnit: input?.businessUnit || aiContext.businessUnit || bu,
        priorMessages: _getStep1PriorMessages({ scenarioFingerprint }),
        traceLabel: STEP1_TRACE_LABELS.promptIdeas
      });
      return result && typeof result === 'object'
        ? {
            ...result,
            source: String(result.source || (result.usedFallback ? 'fallback' : 'ai')).trim() || 'ai'
          }
        : {
            ideas: fallbackSuggestions,
            usedFallback: true,
            aiUnavailable: false,
            source: 'fallback'
          };
    } catch (error) {
      console.warn('suggestGuidedPromptIdeas live assist fallback:', error?.message || error);
      return {
        ideas: fallbackSuggestions,
        usedFallback: true,
        aiUnavailable: error?.code === 'LLM_UNAVAILABLE',
        source: 'fallback'
      };
    }
  }

  async function runIntakeAssist() {
    _clearStep1AiUnavailableBanners();
    const narrative = document.getElementById('intake-risk-statement')?.value.trim() || AppState.draft.narrative || '';
    const assistSeed = draftScenarioState.getIntakeAssistSeedNarrative(narrative || AppState.draft.registerFindings);
    const output = document.getElementById('intake-output');
    const bu = getBUList().find(b => b.id === (document.getElementById('wizard-bu')?.value || AppState.draft.buId));
    if (!narrative && !AppState.draft.registerFindings) {
      UI.toast('Add a risk statement or upload a risk register first.', 'warning');
      return;
    }
    window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: assistSeed || narrative });
    if (output) output.innerHTML = UI.wizardAssistSkeleton();
    try {
      const preferredLens = typeof getStep1ManualPreferredScenarioLens === 'function'
        ? getStep1ManualPreferredScenarioLens(getEffectiveSettings(), AppState.draft, assistSeed || narrative)
        : getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft, assistSeed || narrative);
      const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
      _warnIfRagNotReady();
      const citations = await RAGService.retrieveRelevantDocs(bu?.id, buildAssessmentRetrievalQuery({
        narrative: assistSeed || AppState.draft.registerFindings,
        guidedInput: AppState.draft.guidedInput,
        structuredScenario: AppState.draft.structuredScenario,
        scenarioLens: preferredLens,
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
      }), 5);
      const requestPayload = _buildManualStep1RequestPayload({
        narrative: assistSeed || narrative,
        registerText: AppState.draft.registerFindings,
        registerMeta: AppState.draft.registerMeta,
        bu,
        aiContext,
        preferredLens,
        citations,
        traceLabel: STEP1_TRACE_LABELS.intakeAssist
      });
      const rawResult = await LLMService.buildManualIntakeAssist(requestPayload);
      const result = _ensureRiskConfidence(rawResult);
      draftScenarioState.applyScenarioAssistResultToDraft(result, {
        narrative,
        assistSeed,
        bu,
        citations,
        nextNarrative: result.enhancedStatement || narrative
      });
      _syncRiskConfidenceToDraft(result.risks);
      _appendStep1LlmContext(assistSeed || narrative, result.enhancedStatement || result.draftNarrative || narrative, {
        scenarioFingerprint: requestPayload.scenarioFingerprint
      });
      saveDraft();
      renderWizard1();
      window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: result.enhancedStatement || narrative });
      mountAiTraceLinks();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', runIntakeAssist);
      }
      UI.toast(result.usedFallback ? 'Suggested draft loaded with deterministic fallback support. Review before continuing.' : 'Suggested draft intake completed.', result.usedFallback ? 'warning' : 'success', 5000);
    } catch (error) {
      console.error('runIntakeAssist failed:', error);
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner(output, runIntakeAssist, error);
        return;
      }
      if (output) output.innerHTML = `<div class="banner banner--danger"><span class="banner-icon">⚠</span><span class="banner-text">AI intake is unavailable right now. The current draft stays intact.</span></div>`;
    }
  }

  async function enhanceNarrativeWithAI() {
    _clearStep1AiUnavailableBanners();
    const narrative = document.getElementById('intake-risk-statement')?.value.trim() || AppState.draft.narrative || '';
    const assistSeed = draftScenarioState.getIntakeAssistSeedNarrative(narrative);
    const output = document.getElementById('intake-output');
    const bu = getBUList().find(b => b.id === (document.getElementById('wizard-bu')?.value || AppState.draft.buId));
    if (!narrative) {
      UI.toast('Enter a risk statement first.', 'warning');
      return;
    }
    const button = document.getElementById('btn-enhance-risk-statement');
    const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
    const preferredLens = typeof getStep1ManualPreferredScenarioLens === 'function'
      ? getStep1ManualPreferredScenarioLens(getEffectiveSettings(), AppState.draft, assistSeed || narrative)
      : getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft, assistSeed || narrative);
    const requestPayload = _buildManualStep1RequestPayload({
      narrative: assistSeed || narrative,
      bu,
      aiContext,
      preferredLens,
      traceLabel: STEP1_TRACE_LABELS.narrativeRefinement
    });
    if (_guardStep1AiActionCooldown({
      button,
      endpoint: '/api/ai/manual-draft-refinement',
      payload: requestPayload,
      scope: `step1-enhance-draft::${requestPayload.scenarioFingerprint || ''}`,
      cooldownLabel: 'Enhanced just now',
      message: 'This draft refinement already reflects the current wording. Review it or change the draft before rerunning.'
    })) return;
    const resetButton = _setStep1ButtonBusy(button, 'Enhancing…');
    window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: assistSeed || narrative });
    if (output) output.innerHTML = UI.wizardAssistSkeleton();
    try {
      _warnIfRagNotReady();
      const citations = await RAGService.retrieveRelevantDocs(bu?.id, buildAssessmentRetrievalQuery({
        narrative: assistSeed || narrative,
        guidedInput: AppState.draft.guidedInput,
        structuredScenario: AppState.draft.structuredScenario,
        scenarioLens: preferredLens,
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
      }), 5);
      const rawResult = await LLMService.buildManualDraftRefinement({
        ...requestPayload,
        citations
      });
      const result = _ensureRiskConfidence(rawResult);
      _markStep1AiActionCooldown('/api/ai/manual-draft-refinement', requestPayload, `step1-enhance-draft::${requestPayload.scenarioFingerprint || ''}`);
      draftScenarioState.applyScenarioAssistResultToDraft(result, {
        narrative,
        assistSeed,
        bu,
        citations,
        nextNarrative: result.enhancedStatement || narrative
      });
      _syncRiskConfidenceToDraft(result.risks);
      _appendStep1LlmContext(assistSeed || narrative, result.enhancedStatement || result.draftNarrative || narrative, {
        scenarioFingerprint: requestPayload.scenarioFingerprint
      });
      saveDraft();
      renderWizard1();
      window.scheduleStep1ScenarioCrossReferenceRefresh?.({ immediate: true, force: true, narrativeOverride: result.enhancedStatement || narrative });
      mountAiTraceLinks();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', enhanceNarrativeWithAI);
      }
      UI.toast(result.usedFallback ? 'Suggested draft enhancement loaded with deterministic fallback support. Review before continuing.' : 'Suggested draft enhancement loaded.', result.usedFallback ? 'warning' : 'success', 5000);
    } catch (error) {
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner(output, enhanceNarrativeWithAI, error);
        return;
      }
      if (output) output.innerHTML = `<div class="banner banner--danger"><span class="banner-icon">⚠</span><span class="banner-text">AI enhancement is unavailable right now. Try again in a moment.</span></div>`;
    } finally {
      resetButton();
    }
  }

  async function generateShortlistFromDraft({
    narrative = '',
    button = null,
    replaceGenerated = true,
    preserveScroll = false,
    suppressToast = false
  } = {}) {
    _clearStep1AiUnavailableBanners();
    const draftNarrative = String(narrative || document.getElementById('intake-risk-statement')?.value || AppState.draft.narrative || '').trim();
    if (!draftNarrative) {
      if (!suppressToast) UI.toast('Enter or build a scenario draft first.', 'warning');
      return { generatedCount: 0, mode: 'manual' };
    }
    const bu = getBUList().find(b => b.id === (document.getElementById('wizard-bu')?.value || AppState.draft.buId));
    const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
    const preferredLens = typeof getStep1ManualPreferredScenarioLens === 'function'
      ? getStep1ManualPreferredScenarioLens(getEffectiveSettings(), AppState.draft, draftNarrative)
      : getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft, draftNarrative);
    const requestPayload = _buildManualStep1RequestPayload({
      narrative: draftNarrative,
      bu,
      aiContext,
      preferredLens,
      citations: Array.isArray(AppState.draft.citations) ? AppState.draft.citations : [],
      traceLabel: 'Step 1 manual shortlist'
    });
    if (_guardStep1AiActionCooldown({
      button,
      endpoint: '/api/ai/manual-shortlist',
      payload: requestPayload,
      scope: `step1-manual-shortlist::${requestPayload.scenarioFingerprint || ''}`,
      cooldownLabel: 'Loaded just now',
      message: 'This shortlist already reflects the current draft. Review it or change the scenario before rerunning.'
    })) return {
      generatedCount: getSelectedRisks().length,
      mode: AppState.draft.aiQualityState === 'fallback' ? 'deterministic_fallback' : 'live',
      reused: true
    };
    const resetButton = _setStep1ButtonBusy(button, button?.id === 'btn-next-1' ? 'Generating shortlist…' : 'Generating shortlist…');
    try {
      const rawResult = await LLMService.buildManualShortlist(requestPayload);
      const result = _ensureRiskConfidence(rawResult);
      _markStep1AiActionCooldown('/api/ai/manual-shortlist', requestPayload, `step1-manual-shortlist::${requestPayload.scenarioFingerprint || ''}`);
      const appliedRisks = draftScenarioState.applyScenarioShortlistResultToDraft(result, {
        narrative: draftNarrative,
        bu,
        citations: requestPayload.citations
      });
      _syncRiskConfidenceToDraft(result.risks);
      _renderStep1PostApply({ preserveScroll });
      mountAiTraceLinks();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', () => generateShortlistFromDraft({
          narrative: draftNarrative,
          replaceGenerated,
          preserveScroll,
          suppressToast
        }));
      }
      const generatedCount = Array.isArray(appliedRisks) ? appliedRisks.length : 0;
      if (!suppressToast) {
        const tone = result.mode === 'manual' || result.usedFallback ? 'warning' : 'success';
        const message = generatedCount
          ? `Loaded ${generatedCount} risk${generatedCount === 1 ? '' : 's'} from the current draft.`
          : 'The current draft is still too weak or ambiguous to build a shortlist reliably. Tighten the draft and try again.';
        UI.toast(message, tone, 5000);
      }
      return {
        generatedCount,
        mode: result.mode,
        result
      };
    } catch (error) {
      console.error('generateShortlistFromDraft failed:', error);
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner('intake-output', () => generateShortlistFromDraft({
          narrative: draftNarrative,
          replaceGenerated,
          preserveScroll,
          suppressToast
        }), error);
        if (!suppressToast) {
          UI.toast('Shortlist generation is unavailable right now. Your current draft stays intact.', 'warning', 5000);
        }
        return { generatedCount: 0, mode: 'manual', unavailable: true };
      }
      if (!suppressToast) UI.toast('Shortlist generation is unavailable right now. Try again in a moment.', 'danger');
      return { generatedCount: 0, mode: 'manual', error };
    } finally {
      resetButton();
    }
  }

  async function analyseUploadedRegister() {
    _clearStep1AiUnavailableBanners();
    if (!AppState.draft.registerFindings) {
      UI.toast('Upload a risk register first.', 'warning');
      return;
    }
    if (looksLikeBinaryRegister(AppState.draft.registerFindings)) {
      UI.toast('This uploaded file still looks binary and cannot be analysed safely. Please convert it to TXT, CSV, TSV, JSON, or Markdown.', 'warning', 7000);
      return;
    }
    const bu = getBUList().find(b => b.id === AppState.draft.buId);
    const button = document.getElementById('btn-register-analyse');
    const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
    const geography = formatScenarioGeographies(getScenarioGeographies());
    const scenarioFingerprint = _buildStep1ScenarioFingerprint({
      registerText: AppState.draft.registerFindings,
      registerMeta: AppState.draft.registerMeta,
      businessUnit: aiContext.businessUnit || bu,
      geography,
      scenarioLensHint: AppState.draft.scenarioLens
    });
    const requestPayload = {
      registerText: AppState.draft.registerFindings,
      registerMeta: AppState.draft.registerMeta,
      businessUnit: aiContext.businessUnit || bu,
      geography,
      applicableRegulations: AppState.draft.applicableRegulations || [],
      adminSettings: aiContext.adminSettings,
      scenarioFingerprint,
      priorMessages: _getStep1PriorMessages({ scenarioFingerprint }),
      traceLabel: STEP1_TRACE_LABELS.registerAnalysis
    };
    if (_guardStep1AiActionCooldown({
      button,
      endpoint: '/api/ai/register-analysis',
      payload: requestPayload,
      scope: `step1-register-analysis::${scenarioFingerprint}`,
      cooldownLabel: 'Analysed just now',
      message: 'This register analysis already reflects the current upload and context. Review it or change the file before rerunning.'
    })) return;
    const resetButton = _setStep1ButtonBusy(button, 'Uploading, extracting, and analysing…');
    try {
      const rawResult = await LLMService.analyseRiskRegister(requestPayload);
      const result = _ensureRiskConfidence(rawResult);
      _markStep1AiActionCooldown('/api/ai/register-analysis', requestPayload, `step1-register-analysis::${scenarioFingerprint}`);
      const parsedFallback = parseRegisterText(AppState.draft.registerFindings).map(title => ({ title, source: 'register' }));
      const extractedRisks = result.risks || parsedFallback;
      if (!extractedRisks.length) {
        UI.toast('No usable risk lines were found in that file. Try a cleaner TXT/CSV export or paste the risks directly.', 'warning', 7000);
        return;
      }
      draftScenarioState.applyRegisterAnalysisResultToDraft(result, { parsedFallback });
      _syncRiskConfidenceToDraft(result.risks);
      saveDraft();
      renderWizard1();
      mountAiTraceLinks();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', analyseUploadedRegister);
      }
      UI.toast(result.usedFallback ? getRegisterFallbackToastCopy(result) : 'Suggested draft register analysis loaded.', result.usedFallback ? 'warning' : 'success', 7000);
    } catch (error) {
      console.error('analyseUploadedRegister failed:', error);
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner('intake-output', analyseUploadedRegister, error);
        return;
      }
      UI.toast('Register analysis is unavailable right now. Try again in a moment.', 'danger');
    } finally {
      resetButton();
    }
  }

  global.renderAIStatusBanner = renderAIStatusBanner;

  global.Step1Assist = {
    buildGuidedScenarioDraft,
    previewGuidedScenarioDraft,
    suggestGuidedPromptIdeas,
    runIntakeAssist,
    enhanceNarrativeWithAI,
    generateShortlistFromDraft,
    analyseUploadedRegister,
    generateScenarioMemoryPrecedent,
    compareScenarioMemory,
    checkScenarioPortfolioOverlap,
    renderAIStatusBanner,
    mountAiTraceLinks
  };
})(window);
