'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const originalEnv = {
  COMPASS_API_KEY: process.env.COMPASS_API_KEY,
  COMPASS_API_URL: process.env.COMPASS_API_URL,
  COMPASS_MODEL: process.env.COMPASS_MODEL
};
const originalFetch = global.fetch;

function restoreEnv() {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (typeof value === 'string') process.env[key] = value;
    else delete process.env[key];
  });
}

function loadWorkflowFresh() {
  const modulePath = '../../api/_reviewChallengeWorkflow';
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function buildAiFetch(aiPayload) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: aiPayload
          }
        }
      ]
    }),
    text: async () => aiPayload
  });
}

function assertReviewerCoherenceMetadata(result = {}) {
  assert.equal(typeof result?.reviewerCoherence?.confidenceScore, 'number');
  assert.match(String(result?.reviewerCoherence?.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(result?.reviewerCoherence?.confidenceDrivers));
  assert.equal(typeof result?.reviewerCoherence?.calibrationMode, 'string');
}

test.beforeEach(() => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.4';
});

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
});

test('reviewer brief stays accepted when the live output reinforces the accepted identity-compromise lane', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    whatMatters: 'The accepted issue remains identity compromise through exposed privileged access into the tenant.',
    whatsUncertain: 'The main uncertainty is how far the same privileged-access path could extend before recovery controls contain it.',
    whatToDo: 'Challenge the evidence for privileged-access control performance while keeping the review anchored to the accepted identity-compromise path.'
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildReviewerDecisionBriefWorkflow({
    assessmentData: 'Identity compromise through exposed global admin credentials is used to access the tenant and modify critical configurations.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.usedFallback, false);
  assert.equal(result.reviewerCoherence.mode, 'accepted');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'identity_compromise');
  assert.equal(result.reviewerCoherence.confidenceBand, 'high');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.whatMatters, /identity compromise/i);
});

test('reviewer brief corrects identity-compromise outputs that drift into finance-primary framing', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    whatMatters: 'The real issue is treasury payment control weakness and direct financial loss from approval gaps.',
    whatsUncertain: 'The main uncertainty is how far the same identity-compromise path could extend before recovery controls contain it.',
    whatToDo: 'Challenge the evidence for privileged-access control performance while keeping the review anchored to identity compromise.'
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildReviewerDecisionBriefWorkflow({
    assessmentData: 'Identity compromise through exposed global admin credentials is used to access the tenant and modify critical configurations.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.usedFallback, false);
  assert.equal(result.reviewerCoherence.mode, 'corrected');
  assert.ok(result.reviewerCoherence.correctedSections.includes('whatMatters'));
  assert.ok(result.reviewerCoherence.reasonCodes.includes('BLOCKED_DRIFT_FAMILIES'));
  assert.equal(result.reviewerCoherence.confidenceBand, 'medium');
  assert.ok(result.reviewerCoherence.confidenceDrivers.includes('OUTPUT_CORRECTED'));
  assertReviewerCoherenceMetadata(result);
  assert.match(result.whatMatters, /accepted identity compromise/i);
  assert.doesNotMatch(result.whatMatters, /treasury|payment control|financial loss/i);
});

test('challenge synthesis replaces a DDoS review output that drifts into compliance and regulatory filing language', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    overallConcern: 'The main issue is regulatory filing discipline and policy assurance rather than the attack path.',
    revisedAleRange: 'Use a compliance remediation range until the filing programme is rebuilt.',
    keyEvidence: 'The most useful evidence is whether the filing calendar was updated on time.'
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildChallengeSynthesisWorkflow({
    scenarioTitle: 'Availability attack',
    scenarioSummary: 'A volumetric DDoS attack floods the public website and degrades customer-facing service availability.',
    baseAleRange: '$2.4M mean ALE',
    records: [
      { parameter: 'TEF', concern: 'Attack traffic may persist longer than assumed.', reviewerAdjustment: { param: 'tefLikely', suggestedValue: 8 } },
      { parameter: 'Control strength', concern: 'Filtering capacity may be too optimistic.', reviewerAdjustment: { param: 'controlStrLikely', suggestedValue: 0.48 } }
    ],
    traceLabel: 'Challenge synthesis'
  });

  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.usedFallback, true);
  assert.equal(result.aiUnavailable, false);
  assert.equal(result.reviewerCoherence.mode, 'fallback_replaced');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'availability_attack');
  assert.equal(result.reviewerCoherence.confidenceBand, 'low');
  assert.ok(result.reviewerCoherence.confidenceDrivers.includes('OUTPUT_REPLACED'));
  assertReviewerCoherenceMetadata(result);
  assert.match(result.overallConcern, /availability attack|accepted availability attack|ddos/i);
  assert.doesNotMatch(result.overallConcern, /filing|policy assurance/i);
});

