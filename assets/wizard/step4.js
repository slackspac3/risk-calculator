// ─── WIZARD STEP 4: REVIEW & RUN ──────────────────────────────
// Extracted from assets/results/resultsRoute.js for module clarity.
// All functions here are globals, consistent with the existing codebase pattern.
// External dependencies: AppState, RiskEngine, Router, UI, fmtCurrency, escapeHtml,
//   buildLiveInputSourceAssignments, buildScenarioQualityCoach, renderScenarioQualityCoach,
//   buildEvidenceGapActionPlan, renderEvidenceGapActionPlan, renderPreRunChallengeBlock,
//   renderSimulationEquationFlow, renderInputSourceAuditBlock, buildParameterChallengeEntries,
//   renderParameterChallengePanel, buildReviewReadinessModel, buildEvidenceTrustSummary,
//   getSelectedRisks, getScenarioMultipliers, getScenarioGeographies, getToleranceThreshold,
//   getWarningThreshold, getAnnualReviewThreshold, getEffectiveSettings,
//   saveAssessment, saveDraft, resetDraft, buildAssessmentIntelligence,
//   buildResolvedObligationSnapshot, recordLearningFromAssessment, buildAssessmentComparison,
//   recordAssessmentRerunLearning, needsReview, isTreatmentVariantAssessment,
//   startSimulationState, updateSimulationProgressState, completeSimulationState,
//   failSimulationState, cancelSimulationState, ASSESSMENT_LIFECYCLE_STATUS,
//   getAssessmentById, renderPilotWarningBanner, buildDecisionReadinessModel,
//   buildAssessmentChallengePass, buildAssessmentManagerRunModel,
//   renderAssessmentManagerPanel, renderDecisionReadinessCard, setPage

function renderPreRunAssumptionExplainer(draft, liveInputAssignments = []) {
  const entries = buildParameterChallengeEntries({
    technicalInputs: draft?.fairParams || {},
    inputAssignments: liveInputAssignments,
    confidence: {
      label: draft?.confidenceLabel || '',
      summary: draft?.evidenceSummary || '',
      reasons: [draft?.evidenceQuality || ''].filter(Boolean),
      improvements: Array.isArray(draft?.missingInformation) ? draft.missingInformation : []
    },
    missingInformation: draft?.missingInformation || [],
    citations: draft?.citations || [],
    primaryGrounding: draft?.primaryGrounding || [],
    supportingReferences: draft?.supportingReferences || [],
    assumptions: draft?.inferredAssumptions || []
  });
  return renderParameterChallengePanel(entries, {
    title: 'Explain a key assumption before you run',
    subtitle: 'Open this only when you want the plain-English meaning, support, and movement logic behind one important input before you commit to the run.'
  });
}

const STEP4_PROJECT_HORIZON_STATUSES = ['known', 'estimated', 'derived', 'evidence_supported', 'benchmark_proxy'];

function normaliseStep4ProjectHorizonStatus(value, fallback = 'unknown') {
  const text = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (!text) return fallback;
  if (['proxy', 'proxied', 'benchmark_proxied'].includes(text)) return 'benchmark_proxy';
  if (['evidence', 'evidence_based'].includes(text)) return 'evidence_supported';
  if ([...STEP4_PROJECT_HORIZON_STATUSES, 'unknown', 'not_provided', 'not_applicable'].includes(text)) return text;
  return fallback;
}

function isStep4ProjectHorizonUsableStatus(status) {
  return STEP4_PROJECT_HORIZON_STATUSES.includes(normaliseStep4ProjectHorizonStatus(status));
}

function getStep4ProjectFinancialStatus(draft = {}, scope = 'buyer', field = '') {
  const economicsKey = scope === 'seller' ? 'sellerEconomics' : 'buyerEconomics';
  const metaKey = scope === 'seller' ? 'sellerEconomicsMeta' : 'buyerEconomicsMeta';
  const economics = draft?.[economicsKey] && typeof draft[economicsKey] === 'object' ? draft[economicsKey] : {};
  const meta = draft?.[metaKey]?.[field] && typeof draft[metaKey][field] === 'object' ? draft[metaKey][field] : {};
  const value = Number(economics[field]);
  const hasValue = Number.isFinite(value);
  return {
    value: hasValue ? value : null,
    status: normaliseStep4ProjectHorizonStatus(meta.status, hasValue ? 'known' : 'unknown'),
    confidence: String(meta.confidence || (hasValue ? 'medium' : 'unknown')).trim() || 'unknown'
  };
}

function pickStep4ProjectFinancialValue(draft = {}, scope = 'buyer', fields = []) {
  const candidates = fields
    .map(field => ({ field, ...getStep4ProjectFinancialStatus(draft, scope, field) }))
    .filter(candidate => candidate.value !== null);
  return candidates.find(candidate => candidate.value > 0) || candidates[0] || null;
}

function combineStep4ProjectStatuses(...statuses) {
  const safeStatuses = statuses.map(status => normaliseStep4ProjectHorizonStatus(status));
  if (!safeStatuses.length || safeStatuses.some(status => !isStep4ProjectHorizonUsableStatus(status))) return 'unknown';
  if (safeStatuses.includes('benchmark_proxy')) return 'benchmark_proxy';
  if (safeStatuses.includes('estimated')) return 'estimated';
  if (safeStatuses.includes('derived')) return 'derived';
  if (safeStatuses.includes('evidence_supported')) return 'evidence_supported';
  return 'known';
}

function buildStep4ProjectHorizonRunContext(draft = AppState.draft || {}, fxMultiplier = 1) {
  const assessmentType = String(draft?.assessmentType || '').trim();
  if (assessmentType !== 'project_buyer' && assessmentType !== 'project_seller') return {};
  const projectContext = draft?.projectContext && typeof draft.projectContext === 'object' ? draft.projectContext : {};
  const durationValue = Number(projectContext.projectDurationMonths);
  const durationMonths = Number.isFinite(durationValue) ? durationValue : null;
  const projectExposure = draft?.projectExposure && typeof draft.projectExposure === 'object' ? draft.projectExposure : {};
  const durationStatus = normaliseStep4ProjectHorizonStatus(
    projectExposure.projectDurationSourceStatus
      || projectExposure.durationSourceStatus
      || projectContext.projectDurationSourceStatus,
    durationMonths === null ? 'unknown' : 'known'
  );
  const context = {
    assessmentType,
    projectHorizonEnabled: true,
    projectDurationMonths: durationMonths,
    projectDurationSourceStatus: durationStatus,
    projectDurationConfidence: String(projectExposure.projectDurationConfidence || projectContext.projectDurationConfidence || (durationStatus === 'known' ? 'medium' : 'low')).trim() || 'unknown'
  };
  if (assessmentType === 'project_buyer') {
    const projectValue = pickStep4ProjectFinancialValue(draft, 'buyer', ['expectedSpend', 'approvedBudget']);
    if (projectValue) {
      context.projectValue = projectValue.value * fxMultiplier;
      context.projectValueSourceStatus = projectValue.status;
    }
    return context;
  }

  const projectValue = pickStep4ProjectFinancialValue(draft, 'seller', ['contractValue', 'expectedRevenue']);
  if (projectValue) {
    context.projectValue = projectValue.value * fxMultiplier;
    context.projectValueSourceStatus = projectValue.status;
  }
  const contributionMargin = getStep4ProjectFinancialStatus(draft, 'seller', 'contributionMargin');
  if (contributionMargin.value !== null) {
    context.projectMargin = contributionMargin.value * fxMultiplier;
    context.projectMarginSourceStatus = contributionMargin.status;
    return context;
  }
  const revenue = pickStep4ProjectFinancialValue(draft, 'seller', ['expectedRevenue', 'contractValue']);
  const grossMarginPct = getStep4ProjectFinancialStatus(draft, 'seller', 'grossMarginPct');
  if (revenue && revenue.value !== null && grossMarginPct.value !== null && isStep4ProjectHorizonUsableStatus(revenue.status) && isStep4ProjectHorizonUsableStatus(grossMarginPct.status)) {
    context.projectMargin = revenue.value * grossMarginPct.value * fxMultiplier;
    context.projectMarginSourceStatus = combineStep4ProjectStatuses(revenue.status, grossMarginPct.status, 'derived');
  }
  return context;
}

