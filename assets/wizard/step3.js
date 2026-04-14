function formatPlainCurrency(value, currency = 'USD') {
  const displayValue = Math.round(convertUsdToDisplayCurrency(value, currency));
  return `${getCurrencyPrefix(currency)}${displayValue.toLocaleString(currency === 'AED' ? 'en-AE' : 'en-US')}`;
}

function _normaliseStep3ConversationText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildStep3ConversationFingerprint({
  draft = AppState?.draft || {},
  baselineAssessment = null,
  request = ''
} = {}) {
  return [
    String(draft?.id || '').trim(),
    String(baselineAssessment?.id || draft?.baselineAssessmentId || '').trim(),
    _normaliseStep3ConversationText(draft?.scenarioTitle || draft?.enhancedNarrative || draft?.narrative || ''),
    String(draft?.scenarioLens?.key || '').trim().toLowerCase(),
    _normaliseStep3ConversationText(request || '')
  ].filter(Boolean).join(' | ').slice(0, 320);
}

function getStep3PriorMessages({ conversationFingerprint = '' } = {}) {
  const priorMessages = Array.isArray(AppState?.draft?.step3LlmContext)
    ? AppState.draft.step3LlmContext
    : [];
  const currentFingerprint = String(conversationFingerprint || '').trim();
  const storedFingerprint = String(AppState?.draft?.step3ConversationFingerprint || '').trim();
  if (!currentFingerprint || !storedFingerprint || currentFingerprint !== storedFingerprint) return [];
  return priorMessages;
}

function appendStep3LlmContext(userText, assistantText, { conversationFingerprint = '' } = {}) {
  if (typeof dispatchDraftAction !== 'function') return;
  const user = String(userText || '').trim();
  const assistant = String(assistantText || '').trim();
  if (!user || !assistant) return;
  AppState.draft.step3ConversationFingerprint = String(conversationFingerprint || '').trim();
  dispatchDraftAction('APPEND_LLM_CONTEXT', { contextKey: 'step3LlmContext', user, assistant });
}

const STEP3_AI_ACTION_COOLDOWN_MS = 4000;
const _step3AiActionCooldowns = typeof AiWorkflowClient !== 'undefined' && AiWorkflowClient && typeof AiWorkflowClient.createActionCooldownStore === 'function'
  ? AiWorkflowClient.createActionCooldownStore({ cooldownMs: STEP3_AI_ACTION_COOLDOWN_MS, maxEntries: 12 })
  : null;

