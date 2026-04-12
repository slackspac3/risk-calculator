const { test, expect } = require('@playwright/test');
const {
  applyUserWorkspacePatch,
  normaliseUserWorkspaceState
} = require('../../assets/state/userWorkspacePersistence.js');

/**
 * Integration test: wizard step 4 → simulation → results → export.
 * Seeds a fully-prepared draft at Step 4 to exercise the critical path
 * from Review & Run through simulation completion to results rendering.
 */

function buildSession(user) {
  return {
    authenticated: true,
    ts: Date.now(),
    user,
    apiSessionToken: 'integration-test-token',
    context: {}
  };
}

const SEED_DRAFT = {
  id: 'a_integration_test',
  scenarioTitle: 'Credential theft via phishing campaign',
  narrative: 'A spear-phishing campaign targets privileged administrators, leading to credential compromise and lateral movement across critical infrastructure.',
  enhancedNarrative: 'A spear-phishing campaign targets privileged administrators, leading to credential compromise and lateral movement across critical infrastructure.',
  buName: 'G42 Cloud',
  geography: 'United Arab Emirates',
  scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'security' },
  guidedInput: {
    event: 'Credential theft via spear-phishing',
    asset: 'Identity platform',
    cause: 'Social engineering',
    impact: 'Credential compromise, lateral movement',
    urgency: 'high'
  },
  llmAssisted: true,
  aiQualityState: 'reviewed',
  guidedDraftSource: 'ai',
  confidenceLabel: 'Moderate confidence',
  evidenceQuality: 'Estimate informed by industry benchmarks and internal context.',
  evidenceSummary: 'Based on regional phishing frequency data and internal control maturity.',
  missingInformation: ['Exact phishing click-through rate for this business unit'],
  primaryGrounding: ['Internal incident data'],
  supportingReferences: ['Verizon DBIR 2025'],
  inferredAssumptions: ['Control maturity is at the stated level'],
  inputProvenance: { guided: true, aiAssisted: true },
  citations: [],
  applicableRegulations: ['UAE PDPL', 'NIST SP 800-53'],
  riskCandidates: [
    { id: 'risk-1', title: 'Credential compromise via phishing', category: 'Cyber', source: 'ai' }
  ],
  selectedRiskIds: ['risk-1'],
  fairParams: {
    distType: 'triangular',
    iterations: 1000,
    seed: 42,
    tefMin: 1, tefLikely: 3, tefMax: 8,
    threatCapMin: 0.4, threatCapLikely: 0.6, threatCapMax: 0.85,
    controlStrMin: 0.3, controlStrLikely: 0.5, controlStrMax: 0.7,
    vulnDirect: false,
    irMin: 50000, irLikely: 150000, irMax: 500000,
    biMin: 100000, biLikely: 400000, biMax: 1200000,
    dbMin: 20000, dbLikely: 80000, dbMax: 250000,
    rlMin: 50000, rlLikely: 200000, rlMax: 800000,
    tpMin: 10000, tpLikely: 50000, tpMax: 200000,
    rcMin: 30000, rcLikely: 100000, rcMax: 400000,
    corrBiIr: 0.3,
    corrRlRc: 0.2,
    secondaryEnabled: false
  }
};

const SEED_USER_SETTINGS = {
  userProfile: {
    fullName: 'Integration Tester',
    jobTitle: 'Risk Analyst',
    businessUnit: 'G42 Cloud',
    department: 'Security',
    focusAreas: ['Cyber'],
    preferredOutputs: 'Executive summaries',
    workingContext: 'Integration test context.'
  },
  onboardedAt: '2026-01-01T00:00:00.000Z',
  _overrideKeys: []
};

const SEED_ADMIN_SETTINGS = {
  geography: 'United Arab Emirates',
  applicableRegulations: ['UAE PDPL', 'NIST SP 800-53'],
  entityContextLayers: [],
  companyStructure: [{ id: 'bu-cloud', name: 'G42 Cloud', type: 'business_unit' }],
  aiInstructions: 'Use British English.',
  benchmarkStrategy: 'Prefer GCC benchmarks.',
  typicalDepartments: ['Security'],
  toleranceThresholdUsd: 5000000,
  warningThresholdUsd: 3000000,
  annualReviewThresholdUsd: 12000000,
  _meta: { revision: 1, updatedAt: Date.now() }
};

