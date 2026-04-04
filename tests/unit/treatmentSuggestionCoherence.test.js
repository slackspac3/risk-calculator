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
  const modulePath = '../../api/_treatmentSuggestionWorkflow';
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function buildAiFetch(payload) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: payload
          }
        }
      ]
    }),
    text: async () => payload
  });
}

function assertTreatmentCoherenceMetadata(result = {}) {
  assert.equal(typeof result?.treatmentCoherence?.confidenceScore, 'number');
  assert.match(String(result?.treatmentCoherence?.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(result?.treatmentCoherence?.confidenceDrivers));
  assert.equal(typeof result?.treatmentCoherence?.calibrationMode, 'string');
}

test.beforeEach(() => {
  process.env.COMPASS_API_KEY = 'proxy-secret';
  process.env.COMPASS_MODEL = 'gpt-5.4';
});

test.afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
});

test('treatment output stays accepted when the live identity treatment reinforces the accepted lane', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The future-state case strengthens privileged identity protection, MFA, and rapid containment for the same identity compromise path.',
    changesSummary: 'Control strength rises across privileged access, TEF falls modestly, and disruption losses improve through faster containment of the same account-takeover path.',
    workflowGuidance: [
      'Prioritise phishing-resistant MFA and privileged access review for the affected admin path.',
      'Confirm the proposed controls really reduce successful credential misuse.'
    ],
    benchmarkBasis: 'Use realistic privileged-identity hardening and containment improvements.',
    inputRationale: {
      tef: 'Frequency falls only if credential misuse becomes materially harder.',
      vulnerability: 'Vulnerability improves where privileged-access control is materially stronger.',
      lossComponents: 'Loss falls where faster containment limits disruption from the same identity compromise path.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 3, max: 5 },
      controlStrength: { min: 0.55, likely: 0.72, max: 0.88 },
      threatCapability: { min: 0.2, likely: 0.35, max: 0.6 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Identity compromise',
      narrative: 'Azure global admin credentials are used to access the tenant and modify critical configurations.',
      scenarioLens: { key: 'cyber', label: 'Cyber' },
      selectedRisks: [
        { title: 'Privileged account takeover through exposed admin credentials' }
      ],
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.45,
        biLikely: 120000
      }
    },
    improvementRequest: 'Stronger MFA and faster containment for privileged admin access.'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.treatmentCoherence.mode, 'accepted');
  assert.equal(result.treatmentCoherence.acceptedPrimaryFamilyKey, 'identity_compromise');
  assert.ok(['high', 'medium'].includes(result.treatmentCoherence.confidenceBand));
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /identity compromise|privileged identity|privileged access/i);
});

test('treatment output corrects identity cases that drift into finance-control recommendations', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The best treatment is tighter treasury approvals, payment-control redesign, and payment reconciliation.',
    changesSummary: 'Keep the same identity compromise path, but use stronger privileged access review and MFA to reduce successful credential abuse.',
    workflowGuidance: [
      'Test whether stronger identity controls really reduce account takeover success.',
      'Avoid treating this as a treasury-control issue unless the scenario changes.'
    ],
    benchmarkBasis: 'Use realistic privileged-access and containment improvements.',
    inputRationale: {
      tef: 'Frequency falls where credential misuse is harder.',
      vulnerability: 'Vulnerability improves where privileged-access controls are stronger.',
      lossComponents: 'Loss falls where containment is faster on the same identity path.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 3, max: 5 },
      controlStrength: { min: 0.55, likely: 0.72, max: 0.88 },
      threatCapability: { min: 0.2, likely: 0.35, max: 0.6 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Identity compromise',
      narrative: 'Exposed privileged credentials are used to access the tenant and modify critical configurations.',
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.45,
        biLikely: 120000
      }
    },
    improvementRequest: 'Stronger MFA and privileged session monitoring.'
  });

  assert.equal(result.mode, 'live');
  assert.equal(result.treatmentCoherence.mode, 'corrected');
  assert.ok(result.treatmentCoherence.correctedSections.includes('summary'));
  assert.equal(result.treatmentCoherence.confidenceBand, 'medium');
  assert.ok(result.treatmentCoherence.confidenceDrivers.includes('OUTPUT_CORRECTED'));
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /accepted identity compromise|privileged identity|identity compromise/i);
  assert.doesNotMatch(result.summary, /treasury|payment reconciliation/i);
});

