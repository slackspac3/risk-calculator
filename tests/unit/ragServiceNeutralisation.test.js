'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadRagInternals() {
  const filePath = path.resolve(__dirname, '../../assets/services/ragService.js');
  const source = fs.readFileSync(filePath, 'utf8').replace(
    '  return { init, isReady, retrieveRelevantDocs, getDocsForBU, addDocument, bulkAddDocuments };',
    '  globalThis.__ragInternals = { _getFeedbackRetrievalProfile, _feedbackBoost }; return { init, isReady, retrieveRelevantDocs, getDocsForBU, addDocument, bulkAddDocuments };'
  );
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    URL,
    Date,
    Math,
    JSON,
    Promise,
    Set,
    Map,
    setTimeout,
    clearTimeout,
    window: {}
  };
  context.global = context;
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: filePath });
  return context.__ragInternals;
}

test('browser-side feedback retrieval weighting stays neutralized', () => {
  const internals = loadRagInternals();
  assert.equal(
    internals._getFeedbackRetrievalProfile('g42', { raw: 'identity compromise' }),
    null
  );
  assert.equal(
    internals._feedbackBoost({ id: 'doc-1' }, { combined: { docWeights: { 'doc-1': 4 } } }),
    0
  );
});
