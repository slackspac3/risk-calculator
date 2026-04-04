'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLlmServiceContext } = require('./helpers/loadLlmServiceHarness');

function loadLlmInternals() {
  let instrumentedSuccessfully = false;
  const context = loadLlmServiceContext({
    origin: 'http://127.0.0.1:8080',
    fetchImpl: async () => {
      throw new Error('fetch should not be called in llmServiceClassification.test.js');
    },
    transformLlmService(source) {
      const instrumented = source.replace(
        '  return {\n    buildGuidedScenarioDraft,',
        '  globalThis.__llmInternals = { _classifyScenario, _extractRiskCandidates, _evaluateGuidedDraftCandidate, _filterPromptIdeaCandidates, _buildContextPromptBlock, _buildScenarioContextResolution, _getAiFeedbackLearningProfile, _rerankRisksWithFeedback };\n\n  return {\n    buildGuidedScenarioDraft,'
      );
      instrumentedSuccessfully = instrumented !== source;
      return instrumented;
    }
  });
  assert.equal(instrumentedSuccessfully, true, 'Failed to instrument llmService internals for test access');
  return context.__llmInternals;
}

test('classifies technology downtime with human error as operational rather than cyber', () => {
  const internals = loadLlmInternals();
  const classification = internals._classifyScenario(
    'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
    {
      guidedInput: {
        event: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption',
        asset: 'Cloud system',
        cause: 'Human error',
        impact: 'Customer impact, reputational loss'
      }
    }
  );

  assert.equal(classification.key, 'operational');
});

test('classifies no-DR Outlook email-service scenario as business continuity rather than cyber or AI', () => {
  const internals = loadLlmInternals();
  const text = 'There is no DR for the critical email system in place, which is MS Outlook online.';
  const classification = internals._classifyScenario(text, {
    guidedInput: {
      event: text,
      asset: 'MS Outlook online',
      cause: 'No disaster recovery or failover capability',
      impact: 'Extended outage and recovery pressure'
    }
  });

  assert.equal(classification.key, 'business-continuity');

  const risks = internals._extractRiskCandidates(text, {
    lensHint: { key: 'business-continuity', label: 'Business continuity' }
  });

  assert.equal(risks[0]?.key, 'business-continuity');
  assert.equal(risks.some((risk) => risk.key === 'ai-model-risk'), false);
  assert.equal(risks.some((risk) => risk.key === 'cyber'), false);
});

test('classifies counterparty default scenario as financial rather than fraud-integrity', () => {
  const internals = loadLlmInternals();
  const text = 'A major client files for bankruptcy, creating receivables recovery pressure and a likely write-off.';
  const classification = internals._classifyScenario(text, {
    guidedInput: {
      event: text,
      asset: 'Major customer receivables balance',
      cause: 'Customer insolvency',
      impact: 'Bad-debt write-off and cashflow strain'
    }
  });

  assert.equal(classification.key, 'financial');

  const risks = internals._extractRiskCandidates(text, {
    lensHint: { key: 'financial', label: 'Financial' }
  });

  assert.equal(risks[0]?.key, 'financial');
  assert.equal(risks.some((risk) => risk.key === 'fraud-integrity'), false);
});

test('classifies supplier labour scenario as ESG and keeps fallback risks out of cyber', () => {
  const internals = loadLlmInternals();
  const text = 'A supplier is linked to forced labour practices in a critical sourcing category, creating human-rights scrutiny and remediation pressure.';
  const classification = internals._classifyScenario(text, {
    guidedInput: {
      event: text,
      asset: 'Critical supplier relationship',
      cause: 'Weak sub-tier due diligence',
      impact: 'Human-rights scrutiny and remediation pressure'
    }
  });

  assert.equal(classification.key, 'esg');

  const risks = internals._extractRiskCandidates(text, {
    lensHint: { key: 'esg', label: 'ESG' }
  });

  assert.equal(risks[0]?.key, 'esg');
  assert.equal(risks.some((risk) => risk.key === 'cyber'), false);
});

test('extractRiskCandidates prefers operational outage risks over cyber for non-compromise cloud downtime', () => {
  const internals = loadLlmInternals();
  const risks = internals._extractRiskCandidates(
    'Unscheduled IT system downtime due to aging infrastructure. Cloud system affected. Human error triggered critical operational disruption and customer impact.',
    {
      lensHint: { key: 'operational', label: 'Operational' }
    }
  );

  assert.equal(risks[0]?.key, 'operational');
  assert.equal(risks.some((risk) => risk.key === 'cyber'), false);
});

