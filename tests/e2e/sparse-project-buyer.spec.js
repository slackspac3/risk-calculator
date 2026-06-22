const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

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
const { appRoute } = require('./helpers/appUrl.js');
const {
  expectReviewAndRunProjectGap,
  expectSparseBuyerDraftState,
  expectSparseBuyerExposurePayload,
  expectSparseProjectExposurePanel
} = require('./helpers/sparseProjectAssertions.js');

function buildStaleBuyerProjectExposureDraft() {
  return {
    assessmentType: 'project_buyer',
    step1Path: 'guided',
    buId: '',
    buName: 'G42',
    geography: 'United Arab Emirates',
    guidedInput: {
      event: 'The implementation partner may miss the go-live date for a customer onboarding platform.',
      impact: 'Delayed customer launch, operational workarounds, and replacement supplier pressure.',
      cause: '',
      asset: '',
      urgency: 'medium'
    },
    projectContext: {
      projectName: 'Customer onboarding platform rollout',
      projectRole: 'buyer',
      projectStage: 'Implementation',
      projectDescription: '',
      currency: 'USD',
      projectDurationMonths: null,
      criticalMilestoneDate: '',
      strategicImportance: 'unknown'
    },
    projectRouteDetails: {
      supplierName: 'Implementation partner',
      mainConsequence: 'Go-live is delayed and the team may need to replace the supplier.'
    },
    buyerEconomics: {
      expectedSpend: null,
      approvedBudget: 1000000,
      delayCostPerDay: null
    },
    buyerEconomicsMeta: {
      approvedBudget: { status: 'known', confidence: 'high', source: 'user', note: '' },
      delayCostPerDay: { status: 'unknown', confidence: 'unknown', source: 'not_provided', note: '' }
    },
    buyerProxyQuestions: {
      mainImpact: 'delay',
      likelyDelay: 'weeks',
      supplierReplacementDifficulty: 'hard',
      contractualRecoveries: 'unknown',
      moneyPaidCommitted: 'unknown',
      criticalPath: 'yes'
    },
    sellerEconomics: {},
    sellerEconomicsMeta: {},
    sellerProxyQuestions: {},
    projectExposure: {
      sourceMode: 'live',
      inputFingerprint: 'stale-saved-project-exposure',
      inputFingerprintBreakdown: {
        fingerprint: 'stale-saved-project-exposure',
        categories: {
          projectFinancialValues: 'previous-project-financial-values'
        }
      },
      generatedAt: '2026-06-10T00:00:00.000Z',
      usedFallback: false,
      aiUnavailable: false,
      valuationMode: 'hybrid',
      projectExposureSummary: 'Previous live map.',
      projectInputQuality: {
        score: 36,
        label: 'Thin project economics',
        knownHighImpactInputs: ['Approved budget'],
        estimatedHighImpactInputs: [],
        unknownHighImpactInputs: ['Delay cost per day']
      },
      financialDrivers: [
        {
          id: 'buyer-delay-cost',
          label: 'Delay cost',
          driverStatus: 'unquantified_driver',
          likely: null,
          missingInputs: ['delayCostPerDay']
        }
      ],
      capsAndOffsets: [],
      doubleCountingWarnings: [],
      missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }],
      mapsToRiskParameters: {}
    },
    citations: [],
    step1LlmContext: []
  };
}

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

test('buyer project exposure map flags a stale live map after project economics change', async ({ page }) => {
  const projectExposureRequests = [];
  await seedAuthenticatedWorkspace(page, {
    user: SPARSE_BUYER_USER,
    userSettings: SPARSE_BUYER_USER_SETTINGS,
    adminSettings: DEFAULT_E2E_ADMIN_SETTINGS,
    draft: buildStaleBuyerProjectExposureDraft(),
    apiSessionToken: 'stale-project-exposure-test-token'
  });
  await mockProjectExposureMap(page, {
    requests: projectExposureRequests,
    responseFactory: buildSparseBuyerExposureResponse
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(appRoute('/#/wizard/2'));
  const active = page.locator('.app-stage-shell.is-current');
  await expect(active.locator('.step1-route-inputs--buyer')).toBeVisible({ timeout: 10000 });
  const exposurePanel = active.locator('[data-project-exposure-panel="buyer"]');
  await expect(exposurePanel).toContainText(/Needs refresh/i);
  await expect(exposurePanel).toContainText(/Refresh Project exposure map/i);
  await expect(exposurePanel).toContainText(/project financial values/i);
  await expect(exposurePanel.locator('[data-project-exposure-action="generate"]')).toContainText(/Refresh exposure map/i);

  await exposurePanel.locator('[data-project-exposure-action="generate"]').click();
  await expect.poll(() => projectExposureRequests.length).toBeGreaterThan(0);
  expectSparseBuyerExposurePayload(projectExposureRequests[0]);
  await expect(exposurePanel).toContainText(/Live AI/i);
  await expect(exposurePanel).toContainText(/Fresh/i);
  await expect(exposurePanel).not.toContainText(/Needs refresh/i);

  const finalDraft = await page.evaluate(() => (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null);
  expectSparseBuyerDraftState(finalDraft, { requireMeta: true, requireFingerprint: true });
  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
