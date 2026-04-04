'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadProjection() {
  const context = { console, globalThis: {} };
  context.window = context.globalThis;
  vm.createContext(context);
  const files = [
    '../../assets/services/scenarioTaxonomyProjectionData.js',
    '../../assets/services/scenarioTaxonomyProjection.js'
  ];
  files.forEach((relativePath) => {
    const source = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: path.basename(relativePath) });
  });
  return context.globalThis.ScenarioTaxonomyProjection;
}

test('projection version matches canonical server taxonomy version', () => {
  const projection = loadProjection();
  const taxonomy = require('../../api/_scenarioTaxonomy.js');
  assert.equal(projection.taxonomyVersion, taxonomy.SCENARIO_TAXONOMY_VERSION);
});

test('projection exposes the high-drift families needed for Step 1 hinting', () => {
  const projection = loadProjection();
  const families = [
    projection.familyByKey.identity_compromise,
    projection.familyByKey.availability_attack,
    projection.familyByKey.privacy_non_compliance,
    projection.familyByKey.delivery_slippage
  ];
  families.forEach((family) => assert.ok(family));
  assert.equal(projection.familyByKey.identity_compromise.lensKey, 'cyber');
  assert.equal(projection.familyByKey.delivery_slippage.lensKey, 'supply-chain');
});

test('projection keeps unsupported AI/model signals out of standard Step 1 hinting', () => {
  const projection = loadProjection();
  const classification = projection.classifyScenarioText(
    'DDoS traffic overwhelms the public website and degrades customer-facing services.',
    {}
  );
  assert.equal(classification.familyKey, 'availability_attack');
  assert.equal(projection.detectUnsupportedSignals('Responsible AI drift in a model workflow.').includes('ai_model_risk'), true);
});

test('projection retains compatibility aliases for lookup but only classifies active primary families', () => {
  const projection = loadProjection();
  assert.equal(projection.familyByKey.manual_error.status, 'compatibility_only');
  assert.equal(projection.familyByKey.manual_error.preferredFamilyKey, 'process_breakdown');

  const classification = projection.classifyScenarioText(
    'A manual processing error disrupts fulfilment and creates backlog.',
    { scenarioLensHint: 'manual_error' }
  );

  assert.equal(classification.familyKey, 'process_breakdown');
  assert.equal(projection.activeFamilies.some((family) => family.key === 'manual_error'), false);
});
