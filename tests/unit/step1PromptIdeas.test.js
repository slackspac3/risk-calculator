'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadStep1Internals() {
  const projectionDataPath = path.resolve(__dirname, '../../assets/services/scenarioTaxonomyProjectionData.js');
  const projectionPath = path.resolve(__dirname, '../../assets/services/scenarioTaxonomyProjection.js');
  const filePath = path.resolve(__dirname, '../../assets/wizard/step1.js');
  const projectionDataSource = fs.readFileSync(projectionDataPath, 'utf8');
  const projectionSource = fs.readFileSync(projectionPath, 'utf8');
  const source = fs.readFileSync(filePath, 'utf8');
  let lastGuessRisksArgs = null;

  const noopStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };

  const context = {
    console,
    Date,
    JSON,
    Math,
    URL,
    Set,
    Map,
    localStorage: noopStorage,
    sessionStorage: noopStorage,
    window: { Step1Assist: {} },
    document: {},
    AppState: { draft: {} },
    AuthService: {
      getCurrentUser: () => ({})
    },
    getEffectiveSettings: () => ({}),
    normaliseUserProfile: () => ({
      jobTitle: '',
      department: '',
      businessUnit: '',
      workingContext: '',
      focusAreas: []
    }),
    getSelectedRisks: () => [],
    getRiskCandidates: () => [],
    getScenarioGeographies: () => [],
    getBUList: () => [],
    composeGuidedNarrative: (guidedInput = {}, { lensLabel = '' } = {}) => `${lensLabel || 'Scenario'} preview: ${String(guidedInput.event || '').trim()}`.trim(),
    escapeHtml: (value) => String(value || ''),
    getDisclosureStateKey: () => '',
    getDisclosureOpenState: () => false,
    UI: {},
    saveDraft: () => {},
    markDraftDirty: () => {},
    persistAndRenderStep1: () => {},
    normaliseAssessmentTokens: (text = '') => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    normaliseScenarioSeedText: (text = '') => String(text || '').trim().toLowerCase(),
    guessRisksFromText: (text = '', options = {}) => {
      lastGuessRisksArgs = { text, options };
      return [{ title: 'Generated risk' }];
    },
    isNoiseRiskText: () => false,
    replaceSuggestedRiskCandidates: () => {},
    appendRiskCandidates: () => {},
    syncStep1ScenarioTitle: () => {}
  };

  vm.createContext(context);
  vm.runInContext(projectionDataSource, context, { filename: 'scenarioTaxonomyProjectionData.js' });
  vm.runInContext(projectionSource, context, { filename: 'scenarioTaxonomyProjection.js' });
  vm.runInContext(source, context, { filename: 'step1.js' });
  return {
    appState: context.AppState,
    setStep1ButtonBusy: context._setStep1ButtonBusy,
    inferStep1FunctionKeyFromText: context.inferStep1FunctionKeyFromText,
    buildStep1ExplicitNarrativeLens: context.buildStep1ExplicitNarrativeLens,
    getStep1PreferredScenarioLens: context.getStep1PreferredScenarioLens,
    getStep1ManualPreferredScenarioLens: context.getStep1ManualPreferredScenarioLens,
    shouldUseStep1LivePreview: context.shouldUseStep1LivePreview,
    shouldUseStep1LivePromptIdeas: context.shouldUseStep1LivePromptIdeas,
    getStep1GuidedPreviewSignature: context.getStep1GuidedPreviewSignature,
    rememberStep1LivePreview: context.rememberStep1LivePreview,
    getStep1DisplayedGuidedPreviewModel: context.getStep1DisplayedGuidedPreviewModel,
    buildStep1GuidedPromptIdeaModel: context.buildStep1GuidedPromptIdeaModel,
    buildStep1GuidedPromptSuggestions: context.buildStep1GuidedPromptSuggestions,
    renderStep1GuidedPromptIdeaPanel: context.renderStep1GuidedPromptIdeaPanel,
    seedRisksFromScenarioDraft: context.seedRisksFromScenarioDraft,
    getLastGuessRisksArgs: () => lastGuessRisksArgs
  };
}