function setStep3AiActionBusy(button, busyLabel) {
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

function flashStep3AiActionCooldown(button, label, durationMs = 1200) {
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

function ensureFairRationaleStyles() {
  if (document.getElementById('fair-rationale-styles')) return;
  const style = document.createElement('style');
  style.id = 'fair-rationale-styles';
  style.textContent = `
    .fair-rationale {
      display: flex; gap: 6px; align-items: flex-start;
      font-size: 12px; color: var(--text-secondary);
      margin-top: 4px; padding: 4px 8px;
      background: #f0f9ff; border-radius: 4px;
      border-left: 2px solid #38bdf8;
    }
    .fair-rationale--overridden {
      background: #fafafa; border-left-color: var(--border);
      color: var(--text-tertiary, #9ca3af);
    }
    .fair-rationale__icon { flex-shrink: 0; }
  `;
  document.head.appendChild(style);
}

function getStep3FieldRationaleMap(draft) {
  const explicit = draft?.fairParams?.fieldRationale && typeof draft.fairParams.fieldRationale === 'object'
    ? draft.fairParams.fieldRationale
    : null;
  const nested = draft?.inputRationale?.fieldRationale && typeof draft.inputRationale.fieldRationale === 'object'
    ? draft.inputRationale.fieldRationale
    : null;
  const fallback = {};
  const assignmentReason = (id) => String(
    (Array.isArray(draft?.inputAssignments) ? draft.inputAssignments : []).find((item) => item?.id === id)?.reason || ''
  ).trim();
  const lossSummary = String(draft?.inputRationale?.lossComponents || '').trim();
  const setReason = (keys, text) => {
    const reason = String(text || '').trim();
    if (!reason) return;
    keys.forEach((key) => {
      if (!fallback[key]) fallback[key] = reason;
    });
  };
  if (!explicit && !nested) {
    setReason(['tefMin', 'tefLikely', 'tefMax'], assignmentReason('event-frequency') || draft?.inputRationale?.tef);
    setReason(['threatCapMin', 'threatCapLikely', 'threatCapMax'], assignmentReason('threat-capability') || draft?.inputRationale?.vulnerability);
    setReason(['controlStrMin', 'controlStrLikely', 'controlStrMax'], assignmentReason('control-strength') || draft?.inputRationale?.vulnerability);
    setReason(['irMin', 'irLikely', 'irMax'], assignmentReason('incident-response') || lossSummary);
    setReason(['biMin', 'biLikely', 'biMax'], assignmentReason('business-interruption') || lossSummary);
    setReason(['dbMin', 'dbLikely', 'dbMax'], assignmentReason('data-breach-remediation') || lossSummary);
    setReason(['rlMin', 'rlLikely', 'rlMax'], assignmentReason('regulatory-legal') || lossSummary);
    setReason(['tpMin', 'tpLikely', 'tpMax'], assignmentReason('third-party-liability') || lossSummary);
    setReason(['rcMin', 'rcLikely', 'rcMax'], assignmentReason('reputation-contract') || lossSummary);
  }
  return Object.fromEntries(
    Object.entries(explicit || nested || fallback)
      .map(([key, value]) => [key, String(value || '').trim()])
      .filter(([, value]) => value)
  );
}

function fairFieldNameToInputId(fieldName) {
  const match = String(fieldName || '').match(/^(.*?)(Min|Likely|Max)$/);
  if (!match) return '';
  return `${match[1]}-${match[2].toLowerCase()}`;
}

function getStep3FieldPrefix(fieldName) {
  const match = String(fieldName || '').match(/^(.*?)(Min|Likely|Max)$/);
  return match ? match[1] : '';
}

function collectStep3EvidenceSnippets(draft, keywords = []) {
  const pattern = new RegExp((Array.isArray(keywords) ? keywords : []).filter(Boolean).join('|') || '.', 'i');
  const snippets = [];
  const addSnippet = value => {
    const text = typeof value === 'string'
      ? value
      : (value?.relevanceReason || value?.title || value?.sourceTitle || value?.excerpt || '');
    const trimmed = String(text || '').trim();
    if (!trimmed || snippets.includes(trimmed)) return;
    snippets.push(trimmed);
  };
  (Array.isArray(draft?.primaryGrounding) ? draft.primaryGrounding : []).forEach(item => {
    if (pattern.test(String(item || ''))) addSnippet(item);
  });
  (Array.isArray(draft?.supportingReferences) ? draft.supportingReferences : []).forEach(item => {
    if (pattern.test(String(item?.title || item?.relevanceReason || item?.excerpt || item || ''))) addSnippet(item);
  });
  (Array.isArray(draft?.citations) ? draft.citations : []).forEach(item => {
    if (pattern.test(String(item?.title || item?.relevanceReason || item?.excerpt || ''))) addSnippet(item);
  });
  return snippets.slice(0, 3);
}

function getStep3DependencyHint(prefix, fairParams = {}) {
  if (prefix === 'tef') {
    return {
      label: 'High leverage',
      copy: 'Frequency changes every simulated year, so even small changes here move both the annual view and the tolerance view quickly.'
    };
  }
  if (prefix === 'threatCap' || prefix === 'controlStr' || prefix === 'vuln') {
    return {
      label: 'High leverage',
      copy: 'This changes how often attempts become successful loss events, so it usually has an outsized effect on the final result.'
    };
  }
  const likelyTotal = ['irLikely', 'biLikely', 'dbLikely', 'rlLikely', 'tpLikely', 'rcLikely']
    .reduce((sum, key) => sum + Number(fairParams?.[key] || 0), 0);
  const share = likelyTotal > 0 ? Number(fairParams?.[`${prefix}Likely`] || 0) / likelyTotal : 0;
  if (share >= 0.3) {
    return {
      label: 'High leverage',
      copy: 'This is one of the bigger cost rows in the current estimate, so moving it will materially change the severe-case result.'
    };
  }
  if (share >= 0.15) {
    return {
      label: 'Moderate leverage',
      copy: 'This matters, but it is not currently the dominant cost driver in the estimate.'
    };
  }
  return {
    label: 'Targeted leverage',
    copy: 'This only moves the result materially if this loss component becomes larger or more certain than the current working case.'
  };
}

function buildStep3AssumptionExplainerModel(fieldName, draft) {
  const prefix = getStep3FieldPrefix(fieldName);
  if (!prefix) return null;
  const fairParams = draft?.fairParams || {};
  const fieldRationale = getStep3FieldRationaleMap(draft);
  const inputAssignments = Array.isArray(draft?.inputAssignments) ? draft.inputAssignments : [];
  const findAssignment = id => inputAssignments.find(item => item?.id === id) || null;
  const reasonFor = id => String(findAssignment(id)?.reason || '').trim();
  const lossSummary = String(draft?.inputRationale?.lossComponents || '').trim();
  const baseMeaning = {
    tef: 'This is the annual event frequency range: how often the scenario could realistically happen in a quieter year, a typical year, and a severe but still plausible year.',
    threatCap: 'This is the attacker or threat-source capability range. It describes how capable the event source is, not how strong your controls are.',
    controlStr: 'This is the current control-strength range. It estimates how often your current preventive and detective controls would stop or contain the event.',
    vuln: 'This is the direct event-success range. It estimates how likely the event is to succeed if attempted.',
    ir: 'This is the response and recovery cost range for one event, before annual frequency is applied.',
    bi: 'This is the business-disruption cost range for one event, before annual frequency is applied.',
    db: 'This is the data-remediation cost range for one event, including notification, cleanup, and customer-support obligations where relevant.',
    rl: 'This is the regulatory and legal cost range for one event, including fines, counsel, and formal response costs where relevant.',
    tp: 'This is the third-party impact cost range for one event, such as claims, service credits, or partner compensation.',
    rc: 'This is the reputation and contract cost range for one event, such as churn, commercial loss, or contract penalties.'
  };
  const supportKeywords = {
    tef: ['frequency', 'incident', 'history', 'event'],
    threatCap: ['threat', 'capability', 'identity', 'attack', 'exposure'],
    controlStr: ['control', 'detection', 'response', 'mfa', 'resilience'],
    vuln: ['exposure', 'vulnerability', 'control', 'threat'],
    ir: ['incident', 'response', 'recovery', 'containment'],
    bi: ['business', 'disruption', 'outage', 'recovery', 'downtime'],
    db: ['data', 'remediation', 'privacy', 'notification'],
    rl: ['regulat', 'legal', 'compliance', 'contract'],
    tp: ['third-party', 'supplier', 'partner', 'liability'],
    rc: ['reputation', 'contract', 'customer', 'commercial']
  };
  const evidenceSupport = collectStep3EvidenceSnippets(draft, supportKeywords[prefix] || []).slice(0, 2);
  const support = [
    String(fieldRationale[fieldName] || '').trim(),
    prefix === 'tef' ? reasonFor('event-frequency') : '',
    prefix === 'threatCap' ? reasonFor('threat-capability') : '',
    prefix === 'controlStr' ? reasonFor('control-strength') : '',
    prefix === 'ir' ? reasonFor('incident-response') : '',
    prefix === 'bi' ? reasonFor('business-interruption') : '',
    prefix === 'rl' ? reasonFor('regulatory-legal') : '',
    prefix === 'tp' ? reasonFor('third-party-liability') : '',
    prefix === 'rc' ? reasonFor('reputation-contract') : '',
    prefix === 'db' ? lossSummary : '',
    ...evidenceSupport
  ].filter(Boolean).slice(0, 3);
  const movementHints = {
    tef: {
      up: 'Raise this if incident history, threat activity, or business conditions show the event path is more common than the current planning case.',
      down: 'Lower this only if direct operating evidence shows the triggering conditions are rarer or better contained than the current case.'
    },
    threatCap: {
      up: 'Raise this if the threat source is more capable, persistent, or better resourced than the current working case assumes.',
      down: 'Lower this only if the event source is weaker, more opportunistic, or less capable than the current planning case assumes.'
    },
    controlStr: {
      up: 'Raise this if your controls are better evidenced, broader in coverage, or more consistently effective than the current assumption.',
      down: 'Lower this if controls exist only on paper, coverage is partial, or detection and containment are slower than assumed.'
    },
    vuln: {
      up: 'Raise this if the event would still succeed even with the current controls in place.',
      down: 'Lower this if controls and resilience measures make successful compromise materially less likely.'
    },
    ir: {
      up: 'Raise this if containment, investigation, or recovery would need more external support or last longer than the current case assumes.',
      down: 'Lower this if the team can contain and recover faster with less specialist effort than assumed.'
    },
    bi: {
      up: 'Raise this if the event would disrupt operations for longer or hit more critical services than the current case assumes.',
      down: 'Lower this if resilience and recovery measures keep disruption shorter or narrower than the current case.'
    },
    db: {
      up: 'Raise this if data exposure would trigger broader remediation, notification, or customer-support work than currently assumed.',
      down: 'Lower this if the data in scope is narrower or the clean-up obligations are lighter than assumed.'
    },
    rl: {
      up: 'Raise this if obligations, penalties, or legal challenge would be broader than the current working case.',
      down: 'Lower this if the legal or regulatory consequences are narrower, capped, or less likely than assumed.'
    },
    tp: {
      up: 'Raise this if partners, customers, or suppliers are more likely to seek compensation or impose credits than currently assumed.',
      down: 'Lower this if contracts or commercial structure bound the external downside more tightly than assumed.'
    },
    rc: {
      up: 'Raise this if commercial trust, contract renewal, or stakeholder confidence would degrade more sharply than currently assumed.',
      down: 'Lower this if the event is less visible externally or contract downside is better contained than assumed.'
    }
  };
  return {
    title: {
      tef: 'Event frequency',
      threatCap: 'Threat capability',
      controlStr: 'Control strength',
      vuln: 'Direct exposure',
      ir: 'Response and recovery cost',
      bi: 'Business disruption cost',
      db: 'Data remediation cost',
      rl: 'Regulatory and legal cost',
      tp: 'Third-party impact cost',
      rc: 'Reputation and contract cost'
    }[prefix] || 'Parameter detail',
    meaning: baseMeaning[prefix] || 'This is one of the current model assumptions.',
    support: support.length ? support : ['No direct supporting rationale is attached to this input yet.'],
    moveUp: movementHints[prefix]?.up || 'Raise this only if direct evidence points clearly upward.',
    moveDown: movementHints[prefix]?.down || 'Lower this only if direct evidence points clearly downward.',
    dependency: getStep3DependencyHint(prefix, fairParams)
  };
}

function renderStep3AssumptionExplainerPanel(model) {
  if (!model) return '';
  return `<div class="fair-assumption-panel">
    <div class="fair-assumption-panel__head">
      <div>
        <div class="fair-assumption-panel__label">Assumption explainer</div>
        <strong>${escapeHtml(model.title)}</strong>
      </div>
      <span class="badge badge--neutral">${escapeHtml(model.dependency.label)}</span>
    </div>
    <p class="fair-assumption-panel__copy">${escapeHtml(model.meaning)}</p>
    <div class="fair-assumption-panel__grid">
      <div>
        <div class="fair-assumption-panel__section">What supports it</div>
        <p>${model.support.map(item => `• ${escapeHtml(item)}`).join('<br>')}</p>
      </div>
      <div>
        <div class="fair-assumption-panel__section">What would move it up</div>
        <p>${escapeHtml(model.moveUp)}</p>
      </div>
      <div>
        <div class="fair-assumption-panel__section">What would move it down</div>
        <p>${escapeHtml(model.moveDown)}</p>
      </div>
      <div>
        <div class="fair-assumption-panel__section">How much the result depends on it</div>
        <p>${escapeHtml(model.dependency.copy)}</p>
      </div>
    </div>
  </div>`;
}

function bindFairRationaleChips() {
  ensureFairRationaleStyles();
  const fairParams = AppState.draft.fairParams || (AppState.draft.fairParams = {});
  const fieldRationale = getStep3FieldRationaleMap(AppState.draft);
  const calibratedFields = new Set(
    Array.isArray(AppState.draft?.orgCalibrationInfo?.appliedFields)
      ? AppState.draft.orgCalibrationInfo.appliedFields.map(item => String(item?.fieldName || '').trim())
      : []
  );
  fairParams.fieldRationale = fieldRationale;
  Object.entries(fieldRationale).forEach(([fieldName, rationaleText]) => {
    const input = document.getElementById(fairFieldNameToInputId(fieldName));
    if (!input) return;
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    const rationaleId = `rationale-${fieldName}`;
    const existing = document.getElementById(rationaleId);
    if (existing) existing.remove();
    formGroup.insertAdjacentHTML('beforeend', `<div class="fair-rationale" id="${rationaleId}"><span class="fair-rationale__icon">ℹ</span><span class="fair-rationale__text">${escapeHtml(rationaleText)}${calibratedFields.has(fieldName) ? ' <span class="badge badge--neutral" style="margin-left:6px">Legacy calibration</span>' : ''}</span><button type="button" class="fair-rationale__action" data-rationale-field="${escapeHtml(fieldName)}" aria-expanded="false">Explain</button></div>`);
    const rationale = document.getElementById(rationaleId);
    const explainButton = rationale?.querySelector('.fair-rationale__action');
    explainButton?.addEventListener('click', () => {
      const existingPanel = formGroup.querySelector('.fair-assumption-panel');
      document.querySelectorAll('.fair-assumption-panel').forEach(panel => panel.remove());
      document.querySelectorAll('.fair-rationale__action[aria-expanded="true"]').forEach(button => {
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'Explain';
      });
      if (existingPanel) return;
      const model = buildStep3AssumptionExplainerModel(fieldName, AppState.draft);
      if (!model) return;
      formGroup.insertAdjacentHTML('beforeend', renderStep3AssumptionExplainerPanel(model));
      explainButton.setAttribute('aria-expanded', 'true');
      explainButton.textContent = 'Hide detail';
    });
    input.addEventListener('input', () => {
      if (!rationale) return;
      rationale.classList.add('fair-rationale--overridden');
      const icon = rationale.querySelector('.fair-rationale__icon');
      if (icon) icon.textContent = '✏';
    });
  });
}

function renderOrgCalibrationBand(draft) {
  const info = draft?.orgCalibrationInfo;
  if (!info || !Array.isArray(info.appliedFields) || !info.appliedFields.length) return '';
  return `<div class="wizard-summary-band wizard-summary-band--quiet anim-fade-in">
    <div>
      <div class="wizard-summary-band__label">Legacy calibration markers</div>
      <strong>${info.appliedFields.length} field${info.appliedFields.length === 1 ? '' : 's'} still carry earlier organisation-calibration metadata</strong>
      <div class="wizard-summary-band__copy">This information is retained for older drafts only. Review each field manually before relying on it.</div>
    </div>
    <div class="wizard-summary-band__meta">
      ${info.appliedFields.slice(0, 3).map(item => `<span class="badge badge--neutral">${escapeHtml(OrgIntelligenceService?.getFieldLabel?.(item.fieldName) || item.fieldName)}</span>`).join('')}
      ${info.appliedFields.length > 3 ? `<span class="badge badge--neutral">+${info.appliedFields.length - 3} more</span>` : ''}
    </div>
  </div>`;
}

function describeExposureBand(value) {
  const num = Number(value || 0);
  if (num <= 0.25) return 'low chance of succeeding';
  if (num <= 0.5) return 'meaningful but not easy to pull off';
  if (num <= 0.75) return 'plausible if the attacker is capable';
  return 'highly plausible unless controls hold up well';
}

function buildEstimateExplainer(draft, bu, isAdv, currency) {
  const p = draft.fairParams || {};
  const hasAI = !!draft.llmAssisted;
  const tef = [p.tefMin, p.tefLikely, p.tefMax].every(v => v != null)
    ? `AI is currently assuming this could happen between ${p.tefMin} and ${p.tefMax} times in a year, with ${p.tefLikely} as the most realistic planning case.`
    : 'Use the range to describe how often this could happen in a quiet year, a typical year, and a severe but still plausible year.';
  const exposure = isAdv && p.vulnDirect
    ? ([p.vulnMin, p.vulnLikely, p.vulnMax].every(v => v != null)
      ? `The direct exposure values mean the event has roughly a ${Math.round((p.vulnMin || 0) * 100)}% to ${Math.round((p.vulnMax || 0) * 100)}% chance of succeeding if attempted, with ${Math.round((p.vulnLikely || 0) * 100)}% as the working case.`
      : 'Direct exposure means you are estimating the chance that the event succeeds if attempted.')
    : ([p.threatCapLikely, p.controlStrLikely].every(v => v != null)
      ? `In basic mode, these numbers are split into attacker capability and control strength. Right now the AI is saying the attacker looks ${describeExposureBand(p.threatCapLikely)} while your controls look ${describeExposureBand(1 - (p.controlStrLikely || 0)) === 'low chance of succeeding' ? 'stronger than average' : 'material but not absolute'}.`
      : 'In basic mode, you do not estimate exposure directly. You describe attacker capability and how strong your controls are, and the model derives exposure from that.')
  const likelyLoss = ['irLikely','biLikely','dbLikely','rlLikely','tpLikely','rcLikely'].reduce((sum, key) => sum + Number(p[key] || 0), 0);
  const severeLoss = ['irMax','biMax','dbMax','rlMax','tpMax','rcMax'].reduce((sum, key) => sum + Number(p[key] || 0), 0);
  const loss = likelyLoss || severeLoss
    ? `Using the current values, the model reads this as roughly ${formatPlainCurrency(likelyLoss, currency)} in a realistic single-event case, rising to about ${formatPlainCurrency(severeLoss, currency)} in a severe case before annual frequency is applied.`
    : 'Each cost row is a per-event estimate. The model adds those rows together to understand what one event might cost before frequency is applied across a year.';
  const source = hasAI
    ? `These starting numbers were pre-filled from the scenario narrative, selected risks, ${bu?.name ? `${bu.name} context and defaults, ` : ''}linked internal citations, and structured benchmark profiles built from published research and official reports where relevant. They are starting assumptions, not final answers.`
    : `These are your working assumptions. If you have internal incident data, control evidence, or finance input, adjust the ranges to reflect that evidence.`;
  return { source, tef, exposure, loss };
}

function renderEstimateExplainerCard(draft, bu, isAdv, currency) {
  const explainer = buildEstimateExplainer(draft, bu, isAdv, currency);
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">What the starting values mean</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-4);margin-top:var(--sp-3)">
      ${UI.contextInfoPanel({
        title: 'Where the starting values came from',
        copy: explainer.source
      })}
      ${UI.contextInfoGrid({
        panels: [
          UI.contextInfoPanel({ title: 'Frequency', copy: explainer.tef }),
          UI.contextInfoPanel({ title: 'Exposure', copy: explainer.exposure }),
          UI.contextInfoPanel({ title: 'Cost', copy: explainer.loss })
        ]
      })}
      <div class="context-panel-foot">Read the three columns as: low case = quieter outcome, expected case = planning assumption, severe case = bad but still plausible outcome. You are not trying to predict one perfect number.</div>
    </div>
  </div>`;
}

function renderRangeCalibrationCard(currency) {
  return UI.contextInfoGrid({
    title: 'Quick calibration guide',
    className: 'card card--elevated anim-fade-in',
    gridStyle: 'margin-top:var(--sp-3)',
    panels: [
      UI.contextInfoPanel({ title: 'Event frequency examples', copy: '0.5 = about once every two years. 1 = about once a year. 4 = about quarterly. 12 = about monthly.' }),
      UI.contextInfoPanel({ title: 'How to think about low, expected, severe', copy: 'Low case = contained and quieter than normal. Expected case = the planning assumption you would defend in a meeting. Severe case = bad but still plausible, not an apocalypse number.' }),
      UI.contextInfoPanel({ title: 'Cost range examples', copy: `Low cost = handled with limited disruption. Expected cost = management attention and some external support likely. Severe cost = prolonged disruption, customer impact, and legal or regulatory escalation in ${currency}.` })
    ]
  });
}

function renderInlineEstimateExamples(currency) {
  return {
    frequency: `<div class="context-panel-foot" style="margin-top:12px">Examples: 0.5 = once every two years, 1 = once a year, 4 = quarterly, 12 = monthly.</div>`,
    cost: `<div class="context-panel-foot" style="margin-bottom:var(--sp-4)">Low = limited disruption. Expected = the planning case you would defend. Severe = major but still plausible disruption in ${currency}.</div>`
  };
}

function getEstimatePresetLibrary() {
  return {
    phishing: {
      label: 'Phishing / BEC example',
      summary: 'Higher frequency, moderate disruption, stronger focus on response and third-party loss.',
      values: {
        tefMin: 2, tefLikely: 6, tefMax: 18,
        threatCapMin: 0.4, threatCapLikely: 0.58, threatCapMax: 0.78,
        controlStrMin: 0.45, controlStrLikely: 0.62, controlStrMax: 0.8,
        irMin: 25000, irLikely: 90000, irMax: 280000,
        biMin: 30000, biLikely: 120000, biMax: 450000,
        dbMin: 10000, dbLikely: 40000, dbMax: 150000,
        rlMin: 0, rlLikely: 20000, rlMax: 150000,
        tpMin: 10000, tpLikely: 50000, tpMax: 250000,
        rcMin: 15000, rcLikely: 70000, rcMax: 250000
      }
    },
    identity: {
      label: 'Identity compromise example',
      summary: 'Moderate-to-high frequency, elevated response effort, and meaningful downstream fraud or service-disruption risk.',
      values: {
        tefMin: 0.8, tefLikely: 3.2, tefMax: 10,
        threatCapMin: 0.45, threatCapLikely: 0.66, threatCapMax: 0.84,
        controlStrMin: 0.4, controlStrLikely: 0.58, controlStrMax: 0.78,
        irMin: 60000, irLikely: 180000, irMax: 520000,
        biMin: 90000, biLikely: 320000, biMax: 1200000,
        dbMin: 40000, dbLikely: 140000, dbMax: 500000,
        rlMin: 10000, rlLikely: 80000, rlMax: 450000,
        tpMin: 10000, tpLikely: 60000, tpMax: 260000,
        rcMin: 50000, rcLikely: 180000, rcMax: 700000
      }
    },
    cloud: {
      label: 'Cloud exposure example',
      summary: 'Moderate frequency, stronger remediation and continuity cost pattern, with lighter third-party spillover.',
      values: {
        tefMin: 0.6, tefLikely: 2.2, tefMax: 8,
        threatCapMin: 0.42, threatCapLikely: 0.62, threatCapMax: 0.82,
        controlStrMin: 0.38, controlStrLikely: 0.56, controlStrMax: 0.76,
        irMin: 50000, irLikely: 160000, irMax: 480000,
        biMin: 80000, biLikely: 280000, biMax: 1100000,
        dbMin: 70000, dbLikely: 220000, dbMax: 850000,
        rlMin: 20000, rlLikely: 90000, rlMax: 500000,
        tpMin: 0, tpLikely: 40000, tpMax: 180000,
        rcMin: 50000, rcLikely: 170000, rcMax: 620000
      }
    },
    aiModelRisk: {
      label: 'AI / model risk example',
      summary: 'Lower-to-moderate frequency with governance remediation, stakeholder trust, and regulatory or conduct pressure weighted above direct outage cost.',
      values: {
        tefMin: 0.2, tefLikely: 0.9, tefMax: 4,
        threatCapMin: 0.28, threatCapLikely: 0.46, threatCapMax: 0.68,
        controlStrMin: 0.36, controlStrLikely: 0.54, controlStrMax: 0.76,
        irMin: 40000, irLikely: 140000, irMax: 420000,
        biMin: 50000, biLikely: 220000, biMax: 900000,
        dbMin: 10000, dbLikely: 50000, dbMax: 220000,
        rlMin: 50000, rlLikely: 220000, rlMax: 980000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 120000, rcLikely: 420000, rcMax: 1600000
      }
    },
    dataGovernance: {
      label: 'Data governance / privacy example',
      summary: 'Moderate frequency with data remediation, privacy challenge, and downstream reporting-confidence loss.',
      values: {
        tefMin: 0.3, tefLikely: 1.4, tefMax: 6,
        threatCapMin: 0.3, threatCapLikely: 0.48, threatCapMax: 0.7,
        controlStrMin: 0.36, controlStrLikely: 0.54, controlStrMax: 0.76,
        irMin: 35000, irLikely: 120000, irMax: 360000,
        biMin: 50000, biLikely: 180000, biMax: 700000,
        dbMin: 60000, dbLikely: 220000, dbMax: 900000,
        rlMin: 40000, rlLikely: 180000, rlMax: 900000,
        tpMin: 0, tpLikely: 30000, tpMax: 160000,
        rcMin: 80000, rcLikely: 260000, rcMax: 980000
      }
    },
    ransomware: {
      label: 'Ransomware / outage example',
      summary: 'Lower frequency than phishing, but heavier business disruption and recovery effort.',
      values: {
        tefMin: 0.5, tefLikely: 1.5, tefMax: 4,
        threatCapMin: 0.55, threatCapLikely: 0.72, threatCapMax: 0.9,
        controlStrMin: 0.35, controlStrLikely: 0.55, controlStrMax: 0.75,
        irMin: 80000, irLikely: 250000, irMax: 900000,
        biMin: 150000, biLikely: 700000, biMax: 3500000,
        dbMin: 25000, dbLikely: 90000, dbMax: 300000,
        rlMin: 0, rlLikely: 50000, rlMax: 350000,
        tpMin: 0, tpLikely: 40000, tpMax: 250000,
        rcMin: 50000, rcLikely: 180000, rcMax: 950000
      }
    },
    dataBreach: {
      label: 'Data privacy / breach example',
      summary: 'Moderate frequency, stronger remediation and regulatory/legal cost pattern.',
      values: {
        tefMin: 0.3, tefLikely: 1, tefMax: 3,
        threatCapMin: 0.45, threatCapLikely: 0.65, threatCapMax: 0.82,
        controlStrMin: 0.4, controlStrLikely: 0.58, controlStrMax: 0.78,
        irMin: 50000, irLikely: 160000, irMax: 500000,
        biMin: 50000, biLikely: 220000, biMax: 900000,
        dbMin: 80000, dbLikely: 250000, dbMax: 1000000,
        rlMin: 20000, rlLikely: 120000, rlMax: 950000,
        tpMin: 10000, tpLikely: 50000, tpMax: 250000,
        rcMin: 40000, rcLikely: 160000, rcMax: 700000
      }
    },
    strategic: {
      label: 'Strategic downside example',
      summary: 'Lower annual frequency, but heavier contract, reputation, and execution drag once the issue materialises.',
      values: {
        tefMin: 0.2, tefLikely: 0.8, tefMax: 3,
        threatCapMin: 0.24, threatCapLikely: 0.44, threatCapMax: 0.68,
        controlStrMin: 0.38, controlStrLikely: 0.56, controlStrMax: 0.76,
        irMin: 40000, irLikely: 120000, irMax: 360000,
        biMin: 180000, biLikely: 620000, biMax: 2400000,
        dbMin: 0, dbLikely: 5000, dbMax: 30000,
        rlMin: 10000, rlLikely: 90000, rlMax: 420000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 160000, rcLikely: 620000, rcMax: 2400000
      }
    },
    operational: {
      label: 'Operational breakdown example',
      summary: 'Moderate frequency with business interruption as the dominant cost driver and only secondary regulatory exposure.',
      values: {
        tefMin: 0.5, tefLikely: 2, tefMax: 9,
        threatCapMin: 0.3, threatCapLikely: 0.5, threatCapMax: 0.74,
        controlStrMin: 0.34, controlStrLikely: 0.52, controlStrMax: 0.74,
        irMin: 35000, irLikely: 110000, irMax: 340000,
        biMin: 160000, biLikely: 620000, biMax: 2400000,
        dbMin: 0, dbLikely: 0, dbMax: 20000,
        rlMin: 10000, rlLikely: 50000, rlMax: 240000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 80000, rcLikely: 240000, rcMax: 920000
      }
    },
    regulatory: {
      label: 'Regulatory breach example',
      summary: 'Lower frequency, lighter interruption, and stronger legal or enforcement cost pattern.',
      values: {
        tefMin: 0.2, tefLikely: 1, tefMax: 4,
        threatCapMin: 0.3, threatCapLikely: 0.48, threatCapMax: 0.7,
        controlStrMin: 0.4, controlStrLikely: 0.58, controlStrMax: 0.78,
        irMin: 30000, irLikely: 90000, irMax: 300000,
        biMin: 50000, biLikely: 180000, biMax: 700000,
        dbMin: 0, dbLikely: 10000, dbMax: 50000,
        rlMin: 150000, rlLikely: 520000, rlMax: 2200000,
        tpMin: 0, tpLikely: 20000, tpMax: 140000,
        rcMin: 80000, rcLikely: 280000, rcMax: 1100000
      }
    },
    financial: {
      label: 'Financial control / fraud example',
      summary: 'Moderate frequency with direct loss, investigation effort, and third-party or contractual spillover.',
      values: {
        tefMin: 0.6, tefLikely: 2.4, tefMax: 10,
        threatCapMin: 0.36, threatCapLikely: 0.56, threatCapMax: 0.8,
        controlStrMin: 0.36, controlStrLikely: 0.54, controlStrMax: 0.76,
        irMin: 30000, irLikely: 100000, irMax: 320000,
        biMin: 40000, biLikely: 150000, biMax: 620000,
        dbMin: 0, dbLikely: 5000, dbMax: 30000,
        rlMin: 30000, rlLikely: 150000, rlMax: 760000,
        tpMin: 30000, tpLikely: 150000, tpMax: 760000,
        rcMin: 70000, rcLikely: 250000, rcMax: 980000
      }
    },
    fraudIntegrity: {
      label: 'Fraud / integrity example',
      summary: 'Moderate frequency with direct loss, investigation, and assurance or legal pressure after hidden override or collusion.',
      values: {
        tefMin: 0.4, tefLikely: 1.8, tefMax: 7,
        threatCapMin: 0.38, threatCapLikely: 0.58, threatCapMax: 0.8,
        controlStrMin: 0.34, controlStrLikely: 0.52, controlStrMax: 0.74,
        irMin: 50000, irLikely: 150000, irMax: 460000,
        biMin: 40000, biLikely: 160000, biMax: 650000,
        dbMin: 0, dbLikely: 10000, dbMax: 70000,
        rlMin: 50000, rlLikely: 220000, rlMax: 1100000,
        tpMin: 40000, tpLikely: 170000, tpMax: 780000,
        rcMin: 80000, rcLikely: 280000, rcMax: 1100000
      }
    },
    esg: {
      label: 'ESG / sustainability example',
      summary: 'Lower frequency with disclosure, remediation, and stakeholder-confidence loss weighted above direct disruption.',
      values: {
        tefMin: 0.2, tefLikely: 0.9, tefMax: 4,
        threatCapMin: 0.24, threatCapLikely: 0.4, threatCapMax: 0.64,
        controlStrMin: 0.34, controlStrLikely: 0.5, controlStrMax: 0.72,
        irMin: 25000, irLikely: 85000, irMax: 260000,
        biMin: 30000, biLikely: 120000, biMax: 500000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 30000, rlLikely: 140000, rlMax: 650000,
        tpMin: 0, tpLikely: 15000, tpMax: 90000,
        rcMin: 140000, rcLikely: 460000, rcMax: 1700000
      }
    },
    compliance: {
      label: 'Compliance assurance example',
      summary: 'Moderate frequency with remediation, assurance, and legal exposure weighted above direct disruption.',
      values: {
        tefMin: 0.4, tefLikely: 1.5, tefMax: 6,
        threatCapMin: 0.3, threatCapLikely: 0.46, threatCapMax: 0.68,
        controlStrMin: 0.34, controlStrLikely: 0.5, controlStrMax: 0.72,
        irMin: 25000, irLikely: 85000, irMax: 260000,
        biMin: 30000, biLikely: 120000, biMax: 500000,
        dbMin: 0, dbLikely: 5000, dbMax: 25000,
        rlMin: 60000, rlLikely: 220000, rlMax: 920000,
        tpMin: 0, tpLikely: 20000, tpMax: 120000,
        rcMin: 70000, rcLikely: 220000, rcMax: 820000
      }
    },
    legalContract: {
      label: 'Legal / contract example',
      summary: 'Lower frequency with dispute cost, delayed delivery, and contractual pressure weighted above direct disruption.',
      values: {
        tefMin: 0.25, tefLikely: 1, tefMax: 4,
        threatCapMin: 0.28, threatCapLikely: 0.46, threatCapMax: 0.68,
        controlStrMin: 0.36, controlStrLikely: 0.54, controlStrMax: 0.76,
        irMin: 25000, irLikely: 90000, irMax: 300000,
        biMin: 70000, biLikely: 260000, biMax: 1000000,
        dbMin: 0, dbLikely: 5000, dbMax: 25000,
        rlMin: 120000, rlLikely: 460000, rlMax: 2000000,
        tpMin: 25000, tpLikely: 120000, tpMax: 620000,
        rcMin: 100000, rcLikely: 340000, rcMax: 1300000
      }
    },
    geopolitical: {
      label: 'Geopolitical / market access example',
      summary: 'Lower frequency with strategic value erosion, supplier restriction, and policy-driven execution delay.',
      values: {
        tefMin: 0.1, tefLikely: 0.6, tefMax: 2.5,
        threatCapMin: 0.2, threatCapLikely: 0.36, threatCapMax: 0.58,
        controlStrMin: 0.34, controlStrLikely: 0.5, controlStrMax: 0.72,
        irMin: 25000, irLikely: 90000, irMax: 280000,
        biMin: 150000, biLikely: 550000, biMax: 2200000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 50000, rlLikely: 180000, rlMax: 900000,
        tpMin: 20000, tpLikely: 90000, tpMax: 420000,
        rcMin: 180000, rcLikely: 680000, rcMax: 2600000
      }
    },
    thirdParty: {
      label: 'Third-party dependency example',
      summary: 'Moderate frequency with supplier-driven interruption and contractual spillover as the main cost pattern.',
      values: {
        tefMin: 0.4, tefLikely: 1.8, tefMax: 6,
        threatCapMin: 0.4, threatCapLikely: 0.6, threatCapMax: 0.8,
        controlStrMin: 0.34, controlStrLikely: 0.5, controlStrMax: 0.72,
        irMin: 25000, irLikely: 90000, irMax: 280000,
        biMin: 140000, biLikely: 520000, biMax: 2200000,
        dbMin: 0, dbLikely: 10000, dbMax: 50000,
        rlMin: 10000, rlLikely: 60000, rlMax: 260000,
        tpMin: 40000, tpLikely: 180000, tpMax: 850000,
        rcMin: 80000, rcLikely: 260000, rcMax: 980000
      }
    },
    procurement: {
      label: 'Procurement governance example',
      summary: 'Lower-to-moderate frequency with commercial leakage, supplier underperformance, and contract-control exposure.',
      values: {
        tefMin: 0.3, tefLikely: 1.1, tefMax: 5,
        threatCapMin: 0.28, threatCapLikely: 0.46, threatCapMax: 0.68,
        controlStrMin: 0.34, controlStrLikely: 0.5, controlStrMax: 0.72,
        irMin: 20000, irLikely: 70000, irMax: 220000,
        biMin: 120000, biLikely: 400000, biMax: 1500000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 10000, rlLikely: 70000, rlMax: 320000,
        tpMin: 30000, tpLikely: 160000, tpMax: 780000,
        rcMin: 50000, rcLikely: 190000, rcMax: 760000
      }
    },
    supplyChain: {
      label: 'Supply chain disruption example',
      summary: 'Lower-to-moderate frequency with delivery disruption, substitute cost, and contract pressure.',
      values: {
        tefMin: 0.3, tefLikely: 1.4, tefMax: 6,
        threatCapMin: 0.3, threatCapLikely: 0.5, threatCapMax: 0.74,
        controlStrMin: 0.32, controlStrLikely: 0.48, controlStrMax: 0.7,
        irMin: 25000, irLikely: 80000, irMax: 260000,
        biMin: 180000, biLikely: 700000, biMax: 2600000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 10000, rlLikely: 50000, rlMax: 240000,
        tpMin: 30000, tpLikely: 140000, tpMax: 700000,
        rcMin: 70000, rcLikely: 220000, rcMax: 920000
      }
    },
    businessContinuity: {
      label: 'Business continuity example',
      summary: 'Lower frequency but severe outage and recovery cost pattern once the event breaks through continuity assumptions.',
      values: {
        tefMin: 0.2, tefLikely: 1.1, tefMax: 5,
        threatCapMin: 0.26, threatCapLikely: 0.44, threatCapMax: 0.68,
        controlStrMin: 0.34, controlStrLikely: 0.52, controlStrMax: 0.74,
        irMin: 50000, irLikely: 170000, irMax: 520000,
        biMin: 220000, biLikely: 820000, biMax: 3200000,
        dbMin: 0, dbLikely: 0, dbMax: 20000,
        rlMin: 10000, rlLikely: 60000, rlMax: 280000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 90000, rcLikely: 300000, rcMax: 1200000
      }
    },
    physicalSecurity: {
      label: 'Physical security example',
      summary: 'Moderate frequency with investigation, site-disruption, and leadership assurance pressure.',
      values: {
        tefMin: 0.25, tefLikely: 1.2, tefMax: 5,
        threatCapMin: 0.3, threatCapLikely: 0.48, threatCapMax: 0.7,
        controlStrMin: 0.34, controlStrLikely: 0.5, controlStrMax: 0.72,
        irMin: 45000, irLikely: 150000, irMax: 460000,
        biMin: 120000, biLikely: 420000, biMax: 1700000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 20000, rlLikely: 90000, rlMax: 420000,
        tpMin: 10000, tpLikely: 50000, tpMax: 240000,
        rcMin: 90000, rcLikely: 280000, rcMax: 1100000
      }
    },
    otResilience: {
      label: 'OT / site resilience example',
      summary: 'Lower frequency with unstable operations, recovery strain, and safety-linked shutdown pressure.',
      values: {
        tefMin: 0.2, tefLikely: 1, tefMax: 4.5,
        threatCapMin: 0.3, threatCapLikely: 0.5, threatCapMax: 0.74,
        controlStrMin: 0.34, controlStrLikely: 0.52, controlStrMax: 0.74,
        irMin: 60000, irLikely: 180000, irMax: 560000,
        biMin: 180000, biLikely: 700000, biMax: 2800000,
        dbMin: 0, dbLikely: 15000, dbMax: 90000,
        rlMin: 30000, rlLikely: 120000, rlMax: 520000,
        tpMin: 10000, tpLikely: 60000, tpMax: 300000,
        rcMin: 90000, rcLikely: 300000, rcMax: 1200000
      }
    },
    peopleWorkforce: {
      label: 'People / workforce example',
      summary: 'Moderate frequency with staffing strain, welfare pressure, and safe-delivery concerns.',
      values: {
        tefMin: 0.3, tefLikely: 1.2, tefMax: 5,
        threatCapMin: 0.26, threatCapLikely: 0.42, threatCapMax: 0.64,
        controlStrMin: 0.36, controlStrLikely: 0.54, controlStrMax: 0.76,
        irMin: 30000, irLikely: 100000, irMax: 320000,
        biMin: 100000, biLikely: 360000, biMax: 1500000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 30000, rlLikely: 120000, rlMax: 600000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 90000, rcLikely: 320000, rcMax: 1300000
      }
    },
    hse: {
      label: 'HSE incident example',
      summary: 'Lower frequency with elevated shutdown, remediation, and regulatory or legal exposure.',
      values: {
        tefMin: 0.15, tefLikely: 0.8, tefMax: 3,
        threatCapMin: 0.24, threatCapLikely: 0.42, threatCapMax: 0.64,
        controlStrMin: 0.38, controlStrLikely: 0.56, controlStrMax: 0.76,
        irMin: 50000, irLikely: 160000, irMax: 500000,
        biMin: 160000, biLikely: 580000, biMax: 2200000,
        dbMin: 0, dbLikely: 0, dbMax: 10000,
        rlMin: 100000, rlLikely: 320000, rlMax: 1400000,
        tpMin: 10000, tpLikely: 70000, tpMax: 320000,
        rcMin: 100000, rcLikely: 320000, rcMax: 1200000
      }
    },
    investmentJv: {
      label: 'Investment / JV example',
      summary: 'Lower frequency with value erosion, delayed synergy, and management reprioritisation.',
      values: {
        tefMin: 0.15, tefLikely: 0.6, tefMax: 2.5,
        threatCapMin: 0.24, threatCapLikely: 0.42, threatCapMax: 0.64,
        controlStrMin: 0.36, controlStrLikely: 0.54, controlStrMax: 0.76,
        irMin: 40000, irLikely: 120000, irMax: 360000,
        biMin: 140000, biLikely: 480000, biMax: 1800000,
        dbMin: 0, dbLikely: 5000, dbMax: 30000,
        rlMin: 25000, rlLikely: 110000, rlMax: 500000,
        tpMin: 0, tpLikely: 40000, tpMax: 220000,
        rcMin: 180000, rcLikely: 700000, rcMax: 2800000
      }
    },
    transformationDelivery: {
      label: 'Transformation delivery example',
      summary: 'Lower frequency with milestone slippage, rising cost, and delayed benefit realisation.',
      values: {
        tefMin: 0.2, tefLikely: 0.9, tefMax: 4,
        threatCapMin: 0.26, threatCapLikely: 0.44, threatCapMax: 0.66,
        controlStrMin: 0.34, controlStrLikely: 0.52, controlStrMax: 0.74,
        irMin: 30000, irLikely: 100000, irMax: 320000,
        biMin: 120000, biLikely: 420000, biMax: 1600000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 15000, rlLikely: 70000, rlMax: 320000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 140000, rcLikely: 520000, rcMax: 2100000
      }
    }
  };
}

function recommendEstimatePreset(draft) {
  const lensPresetKey = String(draft?.scenarioLens?.estimatePresetKey || '').trim();
  if (lensPresetKey && getEstimatePresetLibrary()[lensPresetKey]) return lensPresetKey;
  const text = [
    draft.scenarioTitle,
    draft.enhancedNarrative,
    draft.narrative,
    getStructuredScenarioField(draft.structuredScenario, 'eventPath'),
    getStructuredScenarioField(draft.structuredScenario, 'primaryDriver'),
    ...(getSelectedRisks().map(r => r.title || ''))
  ].join(' ').toLowerCase();
  if (/(phish|\bbec\b|business email compromise|email compromise|business email|invoice fraud)/.test(text)) return 'phishing';
  if (/(identity|entra|sso|directory|mailbox compromise|session hijack|account takeover)/.test(text)) return 'identity';
  if (/(cloud|bucket|tenant|misconfig|public exposure|saas)/.test(text)) return 'cloud';
  if (/(responsible ai|model risk|ai governance|hallucination|model drift|algorithmic bias|training data|ai act)/.test(text)) return 'aiModelRisk';
  if (/(data governance|data lineage|retention|purpose limitation|consent|data residency|master data|privacy)/.test(text)) return 'dataGovernance';
  if (/(ransom|encrypt|extortion|outage|business interruption|recovery)/.test(text)) return 'ransomware';
  if (/(privacy|breach|exfiltrat|data leak|personal data|pii|phi)/.test(text)) return 'dataBreach';
  // Prefer narrower enterprise presets before the older broad categories so the estimate guidance stays domain-specific.
  if (/(financial crime|kickback|bribery|corruption|integrity|embezzlement)/.test(text)) return 'fraudIntegrity';
  if (/(contract|indemnity|litigation|licensing dispute|intellectual property|\bip\b)/.test(text)) return 'legalContract';
  if (/(geopolitical|market access|sovereign|entity list|cross-border restriction|tariff|export control)/.test(text)) return 'geopolitical';
  if (/(merger|acquisition|m&a|joint venture|\bjv\b|integration thesis|synergy)/.test(text)) return 'investmentJv';
  if (/(transformation delivery|programme delivery|program delivery|project delivery|go-live|milestone|benefit realisation|benefit realization)/.test(text)) return 'transformationDelivery';
  if (/(strategy|strategic|market shift|competitive|transformation|portfolio|investment)/.test(text)) return 'strategic';
  if (/(operational|process failure|control failure|breakdown|backlog|service failure)/.test(text)) return 'operational';
  if (/(regulator|regulatory|licen|filing|supervisory|sanction)/.test(text)) return 'regulatory';
  if (/(fraud|payment|invoice|treasury|liquidity|capital|financial)/.test(text)) return 'financial';
  if (/(compliance|policy breach|conduct|ethics|assurance)/.test(text)) return 'compliance';
  if (/(procurement|sourcing|tender|bid|contract award|vendor selection|purchasing)/.test(text)) return 'procurement';
  if (/(supply chain|logistics|shipment|inventory|single source|upstream)/.test(text)) return 'supplyChain';
  if (/(third[- ]party|supplier|vendor|outsourc)/.test(text)) return 'thirdParty';
  if (/(business continuity|continuity|disaster recovery|rto|rpo|crisis management)/.test(text)) return 'businessContinuity';
  if (/(physical security|badge control|visitor management|perimeter|facility breach|executive protection)/.test(text)) return 'physicalSecurity';
  if (/\bot\b|operational technology|industrial control|ics|scada|site systems|plant network/.test(text)) return 'otResilience';
  if (/(workforce|labou?r|fatigue|staffing|worker welfare|strike)/.test(text)) return 'peopleWorkforce';
  if (/(hse|health and safety|safety|injury|environmental|spill|worker)/.test(text)) return 'hse';
  return '';
}

function buildStep3FocusHint(draft) {
  const presetKey = recommendEstimatePreset(draft);
  const hints = {
    ransomware: {
      primary: 'Business interruption',
      secondary: 'Event frequency',
      why: 'For ransomware scenarios, recovery time and service downtime dominate the loss estimate. Set these two rows first, then work outward.'
    },
    dataBreach: {
      primary: 'Regulatory and legal cost',
      secondary: 'Data remediation',
      why: 'For data exposure scenarios, notification obligations and remediation effort drive the result most. Set these two rows first.'
    },
    phishing: {
      primary: 'Event frequency',
      secondary: 'Third-party liability',
      why: 'Phishing and BEC scenarios happen more often than other types. Frequency and downstream fraud exposure matter most here.'
    },
    identity: {
      primary: 'Event frequency',
      secondary: 'Business interruption',
      why: 'Identity-led scenarios often hinge on how often a compromise path is plausible and how widely access disruption would spread once core identity services are affected.'
    },
    cloud: {
      primary: 'Data remediation',
      secondary: 'Business interruption',
      why: 'Cloud exposure scenarios usually turn on how much sensitive data or service continuity is actually in scope once the weak control is triggered.'
    },
    aiModelRisk: {
      primary: 'Regulatory and legal cost',
      secondary: 'Reputation / contract loss',
      why: 'AI and model-risk scenarios usually turn on governance challenge, remediation, and trust in the AI-enabled workflow once poor behaviour becomes visible.'
    },
    dataGovernance: {
      primary: 'Data remediation',
      secondary: 'Regulatory and legal cost',
      why: 'Data-governance scenarios are usually shaped by how much remediation is needed and how hard privacy or approved-use obligations are challenged.'
    },
    strategic: {
      primary: 'Reputation / contract loss',
      secondary: 'Business interruption',
      why: 'Strategic scenarios are usually less frequent, but the downside comes from execution drag, stakeholder pressure, and the cost of recovering the objective.'
    },
    operational: {
      primary: 'Business interruption',
      secondary: 'Event frequency',
      why: 'Operational scenarios are driven mainly by service strain and recovery effort. Set the disruption range first, then calibrate how often it could occur.'
    },
    regulatory: {
      primary: 'Regulatory and legal cost',
      secondary: 'Incident response',
      why: 'Regulatory scenarios are shaped primarily by enforcement, remediation, and management response effort rather than direct data-remediation cost.'
    },
    financial: {
      primary: 'Third-party liability',
      secondary: 'Incident response',
      why: 'Financial-control scenarios usually turn on direct loss and how quickly the organisation can detect, recover, and limit downstream commercial exposure.'
    },
    fraudIntegrity: {
      primary: 'Third-party liability',
      secondary: 'Regulatory and legal cost',
      why: 'Fraud and integrity scenarios often hinge on direct loss, investigation scope, and how hard assurance or legal response lands once collusion or override is visible.'
    },
    esg: {
      primary: 'Reputation / contract loss',
      secondary: 'Regulatory and legal cost',
      why: 'ESG scenarios are typically shaped by disclosure remediation, stakeholder confidence, and any follow-on supervisory or investor scrutiny once the issue becomes visible.'
    },
    compliance: {
      primary: 'Regulatory and legal cost',
      secondary: 'Reputation / contract loss',
      why: 'Compliance scenarios are mostly about remediation, assurance pressure, and the secondary trust impact if the issue becomes visible to leadership or regulators.'
    },
    legalContract: {
      primary: 'Regulatory and legal cost',
      secondary: 'Reputation / contract loss',
      why: 'Legal and contract scenarios are typically driven by dispute cost, leverage over obligations, and how badly delivery or partner confidence is affected.'
    },
    geopolitical: {
      primary: 'Reputation / contract loss',
      secondary: 'Business interruption',
      why: 'Geopolitical scenarios usually play out through delayed execution, supplier restriction, and the value erosion created when the original market or operating path becomes harder to sustain.'
    },
    thirdParty: {
      primary: 'Business interruption',
      secondary: 'Third-party liability',
      why: 'Third-party scenarios are usually shaped first by service disruption and then by the commercial or contractual spillover created by the supplier event.'
    },
    procurement: {
      primary: 'Third-party liability',
      secondary: 'Business interruption',
      why: 'Procurement scenarios typically surface as commercial leakage, weak supplier fit, or contract-control failure that then spills into delivery or service pressure.'
    },
    supplyChain: {
      primary: 'Business interruption',
      secondary: 'Reputation / contract loss',
      why: 'Supply-chain scenarios mainly turn on delivery disruption, substitute cost, and whether the issue starts to affect customer commitments or executive confidence.'
    },
    businessContinuity: {
      primary: 'Business interruption',
      secondary: 'Incident response',
      why: 'Continuity scenarios are mostly about outage duration and the recovery effort needed to restore a credible operating state.'
    },
    physicalSecurity: {
      primary: 'Business interruption',
      secondary: 'Incident response',
      why: 'Physical-security scenarios are typically shaped by site disruption, investigation effort, and how quickly the facility can be stabilised after the lapse is discovered.'
    },
    otResilience: {
      primary: 'Business interruption',
      secondary: 'Regulatory and legal cost',
      why: 'OT-resilience scenarios usually turn on whether the site can keep operating safely while visibility or control is degraded and recovery is still underway.'
    },
    peopleWorkforce: {
      primary: 'Business interruption',
      secondary: 'Reputation / contract loss',
      why: 'People and workforce scenarios are often driven by how staffing or welfare pressure degrades safe delivery before leadership steps in.'
    },
    hse: {
      primary: 'Regulatory and legal cost',
      secondary: 'Business interruption',
      why: 'HSE scenarios are typically driven by shutdown, remediation, and regulatory consequence once a safety or environmental control fails.'
    },
    investmentJv: {
      primary: 'Reputation / contract loss',
      secondary: 'Business interruption',
      why: 'Investment and JV scenarios typically turn on value erosion, delayed synergy, and the cost of correcting the transaction or integration plan once weak assumptions are exposed.'
    },
    transformationDelivery: {
      primary: 'Reputation / contract loss',
      secondary: 'Business interruption',
      why: 'Transformation-delivery scenarios are usually shaped by milestone slippage, benefit delay, and the operating strain created while the programme slips.'
    }
  };
  if (!presetKey || !hints[presetKey]) return null;
  return hints[presetKey];
}

function renderStep3FocusNudge(draft) {
  const hint = buildStep3FocusHint(draft);
  if (!hint) return '';
  return `<div class="card card--elevated anim-fade-in step3-focus-nudge">
    <div class="context-panel-title">Where to focus first</div>
    <p class="context-panel-copy" style="margin-top:var(--sp-2)">${escapeHtml(hint.why)}</p>
    <div class="citation-chips" style="margin-top:var(--sp-3)">
      <span class="badge badge--gold">Start here: ${escapeHtml(hint.primary)}</span>
      <span class="badge badge--neutral">Then: ${escapeHtml(hint.secondary)}</span>
    </div>
  </div>`;
}

function renderEstimateActionCard(draft, recommendedKey) {
  const recommendation = recommendedKey
    ? `Use <strong>${getEstimatePresetLibrary()[recommendedKey].label}</strong> only if it matches the scenario pattern. Otherwise keep the AI starting values and adjust only where you have evidence.`
    : 'Start with the AI values, then change only the inputs you can justify with business, control, incident, or finance evidence.';
  return `<div class="card card--elevated anim-fade-in estimate-next-card">
    <div class="context-panel-title">Recommended next action</div>
    <p class="context-panel-copy" style="margin-top:var(--sp-2)">${recommendation}</p>
  </div>`;
}

function renderEstimatePresetCard(draft) {
  const presets = getEstimatePresetLibrary();
  const recommendedKey = recommendEstimatePreset(draft);
  const buttons = Object.entries(presets).map(([key, preset]) => {
    const isRecommended = key === recommendedKey;
    const recommendedLabel = isRecommended ? ' <span class="badge badge--neutral" style="margin-left:6px">Recommended</span>' : '';
    const style = isRecommended ? ' style="border-color:var(--color-primary-400);background:rgba(77,163,255,.12);color:var(--text-primary)"' : '';
    return `<button type="button" class="chip estimate-preset-chip" data-estimate-preset="${key}" title="${preset.summary}"${style}>${preset.label}${recommendedLabel}</button>`;
  }).join('');
  const summary = recommendedKey
    ? `<div class="context-panel-foot" style="margin-top:12px">Best fit for this scenario: <strong>${presets[recommendedKey].label}</strong>. Use it only if the pattern looks close to your case.</div>`
    : '<div class="context-panel-foot" style="margin-top:12px">Pick a quick start only if one looks close to your scenario. Otherwise keep the AI values or enter your own evidence-based ranges.</div>';
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">Quick start examples</div>
    <p class="context-panel-copy" style="margin-top:var(--sp-2)">Use one of these only if you want a fast starting pattern. They do not replace the suggested values or your own evidence.</p>
    <div class="citation-chips" style="margin-top:12px">${buttons}</div>
    ${summary}
  </div>`;
}

function applyEstimatePreset(presetKey) {
  const preset = getEstimatePresetLibrary()[presetKey];
  if (!preset) return false;
  const fairParams = AppState.draft.fairParams || (AppState.draft.fairParams = {});
  Object.entries(preset.values).forEach(([key, value]) => {
    fairParams[key] = value;
  });
  return true;
}

function attachCitationHandlers() {
  document.querySelectorAll('.citation-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.docId;
      const docTitle = btn.dataset.docTitle || '';
      const docUrl = btn.dataset.docUrl || '';
      const doc = getDocList().find(d => d.id === docId)
        || AppState.draft.citations?.find(c => c.docId === docId)
        || getDocList().find(d => String(d.title || '').trim() === docTitle)
        || AppState.draft.citations?.find(c => String(c.title || '').trim() === docTitle)
        || getDocList().find(d => String(d.url || '').trim() === docUrl)
        || AppState.draft.citations?.find(c => String(c.url || '').trim() === docUrl);
      if (doc) UI.citationModal({ title: doc.title, excerpt: doc.contentExcerpt || doc.excerpt, tags: doc.tags||[], lastUpdated: doc.lastUpdated, url: doc.url });
    });
  });
}

