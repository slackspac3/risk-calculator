'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DOMAIN_TO_HINT_KEY = Object.freeze({
  Financial: 'financial',
  'Fraud / Integrity': 'fraud-integrity',
  Procurement: 'procurement',
  'Supply Chain': 'supply-chain',
  'Third-Party': 'third-party',
  Regulatory: 'regulatory',
  Compliance: 'compliance',
  'Legal / Contract': 'legal-contract',
  Strategic: 'strategic',
  Operational: 'operational',
  'Business Continuity': 'business-continuity',
  Cyber: 'cyber',
  'Data Governance / Privacy': 'data-governance',
  'AI / Model Risk': 'ai-model-risk',
  ESG: 'esg',
  HSE: 'hse',
  'People / Workforce': 'people-workforce',
  'Physical Security': 'physical-security',
  'OT / Industrial Resilience': 'ot-resilience',
  'Geopolitical / Market Access': 'geopolitical',
  'Transformation Delivery': 'transformation-delivery',
  'Investment / JV': 'investment-jv'
});

const DEFAULT_DATASET_PATH = path.resolve(__dirname, '../../../tests/fixtures/eval/g42_eval_master_repaired.jsonl');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'by', 'for', 'from', 'if',
  'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'them',
  'there', 'this', 'to', 'was', 'were', 'with', 'within'
]);