test('CEO mailbox hijack stays in the identity/cyber prompt lane', () => {
  const internals = loadStep1Internals();
  const functionKey = internals.inferStep1FunctionKeyFromText('CEO email account hijacked');
  assert.equal(functionKey, 'technology');

  const suggestions = internals.buildStep1GuidedPromptSuggestions({
    guidedInput: {
      event: 'CEO email account hijacked',
      asset: '',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Contract cover gap', event: 'A contract gap emerges.', functionKey: 'procurement' },
      { promptLabel: 'Single-source shortfall', event: 'A single source fails.', functionKey: 'procurement' },
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' }
    ]
  });

  const labels = suggestions.map(item => item.label);
  assert.ok(labels.includes('Identity Platform Compromise'));
  assert.ok(labels.includes('Privileged Account Takeover'));
  assert.equal(labels.includes('Contract cover gap'), false);
  assert.equal(labels.includes('Single-source shortfall'), false);
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('dark-web Azure admin credential discovery does not leak AI-model prompt ideas', () => {
  const internals = loadStep1Internals();
  const suggestions = internals.buildStep1GuidedPromptSuggestions({
    guidedInput: {
      event: 'An Azure admin account credential were found on the darkweb',
      asset: '',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' }
    ]
  });

  const labels = suggestions.map(item => item.label);
  assert.ok(labels.includes('Identity Platform Compromise'));
  assert.ok(labels.includes('Privileged Account Takeover'));
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('dark-web Azure global admin credential misuse stays in the technology/cyber lane', () => {
  const internals = loadStep1Internals();
  const event = 'Azure global admin credentials discovered on the dark web are actively used to log into the tenant, escalate privileges, and modify critical configurations across G42\'s environment.';
  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'technology');

  const lens = internals.getStep1PreferredScenarioLens({}, {
    guidedInput: {
      event,
      asset: '',
      cause: '',
      impact: ''
    },
    scenarioLens: null
  }, event);

  assert.equal(lens.key, 'cyber');
  assert.equal(lens.functionKey, 'technology');
});

test('guided prompt ideas and lens ignore stale prior outage narratives', () => {
  const internals = loadStep1Internals();
  const event = 'Azure global admin credentials found on darkweb';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: '',
      cause: '',
      impact: '',
      urgency: 'high'
    },
    narrative: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
    sourceNarrative: 'Unscheduled IT system downtime due to aging infrastructure may cause critical operational disruption.',
    enhancedNarrative: 'High-urgency Financial scenario: A payment-control failure creates direct monetary loss.'
  };

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Operational outage from aging infrastructure', event: 'Aging infrastructure causes a critical service outage.', functionKey: 'operations' },
      { promptLabel: 'Human-error service disruption', event: 'Human error causes downtime in a critical service.', functionKey: 'operations' }
    ]
  });

  const labels = suggestions.map(item => item.label);
  assert.ok(labels.includes('Identity Platform Compromise'));
  assert.ok(labels.includes('Privileged Account Takeover'));
  assert.equal(labels.includes('Operational outage from aging infrastructure'), false);
  assert.equal(labels.includes('Human-error service disruption'), false);

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'cyber');
  assert.equal(lens.functionKey, 'technology');
});

test('no-DR Outlook continuity scenario stays in continuity prompt ideas and keeps guided helper traffic local-only', () => {
  const internals = loadStep1Internals();
  const event = 'There is no DR for the critical email system in place, which is MS Outlook online.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'MS Outlook online',
      cause: 'No disaster recovery or failover capability',
      impact: 'Extended outage and recovery pressure',
      urgency: 'high'
    }
  };

  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'operations');

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.functionKey, 'operations');
  assert.equal(lens.key, 'business-continuity');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' },
      { promptLabel: 'Cloud exposure', event: 'A cloud control weakness exposes a service.', functionKey: 'technology' },
      { promptLabel: 'Release failure', event: 'A release failure breaks a service.', functionKey: 'operations' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('DR Gap'));
  assert.equal(labels.includes('Responsible AI drift'), false);
  assert.equal(labels.includes('Cloud exposure'), false);
  assert.equal(internals.shouldUseStep1LivePreview(draft), false);
  assert.equal(internals.shouldUseStep1LivePromptIdeas(draft), false);
});