// ─── WIZARD 3 ─────────────────────────────────────────────────
function renderEstimateModeNote(isAdv) {
  if (isAdv) {
    return `<div class="card card--elevated anim-fade-in"><div class="context-panel-title">Advanced mode</div><p class="context-panel-copy" style="margin-top:var(--sp-2)">Use this only if you want to enter direct exposure, secondary follow-on loss, or simulation tuning values. The main estimate path stays the same.</p></div>`;
  }
  return `<div class="card card--elevated anim-fade-in"><div class="context-panel-title">Basic mode</div><p class="context-panel-copy" style="margin-top:var(--sp-2)">This is the recommended path for most users. Estimate frequency, attacker strength, control strength, and cost ranges only. Switch to Advanced only if you need extra modelling controls.</p></div>`;
}

function renderEstimateQuickStartBlock(draft, recommendedPresetKey) {
  const nextAction = renderEstimateActionCard(draft, recommendedPresetKey);
  const directStart = `<div class="card card--elevated anim-fade-in"><div class="wizard-premium-head"><div><div class="context-panel-title">Basic estimation path</div><p class="context-panel-copy" style="margin-top:var(--sp-2)">Most users only need the three sections below: frequency, exposure, and cost.</p></div><span class="badge badge--gold">Default path</span></div><div class="context-panel-foot" style="margin-top:12px">If the AI values look broadly right, change only the numbers you want to challenge. Good enough to continue means you can explain the expected case in plain English.</div></div>`;
  return `${renderStep3FocusNudge(draft)}${nextAction}${directStart}`;
}

