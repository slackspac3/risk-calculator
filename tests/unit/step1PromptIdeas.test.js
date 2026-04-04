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
    buildStep1GuidedPromptSuggestions: context.buildStep1GuidedPromptSuggestions,
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