test('counterparty default scenario stays in finance suggestions and avoids payment-fraud prompt drift', () => {
  const internals = loadStep1Internals();
  const event = 'A major client files for bankruptcy, creating receivables recovery pressure and a likely write-off.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Major customer receivables balance',
      cause: 'Customer insolvency',
      impact: 'Bad-debt write-off and cashflow strain'
    }
  };

  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'finance');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Payment control failure', event: 'A payment-control issue causes avoidable financial loss.', functionKey: 'finance' },
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Counterparty Default'));
  assert.equal(labels.includes('Payment control failure'), false);
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('ransomware extortion wording stays in cyber prompt ideas instead of collapsing into payment control failure', () => {
  const internals = loadStep1Internals();
  const event = 'Hackers encrypt company servers, halting operations and demanding a payment to unlock files.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Company servers and shared files',
      cause: '',
      impact: 'Operational halt and recovery pressure'
    }
  };

  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'technology');

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'cyber');
  assert.equal(lens.functionKey, 'technology');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Payment control failure', event: 'A payment-control issue causes avoidable financial loss.', functionKey: 'finance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Ransomware Outage'));
  assert.equal(labels.includes('Payment control failure'), false);
});

test('novel ransomware paraphrase still stays in cyber prompt ideas instead of drifting into finance wording', () => {
  const internals = loadStep1Internals();
  const event = 'Systems locked and attackers ask for money before core operations can resume.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Core systems',
      cause: '',
      impact: 'Operations cannot resume'
    }
  };

  const model = internals.buildStep1GuidedPromptIdeaModel(draft, {
    recommendedExamples: [
      { promptLabel: 'Payment control failure', event: 'A payment-control issue causes avoidable financial loss.', functionKey: 'finance' }
    ]
  });

  assert.equal(model.state, 'high_confidence_family');
  assert.ok(model.promptSuggestions.some((item) => item.label === 'Ransomware Outage'));
  assert.equal(model.promptSuggestions.some((item) => item.label === 'Payment control failure'), false);

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.ok(html.includes('Likely local direction: Cyber'));
  assert.ok(html.includes('Ransomware Outage'));
});

test('high-confidence ransomware wording exposes a clear Step 1 prompt state with clickable chips', () => {
  const internals = loadStep1Internals();
  const event = 'Hackers encrypt company servers, halting operations and demanding a payment to unlock files.';
  const model = internals.buildStep1GuidedPromptIdeaModel({
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Company servers and shared files',
      cause: '',
      impact: 'Operational halt and recovery pressure'
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Payment control failure', event: 'A payment-control issue causes avoidable financial loss.', functionKey: 'finance' }
    ]
  });

  assert.equal(model.state, 'high_confidence_family');
  assert.ok(model.promptSuggestions.some((item) => item.label === 'Ransomware Outage'));

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.ok(html.includes('Likely local direction: Cyber'));
  assert.ok(html.includes('guided-prompt-chip'));
});

test('supplier labour scenario stays in ESG prompt ideas instead of drifting into sourcing-only examples', () => {
  const internals = loadStep1Internals();
  const event = 'A supplier is linked to forced labour practices in a critical sourcing category.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Critical supplier relationship',
      cause: 'Weak sub-tier due diligence',
      impact: 'Human-rights scrutiny and remediation pressure'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'esg');
  assert.equal(lens.functionKey, 'strategic');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Single-source shortfall', event: 'A single source fails.', functionKey: 'procurement' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Forced Labour / Modern Slavery'));
  assert.equal(labels.includes('Single-source shortfall'), false);
});

