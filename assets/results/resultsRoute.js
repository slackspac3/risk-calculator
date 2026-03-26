function renderExecutiveThresholdTracks(model) {
  const renderCard = item => `
    <div class="results-track-card">
      <div class="results-track-head">
        <div>
          <div class="results-driver-label">${item.title}</div>
          <div class="results-comparison-foot">Current view: ${fmtCurrency(item.current)}</div>
        </div>
        <span class="badge badge--${item.statusTone}">${item.status}</span>
      </div>
      <div class="results-threshold-track">
        <div class="results-threshold-fill results-threshold-fill--${item.statusTone}" style="width:${ReportPresentation.clampNumber(item.ratio)}%"></div>
      </div>
      <div class="results-threshold-track-foot">
        <span>Benchmark: <strong>${fmtCurrency(item.benchmark)}</strong></span>
        ${item.secondaryBenchmark ? `<span>Warning: <strong>${fmtCurrency(item.secondaryBenchmark)}</strong></span>` : ''}
      </div>
      <div class="results-comparison-foot" style="margin-top:var(--sp-3)">${item.summary}</div>
    </div>`;
  return UI.resultsVisualCard({
    title: 'Against governance limits',
    wide: true,
    body: `<div class="results-track-grid">${renderCard(model.single)}${renderCard(model.annual)}</div>`
  });
}

function renderExecutiveImpactMix(mix) {
  if (!mix.length) return UI.resultsVisualCard({
    title: 'What is driving the cost',
    body: '<div class="results-comparison-foot">No meaningful loss-component mix is available for this scenario yet.</div>'
  });
  return UI.resultsVisualCard({
    title: 'What is driving the cost',
    body: `<div class="results-impact-mix">${mix.map(item => `<div class="results-impact-mix-row"><div class="results-impact-mix-head"><span>${item.label}</span><strong>${fmtCurrency(item.value)}</strong></div><div class="results-impact-mix-bar"><span style="width:${item.width}%"></span></div></div>`).join('')}</div>`
  });
}

function renderExecutiveSignalCard(results) {
  const breach = ReportPresentation.clampNumber((Number(results?.toleranceDetail?.lmExceedProb || 0) * 100), 0, 100);
  const annualStress = ReportPresentation.clampNumber(((Number(results?.ale?.p90 || 0) / Math.max(Number(results?.annualReviewThreshold || getAnnualReviewThreshold() || 1), 1)) * 100), 0, 180);
  return UI.resultsVisualCard({
    title: 'Risk signal at a glance',
    body: `<div class="results-signal-stack">
      <div class="results-signal-metric">
        <div class="results-driver-label">Tolerance breach likelihood</div>
        <div class="results-signal-bar"><span style="width:${breach}%"></span></div>
        <div class="results-comparison-foot">${breach.toFixed(1)}% chance of breaching tolerance in the model</div>
      </div>
      <div class="results-signal-metric">
        <div class="results-driver-label">Annual stress versus review trigger</div>
        <div class="results-signal-bar warning"><span style="width:${Math.min(annualStress, 100)}%"></span></div>
        <div class="results-comparison-foot">${annualStress >= 100 ? 'At or above' : 'Below'} the annual review trigger</div>
      </div>
    </div>`
  });
}

function renderExecutiveBrief(statusTitle, executiveDecision, executiveAction, executiveAnnualView) {
  const nextStep = executiveAction || executiveDecision?.priority || 'Confirm the next management step for this scenario.';
  return `<div class="results-executive-brief">
    ${UI.resultsBriefCard({
      label: 'Current position',
      value: statusTitle,
      copy: executiveAnnualView
    })}
    ${UI.resultsBriefCard({
      label: 'Management posture',
      value: executiveDecision?.decision || 'Review',
      copy: executiveDecision?.rationale || ''
    })}
    ${UI.resultsBriefCard({
      label: 'Immediate next step',
      value: 'Act now',
      copy: nextStep
    })}
  </div>`;
}


function renderDecisionRail(statusTitle, statusDetail, executiveDecision, executiveAction, confidence, rolePresentation) {
  const confidenceValue = confidence?.label || 'Moderate confidence';
  const confidenceCopy = confidence?.summary || 'Use this result as a management starting point, then challenge the biggest assumptions.';
  return `<div class="results-executive-brief results-executive-brief--premium">
    ${UI.resultsBriefCard({ label: 'Current position', value: statusTitle, copy: statusDetail })}
    ${UI.resultsBriefCard({ label: 'Management action', value: executiveDecision?.decision || 'Review', copy: executiveAction || executiveDecision?.priority || '' })}
    ${UI.resultsBriefCard({ label: 'Confidence', value: confidenceValue, copy: confidenceCopy })}
    ${UI.resultsBriefCard({ label: 'Role focus', value: rolePresentation.executiveNoteTitle, copy: rolePresentation.executiveNote })}
  </div>`;
}

function renderLifecycleNextStepCards(nextStepPlan = []) {
  if (!nextStepPlan.length) return '';
  return `<div class="results-recommendations-grid">
    ${nextStepPlan.map(item => `<div class="results-priority-card"><div><div class="results-priority-title">${escapeHtml(String(item.label || 'Next step'))}</div><div class="results-priority-copy"><strong>${escapeHtml(String(item.title || ''))}</strong>${item.copy ? `<div style="margin-top:8px">${escapeHtml(String(item.copy))}</div>` : ''}</div></div></div>`).join('')}
  </div>`;
}

function renderResultsActionBlock(recommendations, executiveAction, missingInformation, nextStepPlan = []) {
  const fallbackCards = [
    {
      label: 'Decision now',
      title: recommendations?.[0]?.title || executiveAction || 'Confirm the immediate management response for this scenario.',
      copy: recommendations?.[0]?.why || 'Use the current result to agree the next concrete action.'
    },
    {
      label: 'Validate next',
      title: 'Close the biggest evidence gap',
      copy: missingInformation?.[0] || recommendations?.[1]?.why || 'Challenge the main assumption driving the current result.'
    },
    {
      label: 'Monitor over time',
      title: recommendations?.[2]?.title || 'Watch for change',
      copy: 'Refresh this assessment if the threat, controls, or business dependence changes materially.'
    }
  ];
  const cards = nextStepPlan.length ? nextStepPlan : fallbackCards;
  return `<section class="results-section-stack">
    <div class="results-section-heading">What to do next</div>
    ${renderLifecycleNextStepCards(cards)}
  </section>`;
}

function renderResultsConfidenceNeedsBlock(confidenceFrame, evidenceQuality, missingInformation = [], citations = []) {
  const topGap = confidenceFrame?.topGap || missingInformation[0] || 'No major evidence gap has been recorded yet.';
  return `<section class="results-section-stack">
    <div class="results-section-heading">Confidence and evidence needs</div>
    <div class="results-summary-grid results-summary-grid--primary">
      <div class="results-summary-card"><div class="results-driver-label">Confidence for decisions</div><p class="results-summary-copy"><strong>${confidenceFrame?.label || 'Moderate confidence'}</strong></p><div class="results-comparison-foot">${confidenceFrame?.summary || 'Use this as a working decision view, then challenge the largest assumptions.'}</div></div>
      <div class="results-summary-card"><div class="results-driver-label">Evidence base</div><p class="results-summary-copy"><strong>${evidenceQuality || 'Useful but incomplete evidence base'}</strong></p><div class="results-comparison-foot">${confidenceFrame?.evidenceSummary || `${citations.length} supporting reference${citations.length === 1 ? '' : 's'} attached`}</div></div>
      <div class="results-summary-card results-summary-card--wide"><div class="results-driver-label">Management implication</div><p class="results-summary-copy">${confidenceFrame?.implication || topGap}</p><div class="results-comparison-foot" style="margin-top:var(--sp-3)">Best next evidence to collect: ${topGap}</div></div>
    </div>
  </section>`;
}

function renderResultsComparisonHighlight(comparison) {
  if (!comparison) return '';
  return `<section class="results-section-stack">
    <div class="results-section-heading">Treatment comparison</div>
    <div class="results-comparison-card results-comparison-card--spotlight">
      <div class="results-comparison-spotlight">
        <div>
          <div class="results-driver-label">Decision signal versus the baseline</div>
          <h3 class="results-comparison-spotlight__title">${comparison.directionTitle}</h3>
          <p class="results-summary-copy" style="margin-top:var(--sp-3)">${comparison.summary}</p>
        </div>
        <div class="results-comparison-spotlight__rail">
          <div class="results-comparison-banner"><strong>Baseline:</strong> ${comparison.baselineTitle} · ${comparison.baselineDate}</div>
          <div class="results-comparison-banner">${comparison.statusShift}</div>
        </div>
      </div>
      <div class="results-comparison-banner" style="margin-top:var(--sp-4)">${comparison.treatmentNarrative || comparison.keyDriver}</div>
      <div class="results-comparison-grid">
        <div class="results-comparison-metric ${comparison.severeEvent.direction}"><div class="results-impact-label">Severe single event</div><div class="results-comparison-value">${comparison.severeEvent.formatted}</div><div class="results-comparison-foot">${comparison.statusShift}</div></div>
        <div class="results-comparison-metric ${comparison.annualExposure.direction}"><div class="results-impact-label">Expected annual exposure</div><div class="results-comparison-value">${comparison.annualExposure.formatted}</div><div class="results-comparison-foot">Average-year delta</div></div>
        <div class="results-comparison-metric ${comparison.severeAnnual.direction}"><div class="results-impact-label">Severe annual exposure</div><div class="results-comparison-value">${comparison.severeAnnual.formatted}</div><div class="results-comparison-foot">${comparison.keyDriver}</div></div>
      </div>
      <div class="results-comparison-levers">
        <div class="results-comparison-lever">
          <span class="results-driver-label">Primary change</span>
          <strong>${comparison.keyDriver}</strong>
        </div>
        <div class="results-comparison-lever">
          <span class="results-driver-label">Secondary change</span>
          <strong>${comparison.secondaryDriver}</strong>
        </div>
      </div>
    </div>
  </section>`;
}

