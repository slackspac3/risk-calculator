function _setStep1ButtonBusy(button, busyLabel, idleLabel) {
  if (!button) return () => {};
  const originalLabel = idleLabel || button.dataset.idleLabel || button.textContent || '';
  button.dataset.idleLabel = originalLabel;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = busyLabel;
  return () => {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = originalLabel;
  };
}

function getStep1RecommendedAction(draft, selectedRisks) {
  const selectedCount = Array.isArray(selectedRisks) ? selectedRisks.length : 0;
  if (!String(draft.narrative || '').trim() && !selectedCount) {
    return {
      title: 'Start with the guided questions',
      copy: 'Answer the simple prompts first. That is the fastest path for most users and gives AI better context to work with.'
    };
  }
  if (String(draft.narrative || '').trim() && !selectedCount) {
    return {
      title: 'Use AI or add the risks you want to assess',
      copy: 'Your scenario wording is in place. Next, either let AI suggest risks from it or add the risks you already know belong in scope.'
    };
  }
  return {
    title: 'Review the selected risks and continue',
    copy: `You already have ${selectedCount} risk${selectedCount === 1 ? '' : 's'} selected. Remove anything out of scope, then continue to scenario review.`
  };
}

function renderStep1SelectedRisksSummary(selectedRisks, riskCandidates) {
  if (!selectedRisks.length) return '';
  const chosenRisks = (riskCandidates || []).filter(risk => selectedRisks.includes(risk.id)).slice(0, 3);
  return `<section class="wizard-summary-band anim-fade-in anim-delay-1">
    <div>
      <div class="wizard-summary-band__label">Selected for this assessment</div>
      <strong>${selectedRisks.length} risk${selectedRisks.length === 1 ? '' : 's'} currently in scope</strong>
      <div class="wizard-summary-band__copy">Keep only risks that belong in the same scenario and management discussion before you continue.</div>
    </div>
    <div class="wizard-summary-band__meta">
      ${chosenRisks.map(risk => `<span class="badge badge--neutral">${escapeHtml(String(risk.title || risk.name || 'Risk'))}</span>`).join('')}
      ${selectedRisks.length > chosenRisks.length ? `<span class="badge badge--neutral">+${selectedRisks.length - chosenRisks.length} more</span>` : ''}
    </div>
  </section>`;
}

const STEP1_DRY_RUN_FUNCTION_LABELS = {
  finance: 'Finance',
  procurement: 'Procurement',
  compliance: 'Compliance',
  operations: 'Operations',
  technology: 'Technology and cyber',
  strategic: 'Strategic',
  hse: 'HSE',
  general: 'Cross-functional'
};

const STEP1_FUNCTION_TO_SCENARIO_LENS = {
  finance: { key: 'financial', label: 'Financial', functionKey: 'finance', estimatePresetKey: 'financial' },
  procurement: { key: 'procurement', label: 'Procurement', functionKey: 'procurement', estimatePresetKey: 'procurement' },
  compliance: { key: 'compliance', label: 'Compliance', functionKey: 'compliance', estimatePresetKey: 'compliance' },
  operations: { key: 'operational', label: 'Operational', functionKey: 'operations', estimatePresetKey: 'operational' },
  technology: { key: 'cyber', label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'identity' },
  strategic: { key: 'strategic', label: 'Strategic', functionKey: 'strategic', estimatePresetKey: 'strategic' },
  hse: { key: 'hse', label: 'HSE', functionKey: 'hse', estimatePresetKey: 'hse' },
  general: { key: 'general', label: 'General enterprise risk', functionKey: 'general', estimatePresetKey: 'general' }
};

function createStep1DryRunScenario(input = {}) {
  return {
    id: String(input.id || '').trim(),
    functionKey: String(input.functionKey || 'general').trim(),
    title: String(input.title || 'Worked example').trim(),
    summary: String(input.summary || '').trim(),
    bestFor: String(input.bestFor || '').trim(),
    nextStep: String(input.nextStep || '').trim(),
    promptLabel: String(input.promptLabel || input.title || 'Load example').trim(),
    event: String(input.event || '').trim(),
    asset: String(input.asset || '').trim(),
    cause: String(input.cause || '').trim(),
    impact: String(input.impact || '').trim(),
    urgency: String(input.urgency || 'medium').trim(),
    geographies: Array.isArray(input.geographies) ? input.geographies : [],
    risks: Array.isArray(input.risks) ? input.risks : []
  };
}

function inferStep1FunctionKey(settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  const profile = normaliseUserProfile(settings?.userProfile, AuthService.getCurrentUser());
  const haystack = [
    profile.jobTitle,
    profile.department,
    profile.businessUnit,
    profile.workingContext,
    ...(Array.isArray(profile.focusAreas) ? profile.focusAreas : []),
    draft?.buName,
    draft?.contextNotes
  ].filter(Boolean).join(' ').toLowerCase();
  if (/procurement|sourcing|vendor|supplier|purchase|third[- ]party|supply chain/.test(haystack)) return 'procurement';
  if (/compliance|regulatory|legal|privacy|policy|governance|controls|audit/.test(haystack)) return 'compliance';
  if (/finance|treasury|accounting|financial|cash|payment|payroll|credit|collections|ledger/.test(haystack)) return 'finance';
  if (/hse|ehs|health|safety|environment|workplace safety|incident response/.test(haystack)) return 'hse';
  if (/strategy|strategic|enterprise|portfolio|transformation|market|growth|investment/.test(haystack)) return 'strategic';
  if (/technology|cyber|security|identity|cloud|infrastructure|it\b|digital/.test(haystack)) return 'technology';
  if (/operations|resilience|continuity|service delivery|manufacturing|logistics|facilities|workforce/.test(haystack)) return 'operations';
  return 'general';
}

function getStep1PreferredScenarioLens(settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  if (draft?.scenarioLens?.key) return { ...draft.scenarioLens };
  return {
    ...(STEP1_FUNCTION_TO_SCENARIO_LENS[inferStep1FunctionKey(settings, draft)] || STEP1_FUNCTION_TO_SCENARIO_LENS.general)
  };
}

function composeStep1GuidedNarrative(guidedInput = (AppState.draft?.guidedInput || {}), settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  const lens = getStep1PreferredScenarioLens(settings, draft);
  return composeGuidedNarrative(guidedInput, {
    lensKey: lens?.key || '',
    lensLabel: lens?.label || ''
  });
}

function getStep1LearnedExampleSummary(pattern = {}) {
  const parts = [
    pattern.geography ? `Completed in ${pattern.geography}` : '',
    pattern.posture === 'above-tolerance'
      ? 'previously finished above tolerance'
      : pattern.posture === 'near-tolerance'
        ? 'previously finished near tolerance'
        : 'previously finished within tolerance'
  ].filter(Boolean);
  return parts.join(' and ') || 'Learnt from a previous completed assessment.';
}

