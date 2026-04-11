'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { workflowUtils } = require('../../api/_scenarioDraftWorkflow');

test('evaluateGuidedDraftCandidate rejects consequence-led rewrites that drop the user event anchors', () => {
  const seedNarrative = 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical settings.';
  const result = workflowUtils.evaluateGuidedDraftCandidate(
    'The Azure tenant now faces financial loss, regulatory scrutiny, and wider control pressure after the incident.',
    {
      seedNarrative,
      guidedInput: {
        event: 'Azure global admin credentials discovered on the dark web',
        cause: 'Leaked administrator credentials',
        asset: 'Azure tenant administration',
        impact: 'Control disruption and fraud exposure'
      },
      scenarioLensHint: 'cyber',
      businessUnit: { name: 'Group Technology' }
    }
  );

  assert.equal(result.accepted, false);
  assert.match(String(result.reason || ''), /missing-event-anchor|weak-critical-anchor-overlap|narrow-anchor-coverage|weak-event-anchor-coverage/);
});

test('evaluateGuidedDraftCandidate rejects OT template drift for cross-border health-data scenarios', () => {
  const seedNarrative = 'Sensitive health data is transferred across borders for analytics without a completed transfer assessment, but there is no evidence the data was exposed.';
  const result = workflowUtils.evaluateGuidedDraftCandidate(
    'Sensitive health data is transferred across borders for analytics without a completed transfer assessment, but there is no evidence the data was exposed. This points to an OT and site-resilience issue that sits between cyber, operations, and safety. The area most exposed is the industrial-control, telemetry, and site-recovery path around the affected operating environment.',
    {
      seedNarrative,
      guidedInput: {
        event: seedNarrative
      },
      scenarioLensHint: 'compliance'
    }
  );

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'unsupported-ot-template-drift');
});

test('evaluateGuidedDraftCandidate rejects supplier-delivery template drift for payroll processor incidents', () => {
  const seedNarrative = 'A third-party payroll processor applies a configuration change that misroutes salary payments, exposing bank details to the wrong employees and delaying correction because incident ownership is unclear.';
  const result = workflowUtils.evaluateGuidedDraftCandidate(
    'A third-party payroll processor applies a configuration change that misroutes salary payments, exposing bank details to the wrong employees and delaying correction because incident ownership is unclear. This points to a supplier-dependency and delivery issue rather than a weak sourcing-governance or contract-award decision. The area most exposed is the infrastructure deployment, milestone plan, and dependent business projects waiting on the supplier delivery path.',
    {
      seedNarrative,
      guidedInput: {
        event: seedNarrative
      },
      scenarioLensHint: 'third-party'
    }
  );

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'unsupported-supplier-template-drift');
});

