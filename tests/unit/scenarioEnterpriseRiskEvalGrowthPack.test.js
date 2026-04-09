'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadEvalDataset,
  buildEvalInput,
  scoreGeneratedScenario
} = require('../../scripts/eval/lib/scenarioEval');

const ENTERPRISE_RISK_GROWTH_PACK_PATH = path.resolve(__dirname, '../fixtures/eval/enterprise_risk_eval_growth_pack.jsonl');

test('supplemental enterprise-risk eval growth pack stays structurally complete across ERM governance scenarios', () => {
  const dataset = loadEvalDataset(ENTERPRISE_RISK_GROWTH_PACK_PATH);

  assert.equal(dataset.length, 4);

  dataset.forEach((row) => {
    assert.ok(String(row.id || '').trim());
    assert.equal(String(row.expected_primary_lens || '').trim(), 'general');
    assert.ok(String(row.scenario_text || '').trim().length > 80);
    assert.ok(Array.isArray(row.key_anchor_terms) && row.key_anchor_terms.length >= 4);
    assert.ok(Array.isArray(row.valid_risks) && row.valid_risks.length >= 3);
    assert.ok(Array.isArray(row.invalid_risks) && row.invalid_risks.length >= 3);
    const input = buildEvalInput(row);
    assert.equal(input.riskStatement, row.scenario_text);
    assert.equal(input.businessUnit.scenarioLensHint, 'general');
  });
});

test('supplemental enterprise-risk eval growth pack rows can score as coherent outputs', () => {
  const dataset = loadEvalDataset(ENTERPRISE_RISK_GROWTH_PACK_PATH);

  dataset.forEach((row) => {
    const input = buildEvalInput(row);
    const score = scoreGeneratedScenario(row, {
      primaryLens: input.businessUnit.scenarioLensHint,
      secondaryLensKeys: [],
      scenarioTitle: row.scenario_text,
      draftNarrative: row.scenario_text,
      summary: row.main_business_consequence,
      linkAnalysis: `${row.event_path_summary} ${row.primary_driver}`,
      riskTitles: row.valid_risks.map((risk) => risk.title)
    });

    assert.equal(score.pass, true, row.id);
    assert.equal(score.primaryLensPass, true, row.id);
    assert.equal(score.invalidRiskLeakage, 0, row.id);
    assert.ok(score.anchorCoverage >= 0.25, row.id);
  });
});
