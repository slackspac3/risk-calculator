#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const notes = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function extractAssetVersions(indexHtml) {
  const matches = [...indexHtml.matchAll(/assets\/[^"']+\?v=([A-Za-z0-9]+)/g)].map(match => match[1]);
  return [...new Set(matches)];
}

const indexHtml = read('index.html');
const appJs = read('assets/app.js');
const exportJs = read('assets/services/exportService.js');
const llmJs = read('assets/services/llmService.js');
const settingsApi = read('api/settings.js');

const versions = extractAssetVersions(indexHtml);
expect(versions.length === 1, `Expected one frontend asset version, found: ${versions.join(', ') || 'none'}`);
expect(indexHtml.includes('assets/services/reportPresentation.js'), 'index.html is missing reportPresentation.js');
expect(indexHtml.indexOf('assets/services/reportPresentation.js') < indexHtml.indexOf('assets/services/exportService.js'), 'reportPresentation.js must load before exportService.js');
expect(indexHtml.indexOf('assets/services/reportPresentation.js') < indexHtml.indexOf('assets/app.js'), 'reportPresentation.js must load before app.js');

expect(appJs.includes('function safeRenderAdminSettings('), 'safeRenderAdminSettings helper missing');
expect(appJs.includes('function rerenderCurrentAdminSection()'), 'rerenderCurrentAdminSection helper missing from admin renderer');
expect(appJs.includes('function normaliseAdminSettings('), 'frontend normaliseAdminSettings helper missing');
expect(settingsApi.includes('function normaliseSettings('), 'backend normaliseSettings helper missing');

expect(llmJs.includes('function _withEvidenceMeta('), 'AI evidence wrapper missing');
expect(llmJs.includes('confidenceLabel'), 'AI evidence contract missing confidenceLabel');
expect(llmJs.includes('evidenceQuality'), 'AI evidence contract missing evidenceQuality');
expect(llmJs.includes('missingInformation'), 'AI evidence contract missing missingInformation');

expect(exportJs.includes('ReportPresentation.buildExecutiveScenarioSummary'), 'exportService is not using shared ReportPresentation summary helper');
expect(exportJs.includes('ReportPresentation.buildExecutiveThresholdModel'), 'exportService is not using shared ReportPresentation threshold helper');
expect(exportJs.includes('ReportPresentation.buildExecutiveDecisionSupport'), 'exportService is not using shared ReportPresentation decision helper');

expect(!appJs.includes("'${DEFAULT_COMPASS_PROXY_URL}'"), 'Literal DEFAULT_COMPASS_PROXY_URL placeholder leaked into app.js');
expect(!appJs.includes("Cannot access 'settings' before initialization"), 'Static error text leaked into app.js');

if (!failures.length) {
  notes.push('Smoke check passed.');
  if (versions[0]) notes.push(`Asset version: ${versions[0]}`);
  console.log(notes.join('\n'));
  process.exit(0);
}

console.error('Smoke check failed:');
for (const failure of failures) console.error(`- ${failure}`);
process.exit(1);