test('challenge assessment corrects privacy-obligation reviews that drift into explicit disclosure without exposure signals', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The primary issue is an external data breach and exfiltration event.',
    challengeLevel: 'High challenge needed',
    weakestAssumptions: ['Whether lawful-basis controls actually operated before the customer records were processed.'],
    committeeQuestions: ['What evidence shows the privacy-obligation checks operated as described?'],
    evidenceToGather: ['Current lawful-basis and retention records'],
    reviewerGuidance: ['Keep the challenge focused on the accepted privacy-obligation failure unless explicit disclosure evidence appears.']
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildChallengeAssessmentWorkflow({
    scenarioTitle: 'Privacy obligation failure',
    narrative: 'Customer records are processed without a lawful basis under stated privacy obligations.',
    confidence: { label: 'Medium confidence', summary: 'The privacy-control evidence is incomplete.' },
    drivers: { upward: ['Lawful-basis controls are weak'], stabilisers: [] },
    assumptions: [{ category: 'Controls', text: 'Retention and lawful-basis checks operate consistently.' }],
    missingInformation: ['Current processing records'],
    traceLabel: 'Assessment challenge'
  });

  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.reviewerCoherence.mode, 'fallback_replaced');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'privacy_non_compliance');
  assert.equal(result.reviewerCoherence.confidenceBand, 'low');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.summary, /privacy non compliance|privacy non-compliance|accepted privacy/i);
  assert.doesNotMatch(result.summary, /exfiltration|external data breach/i);
});

test('consensus recommendation corrects supplier-delay summaries that drift into generic transformation framing', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summaryBullets: [
      'Treat the issue as an internal transformation-governance failure rather than supplier delivery.',
      'Focus on programme execution evidence before reassessing the estimate.',
      'Use the programme-reset range as the committee view.'
    ],
    acceptChallenges: ['C1'],
    defendChallenges: ['C2'],
    meetInTheMiddleAleRange: '$3.1M mean ALE'
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildConsensusRecommendationWorkflow({
    scenarioTitle: 'Supplier delivery slippage',
    scenarioSummary: 'A key supplier misses committed delivery dates, delaying infrastructure deployment and dependent projects.',
    originalAleRange: '$2.6M mean ALE',
    adjustedAleRange: '$3.4M mean ALE',
    projectedAleRange: '$3.1M mean ALE',
    aleChangePct: 19,
    originalParameters: { tefLikely: 4 },
    adjustedParameters: { tefLikely: 5 },
    challenges: [
      { ref: 'C1', parameter: 'TEF', concern: 'Delivery misses may persist longer than assumed.', proposedValue: '5', impactPct: 9, aleImpact: 'ALE rises moderately.' },
      { ref: 'C2', parameter: 'Loss magnitude', concern: 'Project delay costs may be higher.', proposedValue: '1.9M', impactPct: 22, aleImpact: 'ALE rises materially.' }
    ],
    traceLabel: 'Consensus recommendation'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.reviewerCoherence.mode, 'corrected');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'delivery_slippage');
  assert.equal(result.reviewerCoherence.confidenceBand, 'medium');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.summaryBullets[0], /accepted delivery slippage|delivery slippage/i);
  assert.doesNotMatch(result.summaryBullets.join(' '), /programme execution|programme-reset|transformation governance/i);
});