test('sustainability-linked KPI evidence gaps stay in ESG prompt ideas instead of drifting into finance', () => {
  const internals = loadStep1Internals();
  const event = 'A sustainability-linked loan KPI cannot be evidenced and the claimed margin step-down is under assurance challenge.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Published sustainability KPI and financing-linked metrics',
      cause: 'Weak substantiation and assurance evidence',
      impact: 'Disclosure credibility and stakeholder challenge'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'esg');
  assert.equal(lens.functionKey, 'strategic');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Payment control failure', event: 'A payment-control issue causes avoidable financial loss.', functionKey: 'finance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Greenwashing / Disclosure Gap'));
  assert.equal(labels.includes('Payment control failure'), false);
});

test('labour-broker grievance wording stays in ESG prompt ideas instead of generic supplier governance', () => {
  const internals = loadStep1Internals();
  const event = 'Worker grievances reveal recruitment fees and passport retention in a labour-broker layer.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Sub-tier workforce and labour-broker arrangements',
      cause: 'Weak human-rights due diligence and delayed remediation',
      impact: 'Human-rights scrutiny and remediation pressure'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'esg');
  assert.equal(lens.functionKey, 'strategic');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Supplier control weakness', event: 'Weak supplier governance creates inherited risk.', functionKey: 'procurement' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Forced Labour / Modern Slavery'));
  assert.equal(labels.includes('Supplier control weakness'), false);
});

test('whistleblower retaliation wording stays in compliance prompt ideas instead of cyber insider wording', () => {
  const internals = loadStep1Internals();
  const event = 'A whistleblower reports misconduct and then faces retaliation while the investigation protocol is not followed.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Speak-up and investigation process',
      cause: 'Retaliation and process non-compliance',
      impact: 'Control breakdown and scrutiny'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'compliance');
  assert.equal(lens.functionKey, 'compliance');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Malicious insider misuse', event: 'An employee misuses privileged access.', functionKey: 'technology' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Policy Breach'));
  assert.equal(labels.includes('Malicious insider misuse'), false);
});

test('privacy-governance wording stays in privacy governance prompt ideas instead of generic cyber or policy examples', () => {
  const internals = loadStep1Internals();
  const event = 'A data protection impact assessment is not completed for large-scale biometric processing, data subject rights requests are delayed, and the DPO is not consulted.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Biometric and sensitive personal data processing',
      cause: 'DPIA and privacy-governance controls are incomplete',
      impact: 'Regulatory scrutiny and control breakdown'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'compliance');
  assert.equal(lens.functionKey, 'compliance');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Malicious insider misuse', event: 'An employee misuses privileged access.', functionKey: 'technology' },
      { promptLabel: 'Policy breach', event: 'A general policy requirement is not followed.', functionKey: 'compliance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Privacy Governance Weakness'));
  assert.equal(labels.includes('Malicious insider misuse'), false);
  assert.equal(labels.includes('Policy breach'), false);
});

test('UAE health-data privacy wording stays in privacy governance prompt ideas instead of drifting into generic healthcare cyber wording', () => {
  const internals = loadStep1Internals();
  const event = 'Patient-data processing proceeds without the required high-risk assessment, medical-records access logging is weak, and local safeguards for sensitive data are incomplete.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Patient and medical records',
      cause: 'Sensitive-data privacy safeguards are incomplete',
      impact: 'Regulatory scrutiny and control breakdown'
    }
  };

  const model = internals.buildStep1GuidedPromptIdeaModel(draft, {
    recommendedExamples: [
      { promptLabel: 'Cloud exposure', event: 'A cloud control weakness exposes a service.', functionKey: 'technology' }
    ]
  });

  assert.equal(model.state, 'high_confidence_family');
  assert.ok(model.promptSuggestions.some((item) => item.label === 'Privacy Governance Weakness'));
  assert.equal(model.promptSuggestions.some((item) => item.label === 'Cloud exposure'), false);
});

