'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function assertApproximately(actual, expected, tolerance = 0.03) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function loadLearningAuthority({ settings = {}, feedback = { updatedAt: 0, events: [] }, userState = null } = {}) {
  const learningPath = path.resolve(__dirname, '../../api/_learningAuthority.js');
  const kvPath = require.resolve('../../api/_kvStore.js');
  const settingsPath = require.resolve('../../api/settings.js');
  const userStatePath = require.resolve('../../api/user-state.js');

  const originalKv = require.cache[kvPath];
  const originalSettings = require.cache[settingsPath];
  const originalUserState = require.cache[userStatePath];
  const originalLearning = require.cache[learningPath];

  require.cache[kvPath] = {
    id: kvPath,
    filename: kvPath,
    loaded: true,
    exports: {
      get: async () => JSON.stringify(feedback)
    }
  };
  require.cache[settingsPath] = {
    id: settingsPath,
    filename: settingsPath,
    loaded: true,
    exports: {
      readSettings: async () => settings
    }
  };
  require.cache[userStatePath] = {
    id: userStatePath,
    filename: userStatePath,
    loaded: true,
    exports: {
      readUserState: async () => userState
    }
  };

  delete require.cache[learningPath];
  const learningAuthority = require(learningPath);

  function restore() {
    if (originalKv) require.cache[kvPath] = originalKv;
    else delete require.cache[kvPath];
    if (originalSettings) require.cache[settingsPath] = originalSettings;
    else delete require.cache[settingsPath];
    if (originalUserState) require.cache[userStatePath] = originalUserState;
    else delete require.cache[userStatePath];
    if (originalLearning) require.cache[learningPath] = originalLearning;
    else delete require.cache[learningPath];
  }

  return { learningAuthority, restore };
}

test('server learning authority resolves user-tier priors from server user-state, not browser state', async () => {
  const { learningAuthority, restore } = loadLearningAuthority({
    settings: {
      aiFeedbackTuning: { learningSensitivity: 'balanced' }
    },
    feedback: {
      updatedAt: Date.now(),
      events: [
        {
          target: 'draft',
          score: 5,
          runtimeMode: 'live_ai',
          functionKey: 'technology',
          lensKey: 'cyber',
          submittedBy: 'pat'
        },
        {
          target: 'draft',
          score: 4,
          runtimeMode: 'live_ai',
          functionKey: 'technology',
          lensKey: 'cyber',
          submittedBy: 'lee'
        },
        {
          target: 'draft',
          score: 4,
          runtimeMode: 'live_ai',
          functionKey: 'technology',
          lensKey: 'cyber',
          submittedBy: 'sam'
        }
      ]
    },
    userState: {
      learningStore: {
        aiFeedback: {
          events: [
            {
              target: 'risk',
              score: 5,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              riskTitle: 'Privileged account compromise',
              selectedInAssessment: true,
              submittedBy: 'sam'
            },
            {
              target: 'shortlist',
              score: 1,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              reasons: ['wrong-domain', 'included unrelated risks'],
              shownRiskTitles: ['Generic compliance remediation', 'Privileged account compromise'],
              keptRiskTitles: ['Privileged account compromise'],
              removedRiskTitles: ['Generic compliance remediation'],
              submittedBy: 'sam'
            }
          ]
        }
      }
    }
  });

  try {
    const profile = await learningAuthority.resolveHierarchicalFeedbackProfile({
      username: 'sam',
      buId: 'g42',
      functionKey: 'technology',
      scenarioLensKey: 'cyber'
    });

    assert.equal(profile.source, 'server');
    assert.equal(profile.user.active, true);
    assert.equal(profile.function.active, true);
    assert.equal(profile.combined.activeTiers.includes('user'), true);
    assert.ok(profile.combined.preferredRiskTitles.some((item) => item.title === 'Privileged account compromise'));
    const promptBlock = learningAuthority.buildFeedbackLearningPromptBlock(profile);
    assert.match(promptBlock, /server-approved live-AI feedback/i);
    assert.match(promptBlock, /Down-rank titles or wording/i);
  } finally {
    restore();
  }
});