test('challenge assessment corrects forced-labour reviews that collapse into procurement-only framing', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The main issue is supplier assurance process weakness and procurement governance.',
    challengeLevel: 'Targeted challenge recommended',
    weakestAssumptions: ['Supplier due diligence may have missed explicit labour exploitation indicators.'],
    committeeQuestions: ['What evidence shows the labour-abuse indicators were or were not identified?'],
    evidenceToGather: ['Independent labour-rights findings'],
    reviewerGuidance: ['Keep the challenge anchored to the human-rights abuse path rather than procurement process language alone.']
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildChallengeAssessmentWorkflow({
    scenarioTitle: 'Forced labour',
    narrative: 'Sub-tier suppliers are found to be using forced labour conditions that were not identified through due diligence.',
    confidence: { label: 'Low confidence', summary: 'Supplier labour-practice evidence is incomplete.' },
    drivers: { upward: ['Human-rights abuse may be broader than current due diligence suggests'], stabilisers: [] },
    assumptions: [{ category: 'Third party', text: 'Supplier due diligence would identify serious labour exploitation.' }],
    missingInformation: ['Independent labour-rights findings'],
    traceLabel: 'Assessment challenge'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.reviewerCoherence.mode, 'corrected');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'forced_labour_modern_slavery');
  assert.equal(result.reviewerCoherence.confidenceBand, 'medium');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.summary, /forced labour|modern slavery/i);
  assert.doesNotMatch(result.summary, /procurement governance/i);
});

test('challenge assessment corrects greenwashing reviews that collapse into generic policy-breach language', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The main issue is a generic internal policy breach with possible compliance follow-up.',
    challengeLevel: 'Targeted challenge recommended',
    weakestAssumptions: ['The evidence supporting the public sustainability claims may be weaker than assumed.'],
    committeeQuestions: ['Which external sustainability claims cannot currently be evidenced?'],
    evidenceToGather: ['Current claim substantiation pack'],
    reviewerGuidance: ['Keep the challenge anchored to misleading sustainability claims rather than generic policy language.']
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildChallengeAssessmentWorkflow({
    scenarioTitle: 'Greenwashing disclosure gap',
    narrative: 'Public sustainability claims cannot be evidenced and differ materially from actual operating practice.',
    confidence: { label: 'Medium confidence', summary: 'Disclosure support is incomplete.' },
    drivers: { upward: ['Public claims outpace evidence'], stabilisers: [] },
    assumptions: [{ category: 'Disclosure', text: 'Sustainability claims can be supported on demand.' }],
    missingInformation: ['Current claim substantiation pack'],
    traceLabel: 'Assessment challenge'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.reviewerCoherence.mode, 'corrected');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'greenwashing_disclosure_gap');
  assert.equal(result.reviewerCoherence.confidenceBand, 'medium');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.summary, /greenwashing|disclosure gap|accepted greenwashing/i);
  assert.doesNotMatch(result.summary, /generic internal policy breach/i);
});

test('review mediation accepts a mixed identity-plus-disclosure scenario without flattening it into the wrong lane', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    reconciliationSummary: 'Both sides agree the scenario remains a vendor access compromise, with later customer-record extraction still relevant as supported escalation.',
    proposedMiddleGround: 'Keep the vendor access compromise primary while testing how strongly the later customer-record extraction is evidenced.',
    whyReasonable: 'It preserves the accepted vendor-path event and the explicit later disclosure escalation.',
    recommendedField: 'controlStrLikely',
    recommendedValue: 0.57,
    recommendedValueLabel: 'Slightly weaker identity-control strength',
    evidenceToVerify: 'The records showing the compromised vendor path and later customer-record extraction',
    continueDiscussionPrompt: 'Which evidence best proves the vendor access compromise stayed primary even after the later extraction?'
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildReviewMediationWorkflow({
    narrative: 'A compromised vendor access path is used to reach internal systems, misuse privileged access, and later extract customer records.',
    fairParams: { controlStrLikely: 0.62, tefLikely: 5 },
    results: { eventLoss: { p90: 9000000 }, ale: { mean: 3200000 } },
    assessmentIntelligence: { assumptions: [{ text: 'The same access path enabled both privilege misuse and later extraction.' }] },
    reviewerView: 'The later disclosure should materially increase the downside.',
    analystView: 'Identity compromise remains the primary event path even with the later extraction evidence.',
    disputedFocus: 'How much the later disclosure evidence should change the accepted path',
    scenarioLens: { label: 'Cyber' },
    traceLabel: 'Review mediation'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.reviewerCoherence.mode, 'accepted');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'third_party_access_compromise');
  assert.equal(result.reviewerCoherence.confidenceBand, 'high');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.reconciliationSummary, /third-party access compromise|vendor access/i);
  assert.match(result.reconciliationSummary, /later disclosure|later extract|later extraction|customer-record extraction/i);
});

