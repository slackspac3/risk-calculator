const { test, expect } = require('@playwright/test');

function buildSession(user, apiSessionToken = 'test-session-token') {
  return {
    authenticated: true,
    ts: Date.now(),
    user,
    apiSessionToken,
    context: {}
  };
}

function buildSeededUserSettings(overrides = {}) {
  return {
    ...overrides,
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: [],
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.',
      ...overrides.userProfile
    }
  };
}

async function seedAuthenticatedUser(page, {
  username = 'alex.trafton',
  displayName = 'Alex Trafton',
  role = 'user',
  businessUnitEntityId = '',
  departmentEntityId = '',
  userSettings = null,
  adminSettings = null,
  draftRecovery = null,
  preferredAdminSection = 'org'
} = {}) {
  await page.addInitScript(({ session, userSettings, adminSettings, draftRecovery, preferredAdminSection }) => {
    sessionStorage.setItem('rq_auth_session', JSON.stringify(session));
    if (userSettings) {
      localStorage.setItem(`rq_user_settings__${session.user.username}`, JSON.stringify(userSettings));
    }
    if (adminSettings) {
      localStorage.setItem('rq_admin_settings', JSON.stringify(adminSettings));
    }
    if (draftRecovery) {
      localStorage.setItem(`rq_draft_recovery__${session.user.username}`, JSON.stringify(draftRecovery));
    }
    if (preferredAdminSection) {
      localStorage.setItem('rq_admin_active_section', preferredAdminSection);
    }
  }, {
    session: buildSession({ username, displayName, role, businessUnitEntityId, departmentEntityId }),
    userSettings,
    adminSettings,
    draftRecovery,
    preferredAdminSection
  });
}

async function mockSharedApis(page, {
  loginUser = null,
  userState = null,
  settings = null,
  aiStatus = null,
  skipUsers = false
} = {}) {
  if (!skipUsers) await page.route('**/api/users', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      if (payload?.action === 'login' && loginUser) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: loginUser,
            sessionToken: 'playwright-session-token'
          })
        });
        return;
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: [], storage: { writable: true, mode: 'shared-kv' } })
    });
  });

  await page.route('**/api/user-state*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: userState || {
            userSettings: null,
            assessments: [],
            learningStore: { templates: {} },
            draft: null,
            _meta: { revision: 1, updatedAt: Date.now() }
          }
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  await page.route('**/api/settings', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ settings: settings || {} })
    });
  });

  await page.route('**/api/ai/status*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(aiStatus || {
        mode: 'live',
        providerReachable: true,
        model: 'gpt-5.1',
        proxyConfigured: true,
        checkedAt: Date.now(),
        message: 'Hosted AI proxy is configured and the provider responded to a server-side health check.'
      })
    });
  });

  await page.route('**/api/audit-log*', async route => {
    const request = route.request();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(request.method() === 'GET'
        ? { entries: [], summary: { total: 0, retainedCapacity: 200 } }
        : { ok: true })
    });
  });
}

async function expectNoClientCrashOnRoute(page, route, assertion) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(route);
  await assertion();
  expect(pageErrors, `Unexpected page errors on ${route}: ${pageErrors.join(' | ')}`).toEqual([]);
}

test('login screen renders', async ({ page }) => {
  await expectNoClientCrashOnRoute(page, '/#/login', async () => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});

test('dashboard route redirects unauthenticated users to login', async ({ page }) => {
  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test('expired API session forces logout and redirects to login', async ({ page }) => {
  await seedAuthenticatedUser(page, {
    userSettings: {
      userProfile: {
        fullName: 'Alex Trafton'
      },
      onboardedAt: '2026-03-17T00:00:00.000Z',
      _overrideKeys: []
    }
  });
  await mockSharedApis(page, { settings: {}, skipUsers: false });
  await page.route('**/api/user-state*', async route => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session expired. Please sign in again.'
        }
      })
    });
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});

test('stale draft autosave shows a recovery dialog instead of silently overwriting data', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });
  await page.route('**/api/user-state*', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: {
            userSettings: seededUserSettings,
            assessments: [],
            learningStore: { templates: {} },
            draft: null,
            _meta: { revision: 1, updatedAt: Date.now() }
          }
        })
      });
      return;
    }
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'WRITE_CONFLICT',
          message: 'Your workspace changed in another session. Reload the latest version and try again.'
        },
        latestState: {
          userSettings: seededUserSettings,
          assessments: [],
          learningStore: { templates: {} },
          draft: { scenarioTitle: 'Latest shared draft' },
          _meta: { revision: 2, updatedAt: Date.now() }
        },
        latestMeta: { revision: 2, updatedAt: Date.now() },
        conflictFields: ['draft']
      })
    });
  });

  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    await page.locator('#guided-event').fill('Third-party outage');
    await expect(page.getByText(/latest version available/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /load latest/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  });
});

