(function(global) {
  'use strict';

  function renderTechnicalTab(model) {
    const {
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
    } = model;
    const openChallengeRecords = typeof getOpenParameterChallengeRecords === 'function'
      ? getOpenParameterChallengeRecords(assessment)
      : [];
    return `
      <section class="results-technical-view ${activeTab === 'technical' ? '' : 'hidden'}" id="results-tab-technical" role="tabpanel" aria-labelledby="results-tab-btn-technical" tabindex="-1" data-results-panel="technical" data-page-focus>
        ${renderTechnicalOrientationBlock(rolePresentation, runMetadata, confidenceFrame)}
        ${renderTechnicalReviewSurface(r, assessmentIntelligence, confidenceFrame, assessment, thresholdModel)}
        ${renderTechnicalStoryBand(r, assessmentIntelligence, confidenceFrame, thresholdModel, assessment)}
        ${renderChallengeSynthesisCard(assessment)}

        <section class="results-section-stack results-layer-band results-layer-band--editorial">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap">
            <div class="results-section-heading" style="margin:0">Review-ready metrics and sensitivities</div>
            ${openChallengeRecords.length ? '<button type="button" class="btn btn--secondary btn--sm" data-consensus-path-run>Find Consensus</button>' : ''}
          </div>
          <div class="results-detail-disclosure-copy">Start here when you want to challenge the size of the result, the dominant sensitivities, and whether the ranges are credible enough for management use.</div>
          <div class="results-disclosure-stack">
            ${renderParameterChallengeActionStrip(assessment, technicalInputs, assessmentIntelligence)}
            <div id="results-technical-challenge-panel">
              ${renderTechnicalChallengePanel(assessment, technicalInputs, assessmentIntelligence, confidenceFrame, comparison)}
            </div>
            ${renderAssumptionSensitivitySection()}
            ${typeof renderConsensusPathPanel === 'function' ? renderConsensusPathPanel(assessment) : ''}
            ${renderParameterChallengeRecordSection(assessment)}
            <div class="grid-3 mb-6 anim-fade-in results-metric-band">
              <div class="metric-card"><div class="metric-label">Typical conditional event loss</div><div class="metric-value">${fmtCurrency(r.eventLoss.p50)}</div><div class="metric-sub">Midpoint successful-event view</div></div>
              <div class="metric-card"><div class="metric-label">Severe conditional event loss</div><div class="metric-value ${r.toleranceBreached ? 'danger' : ''}">${fmtCurrency(r.eventLoss.p90)}</div><div class="metric-sub">Used for tolerance check</div></div>
              <div class="metric-card"><div class="metric-label">Expected conditional event loss</div><div class="metric-value">${fmtCurrency(r.eventLoss.mean)}</div><div class="metric-sub">Average successful-event loss</div></div>
            </div>
            <div class="grid-3 anim-fade-in anim-delay-1 results-metric-band results-metric-band--secondary">
              <div class="metric-card"><div class="metric-label">Typical annualized loss</div><div class="metric-value">${fmtCurrency(r.annualLoss.p50)}</div><div class="metric-sub">Midpoint annual view</div></div>
              <div class="metric-card"><div class="metric-label">Severe annualized loss</div><div class="metric-value warning">${fmtCurrency(r.annualLoss.p90)}</div><div class="metric-sub">Annual severe-but-plausible view</div></div>
              <div class="metric-card"><div class="metric-label">Expected annualized loss</div><div class="metric-value">${fmtCurrency(r.annualLoss.mean)}</div><div class="metric-sub">Average annual loss</div></div>
            </div>
            <div class="results-decision-grid anim-fade-in">
              ${renderAssessmentConfidenceBlock(assessmentIntelligence.confidence)}
              ${renderAssessmentDriversBlock(assessmentIntelligence.drivers)}
            </div>
            ${renderSensitivitySummary(assessmentIntelligence.drivers)}
          </div>
        </section>

        <section class="results-section-stack results-layer-band">
          <div class="results-section-heading">Assumptions, evidence, and input origins</div>
          <div class="results-detail-disclosure-copy">Use this layer to review what the result depends on, how grounded the evidence is, and where the main inputs came from.</div>
          <div class="results-disclosure-stack">
            ${evidenceGapPlan.length ? renderEvidenceGapActionPlan(evidenceGapPlan, {
              title: 'Challenge checklist for evidence gaps',
              subtitle: 'Use this when you want the clearest gaps, who should close them, and which part of the estimate they affect.',
              compact: false,
              lowEmphasis: false
            }) : ''}
            ${renderAssessmentAssumptionsBlock(assessmentIntelligence.assumptions)}
            ${renderEvidenceQualityBlock(assessment.confidenceLabel, assessment.evidenceQuality, assessment.evidenceSummary, missingInformation, 'Evidence posture and missing information', { primaryGrounding, supportingReferences, inferredAssumptions })}
            ${renderInputSourceAuditBlock(buildLiveInputSourceAssignments(assessment))}
          </div>
        </section>
      </section>`;
  }

  function renderAppendixTab(model) {
    const {
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
    } = model;
    return `
      <section class="results-appendix-view ${activeTab === 'appendix' ? '' : 'hidden'}" id="results-tab-appendix" role="tabpanel" aria-labelledby="results-tab-btn-appendix" tabindex="-1" data-results-panel="appendix" data-page-focus>
        <section class="results-section-stack">
          <div class="results-section-heading">Appendix and evidence</div>
          <div class="results-appendix-intro">
            <div>
              <div class="results-driver-label">Reproducibility and evidence layer</div>
              <h3 class="results-appendix-intro__title">Use this tab for methodology, AI audit, supporting references, and the saved run detail behind the headline result.</h3>
            </div>
            <div class="results-comparison-foot">Keep this layer for committee challenge, technical validation, and evidence review rather than first-pass management reading.</div>
          </div>
        </section>

        ${renderModelBasisPanel(assessment, runMetadata, confidenceFrame, thresholdModel)}

        <details class="results-detail-disclosure">
          <summary>Methodology, settings, and saved run metadata</summary>
          <div class="results-detail-disclosure-copy">Open this when you need distributions, thresholds, assumptions, simulation settings, and reproducibility detail.</div>
          <div class="results-disclosure-stack">
            ${renderSimulationEquationFlow()}
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
            ${hasStructuredScenario(assessment.structuredScenario) ? `
            <div class="card anim-fade-in">
              <h3 style="font-size:var(--text-base);margin-bottom:var(--sp-4)">Scenario details</h3>
              ${(() => {
                const structured = normaliseStructuredScenario(assessment.structuredScenario, { preserveUnknown: true }) || {};
                return `<div class="grid-2">
                ${Object.entries({
                  'Asset / Service': structured.assetService,
                  'Primary driver': structured.primaryDriver,
                  'Event path': structured.eventPath,
                  'Effect': structured.effect
                }).map(([k, v]) => `<div style="background:var(--bg-elevated);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-lg)"><div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${k}</div><div style="font-size:.85rem;color:var(--text-secondary);margin-top:4px">${v || '—'}</div></div>`).join('')}
              </div>`;
              })()}
            </div>` : ''}
          </div>
        </details>

        <details class="results-detail-disclosure">
          <summary>Challenge review and AI audit</summary>
          <div class="results-detail-disclosure-copy">Open this when you want to pressure-test assumptions, review committee-style challenge points, or inspect how AI and supporting material shaped the inputs.</div>
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
            ${renderParameterChallengeAuditTrail(assessment)}
            ${(workflowGuidance.length || assessment.benchmarkBasis || assessment.inputRationale || assessment.evidenceSummary || assessment.confidenceLabel || assessment.inputProvenance?.length) ? `
            <div class="grid-2 anim-fade-in">
              ${renderWorkflowGuidanceBlock(workflowGuidance, 'How AI guided this assessment')}
              ${renderBenchmarkRationaleBlock(assessment.benchmarkBasis, assessment.inputRationale, assessment.benchmarkReferences)}
              ${renderInputProvenanceBlock(assessment.inputProvenance)}
            </div>` : ''}
            ${typeof renderAssessmentObligationBasisBlock === 'function' ? renderAssessmentObligationBasisBlock(assessment, {
              compact: false,
              title: 'Resolved obligation basis and flow-down detail'
            }) : ''}
          </div>
        </details>

        ${renderAssessmentVersionHistorySection(assessment)}

        <details class="results-detail-disclosure">
          <summary>Charts, references, and full treatment set</summary>
          <div class="results-detail-disclosure-copy">Use this for deeper validation, supporting references, and the full recommendation set behind the executive summary.</div>
          <div class="results-disclosure-stack">
            <div class="grid-2 anim-fade-in anim-delay-2">
              <div class="chart-wrap">
                <div class="chart-title">ALE Distribution</div>
                <div class="chart-subtitle">Annual Loss Exposure · ${r.iterations.toLocaleString()} iterations · ${AppState.currency}</div>
                <canvas id="chart-hist"></canvas>
              </div>
            </div>
            ${citations.length ? renderCitationBlock(citations) : ''}
            ${recommendations.length ? `<div style="display:flex;flex-direction:column;gap:var(--sp-4)">
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
            </div>` : ''}
          </div>
        </details>
      </section>`;
  }

  global.ResultsTabs = {
    renderTechnicalTab,
    renderAppendixTab
  };
})(window);
