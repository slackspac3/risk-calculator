'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  ASSESSMENT_TYPE_GENERIC,
  ASSESSMENT_TYPE_PROJECT_BUYER,
  MAX_MODEL_ARRAY_ITEMS,
  buildAiAuditStory,
  buildAssumptionRegister,
  buildDecisionBrief,
  buildDecisionChallenge,
  buildEvidenceMap,
  buildParameterCoach,
  buildStressCases,
  normaliseSourceMetadata
} = require('../../assets/state/decisionSupportModel.js');

test('decision support model returns safe defaults for empty input', () => {
  const brief = buildDecisionBrief();

  assert.equal(brief.assessmentType, ASSESSMENT_TYPE_GENERIC);
  assert.equal(brief.valuationMode, 'benchmark_led');
  assert.equal(brief.sourceStatus, 'unknown');
  assert.equal(brief.confidence, 'unknown');
  assert.equal(brief.proxyUsed, false);
  assert.equal(brief.needsEvidence, true);
  assert.deepEqual(brief.missingInputs, []);
  assert.equal(brief.decisionPosture, 'needs_more_evidence');
  assert.equal(brief.quantSummary.eventLossP90, null);
  assert.equal(brief.projectQuantSummary.projectHorizonLossP90, null);
  assert.deepEqual(brief.projectQuantSummary.unknownHighImpactInputs, []);
  assert.deepEqual(brief.sourceMetadata, {
    assessmentType: ASSESSMENT_TYPE_GENERIC,
    valuationMode: 'benchmark_led',
    projectContextSummary: '',
    projectExposureRefs: [],
    sourceStatus: 'unknown',
    confidence: 'unknown',
    needsEvidence: true,
    proxyUsed: false,
    missingInputs: []
  });
});

test('decision support normalizers never throw on malformed input', () => {
  const hostile = {};
  Object.defineProperty(hostile, 'recommendation', {
    enumerable: true,
    get() {
      throw new Error('bad getter');
    }
  });

  assert.doesNotThrow(() => buildAssumptionRegister('bad'));
  assert.doesNotThrow(() => buildParameterCoach(null));
  assert.doesNotThrow(() => buildEvidenceMap(42));
  assert.doesNotThrow(() => buildDecisionChallenge(false));
  assert.doesNotThrow(() => buildDecisionBrief(hostile));
  assert.doesNotThrow(() => buildStressCases({ cases: 'not an array' }));
  assert.doesNotThrow(() => buildAiAuditStory({ risksFiltered: 'not a number' }));

  const brief = buildDecisionBrief(hostile);
  assert.equal(brief.recommendation, '');
});

test('decision support arrays are capped and text is trimmed', () => {
  const assumptions = Array.from({ length: MAX_MODEL_ARRAY_ITEMS + 5 }, (_, index) => ({
    label: ` assumption ${index} `,
    value: index
  }));
  const register = buildAssumptionRegister({
    assumptions,
    nextBestQuestions: Array.from({ length: MAX_MODEL_ARRAY_ITEMS + 3 }, (_, index) => ` question ${index} `)
  });

  assert.equal(register.assumptions.length, MAX_MODEL_ARRAY_ITEMS);
  assert.equal(register.nextBestQuestions.length, MAX_MODEL_ARRAY_ITEMS);
  assert.equal(register.assumptions[0].label, 'assumption 0');
  assert.equal(register.nextBestQuestions[0].question, 'question 0');
});

