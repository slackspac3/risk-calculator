const RESULTS_TAB_SESSION_PREFIX = 'rq_results_tab__';
const VALID_RESULTS_TABS = ['executive', 'technical', 'appendix'];
const BOARDROOM_SESSION_PREFIX = 'rq_boardroom__';
const RESULTS_AI_ACTION_COOLDOWN_MS = 4000;
const _resultsAiActionCooldowns = typeof AiWorkflowClient !== 'undefined' && AiWorkflowClient && typeof AiWorkflowClient.createActionCooldownStore === 'function'
  ? AiWorkflowClient.createActionCooldownStore({ cooldownMs: RESULTS_AI_ACTION_COOLDOWN_MS, maxEntries: 48 })
  : null;

function resolveResultsReviewQueueApiUrl(query = '') {
  const resolver = (typeof window !== 'undefined' && window?.ApiOriginResolver)
    || globalThis?.ApiOriginResolver
    || null;
  const safeQuery = String(query || '').trim();
  const path = safeQuery
    ? `/api/review-queue${safeQuery.startsWith('?') ? safeQuery : `?${safeQuery}`}`
    : '/api/review-queue';
  return resolver && typeof resolver.resolveApiUrl === 'function'
    ? resolver.resolveApiUrl(path)
    : path;
}

function setResultsAiActionBusy(button, busyLabel) {
  if (!button) return () => {};
  const idleLabel = String(button.dataset.idleLabel || button.textContent || '').trim() || String(button.textContent || '').trim();
  button.dataset.idleLabel = idleLabel;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = busyLabel;
  return () => {
    if (!button.isConnected) return;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = idleLabel;
  };
}

function flashResultsAiActionCooldown(button, label, durationMs = 1200) {
  if (!button) return;
  const idleLabel = String(button.dataset.idleLabel || button.textContent || '').trim() || String(button.textContent || '').trim();
  button.dataset.idleLabel = idleLabel;
  button.disabled = true;
  button.removeAttribute('aria-busy');
  button.textContent = String(label || '').trim() || idleLabel;
  window.setTimeout(() => {
    if (!button.isConnected) return;
    button.disabled = false;
    button.textContent = idleLabel;
  }, Math.max(400, Number(durationMs || 0)));
}

function getResultsAiActionScope(actionKey = '', assessment = null, fallbackId = '') {
  const assessmentId = String(assessment?.id || fallbackId || '').trim()
    || String(assessment?.scenarioTitle || '').trim();
  return `${String(actionKey || '').trim()}::${assessmentId}`;
}

function guardResultsAiActionCooldown({
  button = null,
  actionKey = '',
  endpoint = '',
  payload = {},
  assessment = null,
  fallbackId = '',
  cooldownLabel = 'Loaded just now',
  message = 'This AI result already reflects the current inputs. Review it or change the inputs before rerunning.'
} = {}) {
  if (!_resultsAiActionCooldowns) return false;
  const scope = getResultsAiActionScope(actionKey, assessment, fallbackId);
  const remainingMs = _resultsAiActionCooldowns.getRemainingMs(endpoint, payload, { scope });
  if (!remainingMs) return false;
  flashResultsAiActionCooldown(button, cooldownLabel, Math.min(remainingMs, 1400));
  UI.toast(message, 'info', 3500);
  return true;
}

function markResultsAiActionCooldown(actionKey = '', endpoint = '', payload = {}, assessment = null, fallbackId = '') {
  if (!_resultsAiActionCooldowns) return 0;
  const scope = getResultsAiActionScope(actionKey, assessment, fallbackId);
  return _resultsAiActionCooldowns.markCompleted(endpoint, payload, { scope });
}

function persistResultsTabPreference(nextTab) {
  const tab = String(nextTab || '').trim();
  if (!VALID_RESULTS_TABS.includes(tab)) return;
  try {
    const username = AuthService.getCurrentUser()?.username || '';
    if (username) {
      sessionStorage.setItem(RESULTS_TAB_SESSION_PREFIX + username, tab);
    }
  } catch {}
}

function getPersistedResultsTabPreference() {
  try {
    const username = AuthService.getCurrentUser()?.username || '';
    const storedTab = username
      ? (sessionStorage.getItem(RESULTS_TAB_SESSION_PREFIX + username) || '')
      : '';
    return VALID_RESULTS_TABS.includes(storedTab) ? storedTab : '';
  } catch {
    return '';
  }
}

function resolveResultsAssessmentId(id = '') {
  return String(
    AppState.currentResultsId
    || Router.getCurrentParams()?.id
    || id
    || ''
  ).trim();
}

function restoreBoardroomModePreference(id = '') {
  try {
    const assessmentId = resolveResultsAssessmentId(id);
    if (assessmentId) {
      AppState.resultsBoardroomMode =
        sessionStorage.getItem(BOARDROOM_SESSION_PREFIX + assessmentId) === '1';
    }
  } catch {}
}

function persistBoardroomModePreference(id = '') {
  try {
    const assessmentId = resolveResultsAssessmentId(id);
    if (assessmentId) {
      const key = BOARDROOM_SESSION_PREFIX + assessmentId;
      if (AppState.resultsBoardroomMode) {
        sessionStorage.setItem(key, '1');
      } else {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

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
  const hasToleranceData = results?.toleranceDetail != null
    && typeof results.toleranceDetail.lmExceedProb === 'number';
  const breach = hasToleranceData
    ? ReportPresentation.clampNumber(results.toleranceDetail.lmExceedProb * 100, 0, 100)
    : null;
  const annualStress = ReportPresentation.clampNumber(((Number(results?.ale?.p90 || 0) / Math.max(Number(results?.annualReviewThreshold || getAnnualReviewThreshold() || 1), 1)) * 100), 0, 180);
  return UI.resultsVisualCard({
    title: 'Risk signal at a glance',
    body: `<div class="results-signal-stack">
      <div class="results-signal-metric">
        <div class="results-driver-label">Tolerance exceedance likelihood</div>
        ${breach == null
          ? `<div class="results-signal-label">Not assessed</div>
             <div class="form-help">Run the simulation to see probability of exceeding tolerance.</div>`
          : `<div class="results-signal-bar"><span style="width:${breach}%"></span></div>
             <div class="results-comparison-foot">${breach.toFixed(1)}% chance of exceeding tolerance in the model; this is not incident likelihood.</div>
             <button type="button" class="results-metric-explain" data-results-explain="toleranceDetail.lmExceedProb" aria-expanded="false">Explain this number</button>`}
      </div>
      <div class="results-signal-metric">
        <div class="results-driver-label">Annual stress versus review trigger</div>
        <div class="results-signal-bar warning"><span style="width:${Math.min(annualStress, 100)}%"></span></div>
        <div class="results-comparison-foot">${annualStress >= 100 ? 'At or above' : 'Below'} the annual review trigger</div>
        <button type="button" class="results-metric-explain" data-results-explain="annualReviewDetail.annualExceedProb" aria-expanded="false">Explain this number</button>
      </div>
    </div>`
  });
}

function renderProjectHorizonResultsPanel(results) {
  const projectHorizon = results?.projectHorizon && typeof results.projectHorizon === 'object'
    ? results.projectHorizon
    : null;
  if (!projectHorizon) return '';
  const caveats = Array.isArray(projectHorizon.caveats)
    ? projectHorizon.caveats.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!projectHorizon.enabled) {
    return UI.resultsVisualCard({
      title: 'Project-horizon view',
      body: `<div class="results-summary-copy">Project-horizon metrics were not computed for this run.</div>
        <div class="citation-chips" style="margin-top:12px">
          <span class="badge badge--warning">${escapeHtml(String(projectHorizon.skippedReason || 'Skipped'))}</span>
          <span class="badge badge--neutral">${escapeHtml(String(projectHorizon.durationSourceStatus || 'unknown'))} duration</span>
        </div>
        ${caveats.length ? `<div class="results-comparison-foot" style="margin-top:var(--sp-3)">${caveats.map(item => escapeHtml(item)).join(' ')}</div>` : ''}`
    });
  }
  const eventProbability = Number(projectHorizon.eventProbability || 0);
  const valuePct = projectHorizon.lossAsPctOfProjectValue
    ? `${(Number(projectHorizon.lossAsPctOfProjectValue.p90 || 0) * 100).toFixed(1)}%`
    : 'Not available';
  const marginPct = projectHorizon.lossAsPctOfMargin
    ? `${(Number(projectHorizon.lossAsPctOfMargin.p90 || 0) * 100).toFixed(1)}%`
    : 'Not available';
  return UI.resultsVisualCard({
    title: 'Project-horizon view',
    body: `<div class="results-track-grid">
      <div class="results-track-card">
        <span class="results-track-card__label">Expected project-horizon loss</span>
        <strong>${fmtCurrency(projectHorizon.loss?.mean || 0)}</strong>
        <p>${escapeHtml(String(projectHorizon.confidenceLabel || 'Project duration labelled'))}</p>
        <button type="button" class="results-metric-explain" data-results-explain="projectHorizon.loss.mean" aria-expanded="false">Explain this number</button>
      </div>
      <div class="results-track-card">
        <span class="results-track-card__label">Severe project-horizon loss</span>
        <strong>${fmtCurrency(projectHorizon.loss?.p90 || 0)}</strong>
        <p>${(eventProbability * 100).toFixed(1)}% modelled probability of at least one event over ${Number(projectHorizon.durationMonths || 0).toFixed(1)} months.</p>
        <button type="button" class="results-metric-explain" data-results-explain="projectHorizon.loss.p90" aria-expanded="false">Explain this number</button>
      </div>
    </div>
    <div class="context-chip-grid" style="margin-top:var(--sp-4)">
      <div class="context-chip-panel"><span>Loss as % of project value</span><strong>${escapeHtml(valuePct)}</strong><small>${escapeHtml(String(projectHorizon.lossAsPctOfProjectValueSourceStatus || 'unknown'))}</small><button type="button" class="results-metric-explain" data-results-explain="projectHorizon.lossAsPctOfProjectValue" aria-expanded="false">Explain this number</button></div>
      <div class="context-chip-panel"><span>Loss as % of margin</span><strong>${escapeHtml(marginPct)}</strong><small>${escapeHtml(String(projectHorizon.lossAsPctOfMarginSourceStatus || 'unknown'))}</small><button type="button" class="results-metric-explain" data-results-explain="projectHorizon.lossAsPctOfMargin" aria-expanded="false">Explain this number</button></div>
      <div class="context-chip-panel"><span>Project event probability</span><strong>${(eventProbability * 100).toFixed(1)}%</strong><small>Modelled over project duration</small><button type="button" class="results-metric-explain" data-results-explain="projectHorizon.eventProbability" aria-expanded="false">Explain this number</button></div>
      <div class="context-chip-panel"><span>Duration source</span><strong>${escapeHtml(String(projectHorizon.durationSourceStatus || 'unknown').replace(/_/g, ' '))}</strong><small>${escapeHtml(String(projectHorizon.durationConfidence || 'unknown'))}</small></div>
    </div>
    ${caveats.length ? `<div class="results-comparison-foot" style="margin-top:var(--sp-3)">${caveats.map(item => escapeHtml(item)).join(' ')}</div>` : ''}
    <div class="form-help" style="margin-top:var(--sp-3)">${escapeHtml(String(projectHorizon.metricSemantics || 'Project-horizon metrics preserve the existing annualized view.'))}</div>`
  });
}

function renderResultsAssessmentTypeHeader(model, assessmentValue = null, results = {}) {
  const safeModel = model && typeof model === 'object' ? model : null;
  if (!safeModel) return '';
  const resolveExplainKey = (item = {}) => {
    const explicit = String(item.explain || '').trim();
    if (explicit) return explicit;
    const label = String(item.label || '').toLowerCase();
    if (/event loss/.test(label)) return 'eventLoss.p90';
    if (/annualized loss|annual loss/.test(label)) return 'annualLoss.mean';
    if (/tolerance exceedance/.test(label)) return 'toleranceDetail.lmExceedProb';
    if (/annual review/.test(label)) return 'annualReviewDetail.annualExceedProb';
    if (/project-horizon expected/.test(label)) return 'projectHorizon.loss.mean';
    if (/p90 project-horizon|project-horizon p90/.test(label)) return 'projectHorizon.loss.p90';
    if (/loss as % of margin/.test(label)) return 'projectHorizon.lossAsPctOfMargin';
    if (/loss as % of spend|loss as % of project|loss as % of contract/.test(label)) return 'projectHorizon.lossAsPctOfProjectValue';
    if (/delay|reprocurement|recover|revenue at risk|margin at risk|cost to cure|ld|sla/.test(label)) return 'projectExposure.primaryDriver';
    return '';
  };
  const renderItem = (item, tone = '') => {
    const explainKey = resolveExplainKey(item);
    return `<div class="results-top-value-strip__item ${tone ? `results-top-value-strip__item--${escapeHtml(tone)}` : ''}">
    <span>${escapeHtml(String(item.label || 'Metric'))}</span>
    <strong>${escapeHtml(String(item.value || 'Not available'))}</strong>
    ${item.copy ? `<small>${escapeHtml(String(item.copy))}</small>` : ''}
    ${explainKey ? `<button type="button" class="results-metric-explain" data-results-explain="${escapeHtml(explainKey)}" aria-expanded="false">Explain this number</button>` : ''}
  </div>`;
  };
  if (!safeModel.isProject) {
    const metrics = Array.isArray(safeModel.metrics) && safeModel.metrics.length
      ? safeModel.metrics
      : [
          { label: 'Event loss', value: fmtCurrency(results?.eventLoss?.p90 || 0), copy: 'Severe single-event view' },
          { label: 'Annualized loss', value: fmtCurrency(results?.annualLoss?.mean || 0), copy: 'Expected annual exposure' },
          { label: 'Tolerance exceedance', value: `${(Number(results?.toleranceDetail?.lmExceedProb || 0) * 100).toFixed(1)}%`, copy: 'Modelled threshold exceedance' },
          { label: 'Annual review trigger', value: results?.annualReviewTriggered ? 'Triggered' : 'Not triggered', copy: 'Existing annual review logic' }
        ];
    return `<section class="results-assessment-type-header results-assessment-type-header--generic anim-fade-in" aria-label="Enterprise risk estimate">
      <div class="results-assessment-type-header__body">
        <div>
          <div class="results-driver-label">Enterprise risk estimate</div>
          <h2>Enterprise risk estimate</h2>
        </div>
        <p>Event loss and annualized loss remain the primary enterprise-risk views.</p>
      </div>
      <div class="results-top-value-strip results-top-value-strip--wide">${metrics.slice(0, 4).map((item, index) => renderItem(item, index === 0 ? 'value' : '')).join('')}</div>
    </section>`;
  }

  const projectMetrics = [];
  const valueSource = safeModel.role === 'seller'
    ? safeModel.knownValues.find(item => /contract value/i.test(item.label)) || safeModel.estimatedValues.find(item => /contract value/i.test(item.label))
    : safeModel.knownValues.find(item => /spend|budget/i.test(item.label)) || safeModel.estimatedValues.find(item => /spend|budget/i.test(item.label));
  if (valueSource) projectMetrics.push({
    label: safeModel.role === 'seller' ? 'Contract value' : 'Project spend / budget',
    value: valueSource.value,
    copy: `${valueSource.status.replace(/_/g, ' ')} · ${valueSource.confidence} confidence`
  });
  if (safeModel.projectHorizon?.enabled) {
    projectMetrics.push({ label: 'Project-horizon expected loss', value: safeModel.projectHorizon.expectedLoss, copy: safeModel.projectHorizon.confidenceLabel || 'Project duration view' });
    projectMetrics.push({ label: 'P90 project-horizon loss', value: safeModel.projectHorizon.p90Loss, copy: `${safeModel.projectHorizon.eventProbabilityLabel} event probability over ${safeModel.projectHorizon.durationLabel}` });
    projectMetrics.push({
      label: safeModel.role === 'seller' ? 'Loss as % of margin' : 'Loss as % of spend / budget',
      value: safeModel.role === 'seller'
        ? (safeModel.projectHorizon.lossAsPctOfMarginLabel || 'Not computable')
        : (safeModel.projectHorizon.lossAsPctOfProjectValueLabel || 'Not computable'),
      copy: safeModel.role === 'seller' ? 'Requires margin denominator' : 'Requires spend or budget denominator'
    });
  }
  const quantified = safeModel.driverGroups?.quantified || [];
  const proxyEstimated = safeModel.driverGroups?.proxyEstimated || [];
  const driverPick = (pattern) => [...quantified, ...proxyEstimated].find(driver => pattern.test(`${driver.label} ${driver.type}`));
  const delayDriver = driverPick(/delay/i);
  const reprocurementDriver = driverPick(/reprocurement/i);
  const recoveryDriver = driverPick(/recovery|credit|offset/i);
  const marginDriver = driverPick(/margin/i);
  const revenueDriver = driverPick(/revenue/i);
  const cureDriver = driverPick(/cure|delivery cost|cost/i);
  const penaltyDriver = driverPick(/liquidated|sla|penalt/i);
  if (safeModel.role === 'buyer') {
    if (delayDriver) projectMetrics.push({ label: 'Delay cost at risk', value: delayDriver.rangeLabel, copy: `${delayDriver.statusLabel} · ${delayDriver.confidence}` });
    if (reprocurementDriver) projectMetrics.push({ label: 'Reprocurement exposure', value: reprocurementDriver.rangeLabel, copy: `${reprocurementDriver.statusLabel} · ${reprocurementDriver.confidence}` });
    if (recoveryDriver) projectMetrics.push({ label: 'Recoveries / offsets', value: recoveryDriver.rangeLabel, copy: `${recoveryDriver.statusLabel} · ${recoveryDriver.confidence}` });
  } else {
    if (revenueDriver) projectMetrics.push({ label: 'Revenue at risk', value: revenueDriver.rangeLabel, copy: `${revenueDriver.statusLabel} · ${revenueDriver.confidence}` });
    if (marginDriver) projectMetrics.push({ label: 'Margin at risk', value: marginDriver.rangeLabel, copy: `${marginDriver.statusLabel} · ${marginDriver.confidence}` });
    if (cureDriver) projectMetrics.push({ label: 'Cost to cure', value: cureDriver.rangeLabel, copy: `${cureDriver.statusLabel} · ${cureDriver.confidence}` });
    if (penaltyDriver) projectMetrics.push({ label: 'LD / SLA exposure', value: penaltyDriver.rangeLabel, copy: `${penaltyDriver.statusLabel} · ${penaltyDriver.confidence}` });
  }
  if (!projectMetrics.length) {
    projectMetrics.push({ label: safeModel.role === 'seller' ? 'Project seller exposure' : 'Project buyer exposure', value: 'Directional', copy: 'Project economics are thin. The estimate is directional until key values are confirmed.' });
  }
  projectMetrics.push({
    label: 'Project input quality',
    value: safeModel.inputQuality?.score == null ? safeModel.inputQuality?.label || 'Thin project economics' : `${Math.round(Number(safeModel.inputQuality.score))}/100`,
    copy: safeModel.inputQuality?.label || 'Input quality'
  });
  if (safeModel.unknownHighImpactValues?.length) {
    projectMetrics.push({
      label: 'Unknown high-impact values',
      value: String(safeModel.unknownHighImpactValues.length),
      copy: safeModel.unknownHighImpactValues.slice(0, 2).join(', ')
    });
  }
  return `<section class="results-assessment-type-header results-assessment-type-header--project anim-fade-in" aria-label="${escapeHtml(safeModel.title)}">
    <div class="results-assessment-type-header__body">
      <div>
        <div class="results-driver-label">${escapeHtml(safeModel.role === 'seller' ? 'Project seller exposure' : 'Project buyer exposure')}</div>
        <h2>${escapeHtml(safeModel.title)}</h2>
      </div>
      <p>${escapeHtml(safeModel.helperCopy || safeModel.caveatSummary || 'Project economics are directional until key values are confirmed.')}</p>
    </div>
    <div class="results-top-value-strip results-top-value-strip--project">${projectMetrics.slice(0, 8).map((item, index) => renderItem(item, index === 0 ? 'value' : '')).join('')}</div>
  </section>`;
}

function renderProjectDriverList(title, items = [], emptyCopy = '') {
  const safeItems = Array.isArray(items) ? items : [];
  return `<div class="project-exposure-group">
    <div class="project-exposure-group__head">
      <span>${escapeHtml(title)}</span>
      <strong>${safeItems.length}</strong>
    </div>
    ${safeItems.length ? safeItems.slice(0, 6).map(item => `<div class="project-exposure-driver">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.rationale || item.type || 'Project exposure driver')}</span>
      </div>
      <div class="project-exposure-driver__value">
        <strong>${escapeHtml(item.rangeLabel)}</strong>
        <span>${escapeHtml(`${item.statusLabel} · ${item.confidence}`)}</span>
      </div>
    </div>`).join('') : `<p class="results-summary-copy">${escapeHtml(emptyCopy || 'No drivers in this group yet.')}</p>`}
  </div>`;
}

function renderProjectExposureResultsPanel(model) {
  if (!model?.isProject) return '';
  const maps = model.mapsToRiskParameters && typeof model.mapsToRiskParameters === 'object' ? Object.entries(model.mapsToRiskParameters) : [];
  const known = Array.isArray(model.knownValues) ? model.knownValues : [];
  const estimated = Array.isArray(model.estimatedValues) ? model.estimatedValues : [];
  const unknowns = Array.isArray(model.unknownHighImpactValues) ? model.unknownHighImpactValues : [];
  const decisionUnknowns = Array.isArray(model.decisionSensitiveUnknowns) ? model.decisionSensitiveUnknowns : [];
  const capsAndOffsets = Array.isArray(model.capsAndOffsets) ? model.capsAndOffsets : [];
  const warnings = Array.isArray(model.doubleCountingWarnings) ? model.doubleCountingWarnings : [];
  return `<section class="project-results-panel anim-fade-in" data-project-results-panel>
    <div class="project-results-panel__head">
      <div>
        <div class="results-driver-label">${escapeHtml(model.title)}</div>
        <h2>Project financial exposure</h2>
      </div>
      <span class="badge ${unknowns.length ? 'badge--warning' : 'badge--success'}">${escapeHtml(model.inputQuality?.label || 'Project input quality')}</span>
    </div>
    <p class="results-summary-copy">${escapeHtml(model.summary || model.caveatSummary)}</p>
    ${unknowns.length || decisionUnknowns.length ? `<div class="banner banner--warning" style="margin-top:var(--sp-4)"><span class="banner-icon">!</span><span class="banner-text">Project economics are thin. The estimate is directional until key values are confirmed.</span></div>` : ''}
    <div class="project-results-lens-grid">
      <div class="context-chip-panel">
        <span class="project-results-chip-label">Known project values</span>
        <strong>${known.length ? escapeHtml(known.map(item => `${item.label}: ${item.value}`).join(' · ')) : 'None confirmed'}</strong>
      </div>
      <div class="context-chip-panel">
        <span class="project-results-chip-label">Estimated/proxy values</span>
        <strong>${estimated.length ? escapeHtml(estimated.map(item => `${item.label}: ${item.value}`).join(' · ')) : 'No proxy values selected'}</strong>
      </div>
      <div class="context-chip-panel">
        <span class="project-results-chip-label">Unknown but important</span>
        <strong>${unknowns.length ? escapeHtml(unknowns.slice(0, 4).join(', ')) : 'No high-impact unknowns flagged'}</strong>
      </div>
      <div class="context-chip-panel">
        <span class="project-results-chip-label">Could change the decision</span>
        <strong>${decisionUnknowns.length ? escapeHtml(decisionUnknowns.slice(0, 3).map(item => item.label).join(', ')) : 'No decision-sensitive gaps flagged'}</strong>
      </div>
    </div>
    <div class="project-exposure-grid">
      ${renderProjectDriverList('Quantified drivers', model.driverGroups?.quantified, 'No project drivers are fully quantified yet.')}
      ${renderProjectDriverList('Estimated/proxy drivers', model.driverGroups?.proxyEstimated, 'No benchmark-proxy or estimated drivers are currently active.')}
      ${renderProjectDriverList('Unquantified but relevant', model.driverGroups?.unquantified, 'No unquantified relevant drivers were flagged.')}
    </div>
    <div class="project-results-detail-grid">
      <div class="project-results-detail-card">
        <div class="results-driver-label">Caps and offsets</div>
        ${capsAndOffsets.length ? capsAndOffsets.slice(0, 5).map(item => `<p>${escapeHtml(String(item.type || item.label || 'Offset'))}: ${escapeHtml(String(item.effect || item.rationale || 'informational'))}</p>`).join('') : '<p>No caps or offsets are confirmed yet. Unknown recoveries are not treated as zero.</p>'}
      </div>
      <div class="project-results-detail-card">
        <div class="results-driver-label">Double-counting warnings</div>
        ${warnings.length ? warnings.map(item => `<p>${escapeHtml(item)}</p>`).join('') : '<p>No double-counting warnings are currently flagged.</p>'}
      </div>
      <div class="project-results-detail-card">
        <div class="results-driver-label">Missing inputs</div>
        ${model.missingInputs.length ? model.missingInputs.slice(0, 5).map(item => `<p><strong>${escapeHtml(item.label)}</strong>${item.whyItMatters ? ` — ${escapeHtml(item.whyItMatters)}` : ''}</p>`).join('') : '<p>No project-specific missing inputs are currently listed.</p>'}
      </div>
      <div class="project-results-detail-card">
        <div class="results-driver-label">Mapped risk parameters</div>
        ${maps.length ? maps.slice(0, 8).map(([key, value]) => `<p><strong>${escapeHtml(key)}</strong>: ${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : String(value))}</p>`).join('') : '<p>No project drivers have been mapped into FAIR parameter buckets yet.</p>'}
      </div>
    </div>
  </section>`;
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

function renderDecisionRail(statusTitle, statusDetail, executiveDecision, executiveAction, confidence, rolePresentation, showFallbackBadge = false) {
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
        value: `${escapeHtml(String(confidenceValue))}${showFallbackBadge ? ' <span class="badge badge--warning">Local fallback</span>' : ''}`,
        copy: confidence?.implication
          ? confidence.implication
          : confidenceCopy
      })}
      ${UI.resultsBriefCard({ label: 'Role lens', value: rolePresentation.executiveNoteTitle, copy: rolePresentation.executiveNote })}
    </div>
  </div>`;
}

function renderExecutiveScenarioStatement(assessment, scenarioNarrative) {
  const title = getResultsScenarioDisplayTitle({
    ...assessment,
    narrative: assessment?.narrative || scenarioNarrative || '',
    enhancedNarrative: assessment?.enhancedNarrative || scenarioNarrative || ''
  });
  const narrative = String(
    scenarioNarrative
    || assessment?.enhancedNarrative
    || assessment?.narrative
    || assessment?.scenarioText
    || 'No scenario statement was saved with this assessment.'
  ).trim();
  const lensLabel = String(assessment?.scenarioLens?.label || assessment?.scenarioLens?.key || '').trim();
  const selectedRiskLabels = (Array.isArray(assessment?.selectedRisks) ? assessment.selectedRisks : [])
    .map(item => String(item?.title || item?.category || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  return `<section class="results-scenario-statement">
    <div class="results-scenario-statement__head">
      <div>
        <div class="results-driver-label">Scenario assessed</div>
        <h3 class="results-scenario-statement__title">${escapeHtml(title)}</h3>
      </div>
      <div class="results-scenario-statement__chips">
        ${lensLabel ? `<span class="badge badge--neutral">${escapeHtml(lensLabel)}</span>` : ''}
        ${selectedRiskLabels.map(label => `<span class="badge badge--gold">${escapeHtml(label)}</span>`).join('')}
      </div>
    </div>
    <p class="results-scenario-statement__copy">${escapeHtml(narrative)}</p>
  </section>`;
}

function getResultsScenarioDisplayTitle(assessment) {
  if (typeof resolveScenarioDisplayTitle === 'function') {
    const resolved = resolveScenarioDisplayTitle(assessment || {});
    if (String(resolved || '').trim()) return String(resolved).trim();
  }
  return String(assessment?.scenarioTitle || assessment?.title || 'Risk assessment').trim() || 'Risk assessment';
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

function renderExecutiveCommandDeck({
  statusTitle = '',
  statusDetail = '',
  executiveDecision = null,
  executiveAction = '',
  confidenceFrame = null,
  recommendations = [],
  missingInformation = [],
  nextStepPlan = [],
  reviewStatus = '',
  rolePresentation = {}
} = {}) {
  const nextMoveTitle = String(
    nextStepPlan?.[0]?.title
    || recommendations?.[0]?.title
    || executiveAction
    || executiveDecision?.priority
    || executiveDecision?.decision
    || 'Confirm the management action'
  ).trim();
  const nextMoveCopy = String(
    nextStepPlan?.[0]?.copy
    || recommendations?.[0]?.why
    || executiveDecision?.rationale
    || statusDetail
    || 'Use the current result to agree the immediate management response.'
  ).trim();
  const challengeTitle = String(
    confidenceFrame?.topGap
    || missingInformation?.[0]
    || nextStepPlan?.[1]?.title
    || recommendations?.[1]?.title
    || 'Open the supporting detail only if this result is challenged'
  ).trim();
  const challengeCopy = String(
    confidenceFrame?.implication
    || nextStepPlan?.[1]?.copy
    || recommendations?.[1]?.why
    || 'Use the evidence, benchmark, and challenge layer when you need to defend or revise the result.'
  ).trim();
  const followThroughCopy = reviewStatus === 'approved'
    ? 'The result is already approved. Use the lower layer only for audit trail, treatment comparison, or leadership challenge.'
    : reviewStatus === 'changes_requested'
      ? 'Reviewer changes are outstanding. Tighten the scenario or assumptions first, then rebuild and resubmit.'
      : 'Once the action reads cleanly, submit the result for review or move straight into treatment planning.';
  const roleLens = String(
    rolePresentation?.executiveNoteTitle
    || 'Management lens'
  ).trim();
  const steps = [
    {
      number: '1',
      label: 'Read the current position',
      value: statusTitle || 'Review',
      copy: statusDetail || 'Use this as the current management posture until the main assumptions are challenged.',
      active: true
    },
    {
      number: '2',
      label: 'Take the next management move',
      value: nextMoveTitle,
      copy: nextMoveCopy
    },
    {
      number: '3',
      label: 'Open support only if needed',
      value: challengeTitle,
      copy: challengeCopy
    }
  ];
  return `<section class="results-command-deck anim-fade-in">
    <div class="results-command-deck__main">
      <div class="results-command-deck__eyebrow">Decision flow</div>
      <h3 class="results-command-deck__title">Read this result in 3 moves</h3>
      <div class="results-command-deck__steps">
        ${steps.map(step => `<article class="results-command-step ${step.active ? 'results-command-step--active' : ''}">
          <span class="results-command-step__index">${escapeHtml(step.number)}</span>
          <div class="results-command-step__body">
            <div class="results-command-step__label">${escapeHtml(step.label)}</div>
            <strong>${escapeHtml(step.value)}</strong>
            <p>${escapeHtml(step.copy)}</p>
          </div>
        </article>`).join('')}
      </div>
    </div>
    <aside class="results-command-deck__focus">
      <div class="results-command-deck__focus-label">Do this next</div>
      <strong>${escapeHtml(nextMoveTitle || 'Confirm the next move')}</strong>
      <p>${escapeHtml(nextMoveCopy || 'Use the current result to agree the next concrete action.')}</p>
      <div class="results-command-deck__meta">
        <span class="badge badge--neutral">${escapeHtml(roleLens)}</span>
        <span class="badge badge--gold">${reviewStatus === 'approved' ? 'Review complete' : reviewStatus === 'changes_requested' ? 'Revise before review' : 'Ready for review'}</span>
      </div>
      <div class="results-command-deck__signal" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="results-command-deck__foot">${escapeHtml(followThroughCopy)}</div>
    </aside>
  </section>`;
}

function renderExecutiveSupportDisclosure({
  title = 'Supporting detail',
  copy = 'Open this layer when you need evidence, benchmark, challenge, or recommendation detail.',
  badge = 'Open if challenged',
  body = '',
  open = false
} = {}) {
  if (!String(body || '').trim()) return '';
  return `<details class="results-supporting-disclosure wizard-disclosure card anim-fade-in" ${open ? 'open' : ''}>
    <summary>
      ${escapeHtml(String(title))}
      <span class="badge badge--neutral">${escapeHtml(String(badge))}</span>
    </summary>
    <div class="results-supporting-disclosure__body">
      <p class="results-supporting-disclosure__copy">${escapeHtml(String(copy))}</p>
      ${body}
    </div>
  </details>`;
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

function renderResultsEvidenceMapPanel(assessment = {}) {
  const evidenceMap = assessment?.evidenceMap && typeof assessment.evidenceMap === 'object' ? assessment.evidenceMap : null;
  if (!evidenceMap) return '';
  const projectFinancial = Array.isArray(evidenceMap.projectFinancialEvidenceMap) ? evidenceMap.projectFinancialEvidenceMap : [];
  const foundValues = projectFinancial.filter(item => item?.status === 'found').slice(0, 4);
  const missingValues = projectFinancial.filter(item => item?.status === 'not_found' || item?.status === 'unclear').slice(0, 4);
  const contradictions = Array.isArray(evidenceMap.contradictions) ? evidenceMap.contradictions.slice(0, 3) : [];
  const unsupported = Array.isArray(evidenceMap.unsupportedClaims) ? evidenceMap.unsupportedClaims.slice(0, 3) : [];
  const quality = evidenceMap.citationQuality && typeof evidenceMap.citationQuality === 'object' ? evidenceMap.citationQuality : {};
  const strong = Array.isArray(quality.strong) ? quality.strong.length : 0;
  const weak = Array.isArray(quality.weak) ? quality.weak.length : 0;
  const decorative = Array.isArray(quality.decorative) ? quality.decorative.length : 0;
  const hasContent = foundValues.length || missingValues.length || contradictions.length || unsupported.length || strong || weak || decorative;
  if (!hasContent) return '';
  return UI.resultsSectionBlock({
    title: 'Evidence Map',
    intro: 'Claims, project values, and citations checked against the saved evidence available to this assessment.',
    className: 'results-section-stack--evidence-map',
    body: `
    <div class="results-summary-grid results-summary-grid--primary">
      ${UI.resultsSummaryCard({
        label: 'Citation quality',
        body: `<div class="results-trace-stat"><strong>${strong}</strong><span>strong</span></div>
          <div class="results-trace-stat"><strong>${weak}</strong><span>weak</span></div>
          <div class="results-trace-stat"><strong>${decorative}</strong><span>decorative</span></div>`,
        foot: decorative ? 'Decorative citations should not be relied on for parameter support.' : 'Citation quality was checked conservatively.'
      })}
      ${UI.resultsSummaryCard({
        label: 'Project values found',
        body: foundValues.length
          ? foundValues.map(item => `<p class="results-summary-copy"><strong>${escapeHtml(item.field || 'Project value')}</strong>: ${escapeHtml(item.value || 'Referenced in evidence')}</p>`).join('')
          : '<p class="results-summary-copy">No project-financial values were found in the linked evidence.</p>',
        foot: foundValues.map(item => (Array.isArray(item.evidenceRefs) ? item.evidenceRefs[0] : '')).filter(Boolean).slice(0, 2).join(' · ')
      })}
      ${UI.resultsSummaryCard({
        label: 'Unknown but important',
        wide: true,
        body: missingValues.length
          ? missingValues.map(item => `<p class="results-summary-copy"><strong>${escapeHtml(item.field || 'Project value')}</strong>: ${escapeHtml(item.commentary || 'Not found in evidence; remains unknown.')}</p>`).join('')
          : '<p class="results-summary-copy">No missing project-financial evidence was flagged.</p>',
        foot: 'Unknown values remain unknown unless evidence supports them.'
      })}
    </div>
    ${contradictions.length ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${contradictions.map(item => escapeHtml(item.claim || item.conflictingEvidence || 'Contradiction found')).join(' ')}</span></div>` : ''}
    ${unsupported.length ? `<div class="results-disclosure-stack mt-4">
      ${unsupported.map(item => `<div class="results-trace-row">
        <div class="results-trace-row__head"><strong>Unsupported claim</strong></div>
        <div class="results-summary-copy">${escapeHtml(item.claim || 'Claim')}</div>
        <div class="results-comparison-foot" style="margin-top:var(--sp-2)">${escapeHtml(item.missingEvidence || item.impact || 'No direct evidence was found.')}</div>
      </div>`).join('')}
    </div>` : ''}`
  });
}

