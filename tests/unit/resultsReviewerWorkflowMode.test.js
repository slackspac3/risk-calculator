'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadResultsHelpers() {
  const filePath = path.resolve(__dirname, '../../assets/results/resultsRoute.js');
  const source = `${fs.readFileSync(filePath, 'utf8')}
;globalThis.__resultsRouteTest = {
  normaliseReviewerWorkflowMode,
  getReviewerWorkflowModePresentation,
  renderResultsAiJourneyStrip,
  renderAssessmentChallengeResult,
  renderReviewMediationResult
};`;

  const context = {
    console,
    Math,
    JSON,
    Date,
    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    UI: {},
    AuthService: { getCurrentUser: () => null }
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'resultsRoute.js' });
  return context.__resultsRouteTest;
}

test('reviewer workflow helpers distinguish live, deterministic fallback, and manual states', () => {
  const {
    normaliseReviewerWorkflowMode,
    getReviewerWorkflowModePresentation
  } = loadResultsHelpers();

  assert.equal(normaliseReviewerWorkflowMode({ mode: 'live' }), 'live');
  assert.equal(normaliseReviewerWorkflowMode({ usedFallback: true }), 'deterministic_fallback');
  assert.equal(normaliseReviewerWorkflowMode({ aiUnavailable: true }), 'manual');

  const fallbackMeta = getReviewerWorkflowModePresentation({
    mode: 'deterministic_fallback',
    fallbackReasonMessage: 'Server fallback in use.'
  }, {
    fallbackLabel: 'Deterministic fallback challenge'
  });
  assert.equal(fallbackMeta.label, 'Deterministic fallback challenge');
  assert.equal(fallbackMeta.message, 'Server fallback in use.');

  const manualMeta = getReviewerWorkflowModePresentation({
    mode: 'manual',
    manualReasonMessage: 'Keep the review manual.'
  }, {
    manualLabel: 'Manual mediation guidance'
  });
  assert.equal(manualMeta.label, 'Manual mediation guidance');
  assert.equal(manualMeta.message, 'Keep the review manual.');
});

test('results AI journey strip defaults to compact summary with expandable details', () => {
  const { renderResultsAiJourneyStrip } = loadResultsHelpers();

  const html = renderResultsAiJourneyStrip({
    modeLabel: 'Mixed AI/fallback',
    tone: 'warning',
    summaryLabel: '3 fresh · 1 stale · 2 not generated',
    staleCount: 1,
    criticalStaleCount: 0,
    reviewStaleCount: 1,
    liveCount: 1,
    fallbackCount: 1,
    emptyCount: 2,
    recommendedAction: 'Review Evidence Map',
    recommendedReason: 'Review Evidence Map because evidence changed.',
    outputs: [
      { label: 'Decision Brief', hasOutput: true, freshnessLabel: 'Fresh', freshnessTone: 'success' },
      { label: 'Evidence Map', hasOutput: true, freshnessLabel: 'Review recommended', freshnessTone: 'warning', refreshReason: 'Review Evidence Map because evidence changed.' },
      { label: 'Challenge Agent', hasOutput: false, refreshRecommended: true, freshnessLabel: 'No output', freshnessTone: 'neutral' }
    ]
  });

  assert.match(html, /3 fresh · 1 stale · 2 not generated/);
  assert.match(html, /View AI support details/);
  assert.match(html, /Evidence Map: Review recommended/);
  assert.ok(html.indexOf('3 fresh · 1 stale · 2 not generated') < html.indexOf('View AI support details'));
});

test('reviewer/challenge renderers show honest mode labels and hide manual-only actions', () => {
  const {
    renderAssessmentChallengeResult,
    renderReviewMediationResult
  } = loadResultsHelpers();

  const fallbackChallenge = renderAssessmentChallengeResult({
    mode: 'deterministic_fallback',
    confidenceVerdict: 'Likely understated',
    challengeSummary: 'Fallback challenge summary.',
    weakestAssumption: 'Recovery timing remains weak.',
    alternativeView: 'Assume slower recovery.',
    oneQuestion: 'What evidence proves the current recovery window?',
    fallbackReasonMessage: 'The server used a deterministic challenge.'
  });
  assert.match(fallbackChallenge, /Deterministic fallback challenge/);
  assert.match(fallbackChallenge, /The server used a deterministic challenge\./);

  const manualMediation = renderReviewMediationResult({
    mode: 'manual',
    proposedMiddleGround: 'Keep the discussion manual.',
    reconciliationSummary: 'No server proposal was produced.',
    whyReasonable: 'The evidence pack needs human review.',
    evidenceToVerify: 'Latest control test.',
    manualReasonMessage: 'Continue without treating this as live AI output.'
  });
  assert.match(manualMediation, /Manual mediation guidance/);
  assert.match(manualMediation, /Continue without treating this as live AI output\./);
  assert.doesNotMatch(manualMediation, /btn-accept-mediation/);
});
