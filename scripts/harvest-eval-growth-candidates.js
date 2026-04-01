'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { normaliseLensLabel, normaliseLensKey } = require('./eval/lib/scenarioEval.js');

function parseArgs(argv) {
  const args = {
    output: path.resolve(process.cwd(), 'test-results/eval/eval-growth-candidates.jsonl'),
    inputs: []
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--output' && argv[index + 1]) {
      args.output = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--output=')) {
      args.output = token.split('=')[1];
      continue;
    }
    args.inputs.push(token);
  }
  return args;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function isAssessmentLike(value) {
  return value
    && typeof value === 'object'
    && (
      value.scenarioTitle
      || value.narrative
      || value.enhancedNarrative
      || value.structuredScenario
      || value.results
      || value.selectedRisks
    );
}

function collectAssessmentLikeObjects(value, sourceLabel, results = [], seen = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectAssessmentLikeObjects(item, sourceLabel, results, seen);
    return results;
  }
  if (!value || typeof value !== 'object') return results;
  if (isAssessmentLike(value)) {
    const key = [
      sourceLabel,
      value.id || value.assessmentId || '',
      value.completedAt || value.updatedAt || '',
      value.scenarioTitle || ''
    ].join('::');
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ sourceLabel, assessment: value });
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      collectAssessmentLikeObjects(nested, sourceLabel, results, seen);
    }
  }
  return results;
}

function buildScenarioText(assessment = {}) {
  const narrative = String(
    assessment.narrative
    || assessment.enhancedNarrative
    || assessment.draftNarrative
    || ''
  ).trim();
  if (narrative) return narrative;
  const structured = assessment.structuredScenario || {};
  return [
    structured.assetService,
    structured.primaryDriver,
    structured.eventPath,
    structured.effect
  ].filter(Boolean).join('. ');
}

function extractRiskTitles(assessment = {}) {
  const sources = [
    assessment.selectedRisks,
    assessment.risks,
    assessment.recommendedRisks
  ];
  const titles = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const risk of source) {
      const title = typeof risk === 'string'
        ? risk.trim()
        : String(risk?.title || risk?.name || risk?.label || '').trim();
      if (title) titles.push(title);
    }
    if (titles.length) break;
  }
  return Array.from(new Set(titles)).slice(0, 8);
}

function buildSignals(assessment = {}, scenarioText = '') {
  const signals = [];
  const aiAlignmentScore = Number(assessment?.aiAlignment?.score);
  if (Number.isFinite(aiAlignmentScore) && aiAlignmentScore < 65) {
    signals.push(`low_ai_alignment:${aiAlignmentScore}`);
  }
  const confidenceLabel = String(assessment?.confidenceLabel || '').toLowerCase();
  if (confidenceLabel.includes('low')) {
    signals.push(`low_confidence:${assessment.confidenceLabel}`);
  }
  const challengeCount = Array.isArray(assessment?.challengeRecords)
    ? assessment.challengeRecords.length
    : (Array.isArray(assessment?.openChallenges) ? assessment.openChallenges.length : 0);
  if (challengeCount > 0) {
    signals.push(`reviewer_challenges:${challengeCount}`);
  }
  const manualRiskCount = (Array.isArray(assessment?.selectedRisks) ? assessment.selectedRisks : [])
    .filter((risk) => risk && typeof risk === 'object' && (risk.manual || risk.source === 'manual'))
    .length;
  if (manualRiskCount > 0) {
    signals.push(`manual_scope_override:${manualRiskCount}`);
  }
  const title = String(assessment?.scenarioTitle || '').trim();
  if (title && scenarioText) {
    const titleTokens = new Set(title.toLowerCase().split(/\W+/).filter(Boolean));
    const narrativeTokens = new Set(scenarioText.toLowerCase().split(/\W+/).filter(Boolean));
    let shared = 0;
    for (const token of titleTokens) {
      if (narrativeTokens.has(token)) shared += 1;
    }
    if (titleTokens.size && shared / titleTokens.size < 0.25) {
      signals.push('title_narrative_drift');
    }
  }
  return signals;
}

function buildCandidate(entry) {
  const assessment = entry.assessment || {};
  const scenarioText = buildScenarioText(assessment);
  const signals = buildSignals(assessment, scenarioText);
  if (!scenarioText || !signals.length) return null;
  const geography = Array.isArray(assessment?.scenarioGeographies)
    ? assessment.scenarioGeographies
    : (Array.isArray(assessment?.geography) ? assessment.geography : [assessment?.geography].filter(Boolean));
  const regulations = Array.isArray(assessment?.applicableRegulations) ? assessment.applicableRegulations : [];
  const lensKey = normaliseLensKey(assessment?.scenarioLens?.key || assessment?.scenarioLens?.label || assessment?.scenarioLens || '');
  return {
    sourceFile: entry.sourceLabel,
    sourceAssessmentId: String(assessment.id || assessment.assessmentId || '').trim(),
    completedAt: Number(assessment.completedAt || assessment.updatedAt || 0),
    scenarioTitle: String(assessment.scenarioTitle || '').trim(),
    scenarioText,
    expectedPrimaryLensCandidate: normaliseLensLabel(lensKey || assessment?.domain || ''),
    geography,
    regulatoryOverlay: regulations,
    selectedRiskTitles: extractRiskTitles(assessment),
    signals,
    candidatePriority: signals.some((signal) => signal.startsWith('reviewer_challenges') || signal.startsWith('low_ai_alignment'))
      ? 'high'
      : (signals.length >= 2 ? 'medium' : 'low'),
    reasonSummary: 'Captured from real user interaction because the assessment showed drift, low confidence, manual override, or reviewer challenge signals and is a good candidate for future eval-set expansion.'
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.inputs.length) {
    throw new Error('Pass one or more exported workspace or assessment JSON files.');
  }
  const candidates = [];
  for (const input of args.inputs) {
    const absPath = path.resolve(input);
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    const assessmentEntries = collectAssessmentLikeObjects(parsed, absPath);
    for (const entry of assessmentEntries) {
      const candidate = buildCandidate(entry);
      if (candidate) candidates.push(candidate);
    }
  }
  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const dedupeKey = `${candidate.expectedPrimaryLensCandidate}::${candidate.scenarioText.slice(0, 180)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(candidate);
  }
  ensureParentDir(args.output);
  fs.writeFileSync(
    path.resolve(args.output),
    deduped.map((candidate) => JSON.stringify(candidate)).join('\n') + (deduped.length ? '\n' : '')
  );
  console.log(JSON.stringify({
    outputPath: path.resolve(args.output),
    harvested: deduped.length
  }, null, 2));
}

main();
