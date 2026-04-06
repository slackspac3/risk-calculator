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
      try {
        const data = await requestSharedSettings('GET');
        if (data?.settings) {
          let localSaved = null;
          try {
            localSaved = JSON.parse(localStorage.getItem(GLOBAL_ADMIN_STORAGE_KEY) || 'null');
          } catch (error) {
            warnSharedStateIssueOnce('local-admin-settings-read', 'loadSharedAdminSettings local backup read failed:', error);
          }
          const sharedSettings = {
            ...DEFAULT_ADMIN_SETTINGS,
            ...data.settings,
            applicableRegulations: Array.isArray(data.settings.applicableRegulations)
              ? data.settings.applicableRegulations
              : [...DEFAULT_ADMIN_SETTINGS.applicableRegulations]
          };
          const localHasStructure = Array.isArray(localSaved?.companyStructure) && localSaved.companyStructure.length;
          const sharedHasStructure = Array.isArray(sharedSettings.companyStructure) && sharedSettings.companyStructure.length;
          const localHasLayers = Array.isArray(localSaved?.entityContextLayers) && localSaved.entityContextLayers.length;
          const sharedHasLayers = Array.isArray(sharedSettings.entityContextLayers) && sharedSettings.entityContextLayers.length;
          const merged = {
            ...sharedSettings,
            companyStructure: sharedHasStructure
              ? sharedSettings.companyStructure
              : (localHasStructure ? localSaved.companyStructure : sharedSettings.companyStructure),
            entityContextLayers: sharedHasLayers
              ? sharedSettings.entityContextLayers
              : (localHasLayers ? localSaved.entityContextLayers : sharedSettings.entityContextLayers),
            companyContextSections: sharedSettings.companyContextSections || localSaved?.companyContextSections || null
          };
          let normalisedMerged = applySharedSettingsLocally(merged);
          if ((!sharedHasStructure && localHasStructure) || (!sharedHasLayers && localHasLayers)) {
            try {
              const result = await client.syncSharedAdminSettings(normalisedMerged, {
                category: 'settings',
                eventType: 'shared_settings_rehydrated',
                target: 'global_settings',
                details: { reason: 'local_backup_richer_than_shared' }
              });
              if (result?.settings) {
                normalisedMerged = applySharedSettingsLocally(result.settings);
              }
            } catch (error) {
              if (error?.code === 'WRITE_CONFLICT' && error?.latestSettings) {
                normalisedMerged = applySharedSettingsLocally(error.latestSettings);
              } else {
                console.warn('shared settings rehydrate failed:', error.message);
              }
            }
          }
          return normalisedMerged;
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
