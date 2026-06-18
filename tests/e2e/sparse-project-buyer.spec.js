const { test, expect } = require('@playwright/test');
const {
  mockProjectExposureMap,
  seedAuthenticatedWorkspace
} = require('./helpers/apiMocks.js');
const {
  DEFAULT_E2E_ADMIN_SETTINGS,
  SPARSE_BUYER_USER,
  SPARSE_BUYER_USER_SETTINGS,
  buildSparseBuyerExposureResponse
} = require('./helpers/projectFixtures.js');
const {
  continueToReviewAndRun,
  fillSparseBuyerProjectIntake,
  generateProjectExposureMap,
  startBuyerProjectAssessment
} = require('./helpers/wizardActions.js');
const {
  expectReviewAndRunProjectGap,
  expectSparseBuyerDraftState,
  expectSparseBuyerExposurePayload,
  expectSparseProjectExposurePanel
} = require('./helpers/sparseProjectAssertions.js');

test('buyer project sparse intake carries unknown financial values into Step 4 without turning them into zero', async ({ page }) => {
  const projectExposureRequests = [];
  await seedAuthenticatedWorkspace(page, {
    user: SPARSE_BUYER_USER,
    userSettings: SPARSE_BUYER_USER_SETTINGS,
    adminSettings: DEFAULT_E2E_ADMIN_SETTINGS,
    apiSessionToken: 'sparse-project-test-token'
  });
  await mockProjectExposureMap(page, {
    requests: projectExposureRequests,
    responseFactory: buildSparseBuyerExposureResponse
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const active = await startBuyerProjectAssessment(page, expect);
  await fillSparseBuyerProjectIntake(active);
  const exposurePanel = await generateProjectExposureMap(active, expect, {
    requestCount: () => projectExposureRequests.length
  });

  const exposurePayload = projectExposureRequests[0];
  expectSparseBuyerExposurePayload(exposurePayload);
  await expectSparseProjectExposurePanel(exposurePanel);

  const savedDraft = await page.waitForFunction(() => {
    const draft = (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null;
    if (draft?.projectExposure?.sourceMode === 'live') return draft;
    return null;
  });
  const savedDraftValue = await savedDraft.jsonValue();
  expectSparseBuyerDraftState(savedDraftValue, { requireMeta: true, requireFingerprint: true });

  await continueToReviewAndRun(page, expect, exposurePanel);
  await expectReviewAndRunProjectGap(page, /Delay cost/i);

  const finalDraft = await page.evaluate(() => (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null);
  expectSparseBuyerDraftState(finalDraft);
  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