test('supplier delivery slippage for infrastructure deployment stays out of procurement and into delivery risk', () => {
  const internals = loadLlmInternals();
  const text = 'A key server supplier misses a committed delivery date, delaying planned infrastructure deployment and dependent business projects.';
  const classification = internals._classifyScenario(text, {
    guidedInput: {
      event: text,
      asset: 'Infrastructure deployment',
      cause: 'Supplier delivery miss',
      impact: 'Dependent business project delay'
    }
  });

  assert.equal(classification.key, 'supply-chain');

  const risks = internals._extractRiskCandidates(text, {
    lensHint: { key: 'operational', label: 'Operational' }
  });

  assert.equal(risks[0]?.key, 'transformation-delivery');
  assert.equal(risks.some((risk) => risk.key === 'procurement'), false);
});

test('classifies volumetric DDoS as cyber availability rather than compliance or AI drift', () => {
  const internals = loadLlmInternals();
  const text = 'DDoS traffic overwhelms the public website and degrades customer-facing services.';
  const classification = internals._classifyScenario(text, {
    guidedInput: {
      event: text,
      asset: 'Public website',
      cause: 'Volumetric hostile traffic',
      impact: 'Customer-facing service degradation'
    }
  });

  assert.equal(classification.key, 'availability-attack');

  const risks = internals._extractRiskCandidates(text, {
    lensHint: { key: 'cyber', label: 'Cyber' }
  });

  assert.equal(risks.some((risk) => risk.key === 'compliance'), false);
  assert.equal(risks.some((risk) => risk.key === 'ai-model-risk'), false);
});

test('classifies privacy-obligation wording as compliance rather than data breach without disclosure signals', () => {
  const internals = loadLlmInternals();
  const text = 'Customer records are retained and processed in breach of privacy obligations and lawful basis requirements.';
  const classification = internals._classifyScenario(text, {
    guidedInput: {
      event: text,
      asset: 'Customer records',
      cause: 'Weak retention and lawful-basis control',
      impact: 'Supervisory scrutiny and remediation pressure'
    }
  });

  assert.equal(classification.key, 'compliance');

  const risks = internals._extractRiskCandidates(text, {
    lensHint: { key: 'compliance', label: 'Compliance' }
  });

  assert.equal(risks.some((risk) => risk.key === 'data-breach'), false);
  assert.equal(risks[0]?.key, 'compliance');
});

test('evaluateGuidedDraftCandidate rejects a draft that explicitly labels the wrong lens', () => {
  const internals = loadLlmInternals();
  const candidate = internals._evaluateGuidedDraftCandidate(
    'Critical-urgency Compliance scenario: Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption. The area most exposed is the cloud system. The most likely driver is human error. If this develops, it could create customer impact and reputational loss.',
    {
      seedNarrative: 'Critical-urgency Operational scenario: Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption. The area most exposed is the cloud system. The most likely driver is human error. If this develops, it could create customer impact and reputational loss.',
      guidedInput: {
        event: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption',
        asset: 'Cloud system',
        cause: 'Human error',
        impact: 'Customer impact, reputational loss'
      },
      scenarioLensHint: { key: 'operational', label: 'Operational' }
    }
  );

  assert.equal(candidate.accepted, false);
  assert.equal(candidate.reason, 'explicit-lens-drift');
});

test('evaluateGuidedDraftCandidate rejects procurement framing for supplier delivery slippage', () => {
  const internals = loadLlmInternals();
  const candidate = internals._evaluateGuidedDraftCandidate(
    'High-urgency Procurement scenario: A key server supplier misses a committed delivery date, delaying planned infrastructure deployment and dependent business projects. The area most exposed is the sourcing decision and contract award path. If this develops, it could create commercial overpayment and award challenge.',
    {
      seedNarrative: 'High-urgency Operational scenario: A key server supplier misses a committed delivery date, delaying planned infrastructure deployment and dependent business projects. The area most exposed is the delivery dependency and deployment timeline. If this develops, it could create milestone slippage and pressure on downstream business commitments.',
      guidedInput: {
        event: 'A key server supplier misses a committed delivery date, delaying planned infrastructure deployment and dependent business projects.',
        asset: 'Infrastructure deployment',
        cause: 'Supplier delivery miss',
        impact: 'Dependent business project delay'
      },
      scenarioLensHint: { key: 'operational', label: 'Operational' }
    }
  );

  assert.equal(candidate.accepted, false);
  assert.equal(candidate.reason, 'explicit-lens-drift');
});

