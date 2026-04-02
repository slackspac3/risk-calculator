/**
 * llmService.js — LLM service (Core42 Compass + local stub)
 *
 * Compass API (proxied through Vercel by default):
 *   POST https://risk-calculator-eight.vercel.app/api/compass
 *   Authorization: Bearer <COMPASS_API_KEY>
 *
 * Do not hard-code real keys in this file.
 * Set them at runtime only for local testing, or call Compass through a secure proxy.
 */

const LLMService = (() => {
  const AI_MAX_RETRIES = 2;
  const AI_TIMEOUT_MS = 30000;
  const AI_QUALITY_GATE_MAX_PROMPT_CHARS = 22000;
  const AI_QUALITY_GATE_MAX_COMPLETION_TOKENS = 2200;

  function _guardrails() {
    return typeof AIGuardrails === 'object' && AIGuardrails ? AIGuardrails : null;
  }

  function _sanitizeAiText(value = '', { maxChars = 20000 } = {}) {
    const guardrails = _guardrails();
    if (guardrails?.sanitizeText) return guardrails.sanitizeText(value, { maxChars });
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
  }

  function _labelSuggestedDraft(value = '') {
    const guardrails = _guardrails();
    if (guardrails?.labelSuggested) return guardrails.labelSuggested(value);
    const text = _sanitizeAiText(value, { maxChars: 40000 });
    return text ? `Suggested draft: ${text}` : '';
  }

  function _buildPromptPayload(systemPrompt, userPrompt, options = {}) {
    const priorMessages = (Array.isArray(options.priorMessages) ? options.priorMessages : [])
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        role: String(item.role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user',
        content: _sanitizeAiText(item.content || '', { maxChars: 4000 })
      }))
      .filter(item => item.content)
      .slice(-20);
    const guardrails = _guardrails();
    if (guardrails?.buildPromptPayload) {
      return {
        ...guardrails.buildPromptPayload(systemPrompt, userPrompt, { maxChars: Number(options.maxPromptChars || 18000) }),
        priorMessages
      };
    }
    return {
      systemPrompt: _sanitizeAiText(systemPrompt, { maxChars: 6000 }),
      userPrompt: _sanitizeAiText(userPrompt, { maxChars: Number(options.maxPromptChars || 18000) }),
      truncated: false,
      priorMessages
    };
  }

  const AI_TRACE_STORAGE_KEY = 'rip_ai_trace';
  const AI_TRACE_LIMIT = 20;

  function _safeTraceText(value = '', maxChars = 16000) {
    return String(value || '').trim().slice(0, Math.max(0, Number(maxChars || 0) || 0));
  }

  function _normaliseTraceSources(sources = []) {
    return (Array.isArray(sources) ? sources : [])
      .filter(Boolean)
      .map((item) => ({
        title: _safeTraceText(item?.title || item?.label || item?.sourceTitle || 'Untitled source', 160),
        url: _safeTraceText(item?.url || '', 400),
        sourceType: _safeTraceText(item?.sourceType || '', 80),
        relevanceReason: _safeTraceText(item?.relevanceReason || '', 240)
      }))
      .filter((item) => item.title);
  }

  function _readAiTrace() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(AI_TRACE_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function _writeAiTrace(entries = []) {
    try {
      sessionStorage.setItem(AI_TRACE_STORAGE_KEY, JSON.stringify(entries));
    } catch {}
  }

  function _storeAiTraceEntry({ label = '', promptSummary = '', response = '', sources = [] } = {}) {
    const safeLabel = String(label || '').trim();
    if (!safeLabel) return null;
    const entry = {
      id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: safeLabel,
      timestamp: Date.now(),
      promptSummary: _safeTraceText(promptSummary, 12000),
      response: _safeTraceText(response, 20000),
      sources: _normaliseTraceSources(sources)
    };
    const next = _readAiTrace();
    next.push(entry);
    if (next.length > AI_TRACE_LIMIT) {
      next.splice(0, next.length - AI_TRACE_LIMIT);
    }
    _writeAiTrace(next);
    return entry;
  }

  function _getTraceSources(options = {}) {
    const explicitSources = _normaliseTraceSources(options.traceSources || []);
    if (explicitSources.length) return explicitSources;
    try {
      const windowSources = typeof window !== 'undefined' ? window._lastRagSources : [];
      return _normaliseTraceSources(windowSources || []);
    } catch {
      return [];
    }
  }

  function _buildTracePromptSummary(promptPayload = {}) {
    const priorMessages = Array.isArray(promptPayload.priorMessages) ? promptPayload.priorMessages : [];
    const priorSummary = priorMessages.length
      ? `Prior messages: ${priorMessages.map((item) => `${item.role}: ${item.content}`).join(' | ')}`
      : '';
    return _safeTraceText([
      `System: ${promptPayload.systemPrompt || ''}`,
      priorSummary,
      `User: ${promptPayload.userPrompt || ''}`
    ].filter(Boolean).join('\n\n'), 12000);
  }

  function getLatestTrace(label = '') {
    const safeLabel = String(label || '').trim();
    const entries = _readAiTrace();
    if (!safeLabel) return entries[entries.length - 1] || null;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (String(entries[index]?.label || '').trim() === safeLabel) {
        return entries[index];
      }
    }
    return null;
  }

  function _buildSourceBasis({ evidenceMeta = {}, citations = [], uploadedDocumentName = '', fallbackUsed = false } = {}) {
    const guardrails = _guardrails();
    if (guardrails?.buildSourceBasis) {
      return guardrails.buildSourceBasis({
        evidenceSummary: evidenceMeta?.summary || '',
        citations,
        uploadedDocumentName,
        fallbackUsed
      });
    }
    return [];
  }

  async function _auditAiEvent(eventType, status, details = {}) {
    try {
      if (typeof logAuditEvent !== 'function') return;
      await logAuditEvent({
        category: 'ai',
        eventType,
        target: details.target || 'ai_service',
        status: status || 'success',
        source: 'client',
        details
      });
    } catch {}
  }

  function resolveCompassApiUrl() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (origin && origin.includes('vercel.app')) return `${origin}/api/compass`;
    return 'https://risk-calculator-eight.vercel.app/api/compass';
  }

  const DEFAULT_COMPASS_API_URL = resolveCompassApiUrl();
  const DEFAULT_COMPASS_MODEL = 'gpt-5.1';
  let _compassApiUrl = DEFAULT_COMPASS_API_URL;
  let _compassModel = DEFAULT_COMPASS_MODEL;
  let _compassApiKey = '';

  function setCompassAPIKey(key) {
    _compassApiKey = key || '';
  }

  function setCompassConfig({ apiKey, apiUrl, model } = {}) {
    if (typeof apiKey === 'string') _compassApiKey = apiKey;
    if (typeof apiUrl === 'string' && apiUrl.trim()) _compassApiUrl = apiUrl.trim();
    if (typeof model === 'string' && model.trim()) _compassModel = model.trim();
  }

  function clearCompassConfig() {
    _compassApiUrl = DEFAULT_COMPASS_API_URL;
    _compassModel = DEFAULT_COMPASS_MODEL;
    _compassApiKey = '';
  }

  function _getCompanyContextUrl() {
    if (_isDirectCompassUrl(_compassApiUrl)) return '';
    try {
      const url = new URL(_compassApiUrl);
      if (url.pathname.endsWith('/api/compass')) {
        url.pathname = url.pathname.replace(/\/api\/compass$/, '/api/company-context');
        return url.toString();
      }
      return new URL('/api/company-context', _compassApiUrl).toString();
    } catch {
      return '';
    }
  }

  // Backwards-compatible alias for older setup instructions.
  function setOpenAIKey(key) {
    setCompassAPIKey(key);
  }

  function _normaliseLLMError(error) {
    const msg = String(error?.message || error || '');
    if (msg === 'Failed to fetch' || /NetworkError/i.test(msg)) {
      return new Error('Compass preflight/CORS blocked. The browser could not complete the cross-origin request to api.core42.ai.');
    }
    if (/AUTH_REQUIRED|Please sign in and try again/i.test(msg)) {
      return new Error('Your session is no longer valid for AI requests. Sign in again, then retry the AI action.');
    }
    if (/LLM API error 400/i.test(msg)) {
      return new Error(msg);
    }
    if (/LLM API error 401|LLM API error 403/i.test(msg)) {
      return new Error('Compass rejected the request. Check the API key, permissions, and model access.');
    }
    if (/Unexpected token|JSON|schema|structured response|response shape was not usable|unterminated|string literal/i.test(msg)) {
      return new Error('The AI returned an unusable structured response for this task. Try again.');
    }
    return error instanceof Error ? error : new Error(msg);
  }

  function _isStructuredResponseFailure(error) {
    const msg = String(error?.message || error || '').trim();
    return /unusable structured response|Unexpected token|JSON|schema|unterminated|string literal|response shape was not usable/i.test(msg);
  }

  function _extractBalancedJsonCandidate(text = '') {
    const source = String(text || '');
    const start = source.search(/[\[{]/);
    if (start < 0) return '';
    const stack = [];
    let inString = false;
    let escapeNext = false;
    for (let index = start; index < source.length; index += 1) {
      const ch = source[index];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === '\\') {
        if (inString) escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{' || ch === '[') {
        stack.push(ch);
        continue;
      }
      if (ch === '}' || ch === ']') {
        const expected = ch === '}' ? '{' : '[';
        if (stack[stack.length - 1] !== expected) break;
        stack.pop();
        if (!stack.length) {
          return source.slice(start, index + 1);
        }
      }
    }
    return '';
  }

  function _extractJsonFromLlmResponse(raw) {
    const text = String(raw || '').trim();

    const fenceMatch = text.match(
      /```(?:json)?\s*\r?\n?([\s\S]*?)```/i
    );
    if (fenceMatch) {
      const candidate = fenceMatch[1].trim();
      if (candidate.startsWith('{') || candidate.startsWith('[')) {
        return candidate;
      }
    }

    const objectMatch = text.match(/(\{[\s\S]*\})/);
    if (objectMatch) return objectMatch[1].trim();

    return text;
  }

  function _parseStructuredJson(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    const cleaned = _extractJsonFromLlmResponse(text);
    const candidates = [
      text,
      cleaned
    ];
    const braceMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (braceMatch?.[0]) candidates.push(braceMatch[0]);
    const balanced = _extractBalancedJsonCandidate(cleaned);
    if (balanced) candidates.push(balanced);
    for (const candidate of candidates) {
      const next = String(candidate || '').trim();
      if (!next) continue;
      try {
        return JSON.parse(next);
      } catch {}
    }
    throw new Error('The AI returned an unusable structured response for this task. Try again.');
  }

  async function _repairStructuredJson(raw, schemaHint = '', { taskName = 'repairStructuredJson' } = {}) {
    const malformed = String(raw || '').trim();
    const schema = String(schemaHint || '').trim();
    if (!malformed || !schema) return null;
    const repairPrompt = `You repair malformed model output into strict JSON.
Return ONLY valid JSON matching this schema exactly:
${schema}`;
    const repairUser = `Original malformed response:
${malformed}

Repair the response into the required JSON schema. Preserve scenario-specific meaning. If a field is missing, infer cautiously from the malformed response only.`;
    const repairedRaw = await _callLLM(repairPrompt, repairUser, {
      taskName,
      temperature: 0,
      maxCompletionTokens: 1800,
      maxPromptChars: 14000
    });
    if (!repairedRaw) return null;
    return _parseStructuredJson(repairedRaw);
  }

  async function _parseOrRepairStructuredJson(raw, schemaHint = '', options = {}) {
    try {
      return _parseStructuredJson(raw);
    } catch (parseError) {
      try {
        const repaired = await _repairStructuredJson(raw, schemaHint, options);
        if (repaired) return repaired;
      } catch {}
      throw parseError;
    }
  }

  function _canUseLiveAi() {
    return !!_compassApiKey || !_isDirectCompassUrl(_compassApiUrl);
  }

  function _getAiFeedbackTuning() {
    const defaults = {
      alignmentPriority: 'strict',
      draftStyle: 'executive-brief',
      shortlistDiscipline: 'strict',
      learningSensitivity: 'balanced'
    };
    const sourceSettings = typeof getEffectiveSettings === 'function'
      ? getEffectiveSettings()
      : (typeof getAdminSettings === 'function' ? getAdminSettings() : null);
    const tuning = sourceSettings?.aiFeedbackTuning && typeof sourceSettings.aiFeedbackTuning === 'object'
      ? sourceSettings.aiFeedbackTuning
      : {};
    const pick = (value, allowed, fallback) => {
      const safe = String(value || '').trim().toLowerCase();
      return allowed.includes(safe) ? safe : fallback;
    };
    return {
      alignmentPriority: pick(tuning.alignmentPriority, ['strict', 'balanced'], defaults.alignmentPriority),
      draftStyle: pick(tuning.draftStyle, ['executive-brief', 'balanced'], defaults.draftStyle),
      shortlistDiscipline: pick(tuning.shortlistDiscipline, ['strict', 'balanced'], defaults.shortlistDiscipline),
      learningSensitivity: pick(tuning.learningSensitivity, ['conservative', 'balanced', 'accelerated'], defaults.learningSensitivity)
    };
  }

  function _buildAiTuningPromptBlock(tuning = _getAiFeedbackTuning()) {
    return [
      'Admin tuning policy:',
      tuning.alignmentPriority === 'strict'
        ? '- Treat event-path fidelity as a hard rule. The user event wins over generic cloud, IT, infrastructure, profile, or compliance wording.'
        : '- Keep event-path fidelity primary, but you may preserve slightly broader adjacent framing when it clearly helps understanding.',
      tuning.draftStyle === 'executive-brief'
        ? '- Draft like a concise management briefing in 2-3 sentences. Cover event, exposed area, primary driver, and main business consequence without taxonomy lead-ins.'
        : '- Draft with concise business language, but a little more explanatory framing is acceptable when it sharpens the scenario.',
      tuning.shortlistDiscipline === 'strict'
        ? '- Keep the shortlist tight. Include only risks that clearly sit in the same event tree and management discussion.'
        : '- Keep the shortlist relevant, but adjacent risks can remain if they are clearly plausible and still useful to review.',
      tuning.learningSensitivity === 'accelerated'
        ? '- Repeated live-AI feedback priors should influence ranking more quickly, but they must still not override explicit scenario facts.'
        : tuning.learningSensitivity === 'conservative'
          ? '- Keep repeated feedback priors lighter than explicit scenario facts until corroboration is stronger.'
          : '- Use repeated live-AI feedback priors to refine ranking and wording, but never let them override explicit scenario facts.'
    ].join('\n');
  }

  function _getRiskBuilderDraftSentenceLimit() {
    return _getAiFeedbackTuning().draftStyle === 'executive-brief' ? 3 : 4;
  }

  async function _runStructuredQualityGate({
    taskName = 'structuredQualityGate',
    schemaHint = '',
    originalContext = '',
    checklist = [],
    candidatePayload = null,
    traceLabel = '',
    traceSources = []
  } = {}) {
    if (!_canUseLiveAi() || !candidatePayload || !schemaHint) return null;
    const items = (Array.isArray(checklist) ? checklist : []).map((item) => String(item || '').trim()).filter(Boolean);
    const tuningBlock = _buildAiTuningPromptBlock(_getAiFeedbackTuning());
    const systemPrompt = `You are the final quality gate for an enterprise risk AI workflow.

Review the candidate JSON for logic, lens fidelity, shortlist relevance, and business framing.
- preserve good scenario-specific content
- repair weak or misaligned content
- keep the user's described event path primary
- do not let generic cloud, IT, infrastructure, or compliance language override the real event
- if the affected asset is technical but the event is outage, fragility, aging infrastructure, or human error, do not force cyber without explicit compromise or security evidence
- return ONLY valid JSON that matches the schema exactly`;
    const userPrompt = `Original task context:
${String(originalContext || '').trim() || '(none)'}

${tuningBlock}

Validation checklist:
${items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. Keep the output logically aligned to the original task.'}

Candidate JSON:
${JSON.stringify(candidatePayload, null, 2)}

Return corrected JSON only.`;
    const raw = await _callLLM(systemPrompt, userPrompt, {
      taskName,
      temperature: 0,
      maxCompletionTokens: AI_QUALITY_GATE_MAX_COMPLETION_TOKENS,
      maxPromptChars: AI_QUALITY_GATE_MAX_PROMPT_CHARS,
      traceLabel: traceLabel || 'AI quality gate',
      traceSources
    });
    if (!raw) return null;
    return _parseOrRepairStructuredJson(raw, schemaHint, {
      taskName: `${taskName}Repair`
    });
  }

  function _getSessionToken() {
    try {
      return typeof AuthService !== 'undefined' && AuthService && typeof AuthService.getApiSessionToken === 'function'
        ? String(AuthService.getApiSessionToken() || '')
        : '';
    } catch {
      return '';
    }
  }

  function _decorateAiResult(result = {}, evidenceMeta = null, { contentFields = [], fallbackUsed = false, uploadedDocumentName = '' } = {}) {
    const next = { ...(result || {}) };
    const content = {};
    contentFields.forEach(field => {
      const value = next[field];
      if (typeof value === 'string' && value.trim()) {
        const labelled = _labelSuggestedDraft(value);
        next[field] = labelled;
        content[field] = labelled;
      }
    });
    const assumptions = Array.isArray(next.inferredAssumptions)
      ? next.inferredAssumptions
      : Array.isArray(next.assumptions)
        ? next.assumptions.map(item => typeof item === 'string' ? item : `${item?.category || 'Assumption'}: ${item?.text || ''}`)
        : [];
    const sourceBasis = _buildSourceBasis({
      evidenceMeta,
      citations: next.citations || [],
      uploadedDocumentName,
      fallbackUsed
    });
    const guardrails = _guardrails();
    const envelope = guardrails?.buildEnvelope
      ? guardrails.buildEnvelope({
          content,
          confidence: {
            label: next.confidenceLabel || evidenceMeta?.confidenceLabel || 'Moderate confidence',
            evidenceQuality: next.evidenceQuality || evidenceMeta?.evidenceQuality || '',
            summary: next.evidenceSummary || evidenceMeta?.summary || ''
          },
          assumptions,
          missingInformation: next.missingInformation || evidenceMeta?.missingInformation || [],
          sourceBasis,
          fallbackUsed
        })
      : {
          label: 'Suggested draft',
          content,
          confidence: { label: next.confidenceLabel || 'Moderate confidence', evidenceQuality: next.evidenceQuality || '', summary: next.evidenceSummary || '' },
          assumptions,
          missingInformation: next.missingInformation || [],
          sourceBasis,
          fallbackUsed
        };
    next.draftStatusLabel = 'Suggested draft';
    next.sourceBasis = sourceBasis;
    next.aiEnvelope = envelope;
    next.usedFallback = !!fallbackUsed;
    return next;
  }

  function _isDirectCompassUrl(url) {
    try {
      return new URL(url).hostname === 'api.core42.ai';
    } catch {
      return false;
    }
  }

  function getRuntimeStatus() {
    const apiUrl = String(_compassApiUrl || DEFAULT_COMPASS_API_URL).trim() || DEFAULT_COMPASS_API_URL;
    const model = String(_compassModel || DEFAULT_COMPASS_MODEL).trim() || DEFAULT_COMPASS_MODEL;
    const hasApiKey = !!String(_compassApiKey || '').trim();
    const usingDirectCompass = _isDirectCompassUrl(apiUrl);
    const usingStub = usingDirectCompass && !hasApiKey;
    return {
      apiUrl,
      model,
      hasApiKey,
      usingDirectCompass,
      usingProxy: !!apiUrl && !usingDirectCompass,
      usingStub,
      configFingerprint: [apiUrl, model, hasApiKey ? 'keyed' : 'keyless'].join('::')
    };
  }

  function isUsingStub() {
    return getRuntimeStatus().usingStub;
  }

  function _normaliseScenarioHintKey(value) {
    const rawValues = value && typeof value === 'object'
      ? [value.key, value.label, value.functionKey, value.estimatePresetKey]
      : [value];
    const aliasMap = {
      ransomware: 'ransomware',
      identity: 'identity',
      phishing: 'phishing',
      insider: 'insider',
      cloud: 'cloud',
      'data breach': 'data-breach',
      'data-breach': 'data-breach',
      technology: 'cyber',
      'cyber risk': 'cyber',
      cyber: 'cyber',
      ai: 'ai-model-risk',
      'ai risk': 'ai-model-risk',
      'ai-model-risk': 'ai-model-risk',
      'model risk': 'ai-model-risk',
      'responsible ai': 'ai-model-risk',
      'data governance': 'data-governance',
      'data-governance': 'data-governance',
      privacy: 'data-governance',
      'data governance / privacy': 'data-governance',
      'fraud-integrity': 'fraud-integrity',
      'fraud / integrity': 'fraud-integrity',
      fraud: 'fraud-integrity',
      integrity: 'fraud-integrity',
      'financial crime': 'fraud-integrity',
      legal: 'legal-contract',
      contract: 'legal-contract',
      litigation: 'legal-contract',
      'legal-contract': 'legal-contract',
      geopolitical: 'geopolitical',
      sanctions: 'geopolitical',
      'market access': 'geopolitical',
      'physical security': 'physical-security',
      'physical-security': 'physical-security',
      facilities: 'physical-security',
      'executive protection': 'physical-security',
      ot: 'ot-resilience',
      'ot resilience': 'ot-resilience',
      'ot-resilience': 'ot-resilience',
      'industrial control': 'ot-resilience',
      'site systems': 'ot-resilience',
      people: 'people-workforce',
      workforce: 'people-workforce',
      labour: 'people-workforce',
      labor: 'people-workforce',
      'human rights': 'people-workforce',
      'people-workforce': 'people-workforce',
      investment: 'investment-jv',
      'joint venture': 'investment-jv',
      'investment-jv': 'investment-jv',
      'transformation delivery': 'transformation-delivery',
      'transformation-delivery': 'transformation-delivery',
      'third party': 'third-party',
      'third-party': 'third-party',
      procurement: 'procurement',
      'supply chain': 'supply-chain',
      'supply-chain': 'supply-chain',
      strategic: 'strategic',
      operations: 'operational',
      operational: 'operational',
      regulatory: 'regulatory',
      finance: 'financial',
      financial: 'financial',
      esg: 'esg',
      compliance: 'compliance',
      continuity: 'business-continuity',
      'business continuity': 'business-continuity',
      'business-continuity': 'business-continuity',
      hse: 'hse',
      general: 'general'
    };
    for (const raw of rawValues) {
      const key = String(raw || '').trim().toLowerCase();
      if (!key) continue;
      if (aliasMap[key]) return aliasMap[key];
    }
    return '';
  }

  function _scenarioClassificationByKey(key = 'general') {
    const map = {
      ransomware: {
        key: 'ransomware',
        scenarioType: 'Ransomware / Extortion Attack',
        primaryDriver: 'Organised cybercriminal groups (ransomware-as-a-service)',
        eventPath: 'Ransomware deployment via initial access broker',
        effect: 'Encryption of critical data and systems; service unavailability; potential data leak for double-extortion',
        tef: { min: 0.3, likely: 1.5, max: 5 },
        tc: { min: 0.55, likely: 0.72, max: 0.9 }
      },
      identity: {
        key: 'identity',
        scenarioType: 'Identity Platform Compromise',
        primaryDriver: 'Credential theft and account-takeover specialists',
        eventPath: 'Credential theft, token hijack, or federated identity abuse',
        effect: 'Compromise of core identity services leading to account takeover, privilege abuse, mailbox compromise, and disruption across federated business systems',
        tef: { min: 1, likely: 4, max: 14 },
        tc: { min: 0.45, likely: 0.68, max: 0.86 }
      },
      phishing: {
        key: 'phishing',
        scenarioType: 'Phishing / Business Email Compromise (BEC)',
        primaryDriver: 'Opportunistic threat actors / BEC specialists',
        eventPath: 'Spear-phishing / adversary-in-the-middle phishing kit',
        effect: 'Compromise of user accounts, email trust channels, and payment or approval workflows',
        tef: { min: 3, likely: 10, max: 35 },
        tc: { min: 0.35, likely: 0.55, max: 0.78 }
      },
      insider: {
        key: 'insider',
        scenarioType: 'Insider Misuse / Privileged Abuse',
        primaryDriver: 'Malicious or negligent insider',
        eventPath: 'Insider data theft / sabotage',
        effect: 'Compromise of confidentiality, integrity, or service continuity by a trusted user or administrator',
        tef: { min: 0.3, likely: 1.2, max: 4 },
        tc: { min: 0.4, likely: 0.6, max: 0.82 }
      },
      cloud: {
        key: 'cloud',
        scenarioType: 'Cloud Misconfiguration / Exposure',
        primaryDriver: 'External threat actors (mixed motivation)',
        eventPath: 'Exploitation of cloud misconfiguration',
        effect: 'Loss of confidentiality, integrity, or availability through exposed or weakly controlled cloud services',
        tef: { min: 1, likely: 4, max: 15 },
        tc: { min: 0.35, likely: 0.55, max: 0.78 }
      },
      'data-breach': {
        key: 'data-breach',
        scenarioType: 'Data Breach / Unauthorised Data Disclosure',
        primaryDriver: 'External threat actors (mixed motivation)',
        eventPath: 'Data exfiltration after credential compromise',
        effect: 'Unauthorised access to and exfiltration of sensitive or regulated data',
        tef: { min: 0.5, likely: 2, max: 8 },
        tc: { min: 0.5, likely: 0.68, max: 0.88 }
      },
      'ai-model-risk': {
        key: 'ai-model-risk',
        scenarioType: 'AI / Model Risk Scenario',
        primaryDriver: 'Weak AI governance, monitoring gaps, or unsafe model behaviour',
        eventPath: 'Model drift, unsafe output, or poor human oversight in an AI-enabled workflow',
        effect: 'Unsafe decisions, conduct challenge, remediation effort, and loss of trust in AI-enabled operations',
        tef: { min: 0.2, likely: 0.9, max: 4 },
        tc: { min: 0.28, likely: 0.46, max: 0.7 }
      },
      'data-governance': {
        key: 'data-governance',
        scenarioType: 'Data Governance / Privacy Scenario',
        primaryDriver: 'Weak data ownership, lineage, retention, or privacy-control design',
        eventPath: 'Improper data reuse, retention failure, or weak lineage over sensitive data',
        effect: 'Privacy challenge, remediation effort, and lower confidence in analytics or reporting built on the affected data',
        tef: { min: 0.3, likely: 1.4, max: 6 },
        tc: { min: 0.32, likely: 0.5, max: 0.74 }
      },
      'third-party': {
        key: 'third-party',
        scenarioType: 'Third-Party / Supply Chain Disruption',
        primaryDriver: 'External counterparties or attacker-enabled supplier failures',
        eventPath: 'Third-party service, access, or dependency failure',
        effect: 'Operational disruption, inherited control weakness, or data exposure through critical supplier relationships',
        tef: { min: 0.4, likely: 1.8, max: 6 },
        tc: { min: 0.4, likely: 0.6, max: 0.8 }
      },
      strategic: {
        key: 'strategic',
        scenarioType: 'Strategic Risk Scenario',
        primaryDriver: 'Market, execution, and strategic counterparties',
        eventPath: 'Strategy execution gap, market shift, or major programme failure',
        effect: 'Material pressure on objectives, market position, investment value, or long-term operating model',
        tef: { min: 0.2, likely: 0.8, max: 3 },
        tc: { min: 0.25, likely: 0.45, max: 0.7 }
      },
      operational: {
        key: 'operational',
        scenarioType: 'Operational Risk Scenario',
        primaryDriver: 'Internal process, people, and control failures',
        eventPath: 'Operational breakdown or control failure',
        effect: 'Service degradation, backlog growth, cost escalation, or execution failure in core operations',
        tef: { min: 0.5, likely: 2, max: 9 },
        tc: { min: 0.3, likely: 0.5, max: 0.74 }
      },
      regulatory: {
        key: 'regulatory',
        scenarioType: 'Regulatory Risk Scenario',
        primaryDriver: 'Regulators, supervisors, and control-assurance stakeholders',
        eventPath: 'Regulatory breach, filing failure, or licence condition breach',
        effect: 'Enforcement exposure, licence pressure, remediation cost, and executive scrutiny',
        tef: { min: 0.2, likely: 1, max: 4 },
        tc: { min: 0.35, likely: 0.55, max: 0.78 }
      },
      financial: {
        key: 'financial',
        scenarioType: 'Financial Risk Scenario',
        primaryDriver: 'Fraud actors, counterparties, or internal control failures',
        eventPath: 'Fraud, payment manipulation, or financial control breakdown',
        effect: 'Direct financial loss, control failure, liquidity pressure, or reporting exposure',
        tef: { min: 0.6, likely: 2.4, max: 10 },
        tc: { min: 0.35, likely: 0.56, max: 0.8 }
      },
      'fraud-integrity': {
        key: 'fraud-integrity',
        scenarioType: 'Fraud / Integrity Risk Scenario',
        primaryDriver: 'Collusion, corruption, financial-crime actors, or integrity-control failures',
        eventPath: 'Manipulated approvals, hidden conflicts, or financial-crime control breakdown',
        effect: 'Direct loss, investigation cost, legal or assurance pressure, and lower trust in the control environment',
        tef: { min: 0.4, likely: 1.8, max: 7 },
        tc: { min: 0.36, likely: 0.56, max: 0.8 }
      },
      esg: {
        key: 'esg',
        scenarioType: 'ESG / Sustainability Risk Scenario',
        primaryDriver: 'Investors, regulators, employees, and external stakeholders',
        eventPath: 'Sustainability performance gap or disclosure failure',
        effect: 'Reputational pressure, disclosure challenge, investor scrutiny, or operational remediation need',
        tef: { min: 0.2, likely: 0.9, max: 4 },
        tc: { min: 0.25, likely: 0.44, max: 0.68 }
      },
      compliance: {
        key: 'compliance',
        scenarioType: 'Compliance Risk Scenario',
        primaryDriver: 'Internal policy breaches and external assurance bodies',
        eventPath: 'Policy non-compliance or control design failure',
        effect: 'Remediation cost, disciplinary exposure, and weakened assurance posture',
        tef: { min: 0.4, likely: 1.5, max: 6 },
        tc: { min: 0.3, likely: 0.48, max: 0.72 }
      },
      'legal-contract': {
        key: 'legal-contract',
        scenarioType: 'Legal / Contract Risk Scenario',
        primaryDriver: 'Weak contract design, disputed obligations, or challenged rights positions',
        eventPath: 'Contract breach, indemnity dispute, litigation, or IP-rights challenge',
        effect: 'Dispute cost, delivery delay, and commercial pressure on the relationship or programme in scope',
        tef: { min: 0.25, likely: 1, max: 4 },
        tc: { min: 0.28, likely: 0.46, max: 0.68 }
      },
      geopolitical: {
        key: 'geopolitical',
        scenarioType: 'Geopolitical / Market-Access Risk Scenario',
        primaryDriver: 'Sovereign restrictions, sanctions regimes, and cross-border policy shifts',
        eventPath: 'Export-control, market-access, or supplier-restriction shock',
        effect: 'Delayed execution, supplier disruption, stranded investment, and management reprioritisation',
        tef: { min: 0.1, likely: 0.6, max: 2.5 },
        tc: { min: 0.2, likely: 0.36, max: 0.58 }
      },
      'supply-chain': {
        key: 'supply-chain',
        scenarioType: 'Supply Chain Risk Scenario',
        primaryDriver: 'Critical suppliers, logistics nodes, and upstream dependencies',
        eventPath: 'Supply disruption or dependency failure',
        effect: 'Delayed delivery, inventory pressure, operational disruption, and contractual strain',
        tef: { min: 0.3, likely: 1.4, max: 6 },
        tc: { min: 0.3, likely: 0.5, max: 0.74 }
      },
      procurement: {
        key: 'procurement',
        scenarioType: 'Procurement Risk Scenario',
        primaryDriver: 'Sourcing, contracting, and supplier-governance failures',
        eventPath: 'Weak sourcing decision, tender breakdown, or contract-control failure',
        effect: 'Commercial leakage, poor vendor fit, assurance gaps, or extended delivery risk',
        tef: { min: 0.3, likely: 1.1, max: 5 },
        tc: { min: 0.28, likely: 0.46, max: 0.7 }
      },
      'business-continuity': {
        key: 'business-continuity',
        scenarioType: 'Business Continuity Risk Scenario',
        primaryDriver: 'Operational disruption and recovery-management failures',
        eventPath: 'Continuity plan failure or prolonged recovery breakdown',
        effect: 'Extended outage, missed recovery objectives, and executive escalation',
        tef: { min: 0.2, likely: 1.1, max: 5 },
        tc: { min: 0.25, likely: 0.45, max: 0.7 }
      },
      'physical-security': {
        key: 'physical-security',
        scenarioType: 'Physical Security Risk Scenario',
        primaryDriver: 'Weak site-access, facilities, or executive-protection controls',
        eventPath: 'Perimeter breach, badge failure, or uncontrolled physical access at a sensitive site',
        effect: 'Site disruption, investigation cost, and safety or leadership assurance pressure',
        tef: { min: 0.25, likely: 1.2, max: 5 },
        tc: { min: 0.3, likely: 0.48, max: 0.7 }
      },
      'ot-resilience': {
        key: 'ot-resilience',
        scenarioType: 'OT / Site Resilience Risk Scenario',
        primaryDriver: 'Weak OT governance, site-system changes, or degraded industrial visibility',
        eventPath: 'Industrial-control instability, telemetry loss, or OT recovery failure',
        effect: 'Operational instability, recovery strain, and possible safety escalation at the affected site',
        tef: { min: 0.2, likely: 1, max: 4.5 },
        tc: { min: 0.3, likely: 0.5, max: 0.74 }
      },
      'people-workforce': {
        key: 'people-workforce',
        scenarioType: 'People / Workforce Risk Scenario',
        primaryDriver: 'Staffing pressure, labour issues, welfare concerns, or weak workforce planning',
        eventPath: 'Attrition, fatigue, staffing shortfall, or labour-practice escalation',
        effect: 'Operational strain, wellbeing concern, and lower confidence in sustained safe delivery',
        tef: { min: 0.3, likely: 1.2, max: 5 },
        tc: { min: 0.26, likely: 0.42, max: 0.64 }
      },
      hse: {
        key: 'hse',
        scenarioType: 'Health, Safety, and Environment Risk Scenario',
        primaryDriver: 'Workplace hazards, operational controls, and environmental exposures',
        eventPath: 'Safety or environmental control breakdown',
        effect: 'Injury, environmental harm, shutdown, remediation cost, and regulatory scrutiny',
        tef: { min: 0.15, likely: 0.8, max: 3 },
        tc: { min: 0.25, likely: 0.42, max: 0.66 }
      },
      'investment-jv': {
        key: 'investment-jv',
        scenarioType: 'Investment / JV Risk Scenario',
        primaryDriver: 'Weak diligence, integration assumptions, or governance over an investment thesis',
        eventPath: 'M&A, JV, or integration-thesis failure',
        effect: 'Value erosion, delayed synergy, and executive pressure to reset the transaction logic',
        tef: { min: 0.15, likely: 0.6, max: 2.5 },
        tc: { min: 0.24, likely: 0.42, max: 0.64 }
      },
      'transformation-delivery': {
        key: 'transformation-delivery',
        scenarioType: 'Transformation Delivery Risk Scenario',
        primaryDriver: 'Weak programme governance, dependency control, or delivery ownership',
        eventPath: 'Milestone slippage, go-live delay, or failed benefit realisation',
        effect: 'Delay, rising cost, and lower confidence in delivery of the intended operating change',
        tef: { min: 0.2, likely: 0.9, max: 4 },
        tc: { min: 0.26, likely: 0.44, max: 0.66 }
      },
      general: {
        key: 'general',
        scenarioType: 'General Enterprise Risk Scenario',
        primaryDriver: 'Mixed internal and external drivers',
        eventPath: 'Material risk event requiring scenario triage',
        effect: 'Material financial, operational, regulatory, or strategic consequence',
        tef: { min: 0.5, likely: 2, max: 8 },
        tc: { min: 0.45, likely: 0.62, max: 0.82 }
      }
    };
    return map[key] || map.general;
  }

  function _extractRiskCandidates(text, { lensHint = null } = {}) {
    const source = String(text || '').toLowerCase();
    const lensKey = _normaliseScenarioHintKey(lensHint);
    if (/bankrupt|bankruptcy|insolv|insolven|receivable|bad debt|write[- ]?off|counterparty|credit loss|credit exposure|customer default|client default|collections|collectability|cashflow|working capital|provisioning|provision/.test(source)) {
      return [
        {
          key: 'financial',
          title: 'Counterparty default and bad-debt exposure',
          category: 'Financial',
          regulations: ['COSO Internal Control Framework'],
          description: 'A customer insolvency or payment default could force a material write-off, provisioning review, and pressure on the control environment around receivables.'
        },
        {
          key: 'financial',
          title: 'Receivables recovery shortfall after customer insolvency',
          category: 'Financial',
          regulations: ['COSO Internal Control Framework'],
          description: 'Collections may deteriorate quickly once a major client fails, creating cashflow strain and a weaker recovery path than management assumed.'
        },
        {
          key: 'legal-contract',
          title: 'Legal recovery or contractual claim uncertainty',
          category: 'Legal / Contract',
          regulations: ['ISO 37301'],
          description: 'Recovery may depend on enforceability of credit terms, security, guarantees, or the speed of insolvency-related legal action.'
        }
      ];
    }
    if (/exploitative labor|exploitative labour|forced labor|forced labour|child labor|child labour|modern slavery|labor practice|labour practice|worker exploitation|worker abuse|human rights/.test(source)) {
      return [
        {
          key: 'procurement',
          title: 'Supplier labor-practice and due-diligence failure',
          category: 'Procurement',
          regulations: ['ISO 20400', 'ISO 37301'],
          description: 'Weak sub-tier oversight or sourcing due diligence may have allowed exploitative labor practices to persist inside the supply base.'
        },
        {
          key: 'esg',
          title: 'ESG and human-rights disclosure or remediation exposure',
          category: 'ESG',
          regulations: ['IFRS S1', 'GRI Universal Standards'],
          description: 'Once abusive labor practices are identified, management may face disclosure, remediation, and stakeholder scrutiny over the wider operating model.'
        },
        {
          key: 'compliance',
          title: 'Regulatory or compliance action over supplier conduct',
          category: 'Compliance',
          regulations: ['ISO 37301'],
          description: 'Exploitative labor practices can trigger investigation, fines, contract challenge, and assurance pressure around supplier governance.'
        }
      ];
    }
    if (/collud|price fix|bid rig|inflate (?:their |the )?bid|cartel|anti-?competitive|competition law/.test(source)) {
      return [
        {
          key: 'procurement',
          title: 'Procurement collusion or bid-rigging exposure',
          category: 'Procurement',
          regulations: ['ISO 20400', 'ISO 37301'],
          description: 'Competing suppliers may be coordinating bids or pricing in a way that distorts the sourcing decision and weakens procurement integrity.'
        },
        {
          key: 'financial',
          title: 'Commercial overpayment on a critical contract award',
          category: 'Financial',
          regulations: ['COSO Internal Control Framework'],
          description: 'Artificially inflated bids can lock the organisation into avoidable cost, weaker value-for-money, and downstream budget pressure.'
        },
        {
          key: 'regulatory',
          title: 'Competition-law or sourcing-governance scrutiny',
          category: 'Regulatory',
          regulations: ['ISO 37301'],
          description: 'Suspicious bid behaviour can trigger challenge, remediation, and management scrutiny over how the sourcing decision was governed.'
        }
      ];
    }
    if (/single[- ]source|sole source|supplier shortfall|supplier concentration|critical supplier/.test(source)) {
      return [
        {
          key: 'procurement',
          title: 'Single-source supplier dependency on a critical spend category',
          category: 'Procurement',
          regulations: ['ISO 20400', 'ISO 28000'],
          description: 'One supplier now carries disproportionate delivery or commercial leverage over a critical category.'
        },
        {
          key: 'supply-chain',
          title: 'Supply chain resilience shortfall from limited fallback options',
          category: 'Supply Chain',
          regulations: ['ISO 28000', 'ISO 22301'],
          description: 'Weak substitution or delayed fallback could turn a supplier issue into a material continuity problem.'
        },
        {
          key: 'third-party',
          title: 'Contractual delivery or service failure from supplier concentration',
          category: 'Third-Party',
          regulations: ['ISO 27036', 'ISO 28000'],
          description: 'Concentrated dependency can create missed obligations, delayed delivery, and harder commercial escalation when the supplier slips.'
        }
      ];
    }
    const catalog = [
      { key: 'ai-model-risk', title: 'AI model governance or responsible-AI failure', category: 'AI / Model Risk', regulations: ['ISO/IEC 42001', 'NIST AI RMF', 'EU AI Act'], terms: ['ai', 'model risk', 'responsible ai', 'model drift', 'hallucination', 'bias', 'algorithm', 'llm', 'training data', 'ai act'] },
      { key: 'data-governance', title: 'Data-governance or privacy-control breakdown', category: 'Data Governance', regulations: ['ISO 27701', 'GDPR', 'UAE PDPL'], terms: ['data governance', 'data quality', 'data lineage', 'retention', 'purpose limitation', 'privacy', 'personal data', 'consent', 'data residency', 'master data'] },
      { key: 'strategic', title: 'Strategic execution or market-position risk', category: 'Strategic', regulations: ['ISO 31000', 'COSO ERM'], terms: ['strategy', 'strategic', 'expansion', 'transformation', 'market', 'competitive', 'portfolio', 'investment'] },
      { key: 'operational', title: 'Operational breakdown affecting core services', category: 'Operational', regulations: ['ISO 31000', 'ISO 22301'], terms: ['outage', 'downtime', 'availability', 'service disruption', 'operational disruption', 'failure', 'breakdown', 'backlog', 'capacity', 'process failure', 'human error', 'manual error', 'aging infrastructure', 'ageing infrastructure', 'legacy infrastructure', 'platform instability', 'system instability'] },
      { key: 'cyber', title: 'Cyber compromise of critical platforms or data', category: 'Cyber', regulations: ['UAE PDPL', 'UAE NESA IAS', 'ISO 27001'], terms: ['ransom', 'phish', 'malware', 'identity', 'credential', 'sso', 'entra', 'azure ad', 'breach', 'exfil', 'cloud compromise', 'cloud exposure', 'cloud breach', 'misconfig', 'vulnerability', 'privileged'] },
      { key: 'third-party', title: 'Third-party dependency or supplier failure', category: 'Third-Party', regulations: ['ISO 27036', 'ISO 28000'], terms: ['supplier', 'vendor', 'third party', 'third-party', 'outsourc', 'dependency', 'subprocessor', 'partner'] },
      { key: 'regulatory', title: 'Regulatory or licensing exposure', category: 'Regulatory', regulations: ['BIS Export Controls', 'OFAC Sanctions', 'UAE PDPL'], terms: ['regulator', 'regulatory', 'licence', 'license', 'filing', 'notification', 'sanction', 'export control'] },
      { key: 'financial', title: 'Financial loss, fraud, or capital exposure', category: 'Financial', regulations: ['UAE AML/CFT', 'PCI-DSS 4.0'], terms: ['fraud', 'payment', 'invoice', 'treasury', 'liquidity', 'cash', 'capital', 'misstatement', 'bankruptcy', 'insolvency', 'receivable', 'bad debt', 'write-off', 'counterparty', 'customer default', 'client default', 'collections', 'working capital', 'provisioning'] },
      { key: 'fraud-integrity', title: 'Fraud, integrity, or financial-crime exposure', category: 'Fraud / Integrity', regulations: ['ISO 37001', 'UAE AML/CFT'], terms: ['fraud', 'integrity', 'financial crime', 'money laundering', 'kickback', 'bribery', 'corruption', 'embezzlement'] },
      { key: 'esg', title: 'ESG or sustainability disclosure risk', category: 'ESG', regulations: ['IFRS S1', 'IFRS S2', 'GRI Universal Standards'], terms: ['esg', 'sustainability', 'climate', 'emission', 'carbon', 'greenwashing', 'social impact', 'governance failure'] },
      { key: 'compliance', title: 'Compliance control or policy breakdown', category: 'Compliance', regulations: ['ISO 37301', 'UAE PDPL'], terms: ['policy breach', 'control failure', 'non-compliance', 'compliance', 'obligation', 'conduct', 'ethics'] },
      { key: 'legal-contract', title: 'Legal, contract, or IP exposure', category: 'Legal / Contract', regulations: ['ISO 37301'], terms: ['contract', 'indemnity', 'litigation', 'ip', 'intellectual property', 'licensing dispute', 'dispute', 'terms breach'] },
      { key: 'geopolitical', title: 'Geopolitical, sanctions, or market-access exposure', category: 'Geopolitical', regulations: ['OFAC Sanctions', 'BIS Export Controls'], terms: ['geopolitical', 'market access', 'sanctions', 'export control', 'sovereign', 'entity list', 'tariff', 'cross-border restriction'] },
      { key: 'supply-chain', title: 'Supply chain resilience disruption', category: 'Supply Chain', regulations: ['ISO 28000', 'ISO 22301'], terms: ['supply chain', 'logistics', 'inventory', 'shipment', 'fulfilment', 'single source', 'upstream'] },
      { key: 'procurement', title: 'Procurement governance or sourcing risk', category: 'Procurement', regulations: ['ISO 20400', 'ISO 37301'], terms: ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'vendor selection', 'purchasing', 'critical spend', 'single-source spend'] },
      { key: 'business-continuity', title: 'Business continuity and recovery failure', category: 'Business Continuity', regulations: ['ISO 22301', 'NFPA 1600'], terms: ['continuity', 'recovery', 'dr', 'disaster recovery', 'rto', 'rpo', 'crisis management'] },
      { key: 'physical-security', title: 'Physical security or facilities-protection breakdown', category: 'Physical Security', regulations: ['ISO 22301', 'UAE Fire and Life Safety Code'], terms: ['physical security', 'perimeter', 'site intrusion', 'badge control', 'facility breach', 'executive protection', 'visitor management'] },
      { key: 'ot-resilience', title: 'OT or industrial-control resilience failure', category: 'OT Resilience', regulations: ['IEC 62443', 'ISO 22301'], terms: ['ot', 'operational technology', 'industrial control', 'ics', 'scada', 'plant network', 'site systems', 'control room'] },
      { key: 'people-workforce', title: 'People, workforce, or labour-practice exposure', category: 'People / Workforce', regulations: ['UN Guiding Principles', 'SA8000', 'ILO-OSH 2001'], terms: ['workforce', 'labour', 'labor', 'attrition', 'staffing', 'fatigue', 'strike', 'worker welfare', 'human rights'] },
      { key: 'investment-jv', title: 'Investment, JV, or integration-thesis exposure', category: 'Investment / JV', regulations: ['COSO ERM', 'ISO 31000'], terms: ['merger', 'acquisition', 'm&a', 'joint venture', 'jv', 'integration', 'valuation', 'synergy'] },
      { key: 'transformation-delivery', title: 'Transformation-delivery or programme-execution failure', category: 'Transformation Delivery', regulations: ['ISO 31010', 'COSO ERM'], terms: ['transformation', 'programme delivery', 'program delivery', 'project delivery', 'go-live', 'milestone', 'dependency slip', 'benefit realisation'] },
      { key: 'hse', title: 'Health, safety, and environmental incident exposure', category: 'HSE', regulations: ['ISO 45001', 'ISO 14001'], terms: ['hse', 'health and safety', 'safety', 'injury', 'environmental', 'spill', 'worker'] }
    ];
    const compatibilityBoosts = {
      'ai-model-risk': new Set(['ai-model-risk', 'data-governance', 'compliance', 'cyber']),
      'data-governance': new Set(['data-governance', 'compliance', 'regulatory', 'cyber']),
      procurement: new Set(['procurement', 'supply-chain', 'third-party']),
      'supply-chain': new Set(['supply-chain', 'procurement', 'third-party']),
      compliance: new Set(['compliance', 'regulatory']),
      regulatory: new Set(['regulatory', 'compliance']),
      operational: new Set(['operational', 'business-continuity']),
      'business-continuity': new Set(['business-continuity', 'operational']),
      strategic: new Set(['strategic']),
      financial: new Set(['financial']),
      'fraud-integrity': new Set(['fraud-integrity', 'financial', 'compliance', 'regulatory']),
      'legal-contract': new Set(['legal-contract', 'compliance', 'regulatory', 'procurement']),
      geopolitical: new Set(['geopolitical', 'strategic', 'regulatory', 'supply-chain']),
      'physical-security': new Set(['physical-security', 'operational', 'business-continuity', 'hse']),
      'ot-resilience': new Set(['ot-resilience', 'operational', 'cyber', 'hse', 'business-continuity']),
      'people-workforce': new Set(['people-workforce', 'hse', 'esg', 'operational', 'compliance']),
      'investment-jv': new Set(['investment-jv', 'strategic', 'financial']),
      'transformation-delivery': new Set(['transformation-delivery', 'strategic', 'operational']),
      esg: new Set(['esg']),
      hse: new Set(['hse']),
      cyber: new Set(['cyber']),
      'third-party': new Set(['third-party', 'procurement', 'supply-chain'])
    };
    // The fallback path needs the same enterprise-risk lens as the live prompt so non-cyber scenarios stay coherent.
    const hits = catalog
      .map((item) => {
        const hitCount = (item.terms || []).filter(term => source.includes(term)).length;
        const lensBoost = lensKey && item.key === lensKey ? 3 : (compatibilityBoosts[lensKey]?.has(item.key) ? 1 : 0);
        return hitCount || lensBoost ? { ...item, score: hitCount + lensBoost } : null;
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score);
    if (hits.length) return hits;
    const hinted = catalog.find(item => item.key === lensKey);
    return hinted ? [hinted] : [{ title: 'Material enterprise risk requiring structured assessment', category: 'General', regulations: ['ISO 31000'] }];
  }

  // ─── Real API call (when keys are available) ─────────────
  async function _callLLM(systemPrompt, userPrompt, options = {}) {
    const directCompass = _isDirectCompassUrl(_compassApiUrl);
    if (directCompass && !_compassApiKey) return null; // fall through to stub

    const timeoutMs = Number(options.timeoutMs || AI_TIMEOUT_MS);
    const maxCompletionTokens = Number(options.maxCompletionTokens || 1200);
    const promptPayload = _buildPromptPayload(systemPrompt, userPrompt, options);
    let lastError = null;

    for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt += 1) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timeoutId = null;
      try {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (_compassApiKey) {
          headers.Authorization = `Bearer ${_compassApiKey}`;
        }
        const sessionToken = _getSessionToken();
        if (!directCompass && sessionToken) {
          headers['x-session-token'] = sessionToken;
        }
        const fetchPromise = (async () => {
          const res = await fetch(_compassApiUrl, {
            method: 'POST',
            headers,
            signal: controller?.signal,
            body: JSON.stringify({
              model: _compassModel,
              max_completion_tokens: maxCompletionTokens,
              temperature: Number(options.temperature ?? 0.3),
              messages: [
                { role: 'system', content: promptPayload.systemPrompt },
                ...(Array.isArray(promptPayload.priorMessages) ? promptPayload.priorMessages : []),
                { role: 'user', content: promptPayload.userPrompt }
              ]
            })
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`LLM API error ${res.status}: ${errText}`);
          }
          const data = await res.json();
          const responseInfo = typeof describeLlmResponse === 'function'
            ? describeLlmResponse(data)
            : { text: data.choices?.[0]?.message?.content || null, diagnostic: '' };
          const extracted = responseInfo?.text || null;
          if (!extracted) {
            throw new Error(`AI response shape was not usable. ${String(responseInfo?.diagnostic || '').trim()}`.trim());
          }
          if (options.traceLabel) {
            _storeAiTraceEntry({
              label: options.traceLabel,
              promptSummary: _buildTracePromptSummary(promptPayload),
              response: extracted,
              sources: _getTraceSources(options)
            });
          }
          return extracted;
        })();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            try { controller?.abort(); } catch {}
            reject(new Error('AI assist timed out. Try again, shorten the prompt, or check the model configuration.'));
          }, timeoutMs);
        });
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (promptPayload.truncated) {
          _auditAiEvent('ai_prompt_truncated', 'success', {
            taskName: options.taskName || 'ai_request',
            promptLimit: Number(options.maxPromptChars || 18000)
          });
        }
        return response;
      } catch (error) {
        lastError = error;
        const message = String(error?.message || error || '');
        if (attempt < AI_MAX_RETRIES && (
          /timed out/i.test(message) ||
          /Failed to fetch|NetworkError|502|503|504/i.test(message) ||
          /LLM API error 429/i.test(message)
        )) {
          const backoffMs = /LLM API error 429/i.test(message)
            ? 2000 * attempt
            : 300 * attempt;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    const message = String(lastError?.message || lastError || '');
    if (lastError?.name === 'AbortError' || /timed out/i.test(message)) {
      throw new Error('AI assist timed out. Try again, shorten the prompt, or check the model configuration.');
    }
    if (/LLM API error 429/i.test(message)) {
      throw new Error('AI requests are temporarily rate limited. Wait a moment and try again.');
    }
    throw _normaliseLLMError(lastError);
  }

  async function _streamLLM(systemPrompt, userPrompt, options = {}, onChunk = null) {
    const directCompass = _isDirectCompassUrl(_compassApiUrl);
    if (directCompass && !_compassApiKey) return null;

    const maxCompletionTokens = Number(options.maxCompletionTokens || 1200);
    const promptPayload = _buildPromptPayload(systemPrompt, userPrompt, options);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (_compassApiKey) {
      headers.Authorization = `Bearer ${_compassApiKey}`;
    }
    const sessionToken = _getSessionToken();
    if (!directCompass && sessionToken) {
      headers['x-session-token'] = sessionToken;
    }

    const response = await fetch(_compassApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: _compassModel,
        stream: true,
        max_completion_tokens: maxCompletionTokens,
        temperature: Number(options.temperature ?? 0.3),
        messages: [
          { role: 'system', content: promptPayload.systemPrompt },
          ...(Array.isArray(promptPayload.priorMessages) ? promptPayload.priorMessages : []),
          { role: 'user', content: promptPayload.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return '';

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    const processLine = (line) => {
      const value = String(line || '').trim();
      if (!value.startsWith('data: ')) return false;
      const payload = value.slice(6).trim();
      if (!payload) return false;
      if (payload === '[DONE]') return true;
      try {
        const parsed = JSON.parse(payload);
        const text = parsed?.choices?.[0]?.delta?.content;
        if (text == null) return false;
        const chunk = String(text);
        fullText += chunk;
        if (typeof onChunk === 'function') onChunk(chunk);
      } catch {}
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        const lines = buffer.split(/\r?\n/);
        lines.forEach(processLine);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (processLine(line)) return fullText;
      }
    }

    if (options.traceLabel) {
      _storeAiTraceEntry({
        label: options.traceLabel,
        promptSummary: _buildTracePromptSummary(promptPayload),
        response: fullText,
        sources: _getTraceSources(options)
      });
    }

    return fullText;
  }

  // ─── Stub generator ──────────────────────────────────────
  function _normaliseSentenceKey(sentence = '') {
    return String(sentence || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _dedupeSentences(text = '') {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set();
    return sentences.filter((sentence) => {
      const key = _normaliseSentenceKey(sentence);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join(' ').trim();
  }

  function _titleCaseWord(word = '') {
    const value = String(word || '').trim();
    if (!value) return '';
    if (/^[A-Z0-9&/+.-]+$/.test(value)) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  function _toDisplayLabel(value = '') {
    return String(value || '')
      .split(/[\s_-]+/)
      .map(_titleCaseWord)
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function _joinList(items = []) {
    const values = Array.from(new Set((Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean)));
    if (!values.length) return '';
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
  }


  function _truncateText(value = '', maxChars = 600) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
  }

  function _compactHistory(history = [], limit = 4) {
    return (Array.isArray(history) ? history : [])
      .slice(-limit)
      .map((entry) => ({
        role: entry?.role === 'assistant' ? 'assistant' : 'user',
        text: _truncateText(entry?.text || '', 280)
      }));
  }


  function _buildUploadedDocumentBlock(input = {}) {
    const uploadedText = _truncateText(input.uploadedText || '', 1400);
    if (!uploadedText) return 'Uploaded supporting documents\n(none)';
    const label = String(input.uploadedDocumentName || 'source material').trim() || 'source material';
    return `Uploaded supporting documents (${label}):\n${uploadedText}`;
  }

  function _stripScenarioLeadIns(value = '') {
    let text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    text = text
      .replace(/^(?:critical|high|medium|low)-urgency\s+[a-z/& -]+ scenario:\s*/i, '')
      .replace(/^(?:strategic|operational|cyber|compliance|regulatory|financial|fraud|legal(?: \/ contract)?|business continuity|continuity|third-party|supply chain|procurement|esg|hse|people(?: and workforce)?|physical security|ot resilience|ai(?: \/ model)? risk|data governance(?: \/ privacy)?|geopolitical|investment(?: \/ jv)?|transformation delivery) scenario:\s*/i, '')
      .replace(/^in [^.]+?,\s*[^.]+? faces a material [^.]+? scenario in which\s*/i, '')
      .replace(/^in [^.]+?,\s*[^.]+? faces a material risk scenario in which\s*/i, '')
      .replace(/^a risk scenario is being assessed where\s*/i, '')
      .replace(/^the scenario is that\s*/i, '')
      .replace(/^scenario:\s*/i, '')
      .replace(/^risk statement:\s*/i, '')
      .trim();
    return text.replace(/^[,:;\-\s]+/, '').trim();
  }

  function _ensureSentence(text = '') {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    return /[.!?]$/.test(value) ? value : `${value}.`;
  }

  function _buildScenarioLead({ geography = '', businessUnit = '', asset = '', cause = '', impact = '', scenarioLabel = 'risk scenario' } = {}) {
    const place = geography ? `Across ${geography}` : 'Across the selected operating footprint';
    const org = businessUnit || 'the business unit';
    const focus = asset ? `${scenarioLabel} affecting ${asset}` : scenarioLabel;
    const causeText = cause ? `The most credible initial path is ${cause.toLowerCase()}` : '';
    const impactText = impact ? `The likely business effect is ${impact.toLowerCase()}` : '';
    return _ensureSentence([`${place}, ${org} could face a material ${focus}`.replace(/\s+/g, ' ').trim(), causeText, impactText].filter(Boolean).join(' '));
  }

  function _buildRiskContextSummary({ classification, asset = '', impact = '', riskTitles = [] } = {}) {
    const label = String(classification?.label || classification?.scenarioType || 'enterprise').trim().toLowerCase();
    const focus = asset ? ` around ${asset}` : '';
    const impactText = String(impact || classification?.effect || '').trim();
    const firstRisk = String(riskTitles?.[0]?.title || '').trim();
    const secondRisk = String(riskTitles?.[1]?.title || '').trim();
    const impactTail = impactText
      ? ` Likely consequences include ${impactText.charAt(0).toLowerCase() + impactText.slice(1)}.`
      : '';
    const riskTail = firstRisk
      ? ` Primary pressure points are ${firstRisk}${secondRisk ? ` and ${secondRisk.toLowerCase()}` : ''}.`
      : '';
    return _cleanUserFacingText(`AI reframed this as a ${label} scenario${focus}.${impactTail}${riskTail}`, { maxSentences: 3 });
  }

  function _buildRiskContextLinkAnalysis({ classification, riskTitles = [] } = {}) {
    const key = String(classification?.key || 'general').trim();
    const combinedRiskText = (Array.isArray(riskTitles) ? riskTitles : [])
      .map((risk) => typeof risk === 'string' ? risk : `${risk?.title || ''} ${risk?.description || ''}`)
      .join(' ')
      .toLowerCase();
    if (key === 'ai-model-risk') {
      return 'The main chain is weak AI governance, unsafe or low-trust model behaviour, and conduct or regulatory consequences from how the output is used. Keep only the risks that share that path.';
    }
    if (key === 'data-governance') {
      return 'The main chain is weak data ownership or lineage, privacy or approved-use challenge, and remediation of downstream reporting or analytics confidence. Keep only the risks that fit that path.';
    }
    if (key === 'procurement') {
      return 'The main chain is distorted sourcing governance, commercial overpayment, and possible regulatory or assurance challenge. Keep only the risks that belong in that chain.';
    }
    if (key === 'supply-chain' || key === 'third-party') {
      return 'The main chain is dependency weakness, delivery or service disruption, and wider continuity or commercial consequences. Keep only the risks that belong in that chain.';
    }
    if (key === 'compliance' || key === 'regulatory') {
      return 'The main chain is control or obligation failure, management challenge, and regulatory or assurance consequences. Keep only the risks that share that same path.';
    }
    if (key === 'financial') {
      if (/bankrupt|bankruptcy|insolv|insolven|receivable|bad debt|write[- ]?off|counterparty|credit loss|credit exposure|customer default|client default|collections|collectability|working capital|provisioning|provision/.test(combinedRiskText)) {
        return 'The main chain is counterparty deterioration, weaker receivables recovery, and bad-debt or cashflow pressure. Keep only the risks that share that same recovery and financial-consequence path.';
      }
      if (/liquidity|funding|collateral|cash buffer|cashflow/.test(combinedRiskText)) {
        return 'The main chain is funding or liquidity pressure, delayed treasury response, and wider financial or confidence consequences. Keep only the risks that belong in that same path.';
      }
      if (/payment|invoice|duplicate transfer|treasury|approval/.test(combinedRiskText)) {
        return 'The main chain is payment or financial-control weakness, direct loss or recovery effort, and follow-on assurance or treasury consequences. Keep only the risks that fit that path.';
      }
      return 'The main chain is control weakness or manipulation, direct financial loss, and escalation through assurance, legal, or treasury response. Keep only the risks that fit that path.';
    }
    if (key === 'fraud-integrity') {
      return 'The main chain is collusion, override, or financial-crime weakness, then investigation, recovery, and assurance pressure. Keep only the risks that clearly belong in that same chain.';
    }
    if (key === 'legal-contract') {
      return 'The main chain is weak contractual or rights positioning, dispute or delay, and commercial or programme consequences. Keep only the risks that share that path.';
    }
    if (key === 'geopolitical') {
      return 'The main chain is market-access or sovereign restriction, delayed execution or supplier access, and strategic or regulatory consequences. Keep only the risks that fit that same path.';
    }
    if (key === 'physical-security' || key === 'ot-resilience') {
      return 'The main chain is site-control weakness, operating instability or interruption, and wider safety or continuity consequences. Keep only the risks that belong in that same path.';
    }
    if (key === 'people-workforce') {
      return 'The main chain is workforce pressure, degraded safe delivery or welfare, and operational or reputational consequences. Keep only the risks that share that path.';
    }
    if (key === 'investment-jv' || key === 'transformation-delivery') {
      return 'The main chain is weak execution or governance over a major initiative, delayed value or delivery, and escalating strategic pressure. Keep only the risks that fit that same path.';
    }
    if ((Array.isArray(riskTitles) ? riskTitles.length : 0) > 1) {
      return 'Several selected risks appear capable of cascading together. Keep only the risks that clearly belong in the same event path and business consequence chain.';
    }
    return 'A single primary risk driver was identified from the intake. Keep only the risk that best represents the same scenario and business consequence.';
  }

  function _looksGenericRiskContextCopy(value = '') {
    const text = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text) return true;
    return /ai expanded the scenario into a clearer risk narrative|suggested draft|candidate risk identified from the intake text|a single primary risk driver was identified from the intake/.test(text);
  }

  function _isGenericRiskTitle(title = '') {
    const value = _normaliseSentenceKey(title);
    return [
      'material technology and cyber risk requiring structured assessment',
      'technology outage affecting core business services',
      'general cyber threat',
      'material cyber risk',
      'cyber incident',
      'material operational risk'
    ].includes(value);
  }

  function _classifyEvidenceSource(source = {}) {
    const title = String(source.title || source.note || '').toLowerCase();
    const excerpt = String(source.excerpt || source.description || '').toLowerCase();
    const url = String(source.url || source.link || '').toLowerCase();
    const combined = `${title} ${excerpt} ${url}`;
    if (/uploaded|internal|register|assessment|workshop|interview|evidence/.test(combined)) return 'internal';
    if (/company website|official|newsroom|leadership|governance|privacy|responsible ai|trust|about/.test(combined)) return 'official';
    if (/regulat|policy|guidance|government|ministry|authority|law|pdpl|gdpr|ofac|bis|cybersecurity council/.test(combined)) return 'regulatory';
    if (/local uae|gcc|regional|thenationalnews|gulfnews|khaleejtimes|zawya|arabianbusiness|gulfbusiness/.test(combined)) return 'regional';
    if (/bloomberg|reuters|financial times|ft.com|wsj|cnbc|forbes|techcrunch|semafor/.test(combined)) return 'global';
    return 'external';
  }

  function _buildEvidenceMeta(options = {}) {
    const citations = Array.isArray(options.citations) ? options.citations : [];
    const counts = { official: 0, regulatory: 0, regional: 0, global: 0, internal: 0, external: 0 };
    citations.forEach((item) => {
      const kind = _classifyEvidenceSource(item);
      counts[kind] = (counts[kind] || 0) + 1;
    });
    const hasBuContext = Boolean(options.businessUnit?.contextSummary || options.businessUnit?.notes || options.businessUnit?.aiGuidance || options.businessUnit?.criticalServices?.length || options.adminSettings?.businessUnitContext || options.adminSettings?.departmentContext);
    const hasOrgContext = Boolean(options.organisationContext || options.businessUnit?.companyStructureContext || options.adminSettings?.companyContextProfile || options.adminSettings?.companyStructureContext || options.adminSettings?.inheritedContextSummary);
    const hasUserContext = Boolean(options.userProfile || options.businessUnit?.userProfileSummary || options.adminSettings?.userProfileSummary || options.adminSettings?.personalContextSummary);
    const hasUploadedText = Boolean(String(options.uploadedText || '').trim());
    const hasRegisterText = Boolean(String(options.registerText || '').trim());
    const hasGeography = Boolean(String(options.geography || options.businessUnit?.geography || options.adminSettings?.geography || '').trim());
    const hasRegulations = Boolean((options.businessUnit?.regulatoryTags || options.applicableRegulations || options.adminSettings?.applicableRegulations || []).length);

    let score = 0;
    score += hasBuContext ? 2 : 0;
    score += hasOrgContext ? 2 : 0;
    score += hasUserContext ? 1 : 0;
    score += hasUploadedText ? 2 : 0;
    const hasFullDocContent = Array.isArray(options.citations) &&
      options.citations.some(c => String(c?.contentFull || '').trim().length > 100);
    score += hasFullDocContent ? 3 : 0;
    score += hasRegisterText ? 2 : 0;
    score += hasGeography ? 1 : 0;
    score += hasRegulations ? 1 : 0;
    score += Math.min(2, counts.official);
    score += Math.min(2, counts.regulatory);
    score += Math.min(1, counts.regional + counts.global + counts.external);

    const missingInformation = [];
    if (!hasBuContext) missingInformation.push('BU or function context is still thin.');
    if (!hasGeography) missingInformation.push('Geographic scope is not well defined.');
    if (!hasRegulations) missingInformation.push('Relevant regulatory references are limited or missing.');
    if (!hasUploadedText && !hasRegisterText && counts.internal === 0) missingInformation.push('No internal documents or uploaded evidence were provided.');
    if ((counts.official + counts.regulatory + counts.regional + counts.global + counts.external) === 0) missingInformation.push('No external citations were available to ground the output.');

    const confidenceLabel = score >= 9 ? 'High confidence' : score >= 5 ? 'Moderate confidence' : 'Low confidence';
    const evidenceQuality = score >= 9 ? 'Strong evidence base' : score >= 5 ? 'Useful but incomplete evidence base' : 'Thin evidence base';
    const evidenceParts = [];
    if (hasBuContext) evidenceParts.push('BU/function context');
    if (hasOrgContext) evidenceParts.push('organisation context');
    if (hasUserContext) evidenceParts.push('user-role context');
    if (hasUploadedText) evidenceParts.push('uploaded source material');
    if (hasFullDocContent) evidenceParts.push('full document content from library');
    if (hasRegisterText) evidenceParts.push('risk register content');
    if (counts.official) evidenceParts.push(`${counts.official} official/company sources`);
    if (counts.regulatory) evidenceParts.push(`${counts.regulatory} regulatory or policy sources`);
    if (counts.regional) evidenceParts.push(`${counts.regional} regional news sources`);
    if (counts.global || counts.external) evidenceParts.push(`${counts.global + counts.external} wider external sources`);

    const summary = evidenceParts.length
      ? `Evidence used: ${_joinList(evidenceParts)}.`
      : 'Evidence used: limited contextual inputs only.';

    const rankedCitations = citations
      .slice()
      .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));
    const primaryGrounding = rankedCitations.slice(0, 3).map((item) => ({
      title: String(item?.title || item?.note || 'Untitled source').trim(),
      sourceType: String(item?.sourceType || _classifyEvidenceSource(item) || 'Source').trim(),
      relevanceReason: String(item?.relevanceReason || '').trim()
    }));
    const supportingReferences = rankedCitations.slice(3, 6).map((item) => ({
      title: String(item?.title || item?.note || 'Untitled source').trim(),
      sourceType: String(item?.sourceType || _classifyEvidenceSource(item) || 'Source').trim(),
      relevanceReason: String(item?.relevanceReason || '').trim()
    }));
    const inferredAssumptions = [
      !hasGeography ? 'Geographic scope was inferred from current platform or business-unit defaults.' : null,
      !hasRegulations ? 'Applicable regulations were inferred from selected geography and scenario type.' : null,
      !hasBuContext ? 'Business-unit or function context was inferred from broader organisation context.' : null,
      (!hasUploadedText && !hasRegisterText && counts.internal === 0) ? 'No direct internal evidence was provided, so the AI relied on existing platform context and retrieved references.' : null
    ].filter(Boolean).slice(0, 4);

    const promptLines = [
      `Evidence quality: ${evidenceQuality}.`,
      `Confidence: ${confidenceLabel}.`,
      `Available evidence: ${summary}`
    ];
    if (primaryGrounding.length) {
      promptLines.push(`Primary grounding sources: ${_joinList(primaryGrounding.map(item => item.title))}`);
    }
    if (supportingReferences.length) {
      promptLines.push(`Supporting references: ${_joinList(supportingReferences.map(item => item.title))}`);
    }
    if (inferredAssumptions.length) {
      promptLines.push(`Inferred without direct evidence: ${_joinList(inferredAssumptions)}`);
    }
    if (missingInformation.length) {
      promptLines.push(`Missing or weak evidence: ${_joinList(missingInformation.slice(0, 4))}`);
    }

    return {
      score,
      confidenceLabel,
      evidenceQuality,
      summary,
      missingInformation: missingInformation.slice(0, 4),
      promptBlock: promptLines.join('\n')
    };
  }


  function _buildCitationPromptBlock(citations = [], limit = 8) {
    const labelMap = {
      official: 'Official/company source',
      regulatory: 'Regulatory/policy source',
      regional: 'Regional news source',
      global: 'Global news source',
      internal: 'Internal source',
      external: 'External source'
    };
    const items = (Array.isArray(citations) ? citations : [])
      .slice()
      .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
      .map((item, index) => {
        const kind = _classifyEvidenceSource(item);
        const title = String(item?.title || item?.note || 'Untitled source').trim();
        const excerpt = _truncateText(
          item?.excerpt || item?.description || item?.note || '', 220
        );
        const url = String(item?.url || item?.link || '').trim();
        const reason = String(item?.relevanceReason || '').trim();
        const fullText = index < 2
          ? _truncateText(String(item?.contentFull || ''), 3000)
          : '';
        const base = `- ${labelMap[kind] || 'Source'}: ${title}`
          + `${reason ? ` | Why used: ${reason}` : ''}`
          + `${excerpt ? ` | Summary: ${excerpt}` : ''}`
          + `${url ? ` | ${url}` : ''}`;
        return fullText
          ? `${base}\n  Full document content:\n  ${fullText.replace(/\n/g, '\n  ')}`
          : base;
      })
      .filter(Boolean)
      .slice(0, limit);
    return items.length ? items.join('\n') : '(no external citations available)';
  }


  function _buildContextPromptBlock(settings = {}, businessUnit = null, priorPatterns = []) {
    const parts = [
      settings?.businessUnitContext ? `Live business-unit context:
${settings.businessUnitContext}` : '',
      settings?.departmentContext ? `Live function context:
${settings.departmentContext}` : '',
      settings?.inheritedContextSummary ? `Inherited organisation context:
${settings.inheritedContextSummary}` : '',
      settings?.personalContextSummary ? `User-specific working context:
${settings.personalContextSummary}` : '',
      businessUnit?.selectedDepartmentContext ? `Selected department context:
${businessUnit.selectedDepartmentContext}` : ''
    ].filter(Boolean);
    if (Array.isArray(priorPatterns) && priorPatterns.length) {
      const patternLines = priorPatterns.map(p =>
        `- ${p.scenarioType || 'Prior scenario'} (${p.geography || 'unknown geography'}): posture was ${p.posture}, confidence was ${p.confidenceLabel}${p.topGap ? `, main evidence gap was: ${p.topGap}` : ''}${p.keyRecommendation ? `, top recommendation was: ${p.keyRecommendation}` : ''}.`
      ).join('\n');
      parts.push(`Prior scenario patterns for this business unit:\n${patternLines}`);
    }
    return parts.length ? parts.join('\n\n') : '(no additional live BU/function/user context provided)';
  }

  function _getContextResolverPriorPatterns(buId = '', limit = 6) {
    try {
      if (typeof getRelevantScenarioPatterns === 'function') {
        return getRelevantScenarioPatterns(buId, limit);
      }
      return [];
    } catch {
      return [];
    }
  }

  function _buildContextResolverSourceText(source = {}) {
    return [
      source?.title,
      source?.text,
      source?.summary,
      source?.scenarioType,
      source?.geography,
      source?.topGap,
      source?.keyRecommendation
    ].filter(Boolean).join(' ');
  }

  function _scoreContextApplicability(source = {}, eventCore = {}) {
    const text = _cleanUserFacingText(_buildContextResolverSourceText(source), { maxSentences: 4 });
    if (!text) {
      return {
        key: source?.key || '',
        label: source?.label || 'Context source',
        kind: source?.kind || 'context',
        status: 'ignore',
        score: -1,
        useFor: 'ignore',
        reason: 'No usable context was available from this source.',
        text: ''
      };
    }
    const kind = String(source?.kind || 'context').trim() || 'context';
    if (kind === 'geography') {
      return {
        key: source?.key || 'geography',
        label: source?.label || 'Geography',
        kind,
        status: 'applies',
        score: 10,
        useFor: 'jurisdiction and operating footprint',
        reason: 'This sets the scenario jurisdiction and operating footprint, so it always applies.',
        text
      };
    }
    if (kind === 'regulations') {
      return {
        key: source?.key || 'regulations',
        label: source?.label || 'Applicable regulations',
        kind,
        status: 'applies',
        score: 9,
        useFor: 'regulatory framing and obligations',
        reason: 'These define the relevant obligations and should inform regulatory framing, but not change the event type.',
        text
      };
    }

    const expectedLens = _normaliseScenarioHintKey(eventCore?.classification?.key || '');
    const anchors = Array.isArray(eventCore?.anchors) ? eventCore.anchors : [];
    const overlap = _countScenarioAnchorOverlap(text, anchors);
    const classified = _classifyScenario(text, {
      scenarioLensHint: expectedLens
    });
    const sourceLens = _normaliseScenarioHintKey(classified?.key || '');
    const exactLens = !!sourceLens && sourceLens === expectedLens;
    const compatibleLens = !sourceLens
      || sourceLens === 'general'
      || !expectedLens
      || _isCompatibleScenarioLens(expectedLens, sourceLens)
      || _isCompatibleScenarioLens(sourceLens, expectedLens);

    let score = 0;
    score += Math.min(3, overlap) * 3;
    if (exactLens) score += 3;
    else if (compatibleLens) score += 1;
    else score -= 4;
    if (kind === 'business-unit' || kind === 'department') score += 1;
    if (kind === 'prior-pattern') score += overlap ? 2 : 0;
    if (kind === 'user') score += overlap ? 1 : -1;
    if (kind === 'guidance') score += overlap ? 1 : -2;

    let status = score >= 5 ? 'applies' : score >= 2 ? 'maybe' : 'ignore';
    let useFor = 'operating context';
    if (kind === 'user') {
      useFor = status === 'ignore' ? 'ignore' : 'wording and operating nuance only';
    } else if (kind === 'prior-pattern') {
      useFor = status === 'ignore' ? 'ignore' : 'analogy and precedent only';
    } else if (kind === 'guidance') {
      useFor = status === 'ignore' ? 'ignore' : 'workflow shaping only';
    } else if (kind === 'organisation') {
      useFor = status === 'ignore' ? 'ignore' : 'background organisation context';
    } else if (kind === 'business-unit' || kind === 'department') {
      useFor = status === 'ignore' ? 'ignore' : 'operating and control context';
    }

    let reason = '';
    if (!compatibleLens && overlap === 0) {
      reason = 'This context points to a different domain than the current scenario and has no direct event overlap, so it is excluded.';
    } else if (overlap >= 2) {
      reason = `It shares ${overlap} strong event anchor${overlap === 1 ? '' : 's'} with the current scenario and supports the current event path.`;
    } else if (overlap === 1) {
      reason = 'It has limited direct overlap with the current scenario, so it can refine context but should not redefine the event.';
    } else if (kind === 'user') {
      reason = 'This can help with wording or working nuance, but it should not determine scenario type on its own.';
    } else if (kind === 'prior-pattern') {
      reason = 'This is useful as precedent only if it clearly matches the current event path.';
    } else if (compatibleLens) {
      reason = 'This context is directionally compatible, but the current scenario text remains the primary source of truth.';
    } else {
      reason = 'This context does not materially support the current event path and is therefore ignored.';
    }

    return {
      key: source?.key || kind,
      label: source?.label || 'Context source',
      kind,
      status,
      score,
      useFor,
      reason,
      lens: sourceLens,
      overlap,
      text
    };
  }

  function _buildScenarioContextResolution({
    narrative = '',
    guidedInput = {},
    businessUnit = null,
    adminSettings = {},
    geography = '',
    applicableRegulations = [],
    priorPatterns = [],
    scenarioLensHint = ''
  } = {}) {
    const classification = _classifyScenario(narrative, {
      guidedInput,
      businessUnit,
      scenarioLensHint
    });
    const lens = _buildScenarioLens(classification);
    const eventCore = {
      classification,
      lens,
      narrative: _cleanUserFacingText(_stripScenarioLeadIns(narrative || ''), { maxSentences: 4 }),
      anchors: _extractGuidedDraftAnchors({ guidedInput }, narrative),
      primaryDriver: String(classification?.primaryDriver || '').trim(),
      eventPath: String(classification?.eventPath || '').trim(),
      effect: String(guidedInput?.impact || classification?.effect || '').trim()
    };
    const sources = [
      {
        key: 'organisation',
        label: 'Organisation context',
        kind: 'organisation',
        text: [
          adminSettings?.inheritedContextSummary,
          adminSettings?.companyContextProfile,
          adminSettings?.companyStructureContext
        ].filter(Boolean).join(' ')
      },
      {
        key: 'business_unit',
        label: 'Business unit context',
        kind: 'business-unit',
        text: [
          businessUnit?.name ? `Business unit: ${businessUnit.name}` : '',
          businessUnit?.contextSummary,
          businessUnit?.notes,
          Array.isArray(businessUnit?.criticalServices) && businessUnit.criticalServices.length
            ? `Critical services: ${businessUnit.criticalServices.join(', ')}`
            : '',
          Array.isArray(businessUnit?.dataTypes) && businessUnit.dataTypes.length
            ? `Data types: ${businessUnit.dataTypes.join(', ')}`
            : ''
        ].filter(Boolean).join(' ')
      },
      {
        key: 'department',
        label: 'Function context',
        kind: 'department',
        text: [
          adminSettings?.departmentContext,
          businessUnit?.selectedDepartmentContext
        ].filter(Boolean).join(' ')
      },
      {
        key: 'user',
        label: 'User context',
        kind: 'user',
        text: [
          adminSettings?.userProfileSummary,
          adminSettings?.personalContextSummary
        ].filter(Boolean).join(' ')
      },
      {
        key: 'guidance',
        label: 'AI guidance',
        kind: 'guidance',
        text: [
          businessUnit?.aiGuidance,
          adminSettings?.aiInstructions
        ].filter(Boolean).join(' ')
      },
      {
        key: 'geography',
        label: 'Geography',
        kind: 'geography',
        text: String(geography || businessUnit?.geography || adminSettings?.geography || '').trim()
      },
      {
        key: 'regulations',
        label: 'Applicable regulations',
        kind: 'regulations',
        text: (Array.isArray(applicableRegulations) ? applicableRegulations : []).map(String).filter(Boolean).join(', ')
      },
      ...((Array.isArray(priorPatterns) ? priorPatterns : []).slice(0, 3).map((pattern, index) => ({
        key: `prior_pattern_${index + 1}`,
        label: `Prior pattern ${index + 1}`,
        kind: 'prior-pattern',
        title: pattern?.scenarioTitle || pattern?.scenarioType || 'Prior scenario',
        summary: `Geography: ${pattern?.geography || 'unknown'}; posture: ${pattern?.posture || 'unknown'}; confidence: ${pattern?.confidenceLabel || 'unknown'}; recommendation: ${pattern?.keyRecommendation || 'none recorded'}`,
        scenarioType: pattern?.scenarioType || '',
        text: ''
      })))
    ].map((source) => _scoreContextApplicability(source, eventCore));

    const applies = sources.filter(source => source.status === 'applies');
    const maybe = sources.filter(source => source.status === 'maybe');
    const ignore = sources.filter(source => source.status === 'ignore');
    const pickBucketText = (kind) => {
      const candidates = applies
        .concat(maybe.filter(source => kind === 'user' || source.kind !== 'guidance'))
        .filter(source => source.kind === kind)
        .map(source => source.text)
        .filter(Boolean);
      return candidates.length ? _truncateText(candidates.join('\n\n'), 1400) : '(none approved for this scenario)';
    };

    return {
      classification,
      lens,
      eventCore,
      sources,
      applies,
      maybe,
      ignore,
      approvedContext: {
        organisation: pickBucketText('organisation'),
        businessUnit: pickBucketText('business-unit'),
        department: pickBucketText('department'),
        user: pickBucketText('user'),
        guidance: pickBucketText('guidance'),
        geography: pickBucketText('geography'),
        regulations: pickBucketText('regulations'),
        priorPatterns: pickBucketText('prior-pattern')
      }
    };
  }

  function _buildContextResolutionPromptBlock(resolution = {}) {
    const eventCore = resolution?.eventCore || {};
    const classification = resolution?.classification || {};
    const lens = resolution?.lens || _buildScenarioLens(classification);
    const formatSources = (items = []) => items.length
      ? items.map((item) => `- ${item.label}: ${_truncateText(item.text || '', 260)} | use for: ${item.useFor} | reason: ${item.reason}`).join('\n')
      : '- (none)';
    return [
      'Scenario core:',
      `- Primary lens: ${lens?.label || classification?.scenarioType || 'General enterprise risk'}`,
      `- Event path: ${eventCore?.eventPath || classification?.eventPath || 'Unknown'}`,
      `- Primary driver: ${eventCore?.primaryDriver || classification?.primaryDriver || 'Unknown'}`,
      `- Main consequence: ${eventCore?.effect || classification?.effect || 'Unknown'}`,
      eventCore?.anchors?.length ? `- Anchor terms: ${eventCore.anchors.slice(0, 8).join(', ')}` : '',
      '',
      'Context applicability:',
      'APPLIES:',
      formatSources(resolution?.applies || []),
      '',
      'MAYBE:',
      formatSources(resolution?.maybe || []),
      '',
      'IGNORE:',
      formatSources(resolution?.ignore || []),
      '',
      'Approved hierarchical context for generation:',
      `ORG_CONTEXT:\n${resolution?.approvedContext?.organisation || '(none approved for this scenario)'}`,
      `BU_CONTEXT:\n${resolution?.approvedContext?.businessUnit || '(none approved for this scenario)'}`,
      `FUNCTION_CONTEXT:\n${resolution?.approvedContext?.department || '(none approved for this scenario)'}`,
      `USER_CONTEXT:\n${resolution?.approvedContext?.user || '(none approved for this scenario)'}`,
      `GUIDANCE_CONTEXT:\n${resolution?.approvedContext?.guidance || '(none approved for this scenario)'}`,
      `GEOGRAPHY_SCOPE:\n${resolution?.approvedContext?.geography || '(none approved for this scenario)'}`,
      `REGULATORY_SCOPE:\n${resolution?.approvedContext?.regulations || '(none approved for this scenario)'}`,
      `PRIOR_MATCHING_PATTERNS:\n${resolution?.approvedContext?.priorPatterns || '(none approved for this scenario)'}`,
      '',
      'Use only APPLIES items to determine scenario type and candidate risks. MAYBE items may refine wording or workflow guidance, but must not change the event domain. IGNORE items must not appear in the draft, summary, or risk shortlist unless directly evidenced by the scenario text.'
    ].filter(Boolean).join('\n');
  }

  function _getAiFeedbackLearningProfile({ buId = '', functionKey = '', scenarioLensKey = '' } = {}) {
    try {
      if (typeof OrgIntelligenceService === 'undefined' || typeof OrgIntelligenceService.getHierarchicalFeedbackProfile !== 'function') return null;
      return OrgIntelligenceService.getHierarchicalFeedbackProfile({
        buId,
        functionKey,
        scenarioLensKey
      });
    } catch {
      return null;
    }
  }

  function _buildFeedbackLearningPromptBlock(profile = null) {
    const combined = profile?.combined;
    if (!combined || !Array.isArray(combined.activeTiers) || !combined.activeTiers.length) {
      return 'Feedback priors:\n- No proven live-AI feedback priors are active for this scenario yet.';
    }
    const issueLabel = (value = '') => String(value || '').replace(/^(draft|shortlist):/, '').replace(/-/g, ' ');
    return [
      'Feedback priors from repeated live-AI feedback:',
      `- Active tiers: ${combined.activeTiers.join(', ')}`,
      `- Draft pressure: ${combined.draftPressure < -0.25 ? 'tighten and stay closer to the user event path' : combined.draftPressure > 0.25 ? 'current draft patterns are generally landing well' : 'neutral'}`,
      `- Shortlist pressure: ${combined.shortlistPressure < -0.25 ? 'be more selective and avoid off-path risks' : combined.shortlistPressure > 0.25 ? 'current shortlist patterns are generally landing well' : 'neutral'}`,
      combined.wrongDomainPressure > 0 ? '- Repeated failure mode: domain drift. Keep the explicit user event path above profile, compliance, and cyber context.' : '',
      combined.weakCitationPressure > 0 ? '- Repeated failure mode: weak citations. Prefer documents that directly match the event path and avoid decorative references.' : '',
      combined.preferredRiskTitles?.length ? `- Frequently retained risks in similar scenarios: ${combined.preferredRiskTitles.map(item => item.title).join(', ')}` : '',
      combined.avoidRiskTitles?.length ? `- Frequently removed risks in similar scenarios: ${combined.avoidRiskTitles.map(item => item.title).join(', ')}` : '',
      combined.topIssues?.length ? `- Common review issues to avoid: ${combined.topIssues.map(item => issueLabel(item.reason)).join(', ')}` : '',
      '- Use these priors to refine ranking and wording only. They must not override an explicit user event path.'
    ].filter(Boolean).join('\n');
  }

  function _lookupFeedbackRiskWeight(feedbackProfile = null, title = '') {
    if (!feedbackProfile || typeof feedbackProfile !== 'object' || !title) return 0;
    const target = _normaliseText(title || '', 180).toLowerCase();
    return Object.entries(feedbackProfile.riskWeights || {}).reduce((best, [key, value]) => {
      return _normaliseText(key || '', 180).toLowerCase() === target ? Number(value || 0) : best;
    }, 0);
  }

  function _rerankRisksWithFeedback(risks = [], feedbackProfile = null) {
    const combined = feedbackProfile?.combined;
    if (!combined || !Array.isArray(risks) || !risks.length) return Array.isArray(risks) ? risks : [];
    return risks
      .map((risk, index) => {
        const weight = _lookupFeedbackRiskWeight(combined, risk?.title || '');
        const confidence = String(risk?.confidence || '').trim().toLowerCase();
        const confidenceScore = confidence === 'high' ? 1.2 : confidence === 'medium' ? 0.5 : confidence === 'low' ? -0.2 : 0;
        return {
          risk,
          index,
          score: weight * 1.9 + confidenceScore
        };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(item => item.risk);
  }

  function _isScenarioTextCoherent(text = '', {
    seedNarrative = '',
    guidedInput = {},
    classification = {}
  } = {}) {
    const cleaned = _cleanUserFacingText(text, { maxSentences: 4 });
    if (!cleaned) return false;
    if (_looksGenericRiskContextCopy(cleaned)) return false;
    const anchors = _extractGuidedDraftAnchors({ guidedInput }, seedNarrative);
    const overlap = _countScenarioAnchorOverlap(cleaned, anchors);
    const expectedLens = _normaliseScenarioHintKey(classification?.key || '');
    const actualLens = _classifyScenario(cleaned, {
      guidedInput,
      scenarioLensHint: expectedLens
    }).key;
    const lensCompatible = !expectedLens
      || !actualLens
      || actualLens === expectedLens
      || _isCompatibleScenarioLens(expectedLens, actualLens);
    const minOverlap = anchors.length >= 5 ? 2 : anchors.length ? 1 : 0;
    return lensCompatible && overlap >= minOverlap;
  }

  function _withEvidenceMeta(result = {}, evidenceMeta = null) {
    const meta = evidenceMeta || {};
    const normalised = {
      ...result,
      confidenceLabel: String(result.confidenceLabel || meta.confidenceLabel || 'Moderate confidence'),
      evidenceQuality: String(result.evidenceQuality || meta.evidenceQuality || 'Useful but incomplete evidence base'),
      evidenceSummary: String(result.evidenceSummary || meta.summary || 'Evidence used: limited contextual inputs only.'),
      primaryGrounding: Array.isArray(result.primaryGrounding)
        ? result.primaryGrounding.filter(Boolean).slice(0, 3)
        : (Array.isArray(meta.primaryGrounding) ? meta.primaryGrounding.filter(Boolean).slice(0, 3) : []),
      supportingReferences: Array.isArray(result.supportingReferences)
        ? result.supportingReferences.filter(Boolean).slice(0, 3)
        : (Array.isArray(meta.supportingReferences) ? meta.supportingReferences.filter(Boolean).slice(0, 3) : []),
      inferredAssumptions: Array.isArray(result.inferredAssumptions)
        ? result.inferredAssumptions.filter(Boolean).slice(0, 4)
        : (Array.isArray(meta.inferredAssumptions) ? meta.inferredAssumptions.filter(Boolean).slice(0, 4) : []),
      missingInformation: Array.isArray(result.missingInformation)
        ? result.missingInformation.filter(Boolean).slice(0, 4)
        : (Array.isArray(meta.missingInformation) ? meta.missingInformation.filter(Boolean).slice(0, 4) : []),
      workflowGuidance: Array.isArray(result.workflowGuidance) ? result.workflowGuidance.filter(Boolean) : [],
      citations: Array.isArray(result.citations) ? result.citations.filter(Boolean) : []
    };
    return normalised;
  }

  async function _auditAiFallback(taskName, error, details = {}) {
    await _auditAiEvent('ai_request_failed', 'failure', {
      taskName,
      message: _sanitizeAiText(error?.message || error || 'Unknown AI failure', { maxChars: 240 }),
      ...details
    });
    await _auditAiEvent('ai_fallback_used', 'success', {
      taskName,
      ...details
    });
  }

  function _classifyAiFallbackReason(error = null) {
    const message = String(error?.message || error || '').trim();
    const safeMessage = _sanitizeAiText(message, { maxChars: 220 });
    const withDetail = (base, detail) => ({
      ...base,
      detail: String(detail || '').trim()
    });
    if (!safeMessage) {
      return withDetail({
        code: 'no_ai_response',
        title: 'AI analysis unavailable',
        message: 'The AI register-analysis service did not return a usable response, so the platform used local extraction instead.'
      }, 'No response content was returned.');
    }
    if (/Missing COMPASS_API_KEY secret/i.test(safeMessage)) {
      return withDetail({
        code: 'proxy_missing_secret',
        title: 'AI analysis unavailable',
        message: 'The hosted AI proxy is missing its server-side key, so the platform used local extraction instead.'
      }, 'The proxy is missing its Compass key.');
    }
    if (/Vercel proxy could not reach Compass|Compass preflight\/CORS blocked|Failed to fetch|NetworkError/i.test(safeMessage)) {
      return withDetail({
        code: 'proxy_unreachable',
        title: 'AI analysis unavailable',
        message: 'The hosted AI service could not be reached, so the platform used local extraction instead.'
      }, safeMessage);
    }
    if (/Compass rejected the request|401|403/i.test(safeMessage)) {
      return withDetail({
        code: 'ai_access_rejected',
        title: 'AI analysis unavailable',
        message: 'The AI service rejected the request, so the platform used local extraction instead.'
      }, safeMessage);
    }
    if (/Unexpected token|JSON|schema|parse/i.test(safeMessage)) {
      return withDetail({
        code: 'invalid_ai_output',
        title: 'AI analysis incomplete',
        message: 'The AI service returned an unusable structured response, so the platform used local extraction instead.'
      }, safeMessage);
    }
    if (/response shape was not usable/i.test(safeMessage)) {
      return withDetail({
        code: 'unexpected_response_shape',
        title: 'AI analysis incomplete',
        message: 'The AI service returned an unexpected response shape, so the platform used local extraction instead.'
      }, safeMessage);
    }
    return withDetail({
      code: 'ai_runtime_error',
      title: 'AI analysis unavailable',
      message: 'The AI register-analysis step failed at runtime, so the platform used local extraction instead.'
    }, safeMessage);
  }

  function _collectScenarioSecondaryKeys({
    primaryKey = 'general',
    hintKey = '',
    activeKeys = [],
    hintedEnterpriseMatch = {}
  } = {}) {
    const secondary = [];
    const pushKey = (value) => {
      const key = _normaliseScenarioHintKey(value);
      if (!key || key === primaryKey || key === 'general' || secondary.includes(key)) return;
      secondary.push(key);
    };
    (Array.isArray(activeKeys) ? activeKeys : []).forEach(pushKey);
    if (hintKey && hintedEnterpriseMatch[hintKey]) pushKey(hintKey);
    return secondary.slice(0, 3);
  }

  function _hasOperationalOutageSignals(text = '') {
    return /(downtime|outage|service disruption|operational disruption|critical operational disruption|availability|unavailable|degrad|aging infrastructure|ageing infrastructure|legacy infrastructure|human error|manual error|platform instability|system instability|service failure|process failure|recovery effort|recovery strain|core service)/.test(String(text || '').toLowerCase());
  }

  function _hasExplicitCyberCompromiseSignals(text = '') {
    return /(cyber|security|identity|credential|ransom|malware|phish|breach|exfil|privileged|unauthori[sz]ed|misconfig|vulnerability|token theft|session hijack|attacker|threat actor|compromise|account takeover|tenant change|public exposure|storage exposure|data exposure)/.test(String(text || '').toLowerCase());
  }

  function _extractExplicitScenarioLeadLens(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/^(?:[a-z-]+-urgency\s+)?([a-z0-9 /-]+?)\s+(?:risk\s+)?scenario:/i);
    return match?.[1] ? _normaliseScenarioHintKey(match[1]) : '';
  }

  function _classifyScenario(narrative = '', options = {}) {
    const guidedText = [
      options.guidedInput?.event,
      options.guidedInput?.asset,
      options.guidedInput?.cause,
      options.guidedInput?.impact
    ].filter(Boolean).join(' ');
    const businessContext = [
      options.businessUnit?.name,
      options.businessUnit?.contextSummary,
      options.businessUnit?.notes
    ].filter(Boolean).join(' ');
    const directScenarioText = [narrative, guidedText].filter(Boolean).join(' ').trim();
    const n = String(directScenarioText || businessContext || '').toLowerCase();
    const hintKey = _normaliseScenarioHintKey(options.scenarioLensHint);
    const hasOperationalOutageSignals = _hasOperationalOutageSignals(n);
    const hasExplicitCyberCompromiseSignals = _hasExplicitCyberCompromiseSignals(n);
    const mentionsCloudPlatform = n.includes('cloud') || n.includes('azure') || n.includes('aws') || n.includes('gcp') || n.includes('infrastructure') || n.includes('platform');

    const isRansomware = n.includes('ransomware') || n.includes('encrypt') || n.includes('ransom');
    const isIdentity = n.includes('azure ad') || n.includes('active directory') || n.includes('entra') || n.includes('identity') || n.includes('sso') || n.includes('directory service');
    const isPhishing = !isIdentity && (
      n.includes('phish')
      || /\bbec\b/.test(n)
      || n.includes('business email compromise')
      || n.includes('email compromise')
      || n.includes('spoof')
    );
    const isDataBreach = n.includes('breach') || n.includes('data theft') || n.includes('exfil') || n.includes('data exposure');
    const isInsider = n.includes('insider') || n.includes('employee misuse') || n.includes('malicious insider') || n.includes('privilege abuse');
    const isCloud = !isIdentity && (
      n.includes('misconfigur')
      || n.includes('s3')
      || n.includes('bucket')
      || n.includes('storage exposure')
      || n.includes('public exposure')
      || (mentionsCloudPlatform && hasExplicitCyberCompromiseSignals && !hasOperationalOutageSignals)
    );
    const isAiModel = n.includes('responsible ai') || n.includes('model risk') || n.includes('model drift') || n.includes('hallucination') || n.includes('algorithmic bias') || n.includes('training data') || /\bai\b/.test(n);
    const isDataGovernance = n.includes('data governance') || n.includes('data quality') || n.includes('data lineage') || n.includes('retention') || n.includes('purpose limitation') || n.includes('consent') || n.includes('data residency') || n.includes('master data') || (n.includes('privacy') && !n.includes('breach') && !n.includes('exfil'));
    const isStrategic = n.includes('strategy') || n.includes('strategic') || n.includes('market') || n.includes('competitive') || n.includes('transformation') || n.includes('portfolio') || n.includes('investment') || n.includes('operating model') || n.includes('programme');
    const isOperational = hasOperationalOutageSignals || n.includes('operational') || n.includes('process failure') || n.includes('breakdown') || n.includes('capacity') || n.includes('service failure') || n.includes('backlog');
    const isRegulatory = n.includes('regulator') || n.includes('regulatory') || n.includes('licen') || n.includes('sanction') || n.includes('export control') || n.includes('filing');
    const isCounterpartyCredit = n.includes('bankrupt') || n.includes('bankruptcy') || n.includes('insolv') || n.includes('receivable') || n.includes('bad debt') || n.includes('write-off') || n.includes('write off') || n.includes('counterparty') || n.includes('customer default') || n.includes('client default') || n.includes('credit loss') || n.includes('credit exposure') || n.includes('collections') || n.includes('provisioning') || n.includes('working capital');
    const isFinancial = isCounterpartyCredit || n.includes('fraud') || n.includes('payment') || n.includes('invoice') || n.includes('treasury') || n.includes('liquidity') || n.includes('capital') || n.includes('financial');
    const isFraudIntegrity = n.includes('financial crime') || n.includes('money laundering') || n.includes('bribery') || n.includes('corruption') || n.includes('kickback') || n.includes('embezzlement') || (n.includes('integrity') && !n.includes('data integrity'));
    const isEsg = n.includes('esg') || n.includes('sustainability') || n.includes('climate') || n.includes('emission') || n.includes('carbon') || n.includes('greenwashing');
    const isCompliance = n.includes('compliance') || n.includes('non-compliance') || n.includes('policy breach') || n.includes('conduct') || n.includes('ethics') || n.includes('assurance');
    const isLegalContract = n.includes('contract') || n.includes('indemnity') || n.includes('litigation') || n.includes('licensing dispute') || n.includes('intellectual property') || /\bip\b/.test(n);
    const isGeopolitical = n.includes('geopolitical') || n.includes('market access') || n.includes('sovereign') || n.includes('tariff') || n.includes('entity list') || n.includes('cross-border restriction');
    const isSupplyChain = n.includes('supply chain') || n.includes('logistics') || n.includes('shipment') || n.includes('inventory') || n.includes('single source') || n.includes('single-source') || n.includes('upstream') || n.includes('shortfall');
    const isProcurement = n.includes('procurement') || n.includes('sourcing') || n.includes('tender') || n.includes('bid') || n.includes('contract award') || n.includes('vendor selection') || n.includes('critical spend') || n.includes('spend category') || n.includes('commercial category');
    const isThirdParty = n.includes('supplier') || n.includes('vendor') || n.includes('third-party') || n.includes('third party') || n.includes('outsourc');
    const isContinuity = n.includes('business continuity') || n.includes('disaster recovery') || n.includes('continuity') || n.includes('recovery') || n.includes('rto') || n.includes('rpo') || n.includes('crisis management');
    const isPhysicalSecurity = n.includes('physical security') || n.includes('badge control') || n.includes('visitor management') || n.includes('perimeter') || n.includes('executive protection') || n.includes('site intrusion') || n.includes('facility breach');
    const isOtResilience = /\bot\b/.test(n) || n.includes('operational technology') || n.includes('industrial control') || n.includes('ics') || n.includes('scada') || n.includes('plant network') || n.includes('site systems') || n.includes('control room');
    const isPeopleWorkforce = n.includes('workforce') || n.includes('attrition') || n.includes('fatigue') || n.includes('staffing') || n.includes('worker welfare') || n.includes('labour') || n.includes('labor') || n.includes('strike');
    const isHse = n.includes('hse') || n.includes('health and safety') || n.includes('safety') || n.includes('injury') || n.includes('environmental') || n.includes('spill') || n.includes('worker');
    const isInvestmentJv = n.includes('merger') || n.includes('acquisition') || n.includes('m&a') || n.includes('joint venture') || /\bjv\b/.test(n) || n.includes('integration thesis') || n.includes('synergy');
    const isTransformationDelivery = n.includes('transformation delivery') || n.includes('programme delivery') || n.includes('program delivery') || n.includes('project delivery') || n.includes('go-live') || n.includes('milestone') || n.includes('benefit realisation') || n.includes('benefit realization');

    const hintedEnterpriseMatch = {
      'ai-model-risk': isAiModel || isDataGovernance,
      'data-governance': isDataGovernance || isRegulatory,
      strategic: isStrategic || (!isRansomware && !isIdentity && !isPhishing && !isDataBreach && !isCloud && !isInsider && !isThirdParty && !isProcurement && !isSupplyChain && /\bprogramme|initiative|operating model|portfolio|market|transformation\b/.test(n)),
      operational: isOperational || isContinuity,
      regulatory: isRegulatory || isCompliance,
      financial: isFinancial,
      'fraud-integrity': isFraudIntegrity || isFinancial,
      esg: isEsg,
      compliance: isCompliance || isRegulatory,
      'legal-contract': isLegalContract || isRegulatory,
      geopolitical: isGeopolitical || isRegulatory,
      'supply-chain': isSupplyChain || isThirdParty || isProcurement,
      procurement: isProcurement || isSupplyChain || isThirdParty,
      'business-continuity': isContinuity || isOperational,
      'physical-security': isPhysicalSecurity || isOperational,
      'ot-resilience': isOtResilience || isOperational,
      'people-workforce': isPeopleWorkforce || isHse,
      'investment-jv': isInvestmentJv || isStrategic,
      'transformation-delivery': isTransformationDelivery || isStrategic,
      hse: isHse,
      'third-party': isThirdParty || isSupplyChain || isProcurement
    };
    const orderedSignals = [
      ['ransomware', isRansomware],
      ['identity', isIdentity],
      ['data-breach', isDataBreach],
      ['cloud', isCloud],
      ['phishing', isPhishing],
      ['insider', isInsider],
      ['ai-model-risk', isAiModel],
      ['data-governance', isDataGovernance],
      ['fraud-integrity', isFraudIntegrity],
      ['legal-contract', isLegalContract],
      ['geopolitical', isGeopolitical],
      ['physical-security', isPhysicalSecurity],
      ['ot-resilience', isOtResilience],
      ['people-workforce', isPeopleWorkforce],
      ['investment-jv', isInvestmentJv],
      ['transformation-delivery', isTransformationDelivery],
      ['strategic', isStrategic],
      ['operational', isOperational],
      ['regulatory', isRegulatory],
      ['financial', isFinancial],
      ['esg', isEsg],
      ['compliance', isCompliance],
      ['procurement', isProcurement],
      ['supply-chain', isSupplyChain],
      ['business-continuity', isContinuity],
      ['hse', isHse],
      ['third-party', isThirdParty]
    ];
    const explicitPrimary = orderedSignals.find(([, active]) => !!active)?.[0] || '';
    const primaryKey = explicitPrimary || (hintKey && hintedEnterpriseMatch[hintKey] ? hintKey : '') || 'general';
    const activeKeys = orderedSignals.filter(([, active]) => !!active).map(([key]) => key);
    const secondaryKeys = _collectScenarioSecondaryKeys({
      primaryKey,
      hintKey,
      activeKeys,
      hintedEnterpriseMatch
    });
    return _scenarioClassificationByKey(primaryKey, { secondaryKeys });
  }

  function _buildScenarioLens(classification = {}) {
    const key = String(classification?.key || 'general').trim() || 'general';
    const map = {
      ransomware: { label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'ransomware' },
      identity: { label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'identity' },
      phishing: { label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'phishing' },
      insider: { label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'identity' },
      cloud: { label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'cloud' },
      'data-breach': { label: 'Cyber', functionKey: 'technology', estimatePresetKey: 'dataBreach' },
      'ai-model-risk': { label: 'AI / model risk', functionKey: 'technology', estimatePresetKey: 'aiModelRisk' },
      'data-governance': { label: 'Data governance / privacy', functionKey: 'compliance', estimatePresetKey: 'dataGovernance' },
      'third-party': { label: 'Third-party', functionKey: 'procurement', estimatePresetKey: 'thirdParty' },
      strategic: { label: 'Strategic', functionKey: 'strategic', estimatePresetKey: 'strategic' },
      operational: { label: 'Operational', functionKey: 'operations', estimatePresetKey: 'operational' },
      regulatory: { label: 'Regulatory', functionKey: 'compliance', estimatePresetKey: 'regulatory' },
      financial: { label: 'Financial', functionKey: 'finance', estimatePresetKey: 'financial' },
      'fraud-integrity': { label: 'Fraud / integrity', functionKey: 'finance', estimatePresetKey: 'fraudIntegrity' },
      esg: { label: 'ESG', functionKey: 'strategic', estimatePresetKey: 'esg' },
      compliance: { label: 'Compliance', functionKey: 'compliance', estimatePresetKey: 'compliance' },
      'legal-contract': { label: 'Legal / contract', functionKey: 'compliance', estimatePresetKey: 'legalContract' },
      geopolitical: { label: 'Geopolitical / market access', functionKey: 'strategic', estimatePresetKey: 'geopolitical' },
      'supply-chain': { label: 'Supply chain', functionKey: 'procurement', estimatePresetKey: 'supplyChain' },
      procurement: { label: 'Procurement', functionKey: 'procurement', estimatePresetKey: 'procurement' },
      'business-continuity': { label: 'Business continuity', functionKey: 'operations', estimatePresetKey: 'businessContinuity' },
      'physical-security': { label: 'Physical security', functionKey: 'operations', estimatePresetKey: 'physicalSecurity' },
      'ot-resilience': { label: 'OT / site resilience', functionKey: 'operations', estimatePresetKey: 'otResilience' },
      'people-workforce': { label: 'People / workforce', functionKey: 'hse', estimatePresetKey: 'peopleWorkforce' },
      hse: { label: 'HSE', functionKey: 'hse', estimatePresetKey: 'hse' },
      'investment-jv': { label: 'Investment / JV', functionKey: 'strategic', estimatePresetKey: 'investmentJv' },
      'transformation-delivery': { label: 'Transformation delivery', functionKey: 'strategic', estimatePresetKey: 'transformationDelivery' },
      general: { label: 'General enterprise risk', functionKey: 'general', estimatePresetKey: 'general' }
    };
    const profile = map[key] || map.general;
    return {
      key,
      label: profile.label,
      functionKey: profile.functionKey,
      estimatePresetKey: profile.estimatePresetKey,
      secondaryKeys: Array.isArray(classification?.secondaryKeys)
        ? classification.secondaryKeys
            .map(item => _normaliseScenarioHintKey(item))
            .filter((item, index, list) => item && item !== key && list.indexOf(item) === index)
        : []
    };
  }

  function _normaliseScenarioLens(lens = {}, fallback = {}) {
    const merged = {
      ...fallback,
      ...(lens && typeof lens === 'object' ? lens : {})
    };
    return {
      key: String(merged.key || fallback.key || 'general').trim() || 'general',
      label: _cleanUserFacingText(merged.label || fallback.label || 'General enterprise risk', { maxSentences: 1, stripTrailingPeriod: true }) || 'General enterprise risk',
      functionKey: String(merged.functionKey || fallback.functionKey || 'general').trim() || 'general',
      estimatePresetKey: String(merged.estimatePresetKey || fallback.estimatePresetKey || 'general').trim() || 'general',
      secondaryKeys: Array.from(new Set([
        ...(Array.isArray(fallback.secondaryKeys) ? fallback.secondaryKeys : []),
        ...(Array.isArray(merged.secondaryKeys) ? merged.secondaryKeys : [])
      ].map(item => _normaliseScenarioHintKey(item)).filter(item => item && item !== (String(merged.key || fallback.key || 'general').trim() || 'general'))))
    };
  }

  function _cleanUserFacingText(value = '', { maxSentences = 0, stripTrailingPeriod = false } = {}) {
    let text = _dedupeSentences(String(value || '').replace(/\s+/g, ' ').trim());
    if (!text) return '';

    text = text
      .replace(/candidate risk identified from (?:the )?(?:intake text|uploaded register|register analysis)[^.]*\.?/gi, '')
      .replace(/a risk scenario is being assessed where\s*/gi, '')
      .replace(/this scenario should be assessed for\s*/gi, 'Focus on ')
      .replace(/current urgency is assessed as\s*/gi, 'Urgency is ')
      .replace(/the main asset, service, or team affected is\s*/gi, 'The scenario affects ')
      .replace(/the likely trigger or threat driver is\s*/gi, 'The likely trigger is ')
      .replace(/the expected business, operational, or regulatory impact is\s*/gi, 'The likely impact is ')
      .replace(/given the stated urgency,?\s*/gi, '')
      .replace(/in practice, this can drive\s*/gi, 'This could lead to ')
      .replace(/a likely progression is\s*/gi, 'The most likely progression is ')
      .replace(/material-control scenario/gi, 'material scenario')
      .replace(/\s+\./g, '.')
      .replace(/\.\./g, '.')
      .replace(/\s+,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (maxSentences > 0) {
      text = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, maxSentences).join(' ').trim();
    }
    if (stripTrailingPeriod) {
      text = text.replace(/[.]+$/g, '').trim();
    }
    return text;
  }

  function _normaliseGuidance(items = []) {
    return Array.from(new Set((Array.isArray(items) ? items : [])
      .map((item) => _cleanUserFacingText(item, { maxSentences: 1, stripTrailingPeriod: true }))
      .filter(Boolean)))
      .slice(0, 5);
  }

  function _normaliseInputRationale(value = {}) {
    return {
      tef: _cleanUserFacingText(value?.tef || '', { maxSentences: 2 }),
      vulnerability: _cleanUserFacingText(value?.vulnerability || '', { maxSentences: 2 }),
      lossComponents: _cleanUserFacingText(value?.lossComponents || '', { maxSentences: 2 })
    };
  }

  function _normaliseBenchmarkBasis(value = '') {
    return _cleanUserFacingText(value, { maxSentences: 3 });
  }

  function _normaliseRiskCards(risks = []) {
    const normaliseConfidence = (value) => {
      const lowered = String(value || '').trim().toLowerCase();
      return lowered === 'high' || lowered === 'low' || lowered === 'medium' ? lowered : 'medium';
    };
    const cleaned = (Array.isArray(risks) ? risks : []).map((risk) => ({
      ...risk,
      title: _cleanUserFacingText(risk.title || '', { maxSentences: 1, stripTrailingPeriod: true }),
      // Do not silently relabel missing categories as cyber when the scenario may be strategic or operational.
      category: _toDisplayLabel(_cleanUserFacingText(risk.category || 'General', { maxSentences: 1, stripTrailingPeriod: true }) || 'General') || 'General',
      description: _cleanUserFacingText(risk.description || '', { maxSentences: 2 }),
      impact: _cleanUserFacingText(risk.impact || '', { maxSentences: 1 }),
      why: _cleanUserFacingText(risk.why || '', { maxSentences: 2 }),
      confidence: normaliseConfidence(risk.confidence),
      regulations: Array.from(new Set((risk.regulations || []).map(String).filter(Boolean))).slice(0, 5)
    })).filter((risk) => risk.title);

    const hasSpecific = cleaned.some((risk) => !_isGenericRiskTitle(risk.title));
    const seen = new Set();
    return cleaned.filter((risk) => {
      if (hasSpecific && _isGenericRiskTitle(risk.title)) return false;
      const key = _normaliseSentenceKey(risk.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function _generateStub(narrative, buContext, citations, benchmarkCandidates = []) {
    const classification = _classifyScenario(narrative, {
      businessUnit: buContext,
      scenarioLensHint: buContext?.scenarioLensHint
    });
    const scenarioLens = _buildScenarioLens(classification);

    let scenarioType = classification.scenarioType;
    let tef = { ...classification.tef };
    let cs = { min: 0.5, likely: 0.68, max: 0.85 };
    let tc = { ...classification.tc };
    let recommendations = [];

    if (classification.key === 'ransomware') {
      recommendations = [
        { title: 'Immutable Offline Backups', why: 'Ransomware relies on destroying recovery options. Offline backups with verified restore tests eliminate the primary leverage attackers hold.', impact: 'Reduces recovery time from 18+ days to <5 days; eliminates ransom leverage.' },
        { title: 'MFA on All Privileged Accounts', why: 'Ransomware actors consistently abuse compromised credentials. Phishing-resistant MFA prevents privileged expansion after initial access.', impact: 'Estimated 80% reduction in successful credential-based lateral movement.' },
        { title: 'Endpoint Detection & Response (EDR)', why: 'Behavioural EDR detects ransomware staging before encryption begins.', impact: 'Average dwell time reduction from days to under 24 hours with mature EDR.' },
        { title: 'Network Segmentation', why: 'Segmentation limits blast radius and prevents a single compromise from taking out multiple business services.', impact: 'Can reduce impacted systems by 60–80% in a ransomware event.' }
      ];
    } else if (classification.key === 'data-breach') {
      recommendations = [
        { title: 'Data Loss Prevention (DLP)', why: 'Exfiltration control is a primary lever in data breach scenarios.', impact: 'Reduces exfiltration window and narrows breach scope.' },
        { title: 'Data Classification Enforcement', why: 'Classification improves handling controls and reduces accidental exposure.', impact: 'Directly reduces the scale of data-at-risk and notification burden.' },
        { title: 'Zero Trust Access Controls', why: 'Least-privilege access reduces the attacker path to sensitive data stores.', impact: 'Lowers breach scope and slows attacker progression.' },
        { title: 'Breach Notification Runbook', why: 'Prepared regulatory and legal response reduces late-notification and escalation risk.', impact: 'Cuts legal friction and response delay after confirmed exposure.' }
      ];
    } else if (classification.key === 'identity') {
      recommendations = [
        { title: 'Phishing-Resistant MFA for Privileged Identities', why: 'Identity compromise commonly begins with credential or token theft. Strong MFA materially reduces that entry path.', impact: 'Significantly lowers the chance of privileged account takeover.' },
        { title: 'Conditional Access and Anomalous Sign-In Tuning', why: 'Identity-led incidents are contained faster when risk-based access controls and sign-in detections are tuned well.', impact: 'Improves early detection and reduces attacker dwell time.' },
        { title: 'Privileged Identity Management', why: 'Just-in-time admin access reduces standing privilege exposure inside the identity tier.', impact: 'Limits blast radius from a compromised administrator account.' },
        { title: 'Mailbox and Identity Recovery Runbook', why: 'Identity incidents often spill into email compromise, fraud, and user lockout.', impact: 'Reduces disruption time and downstream financial loss.' }
      ];
    } else if (classification.key === 'cloud') {
      recommendations = [
        { title: 'Cloud Security Posture Management (CSPM)', why: 'Misconfigurations remain a leading driver of cloud exposure events.', impact: 'Reduces misconfiguration dwell time from weeks to hours and gives management a clearer control baseline.' },
        { title: 'Infrastructure as Code Security Scanning', why: 'Pre-deployment controls prevent repeat configuration drift.', impact: 'Prevents a large share of common cloud misconfigurations before they affect production services.' },
        { title: 'Privileged Access Management for Cloud Consoles', why: 'Over-permissive console access is a catastrophic single point of failure.', impact: 'Limits blast radius of compromised cloud credentials and narrows the likely breach scope.' },
        { title: 'Real-Time Alerting on Public Exposure', why: 'Publicly exposed services are often discovered and abused quickly.', impact: 'Reduces exploitation windows materially and shortens the period of unmanaged exposure.' }
      ];
    } else if (classification.key === 'ai-model-risk') {
      recommendations = [
        { title: 'Model Inventory And Accountability Refresh', why: 'AI downside often starts with unclear ownership over which models are live, who approves them, and what decisions they influence.', impact: 'Improves governance clarity and reduces unmanaged model exposure across the estate.' },
        { title: 'Human Oversight And Safe-Use Guardrails', why: 'Responsible-AI failures become expensive when risky outputs can move directly into operations or external communication without challenge.', impact: 'Reduces conduct, regulatory, and trust loss from unsafe model behaviour.' },
        { title: 'Model Monitoring For Drift And Harm Signals', why: 'Weak monitoring leaves teams blind to bias, hallucination, or degradation until the issue becomes externally visible.', impact: 'Improves early detection and narrows remediation scope before confidence collapses.' },
        { title: 'AI Risk Review Against Formal Policy And Regulation', why: 'Management needs a repeatable challenge framework when AI use begins to create policy, privacy, or supervisory pressure.', impact: 'Improves defensibility of AI-enabled decisions and strengthens executive confidence.' }
      ];
    } else if (classification.key === 'data-governance') {
      recommendations = [
        { title: 'Critical Data Ownership And Lineage Review', why: 'Data-governance failures usually persist because ownership, approved use, and lineage are still too ambiguous.', impact: 'Improves confidence in source data and reduces downstream remediation rework.' },
        { title: 'Retention And Purpose-Limitation Control Reset', why: 'Privacy and approved-use problems get more expensive when stale or uncontrolled data keeps moving through operational workflows.', impact: 'Narrows privacy exposure and reduces disclosure or remediation burden.' },
        { title: 'Sensitive Data Access And Exception Monitoring', why: 'Weak access and ad hoc exceptions amplify governance failures once the issue is discovered.', impact: 'Improves visibility into who can use sensitive data and how fast drift is detected.' },
        { title: 'Data Quality Escalation Thresholds', why: 'Leadership needs a clear trigger for when data confidence is too weak to support reporting, analytics, or regulated decisions.', impact: 'Improves intervention timing and reduces confidence erosion in critical outputs.' }
      ];
    } else if (classification.key === 'phishing') {
      recommendations = [
        { title: 'Phishing-Resistant MFA', why: 'Phishing and session hijack campaigns increasingly bypass weak MFA patterns.', impact: 'Near-elimination of credential takeover from basic phishing paths and a clearer reduction in identity-driven fraud exposure.' },
        { title: 'Advanced Email Security Controls', why: 'Reducing malicious messages reaching users remains one of the strongest volume controls.', impact: 'Substantially lowers phishing exposure at inbox level before more expensive response work starts.' },
        { title: 'BEC Payment Verification Controls', why: 'Out-of-band verification and approval hardening reduce direct fraud loss.', impact: 'Cuts the main financial-loss path in many BEC cases and improves executive confidence in payment governance.' },
        { title: 'Security Awareness and Simulation Programme', why: 'Human detection remains an important last line of defence.', impact: 'Reduces click-through, improves early reporting, and supports better measurement of people risk over time.' }
      ];
    } else if (classification.key === 'third-party') {
      recommendations = [
        { title: 'Tiered Critical Supplier Assurance', why: 'A lightweight but disciplined criticality model keeps the most important suppliers under the strongest assurance and continuity expectations.', impact: 'Improves visibility over inherited exposure and reduces surprise disruption from key dependencies.' },
        { title: 'Contracted Resilience And Exit Clauses', why: 'Recovery obligations, notification triggers, and exit rights reduce dependence on goodwill during a supplier incident.', impact: 'Improves leverage, shortens response ambiguity, and reduces downstream recovery delay.' },
        { title: 'Concentration And Single-Point-Of-Failure Review', why: 'Third-party scenarios are often amplified by hidden concentration risk or non-substitutable services.', impact: 'Reduces severe disruption exposure and gives management clearer fallback options.' },
        { title: 'Shared Incident And Escalation Runbook', why: 'Joint response quality matters as much as vendor due diligence once a disruption begins.', impact: 'Improves coordination speed and reduces operational confusion during a supplier-led event.' }
      ];
    } else if (classification.key === 'strategic') {
      recommendations = [
        { title: 'Decision Gate Review For The Strategic Assumption', why: 'Strategic scenarios usually hinge on one assumption that is being treated as fixed when it should be challenged.', impact: 'Improves early course correction and reduces expensive late-stage programme drag.' },
        { title: 'Trigger-Based Management Reporting', why: 'Clear leading indicators help management intervene before the issue becomes a full strategic miss.', impact: 'Creates earlier escalation and a more defensible executive response path.' },
        { title: 'Recovery Options And Contingency Playbook', why: 'Strategic issues get more expensive when there is no prepared alternative path.', impact: 'Shortens correction time and narrows downside if the primary plan fails.' },
        { title: 'Portfolio Exposure Review', why: 'Many strategic risks are concentrated in one initiative, market assumption, or dependency.', impact: 'Improves capital allocation and reduces the chance of cascading execution drag.' }
      ];
    } else if (classification.key === 'operational') {
      recommendations = [
        { title: 'Control Point Stabilisation', why: 'Operational scenarios usually start with a weak handoff, control, or capacity choke point.', impact: 'Reduces repeat failure and improves the reliability of the day-to-day operating path.' },
        { title: 'Backlog And Capacity Triggers', why: 'Waiting until service degradation is obvious makes operational losses more expensive.', impact: 'Improves early intervention and reduces severe service strain.' },
        { title: 'Fallback Workflow And Manual Workaround Design', why: 'Operational resilience improves when teams have a controlled degraded mode instead of improvising under pressure.', impact: 'Narrows disruption cost and keeps core service outputs moving during stress.' },
        { title: 'Root-Cause Review With Ownership', why: 'Sustained operational loss usually reflects repeatable control or process weakness.', impact: 'Converts firefighting into durable improvement and reduces recurrence.' }
      ];
    } else if (classification.key === 'regulatory') {
      recommendations = [
        { title: 'Obligation Mapping And Ownership Refresh', why: 'Regulatory loss often follows unclear ownership of filings, licence conditions, or supervisory commitments.', impact: 'Reduces surprise non-compliance and improves accountability for regulated activity.' },
        { title: 'Regulator-Ready Evidence Pack', why: 'Being able to show control evidence quickly changes the tone and cost of a regulatory event.', impact: 'Reduces remediation friction and helps management defend the current position credibly.' },
        { title: 'Supervisory Escalation Runbook', why: 'Regulatory incidents become more expensive when the escalation path is improvised.', impact: 'Improves timeliness of disclosure and reduces management uncertainty during enforcement pressure.' },
        { title: 'Control Testing On The Highest-Risk Obligation', why: 'A small number of obligations usually drive the majority of downside.', impact: 'Improves assurance quality and lowers the chance of repeat findings.' }
      ];
    } else if (classification.key === 'financial') {
      recommendations = [
        { title: 'Out-Of-Band Approval Controls', why: 'Financial-loss scenarios often succeed because a critical approval or release point is too easy to bypass.', impact: 'Directly reduces fraud and payment-manipulation loss paths.' },
        { title: 'Exception And Reconciliation Monitoring', why: 'Faster detection changes the size of financial loss materially.', impact: 'Improves recovery, shortens exposure duration, and raises executive confidence in the control environment.' },
        { title: 'Control Segregation Review', why: 'Financial incidents are amplified by weak segregation or emergency-access sprawl.', impact: 'Narrows the likelihood and blast radius of internal or external manipulation.' },
        { title: 'Fraud Response Playbook With Treasury And Legal', why: 'The early hours matter when funds, approvals, or commercial obligations are involved.', impact: 'Improves containment and reduces follow-on contractual or liquidity stress.' }
      ];
    } else if (classification.key === 'fraud-integrity') {
      recommendations = [
        { title: 'Conflict, Collusion, And Override Challenge Review', why: 'Integrity scenarios often depend on hidden override paths, unmanaged conflicts, or collusion that looked ordinary in the workflow.', impact: 'Improves visibility over the true manipulation path and reduces repeat integrity loss.' },
        { title: 'Investigation-Ready Evidence And Case Logging', why: 'Fraud and financial-crime scenarios become more expensive when management cannot quickly preserve and reconstruct the evidence trail.', impact: 'Improves recovery potential and strengthens assurance or legal response.' },
        { title: 'Third-Party And Counterparty Integrity Due Diligence', why: 'External parties frequently carry the hidden conflict or bribery exposure in integrity-led scenarios.', impact: 'Reduces inherited fraud and corruption pressure across the control environment.' },
        { title: 'Executive Escalation For Integrity Exceptions', why: 'When integrity indicators surface, delayed escalation is often the difference between a contained case and a wider conduct failure.', impact: 'Improves intervention timing and limits downstream legal or reputational damage.' }
      ];
    } else if (classification.key === 'esg') {
      recommendations = [
        { title: 'Disclosure Control And Evidence Review', why: 'ESG downside often comes from weak support for claims rather than a single headline event.', impact: 'Improves reporting defensibility and reduces greenwashing or disclosure-challenge risk.' },
        { title: 'Management Trigger Thresholds', why: 'Material ESG deterioration needs earlier escalation than most teams currently use.', impact: 'Improves intervention timing and reduces reactive remediation cost.' },
        { title: 'Supplier And Data Lineage Checks', why: 'Sustainability metrics frequently rely on upstream data with uneven quality.', impact: 'Improves confidence in the operating and reporting baseline.' },
        { title: 'Stakeholder Communication Runbook', why: 'Reputational pressure grows quickly when the narrative gets ahead of the facts.', impact: 'Improves consistency of management response during stakeholder scrutiny.' }
      ];
    } else if (classification.key === 'compliance') {
      recommendations = [
        { title: 'Policy-To-Control Mapping Refresh', why: 'Compliance failures often persist because obligations and operating controls are only loosely connected.', impact: 'Improves assurance integrity and reduces repeat remediation cycles.' },
        { title: 'Targeted Assurance On The Weakest Control Family', why: 'A narrow assurance pass is often the fastest way to change the real risk posture.', impact: 'Improves confidence in the scenario and reduces unverified control assumptions.' },
        { title: 'Issue Closure Discipline', why: 'Compliance risk remains elevated when remediation is tracked but not truly embedded.', impact: 'Improves closure quality and reduces the chance of repeat findings.' },
        { title: 'Leadership Accountability For Exceptions', why: 'Unowned exceptions often become the hidden path to larger compliance failure.', impact: 'Improves escalation clarity and strengthens the operating control environment.' }
      ];
    } else if (classification.key === 'legal-contract') {
      recommendations = [
        { title: 'Critical Obligation And Rights Position Review', why: 'Legal and contract downside usually turns on one unclear obligation, indemnity position, or rights assumption that was treated as settled.', impact: 'Improves commercial leverage and reduces avoidable dispute escalation.' },
        { title: 'Dispute Escalation And Evidence Pack', why: 'When contractual pressure rises, management needs a clean record of notices, obligations, and factual support rather than a reconstructed narrative.', impact: 'Improves response speed and strengthens the organisation’s position in negotiation or formal dispute.' },
        { title: 'Delivery And Dependency Exposure Mapping', why: 'Contract issues become materially more expensive when linked delivery, supplier, or programme consequences are not surfaced early.', impact: 'Improves scenario realism and reduces hidden downstream execution drag.' },
        { title: 'IP And Licensing Governance Checkpoint', why: 'Rights, licensing, and use restrictions are often buried in operational or partner workflows until they create a larger commercial problem.', impact: 'Reduces future dispute exposure and improves confidence in the operating model.' }
      ];
    } else if (classification.key === 'geopolitical') {
      recommendations = [
        { title: 'Market-Access Trigger And Escalation Matrix', why: 'Geopolitical scenarios rarely fail for lack of awareness; they fail because restriction signals are not translated into timely operating decisions.', impact: 'Improves response timing and reduces expensive late-stage reprioritisation.' },
        { title: 'Critical Counterparty And Country Exposure Review', why: 'Cross-border restrictions become more damaging when management does not know which suppliers, customers, or programmes are concentrated in the affected corridor.', impact: 'Improves visibility over sovereignty, sanctions, and market-access exposure.' },
        { title: 'Alternative Sourcing Or Routing Playbook', why: 'The practical downside in geopolitical cases often comes from not having a realistic substitute path when access conditions change.', impact: 'Reduces continuity and delivery drag when policy conditions tighten.' },
        { title: 'Executive Narrative And Stakeholder Coordination Plan', why: 'Leadership, regulators, customers, and investors often need a different explanation cadence when the issue is geopolitical rather than operational.', impact: 'Improves consistency of management response and lowers strategic confidence erosion.' }
      ];
    } else if (classification.key === 'supply-chain') {
      recommendations = [
        { title: 'Critical Dependency Diversification Review', why: 'Supply-chain downside is concentrated when substitutes are weak or lead times are long.', impact: 'Reduces severe disruption risk and improves continuity options.' },
        { title: 'Buffer And Recovery Trigger Design', why: 'Inventory, lead-time, and recovery triggers shape whether a disruption becomes a crisis.', impact: 'Improves response speed and narrows service or delivery loss.' },
        { title: 'Supplier Transparency For Tier-2 Dependencies', why: 'Many supply shocks surface through hidden upstream concentration.', impact: 'Improves resilience planning and reduces surprise dependency exposure.' },
        { title: 'Commercial Prioritisation Plan', why: 'When disruption occurs, management needs a clear prioritisation of products, customers, and obligations.', impact: 'Improves decision quality and reduces downstream contractual or reputational damage.' }
      ];
    } else if (classification.key === 'procurement') {
      recommendations = [
        { title: 'Critical Sourcing Decision Review', why: 'Procurement scenarios often begin with a sourcing shortcut that looked efficient but weakened control or resilience.', impact: 'Improves vendor fit and reduces downstream operational or compliance strain.' },
        { title: 'Tender And Award Control Strengthening', why: 'Clear challenge points in evaluation and approval reduce the chance of weak awards or commercial leakage.', impact: 'Improves governance quality and reduces rework or supplier underperformance.' },
        { title: 'Contract-Control Obligation Register', why: 'Many procurement losses emerge after award because operational obligations are not tracked tightly enough.', impact: 'Improves enforcement of service, assurance, and remediation terms.' },
        { title: 'Supplier Performance Escalation Thresholds', why: 'Management needs an earlier signal when a supplier relationship is drifting out of tolerance.', impact: 'Improves intervention timing and reduces avoidable continuity or commercial loss.' }
      ];
    } else if (classification.key === 'business-continuity') {
      recommendations = [
        { title: 'Recovery Objective Validation', why: 'Continuity scenarios often expose recovery assumptions that were never tested against real operating tolerance.', impact: 'Improves realism in the continuity posture and reduces surprise recovery failure.' },
        { title: 'Fallback Operating Mode Design', why: 'Controlled degraded-mode operations are a major lever on continuity loss.', impact: 'Reduces prolonged outage cost and preserves core service delivery under stress.' },
        { title: 'Executive Crisis Decision Playbook', why: 'Continuity failures escalate when leadership thresholds and choices are not pre-aligned.', impact: 'Improves speed and consistency of management response.' },
        { title: 'Dependency Recovery Testing', why: 'Recovery assumptions break most often at interfaces between teams, vendors, and shared services.', impact: 'Improves confidence in continuity readiness and narrows downstream disruption.' }
      ];
    } else if (classification.key === 'hse') {
      recommendations = [
        { title: 'Critical Control Verification', why: 'HSE scenarios are heavily shaped by whether the highest-consequence controls truly exist and are working.', impact: 'Reduces the chance of severe harm and improves assurance over the operating baseline.' },
        { title: 'Stop-Work And Escalation Triggers', why: 'Clear intervention thresholds reduce hesitation when conditions deteriorate.', impact: 'Improves response speed and reduces harm escalation.' },
        { title: 'Incident Learning Loop', why: 'Near misses and weak signals often contain the evidence needed to prevent a more serious event.', impact: 'Improves operating discipline and lowers recurrence risk.' },
        { title: 'Emergency And Remediation Coordination Drill', why: 'The response path matters as much as prevention when a people or environmental event occurs.', impact: 'Improves recovery quality and reduces shutdown or regulatory pressure.' }
      ];
    } else if (classification.key === 'physical-security') {
      recommendations = [
        { title: 'Critical Site-Access And Badge-Control Review', why: 'Physical-security scenarios usually begin with one weak access path or visitor-control assumption that is being treated as good enough.', impact: 'Reduces unauthorised access risk and improves confidence in site-control design.' },
        { title: 'High-Sensitivity Area Segmentation', why: 'Sensitive facilities and executive movements become harder to protect when physical zones and response thresholds are too broad or inconsistent.', impact: 'Narrows blast radius and improves stabilisation after a site-control lapse.' },
        { title: 'Physical Incident Escalation Runbook', why: 'Security events become more damaging when the response path across facilities, leadership, and operations is improvised.', impact: 'Improves response speed and reduces operational confusion.' },
        { title: 'Contractor And Guard Assurance Review', why: 'External personnel are often part of the failure chain in facility and executive-protection scenarios.', impact: 'Improves accountability and reduces inherited physical-control gaps.' }
      ];
    } else if (classification.key === 'ot-resilience') {
      recommendations = [
        { title: 'Site-System Recovery And Change Discipline Review', why: 'OT and site-resilience scenarios usually become severe when change control, fallback logic, or recovery sequencing is weaker than management assumes.', impact: 'Improves resilience of industrial and site operations under stress.' },
        { title: 'Critical Telemetry And Safety Override Validation', why: 'Degraded visibility or unsafe manual fallback can turn a technical disruption into a production or safety issue.', impact: 'Reduces shutdown risk and strengthens confidence in safe degraded operation.' },
        { title: 'OT Dependency Isolation And Interface Mapping', why: 'Many site-system failures are amplified by unclear dependencies between control systems, vendors, and corporate platforms.', impact: 'Improves root-cause visibility and reduces hidden propagation paths.' },
        { title: 'Joint OT Recovery Drill With Operations', why: 'The recovery path matters as much as prevention when production or site services depend on fragile industrial controls.', impact: 'Improves coordination quality and shortens restoration time.' }
      ];
    } else if (classification.key === 'people-workforce') {
      recommendations = [
        { title: 'Workforce Pressure And Safe-Staffing Trigger Review', why: 'People-risk scenarios often escalate because fatigue, attrition, or contractor strain was visible but not treated as a management trigger.', impact: 'Improves intervention timing and reduces safe-delivery degradation.' },
        { title: 'Labour And Welfare Escalation Protocol', why: 'Management needs a repeatable path when workforce issues begin to create legal, ethical, or continuity pressure.', impact: 'Improves governance quality and reduces inconsistent response.' },
        { title: 'Critical Role Resilience And Coverage Planning', why: 'Workforce issues become operational crises when key roles have no practical resilience or succession cover.', impact: 'Reduces continuity exposure from concentrated people dependencies.' },
        { title: 'Worker Voice And Remediation Loop', why: 'Weak grievance and remediation channels allow people issues to compound until external visibility forces a more expensive response.', impact: 'Improves detection of weak signals and lowers escalation risk.' }
      ];
    } else if (classification.key === 'investment-jv') {
      recommendations = [
        { title: 'Investment Thesis And Assumption Challenge', why: 'Investment and JV downside usually starts with one integration, synergy, or market assumption that was treated as more stable than it really is.', impact: 'Improves decision quality and reduces delayed value erosion.' },
        { title: 'Post-Deal Governance And Escalation Review', why: 'Many investment losses deepen because ownership over integration, control uplift, and strategic intervention is too diffuse after the deal closes.', impact: 'Improves accountability and reduces prolonged drift after execution issues surface.' },
        { title: 'Counterparty And Governance Rights Assessment', why: 'JV and minority-position scenarios often hinge on governance rights and practical influence once performance slips.', impact: 'Improves leverage and strengthens contingency planning.' },
        { title: 'Synergy Tracking And Recovery Trigger Design', why: 'Management needs a disciplined way to recognise when expected value creation is no longer on track.', impact: 'Improves early correction and reduces expensive late-stage remediation.' }
      ];
    } else if (classification.key === 'transformation-delivery') {
      recommendations = [
        { title: 'Programme Dependency And Milestone Recovery Review', why: 'Transformation scenarios usually become expensive because the dependency chain was too optimistic and no clean recovery path existed once slip appeared.', impact: 'Improves delivery realism and narrows slippage exposure.' },
        { title: 'Benefit Realisation Challenge Pack', why: 'Transformation downside is often hidden until management asks whether the delayed programme is still delivering the value case.', impact: 'Improves transparency over whether continued investment remains justified.' },
        { title: 'Executive Decision Rights For Scope And Go-Live', why: 'When a major programme slips, unclear decision rights amplify cost, fatigue, and delivery confusion.', impact: 'Improves intervention speed and strengthens management control of the delivery path.' },
        { title: 'Change Readiness And Operational Adoption Check', why: 'Even technically successful programmes fail economically when adoption and operational readiness lag behind the build plan.', impact: 'Improves landing quality and reduces delayed-benefit risk.' }
      ];
    } else {
      recommendations = [
        { title: 'Control Weakness Review', why: 'Generic scenarios still benefit from identifying the single most material control weakness in the chain.', impact: 'Improves prioritisation and reduces assumption drift before management review.' },
        { title: 'Evidence-Led Range Challenge', why: 'The fastest way to improve a scenario is to challenge the most uncertain frequency or impact assumption with real evidence.', impact: 'Improves decision confidence and reduces avoidable estimate volatility.' },
        { title: 'Escalation Trigger Definition', why: 'Management action is clearer when the scenario includes a crisp escalation threshold.', impact: 'Improves readiness and helps users move from analysis to response planning.' },
        { title: 'Dependency And Consequence Review', why: 'Even broad enterprise scenarios usually hide one or two dependencies that amplify the downside materially.', impact: 'Improves treatment choice and clarifies where reduction effort should go first.' }
      ];
    }

    const benchmarkDerived = Array.isArray(benchmarkCandidates) && benchmarkCandidates.length
      ? BenchmarkService.deriveSuggestedInputs(benchmarkCandidates)
      : null;

    if (benchmarkDerived?.TEF) tef = benchmarkDerived.TEF;
    if (benchmarkDerived?.controlStrength) cs = benchmarkDerived.controlStrength;
    if (benchmarkDerived?.threatCapability) tc = benchmarkDerived.threatCapability;

    // Add BU context to defaults if available, but tolerate partial or older settings payloads.
    if (buContext && buContext.defaultAssumptions) {
      const da = buContext.defaultAssumptions || {};
      if (da.TEF?.min != null && da.TEF?.likely != null && da.TEF?.max != null) {
        tef = { min: da.TEF.min, likely: da.TEF.likely, max: da.TEF.max };
      }
      if (da.controlStrength?.min != null && da.controlStrength?.likely != null && da.controlStrength?.max != null) {
        cs = { min: da.controlStrength.min, likely: da.controlStrength.likely, max: da.controlStrength.max };
      }
      if (da.threatCapability?.min != null && da.threatCapability?.likely != null && da.threatCapability?.max != null) {
        tc = { min: da.threatCapability.min, likely: da.threatCapability.likely, max: da.threatCapability.max };
      }
    }

    const suggestedLossComponents = buContext?.defaultAssumptions ? {
      incidentResponse: buContext.defaultAssumptions.incidentResponse,
      businessInterruption: buContext.defaultAssumptions.businessInterruption,
      dataBreachRemediation: buContext.defaultAssumptions.dataBreachRemediation,
      regulatoryLegal: buContext.defaultAssumptions.regulatoryLegal,
      thirdPartyLiability: buContext.defaultAssumptions.thirdPartyLiability,
      reputationContract: buContext.defaultAssumptions.reputationContract
    } : (benchmarkDerived?.lossComponents || {
      incidentResponse:    { min: 50000, likely: 180000, max: 600000 },
      businessInterruption: { min: 100000, likely: 450000, max: 2500000 },
      dataBreachRemediation: { min: 30000, likely: 120000, max: 500000 },
      regulatoryLegal:      { min: 0, likely: 80000, max: 800000 },
      thirdPartyLiability:  { min: 0, likely: 50000, max: 400000 },
      reputationContract:   { min: 50000, likely: 200000, max: 1200000 }
    });

    const benchmarkBasis = [
      BenchmarkService.summariseBenchmarkBasis(benchmarkCandidates),
      'The suggested values are intended as FAIR-style starting points and should still be challenged against internal incident history, control evidence, and finance input.'
    ].filter(Boolean).join(' ');

    return {
      scenarioTitle: scenarioType,
      scenarioLens,
      structuredScenario: {
        assetService: buContext?.criticalServices?.[0] || 'Core application platform',
        primaryDriver: classification.primaryDriver,
        eventPath: classification.eventPath,
        effect: classification.effect
      },
      workflowGuidance: [
        'Confirm that the selected risks and narrative describe one coherent assessment scope.',
        'Review the suggested FAIR ranges against internal incident history, control evidence, and business criticality before accepting them.',
        'Validate any benchmark-based assumptions against FAIR logic, NIST CSF style control expectations, and your organisation-specific operating context.'
      ],
      benchmarkBasis,
      inputRationale: {
        tef: 'Threat event frequency is anchored to the scenario type and then aligned to the business unit default assumptions where available.',
        vulnerability: 'Threat capability and control strength are balanced to reflect the expected attacker sophistication against the current control environment.',
        lossComponents: 'Loss components reflect the most material direct, operational, regulatory, third-party, and reputational consequences for the selected scenario.'
      },
      suggestedInputs: {
        TEF: tef,
        controlStrength: cs,
        threatCapability: tc,
        lossComponents: suggestedLossComponents
      },
      recommendations: recommendations.slice(0, 6),
      citations,
      benchmarkReferences: BenchmarkService.buildReferenceList(benchmarkCandidates),
      inputProvenance: BenchmarkService.buildInputProvenance(benchmarkCandidates)
    };
  }

  function _cleanScenarioSeed(statement = '') {
    const raw = String(statement || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const sentences = raw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const seen = new Set();
    const filtered = sentences.filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      if (/^in .*faces a material .*scenario in which/i.test(sentence)) return false;
      if (/^this scenario should be assessed/i.test(sentence)) return false;
      if (/^a likely progression is/i.test(sentence)) return false;
      if (/^in practice, this can drive/i.test(sentence)) return false;
      if (/^given the stated urgency/i.test(sentence)) return false;
      if (/^current urgency is assessed as /i.test(sentence)) return false;
      return true;
    });
    const cleaned = filtered.join(' ').trim();
    return cleaned || raw;
  }


  function _buildEnhancedNarrative(input = {}, modelNarrative = '') {
    const modelText = _cleanUserFacingText(_stripScenarioLeadIns(modelNarrative || ''), { maxSentences: 6 });
    const expanded = _buildScenarioExpansion({
      ...input,
      riskStatement: modelText || input.riskStatement || ''
    }).scenarioExpansion;
    if (!modelText) return expanded;
    const merged = _dedupeSentences([expanded, modelText].filter(Boolean).join(' '));
    return _cleanUserFacingText(merged, { maxSentences: 6 });
  }

  function _extractGuidedDraftAnchors(input = {}, seedNarrative = '') {
    const text = [
      input.guidedInput?.event,
      input.guidedInput?.impact,
      input.guidedInput?.cause,
      input.guidedInput?.asset,
      seedNarrative
    ].filter(Boolean).join(' ');
    const stopWords = new Set([
      'about', 'after', 'along', 'because', 'could', 'create', 'critical', 'current', 'event',
      'from', 'have', 'into', 'issue', 'likely', 'main', 'material', 'might', 'more', 'most',
      'risk', 'scenario', 'scope', 'should', 'their', 'there', 'these', 'this', 'what', 'which',
      'with', 'would'
    ]);
    return Array.from(new Set(
      String(text || '')
        .toLowerCase()
        .match(/[a-z0-9]+/g) || []
    )).filter(token => token.length > 4 && !stopWords.has(token));
  }

  function _countScenarioAnchorOverlap(text = '', anchors = []) {
    const haystack = String(text || '').toLowerCase();
    return (Array.isArray(anchors) ? anchors : []).filter(token => token && haystack.includes(token)).length;
  }

  function _filterScenarioRelevantRisks(risks = [], {
    seedNarrative = '',
    guidedInput = {},
    classification = {},
    fallbackRisks = []
  } = {}) {
    const expectedLens = _normaliseScenarioHintKey(classification?.key || '');
    const anchors = _extractGuidedDraftAnchors({ guidedInput }, seedNarrative);
    const candidateRisks = _normaliseRiskCards(risks);
    const fallback = _normaliseRiskCards(fallbackRisks);
    const filtered = candidateRisks.filter((risk) => {
      const riskText = `${risk?.title || ''} ${risk?.description || ''}`;
      const riskLens = _classifyScenario(riskText, {
        guidedInput,
        scenarioLensHint: expectedLens
      }).key;
      const lensCompatible = !riskLens
        || riskLens === expectedLens
        || _isCompatibleScenarioLens(expectedLens, riskLens);
      const anchorCompatible = !anchors.length || _countScenarioAnchorOverlap(riskText, anchors) > 0;
      return lensCompatible && anchorCompatible;
    });
    if (filtered.length >= Math.max(1, Math.min(2, candidateRisks.length || 0))) {
      return filtered;
    }
    const merged = _normaliseRiskCards([...filtered, ...fallback]);
    if (merged.length) return merged;
    if (fallback.length) return fallback;
    return candidateRisks;
  }

  function _isCompatibleScenarioLens(expected = '', actual = '') {
    const expectedKey = _normaliseScenarioHintKey(expected);
    const actualKey = _normaliseScenarioHintKey(actual);
    if (!expectedKey || expectedKey === 'general' || !actualKey) return true;
    if (expectedKey === actualKey) return true;
    const compatibility = {
      'ai-model-risk': ['data-governance', 'compliance', 'cyber'],
      'data-governance': ['ai-model-risk', 'compliance', 'regulatory', 'cyber'],
      procurement: ['supply-chain', 'third-party', 'compliance', 'esg'],
      'supply-chain': ['procurement', 'third-party', 'business-continuity', 'operational'],
      'third-party': ['procurement', 'supply-chain', 'business-continuity', 'operational'],
      compliance: ['regulatory', 'procurement', 'financial', 'esg'],
      regulatory: ['compliance', 'financial'],
      financial: ['compliance', 'regulatory'],
      'fraud-integrity': ['financial', 'compliance', 'regulatory'],
      'legal-contract': ['compliance', 'regulatory', 'procurement', 'strategic'],
      geopolitical: ['strategic', 'regulatory', 'supply-chain'],
      'physical-security': ['operational', 'business-continuity', 'hse'],
      'ot-resilience': ['operational', 'business-continuity', 'cyber', 'hse'],
      'people-workforce': ['hse', 'operational', 'esg', 'compliance'],
      'investment-jv': ['strategic', 'financial', 'transformation-delivery'],
      'transformation-delivery': ['strategic', 'operational', 'investment-jv'],
      esg: ['procurement', 'compliance', 'hse', 'strategic', 'supply-chain'],
      hse: ['operational', 'business-continuity', 'esg'],
      operational: ['business-continuity', 'supply-chain', 'hse'],
      'business-continuity': ['operational', 'supply-chain', 'hse'],
      strategic: ['operational', 'financial', 'esg'],
      cyber: ['identity', 'ransomware', 'cloud', 'data-breach', 'phishing', 'insider']
    };
    return (compatibility[expectedKey] || []).includes(actualKey);
  }

  function _evaluateGuidedDraftCandidate(candidate = '', {
    seedNarrative = '',
    guidedInput = {},
    scenarioLensHint = '',
    businessUnit = null
  } = {}) {
    const explicitLeadLens = _extractExplicitScenarioLeadLens(candidate);
    const cleanedCandidate = _cleanUserFacingText(_stripScenarioLeadIns(candidate || ''), { maxSentences: 6 });
    if (!cleanedCandidate) {
      return { accepted: false, reason: 'empty', narrative: '' };
    }
    if (_looksGenericRiskContextCopy(cleanedCandidate)) {
      return { accepted: false, reason: 'generic', narrative: cleanedCandidate };
    }
    const expectedLens = _normaliseScenarioHintKey(scenarioLensHint)
      || _classifyScenario(seedNarrative, { guidedInput, businessUnit, scenarioLensHint }).key;
    if (explicitLeadLens && !_isCompatibleScenarioLens(expectedLens, explicitLeadLens)) {
      return { accepted: false, reason: 'explicit-lens-drift', narrative: cleanedCandidate };
    }
    const anchors = _extractGuidedDraftAnchors({ guidedInput }, seedNarrative);
    const overlap = anchors.filter(token => cleanedCandidate.toLowerCase().includes(token));
    const minOverlap = anchors.length >= 5 ? 2 : anchors.length ? 1 : 0;
    if (overlap.length < minOverlap) {
      return { accepted: false, reason: 'low-overlap', narrative: cleanedCandidate };
    }
    const actualLens = _classifyScenario(cleanedCandidate, { guidedInput, businessUnit, scenarioLensHint: expectedLens }).key;
    if (!_isCompatibleScenarioLens(expectedLens, actualLens)) {
      return { accepted: false, reason: 'lens-drift', narrative: cleanedCandidate };
    }
    return { accepted: true, reason: 'accepted', narrative: cleanedCandidate };
  }

  function _selectGuidedDraftNarrative({
    aiNarrative = '',
    fallbackNarrative = '',
    seedNarrative = '',
    guidedInput = {},
    scenarioLensHint = '',
    businessUnit = null
  } = {}) {
    const aiCandidate = _evaluateGuidedDraftCandidate(aiNarrative, { seedNarrative, guidedInput, scenarioLensHint, businessUnit });
    if (aiCandidate.accepted) return { narrative: aiCandidate.narrative, source: 'ai', reason: aiCandidate.reason };

    const fallbackCandidate = _evaluateGuidedDraftCandidate(fallbackNarrative, { seedNarrative, guidedInput, scenarioLensHint, businessUnit });
    if (fallbackCandidate.accepted) {
      // If the AI rewrite drifted away from the user’s scenario, prefer the bounded local expansion instead of showing a smarter-sounding but less faithful draft.
      return { narrative: fallbackCandidate.narrative, source: 'fallback', reason: aiCandidate.reason || fallbackCandidate.reason };
    }

    return {
      narrative: _cleanUserFacingText(seedNarrative, { maxSentences: 5 }),
      source: 'local',
      reason: aiCandidate.reason || fallbackCandidate.reason || 'seed'
    };
  }

  function _getStructuredScenarioValue(structuredScenario = {}, field = '') {
    const source = structuredScenario && typeof structuredScenario === 'object' ? structuredScenario : {};
    if (field === 'primaryDriver') return _cleanUserFacingText(source.primaryDriver || source.threatCommunity || '', { maxSentences: 1, stripTrailingPeriod: true });
    if (field === 'eventPath') return _cleanUserFacingText(source.eventPath || source.attackType || '', { maxSentences: 1, stripTrailingPeriod: true });
    return _cleanUserFacingText(source[field] || '', { maxSentences: field === 'effect' ? 2 : 1, stripTrailingPeriod: field !== 'effect' });
  }

  function _inferLensFromRiskCard(risk = {}) {
    const raw = _normaliseScenarioHintKey(risk?.category || '');
    if (raw) return raw;
    const text = `${risk?.title || ''} ${risk?.description || ''}`.toLowerCase();
    if (/responsible ai|model risk|ai governance|hallucination|model drift|algorithmic bias|training data/.test(text)) return 'ai-model-risk';
    if (/data governance|data lineage|retention|purpose limitation|consent|data residency|master data|privacy/.test(text)) return 'data-governance';
    if (/procurement|sourcing|contract|supplier due diligence|bid|tender|vendor selection/.test(text)) return 'procurement';
    if (/supply chain|inventory|logistics|single source|upstream/.test(text)) return 'supply-chain';
    if (/third party|third-party|vendor|supplier failure/.test(text)) return 'third-party';
    if (/compliance|policy|control design|assurance|ethics/.test(text)) return 'compliance';
    if (/regulatory|supervisory|licen[cs]e|sanction|export control/.test(text)) return 'regulatory';
    if (/financial|fraud|payment|liquidity|reporting/.test(text)) return 'financial';
    if (/financial crime|kickback|bribery|corruption|integrity|embezzlement/.test(text)) return 'fraud-integrity';
    if (/contract|indemnity|litigation|licensing dispute|intellectual property|\bip\b/.test(text)) return 'legal-contract';
    if (/geopolitical|market access|sovereign|entity list|cross-border restriction|tariff/.test(text)) return 'geopolitical';
    if (/esg|sustainability|human rights|climate|disclosure/.test(text)) return 'esg';
    if (/business continuity|recovery|outage|downtime|crisis/.test(text)) return 'business-continuity';
    if (/physical security|executive protection|badge control|visitor management|perimeter|facility breach/.test(text)) return 'physical-security';
    if (/\bot\b|operational technology|industrial control|ics|scada|site systems|plant network/.test(text)) return 'ot-resilience';
    if (/workforce|labou?r|fatigue|staffing|worker welfare|strike/.test(text)) return 'people-workforce';
    if (/operational|service disruption|backlog|process/.test(text)) return 'operational';
    if (/health|safety|environment|injury|spill|hazard/.test(text)) return 'hse';
    if (/cyber|identity|cloud|data exposure|malware|ransomware/.test(text)) return 'cyber';
    if (/merger|acquisition|m&a|joint venture|\bjv\b|integration thesis|synergy/.test(text)) return 'investment-jv';
    if (/transformation delivery|programme delivery|program delivery|project delivery|go-live|milestone|benefit realisation|benefit realization/.test(text)) return 'transformation-delivery';
    if (/strategy|strategic|market|programme|investment/.test(text)) return 'strategic';
    return '';
  }

  function _buildAiAlignment(input = {}, result = {}, {
    classification = {},
    seedNarrative = '',
    fallbackScenarioExpansion = null
  } = {}) {
    const expectedLens = _normaliseScenarioHintKey(input.scenarioLensHint) || classification.key || 'general';
    const resolvedLens = _normaliseScenarioLens(result?.scenarioLens, _buildScenarioLens(classification));
    const draftNarrative = _cleanUserFacingText(result?.draftNarrative || result?.enhancedStatement || seedNarrative, { maxSentences: 6 });
    const draftCandidate = _evaluateGuidedDraftCandidate(draftNarrative, {
      seedNarrative,
      guidedInput: input.guidedInput,
      scenarioLensHint: expectedLens,
      businessUnit: input.businessUnit
    });
    const actualNarrativeLens = _classifyScenario(draftNarrative || seedNarrative, {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: expectedLens
    }).key;
    const structured = result?.structuredScenario && typeof result.structuredScenario === 'object'
      ? result.structuredScenario
      : {};
    const structuredCount = ['assetService', 'primaryDriver', 'eventPath', 'effect']
      .filter(field => _getStructuredScenarioValue(structured, field))
      .length;
    const risks = _normaliseRiskCards(Array.isArray(result?.risks) && result.risks.length
      ? result.risks
      : (fallbackScenarioExpansion?.riskTitles || []));
    const narrativeAnchors = _extractGuidedDraftAnchors({ guidedInput: input.guidedInput }, seedNarrative || draftNarrative);
    const alignedRiskCount = risks.filter(risk => {
      const riskText = `${risk?.title || ''} ${risk?.description || ''}`;
      const riskLens = _inferLensFromRiskCard(risk)
        || _classifyScenario(riskText, {
          guidedInput: input.guidedInput,
          businessUnit: input.businessUnit,
          scenarioLensHint: expectedLens
        }).key;
      const lensCompatible = !riskLens
        || _isCompatibleScenarioLens(resolvedLens.key, riskLens)
        || (Array.isArray(resolvedLens.secondaryKeys) && resolvedLens.secondaryKeys.some(key => key === riskLens || _isCompatibleScenarioLens(key, riskLens)));
      const anchorCompatible = !narrativeAnchors.length || _countScenarioAnchorOverlap(riskText, narrativeAnchors) > 0;
      return lensCompatible && anchorCompatible;
    }).length;
    const benchmarkRefs = Array.isArray(result?.benchmarkReferences) ? result.benchmarkReferences : [];
    const benchmarkSignalCount = [
      String(result?.benchmarkBasis || '').trim() ? 1 : 0,
      benchmarkRefs.length ? 1 : 0
    ].reduce((sum, value) => sum + value, 0);
    const secondaryLabels = (Array.isArray(resolvedLens.secondaryKeys) ? resolvedLens.secondaryKeys : [])
      .map(key => _buildScenarioLens({ key }).label)
      .filter(Boolean)
      .slice(0, 2);
    const checks = [
      {
        label: 'Primary lens',
        status: _isCompatibleScenarioLens(expectedLens, resolvedLens.key) && _isCompatibleScenarioLens(expectedLens, actualNarrativeLens) ? 'ok' : 'warning',
        detail: _isCompatibleScenarioLens(expectedLens, resolvedLens.key) && _isCompatibleScenarioLens(expectedLens, actualNarrativeLens)
          ? `${resolvedLens.label} stayed consistent with the intended scenario domain.${secondaryLabels.length ? ` Secondary facets: ${secondaryLabels.join(' and ')}.` : ''}`
          : `AI drifted toward ${_buildScenarioLens({ key: actualNarrativeLens }).label.toLowerCase()} language and was corrected back toward the ${_buildScenarioLens({ key: expectedLens }).label.toLowerCase()} lens.`
      },
      {
        label: 'Scenario draft',
        status: draftCandidate.accepted ? 'ok' : 'warning',
        detail: draftCandidate.accepted
          ? 'The draft stayed close to the user event, impact, and current function context.'
          : 'The draft was forced back toward the user statement because the first rewrite was too generic or too far from the described event.'
      },
      {
        label: 'Structured scenario',
        status: structuredCount >= 3 ? 'ok' : structuredCount >= 2 ? 'warning' : 'warning',
        detail: structuredCount >= 3
          ? `${structuredCount} core scenario fields were filled for downstream quantification.`
          : 'The AI left too much structure blank, so the fallback scenario framing was kept.'
      },
      {
        label: 'Shortlist fit',
        status: risks.length && alignedRiskCount >= Math.max(1, Math.ceil(risks.length / 2)) ? 'ok' : 'warning',
        detail: risks.length
          ? `${alignedRiskCount} of ${risks.length} suggested risks stay aligned with the current event path and scenario lens${secondaryLabels.length ? ' or its secondary facets' : ''}.`
          : 'No candidate risks were returned, so the shortlist falls back to lens-aware local seeds.'
      },
      {
        label: 'Grounding',
        status: benchmarkSignalCount ? 'ok' : 'warning',
        detail: benchmarkSignalCount
          ? `${benchmarkRefs.length || 0} benchmark reference${benchmarkRefs.length === 1 ? '' : 's'} and a benchmark approach were attached.`
          : 'Benchmark rationale or reference detail is still thin, so treat the output as a working draft.'
      }
    ];
    const score = checks.reduce((sum, check) => sum + (check.status === 'ok' ? 20 : 8), 0);
    const label = score >= 85
      ? 'Aligned and grounded'
      : score >= 65
        ? 'Mostly aligned'
        : 'Needs review';
    return {
      label,
      score,
      summary: `AI kept the draft in the ${resolvedLens.label.toLowerCase()} lens, aligned ${alignedRiskCount} of ${Math.max(risks.length, 1)} suggested risks, and attached ${benchmarkRefs.length || 0} benchmark reference${benchmarkRefs.length === 1 ? '' : 's'}.`,
      checks
    };
  }

  async function buildGuidedScenarioDraft(input = {}) {
    const seedNarrative = _cleanUserFacingText(_cleanScenarioSeed(input.riskStatement || ''), { maxSentences: 5 });
    const classification = _classifyScenario(seedNarrative, {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: input.scenarioLensHint
    });
    const fallbackScenarioExpansion = _buildScenarioExpansion({
      ...input,
      riskStatement: seedNarrative,
      classification
    });
    const result = await enhanceRiskContext({
      ...input,
      riskStatement: seedNarrative,
      scenarioLensHint: _normaliseScenarioHintKey(input.scenarioLensHint) || classification.key,
      traceLabel: input.traceLabel || 'Step 1 guided draft'
    });
    const selectedDraft = _selectGuidedDraftNarrative({
      aiNarrative: _buildEnhancedNarrative({
        ...input,
        riskStatement: seedNarrative
      }, result.draftNarrative || result.enhancedStatement || ''),
      fallbackNarrative: fallbackScenarioExpansion.scenarioExpansion,
      seedNarrative,
      guidedInput: input.guidedInput,
      scenarioLensHint: input.scenarioLensHint || classification.key,
      businessUnit: input.businessUnit
    });
    return {
      ...result,
      seedNarrative,
      draftNarrative: selectedDraft.narrative,
      draftNarrativeSource: selectedDraft.source,
      draftNarrativeReason: selectedDraft.reason,
      aiAlignment: _buildAiAlignment(input, {
        ...result,
        draftNarrative: selectedDraft.narrative
      }, {
        classification,
        seedNarrative,
        fallbackScenarioExpansion
      })
    };
  }

  function _buildScenarioExpansion(input = {}) {
    const statement = _stripScenarioLeadIns(_cleanScenarioSeed(input.riskStatement));
    const businessUnit = String(input.businessUnit?.name || 'the business unit').trim();
    const geography = _joinList(String(input.geography || '').split(',').map((item) => item.trim()).filter(Boolean)) || 'the selected geography';
    const asset = _cleanUserFacingText(String(input.guidedInput?.asset || '').trim(), { maxSentences: 1, stripTrailingPeriod: true });
    const cause = _cleanUserFacingText(String(input.guidedInput?.cause || '').trim(), { maxSentences: 1, stripTrailingPeriod: true });
    const impact = _cleanUserFacingText(String(input.guidedInput?.impact || '').trim(), { maxSentences: 1, stripTrailingPeriod: true });
    const urgency = String(input.guidedInput?.urgency || 'medium').trim().toLowerCase();
    const classification = input.classification || _classifyScenario([statement, asset, cause, impact].filter(Boolean).join(' '), {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: input.scenarioLensHint
    });
    const resolvedClassificationKey = String(classification?.key || 'general').trim() || 'general';
    const intakeText = [statement, asset, cause, impact].filter(Boolean).join(' ').toLowerCase();

    let scenarioExpansion = _ensureSentence(statement) || _buildScenarioLead({ geography, businessUnit });
    let summary = _buildRiskContextSummary({ classification, asset, impact, riskTitles: [] });
    let riskTitles = _extractRiskCandidates([statement, cause, impact].join('\n'), { lensHint: input.scenarioLensHint || classification });

    if (resolvedClassificationKey === 'identity') {
      scenarioExpansion = [
        _buildScenarioLead({
          geography,
          businessUnit,
          asset: asset || 'the identity platform',
          cause: cause || 'targeted credential theft or session hijack',
          impact: impact || 'operational disruption, fraud, and regulatory exposure',
          scenarioLabel: 'identity compromise'
        }),
        'The most likely progression is account takeover, privileged escalation, and unauthorised access to email, collaboration tools, cloud administration, and other federated business services.',
        ['high', 'critical'].includes(urgency)
          ? 'This should be treated as an active material scenario requiring rapid containment, privileged-account review, and assessment of downstream operational and financial exposure.'
          : 'This should be assessed as a gateway scenario that can trigger fraud, service disruption, data exposure, and regulatory consequences across connected services.'
      ].join(' ');
      summary = 'AI expanded the scenario beyond the initial identity failure to include likely knock-on effects such as mailbox compromise, privileged abuse, service disruption, fraud, and data exposure.';
      riskTitles = [
        { title: 'Privileged account takeover through identity platform compromise', category: 'Identity & Access', description: 'Compromised Azure AD or Entra credentials could let an attacker take over privileged identities and move into federated services or administrative workflows.', regulations: ['UAE PDPL', 'UK GDPR', 'SEC cyber disclosure rules'] },
        { title: 'Business email compromise enabled by mailbox access', category: 'Financial Crime', description: 'Once identity controls are bypassed, mailbox access can support payment fraud, executive impersonation, and manipulation of approvals or supplier instructions.', regulations: ['UAE AML/CFT'] },
        { title: 'Administrative lockout or unauthorised tenant changes', category: 'Operational Resilience', description: 'An attacker with elevated access could change authentication settings, conditional access, or directory controls, disrupting normal user access and response operations.', regulations: ['UAE Cybersecurity Council Guidance'] },
        { title: 'Sensitive data exposure across mailboxes and connected cloud services', category: 'Data Protection', description: 'The same compromise could expose regulated or commercially sensitive information stored in mail, identity-linked applications, and collaboration platforms.', regulations: ['UAE PDPL', 'GDPR'] }
      ];
    } else if (resolvedClassificationKey === 'ransomware') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'critical business services', cause: cause || 'initial access followed by ransomware deployment', impact: impact || 'service downtime and recovery cost', scenarioLabel: 'ransomware-driven disruption' }),
        'The most likely progression is attacker access, lateral movement, abuse of privileged access, encryption or destructive action against critical systems, and secondary extortion through data theft or public pressure.',
        'This should be assessed for downtime, operational backlog, emergency response cost, stakeholder disruption, and regulatory consequences where sensitive or regulated services are involved.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'data-breach') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the affected data store or regulated information set', cause: cause || 'unauthorised access or exfiltration', impact: impact || 'regulatory and stakeholder exposure', scenarioLabel: 'data disclosure scenario' }),
        'The most likely progression is unauthorised access, extraction or disclosure of sensitive information, followed by containment work, notification assessment, and management scrutiny over the full exposure scope.',
        'This should be assessed for direct remediation cost, regulatory response, customer or stakeholder communication burden, and wider trust impact.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'phishing') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the targeted approval, payment, or communication workflow', cause: cause || 'targeted phishing or email compromise', impact: impact || 'fraud, disruption, and trust erosion', scenarioLabel: 'phishing-driven scenario' }),
        'The most likely progression is credential capture or trust-channel compromise leading to payment manipulation, mailbox misuse, privileged follow-on access, or delayed detection through routine business processes.',
        'This should be assessed for direct fraud exposure, downstream identity impact, and the operational cost of restoring trust in the compromised workflow.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'insider') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the trusted process, dataset, or service in scope', cause: cause || 'misuse of trusted access or privileged control', impact: impact || 'material operational, financial, or regulatory consequence', scenarioLabel: 'insider misuse scenario' }),
        'The most likely progression is abuse of trusted access, concealment within normal process activity, and delayed detection until harm, data loss, or service degradation is already material.',
        'This should be assessed for monitoring gaps, concentration of access, recovery effort, and the potential need for disciplinary or regulatory escalation.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'third-party') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'a critical supplier-dependent service', cause: cause || 'third-party failure or compromise', impact: impact || 'operational disruption and commercial exposure', scenarioLabel: 'third-party disruption' }),
        'The most likely progression is service dependency failure, inherited control weakness, or privileged supplier access creating operational, data, and contractual consequences across connected processes.',
        'This should be assessed for immediate disruption as well as follow-on regulatory, commercial, and assurance impacts.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'cloud') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the exposed cloud service', cause: cause || 'cloud misconfiguration or weak access control', impact: impact || 'data exposure and operational recovery effort', scenarioLabel: 'cloud exposure' }),
        'The most likely progression is unauthorised discovery, data exposure or exfiltration, misuse of cloud services, persistence through compromised credentials or automation, and delayed detection caused by fragmented ownership.',
        'This should be assessed for confidentiality impact, operational recovery effort, regulatory response, and reputational consequences.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'ai-model-risk') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the AI-enabled workflow or model in scope', cause: cause || 'weak model governance, guardrails, or monitoring', impact: impact || 'unsafe or low-trust outputs and regulatory challenge', scenarioLabel: 'AI or model-risk scenario' }),
        'The most likely progression is poor model behaviour, delayed challenge, or weak human oversight turning into unsafe decisions, remediation work, and pressure to explain how the model was governed.',
        'This should be assessed for decision quality, governance strength, stakeholder trust, and whether data, conduct, or regulatory consequences could follow once the issue becomes visible.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'data-governance') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the dataset, reporting flow, or analytics environment in scope', cause: cause || 'weak data ownership, retention, or lineage control', impact: impact || 'privacy challenge and lower confidence in downstream analytics', scenarioLabel: 'data-governance scenario' }),
        'The most likely progression is poor lineage, approved-use drift, or retention weakness creating privacy pressure, remediation work, and management challenge over how the data was governed.',
        'This should be assessed for privacy exposure, data-control remediation, and whether the issue undermines the reliability of reporting or AI built on the same data.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'strategic') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the strategic initiative or business objective', cause: cause || 'strategy execution weakness or market shift', impact: impact || 'material pressure on objectives and value creation', scenarioLabel: 'strategic risk scenario' }),
        'The most likely progression is a weak strategic assumption, delayed response, or execution gap turning into missed objectives, financial drag, stakeholder pressure, and a harder recovery path.',
        'This should be assessed for strategic downside, cost of correction, management bandwidth, and how quickly the issue could spill into operational, regulatory, or reputational consequences.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'operational') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the affected operating process or service', cause: cause || 'process breakdown or control failure', impact: impact || 'service degradation and execution strain', scenarioLabel: 'operational risk scenario' }),
        'The most likely progression is control weakness, workflow failure, or backlog growth driving service deterioration, manual workarounds, increased error rates, and management escalation.',
        'This should be assessed for direct disruption, recovery effort, customer or internal stakeholder impact, and the risk of secondary compliance or continuity consequences.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'regulatory') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the regulated activity or obligation', cause: cause || 'a breach of regulatory or licence requirements', impact: impact || 'enforcement and remediation exposure', scenarioLabel: 'regulatory risk scenario' }),
        'The most likely progression is a control or reporting failure triggering regulator attention, remediation demands, management scrutiny, and downstream cost or licensing pressure.',
        'This should be assessed for enforcement likelihood, remediation effort, operational interruption, and whether the issue could cascade into reputational or financial damage.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'financial') {
      if (/bankrupt|bankruptcy|insolv|insolven|receivable|bad debt|write[- ]?off|counterparty|credit loss|credit exposure|customer default|client default|collections|collectability|cashflow|working capital|provisioning|provision/.test(intakeText)) {
        scenarioExpansion = [
          _buildScenarioLead({ geography, businessUnit, asset: asset || 'the customer exposure, receivables position, or commercial counterparty relationship in scope', cause: cause || 'customer insolvency, payment default, or weakening collectability', impact: impact || 'bad-debt write-off and cashflow strain', scenarioLabel: 'counterparty-credit risk scenario' }),
          'The most likely progression is a major client failure reducing collectability, forcing provisioning or write-off decisions, and escalating management scrutiny over concentration, recovery options, and the speed of financial response.',
          'This should be assessed for direct loss, collections recovery, working-capital strain, and whether legal or contractual action can materially reduce the downside.'
        ].join(' ');
        riskTitles = [
          { title: 'Counterparty default and bad-debt exposure', category: 'Financial', description: 'A client insolvency or payment default could force a material write-off and a reassessment of expected recoveries.', regulations: ['COSO Internal Control Framework'] },
          { title: 'Receivables recovery shortfall after customer insolvency', category: 'Financial', description: 'Collections may deteriorate quickly once the customer fails, creating cashflow strain and weaker recovery than management expected.', regulations: ['COSO Internal Control Framework'] },
          { title: 'Legal recovery or contractual claim uncertainty', category: 'Legal / Contract', description: 'Recovery may depend on the enforceability of payment terms, security, guarantees, or the speed of insolvency-related legal action.', regulations: ['ISO 37301'] }
        ];
      } else {
        scenarioExpansion = [
          _buildScenarioLead({ geography, businessUnit, asset: asset || 'the affected financial process or exposure', cause: cause || 'fraud, financial control weakness, or commercial failure', impact: impact || 'direct financial loss and control pressure', scenarioLabel: 'financial risk scenario' }),
          'The most likely progression is payment manipulation, weak approvals, or financial-control failure leading to direct loss, delayed detection, escalation, and remediation work.',
          'This should be assessed for direct loss, control weakness, liquidity or capital impact, and any related regulatory or stakeholder consequences.'
        ].join(' ');
      }
    } else if (resolvedClassificationKey === 'fraud-integrity') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the approval, payment, or conduct-control path in scope', cause: cause || 'collusion, corruption, or financial-crime control weakness', impact: impact || 'direct loss and integrity challenge', scenarioLabel: 'fraud and integrity scenario' }),
        'The most likely progression is hidden override, collusive behaviour, or financial-crime weakness leading to delayed detection, investigation, and pressure on the credibility of the control environment.',
        'This should be assessed for direct loss, recovery effort, investigation cost, and whether broader assurance or regulatory scrutiny could follow.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'esg') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the sustainability commitment or disclosure area', cause: cause || 'weak ESG controls or disclosure assumptions', impact: impact || 'stakeholder, disclosure, and remediation pressure', scenarioLabel: 'ESG risk scenario' }),
        'The most likely progression is a performance or disclosure gap becoming visible to regulators, investors, employees, or customers, with management forced into reactive remediation.',
        'This should be assessed for reporting credibility, remediation cost, stakeholder trust, and whether wider governance or operational issues are exposed.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'compliance') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the control framework or obligation', cause: cause || 'policy non-compliance or weak assurance', impact: impact || 'remediation and assurance pressure', scenarioLabel: 'compliance risk scenario' }),
        'The most likely progression is policy or control weakness surfacing through assurance, incident response, or management review, creating remediation burden and weaker trust in the control environment.',
        'This should be assessed for remediation cost, assurance impact, disciplinary or legal consequences, and any linked regulatory exposure.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'legal-contract') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the contract, partnership, or rights position in scope', cause: cause || 'ambiguous obligations, weak governance, or a disputed legal position', impact: impact || 'legal cost and delayed delivery', scenarioLabel: 'legal or contract scenario' }),
        'The most likely progression is contractual or rights ambiguity turning into dispute, delayed decisions, commercial strain, and management pressure over how the relationship was structured.',
        'This should be assessed for legal cost, delivery delay, contractual leverage, and whether the dispute starts to erode programme, partner, or market confidence.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'geopolitical') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the market-access or cross-border operating path in scope', cause: cause || 'sovereign restrictions, export controls, or tighter market-access conditions', impact: impact || 'delayed execution and supplier disruption', scenarioLabel: 'geopolitical risk scenario' }),
        'The most likely progression is a policy shift, sanctions condition, or market-access restriction reducing optionality, delaying execution, and forcing management to rethink supplier, market, or operating assumptions.',
        'This should be assessed for strategic value erosion, supply implications, regulatory consequence, and whether the original business case remains credible under the new conditions.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'supply-chain') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the critical supply chain dependency', cause: cause || 'upstream disruption or dependency weakness', impact: impact || 'delivery, inventory, and service pressure', scenarioLabel: 'supply chain risk scenario' }),
        'The most likely progression is dependency disruption, shortage, or logistics failure creating delay, workarounds, commercial pressure, and strain on downstream services.',
        'This should be assessed for delivery impact, recovery options, customer or contract pressure, and continuity consequences if substitutes are limited.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'procurement') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the sourcing or procurement decision', cause: cause || 'weak procurement governance or supplier selection', impact: impact || 'commercial leakage and dependency risk', scenarioLabel: 'procurement risk scenario' }),
        'The most likely progression is weak sourcing governance, contract control failure, or poor supplier fit leading to commercial downside, assurance gaps, or downstream service issues.',
        'This should be assessed for commercial exposure, control weakness, supplier dependence, and whether the decision creates broader compliance or continuity risk.'
      ].join(' ');
      if (/exploitative labor|exploitative labour|forced labor|forced labour|child labor|child labour|modern slavery|labor practice|labour practice|worker exploitation|worker abuse|human rights/.test(intakeText)) {
        scenarioExpansion = [
          _buildScenarioLead({ geography, businessUnit, asset: asset || 'the sourcing category or supplier relationship in scope', cause: cause || 'weak sub-tier supplier oversight or delayed detection of exploitative labor practices', impact: impact || 'regulatory fines, remediation cost, and stakeholder scrutiny', scenarioLabel: 'supplier labor-practice scenario' }),
          'The most likely progression is discovery of abusive labor conditions in the sub-tier supply base, followed by urgent due-diligence review, supplier remediation decisions, and challenge over how the sourcing relationship was governed.',
          'This should be assessed as a combined procurement, compliance, and ESG issue with implications for contract continuity, management oversight, and external scrutiny.'
        ].join(' ');
      }
      if (/collud|price fix|bid rig|inflate (?:their |the )?bid|cartel|anti-?competitive|competition law/.test(intakeText)) {
        scenarioExpansion = [
          _buildScenarioLead({ geography, businessUnit, asset: asset || 'the sourcing event or contract award in scope', cause: cause || 'supplier collusion or bid-rigging behaviour', impact: impact || 'commercial overpayment, challenge to the award decision, and regulatory scrutiny', scenarioLabel: 'procurement collusion scenario' }),
          'The most likely progression is coordinated supplier behaviour distorting price discovery, weakening the integrity of the sourcing process, and pushing management toward an overpriced or poorly governed contract award.',
          'This should be assessed for avoidable commercial leakage, challenge to procurement governance, and whether competition or compliance scrutiny could follow once the pattern becomes visible.'
        ].join(' ');
      }
    } else if (resolvedClassificationKey === 'business-continuity') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the recovery-critical service or process', cause: cause || 'weak continuity or recovery execution', impact: impact || 'extended outage and recovery pressure', scenarioLabel: 'business continuity risk scenario' }),
        'The most likely progression is an incident outlasting recovery assumptions, exposing gaps in continuity planning, fallback operations, communications, and executive decision-making.',
        'This should be assessed for downtime, missed recovery objectives, workaround viability, and the cost of prolonged disruption.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'physical-security') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the sensitive site, facility, or executive movement in scope', cause: cause || 'weak physical access or perimeter control', impact: impact || 'site disruption and leadership concern', scenarioLabel: 'physical-security scenario' }),
        'The most likely progression is an access-control lapse or physical intrusion creating investigation work, site disruption, and wider questions about how facilities and leadership movement were protected.',
        'This should be assessed for site stability, safety implications, recovery effort, and whether the event exposes broader gaps in facilities or executive-protection governance.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'ot-resilience') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the site systems or industrial controls in scope', cause: cause || 'weak OT governance, change failure, or degraded control visibility', impact: impact || 'operational instability and recovery strain', scenarioLabel: 'OT resilience scenario' }),
        'The most likely progression is degraded visibility or control across critical site systems, forcing manual fallback, slower recovery, and decisions about whether operation can continue safely.',
        'This should be assessed for operating instability, continuity implications, safety escalation, and the cost of restoring confidence in the site-control environment.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'people-workforce') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the workforce model or staffing-critical activity in scope', cause: cause || 'fatigue, attrition, welfare concerns, or weak workforce planning', impact: impact || 'operational strain and wellbeing concern', scenarioLabel: 'people and workforce scenario' }),
        'The most likely progression is staffing pressure or labour-practice weakness reducing safe delivery, raising error rates, and forcing management intervention over whether the current operating model remains acceptable.',
        'This should be assessed for workforce sustainability, safe delivery, welfare, and whether the issue creates wider HSE, ESG, or continuity pressure.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'hse') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the affected people, site, or environment', cause: cause || 'safety or environmental control failure', impact: impact || 'injury, shutdown, and remediation exposure', scenarioLabel: 'HSE risk scenario' }),
        'The most likely progression is a control lapse or unsafe condition leading to harm, shutdown, remediation work, and increased regulatory scrutiny.',
        'This should be assessed for people impact, operational interruption, remediation cost, and escalation to regulators or leadership.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'investment-jv') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the deal thesis, JV, or integration path in scope', cause: cause || 'weak diligence or unrealistic integration assumptions', impact: impact || 'value erosion and delayed synergy', scenarioLabel: 'investment or JV scenario' }),
        'The most likely progression is a weak transaction or partnership assumption surfacing through integration friction, delayed value capture, and executive pressure to reset the thesis or operating model.',
        'This should be assessed for value erosion, management distraction, governance mismatch, and whether the investment case still holds under the revised conditions.'
      ].join(' ');
    } else if (resolvedClassificationKey === 'transformation-delivery') {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset: asset || 'the programme roadmap or delivery-critical dependency in scope', cause: cause || 'weak programme governance, ownership, or milestone control', impact: impact || 'delay, rising cost, and missed benefits', scenarioLabel: 'transformation delivery scenario' }),
        'The most likely progression is slippage in dependencies or decision-making turning into delayed milestones, weakened confidence, and a harder path to the intended operating change.',
        'This should be assessed for delivery pressure, benefit delay, management bandwidth, and whether the transformation is now creating operational strain while it slips.'
      ].join(' ');
    } else if (statement) {
      scenarioExpansion = [
        _buildScenarioLead({ geography, businessUnit, asset, cause, impact, scenarioLabel: 'risk scenario' }),
        _ensureSentence(statement)
      ].join(' ');
    }

    summary = _buildRiskContextSummary({ classification, asset, impact, riskTitles });

    return {
      scenarioExpansion: _dedupeSentences(scenarioExpansion),
      summary: _cleanUserFacingText(summary, { maxSentences: 2 }),
      riskTitles
    };
  }

  function _generateRiskBuilderStub(input) {
    const riskStatement = input.riskStatement || '';
    const registerText = input.registerText || '';
    const joined = [riskStatement, registerText].filter(Boolean).join('\n');
    const classification = _classifyScenario(joined || riskStatement, {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: input.scenarioLensHint
    });
    const scenarioLens = _buildScenarioLens(classification);
    const scenarioExpansion = _buildScenarioExpansion({ ...input, classification });
    const risks = scenarioExpansion.riskTitles.map((risk, idx) => ({
      id: `stub-risk-${idx + 1}`,
      title: risk.title,
      category: risk.category,
      description: risk.description || `Candidate risk identified from the intake text${input.businessUnit?.name ? ` for ${input.businessUnit.name}` : ''}.`,
      source: registerText ? 'ai+register' : 'ai',
      regulations: Array.from(new Set([...(risk.regulations || []), ...(input.applicableRegulations || [])])).slice(0, 4)
    }));
    const workflowGuidance = registerText
      ? [
          'Review the extracted risks and keep every material risk that could change exposure, regulation, or business impact.',
          'Use linked mode only when one event could reasonably trigger several of the selected risks in the same chain.',
          'On the next step, use AI assist to turn the selected scope into FAIR ranges with benchmark-backed reasoning.'
        ]
      : [
          'Confirm the scenario wording in plain English before moving on.',
          'Use AI assist on the next step to convert the narrative into FAIR ranges and benchmark-backed reasoning.',
          'Challenge any number that does not fit the business context or known incident history.'
        ];
    return {
      draftNarrative: riskStatement ? scenarioExpansion.scenarioExpansion : '',
      enhancedStatement: riskStatement ? scenarioExpansion.scenarioExpansion : '',
      summary: registerText ? `AI identified ${risks.length} candidate risk${risks.length > 1 ? 's' : ''} from the uploaded material and reframed them into one coherent ${scenarioLens.label.toLowerCase()} scenario.` : scenarioExpansion.summary,
      linkAnalysis: _buildRiskContextLinkAnalysis({ classification, riskTitles: scenarioExpansion.riskTitles }),
      scenarioLens,
      risks,
      regulations: Array.from(new Set([...(input.applicableRegulations || []), ...risks.flatMap(r => r.regulations || [])])),
      workflowGuidance,
      benchmarkBasis: 'Prefer GCC and UAE benchmark references where credible, then fall back to the closest global enterprise comparator. Explain clearly when the starting values come from a scenario-calibration baseline instead of a published benchmark.',
      citations: input.citations || []
    };
  }

  /**
   * Main method: generate scenario and FAIR inputs
   * [LLM-INTEGRATION] Replace stub body with real API call + JSON parsing
   */
  async function generateScenarioAndInputs(narrative, buContext, retrievedDocs, benchmarkCandidates = [], options = {}) {
    const aiUnavailable = isUsingStub();
    const priorPatterns = _getContextResolverPriorPatterns(buContext?.id || '');
    const contextResolution = _buildScenarioContextResolution({
      narrative,
      guidedInput: {},
      businessUnit: buContext,
      adminSettings: buContext,
      geography: buContext?.geography,
      applicableRegulations: buContext?.regulatoryTags || [],
      priorPatterns,
      scenarioLensHint: buContext?.scenarioLensHint
    });
    const classification = contextResolution.classification;
    const feedbackProfile = _getAiFeedbackLearningProfile({
      buId: buContext?.id || buContext?.buId || '',
      functionKey: contextResolution?.lens?.functionKey || buContext?.selectedDepartmentKey || '',
      scenarioLensKey: contextResolution?.lens?.key || classification?.key || ''
    });
    if (aiUnavailable) {
      await new Promise(r => setTimeout(r, 2200 + Math.random() * 800));
    }

    // Try real API first
    if (_compassApiKey || !_isDirectCompassUrl(_compassApiUrl)) {
      try {
        const outputSchema = `{
  "scenarioTitle": "string",
  "scenarioLens": { "key": "string", "label": "string", "functionKey": "string", "estimatePresetKey": "string", "secondaryKeys": ["string"] },
  "structuredScenario": { "assetService": "string", "primaryDriver": "string", "eventPath": "string", "effect": "string" },
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "inputRationale": {
    "tef": "string",
    "vulnerability": "string",
    "lossComponents": "string"
  },
  "fieldRationale": {
    "tefMin": "string",
    "tefLikely": "string",
    "tefMax": "string"
  },
  "suggestedInputs": {
    "TEF": { "min": number, "likely": number, "max": number },
    "controlStrength": { "min": number, "likely": number, "max": number },
    "threatCapability": { "min": number, "likely": number, "max": number },
    "lossComponents": {
      "incidentResponse": { "min": number, "likely": number, "max": number },
      "businessInterruption": { "min": number, "likely": number, "max": number },
      "dataBreachRemediation": { "min": number, "likely": number, "max": number },
      "regulatoryLegal": { "min": number, "likely": number, "max": number },
      "thirdPartyLiability": { "min": number, "likely": number, "max": number },
      "reputationContract": { "min": number, "likely": number, "max": number }
    }
  },
  "recommendations": [{ "title": "string", "why": "string", "impact": "string" }]
}`;
        const systemPrompt = `You are a senior enterprise risk analyst specialising in FAIR methodology and international risk and regulatory environments.

Before producing your JSON output, reason through the following three questions:
1. What is the most credible threat path for this scenario given the business context, the specific geography, and the applicable regulations provided? Be specific about actor, method, and likely first-order effect.
2. What assumption in the FAIR inputs would most change the loss estimate if it were wrong? Name it explicitly.
3. What is the single most important control or action that would most reduce expected loss for this scenario?

Use that reasoning to shape scenarioTitle, structuredScenario, inputRationale, workflowGuidance, and recommendations. Do not include the reasoning questions themselves in the JSON output.

The applicable regulations, geographic scope, and benchmark strategy will be provided in the user prompt. Use those as the primary reference — do not assume a default jurisdiction or benchmark source. Where the user prompt specifies a benchmark preference, follow that strategy explicitly and note any fallback in benchmarkBasis.

Respond ONLY with valid JSON matching this exact schema:
${outputSchema}

Also return a 'fieldRationale' object with a one-sentence justification for each FAIR input field you estimated. Keys must match the fairParams field names. Example: { "tefLikely": "Based on GCC financial-sector incident frequency averaging 1.2 events/year (ISO 27001 Annex A ref)." }.`;
        const evidenceMeta = _buildEvidenceMeta({ citations: retrievedDocs, businessUnit: buContext, geography: buContext?.geography, applicableRegulations: buContext?.regulatoryTags || [], userProfile: buContext?.userProfileSummary, organisationContext: buContext?.companyStructureContext });
        const userPrompt = `Risk narrative: ${narrative}
Scenario taxonomy hint: ${classification.scenarioType} | ${classification.eventPath} | ${classification.effect}
Primary lens hint: ${_normaliseScenarioHintKey(contextResolution?.lens?.key || buContext?.scenarioLensHint) || classification.key}
If the scenario clearly spans another domain as a secondary aspect, include up to 2 secondary lens keys. Do not let a profile hint override an explicit primary event signal.
BU: ${buContext?.name || 'Unknown'}
Data types: ${(buContext?.dataTypes || []).join(', ')}
Regulatory tags: ${(buContext?.regulatoryTags || []).join(', ')}
Critical services: ${(buContext?.criticalServices || []).join(', ')}
Geography: ${buContext?.geography || 'Unknown'}
Benchmark strategy: ${buContext?.benchmarkStrategy || 'Prefer GCC and UAE references, then fall back to best global data with clear explanation.'}
Context applicability resolution:
${_buildContextResolutionPromptBlock(contextResolution)}
${_buildFeedbackLearningPromptBlock(feedbackProfile)}
Relevant citations:
${_buildCitationPromptBlock(retrievedDocs)}

Structured numeric benchmarks:
${BenchmarkService.buildPromptBlock(benchmarkCandidates)}

Evidence quality context:
${evidenceMeta.promptBlock}

Treat the primary lens hint as the leading domain for this scenario unless the narrative clearly contradicts it.`;

        const raw = await _callLLM(systemPrompt, userPrompt, {
          taskName: 'generateScenarioAndInputs',
          maxPromptChars: 24000,
          priorMessages: Array.isArray(options?.priorMessages)
            ? options.priorMessages
            : (Array.isArray(buContext?.priorMessages) ? buContext.priorMessages : []),
          traceLabel: options.traceLabel || 'Step 2 scenario analysis',
          traceSources: retrievedDocs
        });
        if (raw) {
          const parsed = await _parseOrRepairStructuredJson(raw, outputSchema, {
            taskName: 'repairGenerateScenarioAndInputs'
          }) || {};
          const fallback = _generateStub(narrative, buContext, retrievedDocs, benchmarkCandidates);
          const parsedInputs = parsed?.suggestedInputs || {};
          const fallbackInputs = fallback.suggestedInputs || {};
          const parsedLoss = parsedInputs.lossComponents || {};
          const fallbackLoss = fallbackInputs.lossComponents || {};
          const allowedFieldRationaleKeys = [
            'tefMin', 'tefLikely', 'tefMax',
            'controlStrMin', 'controlStrLikely', 'controlStrMax',
            'threatCapMin', 'threatCapLikely', 'threatCapMax',
            'irMin', 'irLikely', 'irMax',
            'biMin', 'biLikely', 'biMax',
            'dbMin', 'dbLikely', 'dbMax',
            'rlMin', 'rlLikely', 'rlMax',
            'tpMin', 'tpLikely', 'tpMax',
            'rcMin', 'rcLikely', 'rcMax'
          ];
          const parsedFieldRationale = Object.fromEntries(
            allowedFieldRationaleKeys
              .map((key) => {
                const value = _cleanUserFacingText(parsed?.fieldRationale?.[key] || '', { maxSentences: 1 });
                return value ? [key, value] : null;
              })
              .filter(Boolean)
          );
          const ensureRange = (value, fallbackRange) => ({
            min: value?.min ?? fallbackRange?.min ?? 0,
            likely: value?.likely ?? fallbackRange?.likely ?? 0,
            max: value?.max ?? fallbackRange?.max ?? 0,
          });
          const cleanedTitle = String(parsed.scenarioTitle || '').trim();
          const keepFallbackClassification = classification.key === 'identity' && /cloud|misconfig/i.test(cleanedTitle);
          const titleCoherent = !cleanedTitle || _isScenarioTextCoherent(cleanedTitle, {
            seedNarrative: narrative,
            guidedInput: {},
            classification
          });
          return _decorateAiResult(_withEvidenceMeta({
            ...fallback,
            ...parsed,
            scenarioTitle: _cleanUserFacingText(
              keepFallbackClassification || !titleCoherent
                ? fallback.scenarioTitle
                : (cleanedTitle || fallback.scenarioTitle),
              { maxSentences: 1, stripTrailingPeriod: true }
            ),
            scenarioLens: _normaliseScenarioLens(parsed.scenarioLens, fallback.scenarioLens),
            structuredScenario: (() => {
              const mergedStructured = {
                ...fallback.structuredScenario,
                ...(keepFallbackClassification ? {} : (parsed.structuredScenario || {}))
              };
              return normaliseStructuredScenario({
                ...mergedStructured,
                assetService: _cleanUserFacingText(getStructuredScenarioField(mergedStructured, 'assetService') || '', { maxSentences: 1, stripTrailingPeriod: true }),
                primaryDriver: _cleanUserFacingText(getStructuredScenarioField(mergedStructured, 'primaryDriver') || '', { maxSentences: 1, stripTrailingPeriod: true }),
                eventPath: _cleanUserFacingText(getStructuredScenarioField(mergedStructured, 'eventPath') || '', { maxSentences: 1, stripTrailingPeriod: true }),
                effect: _cleanUserFacingText(getStructuredScenarioField(mergedStructured, 'effect') || '', { maxSentences: 2 })
              }, { preserveUnknown: true });
            })(),
            workflowGuidance: _normaliseGuidance(parsed.workflowGuidance?.length ? parsed.workflowGuidance : fallback.workflowGuidance),
            benchmarkBasis: _normaliseBenchmarkBasis(parsed.benchmarkBasis || fallback.benchmarkBasis || ''),
            benchmarkReferences: BenchmarkService.buildReferenceList(benchmarkCandidates),
            inputProvenance: BenchmarkService.buildInputProvenance(benchmarkCandidates),
            inputRationale: _normaliseInputRationale({
              ...fallback.inputRationale,
              ...(parsed.inputRationale || {}),
              fieldRationale: parsedFieldRationale
            }),
            fieldRationale: parsedFieldRationale,
            suggestedInputs: {
              ...fallbackInputs,
              ...parsedInputs,
              TEF: ensureRange(parsedInputs.TEF, fallbackInputs.TEF),
              controlStrength: ensureRange(parsedInputs.controlStrength, fallbackInputs.controlStrength),
              threatCapability: ensureRange(parsedInputs.threatCapability, fallbackInputs.threatCapability),
              lossComponents: {
                ...fallbackLoss,
                ...parsedLoss,
                incidentResponse: ensureRange(parsedLoss.incidentResponse, fallbackLoss.incidentResponse),
                businessInterruption: ensureRange(parsedLoss.businessInterruption, fallbackLoss.businessInterruption),
                dataBreachRemediation: ensureRange(parsedLoss.dataBreachRemediation, fallbackLoss.dataBreachRemediation),
                regulatoryLegal: ensureRange(parsedLoss.regulatoryLegal, fallbackLoss.regulatoryLegal),
                thirdPartyLiability: ensureRange(parsedLoss.thirdPartyLiability, fallbackLoss.thirdPartyLiability),
                reputationContract: ensureRange(parsedLoss.reputationContract, fallbackLoss.reputationContract),
              }
            },
            recommendations: _normaliseRiskCards((parsed.recommendations || fallback.recommendations || []).map((rec) => ({ title: rec.title, category: 'Recommendation', description: rec.why, regulations: [], impact: rec.impact }))).map((rec) => ({ title: rec.title, why: rec.description, impact: rec.impact || '' })),
            citations: retrievedDocs,
            contextResolution
          }, evidenceMeta), evidenceMeta, {
            contentFields: ['scenarioTitle', 'benchmarkBasis'],
            fallbackUsed: !titleCoherent
          });
        }
      } catch (e) {
        await _auditAiFallback('generateScenarioAndInputs', e);
        console.warn('LLM API call failed, falling back to stub:', e.message);
        const normalisedError = _normaliseLLMError(e);
        if (_isStructuredResponseFailure(normalisedError) || _isStructuredResponseFailure(e)) {
          const fallbackMeta = _buildEvidenceMeta({ citations: retrievedDocs, businessUnit: buContext, geography: buContext?.geography, applicableRegulations: buContext?.regulatoryTags || [], userProfile: buContext?.userProfileSummary, organisationContext: buContext?.companyStructureContext });
          return _decorateAiResult(_withEvidenceMeta(_generateStub(narrative, buContext, retrievedDocs, benchmarkCandidates), fallbackMeta), fallbackMeta, {
            contentFields: ['scenarioTitle', 'benchmarkBasis'],
            fallbackUsed: true
          });
        }
        throw Object.assign(new Error(normalisedError?.message || e?.message || 'AI request failed'), {
          code: 'LLM_UNAVAILABLE',
          retriable: true,
          originalError: e
        });
      }
    }

    // Fall back to stub
    const fallbackMeta = _buildEvidenceMeta({ citations: retrievedDocs, businessUnit: buContext, geography: buContext?.geography, applicableRegulations: buContext?.regulatoryTags || [], userProfile: buContext?.userProfileSummary, organisationContext: buContext?.companyStructureContext });
    const fallbackResult = _decorateAiResult(_withEvidenceMeta(_generateStub(narrative, buContext, retrievedDocs, benchmarkCandidates), fallbackMeta), fallbackMeta, {
      contentFields: ['scenarioTitle', 'benchmarkBasis'],
      fallbackUsed: true
    });
    return aiUnavailable ? { ...fallbackResult, aiUnavailable: true } : fallbackResult;
  }

  async function streamNarrativeRefinement(input = {}, onChunk = null, options = {}) {
    const narrative = String(input.narrative || input.riskStatement || '').trim();
    const buContext = input.buContext || input.businessUnit || {};
    const retrievedDocs = Array.isArray(input.retrievedDocs) ? input.retrievedDocs : [];
    const benchmarkCandidates = Array.isArray(input.benchmarkCandidates) ? input.benchmarkCandidates : [];
    if (!narrative) {
      return generateScenarioAndInputs(narrative, buContext, retrievedDocs, benchmarkCandidates);
    }
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) {
      const offlineResult = await generateScenarioAndInputs(narrative, buContext, retrievedDocs, benchmarkCandidates);
      return {
        ...offlineResult,
        draftNarrative: narrative,
        enhancedStatement: offlineResult.enhancedStatement || narrative,
        aiUnavailable: true
      };
    }

    const classification = _classifyScenario(narrative, {
      businessUnit: buContext,
      scenarioLensHint: buContext?.scenarioLensHint
    });
    const systemPrompt = `You are a senior enterprise risk analyst specialising in FAIR methodology and international risk and regulatory environments.

Rewrite the user's scenario into one sharper, clearer narrative only.
- stay faithful to the original event
- keep the original business context and impact
- make the narrative easier to assess
- keep it to 2-4 sentences
- do not output JSON
- do not add headings or bullets
- do not change the scenario domain unless the narrative clearly requires it`;
    const userPrompt = `Risk narrative: ${narrative}
Scenario taxonomy hint: ${classification.scenarioType} | ${classification.eventPath} | ${classification.effect}
Primary lens hint: ${_normaliseScenarioHintKey(buContext?.scenarioLensHint) || classification.key}
BU: ${buContext?.name || 'Unknown'}
Data types: ${(buContext?.dataTypes || []).join(', ')}
Regulatory tags: ${(buContext?.regulatoryTags || []).join(', ')}
Critical services: ${(buContext?.criticalServices || []).join(', ')}
Geography: ${buContext?.geography || 'Unknown'}
BU context summary: ${buContext?.contextSummary || buContext?.notes || '(none)'}
BU-specific AI guidance: ${buContext?.aiGuidance || '(none)'}
Benchmark strategy: ${buContext?.benchmarkStrategy || 'Prefer GCC and UAE references, then fall back to best global data with clear explanation.'}
Company context profile: ${buContext?.companyContextProfile || '(none)'}
User profile context:
${buContext?.userProfileSummary || '(none)'}
Organisation structure context:
${buContext?.companyStructureContext || '(none)'}
Live scoped context:
${_buildContextPromptBlock(
  buContext,
  buContext,
  (typeof getRelevantScenarioPatterns === 'function'
    ? getRelevantScenarioPatterns(buContext?.id || '')
    : [])
)}
Relevant citations:
${_buildCitationPromptBlock(retrievedDocs)}

Structured numeric benchmarks:
${BenchmarkService.buildPromptBlock(benchmarkCandidates)}

Return only the refined scenario narrative text.`;

    let refinedNarrative = narrative;
    try {
      const streamed = await _streamLLM(systemPrompt, userPrompt, {
        taskName: 'streamNarrativeRefinement',
        maxCompletionTokens: Number(options.maxCompletionTokens || 500),
        maxPromptChars: Number(options.maxPromptChars || 24000),
        temperature: Number(options.temperature ?? 0.4),
        priorMessages: Array.isArray(options.priorMessages) ? options.priorMessages : [],
        traceLabel: options.traceLabel || 'Step 2 narrative refinement',
        traceSources: retrievedDocs
      }, onChunk);
      const cleaned = _cleanUserFacingText(streamed || '', { maxSentences: 4 });
      if (cleaned) refinedNarrative = cleaned;
    } catch (error) {
      throw _normaliseLLMError(error);
    }

    const result = await generateScenarioAndInputs(
      refinedNarrative,
      Array.isArray(options.priorMessages) && options.priorMessages.length
        ? { ...buContext, priorMessages: options.priorMessages }
        : buContext,
      retrievedDocs,
      benchmarkCandidates,
      {
        priorMessages: Array.isArray(options.priorMessages) ? options.priorMessages : [],
        traceLabel: options.traceResultLabel || 'Step 2 scenario analysis'
      }
    );
    return {
      ...result,
      draftNarrative: refinedNarrative,
      enhancedStatement: refinedNarrative
    };
  }

  function _normaliseRiskBuilderCandidate(parsed = {}, input = {}, {
    classification = {},
    contextResolution = null,
    fallbackScenarioExpansion = {}
  } = {}) {
    const draftSentenceLimit = _getRiskBuilderDraftSentenceLimit();
    return {
      ...parsed,
      scenarioLens: _normaliseScenarioLens(parsed.scenarioLens, _buildScenarioLens(classification)),
      draftNarrative: _cleanUserFacingText(parsed.draftNarrative || '', { maxSentences: draftSentenceLimit }),
      enhancedStatement: _buildEnhancedNarrative(input, parsed.enhancedStatement),
      summary: _cleanUserFacingText(
        _looksGenericRiskContextCopy(parsed.summary) ? fallbackScenarioExpansion.summary : (parsed.summary || fallbackScenarioExpansion.summary),
        { maxSentences: 3 }
      ),
      linkAnalysis: _cleanUserFacingText(
        _looksGenericRiskContextCopy(parsed.linkAnalysis)
          ? _buildRiskContextLinkAnalysis({ classification, riskTitles: fallbackScenarioExpansion.riskTitles })
          : (parsed.linkAnalysis || _buildRiskContextLinkAnalysis({ classification, riskTitles: fallbackScenarioExpansion.riskTitles })),
        { maxSentences: 3 }
      ),
      workflowGuidance: _normaliseGuidance(parsed.workflowGuidance),
      benchmarkBasis: _normaliseBenchmarkBasis(parsed.benchmarkBasis || 'Use FAIR-aligned assumptions, test them against control evidence, and prefer local regulatory or operational comparators where credible before falling back to mature global incident patterns.'),
      risks: _filterScenarioRelevantRisks(
        Array.isArray(parsed.risks) && parsed.risks.length ? parsed.risks : fallbackScenarioExpansion.riskTitles,
        {
          seedNarrative: input.riskStatement || input.registerText || '',
          guidedInput: input.guidedInput,
          classification,
          fallbackRisks: fallbackScenarioExpansion.riskTitles
        }
      ),
      regulations: Array.from(new Set((parsed.regulations || []).map(String).filter(Boolean))),
      citations: input.citations || [],
      contextResolution
    };
  }

  function _toRiskBuilderQualityCandidate(candidate = {}) {
    return {
      draftNarrative: candidate.draftNarrative || '',
      enhancedStatement: candidate.enhancedStatement || '',
      summary: candidate.summary || '',
      linkAnalysis: candidate.linkAnalysis || '',
      scenarioLens: candidate.scenarioLens || {},
      workflowGuidance: Array.isArray(candidate.workflowGuidance) ? candidate.workflowGuidance : [],
      benchmarkBasis: candidate.benchmarkBasis || '',
      risks: Array.isArray(candidate.risks) ? candidate.risks.map((risk) => ({
        title: risk.title || '',
        category: risk.category || '',
        description: risk.description || '',
        confidence: risk.confidence || 'medium',
        regulations: Array.isArray(risk.regulations) ? risk.regulations : []
      })) : [],
      regulations: Array.isArray(candidate.regulations) ? candidate.regulations : []
    };
  }

  function _buildRiskBuilderQualityContext(input = {}, {
    classification = {},
    contextResolution = null
  } = {}) {
    return [
      `Risk statement: ${input.riskStatement || '(none)'}`,
      `Register text: ${input.registerText || '(none)'}`,
      `Guided input: ${JSON.stringify(input.guidedInput || {})}`,
      `Business unit: ${input.businessUnit?.name || 'Unknown'}`,
      `Geography: ${input.geography || 'Unknown'}`,
      `Applicable regulations: ${(input.applicableRegulations || []).join(', ') || '(none)'}`,
      `Primary classification: ${classification?.key || 'general'} / ${classification?.scenarioType || 'General Enterprise Risk Scenario'}`,
      `Context resolution: ${_buildContextResolutionPromptBlock(contextResolution)}`,
      _buildAiTuningPromptBlock(_getAiFeedbackTuning())
    ].join('\n');
  }

  function _normaliseRegisterAnalysisCandidate(parsed = {}) {
    return {
      summary: _cleanUserFacingText(parsed.summary || '', { maxSentences: 3 }),
      linkAnalysis: _cleanUserFacingText(parsed.linkAnalysis || '', { maxSentences: 3 }),
      workflowGuidance: _normaliseGuidance(parsed.workflowGuidance),
      benchmarkBasis: _normaliseBenchmarkBasis(parsed.benchmarkBasis || ''),
      risks: _normaliseRiskCards(parsed.risks).map((risk, idx) => ({
        id: risk.id || `register-risk-${idx + 1}`,
        title: risk.title,
        category: risk.category || 'Register',
        description: risk.description || 'Imported from the uploaded register for review.',
        confidence: risk.confidence || 'medium',
        source: risk.source || 'register',
        regulations: risk.regulations || []
      }))
    };
  }

  function _toRegisterAnalysisQualityCandidate(candidate = {}) {
    return {
      summary: candidate.summary || '',
      linkAnalysis: candidate.linkAnalysis || '',
      workflowGuidance: Array.isArray(candidate.workflowGuidance) ? candidate.workflowGuidance : [],
      benchmarkBasis: candidate.benchmarkBasis || '',
      risks: Array.isArray(candidate.risks) ? candidate.risks.map((risk) => ({
        title: risk.title || '',
        category: risk.category || '',
        description: risk.description || '',
        confidence: risk.confidence || 'medium',
        regulations: Array.isArray(risk.regulations) ? risk.regulations : []
      })) : []
    };
  }

  async function enhanceRiskContext(input) {
    const aiUnavailable = isUsingStub();
    const priorPatterns = _getContextResolverPriorPatterns(input.businessUnit?.id || '');
    const contextResolution = _buildScenarioContextResolution({
      narrative: input.riskStatement || input.registerText || '',
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      adminSettings: input.adminSettings,
      geography: input.geography,
      applicableRegulations: input.applicableRegulations,
      priorPatterns,
      scenarioLensHint: input.scenarioLensHint
    });
    const classification = contextResolution.classification;
    const feedbackProfile = _getAiFeedbackLearningProfile({
      buId: input.businessUnit?.id || input.businessUnit?.buId || '',
      functionKey: contextResolution?.lens?.functionKey || input.businessUnit?.selectedDepartmentKey || '',
      scenarioLensKey: contextResolution?.lens?.key || classification?.key || ''
    });
    const fallbackScenarioExpansion = _buildScenarioExpansion({ ...input, classification });
    if (aiUnavailable) {
      await new Promise(r => setTimeout(r, 1400 + Math.random() * 600));
    }
    if (_compassApiKey || !_isDirectCompassUrl(_compassApiUrl)) {
      try {
        const tuning = _getAiFeedbackTuning();
        const draftInstruction = tuning.draftStyle === 'executive-brief'
          ? '- write draftNarrative as a 2-3 sentence management briefing that stays close to the user event wording while making the scenario sharper, more specific, and easier to assess'
          : '- write draftNarrative as a 2-4 sentence scenario constructor that stays close to the user event wording while making the scenario sharper, more specific, and easier to assess';
        const shortlistInstruction = tuning.shortlistDiscipline === 'strict'
          ? '- keep the shortlist tight: include only risks that clearly belong in the same event tree and management discussion'
          : '- produce concise but concrete candidate risks that a user can choose from';
        const outputSchema = `{
  "draftNarrative": "string",
  "enhancedStatement": "string",
  "summary": "string",
  "linkAnalysis": "string",
  "scenarioLens": { "key": "string", "label": "string", "functionKey": "string", "estimatePresetKey": "string", "secondaryKeys": ["string"] },
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "risks": [
    { "title": "string", "category": "string", "description": "string", "confidence": "high|medium|low", "regulations": ["string"] }
  ],
  "regulations": ["string"]
}`;
        const systemPrompt = `You are a senior enterprise risk analyst with deep expertise in FAIR methodology and international regulatory environments including strategic, operational, cyber, AI/model risk, data governance/privacy, third-party, regulatory, financial, fraud/integrity, ESG, compliance, legal/contract, geopolitical, supply chain, procurement, business continuity, physical security, OT resilience, people/workforce, investment/JV, transformation delivery, and HSE scenarios.

Before producing your JSON output, reason through the following three questions in this order:
1. What is the most credible threat path given the scenario, business context, and the specific geography and regulations provided? Name the most likely actor, method, and first-order effect.
2. What is the weakest assumption in this scenario — the thing that, if wrong, would most change the loss estimate? Be specific.
3. What is the single most important action the user should take next to make this scenario estimate-ready?

Use that reasoning to shape all fields in your output, especially enhancedStatement, linkAnalysis, and workflowGuidance. Do not include the reasoning questions themselves in the JSON output.

The applicable regulations and geographic scope will be provided in the user prompt. Use those as the primary reference for regulatory framing — do not assume a default jurisdiction.

If the scenario concerns identity compromise (Azure AD, Entra, SSO, directory services), explain likely downstream effects: mailbox compromise, privileged misuse, tenant changes, service disruption, fraud, and data exposure where relevant.

Return JSON only with this schema:
${outputSchema}`;
        const evidenceMeta = _buildEvidenceMeta({ citations: input.citations || [], businessUnit: input.businessUnit, geography: input.geography, applicableRegulations: input.applicableRegulations, uploadedText: input.registerText, registerText: input.registerText, userProfile: input.adminSettings?.userProfileSummary, organisationContext: input.adminSettings?.companyStructureContext, adminSettings: input.adminSettings });
        const userPrompt = `Instructions:
${draftInstruction}
- make draftNarrative explicitly cover the event, the affected area, the primary driver, and the main business consequence without drifting into a different scenario
- make the enhancedStatement read like a realistic scenario narrative, not a polished restatement
- explain the most likely progression of the event and the common secondary effects
- include business and operational consequences, not just the technical failure
- reflect the stated urgency where provided
- if the scenario involves identity, directory, SSO, or Azure AD/Entra compromise, include plausible knock-on effects such as mailbox compromise, privileged misuse, tenant changes, service disruption, fraud, and data exposure where relevant
- produce concise but concrete candidate risks that a user can choose from
${tuning.shortlistDiscipline === 'strict' ? shortlistInstruction : ''}
- For each risk, include a "confidence" field: "high", "medium", or "low". High = directly evidenced by the scenario description and retrieved docs. Medium = reasonably inferred from the scenario context. Low = potentially relevant but speculative given the current information.
- classify the scenario using credible enterprise risk taxonomy across strategic, operational, cyber, AI/model risk, data governance/privacy, third-party, regulatory, financial, fraud/integrity, ESG, compliance, legal/contract, geopolitical, supply chain, procurement, business continuity, physical security, OT resilience, people/workforce, investment/JV, transformation delivery, and HSE lenses; do not force a scenario into cyber if the primary driver is strategic, operational, governance, people, or market-related
- the user's described event path wins over business-unit profile text, regulatory tags, and generic compliance language; do not recast a financial, supplier, continuity, or operational event as compliance unless the event itself is a compliance breach
- use the context applicability resolution below as binding guidance: APPLIES items can shape domain and risk selection, MAYBE items can refine wording, and IGNORE items must not steer the classification or shortlist

Business unit: ${input.businessUnit?.name || 'Unknown'}
Geography: ${input.geography || 'Unknown'}
Primary lens hint: ${_normaliseScenarioHintKey(contextResolution?.lens?.key || input.scenarioLensHint) || classification.key}
If the scenario clearly spans another domain as a secondary aspect, include up to 2 secondary lens keys. Do not let a profile hint override an explicit primary event signal.
Applicable regulations: ${(input.applicableRegulations || []).join(', ')}
Guided intake: ${JSON.stringify(input.guidedInput || {})}
Benchmark strategy: ${input.adminSettings?.benchmarkStrategy || ''}
Context applicability resolution:
${_buildContextResolutionPromptBlock(contextResolution)}
${_buildFeedbackLearningPromptBlock(feedbackProfile)}
${_buildAiTuningPromptBlock(tuning)}
Register metadata: ${input.registerMeta ? JSON.stringify(input.registerMeta) : '(none)'}

Risk statement:
${input.riskStatement || '(none)'}

Risk register text:
${input.registerText || '(none)'}

Retrieved citations:
${_buildCitationPromptBlock(input.citations || [])}

Evidence quality context:
${evidenceMeta.promptBlock}

Treat the primary lens hint as the leading domain for this scenario unless the narrative clearly contradicts it.`;
        const raw = await _callLLM(systemPrompt, userPrompt, {
          taskName: 'enhanceRiskContext',
          temperature: 0.6,
          maxPromptChars: 24000,
          priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : [],
          traceLabel: input.traceLabel || 'Step 1 scenario assist',
          traceSources: input.citations || []
        });
        if (raw) {
          const parsed = await _parseOrRepairStructuredJson(raw, outputSchema, {
            taskName: 'repairEnhanceRiskContext'
          }) || {};
          let candidateResult = _normaliseRiskBuilderCandidate(parsed, input, {
            classification,
            contextResolution,
            fallbackScenarioExpansion
          });
          let usedAiQualityGate = false;
          try {
            const qualityChecked = await _runStructuredQualityGate({
              taskName: 'enhanceRiskContextQualityGate',
              schemaHint: outputSchema,
              originalContext: _buildRiskBuilderQualityContext(input, { classification, contextResolution }),
              checklist: [
                'Keep the primary lens faithful to the user event path, not generic cloud, IT, compliance, or regulatory wording.',
                'If the scenario is outage, downtime, aging infrastructure, fragility, or human error, keep it operational or continuity-led unless there is explicit cyber compromise evidence.',
                'Keep only risks that belong to the same event tree and management discussion.',
                'Remove generic or off-domain risks that do not align strongly with the described event.',
                tuning.draftStyle === 'executive-brief'
                  ? 'Make the draft narrative read like a short management briefing with no taxonomy lead-in and no filler.'
                  : 'Make the draft narrative concrete, concise, and directly tied to event, affected area, cause, and main consequence.'
              ],
              candidatePayload: _toRiskBuilderQualityCandidate(candidateResult),
              traceLabel: `${input.traceLabel || 'Step 1 scenario assist'} quality gate`,
              traceSources: input.citations || []
            });
            if (qualityChecked) {
              candidateResult = _normaliseRiskBuilderCandidate(qualityChecked, input, {
                classification,
                contextResolution,
                fallbackScenarioExpansion
              });
              usedAiQualityGate = true;
            }
          } catch (qualityGateError) {
            await _auditAiFallback('enhanceRiskContextQualityGate', qualityGateError);
            console.warn('enhanceRiskContext quality gate fallback:', qualityGateError.message);
          }
          const candidateAlignment = _buildAiAlignment(input, candidateResult, {
            classification,
            seedNarrative: input.riskStatement || input.registerText || '',
            fallbackScenarioExpansion
          });
          const summaryCoherent = _isScenarioTextCoherent(candidateResult.summary, {
            seedNarrative: input.riskStatement || input.registerText || '',
            guidedInput: input.guidedInput,
            classification
          });
          const linkAnalysisCoherent = _isScenarioTextCoherent(candidateResult.linkAnalysis, {
            seedNarrative: input.riskStatement || input.registerText || '',
            guidedInput: input.guidedInput,
            classification
          });
          const hasCriticalAlignmentIssue = Array.isArray(candidateAlignment.checks)
            && candidateAlignment.checks.some((check) => (
              check?.status !== 'ok'
              && ['Primary lens', 'Scenario draft', 'Shortlist fit'].includes(String(check?.label || ''))
            ));
          const coherenceFallback = usedAiQualityGate
            ? false
            : (candidateAlignment.score < 65 || hasCriticalAlignmentIssue || !summaryCoherent || !linkAnalysisCoherent);
          const coherentRiskTitles = _rerankRisksWithFeedback(_filterScenarioRelevantRisks(candidateResult.risks, {
            seedNarrative: input.riskStatement || input.registerText || '',
            guidedInput: input.guidedInput,
            classification,
            fallbackRisks: fallbackScenarioExpansion.riskTitles
          }), feedbackProfile);
          const coherentSummary = (!summaryCoherent || coherenceFallback)
            ? _buildRiskContextSummary({
                classification,
                asset: input.guidedInput?.asset || '',
                impact: input.guidedInput?.impact || '',
                riskTitles: coherentRiskTitles
              })
            : candidateResult.summary;
          const coherentLinkAnalysis = (!linkAnalysisCoherent || coherenceFallback)
            ? _buildRiskContextLinkAnalysis({
                classification,
                riskTitles: coherentRiskTitles
              })
            : candidateResult.linkAnalysis;
          const finalResult = coherenceFallback
            ? {
                ...candidateResult,
                draftNarrative: fallbackScenarioExpansion.scenarioExpansion,
                summary: coherentSummary,
                linkAnalysis: coherentLinkAnalysis,
                scenarioLens: _buildScenarioLens(classification),
                risks: coherentRiskTitles
              }
            : {
                ...candidateResult,
                summary: coherentSummary,
                linkAnalysis: coherentLinkAnalysis,
                risks: coherentRiskTitles
              };
          finalResult.aiValidationMode = usedAiQualityGate ? 'live_quality_gate' : (coherenceFallback ? 'local_fallback' : 'local_checks');
          finalResult.aiAlignment = _buildAiAlignment(input, finalResult, {
            classification,
            seedNarrative: input.riskStatement || input.registerText || '',
            fallbackScenarioExpansion
          });
          return _decorateAiResult(_withEvidenceMeta(finalResult, evidenceMeta), evidenceMeta, {
            contentFields: ['enhancedStatement', 'summary', 'linkAnalysis', 'benchmarkBasis'],
            fallbackUsed: coherenceFallback
          });
        }
      } catch (e) {
        await _auditAiFallback('enhanceRiskContext', e);
        console.warn('enhanceRiskContext fallback:', e.message);
        const normalisedError = _normaliseLLMError(e);
        if (_isStructuredResponseFailure(normalisedError) || _isStructuredResponseFailure(e)) {
          const fallbackMeta = _buildEvidenceMeta({ citations: input.citations || [], businessUnit: input.businessUnit, geography: input.geography, applicableRegulations: input.applicableRegulations, uploadedText: input.registerText, registerText: input.registerText, userProfile: input.adminSettings?.userProfileSummary, organisationContext: input.adminSettings?.companyStructureContext, adminSettings: input.adminSettings });
          const fallbackResult = _generateRiskBuilderStub(input);
          fallbackResult.aiAlignment = _buildAiAlignment(input, fallbackResult, {
            classification,
            seedNarrative: input.riskStatement || input.registerText || '',
            fallbackScenarioExpansion
          });
          return _decorateAiResult(_withEvidenceMeta(fallbackResult, fallbackMeta), fallbackMeta, {
            contentFields: ['enhancedStatement', 'summary', 'linkAnalysis', 'benchmarkBasis'],
            fallbackUsed: true
          });
        }
        throw Object.assign(new Error(normalisedError?.message || e?.message || 'AI request failed'), {
          code: 'LLM_UNAVAILABLE',
          retriable: true,
          originalError: e
        });
      }
    }
    const fallbackMeta = _buildEvidenceMeta({ citations: input.citations || [], businessUnit: input.businessUnit, geography: input.geography, applicableRegulations: input.applicableRegulations, uploadedText: input.registerText, registerText: input.registerText, userProfile: input.adminSettings?.userProfileSummary, organisationContext: input.adminSettings?.companyStructureContext, adminSettings: input.adminSettings });
    const fallbackResult = _generateRiskBuilderStub(input);
    fallbackResult.aiAlignment = _buildAiAlignment(input, fallbackResult, {
      classification,
      seedNarrative: input.riskStatement || input.registerText || '',
      fallbackScenarioExpansion
    });
    const decoratedFallback = _decorateAiResult(_withEvidenceMeta(fallbackResult, fallbackMeta), fallbackMeta, {
      contentFields: ['enhancedStatement', 'summary', 'linkAnalysis', 'benchmarkBasis'],
      fallbackUsed: true
    });
    return aiUnavailable ? { ...decoratedFallback, aiUnavailable: true } : decoratedFallback;
  }

  async function analyseRiskRegister(input) {
    const aiUnavailable = isUsingStub();
    if (aiUnavailable) {
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
    }
    const lines = String(input.registerText || '')
      .split(/\r?\n|;/)
      .map(line => line.trim())
      .filter(line => line.length > 10)
      .slice(0, 20);
    let fallbackReason = null;
    const evidenceMeta = _buildEvidenceMeta({
      citations: input.citations || [],
      businessUnit: input.businessUnit,
      geography: input.geography,
      applicableRegulations: input.applicableRegulations,
      uploadedText: input.registerText,
      registerText: input.registerText,
      userProfile: input.adminSettings?.userProfileSummary,
      organisationContext: input.adminSettings?.companyStructureContext,
      adminSettings: input.adminSettings
    });
    const compactRegisterText = _truncateText(input.registerText || '', 5000);
    const compactContextSummary = _truncateText(input.businessUnit?.contextSummary || input.businessUnit?.notes || '(none)', 320);
    const compactAdminSummary = _truncateText(input.adminSettings?.adminContextSummary || '', 220);
    const compactUserProfile = _truncateText(input.adminSettings?.userProfileSummary || '(none)', 220);
    const compactOrgContext = _truncateText(input.adminSettings?.companyStructureContext || '(none)', 320);
    const compactLiveContext = _truncateText(_buildContextPromptBlock(input.adminSettings, input.businessUnit), 320);
    if (_compassApiKey || !_isDirectCompassUrl(_compassApiUrl)) {
      try {
        const outputSchema = `{
  "summary": "string",
  "linkAnalysis": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "risks": [
    { "title": "string", "category": "string", "description": "string", "confidence": "high|medium|low", "regulations": ["string"] }
  ]
}`;
        const systemPrompt = `You are a senior enterprise risk analyst. You will receive a risk register that may contain multiple sheets, multiple columns, and contextual metadata. Return JSON only with this schema:
${outputSchema}`;
        const userPrompt = `Business unit: ${input.businessUnit?.name || 'Unknown'}
Geography: ${input.geography || 'Unknown'}
BU context summary: ${compactContextSummary}
BU-specific AI guidance: ${input.businessUnit?.aiGuidance || '(none)'}
Applicable regulations: ${(input.applicableRegulations || []).slice(0, 8).join(', ')}
Register metadata: ${input.registerMeta ? JSON.stringify({
  type: input.registerMeta.type,
  extension: input.registerMeta.extension,
  sheetSelectionMode: input.registerMeta.sheetSelectionMode,
  sheets: input.registerMeta.sheets
}) : '(none)'}
Benchmark strategy: ${_truncateText(input.adminSettings?.benchmarkStrategy || 'Prefer GCC and UAE references where possible, then use best global data with clear explanation.', 180)}
Admin context summary: ${compactAdminSummary || '(none)'}
User profile context:
${compactUserProfile}
Organisation structure context:
${compactOrgContext}
Live scoped context:
${compactLiveContext}

Risk register content:
${compactRegisterText || '(none)'}

Instructions:
- focus on risk rows, sheet names, and column headers; ignore generic instructional template text
- deduplicate overlapping risks
- produce concise risk titles suitable for selection cards
- preserve important contextual detail in the descriptions
- extract up to 8 material risks if the register supports them
- For each risk, include a "confidence" field: "high", "medium", or "low". High = directly evidenced by the uploaded rows, sheet names, headers, or retrieved documents. Medium = reasonably inferred from the register context. Low = potentially relevant but speculative given the current information.
- include workflow guidance that tells a non-risk practitioner what to do after extraction

Evidence quality context:
${_truncateText(evidenceMeta.promptBlock || '', 240)}`;
        const raw = await _callLLM(systemPrompt, userPrompt, {
          taskName: 'analyseRiskRegister',
          maxCompletionTokens: 2800,
          maxPromptChars: 9000,
          timeoutMs: 45000,
          priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : [],
          traceLabel: input.traceLabel || 'Step 1 register analysis',
          traceSources: input.citations || []
        });
        if (raw) {
          const parsed = await _parseOrRepairStructuredJson(raw, outputSchema, {
            taskName: 'repairAnalyseRiskRegister'
          }) || {};
          let candidateResult = _normaliseRegisterAnalysisCandidate(parsed);
          try {
            const qualityChecked = await _runStructuredQualityGate({
              taskName: 'analyseRiskRegisterQualityGate',
              schemaHint: outputSchema,
              originalContext: [
                `Business unit: ${input.businessUnit?.name || 'Unknown'}`,
                `Geography: ${input.geography || 'Unknown'}`,
                `Register metadata: ${input.registerMeta ? JSON.stringify({
                  type: input.registerMeta.type,
                  extension: input.registerMeta.extension,
                  sheetSelectionMode: input.registerMeta.sheetSelectionMode,
                  sheets: input.registerMeta.sheets
                }) : '(none)'}`,
                `Register text: ${compactRegisterText || '(none)'}`
              ].join('\n'),
              checklist: [
                'Keep the shortlist grounded in the uploaded register rows, sheet names, and column headers.',
                'Do not invent risks that are not supported by the uploaded material.',
                'Remove template or instructional noise.',
                'Keep risk titles concise and selection-card friendly.',
                'Keep the summary and workflow guidance coherent with the extracted shortlist.'
              ],
              candidatePayload: _toRegisterAnalysisQualityCandidate(candidateResult),
              traceLabel: `${input.traceLabel || 'Step 1 register analysis'} quality gate`,
              traceSources: input.citations || []
            });
            if (qualityChecked) {
              candidateResult = _normaliseRegisterAnalysisCandidate(qualityChecked);
            }
          } catch (qualityGateError) {
            await _auditAiFallback('analyseRiskRegisterQualityGate', qualityGateError);
            console.warn('analyseRiskRegister quality gate fallback:', qualityGateError.message);
          }
          return _decorateAiResult(_withEvidenceMeta(candidateResult, evidenceMeta), evidenceMeta, {
            contentFields: ['summary', 'linkAnalysis', 'benchmarkBasis'],
            fallbackUsed: false
          });
        }
        fallbackReason = _classifyAiFallbackReason();
      } catch (e) {
        await _auditAiFallback('analyseRiskRegister', e);
        console.warn('analyseRiskRegister fallback:', e.message);
        const normalisedError = _normaliseLLMError(e);
        if (_isStructuredResponseFailure(normalisedError) || _isStructuredResponseFailure(e)) {
          fallbackReason = _classifyAiFallbackReason(normalisedError);
        } else {
          throw Object.assign(new Error(normalisedError?.message || e?.message || 'AI request failed'), {
            code: 'LLM_UNAVAILABLE',
            retriable: true,
            originalError: e
          });
        }
      }
    }
    const stub = _generateRiskBuilderStub({ ...input, riskStatement: lines.slice(0, 4).join('. ') });
    if (lines.length) {
      stub.risks = lines.slice(0, 15).map((line, idx) => ({
        id: `register-risk-${idx + 1}`,
        title: line.replace(/^[-*]\s*/, ''),
        category: 'Register',
        description: 'Imported from uploaded risk register.',
        source: 'register',
        regulations: stub.regulations.slice(0, 3)
      }));
      stub.summary = `Analysed ${lines.length} register entr${lines.length === 1 ? 'y' : 'ies'} and extracted ${stub.risks.length} candidate risks.`;
      stub.workflowGuidance = [
        'Keep the risks that materially change loss, disruption, regulation, or third-party exposure.',
        'Use linked mode when the selected risks could arise from the same underlying event or control failure.',
        'Ask AI assist to translate the selected scope into FAIR inputs with GCC-first benchmark logic.'
      ];
    }
    const decoratedFallback = _decorateAiResult(_withEvidenceMeta({
      ...stub,
      fallbackReasonCode: fallbackReason?.code || 'local_register_fallback',
      fallbackReasonTitle: fallbackReason?.title || 'Fallback register analysis loaded',
      fallbackReasonMessage: fallbackReason?.message || 'The platform used local extraction instead of live AI analysis for this upload.',
      fallbackReasonDetail: fallbackReason?.detail || ''
    }, evidenceMeta), evidenceMeta, {
      contentFields: ['summary', 'linkAnalysis', 'benchmarkBasis'],
      fallbackUsed: true
    });
    return aiUnavailable ? { ...decoratedFallback, aiUnavailable: true } : decoratedFallback;
  }

  async function buildCompanyContext(websiteUrl) {
    const endpoint = _getCompanyContextUrl();
    if (!endpoint) {
      const fallback = _decorateAiResult({
        companySummary: 'Suggested draft: Company context could not be built from a live service in this session. Use the website and your source material to keep drafting safely.',
        businessProfile: 'Suggested draft: Review the company website, operating model, and uploaded material to complete this profile.',
        operatingModel: 'Suggested draft: Add the main operating model, critical services, and control dependencies here.',
        publicCommitments: [],
        riskSignals: [],
        likelyObligations: [],
        regulatorySignals: [],
        aiGuidance: 'Suggested draft: Keep outputs concise, grounded in uploaded material, and clearly marked as working draft content.',
        suggestedGeography: '',
        sources: [],
        responseMessage: 'Suggested draft: A live company-context service was unavailable, so the current content was kept as a working draft.'
      }, { summary: 'Evidence used: website URL only.' }, {
        contentFields: ['companySummary', 'businessProfile', 'operatingModel', 'aiGuidance', 'responseMessage'],
        fallbackUsed: true
      });
      await _auditAiEvent('ai_fallback_used', 'success', { taskName: 'buildCompanyContext', reason: 'proxy_unavailable' });
      return { ...fallback, aiUnavailable: true };
    }
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      const sessionToken = _getSessionToken();
      if (sessionToken) {
        headers['x-session-token'] = sessionToken;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ websiteUrl: _sanitizeAiText(websiteUrl, { maxChars: 240 }) })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw _normaliseLLMError(new Error(`LLM API error ${res.status}: ${errText}`));
      }
      const data = await res.json();
      if (data?.error) {
        throw new Error(data.error);
      }
      return _decorateAiResult(data, { summary: 'Evidence used: public website and retrieved public sources.' }, {
        contentFields: ['companySummary', 'businessProfile', 'operatingModel', 'aiGuidance', 'responseMessage'],
        fallbackUsed: false
      });
    } catch (error) {
      await _auditAiFallback('buildCompanyContext', error, { websiteUrl: _sanitizeAiText(websiteUrl, { maxChars: 120 }) });
      const normalisedError = _normaliseLLMError(error);
      throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
        code: 'LLM_UNAVAILABLE',
        retriable: true,
        originalError: error
      });
    }
  }


  function _buildEntityContextStub(input = {}) {
    const entityName = String(input.entity?.name || 'This entity').trim();
    const entityType = String(input.entity?.type || 'business unit').trim();
    const departmentRelationshipType = String(input.entity?.departmentRelationshipType || '').trim();
    const parentName = String(input.parentEntity?.name || 'the parent business unit').trim();
    const parentProfile = String(input.parentLayer?.contextSummary || input.parentEntity?.profile || '').trim();
    const remit = String(input.entity?.profile || input.entity?.departmentHint || '').trim();
    const geography = String(input.adminSettings?.geography || input.parentLayer?.geography || '').trim();
    const regulations = Array.from(new Set([
      ...(input.parentLayer?.applicableRegulations || []),
      ...(input.adminSettings?.applicableRegulations || [])
    ].map(String).filter(Boolean)));
    const relationshipText = departmentRelationshipType ? `${departmentRelationshipType.toLowerCase()} function within ${parentName}` : `${entityType.toLowerCase()} within ${parentName}`;
    const shortParentContext = parentProfile.split(/(?<=[.!?])\s+/).slice(0, 1).join(' ').trim();
    const remitSource = remit || `supporting ${parentName} through ${entityName.toLowerCase()} responsibilities`;
    const isDepartment = String(input.entity?.type || '').toLowerCase() === 'department / function';
    return {
      geography,
      contextSummary: isDepartment
        ? `${entityName} is an ${relationshipText}. It is responsible for ${remitSource}. Keep the summary focused on the team's core remit, dependencies, decision rights, and control responsibilities in support of ${parentName}${shortParentContext ? `, which currently operates in this context: ${shortParentContext}` : ''}.`
        : `${entityName} sits within ${parentName}. Capture the core remit, dependencies, operating model, and control responsibilities relevant to this entity${shortParentContext ? `, drawing on this parent context: ${shortParentContext}` : ''}.`,
      riskAppetiteStatement: `Keep ${entityName} aligned to ${parentName}'s risk appetite, but escalate issues that could materially disrupt critical services, weaken control assurance, or create regulatory exposure for the wider business unit.`,
      applicableRegulations: regulations,
      aiInstructions: isDepartment
        ? `Tailor outputs for ${entityName} as a ${relationshipText}. Keep summaries brief, functional, and role-specific. Do not restate the full group profile. Focus on actual responsibilities, dependencies, controls, and key interfaces with ${parentName}.`
        : `Tailor outputs for ${entityName} within ${parentName}. Avoid generic filler and emphasise operational responsibilities, dependencies, and control ownership.`,
      benchmarkStrategy: String(input.parentLayer?.benchmarkStrategy || input.adminSettings?.benchmarkStrategy || '').trim()
    };
  }

  async function buildEntityContext(input = {}) {
    const stub = _buildEntityContextStub(input);
    const isDepartment = String(input.entity?.type || '').toLowerCase() === 'department / function';
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) {
      return {
        ...stub,
        aiUnavailable: true
      };
    }
    try {
      const systemPrompt = `You are a senior enterprise risk and operating-context analyst. Return JSON only with this schema:
{
  "geography": "string",
  "contextSummary": "string",
  "riskAppetiteStatement": "string",
  "applicableRegulations": ["string"],
  "aiInstructions": "string",
  "benchmarkStrategy": "string"
}`;
      const evidenceMeta = _buildEvidenceMeta({ citations: [], businessUnit: input.parentEntity, geography: input.adminSettings?.geography || input.parentLayer?.geography, applicableRegulations: input.parentLayer?.applicableRegulations || input.adminSettings?.applicableRegulations, organisationContext: input.parentLayer?.contextSummary || input.parentEntity?.profile, adminSettings: input.adminSettings, uploadedText: input.uploadedText });
      const userPrompt = `Build retained context for this organisation node.

Entity:
${JSON.stringify(input.entity || {}, null, 2)}

Parent entity:
${JSON.stringify(input.parentEntity || {}, null, 2)}

Existing layer:
${JSON.stringify(input.existingLayer || {}, null, 2)}

Parent layer:
${JSON.stringify(input.parentLayer || {}, null, 2)}

Global admin settings:
${JSON.stringify({
        geography: input.adminSettings?.geography || '',
        applicableRegulations: input.adminSettings?.applicableRegulations || [],
        aiInstructions: input.adminSettings?.aiInstructions || '',
        benchmarkStrategy: input.adminSettings?.benchmarkStrategy || '',
        riskAppetiteStatement: input.adminSettings?.riskAppetiteStatement || ''
      }, null, 2)}

${_buildUploadedDocumentBlock(input)}

Instructions:
- derive the context from the entity metadata, any existing remit text, and the parent business unit context
- if the entity is a department or function, inherit business-unit context and specialise it for the function
- for departments and functions, keep the context summary to 2-4 sentences max
- do not restate the full parent or group profile; only carry forward what is directly relevant to the function remit
- avoid generic corporate language and avoid inventing unsupported facts
- keep the context practical for future risk assessments and AI assistance
- include relevant regulations only when supported by the inherited context or the admin baseline

Evidence quality context:
${evidenceMeta.promptBlock}`;
      const raw = await _callLLM(systemPrompt, userPrompt, { maxCompletionTokens: 700, timeoutMs: 15000, taskName: 'buildEntityContext' });
      if (!raw) return _decorateAiResult(_withEvidenceMeta(stub, evidenceMeta), evidenceMeta, { contentFields: ['contextSummary', 'riskAppetiteStatement', 'aiInstructions', 'benchmarkStrategy'], fallbackUsed: true, uploadedDocumentName: input.uploadedDocumentName });
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw));
      return _decorateAiResult(_withEvidenceMeta({
        geography: String(parsed.geography || stub.geography || '').trim(),
        contextSummary: _cleanUserFacingText(parsed.contextSummary || stub.contextSummary || '', { maxSentences: isDepartment ? 4 : 5 }),
        riskAppetiteStatement: _cleanUserFacingText(parsed.riskAppetiteStatement || stub.riskAppetiteStatement || '', { maxSentences: 2 }),
        applicableRegulations: Array.isArray(parsed.applicableRegulations) ? parsed.applicableRegulations.map(String).filter(Boolean) : stub.applicableRegulations,
        aiInstructions: _cleanUserFacingText(parsed.aiInstructions || stub.aiInstructions || '', { maxSentences: 3 }),
        benchmarkStrategy: _cleanUserFacingText(parsed.benchmarkStrategy || stub.benchmarkStrategy || '', { maxSentences: 2 })
      }, evidenceMeta), evidenceMeta, { contentFields: ['contextSummary', 'riskAppetiteStatement', 'aiInstructions', 'benchmarkStrategy'], fallbackUsed: false, uploadedDocumentName: input.uploadedDocumentName });
    } catch (error) {
      await _auditAiFallback('buildEntityContext', error, { entityName: String(input.entity?.name || '').trim() });
      console.warn('buildEntityContext fallback:', error.message);
      const normalisedError = _normaliseLLMError(error);
      throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
        code: 'LLM_UNAVAILABLE',
        retriable: true,
        originalError: error
      });
    }
  }

  function _buildUserPreferenceAssistStub(input = {}) {
    const role = String(input.userProfile?.jobTitle || 'team member').trim();
    const businessUnit = String(input.userProfile?.businessUnit || 'the business unit').trim();
    const department = String(input.userProfile?.department || 'the current function').trim();
    const uploadedContext = String(input.uploadedText || '').trim();
    const sourceHint = uploadedContext ? 'uploaded notes and source material' : 'the current profile and organisation context';
    return {
      workingContext: `${role} supporting ${department} in ${businessUnit}. Prioritise practical analysis tied to current responsibilities, dependencies, decision-making needs, and any regulated or business-critical services referenced in ${sourceHint}.`,
      preferredOutputs: `Give concise, decision-ready outputs for a ${role}. Lead with the main risk signal, explain why it matters to ${department}, and end with clear actions, owners, and escalation points where needed.`,
      aiInstructions: `Tailor outputs for a ${role} in ${department}, ${businessUnit}. Use the organisation context and any uploaded material, avoid generic filler, and keep recommendations practical, structured, and usable by the team.`,
      adminContextSummary: `Personal working context for ${role} in ${department}, ${businessUnit}. Focus on responsibilities, dependencies, stakeholder communication, and operational or regulatory impacts most relevant to this user.`
    };
  }

  async function refineEntityContext(input = {}) {
    const currentContext = {
      geography: String(input.currentContext?.geography || '').trim(),
      contextSummary: String(input.currentContext?.contextSummary || '').trim(),
      riskAppetiteStatement: String(input.currentContext?.riskAppetiteStatement || '').trim(),
      applicableRegulations: Array.isArray(input.currentContext?.applicableRegulations) ? input.currentContext.applicableRegulations.map(String).filter(Boolean) : [],
      aiInstructions: String(input.currentContext?.aiInstructions || '').trim(),
      benchmarkStrategy: String(input.currentContext?.benchmarkStrategy || '').trim()
    };
    const fallbackMessage = 'I refined the context using your latest instruction. Review the updated summary, appetite, regulations, and guidance before saving.';
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) {
      return {
        ...currentContext,
        aiUnavailable: true,
        responseMessage: fallbackMessage,
        confidenceLabel: 'Local fallback',
        evidenceQuality: 'No live model',
        evidenceSummary: 'A live AI model was not available, so the current context was kept as the working draft.',
        missingInformation: ['Connect a live AI model if you want iterative refinement from follow-up prompts.']
      };
    }
    try {
      const systemPrompt = `You are a senior enterprise risk and operating-context analyst. Refine an existing BU or function context based on user follow-up prompts. Return JSON only with this schema:
{
  "geography": "string",
  "contextSummary": "string",
  "riskAppetiteStatement": "string",
  "applicableRegulations": ["string"],
  "aiInstructions": "string",
  "benchmarkStrategy": "string",
  "responseMessage": "string"
}`;
      const evidenceMeta = _buildEvidenceMeta({
        citations: [],
        businessUnit: input.parentEntity,
        geography: currentContext.geography || input.adminSettings?.geography || input.parentLayer?.geography,
        applicableRegulations: currentContext.applicableRegulations.length ? currentContext.applicableRegulations : (input.parentLayer?.applicableRegulations || input.adminSettings?.applicableRegulations),
        organisationContext: currentContext.contextSummary || input.parentLayer?.contextSummary || input.parentEntity?.profile,
        adminSettings: input.adminSettings,
        uploadedText: input.uploadedText
      });
      const userPrompt = `Refine the retained context for this organisation node based on the latest user instruction.

Entity:
${JSON.stringify(input.entity || {}, null, 2)}

Parent entity:
${JSON.stringify(input.parentEntity || {}, null, 2)}

Current retained context:
${JSON.stringify(currentContext, null, 2)}

Parent layer:
${JSON.stringify(input.parentLayer || {}, null, 2)}

${_buildUploadedDocumentBlock(input)}

Recent conversation:
${JSON.stringify(_compactHistory(input.history, 3), null, 2)}

Latest user instruction:
${String(input.userPrompt || '').trim()}

Instructions:
- update the current retained context instead of restarting from scratch
- preserve good existing detail unless the latest instruction clearly changes it
- keep the context practical for future risk assessments and AI assistance
- for departments and functions, keep the context summary concise at 2-4 sentences
- avoid generic filler and avoid inventing unsupported facts
- explain what changed in responseMessage in plain language

Evidence quality context:
${evidenceMeta.promptBlock}`;
      const raw = await _callLLM(systemPrompt, userPrompt, { maxCompletionTokens: 700, timeoutMs: 12000, taskName: 'refineEntityContext' });
      if (!raw) {
        return _decorateAiResult(_withEvidenceMeta({ ...currentContext, responseMessage: fallbackMessage }, evidenceMeta), evidenceMeta, { contentFields: ['contextSummary', 'riskAppetiteStatement', 'aiInstructions', 'benchmarkStrategy', 'responseMessage'], fallbackUsed: true, uploadedDocumentName: input.uploadedDocumentName });
      }
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw));
      const isDepartment = String(input.entity?.type || '').toLowerCase() === 'department / function';
      return _decorateAiResult(_withEvidenceMeta({
        geography: String(parsed.geography || currentContext.geography || '').trim(),
        contextSummary: _cleanUserFacingText(parsed.contextSummary || currentContext.contextSummary || '', { maxSentences: isDepartment ? 4 : 5 }),
        riskAppetiteStatement: _cleanUserFacingText(parsed.riskAppetiteStatement || currentContext.riskAppetiteStatement || '', { maxSentences: 2 }),
        applicableRegulations: Array.isArray(parsed.applicableRegulations) ? parsed.applicableRegulations.map(String).filter(Boolean) : currentContext.applicableRegulations,
        aiInstructions: _cleanUserFacingText(parsed.aiInstructions || currentContext.aiInstructions || '', { maxSentences: 3 }),
        benchmarkStrategy: _cleanUserFacingText(parsed.benchmarkStrategy || currentContext.benchmarkStrategy || '', { maxSentences: 2 }),
        responseMessage: _cleanUserFacingText(parsed.responseMessage || fallbackMessage, { maxSentences: 3 })
      }, evidenceMeta), evidenceMeta, { contentFields: ['contextSummary', 'riskAppetiteStatement', 'aiInstructions', 'benchmarkStrategy', 'responseMessage'], fallbackUsed: false, uploadedDocumentName: input.uploadedDocumentName });
    } catch (error) {
      await _auditAiFallback('refineEntityContext', error, { entityName: String(input.entity?.name || '').trim() });
      console.warn('refineEntityContext fallback:', error.message);
      const normalisedError = _normaliseLLMError(error);
      throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
        code: 'LLM_UNAVAILABLE',
        retriable: true,
        originalError: error
      });
    }
  }

  async function refineCompanyContext(input = {}) {
    const currentSections = {
      companySummary: String(input.currentSections?.companySummary || '').trim(),
      businessModel: String(input.currentSections?.businessModel || '').trim(),
      operatingModel: String(input.currentSections?.operatingModel || '').trim(),
      publicCommitments: String(input.currentSections?.publicCommitments || '').trim(),
      keyRiskSignals: String(input.currentSections?.keyRiskSignals || '').trim(),
      obligations: String(input.currentSections?.obligations || '').trim(),
      sources: String(input.currentSections?.sources || '').trim()
    };
    const fallbackMessage = 'I refined the company context using your latest instruction. Review the updated sections before saving.';
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) {
      return {
        ...currentSections,
        aiUnavailable: true,
        responseMessage: fallbackMessage,
        confidenceLabel: 'Local fallback',
        evidenceQuality: 'No live model',
        evidenceSummary: 'A live AI model was not available, so the current company context was kept as the working draft.',
        missingInformation: ['Connect a live AI model if you want iterative refinement from follow-up prompts.'],
        regulatorySignals: input.currentRegulations || [],
        aiGuidance: input.currentAiGuidance || '',
        suggestedGeography: input.currentGeography || ''
      };
    }
    try {
      const systemPrompt = `You are a senior enterprise risk and company-context analyst. Refine an existing company context based on user follow-up prompts. Return JSON only with this schema:
{
  "companySummary": "string",
  "businessModel": "string",
  "operatingModel": "string",
  "publicCommitments": "string",
  "keyRiskSignals": "string",
  "obligations": "string",
  "sources": "string",
  "aiGuidance": "string",
  "suggestedGeography": "string",
  "regulatorySignals": ["string"],
  "responseMessage": "string"
}`;
      const evidenceMeta = _buildEvidenceMeta({
        citations: [],
        geography: input.currentGeography,
        applicableRegulations: input.currentRegulations,
        organisationContext: currentSections,
        adminSettings: { aiInstructions: input.currentAiGuidance || '' },
        uploadedText: input.uploadedText
      });
      const userPrompt = `Refine the current company context based on the latest instruction.

Website URL:
${String(input.websiteUrl || '').trim()}

Current context sections:
${JSON.stringify(currentSections, null, 2)}

Current AI guidance:
${String(input.currentAiGuidance || '').trim()}

Current geography:
${String(input.currentGeography || '').trim()}

Current regulation tags:
${JSON.stringify(Array.isArray(input.currentRegulations) ? input.currentRegulations : [], null, 2)}

${_buildUploadedDocumentBlock(input)}

Recent conversation:
${JSON.stringify(_compactHistory(input.history, 3), null, 2)}

Latest user instruction:
${String(input.userPrompt || '').trim()}

Instructions:
- refine the current sections instead of starting over
- preserve good existing detail unless the latest prompt clearly changes it
- keep the output grounded, specific, and useful for future risk assessments
- avoid generic filler and avoid inventing unsupported facts
- explain what changed in responseMessage in plain language

Evidence quality context:
${evidenceMeta.promptBlock}`;
      const raw = await _callLLM(systemPrompt, userPrompt, { maxCompletionTokens: 800, timeoutMs: 12000, taskName: 'refineCompanyContext' });
      if (!raw) {
        return _decorateAiResult(_withEvidenceMeta({
          ...currentSections,
          aiGuidance: String(input.currentAiGuidance || '').trim(),
          suggestedGeography: String(input.currentGeography || '').trim(),
          regulatorySignals: Array.isArray(input.currentRegulations) ? input.currentRegulations : [],
          responseMessage: fallbackMessage
        }, evidenceMeta), evidenceMeta, { contentFields: ['companySummary', 'businessModel', 'operatingModel', 'publicCommitments', 'keyRiskSignals', 'obligations', 'sources', 'aiGuidance', 'responseMessage'], fallbackUsed: true, uploadedDocumentName: input.uploadedDocumentName });
      }
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw));
      return _decorateAiResult(_withEvidenceMeta({
        companySummary: _cleanUserFacingText(parsed.companySummary || currentSections.companySummary || '', { maxSentences: 4 }),
        businessModel: _cleanUserFacingText(parsed.businessModel || currentSections.businessModel || '', { maxSentences: 4 }),
        operatingModel: _cleanUserFacingText(parsed.operatingModel || currentSections.operatingModel || '', { maxSentences: 4 }),
        publicCommitments: _cleanUserFacingText(parsed.publicCommitments || currentSections.publicCommitments || '', { maxSentences: 5 }),
        keyRiskSignals: _cleanUserFacingText(parsed.keyRiskSignals || currentSections.keyRiskSignals || '', { maxSentences: 5 }),
        obligations: _cleanUserFacingText(parsed.obligations || currentSections.obligations || '', { maxSentences: 5 }),
        sources: _cleanUserFacingText(parsed.sources || currentSections.sources || '', { maxSentences: 6 }),
        aiGuidance: _cleanUserFacingText(parsed.aiGuidance || input.currentAiGuidance || '', { maxSentences: 3 }),
        suggestedGeography: String(parsed.suggestedGeography || input.currentGeography || '').trim(),
        regulatorySignals: Array.isArray(parsed.regulatorySignals) ? parsed.regulatorySignals.map(String).filter(Boolean) : (Array.isArray(input.currentRegulations) ? input.currentRegulations : []),
        responseMessage: _cleanUserFacingText(parsed.responseMessage || fallbackMessage, { maxSentences: 3 })
      }, evidenceMeta), evidenceMeta, { contentFields: ['companySummary', 'businessModel', 'operatingModel', 'publicCommitments', 'keyRiskSignals', 'obligations', 'sources', 'aiGuidance', 'responseMessage'], fallbackUsed: false, uploadedDocumentName: input.uploadedDocumentName });
    } catch (error) {
      await _auditAiFallback('refineCompanyContext', error, { websiteUrl: _sanitizeAiText(input.websiteUrl || '', { maxChars: 120 }) });
      console.warn('refineCompanyContext fallback:', error.message);
      const normalisedError = _normaliseLLMError(error);
      throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
        code: 'LLM_UNAVAILABLE',
        retriable: true,
        originalError: error
      });
    }
  }

  async function buildUserPreferenceAssist(input = {}) {
    const stub = _buildUserPreferenceAssistStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return _decorateAiResult({ ...stub, aiUnavailable: true }, _buildEvidenceMeta({ uploadedText: input.uploadedText, userProfile: input.userProfile, geography: input.organisationContext?.geography || input.currentSettings?.primaryGeography, applicableRegulations: input.currentSettings?.applicableRegulations, organisationContext: input.organisationContext, adminSettings: input.currentSettings, citations: [] }), { contentFields: ['workingContext', 'preferredOutputs', 'aiInstructions', 'adminContextSummary'], fallbackUsed: true });
    try {
      const systemPrompt = `You are a senior enterprise risk assistant helping personalise a user's working context. Return JSON only with this schema:
{
  "workingContext": "string",
  "preferredOutputs": "string",
  "aiInstructions": "string",
  "adminContextSummary": "string"
}`;
      const evidenceMeta = _buildEvidenceMeta({ uploadedText: input.uploadedText, userProfile: input.userProfile, geography: input.organisationContext?.geography || input.currentSettings?.primaryGeography, applicableRegulations: input.currentSettings?.applicableRegulations, organisationContext: input.organisationContext, adminSettings: input.currentSettings, citations: [] });
      const userPrompt = `Create concise personalised settings for this user.

User profile:
${JSON.stringify(input.userProfile || {}, null, 2)}

Organisation selection:
${JSON.stringify(input.organisationContext || {}, null, 2)}

Existing personal settings:
${JSON.stringify(input.currentSettings || {}, null, 2)}

Uploaded source text:
${_sanitizeAiText(input.uploadedText || '', { maxChars: 12000 })}

Instructions:
- use uploaded text when provided, otherwise rely on the role and organisation context
- keep each field concise and practical
- make the output specific to the user's role, BU, and department
- do not restate generic company marketing language
- workingContext should explain the user's likely operating context in 2-4 sentences
- preferredOutputs should describe how answers should be formatted for this user
- aiInstructions should be a compact set of standing instructions for future AI responses
- adminContextSummary should be a short personal context summary suitable for defaults

Evidence quality context:
${evidenceMeta.promptBlock}`;
      const raw = await _callLLM(systemPrompt, userPrompt, { maxCompletionTokens: 700, timeoutMs: 15000, taskName: 'buildUserPreferenceAssist' });
      if (!raw) return _decorateAiResult(_withEvidenceMeta(stub, evidenceMeta), evidenceMeta, { contentFields: ['workingContext', 'preferredOutputs', 'aiInstructions', 'adminContextSummary'], fallbackUsed: true });
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw));
      return _decorateAiResult(_withEvidenceMeta({
        workingContext: _cleanUserFacingText(parsed.workingContext || stub.workingContext || '', { maxSentences: 4 }),
        preferredOutputs: _cleanUserFacingText(parsed.preferredOutputs || stub.preferredOutputs || '', { maxSentences: 3 }),
        aiInstructions: _cleanUserFacingText(parsed.aiInstructions || stub.aiInstructions || '', { maxSentences: 3 }),
        adminContextSummary: _cleanUserFacingText(parsed.adminContextSummary || stub.adminContextSummary || '', { maxSentences: 3 })
      }, evidenceMeta), evidenceMeta, { contentFields: ['workingContext', 'preferredOutputs', 'aiInstructions', 'adminContextSummary'], fallbackUsed: false });
    } catch (error) {
      await _auditAiFallback('buildUserPreferenceAssist', error);
      console.warn('buildUserPreferenceAssist fallback:', error.message);
      const normalisedError = _normaliseLLMError(error);
      throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
        code: 'LLM_UNAVAILABLE',
        retriable: true,
        originalError: error
      });
    }
  }


  function _buildTreatmentImprovementStub(input = {}) {
    const request = String(input.improvementRequest || '').toLowerCase();
    const baseline = input.baselineAssessment?.fairParams || input.baselineAssessment?.results?.inputs || {};
    const next = JSON.parse(JSON.stringify(baseline || {}));
    const notes = [];
    const adjust = (key, factor, floor = null, ceil = null) => {
      const current = Number(next[key]);
      if (!Number.isFinite(current)) return;
      let value = current * factor;
      if (floor != null) value = Math.max(floor, value);
      if (ceil != null) value = Math.min(ceil, value);
      next[key] = Number(value.toFixed(2));
    };

    if (/control|mfa|access|identity|monitor|detect|response/.test(request)) {
      adjust('controlStrMin', 1.12, 0, 0.99);
      adjust('controlStrLikely', 1.15, 0, 0.99);
      adjust('controlStrMax', 1.1, 0, 0.995);
      adjust('vulnMin', 0.9, 0.01, 1);
      adjust('vulnLikely', 0.85, 0.01, 1);
      adjust('vulnMax', 0.82, 0.01, 1);
      notes.push('Control strength has been lifted to reflect stronger preventive and detective controls.');
    }
    if (/less exposure|lower exposure|reduc|contain|segmentation|hardening/.test(request)) {
      adjust('threatCapMin', 0.95, 0, 1);
      adjust('threatCapLikely', 0.92, 0, 1);
      adjust('threatCapMax', 0.9, 0, 1);
      adjust('vulnMin', 0.88, 0.01, 1);
      adjust('vulnLikely', 0.82, 0.01, 1);
      adjust('vulnMax', 0.78, 0.01, 1);
      notes.push('Exposure has been reduced to reflect better containment and lower successful attack opportunity.');
    }
    if (/less financial|lower loss|cheaper|reduce cost|lower disruption|resilience|faster recovery/.test(request)) {
      ['biMin','biLikely','biMax'].forEach((key, idx) => adjust(key, [0.75,0.7,0.68][idx], 0, null));
      ['irMin','irLikely','irMax'].forEach((key, idx) => adjust(key, [0.9,0.88,0.86][idx], 0, null));
      ['rcMin','rcLikely','rcMax'].forEach((key, idx) => adjust(key, [0.92,0.88,0.85][idx], 0, null));
      notes.push('Financial and disruption losses have been reduced to reflect faster containment, better resilience, or lower downstream harm.');
    }
    if (/less frequent|lower frequency|rarer|harder to happen|prevent/.test(request)) {
      ['tefMin','tefLikely','tefMax'].forEach((key, idx) => adjust(key, [0.85,0.78,0.72][idx], 0.1, null));
      notes.push('Event frequency has been reduced to reflect lower likelihood under the improved future state.');
    }
    if (!notes.length) {
      adjust('controlStrLikely', 1.08, 0, 0.99);
      adjust('tefLikely', 0.9, 0.1, null);
      adjust('biLikely', 0.9, 0, null);
      notes.push('The future-state case assumes moderately stronger controls, lower event success, and better operational containment.');
    }
    return {
      summary: 'The future-state case adjusts the baseline to reflect the improvement described by the user.',
      changesSummary: notes.join(' '),
      workflowGuidance: [
        'Review the adjusted values and make sure they reflect a credible future state rather than an ideal one.',
        'Focus on the one or two assumptions that would realistically improve first, then rerun the model.',
        'Use the comparison view to judge whether the improvement meaningfully changes tolerance position.'
      ],
      benchmarkBasis: 'The adjusted values represent a future-state comparison case. They should reflect plausible control or resilience improvements, not best-case assumptions.',
      inputRationale: {
        tef: 'Frequency was reduced only where the requested improvement would plausibly lower how often the scenario succeeds.',
        vulnerability: 'Exposure was reduced where stronger controls, better identity protection, or tighter containment were implied by the request.',
        lossComponents: 'Loss values were reduced where the request suggests faster recovery, lower disruption, or less downstream financial impact.'
      },
      suggestedInputs: {
        TEF: { min: next.tefMin, likely: next.tefLikely, max: next.tefMax },
        controlStrength: { min: next.controlStrMin, likely: next.controlStrLikely, max: next.controlStrMax },
        threatCapability: { min: next.threatCapMin, likely: next.threatCapLikely, max: next.threatCapMax },
        lossComponents: {
          incidentResponse: { min: next.irMin, likely: next.irLikely, max: next.irMax },
          businessInterruption: { min: next.biMin, likely: next.biLikely, max: next.biMax },
          dataBreachRemediation: { min: next.dbMin, likely: next.dbLikely, max: next.dbMax },
          regulatoryLegal: { min: next.rlMin, likely: next.rlLikely, max: next.rlMax },
          thirdPartyLiability: { min: next.tpMin, likely: next.tpLikely, max: next.tpMax },
          reputationContract: { min: next.rcMin, likely: next.rcLikely, max: next.rcMax }
        }
      },
      citations: input.citations || []
    };
  }

  async function suggestTreatmentImprovement(input = {}) {
    const aiUnavailable = isUsingStub();
    const stub = _buildTreatmentImprovementStub(input);
    if (aiUnavailable) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
    }
    if (_compassApiKey || !_isDirectCompassUrl(_compassApiUrl)) {
      try {
        const systemPrompt = `You are a senior FAIR analyst helping a user model an improved future state. Return JSON only with this schema:
{
  "summary": "string",
  "changesSummary": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "inputRationale": {
    "tef": "string",
    "vulnerability": "string",
    "lossComponents": "string"
  },
  "suggestedInputs": {
    "TEF": { "min": number, "likely": number, "max": number },
    "controlStrength": { "min": number, "likely": number, "max": number },
    "threatCapability": { "min": number, "likely": number, "max": number },
    "lossComponents": {
      "incidentResponse": { "min": number, "likely": number, "max": number },
      "businessInterruption": { "min": number, "likely": number, "max": number },
      "dataBreachRemediation": { "min": number, "likely": number, "max": number },
      "regulatoryLegal": { "min": number, "likely": number, "max": number },
      "thirdPartyLiability": { "min": number, "likely": number, "max": number },
      "reputationContract": { "min": number, "likely": number, "max": number }
    }
  }
}`;
        const evidenceMeta = _buildEvidenceMeta({ citations: input.citations || [], businessUnit: input.businessUnit, geography: input.baselineAssessment?.geography || input.businessUnit?.geography, applicableRegulations: input.baselineAssessment?.applicableRegulations, organisationContext: input.baselineAssessment?.narrative, uploadedText: input.improvementRequest, adminSettings: input.adminSettings, userProfile: input.adminSettings?.userProfileSummary });
        const userPrompt = `Baseline scenario title: ${input.baselineAssessment?.scenarioTitle || 'Untitled scenario'}
Baseline narrative: ${input.baselineAssessment?.enhancedNarrative || input.baselineAssessment?.narrative || ''}
Business unit: ${input.businessUnit?.name || 'Unknown'}
Geography: ${input.baselineAssessment?.geography || input.businessUnit?.geography || 'Unknown'}
User improvement request: ${input.improvementRequest || '(none)'}
Current FAIR inputs:
${JSON.stringify(input.baselineAssessment?.fairParams || input.baselineAssessment?.results?.inputs || {}, null, 2)}
Relevant citations:
${_buildCitationPromptBlock(input.citations || [])}
Live scoped context:
${_buildContextPromptBlock(input.adminSettings, input.businessUnit)}
Instructions:
- treat this as a future-state comparison case, not a rewrite of the original scenario
- adjust only the FAIR inputs that are plausibly improved by the user's request
- keep changes credible and proportionate
- explain what you changed in plain language
- prefer stronger controls, lower event frequency, lower vulnerability, or lower loss only when justified by the user's request

Evidence quality context:
${evidenceMeta.promptBlock}`;
        const raw = await _callLLM(systemPrompt, userPrompt, {
          taskName: 'suggestTreatmentImprovement',
          priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
        });
        if (raw) {
          const parsed = JSON.parse(_extractJsonFromLlmResponse(raw));
          const ensureRange = (value, fallbackRange) => ({
            min: value?.min ?? fallbackRange?.min ?? 0,
            likely: value?.likely ?? fallbackRange?.likely ?? 0,
            max: value?.max ?? fallbackRange?.max ?? 0,
          });
          return _decorateAiResult(_withEvidenceMeta({
            summary: _cleanUserFacingText(parsed.summary || stub.summary || '', { maxSentences: 2 }),
            changesSummary: _cleanUserFacingText(parsed.changesSummary || stub.changesSummary || '', { maxSentences: 3 }),
            workflowGuidance: _normaliseGuidance(parsed.workflowGuidance?.length ? parsed.workflowGuidance : stub.workflowGuidance),
            benchmarkBasis: _normaliseBenchmarkBasis(parsed.benchmarkBasis || stub.benchmarkBasis || ''),
            inputRationale: _normaliseInputRationale({ ...stub.inputRationale, ...(parsed.inputRationale || {}) }),
            suggestedInputs: {
              TEF: ensureRange(parsed?.suggestedInputs?.TEF, stub.suggestedInputs.TEF),
              controlStrength: ensureRange(parsed?.suggestedInputs?.controlStrength, stub.suggestedInputs.controlStrength),
              threatCapability: ensureRange(parsed?.suggestedInputs?.threatCapability, stub.suggestedInputs.threatCapability),
              lossComponents: {
                incidentResponse: ensureRange(parsed?.suggestedInputs?.lossComponents?.incidentResponse, stub.suggestedInputs.lossComponents.incidentResponse),
                businessInterruption: ensureRange(parsed?.suggestedInputs?.lossComponents?.businessInterruption, stub.suggestedInputs.lossComponents.businessInterruption),
                dataBreachRemediation: ensureRange(parsed?.suggestedInputs?.lossComponents?.dataBreachRemediation, stub.suggestedInputs.lossComponents.dataBreachRemediation),
                regulatoryLegal: ensureRange(parsed?.suggestedInputs?.lossComponents?.regulatoryLegal, stub.suggestedInputs.lossComponents.regulatoryLegal),
                thirdPartyLiability: ensureRange(parsed?.suggestedInputs?.lossComponents?.thirdPartyLiability, stub.suggestedInputs.lossComponents.thirdPartyLiability),
                reputationContract: ensureRange(parsed?.suggestedInputs?.lossComponents?.reputationContract, stub.suggestedInputs.lossComponents.reputationContract)
              }
            },
            citations: input.citations || []
          }, evidenceMeta), evidenceMeta, {
            contentFields: ['summary', 'changesSummary', 'benchmarkBasis'],
            fallbackUsed: false
          });
        }
      } catch (error) {
        await _auditAiFallback('suggestTreatmentImprovement', error);
        console.warn('suggestTreatmentImprovement fallback:', error.message);
        const normalisedError = _normaliseLLMError(error);
        throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
          code: 'LLM_UNAVAILABLE',
          retriable: true,
          originalError: error
        });
      }
    }
    const fallbackMeta = _buildEvidenceMeta({ citations: input.citations || [], businessUnit: input.businessUnit, geography: input.baselineAssessment?.geography || input.businessUnit?.geography, applicableRegulations: input.baselineAssessment?.applicableRegulations, organisationContext: input.baselineAssessment?.narrative, uploadedText: input.improvementRequest, adminSettings: input.adminSettings, userProfile: input.adminSettings?.userProfileSummary });
    const decoratedFallback = _decorateAiResult(_withEvidenceMeta(stub, fallbackMeta), fallbackMeta, {
      contentFields: ['summary', 'changesSummary', 'benchmarkBasis'],
      fallbackUsed: true
    });
    return aiUnavailable ? { ...decoratedFallback, aiUnavailable: true } : decoratedFallback;
  }

  function _buildAssessmentChallengeStub(input = {}) {
    const confidence = input.confidence || {};
    const assumptions = Array.isArray(input.assumptions) ? input.assumptions : [];
    const drivers = input.drivers || { upward: [], stabilisers: [] };
    const weakestAssumptions = assumptions.slice(0, 3).map(item => `${item.category}: ${item.text}`);
    const committeeQuestions = [];
    if (drivers.upward?.[0]) committeeQuestions.push(`What evidence supports the conclusion that ${drivers.upward[0].charAt(0).toLowerCase()}${drivers.upward[0].slice(1)}`);
    if (confidence.label === 'Low confidence') committeeQuestions.push('Which ranges are still too uncertain for strong decision-making and why are they still broad?');
    if ((input.missingInformation || []).length) committeeQuestions.push(`What missing evidence would change the assessment most: ${(input.missingInformation || []).slice(0, 2).join(' and ')}?`);
    if (!committeeQuestions.length) committeeQuestions.push('Which one or two assumptions would most change the tolerance position if they proved wrong?');
    const evidenceToGather = [];
    if ((input.missingInformation || []).length) evidenceToGather.push(...input.missingInformation.slice(0, 3));
    if (!evidenceToGather.length) {
      evidenceToGather.push('Internal incident history or loss data for similar scenarios.');
      evidenceToGather.push('Control evidence showing how consistently the key controls operate in practice.');
      evidenceToGather.push('Finance or operational data to validate the biggest cost assumptions.');
    }
    const challengeLevel = confidence.label === 'Low confidence' ? 'High challenge needed' : confidence.label === 'High confidence' ? 'Moderate challenge still warranted' : 'Targeted challenge recommended';
    return {
      summary: confidence.label === 'Low confidence'
        ? 'The assessment is directionally useful, but a risk committee should challenge the broadest assumptions before relying on it for strong decisions.'
        : 'The assessment is decision-useful, but a risk committee should still test the assumptions that are driving the result most.' ,
      challengeLevel,
      weakestAssumptions,
      committeeQuestions,
      evidenceToGather,
      reviewerGuidance: [
        'Focus first on the assumptions most likely to move the tolerance position.',
        'Challenge whether the cost and frequency assumptions are supported by internal evidence rather than only judgement.',
        'Confirm that the selected regulatory and business scope still matches the scenario being discussed.'
      ]
    };
  }

  async function challengeAssessment(input = {}) {
    const hasExecutiveChallengeShape = !!(input && (
      Object.prototype.hasOwnProperty.call(input, 'results') ||
      Object.prototype.hasOwnProperty.call(input, 'fairParams') ||
      Object.prototype.hasOwnProperty.call(input, 'assessmentIntelligence')
    ));
    if (hasExecutiveChallengeShape) {
      if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
      const p90 = Number(input?.results?.eventLoss?.p90 || 0);
      const assumptions = Array.isArray(input?.assessmentIntelligence?.assumptions)
        ? input.assessmentIntelligence.assumptions
        : [];
      const userPrompt = [
        `Scenario: ${String(input?.narrative || '').slice(0, 600)}`,
        `P90 loss: ${p90.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
        `Key assumptions: ${assumptions.slice(0, 3).map(item => item?.text || item).filter(Boolean).join('; ')}`,
        `Control strength: ${input?.fairParams?.controlStrLikely || 'not set'}`,
        `TEF: ${input?.fairParams?.tefMin || ''}–${input?.fairParams?.tefMax || ''}/yr`
      ].join('\n');
      const systemPrompt = `You are a senior risk committee reviewer. Your job is to
challenge this assessment - not accept it. Be constructive but skeptical.
Return JSON only:
{
  "challengeSummary": "string (2-3 sentences - your overall challenge)",
  "weakestAssumption": "string (the single assumption most likely to be wrong)",
  "alternativeView": "string (1-2 sentences - a credible alternative read)",
  "confidenceVerdict": "string - 'Reasonable given evidence' | 'Likely overstated' | 'Likely understated'",
  "oneQuestion": "string - the one question you would ask before accepting this"
}`;
      try {
        const raw = await _callLLM(systemPrompt, userPrompt, {
          maxCompletionTokens: 400,
          timeoutMs: 20000
        });
        if (!raw) return null;
        const parsed = JSON.parse(_extractJsonFromLlmResponse(raw) || 'null');
        if (!parsed || typeof parsed !== 'object') return null;
        return {
          challengeSummary: _cleanUserFacingText(parsed.challengeSummary || '', { maxSentences: 3 }),
          weakestAssumption: _cleanUserFacingText(parsed.weakestAssumption || '', { maxSentences: 1 }),
          alternativeView: _cleanUserFacingText(parsed.alternativeView || '', { maxSentences: 2 }),
          confidenceVerdict: _cleanUserFacingText(parsed.confidenceVerdict || '', { maxSentences: 1 }),
          oneQuestion: _cleanUserFacingText(parsed.oneQuestion || '', { maxSentences: 1 })
        };
      } catch {
        return null;
      }
    }
    const aiUnavailable = isUsingStub();
    const stub = _buildAssessmentChallengeStub(input);
    if (aiUnavailable) {
      await new Promise(r => setTimeout(r, 700 + Math.random() * 300));
    }
    const evidenceMeta = _buildEvidenceMeta({
      citations: input.citations || [],
      businessUnit: input.businessUnit,
      geography: input.geography,
      applicableRegulations: input.applicableRegulations,
      organisationContext: input.narrative,
      uploadedText: (Array.isArray(input.assumptions) ? input.assumptions.map(item => item.text).join('\n') : ''),
      adminSettings: input.adminSettings,
      userProfile: input.adminSettings?.userProfileSummary
    });
    if (_compassApiKey || !_isDirectCompassUrl(_compassApiUrl)) {
      try {
        const systemPrompt = `You are a senior risk committee reviewer. Return JSON only with this schema:
{
  "summary": "string",
  "challengeLevel": "string",
  "weakestAssumptions": ["string"],
  "committeeQuestions": ["string"],
  "evidenceToGather": ["string"],
  "reviewerGuidance": ["string"]
}`;
        const userPrompt = `Assessment title: ${input.scenarioTitle || 'Untitled assessment'}
Business unit: ${input.businessUnit?.name || input.businessUnitName || 'Unknown'}
Geography: ${input.geography || 'Unknown'}
Scenario narrative: ${input.narrative || ''}
Confidence summary: ${input.confidence?.summary || ''}
Confidence label: ${input.confidence?.label || ''}
Main upward drivers:
${(input.drivers?.upward || []).map(item => `- ${item}`).join('\n')}
Main stabilisers:
${(input.drivers?.stabilisers || []).map(item => `- ${item}`).join('\n')}
Assumptions:
${(input.assumptions || []).map(item => `- ${item.category}: ${item.text}`).join('\n')}
Missing information:
${(input.missingInformation || []).map(item => `- ${item}`).join('\n')}
Relevant citations:
${_buildCitationPromptBlock(input.citations || [])}
Live scoped context:
${_buildContextPromptBlock(input.adminSettings, input.businessUnit)}
Instructions:
- act like a risk committee or challenge session reviewer
- do not restate the full scenario
- identify the assumptions most worth challenging
- propose the questions a committee would ask
- suggest the evidence that would most improve confidence
- keep the tone practical, concise, and decision-oriented

Evidence quality context:
${evidenceMeta.promptBlock}`;
        const raw = await _callLLM(systemPrompt, userPrompt, { taskName: 'challengeAssessment' });
        if (raw) {
          const parsed = JSON.parse(_extractJsonFromLlmResponse(raw));
          return _decorateAiResult(_withEvidenceMeta({
            summary: _cleanUserFacingText(parsed.summary || stub.summary || '', { maxSentences: 3 }),
            challengeLevel: _cleanUserFacingText(parsed.challengeLevel || stub.challengeLevel || '', { maxSentences: 1 }),
            weakestAssumptions: (Array.isArray(parsed.weakestAssumptions) ? parsed.weakestAssumptions : stub.weakestAssumptions).slice(0, 4).map(item => _cleanUserFacingText(item || '', { maxSentences: 1 })),
            committeeQuestions: (Array.isArray(parsed.committeeQuestions) ? parsed.committeeQuestions : stub.committeeQuestions).slice(0, 4).map(item => _cleanUserFacingText(item || '', { maxSentences: 1 })),
            evidenceToGather: (Array.isArray(parsed.evidenceToGather) ? parsed.evidenceToGather : stub.evidenceToGather).slice(0, 4).map(item => _cleanUserFacingText(item || '', { maxSentences: 1 })),
            reviewerGuidance: _normaliseGuidance(Array.isArray(parsed.reviewerGuidance) && parsed.reviewerGuidance.length ? parsed.reviewerGuidance : stub.reviewerGuidance)
          }, evidenceMeta), evidenceMeta, {
            contentFields: ['summary', 'challengeLevel'],
            fallbackUsed: false
          });
        }
      } catch (error) {
        await _auditAiFallback('challengeAssessment', error);
        console.warn('challengeAssessment fallback:', error.message);
        const normalisedError = _normaliseLLMError(error);
        throw Object.assign(new Error(normalisedError?.message || error?.message || 'AI request failed'), {
          code: 'LLM_UNAVAILABLE',
          retriable: true,
          originalError: error
        });
      }
    }
    const decoratedFallback = _decorateAiResult(_withEvidenceMeta(stub, evidenceMeta), evidenceMeta, {
      contentFields: ['summary', 'challengeLevel'],
      fallbackUsed: true
    });
    return aiUnavailable ? { ...decoratedFallback, aiUnavailable: true } : decoratedFallback;
  }

  async function generateReviewerDecisionBrief(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const assessmentData = String(input?.assessmentData || '').trim().slice(0, 2400);
    if (!assessmentData) return null;
    const preferredSection = String(input?.preferredSection || '').trim().toLowerCase();
    const preferredPrompt = preferredSection
      ? `The reviewer usually spends the most time on the ${preferredSection.replace(/-/g, ' ')} section, so make that section especially concrete and decision-useful.`
      : '';
    const systemPrompt = `You are a risk reviewer at a large technology company. You have 30 seconds to decide whether to approve, challenge, or escalate this assessment. Generate a structured brief with exactly three sections:
WHAT MATTERS: [1 sentence - the headline risk and magnitude]
WHAT'S UNCERTAIN: [1 sentence - the weakest assumption]
WHAT TO DO: [1 sentence - approve / challenge parameter X / escalate]

Return JSON only with this schema:
{
  "whatMatters": "string",
  "whatsUncertain": "string",
  "whatToDo": "string"
}`;
    const userPrompt = `${preferredPrompt ? `${preferredPrompt}\n\n` : ''}Assessment data:\n${assessmentData}`;
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateReviewerDecisionBrief',
        maxCompletionTokens: 220,
        timeoutMs: 12000
      });
      if (!raw) return null;
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        whatMatters: _cleanUserFacingText(parsed.whatMatters || '', { maxSentences: 1 }),
        whatsUncertain: _cleanUserFacingText(parsed.whatsUncertain || '', { maxSentences: 1 }),
        whatToDo: _cleanUserFacingText(parsed.whatToDo || '', { maxSentences: 1 })
      };
    } catch {
      return null;
    }
  }

  function _buildPortfolioExecutiveBriefStub(input = {}) {
    const scopeLabel = String(input?.scopeLabel || 'Current portfolio').trim();
    const completedAssessments = Array.isArray(input?.completedAssessments) ? input.completedAssessments : [];
    const topAssessments = (Array.isArray(input?.topAssessments) ? input.topAssessments : [])
      .filter(item => item && typeof item === 'object')
      .slice(0, 3);
    const flaggedAssessments = Array.isArray(input?.flaggedAssessments) ? input.flaggedAssessments : [];
    const flaggedCount = flaggedAssessments.length;
    const topRisk = topAssessments[0] || completedAssessments[0] || null;
    const headline = topRisk
      ? `${scopeLabel} is currently led by ${String(topRisk.title || topRisk.name || 'the top risk').trim()} at ${String(topRisk.aleRange || 'the highest current exposure').trim()}, so the board should treat this as the anchor portfolio issue.`
      : `${scopeLabel} has active quantified risk exposure, but the board narrative should be refreshed once more completed assessments are available.`;
    const topRisks = (topAssessments.length ? topAssessments : completedAssessments.slice(0, 3))
      .filter(item => item && typeof item === 'object')
      .slice(0, 3)
      .map(item => ({
        name: _cleanUserFacingText(item?.title || item?.name || 'Portfolio risk', { maxSentences: 1, stripTrailingPeriod: true }) || 'Portfolio risk',
        description: _cleanUserFacingText(
          `${String(item?.primaryRiskCategory || 'Risk exposure').trim()} currently sits at ${String(item?.aleRange || 'an elevated loss range').trim()} and remains ${String(item?.treatmentStatus || 'under active management').trim().toLowerCase()}.`,
          { maxSentences: 1 }
        ),
        action: _cleanUserFacingText(
          /above tolerance|ready_for_review|escalat/i.test(String(item?.treatmentStatus || ''))
            ? `Confirm executive ownership and an immediate reduction plan for ${String(item?.title || item?.name || 'this risk').trim()}.`
            : `Keep ${String(item?.title || item?.name || 'this risk').trim()} on the board watchlist and verify that the current treatment stays on schedule.`,
          { maxSentences: 1 }
        )
      }));
    const portfolioHealth = flaggedCount
      ? `Overall portfolio health is elevated because ${flaggedCount} assessment${flaggedCount === 1 ? '' : 's'} already need fresh review or escalation attention.`
      : `Overall portfolio health is stable because the current visible assessment set does not show an immediate escalation backlog.`;
    const decisionNeeded = topRisk
      ? _cleanUserFacingText(
          /above tolerance|ready_for_review|escalat/i.test(String(topRisk?.treatmentStatus || ''))
            ? `Decide whether ${String(topRisk.title || topRisk.name || 'the top exposure').trim()} should be actively reduced now or escalated for formal oversight.`
            : `Decide whether the current treatment plan for ${String(topRisk.title || topRisk.name || 'the top exposure').trim()} is sufficient or needs stronger sponsorship.`,
          { maxSentences: 1 }
        )
      : 'Decide which material scenario should be prioritised next so the portfolio view remains decision-useful.';
    return {
      headline,
      topRisks,
      portfolioHealth,
      decisionNeeded
    };
  }

  async function generatePortfolioExecutiveBrief(input = {}) {
    const stub = _buildPortfolioExecutiveBriefStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return stub;
    const portfolioSummary = String(input?.portfolioSummary || '').trim().slice(0, 7000);
    if (!portfolioSummary) return stub;
    const preferredSection = String(input?.preferredSection || '').trim().toLowerCase();
    const emphasisOverride = String(input?.emphasisOverride || '').trim().toLowerCase();
    const sectionHint = emphasisOverride || preferredSection;
    const sectionPrompt = sectionHint
      ? `The reader usually focuses most on ${sectionHint.replace(/([A-Z])/g, ' $1').replace(/-/g, ' ').trim().toLowerCase()}, so make that section especially crisp and concrete.`
      : '';
    const schema = `{
  "headline": "string",
  "topRisks": [
    {
      "name": "string",
      "description": "string",
      "action": "string"
    }
  ],
  "portfolioHealth": "string",
  "decisionNeeded": "string"
}`;
    const systemPrompt = `You are the Chief Risk Officer of a technology company headquartered in Abu Dhabi with global operations and significant US regulatory exposure including AI technology export controls.

Generate a board briefing note with:
1. ONE headline sentence: the single most important risk message.
2. TOP 3 RISKS: name, one-sentence plain description, recommended action.
3. PORTFOLIO HEALTH: one sentence on overall trend (improving/stable/worsening).
4. ONE DECISION NEEDED: the single most important decision the board should make today.

Write in formal but plain English. No acronyms without explanation.
Return JSON only with this schema:
${schema}`;
    const userPrompt = `${sectionPrompt ? `${sectionPrompt}\n\n` : ''}Here is the current risk portfolio:\n${portfolioSummary}`;
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generatePortfolioExecutiveBrief',
        maxCompletionTokens: 520,
        timeoutMs: 18000
      });
      if (!raw) return null;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairPortfolioExecutiveBrief'
      });
      const topRisks = (Array.isArray(parsed?.topRisks) ? parsed.topRisks : [])
        .map((item) => ({
          name: _cleanUserFacingText(item?.name || '', { maxSentences: 1 }),
          description: _cleanUserFacingText(item?.description || '', { maxSentences: 1 }),
          action: _cleanUserFacingText(item?.action || '', { maxSentences: 1 })
        }))
        .filter(item => item.name && item.description)
        .slice(0, 3);
      return {
        headline: _cleanUserFacingText(parsed?.headline || '', { maxSentences: 1 }) || stub.headline,
        topRisks: topRisks.length ? topRisks : stub.topRisks,
        portfolioHealth: _cleanUserFacingText(parsed?.portfolioHealth || '', { maxSentences: 1 }) || stub.portfolioHealth,
        decisionNeeded: _cleanUserFacingText(parsed?.decisionNeeded || '', { maxSentences: 1 }) || stub.decisionNeeded
      };
    } catch {
      return stub;
    }
  }

  async function mediateAssessmentDispute(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const reviewerView = String(input?.reviewerView || '').trim();
    const analystView = String(input?.analystView || '').trim();
    if (!reviewerView || !analystView) return null;
    const fairParams = input?.fairParams || {};
    const assumptions = Array.isArray(input?.assessmentIntelligence?.assumptions)
      ? input.assessmentIntelligence.assumptions
      : [];
    const drivers = Array.isArray(input?.assessmentIntelligence?.drivers?.sensitivity)
      ? input.assessmentIntelligence.drivers.sensitivity
      : [];
    const citations = Array.isArray(input?.citations) ? input.citations.slice(0, 4) : [];
    const systemPrompt = `You are an AI mediation assistant for enterprise risk reviews.
Resolve focused disagreements between the analyst and the reviewer. Be constructive, specific, and concise.
Return JSON only with this schema:
{
  "reconciliationSummary": "string (2-3 sentences summarising the disagreement and proposed middle ground)",
  "proposedMiddleGround": "string (1-2 sentences with the compromise position)",
  "whyReasonable": "string (1-2 sentences explaining why the compromise is defensible)",
  "recommendedField": "string (fair parameter field name like controlStrLikely, tefLikely, biLikely, rlLikely, or empty string if no single field should change)",
  "recommendedValue": "number or null",
  "recommendedValueLabel": "string (plain-English phrasing for the proposed value or position)",
  "evidenceToVerify": "string (the single best evidence item to verify next)",
  "continueDiscussionPrompt": "string (one precise follow-up question if the disagreement is still unresolved)"
}`;
    const userPrompt = [
      `Scenario: ${String(input?.narrative || '').slice(0, 700)}`,
      `Scenario lens: ${String(input?.scenarioLens?.label || input?.scenarioLens?.key || 'general')}`,
      `Disputed focus: ${String(input?.disputedFocus || 'Overall assessment').slice(0, 120)}`,
      `Reviewer view: ${reviewerView}`,
      `Analyst view: ${analystView}`,
      `Current P90 event loss: ${Number(input?.results?.eventLoss?.p90 || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      `Current ALE mean: ${Number(input?.results?.ale?.mean || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      `Current control strength likely: ${fairParams?.controlStrLikely ?? 'not set'}`,
      `Current TEF likely: ${fairParams?.tefLikely ?? 'not set'}`,
      `Key assumptions: ${assumptions.slice(0, 3).map(item => item?.text || item).filter(Boolean).join('; ') || 'Not stated'}`,
      `Top drivers: ${drivers.slice(0, 3).map(item => `${item?.label || 'Driver'} - ${item?.why || ''}`).filter(Boolean).join('; ') || 'Not stated'}`,
      `Relevant evidence: ${citations.map(item => item?.title || item?.sourceTitle || '').filter(Boolean).join('; ') || 'No named evidence provided'}`
    ].join('\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        maxCompletionTokens: 420,
        timeoutMs: 20000
      });
      if (!raw) return null;
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      const allowedFieldPattern = /^(tef|threatCap|controlStr|vuln|ir|bi|db|rl|tp|rc)(Min|Likely|Max)$/;
      const recommendedField = allowedFieldPattern.test(String(parsed.recommendedField || '').trim())
        ? String(parsed.recommendedField || '').trim()
        : '';
      const rawValue = parsed.recommendedValue;
      const recommendedValue = rawValue == null || rawValue === ''
        ? null
        : Number(rawValue);
      return {
        reconciliationSummary: _cleanUserFacingText(parsed.reconciliationSummary || '', { maxSentences: 3 }),
        proposedMiddleGround: _cleanUserFacingText(parsed.proposedMiddleGround || '', { maxSentences: 2 }),
        whyReasonable: _cleanUserFacingText(parsed.whyReasonable || '', { maxSentences: 2 }),
        recommendedField,
        recommendedValue: Number.isFinite(recommendedValue) ? recommendedValue : null,
        recommendedValueLabel: _cleanUserFacingText(parsed.recommendedValueLabel || '', { maxSentences: 1 }),
        evidenceToVerify: _cleanUserFacingText(parsed.evidenceToVerify || '', { maxSentences: 1 }),
        continueDiscussionPrompt: _cleanUserFacingText(parsed.continueDiscussionPrompt || '', { maxSentences: 1 })
      };
    } catch {
      return null;
    }
  }

  function _buildParameterChallengeStub(input = {}) {
    const parameterLabel = String(input?.parameterLabel || 'parameter').trim();
    const currentValueLabel = String(input?.currentValueLabel || input?.currentValue || '').trim();
    const concern = String(input?.reviewerConcern || '').trim();
    const concernLower = concern.toLowerCase();
    const parameterKey = String(input?.parameterKey || '').trim();
    const numericValue = Number(input?.currentValue);
    const adjustmentDirection = /too low|understat|optimistic|higher|increase|more severe|too weak|not enough/i.test(concernLower)
      ? 'up'
      : /too high|overstat|conservative|lower|decrease|too strong/i.test(concernLower)
        ? 'down'
        : (parameterKey === 'controlStrLikely' ? 'down' : 'up');
    const questions = [
      `What direct evidence supports keeping ${parameterLabel} at ${currentValueLabel || 'the current value'}?`,
      `Which internal record, test result, or source would satisfy the reviewer if you defend this ${parameterLabel.toLowerCase()} estimate?`,
      parameterKey === 'lmLow' || parameterKey === 'lmHigh'
        ? 'Which loss component is doing most of the work in this range, and do you have finance or operations evidence for it?'
        : parameterKey === 'controlStrLikely'
          ? 'What control test, operating evidence, or recent incident data shows the current control strength is realistic?'
          : 'What evidence would make you revise this estimate instead of defending it?'
    ].filter(Boolean).slice(0, 3);
    let suggestedValue = Number.isFinite(numericValue) ? numericValue : 0;
    if (Number.isFinite(numericValue)) {
      if (parameterKey === 'controlStrLikely') {
        suggestedValue = adjustmentDirection === 'up'
          ? Math.min(0.99, numericValue + 0.08)
          : Math.max(0.01, numericValue - 0.08);
      } else if (parameterKey === 'vulnerability') {
        suggestedValue = adjustmentDirection === 'up'
          ? Math.min(0.99, numericValue + 0.08)
          : Math.max(0.01, numericValue - 0.08);
      } else {
        const factor = adjustmentDirection === 'up' ? 1.12 : 0.9;
        suggestedValue = numericValue * factor;
      }
    }
    return {
      analystQuestions: questions,
      reviewerAdjustment: {
        param: parameterKey || parameterLabel,
        suggestedValue: Number.isFinite(suggestedValue) ? Number(suggestedValue.toFixed(parameterKey === 'lmLow' || parameterKey === 'lmHigh' ? 0 : 2)) : numericValue,
        aleImpact: adjustmentDirection === 'up'
          ? 'ALE would likely move upward unless the analyst can narrow the evidence base and defend the current estimate.'
          : 'ALE would likely move downward if the reviewer concern is accepted without new evidence.',
        rationale: concern
          ? `This is the smallest directional adjustment that reflects the reviewer concern: ${concern}`
          : `This is the smallest directional adjustment that reflects a cautious reviewer challenge to ${parameterLabel.toLowerCase()}.`
      }
    };
  }

  async function generateParameterChallengeRecord(input = {}) {
    const stub = _buildParameterChallengeStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return stub;
    const parameterLabel = String(input?.parameterLabel || 'Parameter').trim();
    const currentValueLabel = String(input?.currentValueLabel || input?.currentValue || '').trim();
    const scenarioSummary = String(input?.scenarioSummary || '').trim().slice(0, 900);
    const reviewerConcern = String(input?.reviewerConcern || '').trim().slice(0, 1000);
    const allowedParams = Array.isArray(input?.allowedParams)
      ? input.allowedParams.map(item => String(item || '').trim()).filter(Boolean)
      : ['tefLikely', 'vulnerability', 'lmLow', 'lmHigh', 'controlStrLikely'];
    const currentAle = String(input?.currentAle || '').trim();
    const schema = `{
  "analystQuestions": ["string"],
  "reviewerAdjustment": {
    "param": "string",
    "suggestedValue": "number",
    "aleImpact": "string",
    "rationale": "string"
  }
}`;
    const systemPrompt = `A reviewer has challenged a key parameter in a quantified risk assessment.
Generate two outputs:
A) For the ANALYST: 1-3 specific questions they must answer to defend or revise the estimate. Be precise about what evidence would satisfy the reviewer.
B) For the REVIEWER: the minimum parameter adjustment that would reflect the concern if the analyst cannot provide new evidence. Show the impact on ALE.

Return JSON only with this schema:
${schema}

Allowed reviewerAdjustment.param values: ${allowedParams.join(', ')}`;
    const userPrompt = [
      `Parameter challenged: ${parameterLabel}`,
      `Current value: ${currentValueLabel}`,
      currentAle ? `Current ALE: ${currentAle}` : '',
      `Scenario summary: ${scenarioSummary}`,
      `Reviewer concern: ${reviewerConcern}`
    ].filter(Boolean).join('\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateParameterChallengeRecord',
        maxCompletionTokens: 500,
        timeoutMs: 16000
      });
      if (!raw) return stub;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairParameterChallengeRecord'
      });
      const analystQuestions = (Array.isArray(parsed?.analystQuestions) ? parsed.analystQuestions : stub.analystQuestions)
        .map(item => _cleanUserFacingText(item || '', { maxSentences: 1 }))
        .filter(Boolean)
        .slice(0, 3);
      const adjustment = parsed?.reviewerAdjustment && typeof parsed.reviewerAdjustment === 'object'
        ? parsed.reviewerAdjustment
        : stub.reviewerAdjustment;
      return {
        analystQuestions: analystQuestions.length ? analystQuestions : stub.analystQuestions,
        reviewerAdjustment: {
          param: String(adjustment?.param || stub.reviewerAdjustment.param || '').trim() || stub.reviewerAdjustment.param,
          suggestedValue: Number.isFinite(Number(adjustment?.suggestedValue))
            ? Number(adjustment.suggestedValue)
            : stub.reviewerAdjustment.suggestedValue,
          aleImpact: _cleanUserFacingText(adjustment?.aleImpact || stub.reviewerAdjustment.aleImpact || '', { maxSentences: 1 }) || stub.reviewerAdjustment.aleImpact,
          rationale: _cleanUserFacingText(adjustment?.rationale || stub.reviewerAdjustment.rationale || '', { maxSentences: 2 }) || stub.reviewerAdjustment.rationale
        }
      };
    } catch {
      return stub;
    }
  }

  function _buildChallengeSynthesisStub(input = {}) {
    const records = Array.isArray(input?.records) ? input.records : [];
    const overallConcern = records.length
      ? `Reviewers are consistently challenging ${String(records[0]?.parameter || 'the current assumptions').toLowerCase()} and the overall severity looks more exposed than the base case suggests.`
      : 'Reviewers are questioning whether the current estimate is too optimistic overall.';
    const revisedAleRange = String(input?.baseAleRange || '').trim()
      ? `A prudent committee view would treat the outcome as materially higher than the current ${String(input.baseAleRange).trim()} planning range until the challenged assumptions are defended.`
      : 'A prudent committee view would treat the annual loss range as materially higher until the challenged assumptions are defended.';
    const keyEvidence = 'The single best way to resolve most of these challenges is to produce one current evidence pack that proves the disputed control performance and loss-range assumptions together.';
    return {
      overallConcern,
      revisedAleRange,
      keyEvidence
    };
  }

  async function generateChallengeSynthesis(input = {}) {
    const stub = _buildChallengeSynthesisStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return stub;
    const records = Array.isArray(input?.records)
      ? input.records.filter(item => item && typeof item === 'object').slice(0, 8)
      : [];
    if (records.length < 2) return null;
    const schema = `{
  "overallConcern": "string",
  "revisedAleRange": "string",
  "keyEvidence": "string"
}`;
    const systemPrompt = `A risk assessment has received separate parameter challenges from reviewers.
Synthesise them into one coherent alternative view for a risk committee.

Return JSON only with this schema:
${schema}

Requirements:
- overallConcern: one sentence on the reviewer's combined concern
- revisedAleRange: one sentence stating the revised ALE range or direction implied by the combined challenges
- keyEvidence: one sentence naming the single most useful new evidence item to resolve most of the challenge

Write as if advising a risk committee. Keep the total to 3 sentences.`;
    const userPrompt = JSON.stringify({
      scenarioTitle: String(input?.scenarioTitle || '').trim(),
      scenarioSummary: String(input?.scenarioSummary || '').trim().slice(0, 1200),
      currentAleRange: String(input?.baseAleRange || '').trim(),
      challenges: records.map(item => ({
        parameter: String(item?.parameter || '').trim(),
        concern: String(item?.concern || '').trim(),
        reviewerAdjustment: item?.reviewerAdjustment || {}
      }))
    }, null, 2);
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateChallengeSynthesis',
        maxCompletionTokens: 260,
        timeoutMs: 14000
      });
      if (!raw) return stub;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairChallengeSynthesis'
      });
      return {
        overallConcern: _cleanUserFacingText(parsed?.overallConcern || '', { maxSentences: 1 }) || stub.overallConcern,
        revisedAleRange: _cleanUserFacingText(parsed?.revisedAleRange || '', { maxSentences: 1 }) || stub.revisedAleRange,
        keyEvidence: _cleanUserFacingText(parsed?.keyEvidence || '', { maxSentences: 1 }) || stub.keyEvidence
      };
    } catch {
      return stub;
    }
  }

  function _buildConsensusRecommendationStub(input = {}) {
    const challenges = Array.isArray(input?.challenges) ? input.challenges : [];
    const acceptable = challenges
      .filter(item => Math.abs(Number(item?.impactPct || 0)) <= 15)
      .map(item => String(item?.ref || '').trim())
      .filter(Boolean);
    const defend = challenges
      .filter(item => !acceptable.includes(String(item?.ref || '').trim()))
      .map(item => String(item?.ref || '').trim())
      .filter(Boolean);
    const meetInMiddleAleRange = String(input?.projectedAleRange || input?.adjustedAleRange || input?.originalAleRange || '').trim()
      || 'Use the projected consensus path as the working annual loss range until new evidence closes the challenge.';
    const headline = challenges.length
      ? `Accept the smaller committee adjustments first, then defend the changes that would materially reshape the current result without new evidence.`
      : 'Accept the smallest defensible reviewer adjustments first, then defend the assumptions that would materially change the outcome.';
    const defendLine = defend.length
      ? `Defend ${defend.join(', ')} unless the reviewer can show stronger evidence, because those changes would move the outcome materially beyond the current management read.`
      : 'Defend any remaining large-impact changes until stronger evidence shows the base case is too optimistic.';
    const consensusLine = `A workable middle ground is ${meetInMiddleAleRange}.`;
    return {
      summaryBullets: [headline, defendLine, consensusLine],
      acceptChallenges: acceptable,
      defendChallenges: defend,
      meetInTheMiddleAleRange: meetInMiddleAleRange
    };
  }

  async function generateConsensusRecommendation(input = {}) {
    const stub = _buildConsensusRecommendationStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return stub;
    const challenges = Array.isArray(input?.challenges)
      ? input.challenges.filter(item => item && typeof item === 'object').slice(0, 8)
      : [];
    if (!challenges.length) return stub;
    const allowedRefs = challenges.map(item => String(item?.ref || '').trim()).filter(Boolean);
    const schema = `{
  "summaryBullets": ["string", "string", "string"],
  "acceptChallenges": ["${allowedRefs[0] || 'C1'}"],
  "defendChallenges": ["${allowedRefs[1] || 'C2'}"],
  "meetInTheMiddleAleRange": "string"
}`;
    const systemPrompt = `An analyst's assessment has reviewer challenges.
Original parameters: current estimate.
Original ALE: current estimate.
If all reviewer adjustments applied: adjusted estimate.
Adjusted ALE: adjusted estimate.

Generate a consensus recommendation:
- Which adjustments should the analyst accept? (small ALE impact)
- Which should they defend? (large ALE impact, needs evidence)
- What is the "meet in the middle" ALE range both sides could accept?

Return JSON only with this schema:
${schema}

Rules:
- Use only the supplied challenge refs in acceptChallenges and defendChallenges.
- Write exactly 3 direct bullets for a risk committee.
- Put the committee-friendly projected range in meetInTheMiddleAleRange.`;
    const userPrompt = JSON.stringify({
      scenarioTitle: String(input?.scenarioTitle || '').trim(),
      scenarioSummary: String(input?.scenarioSummary || '').trim().slice(0, 1000),
      originalAleRange: String(input?.originalAleRange || '').trim(),
      adjustedAleRange: String(input?.adjustedAleRange || '').trim(),
      projectedAleRange: String(input?.projectedAleRange || '').trim(),
      aleChangePct: Number(input?.aleChangePct || 0),
      originalParameters: input?.originalParameters || {},
      adjustedParameters: input?.adjustedParameters || {},
      challenges: challenges.map(item => ({
        ref: String(item?.ref || '').trim(),
        parameter: String(item?.parameter || '').trim(),
        concern: String(item?.concern || '').trim(),
        proposedValue: String(item?.proposedValue || '').trim(),
        impactPct: Number(item?.impactPct || 0),
        aleImpact: String(item?.aleImpact || '').trim()
      }))
    }, null, 2);
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateConsensusRecommendation',
        maxCompletionTokens: 320,
        timeoutMs: 14000
      });
      if (!raw) return stub;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairConsensusRecommendation'
      });
      const cleanRefs = values => (Array.isArray(values) ? values : [])
        .map(item => String(item || '').trim())
        .filter(item => allowedRefs.includes(item));
      const summaryBullets = (Array.isArray(parsed?.summaryBullets) ? parsed.summaryBullets : stub.summaryBullets)
        .map(item => _cleanUserFacingText(item || '', { maxSentences: 1 }))
        .filter(Boolean)
        .slice(0, 3);
      const acceptChallenges = cleanRefs(parsed?.acceptChallenges);
      const defendChallenges = cleanRefs(parsed?.defendChallenges).filter(item => !acceptChallenges.includes(item));
      return {
        summaryBullets: summaryBullets.length ? summaryBullets : stub.summaryBullets,
        acceptChallenges: acceptChallenges.length ? acceptChallenges : stub.acceptChallenges,
        defendChallenges: defendChallenges.length ? defendChallenges : stub.defendChallenges,
        meetInTheMiddleAleRange: _cleanUserFacingText(parsed?.meetInTheMiddleAleRange || '', { maxSentences: 1 }) || stub.meetInTheMiddleAleRange
      };
    } catch {
      return stub;
    }
  }

  function _buildAssessmentVersionNarrativeStub(input = {}) {
    const diffLines = Array.isArray(input?.parameterDiffLines) ? input.parameterDiffLines.filter(Boolean) : [];
    const priorAle = String(input?.previousAleLabel || 'the earlier outcome').trim();
    const currentAle = String(input?.currentAleLabel || 'the current outcome').trim();
    if (!diffLines.length) {
      return `The analyst appears to have refreshed the assessment without making a major visible parameter change. The outcome moved from ${priorAle} to ${currentAle}, which suggests the update was more about context, evidence, or scenario framing than a wholesale reset. Review the narrative and supporting evidence to confirm what changed.`;
    }
    return `The analyst changed ${diffLines[0].replace(':', '').toLowerCase()}, which suggests they revised the practical severity or likelihood of the scenario. The outcome moved from ${priorAle} to ${currentAle}, so the update changed the scale of the expected loss rather than just the wording. This usually means new evidence, stronger challenge, or a tighter view of how the scenario would actually play out.`;
  }

  async function generateAssessmentVersionNarrative(input = {}) {
    const stub = _buildAssessmentVersionNarrativeStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return stub;
    const diffLines = Array.isArray(input?.parameterDiffLines)
      ? input.parameterDiffLines.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
      : [];
    if (!diffLines.length) return stub;
    const schema = `{
  "narrative": "string"
}`;
    const systemPrompt = `A risk assessment was updated. Here is what changed.
Generate a plain-English narrative of what these changes mean: why might the analyst have changed these values? What does the change in ALE outcome tell us?
Write 3 sentences maximum. Do not use FAIR jargon.

Return JSON only with this schema:
${schema}`;
    const userPrompt = [
      `Earlier scenario summary: ${String(input?.previousScenarioSummary || '').trim().slice(0, 900) || 'Not stated'}`,
      `Current scenario summary: ${String(input?.currentScenarioSummary || '').trim().slice(0, 900) || 'Not stated'}`,
      `Earlier ALE outcome: ${String(input?.previousAleLabel || 'Not stated').trim()}`,
      `Current ALE outcome: ${String(input?.currentAleLabel || 'Not stated').trim()}`,
      'Key parameter differences:',
      diffLines.map(item => `- ${item}`).join('\n')
    ].join('\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateAssessmentVersionNarrative',
        maxCompletionTokens: 220,
        timeoutMs: 12000
      });
      if (!raw) return stub;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairAssessmentVersionNarrative'
      });
      const narrative = _cleanUserFacingText(parsed?.narrative || '', { maxSentences: 3 });
      return narrative || stub;
    } catch {
      return stub;
    }
  }

  function _buildSensitivityNarrativeStub(input = {}) {
    const rows = Array.isArray(input?.rows) ? input.rows : [];
    if (!rows.length) return 'This sensitivity view did not produce enough data to identify a single dominant parameter yet.';
    const winner = rows
      .map((item) => ({
        ...item,
        highRatio: Number(item?.highRatio || 1),
        lowRatio: Number(item?.lowRatio || 1),
        leverage: Math.max(Math.abs(Number(item?.highRatio || 1) - 1), Math.abs(1 - Number(item?.lowRatio || 1)))
      }))
      .sort((left, right) => right.leverage - left.leverage)[0];
    const low = Number(winner?.lowRatio || 1).toFixed(1);
    const high = Number(winner?.highRatio || 1).toFixed(1);
    return `This assessment is most sensitive to ${String(winner?.parameter || 'one key parameter').toLowerCase()} — if that estimate is wrong, the true risk could be ${low}-${high}x the current annual loss view.`;
  }

  async function generateSensitivityNarrative(input = {}) {
    const stub = _buildSensitivityNarrativeStub(input);
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return stub;
    const rows = Array.isArray(input?.rows)
      ? input.rows.filter(item => item && typeof item === 'object').slice(0, 6)
      : [];
    if (!rows.length) return stub;
    const schema = `{
  "sentence": "string"
}`;
    const systemPrompt = `Here is a sensitivity analysis for a risk scenario. Which parameter has the most leverage on the outcome? Generate one sentence: "This assessment is most sensitive to [parameter] — if your estimate is wrong, the true risk could be [X-Y]x higher." Be direct.

Return JSON only with this schema:
${schema}`;
    const userPrompt = JSON.stringify({
      scenarioTitle: String(input?.scenarioTitle || '').trim(),
      baseAle: String(input?.baseAleLabel || '').trim(),
      sensitivityTable: rows
    }, null, 2);
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateSensitivityNarrative',
        maxCompletionTokens: 160,
        timeoutMs: 10000
      });
      if (!raw) return stub;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairSensitivityNarrative'
      });
      const sentence = _cleanUserFacingText(parsed?.sentence || '', { maxSentences: 1 });
      return sentence || stub;
    } catch {
      return stub;
    }
  }

  async function generateScenarioMemoryPrecedent(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const currentScenario = _cleanUserFacingText(input?.currentScenario || '', { maxSentences: 5 }).slice(0, 1000);
    const matches = Array.isArray(input?.matches)
      ? input.matches.filter(item => item && typeof item === 'object').slice(0, 3)
      : [];
    if (!currentScenario || matches.length < 2) return null;
    const schema = `{
  "precedent": "string"
}`;
    const systemPrompt = `You are a risk memory assistant for an enterprise risk platform.
Return JSON only with this schema:
${schema}

Write one sentence only. Summarise organisational precedent from similar completed scenarios.
Include the typical ALE range and the controls or themes most often cited.`;
    const userPrompt = [
      `Current scenario: ${currentScenario}`,
      'Similar completed scenarios:',
      matches.map((match, index) => [
        `${index + 1}. ${String(match?.scenarioTitle || match?.title || 'Untitled scenario').trim()}`,
        `ALE range: ${String(match?._scenarioMemory?.aleRange || 'Not stated').trim()}`,
        `Treatment status: ${String(match?._scenarioMemory?.treatmentStatus?.label || 'Monitor').trim()}`,
        `Narrative: ${String(match?.enhancedNarrative || match?.narrative || '').trim().slice(0, 260)}`,
        `Risks: ${(Array.isArray(match?.selectedRisks) ? match.selectedRisks.map(item => item?.title || item?.category || '').filter(Boolean) : []).slice(0, 4).join(', ') || 'Not stated'}`
      ].join('\n')).join('\n\n')
    ].join('\n\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateScenarioMemoryPrecedent',
        maxCompletionTokens: 180,
        timeoutMs: 12000
      });
      if (!raw) return null;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairScenarioMemoryPrecedent'
      });
      const precedent = _cleanUserFacingText(parsed?.precedent || '', { maxSentences: 1 });
      return precedent || null;
    } catch {
      return null;
    }
  }

  async function compareScenarioMemory(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const currentScenario = _cleanUserFacingText(input?.currentScenario || '', { maxSentences: 6 }).slice(0, 1200);
    const referenceScenario = input?.referenceScenario && typeof input.referenceScenario === 'object'
      ? input.referenceScenario
      : null;
    if (!currentScenario || !referenceScenario) return null;
    const schema = `{
  "differenceSummary": "string"
}`;
    const systemPrompt = `You are a scenario comparison assistant for an enterprise risk team.
Return JSON only with this schema:
${schema}

Write 2 short sentences highlighting what is materially different between the current scenario and the earlier reference scenario.
Focus on scope, driver, control posture, dependency pattern, and likely impact.`;
    const userPrompt = [
      `Current scenario: ${currentScenario}`,
      `Current lens: ${String(input?.scenarioLens?.label || input?.scenarioLens?.key || 'general').trim()}`,
      '',
      `Reference scenario title: ${String(referenceScenario?.scenarioTitle || referenceScenario?.title || 'Untitled scenario').trim()}`,
      `Reference narrative: ${String(referenceScenario?.enhancedNarrative || referenceScenario?.narrative || '').trim().slice(0, 800)}`,
      `Reference ALE range: ${String(referenceScenario?._scenarioMemory?.aleRange || 'Not stated').trim()}`,
      `Reference top risks: ${(Array.isArray(referenceScenario?.selectedRisks) ? referenceScenario.selectedRisks.map(item => item?.title || item?.category || '').filter(Boolean) : []).slice(0, 4).join(', ') || 'Not stated'}`
    ].join('\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'compareScenarioMemory',
        maxCompletionTokens: 180,
        timeoutMs: 12000
      });
      if (!raw) return null;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairCompareScenarioMemory'
      });
      const differenceSummary = _cleanUserFacingText(parsed?.differenceSummary || '', { maxSentences: 2 });
      return differenceSummary || null;
    } catch {
      return null;
    }
  }

  async function checkScenarioPortfolioOverlap(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const scenarioText = _cleanUserFacingText(input?.scenarioText || '', { maxSentences: 6 }).slice(0, 1600);
    const portfolio = Array.isArray(input?.portfolio)
      ? input.portfolio
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          title: String(item?.title || '').trim(),
          primaryRiskCategory: String(item?.primaryRiskCategory || '').trim()
        }))
        .filter(item => item.title)
      : [];
    if (!scenarioText || !portfolio.length) return null;
    const schema = `{
  "overlap": {
    "found": true,
    "matchTitle": "string",
    "overlapSummary": "string"
  },
  "gap": {
    "isNew": true,
    "gapSummary": "string"
  }
}`;
    const systemPrompt = `New scenario being started: [user text].
Existing portfolio: [array of {title, primaryRiskCategory}].

Answer two questions:
A) Is this scenario substantially covered by an existing assessment? If yes, which one and what is the overlap?
B) Does this scenario create a new gap not covered in the portfolio?

Return JSON only with this schema:
${schema}`;
    const userPrompt = [
      `New scenario being started: ${scenarioText}`,
      `Existing portfolio: ${JSON.stringify(portfolio, null, 2)}`
    ].join('\n\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'checkScenarioPortfolioOverlap',
        maxCompletionTokens: 240,
        timeoutMs: 12000
      });
      if (!raw) return null;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairScenarioPortfolioOverlap'
      });
      return {
        overlap: {
          found: !!parsed?.overlap?.found,
          matchTitle: _cleanUserFacingText(parsed?.overlap?.matchTitle || '', { maxSentences: 1 }),
          overlapSummary: _cleanUserFacingText(parsed?.overlap?.overlapSummary || '', { maxSentences: 1 })
        },
        gap: {
          isNew: !!parsed?.gap?.isNew,
          gapSummary: _cleanUserFacingText(parsed?.gap?.gapSummary || '', { maxSentences: 1 })
        }
      };
    } catch {
      return null;
    }
  }

  async function spotPortfolioCorrelations(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const fingerprints = Array.isArray(input?.fingerprints)
      ? input.fingerprints.filter(item => item && typeof item === 'object' && item.id).slice(0, 30)
      : [];
    if (fingerprints.length < 2) return [];
    const prioritisedDependencies = Array.isArray(input?.prioritisedDependencies)
      ? input.prioritisedDependencies.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
      : [];
    const reviewerScope = String(input?.reviewerScope || '').trim();
    const schema = `{
  "clusters": [
    {
      "clusterLabel": "string",
      "assessmentIds": ["string"],
      "sharedDependency": "string",
      "whyItMatters": "string",
      "oneActionThatFixesAll": "string"
    }
  ]
}`;
    const systemPrompt = `You are a risk portfolio analyst.
Identify clusters of 2 or more assessments that share a common single point of failure such as the same threat actor, failing control, vendor, regulation, or data asset.
For each cluster return:
- clusterLabel
- assessmentIds
- sharedDependency
- whyItMatters
- oneActionThatFixesAll

Return JSON only with this schema:
${schema}

Return no more than 5 clusters. Be specific. Ignore weak coincidences.`;
    const userPrompt = [
      reviewerScope ? `Reviewer scope: ${reviewerScope}` : '',
      prioritisedDependencies.length
        ? `Dependencies this reviewer has acted on before: ${prioritisedDependencies.join('; ')}`
        : '',
      'Assessment fingerprints:',
      JSON.stringify(fingerprints, null, 2)
    ].filter(Boolean).join('\n\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'spotPortfolioCorrelations',
        maxCompletionTokens: 650,
        timeoutMs: 18000
      });
      if (!raw) return null;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairPortfolioCorrelations'
      });
      const clusters = Array.isArray(parsed?.clusters) ? parsed.clusters : [];
      return clusters
        .map((item) => ({
          clusterLabel: _cleanUserFacingText(item?.clusterLabel || '', { maxSentences: 1 }),
          assessmentIds: Array.isArray(item?.assessmentIds) ? item.assessmentIds.map(id => String(id || '').trim()).filter(Boolean) : [],
          sharedDependency: _cleanUserFacingText(item?.sharedDependency || '', { maxSentences: 1 }),
          whyItMatters: _cleanUserFacingText(item?.whyItMatters || '', { maxSentences: 2 }),
          oneActionThatFixesAll: _cleanUserFacingText(item?.oneActionThatFixesAll || '', { maxSentences: 1 })
        }))
        .filter(item => item.sharedDependency && item.assessmentIds.length >= 2)
        .slice(0, 5);
    } catch {
      return null;
    }
  }

  async function generateProactiveReassessmentReasons(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const assessments = Array.isArray(input?.assessments)
      ? input.assessments.filter(item => item && typeof item === 'object' && item.id)
      : [];
    if (!assessments.length) return [];
    const prioritisedSignals = Array.isArray(input?.prioritisedSignals)
      ? input.prioritisedSignals.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const deprioritisedSignals = Array.isArray(input?.deprioritisedSignals)
      ? input.deprioritisedSignals.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const schema = `{
  "items": [
    {
      "id": "string",
      "reason": "string"
    }
  ]
}`;
    const systemPrompt = `You are a risk portfolio analyst.
Here are risk assessments with staleness signals.
For each assessment generate one sentence in plain English explaining why it may need revisiting now.
Be specific to the signals. Be direct. Do not repeat generic warnings.

Return JSON only with this schema:
${schema}`;
    const userPrompt = [
      prioritisedSignals.length
        ? `Signals this user tends to act on: ${prioritisedSignals.join(', ')}`
        : '',
      deprioritisedSignals.length
        ? `Signals this user often dismisses when stronger signals are absent: ${deprioritisedSignals.join(', ')}`
        : '',
      'Flagged assessments:',
      JSON.stringify(assessments, null, 2)
    ].filter(Boolean).join('\n\n');
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'generateProactiveReassessmentReasons',
        maxCompletionTokens: 650,
        timeoutMs: 18000
      });
      if (!raw) return null;
      const parsed = await _parseOrRepairStructuredJson(raw, schema, {
        taskName: 'repairProactiveReassessmentReasons'
      });
      return (Array.isArray(parsed?.items) ? parsed.items : [])
        .map((item) => ({
          id: String(item?.id || '').trim(),
          reason: _cleanUserFacingText(item?.reason || '', { maxSentences: 1 })
        }))
        .filter(item => item.id && item.reason);
    } catch {
      return null;
    }
  }

  async function coachRiskShortlist({ selectedRisks, narrative, scenarioLens } = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const names = (Array.isArray(selectedRisks) ? selectedRisks : [])
      .map(risk => risk?.title || risk?.category)
      .filter(Boolean)
      .slice(0, 12)
      .join(', ');
    const systemPrompt = `You are a FAIR risk scoping coach. Reply with JSON only:
{ "insight": "string (max 2 sentences)", "tone": "ok|warn|tip" }
tone: "ok" if risks are coherent, "warn" if risks span multiple event trees,
"tip" if an important risk type is notably absent.`;
    const userPrompt = `Scenario: ${String(narrative || '').slice(0, 400)}
Selected risks: ${names}
Lens: ${scenarioLens?.label || 'general'}`;
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        maxCompletionTokens: 120,
        timeoutMs: 8000
      });
      if (!raw) return null;
      const parsed = typeof raw === 'object'
        ? raw
        : JSON.parse(_extractJsonFromLlmResponse(raw) || 'null');
      if (!parsed?.insight) return null;
      return {
        insight: String(parsed.insight),
        tone: String(parsed.tone || 'ok')
      };
    } catch {
      return null;
    }
  }

  async function suggestSmartParamPrefill(input = {}) {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) return null;
    const history = Array.isArray(input?.history)
      ? input.history.filter(item => item && typeof item === 'object').slice(0, 8)
      : [];
    if (history.length < 3) return null;
    const scenarioSummary = String(input?.scenarioSummary || '').trim().slice(0, 800);
    if (!scenarioSummary) return null;
    const systemPrompt = `You are a FAIR risk parameter assistant. Here are past estimates for similar scenarios: [inject array]. The current scenario is: [scenario summary]. Suggest pre-fill values for TEF, Vulnerability, and Loss Magnitude range with a one-sentence rationale for each.

Return JSON only with this schema:
{
  "tef": { "min": number, "likely": number, "max": number, "rationale": "string" },
  "vulnerability": { "min": number, "likely": number, "max": number, "rationale": "string" },
  "controlStrength": { "min": number, "likely": number, "max": number, "rationale": "string" },
  "lossMagnitude": { "low": number, "likely": number, "high": number, "rationale": "string" }
}

Keep the numbers realistic, internally ordered, and anchored to the user's own history first.`;
    const userPrompt = [
      `Scenario type: ${String(input?.scenarioType || 'general').trim()}`,
      `Current scenario: ${scenarioSummary}`,
      'Past estimates for similar scenarios:',
      JSON.stringify(history, null, 2)
    ].join('\n');
    const ensureRange = (value = {}, fallback = {}) => {
      const min = Number(value?.min ?? fallback?.min);
      const likely = Number(value?.likely ?? fallback?.likely);
      const max = Number(value?.max ?? fallback?.max);
      if (![min, likely, max].every(Number.isFinite)) return null;
      const ordered = [min, likely, max].sort((a, b) => a - b);
      return {
        min: Number(ordered[0].toFixed(2)),
        likely: Number(ordered[1].toFixed(2)),
        max: Number(ordered[2].toFixed(2))
      };
    };
    const ensureLossRange = (value = {}) => {
      const low = Number(value?.low);
      const likely = Number(value?.likely);
      const high = Number(value?.high);
      if (![low, likely, high].every(Number.isFinite)) return null;
      const ordered = [low, likely, high].sort((a, b) => a - b);
      return {
        low: Math.max(0, Math.round(ordered[0])),
        likely: Math.max(0, Math.round(ordered[1])),
        high: Math.max(0, Math.round(ordered[2]))
      };
    };
    try {
      const raw = await _callLLM(systemPrompt, userPrompt, {
        taskName: 'suggestSmartParamPrefill',
        maxCompletionTokens: 420,
        timeoutMs: 12000,
        priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
      });
      if (!raw) return null;
      const parsed = JSON.parse(_extractJsonFromLlmResponse(raw) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      const tef = ensureRange(parsed.tef, history[0]?.tef);
      const vulnerability = ensureRange(parsed.vulnerability, history[0]?.vulnerability);
      const controlStrength = ensureRange(parsed.controlStrength, history[0]?.controls);
      const lossMagnitude = ensureLossRange(parsed.lossMagnitude);
      if (!tef || !vulnerability || !controlStrength || !lossMagnitude) return null;
      return {
        tef: {
          ...tef,
          rationale: _cleanUserFacingText(parsed?.tef?.rationale || '', { maxSentences: 1 })
        },
        vulnerability: {
          ...vulnerability,
          rationale: _cleanUserFacingText(parsed?.vulnerability?.rationale || '', { maxSentences: 1 })
        },
        controlStrength: {
          ...controlStrength,
          rationale: _cleanUserFacingText(parsed?.controlStrength?.rationale || '', { maxSentences: 1 })
        },
        lossMagnitude: {
          ...lossMagnitude,
          rationale: _cleanUserFacingText(parsed?.lossMagnitude?.rationale || '', { maxSentences: 1 })
        }
      };
    } catch {
      return null;
    }
  }


  function buildLocalEntityContextRefinement(input = {}) {
    const current = {
      geography: String(input.currentContext?.geography || '').trim(),
      contextSummary: String(input.currentContext?.contextSummary || '').trim(),
      riskAppetiteStatement: String(input.currentContext?.riskAppetiteStatement || '').trim(),
      applicableRegulations: Array.isArray(input.currentContext?.applicableRegulations) ? input.currentContext.applicableRegulations.map(String).filter(Boolean) : [],
      aiInstructions: String(input.currentContext?.aiInstructions || '').trim(),
      benchmarkStrategy: String(input.currentContext?.benchmarkStrategy || '').trim()
    };
    const prompt = _cleanUserFacingText(input.userPrompt || '', { maxSentences: 2 });
    const uploadedHint = String(input.uploadedText || '').trim() ? 'Uploaded policy and procedure material was considered in the fallback refinement.' : '';
    const summaryBits = [current.contextSummary, prompt ? `Refinement focus: ${prompt}` : '', uploadedHint].filter(Boolean);
    const evidenceMeta = _buildEvidenceMeta({
      citations: [],
      businessUnit: input.parentEntity,
      geography: current.geography || input.adminSettings?.geography || input.parentLayer?.geography,
      applicableRegulations: current.applicableRegulations,
      organisationContext: current.contextSummary || input.parentLayer?.contextSummary || input.parentEntity?.profile,
      adminSettings: input.adminSettings,
      uploadedText: input.uploadedText
    });
    return _decorateAiResult(_withEvidenceMeta({
      ...current,
      contextSummary: _cleanUserFacingText(summaryBits.join(' '), { maxSentences: String(input.entity?.type || '').toLowerCase() === 'department / function' ? 4 : 5 }),
      responseMessage: _cleanUserFacingText(`I applied a faster local refinement${prompt ? ` focused on ${prompt.toLowerCase()}` : ''}. Review the updated context and adjust anything that still needs more precision.`, { maxSentences: 2 })
    }, evidenceMeta), evidenceMeta, { contentFields: ['contextSummary', 'responseMessage'], fallbackUsed: true, uploadedDocumentName: input.uploadedDocumentName });
  }

  function buildLocalCompanyContextRefinement(input = {}) {
    const currentSections = {
      companySummary: String(input.currentSections?.companySummary || '').trim(),
      businessModel: String(input.currentSections?.businessModel || '').trim(),
      operatingModel: String(input.currentSections?.operatingModel || '').trim(),
      publicCommitments: String(input.currentSections?.publicCommitments || '').trim(),
      keyRiskSignals: String(input.currentSections?.keyRiskSignals || '').trim(),
      obligations: String(input.currentSections?.obligations || '').trim(),
      sources: String(input.currentSections?.sources || '').trim()
    };
    const prompt = _cleanUserFacingText(input.userPrompt || '', { maxSentences: 2 });
    const uploadedHint = String(input.uploadedText || '').trim() ? 'Uploaded strategy, policy, or procedure material was folded into this fallback refinement.' : '';
    const evidenceMeta = _buildEvidenceMeta({
      citations: [],
      geography: input.currentGeography,
      applicableRegulations: input.currentRegulations,
      organisationContext: currentSections,
      adminSettings: { aiInstructions: input.currentAiGuidance || '' },
      uploadedText: input.uploadedText
    });
    return _decorateAiResult(_withEvidenceMeta({
      ...currentSections,
      aiGuidance: String(input.currentAiGuidance || '').trim(),
      suggestedGeography: String(input.currentGeography || '').trim(),
      regulatorySignals: Array.isArray(input.currentRegulations) ? input.currentRegulations : [],
      companySummary: _cleanUserFacingText([currentSections.companySummary, prompt ? `Refinement focus: ${prompt}` : '', uploadedHint].filter(Boolean).join(' '), { maxSentences: 4 }),
      responseMessage: _cleanUserFacingText(`I applied a faster local refinement${prompt ? ` focused on ${prompt.toLowerCase()}` : ''}. Review the updated company context and tighten any remaining sections manually if needed.`, { maxSentences: 2 })
    }, evidenceMeta), evidenceMeta, { contentFields: ['companySummary', 'responseMessage'], fallbackUsed: true, uploadedDocumentName: input.uploadedDocumentName });
  }

  async function testCompassConnection() {
    if (_isDirectCompassUrl(_compassApiUrl) && !_compassApiKey) {
      throw new Error('No Compass API key configured for this session.');
    }
    const raw = await _callLLM(
      'You are a connectivity check. Reply with valid JSON only.',
      'Return exactly this JSON and nothing else: {"status":"ok","provider":"core42","message":"connection successful"}'
    );
    if (!raw) {
      throw new Error('Compass returned an empty response.');
    }
    try {
      return JSON.parse(_extractJsonFromLlmResponse(raw));
    } catch {
      return { status: 'ok', provider: 'core42', message: 'Connection succeeded, but the response was not strict JSON.' };
    }
  }

  return {
    buildGuidedScenarioDraft,
    generateScenarioAndInputs,
    streamNarrativeRefinement,
    enhanceRiskContext,
    analyseRiskRegister,
    buildCompanyContext,
    refineCompanyContext,
    buildLocalCompanyContextRefinement,
    buildEntityContext,
    refineEntityContext,
    buildLocalEntityContextRefinement,
    buildUserPreferenceAssist,
    suggestTreatmentImprovement,
    challengeAssessment,
    generateReviewerDecisionBrief,
    generatePortfolioExecutiveBrief,
    mediateAssessmentDispute,
    generateParameterChallengeRecord,
    generateChallengeSynthesis,
    generateConsensusRecommendation,
    generateAssessmentVersionNarrative,
    generateSensitivityNarrative,
    generateScenarioMemoryPrecedent,
    compareScenarioMemory,
    checkScenarioPortfolioOverlap,
    spotPortfolioCorrelations,
    generateProactiveReassessmentReasons,
    coachRiskShortlist,
    suggestSmartParamPrefill,
    getLatestTrace,
    getRuntimeStatus,
    isUsingStub,
    testCompassConnection,
    setCompassAPIKey,
    setCompassConfig,
    clearCompassConfig,
    setOpenAIKey
  };
})();
