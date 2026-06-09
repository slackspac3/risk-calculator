'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmService } = require('./helpers/loadLlmServiceHarness');

function loadService({ origin = 'https://slackspac3.github.io', fetchImpl } = {}) {
  return loadLlmService({ origin, fetchImpl });
}

test('same guided-draft request stays single-flight while the first request is pending', async () => {
  const fetchCalls = [];
  let releaseResponse;
  const service = loadService({
    fetchImpl: (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return new Promise((resolve) => {
        releaseResponse = () => resolve({
          ok: true,
          json: async () => ({
            mode: 'live',
            draftNarrative: 'Server guided draft',
            trace: {
              label: 'Step 2 guided draft',
              promptSummary: 'Prompt',
              response: 'Response'
            }
          })
        });
      });
    }
  });

  const first = service.buildGuidedScenarioDraft({
    riskStatement: ' Azure global admin credentials found on the dark web. ',
    guidedInput: { event: 'Azure global admin credentials found on the dark web.' }
  });
  const second = service.buildGuidedScenarioDraft({
    riskStatement: 'Azure   global admin credentials found on the dark web.',
    guidedInput: { event: '  Azure global admin credentials found on the dark web. ' }
  });

  await Promise.resolve();
  assert.equal(fetchCalls.length, 1);

  releaseResponse();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(fetchCalls.length, 1);
  assert.equal(firstResult.mode, 'live');
  assert.equal(secondResult.mode, 'live');
  assert.notStrictEqual(firstResult, secondResult);
});

test('same-input guided-draft reruns reuse the recent result for a short window', async () => {
  const fetchCalls = [];
  const service = loadService({
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'live',
          draftNarrative: 'Server guided draft',
          trace: {
            label: 'Step 2 guided draft',
            promptSummary: 'Prompt',
            response: 'Response'
          }
        })
      };
    }
  });

  const first = await service.buildGuidedScenarioDraft({
    riskStatement: ' Azure global admin credentials found on the dark web. ',
    guidedInput: {
      event: 'Azure global admin credentials found on the dark web.',
      impact: ' Control disruption and fraud exposure '
    }
  });
  const second = await service.buildGuidedScenarioDraft({
    riskStatement: 'Azure global admin credentials found on the dark web.',
    guidedInput: {
      event: '  Azure   global admin credentials found on the dark web. ',
      impact: 'Control disruption and fraud exposure'
    }
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(first.draftNarrative, 'Server guided draft');
  assert.equal(second.draftNarrative, 'Server guided draft');
  assert.notStrictEqual(first, second);
});

test('changed reviewer/challenge inputs still trigger a fresh request', async () => {
  const fetchCalls = [];
  const service = loadService({
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        json: async () => ({
          mode: 'live',
          summaryBullets: ['Use the current projected path.'],
          acceptChallenges: ['C1'],
          defendChallenges: [],
          meetInTheMiddleAleRange: '$3.7M mean ALE'
        })
      };
    }
  });

  await service.generateConsensusRecommendation({
    scenarioTitle: 'Identity compromise',
    scenarioSummary: 'Identity compromise through exposed admin credentials.',
    originalAleRange: '$3.2M mean ALE',
    adjustedAleRange: '$4.1M mean ALE',
    projectedAleRange: '$3.7M mean ALE',
    aleChangePct: 12,
    originalParameters: { controlStrLikely: 0.62 },
    adjustedParameters: { controlStrLikely: 0.54 },
    challenges: [
      { ref: 'C1', parameter: 'Control strength', concern: 'Too optimistic', proposedValue: '0.54', impactPct: 8, aleImpact: 'ALE rises modestly.' }
    ]
  });
  await service.generateConsensusRecommendation({
    scenarioTitle: 'Identity compromise',
    scenarioSummary: 'Identity compromise through exposed admin credentials.',
    originalAleRange: '$3.2M mean ALE',
    adjustedAleRange: '$4.1M mean ALE',
    projectedAleRange: '$3.7M mean ALE',
    aleChangePct: 19,
    originalParameters: { controlStrLikely: 0.62 },
    adjustedParameters: { controlStrLikely: 0.5 },
    challenges: [
      { ref: 'C1', parameter: 'Control strength', concern: 'Too optimistic', proposedValue: '0.50', impactPct: 19, aleImpact: 'ALE rises more sharply.' }
    ]
  });

  assert.equal(fetchCalls.length, 2);
});