test('filterPromptIdeaCandidates rejects AI-model drift for dark-web credential exposure', () => {
  const internals = loadLlmInternals();
  const ideas = internals._filterPromptIdeaCandidates([
    {
      label: 'Privileged credential exposure',
      prompt: 'Privileged or administrator credentials are exposed and create a high-risk access path.'
    },
    {
      label: 'Responsible AI drift',
      prompt: 'A model governance issue creates unsafe output and conduct risk.'
    }
  ], {
    sourceText: 'An Azure admin account credential were found on the darkweb',
    classification: { key: 'identity', secondaryKeys: [] },
    scenarioLensHint: 'identity'
  });

  const labels = ideas.map((idea) => idea.label);
  assert.ok(labels.includes('Privileged credential exposure'));
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('buildContextPromptBlock makes resolved direct and inherited obligations explicit', () => {
  const internals = loadLlmInternals();
  const block = internals._buildContextPromptBlock({
    businessUnitContext: 'Subsidiary technology context',
    resolvedObligationContext: {
      direct: [
        {
          title: 'Local cyber incident reporting',
          sourceEntityName: 'Operating company',
          text: 'Critical cyber events must be reported to the local regulator.'
        }
      ],
      inheritedMandatory: [
        {
          title: 'Group privileged access standard',
          sourceEntityName: 'Holding company',
          text: 'Privileged access reviews must follow the group standard.'
        }
      ],
      inheritedConditional: [],
      inheritedGuidance: [],
      allResolved: [],
      summary: 'Direct obligations and inherited group obligations are active.'
    }
  });

  assert.match(block, /Resolved obligation basis/i);
  assert.match(block, /Direct obligations:/i);
  assert.match(block, /Inherited mandatory obligations:/i);
  assert.match(block, /Group privileged access standard/i);
});

test('buildScenarioContextResolution carries resolved obligations as approved context', () => {
  const internals = loadLlmInternals();
  const resolution = internals._buildScenarioContextResolution({
    narrative: 'Privileged administrator credentials were used to access the tenant and change critical configurations.',
    guidedInput: {
      event: 'Privileged administrator credentials were used to access the tenant and change critical configurations.',
      asset: 'Directory tenant',
      cause: 'Credential exposure',
      impact: 'Service disruption and control failure'
    },
    businessUnit: { name: 'Technology' },
    adminSettings: {
      resolvedObligationContext: {
        direct: [],
        inheritedMandatory: [
          {
            title: 'Group privileged access standard',
            sourceEntityName: 'Holding company',
            text: 'Privileged access reviews must follow the group standard.'
          }
        ],
        inheritedConditional: [],
        inheritedGuidance: [],
        allResolved: [],
        summary: 'Inherited group obligations are active.'
      }
    },
    geography: 'United Arab Emirates',
    applicableRegulations: ['UAE PDPL']
  });

  assert.match(resolution.approvedContext.obligations, /Group privileged access standard/i);
  assert.equal(
    resolution.applies.some((item) => item.kind === 'obligations'),
    true
  );
});

test('browser-side learning profile lookup is disabled for authoritative inference use', async () => {
  const internals = loadLlmInternals();
  const profile = await internals._getAiFeedbackLearningProfile({
    businessUnitId: 'g42',
    functionKey: 'technology',
    scenarioLensKey: 'cyber'
  });

  assert.equal(profile, null);
});

test('browser-side risk reranking is neutralized when learning authority moved server-side', () => {
  const internals = loadLlmInternals();
  const risks = [
    { title: 'Generic service instability' },
    { title: 'Privileged account compromise' }
  ];

  const reranked = internals._rerankRisksWithFeedback(risks, {
    combined: {
      riskWeights: { 'Privileged account compromise': 2 }
    }
  });

  assert.deepEqual(reranked, risks);
});
