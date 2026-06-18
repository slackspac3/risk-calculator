'use strict';

const { buildTraceEntry, normaliseAiError, sanitizeAiText } = require('./_aiOrchestrator');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function compactObject(value) {
  if (!isPlainObject(value)) return {};
  return Object.keys(value).reduce((output, key) => {
    const item = value[key];
    if (item !== undefined) output[key] = item;
    return output;
  }, {});
}

function cleanText(value = '', maxChars = 600) {
  return sanitizeAiText(String(value ?? '').replace(/\s+/g, ' ').trim(), { maxChars });
}

function cleanBlock(value = '', maxChars = 4000) {
  return sanitizeAiText(String(value ?? '').replace(/\r\n?/g, '\n').trim(), { maxChars });
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normaliseLooseValue(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' || typeof value === 'bigint') return cleanText(value, 1200);
  if (Array.isArray(value)) {
    if (depth >= 3) return [];
    return value.slice(0, 30).map(item => normaliseLooseValue(item, depth + 1)).filter(item => item !== undefined && item !== '');
  }
  if (isPlainObject(value)) {
    if (depth >= 3) return {};
    const output = {};
    Object.keys(value).slice(0, 30).forEach((key) => {
      const cleanKey = cleanText(key, 120);
      if (!cleanKey) return;
      const item = normaliseLooseValue(value[key], depth + 1);
      if (item !== undefined && item !== '') output[cleanKey] = item;
    });
    return output;
  }
  return null;
}

function normaliseLooseObject(value = {}) {
  const result = normaliseLooseValue(value);
  return isPlainObject(result) ? result : {};
}

function normaliseTimeoutValue(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1000, Math.round(parsed));
}

function buildWorkflowTimeoutProfile({
  liveMs = 30000,
  repairMs = 10000,
  qualityMs = null,
  qualityRepairMs = null
} = {}) {
  return {
    liveMs: normaliseTimeoutValue(liveMs, 30000),
    repairMs: normaliseTimeoutValue(repairMs, 10000),
    qualityMs: qualityMs == null ? null : normaliseTimeoutValue(qualityMs, 12000),
    qualityRepairMs: qualityRepairMs == null ? null : normaliseTimeoutValue(qualityRepairMs, 8000)
  };
}

function applyEvidenceMeta(result, evidenceMeta, withEvidenceMeta) {
  return typeof withEvidenceMeta === 'function'
    ? withEvidenceMeta(result, evidenceMeta || null)
    : result;
}

function buildManualModeResult({
  baseResult = {},
  manualReason = null,
  traceLabel = '',
  promptSummary = '',
  response = '',
  sources = [],
  evidenceMeta = null,
  withEvidenceMeta = null
} = {}) {
  return applyEvidenceMeta({
    mode: 'manual',
    ...baseResult,
    usedFallback: false,
    aiUnavailable: false,
    manualReasonCode: manualReason?.code || 'manual_review_required',
    manualReasonTitle: manualReason?.title || 'Manual review only',
    manualReasonMessage: manualReason?.message || '',
    trace: buildTraceEntry({
      label: traceLabel,
      promptSummary,
      response,
      sources
    })
  }, evidenceMeta, withEvidenceMeta);
}

function buildDeterministicFallbackResult({
  baseResult = {},
  fallbackReason = null,
  aiUnavailable = false,
  traceLabel = '',
  promptSummary = '',
  response = '',
  sources = [],
  evidenceMeta = null,
  withEvidenceMeta = null,
  includeReasonFields = true
} = {}) {
  const reasonFields = includeReasonFields
    ? {
        fallbackReasonCode: fallbackReason?.code || 'server_fallback',
        fallbackReasonTitle: fallbackReason?.title || 'Deterministic fallback loaded',
        fallbackReasonMessage: fallbackReason?.message || '',
        fallbackReasonDetail: fallbackReason?.detail || ''
      }
    : {};
  return applyEvidenceMeta({
    mode: 'deterministic_fallback',
    ...baseResult,
    usedFallback: true,
    aiUnavailable: Boolean(aiUnavailable),
    ...reasonFields,
    trace: buildTraceEntry({
      label: traceLabel,
      promptSummary,
      response,
      sources
    })
  }, evidenceMeta, withEvidenceMeta);
}

function buildFallbackFromError({
  error = null,
  classifyFallbackReason = null,
  buildFallbackResult,
  fallbackOptions = {}
} = {}) {
  const normalisedError = normaliseAiError(error);
  const fallbackReason = typeof classifyFallbackReason === 'function'
    ? classifyFallbackReason(normalisedError)
    : null;
  const aiUnavailable = fallbackReason
    ? !/invalid_ai_output|unexpected_response_shape/i.test(String(fallbackReason.code || ''))
    : true;
  return buildFallbackResult({
    ...fallbackOptions,
    aiUnavailable,
    fallbackReason,
    normalisedError
  });
}

module.exports = {
  buildDeterministicFallbackResult,
  buildFallbackFromError,
  buildManualModeResult,
  buildWorkflowTimeoutProfile,
  cleanBlock,
  cleanText,
  compactObject,
  finiteNumber,
  isPlainObject,
  normaliseLooseObject,
  normaliseLooseValue
};
