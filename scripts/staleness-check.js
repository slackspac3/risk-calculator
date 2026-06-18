#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];
let passed = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function expect(condition, message) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(message);
}

function extractFunctionBody(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  let parenDepth = 0;
  let openBrace = -1;
  const firstParen = source.indexOf('(', start);
  if (firstParen < 0) return '';
  for (let index = firstParen; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;
    if (parenDepth === 0) {
      openBrace = source.indexOf('{', index);
      break;
    }
  }
  if (openBrace < 0) return '';
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, index);
    }
  }
  return '';
}

const step1Js = read('assets/wizard/step1.js');
const step1ProjectExposurePanelJs = read('assets/wizard/step1ProjectExposurePanel.js');
const step4Js = read('assets/wizard/step4.js');
const appJs = read('assets/app.js');
const assetLoaderJs = read('assets/services/assetLoader.js');
const aiProductStateJs = read('assets/services/aiProductStateService.js');
const resultsRouteJs = read('assets/results/resultsRoute.js');
const resultsViewModelJs = read('assets/results/resultsViewModel.js');
const assessmentStateJs = read('assets/state/assessmentState.js');
const e2eSmokeSpecJs = read('tests/e2e/smoke.spec.js');
const aiProductStateTestJs = read('tests/unit/aiProductStateService.test.js');
const step1ProjectExposureTestJs = read('tests/unit/step1ProjectExposurePanel.test.js');
const resultsViewModelDecisionBriefTestJs = read('tests/unit/resultsViewModelDecisionBrief.test.js');
const step4AiFreshnessTestJs = fs.existsSync(path.join(root, 'tests/unit/step4AiFreshness.test.js'))
  ? read('tests/unit/step4AiFreshness.test.js')
  : '';

expect(
  !/Object\.keys\(\s*(sessionStorage|localStorage)\s*\)/.test(e2eSmokeSpecJs),
  'E2E tests must not enumerate Web Storage with Object.keys(sessionStorage/localStorage); use Storage.length + Storage.key(index).'
);
expect(
  !/Object\.keys\(\s*store\s*\)/.test(e2eSmokeSpecJs),
  'E2E tests must not enumerate a Web Storage handle with Object.keys(store); use Storage.length + Storage.key(index).'
);

expect(
  e2eSmokeSpecJs.includes('wizard assessment type router stores selection before intake')
    && e2eSmokeSpecJs.includes('page.waitForFunction')
    && e2eSmokeSpecJs.includes("liveDraft?.assessmentType === 'project_buyer'")
    && e2eSmokeSpecJs.includes("savedDraftValue?.projectContext?.projectRole).toBe('buyer')"),
  'Assessment type router e2e coverage must wait for the live draft state to carry the selected type and project role.'
);

const selectAssessmentTypeBody = extractFunctionBody(step1Js, 'selectStep1AssessmentType');
expect(
  selectAssessmentTypeBody.includes('saveDraft();') && selectAssessmentTypeBody.indexOf('saveDraft();') < selectAssessmentTypeBody.indexOf('Router.navigate(nextRoute)'),
  'selectStep1AssessmentType must save the draft before routing to the next wizard screen.'
);
expect(
  selectAssessmentTypeBody.includes('applyAssessmentTypeSelectionToDraft(AppState.draft, targetType)')
    && selectAssessmentTypeBody.includes('projectRole'),
  'selectStep1AssessmentType must update assessment type and project role before persistence.'
);

