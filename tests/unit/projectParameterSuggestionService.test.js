'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  applyParameterCoachSuggestion,
  applyProjectParameterSuggestion,
  deriveParameterSuggestionsFromProjectExposure,
  getDefaultValuationMode
} = require('../../assets/services/projectParameterSuggestionService.js');

function findSuggestion(suggestions, bucket, type) {
  return suggestions.find(item => item.bucket === bucket && item.suggestionType === type);
}

test('buyer project exposure maps quantified drivers to existing FAIR buckets', () => {
  const suggestions = deriveParameterSuggestionsFromProjectExposure({
    financialDrivers: [
      {
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverStatus: 'calculated_driver',
        source: 'user',
        confidence: 'high',
        low: 10000,
        likely: 20000,
        high: 40000,
        mapsTo: ['businessInterruption'],
        rationale: 'Delay duration and daily cost are known.'
      },
      {
        id: 'buyer-reprocurement-premium',
        label: 'Reprocurement premium',
        driverStatus: 'estimated_driver',
        source: 'user',
        confidence: 'medium',
        low: 50000,
        likely: 75000,
        high: 100000,
        mapsTo: ['thirdParty'],
        rationale: 'Remaining spend and premium are estimated.'
      }
    ]
  }, {
    biMin: 5000,
    biLikely: 10000,
    biMax: 15000,
    tpMin: 10000,
    tpLikely: 15000,
    tpMax: 20000
  });

  const bi = findSuggestion(suggestions, 'businessInterruption', 'project_derived_range');
  const tp = findSuggestion(suggestions, 'thirdParty', 'project_derived_range');
  assert.deepEqual(bi.mappedFields, ['biMin', 'biLikely', 'biMax']);
  assert.deepEqual(bi.projectRange, { low: 10000, likely: 20000, high: 40000 });
  assert.equal(bi.gapSeverity, 'major');
  assert.deepEqual(tp.mappedFields, ['tpMin', 'tpLikely', 'tpMax']);
  assert.equal(tp.sourceStatus, 'estimated');
});

test('seller project exposure maps quantified drivers to existing FAIR buckets', () => {
  const suggestions = deriveParameterSuggestionsFromProjectExposure({
    financialDrivers: [
      {
        id: 'seller-margin-at-risk',
        label: 'Margin at risk',
        driverStatus: 'calculated_driver',
        source: 'document',
        confidence: 'high',
        low: 150000,
        likely: 250000,
        high: 350000,
        mapsTo: ['reputationContract']
      },
      {
        id: 'seller-liquidated-damages',
        label: 'Liquidated damages',
        driverStatus: 'calculated_driver',
        source: 'document',
        confidence: 'high',
        low: 25000,
        likely: 50000,
        high: 100000,
        mapsTo: ['regulatoryLegal']
      }
    ]
  }, {});

  const rc = findSuggestion(suggestions, 'reputationContract', 'project_derived_range');
  const rl = findSuggestion(suggestions, 'regulatoryLegal', 'project_derived_range');
  assert.deepEqual(rc.mappedFields, ['rcMin', 'rcLikely', 'rcMax']);
  assert.deepEqual(rl.mappedFields, ['rlMin', 'rlLikely', 'rlMax']);
  assert.equal(rc.sourceStatus, 'evidence_supported');
  assert.equal(rl.projectRange.likely, 50000);
});

test('unknown driver creates parameter gap and stress candidate, not zero range', () => {
  const suggestions = deriveParameterSuggestionsFromProjectExposure({
    financialDrivers: [
      {
        id: 'buyer-delay-cost',
        label: 'Delay cost',
        driverStatus: 'unquantified_driver',
        source: 'unknown',
        confidence: 'low',
        low: null,
        likely: null,
        high: null,
        mapsTo: ['businessInterruption'],
        missingInputs: ['delayCostPerDay']
      }
    ],
    missingInputs: [
      {
        field: 'delayCostPerDay',
        label: 'Delay cost per day',
        whyItMatters: 'Needed to quantify delay loss.',
        whoMightKnow: 'Project finance',
        suggestedQuestion: 'What is the delay cost per day?'
      }
    ]
  }, {
    biMin: 1,
    biLikely: 2,
    biMax: 3
  });

  const gap = findSuggestion(suggestions, 'businessInterruption', 'parameter_gap');
  const stress = findSuggestion(suggestions, 'businessInterruption', 'stress_case_candidate');
  assert.equal(gap.canApply, false);
  assert.equal(gap.projectRange, null);
  assert.equal(gap.missingInputs[0].field, 'delayCostPerDay');
  assert.match(gap.missingInputs[0].whoMightKnow, /Project finance/);
  assert.equal(stress.canApply, false);
  assert.equal(Boolean(findSuggestion(suggestions, 'businessInterruption', 'project_derived_range')), false);
});

test('benchmark proxy suggestions are labelled and applyable without pretending they are known values', () => {
  const suggestions = deriveParameterSuggestionsFromProjectExposure({
    financialDrivers: [
      {
        id: 'ai-delay-proxy',
        label: 'Benchmark delay proxy',
        driverStatus: 'benchmark_proxy_driver',
        source: 'benchmark',
        confidence: 'low',
        low: 8000,
        likely: 16000,
        high: 32000,
        mapsTo: ['businessInterruption']
      }
    ]
  }, {});

  const proxy = findSuggestion(suggestions, 'businessInterruption', 'benchmark_proxy_range');
  assert.equal(proxy.sourceStatus, 'benchmark_proxy');
  assert.equal(proxy.canApply, true);
  assert.deepEqual(proxy.projectRange, { low: 8000, likely: 16000, high: 32000 });
});