test('public-official hospitality wording stays in bribery prompt ideas instead of generic compliance', () => {
  const internals = loadStep1Internals();
  const event = 'Sponsored travel and hospitality for a public official proceed without the required anti-bribery approvals.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Commercial relationship and approval path',
      cause: 'Improper hospitality and approval bypass',
      impact: 'Legal and integrity exposure'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'fraud-integrity');
  assert.equal(lens.functionKey, 'finance');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Policy breach', event: 'A general policy requirement is not followed.', functionKey: 'compliance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Bribery Exposure'));
  assert.equal(labels.includes('Policy breach'), false);
});

test('restricted-jurisdiction trade-control wording stays in sanctions prompt ideas instead of generic policy breach', () => {
  const internals = loadStep1Internals();
  const event = 'Remote technical access from a restricted jurisdiction was enabled for export-controlled systems before screening clearance was completed.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Export-controlled systems and remote access path',
      cause: 'Trade-control screening and clearance gap',
      impact: 'Regulatory and legal exposure'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'regulatory');
  assert.equal(lens.functionKey, 'compliance');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Policy breach', event: 'A general policy requirement is not followed.', functionKey: 'compliance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Sanctions Screening Failure'));
  assert.equal(labels.includes('Policy breach'), false);
});

test('risk appetite and KRI escalation wording stays in general enterprise-risk prompt ideas instead of generic compliance', () => {
  const internals = loadStep1Internals();
  const event = 'KRIs move above tolerance and escalation to the risk committee does not happen while residual risk remains outside appetite.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'KRI dashboard and residual-risk profile',
      cause: 'Escalation and reporting discipline are weak',
      impact: 'Material risk remains outside tolerance'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'general');
  assert.equal(lens.functionKey, 'general');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Policy breach', event: 'A general policy requirement is not followed.', functionKey: 'compliance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Risk Appetite Breach') || labels.includes('Risk Governance Gap'));
  assert.equal(labels.includes('Policy breach'), false);
});

test('project risk register and treatment-plan wording stays in a clear enterprise-risk prompt state', () => {
  const internals = loadStep1Internals();
  const event = 'The project risk register is stale, treatment plans are overdue, and emerging risks are not being aggregated into reporting.';
  const model = internals.buildStep1GuidedPromptIdeaModel({
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Project risk register and treatment planning',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Programme delivery delay', event: 'A delivery dependency delays go-live.', functionKey: 'strategic' }
    ]
  });

  assert.equal(model.state, 'high_confidence_family');
  assert.ok(model.promptSuggestions.some((item) => item.label === 'Risk Governance Gap' || item.label === 'Risk Appetite Breach' || item.label === 'KRI Monitoring Failure'));
  assert.equal(model.promptSuggestions.some((item) => item.label === 'Programme delivery delay'), false);

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.ok(html.includes('Likely local direction: General enterprise risk'));
});

test('BIA and call-tree wording stays in the business continuity prompt lane', () => {
  const internals = loadStep1Internals();
  const event = 'The business impact analysis is stale, RTOs are not defined, and the incident escalation call tree has not been exercised.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Critical service recovery arrangements',
      cause: 'Continuity governance and testing are stale',
      impact: 'Recovery decisions may be delayed during disruption'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'business-continuity');
  assert.equal(lens.functionKey, 'operations');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Operational service delay', event: 'A workflow issue delays service delivery.', functionKey: 'operations' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Continuity Planning Gap'));
  assert.equal(labels.includes('Operational service delay'), false);
});

test('permit-to-work and overdue-drill wording stays in the HSE prompt lane before any incident occurs', () => {
  const internals = loadStep1Internals();
  const event = 'Permit-to-work controls are bypassed, emergency drills are overdue, and contractor safety corrective actions remain open.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Site operations and contractor work',
      cause: 'Weak permit discipline and emergency preparedness',
      impact: 'Unsafe operations could continue without effective barriers'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'hse');
  assert.equal(lens.functionKey, 'hse');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Policy breach', event: 'A general policy requirement is not followed.', functionKey: 'compliance' }
    ]
  });
  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Safety Control Weakness'));
  assert.equal(labels.includes('Policy breach'), false);
});

