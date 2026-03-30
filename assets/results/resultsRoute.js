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
      ${(() => {
        const anchor = typeof ReportPresentation !== 'undefined' &&
          ReportPresentation.buildMetricAnchorSentence
            ? ReportPresentation.buildMetricAnchorSentence(
                item.title,
                item.current,
                AppState.simulation?.assessment?.benchmarkReferences || [],
                AppState.draft?.geography || ''
              )
            : '';
        return anchor
          ? `<div class="results-metric-anchor">${escapeHtml(anchor)}</div>`
          : '';
      })()}
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

function renderHeroMetric(results, confidenceFrame, geography) {
  const p90 = Number(results?.lm?.p90 || results?.eventLoss?.p90 || 0);
  if (!p90) return '';
  const fmt = fmtCurrency;
  const tone = results?.toleranceBreached
    ? 'danger'
    : results?.nearTolerance
      ? 'warning'
      : 'success';
  const postureLine = results?.toleranceBreached
    ? 'This result is above the governance tolerance threshold and requires management action.'
    : results?.nearTolerance
      ? 'This result is approaching the governance tolerance threshold.'
      : 'This result is currently within the governance tolerance threshold.';
  const geoNote = geography
    ? ` Assessed in the context of ${geography}.`
    : '';
  return `<div class="results-hero-metric anim-slide-up">
    <div class="metric-display__label">Severe single-event view (P90)</div>
    <div class="metric-display metric-display--${tone}">${fmt(p90)}</div>
    <p class="metric-display__context">${postureLine}${geoNote}</p>
  </div>`;
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
    ${(() => {
      const lever = typeof ReportPresentation !== 'undefined' &&
        ReportPresentation.buildFastestReductionLever
          ? ReportPresentation.buildFastestReductionLever(
              AppState.simulation?.assessment?.recommendations,
              executiveDecision
            )
          : '';
      return lever
        ? `<div class="results-lever-sentence">
            <span class="results-lever-sentence__icon">→</span>
            <span class="results-lever-sentence__text">
              ${escapeHtml(lever)}
            </span>
           </div>`
        : '';
    })()}
  </div>`;
}

/* Add to app.css — results-decision-sentence */
/*
.results-decision-sentence {
  padding: var(--sp-6) 0 var(--sp-4);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--sp-5);
}
.results-decision-sentence__label {
  font-size: .7rem;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--sp-2);
}
.results-decision-sentence__headline {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.15;
  margin: 0 0 var(--sp-3);
  max-width: 28ch;
}
.results-decision-sentence__rationale {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0 0 var(--sp-3);
  max-width: 60ch;
}
.results-decision-sentence__priority {
  display: inline-block;
  font-size: .82rem;
  font-weight: 600;
  padding: var(--sp-2) var(--sp-4);
  border-radius: 999px;
  border: 1px solid transparent;
}
.results-decision-sentence__priority--success {
  background: rgba(3,209,168,.1);
  color: var(--color-success);
  border-color: rgba(3,209,168,.25);
}
.results-decision-sentence__priority--warning {
  background: rgba(242,251,90,.15);
  color: var(--color-warning-text, #626f11);
  border-color: rgba(146,156,42,.25);
}
.results-decision-sentence__priority--danger {
  background: rgba(172,67,46,.08);
  color: var(--color-danger);
  border-color: rgba(172,67,46,.2);
}
*/

function renderDecisionSentence(executiveDecision, statusTitle, results) {
  if (!executiveDecision) return '';
  const decision = String(executiveDecision.decision || '').trim();
  const rationale = String(executiveDecision.rationale || '').trim();
  const priority = String(executiveDecision.priority || '').trim();
  if (!decision && !rationale) return '';
  const tone = results?.toleranceBreached
    ? 'danger'
    : results?.nearTolerance
      ? 'warning'
      : 'success';
  return `<div class="results-decision-sentence anim-fade-in">
    <div class="results-decision-sentence__label">Management action</div>
    <h2 class="results-decision-sentence__headline">${escapeHtml(decision || statusTitle)}</h2>
    <p class="results-decision-sentence__rationale">${escapeHtml(rationale)}</p>
    ${priority ? `<div class="results-decision-sentence__priority results-decision-sentence__priority--${tone}">${escapeHtml(priority)}</div>` : ''}
  </div>`;
}

function renderDecisionRail(statusTitle, statusDetail, executiveDecision, executiveAction, confidence, rolePresentation) {
  const confidenceValue = confidence?.label || 'Moderate confidence';
  const confidenceCopy = confidence?.summary || 'Use this result as a management starting point, then challenge the biggest assumptions.';
  return `${renderDecisionSentence(executiveDecision, statusTitle, null)}
<div class="results-decision-rail">
    <div class="results-decision-hero-card card--primary">
      <div class="results-driver-label">Current position</div>
      <div class="results-decision-hero-card__value">${escapeHtml(String(statusTitle || 'Review'))}</div>
      <div class="results-brief-copy">${escapeHtml(String(statusDetail || 'Use this result as the current management position until the key assumptions are challenged.'))}</div>
    </div>
    <div class="results-decision-rail__support">
      ${UI.resultsBriefCard({
        label: 'Confidence',
        value: confidenceValue,
        copy: confidence?.implication
          ? confidence.implication
          : confidenceCopy
      })}
      ${UI.resultsBriefCard({ label: 'Role lens', value: rolePresentation.executiveNoteTitle, copy: rolePresentation.executiveNote })}
    </div>
  </div>`;
}

function renderAnalystSummaryBlock(summary) {
  if (!summary) return '';
  return UI.resultsSectionBlock({
    title: escapeHtml(String(summary.title || 'Analyst summary')),
    className: 'results-section-stack--analyst',
    body: `
    <div class="results-analyst-summary">
      <div class="results-analyst-summary__main">
        <h3 class="results-analyst-summary__title">${escapeHtml(String(summary.opening || 'This result should be read as a decision-support view.'))}</h3>
        <p class="results-summary-copy">${escapeHtml(String(summary.meaning || ''))}</p>
      </div>
      <div class="results-analyst-summary__grid">
        ${UI.resultsSummaryCard({
          label: 'Confidence posture',
          body: `<div class="results-summary-copy">${escapeHtml(String(summary.confidence || ''))}</div>`
        })}
        ${UI.resultsSummaryCard({
          label: 'Best next evidence step',
          body: `<div class="results-summary-copy">${escapeHtml(String(summary.evidence || ''))}</div>`
        })}
        ${UI.resultsSummaryCard({
          label: 'Treatment view',
          wide: true,
          body: `<div class="results-summary-copy">${escapeHtml(String(summary.treatment || ''))}</div>`,
          foot: escapeHtml(String(summary.close || ''))
        })}
      </div>
    </div>`
  });
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
  return `<section class="results-section-stack results-action-spotlight">
    <div class="results-section-heading">Recommended next step</div>
    ${renderLifecycleNextStepCards(cards.slice(0, 1))}
  </section>`;
}

function renderTreatmentRecommendationLens(comparison, recommendations = [], executiveDecision = null, nextStepPlan = []) {
  const fastestLever = typeof ReportPresentation !== 'undefined' &&
    ReportPresentation.buildFastestReductionLever
      ? ReportPresentation.buildFastestReductionLever(recommendations, executiveDecision)
      : '';
  const treatmentDecision = comparison ? ReportPresentation.buildTreatmentDecisionSummary(comparison) : null;
  const assist = comparison ? buildTreatmentDecisionAssist(comparison, treatmentDecision) : null;
  const cards = [
    {
      label: comparison ? 'Decision signal' : 'Best next move',
      title: comparison
        ? (assist?.decisionLabel || 'Review treatment delta')
        : (nextStepPlan[0]?.title || recommendations?.[0]?.title || executiveDecision?.priority || 'Confirm the next management step'),
      copy: comparison
        ? (assist?.decisionNow || comparison.summary || 'Validate the treatment delta before relying on it.')
        : (recommendations?.[0]?.why || nextStepPlan[0]?.copy || 'Use the current result to agree the most credible next action.')
    },
    {
      label: 'Fastest reduction lever',
      title: fastestLever || 'No explicit reduction lever saved yet',
      copy: comparison
        ? (comparison.keyDriver || assist?.whyChanged || 'No dominant treatment driver has been called out yet.')
        : (recommendations?.[1]?.why || 'The current recommendation set has not yet identified a clearly faster lever.')
    },
    {
      label: comparison ? 'Validate before sponsorship' : 'What to pressure-test next',
      title: comparison
        ? (assist?.validateNext || comparison.caveat || 'Validate the treatment assumptions before sponsorship.')
        : (nextStepPlan[1]?.title || 'Close the biggest evidence gap'),
      copy: comparison
        ? (assist?.technicalPrompt || 'Pressure-test the assumptions that are moving the delta most.')
        : (nextStepPlan[1]?.copy || recommendations?.[2]?.why || 'Challenge the biggest assumption before you escalate or commit.')
    }
  ];
  return UI.resultsSectionBlock({
    title: comparison ? 'Treatment recommendation lens' : 'Recommendation lens',
    intro: comparison
      ? 'Use this to decide whether the proposed better-outcome path is credible enough to sponsor.'
      : 'Use this to keep the result action-oriented without dropping into the full technical layer.',
    className: 'results-section-stack--recommendation',
    body: `<div class="results-recommendations-grid">
      ${cards.map(card => UI.resultsSummaryCard({
        label: card.label,
        body: `<p class="results-summary-copy"><strong>${escapeHtml(String(card.title || 'Review'))}</strong></p>`,
        foot: escapeHtml(String(card.copy || ''))
      })).join('')}
    </div>`
  });
}

function renderBoardroomModeIntro(comparison) {
  return `<section class="results-section-stack">
    <div class="results-boardroom-banner">
      <div>
        <div class="results-driver-label">Executive mode</div>
        <h3 class="results-boardroom-banner__title">This view compresses the assessment into the clearest management read, then leaves the deeper challenge layers one step lower.</h3>
      </div>
      <div class="results-boardroom-banner__meta">${comparison ? 'Treatment comparison is still included because it changes the management decision.' : 'Use this mode when you need a board-ready or committee-ready read without the full executive support stack.'}</div>
    </div>
  </section>`;
}

function renderBoardroomSummaryBand({ executiveDecision, confidenceFrame, nextStepPlan = [], scenarioNarrative, analystSummary }) {
  return UI.resultsSectionBlock({
    title: 'Executive mode readout',
    className: 'results-section-stack--boardroom-summary',
    body: `
    <div class="results-summary-grid results-summary-grid--primary results-summary-grid--bg">
      ${UI.resultsSummaryCard({
        label: 'Decision now',
        body: `<p class="results-summary-copy"><strong>${escapeHtml(String(executiveDecision?.priority || executiveDecision?.decision || 'Review the current management position'))}</strong></p>`,
        foot: escapeHtml(String(executiveDecision?.rationale || analystSummary?.opening || 'Use the result to agree the next management action.'))
      })}
      ${UI.resultsSummaryCard({
        label: 'Biggest caveat',
        body: `<p class="results-summary-copy"><strong>${escapeHtml(String(confidenceFrame?.topGap || 'Validate the main evidence gap before formal commitment.'))}</strong></p>`,
        foot: escapeHtml(String(confidenceFrame?.implication || 'Confidence posture should shape how firmly you treat this result.'))
      })}
      ${UI.resultsSummaryCard({
        label: 'Next decision required',
        wide: true,
        body: `<p class="results-summary-copy"><strong>${escapeHtml(String(nextStepPlan[0]?.title || 'Confirm the next management step'))}</strong></p>`,
        foot: escapeHtml(String(nextStepPlan[0]?.copy || scenarioNarrative || 'Use the saved assessment as the working decision view, then challenge the main assumptions.'))
      })}
    </div>`
  });
}

function deriveConfidenceTrajectory(currentAssessment, comparisonBaseline) {
  if (!comparisonBaseline) return null;
  const scoreMap = { 'High confidence': 3, 'Moderate confidence': 2, 'Low confidence': 1 };
  const current = scoreMap[String(currentAssessment?.confidenceLabel || 'Moderate confidence')] || 2;
  const prior = scoreMap[String(comparisonBaseline?.confidenceLabel || 'Moderate confidence')] || 2;
  if (current > prior) return { direction: 'up', label: 'Stronger evidence base than last assessment' };
  if (current < prior) return { direction: 'down', label: 'Weaker evidence base than last assessment' };
  return { direction: 'flat', label: 'Evidence base is similar to last assessment' };
}

function renderResultsConfidenceNeedsBlock(confidenceFrame, evidenceQuality, missingInformation = [], citations = [], comparisonBaseline = null) {
  const topGap = confidenceFrame?.topGap || missingInformation[0] || 'No major evidence gap has been recorded yet.';
  const trajectory = deriveConfidenceTrajectory(
    { confidenceLabel: confidenceFrame?.label },
    comparisonBaseline
  );
  return UI.resultsSectionBlock({
    title: 'Confidence and evidence',
    className: 'results-section-stack--confidence',
    body: `
    <div class="results-summary-grid results-summary-grid--primary results-summary-grid--bg">
      ${UI.resultsSummaryCard({
        label: 'Confidence for decisions',
        body: `${confidenceFrame?.implication
          ? `<p class="results-confidence-implication">${escapeHtml(confidenceFrame.implication)}</p>`
          : ''}
<p class="results-summary-copy"><strong>${confidenceFrame?.label || 'Moderate confidence'}</strong></p>`,
        foot: `${confidenceFrame?.summary || 'Use this as a working decision view, then challenge the largest assumptions.'} ${trajectory ? `${trajectory.direction === 'up' ? '↑' : trajectory.direction === 'down' ? '↓' : '→'} ${trajectory.label}` : ''}`.trim()
      })}
      ${UI.resultsSummaryCard({
        label: 'Evidence base',
        body: `<p class="results-summary-copy"><strong>${evidenceQuality || 'Useful but incomplete evidence base'}</strong></p>`,
        foot: confidenceFrame?.evidenceSummary || `${citations.length} supporting reference${citations.length === 1 ? '' : 's'} attached`
      })}
      ${UI.resultsSummaryCard({
        label: 'Management implication',
        wide: true,
        body: `<p class="results-summary-copy">${confidenceFrame?.implication || topGap}</p>`,
        foot: `Best next evidence to collect: ${topGap}`
      })}
    </div>`
  });
}

function buildTreatmentDecisionAssist(comparison, treatmentDecision) {
  if (!comparison) return null;
  const improving = comparison.severeEvent.direction === 'down' && (comparison.annualExposure.direction === 'down' || comparison.severeAnnual.direction === 'down');
  const partiallyImproving = comparison.severeEvent.direction === 'down';
  const worsening = comparison.severeEvent.direction === 'up' || comparison.annualExposure.direction === 'up' || comparison.severeAnnual.direction === 'up';
  return {
    decisionLabel: improving
      ? 'Sponsor candidate'
      : partiallyImproving
        ? 'Promising, not complete'
        : worsening
          ? 'Not ready to sponsor'
          : 'Needs stronger delta',
    decisionNow: improving
      ? 'Validate the improved-state assumptions, then decide whether to sponsor this treatment path.'
      : partiallyImproving
        ? 'Keep the stronger severe-event assumptions, but do not sponsor the path until the annual burden also improves.'
        : worsening
          ? 'Do not treat this as a better-outcome path yet. Refine the assumptions before using it in investment or prioritisation.'
          : 'Treat this as an incomplete delta. Adjust the assumptions that should move the result most, then rerun the comparison.',
    validationLabel: improving ? 'Validate before sponsorship' : worsening ? 'Challenge before reuse' : 'Validate next',
    technicalPrompt: comparison.secondaryDriver || 'Review the secondary lever only after the main delta driver is credible.',
    whyChanged: comparison.keyDriver || treatmentDecision?.summary || 'No dominant change driver has been called out yet.',
    validateNext: comparison.caveat || 'Validate the treatment assumptions before relying on this delta.'
  };
}

/* Add to app.css — results-sponsorship-verdict */
/*
.results-sponsorship-verdict {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border-radius: 14px 14px 0 0;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 0;
}
.results-sponsorship-verdict--success {
  background: rgba(3,209,168,.08);
  border-color: rgba(3,209,168,.2);
}
.results-sponsorship-verdict--warning {
  background: rgba(242,251,90,.1);
  border-color: rgba(146,156,42,.2);
}
.results-sponsorship-verdict--danger {
  background: rgba(172,67,46,.07);
  border-color: rgba(172,67,46,.18);
}
.results-sponsorship-verdict__icon {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}
.results-sponsorship-verdict__line {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
}
.results-sponsorship-verdict__caveat {
  font-size: .82rem;
  color: var(--text-secondary);
  margin-top: var(--sp-2);
  line-height: 1.6;
}
*/

function renderSponsorshipVerdict(comparison, assist) {
  if (!comparison || !assist) return '';
  const improving = comparison.severeEvent?.direction === 'down'
    && (comparison.annualExposure?.direction === 'down' || comparison.severeAnnual?.direction === 'down');
  const worsening = comparison.severeEvent?.direction === 'up'
    || comparison.annualExposure?.direction === 'up';
  const tone = improving ? 'success' : worsening ? 'danger' : 'warning';
  const icon = improving ? '✓' : worsening ? '✗' : '~';
  const verdictLine = improving
    ? `Sponsor candidate — the treatment path is materially improving the management position.`
    : worsening
      ? `Not ready to sponsor — the treatment assumptions are currently worsening the baseline.`
      : `Incomplete delta — the treatment path is not yet creating a clear management difference.`;
  const keyAssumption = String(comparison.caveat || assist.validateNext || '').trim();
  return `<div class="results-sponsorship-verdict results-sponsorship-verdict--${tone}">
    <div class="results-sponsorship-verdict__icon">${icon}</div>
    <div class="results-sponsorship-verdict__body">
      <div class="results-sponsorship-verdict__line">${escapeHtml(verdictLine)}</div>
      ${keyAssumption
        ? `<div class="results-sponsorship-verdict__caveat">Key assumption to validate: ${escapeHtml(keyAssumption)}</div>`
        : ''}
    </div>
  </div>`;
}

function renderResultsComparisonHighlight(comparison) {
  if (!comparison) return '';
  const treatmentDecision = ReportPresentation.buildTreatmentDecisionSummary(comparison);
  const assist = buildTreatmentDecisionAssist(comparison, treatmentDecision);
  const outcomeTone = comparison.severeEvent.direction === 'down'
    ? 'down'
    : comparison.severeEvent.direction === 'up'
      ? 'up'
      : 'flat';
  const outcomeLabel = comparison.severeEvent.direction === 'down'
    ? 'Decision delta is improving'
    : comparison.severeEvent.direction === 'up'
      ? 'Decision delta is deteriorating'
      : 'Decision delta is limited';
  return `<section class="results-section-stack">
    <div class="results-section-heading">Treatment comparison</div>
    <div class="results-comparison-foot">Use this to see whether the proposed change materially improves the current position and why.</div>
    <div class="results-comparison-card results-comparison-card--spotlight">
      ${renderSponsorshipVerdict(comparison, assist)}
      <div class="results-comparison-spotlight">
        <div>
          <div class="results-driver-label">Decision signal versus the baseline</div>
          <h3 class="results-comparison-spotlight__title">${treatmentDecision.title}</h3>
          <p class="results-summary-copy" style="margin-top:var(--sp-3)">${treatmentDecision.summary}</p>
          <div class="results-comparison-inline-meta">Baseline reference: ${comparison.baselineTitle} · ${comparison.baselineDate}</div>
          <div class="results-comparison-guidance-grid">
            <div class="results-comparison-guidance-card results-comparison-guidance-card--accent">
              <span class="results-driver-label">Decision now</span>
              <strong>${assist.decisionLabel}</strong>
              <span>${assist.decisionNow}</span>
            </div>
            <div class="results-comparison-guidance-card">
              <span class="results-driver-label">What is driving the delta</span>
              <strong>${assist.whyChanged}</strong>
              <span>${assist.technicalPrompt}</span>
            </div>
            <div class="results-comparison-guidance-card">
              <span class="results-driver-label">${assist.validationLabel}</span>
              <strong>${assist.validateNext}</strong>
              <span>Use this to decide whether the better-outcome story is credible enough to rely on.</span>
            </div>
          </div>
        </div>
        <div class="results-comparison-spotlight__rail">
          <div class="results-comparison-verdict results-comparison-verdict--${outcomeTone}">
            <span class="results-driver-label">Treatment verdict</span>
            <strong>${outcomeLabel}</strong>
            <span>${comparison.directionTitle || comparison.summary}</span>
          </div>
          <div class="results-comparison-rail-note">${comparison.statusShift}</div>
          <div class="results-comparison-rail-note results-comparison-rail-note--strong">${treatmentDecision.action}</div>
        </div>
      </div>
      <div class="results-treatment-before-after">
        <div class="results-treatment-posture-card">
          <div class="results-driver-label">Baseline posture</div>
          <strong>${comparison.baselineStatus}</strong>
          <div class="results-treatment-posture-grid">
            <div><span>Severe event</span><strong>${comparison.baselineMetrics.severeEvent}</strong></div>
            <div><span>Expected annual</span><strong>${comparison.baselineMetrics.annualExposure}</strong></div>
            <div><span>Severe annual</span><strong>${comparison.baselineMetrics.severeAnnual}</strong></div>
          </div>
        </div>
        <div class="results-treatment-posture-card results-treatment-posture-card--current">
          <div class="results-driver-label">Treatment posture</div>
          <strong>${comparison.currentStatus}</strong>
          <div class="results-treatment-posture-grid">
            <div><span>Severe event</span><strong>${comparison.currentMetrics.severeEvent}</strong></div>
            <div><span>Expected annual</span><strong>${comparison.currentMetrics.annualExposure}</strong></div>
            <div><span>Severe annual</span><strong>${comparison.currentMetrics.severeAnnual}</strong></div>
          </div>
        </div>
      </div>
      <div class="results-comparison-grid results-comparison-grid--delta">
        <div class="results-comparison-metric ${comparison.severeEvent.direction}"><div class="results-impact-label">Reduction in severe-event exposure</div><div class="results-comparison-value">${comparison.severeEvent.formatted}</div><div class="results-comparison-foot">${comparison.severeEvent.direction === 'down' ? 'Treatment reduces the severe case.' : comparison.severeEvent.direction === 'up' ? 'Treatment currently worsens the severe case.' : 'No material severe-event shift yet.'}</div></div>
        <div class="results-comparison-metric ${comparison.annualExposure.direction}"><div class="results-impact-label">Reduction in expected annual loss</div><div class="results-comparison-value">${comparison.annualExposure.formatted}</div><div class="results-comparison-foot">${comparison.annualExposure.direction === 'down' ? 'Average-year burden is falling.' : comparison.annualExposure.direction === 'up' ? 'Average-year burden is rising.' : 'Average-year burden is broadly unchanged.'}</div></div>
        <div class="results-comparison-metric ${comparison.severeAnnual.direction}"><div class="results-impact-label">Change in threshold posture</div><div class="results-comparison-value">${comparison.currentStatus}</div><div class="results-comparison-foot">${comparison.statusShift}</div></div>
      </div>
      <div class="results-comparison-narrative">
        <div class="results-comparison-narrative__main">
          <div class="results-driver-label">Plain-language treatment impact</div>
          <div class="results-summary-copy">${comparison.treatmentNarrative || treatmentDecision.summary}</div>
        </div>
        <div class="results-comparison-narrative__aside">
          <div class="results-comparison-lever">
            <span class="results-driver-label">Driver shift</span>
            <strong>${comparison.keyDriver}</strong>
          </div>
          <div class="results-comparison-lever">
            <span class="results-driver-label">Confidence caveat</span>
            <strong>${comparison.caveat}</strong>
          </div>
          <div class="results-comparison-lever results-comparison-lever--accent">
            <span class="results-driver-label">Recommendation summary</span>
            <strong>${treatmentDecision.action}</strong>
          </div>
        </div>
      </div>
      <details class="results-detail-disclosure" style="margin-top:var(--sp-5);margin-bottom:0">
        <summary>Show technical comparison detail</summary>
        <div class="results-detail-disclosure-copy">Open this when you want the exact baseline-versus-treatment movement for each saved metric.</div>
        <div class="results-disclosure-stack">
          <div class="results-comparison-grid">
            <div class="results-comparison-metric ${comparison.severeEvent.direction}"><div class="results-impact-label">Severe single event delta</div><div class="results-comparison-value">${comparison.severeEvent.formatted}</div><div class="results-comparison-foot">Baseline ${comparison.baselineMetrics.severeEvent} → Treatment ${comparison.currentMetrics.severeEvent}</div></div>
            <div class="results-comparison-metric ${comparison.annualExposure.direction}"><div class="results-impact-label">Expected annual exposure delta</div><div class="results-comparison-value">${comparison.annualExposure.formatted}</div><div class="results-comparison-foot">Baseline ${comparison.baselineMetrics.annualExposure} → Treatment ${comparison.currentMetrics.annualExposure}</div></div>
            <div class="results-comparison-metric ${comparison.severeAnnual.direction}"><div class="results-impact-label">Severe annual exposure delta</div><div class="results-comparison-value">${comparison.severeAnnual.formatted}</div><div class="results-comparison-foot">Baseline ${comparison.baselineMetrics.severeAnnual} → Treatment ${comparison.currentMetrics.severeAnnual}</div></div>
          </div>
        </div>
      </details>
    </div>
  </section>`;
}

function renderAssumptionTraceabilityPanel({ assessment, assessmentIntelligence, citations = [], primaryGrounding = [], supportingReferences = [], missingInformation = [] }) {
  const assumptions = Array.isArray(assessmentIntelligence?.assumptions) ? assessmentIntelligence.assumptions.slice(0, 4) : [];
  const provenance = Array.isArray(assessment?.inputProvenance) ? assessment.inputProvenance.filter(Boolean) : [];
  const traceRows = assumptions.map((item, index) => {
    const text = escapeHtml(String(item?.text || item || 'Unnamed assumption'));
    const basis = formatSourceBasisSummary(item?.basis || item?.sourceBasis || provenance[index] || primaryGrounding[index] || supportingReferences[index] || '');
    const confidence = item?.confidence || item?.strength || '';
    return `<div class="results-trace-row">
      <div class="results-trace-row__head">
        <strong>Assumption ${index + 1}</strong>
        ${confidence ? `<span class="badge badge--neutral">${escapeHtml(String(confidence))}</span>` : ''}
      </div>
      <div class="results-summary-copy">${text}</div>
      <div class="results-comparison-foot" style="margin-top:var(--sp-2)">${basis ? `Source basis: ${escapeHtml(basis)}` : 'Source basis not explicitly recorded for this assumption yet.'}</div>
    </div>`;
  }).join('');
  const topGap = missingInformation[0] || 'No major missing information was recorded for this assessment.';
  return UI.resultsSectionBlock({
    title: 'Assumption traceability',
    className: 'results-section-stack--traceability',
    body: `
    <div class="results-traceability-grid">
      ${UI.resultsSummaryCard({
        label: 'What the result is relying on',
        wide: true,
        body: traceRows || '<div class="results-summary-copy">No explicit assumption trace was saved with this assessment yet.</div>'
      })}
      ${UI.resultsSummaryCard({
        label: 'Evidence and readiness',
        body: `<div class="results-trace-stat"><strong>${citations.length}</strong><span>linked reference${citations.length === 1 ? '' : 's'}</span></div>
        <div class="results-trace-stat"><strong>${provenance.length || primaryGrounding.length || supportingReferences.length || 0}</strong><span>tracked basis item${(provenance.length || primaryGrounding.length || supportingReferences.length || 0) === 1 ? '' : 's'}</span></div>`,
        foot: `Biggest missing information: ${escapeHtml(String(topGap))}`
      })}
    </div>`
  });
}

function renderExecutiveInsightCluster({ scenarioNarrative, executiveDecision, executiveAnnualView, analystSummary, comparisonHighlight, recommendationCards }) {
  return UI.resultsSectionBlock({
    title: 'Executive meaning',
    intro: 'Start here for business meaning, treatment impact, and the immediate decision.',
    className: 'results-section-stack--insight',
    body: `
    <div class="results-summary-grid results-summary-grid--primary">
      ${UI.resultsSummaryCard({
        label: 'What this means in plain language',
        wide: true,
        body: `<p class="results-summary-copy">${scenarioNarrative}</p>`
      })}
      ${UI.resultsSummaryCard({
        label: 'Management posture',
        body: `<p class="results-summary-copy"><strong>${escapeHtml(String(executiveDecision?.decision || 'Review'))}</strong></p>`,
        foot: escapeHtml(String(executiveAnnualView || ''))
      })}
      ${UI.resultsSummaryCard({
        label: 'Recommended next move',
        body: `<p class="results-summary-copy">${escapeHtml(String(executiveDecision?.priority || executiveDecision?.managementFocus || 'Confirm the next management step for this scenario.'))}</p>`
      })}
    </div>
    ${renderAnalystSummaryBlock(analystSummary)}
    ${comparisonHighlight}
    ${recommendationCards}
  `});
}

function renderAssessmentValueBand(valueModel) {
  if (!valueModel) return '';
  const internalValueNote = valueModel.cost?.internalCostAvoidedUsd
    ? `Directional internal cost avoided at the current rate card: ${fmtCurrency(valueModel.cost.internalCostAvoidedUsd)}.`
    : 'Directional internal cost avoided is not available yet.';
  const externalValueNote = valueModel.cost?.externalEquivalentValueUsd
    ? `External-equivalent value at the current Big 4-style UAE rate card: ${fmtCurrency(valueModel.cost.externalEquivalentValueUsd)}.`
    : 'External-equivalent value is not available yet.';
  return `<section class="results-value-band results-guidance-band card card--elevated anim-fade-in">
    <div class="results-value-band__head">
      <div>
        <div class="results-section-heading">Value created by this assessment</div>
        <div class="form-help">Measured cycle time, directional effort avoided, and modelled downside reduction stay separate so the economics are easier to defend with leadership.</div>
      </div>
      <span class="badge badge--neutral">${escapeHtml(String(valueModel.domain?.label || 'General enterprise'))} · ${escapeHtml(String(valueModel.complexity?.label || 'Working complexity'))}</span>
    </div>
    <div class="premium-guidance-strip premium-guidance-strip--support results-guidance-strip">
      <div class="premium-guidance-strip__main">
        <div class="premium-guidance-strip__label">Leadership framing</div>
        <strong>Use external-equivalent value and modelled downside reduction as separate signals.</strong>
        <div class="premium-guidance-strip__copy">The comparable advisory benchmark shows directional effort and value avoided, while modelled reduction only appears once a better-outcome comparison exists.</div>
      </div>
      <div class="premium-guidance-strip__meta">
        <span class="badge badge--neutral">${escapeHtml(String(valueModel.directional?.externalEquivalentDaysLabel || 'No specialist-day benchmark yet'))}</span>
        <span class="badge badge--gold">${valueModel.modelled?.available ? 'Modelled reduction available' : 'Treatment comparison not yet built'}</span>
      </div>
    </div>
    <div class="results-value-grid">
      <article class="results-value-card">
        <span class="results-value-card__label">Measured cycle time</span>
        <strong>${escapeHtml(String(valueModel.measured?.platformDurationLabel || 'No measured cycle time yet'))}</strong>
        <span class="results-value-card__foot">From the first saved draft to the completed result.</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">Directional internal effort avoided</span>
        <strong>${escapeHtml(String(valueModel.directional?.internalHoursAvoidedLabel || '0 hours'))}</strong>
        <span class="results-value-card__foot">Against a ${escapeHtml(String(valueModel.domain?.label || 'general enterprise').toLowerCase())} baseline of ${escapeHtml(String(valueModel.directional?.manualBaselineLabel || '0 analyst hours'))}.</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">External specialist equivalent</span>
        <strong>${escapeHtml(String(valueModel.directional?.externalEquivalentDaysLabel || 'No specialist-day benchmark yet'))}</strong>
        <span class="results-value-card__foot">Directional Big 4-style UAE advisory equivalent for this domain and complexity.</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">Modelled annual reduction</span>
        <strong>${valueModel.modelled?.available ? escapeHtml(String(fmtCurrency(valueModel.modelled.annualReductionUsd))) : 'Build a treatment case'}</strong>
        <span class="results-value-card__foot">${escapeHtml(String(valueModel.modelled?.available ? valueModel.modelled.sourceLabel : valueModel.modelled?.title || 'Create a better-outcome comparison to quantify modelled reduction.'))}</span>
      </article>
    </div>
    <div class="results-value-band__foot">
      <span>${escapeHtml(internalValueNote)}</span>
      <span>${escapeHtml(externalValueNote)}</span>
    </div>
  </section>`;
}

function buildAssessmentAiQualitySignal(assessment = {}) {
  const confidence = String(assessment?.confidenceLabel || assessment?.assessmentIntelligence?.confidence?.label || '').trim();
  const evidenceQuality = String(assessment?.evidenceQuality || assessment?.assessmentIntelligence?.confidence?.evidenceQuality || '').trim();
  const citationCount = Array.isArray(assessment?.citations) ? assessment.citations.filter(Boolean).length : 0;
  const groundingCount = (Array.isArray(assessment?.primaryGrounding) ? assessment.primaryGrounding.filter(Boolean).length : 0)
    + (Array.isArray(assessment?.supportingReferences) ? assessment.supportingReferences.filter(Boolean).length : 0);
  const qualityState = String(assessment?.aiQualityState || '').trim().toLowerCase();
  const totalSupport = citationCount + groundingCount;
  if (qualityState === 'analyst-reshaped') {
    return {
      tone: 'warning',
      label: 'Materially analyst-reshaped',
      summary: 'The current scenario was materially reshaped after the initial AI draft, so leadership should treat the result as analyst-led with AI support in the background.'
    };
  }
  if (qualityState === 'fallback' || /fallback|no live model/i.test(`${confidence} ${evidenceQuality}`)) {
    return {
      tone: 'warning',
      label: 'Fallback-generated',
      summary: 'The platform used fallback guidance instead of a clean live AI result. Review the evidence and challenge layers before relying on the output.'
    };
  }
  if (assessment?.llmAssisted && !/thin|weak|incomplete|low/i.test(`${confidence} ${evidenceQuality}`) && totalSupport >= 2) {
    return {
      tone: 'success',
      label: 'Strongly grounded',
      summary: 'The scenario, benchmark framing, and evidence base are aligned strongly enough for leadership discussion, while still remaining a challengeable decision view.'
    };
  }
  if (assessment?.llmAssisted) {
    return {
      tone: 'support',
      label: 'Lightly grounded',
      summary: 'AI has shaped the result, but the evidence base or confidence posture still suggests a working management view rather than a fully anchored read.'
    };
  }
  return {
    tone: 'quiet',
    label: 'Analyst-built',
    summary: 'This result is primarily analyst-shaped and should be read as a structured management view rather than a strongly AI-grounded output.'
  };
}

function renderExecutiveBenchmarkContext(assessment, results, runMetadata) {
  const references = Array.isArray(assessment?.benchmarkReferences) ? assessment.benchmarkReferences.filter(Boolean) : [];
  const thresholdConfig = runMetadata?.thresholdConfigUsed || {};
  const warningThreshold = Number(results?.warningThreshold || thresholdConfig.warningThreshold || 0);
  const toleranceThreshold = Number(results?.threshold || thresholdConfig.eventToleranceThreshold || 0);
  const annualReviewThreshold = Number(results?.annualReviewThreshold || thresholdConfig.annualReviewThreshold || 0);
  const triggerCount = [warningThreshold, toleranceThreshold, annualReviewThreshold].filter(value => Number(value) > 0).length;
  const topReferences = references
    .map(ref => String(ref?.sourceTitle || ref?.title || ref?.label || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const benchmarkBasis = String(assessment?.benchmarkBasis || '').trim();
  const basisSummary = benchmarkBasis
    ? benchmarkBasis
    : references.length
      ? 'Published benchmark references were used where they mapped cleanly, then scenario-calibration baselines were used only where direct comparators were thin.'
      : 'Governance thresholds and scenario-calibration baselines were used because no published benchmark references were saved for this result.';
  const qualitySignal = buildAssessmentAiQualitySignal(assessment);
  return `<section class="card card--elevated anim-fade-in results-benchmark-band">
    <div class="results-section-heading">Benchmark context</div>
    <div class="form-help" style="margin-top:8px">Benchmarked against ${references.length || 'no saved'} reference${references.length === 1 ? '' : 's'} and ${triggerCount} governance trigger${triggerCount === 1 ? '' : 's'} so leadership can see what anchored the result.</div>
    <div class="premium-guidance-strip premium-guidance-strip--${escapeHtml(String(qualitySignal.tone || 'support'))} results-guidance-strip" style="margin-top:var(--sp-4)">
      <div class="premium-guidance-strip__main">
        <div class="premium-guidance-strip__label">Trust signal</div>
        <strong>${escapeHtml(String(qualitySignal.label || 'Working guidance'))}</strong>
        <div class="premium-guidance-strip__copy">${escapeHtml(String(qualitySignal.summary || 'The platform is showing how strongly the current result is grounded before it is used in a leadership discussion.'))}</div>
      </div>
      <div class="premium-guidance-strip__meta">
        <span class="badge badge--neutral">${references.length ? `${references.length} saved reference${references.length === 1 ? '' : 's'}` : 'Scenario baseline only'}</span>
        <span class="badge badge--gold">${triggerCount} governance trigger${triggerCount === 1 ? '' : 's'}</span>
      </div>
    </div>
    <div class="results-value-grid" style="margin-top:var(--sp-4)">
      <article class="results-value-card">
        <span class="results-value-card__label">Reference coverage</span>
        <strong>${references.length ? `${references.length} saved reference${references.length === 1 ? '' : 's'}` : 'Scenario-calibration baseline'}</strong>
        <span class="results-value-card__foot">${escapeHtml(topReferences.length ? topReferences.join(' · ') : 'No published benchmark titles were saved for this result.')}</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">Governance triggers</span>
        <strong>${triggerCount} active trigger${triggerCount === 1 ? '' : 's'}</strong>
        <span class="results-value-card__foot">Warning ${fmtCurrency(warningThreshold)} · Tolerance ${fmtCurrency(toleranceThreshold)} · Annual review ${fmtCurrency(annualReviewThreshold)}</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">Benchmark approach</span>
        <strong>${references.length ? 'Published references plus governance thresholds' : 'Governance thresholds plus scenario baseline'}</strong>
        <span class="results-value-card__foot">${escapeHtml(basisSummary)}</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">AI quality signal</span>
        <strong>${escapeHtml(String(qualitySignal.label || 'Working guidance'))}</strong>
        <span class="results-value-card__foot">${escapeHtml(String(qualitySignal.summary || 'Use the confidence and evidence layer to decide how much reliance to place on the AI-supported output.'))}</span>
      </article>
    </div>
  </section>`;
}

function renderTrustExplanationLayer({ confidenceNeedsBlock, evidenceGapPlan = [], explanationPanel, impactMix, thresholdModel, results, assessmentIntelligence, assessment, citations, primaryGrounding, supportingReferences, missingInformation }) {
  return UI.resultsSectionBlock({
    title: 'Trust and explanation',
    intro: 'Use this layer to understand what is driving the result, how much confidence to place in it, and what still needs evidence.',
    className: 'results-layer-band results-layer-band--editorial',
    body: `
    ${confidenceNeedsBlock}
    ${evidenceGapPlan.length ? renderEvidenceGapActionPlan(evidenceGapPlan, {
      title: 'Best evidence to collect next',
      subtitle: 'Use these to strengthen confidence, narrow the range, or improve the treatment decision before the next review.',
      compact: true,
      lowEmphasis: true
    }) : ''}
    ${explanationPanel}
    ${renderAssumptionTraceabilityPanel({ assessment, assessmentIntelligence, citations, primaryGrounding, supportingReferences, missingInformation })}
    ${UI.resultsDetailDisclosure({
      summary: 'Show supporting drivers, cost mix, and governance tracks',
      copy: 'Open this when you want the main sensitivities, cost composition, and benchmark context behind the headline view.',
      body: `
        ${renderExecutiveDriversSummary(assessmentIntelligence.drivers, assessment)}
        <div class="results-visual-grid">
          ${renderExecutiveThresholdTracks(thresholdModel)}
          <div class="chart-wrap" style="margin:var(--sp-6) 0">
            <div class="chart-title">Loss Exceedance Curve</div>
            <div class="chart-subtitle">P(Annual Loss &gt; x) · orange line = tolerance threshold</div>
            <canvas id="chart-lec"></canvas>
          </div>
          ${renderExecutiveImpactMix(impactMix)}
        </div>
        ${renderExecutiveSignalCard(results)}
      `
    })}
  `});
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
    caveat: currentAssessment.missingInformation?.[0] || baselineAssessment.missingInformation?.[0] || 'Validate the treatment assumptions before relying on this delta for investment or prioritisation.',
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
        : 'This scenario is broadly aligned with the selected baseline on the severe single-event view, so the proposed change is not yet materially shifting the management position.',
    baselineMetrics: {
      severeEvent: fmtCurrency(baseline.lm?.p90 || 0),
      annualExposure: fmtCurrency(baseline.ale?.mean || 0),
      severeAnnual: fmtCurrency(baseline.ale?.p90 || 0)
    },
    currentMetrics: {
      severeEvent: fmtCurrency(current.lm?.p90 || 0),
      annualExposure: fmtCurrency(current.ale?.mean || 0),
      severeAnnual: fmtCurrency(current.ale?.p90 || 0)
    }
  };
}

function recordAssessmentRerunLearning(savedAssessment, baselineAssessment, comparison) {
  const username = AuthService.getCurrentUser()?.username || '';
  if (!username || !baselineAssessment || !comparison || typeof LearningStore === 'undefined' || typeof LearningStore.recordRerunDelta !== 'function') return;
  // Keep the learned rerun summary compact so future treatment prompts can reuse the main directional lever without storing the whole result object.
  LearningStore.recordRerunDelta(username, {
    buId: savedAssessment?.buId || '',
    scenarioLens: savedAssessment?.scenarioLens || null,
    baselineTitle: comparison.baselineTitle || baselineAssessment.scenarioTitle || '',
    deltaDirection: comparison.severeEvent?.direction || '',
    annualDirection: comparison.annualExposure?.direction || '',
    keyDriver: comparison.keyDriver || '',
    summary: comparison.summary || ''
  });
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
  const treatmentStartedAt = Date.now();
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
    startedAt: treatmentStartedAt,
    createdAt: treatmentStartedAt,
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
  const treatmentDecision = comparison ? ReportPresentation.buildTreatmentDecisionSummary(comparison) : null;
  const assist = comparison ? buildTreatmentDecisionAssist(comparison, treatmentDecision) : null;
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
        <div class="results-comparison-banner" style="margin-top:var(--sp-3)"><strong>Decision read:</strong> ${treatmentDecision.title}</div>
        <div class="results-comparison-banner">
          <strong>Comparing against:</strong> ${comparison.baselineTitle} · ${comparison.baselineDate}
        </div>
        <p class="results-summary-copy" style="margin-top:var(--sp-3)">${treatmentDecision.summary}</p>
        <div class="results-comparison-guidance-grid results-comparison-guidance-grid--compact">
          <div class="results-comparison-guidance-card results-comparison-guidance-card--accent">
            <span class="results-driver-label">Decision now</span>
            <strong>${assist.decisionLabel}</strong>
            <span>${assist.decisionNow}</span>
          </div>
          <div class="results-comparison-guidance-card">
            <span class="results-driver-label">Driver shift</span>
            <strong>${assist.whyChanged}</strong>
            <span>${assist.technicalPrompt}</span>
          </div>
          <div class="results-comparison-guidance-card">
            <span class="results-driver-label">${assist.validationLabel}</span>
            <strong>${assist.validateNext}</strong>
            <span>Pressure-test this before treating the delta as a reliable investment signal.</span>
          </div>
        </div>
        <div class="results-treatment-before-after" style="margin-top:var(--sp-4)">
          <div class="results-treatment-posture-card">
            <div class="results-driver-label">Baseline</div>
            <strong>${comparison.baselineStatus}</strong>
            <div class="results-treatment-posture-grid">
              <div><span>Severe event</span><strong>${comparison.baselineMetrics.severeEvent}</strong></div>
              <div><span>Expected annual</span><strong>${comparison.baselineMetrics.annualExposure}</strong></div>
              <div><span>Severe annual</span><strong>${comparison.baselineMetrics.severeAnnual}</strong></div>
            </div>
          </div>
          <div class="results-treatment-posture-card results-treatment-posture-card--current">
            <div class="results-driver-label">Treatment</div>
            <strong>${comparison.currentStatus}</strong>
            <div class="results-treatment-posture-grid">
              <div><span>Severe event</span><strong>${comparison.currentMetrics.severeEvent}</strong></div>
              <div><span>Expected annual</span><strong>${comparison.currentMetrics.annualExposure}</strong></div>
              <div><span>Severe annual</span><strong>${comparison.currentMetrics.severeAnnual}</strong></div>
            </div>
          </div>
        </div>
        <div class="results-comparison-banner" style="margin-top:var(--sp-3)">${comparison.statusShift}</div>
        <div class="results-comparison-banner results-comparison-banner--premium" style="margin-top:var(--sp-3)">${treatmentDecision.action}</div>
        <div class="results-comparison-grid">
          <div class="results-comparison-metric ${comparison.severeEvent.direction}">
            <div class="results-impact-label">Severe single event delta</div>
            <div class="results-comparison-value">${comparison.severeEvent.formatted}</div>
            <div class="results-comparison-foot">Baseline ${comparison.baselineMetrics.severeEvent} → Treatment ${comparison.currentMetrics.severeEvent}</div>
          </div>
          <div class="results-comparison-metric ${comparison.annualExposure.direction}">
            <div class="results-impact-label">Expected annual exposure delta</div>
            <div class="results-comparison-value">${comparison.annualExposure.formatted}</div>
            <div class="results-comparison-foot">Baseline ${comparison.baselineMetrics.annualExposure} → Treatment ${comparison.currentMetrics.annualExposure}</div>
          </div>
          <div class="results-comparison-metric ${comparison.severeAnnual.direction}">
            <div class="results-impact-label">High-end annual exposure delta</div>
            <div class="results-comparison-value">${comparison.severeAnnual.formatted}</div>
            <div class="results-comparison-foot">Baseline ${comparison.baselineMetrics.severeAnnual} → Treatment ${comparison.currentMetrics.severeAnnual}</div>
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

function renderTechnicalChallengePanel(assessment, technicalInputs, assessmentIntelligence, confidenceFrame, comparison) {
  const entries = buildParameterChallengeEntries({
    technicalInputs,
    inputAssignments: buildLiveInputSourceAssignments(assessment),
    confidence: assessmentIntelligence?.confidence,
    missingInformation: assessment.missingInformation,
    citations: assessment.citations,
    primaryGrounding: assessment.primaryGrounding,
    supportingReferences: assessment.supportingReferences,
    assumptions: assessmentIntelligence?.assumptions,
    comparison
  });
  return renderParameterChallengePanel(entries, {
    title: 'Challenge a key parameter',
    subtitle: confidenceFrame?.summary
      ? `Use this when you want to challenge one important assumption at a time. ${confidenceFrame.summary}`
      : 'Use this when you want to challenge one important assumption at a time before accepting the technical read.'
  });
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
  return UI.resultsSectionBlock({
    title: 'Why this result looks the way it does',
    body: `
    <div class="results-summary-grid results-summary-grid--primary">
      ${UI.resultsSummaryCard({
        label: 'Top drivers',
        body: `<div class="results-summary-copy">${topDrivers.length ? topDrivers.map(item => `• ${escapeHtml(String(item.label || 'Driver'))}: ${escapeHtml(String(item.why || ''))}`).join('<br>') : '• No dominant drivers were captured for this run.'}</div>`
      })}
      ${UI.resultsSummaryCard({
        label: 'Biggest assumptions',
        body: `<div class="results-summary-copy">${assumptions.length ? assumptions.map(item => `• ${escapeHtml(String(item.text || ''))}`).join('<br>') : '• No assumptions were saved with this run.'}</div>`
      })}
      ${UI.resultsSummaryCard({
        label: 'Where uncertainty matters most',
        body: `<div class="results-summary-copy">${uncertainty.length ? uncertainty.map(item => `• ${escapeHtml(String(item.label || 'Uncertainty'))}: ${escapeHtml(String(item.why || ''))}`).join('<br>') : '• No dominant uncertainty sources were captured for this run.'}</div>`
      })}
      ${UI.resultsSummaryCard({
        label: 'Confidence caveats',
        body: `<div class="results-summary-copy">${caveats.length ? caveats.map(item => `• ${escapeHtml(String(item || ''))}`).join('<br>') : '• Confidence caveats were not recorded for this run.'}</div>`
      })}
      ${UI.resultsSummaryCard({
        label: 'Treatment delta explanation',
        wide: true,
        body: `<div class="results-summary-copy">${escapeHtml(String(treatmentDelta))}</div>`,
        foot: `${comparison?.secondaryDriver ? `${escapeHtml(String(comparison.secondaryDriver))} · ` : ''}${escapeHtml(String(runtimeNote))}`
      })}
    </div>`
  });
}

function renderModelBasisPanel(assessment, runMetadata, confidenceFrame, thresholdModel) {
  const basis = buildResultTrustBasis({
    assessment,
    runMetadata,
    inputAssignments: buildLiveInputSourceAssignments(assessment)
  });
  return UI.resultsSectionBlock({
    title: 'Technical appendix',
    intro: 'Open this layer when you want the model basis, input sources, and reproducibility detail behind the headline result.',
    body: `
    <div class="results-model-basis">
      <div class="results-model-basis__intro">
        <div class="results-driver-label">Plain-language model summary</div>
        <h3 class="results-model-basis__title">This result comes from structured FAIR inputs run through Monte Carlo simulation, not from a narrative judgement alone.</h3>
        <p class="results-summary-copy">The platform combines user-entered values, AI-seeded starting points, inherited context/default assumptions, and recorded judgement calls. It then simulates many plausible outcomes so the result shows a range, not a single false-precision answer.</p>
      </div>
      <div class="results-model-basis__grid">
        <div class="results-model-basis-card">
          <div class="results-driver-label">Input origin mix</div>
          <div class="results-origin-list">
            <div><span>User-entered inputs</span><strong>${basis.userEntered}</strong></div>
            <div><span>AI-suggested starting inputs</span><strong>${basis.aiSuggested}</strong></div>
            <div><span>Inherited context/default guidance</span><strong>${basis.inheritedContext}</strong></div>
            <div><span>Inferred assumptions</span><strong>${basis.inferredAssumptions}</strong></div>
          </div>
        </div>
        <div class="results-model-basis-card">
          <div class="results-driver-label">Confidence posture</div>
          <strong>${escapeHtml(String(confidenceFrame?.label || 'Moderate confidence'))}</strong>
          <span>${escapeHtml(String(confidenceFrame?.summary || 'Use this as a working decision view and challenge the largest assumptions.'))}</span>
          <div class="results-comparison-foot" style="margin-top:var(--sp-3)">${basis.citations} linked reference${basis.citations === 1 ? '' : 's'} · ${basis.provenance} tracked provenance item${basis.provenance === 1 ? '' : 's'}</div>
        </div>
        <div class="results-model-basis-card">
          <div class="results-driver-label">Reproducibility</div>
          <strong>Seed ${escapeHtml(String(basis.seed))}</strong>
          <span>${escapeHtml(basis.iterations)} iterations · ${escapeHtml(basis.distribution)} event model · vulnerability ${escapeHtml(basis.vulnerabilityMode)}</span>
        </div>
        <div class="results-model-basis-card">
          <div class="results-driver-label">Threshold interpretation</div>
          <strong>${escapeHtml(String(thresholdModel?.single?.status || 'Threshold view unavailable'))}</strong>
          <span>${escapeHtml(String(thresholdModel?.single?.summary || 'The event-loss severe case is compared directly against the current tolerance threshold.'))}</span>
        </div>
      </div>
      ${UI.resultsDetailDisclosure({
        summary: 'How the model works and what influenced this result',
        copy: 'Open this for the short scientific explanation and the live source audit behind the current result.',
        style: 'margin-bottom:0',
        body: `
          ${renderSimulationEquationFlow()}
          ${renderInputSourceAuditBlock(buildLiveInputSourceAssignments(assessment))}
        `
      })}
    </div>`
  });
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

function renderTechnicalReviewSurface(results, assessmentIntelligence, confidenceFrame, assessment, thresholdModel) {
  const topDriver = Array.isArray(assessmentIntelligence?.drivers?.sensitivity) ? assessmentIntelligence.drivers.sensitivity[0] : null;
  const topAssumption = Array.isArray(assessmentIntelligence?.assumptions) ? assessmentIntelligence.assumptions[0] : null;
  const basis = buildResultTrustBasis({
    assessment,
    runMetadata: results.runMetadata || null,
    inputAssignments: buildLiveInputSourceAssignments(assessment)
  });
  return `<section class="results-section-stack">
    <div class="results-section-heading">Technical review priorities</div>
    <div class="results-technical-surface">
      <div class="results-technical-hero-card">
        <div class="results-driver-label">Challenge focus</div>
        <h3 class="results-technical-hero-card__title">${escapeHtml(String(topDriver?.label || 'Review the dominant drivers before you challenge the full model.'))}</h3>
        <p class="results-summary-copy">${escapeHtml(String(topDriver?.why || 'Use this page to validate the core ranges, the confidence posture, and the assumptions that most affect the output.'))}</p>
        <div class="results-technical-hero-card__foot">
          <span><strong>Confidence:</strong> ${escapeHtml(String(confidenceFrame?.label || 'Moderate confidence'))}</span>
          <span><strong>Top assumption:</strong> ${escapeHtml(String(topAssumption?.text || 'No major assumption has been recorded yet.'))}</span>
        </div>
      </div>
      <div class="results-technical-metric-grid">
        <div class="results-technical-metric-tile">
          <div class="results-driver-label">Severe event</div>
          <strong>${fmtCurrency(results.eventLoss.p90)}</strong>
          <span>Primary event-loss challenge point</span>
        </div>
        <div class="results-technical-metric-tile">
          <div class="results-driver-label">Expected annual</div>
          <strong>${fmtCurrency(results.annualLoss.mean)}</strong>
          <span>Average-year planning view</span>
        </div>
        <div class="results-technical-metric-tile">
          <div class="results-driver-label">Threshold posture</div>
          <strong>${escapeHtml(String(thresholdModel?.single?.status || 'Unavailable'))}</strong>
          <span>${escapeHtml(String(thresholdModel?.single?.summary || 'Threshold interpretation unavailable.'))}</span>
        </div>
        <div class="results-technical-metric-tile">
          <div class="results-driver-label">Input origin mix</div>
          <strong>${basis.userEntered}/${basis.aiSuggested}/${basis.inheritedContext}</strong>
          <span>User / AI / inherited context inputs</span>
        </div>
      </div>
    </div>
  </section>`;
}

function renderTechnicalStoryBand(results, assessmentIntelligence, confidenceFrame, thresholdModel, assessment) {
  const sensitivity = Array.isArray(assessmentIntelligence?.drivers?.sensitivity) ? assessmentIntelligence.drivers.sensitivity.slice(0, 3) : [];
  const basis = buildResultTrustBasis({
    assessment,
    runMetadata: results.runMetadata || null,
    inputAssignments: buildLiveInputSourceAssignments(assessment)
  });
  const threshold = Number(results.threshold || 0);
  const warningThreshold = Number(results.warningThreshold || 0);
  const severeLoss = Number(results.eventLoss?.p90 || 0);
  const maxScale = Math.max(severeLoss, threshold, warningThreshold, 1);
  const severePct = Math.min(100, (severeLoss / maxScale) * 100);
  const warningPct = Math.min(100, (warningThreshold / maxScale) * 100);
  const thresholdPct = Math.min(100, (threshold / maxScale) * 100);
  const basisTotal = Math.max(1, basis.userEntered + basis.aiSuggested + basis.inheritedContext);
  const basisParts = [
    { label: 'User-entered', value: basis.userEntered, width: (basis.userEntered / basisTotal) * 100, tone: 'user' },
    { label: 'AI-seeded', value: basis.aiSuggested, width: (basis.aiSuggested / basisTotal) * 100, tone: 'ai' },
    { label: 'Inherited context', value: basis.inheritedContext, width: (basis.inheritedContext / basisTotal) * 100, tone: 'context' }
  ];
  return `<section class="results-section-stack">
    <div class="results-section-heading">What the technical review should challenge first</div>
    <div class="results-technical-story-grid">
      <div class="results-tech-story-card results-tech-story-card--hero">
        <div class="results-driver-label">Severity versus tolerance</div>
        <strong>${fmtCurrency(severeLoss)}</strong>
        <p>${escapeHtml(String(thresholdModel?.single?.summary || 'Compare the severe event loss against the warning and tolerance thresholds first.'))}</p>
        <div class="results-threshold-story">
          <div class="results-threshold-story__track">
            <span class="results-threshold-story__marker results-threshold-story__marker--warning" style="left:${warningPct}%"></span>
            <span class="results-threshold-story__marker results-threshold-story__marker--limit" style="left:${thresholdPct}%"></span>
            <span class="results-threshold-story__fill" style="width:${severePct}%"></span>
          </div>
          <div class="results-threshold-story__labels">
            <span>Warning ${fmtCurrency(warningThreshold)}</span>
            <span>Tolerance ${fmtCurrency(threshold)}</span>
          </div>
        </div>
      </div>
      <div class="results-tech-story-card">
        <div class="results-driver-label">Confidence posture</div>
        <strong>${escapeHtml(String(confidenceFrame?.label || 'Moderate confidence'))}</strong>
        <p>${escapeHtml(String(confidenceFrame?.implication || 'Use the drivers and assumptions below to pressure-test whether this result is strong enough for action.'))}</p>
        <div class="results-confidence-chip-row">
          <span class="badge badge--neutral">${escapeHtml(String(confidenceFrame?.basis || 'Evidence and input quality'))}</span>
        </div>
      </div>
      <div class="results-tech-story-card">
        <div class="results-driver-label">Input origin mix</div>
        <strong>${basis.userEntered + basis.aiSuggested + basis.inheritedContext} traced inputs</strong>
        <p>Use this to see how much of the result is being carried by user judgement, AI seeding, and inherited context.</p>
        <div class="results-origin-story">
          ${basisParts.map(part => `<div class="results-origin-story__row">
            <span>${part.label}</span>
            <div class="results-origin-story__bar"><i class="results-origin-story__fill results-origin-story__fill--${part.tone}" style="width:${part.width}%"></i></div>
            <strong>${part.value}</strong>
          </div>`).join('')}
        </div>
      </div>
    </div>
    ${sensitivity.length ? `<div class="results-tech-driver-story">
      <div class="results-driver-label">Main drivers</div>
      <div class="results-tech-driver-story__grid">
        ${sensitivity.map((driver, index) => `<div class="results-tech-driver-story__item">
          <span class="results-tech-driver-story__rank">0${index + 1}</span>
          <div>
            <strong>${escapeHtml(String(driver.label || 'Driver'))}</strong>
            <p>${escapeHtml(String(driver.why || 'Review whether this driver is justified by evidence and current context.'))}</p>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}
  </section>`;
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
  setPage(`
    <main class="page">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(4)}
          <h2 class="wizard-step-title">Review &amp; Run Simulation</h2>
          <p class="wizard-step-desc">Check the summary, confirm the main assumptions look credible, then run the simulation with confidence. Open deeper detail only if something needs challenge before the run.</p>
        </div>
        <div class="wizard-body">
          ${renderPreRunReviewRail(draft, validation, selectedRisks, safeIterations)}
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