function loadEvalDataset(filePath = DEFAULT_DATASET_PATH) {
  const absPath = path.resolve(filePath);
  const raw = fs.readFileSync(absPath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${absPath}:${index + 1} — ${error.message}`);
      }
    });
}

function normaliseLensKey(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = Object.entries(DOMAIN_TO_HINT_KEY).find(([label, key]) => (
    raw.toLowerCase() === label.toLowerCase() || raw.toLowerCase() === key.toLowerCase()
  ));
  if (direct) return direct[1];
  return raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normaliseLensLabel(value = '') {
  const key = normaliseLensKey(value);
  return Object.keys(DOMAIN_TO_HINT_KEY).find((label) => DOMAIN_TO_HINT_KEY[label] === key) || String(value || '').trim();
}

function tokenise(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token));
}

function toTokenSet(value = '') {
  return new Set(tokenise(value));
}

function scoreTokenOverlap(left = '', right = '') {
  const leftTokens = toTokenSet(left);
  const rightTokens = toTokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function buildEvalInput(row) {
  const geography = Array.isArray(row?.scenario_context?.geography)
    ? row.scenario_context.geography.filter(Boolean)
    : [];
  const regulatoryOverlay = Array.isArray(row?.scenario_context?.regulatory_overlay)
    ? row.scenario_context.regulatory_overlay.filter(Boolean)
    : [];
  const operatingContext = String(row?.scenario_context?.operating_context || '').trim();
  const functionName = String(row?.scenario_context?.function || 'Enterprise').trim() || 'Enterprise';
  const geographyLabel = geography.join(', ');
  const benchmarkStrategy = 'Prefer UAE and GCC comparators where credible, then fall back to the closest global enterprise benchmark with explicit explanation.';
  return {
    riskStatement: String(row?.scenario_text || '').trim(),
    registerText: '',
    guidedInput: {
      event: String(row?.event_path_summary || '').trim(),
      asset: functionName,
      cause: String(row?.primary_driver || '').trim(),
      impact: String(row?.main_business_consequence || '').trim(),
      urgency: row?.difficulty === 'hard' ? 'high' : 'medium'
    },
    businessUnit: {
      id: normaliseLensKey(row?.expected_primary_lens || row?.domain || functionName),
      name: functionName,
      geography: geographyLabel,
      regulatoryTags: regulatoryOverlay,
      criticalServices: [],
      dataTypes: [],
      benchmarkStrategy,
      scenarioLensHint: normaliseLensKey(row?.expected_primary_lens || row?.domain),
      userProfileSummary: operatingContext,
      companyStructureContext: operatingContext
    },
    geography: geographyLabel,
    applicableRegulations: regulatoryOverlay,
    citations: [],
    adminSettings: {
      benchmarkStrategy,
      userProfileSummary: operatingContext,
      companyStructureContext: operatingContext,
      aiInstructions: 'Keep the generated draft and shortlist tightly aligned to the explicit scenario event path.'
    },
    scenarioLensHint: normaliseLensKey(row?.expected_primary_lens || row?.domain),
    priorMessages: []
  };
}

function extractRiskTitles(risks = []) {
  return (Array.isArray(risks) ? risks : [])
    .map((risk) => {
      if (typeof risk === 'string') return risk.trim();
      if (risk && typeof risk === 'object') {
        return String(risk.title || risk.name || risk.label || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function extractOutputSummary(result = {}) {
  const primaryLens = normaliseLensKey(result?.scenarioLens?.key || result?.scenarioLens?.label || result?.scenarioLens);
  const secondaryKeys = Array.isArray(result?.scenarioLens?.secondaryKeys)
    ? result.scenarioLens.secondaryKeys.map((value) => normaliseLensKey(value)).filter(Boolean)
    : [];
  const riskTitles = extractRiskTitles(result?.risks || []);
  return {
    scenarioTitle: String(result?.scenarioTitle || '').trim(),
    primaryLens,
    primaryLensLabel: normaliseLensLabel(primaryLens || result?.scenarioLens?.label || result?.scenarioLens?.key || ''),
    secondaryLensKeys: Array.from(new Set(secondaryKeys)),
    draftNarrative: String(result?.draftNarrative || result?.enhancedStatement || '').trim(),
    summary: String(result?.summary || '').trim(),
    linkAnalysis: String(result?.linkAnalysis || '').trim(),
    riskTitles,
    usedFallback: !!result?.usedFallback,
    confidenceLabel: String(result?.confidenceLabel || '').trim()
  };
}

function scoreRiskSet(generatedTexts = [], expectedRisks = [], threshold = 0.34) {
  const details = [];
  let hits = 0;
  for (const risk of expectedRisks) {
    const expectedText = [risk?.title || '', risk?.why_valid || risk?.why_invalid || ''].filter(Boolean).join(' ');
    const best = generatedTexts
      .map((generated) => ({ generated, score: scoreTokenOverlap(generated, expectedText) }))
      .sort((left, right) => right.score - left.score)[0] || { generated: '', score: 0 };
    const matched = best.score >= threshold;
    if (matched) hits += 1;
    details.push({
      title: String(risk?.title || '').trim(),
      matched,
      bestGenerated: best.generated,
      score: Number(best.score.toFixed(3))
    });
  }
  return {
    hits,
    total: expectedRisks.length,
    rate: expectedRisks.length ? Number((hits / expectedRisks.length).toFixed(3)) : 0,
    details
  };
}

function scoreAnchorCoverage(row, output) {
  const haystack = [
    output?.scenarioTitle,
    output?.draftNarrative,
    output?.summary,
    output?.linkAnalysis,
    ...(output?.riskTitles || [])
  ].join(' ').toLowerCase();
  const anchors = Array.isArray(row?.key_anchor_terms) ? row.key_anchor_terms : [];
  const hits = anchors.filter((term) => term && haystack.includes(String(term).toLowerCase()));
  return {
    hits,
    total: anchors.length,
    rate: anchors.length ? Number((hits.length / anchors.length).toFixed(3)) : 0
  };
}

function scoreGeneratedScenario(row, output) {
  const expectedPrimary = normaliseLensKey(row?.expected_primary_lens || row?.domain);
  const acceptableSecondary = new Set(
    (Array.isArray(row?.acceptable_secondary_lenses) ? row.acceptable_secondary_lenses : [])
      .map((value) => normaliseLensKey(value))
      .filter(Boolean)
  );
  const predictedSecondary = Array.isArray(output?.secondaryLensKeys) ? output.secondaryLensKeys : [];
  const generatedRiskTexts = (output?.riskTitles || []).map((title) => String(title || '').trim()).filter(Boolean);
  const validRiskScore = scoreRiskSet(generatedRiskTexts, row?.valid_risks || [], 0.34);
  const invalidRiskScore = scoreRiskSet(generatedRiskTexts, row?.invalid_risks || [], 0.38);
  const anchorCoverage = scoreAnchorCoverage(row, output);
  const invalidLeakage = invalidRiskScore.hits;
  const secondaryPenalty = predictedSecondary.filter((key) => !acceptableSecondary.has(key)).length;
  const primaryLensPass = output?.primaryLens === expectedPrimary;
  const secondaryLensPrecision = predictedSecondary.length
    ? Number(((predictedSecondary.length - secondaryPenalty) / predictedSecondary.length).toFixed(3))
    : 1;
  const pass = primaryLensPass
    && validRiskScore.rate >= 0.34
    && invalidLeakage === 0
    && anchorCoverage.rate >= 0.25
    && secondaryPenalty === 0;
  return {
    pass,
    primaryLensPass,
    expectedPrimaryLens: expectedPrimary,
    predictedPrimaryLens: output?.primaryLens || '',
    secondaryLensPrecision,
    validRiskRecall: validRiskScore.rate,
    invalidRiskLeakage: invalidLeakage,
    invalidRiskLeakageRate: generatedRiskTexts.length
      ? Number((invalidLeakage / generatedRiskTexts.length).toFixed(3))
      : 0,
    anchorCoverage: anchorCoverage.rate,
    anchorHits: anchorCoverage.hits,
    validRiskMatches: validRiskScore.details,
    invalidRiskMatches: invalidRiskScore.details
  };
}

function summariseScenarioScores(records = []) {
  const totals = {
    total: records.length,
    passed: 0,
    primaryLensPass: 0,
    avgSecondaryLensPrecision: 0,
    avgValidRiskRecall: 0,
    avgInvalidRiskLeakageRate: 0,
    avgAnchorCoverage: 0,
    fallbackRuns: 0
  };
  if (!records.length) return totals;
  for (const record of records) {
    if (record?.deterministic?.pass) totals.passed += 1;
    if (record?.deterministic?.primaryLensPass) totals.primaryLensPass += 1;
    if (record?.actual?.usedFallback) totals.fallbackRuns += 1;
    totals.avgSecondaryLensPrecision += Number(record?.deterministic?.secondaryLensPrecision || 0);
    totals.avgValidRiskRecall += Number(record?.deterministic?.validRiskRecall || 0);
    totals.avgInvalidRiskLeakageRate += Number(record?.deterministic?.invalidRiskLeakageRate || 0);
    totals.avgAnchorCoverage += Number(record?.deterministic?.anchorCoverage || 0);
  }
  totals.passRate = Number((totals.passed / records.length).toFixed(3));
  totals.primaryLensAccuracy = Number((totals.primaryLensPass / records.length).toFixed(3));
  totals.avgSecondaryLensPrecision = Number((totals.avgSecondaryLensPrecision / records.length).toFixed(3));
  totals.avgValidRiskRecall = Number((totals.avgValidRiskRecall / records.length).toFixed(3));
  totals.avgInvalidRiskLeakageRate = Number((totals.avgInvalidRiskLeakageRate / records.length).toFixed(3));
  totals.avgAnchorCoverage = Number((totals.avgAnchorCoverage / records.length).toFixed(3));
  totals.fallbackRate = Number((totals.fallbackRuns / records.length).toFixed(3));
  return totals;
}

function filterDataset(rows, options = {}) {
  const ids = new Set(
    String(options.ids || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  let filtered = Array.isArray(rows) ? rows.slice() : [];
  if (ids.size) {
    filtered = filtered.filter((row) => ids.has(String(row?.id || '').trim()));
  }
  const limit = Number(options.limit || 0);
  if (Number.isFinite(limit) && limit > 0) {
    filtered = filtered.slice(0, limit);
  }
  return filtered;
}

module.exports = {
  DEFAULT_DATASET_PATH,
  DOMAIN_TO_HINT_KEY,
  loadEvalDataset,
  normaliseLensKey,
  normaliseLensLabel,
  buildEvalInput,
  extractOutputSummary,
  scoreGeneratedScenario,
  summariseScenarioScores,
  filterDataset
};
