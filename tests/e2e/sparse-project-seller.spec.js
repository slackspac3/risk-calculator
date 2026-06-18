const { test, expect } = require('@playwright/test');
const {
  mockProjectExposureMap,
  seedAuthenticatedWorkspace
} = require('./helpers/apiMocks.js');
const {
  DEFAULT_E2E_ADMIN_SETTINGS,
  SPARSE_SELLER_USER,
  SPARSE_SELLER_USER_SETTINGS,
  buildSparseSellerExposureResponse
} = require('./helpers/projectFixtures.js');
const {
  continueToReviewAndRun,
  fillSparseSellerProjectIntake,
  generateProjectExposureMap,
  startSellerProjectAssessment
} = require('./helpers/wizardActions.js');
const {
  expectReviewAndRunProjectGap,
  expectSparseProjectExposurePanel,
  expectSparseSellerDraftState,
  expectSparseSellerExposurePayload
} = require('./helpers/sparseProjectAssertions.js');

test('seller project sparse intake carries unknown margin into Step 4 without turning it into zero', async ({ page }) => {
  const projectExposureRequests = [];
  await seedAuthenticatedWorkspace(page, {
    user: SPARSE_SELLER_USER,
    userSettings: SPARSE_SELLER_USER_SETTINGS,
    adminSettings: DEFAULT_E2E_ADMIN_SETTINGS,
    apiSessionToken: 'sparse-seller-project-test-token'
  });
  await mockProjectExposureMap(page, {
    requests: projectExposureRequests,
    responseFactory: buildSparseSellerExposureResponse
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  const active = await startSellerProjectAssessment(page, expect);
  await fillSparseSellerProjectIntake(active);
  const exposurePanel = await generateProjectExposureMap(active, expect, {
    scope: 'seller',
    missingLabel: /Gross margin/i,
    requestCount: () => projectExposureRequests.length
  });

  const exposurePayload = projectExposureRequests[0];
  expectSparseSellerExposurePayload(exposurePayload);
  await expectSparseProjectExposurePanel(exposurePanel, {
    driverLabel: /Margin at risk/i,
    suggestedQuestion: /What gross margin percentage is expected/i
  });

  const savedDraft = await page.waitForFunction(() => {
    const draft = (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null;
    if (draft?.projectExposure?.sourceMode === 'live') return draft;
    return null;
  });
  const savedDraftValue = await savedDraft.jsonValue();
  expectSparseSellerDraftState(savedDraftValue, { requireMeta: true, requireFingerprint: true });

  await continueToReviewAndRun(page, expect, exposurePanel);
  await expectReviewAndRunProjectGap(page, /Gross margin/i);

  const finalDraft = await page.evaluate(() => (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null);
  expectSparseSellerDraftState(finalDraft);
  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
