'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadComposeGuidedNarrative() {
  const filePath = path.resolve(__dirname, '../../assets/app.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const start = source.indexOf('function composeGuidedNarrative(');
  const end = source.indexOf('\n\n// ─── APP BAR', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not locate composeGuidedNarrative in app.js');
  }
  const snippet = source.slice(start, end);
  const context = {
    console,
    normaliseScenarioLensHint(value = '') {
      return String(value || '').trim().toLowerCase();
    }
  };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'app.js' });
  return context.composeGuidedNarrative;
}

test('composeGuidedNarrative keeps cross-border health-data wording out of OT drift', () => {
  const composeGuidedNarrative = loadComposeGuidedNarrative();
  const narrative = composeGuidedNarrative({
    event: 'Sensitive health data is transferred across borders for analytics without a completed transfer assessment, but there is no evidence the data was exposed.',
    urgency: 'medium'
  }, {
    lensLabel: 'Compliance',
    lensKey: 'compliance'
  });

  assert.match(narrative, /cross-border transfer and privacy-safeguards issue/i);
  assert.match(narrative, /transfer-assessment discipline|safeguards/i);
  assert.doesNotMatch(narrative, /OT and site-resilience|industrial-control|telemetry|site-recovery|safety/i);
});

test('composeGuidedNarrative keeps greenwashing wording in the ESG disclosure lane', () => {
  const composeGuidedNarrative = loadComposeGuidedNarrative();
  const narrative = composeGuidedNarrative({
    event: 'Public sustainability claims about emissions reductions cannot be substantiated because the underlying supplier data does not reconcile to activity assumptions.',
    urgency: 'medium'
  }, {
    lensLabel: 'ESG',
    lensKey: 'esg'
  });

  assert.match(narrative, /ESG disclosure and claim-substantiation issue/i);
  assert.match(narrative, /sustainability-claim evidence base|supplier-data reconciliation/i);
  assert.doesNotMatch(narrative, /OT and site-resilience|industrial-control|telemetry|site-recovery|safety/i);
});

test('composeGuidedNarrative keeps payroll processor incidents out of supplier-delivery templates', () => {
  const composeGuidedNarrative = loadComposeGuidedNarrative();
  const narrative = composeGuidedNarrative({
    event: 'A third-party payroll processor applies a configuration change that misroutes salary payments, exposing bank details to the wrong employees and delaying correction because incident ownership is unclear.',
    urgency: 'medium'
  }, {
    lensLabel: 'General enterprise risk',
    lensKey: 'general'
  });

  assert.match(narrative, /third-party payroll processing and data-handling failure/i);
  assert.match(narrative, /payroll processing, employee bank-detail handling, and incident-ownership path/i);
  assert.doesNotMatch(narrative, /supplier-dependency and delivery issue|infrastructure deployment|milestone plan|dependent business projects|project slippage/i);
});
