'use strict';

function getKvUrl() {
  return process.env.RC_USER_STORE_URL
    || process.env.USER_STORE_KV_URL
    || process.env.KV_REST_API_URL
    || process.env.APPLE_CAT
    || process.env.FOO_URL_TEST
    || '';
}

function getKvToken() {
  return process.env.RC_USER_STORE_TOKEN
    || process.env.USER_STORE_KV_TOKEN
    || process.env.KV_REST_API_TOKEN
    || process.env.BANANA_DOG
    || process.env.FOO_TOKEN_TEST
    || '';
}

function getKvConfig() {
  const url = getKvUrl();
  const token = getKvToken();
  if (!url) {
    throw new Error('KV store URL is not configured. Set RC_USER_STORE_URL or another supported KV URL environment variable.');
  }
  if (!token) {
    throw new Error('KV store token is not configured. Set RC_USER_STORE_TOKEN or another supported KV token environment variable.');
  }
  return { url, token };
}

async function runKvCommand(command) {
  const { url, token } = getKvConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `KV request failed with HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function get(key) {
  const response = await runKvCommand(['GET', key]);
  return response?.result ?? null;
}

async function set(key, value) {
  return runKvCommand(['SET', key, value]);
}

async function setex(key, ttlSeconds, value) {
  const ttl = Math.max(1, Number(ttlSeconds || 0));
  if (ttl) {
    try {
      return await runKvCommand(['SETEX', key, ttl, value]);
    } catch (error) {
      console.error('api/_kvStore.setex falling back to SET after SETEX failure:', error);
    }
  }
  return set(key, value);
}

async function del(key) {
  return runKvCommand(['DEL', key]);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

async function withLock(key, callback, {
  prefix = 'lock::',
  ttlSeconds = 10,
  waitTimeoutMs = 2000,
  retryDelayMs = 60
} = {}) {
  const lockKey = `${String(prefix || 'lock::')}${String(key || '').trim()}`;
  const ownerToken = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const expiresIn = Math.max(1, Math.ceil(Number(ttlSeconds || 10)));
  const deadline = Date.now() + Math.max(100, Number(waitTimeoutMs || 0));
  let acquired = false;
  while (!acquired) {
    const response = await runKvCommand(['SET', lockKey, ownerToken, 'NX', 'EX', expiresIn]);
    acquired = String(response?.result || '').toUpperCase() === 'OK';
    if (acquired) break;
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for KV lock: ${lockKey}`);
    }
    await delay(retryDelayMs);
  }

  try {
    return await callback();
  } finally {
    try {
      const current = await get(lockKey);
      if (String(current || '') === ownerToken) {
        await del(lockKey);
      }
    } catch (error) {
      console.error(`api/_kvStore.withLock failed to release lock ${lockKey}:`, error);
    }
  }
}

module.exports = { del, get, getKvConfig, runKvCommand, set, setex, withLock };