const DECISION_CHALLENGE_PATCH_NUMBERS = new Set([
  'iterations',
  'seed',
  'threshold',
  'annualReviewThreshold',
  'tefMin',
  'tefLikely',
  'tefMax',
  'vulnMin',
  'vulnLikely',
  'vulnMax',
  'threatCapMin',
  'threatCapLikely',
  'threatCapMax',
  'controlStrMin',
  'controlStrLikely',
  'controlStrMax',
  'irMin',
  'irLikely',
  'irMax',
  'biMin',
  'biLikely',
  'biMax',
  'dbMin',
  'dbLikely',
  'dbMax',
  'rlMin',
  'rlLikely',
  'rlMax',
  'tpMin',
  'tpLikely',
  'tpMax',
  'rcMin',
  'rcLikely',
  'rcMax',
  'secProbMin',
  'secProbLikely',
  'secProbMax',
  'secMagMin',
  'secMagLikely',
  'secMagMax',
  'corrBiIr',
  'corrRlRc',
  'projectDurationMonths',
  'projectHorizonYears',
  'projectValue',
  'projectMargin'
]);
const DECISION_CHALLENGE_PATCH_BOOLEANS = new Set(['vulnDirect', 'secondaryEnabled', 'projectHorizonEnabled']);
const DECISION_CHALLENGE_PATCH_STRINGS = new Set([
  'distType',
  'assessmentType',
  'projectDurationSourceStatus',
  'projectDurationConfidence',
  'projectValueSourceStatus',
  'projectMarginSourceStatus'
]);

function normaliseDecisionChallengeResult(value = {}) {
  if (typeof DecisionSupportModel !== 'undefined' && DecisionSupportModel?.buildDecisionChallenge) {
    return DecisionSupportModel.buildDecisionChallenge(value);
  }
  return value && typeof value === 'object' ? value : {};
}

function readDecisionChallenge(assessment = {}) {
  return assessment?.decisionChallenge && typeof assessment.decisionChallenge === 'object'
    ? normaliseDecisionChallengeResult(assessment.decisionChallenge)
    : null;
}

function normaliseDecisionChallengePatch(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return {};
  const output = {};
  Object.entries(patch).forEach(([key, value]) => {
    if (DECISION_CHALLENGE_PATCH_NUMBERS.has(key)) {
      const number = Number(value);
      if (Number.isFinite(number)) output[key] = number;
      return;
    }
    if (DECISION_CHALLENGE_PATCH_BOOLEANS.has(key)) {
      if (value === true || value === false) output[key] = value;
      return;
    }
    if (DECISION_CHALLENGE_PATCH_STRINGS.has(key)) {
      const text = String(value || '').trim();
      if (text) output[key] = text;
    }
  });
  return output;
}

function formatDecisionChallengePatch(patch = {}) {
  const normalised = normaliseDecisionChallengePatch(patch);
  const entries = Object.entries(normalised);
  if (!entries.length) return 'No valid parameter patch';
  return entries.slice(0, 5).map(([key, value]) => `${key}: ${typeof value === 'number' ? Number(value.toFixed ? value.toFixed(3) : value) : value}`).join(' · ');
}

function getDecisionChallengeStressComparisons(assessment = {}) {
  return (Array.isArray(assessment?.decisionChallengeStressComparisons) ? assessment.decisionChallengeStressComparisons : [])
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id || '').trim(),
      stressTestId: String(item.stressTestId || '').trim(),
      title: String(item.title || '').trim(),
      baseAleRange: String(item.baseAleRange || '').trim(),
      projectedAleRange: String(item.projectedAleRange || '').trim(),
      changePct: Number(item.changePct || 0),
      patchLabel: String(item.patchLabel || '').trim(),
      validationWarnings: Array.isArray(item.validationWarnings) ? item.validationWarnings.map(text => String(text || '').trim()).filter(Boolean) : [],
      createdAt: Number(item.createdAt || 0)
    }))
    .filter(item => item.id && item.stressTestId)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}

function buildDecisionChallengePayload(assessment = {}, r = {}, technicalInputs = {}, runMetadata = {}) {
  return {
    assessmentType: String(assessment.assessmentType || 'enterprise_generic'),
    scenario: String(assessment.enhancedNarrative || assessment.narrative || assessment.scenarioTitle || ''),
    structuredScenario: assessment.structuredScenario && typeof assessment.structuredScenario === 'object' ? assessment.structuredScenario : {},
    scenarioLens: assessment.scenarioLens && typeof assessment.scenarioLens === 'object' ? assessment.scenarioLens : {},
    projectContext: assessment.projectContext && typeof assessment.projectContext === 'object' ? assessment.projectContext : {},
    projectExposure: assessment.projectExposure && typeof assessment.projectExposure === 'object' ? assessment.projectExposure : {},
    parameters: buildSensitivitySimulationParams(technicalInputs, r, runMetadata),
    simulationResult: r && typeof r === 'object' ? r : {},
    assumptionRegister: assessment.assumptionRegister && typeof assessment.assumptionRegister === 'object' ? assessment.assumptionRegister : {},
    parameterCoach: assessment.parameterCoach && typeof assessment.parameterCoach === 'object' ? assessment.parameterCoach : {},
    evidenceMap: assessment.evidenceMap && typeof assessment.evidenceMap === 'object' ? assessment.evidenceMap : {},
    treatments: Array.isArray(assessment.treatments) ? assessment.treatments : [],
    riskAppetite: {
      threshold: Number(r?.threshold || technicalInputs?.threshold || getToleranceThreshold()),
      annualReviewThreshold: Number(r?.annualReviewThreshold || technicalInputs?.annualReviewThreshold || getAnnualReviewThreshold())
    },
    adminSettings: typeof AdminService !== 'undefined' && AdminService?.getSettings ? AdminService.getSettings() : {},
    traceLabel: 'Decision challenge'
  };
}