const saveDraftBody = extractFunctionBody(assessmentStateJs, 'saveDraft');
expect(
  saveDraftBody.includes('sessionStorage.setItem(buildUserStorageKey(DRAFT_STORAGE_PREFIX)')
    && saveDraftBody.includes('buildSessionDraftPayload(AppState.draft, savedAt)'),
  'saveDraft must persist the current draft to the scoped session storage payload.'
);
expect(
  saveDraftBody.includes("window.dispatchEvent(new CustomEvent('rq:draft-saved'")
    && saveDraftBody.indexOf('sessionStorage.setItem') < saveDraftBody.indexOf("window.dispatchEvent(new CustomEvent('rq:draft-saved'"),
  'saveDraft must emit rq:draft-saved only after the browser storage write is attempted.'
);
expect(
  appJs.includes('function getCurrentWorkspaceUsername')
    && appJs.includes('AppState.currentUser?.username')
    && appJs.includes('AppState.userStateCache?.username')
    && appJs.includes('function buildUserStorageKey(prefix, username = \'\')')
    && appJs.includes('getCurrentWorkspaceUsername() || getCurrentUserOrThrow().username'),
  'Scoped browser storage keys must fall back to stable AppState workspace identity when the auth session read is transiently unavailable.'
);
expect(
  appJs.includes('function ensureUserStateCache(username = getCurrentWorkspaceUsername())')
    && appJs.includes('function queueSharedUserStateSync(patch = {}, username = getCurrentWorkspaceUsername(), options = {})'),
  'Draft cache and shared sync defaults must use the stable workspace username resolver.'
);
expect(
  fs.existsSync(path.join(root, 'tests/unit/assessmentState.test.js'))
    && read('tests/unit/assessmentState.test.js').includes('saveDraft persists the scoped session draft and detached cache snapshot')
    && read('tests/unit/assessmentState.test.js').includes("sessionStorage.getItem('rq_draft__alex.trafton')"),
  'Unit coverage must verify saveDraft writes the scoped browser-session payload.'
);
expect(
  assetLoaderJs.includes("aiProductState: 'assets/services/aiProductStateService.js'")
    && assetLoaderJs.includes('LOCAL_ASSETS.aiProductState')
    && assetLoaderJs.includes('LOCAL_ASSETS.resultsViewModel'),
  'AI product state helper must be loaded with wizard/results route bundles before freshness-aware UI renders.'
);
expect(
  aiProductStateJs.includes('buildAiOutputState')
    && aiProductStateJs.includes('buildFingerprintBreakdown')
    && aiProductStateJs.includes('buildProjectExposureFingerprintSnapshot')
    && aiProductStateJs.includes('buildAssumptionRegisterFingerprintSnapshot')
    && aiProductStateJs.includes('buildParameterCoachFingerprintSnapshot')
    && aiProductStateJs.includes('buildEvidenceMapFingerprintSnapshot')
    && aiProductStateJs.includes('buildDecisionChallengeFingerprintSnapshot')
    && aiProductStateJs.includes('buildDecisionBriefFingerprintSnapshot')
    && aiProductStateJs.includes('projectFinancialValues')
    && aiProductStateJs.includes('projectFinancialStatusSource')
    && aiProductStateJs.includes('projectFinancialNotes')
    && aiProductStateJs.includes('projectNarrativeContext')
    && aiProductStateJs.includes('buildDependencyOutputSnapshot')
    && aiProductStateJs.includes('AI_ARTIFACTS')
    && aiProductStateJs.includes('buildAiArtifactRecord')
    && aiProductStateJs.includes('saveAiArtifact')
    && aiProductStateJs.includes('currentFingerprint')
    && aiProductStateJs.includes('freshnessSeverity')
    && aiProductStateJs.includes('freshnessStatus')
    && aiProductStateJs.includes('stale'),
  'AI product state helper must expose shared category-aware snapshot builders and stale output detection.'
);
expect(
  aiProductStateJs.includes('ARTIFACT_USEFUL_PATHS')
    && aiProductStateJs.includes('decisionBrief')
    && aiProductStateJs.includes('parameterRationales')
    && aiProductStateJs.includes('supportedClaims'),
  'AI product state helper must use artefact-specific useful-output checks instead of metadata-only detection.'
);
expect(
  step1ProjectExposurePanelJs.includes('savedAiState?.freshnessStatus === \'stale\'')
    && step1Js.includes('buildProjectExposureFingerprintSnapshot')
    && step1Js.includes('inputFingerprintBreakdown')
    && step1ProjectExposurePanelJs.includes('Refresh exposure map'),
  'Step 1 project exposure UI must show a category-aware refresh prompt when the saved AI map is stale.'
);
expect(
  step4Js.includes('buildStep4ParameterCoachFingerprint')
    && step4Js.includes('buildStep4EvidenceMapFingerprint')
    && step4Js.includes('buildStep4ParameterCoachFingerprintBreakdown')
    && step4Js.includes('buildStep4EvidenceMapFingerprintBreakdown')
    && step4Js.includes('buildParameterCoachFingerprintSnapshot')
    && step4Js.includes('buildEvidenceMapFingerprintSnapshot')
    && step4Js.includes('buildAiArtifactRecord')
    && step4Js.includes('inputFingerprintBreakdown')
    && step4Js.includes('inputFingerprint'),
  'Step 4 AI review outputs must persist input fingerprint breakdowns for stale Parameter Coach and Evidence Map detection.'
);
expect(
  resultsViewModelJs.includes('buildProjectExposureFingerprintSnapshot')
    && resultsViewModelJs.includes('buildParameterCoachFingerprintSnapshot')
    && resultsViewModelJs.includes('buildEvidenceMapFingerprintSnapshot')
    && resultsViewModelJs.includes('buildDecisionBriefFingerprintSnapshot')
    && resultsViewModelJs.includes('simulationResult'),
  'Results view model must use shared snapshot builders for category-level current fingerprints.'
);
expect(
  resultsRouteJs.includes('buildResultsAiArtifactMeta')
    && resultsRouteJs.includes('buildAiArtifactMeta')
    && resultsRouteJs.includes('decisionBriefMeta')
    && resultsRouteJs.includes('decisionChallengeMeta'),
  'Results AI actions must use the shared AI artifact meta helper for Decision Brief and Challenge Agent persistence.'
);
expect(
  resultsRouteJs.includes('summaryLabel')
    && resultsRouteJs.includes('ai-product-state-strip__details')
    && resultsRouteJs.includes('View AI support details'),
  'Results AI journey strip must default to a compact summary with expandable artefact details.'
);
expect(
  aiProductStateTestJs.includes('project financial value changes as critical stale')
    && aiProductStateTestJs.includes('project narrative-only changes as non-critical stale')
    && aiProductStateTestJs.includes('project financial status/source metadata as critical stale')
    && aiProductStateTestJs.includes('project financial note-only metadata changes as informational stale')
    && aiProductStateTestJs.includes('ignores dependency timestamp churn')
    && aiProductStateTestJs.includes('AI artifact registry exposes labels')
    && aiProductStateTestJs.includes('AI artifact persistence helper writes canonical metadata')
    && aiProductStateTestJs.includes('breakdowns even when flat fingerprint is absent'),
  'AI product state unit tests must cover granular project categories, sanitized dependencies, breakdown-only freshness, and flat fingerprint compatibility.'
);
expect(
  step1ProjectExposureTestJs.includes('project financial values')
    && step1ProjectExposureTestJs.includes('live AI result persists category fingerprint breakdown')
    && step1ProjectExposureTestJs.includes('Refresh Project exposure map'),
  'Step 1 project exposure tests must cover live fingerprint persistence and stale project financial value refresh prompts.'
);
expect(
  step4AiFreshnessTestJs.includes('Parameter Coach is critical-stale after FAIR parameter changes')
    && step4AiFreshnessTestJs.includes('Evidence Map is review-stale after evidence changes')
    && step4AiFreshnessTestJs.includes('parameters changed')
    && step4AiFreshnessTestJs.includes('evidence changed'),
  'Step 4 tests must cover Parameter Coach critical stale and Evidence Map review stale UI behavior.'
);
expect(
  resultsViewModelDecisionBriefTestJs.includes('Decision Brief critical-stale after simulation result changes')
    && resultsViewModelDecisionBriefTestJs.includes('simulation result changed'),
  'Results view model tests must cover Decision Brief stale reason after simulation result changes.'
);

if (failures.length) {
  console.error('Staleness guardrails failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Staleness guardrails passed. ${passed} checks passed.`);
