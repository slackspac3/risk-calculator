'use strict';

const {
  applyUserWorkspacePatch,
  normaliseUserWorkspaceState
} = require('../../../assets/state/userWorkspacePersistence.js');

function buildSession(user, apiSessionToken = 'e2e-session-token') {
  return {
    authenticated: true,
    ts: Date.now(),
    user,
    apiSessionToken,
    context: {}
  };
}

function buildEmptyOrgIntelligenceState() {
  return {
    patterns: [],
    calibration: { updatedAt: 0, scenarioTypes: {} },
    decisions: [],
    coverageMap: { updatedAt: 0, scenarioTypes: {} },
    feedback: { updatedAt: 0, events: [] }
  };
}

async function seedAuthenticatedWorkspace(page, {
  user,
  userSettings,
  adminSettings,
  draft = null,
  assessments = [],
  learningStore = { templates: {} },
  apiSessionToken = 'e2e-session-token'
}) {
  let storedState = normaliseUserWorkspaceState({
    userSettings,
    assessments,
    learningStore,
    draft,
    _meta: { revision: 1, updatedAt: Date.now() }
  });

  await page.addInitScript(({ session, userSettings, adminSettings }) => {
    sessionStorage.setItem('rq_auth_session', JSON.stringify(session));
    localStorage.setItem(`rq_user_settings__${session.user.username}`, JSON.stringify(userSettings));
    localStorage.setItem('rq_admin_settings', JSON.stringify(adminSettings));
  }, {
    session: buildSession(user, apiSessionToken),
    userSettings,
    adminSettings
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
      body: JSON.stringify({ settings: adminSettings || {} })
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
      body: JSON.stringify(buildEmptyOrgIntelligenceState())
    });
  });

  return {
    getState: () => storedState
  };
}

async function mockProjectExposureMap(page, { requests, responseFactory }) {
  await page.route('**/api/ai/project-exposure-map', async route => {
    const payload = route.request().postDataJSON();
    if (Array.isArray(requests)) requests.push(payload);
    const response = typeof responseFactory === 'function' ? responseFactory(payload) : responseFactory;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response || {})
    });
  });
}

module.exports = {
  buildSession,
  mockProjectExposureMap,
  seedAuthenticatedWorkspace
};
