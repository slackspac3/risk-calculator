'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadRagService() {
  const filePath = path.resolve(__dirname, '../../assets/services/ragService.js');
  const source = `${fs.readFileSync(filePath, 'utf8')}\n;globalThis.__RAGService = RAGService;`;
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
  return context.__RAGService;
}

const docs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/docs.json'), 'utf8'));
const buData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/bu.json'), 'utf8'));

function initService() {
  const service = loadRagService();
  service.init(docs, buData);
  return service;
}

test('retrieval surfaces vendor-access references for third-party access weakness wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Vendor accounts have broad access across critical systems without clear segregation.',
    scenarioLens: { key: 'third-party' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso27036-22', 'doc-nist-800161-53'].includes(doc.docId)), true);
});

test('retrieval surfaces sustainability-substantiation references for greenwashing wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Public sustainability claims cannot be substantiated because renewable energy attributes do not match the workload geography.',
    scenarioLens: { key: 'esg' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-ifrs-s1s2-27', 'doc-csrd-esrs-36', 'doc-cdp-74'].includes(doc.docId)), true);
});

test('retrieval surfaces workforce-fatigue references for understaffing wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Repeated weekend bid work, fatigue, and understaffing are creating unsafe delivery conditions.',
    scenarioLens: { key: 'people-workforce' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso45003-78', 'doc-ilo-osh-54'].includes(doc.docId)), true);
});

test('retrieval surfaces continuity references for alternate-workspace fallback wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'A site utility outage forces relocation, but alternate workspace and manual fallback steps are unclear.',
    scenarioLens: { key: 'business-continuity' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso22301-20', 'doc-iso22361-51'].includes(doc.docId)), true);
});

test('retrieval surfaces financial-control references for duplicate-payment wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Duplicate supplier payments were released after approval overrides and weak segregation of duties in the payment step.',
    scenarioLens: { key: 'financial' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-coso-ic-33'].includes(doc.docId)), true);
});

test('retrieval surfaces privacy retention and transfer safeguards references for novel obligation wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Records were kept too long and troubleshooting logs were transferred abroad without lawful basis or transfer safeguards.',
    scenarioLens: { key: 'compliance' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-data-05', 'doc-gdpr-06'].includes(doc.docId)), true);
});

test('retrieval surfaces transformation delivery references for local exception governance wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'The target-state rollout is slipping because local exceptions, site-access constraints, and weak exception governance block delivery.',
    scenarioLens: { key: 'transformation-delivery' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-transformation-delivery-71'].includes(doc.docId)), true);
});
