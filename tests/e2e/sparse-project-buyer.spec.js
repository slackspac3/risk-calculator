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
  expect(exposurePayload.assessmentType).toBe('project_buyer');
  expect(exposurePayload.buyerEconomics.approvedBudget).toBe(1000000);
  expect(exposurePayload.buyerEconomics.delayCostPerDay ?? null).toBeNull();
  expect(exposurePayload.buyerEconomicsMeta.delayCostPerDay?.status || 'unknown').toBe('unknown');
  expect(exposurePayload.buyerProxyAnswers.likelyDelay).toBe('weeks');
  expect(exposurePayload.buyerProxyAnswers.supplierReplacementDifficulty).toBe('hard');
  expect(JSON.stringify(exposurePayload.buyerEconomics)).not.toContain('"delayCostPerDay":0');

  await expect(exposurePanel).toContainText(/Live AI/i);
  await expect(exposurePanel).toContainText(/Thin project economics/i);
  await expect(exposurePanel).toContainText(/Unknown/i);
  await expect(exposurePanel).toContainText(/Delay cost/i);
  await expect(exposurePanel).toContainText(/What is the approximate business cost per day/i);
  await expect(exposurePanel).not.toContainText(/\$0\b/);

  const savedDraft = await page.waitForFunction(() => {
    const draft = (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null;
    if (draft?.projectExposure?.sourceMode === 'live') return draft;
    return null;
  });
  const savedDraftValue = await savedDraft.jsonValue();
  expect(savedDraftValue.buyerEconomics.delayCostPerDay).toBeNull();
  expect(savedDraftValue.buyerEconomicsMeta.delayCostPerDay.status).toBe('unknown');
  expect(savedDraftValue.projectExposure.financialDrivers.find(driver => driver.id === 'buyer-delay-cost').likely).toBeNull();
  expect(savedDraftValue.projectExposure.inputFingerprintBreakdown?.categories?.projectFinancialValues).toBeTruthy();

  await continueToReviewAndRun(page, expect, exposurePanel);

  const projectFairPanel = page.locator('details').filter({ hasText: /Project financial exposure and FAIR parameters/i }).first();
  await expect(projectFairPanel).toBeVisible({ timeout: 10000 });
  await projectFairPanel.evaluate(node => {
    node.open = true;
  });
  await expect(projectFairPanel).toContainText(/Parameter gap/i);
  await expect(projectFairPanel).toContainText(/Delay cost/i);
  await expect(projectFairPanel).toContainText(/Not quantified/i);
  await expect(projectFairPanel).toContainText(/not treated as zero/i);

  const finalDraft = await page.evaluate(() => (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null);
  expect(finalDraft.buyerEconomics.delayCostPerDay).toBeNull();
  expect(finalDraft.projectExposure.financialDrivers.find(driver => driver.id === 'buyer-delay-cost').likely).toBeNull();
  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