async function seedAndMock(page) {
  const user = {
    username: 'integration.tester',
    displayName: 'Integration Tester',
    role: 'user',
    businessUnitEntityId: 'bu-cloud',
    departmentEntityId: ''
  };
  let storedState = normaliseUserWorkspaceState({
    userSettings: SEED_USER_SETTINGS,
    assessments: [],
    learningStore: { templates: {} },
    draft: SEED_DRAFT,
    _meta: { revision: 1, updatedAt: Date.now() }
  });

  await page.addInitScript(({ session, userSettings, adminSettings }) => {
    sessionStorage.setItem('rq_auth_session', JSON.stringify(session));
    localStorage.setItem(`rq_user_settings__${session.user.username}`, JSON.stringify(userSettings));
    localStorage.setItem('rq_admin_settings', JSON.stringify(adminSettings));
  }, {
    session: buildSession(user),
    userSettings: SEED_USER_SETTINGS,
    adminSettings: SEED_ADMIN_SETTINGS
  });

  await page.route('**/api/users', async route => {
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
      const patchedState = applyUserWorkspacePatch(storedState, payload.patch);
      storedState = normaliseUserWorkspaceState({
        ...patchedState,
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
      body: JSON.stringify({ settings: SEED_ADMIN_SETTINGS })
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

test('critical path: step 4 review → run simulation → results with all tabs', async ({ page }) => {
  await seedAndMock(page);

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Navigate to Step 4 (Review & Run)
  await page.goto('/#/wizard/4');
  await page.waitForLoadState('networkidle');

  // Step 4 should render with the review surface
  await expect(page.getByRole('heading', { name: /Review & Run Simulation/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Run Monte Carlo simulation/i)).toBeVisible();

  // Verify pre-run summary elements are present
  await expect(page.getByText('Review gate', { exact: true })).toBeVisible();
  await expect(page.getByText('Run trust summary', { exact: true })).toBeVisible();
  await expect(page.getByText('Run decision', { exact: true })).toBeVisible();

  // Click Run Simulation
  await page.click('#btn-run-sim');

  // Simulation progress should appear
  await expect(page.locator('#sim-progress')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('.sim-progress-title')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#sim-progress-text')).toBeVisible({ timeout: 5000 });

  // Wait for navigation to results (simulation is 1000 iterations with seed, should be fast)
  await page.waitForURL(/#\/results\//, { timeout: 15000 });

  // Results page should render
  await expect(page.getByRole('tab', { name: /Executive Summary/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('tab', { name: /Executive Summary/i })).toHaveAttribute('aria-selected', 'true');

  // Verify all three tabs exist
  const tabBar = page.locator('[role="tablist"], .results-tab-bar');
  await expect(tabBar).toBeVisible();

  // Check executive tab content rendered (hero metric)
  await expect(page.locator('.results-hero-metric, .results-metric-hero, [class*="hero"]').first()).toBeVisible({ timeout: 5000 });

  // Verify technical tab is clickable
  const techTab = page.getByRole('tab', { name: /technical/i }).or(page.locator('[data-tab="technical"]'));
  if (await techTab.count() > 0) {
    await techTab.first().click();
    await expect(page.locator('#results-tab-technical')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#results-tab-technical').getByText('Technical review priorities', { exact: true })).toBeVisible({ timeout: 5000 });
  }

  // Verify appendix tab is clickable
  const appendixTab = page.getByRole('tab', { name: /appendix/i }).or(page.locator('[data-tab="appendix"]'));
  if (await appendixTab.count() > 0) {
    await appendixTab.first().click();
    await expect(page.locator('#results-tab-appendix')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#results-tab-appendix').getByText('Appendix and evidence', { exact: true })).toBeVisible({ timeout: 5000 });
  }

  // No page errors should have occurred
  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('critical path: results page renders JSON export action', async ({ page }) => {
  await seedAndMock(page);

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Navigate to Step 4 and run simulation
  await page.goto('/#/wizard/4');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/Run Monte Carlo simulation/i)).toBeVisible({ timeout: 10000 });
  await page.click('#btn-run-sim');
  await page.waitForURL(/#\/results\//, { timeout: 15000 });

  // Verify export actions are present
  await expect(page.getByText(/export|download|json|pdf/i).first()).toBeVisible({ timeout: 10000 });

  expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});