test('wizard step 1 shows per-risk AI rating controls for generated risks and saves the chosen score', async ({ page }) => {
  const seededUserSettings = buildSeededUserSettings({
    userProfile: {
      department: 'Operations',
      focusAreas: ['Resilience']
    }
  });
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['ISO 22301'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Operations']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: {
        templates: {},
        scenarioPatterns: [],
        analystSignals: { keptRisks: [], removedRisks: [], narrativeEdits: [], rerunDeltas: [] },
        aiFeedback: { events: [] }
      },
      draft: {
        id: 'draft-step1-risk-feedback',
        scenarioTitle: 'Operational outage scenario',
        narrative: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
        guidedInput: {
          event: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption',
          asset: 'Cloud System',
          cause: 'Human Error',
          impact: 'Customer Impact, Reputational Loss',
          urgency: 'Critical'
        },
        scenarioLens: {
          key: 'operational',
          label: 'Operational',
          functionKey: 'operations'
        },
        llmAssisted: true,
        aiQualityState: 'ai',
        guidedDraftSource: 'ai',
        riskCandidates: [
          {
            id: 'risk-ops-1',
            title: 'Business continuity and recovery failure',
            category: 'Business Continuity',
            source: 'ai',
            description: 'Recovery plans may not restore the affected service inside the required operating window.'
          },
          {
            id: 'risk-cy-1',
            title: 'Cyber compromise of critical platforms or data',
            category: 'Cyber',
            source: 'ai',
            description: 'Shown here only to verify the per-risk feedback control is attached to AI-generated suggestions.'
          }
        ],
        selectedRiskIds: ['risk-ops-1'],
        applicableRegulations: ['ISO 22301']
      },
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });
  await page.route('**/api/org-intelligence', async route => {
    const method = route.request().method();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET'
        ? {
            patterns: [],
            calibration: { updatedAt: 0, scenarioTypes: {} },
            decisions: [],
            coverageMap: { updatedAt: 0, scenarioTypes: {} },
            feedback: { updatedAt: 0, events: [] }
          }
        : { ok: true, feedback: { updatedAt: Date.now(), events: [] } })
    });
  });

  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    await expect(page.getByText('Business continuity and recovery failure')).toBeVisible();
    const stars = page.locator('.step1-risk-feedback__star[data-risk-feedback-id="risk-ops-1"]');
    await expect(stars).toHaveCount(5);
    await stars.nth(3).click();
    await expect(page.locator('#risk-feedback-status-risk-ops-1')).toContainText('Saved');
  });
});

test('draft recovery restores the latest local draft after refresh', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, {
    userSettings: seededUserSettings,
    draftRecovery: {
      savedAt: Date.now(),
      draft: {
        scenarioTitle: 'Recovered pilot draft',
        guidedInput: { event: 'Identity provider outage', asset: '', cause: '', impact: '', urgency: 'medium' }
      }
    }
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    await expect(page.locator('#guided-event')).toHaveValue(/Identity provider outage/);
    await expect(page.getByText(/recovered your latest draft from this browser/i)).toBeVisible();
  });
});

test('admin login route renders without crashing', async ({ page }) => {
  await expectNoClientCrashOnRoute(page, '/#/admin/settings/org', async () => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test('wizard route redirects unauthenticated users to login', async ({ page }) => {
  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test('results route redirects unauthenticated users to login', async ({ page }) => {
  await expectNoClientCrashOnRoute(page, '/#/results/example-assessment', async () => {
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });
});

test('wizard step 1 dry-run examples prefill the scenario and shortlist', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    await expect(page.getByRole('heading', { name: /guided scenario builder/i })).toBeVisible();
    await expect(page.locator('[data-path="import"]')).toBeVisible();
    await page.evaluate(() => {
      applyDryRunScenario(STEP1_DRY_RUN_SCENARIOS[0]);
    });
    await expect(page.locator('#guided-event')).toContainText('critical supplier');
    await expect(page.locator('#intake-risk-statement')).toContainText('critical supplier');
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /continue to scenario review/i })).toBeVisible();
  });
});

