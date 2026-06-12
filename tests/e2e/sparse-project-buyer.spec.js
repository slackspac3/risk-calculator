const { test, expect } = require('@playwright/test');
const {
  applyUserWorkspacePatch,
  normaliseUserWorkspaceState
} = require('../../assets/state/userWorkspacePersistence.js');

function buildSession(user) {
  return {
    authenticated: true,
    ts: Date.now(),
    user,
    apiSessionToken: 'sparse-project-test-token',
    context: {}
  };
}

const USER = {
  username: 'sparse.project.buyer',
  displayName: 'Sparse Buyer Tester',
  role: 'user',
  businessUnitEntityId: '',
  departmentEntityId: ''
};

const USER_SETTINGS = {
  userProfile: {
    fullName: 'Sparse Buyer Tester',
    jobTitle: 'Risk Manager',
    businessUnit: 'G42',
    department: 'Risk',
    focusAreas: ['Project risk'],
    preferredOutputs: 'Decision summaries',
    workingContext: 'Validate sparse project economics without false precision.'
  },
  onboardedAt: '2026-06-12T00:00:00.000Z',
  _overrideKeys: []
};

const ADMIN_SETTINGS = {
  geography: 'United Arab Emirates',
  applicableRegulations: ['UAE PDPL'],
  entityContextLayers: [],
  companyStructure: [],
  aiInstructions: 'Use British English.',
  benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
  typicalDepartments: ['Risk'],
  _meta: { revision: 1, updatedAt: Date.now() }
};

function buildSparseExposureResponse() {
  return {
    mode: 'live',
    usedFallback: false,
    aiUnavailable: false,
    generatedAt: '2026-06-12T08:00:00.000Z',
    trace: { traceLabel: 'Buyer project exposure map' },
    projectExposure: {
      valuationMode: 'hybrid',
      projectExposureSummary: 'Buyer project exposure maps delay and supplier replacement as relevant, but the delay cost and reprocurement premium remain unknown.',
      projectInputQuality: {
        score: 36,
        label: 'Thin project economics',
        knownHighImpactInputs: ['Approved budget'],
        estimatedHighImpactInputs: [],
        unknownHighImpactInputs: ['Delay cost per day', 'Reprocurement premium %', 'Contractual recovery cap'],
        canProceed: true,
        recommendedNextInput: {
          field: 'delayCostPerDay',
          why: 'Delay cost is needed before the delay exposure can be quantified.',
          whoMightKnow: 'Project controls or finance business partner',
          suggestedQuestion: 'What is the approximate business cost per day if the supplier misses the go-live date?'
        }
      },
      financialDrivers: [
        {
          id: 'buyer-delay-cost',
          label: 'Delay cost',
          driverType: 'delay',
          driverStatus: 'unquantified_driver',
          formula: '',
          low: null,
          likely: null,
          high: null,
          mapsTo: 'businessInterruption',
          confidence: 'low',
          source: 'unknown',
          missingInputs: ['delayCostPerDay'],
          rationale: 'Delay appears relevant from the proxy answers, but the daily delay cost is unknown and is not treated as zero.'
        },
        {
          id: 'buyer-reprocurement-premium',
          label: 'Supplier replacement premium',
          driverType: 'reprocurement',
          driverStatus: 'unquantified_driver',
          formula: '',
          low: null,
          likely: null,
          high: null,
          mapsTo: 'thirdParty',
          confidence: 'low',
          source: 'unknown',
          missingInputs: ['remainingSpend', 'reprocurementPremiumPct'],
          rationale: 'Replacement is hard, but remaining spend and premium percentage are still unknown.'
        }
      ],
      capsAndOffsets: [],
      doubleCountingWarnings: [
        'Do not treat total project spend as automatic loss.',
        'Do not treat unknown recovery as zero recovery.'
      ],
      missingInputs: [
        {
          field: 'delayCostPerDay',
          label: 'Delay cost per day',
          importance: 'high',
          whyItMatters: 'This controls whether delay is a minor inconvenience or a material project exposure.',
          whoMightKnow: 'Project controls or finance business partner',
          suggestedQuestion: 'What is the approximate business cost per day if the supplier misses the go-live date?',
          mapsTo: 'businessInterruption'
        },
        {
          field: 'reprocurementPremiumPct',
          label: 'Reprocurement premium %',
          importance: 'high',
          whyItMatters: 'This is needed before supplier replacement can be quantified without using total project spend as loss.',
          whoMightKnow: 'Procurement or commercial owner',
          suggestedQuestion: 'If this supplier had to be replaced, what premium would a replacement likely charge?',
          mapsTo: 'thirdParty'
        }
      ],
      mapsToRiskParameters: {
        businessInterruption: ['buyer-delay-cost'],
        thirdParty: ['buyer-reprocurement-premium']
      }
    }
  };
}