test('ambiguous privacy-versus-disclosure wording stays soft instead of forcing a hard disclosure prompt', () => {
  const internals = loadStep1Internals();
  const event = 'Customer records were kept too long in breach of privacy obligations, with possible external visibility.';
  const model = internals.buildStep1GuidedPromptIdeaModel({
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Customer records',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'External data breach', event: 'Stolen data is leaked externally.', functionKey: 'technology' }
    ]
  });

  assert.equal(model.state, 'candidate_families');
  assert.equal(model.promptSuggestions.length, 0);
  assert.ok(model.candidateDirections.length >= 1);

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.ok(html.includes('Possible directions'));
  assert.equal(html.includes('guided-prompt-chip'), false);
  assert.equal(html.includes('Data Disclosure'), false);
});

test('supplier-versus-programme mixed wording stays in candidate mode when separation is weak', () => {
  const internals = loadStep1Internals();
  const event = 'A supplier delay is starting to push a major transformation milestone off track.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Transformation milestone',
      cause: '',
      impact: ''
    }
  };

  const model = internals.buildStep1GuidedPromptIdeaModel(draft, {
    recommendedExamples: [
      { promptLabel: 'Single-source shortfall', event: 'A critical supplier fails without substitute cover.', functionKey: 'procurement' }
    ]
  });
  assert.equal(model.state, 'candidate_families');
  assert.equal(model.promptSuggestions.length, 0);

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'general');
  assert.ok(Array.from(lens.secondaryKeys || []).includes('supply-chain'));

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.ok(html.includes('Mixed scenario') || html.includes('Possible directions'));
  assert.equal(html.includes('guided-prompt-chip'), false);
});

test('weak generic wording stays low-confidence unknown and asks for one more detail', () => {
  const internals = loadStep1Internals();
  const event = 'There could be disruption and customer impact.';
  const model = internals.buildStep1GuidedPromptIdeaModel({
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: '',
      cause: '',
      impact: ''
    }
  });

  assert.equal(model.state, 'low_confidence_unknown');
  assert.equal(model.promptSuggestions.length, 0);
  assert.ok(model.refinementHints.includes('Add what is affected'));

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.ok(html.includes('Need one more detail'));
  assert.equal(html.includes('guided-prompt-chip'), false);
});

