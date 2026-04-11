'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const {
  sanitizeAiText,
  extractBalancedJsonCandidate,
  extractJsonFromLlmResponse,
  extractLlmTextResponse,
  describeLlmResponse
} = require('../assets/state/llmResponseExtractor');

const AI_MAX_RETRIES = 2;
const AI_TIMEOUT_MS = 30000;
const AI_DEFAULT_MAX_PROMPT_CHARS = 28000;

function buildPromptPayload(systemPrompt, userPrompt, options = {}) {
  const priorMessages = (Array.isArray(options.priorMessages) ? options.priorMessages : [])
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      role: String(item.role || '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user',
      content: sanitizeAiText(item.content || '', { maxChars: 4000 })
    }))
    .filter(item => item.content)
    .slice(-20);
  return {
    systemPrompt: sanitizeAiText(systemPrompt, { maxChars: 6000 }),
    userPrompt: sanitizeAiText(userPrompt, { maxChars: Number(options.maxPromptChars || AI_DEFAULT_MAX_PROMPT_CHARS) }),
    priorMessages
  };
}

function buildTracePromptSummary(promptPayload = {}) {
  const priorMessages = Array.isArray(promptPayload.priorMessages) ? promptPayload.priorMessages : [];
  const priorSummary = priorMessages.length
    ? `Prior messages: ${priorMessages.map((item) => `${item.role}: ${item.content}`).join(' | ')}`
    : '';
  return sanitizeAiText([
    `System: ${promptPayload.systemPrompt || ''}`,
    priorSummary,
    `User: ${promptPayload.userPrompt || ''}`
  ].filter(Boolean).join('\n\n'), { maxChars: 12000 });
}

