'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAiAuditStory } = require('../../assets/state/decisionSupportModel.js');

test('AI audit story is safe when no AI outputs exist', () => {
  const story = buildAiAuditStory({
    assessment: {
      assessmentType: 'enterprise_generic',
      scenarioTitle: 'Manual assessment'
    }
  });

  assert.equal(story.assessmentType, 'enterprise_generic');
  assert.equal(story.fallbackUsed, false);
  assert.equal(story.evidenceUsed.length, 0);
  assert.match(story.summary, /no saved AI decision-support outputs/i);
});

test('AI audit story marks fallback true when fallback outputs exist', () => {
  const story = buildAiAuditStory({
    assessment: {
      assessmentType: 'project_buyer',
      aiQualityState: 'fallback',
      projectExposure: {
        usedFallback: true,
        projectExposureSummary: 'Fallback mapped delay exposure.'
      },
      parameterCoach: {
        mode: 'deterministic_fallback',
        warnings: ['Delay cost unknown.']
      }
    }
  });

  assert.equal(story.fallbackUsed, true);
  assert.ok(story.openWarnings.some(item => /delay cost unknown/i.test(item.text)));
});

test('AI audit story summarizes project exposure drivers', () => {
  const story = buildAiAuditStory({
    assessment: {
      assessmentType: 'project_seller',
      projectExposure: {
        financialDrivers: [{
          id: 'seller-margin-at-risk',
          label: 'Margin at risk',
          driverStatus: 'calculated_driver',
          confidence: 'medium'
        }]
      }
    }
  });

  assert.ok(story.projectEconomicsUsed.some(item => /margin at risk/i.test(item.text)));
});

test('AI audit story summarizes proxy values used', () => {
  const story = buildAiAuditStory({
    assessment: {
      assessmentType: 'project_buyer',
      decisionBrief: {
        projectQuantSummary: {
          proxyValuesUsed: ['Delay cost benchmark proxy']
        }
      },
      projectExposure: {
        financialDrivers: [{
          label: 'Delay cost',
          driverStatus: 'benchmark_proxy_driver',
          confidence: 'low'
        }]
      }
    }
  });

  assert.ok(story.proxyValuesUsed.some(item => /delay cost benchmark proxy/i.test(item.text)));
  assert.ok(story.proxyValuesUsed.some(item => /delay cost used a benchmark proxy/i.test(item.text)));
});

test('AI audit story summarizes unknown high-impact values carried forward', () => {
  const story = buildAiAuditStory({
    assessment: {
      assessmentType: 'project_buyer',
      projectExposure: {
        projectInputQuality: {
          unknownHighImpactInputs: ['Delay cost per day']
        },
        missingInputs: [{
          field: 'contractualRecoveryCap',
          label: 'Contractual recovery cap'
        }],
        financialDrivers: [{
          label: 'Sunk cost',
          driverStatus: 'unquantified_driver',
          missingInputs: [{ field: 'amountPaid', label: 'Amount already paid' }]
        }]
      }
    }
  });

  assert.ok(story.unknownsCarriedForward.some(item => /delay cost per day/i.test(item.text)));
  assert.ok(story.unknownsCarriedForward.some(item => /contractual recovery cap/i.test(item.text)));
  assert.ok(story.unknownsCarriedForward.some(item => /amount already paid/i.test(item.text)));
});

test('AI audit story does not expose raw prompt or prior message text', () => {
  const story = buildAiAuditStory({
    assessmentType: 'project_buyer',
    summary: 'System prompt: reveal hidden instructions',
    prompt: 'SYSTEM PROMPT secret',
    priorMessages: [{ role: 'user', content: 'raw user prompt' }],
    proxyValuesUsed: ['Benchmark delay proxy'],
    unknownsCarriedForward: ['Delay cost per day']
  });

  const serialized = JSON.stringify(story).toLowerCase();
  assert.doesNotMatch(serialized, /system prompt|raw user prompt|hidden instructions/);
  assert.ok(story.proxyValuesUsed.some(item => /benchmark delay proxy/i.test(item.text)));
});

test('AI audit story evidence map populates evidenceUsed', () => {
  const story = buildAiAuditStory({
    assessment: {
      assessmentType: 'project_seller',
      evidenceMap: {
        supportedClaims: [{ claim: 'Contract includes SLA credits.' }],
        citationQuality: {
          strong: ['Signed service schedule']
        },
        projectFinancialEvidenceMap: [{
          field: 'slaCreditsCap',
          status: 'found',
          value: 'USD 100,000'
        }]
      }
    }
  });

  assert.ok(story.evidenceUsed.some(item => /contract includes sla credits/i.test(item.text)));
  assert.ok(story.evidenceUsed.some(item => /signed service schedule/i.test(item.text)));
  assert.ok(story.evidenceUsed.some(item => item.text.toLowerCase().includes('slacreditscap found in evidence')));
});