function humanizeEstimateValidationMessage(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  if (/min.*likely.*max/i.test(text)) return 'One of the ranges is out of order. Keep each row in low, expected, severe order.';
  if (/frequency|tef/i.test(text)) return 'The event frequency range needs a realistic low, expected, and severe annual case.';
  if (/threat|control|vuln|prob/i.test(text)) return 'The exposure inputs need a sensible 0 to 1 range with the expected case between low and high.';
  if (/iteration/i.test(text)) return 'The simulation settings need a safer iteration count for a pilot run.';
  if (/correlation/i.test(text)) return 'One of the correlation settings is out of bounds. Keep correlations between -1 and 1.';
  return text;
}

function renderEstimateHandoffCard(draft) {
  const narrative = String(draft.enhancedNarrative || draft.narrative || '').trim();
  const scenarioGeographies = getScenarioGeographies();
  const selectedRisks = getSelectedRisks();
  const structured = normaliseStructuredScenario(draft.structuredScenario, { preserveUnknown: true }) || {};
  const scopeItems = [
    structured.assetService ? `Asset / service: ${structured.assetService}` : '',
    structured.eventPath ? `Event path: ${structured.eventPath}` : '',
    scenarioGeographies.length ? `Geography: ${scenarioGeographies.join(', ')}` : '',
    selectedRisks.length ? `Selected risks: ${selectedRisks.slice(0, 3).map(risk => risk.title).join(', ')}` : ''
  ].filter(Boolean);
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">Before you adjust the numbers</div>
    <p class="context-panel-copy" style="margin-top:var(--sp-2)">You are now estimating the scenario you just described, not starting over from scratch.</p>
    ${scopeItems.length ? `<div class="citation-chips" style="margin-top:var(--sp-3)">${scopeItems.map(item => `<span class="badge badge--neutral">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
    <div class="context-panel-foot" style="margin-top:var(--sp-3)">${narrative ? `Working narrative: ${escapeHtml(truncateText(narrative, 220))}` : 'If the scenario still feels vague, go back one step and tighten the wording before you spend time on numbers.'}</div>
  </div>`;
}

function renderEstimateScopeSummaryBand(draft) {
  const scenarioGeographies = getScenarioGeographies();
  const selectedRisks = getSelectedRisks();
  const structured = normaliseStructuredScenario(draft.structuredScenario, { preserveUnknown: true }) || {};
  const scopeItems = [
    structured.assetService ? `Asset / service: ${structured.assetService}` : '',
    structured.eventPath ? `Event path: ${structured.eventPath}` : '',
    scenarioGeographies.length ? `Geography: ${scenarioGeographies.join(', ')}` : '',
    selectedRisks.length ? `Selected risks: ${selectedRisks.slice(0, 3).map(risk => risk.title).join(', ')}` : ''
  ].filter(Boolean);
  const narrative = String(draft.enhancedNarrative || draft.narrative || '').trim();
  return `<div class="wizard-summary-band wizard-summary-band--quiet anim-fade-in">
    <div>
      <div class="wizard-summary-band__label">Scenario handoff</div>
      <strong>${escapeHtml(String(draft.scenarioTitle || 'Working scenario'))}</strong>
      <div class="wizard-summary-band__copy">${escapeHtml(narrative ? truncateText(narrative, 180) : 'The estimate uses the scenario wording from the previous step. Go back only if the narrative still feels vague.')}</div>
    </div>
    <div class="wizard-summary-band__meta">
      ${scopeItems.slice(0, 3).map(item => `<span class="badge badge--neutral">${escapeHtml(item)}</span>`).join('')}
    </div>
  </div>`;
}

function renderEstimateReadinessCard(draft, validation) {
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings.map(humanizeEstimateValidationMessage).filter(Boolean) : [];
  const errors = Array.isArray(validation?.errors) ? validation.errors.map(humanizeEstimateValidationMessage).filter(Boolean) : [];
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
  const missingInfo = trust.missingInformation.slice(0, 2);
  const strongestChecks = [];
  if (trust.topGap) strongestChecks.push(`Best evidence gap to close: ${trust.topGap}`);
  strongestChecks.push('Start with the biggest cost rows first: response, disruption, and any data or legal impact that clearly applies.');
  strongestChecks.push('If you are unsure, keep the expected case defensible and make the severe case bad but still plausible.');
  const items = errors.length ? errors : warnings;
  return `<div class="card card--elevated anim-fade-in">
    <div class="context-panel-title">Estimate readiness</div>
    <div class="context-grid" style="margin-top:var(--sp-4)">
      <div class="context-chip-panel">
        <div class="context-panel-title">Strong enough to continue when</div>
        <p class="context-panel-copy">You can explain the expected case, and the low and severe cases are intentionally wider than that planning case.</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Tighten first</div>
        <p class="context-panel-copy">${escapeHtml(items[0] || 'No obvious model contradictions are showing yet. Review the expected case and adjust only what you want to challenge.')}</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Most useful next check</div>
        <p class="context-panel-copy">${escapeHtml(strongestChecks[0])}</p>
      </div>
    </div>
    ${(errors.length || warnings.length || missingInfo.length) ? `<div class="context-panel-foot" style="margin-top:var(--sp-4)">${escapeHtml([...items.slice(0, 2), ...missingInfo.slice(0, 1)].join(' '))}</div>` : '' }
  </div>`;
}

function renderQuantReadinessScoreCard(draft, validation) {
  const readiness = buildQuantReadinessModel({
    draft,
    validation,
    selectedRisks: getSelectedRisks()
  });
  return `<div class="card card--elevated anim-fade-in">
    <div class="wizard-premium-head">
      <div>
        <div class="context-panel-title">Quant readiness</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">This is a quick trust check before the run, not a gate. It shows whether the scenario, evidence, and main estimate ranges are grounded enough for a useful result.</p>
      </div>
      <span class="badge badge--${readiness.tone}">${readiness.status}</span>
    </div>
    <div class="quant-readiness-hero quant-readiness-hero--${readiness.tone}">
      <div class="quant-readiness-score">${readiness.totalScore}</div>
      <div class="quant-readiness-copy">
        <strong>${readiness.status}</strong>
        <span>${escapeHtml(readiness.nextFocus)}</span>
      </div>
    </div>
    <div class="quant-readiness-grid">
      ${readiness.factors.map(item => `<div class="quant-readiness-card">
        <div class="quant-readiness-card__label">${escapeHtml(item.label)}</div>
        <strong>${escapeHtml(item.value)}</strong>
        <span>${escapeHtml(item.copy)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderEstimateSourceAtGlance(draft) {
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
  if (!trust.inputOriginMix.total && !trust.citationCount && !trust.missingInformation.length && !draft.confidenceLabel) return '';
  const body = `
    <div class="wizard-premium-head">
      <div>
        <div class="context-panel-title">What is informing the model</div>
        <p class="context-panel-copy" style="margin-top:var(--sp-2)">This estimate stays transparent: you can see whether it is mainly AI-seeded, benchmark-guided, or supported by documents and scenario evidence.</p>
      </div>
      <span class="badge badge--neutral">${escapeHtml(trust.confidenceLabel)}</span>
    </div>
    <div class="context-grid" style="margin-top:var(--sp-4)">
      <div class="context-chip-panel">
        <div class="context-panel-title">Seeded inputs</div>
        <p class="context-panel-copy">${trust.inputOriginMix.total ? `${trust.inputOriginMix.total} tracked input source${trust.inputOriginMix.total === 1 ? '' : 's'} are attached to this estimate.` : 'No tracked source summary is attached yet.'}</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Source material</div>
        <p class="context-panel-copy">${trust.citationCount ? `${trust.citationCount} supporting citation${trust.citationCount === 1 ? '' : 's'} are linked to the scenario context.` : 'No named supporting source is attached yet.'}</p>
      </div>
      <div class="context-chip-panel">
        <div class="context-panel-title">Best next challenge</div>
        <p class="context-panel-copy">${escapeHtml(trust.topGap || 'Challenge the expected case first, then widen the low and severe cases deliberately.')}</p>
      </div>
    </div>
  `;
  return UI.disclosureSection({
    title: 'What is informing the model',
    badgeLabel: 'Trust detail',
    badgeTone: 'neutral',
    open: false,
    className: 'wizard-disclosure card card--elevated anim-fade-in',
    body
  });
}

function renderEstimateSecondaryContextWorkbench(draft) {
  const contextParts = [];
  if (draft.learningNote) {
    contextParts.push(`<div class="wizard-summary-band wizard-summary-band--quiet">
      <div>
        <div class="wizard-summary-band__label">Template learning</div>
        <strong>Starting point guidance</strong>
        <div class="wizard-summary-band__copy">${escapeHtml(draft.learningNote)}</div>
      </div>
    </div>`);
  }
  const orgCalibration = renderOrgCalibrationBand(draft);
  if (orgCalibration) contextParts.push(orgCalibration);
  const scopeSummary = renderEstimateScopeSummaryBand(draft);
  if (scopeSummary) contextParts.push(scopeSummary);
  if (!contextParts.length) return '';
  return UI.disclosureSection({
    title: 'Review handoff, scope, and calibration only if needed',
    badgeLabel: 'Optional detail',
    badgeTone: 'neutral',
    open: false,
    className: 'wizard-disclosure card card--elevated wizard-secondary-workbench anim-fade-in',
    body: contextParts.join('')
  });
}

function renderEstimateFocusStrip(draft, isAdv, validation, baselineAssessment) {
  const warnings = Array.isArray(validation?.warnings) ? validation.warnings.map(humanizeEstimateValidationMessage).filter(Boolean) : [];
  const modeLabel = isAdv ? 'Advanced mode' : 'Basic mode';
  const confidenceLabel = String(draft.confidenceLabel || '').trim() || 'Working estimate';
  return `<div class="wizard-focus-strip anim-fade-in">
    <div class="wizard-focus-card wizard-focus-card--wide">
      <span class="wizard-focus-card__label">Step goal</span>
      <strong>Build a defensible range, not a false sense of precision.</strong>
      <span>${warnings[0] ? escapeHtml(warnings[0]) : 'Start with the expected case, widen low and severe cases intentionally, and only open advanced controls when you need them.'}</span>
    </div>
    <div class="wizard-focus-card">
      <span class="wizard-focus-card__label">Current lane</span>
      <strong>${modeLabel}</strong>
      <span>${isAdv ? 'Direct exposure, follow-on impact, and simulation tuning are available.' : 'Most users should stay here and estimate in plain language first.'}</span>
    </div>
    <div class="wizard-focus-card">
      <span class="wizard-focus-card__label">Trust signal</span>
      <strong>${escapeHtml(confidenceLabel)}</strong>
      <span>${baselineAssessment ? 'You are testing a treatment case against a locked baseline.' : 'This run will stay reproducible and challengeable after save.'}</span>
    </div>
  </div>`;
}


function renderEstimateSourceSummary(draft) {
  const items = Array.isArray(draft.inputAssignments) ? draft.inputAssignments.slice(0, 6) : [];
  if (!items.length) return '';
  return `<div class="card card--elevated anim-fade-in"><div class="context-panel-title">Where these starting numbers came from</div><div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3)">${items.map(item => `<div style="background:var(--bg-elevated);padding:var(--sp-4);border-radius:var(--radius-lg)"><div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap"><strong style="font-size:.85rem;color:var(--text-primary)">${escapeHtml(String(item.label || 'Input'))}</strong><span class="badge badge--neutral">${escapeHtml(String(item.origin || 'AI estimate'))}</span>${item.sourceTypeLabel ? `<span class="badge badge--gold">${escapeHtml(String(item.sourceTypeLabel))}</span>` : ''}${item.confidenceLabel ? `<span class="badge badge--success">${escapeHtml(String(item.confidenceLabel))}</span>` : ''}</div><div class="context-panel-copy" style="margin-top:6px">${escapeHtml(String(item.reason || 'Prepared from current AI context.'))}</div></div>`).join('')}</div></div>`;
}

function markFairInputSource(inputKey, sourceKind) {
  const draft = AppState.draft;
  draft.fairParamOrigins = { ...(draft.fairParamOrigins || {}), [inputKey]: sourceKind };
}

function _ensureDraftFairParamsSeeded(draft) {
  if (!draft) return;
  const businessUnit = getBUList().find(bu => bu.id === draft.buId) || null;
  const defaults = businessUnit?.defaultAssumptions || {};
  const selectedRisks = getSelectedRisks();
  const query = [
    draft.scenarioTitle,
    draft.enhancedNarrative,
    draft.narrative,
    getStructuredScenarioField(draft.structuredScenario, 'eventPath'),
    getStructuredScenarioField(draft.structuredScenario, 'primaryDriver'),
    getStructuredScenarioField(draft.structuredScenario, 'effect'),
    ...selectedRisks.map(risk => risk.title || '')
  ].filter(Boolean).join(' ');
  const benchmarkCandidates = BenchmarkService.retrieveRelevantBenchmarks({
    query,
    geography: formatScenarioGeographies(getScenarioGeographies()),
    businessUnit,
    topK: 3
  });
  const suggested = BenchmarkService.deriveSuggestedInputs(benchmarkCandidates) || {};
  const loss = suggested.lossComponents || {};
  const p = draft.fairParams || (draft.fairParams = {});
  const assignRange = (prefix, suggestedRange, defaultRange, hardDefault) => {
    const currentValues = [p[`${prefix}Min`], p[`${prefix}Likely`], p[`${prefix}Max`]].map(value => Number(value));
    const hasCurrent = currentValues.some(value => Number.isFinite(value) && value > 0);
    if (hasCurrent) return;
    const source = suggestedRange || defaultRange || hardDefault;
    if (!source) return;
    const min = Number(source.min ?? hardDefault?.min ?? 0);
    const likely = Number(source.likely ?? hardDefault?.likely ?? min);
    const max = Number(source.max ?? hardDefault?.max ?? likely);
    const ordered = [min, likely, max].sort((a, b) => a - b);
    p[`${prefix}Min`] = ordered[0];
    p[`${prefix}Likely`] = ordered[1];
    p[`${prefix}Max`] = ordered[2];
  };

  assignRange('tef', suggested.TEF, defaults.TEF, { min: 0.5, likely: 2, max: 8 });
  assignRange('threatCap', suggested.threatCapability, defaults.threatCapability, { min: 0.45, likely: 0.62, max: 0.82 });
  assignRange('controlStr', suggested.controlStrength, defaults.controlStrength, { min: 0.5, likely: 0.68, max: 0.85 });
  assignRange('ir', loss.incidentResponse, defaults.incidentResponse, { min: 50000, likely: 180000, max: 600000 });
  assignRange('bi', loss.businessInterruption, defaults.businessInterruption, { min: 100000, likely: 450000, max: 2500000 });
  assignRange('db', loss.dataBreachRemediation, defaults.dataBreachRemediation, { min: 30000, likely: 120000, max: 500000 });
  assignRange('rl', loss.regulatoryLegal, defaults.regulatoryLegal, { min: 0, likely: 80000, max: 800000 });
  assignRange('tp', loss.thirdPartyLiability, defaults.thirdPartyLiability, { min: 0, likely: 50000, max: 400000 });
  assignRange('rc', loss.reputationContract, defaults.reputationContract, { min: 50000, likely: 200000, max: 1200000 });

  if ((!draft.benchmarkReferences || !draft.benchmarkReferences.length) && benchmarkCandidates.length) {
    draft.benchmarkReferences = BenchmarkService.buildReferenceList(benchmarkCandidates);
  }
  if (!String(draft.benchmarkBasis || '').trim() && benchmarkCandidates.length) {
    draft.benchmarkBasis = BenchmarkService.summariseBenchmarkBasis(benchmarkCandidates);
  }
  if ((!draft.inputProvenance || !draft.inputProvenance.length) && benchmarkCandidates.length) {
    draft.inputProvenance = BenchmarkService.buildInputProvenance(benchmarkCandidates);
  }
}

function renderEstimateBackgroundDetails(draft, bu, isAdv, cur, sym) {
  const guidance = draft.workflowGuidance?.length ? renderWorkflowGuidanceBlock(draft.workflowGuidance) : '';
  const evidence = renderEvidenceQualityBlock(draft.confidenceLabel, draft.evidenceQuality, draft.evidenceSummary, draft.missingInformation, 'AI Evidence Quality', { primaryGrounding: draft.primaryGrounding, supportingReferences: draft.supportingReferences, inferredAssumptions: draft.inferredAssumptions });
  const benchmark = renderBenchmarkRationaleBlock(draft.benchmarkBasis, draft.inputRationale, draft.benchmarkReferences);
  const provenance = renderInputProvenanceBlock(draft.inputProvenance);
  const explainer = renderEstimateExplainerCard(draft, bu, isAdv, cur);
  const sources = renderEstimateSourceSummary(draft);
  return UI.disclosureSection({
    title: 'Why these starting numbers look like this',
    badgeLabel: 'Optional detail',
    badgeTone: 'neutral',
    open: false,
    className: 'wizard-disclosure card card--elevated anim-fade-in',
    body: `${sources}${guidance}${evidence}${benchmark}${provenance}${explainer}`
  });
}

function renderEstimateOptionalHelpDetails(draft, sym) {
  return UI.disclosureSection({
    title: 'Examples and optional help',
    badgeLabel: 'Optional',
    badgeTone: 'neutral',
    open: false,
    className: 'wizard-disclosure card card--elevated anim-fade-in',
    body: `${UI.contextInfoGrid({
    title: 'How to complete this step',
    className: 'card card--elevated wizard-nested-card',
    panels: [
      UI.contextInfoPanel({ title: '1. Start with the suggested values', copy: 'If the suggested values look broadly right, adjust only the values you have evidence for.' }),
      UI.contextInfoPanel({ title: '2. Think in ranges, not exact numbers', copy: 'Use a low, expected, and severe case. You do not need one perfect number.' }),
      UI.contextInfoPanel({ title: '3. Use Advanced only when needed', copy: 'Advanced mode is only for direct exposure, follow-on impact, and simulation tuning. Most users should stay in Basic.' })
    ]
  })}${renderEstimateRangeThinkingGuide()}${renderRangeCalibrationCard(sym)}${renderEstimatePresetCard(draft)}`
  });
}

function renderEstimateRangeThinkingGuide() {
  return UI.disclosureSection({
    title: 'How to think about these inputs',
    badgeLabel: 'Plain-English guide',
    badgeTone: 'neutral',
    open: false,
    className: 'wizard-disclosure wizard-disclosure--nested wizard-modeling-guide',
    body: `
      <div class="wizard-modeling-guide__intro">Use this when you know the real-world conditions but are not sure how they should move the estimate. The question is usually not “what number is right?” but “does this make the event more likely, easier to stop, or more expensive if it happens?”</div>
      <div class="wizard-modeling-guide__grid">
        <div class="wizard-modeling-guide__card">
          <div class="wizard-modeling-guide__label">What usually changes control strength</div>
          <strong>MFA, segmentation, detection, and disciplined response usually help here.</strong>
          <p>MFA on privileged users, real network segmentation, strong detection coverage, and a capable response team usually improve control strength. Weak monitoring, poor asset inventory, and controls that only exist on paper usually weaken it.</p>
        </div>
        <div class="wizard-modeling-guide__card">
          <div class="wizard-modeling-guide__label">What usually changes impact and loss</div>
          <strong>Backups, resilience, contracts, and recovery capability usually affect cost more than threat capability.</strong>
          <p>Strong backups and practiced recovery lower disruption ranges. Vendor contracts may reduce legal or compensation tail risk, but they do not automatically reduce outage frequency.</p>
        </div>
        <div class="wizard-modeling-guide__card">
          <div class="wizard-modeling-guide__label">What usually changes confidence</div>
          <strong>Evidence quality is about how much you can defend the estimate, not how polished the wording sounds.</strong>
          <p>If you have direct operating evidence, incident history, finance input, or named sources, confidence improves. If the control is assumed rather than evidenced, keep confidence lower even if the scenario feels plausible.</p>
        </div>
      </div>
      <details class="wizard-disclosure wizard-disclosure--nested wizard-modeling-guide__examples">
        <summary>Show practical examples</summary>
        <div class="wizard-disclosure-body">
          <div class="wizard-modeling-guide__example-list">
            <div class="wizard-modeling-guide__example">
              <strong>Unpatched server, but EDR is in place</strong>
              <p>Do not lower threat capability. Keep exposure meaningful because the weakness is still exploitable. EDR may improve control strength and reduce disruption duration if it is well used.</p>
            </div>
            <div class="wizard-modeling-guide__example">
              <strong>Strong backups</strong>
              <p>Usually lower business interruption and recovery cost. They do not automatically lower event frequency.</p>
            </div>
            <div class="wizard-modeling-guide__example">
              <strong>MFA on privileged users</strong>
              <p>Usually improves control strength materially for identity-led scenarios and can justify a lower expected success rate.</p>
            </div>
            <div class="wizard-modeling-guide__example">
              <strong>Weak monitoring or poor asset inventory</strong>
              <p>Usually weakens control strength and confidence because the event may spread or persist longer than assumed.</p>
            </div>
            <div class="wizard-modeling-guide__example">
              <strong>Vendor dependency with contractual controls</strong>
              <p>May help secondary loss or legal recovery, but does not necessarily reduce the immediate outage or operational impact.</p>
            </div>
          </div>
        </div>
      </details>
    `
  });
}

function renderExposureModelingTip() {
  return `<details class="wizard-disclosure wizard-disclosure--nested wizard-modeling-tip">
    <summary>How to think about attacker capability and control strength <span class="badge badge--neutral">Plain English</span></summary>
    <div class="wizard-disclosure-body">
      <div class="wizard-modeling-tip__grid">
        <div class="wizard-modeling-tip__card">
          <strong>Usually raises exposure</strong>
          <p>Unpatched assets, weak monitoring, poor asset inventory, and controls that are inconsistent or untested.</p>
        </div>
        <div class="wizard-modeling-tip__card">
          <strong>Usually improves control strength</strong>
          <p>MFA on privileged users, well-operated segmentation, strong detection, and a response team that can actually contain the event.</p>
        </div>
      </div>
      <div class="form-help">Common mistake: lowering threat capability because your controls are strong. Threat capability is about the attacker or event source. Controls usually change how well you resist or contain it.</div>
    </div>
  </details>`;
}

function renderLossModelingTip(sym) {
  return `<details class="wizard-disclosure wizard-disclosure--nested wizard-modeling-tip">
    <summary>How to think about impact, secondary loss, and confidence <span class="badge badge--neutral">Plain English</span></summary>
    <div class="wizard-disclosure-body">
      <div class="wizard-modeling-tip__grid">
        <div class="wizard-modeling-tip__card">
          <strong>What usually lowers disruption cost</strong>
          <p>Strong backups, resilience engineering, and an incident team that can restore service quickly usually reduce the interruption range in ${sym}.</p>
        </div>
        <div class="wizard-modeling-tip__card">
          <strong>What usually affects secondary loss</strong>
          <p>Regulatory exposure, contracts, customer obligations, and dependency chains often change the legal, partner, or reputation tail more than the immediate event frequency.</p>
        </div>
      </div>
      <div class="form-help">If you only know that a control exists on paper, keep confidence lower than you would if you had evidence that it is working in practice.</div>
    </div>
  </details>`;
}

function renderAdvancedTuningWorkspace(p, sym) {
  return UI.disclosureSection({
    title: 'Advanced tuning workspace',
    badgeLabel: 'Advanced',
    badgeTone: 'neutral',
    open: !!p.secondaryEnabled,
    className: 'wizard-disclosure card card--elevated anim-fade-in',
    body: `
      <div class="wizard-summary-band wizard-summary-band--quiet">
        <div>
          <div class="wizard-summary-band__label">When to open this</div>
          <strong>Only when the core estimate is already defensible.</strong>
          <div class="wizard-summary-band__copy">Use this layer for follow-on impact, direct exposure, and reproducibility tuning. Most users can keep the main estimate in basic form and still reach a strong result.</div>
        </div>
        <div class="wizard-summary-band__meta">
          <span class="badge badge--neutral">${p.vulnDirect ? 'Direct exposure on' : 'Derived exposure'}</span>
          <span class="badge badge--neutral">${p.secondaryEnabled ? 'Follow-on impact enabled' : 'Follow-on impact off'}</span>
        </div>
      </div>
      ${UI.disclosureSection({
        title: 'Follow-on impact',
        badgeLabel: 'Optional',
        badgeTone: 'neutral',
        open: !!p.secondaryEnabled,
        className: 'wizard-disclosure wizard-disclosure--nested',
        body: `
          <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:var(--sp-4)">Use this only if the main event could trigger a second loss, such as a lawsuit, large partner claim, or wider business consequence.</p>
          <div class="flex items-center justify-between mb-4">
            <div class="form-help">Include a follow-on impact in the simulation</div>
            <label class="toggle"><input type="checkbox" id="secondary-toggle" ${p.secondaryEnabled?'checked':''}><div class="toggle-track"></div></label>
          </div>
          <div id="secondary-inputs" ${!p.secondaryEnabled?'class="hidden"':''}>
            <div class="grid-2">
              <div class="wizard-subsection"><p class="wizard-subsection-copy">How likely is the follow-on impact? Use 0 to 1.</p>${tripleInput('secProb','Secondary probability', p.secProbMin ?? 0.1, p.secProbLikely ?? 0.3, p.secProbMax ?? 0.7, { minLabel: 'Low chance', likelyLabel: 'Expected chance', maxLabel: 'High chance' })}</div>
              <div class="wizard-subsection"><p class="wizard-subsection-copy">If it happens, how large could that extra impact be in ${sym}?</p>${tripleInput('secMag','Secondary magnitude', p.secMagMin ?? 100000, p.secMagLikely ?? 500000, p.secMagMax ?? 2000000, { minLabel: 'Low cost', likelyLabel: 'Expected cost', maxLabel: 'High cost', money: true, inputType: 'text' })}</div>
            </div>
          </div>
        `
      })}
      ${UI.disclosureSection({
        title: 'Simulation tuning',
        badgeLabel: 'Optional',
        badgeTone: 'neutral',
        open: false,
        className: 'wizard-disclosure wizard-disclosure--nested',
        body: `
          <div class="wizard-advanced-grid">
            ${UI.disclosureSection({
              title: 'Distribution and iterations',
              badgeLabel: 'Core tuning',
              badgeTone: 'neutral',
              open: false,
              className: 'wizard-disclosure wizard-disclosure--nested',
              body: `<div class="wizard-advanced-card">
                <div class="wizard-advanced-card__label">Committee-grade rerun settings</div>
                <div class="wizard-advanced-card__copy">Use the default settings unless you need heavier-tail modelling or a higher-confidence rerun for committee review.</div>
                <div class="grid-2" style="margin-top:var(--sp-4)">
                  <div class="form-group">
                    <label class="form-label">Distribution Type <span data-tooltip="Triangular: intuitive. Lognormal: heavier right tail (better for cyber)." style="cursor:help;color:var(--color-accent-300)">ⓘ</span></label>
                    <select class="form-select" id="adv-dist">
                      <option value="triangular" ${(p.distType||'triangular')==='triangular'?'selected':''}>Triangular</option>
                      <option value="lognormal" ${p.distType==='lognormal'?'selected':''}>Lognormal</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Iterations</label>
                    <input class="form-input" id="adv-iter" type="number" min="1000" max="100000" step="1000" value="${p.iterations||10000}">
                  </div>
                </div>
              </div>`
            })}
            ${UI.disclosureSection({
              title: 'Reproducibility and relationships',
              badgeLabel: 'Only if justified',
              badgeTone: 'neutral',
              open: false,
              className: 'wizard-disclosure wizard-disclosure--nested',
              body: `<div class="wizard-advanced-card">
                <div class="wizard-advanced-card__label">Repeatability and correlations</div>
                <div class="wizard-advanced-card__copy">Save a seed only when you need repeatability. Change correlations only if you can justify the relationship between the cost components.</div>
                <div class="grid-2" style="margin-top:var(--sp-4)">
                  <div class="form-group">
                    <label class="form-label">Random Seed <span class="text-muted text-xs">(reproducibility)</span></label>
                    <input class="form-input" id="adv-seed" type="number" placeholder="Leave empty for random" value="${p.seed||''}">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Correlations <span data-tooltip="BI-IR: Business Interruption & IR correlation. RL-RC: Regulatory & Reputation." style="cursor:help;color:var(--color-accent-300)">ⓘ</span></label>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
                      <label style="font-size:.72rem;color:var(--text-muted)">BI↔IR</label>
                      <input class="form-input" id="corr-bi-ir" type="number" min="-1" max="1" step="0.05" value="${p.corrBiIr||0.3}" style="width:72px">
                      <label style="font-size:.72rem;color:var(--text-muted)">Reg↔Rep</label>
                      <input class="form-input" id="corr-rl-rc" type="number" min="-1" max="1" step="0.05" value="${p.corrRlRc||0.2}" style="width:72px">
                    </div>
                  </div>
                </div>
              </div>`
            })}
          </div>
        `
      })}
    `
  });
}

function renderWizard3() {
  const draft = AppState.draft;
  _ensureDraftFairParamsSeeded(draft);
  const p = draft.fairParams || {};
  const bu = getBUList().find(b => b.id === draft.buId);
  const da = bu?.defaultAssumptions || {};
  const isAdv = AppState.mode === 'advanced';
  const cur = AppState.currency;
  const sym = cur;
  const baselineAssessment = draft.comparisonBaselineId ? getAssessmentById(draft.comparisonBaselineId) : null;
  const baselineTitle = baselineAssessment
    ? (typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle(baselineAssessment)
      : String(baselineAssessment?.scenarioTitle || 'the original assessment').trim())
    : '';
  const inlineExamples = renderInlineEstimateExamples(sym);
  const recommendedPresetKey = recommendEstimatePreset(draft);
  const validation = validateFairParams(buildSimulationRunPayload(), { toast: false });

  const v = (key, def) => p[key] != null ? p[key] : def;

  setPage(`
    <main class="page" aria-label="Step 3: Estimate the Scenario">
      <div class="wizard-layout container container--narrow">
        <div class="wizard-header">
          ${UI.renderStepper(3)}
          <div class="flex items-center justify-between">
            <div>
              <h2 class="wizard-step-title">Estimate the Scenario in Plain Language</h2>
              <p class="wizard-step-desc">Sense-check the suggested numbers, adjust only what you want to challenge, and keep Advanced closed unless you need direct exposure, follow-on loss, or simulation tuning.${draft.llmAssisted ? ' Suggested values are already loaded.' : ''}</p>
              <div class="form-help" data-draft-save-state style="margin-top:10px">Draft saves automatically</div>
              ${draft.llmAssisted ? renderPilotWarningBanner('ai', { compact: true }) : ''}
              ${/low/i.test(String(draft.confidenceLabel || '')) || (Array.isArray(draft.missingInformation) && draft.missingInformation.length) ? renderPilotWarningBanner('lowConfidence', {
                compact: true,
                text: Array.isArray(draft.missingInformation) && draft.missingInformation.length
                  ? `This estimate still depends on incomplete evidence. Best next gap to close: ${draft.missingInformation[0]}`
                  : undefined
              }) : ''}
            </div>
            <div class="mode-toggle">
              <button class="${!isAdv?'active':''}" id="mode-basic">Basic</button>
              <button class="${isAdv?'active':''}" id="mode-advanced">Advanced</button>
            </div>
          </div>
        </div>
        <div class="wizard-body">
          <section class="wizard-ia-section anim-fade-in">
            <div class="results-section-heading">Sanity-check the starting point</div>
            <div class="form-help" style="margin-top:8px">Check readiness and source quality first. Then work through the core estimate from frequency to impact.</div>
          </section>
          ${renderEstimateFocusStrip(draft, isAdv, validation, baselineAssessment)}
          ${renderEstimateSecondaryContextWorkbench(draft)}
          ${renderQuantReadinessScoreCard(draft, validation)}
          ${baselineAssessment ? `<div class="card card--elevated anim-fade-in"><div class="wizard-premium-head"><div><div class="context-panel-title">Current assessment baseline</div><p class="context-panel-copy">You are working from <strong>${escapeHtml(baselineTitle || 'the original assessment')}</strong>. Adjust the assumptions below to reflect stronger prevention, faster response, or lower disruption impact, then rerun to compare the new result against the current baseline.</p></div><span class="badge badge--gold">Treatment lane</span></div><div class="form-help" style="margin-top:10px">Baseline completed on ${new Date(baselineAssessment.completedAt || baselineAssessment.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })}.</div><div class="citation-chips" style="margin-top:12px"><button type="button" class="chip treatment-prompt-chip" data-treatment-prompt="control-strength">Try stronger controls</button><button type="button" class="chip treatment-prompt-chip" data-treatment-prompt="detection-response">Try faster detection</button><button type="button" class="chip treatment-prompt-chip" data-treatment-prompt="resilience">Try lower disruption impact</button></div><div class="form-group" style="margin-top:16px"><label class="form-label" for="treatment-improvement-request">Describe the better outcome you want to test</label><textarea class="form-textarea" id="treatment-improvement-request" rows="3" placeholder="e.g. stronger privileged-access controls, faster containment, better resilience, lower business disruption">${draft.treatmentImprovementRequest || ''}</textarea><span class="form-help">Describe the improvement in plain language and let AI adjust the copied baseline values before you simulate the new case.</span></div><div class="flex items-center gap-3" style="margin-top:12px;flex-wrap:wrap"><button class="btn btn--secondary" id="btn-treatment-ai-assist" type="button">AI Assist This Better Outcome</button><span class="form-help" id="treatment-improvement-status">${escapeHtml(getStep3TreatmentAssistStatusCopy(draft))}</span></div></div>` : ''}
          <section class="wizard-ia-section anim-fade-in">
            <div class="results-section-heading">Enter the core estimate</div>
            <div class="form-help" style="margin-top:8px">Work through frequency, exposure, and cost in that order. Open advanced sections only when they materially improve the model.</div>
          </section>

          ${UI.wizardInputSection({
            title: 'How often could this happen? <span data-tooltip="How many times per year this type of event could realistically occur." style="cursor:help;color:var(--color-accent-300);font-size:.8rem">ⓘ</span>',
            description: 'Enter the number of events you think could happen in a year. Use a cautious low case, your expected case, and a severe but plausible high case.',
            className: 'card anim-fade-in',
            headerExtras: UI.sectionStatusBadge('Required', 'gold'),
            body: `${inlineExamples.frequency}${tripleInput('tef','How often this could happen in a year', v('tefMin',da.TEF?.min||0.5), v('tefLikely',da.TEF?.likely||2), v('tefMax',da.TEF?.max||8), { minLabel: 'Low case', likelyLabel: 'Expected case', maxLabel: 'High case' })}`
          })}

          ${UI.wizardInputSection({
            title: 'How exposed are you if it happens? <span data-tooltip="This estimates how likely the event is to succeed given attacker capability and current controls." style="cursor:help;color:var(--color-accent-300);font-size:.8rem">ⓘ</span>',
            description: isAdv ? 'Advanced mode lets you enter exposure directly if you need it. Otherwise you can still use attacker strength and control strength.' : 'Basic mode uses two simpler questions: how capable the threat is and how strong your current controls are.',
            className: 'card anim-fade-in anim-delay-1',
            headerExtras: UI.sectionStatusBadge('Required', 'gold'),
            body: `${renderExposureModelingTip()}${isAdv?`<div class="flex items-center gap-3 mb-4"><label class="toggle"><input type="checkbox" id="vuln-direct-toggle" ${p.vulnDirect?'checked':''}><div class="toggle-track"></div></label><span class="toggle-label">Enter exposure directly</span></div>
            <div id="vuln-direct-section" ${!p.vulnDirect?'class="hidden"':''}>
              <p style="font-size:.78rem;color:var(--text-muted);margin-bottom:12px">Use a value between 0 and 1, where 0 means very unlikely to succeed and 1 means almost certain to succeed.</p>
              ${tripleInput('vuln','Vulnerability', v('vulnMin',0.1), v('vulnLikely',0.35), v('vulnMax',0.7), { minLabel: 'Low success chance', likelyLabel: 'Expected success chance', maxLabel: 'High success chance' })}
            </div>`:''}
            <div id="vuln-derived-section" ${isAdv&&p.vulnDirect?'class="hidden"':''}>
              <div class="grid-2">
                <div class="wizard-subsection">
                  <p class="wizard-subsection-copy">How capable is the attacker or threat source? 0 means weak or opportunistic, 1 means very capable and well resourced.</p>
                  ${tripleInput('threatCap','Threat capability', v('threatCapMin',da.threatCapability?.min||0.45), v('threatCapLikely',da.threatCapability?.likely||0.62), v('threatCapMax',da.threatCapability?.max||0.82), { minLabel: 'Low capability', likelyLabel: 'Expected capability', maxLabel: 'High capability' })}
                </div>
                <div class="wizard-subsection">
                  <p class="wizard-subsection-copy">How strong are your current preventive and detective controls? 0 means weak, 1 means strong and consistently effective.</p>
                  ${tripleInput('controlStr','Control strength', v('controlStrMin',da.controlStrength?.min||0.5), v('controlStrLikely',da.controlStrength?.likely||0.68), v('controlStrMax',da.controlStrength?.max||0.85), { minLabel: 'Weak controls', likelyLabel: 'Expected control strength', maxLabel: 'Strong controls' })}
                </div>
              </div>
            </div>`
          })}

          ${UI.wizardInputSection({
            title: 'What could this cost if it happens?',
            description: `For each cost area, enter a low, expected, and severe per-event estimate in ${sym}. These values are added together in the simulation.`,
            className: 'card anim-fade-in anim-delay-2',
            headerExtras: UI.sectionStatusBadge('Required', 'gold'),
            body: `${renderLossModelingTip(sym)}${inlineExamples.cost}<div class="wizard-cost-stack">
              <div class="wizard-cost-group">
                <div class="wizard-cost-group-label">Core costs</div>
                <div class="wizard-cost-group-copy">These are usually the biggest drivers and should be completed first.</div>
                <div style="display:flex;flex-direction:column;gap:var(--sp-5);margin-top:var(--sp-4)">
                  ${lossRow('ir','Response and recovery cost', v('irMin',da.incidentResponse?.min||50000), v('irLikely',da.incidentResponse?.likely||180000), v('irMax',da.incidentResponse?.max||600000), 'Containment, forensics, internal recovery effort, and external incident response support.')}
                  ${lossRow('bi','Business disruption cost', v('biMin',da.businessInterruption?.min||100000), v('biLikely',da.businessInterruption?.likely||450000), v('biMax',da.businessInterruption?.max||2500000), 'Lost revenue, delayed operations, and productivity impact while the issue is active.')}
                  ${lossRow('db','Data remediation cost', v('dbMin',da.dataBreachRemediation?.min||30000), v('dbLikely',da.dataBreachRemediation?.likely||120000), v('dbMax',da.dataBreachRemediation?.max||500000), 'Notification, monitoring, remediation, and cleanup when data is affected.')}
                </div>
              </div>
              ${UI.disclosureSection({
                title: 'Conditional cost areas',
                badgeLabel: 'Optional',
                badgeTone: 'neutral',
                open: false,
                body: `
                  <div class="wizard-cost-group">
                    <div class="wizard-cost-group-label">Conditional costs</div>
                    <div class="wizard-cost-group-copy">Only spend time here if these are realistic for your scenario.</div>
                    <div style="display:flex;flex-direction:column;gap:var(--sp-5);margin-top:var(--sp-4)">
                      ${lossRow('rl','Regulatory and legal cost', v('rlMin',da.regulatoryLegal?.min||0), v('rlLikely',da.regulatoryLegal?.likely||80000), v('rlMax',da.regulatoryLegal?.max||800000), 'Fines, legal support, regulatory response, and formal notices.')}
                      ${lossRow('tp','Third-party impact cost', v('tpMin',da.thirdPartyLiability?.min||0), v('tpLikely',da.thirdPartyLiability?.likely||50000), v('tpMax',da.thirdPartyLiability?.max||400000), 'Claims, service credits, or compensation for partners and customers.')}
                      ${lossRow('rc','Reputation and contract cost', v('rcMin',da.reputationContract?.min||50000), v('rcLikely',da.reputationContract?.likely||200000), v('rcMax',da.reputationContract?.max||1200000), 'Customer churn, commercial loss, and contract penalties after the event.')}
                    </div>
                  </div>
                `
              })}
            </div>`
          })}

          <section class="wizard-ia-section anim-fade-in">
            <div class="results-section-heading">Open advanced detail only if needed</div>
            <div class="form-help" style="margin-top:8px">These sections support challenge, calibration, and tuning. Most users can finish the estimate without opening all of them.</div>
          </section>

          ${UI.disclosureSection({
            title: 'Quick start, presets, and guidance',
            badgeLabel: 'Optional',
            badgeTone: 'neutral',
            open: false,
            className: 'wizard-disclosure card card--elevated anim-fade-in',
            body: `${renderEstimateQuickStartBlock(draft, recommendedPresetKey)}${renderEstimateModeNote(isAdv)}${renderEstimateSourceAtGlance(draft)}${renderEstimateOptionalHelpDetails(draft, sym)}`
          })}

          ${renderEstimateBackgroundDetails(draft, bu, isAdv, cur, sym)}

          ${isAdv ? renderAdvancedTuningWorkspace(p, sym) : ''}

        </div>
        <div class="wizard-footer">
          <button class="btn btn--ghost" id="btn-back-3">← Back</button>
          <button class="btn btn--primary" id="btn-next-3">Continue to Results →</button>
        </div>
      </div>
    </main>`);

  document.getElementById('mode-basic')?.addEventListener('click', () => { AppState.mode='basic'; renderWizard3(); });
  document.getElementById('mode-advanced')?.addEventListener('click', () => { AppState.mode='advanced'; renderWizard3(); });
  updateWizardSaveState();
  document.getElementById('secondary-toggle')?.addEventListener('change', function() {
    document.getElementById('secondary-inputs')?.classList.toggle('hidden', !this.checked);
    AppState.draft.fairParams.secondaryEnabled = this.checked;
    markDraftDirty();
    scheduleDraftAutosave();
  });
  document.getElementById('vuln-direct-toggle')?.addEventListener('change', function() {
    document.getElementById('vuln-direct-section')?.classList.toggle('hidden', !this.checked);
    document.getElementById('vuln-derived-section')?.classList.toggle('hidden', this.checked);
    AppState.draft.fairParams.vulnDirect = this.checked;
    markDraftDirty();
    scheduleDraftAutosave();
    renderWizard3();
  });
  attachFormattedMoneyInputs();
  bindFairRationaleChips();
  document.querySelectorAll('.fair-input, #adv-dist, #adv-iter, #adv-seed, #corr-bi-ir, #corr-rl-rc, #treatment-improvement-request').forEach(input => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      collectFairParams();
      if (input.id === 'treatment-improvement-request') {
        AppState.draft.treatmentImprovementRequest = input.value;
        AppState.draft.treatmentSuggestionMode = '';
      }
      markDraftDirty();
      scheduleDraftAutosave();
    });
  });
  function applySuggestedTreatmentInputs(suggestedInputs = {}) {
    const p = AppState.draft.fairParams || (AppState.draft.fairParams = {});
    const applyRange = (prefix, range) => {
      if (!range) return;
      if (Number.isFinite(Number(range.min))) p[`${prefix}Min`] = Number(range.min);
      if (Number.isFinite(Number(range.likely))) p[`${prefix}Likely`] = Number(range.likely);
      if (Number.isFinite(Number(range.max))) p[`${prefix}Max`] = Number(range.max);
    };
    applyRange('tef', suggestedInputs.TEF);
    applyRange('controlStr', suggestedInputs.controlStrength);
    applyRange('threatCap', suggestedInputs.threatCapability);
    applyRange('ir', suggestedInputs.lossComponents?.incidentResponse);
    applyRange('bi', suggestedInputs.lossComponents?.businessInterruption);
    applyRange('db', suggestedInputs.lossComponents?.dataBreachRemediation);
    applyRange('rl', suggestedInputs.lossComponents?.regulatoryLegal);
    applyRange('tp', suggestedInputs.lossComponents?.thirdPartyLiability);
    applyRange('rc', suggestedInputs.lossComponents?.reputationContract);
  }
  document.querySelectorAll('.treatment-prompt-chip').forEach(button => {
    button.addEventListener('click', () => {
      AppState.draft.treatmentSuggestionMode = '';
      applyTreatmentPrompt(button.dataset.treatmentPrompt);
      renderWizard3();
      UI.toast('Treatment prompt applied. Review the numbers and rerun the scenario.', 'success');
    });
  });

  document.querySelectorAll('.estimate-preset-chip').forEach(button => {
    button.addEventListener('click', () => {
      if (!applyEstimatePreset(button.dataset.estimatePreset)) return;
      saveDraft();
      renderWizard3();
      UI.toast('Example preset applied. Review and adjust the numbers to fit your case.', 'success');
    });
  });
  document.getElementById('btn-treatment-ai-assist')?.addEventListener('click', async () => {
    clearStep3AiUnavailableBanner();
    const requestEl = document.getElementById('treatment-improvement-request');
    const statusEl = document.getElementById('treatment-improvement-status');
    const request = requestEl?.value.trim() || '';
    if (!baselineAssessment) return;
    if (!request) {
      UI.toast('Describe the better outcome you want to test first.', 'warning');
      return;
    }
    AppState.draft.treatmentImprovementRequest = request;
    if (statusEl) statusEl.textContent = 'Using AI to adjust the copied baseline values…';
    const btn = document.getElementById('btn-treatment-ai-assist');
    const aiContext = buildCurrentAIAssistContext({ buId: draft.buId });
    const buContext = aiContext.businessUnit || getBUList().find(b => b.id === draft.buId) || bu || null;
    const conversationFingerprint = buildStep3ConversationFingerprint({
      draft,
      baselineAssessment,
      request
    });
    const requestPayload = {
      baselineAssessment,
      improvementRequest: request,
      businessUnit: buContext,
      adminSettings: aiContext.adminSettings,
      priorMessages: getStep3PriorMessages({ conversationFingerprint })
    };
    const remainingCooldownMs = _step3AiActionCooldowns
      ? _step3AiActionCooldowns.getRemainingMs('/api/ai/treatment-suggestion', requestPayload, { scope: `step3-treatment::${String(draft.id || draft.baselineAssessmentId || baselineAssessment?.id || '').trim()}` })
      : 0;
    if (remainingCooldownMs) {
      flashStep3AiActionCooldown(btn, 'Loaded just now', Math.min(remainingCooldownMs, 1400));
      if (statusEl) statusEl.textContent = 'The current better-outcome draft already reflects this request. Change the request or baseline inputs before rerunning.';
      UI.toast('This better-outcome draft already reflects the current request. Review it or change the inputs before rerunning.', 'info', 3500);
      return;
    }
    const resetBusy = setStep3AiActionBusy(btn, 'Adjusting…');
    try {
      const citations = await RAGService.retrieveRelevantDocs(draft.buId, buildAssessmentRetrievalQuery({
        narrative: `${baselineTitle || ''}\n${request}`,
        structuredScenario: draft.structuredScenario || baselineAssessment.structuredScenario,
        scenarioLens: draft.scenarioLens || baselineAssessment.scenarioLens,
        selectedRiskTitles: getSelectedRisks().map(risk => risk.title),
        applicableRegulations: draft.applicableRegulations || baselineAssessment.applicableRegulations || [],
        geography: draft.geography || baselineAssessment.geography || '',
        businessUnitName: draft.buName || baselineAssessment.buName || '',
        treatmentRequest: request
      }), 5);
      const result = await LLMService.suggestTreatmentImprovement({
        ...requestPayload,
        citations,
      });
      _step3AiActionCooldowns?.markCompleted('/api/ai/treatment-suggestion', requestPayload, { scope: `step3-treatment::${String(draft.id || draft.baselineAssessmentId || baselineAssessment?.id || '').trim()}` });
      const resultMode = String(result.mode || (result.usedFallback ? 'deterministic_fallback' : 'live')).trim().toLowerCase();
      if (resultMode !== 'manual') {
        applySuggestedTreatmentInputs(result.suggestedInputs || {});
      }
      AppState.draft.treatmentSuggestionMode = resultMode;
      AppState.draft.workflowGuidance = Array.isArray(result.workflowGuidance) ? result.workflowGuidance : (AppState.draft.workflowGuidance || []);
      AppState.draft.benchmarkBasis = result.benchmarkBasis || AppState.draft.benchmarkBasis || '';
      AppState.draft.inputRationale = result.inputRationale || AppState.draft.inputRationale || null;
      AppState.draft.confidenceLabel = result.confidenceLabel || AppState.draft.confidenceLabel || '';
      AppState.draft.evidenceQuality = result.evidenceQuality || AppState.draft.evidenceQuality || '';
      AppState.draft.evidenceSummary = result.evidenceSummary || AppState.draft.evidenceSummary || '';
      AppState.draft.primaryGrounding = Array.isArray(result.primaryGrounding) ? result.primaryGrounding : (AppState.draft.primaryGrounding || []);
      AppState.draft.supportingReferences = Array.isArray(result.supportingReferences) ? result.supportingReferences : (AppState.draft.supportingReferences || []);
      AppState.draft.inferredAssumptions = Array.isArray(result.inferredAssumptions) ? result.inferredAssumptions : (AppState.draft.inferredAssumptions || []);
      AppState.draft.missingInformation = Array.isArray(result.missingInformation) ? result.missingInformation : (AppState.draft.missingInformation || []);
      AppState.draft.citations = normaliseCitations(mergeCitationMetadata(result.citations || citations, citations));
      AppState.draft.learningNote = result.changesSummary || result.summary || '';
      appendStep3LlmContext(
        request,
        result.changesSummary || result.summary || 'Treatment improvement draft updated.',
        { conversationFingerprint }
      );
      saveDraft();
      renderWizard3();
      UI.toast(
        resultMode === 'manual'
          ? 'The better-outcome step stayed manual because the current baseline or request is incomplete.'
          : resultMode === 'deterministic_fallback'
            ? 'A deterministic fallback better-outcome draft was loaded. Review the numbers before rerunning.'
            : 'A live AI better-outcome draft was loaded. Review the numbers before rerunning.',
        resultMode === 'live' ? 'success' : 'warning',
        5000
      );
    } catch (error) {
      if (error?.code === 'LLM_UNAVAILABLE') {
        if (statusEl) statusEl.textContent = `${getStep3AiUnavailableMessage()} Keep the current values or try again.`;
        renderStep3AiUnavailableBanner(() => document.getElementById('btn-treatment-ai-assist')?.click());
      } else {
        if (statusEl) statusEl.textContent = 'AI could not update the values just now. Keep the current values or try again in a moment.';
        UI.toast('AI could not update the values. Try again in a moment.', 'danger');
      }
      resetBusy();
    }
  });
  document.getElementById('btn-back-3').addEventListener('click', () => { saveDraft(); Router.navigate('/wizard/2'); });
  document.getElementById('btn-next-3').addEventListener('click', () => {
    collectFairParams();
    if (!validateFairParams()) return;
    saveDraft(); Router.navigate('/wizard/4');
  });
}

