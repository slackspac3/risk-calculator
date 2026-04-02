'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadStep3Source() {
  const filePath = path.resolve(__dirname, '../../assets/wizard/step3.js');
  return fs.readFileSync(filePath, 'utf8');
}

test('step3 no longer ships browser-side smart prefill helper logic', () => {
  const source = loadStep3Source();

  assert.equal(source.includes('function renderSmartPrefillBand('), false);
  assert.equal(source.includes('function requestStep3SmartPrefillIfNeeded('), false);
  assert.equal(source.includes('function applyStep3SmartPrefillField('), false);
  assert.equal(source.includes('data-smart-prefill-field'), false);
  assert.equal(source.includes('btn-smart-prefill-apply-all'), false);
});
