const dns = require('dns').promises;
const net = require('net');
const { resolveAdminActor } = require('./_apiAuth');

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl);
      links.push(url.toString());
    } catch {}
  }
  return Array.from(new Set(links));
}

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

function getRateLimitKey(req, actor) {
  return `${String(actor?.username || 'admin').trim().toLowerCase()}::${String(req.socket?.remoteAddress || 'unknown')}`;
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

function isAdminSecretValid(req) {
  const adminSecret = String(process.env.ADMIN_API_SECRET || '').trim();
  return !!adminSecret && req.headers['x-admin-secret'] === adminSecret;
}

function isBlockedHostname(hostname = '') {
  const value = String(hostname || '').trim().toLowerCase();
  return !value
    || value === 'localhost'
    || value.endsWith('.localhost')
    || value.endsWith('.local')
    || value.endsWith('.internal')
    || value.endsWith('.home')
    || value.endsWith('.corp');
}

function isPrivateIpv4(address = '') {
  const parts = String(address || '').split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = parts;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first >= 224) return true;
  return false;
}

function isPrivateIpv6(address = '') {
  const value = String(address || '').trim().toLowerCase();
  return !value
    || value === '::'
    || value === '::1'
    || value.startsWith('fc')
    || value.startsWith('fd')
    || value.startsWith('fe80:')
    || value.startsWith('::ffff:127.')
    || value.startsWith('::ffff:10.')
    || value.startsWith('::ffff:192.168.')
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(value);
}

function isPrivateAddress(address = '') {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) return isPrivateIpv4(address);
  if (ipVersion === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicHttpUrl(rawUrl) {
  const candidate = new URL(rawUrl);
  if (!['http:', 'https:'].includes(candidate.protocol)) {
    throw new Error('Only http and https websites are allowed.');
  }
  if (candidate.username || candidate.password) {
    throw new Error('Website URLs cannot include embedded credentials.');
  }
  if (candidate.port && !['80', '443'].includes(candidate.port)) {
    throw new Error('Only standard web ports are allowed.');
  }
  const hostname = String(candidate.hostname || '').trim().toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new Error('Private or local network hosts are not allowed.');
  }
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error('Private or local network hosts are not allowed.');
    }
    return candidate;
  }
  const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!Array.isArray(resolved) || !resolved.length) {
    throw new Error('Website host could not be resolved.');
  }
  if (resolved.some(record => isPrivateAddress(record.address))) {
    // Validate DNS results before fetching so public-looking hostnames cannot resolve into private ranges.
    throw new Error('Private or local network hosts are not allowed.');
  }
  return candidate;
}