function tripleInput(prefix, label, min, likely, max, labels = {}) {
  const minLabel = labels.minLabel || 'Min';
  const likelyLabel = labels.likelyLabel || 'Most Likely';
  const maxLabel = labels.maxLabel || 'Max';
  const inputType = labels.inputType || 'number';
  const inputClass = labels.money ? 'form-input fair-input money-input' : 'form-input fair-input';
  const stepAttr = inputType === 'number' ? ' step="any"' : '';
  const inputMode = labels.money ? 'decimal' : (labels.inputMode || 'decimal');
  const formatValue = value => labels.money ? formatCurrencyInputValue(value) : value;
  const currencyBadge = labels.money ? `<span class="range-col-currency">${getCurrencyPrefix()}</span>` : '';
  return `<div class="range-group">
    <div class="form-group"><div class="range-col-label">${minLabel}${currencyBadge}</div><input class="${inputClass}" id="${prefix}-min" data-key="${prefix}Min" data-money="${labels.money ? 'true' : 'false'}" type="${inputType}"${stepAttr} inputmode="${inputMode}" value="${formatValue(min)}" aria-label="${label} min"></div>
    <div class="form-group"><div class="range-col-label" style="color:var(--color-primary-300)">${likelyLabel}${currencyBadge}</div><input class="${inputClass}" id="${prefix}-likely" data-key="${prefix}Likely" data-money="${labels.money ? 'true' : 'false'}" type="${inputType}"${stepAttr} inputmode="${inputMode}" value="${formatValue(likely)}" aria-label="${label} likely"></div>
    <div class="form-group"><div class="range-col-label">${maxLabel}${currencyBadge}</div><input class="${inputClass}" id="${prefix}-max" data-key="${prefix}Max" data-money="${labels.money ? 'true' : 'false'}" type="${inputType}"${stepAttr} inputmode="${inputMode}" value="${formatValue(max)}" aria-label="${label} max"></div>
  </div>`;
}