// ─── RESULTS ──────────────────────────────────────────────────
function renderMissingResultsState(id) {
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
  document.getElementById('btn-results-missing-template')?.addEventListener('click', () => {
    const templateId = typeof pickScenarioTemplateForContext === 'function'
      ? pickScenarioTemplateForContext({ functionKey: 'general' })?.id
      : ScenarioTemplates?.[0]?.id;
    loadScenarioTemplateById(templateId);
  });
  document.getElementById('btn-results-missing-sample')?.addEventListener('click', () => launchPilotSampleAssessment());
}

function renderResultsFailureState(id, isShared, error) {
  if (error) console.error('renderResultsFailureState:', error);
  setPage(`
    <main class="page">
      <div class="container container--narrow" style="padding:var(--sp-12) var(--sp-6)">
        <div class="card">
          <h2 style="margin-bottom:var(--sp-3)">This result could not be opened cleanly</h2>
          <p style="color:var(--text-muted);margin-bottom:var(--sp-5)">The saved assessment data is missing something the results page expected. The assessment is still stored, but this view needed a safer fallback.</p>
          <div class="flex items-center gap-3" style="flex-wrap:wrap">
            <a href="#/dashboard" class="btn btn--primary">Go to dashboard</a>
            <button class="btn btn--secondary" id="btn-results-retry" type="button">Try again</button>
          </div>
        </div>
      </div>
    </main>`);
  document.getElementById('btn-results-retry')?.addEventListener('click', () => renderResults(id, isShared));
}