test('wizard handoff guidance carries the scenario cleanly into steps 2 and 3', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    await expect(page.getByRole('heading', { name: /assessment context/i })).toBeVisible();
    await page.locator('#wizard-bu').selectOption({ index: 1 });
    await expect(page.locator('[data-path="import"]')).toBeVisible();
    await page.evaluate(() => {
      applyDryRunScenario(STEP1_DRY_RUN_SCENARIOS[0]);
    });
    await page.getByRole('button', { name: /continue to scenario review/i }).click();
    await expect(page).toHaveURL(/#\/wizard\/2$/);
    await expect(page.getByText(/what will carry into the estimate/i)).toBeVisible();
    const continueToEstimation = page.getByRole('button', { name: /continue to estimation/i });
    await continueToEstimation.scrollIntoViewIfNeeded();
    await continueToEstimation.click();
    await expect(page).toHaveURL(/#\/wizard\/3$/);
    await expect(page.getByText(/scenario handoff/i)).toBeVisible();
    await expect(page.getByText(/quant readiness/i)).toBeVisible();
  });
});

test('pressing Enter signs in and opens the personal workspace', async ({ page }) => {
  await mockSharedApis(page, {
    loginUser: {
      username: 'alex.trafton',
      displayName: 'Alex Trafton',
      role: 'user',
      businessUnitEntityId: 'bu-digital-platforms',
      departmentEntityId: 'dept-security'
    },
    userState: {
      userSettings: {
        userProfile: {
          fullName: 'Alex Trafton',
          jobTitle: 'Risk Manager',
          businessUnit: 'G42',
          department: 'Security',
          focusAreas: ['Resilience'],
          preferredOutputs: 'Executive summaries',
          workingContext: 'Support regulated services.'
        },
        onboardedAt: '2026-03-17T00:00:00.000Z',
        _overrideKeys: []
      },
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    },
    settings: {}
  });

  await expectNoClientCrashOnRoute(page, '/#/login', async () => {
    await page.getByLabel(/username/i).fill('alex.trafton');
    await page.getByLabel(/password/i).fill('secret');
    await page.getByLabel(/password/i).press('Enter');
    await expect(page.getByRole('heading', { name: /PoC data warning/i })).toBeVisible();
    await expect(page.getByText(/Do not enter real company data/i)).toBeVisible();
    await page.getByRole('button', { name: /I Understand/i }).click();
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
    await expect(
      page.getByText(/personal workspace/i).or(page.getByRole('heading', { name: /let the platform know who you are/i }))
    ).toBeVisible();
  });
});

test('authenticated user dashboard renders without crashing', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {},
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByText(/personal workspace/i)).toBeVisible();
    await expect(page.locator('#btn-dashboard-new-assessment')).toBeVisible();
    await expect(page.locator('#btn-dashboard-upload-register')).toBeVisible();
    await expect(page.locator('#btn-dashboard-start-sample')).toBeVisible();
    await expect(page.locator('#btn-dashboard-start-template')).toBeVisible();
    await expect(page.getByText(/workspace tools/i).first()).toBeVisible();
  });
});

test('business-unit oversight dashboard prioritises review and context actions', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Taylor BU',
      jobTitle: 'BU Risk Lead',
      businessUnit: 'Digital Platforms',
      department: 'Security',
      focusAreas: ['Operational resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Oversee resilience posture across the business unit.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, {
    username: 'taylor.bu',
    displayName: 'Taylor BU',
    role: 'user'
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [
        { id: 'bu_digital', type: 'business_unit', name: 'Digital Platforms', ownerUsername: 'taylor.bu' }
      ],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [
        {
          id: 'a_review',
          scenarioTitle: 'Critical supplier outage',
          buName: 'Digital Platforms',
          createdAt: '2026-03-20T00:00:00.000Z',
          completedAt: '2026-03-21T00:00:00.000Z',
          results: {
            nearTolerance: true,
            toleranceBreached: false,
            annualReviewTriggered: false
          }
        }
      ],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    await expect(page.getByText(/bu oversight workspace/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /review bu queue|resume review/i })).toBeVisible();
    await expect(page.getByText(/context you own/i)).toBeVisible();
  });
});

