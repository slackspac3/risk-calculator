function formatStep1ProjectExposureAmount(value, currency = 'USD') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'Unknown';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: String(currency || 'USD').trim() || 'USD',
      maximumFractionDigits: 0
    }).format(parsed);
  } catch {
    return `${String(currency || 'USD').trim() || 'USD'} ${Math.round(parsed).toLocaleString()}`;
  }
}

function formatStep1ProjectExposureStatus(value = '') {
  return String(value || 'unknown').replace(/_/g, ' ');
}

function renderStep1ProjectExposureList(title, items = [], emptyText = 'None yet') {
  const values = (Array.isArray(items) ? items : []).map(item => {
    if (item && typeof item === 'object') return String(item.label || item.field || item.suggestedQuestion || '').trim();
    return String(item || '').trim();
  }).filter(Boolean);
  return `<div class="step1-project-exposure__mini-list">
    <span>${escapeHtml(title)}</span>
    <strong>${values.length ? escapeHtml(values.slice(0, 4).join(', ')) : escapeHtml(emptyText)}</strong>
  </div>`;
}

function renderStep1ProjectFinancialDrivers(exposure = {}, currency = 'USD') {
  const drivers = Array.isArray(exposure.financialDrivers) ? exposure.financialDrivers.slice(0, 6) : [];
  if (!drivers.length) {
    return '<div class="step1-project-exposure__empty">No quantified project drivers yet. Unknown mechanisms can still continue as missing inputs or stress cases.</div>';
  }
  return `<div class="step1-project-exposure__drivers">
    ${drivers.map(driver => {
      const status = String(driver.driverStatus || 'unquantified_driver');
      const isUnknown = status === 'unquantified_driver' || driver.likely === null || driver.likely === undefined;
      const label = driver.label || driver.id || 'Project driver';
      const amount = isUnknown ? 'Unknown' : formatStep1ProjectExposureAmount(driver.likely, currency);
      return `<div class="step1-project-exposure-driver">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(formatStep1ProjectExposureStatus(status))} · ${escapeHtml(formatStep1ProjectExposureStatus(driver.confidence || 'unknown'))}</span>
        </div>
        <b class="${isUnknown ? 'is-unknown' : ''}">${escapeHtml(amount)}</b>
      </div>`;
    }).join('')}
  </div>`;
}

