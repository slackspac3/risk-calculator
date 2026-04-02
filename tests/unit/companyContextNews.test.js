'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseRssItems,
  selectNewsCoverage,
  buildNewsFeeds
} = require('../../api/company-context');

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