test('function oversight dashboard does not duplicate the guided-start hero CTA when the queue is clear', async ({ page }) => {
  const seededUserSettings = buildSeededUserSettings({
    userProfile: {
      businessUnitEntityId: 'bu-digital',
      departmentEntityId: 'dept-security',
      businessUnit: 'Digital Services',
      department: 'Security Operations'
    }
  });
  await seedAuthenticatedUser(page, {
    username: 'safiya.ops',
    displayName: 'Safiya Ops',
    role: 'function_admin',
    userSettings: seededUserSettings
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [
        { id: 'bu-digital', name: 'Digital Services', type: 'business_unit', ownerUsername: 'someone.else' },
        { id: 'dept-security', name: 'Security Operations', type: 'Department / Function', parentId: 'bu-digital', ownerUsername: 'safiya.ops' }
      ],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    await expect(page.getByText(/function oversight workspace/i)).toBeVisible();
    await expect(page.locator('#btn-dashboard-new-assessment')).toHaveText(/start guided assessment/i);
    await expect(page.locator('#btn-dashboard-new-assessment-oversight')).toHaveCount(0);
  });
});

test('first-run onboarding can launch the sample assessment path', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: '',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: '',
      workingContext: ''
    },
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    await page.locator('#onboard-title').fill('Risk Manager');
    await page.getByRole('button', { name: /^Continue$/ }).click();
    await page.getByRole('button', { name: /^Continue$/ }).click();
    await page.getByRole('button', { name: /^Continue$/ }).click();
    await page.getByRole('button', { name: /try sample assessment/i }).click();
    await expect(page).toHaveURL(/#\/wizard\/1$/);
    await expect(page.locator('#intake-risk-statement')).not.toHaveValue('');
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(3);
  });
});

test('personal settings shows the pilot release stamp', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    geography: 'United Arab Emirates',
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/settings', async () => {
    await expect(page.getByText(/Personal settings save automatically/i)).toBeVisible();
    await expect(page.locator('[data-workspace-sync-state][data-scope="settings"]')).toContainText(/Autosave is on|Last synced|Saving your changes|Changes queued to sync|Sync needs attention/i);
    await expect(page.getByRole('button', { name: /^Sync now$/ })).toBeVisible();
    await expect(page.getByText(/Pilot release:/i)).toBeVisible();
    await expect(page.getByText(/0\.10\.0-pilot\.1/i)).toBeVisible();
  });
});

test('personal settings reconciles stale saved profile scope to the current admin-managed assignment', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Tarun Gupta',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      businessUnitEntityId: 'g42',
      department: 'Procurement',
      departmentEntityId: 'procurement',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    geography: 'United Arab Emirates',
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, {
    username: 'tarun.gupta',
    displayName: 'Tarun Gupta',
    role: 'user',
    businessUnitEntityId: 'g42',
    departmentEntityId: 'group-technology-risk',
    userSettings: seededUserSettings
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [
        { id: 'g42', name: 'G42', type: 'Holding company', parentId: '' },
        { id: 'procurement', name: 'Procurement', type: 'Department / function', parentId: 'g42' },
        { id: 'group-technology-risk', name: 'Group Technology Risk', type: 'Department / function', parentId: 'g42' }
      ],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.'
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/settings', async () => {
    await expect(page.locator('#user-department')).toHaveValue('group-technology-risk');
    await expect(page.locator('#user-department')).toBeDisabled();
    await expect(page.locator('#user-business-unit')).toHaveValue('g42');
  });
});

test('help page renders and opens key workflow guidance without crashing', async ({ page }) => {
  const seededUserSettings = buildSeededUserSettings();
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/help', async () => {
    await expect(page.getByRole('heading', { name: /use the platform well without learning the whole model first/i })).toBeVisible();
    await page.getByRole('button', { name: /how context works/i }).first().click();
    await expect(page.getByRole('heading', { name: /how context is derived/i })).toBeVisible();
    await page.getByText(/what comes from ai, benchmarks, and source material/i).click();
    await expect(page.getByText(/primary grounding/i)).toBeVisible();
    await page.getByRole('button', { name: /^Shortcuts$/ }).first().click();
    await expect(page.getByRole('heading', { name: /desktop shortcuts/i })).toBeVisible();
  });
});

test('standard user help stays focused on the personal workspace', async ({ page }) => {
  const seededUserSettings = buildSeededUserSettings();
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/help', async () => {
    await expect(page.getByText(/^Standard user$/)).toBeVisible();
    await expect(page.getByText(/your standard user view/i)).toBeVisible();
    await expect(page.getByText(/open personal settings/i)).toBeVisible();
    await expect(page.getByText(/Focus admin user search/i)).toHaveCount(0);
  });
});

