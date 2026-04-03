'use strict';

const { buildGuidedScenarioDraftWorkflow, normaliseGuidedScenarioDraftInput, workflowUtils } = require('./_scenarioDraftWorkflow');

function normaliseRegisterFallbackText(value = '') {
  const text = workflowUtils.normaliseBlockInputText(value || '');
  if (!text) return '';
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
  return workflowUtils.normaliseBlockInputText(lines.join('\n')).slice(0, 4000).trim();
}

function normaliseManualStep1Input(input = {}) {
  const riskStatement = workflowUtils.normaliseBlockInputText(input.riskStatement || '');
  const registerFallback = normaliseRegisterFallbackText(input.registerText || '');
  const scenarioLensHint = input.scenarioLensHint && typeof input.scenarioLensHint === 'object'
    ? (
        workflowUtils.normaliseInlineInputText(input.scenarioLensHint.key || '')
        || workflowUtils.normaliseInlineInputText(input.scenarioLensHint.label || '')
        || workflowUtils.normaliseInlineInputText(input.scenarioLensHint.functionKey || '')
      )
    : input.scenarioLensHint;
  return normaliseGuidedScenarioDraftInput({
    session: input.session,
    riskStatement: riskStatement || registerFallback,
    scenarioLensHint,
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    citations: input.citations,
    adminSettings: input.adminSettings,
    traceLabel: input.traceLabel,
    priorMessages: input.priorMessages
  });
}

async function buildManualStep1Workflow(input = {}, { traceLabelDefault = 'Step 1 manual assist' } = {}) {
  const normalisedInput = normaliseManualStep1Input(input);
  return buildGuidedScenarioDraftWorkflow({
    ...normalisedInput,
    traceLabel: String(normalisedInput.traceLabel || traceLabelDefault).trim() || traceLabelDefault
  });
}

module.exports = {
  buildManualStep1Workflow,
  normaliseManualStep1Input
};
