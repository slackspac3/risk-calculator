const { requireSession } = require('./_apiAuth');

const _rateLimitMap = new Map();

function checkRateLimit(key, maxPerMinute = 20) {
  const now = Date.now();
  const windowMs = 60000;
  const entry = _rateLimitMap.get(key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  _rateLimitMap.set(key, entry);
  return entry.count <= maxPerMinute
    ? null
    : Math.ceil((entry.reset - now) / 1000);
}

function getRateLimitKey(req, session) {
  return `${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseRequestBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return null;
    }
  }
  return req.body ?? {};
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const compassApiUrl = process.env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions';
  const compassModel = process.env.COMPASS_MODEL || 'gpt-5.1';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-session-token');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!req.headers['content-type']?.includes('application/json')) {
    res.status(415).json({ error: 'Content-Type must be application/json' });
    return;
  }

  if (!process.env.COMPASS_API_KEY) {
    console.error('Compass proxy is missing COMPASS_API_KEY.');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  const origin = req.headers.origin;
  if (!origin || origin === 'null' || origin !== allowedOrigin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const retryAfterSeconds = checkRateLimit(getRateLimitKey(req, session));
  if (retryAfterSeconds) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const body = parseRequestBody(req);
  if (!isPlainObject(body)) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const wantsStream = body.stream === true;

  const bodyStr = JSON.stringify(body || {});
  if (bodyStr.length > 500000) {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }

  const upstreamBody = {
    ...body,
    model: (typeof body.model === 'string' && body.model.trim()) || compassModel
  };

  try {
    const upstream = await fetchWithTimeout(compassApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COMPASS_API_KEY}`
      },
      body: JSON.stringify(upstreamBody)
    }, 30000);

    if (wantsStream) {
      if (!upstream.ok) {
        const text = await upstream.text();
        console.error('Compass upstream request failed.', { status: upstream.status, bodyPreview: String(text || '').slice(0, 400) });
        res.status(upstream.status).json({ error: 'Compass request failed' });
        return;
      }
      res.status(upstream.status);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Transfer-Encoding', 'chunked');
      const reader = upstream.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
      return;
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error('Compass upstream request failed.', { status: upstream.status, bodyPreview: String(text || '').slice(0, 400) });
      res.status(upstream.status).json({ error: 'Compass request failed' });
      return;
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    if (error?.name === 'AbortError') {
      res.status(504).json({ error: 'Compass request timed out' });
      return;
    }
    console.error('Compass proxy request failed.', error);
    res.status(502).json({ error: 'Vercel proxy could not reach Compass.' });
  }
};