function buildSimulationRunPayload() {
  const p = AppState.draft.fairParams || {};
  const scenario = getScenarioMultipliers();
  const toleranceThreshold = getToleranceThreshold();
  const warningThreshold = getWarningThreshold();
  const annualReviewThreshold = getAnnualReviewThreshold();
  const fxMul = AppState.currency === 'AED' ? (1 / AppState.fxRate) : 1;
  const toUSD = value => (value || 0) * fxMul;
  const projectHorizonContext = buildStep4ProjectHorizonRunContext(AppState.draft, fxMul);
  return {
    ep: {
      distType: p.distType || 'triangular',
      iterations: p.iterations || 10000,
      seed: p.seed ?? null,
      tefMin: Number(p.tefMin || 0) * scenario.tefMultiplier,
      tefLikely: Number(p.tefLikely || 0) * scenario.tefMultiplier,
      tefMax: Number(p.tefMax || 0) * scenario.tefMultiplier,
      vulnDirect: p.vulnDirect || false,
      vulnMin: p.vulnMin,
      vulnLikely: p.vulnLikely,
      vulnMax: p.vulnMax,
      threatCapMin: p.threatCapMin,
      threatCapLikely: p.threatCapLikely,
      threatCapMax: p.threatCapMax,
      controlStrMin: p.controlStrMin,
      controlStrLikely: p.controlStrLikely,
      controlStrMax: p.controlStrMax,
      irMin: toUSD(p.irMin) * scenario.lossMultiplier,
      irLikely: toUSD(p.irLikely) * scenario.lossMultiplier,
      irMax: toUSD(p.irMax) * scenario.lossMultiplier,
      biMin: toUSD(p.biMin) * scenario.lossMultiplier,
      biLikely: toUSD(p.biLikely) * scenario.lossMultiplier,
      biMax: toUSD(p.biMax) * scenario.lossMultiplier,
      dbMin: toUSD(p.dbMin) * scenario.lossMultiplier,
      dbLikely: toUSD(p.dbLikely) * scenario.lossMultiplier,
      dbMax: toUSD(p.dbMax) * scenario.lossMultiplier,
      rlMin: toUSD(p.rlMin) * scenario.lossMultiplier,
      rlLikely: toUSD(p.rlLikely) * scenario.lossMultiplier,
      rlMax: toUSD(p.rlMax) * scenario.lossMultiplier,
      tpMin: toUSD(p.tpMin) * scenario.lossMultiplier,
      tpLikely: toUSD(p.tpLikely) * scenario.lossMultiplier,
      tpMax: toUSD(p.tpMax) * scenario.lossMultiplier,
      rcMin: toUSD(p.rcMin) * scenario.lossMultiplier,
      rcLikely: toUSD(p.rcLikely) * scenario.lossMultiplier,
      rcMax: toUSD(p.rcMax) * scenario.lossMultiplier,
      corrBiIr: p.corrBiIr ?? 0.3,
      corrRlRc: p.corrRlRc ?? 0.2,
      secondaryEnabled: p.secondaryEnabled || false,
      secProbMin: Math.min(1, (p.secProbMin || 0) * scenario.secondaryMultiplier),
      secProbLikely: Math.min(1, (p.secProbLikely || 0) * scenario.secondaryMultiplier),
      secProbMax: Math.min(1, (p.secProbMax || 0) * scenario.secondaryMultiplier),
      secMagMin: toUSD(p.secMagMin) * scenario.lossMultiplier,
      secMagLikely: toUSD(p.secMagLikely) * scenario.lossMultiplier,
      secMagMax: toUSD(p.secMagMax) * scenario.lossMultiplier,
      threshold: toleranceThreshold,
      annualReviewThreshold,
      ...projectHorizonContext
    },
    scenario,
    toleranceThreshold,
    warningThreshold,
    annualReviewThreshold,
    currencyContext: {
      displayCurrency: AppState.currency,
      fxRate: AppState.fxRate,
      convertedToUSD: AppState.currency === 'AED'
    }
  };
}

function getSimulationYieldEvery(iterations) {
  const total = Number(iterations || 0);
  return Math.max(100, Math.min(1000, Math.round(total / 80) || 250));
}

function renderRunGuardrailSummary(validation) {
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];
  if (!warnings.length) return '';
  return `<div class="banner banner--warning anim-fade-in anim-delay-2" style="margin-top:var(--sp-4)"><span class="banner-icon">⏱</span><span class="banner-text">${escapeHtml(warnings[0])}${warnings[1] ? ` ${escapeHtml(warnings[1])}` : ''}</span></div>`;
}

function renderPreRunReviewRail(draft, validation, selectedRisks, safeIterations) {
  const review = buildReviewReadinessModel({ draft, validation, selectedRisks, safeIterations });
  return `<div class="wizard-focus-strip wizard-focus-strip--compact anim-fade-in">
    <div class="wizard-focus-card wizard-focus-card--wide">
      <span class="wizard-focus-card__label">Review gate</span>
      <strong>${escapeHtml(review.reviewGateLabel)}</strong>
      <span>${escapeHtml(review.reviewGateCopy)}</span>
    </div>
    <div class="wizard-focus-card">
      <span class="wizard-focus-card__label">Scope and trust</span>
      <strong>${escapeHtml(review.scopeLabel)}</strong>
      <span>${escapeHtml(review.scopeMeta)}</span>
    </div>
  </div>`;
}

function renderPreRunTrustSummary(draft, safeIterations) {
  const trust = buildEvidenceTrustSummary({
    confidenceLabel: draft.confidenceLabel,
    evidenceQuality: draft.evidenceQuality,
    evidenceSummary: draft.evidenceSummary,
    missingInformation: draft.missingInformation,
    inputProvenance: draft.inputProvenance,
    citations: draft.citations,
    primaryGrounding: draft.primaryGrounding,
    supportingReferences: draft.supportingReferences,
    inferredAssumptions: draft.inferredAssumptions,
    inputAssignments: draft.inputAssignments
  });
  const assumptions = Array.isArray(draft.inferredAssumptions) ? draft.inferredAssumptions.filter(Boolean).slice(0, 2) : [];
  return `<div class="wizard-summary-band wizard-summary-band--support anim-fade-in">
    <div>
      <div class="wizard-summary-band__label">Run trust summary</div>
      <strong>${trust.provenanceCount ? `${trust.provenanceCount} tracked provenance item${trust.provenanceCount === 1 ? '' : 's'}` : 'No tracked provenance yet'}</strong>
      <div class="wizard-summary-band__copy">${trust.citationCount ? `${trust.citationCount} supporting citation${trust.citationCount === 1 ? '' : 's'} are linked to the scenario.` : 'This run is still relying mainly on the scenario narrative and current judgement calls.'}${assumptions.length ? ` Main assumption to challenge: ${escapeHtml(assumptions[0])}` : ''}</div>
    </div>
    <div class="wizard-summary-band__meta">
      <span class="badge badge--neutral">${safeIterations.toLocaleString('en-US')} iterations</span>
      <span class="badge badge--neutral">${escapeHtml(String(draft.fairParams?.distType || 'triangular'))} model</span>
    </div>
  </div>`;
}

function renderPreRunActionSpotlight(draft, validation, safeIterations, distType, selectedRisks) {
  const review = buildReviewReadinessModel({ draft, validation, selectedRisks, safeIterations });
  return `<section class="wizard-run-band ${review.toneClass} anim-fade-in">
    <div class="wizard-run-band__summary">
      <div class="wizard-summary-band__label">Run decision</div>
      <strong>${escapeHtml(review.runDecisionLabel)}</strong>
      <p class="wizard-summary-band__copy">${escapeHtml(review.runDecisionCopy)}</p>
      <div class="wizard-summary-band__meta">
        <span class="badge badge--neutral">${safeIterations.toLocaleString('en-US')} iterations</span>
        <span class="badge badge--neutral">${escapeHtml(String(distType || 'triangular'))} model</span>
      </div>
    </div>
    <div id="run-area" class="wizard-run-band__actions">
      <button class="btn btn--primary btn--lg" id="btn-run-sim" style="width:100%;justify-content:center">Run Monte Carlo simulation (${safeIterations} iterations)</button>
      <div class="form-help wizard-run-band__footnote">The result stays reproducible and reviewable after save.</div>
    </div>
  </section>`;
}

function buildDraftFreshnessWarning(draft) {
  const referenceAt = [
    Number(AppState.draftLastSavedAt || 0),
    Number(draft?.savedAt || 0),
    Number(draft?.lifecycleUpdatedAt || 0),
    Number(draft?.createdAt || 0)
  ].find((value) => Number.isFinite(value) && value > 0) || 0;
  if (!referenceAt) return '';
  const ageDays = Math.max(0, Math.floor((Date.now() - referenceAt) / 86400000));
  if (ageDays <= 14) return '';
  return `This draft was last updated ${ageDays} day${ageDays === 1 ? '' : 's'} ago. Review the assumptions before running if conditions have changed.`;
}

function validateFairParams(runPayload = buildSimulationRunPayload(), { toast = true } = {}) {
  const validation = RiskEngine.validateRunParams(runPayload.ep);
  if (toast && !validation.valid) {
    UI.toast(validation.errors[0] || 'Please review the model inputs before running the simulation.', 'danger');
  }
  return validation;
}

function normaliseStep4ValuationMode(value = '', fallback = 'benchmark_led') {
  const service = typeof ProjectParameterSuggestionService !== 'undefined' ? ProjectParameterSuggestionService : null;
  if (service && typeof service.normaliseValuationMode === 'function') {
    return service.normaliseValuationMode(value, fallback);
  }
  const next = String(value || '').trim();
  return ['benchmark_led', 'project_linked', 'hybrid'].includes(next) ? next : fallback;
}

function getStep4ValuationMode(draft = AppState.draft) {
  const service = typeof ProjectParameterSuggestionService !== 'undefined' ? ProjectParameterSuggestionService : null;
  if (service && typeof service.getDefaultValuationMode === 'function') {
    return service.getDefaultValuationMode(draft?.assessmentType, draft?.step4ValuationMode || '');
  }
  const explicit = normaliseStep4ValuationMode(draft?.step4ValuationMode || '', '');
  if (explicit) return explicit;
  const assessmentType = String(draft?.assessmentType || '').trim();
  return assessmentType === 'project_buyer' || assessmentType === 'project_seller' ? 'hybrid' : 'benchmark_led';
}

function hasStep4ProjectExposureContext(draft = AppState.draft) {
  const assessmentType = String(draft?.assessmentType || '').trim();
  if (assessmentType === 'project_buyer' || assessmentType === 'project_seller') return true;
  const exposure = draft?.projectExposure && typeof draft.projectExposure === 'object' ? draft.projectExposure : {};
  return !!String(exposure.projectExposureSummary || '').trim()
    || (Array.isArray(exposure.financialDrivers) && exposure.financialDrivers.length > 0)
    || (Array.isArray(exposure.missingInputs) && exposure.missingInputs.length > 0);
}

