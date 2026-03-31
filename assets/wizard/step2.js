function renderStep2TopEvidenceNudge(draft) {
  const missing = Array.isArray(draft.missingInformation)
    ? draft.missingInformation.filter(Boolean)
    : [];
  const confidence = String(draft.confidenceLabel || '').toLowerCase();
  if (!missing.length || /high/i.test(confidence)) return '';
  const topGap = String(missing[0]).trim();
  if (!topGap) return '';
  const isLow = /low/i.test(confidence);
  return `<div class="step2-evidence-nudge anim-fade-in${isLow ? ' step2-evidence-nudge--low' : ''}">
    <span class="step2-evidence-nudge__icon">${isLow ? '△' : '○'}</span>
    <span class="step2-evidence-nudge__text">
      <strong>The main thing that would improve this estimate:</strong> ${escapeHtml(topGap)}
    </span>
  </div>`;
}

const STEP2_SCENARIO_TYPE_OPTIONS = [
  'Strategic shift / programme failure',
  'Operational breakdown / control failure',
  'Regulatory breach / filing failure',
  'Financial control breakdown / fraud',
  'Compliance assurance gap',
  'Procurement governance / sourcing failure',
  'Supply chain disruption',
  'Business continuity / recovery failure',
  'HSE incident / environmental control breakdown',
  'Third-party dependency failure',
  'Ransomware',
  'Data Breach / Exfiltration',
  'Phishing / BEC',
  'Cloud Misconfiguration',
  'Insider Threat',
  'Identity / access compromise'
];

function normaliseStep2NarrativeForLearning(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isMeaningfulStep2NarrativeChange(before, after) {
  const prior = normaliseStep2NarrativeForLearning(before).toLowerCase();
  const next = normaliseStep2NarrativeForLearning(after).toLowerCase();
  if (!prior || !next || prior === next) return false;
  const priorTokens = Array.from(new Set(prior.split(/\s+/).filter(Boolean)));
  const nextTokens = Array.from(new Set(next.split(/\s+/).filter(Boolean)));
  const overlap = priorTokens.filter(token => nextTokens.includes(token)).length;
  const similarity = overlap / Math.max(priorTokens.length, nextTokens.length, 1);
  return similarity < 0.94 || Math.abs(next.length - prior.length) > 24;
}

function buildStep2NarrativeEditSummary(before, after) {
  const lensLabel = String(AppState.draft?.scenarioLens?.label || 'scenario').trim().toLowerCase();
  const beforeWords = normaliseStep2NarrativeForLearning(before).split(/\s+/).filter(Boolean).length;
  const afterWords = normaliseStep2NarrativeForLearning(after).split(/\s+/).filter(Boolean).length;
  if (afterWords > beforeWords + 6) return `Analyst expanded the ${lensLabel} narrative after AI structure support.`;
  if (afterWords < Math.max(6, beforeWords - 6)) return `Analyst tightened the ${lensLabel} narrative after AI structure support.`;
  return `Analyst materially rewrote the ${lensLabel} narrative after AI structure support.`;
}

function getStep2PriorMessages() {
  return Array.isArray(AppState?.draft?.llmContext) ? AppState.draft.llmContext : [];
}

function appendStep2LlmContext(userText, assistantText) {
  if (typeof dispatchDraftAction !== 'function') return;
  const user = String(userText || '').trim();
  const assistant = String(assistantText || '').trim();
  if (!user || !assistant) return;
  dispatchDraftAction('APPEND_LLM_CONTEXT', { user, assistant });
}

function buildWordDiff(before, after) {
  const bWords = (before || '').split(/(\s+)/);
  const aWords = (after || '').split(/(\s+)/);
  const bSet = new Set(bWords.filter(w => w.trim()));
  const aSet = new Set(aWords.filter(w => w.trim()));
  return aWords.map(word => {
    if (!word.trim()) return word;
    if (!bSet.has(word)) return `<ins class="diff-add">${escapeHtml(word)}</ins>`;
    return escapeHtml(word);
  }).join('') +
  bWords.filter(w => w.trim() && !aSet.has(w))
    .map(w => `<del class="diff-del">${escapeHtml(w)}</del>`).join(' ');
}

function buildWizard2TraceConfidenceBasis() {
  if (typeof buildEvidenceTrustSummary !== 'function') {
    return 'This is still a working estimate. Review the evidence and assumptions before relying on it.';
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
  return `${trust.confidenceLabel}${trust.evidenceQuality ? ` · ${trust.evidenceQuality}` : ''}. ${evidenceCount ? `This estimate was grounded in ${evidenceCount} cited or tracked basis item${evidenceCount === 1 ? '' : 's'}.` : 'This estimate is still relying mainly on working judgement and current context.'}`;
}

function getWizard2LatestTrace() {
  if (!LLMService || typeof LLMService.getLatestTrace !== 'function') return null;
  return [
    LLMService.getLatestTrace('Step 2 scenario analysis'),
    LLMService.getLatestTrace('Step 2 narrative refinement')
  ]
    .filter(Boolean)
    .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))[0] || null;
}

function bindWizard2AiTraceLink() {
  const output = document.getElementById('llm-output-area');
  const trace = getWizard2LatestTrace();
  if (!output || !trace || !UI || typeof UI.openAiTraceModal !== 'function') return;
  const link = output.querySelector('#btn-why-this-wizard2');
  link?.addEventListener('click', () => {
    UI.openAiTraceModal(trace, { confidenceBasis: buildWizard2TraceConfidenceBasis() });
  }, { once: true });
}

function ensureStep2NarrativeDiffStyles() {
  if (document.getElementById('step2-narrative-diff-styles')) return;
  const style = document.createElement('style');
  style.id = 'step2-narrative-diff-styles';
  style.textContent = `
    .narrative-diff-panel {
      background: #f8fafc; border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: var(--sp-4);
      margin-top: var(--sp-3); font-size: 14px; line-height: 1.7;
    }
    ins.diff-add {
      background: #dcfce7; color: #166534; text-decoration: none;
      border-radius: 2px; padding: 0 2px;
    }
    del.diff-del {
      background: #fee2e2; color: #991b1b;
      border-radius: 2px; padding: 0 2px;
    }
    .diff-legend { display:flex; gap:12px; margin-bottom:8px; font-size:12px; }
    .diff-add-legend::before { content:''; display:inline-block; width:10px;
      height:10px; background:#dcfce7; border-radius:2px; margin-right:4px; }
    .diff-del-legend::before { content:''; display:inline-block; width:10px;
      height:10px; background:#fee2e2; border-radius:2px; margin-right:4px; }
  `;
  document.head.appendChild(style);
}

function bindNarrativeDiffToggle() {
  const existingBtn = document.getElementById('btn-toggle-diff');
  const diffPanel = document.getElementById('narrative-diff-panel');
  const before = AppState.draft.sourceNarrative || '';
  const after = AppState.draft.enhancedNarrative || '';
  if (!existingBtn || !diffPanel) return;
  if (!before || !after || before === after) {
    existingBtn.style.display = 'none';
    existingBtn.textContent = 'Show what changed';
    diffPanel.classList.add('hidden');
    diffPanel.innerHTML = '';
    return;
  }
  const diffBtn = existingBtn.cloneNode(true);
  existingBtn.parentNode?.replaceChild(diffBtn, existingBtn);
  diffBtn.style.display = 'inline-flex';
  diffBtn.textContent = 'Show what changed';
  let diffVisible = false;
  diffBtn.addEventListener('click', () => {
    diffVisible = !diffVisible;
    diffBtn.textContent = diffVisible ? 'Hide changes' : 'Show what changed';
    if (diffVisible) {
      diffPanel.innerHTML = '<div class="diff-legend">' +
        '<span class="diff-add-legend">Added</span>' +
        '<span class="diff-del-legend">Removed</span>' +
        '</div><div class="diff-body">' + buildWordDiff(before, after) + '</div>';
      diffPanel.classList.remove('hidden');
    } else {
      diffPanel.classList.add('hidden');
    }
  });
}