function runDecisionChallengeStressComparison({
  assessment,
  technicalInputs,
  r,
  runMetadata,
  stressTest
} = {}) {
  if (typeof RiskEngine === 'undefined' || !assessment || !technicalInputs || !r || !stressTest) return null;
  const patch = normaliseDecisionChallengePatch(stressTest.parameterPatch);
  if (!Object.keys(patch).length) {
    return { error: 'Stress case did not include a valid parameter patch.' };
  }
  const baseParams = buildSensitivitySimulationParams(technicalInputs, r, runMetadata);
  const projectedParams = {
    ...cloneSerializableState(baseParams, {}),
    ...patch,
    iterations: Math.max(1000, Math.min(10000, Number(patch.iterations || baseParams.iterations || 1000))),
    seed: Number(baseParams.seed || 1337)
  };
  const validation = RiskEngine.validateRunParams(projectedParams);
  if (validation?.valid === false || (Array.isArray(validation?.errors) && validation.errors.length)) {
    return {
      error: (Array.isArray(validation?.errors) && validation.errors[0]) || 'Stress case parameter patch is invalid.'
    };
  }
  const baseResults = RiskEngine.run(baseParams);
  const projectedResults = RiskEngine.run(projectedParams);
  const baseMean = Number(baseResults?.annualLoss?.mean || baseResults?.ale?.mean || 0);
  const projectedMean = Number(projectedResults?.annualLoss?.mean || projectedResults?.ale?.mean || 0);
  return {
    id: `dcsc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    stressTestId: String(stressTest.id || ''),
    title: String(stressTest.title || 'Stress case'),
    baseParams,
    projectedParams,
    baseResults,
    projectedResults,
    baseAleRange: formatAnnualAleRangeLabel(baseResults),
    projectedAleRange: formatAnnualAleRangeLabel(projectedResults),
    changePct: baseMean > 0 ? Number((((projectedMean - baseMean) / baseMean) * 100).toFixed(1)) : 0,
    patchLabel: formatDecisionChallengePatch(patch),
    validationWarnings: Array.isArray(validation?.warnings) ? validation.warnings.slice(0, 3) : [],
    createdAt: Date.now()
  };
}

function renderDecisionChallengeAgentCard(assessment = {}, r = {}, technicalInputs = {}, runMetadata = {}) {
  const challenge = readDecisionChallenge(assessment);
  const meta = assessment?.decisionChallengeMeta && typeof assessment.decisionChallengeMeta === 'object' ? assessment.decisionChallengeMeta : {};
  const decisionRisks = Array.isArray(challenge?.decisionRisks) ? challenge.decisionRisks.slice(0, 3) : [];
  const sensitivityFlags = Array.isArray(challenge?.sensitivityFlags) ? challenge.sensitivityFlags.slice(0, 4) : [];
  const missingEvidence = Array.isArray(challenge?.missingEvidence) ? challenge.missingEvidence.slice(0, 4) : [];
  const stressTests = Array.isArray(challenge?.recommendedStressTests) ? challenge.recommendedStressTests.slice(0, 3) : [];
  const changedDecisionIf = Array.isArray(challenge?.changedDecisionIf) ? challenge.changedDecisionIf.slice(0, 3) : [];
  const comparisons = getDecisionChallengeStressComparisons(assessment);
  const emptyCopy = 'Run the Challenge Agent after simulation to identify decision-sensitive assumptions and stress cases. It will not change the baseline result.';
  return UI.resultsSectionBlock({
    title: 'Challenge Agent',
    intro: 'Post-simulation critique focused on what could change the management decision.',
    className: 'results-section-stack--decision-challenge',
    body: `
    <div class="results-summary-grid results-summary-grid--primary">
      ${UI.resultsSummaryCard({
        label: 'Challenge summary',
        wide: true,
        body: `<p class="results-summary-copy">${escapeHtml(challenge?.challengeSummary || emptyCopy)}</p>`,
        foot: meta.generatedAt
          ? `${meta.mode === 'live' ? 'Live AI' : 'Deterministic fallback'} · ${escapeHtml(String(meta.generatedAt || ''))}`
          : 'Baseline results remain unchanged.'
      })}
      ${UI.resultsSummaryCard({
        label: 'Decision risks',
        body: decisionRisks.length
          ? decisionRisks.map(item => `<p class="results-summary-copy"><strong>${escapeHtml(item.title || 'Decision risk')}</strong>: ${escapeHtml(item.explanation || item.recommendedAction || '')}</p>`).join('')
          : '<p class="results-summary-copy">No challenge run has been saved yet.</p>',
        foot: decisionRisks.map(item => item.severity).filter(Boolean).slice(0, 3).join(' · ')
      })}
      ${UI.resultsSummaryCard({
        label: 'Sensitivity flags',
        body: sensitivityFlags.length
          ? sensitivityFlags.map(item => `<p class="results-summary-copy"><strong>${escapeHtml(item.driver || 'Driver')}</strong>: ${escapeHtml(item.whySensitive || '')}</p>`).join('')
          : '<p class="results-summary-copy">Unknown high-impact values will appear here as sensitivity flags.</p>',
        foot: 'Unknowns are not treated as zero.'
      })}
    </div>
    <div class="results-action-row" style="margin-top:var(--sp-4)">
      <button type="button" class="btn btn--secondary btn--sm" data-decision-challenge-run>${challenge ? 'Refresh Challenge Agent' : 'Run Challenge Agent'}</button>
    </div>
    ${missingEvidence.length ? `<div class="results-disclosure-stack mt-4">
      <div class="results-section-heading">Missing evidence</div>
      ${missingEvidence.map(item => `<div class="results-trace-row"><div class="results-summary-copy">${escapeHtml(String(item || 'Missing evidence'))}</div></div>`).join('')}
    </div>` : ''}
    ${stressTests.length ? `<div class="results-disclosure-stack mt-4">
      <div class="results-section-heading">Recommended stress cases</div>
      ${stressTests.map(item => {
        const latestComparison = comparisons.find(comparison => comparison.stressTestId === item.id);
        return `<div class="results-trace-row">
          <div class="results-trace-row__head">
            <strong>${escapeHtml(item.title || 'Stress case')}</strong>
            <span class="badge">${escapeHtml(item.confidence || 'medium')} confidence</span>
          </div>
          <div class="results-summary-copy">${escapeHtml(item.rationale || item.expectedDecisionImpact || '')}</div>
          <div class="results-comparison-foot" style="margin-top:var(--sp-2)">${escapeHtml(formatDecisionChallengePatch(item.parameterPatch || {}))}</div>
          <div class="results-action-row" style="margin-top:var(--sp-3)">
            <button type="button" class="btn btn--secondary btn--sm" data-decision-challenge-stress="${escapeHtml(String(item.id || ''))}">Run stress case</button>
          </div>
          ${latestComparison ? `<div class="banner banner--info mt-4"><span class="banner-icon">i</span><span class="banner-text">Baseline ${escapeHtml(latestComparison.baseAleRange)}. Stress ${escapeHtml(latestComparison.projectedAleRange)} (${latestComparison.changePct >= 0 ? '+' : ''}${escapeHtml(String(latestComparison.changePct))}%). Baseline was not overwritten.</span></div>` : ''}
        </div>`;
      }).join('')}
    </div>` : ''}
    ${changedDecisionIf.length ? `<div class="results-disclosure-stack mt-4">
      <div class="results-section-heading">Changed decision if</div>
      ${changedDecisionIf.map(item => `<div class="results-trace-row">
        <div class="results-summary-copy"><strong>${escapeHtml(item.condition || 'Condition')}</strong></div>
        <div class="results-comparison-foot" style="margin-top:var(--sp-2)">${escapeHtml(item.reason || `${item.fromDecision || 'Current'} to ${item.toDecision || 'revised decision'}`)}</div>
      </div>`).join('')}
    </div>` : ''}`
  });
}

function normaliseDecisionBriefForResults(value = {}) {
  if (typeof DecisionSupportModel !== 'undefined' && DecisionSupportModel?.buildDecisionBrief) {
    return DecisionSupportModel.buildDecisionBrief(value);
  }
  return value && typeof value === 'object' ? value : {};
}

function readSavedDecisionBrief(assessment = {}) {
  return assessment?.decisionBrief && typeof assessment.decisionBrief === 'object'
    ? normaliseDecisionBriefForResults(assessment.decisionBrief)
    : null;
}

function buildSavedAiAuditStory(assessment = {}, extra = {}) {
  const existing = assessment?.aiAuditStory && typeof assessment.aiAuditStory === 'object' ? assessment.aiAuditStory : {};
  if (typeof buildAiAuditStory === 'function') {
    return buildAiAuditStory({
      ...existing,
      ...extra,
      assessment,
      assessmentType: assessment.assessmentType,
      scenarioDraftProvenance: {
        source: assessment.guidedDraftSource || assessment.aiQualityState || '',
        usedFallback: String(assessment.aiQualityState || '').toLowerCase() === 'fallback',
        shortlistCoherence: assessment.shortlistCoherence || null
      },
      projectExposure: assessment.projectExposure,
      assumptionRegister: assessment.assumptionRegister,
      parameterCoach: assessment.parameterCoach,
      evidenceMap: assessment.evidenceMap,
      decisionChallenge: assessment.decisionChallenge,
      decisionBrief: assessment.decisionBrief
    });
  }
  if (typeof DecisionSupportModel !== 'undefined' && DecisionSupportModel?.normaliseAiAuditStory) {
    return DecisionSupportModel.normaliseAiAuditStory(existing);
  }
  return existing;
}

function renderAiAuditStoryAccordion(assessment = {}, options = {}) {
  const story = buildSavedAiAuditStory(assessment, options);
  if (!story || typeof story !== 'object') return '';
  const renderItems = (items, emptyCopy = 'None recorded.') => {
    const list = Array.isArray(items) ? items.map(item => {
      if (!item || typeof item !== 'object') return String(item || '').trim();
      return String(item.text || item.label || item.title || item.statement || item.claim || item.field || '').trim();
    }).filter(Boolean).slice(0, 8) : [];
    return list.length
      ? `<ul class="ai-audit-story__list">${list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : `<p class="results-summary-copy">${escapeHtml(emptyCopy)}</p>`;
  };
  const assessmentType = String(story.assessmentType || assessment.assessmentType || 'enterprise_generic').replace(/_/g, ' ');
  const fallbackLabel = story.fallbackUsed ? 'Fallback used' : 'No fallback recorded';
  return `<details class="results-detail-disclosure ai-audit-story" ${options.open ? 'open' : ''}>
    <summary>AI audit story <span class="badge ${story.fallbackUsed ? 'badge--warning' : 'badge--neutral'}">${escapeHtml(fallbackLabel)}</span></summary>
    <div class="results-detail-disclosure-copy">User-facing trace of what AI and deterministic support contributed. Raw prompts and message bodies are not shown.</div>
    <div class="ai-audit-story__head">
      <div>
        <div class="results-driver-label">Assessment type</div>
        <strong>${escapeHtml(assessmentType)}</strong>
      </div>
      <div>
        <div class="results-driver-label">AI classification</div>
        <strong>${escapeHtml(story.classification || 'No AI classification saved')}</strong>
      </div>
      <div>
        <div class="results-driver-label">Risk cards filtered</div>
        <strong>${Number(story.risksFiltered || 0)}</strong>
      </div>
    </div>
    <p class="results-summary-copy ai-audit-story__summary">${escapeHtml(story.summary || 'No AI audit story has been saved yet.')}</p>
    <div class="ai-audit-story__grid">
      <section>
        <h4>Evidence used</h4>
        ${renderItems(story.evidenceUsed, 'No evidence references were recorded.')}
      </section>
      <section>
        <h4>Project exposure mapping used</h4>
        ${renderItems(story.projectEconomicsUsed, 'No project economics were used for this assessment.')}
      </section>
      <section>
        <h4>Proxy values used</h4>
        ${renderItems(story.proxyValuesUsed, 'No benchmark proxy values were recorded.')}
      </section>
      <section>
        <h4>Unknown high-impact values</h4>
        ${renderItems(story.unknownsCarriedForward, 'No high-impact unknowns were recorded.')}
      </section>
      <section>
        <h4>Assumptions challenged</h4>
        ${renderItems(assessment.assumptionRegister?.assumptions || assessment.decisionChallenge?.sensitivityFlags || [], 'No assumption challenge items were saved.')}
      </section>
      <section>
        <h4>Parameter suggestions</h4>
        ${renderItems(assessment.parameterCoach?.parameterRationales || [], 'No parameter suggestions were saved.')}
      </section>
      <section>
        <h4>Human edits</h4>
        ${renderItems(story.humanEdits, 'No human edit notes were recorded.')}
      </section>
      <section>
        <h4>Open warnings</h4>
        ${renderItems(story.openWarnings, 'No open AI audit warnings were recorded.')}
      </section>
    </div>
  </details>`;
}

function buildFallbackDecisionBriefForResults({
  assessment = {},
  r = {},
  projectResultsModel = null,
  executiveDecision = {},
  confidenceFrame = {}
} = {}) {
  const isProject = assessment.assessmentType === 'project_buyer' || assessment.assessmentType === 'project_seller';
  const unknowns = projectResultsModel?.isProject && Array.isArray(projectResultsModel.unknownHighImpactValues)
    ? projectResultsModel.unknownHighImpactValues.slice(0, 5)
    : [];
  const proxies = projectResultsModel?.isProject && Array.isArray(projectResultsModel.driverGroups?.proxyEstimated)
    ? projectResultsModel.driverGroups.proxyEstimated.slice(0, 4).map(item => `${item.label}: ${item.rangeLabel}`)
    : [];
  const posture = r?.toleranceBreached
    ? 'escalate'
    : unknowns.length >= 3
      ? 'needs_more_evidence'
      : r?.nearTolerance || r?.annualReviewTriggered || unknowns.length
        ? 'proceed_with_controls'
        : 'proceed';
  const recommendation = posture === 'escalate'
    ? 'Escalate and actively review the result before approval.'
    : posture === 'needs_more_evidence'
      ? 'Close the highest-impact evidence or project-economics gap before relying on this decision.'
      : posture === 'proceed_with_controls'
        ? 'Proceed only with owner review, controls, and follow-up on the main uncertainty.'
        : 'Proceed with monitoring under the current baseline assumptions.';
  const projectPlain = !isProject
    ? ''
    : unknowns.length
      ? `Project economics are thin. ${unknowns[0]} could change the recommendation.`
      : proxies.length
        ? 'Project exposure includes benchmark/proxy values. Treat them as directional until confirmed.'
        : projectResultsModel?.summary || 'Project-linked economics are included where values were known, estimated, derived, or proxied.';
  return normaliseDecisionBriefForResults({
    recommendation,
    decisionPosture: posture,
    why: isProject
      ? `${executiveDecision?.rationale || confidenceFrame?.implication || 'Use this as a working management view.'} ${projectPlain}`.trim()
      : executiveDecision?.rationale || confidenceFrame?.implication || 'Use this as enterprise risk decision support.',
    quantSummary: {
      eventLossP90: Number(r?.eventLoss?.p90 || r?.lm?.p90 || 0),
      annualLossMean: Number(r?.annualLoss?.mean || r?.ale?.mean || 0),
      annualLossP90: Number(r?.annualLoss?.p90 || r?.ale?.p90 || 0),
      toleranceExceeded: !!r?.toleranceBreached,
      annualReviewTriggered: !!r?.annualReviewTriggered,
      plainEnglish: r?.toleranceBreached
        ? 'The serious-event estimate is above tolerance.'
        : r?.nearTolerance
          ? 'The serious-event estimate is close to tolerance.'
          : 'The baseline estimate is within current tolerance.'
    },
    projectQuantSummary: {
      projectHorizonLossMean: Number(r?.projectHorizon?.loss?.mean || 0) || null,
      projectHorizonLossP90: Number(r?.projectHorizon?.loss?.p90 || 0) || null,
      lossAsPctOfProjectValue: Number(r?.projectHorizon?.lossAsPctOfProjectValue?.p90 ?? r?.projectHorizon?.lossAsPctOfProjectValue ?? 0) || null,
      lossAsPctOfMargin: Number(r?.projectHorizon?.lossAsPctOfMargin?.p90 ?? r?.projectHorizon?.lossAsPctOfMargin ?? 0) || null,
      primaryProjectDriver: projectResultsModel?.driverGroups?.quantified?.[0]?.label || projectResultsModel?.driverGroups?.proxyEstimated?.[0]?.label || '',
      projectInputQuality: projectResultsModel?.inputQuality?.label || '',
      proxyValuesUsed: proxies,
      unknownHighImpactInputs: unknowns,
      plainEnglish: projectPlain
    },
    mainDrivers: (projectResultsModel?.driverGroups?.quantified || projectResultsModel?.driverGroups?.proxyEstimated || []).slice(0, 4).map(item => ({
      driver: item.label,
      impact: item.rationale || item.rangeLabel,
      evidenceStrength: item.status === 'benchmark_proxy_driver' ? 'weak' : 'partial',
      sourceStatus: item.status === 'benchmark_proxy_driver' ? 'benchmark_proxy' : item.status || 'estimated'
    })),
    sensitivity: {
      summary: unknowns.length
        ? `${unknowns[0]} is the most decision-sensitive unknown.`
        : 'Challenge the largest cost range and event-frequency assumption before formal reliance.',
      mostSensitiveAssumption: unknowns[0] || '',
      changedDecisionIf: unknowns.length ? `${unknowns[0]} is materially different from the current assumption.` : ''
    },
    evidence: [],
    openChallenges: [],
    sparseDataWarning: unknowns.length ? `Project economics are thin. ${unknowns[0]} could change the recommendation.` : '',
    nextAction: {
      owner: isProject ? 'Project owner or finance partner' : 'Assessment owner',
      action: unknowns.length ? `Confirm ${unknowns[0]} before management sign-off.` : (executiveDecision?.priority || 'Review the baseline assumptions and monitor for change.'),
      due: unknowns.length ? 'Before approval' : 'Next review cycle',
      controlOrTreatment: unknowns.length ? 'Project economics validation' : 'Monitoring'
    },
    confidence: unknowns.length ? 'low' : proxies.length ? 'medium' : 'medium'
  });
}

const RESULTS_DECISION_BRIEF_FEEDBACK_REASONS = Object.freeze([
  { key: 'wrong_recommendation', label: 'Wrong recommendation' },
  { key: 'missing_action', label: 'Missing action' },
  { key: 'weak_evidence', label: 'Weak evidence' },
  { key: 'unclear_driver', label: 'Unclear driver' },
  { key: 'wrong_project_interpretation', label: 'Wrong project interpretation' },
  { key: 'overstates_confidence', label: 'Overstates confidence' },
  { key: 'too_verbose', label: 'Too verbose' },
  { key: 'too_generic', label: 'Too generic' }
]);

function normaliseResultsStructuredReason(value = '', targetType = 'decision_brief', eventType = 'decision_brief_regenerated') {
  if (typeof LearningStore !== 'undefined' && LearningStore && typeof LearningStore.normaliseStructuredAiFeedbackReason === 'function') {
    return LearningStore.normaliseStructuredAiFeedbackReason(targetType, value, eventType);
  }
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'other';
}

function recordResultsStructuredAiFeedback(assessment = {}, payload = {}) {
  const username = AuthService.getCurrentUser()?.username || '';
  const event = {
    assessmentType: assessment.assessmentType || 'enterprise_generic',
    scenarioLens: assessment.scenarioLens || null,
    primaryFamily: assessment.scenarioLens?.functionKey || '',
    buId: assessment.buId || '',
    functionKey: assessment.scenarioLens?.functionKey || '',
    lensKey: assessment.scenarioLens?.key || '',
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

function renderDecisionBriefFeedbackReasonChips() {
  return `<div class="citation-chips decision-brief-feedback-reasons" aria-label="Optional brief feedback reason">
    ${RESULTS_DECISION_BRIEF_FEEDBACK_REASONS.map(reason => `<button type="button" class="btn btn--ghost btn--sm" data-decision-brief-feedback-reason="${escapeHtml(reason.key)}" aria-pressed="false">${escapeHtml(reason.label)}</button>`).join('')}
  </div>`;
}

function getSelectedDecisionBriefFeedbackReason() {
  const selected = document.querySelector('[data-decision-brief-feedback-reason][aria-pressed="true"]');
  return selected ? normaliseResultsStructuredReason(selected.dataset.decisionBriefFeedbackReason || '', 'decision_brief', 'decision_brief_regenerated') : '';
}

function renderDecisionBriefPanel({ assessment = {}, r = {}, projectResultsModel = null, executiveDecision = {}, confidenceFrame = {}, savedDecisionBrief = null } = {}) {
  const saved = savedDecisionBrief || readSavedDecisionBrief(assessment);
  const brief = saved || buildFallbackDecisionBriefForResults({ assessment, r, projectResultsModel, executiveDecision, confidenceFrame });
  const meta = assessment?.decisionBriefMeta && typeof assessment.decisionBriefMeta === 'object' ? assessment.decisionBriefMeta : {};
  const quant = brief.quantSummary && typeof brief.quantSummary === 'object' ? brief.quantSummary : {};
  const project = brief.projectQuantSummary && typeof brief.projectQuantSummary === 'object' ? brief.projectQuantSummary : {};
  const isProject = assessment.assessmentType === 'project_buyer' || assessment.assessmentType === 'project_seller';
  const mainDrivers = Array.isArray(brief.mainDrivers) ? brief.mainDrivers.slice(0, 4) : [];
  const evidence = Array.isArray(brief.evidence) ? brief.evidence.slice(0, 4) : [];
  const openChallenges = Array.isArray(brief.openChallenges) ? brief.openChallenges.slice(0, 4) : [];
  const postureLabel = String(brief.decisionPosture || 'needs_more_evidence').replace(/_/g, ' ');
  const postureTone = brief.decisionPosture === 'escalate' || brief.decisionPosture === 'reject'
    ? 'badge--danger'
    : brief.decisionPosture === 'needs_more_evidence' || brief.decisionPosture === 'defer'
      ? 'badge--warning'
      : 'badge--success';
  const fmtPct = value => {
    const number = Number(value);
    return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : 'Not available';
  };
  return `<section class="decision-brief-panel anim-fade-in" aria-label="Decision Brief">
    <div class="decision-brief-panel__head">
      <div>
        <div class="results-driver-label">Decision Brief</div>
        <h2>${escapeHtml(brief.recommendation || 'Decision brief')}</h2>
      </div>
      <div class="decision-brief-panel__actions">
        <span class="badge ${postureTone}">${escapeHtml(postureLabel)}</span>
        ${renderDecisionBriefFeedbackReasonChips()}
        <button type="button" class="btn btn--secondary btn--sm" data-decision-brief-run>${saved ? 'Regenerate brief' : 'Generate AI brief'}</button>
      </div>
    </div>
    <p class="results-summary-copy decision-brief-panel__why">${escapeHtml(brief.why || 'No management brief has been generated yet.')}</p>
    ${brief.sparseDataWarning ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${escapeHtml(brief.sparseDataWarning)}</span></div>` : ''}
    <div class="results-top-value-strip results-top-value-strip--project mt-4">
      <div class="results-top-value-strip__item results-top-value-strip__item--value"><span>Event-loss P90</span><strong>${fmtCurrency(quant.eventLossP90 || 0)}</strong><small>${quant.toleranceExceeded ? 'Above tolerance' : 'Tolerance check'}</small></div>
      <div class="results-top-value-strip__item"><span>Annual mean</span><strong>${fmtCurrency(quant.annualLossMean || 0)}</strong><small>Annualized view</small></div>
      <div class="results-top-value-strip__item"><span>Annual P90</span><strong>${fmtCurrency(quant.annualLossP90 || 0)}</strong><small>${quant.annualReviewTriggered ? 'Review triggered' : 'Annual review check'}</small></div>
      <div class="results-top-value-strip__item"><span>Confidence</span><strong>${escapeHtml(String(brief.confidence || 'unknown'))}</strong><small>${meta.mode ? `${meta.mode === 'live' ? 'Live AI' : 'Deterministic fallback'}` : 'Current brief'}</small></div>
    </div>
    ${isProject ? `<div class="decision-brief-project mt-4">
      <div class="context-chip-panel"><span>Project view</span><strong>${escapeHtml(project.plainEnglish || 'Project economics summary not available.')}</strong><small>${escapeHtml(project.projectInputQuality || 'Input quality not stated')}</small></div>
      <div class="context-chip-panel"><span>Project-horizon P90</span><strong>${project.projectHorizonLossP90 == null ? 'Not computed' : fmtCurrency(project.projectHorizonLossP90)}</strong><small>Annualized metrics remain separate</small></div>
      <div class="context-chip-panel"><span>Loss as % of value / margin</span><strong>${escapeHtml(`${fmtPct(project.lossAsPctOfProjectValue)} / ${fmtPct(project.lossAsPctOfMargin)}`)}</strong><small>Only shown when denominator is available</small></div>
    </div>
    <div class="decision-brief-project mt-4">
      <div class="context-chip-panel"><span>Proxy values</span><strong>${project.proxyValuesUsed?.length ? escapeHtml(project.proxyValuesUsed.slice(0, 3).join(' · ')) : 'None listed'}</strong><small>Proxy values are not confirmed project values</small></div>
      <div class="context-chip-panel"><span>Unknown but important</span><strong>${project.unknownHighImpactInputs?.length ? escapeHtml(project.unknownHighImpactInputs.slice(0, 3).join(' · ')) : 'None listed'}</strong><small>Could change the decision</small></div>
      <div class="context-chip-panel"><span>Primary project driver</span><strong>${escapeHtml(project.primaryProjectDriver || 'Not identified')}</strong><small>${escapeHtml(project.projectInputQuality || 'Project input quality')}</small></div>
    </div>` : ''}
    <div class="decision-brief-grid mt-4">
      <div class="results-trace-row">
        <div class="results-trace-row__head"><strong>Main drivers</strong></div>
        ${mainDrivers.length ? mainDrivers.map(item => `<p class="results-summary-copy"><strong>${escapeHtml(item.driver || 'Driver')}</strong>: ${escapeHtml(item.impact || '')} <span class="badge">${escapeHtml(item.sourceStatus || 'unknown')}</span></p>`).join('') : '<p class="results-summary-copy">No main drivers listed yet.</p>'}
      </div>
      <div class="results-trace-row">
        <div class="results-trace-row__head"><strong>Sensitivity</strong></div>
        <p class="results-summary-copy">${escapeHtml(brief.sensitivity?.summary || 'No sensitivity summary available.')}</p>
        ${brief.sensitivity?.changedDecisionIf ? `<div class="results-comparison-foot">${escapeHtml(brief.sensitivity.changedDecisionIf)}</div>` : ''}
      </div>
      <div class="results-trace-row">
        <div class="results-trace-row__head"><strong>Evidence and open challenges</strong></div>
        ${evidence.length ? evidence.map(item => `<p class="results-summary-copy">${escapeHtml(String(item.claim || item.text || item))}</p>`).join('') : '<p class="results-summary-copy">No evidence highlights listed.</p>'}
        ${openChallenges.length ? `<div class="results-comparison-foot">${openChallenges.map(item => escapeHtml(String(item.text || item.title || item))).join(' ')}</div>` : ''}
      </div>
      <div class="results-trace-row">
        <div class="results-trace-row__head"><strong>Next action</strong></div>
        <p class="results-summary-copy"><strong>${escapeHtml(brief.nextAction?.owner || 'Owner not set')}</strong>: ${escapeHtml(brief.nextAction?.action || 'No next action listed.')}</p>
        <div class="results-comparison-foot">${escapeHtml([brief.nextAction?.due, brief.nextAction?.controlOrTreatment].filter(Boolean).join(' · '))}</div>
      </div>
    </div>
  </section>`;
}

function normaliseResultsBadgeTone(tone = 'neutral') {
  const value = String(tone || 'neutral').trim().toLowerCase();
  return ['success', 'danger', 'warning', 'neutral', 'gold'].includes(value) ? value : 'neutral';
}

function renderResultsCockpitBadge(item = {}) {
  const label = String(item?.label || '').trim();
  const value = String(item?.value || '').trim() || 'Not stated';
  const tone = normaliseResultsBadgeTone(item?.tone);
  return `<span class="badge badge--${tone} results-decision-cockpit__badge">
    ${label ? `<small>${escapeHtml(label)}</small>` : ''}
    ${escapeHtml(value)}
  </span>`;
}

function renderResultsCockpitMetric(item = {}) {
  const tone = normaliseResultsBadgeTone(item?.tone);
  return `<article class="results-cockpit-metric results-decision-cockpit__metric results-decision-cockpit__metric--${tone}">
    <span class="results-cockpit-metric__label">${escapeHtml(String(item?.label || 'Metric'))}</span>
    <strong>${escapeHtml(String(item?.value || 'Not available'))}</strong>
    <span class="results-cockpit-metric__copy">${escapeHtml(String(item?.copy || ''))}</span>
    ${item?.explain ? `<button type="button" class="results-metric-explain" data-results-explain="${escapeHtml(String(item.explain))}" aria-expanded="false">Explain this number</button>` : ''}
  </article>`;
}

function renderResultsCockpitValueList(title = '', items = [], emptyCopy = '') {
  const safeItems = Array.isArray(items) ? items : [];
  return `<article class="results-decision-cockpit__list-card">
    <div class="results-driver-label">${escapeHtml(String(title || 'Values'))}</div>
    ${safeItems.length
      ? `<div class="results-decision-cockpit__value-list">
          ${safeItems.slice(0, 5).map(item => `<div class="results-decision-cockpit__value-row">
            <div>
              <strong>${escapeHtml(String(item?.label || item || 'Value'))}</strong>
              <span>${escapeHtml(String(item?.value || item?.status || item?.confidence || ''))}</span>
            </div>
            ${item?.status ? `<span class="badge badge--neutral">${escapeHtml(String(item.status).replace(/_/g, ' '))}</span>` : ''}
          </div>`).join('')}
        </div>`
      : `<p class="results-summary-copy">${escapeHtml(String(emptyCopy || 'Nothing listed yet.'))}</p>`}
  </article>`;
}

function renderResultsCockpitStringList(title = '', items = [], emptyCopy = '') {
  const safeItems = Array.isArray(items) ? items.map(item => String(item || '').trim()).filter(Boolean) : [];
  return `<article class="results-decision-cockpit__list-card">
    <div class="results-driver-label">${escapeHtml(String(title || 'Items'))}</div>
    ${safeItems.length
      ? `<div class="results-decision-cockpit__pill-list">${safeItems.slice(0, 6).map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
      : `<p class="results-summary-copy">${escapeHtml(String(emptyCopy || 'Nothing listed yet.'))}</p>`}
  </article>`;
}

function renderResultsAiJourneyStrip(aiJourney = {}) {
  if (!aiJourney || typeof aiJourney !== 'object' || !Array.isArray(aiJourney.outputs)) return '';
  const outputs = aiJourney.outputs.filter(item => item && (item.hasOutput || item.refreshRecommended)).slice(0, 6);
  const needsAction = aiJourney.staleCount > 0 || aiJourney.emptyCount > 0;
  return `<div class="ai-product-state-strip ${needsAction ? 'ai-product-state-strip--warning' : ''} results-decision-cockpit__ai-strip">
    <div>
      <strong>${escapeHtml(aiJourney.recommendedAction || 'Review AI support')}</strong>
      <span>${escapeHtml(aiJourney.recommendedReason || `${aiJourney.modeLabel || 'AI support'} · ${aiJourney.liveCount || 0} live · ${aiJourney.fallbackCount || 0} fallback · ${aiJourney.staleCount || 0} stale`)}</span>
    </div>
    <div class="ai-product-state-strip__badges">
      <span class="badge badge--${normaliseResultsBadgeTone(aiJourney.tone || 'neutral')}">${escapeHtml(aiJourney.modeLabel || 'AI support')}</span>
      ${outputs.map(item => `<span class="badge badge--${normaliseResultsBadgeTone(item.freshnessTone || 'neutral')}">${escapeHtml(item.label)}: ${escapeHtml(item.freshnessLabel || 'Saved')}</span>`).join('')}
    </div>
  </div>`;
}

function renderResultsDecisionCockpit(model = {}) {
  if (!model || typeof model !== 'object') return '';
  const metrics = Array.isArray(model.economicsMetrics) ? model.economicsMetrics : [];
  const badges = Array.isArray(model.badges) ? model.badges : [];
  const challenge = model.challenge && typeof model.challenge === 'object' ? model.challenge : {};
  const emptyStates = Array.isArray(model.emptyStates) ? model.emptyStates : [];
  const nextAction = model.nextAction && typeof model.nextAction === 'object' ? model.nextAction : {};
  const challengeRisks = Array.isArray(challenge.decisionRisks) ? challenge.decisionRisks : [];
  const stressTests = Array.isArray(challenge.stressTests) ? challenge.stressTests : [];
  const changedDecisionIf = Array.isArray(challenge.changedDecisionIf) ? challenge.changedDecisionIf : [];
  const cockpitClass = [
    'results-decision-cockpit',
    `results-decision-cockpit--${normaliseResultsBadgeTone(model.decisionPostureTone)}`,
    model.isProject ? 'results-decision-cockpit--project' : 'results-decision-cockpit--generic'
  ].join(' ');
  const challengeSummary = String(challenge.summary || '').trim()
    || (challenge.saved ? 'Challenge Agent output is saved, but no short summary was provided.' : 'Run the Challenge Agent to capture decision-sensitive assumptions and stress cases.');
  return `<section class="${cockpitClass}" aria-label="Decision Cockpit">
    <div class="results-decision-cockpit__head">
      <div>
        <div class="results-driver-label">${escapeHtml(String(model.assessmentTypeLabel || 'Risk assessment'))}</div>
        <h2>${escapeHtml(String(model.recommendation || 'Review result'))}</h2>
      </div>
      <div class="results-decision-cockpit__actions">
        <button type="button" class="btn btn--secondary btn--sm" data-decision-brief-run>${model.aiMode?.label === 'No AI outputs' ? 'Generate AI brief' : 'Refresh brief'}</button>
        <button type="button" class="btn btn--secondary btn--sm" data-decision-challenge-run>${challenge.saved ? 'Refresh Challenge Agent' : 'Run Challenge Agent'}</button>
      </div>
    </div>
    <div class="results-decision-cockpit__brief-grid">
      <article class="results-decision-cockpit__recommendation">
        <div class="results-driver-label">Recommendation</div>
        <p>${escapeHtml(String(model.why || 'Use this as the current decision-support read.'))}</p>
        ${model.sparseDataWarning ? `<div class="banner banner--warning mt-4"><span class="banner-icon">!</span><span class="banner-text">${escapeHtml(String(model.sparseDataWarning))}</span></div>` : ''}
      </article>
      <article class="results-decision-cockpit__next-action">
        <div class="results-driver-label">Next action</div>
        <strong>${escapeHtml(String(nextAction.action || 'Confirm the next management step.'))}</strong>
        <span>${escapeHtml([nextAction.owner, nextAction.due, nextAction.controlOrTreatment].filter(Boolean).join(' · ') || 'Owner not set')}</span>
      </article>
    </div>
    <div class="results-decision-cockpit__metrics">
      ${metrics.map(renderResultsCockpitMetric).join('')}
    </div>
    <div class="results-decision-cockpit__quality-strip">
      ${badges.map(renderResultsCockpitBadge).join('')}
    </div>
    ${renderResultsAiJourneyStrip(model.aiJourney)}
    <div class="results-decision-cockpit__known-grid">
      ${model.isProject
        ? `
          ${renderResultsCockpitValueList('Known project values', model.knownValues, 'No confirmed project values yet.')}
          ${renderResultsCockpitValueList('Estimated/proxy values', model.estimatedValues, 'No estimated or proxy project values are active.')}
          ${renderResultsCockpitStringList('Unknown but important', model.unknownHighImpactValues, 'No high-impact unknowns flagged.')}
        `
        : `
          ${renderResultsCockpitStringList('Main drivers', [model.mainDriver], 'No main driver has been identified yet.')}
          ${renderResultsCockpitStringList('Evidence gaps', model.evidenceGaps, 'No evidence gaps listed yet.')}
          ${renderResultsCockpitStringList('Key assumptions', model.assumptions, 'No structured assumptions listed yet.')}
        `}
    </div>
    <div class="results-decision-cockpit__challenge">
      <div class="results-decision-cockpit__challenge-main">
        <div class="results-driver-label">Challenge Agent</div>
        <strong>${escapeHtml(challenge.saved ? 'Decision challenge saved' : 'Challenge not run yet')}</strong>
        <p>${escapeHtml(challengeSummary)}</p>
      </div>
      <div class="results-decision-cockpit__challenge-grid">
        ${renderResultsCockpitStringList('Changed decision if', changedDecisionIf, 'No changed-decision condition listed yet.')}
        ${renderResultsCockpitStringList('Evidence gaps', model.evidenceGaps, 'No evidence gaps listed yet.')}
        ${renderResultsCockpitStringList('Assumptions to challenge', model.assumptions, 'No assumptions listed yet.')}
      </div>
      ${challengeRisks.length ? `<div class="results-decision-cockpit__risk-row">
        ${challengeRisks.map(item => `<div class="results-trace-row">
          <div class="results-trace-row__head">
            <strong>${escapeHtml(item.title || 'Decision risk')}</strong>
            <span class="badge badge--${normaliseResultsBadgeTone(item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warning' : 'neutral')}">${escapeHtml(item.severity || 'medium')}</span>
          </div>
          <p class="results-summary-copy">${escapeHtml(item.explanation || '')}</p>
        </div>`).join('')}
      </div>` : ''}
      ${stressTests.length ? `<div class="results-decision-cockpit__stress-row">
        ${stressTests.map(item => `<div class="results-trace-row">
          <div class="results-trace-row__head">
            <strong>${escapeHtml(item.title || 'Stress case')}</strong>
            <span class="badge badge--neutral">${escapeHtml(item.confidence || 'medium')} confidence</span>
          </div>
          <p class="results-summary-copy">${escapeHtml(item.rationale || 'Stress case available.')}</p>
          <div class="results-action-row" style="margin-top:var(--sp-3)">
            <button type="button" class="btn btn--secondary btn--sm" data-decision-challenge-stress="${escapeHtml(String(item.id || ''))}">Run stress case</button>
          </div>
        </div>`).join('')}
      </div>` : ''}
    </div>
    ${emptyStates.length ? `<div class="results-decision-cockpit__empty-states">
      ${emptyStates.slice(0, 6).map(item => `<div>
        <strong>${escapeHtml(item.label || 'Empty state')}</strong>
        <span>${escapeHtml(item.copy || '')}</span>
      </div>`).join('')}
    </div>` : ''}
  </section>`;
}

function buildDecisionBriefPayload(assessment = {}, r = {}, technicalInputs = {}, runMetadata = {}) {
  return {
    assessmentType: String(assessment.assessmentType || 'enterprise_generic'),
    scenario: String(assessment.enhancedNarrative || assessment.narrative || assessment.scenarioTitle || ''),
    structuredScenario: assessment.structuredScenario && typeof assessment.structuredScenario === 'object' ? assessment.structuredScenario : {},
    scenarioLens: assessment.scenarioLens && typeof assessment.scenarioLens === 'object' ? assessment.scenarioLens : {},
    projectContext: assessment.projectContext && typeof assessment.projectContext === 'object' ? assessment.projectContext : {},
    projectExposure: assessment.projectExposure && typeof assessment.projectExposure === 'object' ? assessment.projectExposure : {},
    simulationResult: r && typeof r === 'object' ? r : {},
    parameters: buildSensitivitySimulationParams(technicalInputs, r, runMetadata),
    assumptionRegister: assessment.assumptionRegister && typeof assessment.assumptionRegister === 'object' ? assessment.assumptionRegister : {},
    parameterCoach: assessment.parameterCoach && typeof assessment.parameterCoach === 'object' ? assessment.parameterCoach : {},
    evidenceMap: assessment.evidenceMap && typeof assessment.evidenceMap === 'object' ? assessment.evidenceMap : {},
    decisionChallenge: assessment.decisionChallenge && typeof assessment.decisionChallenge === 'object' ? assessment.decisionChallenge : {},
    treatments: Array.isArray(assessment.treatments) ? assessment.treatments : [],
    riskAppetite: {
      threshold: Number(r?.threshold || technicalInputs?.threshold || getToleranceThreshold()),
      annualReviewThreshold: Number(r?.annualReviewThreshold || technicalInputs?.annualReviewThreshold || getAnnualReviewThreshold())
    },
    adminSettings: typeof AdminService !== 'undefined' && AdminService?.getSettings ? AdminService.getSettings() : {},
    traceLabel: 'Decision brief'
  };
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

function getResultsTreatmentTradeoffUnknowns(assessment = {}) {
  const exposure = assessment?.projectExposure && typeof assessment.projectExposure === 'object' ? assessment.projectExposure : {};
  const quality = exposure.projectInputQuality && typeof exposure.projectInputQuality === 'object' ? exposure.projectInputQuality : {};
  const missingInputs = Array.isArray(exposure.missingInputs) ? exposure.missingInputs : [];
  const drivers = Array.isArray(exposure.financialDrivers) ? exposure.financialDrivers : [];
  return Array.from(new Set([
    ...(Array.isArray(quality.unknownHighImpactInputs) ? quality.unknownHighImpactInputs : []),
    ...missingInputs.map(item => item?.label || item?.field || item),
    ...drivers
      .filter(item => /unquantified|unknown/i.test(String(item?.driverStatus || item?.source || '')))
      .flatMap(item => [
        item?.label || item?.id || item?.driverType,
        ...(Array.isArray(item?.missingInputs) ? item.missingInputs : [])
      ])
  ].map(item => String(item || '').trim()).filter(Boolean))).slice(0, 10);
}

function getResultsProjectEconomicsTradeoff(assessment = {}, unknowns = []) {
  const assessmentType = String(assessment?.assessmentType || 'enterprise_generic').trim();
  const firstUnknown = unknowns[0] || '';
  if (assessmentType === 'project_buyer') {
    return `Buyer-side economics should improve only where the treatment reduces delay, reprocurement, stranded spend, or improves recoveries.${firstUnknown ? ` Benefit cannot be quantified until ${firstUnknown} is known.` : ''}`;
  }
  if (assessmentType === 'project_seller') {
    return `Seller-side economics should improve only where the treatment protects margin, delivery cost, LD/SLA exposure, termination risk, or revenue timing.${firstUnknown ? ` Benefit cannot be quantified until ${firstUnknown} is known.` : ''}`;
  }
  return 'No project economics effect is assumed for this generic enterprise comparison.';
}

function normaliseResultsTreatmentTradeoff(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const fallbackOptions = Array.isArray(fallback.options) ? fallback.options : [];
  const sourceOptions = Array.isArray(source.options) ? source.options : [];
  const options = (sourceOptions.length ? sourceOptions : fallbackOptions)
    .map((item, index) => {
      const option = item && typeof item === 'object' ? item : {};
      const fallbackOption = fallbackOptions[index] || fallbackOptions[0] || {};
      return {
        title: String(option.title || fallbackOption.title || 'Treatment option').trim(),
        affectsFrequency: String(option.affectsFrequency || fallbackOption.affectsFrequency || '').trim(),
        affectsVulnerability: String(option.affectsVulnerability || fallbackOption.affectsVulnerability || '').trim(),
        affectsEventLoss: String(option.affectsEventLoss || fallbackOption.affectsEventLoss || '').trim(),
        affectsAnnualizedLoss: String(option.affectsAnnualizedLoss || fallbackOption.affectsAnnualizedLoss || '').trim(),
        affectsProjectHorizonLoss: String(option.affectsProjectHorizonLoss || fallbackOption.affectsProjectHorizonLoss || '').trim(),
        affectsProjectEconomics: String(option.affectsProjectEconomics || fallbackOption.affectsProjectEconomics || '').trim(),
        affectedUnknownDrivers: Array.from(new Set((Array.isArray(option.affectedUnknownDrivers) ? option.affectedUnknownDrivers : fallbackOption.affectedUnknownDrivers || [])
          .map(item => String(item || '').trim())
          .filter(Boolean))).slice(0, 8),
        evidenceStrength: String(option.evidenceStrength || fallbackOption.evidenceStrength || 'weak').trim(),
        residualUncertainty: String(option.residualUncertainty || fallbackOption.residualUncertainty || '').trim(),
        implementationBurden: String(option.implementationBurden || fallbackOption.implementationBurden || 'medium').trim(),
        rationale: String(option.rationale || fallbackOption.rationale || '').trim(),
        bestFor: String(option.bestFor || fallbackOption.bestFor || '').trim(),
        limitation: String(option.limitation || fallbackOption.limitation || '').trim()
      };
    })
    .filter(item => item.title || item.rationale)
    .slice(0, 4);
  return {
    summary: String(source.summary || fallback.summary || '').trim(),
    options,
    recommendedPath: String(source.recommendedPath || fallback.recommendedPath || '').trim()
  };
}

function renderTreatmentTradeoffCards(comparison) {
  const tradeoff = comparison?.treatmentTradeoff && typeof comparison.treatmentTradeoff === 'object'
    ? comparison.treatmentTradeoff
    : null;
  const options = Array.isArray(tradeoff?.options) ? tradeoff.options : [];
  if (!tradeoff || !options.length) return '';
  return `<div class="results-comparison-tradeoff">
    <div class="wizard-premium-head">
      <div>
        <div class="results-driver-label">Treatment trade-off</div>
        <div class="results-summary-copy" style="margin-top:var(--sp-2)">${escapeHtml(tradeoff.summary || 'Review what the treatment changes, what remains uncertain, and what implementation burden it creates.')}</div>
      </div>
      <span class="badge badge--gold">${escapeHtml(tradeoff.recommendedPath ? 'Recommended path ready' : 'Review trade-off')}</span>
    </div>
    <div class="results-comparison-guidance-grid" style="margin-top:var(--sp-4)">
      ${options.map(option => `<div class="results-comparison-guidance-card">
        <span class="results-driver-label">${escapeHtml(option.implementationBurden || 'medium')} burden · ${escapeHtml(option.evidenceStrength || 'weak')} evidence</span>
        <strong>${escapeHtml(option.title || 'Treatment option')}</strong>
        <span>${escapeHtml(option.rationale || option.bestFor || 'Review the assumptions this treatment would actually change.')}</span>
        <div class="results-comparison-foot" style="margin-top:var(--sp-3)"><strong>Frequency:</strong> ${escapeHtml(option.affectsFrequency || 'No clear frequency effect recorded.')}</div>
        <div class="results-comparison-foot"><strong>Vulnerability:</strong> ${escapeHtml(option.affectsVulnerability || 'No clear vulnerability effect recorded.')}</div>
        <div class="results-comparison-foot"><strong>Event loss:</strong> ${escapeHtml(option.affectsEventLoss || 'No clear event-loss effect recorded.')}</div>
        <div class="results-comparison-foot"><strong>Annualized loss:</strong> ${escapeHtml(option.affectsAnnualizedLoss || 'Rerun the model to quantify annualized movement.')}</div>
        <div class="results-comparison-foot"><strong>Project horizon:</strong> ${escapeHtml(option.affectsProjectHorizonLoss || 'No project-horizon effect recorded.')}</div>
        <div class="results-comparison-foot"><strong>Project economics:</strong> ${escapeHtml(option.affectsProjectEconomics || 'No project economics effect recorded.')}</div>
        ${option.affectedUnknownDrivers?.length ? `<div class="citation-chips" style="margin-top:var(--sp-3)">${option.affectedUnknownDrivers.map(item => `<span class="badge badge--warning">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        <div class="results-comparison-foot" style="margin-top:var(--sp-3)"><strong>Uncertainty:</strong> ${escapeHtml(option.residualUncertainty || option.limitation || 'Validate evidence before relying on the treatment delta.')}</div>
      </div>`).join('')}
    </div>
    ${tradeoff.recommendedPath ? `<div class="results-comparison-rail-note results-comparison-rail-note--strong" style="margin-top:var(--sp-4)">${escapeHtml(tradeoff.recommendedPath)}</div>` : ''}
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
      ${renderTreatmentTradeoffCards(comparison)}
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

function renderResultsExecutiveCockpit({
  assessment,
  r,
  statusClass,
  statusIcon,
  statusTitle,
  statusDetail,
  executiveHeadline,
  executiveAction,
  executiveDecision,
  lifecycle,
  exceedancePct,
  completedLabel,
  assessmentValue,
  decisionReadiness = null,
  rolePresentation,
  boardroomMode
}) {
  const valueUsd = Number(
    assessmentValue?.cost?.totalDirectionalValueUsd
    || assessmentValue?.cost?.externalEquivalentValueUsd
    || assessmentValue?.cost?.internalCostAvoidedUsd
    || 0
  );
  const valueLabel = valueUsd > 0 ? fmtCurrency(valueUsd) : 'Not estimated';
  const hoursSaved = String(assessmentValue?.directional?.internalHoursAvoidedLabel || '').trim() || 'Not estimated';
  const readinessScore = decisionReadiness?.score ?? assessment?.decisionReadiness?.score ?? assessment?.assessmentManagerTrace?.readiness?.score ?? null;
  const readinessLabel = Number.isFinite(Number(readinessScore))
    ? `${Math.round(Number(readinessScore))}/100 readiness`
    : String(lifecycle?.label || 'Review readiness');
  const roleNoteTitle = String(rolePresentation?.executiveNoteTitle || 'Business-unit read');
  const roleNote = String(rolePresentation?.executiveNote || 'Use this as the current decision-support view before more work starts.');
  const metaItems = [
    assessment?.buName || 'No business unit',
    assessment?.geography || 'No geography',
    completedLabel
  ].filter(Boolean);
  const cockpitTone = r?.criticalCondition ? 'danger' : r?.toleranceBreached ? 'danger' : r?.nearTolerance ? 'warning' : 'success';
  const eventFoot = r?.toleranceBreached
    ? 'Above the current event tolerance.'
    : r?.nearTolerance
      ? 'Above the warning trigger, below tolerance.'
      : 'Below the current warning trigger.';
  const annualFoot = r?.annualReviewTriggered
    ? 'At or above the annual review trigger.'
    : 'Average-year planning view.';

  const metrics = [
    {
      tone: 'value',
      label: 'Estimated value created',
      value: valueLabel,
      copy: 'Directional effort and advisory equivalent',
      foot: 'Not booked savings; use as leadership framing.'
    },
    {
      tone: 'success',
      label: 'Estimated analyst time saved',
      value: hoursSaved,
      copy: 'Manual analysis avoided',
      foot: String(assessmentValue?.directional?.manualBaselineLabel || 'Compared with the manual baseline.')
    },
    {
      tone: cockpitTone,
      label: 'Event-loss P90',
      value: fmtCurrency(r?.eventLoss?.p90 || 0),
      copy: 'Severe single-event exposure',
      foot: eventFoot,
      explain: 'eventLoss.p90'
    },
    {
      tone: 'warning',
      label: 'Expected annual loss',
      value: fmtCurrency(r?.annualLoss?.mean || 0),
      copy: 'Average annual exposure',
      foot: annualFoot,
      explain: 'annualLoss.mean'
    }
  ];

  return `<section class="results-executive-cockpit results-executive-cockpit--${escapeHtml(cockpitTone)} ${boardroomMode ? 'results-executive-cockpit--boardroom' : ''}">
    <div class="results-executive-cockpit__main">
      <div class="results-executive-cockpit__eyebrow">
        <span>${boardroomMode ? 'Boardroom decision cockpit' : 'Executive decision cockpit'}</span>
        <span class="badge ${r?.criticalCondition || r?.toleranceBreached ? 'badge--danger' : r?.nearTolerance ? 'badge--warning' : 'badge--success'}">${escapeHtml(String(statusTitle || 'Review'))}</span>
        <span class="badge badge--${escapeHtml(String(lifecycle?.tone || 'neutral'))}">${escapeHtml(String(lifecycle?.label || 'Ready for review'))}</span>
      </div>
      <h2 class="results-executive-cockpit__title">${executiveHeadline}</h2>
      <p class="results-executive-cockpit__copy">${escapeHtml(String(statusDetail || 'Use this result as the current decision-support view.'))}</p>
      <div class="results-executive-cockpit__action">
        <span class="results-driver-label">Immediate management move</span>
        <strong>${escapeHtml(String(executiveDecision?.decision || 'Review'))}</strong>
        <span>${escapeHtml(String(executiveAction || executiveDecision?.priority || 'Confirm the next management step for this scenario.'))}</span>
      </div>
      <div class="results-executive-cockpit__meta">${metaItems.map(item => `<span>${escapeHtml(String(item))}</span>`).join('')}</div>
    </div>
    <div class="results-executive-cockpit__side">
      <div class="results-executive-cockpit__signal">
        <div class="results-signal-ring ${statusClass}">
          <div class="results-signal-ring-inner">${statusIcon}</div>
        </div>
        <div>
          <strong>${exceedancePct == null ? 'Not assessed' : `${exceedancePct}% tolerance exceedance`}</strong>
          <span>${escapeHtml(readinessLabel)} · model limit test, not incident likelihood</span>
        </div>
      </div>
      <div class="results-cockpit-metrics">
        ${metrics.map(metric => `<article class="results-cockpit-metric results-cockpit-metric--${escapeHtml(metric.tone)}">
          <span class="results-cockpit-metric__label">${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <span class="results-cockpit-metric__copy">${escapeHtml(metric.copy)}</span>
          <span class="results-cockpit-metric__foot">${escapeHtml(metric.foot)}</span>
          ${metric.explain ? `<button type="button" class="results-metric-explain" data-results-explain="${escapeHtml(metric.explain)}" aria-expanded="false">Explain this number</button>` : ''}
        </article>`).join('')}
      </div>
      <div class="results-executive-cockpit__note">
        <span class="results-driver-label">${escapeHtml(roleNoteTitle)}</span>
        <p>${escapeHtml(roleNote)}</p>
      </div>
    </div>
  </section>`;
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
      summary: 'The platform used deterministic fallback output instead of a clean live AI result. Review the evidence and challenge layers before relying on the output.'
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

function hasAssessmentLocalFallback(assessment = {}) {
  const draftQualityState = String(assessment?.draft?.aiQualityState || assessment?.aiQualityState || '').trim().toLowerCase();
  const runtimeGuardrails = Array.isArray(assessment?.results?.runMetadata?.runtimeGuardrails)
    ? assessment.results.runMetadata.runtimeGuardrails
    : [];
  return draftQualityState === 'fallback'
    || runtimeGuardrails.some(item => /fallback/i.test(String(item || '')));
}

function renderExecutiveBenchmarkContext(assessment, results, runMetadata) {
  const references = Array.isArray(assessment?.benchmarkReferences) ? assessment.benchmarkReferences.filter(Boolean) : [];
  const requestedGeographies = Array.from(new Set(
    references
      .flatMap(ref => Array.isArray(ref?.requestedGeographies) ? ref.requestedGeographies : (ref?.requestedGeography ? [ref.requestedGeography] : []))
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ));
  const matchedGeographies = Array.from(new Set(
    references
      .flatMap(ref => Array.isArray(ref?.matchedGeographies) ? ref.matchedGeographies : (ref?.geography ? [ref.geography] : []))
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ));
  const thresholdConfig = runMetadata?.thresholdConfigUsed || {};
  const warningThreshold = Number(results?.warningThreshold || thresholdConfig.warningThreshold || 0);
  const toleranceThreshold = Number(results?.threshold || thresholdConfig.eventToleranceThreshold || 0);
  const annualReviewThreshold = Number(results?.annualReviewThreshold || thresholdConfig.annualReviewThreshold || 0);
  const triggerCount = [warningThreshold, toleranceThreshold, annualReviewThreshold].filter(value => Number(value) > 0).length;
  const topReferences = references
    .map(ref => String(ref?.sourceTitle || ref?.title || ref?.label || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const geographyCoverage = Array.from(new Set(
    references
      .map(ref => String(ref?.coverageSummary || '').trim())
      .filter(Boolean)
  ));
  const geographyFitLabel = references.some(ref => ref?.coverageType === 'global-fallback')
    ? 'Global fallback used'
    : references.some(ref => ref?.coverageType === 'multi-region-normalized' || ref?.coverageLabel === 'Multi-region input')
      ? 'Multi-region normalized'
      : references.some(ref => ref?.coverageType === 'regional-umbrella' || ref?.coverageType === 'national-proxy')
        ? 'Regional proxy used'
        : references.length
          ? 'Exact or direct regional fit'
          : 'Scenario baseline only';
  const benchmarkBasis = String(assessment?.benchmarkBasis || '').trim();
  const basisSummary = benchmarkBasis
    ? benchmarkBasis
    : references.length
      ? 'Published benchmark references were used where they mapped cleanly, then scenario-calibration baselines were used only where direct comparators were thin.'
      : 'Governance thresholds and scenario-calibration baselines were used because no published benchmark references were saved for this result.';
  const geographyFitSummary = references.some(ref => ref?.coverageType === 'global-fallback' || ref?.coverageType === 'multi-region-normalized' || ref?.coverageLabel === 'Multi-region input')
    ? (benchmarkBasis || geographyCoverage[0] || '')
    : (geographyCoverage[0] || 'The current result will call out when benchmark coverage used a regional proxy or global best-practice fallback.');
  const qualitySignal = buildAssessmentAiQualitySignal(assessment);
  return `<section class="card card--elevated anim-fade-in results-benchmark-band">
    <div class="results-section-heading">Benchmark context</div>
    <div class="form-help" style="margin-top:8px">Benchmarked against ${references.length || 'no saved'} reference${references.length === 1 ? '' : 's'} and ${triggerCount} governance trigger${triggerCount === 1 ? '' : 's'} so leadership can see what anchored the result.${requestedGeographies.length ? ` Requested region${requestedGeographies.length === 1 ? '' : 's'}: ${escapeHtml(requestedGeographies.join(', '))}.` : ''}</div>
    <div class="premium-guidance-strip premium-guidance-strip--${escapeHtml(String(qualitySignal.tone || 'support'))} results-guidance-strip" style="margin-top:var(--sp-4)">
      <div class="premium-guidance-strip__main">
        <div class="premium-guidance-strip__label">Trust signal</div>
        <strong>${escapeHtml(String(qualitySignal.label || 'Working guidance'))}</strong>
        <div class="premium-guidance-strip__copy">${escapeHtml(String(qualitySignal.summary || 'The platform is showing how strongly the current result is grounded before it is used in a leadership discussion.'))}</div>
      </div>
      <div class="premium-guidance-strip__meta">
        <span class="badge badge--neutral">${references.length ? `${references.length} saved reference${references.length === 1 ? '' : 's'}` : 'Scenario baseline only'}</span>
        <span class="badge badge--gold">${triggerCount} governance trigger${triggerCount === 1 ? '' : 's'}</span>
        <span class="badge badge--neutral">${escapeHtml(geographyFitLabel)}</span>
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
        <span class="results-value-card__label">Geography fit</span>
        <strong>${escapeHtml(geographyFitLabel)}</strong>
        <span class="results-value-card__foot">${escapeHtml(geographyFitSummary)}</span>
      </article>
      <article class="results-value-card">
        <span class="results-value-card__label">Comparator region used</span>
        <strong>${escapeHtml(matchedGeographies.length ? matchedGeographies.join(', ') : 'Scenario baseline')}</strong>
        <span class="results-value-card__foot">${escapeHtml(requestedGeographies.length ? `Requested: ${requestedGeographies.join(', ')}` : 'No explicit assessment geography was saved with this result.')}</span>
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
    ${renderResultsEvidenceMapPanel(assessment)}
    ${evidenceGapPlan.length ? renderEvidenceGapActionPlan(evidenceGapPlan, {
      title: 'Best evidence to collect next',
      subtitle: 'Use these to strengthen confidence, narrow the range, or improve the treatment decision before the next review.',
      compact: true,
      lowEmphasis: true
    }) : ''}
    ${explanationPanel}
    ${renderAssumptionTraceabilityPanel({ assessment, assessmentIntelligence, citations, primaryGrounding, supportingReferences, missingInformation })}
    ${renderAssessmentObligationBasisBlock(assessment, { compact: true })}
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

function normaliseAssessmentObligationBasis(assessment = {}) {
  const source = assessment?.obligationBasis && typeof assessment.obligationBasis === 'object'
    ? assessment.obligationBasis
    : (assessment?.resolvedObligationContext && typeof assessment.resolvedObligationContext === 'object'
        ? {
            ...assessment.resolvedObligationContext,
            allResolved: Array.isArray(assessment?.resolvedObligations) ? assessment.resolvedObligations : assessment.resolvedObligationContext.allResolved,
            summary: assessment?.resolvedObligationSummary || assessment.resolvedObligationContext.summary || ''
          }
        : null);
  if (!source) return null;
  if (typeof buildResolvedObligationSnapshot === 'function') {
    const snapshot = buildResolvedObligationSnapshot({
      context: source,
      capturedAt: Number(assessment?.obligationBasis?.capturedAt || 0)
    });
    return snapshot.allResolved.length ? snapshot : null;
  }
  return null;
}

function renderAssessmentObligationBasisBlock(assessment = {}, options = {}) {
  const basis = normaliseAssessmentObligationBasis(assessment);
  if (!basis?.allResolved?.length) return '';
  const compact = options.compact !== false;
  const bucketBadges = [
    { label: 'Direct', count: basis.direct.length, tone: 'neutral' },
    { label: 'Inherited mandatory', count: basis.inheritedMandatory.length, tone: 'gold' },
    { label: 'Inherited conditional', count: basis.inheritedConditional.length, tone: 'warning' },
    { label: 'Inherited guidance', count: basis.inheritedGuidance.length, tone: 'neutral' }
  ].filter(item => item.count > 0);
  const previewItems = basis.allResolved.slice(0, compact ? 4 : 8);
  const capturedAt = Number(basis.capturedAt || 0);
  const summary = compact
    ? `This assessment was framed using ${basis.allResolved.length} resolved obligation${basis.allResolved.length === 1 ? '' : 's'} drawn from the active entity scope before the model was run.`
    : `This assessment retained the resolved obligation basis that applied when the run was created, including direct duties and any inherited holding or parent obligations that flowed down to the selected entity and function.`;
  return `<div class="results-summary-card anim-fade-in">
    <div class="results-section-heading">${escapeHtml(String(options.title || 'Obligation basis used for this assessment'))}</div>
    <div class="results-summary-copy" style="margin-top:var(--sp-2)">${escapeHtml(summary)}</div>
    <div class="results-chip-block" style="margin-top:var(--sp-4)">${bucketBadges.map(item => `<span class="badge badge--${item.tone}">${escapeHtml(item.label)}: ${item.count}</span>`).join('')}</div>
    ${basis.resolvedApplicableRegulations.length ? `<div class="results-driver-group" style="margin-top:var(--sp-4)">
      <div class="results-driver-label">Derived regulation tags</div>
      <div class="results-chip-block">${basis.resolvedApplicableRegulations.slice(0, compact ? 4 : 8).map(tag => `<span class="badge badge--neutral">${escapeHtml(String(tag))}</span>`).join('')}</div>
    </div>` : ''}
    <div class="results-driver-group" style="margin-top:var(--sp-4)">
      <div class="results-driver-label">${compact ? 'Most material obligations in scope' : 'Resolved obligation detail'}</div>
      <div class="results-summary-copy">${previewItems.map(item => `• ${escapeHtml(String(item.title || 'Obligation'))}${item.sourceEntityName ? ` (${escapeHtml(String(item.sourceEntityName))})` : ''}${item.requirementLevel ? ` · ${escapeHtml(String(item.requirementLevel))}` : ''}${item.applicabilityReason ? ` — ${escapeHtml(String(item.applicabilityReason))}` : ''}`).join('<br>')}</div>
    </div>
    ${capturedAt ? `<div class="results-comparison-foot" style="margin-top:var(--sp-4)">Captured with the saved run on ${escapeHtml(new Date(capturedAt).toLocaleString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }))}.</div>` : ''}
  </div>`;
}

function buildAssessmentComparison(currentAssessment, baselineAssessment) {
  if (!currentAssessment?.results || !baselineAssessment?.results) return null;

  const current = currentAssessment.results;
  const baseline = baselineAssessment.results;
  const severeEvent = formatComparisonDelta(current.lm?.p90, baseline.lm?.p90);
  const annualExposure = formatComparisonDelta(current.ale?.mean, baseline.ale?.mean);
  const severeAnnual = formatComparisonDelta(current.ale?.p90, baseline.ale?.p90);
  const projectHorizonLoss = formatComparisonDelta(current.projectHorizon?.loss?.mean, baseline.projectHorizon?.loss?.mean);
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
  const unknownDrivers = getResultsTreatmentTradeoffUnknowns(currentAssessment);
  const unknownCaveat = unknownDrivers[0] ? `Benefit cannot be quantified until ${unknownDrivers[0]} is known.` : '';
  const fallbackTradeoff = {
    summary: treatmentNarrative,
    options: [{
      title: 'Simulated treatment case',
      affectsFrequency: Number(currentInputs.tefLikely || 0) < Number(baselineInputs.tefLikely || 0)
        ? 'Likely event frequency is lower than the baseline.'
        : Number(currentInputs.tefLikely || 0) > Number(baselineInputs.tefLikely || 0)
          ? 'Likely event frequency is higher than the baseline and should be challenged.'
          : 'No material frequency change is visible in the saved inputs.',
      affectsVulnerability: Number(currentInputs.controlStrLikely || 0) > Number(baselineInputs.controlStrLikely || 0)
        ? 'Control strength is higher, which should reduce vulnerability if the treatment is implemented as assumed.'
        : Number(currentInputs.controlStrLikely || 0) < Number(baselineInputs.controlStrLikely || 0)
          ? 'Control strength is lower than baseline, so the treatment case does not yet reduce vulnerability.'
          : 'No material vulnerability/control-strength change is visible in the saved inputs.',
      affectsEventLoss: severeEvent.direction === 'down'
        ? `Severe event loss falls by ${severeEvent.formatted}.`
        : severeEvent.direction === 'up'
          ? `Severe event loss rises by ${severeEvent.formatted}; the treatment case is not yet improving impact.`
          : 'Severe event loss is broadly unchanged.',
      affectsAnnualizedLoss: annualExposure.direction === 'down'
        ? `Expected annualized loss falls by ${annualExposure.formatted}.`
        : annualExposure.direction === 'up'
          ? `Expected annualized loss rises by ${annualExposure.formatted}; challenge the future-state assumptions.`
          : 'Expected annualized loss is broadly unchanged.',
      affectsProjectHorizonLoss: currentAssessment.assessmentType === 'project_buyer' || currentAssessment.assessmentType === 'project_seller'
        ? (projectHorizonLoss.direction === 'flat'
            ? `Project-horizon loss is unchanged or unavailable. ${unknownCaveat || 'Confirm project duration and value before relying on this metric.'}`
            : `Project-horizon loss ${projectHorizonLoss.direction === 'down' ? 'falls' : 'rises'} by ${projectHorizonLoss.formatted}.`)
        : 'Not applicable for a generic enterprise risk.',
      affectsProjectEconomics: getResultsProjectEconomicsTradeoff(currentAssessment, unknownDrivers),
      affectedUnknownDrivers: unknownDrivers,
      evidenceStrength: currentAssessment.evidenceMap?.citationQuality?.strong?.length ? 'partial' : 'weak',
      residualUncertainty: unknownCaveat || currentAssessment.missingInformation?.[0] || 'Validate the treatment assumptions before relying on this delta.',
      implementationBurden: /platform|replace|deploy|rollout|supplier|contract|architecture|migration/i.test(String(currentAssessment.treatmentImprovementRequest || currentAssessment.comparisonNarrative || '')) ? 'high' : 'medium',
      rationale: levers[0]?.message || 'The comparison reads the saved before/after FAIR parameters and simulated results.',
      bestFor: currentAssessment.assessmentType === 'project_buyer'
        ? 'Buyer-side project exposure where delivery timing, replacement options, or recoveries are the key levers.'
        : currentAssessment.assessmentType === 'project_seller'
          ? 'Seller-side exposure where margin, delivery cost, penalties, revenue timing, or termination are the key levers.'
          : 'Enterprise risk treatment where likelihood, vulnerability, or direct impact can be credibly changed.',
      limitation: unknownCaveat || 'This is a modelled comparison; evidence of implementation and control effectiveness is still required.'
    }],
    recommendedPath: unknownCaveat || 'Validate the future-state assumptions, confirm implementation burden, then decide whether to sponsor the treatment path.'
  };
  const treatmentTradeoff = normaliseResultsTreatmentTradeoff(currentAssessment.treatmentTradeoff, fallbackTradeoff);

  return {
    baselineTitle: getResultsScenarioDisplayTitle(baselineAssessment || {}),
    baselineDate: new Date(baselineAssessment.completedAt || baselineAssessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' }),
    severeEvent,
    annualExposure,
    severeAnnual,
    projectHorizonLoss,
    currentStatus,
    baselineStatus,
    statusShift,
    keyDriver: levers[0]?.magnitude > 0 ? levers[0].message : 'The two cases are directionally similar, so no single input change stands out as the dominant driver.',
    secondaryDriver,
    caveat: currentAssessment.missingInformation?.[0] || baselineAssessment.missingInformation?.[0] || 'Validate the treatment assumptions before relying on this delta for investment or prioritisation.',
    treatmentNarrative,
    treatmentTradeoff,
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
    baselineTitle: comparison.baselineTitle || getResultsScenarioDisplayTitle(baselineAssessment || {}),
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
  const originalTitle = getResultsScenarioDisplayTitle(clone);
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

function renderAssumptionSensitivitySection() {
  return `<details class="results-detail-disclosure" id="results-sensitivity-analysis">
    <summary>Sensitivity analysis</summary>
    <div class="results-detail-disclosure-copy">Open this to pressure-test the main result against faster optimistic and pessimistic changes to the most important parameters.</div>
    <div class="results-disclosure-stack" id="results-sensitivity-analysis-body">
      <div class="form-help">Expand this section to run quick 1,000-iteration stress tests.</div>
    </div>
  </details>`;
}

function clampParameterValue(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number(min || 0);
  return Math.min(Number(max), Math.max(Number(min), numeric));
}

function deriveVulnerabilityRange(technicalInputs = {}) {
  if (technicalInputs?.vulnDirect) {
    return {
      min: clampParameterValue(technicalInputs?.vulnMin, 0.01, 0.99),
      likely: clampParameterValue(technicalInputs?.vulnLikely, 0.01, 0.99),
      max: clampParameterValue(technicalInputs?.vulnMax, 0.01, 0.99)
    };
  }
  const toVulnerability = (threatCapability, controlStrength) => clampParameterValue(
    1 / (1 + Math.exp(-(clampParameterValue(threatCapability, 0.01, 0.99) - clampParameterValue(controlStrength, 0.01, 0.99)))),
    0.01,
    0.99
  );
  return {
    min: toVulnerability(technicalInputs?.threatCapMin, technicalInputs?.controlStrMax),
    likely: toVulnerability(technicalInputs?.threatCapLikely, technicalInputs?.controlStrLikely),
    max: toVulnerability(technicalInputs?.threatCapMax, technicalInputs?.controlStrMin)
  };
}

function deriveLikelyVulnerability(technicalInputs = {}) {
  if (technicalInputs?.vulnDirect) {
    return clampParameterValue(technicalInputs.vulnLikely, 0.01, 0.99);
  }
  const tc = clampParameterValue(technicalInputs?.threatCapLikely, 0.01, 0.99);
  const cs = clampParameterValue(technicalInputs?.controlStrLikely, 0.01, 0.99);
  const raw = 1 / (1 + Math.exp(-(tc - cs)));
  return clampParameterValue(raw, 0.01, 0.99);
}

function sumLossMagnitudeEdge(technicalInputs = {}, suffix = 'Min') {
  return ['ir', 'bi', 'db', 'rl', 'tp', 'rc']
    .reduce((sum, key) => sum + Number(technicalInputs?.[`${key}${suffix}`] || 0), 0);
}

function buildParameterChallengeTargets(assessment, technicalInputs, assessmentIntelligence = {}) {
  const vulnerabilityLikely = deriveLikelyVulnerability(technicalInputs);
  const confidenceScore = Number(assessmentIntelligence?.confidence?.score || 0);
  return [
    {
      key: 'tefLikely',
      label: 'TEF',
      currentValue: Number(technicalInputs?.tefLikely || 0),
      currentValueLabel: `${Number(technicalInputs?.tefLikely || 0).toFixed(2)} events/year`,
      helperCopy: 'Expected event frequency in a typical year.',
      challengeTarget: 'event-frequency'
    },
    {
      key: 'vulnerability',
      label: 'Vulnerability',
      currentValue: vulnerabilityLikely,
      currentValueLabel: `${Math.round(vulnerabilityLikely * 100)}% event success likelihood`,
      helperCopy: technicalInputs?.vulnDirect ? 'Direct exposure mode.' : 'Derived from threat capability and control strength.',
      challengeTarget: 'event-success'
    },
    {
      key: 'lmLow',
      label: 'LM Low',
      currentValue: sumLossMagnitudeEdge(technicalInputs, 'Min'),
      currentValueLabel: fmtCurrency(sumLossMagnitudeEdge(technicalInputs, 'Min')),
      helperCopy: 'Lower bound of the current loss magnitude range.',
      challengeTarget: 'business-interruption'
    },
    {
      key: 'lmHigh',
      label: 'LM High',
      currentValue: sumLossMagnitudeEdge(technicalInputs, 'Max'),
      currentValueLabel: fmtCurrency(sumLossMagnitudeEdge(technicalInputs, 'Max')),
      helperCopy: 'Upper bound of the current loss magnitude range.',
      challengeTarget: 'regulatory-legal'
    },
    {
      key: 'controlStrLikely',
      label: 'Controls confidence',
      currentValue: clampParameterValue(technicalInputs?.controlStrLikely, 0.01, 0.99),
      currentValueLabel: `${Math.round(clampParameterValue(technicalInputs?.controlStrLikely, 0.01, 0.99) * 100)}% control strength likely`,
      helperCopy: confidenceScore
        ? `${confidenceScore}/100 overall assessment confidence.`
        : 'Current control-strength read in the model.',
      challengeTarget: 'event-success'
    }
  ];
}

function findParameterChallengeTarget(assessment, technicalInputs, assessmentIntelligence, key) {
  const safeKey = String(key || '').trim();
  return buildParameterChallengeTargets(assessment, technicalInputs, assessmentIntelligence)
    .find(item => item.key === safeKey) || null;
}

function renderParameterChallengeActionStrip(assessment, technicalInputs, assessmentIntelligence = {}) {
  const items = buildParameterChallengeTargets(assessment, technicalInputs, assessmentIntelligence);
  if (!items.length) return '';
  return `<section class="results-section-stack">
    <div class="results-section-heading">Challenge a parameter</div>
    <div class="results-detail-disclosure-copy">Use this focused lane when a reviewer wants to challenge one number directly rather than reopening the whole assessment at once.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      ${items.map(item => `<article class="card card--elevated" style="padding:var(--sp-4);background:var(--bg-canvas)">
        <div class="results-driver-label">${escapeHtml(String(item.label || 'Parameter'))}</div>
        <strong style="display:block;margin-top:6px;color:var(--text-primary)">${escapeHtml(String(item.currentValueLabel || 'Not stated'))}</strong>
        <div class="form-help" style="margin-top:8px">${escapeHtml(String(item.helperCopy || ''))}</div>
        <button type="button" class="btn btn--secondary btn--sm" style="margin-top:var(--sp-4)" data-parameter-challenge-open="${escapeHtml(String(item.key || ''))}">Challenge a Parameter</button>
      </article>`).join('')}
    </div>
  </section>`;
}

function normaliseParameterChallengeRecords(assessment = {}) {
  const list = Array.isArray(assessment?.parameterChallenges) ? assessment.parameterChallenges : [];
  return list
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id || '').trim(),
      parameterKey: String(item.parameterKey || '').trim(),
      parameterLabel: String(item.parameterLabel || 'Parameter').trim(),
      currentValueLabel: String(item.currentValueLabel || '').trim(),
      reviewerConcern: String(item.reviewerConcern || '').trim(),
      analystQuestions: Array.isArray(item.analystQuestions) ? item.analystQuestions.map(q => String(q || '').trim()).filter(Boolean) : [],
      reviewerAdjustment: item.reviewerAdjustment && typeof item.reviewerAdjustment === 'object'
        ? {
            param: String(item.reviewerAdjustment.param || '').trim(),
            suggestedValue: Number(item.reviewerAdjustment.suggestedValue),
            suggestedValueLabel: String(item.reviewerAdjustment.suggestedValueLabel || '').trim(),
            aleImpact: String(item.reviewerAdjustment.aleImpact || '').trim(),
            rationale: String(item.reviewerAdjustment.rationale || '').trim()
          }
        : null,
      mode: String(item.mode || '').trim().toLowerCase(),
      usedFallback: item.usedFallback === true,
      aiUnavailable: item.aiUnavailable === true,
      fallbackReasonMessage: String(item.fallbackReasonMessage || '').trim(),
      manualReasonMessage: String(item.manualReasonMessage || '').trim(),
      createdAt: Number(item.createdAt || 0),
      appliedAt: Number(item.appliedAt || 0)
    }))
    .filter(item => item.id)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}

function getOpenParameterChallengeRecords(assessment = {}) {
  return normaliseParameterChallengeRecords(assessment)
    .filter(item => !item.appliedAt && item.reviewerAdjustment && Number.isFinite(Number(item.reviewerAdjustment.suggestedValue)));
}

function formatAnnualAleRangeLabel(results = {}) {
  const mean = Number(results?.annualLoss?.mean || results?.ale?.mean || 0);
  const p90 = Number(results?.annualLoss?.p90 || results?.ale?.p90 || results?.eventLoss?.p90 || 0);
  return `${fmtCurrency(mean)} mean ALE · ${fmtCurrency(p90)} bad year`;
}

function buildConsensusParameterSnapshot(params = {}) {
  return {
    tefLikely: Number(params?.tefLikely || 0),
    vulnerability: Number(deriveLikelyVulnerability(params).toFixed(2)),
    lmLow: Number(sumLossMagnitudeEdge(params, 'Min').toFixed(0)),
    lmHigh: Number(sumLossMagnitudeEdge(params, 'Max').toFixed(0)),
    controlStrLikely: Number(clampParameterValue(params?.controlStrLikely, 0.01, 0.99).toFixed(2))
  };
}

function applyChallengeRecordsToSimulationParams(baseParams = {}, records = []) {
  const draftRecord = {
    fairParams: cloneSerializableState(baseParams, {}) || {}
  };
  (Array.isArray(records) ? records : []).forEach(record => {
    applyParameterAdjustmentToDraftRecord(draftRecord, record);
  });
  return draftRecord.fairParams || baseParams;
}

function runChallengeConsensusPreview({
  technicalInputs,
  r,
  runMetadata,
  records = []
} = {}) {
  if (typeof RiskEngine === 'undefined' || !technicalInputs || !r) return null;
  const baseParams = buildSensitivitySimulationParams(technicalInputs, r, runMetadata);
  const selectedRecords = Array.isArray(records) ? records.filter(Boolean) : [];
  const projectedParams = applyChallengeRecordsToSimulationParams(baseParams, selectedRecords);
  const baseResults = RiskEngine.run(baseParams);
  const projectedResults = RiskEngine.run(projectedParams);
  const baseMean = Number(baseResults?.annualLoss?.mean || baseResults?.ale?.mean || 0);
  const projectedMean = Number(projectedResults?.annualLoss?.mean || projectedResults?.ale?.mean || 0);
  return {
    baseParams,
    projectedParams,
    baseResults,
    projectedResults,
    baseAleRange: formatAnnualAleRangeLabel(baseResults),
    projectedAleRange: formatAnnualAleRangeLabel(projectedResults),
    changePct: baseMean > 0 ? Number((((projectedMean - baseMean) / baseMean) * 100).toFixed(1)) : 0
  };
}

function runConsensusPathAnalysis({
  assessment,
  technicalInputs,
  r,
  runMetadata,
  records = []
} = {}) {
  const openRecords = Array.isArray(records) ? records.filter(Boolean) : [];
  if (typeof RiskEngine === 'undefined' || !assessment || !technicalInputs || !r || !openRecords.length) return null;
  const baseParams = buildSensitivitySimulationParams(technicalInputs, r, runMetadata);
  const baseResults = RiskEngine.run(baseParams);
  const baseMean = Number(baseResults?.annualLoss?.mean || baseResults?.ale?.mean || 0);
  const adjustments = openRecords.map((record, index) => {
    const params = applyChallengeRecordsToSimulationParams(baseParams, [record]);
    const results = RiskEngine.run(params);
    const mean = Number(results?.annualLoss?.mean || results?.ale?.mean || 0);
    const impactPct = baseMean > 0 ? Number((((mean - baseMean) / baseMean) * 100).toFixed(1)) : 0;
    return {
      ref: `C${index + 1}`,
      record,
      params,
      results,
      impactPct,
      aleRange: formatAnnualAleRangeLabel(results)
    };
  });
  const allAdjustedParams = applyChallengeRecordsToSimulationParams(baseParams, openRecords);
  const allAdjustedResults = RiskEngine.run(allAdjustedParams);
  const adjustedMean = Number(allAdjustedResults?.annualLoss?.mean || allAdjustedResults?.ale?.mean || 0);
  return {
    baseParams,
    baseResults,
    baseAleRange: formatAnnualAleRangeLabel(baseResults),
    baseSnapshot: buildConsensusParameterSnapshot(baseParams),
    adjustments,
    allAdjustedParams,
    allAdjustedResults,
    adjustedAleRange: formatAnnualAleRangeLabel(allAdjustedResults),
    adjustedSnapshot: buildConsensusParameterSnapshot(allAdjustedParams),
    adjustedChangePct: baseMean > 0 ? Number((((adjustedMean - baseMean) / baseMean) * 100).toFixed(1)) : 0
  };
}

function normaliseConsensusPath(assessment = {}) {
  const path = assessment?.consensusPath;
  if (!path || typeof path !== 'object') return null;
  return {
    createdAt: Number(path.createdAt || 0),
    summaryBullets: Array.isArray(path.summaryBullets) ? path.summaryBullets.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3) : [],
    acceptRecordIds: Array.isArray(path.acceptRecordIds) ? path.acceptRecordIds.map(item => String(item || '').trim()).filter(Boolean) : [],
    defendRecordIds: Array.isArray(path.defendRecordIds) ? path.defendRecordIds.map(item => String(item || '').trim()).filter(Boolean) : [],
    meetInTheMiddleAleRange: String(path.meetInTheMiddleAleRange || '').trim(),
    projectedAleRange: String(path.projectedAleRange || '').trim(),
    baseAleRange: String(path.baseAleRange || '').trim(),
    adjustedAleRange: String(path.adjustedAleRange || '').trim(),
    appliedAt: Number(path.appliedAt || 0),
    mode: String(path.mode || '').trim().toLowerCase(),
    usedFallback: path.usedFallback === true,
    aiUnavailable: path.aiUnavailable === true,
    fallbackReasonMessage: String(path.fallbackReasonMessage || '').trim(),
    manualReasonMessage: String(path.manualReasonMessage || '').trim()
  };
}

function renderConsensusPathPanel(assessment = {}) {
  const openRecords = getOpenParameterChallengeRecords(assessment);
  if (!openRecords.length) return '';
  const consensus = normaliseConsensusPath(assessment);
  const consensusMode = consensus ? getReviewerWorkflowModePresentation(consensus, {
    liveLabel: 'Live AI consensus',
    fallbackLabel: 'Deterministic fallback consensus',
    manualLabel: 'Manual consensus guidance'
  }) : null;
  return `<section class="results-section-stack" id="results-consensus-path-panel">
    <div class="card card--elevated" style="padding:var(--sp-5);background:var(--bg-canvas)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap">
        <div>
          <div class="results-driver-label">Consensus path</div>
          <div class="context-panel-title" style="margin-top:8px">Minimum adjustment path across the current reviewer challenges.</div>
          <div class="form-help" style="margin-top:6px">${consensus ? 'Toggle which reviewer adjustments to accept, then preview the projected ALE before you rerun.' : 'Run Find Consensus to pressure-test the smallest combined adjustment path across the current open challenges.'}</div>
          ${consensus ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${renderReviewerWorkflowModeBadge(consensus, {
              liveLabel: 'Live AI consensus',
              fallbackLabel: 'Deterministic fallback consensus',
              manualLabel: 'Manual consensus guidance'
            })}
            ${consensusMode?.message ? `<span class="form-help">${escapeHtml(consensusMode.message)}</span>` : ''}
          </div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${consensus?.createdAt ? `<span class="badge badge--neutral">${escapeHtml(new Date(consensus.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }))}</span>` : ''}
          ${consensus?.appliedAt ? '<span class="badge badge--success">Applied</span>' : ''}
        </div>
      </div>
      ${consensus ? `
        <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-top:var(--sp-4)">
          <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
            <div class="results-driver-label">Consensus recommendation</div>
            <div class="results-summary-copy" style="margin-top:8px">${consensus.summaryBullets.length ? consensus.summaryBullets.map(item => `• ${escapeHtml(String(item))}`).join('<br>') : '• No consensus guidance saved yet.'}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
            <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
              <div class="results-driver-label">Projected ALE if consensus applied</div>
              <div id="results-consensus-projected-ale" style="margin-top:8px;font-weight:700;color:var(--text-primary)">${escapeHtml(String(consensus.projectedAleRange || consensus.baseAleRange || 'Not available'))}</div>
              <div id="results-consensus-projected-meta" class="form-help" style="margin-top:6px">${escapeHtml(`Base: ${consensus.baseAleRange || 'Not stated'} · All reviewer adjustments: ${consensus.adjustedAleRange || 'Not stated'}`)}</div>
            </div>
            <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
              <div class="results-driver-label">Meet in the middle</div>
              <div style="margin-top:8px;font-weight:700;color:var(--text-primary)">${escapeHtml(String(consensus.meetInTheMiddleAleRange || 'Not stated yet'))}</div>
              <div class="form-help" style="margin-top:6px">Use this as the committee-friendly compromise range while evidence is still being gathered.</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${openRecords.map(record => {
              const checked = consensus.acceptRecordIds.includes(record.id);
              const stateLabel = checked ? 'Accept' : 'Defend';
              const stateTone = checked ? 'success' : 'warning';
              return `<label class="card card--elevated" style="padding:var(--sp-4);background:var(--bg-elevated);display:flex;align-items:flex-start;gap:12px">
                <input type="checkbox" ${checked ? 'checked' : ''} data-consensus-record-toggle="${escapeHtml(String(record.id || ''))}" style="margin-top:4px">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <strong style="color:var(--text-primary)">${escapeHtml(String(record.parameterLabel || 'Parameter'))}</strong>
                    <span class="badge badge--${stateTone}" data-consensus-record-state="${escapeHtml(String(record.id || ''))}">${stateLabel}</span>
                  </div>
                  <div class="form-help" style="margin-top:6px">${escapeHtml(String(record.reviewerConcern || ''))}</div>
                  <div class="form-help" style="margin-top:6px"><strong>Suggested value:</strong> ${escapeHtml(String(record?.reviewerAdjustment?.suggestedValueLabel || 'Not stated'))}</div>
                </div>
              </label>`;
            }).join('')}
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button type="button" class="btn btn--secondary btn--sm" data-consensus-apply>Apply Consensus</button>
          </div>
        </div>
      ` : '<div class="form-help" style="margin-top:12px">No consensus path has been generated yet. Use Find Consensus to see which reviewer adjustments can be accepted without reopening every assumption.</div>'}
    </div>
  </section>`;
}

function syncConsensusProjectionDisplay({
  assessment,
  technicalInputs,
  r,
  runMetadata
} = {}) {
  const projectedEl = document.getElementById('results-consensus-projected-ale');
  const metaEl = document.getElementById('results-consensus-projected-meta');
  if (!projectedEl || !metaEl) return;
  const latest = assessment?.id ? (getAssessmentById(assessment.id) || assessment) : assessment;
  const openRecords = getOpenParameterChallengeRecords(latest);
  const selectedIds = Array.from(document.querySelectorAll('[data-consensus-record-toggle]:checked'))
    .map(input => String(input?.dataset?.consensusRecordToggle || '').trim())
    .filter(Boolean);
  const selectedRecords = openRecords.filter(record => selectedIds.includes(record.id));
  const preview = runChallengeConsensusPreview({
    technicalInputs,
    r,
    runMetadata,
    records: selectedRecords
  });
  if (!preview) {
    projectedEl.textContent = 'Not available right now';
    metaEl.textContent = 'Quick consensus projection could not be calculated for this assessment.';
    return;
  }
  projectedEl.textContent = preview.projectedAleRange;
  metaEl.textContent = `Base: ${preview.baseAleRange} · Change: ${preview.changePct >= 0 ? '+' : ''}${preview.changePct}%`;
  document.querySelectorAll('[data-consensus-record-state]').forEach(stateEl => {
    const id = String(stateEl.dataset.consensusRecordState || '').trim();
    const checked = selectedIds.includes(id);
    stateEl.textContent = checked ? 'Accept' : 'Defend';
    stateEl.className = `badge badge--${checked ? 'success' : 'warning'}`;
  });
}

function renderParameterChallengeRecordCard(record = {}, { showApplyAction = true } = {}) {
  const analystQuestions = Array.isArray(record?.analystQuestions) ? record.analystQuestions : [];
  const adjustment = record?.reviewerAdjustment || {};
  const createdLabel = record?.createdAt
    ? new Date(record.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Saved now';
  const modeMeta = getReviewerWorkflowModePresentation(record, {
    liveLabel: 'Live AI challenge',
    fallbackLabel: 'Deterministic fallback challenge',
    manualLabel: 'Manual challenge guidance'
  });
  return `<article class="card card--elevated" style="padding:var(--sp-5);background:var(--bg-canvas)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap">
      <div>
        ${typeof UI.sectionEyebrow === 'function' ? UI.sectionEyebrow(record.parameterLabel || 'Challenge record') : ''}
        <div class="context-panel-title" style="margin-top:${typeof UI.sectionEyebrow === 'function' ? '10px' : '0'}">${escapeHtml(String(record.parameterLabel || 'Challenge record'))}</div>
        <div class="form-help" style="margin-top:6px">${escapeHtml(String(record.currentValueLabel || 'Current value not recorded'))}</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${renderReviewerWorkflowModeBadge(record, {
            liveLabel: 'Live AI challenge',
            fallbackLabel: 'Deterministic fallback challenge',
            manualLabel: 'Manual challenge guidance'
          })}
          ${modeMeta.message ? `<span class="form-help">${escapeHtml(modeMeta.message)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="badge badge--neutral">${escapeHtml(createdLabel)}</span>
        ${record.appliedAt ? '<span class="badge badge--success">Applied</span>' : ''}
      </div>
    </div>
    <div class="form-help" style="margin-top:var(--sp-3)">${escapeHtml(String(record.reviewerConcern || 'No reviewer concern was saved.'))}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);margin-top:var(--sp-4)">
      <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
        <div class="results-driver-label">For the Analyst</div>
        <div class="results-summary-copy" style="margin-top:8px">${analystQuestions.length ? analystQuestions.map(item => `• ${escapeHtml(String(item))}`).join('<br>') : '• No analyst questions were generated.'}</div>
      </div>
      <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
        <div class="results-driver-label">Reviewer&apos;s Proposed Adjustment</div>
        <div style="margin-top:8px;font-weight:700;color:var(--text-primary)">${escapeHtml(String(adjustment.suggestedValueLabel || 'No adjustment suggested'))}</div>
        <div class="form-help" style="margin-top:6px">${escapeHtml(String(adjustment.rationale || ''))}</div>
        <div class="form-help" style="margin-top:6px"><strong>ALE impact:</strong> ${escapeHtml(String(adjustment.aleImpact || 'Not stated'))}</div>
        ${showApplyAction && adjustment.param && Number.isFinite(Number(adjustment.suggestedValue))
          ? `<button type="button" class="btn btn--secondary btn--sm" style="margin-top:var(--sp-4)" data-parameter-challenge-apply="${escapeHtml(String(record.id || ''))}">${record.appliedAt ? 'Apply Again' : 'Apply This'}</button>`
          : ''}
      </div>
    </div>
  </article>`;
}

function normaliseChallengeSynthesis(assessment = {}) {
  const synthesis = assessment?.challengeSynthesis;
  if (!synthesis || typeof synthesis !== 'object') return null;
  return {
    createdAt: Number(synthesis.createdAt || 0),
    overallConcern: String(synthesis.overallConcern || '').trim(),
    revisedAleRange: String(synthesis.revisedAleRange || '').trim(),
    keyEvidence: String(synthesis.keyEvidence || '').trim(),
    mode: String(synthesis.mode || '').trim().toLowerCase(),
    usedFallback: synthesis.usedFallback === true,
    aiUnavailable: synthesis.aiUnavailable === true,
    fallbackReasonMessage: String(synthesis.fallbackReasonMessage || '').trim(),
    manualReasonMessage: String(synthesis.manualReasonMessage || '').trim()
  };
}

function normaliseChallengeSynthesisRequest(assessment = {}) {
  const request = assessment?.challengeSynthesisRequest;
  if (!request || typeof request !== 'object') return null;
  return {
    id: String(request.id || '').trim(),
    createdAt: Number(request.createdAt || 0),
    requestedBy: String(request.requestedBy || '').trim(),
    targetUsername: String(request.targetUsername || '').trim().toLowerCase(),
    message: String(request.message || '').trim(),
    status: String(request.status || 'pending').trim().toLowerCase()
  };
}

function renderChallengeSynthesisCard(assessment) {
  const records = normaliseParameterChallengeRecords(assessment);
  const synthesis = normaliseChallengeSynthesis(assessment);
  const request = normaliseChallengeSynthesisRequest(assessment);
  const currentUsername = String(AuthService.getCurrentUser?.()?.username || '').trim().toLowerCase();
  const isAnalystTarget = !!request
    && request.status === 'pending'
    && currentUsername
    && currentUsername === String(request.targetUsername || '').trim().toLowerCase();
  if (records.length < 2 && !synthesis && !isAnalystTarget) return '';
  const createdLabel = synthesis?.createdAt
    ? new Date(synthesis.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  const showRequestButton = records.length >= 2 && synthesis && currentUsername && currentUsername !== String(assessment?.submittedBy || '').trim().toLowerCase();
  const synthesisMode = synthesis ? getReviewerWorkflowModePresentation(synthesis, {
    liveLabel: 'Live AI synthesis',
    fallbackLabel: 'Deterministic fallback synthesis',
    manualLabel: 'Manual synthesis guidance'
  }) : null;
  return `<section class="results-section-stack">
    ${isAnalystTarget ? `<div class="card card--elevated" style="padding:var(--sp-4);background:var(--bg-elevated);border-left:3px solid var(--color-accent-300)">
      <div class="results-driver-label">Analyst response requested</div>
      <div class="results-summary-copy" style="margin-top:8px">${escapeHtml(String(request?.message || 'A reviewer asked for your response to the synthesised challenge view on this assessment.'))}</div>
    </div>` : ''}
    <div class="card card--elevated" style="padding:var(--sp-5);background:var(--bg-canvas);border-left:3px solid var(--color-accent-300)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap">
        <div>
          <div class="results-driver-label">Reviewer Consensus View (AI Synthesised)</div>
          <div class="context-panel-title" style="margin-top:8px">One dissenting view across all saved reviewer challenges.</div>
          <div class="form-help" style="margin-top:6px">${records.length >= 2 ? `${records.length} challenge records are included in this synthesis.` : 'A synthesis will appear once at least two challenge records exist.'}</div>
          ${synthesis ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${renderReviewerWorkflowModeBadge(synthesis, {
              liveLabel: 'Live AI synthesis',
              fallbackLabel: 'Deterministic fallback synthesis',
              manualLabel: 'Manual synthesis guidance'
            })}
            ${synthesisMode?.message ? `<span class="form-help">${escapeHtml(synthesisMode.message)}</span>` : ''}
          </div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${createdLabel ? `<span class="badge badge--neutral">${escapeHtml(createdLabel)}</span>` : ''}
          ${records.length >= 2 ? '<button type="button" class="btn btn--secondary btn--sm" data-challenge-synthesis-run>Synthesise Challenges</button>' : ''}
          ${showRequestButton ? '<button type="button" class="btn btn--ghost btn--sm" data-challenge-synthesis-request>Request analyst response to synthesis</button>' : ''}
        </div>
      </div>
      ${synthesis ? `
        <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-top:var(--sp-4)">
          <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
            <div class="results-driver-label">Overall concern</div>
            <div class="results-summary-copy" style="margin-top:8px">${escapeHtml(String(synthesis.overallConcern || ''))}</div>
          </div>
          <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
            <div class="results-driver-label">Revised ALE view</div>
            <div class="results-summary-copy" style="margin-top:8px">${escapeHtml(String(synthesis.revisedAleRange || ''))}</div>
          </div>
          <div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)">
            <div class="results-driver-label">Single best evidence to resolve most challenges</div>
            <div class="results-summary-copy" style="margin-top:8px">${escapeHtml(String(synthesis.keyEvidence || ''))}</div>
          </div>
        </div>
      ` : records.length >= 2 ? '<div class="form-help" style="margin-top:12px">Run synthesis to consolidate the current reviewer challenges into one coherent committee view.</div>' : ''}
    </div>
  </section>`;
}

function renderParameterChallengeRecordSection(assessment) {
  const records = normaliseParameterChallengeRecords(assessment);
  if (!records.length) return '';
  return `<section class="results-section-stack">
    <div class="results-section-heading">Challenge records</div>
    <div class="results-detail-disclosure-copy">Saved reviewer challenges stay here so the analyst and reviewer can work from one visible audit trail instead of ad hoc comments.</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${records.map(record => renderParameterChallengeRecordCard(record, { showApplyAction: true })).join('')}
    </div>
  </section>`;
}

function renderParameterChallengeAuditTrail(assessment) {
  const records = normaliseParameterChallengeRecords(assessment);
  if (!records.length) return '';
  return `<div style="display:flex;flex-direction:column;gap:12px">
    ${records.map(record => renderParameterChallengeRecordCard(record, { showApplyAction: false })).join('')}
  </div>`;
}

function getAssessmentVersionHistory(assessment = {}) {
  return typeof normaliseAssessmentVersionHistory === 'function'
    ? normaliseAssessmentVersionHistory(assessment?.versionHistory || [])
    : (Array.isArray(assessment?.versionHistory) ? assessment.versionHistory : []);
}

function findAssessmentVersionRecord(assessment = {}, savedAt = 0) {
  const target = Number(savedAt || 0);
  return getAssessmentVersionHistory(assessment).find(item => Number(item?.savedAt || 0) === target) || null;
}

function renderAssessmentVersionHistorySection(assessment) {
  const versions = getAssessmentVersionHistory(assessment).slice().reverse();
  return `<details class="results-detail-disclosure">
    <summary>Version history</summary>
    <div class="results-detail-disclosure-copy">Open this to see how the assessment changed across saved versions, ask AI to narrate what shifted, and restore an earlier parameter set into the wizard for rerun.</div>
    <div class="results-disclosure-stack">
      ${versions.length ? `<div style="display:flex;flex-direction:column;gap:12px">
        ${versions.map((version, index) => `
          <article class="card card--elevated anim-fade-in" style="padding:var(--sp-4);background:var(--bg-canvas);border-left:2px solid var(--border-subtle)">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap">
              <div>
                <div class="results-driver-label">Version ${versions.length - index}</div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
                  <strong style="color:var(--text-primary)">${escapeHtml(new Date(Number(version.savedAt || 0) || Date.now()).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }))}</strong>
                  <span class="badge badge--neutral">${escapeHtml(buildAssessmentVersionAleLabel(version.aleResult || {}))}</span>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn btn--ghost btn--sm" data-version-history-narrate="${escapeHtml(String(version.savedAt || ''))}">Explain this change</button>
                <button type="button" class="btn btn--secondary btn--sm" data-version-history-restore="${escapeHtml(String(version.savedAt || ''))}">Restore this version</button>
              </div>
            </div>
            ${version.scenarioSummary ? `<div class="form-help" style="margin-top:10px">${escapeHtml(String(version.scenarioSummary).slice(0, 320))}${String(version.scenarioSummary).length > 320 ? '…' : ''}</div>` : ''}
            ${version.aiNarrative ? `<div class="form-help" style="font-style:italic;margin-top:12px;padding:var(--sp-3);background:var(--bg-elevated);border-radius:var(--radius-lg)">${escapeHtml(String(version.aiNarrative))}</div>` : ''}
          </article>
        `).join('')}
      </div>` : '<div class="form-help">No prior saved versions yet. This timeline starts after the next material assessment update is saved.</div>'}
    </div>
  </details>`;
}

function buildAssessmentVersionNarrationFallback(version = {}, assessment = {}) {
  const input = typeof buildAssessmentVersionNarrationInput === 'function'
    ? buildAssessmentVersionNarrationInput(version, assessment)
    : null;
  if (!input) return 'The earlier version could not be compared to the current result right now.';
  const firstChange = Array.isArray(input.parameterDiffLines) && input.parameterDiffLines.length
    ? input.parameterDiffLines[0]
    : 'No major parameter change was recorded';
  return `${firstChange}. The outcome moved from ${input.previousAleLabel || 'the earlier result'} to ${input.currentAleLabel || 'the current result'}, which suggests the analyst changed the practical severity or likelihood of the scenario rather than only the wording. Review the updated evidence and scenario framing to confirm whether that shift is justified.`;
}

function scaleLossEdge(fairParams = {}, suffix = 'Min', targetTotal = 0) {
  const keys = ['ir', 'bi', 'db', 'rl', 'tp', 'rc'];
  const currentTotal = keys.reduce((sum, key) => sum + Number(fairParams?.[`${key}${suffix}`] || 0), 0);
  const safeTarget = Math.max(0, Number(targetTotal || 0) || 0);
  const factor = currentTotal > 0 ? (safeTarget / currentTotal) : 1;
  keys.forEach((key) => {
    const edgeKey = `${key}${suffix}`;
    const likelyKey = `${key}Likely`;
    const oppositeKey = suffix === 'Min' ? `${key}Max` : `${key}Min`;
    const current = Number(fairParams?.[edgeKey] || 0);
    const nextEdge = currentTotal > 0
      ? Math.max(0, Number((current * factor).toFixed(2)))
      : 0;
    fairParams[edgeKey] = nextEdge;
    if (suffix === 'Min') {
      if (Number(fairParams?.[likelyKey] || 0) < nextEdge) fairParams[likelyKey] = nextEdge;
      if (Number(fairParams?.[oppositeKey] || 0) < Number(fairParams?.[likelyKey] || 0)) fairParams[oppositeKey] = Number(fairParams?.[likelyKey] || 0);
    } else {
      if (Number(fairParams?.[likelyKey] || 0) > nextEdge) fairParams[likelyKey] = nextEdge;
      if (Number(fairParams?.[oppositeKey] || 0) > Number(fairParams?.[likelyKey] || 0)) fairParams[oppositeKey] = Number(fairParams?.[likelyKey] || 0);
    }
  });
}

function applyParameterAdjustmentToDraftRecord(draftRecord, record = {}) {
  const adjustment = record?.reviewerAdjustment || {};
  const fairParams = draftRecord?.fairParams && typeof draftRecord.fairParams === 'object'
    ? draftRecord.fairParams
    : (draftRecord.fairParams = {});
  const param = String(adjustment.param || '').trim();
  const suggestedValue = Number(adjustment.suggestedValue);
  if (!param || !Number.isFinite(suggestedValue)) return draftRecord;
  const setLikelyWithBounds = (prefix, value, min = 0, max = 1) => {
    const safeValue = clampParameterValue(value, min, max);
    fairParams[`${prefix}Likely`] = safeValue;
    if (Number(fairParams?.[`${prefix}Min`] || 0) > safeValue) fairParams[`${prefix}Min`] = safeValue;
    if (Number(fairParams?.[`${prefix}Max`] || 0) < safeValue) fairParams[`${prefix}Max`] = safeValue;
  };
  if (param === 'tefLikely') {
    setLikelyWithBounds('tef', suggestedValue, 0, 1000);
  } else if (param === 'controlStrLikely') {
    setLikelyWithBounds('controlStr', suggestedValue, 0.01, 0.99);
  } else if (param === 'vulnerability') {
    const safeVulnerability = clampParameterValue(suggestedValue, 0.01, 0.99);
    if (fairParams.vulnDirect) {
      setLikelyWithBounds('vuln', safeVulnerability, 0.01, 0.99);
    } else {
      const tcLikely = clampParameterValue(fairParams.threatCapLikely, 0.01, 0.99);
      const logit = Math.log(safeVulnerability / Math.max(0.0001, 1 - safeVulnerability));
      setLikelyWithBounds('controlStr', tcLikely - logit, 0.01, 0.99);
    }
  } else if (param === 'lmLow') {
    scaleLossEdge(fairParams, 'Min', suggestedValue);
  } else if (param === 'lmHigh') {
    scaleLossEdge(fairParams, 'Max', suggestedValue);
  }
  return draftRecord;
}

function formatParameterChallengeSuggestedValueLabel(parameterKey, suggestedValue, technicalInputs = {}) {
  const numeric = Number(suggestedValue);
  if (!Number.isFinite(numeric)) return 'Suggested value not stated';
  if (parameterKey === 'tefLikely') return `${numeric.toFixed(2)} events/year`;
  if (parameterKey === 'vulnerability') return `${Math.round(clampParameterValue(numeric, 0.01, 0.99) * 100)}% event success likelihood`;
  if (parameterKey === 'controlStrLikely') return `${Math.round(clampParameterValue(numeric, 0.01, 0.99) * 100)}% control strength likely`;
  if (parameterKey === 'lmLow' || parameterKey === 'lmHigh') return fmtCurrency(numeric);
  return String(numeric);
}

function normaliseParameterAdjustmentKey(value, fallback = '') {
  const safe = String(value || '').trim().toLowerCase();
  if (!safe) return String(fallback || '').trim();
  if (safe === 'tef' || safe === 'teflikely' || safe === 'event frequency') return 'tefLikely';
  if (safe === 'vulnerability' || safe === 'event success likelihood') return 'vulnerability';
  if (safe === 'lm low' || safe === 'lmlow' || safe === 'loss magnitude low') return 'lmLow';
  if (safe === 'lm high' || safe === 'lmhigh' || safe === 'loss magnitude high') return 'lmHigh';
  if (safe === 'controlstrlikely' || safe === 'control strength' || safe === 'controls confidence') return 'controlStrLikely';
  return String(fallback || '').trim() || String(value || '').trim();
}

function buildSensitivitySimulationParams(technicalInputs = {}, r = {}, runMetadata = {}) {
  return {
    ...cloneSerializableState(technicalInputs, {}) || {},
    iterations: 1000,
    seed: Number(runMetadata?.seed || 1337),
    distType: String(runMetadata?.distributions?.eventModel || r?.distType || technicalInputs?.distType || 'triangular'),
    threshold: Number(r?.threshold || technicalInputs?.threshold || getToleranceThreshold()),
    annualReviewThreshold: Number(r?.annualReviewThreshold || technicalInputs?.annualReviewThreshold || getAnnualReviewThreshold()),
    vulnDirect: !!technicalInputs?.vulnDirect,
    secondaryEnabled: !!technicalInputs?.secondaryEnabled,
    corrBiIr: Number(runMetadata?.distributions?.correlations?.businessInterruptionVsIncidentResponse ?? technicalInputs?.corrBiIr ?? 0.3),
    corrRlRc: Number(runMetadata?.distributions?.correlations?.regulatoryVsReputation ?? technicalInputs?.corrRlRc ?? 0.2)
  };
}

function scaleOrderedRange(min, likely, max, factor, { lowerBound = 0, upperBound = null } = {}) {
  const values = [Number(min || 0), Number(likely || 0), Number(max || 0)]
    .map(value => Math.max(Number(lowerBound || 0), value * factor))
    .map(value => upperBound == null ? value : clampParameterValue(value, Number(lowerBound || 0), Number(upperBound)));
  values.sort((left, right) => left - right);
  return {
    min: values[0],
    likely: values[1],
    max: values[2]
  };
}

function applySensitivityFactor(params = {}, parameterKey = '', factor = 1) {
  const next = cloneSerializableState(params, {}) || {};
  const safeFactor = Math.max(0.01, Number(factor || 1));
  if (parameterKey === 'tefLikely') {
    const scaled = scaleOrderedRange(next.tefMin, next.tefLikely, next.tefMax, safeFactor, { lowerBound: 0 });
    next.tefMin = scaled.min;
    next.tefLikely = scaled.likely;
    next.tefMax = scaled.max;
    return next;
  }
  if (parameterKey === 'vulnerability') {
    const scaled = scaleOrderedRange(
      deriveVulnerabilityRange(next).min,
      deriveVulnerabilityRange(next).likely,
      deriveVulnerabilityRange(next).max,
      safeFactor,
      { lowerBound: 0.01, upperBound: 0.99 }
    );
    next.vulnDirect = true;
    next.vulnMin = scaled.min;
    next.vulnLikely = scaled.likely;
    next.vulnMax = scaled.max;
    return next;
  }
  if (parameterKey === 'lmLow') {
    ['ir', 'bi', 'db', 'rl', 'tp', 'rc'].forEach((prefix) => {
      next[`${prefix}Min`] = Math.max(0, Number(next?.[`${prefix}Min`] || 0) * safeFactor);
      if (Number(next?.[`${prefix}Likely`] || 0) < Number(next?.[`${prefix}Min`] || 0)) {
        next[`${prefix}Likely`] = Number(next[`${prefix}Min`]);
      }
      if (Number(next?.[`${prefix}Max`] || 0) < Number(next?.[`${prefix}Likely`] || 0)) {
        next[`${prefix}Max`] = Number(next[`${prefix}Likely`]);
      }
    });
    return next;
  }
  if (parameterKey === 'lmHigh') {
    ['ir', 'bi', 'db', 'rl', 'tp', 'rc'].forEach((prefix) => {
      next[`${prefix}Max`] = Math.max(0, Number(next?.[`${prefix}Max`] || 0) * safeFactor);
      if (Number(next?.[`${prefix}Likely`] || 0) > Number(next?.[`${prefix}Max`] || 0)) {
        next[`${prefix}Likely`] = Number(next[`${prefix}Max`]);
      }
      if (Number(next?.[`${prefix}Min`] || 0) > Number(next?.[`${prefix}Likely`] || 0)) {
        next[`${prefix}Min`] = Number(next[`${prefix}Likely`]);
      }
    });
    return next;
  }
  return next;
}

function classifySensitivityVerdict(changeRatio = 0) {
  const safeRatio = Math.max(0, Number(changeRatio || 0));
  if (safeRatio > 0.5) return { label: 'High leverage', tone: 'danger' };
  if (safeRatio < 0.2) return { label: 'Stable', tone: 'success' };
  return { label: 'Watch closely', tone: 'warning' };
}

function renderAssumptionSensitivityAnalysisResult({
  rows = [],
  baseAle = 0,
  keySensitivity = ''
} = {}) {
  if (!rows.length) {
    return '<div class="form-help">Sensitivity analysis is not available for this assessment right now.</div>';
  }
  return `
    ${keySensitivity ? `<div class="card card--elevated" style="padding:var(--sp-4);background:var(--bg-elevated)"><div class="results-driver-label">Key sensitivity</div><div style="margin-top:8px;color:var(--text-primary);font-weight:600">${escapeHtml(String(keySensitivity))}</div></div>` : ''}
    <div class="card card--elevated" style="padding:0;overflow:auto;background:var(--bg-canvas)">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:var(--bg-elevated);text-align:left">
            <th style="padding:12px 14px">Parameter</th>
            <th style="padding:12px 14px">-50%</th>
            <th style="padding:12px 14px">Base</th>
            <th style="padding:12px 14px">+100%</th>
            <th style="padding:12px 14px">Verdict</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr style="border-top:1px solid var(--border-subtle)">
              <td style="padding:12px 14px;font-weight:600;color:var(--text-primary)">${escapeHtml(String(row.parameter || 'Parameter'))}</td>
              <td style="padding:12px 14px;color:var(--text-secondary)">${escapeHtml(String(row.lowAleLabel || '—'))}</td>
              <td style="padding:12px 14px;color:var(--text-primary)">${escapeHtml(String(row.baseAleLabel || '—'))}</td>
              <td style="padding:12px 14px;color:var(--text-secondary)">${escapeHtml(String(row.highAleLabel || '—'))}</td>
              <td style="padding:12px 14px"><span class="badge badge--${escapeHtml(String(row.verdictTone || 'neutral'))}">${escapeHtml(String(row.verdictLabel || 'Check basis'))}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="form-help" style="margin-top:8px">Quick stress test only. Each row re-runs the model at 1,000 iterations with one parameter shifted while the rest stay fixed.</div>
  `;
}

async function runAssumptionSensitivityAnalysis({
  assessment,
  technicalInputs,
  r,
  runMetadata
} = {}) {
  if (typeof RiskEngine === 'undefined' || !assessment || !technicalInputs || !r) return null;
  const baseParams = buildSensitivitySimulationParams(technicalInputs, r, runMetadata);
  const baseResults = RiskEngine.run(baseParams);
  const baseAle = Number(baseResults?.annualLoss?.mean || baseResults?.ale?.mean || 0);
  const rows = [
    { key: 'tefLikely', parameter: 'TEF' },
    { key: 'vulnerability', parameter: 'Vulnerability' },
    { key: 'lmLow', parameter: 'LM Low' },
    { key: 'lmHigh', parameter: 'LM High' }
  ].map((row) => {
    const lowResults = RiskEngine.run(applySensitivityFactor(baseParams, row.key, 0.5));
    const highResults = RiskEngine.run(applySensitivityFactor(baseParams, row.key, 2));
    const lowAle = Number(lowResults?.annualLoss?.mean || lowResults?.ale?.mean || 0);
    const highAle = Number(highResults?.annualLoss?.mean || highResults?.ale?.mean || 0);
    const lowRatio = baseAle > 0 ? lowAle / baseAle : 1;
    const highRatio = baseAle > 0 ? highAle / baseAle : 1;
    const changeRatio = Math.max(Math.abs(lowRatio - 1), Math.abs(highRatio - 1));
    const verdict = classifySensitivityVerdict(changeRatio);
    return {
      ...row,
      lowAle,
      highAle,
      baseAle,
      lowAleLabel: fmtCurrency(lowAle),
      baseAleLabel: fmtCurrency(baseAle),
      highAleLabel: fmtCurrency(highAle),
      lowRatio: Number(lowRatio.toFixed(2)),
      highRatio: Number(highRatio.toFixed(2)),
      verdictLabel: verdict.label,
      verdictTone: verdict.tone
    };
  });
  const keySensitivity = await LLMService.generateSensitivityNarrative({
    scenarioTitle: assessment?.scenarioTitle || '',
    baseAleLabel: fmtCurrency(baseAle),
    rows: rows.map((row) => ({
      parameter: row.parameter,
      lowAle: row.lowAleLabel,
      baseAle: row.baseAleLabel,
      highAle: row.highAleLabel,
      lowRatio: row.lowRatio,
      highRatio: row.highRatio,
      verdict: row.verdictLabel
    }))
  });
  return {
    baseAle,
    rows,
    keySensitivity
  };
}

function openParameterChallengeModal({
  assessment,
  parameterTarget,
  technicalInputs,
  assessmentIntelligence,
  isShared,
  id
} = {}) {
  if (!assessment || !parameterTarget) return;
  const concernId = `challenge-concern-${Date.now()}`;
  const submitId = `btn-submit-parameter-challenge-${Date.now()}`;
  const cancelId = `btn-cancel-parameter-challenge-${Date.now()}`;
  const modal = UI.modal({
    title: `Challenge ${parameterTarget.label}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
        <div class="card" style="padding:var(--sp-4);background:var(--bg-elevated)">
          <div class="results-driver-label">${escapeHtml(String(parameterTarget.label || 'Parameter'))}</div>
          <strong style="display:block;margin-top:6px;color:var(--text-primary)">${escapeHtml(String(parameterTarget.currentValueLabel || 'Current value not stated'))}</strong>
        </div>
        <div>
          <label class="form-label" for="${concernId}">What concerns you about this estimate?</label>
          <textarea id="${concernId}" class="form-textarea" rows="5" placeholder="Be direct about what feels too high, too low, weakly supported, or not aligned to the scenario."></textarea>
        </div>
        <div class="flex items-center gap-3" style="flex-wrap:wrap">
          <button type="button" class="btn btn--primary" id="${submitId}">Submit Challenge</button>
          <button type="button" class="btn btn--ghost" id="${cancelId}">Cancel</button>
        </div>
      </div>
    `
  });
  document.getElementById(cancelId)?.addEventListener('click', () => modal?.close?.());
  document.getElementById(submitId)?.addEventListener('click', async () => {
    const concernEl = document.getElementById(concernId);
    const reviewerConcern = String(concernEl?.value || '').trim();
    if (!reviewerConcern) {
      UI.toast('Add the reviewer concern before submitting the challenge.', 'warning');
      concernEl?.focus();
      return;
    }
    const submitButton = document.getElementById(submitId);
    const currentAle = assessment?.results?.annualLoss?.mean || assessment?.results?.ale?.mean || 0;
    const requestPayload = {
      parameterKey: parameterTarget.key,
      parameterLabel: parameterTarget.label,
      currentValue: parameterTarget.currentValue,
      currentValueLabel: parameterTarget.currentValueLabel,
      scenarioSummary: assessment.enhancedNarrative || assessment.narrative || assessment.scenarioTitle || '',
      reviewerConcern,
      currentAle: fmtCurrency(currentAle),
      allowedParams: ['tefLikely', 'vulnerability', 'lmLow', 'lmHigh', 'controlStrLikely']
    };
    if (guardResultsAiActionCooldown({
      button: submitButton,
      actionKey: 'parameter-challenge',
      endpoint: '/api/ai/parameter-challenge',
      payload: requestPayload,
      assessment,
      fallbackId: id,
      cooldownLabel: 'Saved just now',
      message: 'This parameter challenge already reflects the current concern. Review it or change the concern before submitting again.'
    })) return;
    const resetBusy = setResultsAiActionBusy(submitButton, 'Generating…');
    try {
      const result = await LLMService.generateParameterChallengeRecord(requestPayload);
      if (!result) throw new Error('No challenge record generated');
      markResultsAiActionCooldown('parameter-challenge', '/api/ai/parameter-challenge', requestPayload, assessment, id);
      const adjustmentParam = normaliseParameterAdjustmentKey(result?.reviewerAdjustment?.param, parameterTarget.key);
      const nextRecord = {
        id: `pcr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        parameterKey: parameterTarget.key,
        parameterLabel: parameterTarget.label,
        currentValueLabel: parameterTarget.currentValueLabel,
        reviewerConcern,
        analystQuestions: Array.isArray(result?.analystQuestions) ? result.analystQuestions.slice(0, 3) : [],
        reviewerAdjustment: {
          ...(result?.reviewerAdjustment || {}),
          param: adjustmentParam || parameterTarget.key,
          suggestedValue: Number(result?.reviewerAdjustment?.suggestedValue),
          suggestedValueLabel: formatParameterChallengeSuggestedValueLabel(
            adjustmentParam || parameterTarget.key,
            Number(result?.reviewerAdjustment?.suggestedValue),
            technicalInputs
          )
        },
        mode: String(result?.mode || '').trim().toLowerCase(),
        usedFallback: result?.usedFallback === true,
        aiUnavailable: result?.aiUnavailable === true,
        fallbackReasonMessage: String(result?.fallbackReasonMessage || '').trim(),
        manualReasonMessage: String(result?.manualReasonMessage || '').trim(),
        createdAt: Date.now(),
        appliedAt: 0
      };
      updateAssessmentRecord(assessment.id, current => ({
        ...current,
        parameterChallenges: [
          nextRecord,
          ...(Array.isArray(current?.parameterChallenges) ? current.parameterChallenges : [])
        ].slice(0, 12)
      }));
      modal?.close?.();
      const toastMeta = buildReviewerWorkflowSuccessToast(result, {
        live: 'Challenge record saved.',
        deterministicFallback: 'Deterministic fallback challenge record saved. Review it before applying the adjustment.',
        manual: 'Manual challenge guidance saved. Review it before applying any change.'
      });
      UI.toast(toastMeta.copy, toastMeta.tone, 5000);
      renderResults(id || assessment.id, isShared || assessment._shared);
    } catch (error) {
      console.error('generateParameterChallengeRecord failed:', error);
      UI.toast('The challenge record could not be generated right now. Try again.', 'danger');
    } finally {
      resetBusy();
    }
  });
}