function getStep4ProjectParameterSuggestions(draft = AppState.draft) {
  const service = typeof ProjectParameterSuggestionService !== 'undefined' ? ProjectParameterSuggestionService : null;
  if (!service || typeof service.deriveParameterSuggestionsFromProjectExposure !== 'function') return [];
  return service.deriveParameterSuggestionsFromProjectExposure(
    draft?.projectExposure && typeof draft.projectExposure === 'object' ? draft.projectExposure : {},
    draft?.fairParams && typeof draft.fairParams === 'object' ? draft.fairParams : {}
  );
}

function formatProjectSuggestionRange(range) {
  if (!range || typeof range !== 'object') return 'Not quantified';
  return `${fmtCurrency(range.low)} / ${fmtCurrency(range.likely)} / ${fmtCurrency(range.high)}`;
}

function getProjectSuggestionTypeLabel(type = '') {
  const labels = {
    project_derived_range: 'Project-derived range',
    benchmark_proxy_range: 'Benchmark proxy range',
    parameter_gap: 'Parameter gap',
    stress_case_candidate: 'Stress case candidate',
    not_applicable: 'Not applicable'
  };
  return labels[String(type || '').trim()] || 'Project signal';
}

function renderStep4ValuationModeSelector(mode, assessmentType) {
  const options = [
    { key: 'benchmark_led', label: 'Benchmark-led', help: 'Keep the current benchmark-led FAIR ranges primary.' },
    { key: 'project_linked', label: 'Project-linked', help: 'Prioritise quantified project drivers where they are supported.' },
    { key: 'hybrid', label: 'Hybrid', help: 'Show benchmark and project-derived rationale together.' }
  ];
  return `<div class="flex items-center gap-2" role="radiogroup" aria-label="Valuation mode" style="flex-wrap:wrap">
    ${options.map(option => `<button type="button" class="btn ${mode === option.key ? 'btn--secondary' : 'btn--ghost'} btn--sm" role="radio" aria-checked="${mode === option.key ? 'true' : 'false'}" aria-pressed="${mode === option.key ? 'true' : 'false'}" data-step4-valuation-mode="${escapeHtml(option.key)}" title="${escapeHtml(option.help)}">
      ${escapeHtml(option.label)}
    </button>`).join('')}
  </div>
  <div class="form-help mt-2">${assessmentType === 'project_seller'
    ? 'Seller project mode separates revenue, margin, delivery cost, penalties, termination, and recoveries from benchmark-led FAIR ranges.'
    : 'Buyer project mode separates delay, reprocurement, sunk cost, recoveries, and delayed benefit from benchmark-led FAIR ranges.'}</div>`;
}

function getStep4DoubleCountingWarnings(projectExposure = {}) {
  return (Array.isArray(projectExposure?.doubleCountingWarnings) ? projectExposure.doubleCountingWarnings : [])
    .map(item => {
      if (item && typeof item === 'object') return String(item.message || item.label || item.id || '').trim();
      return String(item || '').trim();
    })
    .filter(Boolean)
    .slice(0, 6);
}

function renderStep4MissingInputList(inputs = []) {
  const items = (Array.isArray(inputs) ? inputs : []).slice(0, 3);
  if (!items.length) return '';
  return `<div class="context-chip-grid mt-3">
    ${items.map(input => `<div class="context-chip-panel">
      <span class="context-chip-panel__label">${escapeHtml(input.label || input.field || 'Missing input')}</span>
      <strong>${escapeHtml(input.suggestedQuestion || 'Confirm this project input before quantification.')}</strong>
      <span class="form-help">${escapeHtml(input.whyItMatters || '')}${input.whoMightKnow ? ` Owner: ${escapeHtml(input.whoMightKnow)}.` : ''}</span>
    </div>`).join('')}
  </div>`;
}

const STEP4_PARAMETER_FEEDBACK_REASONS = Object.freeze([
  { key: 'better_internal_data', label: 'Better internal data' },
  { key: 'expert_judgement', label: 'Expert judgement' },
  { key: 'project_financial_input', label: 'Project input' },
  { key: 'benchmark_too_high', label: 'Benchmark too high' },
  { key: 'benchmark_too_low', label: 'Benchmark too low' },
  { key: 'stress_case', label: 'Stress case' },
  { key: 'weak_evidence', label: 'Weak evidence' },
  { key: 'other', label: 'Other' }
]);

function normaliseStep4StructuredReason(value = '', targetType = 'parameter', eventType = 'parameter_change') {
  if (typeof LearningStore !== 'undefined' && LearningStore && typeof LearningStore.normaliseStructuredAiFeedbackReason === 'function') {
    return LearningStore.normaliseStructuredAiFeedbackReason(targetType, value, eventType);
  }
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'other';
}

function recordStep4StructuredAiFeedback(payload = {}) {
  const username = AuthService.getCurrentUser()?.username || '';
  const draft = AppState.draft || {};
  const event = {
    assessmentType: draft.assessmentType || 'enterprise_generic',
    scenarioLens: draft.scenarioLens || null,
    primaryFamily: draft.scenarioLens?.functionKey || '',
    buId: draft.buId || '',
    functionKey: draft.scenarioLens?.functionKey || '',
    lensKey: draft.scenarioLens?.key || '',
    ...payload,
    submittedBy: payload.submittedBy || username
  };
  if (typeof window !== 'undefined' && typeof window.recordStructuredAiFeedback === 'function') {
    return window.recordStructuredAiFeedback(event);
  }
  if (username && typeof LearningStore !== 'undefined' && LearningStore && typeof LearningStore.recordStructuredAiFeedback === 'function') {
    const saved = LearningStore.recordStructuredAiFeedback(username, event);
    if (saved && typeof patchLearningStore === 'function' && typeof LearningStore.getLearningStore === 'function') {
      try {
        patchLearningStore({ aiFeedback: LearningStore.getLearningStore(username).aiFeedback });
      } catch {}
    }
    return saved;
  }
  return null;
}

function renderStep4FeedbackReasonChips(group = 'parameter', key = '', fallbackReason = 'expert_judgement') {
  const safeGroup = String(group || 'parameter').trim();
  const safeKey = String(key || '').trim();
  return `<div class="citation-chips mt-3" aria-label="Optional feedback reason">
    ${STEP4_PARAMETER_FEEDBACK_REASONS.slice(0, 7).map((reason) => {
      const active = reason.key === fallbackReason;
      return `<button type="button" class="btn ${active ? 'btn--secondary' : 'btn--ghost'} btn--sm" data-step4-feedback-reason="${escapeHtml(reason.key)}" data-step4-feedback-group="${escapeHtml(safeGroup)}" data-step4-feedback-key="${escapeHtml(safeKey)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(reason.label)}</button>`;
    }).join('')}
  </div>`;
}

function getSelectedStep4FeedbackReason(group = 'parameter', key = '', fallbackReason = 'expert_judgement') {
  const selector = `[data-step4-feedback-reason][data-step4-feedback-group="${String(group || '').trim()}"][data-step4-feedback-key="${String(key || '').trim()}"][aria-pressed="true"]`;
  const selected = document.querySelector(selector);
  return normaliseStep4StructuredReason(selected?.dataset.step4FeedbackReason || fallbackReason, 'parameter', 'parameter_change');
}

function renderStep4ProjectSuggestionCard(suggestion, mode) {
  const canApply = suggestion.canApply === true && mode !== 'benchmark_led';
  const tone = suggestion.suggestionType === 'benchmark_proxy_range'
    ? 'gold'
    : suggestion.suggestionType === 'parameter_gap' || suggestion.suggestionType === 'stress_case_candidate'
      ? 'warning'
      : suggestion.suggestionType === 'not_applicable'
        ? 'neutral'
        : 'success';
  const gapBadge = suggestion.gapSeverity && suggestion.gapSeverity !== 'minor' && suggestion.gapSeverity !== 'unknown'
    ? `<span class="badge badge--warning">${escapeHtml(suggestion.gapSeverity)} benchmark gap</span>`
    : '';
  return `<div class="context-chip-panel">
    <div class="wizard-premium-head" style="margin-bottom:var(--sp-3)">
      <div>
        <span class="context-chip-panel__label">${escapeHtml(suggestion.bucketLabel || suggestion.bucket || 'Parameter')}</span>
        <strong>${escapeHtml(suggestion.sourceDriver || 'Project exposure driver')}</strong>
      </div>
      <div class="flex items-center gap-2" style="flex-wrap:wrap;justify-content:flex-end">
        <span class="badge badge--${tone}">${escapeHtml(getProjectSuggestionTypeLabel(suggestion.suggestionType))}</span>
        <span class="badge badge--neutral">${escapeHtml(suggestion.sourceStatus || 'unknown')} source</span>
        <span class="badge badge--neutral">${escapeHtml(suggestion.confidence || 'unknown')} confidence</span>
        ${gapBadge}
      </div>
    </div>
    <div class="grid-2" style="gap:var(--sp-3)">
      <div>
        <span class="context-chip-panel__label">Current range</span>
        <strong>${escapeHtml(formatProjectSuggestionRange(suggestion.currentRange))}</strong>
      </div>
      <div>
        <span class="context-chip-panel__label">${suggestion.suggestionType === 'benchmark_proxy_range' ? 'Benchmark proxy range' : 'Project-derived range'}</span>
        <strong>${escapeHtml(formatProjectSuggestionRange(suggestion.projectRange))}</strong>
      </div>
    </div>
    ${suggestion.rationale ? `<p class="form-help mt-3">${escapeHtml(suggestion.rationale)}</p>` : ''}
    ${renderStep4MissingInputList(suggestion.missingInputs)}
    ${renderStep4FeedbackReasonChips('project-suggestion', suggestion.id || '', suggestion.suggestionType === 'benchmark_proxy_range' ? 'benchmark_too_high' : 'project_financial_input')}
    <div class="flex items-center gap-2 mt-4" style="flex-wrap:wrap">
      ${(Array.isArray(suggestion.suggestedActions) ? suggestion.suggestedActions : []).slice(0, 4).map(action => `<span class="badge badge--neutral">${escapeHtml(action)}</span>`).join('')}
      ${canApply ? `<button type="button" class="btn btn--secondary btn--sm" data-step4-project-suggestion-apply="${escapeHtml(suggestion.id)}">Apply suggestion</button>` : ''}
    </div>
  </div>`;
}

function renderStep4ProjectExposurePanel(draft, p) {
  if (!hasStep4ProjectExposureContext(draft)) return '';
  const assessmentType = String(draft?.assessmentType || '').trim();
  const mode = getStep4ValuationMode(draft);
  const suggestions = getStep4ProjectParameterSuggestions(draft);
  const warnings = getStep4DoubleCountingWarnings(draft?.projectExposure || {});
  const numericSuggestions = suggestions.filter(item => item.canApply === true);
  const gapSuggestions = suggestions.filter(item => item.suggestionType === 'parameter_gap' || item.suggestionType === 'stress_case_candidate');
  const shownSuggestions = mode === 'benchmark_led'
    ? [...gapSuggestions, ...suggestions.filter(item => item.suggestionType === 'not_applicable')].slice(0, 6)
    : suggestions.slice(0, 8);
  const summaryCopy = mode === 'benchmark_led'
    ? 'Benchmark-led mode keeps the existing FAIR ranges primary. Project exposure is shown as gaps, assumptions, or stress-case prompts only.'
    : mode === 'project_linked'
      ? 'Project-linked mode lets you apply supported project-derived or benchmark-proxy ranges one bucket at a time.'
      : 'Hybrid mode shows benchmark and project exposure side by side, with major gaps flagged before you run.';
  return UI.disclosureSection({
    title: 'Project financial exposure and FAIR parameters',
    badgeLabel: mode === 'hybrid' ? 'Hybrid' : mode === 'project_linked' ? 'Project-linked' : 'Benchmark-led',
    badgeTone: mode === 'benchmark_led' ? 'neutral' : 'gold',
    open: mode !== 'benchmark_led',
    className: 'wizard-disclosure card anim-fade-in',
    body: `<div class="wizard-summary-band wizard-summary-band--quiet">
      <div>
        <div class="wizard-summary-band__label">Valuation mode</div>
        <strong>${mode === 'hybrid' ? 'Hybrid benchmark and project view' : mode === 'project_linked' ? 'Project-linked view' : 'Benchmark-led view'}</strong>
        <div class="wizard-summary-band__copy">${escapeHtml(summaryCopy)}</div>
      </div>
      <div class="wizard-summary-band__meta">
        <span class="badge badge--neutral">${escapeHtml(assessmentType === 'project_seller' ? 'Seller project' : 'Buyer project')}</span>
        <span class="badge badge--neutral">${numericSuggestions.length} quantified suggestion${numericSuggestions.length === 1 ? '' : 's'}</span>
        <span class="badge badge--neutral">${gapSuggestions.length} gap${gapSuggestions.length === 1 ? '' : 's'}</span>
      </div>
    </div>
    <div class="mt-4">${renderStep4ValuationModeSelector(mode, assessmentType)}</div>
    ${warnings.length ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${warnings.map(escapeHtml).join(' ')}</span></div>` : ''}
    ${shownSuggestions.length ? `<div class="context-chip-grid mt-4">${shownSuggestions.map(suggestion => renderStep4ProjectSuggestionCard(suggestion, mode)).join('')}</div>` : `<div class="banner banner--info mt-4"><span class="banner-icon">i</span><span class="banner-text">No project-derived FAIR suggestions are ready yet. Continue with benchmark-led ranges or add project economics/evidence in the intake step.</span></div>`}
    <div class="form-help mt-4">Applying a suggestion updates only the mapped FAIR bucket range and does not run the simulation.</div>`
  });
}