test('server learning authority reranks risk cards using server-resolved feedback weights', () => {
  const { learningAuthority, restore } = loadLearningAuthority();

  try {
    const reranked = learningAuthority.rerankRiskCardsWithFeedback([
      { title: 'Generic service instability', confidence: 'high' },
      { title: 'Privileged account compromise', confidence: 'medium' }
    ], {
      combined: {
        riskWeights: {
          'Privileged account compromise': 1.8
        }
      }
    });

    assert.equal(reranked[0].title, 'Privileged account compromise');
  } finally {
    restore();
  }
});

test('server learning authority applies 90-day half-life decay to live-AI feedback weights', async () => {
  const now = Date.now();
  const { learningAuthority, restore } = loadLearningAuthority({
    userState: {
      learningStore: {
        aiFeedback: {
          events: [
            {
              target: 'risk',
              score: 5,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              riskTitle: 'Fresh signal',
              recordedAt: now,
              submittedBy: 'sam'
            },
            {
              target: 'risk',
              score: 5,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              riskTitle: '90-day signal',
              recordedAt: now - (90 * 24 * 60 * 60 * 1000),
              submittedBy: 'sam'
            },
            {
              target: 'risk',
              score: 5,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              riskTitle: '180-day signal',
              recordedAt: now - (180 * 24 * 60 * 60 * 1000),
              submittedBy: 'sam'
            }
          ]
        }
      }
    }
  });

  try {
    const profile = await learningAuthority.resolveHierarchicalFeedbackProfile({
      username: 'sam',
      buId: 'g42',
      functionKey: 'technology',
      scenarioLensKey: 'cyber'
    });

    const weights = profile.user.profile.riskWeights;
    assertApproximately(weights['Fresh signal'], 1.5);
    assertApproximately(weights['90-day signal'], 0.75);
    assertApproximately(weights['180-day signal'], 0.375);
  } finally {
    restore();
  }
});

test('server learning authority discounts thin-signal profiles by 50 percent', async () => {
  const now = Date.now();
  const { learningAuthority, restore } = loadLearningAuthority({
    userState: {
      learningStore: {
        aiFeedback: {
          events: [
            {
              target: 'risk',
              score: 5,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              riskTitle: 'Thin signal risk',
              recordedAt: now,
              submittedBy: 'sam'
            },
            {
              target: 'risk',
              score: 5,
              runtimeMode: 'live_ai',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              riskTitle: 'Thin signal risk',
              recordedAt: now,
              submittedBy: 'sam'
            }
          ]
        }
      }
    }
  });

  try {
    const profile = await learningAuthority.resolveHierarchicalFeedbackProfile({
      username: 'sam',
      buId: 'g42',
      functionKey: 'technology',
      scenarioLensKey: 'cyber'
    });

    assert.equal(profile.user.profile.coldStartDiscountApplied, true);
    assertApproximately(profile.user.profile.signalConfidence, 0.5, 0.001);
    assertApproximately(profile.user.profile.riskWeights['Thin signal risk'], 1.5);
  } finally {
    restore();
  }
});

test('server learning authority aggregates structured project correction feedback conservatively', async () => {
  const now = Date.now();
  const { learningAuthority, restore } = loadLearningAuthority({
    userState: {
      learningStore: {
        aiFeedback: {
          events: [],
          structuredEvents: [
            {
              eventType: 'project_missing_value_provided',
              targetType: 'project_exposure',
              reasonCode: 'known_value_added',
              buId: 'g42',
              functionKey: 'technology',
              lensKey: 'cyber',
              assessmentType: 'project_buyer',
              sourceStatusBefore: 'unknown',
              sourceStatusAfter: 'known',
              recordedAt: now,
              submittedBy: 'sam'
            }
          ]
        }
      }
    }
  });

  try {
    const profile = await learningAuthority.resolveHierarchicalFeedbackProfile({
      username: 'sam',
      buId: 'g42',
      functionKey: 'technology',
      scenarioLensKey: 'cyber'
    });

    assert.equal(profile.structured.user.active, true);
    assert.ok(profile.combined.topProjectCorrections.some(item => item.reason === 'known_value_added'));
    assert.ok(profile.combined.topSourceTransitions.some(item => item.transition === 'unknown->known'));

    const promptBlock = learningAuthority.buildFeedbackLearningPromptBlock(profile);
    assert.match(promptBlock, /project-economics correction themes/i);
    assert.match(promptBlock, /positive correction signal/i);
    assert.match(promptBlock, /must not override/i);
  } finally {
    restore();
  }
});