function lossRow(prefix, label, min, likely, max, tooltip) {
  return `<div>
    <div style="font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:8px;display:flex;align-items:center;gap:6px">${label}<span data-tooltip="${tooltip}" style="cursor:help;color:var(--color-accent-300);font-size:.72rem">ⓘ</span></div>
    ${tripleInput(prefix, label, min, likely, max, { minLabel: 'Low cost', likelyLabel: 'Expected cost', maxLabel: 'Severe cost', money: true, inputType: 'text' })}
  </div>`;
}

function clearStep3AiUnavailableBanner() {
  document.querySelectorAll('.ai-unavailable-banner').forEach(node => node.remove());
}

function getStep3TreatmentAssistStatusCopy(draft = AppState.draft) {
  const mode = String(draft?.treatmentSuggestionMode || '').trim().toLowerCase();
  if (mode === 'live') {
    return 'Live AI adjusted the copied baseline values. You can still fine-tune every number manually before rerunning.';
  }
  if (mode === 'deterministic_fallback') {
    return 'Deterministic fallback adjusted the copied baseline values. Review the numbers before rerunning.';
  }
  if (mode === 'manual') {
    return 'The better-outcome step stayed manual because the current request or baseline data is incomplete.';
  }
  return 'These are quick starting points. You can still adjust every number manually before rerunning the analysis.';
}

