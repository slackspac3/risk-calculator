'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const IntakeConversationModel = require('../../assets/state/intakeConversationModel.js');

test('explicit unknown answers are captured as known gaps and do not repeat the same field', () => {
  const model = IntakeConversationModel.buildIntakeConversationModel({
    draft: {
      buId: 'bu-cloud',
      buName: 'Cloud Infrastructure',
      guidedInput: {
        event: 'A project delivery milestone may be delayed.',
        impact: 'Unknown'
      }
    }
  });

  assert.equal(model.hasEventSignal, true);
  assert.equal(model.hasImpactSignal, true);
  assert.equal(model.facts.impact.explicitUnknown, true);
  assert.deepEqual(model.explicitUnknownFields, ['impact']);
  assert.match(model.knownUnknowns[0], /Impact is marked unknown/i);
  assert.equal(model.activeQuestion.field, 'draft');
  assert.match(model.nextBestAction.copy, /Known gaps will be carried forward/i);
  assert.equal(model.readyToBuild, true);
});

test('missing business context blocks the build before asking for more intake detail', () => {
  const model = IntakeConversationModel.buildIntakeConversationModel({
    draft: {
      guidedInput: {
        event: 'Supplier platform outage during peak trading.',
        impact: 'Customer disruption.'
      }
    }
  });

  assert.equal(model.hasBusinessContext, false);
  assert.equal(model.activeQuestion.field, 'businessContext');
  assert.equal(model.readyToBuild, false);
  assert.match(model.nextBestAction.title, /Choose business context/i);
});

test('missing event asks for the event while preserving the impact as partial context', () => {
  const model = IntakeConversationModel.buildIntakeConversationModel({
    draft: {
      buId: 'bu-retail',
      guidedInput: {
        event: '',
        impact: 'Customer disruption and lost sales.'
      }
    }
  });

  assert.equal(model.hasEventSignal, false);
  assert.equal(model.hasImpactSignal, true);
  assert.equal(model.activeQuestion.field, 'event');
  assert.match(model.contextStrength.label, /Partial context captured/i);
});

test('evidence gaps are surfaced as known unknowns', () => {
  const model = IntakeConversationModel.buildIntakeConversationModel({
    draft: {
      buId: 'bu-health',
      guidedInput: {
        event: 'Health records transfer may breach residency obligations.',
        impact: 'Regulatory scrutiny.'
      },
      evidenceMap: {
        unsupportedClaims: [{ claim: 'No approved transfer basis found.' }]
      }
    }
  });

  assert.equal(model.evidenceStatus.state, 'warning');
  assert.match(model.evidenceStatus.detail, /No approved transfer basis/i);
  assert.ok(model.knownUnknowns.some((item) => /No approved transfer basis/i.test(item)));
});

test('project exposure missing inputs are tracked in the intake model', () => {
  const model = IntakeConversationModel.buildIntakeConversationModel({
    draft: {
      buId: 'bu-projects',
      guidedInput: {
        event: 'Implementation partner may miss the handover milestone.',
        impact: 'Delayed benefit realisation.'
      },
      projectExposure: {
        missingInputs: [{ field: 'delayCostPerDay', label: 'Delay cost per day' }],
        projectInputQuality: {
          unknownHighImpactInputs: ['Reprocurement premium']
        }
      }
    }
  });

  assert.ok(model.knownUnknowns.some((item) => /Delay cost per day/i.test(item)));
  assert.ok(model.knownUnknowns.some((item) => /Reprocurement premium/i.test(item)));
});
