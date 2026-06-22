const { requireSession } = require('./_apiAuth');
const { DEFAULT_COMPASS_MODEL } = require('./_aiRuntime');
const { applyCorsHeaders, isAllowedOrigin, isPlainObject, parseRequestBody } = require('./_request');
const { checkRateLimit } = require('./_rateLimit');

function getRateLimitKey(req, session) {
  return `${String(session?.username || 'anonymous').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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

const SAFE_COMPASS_FIELDS = new Set(['messages', 'max_completion_tokens', 'temperature', 'response_format', 'stream']);
const SAFE_MESSAGE_ROLES = new Set(['system', 'user', 'assistant']);

function buildSafeCompassBody(body, compassModel) {
  const unexpected = Object.keys(body || {}).filter(field => !SAFE_COMPASS_FIELDS.has(field));
  if (unexpected.length) {
    return { error: `Unsupported Compass request fields: ${unexpected.join(', ')}` };
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length || messages.length > 16) {
    return { error: 'messages must include between 1 and 16 chat messages.' };
  }
  const safeMessages = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return { error: 'messages must be objects.' };
    }
    const role = String(message.role || '').trim();
    const content = String(message.content || '');
    if (!SAFE_MESSAGE_ROLES.has(role) || !content.trim() || content.length > 24000) {
      return { error: 'messages contain an unsupported role or content length.' };
    }
    safeMessages.push({ role, content });
  }
  const maxCompletionTokens = Number(body.max_completion_tokens || 1200);
  if (!Number.isFinite(maxCompletionTokens) || maxCompletionTokens < 1 || maxCompletionTokens > 4000) {
    return { error: 'max_completion_tokens must be between 1 and 4000.' };
  }
  const temperature = Number(body.temperature ?? 0.3);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
    return { error: 'temperature must be between 0 and 1.' };
  }
  const responseFormat = body.response_format;
  if (responseFormat !== undefined) {
    if (!responseFormat || typeof responseFormat !== 'object' || Array.isArray(responseFormat) || responseFormat.type !== 'json_object') {
      return { error: 'Only response_format.type=json_object is supported.' };
    }
  }
  return {
    value: {
      model: compassModel,
      max_completion_tokens: Math.floor(maxCompletionTokens),
      temperature,
      ...(body.stream === true ? { stream: true } : {}),
      ...(responseFormat ? { response_format: { type: 'json_object' } } : {}),
      messages: safeMessages
    }
  };
}

module.exports = async function handler(req, res) {
  const compassApiUrl = process.env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions';
  const compassModel = process.env.COMPASS_MODEL || DEFAULT_COMPASS_MODEL;
  applyCorsHeaders(req, res, {
    methods: 'POST,OPTIONS',
    headers: 'content-type,x-session-token'
  });

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
  if (!origin || !isAllowedOrigin(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const rateLimit = await checkRateLimit(getRateLimitKey(req, session), { maxPerWindow: 20, windowMs: 60000 });
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    res.status(rateLimit.unavailable ? 503 : 429).json({
      error: rateLimit.unavailable ? 'Request throttling is temporarily unavailable' : 'Rate limit exceeded'
    });
    return;
  }

  const body = parseRequestBody(req);
  if (!isPlainObject(body)) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const bodyStr = JSON.stringify(body || {});
  if (bodyStr.length > 500000) {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }

  const safeBody = buildSafeCompassBody(body, compassModel);
  if (safeBody.error) {
    res.status(400).json({ error: safeBody.error });
    return;
  }
  const upstreamBody = safeBody.value;
  const wantsStream = upstreamBody.stream === true;

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