test('apply suggestion preserves ordered valid ranges and only touches mapped fields', () => {
  const suggestion = {
    canApply: true,
    mappedFields: ['biMin', 'biLikely', 'biMax'],
    projectRange: {
      low: 90000,
      likely: 30000,
      high: 60000
    }
  };
  const current = {
    biMin: 1,
    biLikely: 2,
    biMax: 3,
    rlMin: 4,
    rlLikely: 5,
    rlMax: 6
  };
  const applied = applyProjectParameterSuggestion(current, suggestion);

  assert.equal(applied.applied, true);
  assert.deepEqual(applied.appliedFields, ['biMin', 'biLikely', 'biMax']);
  assert.deepEqual(applied.range, { low: 30000, likely: 60000, high: 90000 });
  assert.equal(applied.params.biMin, 30000);
  assert.equal(applied.params.biLikely, 60000);
  assert.equal(applied.params.biMax, 90000);
  assert.equal(applied.params.rlLikely, 5);
  assert.equal(current.biMin, 1);
});

test('generic path defaults to benchmark-led and derives no suggestions from empty exposure', () => {
  assert.equal(getDefaultValuationMode('enterprise_generic'), 'benchmark_led');
  assert.equal(getDefaultValuationMode('project_buyer'), 'hybrid');
  assert.equal(getDefaultValuationMode('project_seller', 'project_linked'), 'project_linked');
  assert.deepEqual(deriveParameterSuggestionsFromProjectExposure({}, { biLikely: 10 }), []);
});

test('invalid suggestions are ignored safely', () => {
  const current = { biMin: 1, biLikely: 2, biMax: 3 };
  const notApplicable = applyProjectParameterSuggestion(current, {
    canApply: false,
    mappedFields: ['biMin', 'biLikely', 'biMax'],
    projectRange: { low: 10, likely: 20, high: 30 }
  });
  const invalidRange = applyProjectParameterSuggestion(current, {
    canApply: true,
    mappedFields: ['biMin', 'biLikely', 'biMax'],
    projectRange: { low: null, likely: 20, high: 30 }
  });

  assert.equal(notApplicable.applied, false);
  assert.deepEqual(notApplicable.params, current);
  assert.equal(invalidRange.applied, false);
  assert.deepEqual(invalidRange.params, current);
});

test('parameter coach apply helper rejects invalid keys and applies only supported numeric suggestions', () => {
  const current = {
    biMin: 1,
    biLikely: 2,
    biMax: 3,
    tpMin: 4,
    tpLikely: 5,
    tpMax: 6
  };
  const invalidKey = applyParameterCoachSuggestion(current, {
    parameterKey: 'shell',
    suggestionType: 'project_derived_range',
    suggestedRange: { min: 10, likely: 20, max: 30 }
  });
  const gap = applyParameterCoachSuggestion(current, {
    parameterKey: 'businessInterruption',
    suggestionType: 'parameter_gap',
    suggestedRange: { min: 10, likely: 20, max: 30 }
  });
  const applied = applyParameterCoachSuggestion(current, {
    parameterKey: 'businessInterruption',
    suggestionType: 'benchmark_proxy_range',
    suggestedRange: { min: 30000, likely: 10000, max: 20000 }
  });

  assert.equal(invalidKey.applied, false);
  assert.equal(invalidKey.reason, 'invalid_parameter_key');
  assert.equal(gap.applied, false);
  assert.equal(gap.reason, 'not_numeric_suggestion');
  assert.equal(applied.applied, true);
  assert.deepEqual(applied.appliedFields, ['biMin', 'biLikely', 'biMax']);
  assert.deepEqual(applied.range, { low: 10000, likely: 20000, high: 30000 });
  assert.equal(applied.params.biMin, 10000);
  assert.equal(applied.params.tpLikely, 5);
  assert.equal(current.biMin, 1);
});

test('parameter coach apply helper preserves explicit zero in supported numeric suggestions', () => {
  const applied = applyParameterCoachSuggestion({ biMin: 1, biLikely: 2, biMax: 3 }, {
    parameterKey: 'businessInterruption',
    suggestionType: 'project_derived_range',
    suggestedRange: { min: 0, likely: 0, max: 0 }
  });

  assert.equal(applied.applied, true);
  assert.equal(applied.params.biMin, 0);
  assert.equal(applied.params.biLikely, 0);
  assert.equal(applied.params.biMax, 0);
});

test('project parameter suggestion service works as a browser global without CommonJS', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../assets/services/projectParameterSuggestionService.js'), 'utf8');
  const context = {
    console,
    globalThis: {}
  };
  context.window = context.globalThis;
  vm.createContext(context);
  vm.runInContext(source, context);

  assert.equal(typeof context.globalThis.ProjectParameterSuggestionService.deriveParameterSuggestionsFromProjectExposure, 'function');
  const suggestions = context.globalThis.ProjectParameterSuggestionService.deriveParameterSuggestionsFromProjectExposure({
    financialDrivers: [{
      id: 'known-bi',
      label: 'Known BI',
      driverStatus: 'calculated_driver',
      source: 'user',
      low: 1,
      likely: 2,
      high: 3,
      mapsTo: ['businessInterruption']
    }]
  }, {});
  assert.equal(suggestions[0].bucket, 'businessInterruption');
});