// renderPreRunAssumptionExplainer → moved to assets/wizard/step4.js

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
        <p class="results-summary-copy">The platform combines user-entered values, AI-seeded starting points, inherited context/default assumptions, the resolved obligation basis in scope, and recorded judgement calls. It then simulates many plausible outcomes so the result shows a range, not a single false-precision answer.</p>
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

// buildSimulationRunPayload, getSimulationYieldEvery, renderRunGuardrailSummary,
// renderPreRunReviewRail, renderPreRunTrustSummary, renderPreRunActionSpotlight,
// validateFairParams, renderWizard4, runSimulation → moved to assets/wizard/step4.js

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
  const pageRoot = document.querySelector('.app-stage-shell.is-current .page')
    || document.querySelector('#main-content .app-stage-shell:last-of-type .page')
    || document.querySelector('.page');
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
    if (hc && Array.isArray(r?.histogram) && r.histogram.length) {
      UI.drawHistogram(hc, r.histogram, r.threshold, AppState.currency, AppState.fxRate);
    }
    if (lc && Array.isArray(r?.lec) && r.lec.length) {
      UI.drawLEC(lc, r.lec, r.threshold, AppState.currency, AppState.fxRate);
    }
    attachCitationHandlers();
  });
}

function withResultsActionBusy(button, busyLabel, resetDelayMs, callback) {
  if (!button || typeof callback !== 'function') return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  const reset = () => {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
    }, resetDelayMs);
  };
  try {
    const result = callback();
    if (result && typeof result.then === 'function') {
      result.then(reset, reset);
      return;
    }
  } catch (error) {
    reset();
    throw error;
  }
  reset();
}

