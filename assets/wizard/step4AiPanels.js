function getStep4ParameterCoachState(draft = AppState.draft) {
  const coach = draft?.parameterCoach && typeof draft.parameterCoach === 'object' ? draft.parameterCoach : null;
  if (!coach) return null;
  const hasContent = (Array.isArray(coach.parameterRationales) && coach.parameterRationales.length)
    || (Array.isArray(coach.missingHighImpactInputs) && coach.missingHighImpactInputs.length)
    || (Array.isArray(coach.warnings) && coach.warnings.length);
  return hasContent ? coach : null;
}

function renderStep4AiStateStrip(state = {}) {
  if (!state || !state.label) return '';
  const needsRefresh = state.freshnessStatus === 'stale';
  const severityClass = needsRefresh && state.freshnessSeverity === 'critical'
    ? 'ai-product-state-strip--danger'
    : needsRefresh
      ? 'ai-product-state-strip--warning'
      : '';
  return `<div class="ai-product-state-strip ${severityClass}">
    <div>
      <strong>${escapeHtml(needsRefresh ? state.recommendedAction : `${state.label} status`)}</strong>
      <span>${escapeHtml(needsRefresh ? state.refreshReason : `${state.modeLabel} · ${state.freshnessLabel}${state.generatedLabel ? ` · ${state.generatedLabel}` : ''}`)}</span>
    </div>
    <div class="ai-product-state-strip__badges">
      <span class="badge badge--${escapeHtml(state.modeTone || 'neutral')}">${escapeHtml(state.modeLabel || 'AI output')}</span>
      <span class="badge badge--${escapeHtml(state.freshnessTone || 'neutral')}">${escapeHtml(state.freshnessLabel || 'Saved')}</span>
    </div>
  </div>`;
}

function formatParameterCoachRange(range) {
  if (!range || typeof range !== 'object') return 'Not quantified';
  const min = Number(range.min ?? range.low);
  const likely = Number(range.likely);
  const max = Number(range.max ?? range.high);
  if (![min, likely, max].every(Number.isFinite)) return 'Not quantified';
  return `${fmtCurrency(min)} / ${fmtCurrency(likely)} / ${fmtCurrency(max)}`;
}

function getParameterCoachTone(type = '') {
  const next = String(type || '').trim();
  if (next === 'benchmark_proxy_range') return 'gold';
  if (next === 'project_derived_range') return 'success';
  if (next === 'parameter_gap' || next === 'stress_case_candidate') return 'warning';
  return 'neutral';
}

function getParameterCoachActionLabel(action = '') {
  const labels = {
    compare_impact: 'Compare impact',
    run_stress_case: 'Run stress case',
    ask_owner: 'Ask owner',
    keep_current: 'Keep mine'
  };
  return labels[String(action || '').trim()] || 'Keep mine';
}

function renderStep4ParameterCoachMissingInputs(inputs = []) {
  const items = (Array.isArray(inputs) ? inputs : []).slice(0, 3);
  if (!items.length) return '';
  return `<div class="context-chip-grid mt-4">
    ${items.map(input => `<div class="context-chip-panel">
      <span class="context-chip-panel__label">${escapeHtml(input.importance || 'medium')} impact input</span>
      <strong>${escapeHtml(input.field || 'Missing input')}</strong>
      <span class="form-help">${escapeHtml(input.whyItMatters || 'This could change the mapped FAIR parameter.')}</span>
      ${input.suggestedQuestion ? `<div class="form-help mt-2">${escapeHtml(input.suggestedQuestion)}</div>` : ''}
      ${input.linkedParameter ? `<span class="badge badge--neutral mt-3">${escapeHtml(input.linkedParameter)}</span>` : ''}
    </div>`).join('')}
  </div>`;
}