test('guided lens ignores stale financial preview wording when the event is identity-led', () => {
  const internals = loadStep1Internals();
  const draft = {
    step1Path: 'guided',
    scenarioLens: { key: 'financial', label: 'Financial', functionKey: 'finance' },
    guidedInput: {
      event: 'Azure global admin credentials discovered on darkweb',
      asset: '',
      cause: '',
      impact: '',
      urgency: 'high'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, 'High-urgency Financial scenario: Azure global admin credentials discovered on darkweb. The area most exposed is the financial process, transaction flow, or commercial exposure in scope.');
  assert.equal(lens.key, 'cyber');
  assert.equal(lens.functionKey, 'technology');
  assert.deepEqual(Array.from(lens.secondaryKeys || []), ['financial']);
});

test('manual typed draft follows fresh identity text over stale financial lens state', () => {
  const internals = loadStep1Internals();
  const draft = {
    scenarioLens: { key: 'financial', label: 'Financial', functionKey: 'finance' },
    narrative: 'A payment-control failure creates direct monetary loss.'
  };
  const currentNarrative = 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.';

  const lens = internals.getStep1ManualPreferredScenarioLens({}, draft, currentNarrative);

  assert.equal(lens.key, 'cyber');
  assert.equal(lens.functionKey, 'technology');
  assert.deepEqual(Array.from(lens.secondaryKeys || []), ['financial']);
});

test('manual typed payment-control failure stays financial even if stale state was cyber', () => {
  const internals = loadStep1Internals();
  const draft = {
    scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
    narrative: 'An administrator credential is exposed.'
  };
  const currentNarrative = 'A payment-control failure allows an unauthorised invoice to be approved and creates direct monetary loss.';

  const lens = internals.getStep1ManualPreferredScenarioLens({}, draft, currentNarrative);

  assert.equal(lens.key, 'financial');
  assert.equal(lens.functionKey, 'finance');
  assert.deepEqual(Array.from(lens.secondaryKeys || []), ['cyber']);
});

test('shortlist generation from typed narrative uses the current narrative lens instead of stale stored state', () => {
  const internals = loadStep1Internals();
  internals.appState.draft.scenarioLens = { key: 'financial', label: 'Financial', functionKey: 'finance' };

  const seededCount = internals.seedRisksFromScenarioDraft('Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.', {
    force: true,
    replaceGenerated: true
  });

  assert.equal(seededCount, 1);
  assert.equal(internals.getLastGuessRisksArgs()?.options?.lensHint?.key, 'cyber');
  assert.equal(internals.getLastGuessRisksArgs()?.options?.lensHint?.functionKey, 'technology');
});

test('supplier delivery slippage for infrastructure deployment stays out of procurement prompt ideas', () => {
  const internals = loadStep1Internals();
  const event = 'A key server supplier misses a committed delivery date, delaying planned infrastructure deployment and dependent business projects.';
  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'operations');

  const suggestions = internals.buildStep1GuidedPromptSuggestions({
    guidedInput: {
      event,
      asset: '',
      cause: '',
      impact: ''
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Single-source shortfall', event: 'A critical supplier fails without substitute cover.', functionKey: 'procurement' },
      { promptLabel: 'Contract cover gap', event: 'A contract gap emerges.', functionKey: 'procurement' }
    ]
  });

  const labels = suggestions.map(item => item.label);
  assert.ok(labels.includes('Delivery Slippage'));
  assert.equal(labels.includes('Single-source shortfall'), false);
  assert.equal(labels.includes('Contract cover gap'), false);
});

test('availability-attack prompt hints stay in the cyber availability lane', () => {
  const internals = loadStep1Internals();
  const event = 'DDoS traffic overwhelms the public website and degrades customer-facing services.';
  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'technology');

  const suggestions = internals.buildStep1GuidedPromptSuggestions({
    guidedInput: {
      event,
      asset: 'Public website',
      cause: 'Volumetric hostile traffic',
      impact: 'Customer-facing service degradation'
    }
  }, {
    recommendedExamples: [
      { promptLabel: 'Compliance assurance gap', event: 'A policy assurance gap emerges.', functionKey: 'compliance' },
      { promptLabel: 'Responsible AI drift', event: 'An AI assistant drifts.', functionKey: 'technology' }
    ]
  });

  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Availability Attack'));
  assert.equal(labels.includes('Compliance assurance gap'), false);
  assert.equal(labels.includes('Responsible AI drift'), false);
});

test('privacy-obligation prompt hints stay in the compliance lane without implying breach', () => {
  const internals = loadStep1Internals();
  const event = 'Customer records are retained and processed in breach of privacy obligations and lawful basis requirements.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Customer records',
      cause: 'Weak retention and lawful-basis controls',
      impact: 'Supervisory scrutiny and remediation pressure'
    }
  };

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'compliance');
  assert.equal(lens.functionKey, 'compliance');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'External data breach', event: 'Stolen data is leaked externally.', functionKey: 'technology' }
    ]
  });

  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Privacy Non Compliance'));
  assert.equal(labels.includes('External data breach'), false);
});