function recordStep2NarrativeEditIfNeeded(nextNarrative) {
  const username = AuthService.getCurrentUser()?.username || '';
  if (!username || typeof LearningStore === 'undefined' || typeof LearningStore.recordNarrativeEdit !== 'function') return;
  if (!AppState.draft?.llmAssisted && !String(AppState.draft?.aiNarrativeBaseline || '').trim()) return;
  const before = normaliseStep2NarrativeForLearning(AppState.draft.aiNarrativeBaseline || '');
  const after = normaliseStep2NarrativeForLearning(nextNarrative);
  if (!isMeaningfulStep2NarrativeChange(before, after)) return;
  // Capture only material post-AI rewrites so the platform learns how analysts improve the structured draft over time.
  LearningStore.recordNarrativeEdit(username, {
    buId: AppState.draft?.buId || '',
    scenarioLens: AppState.draft?.scenarioLens || null,
    before,
    after,
    changeSummary: buildStep2NarrativeEditSummary(before, after)
  });
  AppState.draft.aiNarrativeBaseline = after;
}

function invalidateStep2AiAnalysisIfNeeded(nextNarrative) {
  if (!AppState.draft?.llmAssisted) return;
  const baseline = AppState.draft.aiNarrativeBaseline
    || AppState.draft.enhancedNarrative
    || AppState.draft.narrative
    || '';
  if (!isMeaningfulStep2NarrativeChange(baseline, nextNarrative)) return;
  AppState.draft.llmAssisted = false;
  AppState.draft.aiQualityState = 'analyst-reshaped';
  AppState.draft.scenarioLens = null;
  AppState.draft.confidenceLabel = '';
  AppState.draft.evidenceQuality = '';
  AppState.draft.evidenceSummary = '';
  AppState.draft.workflowGuidance = [];
  AppState.draft.benchmarkBasis = '';
  AppState.draft.recommendations = [];
  AppState.draft.primaryGrounding = [];
  AppState.draft.supportingReferences = [];
  AppState.draft.inferredAssumptions = [];
  AppState.draft.missingInformation = [];
  AppState.draft.inputProvenance = [];
  AppState.draft.inputRationale = null;
  AppState.draft.benchmarkReferences = [];
}

