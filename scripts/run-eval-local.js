'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_COMPASS_MODEL } = require('../api/_aiRuntime.js');
const {
  DEFAULT_DATASET_PATH,
  loadEvalDataset,
  buildEvalInput,
  buildEvalRetrievalQuery,
  extractOutputSummary,
  scoreGeneratedScenario,
  scoreRetrievalQuality,
  summariseScenarioScores,
  filterDataset
} = require('./eval/lib/scenarioEval.js');
const {
  runProjectDecisionEvalFixtures
} = require('./eval/lib/projectDecisionEval.js');
const { loadBrowserLlmService } = require('./eval/lib/loadBrowserLlmService.js');
const { loadBrowserRagService } = require('./eval/lib/loadBrowserRagService.js');

function parseArgs(argv) {
  const args = {
    dataset: DEFAULT_DATASET_PATH,
    output: path.resolve(process.cwd(), 'test-results/eval/local-eval-report.json'),
    mode: 'stub',
    limit: 0,
    ids: ''
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [rawKey, inlineValue] = token.split('=');
    const key = rawKey.slice(2);
    const value = inlineValue != null ? inlineValue : argv[index + 1];
    if (inlineValue == null && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      index += 1;
    }
    if (key === 'dataset') args.dataset = value;
    if (key === 'output') args.output = value;
    if (key === 'mode') args.mode = String(value || 'stub').trim().toLowerCase();
    if (key === 'limit') args.limit = Number(value || 0);
    if (key === 'ids') args.ids = String(value || '');
  }
  return args;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function resolveLiveCompassConfig() {
  return {
    apiUrl: process.env.RC_COMPASS_API_URL || process.env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions',
    apiKey: process.env.RC_COMPASS_API_KEY || process.env.COMPASS_API_KEY || '',
    model: process.env.RC_COMPASS_MODEL || process.env.COMPASS_MODEL || DEFAULT_COMPASS_MODEL
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const dataset = filterDataset(loadEvalDataset(args.dataset), args);
  if (!dataset.length) {
    throw new Error('No evaluation rows selected. Check --dataset, --ids, or --limit.');
  }

  const liveMode = args.mode === 'live';
  const llmService = loadBrowserLlmService({
    fastTimers: !liveMode,
    origin: 'http://127.0.0.1:8080',
    apiOrigin: 'http://127.0.0.1:8080'
  });
  const ragService = loadBrowserRagService();
  if (liveMode) {
    const liveConfig = resolveLiveCompassConfig();
    if (!liveConfig.apiKey) {
      throw new Error('Live evaluation requires RC_COMPASS_API_KEY or COMPASS_API_KEY.');
    }
    llmService.setCompassConfig(liveConfig);
  } else {
    llmService.setCompassConfig({
      apiUrl: 'https://api.core42.ai/v1/chat/completions',
      apiKey: '',
      model: DEFAULT_COMPASS_MODEL
    });
  }

  const scenarios = [];
  for (const row of dataset) {
    const input = buildEvalInput(row);
    const generated = await llmService.enhanceRiskContext(input);
    const actual = extractOutputSummary(generated);
    const deterministic = scoreGeneratedScenario(row, actual);
    const retrievalQuery = buildEvalRetrievalQuery(row);
    const retrievedCitations = await ragService.retrieveRelevantDocs('g42', retrievalQuery, 5);
    const retrieval = scoreRetrievalQuality(row, retrievedCitations.map((citation) => citation?.docId));
    scenarios.push({
      id: row.id,
      domain: row.domain,
      difficulty: row.difficulty,
      expected: {
        primaryLens: row.expected_primary_lens,
        acceptableSecondaryLenses: row.acceptable_secondary_lenses,
        validRisks: row.valid_risks.map((risk) => risk.title),
        invalidRisks: row.invalid_risks.map((risk) => risk.title),
        keyAnchorTerms: row.key_anchor_terms
      },
      actual,
      deterministic,
      retrieval: {
        ...retrieval,
        citations: retrievedCitations.map((citation) => ({
          docId: citation.docId,
          title: citation.title,
          score: Number(Number(citation.score || 0).toFixed(3))
        }))
      }
    });
  }

  const summary = summariseScenarioScores(scenarios);
  const projectDecisionSupport = runProjectDecisionEvalFixtures();
  summary.projectDecisionSupportPassRate = projectDecisionSupport.summary.passRate;
  summary.projectDecisionSupportDimensionPassRate = projectDecisionSupport.summary.dimensionPassRate;
  summary.projectDecisionSupportCases = projectDecisionSupport.summary.total;
  const report = {
    generatedAt: new Date().toISOString(),
    datasetPath: path.resolve(args.dataset),
    outputPath: path.resolve(args.output),
    mode: liveMode ? 'live' : 'stub',
    summary,
    projectDecisionSupport,
    scenarios
  };
  ensureParentDir(args.output);
  fs.writeFileSync(path.resolve(args.output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    outputPath: report.outputPath,
    mode: report.mode,
    evaluated: scenarios.length,
    summary
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