function normaliseAiError(error) {
  const msg = String(error?.message || error || '');
  if (/AUTH_REQUIRED|Please sign in and try again/i.test(msg)) {
    return new Error('Your session is no longer valid for AI requests. Sign in again, then retry the AI action.');
  }
  if (/timed out/i.test(msg)) {
    return new Error('AI assist timed out. Try again, shorten the prompt, or check the hosted AI runtime.');
  }
  if (/LLM API error 429/i.test(msg)) {
    return new Error('AI requests are temporarily rate limited. Wait a moment and try again.');
  }
  if (/Unexpected token|JSON|schema|structured response|response shape was not usable|unterminated|string literal/i.test(msg)) {
    return new Error('The AI returned an unusable structured response for this task. Try again.');
  }
  return error instanceof Error ? error : new Error(msg);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseStructuredJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const cleaned = extractJsonFromLlmResponse(text);
  const candidates = [text, cleaned];
  const balanced = extractBalancedJsonCandidate(cleaned);
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

function buildTraceEntry({ label = '', promptSummary = '', response = '', sources = [] } = {}) {
  const safeLabel = String(label || '').trim();
  if (!safeLabel) return null;
  return {
    id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: safeLabel,
    timestamp: Date.now(),
    promptSummary: sanitizeAiText(promptSummary, { maxChars: 12000 }),
    response: sanitizeAiText(response, { maxChars: 20000 }),
    sources: (Array.isArray(sources) ? sources : [])
      .filter(Boolean)
      .map((item) => ({
        title: sanitizeAiText(item?.title || item?.label || item?.sourceTitle || 'Untitled source', { maxChars: 160 }),
        url: sanitizeAiText(item?.url || '', { maxChars: 400 }),
        sourceType: sanitizeAiText(item?.sourceType || '', { maxChars: 80 }),
        relevanceReason: sanitizeAiText(item?.relevanceReason || '', { maxChars: 240 })
      }))
      .filter((item) => item.title)
  };
}

async function callAi(systemPrompt, userPrompt, options = {}) {
  const config = getCompassProviderConfig();
  if (!config.proxyConfigured) {
    const error = new Error('Hosted AI proxy is not configured.');
    error.code = 'AI_PROXY_UNAVAILABLE';
    throw error;
  }

  const promptPayload = buildPromptPayload(systemPrompt, userPrompt, options);
  const maxCompletionTokens = Number(options.maxCompletionTokens || 1600);
  const timeoutMs = Number(options.timeoutMs || AI_TIMEOUT_MS);
  let lastError = null;

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          max_completion_tokens: maxCompletionTokens,
          temperature: Number(options.temperature ?? 0.2),
          messages: [
            { role: 'system', content: promptPayload.systemPrompt },
            ...(Array.isArray(promptPayload.priorMessages) ? promptPayload.priorMessages : []),
            { role: 'user', content: promptPayload.userPrompt }
          ]
        })
      }, timeoutMs);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errText}`);
      }
      const payload = await response.json();
      const extracted = extractLlmTextResponse(payload);
      if (!extracted) {
        const diagnostic = describeLlmResponse(payload)?.diagnostic || '';
        throw new Error(`AI response shape was not usable. ${String(diagnostic).trim()}`.trim());
      }
      return {
        text: extracted,
        promptSummary: buildTracePromptSummary(promptPayload)
      };
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error || '');
      if (attempt < AI_MAX_RETRIES && (/timed out/i.test(message) || /502|503|504|429/.test(message))) {
        await new Promise(resolve => setTimeout(resolve, /429/.test(message) ? 2000 * attempt : 300 * attempt));
        continue;
      }
    }
  }

  throw normaliseAiError(lastError);
}

async function repairStructuredJson(raw, schemaHint = '', {
  taskName = 'repairStructuredJson',
  timeoutMs,
  maxCompletionTokens = 1800,
  maxPromptChars = 14000
} = {}) {
  const malformed = String(raw || '').trim();
  const schema = String(schemaHint || '').trim();
  if (!malformed || !schema) return null;
  const repairPrompt = `You repair malformed model output into strict JSON.\nReturn ONLY valid JSON matching this schema exactly:\n${schema}`;
  const repairUser = `Original malformed response:\n${malformed}\n\nRepair the response into the required JSON schema. Preserve scenario-specific meaning. If a field is missing, infer cautiously from the malformed response only.`;
  const repaired = await callAi(repairPrompt, repairUser, {
    taskName,
    temperature: 0,
    maxCompletionTokens,
    maxPromptChars,
    timeoutMs
  });
  if (!repaired?.text) return null;
  return {
    parsed: parseStructuredJson(repaired.text),
    trace: buildTraceEntry({
      label: `${taskName} trace`,
      promptSummary: repaired.promptSummary,
      response: repaired.text
    })
  };
}

async function parseOrRepairStructuredJson(raw, schemaHint = '', options = {}) {
  try {
    return {
      parsed: parseStructuredJson(raw),
      repaired: false,
      trace: null
    };
  } catch (parseError) {
    const repaired = await repairStructuredJson(raw, schemaHint, options).catch(() => null);
    if (repaired?.parsed) {
      return {
        parsed: repaired.parsed,
        repaired: true,
        trace: repaired.trace || null
      };
    }
    throw parseError;
  }
}

async function runStructuredQualityGate({
  taskName = 'structuredQualityGate',
  schemaHint = '',
  originalContext = '',
  checklist = [],
  candidatePayload = null,
  timeoutMs,
  repairTimeoutMs,
  maxCompletionTokens = 2200,
  maxPromptChars = 22000
} = {}) {
  if (!candidatePayload || !schemaHint) return null;
  const items = (Array.isArray(checklist) ? checklist : []).map((item) => sanitizeAiText(item, { maxChars: 280 })).filter(Boolean);
  const systemPrompt = `You are the final quality gate for an enterprise risk AI workflow.

Review the candidate JSON for logic, lens fidelity, shortlist relevance, and business framing.
- preserve good scenario-specific content
- repair weak or misaligned content
- keep the user's described event path primary
- do not let generic cloud, IT, infrastructure, or compliance language override the real event
- if the affected asset is technical but the event is outage, fragility, aging infrastructure, or human error, do not force cyber without explicit compromise or security evidence
- return ONLY valid JSON that matches the schema exactly`;
  const userPrompt = `Original task context:
${sanitizeAiText(originalContext || '', { maxChars: 9000 }) || '(none)'}

Validation checklist:
${items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. Keep the output logically aligned to the original task.'}

Candidate JSON:
${JSON.stringify(candidatePayload, null, 2)}

Return corrected JSON only.`;
  const quality = await callAi(systemPrompt, userPrompt, {
    taskName,
    temperature: 0,
    maxCompletionTokens,
    maxPromptChars,
    timeoutMs
  });
  const parsed = await parseOrRepairStructuredJson(quality.text, schemaHint, {
    taskName: `${taskName}Repair`,
    timeoutMs: repairTimeoutMs
  });
  return {
    parsed: parsed?.parsed || null,
    trace: buildTraceEntry({
      label: `${taskName} trace`,
      promptSummary: quality.promptSummary,
      response: quality.text
    })
  };
}

module.exports = {
  buildTraceEntry,
  callAi,
  normaliseAiError,
  parseOrRepairStructuredJson,
  runStructuredQualityGate,
  sanitizeAiText
};
