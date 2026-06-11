'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const {
  buildAssumptionRegisterWorkflow,
  normaliseAssumptionRegisterWorkflowInput
} = require('../_assumptionRegisterWorkflow');

module.exports = createAiJsonRouteHandler({
  routeName: 'assumption-register',
  maxBodyChars: 180000,
  allowedFields: [
    'assessmentType',
    'scenario',
    'structuredScenario',
    'scenarioLens',
    'projectContext',
    'buyerEconomics',
    'buyerEconomicsMeta',
    'sellerEconomics',
    'sellerEconomicsMeta',
    'projectExposure',
    'businessUnit',
    'geography',
    'applicableRegulations',
    'citations',
    'evidenceMap',
    'parameters',
    'results',
    'adminSettings',
    'traceLabel',
    'priorMessages'
  ],
  validationSchema: {
    assessmentType:          { type: 'string', maxLength: 80 },
    scenario:                { type: 'string', maxLength: 5000 },
    structuredScenario:      { type: 'object' },
    projectContext:          { type: 'object' },
    buyerEconomics:          { type: 'object' },
    buyerEconomicsMeta:      { type: 'object' },
    sellerEconomics:         { type: 'object' },
    sellerEconomicsMeta:     { type: 'object' },
    projectExposure:         { type: 'object' },
    businessUnit:            { type: 'object' },
    geography:               { type: 'string', maxLength: 500 },
    applicableRegulations:   { type: 'array', maxItems: 100, itemType: 'string', itemMaxLength: 200 },
    citations:               { type: 'array', maxItems: 50 },
    evidenceMap:             { type: 'object' },
    parameters:              { type: 'object' },
    results:                 { type: 'object' },
    adminSettings:           { type: 'object' },
    traceLabel:              { type: 'string', maxLength: 200 },
    priorMessages:           { type: 'array', maxItems: 50 }
  },
  normaliseInput: normaliseAssumptionRegisterWorkflowInput,
  buildWorkflow: buildAssumptionRegisterWorkflow
});
