'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLlmInternals() {
  const filePath = path.resolve(__dirname, '../../assets/services/llmService.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const instrumented = source.replace(
    '  return {\n    buildGuidedScenarioDraft,',
    '  globalThis.__llmInternals = { _classifyScenario, _extractRiskCandidates, _evaluateGuidedDraftCandidate };\n\n  return {\n    buildGuidedScenarioDraft,'
  );
  assert.notEqual(instrumented, source, 'Failed to instrument llmService internals for test access');

  const noopStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };

  const context = {
    console,
    Date,
    JSON,
    Math,
    URL,
    setTimeout,
    clearTimeout,
    AbortController,
    sessionStorage: noopStorage,
    localStorage: noopStorage,
    window: {
      location: { origin: 'http://127.0.0.1:8080' },
      _lastRagSources: []
    },
    fetch: async () => {
      throw new Error('fetch should not be called in llmServiceClassification.test.js');
    },
    AIGuardrails: null,
    BenchmarkService: {},
    logAuditEvent: async () => {}
  };

  vm.createContext(context);
  vm.runInContext(instrumented, context, { filename: 'llmService.js' });
  return context.__llmInternals;
}

test('classifies technology downtime with human error as operational rather than cyber', () => {
  const internals = loadLlmInternals();
  const classification = internals._classifyScenario(
    'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
    {
      guidedInput: {
        event: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption',
        asset: 'Cloud system',
        cause: 'Human error',
        impact: 'Customer impact, reputational loss'
      }
    }
  );

  assert.equal(classification.key, 'operational');
});

test('extractRiskCandidates prefers operational outage risks over cyber for non-compromise cloud downtime', () => {
  const internals = loadLlmInternals();
  const risks = internals._extractRiskCandidates(
    'Unscheduled IT system downtime due to aging infrastructure. Cloud system affected. Human error triggered critical operational disruption and customer impact.',
    {
      lensHint: { key: 'operational', label: 'Operational' }
    }
  );

  assert.equal(risks[0]?.key, 'operational');
  assert.equal(risks.some((risk) => risk.key === 'cyber'), false);
});

test('evaluateGuidedDraftCandidate rejects a draft that explicitly labels the wrong lens', () => {
  const internals = loadLlmInternals();
  const candidate = internals._evaluateGuidedDraftCandidate(
    'Critical-urgency Compliance scenario: Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption. The area most exposed is the cloud system. The most likely driver is human error. If this develops, it could create customer impact and reputational loss.',
    {
      seedNarrative: 'Critical-urgency Operational scenario: Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption. The area most exposed is the cloud system. The most likely driver is human error. If this develops, it could create customer impact and reputational loss.',
      guidedInput: {
        event: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption',
        asset: 'Cloud system',
        cause: 'Human error',
        impact: 'Customer impact, reputational loss'
      },
      scenarioLensHint: { key: 'operational', label: 'Operational' }
    }
  );

  assert.equal(candidate.accepted, false);
  assert.equal(candidate.reason, 'explicit-lens-drift');
});
