'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const { isPlainObject } = require('../_request');
const {
  buildManualIntakeAssistWorkflow,
  normaliseManualStep1Input
} = require('../_manualStep1Workflow');

const ALLOWED_FIELDS = [
  'riskStatement',
  'registerText',
  'registerMeta',
  'scenarioLensHint',
  'businessUnit',
  'geography',
  'applicableRegulations',
  'citations',
  'adminSettings',
  'traceLabel',
  'priorMessages'
];

function normaliseInput(body = {}) {
  return normaliseManualStep1Input({
    riskStatement: typeof body.riskStatement === 'string' ? body.riskStatement : '',
    registerText: typeof body.registerText === 'string' ? body.registerText : '',
    registerMeta: isPlainObject(body.registerMeta) ? body.registerMeta : null,
    scenarioLensHint: body.scenarioLensHint,
    businessUnit: isPlainObject(body.businessUnit) ? body.businessUnit : null,
    geography: typeof body.geography === 'string' ? body.geography : '',
    applicableRegulations: Array.isArray(body.applicableRegulations) ? body.applicableRegulations : [],
    citations: Array.isArray(body.citations) ? body.citations : [],
    adminSettings: isPlainObject(body.adminSettings) ? body.adminSettings : {},
    traceLabel: typeof body.traceLabel === 'string' ? body.traceLabel : '',
    priorMessages: Array.isArray(body.priorMessages) ? body.priorMessages : []
  });
}

module.exports = createAiJsonRouteHandler({
  routeName: 'manual-intake-assist',
  maxBodyChars: 180000,
  rateLimit: { maxPerWindow: 40, windowMs: 60000 },
  allowedFields: ALLOWED_FIELDS,
  validationSchema: {},
  normaliseInput,
  buildWorkflow: (input) => buildManualIntakeAssistWorkflow(input, {
    traceLabelDefault: 'Step 2 intake assist'
  })
});
