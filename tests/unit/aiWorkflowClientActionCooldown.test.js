'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAiWorkflowClient(options = {}) {
  const filePath = path.resolve(__dirname, '../../assets/services/aiWorkflowClient.js');
  const source = `${fs.readFileSync(filePath, 'utf8')}
;globalThis.__aiWorkflowClientTest = AiWorkflowClient;`;
  const context = {
    console,
    Date,
    JSON,
    Math,
    URL,
    setTimeout,
    clearTimeout,
    fetch: options.fetchImpl
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'aiWorkflowClient.js' });
  return context.__aiWorkflowClientTest;
}

test('workflow fingerprints normalise semantically identical scenario-draft payloads', () => {
  const client = loadAiWorkflowClient();

  const first = client.buildWorkflowFingerprint('/api/ai/scenario-draft', {
    riskStatement: ' Azure   global admin credentials found on the dark web. ',
    guidedInput: {
      event: 'Azure global admin credentials found on the dark web.',
      impact: ' Control disruption and fraud exposure '
    },
    applicableRegulations: ['UAE PDPL', 'UAE PDPL', ' ISO 27001 ']
  });
  const second = client.buildWorkflowFingerprint('/api/ai/scenario-draft', {
    riskStatement: 'Azure global admin credentials found on the dark web.',
    guidedInput: {
      event: '  Azure global admin credentials found on the dark web. ',
      impact: 'Control disruption and fraud exposure'
    },
    applicableRegulations: ['UAE PDPL', 'ISO 27001']
  });

  assert.equal(first, second);
});

test('workflow fingerprints include a normalised step 1 scenario fingerprint for manual routes', () => {
  const client = loadAiWorkflowClient();

  const first = client.buildWorkflowFingerprint('/api/ai/manual-draft-refinement', {
    riskStatement: 'Azure global admin credentials found on the dark web.',
    scenarioFingerprint: ' corp-tech | technology | Azure global admin credentials found on the dark web. ',
    geography: 'United Arab Emirates'
  });
  const second = client.buildWorkflowFingerprint('/api/ai/manual-draft-refinement', {
    riskStatement: 'Azure global admin credentials found on the dark web.',
    scenarioFingerprint: 'corp-tech | technology | Azure global admin credentials found on the dark web.',
    geography: 'United Arab Emirates'
  });

  assert.equal(first, second);
});

test('action cooldown store blocks only the same normalised payload within the cooldown window', async () => {
  const client = loadAiWorkflowClient();
  const store = client.createActionCooldownStore({ cooldownMs: 25, maxEntries: 8 });
  const basePayload = {
    baselineAssessment: {
      scenarioTitle: 'Identity compromise',
      enhancedNarrative: 'Compromised credentials are used to access privileged systems.'
    },
    improvementRequest: 'Improve containment and reduce disruption.'
  };

  assert.equal(
    store.getRemainingMs('/api/ai/treatment-suggestion', basePayload, { scope: 'step3' }) > 0,
    false
  );

  store.markCompleted('/api/ai/treatment-suggestion', {
    baselineAssessment: {
      scenarioTitle: ' Identity compromise ',
      enhancedNarrative: 'Compromised credentials are used to access privileged systems.'
    },
    improvementRequest: ' Improve containment   and reduce disruption. '
  }, { scope: 'step3' });

  assert.equal(
    store.getRemainingMs('/api/ai/treatment-suggestion', basePayload, { scope: 'step3' }) > 0,
    true
  );
  assert.equal(
    store.getRemainingMs('/api/ai/treatment-suggestion', {
      ...basePayload,
      improvementRequest: 'Improve containment, reduce disruption, and strengthen controls.'
    }, { scope: 'step3' }) > 0,
    false
  );

  await new Promise((resolve) => setTimeout(resolve, 35));

  assert.equal(
    store.getRemainingMs('/api/ai/treatment-suggestion', basePayload, { scope: 'step3' }) > 0,
    false
  );
});

test('generateProjectExposureMap posts the normalized project exposure request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          projectExposure: { financialDrivers: [] },
          generatedAt: '2026-06-10T00:00:00.000Z'
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  await client.generateProjectExposureMap({
    assessmentType: 'project_buyer',
    riskStatement: 'Supplier may miss go-live.',
    projectContext: {
      projectName: '  ERP rollout  ',
      projectRole: 'buyer',
      projectDurationMonths: null
    },
    buyerEconomics: {
      delayCostPerDay: null,
      remainingSpend: 0,
      reprocurementPremiumPct: 0.2
    },
    buyerEconomicsMeta: {
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided' },
      remainingSpend: { status: 'known', confidence: 'high', source: 'user' }
    },
    buyerProxyAnswers: {
      mainImpact: 'delay'
    },
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/ai/project-exposure-map');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.assessmentType, 'project_buyer');
  assert.equal(captured.body.projectContext.projectName, 'ERP rollout');
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body.projectContext, 'projectDurationMonths'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body.buyerEconomics, 'delayCostPerDay'), false);
  assert.equal(captured.body.buyerEconomics.remainingSpend, 0);
  assert.equal(captured.body.buyerEconomics.reprocurementPremiumPct, 0.2);
  assert.equal(captured.body.buyerEconomicsMeta.delayCostPerDay.status, 'unknown');
  assert.equal(captured.body.buyerProxyAnswers.mainImpact, 'delay');
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
});

