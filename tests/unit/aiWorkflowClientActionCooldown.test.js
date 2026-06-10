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