function buildAssessmentComparison(currentAssessment, baselineAssessment) {
  if (!currentAssessment?.results || !baselineAssessment?.results) return null;

  const current = currentAssessment.results;
  const baseline = baselineAssessment.results;
  const severeEvent = formatComparisonDelta(current.lm?.p90, baseline.lm?.p90);
  const annualExposure = formatComparisonDelta(current.ale?.mean, baseline.ale?.mean);
  const severeAnnual = formatComparisonDelta(current.ale?.p90, baseline.ale?.p90);
  const currentStatus = current.toleranceBreached ? 'Above tolerance' : current.nearTolerance ? 'Close to tolerance' : 'Within tolerance';
  const baselineStatus = baseline.toleranceBreached ? 'Above tolerance' : baseline.nearTolerance ? 'Close to tolerance' : 'Within tolerance';
  const statusShift = currentStatus === baselineStatus
    ? `Tolerance status is unchanged at ${currentStatus.toLowerCase()}.`
    : `Tolerance status moved from ${baselineStatus.toLowerCase()} to ${currentStatus.toLowerCase()}.`;

  const currentInputs = current.inputs || currentAssessment.fairParams || {};
  const baselineInputs = baseline.inputs || baselineAssessment.fairParams || {};
  const levers = [
    {
      key: 'control',
      magnitude: Math.abs(Number(currentInputs.controlStrLikely || 0) - Number(baselineInputs.controlStrLikely || 0)),
      message: Number(currentInputs.controlStrLikely || 0) > Number(baselineInputs.controlStrLikely || 0)
        ? 'Stronger controls are one of the clearest reasons the treatment case improved.'
        : 'Weaker control strength is one of the clearest reasons this case worsened.'
    },
    {
      key: 'detection-response',
      magnitude: Math.abs(Number(currentInputs.tefLikely || 0) - Number(baselineInputs.tefLikely || 0)),
      message: Number(currentInputs.tefLikely || 0) < Number(baselineInputs.tefLikely || 0)
        ? 'Faster detection or fewer credible opportunities are materially reducing the annual exposure in the treatment case.'
        : 'A higher frequency assumption is materially pushing this case upward.'
    },
    {
      key: 'resilience',
      magnitude: Math.abs(Number(currentInputs.biLikely || 0) - Number(baselineInputs.biLikely || 0)),
      message: Number(currentInputs.biLikely || 0) < Number(baselineInputs.biLikely || 0)
        ? 'Lower business interruption cost is one of the clearest improvements in the treated case.'
        : 'Higher business interruption cost is one of the clearest reasons this case is worse.'
    },
    {
      key: 'secondary-loss',
      magnitude: Math.abs(Number(currentInputs.secProbLikely || 0) - Number(baselineInputs.secProbLikely || 0)),
      message: Number(currentInputs.secProbLikely || 0) < Number(baselineInputs.secProbLikely || 0)
        ? 'Reduced secondary-loss exposure is helping keep the treatment case tail lower.'
        : 'Higher secondary-loss exposure is keeping the downside tail heavier than the baseline.'
    }
  ].sort((a, b) => b.magnitude - a.magnitude);
  const secondaryDriver = levers[1]?.message || 'No second dominant change stands out beyond the primary lever.';
  const treatmentNarrative = severeEvent.direction === 'down'
    ? `The treatment case is improving the outcome mainly through ${String(levers[0]?.message || 'a better control and loss posture').replace(/\.$/, '').toLowerCase()}. ${secondaryDriver}`
    : severeEvent.direction === 'up'
      ? `The current case is worse than the selected baseline mainly because ${String(levers[0]?.message || 'the main assumptions are still heavier than the baseline').replace(/\.$/, '').toLowerCase()}. ${secondaryDriver}`
      : 'The current case and baseline are directionally similar, so the outcome is not being moved by one dominant lever.';

  return {
    baselineTitle: baselineAssessment.scenarioTitle || 'Selected baseline',
    baselineDate: new Date(baselineAssessment.completedAt || baselineAssessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }),
    severeEvent,
    annualExposure,
    severeAnnual,
    currentStatus,
    baselineStatus,
    statusShift,
    keyDriver: levers[0]?.magnitude > 0 ? levers[0].message : 'The two cases are directionally similar, so no single input change stands out as the dominant driver.',
    secondaryDriver,
    treatmentNarrative,
    directionTitle: severeEvent.direction === 'down'
      ? 'The treatment path is reducing the decision burden.'
      : severeEvent.direction === 'up'
        ? 'The current case is still heavier than the baseline.'
        : 'The treatment path is not yet materially changing the position.',
    summary: severeEvent.direction === 'up'
      ? 'This scenario is currently running hotter than the selected baseline on the severe single-event view, so the current assumptions are not yet delivering a better management outcome.'
      : severeEvent.direction === 'down'
        ? 'This scenario is currently less severe than the selected baseline on the severe single-event view, which suggests the treatment assumptions are improving the management posture.'
        : 'This scenario is broadly aligned with the selected baseline on the severe single-event view, so the proposed change is not yet materially shifting the management position.'
  };
}

function applyTreatmentPrompt(promptId) {
  const p = AppState.draft.fairParams || (AppState.draft.fairParams = {});
  const multiply = (key, factor, floor = 0, ceil = null) => {
    const current = Number(p[key] || 0);
    let next = current * factor;
    if (floor != null) next = Math.max(floor, next);
    if (ceil != null) next = Math.min(ceil, next);
    p[key] = Number(next.toFixed(2));
  };

  if (promptId === 'control-strength') {
    multiply('controlStrMin', 1.15, 0, 0.99);
    multiply('controlStrLikely', 1.15, 0, 0.99);
    multiply('controlStrMax', 1.12, 0, 0.995);
    multiply('vulnMin', 0.9, 0.01, 1);
    multiply('vulnLikely', 0.85, 0.01, 1);
    multiply('vulnMax', 0.8, 0.01, 1);
  } else if (promptId === 'detection-response') {
    multiply('tefMin', 0.85, 0.1, null);
    multiply('tefLikely', 0.78, 0.1, null);
    multiply('tefMax', 0.72, 0.1, null);
    multiply('irMin', 0.82, 0, null);
    multiply('irLikely', 0.78, 0, null);
    multiply('irMax', 0.75, 0, null);
    multiply('secProbMin', 0.9, 0, 1);
    multiply('secProbLikely', 0.82, 0, 1);
    multiply('secProbMax', 0.8, 0, 1);
  } else if (promptId === 'resilience') {
    multiply('biMin', 0.72, 0, null);
    multiply('biLikely', 0.66, 0, null);
    multiply('biMax', 0.6, 0, null);
    multiply('rcMin', 0.88, 0, null);
    multiply('rcLikely', 0.8, 0, null);
    multiply('rcMax', 0.76, 0, null);
    multiply('secMagMin', 0.9, 0, null);
    multiply('secMagLikely', 0.82, 0, null);
    multiply('secMagMax', 0.78, 0, null);
  }
  saveDraft();
}

function createTreatmentDraftFromAssessment(assessment) {
  const clone = JSON.parse(JSON.stringify(assessment || {}));
  const originalTitle = clone.scenarioTitle || 'Untitled assessment';
  delete clone.results;
  delete clone.completedAt;
  delete clone.archivedAt;
  delete clone._shared;
  delete clone.assessmentIntelligence;
  updateAssessmentRecord(assessment.id, current => current, {
    targetStatus: ASSESSMENT_LIFECYCLE_STATUS.BASELINE_LOCKED,
    at: new Date().toISOString()
  });
  dispatchDraftAction('SET_DRAFT', {
    draft: {
    ...clone,
    id: 'a_' + Date.now(),
    scenarioTitle: `${originalTitle} — Treatment case`,
    learningNote: `Cloned from ${originalTitle} so you can compare a stronger future-state view against the current baseline.`,
    comparisonBaselineId: assessment.id,
    lifecycleStatus: ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT,
    treatmentImprovementRequest: '',
    results: null,
    completedAt: null
    }
  });
  if (AppState.draft.fairParams && typeof AppState.draft.fairParams === 'object') {
    dispatchDraftAction('MERGE_DRAFT', { patch: { fairParams: { ...AppState.draft.fairParams } } });
  }
  saveDraft();
}

function renderAssessmentComparisonBlock(comparisonOptions, activeComparisonId, comparison) {
  if (!comparisonOptions?.length) {
    return `<section class="results-section-stack">
      <div class="results-section-heading">Compare against another assessment</div>
      <div class="results-comparison-card">
        <div class="results-comparison-empty">
          No other saved assessments are available to compare yet. Duplicate this assessment or run a template-based case to create a clear baseline-versus-treatment story.
        </div>
      </div>
    </section>`;
  }
  return `<section class="results-section-stack">
    <div class="results-section-heading">Compare against another assessment</div>
    <div class="results-comparison-card">
      <div class="results-comparison-head">
        <div>
          <div class="results-driver-label">Comparison source</div>
          <div class="results-comparison-sub">Choose another saved assessment to show the management delta, the changed assumptions, and whether the treatment is really improving the position.</div>
        </div>
        <select class="form-select results-comparison-select" id="results-compare-select">
          <option value="">No comparison selected</option>
          ${comparisonOptions.map(option => `<option value="${option.id}" ${activeComparisonId === option.id ? 'selected' : ''}>${option.label}</option>`).join('')}
        </select>
      </div>
      ${comparison ? `
        <div class="results-comparison-banner" style="margin-top:var(--sp-3)"><strong>Decision read:</strong> ${comparison.directionTitle}</div>
        <div class="results-comparison-banner">
          <strong>Comparing against:</strong> ${comparison.baselineTitle} · ${comparison.baselineDate}
        </div>
        <p class="results-summary-copy" style="margin-top:var(--sp-3)">${comparison.summary}</p>
        <div class="results-comparison-banner" style="margin-top:var(--sp-3)">${comparison.statusShift}</div>
        <div class="results-comparison-banner" style="margin-top:var(--sp-3)">${comparison.treatmentNarrative || comparison.keyDriver}</div>
        <div class="results-comparison-grid">
          <div class="results-comparison-metric ${comparison.severeEvent.direction}">
            <div class="results-impact-label">Severe single event</div>
            <div class="results-comparison-value">${comparison.severeEvent.formatted}</div>
            <div class="results-comparison-foot">Current: ${comparison.currentStatus} · Baseline: ${comparison.baselineStatus}</div>
          </div>
          <div class="results-comparison-metric ${comparison.annualExposure.direction}">
            <div class="results-impact-label">Expected annual exposure</div>
            <div class="results-comparison-value">${comparison.annualExposure.formatted}</div>
            <div class="results-comparison-foot">Average-year comparison</div>
          </div>
          <div class="results-comparison-metric ${comparison.severeAnnual.direction}">
            <div class="results-impact-label">High-end annual exposure</div>
            <div class="results-comparison-value">${comparison.severeAnnual.formatted}</div>
            <div class="results-comparison-foot">Severe-year comparison</div>
          </div>
        </div>` : `
        <div class="results-comparison-empty">Choose a baseline assessment to compare event size, yearly exposure, and tolerance position.</div>`}
    </div>
  </section>`;
}

