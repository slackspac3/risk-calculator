'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const dns = require('node:dns');

const companyContextRoute = require('../../api/company-context');

const {
  parseRssItems,
  selectNewsCoverage,
  buildNewsFeeds
} = companyContextRoute;

const originalEnv = {
  ADMIN_API_SECRET: process.env.ADMIN_API_SECRET,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  COMPASS_API_URL: process.env.COMPASS_API_URL,
  COMPASS_MODEL: process.env.COMPASS_MODEL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  KV_REST_API_URL: process.env.KV_REST_API_URL
};
const originalFetch = global.fetch;
const originalLookup = dns.promises.lookup;

function restoreEnv() {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === 'string') process.env[key] = value;
    else delete process.env[key];
  });
}

function createRes() {
  return {
    headers: {},
    statusCode: 0,
    payload: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
  dns.promises.lookup = originalLookup;
});

test('parseRssItems captures the outlet source name when Google News RSS provides it', () => {
  const items = parseRssItems(`
    <rss>
      <channel>
        <item>
          <title>G42 expands cloud footprint</title>
          <link>https://news.google.com/articles/test-1</link>
          <description>Expansion update.</description>
          <pubDate>Wed, 02 Apr 2026 10:00:00 GMT</pubDate>
          <source url="https://www.reuters.com">Reuters</source>
        </item>
      </channel>
    </rss>
  `);

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceName, 'Reuters');
});

test('buildNewsFeeds includes broader global and policy-oriented Google News coverage', () => {
  const feeds = buildNewsFeeds('https://g42.ai/', '<title>G42</title>');
  const labels = feeds.map(feed => feed.label);

  assert.ok(labels.includes('Global tier-1 business and finance news'));
  assert.ok(labels.includes('Global technology and infrastructure news'));
  assert.ok(labels.includes('International policy and regulatory news'));
  assert.ok(labels.includes('Strategy, investment, and partnership news'));

  const combinedUrls = feeds.map(feed => feed.url).join('\n');
  assert.match(combinedUrls, /site%3Areuters\.com/i);
  assert.match(combinedUrls, /site%3Abloomberg\.com/i);
  assert.match(combinedUrls, /site%3Aft\.com/i);
  assert.match(combinedUrls, /site%3Aapnews\.com/i);
  assert.match(combinedUrls, /site%3Atechcrunch\.com/i);
  assert.match(combinedUrls, /site%3Abbc\.com/i);
});

test('selectNewsCoverage preserves outlet diversity across the expanded feed mix', () => {
  const selected = selectNewsCoverage([
    { feed: 'Global tier-1 business and finance news', title: 'One', link: 'https://example.com/1', sourceName: 'Reuters' },
    { feed: 'Global tier-1 business and finance news', title: 'Two', link: 'https://example.com/2', sourceName: 'Reuters' },
    { feed: 'Global tier-1 business and finance news', title: 'Three', link: 'https://example.com/3', sourceName: 'Reuters' },
    { feed: 'Global technology and infrastructure news', title: 'Four', link: 'https://example.com/4', sourceName: 'TechCrunch' },
    { feed: 'International policy and regulatory news', title: 'Five', link: 'https://example.com/5', sourceName: 'BBC' }
  ], ['G42']);

  const reutersItems = selected.filter(item => item.sourceName === 'Reuters');
  assert.equal(reutersItems.length, 2);
  assert.ok(selected.some(item => item.sourceName === 'TechCrunch'));
  assert.ok(selected.some(item => item.sourceName === 'BBC'));
});

