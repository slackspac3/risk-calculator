'use strict';

(function attachAIGuardrails(globalScope) {
  const DEFAULT_MAX_TEXT_CHARS = 20000;
  const DEFAULT_MAX_PROMPT_CHARS = 18000;
  const SUGGESTED_PREFIX = 'Suggested draft: ';

  function sanitizeText(value = '', { maxChars = DEFAULT_MAX_TEXT_CHARS } = {}) {
    const cleaned = String(value || '')
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ')
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!maxChars || cleaned.length <= maxChars) return cleaned;
    return `${cleaned.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
  }

  function labelSuggested(value = '', { prefix = SUGGESTED_PREFIX } = {}) {
    const text = sanitizeText(value, { maxChars: 40000 });
    if (!text) return '';
    return text.startsWith(prefix) ? text : `${prefix}${text}`;
  }

  function buildPromptPayload(systemPrompt = '', userPrompt = '', { maxChars = DEFAULT_MAX_PROMPT_CHARS } = {}) {
    const safeSystemPrompt = sanitizeText(systemPrompt, { maxChars: Math.min(6000, maxChars) });
    const remaining = Math.max(2000, maxChars - safeSystemPrompt.length);
    const safeUserPrompt = sanitizeText(userPrompt, { maxChars: remaining });
    return {
      systemPrompt: safeSystemPrompt,
      userPrompt: safeUserPrompt,
      truncated: String(systemPrompt || '').length > safeSystemPrompt.length || String(userPrompt || '').length > safeUserPrompt.length
    };
  }

  function buildSourceBasis({ evidenceSummary = '', citations = [], uploadedDocumentName = '', fallbackUsed = false } = {}) {
    const sources = [];
    const summary = sanitizeText(evidenceSummary, { maxChars: 320 });
    if (summary) sources.push(summary);
    const citationTitles = (Array.isArray(citations) ? citations : [])
      .map(item => sanitizeText(item?.title || item?.note || '', { maxChars: 120 }))
      .filter(Boolean)
      .slice(0, 4);
    citationTitles.forEach(title => sources.push(`Source reviewed: ${title}`));
    const uploaded = sanitizeText(uploadedDocumentName, { maxChars: 120 });
    if (uploaded) sources.push(`Uploaded material reviewed: ${uploaded}`);
    if (fallbackUsed) sources.push('Fallback output was used because the live AI response was unavailable or incomplete.');
    return Array.from(new Set(sources)).slice(0, 6);
  }

  function buildEnvelope({
    content = {},
    confidence = {},
    assumptions = [],
    missingInformation = [],
    sourceBasis = [],
    fallbackUsed = false
  } = {}) {
    return {
      label: 'Suggested draft',
      content,
      confidence: {
        label: sanitizeText(confidence.label || 'Moderate confidence', { maxChars: 80 }),
        evidenceQuality: sanitizeText(confidence.evidenceQuality || '', { maxChars: 120 }),
        summary: sanitizeText(confidence.summary || '', { maxChars: 320 })
      },
      assumptions: (Array.isArray(assumptions) ? assumptions : []).map(item => sanitizeText(item, { maxChars: 220 })).filter(Boolean).slice(0, 6),
      missingInformation: (Array.isArray(missingInformation) ? missingInformation : []).map(item => sanitizeText(item, { maxChars: 220 })).filter(Boolean).slice(0, 6),
      sourceBasis: (Array.isArray(sourceBasis) ? sourceBasis : []).map(item => sanitizeText(item, { maxChars: 220 })).filter(Boolean).slice(0, 6),
      fallbackUsed: !!fallbackUsed
    };
  }

  const api = {
    DEFAULT_MAX_TEXT_CHARS,
    DEFAULT_MAX_PROMPT_CHARS,
    SUGGESTED_PREFIX,
    sanitizeText,
    labelSuggested,
    buildPromptPayload,
    buildSourceBasis,
    buildEnvelope
  };

  Object.assign(globalScope, { AIGuardrails: api });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
