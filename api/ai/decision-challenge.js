'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const {
  buildDecisionChallengeWorkflow,
  normaliseDecisionChallengeWorkflowInput
} = require('../_decisionChallengeWorkflow');

module.exports = createAiJsonRouteHandler({
  routeName: 'decision-challenge',
  maxBodyChars: 180000,
  allowedFields: [
    'assessmentType',
    'scenario',
    'structuredScenario',
    'scenarioLens',
    'projectContext',
    'projectExposure',
    'parameters',
    'simulationResult',
    'assumptionRegister',
    'parameterCoach',
    'evidenceMap',
    'treatments',
    'riskAppetite',
    'adminSettings',
    'traceLabel',
    'priorMessages'
  ],
  validationSchema: {
    assessmentType:       { type: 'string', maxLength: 80 },
    scenario:             { type: 'string', maxLength: 5000 },
    structuredScenario:   { type: 'object' },
    projectContext:       { type: 'object' },
    projectExposure:      { type: 'object' },
    parameters:           { type: 'object' },
    simulationResult:     { type: 'object' },
    assumptionRegister:   { type: 'object' },
    parameterCoach:       { type: 'object' },
    evidenceMap:          { type: 'object' },
    treatments:           { type: 'array', maxItems: 50 },
    riskAppetite:         { type: 'object' },
    adminSettings:        { type: 'object' },
    traceLabel:           { type: 'string', maxLength: 200 },
    priorMessages:        { type: 'array', maxItems: 50 }
  },
  normaliseInput: normaliseDecisionChallengeWorkflowInput,
  buildWorkflow: buildDecisionChallengeWorkflow
});