test('function admin help reflects owned function access', async ({ page }) => {
  const seededUserSettings = buildSeededUserSettings({
    userProfile: {
      businessUnitEntityId: 'bu-digital',
      departmentEntityId: 'dept-security',
      businessUnit: 'Digital Services',
      department: 'Security Operations'
    }
  });
  await seedAuthenticatedUser(page, {
    username: 'safiya.ops',
    displayName: 'Safiya Ops',
    role: 'function_admin',
    userSettings: seededUserSettings
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [
        { id: 'bu-digital', name: 'Digital Services', type: 'business_unit', ownerUsername: 'someone.else' },
        { id: 'dept-security', name: 'Security Operations', type: 'Department / Function', parentId: 'bu-digital', ownerUsername: 'safiya.ops' }
      ],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/help', async () => {
    await expect(page.getByText(/^Function admin$/)).toBeVisible();
    await expect(page.getByText(/your function admin view/i)).toBeVisible();
    await expect(page.getByText('Security Operations', { exact: true })).toBeVisible();
    await expect(page.getByText(/open your settings and managed context/i)).toBeVisible();
    await expect(page.getByText(/Focus admin user search/i)).toHaveCount(0);
  });
});

test('business unit admin help reflects business unit oversight access', async ({ page }) => {
  const seededUserSettings = buildSeededUserSettings({
    userProfile: {
      businessUnitEntityId: 'bu-digital',
      businessUnit: 'Digital Services'
    }
  });
  await seedAuthenticatedUser(page, {
    username: 'omar.bu',
    displayName: 'Omar BU',
    role: 'bu_admin',
    userSettings: seededUserSettings
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [
        { id: 'bu-digital', name: 'Digital Services', type: 'business_unit', ownerUsername: 'omar.bu' },
        { id: 'dept-risk', name: 'Risk Operations', type: 'department', parentId: 'bu-digital', ownerUsername: 'someone.else' }
      ],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/help', async () => {
    await expect(page.getByText(/^BU admin$/)).toBeVisible();
    await expect(page.getByText(/your business-unit admin view/i)).toBeVisible();
    await expect(page.getByText('Digital Services', { exact: true })).toBeVisible();
    await expect(page.getByText(/open your settings and managed context/i)).toBeVisible();
    await expect(page.getByText(/Focus admin user search/i)).toHaveCount(0);
  });
});

test('authenticated admin shell renders without crashing', async ({ page }) => {
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    preferredAdminSection: 'org'
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/admin/settings/org', async () => {
    await expect(page.getByText(/platform control/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /organisation setup/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /platform home/i })).toBeVisible();
    await expect(page.locator('#btn-admin-logout')).toBeVisible();
  });
});

test('admin org setup can add and save entity obligations from the tree', async ({ page }) => {
  const adminSettings = {
    geography: 'United Arab Emirates',
    companyStructure: [
      { id: 'holding-g42', parentId: '', type: 'Holding company', name: 'G42 Holding' },
      { id: 'subsidiary-tech', parentId: 'holding-g42', type: 'Wholly owned subsidiary', name: 'Tech Subsidiary' },
      { id: 'dept-tech', parentId: 'subsidiary-tech', type: 'Department / function', name: 'Technology', departmentRelationshipType: 'In-house' }
    ],
    entityContextLayers: [],
    entityObligations: [],
    applicableRegulations: ['UAE PDPL'],
    aiInstructions: 'Use British English.',
    benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
    typicalDepartments: ['Security']
  };
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings,
    preferredAdminSection: 'org'
  });
  await mockSharedApis(page, { settings: adminSettings });

  await expectNoClientCrashOnRoute(page, '/#/admin/settings/org', async () => {
    await expect(page.locator('.org-accordion__identity strong').first()).toHaveText(/g42 holding/i);
    await page.locator('.org-entity-obligations').first().click();

    const managerDialog = page.getByRole('dialog').filter({ hasText: /manage obligations: g42 holding/i });
    await expect(managerDialog.getByText(/manage obligations: g42 holding/i)).toBeVisible();
    await managerDialog.getByRole('button', { name: /add obligation/i }).click();

    const editorDialog = page.getByRole('dialog').filter({ hasText: /add obligation: g42 holding/i });
    await editorDialog.getByLabel(/obligation title/i).fill('Group export controls obligation');
    await editorDialog.getByLabel(/family key/i).fill('export-controls');
    await editorDialog.getByLabel(/obligation text/i).fill('Controlled technology transfers must be screened before onboarding or cross-border movement.');
    await editorDialog.getByLabel(/flow-down mode/i).selectOption('partial');
    await editorDialog.locator('input[name*="include-entity"]').first().check();
    await editorDialog.getByRole('button', { name: /save obligation/i }).click();

    await expect(managerDialog.getByText(/group export controls obligation/i)).toBeVisible();
    await managerDialog.getByRole('button', { name: /save changes/i }).click();

    await expect(page.locator('#admin-obligation-summary-list')).toContainText('G42 Holding');
    await expect(page.locator('#admin-obligation-summary-list')).toContainText('Group export controls obligation');
  });
});