function renderAssessmentAssumptionsBlock(assumptions) {
  if (!assumptions?.length) return '';
  return `<section class="results-section-stack">
    <div class="results-section-heading">Key assumptions to keep in mind</div>
    <div class="results-assumptions-grid">
      ${assumptions.map(item => `<div class="results-assumption-card"><div class="results-assumption-label">${item.category}</div><div class="results-assumption-copy">${item.text}</div></div>`).join('')}
    </div>
  </section>`;
}



function buildLiveInputSourceAssignments(draft) {
  const base = Array.isArray(draft.inputAssignments) ? draft.inputAssignments : [];
  const origins = draft.fairParamOrigins || {};
  const groupToKeys = {
    'event-frequency': ['tefMin', 'tefLikely', 'tefMax'],
    'threat-capability': ['threatCapMin', 'threatCapLikely', 'threatCapMax'],
    'control-strength': ['controlStrMin', 'controlStrLikely', 'controlStrMax'],
    'incident-response': ['irMin', 'irLikely', 'irMax'],
    'business-interruption': ['biMin', 'biLikely', 'biMax'],
    'regulatory-legal': ['rlMin', 'rlLikely', 'rlMax']
  };
  return base.map(item => {
    const keys = groupToKeys[item.id] || [];
    const hasUserEdit = keys.some(key => origins[key] === 'user');
    if (!hasUserEdit) return item;
    return {
      ...item,
      origin: 'User edit',
      sourceTypeLabel: 'User-entered value',
      reason: 'This input group was changed after the AI starting point was loaded, so the current values reflect direct user judgement.',
      freshnessLabel: '',
      confidenceLabel: item.confidenceLabel || ''
    };
  });
}

function renderInputSourceAuditBlock(assignments = []) {
  const items = Array.isArray(assignments) ? assignments.filter(Boolean) : [];
  if (!items.length) return '';
  return `<div class="card card--elevated anim-fade-in"><div class="context-panel-title">Current source of each key input</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${items.map(item => `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap"><strong style="font-size:.85rem;color:var(--text-primary)">${escapeHtml(String(item.label || 'Input'))}</strong><span class="badge badge--neutral">${escapeHtml(String(item.origin || 'Unknown'))}</span>${item.sourceTypeLabel ? `<span class="badge badge--gold">${escapeHtml(String(item.sourceTypeLabel))}</span>` : ''}</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(String(item.reason || ''))}</div></div>`).join('')}</div></div>`;
}

function renderSimulationEquationFlow() {
  return `<div class="card card--elevated anim-fade-in"><div class="context-panel-title">How the result is built</div><div class="context-panel-copy" style="margin-top:var(--sp-2)">AI, context, and source documents prepare FAIR inputs. Monte Carlo simulation then turns those inputs into conditional event loss and annualized loss ranges.</div><div class="citation-chips" style="margin-top:12px"><span class="badge badge--neutral">AI/context/docs</span><span class="badge badge--neutral">FAIR inputs</span><span class="badge badge--neutral">Monte Carlo</span><span class="badge badge--neutral">Results</span></div></div>`;
}

function renderPreRunChallengeBlock(draft) {
  const items = [];
  const missing = Array.isArray(draft.missingInformation) ? draft.missingInformation : [];
  if (missing[0]) items.push(missing[0]);
  if ((draft.fairParams?.controlStrLikely ?? 1) <= 0.55) items.push('Challenge whether current control strength is too optimistic before you run the simulation.');
  if ((draft.fairParams?.tefLikely || 0) >= 3) items.push('Challenge whether the event-frequency working case is supported by internal incident evidence.');
  if (!items.length) items.push('Challenge the event frequency, control strength, and largest cost range before you rely on the output.');
  return `<div class="card card--elevated anim-fade-in"><div class="context-panel-title">Challenge these 3 assumptions first</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${items.slice(0, 3).map((item, idx) => `<div style="display:flex;gap:var(--sp-3);align-items:flex-start"><span class="badge badge--gold" style="min-width:24px;justify-content:center">${idx + 1}</span><div class="context-panel-copy" style="margin:0">${escapeHtml(String(item))}</div></div>`).join('')}</div></div>`;
}

function renderSensitivitySummary(drivers) {
  const items = Array.isArray(drivers?.sensitivity) ? drivers.sensitivity : [];
  if (!items.length) return '';
  return `<div class="results-summary-card"><div class="results-section-heading">The 2-3 inputs driving this result most</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${items.map(item => `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-weight:700;color:var(--text-primary)">${escapeHtml(String(item.label || 'Driver'))}</div><div class="results-summary-copy" style="margin-top:6px">${escapeHtml(String(item.why || ''))}</div></div>`).join('')}</div></div>`;
}

function renderResultsExplanationPanel(assessmentIntelligence, comparison, runMetadata) {
  const topDrivers = Array.isArray(assessmentIntelligence?.drivers?.sensitivity) ? assessmentIntelligence.drivers.sensitivity.slice(0, 3) : [];
  const assumptions = Array.isArray(assessmentIntelligence?.assumptions) ? assessmentIntelligence.assumptions.slice(0, 3) : [];
  const uncertainty = Array.isArray(assessmentIntelligence?.drivers?.uncertainty) ? assessmentIntelligence.drivers.uncertainty.slice(0, 3) : [];
  const caveats = [
    ...(Array.isArray(assessmentIntelligence?.confidence?.reasons) ? assessmentIntelligence.confidence.reasons.slice(0, 2) : []),
    ...(Array.isArray(assessmentIntelligence?.confidence?.improvements) ? assessmentIntelligence.confidence.improvements.slice(0, 2) : [])
  ].slice(0, 3);
  const treatmentDelta = comparison?.treatmentNarrative || comparison?.keyDriver || 'No treatment comparison is currently selected, so this view is explaining the current case only.';
  const runtimeNote = runMetadata?.runtimeGuardrails?.[0] || `The saved run used seed ${runMetadata?.seed ?? '—'} and ${Number(runMetadata?.iterations || 0).toLocaleString()} iterations for reproducibility.`;
  return `<section class="results-section-stack">
    <div class="results-section-heading">Why this result looks the way it does</div>
    <div class="results-summary-grid results-summary-grid--primary">
      <div class="results-summary-card"><div class="results-driver-label">Top drivers</div><div class="results-summary-copy">${topDrivers.length ? topDrivers.map(item => `• ${escapeHtml(String(item.label || 'Driver'))}: ${escapeHtml(String(item.why || ''))}`).join('<br>') : '• No dominant drivers were captured for this run.'}</div></div>
      <div class="results-summary-card"><div class="results-driver-label">Biggest assumptions</div><div class="results-summary-copy">${assumptions.length ? assumptions.map(item => `• ${escapeHtml(String(item.text || ''))}`).join('<br>') : '• No assumptions were saved with this run.'}</div></div>
      <div class="results-summary-card"><div class="results-driver-label">Where uncertainty matters most</div><div class="results-summary-copy">${uncertainty.length ? uncertainty.map(item => `• ${escapeHtml(String(item.label || 'Uncertainty'))}: ${escapeHtml(String(item.why || ''))}`).join('<br>') : '• No dominant uncertainty sources were captured for this run.'}</div></div>
      <div class="results-summary-card"><div class="results-driver-label">Confidence caveats</div><div class="results-summary-copy">${caveats.length ? caveats.map(item => `• ${escapeHtml(String(item || ''))}`).join('<br>') : '• Confidence caveats were not recorded for this run.'}</div></div>
      <div class="results-summary-card results-summary-card--wide"><div class="results-driver-label">Treatment delta explanation</div><div class="results-summary-copy">${escapeHtml(String(treatmentDelta))}</div>${comparison?.secondaryDriver ? `<div class="results-comparison-foot" style="margin-top:var(--sp-3)">${escapeHtml(String(comparison.secondaryDriver))}</div>` : ''}<div class="results-comparison-foot" style="margin-top:var(--sp-3)">${escapeHtml(String(runtimeNote))}</div></div>
    </div>
  </section>`;
}

function renderTechnicalOrientationBlock(rolePresentation, runMetadata, confidenceFrame) {
  const seedText = runMetadata?.seed != null ? `Saved seed ${runMetadata.seed}.` : 'Saved seed not recorded.';
  const iterationText = Number(runMetadata?.iterations || 0) > 0 ? `${Number(runMetadata.iterations).toLocaleString()} iterations.` : '';
  return `<div class="results-summary-grid results-summary-grid--primary">
    <div class="results-summary-card results-summary-card--wide">
      <div class="results-section-heading">${rolePresentation.technicalNoteTitle}</div>
      <p class="results-summary-copy">${rolePresentation.technicalNote}</p>
      <div class="results-comparison-foot" style="margin-top:var(--sp-3)">This view is for challenge, peer review, and evidence validation. ${seedText} ${iterationText} ${escapeHtml(String(confidenceFrame?.implication || ''))}</div>
    </div>
  </div>`;
}