async function ensureResultsPdfLibrary() {
  if (window.jspdf?.jsPDF) return true;
  if (window.AppAssetLoader && typeof window.AppAssetLoader.loadRouteAssets === 'function') {
    await window.AppAssetLoader.loadRouteAssets('jspdf');
  }
  return !!window.jspdf?.jsPDF;
}

function getResultsSessionToken() {
  return typeof AuthService !== 'undefined' && typeof AuthService.getApiSessionToken === 'function'
    ? AuthService.getApiSessionToken()
    : (JSON.parse(sessionStorage.getItem('rq_auth_session') || '{}')?.token || '');
}

function isReviewAwaitingDecision(status = '') {
  const safeStatus = String(status || '').trim().toLowerCase();
  return safeStatus === 'pending' || safeStatus === 'escalated';
}

function getResultsReviewScopeLabel(reviewScope = '') {
  const safeScope = String(reviewScope || '').trim().toLowerCase();
  if (safeScope === 'function') return 'function review';
  if (safeScope === 'business_unit') return 'BU review';
  if (safeScope === 'holding_company') return 'holding-company review';
  return 'review';
}

function getResultsReviewActorLabel(reviewSubmission = {}, {
  fallback = 'your reviewer'
} = {}) {
  return String(
    reviewSubmission?.assignedReviewerDisplayName
    || reviewSubmission?.assignedReviewerUsername
    || reviewSubmission?.reviewedBy
    || reviewSubmission?.submittedByDisplayName
    || reviewSubmission?.submittedByUsername
    || fallback
  ).trim();
}

function buildLocalReviewSubmissionFromQueueItem(item = {}) {
  return {
    reviewId: String(item?.id || '').trim(),
    reviewStatus: String(item?.reviewStatus || '').trim().toLowerCase(),
    reviewRevision: Math.max(1, Number(item?.reviewRevision || 1)),
    submittedAt: Number(item?.submittedAt || 0),
    submittedByUsername: String(item?.submittedBy || '').trim().toLowerCase(),
    submittedByDisplayName: String(item?.submittedByDisplayName || '').trim(),
    assignedReviewerUsername: String(item?.assignedReviewerUsername || '').trim().toLowerCase(),
    assignedReviewerDisplayName: String(item?.assignedReviewerDisplayName || '').trim(),
    assignedReviewerRole: String(item?.assignedReviewerRole || '').trim().toLowerCase(),
    reviewScope: String(item?.reviewScope || '').trim().toLowerCase(),
    reviewNote: String(item?.reviewNote || '').trim(),
    reviewedBy: String(item?.reviewedBy || '').trim().toLowerCase(),
    reviewedAt: Number(item?.reviewedAt || 0),
    updatedAt: Number(item?.updatedAt || 0),
    escalatedTo: String(item?.escalatedTo || '').trim().toLowerCase(),
    escalatedBy: String(item?.escalatedBy || '').trim().toLowerCase(),
    escalatedAt: Number(item?.escalatedAt || 0),
    currentUserCanReview: item?.currentUserCanReview === true,
    currentUserCanEscalate: item?.currentUserCanEscalate === true,
    currentUserCanView: item?.currentUserCanView === true,
    isAssignedToCurrentUser: item?.isAssignedToCurrentUser === true
  };
}