function hydrateResultsRuntimeState(assessment) {
  const rawResults = assessment.results || {};
  // Reopened/imported results should become the canonical runtime source so all result helpers read the same assessment.
  AppState.simulation = {
    ...(AppState.simulation || {}),
    assessment,
    results: rawResults
  };
  return rawResults;
}

function applyResultsToleranceClass(assessment) {
  const pageRoot = document.querySelector('.page');
  if (!pageRoot) return;
  pageRoot.classList.remove(
    'results-page--above-tolerance',
    'results-page--near-tolerance',
    'results-page--within-tolerance'
  );
  const activeResults = assessment.results || AppState.simulation?.results || {};
  if (activeResults.toleranceBreached) {
    pageRoot.classList.add('results-page--above-tolerance');
  } else if (activeResults.nearTolerance) {
    pageRoot.classList.add('results-page--near-tolerance');
  } else {
    pageRoot.classList.add('results-page--within-tolerance');
  }
}

function drawResultsTechnicalCharts(r) {
  requestAnimationFrame(() => {
    const hc = document.getElementById('chart-hist');
    const lc = document.getElementById('chart-lec');
    if (hc) UI.drawHistogram(hc, r.histogram, r.threshold, AppState.currency, AppState.fxRate);
    if (lc) UI.drawLEC(lc, r.lec, r.threshold, AppState.currency, AppState.fxRate);
    attachCitationHandlers();
  });
}