test('decision support models carry project-aware fields and references', () => {
  const brief = buildDecisionBrief({
    assessmentType: ASSESSMENT_TYPE_PROJECT_BUYER,
    valuationMode: ' hybrid ',
    projectContextSummary: ' ERP rollout for UAE operations ',
    projectExposureRefs: [' buyer-delay-cost ', { id: 'buyer-reprocurement-premium', label: ' Premium ' }],
    quantSummary: {
      eventLossP90: '250000',
      annualLossMean: '100000',
      annualLossP90: '400000',
      toleranceExceeded: true,
      annualReviewTriggered: false,
      plainEnglish: ' Serious event is above tolerance. '
    },
    projectQuantSummary: {
      projectHorizonLossP90: '220000',
      primaryProjectDriver: ' Delay cost ',
      proxyValuesUsed: [' benchmark delay proxy '],
      unknownHighImpactInputs: [' delay cost per day '],
      plainEnglish: ' Delay and supplier replacement are the main project mechanisms. '
    },
    sourceMetadata: {
      sourceStatus: 'evidence_supported',
      confidence: 'high',
      needsEvidence: false
    }
  });

  assert.equal(brief.assessmentType, ASSESSMENT_TYPE_PROJECT_BUYER);
  assert.equal(brief.valuationMode, 'hybrid');
  assert.equal(brief.projectContextSummary, 'ERP rollout for UAE operations');
  assert.deepEqual(brief.projectExposureRefs, [
    'buyer-delay-cost',
    { id: 'buyer-reprocurement-premium', label: 'Premium' }
  ]);
  assert.equal(brief.quantSummary.eventLossP90, 250000);
  assert.equal(brief.quantSummary.toleranceExceeded, true);
  assert.equal(brief.projectQuantSummary.projectHorizonLossP90, 220000);
  assert.equal(brief.projectQuantSummary.primaryProjectDriver, 'Delay cost');
  assert.deepEqual(brief.projectQuantSummary.proxyValuesUsed, ['benchmark delay proxy']);
  assert.deepEqual(brief.projectQuantSummary.unknownHighImpactInputs, ['delay cost per day']);
  assert.equal(brief.projectQuantSummary.plainEnglish, 'Delay and supplier replacement are the main project mechanisms.');
  assert.equal(brief.sourceMetadata.sourceStatus, 'evidence_supported');
  assert.equal(brief.sourceMetadata.needsEvidence, false);
});

test('source metadata normalizes status aliases, confidence, proxy, and missing inputs', () => {
  const metadata = normaliseSourceMetadata({
    sourceStatus: 'benchmark proxied',
    confidence: 'LOW',
    missingInputs: [
      {
        field: 'delayCostPerDay',
        label: 'Delay cost per day',
        importance: 'high',
        whyItMatters: 'Quantifies delay impact.'
      }
    ]
  });

  assert.equal(metadata.sourceStatus, 'benchmark_proxy');
  assert.equal(metadata.confidence, 'low');
  assert.equal(metadata.proxyUsed, true);
  assert.equal(metadata.needsEvidence, true);
  assert.equal(metadata.missingInputs[0].field, 'delayCostPerDay');
  assert.equal(metadata.missingInputs[0].importance, 'high');
});

test('explicit zero values are preserved in decision-support items', () => {
  const coach = buildParameterCoach({
    sourceStatus: 'known',
    confidence: 'high',
    suggestedChangesCount: 0,
    parameterRationales: [
      {
        parameter: 'businessInterruption',
        likely: 0,
        sourceStatus: 'known',
        confidence: 'high',
        needsEvidence: false
      }
    ]
  });

  assert.equal(coach.suggestedChangesCount, 0);
  assert.equal(coach.parameterRationales[0].likely, 0);
  assert.equal(coach.parameterRationales[0].sourceStatus, 'known');
  assert.equal(coach.parameterRationales[0].needsEvidence, false);
});

test('null remains unknown and is not normalized to zero', () => {
  const register = buildAssumptionRegister({
    sourceMetadata: { sourceStatus: null },
    assumptions: [
      {
        label: 'Delay cost',
        value: null,
        sourceStatus: null
      }
    ]
  });

  assert.equal(register.sourceStatus, 'unknown');
  assert.equal(register.assumptions[0].sourceStatus, 'unknown');
  assert.equal(register.assumptions[0].value, null);
  assert.notEqual(register.assumptions[0].value, 0);
});