async function fetchReviewTargets(action = 'submit') {
  const safeAction = String(action || 'submit').trim().toLowerCase() === 'escalate' ? 'escalate' : 'submit';
  const response = await fetch(resolveResultsReviewQueueApiUrl(`view=targets&action=${encodeURIComponent(safeAction)}`), {
    headers: {
      'x-session-token': getResultsSessionToken()
    }
  });
  if (!response.ok) throw new Error('Could not load review targets.');
  return response.json();
}

async function buildResultsReviewQueueError(response, fallbackMessage) {
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {}
  if (typeof AuthService !== 'undefined' && typeof AuthService.buildApiError === 'function') {
    return AuthService.buildApiError(response, parsed, text || fallbackMessage);
  }
  const error = new Error(parsed?.error?.message || fallbackMessage);
  error.status = Number(response?.status || 0);
  error.code = String(parsed?.error?.code || '').trim();
  if (parsed?.latestItem) error.latestItem = parsed.latestItem;
  return error;
}

async function patchReviewQueueItem(reviewId, patch = {}, expectedReviewRevision = 1) {
  const response = await fetch(resolveResultsReviewQueueApiUrl(), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': getResultsSessionToken()
    },
    body: JSON.stringify({
      id: reviewId,
      expectedReviewRevision,
      ...patch
    })
  });
  if (!response.ok) throw await buildResultsReviewQueueError(response, 'Review update failed.');
  return response.json();
}

function renderResultsReviewSubmitBanner(assessment, r) {
  if (!assessment?.id || !assessment?.results) return '';
  const needsReview = !!(r?.criticalCondition || r?.toleranceBreached || r?.nearTolerance || r?.annualReviewTriggered);
  if (!needsReview) return '';
  const reviewSubmission = assessment.reviewSubmission || {};
  const reviewStatus = String(reviewSubmission.reviewStatus || '').trim().toLowerCase();
  const assignedReviewerLabel = escapeHtml(getResultsReviewActorLabel(reviewSubmission));
  const reviewScopeLabel = escapeHtml(getResultsReviewScopeLabel(reviewSubmission.reviewScope));
  const reviewQueueUpdatedAt = Number(reviewSubmission.updatedAt || reviewSubmission.reviewedAt || reviewSubmission.submittedAt || 0);
  const reviewFreshnessMarkup = reviewQueueUpdatedAt
    ? `Last queue update ${typeof renderLiveTimestampValue === 'function'
        ? renderLiveTimestampValue(reviewQueueUpdatedAt, { tagName: 'strong', mode: 'absolute', includeSeconds: true, fallback: 'Unknown time' })
        : `<strong>${escapeHtml(typeof formatOperationalDateTime === 'function' ? formatOperationalDateTime(reviewQueueUpdatedAt, { includeSeconds: true, fallback: 'Unknown time' }) : 'Unknown time')}</strong>`}
      · ${typeof renderLiveTimestampValue === 'function'
        ? renderLiveTimestampValue(reviewQueueUpdatedAt, { tagName: 'strong', mode: 'relative', fallback: 'just now', staleAfterMs: 120000, staleClass: 'live-timestamp--stale' })
        : `<strong>${escapeHtml(typeof formatRelativePilotTime === 'function' ? formatRelativePilotTime(reviewQueueUpdatedAt, 'just now') : 'just now')}</strong>`}`
    : '';
  if (isReviewAwaitingDecision(reviewStatus)) {
    const reviewActionButtons = [];
    if (reviewSubmission.currentUserCanReview) {
      reviewActionButtons.push('<button type="button" class="btn btn--success btn--sm" id="btn-review-approve">Approve</button>');
      reviewActionButtons.push('<button type="button" class="btn btn--warning btn--sm" id="btn-review-request-changes">Request Changes</button>');
    }
    if (reviewSubmission.currentUserCanEscalate) {
      reviewActionButtons.push('<button type="button" class="btn btn--secondary btn--sm" id="btn-review-escalate">Escalate</button>');
    }
    const actionButtons = reviewActionButtons.length ? `
      <div class="review-submit-banner__actions" style="display:flex;gap:8px;flex-wrap:wrap">
        ${reviewActionButtons.join('')}
      </div>
    ` : '';
    const label = reviewStatus === 'escalated' ? 'Escalated for review' : 'Submitted for review';
    const copy = reviewStatus === 'escalated'
      ? `Assigned to ${assignedReviewerLabel} for ${reviewScopeLabel}.`
      : `Assigned to ${assignedReviewerLabel} for ${reviewScopeLabel}.`;
    return `<div class="review-submit-banner review-submit-banner--submitted" id="review-submit-banner" role="status">
      <div class="review-submit-banner__body">
        <strong>${reviewSubmission.currentUserCanReview ? 'Assigned to you' : label}</strong>
        <span>${copy}</span>
        ${reviewFreshnessMarkup ? `<span class="review-submit-banner__meta">${reviewFreshnessMarkup}</span>` : ''}
      </div>
      ${actionButtons}
    </div>`;
  }
  if (reviewStatus === 'approved') {
    const reviewedBy = escapeHtml(String(reviewSubmission.reviewedBy || ''));
    const reviewedAt = Number(reviewSubmission.reviewedAt || 0);
    const reviewedLabel = reviewedAt ? new Date(reviewedAt).toLocaleDateString('en-GB') : '';
    return `<div class="review-submit-banner review-submit-banner--approved" id="review-submit-banner" role="status">
      <strong>Approved</strong>
      <span>Reviewed by ${reviewedBy}${reviewedLabel ? ` on ${reviewedLabel}` : ''}.</span>
      ${reviewFreshnessMarkup ? `<span class="review-submit-banner__meta">${reviewFreshnessMarkup}</span>` : ''}
    </div>`;
  }
  if (reviewStatus === 'changes_requested') {
    return `<div class="review-submit-banner review-submit-banner--changes" id="review-submit-banner" role="alert">
      <div class="review-submit-banner__body">
        <strong>Changes requested</strong>
        <span>${escapeHtml(reviewSubmission.reviewNote || 'Your reviewer has asked for changes before approving this assessment.')}</span>
        ${reviewFreshnessMarkup ? `<span class="review-submit-banner__meta">${reviewFreshnessMarkup}</span>` : ''}
      </div>
      <button type="button" class="btn btn--warning btn--sm" id="btn-revise-assessment">
        Revise Assessment
      </button>
    </div>`;
  }
  const triggerLabel = r?.criticalCondition
    ? 'has a critical response gate open'
    : r?.toleranceBreached
    ? 'exceeds your risk tolerance'
    : r?.nearTolerance
      ? 'is approaching your risk tolerance'
      : 'triggered the annual review threshold';
  return `<div class="review-submit-banner" id="review-submit-banner" role="alert">
    <div class="review-submit-banner__body">
      <strong>This result ${triggerLabel}.</strong>
      <span>Submit it to your reviewer for management sign-off.</span>
      ${reviewFreshnessMarkup ? `<span class="review-submit-banner__meta">${reviewFreshnessMarkup}</span>` : ''}
    </div>
    <button type="button" class="btn btn--primary btn--sm" id="btn-submit-review">
      Submit for Review
    </button>
  </div>`;
}

function renderAssessmentChallengeDisclosure() {
  return `<details class="wizard-disclosure card anim-fade-in" id="challenge-mode-section"
           style="margin-top:var(--sp-5)">
    <summary>
      Challenge this assessment
      <span class="badge badge--neutral">AI review</span>
    </summary>
    <div id="challenge-mode-body" style="padding:var(--sp-4)">
      <button class="btn btn--secondary" id="btn-run-challenge" type="button">
        Run AI Challenge
      </button>
      <p class="form-help" style="margin-top:8px">
        AI will argue against the current assessment - surface the weakest
        assumption, offer an alternative view, and ask the one question
        a risk committee would raise.
      </p>
    </div>
  </details>`;
}

function normaliseReviewerWorkflowMode(result = {}) {
  const mode = String(result?.mode || '').trim().toLowerCase();
  if (mode === 'live' || mode === 'deterministic_fallback' || mode === 'manual') return mode;
  if (result?.usedFallback) return 'deterministic_fallback';
  if (result?.aiUnavailable) return 'manual';
  return 'live';
}

function getReviewerWorkflowModePresentation(result = {}, {
  liveLabel = 'Live AI',
  fallbackLabel = 'Deterministic fallback',
  manualLabel = 'Manual guidance'
} = {}) {
  const mode = normaliseReviewerWorkflowMode(result);
  if (mode === 'deterministic_fallback') {
    return {
      mode,
      tone: 'warning',
      label: fallbackLabel,
      message: String(result?.fallbackReasonMessage || '').trim()
    };
  }
  if (mode === 'manual') {
    return {
      mode,
      tone: 'neutral',
      label: manualLabel,
      message: String(result?.manualReasonMessage || '').trim()
    };
  }
  return {
    mode: 'live',
    tone: 'success',
    label: liveLabel,
    message: ''
  };
}

function renderReviewerWorkflowModeBadge(result = {}, labels = {}) {
  const modeMeta = getReviewerWorkflowModePresentation(result, labels);
  return `<span class="badge badge--${modeMeta.tone}">${escapeHtml(String(modeMeta.label || 'Live AI'))}</span>`;
}

function buildReviewerWorkflowSuccessToast(result = {}, {
  live,
  deterministicFallback,
  manual
} = {}) {
  const modeMeta = getReviewerWorkflowModePresentation(result);
  if (modeMeta.mode === 'deterministic_fallback') {
    return {
      tone: 'warning',
      copy: deterministicFallback || 'Deterministic fallback output loaded. Review before using it.'
    };
  }
  if (modeMeta.mode === 'manual') {
    return {
      tone: 'info',
      copy: manual || 'Manual guidance loaded. Continue without treating it as live AI output.'
    };
  }
  return {
    tone: 'success',
    copy: live || 'Live AI guidance loaded.'
  };
}

function renderAssessmentChallengeResult(result = {}) {
  const verdict = String(result?.confidenceVerdict || 'Challenged');
  const verdictTone = verdict.includes('Reasonable')
    ? 'success'
    : verdict.includes('understated')
      ? 'warning'
      : 'danger';
  const modeMeta = getReviewerWorkflowModePresentation(result, {
    liveLabel: 'Live AI challenge',
    fallbackLabel: 'Deterministic fallback challenge',
    manualLabel: 'Manual challenge guidance'
  });
  return `<div class="challenge-card">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div class="challenge-verdict badge badge--${verdictTone}">${escapeHtml(verdict)}</div>
      ${renderReviewerWorkflowModeBadge(result, {
        liveLabel: 'Live AI challenge',
        fallbackLabel: 'Deterministic fallback challenge',
        manualLabel: 'Manual challenge guidance'
      })}
    </div>
    <p class="challenge-summary">${escapeHtml(String(result?.challengeSummary || ''))}</p>
    ${modeMeta.message ? `<div class="form-help">${escapeHtml(modeMeta.message)}</div>` : ''}
    <div class="challenge-grid">
      <div>
        <div class="challenge-label">Weakest assumption</div>
        <div class="challenge-text">${escapeHtml(String(result?.weakestAssumption || ''))}</div>
      </div>
      <div>
        <div class="challenge-label">Alternative view</div>
        <div class="challenge-text">${escapeHtml(String(result?.alternativeView || ''))}</div>
      </div>
    </div>
    <div class="challenge-question">
      <span class="challenge-label">Question to answer before accepting:</span>
      <em>${escapeHtml(String(result?.oneQuestion || ''))}</em>
    </div>
  </div>`;
}

const REVIEWER_BRIEF_FOCUS_KEY = 'rip_reviewer_focus';

function isReviewerBriefRole(user = AuthService.getCurrentUser()) {
  const role = String(user?.role || '').trim().toLowerCase();
  return role === 'bu_admin' || role === 'function_admin';
}

function getReviewerBriefScenarioType(assessment = {}) {
  return String(
    assessment?.scenarioLens?.key
      || assessment?.scenarioType
      || assessment?.structuredScenario?.primaryDriver
      || 'general'
  ).trim().toLowerCase() || 'general';
}

function readReviewerFocusStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEWER_BRIEF_FOCUS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeReviewerFocusStore(store) {
  try {
    localStorage.setItem(REVIEWER_BRIEF_FOCUS_KEY, JSON.stringify(store && typeof store === 'object' ? store : {}));
  } catch {}
}

function recordReviewerBriefFocusDuration(scenarioType, sectionKey, durationMs) {
  const duration = Number(durationMs || 0);
  if (!scenarioType || !sectionKey || duration <= 0) return;
  const store = readReviewerFocusStore();
  const scenarioStore = store[scenarioType] && typeof store[scenarioType] === 'object' ? store[scenarioType] : {};
  const entry = scenarioStore[sectionKey] && typeof scenarioStore[sectionKey] === 'object' ? scenarioStore[sectionKey] : { totalMs: 0, views: 0 };
  scenarioStore[sectionKey] = {
    totalMs: Number(entry.totalMs || 0) + duration,
    views: Number(entry.views || 0) + 1
  };
  store[scenarioType] = scenarioStore;
  writeReviewerFocusStore(store);
}

function getReviewerPreferredSection(scenarioType) {
  const scenarioStore = readReviewerFocusStore()?.[scenarioType];
  if (!scenarioStore || typeof scenarioStore !== 'object') return '';
  return Object.entries(scenarioStore)
    .sort((left, right) => Number(right?.[1]?.totalMs || 0) - Number(left?.[1]?.totalMs || 0))[0]?.[0] || '';
}

function inferReviewerBriefChallengeTarget(text = '') {
  const value = String(text || '').toLowerCase();
  if (/frequency|tef|cadence|often/.test(value)) return 'event-frequency';
  if (/control|vulnerab|exposure|threat capability|event success/.test(value)) return 'event-success';
  if (/business interruption|downtime|continuity|outage|service disruption/.test(value)) return 'business-interruption';
  if (/regulat|legal|privacy|contract|compliance/.test(value)) return 'regulatory-legal';
  if (/treatment|comparison|delta|improvement/.test(value)) return 'treatment-delta';
  return 'event-success';
}

function orderReviewerBriefSections(preferredSection, sections = []) {
  if (!preferredSection) return sections;
  const next = Array.isArray(sections) ? sections.slice() : [];
  const index = next.findIndex(section => section?.key === preferredSection);
  if (index <= 0) return next;
  const [match] = next.splice(index, 1);
  next.unshift(match);
  return next;
}

function renderReviewerBriefResultRows(result = {}, assessment) {
  const preferredSection = getReviewerPreferredSection(getReviewerBriefScenarioType(assessment));
  const modeMeta = getReviewerWorkflowModePresentation(result, {
    liveLabel: 'Live AI brief',
    fallbackLabel: 'Deterministic fallback brief',
    manualLabel: 'Manual reviewer brief'
  });
  const sections = orderReviewerBriefSections(preferredSection, [
    { key: 'what-matters', label: 'What matters', text: String(result?.whatMatters || '').trim(), tone: 'results-driver-label' },
    {
      key: 'whats-uncertain',
      label: 'What\'s uncertain',
      text: String(result?.whatsUncertain || '').trim(),
      challengeTarget: inferReviewerBriefChallengeTarget(result?.whatsUncertain)
    },
    { key: 'what-to-do', label: 'What to do', text: String(result?.whatToDo || '').trim() }
  ]).filter(section => section.text);
  return `<div class="reviewer-brief-grid">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      ${renderReviewerWorkflowModeBadge(result, {
        liveLabel: 'Live AI brief',
        fallbackLabel: 'Deterministic fallback brief',
        manualLabel: 'Manual reviewer brief'
      })}
      ${modeMeta.message ? `<span class="form-help">${escapeHtml(modeMeta.message)}</span>` : ''}
    </div>
    ${sections.map(section => `<article class="reviewer-brief-row" data-reviewer-brief-row="${escapeHtml(section.key)}">
      <div class="reviewer-brief-row__head">
        ${typeof UI.sectionEyebrow === 'function' ? UI.sectionEyebrow(section.label) : `<span class="ui-eyebrow"><span class="ui-eyebrow-mark" aria-hidden="true">◦</span><span>${escapeHtml(section.label)}</span></span>`}
        ${section.challengeTarget ? `<button type="button" class="btn btn--ghost btn--sm" data-reviewer-brief-challenge="${escapeHtml(section.challengeTarget)}">Challenge</button>` : ''}
      </div>
      <div class="reviewer-brief-row__text">${escapeHtml(section.text)}</div>
    </article>`).join('')}
  </div>`;
}

function renderReviewerBriefPanel(assessment, rolePresentation) {
  if (!isReviewerBriefRole()) return '';
  const hasBrief = assessment?.reviewerBrief && typeof assessment.reviewerBrief === 'object';
  return `<details class="wizard-disclosure card anim-fade-in reviewer-brief-panel" id="reviewer-brief-panel">
    <summary>
      30-Second Decision Brief
      <span class="badge badge--neutral">${escapeHtml(String(rolePresentation?.executiveNoteTitle || 'Reviewer'))}</span>
    </summary>
    <div id="reviewer-brief-body" style="padding:var(--sp-4)">
      ${hasBrief ? `
        <div class="form-help" style="margin-bottom:var(--sp-3)">Generated for quick review. Open Technical Detail only if you want to challenge a specific assumption.</div>
        ${renderReviewerBriefResultRows(assessment.reviewerBrief, assessment)}
      ` : `
        <button class="btn btn--secondary btn--sm" id="btn-generate-reviewer-brief" type="button">Generate Brief</button>
        <p class="form-help" style="margin-top:8px">Generate a 30-second reviewer brief from the executive summary, the current quantified result, and the main confidence posture.</p>
      `}
    </div>
  </details>`;
}

function annotateTechnicalChallengeTargets() {
  const cards = Array.from(document.querySelectorAll('#results-technical-challenge-panel .results-parameter-challenge-card'));
  cards.forEach(card => {
    const title = String(card.querySelector('.results-driver-label')?.textContent || '').trim().toLowerCase();
    let target = 'event-success';
    if (/event frequency/.test(title)) target = 'event-frequency';
    else if (/event success/.test(title)) target = 'event-success';
    else if (/business interruption/.test(title)) target = 'business-interruption';
    else if (/regulatory and legal/.test(title)) target = 'regulatory-legal';
    else if (/treatment delta/.test(title)) target = 'treatment-delta';
    card.dataset.reviewerBriefTarget = target;
  });
}

function focusTechnicalChallengeTarget(target) {
  if (!target) return;
  const safeTarget = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(String(target))
    : String(target).replace(/"/g, '\\"');
  const card = document.querySelector(`#results-technical-challenge-panel .results-parameter-challenge-card[data-reviewer-brief-target="${safeTarget}"]`);
  const host = card || document.getElementById('results-technical-challenge-panel');
  if (!host) return;
  if (card instanceof HTMLDetailsElement) card.open = true;
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  AppState.resultsReviewerBriefTarget = '';
}

function bindReviewerBriefFocusTracking(assessment) {
  const rows = Array.from(document.querySelectorAll('[data-reviewer-brief-row]'));
  if (!rows.length) return;
  const scenarioType = getReviewerBriefScenarioType(assessment);
  const visibleSince = new Map();
  const flush = key => {
    const startedAt = visibleSince.get(key);
    if (!startedAt) return;
    visibleSince.delete(key);
    recordReviewerBriefFocusDuration(scenarioType, key, Date.now() - startedAt);
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const key = String(entry.target?.dataset?.reviewerBriefRow || '').trim();
      if (!key) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        if (!visibleSince.has(key)) visibleSince.set(key, Date.now());
      } else {
        flush(key);
      }
    });
  }, { threshold: [0.6] });
  rows.forEach(row => observer.observe(row));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Array.from(visibleSince.keys()).forEach(flush);
  }, { once: true });
  window.addEventListener('hashchange', () => {
    Array.from(visibleSince.keys()).forEach(flush);
    observer.disconnect();
  }, { once: true });
}

function openAssessmentForRevision(assessment, {
  targetStep = '/wizard/4',
  applyDraftChanges = null
} = {}) {
  if (!assessment) return;
  let nextDraft = null;
  try {
    nextDraft = JSON.parse(JSON.stringify(assessment));
  } catch {
    nextDraft = { ...assessment };
  }
  delete nextDraft.results;
  delete nextDraft.completedAt;
  delete nextDraft._shared;
  delete nextDraft.assessmentChallenge;
  delete nextDraft.lifecycleMeta;
  delete nextDraft.lifecycleUpdatedAt;
  nextDraft.lifecycleStatus = deriveAssessmentLifecycleStatus({ ...nextDraft, results: null, completedAt: null });
  nextDraft.startedAt = nextDraft.startedAt || Date.now();
  nextDraft.createdAt = nextDraft.createdAt || Date.now();
  if (typeof applyDraftChanges === 'function') {
    nextDraft = applyDraftChanges(nextDraft) || nextDraft;
  }
  dispatchDraftAction('SET_DRAFT', {
    draft: { ...ensureDraftShape(), ...nextDraft, results: null, completedAt: null }
  });
  if (typeof markDraftDirty === 'function') markDraftDirty();
  if (typeof saveDraft === 'function') saveDraft();
  Router.navigate(targetStep);
}

function buildResultsMetricExplainerModel(metricKey, assessment, r, assessmentIntelligence = {}, runMetadata = {}) {
  if (typeof MetricExplainerService !== 'undefined' && MetricExplainerService && typeof MetricExplainerService.explainMetric === 'function') {
    return MetricExplainerService.explainMetric(metricKey, {
      assessment,
      results: r,
      parameters: assessment?.fairParams || r?.inputs || {},
      assessmentType: assessment?.assessmentType || r?.runConfig?.assessmentType,
      projectContext: assessment?.projectContext,
      projectExposure: assessment?.projectExposure,
      projectHorizon: r?.projectHorizon,
      decisionBrief: assessment?.decisionBrief,
      parameterCoach: assessment?.parameterCoach,
      assumptionRegister: assessment?.assumptionRegister,
      evidenceMap: assessment?.evidenceMap,
      assumptionSummary: assessmentIntelligence?.assumptions,
      runMetadata
    });
  }
  return {
    metric: String(metricKey || '').trim(),
    label: 'Metric detail',
    plainEnglish: 'This number is generated from the saved simulation result.',
    calculationLogic: 'The deterministic metric explainer service is unavailable, so only a basic explanation can be shown.',
    mainDrivers: ['Current model parameters and saved result context.'],
    sourceContext: {
      userProvided: [],
      evidenceSupported: [],
      derived: ['Saved RiskEngine result.'],
      benchmarkProxy: [],
      unknown: ['Detailed source context is unavailable.']
    },
    whatWouldLowerIt: 'Lower input ranges or stronger controls would lower this number.',
    whatWouldIncreaseIt: 'Higher input ranges or weaker controls would increase this number.',
    caveat: 'Detailed source status is unavailable.'
  };
}

function renderResultsMetricExplainerPanel(model) {
  if (!model) return '';
  const sourceContext = model.sourceContext && typeof model.sourceContext === 'object' ? model.sourceContext : {};
  const renderList = (items, empty = 'None identified for this metric.') => {
    const values = Array.isArray(items) ? items.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6) : [];
    return values.length ? values.map(item => `• ${escapeHtml(item)}`).join('<br>') : escapeHtml(empty);
  };
  const mainDrivers = Array.isArray(model.mainDrivers) ? model.mainDrivers : [];
  return `<div class="assumption-explainer-panel">
    <div class="assumption-explainer-panel__head">
      <div>
        <div class="assumption-explainer-panel__label">Metric explainer</div>
        <strong>${escapeHtml(String(model.label || model.title || 'Metric detail'))}</strong>
      </div>
      ${model.metric ? `<span class="badge badge--neutral">${escapeHtml(String(model.metric))}</span>` : ''}
    </div>
    <p class="assumption-explainer-panel__copy">${escapeHtml(String(model.plainEnglish || model.meaning || ''))}</p>
    <div class="assumption-explainer-panel__logic">${escapeHtml(String(model.calculationLogic || ''))}</div>
    <div class="assumption-explainer-panel__grid">
      <div>
        <div class="assumption-explainer-panel__section">Main drivers</div>
        <p>${renderList(mainDrivers, 'No specific driver summary is attached yet.')}</p>
      </div>
      <div>
        <div class="assumption-explainer-panel__section">Source context</div>
        <p><strong>User provided</strong><br>${renderList(sourceContext.userProvided, 'No user-provided source identified.')}<br><br><strong>Evidence supported</strong><br>${renderList(sourceContext.evidenceSupported, 'No evidence-supported source identified.')}</p>
      </div>
      <div>
        <div class="assumption-explainer-panel__section">What would move it down</div>
        <p>${escapeHtml(String(model.whatWouldLowerIt || model.moveDown || ''))}</p>
      </div>
      <div>
        <div class="assumption-explainer-panel__section">What would move it up</div>
        <p>${escapeHtml(String(model.whatWouldIncreaseIt || model.moveUp || ''))}</p>
      </div>
    </div>
    <div class="metric-source-grid">
      <div><span>Derived</span><p>${renderList(sourceContext.derived, 'No derived source identified.')}</p></div>
      <div><span>Benchmark proxy</span><p>${renderList(sourceContext.benchmarkProxy, 'No benchmark proxy source identified.')}</p></div>
      <div><span>Unknown</span><p>${renderList(sourceContext.unknown, 'No unknown source identified.')}</p></div>
    </div>
    <div class="assumption-explainer-panel__foot">${escapeHtml(String(model.caveat || model.dependency || ''))}</div>
  </div>`;
}

function renderReviewMediationResult(result = {}) {
  const modeMeta = getReviewerWorkflowModePresentation(result, {
    liveLabel: 'Live AI mediation',
    fallbackLabel: 'Deterministic fallback mediation',
    manualLabel: 'Manual mediation guidance'
  });
  const proposedValue = String(result?.recommendedValueLabel || '').trim();
  return `<div class="meeting-room-result">
    <div class="meeting-room-result__head">
      <div>
        <div class="meeting-room-result__label">${escapeHtml(modeMeta.label)}</div>
        <strong>${escapeHtml(String(result?.proposedMiddleGround || 'Proposed middle ground'))}</strong>
      </div>
      ${proposedValue ? `<span class="badge badge--warning">${escapeHtml(proposedValue)}</span>` : '<span class="badge badge--neutral">No single number change</span>'}
    </div>
    <p class="meeting-room-result__copy">${escapeHtml(String(result?.reconciliationSummary || ''))}</p>
    ${modeMeta.message ? `<div class="form-help" style="margin-top:8px">${escapeHtml(modeMeta.message)}</div>` : ''}
    <div class="meeting-room-result__grid">
      <div>
        <div class="meeting-room-result__section">Why this is reasonable</div>
        <p>${escapeHtml(String(result?.whyReasonable || ''))}</p>
      </div>
      <div>
        <div class="meeting-room-result__section">Best evidence to verify next</div>
        <p>${escapeHtml(String(result?.evidenceToVerify || ''))}</p>
      </div>
    </div>
    <div class="meeting-room-result__actions">
      ${modeMeta.mode === 'manual' ? '' : '<button type="button" class="btn btn--primary btn--sm" id="btn-accept-mediation">Accept proposal</button>'}
      <button type="button" class="btn btn--secondary btn--sm" id="btn-revise-mediation">Revise manually</button>
      <button type="button" class="btn btn--ghost btn--sm" id="btn-continue-mediation">Continue discussion</button>
    </div>
  </div>`;
}

function renderDecisionDNACardContent(pattern = {}) {
  if (!pattern?.summary) return '';
  const toneClass = pattern.tone === 'warning'
    ? 'decision-dna-card--warning'
    : pattern.tone === 'success'
      ? 'decision-dna-card--success'
      : 'decision-dna-card--neutral';
  return `<div class="decision-dna-card ${toneClass}">
    <div class="decision-dna-card__label">Decision DNA</div>
    <div class="decision-dna-card__summary">${escapeHtml(pattern.summary)}</div>
    <div class="decision-dna-card__copy">${escapeHtml(pattern.rangeHint || '')}</div>
    ${Array.isArray(pattern.challengedAssumptions) && pattern.challengedAssumptions.length ? `<div class="decision-dna-card__foot">Recently challenged assumption: <strong>${escapeHtml(pattern.challengedAssumptions[0])}</strong></div>` : ''}
  </div>`;
}

function renderDecisionDNASection(assessment) {
  const pattern = typeof OrgIntelligenceService !== 'undefined' && typeof OrgIntelligenceService.buildDecisionPattern === 'function'
    ? OrgIntelligenceService.buildDecisionPattern(assessment)
    : null;
  return `<div id="decision-dna-host">${pattern ? renderDecisionDNACardContent(pattern) : ''}</div>`;
}