test('treatment output replaces supplier-delay suggestions that drift into cyber controls', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The treatment should focus on endpoint hardening and malware containment across the estate.',
    changesSummary: 'Use stronger EDR, credential monitoring, and privileged access review to reduce the cyber path.',
    workflowGuidance: [
      'Deploy stronger endpoint controls immediately.',
      'Harden vendor credentials across the environment.'
    ],
    benchmarkBasis: 'Use realistic cyber hardening improvements.',
    inputRationale: {
      tef: 'Frequency falls where attackers are blocked earlier.',
      vulnerability: 'Vulnerability improves where cyber controls are stronger.',
      lossComponents: 'Loss falls where cyber containment is faster.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2, max: 4 },
      controlStrength: { min: 0.6, likely: 0.75, max: 0.9 },
      threatCapability: { min: 0.2, likely: 0.4, max: 0.7 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Supplier delivery slippage',
      narrative: 'A key supplier misses committed delivery dates, delaying infrastructure deployment and dependent projects.',
      selectedRisks: [{ title: 'Delivery slippage from key supplier delay' }],
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.42,
        biLikely: 160000,
        tpLikely: 90000
      }
    },
    improvementRequest: 'Alternate sourcing, earlier escalation, and contingency buffers for delivery commitments.'
  });

  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.usedFallback, true);
  assert.equal(result.aiUnavailable, false);
  assert.equal(result.treatmentCoherence.mode, 'fallback_replaced');
  assert.equal(result.treatmentCoherence.acceptedPrimaryFamilyKey, 'delivery_slippage');
  assert.equal(result.treatmentCoherence.confidenceBand, 'low');
  assert.ok(result.treatmentCoherence.confidenceDrivers.includes('OUTPUT_REPLACED'));
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /delivery slippage|supplier|dependency|contingency/i);
  assert.doesNotMatch(result.summary, /endpoint|malware|cyber/i);
});

test('privacy treatment stays anchored to privacy governance rather than breach response when disclosure is absent', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'Improve lawful-basis checks and processing approvals for the same privacy-obligation path.',
    changesSummary: 'The future-state case strengthens privacy governance, retention controls, and processing review on the same obligation path.',
    workflowGuidance: [
      'Prioritise lawful-basis checks and processing approvals.',
      'Tighten retention and privacy-control execution.'
    ],
    benchmarkBasis: 'Use realistic privacy-governance improvements rather than breach-response assumptions.',
    inputRationale: {
      tef: 'Frequency falls where unsupported processing becomes less likely.',
      vulnerability: 'Vulnerability improves where privacy controls are stronger.',
      lossComponents: 'Loss falls where non-compliant processing is prevented earlier, not because a breach is assumed.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2, max: 4 },
      controlStrength: { min: 0.55, likely: 0.7, max: 0.85 },
      threatCapability: { min: 0.25, likely: 0.4, max: 0.6 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 18000, max: 30000 },
        businessInterruption: { min: 40000, likely: 70000, max: 110000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 15000 },
        regulatoryLegal: { min: 12000, likely: 22000, max: 40000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 8000, likely: 14000, max: 24000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Privacy obligation failure',
      narrative: 'Customer records are processed without a lawful basis under stated privacy obligations.',
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.4,
        rlLikely: 180000
      }
    },
    improvementRequest: 'Stronger lawful-basis approvals and retention governance.'
  });

  assert.equal(result.treatmentCoherence.acceptedPrimaryFamilyKey, 'privacy_non_compliance');
  assert.ok(['high', 'medium'].includes(result.treatmentCoherence.confidenceBand));
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /privacy|lawful basis|processing/i);
  assert.doesNotMatch(result.summary, /breach response|exfiltration|notification/i);
});

test('forced-labour treatment stays in human-rights remediation rather than procurement-only framing', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The future-state case strengthens supplier due diligence, worker-protection escalation, and corrective action for the same forced-labour path.',
    changesSummary: 'Suggested changes improve labour-rights detection, remediation, and supplier intervention instead of procurement-only scheduling actions.',
    workflowGuidance: [
      'Prioritise labour-rights due diligence and corrective action plans.',
      'Strengthen worker-protection escalation and independent verification.'
    ],
    benchmarkBasis: 'Use realistic human-rights remediation improvements.',
    inputRationale: {
      tef: 'Frequency falls where labour-abuse indicators are found earlier.',
      vulnerability: 'Vulnerability improves where due diligence and escalation are stronger.',
      lossComponents: 'Loss falls where remediation happens earlier on the same human-rights path.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2, max: 4 },
      controlStrength: { min: 0.45, likely: 0.62, max: 0.8 },
      threatCapability: { min: 0.25, likely: 0.38, max: 0.55 },
      lossComponents: {
        incidentResponse: { min: 15000, likely: 22000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 130000 },
        dataBreachRemediation: { min: 3000, likely: 5000, max: 9000 },
        regulatoryLegal: { min: 20000, likely: 30000, max: 50000 },
        thirdPartyLiability: { min: 10000, likely: 18000, max: 28000 },
        reputationContract: { min: 12000, likely: 20000, max: 32000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Forced labour',
      narrative: 'Sub-tier suppliers are found to be using forced labour conditions that were not identified through due diligence.',
      fairParams: {
        tefLikely: 4,
        controlStrLikely: 0.35,
        tpLikely: 90000
      }
    },
    improvementRequest: 'Stronger labour-rights due diligence and supplier remediation.'
  });

  assert.equal(result.treatmentCoherence.acceptedPrimaryFamilyKey, 'forced_labour_modern_slavery');
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /forced labour|human-rights|worker-protection|supplier remediation/i);
  assert.doesNotMatch(result.summary, /cost savings|procurement-only/i);
});