test('workforce fatigue wording stays in the people-workforce lane instead of drifting into generic operational prompt ideas', () => {
  const internals = loadStep1Internals();
  const event = 'Sustained understaffing and fatigue increase the likelihood of unsafe delivery.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Frontline operations',
      cause: 'Coverage gaps and fatigue buildup',
      impact: 'Unsafe delivery and control failure'
    }
  };

  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'hse');

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'people-workforce');
  assert.equal(lens.functionKey, 'hse');

  const suggestions = internals.buildStep1GuidedPromptSuggestions(draft, {
    recommendedExamples: [
      { promptLabel: 'Operational outage from aging infrastructure', event: 'Aging infrastructure causes a critical service outage.', functionKey: 'operations' }
    ]
  });

  const labels = suggestions.map((item) => item.label);
  assert.ok(labels.includes('Workforce Fatigue / Staffing Weakness'));
  assert.equal(labels.includes('Operational outage from aging infrastructure'), false);
});

test('genuinely mixed wording stays ambiguity-aware instead of forcing a hard preferred lens', () => {
  const internals = loadStep1Internals();
  const event = 'Privacy obligations are breached because customer records are retained too long, while a supplier delay also slows dependent projects.';
  const draft = {
    step1Path: 'guided',
    guidedInput: {
      event,
      asset: 'Customer records and dependent delivery milestones',
      cause: 'Retention weakness and supplier delay',
      impact: 'Customer complaints and remediation pressure'
    }
  };

  assert.equal(internals.inferStep1FunctionKeyFromText(event), 'general');

  const lens = internals.getStep1PreferredScenarioLens({}, draft, event);
  assert.equal(lens.key, 'general');
  assert.ok(Array.from(lens.secondaryKeys || []).includes('supply-chain'));
  assert.ok(Array.from(lens.secondaryKeys || []).includes('compliance'));

  const model = internals.buildStep1GuidedPromptIdeaModel(draft, {
    recommendedExamples: [
      { promptLabel: 'Payment control failure', event: 'A payment-control issue causes avoidable financial loss.', functionKey: 'finance' }
    ]
  });
  assert.equal(model.state, 'candidate_families');
  assert.equal(model.promptSuggestions.length, 0);
  assert.ok(model.candidateDirections.some((item) => item.label === 'Supply chain'));
  assert.ok(model.candidateDirections.some((item) => item.label === 'Compliance'));

  const html = internals.renderStep1GuidedPromptIdeaPanel(model);
  assert.equal(html.includes('guided-prompt-chip'), false);
  assert.equal(html.includes('Payment control failure'), false);
});

test('displayed guided preview prefers the live AI-checked preview for the current signature', () => {
  const internals = loadStep1Internals();
  const draft = {
    step1Path: 'guided',
    buId: 'g42',
    scenarioLens: { key: 'cyber', label: 'Cyber', functionKey: 'technology' },
    guidedInput: {
      event: 'CEO email account hijacked',
      asset: '',
      cause: '',
      impact: '',
      urgency: 'high'
    },
    guidedDraftPreview: '',
    guidedDraftSource: '',
    guidedDraftStatus: ''
  };
  const signature = internals.getStep1GuidedPreviewSignature(draft);
  internals.rememberStep1LivePreview(
    signature,
    'AI-checked preview: A senior executive mailbox is compromised and used to manipulate approvals.',
    'AI-checked preview using the current function context, geography, regulations, and retrieved references.',
    'ai'
  );

  const preview = internals.getStep1DisplayedGuidedPreviewModel(draft);
  assert.equal(preview.preview, 'AI-checked preview: A senior executive mailbox is compromised and used to manipulate approvals.');
  assert.equal(preview.source, 'ai');
});

test('step 1 busy helper marks AI buttons as active work instead of plain disabled state', () => {
  const internals = loadStep1Internals();
  const classes = new Set();
  const button = {
    textContent: 'Build scenario draft',
    disabled: false,
    dataset: {},
    attributes: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    }
  };

  const restore = internals.setStep1ButtonBusy(button, 'Building…');
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'Building…');
  assert.equal(button.dataset.idleLabel, 'Build scenario draft');
  assert.equal(button.attributes['aria-busy'], 'true');
  assert.equal(classes.has('btn--step1-ai-busy'), true);

  restore();
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Build scenario draft');
  assert.equal(button.attributes['aria-busy'], undefined);
  assert.equal(classes.has('btn--step1-ai-busy'), false);
});
