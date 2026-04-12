#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
let checks = 0;

function expect(condition, label) {
  checks++;
  if (!condition) failures.push(label);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function has(content, pattern) {
  return pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern);
}

const sectionAPaths = [
  'index.html',
  'assets/app.js',
  'assets/router.js',
  'assets/appRoutes.js',
  'assets/scenarios.js',
  'assets/share.js',
  'assets/engine/riskEngine.js',
  'assets/engine/riskEngineWorker.js',
  'assets/wizard/step1.js',
  'assets/wizard/step2.js',
  'assets/wizard/step3.js',
  'assets/wizard/step1Assist.js',
  'assets/results/resultsRoute.js',
  'assets/results/resultsViewModel.js',
  'assets/results/resultsTabs.js',
  'assets/dashboard/userDashboard.js',
  'assets/services/llmService.js',
  'assets/services/exportService.js',
  'assets/services/reportPresentation.js',
  'assets/services/ragService.js',
  'assets/services/authService.js',
  'assets/services/authGuards.js',
  'assets/services/aiGuardrails.js',
  'assets/services/benchmarkService.js',
  'assets/services/structuredScenarioModel.js',
  'assets/services/orgIntelligenceService.js',
  'assets/services/sharedStateClient.js',
  'assets/services/valueQuantService.js',
  'assets/services/notificationService.js',
  'assets/state/appStateStore.js',
  'assets/state/assessmentState.js',
  'assets/state/assessmentLifecycle.js',
  'assets/state/draftScenarioState.js',
  'assets/state/learningStore.js',
  'assets/state/workspaceStateModel.js',
  'assets/state/userWorkspacePersistence.js',
  'assets/state/llmResponseExtractor.js',
  'assets/state/orgCapabilityState.js',
  'assets/state/registerWorkbookSelector.js',
  'assets/settings/userPreferences.js',
  'assets/settings/userOnboarding.js',
  'assets/demo/demoMode.js',
  'assets/admin/adminHomeSection.js',
  'assets/admin/adminSettingsSection.js',
  'assets/admin/adminCompanyContextController.js',
  'assets/admin/userAccountsSection.js',
  'assets/admin/orgSetupSection.js',
  'assets/admin/systemAccessSection.js',
  'assets/admin/platformDefaultsSection.js',
  'assets/admin/auditLogSection.js',
  'assets/admin/documentLibrarySection.js',
  'api/compass.js',
  'api/users.js',
  'api/settings.js',
  'api/user-state.js',
  'api/company-context.js',
  'api/review-queue.js',
  'api/audit-log.js',
  'api/org-intelligence.js',
  'api/_apiAuth.js',
  'api/_audit.js',
  'api/_kvStore.js',
  'api/_passwordPolicy.js',
  'data/benchmarks.json',
  'data/bu.json',
  'data/docs.json',
  'data/pilot-seed/bootstrap-accounts.sample.json',
  'data/pilot-seed/demo-assessments.sample.json',
  'data/pilot-seed/demo-user-state.sample.json',
  '.env.example',
  '.nvmrc',
  '.node-version',
  'vercel.json',
  'playwright.config.js',
  'RELEASE_CHECKLIST.md',
  'ROLLBACK_PLAYBOOK.md',
  'AGENTS.md',
  'scripts/run-playwright-static.js',
  'tests/fixtures/eval/g42_eval_master_repaired.jsonl',
  'scripts/run-eval-local.js',
  'scripts/run-eval-ai.js',
  'scripts/harvest-eval-growth-candidates.js',
  'scripts/check-eval-thresholds.js',
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml'
];

sectionAPaths.forEach((rel) => {
  expect(exists(rel), `[A] Missing file: ${rel}`);
});

const sectionAHasMissing = sectionAPaths.some((rel) => !exists(rel));

let pkg = null;
let nvmrc = '';
let nodeVersion = '';
if (!sectionAHasMissing) {
  pkg = JSON.parse(read('package.json'));
  nvmrc = read('.nvmrc').trim();
  nodeVersion = read('.node-version').trim();
}

if (!sectionAHasMissing) {
  expect(nvmrc === '24', '[B] .nvmrc must pin Node 24');
  expect(nodeVersion === '24', '[B] .node-version must pin Node 24');
  expect(String(pkg.engines?.node || '').includes('24'), '[B] package.json engines.node must reference Node 24');
  expect(String(pkg.version || '').trim().length > 0, '[B] package.json must include a version');
}

if (!sectionAHasMissing) {
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  [
    'check:syntax',
    'check:smoke',
    'qa:release',
    'test:unit',
    'test:e2e:smoke',
    'test:e2e',
    'test:eval:fixture',
    'eval:local',
    'eval:ai',
    'eval:harvest',
    'release:pilot'
  ].forEach((key) => {
    expect(key in scripts, `[C] package.json missing script: ${key}`);
  });
  expect(String(scripts['test:e2e'] || '').includes('run-playwright-static.js'), '[C] test:e2e must use the managed static-server Playwright runner');
  expect(String(scripts['test:e2e:smoke'] || '').includes('run-playwright-static.js'), '[C] test:e2e:smoke must use the managed static-server Playwright runner');
}