test('safety treatment stays safety-control oriented instead of generic operational efficiency', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The future-state case strengthens safe operating conditions, hazard controls, and incident response for the same safety path.',
    changesSummary: 'Suggested changes improve barrier reliability, supervision, and emergency readiness on the same safety event path.',
    workflowGuidance: [
      'Prioritise hazard elimination and safe-system controls.',
      'Strengthen emergency response and supervision on site.'
    ],
    benchmarkBasis: 'Use realistic safety-barrier improvements rather than efficiency initiatives.',
    inputRationale: {
      tef: 'Frequency falls where unsafe conditions are less likely.',
      vulnerability: 'Vulnerability improves where safety controls are stronger.',
      lossComponents: 'Loss falls where the same safety incident is prevented or contained earlier.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2, max: 4 },
      controlStrength: { min: 0.55, likely: 0.72, max: 0.86 },
      threatCapability: { min: 0.25, likely: 0.38, max: 0.55 },
      lossComponents: {
        incidentResponse: { min: 12000, likely: 18000, max: 26000 },
        businessInterruption: { min: 60000, likely: 90000, max: 140000 },
        dataBreachRemediation: { min: 3000, likely: 6000, max: 10000 },
        regulatoryLegal: { min: 18000, likely: 26000, max: 42000 },
        thirdPartyLiability: { min: 4000, likely: 7000, max: 12000 },
        reputationContract: { min: 10000, likely: 16000, max: 24000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Safety incident',
      narrative: 'Unsafe operating conditions lead to a site safety incident with potential worker harm.',
      fairParams: {
        tefLikely: 5,
        controlStrLikely: 0.38,
        biLikely: 150000
      }
    },
    improvementRequest: 'Better hazard controls and emergency response readiness.'
  });

  assert.equal(result.treatmentCoherence.acceptedPrimaryFamilyKey, 'safety_incident');
  assert.ok(['high', 'medium'].includes(result.treatmentCoherence.confidenceBand));
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /safety|hazard|safe operating|incident response/i);
  assert.doesNotMatch(result.summary, /operational efficiency|productivity/i);
});

test('workforce-fatigue treatment replaces generic capacity language with staffing-resilience treatment', async () => {
  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The best response is broad operational efficiency and backlog management.',
    changesSummary: 'Use capacity dashboards and productivity targets to lower service pressure.',
    workflowGuidance: [
      'Focus on queue management and throughput metrics.',
      'Keep the treatment broad and operational.'
    ],
    benchmarkBasis: 'Use realistic delivery-efficiency improvements.',
    inputRationale: {
      tef: 'Frequency falls where throughput improves.',
      vulnerability: 'Vulnerability improves where delivery cadence is stronger.',
      lossComponents: 'Loss falls where backlog pressure is lower.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2, max: 4 },
      controlStrength: { min: 0.55, likely: 0.7, max: 0.84 },
      threatCapability: { min: 0.25, likely: 0.38, max: 0.55 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 15000, max: 22000 },
        businessInterruption: { min: 45000, likely: 70000, max: 110000 },
        dataBreachRemediation: { min: 3000, likely: 6000, max: 10000 },
        regulatoryLegal: { min: 6000, likely: 12000, max: 20000 },
        thirdPartyLiability: { min: 2000, likely: 4000, max: 7000 },
        reputationContract: { min: 8000, likely: 12000, max: 18000 }
      }
    }
  }));

  const workflows = loadWorkflowFresh();
  const result = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Workforce fatigue',
      narrative: 'Sustained understaffing and fatigue increase the likelihood of unsafe delivery and control failure.',
      fairParams: {
        tefLikely: 5,
        controlStrLikely: 0.4,
        biLikely: 140000
      }
    },
    improvementRequest: 'Better staffing coverage, fatigue controls, and rota resilience.'
  });

  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.treatmentCoherence.mode, 'fallback_replaced');
  assert.equal(result.treatmentCoherence.acceptedPrimaryFamilyKey, 'workforce_fatigue_staffing_weakness');
  assert.equal(result.treatmentCoherence.confidenceBand, 'low');
  assertTreatmentCoherenceMetadata(result);
  assert.match(result.summary, /workforce fatigue|staffing weakness|coverage|fatigue/i);
  assert.doesNotMatch(result.summary, /operational efficiency|backlog management/i);
});

