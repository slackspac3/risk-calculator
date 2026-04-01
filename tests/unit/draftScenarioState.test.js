'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDraftScenarioStateRuntime() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../assets/state/draftScenarioState.js'),
    'utf8'
  );

  const context = {
    console,
    Date,
    JSON,
    Math,
    setTimeout,
    clearTimeout,
    window: {},
    AppState: {
      draft: {
        riskCandidates: [],
        selectedRiskIds: [],
        selectedRisks: [],
        scenarioLens: { key: 'general', label: 'General' },
        applicableRegulations: [],
        registerFindings: ''
      }
    },
    parseStructuredRiskLine(value = '') {
      return typeof value === 'string' ? { title: value } : value;
    },
    prettifyRiskText(value = '') {
      return String(value || '').replace(/\s+/g, ' ').trim();
    },
    isNoiseRiskText(value = '') {
      return !String(value || '').trim();
    },
    slugify(value = '') {
      return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    },
    getEffectiveSettings() {
      return { applicableRegulations: [] };
    },
    getScenarioGeographies() {
      return [];
    },
    deriveGeographyRegulations() {
      return [];
    },
    guessRisksFromText() {
      return [];
    },
    normaliseStructuredScenario(value = {}) {
      return value && typeof value === 'object' ? { ...value } : {};
    },
    resolveScenarioDisplayTitle(input = {}) {
      return String(
        input.scenarioTitle
        || input.selectedRisks?.[0]?.title
        || input.enhancedNarrative
        || input.narrative
        || ''
      ).trim();
    }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'draftScenarioState.js' });

  return {
    api: context.window.DraftScenarioState,
    appState: context.AppState,
    context
  };
}

test('normaliseRisk maps learned-pattern starters into the example source family', () => {
  const { api } = loadDraftScenarioStateRuntime();
  const risk = api.normaliseRisk({
    title: 'Privileged account takeover through identity platform compromise',
    source: 'learned-pattern'
  });

  assert.equal(risk.source, 'dry-run');
});

test('applyScenarioAssistResultToDraft removes stale generated risks and stamps fresh assist risks as ai', () => {
  const { api, appState } = loadDraftScenarioStateRuntime();
  appState.draft = {
    riskCandidates: [
      {
        id: 'risk-learned',
        title: 'Privileged account takeover through identity platform compromise',
        category: 'Identity & Access',
        source: 'learned-pattern'
      },
      {
        id: 'risk-manual',
        title: 'Analyst-kept working note',
        category: 'Manual',
        source: 'manual'
      }
    ],
    selectedRiskIds: ['risk-learned', 'risk-manual'],
    selectedRisks: [
      {
        id: 'risk-learned',
        title: 'Privileged account takeover through identity platform compromise',
        category: 'Identity & Access',
        source: 'learned-pattern'
      },
      {
        id: 'risk-manual',
        title: 'Analyst-kept working note',
        category: 'Manual',
        source: 'manual'
      }
    ],
    scenarioLens: { key: 'financial', label: 'Financial' },
    applicableRegulations: [],
    registerFindings: ''
  };

  api.applyScenarioAssistResultToDraft({
    risks: [{
      title: 'Counterparty default and bad-debt exposure',
      category: 'Financial',
      description: 'A customer insolvency could force a material write-off and cashflow strain.'
    }],
    scenarioLens: { key: 'financial', label: 'Financial' },
    regulations: ['ISO 37301']
  }, {
    narrative: 'A major client files for bankruptcy, leading to receivables write-off pressure.',
    assistSeed: 'A major client files for bankruptcy, leading to receivables write-off pressure.',
    nextNarrative: 'A major client files for bankruptcy, leading to receivables write-off pressure.'
  });

  const titles = Array.from(appState.draft.riskCandidates, (risk) => risk.title).sort();
  assert.deepEqual(titles, [
    'Analyst-kept working note',
    'Counterparty default and bad-debt exposure'
  ]);
  assert.equal(
    appState.draft.riskCandidates.find((risk) => risk.title === 'Counterparty default and bad-debt exposure')?.source,
    'ai'
  );
  assert.deepEqual(
    Array.from(appState.draft.selectedRisks, (risk) => risk.title).sort(),
    [
      'Analyst-kept working note',
      'Counterparty default and bad-debt exposure'
    ]
  );
});

test('applyRegisterAnalysisResultToDraft stamps live analysed upload risks as ai+register', () => {
  const { api, appState } = loadDraftScenarioStateRuntime();
  appState.draft = {
    riskCandidates: [],
    selectedRiskIds: [],
    selectedRisks: [],
    scenarioLens: { key: 'third-party', label: 'Third-Party' },
    applicableRegulations: [],
    uploadedRegisterName: 'supplier-risk-register.xlsx'
  };

  const extracted = api.applyRegisterAnalysisResultToDraft({
    usedFallback: false,
    risks: [{
      title: 'Supplier concentration exposure',
      category: 'Third-Party',
      description: 'One provider carries too much of the delivery dependency.'
    }]
  });

  assert.equal(extracted[0].source, 'ai+register');
  assert.equal(appState.draft.riskCandidates[0].source, 'ai+register');
  assert.equal(appState.draft.selectedRisks[0].title, 'Supplier concentration exposure');
});

test('applyScenarioAssistResultToDraft aligns hinted risks against the new scenario lens rather than the previous draft lens', () => {
  const { api, appState, context } = loadDraftScenarioStateRuntime();
  context.guessRisksFromText = (narrative = '', { lensHint } = {}) => (
    String(lensHint?.key || lensHint || '').toLowerCase().includes('operational')
      ? [{
          title: 'Operational breakdown affecting core services',
          category: 'Operational',
          description: `Aligned to: ${narrative}`
        }]
      : [{
          title: 'Cyber compromise of critical platforms or data',
          category: 'Cyber',
          description: `Aligned to: ${narrative}`
        }]
  );

  appState.draft = {
    riskCandidates: [],
    selectedRiskIds: [],
    selectedRisks: [],
    scenarioLens: { key: 'cyber', label: 'Cyber' },
    applicableRegulations: [],
    registerFindings: ''
  };

  api.applyScenarioAssistResultToDraft({
    risks: [],
    scenarioLens: { key: 'operational', label: 'Operational' },
    regulations: ['ISO 22301']
  }, {
    narrative: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
    assistSeed: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
    nextNarrative: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.'
  });

  assert.equal(appState.draft.scenarioLens?.key, 'operational');
  assert.deepEqual(
    Array.from(appState.draft.riskCandidates, (risk) => risk.title),
    ['Operational breakdown affecting core services']
  );
});