function renderRunMetadataPanel(runMetadata, metricSemantics) {
  if (!runMetadata) return '';
  const thresholdConfig = runMetadata.thresholdConfigUsed || {};
  const correlations = runMetadata.distributions?.correlations || {};
  const assumptions = Array.isArray(runMetadata.assumptions) ? runMetadata.assumptions.slice(0, 4) : [];
  const guardrails = Array.isArray(runMetadata.runtimeGuardrails) ? runMetadata.runtimeGuardrails : [];
  return `<div class="card anim-fade-in">
    <h3 style="font-size:var(--text-base);margin-bottom:var(--sp-4)">Saved run metadata</h3>
    <div class="grid-3">
      <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Seed</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${runMetadata.seed ?? '—'}</div><div style="font-size:.7rem;color:var(--text-muted)">Re-run with this seed to reproduce the saved output.</div></div>
      <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Iterations</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${Number(runMetadata.iterations || 0).toLocaleString()}</div><div style="font-size:.7rem;color:var(--text-muted)">Saved execution volume</div></div>
      <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Distribution</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${escapeHtml(String(runMetadata.distributions?.eventModel || 'triangular'))}</div><div style="font-size:.7rem;color:var(--text-muted)">Vulnerability mode: ${escapeHtml(String(runMetadata.distributions?.vulnerabilityMode || 'derived'))}</div></div>
    </div>
    <div class="mt-4" style="font-size:.78rem;color:var(--text-muted)">Warning threshold: <strong>${fmtCurrency(thresholdConfig.warningThreshold || 0)}</strong> · Event tolerance: <strong>${fmtCurrency(thresholdConfig.eventToleranceThreshold || 0)}</strong> · Annual review: <strong>${fmtCurrency(thresholdConfig.annualReviewThreshold || 0)}</strong></div>
    <div class="mt-4" style="font-size:.78rem;color:var(--text-muted)">Scenario multipliers: <strong>frequency ×${Number(runMetadata.scenarioMultipliers?.tefMultiplier || 1).toFixed(2)}</strong> · <strong>loss ×${Number(runMetadata.scenarioMultipliers?.lossMultiplier || 1).toFixed(2)}</strong> · <strong>secondary ×${Number(runMetadata.scenarioMultipliers?.secondaryMultiplier || 1).toFixed(2)}</strong></div>
    <div class="mt-4" style="font-size:.78rem;color:var(--text-muted)">Correlations: <strong>BI vs IR ${Number(correlations.businessInterruptionVsIncidentResponse || 0).toFixed(2)}</strong> · <strong>Reg vs Reputation ${Number(correlations.regulatoryVsReputation || 0).toFixed(2)}</strong></div>
    ${guardrails.length ? `<div class="results-comparison-foot" style="margin-top:var(--sp-4)">${guardrails.map(item => escapeHtml(String(item))).join(' ')}</div>` : ''}
    ${assumptions.length ? `<div class="results-summary-copy" style="margin-top:var(--sp-4)">${assumptions.map(item => `• ${escapeHtml(String(item))}`).join('<br>')}</div>` : ''}
    <div class="form-help" style="margin-top:6px">${escapeHtml(String(metricSemantics?.eventLoss || ''))} ${escapeHtml(String(metricSemantics?.annualLoss || ''))}</div>
  </div>`;
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
  setPage(`
    <main class="page">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(4)}
          <h2 class="wizard-step-title">Review &amp; Run Simulation</h2>
          <p class="wizard-step-desc">Review your inputs, then run the Monte Carlo simulation.</p>
        </div>
        <div class="wizard-body">
          ${UI.disclosureSection({
            title: 'Scenario summary for this run',
            badgeLabel: 'Required',
            badgeTone: 'gold',
            open: true,
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
          ${UI.disclosureSection({ title: 'How the result is built', badgeLabel: 'Optional guide', badgeTone: 'neutral', open: false, className: 'wizard-disclosure card anim-fade-in', body: renderSimulationEquationFlow() })}
          ${UI.disclosureSection({ title: 'Challenge these 3 assumptions first', badgeLabel: 'Recommended', badgeTone: 'warning', open: true, className: 'wizard-disclosure card anim-fade-in', body: renderPreRunChallengeBlock(draft) })}
          ${UI.disclosureSection({ title: 'Current source of each key input', badgeLabel: 'Optional detail', badgeTone: 'neutral', open: false, className: 'wizard-disclosure card anim-fade-in', body: renderInputSourceAuditBlock(liveInputAssignments) })}
          ${UI.disclosureSection({
            title: 'Key parameters before you run',
            badgeLabel: 'Required',
            badgeTone: 'gold',
            open: true,
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
          <div class="banner banner--poc anim-fade-in anim-delay-2"><span class="banner-icon">⚠</span><span class="banner-text">PoC tool. FAIR input ranges should be validated through expert elicitation for production risk decisions.</span></div>
          ${renderRunGuardrailSummary(validation)}
          <div id="run-area">
            <button class="btn btn--primary btn--lg" id="btn-run-sim" style="width:100%;justify-content:center">🚀 Run Monte Carlo Simulation (${safeIterations} iterations)</button>
          </div>
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
        </div>
        <div class="wizard-footer">
          <button class="btn btn--ghost" id="btn-back-4">← Back</button>
        </div>
      </div>
    </main>`);

  document.getElementById('btn-back-4').addEventListener('click', () => Router.navigate('/wizard/3'));
  document.getElementById('btn-run-sim').addEventListener('click', runSimulation);
  document.getElementById('btn-cancel-sim')?.addEventListener('click', () => {
    const token = AppState.simulationRunToken;
    if (!token || token.aborted) return;
    token.aborted = true;
    cancelSimulationState('Cancellation requested…');
    const progressText = document.getElementById('sim-progress-text');
    const progressMeta = document.getElementById('sim-progress-meta');
    if (progressText) progressText.textContent = 'Cancelling the simulation…';
    if (progressMeta) progressMeta.textContent = 'The current run will stop at the next safe checkpoint.';
  });
}

