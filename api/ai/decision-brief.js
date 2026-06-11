'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const {
  buildDecisionBriefWorkflow,
  normaliseDecisionBriefWorkflowInput
} = require('../_decisionBriefWorkflow');

module.exports = createAiJsonRouteHandler({
  routeName: 'decision-brief',
  maxBodyChars: 180000,
  allowedFields: [
    'assessmentType',
    'scenario',
    'structuredScenario',
    'scenarioLens',
    'projectContext',
    'projectExposure',
    'simulationResult',
    'parameters',
    'assumptionRegister',
    'parameterCoach',
    'evidenceMap',
    'decisionChallenge',
    'treatments',
    'riskAppetite',
    'adminSettings',
    'traceLabel',
    'priorMessages'
  ],
  validationSchema: {
    assessmentType:      { type: 'string', maxLength: 80 },
    scenario:            { type: 'string', maxLength: 5000 },
    structuredScenario:  { type: 'object' },
    projectContext:      { type: 'object' },
    projectExposure:     { type: 'object' },
    simulationResult:    { type: 'object' },
    parameters:          { type: 'object' },
    assumptionRegister:  { type: 'object' },
    parameterCoach:      { type: 'object' },
    evidenceMap:         { type: 'object' },
    decisionChallenge:   { type: 'object' },
    treatments:          { type: 'array', maxItems: 50 },
    riskAppetite:        { type: 'object' },
    adminSettings:       { type: 'object' },
    traceLabel:          { type: 'string', maxLength: 200 },
    priorMessages:       { type: 'array', maxItems: 50 }
  },
  normaliseInput: normaliseDecisionBriefWorkflowInput,
  buildWorkflow: buildDecisionBriefWorkflow
});