async function fetchText(url, timeoutMs = 7000, redirectCount = 0) {
  const safeUrl = await assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(safeUrl, {
      headers: {
        'User-Agent': 'Risk-Intelligence-Platform/1.0'
      },
      redirect: 'manual',
      signal: controller.signal
    });
    if (res.status >= 300 && res.status < 400) {
      if (redirectCount >= 4) {
        throw new Error('Website redirected too many times.');
      }
      const location = String(res.headers.get('location') || '').trim();
      if (!location) {
        throw new Error('Website redirect could not be followed.');
      }
      return fetchText(new URL(location, safeUrl).toString(), timeoutMs, redirectCount + 1);
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch ${safeUrl}: HTTP ${res.status}`);
    }
    return res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function sameHost(url, host) {
  try {
    return new URL(url).hostname === host;
  } catch {
    return false;
  }
}

function scoreCandidateUrl(url, rootUrl) {
  try {
    const target = new URL(url);
    const root = new URL(rootUrl);
    const path = target.pathname.toLowerCase();
    let score = sameHost(url, root.hostname) ? 10 : 0;
    if (target.toString() === root.toString()) score += 100;
    if (/about|company|about-us/.test(path)) score += 60;
    if (/leadership|board|governance|trust|responsible|ethics/.test(path)) score += 55;
    if (/privacy|policy|security|compliance/.test(path)) score += 50;
    if (/technology|platform|products|services|solutions|operations|industries|portfolio|business/.test(path)) score += 45;
    if (/news|newsroom|press|media|announcement/.test(path)) score += 35;
    if (/sustainab|impact|esg/.test(path)) score += 30;
    if (/contact|career|jobs/.test(path)) score -= 20;
    score -= Math.min(20, path.split('/').filter(Boolean).length * 2);
    return score;
  } catch {
    return 0;
  }
}

function describeCompanySource(url, rootUrl) {
  try {
    const target = new URL(url);
    const root = new URL(rootUrl);
    const path = target.pathname.toLowerCase();
    if (target.toString() === root.toString()) return 'Official company website: primary landing page';
    if (/about|company|about-us/.test(path)) return 'Official company website: about/company page';
    if (/leadership|board|governance|trust|responsible|ethics/.test(path)) return 'Official company website: leadership or governance page';
    if (/privacy|policy|security|compliance/.test(path)) return 'Official company website: policy, privacy, security, or compliance page';
    if (/technology|platform|products|services|solutions|operations|industries|portfolio|business/.test(path)) return 'Official company website: business, platform, or operating-model page';
    if (/news|newsroom|press|media|announcement/.test(path)) return 'Official company website: newsroom or announcement page';
    if (/sustainab|impact|esg/.test(path)) return 'Official company website: sustainability or public-commitment page';
    return 'Official company website: supporting context page';
  } catch {
    return 'Official company website: supporting context page';
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function deriveCandidateUrls(rootUrl, html) {
  const root = new URL(rootUrl);
  const discovered = extractLinks(html, rootUrl)
    .filter(link => sameHost(link, root.hostname))
    .filter(link => /about|company|solutions|services|products|industries|security|compliance|governance|investor|news|contact|leadership|platform|technology|responsible|sustainab|privacy|policy|trust|case-stud|partners?|portfolio|business|operations?/i.test(link));
  const defaults = [
    rootUrl,
    new URL('/about', root).toString(),
    new URL('/company', root).toString(),
    new URL('/services', root).toString(),
    new URL('/products', root).toString(),
    new URL('/industries', root).toString(),
    new URL('/security', root).toString(),
    new URL('/compliance', root).toString(),
    new URL('/about-us', root).toString(),
    new URL('/leadership', root).toString(),
    new URL('/technology', root).toString(),
    new URL('/platforms', root).toString(),
    new URL('/privacy', root).toString(),
    new URL('/responsible-ai', root).toString(),
    new URL('/sustainability', root).toString(),
    new URL('/newsroom', root).toString()
  ];
  return Array.from(new Set([...defaults, ...discovered]))
    .sort((a, b) => scoreCandidateUrl(b, rootUrl) - scoreCandidateUrl(a, rootUrl))
    .slice(0, 16);
}

function extractCompanySearchTerm(canonicalUrl) {
  const hostname = new URL(canonicalUrl).hostname.replace(/^www\./, '');
  const root = hostname.split('.')[0] || hostname;
  return root.replace(/[-_]+/g, ' ').trim();
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractCompanyAliases(canonicalUrl, rootHtml) {
  const aliases = new Set();
  aliases.add(extractCompanySearchTerm(canonicalUrl));
  const title = stripHtml((String(rootHtml).match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const ogSite = stripHtml((String(rootHtml).match(/property=["']og:site_name["']\s+content=["']([^"']+)["']/i) || [])[1] || '');
  const h1 = stripHtml((String(rootHtml).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  [title, ogSite, h1]
    .map(value => value.split(/[|\-–:]/)[0].trim())
    .filter(value => value && value.length > 2 && value.length < 80)
    .forEach(value => aliases.add(value));
  return Array.from(aliases).slice(0, 4);
}

function inferProfileHints(canonicalUrl, pages, newsItems = []) {
  const combined = pages.map(page => page.content).join(' ').toLowerCase();
  const alias = titleCase(extractCompanySearchTerm(canonicalUrl));

  const sectors = [
    { label: 'cloud and infrastructure services', patterns: [/cloud/, /data cent(?:er|re)/, /infrastructure/, /hosting/, /compute/] },
    { label: 'software and digital platforms', patterns: [/software/, /platform/, /saas/, /application/, /digital platform/] },
    { label: 'cybersecurity services', patterns: [/cyber/, /security operations/, /managed security/, /threat/] },
    { label: 'financial services or fintech offerings', patterns: [/bank/, /payments?/, /fintech/, /lending/, /insurance/] },
    { label: 'healthcare or life sciences services', patterns: [/health/, /clinical/, /patient/, /pharma/, /hospital/] },
    { label: 'industrial, energy, or infrastructure operations', patterns: [/energy/, /industrial/, /plant/, /manufactur/, /logistics/, /utilities?/] },
    { label: 'public-sector or government-facing services', patterns: [/government/, /public sector/, /ministry/, /sovereign/, /national/] },
    { label: 'retail, commerce, or consumer services', patterns: [/retail/, /commerce/, /consumer/, /shop/, /marketplace/] },
    { label: 'consulting or professional services', patterns: [/consulting/, /advisory/, /professional services/, /managed services/] }
  ]
    .filter(item => item.patterns.some(pattern => pattern.test(combined)))
    .map(item => item.label);

  const customerTypes = [
    /government|public sector|ministry|sovereign/.test(combined) ? 'government and public-sector clients' : '',
    /enterprise|businesses|corporate/.test(combined) ? 'enterprise customers' : '',
    /consumer|customer|member|patient|user/.test(combined) ? 'consumer or end-user populations' : '',
    /partner|channel|reseller|ecosystem/.test(combined) ? 'partner and supplier ecosystems' : ''
  ].filter(Boolean);

  const obligations = [];
  if (/personal data|privacy|customer data|user data|patient data/.test(combined)) obligations.push('privacy, personal-data handling, and breach-response obligations');
  if (/cloud|platform|data cent(?:er|re)|infrastructure|uptime|availability/.test(combined)) obligations.push('availability, resilience, business continuity, and service-recovery expectations');
  if (/government|public sector|sovereign|national security/.test(combined)) obligations.push('heightened access control, auditability, and sovereign or public-sector assurance expectations');
  if (/supplier|vendor|partner|third[- ]party/.test(combined)) obligations.push('third-party oversight, dependency management, and supplier resilience obligations');
  if (/health|clinical|patient|medical/.test(combined)) obligations.push('safety-sensitive and health-data governance expectations');
  if (/financial|payments|bank|aml|sanctions/.test(combined)) obligations.push('financial-crime, sanctions, and regulated transaction-control expectations');

  const commitments = [];
  if (/sustainab|net zero|esg/.test(combined)) commitments.push('public sustainability or ESG commitments');
  if (/trust|responsible ai|responsible use|safe ai/.test(combined)) commitments.push('public commitments around trusted, safe, or responsible technology use');
  if (/security|secure by design|privacy/.test(combined)) commitments.push('public commitments around security, privacy, or secure-by-design delivery');
  if (/innovation|growth|expansion|regional|global/.test(combined)) commitments.push('public commitments around growth, innovation, or international expansion');

  const riskSignals = [];
  if (customerTypes.length) riskSignals.push(`${alias} appears to serve ${customerTypes.join(', ')}, which can increase service continuity, compliance, and reputational exposure.`);
  if (sectors.length) riskSignals.push(`${alias} appears to operate in ${sectors.join(', ')}, which increases dependence on technology resilience, cyber controls, and third-party delivery.`);
  if (newsItems.length) riskSignals.push('Recent public news was available and should be reviewed alongside the website narrative for partnership, incident, expansion, and regulatory signals.');

  return {
    alias,
    sectors,
    customerTypes,
    obligations,
    commitments,
    riskSignals
  };
}

function decodeXml(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseRssItems(xml) {
  const items = [];
  const matches = String(xml || '').match(/<item[\s\S]*?<\/item>/gi) || [];
  matches.forEach(block => {
    const title = decodeXml((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
    const link = decodeXml((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '').trim();
    const description = stripHtml(decodeXml((block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '')).trim();
    const pubDate = decodeXml((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '').trim();
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  });
  return items;
}

function isDirectlyRelevantNews(item, aliases = []) {
  const haystack = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  const aliasMatch = aliases.some(alias => String(alias || '').trim() && haystack.includes(String(alias).toLowerCase()));
  if (!aliasMatch) return false;
  return /cyber|breach|outage|incident|fine|sanction|attack|ransomware|jailbreak|security/.test(haystack);
}

function selectNewsCoverage(items = [], aliases = []) {
  const caps = {
    'Local UAE/GCC business news': 5,
    'Regional technology and policy news': 5,
    'Strategy and regulatory news': 5,
    'Leadership and governance news': 4,
    'Global business news': 5,
    'Risk and incident news': 4
  };
  const grouped = new Map();
  items.forEach(item => {
    const list = grouped.get(item.feed) || [];
    list.push(item);
    grouped.set(item.feed, list);
  });
  const orderedFeeds = [
    'Local UAE/GCC business news',
    'Regional technology and policy news',
    'Strategy and regulatory news',
    'Leadership and governance news',
    'Global business news',
    'Risk and incident news'
  ];
  const selected = [];
  const domainCounts = new Map();
  orderedFeeds.forEach(feed => {
    const feedItems = (grouped.get(feed) || []).filter(item => feed !== 'Risk and incident news' || isDirectlyRelevantNews(item, aliases));
    feedItems.forEach((item) => {
      if (selected.length >= 28) return;
      const domain = hostnameOf(item.link);
      const current = domainCounts.get(domain) || 0;
      if (domain && current >= 2) return;
      if ((selected.filter(existing => existing.feed === feed).length) >= (caps[feed] || 4)) return;
      selected.push(item);
      if (domain) domainCounts.set(domain, current + 1);
    });
  });
  return selected.slice(0, 28);
}

async function fetchNewsContext(canonicalUrl, rootHtml = '') {
  const aliases = extractCompanyAliases(canonicalUrl, rootHtml);
  const quotedAlias = encodeURIComponent(`"${aliases[0] || extractCompanySearchTerm(canonicalUrl)}"`);
  const aliasQuery = aliases.map(alias => `"${alias}"`).join(' OR ');
  const encodedAliasQuery = encodeURIComponent(aliasQuery);
  const feeds = [
    {
      label: 'Local UAE/GCC business news',
      url: `https://news.google.com/rss/search?q=${encodedAliasQuery}%20(site%3Athenationalnews.com%20OR%20site%3Agulfnews.com%20OR%20site%3Akhaleejtimes.com%20OR%20site%3Azawya.com%20OR%20site%3Aarabianbusiness.com%20OR%20site%3Agulfbusiness.com%20OR%20site%3Aeconomymiddleeast.com)&hl=en-AE&gl=AE&ceid=AE:en`
    },
    {
      label: 'Regional technology and policy news',
      url: `https://news.google.com/rss/search?q=${encodedAliasQuery}%20(site%3Athenationalnews.com%20OR%20site%3Azawya.com%20OR%20site%3Arestofworld.org%20OR%20site%3Atechcrunch.com)%20(AI%20OR%20data%20centre%20OR%20sovereign%20OR%20cloud%20OR%20government)&hl=en-AE&gl=AE&ceid=AE:en`
    },
    {
      label: 'Global business news',
      url: `https://news.google.com/rss/search?q=${encodedAliasQuery}%20(site%3Areuters.com%20OR%20site%3Abloomberg.com%20OR%20site%3Acnbc.com%20OR%20site%3Aft.com%20OR%20site%3Awsj.com%20OR%20site%3Aforbes.com)%20(AI%20OR%20cloud%20OR%20technology%20OR%20partnership)&hl=en-US&gl=US&ceid=US:en`
    },
    {
      label: 'Risk and incident news',
      url: `https://news.google.com/rss/search?q=${quotedAlias}%20(cyber%20OR%20breach%20OR%20outage%20OR%20incident%20OR%20fine%20OR%20sanctions%20OR%20attack%20OR%20ransomware)&hl=en-US&gl=US&ceid=US:en`
    },
    {
      label: 'Strategy and regulatory news',
      url: `https://news.google.com/rss/search?q=${quotedAlias}%20(regulation%20OR%20compliance%20OR%20licence%20OR%20partnership%20OR%20acquisition%20OR%20expansion%20OR%20investment%20OR%20joint%20venture)&hl=en-US&gl=US&ceid=US:en`
    },
    {
      label: 'Leadership and governance news',
      url: `https://news.google.com/rss/search?q=${quotedAlias}%20(board%20OR%20chairman%20OR%20CEO%20OR%20governance%20OR%20responsible%20AI%20OR%20ethics)&hl=en-US&gl=US&ceid=US:en`
    }
  ];
  const feedResults = await Promise.allSettled(
    feeds.map(feed => fetchText(feed.url, 6000).then(xml => ({ feed, xml })))
  );
  const results = [];
  feedResults.forEach(result => {
    if (result.status !== 'fulfilled') return;
    const items = parseRssItems(result.value.xml).slice(0, 8).map(item => ({
      ...item,
      feed: result.value.feed.label
    }));
    results.push(...items);
  });
  const deduped = Array.from(new Map(results.map(item => [item.link, item])).values());
  return selectNewsCoverage(deduped, aliases);
}