function renderStep4ParameterCoachRationaleCard(rationale = {}, index = 0) {
  const type = String(rationale.suggestionType || '').trim();
  const numeric = type === 'project_derived_range' || type === 'benchmark_proxy_range';
  const key = String(rationale.id || index);
  const refs = [
    ...(Array.isArray(rationale.projectExposureRefs) ? rationale.projectExposureRefs : []),
    ...(Array.isArray(rationale.evidenceRefs) ? rationale.evidenceRefs : [])
  ].filter(Boolean).slice(0, 4);
  return `<div class="context-chip-panel">
    <div class="wizard-premium-head" style="margin-bottom:var(--sp-3)">
      <div>
        <span class="context-chip-panel__label">${escapeHtml(rationale.parameterKey || 'Parameter')}</span>
        <strong>${escapeHtml(getProjectSuggestionTypeLabel(type))}</strong>
      </div>
      <div class="flex items-center gap-2" style="flex-wrap:wrap;justify-content:flex-end">
        <span class="badge badge--${getParameterCoachTone(type)}">${escapeHtml(rationale.sourceStatus || 'unknown')} source</span>
        <span class="badge badge--neutral">${escapeHtml(rationale.confidence || 'unknown')} confidence</span>
      </div>
    </div>
    <div class="grid-2" style="gap:var(--sp-3)">
      <div>
        <span class="context-chip-panel__label">Current range</span>
        <strong>${escapeHtml(formatParameterCoachRange(rationale.currentRange))}</strong>
      </div>
      <div>
        <span class="context-chip-panel__label">${numeric ? 'Suggested range' : 'Coach finding'}</span>
        <strong>${escapeHtml(formatParameterCoachRange(rationale.suggestedRange))}</strong>
      </div>
    </div>
    ${rationale.rationale ? `<p class="form-help mt-3">${escapeHtml(rationale.rationale)}</p>` : ''}
    ${rationale.challenge ? `<div class="banner banner--info mt-3"><span class="banner-icon">?</span><span class="banner-text">${escapeHtml(rationale.challenge)}</span></div>` : ''}
    ${refs.length ? `<div class="citation-chips mt-3">${refs.map(ref => `<span class="badge badge--neutral">${escapeHtml(ref)}</span>`).join('')}</div>` : ''}
    ${renderStep4FeedbackReasonChips('parameter-coach', key, type === 'benchmark_proxy_range' ? 'benchmark_too_high' : type === 'stress_case_candidate' ? 'stress_case' : 'project_financial_input')}
    <div class="flex items-center gap-2 mt-4" style="flex-wrap:wrap">
      ${numeric ? `<button type="button" class="btn btn--secondary btn--sm" data-step4-parameter-coach-apply="${escapeHtml(key)}">Apply suggestion</button>` : ''}
      <button type="button" class="btn btn--ghost btn--sm" data-step4-parameter-coach-action="compare_impact" data-step4-parameter-coach-key="${escapeHtml(key)}">${escapeHtml(getParameterCoachActionLabel('compare_impact'))}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-step4-parameter-coach-action="run_stress_case" data-step4-parameter-coach-key="${escapeHtml(key)}">${escapeHtml(getParameterCoachActionLabel('run_stress_case'))}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-step4-parameter-coach-action="ask_owner" data-step4-parameter-coach-key="${escapeHtml(key)}">${escapeHtml(getParameterCoachActionLabel('ask_owner'))}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-step4-parameter-coach-action="keep_current" data-step4-parameter-coach-key="${escapeHtml(key)}">${escapeHtml(getParameterCoachActionLabel('keep_current'))}</button>
    </div>
  </div>`;
}