function withResultsActionBusy(button, busyLabel, resetDelayMs, callback) {
  if (!button || typeof callback !== 'function') return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    callback();
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
    }, resetDelayMs);
  }
}

function bindResultsTabBar({ activeTab, activateResultsTab }) {
  document.querySelectorAll('[data-results-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activateResultsTab(btn.dataset.resultsTab, { focusTarget: 'tab' });
    });
    btn.addEventListener('keydown', event => {
      const tabs = Array.from(document.querySelectorAll('[data-results-tab]'));
      const currentIndex = tabs.indexOf(btn);
      if (currentIndex < 0) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextIndex = event.key === 'ArrowRight'
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        if (!nextTab) return;
        activateResultsTab(nextTab.dataset.resultsTab, { focusTarget: 'tab' });
        window.requestAnimationFrame(() => {
          document.querySelector(`[data-results-tab="${nextTab.dataset.resultsTab}"]`)?.focus();
        });
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const nextTab = event.key === 'Home' ? tabs[0] : tabs[tabs.length - 1];
        if (!nextTab) return;
        activateResultsTab(nextTab.dataset.resultsTab, { focusTarget: 'tab' });
        window.requestAnimationFrame(() => {
          document.querySelector(`[data-results-tab="${nextTab.dataset.resultsTab}"]`)?.focus();
        });
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (AppState.resultsTab === btn.dataset.resultsTab) {
          document.querySelector(`[data-results-panel="${btn.dataset.resultsTab}"]`)?.focus();
          return;
        }
        activateResultsTab(btn.dataset.resultsTab, { focusTarget: 'panel' });
      }
    });
  });

  if (AppState.resultsShouldScrollTop || AppState.resultsFocusTarget) {
    const focusTarget = AppState.resultsFocusTarget || 'tab';
    AppState.resultsShouldScrollTop = false;
    AppState.resultsFocusTarget = null;
    window.requestAnimationFrame(() => {
      document.querySelector('.results-tabbar')?.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (focusTarget === 'panel') {
        document.querySelector(`[data-results-panel="${activeTab}"]`)?.focus();
      } else {
        document.querySelector(`[data-results-tab="${activeTab}"]`)?.focus();
      }
    });
  }
}