function renderReviewMeetingRoom(assessment) {
  const reviewStatus = String(assessment?.reviewSubmission?.reviewStatus || '').trim().toLowerCase();
  const savedMediation = assessment?.reviewMediation || null;
  if (reviewStatus !== 'changes_requested' && !savedMediation) return '';
  const reviewerView = String(assessment?.reviewSubmission?.reviewNote || 'Reviewer feedback was not captured in the queue item.').trim();
  const analystView = String(savedMediation?.analystView || '').trim();
  const focusOptions = [
    'Overall assessment',
    'Event frequency',
    'Control strength',
    'Threat capability',
    'Business disruption',
    'Regulatory and legal impact',
    'Evidence quality'
  ];
  const selectedFocus = String(savedMediation?.disputedFocus || 'Overall assessment').trim();
  return `<details class="wizard-disclosure card anim-fade-in" id="meeting-room-section" style="margin-top:var(--sp-5)" ${savedMediation?.result ? 'open' : ''}>
    <summary>
      AI Meeting Room
      <span class="badge badge--neutral">Focused mediation</span>
    </summary>
    <div id="meeting-room-body" style="padding:var(--sp-4)">
      <div class="meeting-room-context">
        <div class="meeting-room-context__block">
          <div class="meeting-room-context__label">Reviewer view</div>
          <p>${escapeHtml(reviewerView)}</p>
        </div>
        <div class="meeting-room-context__block">
          <label class="form-label" for="meeting-room-focus">Focus the disagreement</label>
          <select class="form-select" id="meeting-room-focus">
            ${focusOptions.map(option => `<option value="${escapeHtml(option)}" ${option === selectedFocus ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </div>
        <div class="meeting-room-context__block">
          <label class="form-label" for="meeting-room-analyst-view">Analyst view</label>
          <textarea id="meeting-room-analyst-view" class="form-textarea" rows="4" placeholder="State the analyst view as clearly as possible: what you disagree with, what evidence you trust, and where you think the reviewer is too conservative or too optimistic.">${escapeHtml(analystView)}</textarea>
          <div class="form-help" style="margin-top:8px">Keep this tight. The goal is not a debate thread; it is a defensible compromise or a clearer next evidence ask.</div>
        </div>
        <div class="meeting-room-context__actions">
          <button class="btn btn--secondary" id="btn-run-mediation" type="button">Run AI Mediation</button>
          <span class="form-help" id="meeting-room-status">AI will use the reviewer note, current model context, and saved evidence to suggest a middle ground.</span>
        </div>
      </div>
      <div id="meeting-room-result-host">${savedMediation?.result ? renderReviewMediationResult(savedMediation.result) : ''}</div>
    </div>
  </details>`;
}

function bindReviewBannerActions(assessment, { isShared = false } = {}) {
  const applyReviewQueueItem = (item = {}) => {
    const nextSubmission = buildLocalReviewSubmissionFromQueueItem(item || {});
    updateAssessmentRecord(assessment.id, rec => ({
      ...rec,
      reviewSubmission: {
        ...(rec.reviewSubmission || {}),
        ...nextSubmission
      }
    }));
    return nextSubmission;
  };
  const handleReviewQueueUpdateFailure = (error, fallbackMessage) => {
    if (error?.code === 'WRITE_CONFLICT' && error.latestItem) {
      applyReviewQueueItem(error.latestItem);
      UI.toast('This review item changed in another tab or session. Loaded the latest status.', 'warning');
      renderResults(assessment.id, isShared || assessment._shared);
      return true;
    }
    UI.toast(fallbackMessage, 'danger');
    return false;
  };
  const handleReviewQueueInvalidated = (event) => {
    const changedAssessmentId = String(event?.detail?.assessmentId || '').trim();
    if (changedAssessmentId && changedAssessmentId !== String(assessment?.id || '').trim()) return;
    const latestAssessment = typeof getAssessmentById === 'function'
      ? (getAssessmentById(assessment.id) || assessment)
      : assessment;
    void refreshReviewStatus(latestAssessment, latestAssessment?.results || assessment?.results);
  };
  window.addEventListener('rq:review-queue-invalidated', handleReviewQueueInvalidated);
  window.AppShellPage?.registerCleanup?.(() => {
    window.removeEventListener('rq:review-queue-invalidated', handleReviewQueueInvalidated);
  });

  document.getElementById('btn-revise-assessment')?.addEventListener('click', () => {
    openAssessmentForRevision(assessment, { targetStep: '/wizard/4' });
  });
  document.getElementById('btn-submit-review')?.addEventListener('click', async () => {
    try {
      const targetState = await fetchReviewTargets('submit');
      const targets = Array.isArray(targetState?.targets) ? targetState.targets : [];
      if (!targets.length) {
        UI.toast('No reviewer is configured for your current scope yet.', 'warning');
        return;
      }
      const options = targets.map((target) => `
        <option value="${escapeHtml(String(target.username || ''))}" ${target.username === targetState.defaultTargetUsername ? 'selected' : ''}>
          ${escapeHtml(String(target.displayName || target.username || ''))} (${escapeHtml(getResultsReviewScopeLabel(target.reviewScope || ''))})
        </option>
      `).join('');
      const modal = UI.modal({
        title: 'Submit for review',
        body: `
          <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
            <div class="form-help">Choose who should own the next review step for this assessment.</div>
            <div>
              <label class="form-label" for="review-submit-target">Submit to</label>
              <select id="review-submit-target" class="form-select" style="width:100%">
                ${options}
              </select>
            </div>
            <div class="flex gap-3" style="flex-wrap:wrap">
              <button type="button" class="btn btn--primary" id="btn-confirm-submit-review">Submit</button>
              <button type="button" class="btn btn--ghost" id="btn-cancel-submit-review">Cancel</button>
            </div>
          </div>
        `
      });
      document.getElementById('btn-cancel-submit-review')?.addEventListener('click', () => modal.close());
      document.getElementById('btn-confirm-submit-review')?.addEventListener('click', async () => {
        const targetUsername = String(document.getElementById('review-submit-target')?.value || '').trim().toLowerCase();
        if (!targetUsername) {
          UI.toast('Select a reviewer first.', 'warning');
          return;
        }
        const confirmButton = document.getElementById('btn-confirm-submit-review');
        if (confirmButton) {
          confirmButton.disabled = true;
          confirmButton.textContent = 'Submitting…';
        }
        try {
          const response = await fetch(resolveResultsReviewQueueApiUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-session-token': getResultsSessionToken()
            },
            body: JSON.stringify({
              assessment,
              assignedReviewerUsername: targetUsername,
              sharedAssessment: typeof ShareService !== 'undefined' && typeof ShareService.buildSharePayload === 'function'
                ? ShareService.buildSharePayload(assessment)
                : null
            })
          });
          if (response.status === 409) {
            UI.toast('This assessment is already in the review queue.', 'warning');
            if (confirmButton) {
              confirmButton.disabled = false;
              confirmButton.textContent = 'Submit';
            }
            return;
          }
          if (!response.ok) throw new Error('Submit failed');
          const { item } = await response.json();
          updateAssessmentRecord(assessment.id, rec => ({
            ...rec,
            reviewSubmission: {
              ...(rec.reviewSubmission || {}),
              ...buildLocalReviewSubmissionFromQueueItem(item || {})
            }
          }));
          window.AppCrossTabSync?.broadcastReviewQueueChanged?.({
            assessmentId: String(assessment.id || '').trim(),
            reviewId: String(item?.id || '').trim()
          });
          modal.close();
          UI.toast('Assessment submitted for review.', 'success');
          renderResults(assessment.id, isShared || assessment._shared);
        } catch {
          UI.toast('Could not submit for review. Try again in a moment.', 'danger');
          if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Submit';
          }
        }
      });
    } catch {
      UI.toast('Could not load the reviewer list right now.', 'danger');
    }
  });
  document.getElementById('btn-review-approve')?.addEventListener('click', async function() {
    const button = this;
    const reviewId = String(assessment?.reviewSubmission?.reviewId || '').trim();
    if (!reviewId) return;
    button.disabled = true;
    button.textContent = 'Approving…';
    try {
      const { item } = await patchReviewQueueItem(reviewId, {
        reviewStatus: 'approved'
      }, Number(assessment?.reviewSubmission?.reviewRevision || 1));
      applyReviewQueueItem(item || {});
      window.AppCrossTabSync?.broadcastReviewQueueChanged?.({
        assessmentId: String(assessment.id || '').trim(),
        reviewId: String(item?.id || reviewId).trim()
      });
      UI.toast('Assessment approved.', 'success');
      renderResults(assessment.id, isShared || assessment._shared);
    } catch (error) {
      if (handleReviewQueueUpdateFailure(error, 'Could not approve this assessment right now.')) return;
      button.disabled = false;
      button.textContent = 'Approve';
    }
  });
  document.getElementById('btn-review-request-changes')?.addEventListener('click', () => {
    const reviewId = String(assessment?.reviewSubmission?.reviewId || '').trim();
    if (!reviewId) return;
    const modal = UI.modal({
      title: 'Request changes',
      body: `
        <label for="results-review-changes-reason" class="form-label">
          Reason <span style="color:var(--danger)">*</span>
        </label>
        <textarea id="results-review-changes-reason" class="form-textarea" rows="4"
          placeholder="Describe what needs to change before this can be approved…"
          style="width:100%;margin-bottom:var(--sp-4)"></textarea>
        <div class="flex gap-3">
          <button type="button" class="btn btn--primary" id="btn-results-confirm-changes">
            Send Request
          </button>
          <button type="button" class="btn btn--ghost" id="btn-results-cancel-changes">Cancel</button>
        </div>
      `
    });
    document.getElementById('btn-results-cancel-changes')?.addEventListener('click', () => modal.close());
    document.getElementById('btn-results-confirm-changes')?.addEventListener('click', async () => {
      const reason = String(document.getElementById('results-review-changes-reason')?.value || '').trim();
      if (!reason) {
        UI.toast('Please enter a reason before sending.', 'warning');
        return;
      }
      const confirmButton = document.getElementById('btn-results-confirm-changes');
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Sending…';
      }
      try {
        const { item } = await patchReviewQueueItem(reviewId, {
          reviewStatus: 'changes_requested',
          reviewNote: reason
        }, Number(assessment?.reviewSubmission?.reviewRevision || 1));
        applyReviewQueueItem(item || {});
        window.AppCrossTabSync?.broadcastReviewQueueChanged?.({
          assessmentId: String(assessment.id || '').trim(),
          reviewId: String(item?.id || reviewId).trim()
        });
        modal.close();
        UI.toast('Changes requested.', 'success');
        renderResults(assessment.id, isShared || assessment._shared);
      } catch (error) {
        if (handleReviewQueueUpdateFailure(error, 'Could not send the change request right now.')) {
          modal.close();
          return;
        }
        if (confirmButton) {
          confirmButton.disabled = false;
          confirmButton.textContent = 'Send Request';
        }
      }
    });
  });
  document.getElementById('btn-review-escalate')?.addEventListener('click', async () => {
    const reviewId = String(assessment?.reviewSubmission?.reviewId || '').trim();
    if (!reviewId) return;
    try {
      const targetState = await fetchReviewTargets('escalate');
      const targets = Array.isArray(targetState?.targets) ? targetState.targets : [];
      if (!targets.length) {
        UI.toast('No holding-company reviewer is configured yet.', 'warning');
        return;
      }
      const modal = UI.modal({
        title: 'Escalate assessment',
        body: `
          <label for="results-review-escalate-target" class="form-label">Escalate to</label>
          <select id="results-review-escalate-target" class="form-select" style="width:100%;margin-bottom:var(--sp-4)">
            ${targets.map(target => `
              <option value="${escapeHtml(String(target.username || ''))}" ${target.username === targetState.defaultTargetUsername ? 'selected' : ''}>
                ${escapeHtml(String(target.displayName || target.username || ''))}
              </option>
            `).join('')}
          </select>
          <div class="flex gap-3">
            <button type="button" class="btn btn--primary" id="btn-results-confirm-escalate">Escalate</button>
            <button type="button" class="btn btn--ghost" id="btn-results-cancel-escalate">Cancel</button>
          </div>
        `
      });
      document.getElementById('btn-results-cancel-escalate')?.addEventListener('click', () => modal.close());
      document.getElementById('btn-results-confirm-escalate')?.addEventListener('click', async () => {
        const target = String(document.getElementById('results-review-escalate-target')?.value || '').trim().toLowerCase();
        if (!target) {
          UI.toast('Select a target first.', 'warning');
          return;
        }
        const confirmButton = document.getElementById('btn-results-confirm-escalate');
        if (confirmButton) {
          confirmButton.disabled = true;
          confirmButton.textContent = 'Escalating…';
        }
        try {
          const { item } = await patchReviewQueueItem(reviewId, {
            reviewStatus: 'escalated',
            escalatedTo: target
          }, Number(assessment?.reviewSubmission?.reviewRevision || 1));
          applyReviewQueueItem(item || {});
          window.AppCrossTabSync?.broadcastReviewQueueChanged?.({
            assessmentId: String(assessment.id || '').trim(),
            reviewId: String(item?.id || reviewId).trim()
          });
          modal.close();
          UI.toast('Assessment escalated.', 'success');
          renderResults(assessment.id, isShared || assessment._shared);
        } catch (error) {
          if (handleReviewQueueUpdateFailure(error, 'Could not escalate this assessment right now.')) {
            modal.close();
            return;
          }
          if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Escalate';
          }
        }
      });
    } catch {
      UI.toast('Could not load the escalation targets right now.', 'danger');
    }
  });
}

async function refreshReviewStatus(assessment, r) {
  if (!assessment?.id || !assessment?.results) return;
  try {
    const response = await fetch(resolveResultsReviewQueueApiUrl(), {
      headers: { 'x-session-token': getResultsSessionToken() }
    });
    if (!response.ok) return;
    const { items } = await response.json();
    const matched = Array.isArray(items) ? items.find(item => String(item?.assessmentId || '') === String(assessment.id || '')) : null;
    if (!matched) return;
    const nextSubmission = buildLocalReviewSubmissionFromQueueItem(matched);
    const currentSubmission = assessment.reviewSubmission || {};
    const hasChanged = [
      'reviewId',
      'reviewStatus',
      'reviewRevision',
      'submittedAt',
      'submittedByUsername',
      'assignedReviewerUsername',
      'assignedReviewerDisplayName',
      'assignedReviewerRole',
      'reviewScope',
      'reviewNote',
      'reviewedBy',
      'reviewedAt',
      'updatedAt',
      'escalatedTo',
      'escalatedBy',
      'escalatedAt',
      'currentUserCanReview',
      'currentUserCanEscalate',
      'currentUserCanView',
      'isAssignedToCurrentUser'
    ].some(key => nextSubmission[key] !== currentSubmission[key]);
    if (!hasChanged) return;
    const next = updateAssessmentRecord(assessment.id, rec => ({
      ...rec,
      reviewSubmission: {
        ...(rec.reviewSubmission || {}),
        ...nextSubmission
      },
      reviewDecision: {
        decision: nextSubmission.reviewStatus,
        timeToDecide: matched.submittedAt && matched.reviewedAt
          ? Math.max(0, Number(matched.reviewedAt) - Number(matched.submittedAt))
          : 0,
        challengedAssumption: nextSubmission.reviewNote || '',
        reviewedBy: nextSubmission.reviewedBy || '',
        reviewedAt: Number(nextSubmission.reviewedAt || 0)
      }
    }));
    if (!next) return;
    renderResults(assessment.id, assessment._shared);
  } catch {}
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
  technicalInputs,
  assessmentIntelligence,
  missingInformation,
  rolePresentation,
  executiveHeadline,
  statusTitle,
  statusDetail,
  executiveDecision,
  executiveAction,
  confidenceFrame
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
    persistResultsTabPreference(nextTab);
    renderResults(id, isShared || assessment._shared);
    if (nextTab === 'executive') {
      window.requestAnimationFrame(() => {
        const lc = document.getElementById('chart-lec');
        if (lc) UI.drawLEC(lc, r.lec, r.threshold, AppState.currency, AppState.fxRate);
      });
    }
  };

  bindResultsTabBar({ activeTab, activateResultsTab });
  annotateTechnicalChallengeTargets();
  if (activeTab === 'technical' && AppState.resultsReviewerBriefTarget) {
    window.requestAnimationFrame(() => focusTechnicalChallengeTarget(AppState.resultsReviewerBriefTarget));
  }
  if (activeTab === 'appendix' || activeTab === 'executive') drawResultsTechnicalCharts(r);
  else attachCitationHandlers();
  bindReviewBannerActions(assessment, { isShared: isShared || assessment._shared });
  bindReviewerBriefFocusTracking(assessment);
  refreshReviewStatus(assessment, r);
  OrgIntelligenceService?.refresh?.().then?.(() => {
    const host = document.getElementById('decision-dna-host');
    if (!host) return;
    const latest = getAssessmentById(assessment.id) || assessment;
    const pattern = OrgIntelligenceService?.buildDecisionPattern?.(latest);
    host.innerHTML = pattern ? renderDecisionDNACardContent(pattern) : '';
  }).catch?.(() => {});
  document.querySelectorAll('[data-results-explain]').forEach(button => {
    button.addEventListener('click', () => {
      const metricKey = String(button.dataset.resultsExplain || '').trim();
      const host = document.getElementById('results-assumption-explainer-host');
      if (!host || !metricKey) return;
      if (host.dataset.metricKey === metricKey && host.style.display !== 'none') {
        host.style.display = 'none';
        host.innerHTML = '';
        host.dataset.metricKey = '';
        button.setAttribute('aria-expanded', 'false');
        return;
      }
      const model = buildResultsMetricExplainerModel(metricKey, assessment, r, assessmentIntelligence, assessment.results?.runMetadata || {});
      if (!model) return;
      document.querySelectorAll('[data-results-explain]').forEach(explainButton => explainButton.setAttribute('aria-expanded', 'false'));
      host.dataset.metricKey = metricKey;
      host.innerHTML = renderResultsMetricExplainerPanel(model);
      host.style.display = 'block';
      button.setAttribute('aria-expanded', 'true');
      host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
  document.querySelectorAll('[data-reviewer-brief-challenge]').forEach(button => {
    button.addEventListener('click', () => {
      AppState.resultsReviewerBriefTarget = String(button.dataset.reviewerBriefChallenge || '').trim();
      activateResultsTab('technical', { focusTarget: 'panel' });
    });
  });
  document.querySelectorAll('[data-parameter-challenge-open]').forEach(button => {
    button.addEventListener('click', () => {
      const parameterKey = String(button.dataset.parameterChallengeOpen || '').trim();
      const parameterTarget = findParameterChallengeTarget(assessment, technicalInputs, assessmentIntelligence, parameterKey);
      if (!parameterTarget) {
        UI.toast('That parameter is not available to challenge right now.', 'warning');
        return;
      }
      openParameterChallengeModal({
        assessment,
        parameterTarget,
        technicalInputs,
        assessmentIntelligence,
        isShared,
        id
      });
    });
  });
  document.querySelectorAll('[data-parameter-challenge-apply]').forEach(button => {
    button.addEventListener('click', () => {
      const challengeId = String(button.dataset.parameterChallengeApply || '').trim();
      const latest = getAssessmentById(assessment.id) || assessment;
      const record = normaliseParameterChallengeRecords(latest).find(item => item.id === challengeId);
      if (!record) {
        UI.toast('That challenge record could not be found anymore.', 'warning');
        return;
      }
      updateAssessmentRecord(latest.id, current => ({
        ...current,
        parameterChallenges: normaliseParameterChallengeRecords(current).map(item => (
          item.id === challengeId ? { ...item, appliedAt: Date.now() } : item
        ))
      }));
      AppState.pendingParameterChallengeAutoRun = {
        assessmentId: latest.id,
        challengeId
      };
      openAssessmentForRevision(latest, {
        targetStep: '/wizard/5',
        applyDraftChanges: draftRecord => {
          const nextDraft = applyParameterAdjustmentToDraftRecord(draftRecord, record);
          nextDraft.parameterChallenges = normaliseParameterChallengeRecords(getAssessmentById(latest.id) || latest).map(item => (
            item.id === challengeId ? { ...item, appliedAt: Date.now() } : item
          ));
          return nextDraft;
        }
      });
      UI.toast('Reviewer adjustment loaded into the model and queued for rerun.', 'success');
    });
  });
  document.querySelectorAll('[data-decision-brief-feedback-reason]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-decision-brief-feedback-reason]').forEach(peer => {
        const active = peer === button && button.getAttribute('aria-pressed') !== 'true';
        peer.setAttribute('aria-pressed', active ? 'true' : 'false');
        peer.classList.toggle('btn--secondary', active);
        peer.classList.toggle('btn--ghost', !active);
      });
    });
  });
  document.querySelectorAll('[data-decision-brief-run]').forEach(button => {
    button.addEventListener('click', async () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const requestPayload = buildDecisionBriefPayload(latest, r, technicalInputs, runMetadata);
      const feedbackReason = getSelectedDecisionBriefFeedbackReason();
      const previousBrief = readSavedDecisionBrief(latest);
      if (guardResultsAiActionCooldown({
        button,
        actionKey: 'decision-brief',
        endpoint: '/api/ai/decision-brief',
        payload: requestPayload,
        assessment: latest,
        fallbackId: id,
        cooldownLabel: 'Loaded just now',
        message: 'This Decision Brief already reflects the current simulation. Review it or change inputs before rerunning.'
      })) return;
      const resetBusy = setResultsAiActionBusy(button, 'Briefing…');
      try {
        const result = await LLMService.generateDecisionBrief(requestPayload);
        markResultsAiActionCooldown('decision-brief', '/api/ai/decision-brief', requestPayload, latest, id);
        const decisionBrief = normaliseDecisionBriefForResults(result?.decisionBrief || {});
        if (feedbackReason) {
          recordResultsStructuredAiFeedback(latest, {
            eventType: 'decision_brief_regenerated',
            targetType: 'decision_brief',
            targetId: latest.id || id || '',
            reasonCode: feedbackReason,
            note: 'User regenerated the Decision Brief with a selected feedback reason.',
            before: previousBrief || null,
            after: decisionBrief,
            projectExposureRefs: Array.isArray(latest?.projectExposure?.financialDrivers)
              ? latest.projectExposure.financialDrivers.map(driver => driver.id || driver.label).filter(Boolean).slice(0, 6)
              : [],
            sourceStatusBefore: previousBrief ? 'derived' : 'unknown',
            sourceStatusAfter: result?.usedFallback ? 'derived' : 'evidence_supported'
          });
        }
        updateAssessmentRecord(latest.id, current => {
          const next = {
            ...current,
            decisionBrief,
            decisionBriefMeta: {
              mode: String(result?.mode || '').trim().toLowerCase(),
              usedFallback: result?.usedFallback === true,
              aiUnavailable: result?.aiUnavailable === true,
              fallbackReasonMessage: String(result?.fallbackReasonMessage || '').trim(),
              fallbackReasonTitle: String(result?.fallbackReasonTitle || '').trim(),
              generatedAt: String(result?.generatedAt || new Date().toISOString())
            }
          };
          return {
            ...next,
            aiAuditStory: buildSavedAiAuditStory(next)
          };
        });
        const toastMeta = buildReviewerWorkflowSuccessToast(result, {
          live: 'Decision Brief loaded.',
          deterministicFallback: 'Deterministic fallback Decision Brief loaded. Review sparse-data warnings before relying on it.',
          manual: 'Decision Brief guidance loaded.'
        });
        UI.toast(toastMeta.copy, toastMeta.tone, 5000);
        renderResults(latest.id, isShared || latest._shared);
      } catch (error) {
        console.error('generateDecisionBrief failed:', error);
        UI.toast('Decision Brief is unavailable right now. Try again.', 'danger');
      } finally {
        resetBusy();
      }
    });
  });
  document.querySelectorAll('[data-decision-challenge-run]').forEach(button => {
    button.addEventListener('click', async () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const requestPayload = buildDecisionChallengePayload(latest, r, technicalInputs, runMetadata);
      if (guardResultsAiActionCooldown({
        button,
        actionKey: 'decision-challenge',
        endpoint: '/api/ai/decision-challenge',
        payload: requestPayload,
        assessment: latest,
        fallbackId: id,
        cooldownLabel: 'Loaded just now',
        message: 'This Challenge Agent review already reflects the current simulation. Review it or change inputs before rerunning.'
      })) return;
      const resetBusy = setResultsAiActionBusy(button, 'Challenging…');
      try {
        const result = await LLMService.generateDecisionChallenge(requestPayload);
        markResultsAiActionCooldown('decision-challenge', '/api/ai/decision-challenge', requestPayload, latest, id);
        const decisionChallenge = normaliseDecisionChallengeResult(result?.decisionChallenge || {});
        updateAssessmentRecord(latest.id, current => {
          const next = {
            ...current,
            decisionChallenge,
            decisionChallengeMeta: {
              mode: String(result?.mode || '').trim().toLowerCase(),
              usedFallback: result?.usedFallback === true,
              aiUnavailable: result?.aiUnavailable === true,
              fallbackReasonMessage: String(result?.fallbackReasonMessage || '').trim(),
              fallbackReasonTitle: String(result?.fallbackReasonTitle || '').trim(),
              generatedAt: String(result?.generatedAt || new Date().toISOString())
            }
          };
          return {
            ...next,
            aiAuditStory: buildSavedAiAuditStory(next)
          };
        });
        const toastMeta = buildReviewerWorkflowSuccessToast(result, {
          live: 'Challenge Agent review loaded.',
          deterministicFallback: 'Deterministic fallback Challenge Agent review loaded. Review the stress cases before relying on it.',
          manual: 'Challenge Agent guidance loaded.'
        });
        UI.toast(toastMeta.copy, toastMeta.tone, 5000);
        renderResults(latest.id, isShared || latest._shared);
      } catch (error) {
        console.error('generateDecisionChallenge failed:', error);
        UI.toast('Challenge Agent is unavailable right now. Try again.', 'danger');
      } finally {
        resetBusy();
      }
    });
  });
  document.querySelectorAll('[data-decision-challenge-stress]').forEach(button => {
    button.addEventListener('click', () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const challenge = readDecisionChallenge(latest);
      const stressId = String(button.dataset.decisionChallengeStress || '').trim();
      const stressTest = (Array.isArray(challenge?.recommendedStressTests) ? challenge.recommendedStressTests : [])
        .find(item => String(item.id || '').trim() === stressId);
      if (!stressTest) {
        UI.toast('That stress case could not be found anymore.', 'warning');
        return;
      }
      const comparison = runDecisionChallengeStressComparison({
        assessment: latest,
        technicalInputs,
        r,
        runMetadata,
        stressTest
      });
      if (!comparison || comparison.error) {
        UI.toast(comparison?.error || 'Stress case could not be run for this result.', 'warning');
        return;
      }
      const storedComparison = {
        id: comparison.id,
        stressTestId: comparison.stressTestId,
        title: comparison.title,
        baseAleRange: comparison.baseAleRange,
        projectedAleRange: comparison.projectedAleRange,
        changePct: comparison.changePct,
        patchLabel: comparison.patchLabel,
        validationWarnings: comparison.validationWarnings,
        createdAt: comparison.createdAt
      };
      updateAssessmentRecord(latest.id, current => ({
        ...current,
        decisionChallengeStressComparisons: [
          storedComparison,
          ...getDecisionChallengeStressComparisons(current).filter(item => item.stressTestId !== stressId)
        ].slice(0, 8)
      }));
      UI.toast('Stress case comparison saved. Baseline result was not overwritten.', 'success', 5000);
      renderResults(latest.id, isShared || latest._shared);
    });
  });
  document.querySelectorAll('[data-consensus-path-run]').forEach(button => {
    button.addEventListener('click', async () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const openRecords = getOpenParameterChallengeRecords(latest);
      if (!openRecords.length) {
        UI.toast('There are no open reviewer adjustments to reconcile right now.', 'warning');
        return;
      }
      const analysis = runConsensusPathAnalysis({
        assessment: latest,
        technicalInputs,
        r,
        runMetadata
      });
      if (!analysis) {
        UI.toast('Consensus analysis is not available for this assessment right now.', 'warning');
        return;
      }
      const requestPayload = {
        scenarioTitle: getResultsScenarioDisplayTitle(latest),
        scenarioSummary: latest.enhancedNarrative || latest.narrative || '',
        originalAleRange: analysis.baseAleRange,
        adjustedAleRange: analysis.adjustedAleRange,
        projectedAleRange: analysis.adjustedAleRange,
        aleChangePct: analysis.adjustedChangePct,
        originalParameters: analysis.baseSnapshot,
        adjustedParameters: analysis.adjustedSnapshot,
        challenges: analysis.adjustments.map(item => ({
          ref: item.ref,
          parameter: item.record.parameterLabel,
          concern: item.record.reviewerConcern,
          proposedValue: item.record?.reviewerAdjustment?.suggestedValueLabel || item.record?.reviewerAdjustment?.suggestedValue,
          impactPct: item.impactPct,
          aleImpact: item.record?.reviewerAdjustment?.aleImpact || ''
        }))
      };
      if (guardResultsAiActionCooldown({
        button,
        actionKey: 'consensus-recommendation',
        endpoint: '/api/ai/consensus-recommendation',
        payload: requestPayload,
        assessment: latest,
        fallbackId: id,
        cooldownLabel: 'Loaded just now',
        message: 'This consensus recommendation already reflects the current challenge set. Review it or change the inputs before rerunning.'
      })) return;
      const resetBusy = setResultsAiActionBusy(button, 'Finding…');
      try {
        const result = await LLMService.generateConsensusRecommendation(requestPayload);
        markResultsAiActionCooldown('consensus-recommendation', '/api/ai/consensus-recommendation', requestPayload, latest, id);
        const refToRecordId = new Map(analysis.adjustments.map(item => [item.ref, item.record.id]));
        let acceptRecordIds = (Array.isArray(result?.acceptChallenges) ? result.acceptChallenges : [])
          .map(ref => refToRecordId.get(String(ref || '').trim()))
          .filter(Boolean);
        if (!acceptRecordIds.length) {
          acceptRecordIds = analysis.adjustments
            .filter(item => Math.abs(Number(item.impactPct || 0)) <= 15)
            .map(item => item.record.id);
        }
        if (!acceptRecordIds.length && analysis.adjustments.length) {
          acceptRecordIds = [analysis.adjustments
            .slice()
            .sort((left, right) => Math.abs(Number(left.impactPct || 0)) - Math.abs(Number(right.impactPct || 0)))[0].record.id];
        }
        const defendRecordIds = openRecords.map(item => item.id).filter(id => !acceptRecordIds.includes(id));
        const projectedPreview = runChallengeConsensusPreview({
          technicalInputs,
          r,
          runMetadata,
          records: openRecords.filter(record => acceptRecordIds.includes(record.id))
        });
        updateAssessmentRecord(latest.id, current => ({
          ...current,
          consensusPath: {
            createdAt: Date.now(),
            summaryBullets: Array.isArray(result?.summaryBullets) ? result.summaryBullets.slice(0, 3) : [],
            acceptRecordIds,
            defendRecordIds,
            meetInTheMiddleAleRange: String(result?.meetInTheMiddleAleRange || '').trim(),
            projectedAleRange: String(projectedPreview?.projectedAleRange || analysis.baseAleRange || '').trim(),
            baseAleRange: String(analysis.baseAleRange || '').trim(),
            adjustedAleRange: String(analysis.adjustedAleRange || '').trim(),
            mode: String(result?.mode || '').trim().toLowerCase(),
            usedFallback: result?.usedFallback === true,
            aiUnavailable: result?.aiUnavailable === true,
            fallbackReasonMessage: String(result?.fallbackReasonMessage || '').trim(),
            manualReasonMessage: String(result?.manualReasonMessage || '').trim()
          }
        }));
        const toastMeta = buildReviewerWorkflowSuccessToast(result, {
          live: 'Consensus recommendation loaded.',
          deterministicFallback: 'Deterministic fallback consensus recommendation loaded. Review it before applying the path.',
          manual: 'Manual consensus guidance loaded. Review it before applying any path.'
        });
        UI.toast(toastMeta.copy, toastMeta.tone, 5000);
        renderResults(latest.id, isShared || latest._shared);
      } catch (error) {
        console.error('generateConsensusRecommendation failed:', error);
        UI.toast('Consensus analysis is unavailable right now. Try again.', 'danger');
      } finally {
        resetBusy();
      }
    });
  });
  document.querySelectorAll('[data-consensus-record-toggle]').forEach(input => {
    input.addEventListener('change', () => {
      syncConsensusProjectionDisplay({
        assessment,
        technicalInputs,
        r,
        runMetadata
      });
    });
  });
  if (document.querySelector('[data-consensus-record-toggle]')) {
    syncConsensusProjectionDisplay({
      assessment,
      technicalInputs,
      r,
      runMetadata
    });
  }
  document.querySelectorAll('[data-consensus-apply]').forEach(button => {
    button.addEventListener('click', () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const openRecords = getOpenParameterChallengeRecords(latest);
      const selectedIds = Array.from(document.querySelectorAll('[data-consensus-record-toggle]:checked'))
        .map(input => String(input?.dataset?.consensusRecordToggle || '').trim())
        .filter(Boolean);
      if (!selectedIds.length) {
        UI.toast('Select at least one reviewer adjustment to apply as the consensus path.', 'warning');
        return;
      }
      const selectedRecords = openRecords.filter(record => selectedIds.includes(record.id));
      const defendRecordIds = openRecords.map(item => item.id).filter(id => !selectedIds.includes(id));
      const preview = runChallengeConsensusPreview({
        technicalInputs,
        r,
        runMetadata,
        records: selectedRecords
      });
      const now = Date.now();
      updateAssessmentRecord(latest.id, current => ({
        ...current,
        parameterChallenges: normaliseParameterChallengeRecords(current).map(item => (
          selectedIds.includes(item.id) ? { ...item, appliedAt: now } : item
        )),
        consensusPath: {
          ...(normaliseConsensusPath(current) || current.consensusPath || {}),
          createdAt: Number(current?.consensusPath?.createdAt || now),
          acceptRecordIds: selectedIds,
          defendRecordIds,
          projectedAleRange: String(preview?.projectedAleRange || '').trim(),
          baseAleRange: String(preview?.baseAleRange || normaliseConsensusPath(current)?.baseAleRange || '').trim(),
          appliedAt: now
        }
      }));
      AppState.pendingConsensusAutoRun = {
        assessmentId: latest.id
      };
      openAssessmentForRevision(latest, {
        targetStep: '/wizard/5',
        applyDraftChanges: draftRecord => {
          selectedRecords.forEach(record => {
            applyParameterAdjustmentToDraftRecord(draftRecord, record);
          });
          const refreshed = getAssessmentById(latest.id) || latest;
          draftRecord.parameterChallenges = normaliseParameterChallengeRecords(refreshed);
          draftRecord.consensusPath = {
            ...(normaliseConsensusPath(refreshed) || refreshed.consensusPath || {}),
            acceptRecordIds: selectedIds,
            defendRecordIds,
            projectedAleRange: String(preview?.projectedAleRange || '').trim(),
            baseAleRange: String(preview?.baseAleRange || '').trim(),
            appliedAt: now
          };
          return draftRecord;
        }
      });
      UI.toast('Consensus path loaded into the model and queued for rerun.', 'success');
    });
  });
  document.querySelectorAll('[data-challenge-synthesis-run]').forEach(button => {
    button.addEventListener('click', async () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const records = normaliseParameterChallengeRecords(latest);
      if (records.length < 2) {
        UI.toast('At least two challenge records are needed before synthesis can run.', 'warning');
        return;
      }
      const requestPayload = {
        scenarioTitle: getResultsScenarioDisplayTitle(latest),
        scenarioSummary: latest.enhancedNarrative || latest.narrative || '',
        baseAleRange: `${fmtCurrency(Number(latest?.results?.annualLoss?.mean || latest?.results?.ale?.mean || 0))} mean ALE · ${fmtCurrency(Number(latest?.results?.annualLoss?.p90 || latest?.results?.ale?.p90 || latest?.results?.eventLoss?.p90 || 0))} bad year`,
        records: records.map(item => ({
          parameter: item.parameterLabel,
          concern: item.reviewerConcern,
          reviewerAdjustment: item.reviewerAdjustment
        }))
      };
      if (guardResultsAiActionCooldown({
        button,
        actionKey: 'challenge-synthesis',
        endpoint: '/api/ai/challenge-synthesis',
        payload: requestPayload,
        assessment: latest,
        fallbackId: id,
        cooldownLabel: 'Loaded just now',
        message: 'This challenge synthesis already reflects the current records. Review it or change the challenge set before rerunning.'
      })) return;
      const resetBusy = setResultsAiActionBusy(button, 'Synthesising…');
      try {
        const result = await LLMService.generateChallengeSynthesis(requestPayload);
        markResultsAiActionCooldown('challenge-synthesis', '/api/ai/challenge-synthesis', requestPayload, latest, id);
        updateAssessmentRecord(latest.id, current => ({
          ...current,
          challengeSynthesis: {
            overallConcern: String(result?.overallConcern || '').trim(),
            revisedAleRange: String(result?.revisedAleRange || '').trim(),
            keyEvidence: String(result?.keyEvidence || '').trim(),
            mode: String(result?.mode || '').trim().toLowerCase(),
            usedFallback: result?.usedFallback === true,
            aiUnavailable: result?.aiUnavailable === true,
            fallbackReasonMessage: String(result?.fallbackReasonMessage || '').trim(),
            manualReasonMessage: String(result?.manualReasonMessage || '').trim(),
            createdAt: Date.now()
          }
        }));
        const toastMeta = buildReviewerWorkflowSuccessToast(result, {
          live: 'Challenge synthesis loaded.',
          deterministicFallback: 'Deterministic fallback challenge synthesis loaded. Review it before using it in committee discussion.',
          manual: 'Manual synthesis guidance loaded. Add more challenge records or continue manually.'
        });
        UI.toast(toastMeta.copy, toastMeta.tone, 5000);
        renderResults(latest.id, isShared || latest._shared);
      } catch (error) {
        console.error('generateChallengeSynthesis failed:', error);
        UI.toast('Challenge synthesis is unavailable right now. Try again.', 'danger');
      } finally {
        resetBusy();
      }
    });
  });
  document.querySelectorAll('[data-challenge-synthesis-request]').forEach(button => {
    button.addEventListener('click', () => {
      const latest = getAssessmentById(assessment.id) || assessment;
      const synthesis = normaliseChallengeSynthesis(latest);
      if (!synthesis) {
        UI.toast('Run the synthesis first so the analyst can respond to a coherent review view.', 'warning');
        return;
      }
      const requester = String(AuthService.getCurrentUser?.()?.username || '').trim().toLowerCase();
      const targetUsername = String(latest?.submittedBy || '').trim().toLowerCase();
      updateAssessmentRecord(latest.id, current => ({
        ...current,
        challengeSynthesisRequest: {
          id: `csr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          createdAt: Date.now(),
          requestedBy: requester,
          targetUsername,
          status: 'pending',
          message: 'A reviewer asked for your response to the synthesised challenge view. Review the consensus concern, revised ALE view, and the evidence request before rerunning.'
        }
      }));
      UI.toast('Analyst response requested.', 'success');
      renderResults(latest.id, isShared || latest._shared);
    });
  });
  const sensitivityDisclosure = document.getElementById('results-sensitivity-analysis');
  sensitivityDisclosure?.addEventListener('toggle', async () => {
    if (!sensitivityDisclosure.open) return;
    const body = document.getElementById('results-sensitivity-analysis-body');
    if (!body || body.dataset.loaded === 'true' || body.dataset.loading === 'true') return;
    body.dataset.loading = 'true';
    body.innerHTML = '<div class="form-help">Running quick sensitivity checks…</div>';
    try {
      const analysis = await runAssumptionSensitivityAnalysis({
        assessment,
        technicalInputs,
        r,
        runMetadata: assessment?.results?.runMetadata || null
      });
      body.innerHTML = renderAssumptionSensitivityAnalysisResult(analysis || {});
      body.dataset.loaded = 'true';
    } catch (error) {
      console.error('runAssumptionSensitivityAnalysis failed:', error);
      body.innerHTML = '<div class="form-help">Sensitivity analysis could not be generated right now. Try again in a moment.</div>';
      delete body.dataset.loaded;
    } finally {
      delete body.dataset.loading;
    }
  });
  document.querySelectorAll('[data-version-history-narrate]').forEach(button => {
    button.addEventListener('click', async () => {
      const savedAt = Number(button.dataset.versionHistoryNarrate || 0);
      const latest = getAssessmentById(assessment.id) || assessment;
      const version = findAssessmentVersionRecord(latest, savedAt);
      if (!version) {
        UI.toast('That saved version could not be found anymore.', 'warning');
        return;
      }
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Explaining…';
      try {
        const input = typeof buildAssessmentVersionNarrationInput === 'function'
          ? buildAssessmentVersionNarrationInput(version, latest)
          : null;
        const narrative = await LLMService.generateAssessmentVersionNarrative(input || {}) || buildAssessmentVersionNarrationFallback(version, latest);
        updateAssessmentRecord(latest.id, current => ({
          ...current,
          versionHistory: getAssessmentVersionHistory(current).map(item => (
            Number(item.savedAt || 0) === savedAt
              ? { ...item, aiNarrative: narrative, narratedAt: Date.now() }
              : item
          ))
        }));
        renderResults(latest.id, isShared || latest._shared);
      } catch (error) {
        console.error('generateAssessmentVersionNarrative failed:', error);
        UI.toast('Version narration is unavailable right now. Try again.', 'danger');
        button.disabled = false;
        button.textContent = original;
      }
    });
  });
  document.querySelectorAll('[data-version-history-restore]').forEach(button => {
    button.addEventListener('click', () => {
      const savedAt = Number(button.dataset.versionHistoryRestore || 0);
      const latest = getAssessmentById(assessment.id) || assessment;
      const version = findAssessmentVersionRecord(latest, savedAt);
      if (!version) {
        UI.toast('That saved version could not be found anymore.', 'warning');
        return;
      }
      openAssessmentForRevision(latest, {
        targetStep: '/wizard/5',
        applyDraftChanges: draftRecord => ({
          ...draftRecord,
          fairParams: cloneSerializableState(version.parameters, {}) || {},
          enhancedNarrative: String(version.scenarioSummary || draftRecord.enhancedNarrative || draftRecord.narrative || '').trim(),
          narrative: String(version.scenarioSummary || draftRecord.narrative || draftRecord.enhancedNarrative || '').trim()
        })
      });
      UI.toast('Earlier parameters loaded into the wizard. Re-run to compare this version again.', 'success');
    });
  });
  document.getElementById('btn-generate-reviewer-brief')?.addEventListener('click', async function() {
    const button = this;
    const body = document.getElementById('reviewer-brief-body');
    const scenarioType = getReviewerBriefScenarioType(assessment);
    const preferredSection = getReviewerPreferredSection(scenarioType);
    const assessmentData = ReportPresentation.buildReviewerBriefSource({
      assessment,
      results: r,
      executiveHeadline,
      statusTitle,
      statusDetail,
      executiveDecision,
      executiveAction,
      confidenceFrame,
      assessmentIntelligence
    });
    const requestPayload = {
      assessmentData,
      preferredSection
    };
    if (guardResultsAiActionCooldown({
      button,
      actionKey: 'reviewer-brief',
      endpoint: '/api/ai/reviewer-brief',
      payload: requestPayload,
      assessment,
      fallbackId: id,
      cooldownLabel: 'Loaded just now',
      message: 'This reviewer brief already reflects the current assessment view. Review it or change the assessment before rerunning.'
    })) return;
    const resetBusy = setResultsAiActionBusy(button, 'Generating…');
    try {
      const result = await LLMService.generateReviewerDecisionBrief(requestPayload);
      if (!result) throw new Error('No reviewer brief generated');
      markResultsAiActionCooldown('reviewer-brief', '/api/ai/reviewer-brief', requestPayload, assessment, id);
      const nextBrief = {
        ...result,
        createdAt: Date.now(),
        scenarioType
      };
      if (assessment.id) {
        updateAssessmentRecord(assessment.id, current => ({
          ...current,
          reviewerBrief: nextBrief
        }));
        const toastMeta = buildReviewerWorkflowSuccessToast(result, {
          live: 'Reviewer brief generated.',
          deterministicFallback: 'Deterministic fallback reviewer brief loaded. Review it before using it in committee discussion.',
          manual: 'Manual reviewer brief guidance loaded.'
        });
        UI.toast(toastMeta.copy, toastMeta.tone, 5000);
        renderResults(assessment.id, isShared || assessment._shared);
        return;
      }
      if (body) {
        body.innerHTML = `
          <div class="form-help" style="margin-bottom:var(--sp-3)">Generated for quick review. Open Technical Detail only if you want to challenge a specific assumption.</div>
          ${renderReviewerBriefResultRows(nextBrief, assessment)}
        `;
        bindReviewerBriefFocusTracking(assessment);
        document.querySelectorAll('[data-reviewer-brief-challenge]').forEach(challengeButton => {
          challengeButton.addEventListener('click', () => {
            AppState.resultsReviewerBriefTarget = String(challengeButton.dataset.reviewerBriefChallenge || '').trim();
            activateResultsTab('technical', { focusTarget: 'panel' });
          });
        });
      }
      const toastMeta = buildReviewerWorkflowSuccessToast(result, {
        live: 'Reviewer brief generated.',
        deterministicFallback: 'Deterministic fallback reviewer brief loaded. Review it before using it in committee discussion.',
        manual: 'Manual reviewer brief guidance loaded.'
      });
      UI.toast(toastMeta.copy, toastMeta.tone, 5000);
    } catch (error) {
      console.error('generateReviewerDecisionBrief failed:', error);
      UI.toast('Reviewer brief unavailable right now. Try again in a moment.', 'danger');
    } finally {
      resetBusy();
    }
  });

  document.getElementById('btn-run-mediation')?.addEventListener('click', async function() {
    const btn = this;
    const analystViewEl = document.getElementById('meeting-room-analyst-view');
    const focusEl = document.getElementById('meeting-room-focus');
    const statusEl = document.getElementById('meeting-room-status');
    const resultHost = document.getElementById('meeting-room-result-host');
    const analystView = String(analystViewEl?.value || '').trim();
    if (!analystView) {
      UI.toast('Add the analyst view before running mediation.', 'warning');
      analystViewEl?.focus();
      return;
    }
    const requestPayload = {
      narrative: assessment.enhancedNarrative || assessment.narrative || '',
      fairParams: assessment.results?.inputs || assessment.draft?.fairParams || {},
      results: assessment.results,
      assessmentIntelligence,
      reviewerView: assessment.reviewSubmission?.reviewNote || '',
      analystView,
      disputedFocus: focusEl?.value || 'Overall assessment',
      scenarioLens: assessment.scenarioLens || assessment.draft?.scenarioLens,
      citations: assessment.citations || []
    };
    if (guardResultsAiActionCooldown({
      button: btn,
      actionKey: 'review-mediation',
      endpoint: '/api/ai/review-mediation',
      payload: requestPayload,
      assessment,
      fallbackId: id,
      cooldownLabel: 'Loaded just now',
      message: 'This mediation already reflects the current analyst and reviewer positions. Change a position before rerunning.'
    })) return;
    const resetBusy = setResultsAiActionBusy(btn, 'Mediating…');
    if (statusEl) statusEl.textContent = 'Reviewing both positions against the current model and evidence…';
    try {
      const result = await LLMService.mediateAssessmentDispute(requestPayload);
      if (!result) throw new Error('No mediation result');
      markResultsAiActionCooldown('review-mediation', '/api/ai/review-mediation', requestPayload, assessment, id);
      updateAssessmentRecord(assessment.id, current => ({
        ...current,
        reviewMediation: {
          analystView,
          reviewerView: current.reviewSubmission?.reviewNote || assessment.reviewSubmission?.reviewNote || '',
          disputedFocus: focusEl?.value || 'Overall assessment',
          result,
          createdAt: Date.now()
        }
      }));
      if (resultHost) resultHost.innerHTML = renderReviewMediationResult(result);
      const modeMeta = getReviewerWorkflowModePresentation(result, {
        liveLabel: 'Live AI mediation',
        fallbackLabel: 'Deterministic fallback mediation',
        manualLabel: 'Manual mediation guidance'
      });
      if (statusEl) {
        statusEl.textContent = modeMeta.mode === 'manual'
          ? 'Manual mediation guidance loaded. Continue the discussion using the prompts below.'
          : modeMeta.mode === 'deterministic_fallback'
            ? 'Deterministic fallback mediation loaded. Review the proposed middle ground below.'
            : 'Mediation complete. Review the proposed middle ground below.';
      }
      const toastMeta = buildReviewerWorkflowSuccessToast(result, {
        live: 'Review mediation loaded.',
        deterministicFallback: 'Deterministic fallback mediation loaded. Review it before applying any compromise.',
        manual: 'Manual mediation guidance loaded. Continue the discussion without treating it as live AI output.'
      });
      UI.toast(toastMeta.copy, toastMeta.tone, 5000);
      renderResults(id, isShared || assessment._shared);
    } catch (error) {
      console.error('AI mediation failed:', error);
      if (resultHost) resultHost.innerHTML = '<div class="form-help">AI mediation is unavailable right now. Keep the discussion manual or try again in a moment.</div>';
      if (statusEl) statusEl.textContent = 'AI mediation is unavailable right now.';
    } finally {
      resetBusy();
    }
  });

  document.getElementById('btn-accept-mediation')?.addEventListener('click', () => {
    const latest = getAssessmentById(assessment.id) || assessment;
    const mediation = latest?.reviewMediation?.result || assessment?.reviewMediation?.result || null;
    openAssessmentForRevision(latest, {
      targetStep: '/wizard/4',
      applyDraftChanges: draftRecord => {
        if (mediation?.recommendedField && Number.isFinite(Number(mediation.recommendedValue))) {
          const fairParams = draftRecord.fairParams || (draftRecord.fairParams = {});
          fairParams[mediation.recommendedField] = Number(mediation.recommendedValue);
        }
        draftRecord.reviewMediation = latest.reviewMediation || assessment.reviewMediation || null;
        draftRecord.reviewSubmission = latest.reviewSubmission || assessment.reviewSubmission || null;
        return draftRecord;
      }
    });
    UI.toast('AI compromise loaded into the draft. Review it and rerun before you resubmit.', 'success');
  });

  document.getElementById('btn-revise-mediation')?.addEventListener('click', () => {
    const latest = getAssessmentById(assessment.id) || assessment;
    openAssessmentForRevision(latest, {
      targetStep: '/wizard/4',
      applyDraftChanges: draftRecord => {
        draftRecord.reviewMediation = latest.reviewMediation || assessment.reviewMediation || null;
        draftRecord.reviewSubmission = latest.reviewSubmission || assessment.reviewSubmission || null;
        return draftRecord;
      }
    });
    UI.toast('The assessment was reopened for revision with the mediation context attached.', 'success');
  });

  document.getElementById('btn-continue-mediation')?.addEventListener('click', () => {
    const statusEl = document.getElementById('meeting-room-status');
    const analystViewEl = document.getElementById('meeting-room-analyst-view');
    const latest = getAssessmentById(assessment.id) || assessment;
    const prompt = latest?.reviewMediation?.result?.continueDiscussionPrompt
      || assessment?.reviewMediation?.result?.continueDiscussionPrompt
      || 'Update the analyst view with the specific evidence or assumption you still disagree on, then rerun mediation.';
    if (statusEl) statusEl.textContent = prompt;
    analystViewEl?.focus();
  });

  document.getElementById('btn-run-challenge')?.addEventListener('click', async function() {
    const btn = this;
    const body = document.getElementById('challenge-mode-body');
    const requestPayload = {
      narrative: assessment.enhancedNarrative || assessment.narrative || '',
      fairParams: assessment.results?.inputs || assessment.draft?.fairParams || {},
      results: assessment.results,
      assessmentIntelligence: assessment.assessmentIntelligence || assessmentIntelligence,
      obligationBasis: assessment.obligationBasis || null
    };
    if (guardResultsAiActionCooldown({
      button: btn,
      actionKey: 'challenge-assessment-panel',
      endpoint: '/api/ai/challenge-assessment',
      payload: requestPayload,
      assessment,
      fallbackId: id,
      cooldownLabel: 'Loaded just now',
      message: 'This challenge view already reflects the current assessment inputs. Review it or change the inputs before rerunning.'
    })) return;
    const resetBusy = setResultsAiActionBusy(btn, 'Challenging…');
    try {
      const result = await LLMService.challengeAssessment(requestPayload);
      if (!result) throw new Error('No result');
      markResultsAiActionCooldown('challenge-assessment-panel', '/api/ai/challenge-assessment', requestPayload, assessment, id);
      if (body) body.innerHTML = renderAssessmentChallengeResult(result);
    } catch {
      if (body) body.innerHTML = '<div class="form-help">Challenge unavailable right now. Try again in a moment.</div>';
    } finally {
      resetBusy();
    }
  });

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
    withResultsActionBusy(event.currentTarget, 'Building PDF…', 800, async () => {
      try {
        const ready = await ensureResultsPdfLibrary();
        if (!ready) throw new Error('jsPDF is not available in this session.');
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
    persistBoardroomModePreference(id);
    AppState.resultsTab = 'executive';
    persistResultsTabPreference('executive');
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
    const aiContext = buildCurrentAIAssistContext({ buId: assessment.buId });
    const requestPayload = {
      scenarioTitle: getResultsScenarioDisplayTitle(assessment),
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
    };
    if (guardResultsAiActionCooldown({
      button: challengeButton,
      actionKey: 'challenge-assessment-review',
      endpoint: '/api/ai/challenge-assessment',
      payload: requestPayload,
      assessment,
      fallbackId: id,
      cooldownLabel: 'Loaded just now',
      message: 'This challenge review already reflects the current assessment. Review it or change the assessment before rerunning.'
    })) return;
    const resetBusy = setResultsAiActionBusy(challengeButton, 'Reviewing…');
    if (status) status.textContent = 'Reviewing the assessment challenge points...';
    try {
      const result = await LLMService.challengeAssessment(requestPayload);
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
      markResultsAiActionCooldown('challenge-assessment-review', '/api/ai/challenge-assessment', requestPayload, assessment, id);
      const toastMeta = buildReviewerWorkflowSuccessToast(result, {
        live: 'Live AI challenge review loaded.',
        deterministicFallback: 'Deterministic fallback challenge review loaded. Review the suggested questions and evidence gaps.',
        manual: 'Manual challenge guidance loaded. Review the suggested next questions and continue manually.'
      });
      UI.toast(toastMeta.copy, toastMeta.tone, 5000);
      renderResults(assessment.id, isShared || assessment._shared);
    } catch (error) {
      if (status) status.textContent = 'Challenge review could not be generated.';
      UI.toast('The challenge review is unavailable right now. Try again in a moment.', 'danger');
    } finally {
      resetBusy();
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
      Router.navigate('/wizard/4');
    }, 200);
  });
  document.getElementById('btn-duplicate-assessment')?.addEventListener('click', () => {
    const duplicated = duplicateAssessmentToDraft(assessment.id);
    if (!duplicated) {
      UI.toast('That assessment could not be duplicated right now.', 'warning');
      return;
    }
    UI.toast('Assessment duplicated into a new draft.', 'success');
    Router.navigate('/wizard/2');
  });
  document.getElementById('btn-new-assess')?.addEventListener('click', () => {
    if (typeof window.launchGuidedAssessmentStart === 'function') {
      window.launchGuidedAssessmentStart();
      return;
    }
    resetDraft();
    Router.navigate('/wizard/1');
  });
  document.getElementById('btn-new-assess-top')?.addEventListener('click', () => {
    if (typeof window.launchGuidedAssessmentStart === 'function') {
      window.launchGuidedAssessmentStart();
      return;
    }
    resetDraft();
    Router.navigate('/wizard/1');
  });
}