function getStep3AiUnavailableMessage() {
  return typeof getAiUnavailableMessage === 'function'
    ? getAiUnavailableMessage()
    : 'AI assistance is temporarily unavailable.';
}

function renderStep3AiUnavailableBanner(retryHandler) {
  clearStep3AiUnavailableBanner();
  const statusEl = document.getElementById('treatment-improvement-status');
  const container = statusEl?.closest('.card') || statusEl?.parentElement;
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `<div class="ai-unavailable-banner banner banner--warning mt-4" role="alert"><span class="banner-icon">△</span><span class="banner-text">${escapeHtml(getStep3AiUnavailableMessage())} You can continue manually or <button class="link-btn" id="btn-retry-ai" type="button" style="appearance:none;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">try again</button>.</span></div>`);
  container.querySelector('#btn-retry-ai')?.addEventListener('click', event => {
    event.preventDefault();
    retryHandler();
  });
}

function collectFairParams() {
  const p = AppState.draft.fairParams;
  document.querySelectorAll('.fair-input').forEach(input => {
    const rawValue = parseFlexibleNumber(input.value);
    if (Number.isNaN(rawValue)) return;
    const val = input.dataset.money === 'true'
      ? convertDisplayCurrencyToUsd(rawValue)
      : rawValue;
    p[input.dataset.key] = val;
    markFairInputSource(input.dataset.key, 'user');
  });
  const dist = document.getElementById('adv-dist');
  const iter = document.getElementById('adv-iter');
  const seed = document.getElementById('adv-seed');
  const cbir = document.getElementById('corr-bi-ir');
  const crlr = document.getElementById('corr-rl-rc');
  if (dist) {
    p.distType = RiskEngine.constants.DIST_TYPES.includes(dist.value) ? dist.value : 'triangular';
    if (dist.value !== p.distType) dist.value = p.distType;
  }
  if (iter) {
    const parsedIterations = Number.parseInt(iter.value, 10) || RiskEngine.constants.DEFAULT_ITERATIONS;
    const safeIterations = Math.min(RiskEngine.constants.MAX_ITERATIONS, Math.max(RiskEngine.constants.MIN_ITERATIONS, parsedIterations));
    p.iterations = safeIterations;
    if (String(safeIterations) !== String(iter.value)) iter.value = String(safeIterations);
  }
  if (seed) {
    const parsedSeed = seed.value ? Number.parseInt(seed.value, 10) : null;
    p.seed = Number.isInteger(parsedSeed) ? parsedSeed : null;
    if (seed.value && p.seed == null) seed.value = '';
  }
  if (cbir) {
    p.corrBiIr = Math.max(-RiskEngine.constants.CORRELATION_LIMIT, Math.min(RiskEngine.constants.CORRELATION_LIMIT, parseFloat(cbir.value) || 0.3));
    cbir.value = String(p.corrBiIr);
  }
  if (crlr) {
    p.corrRlRc = Math.max(-RiskEngine.constants.CORRELATION_LIMIT, Math.min(RiskEngine.constants.CORRELATION_LIMIT, parseFloat(crlr.value) || 0.2));
    crlr.value = String(p.corrRlRc);
  }
  p.secondaryEnabled = document.getElementById('secondary-toggle')?.checked || false;
  p.distType = p.distType || 'triangular';
}
