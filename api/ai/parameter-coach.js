'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const {
  buildParameterCoachWorkflow,
  normaliseParameterCoachWorkflowInput
} = require('../_parameterCoachWorkflow');

module.exports = createAiJsonRouteHandler({
  routeName: 'parameter-coach',
  maxBodyChars: 180000,
  allowedFields: [
    'assessmentType',
    'scenario',
    'structuredScenario',
    'scenarioLens',
    'projectContext',
    'projectExposure',
    'parameters',
    'validation',
    'assumptionRegister',
    'evidenceMap',
    'citations',
    'businessContext',
    'adminSettings',
    'results',
    'traceLabel',
    'priorMessages'
  ],
  validationSchema: {
    assessmentType:        { type: 'string', maxLength: 80 },
    scenario:              { type: 'string', maxLength: 5000 },
    structuredScenario:    { type: 'object' },
    projectContext:        { type: 'object' },
    projectExposure:       { type: 'object' },
    parameters:            { type: 'object' },
    validation:            { type: 'object' },
    assumptionRegister:    { type: 'object' },
    evidenceMap:           { type: 'object' },
    citations:             { type: 'array', maxItems: 50 },
    businessContext:       { type: 'object' },
    adminSettings:         { type: 'object' },
    results:               { type: 'object' },
    traceLabel:            { type: 'string', maxLength: 200 },
    priorMessages:         { type: 'array', maxItems: 50 }
  },
  normaliseInput: normaliseParameterCoachWorkflowInput,
  buildWorkflow: buildParameterCoachWorkflow
});