test('admin system access reads server-reported AI mode without relying on browser verification', async ({ page }) => {
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    preferredAdminSection: 'access'
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    aiStatus: {
      mode: 'deterministic_fallback',
      providerReachable: false,
      model: 'gpt-5.1',
      proxyConfigured: false,
      checkedAt: Date.now(),
      message: 'Hosted AI proxy is not configured. Supported workflows may continue with deterministic fallback or manual handling.'
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/admin/settings/access', async () => {
    await expect(page.getByRole('heading', { name: /system access/i })).toBeVisible();
    const accessSection = page.locator('details.settings-section').filter({
      has: page.locator('.settings-section__title', { hasText: /system access/i })
    }).first();
    await accessSection.evaluate(node => { node.open = true; });
    const readinessPanel = page.locator('#pilot-ai-readiness-panel');
    await expect(readinessPanel.getByText(/server ai status/i)).toBeVisible();
    await expect(readinessPanel.getByText(/deterministic fallback/i).first()).toBeVisible();
    await expect(readinessPanel.getByText(/hosted ai proxy is not configured/i)).toBeVisible();
  });
});

test('admin AI feedback and tuning dashboard renders the signal view and tuning controls', async ({ page }) => {
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security'],
      aiFeedbackTuning: {
        alignmentPriority: 'strict',
        draftStyle: 'executive-brief',
        shortlistDiscipline: 'strict',
        learningSensitivity: 'balanced'
      }
    },
    preferredAdminSection: 'feedback'
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security'],
      aiFeedbackTuning: {
        alignmentPriority: 'strict',
        draftStyle: 'executive-brief',
        shortlistDiscipline: 'strict',
        learningSensitivity: 'balanced'
      }
    }
  });
  await page.route('**/api/org-intelligence', async route => {
    const request = route.request();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(request.method() === 'GET'
        ? {
            patterns: [],
            calibration: { updatedAt: 0, scenarioTypes: {} },
            decisions: [],
            coverageMap: { updatedAt: 0, scenarioTypes: {} },
            feedback: {
              updatedAt: Date.now(),
              events: [
                {
                  id: 'fb-1',
                  target: 'draft',
                  score: 2,
                  runtimeMode: 'live_ai',
                  buId: 'corp-ops',
                  buName: 'Operations',
                  functionKey: 'operations',
                  lensKey: 'operational',
                  reasons: ['wrong-domain', 'too-generic'],
                  submittedBy: 'alex'
                },
                {
                  id: 'fb-2',
                  target: 'shortlist',
                  score: 5,
                  runtimeMode: 'live_ai',
                  buId: 'corp-ops',
                  buName: 'Operations',
                  functionKey: 'operations',
                  lensKey: 'operational',
                  reasons: ['useful-with-edits'],
                  shownRiskTitles: ['Business continuity and recovery failure'],
                  keptRiskTitles: ['Business continuity and recovery failure'],
                  citations: [{ docId: 'doc-ops-1', title: 'Ops runbook' }],
                  submittedBy: 'maya'
                },
                {
                  id: 'fb-3',
                  target: 'risk',
                  score: 1,
                  runtimeMode: 'live_ai',
                  buId: 'corp-ops',
                  buName: 'Operations',
                  functionKey: 'operations',
                  lensKey: 'operational',
                  riskId: 'risk-cy-1',
                  riskTitle: 'Cyber compromise of critical platforms or data',
                  selectedInAssessment: false,
                  submittedBy: 'alex'
                }
              ]
            }
          }
        : { ok: true })
    });
  });

  await expectNoClientCrashOnRoute(page, '/#/admin/settings/feedback', async () => {
    await expect(page.getByRole('heading', { name: /ai feedback & tuning/i })).toBeVisible();
    await expect(page.locator('#admin-ai-alignment-priority')).toHaveValue('strict');
    await expect(page.locator('#admin-ai-learning-sensitivity')).toHaveValue('balanced');
    await expect(page.locator('#btn-reset-ai-feedback-dashboard')).toBeVisible();
    await page.locator('#btn-refresh-ai-feedback-dashboard').click();
    await expect(page.getByText(/recent feedback events/i).first()).toBeVisible();
    await expect(page.locator('.wizard-disclosure[open] .wizard-disclosure-body').getByText(/submitted by alex/i).first()).toBeVisible();
  });
});

