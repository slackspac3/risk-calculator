'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBenchmarkService() {
  const filePath = path.resolve(__dirname, '../../assets/services/benchmarkService.js');
  const source = `${fs.readFileSync(filePath, 'utf8')}\n;globalThis.__BenchmarkService = BenchmarkService;`;
  const context = {
    console,
    URL,
    Date,
    Math,
    JSON,
    Promise,
    Set,
    Map,
    Array,
    RegExp,
    window: {}
  };
  context.global = context;
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: filePath });
  return context.__BenchmarkService;
}

const benchmarks = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/benchmarks.json'), 'utf8'));

function initService() {
  const service = loadBenchmarkService();
  service.init(benchmarks);
  return service;
}

test('United States data-breach wording prefers the US breach profile over generic global entries', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'Customer personal data was exposed and breach notification, legal review, and remediation are now underway.',
    geography: 'United States'
  });

  assert.equal(results[0].id, 'bm-databreach-us-ibm-2025');
});

test('United States payment-diversion wording prefers the US BEC benchmark', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'A spoofed executive email redirected supplier payment instructions and triggered an unauthorized wire transfer.',
    geography: 'United States'
  });

  assert.equal(results[0].id, 'bm-financial-bec-us-2024');
});

test('USA mailbox-compromise wording resolves to the US identity benchmark', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'A mailbox compromise exposed payroll records and enabled follow-on account takeover activity.',
    geography: 'USA'
  });

  assert.equal(results[0].id, 'bm-identity-us-ic3-2024');
});

test('IFRS-style ESG disclosure wording in the UAE prefers the UAE ESG disclosure profile', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'Sustainability-related financial disclosures cannot be supported across governance, strategy, risk management, and metrics and targets.',
    geography: 'United Arab Emirates'
  });

  assert.equal(results[0].id, 'bm-esg-disclosure-uae-ifrs-2025');
});

test('United States sustainability-claims wording prefers the US greenwashing profile', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'Public sustainability claims and climate benefit statements cannot be substantiated with underlying evidence.',
    geography: 'United States'
  });

  assert.equal(results[0].id, 'bm-esg-greenwashing-us-2024');
});

test('Human-rights abuse wording stays in ESG rather than procurement', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'Workers report recruitment fees, passport retention, and weak remediation in a supplier labour-broker chain.',
    geography: 'United Arab Emirates'
  });

  assert.equal(results[0].scenarioType, 'esg');
  assert.equal(results[0].id, 'bm-esg-supplychain-rights-global-2026');
});

test('United States outage wording prefers the outage severity benchmark over global continuity guidance', () => {
  const service = initService();
  const results = service.retrieveRelevantBenchmarks({
    query: 'A power event disrupted critical services for hours and recovery coordination remained weak during the outage.',
    geography: 'United States'
  });

  assert.equal(results[0].id, 'bm-businesscontinuity-outage-us-2025');
});
