(function(global) {
  'use strict';

  const warnedSharedStateIssues = new Set();

  function warnSharedStateIssueOnce(key, message, error = null) {
    if (warnedSharedStateIssues.has(key)) return;
    warnedSharedStateIssues.add(key);
    console.warn(message, error?.message || error || '');
  }

  const client = {
    async loadSharedAdminSettings() {
      const hasApiSession = typeof AuthService?.getApiSessionToken === 'function' && !!AuthService.getApiSessionToken();
      const hasAdminSecret = typeof AuthService?.getAdminApiSecret === 'function' && !!AuthService.getAdminApiSecret();
      if (!hasApiSession && !hasAdminSecret) {
        return null;
      }
      try {
        const data = await requestSharedSettings('GET');
        if (data?.settings) {
          const sharedSettings = normaliseAdminSettings({
            ...DEFAULT_ADMIN_SETTINGS,
            ...data.settings,
            applicableRegulations: Array.isArray(data.settings.applicableRegulations)
              ? data.settings.applicableRegulations
              : [...DEFAULT_ADMIN_SETTINGS.applicableRegulations]
          });
          return applySharedSettingsLocally(sharedSettings, { source: 'shared' });
        }
      } catch (error) {
        console.warn('loadSharedAdminSettings fallback:', error.message);
      }
      return null;
    },

    syncSharedAdminSettings(settings, audit = null) {
      const normalised = normaliseAdminSettings(settings);
      return requestSharedSettings(
        'PUT',
        {
          settings: normalised,
          expectedMeta: buildExpectedMeta(getAdminSettings()._meta),
          audit
        },
        { includeAdminSecret: true }
      );
    },

    async requestUserState(method = 'GET', username, payload, audit = null) {
      const safeUsername = String(username || '').trim().toLowerCase();
      const url = method === 'GET'
        ? `${getUserStateApiUrl()}?username=${encodeURIComponent(safeUsername)}`
        : getUserStateApiUrl();
      const headers = {
        'Content-Type': 'application/json'
      };
      if (AuthService.getApiSessionToken()) headers['x-session-token'] = AuthService.getApiSessionToken();
      const res = await fetch(url, {
        method,
        headers,
        body: method === 'GET'
          ? undefined
          : JSON.stringify(
              method === 'PATCH'
                ? {
                    username: safeUsername,
                    patch: payload?.patch && typeof payload.patch === 'object' ? payload.patch : (payload || {}),
                    expectedMeta: buildExpectedMeta(payload?.expectedMeta),
                    audit
                  }
                : {
                    username: safeUsername,
                    state: payload?.state && typeof payload.state === 'object' ? payload.state : (payload || {}),
                    expectedMeta: buildExpectedMeta(payload?.expectedMeta || payload?.state?._meta),
                    audit
                  }
            )
      });
      const text = await res.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch (error) {
        warnSharedStateIssueOnce('shared-user-state-parse', 'requestUserState response parse failed:', error);
      }
      if (!res.ok) {
        AuthService.handleApiAuthFailure(res.status, parsed);
        throw AuthService.buildApiError(res, parsed, text || `User state request failed with HTTP ${res.status}`);
      }
      return parsed || {};
    },

    async loadSharedUserState(username = AuthService.getCurrentUser()?.username || '') {
      const safeUsername = String(username || '').trim().toLowerCase();
      if (!safeUsername) return null;
      try {
        const data = await client.requestUserState('GET', safeUsername);
        const state = data?.state || {};
        applyUserStateSnapshotLocally(safeUsername, state);
        return AppState.userStateCache;
      } catch (error) {
        console.warn('loadSharedUserState fallback:', error.message);
        return null;
      }
    }
  };

  global.AppSharedStateClient = client;
})(window);
