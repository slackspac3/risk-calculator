#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const notes = [];
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const nvmrc = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
const nodeVersionFile = fs.readFileSync(path.join(root, '.node-version'), 'utf8').trim();

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
const appRoutesJs = read('assets/appRoutes.js');
const exportJs = read('assets/services/exportService.js');
const llmJs = read('assets/services/llmService.js');
const benchmarkServiceJs = read('assets/services/benchmarkService.js');
const benchmarkData = read('data/benchmarks.json');
const settingsApi = read('api/settings.js');
const usersApi = read('api/users.js');
const authServiceJs = read('assets/services/authService.js');
const systemAccessSectionJs = read('assets/admin/systemAccessSection.js');
const resultsRouteJs = read('assets/results/resultsRoute.js');
const userPreferencesJs = read('assets/settings/userPreferences.js');
const userOnboardingJs = read('assets/settings/userOnboarding.js');
const assessmentStateJs = read('assets/state/assessmentState.js');
const assessmentLifecycleJs = read('assets/state/assessmentLifecycle.js');
const workspacePersistenceJs = read('assets/state/userWorkspacePersistence.js');
const appStateStoreJs = read('assets/state/appStateStore.js');
const workspaceStateModelJs = read('assets/state/workspaceStateModel.js');
const auditLogSectionJs = read('assets/admin/auditLogSection.js');
const demoModeJs = read('assets/demo/demoMode.js');
const e2eSmokeSpecJs = read('tests/e2e/smoke.spec.js');
const pagesWorkflow = read('.github/workflows/pages.yml');
const ciWorkflow = read('.github/workflows/ci.yml');
const releaseChecklist = read('RELEASE_CHECKLIST.md');
const rollbackPlaybook = read('ROLLBACK_PLAYBOOK.md');
const seededUsers = read('data/pilot-seed/bootstrap-accounts.sample.json');
const seededAssessments = read('data/pilot-seed/demo-assessments.sample.json');

const versions = extractAssetVersions(indexHtml);
expect(versions.length === 1, `Expected one frontend asset version, found: ${versions.join(', ') || 'none'}`);
expect(indexHtml.includes('window.__RISK_CALCULATOR_RELEASE__'), 'index.html is missing the release metadata bootstrap');
expect(nvmrc === '24', `.nvmrc must pin Node 24 for the pilot release flow. Found: ${nvmrc || 'empty'}`);
expect(nodeVersionFile === '24', `.node-version must pin Node 24 for the pilot release flow. Found: ${nodeVersionFile || 'empty'}`);
expect(appJs.includes('function getReleaseInfo()'), 'app.js is missing getReleaseInfo helper');
expect(appJs.includes('function getReleaseLabel()'), 'app.js is missing getReleaseLabel helper');
expect(appJs.includes('function isPilotOrStagingRelease()'), 'app.js is missing isPilotOrStagingRelease helper');
expect(appJs.includes('function getSessionLLMHealth()'), 'app.js is missing getSessionLLMHealth helper');
expect(appJs.includes('function maybeWarnPilotAiExpectation()'), 'app.js is missing maybeWarnPilotAiExpectation helper');
expect(String(packageJson.version || '').trim().length > 0, 'package.json must include an application version');
expect(String(packageJson.engines?.node || '').trim() === '>=24 <25', 'package.json engines.node must pin the supported Node major version.');
expect(appJs.includes(`const APP_ASSET_VERSION = '${versions[0] || ''}'`), 'app.js asset version does not match index.html asset version');
expect(indexHtml.includes('assets/services/reportPresentation.js'), 'index.html is missing reportPresentation.js');
expect(indexHtml.includes('assets/services/benchmarkService.js'), 'index.html is missing benchmarkService.js');
expect(indexHtml.includes('assets/admin/documentLibrarySection.js'), 'index.html is missing documentLibrarySection.js');
expect(indexHtml.includes('assets/admin/aiFeedbackSection.js'), 'index.html is missing aiFeedbackSection.js');
expect(indexHtml.indexOf('assets/services/reportPresentation.js') < indexHtml.indexOf('assets/services/exportService.js'), 'reportPresentation.js must load before exportService.js');
expect(indexHtml.indexOf('assets/services/reportPresentation.js') < indexHtml.indexOf('assets/app.js'), 'reportPresentation.js must load before app.js');
expect(indexHtml.includes('assets/state/workspaceStateModel.js'), 'index.html is missing workspaceStateModel.js');
expect(indexHtml.includes('assets/state/userWorkspacePersistence.js'), 'index.html is missing userWorkspacePersistence.js');
expect(indexHtml.includes('assets/state/assessmentLifecycle.js'), 'index.html is missing assessmentLifecycle.js');