const engineJs = exists('assets/engine/riskEngine.js') ? read('assets/engine/riskEngine.js') : '';
const workerJs = exists('assets/engine/riskEngineWorker.js') ? read('assets/engine/riskEngineWorker.js') : '';
expect(/monteCarlo|MonteCarlo|simulation/i.test(engineJs), '[D] riskEngine.js: Monte Carlo simulation not found');
expect(/mulberry32|Mulberry32|seeded.*prng|prng/i.test(engineJs), '[D] riskEngine.js: seeded PRNG (Mulberry32) not found');
expect(/lognormal|triangular|FAIR|lef\b|LEF/i.test(engineJs), '[D] riskEngine.js: FAIR-style distribution not found');
expect(/onmessage|postMessage|self\./i.test(workerJs), '[D] riskEngineWorker.js: worker messaging not found');

const usersApi = exists('api/users.js') ? read('api/users.js') : '';
expect(/\badmin\b/.test(usersApi), '[E] users.js: admin (global admin) role not found');
expect(/bu_admin|buAdmin/.test(usersApi), '[E] users.js: bu_admin role not found');
expect(/function_admin|functionAdmin/.test(usersApi), '[E] users.js: function_admin role not found');
expect(usersApi.includes("'user'"), '[E] users.js: user (standard) role not found');

const reviewQueueJs = exists('api/review-queue.js') ? read('api/review-queue.js') : '';
expect(reviewQueueJs.includes('pending'), '[F] review-queue.js: pending state not found');
expect(reviewQueueJs.includes('approved'), '[F] review-queue.js: approved state not found');
expect(/changes_requested|changesRequested|changes requested/.test(reviewQueueJs), '[F] review-queue.js: changes_requested state not found');
expect(reviewQueueJs.includes('escalated'), '[F] review-queue.js: escalated state not found');

const feedbackSrc = (exists('assets/state/learningStore.js') ? read('assets/state/learningStore.js') : '')
  + (exists('assets/services/orgIntelligenceService.js') ? read('assets/services/orgIntelligenceService.js') : '');
expect(/wrong_domain|wrongDomain|wrong domain/.test(feedbackSrc), '[G] Feedback tag "wrong domain" not found');
expect(feedbackSrc.includes('too-generic'), '[G] Feedback tag "too-generic" not found');
expect(feedbackSrc.includes('missed-key-risk'), '[G] Feedback tag "missed-key-risk" not found');
expect(/included-unrelated-risks|unrelated-risks/.test(feedbackSrc), '[G] Feedback tag for unrelated risks not found');
expect(feedbackSrc.includes('weak-citations'), '[G] Feedback tag "weak-citations" not found');
expect(/useful_with_edits|usefulWithEdits|useful with edits/.test(feedbackSrc), '[G] Feedback tag "useful with edits" not found');

const llmJs = exists('assets/services/llmService.js') ? read('assets/services/llmService.js') : '';
[
  'confidenceLabel',
  'evidenceQuality',
  'missingInformation',
  'primaryGrounding',
  'supportingReferences',
  'inferredAssumptions',
  'benchmarkReferences'
].forEach((field) => {
  expect(llmJs.includes(field), `[H] llmService.js missing evidence field: ${field}`);
});

const exportJs = exists('assets/services/exportService.js') ? read('assets/services/exportService.js') : '';
expect(/\bpdf\b|\bPDF\b/.test(exportJs), '[I] exportService.js: PDF export not found');
expect(/\bjson\b|\bJSON\b/.test(exportJs), '[I] exportService.js: JSON export not found');
expect(/memo|decisionMemo|decision_memo/.test(exportJs), '[I] exportService.js: decision memo not found');
expect(/board|boardNote|board_note/.test(exportJs), '[I] exportService.js: board note not found');

const companyCtxJs = exists('api/company-context.js') ? read('api/company-context.js') : '';
expect(/ssrf|SSRF|allowedHost|allowList|isAllowed|localhost/.test(companyCtxJs), '[J] company-context.js: SSRF guard not found');
const apiAuthJs = exists('api/_apiAuth.js') ? read('api/_apiAuth.js') : '';
expect(/x-session-token|validateSession|requireSession|SESSION_SIGNING_SECRET/.test(apiAuthJs), '[J] _apiAuth.js: session auth not found');
const passwordSrc = (exists('api/users.js') ? read('api/users.js') : '') + (exists('api/_passwordPolicy.js') ? read('api/_passwordPolicy.js') : '');
expect(/hash|bcrypt|pbkdf2|crypto\./.test(passwordSrc), '[J] users.js/_passwordPolicy.js: password hashing not found');
const auditLogJs = exists('api/audit-log.js') ? read('api/audit-log.js') : '';
expect(auditLogJs.trim().length > 50, '[J] audit-log.js: file appears empty');

const evalLocalJs = exists('scripts/run-eval-local.js') ? read('scripts/run-eval-local.js') : '';
expect(/stub|mode/.test(evalLocalJs), '[K] run-eval-local.js: --mode stub|live flag not found');

const seedAccounts = exists('data/pilot-seed/bootstrap-accounts.sample.json') ? read('data/pilot-seed/bootstrap-accounts.sample.json') : '';
expect(/admin/.test(seedAccounts), '[L] bootstrap-accounts.sample.json: admin account not found');
const seedAssessments = exists('data/pilot-seed/demo-assessments.sample.json') ? read('data/pilot-seed/demo-assessments.sample.json') : '';
expect(/runMetadata|scenario/.test(seedAssessments), '[L] demo-assessments.sample.json: expected content not found');

if (failures.length === 0) {
  console.log(`README scan passed. ${checks} checks passed.`);
} else {
  console.error('\nREADME scan failures:');
  failures.forEach((f) => console.error('  FAIL:', f));
  console.error(`\nREADME scan failed: ${failures.length} of ${checks} checks failed.`);
  process.exit(1);
}
