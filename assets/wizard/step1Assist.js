(function(global) {
  'use strict';

  const draftScenarioState = global.DraftScenarioState;

  function _buildGuidedDraftStatusCopy(source = '') {
    if (source === 'ai') return 'Built with AI using the current function context, geography, regulations, and retrieved references.';
    if (source === 'fallback') return 'Built from the original scenario and current context because the AI rewrite did not stay close enough to the event you described.';
    return 'Built directly from the guided inputs while AI guidance was unavailable.';
  }

  function _buildAiUnavailableBannerHtml() {
    return `<div class="ai-unavailable-banner banner banner--warning mt-4" role="alert"><span class="banner-icon">△</span><span class="banner-text">AI assistance is temporarily unavailable. You can continue manually or <button class="link-btn" id="btn-retry-ai" type="button" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">try again</button>.</span></div>`;
  }

  function _clearStep1AiUnavailableBanners() {
    document.querySelectorAll('.ai-unavailable-banner').forEach(node => node.remove());
  }

  function _getStep1PriorMessages() {
    return Array.isArray(AppState?.draft?.llmContext) ? AppState.draft.llmContext : [];
  }

  function _appendStep1LlmContext(userText, assistantText) {
    if (typeof dispatchDraftAction !== 'function') return;
    const user = String(userText || '').trim();
    const assistant = String(assistantText || '').trim();
    if (!user || !assistant) return;
    dispatchDraftAction('APPEND_LLM_CONTEXT', { user, assistant });
  }

  function _renderStep1AiUnavailableBanner(target, retryHandler) {
    const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
    if (!targetEl) return;
    _clearStep1AiUnavailableBanners();
    let bannerEl = null;
    if (targetEl.id === 'guided-preview') {
      targetEl.insertAdjacentHTML('afterend', _buildAiUnavailableBannerHtml());
      bannerEl = targetEl.parentElement?.querySelector('.ai-unavailable-banner') || targetEl.nextElementSibling;
    } else {
      targetEl.innerHTML = _buildAiUnavailableBannerHtml();
      bannerEl = targetEl.querySelector('.ai-unavailable-banner');
    }
    bannerEl?.querySelector('#btn-retry-ai')?.addEventListener('click', event => {
      event.preventDefault();
      retryHandler();
    });
  }

  async function buildGuidedScenarioDraft() {
    _clearStep1AiUnavailableBanners();
    const settings = getEffectiveSettings();
    const localDraft = composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft);
    if (!localDraft) {
      UI.toast('Answer at least one guided question first.', 'warning');
      return;
    }

    const button = document.getElementById('btn-build-guided-narrative');
    const resetButton = _setStep1ButtonBusy(button, 'Building…');
    const preview = document.getElementById('guided-preview');
    const bu = getBUList().find(b => b.id === (document.getElementById('wizard-bu')?.value || AppState.draft.buId));
    const preferredLens = getStep1PreferredScenarioLens(settings, AppState.draft);

    if (preview) {
      preview.textContent = 'Building a scenario draft from the current event, impact, and context…';
    }

    try {
      const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
      const citations = await RAGService.retrieveRelevantDocs(bu?.id, buildAssessmentRetrievalQuery({
        narrative: localDraft,
        guidedInput: AppState.draft.guidedInput,
        scenarioLens: preferredLens,
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
      }), 5);
      const result = await LLMService.buildGuidedScenarioDraft({
        riskStatement: localDraft,
        guidedInput: { ...AppState.draft.guidedInput },
        scenarioLensHint: preferredLens,
        businessUnit: aiContext.businessUnit || bu,
        geography: formatScenarioGeographies(getScenarioGeographies()),
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        citations,
        adminSettings: aiContext.adminSettings,
        priorMessages: _getStep1PriorMessages()
      });
      const finalDraft = String(result.draftNarrative || result.enhancedStatement || localDraft).trim() || localDraft;
      const guidedDraftSource = String(result.draftNarrativeSource || (result.usedFallback ? 'fallback' : 'ai')).trim() || 'local';
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
      AppState.draft.guidedDraftPreview = finalDraft;
      AppState.draft.guidedDraftSource = guidedDraftSource;
      AppState.draft.guidedDraftStatus = _buildGuidedDraftStatusCopy(guidedDraftSource);
      AppState.draft.aiQualityState = guidedDraftSource;
      AppState.draft.narrative = finalDraft;
      AppState.draft.sourceNarrative = localDraft;
      AppState.draft.enhancedNarrative = finalDraft;
      _appendStep1LlmContext(localDraft, finalDraft);
      document.getElementById('intake-risk-statement').value = finalDraft;
      saveDraft();
      renderWizard1();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('guided-preview', buildGuidedScenarioDraft);
      }
      const selectedCount = getSelectedRisks().length;
      const toastTone = guidedDraftSource === 'ai' && !result.usedFallback ? 'success' : 'warning';
      const toastCopy = selectedCount
        ? `Scenario draft built and shortlist refreshed with ${selectedCount} aligned risk${selectedCount === 1 ? '' : 's'}.`
        : 'Scenario draft built from the guided answers.';
      UI.toast(toastCopy, toastTone, 5000);
    } catch (error) {
      clearStep1StaleAssistState(localDraft, { clearGeneratedRisks: true });
      AppState.draft.guidedDraftPreview = localDraft;
      AppState.draft.guidedDraftSource = 'local';
      AppState.draft.guidedDraftStatus = _buildGuidedDraftStatusCopy('local');
      AppState.draft.aiQualityState = 'local';
      AppState.draft.narrative = localDraft;
      AppState.draft.sourceNarrative = localDraft;
      AppState.draft.enhancedNarrative = localDraft;
      document.getElementById('intake-risk-statement').value = localDraft;
      const seededCount = seedRisksFromScenarioDraft(localDraft, { force: true, replaceGenerated: true });
      saveDraft();
      renderWizard1();
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner('guided-preview', buildGuidedScenarioDraft);
      }
      UI.toast(
        seededCount
          ? `Scenario draft built from guided context and shortlist refreshed with ${seededCount} aligned risk${seededCount === 1 ? '' : 's'}.`
          : 'Scenario draft built from guided context while AI was unavailable.',
        'warning',
        5000
      );
    } finally {
      resetButton();
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
    if (output) output.innerHTML = UI.wizardAssistSkeleton();
    try {
      const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
      const citations = await RAGService.retrieveRelevantDocs(bu?.id, buildAssessmentRetrievalQuery({
        narrative: assistSeed || AppState.draft.registerFindings,
        guidedInput: AppState.draft.guidedInput,
        structuredScenario: AppState.draft.structuredScenario,
        scenarioLens: AppState.draft.scenarioLens,
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
      }), 5);
      const result = await LLMService.enhanceRiskContext({
        riskStatement: assistSeed || narrative,
        registerText: AppState.draft.registerFindings,
        registerMeta: AppState.draft.registerMeta,
        scenarioLensHint: AppState.draft.scenarioLens,
        businessUnit: aiContext.businessUnit || bu,
        geography: formatScenarioGeographies(getScenarioGeographies()),
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        guidedInput: { ...AppState.draft.guidedInput },
        citations,
        adminSettings: aiContext.adminSettings,
        priorMessages: _getStep1PriorMessages()
      });
      draftScenarioState.applyScenarioAssistResultToDraft(result, {
        narrative,
        assistSeed,
        bu,
        citations,
        nextNarrative: result.enhancedStatement || narrative
      });
      _appendStep1LlmContext(assistSeed || narrative, result.enhancedStatement || result.draftNarrative || narrative);
      saveDraft();
      renderWizard1();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', runIntakeAssist);
      }
      UI.toast(result.usedFallback ? 'Suggested draft loaded with fallback guidance. Review before continuing.' : 'Suggested draft intake completed.', result.usedFallback ? 'warning' : 'success', 5000);
    } catch (error) {
      console.error('runIntakeAssist failed:', error);
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner(output, runIntakeAssist);
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
    const resetButton = _setStep1ButtonBusy(button, 'Enhancing…');
    if (output) output.innerHTML = UI.wizardAssistSkeleton();
    try {
      const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
      const citations = await RAGService.retrieveRelevantDocs(bu?.id, buildAssessmentRetrievalQuery({
        narrative: assistSeed || narrative,
        guidedInput: AppState.draft.guidedInput,
        structuredScenario: AppState.draft.structuredScenario,
        scenarioLens: AppState.draft.scenarioLens,
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
      }), 5);
      const result = await LLMService.enhanceRiskContext({
        riskStatement: assistSeed || narrative,
        registerText: '',
        registerMeta: null,
        scenarioLensHint: AppState.draft.scenarioLens,
        businessUnit: aiContext.businessUnit || bu,
        geography: formatScenarioGeographies(getScenarioGeographies()),
        applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        guidedInput: { ...AppState.draft.guidedInput },
        citations,
        adminSettings: aiContext.adminSettings,
        priorMessages: _getStep1PriorMessages()
      });
      draftScenarioState.applyScenarioAssistResultToDraft(result, {
        narrative,
        assistSeed,
        bu,
        citations,
        nextNarrative: result.enhancedStatement || narrative
      });
      _appendStep1LlmContext(assistSeed || narrative, result.enhancedStatement || result.draftNarrative || narrative);
      saveDraft();
      renderWizard1();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', enhanceNarrativeWithAI);
      }
      UI.toast(result.usedFallback ? 'Suggested draft enhancement loaded with fallback guidance. Review before continuing.' : 'Suggested draft enhancement loaded.', result.usedFallback ? 'warning' : 'success', 5000);
    } catch (error) {
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner(output, enhanceNarrativeWithAI);
        return;
      }
      if (output) output.innerHTML = `<div class="banner banner--danger"><span class="banner-icon">⚠</span><span class="banner-text">AI enhancement is unavailable right now. Try again in a moment.</span></div>`;
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
    const resetButton = _setStep1ButtonBusy(button, 'Uploading, extracting, and analysing…');
    try {
      const aiContext = buildCurrentAIAssistContext({ buId: bu?.id || AppState.draft.buId });
      const result = await LLMService.analyseRiskRegister({
        registerText: AppState.draft.registerFindings,
        registerMeta: AppState.draft.registerMeta,
        businessUnit: aiContext.businessUnit || bu,
        geography: formatScenarioGeographies(getScenarioGeographies()),
        applicableRegulations: AppState.draft.applicableRegulations || [],
        adminSettings: aiContext.adminSettings,
        priorMessages: _getStep1PriorMessages()
      });
      const parsedFallback = parseRegisterText(AppState.draft.registerFindings).map(title => ({ title, source: 'register' }));
      const extractedRisks = result.risks || parsedFallback;
      if (!extractedRisks.length) {
        UI.toast('No usable risk lines were found in that file. Try a cleaner TXT/CSV export or paste the risks directly.', 'warning', 7000);
        return;
      }
      draftScenarioState.applyRegisterAnalysisResultToDraft(result, { parsedFallback });
      saveDraft();
      renderWizard1();
      if (result.aiUnavailable) {
        _renderStep1AiUnavailableBanner('intake-output', analyseUploadedRegister);
      }
      UI.toast(result.usedFallback ? getRegisterFallbackToastCopy(result) : 'Suggested draft register analysis loaded.', result.usedFallback ? 'warning' : 'success', 7000);
    } catch (error) {
      console.error('analyseUploadedRegister failed:', error);
      if (error?.code === 'LLM_UNAVAILABLE') {
        _renderStep1AiUnavailableBanner('intake-output', analyseUploadedRegister);
        return;
      }
      UI.toast('Register analysis is unavailable right now. Try again in a moment.', 'danger');
    } finally {
      resetButton();
    }
  }

  global.Step1Assist = {
    buildGuidedScenarioDraft,
    runIntakeAssist,
    enhanceNarrativeWithAI,
    analyseUploadedRegister
  };
})(window);
