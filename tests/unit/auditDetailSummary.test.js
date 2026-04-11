'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAuditDetailHelpers() {
  const filePath = path.resolve(__dirname, '../../assets/app.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function formatAuditDetailSummaryValue(');
  const end = source.indexOf('function buildAdminImpactAssessment', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate audit detail helpers in app.js');
  }
  const snippet = source.slice(start, end);
  const context = {
    formatFilterLabel(value = '', fallback = 'Unknown') {
      const text = String(value || '').trim();
      if (!text) return fallback;
      return text
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }
  };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'app.js' });
  return {
    formatAuditDetails: context.formatAuditDetails
  };
}

test('formatAuditDetails prioritises truncation and failure stage for AI audit rows', () => {
  const { formatAuditDetails } = loadAuditDetailHelpers();
  const summary = formatAuditDetails({
    taskName: 'refineEntityContext',
    message: 'The AI returned an unusable structured response for this task. Try again.',
    promptTruncated: true,
    promptLimit: 28000,
    failureStage: 'structured_parse'
  }, {
    category: 'ai',
    eventType: 'ai_request_failed'
  });

  assert.match(summary, /taskName: refineEntityContext/i);
  assert.match(summary, /failure stage: Structured Parse/i);
  assert.match(summary, /prompt truncated at 28000 chars/i);
  assert.doesNotMatch(summary, /promptLimit:/i);
});
