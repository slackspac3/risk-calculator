'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SERVICE_FILES = [
  '../../../assets/services/apiOriginResolver.js',
  '../../../assets/services/aiTraceRuntime.js',
  '../../../assets/services/aiStatusClient.js',
  '../../../assets/services/aiWorkflowClient.js',
  '../../../assets/services/scenarioTaxonomyProjectionData.js',
  '../../../assets/services/scenarioTaxonomyProjection.js',
  '../../../assets/services/llmService.js'
];

function createNoopStorage() {
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };
}

function buildBaseContext({
  origin = 'https://slackspac3.github.io',
  apiOrigin = 'https://risk-calculator-eight.vercel.app',
  fetchImpl,
  sessionStorage = createNoopStorage(),
  localStorage = createNoopStorage(),
  extraContext = {}
} = {}) {
  return {
    console,
    Date,
    JSON,
    Math,
    URL,
    setTimeout,
    clearTimeout,
    AbortController,
    sessionStorage,
    localStorage,
    window: {
      location: { origin, hostname: new URL(origin).hostname },
      __RISK_CALCULATOR_RELEASE__: { apiOrigin },
      _lastRagSources: []
    },
    fetch: fetchImpl,
    AuthService: {
      getApiSessionToken: () => 'session-token',
      getCurrentUser: () => null
    },
    AIGuardrails: null,
    BenchmarkService: {},
    describeLlmResponse: require(path.resolve(__dirname, '../../../assets/state/llmResponseExtractor.js')).describeLlmResponse,
    logAuditEvent: async () => {},
    ...extraContext
  };
}

function loadLlmServiceContext({
  origin = 'https://slackspac3.github.io',
  apiOrigin = 'https://risk-calculator-eight.vercel.app',
  fetchImpl,
  sessionStorage,
  localStorage,
  extraContext = {},
  transformLlmService = null,
  appendCode = ''
} = {}) {
  const context = buildBaseContext({
    origin,
    apiOrigin,
    fetchImpl,
    sessionStorage,
    localStorage,
    extraContext
  });
  vm.createContext(context);

  SERVICE_FILES.forEach((relativePath) => {
    const filePath = path.resolve(__dirname, relativePath);
    const isLlmService = filePath.endsWith(`${path.sep}llmService.js`);
    let source = fs.readFileSync(filePath, 'utf8');
    if (isLlmService && typeof transformLlmService === 'function') {
      source = transformLlmService(source);
    }
    if (isLlmService) {
      source = `${source}\n;globalThis.__llmService = LLMService;${appendCode ? `\n${appendCode}` : ''}\n`;
    }
    vm.runInContext(source, context, { filename: path.basename(filePath) });
  });

  return context;
}

function loadLlmService(options = {}) {
  return loadLlmServiceContext(options).__llmService;
}

module.exports = {
  loadLlmService,
  loadLlmServiceContext
};
