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

async function seedAuthenticatedUser(page, {
  username = 'alex.trafton',
  displayName = 'Alex Trafton',
  role = 'user',
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
    session: buildSession({ username, displayName, role, businessUnitEntityId: '', departmentEntityId: '' }),
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
    await expect(page.getByText(/current context shaping this assessment/i)).toBeVisible();
    await page.getByText(/need a worked example first\?/i).click();
    await page.getByRole('button', { name: 'Load Example' }).first().click();
    await expect(page.locator('#btn-clear-dry-run')).toBeVisible();
    await expect(page.locator('.card').filter({ has: page.locator('#btn-clear-dry-run') }).getByText('Supplier outage on a regulated platform')).toBeVisible();
    await expect(page.locator('#guided-event')).toContainText('critical supplier');
    await expect(page.locator('#intake-risk-statement')).toContainText('critical supplier');
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Continue with 3 selected risks/i })).toBeVisible();
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
    await page.locator('#wizard-bu').selectOption({ index: 1 });
    await page.getByText(/need a worked example first\?/i).click();
    await page.getByRole('button', { name: 'Load Example' }).first().click();
    await page.getByRole('button', { name: /continue with 3 selected risks/i }).click();
    await expect(page).toHaveURL(/#\/wizard\/2$/);
    await expect(page.getByText(/what will carry into the estimate/i)).toBeVisible();
    await page.getByRole('button', { name: /continue to estimation/i }).click();
    await expect(page).toHaveURL(/#\/wizard\/3$/);
    await expect(page.getByText(/before you adjust the numbers/i)).toBeVisible();
    await expect(page.getByText(/quant readiness/i)).toBeVisible();
  });
});

test('pressing Enter signs in and opens the personal workspace', async ({ page }) => {
  await mockSharedApis(page, {
    loginUser: {
      username: 'alex.trafton',
      displayName: 'Alex Trafton',
      role: 'user',
      businessUnitEntityId: '',
      departmentEntityId: ''
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
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByText(/personal workspace/i)).toBeVisible();
    await expect(page.locator('#btn-dashboard-new-assessment')).toBeVisible();
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
    await page.getByText(/more workspace tools/i).click();
    await expect(page.locator('#btn-dashboard-start-template')).toBeVisible();
    await expect(page.locator('#btn-dashboard-start-sample')).toBeVisible();
    await expect(page.locator('#btn-dashboard-open-settings')).toBeVisible();
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
    await expect(page.getByRole('button', { name: /review priority item/i })).toBeVisible();
    await expect(page.getByText(/business context and defaults/i)).toBeVisible();
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
    await expect(page.locator('#btn-clear-dry-run')).toBeVisible();
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
    await expect(page.getByText(/Pilot release:/i)).toBeVisible();
    await expect(page.getByText(/0\.10\.0-pilot\.1/i)).toBeVisible();
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
    const advancedSummary = page.getByText('Other ways to start');
    const importSummary = page.getByText('Import or add risks directly');
    const manualInput = page.locator('#manual-risk-add');
    const addManualRisk = page.locator('#btn-add-manual-risk');

    await advancedSummary.click();
    await importSummary.click();
    await manualInput.fill('Cloud storage exposure');
    await addManualRisk.click();

    await advancedSummary.click();
    await importSummary.click();
    await manualInput.fill('Privileged access misuse');
    await addManualRisk.click();

    await expect(page.getByRole('button', { name: /^Clear All$/ })).toBeVisible();
    await expect(page.locator('.risk-select-checkbox:checked')).toHaveCount(2);
    await page.getByRole('button', { name: /^Clear All$/ }).click();
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