function setStep4ValuationMode(nextMode) {
  const mode = normaliseStep4ValuationMode(nextMode, getStep4ValuationMode(AppState.draft));
  AppState.draft.step4ValuationMode = mode;
  if (AppState.draft.projectExposure && typeof AppState.draft.projectExposure === 'object') {
    AppState.draft.projectExposure = {
      ...AppState.draft.projectExposure,
      valuationMode: mode
    };
  }
  saveDraft();
  renderWizard4();
}

function applyStep4ProjectParameterSuggestion(suggestionId = '') {
  const service = typeof ProjectParameterSuggestionService !== 'undefined' ? ProjectParameterSuggestionService : null;
  if (!service || typeof service.applyProjectParameterSuggestion !== 'function') {
    UI.toast('Project exposure suggestions are not available in this session.', 'warning');
    return;
  }
  const id = String(suggestionId || '').trim();
  const suggestions = getStep4ProjectParameterSuggestions(AppState.draft);
  const suggestion = suggestions.find(item => String(item.id || '') === id);
  if (!suggestion) {
    UI.toast('That project suggestion is no longer available. Refresh the review step and try again.', 'warning');
    return;
  }
  const previousParams = { ...(AppState.draft.fairParams || {}) };
  const applied = service.applyProjectParameterSuggestion(previousParams, suggestion);
  if (!applied.applied) {
    UI.toast('This project signal is a gap or stress-case prompt, not a supported numeric range.', 'warning');
    return;
  }

  AppState.draft.fairParams = applied.params;
  const validation = validateFairParams(buildSimulationRunPayload(), { toast: false });
  if (!validation.valid) {
    AppState.draft.fairParams = previousParams;
    UI.toast(validation.errors[0] || 'The suggested range did not pass model validation.', 'danger');
    return;
  }

  AppState.draft.fairParamOrigins = {
    ...(AppState.draft.fairParamOrigins || {})
  };
  applied.appliedFields.forEach(field => {
    AppState.draft.fairParamOrigins[field] = {
      source: 'project_exposure',
      label: suggestion.sourceDriver,
      suggestionType: suggestion.suggestionType,
      appliedAt: Date.now()
    };
  });
  AppState.draft.inputProvenance = Array.isArray(AppState.draft.inputProvenance) ? AppState.draft.inputProvenance : [];
  AppState.draft.inputProvenance.unshift({
    origin: 'Project exposure',
    label: `${suggestion.bucketLabel}: ${suggestion.sourceDriver}`,
    detail: `${getProjectSuggestionTypeLabel(suggestion.suggestionType)} applied to ${applied.appliedFields.join(', ')}.`,
    confidence: suggestion.confidence || 'unknown',
    capturedAt: Date.now()
  });
  AppState.draft.inputProvenance = AppState.draft.inputProvenance.slice(0, 20);
  recordStep4StructuredAiFeedback({
    eventType: 'parameter_suggestion_applied',
    targetType: 'parameter',
    targetId: suggestion.id || suggestion.bucket || '',
    reasonCode: getSelectedStep4FeedbackReason('project-suggestion', suggestion.id || '', 'project_financial_input'),
    note: `Applied project exposure suggestion for ${suggestion.bucketLabel || suggestion.bucket || 'parameter'}.`,
    before: { params: previousParams, suggestionType: suggestion.suggestionType },
    after: { params: applied.params, appliedFields: applied.appliedFields },
    projectExposureRefs: [suggestion.sourceDriver || suggestion.id || suggestion.bucket || ''].filter(Boolean),
    sourceStatusBefore: 'unknown',
    sourceStatusAfter: suggestion.sourceStatus || 'derived'
  });
  saveDraft();
  UI.toast('Project exposure suggestion applied. Review the range, then run when ready.', 'success');
  renderWizard4();
}

function getStep4ParameterCoachState(draft = AppState.draft) {
  const coach = draft?.parameterCoach && typeof draft.parameterCoach === 'object' ? draft.parameterCoach : null;
  if (!coach) return null;
  const hasContent = (Array.isArray(coach.parameterRationales) && coach.parameterRationales.length)
    || (Array.isArray(coach.missingHighImpactInputs) && coach.missingHighImpactInputs.length)
    || (Array.isArray(coach.warnings) && coach.warnings.length);
  return hasContent ? coach : null;
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
  const rationales = Array.isArray(coach?.parameterRationales) ? coach.parameterRationales.slice(0, 8) : [];
  const missingInputs = Array.isArray(coach?.missingHighImpactInputs) ? coach.missingHighImpactInputs.slice(0, 3) : [];
  const warnings = Array.isArray(coach?.warnings) ? coach.warnings.filter(Boolean).slice(0, 4) : [];
  const suggestedChangesCount = Number.isFinite(Number(coach?.suggestedChangesCount)) ? Number(coach.suggestedChangesCount) : 0;
  const mode = String(coach?.mode || '').trim();
  const statusLabel = loading ? 'Generating' : coach ? (mode === 'live' ? 'Live AI' : 'Fallback ready') : 'Optional';
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
    <div class="flex items-center gap-2 mt-4" style="flex-wrap:wrap">
      <button type="button" class="btn btn--secondary btn--sm" data-step4-parameter-coach-refresh ${loading ? 'disabled' : ''}>${loading ? 'Generating coach...' : coach ? 'Refresh Parameter Coach' : 'Generate Parameter Coach'}</button>
      <span class="form-help">Unknown project values remain gaps or stress-case candidates, not zero-value ranges.</span>
    </div>
    ${warnings.length ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${warnings.map(escapeHtml).join(' ')}</span></div>` : ''}
    ${missingInputs.length ? `<div class="mt-4"><div class="context-panel-title">Missing high-impact inputs</div>${renderStep4ParameterCoachMissingInputs(missingInputs)}</div>` : ''}
    ${rationales.length ? `<div class="context-chip-grid mt-4">${rationales.map((rationale, index) => renderStep4ParameterCoachRationaleCard(rationale, index)).join('')}</div>` : `<div class="banner banner--info mt-4"><span class="banner-icon">i</span><span class="banner-text">Generate the coach to review project-derived values, benchmark proxies, validation warnings, and decision-sensitive unknowns before running.</span></div>`}
    <div class="form-help mt-4">Applying a coach suggestion requires an explicit click, validates the mapped range, and does not run the simulation.</div>`
  });
}

