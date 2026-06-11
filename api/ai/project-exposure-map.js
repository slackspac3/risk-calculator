'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const {
  buildProjectExposureMapWorkflow,
  normaliseProjectExposureWorkflowInput
} = require('../_projectExposureWorkflow');

module.exports = createAiJsonRouteHandler({
  routeName: 'project-exposure-map',
  maxBodyChars: 160000,
  allowedFields: [
    'assessmentType',
    'riskStatement',
    'projectContext',
    'projectHorizon',
    'buyerEconomics',
    'buyerEconomicsMeta',
    'sellerEconomics',
    'sellerEconomicsMeta',
    'buyerProxyAnswers',
    'sellerProxyAnswers',
    'businessUnit',
    'geography',
    'applicableRegulations',
    'citations',
    'adminSettings',
    'traceLabel',
    'priorMessages'
  ],
  validationSchema: {
    assessmentType:          { type: 'string', maxLength: 80 },
    riskStatement:           { type: 'string', maxLength: 5000 },
    projectContext:          { type: 'object' },
    projectHorizon:          { type: 'object' },
    buyerEconomics:          { type: 'object' },
    buyerEconomicsMeta:      { type: 'object' },
    sellerEconomics:         { type: 'object' },
    sellerEconomicsMeta:     { type: 'object' },
    buyerProxyAnswers:       { type: 'object' },
    sellerProxyAnswers:      { type: 'object' },
    businessUnit:            { type: 'object' },
    geography:               { type: 'string', maxLength: 500 },
    applicableRegulations:   { type: 'array', maxItems: 100, itemType: 'string', itemMaxLength: 200 },
    citations:               { type: 'array', maxItems: 50 },
    adminSettings:           { type: 'object' },
    traceLabel:              { type: 'string', maxLength: 200 },
    priorMessages:           { type: 'array', maxItems: 50 }
  },
  normaliseInput: normaliseProjectExposureWorkflowInput,
  buildWorkflow: buildProjectExposureMapWorkflow
});
