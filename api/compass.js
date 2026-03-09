module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const compassApiUrl = process.env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions';
  const compassModel = process.env.COMPASS_MODEL || 'gpt-5.1';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.COMPASS_API_KEY) {
    res.status(500).json({ error: 'Missing COMPASS_API_KEY secret in Vercel.' });
    return;
  }

  const origin = req.headers.origin;
  if (origin && origin !== allowedOrigin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const upstreamBody = {
    ...(req.body || {}),
    model: (req.body && req.body.model) || compassModel
  };

  try {
    const upstream = await fetch(compassApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COMPASS_API_KEY}`
      },
      body: JSON.stringify(upstreamBody)
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: 'Vercel proxy could not reach Compass.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
};