test('generateParameterCoach posts the normalized parameter coach request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          parameterCoach: { parameterRationales: [] },
          generatedAt: '2026-06-10T00:00:00.000Z'
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  await client.generateParameterCoach({
    assessmentType: 'project_buyer',
    scenario: '  Supplier may miss go-live.  ',
    scenarioLens: { key: 'third-party', label: ' Third party ' },
    projectExposure: {
      projectExposureSummary: ' Delay cost is known. ',
      financialDrivers: [{
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverStatus: 'calculated_driver',
        source: 'user',
        low: 0,
        likely: 20000,
        high: 40000,
        mapsTo: ['businessInterruption']
      }],
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }]
    },
    parameters: {
      biMin: 0,
      biLikely: 10000,
      biMax: 20000,
      ignoredEmpty: ''
    },
    validation: {
      valid: false,
      warnings: ['  Review severe business interruption range.  ']
    },
    businessContext: {
      buName: '  G42  '
    },
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/ai/parameter-coach');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.assessmentType, 'project_buyer');
  assert.equal(captured.body.scenario, 'Supplier may miss go-live.');
  assert.equal(captured.body.projectExposure.projectExposureSummary, 'Delay cost is known.');
  assert.equal(captured.body.projectExposure.financialDrivers[0].low, 0);
  assert.equal(captured.body.parameters.biMin, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body.parameters, 'ignoredEmpty'), false);
  assert.equal(captured.body.validation.valid, false);
  assert.deepEqual(captured.body.validation.warnings, ['Review severe business interruption range.']);
  assert.equal(captured.body.businessContext.buName, 'G42');
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
});

test('generateEvidenceMap posts the normalized evidence map request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          evidenceMap: { supportedClaims: [] },
          generatedAt: '2026-06-10T00:00:00.000Z'
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  await client.generateEvidenceMap({
    assessmentType: 'project_seller',
    scenario: '  Delivery issue may trigger LDs.  ',
    riskStatement: ' Delivery issue ',
    projectContext: {
      projectName: '  Customer implementation  ',
      projectRole: 'seller'
    },
    projectExposure: {
      missingInputs: [{ field: 'grossMarginPct', label: ' Gross margin ' }]
    },
    assumptions: [{ statement: ' No LDs apply. ' }],
    parameters: {
      rcMin: 0,
      rcLikely: 10000,
      rcMax: 20000
    },
    citations: [{
      title: ' Customer SOW ',
      excerpt: ' Liquidated damages cap is USD 100,000. '
    }],
    ragMatches: [{
      title: ' RAG match ',
      text: ' Gross margin is 25%. ',
      score: 0.88
    }],
    businessContext: {
      buName: '  G42  '
    },
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/ai/evidence-map');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.assessmentType, 'project_seller');
  assert.equal(captured.body.scenario, 'Delivery issue may trigger LDs.');
  assert.equal(captured.body.projectContext.projectName, 'Customer implementation');
  assert.equal(captured.body.parameters.rcMin, 0);
  assert.equal(captured.body.citations[0].title, 'Customer SOW');
  assert.equal(captured.body.citations[0].excerpt, 'Liquidated damages cap is USD 100,000.');
  assert.equal(captured.body.ragMatches[0].title, 'RAG match');
  assert.equal(captured.body.ragMatches[0].excerpt, 'Gross margin is 25%.');
  assert.equal(captured.body.businessContext.buName, 'G42');
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
});

test('searchEvidence posts the normalized server-side RAG search request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          matches: [{
            evidenceId: 'DOC-1',
            chunkId: 'DOC-1_CHUNK_001',
            title: 'Contract clause',
            snippet: 'Liquidated damages cap is USD 100,000.',
            score: 0.91
          }]
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  const result = await client.searchEvidence({
    caseId: ' case-123 ',
    query: '  LD cap and recovery rights  ',
    topK: '6',
    purpose: ' step4_evidence_map ',
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/evidence/search');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.caseId, 'case-123');
  assert.equal(captured.body.query, 'LD cap and recovery rights');
  assert.equal(captured.body.topK, 6);
  assert.equal(captured.body.purpose, 'step4_evidence_map');
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
  assert.equal(result.matches[0].evidenceId, 'DOC-1');
});