function buildStep4ParameterCoachPayload(draft = AppState.draft, validation = {}) {
  const selectedRisks = typeof getSelectedRisks === 'function' ? getSelectedRisks() : [];
  return {
    assessmentType: String(draft?.assessmentType || ''),
    scenario: String(draft?.enhancedNarrative || draft?.narrative || draft?.scenarioTitle || ''),
    structuredScenario: draft?.structuredScenario && typeof draft.structuredScenario === 'object' ? draft.structuredScenario : {},
    scenarioLens: draft?.scenarioLens && typeof draft.scenarioLens === 'object' ? draft.scenarioLens : {},
    projectContext: draft?.projectContext && typeof draft.projectContext === 'object' ? draft.projectContext : {},
    projectExposure: draft?.projectExposure && typeof draft.projectExposure === 'object' ? draft.projectExposure : {},
    parameters: draft?.fairParams && typeof draft.fairParams === 'object' ? draft.fairParams : {},
    validation: {
      valid: validation?.valid === true,
      errors: Array.isArray(validation?.errors) ? validation.errors : [],
      warnings: Array.isArray(validation?.warnings) ? validation.warnings : []
    },
    assumptionRegister: draft?.assumptionRegister && typeof draft.assumptionRegister === 'object'
      ? draft.assumptionRegister
      : {
          assumptions: Array.isArray(draft?.inferredAssumptions)
            ? draft.inferredAssumptions.slice(0, 8).map(statement => ({ statement }))
            : []
        },
    evidenceMap: draft?.evidenceMap && typeof draft.evidenceMap === 'object' ? draft.evidenceMap : {},
    citations: Array.isArray(draft?.citations) ? draft.citations : [],
    businessContext: {
      buId: draft?.buId || '',
      buName: draft?.buName || '',
      geography: draft?.geography || '',
      applicableRegulations: Array.isArray(draft?.applicableRegulations) ? draft.applicableRegulations : [],
      selectedRisks: selectedRisks.map(risk => ({ title: risk.title || '', category: risk.category || '' })).slice(0, 8)
    },
    adminSettings: typeof getEffectiveSettings === 'function' ? getEffectiveSettings() : {},
    results: draft?.results && typeof draft.results === 'object' ? draft.results : {},
    traceLabel: `Parameter coach: ${String(draft?.scenarioTitle || 'Review and run').slice(0, 80)}`
  };
}

async function requestStep4ParameterCoach() {
  if (typeof LLMService === 'undefined' || !LLMService || typeof LLMService.generateParameterCoach !== 'function') {
    UI.toast('AI Parameter Coach is not available in this session.', 'warning');
    return;
  }
  const validation = validateFairParams(buildSimulationRunPayload(), { toast: false });
  AppState.step4ParameterCoachLoading = true;
  renderWizard4();
  try {
    const result = await LLMService.generateParameterCoach(buildStep4ParameterCoachPayload(AppState.draft, validation));
    const coach = result?.parameterCoach && typeof result.parameterCoach === 'object' ? result.parameterCoach : {};
    AppState.draft.parameterCoach = {
      ...coach,
      mode: result?.mode || coach.mode || 'deterministic_fallback',
      usedFallback: !!result?.usedFallback,
      aiUnavailable: !!result?.aiUnavailable,
      generatedAt: result?.generatedAt || new Date().toISOString()
    };
    saveDraft();
    UI.toast(result?.usedFallback ? 'Deterministic Parameter Coach is ready.' : 'AI Parameter Coach is ready.', result?.usedFallback ? 'info' : 'success');
  } catch (error) {
    UI.toast(error?.message || 'Parameter Coach could not be generated.', 'danger');
  } finally {
    AppState.step4ParameterCoachLoading = false;
    renderWizard4();
  }
}

function findStep4ParameterCoachRationale(key = '') {
  const rationales = Array.isArray(AppState.draft?.parameterCoach?.parameterRationales)
    ? AppState.draft.parameterCoach.parameterRationales
    : [];
  const id = String(key || '').trim();
  return rationales.find((rationale, index) => String(rationale.id || index) === id) || null;
}

function applyStep4ParameterCoachSuggestion(key = '') {
  const service = typeof ProjectParameterSuggestionService !== 'undefined' ? ProjectParameterSuggestionService : null;
  if (!service || typeof service.applyParameterCoachSuggestion !== 'function') {
    UI.toast('Parameter Coach suggestions are not available in this session.', 'warning');
    return;
  }
  const rationale = findStep4ParameterCoachRationale(key);
  if (!rationale) {
    UI.toast('That coach suggestion is no longer available. Refresh the coach and try again.', 'warning');
    return;
  }
  const previousParams = { ...(AppState.draft.fairParams || {}) };
  const applied = service.applyParameterCoachSuggestion(previousParams, rationale);
  if (!applied.applied) {
    UI.toast('This coach item is a gap or stress-case prompt, not a supported numeric range.', 'warning');
    return;
  }

  AppState.draft.fairParams = applied.params;
  const validation = validateFairParams(buildSimulationRunPayload(), { toast: false });
  if (!validation.valid) {
    AppState.draft.fairParams = previousParams;
    UI.toast(validation.errors[0] || 'The coach range did not pass model validation.', 'danger');
    return;
  }

  AppState.draft.fairParamOrigins = {
    ...(AppState.draft.fairParamOrigins || {})
  };
  applied.appliedFields.forEach(field => {
    AppState.draft.fairParamOrigins[field] = {
      source: 'parameter_coach',
      label: rationale.parameterKey,
      suggestionType: rationale.suggestionType,
      appliedAt: Date.now()
    };
  });
  AppState.draft.inputProvenance = Array.isArray(AppState.draft.inputProvenance) ? AppState.draft.inputProvenance : [];
  AppState.draft.inputProvenance.unshift({
    origin: 'AI Parameter Coach',
    label: rationale.parameterKey || 'Parameter suggestion',
    detail: `${getProjectSuggestionTypeLabel(rationale.suggestionType)} applied to ${applied.appliedFields.join(', ')}.`,
    confidence: rationale.confidence || 'unknown',
    capturedAt: Date.now()
  });
  AppState.draft.inputProvenance = AppState.draft.inputProvenance.slice(0, 20);
  recordStep4StructuredAiFeedback({
    eventType: 'parameter_suggestion_applied',
    targetType: 'parameter',
    targetId: rationale.parameterKey || key || '',
    reasonCode: getSelectedStep4FeedbackReason('parameter-coach', String(rationale.id || key || ''), 'project_financial_input'),
    note: `Applied Parameter Coach suggestion for ${rationale.parameterKey || 'parameter'}.`,
    before: { params: previousParams, suggestionType: rationale.suggestionType },
    after: { params: applied.params, appliedFields: applied.appliedFields },
    projectExposureRefs: Array.isArray(rationale.projectExposureRefs) ? rationale.projectExposureRefs : [],
    sourceStatusBefore: 'unknown',
    sourceStatusAfter: rationale.sourceStatus || 'derived'
  });
  saveDraft();
  UI.toast('Parameter Coach suggestion applied. Review the range, then run when ready.', 'success');
  renderWizard4();
}

function handleStep4ParameterCoachAction(action = '', key = '') {
  const rationale = findStep4ParameterCoachRationale(key);
  const nextAction = String(action || '').trim();
  if (nextAction === 'ask_owner') {
    const question = rationale?.challenge
      || (Array.isArray(AppState.draft?.parameterCoach?.missingHighImpactInputs) ? AppState.draft.parameterCoach.missingHighImpactInputs[0]?.suggestedQuestion : '')
      || 'Can you confirm the missing project input that would most change this parameter?';
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(question).then(
        () => UI.toast('Owner question copied.', 'success'),
        () => UI.toast(question, 'info', 6000)
      );
      return;
    }
    UI.toast(question, 'info', 6000);
    return;
  }
  if (nextAction === 'run_stress_case') {
    recordStep4StructuredAiFeedback({
      eventType: 'parameter_suggestion_rejected',
      targetType: 'parameter',
      targetId: rationale?.parameterKey || key || '',
      reasonCode: getSelectedStep4FeedbackReason('parameter-coach', key, 'stress_case'),
      note: 'User kept baseline and treated the item as a stress-case candidate.',
      before: { rationale },
      after: { userAction: 'run_stress_case' },
      projectExposureRefs: Array.isArray(rationale?.projectExposureRefs) ? rationale.projectExposureRefs : [],
      sourceStatusBefore: rationale?.sourceStatus || 'unknown',
      sourceStatusAfter: 'estimated'
    });
    UI.toast('Keep the current run unchanged, then use the severe case or benchmark proxy as a separate stress comparison.', 'info');
    return;
  }
  if (nextAction === 'compare_impact') {
    UI.toast('Apply the suggestion only if you want to compare it, then run the simulation as a separate saved result.', 'info');
    return;
  }
  recordStep4StructuredAiFeedback({
    eventType: 'parameter_suggestion_rejected',
    targetType: 'parameter',
    targetId: rationale?.parameterKey || key || '',
    reasonCode: getSelectedStep4FeedbackReason('parameter-coach', key, 'expert_judgement'),
    note: 'User kept the current parameter range instead of the coach suggestion.',
    before: { rationale },
    after: { userAction: 'keep_current' },
    projectExposureRefs: Array.isArray(rationale?.projectExposureRefs) ? rationale.projectExposureRefs : [],
    sourceStatusBefore: rationale?.sourceStatus || 'unknown',
    sourceStatusAfter: 'known'
  });
  UI.toast('Keeping your current parameter range.', 'info');
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
  const projectFinancial = Array.isArray(evidenceMap?.projectFinancialEvidenceMap) ? evidenceMap.projectFinancialEvidenceMap : [];
  const foundValues = projectFinancial.filter(item => item.status === 'found').slice(0, 4);
  const missingValues = projectFinancial.filter(item => item.status === 'not_found' || item.status === 'unclear').slice(0, 4);
  const contradictions = Array.isArray(evidenceMap?.contradictions) ? evidenceMap.contradictions.slice(0, 3) : [];
  const unsupported = Array.isArray(evidenceMap?.unsupportedClaims) ? evidenceMap.unsupportedClaims.slice(0, 3) : [];
  const supported = Array.isArray(evidenceMap?.supportedClaims) ? evidenceMap.supportedClaims.slice(0, 3) : [];
  const quality = evidenceMap?.citationQuality && typeof evidenceMap.citationQuality === 'object' ? evidenceMap.citationQuality : {};
  const statusLabel = loading ? 'Generating' : evidenceMap ? (evidenceMap.mode === 'live' ? 'Live AI' : 'Fallback ready') : 'Optional';
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
      </div>
    </div>
    <div class="flex items-center gap-2 mt-4" style="flex-wrap:wrap">
      <button type="button" class="btn btn--secondary btn--sm" data-step4-evidence-map-refresh ${loading ? 'disabled' : ''}>${loading ? 'Generating map...' : evidenceMap ? 'Refresh Evidence Map' : 'Generate Evidence Map'}</button>
      <span class="form-help">This does not change RAG storage or assessment values.</span>
    </div>
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