expect(appJs.includes('function safeRenderAdminSettings('), 'safeRenderAdminSettings helper missing');
expect(appJs.includes('function rerenderCurrentAdminSection()'), 'rerenderCurrentAdminSection helper missing from admin renderer');
expect(appJs.includes('function normaliseAdminSettings('), 'frontend normaliseAdminSettings helper missing');
expect(appJs.includes('function getAiFeedbackTuningSettings('), 'frontend AI feedback tuning helper missing');
expect(appRoutesJs.includes("fallbackRoute === '/admin/home'"), 'appRoutes not-found handling is missing the admin-safe recovery target');
expect(appRoutesJs.includes("'/admin/settings/feedback'"), 'appRoutes is missing the admin feedback settings route');
expect(settingsApi.includes('function normaliseSettings('), 'backend normaliseSettings helper missing');
expect(appStateStoreJs.includes('function dispatchDraftAction('), 'appStateStore is missing draft action dispatch support');
expect(appStateStoreJs.includes('function dispatchSimulationAction('), 'appStateStore is missing simulation action dispatch support');

expect(llmJs.includes('function _withEvidenceMeta('), 'AI evidence wrapper missing');
expect(llmJs.includes('function getRuntimeStatus()'), 'LLM service is missing getRuntimeStatus helper');
expect(llmJs.includes('confidenceLabel'), 'AI evidence contract missing confidenceLabel');
expect(llmJs.includes('evidenceQuality'), 'AI evidence contract missing evidenceQuality');
expect(llmJs.includes('missingInformation'), 'AI evidence contract missing missingInformation');
expect(llmJs.includes('primaryGrounding'), 'AI evidence contract missing primaryGrounding');
expect(llmJs.includes('supportingReferences'), 'AI evidence contract missing supportingReferences');
expect(llmJs.includes('inferredAssumptions'), 'AI evidence contract missing inferredAssumptions');
expect(llmJs.includes('Structured numeric benchmarks:'), 'LLM prompts are missing structured numeric benchmark context');
expect(llmJs.includes('benchmarkReferences'), 'LLM output is not carrying benchmarkReferences');
expect(benchmarkServiceJs.includes('retrieveRelevantBenchmarks'), 'benchmark service is missing retrieveRelevantBenchmarks');
expect(benchmarkServiceJs.includes('deriveSuggestedInputs'), 'benchmark service is missing deriveSuggestedInputs');
expect(benchmarkServiceJs.includes('sourceTypeLabel'), 'benchmark service is missing sourceTypeLabel trust metadata');
expect(benchmarkServiceJs.includes('Recent source'), 'benchmark service is missing freshness trust labels');
expect(benchmarkData.includes('bm-databreach-global-ibm-2025'), 'benchmark dataset is missing global IBM 2025 breach profile');
expect(benchmarkData.includes('bm-ransomware-sophos-2024'), 'benchmark dataset is missing Sophos ransomware benchmark profile');
expect(benchmarkData.includes('bm-thirdparty-verizon-2025'), 'benchmark dataset is missing Verizon third-party benchmark profile');
expect(benchmarkData.includes('bm-exportcontrol-semiconductor-bis-2026'), 'benchmark dataset is missing semiconductor export-control benchmark profile');
expect(benchmarkData.includes('bm-industrial-ibm-2024'), 'benchmark dataset is missing industrial IBM benchmark profile');
expect(benchmarkServiceJs.includes("return 'export-control'"), 'benchmark service is missing export-control scenario detection');