function buildStep1LearnedDryRunExamples(functionKey, buId, limit = 3) {
  const patterns = typeof getRelevantScenarioPatterns === 'function'
    ? getRelevantScenarioPatterns(buId, limit * 2)
    : [];
  return patterns
    .filter(pattern => {
      if (!String(pattern?.title || pattern?.scenarioType || pattern?.narrative || '').trim()) return false;
      if (functionKey === 'general') return true;
      if (String(pattern?.functionKey || '').trim().toLowerCase() === functionKey) return true;
      const haystack = [
        pattern?.functionKey,
        pattern?.title,
        pattern?.scenarioType,
        pattern?.narrative,
        ...(Array.isArray(pattern?.selectedRiskTitles) ? pattern.selectedRiskTitles : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(functionKey.replace('-', ' ')) || inferStep1FunctionKey({
        userProfile: {
          department: haystack,
          workingContext: haystack,
          focusAreas: []
        }
      }) === functionKey;
    })
    .slice(0, limit)
    .map((pattern, index) => createStep1DryRunScenario({
      id: `learned-${pattern.id || index}`,
      functionKey,
      title: String(pattern.title || pattern.scenarioType || 'Recent completed scenario').trim(),
      summary: getStep1LearnedExampleSummary(pattern),
      bestFor: pattern.confidenceLabel ? `${pattern.confidenceLabel} precedent` : 'Recent precedent',
      nextStep: pattern.keyRecommendation
        ? `Use this when you want a similar starting point. Most recent recommendation: ${pattern.keyRecommendation}`
        : 'Use this when you want to start from a recent pattern already seen in this workspace.',
      promptLabel: 'Recent pattern',
      event: String(pattern.guidedInput?.event || pattern.narrative || pattern.title || pattern.scenarioType || '').trim(),
      asset: String(pattern.guidedInput?.asset || '').trim(),
      cause: String(pattern.guidedInput?.cause || '').trim(),
      impact: String(pattern.guidedInput?.impact || pattern.topGap || '').trim(),
      urgency: pattern.posture === 'above-tolerance' ? 'high' : pattern.posture === 'near-tolerance' ? 'medium' : 'low',
      geographies: pattern.geography ? [String(pattern.geography).trim()] : [],
      risks: (Array.isArray(pattern.selectedRiskTitles) ? pattern.selectedRiskTitles : []).slice(0, 3).map(title => ({
        title,
        category: 'Learned',
        source: 'learned-pattern',
        description: 'Recovered from a recent completed assessment to provide a faster starting point.'
      }))
    }));
}

function getStep1ExampleExperienceModel(settings = getEffectiveSettings(), draft = AppState.draft || {}) {
  const functionKey = inferStep1FunctionKey(settings, draft);
  const recommended = STEP1_DRY_RUN_SCENARIOS
    .filter(example => example.functionKey === functionKey)
    .slice(0, 4);
  const fallback = functionKey === 'general'
    ? STEP1_DRY_RUN_SCENARIOS.filter(example => example.functionKey !== 'general').slice(0, 4)
    : STEP1_DRY_RUN_SCENARIOS.filter(example => example.functionKey === 'general').slice(0, 2);
  const learned = buildStep1LearnedDryRunExamples(functionKey, draft?.buId, 3);
  const seenIds = new Set();
  const availableExamples = [...recommended, ...learned, ...fallback, ...STEP1_DRY_RUN_SCENARIOS].filter(example => {
    if (!example?.id || seenIds.has(example.id)) return false;
    seenIds.add(example.id);
    return true;
  });
  return {
    functionKey,
    functionLabel: STEP1_DRY_RUN_FUNCTION_LABELS[functionKey] || STEP1_DRY_RUN_FUNCTION_LABELS.general,
    recommendedExamples: recommended.length ? recommended : availableExamples.slice(0, 4),
    learnedExamples: learned,
    availableExamples
  };
}

function renderStep1FeaturedExampleCard(example, recommendedExamples = [], learnedExamples = [], functionLabel = 'your function') {
  if (!example) return '';
  const disclosureKey = getDisclosureStateKey('/wizard/1', 'worked example');
  return `<details class="wizard-disclosure wizard-disclosure--support anim-fade-in" data-disclosure-state-key="${escapeHtml(disclosureKey)}" ${getDisclosureOpenState(disclosureKey, false) ? 'open' : ''}>
    <summary>Worked examples <span class="badge badge--neutral">${escapeHtml(functionLabel)} starter set</span></summary>
    <div class="wizard-disclosure-body">
      <div class="wizard-summary-band wizard-summary-band--quiet" style="margin-top:0">
        <div>
          <div class="wizard-summary-band__label">Featured example</div>
          <strong>${escapeHtml(example.title)}</strong>
          <div class="wizard-summary-band__copy">${escapeHtml(example.summary)} Best for: ${escapeHtml(example.bestFor)}.</div>
        </div>
        <div class="wizard-summary-band__meta">
          <button class="btn btn--secondary btn-load-dry-run" data-dry-run-id="${escapeHtml(example.id)}" type="button">Load Example</button>
        </div>
      </div>
      <div class="form-help" style="margin-top:var(--sp-4)">${escapeHtml(example.nextStep)}</div>
      ${recommendedExamples.length ? `<div class="risk-selection-grid" style="margin-top:var(--sp-4)">
        <div class="form-help" style="grid-column:1 / -1">Recommended for ${escapeHtml(functionLabel.toLowerCase())}. Choose any of these if you want the starter scenario to reflect the function you work in.</div>
        ${recommendedExamples.map(item => `<div class="risk-pick-card">
          <div class="risk-pick-head" style="align-items:flex-start">
            <div style="flex:1">
              <div class="risk-pick-title">${escapeHtml(item.title)}</div>
              <div class="form-help" style="margin-top:6px">${escapeHtml(item.summary)}</div>
            </div>
            <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(item.id)}" type="button">Load</button>
          </div>
          <div class="citation-chips" style="margin-top:var(--sp-3)">
            <span class="badge badge--neutral">${escapeHtml(item.promptLabel)}</span>
            <span class="badge badge--neutral">${escapeHtml(item.bestFor)}</span>
          </div>
        </div>`).join('')}
      </div>` : ''}
      ${learnedExamples.length ? `<div class="card card--background" style="margin-top:var(--sp-4);padding:var(--sp-4)">
        <div class="context-panel-title">Learnt from recent completed assessments</div>
        <div class="form-help" style="margin-top:6px">Recent scenarios now feed this picker so the preloaded examples stay closer to the work your team actually runs.</div>
        <div class="risk-selection-grid" style="margin-top:var(--sp-4)">
          ${learnedExamples.map(item => `<div class="risk-pick-card">
            <div class="risk-pick-head" style="align-items:flex-start">
              <div style="flex:1">
                <div class="risk-pick-title">${escapeHtml(item.title)}</div>
                <div class="form-help" style="margin-top:6px">${escapeHtml(item.summary)}</div>
              </div>
              <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(item.id)}" type="button">Load</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </details>`;
}

function renderStep1GuidedBuilderCard(draft, recommendation, functionLabel = 'your role', promptSuggestions = []) {
  const draftPreview = composeStep1GuidedNarrative(draft.guidedInput, getEffectiveSettings(), draft);
  const optionalContextDisclosureKey = getDisclosureStateKey('/wizard/1', 'add more context only if you need it');
  const promptCards = promptSuggestions.length
    ? promptSuggestions
    : [
      { label: 'Supplier disruption', prompt: 'A critical supplier fails during a high-pressure operating period and key services fall behind.' },
      { label: 'Control breakdown', prompt: 'A control breakdown remains undetected long enough to create customer, financial, or regulatory exposure.' },
      { label: 'Recovery shortfall', prompt: 'An outage lasts longer than planned because recovery dependencies do not perform as expected.' }
    ];
  const primaryPrompt = String(promptCards[0]?.prompt || 'Describe what happened or what could happen.').trim();
  return `<div class="card card--primary wizard-primary-card anim-fade-in anim-delay-1">
    <div class="wizard-premium-head" style="margin-bottom:var(--sp-5)">
      <div>
        <h3>Guided scenario builder</h3>
        <p>Answer a few plain-language prompts. The platform will turn them into a structured starting point you can edit before continuing.</p>
        <div class="wizard-builder-note">
          <strong>${recommendation.title}</strong>
          <span>${recommendation.copy} Your current examples are tuned for ${escapeHtml(functionLabel.toLowerCase())} work.</span>
        </div>
      </div>
      <span class="badge badge--gold">Recommended</span>
    </div>
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label" for="guided-event">What happened or what could happen?</label>
        <textarea class="form-textarea" id="guided-event" rows="3" placeholder="Example: ${escapeHtml(primaryPrompt)}">${draft.guidedInput?.event || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="guided-impact">What is the main impact you care about?</label>
        <input class="form-input" id="guided-impact" type="text" placeholder="Example: service outage, regulatory breach, customer harm, financial exposure, recovery strain" value="${draft.guidedInput?.impact || ''}">
      </div>
    </div>
    <details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(optionalContextDisclosureKey)}" ${getDisclosureOpenState(optionalContextDisclosureKey, false) ? 'open' : ''} style="margin-top:var(--sp-4)">
      <summary>Add more context only if you need it <span class="badge badge--neutral">Optional</span></summary>
      <div class="wizard-disclosure-body">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" for="guided-asset">What is affected?</label>
            <input class="form-input" id="guided-asset" type="text" placeholder="Example: payment platform, shared identity service, cloud data store" value="${draft.guidedInput?.asset || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="guided-cause">What is the likely cause or trigger?</label>
            <input class="form-input" id="guided-cause" type="text" placeholder="Example: supplier breach, phishing-led compromise, weak recovery process, control gap" value="${draft.guidedInput?.cause || ''}">
          </div>
        </div>
        <div class="grid-2 mt-4">
          <div class="form-group">
            <label class="form-label" for="guided-urgency">How urgent does it feel?</label>
            <select class="form-select" id="guided-urgency">
              <option value="low" ${draft.guidedInput?.urgency === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${!draft.guidedInput?.urgency || draft.guidedInput?.urgency === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${draft.guidedInput?.urgency === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${draft.guidedInput?.urgency === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Prompt ideas</label>
            <div class="citation-chips">
              ${promptCards.slice(0, 3).map(prompt => `<button class="citation-chip guided-prompt-chip" data-prompt="${escapeHtml(prompt.prompt)}">${escapeHtml(prompt.label)}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </details>
    <div class="admin-inline-actions mt-4">
      <button class="btn btn--primary" id="btn-build-guided-narrative" type="button">Build scenario draft</button>
      <span class="form-help">Good enough is enough here. You can still tighten the wording and shortlist on the next screens.</span>
    </div>
    ${draftPreview ? `<div class="card mt-4 wizard-draft-preview" style="padding:var(--sp-4);background:var(--bg-elevated)">
      <div class="context-panel-title">Draft preview</div>
      <p class="context-panel-copy" id="guided-preview">${escapeHtml(String(draftPreview))}</p>
    </div>` : '<div class="form-help wizard-preview-placeholder" id="guided-preview">Answer the prompts and build the draft. The platform will create a clean starting statement for you.</div>'}
  </div>`;
}

function renderStep1SupportBand({ draft, hasScenarioDraft, hasImportedSource, featuredDryRun, recommendedDryRuns, learnedDryRuns, availableDryRuns, functionLabel, activeDryRun, buList, scenarioGeographies, regs, settings }) {
  return `<section class="wizard-support-band anim-fade-in">
    <div class="results-section-heading">Support and alternate starts</div>
    <div class="form-help" style="margin-top:8px">Use these only when you need existing context, a faster starting point, or a different source for the shortlist.</div>
    <div class="wizard-support-band__stack">
      ${activeDryRun ? renderLoadedDryRunBanner(activeDryRun) : ''}
      ${draft.learningNote ? `<div class="wizard-summary-band wizard-summary-band--quiet"><div><div class="wizard-summary-band__label">Learnt from prior use</div><strong>Saved guidance from earlier use</strong><div class="wizard-summary-band__copy">${draft.learningNote}</div></div></div>` : ''}
      ${UI.disclosureSection({
        title: 'Assessment framing and defaults',
        badgeLabel: 'Adjust only if needed',
        badgeTone: 'neutral',
        open: false,
        className: 'wizard-disclosure wizard-disclosure--support',
        body: `
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" for="wizard-bu">Business Unit <span class="required">*</span></label>
            <select class="form-select" id="wizard-bu">
              <option value="">— Select —</option>
              ${buList.map(b => `<option value="${b.id}" ${draft.buId===b.id?'selected':''}>${b.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Geographies</label>
            <div class="tag-input-wrap" id="ti-wizard-geographies"></div>
            <div class="citation-chips" style="margin-top:10px">
              ${GEOGRAPHY_OPTIONS.map(option => `<button type="button" class="chip wizard-geo-chip" data-geo="${option}">${option}</button>`).join('')}
            </div>
            <span class="form-help">Select all countries or regions relevant to this scenario. Applicable regulations update from the combined footprint.</span>
          </div>
        </div>
        <div class="context-grid mt-4">
          <div class="context-chip-panel">
            <div class="context-panel-title">Risk Appetite</div>
            <p class="context-panel-copy">${settings.riskAppetiteStatement}</p>
            <div class="context-panel-foot">Current P90 per-event tolerance: ${fmtCurrency(getToleranceThreshold())}. Warning trigger: ${fmtCurrency(getWarningThreshold())}.</div>
          </div>
          <div class="context-chip-panel">
            <div class="context-panel-title">Applicable Regulations</div>
            <div class="citation-chips">
              ${regs.map(tag => `<span class="badge badge--gold">${tag}</span>`).join('')}
            </div>
          </div>
        </div>
      `
      })}
      ${renderStep1FeaturedExampleCard(featuredDryRun, recommendedDryRuns, learnedDryRuns, functionLabel)}
      ${renderStep1OtherWaysToStart(draft, hasScenarioDraft, hasImportedSource, availableDryRuns, functionLabel)}
      <div id="intake-output">
        ${draft.intakeSummary ? `<div class="card card--glow"><div class="context-panel-title">AI Intake Summary</div><p class="context-panel-copy">${draft.intakeSummary}</p>${draft.linkAnalysis ? `<div class="context-panel-foot">${draft.linkAnalysis}</div>` : ''}</div>` : ''}
      </div>
    </div>
  </section>`;
}

function renderStep1ScopeBand({ draft, selectedRisks, riskCandidates, regs }) {
  const hasCandidates = riskCandidates.length > 0;
  const chosenRisks = (riskCandidates || []).filter(risk => selectedRisks.includes(risk.id)).slice(0, 3);
  return `<section class="wizard-scope-band anim-fade-in">
    <div class="wizard-ia-section">
      <div class="results-section-heading">Choose what stays in scope</div>
      <div class="form-help" style="margin-top:8px">Carry forward only the risks that belong in the same scenario and management discussion.</div>
    </div>
    ${hasCandidates ? `
      ${selectedRisks.length ? `<section class="wizard-summary-band wizard-summary-band--quiet">
        <div>
          <div class="wizard-summary-band__label">Selected for this assessment</div>
          <strong>${selectedRisks.length} risk${selectedRisks.length === 1 ? '' : 's'} currently in scope</strong>
          <div class="wizard-summary-band__copy">Keep only risks that belong in the same scenario and management discussion before you continue.</div>
        </div>
        <div class="wizard-summary-band__meta">
          ${chosenRisks.map(risk => `<span class="badge badge--neutral">${escapeHtml(String(risk.title || risk.name || 'Risk'))}</span>`).join('')}
          ${selectedRisks.length > chosenRisks.length ? `<span class="badge badge--neutral">+${selectedRisks.length - chosenRisks.length} more</span>` : ''}
        </div>
      </section>` : ''}
      <div class="card anim-fade-in anim-delay-2">
        <div class="flex items-center justify-between mb-4" style="flex-wrap:wrap;gap:var(--sp-3)">
          <div>
            <div class="context-panel-title">Choose the risks for this assessment</div>
            <p class="context-panel-copy">Keep only risks that share the same event, scope, or business impact. Remove anything that is out of scope before continuing.</p>
          </div>
          <label class="toggle-row">
            <span class="toggle-label">Treat as linked scenario</span>
            <label class="toggle"><input type="checkbox" id="linked-risks-toggle" ${draft.linkedRisks ? 'checked' : ''}><div class="toggle-track"></div></label>
          </label>
        </div>
        <div id="selected-risks-wrap">
          ${renderSelectedRiskCards(riskCandidates, selectedRisks, regs)}
        </div>
      </div>
    ` : `
      <section class="wizard-summary-band wizard-summary-band--quiet wizard-summary-band--scope-empty">
        <div>
          <div class="wizard-summary-band__label">Scope shortlist</div>
          <strong>No candidate risks yet</strong>
          <div class="wizard-summary-band__copy">Build the first scenario draft or use a support path above. The shortlist becomes the main focus once the page has real scope to review.</div>
        </div>
      </section>
    `}
  </section>`;
}

function renderStep1OtherWaysToStart(draft, hasScenarioDraft, hasImportedSource, availableExamples = STEP1_DRY_RUN_SCENARIOS, functionLabel = 'your function') {
  const disclosureKey = getDisclosureStateKey('/wizard/1', 'other ways to start');
  const importDisclosureKey = getDisclosureStateKey('/wizard/1', 'import or add risks directly');
  const examplesDisclosureKey = getDisclosureStateKey('/wizard/1', 'browse more worked examples');
  const isOpen = getDisclosureOpenState(disclosureKey, AppState.dashboardStartIntent === 'register' || hasScenarioDraft || hasImportedSource);
  return `<details class="wizard-disclosure anim-fade-in anim-delay-1" data-disclosure-state-key="${escapeHtml(disclosureKey)}" ${isOpen ? 'open' : ''}>
    <summary>Other ways to start <span class="badge badge--neutral">Optional</span></summary>
    <div class="wizard-disclosure-body">
      <div class="form-help">Open this only if you already have a scenario draft, a register, or a known list of risks. The guided builder remains the easiest path for most users.</div>
      <div class="card" style="padding:var(--sp-5);background:var(--bg-elevated)">
        <div class="context-panel-title">Bring your own scenario wording</div>
        <div class="form-help" style="margin-top:6px">Use AI only if you want help tightening the draft or extracting the shortlist.</div>
        <div class="form-group" style="margin-top:var(--sp-4)">
          <label class="form-label" for="intake-risk-statement">Scenario draft</label>
          <textarea class="form-textarea" id="intake-risk-statement" rows="6" placeholder="If you already know the scenario, describe it here in plain English. Include what could happen, what is affected, likely triggers, and the business or regulatory impact.">${draft.narrative || ''}</textarea>
        </div>
        <div class="flex items-center gap-3" style="flex-wrap:wrap">
          <button class="btn btn--secondary" id="btn-enhance-risk-statement" type="button">Use AI to refine this draft</button>
          <button class="btn btn--ghost" id="btn-generate-risks-from-draft" type="button">Generate shortlist from this draft</button>
        </div>
      </div>
      <details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(importDisclosureKey)}" ${getDisclosureOpenState(importDisclosureKey, false) ? 'open' : ''}>
        <summary>Import or add risks directly <span class="badge badge--neutral">Advanced start</span></summary>
        <div class="wizard-disclosure-body">
          <div class="form-help">Use this only when your source material already exists in a register, spreadsheet, or known risk list.</div>
          <div class="grid-2" style="margin-top:var(--sp-4)">
            <div class="form-group">
              <label class="form-label" for="risk-register-file">Risk register upload</label>
              <input class="form-input" id="risk-register-file" type="file" accept=".txt,.csv,.json,.md,.tsv,.xlsx,.xls">
              <div class="form-help">${draft.uploadedRegisterName ? `Current file: ${draft.uploadedRegisterName}${draft.registerMeta?.sheetCount ? ` · ${draft.registerMeta.sheetCount} sheet(s)` : ''}` : 'Upload TXT, CSV, TSV, JSON, Markdown, or Excel. Word and PDF still need conversion before upload.'}</div>
              <div class="flex items-center gap-3 mt-4" style="flex-wrap:wrap">
                <button class="btn btn--secondary" id="btn-register-analyse">Upload, extract, analyse and enhance risks</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="manual-risk-add">Add risk manually</label>
              <div class="inline-action-row">
                <input class="form-input" id="manual-risk-add" type="text" placeholder="e.g. Export control screening failure">
                <button class="btn btn--secondary" id="btn-add-manual-risk" type="button">Add</button>
              </div>
              <div class="form-help" style="margin-top:10px">Manual risks are added to the same candidate list and selected by default.</div>
            </div>
          </div>
          <p class="form-help" style="margin-top:var(--sp-4)">Uses runtime AI if a key has been set with <code>LLMService.setOpenAIKey(...)</code>. Otherwise the local extraction stub is used.</p>
        </div>
      </details>
      <details class="wizard-disclosure wizard-disclosure--compact" data-disclosure-state-key="${escapeHtml(examplesDisclosureKey)}" ${getDisclosureOpenState(examplesDisclosureKey, false) ? 'open' : ''}>
        <summary>Browse more worked examples <span class="badge badge--neutral">Optional</span></summary>
        <div class="wizard-disclosure-body">
          <div class="form-help">Use these when you want a fast, high-quality starting point. The first examples are tuned for ${escapeHtml(functionLabel.toLowerCase())} work, with recent learnt cases mixed in when available.</div>
          <div class="risk-selection-grid" style="margin-top:var(--sp-4)">
            ${availableExamples.map(example => `<div class="risk-pick-card">
              <div class="risk-pick-head" style="align-items:flex-start">
                <div style="flex:1">
                  <div class="risk-pick-title">${escapeHtml(example.title)}</div>
                  <div class="form-help" style="margin-top:6px">${escapeHtml(example.summary)}</div>
                  <div class="form-help" style="margin-top:6px"><strong>Best for:</strong> ${escapeHtml(example.bestFor)}</div>
                </div>
                <button class="btn btn--ghost btn--sm btn-load-dry-run" data-dry-run-id="${escapeHtml(example.id)}" type="button">Load Example</button>
              </div>
              <div class="citation-chips" style="margin-top:var(--sp-3)">
                <span class="badge badge--neutral">${escapeHtml(STEP1_DRY_RUN_FUNCTION_LABELS[example.functionKey] || STEP1_DRY_RUN_FUNCTION_LABELS.general)}</span>
                ${(example.geographies || []).map(geo => `<span class="badge badge--neutral">${escapeHtml(geo)}</span>`).join('')}
                <span class="badge badge--neutral">${Array.isArray(example.risks) ? example.risks.length : 0} starter risks</span>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </details>
    </div>
  </details>`;
}

function ensureStep1ContextPrefills(draft, settings, buList) {
  let changed = false;
  const preferredBusinessUnitId = settings.userProfile?.businessUnitEntityId || AppState.currentUser?.businessUnitEntityId || '';
  if (!draft.buId && preferredBusinessUnitId) {
    const preferredBU = buList.find(bu => bu.orgEntityId === preferredBusinessUnitId || bu.id === preferredBusinessUnitId);
    if (preferredBU) {
      draft.buId = preferredBU.id;
      draft.buName = preferredBU.name;
      changed = true;
    }
  }
  const currentGeographies = getScenarioGeographies();
  if (!currentGeographies.length && settings.geography) {
    draft.geographies = normaliseScenarioGeographies([settings.geography], settings.geography);
    draft.geography = formatScenarioGeographies(draft.geographies, settings.geography);
    changed = true;
  }
  if (!Array.isArray(draft.applicableRegulations) || !draft.applicableRegulations.length || changed) {
    draft.applicableRegulations = deriveApplicableRegulations(
      buList.find(b => b.id === draft.buId),
      getSelectedRisks(),
      getScenarioGeographies()
    );
    changed = true;
  }
  return changed;
}

function renderStep1ContextCard(settings, draft, scenarioGeographies, regs, buList) {
  const profile = normaliseUserProfile(settings.userProfile, AuthService.getCurrentUser());
  const businessUnit = buList.find(bu => bu.id === draft.buId) || null;
  const geographies = scenarioGeographies.length ? scenarioGeographies : normaliseScenarioGeographies([settings.geography], settings.geography);
  const chips = [
    businessUnit?.name ? `Business unit: ${businessUnit.name}` : '',
    geographies.length ? `Default geography: ${geographies.join(', ')}` : '',
    profile.focusAreas?.length ? `Focus areas: ${profile.focusAreas.join(', ')}` : '',
    profile.preferredOutputs ? `Output style: ${profile.preferredOutputs}` : ''
  ].filter(Boolean);
  const workingContext = String(profile.workingContext || '').trim();
  return `<div class="card card--elevated anim-fade-in">
    <div class="wizard-premium-head">
      <div>
        <div class="context-panel-title">Current context shaping this assessment</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">The wizard is already using your saved role and organisation defaults so you do not have to start from a blank page.</p>
      </div>
      <span class="badge badge--neutral">Using saved context</span>
    </div>
    <div class="citation-chips" style="margin-top:var(--sp-4)">
      ${chips.map(chip => `<span class="badge badge--neutral">${escapeHtml(chip)}</span>`).join('')}
      ${regs.slice(0, 4).map(tag => `<span class="badge badge--gold">${escapeHtml(tag)}</span>`).join('')}
    </div>
    ${workingContext ? `<div class="context-panel-foot" style="margin-top:var(--sp-3)">Working context: ${escapeHtml(workingContext)}</div>` : ''}
    <div class="context-panel-foot" style="margin-top:${workingContext ? '8px' : 'var(--sp-3)'}">These defaults affect assisted suggestions, regulations, and examples, but you can change them at any time on this step.</div>
  </div>`;
}

function getRegisterFallbackToastCopy(result = {}) {
  const title = String(result.fallbackReasonTitle || 'Fallback register analysis loaded').trim();
  const detail = String(result.fallbackReasonMessage || '').trim();
  const diagnostic = String(result.fallbackReasonDetail || '').trim();
  const shortDiagnostic = diagnostic ? ` Diagnostic: ${diagnostic}` : '';
  return detail ? `${title}. ${detail}${shortDiagnostic} Review the suggested risks before continuing.` : `${title}.${shortDiagnostic} Review the suggested risks before continuing.`;
}

function renderStep1ReadinessBanner(draft, selectedRisks) {
  const warnings = [];
  const narrative = String(draft.narrative || draft.sourceNarrative || '').trim();
  if (!String(draft.buId || '').trim()) warnings.push('Pick the business unit first so the right context and regulations carry forward.');
  if (!narrative && !String(draft.guidedInput?.event || '').trim()) warnings.push('Add at least the event prompt or load a sample example to get a useful scenario draft quickly.');
  if (narrative && narrative.split(/\s+/).filter(Boolean).length < 12) warnings.push('The scenario draft is still very short. Add what is affected, what causes it, and the impact you care about.');
  if (narrative && !selectedRisks.length) warnings.push('No risks are selected yet. Use the shortlist below or generate risks from the current draft before continuing.');
  if (!warnings.length) return '';
  return renderPilotWarningBanner('lowConfidence', {
    compact: true,
    text: warnings[0]
  });
}

const STEP1_DRY_RUN_SCENARIOS = [
  createStep1DryRunScenario({
    id: 'finance-liquidity-shock',
    functionKey: 'finance',
    title: 'Liquidity pressure after a sudden market shock',
    summary: 'Tailored to treasury and finance teams managing funding, cash, and escalation posture.',
    bestFor: 'Treasury, liquidity, and executive escalation walkthroughs',
    nextStep: 'Use this when you want finance-led guidance on funding pressure, liquidity actions, and confidence in management response.',
    promptLabel: 'Liquidity shock',
    event: 'A sudden market move forces faster-than-expected collateral and liquidity demands across critical financing lines.',
    asset: 'Treasury funding lines, cash buffers, and short-term liquidity operations',
    cause: 'Market volatility, tighter funding conditions, and delayed liquidity response triggers',
    impact: 'Funding strain, management escalation, and possible disruption to planned business activity',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Liquidity buffer shortfall', category: 'Financial', source: 'dry-run', description: 'Available buffers may not cover the pace of cash outflows or collateral calls.' },
      { title: 'Treasury decision delay', category: 'Operational', source: 'dry-run', description: 'Escalation sequencing and approvals slow down the funding response.' },
      { title: 'Market confidence strain', category: 'Strategic', source: 'dry-run', description: 'Stakeholders may question resilience if the response appears reactive or fragmented.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'finance-payments-control-breakdown',
    functionKey: 'finance',
    title: 'Payments control breakdown enabling duplicate transfers',
    summary: 'Designed for controllership, finance operations, and payment integrity teams.',
    bestFor: 'Payment control, fraud, and remediation walkthroughs',
    nextStep: 'Load this to see how a finance-control issue becomes a loss, confidence, and remediation planning case.',
    promptLabel: 'Payment control failure',
    event: 'A payments workflow control fails and high-value transfers are released twice before the issue is detected.',
    asset: 'Payment approval workflow, finance operations controls, and treasury accounts',
    cause: 'Control design weakness, alert fatigue, and incomplete segregation checks',
    impact: 'Financial loss, recovery effort, and governance scrutiny',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Duplicate payment loss', category: 'Financial', source: 'dry-run', description: 'Transfer errors create direct financial exposure and recovery work.' },
      { title: 'Control assurance failure', category: 'Compliance', source: 'dry-run', description: 'Control breakdown weakens confidence in the finance operating model.' },
      { title: 'Management reporting gap', category: 'Governance', source: 'dry-run', description: 'Leaders need clear facts fast to decide on containment and communication.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'finance-close-delay',
    functionKey: 'finance',
    title: 'Quarter-close delay after a ledger control issue',
    summary: 'Useful for finance teams working through reporting deadlines and control dependency failures.',
    bestFor: 'Reporting, control, and executive-readiness walkthroughs',
    nextStep: 'Use this to model the downstream impact of a late reporting close and the actions needed to restore confidence.',
    promptLabel: 'Close delay',
    event: 'A ledger reconciliation control fails late in the reporting cycle and delays the quarter-close process.',
    asset: 'General ledger, close process controls, and finance reporting outputs',
    cause: 'Data quality issues, control exceptions, and slow escalation of reconciliation gaps',
    impact: 'Reporting delay, assurance pressure, and management intervention',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Financial reporting delay', category: 'Financial', source: 'dry-run', description: 'Close activities miss expected timelines and increase reporting risk.' },
      { title: 'Assurance confidence erosion', category: 'Compliance', source: 'dry-run', description: 'Confidence in the control environment weakens during remediation.' },
      { title: 'Decision support disruption', category: 'Operational', source: 'dry-run', description: 'Leadership receives late or incomplete reporting for management decisions.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'finance-credit-loss-reserve',
    functionKey: 'finance',
    title: 'Credit loss reserve shortfall after a portfolio deterioration signal',
    summary: 'Good for finance, risk, and controllership users balancing model risk with management response.',
    bestFor: 'Provisioning, portfolio risk, and governance walkthroughs',
    nextStep: 'Load this when you want a finance-heavy case that is strategic and regulatory rather than cyber-led.',
    promptLabel: 'Reserve shortfall',
    event: 'A portfolio deterioration signal suggests credit loss reserves may be understated heading into a reporting and planning cycle.',
    asset: 'Credit portfolio analytics, reserve models, and finance planning assumptions',
    cause: 'Late risk signal recognition, model drift, and weak management challenge',
    impact: 'Provisioning gap, earnings pressure, and governance action',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'United States'],
    risks: [
      { title: 'Reserve adequacy risk', category: 'Financial', source: 'dry-run', description: 'Loss reserves may not reflect the true portfolio deterioration.' },
      { title: 'Model governance challenge', category: 'Compliance', source: 'dry-run', description: 'Management challenge and oversight may be weaker than expected.' },
      { title: 'Strategic capital planning strain', category: 'Strategic', source: 'dry-run', description: 'Reserve changes alter planning choices and management posture.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-single-source-shortfall',
    functionKey: 'procurement',
    title: 'Single-source supplier shortfall on a critical spend category',
    summary: 'Built for procurement teams managing concentration, sourcing continuity, and supplier fallback.',
    bestFor: 'Supplier concentration, continuity, and sourcing walkthroughs',
    nextStep: 'Use this when you want a procurement-led case with supply continuity, escalation, and contract action built in.',
    promptLabel: 'Single-source shortfall',
    event: 'A single-source supplier cannot meet a critical delivery commitment and no ready substitute is available in the current sourcing plan.',
    asset: 'Critical supplier contract, inbound material flow, and dependent operational plans',
    cause: 'Supplier capacity failure, weak contingency sourcing, and slow contract escalation',
    impact: 'Supply disruption, cost pressure, and executive intervention',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Critical supply disruption', category: 'Supply Chain', source: 'dry-run', description: 'A concentrated supplier dependency blocks timely delivery of key goods or services.' },
      { title: 'Contract leverage weakness', category: 'Procurement', source: 'dry-run', description: 'Commercial protections are not strong enough to support rapid remediation.' },
      { title: 'Operational backlog growth', category: 'Business Continuity', source: 'dry-run', description: 'Downstream plans slow down while replacement options are arranged.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-tender-integrity',
    functionKey: 'procurement',
    title: 'Tender integrity concern in a high-value sourcing round',
    summary: 'Useful for procurement, compliance, and governance users overseeing sourcing fairness and challenge.',
    bestFor: 'Tender integrity, governance, and escalation walkthroughs',
    nextStep: 'Load this when you want to assess the management response to a procurement fairness and control challenge.',
    promptLabel: 'Tender integrity',
    event: 'A high-value tender process shows signs of inconsistent evaluation and incomplete conflict-of-interest declarations.',
    asset: 'Strategic sourcing process, vendor evaluation controls, and procurement approvals',
    cause: 'Weak governance discipline, incomplete declarations, and rushed evaluation activity',
    impact: 'Challenge risk, contract delay, and governance scrutiny',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Sourcing fairness breach', category: 'Procurement', source: 'dry-run', description: 'Tender integrity concerns undermine confidence in the award process.' },
      { title: 'Compliance and challenge exposure', category: 'Compliance', source: 'dry-run', description: 'Formal challenge or review could delay award and create obligations.' },
      { title: 'Reputational procurement risk', category: 'Strategic', source: 'dry-run', description: 'Stakeholders may question the robustness of sourcing governance.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-sanctions-screening-gap',
    functionKey: 'procurement',
    title: 'Supplier onboarding proceeds with a sanctions screening gap',
    summary: 'A procurement and compliance example focused on onboarding controls and third-party exposure.',
    bestFor: 'Third-party onboarding, sanctions, and compliance walkthroughs',
    nextStep: 'Use this to see how supplier onboarding control gaps affect procurement, compliance, and executive decisions together.',
    promptLabel: 'Onboarding screening gap',
    event: 'A supplier onboarding workflow bypasses a sanctions screening step and procurement activity continues before the issue is identified.',
    asset: 'Supplier onboarding controls, screening workflow, and active sourcing requests',
    cause: 'Process workarounds, incomplete workflow automation, and weak exception monitoring',
    impact: 'Compliance exposure, sourcing delay, and urgent remediation',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Sanctions screening breach', category: 'Regulatory', source: 'dry-run', description: 'Third-party onboarding proceeds without a mandatory compliance control.' },
      { title: 'Supplier activation delay', category: 'Procurement', source: 'dry-run', description: 'Urgent remediation slows operational sourcing and contract start.' },
      { title: 'Management assurance gap', category: 'Compliance', source: 'dry-run', description: 'Leaders need confidence that no further onboarding exceptions exist.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'procurement-contract-cover-gap',
    functionKey: 'procurement',
    title: 'Critical service continues without adequate contract cover',
    summary: 'Tailored to procurement teams managing renewals, obligations, and service continuity.',
    bestFor: 'Contract governance, third-party continuity, and remediation walkthroughs',
    nextStep: 'Load this when you want a case that starts in procurement but ends in a broader service and governance decision.',
    promptLabel: 'Contract cover gap',
    event: 'A critical outsourced service continues under expired commercial terms while renewal negotiations and risk review remain incomplete.',
    asset: 'Critical service contract, renewal governance, and dependent service commitments',
    cause: 'Slow renewal process, incomplete obligation tracking, and weak escalation discipline',
    impact: 'Commercial exposure, service uncertainty, and management intervention',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Uncovered service obligation', category: 'Procurement', source: 'dry-run', description: 'The organisation carries service dependency without adequate contractual cover.' },
      { title: 'Third-party continuity strain', category: 'Third-Party', source: 'dry-run', description: 'Service continuity depends on weakly governed interim arrangements.' },
      { title: 'Commercial dispute exposure', category: 'Financial', source: 'dry-run', description: 'Unclear terms may increase cost, recovery, or dispute risk.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-monitoring-breach',
    functionKey: 'compliance',
    title: 'Monitoring control failure leaves a repeat compliance breach undetected',
    summary: 'Designed for compliance teams managing control monitoring and repeat findings.',
    bestFor: 'Monitoring, repeat findings, and remediation walkthroughs',
    nextStep: 'Use this to test how the platform handles recurring compliance issues and management challenge.',
    promptLabel: 'Monitoring failure',
    event: 'A compliance monitoring control fails to identify a repeat breach until the issue has already widened across multiple teams.',
    asset: 'Monitoring controls, issue tracking, and first-line compliance reporting',
    cause: 'Weak control design, incomplete ownership, and poor issue escalation',
    impact: 'Repeat breach, remediation pressure, and management challenge',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Repeat compliance breach', category: 'Compliance', source: 'dry-run', description: 'A known issue recurs because monitoring and escalation are not strong enough.' },
      { title: 'Regulatory scrutiny', category: 'Regulatory', source: 'dry-run', description: 'The organisation may need to explain why repeat remediation did not hold.' },
      { title: 'Control owner fatigue', category: 'Operational', source: 'dry-run', description: 'Teams struggle to remediate sustainably while current operations continue.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-obligations-map-gap',
    functionKey: 'compliance',
    title: 'Regulatory obligations mapping misses a new requirement',
    summary: 'Useful for compliance and legal teams updating obligations and control ownership.',
    bestFor: 'Obligations management, legal change, and governance walkthroughs',
    nextStep: 'Load this to explore how an obligations-mapping issue becomes a practical management decision problem.',
    promptLabel: 'Obligations gap',
    event: 'A new regulatory requirement is not fully captured in the obligations map and key control owners continue operating against the previous standard.',
    asset: 'Obligations inventory, control mapping, and business implementation plans',
    cause: 'Late rule interpretation, incomplete governance handoff, and weak update discipline',
    impact: 'Implementation gap, management remediation, and regulatory concern',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Requirement implementation gap', category: 'Compliance', source: 'dry-run', description: 'Teams are not working to the updated requirement set.' },
      { title: 'Control ownership ambiguity', category: 'Governance', source: 'dry-run', description: 'Responsibility for implementation and challenge is not clear enough.' },
      { title: 'Regulatory response risk', category: 'Regulatory', source: 'dry-run', description: 'A late fix may create disclosure, remediation, or supervisory pressure.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-recordkeeping-shortfall',
    functionKey: 'compliance',
    title: 'Recordkeeping controls fail during a supervisory request',
    summary: 'A compliance-heavy case focused on evidence readiness and control design.',
    bestFor: 'Evidence readiness, control assurance, and remediation walkthroughs',
    nextStep: 'Use this when you want a non-cyber example centred on evidence quality and governance readiness.',
    promptLabel: 'Recordkeeping shortfall',
    event: 'A supervisory request exposes that required records cannot be assembled quickly or completely from current systems and procedures.',
    asset: 'Recordkeeping controls, evidence stores, and regulatory response workflow',
    cause: 'Process fragmentation, weak retention discipline, and unclear ownership',
    impact: 'Response delay, supervisory concern, and remediation effort',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Evidence readiness failure', category: 'Compliance', source: 'dry-run', description: 'Required evidence is incomplete or slow to retrieve.' },
      { title: 'Supervisory confidence erosion', category: 'Regulatory', source: 'dry-run', description: 'Regulators may doubt the organisation’s control discipline.' },
      { title: 'Operational rework pressure', category: 'Operational', source: 'dry-run', description: 'Teams must reconstruct records while managing business-as-usual work.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'compliance-privacy-reuse',
    functionKey: 'compliance',
    title: 'Customer data is reused outside the intended consent basis',
    summary: 'Useful for privacy, compliance, and marketing-governance teams.',
    bestFor: 'Privacy, consent, and customer trust walkthroughs',
    nextStep: 'Load this to test a compliance-led scenario that still carries operational and reputational consequence.',
    promptLabel: 'Consent breakdown',
    event: 'Customer data is reused for a new purpose before teams confirm the required consent and control basis.',
    asset: 'Customer data, consent records, and downstream campaign or workflow logic',
    cause: 'Weak data-use governance, unclear control approvals, and rushed implementation',
    impact: 'Privacy exposure, remediation effort, and customer trust strain',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Consent governance breach', category: 'Compliance', source: 'dry-run', description: 'Data use proceeds without a strong enough legal or policy basis.' },
      { title: 'Regulatory inquiry exposure', category: 'Regulatory', source: 'dry-run', description: 'Data-use concerns may trigger reporting or supervisory attention.' },
      { title: 'Customer trust erosion', category: 'Strategic', source: 'dry-run', description: 'Stakeholders may react negatively once the misuse becomes visible.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-warehouse-automation',
    functionKey: 'operations',
    title: 'Warehouse automation outage disrupts fulfilment commitments',
    summary: 'Designed for operations leaders balancing service continuity, backlog, and recovery.',
    bestFor: 'Operations, backlog, and continuity walkthroughs',
    nextStep: 'Use this when you want an operational disruption case rather than a cyber-first incident.',
    promptLabel: 'Automation outage',
    event: 'A warehouse automation platform fails during a peak period and manual workarounds cannot keep pace with outbound demand.',
    asset: 'Warehouse automation systems, fulfilment workflows, and customer commitments',
    cause: 'Platform failure, weak manual fallback capacity, and delayed recovery coordination',
    impact: 'Backlog growth, customer delay, and management escalation',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Operational backlog growth', category: 'Operational', source: 'dry-run', description: 'Backlog rises faster than teams can clear it using fallback processes.' },
      { title: 'Service commitment breach', category: 'Business Continuity', source: 'dry-run', description: 'Customer obligations slip during the outage period.' },
      { title: 'Recovery coordination shortfall', category: 'Operational', source: 'dry-run', description: 'Recovery decisions and sequencing are less mature than expected.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-workforce-availability',
    functionKey: 'operations',
    title: 'Workforce availability shortfall during a critical operating window',
    summary: 'A practical operational case for service, field, and support teams.',
    bestFor: 'Workforce resilience, continuity, and escalation walkthroughs',
    nextStep: 'Load this when you want to model how people dependency and continuity planning affect the scenario.',
    promptLabel: 'Workforce shortfall',
    event: 'A sudden workforce availability shortfall hits a critical operating window and service delivery falls behind committed levels.',
    asset: 'Front-line operations teams, shift planning, and dependent service workflows',
    cause: 'Absence spike, thin contingency coverage, and weak prioritisation rules',
    impact: 'Service degradation, backlog, and urgent management intervention',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Service delivery degradation', category: 'Operational', source: 'dry-run', description: 'Front-line service performance falls below expected levels.' },
      { title: 'Continuity staffing weakness', category: 'Business Continuity', source: 'dry-run', description: 'Fallback staffing and role coverage prove weaker than expected.' },
      { title: 'Customer escalation pressure', category: 'Commercial', source: 'dry-run', description: 'Customers escalate when service delays persist.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-utilities-interruption',
    functionKey: 'operations',
    title: 'Utilities interruption exposes recovery planning shortfalls',
    summary: 'Built for resilience and operations teams managing facility and service dependencies.',
    bestFor: 'Continuity, recovery, and dependency walkthroughs',
    nextStep: 'Use this to test recovery discipline where the trigger is physical or operational rather than cyber.',
    promptLabel: 'Utilities interruption',
    event: 'A utilities interruption affects a critical operating site and recovery plans do not restore service within the expected timeline.',
    asset: 'Critical site operations, continuity runbooks, and dependent customer services',
    cause: 'Infrastructure outage, weak dependency mapping, and under-tested recovery playbooks',
    impact: 'Service delay, management escalation, and continuity strain',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Continuity plan shortfall', category: 'Business Continuity', source: 'dry-run', description: 'Recovery and fallback plans do not restore service quickly enough.' },
      { title: 'Dependent service outage', category: 'Operational', source: 'dry-run', description: 'Downstream services remain constrained while site recovery continues.' },
      { title: 'Executive recovery decision pressure', category: 'Governance', source: 'dry-run', description: 'Leadership needs to decide on interim service posture and escalation.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'operations-dispatch-backlog',
    functionKey: 'operations',
    title: 'Dispatch backlog builds after a planning system disruption',
    summary: 'Useful for service operations teams handling scheduling, dispatch, and customer impact.',
    bestFor: 'Service operations, backlog, and treatment-planning walkthroughs',
    nextStep: 'Load this when you want an operational case with a clear treatment and recovery story.',
    promptLabel: 'Dispatch backlog',
    event: 'A planning and dispatch system disruption causes field work to be scheduled manually and service commitments quickly fall behind.',
    asset: 'Planning system, dispatch coordination, and field service commitments',
    cause: 'System disruption, manual-workaround overload, and weak exception triage',
    impact: 'Missed appointments, backlog growth, and customer dissatisfaction',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Dispatch coordination failure', category: 'Operational', source: 'dry-run', description: 'Manual scheduling cannot maintain expected dispatch discipline.' },
      { title: 'Customer appointment breach', category: 'Commercial', source: 'dry-run', description: 'Customer commitments are missed while planning remains degraded.' },
      { title: 'Recovery prioritisation gap', category: 'Business Continuity', source: 'dry-run', description: 'Teams lack a clear rule set for restoring the highest-value work first.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-identity-takeover',
    functionKey: 'technology',
    title: 'Privileged identity takeover affecting shared platforms',
    summary: 'Helpful for identity, control, and rapid containment walkthroughs.',
    bestFor: 'Identity, access, fraud, and executive-visibility walkthroughs',
    nextStep: 'Use this to see how one privileged identity event can become both a technology and continuity problem.',
    promptLabel: 'Identity takeover',
    event: 'A privileged identity is compromised and used to access shared cloud and productivity platforms.',
    asset: 'Privileged identity tier, shared collaboration services, and cloud administration consoles',
    cause: 'Credential theft, session hijack, and weak privileged-access recovery processes',
    impact: 'Administrative misuse, fraud potential, service disruption, and urgent containment activity',
    urgency: 'critical',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Privileged account misuse', category: 'Cyber', source: 'dry-run', description: 'Administrative access is used to change controls or access sensitive systems.' },
      { title: 'Fraud or payment manipulation', category: 'Financial', source: 'dry-run', description: 'Mailbox or workflow access creates financial manipulation risk.' },
      { title: 'Containment-driven disruption', category: 'Business Continuity', source: 'dry-run', description: 'Emergency containment actions disrupt shared business services.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-cloud-exposure',
    functionKey: 'technology',
    title: 'Cloud misconfiguration exposing sensitive data',
    summary: 'Useful for privacy, security, and legal-impact walkthroughs.',
    bestFor: 'Privacy, legal, and notification-impact walkthroughs',
    nextStep: 'Use this to see how a common cloud-control failure turns into regulatory, customer, and response-cost estimates in the next steps.',
    promptLabel: 'Cloud exposure',
    event: 'A cloud storage configuration error exposes sensitive data to unauthorised parties after a routine deployment change.',
    asset: 'Cloud data store containing customer, employee, and operational records',
    cause: 'Misconfiguration, weak change control, and delayed exposure detection',
    impact: 'Data exposure, legal obligations, customer notification, and trust impact',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Sensitive data exposure', category: 'Cyber', source: 'dry-run', description: 'Sensitive records become accessible outside intended controls.' },
      { title: 'Regulatory notification breach', category: 'Compliance', source: 'dry-run', description: 'Notification and remediation obligations increase quickly.' },
      { title: 'Customer trust erosion', category: 'Strategic', source: 'dry-run', description: 'Customer and partner confidence is strained once the exposure becomes public.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-ransomware-services',
    functionKey: 'technology',
    title: 'Ransomware disrupting core business services',
    summary: 'Helpful for service interruption and recovery modelling.',
    bestFor: 'Outage, recovery, and business interruption walkthroughs',
    nextStep: 'Continue after loading to see how the platform frames recovery cost, service dependency, and management action in a severe outage case.',
    promptLabel: 'Ransomware outage',
    event: 'A ransomware event disrupts core business services and slows operational recovery across shared support teams.',
    asset: 'Core business systems, shared files, service operations, and customer-support workflows',
    cause: 'Phishing-led compromise, privilege escalation, and weak endpoint containment',
    impact: 'Business interruption, recovery cost, customer-service degradation, and executive escalation',
    urgency: 'critical',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Critical service outage', category: 'Business Continuity', source: 'dry-run', description: 'Essential services are unavailable during containment and recovery.' },
      { title: 'Recovery cost escalation', category: 'Financial', source: 'dry-run', description: 'Recovery, response, and overtime costs rise quickly.' },
      { title: 'Customer backlog growth', category: 'Operational', source: 'dry-run', description: 'Service backlog and missed commitments build while systems remain constrained.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'technology-release-failure',
    functionKey: 'technology',
    title: 'Critical release failure breaks a shared digital service',
    summary: 'A technology operations example focused on change risk and service recovery.',
    bestFor: 'Change management, release risk, and continuity walkthroughs',
    nextStep: 'Load this when you want a technology-led example that is operationally heavy but not a cyber intrusion case.',
    promptLabel: 'Release failure',
    event: 'A major release introduces a fault into a shared digital service and rollback steps do not restore stability quickly enough.',
    asset: 'Shared digital service, release pipeline, and dependent customer journeys',
    cause: 'Release defect, incomplete rollback readiness, and weak deployment guardrails',
    impact: 'Service instability, recovery effort, and management escalation',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Change-induced outage', category: 'Operational', source: 'dry-run', description: 'Release activity directly destabilises a critical service.' },
      { title: 'Rollback preparedness gap', category: 'Business Continuity', source: 'dry-run', description: 'Rollback plans do not restore service as expected.' },
      { title: 'Customer service disruption', category: 'Commercial', source: 'dry-run', description: 'Customer-facing journeys remain degraded while recovery continues.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-market-entry-delay',
    functionKey: 'strategic',
    title: 'A strategic market entry stalls after key dependencies slip',
    summary: 'Designed for strategy and transformation teams managing execution risk and value erosion.',
    bestFor: 'Strategy execution, dependency, and escalation walkthroughs',
    nextStep: 'Use this when the scenario is primarily strategic and execution-led rather than operationally tactical.',
    promptLabel: 'Market entry delay',
    event: 'A strategic market entry programme falls behind after regulatory, supplier, and operating dependencies slip at the same time.',
    asset: 'Market entry plan, investment case, and launch-critical dependencies',
    cause: 'Execution delays, weak dependency governance, and late management challenge',
    impact: 'Value erosion, delay cost, and executive reprioritisation',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Strategic delivery slippage', category: 'Strategic', source: 'dry-run', description: 'The programme misses critical milestones against the strategic plan.' },
      { title: 'Dependency governance weakness', category: 'Operational', source: 'dry-run', description: 'Key dependencies are not owned or escalated strongly enough.' },
      { title: 'Investment-case erosion', category: 'Financial', source: 'dry-run', description: 'Delay and rework weaken the expected value case.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-partnership-underperformance',
    functionKey: 'strategic',
    title: 'A major partnership underperforms after go-live',
    summary: 'Useful for leaders testing strategic dependency, commercial impact, and response options.',
    bestFor: 'Partnership, strategic dependency, and management-action walkthroughs',
    nextStep: 'Load this to assess a case where the issue is strategic performance rather than a discrete cyber or control incident.',
    promptLabel: 'Partnership underperformance',
    event: 'A flagship strategic partnership underperforms after launch and key growth and service assumptions no longer look credible.',
    asset: 'Strategic partnership model, joint operating plan, and growth commitments',
    cause: 'Weak assumptions, dependency misalignment, and slow governance response',
    impact: 'Strategic value loss, reputational strain, and leadership intervention',
    urgency: 'medium',
    geographies: ['United Arab Emirates', 'United States'],
    risks: [
      { title: 'Strategic value erosion', category: 'Strategic', source: 'dry-run', description: 'The partnership no longer supports the expected business case.' },
      { title: 'Commercial performance shortfall', category: 'Financial', source: 'dry-run', description: 'Commercial outcomes fall behind what was committed.' },
      { title: 'Governance response delay', category: 'Governance', source: 'dry-run', description: 'Leadership decisions do not adapt quickly enough to changed facts.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-transformation-drift',
    functionKey: 'strategic',
    title: 'Transformation programme drift weakens the target operating model',
    summary: 'Built for strategic and enterprise-change users managing programme coherence.',
    bestFor: 'Transformation, operating model, and steering walkthroughs',
    nextStep: 'Use this when you need a more enterprise-wide, strategic lens than a local operational incident.',
    promptLabel: 'Transformation drift',
    event: 'A multi-year transformation programme drifts away from its target operating model and benefits case while delivery continues.',
    asset: 'Transformation roadmap, target operating model, and dependent business change plans',
    cause: 'Scope drift, inconsistent governance, and weak benefit challenge',
    impact: 'Delivery confusion, benefit erosion, and leadership reset pressure',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Operating model inconsistency', category: 'Strategic', source: 'dry-run', description: 'The intended future-state model no longer matches delivery choices.' },
      { title: 'Benefit realisation shortfall', category: 'Financial', source: 'dry-run', description: 'The programme may not deliver the value that justified investment.' },
      { title: 'Change fatigue and execution strain', category: 'Operational', source: 'dry-run', description: 'Teams absorb change without enough clarity or prioritisation.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'strategic-product-quality-crisis',
    functionKey: 'strategic',
    title: 'Product quality concerns threaten a flagship launch',
    summary: 'A strategic case linking quality signals, brand risk, and launch decisions.',
    bestFor: 'Strategic launch, quality, and decision-memo walkthroughs',
    nextStep: 'Load this when you want a strategic scenario that still leads to concrete management action choices.',
    promptLabel: 'Launch quality risk',
    event: 'Quality concerns emerge shortly before a flagship launch and leadership must decide whether to pause, contain, or proceed.',
    asset: 'Flagship product launch, quality assurance evidence, and market commitments',
    cause: 'Late defect signals, weak challenge of launch assumptions, and limited contingency planning',
    impact: 'Launch delay risk, brand impact, and executive decision pressure',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'European Union'],
    risks: [
      { title: 'Strategic launch decision risk', category: 'Strategic', source: 'dry-run', description: 'Leadership must decide under uncertainty with high visible downside.' },
      { title: 'Reputational brand impact', category: 'Strategic', source: 'dry-run', description: 'A weak launch decision could affect external confidence materially.' },
      { title: 'Operational contingency gap', category: 'Operational', source: 'dry-run', description: 'Fallback plans for a delayed or phased launch are not mature enough.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-contractor-safety-incident',
    functionKey: 'hse',
    title: 'A contractor safety incident halts activity at a critical site',
    summary: 'Designed for HSE and operations leaders managing workforce safety and continuity together.',
    bestFor: 'Safety, incident response, and continuity walkthroughs',
    nextStep: 'Use this when the scenario needs an HSE lens first, with operational and governance consequences following.',
    promptLabel: 'Safety incident',
    event: 'A contractor safety incident at a critical site triggers an immediate work stoppage and formal investigation.',
    asset: 'Critical operating site, contractor activity, and safety management controls',
    cause: 'Unsafe work conditions, weak permit discipline, and incomplete contractor oversight',
    impact: 'Work stoppage, investigation burden, and leadership action',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Workplace safety incident', category: 'HSE', source: 'dry-run', description: 'Safety controls fail to prevent a serious contractor incident.' },
      { title: 'Operational stoppage', category: 'Business Continuity', source: 'dry-run', description: 'Critical activity pauses while the site is made safe and investigated.' },
      { title: 'Regulatory investigation pressure', category: 'Regulatory', source: 'dry-run', description: 'External scrutiny may follow a visible safety incident.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-environmental-release',
    functionKey: 'hse',
    title: 'An environmental release from logistics handling prompts urgent containment',
    summary: 'Useful for HSE, supply chain, and operations teams managing environmental response.',
    bestFor: 'Environmental, third-party, and response-governance walkthroughs',
    nextStep: 'Load this to test how environmental containment and service continuity interact under pressure.',
    promptLabel: 'Environmental release',
    event: 'A third-party logistics handling failure causes an environmental release that requires containment and reporting.',
    asset: 'Logistics operation, environmental controls, and dependent service commitments',
    cause: 'Handling failure, weak oversight, and slow incident escalation',
    impact: 'Containment effort, operational disruption, and compliance exposure',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Environmental control breach', category: 'HSE', source: 'dry-run', description: 'Environmental protections fail during outsourced activity.' },
      { title: 'Third-party oversight gap', category: 'Third-Party', source: 'dry-run', description: 'Third-party controls are not governed strongly enough.' },
      { title: 'Operational recovery pressure', category: 'Business Continuity', source: 'dry-run', description: 'Operations remain constrained while containment proceeds.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-heat-stress-operations',
    functionKey: 'hse',
    title: 'Heat-stress exposure disrupts field operations during a critical window',
    summary: 'Tailored to HSE and operations users dealing with field safety and productivity together.',
    bestFor: 'Field safety, planning, and workforce continuity walkthroughs',
    nextStep: 'Use this when you need a people-and-safety scenario rather than a technology or supplier event.',
    promptLabel: 'Heat-stress disruption',
    event: 'Extreme conditions increase heat-stress exposure in field operations and work plans must be curtailed during a critical delivery window.',
    asset: 'Field workforce, shift plans, and critical outdoor operating activity',
    cause: 'Extreme conditions, weak exposure controls, and thin operational contingency',
    impact: 'Safety risk, work slowdown, and delivery pressure',
    urgency: 'high',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Worker safety exposure', category: 'HSE', source: 'dry-run', description: 'Current controls do not reduce field exposure enough for safe work.' },
      { title: 'Operational capacity reduction', category: 'Operational', source: 'dry-run', description: 'Safe operating limits reduce available delivery capacity.' },
      { title: 'Service commitment pressure', category: 'Commercial', source: 'dry-run', description: 'Customers may feel the impact while safe work rules are enforced.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'hse-fire-system-impairment',
    functionKey: 'hse',
    title: 'A fire and life safety system impairment weakens site readiness',
    summary: 'A continuity and safety example for facilities, HSE, and site operations leaders.',
    bestFor: 'Facility safety, continuity, and remediation walkthroughs',
    nextStep: 'Load this to assess how a safety impairment changes the operating posture and decision thresholds for a site.',
    promptLabel: 'Life safety impairment',
    event: 'A fire and life safety system impairment remains unresolved longer than expected at a site that supports critical operations.',
    asset: 'Life safety systems, site readiness controls, and critical facility operations',
    cause: 'Maintenance failure, delayed remediation, and weak escalation of the residual risk',
    impact: 'Reduced site readiness, operating constraints, and management action',
    urgency: 'medium',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Life safety readiness gap', category: 'HSE', source: 'dry-run', description: 'The site is operating with weaker life safety assurance than intended.' },
      { title: 'Operating restriction pressure', category: 'Business Continuity', source: 'dry-run', description: 'Operations may need to be reduced or reconfigured until remediation completes.' },
      { title: 'Governance escalation need', category: 'Governance', source: 'dry-run', description: 'Leadership must decide whether the residual risk is still acceptable.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'supplier-platform-outage',
    functionKey: 'general',
    title: 'Supplier outage on a regulated platform',
    summary: 'Good first example for third-party and resilience risk.',
    bestFor: 'Third-party, resilience, and escalation walkthroughs',
    nextStep: 'Review the starter risks, then continue to see how the platform turns a supplier resilience issue into linked loss and management actions.',
    promptLabel: 'Supplier outage',
    event: 'A critical supplier with privileged access is compromised and disrupts a regulated digital platform during a peak operating period.',
    asset: 'Customer-facing regulated platform, supplier integration layer, and dependent support workflows',
    cause: 'Supplier compromise leading to service disruption, delayed response, and uncertain recovery sequencing',
    impact: 'Service outage, customer disruption, manual-workaround strain, and regulatory scrutiny',
    urgency: 'high',
    geographies: ['United Arab Emirates'],
    risks: [
      { title: 'Third-party service disruption', category: 'Third-Party', source: 'dry-run', description: 'Supplier dependency leads to a material service outage.' },
      { title: 'Regulatory reporting delay', category: 'Compliance', source: 'dry-run', description: 'Incident handling delays increase regulatory exposure.' },
      { title: 'Manual recovery backlog', category: 'Business Continuity', source: 'dry-run', description: 'Fallback operations create sustained pressure on service teams and restoration priorities.' }
    ]
  }),
  createStep1DryRunScenario({
    id: 'dc-recovery-failure',
    functionKey: 'general',
    title: 'Data centre recovery shortfall during a critical outage',
    summary: 'Useful for resilience, continuity, and executive recovery planning walkthroughs.',
    bestFor: 'Resilience, continuity, and treatment-planning walkthroughs',
    nextStep: 'Load this when you want a continuity-heavy case that tests recovery capability more than a pure cyber intrusion.',
    promptLabel: 'Recovery shortfall',
    event: 'A critical hosting location suffers a prolonged outage and recovery does not meet the expected service timeline.',
    asset: 'Primary hosting environment, recovery runbooks, and customer-facing digital services',
    cause: 'Facility or infrastructure failure combined with weak recovery preparedness',
    impact: 'Extended outage, backlog growth, contract pressure, and management scrutiny',
    urgency: 'critical',
    geographies: ['United Arab Emirates', 'Saudi Arabia'],
    risks: [
      { title: 'Recovery capability shortfall', category: 'Business Continuity', source: 'dry-run', description: 'Recovery dependencies are slower or weaker than assumed.' },
      { title: 'Contractual service breach', category: 'Commercial', source: 'dry-run', description: 'Customer commitments are missed during a prolonged outage.' },
      { title: 'Executive escalation pressure', category: 'Governance', source: 'dry-run', description: 'Leadership needs to decide on interim service, communication, and investment actions.' }
    ]
  })
];

STEP1_DRY_RUN_SCENARIOS.sort((left, right) => {
  const explicitOrder = ['supplier-platform-outage', 'dc-recovery-failure'];
  const leftIndex = explicitOrder.indexOf(left.id);
  const rightIndex = explicitOrder.indexOf(right.id);
  if (leftIndex !== -1 || rightIndex !== -1) {
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
      - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  }
  return String(left.title || '').localeCompare(String(right.title || ''));
});

function buildDryRunNarrative(example) {
  return composeGuidedNarrative({
    event: example.event,
    asset: example.asset,
    cause: example.cause,
    impact: example.impact,
    urgency: example.urgency
  }, {
    lensKey: STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey]?.key || '',
    lensLabel: STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey]?.label || ''
  });
}

function getLoadedDryRunScenario(draft = AppState.draft) {
  const loadedId = draft?.loadedDryRunId;
  const availableExamples = getStep1ExampleExperienceModel(getEffectiveSettings(), draft).availableExamples || [];
  return availableExamples.find(example => example.id === loadedId) || null;
}

function clearLoadedDryRunFlag({ save = false } = {}) {
  if (!AppState.draft?.loadedDryRunId) return;
  delete AppState.draft.loadedDryRunId;
  if (save) saveDraft();
}

function resetStep1DryRunContent() {
  AppState.draft.guidedInput = { event: '', asset: '', cause: '', impact: '', urgency: 'medium' };
  AppState.draft.narrative = '';
  AppState.draft.sourceNarrative = '';
  AppState.draft.enhancedNarrative = '';
  AppState.draft.scenarioLens = null;
  AppState.draft.intakeSummary = '';
  AppState.draft.linkAnalysis = '';
  AppState.draft.scenarioTitle = '';
  AppState.draft.riskCandidates = [];
  AppState.draft.selectedRiskIds = [];
  AppState.draft.selectedRisks = [];
  clearLoadedDryRunFlag();
  saveDraft();
  renderWizard1();
  UI.toast('Dry-run example cleared. You can start a fresh assessment now.', 'success');
}

function renderLoadedDryRunBanner(example) {
  if (!example) return '';
  return `<div class="card card--elevated anim-fade-in" style="border-color:var(--accent-gold);background:linear-gradient(180deg, rgba(187,149,74,0.12), rgba(255,255,255,0.02))">
    <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:var(--sp-3)">
      <div>
        <div class="context-panel-title">Dry-run example loaded</div>
        <p class="context-panel-copy" style="margin-top:6px"><strong>${escapeHtml(example.title)}</strong> is active. ${escapeHtml(example.nextStep)}</p>
      </div>
      <button class="btn btn--ghost btn--sm" id="btn-clear-dry-run" type="button">Clear Example</button>
    </div>
    <div class="citation-chips" style="margin-top:var(--sp-4)">
      <span class="badge badge--gold">Dry run</span>
      <span class="badge badge--neutral">Best for: ${escapeHtml(example.bestFor)}</span>
      <span class="badge badge--neutral">${Array.isArray(example.risks) ? example.risks.length : 0} starter risks</span>
    </div>
  </div>`;
}

function hasStep1Content() {
  const draft = AppState.draft || {};
  return !!(
    String(draft.narrative || draft.sourceNarrative || '').trim() ||
    String(draft.guidedInput?.event || '').trim() ||
    getRiskCandidates().length
  );
}

function applyDryRunScenario(example) {
  const settings = getEffectiveSettings();
  const nextNarrative = buildDryRunNarrative(example);
  AppState.draft.guidedInput = {
    event: example.event,
    asset: example.asset,
    cause: example.cause,
    impact: example.impact,
    urgency: example.urgency
  };
  AppState.draft.narrative = nextNarrative;
  AppState.draft.sourceNarrative = nextNarrative;
  AppState.draft.enhancedNarrative = '';
  AppState.draft.intakeSummary = '';
  AppState.draft.linkAnalysis = '';
  AppState.draft.geographies = normaliseScenarioGeographies(example.geographies, settings.geography);
  AppState.draft.geography = formatScenarioGeographies(AppState.draft.geographies, settings.geography);
  const seededRisks = mergeRisks([], example.risks.map(risk => ({ ...risk })));
  AppState.draft.riskCandidates = seededRisks;
  AppState.draft.selectedRiskIds = seededRisks.map(risk => risk.id);
  AppState.draft.selectedRisks = seededRisks.slice();
  AppState.draft.scenarioTitle = example.title;
  AppState.draft.scenarioLens = {
    ...(STEP1_FUNCTION_TO_SCENARIO_LENS[example.functionKey] || STEP1_FUNCTION_TO_SCENARIO_LENS.general)
  };
  AppState.draft.loadedDryRunId = example.id;
  AppState.draft.applicableRegulations = deriveApplicableRegulations(
    getBUList().find(b => b.id === AppState.draft.buId),
    getSelectedRisks(),
    AppState.draft.geographies
  );
  saveDraft();
  renderWizard1();
  UI.toast(`Loaded dry-run example: ${example.title}.`, 'success');
}


function seedRisksFromScenarioDraft(narrative, { force = false, replaceGenerated = false } = {}) {
  const draftText = String(narrative || '').trim();
  if (!draftText) return 0;
  const existingCandidates = getRiskCandidates();
  const selectedRisks = getSelectedRisks();
  if (!force && (selectedRisks.length || existingCandidates.length)) return 0;
  const extractedRisks = guessRisksFromText(draftText, { lensHint: AppState.draft.scenarioLens })
    .filter(risk => !isNoiseRiskText(risk.title))
    .map(risk => ({
      ...risk,
      source: risk.source || 'scenario-draft',
      description: risk.description || 'Generated from the current scenario draft to give you a clear shortlist for the next step.'
    }));
  if (!extractedRisks.length) return 0;
  if (replaceGenerated) replaceSuggestedRiskCandidates(extractedRisks, { selectNew: true });
  else appendRiskCandidates(extractedRisks, { selectNew: true });
  if (!AppState.draft.scenarioTitle && getSelectedRisks()[0]) AppState.draft.scenarioTitle = getSelectedRisks()[0].title;
  return extractedRisks.length;
}

function updateStep1ApplicableRegulations(buList = getBUList(), scenarioGeographies = getScenarioGeographies()) {
  AppState.draft.applicableRegulations = deriveApplicableRegulations(
    (Array.isArray(buList) ? buList : []).find(b => b.id === AppState.draft.buId),
    getSelectedRisks(),
    scenarioGeographies
  );
}

function persistAndRenderStep1({
  buList = getBUList(),
  scenarioGeographies = getScenarioGeographies(),
  refreshRegulations = false
} = {}) {
  if (refreshRegulations) updateStep1ApplicableRegulations(buList, scenarioGeographies);
  saveDraft();
  renderWizard1();
}

function clearStep1StaleAssistState(nextNarrative, { clearGeneratedRisks = false } = {}) {
  const nextSeed = normaliseScenarioSeedText(nextNarrative);
  if (!nextSeed) return;
  const currentSeeds = [
    AppState.draft.sourceNarrative,
    AppState.draft.narrative,
    AppState.draft.enhancedNarrative
  ].map(normaliseScenarioSeedText).filter(Boolean);
  if (currentSeeds.some(seed => seed === nextSeed)) return;
  // Once the underlying scenario changes, stale AI summaries and generated cards become misleading against the visible draft.
  clearScenarioAssistArtifacts({ clearGeneratedRisks });
}

function updateStep1GuidedPreview() {
  const preview = document.getElementById('guided-preview');
  if (!preview) return;
  preview.textContent = composeStep1GuidedNarrative(AppState.draft.guidedInput)
    || 'Complete the guided questions and click “Build Scenario Draft”.';
}

function createStep1GeographySyncHandler({ buList, settings }) {
  return nextGeographies => {
    AppState.draft.geographies = normaliseScenarioGeographies(nextGeographies, settings.geography);
    AppState.draft.geography = formatScenarioGeographies(AppState.draft.geographies, settings.geography);
    persistAndRenderStep1({ buList, scenarioGeographies: AppState.draft.geographies, refreshRegulations: true });
  };
}

function bindStep1PrimaryInputs({ buList, wizardGeographyInput }) {
  document.getElementById('wizard-bu').addEventListener('change', function() {
    const bu = buList.find(b => b.id === this.value) || null;
    AppState.draft.buId = bu?.id || null;
    AppState.draft.buName = bu?.name || null;
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
  });

  document.querySelectorAll('.wizard-geo-chip').forEach(button => {
    button.addEventListener('click', () => {
      const next = Array.from(new Set([...(wizardGeographyInput.getTags() || []), button.dataset.geo]));
      wizardGeographyInput.setTags(next);
    });
  });

  ['event', 'asset', 'cause', 'impact'].forEach(key => {
    document.getElementById(`guided-${key}`).addEventListener('input', function() {
      AppState.draft.guidedInput[key] = this.value;
      clearLoadedDryRunFlag();
      clearStep1StaleAssistState(composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft));
      updateStep1GuidedPreview();
      markDraftDirty();
      scheduleDraftAutosave();
    });
  });

  document.getElementById('guided-urgency').addEventListener('change', function() {
    AppState.draft.guidedInput.urgency = this.value;
    clearLoadedDryRunFlag();
    clearStep1StaleAssistState(composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft));
    updateStep1GuidedPreview();
    markDraftDirty();
    scheduleDraftAutosave();
  });

  document.getElementById('intake-risk-statement').addEventListener('input', function() {
    clearStep1StaleAssistState(this.value);
    AppState.draft.narrative = this.value;
    AppState.draft.sourceNarrative = this.value;
    // Preserve the current function-aware lens while the user edits so later shortlist and AI steps do not reclassify the draft from scratch on every keystroke.
    AppState.draft.scenarioLens = getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft);
    clearLoadedDryRunFlag();
    markDraftDirty();
    scheduleDraftAutosave();
  });
}

function bindStep1ScenarioActions({ buList, settings, exampleModel }) {
  document.getElementById('btn-build-guided-narrative').addEventListener('click', () => {
    const composed = composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft);
    if (!composed) {
      UI.toast('Answer at least one guided question first.', 'warning');
      return;
    }
    clearStep1StaleAssistState(composed, { clearGeneratedRisks: true });
    AppState.draft.narrative = composed;
    AppState.draft.sourceNarrative = composed;
    AppState.draft.scenarioLens = getStep1PreferredScenarioLens(settings, AppState.draft);
    document.getElementById('intake-risk-statement').value = composed;
    const seededCount = seedRisksFromScenarioDraft(composed, { force: true, replaceGenerated: true });
    persistAndRenderStep1();
    UI.toast(seededCount ? `Scenario draft created and shortlist refreshed with ${seededCount} aligned risk${seededCount === 1 ? '' : 's'}.` : 'Scenario draft created from guided answers.', 'success');
  });

  document.querySelectorAll('.guided-prompt-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.draft.guidedInput.event = btn.dataset.prompt;
      document.getElementById('guided-event').value = btn.dataset.prompt;
      clearStep1StaleAssistState(composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft));
      updateStep1GuidedPreview();
      markDraftDirty();
      scheduleDraftAutosave();
    });
  });

  document.querySelectorAll('.btn-load-dry-run').forEach(button => {
    button.addEventListener('click', () => {
      const example = (exampleModel.availableExamples || []).find(entry => entry.id === button.dataset.dryRunId);
      if (!example) return;
      if (hasStep1Content() && !window.confirm('Load this dry-run example and replace the current step-1 scenario draft and shortlist?')) return;
      applyDryRunScenario(example);
    });
  });

  document.getElementById('btn-clear-dry-run')?.addEventListener('click', () => {
    resetStep1DryRunContent();
  });

  document.getElementById('linked-risks-toggle')?.addEventListener('change', function() {
    AppState.draft.linkedRisks = this.checked;
    saveDraft();
  });

  document.getElementById('btn-add-manual-risk').addEventListener('click', () => {
    const input = document.getElementById('manual-risk-add');
    const value = input.value.trim();
    if (!value) return;
    clearLoadedDryRunFlag();
    appendRiskCandidates([{ title: value, category: 'Manual', source: 'manual' }], { selectNew: true });
    input.value = '';
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
  });

  document.getElementById('risk-register-file').addEventListener('change', handleRegisterUpload);
  document.getElementById('btn-enhance-risk-statement').addEventListener('click', enhanceNarrativeWithAI);

  document.getElementById('btn-generate-risks-from-draft')?.addEventListener('click', () => {
    const narrative = document.getElementById('intake-risk-statement')?.value.trim() || AppState.draft.narrative || '';
    if (!narrative) {
      UI.toast('Enter or build a scenario draft first.', 'warning');
      return;
    }
    clearStep1StaleAssistState(narrative, { clearGeneratedRisks: true });
    const seededCount = seedRisksFromScenarioDraft(narrative, { force: true, replaceGenerated: true });
    AppState.draft.narrative = narrative;
    AppState.draft.sourceNarrative = AppState.draft.sourceNarrative || narrative;
    persistAndRenderStep1();
    UI.toast(seededCount ? `Added ${seededCount} risk${seededCount === 1 ? '' : 's'} from the scenario draft.` : 'No additional risks were generated from that draft.', seededCount ? 'success' : 'warning');
  });

  document.getElementById('btn-register-analyse').addEventListener('click', analyseUploadedRegister);
}

function bindStep1NavigationActions({ buList, settings, wizardGeographyInput }) {
  document.getElementById('btn-next-1').addEventListener('click', () => {
    const buId = document.getElementById('wizard-bu').value;
    let narrative = document.getElementById('intake-risk-statement').value.trim();
    let selected = getSelectedRisks();
    if (!buId) {
      const framingDisclosure = Array.from(document.querySelectorAll('.wizard-support-band details'))
        .find(node => /assessment framing and defaults/i.test(node.querySelector('summary')?.textContent || ''));
      if (framingDisclosure) framingDisclosure.open = true;
      document.getElementById('wizard-bu')?.focus();
      UI.toast('Select the business unit in the support section before continuing.', 'warning');
      return;
    }
    if (!narrative) {
      const composed = composeStep1GuidedNarrative(AppState.draft.guidedInput, settings, AppState.draft);
      if (composed) {
        AppState.draft.narrative = composed;
        AppState.draft.sourceNarrative = composed;
        document.getElementById('intake-risk-statement').value = composed;
        narrative = composed;
      }
    }
    if (narrative && !selected.length && !getRiskCandidates().length) {
      seedRisksFromScenarioDraft(narrative, { force: true });
      selected = getSelectedRisks();
    }
    if (!narrative && selected.length) {
      const selectedTitles = selected.slice(0, 3).map(item => item.title).filter(Boolean);
      const buLabel = buList.find(b => b.id === buId)?.name || AppState.draft.buName || 'the selected business unit';
      const geographyLabel = formatScenarioGeographies(wizardGeographyInput.getTags(), settings.geography);
      // Selected-risk-only starts left Step 2 with a blank narrative, so seed a minimal editable scenario before continuing.
      narrative = `Assess the potential impact of ${selectedTitles.join(', ') || 'the selected risks'} affecting ${buLabel}${geographyLabel ? ` in ${geographyLabel}` : ''}.`;
      AppState.draft.narrative = narrative;
      AppState.draft.sourceNarrative = narrative;
      document.getElementById('intake-risk-statement').value = narrative;
    }
    if (!String(AppState.draft.narrative || narrative || '').trim() && !selected.length) { UI.toast('Please complete the guided questions, enter a risk statement, or select at least one risk.', 'warning'); return; }
    AppState.draft.geographies = normaliseScenarioGeographies(wizardGeographyInput.getTags(), settings.geography);
    AppState.draft.geography = formatScenarioGeographies(AppState.draft.geographies, settings.geography);
    AppState.draft.narrative = AppState.draft.narrative.trim();
    AppState.draft.sourceNarrative = normaliseScenarioSeedText(AppState.draft.sourceNarrative || AppState.draft.narrative);
    AppState.draft.enhancedNarrative = AppState.draft.enhancedNarrative || AppState.draft.narrative;
    AppState.draft.applicableRegulations = deriveApplicableRegulations(buList.find(b => b.id === buId), selected, AppState.draft.geographies);
    if (!AppState.draft.scenarioTitle) {
      AppState.draft.scenarioTitle = selected.length === 1 ? selected[0].title : `${selected.length || 1}-risk scenario for ${AppState.draft.buName}`;
    }
    saveDraft();
    Router.navigate('/wizard/2');
  });
}

function renderWizard1() {
  ensureDraftShape();
  const draft = AppState.draft;
  const settings = getEffectiveSettings();
  const buList = getBUList();
  if (ensureStep1ContextPrefills(draft, settings, buList)) saveDraft();
  const selectedRisks = syncRiskSelection(!Array.isArray(draft.selectedRiskIds));
  const riskCandidates = getRiskCandidates();
  const scenarioGeographies = getScenarioGeographies();
  const regs = deriveApplicableRegulations(buList.find(b => b.id === draft.buId), selectedRisks, scenarioGeographies);
  const recommendation = getStep1RecommendedAction(draft, selectedRisks);
  const exampleModel = getStep1ExampleExperienceModel(settings, draft);
  const activeDryRun = getLoadedDryRunScenario(draft);
  const featuredDryRun = STEP1_DRY_RUN_SCENARIOS.find(example => example.id === 'supplier-platform-outage')
    || exampleModel.recommendedExamples[0]
    || exampleModel.availableExamples[0]
    || null;
  const hasScenarioDraft = !!String(draft.narrative || draft.sourceNarrative || '').trim();
  const hasImportedSource = !!String(draft.uploadedRegisterName || '').trim() || (riskCandidates || []).some(risk => risk.source === 'register' || risk.source === 'ai+register');
  const stepReady = !!(hasScenarioDraft || selectedRisks.length);
  const readinessModel = buildAssessmentReadinessModel({
    draft,
    selectedRisks,
    scenarioGeographies
  });
  const contextPreviewModel = buildContextInfluencePreviewModel({
    buId: draft.buId,
    effectiveSettings: settings
  });

  setPage(`
    <main class="page">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(1)}
          <h2 class="wizard-step-title">AI-Assisted Risk &amp; Context Builder</h2>
          <p class="wizard-step-desc">Answer a few prompts, build the first scenario draft, then keep only the risks that belong in the same management discussion.</p>
          <div class="wizard-status-stack">
            <div class="form-help" data-draft-save-state>Draft saves automatically</div>
            ${renderPilotWarningBanner('ai', { compact: true })}
            ${renderStep1ReadinessBanner(draft, selectedRisks)}
          </div>
        </div>
        <div class="wizard-body">
          ${renderAssessmentReadinessStrip(readinessModel)}
          ${renderContextInfluencePreview(contextPreviewModel)}
          ${renderStep1GuidedBuilderCard(draft, recommendation, exampleModel.functionLabel, exampleModel.recommendedExamples.map(example => ({
            label: example.promptLabel,
            prompt: example.event
          })))}
          ${renderStep1SupportBand({
            draft,
            hasScenarioDraft,
            hasImportedSource,
            featuredDryRun,
            recommendedDryRuns: exampleModel.recommendedExamples,
            learnedDryRuns: exampleModel.learnedExamples,
            availableDryRuns: exampleModel.availableExamples,
            functionLabel: exampleModel.functionLabel,
            activeDryRun,
            buList,
            scenarioGeographies,
            regs,
            settings
          })}
          ${renderStep1ScopeBand({ draft, selectedRisks, riskCandidates, regs })}
        </div>
        <div class="wizard-footer">
          <a class="btn btn--ghost" href="#/dashboard">← Dashboard</a>
          <button class="btn ${stepReady ? 'btn--primary' : 'btn--secondary'}" id="btn-next-1" ${stepReady ? '' : 'disabled'}>Continue with ${selectedRisks.length || 0} selected risk${selectedRisks.length === 1 ? '' : 's'} →</button>
        </div>
      </div>
    </main>`);

  if (AppState.dashboardStartIntent === 'register') {
    AppState.dashboardStartIntent = '';
    window.setTimeout(() => {
      document.getElementById('risk-register-file')?.focus();
    }, 0);
  }

  const syncWizardGeographies = createStep1GeographySyncHandler({ buList, settings });
  const wizardGeographyInput = UI.tagInput('ti-wizard-geographies', scenarioGeographies, syncWizardGeographies);
  updateWizardSaveState();
  bindStep1PrimaryInputs({ buList, wizardGeographyInput });
  bindStep1ScenarioActions({ buList, settings, exampleModel });
  bindStep1NavigationActions({ buList, settings, wizardGeographyInput });
  bindRiskCardActions({ buList });
}

function normaliseAssessmentTokens(text) {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 2 && !['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'your', 'have', 'will', 'risk'].includes(token))
  ));
}

function buildStep1AssessmentSignals(narrative) {
  const guidedInput = AppState.draft?.guidedInput || {};
  return {
    scenarioLens: AppState.draft?.scenarioLens || getStep1PreferredScenarioLens(getEffectiveSettings(), AppState.draft),
    eventTokens: normaliseAssessmentTokens(guidedInput.event || narrative).slice(0, 14),
    assetTokens: normaliseAssessmentTokens(guidedInput.asset).slice(0, 10),
    causeTokens: normaliseAssessmentTokens(guidedInput.cause).slice(0, 10),
    impactTokens: normaliseAssessmentTokens(guidedInput.impact).slice(0, 10),
    narrativeTokens: normaliseAssessmentTokens([
      narrative,
      guidedInput.event,
      guidedInput.asset,
      guidedInput.cause,
      guidedInput.impact
    ].filter(Boolean).join(' ')).slice(0, 18)
  };
}

function getRiskAssessmentHaystack(risk) {
  return `${risk.title || ''} ${risk.description || ''} ${risk.category || ''}`.toLowerCase();
}

function countAssessmentMatches(tokens, haystack) {
  if (!Array.isArray(tokens) || !tokens.length) return 0;
  return tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
}

function scoreRiskForCurrentAssessment(risk, assessmentSignals, selectedIds) {
  let score = 0;
  const reasons = [];
  const haystack = getRiskAssessmentHaystack(risk);
  if (selectedIds.has(risk.id)) {
    score += 8;
    reasons.push('Already part of the current shortlist.');
  }
  if (risk.source === 'manual') {
    score += 3;
    reasons.push('Added directly for this assessment.');
  }
  if (risk.source === 'ai+register' || risk.source === 'register') {
    score += 2;
  }
  const hasLensMatch = typeof riskMatchesLens === 'function'
    ? riskMatchesLens(risk, assessmentSignals.scenarioLens)
    : true;
  const lensLabel = String(assessmentSignals?.scenarioLens?.label || 'current').trim().toLowerCase();
  if (!hasLensMatch) {
    score -= 6;
    reasons.push(`Sits outside the current ${lensLabel} scenario lens.`);
  } else if (assessmentSignals?.scenarioLens?.key && assessmentSignals.scenarioLens.key !== 'general') {
    score += 2;
    reasons.push(`Matches the current ${lensLabel} scenario lens.`);
  }

  const eventMatches = countAssessmentMatches(assessmentSignals.eventTokens, haystack);
  const assetMatches = countAssessmentMatches(assessmentSignals.assetTokens, haystack);
  const causeMatches = countAssessmentMatches(assessmentSignals.causeTokens, haystack);
  const impactMatches = countAssessmentMatches(assessmentSignals.impactTokens, haystack);
  const narrativeMatches = countAssessmentMatches(assessmentSignals.narrativeTokens, haystack);

  if (assetMatches) {
    score += 4 + Math.min(assetMatches, 2);
    reasons.push('Matches the same affected asset or service.');
  }
  if (causeMatches) {
    score += 4 + Math.min(causeMatches, 2);
    reasons.push('Matches the same likely cause or attack path.');
  }
  if (impactMatches) {
    score += 3 + Math.min(impactMatches, 2);
    reasons.push('Matches the same business or regulatory impact.');
  }
  if (eventMatches) {
    score += 2 + Math.min(eventMatches, 2);
  }
  if (narrativeMatches >= 2) {
    score += 2;
    reasons.push('Shares the same event wording as the current scenario draft.');
  }

  const fit = selectedIds.has(risk.id)
    ? (score >= 8 ? 'selected' : 'selected-review')
    : score >= 8
      ? 'strong'
      : score >= 4
        ? 'possible'
        : 'weak';
  return {
    score,
    fit,
    reasons: Array.from(new Set(reasons)).slice(0, 2)
  };
}

function explainRiskFit(match, selected) {
  if (selected && match?.reasons?.length) return `Already included in this assessment. ${match.reasons.join(' ')}`;
  if (selected) return 'Already included in this assessment.';
  if (match?.reasons?.length) return match.reasons.join(' ');
  if (match?.fit === 'strong') return 'Good fit because it closely matches the current scenario draft.';
  if (match?.fit === 'possible') return 'Possibly in scope, but review whether it shares the same event and business impact.';
  return 'Likely separate or lower-confidence. Include it only if it clearly belongs in the same assessment.';
}

function renderRiskSelectionSection(title, subtitle, risks, selectedIds, regulations, sectionClass = '') {
  if (!risks.length) return '';
  const sourceLabel = risk => risk.source === 'manual'
    ? 'Manual'
    : risk.source === 'dry-run'
      ? 'Example'
      : risk.source === 'scenario-draft'
        ? 'Built draft'
        : risk.source === 'register' || risk.source === 'ai+register'
          ? 'Upload'
          : 'AI generated';
  // Risk titles, descriptions, and regulation labels can come from uploaded files or AI suggestions, so escape before rendering.
  return `<div class="${escapeHtml(String(sectionClass))}" style="display:flex;flex-direction:column;gap:var(--sp-4)"><div><div class="context-panel-title">${escapeHtml(String(title))}</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(String(subtitle))}</div></div><div class="risk-selection-grid">${risks.map(({ risk, match }) => `<div class="risk-pick-card"><div class="risk-pick-head" style="align-items:flex-start"><label style="display:flex;gap:12px;align-items:flex-start;flex:1;cursor:pointer"><input type="checkbox" class="risk-select-checkbox" data-risk-id="${escapeHtml(String(risk.id || ''))}" ${selectedIds.has(risk.id) ? 'checked' : ''} style="margin-top:4px"><div><div class="risk-pick-title">${escapeHtml(String(risk.title || 'Untitled risk'))}</div><div class="risk-pick-badges"><span class="risk-pick-badge">${escapeHtml(String(risk.category || 'Uncategorized'))}</span><span class="risk-pick-badge risk-pick-badge--source">${escapeHtml(String(sourceLabel(risk)))}</span></div></div></label><button class="btn btn--ghost btn--sm btn-remove-risk" data-risk-id="${escapeHtml(String(risk.id || ''))}" type="button">Remove</button></div>${risk.description ? `<p class="risk-pick-desc">${escapeHtml(String(risk.description))}</p>` : ''}<div class="form-help" style="margin-bottom:10px">${escapeHtml(String(explainRiskFit(match, selectedIds.has(risk.id))))}</div><div class="citation-chips">${(risk.regulations || []).length ? risk.regulations.slice(0, 4).map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('') : regulations.slice(0, 2).map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('')}</div></div>`).join('')}</div></div>`;
}

function renderSelectedRiskCards(riskCandidates, selectedRisks, regulations) {
  const cleanedRisks = (riskCandidates || []).filter(risk => !isNoiseRiskText(risk.title) && risk.title !== '-');
  const selectedIds = new Set((selectedRisks || []).map(risk => risk.id));
  if (!cleanedRisks.length) {
    const hasDraft = !!String(AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || '').trim();
    return `<div class="empty-state"><div>No candidate risks yet. Start with the guided builder, refine a scenario draft with AI, or import a register to build your shortlist.</div>${hasDraft ? `<div style="margin-top:var(--sp-4)"><button class="btn btn--secondary" id="btn-generate-risks-empty-state" type="button">Generate Risks From Current Draft</button></div>` : ''}</div>`;
  }
  const linkedRecommendations = getLinkedRiskRecommendations(selectedRisks || []);
  const narrative = AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft) || '';
  const assessmentSignals = buildStep1AssessmentSignals(narrative);
  const ranked = cleanedRisks
    .map(risk => {
      const match = scoreRiskForCurrentAssessment(risk, assessmentSignals, selectedIds);
      return { risk, match, score: match.score };
    })
    .sort((a, b) => b.score - a.score || String(a.risk.title || '').localeCompare(String(b.risk.title || '')));
  const selectedReviewCount = ranked.filter(item => selectedIds.has(item.risk.id) && item.match.fit === 'selected-review').length;
  const recommended = ranked.filter(item => selectedIds.has(item.risk.id) || item.match.fit === 'strong' || item.score >= 4);
  const extras = ranked.filter(item => !recommended.includes(item));
  const selectedCount = selectedRisks.length;
  const scopeHint = selectedCount > 4
    ? 'This looks broad. Remove risks that do not share the same event, scope, or business impact.'
    : selectedCount >= 1
      ? 'Good scope so far. Keep only the risks that clearly belong in one coherent assessment.'
      : 'Choose the risks that share the same event, scope, or business impact.';
  const additionalRisksDisclosureKey = getDisclosureStateKey('/wizard/1', 'show additional possible risks');
  return `${linkedRecommendations.length ? `<div class="card mb-4" style="background:var(--bg-elevated)"><div class="context-panel-title">Suggested linked-risk groupings</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${linkedRecommendations.map(group => `<div><div style="font-size:.78rem;font-weight:600;color:var(--text-primary)">${escapeHtml(String(group.label || 'Linked risks'))}</div><div class="context-panel-copy" style="margin-top:4px">${escapeHtml(String((Array.isArray(group.risks) ? group.risks : []).join(', ')))}</div></div>`).join('')}</div><div class="context-panel-foot">${escapeHtml(String(AppState.draft.linkAnalysis || 'Treat these as linked where one control or event could trigger the others in the same scenario.'))}</div></div>` : ''}
  ${selectedReviewCount ? `<div class="wizard-summary-band wizard-summary-band--quiet mb-4"><div><div class="wizard-summary-band__label">Scope review suggested</div><strong>${selectedReviewCount} selected risk${selectedReviewCount === 1 ? '' : 's'} may sit outside the current scenario lens</strong><div class="wizard-summary-band__copy">Keep them only if they clearly belong in the same event path, business impact, and management discussion.</div></div></div>` : ''}
  <div class="flex items-center gap-3 mb-4" style="flex-wrap:wrap">
    <button class="btn btn--ghost btn--sm" id="btn-select-all-risks" type="button">Select All</button>
    <button class="btn btn--ghost btn--sm" id="btn-clear-all-risks" type="button">Clear All</button>
    <span class="badge badge--neutral">${selectedCount} selected</span>
    <span class="form-help">${scopeHint}</span>
  </div>
  ${renderRiskSelectionSection('Recommended for this assessment', 'These are the strongest candidates based on the current event, asset, cause, and impact you described.', recommended, selectedIds, regulations)}
  ${extras.length ? `<details class="wizard-disclosure" data-disclosure-state-key="${escapeHtml(additionalRisksDisclosureKey)}" ${getDisclosureOpenState(additionalRisksDisclosureKey, false) ? 'open' : ''}><summary>Show additional possible risks <span class="badge badge--neutral">${extras.length}</span></summary><div class="wizard-disclosure-body">${renderRiskSelectionSection('Available but likely out of scope', 'Keep these only if they clearly belong in the same event path or business outcome.', extras, selectedIds, regulations)}</div></details>` : ''}`;
}

function bindRiskCardActions({ buList = getBUList() } = {}) {
  document.getElementById('btn-generate-risks-empty-state')?.addEventListener('click', () => {
    const narrative = AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || composeStep1GuidedNarrative(AppState.draft.guidedInput, getEffectiveSettings(), AppState.draft) || '';
    const seededCount = seedRisksFromScenarioDraft(narrative, { force: true });
    persistAndRenderStep1();
    UI.toast(seededCount ? `Added ${seededCount} risk${seededCount === 1 ? '' : 's'} from the current draft.` : 'No additional risks were generated from that draft.', seededCount ? 'success' : 'warning');
  });
  document.querySelectorAll('.risk-select-checkbox').forEach(box => {
    box.addEventListener('change', () => {
      const selectedIds = new Set(Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
      if (box.checked) selectedIds.add(box.dataset.riskId);
      else selectedIds.delete(box.dataset.riskId);
      AppState.draft.selectedRiskIds = Array.from(selectedIds);
      syncRiskSelection();
      persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
    });
  });
  document.getElementById('btn-select-all-risks')?.addEventListener('click', () => {
    AppState.draft.selectedRiskIds = getRiskCandidates().map(risk => risk.id);
    syncRiskSelection();
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
  });
  document.getElementById('btn-clear-all-risks')?.addEventListener('click', () => {
    AppState.draft.selectedRiskIds = [];
    syncRiskSelection();
    persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
  });
  document.querySelectorAll('.btn-remove-risk').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.draft.riskCandidates = getRiskCandidates().filter(r => r.id !== btn.dataset.riskId);
      AppState.draft.selectedRiskIds = (AppState.draft.selectedRiskIds || []).filter(id => id !== btn.dataset.riskId);
      syncRiskSelection();
      persistAndRenderStep1({ buList, scenarioGeographies: getScenarioGeographies(), refreshRegulations: true });
    });
  });
}

async function handleRegisterUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = getFileExtension(file.name);
  const unsupported = ['docx', 'pptx', 'pdf', 'zip'];
  if (unsupported.includes(ext)) {
    AppState.draft.uploadedRegisterName = '';
    AppState.draft.registerFindings = '';
    AppState.draft.registerMeta = null;
    saveDraft();
    e.target.value = '';
    UI.toast('This file type is not supported for direct browser parsing. Please export the register as Excel, TXT, CSV, TSV, JSON, or Markdown first.', 'warning', 7000);
    return;
  }
  const parsed = await parseRegisterFile(file);
  if (looksLikeBinaryRegister(parsed.text) && !['xlsx', 'xls'].includes(ext)) {
    AppState.draft.uploadedRegisterName = '';
    AppState.draft.registerFindings = '';
    AppState.draft.registerMeta = null;
    saveDraft();
    e.target.value = '';
    UI.toast('The uploaded file appears to be binary or unreadable. Please convert it to Excel, TXT, CSV, TSV, JSON, or Markdown before uploading.', 'warning', 7000);
    return;
  }
  AppState.draft.uploadedRegisterName = file.name;
  AppState.draft.registerFindings = parsed.text;
  AppState.draft.registerMeta = parsed.meta;
  saveDraft();
  const sheetInfo = parsed.meta?.sheetCount > 1 ? ` (${parsed.meta.sheetCount} sheets parsed)` : '';
  UI.toast(`Loaded ${file.name}${sheetInfo}.`, 'success');
}

async function runIntakeAssist() {
  return window.Step1Assist.runIntakeAssist();
}

async function enhanceNarrativeWithAI() {
  return window.Step1Assist.enhanceNarrativeWithAI();
}

async function analyseUploadedRegister() {
  return window.Step1Assist.analyseUploadedRegister();
}
