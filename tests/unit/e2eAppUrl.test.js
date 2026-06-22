'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { appRoute, getPlaywrightBasePath } = require('../e2e/helpers/appUrl.js');

test('appRoute preserves root routes when Playwright base URL has no path', () => {
  const previous = process.env.PLAYWRIGHT_BASE_URL;
  process.env.PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:8080';
  try {
    assert.equal(getPlaywrightBasePath(), '');
    assert.equal(appRoute('/#/login'), '/#/login');
    assert.equal(appRoute('/assets/app.js'), '/assets/app.js');
  } finally {
    if (previous === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
    else process.env.PLAYWRIGHT_BASE_URL = previous;
  }
});

test('appRoute prefixes GitHub Pages subpath for live e2e routes', () => {
  const previous = process.env.PLAYWRIGHT_BASE_URL;
  process.env.PLAYWRIGHT_BASE_URL = 'https://slackspac3.github.io/risk-calculator/';
  try {
    assert.equal(getPlaywrightBasePath(), '/risk-calculator');
    assert.equal(appRoute('/#/login'), '/risk-calculator/#/login');
    assert.equal(appRoute('/#/wizard/1'), '/risk-calculator/#/wizard/1');
    assert.equal(appRoute('/risk-calculator/#/dashboard'), '/risk-calculator/#/dashboard');
    assert.equal(appRoute('https://example.test/#/login'), 'https://example.test/#/login');
  } finally {
    if (previous === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
    else process.env.PLAYWRIGHT_BASE_URL = previous;
  }
});