expect(assessmentStateJs.includes('primaryGrounding'), 'assessmentState is not persisting primaryGrounding');
expect(assessmentStateJs.includes('supportingReferences'), 'assessmentState is not persisting supportingReferences');
expect(assessmentStateJs.includes('inferredAssumptions'), 'assessmentState is not persisting inferredAssumptions');
expect(assessmentStateJs.includes('benchmarkReferences'), 'assessmentState is not persisting benchmarkReferences');
expect(assessmentLifecycleJs.includes('ASSESSMENT_LIFECYCLE_STATUS'), 'assessmentLifecycle is missing lifecycle status constants');
expect(assessmentLifecycleJs.includes('transitionAssessmentLifecycle'), 'assessmentLifecycle is missing centralized transition rules');
expect(assessmentStateJs.includes('prepareAssessmentForSave'), 'assessmentState is not using lifecycle-aware assessment persistence');
expect(workspacePersistenceJs.includes('normaliseUserWorkspaceState'), 'userWorkspacePersistence is missing the workspace normalizer');
expect(workspacePersistenceJs.includes('savedAssessments'), 'userWorkspacePersistence is missing the savedAssessments bounded object');
expect(workspacePersistenceJs.includes('draftWorkspace'), 'userWorkspacePersistence is missing the draftWorkspace bounded object');
expect(assessmentStateJs.includes('persistSavedAssessmentsCollection'), 'assessmentState is not using the savedAssessments persistence helper');
expect(workspaceStateModelJs.includes('applyWorkspaceSyncStartedTransition'), 'workspace state model is missing explicit sync-start transition');
expect(workspaceStateModelJs.includes('applySimulationStartedTransition'), 'workspace state model is missing explicit simulation-start transition');

expect(usersApi.includes('Organisation assignment can only be changed by an admin.'), 'users API self-update scope restriction missing');
expect(usersApi.includes('await deleteUserState(removed.username);'), 'users API delete-user is not clearing shared user state');
expect(!authServiceJs.includes('businessUnitEntityId: payload.businessUnitEntityId'), 'authService self-update still sends businessUnitEntityId');
expect(!authServiceJs.includes('departmentEntityId: payload.departmentEntityId'), 'authService self-update still sends departmentEntityId');

expect(resultsRouteJs.includes('Confirm your organisation context'), 'results route is missing the updated organisation-context copy');
expect(resultsRouteJs.includes('const canChooseDepartment = capability.canManageBusinessUnit && !capability.canManageDepartment;'), 'results route is missing the aligned BU-admin-only department chooser guard');
expect(systemAccessSectionJs.includes('Pilot release diagnostics'), 'admin system access section is missing pilot release diagnostics');
expect(systemAccessSectionJs.includes('Pilot AI readiness'), 'admin system access section is missing pilot AI readiness guidance');
expect(!demoModeJs.includes("Router.navigate('/results');"), 'demo mode still navigates to the stale /results route');
expect(appJs.includes('href="#/admin/home">Platform Home</a>'), 'admin settings hard-failure fallback no longer points to platform home');

expect(userPreferencesJs.includes('Your business-unit and function assignment is controlled by your current role.'), 'user preferences role guidance is missing');
expect(userOnboardingJs.includes('Your organisation assignment is set by your current admin-managed role.'), 'user onboarding role guidance is missing');
expect(userPreferencesJs.includes('Pilot release:'), 'user preferences footer is missing the pilot release display');

expect(exportJs.includes('ReportPresentation.buildExecutiveScenarioSummary'), 'exportService is not using shared ReportPresentation summary helper');
expect(exportJs.includes('ReportPresentation.buildExecutiveThresholdModel'), 'exportService is not using shared ReportPresentation threshold helper');
expect(exportJs.includes('ReportPresentation.buildExecutiveDecisionSupport'), 'exportService is not using shared ReportPresentation decision helper');