test('review mediation replaces workforce-fatigue outputs that flatten into generic operational capacity language', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    reconciliationSummary: 'This is mainly an operational capacity and backlog problem.',
    proposedMiddleGround: 'Treat the issue as generic service pressure and keep the scenario broad.',
    whyReasonable: 'It avoids overemphasising workforce issues.',
    recommendedField: 'controlStrLikely',
    recommendedValue: 0.61,
    recommendedValueLabel: 'Minor control adjustment',
    evidenceToVerify: 'Backlog metrics only',
    continueDiscussionPrompt: 'What delivery metrics support the operational view?'
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildReviewMediationWorkflow({
    narrative: 'Sustained understaffing and fatigue increase the likelihood of unsafe delivery and control failure.',
    fairParams: { controlStrLikely: 0.62, tefLikely: 5 },
    results: { eventLoss: { p90: 9000000 }, ale: { mean: 3200000 } },
    assessmentIntelligence: { assumptions: [{ text: 'Coverage gaps remain despite overtime.' }] },
    reviewerView: 'Fatigue is being understated as a driver of unsafe delivery.',
    analystView: 'Operational pressure matters, but the scenario should stay specific.',
    disputedFocus: 'Fatigue versus generic capacity language',
    scenarioLens: { label: 'People / workforce' },
    traceLabel: 'Review mediation'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.usedFallback, false);
  assert.equal(result.aiUnavailable, false);
  assert.equal(result.reviewerCoherence.mode, 'corrected');
  assert.equal(result.reviewerCoherence.acceptedPrimaryFamilyKey, 'workforce_fatigue_staffing_weakness');
  assert.equal(result.reviewerCoherence.confidenceBand, 'medium');
  assertReviewerCoherenceMetadata(result);
  assert.match(result.reconciliationSummary, /workforce fatigue|staffing weakness|accepted workforce/i);
  assert.doesNotMatch(result.reconciliationSummary, /generic service pressure|operational capacity/i);
});

test('review coherence confidence calibrates down from accepted to corrected to fallback replacement', async () => {
  let workflows = loadWorkflowFresh();

  global.fetch = buildAiFetch(JSON.stringify({
    whatMatters: 'The accepted issue remains identity compromise through exposed privileged access into the tenant.',
    whatsUncertain: 'The main uncertainty is how far the same privileged-access path could extend before recovery controls contain it.',
    whatToDo: 'Challenge the evidence for privileged-access control performance while keeping the review anchored to the accepted identity-compromise path.'
  }));
  const accepted = await workflows.buildReviewerDecisionBriefWorkflow({
    assessmentData: 'Identity compromise through exposed global admin credentials is used to access the tenant and modify critical configurations.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  });

  global.fetch = buildAiFetch(JSON.stringify({
    whatMatters: 'The real issue is treasury payment control weakness and direct financial loss from approval gaps.',
    whatsUncertain: 'The main uncertainty is how far the same identity-compromise path could extend before recovery controls contain it.',
    whatToDo: 'Challenge the evidence for privileged-access control performance while keeping the review anchored to identity compromise.'
  }));
  workflows = loadWorkflowFresh();
  const corrected = await workflows.buildReviewerDecisionBriefWorkflow({
    assessmentData: 'Identity compromise through exposed global admin credentials is used to access the tenant and modify critical configurations.',
    preferredSection: 'challenge',
    traceLabel: 'Reviewer decision brief'
  });

  global.fetch = buildAiFetch(JSON.stringify({
    overallConcern: 'The main issue is regulatory filing discipline and policy assurance rather than the attack path.',
    revisedAleRange: 'Use a compliance remediation range until the filing programme is rebuilt.',
    keyEvidence: 'The most useful evidence is whether the filing calendar was updated on time.'
  }));
  workflows = loadWorkflowFresh();
  const replaced = await workflows.buildChallengeSynthesisWorkflow({
    scenarioTitle: 'Availability attack',
    scenarioSummary: 'A volumetric DDoS attack floods the public website and degrades customer-facing service availability.',
    baseAleRange: '$2.4M mean ALE',
    records: [
      { parameter: 'TEF', concern: 'Attack traffic may persist longer than assumed.', reviewerAdjustment: { param: 'tefLikely', suggestedValue: 8 } }
    ],
    traceLabel: 'Challenge synthesis'
  });

  assert.ok(accepted.reviewerCoherence.confidenceScore > corrected.reviewerCoherence.confidenceScore);
  assert.ok(corrected.reviewerCoherence.confidenceScore > replaced.reviewerCoherence.confidenceScore);
});
