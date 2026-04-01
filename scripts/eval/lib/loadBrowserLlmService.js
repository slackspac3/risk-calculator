'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

function buildBenchmarkServiceStub() {
  return {
    deriveSuggestedInputs() {
      return null;
    },
    summariseBenchmarkBasis() {
      return '';
    },
    buildReferenceList() {
      return [];
    },
    buildInputProvenance() {
      return [];
    },
    buildPromptBlock() {
      return '(none)';
    }
  };
}

function buildGuardrailsStub() {
  return {
    sanitizeText(value = '', { maxChars = 20000 } = {}) {
      return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
    },
    labelSuggested(value = '') {
      const text = String(value || '').trim();
      return text.startsWith('Suggested draft:') ? text : (text ? `Suggested draft: ${text}` : '');
    },
    buildPromptPayload(systemPrompt, userPrompt, { maxChars = 18000 } = {}) {
      return {
        systemPrompt: String(systemPrompt || '').trim().slice(0, 6000),
        userPrompt: String(userPrompt || '').trim().slice(0, maxChars),
        truncated: false
      };
    },
    buildSourceBasis({ evidenceSummary = '', citations = [], uploadedDocumentName = '', fallbackUsed = false } = {}) {
      const basis = [];
      if (evidenceSummary) basis.push({ kind: 'summary', text: evidenceSummary });
      if (uploadedDocumentName) basis.push({ kind: 'upload', text: uploadedDocumentName });
      if (Array.isArray(citations) && citations.length) basis.push({ kind: 'citations', count: citations.length });
      if (fallbackUsed) basis.push({ kind: 'fallback', text: 'Local fallback used' });
      return basis;
    },
    buildEnvelope({ confidenceLabel = '', sourceBasis = [], missingInformation = [], fallbackUsed = false } = {}) {
      return {
        confidenceLabel,
        sourceBasis,
        missingInformation,
        fallbackUsed
      };
    }
  };
}

function buildTimer(fastTimers = true) {
  if (!fastTimers) {
    return {
      setTimeout: global.setTimeout.bind(global),
      clearTimeout: global.clearTimeout.bind(global)
    };
  }
  return {
    setTimeout(callback, ...args) {
      queueMicrotask(() => {
        if (typeof callback === 'function') callback(...args);
      });
      return 0;
    },
    clearTimeout() {}
  };
}

function loadBrowserLlmService(options = {}) {
  const llmServicePath = path.resolve(__dirname, '../../../assets/services/llmService.js');
  const source = `${fs.readFileSync(llmServicePath, 'utf8')}\nmodule.exports = LLMService;\n`;
  const timers = buildTimer(options.fastTimers !== false);
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    URL,
    Math,
    Date,
    JSON,
    Promise,
    Error,
    RegExp,
    Buffer,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Intl,
    fetch: typeof options.fetch === 'function' ? options.fetch : global.fetch,
    AbortController: global.AbortController,
    structuredClone: global.structuredClone,
    crypto: global.crypto,
    queueMicrotask,
    process,
    window: {
      location: {
        origin: options.origin || 'https://risk-calculator-eight.vercel.app'
      },
      _lastRagSources: []
    },
    sessionStorage: createMemoryStorage(),
    localStorage: createMemoryStorage(),
    AuthService: {
      getApiSessionToken() {
        return '';
      },
      getCurrentUser() {
        return null;
      }
    },
    BenchmarkService: buildBenchmarkServiceStub(),
    AIGuardrails: buildGuardrailsStub(),
    describeLlmResponse: require(path.resolve(__dirname, '../../../assets/state/llmResponseExtractor.js')).describeLlmResponse,
    logAuditEvent: async () => {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  };
  context.global = context;
  context.globalThis = context;
  vm.runInNewContext(source, context, {
    filename: llmServicePath
  });
  return context.module.exports;
}

module.exports = {
  loadBrowserLlmService
};
