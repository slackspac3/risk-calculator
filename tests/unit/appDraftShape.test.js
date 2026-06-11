'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEnsureDraftShape() {
  const filePath = path.resolve(__dirname, '../../assets/app.js');
  const modelPath = path.resolve(__dirname, '../../assets/state/assessmentTypeModel.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const modelSource = fs.readFileSync(modelPath, 'utf8');
  const start = source.indexOf('function ensureDraftShape() {');
  const end = source.indexOf('\nfunction getBUList()', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate ensureDraftShape in app.js');
  }
  const snippet = source.slice(start, end);
  const context = {
    AppState: {
      draft: {
        id: 'a_1',
        createdAt: 123,
        startedAt: 123,
        narrative: 'Draft text',
        aiFeedback: {
          draft: {
            score: 4,
            reasons: ['useful-with-edits'],
            runtimeMode: 'live_ai',
            savedAt: 1710000000000
          }
        },
        parameterCoach: {
          mode: 'deterministic_fallback',
          parameterRationales: [{
            parameterKey: 'businessInterruption',
            suggestionType: 'parameter_gap'
          }],
          missingHighImpactInputs: [{
            field: 'delayCostPerDay'
          }]
        },
        evidenceMap: {
          mode: 'deterministic_fallback',
          projectFinancialEvidenceMap: [{
            field: 'grossMarginPct',
            status: 'not_found'
          }],
          citationQuality: {
            decorative: ['Title only source']
          }
        },
        guidedInput: {},
        geographies: [],
        applicableRegulations: [],
        citations: [],
        recommendations: [],
        riskCandidates: [],
        selectedRiskIds: [],
        selectedRisks: []
      }
    },
    DEFAULT_ADMIN_SETTINGS: {
      geography: 'United Arab Emirates',
      defaultLinkMode: true,
      applicableRegulations: []
    },
    normaliseStructuredScenario: (value) => value || {},
    buildResolvedObligationSnapshot: (value) => value,
    formatScenarioGeographies: () => '',
    normaliseScenarioGeographies: () => [],
    console
  };
  vm.createContext(context);
  vm.runInContext(modelSource, context, { filename: 'assessmentTypeModel.js' });
  vm.runInContext(snippet, context, { filename: 'app.js' });
  return context;
}

test('ensureDraftShape preserves draft aiFeedback state across rerender normalisation', () => {
  const context = loadEnsureDraftShape();
  context.ensureDraftShape();
  assert.deepEqual(context.AppState.draft.aiFeedback, {
    draft: {
      score: 4,
      reasons: ['useful-with-edits'],
      runtimeMode: 'live_ai',
      savedAt: 1710000000000
    }
  });
  assert.equal(context.AppState.draft.parameterCoach.mode, 'deterministic_fallback');
  assert.equal(context.AppState.draft.parameterCoach.parameterRationales[0].parameterKey, 'businessInterruption');
  assert.equal(context.AppState.draft.parameterCoach.missingHighImpactInputs[0].field, 'delayCostPerDay');
  assert.equal(context.AppState.draft.evidenceMap.mode, 'deterministic_fallback');
  assert.equal(context.AppState.draft.evidenceMap.projectFinancialEvidenceMap[0].field, 'grossMarginPct');
  assert.equal(context.AppState.draft.evidenceMap.citationQuality.decorative[0], 'Title only source');
});

test('ensureDraftShape seeds and normalises assessment type fields', () => {
  const context = loadEnsureDraftShape();
  context.AppState.draft.assessmentType = 'project_seller';
  context.AppState.draft.projectContext = {
    projectName: ' Managed services renewal ',
    projectRole: 'buyer',
    currency: ' aed '
  };
  context.AppState.draft.sellerEconomics = {
    contractValue: '250000',
    grossMarginPct: '1.2'
  };
  context.AppState.draft.step4ValuationMode = 'project_linked';

  context.ensureDraftShape();

  assert.equal(context.AppState.draft.assessmentType, 'project_seller');
  assert.equal(context.AppState.draft.projectContext.projectName, 'Managed services renewal');
  assert.equal(context.AppState.draft.projectContext.projectRole, 'seller');
  assert.equal(context.AppState.draft.projectContext.currency, 'AED');
  assert.equal(context.AppState.draft.sellerEconomics.contractValue, 250000);
  assert.equal(context.AppState.draft.sellerEconomics.grossMarginPct, 1);
  assert.equal(context.AppState.draft.projectExposure.valuationMode, 'benchmark_led');
  assert.equal(context.AppState.draft.step4ValuationMode, 'project_linked');
});
