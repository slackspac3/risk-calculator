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
  preferredAdminSection = 'org'
} = {}) {
  await page.addInitScript(({ session, userSettings, adminSettings, preferredAdminSection }) => {
    sessionStorage.setItem('rq_auth_session', JSON.stringify(session));
    if (userSettings) {
      localStorage.setItem(`rq_user_settings__${session.user.username}`, JSON.stringify(userSettings));
    }
    if (adminSettings) {
      localStorage.setItem('rq_admin_settings', JSON.stringify(adminSettings));
    }
    if (preferredAdminSection) {
      localStorage.setItem('rq_admin_active_section', preferredAdminSection);
    }
  }, {
    session: buildSession({ username, displayName, role, businessUnitEntityId: '', departmentEntityId: '' }),
    userSettings,
    adminSettings,
    preferredAdminSection
  });
}

async function mockSharedApis(page, {
  loginUser = null,
  userState = null,
  settings = null
} = {}) {
  await page.route('**/api/users', async route => {
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

test('pressing Enter signs in and opens the personal dashboard', async ({ page }) => {
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
    await expect(page.getByText(/personal dashboard/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /start a new risk assessment/i })).toBeVisible();
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
    await expect(page.getByRole('button', { name: /start a new risk assessment/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open personal settings/i })).toBeVisible();
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
    await expect(page.locator('#btn-admin-logout')).toBeVisible();
  });
});