test('company context route reads structured function-call arguments before falling back', async () => {
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-ai-key';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_MODEL = 'gpt-test';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-kv-token';
  dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];

  let aiRequestBody = null;
  global.fetch = async (url, options = {}) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      return { ok: true, json: async () => ({ result: null }) };
    }
    if (target === 'https://example.test/ai') {
      aiRequestBody = JSON.parse(String(options.body || '{}'));
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              function_call: {
                arguments: JSON.stringify({
                  summary: 'CPX is a cyber and physical security company serving government and enterprise customers.',
                  businessProfile: 'CPX provides cybersecurity, physical security, and advisory services.',
                  operatingModel: 'CPX operates through specialist security teams and managed delivery capabilities.',
                  publicCommitments: ['Public security and resilience commitments.'],
                  riskSignals: ['Sensitive government and enterprise security work creates trust and resilience exposure.'],
                  likelyObligations: ['Cybersecurity, data protection, and service continuity obligations.'],
                  regulatorySignals: ['UAE security and privacy obligations may be relevant.'],
                  aiGuidance: 'Keep CPX context grounded in security, resilience, and regulated customer exposure.',
                  suggestedGeography: 'UAE',
                  sources: [{ url: 'https://www.cpx.net/', note: 'Official company website.' }]
                })
              }
            }
          }]
        })
      };
    }
    if (target.startsWith('https://news.google.com/')) {
      return { ok: true, text: async () => '<rss><channel></channel></rss>' };
    }
    if (target.startsWith('https://www.cpx.net/')) {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><head><title>CPX</title></head><body>
            <h1>CPX</h1>
            <a href="/about">About</a><a href="/services">Services</a>
            <p>CPX provides cyber security, physical security, managed security services,
            advisory support, resilience capabilities, and trusted operations for government
            and enterprise customers across the UAE. CPX helps organisations protect critical
            assets, improve cyber maturity, manage incidents, and operate sensitive security
            programmes with specialist teams and technology platforms.</p>
          </body></html>`
      };
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const res = createRes();
  await companyContextRoute({
    method: 'POST',
    body: JSON.stringify({ websiteUrl: 'https://www.cpx.net/' }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    socket: { remoteAddress: '203.0.113.10' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.companySummary, 'CPX is a cyber and physical security company serving government and enterprise customers.');
  assert.equal(res.payload.usedFallback, false);
  assert.doesNotMatch(res.payload.companySummary, /could not be parsed cleanly/i);
  assert.equal(aiRequestBody.response_format?.type, 'json_object');
});

test('company context fallback summary remains company-specific when AI output is unusable', async () => {
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-ai-key';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_MODEL = 'gpt-test';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-kv-token';
  dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];

  global.fetch = async (url) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      return { ok: true, json: async () => ({ result: null }) };
    }
    if (target === 'https://example.test/ai') {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            finish_reason: 'stop',
            message: {}
          }]
        })
      };
    }
    if (target.startsWith('https://news.google.com/')) {
      return { ok: true, text: async () => '<rss><channel></channel></rss>' };
    }
    if (target.startsWith('https://www.cpx.net/')) {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><head><title>CPX</title></head><body>
            <h1>CPX</h1>
            <a href="/about">About</a><a href="/services">Services</a>
            <p>CPX provides cyber security, physical security, managed security services,
            advisory support, resilience capabilities, and trusted operations for government
            and enterprise customers across the UAE. CPX helps organisations protect critical
            assets, improve cyber maturity, manage incidents, and operate sensitive security
            programmes with specialist teams and technology platforms.</p>
          </body></html>`
      };
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const res = createRes();
  await companyContextRoute({
    method: 'POST',
    body: JSON.stringify({ websiteUrl: 'https://www.cpx.net/' }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    socket: { remoteAddress: '203.0.113.10' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.payload.companySummary, /^CPX appears to provide /);
  assert.match(res.payload.companySummary, /cybersecurity services/);
  assert.doesNotMatch(res.payload.companySummary, /could not be parsed cleanly/i);
  assert.equal(res.payload.usedFallback, true);
  assert.match(res.payload.responseMessage, /public-source fallback/i);
});

test('company context route returns public-source fallback when the AI provider fails', async () => {
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-ai-key';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_MODEL = 'gpt-test';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-kv-token';
  dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];

  global.fetch = async (url) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      return { ok: true, json: async () => ({ result: null }) };
    }
    if (target === 'https://example.test/ai') {
      return {
        ok: false,
        status: 503,
        text: async () => 'provider unavailable'
      };
    }
    if (target.startsWith('https://news.google.com/')) {
      return { ok: true, text: async () => '<rss><channel></channel></rss>' };
    }
    if (target.startsWith('https://www.cpx.net/')) {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><head><title>CPX</title></head><body>
            <h1>CPX</h1>
            <p>CPX provides cyber security, physical security, managed security services,
            advisory support, resilience capabilities, and trusted operations for government
            and enterprise customers across the UAE.</p>
          </body></html>`
      };
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const res = createRes();
  await companyContextRoute({
    method: 'POST',
    body: JSON.stringify({ websiteUrl: 'https://www.cpx.net/' }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    socket: { remoteAddress: '203.0.113.10' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.usedFallback, true);
  assert.equal(res.payload.aiUnavailable, true);
  assert.match(res.payload.companySummary, /^CPX appears to provide /);
});

test('company context route marks partial AI output as fallback-assisted and filters unverified sources', async () => {
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-ai-key';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_MODEL = 'gpt-test';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-kv-token';
  dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];

  global.fetch = async (url) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      return { ok: true, json: async () => ({ result: null }) };
    }
    if (target === 'https://example.test/ai') {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                companySummary: 'CPX provides cyber and physical security services.',
                sources: [
                  { url: 'https://www.cpx.net/', note: 'Official website.' },
                  { url: 'https://unverified.example/hallucinated', note: 'Model-only source.' }
                ]
              })
            }
          }]
        })
      };
    }
    if (target.startsWith('https://news.google.com/')) {
      return { ok: true, text: async () => '<rss><channel></channel></rss>' };
    }
    if (target.startsWith('https://www.cpx.net/')) {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html><head><title>CPX</title></head><body>
            <h1>CPX</h1>
            <p>CPX provides cyber security, physical security, managed security services,
            advisory support, resilience capabilities, and trusted operations for government
            and enterprise customers across the UAE.</p>
          </body></html>`
      };
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const res = createRes();
  await companyContextRoute({
    method: 'POST',
    body: JSON.stringify({ websiteUrl: 'https://www.cpx.net/' }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    socket: { remoteAddress: '203.0.113.10' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.companySummary, 'CPX provides cyber and physical security services.');
  assert.equal(res.payload.usedFallback, true);
  assert.ok(res.payload.sources.some(source => source.url === 'https://www.cpx.net/'));
  assert.equal(res.payload.sources.some(source => /unverified\.example/.test(source.url)), false);
});

test('company context route accepts metadata-only JavaScript landing pages', async () => {
  process.env.ADMIN_API_SECRET = 'test-admin-secret';
  process.env.ALLOWED_ORIGIN = 'https://slackspac3.github.io';
  process.env.COMPASS_API_KEY = 'test-ai-key';
  process.env.COMPASS_API_URL = 'https://example.test/ai';
  process.env.COMPASS_MODEL = 'gpt-test';
  process.env.KV_REST_API_URL = 'https://example.test/kv';
  process.env.KV_REST_API_TOKEN = 'test-kv-token';
  dns.promises.lookup = async () => [{ address: '93.184.216.34', family: 4 }];

  global.fetch = async (url) => {
    const target = String(url || '');
    if (target === 'https://example.test/kv') {
      return { ok: true, json: async () => ({ result: null }) };
    }
    if (target === 'https://example.test/ai') {
      return {
        ok: true,
        json: async () => ({
          choices: [{ finish_reason: 'stop', message: {} }]
        })
      };
    }
    if (target.startsWith('https://news.google.com/')) {
      return { ok: true, text: async () => '<rss><channel></channel></rss>' };
    }
    if (target.startsWith('https://spidersilk.com/')) {
      return {
        ok: true,
        status: 200,
        text: async () => `
          <html>
            <head>
              <title>spiderSilk - AI-Native Exposure Management</title>
              <meta name="description" content="AI-native exposure management for modern security teams.">
            </head>
            <body><noscript>You need to enable JavaScript to run this app.</noscript></body>
          </html>`
      };
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const res = createRes();
  await companyContextRoute({
    method: 'POST',
    body: JSON.stringify({ websiteUrl: 'https://spidersilk.com/' }),
    headers: {
      origin: 'https://slackspac3.github.io',
      'content-type': 'application/json',
      'x-admin-secret': 'test-admin-secret'
    },
    socket: { remoteAddress: '203.0.113.10' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.payload.companySummary, /cybersecurity services/);
  assert.doesNotMatch(res.payload.companySummary, /could not fetch|could not be parsed/i);
  assert.equal(res.payload.usedFallback, true);
});