test('guided Step 1 prompt support stays compact while preserving the strongest anchors', () => {
  const seedNarrative = 'Key vendor delivery slips are blocking a dependent rollout and delaying committed milestones.';
  const input = {
    guidedInput: {
      event: 'Key vendor delivery slips are blocking a dependent rollout',
      cause: 'A dependency missed committed delivery dates',
      asset: 'The dependent rollout programme',
      impact: 'Dependent teams cannot complete the rollout on time'
    }
  };
  const classification = workflowUtils.classifyScenario(seedNarrative, input);
  const priorityBlock = workflowUtils.buildGuidedScenarioPriorityPromptBlock(input, {
    seedNarrative,
    classification
  });
  const contextBlock = workflowUtils.buildGuidedScenarioContextPromptBlock({
    businessUnitContext: 'Vendor dependency context. '.repeat(120),
    departmentContext: 'Programme steering context. '.repeat(100),
    inheritedContextSummary: 'Inherited organisation context. '.repeat(100),
    personalContextSummary: 'User-specific context. '.repeat(80),
    resolvedObligationSummary: 'Delivery obligations require active dependency management. '.repeat(80),
    resolvedObligationContext: {
      direct: [{ title: 'Delivery obligation', text: 'Critical programmes must maintain delivery evidence and escalation triggers. '.repeat(40) }]
    }
  }, {
    selectedDepartmentContext: 'Selected rollout context. '.repeat(80)
  });
  const evidenceBlock = workflowUtils.buildGuidedScenarioEvidencePromptBlock({
    promptBlock: 'Evidence quality: Useful but incomplete evidence base.\nConfidence: Moderate confidence.\nAvailable evidence: Evidence used: BU/function context and 2 cited sources.',
    missingInformation: [
      'Geographic scope is not well defined.',
      'Relevant regulatory references are limited or missing.',
      'No external citations were available to ground the output.'
    ]
  });
  const citationBlock = workflowUtils.buildGuidedCitationPromptBlock([
    { title: 'Generic governance note', score: 10, relevanceReason: 'General programme governance review only.', excerpt: 'A generic planning note without direct scenario evidence.' },
    { title: 'Most relevant source', score: 9, relevanceReason: 'Directly mentions delivery slippage on dependent programmes.', excerpt: 'Key vendor milestones slipped against the committed plan.' },
    { title: 'Second source', score: 8, relevanceReason: 'Confirms dependent rollout blockage.', excerpt: 'Downstream teams cannot complete rollout tasks until the vendor deliverable lands.' },
    { title: 'Third source', score: 7, relevanceReason: 'Supports the same delivery event path.', excerpt: 'Escalation history shows repeated committed-date misses.' },
    { title: 'Fourth source', score: 6, relevanceReason: 'Supports the same dependency chain.', excerpt: 'Programme leadership has already raised dependency concerns.' }
  ], {
    seedNarrative,
    input,
    classification
  });

  assert.match(priorityBlock, /Priority details to preserve:/);
  assert.match(priorityBlock, /Event path:/);
  assert.match(priorityBlock, /Trigger or cause:/);
  assert.match(priorityBlock, /Accepted taxonomy anchor:/);
  assert.ok(contextBlock.length < 3800);
  assert.match(contextBlock, /Live business-unit context:/);
  assert.match(contextBlock, /Resolved obligation basis:/);
  assert.match(evidenceBlock, /Known evidence gaps:/);
  assert.equal((citationBlock.match(/^- /gm) || []).length, 4);
  assert.doesNotMatch(citationBlock, /Generic governance note/);
  assert.match(citationBlock, /Most relevant source/);
});

test('missing-detail planner asks for supplier-specific asset detail on supply-chain wording', () => {
  const plan = workflowUtils.inferStep1MissingDetailPlan({
    guidedInput: {
      event: 'Key vendor delivery slips are blocking a dependent rollout.',
      impact: 'Dependent teams cannot complete the rollout on time.'
    },
    scenarioLensHint: 'supply-chain'
  }, {
    seedNarrative: 'Key vendor delivery slips are blocking a dependent rollout and delaying dependent milestones.',
    purpose: 'guided_draft'
  });

  assert.equal(plan.focusKey, 'asset');
  assert.match(String(plan.focusPrompt || ''), /supplier|dependency|milestone|service/i);
  assert.match(String(plan.guidance?.join(' ') || ''), /Keep the scenario to one clear event path/i);
});

test('missing-detail planner asks for privacy-specific trigger detail on records wording', () => {
  const plan = workflowUtils.inferStep1MissingDetailPlan({
    guidedInput: {
      event: 'Customer records are retained too long and moved abroad.',
      asset: 'Customer records and troubleshooting logs',
      impact: 'Privacy obligations may be breached.'
    },
    scenarioLensHint: 'compliance'
  }, {
    seedNarrative: 'Customer records are retained too long and moved abroad without clear safeguards.',
    purpose: 'guided_draft'
  });

  assert.equal(plan.focusKey, 'cause');
  assert.match(String(plan.focusPrompt || ''), /retention weakness|transfer step|control gap/i);
  assert.match(String(plan.reasonMessage || ''), /before trying AI draft generation again/i);
});
