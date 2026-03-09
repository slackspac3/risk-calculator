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
  function _formatCurrency(value, currency, fxRate) {
    const v = currency === 'AED' ? value * fxRate : value;
    const suffix = currency === 'AED' ? ' AED' : '';
    if (v >= 1_000_000) return (currency === 'AED' ? 'AED ' : '$') + (v / 1_000_000).toFixed(2) + 'M' + (currency === 'AED' ? '' : '');
    if (v >= 1_000)     return (currency === 'AED' ? 'AED ' : '$') + (v / 1_000).toFixed(0) + 'K';
    return (currency === 'AED' ? 'AED ' : '$') + v.toFixed(0);
  }

  // ─── JSON Export ─────────────────────────────────────────
  function exportJSON(assessment) {
    const blob = new Blob([JSON.stringify(assessment, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `G42_RiskAssessment_${assessment.id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Print-Ready HTML Report ─────────────────────────────
  // [EXPORT-INTEGRATION] Replace with jsPDF + autoTable for true PDF
  function exportPDF(assessment, currency = 'USD', fxRate = 3.6725) {
    const r = assessment.results;
    const fmt = v => _formatCurrency(v, currency, fxRate);
    const threshold = currency === 'AED' ? r.threshold * fxRate : r.threshold;
    const threshFmt = fmt(r.threshold);
    const d = new Date().toLocaleDateString('en-AE', { year:'numeric', month:'long', day:'numeric' });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>G42 Risk Quantifier — ${assessment.scenarioTitle || 'Assessment'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700&family=DM+Sans:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; color: #1f2937; background: #fff; font-size: 14px; line-height: 1.6; }
  .page { max-width: 800px; margin: 0 auto; padding: 48px; }
  h1, h2, h3 { font-family: 'Syne', serif; }
  h1 { font-size: 28px; color: #0d2040; margin-bottom: 4px; }
  h2 { font-size: 18px; color: #0d2040; margin: 32px 0 12px; border-bottom: 2px solid #1040a0; padding-bottom: 6px; }
  h3 { font-size: 15px; color: #1f2937; margin-bottom: 6px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #0d2040; }
  .logo { font-family: 'Syne', serif; font-size: 22px; font-weight: 700; color: #0d2040; }
  .logo span { color: #1040a0; }
  .poc-tag { font-size: 11px; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 4px 10px; border-radius: 100px; font-weight: 600; }
  .meta { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .tol-banner { padding: 16px 20px; border-radius: 10px; margin: 16px 0; font-weight: 600; font-size: 16px; }
  .tol-above { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .tol-within { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
  .metric { background: #f3f4f6; padding: 16px; border-radius: 10px; }
  .m-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; font-weight: 600; }
  .m-value { font-family: 'Syne', serif; font-size: 22px; font-weight: 700; color: #0d2040; margin-top: 4px; }
  .m-sub { font-size: 11px; color: #9ca3af; }
  .rec { margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; }
  .rec-title { font-weight: 700; color: #0d2040; font-family: 'Syne', serif; }
  .rec-why { font-size: 13px; color: #4b5563; margin-top: 6px; }
  .rec-impact { font-size: 12px; color: #059669; margin-top: 6px; font-weight: 600; }
  .cite { display: inline-block; font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 100px; margin: 2px; }
  .scenario-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sc-item { background: #f9fafb; padding: 12px 16px; border-radius: 8px; }
  .sc-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; font-weight: 600; }
  .sc-value { font-size: 13px; color: #1f2937; margin-top: 2px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 24px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">G42 <span>Risk Quantifier</span></div>
      <div class="meta">Cyber & Technology Risk Assessment | ${d}</div>
    </div>
    <div class="poc-tag">⚠ PoC — Not for production decisions</div>
  </div>

  <h1>${assessment.scenarioTitle || 'Risk Assessment'}</h1>
  <div class="meta">Business Unit: <strong>${assessment.buName || '—'}</strong> | Assessment ID: ${assessment.id}</div>
  
  <div class="tol-banner ${r.toleranceBreached ? 'tol-above' : 'tol-within'}">
    ${r.toleranceBreached
      ? `⚠ ABOVE TOLERANCE — Per-event loss P90 (${fmt(r.lm.p90)}) exceeds the ${threshFmt} threshold.`
      : `✓ WITHIN TOLERANCE — Per-event loss P90 (${fmt(r.lm.p90)}) is within the ${threshFmt} threshold.`}
  </div>

  <h2>Key Loss Metrics</h2>
  <div class="metrics">
    <div class="metric"><div class="m-label">Per-Event P50</div><div class="m-value">${fmt(r.lm.p50)}</div><div class="m-sub">Median loss per event</div></div>
    <div class="metric"><div class="m-label">Per-Event P90</div><div class="m-value">${fmt(r.lm.p90)}</div><div class="m-sub">90th percentile</div></div>
    <div class="metric"><div class="m-label">Per-Event Mean</div><div class="m-value">${fmt(r.lm.mean)}</div><div class="m-sub">Expected loss</div></div>
    <div class="metric"><div class="m-label">Annual P50 (ALE)</div><div class="m-value">${fmt(r.ale.p50)}</div><div class="m-sub">Median annual exposure</div></div>
    <div class="metric"><div class="m-label">Annual P90 (ALE)</div><div class="m-value">${fmt(r.ale.p90)}</div><div class="m-sub">Tail annual exposure</div></div>
    <div class="metric"><div class="m-label">Annual Mean</div><div class="m-value">${fmt(r.ale.mean)}</div><div class="m-sub">Expected annual loss</div></div>
  </div>
  <div class="meta">Simulation: ${r.iterations.toLocaleString()} Monte Carlo iterations | Currency: ${currency} | Threshold: ${threshFmt}</div>

  <h2>Scenario Details</h2>
  ${assessment.structuredScenario ? `<div class="scenario-grid">
    <div class="sc-item"><div class="sc-label">Asset / Service</div><div class="sc-value">${assessment.structuredScenario.assetService}</div></div>
    <div class="sc-item"><div class="sc-label">Threat Community</div><div class="sc-value">${assessment.structuredScenario.threatCommunity}</div></div>
    <div class="sc-item"><div class="sc-label">Attack Type</div><div class="sc-value">${assessment.structuredScenario.attackType}</div></div>
    <div class="sc-item"><div class="sc-label">Effect</div><div class="sc-value">${assessment.structuredScenario.effect}</div></div>
  </div>` : ''}

  ${assessment.citations && assessment.citations.length ? `<h2>Citations</h2>
  <div>${assessment.citations.map(c => `<span class="cite">?? ${c.title}</span>`).join('')}</div>` : ''}

  <h2>Recommendations</h2>
  ${(assessment.recommendations || []).map((rec, i) => `
  <div class="rec">
    <div class="rec-title">${i+1}. ${rec.title}</div>
    <div class="rec-why">${rec.why}</div>
    <div class="rec-impact">⬆ Expected Impact: ${rec.impact}</div>
  </div>`).join('')}

  <div class="footer">
    Generated by G42 Tech & Cyber Risk Quantifier PoC | Replace FAIR inputs with expert elicitation for production use.
    This report uses Monte Carlo simulation of FAIR-methodology inputs and should be validated by a qualified risk analyst.
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, '_blank');
    if (!w) {
      // Fallback: download HTML
      const a = document.createElement('a');
      a.href = url;
      a.download = `G42_Risk_Report_${assessment.id || Date.now()}.html`;
      a.click();
    }
    URL.revokeObjectURL(url);
  }

  // ─── PPTX Slide Spec (JSON) ───────────────────────────────
  // [EXPORT-INTEGRATION] Feed this into pptxgenjs to produce real PPTX
  // npm: pptxgenjs; CDN: https://cdn.jsdelivr.net/npm/pptxgenjs/dist/pptxgen.bundle.js
  function exportPPTXSpec(assessment, currency = 'USD', fxRate = 3.6725) {
    const r = assessment.results;
    const fmt = v => _formatCurrency(v, currency, fxRate);

    const slideSpec = {
      _note: 'Feed this JSON into pptxgenjs to generate a real PPTX. See README for integration instructions.',
      title: `G42 Cyber Risk Assessment: ${assessment.scenarioTitle || 'Assessment'}`,
      slides: [
        {
          slideIndex: 1,
          type: 'cover',
          title: assessment.scenarioTitle || 'Risk Assessment',
          subtitle: `Business Unit: ${assessment.buName || '—'}`,
          date: new Date().toLocaleDateString('en-AE'),
          footer: 'G42 Tech & Cyber Risk Quantifier | PoC'
        },
        {
          slideIndex: 2,
          type: 'executive_summary',
          title: 'Executive Summary',
          tolerance: r.toleranceBreached ? 'ABOVE TOLERANCE' : 'WITHIN TOLERANCE',
          toleranceColor: r.toleranceBreached ? '#dc2626' : '#059669',
          keyStats: [
            { label: 'Per-Event P90', value: fmt(r.lm.p90) },
            { label: 'Annual P90', value: fmt(r.ale.p90) },
            { label: 'Tolerance Threshold', value: fmt(r.threshold) },
            { label: 'Breach Probability', value: (r.toleranceDetail.lmExceedProb * 100).toFixed(1) + '%' }
          ]
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
          scenario: assessment.structuredScenario || {},
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
            'This is a Proof of Concept tool. Replace shared password auth with Entra ID before production use.'
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

  return { exportJSON, exportPDF, exportPPTXSpec };
})();