function bindResultsInteractions({
  id,
  isShared,
  assessment,
  activeTab,
  r,
  assessmentIntelligence,
  missingInformation
}) {
  const activateResultsTab = (tabName, { focusTarget = 'tab' } = {}) => {
    const nextTab = String(tabName || '').trim();
    if (!nextTab || AppState.resultsTab === nextTab) {
      AppState.resultsFocusTarget = focusTarget;
      return;
    }
    AppState.resultsShouldScrollTop = true;
    AppState.resultsFocusTarget = focusTarget;
    AppState.resultsTab = nextTab;
    renderResults(id, isShared || assessment._shared);
    if (nextTab === 'executive') {
      window.requestAnimationFrame(() => {
        const lc = document.getElementById('chart-lec');
        if (lc) UI.drawLEC(lc, r.lec, r.threshold, AppState.currency, AppState.fxRate);
      });
    }
  };

  bindResultsTabBar({ activeTab, activateResultsTab });
  if (activeTab === 'appendix' || activeTab === 'executive') drawResultsTechnicalCharts(r);
  else attachCitationHandlers();

  document.getElementById('btn-share-results')?.addEventListener('click', event => {
    withResultsActionBusy(event.currentTarget, 'Copying…', 600, () => {
      ShareService.copyShareLink(assessment);
    });
  });
  document.getElementById('btn-export-json')?.addEventListener('click', event => {
    withResultsActionBusy(event.currentTarget, 'Exporting…', 600, () => {
      ExportService.exportJSON(assessment);
      UI.toast('JSON exported.', 'success');
    });
  });
  document.getElementById('results-compare-select')?.addEventListener('change', (event) => {
    AppState.resultsComparisonId = event.target.value || '';
    renderResults(id, isShared || assessment._shared);
  });
  document.getElementById('btn-export-pdf')?.addEventListener('click', event => {
    withResultsActionBusy(event.currentTarget, 'Preparing PDF…', 800, () => {
      ExportService.exportPDF(assessment, AppState.currency, AppState.fxRate);
      UI.toast('PDF report prepared for print or PDF save. Regenerate it after material scenario or treatment changes.', 'success');
    });
  });
  document.getElementById('btn-download-pdf')?.addEventListener('click', event => {
    withResultsActionBusy(event.currentTarget, 'Building PDF…', 800, () => {
      try {
        const doc = ExportService.generatePdfReport(assessment);
        doc.save(`${assessment.id || 'assessment'}-report.pdf`);
        UI.toast('PDF downloaded.', 'success');
      } catch (error) {
        console.error('PDF download failed:', error);
        UI.toast('The PDF could not be generated. Try again.', 'danger');
      }
    });
  });
  document.getElementById('btn-toggle-boardroom-mode')?.addEventListener('click', () => {
    AppState.resultsBoardroomMode = !AppState.resultsBoardroomMode;
    AppState.resultsTab = 'executive';
    AppState.resultsShouldScrollTop = true;
    AppState.resultsFocusTarget = 'panel';
    UI.toast(AppState.resultsBoardroomMode ? 'Executive mode enabled.' : 'Full executive review restored.', 'info');
    renderResults(id, isShared || assessment._shared);
  });
  document.getElementById('btn-export-board-note')?.addEventListener('click', event => {
    withResultsActionBusy(event.currentTarget, 'Preparing…', 800, () => {
      try {
        ExportService.exportBoardNote(assessment, AppState.currency, AppState.fxRate);
        UI.toast('Board note prepared for print or PDF save. Regenerate it after material changes to keep the snapshot current.', 'success');
      } catch (error) {
        console.error('Board note export failed:', error);
        UI.toast('The board note could not be prepared. Try again.', 'danger');
      }
    });
  });
  document.getElementById('btn-export-board-note-appendix')?.addEventListener('click', event => {
    withResultsActionBusy(event.currentTarget, 'Preparing…', 800, () => {
      try {
        ExportService.exportDecisionMemo(assessment, AppState.currency, AppState.fxRate, { includeAppendix: true });
        UI.toast('Decision memo with appendix prepared for print or PDF save. Regenerate it after material changes to keep the snapshot current.', 'success');
      } catch (error) {
        console.error('Decision memo + appendix export failed:', error);
        UI.toast('The decision memo with appendix could not be prepared. Try again.', 'danger');
      }
    });
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
      const next = updateAssessmentRecord(assessment.id, current => ({
        ...current,
        assessmentChallenge: {
          ...result,
          createdAt: Date.now(),
          confidenceLabel: assessment.confidenceLabel || '',
          evidenceQuality: assessment.evidenceQuality || ''
        }
      }));
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
    withResultsActionBusy(event.currentTarget, 'Exporting…', 600, () => {
      ExportService.exportPPTXSpec(assessment, AppState.currency, AppState.fxRate);
      UI.toast('PPTX spec exported as JSON. See README.', 'info', 5000);
    });
  });
  document.getElementById('btn-create-treatment-case')?.addEventListener('click', event => {
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
  document.getElementById('btn-new-assess')?.addEventListener('click', () => { resetDraft(); Router.navigate('/wizard/1'); });
  document.getElementById('btn-new-assess-top')?.addEventListener('click', () => { resetDraft(); Router.navigate('/wizard/1'); });
}

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
    renderMissingResultsState(id);
    return;
  }

  try {
  const sharedBanner = (isShared || assessment._shared) ? `
    <div class="banner banner--info mb-6" style="font-size:.82rem">
      <span class="banner-icon">🔗</span>
      <span class="banner-text"><strong>Shared view.</strong> This assessment was shared with you. <a href="#/" style="color:var(--color-accent-300)">Start your own →</a></span>
    </div>` : '';

  const {
    r,
    activeTab,
    boardroomMode,
    statusClass,
    statusIcon,
    statusTitle,
    statusDetail,
    executiveHeadline,
    executiveAction,
    executiveAnnualView,
    exceedancePct,
    completedLabel,
    lifecycle,
    scenarioNarrative,
    technicalInputs,
    runMetadata,
    workflowGuidance,
    recommendations,
    citations,
    primaryGrounding,
    supportingReferences,
    inferredAssumptions,
    missingInformation,
    assessmentIntelligence,
    evidenceGapPlan,
    assessmentChallenge,
    executiveDecision,
    confidenceFrame,
    thresholdModel,
    impactMix,
    comparisonOptions,
    activeComparisonId,
    baselineAssessment,
    comparison,
    nextStepPlan,
    recommendationCards,
    confidenceNeedsBlock,
    comparisonHighlight,
    treatmentRecommendationLens,
    explanationPanel,
    analystSummary,
    assessmentValue,
    rolePresentation
  } = window.ResultsViewModel.buildResultsRenderModel(assessment, { isShared });

  const executiveHero = `<div class="results-hero ${statusClass}">
    <div class="results-hero-main">
      <div class="results-kicker">${boardroomMode ? 'Executive mode' : 'Assessment outcome'}</div>
      <h2 class="results-hero-title">${executiveHeadline}</h2>
      <p class="results-hero-copy">${statusDetail}</p>
      <div class="results-hero-tags">
        <span class="badge ${r.toleranceBreached ? 'badge--danger' : r.nearTolerance ? 'badge--warning' : 'badge--success'}">${statusTitle}</span>
        <span class="badge badge--${lifecycle.tone}">${lifecycle.label}</span>
        ${boardroomMode ? '<span class="badge badge--neutral">Executive mode</span>' : ''}
      </div>
      <div class="results-hero-meta">${escapeHtml(String(assessment.buName || 'No business unit'))} · ${escapeHtml(String(assessment.geography || 'No geography'))} · ${escapeHtml(String(completedLabel))}</div>
    </div>
    <div class="results-hero-side">
      <div class="results-signal-ring ${statusClass}">
        <div class="results-signal-ring-inner">${statusIcon}</div>
      </div>
      <div class="results-signal-label">${exceedancePct}% breach likelihood</div>
      <div class="results-hero-action-card">
        <span class="results-driver-label">Immediate focus</span>
        <strong>${escapeHtml(String(executiveDecision?.decision || 'Review'))}</strong>
        <span>${escapeHtml(String(executiveAction || executiveDecision?.priority || 'Confirm the next management step for this scenario.'))}</span>
        <div class="results-hero-action-card__foot">${escapeHtml(String(rolePresentation.executiveNoteTitle))}: ${escapeHtml(String(rolePresentation.executiveNote))}</div>
      </div>
    </div>
  </div>`;

  const executiveMetrics = `<div class="results-exec-metrics">
    <div class="results-impact-card results-impact-card--headline">
      <div class="results-impact-label">Conditional loss from one successful event</div>
      <div class="results-impact-value ${r.toleranceBreached ? 'danger' : ''}">${fmtCurrency(r.eventLoss.p90)}</div>
      <div class="results-impact-copy">Severe single-event view</div>
      <div class="results-impact-foot">${r.toleranceBreached ? 'Above the current event tolerance.' : r.nearTolerance ? 'Above the warning threshold, but below tolerance.' : 'Below the current warning trigger.'}</div>
    </div>
    <div class="results-impact-card">
      <div class="results-impact-label">Expected annualized loss</div>
      <div class="results-impact-value">${fmtCurrency(r.annualLoss.mean)}</div>
      <div class="results-impact-copy">Expected annual exposure</div>
      <div class="results-impact-foot">Use this as the average-year planning view.</div>
    </div>
    <div class="results-impact-card">
      <div class="results-impact-label">High-stress annualized loss</div>
      <div class="results-impact-value warning">${fmtCurrency(r.annualLoss.p90)}</div>
      <div class="results-impact-copy">Severe annual planning view</div>
      <div class="results-impact-foot">${r.annualReviewTriggered ? 'At or above the annual review trigger.' : 'Still below the annual review trigger.'}</div>
    </div>
  </div>`;

  const executiveTab = `
    <section class="results-executive-view ${boardroomMode ? 'results-executive-view--boardroom' : ''} ${activeTab === 'executive' ? '' : 'hidden'}" id="results-tab-executive" role="tabpanel" aria-labelledby="results-tab-btn-executive" tabindex="-1" data-results-panel="executive" data-page-focus>
      ${executiveHero}
      <div class="results-executive-band">
        ${boardroomMode ? renderBoardroomModeIntro(comparison) : ''}
        ${renderHeroMetric(
          r,
          confidenceFrame,
          AppState.draft?.geography || assessment?.geography || ''
        )}
        ${renderDecisionRail(statusTitle, statusDetail, executiveDecision, executiveAction, assessmentIntelligence.confidence, rolePresentation)}
        ${boardroomMode ? renderExecutiveBrief(statusTitle, executiveDecision, executiveAction, executiveAnnualView) : ''}
        ${executiveMetrics}
        ${renderAssessmentValueBand(assessmentValue)}
        ${renderExecutiveBenchmarkContext(assessment, r, runMetadata)}
      </div>
      ${boardroomMode
        ? `${renderBoardroomSummaryBand({ executiveDecision, confidenceFrame, nextStepPlan, scenarioNarrative, analystSummary })}
           ${treatmentRecommendationLens}
           ${comparisonHighlight || recommendationCards}
           ${renderAnalystSummaryBlock(analystSummary)}
           <section class="results-secondary-band results-secondary-band--boardroom">
             ${comparisonHighlight ? recommendationCards : ''}
             ${confidenceNeedsBlock}
           </section>`
        : `${renderAnalystSummaryBlock(analystSummary)}
           ${treatmentRecommendationLens}
           ${comparisonHighlight || recommendationCards}
           <section class="results-secondary-band">
             ${comparisonHighlight ? recommendationCards : ''}
             ${renderTrustExplanationLayer({
               confidenceNeedsBlock,
               evidenceGapPlan,
               explanationPanel,
               impactMix,
               thresholdModel,
               results: r,
               assessmentIntelligence,
               assessment,
               citations,
               primaryGrounding,
               supportingReferences,
               missingInformation
             })}
           </section>`}
    </section>`;

  const technicalTab = window.ResultsTabs.renderTechnicalTab({
    activeTab,
    rolePresentation,
    runMetadata,
    confidenceFrame,
    r,
    assessmentIntelligence,
    assessment,
    thresholdModel,
    technicalInputs,
    comparison,
    evidenceGapPlan,
    missingInformation,
    primaryGrounding,
    supportingReferences,
    inferredAssumptions
  });

  const appendixTab = window.ResultsTabs.renderAppendixTab({
    activeTab,
    assessment,
    runMetadata,
    confidenceFrame,
    thresholdModel,
    technicalInputs,
    r,
    assessmentChallenge,
    workflowGuidance,
    citations,
    recommendations
  });

  setPage(`
    <main class="page">
      <div class="container container--wide" style="padding:var(--sp-8) var(--sp-6)">
        ${sharedBanner}
        <div class="flex items-center justify-between mb-6 anim-fade-in results-header-bar" style="gap:var(--sp-4);flex-wrap:wrap">
          <div>
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:4px">Assessment Results</div>
            <h1 style="font-size:var(--text-3xl)">${assessment.scenarioTitle || 'Risk Assessment'}</h1>
            <div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:4px">${assessment.buName || '—'} · ${assessment.geography || '—'} · ${completedLabel}</div>
          </div>
          <div class="flex items-center gap-3 results-header-actions" style="flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" id="btn-export-pdf">↓ PDF Report</button>
            <button class="btn btn--secondary btn--sm" id="btn-download-pdf">Download PDF</button>
            <button class="btn btn--secondary btn--sm" id="btn-create-treatment-case">Compare a Better Outcome</button>
            <details class="results-actions-disclosure">
              <summary class="btn btn--ghost btn--sm">More actions</summary>
              <div class="results-actions-disclosure-menu">
                <button class="btn btn--secondary btn--sm" id="btn-toggle-boardroom-mode">${boardroomMode ? 'Exit Executive Mode' : 'Open Executive Mode'}</button>
                <button class="btn btn--secondary btn--sm" id="btn-export-board-note">Generate Decision Memo</button>
                <button class="btn btn--secondary btn--sm" id="btn-export-board-note-appendix">Decision Memo + Appendix</button>
                <button class="btn btn--secondary btn--sm" id="btn-duplicate-assessment">Duplicate Assessment</button>
                <button class="btn btn--secondary btn--sm" id="btn-share-results">Share</button>
                <button class="btn btn--secondary btn--sm" id="btn-export-json">↓ JSON</button>
                <button class="btn btn--secondary btn--sm" id="btn-export-pptx">↓ PPTX Spec</button>
                <button class="btn btn--secondary btn--sm" id="btn-new-assess-top">New Assessment</button>
              </div>
            </details>
          </div>
        </div>
        <div class="form-help results-export-note anim-fade-in">Exports are point-in-time snapshots. Regenerate them after material scenario, evidence, or treatment changes.</div>

        <div class="results-tabbar mb-6" role="tablist" aria-label="Results views">
          <button class="results-tab ${activeTab === 'executive' ? 'active' : ''}" id="results-tab-btn-executive" role="tab" aria-selected="${activeTab === 'executive' ? 'true' : 'false'}" aria-controls="results-tab-executive" tabindex="${activeTab === 'executive' ? '0' : '-1'}" data-results-tab="executive">Executive Summary</button>
          <button class="results-tab ${activeTab === 'technical' ? 'active' : ''}" id="results-tab-btn-technical" role="tab" aria-selected="${activeTab === 'technical' ? 'true' : 'false'}" aria-controls="results-tab-technical" tabindex="${activeTab === 'technical' ? '0' : '-1'}" data-results-tab="technical">Technical Detail</button>
          <button class="results-tab ${activeTab === 'appendix' ? 'active' : ''}" id="results-tab-btn-appendix" role="tab" aria-selected="${activeTab === 'appendix' ? 'true' : 'false'}" aria-controls="results-tab-appendix" tabindex="${activeTab === 'appendix' ? '0' : '-1'}" data-results-tab="appendix">Appendix & Evidence</button>
        </div>

        <div class="${activeTab === 'executive' ? '' : 'hidden'}" id="results-tab-executive-wrap" role="presentation">${executiveTab}</div>
        ${technicalTab}
        ${appendixTab}

        <div class="flex items-center gap-4 mt-8 pt-6" style="border-top:1px solid var(--border-subtle)">
          <a href="#/dashboard" class="btn btn--ghost">← Dashboard</a>
          <button class="btn btn--secondary" id="btn-new-assess">New Assessment</button>
          <div class="bar-spacer"></div>
          <span style="font-size:.72rem;color:var(--text-muted)">ID: ${assessment.id} · ${r.iterations.toLocaleString()} iterations</span>
        </div>
      </div>
    </main>`);

  applyResultsToleranceClass(assessment);
  bindResultsInteractions({
    id,
    isShared,
    assessment,
    activeTab,
    r,
    assessmentIntelligence,
    missingInformation
  });
  } catch (error) {
    console.error('renderResults failed:', error);
    renderResultsFailureState(id, isShared, error);
  }
}

// ─── AUTH & SETTINGS ──────────────────────────────────────────
const ADMIN_SECTION_STORAGE_KEY = 'rq_admin_active_section';

function getPreferredAdminSection() {
  try {
    const value = String(localStorage.getItem(ADMIN_SECTION_STORAGE_KEY) || '').trim();
    return ['org', 'company', 'defaults', 'governance', 'access', 'users', 'audit'].includes(value) ? value : 'org';
  } catch {
    return 'org';
  }
}

function setPreferredAdminSection(section) {
  const value = ['org', 'company', 'defaults', 'governance', 'access', 'users', 'audit'].includes(section) ? section : 'org';
  try {
    localStorage.setItem(ADMIN_SECTION_STORAGE_KEY, value);
  } catch {}
  return value;
}

function getDefaultRouteForCurrentUser() {
  const user = AuthService.getCurrentUser();
  // Global admins need a proper front door that separates assessment work from console administration.
  return user?.role === 'admin' ? '/admin/home' : '/dashboard';
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