test('indexEvidence posts the normalized server-side RAG indexing request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          index: { chunkCount: 1 }
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  await client.indexEvidence({
    caseId: ' case-123 ',
    documents: [{
      evidenceId: ' DOC-1 ',
      title: ' Contract ',
      text: '  Project budget is USD 1,000,000.  ',
      tags: [' contract ', ' contract ', ' budget ']
    }],
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/evidence/index');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.caseId, 'case-123');
  assert.equal(captured.body.documents[0].evidenceId, 'DOC-1');
  assert.equal(captured.body.documents[0].title, 'Contract');
  assert.equal(captured.body.documents[0].text, 'Project budget is USD 1,000,000.');
  assert.deepEqual(captured.body.documents[0].tags, ['contract', 'budget']);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
});

test('generateDecisionChallenge posts the normalized challenge request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          decisionChallenge: { challengeSummary: 'Challenge complete.' },
          generatedAt: '2026-06-10T00:00:00.000Z'
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  await client.generateDecisionChallenge({
    assessmentType: 'project_buyer',
    scenario: '  Supplier delay may affect go-live.  ',
    projectContext: {
      projectName: ' ERP rollout ',
      projectRole: 'buyer'
    },
    projectExposure: {
      missingInputs: [{ field: 'delayCostPerDay', label: ' Delay cost per day ' }]
    },
    parameters: {
      biMin: 0,
      biLikely: 10000,
      biMax: 25000,
      ignoredEmpty: ''
    },
    simulationResult: {
      annualLoss: { mean: 500000, p90: 900000 },
      threshold: 1000000,
      projectHorizon: { enabled: true, lossAsPctOfProjectValue: 0.12 }
    },
    assumptionRegister: {
      assumptions: [{ statement: ' Delay cost unknown. ' }]
    },
    parameterCoach: {
      missingHighImpactInputs: [{ field: 'delayCostPerDay' }]
    },
    evidenceMap: {
      projectFinancialEvidenceMap: [{ field: 'delayCostPerDay', status: 'not_found' }]
    },
    treatments: [{ title: '  Escalate supplier governance  ' }],
    riskAppetite: { threshold: 1000000 },
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/ai/decision-challenge');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.assessmentType, 'project_buyer');
  assert.equal(captured.body.scenario, 'Supplier delay may affect go-live.');
  assert.equal(captured.body.projectContext.projectName, 'ERP rollout');
  assert.equal(captured.body.projectExposure.missingInputs[0].field, 'delayCostPerDay');
  assert.equal(captured.body.parameters.biMin, 0);
  assert.equal(captured.body.simulationResult.annualLoss.p90, 900000);
  assert.equal(captured.body.simulationResult.projectHorizon.lossAsPctOfProjectValue, 0.12);
  assert.equal(captured.body.riskAppetite.threshold, 1000000);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
});

test('generateDecisionBrief posts the normalized decision brief request shape', async () => {
  let captured = null;
  const clientApi = loadAiWorkflowClient({
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          mode: 'deterministic_fallback',
          decisionBrief: { recommendation: 'Proceed with controls.' },
          generatedAt: '2026-06-10T00:00:00.000Z'
        })
      };
    }
  });
  const client = clientApi.createClient({
    defaultBaseUrl: 'https://risk-calculator.example',
    getSessionToken: () => 'session-token'
  });

  await client.generateDecisionBrief({
    assessmentType: 'project_seller',
    scenario: '  Delivery issue may erode margin.  ',
    projectContext: {
      projectName: ' Implementation ',
      projectRole: 'seller'
    },
    projectExposure: {
      financialDrivers: [{
        id: 'margin',
        label: ' Margin at risk ',
        driverStatus: 'benchmark_proxy_driver',
        low: 0,
        likely: 100000,
        high: 250000
      }],
      missingInputs: [{ field: 'grossMarginPct', label: ' Gross margin ' }]
    },
    simulationResult: {
      eventLoss: { p90: 500000 },
      annualLoss: { mean: 200000, p90: 700000 },
      projectHorizon: { enabled: true, loss: { mean: 90000, p90: 220000 } }
    },
    parameters: {
      rcMin: 0,
      rcLikely: 10000,
      rcMax: 20000
    },
    decisionChallenge: {
      sensitivityFlags: [{ driver: 'grossMarginPct', sourceStatus: 'unknown' }]
    },
    riskAppetite: { threshold: 1000000 },
    unexpectedLocalOnly: 'drop me'
  });

  assert.equal(captured.url, 'https://risk-calculator.example/api/ai/decision-brief');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-session-token'], 'session-token');
  assert.equal(captured.body.assessmentType, 'project_seller');
  assert.equal(captured.body.scenario, 'Delivery issue may erode margin.');
  assert.equal(captured.body.projectContext.projectName, 'Implementation');
  assert.equal(captured.body.projectExposure.financialDrivers[0].likely, 100000);
  assert.equal(captured.body.simulationResult.eventLoss.p90, 500000);
  assert.equal(captured.body.simulationResult.projectHorizon.loss.p90, 220000);
  assert.equal(captured.body.parameters.rcMin, 0);
  assert.equal(captured.body.riskAppetite.threshold, 1000000);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, 'unexpectedLocalOnly'), false);
});