function buildStep4EvidenceMapPayload(draft = AppState.draft) {
  const selectedRisks = typeof getSelectedRisks === 'function' ? getSelectedRisks() : [];
  const ragMatches = [
    ...(Array.isArray(draft?.ragMatches) ? draft.ragMatches : []),
    ...(Array.isArray(draft?.primaryGrounding) ? draft.primaryGrounding : []),
    ...(Array.isArray(draft?.supportingReferences) ? draft.supportingReferences : [])
  ].filter(item => item && typeof item === 'object');
  return {
    assessmentType: String(draft?.assessmentType || ''),
    scenario: String(draft?.enhancedNarrative || draft?.narrative || draft?.scenarioTitle || ''),
    structuredScenario: draft?.structuredScenario && typeof draft.structuredScenario === 'object' ? draft.structuredScenario : {},
    riskStatement: String(draft?.sourceNarrative || draft?.narrative || draft?.scenarioTitle || ''),
    projectContext: draft?.projectContext && typeof draft.projectContext === 'object' ? draft.projectContext : {},
    projectExposure: draft?.projectExposure && typeof draft.projectExposure === 'object' ? draft.projectExposure : {},
    assumptions: Array.isArray(draft?.inferredAssumptions) ? draft.inferredAssumptions : [],
    parameters: draft?.fairParams && typeof draft.fairParams === 'object' ? draft.fairParams : {},
    citations: Array.isArray(draft?.citations) ? draft.citations : [],
    ragMatches,
    businessContext: {
      buId: draft?.buId || '',
      buName: draft?.buName || '',
      geography: draft?.geography || '',
      applicableRegulations: Array.isArray(draft?.applicableRegulations) ? draft.applicableRegulations : [],
      selectedRisks: selectedRisks.map(risk => ({ title: risk.title || '', category: risk.category || '' })).slice(0, 8)
    },
    adminSettings: typeof getEffectiveSettings === 'function' ? getEffectiveSettings() : {},
    traceLabel: `Evidence map: ${String(draft?.scenarioTitle || 'Review and run').slice(0, 80)}`
  };
}

async function requestStep4EvidenceMap() {
  if (typeof LLMService === 'undefined' || !LLMService || typeof LLMService.generateEvidenceMap !== 'function') {
    UI.toast('Evidence Map is not available in this session.', 'warning');
    return;
  }
  AppState.step4EvidenceMapLoading = true;
  renderWizard4();
  try {
    const result = await LLMService.generateEvidenceMap(buildStep4EvidenceMapPayload(AppState.draft));
    const evidenceMap = result?.evidenceMap && typeof result.evidenceMap === 'object' ? result.evidenceMap : {};
    AppState.draft.evidenceMap = {
      ...evidenceMap,
      mode: result?.mode || evidenceMap.mode || 'deterministic_fallback',
      usedFallback: !!result?.usedFallback,
      aiUnavailable: !!result?.aiUnavailable,
      generatedAt: result?.generatedAt || new Date().toISOString()
    };
    saveDraft();
    UI.toast(result?.usedFallback ? 'Deterministic Evidence Map is ready.' : 'AI Evidence Map is ready.', result?.usedFallback ? 'info' : 'success');
  } catch (error) {
    UI.toast(error?.message || 'Evidence Map could not be generated.', 'danger');
  } finally {
    AppState.step4EvidenceMapLoading = false;
    renderWizard4();
  }
}

