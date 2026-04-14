/**
 * exportService.js — Export service
 * 
 * Implements:
 *  - JSON export (always works)
 *  - Print-ready HTML report (browser Print → Save as PDF)
 *  - PPTX slide spec as JSON (replace with pptxgenjs for real PPTX)
 * 
 * [EXPORT-INTEGRATION] marks where to integrate real libraries:
 *  - jsPDF for PDF:     https://raw.githack.com/MrRio/jsPDF/master/docs/
 *  - pptxgenjs for PPTX: https://gitbrent.github.io/PptxGenJS/
 */

const ExportService = (() => {
  function _getCurrencyPrefix(currency) {
    return currency === 'AED' ? 'AED ' : '$';
  }

  function _formatCurrency(value, currency, fxRate) {
    const displayValue = Math.round(currency === 'AED' ? Number(value || 0) * fxRate : Number(value || 0));
    return `${_getCurrencyPrefix(currency)}${displayValue.toLocaleString(currency === 'AED' ? 'en-AE' : 'en-US')}`;
  }

  function _cleanExecutiveNarrativeText(value) {
    return ReportPresentation.cleanExecutiveNarrativeText(value);
  }

  function _buildExecutiveScenarioSummary(assessment) {
    return ReportPresentation.buildExecutiveScenarioSummary(assessment);
  }

  function _resolveAssessmentDisplayTitle(assessment) {
    return String(
      (typeof resolveScenarioDisplayTitle === 'function'
        ? resolveScenarioDisplayTitle({
            ...assessment,
            narrative: String(assessment?.narrative || assessment?.draft?.narrative || '').trim(),
            enhancedNarrative: String(assessment?.enhancedNarrative || assessment?.draft?.enhancedNarrative || assessment?.narrative || '').trim()
          })
        : '')
      || assessment?.title
      || assessment?.scenarioTitle
      || assessment?.draft?.title
      || assessment?.draft?.scenario?.title
      || 'Risk Assessment'
    ).trim();
  }



  function _clampNumber(value, min = 0, max = 100) {
    return ReportPresentation.clampNumber(value, min, max);
  }

  function _buildExecutiveThresholdModel(results, fmt) {
    return ReportPresentation.buildExecutiveThresholdModel(results, fmt);
  }

  function _buildExecutiveImpactMix(inputs = {}) {
    return ReportPresentation.buildExecutiveImpactMix(inputs);
  }

  function _buildExecutiveDecisionSupport(assessment, results, intelligence) {
    return ReportPresentation.buildExecutiveDecisionSupport(assessment, results, intelligence);
  }

  function _buildExecutiveConfidenceFrame(confidence, evidenceQuality, missingInformation = [], citations = []) {
    return ReportPresentation.buildExecutiveConfidenceFrame(confidence, evidenceQuality, missingInformation, citations);
  }

  function _buildExecutiveAiQualitySignal(assessment = {}) {
    const confidence = String(assessment?.confidenceLabel || assessment?.assessmentIntelligence?.confidence?.label || '').trim();
    const evidenceQuality = String(assessment?.evidenceQuality || assessment?.assessmentIntelligence?.confidence?.evidenceQuality || '').trim();
    const citationCount = Array.isArray(assessment?.citations) ? assessment.citations.filter(Boolean).length : 0;
    const groundingCount = (Array.isArray(assessment?.primaryGrounding) ? assessment.primaryGrounding.filter(Boolean).length : 0)
      + (Array.isArray(assessment?.supportingReferences) ? assessment.supportingReferences.filter(Boolean).length : 0);
    const state = String(assessment?.aiQualityState || '').trim().toLowerCase();
    const totalSupport = citationCount + groundingCount;
    if (state === 'analyst-reshaped') {
      return {
        label: 'Materially analyst-reshaped',
        summary: 'The current scenario was materially reshaped after the AI starting point, so treat the output as analyst-led with AI support in the background.'
      };
    }
    if (state === 'fallback' || /fallback|no live model/i.test(`${confidence} ${evidenceQuality}`)) {
      return {
        label: 'Fallback-generated',
        summary: 'Fallback guidance was used instead of a clean live AI result. Leadership should rely more heavily on the evidence and challenge layers.'
      };
    }
    if (assessment?.llmAssisted && !/thin|weak|incomplete|low/i.test(`${confidence} ${evidenceQuality}`) && totalSupport >= 2) {
      return {
        label: 'Strongly grounded',
        summary: 'The AI-supported scenario is aligned with the current evidence base, benchmark framing, and governance thresholds.'
      };
    }
    if (assessment?.llmAssisted) {
      return {
        label: 'Lightly grounded',
        summary: 'AI supported the scenario, but the result still needs management challenge because the evidence base remains incomplete.'
      };
    }
    return {
      label: 'Analyst-built',
      summary: 'This assessment is primarily analyst-constructed rather than strongly AI-grounded.'
    };
  }

  function _buildTreatmentDecisionSummary(comparison) {
    return ReportPresentation.buildTreatmentDecisionSummary(comparison);
  }

  function _buildLifecycleNextStepPlan(input) {
    return ReportPresentation.buildLifecycleNextStepPlan(input);
  }

  function _buildAnalystAdvisorySummary(input) {
    return ReportPresentation.buildAnalystAdvisorySummary(input);
  }

  function _openPrintableHtml(html, fallbackFilename) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fallbackFilename;
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function _buildDecisionMemoComparison(assessment) {
    if (!assessment?.comparisonBaseline?.results || !assessment?.results) return null;
    const baseline = assessment.comparisonBaseline;
    const current = assessment.results || {};
    const baselineResults = baseline.results || {};
    const severeDirection = Number(current.lm?.p90 || 0) < Number(baselineResults.lm?.p90 || 0)
      ? 'down'
      : Number(current.lm?.p90 || 0) > Number(baselineResults.lm?.p90 || 0)
        ? 'up'
        : 'flat';
    const annualDirection = Number(current.ale?.mean || 0) < Number(baselineResults.ale?.mean || 0)
      ? 'down'
      : Number(current.ale?.mean || 0) > Number(baselineResults.ale?.mean || 0)
        ? 'up'
        : 'flat';
    const severeAnnualDirection = Number(current.ale?.p90 || 0) < Number(baselineResults.ale?.p90 || 0)
      ? 'down'
      : Number(current.ale?.p90 || 0) > Number(baselineResults.ale?.p90 || 0)
        ? 'up'
        : 'flat';
    return {
      baselineTitle: _resolveAssessmentDisplayTitle(baseline) || 'Selected baseline',
      baselineDate: new Date(baseline.completedAt || baseline.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }),
      severeEvent: { direction: severeDirection },
      annualExposure: { direction: annualDirection },
      severeAnnual: { direction: severeAnnualDirection },
      treatmentNarrative: assessment.comparisonNarrative || assessment.treatmentImprovementRequest || '',
      keyDriver: assessment.comparisonKeyDriver || 'Review the changed assumptions against the saved baseline.',
      secondaryDriver: assessment.comparisonSecondaryDriver || ''
    };
  }

  function buildDecisionMemoModel(assessment, currency = 'USD', fxRate = 3.6725, { includeAppendix = false } = {}) {
    const r = assessment?.results || {};
    const fmt = v => _formatCurrency(v, currency, fxRate);
    const intelligence = assessment.assessmentIntelligence || {};
    const citations = Array.isArray(assessment.citations)
      ? Array.from(new Map(assessment.citations.map(c => [c.docId || c.title || JSON.stringify(c), c])).values())
      : [];
    const technicalInputs = r.inputs || assessment.fairParams || {};
    const confidenceFrame = _buildExecutiveConfidenceFrame(intelligence.confidence, assessment.evidenceQuality, assessment.missingInformation, citations);
    const executiveDecision = _buildExecutiveDecisionSupport(assessment, r, intelligence);
    const thresholdModel = _buildExecutiveThresholdModel(r, fmt);
    const impactMix = _buildExecutiveImpactMix(technicalInputs);
    const comparison = _buildDecisionMemoComparison(assessment);
    const treatmentDecision = comparison ? _buildTreatmentDecisionSummary(comparison) : null;
    const valueModel = typeof ValueQuantService !== 'undefined'
      ? ValueQuantService.buildAssessmentValueModel(assessment, {
          assessments: typeof getAssessments === 'function' ? getAssessments() : [],
          benchmarkSettings: typeof getAdminSettings === 'function' ? getAdminSettings().valueBenchmarkSettings : {}
        })
      : null;
    const lifecycleStatus = typeof deriveAssessmentLifecycleStatus === 'function'
      ? deriveAssessmentLifecycleStatus(assessment)
      : '';
    const lifecycle = typeof getLifecyclePresentation === 'function'
      ? getLifecyclePresentation(lifecycleStatus)
      : { status: lifecycleStatus, label: 'Saved assessment' };
    const nextStepPlan = _buildLifecycleNextStepPlan({
      lifecycle,
      results: r,
      executiveDecision,
      comparison,
      confidenceFrame,
      missingInformation: assessment.missingInformation || []
    });
    const analystSummary = _buildAnalystAdvisorySummary({
      assessment,
      results: r,
      executiveDecision,
      confidenceFrame,
      comparison,
      missingInformation: assessment.missingInformation || [],
      lifecycle
    });
    const posture = r.toleranceBreached
      ? 'Above tolerance'
      : r.nearTolerance
        ? 'Near tolerance'
        : 'Within tolerance';
    const safeMetrics = [
      { label: 'Severe single-event view', value: fmt(r.lm?.p90 || 0), copy: 'P90 per-event management view.' },
      { label: 'Expected annual exposure', value: fmt(r.ale?.mean || 0), copy: 'Most likely annual planning view.' },
      { label: 'Severe annual exposure', value: fmt(r.ale?.p90 || 0), copy: 'High-stress annual planning view.' }
    ];
    return {
      title: _resolveAssessmentDisplayTitle(assessment) || 'Risk assessment',
      businessContext: `${assessment.buName || '—'} · ${assessment.geography || '—'}`,
      completedLabel: new Date(assessment.completedAt || assessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' }),
      posture,
      postureTone: r.toleranceBreached ? 'danger' : r.nearTolerance ? 'warning' : 'success',
      scenarioSummary: _buildExecutiveScenarioSummary(assessment) || 'No scenario narrative available.',
      executiveDecision,
      confidenceFrame,
      thresholdModel,
      impactMix,
      nextStepPlan,
      analystSummary,
      treatmentDecision,
      comparison,
      aiQualitySummary: _buildExecutiveAiQualitySignal(assessment),
      exportSnapshotNote: 'This export is a point-in-time snapshot. Regenerate it after material scenario, evidence, or treatment changes.',
      valueSummary: valueModel ? {
        domainLabel: valueModel.domain?.label || 'General enterprise',
        complexityLabel: valueModel.complexity?.label || 'Working complexity',
        cycleTime: valueModel.measured?.platformDurationLabel || 'No measured cycle time yet',
        internalHoursAvoided: valueModel.directional?.internalHoursAvoidedLabel || '0 hours',
        externalEquivalentDays: valueModel.directional?.externalEquivalentDaysLabel || 'No specialist-day benchmark yet',
        internalCostAvoided: fmt(valueModel.cost?.internalCostAvoidedUsd || 0),
        externalEquivalentValue: fmt(valueModel.cost?.externalEquivalentValueUsd || 0),
        modelledReduction: valueModel.modelled?.available ? fmt(valueModel.modelled.annualReductionUsd || 0) : '',
        modelledReductionSource: valueModel.modelled?.available ? valueModel.modelled.sourceLabel : (valueModel.modelled?.title || 'Create a better-outcome comparison to quantify modelled reduction.')
      } : null,
      metrics: safeMetrics,
      appendix: includeAppendix ? {
        assumptions: Array.isArray(intelligence.assumptions) ? intelligence.assumptions.slice(0, 4) : [],
        citations: citations.slice(0, 6),
        topGap: confidenceFrame?.topGap || 'No major evidence gap recorded.',
        evidenceSummary: confidenceFrame?.evidenceSummary || 'Evidence quality has not been summarised yet.'
      } : null
    };
  }

  function exportDecisionMemo(assessment, currency = 'USD', fxRate = 3.6725, { includeAppendix = false } = {}) {
    const memo = buildDecisionMemoModel(assessment, currency, fxRate, { includeAppendix });
    const fmt = v => _formatCurrency(v, currency, fxRate);
    const postureClass = memo.postureTone;
    const appendix = memo.appendix;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Decision Memo — ${memo.title}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif; background: #f3f3ef; color: #212822; }
  .page { max-width: 980px; margin: 0 auto; padding: 32px; }
  .sheet { background: #f6f3f2; border: 1px solid rgba(33,40,34,.12); border-radius: 24px; padding: 30px; box-shadow: 0 18px 54px rgba(18, 24, 20, 0.12); }
  .sheet + .sheet { margin-top: 24px; }
  .sheet--appendix { background: #f3f0ee; }
  .eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: rgba(33,40,34,.55); margin-bottom: 8px; }
  h1, h2, h3 { font-family: 'Syne', 'Avenir Next', 'Segoe UI', sans-serif; margin: 0; color: #212822; }
  h1 { font-size: 34px; line-height: 1.05; max-width: 14ch; }
  h2 { font-size: 18px; margin-bottom: 12px; }
  h3 { font-size: 15px; margin-bottom: 6px; }
  p { margin: 0; }
  .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .header-meta { margin-top: 10px; font-size: 13px; color: rgba(33,40,34,.68); }
  .tag { display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(33,40,34,.12); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: rgba(33,40,34,.7); }
  .hero { margin-top: 24px; display: grid; grid-template-columns: 1.45fr .85fr; gap: 18px; background: linear-gradient(180deg, rgba(3,209,168,.08), rgba(255,255,255,.02)); border: 1px solid rgba(3,209,168,.24); border-radius: 22px; padding: 24px; }
  .hero-copy { margin-top: 14px; font-size: 15px; line-height: 1.75; color: rgba(33,40,34,.82); }
  .appendix-callout { margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; background: rgba(33,40,34,.05); border: 1px solid rgba(33,40,34,.1); font-size: 12px; font-weight: 700; color: rgba(33,40,34,.72); }
  .hero-badges, .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .badge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
  .badge.success { background: rgba(3,209,168,.12); color: #0b7f68; border-color: rgba(3,209,168,.28); }
  .badge.warning { background: rgba(242,251,90,.2); color: #626f11; border-color: rgba(146,156,42,.28); }
  .badge.danger { background: rgba(172,67,46,.1); color: #8e2d1d; border-color: rgba(172,67,46,.22); }
  .badge.neutral { background: rgba(33,40,34,.06); color: rgba(33,40,34,.72); border-color: rgba(33,40,34,.1); }
  .signal-panel { background: rgba(33,40,34,.03); border-radius: 18px; padding: 18px; border: 1px solid rgba(33,40,34,.08); }
  .signal-ring { width: 120px; height: 120px; margin: 0 auto 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px rgba(33,40,34,.08); }
  .signal-ring.success { background: radial-gradient(circle at center, rgba(3,209,168,.16), rgba(3,209,168,.03) 65%); }
  .signal-ring.warning { background: radial-gradient(circle at center, rgba(242,251,90,.22), rgba(242,251,90,.05) 65%); }
  .signal-ring.danger { background: radial-gradient(circle at center, rgba(172,67,46,.16), rgba(172,67,46,.04) 65%); }
  .signal-inner { width: 74px; height: 74px; border-radius: 50%; background: #f6f3f2; display: flex; align-items: center; justify-content: center; font-family: 'Syne', 'Avenir Next', 'Segoe UI', sans-serif; font-size: 28px; }
  .signal-copy { font-size: 13px; line-height: 1.7; color: rgba(33,40,34,.72); text-align: center; }
  .metrics, .mid-grid, .appendix-grid { display: grid; gap: 16px; margin-top: 22px; }
  .metrics { grid-template-columns: repeat(3, 1fr); }
  .mid-grid { grid-template-columns: 1.15fr .85fr; }
  .appendix-grid { grid-template-columns: repeat(2, 1fr); }
  .card { background: rgba(255,255,255,.62); border: 1px solid rgba(33,40,34,.1); border-radius: 18px; padding: 18px; }
  .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: rgba(33,40,34,.52); }
  .metric-value { font-family: 'Syne', sans-serif; font-size: 30px; margin-top: 10px; }
  .metric-copy, .body-copy { margin-top: 10px; font-size: 13px; line-height: 1.75; color: rgba(33,40,34,.78); }
  .decision-row + .decision-row { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(33,40,34,.08); }
  .track-card + .track-card { margin-top: 14px; }
  .track-head, .mix-head { display: flex; justify-content: space-between; gap: 12px; }
  .track { height: 12px; border-radius: 999px; background: rgba(33,40,34,.09); overflow: hidden; margin-top: 10px; }
  .track-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #03D1A8, rgba(3,209,168,.45)); }
  .track-fill.warning { background: linear-gradient(90deg, #b0bc34, rgba(242,251,90,.75)); }
  .track-fill.danger { background: linear-gradient(90deg, #a24334, rgba(162,67,52,.35)); }
  .track-foot { margin-top: 10px; font-size: 12px; line-height: 1.6; color: rgba(33,40,34,.68); }
  .mix-row + .mix-row { margin-top: 12px; }
  .mix-bar { height: 10px; border-radius: 999px; background: rgba(33,40,34,.08); overflow: hidden; margin-top: 7px; }
  .mix-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #03D1A8, rgba(3,209,168,.42)); }
  .appendix { margin-top: 28px; padding-top: 22px; border-top: 1px solid rgba(33,40,34,.1); }
  .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid rgba(33,40,34,.1); font-size: 11px; line-height: 1.7; color: rgba(33,40,34,.58); }
  @media print {
    body { background: #f6f3f2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; max-width: none; }
    .sheet { border: 0; border-radius: 0; box-shadow: none; }
    .sheet + .sheet { margin-top: 0; page-break-before: always; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <div class="header">
        <div>
          <div class="eyebrow">Management note</div>
          <h1>${memo.title}</h1>
          <div class="header-meta">${memo.businessContext} · ${memo.completedLabel}</div>
        </div>
        <div class="tag">${includeAppendix ? 'Board note + appendix' : 'Board note'}</div>
      </div>

      <div class="hero">
        <div>
          <div class="eyebrow">Current posture</div>
          <h2 style="font-size:32px;line-height:1.08;max-width:15ch">${memo.executiveDecision.decision}</h2>
          <div class="hero-copy">${memo.executiveDecision.rationale}</div>
          ${appendix ? `<div class="appendix-callout">Appendix attached on page 2 for evidence, assumptions, and follow-up review.</div>` : ''}
          <div class="hero-badges">
            <span class="badge ${postureClass}">${memo.posture}</span>
            <span class="badge neutral">${memo.confidenceFrame.label}</span>
            <span class="badge neutral">${memo.businessContext}</span>
          </div>
        </div>
        <div class="signal-panel">
          <div class="signal-ring ${postureClass}"><div class="signal-inner">${memo.postureTone === 'success' ? '✓' : '!'}</div></div>
          <div class="signal-copy">${memo.thresholdModel.single.summary}</div>
        </div>
      </div>

      <div class="metrics">
        ${(Array.isArray(memo.metrics) ? memo.metrics : []).map(item => `<div class="card"><div class="section-label">${item.label}</div><div class="metric-value">${item.value}</div><div class="metric-copy">${item.copy}</div></div>`).join('')}
      </div>

      ${memo.valueSummary ? `<div class="mid-grid">
        <div class="card">
          <div class="section-label">Value created by this assessment</div>
          <div class="decision-row"><div class="section-label">Measured cycle time</div><div class="body-copy"><strong>${memo.valueSummary.cycleTime}</strong><br>Measured from the first saved draft to the completed assessment.</div></div>
          <div class="decision-row"><div class="section-label">Directional internal effort avoided</div><div class="body-copy"><strong>${memo.valueSummary.internalHoursAvoided}</strong><br>Directional effort avoided versus the ${memo.valueSummary.domainLabel.toLowerCase()} baseline.</div></div>
          <div class="decision-row"><div class="section-label">External specialist equivalent</div><div class="body-copy"><strong>${memo.valueSummary.externalEquivalentDays}</strong><br>Directional Big 4-style UAE advisory benchmark for ${memo.valueSummary.complexityLabel.toLowerCase()} work.</div></div>
        </div>
        <div class="card">
          <div class="section-label">Economic framing</div>
          <div class="decision-row"><div class="section-label">External-equivalent value</div><div class="body-copy"><strong>${memo.valueSummary.externalEquivalentValue}</strong><br>Use this as the comparable Big 4-style UAE advisory benchmark, not as booked savings.</div></div>
          <div class="decision-row"><div class="section-label">Modelled annual reduction</div><div class="body-copy"><strong>${memo.valueSummary.modelledReduction || 'Not quantified yet'}</strong><br>${memo.valueSummary.modelledReductionSource}</div></div>
        </div>
      </div>` : ''}

      <div class="mid-grid">
        <div class="card">
          <div class="section-label">AI quality signal</div>
          <div class="body-copy"><strong>${memo.aiQualitySummary?.label || 'Working guidance'}</strong><br>${memo.aiQualitySummary?.summary || 'Use the confidence and evidence sections to decide how much weight to place on the AI-supported output.'}</div>
        </div>
        <div class="card">
          <div class="section-label">Export handling</div>
          <div class="body-copy">${memo.exportSnapshotNote}</div>
        </div>
      </div>

      <div class="mid-grid">
        <div class="card">
          <div class="section-label">Scenario and business context</div>
          <div class="body-copy">${memo.scenarioSummary}</div>
          <div class="decision-row">
            <div class="section-label">Recommended management action</div>
            <div class="body-copy"><strong>${memo.executiveDecision.priority}</strong><br>${memo.executiveDecision.managementFocus}</div>
          </div>
          <div class="decision-row">
            <div class="section-label">Next decision required</div>
            <div class="body-copy"><strong>${memo.nextStepPlan[0]?.title || 'Review the saved result'}</strong><br>${memo.nextStepPlan[0]?.copy || memo.executiveDecision.rationale}</div>
          </div>
          ${memo.treatmentDecision ? `<div class="decision-row"><div class="section-label">Treatment comparison read</div><div class="body-copy"><strong>${memo.treatmentDecision.title}</strong><br>${memo.treatmentDecision.summary}</div></div>` : ''}
        </div>
        <div class="card">
          <div class="section-label">Confidence and caveat</div>
          <div class="body-copy">${memo.confidenceFrame.summary}</div>
          <div class="decision-row">
            <div class="section-label">Biggest evidence caveat</div>
            <div class="body-copy">${memo.confidenceFrame?.topGap || 'No major evidence gap recorded.'}</div>
          </div>
          <div class="decision-row">
            <div class="section-label">What improves next</div>
            <div class="body-copy">${memo.nextStepPlan[1]?.copy || memo.confidenceFrame.implication}</div>
          </div>
        </div>
      </div>

      <div class="mid-grid">
        <div class="card">
          <div class="section-label">Tolerance interpretation</div>
          <div class="track-card">
            <div class="track-head"><strong>${memo.thresholdModel.single.title}</strong><span class="badge ${memo.thresholdModel.single.statusTone}">${memo.thresholdModel.single.status}</span></div>
            <div class="track"><div class="track-fill ${memo.thresholdModel.single.statusTone === 'success' ? '' : memo.thresholdModel.single.statusTone}" style="width:${memo.thresholdModel.single.ratio}%"></div></div>
            <div class="track-foot">${memo.thresholdModel.single.summary}</div>
          </div>
          <div class="track-card">
            <div class="track-head"><strong>${memo.thresholdModel.annual.title}</strong><span class="badge ${memo.thresholdModel.annual.statusTone}">${memo.thresholdModel.annual.status}</span></div>
            <div class="track"><div class="track-fill ${memo.thresholdModel.annual.statusTone === 'success' ? '' : memo.thresholdModel.annual.statusTone}" style="width:${memo.thresholdModel.annual.ratio}%"></div></div>
            <div class="track-foot">${memo.thresholdModel.annual.summary}</div>
          </div>
        </div>
        <div class="card">
          <div class="section-label">Main drivers of impact</div>
          ${Array.isArray(memo.impactMix) && memo.impactMix.length
            ? memo.impactMix.map(item => `<div class="mix-row"><div class="mix-head"><span>${item.label}</span><strong>${fmt(item.value)}</strong></div><div class="mix-bar"><span style="width:${item.width}%"></span></div></div>`).join('')
            : `<div class="body-copy">No material loss-component mix is available for this scenario yet.</div>`}
        </div>
      </div>

      <div class="footer">Generated by Risk Intelligence Platform. This note is designed for management discussion first, with detail intentionally kept secondary. Validate assumptions and evidence before formal commitment. ${memo.exportSnapshotNote}</div>
    </div>
    ${appendix ? `<div class="sheet sheet--appendix">
      <div class="header">
        <div>
          <div class="eyebrow">Appendix and evidence note</div>
          <h1 style="font-size:30px;max-width:none">Decision Memo Appendix</h1>
          <div class="header-meta">${memo.title} · page 2 · supporting detail for review and validation</div>
        </div>
        <div class="tag">Appendix</div>
      </div>
      <div class="appendix">
        <div class="appendix-grid">
          <div class="card">
            <div class="section-label">Assumptions to challenge</div>
            <div class="body-copy">${Array.isArray(appendix.assumptions) && appendix.assumptions.length ? appendix.assumptions.map(item => `• ${item.text}`).join('<br>') : 'No structured assumptions were recorded for this assessment.'}</div>
          </div>
          <div class="card">
            <div class="section-label">Evidence and references</div>
            <div class="body-copy">${appendix.evidenceSummary || 'Evidence quality has not been summarised yet.'}<br><br><strong>Top caveat:</strong> ${appendix.topGap || 'No major evidence gap recorded.'}</div>
            ${Array.isArray(appendix.citations) && appendix.citations.length ? `<div class="chip-row">${appendix.citations.map(item => `<span class="badge neutral">${item.title || item.sourceTitle || 'Reference'}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="footer">Appendix included intentionally for technical review, evidence challenge, and committee follow-up rather than first-pass management reading.</div>
    </div>` : ''}
  </div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;
    _openPrintableHtml(html, `${includeAppendix ? 'Risk_Decision_Memo_With_Appendix' : 'Risk_Decision_Memo'}_${assessment.id || Date.now()}.html`);
    return memo;
  }

  function exportBoardNote(assessment, currency = 'USD', fxRate = 3.6725) {
    const memo = buildDecisionMemoModel(assessment, currency, fxRate, { includeAppendix: false });
    const html = buildBoardNoteHtml(memo);
    const filename = `board-note-${String(memo.title || 'risk').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.html`;
    _openPrintableHtml(html, filename);
  }

  // ─── JSON Export ─────────────────────────────────────────
  function exportJSON(assessment) {
    exportDataAsJson(assessment, `G42_RiskAssessment_${assessment.id || Date.now()}.json`);
  }

  function exportDataAsJson(data, filename = `risk-calculator-export-${Date.now()}.json`) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function _downloadTextFile(text, filename, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([String(text || '')], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importJsonFile({ onData, onError } = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || 'null'));
          if (typeof onData === 'function') onData(parsed, file);
        } catch (error) {
          if (typeof onError === 'function') onError(error);
        }
      };
      reader.onerror = () => {
        if (typeof onError === 'function') onError(new Error('Could not read that JSON file.'));
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // ─── Print-Ready HTML Report ─────────────────────────────
  // [EXPORT-INTEGRATION] Replace with jsPDF + autoTable for true PDF
  function exportPDF(assessment, currency = 'USD', fxRate = 3.6725) {
    const r = assessment.results;
    const fmt = v => _formatCurrency(v, currency, fxRate);
    const d = new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
    const statusClass = r.toleranceBreached ? 'above' : r.nearTolerance ? 'warning' : 'within';
    const statusTitle = r.toleranceBreached ? 'Needs leadership action' : r.nearTolerance ? 'Needs management attention' : 'Within current tolerance';
    const executiveHeadline = r.toleranceBreached
      ? 'This scenario is above tolerance and needs leadership attention now.'
      : r.nearTolerance
        ? 'This scenario is close to tolerance and should be actively managed before it escalates.'
        : 'This scenario is within tolerance today, but should stay under active monitoring.';
    const executiveAction = r.toleranceBreached
      ? 'Escalate to the accountable executive, confirm an owner, and agree immediate treatment actions.'
      : r.nearTolerance
        ? 'Agree targeted reduction actions and management review before the scenario moves above tolerance.'
        : 'Maintain controls, monitor change signals, and revisit the scenario if threat, exposure, or scope changes.';
    const annualView = r.annualReviewTriggered
      ? `Annual exposure is material at ${fmt(r.ale.p90)} on a severe-but-plausible basis, so it also merits annual leadership review.`
      : `Annual exposure is ${fmt(r.ale.p90)} on a severe-but-plausible basis, which stays below the annual review trigger.`;
    const exceedancePct = ((r.toleranceDetail?.lmExceedProb || 0) * 100).toFixed(1);
    const completed = new Date(assessment.completedAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
    const narrative = _buildExecutiveScenarioSummary(assessment) || 'No scenario narrative available.';
    const risks = Array.isArray(assessment.selectedRisks) ? assessment.selectedRisks : [];
    const regulations = Array.isArray(assessment.applicableRegulations) ? assessment.applicableRegulations : [];
    const citations = Array.isArray(assessment.citations)
      ? Array.from(new Map(assessment.citations.map(c => [c.docId || c.title, c])).values())
      : [];
    const recommendations = Array.isArray(assessment.recommendations) ? assessment.recommendations : [];
    const technicalInputs = r.inputs || assessment.fairParams || {};
    const intelligence = assessment.assessmentIntelligence || null;
    const executiveDecision = _buildExecutiveDecisionSupport(assessment, r, intelligence);
    const confidenceFrame = _buildExecutiveConfidenceFrame(intelligence?.confidence, assessment.evidenceQuality, assessment.missingInformation, citations);
    const confidence = intelligence?.confidence || null;
    const drivers = intelligence?.drivers || null;
    const assumptions = Array.isArray(intelligence?.assumptions) ? intelligence.assumptions : [];
    const challenge = assessment.assessmentChallenge || null;
    const thresholdModel = _buildExecutiveThresholdModel(r, fmt);
    const impactMix = _buildExecutiveImpactMix(technicalInputs);
    const treatmentComparison = assessment.comparisonBaseline?.results
      ? (() => {
          const baseline = assessment.comparisonBaseline;
          const current = assessment.results || {};
          const baselineResults = baseline.results || {};
          const severeDirection = Number(current.lm?.p90 || 0) < Number(baselineResults.lm?.p90 || 0) ? 'down' : Number(current.lm?.p90 || 0) > Number(baselineResults.lm?.p90 || 0) ? 'up' : 'flat';
          const annualDirection = Number(current.ale?.mean || 0) < Number(baselineResults.ale?.mean || 0) ? 'down' : Number(current.ale?.mean || 0) > Number(baselineResults.ale?.mean || 0) ? 'up' : 'flat';
          const severeAnnualDirection = Number(current.ale?.p90 || 0) < Number(baselineResults.ale?.p90 || 0) ? 'down' : Number(current.ale?.p90 || 0) > Number(baselineResults.ale?.p90 || 0) ? 'up' : 'flat';
          return _buildTreatmentDecisionSummary({
            baselineTitle: baseline.scenarioTitle || 'Selected baseline',
            baselineDate: new Date(baseline.completedAt || baseline.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }),
            severeEvent: { direction: severeDirection },
            annualExposure: { direction: annualDirection },
            severeAnnual: { direction: severeAnnualDirection },
            treatmentNarrative: assessment.comparisonNarrative || assessment.treatmentImprovementRequest || '',
            keyDriver: assessment.comparisonKeyDriver || 'Review the changed assumptions versus the saved baseline.',
            secondaryDriver: assessment.comparisonSecondaryDriver || ''
          });
        })()
      : null;
    const valueModel = typeof ValueQuantService !== 'undefined'
      ? ValueQuantService.buildAssessmentValueModel(assessment, {
          assessments: typeof getAssessments === 'function' ? getAssessments() : [],
          benchmarkSettings: typeof getAdminSettings === 'function' ? getAdminSettings().valueBenchmarkSettings : {}
        })
      : null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Risk Quantifier — ${displayTitle || 'Assessment'}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif; color: #172033; background: #f5f7fb; }
  .page { max-width: 980px; margin: 0 auto; padding: 36px; }
  .sheet { background: #ffffff; border: 1px solid #d8e0ea; border-radius: 22px; padding: 34px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08); }
  .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 28px; }
  .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: #6c7892; margin-bottom: 6px; }
  h1, h2, h3 { font-family: 'Syne', 'Avenir Next', 'Segoe UI', sans-serif; margin: 0; color: #10203b; }
  h1 { font-size: 30px; line-height: 1.05; max-width: 14ch; }
  h2 { font-size: 18px; margin-bottom: 14px; }
  h3 { font-size: 15px; margin-bottom: 8px; }
  .meta { margin-top: 8px; color: #5b667d; font-size: 13px; }
  .tagline { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #7a859d; border: 1px solid #d8e0ea; border-radius: 999px; padding: 8px 12px; }
  .hero { display: grid; grid-template-columns: 1.7fr .9fr; gap: 24px; padding: 26px; border-radius: 20px; border: 1px solid #d8e0ea; background: #fbfcfe; }
  .hero.above { box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.18); }
  .hero.warning { box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.18); }
  .hero.within { box-shadow: inset 0 0 0 1px rgba(5, 150, 105, 0.18); }
  .hero-copy { font-size: 15px; line-height: 1.8; color: #475066; margin-top: 14px; }
  .badge-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 11px; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
  .badge.neutral { background: #f3f5f9; border-color: #d8e0ea; color: #53607a; }
  .badge.danger { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }
  .badge.warning { background: #fef3c7; border-color: #fcd34d; color: #b45309; }
  .badge.success { background: #d1fae5; border-color: #6ee7b7; color: #047857; }
  .signal { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  .signal-ring { width: 136px; height: 136px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(16, 24, 40, 0.03), transparent 70%); }
  .signal-ring.above { box-shadow: 0 0 0 16px rgba(220, 38, 38, 0.08), inset 0 0 0 1px rgba(220, 38, 38, 0.24); }
  .signal-ring.warning { box-shadow: 0 0 0 16px rgba(217, 119, 6, 0.08), inset 0 0 0 1px rgba(217, 119, 6, 0.24); }
  .signal-ring.within { box-shadow: 0 0 0 16px rgba(5, 150, 105, 0.08), inset 0 0 0 1px rgba(5, 150, 105, 0.24); }
  .signal-inner { width: 86px; height: 86px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #ffffff; font-size: 36px; font-family: 'Syne', 'Avenir Next', 'Segoe UI', sans-serif; }
  .signal-copy { font-size: 13px; color: #53607a; line-height: 1.6; max-width: 18ch; }
  .metric-grid, .visual-grid, .decision-grid, .summary-grid, .appendix-grid { display: grid; gap: 16px; margin-top: 22px; }
  .metric-grid { grid-template-columns: repeat(3, 1fr); }
  .visual-grid { grid-template-columns: 1.35fr 1fr 1fr; }
  .decision-grid, .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .appendix-grid { grid-template-columns: repeat(3, 1fr); }
  .card { background: #ffffff; border: 1px solid #d8e0ea; border-radius: 18px; padding: 18px 20px; }
  .track-grid { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
  .track-card { background: #f8fbff; border-radius: 14px; padding: 14px; }
  .track-head, .mix-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .track-value, .mix-head strong { font-family: 'Syne', sans-serif; color: #10203b; }
  .track { position: relative; height: 12px; border-radius: 999px; background: rgba(148,163,184,0.18); margin-top: 10px; }
  .track-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: linear-gradient(90deg, rgba(55,114,230,.9), rgba(127,163,242,.96)); }
  .track-fill.danger { background: linear-gradient(90deg, rgba(220,38,38,.9), rgba(248,113,113,.96)); }
  .track-fill.warning { background: linear-gradient(90deg, rgba(217,119,6,.9), rgba(251,191,36,.96)); }
  .track-fill.success { background: linear-gradient(90deg, rgba(5,150,105,.9), rgba(52,211,153,.96)); }
  .track-marker { position: absolute; top: -6px; transform: translateX(-50%); text-align: center; }
  .track-marker i { display: block; width: 2px; height: 24px; background: rgba(15,23,42,.45); margin: 0 auto; }
  .track-marker small { display: block; margin-top: 4px; font-size: 9px; color: #697487; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
  .track-foot { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; font-size: 11px; color: #5b667d; }
  .signal-stack, .mix-stack { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
  .signal-bar, .mix-bar { height: 10px; border-radius: 999px; background: rgba(148,163,184,0.18); overflow: hidden; margin-top: 8px; }
  .signal-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, rgba(220,38,38,.9), rgba(248,113,113,.96)); }
  .signal-bar.warning span { background: linear-gradient(90deg, rgba(217,119,6,.9), rgba(251,191,36,.96)); }
  .mix-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, rgba(180,138,70,.9), rgba(214,175,106,.96)); }
  .metric-label, .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #7a859d; }
  .metric-value { font-family: 'Syne', sans-serif; font-size: 30px; line-height: 1; color: #10203b; margin-top: 10px; }
  .metric-value.warning { color: #b45309; }
  .metric-value.danger { color: #b91c1c; }
  .metric-copy, .body-copy { margin-top: 10px; font-size: 13px; line-height: 1.8; color: #4b5565; }
  .decision-row + .decision-row { margin-top: 14px; padding-top: 14px; border-top: 1px solid #e6ebf2; }
  .threshold-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e6ebf2; color: #4b5565; font-size: 13px; }
  .threshold-row:last-child { border-bottom: 0; }
  .threshold-row strong { font-family: 'Syne', sans-serif; font-size: 18px; color: #10203b; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chip { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: #f3f5f9; border: 1px solid #d8e0ea; font-size: 11px; color: #53607a; }
  .chip.gold { background: rgba(180,138,70,0.1); border-color: rgba(180,138,70,0.24); color: #8a6a33; }
  .priority-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 14px; }
  .priority { border: 1px solid #d8e0ea; border-radius: 18px; padding: 16px; background: #fff; }
  .priority-no { width: 30px; height: 30px; border-radius: 50%; background: #eaf0f7; color: #2d4f77; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 700; margin-bottom: 12px; }
  .priority-title { font-family: 'Syne', sans-serif; font-size: 16px; color: #10203b; }
  .priority-copy { font-size: 13px; color: #4b5565; line-height: 1.7; margin-top: 8px; }
  .priority-impact { margin-top: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #047857; }
  .driver-block + .driver-block { margin-top: 14px; padding-top: 14px; border-top: 1px solid #e6ebf2; }
  .driver-label, .assumption-label { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #7a859d; }
  .assumptions-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 14px; }
  .assumption-card { border: 1px solid #d8e0ea; border-radius: 18px; padding: 16px; background: #fff; }
  .assumption-copy { font-size: 13px; line-height: 1.7; color: #4b5565; margin-top: 8px; }
  .section { margin-top: 30px; }
  .section-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
  .appendix { margin-top: 38px; padding-top: 26px; border-top: 2px solid #d8e0ea; }
  .small { font-size: 12px; color: #697487; }
  .footer { margin-top: 34px; padding-top: 16px; border-top: 1px solid #e6ebf2; font-size: 11px; line-height: 1.7; color: #7a859d; }
  @media print {
    body { background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; max-width: none; }
    .sheet { box-shadow: none; border: 0; border-radius: 0; padding: 18px; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <div class="header">
        <div>
          <div class="eyebrow">Risk Quantifier report</div>
          <h1>${displayTitle || 'Risk Assessment'}</h1>
          <div class="meta">${assessment.buName || '—'} · ${assessment.geography || '—'} · ${completed}</div>
        </div>
        <div class="tagline">PoC report · executive version</div>
      </div>

      <div class="hero ${statusClass}">
        <div>
          <div class="eyebrow">Assessment outcome</div>
          <h2 style="font-size:32px;line-height:1.08;max-width:14ch">${executiveHeadline}</h2>
          <div class="hero-copy">${r.toleranceBreached
            ? `Per-event P90 ${fmt(r.lm.p90)} is above the tolerance threshold of ${fmt(r.threshold)}.`
            : r.nearTolerance
              ? `Per-event P90 ${fmt(r.lm.p90)} is above the warning trigger of ${fmt(r.warningThreshold)} but still below tolerance.`
              : `Per-event P90 ${fmt(r.lm.p90)} remains below the warning trigger of ${fmt(r.warningThreshold)}.`} ${annualView}</div>
          <div class="badge-row">
            <span class="badge ${r.toleranceBreached ? 'danger' : r.nearTolerance ? 'warning' : 'success'}">${statusTitle}</span>
            <span class="badge neutral">${assessment.buName || 'No business unit'}</span>
            <span class="badge neutral">${assessment.geography || 'No geography'}</span>
            <span class="badge neutral">${d}</span>
          </div>
        </div>
        <div class="signal">
          <div class="signal-ring ${statusClass}"><div class="signal-inner">${r.toleranceBreached ? '!' : r.nearTolerance ? '!' : '✓'}</div></div>
          <div class="signal-copy">${exceedancePct}% chance of breaching tolerance in the modelled distribution</div>
        </div>
      </div>

      <div class="metric-grid">
        <div class="card">
          <div class="metric-label">Potential impact from one serious event</div>
          <div class="metric-value ${r.toleranceBreached ? 'danger' : ''}">${fmt(r.lm.p90)}</div>
          <div class="metric-copy">Use this as the serious single-event view when discussing tolerance and escalation.</div>
        </div>
        <div class="card">
          <div class="metric-label">Most likely impact over a year</div>
          <div class="metric-value">${fmt(r.ale.mean)}</div>
          <div class="metric-copy">Use this as the most likely yearly view if conditions stay broadly the same.</div>
        </div>
        <div class="card">
          <div class="metric-label">High-stress impact over a year</div>
          <div class="metric-value warning">${fmt(r.ale.p90)}</div>
          <div class="metric-copy">Use this as the more severe yearly view for resilience, capital, and escalation discussions.</div>
        </div>
      </div>

      ${valueModel ? `<div class="decision-grid">
        <div class="card">
          <div class="section-label">Value created by this assessment</div>
          <div class="decision-row"><div class="section-label">Measured cycle time</div><div class="body-copy"><strong>${valueModel.measured?.platformDurationLabel || 'No measured cycle time yet'}</strong><br>Measured from the first saved draft to the completed result.</div></div>
          <div class="decision-row"><div class="section-label">Directional internal effort avoided</div><div class="body-copy"><strong>${valueModel.directional?.internalHoursAvoidedLabel || '0 hours'}</strong><br>Against the ${String(valueModel.domain?.label || 'general enterprise').toLowerCase()} baseline for this complexity.</div></div>
          <div class="decision-row"><div class="section-label">External specialist equivalent</div><div class="body-copy"><strong>${valueModel.directional?.externalEquivalentDaysLabel || 'No specialist-day benchmark yet'}</strong><br>Directional Big 4-style UAE advisory benchmark.</div></div>
        </div>
        <div class="card">
          <div class="section-label">Economic framing</div>
          <div class="decision-row"><div class="section-label">External-equivalent value</div><div class="body-copy"><strong>${fmt(valueModel.cost?.externalEquivalentValueUsd || 0)}</strong><br>Comparable external-specialist benchmark rather than booked savings.</div></div>
          <div class="decision-row"><div class="section-label">Modelled annual reduction</div><div class="body-copy"><strong>${valueModel.modelled?.available ? fmt(valueModel.modelled.annualReductionUsd || 0) : 'Not quantified yet'}</strong><br>${valueModel.modelled?.available ? valueModel.modelled.sourceLabel : (valueModel.modelled?.title || 'Create a better-outcome comparison to quantify modelled reduction.')}</div></div>
        </div>
      </div>` : ''}

      <div class="visual-grid">
        <div class="card">
          <div class="section-label">Against governance limits</div>
          <div class="track-grid">
            <div class="track-card">
              <div class="track-head"><div><div class="section-label">${thresholdModel.single.title}</div><div class="small">Current view: ${fmt(thresholdModel.single.current)}</div></div><span class="badge ${thresholdModel.single.statusTone}">${thresholdModel.single.status}</span></div>
              <div class="track"><div class="track-fill ${thresholdModel.single.statusTone}" style="width:${thresholdModel.single.ratio}%"></div></div>
              <div class="track-foot"><span>Benchmark: <strong>${fmt(thresholdModel.single.benchmark)}</strong></span><span>Warning: <strong>${fmt(thresholdModel.single.secondaryBenchmark)}</strong></span></div>
              <div class="small">${thresholdModel.single.summary}</div>
            </div>
            <div class="track-card">
              <div class="track-head"><div><div class="section-label">${thresholdModel.annual.title}</div><div class="small">Current view: ${fmt(thresholdModel.annual.current)}</div></div><span class="badge ${thresholdModel.annual.statusTone}">${thresholdModel.annual.status}</span></div>
              <div class="track"><div class="track-fill ${thresholdModel.annual.statusTone}" style="width:${thresholdModel.annual.ratio}%"></div></div>
              <div class="track-foot"><span>Benchmark: <strong>${fmt(thresholdModel.annual.benchmark)}</strong></span></div>
              <div class="small">${thresholdModel.annual.summary}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="section-label">Risk signal at a glance</div>
          <div class="signal-stack">
            <div>
              <div class="section-label">Tolerance breach likelihood</div>
              <div class="signal-bar"><span style="width:${_clampNumber((Number(r.toleranceDetail?.lmExceedProb || 0) * 100))}%"></span></div>
              <div class="small">${exceedancePct}% chance of breaching tolerance in the model</div>
            </div>
            <div>
              <div class="section-label">Annual stress versus review trigger</div>
              <div class="signal-bar warning"><span style="width:${Math.min(_clampNumber((Number(r.ale.p90 || 0) / Math.max(Number(r.annualReviewThreshold || r.ale.p90 || 1), 1)) * 100), 100)}%"></span></div>
              <div class="small">${Number(r.ale.p90 || 0) >= Number(r.annualReviewThreshold || 0) ? 'At or above' : 'Below'} the annual review trigger</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="section-label">What is driving the cost</div>
          <div class="mix-stack">
            ${impactMix.length ? impactMix.map(item => `<div><div class="mix-head"><span>${item.label}</span><strong>${fmt(item.value)}</strong></div><div class="mix-bar"><span style="width:${item.width}%"></span></div></div>`).join('') : '<div class="small">No meaningful loss-component mix is available.</div>'}
          </div>
        </div>
      </div>

      <div class="decision-grid">
        <div class="card">
          <div class="section-label">Recommended management decision</div>
          <div class="decision-row"><div class="section-label">Decision</div><div class="body-copy">${executiveDecision.decision}</div></div>
          <div class="decision-row"><div class="section-label">Why this is the right call now</div><div class="body-copy">${executiveDecision.rationale}</div></div>
          <div class="decision-row"><div class="section-label">What should happen now</div><div class="body-copy">${executiveAction}</div></div>
          <div class="decision-row"><div class="section-label">Main priority</div><div class="body-copy">${executiveDecision.priority}</div></div>
          <div class="decision-row"><div class="section-label">Management focus area</div><div class="body-copy">${executiveDecision.managementFocus}</div></div>
          ${treatmentComparison ? `<div class="decision-row"><div class="section-label">Treatment decision read</div><div class="body-copy"><strong>${treatmentComparison.title}</strong><br>${treatmentComparison.summary}</div></div>` : ''}
        </div>
        <div class="card">
          <div class="section-label">Threshold position</div>
          <div class="threshold-row"><span>Warning trigger</span><strong>${fmt(r.warningThreshold || r.threshold)}</strong></div>
          <div class="threshold-row"><span>Tolerance threshold</span><strong>${fmt(r.threshold)}</strong></div>
          <div class="threshold-row"><span>Annual review trigger</span><strong>${fmt(r.annualReviewThreshold || r.ale.p90)}</strong></div>
          <div class="decision-row"><div class="section-label">Why this matters now</div><div class="body-copy">${r.portfolioMeta?.linked ? `${r.selectedRiskCount || risks.length || 1} linked risks are being treated as one connected scenario.` : `${r.selectedRiskCount || risks.length || 1} risks are being assessed together without linked uplift.`}</div></div>
          <div class="decision-row"><div class="section-label">Escalation guidance</div><div class="body-copy">${(typeof getEffectiveSettings === 'function' ? getEffectiveSettings().escalationGuidance : '') || 'Escalate when the scenario is above tolerance, close to tolerance, or materially affects regulated services.'}</div></div>
          <div class="body-copy">The report leads with the decision first and the supporting detail after it.</div>
        </div>
      </div>

      <div class="summary-grid">
        <div class="card">
          <div class="section-label">What this scenario means in practice</div>
          <div class="body-copy">${narrative}</div>
        </div>
        <div class="card">
          <div class="section-label">What changed the result most</div>
          ${drivers?.upward?.length ? `<div class="driver-block"><div class="driver-label">Main upward drivers</div><div class="body-copy">${drivers.upward.slice(0, 3).map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          ${drivers?.stabilisers?.length ? `<div class="driver-block"><div class="driver-label">Main stabilisers</div><div class="body-copy">${drivers.stabilisers.slice(0, 2).map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          <div class="driver-block">
            <div class="driver-label">Scenario scope</div>
            <div class="chip-row">${risks.length ? risks.map(risk => `<span class="chip gold">${risk.title}</span>`).join('') : '<span class="chip">No linked risks selected</span>'}</div>
            ${regulations.length ? `<div class="chip-row">${regulations.map(tag => `<span class="chip">${tag}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>

      ${confidence ? `
      <div class="decision-grid">
        <div class="card">
          <div class="section-label">How confident to be in this assessment</div>
          <div class="badge-row" style="margin-top:12px">
            <span class="badge ${confidence.label === 'High confidence' ? 'success' : confidence.label === 'Low confidence' ? 'danger' : 'warning'}">${confidence.label}</span>
            <span class="badge neutral">${confidence.score}/100</span>
          </div>
          <div class="body-copy">${confidence.summary}</div>
          ${confidence.reasons?.length ? `<div class="driver-block"><div class="driver-label">Why it scored this way</div><div class="body-copy">${confidence.reasons.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          ${confidence.improvements?.length ? `<div class="driver-block"><div class="driver-label">What would improve confidence</div><div class="body-copy">${confidence.improvements.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
        </div>
        <div class="card">
          <div class="section-label">What is pushing the result up or down</div>
          <div class="body-copy">${confidenceFrame.implication}</div>
          ${drivers?.upward?.length ? `<div class="driver-block"><div class="driver-label">Main upward drivers</div><div class="body-copy">${drivers.upward.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          ${drivers?.stabilisers?.length ? `<div class="driver-block"><div class="driver-label">Main stabilisers</div><div class="body-copy">${drivers.stabilisers.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          <div class="driver-block"><div class="driver-label">Best next evidence to collect</div><div class="body-copy">${confidenceFrame.topGap}</div></div>
        </div>
      </div>` : ''}

      ${challenge ? `
      <div class="section">
        <div class="section-header">
          <h2>Challenge and validate this assessment</h2>
          <div class="small">AI-assisted challenge review</div>
        </div>
        <div class="decision-grid">
          <div class="card">
            <div class="section-label">Challenge summary</div>
            <div class="badge-row" style="margin-top:12px">
              <span class="badge warning">${challenge.challengeLevel || 'Challenge review'}</span>
              ${challenge.evidenceQuality ? `<span class="badge neutral">${challenge.evidenceQuality}</span>` : ''}
            </div>
            ${challenge.summary ? `<div class="body-copy">${challenge.summary}</div>` : ''}
            ${challenge.weakestAssumptions?.length ? `<div class="driver-block"><div class="driver-label">Weakest assumptions</div><div class="body-copy">${challenge.weakestAssumptions.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
            ${challenge.committeeQuestions?.length ? `<div class="driver-block"><div class="driver-label">What a risk committee would ask</div><div class="body-copy">${challenge.committeeQuestions.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          </div>
          <div class="card">
            <div class="section-label">Evidence to strengthen the result</div>
            ${challenge.evidenceToGather?.length ? `<div class="body-copy">${challenge.evidenceToGather.map(item => `• ${item}`).join('<br>')}</div>` : '<div class="body-copy">No additional evidence guidance captured.</div>'}
            ${challenge.reviewerGuidance?.length ? `<div class="driver-block"><div class="driver-label">Reviewer guidance</div><div class="body-copy">${challenge.reviewerGuidance.map(item => `• ${item}`).join('<br>')}</div></div>` : ''}
          </div>
        </div>
      </div>` : ''}

      ${assumptions.length ? `
      <div class="section">
        <div class="section-header">
          <h2>Key assumptions to keep in mind</h2>
          <div class="small">Core modelling assumptions captured for review</div>
        </div>
        <div class="assumptions-grid">
          ${assumptions.map(item => `<div class="assumption-card"><div class="assumption-label">${item.category}</div><div class="assumption-copy">${item.text}</div></div>`).join('')}
        </div>
      </div>` : ''}

      ${recommendations.length ? `
      <div class="section">
        <div class="section-header">
          <h2>Priority actions</h2>
          <div class="small">Top treatments to reduce exposure</div>
        </div>
        <div class="priority-grid">
          ${recommendations.slice(0, 3).map((rec, idx) => `
            <div class="priority">
              <div class="priority-no">${idx + 1}</div>
              <div class="priority-title">${rec.title}</div>
              <div class="priority-copy">${rec.why}</div>
              <div class="priority-impact">${rec.impact}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="appendix">
        <div class="section-header">
          <h2>Technical appendix</h2>
          <div class="small">For analysts, validators, and audit trail</div>
        </div>

        <div class="appendix-grid">
          <div class="card">
            <div class="section-label">Typical event cost</div>
            <div class="metric-value" style="font-size:24px">${fmt(r.lm.p50)}</div>
            <div class="metric-copy">Midpoint single-event view.</div>
          </div>
          <div class="card">
            <div class="section-label">Expected event cost</div>
            <div class="metric-value" style="font-size:24px">${fmt(r.lm.mean)}</div>
            <div class="metric-copy">Average single-event loss.</div>
          </div>
          <div class="card">
            <div class="section-label">Severe annual exposure</div>
            <div class="metric-value warning" style="font-size:24px">${fmt(r.ale.p90)}</div>
            <div class="metric-copy">Annual severe-but-plausible view.</div>
          </div>
        </div>

        ${hasStructuredScenario(assessment.structuredScenario) ? `
        <div class="section">
          <h3>Scenario details</h3>
          ${(() => {
            const structured = normaliseStructuredScenario(assessment.structuredScenario, { preserveUnknown: true }) || {};
            return `<div class="summary-grid">
            <div class="card"><div class="section-label">Asset / Service</div><div class="body-copy">${structured.assetService || '—'}</div></div>
            <div class="card"><div class="section-label">Primary driver</div><div class="body-copy">${structured.primaryDriver || '—'}</div></div>
            <div class="card"><div class="section-label">Event path</div><div class="body-copy">${structured.eventPath || '—'}</div></div>
            <div class="card"><div class="section-label">Effect</div><div class="body-copy">${structured.effect || '—'}</div></div>
          </div>`;
          })()}
        </div>` : ''}

        <div class="section">
          <h3>Simulation context</h3>
          <div class="summary-grid">
            <div class="card"><div class="section-label">Event frequency</div><div class="body-copy">${technicalInputs.tefMin ?? '—'} – ${technicalInputs.tefLikely ?? '—'} – ${technicalInputs.tefMax ?? '—'} times per year</div></div>
            <div class="card"><div class="section-label">Threat capability</div><div class="body-copy">${technicalInputs.threatCapMin ?? '—'} – ${technicalInputs.threatCapLikely ?? '—'} – ${technicalInputs.threatCapMax ?? '—'}</div></div>
            <div class="card"><div class="section-label">Control strength</div><div class="body-copy">${technicalInputs.controlStrMin ?? '—'} – ${technicalInputs.controlStrLikely ?? '—'} – ${technicalInputs.controlStrMax ?? '—'}</div></div>
            <div class="card"><div class="section-label">Iterations</div><div class="body-copy">${r.iterations.toLocaleString()}</div></div>
            <div class="card"><div class="section-label">Distribution</div><div class="body-copy">${r.distType || assessment.fairParams?.distType || 'triangular'}</div></div>
            <div class="card"><div class="section-label">Tolerance threshold</div><div class="body-copy">${fmt(r.threshold)}</div></div>
          </div>
        </div>

        ${citations.length ? `
        <div class="section">
          <h3>Internal citations</h3>
          <div class="chip-row">${citations.map(c => `<span class="chip">${c.title}</span>`).join('')}</div>
        </div>` : ''}
      </div>

      <div class="footer">
        Generated by Risk Quantifier PoC on ${d}. This report is intended for demonstration and structured discussion only. FAIR inputs and management conclusions should be validated through expert review before use in formal decision-making.
      </div>
    </div>
  </div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `Risk_Report_${assessment.id || Date.now()}.html`;
      a.click();
    }
    URL.revokeObjectURL(url);
  }

  function _pdfWrapText(text, maxCharsPerLine = 90) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (!source) return [];
    const words = source.split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxCharsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  function _pdfWriteLines(doc, lines, x, y, lineHeight = 6) {
    let cursorY = y;
    (Array.isArray(lines) ? lines : []).forEach(line => {
      doc.text(String(line || ''), x, cursorY);
      cursorY += lineHeight;
    });
    return cursorY;
  }

  function _pdfWriteParagraph(doc, text, x, y, maxCharsPerLine = 90, lineHeight = 6) {
    return _pdfWriteLines(doc, _pdfWrapText(text, maxCharsPerLine), x, y, lineHeight);
  }

  function _pdfResolveAssessmentTitle(assessment) {
    return _resolveAssessmentDisplayTitle(assessment);
  }

  function _pdfResolveOrganisationName(assessment) {
    return String(
      assessment?.orgName
      || assessment?.draft?.orgName
      || 'Risk Intelligence Platform'
    ).trim();
  }

  function _pdfResolveResults(assessment) {
    return assessment?.results || {};
  }

  function _pdfResolveFairInputs(assessment) {
    return assessment?.results?.inputs || assessment?.draft?.fairParams || assessment?.fairParams || {};
  }

  function _pdfResolveThreatLabel(inputs = {}) {
    return inputs?.vulnDirect ? 'Vulnerability' : 'Threat Capability';
  }

  function generatePdfReport(assessment) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF is not available in this session.');
    }

    const doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const marginLeft = 20;
    const marginRight = 20;
    const footerY = pageHeight - 8;
    const totalPages = 4;
    const currency = (typeof AppState !== 'undefined' && AppState?.currency) ? AppState.currency : 'USD';
    const fxRate = (typeof AppState !== 'undefined' && Number(AppState?.fxRate || 0)) ? Number(AppState.fxRate) : 3.6725;
    const results = _pdfResolveResults(assessment);
    const fairInputs = _pdfResolveFairInputs(assessment);
    const displayTitle = _pdfResolveAssessmentTitle(assessment);
    const assumptionsRaw = Array.isArray(results?.runMetadata?.assumptions) ? results.runMetadata.assumptions.slice(0, 10) : [];
    const runtimeGuardrails = Array.isArray(results?.runMetadata?.runtimeGuardrails) ? results.runMetadata.runtimeGuardrails : [];
    const completedLabel = new Date(assessment?.completedAt || assessment?.createdAt || Date.now()).toLocaleDateString('en-GB');
    const eventLossP90 = Number(results?.eventLoss?.p90 ?? results?.lm?.p90 ?? 0);
    const aleMean = Number(results?.ale?.mean ?? results?.annualLoss?.mean ?? 0);
    const aleP90 = Number(results?.ale?.p90 ?? results?.annualLoss?.p90 ?? 0);
    const decisionText = String(
      assessment?.assessmentIntelligence?.executiveAction
      || results?.decisionSupportText
      || 'Review this assessment with the risk committee.'
    ).trim();
    const confidenceLabel = String(
      results?.runMetadata?.confidenceLabel
      || assessment?.assessmentIntelligence?.confidenceLabel
      || assessment?.assessmentIntelligence?.confidence?.label
      || assessment?.confidenceLabel
      || 'Not recorded'
    ).trim();

    function addFooter(pageNumber) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(115, 120, 130);
      doc.text(`Page ${pageNumber} of ${totalPages} · ${String(assessment?.id || 'assessment').trim()} · CONFIDENTIAL`, marginLeft, footerY);
    }

    function addSectionHeader(title, y) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(26, 30, 38);
      doc.text(title, marginLeft, y);
      doc.line(marginLeft, y + 2, pageWidth - marginRight, y + 2);
      return y + 10;
    }

    function writeLabelValue(label, value, y) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(70, 74, 82);
      doc.text(label, marginLeft, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(28, 32, 40);
      return _pdfWriteParagraph(doc, value, marginLeft + 52, y, 64, 6);
    }

    function normaliseAssumptionItem(item) {
      if (!item) return '';
      if (typeof item === 'string') return item;
      const category = String(item.category || '').trim();
      const text = String(item.text || item.summary || '').trim();
      return category && text ? `${category}: ${text}` : (text || category);
    }

    function writeBulletSection(title, items, y, emptyText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(28, 32, 40);
      doc.text(title, marginLeft, y);
      let cursorY = y + 7;
      const rows = (Array.isArray(items) ? items : []).filter(Boolean);
      if (!rows.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(75, 82, 94);
        return _pdfWriteParagraph(doc, emptyText, marginLeft, cursorY, 92, 5);
      }
      rows.forEach(item => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(45, 52, 64);
        cursorY = _pdfWriteLines(doc, _pdfWrapText(`• ${String(item)}`, 92), marginLeft, cursorY, 5);
        cursorY += 1;
      });
      return cursorY;
    }

    // Page 1 — Cover
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(88, 94, 106);
    doc.text(_pdfResolveOrganisationName(assessment), marginLeft, 34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(24, 28, 36);
    let y = _pdfWriteParagraph(doc, _pdfResolveAssessmentTitle(assessment), marginLeft, 50, 28, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(88, 94, 106);
    doc.text(`Date: ${completedLabel}`, marginLeft, y + 10);
    doc.line(marginLeft, y + 16, pageWidth - marginRight, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(196, 38, 38);
    doc.text('CONFIDENTIAL', 152, pageHeight - 13);
    addFooter(1);

    // Page 2 — Executive Summary
    doc.addPage();
    y = addSectionHeader('Executive Summary', 24);
    y = writeLabelValue('P90 Event Loss', _formatCurrency(eventLossP90, currency, fxRate), y);
    y += 4;
    y = writeLabelValue('ALE Mean', _formatCurrency(aleMean, currency, fxRate), y);
    y += 4;
    y = writeLabelValue('ALE P90', _formatCurrency(aleP90, currency, fxRate), y);
    y += 4;
    y = writeLabelValue('Tolerance status', results?.toleranceBreached ? 'ABOVE TOLERANCE' : 'WITHIN TOLERANCE', y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 32, 40);
    doc.text('Decision', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(45, 52, 64);
    _pdfWriteParagraph(doc, decisionText, marginLeft, y + 8, 96, 6);
    addFooter(2);

    // Page 3 — FAIR Inputs table
    doc.addPage();
    y = addSectionHeader('FAIR Inputs', 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(60, 66, 78);
    doc.text('Parameter', marginLeft, y);
    doc.text('Value', 105, y);
    doc.line(marginLeft, y + 2, pageWidth - marginRight, y + 2);
    y += 10;
    const fairRows = [
      ['TEF (min / likely / max)', `${fairInputs?.tefMin ?? '—'} / ${fairInputs?.tefLikely ?? '—'} / ${fairInputs?.tefMax ?? '—'}`],
      [`${_pdfResolveThreatLabel(fairInputs)} (min / likely / max)`, fairInputs?.vulnDirect
        ? `${fairInputs?.vulnMin ?? '—'} / ${fairInputs?.vulnLikely ?? '—'} / ${fairInputs?.vulnMax ?? '—'}`
        : `${fairInputs?.threatCapMin ?? '—'} / ${fairInputs?.threatCapLikely ?? '—'} / ${fairInputs?.threatCapMax ?? '—'}`],
      ['Control Strength (min / likely / max)', `${fairInputs?.controlStrMin ?? '—'} / ${fairInputs?.controlStrLikely ?? '—'} / ${fairInputs?.controlStrMax ?? '—'}`],
      ['Distribution Type', `${fairInputs?.distType || '—'}`],
      ['Iterations', `${fairInputs?.iterations ?? '—'}`],
      ['Seed', `${fairInputs?.seed ?? '—'}`]
    ];
    fairRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(45, 52, 64);
      doc.text(label, marginLeft, y);
      doc.setFont('helvetica', 'normal');
      const wrappedValue = _pdfWrapText(value, 34);
      doc.text(wrappedValue[0] || '—', 105, y);
      if (wrappedValue[1]) doc.text(wrappedValue[1], 105, y + 5);
      doc.line(marginLeft, y + 3, pageWidth - marginRight, y + 3);
      y += wrappedValue.length > 1 ? 12 : 8;
    });
    addFooter(3);

    // Page 4 — Evidence & Assumptions
    doc.addPage();
    y = addSectionHeader('Evidence & Assumptions', 24);
    y = writeLabelValue('Confidence label', confidenceLabel, y);
    y += 8;
    y = writeBulletSection(
      'Assumptions',
      assumptionsRaw.map(normaliseAssumptionItem).filter(Boolean),
      y,
      'No recorded assumptions were saved with this run metadata.'
    );
    y += 6;
    writeBulletSection(
      'Runtime guardrails',
      runtimeGuardrails.map(item => typeof item === 'string' ? item : JSON.stringify(item)),
      y,
      'No runtime guardrails were recorded for this run.'
    );
    addFooter(4);

    return doc;
  }

  function _buildLivingRiskRegisterModel(assessments = [], currency = 'USD', fxRate = 3.6725) {
    const rows = typeof buildLivingRiskRegisterRows === 'function'
      ? buildLivingRiskRegisterRows({ assessments, now: Date.now() })
      : [];
    const summary = typeof buildLivingRiskRegisterSummary === 'function'
      ? buildLivingRiskRegisterSummary(rows)
      : { total: rows.length, aboveTolerance: 0, nearTolerance: 0, annualReview: 0, dueNow: 0, inReview: 0, needsRevision: 0 };
    return {
      createdLabel: new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' }),
      rows: rows.map(row => ({
        ...row,
        p90LossLabel: _formatCurrency(row.p90Loss || 0, currency, fxRate),
        aleMeanLabel: _formatCurrency(row.aleMean || 0, currency, fxRate)
      })),
      summary
    };
  }

  function _buildLivingRiskRegisterHtml(model) {
    const safe = value => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const summaryCards = [
      ['Rows', model.summary.total || 0],
      ['Above tolerance', model.summary.aboveTolerance || 0],
      ['Near tolerance', model.summary.nearTolerance || 0],
      ['Due now', model.summary.dueNow || 0],
      ['In review', model.summary.inReview || 0],
      ['Changes requested', model.summary.needsRevision || 0]
    ];
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Living Risk Register</title>
<style>
  body { margin: 0; background: #f4f7fb; color: #172033; font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif; }
  .page { max-width: 1100px; margin: 0 auto; padding: 32px; }
  .sheet { background: #fff; border: 1px solid #d8e0ea; border-radius: 22px; padding: 32px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08); }
  .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #697487; }
  h1 { margin: 8px 0 0; font-size: 34px; line-height: 1.05; font-family: 'Syne', 'Avenir Next', sans-serif; color: #10203b; }
  .subhead { margin-top: 10px; color: #556074; font-size: 14px; line-height: 1.7; max-width: 70ch; }
  .meta { margin-top: 12px; color: #697487; font-size: 12px; }
  .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-top: 24px; }
  .summary-card { border: 1px solid #d8e0ea; border-radius: 16px; padding: 14px; background: #fbfcfe; }
  .summary-card span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #697487; }
  .summary-card strong { display: block; margin-top: 8px; font-size: 24px; color: #10203b; font-family: 'Syne', 'Avenir Next', sans-serif; }
  .section-title { margin-top: 28px; font-size: 18px; color: #10203b; font-family: 'Syne', 'Avenir Next', sans-serif; }
  .section-copy { margin-top: 8px; color: #556074; font-size: 13px; line-height: 1.7; }
  .register-list { display: flex; flex-direction: column; gap: 12px; margin-top: 18px; }
  .register-row { border: 1px solid #d8e0ea; border-radius: 18px; padding: 16px 18px; background: #fff; }
  .register-head, .register-foot { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .register-title { font-size: 17px; font-weight: 700; color: #10203b; }
  .register-meta { margin-top: 6px; color: #697487; font-size: 12px; }
  .register-value-grid { display: grid; grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 10px; min-width: 260px; }
  .register-value { border-radius: 14px; background: #f8fbff; padding: 10px 12px; }
  .register-value span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #697487; }
  .register-value strong { display: block; margin-top: 6px; color: #10203b; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 10px; font-size: 11px; border: 1px solid transparent; }
  .chip.danger { background: #fee2e2; border-color: #fecaca; color: #b91c1c; }
  .chip.warning { background: #fef3c7; border-color: #fcd34d; color: #b45309; }
  .chip.gold { background: rgba(180,138,70,0.12); border-color: rgba(180,138,70,0.24); color: #8a6a33; }
  .chip.success { background: #d1fae5; border-color: #86efac; color: #047857; }
  .chip.neutral { background: #f3f5f9; border-color: #d8e0ea; color: #53607a; }
  .register-foot { margin-top: 14px; padding-top: 12px; border-top: 1px solid #e6ebf2; }
  .register-note { font-size: 12px; color: #556074; line-height: 1.7; }
  .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e6ebf2; font-size: 11px; color: #697487; }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; max-width: none; }
    .sheet { border: 0; border-radius: 0; box-shadow: none; padding: 20px; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <div class="eyebrow">Living risk register</div>
      <h1>Current portfolio register</h1>
      <div class="subhead">A continuously updated operating register built from saved completed assessments. Use it to scan posture, ownership, last review date, next review due, and the current trend or review state before you open a full result.</div>
      <div class="meta">Generated ${safe(model.createdLabel)} · Point-in-time snapshot. Regenerate after material scenario, evidence, or review changes.</div>
      <div class="summary-grid">
        ${summaryCards.map(item => `<div class="summary-card"><span>${safe(item[0])}</span><strong>${safe(item[1])}</strong></div>`).join('')}
      </div>
      <div class="section-title">Register rows</div>
      <div class="section-copy">Each row stays decision-oriented: current posture, current owner, the latest review point, the next due date, and the trend or review state that most affects what should happen next.</div>
      <div class="register-list">
        ${model.rows.length ? model.rows.map(row => `
          <article class="register-row">
            <div class="register-head">
              <div>
                <div class="register-title">${safe(row.title)}</div>
                <div class="register-meta">${safe(row.buName)} · Owner: ${safe(row.owner)} · Last review: ${safe(row.lastReviewLabel)}</div>
              </div>
              <div class="register-value-grid">
                <div class="register-value"><span>P90 event loss</span><strong>${safe(row.p90LossLabel)}</strong></div>
                <div class="register-value"><span>ALE mean</span><strong>${safe(row.aleMeanLabel)}</strong></div>
              </div>
            </div>
            <div class="chip-row">
              <span class="chip ${safe(row.postureTone)}">${safe(row.postureLabel)}</span>
              <span class="chip ${safe(row.trendTone === 'danger' ? 'danger' : row.trendTone === 'warning' ? 'warning' : row.trendTone === 'success' ? 'success' : 'neutral')}">${safe(row.trendLabel)}</span>
              <span class="chip neutral">${safe(row.lifecycleLabel)}</span>
              <span class="chip ${safe(/due now|overdue/i.test(row.nextReviewLabel) ? 'warning' : 'neutral')}">${safe(row.nextReviewLabel)}</span>
            </div>
            <div class="register-foot">
              <div class="register-note">${safe(row.statusNote || row.nextAction)}</div>
              <div class="register-note"><strong>Next:</strong> ${safe(row.nextAction)}</div>
            </div>
          </article>
        `).join('') : '<div class="register-note">No completed assessments are currently available to populate the register.</div>'}
      </div>
      <div class="footer">Risk Intelligence Platform · Living register export · For operational review and management follow-up.</div>
    </div>
  </div>
</body>
</html>`;
  }

  function exportLivingRiskRegister(assessments, currency = 'USD', fxRate = 3.6725) {
    const model = _buildLivingRiskRegisterModel(assessments, currency, fxRate);
    _openPrintableHtml(_buildLivingRiskRegisterHtml(model), 'living-risk-register');
  }

  function exportLivingRiskRegisterCsv(assessments, currency = 'USD', fxRate = 3.6725) {
    const model = _buildLivingRiskRegisterModel(assessments, currency, fxRate);
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Assessment ID',
      'Scenario Title',
      'Business Unit',
      'Owner',
      'Posture',
      'Trend',
      'Lifecycle',
      'Last Review',
      'Next Review Due',
      'P90 Event Loss',
      'ALE Mean',
      'Next Action'
    ];
    const lines = [
      header.map(escapeCsv).join(','),
      ...model.rows.map(row => [
        row.id,
        row.title,
        row.buName,
        row.owner,
        row.postureLabel,
        row.trendLabel,
        row.lifecycleLabel,
        row.lastReviewLabel,
        row.nextReviewLabel,
        row.p90LossLabel,
        row.aleMeanLabel,
        row.nextAction
      ].map(escapeCsv).join(','))
    ];
    _downloadTextFile(lines.join('\n'), `living-risk-register-${Date.now()}.csv`, 'text/csv;charset=utf-8');
  }


  // ─── PPTX Slide Spec (JSON) ───────────────────────────────
  // [EXPORT-INTEGRATION] Feed this into pptxgenjs to produce real PPTX
  // npm: pptxgenjs; CDN: https://cdn.jsdelivr.net/npm/pptxgenjs/dist/pptxgen.bundle.js
  function exportPPTXSpec(assessment, currency = 'USD', fxRate = 3.6725) {
    const r = assessment.results;
    const fmt = v => _formatCurrency(v, currency, fxRate);
    const intelligence = assessment.assessmentIntelligence || {};
    const confidenceFrame = _buildExecutiveConfidenceFrame(intelligence.confidence, assessment.evidenceQuality, assessment.missingInformation, assessment.citations || []);

    const slideSpec = {
      _note: 'Feed this JSON into pptxgenjs to generate a real PPTX. See README for integration instructions.',
      title: `Risk Intelligence Platform Assessment: ${_resolveAssessmentDisplayTitle(assessment) || 'Assessment'}`,
      slides: [
        {
          slideIndex: 1,
          type: 'cover',
          title: _resolveAssessmentDisplayTitle(assessment) || 'Risk Assessment',
          subtitle: `Business Unit: ${assessment.buName || '—'}`,
          date: new Date().toLocaleDateString('en-AE'),
          footer: 'Risk Intelligence Platform | Pilot report'
        },
        {
          slideIndex: 2,
          type: 'executive_summary',
          title: 'Executive Summary',
          tolerance: r.toleranceBreached ? 'ABOVE TOLERANCE' : 'WITHIN TOLERANCE',
          toleranceColor: r.toleranceBreached ? '#dc2626' : '#059669',
          decisionRead: r.toleranceBreached
            ? 'Escalate and reduce now'
            : r.nearTolerance
              ? 'Actively reduce and review'
              : 'Monitor and improve selectively',
          keyStats: [
            { label: 'Per-Event P90', value: fmt(r.lm.p90) },
            { label: 'Annual P90', value: fmt(r.ale.p90) },
            { label: 'Tolerance Threshold', value: fmt(r.threshold) },
            { label: 'Breach Probability', value: (r.toleranceDetail.lmExceedProb * 100).toFixed(1) + '%' }
          ],
          confidence: confidenceFrame.label,
          confidenceImplication: confidenceFrame.implication
        },
        {
          slideIndex: 3,
          type: 'loss_metrics',
          title: 'Loss Estimates — Monte Carlo Results',
          lmStats: r.lm,
          aleStats: r.ale,
          iterations: r.iterations,
          currency
        },
        {
          slideIndex: 4,
          type: 'scenario_details',
          title: 'Scenario Details',
          scenario: normaliseStructuredScenario(assessment.structuredScenario, { preserveUnknown: true }) || {},
          narrative: (assessment.narrative || '').substring(0, 400)
        },
        {
          slideIndex: 5,
          type: 'recommendations',
          title: 'Recommended Risk Treatments',
          recommendations: (assessment.recommendations || []).slice(0, 4).map((r, i) => ({
            number: i + 1,
            title: r.title,
            impact: r.impact
          }))
        },
        {
          slideIndex: 6,
          type: 'disclaimer',
          title: 'Important Notes',
          points: [
            'This assessment uses Monte Carlo simulation of FAIR methodology inputs.',
            'Input ranges should be validated through expert elicitation for production decisions.',
            'Loss estimates are probabilistic, not deterministic.',
            `Assessment ID: ${assessment.id} | Generated: ${new Date().toLocaleDateString('en-AE')}`,
            'This is a pilot-stage product. Management conclusions should be reviewed against evidence quality, assumptions, and lifecycle status before formal commitment.'
          ]
        }
      ]
    };

    const blob = new Blob([JSON.stringify(slideSpec, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `G42_PPTX_Spec_${assessment.id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return slideSpec;
  }

  function buildBoardNoteHtml(memo) {
    const safe = value => (typeof escapeHtml === 'function'
      ? escapeHtml(String(value ?? ''))
      : String(value ?? ''));
    const postureBadge = memo.postureTone === 'danger'
      ? 'Above tolerance — escalate'
      : memo.postureTone === 'warning'
        ? 'Near tolerance — actively reduce'
        : 'Within tolerance — monitor';
    const decision = String(memo.executiveDecision?.decision || 'Review').trim();
    const rationale = String(memo.executiveDecision?.rationale || '').trim();
    const priority = String(memo.executiveDecision?.priority || '').trim();
    const topGap = String(memo.confidenceFrame?.topGap || 'No major evidence gap recorded.').trim();
    const nextStep = memo.nextStepPlan?.[0];
    const treatmentLine = memo.treatmentDecision
      ? String(memo.treatmentDecision.action || '').trim()
      : '';
    const thresholdCards = [memo.thresholdModel?.single, memo.thresholdModel?.annual].filter(Boolean);
    const impactMix = Array.isArray(memo.impactMix) ? memo.impactMix.slice(0, 4) : [];
    const metrics = Array.isArray(memo.metrics) ? memo.metrics : [];
    const valueSummary = memo.valueSummary || null;
    const postureGlyph = memo.postureTone === 'success' ? '✓' : '!';
    const valueItems = valueSummary
      ? [
          { label: 'Cycle time', value: valueSummary.cycleTime, copy: 'Measured from first saved draft to completed assessment.' },
          { label: 'Internal effort avoided', value: valueSummary.internalHoursAvoided, copy: `Directional effort avoided versus the ${valueSummary.domainLabel.toLowerCase()} baseline.` },
          { label: 'External specialist equivalent', value: valueSummary.externalEquivalentDays, copy: `Directional Big 4-style UAE advisory benchmark for ${valueSummary.complexityLabel.toLowerCase()} work.` },
          {
            label: valueSummary.modelledReduction ? 'Modelled annual reduction' : 'External-equivalent value',
            value: valueSummary.modelledReduction || valueSummary.externalEquivalentValue,
            copy: valueSummary.modelledReductionSource || 'Comparable Big 4-style UAE advisory benchmark, not booked savings.'
          }
        ]
      : [];
    const aiQualitySummary = memo.aiQualitySummary || {
      label: 'Working guidance',
      summary: 'Use the confidence and benchmark layers to decide how much reliance to place on the AI-assisted output.'
    };
    // The original board note read like a plain memo even though the product already had stronger threshold and impact visuals.
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Board Note — ${safe(memo.title)}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --ink: #1a1e1b;
  --ink-mid: rgba(26,30,27,.62);
  --ink-soft: rgba(26,30,27,.38);
  --ink-rule: rgba(26,30,27,.1);
  --surface: #f7f5f2;
  --surface-card: rgba(255,255,255,.72);
  --accent: #03d1a8;
  --danger: #ac432e;
  --warning: #b89a2a;
}
html { font-size: 16px; -webkit-font-smoothing: antialiased; }
body {
  font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
  background: var(--surface);
  color: var(--ink);
  line-height: 1.6;
}
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 56px 44px 68px;
  position: relative;
}
.page::before {
  content: '';
  position: absolute;
  inset: 0 44px auto;
  height: 240px;
  background: radial-gradient(ellipse 70% 52% at 25% 0%, rgba(3,209,168,.08), transparent 70%);
  pointer-events: none;
}
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 30px;
  border-bottom: 1px solid var(--ink-rule);
  margin-bottom: 28px;
  gap: 24px;
}
.doc-header__left { flex: 1; }
.doc-eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin-bottom: 14px;
}
.doc-title {
  font-family: 'Syne', sans-serif;
  font-size: 42px;
  font-weight: 800;
  line-height: 1.05;
  color: var(--ink);
  max-width: 15ch;
  letter-spacing: -.02em;
}
.doc-meta {
  margin-top: 14px;
  font-size: 13px;
  color: var(--ink-mid);
  font-weight: 300;
}
.doc-meta strong { color: var(--ink); font-weight: 600; }
.doc-posture-badge {
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .04em;
  border: 1px solid transparent;
  white-space: nowrap;
  margin-top: 8px;
}
.doc-posture-badge.success {
  background: rgba(3,209,168,.1);
  color: #0b7f68;
  border-color: rgba(3,209,168,.28);
}
.doc-posture-badge.warning {
  background: rgba(184,154,42,.1);
  color: #7a6012;
  border-color: rgba(184,154,42,.28);
}
.doc-posture-badge.danger {
  background: rgba(172,67,46,.08);
  color: var(--danger);
  border-color: rgba(172,67,46,.22);
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, .8fr);
  gap: 20px;
  margin-bottom: 22px;
}
.hero-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid var(--ink-rule);
  background: linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.68));
  box-shadow: 0 18px 40px rgba(18,24,20,.06);
}
.decision-block {
  padding: 34px 36px;
  min-height: 100%;
}
.decision-block::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, var(--ink), rgba(26,30,27,.24));
  border-radius: 4px 0 0 4px;
}
.decision-label,
.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.decision-label { margin-bottom: 12px; }
.section-label {
  margin-bottom: 12px;
  display: block;
}
.decision-headline {
  font-family: 'Syne', sans-serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.16;
  color: var(--ink);
  margin-bottom: 16px;
  letter-spacing: -.01em;
  max-width: 22ch;
}
.decision-rationale {
  font-size: 15px;
  line-height: 1.8;
  color: var(--ink-mid);
  max-width: 62ch;
  font-weight: 300;
  margin-bottom: 18px;
}
.decision-priority {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(26,30,27,.05);
  border: 1px solid var(--ink-rule);
  color: var(--ink);
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--ink-rule);
  background: rgba(26,30,27,.035);
  font-size: 11px;
  font-weight: 700;
  color: rgba(26,30,27,.7);
}
.signal-card {
  padding: 26px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: linear-gradient(180deg, rgba(3,209,168,.06), rgba(255,255,255,.75));
}
.signal-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.signal-note {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-mid);
}
.signal-ring {
  width: 124px;
  height: 124px;
  border-radius: 50%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(26,30,27,.08);
}
.signal-ring.success { background: radial-gradient(circle at center, rgba(3,209,168,.18), rgba(3,209,168,.04) 66%); }
.signal-ring.warning { background: radial-gradient(circle at center, rgba(184,154,42,.18), rgba(184,154,42,.05) 66%); }
.signal-ring.danger { background: radial-gradient(circle at center, rgba(172,67,46,.16), rgba(172,67,46,.04) 66%); }
.signal-ring__inner {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,.9);
  font-family: 'Syne', sans-serif;
  font-size: 30px;
  font-weight: 800;
}
.signal-stack {
  display: grid;
  gap: 12px;
}
.signal-stat {
  padding: 14px 14px 12px;
  border-radius: 16px;
  background: rgba(26,30,27,.035);
  border: 1px solid rgba(26,30,27,.08);
}
.signal-stat__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.signal-stat__copy {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-mid);
}
.signal-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(26,30,27,.08);
  overflow: hidden;
  margin-top: 10px;
}
.signal-track span,
.track-fill,
.mix-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
}
.signal-track span,
.track-fill {
  background: linear-gradient(90deg, var(--accent), rgba(3,209,168,.4));
}
.signal-track.warning span,
.track-fill.warning { background: linear-gradient(90deg, #b89a2a, rgba(184,154,42,.45)); }
.signal-track.danger span,
.track-fill.danger { background: linear-gradient(90deg, var(--danger), rgba(172,67,46,.42)); }
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.metric-card,
.insight-card,
.analysis-card {
  background: linear-gradient(180deg, rgba(255,255,255,.84), rgba(255,255,255,.68));
  border: 1px solid var(--ink-rule);
  border-radius: 18px;
  padding: 22px 20px;
  box-shadow: 0 14px 28px rgba(18,24,20,.04);
}
.metric-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin-bottom: 8px;
}
.metric-value {
  font-family: 'Syne', sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -.02em;
  margin-bottom: 6px;
}
.metric-copy {
  font-size: 12px;
  color: var(--ink-soft);
  line-height: 1.5;
  font-weight: 300;
}
.value-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px 18px;
  border: 1px solid rgba(3,209,168,.16);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(3,209,168,.055), rgba(255,255,255,.62));
}
.value-item {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(26,30,27,.08);
}
.value-item__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.value-item__value {
  margin-top: 8px;
  font-family: 'Syne', sans-serif;
  font-size: 21px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -.02em;
}
.value-item__copy {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink-mid);
}
.snapshot-note {
  margin-bottom: 18px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(26,30,27,.08);
  background: rgba(26,30,27,.035);
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-mid);
}
.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
  gap: 16px;
  margin-bottom: 18px;
}
.analysis-card__title {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: -.02em;
  margin-bottom: 12px;
}
.track-row + .track-row,
.mix-row + .mix-row {
  margin-top: 14px;
}
.track-head,
.mix-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.track-name,
.mix-name {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: rgba(26,30,27,.54);
}
.track-status {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  background: rgba(26,30,27,.05);
  border: 1px solid rgba(26,30,27,.08);
}
.track-status.success {
  color: #0b7f68;
  background: rgba(3,209,168,.1);
  border-color: rgba(3,209,168,.24);
}
.track-status.warning {
  color: #7a6012;
  background: rgba(184,154,42,.12);
  border-color: rgba(184,154,42,.24);
}
.track-status.danger {
  color: var(--danger);
  background: rgba(172,67,46,.08);
  border-color: rgba(172,67,46,.22);
}
.track {
  height: 12px;
  border-radius: 999px;
  background: rgba(26,30,27,.08);
  overflow: hidden;
  margin-top: 10px;
}
.track-foot,
.mix-foot,
.body-copy {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-mid);
  font-weight: 300;
}
.body-copy strong,
.mix-foot strong {
  color: var(--ink);
  font-weight: 700;
}
.mix-bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(26,30,27,.08);
  overflow: hidden;
  margin-top: 8px;
}
.mix-bar span {
  background: linear-gradient(90deg, var(--accent), rgba(3,209,168,.35));
}
.insight-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.insight-card--wide { grid-column: 1 / -1; }
.doc-footer {
  font-size: 11px;
  color: var(--ink-soft);
  border-top: 1px solid var(--ink-rule);
  padding-top: 24px;
  margin-top: 40px;
  font-weight: 300;
  letter-spacing: .02em;
}
@media (max-width: 820px) {
  .page { padding: 40px 24px 48px; }
  .page::before { inset: 0 24px auto; }
  .hero-grid,
  .analysis-grid,
  .metrics-grid,
  .value-strip,
  .insight-grid { grid-template-columns: 1fr; }
  .insight-card--wide { grid-column: auto; }
}
@media print {
  body { background: #fff; }
  .page { padding: 32px 24px; }
  .page::before { display: none; }
  .hero-card,
  .metric-card,
  .value-item,
  .analysis-card,
  .insight-card { break-inside: avoid; }
}
</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div class="doc-header__left">
      <div class="doc-eyebrow">Board note · Risk scenario · ${safe(memo.completedLabel)}</div>
      <h1 class="doc-title">${safe(memo.title)}</h1>
      <div class="doc-meta"><strong>${safe(memo.businessContext)}</strong></div>
    </div>
    <span class="doc-posture-badge ${memo.postureTone}">${safe(postureBadge)}</span>
  </div>

  <div class="snapshot-note"><strong>AI quality:</strong> ${safe(aiQualitySummary.label)}. ${safe(aiQualitySummary.summary)}<br><strong>Export note:</strong> ${safe(memo.exportSnapshotNote || 'This export is a point-in-time snapshot. Regenerate it after material changes.')}</div>

  <div class="hero-grid">
    <div class="hero-card decision-block">
      <div class="decision-label">Management action</div>
      <div class="decision-headline">${safe(decision)}</div>
      <p class="decision-rationale">${safe(rationale)}</p>
      ${priority ? `<div class="decision-priority">→ ${safe(priority)}</div>` : ''}
      <div class="chip-row">
        <span class="chip">${safe(memo.posture)}</span>
        <span class="chip">${safe(memo.confidenceFrame?.label || 'Confidence review')}</span>
        <span class="chip">${safe(memo.businessContext)}</span>
      </div>
    </div>

    <div class="hero-card signal-card">
      <div>
        <div class="signal-title">At a glance</div>
        <div class="signal-note">${safe(memo.thresholdModel?.single?.summary || memo.executiveDecision?.rationale || 'Review the tolerance position before formal commitment.')}</div>
      </div>
      <div class="signal-ring ${memo.postureTone}">
        <div class="signal-ring__inner">${safe(postureGlyph)}</div>
      </div>
      <div class="signal-stack">
        ${thresholdCards.slice(0, 2).map(item => `
          <div class="signal-stat">
            <div class="signal-stat__label">${safe(item.title)}</div>
            <div class="signal-stat__copy">${safe(item.status)} · ${safe(item.summary)}</div>
            <div class="signal-track ${item.statusTone === 'success' ? '' : item.statusTone}"><span style="width:${Math.max(0, Math.min(Number(item.ratio || 0), 100))}%"></span></div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <div class="metrics-grid">
    ${metrics.map(item => `
      <div class="metric-card">
        <div class="metric-label">${safe(item.label)}</div>
        <div class="metric-value">${safe(item.value)}</div>
        <div class="metric-copy">${safe(item.copy)}</div>
      </div>`).join('')}
  </div>

  ${valueItems.length ? `
  <div class="value-strip">
    ${valueItems.map(item => `<div class="value-item"><div class="value-item__label">${safe(item.label)}</div><div class="value-item__value">${safe(item.value)}</div><div class="value-item__copy">${safe(item.copy)}</div></div>`).join('')}
  </div>` : ''}

  <div class="analysis-grid">
    <div class="analysis-card">
      <div class="section-label">Tolerance interpretation</div>
      <div class="analysis-card__title">How this sits against governance limits</div>
      ${thresholdCards.map(item => `
        <div class="track-row">
          <div class="track-head">
            <div class="track-name">${safe(item.title)}</div>
            <span class="track-status ${item.statusTone}">${safe(item.status)}</span>
          </div>
          <div class="track"><span class="track-fill ${item.statusTone === 'success' ? '' : item.statusTone}" style="width:${Math.max(0, Math.min(Number(item.ratio || 0), 100))}%"></span></div>
          <div class="track-foot">${safe(item.summary)}</div>
        </div>`).join('')}
    </div>

    <div class="analysis-card">
      <div class="section-label">Main drivers of impact</div>
      <div class="analysis-card__title">Where the exposure is concentrated</div>
      ${impactMix.length
        ? impactMix.map(item => `
          <div class="mix-row">
            <div class="mix-head">
              <div class="mix-name">${safe(item.label)}</div>
              <strong>${safe(item.valueLabel || item.value)}</strong>
            </div>
            <div class="mix-bar"><span style="width:${Math.max(0, Math.min(Number(item.width || 0), 100))}%"></span></div>
            <div class="mix-foot">This component contributes <strong>${safe(item.valueLabel || item.value)}</strong> of the current scenario view.</div>
          </div>`).join('')
        : `<div class="body-copy">No material impact mix is available for this scenario yet.</div>`}
    </div>
  </div>

  <div class="insight-grid">
    <div class="insight-card insight-card--wide">
      <span class="section-label">Scenario</span>
      <div class="body-copy">${safe(memo.scenarioSummary)}</div>
    </div>

    ${nextStep ? `
    <div class="insight-card">
      <span class="section-label">Next step required</span>
      <div class="body-copy"><strong>${safe(nextStep.title)}</strong><br>${safe(nextStep.copy)}</div>
    </div>` : ''}

    <div class="insight-card">
      <span class="section-label">Biggest caveat</span>
      <div class="body-copy">${safe(topGap)}</div>
    </div>

    ${treatmentLine ? `
    <div class="insight-card insight-card--wide">
      <span class="section-label">Treatment path</span>
      <div class="body-copy">${safe(treatmentLine)}</div>
    </div>` : ''}
  </div>

  <div class="doc-footer">
    Risk Intelligence Platform · ${safe(memo.completedLabel)} ·
    Confidence: ${safe(memo.confidenceFrame?.label || 'Moderate')} ·
    For management discussion only. Validate assumptions before
    formal commitment. ${safe(memo.exportSnapshotNote || 'This export is a point-in-time snapshot. Regenerate it after material changes.')}
  </div>
</div>
</body>
</html>`;
  }

  function buildPortfolioBoardBriefHtml(model = {}) {
    const safe = value => (typeof escapeHtml === 'function'
      ? escapeHtml(String(value ?? ''))
      : String(value ?? ''));
    const topRisks = Array.isArray(model?.topRisks) ? model.topRisks : [];
    const scopeLabel = String(model?.scopeLabel || 'Portfolio scope not stated').trim();
    const generatedLabel = String(model?.generatedLabel || new Date().toLocaleDateString('en-AE')).trim();
    const portfolioSummary = String(model?.portfolioSummary || '').trim();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Board Brief — ${safe(scopeLabel)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin:0; font-family:'DM Sans','Segoe UI',Arial,sans-serif; background:#f6f4f1; color:#212822; }
  .page { max-width:960px; margin:0 auto; padding:42px 32px 56px; }
  .sheet { background:#fbfaf8; border:1px solid rgba(33,40,34,.12); border-radius:24px; padding:32px; box-shadow:0 18px 54px rgba(18,24,20,.08); }
  .eyebrow { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:rgba(33,40,34,.55); margin-bottom:12px; }
  h1, h2 { font-family:'Syne','Avenir Next','Segoe UI',sans-serif; margin:0; color:#212822; }
  h1 { font-size:38px; line-height:1.05; max-width:14ch; }
  h2 { font-size:18px; margin-bottom:10px; }
  .meta { margin-top:12px; font-size:13px; color:rgba(33,40,34,.68); }
  .hero { margin-top:24px; padding:24px; border-radius:20px; background:linear-gradient(180deg, rgba(3,209,168,.08), rgba(255,255,255,.72)); border:1px solid rgba(3,209,168,.18); }
  .hero strong { display:block; font-size:24px; line-height:1.35; }
  .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-top:20px; }
  .card { background:rgba(255,255,255,.76); border:1px solid rgba(33,40,34,.1); border-radius:18px; padding:20px; }
  .body { font-size:14px; line-height:1.75; color:rgba(33,40,34,.82); }
  .risk + .risk { margin-top:14px; padding-top:14px; border-top:1px solid rgba(33,40,34,.08); }
  .risk-name { font-weight:700; font-size:15px; color:#212822; }
  .risk-action { margin-top:6px; font-size:13px; color:#0f766e; }
  .summary { margin-top:20px; padding:16px 18px; border-radius:18px; background:rgba(33,40,34,.035); border:1px solid rgba(33,40,34,.08); font-size:12px; line-height:1.7; color:rgba(33,40,34,.72); }
  .footer { margin-top:28px; padding-top:18px; border-top:1px solid rgba(33,40,34,.1); font-size:11px; color:rgba(33,40,34,.52); }
  @media (max-width: 820px) {
    .page { padding:28px 18px 40px; }
    .grid { grid-template-columns:1fr; }
  }
  @media print {
    body { background:#fff; }
    .page { padding:20px 0 0; }
    .sheet, .card, .hero { box-shadow:none; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="sheet">
      <div class="eyebrow">Board brief · ${safe(generatedLabel)}</div>
      <h1>${safe(scopeLabel)}</h1>
      <div class="meta">Risk Intelligence Platform · Portfolio-level executive narrative</div>
      <div class="hero">
        <div class="eyebrow">Headline</div>
        <strong>${safe(model?.headline || 'No headline generated')}</strong>
      </div>
      <div class="grid">
        <div class="card">
          <div class="eyebrow">Top 3 risks</div>
          ${topRisks.length ? topRisks.map(item => `
            <div class="risk">
              <div class="risk-name">${safe(item?.name || 'Risk')}</div>
              <div class="body">${safe(item?.description || '')}</div>
              <div class="risk-action"><strong>Recommended action:</strong> ${safe(item?.action || '')}</div>
            </div>
          `).join('') : '<div class="body">No top risks were generated.</div>'}
        </div>
        <div class="card">
          <div class="eyebrow">Portfolio health</div>
          <div class="body">${safe(model?.portfolioHealth || 'Portfolio health was not generated.')}</div>
          <div class="eyebrow" style="margin-top:18px">Decision needed</div>
          <div class="body">${safe(model?.decisionNeeded || 'No decision recommendation was generated.')}</div>
        </div>
      </div>
      ${portfolioSummary ? `<div class="summary"><strong>Portfolio basis:</strong><br>${safe(portfolioSummary).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="footer">Generated by Risk Intelligence Platform. This board brief is a point-in-time portfolio view and should be regenerated after material assessment, treatment, or review changes.</div>
    </div>
  </div>
</body>
</html>`;
  }

  function exportPortfolioBoardBrief(model = {}) {
    _openPrintableHtml(buildPortfolioBoardBriefHtml(model), 'portfolio-board-brief');
  }

  return {
    exportJSON,
    exportDataAsJson,
    importJsonFile,
    exportPDF,
    generatePdfReport,
    exportPPTXSpec,
    exportDecisionMemo,
    exportBoardNote,
    exportPortfolioBoardBrief,
    exportLivingRiskRegister,
    exportLivingRiskRegisterCsv,
    buildDecisionMemoModel
  };
})();
