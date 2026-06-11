'use strict';

const { createAiJsonRouteHandler } = require('../_aiJsonRoute');
const {
  buildEvidenceMapWorkflow,
  normaliseEvidenceMapWorkflowInput
} = require('../_evidenceMapWorkflow');

module.exports = createAiJsonRouteHandler({
  routeName: 'evidence-map',
  maxBodyChars: 180000,
  allowedFields: [
    'assessmentType',
    'scenario',
    'structuredScenario',
    'riskStatement',
    'projectContext',
    'projectExposure',
    'assumptions',
    'parameters',
    'citations',
    'ragMatches',
    'businessContext',
    'adminSettings',
    'traceLabel'
  ],
  validationSchema: {
    assessmentType:      { type: 'string', maxLength: 80 },
    scenario:            { type: 'string', maxLength: 5000 },
    structuredScenario:  { type: 'object' },
    riskStatement:       { type: 'string', maxLength: 5000 },
    projectContext:      { type: 'object' },
    projectExposure:     { type: 'object' },
    assumptions:         { type: 'array', maxItems: 50 },
    parameters:          { type: 'object' },
    citations:           { type: 'array', maxItems: 50 },
    ragMatches:          { type: 'array', maxItems: 50 },
    businessContext:     { type: 'object' },
    adminSettings:       { type: 'object' },
    traceLabel:          { type: 'string', maxLength: 200 }
  },
  normaliseInput: normaliseEvidenceMapWorkflowInput,
  buildWorkflow: buildEvidenceMapWorkflow
});