test('unknown admin routes recover to platform home instead of the user dashboard', async ({ page }) => {
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    preferredAdminSection: 'org'
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/admin/does-not-exist', async () => {
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
    const recoveryLink = page.locator('#main-content').getByRole('link', { name: /^← Platform Home$/ });
    await expect(recoveryLink).toBeVisible();
    await expect(recoveryLink).toHaveAttribute('href', '#/admin/home');
  });
});

test('authenticated admin document library renders without crashing', async ({ page }) => {
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    preferredAdminSection: 'org'
  });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      companyStructure: [],
      entityContextLayers: [],
      applicableRegulations: ['UAE PDPL'],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/admin/docs', async () => {
    await expect(page.getByRole('heading', { name: /document library/i })).toBeVisible();
    await expect(page.locator('#btn-add-doc')).toBeVisible();
    await page.getByText(/^more$/i).first().click();
    await expect(page.locator('#btn-reindex')).toBeVisible();
  });
});



test('wizard step 1 clear all keeps manually added risks unselected after rerender', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await mockSharedApis(page, {
    settings: {
      geography: 'United Arab Emirates',
      applicableRegulations: ['UAE PDPL'],
      entityContextLayers: [],
      companyStructure: [],
      aiInstructions: 'Use British English.',
      benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
      typicalDepartments: ['Security']
    },
    userState: {
      userSettings: seededUserSettings,
      assessments: [],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/wizard/1', async () => {
    const addManualRiskCandidate = async title => {
      await page.evaluate(riskTitle => {
        clearLoadedDryRunFlag?.();
        appendRiskCandidates([{ title: riskTitle, category: 'Manual', source: 'manual' }], { selectNew: true });
        AppState.draft.applicableRegulations = deriveApplicableRegulations(
          getBUList().find(b => b.id === AppState.draft.buId),
          getSelectedRisks(),
          getScenarioGeographies()
        );
        saveDraft();
        renderWizard1();
      }, title);
    };
    const manualRiskCheckbox = (title) => page.locator('.risk-pick-card').filter({ hasText: title }).locator('.risk-select-checkbox');

    await addManualRiskCandidate('Cloud storage exposure');
    await addManualRiskCandidate('Privileged access misuse');

    await expect(manualRiskCheckbox('Cloud storage exposure')).toBeChecked();
    await expect(manualRiskCheckbox('Privileged access misuse')).toBeChecked();
    await expect(page.getByRole('button', { name: /^Clear All$/ })).toBeVisible();
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(2);
    await page.getByRole('button', { name: /^Clear All$/ }).click({ force: true });
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(0);

    // Step 1 replaces the risk list DOM during persistAndRenderStep1, so re-query after an explicit rerender.
    await page.evaluate(() => {
      saveDraft?.();
      renderWizard1?.();
    });
    await expect(manualRiskCheckbox('Cloud storage exposure')).not.toBeChecked();
    await expect(manualRiskCheckbox('Privileged access misuse')).not.toBeChecked();
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(0);
  });
});

