'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { extractLlmTextResponse } = require('../assets/state/llmResponseExtractor.js');

function parseArgs(argv) {
  const args = {
    report: path.resolve(process.cwd(), 'test-results/eval/local-eval-report.json'),
    output: path.resolve(process.cwd(), 'test-results/eval/ai-judge-report.json'),
    scope: 'failures',
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
    if (key === 'report') args.report = value;
    if (key === 'output') args.output = value;
    if (key === 'scope') args.scope = String(value || 'failures').trim().toLowerCase();
    if (key === 'limit') args.limit = Number(value || 0);
    if (key === 'ids') args.ids = String(value || '');
  }
  return args;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function resolveJudgeConfig() {
  return {
    apiUrl: process.env.RC_COMPASS_API_URL || process.env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions',
    apiKey: process.env.RC_COMPASS_API_KEY || process.env.COMPASS_API_KEY || '',
    model: process.env.RC_COMPASS_MODEL || process.env.COMPASS_MODEL || 'gpt-5.1'
  };
}

function extractJsonFromLlmResponse(raw = '') {
  const text = String(raw || '').trim();
  const fenceMatch = text.match(/```(?:json)?\s*\r?\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) return candidate;
  }
  const objectMatch = text.match(/(\{[\s\S]*\})/);
  if (objectMatch) return objectMatch[1].trim();
  return text;
}

function selectRows(report, args) {
  const ids = new Set(
    String(args.ids || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  let rows = Array.isArray(report.scenarios) ? report.scenarios.slice() : [];
  if (args.scope !== 'all') {
    rows = rows.filter((row) => !row?.deterministic?.pass);
  }
  if (ids.size) {
    rows = rows.filter((row) => ids.has(String(row?.id || '').trim()));
  }
  if (Number.isFinite(args.limit) && args.limit > 0) {
    rows = rows.slice(0, args.limit);
  }
  return rows;
}

async function callJudgeModel(config, systemPrompt, userPrompt) {
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      max_completion_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`AI judge request failed with ${response.status}`);
  }
  const payload = await response.json();
  const text = extractLlmTextResponse(payload);
  if (!text) {
    throw new Error('AI judge returned an unusable response payload.');
  }
  return JSON.parse(extractJsonFromLlmResponse(text));
}

function buildJudgePrompts(row) {
  const systemPrompt = [
    'You are scoring outputs from an enterprise risk scenario builder.',
    'Use the gold expectation to decide whether the system stayed on the same event path.',
    'Be strict about primary-lens drift, invalid-risk leakage, and shortlist coherence.',
    'Return JSON only.'
  ].join(' ');
  const userPrompt = `Score this scenario output for a G42-like enterprise risk benchmark.

Gold scenario:
${JSON.stringify({
  id: row.id,
  domain: row.domain,
  difficulty: row.difficulty,
  expected: row.expected
}, null, 2)}

System output:
${JSON.stringify(row.actual, null, 2)}

Deterministic score:
${JSON.stringify(row.deterministic, null, 2)}

Return valid JSON with this schema:
{
  "primaryLensPass": true,
  "shortlistCoherencePass": true,
  "draftCoherencePass": true,
  "secondaryLensDiscipline": "pass|mixed|fail",
  "validRiskPrecision": 0.0,
  "invalidRiskLeakage": 0.0,
  "severity": "low|medium|high",
  "rationale": "string",
  "suggestedFix": "string"
}`;
  return { systemPrompt, userPrompt };
}

function summariseJudgments(records = []) {
  const summary = {
    judged: records.length,
    primaryLensPassRate: 0,
    shortlistCoherencePassRate: 0,
    draftCoherencePassRate: 0,
    avgValidRiskPrecision: 0,
    avgInvalidRiskLeakage: 0,
    severityCounts: {
      low: 0,
      medium: 0,
      high: 0
    }
  };
  if (!records.length) return summary;
  for (const record of records) {
    const judge = record.aiJudge || {};
    if (judge.primaryLensPass) summary.primaryLensPassRate += 1;
    if (judge.shortlistCoherencePass) summary.shortlistCoherencePassRate += 1;
    if (judge.draftCoherencePass) summary.draftCoherencePassRate += 1;
    summary.avgValidRiskPrecision += Number(judge.validRiskPrecision || 0);
    summary.avgInvalidRiskLeakage += Number(judge.invalidRiskLeakage || 0);
    if (judge.severity && Object.prototype.hasOwnProperty.call(summary.severityCounts, judge.severity)) {
      summary.severityCounts[judge.severity] += 1;
    }
  }
  summary.primaryLensPassRate = Number((summary.primaryLensPassRate / records.length).toFixed(3));
  summary.shortlistCoherencePassRate = Number((summary.shortlistCoherencePassRate / records.length).toFixed(3));
  summary.draftCoherencePassRate = Number((summary.draftCoherencePassRate / records.length).toFixed(3));
  summary.avgValidRiskPrecision = Number((summary.avgValidRiskPrecision / records.length).toFixed(3));
  summary.avgInvalidRiskLeakage = Number((summary.avgInvalidRiskLeakage / records.length).toFixed(3));
  return summary;
}

async function main() {
  const args = parseArgs(process.argv);
  const config = resolveJudgeConfig();
  if (!config.apiKey) {
    throw new Error('AI judge requires RC_COMPASS_API_KEY or COMPASS_API_KEY.');
  }
  const report = JSON.parse(fs.readFileSync(path.resolve(args.report), 'utf8'));
  const rows = selectRows(report, args);
  if (!rows.length) {
    throw new Error('No rows selected for AI judging. Use --scope all or pass a report with deterministic failures.');
  }
  const judged = [];
  for (const row of rows) {
    const prompts = buildJudgePrompts(row);
    const aiJudge = await callJudgeModel(config, prompts.systemPrompt, prompts.userPrompt);
    judged.push({
      id: row.id,
      domain: row.domain,
      deterministic: row.deterministic,
      actual: row.actual,
      aiJudge
    });
  }
  const result = {
    generatedAt: new Date().toISOString(),
    reportPath: path.resolve(args.report),
    outputPath: path.resolve(args.output),
    scope: args.scope,
    summary: summariseJudgments(judged),
    scenarios: judged
  };
  ensureParentDir(args.output);
  fs.writeFileSync(path.resolve(args.output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    outputPath: result.outputPath,
    scope: result.scope,
    judged: judged.length,
    summary: result.summary
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
