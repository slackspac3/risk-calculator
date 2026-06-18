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

function buildAuditSummary(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const isAuthEvent = entry => ['login_success', 'login_failure', 'logout'].includes(String(entry?.eventType || '').trim().toLowerCase());
  return {
    total: list.length,
    retainedCapacity: 500,
    loginSuccessCount: list.filter(entry => entry?.eventType === 'login_success').length,
    loginFailureCount: list.filter(entry => entry?.eventType === 'login_failure').length,
    logoutCount: list.filter(entry => entry?.eventType === 'logout').length,
    adminActionCount: list.filter(entry => entry?.actorRole === 'admin' && !isAuthEvent(entry)).length,
    buAdminActionCount: list.filter(entry => entry?.actorRole === 'bu_admin' && !isAuthEvent(entry)).length,
    userActionCount: list.filter(entry => entry?.actorRole === 'user' && !isAuthEvent(entry)).length
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
  preferredAdminSection = 'org',
  apiSessionToken = 'test-session-token'
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
    session: buildSession({ username, displayName, role, businessUnitEntityId, departmentEntityId }, apiSessionToken),
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
  skipUsers = false,
  managedAccounts = null,
  auditEntries = null,
  auditSummary = null,
  onAuditRequest = null,
  reviewQueueItems = null,
  reviewQueueTargets = null,
  reviewQueueRequests = null,
  orgIntelligenceState = null
} = {}) {
  if (!skipUsers) await page.route('**/api/users**', async route => {
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
      body: JSON.stringify({
        accounts: Array.isArray(managedAccounts) ? managedAccounts : [],
        storage: { writable: true, mode: 'shared-kv' }
      })
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
    const entries = Array.isArray(auditEntries) ? auditEntries : [];
    if (typeof onAuditRequest === 'function') onAuditRequest(request);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(request.method() === 'GET'
        ? { entries, summary: auditSummary || buildAuditSummary(entries) }
        : { ok: true })
    });
  });

  if (reviewQueueItems !== null || reviewQueueTargets !== null || Array.isArray(reviewQueueRequests)) {
    await page.route('**/api/review-queue*', async route => {
      const request = route.request();
      if (Array.isArray(reviewQueueRequests)) {
        reviewQueueRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.searchParams.get('view') === 'targets') {
        const targets = Array.isArray(reviewQueueTargets) ? reviewQueueTargets : [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            action: String(url.searchParams.get('action') || 'submit').trim().toLowerCase() === 'escalate' ? 'escalate' : 'submit',
            targets,
            defaultTargetUsername: String(targets[0]?.username || '')
          })
        });
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: Array.isArray(reviewQueueItems) ? reviewQueueItems : []
          })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, item: null })
      });
    });
  }

  if (orgIntelligenceState !== null) {
    await page.route('**/api/org-intelligence', async route => {
      const request = route.request();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(request.method() === 'GET'
          ? orgIntelligenceState
          : { ok: true, feedback: { updatedAt: Date.now(), events: [] } })
      });
    });
  }
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
  mockSharedApis,
  mockProjectExposureMap,
  seedAuthenticatedUser,
  seedAuthenticatedWorkspace
};
