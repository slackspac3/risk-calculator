'use strict';

const COMPLETED_RESULT_TTL_MS = 45000;
const MAX_COMPLETED_RESULTS = 128;

const inflightRequests = new Map();
const completedResults = new Map();

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function cloneJsonValue(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function pruneCompletedResults(now = Date.now()) {
  completedResults.forEach((entry, key) => {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      completedResults.delete(key);
    }
  });
  while (completedResults.size > MAX_COMPLETED_RESULTS) {
    const oldestKey = completedResults.keys().next().value;
    if (!oldestKey) break;
    completedResults.delete(oldestKey);
  }
}

function buildWorkflowReuseKey({ workflow = '', scopeKey = '', fingerprintInput = {} } = {}) {
  return [
    String(workflow || '').trim(),
    String(scopeKey || '').trim(),
    stableStringify(fingerprintInput || {})
  ].join('::');
}

function isFallbackResult(result) {
  return isPlainObject(result)
    && (result.usedFallback === true
      || result.aiUnavailable === true
      || String(result.mode || '').trim().toLowerCase() === 'deterministic_fallback');
}

async function withWorkflowReuse({
  workflow = '',
  scopeKey = '',
  fingerprintInput = {},
  ttlMs = COMPLETED_RESULT_TTL_MS,
  cacheable = (result) => result !== undefined && !isFallbackResult(result),
  observeReuseEvent = null,
  compute
} = {}) {
  const key = buildWorkflowReuseKey({ workflow, scopeKey, fingerprintInput });
  const now = Date.now();
  pruneCompletedResults(now);

  const cached = completedResults.get(key);
  if (cached && Number(cached.expiresAt || 0) > now) {
    if (typeof observeReuseEvent === 'function') {
      observeReuseEvent({ type: 'cache_hit' });
    }
    return cloneJsonValue(cached.result);
  }

  if (inflightRequests.has(key)) {
    if (typeof observeReuseEvent === 'function') {
      observeReuseEvent({ type: 'inflight_reuse' });
    }
    return inflightRequests.get(key).then((result) => cloneJsonValue(result));
  }

  const requestPromise = Promise.resolve()
    .then(() => compute())
    .then((result) => {
      if (cacheable(result)) {
        completedResults.delete(key);
        completedResults.set(key, {
          result: cloneJsonValue(result),
          expiresAt: Date.now() + Math.max(1000, Number(ttlMs || COMPLETED_RESULT_TTL_MS))
        });
        pruneCompletedResults();
      }
      return result;
    });

  inflightRequests.set(key, requestPromise);
  try {
    const result = await requestPromise;
    return cloneJsonValue(result);
  } finally {
    if (inflightRequests.get(key) === requestPromise) {
      inflightRequests.delete(key);
    }
  }
}

function resetWorkflowReuseState() {
  inflightRequests.clear();
  completedResults.clear();
}

function clearWorkflowCache() {
  resetWorkflowReuseState();
}

module.exports = {
  buildWorkflowReuseKey,
  withWorkflowReuse,
  clearWorkflowCache,
  resetWorkflowReuseState,
  __unsafeInternals: {
    inflightRequests,
    completedResults
  }
};