async function seedAndMock(page, { projectExposureRequests }) {
  let storedState = normaliseUserWorkspaceState({
    userSettings: USER_SETTINGS,
    assessments: [],
    learningStore: { templates: {} },
    draft: null,
    _meta: { revision: 1, updatedAt: Date.now() }
  });

  await page.addInitScript(({ session, userSettings, adminSettings }) => {
    sessionStorage.setItem('rq_auth_session', JSON.stringify(session));
    localStorage.setItem(`rq_user_settings__${session.user.username}`, JSON.stringify(userSettings));
    localStorage.setItem('rq_admin_settings', JSON.stringify(adminSettings));
  }, {
    session: buildSession(USER),
    userSettings: USER_SETTINGS,
    adminSettings: ADMIN_SETTINGS
  });

  await page.route('**/api/users**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: [], storage: { writable: true, mode: 'shared-kv' } })
    });
  });

  await page.route('**/api/user-state*', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: storedState })
      });
      return;
    }

    let payload = {};
    try {
      payload = request.postDataJSON() || {};
    } catch {}

    if (request.method() === 'PATCH' && payload && typeof payload.patch === 'object') {
      storedState = normaliseUserWorkspaceState({
        ...applyUserWorkspacePatch(storedState, payload.patch),
        _meta: {
          revision: Number(storedState?._meta?.revision || 0) + 1,
          updatedAt: Date.now()
        }
      });
    } else if (request.method() === 'PUT' && payload && typeof payload.state === 'object') {
      storedState = normaliseUserWorkspaceState({
        ...payload.state,
        _meta: {
          revision: Number(storedState?._meta?.revision || 0) + 1,
          updatedAt: Date.now()
        }
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: storedState })
    });
  });

  await page.route('**/api/settings', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ settings: ADMIN_SETTINGS })
    });
  });

  await page.route('**/api/ai/status*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'live',
        providerReachable: true,
        model: 'gpt-5.1',
        proxyConfigured: true,
        checkedAt: Date.now()
      })
    });
  });

  await page.route('**/api/ai/project-exposure-map', async route => {
    const payload = route.request().postDataJSON();
    projectExposureRequests.push(payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSparseExposureResponse())
    });
  });

  await page.route('**/api/audit-log*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(route.request().method() === 'GET' ? { entries: [], summary: { total: 0 } } : { ok: true })
    });
  });

  await page.route('**/api/org-intelligence', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        patterns: [],
        calibration: { updatedAt: 0, scenarioTypes: {} },
        decisions: [],
        coverageMap: { updatedAt: 0, scenarioTypes: {} },
        feedback: { updatedAt: 0, events: [] }
      })
    });
  });
}

test('buyer project sparse intake carries unknown financial values into Step 4 without turning them into zero', async ({ page }) => {
  const projectExposureRequests = [];
  await seedAndMock(page, { projectExposureRequests });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/#/wizard/1');
  await page.waitForLoadState('networkidle');

  const current = page.locator('.app-stage-shell.is-current');
  await expect(page.getByRole('heading', { name: /what are you assessing/i })).toBeVisible({ timeout: 10000 });
  await current.locator('[data-assessment-type="project_buyer"]').click();
  await expect(page).toHaveURL(/#\/wizard\/2$/);

  const active = page.locator('.app-stage-shell.is-current');
  await expect(active.locator('.step1-route-inputs--buyer')).toBeVisible({ timeout: 10000 });
  await active.locator('#guided-event').fill('The implementation partner may miss the go-live date for a customer onboarding platform.');
  await active.locator('#guided-impact').fill('Delayed customer launch, operational workarounds, and replacement supplier pressure.');
  await active.locator('#project-name').fill('Customer onboarding platform rollout');
  await active.locator('#project-supplier').fill('Implementation partner');
  await active.locator('#project-stage').fill('Implementation');
  await active.locator('#project-main-consequence').fill('Go-live is delayed and the team may need to replace the supplier.');
  await active.locator('#step1-buyer-approvedBudget').fill('1000000');
  await active.locator('#step1-buyer-proxy-mainImpact').selectOption('delay');
  await active.locator('#step1-buyer-proxy-likelyDelay').selectOption('weeks');
  await active.locator('#step1-buyer-proxy-supplierReplacementDifficulty').selectOption('hard');
  await active.locator('#step1-buyer-proxy-criticalPath').selectOption('yes');

  const exposurePanel = active.locator('[data-project-exposure-panel="buyer"]');
  await expect(exposurePanel).toContainText(/Unknown high-impact inputs/i);
  await expect(exposurePanel).toContainText(/Delay cost per day/i);

  const generateButton = exposurePanel.locator('[data-project-exposure-action="generate"]');
  await generateButton.scrollIntoViewIfNeeded();
  await generateButton.click();
  await expect.poll(() => projectExposureRequests.length).toBeGreaterThan(0);

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

  await exposurePanel.locator('[data-project-exposure-action="continue"]').click();
  await page.getByRole('button', { name: /continue to scenario review/i }).click();
  await expect(page).toHaveURL(/#\/wizard\/3$/);
  await expect(page.getByRole('heading', { name: /refine the scenario/i })).toBeVisible({ timeout: 10000 });

  const continueToEstimate = page.getByRole('button', { name: /continue to estimate/i });
  await continueToEstimate.scrollIntoViewIfNeeded();
  await continueToEstimate.click();
  await expect(page).toHaveURL(/#\/wizard\/4$/);
  await expect(page.locator('.wizard-step-title').filter({ hasText: /Tune the estimate/i }).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: /continue to review/i }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /continue to review/i }).click();
  await expect(page).toHaveURL(/#\/wizard\/5$/);
  await expect(page.getByRole('heading', { name: /Review & Run Simulation/i })).toBeVisible({ timeout: 10000 });

  const projectFairPanel = page.locator('details').filter({ hasText: /Project financial exposure and FAIR parameters/i }).first();
  await expect(projectFairPanel).toBeVisible({ timeout: 10000 });
  await expect(projectFairPanel).toContainText(/Parameter gap/i);
  await expect(projectFairPanel).toContainText(/Delay cost/i);
  await expect(projectFairPanel).toContainText(/Not quantified/i);

  const finalDraft = await page.evaluate(() => (typeof AppState !== 'undefined' && AppState?.draft) || window.AppState?.draft || null);
  expect(finalDraft.buyerEconomics.delayCostPerDay).toBeNull();
  expect(finalDraft.projectExposure.financialDrivers.find(driver => driver.id === 'buyer-delay-cost').likely).toBeNull();
  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