function renderWizard2() {
  const draft = AppState.draft;
  const structuredScenario = normaliseStructuredScenario(draft.structuredScenario, { preserveUnknown: true }) || {};
  const currentThreatType = getStructuredScenarioField(structuredScenario, 'eventPath');
  const threatTypeOptions = currentThreatType && !STEP2_SCENARIO_TYPE_OPTIONS.includes(currentThreatType)
    ? [currentThreatType, ...STEP2_SCENARIO_TYPE_OPTIONS]
    : STEP2_SCENARIO_TYPE_OPTIONS;
  const selectedRisks = getSelectedRisks();
  const scenarioGeographies = getScenarioGeographies();
  const scenarioQualityCoach = buildScenarioQualityCoach({
    draft,
    selectedRisks,
    scenarioGeographies,
    citations: draft.citations,
    evidenceQuality: draft.evidenceQuality,
    confidenceLabel: draft.confidenceLabel,
    inputProvenance: draft.inputProvenance,
    primaryGrounding: draft.primaryGrounding,
    supportingReferences: draft.supportingReferences,
    inferredAssumptions: draft.inferredAssumptions
  });
  const evidenceGapPlan = buildEvidenceGapActionPlan({
    confidenceLabel: draft.confidenceLabel,
    evidenceQuality: draft.evidenceQuality,
    missingInformation: draft.missingInformation,
    primaryGrounding: draft.primaryGrounding,
    supportingReferences: draft.supportingReferences,
    inputProvenance: draft.inputProvenance,
    inferredAssumptions: draft.inferredAssumptions,
    citations: draft.citations
  });
  const readinessModel = buildAssessmentReadinessModel({
    draft,
    selectedRisks,
    scenarioGeographies
  });
  const contextPreviewModel = buildContextInfluencePreviewModel({
    buId: draft.buId
  });
  setPage(`
    <main class="page">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(2)}
          <h2 class="wizard-step-title">Refine the Scenario</h2>
          <p class="wizard-step-desc">Tighten the scenario wording first, then open AI structure or optional fields only if they make the estimate cleaner and easier to challenge.</p>
          <div class="wizard-status-stack">
            <div class="form-help" data-draft-save-state>Draft saves automatically</div>
            ${renderPilotWarningBanner('ai', { compact: true })}
            ${renderStep2ReadinessBanner(draft, selectedRisks, scenarioGeographies)}
          </div>
        </div>
        <div class="wizard-body">
          <section class="wizard-ia-section anim-fade-in">
            <div class="results-section-heading">Clarify the scenario</div>
            <div class="form-help" style="margin-top:8px">Write one coherent scenario first. Keep the support modules below as optional aids rather than part of the main task.</div>
          </section>
          ${renderStep2FocusStrip(draft, selectedRisks, scenarioGeographies)}
          ${renderAssessmentReadinessStrip(readinessModel)}
          ${renderContextInfluencePreview(contextPreviewModel)}
          ${UI.wizardInputSection({
            title: 'Risk scenario narrative <span class="required">*</span>',
            description: 'This is the one required task on this step. Keep the wording to one coherent assessment scope so the estimate stays credible.',
            className: 'card anim-fade-in',
            headerExtras: UI.sectionStatusBadge('Required', 'gold'),
            body: `<div class="form-group"><textarea class="form-textarea" id="narrative" rows="5" placeholder="Describe the risk: What could happen? Who might cause it? What assets are at risk? What are the potential impacts?" style="min-height:160px">${draft.enhancedNarrative || draft.narrative || ''}</textarea><div id="narrative-diff-panel" class="narrative-diff-panel hidden" aria-live="polite"></div><button type="button" class="btn btn--ghost btn--sm" id="btn-toggle-diff" style="display:none;margin-top:8px">Show what changed</button></div>`
          })}
          ${renderStep2TopEvidenceNudge(draft)}
          ${UI.disclosureSection({
            title: 'Use AI to structure the scenario',
            badgeLabel: draft.llmAssisted ? 'Done' : 'Recommended',
            badgeTone: draft.llmAssisted ? 'neutral' : 'gold',
            open: !!(draft.enhancedNarrative || draft.narrative) && !draft.llmAssisted,
            className: 'wizard-disclosure card card--primary anim-fade-in anim-delay-2',
            body: `<div class="wizard-section-head">
              <div class="wizard-section-copy">
                <h3 class="wizard-section-title">${draft.llmAssisted ? 'AI has structured this scenario' : 'Let AI analyse and structure this scenario'}</h3>
                <p class="wizard-section-description">${draft.llmAssisted ? 'The FAIR inputs are pre-loaded for Step 3. Run again if you have changed the narrative significantly.' : 'AI will read the narrative, identify the most credible threat path, surface assumptions, and pre-load defensible FAIR starting ranges for Step 3. Your narrative stays editable.'}</p>
              </div>
              ${UI.sectionStatusBadge('Assistive only', 'neutral')}
            </div>
            <button class="btn btn--primary" id="btn-llm-assist" style="width:100%;justify-content:center;padding:14px;margin-top:var(--sp-4)">
              <span id="llm-btn-text">${draft.llmAssisted ? '🔄 Re-run AI analysis' : '🤖 Analyse scenario and pre-load FAIR inputs'}</span>
            </button>
            <p style="text-align:center;font-size:.75rem;color:var(--text-muted);margin-top:8px">Retrieves relevant internal docs and uses AI to suggest structured narrative improvements and FAIR inputs with citations.</p>
            <div class="form-help" id="wizard2-ai-status" style="text-align:center;margin-top:8px">${draft.llmAssisted ? 'AI has already analysed this scenario. Re-run if the narrative has changed significantly.' : 'AI reads the scenario, reasons about the threat path and assumptions, and pre-loads starting values for Step 3. Takes around 10–15 seconds.'}</div>`
          })}
          <div id="llm-output-area"></div>
          ${renderStep2WhyItMattersCard(draft, selectedRisks, scenarioGeographies)}
          ${renderStep2StructuredSummary(draft, selectedRisks, scenarioGeographies)}
          ${renderScenarioQualityCoach(scenarioQualityCoach, {
            title: 'Scenario quality coach',
            subtitle: scenarioQualityCoach.score < 80
              ? 'Use this to make one coherent, evidence-aware scenario before estimation.'
              : 'This is already estimate-ready. Tighten only the most material weak point if it would change the range.',
            compact: true,
            lowEmphasis: scenarioQualityCoach.score >= 80,
            disclosureTitle: 'Show full coaching detail',
            className: 'anim-fade-in'
          })}
          ${evidenceGapPlan.length ? renderEvidenceGapActionPlan(evidenceGapPlan, {
            title: 'What would strengthen this scenario next',
            subtitle: /low/i.test(String(draft.confidenceLabel || ''))
              ? 'Confidence is still low, so tightening one of these gaps would help before estimation.'
              : 'Keep this secondary. Use it only if one of these gaps would materially improve the estimate.',
            compact: true,
            lowEmphasis: !/low/i.test(String(draft.confidenceLabel || '')),
            disclosureTitle: 'Show full evidence plan',
            className: 'anim-fade-in'
          }) : ''}
          ${renderStep2QuantBridge(draft, selectedRisks, scenarioGeographies)}
          ${UI.disclosureSection({
            title: 'AI structure and evidence summary',
            badgeLabel: 'Optional detail',
            badgeTone: 'neutral',
            body: `${renderScenarioAssistSummaryBlock({
            workflowGuidance: draft.workflowGuidance,
            confidenceLabel: draft.confidenceLabel,
            evidenceQuality: draft.evidenceQuality,
            evidenceSummary: draft.evidenceSummary,
            missingInformation: draft.missingInformation,
            benchmarkBasis: draft.benchmarkBasis,
            inputProvenance: draft.inputProvenance,
            citations: draft.citations
          })}`,
            open: false
          })}
          <section class="wizard-ia-section anim-fade-in">
            <div class="results-section-heading">Open more structure only if needed</div>
            <div class="form-help" style="margin-top:8px">Use structured fields and AI structure support when they make the scenario cleaner or more challengeable.</div>
          </section>
          ${UI.disclosureSection({
            title: 'Optional structured fields',
            badgeLabel: 'Optional',
            badgeTone: 'neutral',
            open: false,
            className: 'wizard-disclosure card anim-fade-in anim-delay-1',
            body: `<div class="grid-2">
              <div class="form-group">
                <label class="form-label" for="asset-service">Asset / Service</label>
                <input class="form-input" id="asset-service" type="text" placeholder="e.g. Payment gateway" value="${escapeHtml(getStructuredScenarioField(structuredScenario, 'assetService'))}">
              </div>
              <div class="form-group">
                <label class="form-label" for="threat-type">Event path</label>
                <select class="form-select" id="threat-type">
                  <option value="">— Select —</option>
                  ${threatTypeOptions.map((t) => `<option value="${escapeHtml(t)}"${currentThreatType === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                </select>
              </div>
            </div>`
          })}
        </div>
        <div class="wizard-footer">
          <button class="btn btn--ghost" id="btn-back-2">← Back</button>
          <button class="btn btn--primary" id="btn-next-2">Continue to estimation →</button>
        </div>
      </div>
    </main>`);

  document.getElementById('btn-back-2').addEventListener('click', () => { saveDraft(); Router.navigate('/wizard/1'); });
  document.getElementById('narrative').addEventListener('input', function() {
    invalidateStep2AiAnalysisIfNeeded(this.value);
    AppState.draft.enhancedNarrative = this.value;
    if (!AppState.draft.narrative) AppState.draft.narrative = this.value;
    markDraftDirty();
    scheduleDraftAutosave();
  });
  document.getElementById('narrative').addEventListener('blur', function() {
    recordStep2NarrativeEditIfNeeded(this.value);
  });
  document.getElementById('asset-service')?.addEventListener('input', function() {
    const next = { ...(AppState.draft.structuredScenario || {}) };
    next.assetService = this.value;
    AppState.draft.structuredScenario = normaliseStructuredScenario(next, { preserveUnknown: true });
    markDraftDirty();
    scheduleDraftAutosave();
  });
  document.getElementById('threat-type')?.addEventListener('change', function() {
    const next = { ...(AppState.draft.structuredScenario || {}) };
    next.eventPath = this.value;
    AppState.draft.structuredScenario = normaliseStructuredScenario(next, { preserveUnknown: true });
    markDraftDirty();
    scheduleDraftAutosave();
  });
  document.getElementById('btn-llm-assist').addEventListener('click', runLLMAssist);
  updateWizardSaveState();
  document.getElementById('btn-next-2').addEventListener('click', () => {
    const n = document.getElementById('narrative').value.trim();
    if (!n) { UI.toast('Please enter a risk narrative.', 'warning'); return; }
    invalidateStep2AiAnalysisIfNeeded(n);
    recordStep2NarrativeEditIfNeeded(n);
    AppState.draft.enhancedNarrative = n;
    AppState.draft.narrative = AppState.draft.narrative || n;
    saveDraft(); Router.navigate('/wizard/3');
  });
  ensureStep2NarrativeDiffStyles();
  bindNarrativeDiffToggle();
  attachCitationHandlers();
}

function getStep2NarrativeReadiness(draft, selectedRisks, scenarioGeographies) {
  const coach = buildScenarioQualityCoach({
    draft,
    selectedRisks,
    scenarioGeographies,
    citations: draft.citations,
    evidenceQuality: draft.evidenceQuality,
    confidenceLabel: draft.confidenceLabel,
    inputProvenance: draft.inputProvenance,
    primaryGrounding: draft.primaryGrounding,
    supportingReferences: draft.supportingReferences,
    inferredAssumptions: draft.inferredAssumptions
  });
  const warnings = [];
  if (!String(draft.enhancedNarrative || draft.narrative || '').trim()) {
    warnings.push('The scenario still needs a plain-English narrative before it can flow cleanly into the estimate step.');
  }
  if (Array.isArray(coach?.suggestions)) {
    coach.suggestions.forEach(item => {
      if (warnings.length >= 4) return;
      if (item?.action) warnings.push(item.action);
    });
  }
  return Array.from(new Set(warnings));
}

function renderStep2FocusStrip(draft, selectedRisks, scenarioGeographies) {
  const warnings = getStep2NarrativeReadiness(draft, selectedRisks, scenarioGeographies);
  const narrative = String(draft.enhancedNarrative || draft.narrative || '').trim();
  return `<div class="wizard-focus-strip anim-fade-in">
    <div class="wizard-focus-card wizard-focus-card--wide">
      <span class="wizard-focus-card__label">Step goal</span>
      <strong>Turn the shortlisted risk into one coherent scenario that can be estimated cleanly.</strong>
      <span>${warnings.length ? escapeHtml(warnings[0]) : 'If the wording is coherent and scoped, continue. The next step is about defensible ranges, not perfect numbers.'}</span>
    </div>
    <div class="wizard-focus-card">
      <span class="wizard-focus-card__label">Readiness signal</span>
      <strong>${narrative ? `${narrative.split(/\s+/).filter(Boolean).length} words drafted` : 'Narrative still thin'}</strong>
      <span>${selectedRisks.length ? `${selectedRisks.length} risk${selectedRisks.length === 1 ? '' : 's'} in scope` : 'No scoped risks selected yet'}</span>
    </div>
  </div>`;
}

function renderStep2ReadinessBanner(draft, selectedRisks, scenarioGeographies) {
  const warnings = getStep2NarrativeReadiness(draft, selectedRisks, scenarioGeographies);
  if (!warnings.length) return '';
  return renderPilotWarningBanner('lowConfidence', {
    compact: true,
    text: warnings[0]
  });
}

function inferStep2CostFocus(draft) {
  const text = [
    draft.enhancedNarrative,
    draft.narrative,
    getStructuredScenarioField(draft.structuredScenario, 'eventPath'),
    getStructuredScenarioField(draft.structuredScenario, 'assetService'),
    ...(getSelectedRisks().map(risk => risk.title || ''))
  ].join(' ').toLowerCase();
  const focus = [];
  if (/(outage|disrupt|recovery|continuity|resilien|availability)/.test(text)) focus.push('Business disruption and response cost will likely matter most.');
  if (/(breach|privacy|data|exfiltrat|notification|pii|phi)/.test(text)) focus.push('Data remediation and regulatory cost look more material here.');
  if (/(supplier|third.?party|contract|customer|partner)/.test(text)) focus.push('Third-party, contractual, or reputation impacts may matter more than a pure technology-only view.');
  if (/(identity|privileged|admin|fraud|payment)/.test(text)) focus.push('Fraud, response, and control-strength assumptions are likely to move the result most.');
  return focus.length ? focus.slice(0, 2) : ['Start with frequency, attacker strength, control strength, and the biggest cost rows first.'];
}

function renderStep2QuantBridge(draft, selectedRisks, scenarioGeographies) {
  const warnings = getStep2NarrativeReadiness(draft, selectedRisks, scenarioGeographies);
  const structured = normaliseStructuredScenario(draft.structuredScenario, { preserveUnknown: true }) || {};
  const costFocus = inferStep2CostFocus(draft);
  const scopeChips = [
    structured.assetService ? `Asset / service: ${structured.assetService}` : '',
    structured.eventPath ? `Event path: ${structured.eventPath}` : '',
    scenarioGeographies.length ? `Geography: ${scenarioGeographies.join(', ')}` : '',
    Array.isArray(draft.applicableRegulations) && draft.applicableRegulations.length ? `Regulations: ${draft.applicableRegulations.slice(0, 3).join(', ')}` : ''
  ].filter(Boolean);
  return `<div class="card card--background anim-fade-in">
    <div class="context-panel-title">What will carry into the estimate</div>
    <div class="context-grid" style="margin-top:var(--sp-4)">
      <div class="context-chip-panel">
        <div class="context-panel-title">Scope</div>
        <p class="context-panel-copy">${selectedRisks.length ? `${selectedRisks.length} selected risk${selectedRisks.length === 1 ? '' : 's'} will move forward as one assessment scope.` : 'The estimate step works best once at least one risk is clearly in scope.'}</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">What you will estimate next</div>
        <p class="context-panel-copy">The next step turns this narrative into frequency, exposure, and cost ranges. You do not need precise numbers yet.</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Likely focus areas</div>
        <p class="context-panel-copy">${escapeHtml(costFocus.join(' '))}</p>
      </div>
    </div>
    ${scopeChips.length ? `<div class="citation-chips" style="margin-top:var(--sp-4)">${scopeChips.map(item => `<span class="badge badge--neutral">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
    <div class="context-panel-foot" style="margin-top:var(--sp-4)">${warnings.length ? `Tighten this before continuing: ${escapeHtml(warnings[0])}` : 'If the wording is broadly right, continue. You can still challenge the AI numbers and edit the scenario later.'}</div>
  </div>`;
}

function renderStep2WhyItMattersCard(draft, selectedRisks, scenarioGeographies) {
  const warnings = getStep2NarrativeReadiness(draft, selectedRisks, scenarioGeographies);
  return `<div class="card card--background anim-fade-in">
    <div class="wizard-premium-head">
      <div>
        <div class="context-panel-title">Why this step improves the estimate</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">A cleaner scenario produces better starting assumptions. This step is where you remove ambiguity before the model turns the narrative into ranges.</p>
      </div>
      <span class="badge badge--neutral">Quality gate</span>
    </div>
    <div class="wizard-focus-strip wizard-focus-strip--compact" style="margin-top:var(--sp-4)">
      <div class="wizard-focus-card">
        <span class="wizard-focus-card__label">Clarify the event</span>
        <strong>One scenario, not a bundle of issues</strong>
        <span>Keep one coherent event path so the next-step numbers mean something.</span>
      </div>
      <div class="wizard-focus-card">
        <span class="wizard-focus-card__label">Expose weak spots</span>
        <strong>Assumptions become visible</strong>
        <span>Missing information and evidence gaps are easier to challenge before you estimate.</span>
      </div>
      <div class="wizard-focus-card">
        <span class="wizard-focus-card__label">Set up the quant step</span>
        <strong>Better starting assumptions, less rework</strong>
        <span>${escapeHtml(warnings[0] || 'If the scenario wording is coherent, the estimate step becomes faster and more defensible.')}</span>
      </div>
    </div>
  </div>`;
}

function renderStep2StructuredSummary(draft, selectedRisks, scenarioGeographies) {
  const structured = normaliseStructuredScenario(draft.structuredScenario, { preserveUnknown: true }) || {};
  const assumptions = Array.isArray(draft.inferredAssumptions) ? draft.inferredAssumptions.filter(Boolean).slice(0, 2) : [];
  const missing = Array.isArray(draft.missingInformation) ? draft.missingInformation.filter(Boolean).slice(0, 2) : [];
  const sourceBasis = normaliseCitations(draft.citations || []).slice(0, 2);
  const chips = [
    structured.assetService ? `Asset / service: ${structured.assetService}` : '',
    structured.eventPath ? `Event path: ${structured.eventPath}` : '',
    selectedRisks.length ? `In scope: ${selectedRisks.length} risk${selectedRisks.length === 1 ? '' : 's'}` : '',
    scenarioGeographies.length ? `Geography: ${scenarioGeographies.join(', ')}` : ''
  ].filter(Boolean);
  return `<div class="card card--background anim-fade-in">
    <div class="wizard-premium-head">
      <div>
        <div class="context-panel-title">Scenario structure at a glance</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">Use this summary to check whether the scenario is grounded, what still looks assumed, and what evidence would improve the estimate.</p>
      </div>
      <span class="badge badge--gold">Review before quant</span>
    </div>
    ${chips.length ? `<div class="citation-chips" style="margin-top:var(--sp-4)">${chips.map(item => `<span class="badge badge--neutral">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
    <div class="context-grid" style="margin-top:var(--sp-4)">
      <div class="context-chip-panel">
        <div class="context-panel-title">Main assumptions</div>
        <p class="context-panel-copy">${escapeHtml(assumptions[0] || 'No major assumptions have been captured yet. If something feels implied but not stated, add it now.')}</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Best evidence gap</div>
        <p class="context-panel-copy">${escapeHtml(missing[0] || 'No obvious evidence gap is blocking the estimate yet.')}</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Source basis</div>
        <p class="context-panel-copy">${escapeHtml(sourceBasis[0]?.title || 'No named source is attached yet. AI can still help, but a stronger source basis improves confidence.')}</p>
      </div>
    </div>
  </div>`;
}



function _normaliseSuggestedRange(value, fallbackRange = {}) {
  const min = Number(value?.min ?? fallbackRange?.min ?? 0);
  const likely = Number(value?.likely ?? fallbackRange?.likely ?? min);
  const max = Number(value?.max ?? fallbackRange?.max ?? likely);
  const ordered = [min, likely, max].sort((a, b) => a - b);
  return { min: ordered[0], likely: ordered[1], max: ordered[2] };
}

function _buildAiInputAssignments(result, benchmarkCandidates = [], citations = []) {
  const references = Array.isArray(result?.benchmarkReferences) && result.benchmarkReferences.length
    ? result.benchmarkReferences
    : BenchmarkService.buildReferenceList(benchmarkCandidates || []);
  const topReference = references[0] || null;
  const hasInternalDocs = Array.isArray(citations) && citations.length > 0;
  const baseOrigin = topReference ? 'Benchmark-seeded AI estimate' : 'AI estimate';
  const sourceTypeLabel = topReference?.sourceTypeLabel || (hasInternalDocs ? 'Internal document support' : 'Model inference');
  const confidenceLabel = result?.confidenceLabel || topReference?.confidenceLabel || 'Moderate confidence';
  const freshnessLabel = topReference?.freshnessLabel || '';
  const sourceTitle = topReference?.sourceTitle || topReference?.title || (hasInternalDocs ? 'Internal source set' : 'No named benchmark source');
  const supporting = [];
  if (topReference) supporting.push('Benchmark');
  if (hasInternalDocs) supporting.push('Internal documents');
  supporting.push('AI reasoning');
  const supportText = supporting.join(' + ');
  return [
    { id: 'event-frequency', label: 'Event frequency', origin: baseOrigin, scope: topReference?.scope || 'scenario', sourceTypeLabel, confidenceLabel, freshnessLabel, sourceTitle, reason: `Primary source: ${supportText}. The event-frequency range was normalised before it was written into the FAIR inputs.` },
    { id: 'threat-capability', label: 'Threat capability', origin: 'AI estimate', scope: topReference?.scope || 'scenario', sourceTypeLabel, confidenceLabel, freshnessLabel, sourceTitle, reason: `Primary source: ${supportText}. Threat capability was inferred from the scenario path and the retrieved evidence.` },
    { id: 'control-strength', label: 'Control strength', origin: 'AI estimate', scope: topReference?.scope || 'scenario', sourceTypeLabel, confidenceLabel, freshnessLabel, sourceTitle, reason: `Primary source: ${supportText}. Control strength was estimated from current context and should be challenged against real control evidence.` },
    { id: 'incident-response', label: 'Incident response cost', origin: baseOrigin, scope: topReference?.scope || 'scenario', sourceTypeLabel, confidenceLabel, freshnessLabel, sourceTitle, reason: `Primary source: ${supportText}. This range was seeded before user edits using the closest benchmark and retrieved context.` },
    { id: 'business-interruption', label: 'Business interruption cost', origin: baseOrigin, scope: topReference?.scope || 'scenario', sourceTypeLabel, confidenceLabel, freshnessLabel, sourceTitle, reason: `Primary source: ${supportText}. This range was seeded before user edits using the closest benchmark and retrieved context.` },
    { id: 'regulatory-legal', label: 'Regulatory and legal cost', origin: baseOrigin, scope: topReference?.scope || 'scenario', sourceTypeLabel, confidenceLabel, freshnessLabel, sourceTitle, reason: `Primary source: ${supportText}. This range was seeded before user edits using the closest benchmark and retrieved context.` }
  ];
}

function _buildAiFairInputPayload(result, benchmarkCandidates = [], citations = []) {
  const currentFair = AppState.draft.fairParams || {};
  const bu = getBUList().find(candidate => candidate.id === AppState.draft.buId);
  const defaults = bu?.defaultAssumptions || {};
  const suggested = result?.suggestedInputs || {};
  const lossComponents = suggested.lossComponents || {};
  const fallbackRange = (prefix, defaultRange) => ({
    min: Number(currentFair[`${prefix}Min`] ?? defaultRange?.min ?? 0),
    likely: Number(currentFair[`${prefix}Likely`] ?? defaultRange?.likely ?? defaultRange?.min ?? 0),
    max: Number(currentFair[`${prefix}Max`] ?? defaultRange?.max ?? defaultRange?.likely ?? defaultRange?.min ?? 0)
  });
  const fairParams = {
    ...currentFair,
    tefMin: _normaliseSuggestedRange(suggested.TEF, fallbackRange('tef', defaults.TEF || { min: 0.5, likely: 2, max: 8 })).min,
    tefLikely: _normaliseSuggestedRange(suggested.TEF, fallbackRange('tef', defaults.TEF || { min: 0.5, likely: 2, max: 8 })).likely,
    tefMax: _normaliseSuggestedRange(suggested.TEF, fallbackRange('tef', defaults.TEF || { min: 0.5, likely: 2, max: 8 })).max,
    controlStrMin: _normaliseSuggestedRange(suggested.controlStrength, fallbackRange('controlStr', defaults.controlStrength || { min: 0.5, likely: 0.68, max: 0.85 })).min,
    controlStrLikely: _normaliseSuggestedRange(suggested.controlStrength, fallbackRange('controlStr', defaults.controlStrength || { min: 0.5, likely: 0.68, max: 0.85 })).likely,
    controlStrMax: _normaliseSuggestedRange(suggested.controlStrength, fallbackRange('controlStr', defaults.controlStrength || { min: 0.5, likely: 0.68, max: 0.85 })).max,
    threatCapMin: _normaliseSuggestedRange(suggested.threatCapability, fallbackRange('threatCap', defaults.threatCapability || { min: 0.45, likely: 0.62, max: 0.82 })).min,
    threatCapLikely: _normaliseSuggestedRange(suggested.threatCapability, fallbackRange('threatCap', defaults.threatCapability || { min: 0.45, likely: 0.62, max: 0.82 })).likely,
    threatCapMax: _normaliseSuggestedRange(suggested.threatCapability, fallbackRange('threatCap', defaults.threatCapability || { min: 0.45, likely: 0.62, max: 0.82 })).max,
    irMin: _normaliseSuggestedRange(lossComponents.incidentResponse, fallbackRange('ir', defaults.incidentResponse || { min: 50000, likely: 180000, max: 600000 })).min,
    irLikely: _normaliseSuggestedRange(lossComponents.incidentResponse, fallbackRange('ir', defaults.incidentResponse || { min: 50000, likely: 180000, max: 600000 })).likely,
    irMax: _normaliseSuggestedRange(lossComponents.incidentResponse, fallbackRange('ir', defaults.incidentResponse || { min: 50000, likely: 180000, max: 600000 })).max,
    biMin: _normaliseSuggestedRange(lossComponents.businessInterruption, fallbackRange('bi', defaults.businessInterruption || { min: 100000, likely: 450000, max: 2500000 })).min,
    biLikely: _normaliseSuggestedRange(lossComponents.businessInterruption, fallbackRange('bi', defaults.businessInterruption || { min: 100000, likely: 450000, max: 2500000 })).likely,
    biMax: _normaliseSuggestedRange(lossComponents.businessInterruption, fallbackRange('bi', defaults.businessInterruption || { min: 100000, likely: 450000, max: 2500000 })).max,
    dbMin: _normaliseSuggestedRange(lossComponents.dataBreachRemediation, fallbackRange('db', defaults.dataBreachRemediation || { min: 30000, likely: 120000, max: 500000 })).min,
    dbLikely: _normaliseSuggestedRange(lossComponents.dataBreachRemediation, fallbackRange('db', defaults.dataBreachRemediation || { min: 30000, likely: 120000, max: 500000 })).likely,
    dbMax: _normaliseSuggestedRange(lossComponents.dataBreachRemediation, fallbackRange('db', defaults.dataBreachRemediation || { min: 30000, likely: 120000, max: 500000 })).max,
    rlMin: _normaliseSuggestedRange(lossComponents.regulatoryLegal, fallbackRange('rl', defaults.regulatoryLegal || { min: 0, likely: 80000, max: 800000 })).min,
    rlLikely: _normaliseSuggestedRange(lossComponents.regulatoryLegal, fallbackRange('rl', defaults.regulatoryLegal || { min: 0, likely: 80000, max: 800000 })).likely,
    rlMax: _normaliseSuggestedRange(lossComponents.regulatoryLegal, fallbackRange('rl', defaults.regulatoryLegal || { min: 0, likely: 80000, max: 800000 })).max,
    tpMin: _normaliseSuggestedRange(lossComponents.thirdPartyLiability, fallbackRange('tp', defaults.thirdPartyLiability || { min: 0, likely: 50000, max: 400000 })).min,
    tpLikely: _normaliseSuggestedRange(lossComponents.thirdPartyLiability, fallbackRange('tp', defaults.thirdPartyLiability || { min: 0, likely: 50000, max: 400000 })).likely,
    tpMax: _normaliseSuggestedRange(lossComponents.thirdPartyLiability, fallbackRange('tp', defaults.thirdPartyLiability || { min: 0, likely: 50000, max: 400000 })).max,
    rcMin: _normaliseSuggestedRange(lossComponents.reputationContract, fallbackRange('rc', defaults.reputationContract || { min: 50000, likely: 200000, max: 1200000 })).min,
    rcLikely: _normaliseSuggestedRange(lossComponents.reputationContract, fallbackRange('rc', defaults.reputationContract || { min: 50000, likely: 200000, max: 1200000 })).likely,
    rcMax: _normaliseSuggestedRange(lossComponents.reputationContract, fallbackRange('rc', defaults.reputationContract || { min: 50000, likely: 200000, max: 1200000 })).max
  };
  const inputAssignments = _buildAiInputAssignments(result, benchmarkCandidates, citations);
  const keyOrigins = {
    tefMin: 'ai', tefLikely: 'ai', tefMax: 'ai',
    controlStrMin: 'ai', controlStrLikely: 'ai', controlStrMax: 'ai',
    threatCapMin: 'ai', threatCapLikely: 'ai', threatCapMax: 'ai',
    irMin: 'ai', irLikely: 'ai', irMax: 'ai',
    biMin: 'ai', biLikely: 'ai', biMax: 'ai',
    dbMin: 'ai', dbLikely: 'ai', dbMax: 'ai',
    rlMin: 'ai', rlLikely: 'ai', rlMax: 'ai',
    tpMin: 'ai', tpLikely: 'ai', tpMax: 'ai',
    rcMin: 'ai', rcLikely: 'ai', rcMax: 'ai'
  };
  return { fairParams, inputAssignments, keyOrigins };
}

function renderWizard2AnalystReasoning(draft, result) {
  const tef = String(result?.inputRationale?.tef || draft?.inputRationale?.tef || '').trim();
  const vulnerability = String(result?.inputRationale?.vulnerability || draft?.inputRationale?.vulnerability || '').trim();
  const topGuidance = (result?.workflowGuidance?.[0] || draft?.workflowGuidance?.[0] || '').trim();
  const confidence = String(result?.confidenceLabel || draft?.confidenceLabel || 'Moderate confidence').trim();
  const evidenceQuality = String(result?.evidenceQuality || draft?.evidenceQuality || '').trim();

  if (!tef && !vulnerability && !topGuidance) return '';

  const confidenceTone = /high/i.test(confidence) ? 'gold' : /low/i.test(confidence) ? 'danger' : 'neutral';

  return `<div class="card card--elevated mt-4 anim-fade-in">
    <div class="wizard-premium-head" style="margin-bottom:var(--sp-4)">
      <div>
        <div class="context-panel-title">Analyst reasoning</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">Why AI produced these starting values — challenge anything that does not match what you know.</p>
      </div>
      <span class="badge badge--${confidenceTone}">${escapeHtml(confidence)}${evidenceQuality ? ' · ' + escapeHtml(evidenceQuality) : ''}</span>
    </div>
    <div class="context-grid">
      ${tef ? `<div class="context-chip-panel">
        <div class="context-panel-title">Why this frequency</div>
        <p class="context-panel-copy">${escapeHtml(tef)}</p>
      </div>` : ''}
      ${vulnerability ? `<div class="context-chip-panel">
        <div class="context-panel-title">Why this control and threat balance</div>
        <p class="context-panel-copy">${escapeHtml(vulnerability)}</p>
      </div>` : ''}
      ${topGuidance ? `<div class="context-chip-panel">
        <div class="context-panel-title">Most important next step</div>
        <p class="context-panel-copy">${escapeHtml(topGuidance)}</p>
      </div>` : ''}
    </div>
  </div>`;
}

function renderWizard2AiChangeSummary(result, previousNarrative) {
  const changed = [];
  if (result?.scenarioTitle) changed.push(`Gave the scenario a clearer working title: <strong>${escapeHtml(result.scenarioTitle)}</strong>.`);
  const structuredCount = countStructuredScenarioFields(result?.structuredScenario, ['primaryDriver', 'eventPath', 'assetService']);
  if (structuredCount) changed.push(`Filled ${structuredCount} structured scenario field${structuredCount === 1 ? '' : 's'} to make the scope easier to quantify.`);
  const hasInputs = !!result?.suggestedInputs;
  if (hasInputs) changed.push('Pre-loaded the FAIR starting ranges for the next step so you can challenge them instead of entering everything from scratch.');
  const citationCount = Array.isArray(result?.citations) ? result.citations.length : 0;
  if (citationCount) changed.push(`Attached ${citationCount} supporting reference${citationCount === 1 ? '' : 's'} for grounding and challenge.`);
  const summaryItems = changed.length ? changed : ['Prepared a structured starting point without changing your saved scenario wording.'];
  const wordingNote = String(previousNarrative || '').trim()
    ? '<div class="form-help" style="margin-top:10px">Your own narrative remains editable below. Keep it, edit it, or rerun AI if the structure still feels off.</div>'
    : '';
  return `<div class="card card--elevated mt-4 anim-fade-in"><div class="context-panel-title">What AI changed</div><ol style="margin:12px 0 0 18px;display:flex;flex-direction:column;gap:8px">${summaryItems.map(item => `<li style="color:var(--text-secondary)">${item}</li>`).join('')}</ol>${wordingNote}</div>`;
}

function clearWizard2AiUnavailableBanner() {
  document.querySelectorAll('.ai-unavailable-banner').forEach(node => node.remove());
}

function renderWizard2AiUnavailableBanner(retryHandler) {
  clearWizard2AiUnavailableBanner();
  const output = document.getElementById('llm-output-area');
  if (!output) return;
  output.innerHTML = `<div class="ai-unavailable-banner banner banner--warning mt-4" role="alert"><span class="banner-icon">△</span><span class="banner-text">AI assistance is temporarily unavailable. You can continue manually or <button class="link-btn" id="btn-retry-ai" type="button" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">try again</button>.</span></div>`;
  output.querySelector('#btn-retry-ai')?.addEventListener('click', event => {
    event.preventDefault();
    retryHandler();
  });
}

async function runLLMAssist() {
  clearWizard2AiUnavailableBanner();
  let narrative = document.getElementById('narrative').value.trim();
  if (!narrative) { UI.toast('Please enter a narrative first.', 'warning'); return; }
  const assistSeed = getScenarioAssistSeedNarrative(narrative);
  const btn = document.getElementById('btn-llm-assist');
  const btnText = document.getElementById('llm-btn-text');
  const output = document.getElementById('llm-output-area');
  const status = document.getElementById('wizard2-ai-status');
  const previousNarrative = AppState.draft.enhancedNarrative || AppState.draft.narrative || narrative;
  btn.disabled = true; btn.classList.add('loading');
  btnText.textContent = '⏳ Retrieving docs and generating inputs…';
  if (status) status.textContent = 'AI is building a suggested draft and loading starting values for the next step.';
  output.innerHTML = `<div class="mt-4">${UI.wizardAssistSkeleton()}</div>`;
  try {
    const bu = getBUList().find(b => b.id === AppState.draft.buId);
    const aiContext = buildCurrentAIAssistContext({ buId: AppState.draft.buId });
    const scenarioText = buildScenarioNarrative(assistSeed);
    const citations = await RAGService.retrieveRelevantDocs(AppState.draft.buId, buildAssessmentRetrievalQuery({
      narrative: scenarioText,
      guidedInput: AppState.draft.guidedInput,
      structuredScenario: AppState.draft.structuredScenario,
      scenarioLens: AppState.draft.scenarioLens,
      selectedRiskTitles: getSelectedRisks().map(risk => risk.title),
      applicableRegulations: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
      geography: formatScenarioGeographies(getScenarioGeographies()),
      businessUnitName: aiContext.businessUnit?.name || bu?.name || AppState.draft.buName || ''
    }));
    const benchmarkCandidates = BenchmarkService.retrieveRelevantBenchmarks({
      query: scenarioText,
      geography: formatScenarioGeographies(getScenarioGeographies()),
      businessUnit: aiContext.businessUnit || bu || null,
      topK: 3
    });
    let streamStarted = false;
    const result = await LLMService.streamNarrativeRefinement({
      narrative: scenarioText,
      buContext: {
        ...(aiContext.businessUnit || bu || {}),
        scenarioLensHint: AppState.draft.scenarioLens,
        regulatoryTags: deriveApplicableRegulations(aiContext.businessUnit || bu, getSelectedRisks(), getScenarioGeographies()),
        geography: formatScenarioGeographies(getScenarioGeographies()),
        benchmarkStrategy: aiContext.adminSettings.benchmarkStrategy,
        companyContextProfile: aiContext.adminSettings.companyContextProfile,
        companyStructureContext: aiContext.adminSettings.companyStructureContext,
        userProfileSummary: aiContext.adminSettings.userProfileSummary,
        selectedDepartmentContext: aiContext.adminSettings.departmentContext
      },
      retrievedDocs: citations,
      benchmarkCandidates
    }, (text) => {
      const el = document.getElementById('scenario-narrative') || document.getElementById('narrative');
      if (el) {
        if (!streamStarted) {
          el.value = '';
          streamStarted = true;
        }
        el.value = (el.value || '') + text;
      }
    }, {
      priorMessages: getStep2PriorMessages(),
      traceLabel: 'Step 2 narrative refinement',
      traceResultLabel: 'Step 2 scenario analysis'
    });
    narrative = document.getElementById('scenario-narrative')?.value.trim()
      || document.getElementById('narrative')?.value.trim()
      || narrative;
    AppState.draft.scenarioTitle = result.scenarioTitle;
    AppState.draft.scenarioLens = result?.scenarioLens && typeof result.scenarioLens === 'object'
      ? { ...result.scenarioLens }
      : (AppState.draft.scenarioLens || null);
    AppState.draft.structuredScenario = normaliseStructuredScenario(result.structuredScenario, { preserveUnknown: true });
    AppState.draft.llmAssisted = true;
    AppState.draft.aiQualityState = result.usedFallback ? 'fallback' : 'ai';
    AppState.draft.enhancedNarrative = narrative;
    AppState.draft.citations = normaliseCitations(result.citations || citations);
    AppState.draft.recommendations = result.recommendations || [];
    AppState.draft.workflowGuidance = Array.isArray(result.workflowGuidance) ? result.workflowGuidance : AppState.draft.workflowGuidance;
    AppState.draft.benchmarkBasis = result.benchmarkBasis || AppState.draft.benchmarkBasis;
    AppState.draft.confidenceLabel = result.confidenceLabel || AppState.draft.confidenceLabel || '';
    AppState.draft.evidenceQuality = result.evidenceQuality || AppState.draft.evidenceQuality || '';
    AppState.draft.evidenceSummary = result.evidenceSummary || AppState.draft.evidenceSummary || '';
    AppState.draft.primaryGrounding = Array.isArray(result.primaryGrounding) ? result.primaryGrounding : (AppState.draft.primaryGrounding || []);
    AppState.draft.supportingReferences = Array.isArray(result.supportingReferences) ? result.supportingReferences : (AppState.draft.supportingReferences || []);
    AppState.draft.inferredAssumptions = Array.isArray(result.inferredAssumptions) ? result.inferredAssumptions : (AppState.draft.inferredAssumptions || []);
    AppState.draft.missingInformation = Array.isArray(result.missingInformation) ? result.missingInformation : (AppState.draft.missingInformation || []);
    AppState.draft.aiNarrativeBaseline = narrative;
    AppState.draft.inputRationale = result.inputRationale || AppState.draft.inputRationale;
    AppState.draft.benchmarkReferences = Array.isArray(result.benchmarkReferences) ? result.benchmarkReferences : (AppState.draft.benchmarkReferences || []);
    AppState.draft.inputProvenance = Array.isArray(result.inputProvenance) ? result.inputProvenance : (AppState.draft.inputProvenance || []);
    appendStep2LlmContext(scenarioText, result.draftNarrative || result.enhancedStatement || narrative);
    const s = result.suggestedInputs;
    if (s) {
      const aiPayload = _buildAiFairInputPayload(result, benchmarkCandidates, AppState.draft.citations);
      AppState.draft.fairParams = aiPayload.fairParams;
      AppState.draft.aiSuggestedFairParams = JSON.parse(JSON.stringify(aiPayload.fairParams));
      AppState.draft.orgCalibrationApplied = false;
      AppState.draft.orgCalibrationInfo = null;
      AppState.draft.inputAssignments = aiPayload.inputAssignments;
      AppState.draft.fairParamOrigins = {
        ...(AppState.draft.fairParamOrigins || {}),
        ...aiPayload.keyOrigins
      };
    }
    bindNarrativeDiffToggle();
    saveDraft();
    const aiStatusBanner = typeof renderAIStatusBanner === 'function' ? renderAIStatusBanner() : '';
    const wizard2Trace = getWizard2LatestTrace();
    output.innerHTML = `${aiStatusBanner}${renderWizard2AiChangeSummary(result, previousNarrative)}${renderWizard2AnalystReasoning(AppState.draft, result)}<div class="card card--glow mt-4 anim-fade-in">
      <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-3);flex-wrap:wrap">
        <span class="badge badge--${/high/i.test(result.confidenceLabel || '') ? 'gold' : /low/i.test(result.confidenceLabel || '') ? 'danger' : 'neutral'}" style="font-size:.8rem">${escapeHtml(result.confidenceLabel || 'Moderate confidence')}${result.evidenceQuality ? ' · ' + escapeHtml(result.evidenceQuality) : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4)">
        <span style="font-size:24px">✅</span>
        <div>
          <div style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;color:var(--text-primary)">${escapeHtml(String(result.scenarioTitle || 'Scenario ready'))}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">AI-structured · FAIR inputs pre-loaded to Step 3</div>
        </div>
      </div>
      ${result.structuredScenario?`<div class="grid-2"><div><div class="form-label" style="font-size:.7rem">Primary driver</div><p style="font-size:.85rem;margin-top:4px">${escapeHtml(getStructuredScenarioField(result.structuredScenario, 'primaryDriver') || 'Not specified')}</p></div><div><div class="form-label" style="font-size:.7rem">Event path</div><p style="font-size:.85rem;margin-top:4px">${escapeHtml(getStructuredScenarioField(result.structuredScenario, 'eventPath') || 'Not specified')}</p></div></div>`:''}
    </div>${wizard2Trace ? `<div class="form-help" style="margin-top:var(--sp-3)"><button type="button" class="link-btn" id="btn-why-this-wizard2" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Why this?</button></div>` : ''}${renderScenarioAssistSummaryBlock({
      workflowGuidance: AppState.draft.workflowGuidance,
      confidenceLabel: AppState.draft.confidenceLabel,
      evidenceQuality: AppState.draft.evidenceQuality,
      evidenceSummary: AppState.draft.evidenceSummary,
      missingInformation: AppState.draft.missingInformation,
      benchmarkBasis: AppState.draft.benchmarkBasis,
      inputProvenance: AppState.draft.inputProvenance,
      citations: AppState.draft.citations
    })}<div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap"><button class="btn btn--primary" id="btn-wizard2-ai-continue" type="button">Continue to estimation</button><button class="btn btn--ghost" id="btn-wizard2-ai-retry" type="button">Run AI again</button></div><details class="card mt-4 anim-fade-in"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);font-size:.82rem;font-weight:600;color:var(--text-primary)"><span>Show benchmark and evidence detail</span><span class="badge badge--neutral">Optional</span></summary><div style="display:flex;flex-direction:column;gap:var(--sp-4);margin-top:var(--sp-4)">${renderBenchmarkRationaleBlock(AppState.draft.benchmarkBasis, AppState.draft.inputRationale, AppState.draft.benchmarkReferences)}${renderInputProvenanceBlock(AppState.draft.inputProvenance)}${renderCitationBlock(AppState.draft.citations)}${renderEvidenceQualityBlock(AppState.draft.confidenceLabel, AppState.draft.evidenceQuality, AppState.draft.evidenceSummary, AppState.draft.missingInformation, 'Detailed evidence view', { primaryGrounding: AppState.draft.primaryGrounding, supportingReferences: AppState.draft.supportingReferences, inferredAssumptions: AppState.draft.inferredAssumptions })}</div></details>`;
    if (status) status.textContent = result.usedFallback
      ? 'A fallback suggested draft is ready. Review the changes, assumptions, and source basis before continuing.'
      : 'A suggested draft is ready. Review the changes, assumptions, and source basis before continuing.';
    if (result.aiUnavailable) {
      output.insertAdjacentHTML('afterbegin', `<div class="ai-unavailable-banner banner banner--warning mt-4" role="alert"><span class="banner-icon">△</span><span class="banner-text">AI assistance is temporarily unavailable. You can continue manually or <button class="link-btn" id="btn-retry-ai" type="button" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">try again</button>.</span></div>`);
      output.querySelector('#btn-retry-ai')?.addEventListener('click', event => {
        event.preventDefault();
        runLLMAssist();
      });
    }
    attachCitationHandlers();
    bindWizard2AiTraceLink();
    document.getElementById('btn-wizard2-ai-retry')?.addEventListener('click', runLLMAssist);
    document.getElementById('btn-wizard2-ai-continue')?.addEventListener('click', () => document.getElementById('btn-next-2')?.click());
  } catch(e) {
    if (e?.code === 'LLM_UNAVAILABLE') {
      if (status) status.textContent = 'AI is temporarily unavailable. You can continue manually with your own wording.';
      renderWizard2AiUnavailableBanner(runLLMAssist);
    } else {
      if (status) status.textContent = 'AI is unavailable right now. You can continue manually with your own wording.';
      output.innerHTML = `<div class="banner banner--danger mt-4"><span class="banner-icon">⚠</span><span class="banner-text">LLM Assist is unavailable right now.</span></div><div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap"><button class="btn btn--secondary" id="btn-wizard2-ai-retry" type="button">Try again</button><button class="btn btn--ghost" id="btn-wizard2-continue-manual" type="button">Continue without AI</button></div>`;
      document.getElementById('btn-wizard2-ai-retry')?.addEventListener('click', runLLMAssist);
      document.getElementById('btn-wizard2-continue-manual')?.addEventListener('click', () => document.getElementById('btn-next-2')?.click());
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btnText.textContent = AppState.draft.llmAssisted
      ? '🔄 Re-run AI analysis'
      : '🤖 Analyse scenario and pre-load FAIR inputs';
  }
}

/* Add to app.css — step2-evidence-nudge */
/*
.step2-evidence-nudge {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: rgba(33,40,34,.04);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  font-size: .84rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: var(--sp-2);
}
.step2-evidence-nudge--low {
  background: rgba(242,251,90,.08);
  border-color: rgba(146,156,42,.2);
}
.step2-evidence-nudge__icon {
  flex-shrink: 0;
  font-size: .9rem;
  margin-top: 2px;
  color: var(--text-muted);
}
.step2-evidence-nudge strong {
  color: var(--text-primary);
}
*/