function buildFallbackProfile(canonicalUrl, pages, newsItems = []) {
  const hints = inferProfileHints(canonicalUrl, pages, newsItems);
  const sectorText = hints.sectors.length ? hints.sectors.join(', ') : 'technology-enabled products or services';
  const customerText = hints.customerTypes.length ? hints.customerTypes.join(', ') : 'enterprise, institutional, or end-user stakeholders';
  return {
    companySummary: `Public context was gathered for ${canonicalUrl}, but the AI response could not be parsed cleanly. This fallback summary is based on public website content${newsItems.length ? ' and public news coverage' : ''} only.`,
    businessProfile: `${hints.alias} appears to provide ${sectorText} to ${customerText}. Review the extracted public context manually and refine the profile before saving it into the admin baseline.`,
    operatingModel: `${hints.alias} likely operates through a mix of internally delivered capabilities, digital platforms, operational teams, and third-party partners or suppliers where relevant. Public materials should be checked for geographic footprint, regulated customers, and service criticality before relying on this summary.`,
    publicCommitments: hints.commitments.length ? hints.commitments : ['Public materials suggest commitments that should be validated manually before being used in the platform context.'],
    riskSignals: hints.riskSignals.length ? hints.riskSignals : ['Public website content suggests a need to assess technology reliance, data handling, third-party dependencies, and resilience requirements.'],
    likelyObligations: hints.obligations.length ? hints.obligations : ['Likely obligations include data protection, service resilience, third-party oversight, and governance over material technology dependencies.'],
    regulatorySignals: [],
    aiGuidance: 'Use the public website material as a starting point, then refine the business profile, likely regulations, and technology exposure manually before relying on it in assessments.',
    suggestedGeography: '',
    sources: [
      ...pages.map(page => ({ url: page.url, note: page.note || 'Official company website page fetched for context building.' })),
      ...newsItems.map(item => ({ url: item.link, note: `${item.feed}: ${item.title}` }))
    ]
  };
}

function tryParseStructuredJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const candidates = [
    text,
    text.replace(/```json\n?|```/g, '').trim()
  ];
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

async function repairStructuredJson(raw, canonicalUrl, pages, newsItems, compassApiUrl, compassModel, compassApiKey) {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return null;
  const repairPrompt = `You repair malformed model output into strict JSON for a company risk context builder.
Return ONLY valid JSON matching this schema:
{
  "companySummary": "string",
  "businessProfile": "string",
  "operatingModel": "string",
  "publicCommitments": ["string"],
  "riskSignals": ["string"],
  "likelyObligations": ["string"],
  "regulatorySignals": ["string"],
  "aiGuidance": "string",
  "suggestedGeography": "string",
  "sources": [{"url":"string","note":"string"}]
}`;
  const repairUser = `Website: ${canonicalUrl}

Original malformed response:
${cleaned}

Known website sources:
${pages.map(page => `${page.url}`).join('\n')}

Known news sources:
${newsItems.map(item => `${item.link}`).join('\n')}

Repair the response into the required JSON schema. Preserve company-specific meaning. If a field is missing, infer cautiously from the malformed response and sources only.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch(compassApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${compassApiKey}`
      },
      body: JSON.stringify({
        model: compassModel,
        max_completion_tokens: 1400,
        temperature: 0,
        messages: [
          { role: 'system', content: repairPrompt },
          { role: 'user', content: repairUser }
        ]
      }),
      signal: controller.signal
    });
    if (!upstream.ok) return null;
    const payload = await upstream.json();
    return tryParseStructuredJson(payload.choices?.[0]?.message?.content || '');
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseContextPayload(parsed, canonicalUrl, pages, newsItems) {
  const fallback = buildFallbackProfile(canonicalUrl, pages, newsItems);
  if (!parsed || typeof parsed !== 'object') return fallback;
  return {
    companySummary: String(parsed.companySummary || fallback.companySummary),
    businessProfile: String(parsed.businessProfile || fallback.businessProfile),
    operatingModel: String(parsed.operatingModel || fallback.operatingModel || ''),
    publicCommitments: Array.isArray(parsed.publicCommitments) && parsed.publicCommitments.length ? parsed.publicCommitments.map(String) : fallback.publicCommitments,
    riskSignals: Array.isArray(parsed.riskSignals) && parsed.riskSignals.length ? parsed.riskSignals.map(String) : fallback.riskSignals,
    likelyObligations: Array.isArray(parsed.likelyObligations) && parsed.likelyObligations.length ? parsed.likelyObligations.map(String) : fallback.likelyObligations,
    regulatorySignals: Array.isArray(parsed.regulatorySignals) ? parsed.regulatorySignals.map(String) : fallback.regulatorySignals,
    aiGuidance: String(parsed.aiGuidance || fallback.aiGuidance),
    suggestedGeography: String(parsed.suggestedGeography || fallback.suggestedGeography || ''),
    sources: Array.isArray(parsed.sources) && parsed.sources.length
      ? parsed.sources.map(source => ({
          url: String(source.url || ''),
          note: String(source.note || '')
        })).filter(source => source.url)
      : fallback.sources
  };
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://slackspac3.github.io';
  const compassApiUrl = process.env.COMPASS_API_URL || 'https://api.core42.ai/v1/chat/completions';
  const compassModel = process.env.COMPASS_MODEL || 'gpt-5.1';
  const body = parseRequestBody(req);

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-admin-secret,x-session-token');
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
    console.error('Company context route is missing COMPASS_API_KEY.');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  const origin = req.headers.origin;
  if (!origin || origin === 'null' || origin !== allowedOrigin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const actor = resolveAdminActor(req, res, {
    isAdminSecretValid,
    allowRoles: ['admin']
  });
  if (!actor) return;

  const retryAfterSeconds = checkRateLimit(getRateLimitKey(req, actor));
  if (retryAfterSeconds) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  if (!isPlainObject(body)) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const bodyStr = JSON.stringify(body || {});
  if (bodyStr.length > 500000) {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }

  const websiteUrl = String(body.websiteUrl || '').trim().slice(0, 2048);
  if (!websiteUrl) {
    res.status(400).json({ error: 'websiteUrl is required.' });
    return;
  }

  let canonicalUrl;
  try {
    const validatedUrl = await assertPublicHttpUrl(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    canonicalUrl = validatedUrl.toString();
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid website URL.' });
    return;
  }

  let pages = [];
  let newsItems = [];
  try {
    const rootHtml = await fetchText(canonicalUrl);
    const candidateUrls = deriveCandidateUrls(canonicalUrl, rootHtml);

    const pageResults = await Promise.allSettled(
      candidateUrls.slice(0, 10).map(url =>
        (url === canonicalUrl ? Promise.resolve(rootHtml) : fetchText(url, 6500))
          .then(html => ({ url, html }))
      )
    );
    pages = pageResults
      .filter(result => result.status === 'fulfilled')
      .map(result => ({
        url: result.value.url,
        note: describeCompanySource(result.value.url, canonicalUrl),
        content: stripHtml(result.value.html).slice(0, 7000)
      }))
      .filter(page => page.content.length > 200)
      .slice(0, 9);

    if (!pages.length) {
      throw new Error('No usable public website content could be extracted from the supplied URL.');
    }

    const aliases = extractCompanyAliases(canonicalUrl, rootHtml);
    newsItems = await fetchNewsContext(canonicalUrl, rootHtml);

    const systemPrompt = `You are a senior enterprise risk advisor. Given public company website material and public news context, produce a concise business-risk context profile.
Respond ONLY with valid JSON matching this schema:
{
  "companySummary": "string",
  "businessProfile": "string",
  "operatingModel": "string",
  "publicCommitments": ["string"],
  "riskSignals": ["string"],
  "likelyObligations": ["string"],
  "regulatorySignals": ["string"],
  "aiGuidance": "string",
  "suggestedGeography": "string",
  "sources": [{"url":"string","note":"string"}]
}`;

    const userPrompt = `Website URL: ${canonicalUrl}

Public website extracts:
${pages.map((page, idx) => `Source ${idx + 1}: ${page.url}\n${page.content}`).join('\n\n')}

Known company aliases:
${aliases.join(', ')}

Public news context:
${newsItems.length ? newsItems.map((item, idx) => `News ${idx + 1}: ${item.feed} | ${item.title} | ${item.pubDate}\n${item.description}\n${item.link}`).join('\n\n') : '(no public news items were retrieved)'}

Instructions:
- infer the company's business model, operating profile, technology reliance, public commitments, likely obligations, data exposure, and likely regulatory posture
- focus on technology, cyber, operational resilience, third-party, compliance, and data risks
- use the aliases and the mix of local, regional, and global news to widen the context beyond the company website
- treat official company pages as the primary evidence base and use news only to supplement, challenge, or extend that picture
- weigh company pages covering leadership, governance, partnerships, privacy, responsible AI, operations, sustainability, and technology posture when available
- use the broader source set to infer ownership signals, strategic partnerships, governance posture, and sector-specific dependencies
- prefer source diversity over repeating the same outlet unless it adds materially different evidence
- keep the output useful for setting admin context for a risk quantification platform
- mention that this is based on public website and public news context only
- prefer concrete, company-specific statements over generic technology-company language
- if the company appears to serve governments, healthcare, energy, cloud, sovereign infrastructure, or regulated environments, make that explicit
- do not describe the company as an AI or cloud provider unless the supplied sources clearly support that statement
- avoid generic filler such as "cross-sector solutions" or "partner-led delivery model" unless those ideas are explicitly supported by the supplied sources
- use British English`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const upstream = await fetch(compassApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COMPASS_API_KEY}`
      },
      body: JSON.stringify({
        model: compassModel,
        max_completion_tokens: 2200,
        temperature: 0.15,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('Company context AI request failed.', { status: upstream.status, bodyPreview: String(text || '').slice(0, 400) });
      res.status(upstream.status).json({
        error: 'Company context builder could not analyse the website.'
      });
      return;
    }

    const payload = await upstream.json();
    const raw = payload.choices?.[0]?.message?.content || '';
    let parsed = tryParseStructuredJson(raw);
    if (!parsed) {
      parsed = await repairStructuredJson(raw, canonicalUrl, pages, newsItems, compassApiUrl, compassModel, process.env.COMPASS_API_KEY);
    }
    res.status(200).json(normaliseContextPayload(parsed, canonicalUrl, pages, newsItems));
  } catch (error) {
    if (error?.name === 'AbortError') {
      res.status(504).json({ error: 'Company context request timed out.' });
      return;
    }
    console.error('Company context route failed.', error);
    res.status(502).json({
      error: 'Company context builder could not fetch or analyse the website.'
    });
  }
};
