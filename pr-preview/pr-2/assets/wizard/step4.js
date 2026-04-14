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
//   getAssessmentById, renderPilotWarningBanner, setPage

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

function buildSimulationRunPayload() {
  const p = AppState.draft.fairParams || {};
  const scenario = getScenarioMultipliers();
  const toleranceThreshold = getToleranceThreshold();
  const warningThreshold = getWarningThreshold();
  const annualReviewThreshold = getAnnualReviewThreshold();
  const fxMul = AppState.currency === 'AED' ? (1 / AppState.fxRate) : 1;
  const toUSD = value => (value || 0) * fxMul;
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
      annualReviewThreshold
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
  const draftFreshnessWarning = buildDraftFreshnessWarning(draft);
  setPage(`
    <main class="page" aria-label="Step 4: Review and Run Simulation">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(4)}
          <h2 class="wizard-step-title">Review &amp; Run Simulation</h2>
          <p class="wizard-step-desc">Check the summary, confirm the main assumptions look credible, then run the simulation with confidence. Open deeper detail only if something needs challenge before the run.</p>
        </div>
        <div class="wizard-body">
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

  document.getElementById('btn-back-4')?.addEventListener('click', () => Router.navigate('/wizard/3'));
  document.getElementById('btn-run-sim')?.addEventListener('click', runSimulation);
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
      completedAt: Date.now()
    };
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