function renderStep4ParameterCoachPanel(draft, validation) {
  const coach = getStep4ParameterCoachState(draft);
  const loading = !!AppState.step4ParameterCoachLoading;
  const aiState = buildStep4AiOutputState({
    key: 'parameterCoach',
    label: 'Parameter Coach',
    output: coach,
    currentFingerprint: buildStep4ParameterCoachFingerprint(draft, validation),
    currentFingerprintBreakdown: buildStep4ParameterCoachFingerprintBreakdown(draft, validation)
  });
  const rationales = Array.isArray(coach?.parameterRationales) ? coach.parameterRationales.slice(0, 8) : [];
  const missingInputs = Array.isArray(coach?.missingHighImpactInputs) ? coach.missingHighImpactInputs.slice(0, 3) : [];
  const warnings = Array.isArray(coach?.warnings) ? coach.warnings.filter(Boolean).slice(0, 4) : [];
  const suggestedChangesCount = Number.isFinite(Number(coach?.suggestedChangesCount)) ? Number(coach.suggestedChangesCount) : 0;
  const statusLabel = loading ? 'Generating' : coach ? aiState.freshnessLabel : 'Optional';
  return UI.disclosureSection({
    title: 'AI Parameter Coach',
    badgeLabel: statusLabel,
    badgeTone: coach && !loading ? 'gold' : 'neutral',
    open: Boolean(coach || loading),
    className: 'wizard-disclosure card anim-fade-in',
    body: `<div class="wizard-summary-band wizard-summary-band--quiet">
      <div>
        <div class="wizard-summary-band__label">Range review</div>
        <strong>${coach ? 'Coach suggestions are ready' : 'Review current ranges before running'}</strong>
        <div class="wizard-summary-band__copy">The coach reviews current parameter ranges, project-derived values, benchmark proxies, and unknown high-impact inputs. It never overwrites your inputs automatically.</div>
      </div>
      <div class="wizard-summary-band__meta">
        <span class="badge badge--neutral">${suggestedChangesCount} applyable suggestion${suggestedChangesCount === 1 ? '' : 's'}</span>
        <span class="badge badge--neutral">${missingInputs.length} high-impact gap${missingInputs.length === 1 ? '' : 's'}</span>
        ${validation?.valid === false ? '<span class="badge badge--warning">Validation warnings</span>' : ''}
      </div>
    </div>
    ${renderStep4AiStateStrip(aiState)}
    <div class="flex items-center gap-2 mt-4" style="flex-wrap:wrap">
      <button type="button" class="btn btn--secondary btn--sm" data-step4-parameter-coach-refresh ${loading ? 'disabled' : ''}>${loading ? 'Generating coach...' : coach ? (aiState.freshnessStatus === 'stale' ? 'Refresh recommended' : 'Refresh Parameter Coach') : 'Generate Parameter Coach'}</button>
      <span class="form-help">Unknown project values remain gaps or stress-case candidates, not zero-value ranges.</span>
    </div>
    ${warnings.length ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${warnings.map(escapeHtml).join(' ')}</span></div>` : ''}
    ${missingInputs.length ? `<div class="mt-4"><div class="context-panel-title">Missing high-impact inputs</div>${renderStep4ParameterCoachMissingInputs(missingInputs)}</div>` : ''}
    ${rationales.length ? `<div class="context-chip-grid mt-4">${rationales.map((rationale, index) => renderStep4ParameterCoachRationaleCard(rationale, index)).join('')}</div>` : `<div class="banner banner--info mt-4"><span class="banner-icon">i</span><span class="banner-text">Generate the coach to review project-derived values, benchmark proxies, validation warnings, and decision-sensitive unknowns before running.</span></div>`}
    <div class="form-help mt-4">Applying a coach suggestion requires an explicit click, validates the mapped range, and does not run the simulation.</div>`
  });
}

function getStep4EvidenceMapState(draft = AppState.draft) {
  const evidenceMap = draft?.evidenceMap && typeof draft.evidenceMap === 'object' ? draft.evidenceMap : null;
  if (!evidenceMap) return null;
  const hasContent = (Array.isArray(evidenceMap.supportedClaims) && evidenceMap.supportedClaims.length)
    || (Array.isArray(evidenceMap.unsupportedClaims) && evidenceMap.unsupportedClaims.length)
    || (Array.isArray(evidenceMap.contradictions) && evidenceMap.contradictions.length)
    || (Array.isArray(evidenceMap.projectFinancialEvidenceMap) && evidenceMap.projectFinancialEvidenceMap.length)
    || (evidenceMap.citationQuality && typeof evidenceMap.citationQuality === 'object');
  return hasContent ? evidenceMap : null;
}

function renderStep4EvidenceQualityChips(quality = {}) {
  const strong = Array.isArray(quality.strong) ? quality.strong.length : 0;
  const weak = Array.isArray(quality.weak) ? quality.weak.length : 0;
  const decorative = Array.isArray(quality.decorative) ? quality.decorative.length : 0;
  return `<div class="citation-chips mt-3">
    <span class="badge badge--success">${strong} strong</span>
    <span class="badge badge--neutral">${weak} weak</span>
    <span class="badge badge--warning">${decorative} decorative</span>
  </div>`;
}

function renderStep4EvidenceMapPanel(draft) {
  const evidenceMap = getStep4EvidenceMapState(draft);
  const loading = !!AppState.step4EvidenceMapLoading;
  const aiState = buildStep4AiOutputState({
    key: 'evidenceMap',
    label: 'Evidence Map',
    output: evidenceMap,
    currentFingerprint: buildStep4EvidenceMapFingerprint(draft),
    currentFingerprintBreakdown: buildStep4EvidenceMapFingerprintBreakdown(draft)
  });
  const projectFinancial = Array.isArray(evidenceMap?.projectFinancialEvidenceMap) ? evidenceMap.projectFinancialEvidenceMap : [];
  const foundValues = projectFinancial.filter(item => item.status === 'found').slice(0, 4);
  const missingValues = projectFinancial.filter(item => item.status === 'not_found' || item.status === 'unclear').slice(0, 4);
  const contradictions = Array.isArray(evidenceMap?.contradictions) ? evidenceMap.contradictions.slice(0, 3) : [];
  const unsupported = Array.isArray(evidenceMap?.unsupportedClaims) ? evidenceMap.unsupportedClaims.slice(0, 3) : [];
  const supported = Array.isArray(evidenceMap?.supportedClaims) ? evidenceMap.supportedClaims.slice(0, 3) : [];
  const quality = evidenceMap?.citationQuality && typeof evidenceMap.citationQuality === 'object' ? evidenceMap.citationQuality : {};
  const ragSearch = draft?.evidenceRagSearch && typeof draft.evidenceRagSearch === 'object' ? draft.evidenceRagSearch : {};
  const ragMatchCount = Array.isArray(draft?.ragMatches) ? draft.ragMatches.length : 0;
  const statusLabel = loading ? 'Generating' : evidenceMap ? aiState.freshnessLabel : 'Optional';
  return UI.disclosureSection({
    title: 'Evidence Map',
    badgeLabel: statusLabel,
    badgeTone: evidenceMap && !loading ? 'gold' : 'neutral',
    open: Boolean(evidenceMap || loading),
    className: 'wizard-disclosure card anim-fade-in',
    body: `<div class="wizard-summary-band wizard-summary-band--quiet">
      <div>
        <div class="wizard-summary-band__label">Evidence support</div>
        <strong>${evidenceMap ? 'Evidence map is ready' : 'Map claims to evidence before or after the run'}</strong>
        <div class="wizard-summary-band__copy">The map checks linked citations and RAG matches for supported claims, decorative references, contradictions, and project-financial values. Unknown values stay unknown unless evidence text supports them.</div>
      </div>
      <div class="wizard-summary-band__meta">
        <span class="badge badge--neutral">${supported.length} supported</span>
        <span class="badge badge--warning">${unsupported.length} unsupported</span>
        <span class="badge badge--${contradictions.length ? 'warning' : 'neutral'}">${contradictions.length} contradiction${contradictions.length === 1 ? '' : 's'}</span>
        <span class="badge badge--neutral">${ragMatchCount} retrieved</span>
      </div>
    </div>
    ${renderStep4AiStateStrip(aiState)}
    <div class="flex items-center gap-2 mt-4" style="flex-wrap:wrap">
      <button type="button" class="btn btn--secondary btn--sm" data-step4-evidence-map-refresh ${loading ? 'disabled' : ''}>${loading ? 'Generating map...' : evidenceMap ? (aiState.freshnessStatus === 'stale' ? 'Refresh recommended' : 'Refresh Evidence Map') : 'Generate Evidence Map'}</button>
      <span class="form-help">This searches server-side evidence first when a scoped evidence index exists; it does not change RAG storage or assessment values.</span>
    </div>
    ${ragSearch?.skipped ? `<div class="form-help mt-2">Evidence search skipped: ${escapeHtml(ragSearch.reason || 'No indexed evidence was available for this case.')}</div>` : ''}
    ${ragSearch && !ragSearch.skipped && ragSearch.searchedAt ? `<div class="form-help mt-2">Retrieved ${Number(ragSearch.retainedMatchCount || ragMatchCount || 0)} evidence match${Number(ragSearch.retainedMatchCount || ragMatchCount || 0) === 1 ? '' : 'es'} for this Evidence Map.</div>` : ''}
    ${renderStep4EvidenceQualityChips(quality)}
    ${contradictions.length ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${contradictions.map(item => escapeHtml(item.claim || item.conflictingEvidence || 'Contradiction found')).join(' ')}</span></div>` : ''}
    ${(foundValues.length || missingValues.length) ? `<div class="context-chip-grid mt-4">
      ${foundValues.map(item => `<div class="context-chip-panel">
        <span class="context-chip-panel__label">Found project value</span>
        <strong>${escapeHtml(item.field || 'Project value')}</strong>
        <span class="form-help">${escapeHtml(item.value || item.commentary || 'Evidence text references this value.')}</span>
        ${(Array.isArray(item.evidenceRefs) && item.evidenceRefs.length) ? `<div class="citation-chips mt-3">${item.evidenceRefs.slice(0, 3).map(ref => `<span class="badge badge--success">${escapeHtml(ref)}</span>`).join('')}</div>` : ''}
      </div>`).join('')}
      ${missingValues.map(item => `<div class="context-chip-panel">
        <span class="context-chip-panel__label">Missing project value</span>
        <strong>${escapeHtml(item.field || 'Project value')}</strong>
        <span class="form-help">${escapeHtml(item.commentary || 'Not found in linked evidence; keep this as unknown.')}</span>
      </div>`).join('')}
    </div>` : ''}
    ${unsupported.length ? `<div class="context-chip-grid mt-4">
      ${unsupported.map(item => `<div class="context-chip-panel">
        <span class="context-chip-panel__label">Unsupported claim</span>
        <strong>${escapeHtml(item.claim || 'Claim')}</strong>
        <span class="form-help">${escapeHtml(item.missingEvidence || item.impact || 'No direct evidence was found.')}</span>
      </div>`).join('')}
    </div>` : ''}
    ${!evidenceMap ? `<div class="banner banner--info mt-4"><span class="banner-icon">i</span><span class="banner-text">Generate the map to separate evidence-supported claims from unsupported claims and decorative citations.</span></div>` : ''}
    <div class="form-help mt-4">Evidence Map is advisory and does not block progress.</div>`
  });
}
