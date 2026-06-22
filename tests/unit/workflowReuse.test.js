'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resetWorkflowReuseState, withWorkflowReuse } = require('../../api/_workflowReuse');

test.afterEach(() => {
  resetWorkflowReuseState();
});

test('withWorkflowReuse does not cache deterministic fallback results by default', async () => {
  let calls = 0;
  const request = {
    workflow: 'unit-fallback',
    scopeKey: 'alex',
    fingerprintInput: { scenario: 'same' },
    compute: async () => {
      calls += 1;
      return { usedFallback: true, value: calls };
    }
  };

  const first = await withWorkflowReuse(request);
  const second = await withWorkflowReuse(request);

  assert.equal(first.value, 1);
  assert.equal(second.value, 2);
  assert.equal(calls, 2);
});

test('withWorkflowReuse still caches live AI results', async () => {
  let calls = 0;
  const request = {
    workflow: 'unit-live',
    scopeKey: 'alex',
    fingerprintInput: { scenario: 'same' },
    compute: async () => {
      calls += 1;
      return { usedFallback: false, value: calls };
    }
  };

  const first = await withWorkflowReuse(request);
  const second = await withWorkflowReuse(request);

  assert.equal(first.value, 1);
  assert.equal(second.value, 1);
  assert.equal(calls, 1);
});