test('treatment coherence confidence calibrates down from accepted to corrected to fallback replacement', async () => {
  let workflows = loadWorkflowFresh();

  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The future-state case strengthens privileged identity protection, MFA, and rapid containment for the same identity compromise path.',
    changesSummary: 'Control strength rises across privileged access, TEF falls modestly, and disruption losses improve through faster containment of the same account-takeover path.',
    workflowGuidance: [
      'Prioritise phishing-resistant MFA and privileged access review for the affected admin path.'
    ],
    benchmarkBasis: 'Use realistic privileged-identity hardening and containment improvements.',
    inputRationale: {
      tef: 'Frequency falls only if credential misuse becomes materially harder.',
      vulnerability: 'Vulnerability improves where privileged-access control is materially stronger.',
      lossComponents: 'Loss falls where faster containment limits disruption from the same identity compromise path.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 3, max: 5 },
      controlStrength: { min: 0.55, likely: 0.72, max: 0.88 },
      threatCapability: { min: 0.2, likely: 0.35, max: 0.6 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
  }));
  const accepted = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Identity compromise',
      narrative: 'Azure global admin credentials are used to access the tenant and modify critical configurations.',
      fairParams: { tefLikely: 4, controlStrLikely: 0.45, biLikely: 120000 }
    },
    improvementRequest: 'Stronger MFA and faster containment for privileged admin access.'
  });

  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The best treatment is tighter treasury approvals, payment-control redesign, and payment reconciliation.',
    changesSummary: 'Keep the same identity compromise path, but use stronger privileged access review and MFA to reduce successful credential abuse.',
    workflowGuidance: [
      'Test whether stronger identity controls really reduce account takeover success.',
      'Avoid treating this as a treasury-control issue unless the scenario changes.'
    ],
    benchmarkBasis: 'Use realistic privileged-access and containment improvements.',
    inputRationale: {
      tef: 'Frequency falls where credential misuse is harder.',
      vulnerability: 'Vulnerability improves where privileged-access controls are stronger.',
      lossComponents: 'Loss falls where containment is faster on the same identity path.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 3, max: 5 },
      controlStrength: { min: 0.55, likely: 0.72, max: 0.88 },
      threatCapability: { min: 0.2, likely: 0.35, max: 0.6 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
  }));
  workflows = loadWorkflowFresh();
  const corrected = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Identity compromise',
      narrative: 'Exposed privileged credentials are used to access the tenant and modify critical configurations.',
      fairParams: { tefLikely: 4, controlStrLikely: 0.45, biLikely: 120000 }
    },
    improvementRequest: 'Stronger MFA and privileged session monitoring.'
  });

  global.fetch = buildAiFetch(JSON.stringify({
    summary: 'The treatment should focus on endpoint hardening and malware containment across the estate.',
    changesSummary: 'Use stronger EDR, credential monitoring, and privileged access review to reduce the cyber path.',
    workflowGuidance: ['Deploy stronger endpoint controls immediately.'],
    benchmarkBasis: 'Use realistic cyber hardening improvements.',
    inputRationale: {
      tef: 'Frequency falls where attackers are blocked earlier.',
      vulnerability: 'Vulnerability improves where cyber controls are stronger.',
      lossComponents: 'Loss falls where cyber containment is faster.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2, max: 4 },
      controlStrength: { min: 0.6, likely: 0.75, max: 0.9 },
      threatCapability: { min: 0.2, likely: 0.4, max: 0.7 },
      lossComponents: {
        incidentResponse: { min: 10000, likely: 20000, max: 35000 },
        businessInterruption: { min: 50000, likely: 80000, max: 120000 },
        dataBreachRemediation: { min: 5000, likely: 10000, max: 20000 },
        regulatoryLegal: { min: 2000, likely: 5000, max: 10000 },
        thirdPartyLiability: { min: 1000, likely: 2500, max: 5000 },
        reputationContract: { min: 10000, likely: 18000, max: 30000 }
      }
    }
  }));
  workflows = loadWorkflowFresh();
  const replaced = await workflows.buildTreatmentSuggestionWorkflow({
    baselineAssessment: {
      scenarioTitle: 'Supplier delivery slippage',
      narrative: 'A key supplier misses committed delivery dates, delaying infrastructure deployment and dependent projects.',
      selectedRisks: [{ title: 'Delivery slippage from key supplier delay' }],
      fairParams: { tefLikely: 4, controlStrLikely: 0.42, biLikely: 160000, tpLikely: 90000 }
    },
    improvementRequest: 'Alternate sourcing, earlier escalation, and contingency buffers for delivery commitments.'
  });

  assert.ok(accepted.treatmentCoherence.confidenceScore > corrected.treatmentCoherence.confidenceScore);
  assert.ok(corrected.treatmentCoherence.confidenceScore > replaced.treatmentCoherence.confidenceScore);
});