function renderResults(id, isShared) {
  AppState.currentResultsId = String(id || '').trim();
  restoreBoardroomModePreference(id);
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
  const requestedTab = getPersistedResultsTabPreference() || String(AppState.resultsTab || 'executive');
  AppState.resultsTab = VALID_RESULTS_TABS.includes(requestedTab) ? requestedTab : 'executive';

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
    assessmentFreshnessWarning,
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
    projectResultsModel,
    decisionBrief,
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
    decisionCockpitModel,
    rolePresentation
  } = window.ResultsViewModel.buildResultsRenderModel(assessment, { isShared });
  const displayScenarioTitle = typeof resolveScenarioDisplayTitle === 'function'
    ? resolveScenarioDisplayTitle({
        ...assessment,
        narrative: assessment?.narrative || scenarioNarrative || '',
        enhancedNarrative: assessment?.enhancedNarrative || scenarioNarrative || ''
      })
    : String(assessment.scenarioTitle || 'Risk Assessment').trim();

  const resultsSelectedRisks = Array.isArray(assessment.selectedRisks) && assessment.selectedRisks.length
    ? assessment.selectedRisks
    : (Array.isArray(assessment.riskCandidates) ? assessment.riskCandidates.filter(risk => {
        const selectedIds = new Set((Array.isArray(assessment.selectedRiskIds) ? assessment.selectedRiskIds : []).map(item => String(item || '')));
        return selectedIds.has(String(risk?.id || ''));
      }) : []);
  const resultsGeographies = Array.isArray(assessment.geographies) && assessment.geographies.length
    ? assessment.geographies
    : (assessment.geography ? [assessment.geography] : []);
  const resultsCriticalCondition = r?.criticalCondition || null;
  let resultsDecisionReadiness = assessment.decisionReadiness && typeof assessment.decisionReadiness === 'object'
    ? assessment.decisionReadiness
    : (typeof buildDecisionReadinessModel === 'function'
        ? buildDecisionReadinessModel({
            draft: assessment,
            selectedRisks: resultsSelectedRisks,
            scenarioGeographies: resultsGeographies,
            validation: { errors: [], warnings: [] },
            safeIterations: r.iterations,
            results: r
          })
        : null);
  if (resultsCriticalCondition && resultsDecisionReadiness && typeof resultsDecisionReadiness === 'object') {
    const mergeUnique = (...lists) => Array.from(new Set(
      lists.flat().map(item => String(item || '').trim()).filter(Boolean)
    ));
    resultsDecisionReadiness = {
      ...resultsDecisionReadiness,
      status: 'Needs gating',
      tone: 'danger',
      score: Math.min(Number(resultsDecisionReadiness.score || 0), 64),
      summary: resultsCriticalCondition.blockingGap || resultsCriticalCondition.statusDetail || resultsDecisionReadiness.summary,
      blockingGaps: mergeUnique([resultsCriticalCondition.blockingGap], resultsDecisionReadiness.blockingGaps || []).slice(0, 4),
      requiredControls: mergeUnique(resultsCriticalCondition.requiredControls || [], resultsDecisionReadiness.requiredControls || []).slice(0, 4),
      humanApprovers: mergeUnique([resultsCriticalCondition.owner], resultsDecisionReadiness.humanApprovers || []).slice(0, 3),
      criticalCondition: resultsCriticalCondition
    };
  }
  let resultsChallengePass = assessment.assessmentChallengePass && typeof assessment.assessmentChallengePass === 'object'
    ? assessment.assessmentChallengePass
    : (typeof buildAssessmentChallengePass === 'function'
        ? buildAssessmentChallengePass({
            draft: assessment,
            selectedRisks: resultsSelectedRisks,
            validation: { errors: [], warnings: [] },
            readiness: resultsDecisionReadiness
          })
        : null);
  if (resultsCriticalCondition && resultsChallengePass && typeof resultsChallengePass === 'object') {
    const existingFindings = Array.isArray(resultsChallengePass.findings) ? resultsChallengePass.findings : [];
    resultsChallengePass = {
      ...resultsChallengePass,
      status: 'Challenge required',
      tone: 'danger',
      summary: 'A critical response gate is open before this result can be treated as decision-ready.',
      findings: [
        {
          title: resultsCriticalCondition.title || 'Critical response gate',
          detail: resultsCriticalCondition.blockingGap || resultsCriticalCondition.statusDetail,
          severity: 'blocker'
        },
        ...existingFindings
      ].slice(0, 4),
      changed: 'Run held at review posture until the critical gate is closed.',
      criticalCondition: resultsCriticalCondition
    };
  }
  let resultsManagerTrace = assessment.assessmentManagerTrace && typeof assessment.assessmentManagerTrace === 'object'
    ? assessment.assessmentManagerTrace
    : (typeof buildAssessmentManagerRunModel === 'function'
        ? buildAssessmentManagerRunModel({
            stage: 'results',
            draft: assessment,
            selectedRisks: resultsSelectedRisks,
            validation: { errors: [], warnings: [] },
            readiness: resultsDecisionReadiness,
            challenge: resultsChallengePass,
            safeIterations: r.iterations,
            results: r
          })
        : null);
  if (resultsCriticalCondition && typeof buildAssessmentManagerRunModel === 'function') {
    resultsManagerTrace = buildAssessmentManagerRunModel({
      stage: 'results',
      draft: assessment,
      selectedRisks: resultsSelectedRisks,
      validation: { errors: [], warnings: [] },
      readiness: resultsDecisionReadiness,
      challenge: resultsChallengePass,
      safeIterations: r.iterations,
      results: r
    });
  }
  const resultsManagerBlock = [
    resultsManagerTrace && typeof renderAssessmentManagerPanel === 'function'
      ? renderAssessmentManagerPanel(resultsManagerTrace, { title: 'Assessment Manager replay' })
      : '',
    resultsDecisionReadiness && typeof renderDecisionReadinessCard === 'function'
      ? renderDecisionReadinessCard(resultsDecisionReadiness)
      : ''
  ].filter(Boolean).join('');
  const resultsWorkflowStatus = typeof buildAssessmentWorkflowStatusModel === 'function'
    ? buildAssessmentWorkflowStatusModel({
        stage: 'results',
        assessment,
        selectedRisks: resultsSelectedRisks,
        scenarioGeographies: resultsGeographies,
        validation: { errors: [], warnings: [] },
        readiness: resultsDecisionReadiness,
        challenge: resultsChallengePass,
        results: r,
        isShared
      })
    : null;
  const resultsDecisionStack = typeof buildAssessmentDecisionStackModel === 'function'
    ? buildAssessmentDecisionStackModel({
        assessment,
        selectedRisks: resultsSelectedRisks,
        readiness: resultsDecisionReadiness,
        challenge: resultsChallengePass,
        results: r,
        executiveDecision,
        executiveAction,
        statusTitle,
        isShared
      })
    : null;
  const resultsChallengeStory = typeof buildAssessmentChallengeStory === 'function'
    ? buildAssessmentChallengeStory(resultsChallengePass, resultsDecisionReadiness)
    : null;
  const reviewSubmitBanner = renderResultsReviewSubmitBanner(assessment, r);
  const reviewMeetingRoom = renderReviewMeetingRoom(assessment);
  const decisionDna = renderDecisionDNASection(assessment);
  const executiveCommandDeck = renderExecutiveCommandDeck({
    statusTitle,
    statusDetail,
    executiveDecision,
    executiveAction,
    confidenceFrame,
    recommendations,
    missingInformation,
    nextStepPlan,
    reviewStatus: String(assessment?.reviewSubmission?.reviewStatus || '').trim().toLowerCase(),
    rolePresentation
  });
  const executiveSupportDisclosure = renderExecutiveSupportDisclosure({
    title: boardroomMode ? 'Boardroom support detail' : 'Supporting detail',
    copy: boardroomMode
      ? 'Open this only when you need the committee-ready backup: confidence caveats, comparison logic, analyst readout, or challenge tools.'
      : 'Open this only when you need the analyst, evidence, benchmark, value, or AI challenge layer behind the headline decision view.',
    badge: 'Open if challenged',
    body: boardroomMode
      ? `
          ${decisionDna}
          ${renderBoardroomSummaryBand({ executiveDecision, confidenceFrame, nextStepPlan, scenarioNarrative, analystSummary })}
          ${treatmentRecommendationLens}
          ${comparisonHighlight || recommendationCards}
          ${renderAnalystSummaryBlock(analystSummary)}
          <section class="results-secondary-band results-secondary-band--boardroom">
            ${comparisonHighlight ? recommendationCards : ''}
            ${confidenceNeedsBlock}
            ${renderAssessmentChallengeDisclosure()}
            ${renderAssessmentValueBand(assessmentValue)}
            ${renderExecutiveBenchmarkContext(assessment, r, runMetadata)}
          </section>`
      : `
          ${decisionDna}
          ${renderAssessmentChallengeDisclosure()}
          ${renderAnalystSummaryBlock(analystSummary)}
          ${treatmentRecommendationLens}
          ${comparisonHighlight || recommendationCards}
          ${comparisonHighlight ? recommendationCards : ''}
          ${renderAssessmentValueBand(assessmentValue)}
          ${renderExecutiveBenchmarkContext(assessment, r, runMetadata)}
          <section class="results-secondary-band">
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
          </section>`
  });

  const executiveCockpit = renderResultsExecutiveCockpit({
    assessment,
    r,
    statusClass,
    statusIcon,
    statusTitle,
    statusDetail,
    executiveHeadline,
    executiveAction,
    executiveDecision,
    lifecycle,
    exceedancePct,
    completedLabel,
    assessmentValue,
    decisionReadiness: resultsDecisionReadiness,
    rolePresentation,
    boardroomMode
  });
  const projectHorizonPanel = renderProjectHorizonResultsPanel(r);
  const resultsTopValueStrip = renderResultsAssessmentTypeHeader(projectResultsModel, assessmentValue, r);
  const projectExposureResultsPanel = renderProjectExposureResultsPanel(projectResultsModel);
  const decisionBriefPanel = renderDecisionBriefPanel({
    assessment,
    r,
    projectResultsModel,
    executiveDecision,
    confidenceFrame,
    savedDecisionBrief: decisionBrief
  });
  const decisionChallengeAgentCard = renderDecisionChallengeAgentCard(assessment, r, technicalInputs, runMetadata);
  const decisionCockpit = renderResultsDecisionCockpit(decisionCockpitModel);
  const detailedDecisionSupportDisclosure = renderExecutiveSupportDisclosure({
    title: 'Detailed decision-support outputs',
    copy: 'Open this when you need the full AI brief, project exposure map, project-horizon detail, or saved challenge stress cases behind the cockpit.',
    badge: 'Decision support',
    body: `
      ${executiveCommandDeck}
      ${decisionBriefPanel}
      ${executiveCockpit}
      ${projectHorizonPanel}
      ${projectExposureResultsPanel}
      ${decisionChallengeAgentCard}
    `
  });

  const executiveTab = `
    <section class="results-executive-view ${boardroomMode ? 'results-executive-view--boardroom' : ''} ${activeTab === 'executive' ? '' : 'hidden'}" id="results-tab-executive" role="tabpanel" aria-labelledby="results-tab-btn-executive" tabindex="-1" data-results-panel="executive" data-page-focus>
      ${assessmentFreshnessWarning ? `<div class="banner banner--info mb-6"><span class="banner-icon">ℹ</span><span class="banner-text">${escapeHtml(assessmentFreshnessWarning)}</span></div>` : ''}
      ${renderReviewerBriefPanel(assessment, rolePresentation)}
      ${decisionCockpit}
      <div id="results-assumption-explainer-host" style="display:none"></div>
      ${reviewSubmitBanner}
      ${detailedDecisionSupportDisclosure}
      ${resultsChallengeStory && typeof renderAssessmentChallengeStory === 'function'
        ? renderAssessmentChallengeStory(resultsChallengeStory)
        : ''}
      ${resultsDecisionStack && typeof renderAssessmentDecisionStack === 'function'
        ? renderAssessmentDecisionStack(resultsDecisionStack)
        : ''}
      ${resultsWorkflowStatus && typeof renderAssessmentWorkflowStatusStrip === 'function'
        ? renderAssessmentWorkflowStatusStrip(resultsWorkflowStatus)
        : ''}
      ${reviewMeetingRoom}
      ${resultsManagerBlock ? `<div class="results-manager-grid">${resultsManagerBlock}</div>` : ''}
      <div class="results-executive-band">
        ${renderExecutiveScenarioStatement(assessment, scenarioNarrative)}
        ${renderDecisionRail(statusTitle, statusDetail, executiveDecision, executiveAction, assessmentIntelligence.confidence, rolePresentation, hasAssessmentLocalFallback(assessment))}
      </div>
      ${executiveSupportDisclosure}
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
    projectResultsModel,
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
    projectResultsModel,
    assessmentChallenge,
    workflowGuidance,
    citations,
    recommendations
  });

  setPage(`
    <style>
      .review-submit-banner {
        display:flex; align-items:center; justify-content:space-between;
        gap:var(--sp-4); padding:var(--sp-4) var(--sp-5);
        background:#fef3c7; border:1px solid #d97706; border-radius:var(--radius-lg);
        margin:var(--sp-4) 0; flex-wrap:wrap; color:#5b3a02;
      }
      .review-submit-banner__body { display:flex; flex-direction:column; gap:4px; font-size:14px; }
      .review-submit-banner strong,
      .review-submit-banner span { color:inherit; }
      .review-submit-banner--submitted { background:#eff6ff; border-color:#3b82f6; color:#1e3a8a; }
      .review-submit-banner--approved { background:#f0fdf4; border-color:#22c55e; color:#14532d; }
      .review-submit-banner--changes { background:#fef3c7; border-color:#d97706; color:#5b3a02; }
      .review-submit-banner--escalated { background:#f5f3ff; border-color:#7c3aed; color:#4c1d95; }
      .challenge-card { display:flex; flex-direction:column; gap:var(--sp-3); }
      .challenge-summary { font-size:14px; line-height:1.6; margin:0; }
      .challenge-grid { display:grid; grid-template-columns:1fr 1fr; gap:var(--sp-4); }
      .challenge-label { font-size:11px; font-weight:700; text-transform:uppercase;
        letter-spacing:.04em; color:var(--text-secondary); margin-bottom:4px; }
      .challenge-text { font-size:13px; line-height:1.5; }
      .challenge-question { padding:var(--sp-3); background:#fafafa;
        border-radius:6px; border-left:3px solid var(--primary); font-size:13px; }
      .reviewer-brief-grid { display:flex; flex-direction:column; gap:var(--sp-3); }
      .reviewer-brief-row {
        padding:var(--sp-4);
        border:1px solid var(--border-subtle);
        border-radius:var(--radius-lg);
        background:var(--bg-elevated);
      }
      .reviewer-brief-row__head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:var(--sp-3);
        flex-wrap:wrap;
        margin-bottom:var(--sp-3);
      }
      .reviewer-brief-row__text {
        font-size:14px;
        line-height:1.65;
        color:var(--text-secondary);
      }
      @media (max-width: 720px) {
        .challenge-grid { grid-template-columns:1fr; }
      }
    </style>
    <main class="page">
      <div class="container container--wide" style="padding:var(--sp-8) var(--sp-6)">
        ${sharedBanner}
        <div class="flex items-center justify-between mb-6 anim-fade-in results-header-bar" style="gap:var(--sp-4);flex-wrap:wrap">
          <div>
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:4px">Assessment Results</div>
            <h1 style="font-size:var(--text-3xl)">${escapeHtml(displayScenarioTitle || 'Risk Assessment')}</h1>
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
        ${resultsTopValueStrip}

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
    technicalInputs,
    assessmentIntelligence,
    missingInformation,
    rolePresentation,
    executiveHeadline,
    statusTitle,
    statusDetail,
    executiveDecision,
    executiveAction,
    confidenceFrame
  });
  } catch (error) {
    console.error('renderResults failed:', error);
    renderResultsFailureState(id, isShared, error);
  }
}