// ─── WIZARD 4 ─────────────────────────────────────────────────
function renderWizard4() {
  const draft = AppState.draft;
  const p = draft.fairParams;
  const liveInputAssignments = buildLiveInputSourceAssignments(draft);
  const safeIterations = Math.min(RiskEngine.constants.MAX_ITERATIONS, Math.max(RiskEngine.constants.MIN_ITERATIONS, Number.parseInt(p.iterations, 10) || RiskEngine.constants.DEFAULT_ITERATIONS));
  p.iterations = safeIterations;
  const selectedRisks = getSelectedRisks();
  const multipliers = getScenarioMultipliers();
  const validation = validateFairParams(buildSimulationRunPayload(), { toast: false });
  const scenarioQualityCoach = buildScenarioQualityCoach({
    draft,
    selectedRisks,
    scenarioGeographies: getScenarioGeographies(),
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
  const decisionReadiness = typeof buildDecisionReadinessModel === 'function'
    ? buildDecisionReadinessModel({
        draft,
        selectedRisks,
        scenarioGeographies: getScenarioGeographies(),
        validation,
        safeIterations
      })
    : null;
  const challengePass = typeof buildAssessmentChallengePass === 'function'
    ? buildAssessmentChallengePass({
        draft,
        selectedRisks,
        validation,
        readiness: decisionReadiness
      })
    : null;
  const managerModel = typeof buildAssessmentManagerRunModel === 'function'
    ? buildAssessmentManagerRunModel({
        stage: 'review',
        draft,
        selectedRisks,
        validation,
        readiness: decisionReadiness,
        challenge: challengePass,
        safeIterations
      })
    : null;
  const workflowStatus = typeof buildAssessmentWorkflowStatusModel === 'function'
    ? buildAssessmentWorkflowStatusModel({
        stage: 'review',
        draft,
        selectedRisks,
        scenarioGeographies: getScenarioGeographies(),
        validation,
        readiness: decisionReadiness,
        challenge: challengePass
      })
    : null;
  const challengeStory = typeof buildAssessmentChallengeStory === 'function'
    ? buildAssessmentChallengeStory(challengePass, decisionReadiness)
    : null;
  const draftFreshnessWarning = buildDraftFreshnessWarning(draft);
  setPage(`
    <main class="page" aria-label="Step 5: Review and Run Simulation">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(5)}
          <h2 class="wizard-step-title">Review &amp; Run Simulation</h2>
          <p class="wizard-step-desc">Check the summary, confirm the main assumptions look credible, then run the simulation with confidence. Open deeper detail only if something needs challenge before the run.</p>
        </div>
        <div class="wizard-body">
          ${workflowStatus && typeof renderAssessmentWorkflowStatusStrip === 'function'
            ? renderAssessmentWorkflowStatusStrip(workflowStatus)
            : ''}
          ${managerModel && typeof renderAssessmentManagerPanel === 'function'
            ? renderAssessmentManagerPanel(managerModel, { title: 'Assessment Manager' })
            : ''}
          ${decisionReadiness && typeof renderDecisionReadinessCard === 'function'
            ? renderDecisionReadinessCard(decisionReadiness, { compact: true })
            : ''}
          ${challengeStory && typeof renderAssessmentChallengeStory === 'function'
            ? renderAssessmentChallengeStory(challengeStory)
            : ''}
          ${renderPreRunReviewRail(draft, validation, selectedRisks, safeIterations)}
          ${draftFreshnessWarning ? `<div class="banner banner--info anim-fade-in" style="margin-top:var(--sp-4)"><span class="banner-icon">ℹ</span><span class="banner-text">${escapeHtml(draftFreshnessWarning)}</span></div>` : ''}
          ${renderPreRunTrustSummary(draft, safeIterations)}
          ${renderScenarioQualityCoach(scenarioQualityCoach, {
            title: 'Scenario quality check',
            subtitle: 'Keep this secondary to the run decision. Use it when you want a last confidence check on scope and wording.',
            compact: true,
            lowEmphasis: true,
            disclosureTitle: 'Show full quality coaching',
            className: 'anim-fade-in'
          })}
          ${renderPreRunActionSpotlight(draft, validation, safeIterations, p.distType, selectedRisks)}
          ${renderStep4ProjectExposurePanel(draft, p)}
          ${renderStep4ParameterCoachPanel(draft, validation)}
          ${renderStep4EvidenceMapPanel(draft)}
          ${evidenceGapPlan.length ? renderEvidenceGapActionPlan(evidenceGapPlan, {
            title: 'Before you run, improve one of these',
            subtitle: 'Keep this secondary to the run decision. Tighten one gap only if it would materially change confidence or the range.',
            compact: true,
            lowEmphasis: true,
            className: 'anim-fade-in'
          }) : ''}
          ${renderRunGuardrailSummary(validation)}
          <div id="sim-progress" class="hidden">
            <div class="card sim-progress-card">
              <div class="sim-progress-mark" aria-hidden="true">◌</div>
              <div class="sim-progress-title">Running simulation</div>
              <div id="sim-progress-text" class="sim-progress-copy">Computing ${safeIterations} Monte Carlo iterations…</div>
              <div class="sim-progress-track">
                <div id="sim-progress-bar" class="sim-progress-fill"></div>
              </div>
              <div id="sim-progress-meta" class="sim-progress-meta">Yielding frequently so the page stays responsive.</div>
              <button class="btn btn--ghost btn--sm" id="btn-cancel-sim" style="margin-top:var(--sp-5)">Cancel Run</button>
            </div>
          </div>
          ${UI.disclosureSection({
            title: 'Scenario summary for this run',
            badgeLabel: 'Review detail',
            badgeTone: 'neutral',
            open: false,
            className: 'wizard-disclosure card card--elevated anim-fade-in',
            body: `<div style="display:flex;align-items:center;gap:var(--sp-4);margin-bottom:var(--sp-5)">
              <div style="width:48px;height:48px;background:rgba(26,86,219,.15);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🏢</div>
              <div>
                <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted)">Business Unit</div>
                <div style="font-size:var(--text-lg);font-weight:600;font-family:var(--font-display)">${draft.buName||'—'}</div>
              </div>
            </div>
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:var(--sp-2)">Scenario</div>
            <div style="font-size:var(--text-base);font-weight:600;font-family:var(--font-display);margin-bottom:var(--sp-3)">${draft.scenarioTitle||'Untitled'}</div>
            <p style="font-size:.85rem;color:var(--text-secondary);line-height:1.7">${(draft.enhancedNarrative || draft.narrative || '').substring(0,280)}${(draft.enhancedNarrative || draft.narrative || '').length>280?'…':''}</p>
            ${draft.llmAssisted?'<span class="badge badge--success" style="margin-top:12px">✓ AI-Assisted</span>':''}
            ${selectedRisks.length ? `<div class="mt-4"><div class="context-panel-title">Scenario Scope</div><div class="citation-chips">${selectedRisks.map(r => `<span class="badge badge--neutral">${r.title}</span>`).join('')}</div><div class="context-panel-foot">${multipliers.linked ? `${selectedRisks.length} linked risks selected. Uplift is being applied to event frequency and loss components.` : `${selectedRisks.length} risks selected. Combined scenario, no linked uplift.`}</div></div>` : ''}`
          })}
          ${UI.disclosureSection({ title: 'Challenge these 3 assumptions first', badgeLabel: 'Recommended', badgeTone: 'warning', open: false, className: 'wizard-disclosure card anim-fade-in', body: renderPreRunChallengeBlock(draft) })}
          ${UI.disclosureSection({ title: 'How the result is built', badgeLabel: 'Optional guide', badgeTone: 'neutral', open: false, className: 'wizard-disclosure card anim-fade-in', body: renderSimulationEquationFlow() })}
          ${UI.disclosureSection({ title: 'Current source of each key input', badgeLabel: 'Optional detail', badgeTone: 'neutral', open: false, className: 'wizard-disclosure card anim-fade-in', body: renderInputSourceAuditBlock(liveInputAssignments) })}
          ${UI.disclosureSection({ title: 'Explain a key assumption before you run', badgeLabel: 'Optional detail', badgeTone: 'neutral', open: false, className: 'wizard-disclosure card anim-fade-in', body: renderPreRunAssumptionExplainer(draft, liveInputAssignments) })}
          ${UI.disclosureSection({
            title: 'Key parameters before you run',
            badgeLabel: 'Open for review',
            badgeTone: 'neutral',
            open: false,
            className: 'wizard-disclosure card anim-fade-in anim-delay-1',
            body: `<div class="grid-3">
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Event frequency</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${p.tefMin}–${p.tefLikely}–${p.tefMax}</div><div style="font-size:.7rem;color:var(--text-muted)">events/year</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Threat capability</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${p.threatCapMin}–${p.threatCapLikely}–${p.threatCapMax}</div><div style="font-size:.7rem;color:var(--text-muted)">0–1 scale</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Control strength</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${p.controlStrMin}–${p.controlStrLikely}–${p.controlStrMax}</div><div style="font-size:.7rem;color:var(--text-muted)">0–1 scale</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">IR & Recovery</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${fmtCurrency(p.irMin)}–${fmtCurrency(p.irMax)}</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Business Int.</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${fmtCurrency(p.biMin)}–${fmtCurrency(p.biMax)}</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Reg & Legal</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${fmtCurrency(p.rlMin)}–${fmtCurrency(p.rlMax)}</div></div>
            </div>
            <div class="mt-4" style="font-size:.78rem;color:var(--text-muted)">Iterations: <strong>${p.iterations||10000}</strong> · Distribution: <strong>${p.distType||'triangular'}</strong> · Threshold: <strong>${fmtCurrency(getToleranceThreshold())}</strong> · Geography: <strong>${draft.geography || '—'}</strong></div>
            ${draft.applicableRegulations?.length ? `<div class="citation-chips mt-3">${draft.applicableRegulations.map(tag => `<span class="badge badge--gold">${tag}</span>`).join('')}</div>` : ''}`
          })}
          <div class="banner banner--poc anim-fade-in anim-delay-2"><span class="banner-icon">⚠</span><span class="banner-text">Pilot decision-support tool. FAIR input ranges should still be challenged through expert judgement before higher-stakes production decisions.</span></div>
        </div>
        <div class="wizard-footer">
          <button class="btn btn--ghost" id="btn-back-4">← Back</button>
        </div>
      </div>
    </main>`);

  document.getElementById('btn-back-4')?.addEventListener('click', () => Router.navigate('/wizard/4'));
  document.getElementById('btn-run-sim')?.addEventListener('click', runSimulation);
  document.querySelectorAll('[data-step4-valuation-mode]').forEach(button => {
    button.addEventListener('click', () => setStep4ValuationMode(button.dataset.step4ValuationMode));
  });
  document.querySelectorAll('[data-step4-project-suggestion-apply]').forEach(button => {
    button.addEventListener('click', () => applyStep4ProjectParameterSuggestion(button.dataset.step4ProjectSuggestionApply));
  });
  document.querySelectorAll('[data-step4-parameter-coach-refresh]').forEach(button => {
    button.addEventListener('click', requestStep4ParameterCoach);
  });
  document.querySelectorAll('[data-step4-feedback-reason]').forEach(button => {
    button.addEventListener('click', () => {
      const group = String(button.dataset.step4FeedbackGroup || '').trim();
      const key = String(button.dataset.step4FeedbackKey || '').trim();
      document.querySelectorAll(`[data-step4-feedback-reason][data-step4-feedback-group="${group}"][data-step4-feedback-key="${key}"]`).forEach(peer => {
        const active = peer === button;
        peer.setAttribute('aria-pressed', active ? 'true' : 'false');
        peer.classList.toggle('btn--secondary', active);
        peer.classList.toggle('btn--ghost', !active);
      });
    });
  });
  document.querySelectorAll('[data-step4-parameter-coach-apply]').forEach(button => {
    button.addEventListener('click', () => applyStep4ParameterCoachSuggestion(button.dataset.step4ParameterCoachApply));
  });
  document.querySelectorAll('[data-step4-parameter-coach-action]').forEach(button => {
    button.addEventListener('click', () => handleStep4ParameterCoachAction(button.dataset.step4ParameterCoachAction, button.dataset.step4ParameterCoachKey));
  });
  document.querySelectorAll('[data-step4-evidence-map-refresh]').forEach(button => {
    button.addEventListener('click', requestStep4EvidenceMap);
  });
  document.getElementById('btn-cancel-sim')?.addEventListener('click', () => {
    const w = AppState.simulationRunToken;
    if (!w) return;
    w.terminate();
    if (typeof w.__cancelSimulationPromise === 'function') {
      const error = new Error('Simulation cancelled.');
      error.code = 'SIMULATION_CANCELLED';
      w.__cancelSimulationPromise(error);
    }
    AppState.simulationRunToken = null;
    cancelSimulationState('Cancellation requested…');
    const progressText = document.getElementById('sim-progress-text');
    const progressMeta = document.getElementById('sim-progress-meta');
    if (progressText) progressText.textContent = 'Cancelling the simulation…';
    if (progressMeta) progressMeta.textContent = 'The current run will stop at the next safe checkpoint.';
  });
  if (AppState.pendingParameterChallengeAutoRun && String(AppState.pendingParameterChallengeAutoRun.assessmentId || '') === String(draft.id || '')) {
    AppState.pendingParameterChallengeAutoRun = null;
    window.setTimeout(() => {
      UI.toast('Reviewer adjustment loaded. Re-running the simulation now.', 'info', 3200);
      runSimulation();
    }, 120);
  }
  if (AppState.pendingConsensusAutoRun && String(AppState.pendingConsensusAutoRun.assessmentId || '') === String(draft.id || '')) {
    AppState.pendingConsensusAutoRun = null;
    window.setTimeout(() => {
      UI.toast('Consensus path loaded. Re-running the simulation now.', 'info', 3200);
      runSimulation();
    }, 120);
  }
}

async function runSimulation() {
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));
  const runPayload = buildSimulationRunPayload();
  const validation = validateFairParams(runPayload);
  if (!validation.valid) return;
  const selectedRisks = getSelectedRisks();
  const runtimeWarnings = Array.isArray(validation.warnings) ? validation.warnings : [];
  const runAreaEl = document.getElementById('run-area');
  const simProgressEl = document.getElementById('sim-progress');
  if (!runAreaEl || !simProgressEl) {
    // Review/run can be re-rendered while a deferred action is still in flight; fail closed instead of crashing.
    UI.toast('The simulation workspace is no longer available. Re-open Review & Run and try again.', 'warning');
    return;
  }
  runAreaEl.classList.add('hidden');
  simProgressEl.classList.remove('hidden');
  await new Promise(r => setTimeout(r, 80));
  await new Promise(requestAnimationFrame);
  try {
    const p = AppState.draft.fairParams;
    const baselineAssessment = AppState.draft.comparisonBaselineId
      ? getAssessmentById(AppState.draft.comparisonBaselineId)
      : null;
    const { ep, scenario, toleranceThreshold, warningThreshold, annualReviewThreshold, currencyContext } = runPayload;
    const progressText = document.getElementById('sim-progress-text');
    const progressMeta = document.getElementById('sim-progress-meta');
    const progressBar = document.getElementById('sim-progress-bar');
    const progressButton = document.getElementById('btn-cancel-sim');
    p.iterations = validation.normalizedParams.iterations;
    p.seed = validation.normalizedParams.seed;
    startSimulationState(validation.normalizedParams.iterations);
    if (runtimeWarnings.length && progressMeta) progressMeta.textContent = runtimeWarnings.join(' ');
    const yieldEvery = getSimulationYieldEvery(validation.normalizedParams.iterations);
    const results = await new Promise((resolve, reject) => {
      const worker = new Worker('assets/engine/riskEngineWorker.js');
      const timeoutId = window.setTimeout(() => {
        worker.terminate();
        AppState.simulationRunToken = null;
        const error = new Error('Simulation timed out during computation.');
        reject(error);
      }, 20000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        worker.onmessage = null;
        worker.onerror = null;
        worker.__cancelSimulationPromise = null;
      };

      worker.__cancelSimulationPromise = error => {
        cleanup();
        reject(error);
      };

      worker.onmessage = function (e) {
        const data = e?.data && typeof e.data === 'object' ? e.data : {};
        if (data.type === 'PROGRESS') {
          const ratio = Number(data.ratio || 0);
          const completed = Number(data.completed || 0);
          const total = Number(data.total || 0);
          const message = `Computing ${completed.toLocaleString()} of ${total.toLocaleString()} Monte Carlo iterations…`;
          updateSimulationProgressState({ ratio, completed, total, message });
          if (progressText) progressText.textContent = message;
          if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
          if (progressMeta) progressMeta.textContent = `Seed ${String(validation.normalizedParams.seed ?? 'pending')} · checkpoint every ${yieldEvery.toLocaleString()} iterations`;
          return;
        }
        if (data.type === 'RESULT') {
          worker.terminate();
          AppState.simulationRunToken = null;
          cleanup();
          resolve(data.result);
          return;
        }
        if (data.type === 'ERROR') {
          worker.terminate();
          AppState.simulationRunToken = null;
          cleanup();
          const error = new Error(String(data.message || 'The simulation could not be completed right now. Try again in a moment.'));
          error.code = String(data.code || 'SIM_ERROR');
          reject(error);
        }
      };

      worker.onerror = function () {
        worker.terminate();
        AppState.simulationRunToken = null;
        cleanup();
        const error = new Error('The simulation could not be completed right now. Try again in a moment.');
        error.code = 'SIM_ERROR';
        reject(error);
      };

      AppState.simulationRunToken = worker;
      worker.postMessage({
        type: 'RUN',
        params: validation.normalizedParams
      });
    });
    AppState.simulationRunToken = null;
    if (progressText) progressText.textContent = 'Finalising the simulation results…';
    if (progressButton) {
      progressButton.disabled = true;
      progressButton.textContent = 'Finishing…';
    }
    if (progressBar) progressBar.style.width = '100%';
    updateSimulationProgressState({
      completed: p.iterations,
      total: p.iterations,
      ratio: 1,
      message: 'Finalising the simulation results…'
    });
    await yieldToUI();
    await new Promise(requestAnimationFrame);
    results.inputs = {
      ...validation.normalizedParams,
      seed: results.runConfig?.seed ?? validation.normalizedParams.seed
    };
    results.portfolioMeta = scenario;
    results.selectedRiskCount = scenario.riskCount;
    results.applicableRegulations = [...(AppState.draft.applicableRegulations || [])];
    results.warningThreshold = warningThreshold;
    results.annualReviewThreshold = annualReviewThreshold;
    results.nearTolerance = results.eventLoss.p90 >= warningThreshold && results.eventLoss.p90 < toleranceThreshold;
    results.annualReviewTriggered = results.annualLoss.p90 >= annualReviewThreshold;
    const obligationBasis = typeof buildResolvedObligationSnapshot === 'function'
      ? buildResolvedObligationSnapshot({
          context: getEffectiveSettings()?.resolvedObligationContext || AppState.draft?.obligationBasis,
          capturedAt: Date.now()
        })
      : null;
    const obligationDerivedRegulations = Array.isArray(obligationBasis?.resolvedApplicableRegulations)
      ? obligationBasis.resolvedApplicableRegulations
      : [];
    const draftForAssessment = {
      ...AppState.draft,
      obligationBasis,
      applicableRegulations: Array.from(new Set([
        ...(Array.isArray(AppState.draft?.applicableRegulations) ? AppState.draft.applicableRegulations : []),
        ...obligationDerivedRegulations
      ].map(item => String(item || '').trim()).filter(Boolean)))
    };
    results.applicableRegulations = [...(draftForAssessment.applicableRegulations || [])];
    const assessmentIntelligence = buildAssessmentIntelligence(draftForAssessment, results, validation.normalizedParams, scenario);
    const decisionReadiness = typeof buildDecisionReadinessModel === 'function'
      ? buildDecisionReadinessModel({
          draft: draftForAssessment,
          selectedRisks,
          scenarioGeographies: getScenarioGeographies(),
          validation,
          safeIterations: validation.normalizedParams.iterations,
          results
        })
      : null;
    const assessmentChallengePass = typeof buildAssessmentChallengePass === 'function'
      ? buildAssessmentChallengePass({
          draft: draftForAssessment,
          selectedRisks,
          validation,
          readiness: decisionReadiness
        })
      : null;
    const assessmentManagerTrace = typeof buildAssessmentManagerRunModel === 'function'
      ? buildAssessmentManagerRunModel({
          stage: 'results',
          draft: draftForAssessment,
          selectedRisks,
          validation,
          readiness: decisionReadiness,
          challenge: assessmentChallengePass,
          safeIterations: validation.normalizedParams.iterations,
          results
        })
      : null;
    results.runMetadata = RiskEngine.createRunMetadata({
      ...validation.normalizedParams,
      seed: results.runConfig?.seed ?? validation.normalizedParams.seed
    }, {
      assumptions: assessmentIntelligence.assumptions,
      scenarioMultipliers: scenario,
      warningThreshold,
      thresholdConfigUsed: {
        warningThreshold,
        eventToleranceThreshold: toleranceThreshold,
        annualReviewThreshold
      },
      runtimeGuardrails: runtimeWarnings,
      currencyContext
    });
    p.seed = results.runMetadata.seed;
    await yieldToUI();
    if (!AppState.draft.id) AppState.draft.id = 'a_' + Date.now();
    const assessment = {
      ...draftForAssessment,
      inputAssignments: buildLiveInputSourceAssignments(AppState.draft),
      results,
      assessmentIntelligence,
      decisionReadiness,
      assessmentChallengePass,
      assessmentManagerTrace,
      completedAt: Date.now()
    };
    if (typeof buildAiAuditStory === 'function') {
      assessment.aiAuditStory = buildAiAuditStory({
        assessment,
        assessmentType: assessment.assessmentType,
        fallbackFlags: {
          scenarioDraft: assessment.aiQualityState === 'fallback',
          projectExposure: assessment.projectExposure?.usedFallback === true || assessment.projectExposure?.aiUnavailable === true,
          evidenceMap: assessment.evidenceMap?.usedFallback === true || assessment.evidenceMap?.aiUnavailable === true,
          parameterCoach: assessment.parameterCoach?.usedFallback === true || assessment.parameterCoach?.aiUnavailable === true
        }
      });
    }
    if (progressText) progressText.textContent = 'Saving the assessment and opening results…';
    await yieldToUI();
    await new Promise(requestAnimationFrame);
    const savedAssessment = saveAssessment(assessment, {
      targetStatus: needsReview(assessment)
        ? ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW
        : isTreatmentVariantAssessment(assessment)
          ? ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT
          : ASSESSMENT_LIFECYCLE_STATUS.SIMULATED
    });
    recordLearningFromAssessment(savedAssessment);
    if (baselineAssessment) {
      const rerunComparison = buildAssessmentComparison(savedAssessment, baselineAssessment);
      recordAssessmentRerunLearning(savedAssessment, baselineAssessment, rerunComparison);
    }
    resetDraft();
    saveDraft();
    completeSimulationState();
    Router.navigate('/results/' + savedAssessment.id);
  } catch(e) {
    AppState.simulationRunToken = null;
    document.getElementById('sim-progress')?.classList.add('hidden');
    document.getElementById('run-area')?.classList.remove('hidden');
    if (e?.code === 'SIMULATION_CANCELLED') {
      failSimulationState(e);
      UI.toast('The simulation was cancelled. Your inputs and draft were kept.', 'warning');
      return;
    }
    failSimulationState(e);
    UI.toast(e?.message === 'Simulation timed out during computation.' ? 'The simulation took too long and was stopped. Reduce the iteration count and try again.' : e?.code === 'INVALID_SIMULATION_PARAMS' ? (e.validation?.errors?.[0] || 'Please review the model inputs and try again.') : 'The simulation could not be completed right now. Try again in a moment.', 'danger');
    console.error(e);
  }
}