async function runSimulation() {
  const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));
  const runPayload = buildSimulationRunPayload();
  const validation = validateFairParams(runPayload);
  if (!validation.valid) return;
  const runtimeWarnings = Array.isArray(validation.warnings) ? validation.warnings : [];
  document.getElementById('run-area').classList.add('hidden');
  document.getElementById('sim-progress').classList.remove('hidden');
  await new Promise(r => setTimeout(r, 80));
  await new Promise(requestAnimationFrame);
  try {
    const p = AppState.draft.fairParams;
    const { ep, scenario, toleranceThreshold, warningThreshold, annualReviewThreshold, currencyContext } = runPayload;
    const progressText = document.getElementById('sim-progress-text');
    const progressMeta = document.getElementById('sim-progress-meta');
    const progressBar = document.getElementById('sim-progress-bar');
    const progressButton = document.getElementById('btn-cancel-sim');
    const runToken = { aborted: false };
    AppState.simulationRunToken = runToken;
    p.iterations = validation.normalizedParams.iterations;
    p.seed = validation.normalizedParams.seed;
    startSimulationState(validation.normalizedParams.iterations);
    if (runtimeWarnings.length && progressMeta) progressMeta.textContent = runtimeWarnings.join(' ');
    const yieldEvery = getSimulationYieldEvery(validation.normalizedParams.iterations);
    const results = await Promise.race([
      RiskEngine.runAsync(validation.normalizedParams, {
        yieldEvery,
        signal: runToken,
        onProgress: (ratio, completed, total) => {
          const message = `Computing ${completed.toLocaleString()} of ${total.toLocaleString()} Monte Carlo iterations…`;
          updateSimulationProgressState({ ratio, completed, total, message });
          if (progressText) progressText.textContent = message;
          if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
          if (progressMeta) progressMeta.textContent = `Seed ${String(validation.normalizedParams.seed ?? 'pending')} · checkpoint every ${yieldEvery.toLocaleString()} iterations`;
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Simulation timed out during computation.')), 20000))
    ]);
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
    const assessmentIntelligence = buildAssessmentIntelligence(AppState.draft, results, validation.normalizedParams, scenario);
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
      ...AppState.draft,
      inputAssignments: buildLiveInputSourceAssignments(AppState.draft),
      results,
      assessmentIntelligence,
      completedAt: Date.now()
    };
    if (progressText) progressText.textContent = 'Saving the assessment and opening results…';
    await yieldToUI();
    await new Promise(requestAnimationFrame);
    saveAssessment(assessment, {
      targetStatus: needsReview(assessment)
        ? ASSESSMENT_LIFECYCLE_STATUS.READY_FOR_REVIEW
        : isTreatmentVariantAssessment(assessment)
          ? ASSESSMENT_LIFECYCLE_STATUS.TREATMENT_VARIANT
          : ASSESSMENT_LIFECYCLE_STATUS.SIMULATED
    });
    recordLearningFromAssessment(assessment);
    saveDraft();
    completeSimulationState();
    Router.navigate('/results/' + AppState.draft.id);
  } catch(e) {
    AppState.simulationRunToken = null;
    document.getElementById('sim-progress').classList.add('hidden');
    document.getElementById('run-area').classList.remove('hidden');
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

// ─── RESULTS ──────────────────────────────────────────────────
function renderResults(id, isShared) {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }
  if (!isShared) {
    const shared = ShareService.parseShareFromURL();
    if (shared && shared.id === id && shared.results) {
      if (!getAssessmentById(id)) saveAssessment({ ...shared, _shared: true });
      isShared = true;
    }
  }
  const assessment = getAssessmentById(id);
  if (!assessment || !assessment.results) {
    setPage(`<main class="page"><div class="container container--narrow" style="padding:var(--sp-12) var(--sp-6)">
      <div class="card card--elevated" style="padding:var(--sp-8)">
        <div class="landing-badge">Results</div>
        <h2 style="margin-top:var(--sp-4)">This result is not available in this workspace</h2>
        <p style="margin-top:var(--sp-4);color:var(--text-muted)">The saved assessment with ID "${escapeHtml(String(id))}" could not be found here. It may have been deleted, archived in another browser, or not imported into this pilot workspace yet.</p>
        ${renderPilotWarningBanner('poc', { compact: true, text: 'Pilot results are stored per user workspace unless they were explicitly exported, shared, or imported.' })}
        <div class="flex items-center gap-3" style="margin-top:var(--sp-6);flex-wrap:wrap">
          <a href="#/dashboard" class="btn btn--primary">← Dashboard</a>
          <button class="btn btn--secondary" id="btn-results-missing-template" type="button">Start from Template</button>
          <button class="btn btn--ghost" id="btn-results-missing-sample" type="button">Try Sample Assessment</button>
        </div>
      </div>
    </div></main>`);
    document.getElementById('btn-results-missing-template')?.addEventListener('click', () => loadScenarioTemplateById(ScenarioTemplates?.[0]?.id));
    document.getElementById('btn-results-missing-sample')?.addEventListener('click', () => launchPilotSampleAssessment());
    return;
  }

  try {
  const sharedBanner = (isShared || assessment._shared) ? `
    <div class="banner banner--info mb-6" style="font-size:.82rem">
      <span class="banner-icon">🔗</span>
      <span class="banner-text"><strong>Shared view.</strong> This assessment was shared with you. <a href="#/" style="color:var(--color-accent-300)">Start your own →</a></span>
    </div>` : '';

  const currentUser = AuthService.getCurrentUser();
  const capability = (!isShared && currentUser && currentUser.role !== 'admin')
    ? getNonAdminCapabilityState(currentUser, getUserSettings(), getAdminSettings())
    : null;
  const roleMode = capability?.canManageBusinessUnit && capability?.canManageDepartment
    ? 'bu_and_function'
    : capability?.canManageBusinessUnit
      ? 'bu_admin'
      : capability?.canManageDepartment
        ? 'function_admin'
        : 'standard_user';
  const rolePresentation = {
    standard_user: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This result needs attention now and should be reviewed with the person who owns the response.'
        : r.nearTolerance
          ? 'This result is close to tolerance and should be reviewed before it worsens.'
          : 'This result is within tolerance today, so the main task is to monitor and revisit it if conditions change.',
      executiveAction: r => r.toleranceBreached
        ? 'Review the result with your manager or risk owner and confirm the next response step.'
        : r.nearTolerance
          ? 'Check the main assumptions and agree the next improvement step with the owner of this area.'
          : 'Keep monitoring the scenario and update it when the threat, scope, or controls change.',
      annualView: r => r.annualReviewTriggered ? 'Annual review is worth scheduling.' : 'No annual review trigger is currently indicated.',
      executiveNoteTitle: 'What this means for you',
      executiveNote: 'Use the executive summary first. Open deeper detail only if you need to challenge the assumptions or explain the result to someone else.',
      technicalNoteTitle: 'How to use the technical view',
      technicalNote: 'Use this tab only when you need to understand the ranges, evidence, or model assumptions in more detail.',
      coreSummary: 'Show core numbers',
      aiSummary: 'Show how AI built this result'
    },
    function_admin: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This function-level scenario is above tolerance and needs action from the function owner now.'
        : r.nearTolerance
          ? 'This function-level scenario is close to tolerance and should be actively managed.'
          : 'This function-level scenario is within tolerance, but the owned function context should stay current.',
      executiveAction: r => r.toleranceBreached
        ? 'Confirm the immediate function-level response, owner, and control actions for this scenario.'
        : r.nearTolerance
          ? 'Review the main drivers for your function and agree a targeted reduction action.'
          : 'Keep the function context and assumptions current so future assessments stay grounded.',
      annualView: r => r.annualReviewTriggered ? 'A function-level annual review is warranted.' : 'No annual function review trigger is currently indicated.',
      executiveNoteTitle: 'What this means for your function',
      executiveNote: 'Focus first on what this result means for the function or department you own, then open deeper detail only when you need to validate the assumptions.',
      technicalNoteTitle: 'Function review view',
      technicalNote: 'Use this tab to validate drivers, assumptions, and evidence that affect the function context you own.',
      coreSummary: 'Show core function outputs',
      aiSummary: 'Show AI reasoning for this function result'
    },
    bu_admin: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This business-unit scenario is above tolerance and needs management action now.'
        : r.nearTolerance
          ? 'This business-unit scenario is close to tolerance and should be managed before it escalates.'
          : 'This business-unit scenario is within tolerance, but should stay under active review.',
      executiveAction: r => r.toleranceBreached
        ? 'Confirm the BU owner, escalation path, and immediate treatment actions for this scenario.'
        : r.nearTolerance
          ? 'Review the main drivers across the business unit and agree a targeted management response.'
          : 'Keep the BU context aligned and review again if conditions change materially.',
      annualView: r => r.annualReviewTriggered ? 'A business-unit annual review is warranted.' : 'No business-unit annual review trigger is currently indicated.',
      executiveNoteTitle: 'What this means for the business unit',
      executiveNote: 'Use this view to decide whether the business unit needs review, escalation, or updated context before more work starts.',
      technicalNoteTitle: 'Business unit review view',
      technicalNote: 'Use this tab for management review, challenge, and comparison across scenarios in the business unit.',
      coreSummary: 'Show core business-unit outputs',
      aiSummary: 'Show AI reasoning for this BU result'
    },
    bu_and_function: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This scenario is above tolerance and needs both business-unit oversight and function-level action now.'
        : r.nearTolerance
          ? 'This scenario is close to tolerance and should be managed across the business unit and the owned function.'
          : 'This scenario is within tolerance, but both the BU and function context should stay aligned.',
      executiveAction: r => r.toleranceBreached
        ? 'Confirm the BU-level decision, then agree the immediate function-level response and control actions.'
        : r.nearTolerance
          ? 'Review the main drivers from both the BU and function perspective and agree the next action.'
          : 'Keep both the BU and function context current so new assessments stay aligned.',
      annualView: r => r.annualReviewTriggered ? 'A BU and function-level annual review is warranted.' : 'No annual review trigger is currently indicated for the BU or owned function.',
      executiveNoteTitle: 'What this means across your role',
      executiveNote: 'Use this view first for the BU-level decision, then check whether the owned function needs a more direct follow-up action.',
      technicalNoteTitle: 'Oversight and execution view',
      technicalNote: 'Use this tab when you need to challenge the assumptions from both the management and owned-function perspective.',
      coreSummary: 'Show core oversight outputs',
      aiSummary: 'Show AI reasoning and evidence'
    }
  }[roleMode];
  const rawResults = assessment.results || {};
  const r = {
    ...rawResults,
    lm: rawResults.lm || rawResults.eventLoss || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
    eventLoss: rawResults.eventLoss || rawResults.lm || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
    ale: rawResults.ale || rawResults.annualLoss || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
    annualLoss: rawResults.annualLoss || rawResults.ale || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
    toleranceDetail: rawResults.toleranceDetail || { lmExceedProb: 0, aleExceedProb: 0, lmP90: 0, aleP90: 0 },
    annualReviewDetail: rawResults.annualReviewDetail || { annualExceedProb: 0, annualP90: 0 },
    metricSemantics: rawResults.metricSemantics || { eventLoss: 'Conditional loss if a materially successful event occurs.', annualLoss: 'Annualized loss across the year after event frequency is applied.' },
    histogram: Array.isArray(rawResults.histogram) ? rawResults.histogram : [],
    lec: Array.isArray(rawResults.lec) ? rawResults.lec : [],
    warningThreshold: Number(rawResults.warningThreshold || getWarningThreshold() || 0),
    threshold: Number(rawResults.threshold || getToleranceThreshold() || 0),
    annualReviewThreshold: Number(rawResults.annualReviewThreshold || getAnnualReviewThreshold() || 0),
    iterations: Number(rawResults.iterations || rawResults.runMetadata?.iterations || assessment.fairParams?.iterations || 0),
    distType: rawResults.runMetadata?.distributions?.eventModel || rawResults.runConfig?.distType || assessment.fairParams?.distType || 'triangular'
  };
  const activeTab = String(AppState.resultsTab || 'executive');
  const statusClass = r.toleranceBreached ? 'above' : r.nearTolerance ? 'warning' : 'within';
  const statusIcon = r.toleranceBreached ? '🔴' : r.nearTolerance ? '🟠' : '🟢';
  const statusTitle = r.toleranceBreached ? 'Needs leadership action' : r.nearTolerance ? 'Needs management attention' : 'Within current tolerance';
  const statusDetail = r.toleranceBreached
    ? `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} is above the tolerance threshold of ${fmtCurrency(r.threshold)}.`
    : r.nearTolerance
      ? `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} is above the warning trigger of ${fmtCurrency(r.warningThreshold)} but still below tolerance.`
      : `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} remains below the warning trigger of ${fmtCurrency(r.warningThreshold)}.`;
  const executiveHeadline = rolePresentation.executiveHeadline(r);
  const executiveAction = rolePresentation.executiveAction(r);
  const executiveAnnualView = rolePresentation.annualView(r);
  const scenarioScopeSummary = r.portfolioMeta?.linked
    ? `${r.selectedRiskCount || assessment.selectedRisks?.length || 1} linked risks are being treated as one connected scenario.`
    : `${r.selectedRiskCount || assessment.selectedRisks?.length || 1} risks are being assessed together without linked uplift.`;
  const exceedancePct = ((r.toleranceDetail?.lmExceedProb || 0) * 100).toFixed(1);
  const completedLabel = new Date(assessment.completedAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
  const lifecycle = getAssessmentLifecyclePresentation(assessment);
  const scenarioNarrative = ReportPresentation.buildExecutiveScenarioSummary(assessment) || 'No scenario narrative available.';
  const technicalInputs = r.inputs || assessment.fairParams || {};
  const runMetadata = rawResults.runMetadata || (rawResults.runConfig ? RiskEngine.createRunMetadata({
    ...technicalInputs,
    seed: rawResults.runConfig.seed,
    iterations: rawResults.runConfig.iterations,
    distType: rawResults.runConfig.distType,
    threshold: rawResults.runConfig.threshold,
    annualReviewThreshold: rawResults.runConfig.annualReviewThreshold,
    vulnDirect: rawResults.runConfig.vulnDirect,
    secondaryEnabled: rawResults.runConfig.secondaryEnabled,
    corrBiIr: rawResults.runConfig.corrBiIr,
    corrRlRc: rawResults.runConfig.corrRlRc
  }, {
    scenarioMultipliers: rawResults.portfolioMeta || {},
    warningThreshold: rawResults.warningThreshold,
    thresholdConfigUsed: {
      warningThreshold: rawResults.warningThreshold,
      eventToleranceThreshold: rawResults.threshold,
      annualReviewThreshold: rawResults.annualReviewThreshold
    }
  }) : null);
  const workflowGuidance = Array.isArray(assessment.workflowGuidance) ? assessment.workflowGuidance : [];
  const recommendations = Array.isArray(assessment.recommendations) ? assessment.recommendations : [];
  const citations = Array.isArray(assessment.citations) ? assessment.citations : [];
  const primaryGrounding = Array.isArray(assessment.primaryGrounding) ? assessment.primaryGrounding : [];
  const supportingReferences = Array.isArray(assessment.supportingReferences) ? assessment.supportingReferences : [];
  const inferredAssumptions = Array.isArray(assessment.inferredAssumptions) ? assessment.inferredAssumptions : [];
  const missingInformation = Array.isArray(assessment.missingInformation) ? assessment.missingInformation : [];
  const assessmentIntelligence = assessment.assessmentIntelligence || buildAssessmentIntelligence(assessment, r, technicalInputs, r.portfolioMeta || {});
  const assessmentChallenge = assessment.assessmentChallenge || null;
  const executiveDecision = ReportPresentation.buildExecutiveDecisionSupport(assessment, r, assessmentIntelligence);
  const confidenceFrame = ReportPresentation.buildExecutiveConfidenceFrame(assessmentIntelligence.confidence, assessment.evidenceQuality, missingInformation, citations);
  const thresholdModel = ReportPresentation.buildExecutiveThresholdModel(r, fmtCurrency);
  const impactMix = ReportPresentation.buildExecutiveImpactMix(technicalInputs);
  const comparisonOptions = getAssessments()
    .filter(item => deriveAssessmentLifecycleStatus(item) !== ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED && item.id !== assessment.id && item.results)
    .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())
    .slice(0, 12)
    .map(item => ({
      id: item.id,
      label: `${item.scenarioTitle || 'Untitled assessment'} · ${item.buName || '—'} · ${new Date(item.completedAt || item.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}`
    }));
  const activeComparisonId = AppState.resultsComparisonId || assessment.comparisonBaselineId || '';
  const baselineAssessment = activeComparisonId ? getAssessmentById(activeComparisonId) : null;
  const comparison = baselineAssessment ? buildAssessmentComparison(assessment, baselineAssessment) : null;
  const nextStepPlan = ReportPresentation.buildLifecycleNextStepPlan({
    lifecycle,
    results: r,
    executiveDecision,
    comparison,
    confidenceFrame,
    missingInformation
  });
  const recommendationCards = renderResultsActionBlock(recommendations, executiveAction, missingInformation, nextStepPlan);
  const confidenceNeedsBlock = renderResultsConfidenceNeedsBlock(confidenceFrame, assessment.evidenceQuality, missingInformation, citations);
  const comparisonHighlight = renderResultsComparisonHighlight(comparison);
  const explanationPanel = renderResultsExplanationPanel(assessmentIntelligence, comparison, runMetadata);

  const executiveTab = `
    <section class="results-executive-view" id="results-tab-executive">
      <div class="results-hero ${statusClass}">
        <div class="results-hero-main">
          <div class="results-kicker">Assessment outcome</div>
          <h2 class="results-hero-title">${executiveHeadline}</h2>
          <p class="results-hero-copy">${statusDetail}</p>
          <div class="results-hero-tags">
            <span class="badge ${r.toleranceBreached ? 'badge--danger' : r.nearTolerance ? 'badge--warning' : 'badge--success'}">${statusTitle}</span>
            <span class="badge badge--${lifecycle.tone}">${lifecycle.label}</span>
            <span class="badge badge--neutral">${assessment.buName || 'No business unit'}</span>
            <span class="badge badge--neutral">${assessment.geography || 'No geography'}</span>
            <span class="badge badge--neutral">${completedLabel}</span>
          </div>
        </div>
        <div class="results-hero-side">
          <div class="results-signal-ring ${statusClass}">
            <div class="results-signal-ring-inner">${statusIcon}</div>
          </div>
          <div class="results-signal-label">${exceedancePct}% breach likelihood</div>
        </div>
      </div>

      ${renderDecisionRail(statusTitle, statusDetail, executiveDecision, executiveAction, assessmentIntelligence.confidence, rolePresentation)}

      <div class="results-exec-metrics">
        <div class="results-impact-card">
          <div class="results-impact-label">Conditional loss from one successful event</div>
          <div class="results-impact-value ${r.toleranceBreached ? 'danger' : ''}">${fmtCurrency(r.eventLoss.p90)}</div>
          <div class="results-impact-copy">Severe single-event view</div>
        </div>
        <div class="results-impact-card">
          <div class="results-impact-label">Expected annualized loss</div>
          <div class="results-impact-value">${fmtCurrency(r.annualLoss.mean)}</div>
          <div class="results-impact-copy">Expected annual exposure</div>
        </div>
        <div class="results-impact-card">
          <div class="results-impact-label">High-stress annualized loss</div>
          <div class="results-impact-value warning">${fmtCurrency(r.annualLoss.p90)}</div>
          <div class="results-impact-copy">Severe annual planning view</div>
        </div>
      </div>

      <div class="results-decision-grid">
        <div class="results-decision-card">
          <div class="results-section-heading">Recommended management decision</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);flex-wrap:wrap">
            <strong style="font-family:var(--font-display);font-size:var(--text-xl);color:var(--text-primary)">${executiveDecision.decision}</strong>
            <span class="badge ${r.toleranceBreached ? 'badge--danger' : r.nearTolerance ? 'badge--warning' : 'badge--success'}">${statusTitle}</span>
          </div>
          <div class="results-decision-points">
            <div class="results-decision-point"><span class="results-decision-label">Why this matters</span><div class="results-decision-copy">${executiveDecision.rationale}</div></div>
            <div class="results-decision-point"><span class="results-decision-label">Main management priority</span><div class="results-decision-copy">${executiveDecision.priority}</div></div>
            <div class="results-decision-point"><span class="results-decision-label">Management focus next</span><div class="results-decision-copy">${executiveDecision.managementFocus}</div></div>
          </div>
        </div>
        <div class="results-decision-card results-decision-card--compact">
          <div class="results-section-heading">Threshold position</div>
          <div class="results-threshold-stack">
            <div class="results-threshold-row"><span>Warning</span><strong>${fmtCurrency(r.warningThreshold || getWarningThreshold())}</strong></div>
            <div class="results-threshold-row"><span>Tolerance</span><strong>${fmtCurrency(r.threshold)}</strong></div>
            <div class="results-threshold-row"><span>Annual review</span><strong>${fmtCurrency(r.annualReviewThreshold || getAnnualReviewThreshold())}</strong></div>
            <div class="results-threshold-row"><span>Annual review exceedance</span><strong>${((r.annualReviewDetail?.annualExceedProb || 0) * 100).toFixed(1)}%</strong></div>
          </div>
          <div class="results-decision-row"><span class="results-decision-label">Current position</span><div class="results-decision-copy">${executiveAnnualView}</div></div>
          <div class="results-decision-row"><span class="results-decision-label">Confidence implication</span><div class="results-decision-copy">${confidenceFrame.implication}</div></div>
        </div>
      </div>

      ${recommendationCards}
      ${confidenceNeedsBlock}
      ${comparisonHighlight}
      ${explanationPanel}

      <div class="results-summary-grid results-summary-grid--primary">
        <div class="results-summary-card results-summary-card--wide">
          <div class="results-section-heading">What this scenario means in practice</div>
          <p class="results-summary-copy">${scenarioNarrative}</p>
        </div>
      </div>

      <details class="results-detail-disclosure">
        <summary>Show why the result looks this way</summary>
        <div class="results-detail-disclosure-copy">Use this when you need the drivers, benchmark logic, and supporting signals behind the headline view.</div>
        <div class="results-disclosure-stack">
          ${renderExecutiveDriversSummary(assessmentIntelligence.drivers, assessment)}
          <div class="results-visual-grid">
            ${renderExecutiveImpactMix(impactMix)}
            ${renderExecutiveThresholdTracks(thresholdModel)}
          </div>
          ${renderExecutiveSignalCard(r)}
        </div>
      </details>
    </section>`;

  const technicalTab = `
    <section class="results-technical-view ${activeTab === 'technical' ? '' : 'hidden'}" id="results-tab-technical">
      ${renderTechnicalOrientationBlock(rolePresentation, runMetadata, confidenceFrame)}

      ${confidenceNeedsBlock}
      ${renderSimulationEquationFlow()}
      ${renderInputSourceAuditBlock(buildLiveInputSourceAssignments(assessment))}

      <div class="results-decision-grid mb-6 anim-fade-in">
        ${renderAssessmentConfidenceBlock(assessmentIntelligence.confidence)}
        ${renderAssessmentDriversBlock(assessmentIntelligence.drivers)}
      </div>
      ${renderSensitivitySummary(assessmentIntelligence.drivers)}

      ${comparisonHighlight}
      ${explanationPanel}

      <details class="results-detail-disclosure">
        <summary>Show challenge and review tools</summary>
        <div class="results-detail-disclosure-copy">Open this only when you want to pressure-test the assumptions, evidence quality, and committee questions behind the result.</div>
        <div class="results-disclosure-stack">
          <div class="card mb-2 anim-fade-in">
            <div class="flex items-center justify-between" style="gap:var(--sp-4);flex-wrap:wrap">
              <div>
                <h3 style="font-size:var(--text-base);margin:0">Challenge this assessment</h3>
                <div class="form-help" style="margin-top:6px">Ask AI to review the weakest assumptions, likely committee questions, and the evidence that would strengthen this result.</div>
              </div>
              <button class="btn btn--secondary btn--sm" id="btn-challenge-assessment" type="button">AI Challenge This Assessment</button>
            </div>
            <div id="assessment-challenge-status" class="form-help" style="margin-top:12px">${assessmentChallenge ? 'Latest challenge review saved with this assessment.' : 'No challenge review has been generated yet.'}</div>
          </div>
          ${assessmentChallenge ? renderAssessmentChallengeBlock(assessmentChallenge) : ''}
        </div>
      </details>

      <details class="results-detail-disclosure" open>
        <summary>${rolePresentation.coreSummary}</summary>
        <div class="results-detail-disclosure-copy">These are the main event and annual exposure outputs most teams review first.</div>
        <div class="results-disclosure-stack">
          <div class="grid-3 mb-6 anim-fade-in">
            <div class="metric-card"><div class="metric-label">Typical conditional event loss</div><div class="metric-value">${fmtCurrency(r.eventLoss.p50)}</div><div class="metric-sub">Midpoint successful-event view</div></div>
            <div class="metric-card"><div class="metric-label">Severe conditional event loss</div><div class="metric-value ${r.toleranceBreached ? 'danger' : ''}">${fmtCurrency(r.eventLoss.p90)}</div><div class="metric-sub">Used for tolerance check</div></div>
            <div class="metric-card"><div class="metric-label">Expected conditional event loss</div><div class="metric-value">${fmtCurrency(r.eventLoss.mean)}</div><div class="metric-sub">Average successful-event loss</div></div>
          </div>
          <div class="grid-3 anim-fade-in anim-delay-1">
            <div class="metric-card"><div class="metric-label">Typical annualized loss</div><div class="metric-value">${fmtCurrency(r.annualLoss.p50)}</div><div class="metric-sub">Midpoint annual view</div></div>
            <div class="metric-card"><div class="metric-label">Severe annualized loss</div><div class="metric-value warning">${fmtCurrency(r.annualLoss.p90)}</div><div class="metric-sub">Annual severe-but-plausible view</div></div>
            <div class="metric-card"><div class="metric-label">Expected annualized loss</div><div class="metric-value">${fmtCurrency(r.annualLoss.mean)}</div><div class="metric-sub">Average annual loss</div></div>
          </div>
        </div>
      </details>

      ${(workflowGuidance.length || assessment.benchmarkBasis || assessment.inputRationale || assessment.evidenceSummary || assessment.confidenceLabel || assessment.inputProvenance?.length) ? `
      <details class="results-detail-disclosure">
        <summary>${rolePresentation.aiSummary}</summary>
        <div class="results-detail-disclosure-copy">Use this when you need to review how the AI formed the inputs and how grounded those inputs were.</div>
        <div class="results-disclosure-stack">
          <div class="grid-2 anim-fade-in">
            ${renderWorkflowGuidanceBlock(workflowGuidance, 'How AI guided this assessment')}
            ${renderBenchmarkRationaleBlock(assessment.benchmarkBasis, assessment.inputRationale, assessment.benchmarkReferences)}
            ${renderInputProvenanceBlock(assessment.inputProvenance)}
          </div>
          ${renderEvidenceQualityBlock(assessment.confidenceLabel, assessment.evidenceQuality, assessment.evidenceSummary, missingInformation, 'How grounded the AI inputs were', { primaryGrounding: primaryGrounding, supportingReferences: supportingReferences, inferredAssumptions: inferredAssumptions })}
        </div>
      </details>` : ''}


      <details class="results-detail-disclosure">
        <summary>Show deeper model detail and charts</summary>
        <div class="results-detail-disclosure-copy">Use this for deeper validation, peer review, or committee-level challenge.</div>
        <div class="results-disclosure-stack">
          ${renderAssessmentAssumptionsBlock(assessmentIntelligence.assumptions)}
          <div class="grid-2 anim-fade-in anim-delay-2">
            <div class="chart-wrap">
              <div class="chart-title">ALE Distribution</div>
              <div class="chart-subtitle">Annual Loss Exposure · ${r.iterations.toLocaleString()} iterations · ${AppState.currency}</div>
              <canvas id="chart-hist"></canvas>
            </div>
            <div class="chart-wrap">
              <div class="chart-title">Loss Exceedance Curve</div>
              <div class="chart-subtitle">P(Annual Loss &gt; x) · orange line = ${fmtCurrency(r.threshold)} threshold</div>
              <canvas id="chart-lec"></canvas>
            </div>
          </div>

          ${assessment.structuredScenario ? `
          <div class="card anim-fade-in">
            <h3 style="font-size:var(--text-base);margin-bottom:var(--sp-4)">Scenario details</h3>
            <div class="grid-2">
              ${Object.entries({
                'Asset / Service': assessment.structuredScenario.assetService,
                'Threat Community': assessment.structuredScenario.threatCommunity,
                'Attack Type': assessment.structuredScenario.attackType,
                'Effect': assessment.structuredScenario.effect
              }).map(([k, v]) => `<div style="background:var(--bg-elevated);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${k}</div><div style="font-size:.85rem;color:var(--text-secondary);margin-top:4px">${v || '—'}</div></div>`).join('')}
            </div>
          </div>` : ''}

          <div class="card anim-fade-in">
            <h3 style="font-size:var(--text-base);margin-bottom:var(--sp-4)">Simulation context</h3>
            <div class="grid-3">
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Event frequency</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${technicalInputs.tefMin ?? '—'}–${technicalInputs.tefLikely ?? '—'}–${technicalInputs.tefMax ?? '—'}</div><div style="font-size:.7rem;color:var(--text-muted)">events/year</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Threat capability</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${technicalInputs.threatCapMin ?? '—'}–${technicalInputs.threatCapLikely ?? '—'}–${technicalInputs.threatCapMax ?? '—'}</div><div style="font-size:.7rem;color:var(--text-muted)">0–1 scale</div></div>
              <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted)">Control strength</div><div style="font-size:.9rem;font-weight:600;margin-top:4px">${technicalInputs.controlStrMin ?? '—'}–${technicalInputs.controlStrLikely ?? '—'}–${technicalInputs.controlStrMax ?? '—'}</div><div style="font-size:.7rem;color:var(--text-muted)">0–1 scale</div></div>
            </div>
            <div class="mt-4" style="font-size:.78rem;color:var(--text-muted)">Iterations: <strong>${r.iterations.toLocaleString()}</strong> · Distribution: <strong>${r.distType || assessment.fairParams?.distType || 'triangular'}</strong> · Event tolerance: <strong>${fmtCurrency(r.threshold)}</strong> · Annual review: <strong>${fmtCurrency(r.annualReviewThreshold || getAnnualReviewThreshold())}</strong></div>
            <div class="form-help" style="margin-top:6px">${escapeHtml(String(r.metricSemantics?.eventLoss || ''))} ${escapeHtml(String(r.metricSemantics?.annualLoss || ''))}</div>
          </div>
          ${renderRunMetadataPanel(runMetadata, r.metricSemantics)}
        </div>
      </details>

      ${citations.length ? `<details class="results-detail-disclosure"><summary>Show key references used</summary><div class="results-disclosure-stack">${renderCitationBlock(citations)}</div></details>` : ''}

      ${recommendations.length ? `
      <details class="results-detail-disclosure">
        <summary>Show full treatment list</summary>
        <div class="results-disclosure-stack">
          <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
            ${recommendations.map((rec, i) => `
              <div class="rec-card">
                <div class="flex items-start gap-4">
                  <div class="rec-number">${i + 1}</div>
                  <div style="flex:1">
                    <div class="rec-title">${rec.title}</div>
                    <div class="rec-why">${rec.why}</div>
                    <div class="rec-impact">↑ ${rec.impact}</div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </details>` : ''}
    </section>`;

  setPage(`
    <main class="page">
      <div class="container container--wide" style="padding:var(--sp-8) var(--sp-6)">
        ${sharedBanner}
        <div class="flex items-center justify-between mb-6 anim-fade-in" style="gap:var(--sp-4);flex-wrap:wrap">
          <div>
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:4px">Assessment Results</div>
            <h1 style="font-size:var(--text-3xl)">${assessment.scenarioTitle || 'Risk Assessment'}</h1>
            <div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:4px">${assessment.buName || '—'} · ${assessment.geography || '—'} · ${completedLabel}</div>
          </div>
          <div class="flex items-center gap-3" style="flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" id="btn-export-pdf">↓ PDF Report</button>
            <button class="btn btn--secondary btn--sm" id="btn-create-treatment-case">Compare a Better Outcome</button>
            <details class="results-actions-disclosure">
              <summary class="btn btn--ghost btn--sm">More actions</summary>
              <div class="results-actions-disclosure-menu">
                <button class="btn btn--secondary btn--sm" id="btn-duplicate-assessment">Duplicate Assessment</button>
                <button class="btn btn--secondary btn--sm" id="btn-share-results">Share</button>
                <button class="btn btn--secondary btn--sm" id="btn-export-json">↓ JSON</button>
                <button class="btn btn--secondary btn--sm" id="btn-export-pptx">↓ PPTX Spec</button>
                <button class="btn btn--secondary btn--sm" id="btn-new-assess-top">New Assessment</button>
              </div>
            </details>
          </div>
        </div>

        <div class="results-tabbar mb-6">
          <button class="results-tab ${activeTab === 'executive' ? 'active' : ''}" data-results-tab="executive">Executive Summary</button>
          <button class="results-tab ${activeTab === 'technical' ? 'active' : ''}" data-results-tab="technical">Technical Detail</button>
        </div>

        <div class="${activeTab === 'executive' ? '' : 'hidden'}" id="results-tab-executive-wrap">${executiveTab}</div>
        ${technicalTab}

        <div class="flex items-center gap-4 mt-8 pt-6" style="border-top:1px solid var(--border-subtle)">
          <a href="#/dashboard" class="btn btn--ghost">← Dashboard</a>
          <button class="btn btn--secondary" id="btn-new-assess">New Assessment</button>
          <div class="bar-spacer"></div>
          <span style="font-size:.72rem;color:var(--text-muted)">ID: ${assessment.id} · ${r.iterations.toLocaleString()} iterations</span>
        </div>
      </div>
    </main>`);

  function drawTechnicalCharts() {
    requestAnimationFrame(() => {
      const hc = document.getElementById('chart-hist');
      const lc = document.getElementById('chart-lec');
      if (hc) UI.drawHistogram(hc, r.histogram, r.threshold, AppState.currency, AppState.fxRate);
      if (lc) UI.drawLEC(lc, r.lec, r.threshold, AppState.currency, AppState.fxRate);
      attachCitationHandlers();
    });
  }

  document.querySelectorAll('[data-results-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.resultsTab = btn.dataset.resultsTab;
      renderResults(id, isShared || assessment._shared);
    });
  });
  if (activeTab === 'technical') drawTechnicalCharts();
  else attachCitationHandlers();
  document.getElementById('btn-share-results')?.addEventListener('click', event => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Copying…';
    try {
      ShareService.copyShareLink(assessment);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 600);
    }
  });
  document.getElementById('btn-export-json')?.addEventListener('click', event => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Exporting…';
    try {
      ExportService.exportJSON(assessment); UI.toast('JSON exported.','success');
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 600);
    }
  });
  document.getElementById('results-compare-select')?.addEventListener('change', (event) => {
    AppState.resultsComparisonId = event.target.value || '';
    renderResults(id, isShared || assessment._shared);
  });
  document.getElementById('btn-export-pdf').addEventListener('click', event => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing PDF…';
    try {
      ExportService.exportPDF(assessment, AppState.currency, AppState.fxRate);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 800);
    }
  });
  const challengeButton = document.getElementById('btn-challenge-assessment');
  if (challengeButton) challengeButton.addEventListener('click', async () => {
    const status = document.getElementById('assessment-challenge-status');
    challengeButton.disabled = true;
    if (status) status.textContent = 'Reviewing the assessment challenge points...';
    try {
      const aiContext = buildCurrentAIAssistContext({ buId: assessment.buId });
      const result = await LLMService.challengeAssessment({
        scenarioTitle: assessment.scenarioTitle,
        narrative: assessment.enhancedNarrative || assessment.narrative || '',
        geography: assessment.geography,
        businessUnitName: assessment.buName,
        businessUnit: aiContext.businessUnit || getBusinessUnitById(assessment.buId),
        adminSettings: aiContext.adminSettings,
        confidence: assessmentIntelligence.confidence,
        drivers: assessmentIntelligence.drivers,
        assumptions: assessmentIntelligence.assumptions,
        missingInformation: missingInformation || [],
        applicableRegulations: assessment.applicableRegulations || [],
        citations: assessment.citations || []
      });
      const next = updateAssessmentRecord(assessment.id, current => ({ ...current, assessmentChallenge: { ...result, createdAt: Date.now(), confidenceLabel: assessment.confidenceLabel || '', evidenceQuality: assessment.evidenceQuality || '' } }));
      if (!next) throw new Error('Could not update the saved assessment.');
      UI.toast(result.usedFallback ? 'Fallback challenge review loaded. Review the suggested questions and evidence gaps.' : 'Suggested challenge review loaded.', result.usedFallback ? 'warning' : 'success', 5000);
      renderResults(assessment.id, isShared || assessment._shared);
    } catch (error) {
      if (status) status.textContent = 'Challenge review could not be generated.';
      UI.toast('The challenge review is unavailable right now. Try again in a moment.', 'danger');
    } finally {
      challengeButton.disabled = false;
    }
  });
  document.getElementById('btn-export-pptx')?.addEventListener('click', event => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Exporting…';
    try {
      ExportService.exportPPTXSpec(assessment, AppState.currency, AppState.fxRate); UI.toast('PPTX spec exported as JSON. See README.','info',5000);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = original;
      }, 600);
    }
  });
  document.getElementById('btn-create-treatment-case').addEventListener('click', event => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing…';
    createTreatmentDraftFromAssessment(assessment);
    UI.toast('Improvement test created. Adjust the assumptions and rerun to compare against the original.', 'success');
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
      Router.navigate('/wizard/3');
    }, 200);
  });
  document.getElementById('btn-duplicate-assessment')?.addEventListener('click', () => {
    const duplicated = duplicateAssessmentToDraft(assessment.id);
    if (!duplicated) {
      UI.toast('That assessment could not be duplicated right now.', 'warning');
      return;
    }
    UI.toast('Assessment duplicated into a new draft.', 'success');
    Router.navigate('/wizard/1');
  });
  document.getElementById('btn-new-assess').addEventListener('click', () => { resetDraft(); Router.navigate('/wizard/1'); });
  document.getElementById('btn-new-assess-top')?.addEventListener('click', () => { resetDraft(); Router.navigate('/wizard/1'); });
  } catch (error) {
    console.error('renderResults failed:', error);
    setPage(`
      <main class="page">
        <div class="container container--narrow" style="padding:var(--sp-12) var(--sp-6)">
          <div class="card">
            <h2 style="margin-bottom:var(--sp-3)">This result could not be opened cleanly</h2>
            <p style="color:var(--text-muted);margin-bottom:var(--sp-5)">The saved assessment data is missing something the results page expected. The assessment is still stored, but this view needed a safer fallback.${error?.message ? ' Error: ' + String(error.message) : ''}</p>
            <div class="flex items-center gap-3" style="flex-wrap:wrap">
              <a href="#/dashboard" class="btn btn--primary">Go to dashboard</a>
              <button class="btn btn--secondary" id="btn-results-retry" type="button">Try again</button>
            </div>
          </div>
        </div>
      </main>`);
    document.getElementById('btn-results-retry')?.addEventListener('click', () => renderResults(id, isShared));
  }
}

// ─── AUTH & SETTINGS ──────────────────────────────────────────
const ADMIN_SECTION_STORAGE_KEY = 'rq_admin_active_section';

function getPreferredAdminSection() {
  const value = String(localStorage.getItem(ADMIN_SECTION_STORAGE_KEY) || '').trim();
  return ['org', 'company', 'defaults', 'access', 'users', 'audit'].includes(value) ? value : 'org';
}

function setPreferredAdminSection(section) {
  const value = ['org', 'company', 'defaults', 'access', 'users', 'audit'].includes(section) ? section : 'org';
  localStorage.setItem(ADMIN_SECTION_STORAGE_KEY, value);
  return value;
}

function getDefaultRouteForCurrentUser() {
  const user = AuthService.getCurrentUser();
  return user?.role === 'admin' ? `/admin/settings/${getPreferredAdminSection()}` : '/dashboard';
}

function userNeedsOrganisationSelection(user = AuthService.getCurrentUser(), settings = getAdminSettings()) {
  if (!user || user.role === 'admin') return false;
  const companyStructure = Array.isArray(settings.companyStructure) ? settings.companyStructure : [];
  const companies = getCompanyEntities(companyStructure);
  if (!companies.length) return false;
  const storedSettings = getUserSettings();
  const selection = resolveUserOrganisationSelection(user, storedSettings, settings);
  const businessUnitEntityId = String(selection.businessUnitEntityId || '').trim();
  const departmentEntityId = String(selection.departmentEntityId || '').trim();
  if (!businessUnitEntityId) return true;
  const departments = getDepartmentEntities(companyStructure, businessUnitEntityId);
  return !!departments.length && !departmentEntityId;
}

function requireAuth() {
  const user = AuthService.getCurrentUser();
  if (!user) {
    AppState.currentUser = null;
    Router.navigate('/login');
    return false;
  }
  AppState.currentUser = user;
  return true;
}

function renderLoginOrganisationSelection(currentUser, existingSettings = getUserSettings()) {
  const adminSettings = getAdminSettings();
  const companyStructure = Array.isArray(adminSettings.companyStructure) ? adminSettings.companyStructure : [];
  const companies = getCompanyEntities(companyStructure);
  if (!companies.length) {
    Router.navigate('/dashboard');
    return;
  }
  const selection = resolveUserOrganisationSelection(currentUser, existingSettings, adminSettings);
  const capability = getNonAdminCapabilityState(currentUser, existingSettings, adminSettings);
  const canChooseDepartment = capability.canManageBusinessUnit && !capability.canManageDepartment;
  let selectedBusinessId = selection.businessUnitEntityId || companies[0]?.id || '';
  const ownedDefault = getDefaultOrgAssignmentForUser(currentUser.username, adminSettings);
  if (!selectedBusinessId && ownedDefault.businessUnitEntityId) {
    selectedBusinessId = ownedDefault.businessUnitEntityId;
  }
  const settings = {
    ...existingSettings,
    userProfile: normaliseUserProfile(existingSettings.userProfile, currentUser)
  };

  function renderSelectionStep() {
    const departmentOptions = getDepartmentEntities(companyStructure, selectedBusinessId);
    let selectedDepartmentId = String(settings.userProfile.departmentEntityId || selection.departmentEntityId || ownedDefault.departmentEntityId || '').trim();
    if (!departmentOptions.some(option => option.id === selectedDepartmentId)) {
      selectedDepartmentId = departmentOptions.find(option => option.ownerUsername === currentUser.username)?.id || departmentOptions[0]?.id || '';
    }
    settings.userProfile.departmentEntityId = selectedDepartmentId;

    setPage(`
      <main class="page">
        <div class="container container--narrow" style="padding:var(--sp-16) var(--sp-6);max-width:760px">
          <div class="card card--elevated">
            <div class="landing-badge">Sign In</div>
            <h2 style="margin-top:var(--sp-4)">Confirm your organisation context</h2>
            <p style="margin-top:8px;color:var(--text-muted)">This confirms the business context used for this session. Admin-assigned scope stays fixed unless your ownership allows a department choice.</p>
            <div class="form-group mt-6">
              <label class="form-label" for="login-business-unit">Business unit / company</label>
              <select class="form-select" id="login-business-unit" disabled>
                ${companies.map(entity => `<option value="${entity.id}" ${entity.id === selectedBusinessId ? 'selected' : ''}>${entity.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group mt-4">
              <label class="form-label" for="login-department">Function / department</label>
              <select class="form-select" id="login-department" ${departmentOptions.length && canChooseDepartment ? '' : 'disabled'}>
                ${departmentOptions.length
                  ? departmentOptions.map(entity => `<option value="${entity.id}" ${entity.id === selectedDepartmentId ? 'selected' : ''}>${entity.name}${entity.ownerUsername === currentUser.username ? ' · your department' : ''}</option>`).join('')
                  : '<option value="">No functions configured yet</option>'}
              </select>
              <span class="form-help">${departmentOptions.length ? (canChooseDepartment ? 'Choose the function context you want to work within for this session.' : 'Your function context is fixed by your current assignment.') : 'No function has been configured beneath this business yet. Ask an admin or BU admin to add one before continuing.'}</span>
            </div>
            <div class="flex items-center justify-between mt-6" style="gap:var(--sp-4);flex-wrap:wrap">
              <button class="btn btn--ghost" id="btn-login-switch-account">Switch Account</button>
              <button class="btn btn--primary" id="btn-login-context-continue">Continue</button>
            </div>
          </div>
        </div>
      </main>`);

    document.getElementById('btn-login-switch-account').addEventListener('click', () => {
      performLogout({ renderLoginScreen: true });
    });
    document.getElementById('btn-login-context-continue').addEventListener('click', async () => {
      const businessUnitEntityId = selectedBusinessId;
      const departmentEntityId = canChooseDepartment ? document.getElementById('login-department').value : selectedDepartmentId;
      const businessEntity = getEntityById(companyStructure, businessUnitEntityId);
      const departmentEntity = getEntityById(companyStructure, departmentEntityId);
      const availableDepartments = getDepartmentEntities(companyStructure, businessUnitEntityId);
      if (!businessEntity) {
        UI.toast('Choose a business unit first.', 'warning');
        return;
      }
      if (availableDepartments.length && !departmentEntity) {
        UI.toast('Choose a department or function for this sign-in session.', 'warning');
        return;
      }
      saveUserSettings({
        ...settings,
        userProfile: {
          ...settings.userProfile,
          businessUnit: businessEntity.name,
          businessUnitEntityId,
          department: departmentEntity?.name || '',
          departmentEntityId: departmentEntity?.id || ''
        }
      });
      activateAuthenticatedState();
      Router.navigate('/dashboard');
    });
  }

  settings.userProfile.businessUnitEntityId = selectedBusinessId;
  renderSelectionStep();
}