test('bad numbers become null and do not create false precision', () => {
  const stressCases = buildStressCases({
    cases: [
      {
        label: 'Sparse buyer project',
        low: 'not a number',
        likely: '',
        high: Number.POSITIVE_INFINITY,
        probability: Number.NaN
      }
    ]
  });

  assert.equal(stressCases.cases[0].low, null);
  assert.equal(stressCases.cases[0].likely, null);
  assert.equal(stressCases.cases[0].high, null);
  assert.equal(stressCases.cases[0].probability, null);
});

test('decision support nested model shapes normalize evidence, challenge, and audit story data', () => {
  const evidenceMap = buildEvidenceMap({
    projectFinancialEvidenceMap: [
      {
        field: ' grossMarginPct ',
        status: 'found',
        value: ' 25% ',
        evidenceRefs: [' SOW '],
        commentary: ' Contract states expected margin. '
      }
    ],
    citationQuality: {
      strong: [' contract clause '],
      weak: [{ claim: 'No cap located', sourceStatus: 'unknown' }],
      decorative: [' homepage ']
    }
  });
  const challenge = buildDecisionChallenge({
    challengeSummary: ' Needs owner review ',
    sensitivityFlags: [{
      driver: ' Delay cost ',
      direction: 'not-real',
      sourceStatus: 'not_provided'
    }],
    recommendedStressTests: [{
      id: ' delay stress ',
      title: ' Delay stress ',
      parameterPatch: {
        biLikely: '1000',
        madeUpParameter: 5000
      },
      confidence: 'high'
    }, {
      id: 'bad',
      title: 'Bad patch',
      parameterPatch: {
        madeUpParameter: 5000
      }
    }],
    changedDecisionIf: [' LD cap is lower than assumed ']
  });
  const auditStory = buildAiAuditStory({
    classification: ' project-buyer ',
    fallbackUsed: 'yes',
    risksFiltered: '2',
    proxyValuesUsed: [' benchmark delay proxy '],
    unknownsCarriedForward: [' supplier recoveries ']
  });

  assert.equal(evidenceMap.citationQuality.strong[0].text, 'contract clause');
  assert.equal(evidenceMap.citationQuality.weak[0].claim, 'No cap located');
  assert.equal(evidenceMap.projectFinancialEvidenceMap[0].field, 'grossMarginPct');
  assert.equal(evidenceMap.projectFinancialEvidenceMap[0].status, 'found');
  assert.equal(evidenceMap.projectFinancialEvidenceMap[0].value, '25%');
  assert.deepEqual(evidenceMap.projectFinancialEvidenceMap[0].evidenceRefs, ['SOW']);
  assert.equal(challenge.challengeSummary, 'Needs owner review');
  assert.equal(challenge.sensitivityFlags[0].direction, 'uncertain');
  assert.equal(challenge.sensitivityFlags[0].sourceStatus, 'unknown');
  assert.equal(challenge.recommendedStressTests.length, 1);
  assert.deepEqual(challenge.recommendedStressTests[0].parameterPatch, { biLikely: 1000 });
  assert.equal(challenge.changedDecisionIf[0].text, 'LD cap is lower than assumed');
  assert.equal(auditStory.classification, 'project-buyer');
  assert.equal(auditStory.fallbackUsed, true);
  assert.equal(auditStory.risksFiltered, 2);
  assert.equal(auditStory.proxyValuesUsed[0].text, 'benchmark delay proxy');
  assert.equal(auditStory.unknownsCarriedForward[0].text, 'supplier recoveries');
});

test('decision support model attaches to browser globals', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../assets/state/decisionSupportModel.js'), 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'decisionSupportModel.js' });

  assert.ok(context.window.DecisionSupportModel);
  assert.equal(typeof context.window.buildDecisionBrief, 'function');
  assert.equal(context.window.buildDecisionBrief({ assessmentType: 'invalid' }).assessmentType, ASSESSMENT_TYPE_GENERIC);
});