test('dashboard archive helpers move the assessment into archived items after the confirm modal opens', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  const activeAssessment = {
    id: 'assess-1',
    scenarioTitle: 'Ransomware on shared ERP',
    buName: 'G42',
    createdAt: '2026-03-15T00:00:00.000Z',
    completedAt: '2026-03-16T00:00:00.000Z',
    results: { toleranceBreached: false, nearTolerance: true, annualReviewTriggered: false }
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await page.addInitScript(({ activeAssessment }) => {
    localStorage.setItem('rq_assessments__alex.trafton', JSON.stringify([activeAssessment]));
  }, { activeAssessment });
  await mockSharedApis(page, {
    settings: {},
    userState: {
      userSettings: seededUserSettings,
      assessments: [activeAssessment],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    const activeRow = page.locator('.dashboard-assessment-row[data-assessment-id="assess-1"]').first();
    await expect(activeRow).toBeVisible();
    await activeRow.getByText(/^More$/).click();
    await activeRow.getByRole('button', { name: /^Archive$/ }).click({ force: true });
    const confirmButton = page.getByRole('button', { name: /^Archive$/ }).last();
    await expect(confirmButton).toBeVisible();
    await expect(page.getByText('Recent work')).toBeVisible();
  });
});

test('dashboard duplicate assessment creates a new editable draft', async ({ page }) => {
  const seededUserSettings = {
    userProfile: {
      fullName: 'Alex Trafton',
      jobTitle: 'Risk Manager',
      businessUnit: 'G42',
      department: 'Security',
      focusAreas: ['Resilience'],
      preferredOutputs: 'Executive summaries',
      workingContext: 'Support regulated services.'
    },
    onboardedAt: '2026-03-17T00:00:00.000Z',
    _overrideKeys: []
  };
  const activeAssessment = {
    id: 'assess-2',
    scenarioTitle: 'Cloud exposure in shared platform',
    narrative: 'A cloud storage configuration error exposes sensitive data.',
    buName: 'G42',
    createdAt: '2026-03-15T00:00:00.000Z',
    completedAt: '2026-03-16T00:00:00.000Z',
    results: { toleranceBreached: false, nearTolerance: false, annualReviewTriggered: false }
  };
  await seedAuthenticatedUser(page, { userSettings: seededUserSettings });
  await page.addInitScript(({ activeAssessment }) => {
    localStorage.setItem('rq_assessments__alex.trafton', JSON.stringify([activeAssessment]));
  }, { activeAssessment });
  await mockSharedApis(page, {
    settings: {},
    userState: {
      userSettings: seededUserSettings,
      assessments: [activeAssessment],
      learningStore: { templates: {} },
      draft: null,
      _meta: { revision: 1, updatedAt: Date.now() }
    }
  });

  await expectNoClientCrashOnRoute(page, '/#/dashboard', async () => {
    const duplicateRow = page.locator('.dashboard-assessment-row[data-assessment-id="assess-2"]').first();
    await expect(duplicateRow).toBeVisible();
    await duplicateRow.getByText(/^More$/).click();
    const duplicateButton = duplicateRow.getByRole('button', { name: /^Duplicate$/ });
    await expect(duplicateButton).toBeVisible();
  });
});

test('admin can update user access and the request carries the expected role assignment', async ({ page }) => {
  const settings = {
    geography: 'United Arab Emirates',
    companyStructure: [
      { id: 'bu-g42', name: 'G42', type: 'Holding company', parentId: '', ownerUsername: '' },
      { id: 'dept-sec', name: 'Security', type: 'Department / function', parentId: 'bu-g42', ownerUsername: '' }
    ],
    entityContextLayers: [],
    applicableRegulations: ['UAE PDPL'],
    aiInstructions: 'Use British English.',
    benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
    typicalDepartments: ['Security']
  };
  const accounts = [
    {
      username: 'alex.trafton',
      displayName: 'Alex Trafton',
      role: 'user',
      businessUnitEntityId: 'bu-g42',
      departmentEntityId: 'dept-sec'
    }
  ];
  let patchPayload = null;
  await seedAuthenticatedUser(page, {
    username: 'admin',
    displayName: 'Global Admin',
    role: 'admin',
    adminSettings: settings,
    preferredAdminSection: 'users'
  });
  await page.addInitScript(() => {
    localStorage.setItem('rq_admin_api_secret', 'test-admin-secret');
  });
  await page.route('**/api/users', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accounts, storage: { writable: true, mode: 'shared-kv' } })
      });
      return;
    }
    if (request.method() === 'PATCH') {
      patchPayload = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accounts: [{ ...accounts[0], ...patchPayload.updates }] })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts, storage: { writable: true, mode: 'shared-kv' } })
    });
  });
  await mockSharedApis(page, { settings, skipUsers: true });

  await expectNoClientCrashOnRoute(page, '/#/admin/settings/users', async () => {
    await expect(page.locator('.managed-account-row')).toHaveCount(1);
    const row = page.locator('.managed-account-row[data-username="alex.trafton"]');
    const roleSelect = row.locator('.account-role-select');
    await roleSelect.selectOption('function_admin', { force: true });
    await row.locator('.account-bu-select').selectOption('bu-g42', { force: true });
    await row.locator('.account-department-select').selectOption('dept-sec', { force: true });
    await page.locator('.btn-apply-user-access[data-username="alex.trafton"]').evaluate(button => button.click());
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(page.getByText(/updated access for alex trafton\./i)).toBeVisible();
    expect(patchPayload).toBeTruthy();
    expect(patchPayload.action).toBe('admin-update');
    expect(patchPayload.username).toBe('alex.trafton');
    expect(patchPayload.updates.role).toBe('function_admin');
    expect(patchPayload.updates.businessUnitEntityId).toBe('bu-g42');
    expect(patchPayload.updates.departmentEntityId).toBe('dept-sec');
  });
});