expect(!appJs.includes("'${DEFAULT_COMPASS_PROXY_URL}'"), 'Literal DEFAULT_COMPASS_PROXY_URL placeholder leaked into app.js');
expect(!appJs.includes("Cannot access 'settings' before initialization"), 'Static error text leaked into app.js');
expect(appJs.includes('renderEvidenceDetails(supportingReferences'), 'supporting references evidence renderer missing');
expect(appJs.includes('renderEvidenceDetails(inferredAssumptions'), 'inferred assumptions evidence renderer missing');
expect(appJs.includes("route: typeof window !== 'undefined'"), 'runtime instrumentation is not capturing current route');
expect(appJs.includes('sourceTypeLabel || ref.sourceType'), 'benchmark reference UI is missing source type labels');
expect(appJs.includes('item.sourceTypeLabel'), 'input provenance UI is missing source type labels');
expect(auditLogSectionJs.includes('<th>Route</th>'), 'audit log runtime health table is missing route column');
expect(e2eSmokeSpecJs.includes('Unexpected page errors on'), 'Playwright smoke suite is not checking for client-side crashes');
expect(e2eSmokeSpecJs.includes('/#/results/example-assessment'), 'Playwright smoke suite is missing results-route coverage');
expect(e2eSmokeSpecJs.includes('pressing Enter signs in and opens the personal workspace'), 'Playwright smoke suite is missing Enter-to-login coverage');
expect(e2eSmokeSpecJs.includes('business-unit oversight dashboard prioritises review and context actions'), 'Playwright smoke suite is missing BU oversight dashboard coverage');
expect(e2eSmokeSpecJs.includes('authenticated admin shell renders without crashing'), 'Playwright smoke suite is missing authenticated admin coverage');
expect(e2eSmokeSpecJs.includes('admin AI feedback and tuning dashboard renders the signal view and tuning controls'), 'Playwright smoke suite is missing admin feedback dashboard coverage');
expect(e2eSmokeSpecJs.includes('authenticated admin document library renders without crashing'), 'Playwright smoke suite is missing admin document-library coverage');
expect(e2eSmokeSpecJs.includes('dashboard archive helpers move the assessment into archived items after the confirm modal opens'), 'Playwright smoke suite is missing dashboard archive state coverage');
expect(e2eSmokeSpecJs.includes('first-run onboarding can launch the sample assessment path'), 'Playwright smoke suite is missing first-run onboarding sample-path coverage');
expect(e2eSmokeSpecJs.includes('dashboard duplicate assessment creates a new editable draft'), 'Playwright smoke suite is missing dashboard duplicate-assessment coverage');
expect(e2eSmokeSpecJs.includes('wizard step 1 clear all keeps manually added risks unselected after rerender'), 'Playwright smoke suite is missing wizard clear-all coverage');
expect(e2eSmokeSpecJs.includes('admin can update user access and the request carries the expected role assignment'), 'Playwright smoke suite is missing admin role update coverage');
expect(ciWorkflow.includes('npm run check:syntax'), 'Pilot CI workflow is missing syntax checks');
expect(ciWorkflow.includes('npm run check:smoke'), 'Pilot CI workflow is missing smoke-check.js');
expect(ciWorkflow.includes('npm run test:e2e:smoke'), 'Pilot CI workflow is missing Playwright smoke coverage');
expect(ciWorkflow.includes('node-version-file: .nvmrc'), 'Pilot CI workflow must use the repo Node pin.');
expect(ciWorkflow.includes('actions/checkout@v6'), 'Pilot CI workflow must use actions/checkout@v6.');
expect(ciWorkflow.includes('actions/setup-node@v6'), 'Pilot CI workflow must use actions/setup-node@v6.');
expect(pagesWorkflow.includes('needs: validate'), 'Pages deployment is not blocked on validation');
expect(pagesWorkflow.includes('node-version-file: .nvmrc'), 'Pages workflow must use the repo Node pin.');
expect(pagesWorkflow.includes('actions/checkout@v6'), 'Pages workflow must use actions/checkout@v6.');
expect(pagesWorkflow.includes('actions/setup-node@v6'), 'Pages workflow must use actions/setup-node@v6.');
expect(releaseChecklist.includes('Confirm GitHub Actions `Pilot CI` is green'), 'Release checklist is missing CI confirmation');
expect(rollbackPlaybook.includes('Frontend Rollback: GitHub Pages'), 'Rollback playbook is missing frontend rollback guidance');
expect(rollbackPlaybook.includes('Backend Rollback: Vercel API'), 'Rollback playbook is missing backend rollback guidance');
expect(seededUsers.includes('"role": "admin"'), 'Bootstrap seed users file is missing the admin sample account');
expect(seededUsers.includes('"role": "user"'), 'Bootstrap seed users file is missing the standard-user sample account');
expect(seededAssessments.includes('"runMetadata"'), 'Sample assessments file is missing persisted run metadata');

if (!failures.length) {
  notes.push('Smoke check passed.');
  if (versions[0]) notes.push(`Asset version: ${versions[0]}`);
  notes.push(`Release version: ${packageJson.version}`);
  console.log(notes.join('\n'));
  process.exit(0);
}

console.error('Smoke check failed:');
for (const failure of failures) console.error(`- ${failure}`);
process.exit(1);
