const DEFAULT_ALLOWED_HEADERS = 'authorization,content-type';
const DEFAULT_ALLOWED_METHODS = 'POST,OPTIONS';

function corsHeaders(origin, allowedOrigin) {
  const allowOrigin = origin === allowedOrigin ? origin : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': DEFAULT_ALLOWED_METHODS,
    'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const origin = request.headers.get('Origin') || allowedOrigin;
    const headers = corsHeaders(origin, allowedOrigin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, headers);
    }

    if (origin !== allowedOrigin) {
      return json({ error: 'Origin not allowed' }, 403, headers);
    }

    if (!env.COMPASS_API_KEY) {
      return json({ error: 'Missing COMPASS_API_KEY secret in Worker.' }, 500, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400, headers);
    }

    const upstreamBody = {
      ...body,
      model: body.model || env.COMPASS_MODEL || 'gpt-5.1'
    };

    try {
      const upstream = await fetch(env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.COMPASS_API_KEY}`
        },
        body: JSON.stringify(upstreamBody)
      });

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...headers,
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json'
        }
      });
    } catch (error) {
      return json({
        error: 'Worker could not reach Compass.',
        detail: error instanceof Error ? error.message : String(error)
      }, 502, headers);
    }
  }
};
