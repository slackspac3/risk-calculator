const AiStatusClient = (() => {
  const DEFAULT_MODEL = 'gpt-5.1';

  function createClient({
    cacheTtlMs = 30000,
    defaultModel = DEFAULT_MODEL,
    buildStatusUrl,
    getSessionToken,
    normaliseError
  } = {}) {
    let cachedStatus = null;
    let inflightStatusPromise = null;

    function normaliseStatus(value = {}) {
      return {
        mode: String(value?.mode || 'degraded').trim() || 'degraded',
        providerReachable: value?.providerReachable === true,
        model: String(value?.model || defaultModel).trim() || defaultModel,
        proxyConfigured: value?.proxyConfigured !== false,
        checkedAt: Number(value?.checkedAt || Date.now()),
        message: String(value?.message || '').trim()
      };
    }

    function getCachedStatus() {
      return cachedStatus ? { ...cachedStatus } : null;
    }

    async function fetchStatus({ force = false, probe = true } = {}) {
      const cached = getCachedStatus();
      if (!force && cached && (Date.now() - Number(cached.checkedAt || 0)) < cacheTtlMs) {
        return cached;
      }
      if (!force && inflightStatusPromise) {
        return inflightStatusPromise;
      }
      const endpoint = typeof buildStatusUrl === 'function' ? String(buildStatusUrl() || '').trim() : '';
      if (!endpoint) {
        throw new Error('AI status endpoint is unavailable.');
      }
      const sessionToken = typeof getSessionToken === 'function' ? String(getSessionToken() || '') : '';
      const url = new URL(endpoint);
      if (probe) url.searchParams.set('probe', '1');
      inflightStatusPromise = (async () => {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: sessionToken ? { 'x-session-token': sessionToken } : {}
        });
        if (!response.ok) {
          const text = await response.text();
          const error = new Error(`LLM API error ${response.status}: ${text}`);
          throw typeof normaliseError === 'function' ? normaliseError(error) : error;
        }
        const payload = await response.json();
        cachedStatus = normaliseStatus(payload);
        return getCachedStatus();
      })();
      try {
        return await inflightStatusPromise;
      } finally {
        inflightStatusPromise = null;
      }
    }

    return {
      getCachedStatus,
      fetchStatus
    };
  }

  return {
    DEFAULT_MODEL,
    createClient
  };
})();