function renderStep1ProjectExposureMissingInputs(exposure = {}) {
  const items = Array.isArray(exposure.missingInputs) ? exposure.missingInputs.slice(0, 6) : [];
  if (!items.length) {
    return '<div class="step1-project-exposure__empty">No high-impact missing inputs are currently flagged.</div>';
  }
  return `<div class="step1-project-exposure__missing">
    ${items.map(item => {
      const field = String(item.field || '').trim();
      return `<div class="step1-project-exposure-missing">
        <div>
          <strong>${escapeHtml(item.label || field || 'Missing input')}</strong>
          <span>${escapeHtml(item.suggestedQuestion || item.whyItMatters || 'Confirm this value or mark it as not applicable.')}</span>
          <div class="citation-chips mt-2" aria-label="Optional project exposure correction reason">
            ${STEP1_PROJECT_EXPOSURE_CORRECTION_REASONS.slice(0, 5).map((reason) => `
              <button type="button" class="btn btn--ghost btn--sm" data-project-exposure-correction-reason="${escapeHtml(reason.key)}" data-project-exposure-field="${escapeHtml(field)}" aria-pressed="false">${escapeHtml(reason.label)}</button>
            `).join('')}
          </div>
        </div>
        <div class="step1-project-exposure-missing__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-project-exposure-missing-action="not_applicable" data-project-exposure-field="${escapeHtml(field)}">Not applicable</button>
          <button type="button" class="btn btn--ghost btn--sm" data-project-exposure-missing-action="estimated" data-project-exposure-field="${escapeHtml(field)}">Estimated</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderStep1ProjectExposurePanel(scope = 'buyer', draft = AppState.draft || {}) {
  const storedExposure = draft.projectExposure && typeof draft.projectExposure === 'object' ? draft.projectExposure : {};
  const currentFingerprint = buildStep1ProjectExposureFingerprint(scope, draft);
  const currentFingerprintBreakdown = buildStep1ProjectExposureFingerprintBreakdown(scope, draft);
  const savedAiState = typeof AiProductStateService !== 'undefined' && AiProductStateService?.buildAiOutputState
    ? AiProductStateService.buildAiOutputState({
        key: 'projectExposure',
        label: 'Project exposure map',
        output: storedExposure,
        currentFingerprint,
        currentFingerprintBreakdown
      })
    : null;
  const exposure = ensureStep1ProjectExposurePreview(scope, draft, { persist: false }) || {};
  const quality = exposure.projectInputQuality && typeof exposure.projectInputQuality === 'object' ? exposure.projectInputQuality : {};
  const currency = draft.projectContext?.currency || 'USD';
  const isSeller = scope === 'seller';
  const helper = isSeller
    ? 'This exposure map separates revenue at risk, margin at risk, delivery cost, penalties, termination, and recoveries. Unknown values will be carried forward as assumptions or stress cases.'
    : 'This exposure map estimates incremental project impact such as delay cost, reprocurement premium, sunk cost, and recoveries. Unknown values will be carried forward as assumptions or stress cases.';
  const sourceMode = String(exposure.sourceMode || (exposure.usedFallback ? 'deterministic_fallback' : '') || 'deterministic_preview');
  const sourceLabel = sourceMode === 'live'
    ? 'Live AI'
    : sourceMode === 'deterministic_fallback'
      ? 'Deterministic fallback'
      : sourceMode === 'benchmark_proxy'
        ? 'Benchmark proxy'
        : 'Deterministic preview';
  const hasAiMap = sourceMode === 'live' || sourceMode === 'deterministic_fallback';
  const savedMapStale = savedAiState?.freshnessStatus === 'stale';
  const savedMapFreshness = savedAiState?.hasOutput
    ? `<span class="badge badge--${savedAiState.freshnessTone || 'neutral'}">${escapeHtml(savedAiState.freshnessLabel)}</span>`
    : '';
  return `<section class="step1-project-exposure card" data-project-exposure-panel="${escapeHtml(scope)}">
    <div class="step1-project-exposure__head">
      <div>
        <div class="wizard-summary-band__label">Project financial exposure</div>
        <h4>Map the project economics without blocking progress</h4>
        <p>${escapeHtml(helper)}</p>
      </div>
      <div class="step1-project-exposure__badges">
        <span class="badge badge--neutral">${escapeHtml(sourceLabel)}</span>
        ${savedMapFreshness}
        ${savedAiState?.generatedLabel ? `<span class="badge badge--neutral">${escapeHtml(savedAiState.generatedLabel)}</span>` : ''}
        ${exposure.aiUnavailable ? '<span class="badge badge--warning">AI unavailable</span>' : ''}
      </div>
    </div>
    ${savedMapStale ? `<div class="ai-product-state-strip ${savedAiState.freshnessSeverity === 'critical' ? 'ai-product-state-strip--danger' : 'ai-product-state-strip--warning'}">
      <div>
        <strong>${escapeHtml(savedAiState.recommendedAction)}</strong>
        <span>${escapeHtml(savedAiState.refreshReason || 'Project inputs changed since the saved AI map was generated.')}</span>
      </div>
      <span class="badge badge--${savedAiState.freshnessSeverity === 'critical' ? 'danger' : 'warning'}">${escapeHtml(savedAiState.freshnessLabel || 'Smart prompt')}</span>
    </div>` : ''}
    <div class="step1-project-exposure__quality">
      <div>
        <span>Input quality</span>
        <strong>${escapeHtml(quality.label || 'Thin project economics')}</strong>
      </div>
      <b>${escapeHtml(String(Number.isFinite(Number(quality.score)) ? Math.round(Number(quality.score)) : 0))}/100</b>
    </div>
    <p class="step1-project-exposure__summary">${escapeHtml(exposure.projectExposureSummary || 'Sparse project economics can continue. Unknown values are carried forward as uncertainty, not zero.')}</p>
    <div class="step1-project-exposure__knowns">
      ${renderStep1ProjectExposureList('Known values', quality.knownHighImpactInputs, 'None yet')}
      ${renderStep1ProjectExposureList('Estimated values', quality.estimatedHighImpactInputs, 'None yet')}
      ${renderStep1ProjectExposureList('Unknown high-impact inputs', quality.unknownHighImpactInputs, 'None flagged')}
    </div>
    ${renderStep1ProjectFinancialDrivers(exposure, currency)}
    <details class="wizard-disclosure wizard-disclosure--compact step1-project-exposure__details">
      <summary>Caps, offsets, warnings, and risk buckets <span class="badge badge--neutral">Review</span></summary>
      <div class="wizard-disclosure-body step1-project-exposure__detail-grid">
        ${renderStep1ProjectExposureList('Caps and offsets', (exposure.capsAndOffsets || []).map(item => item.type || item.label), 'None recorded')}
        ${renderStep1ProjectExposureList('Double-counting warnings', exposure.doubleCountingWarnings, 'No warnings')}
        ${renderStep1ProjectExposureList('Risk buckets', Object.keys(exposure.mapsToRiskParameters || {}), 'No quantified bucket mapping yet')}
      </div>
    </details>
    <div class="step1-project-exposure__missing-wrap">
      <div class="step1-project-exposure__section-title">
        <strong>Missing high-impact inputs</strong>
        <span>You can continue. The next step will estimate with uncertainty and flag what matters most.</span>
      </div>
      ${renderStep1ProjectExposureMissingInputs(exposure)}
    </div>
    <div class="step1-project-exposure__actions">
      <button type="button" class="btn btn--primary btn--sm" data-project-exposure-action="generate">${savedMapStale || hasAiMap ? 'Refresh exposure map' : 'Generate AI exposure map'}</button>
      <button type="button" class="btn btn--secondary btn--sm" data-project-exposure-action="continue">Continue with uncertainty</button>
      <button type="button" class="btn btn--ghost btn--sm" data-project-exposure-action="details">Add more details</button>
      <button type="button" class="btn btn--ghost btn--sm" data-project-exposure-action="benchmarks">Use benchmark proxies where available</button>
      <button type="button" class="btn btn--ghost btn--sm" data-project-exposure-action="upload">Upload contract/business case/evidence</button>
    </div>
  </section>`;
}
