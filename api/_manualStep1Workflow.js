'use strict';

const { getCompassProviderConfig } = require('./_aiRuntime');
const { buildTraceEntry, callAi, parseOrRepairStructuredJson, sanitizeAiText } = require('./_aiOrchestrator');
const { buildDeterministicFallbackResult, buildFallbackFromError, buildManualModeResult, buildWorkflowTimeoutProfile } = require('./_aiWorkflowSupport');
const { buildFeedbackLearningPromptBlock, resolveHierarchicalFeedbackProfile, rerankRiskCardsWithFeedback } = require('./_learningAuthority');
const { normaliseGuidedScenarioDraftInput, workflowUtils } = require('./_scenarioDraftWorkflow');

const MANUAL_NARRATIVE_TIMEOUTS = buildWorkflowTimeoutProfile({
  liveMs: 22000,
  repairMs: 10000
});

const MANUAL_SHORTLIST_TIMEOUTS = buildWorkflowTimeoutProfile({
  liveMs: 18000,
  repairMs: 9000
});

const MANUAL_NARRATIVE_SCHEMA = `{
  "draftNarrative": "string",
  "summary": "string",
  "linkAnalysis": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "scenarioLens": {
    "key": "string",
    "label": "string",
    "functionKey": "string",
    "estimatePresetKey": "string",
    "secondaryKeys": ["string"]
  },
  "structuredScenario": {
    "assetService": "string",
    "primaryDriver": "string",
    "eventPath": "string",
    "effect": "string"
  },
  "risks": [
    {
      "title": "string",
      "category": "string",
      "description": "string",
      "confidence": "high|medium|low",
      "regulations": ["string"]
    }
  ]
}`;

const MANUAL_SHORTLIST_SCHEMA = `{
  "summary": "string",
  "linkAnalysis": "string",
  "workflowGuidance": ["string"],
  "benchmarkBasis": "string",
  "risks": [
    {
      "title": "string",
      "category": "string",
      "description": "string",
      "confidence": "high|medium|low",
      "regulations": ["string"]
    }
  ]
}`;

const MANUAL_STEP1_PERSONALITIES = {
  refinement: {
    key: 'refinement',
    traceLabelDefault: 'Step 1 narrative refinement',
    allowRegisterFallbackSeed: true,
    allowRegisterSynthesis: false,
    strictPrimaryFamily: true,
    allowSecondaryFamilies: true,
    manualPromptSummary: 'Server manual mode used for Step 1 narrative refinement because the draft text was too weak.',
    manualResponse: 'Manual refinement stayed in manual mode because the current draft was too short or ambiguous.',
    manualSummary: 'The current draft is too limited for the server to refine it safely.',
    manualLinkAnalysis: 'Add the event, affected asset or service, and main impact before asking the server to refine the narrative.',
    manualGuidance: [
      'Write one plain sentence describing the event path.',
      'Name the asset, service, or process affected.',
      'Add the main impact before asking the server to refine the draft.'
    ],
    manualReason: {
      code: 'incomplete_manual_draft',
      title: 'Manual refinement only',
      message: 'Add a clearer event path, affected asset or service, or main impact before asking the server to refine the draft.'
    },
    workflowGuidance: [
      'Keep the draft in the same event path the user described.',
      'Remove adjacent-domain wording that only reflects downstream consequences.',
      'Keep only the risks that share the same event tree and management briefing focus.'
    ],
    benchmarkBasis: 'This Step 1 refinement should stay close to the user-authored draft and only tighten structure, clarity, and event-path coherence.',
    systemPrompt: `You are a senior enterprise risk analyst refining a user-authored Step 1 scenario draft.

Return JSON only with this schema:
${MANUAL_NARRATIVE_SCHEMA}

Rules:
- refine, tighten, and clarify the user's draft
- preserve the user's event path, asset, cause, and ownership
- stay close to the user's wording unless it is repetitive or unclear
- do not synthesize a different scenario family from downstream consequences
- do not let financial loss, regulatory scrutiny, reputational damage, or service impact pull the draft into the wrong primary family
- do not invent AI/model-risk framing
- keep the risk shortlist tightly aligned to the same event path`,
    buildUserPrompt({
      seedNarrative,
      registerText,
      classification,
      input,
      evidenceMeta,
      feedbackPromptBlock
    }) {
      return `Current user-authored narrative:
${seedNarrative || '(none)'}

Refinement objective:
Tighten the wording, improve structure, and preserve the same event path.

Accepted taxonomy anchor:
${JSON.stringify(buildClassificationAnchor(classification), null, 2)}

Register notes for background only:
${registerText || '(none)'}

Business unit and scoped context:
${JSON.stringify({
        name: input.businessUnit?.name || '',
        contextSummary: input.businessUnit?.contextSummary || input.businessUnit?.notes || '',
        selectedDepartmentContext: input.businessUnit?.selectedDepartmentContext || '',
        aiGuidance: input.businessUnit?.aiGuidance || ''
      }, null, 2)}

Live scoped context:
${workflowUtils.buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null)}

Evidence quality context:
${evidenceMeta.promptBlock}

Retrieved references:
${buildManualCitationBlock(input.citations || [])}

${feedbackPromptBlock}`;
    }
  },
  intakeAssist: {
    key: 'intakeAssist',
    traceLabelDefault: 'Step 1 intake assist',
    allowRegisterFallbackSeed: true,
    allowRegisterSynthesis: true,
    strictPrimaryFamily: false,
    allowSecondaryFamilies: true,
    manualPromptSummary: 'Server manual mode used for Step 1 intake assist because the current notes were too weak.',
    manualResponse: 'Manual intake assist stayed in manual mode because the current notes were too limited.',
    manualSummary: 'The current intake notes are too limited for the server to produce a reliable assisted draft.',
    manualLinkAnalysis: 'Add a clearer event, affected asset or service, or main impact before asking the server to shape the intake draft.',
    manualGuidance: [
      'Describe the event or issue in plain language.',
      'Add the asset, service, process, or dependency affected.',
      'Add the main impact or why it matters before rerunning intake assist.'
    ],
    manualReason: {
      code: 'incomplete_intake_input',
      title: 'Manual intake only',
      message: 'Add a clearer event, asset or service, or main impact before asking the server to shape the intake draft.'
    },
    workflowGuidance: [
      'Keep the strongest event path primary when turning notes into a scenario draft.',
      'Do not generalise the draft into an adjacent domain unless the notes explicitly support it.',
      'Keep only the risks that belong in the same event chain as the resulting draft.'
    ],
    benchmarkBasis: 'This Step 1 intake assist should convert raw notes into a clearer scenario draft without changing the underlying event path or scenario ownership.',
    systemPrompt: `You are a senior enterprise risk analyst helping turn raw Step 1 notes into a usable scenario draft.

Return JSON only with this schema:
${MANUAL_NARRATIVE_SCHEMA}

Rules:
- preserve the strongest explicit event path from the user's notes
- if the notes are already clear, improve them lightly rather than rewriting them heavily
- if register context is provided, use it only to sharpen the same scenario, not to invent a new one
- do not drift domain from consequences alone
- do not invent AI/model-risk framing
- keep the shortlist aligned to the same event path`,
    buildUserPrompt({
      seedNarrative,
      registerText,
      classification,
      input,
      evidenceMeta,
      feedbackPromptBlock
    }) {
      return `Current intake draft seed:
${seedNarrative || '(none)'}

Register notes:
${registerText || '(none)'}

Accepted taxonomy anchor:
${JSON.stringify(buildClassificationAnchor(classification), null, 2)}

Business unit and scoped context:
${JSON.stringify({
        name: input.businessUnit?.name || '',
        contextSummary: input.businessUnit?.contextSummary || input.businessUnit?.notes || '',
        selectedDepartmentContext: input.businessUnit?.selectedDepartmentContext || '',
        aiGuidance: input.businessUnit?.aiGuidance || ''
      }, null, 2)}

Live scoped context:
${workflowUtils.buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null)}

Evidence quality context:
${evidenceMeta.promptBlock}

Retrieved references:
${buildManualCitationBlock(input.citations || [])}

${feedbackPromptBlock}`;
    }
  },
  shortlist: {
    key: 'shortlist',
    traceLabelDefault: 'Step 1 manual shortlist',
    allowRegisterFallbackSeed: false,
    allowRegisterSynthesis: false,
    strictPrimaryFamily: true,
    allowSecondaryFamilies: true,
    manualPromptSummary: 'Server manual mode used for Step 1 shortlist generation because the accepted draft was too weak.',
    manualResponse: 'Manual shortlist generation stayed in manual mode because the current draft was too weak to classify reliably.',
    manualSummary: 'The current draft is too weak or ambiguous for the server to build a reliable shortlist.',
    manualLinkAnalysis: 'Tighten the accepted draft so it clearly states the event path, affected asset or service, and main impact before generating a shortlist.',
    manualGuidance: [
      'Keep the accepted draft to one clear event path.',
      'State the affected asset, service, dependency, or process explicitly.',
      'Add the main impact so the shortlist can stay aligned.'
    ],
    manualReason: {
      code: 'insufficient_shortlist_seed',
      title: 'Manual shortlist only',
      message: 'Tighten the accepted draft before asking the server to build a shortlist.'
    },
    workflowGuidance: [
      'Keep only risks that share the same event path as the accepted draft.',
      'Do not let consequence-only wording become the main shortlist lane.',
      'Remove adjacent-domain cards unless the narrative explicitly supports them.'
    ],
    benchmarkBasis: 'This Step 1 shortlist should remain tightly coupled to the accepted narrative and taxonomy classification, rather than inventing a new scenario.',
    systemPrompt: `You are a senior enterprise risk analyst building a Step 1 shortlist from an accepted scenario draft.

Return JSON only with this schema:
${MANUAL_SHORTLIST_SCHEMA}

Rules:
- build an event-path-aligned shortlist from the accepted draft
- do not rewrite the scenario or invent a new one
- do not change the primary family unless the draft is impossible to classify
- consequence overlays do not justify switching domains by themselves
- keep only risks aligned to the accepted primary family, allowed secondaries, or explicitly supported overlays
- do not invent AI/model-risk framing`,
    buildUserPrompt({
      seedNarrative,
      classification,
      input,
      evidenceMeta,
      feedbackPromptBlock
    }) {
      return `Accepted scenario draft:
${seedNarrative || '(none)'}

Accepted taxonomy anchor:
${JSON.stringify(buildClassificationAnchor(classification), null, 2)}

Structured scenario:
${JSON.stringify(workflowUtils.buildStructuredScenario({
        ...input,
        riskStatement: seedNarrative
      }, classification), null, 2)}

Business unit and scoped context:
${JSON.stringify({
        name: input.businessUnit?.name || '',
        contextSummary: input.businessUnit?.contextSummary || input.businessUnit?.notes || '',
        selectedDepartmentContext: input.businessUnit?.selectedDepartmentContext || '',
        aiGuidance: input.businessUnit?.aiGuidance || ''
      }, null, 2)}

Live scoped context:
${workflowUtils.buildContextPromptBlock(input.adminSettings || {}, input.businessUnit || null)}

Evidence quality context:
${evidenceMeta.promptBlock}

Retrieved references:
${buildManualCitationBlock(input.citations || [])}

${feedbackPromptBlock}`;
    }
  }
};

function normaliseRegisterFallbackText(value = '') {
  const text = workflowUtils.normaliseBlockInputText(value || '');
  if (!text) return '';
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
  return workflowUtils.normaliseBlockInputText(lines.join('\n')).slice(0, 4000).trim();
}

function normaliseRegisterMetaInput(value = {}) {
  if (!workflowUtils.isPlainObject(value)) return undefined;
  return workflowUtils.compactInputValue({
    fileName: workflowUtils.normaliseInlineInputText(value.fileName || ''),
    fileType: workflowUtils.normaliseInlineInputText(value.fileType || ''),
    uploadedAt: workflowUtils.normaliseInlineInputText(value.uploadedAt || ''),
    sheetCount: Number.isFinite(Number(value.sheetCount)) ? Number(value.sheetCount) : undefined
  });
}

function normaliseManualStep1Input(input = {}) {
  const manualRiskStatement = workflowUtils.normaliseBlockInputText(input.riskStatement || '');
  const registerText = normaliseRegisterFallbackText(input.registerText || '');
  const scenarioLensHint = input.scenarioLensHint && typeof input.scenarioLensHint === 'object'
    ? (
        workflowUtils.normaliseInlineInputText(input.scenarioLensHint.key || '')
        || workflowUtils.normaliseInlineInputText(input.scenarioLensHint.label || '')
        || workflowUtils.normaliseInlineInputText(input.scenarioLensHint.functionKey || '')
      )
    : input.scenarioLensHint;
  const base = normaliseGuidedScenarioDraftInput({
    session: input.session,
    riskStatement: manualRiskStatement || registerText,
    scenarioLensHint,
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    citations: input.citations,
    adminSettings: input.adminSettings,
    traceLabel: input.traceLabel,
    priorMessages: input.priorMessages,
    guidedInput: input.guidedInput
  });
  return workflowUtils.compactInputValue({
    ...base,
    manualRiskStatement,
    registerText,
    registerMeta: normaliseRegisterMetaInput(input.registerMeta)
  }) || { session: input.session };
}

function buildClassificationAnchor(classification = {}) {
  return {
    domain: String(classification?.domain || '').trim(),
    primaryFamily: String(classification?.primaryFamily?.key || '').trim(),
    secondaryFamilies: Array.isArray(classification?.secondaryFamilies)
      ? classification.secondaryFamilies.map((family) => family?.key).filter(Boolean)
      : [],
    overlays: Array.isArray(classification?.overlays)
      ? classification.overlays.map((overlay) => overlay?.key).filter(Boolean)
      : [],
    mechanisms: Array.isArray(classification?.mechanisms)
      ? classification.mechanisms.map((mechanism) => mechanism?.key).filter(Boolean)
      : [],
    confidence: Number(classification?.confidence || 0),
    reasonCodes: Array.isArray(classification?.reasonCodes) ? classification.reasonCodes.slice(0, 8) : [],
    ambiguityFlags: Array.isArray(classification?.ambiguityFlags) ? classification.ambiguityFlags.slice(0, 6) : []
  };
}

function buildManualCitationBlock(citations = []) {
  const items = Array.isArray(citations) ? citations : [];
  if (!items.length) return '(none)';
  return items
    .slice(0, 6)
    .map((item, index) => {
      const title = sanitizeAiText(item?.title || item?.sourceTitle || `Reference ${index + 1}`, { maxChars: 160 });
      const excerpt = workflowUtils.normaliseBlockInputText(item?.excerpt || item?.description || item?.text || item?.note || '').slice(0, 260);
      const reason = workflowUtils.normaliseBlockInputText(item?.relevanceReason || '').slice(0, 160);
      return [`- ${title}`, excerpt ? `  Excerpt: ${excerpt}` : '', reason ? `  Relevance: ${reason}` : '']
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}

function buildManualSeedNarrative(input = {}, { allowRegisterFallback = true } = {}) {
  const source = input.manualRiskStatement || (allowRegisterFallback ? input.registerText : '') || input.riskStatement || '';
  return workflowUtils.cleanUserFacingText(workflowUtils.cleanScenarioSeed(source), { maxSentences: 6 });
}

function hasMeaningfulManualNarrative(text = '') {
  const value = String(text || '').trim();
  const tokens = (value.match(/[a-z0-9]{2,}/gi) || []).length;
  return !!value && ((value.length >= 10 && tokens >= 2) || tokens >= 3);
}

function buildManualContext(input = {}, personality = MANUAL_STEP1_PERSONALITIES.refinement) {
  const seedNarrative = buildManualSeedNarrative(input, {
    allowRegisterFallback: personality.allowRegisterFallbackSeed
  });
  const classification = workflowUtils.classifyScenario(seedNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: input.scenarioLensHint
  });
  const evidenceMeta = workflowUtils.buildEvidenceMeta({
    citations: input.citations || [],
    businessUnit: input.businessUnit,
    geography: input.geography,
    applicableRegulations: input.applicableRegulations,
    organisationContext: input.adminSettings?.companyStructureContext,
    adminSettings: input.adminSettings,
    userProfile: input.adminSettings?.userProfileSummary
  });
  const structuredScenario = workflowUtils.buildStructuredScenario({
    ...input,
    riskStatement: seedNarrative
  }, classification);
  return {
    seedNarrative,
    classification,
    evidenceMeta,
    structuredScenario
  };
}

function buildManualNarrativeAnchors(seedNarrative = '', registerText = '') {
  const stopWords = new Set([
    'about', 'after', 'along', 'because', 'could', 'create', 'critical', 'current', 'described',
    'event', 'from', 'have', 'into', 'issue', 'likely', 'main', 'material', 'might', 'notes',
    'risk', 'scenario', 'scope', 'should', 'than', 'that', 'their', 'there', 'these', 'this',
    'under', 'what', 'which', 'with', 'would'
  ]);
  const text = `${seedNarrative || ''} ${registerText || ''}`.toLowerCase();
  return Array.from(new Set(text.match(/[a-z0-9]+/g) || []))
    .filter((token) => token.length > 4 && !stopWords.has(token))
    .slice(0, 18);
}

function countManualAnchorOverlap(text = '', anchors = []) {
  const haystack = String(text || '').toLowerCase();
  return (Array.isArray(anchors) ? anchors : []).filter((token) => token && haystack.includes(token)).length;
}

function isPrimaryFamilyCompatible(expected = {}, actual = {}, { allowSecondaryFamilies = false } = {}) {
  const expectedPrimary = String(expected?.primaryFamily?.key || '').trim();
  const actualPrimary = String(actual?.primaryFamily?.key || '').trim();
  if (!expectedPrimary || !actualPrimary) return true;
  if (expectedPrimary === actualPrimary) return true;
  if (!allowSecondaryFamilies) return false;
  return Array.isArray(expected?.secondaryFamilies)
    && expected.secondaryFamilies.some((family) => String(family?.key || '').trim() === actualPrimary);
}

function evaluateManualNarrativeCandidate(candidate = '', {
  seedNarrative = '',
  input = {},
  classification = {},
  allowRegisterSynthesis = false,
  strictPrimaryFamily = true,
  allowSecondaryFamilies = true
} = {}) {
  const cleanedCandidate = workflowUtils.cleanUserFacingText(candidate || '', { maxSentences: 6 });
  if (!cleanedCandidate) return { accepted: false, reason: 'empty', narrative: '' };
  const expectedLens = String(classification?.key || input?.scenarioLensHint || 'general').trim() || 'general';
  const candidateClassification = workflowUtils.classifyScenario(cleanedCandidate, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: expectedLens
  });
  if (!workflowUtils.isCompatibleScenarioLens(expectedLens, candidateClassification?.key || expectedLens)) {
    return { accepted: false, reason: 'lens-drift', narrative: cleanedCandidate };
  }
  if (strictPrimaryFamily && !isPrimaryFamilyCompatible(classification, candidateClassification, { allowSecondaryFamilies })) {
    return { accepted: false, reason: 'family-drift', narrative: cleanedCandidate };
  }
  const anchors = buildManualNarrativeAnchors(seedNarrative, allowRegisterSynthesis ? input.registerText : '');
  const overlap = countManualAnchorOverlap(cleanedCandidate, anchors);
  const minOverlap = anchors.length >= 6 ? 2 : (anchors.length ? 1 : 0);
  if (overlap < minOverlap) {
    return { accepted: false, reason: 'low-overlap', narrative: cleanedCandidate };
  }
  return {
    accepted: true,
    reason: 'accepted',
    narrative: cleanedCandidate,
    classification: candidateClassification
  };
}

function normaliseManualNarrativeCandidate(parsed = {}, fallback = {}, input = {}, classification = {}) {
  const fallbackLens = workflowUtils.buildScenarioLens(classification);
  const risks = workflowUtils.normaliseRiskCards(parsed?.risks, input.applicableRegulations || []);
  return {
    draftNarrative: workflowUtils.cleanUserFacingText(parsed?.draftNarrative || '', { maxSentences: 6 }),
    enhancedStatement: workflowUtils.cleanUserFacingText(parsed?.draftNarrative || '', { maxSentences: 6 }),
    summary: workflowUtils.cleanUserFacingText(parsed?.summary || fallback.summary || '', { maxSentences: 3 }),
    linkAnalysis: workflowUtils.cleanUserFacingText(parsed?.linkAnalysis || fallback.linkAnalysis || '', { maxSentences: 3 }),
    workflowGuidance: workflowUtils.normaliseGuidance(parsed?.workflowGuidance?.length ? parsed.workflowGuidance : fallback.workflowGuidance || []),
    benchmarkBasis: workflowUtils.cleanUserFacingText(parsed?.benchmarkBasis || fallback.benchmarkBasis || '', { maxSentences: 3 }),
    scenarioLens: workflowUtils.normaliseScenarioLens(parsed?.scenarioLens, fallbackLens),
    structuredScenario: {
      assetService: workflowUtils.cleanUserFacingText(parsed?.structuredScenario?.assetService || fallback.structuredScenario?.assetService || '', { maxSentences: 1, stripTrailingPeriod: true }),
      primaryDriver: workflowUtils.cleanUserFacingText(parsed?.structuredScenario?.primaryDriver || fallback.structuredScenario?.primaryDriver || '', { maxSentences: 1, stripTrailingPeriod: true }),
      eventPath: workflowUtils.cleanUserFacingText(parsed?.structuredScenario?.eventPath || fallback.structuredScenario?.eventPath || '', { maxSentences: 1, stripTrailingPeriod: true }),
      effect: workflowUtils.cleanUserFacingText(parsed?.structuredScenario?.effect || fallback.structuredScenario?.effect || '', { maxSentences: 2 })
    },
    risks
  };
}

function normaliseManualShortlistCandidate(parsed = {}, fallback = {}, input = {}) {
  return {
    summary: workflowUtils.cleanUserFacingText(parsed?.summary || fallback.summary || '', { maxSentences: 3 }),
    linkAnalysis: workflowUtils.cleanUserFacingText(parsed?.linkAnalysis || fallback.linkAnalysis || '', { maxSentences: 3 }),
    workflowGuidance: workflowUtils.normaliseGuidance(parsed?.workflowGuidance?.length ? parsed.workflowGuidance : fallback.workflowGuidance || []),
    benchmarkBasis: workflowUtils.cleanUserFacingText(parsed?.benchmarkBasis || fallback.benchmarkBasis || '', { maxSentences: 3 }),
    risks: workflowUtils.normaliseRiskCards(parsed?.risks, input.applicableRegulations || [])
  };
}

function buildManualFallbackNarrative(seedNarrative = '', fallbackScenarioExpansion = null, personality = MANUAL_STEP1_PERSONALITIES.refinement, input = {}) {
  const explicitDraft = workflowUtils.cleanUserFacingText(
    workflowUtils.cleanScenarioSeed(input.manualRiskStatement || ''),
    { maxSentences: 6 }
  );
  if (personality.key === 'shortlist') {
    return explicitDraft || seedNarrative || fallbackScenarioExpansion?.scenarioExpansion || '';
  }
  if (explicitDraft) return explicitDraft;
  if (!personality.allowRegisterSynthesis && seedNarrative) return seedNarrative;
  return fallbackScenarioExpansion?.scenarioExpansion || seedNarrative || '';
}

async function resolveManualFeedbackProfile(input = {}) {
  return resolveHierarchicalFeedbackProfile({
    username: input.session?.username || '',
    buId: input.businessUnit?.id || input.businessUnit?.buId || '',
    functionKey: input.businessUnit?.selectedDepartmentKey || input.businessUnit?.functionKey || '',
    scenarioLensKey: input.scenarioLensHint || ''
  });
}

function buildManualModeResponse(input = {}, {
  personality = MANUAL_STEP1_PERSONALITIES.refinement,
  traceLabel = personality.traceLabelDefault
} = {}) {
  const context = buildManualContext(input, personality);
  return buildManualModeResult({
    baseResult: {
      seedNarrative: context.seedNarrative,
      draftNarrative: context.seedNarrative,
      draftNarrativeSource: 'manual',
      draftNarrativeReason: 'input_incomplete',
      enhancedStatement: context.seedNarrative,
      summary: personality.manualSummary,
      linkAnalysis: personality.manualLinkAnalysis,
      workflowGuidance: personality.manualGuidance,
      benchmarkBasis: personality.benchmarkBasis,
      scenarioLens: workflowUtils.buildScenarioLens(context.classification),
      structuredScenario: context.structuredScenario,
      risks: [],
      regulations: Array.from(new Set((Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []).map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    manualReason: personality.manualReason,
    traceLabel,
    promptSummary: personality.manualPromptSummary,
    response: personality.manualResponse,
    sources: input.citations || [],
    evidenceMeta: context.evidenceMeta,
    withEvidenceMeta: workflowUtils.withEvidenceMeta
  });
}

function buildManualFallbackResult(input = {}, {
  personality = MANUAL_STEP1_PERSONALITIES.refinement,
  feedbackProfile = null,
  traceLabel = personality.traceLabelDefault,
  aiUnavailable = false
} = {}) {
  const context = buildManualContext(input, personality);
  const fallbackScenarioExpansion = workflowUtils.buildScenarioExpansion({
    ...input,
    riskStatement: context.seedNarrative
  }, context.classification);
  const finalNarrative = buildManualFallbackNarrative(context.seedNarrative, fallbackScenarioExpansion, personality, input);
  const finalClassification = workflowUtils.classifyScenario(finalNarrative, {
    guidedInput: input.guidedInput,
    businessUnit: input.businessUnit,
    scenarioLensHint: input.scenarioLensHint || context.classification?.key || ''
  });
  const coherentFallbackExpansion = workflowUtils.buildScenarioExpansion({
    ...input,
    riskStatement: finalNarrative
  }, finalClassification);
  const rerankedFallbackRisks = rerankRiskCardsWithFeedback(coherentFallbackExpansion.riskTitles, feedbackProfile);
  const shortlistCoherence = workflowUtils.enforceScenarioShortlistCoherence(rerankedFallbackRisks, {
    acceptedClassification: finalClassification,
    finalNarrative,
    seedNarrative: context.seedNarrative,
    input,
    fallbackRisks: rerankedFallbackRisks
  });
  const result = buildDeterministicFallbackResult({
    baseResult: {
      seedNarrative: context.seedNarrative,
      draftNarrative: finalNarrative,
      draftNarrativeSource: personality.key === 'shortlist' ? 'manual' : 'fallback',
      draftNarrativeReason: aiUnavailable ? 'proxy_unavailable' : 'quality_fallback',
      enhancedStatement: finalNarrative,
      summary: coherentFallbackExpansion.summary,
      linkAnalysis: workflowUtils.buildRiskContextLinkAnalysis({
        classification: finalClassification,
        riskTitles: shortlistCoherence.risks
      }),
      workflowGuidance: personality.workflowGuidance,
      benchmarkBasis: personality.benchmarkBasis,
      scenarioLens: workflowUtils.buildScenarioLens(finalClassification),
      structuredScenario: workflowUtils.buildStructuredScenario({
        ...input,
        riskStatement: finalNarrative
      }, finalClassification),
      risks: shortlistCoherence.risks,
      regulations: Array.from(new Set([
        ...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []),
        ...shortlistCoherence.risks.flatMap((risk) => risk.regulations || [])
      ].map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : []
    },
    aiUnavailable,
    traceLabel,
    promptSummary: `Server deterministic fallback used for ${traceLabel.toLowerCase()}.`,
    response: finalNarrative,
    sources: input.citations || [],
    evidenceMeta: context.evidenceMeta,
    withEvidenceMeta: workflowUtils.withEvidenceMeta
  });
  result.shortlistCoherence = shortlistCoherence;
  result.aiAlignment = workflowUtils.buildAiAlignment(input, result, {
    classification: finalClassification,
    seedNarrative: context.seedNarrative,
    fallbackScenarioExpansion: coherentFallbackExpansion,
    shortlistCoherence
  });
  return result;
}

async function buildManualNarrativeWorkflow(input = {}, {
  personality = MANUAL_STEP1_PERSONALITIES.refinement,
  traceLabelDefault = personality.traceLabelDefault
} = {}) {
  input = normaliseManualStep1Input(input);
  const traceLabel = sanitizeAiText(input.traceLabel || traceLabelDefault, { maxChars: 120 }) || traceLabelDefault;
  const context = buildManualContext(input, personality);
  if (!hasMeaningfulManualNarrative(context.seedNarrative)) {
    return buildManualModeResponse(input, { personality, traceLabel });
  }

  const feedbackProfile = await resolveManualFeedbackProfile(input);
  const config = getCompassProviderConfig();
  if (!config.proxyConfigured) {
    return buildManualFallbackResult(input, { personality, feedbackProfile, traceLabel, aiUnavailable: true });
  }

  const feedbackPromptBlock = buildFeedbackLearningPromptBlock(feedbackProfile);
  const fallbackSummary = workflowUtils.buildRiskContextSummary({
    classification: context.classification,
    asset: context.structuredScenario.assetService,
    impact: context.structuredScenario.effect,
    riskTitles: []
  });
  const fallbackLinkAnalysis = workflowUtils.buildRiskContextLinkAnalysis({
    classification: context.classification,
    riskTitles: []
  });
  const userPrompt = personality.buildUserPrompt({
    seedNarrative: context.seedNarrative,
    registerText: input.registerText || '',
    classification: context.classification,
    input,
    evidenceMeta: context.evidenceMeta,
    feedbackPromptBlock
  });

  try {
    const generation = await callAi(personality.systemPrompt, userPrompt, {
      taskName: personality.key === 'intakeAssist' ? 'manualIntakeAssist' : 'manualDraftRefinement',
      temperature: 0.2,
      maxCompletionTokens: 2000,
      maxPromptChars: 18000,
      timeoutMs: MANUAL_NARRATIVE_TIMEOUTS.liveMs,
      priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, MANUAL_NARRATIVE_SCHEMA, {
      taskName: personality.key === 'intakeAssist' ? 'repairManualIntakeAssist' : 'repairManualDraftRefinement',
      timeoutMs: MANUAL_NARRATIVE_TIMEOUTS.repairMs
    });
    const candidate = normaliseManualNarrativeCandidate(parsed?.parsed || {}, {
      summary: fallbackSummary,
      linkAnalysis: fallbackLinkAnalysis,
      workflowGuidance: personality.workflowGuidance,
      benchmarkBasis: personality.benchmarkBasis,
      structuredScenario: context.structuredScenario
    }, input, context.classification);
    const evaluatedCandidate = evaluateManualNarrativeCandidate(candidate.draftNarrative || candidate.enhancedStatement || '', {
      seedNarrative: context.seedNarrative,
      input,
      classification: context.classification,
      allowRegisterSynthesis: personality.allowRegisterSynthesis,
      strictPrimaryFamily: personality.strictPrimaryFamily,
      allowSecondaryFamilies: personality.allowSecondaryFamilies
    });
    const useFallbackNarrative = !evaluatedCandidate.accepted;
    const finalNarrative = useFallbackNarrative
      ? buildManualFallbackNarrative(context.seedNarrative, null, personality, input)
      : (evaluatedCandidate.narrative || candidate.draftNarrative || candidate.enhancedStatement || context.seedNarrative);
    const finalClassification = workflowUtils.classifyScenario(finalNarrative, {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: input.scenarioLensHint || context.classification?.key || ''
    });
    const fallbackExpansion = workflowUtils.buildScenarioExpansion({
      ...input,
      riskStatement: finalNarrative
    }, finalClassification);
    const rerankedCandidateRisks = rerankRiskCardsWithFeedback(candidate.risks, feedbackProfile);
    const rerankedFallbackRisks = rerankRiskCardsWithFeedback(fallbackExpansion.riskTitles, feedbackProfile);
    const shortlistCoherence = workflowUtils.enforceScenarioShortlistCoherence(rerankedCandidateRisks, {
      acceptedClassification: finalClassification,
      finalNarrative,
      seedNarrative: context.seedNarrative,
      input,
      fallbackRisks: rerankedFallbackRisks
    });
    const finalRisks = shortlistCoherence.risks;
    const finalSummary = useFallbackNarrative
      ? (fallbackExpansion.summary || candidate.summary || fallbackSummary)
      : (candidate.summary || fallbackExpansion.summary || fallbackSummary);
    const finalLinkAnalysis = (useFallbackNarrative || shortlistCoherence.mode !== 'accepted')
      ? workflowUtils.buildRiskContextLinkAnalysis({ classification: finalClassification, riskTitles: finalRisks })
      : (candidate.linkAnalysis || workflowUtils.buildRiskContextLinkAnalysis({ classification: finalClassification, riskTitles: finalRisks }));
    const finalScenarioLens = useFallbackNarrative
      ? workflowUtils.buildScenarioLens(finalClassification)
      : workflowUtils.normaliseScenarioLens(candidate.scenarioLens, workflowUtils.buildScenarioLens(finalClassification));
    const result = workflowUtils.withEvidenceMeta({
      mode: useFallbackNarrative ? 'deterministic_fallback' : 'live',
      seedNarrative: context.seedNarrative,
      draftNarrative: finalNarrative,
      draftNarrativeSource: useFallbackNarrative ? 'fallback' : 'ai',
      draftNarrativeReason: useFallbackNarrative ? (evaluatedCandidate.reason || 'quality_fallback') : 'accepted',
      enhancedStatement: finalNarrative,
      summary: finalSummary,
      linkAnalysis: finalLinkAnalysis,
      workflowGuidance: candidate.workflowGuidance?.length ? candidate.workflowGuidance : personality.workflowGuidance,
      benchmarkBasis: candidate.benchmarkBasis || personality.benchmarkBasis,
      scenarioLens: finalScenarioLens,
      structuredScenario: {
        ...context.structuredScenario,
        ...(candidate.structuredScenario || {})
      },
      risks: finalRisks,
      regulations: Array.from(new Set([
        ...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []),
        ...finalRisks.flatMap((risk) => risk.regulations || [])
      ].map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : [],
      usedFallback: useFallbackNarrative,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: finalNarrative,
        sources: input.citations || []
      })
    }, context.evidenceMeta);
    result.shortlistCoherence = shortlistCoherence;
    result.aiAlignment = workflowUtils.buildAiAlignment(input, result, {
      classification: finalClassification,
      seedNarrative: context.seedNarrative,
      fallbackScenarioExpansion: fallbackExpansion,
      shortlistCoherence
    });
    return result;
  } catch (error) {
    return buildFallbackFromError({
      error,
      buildFallbackResult: ({ normalisedError }) => {
        console.warn(`${personality.key} server fallback:`, normalisedError.message);
        return buildManualFallbackResult(input, {
          personality,
          feedbackProfile,
          traceLabel,
          aiUnavailable: true
        });
      }
    });
  }
}

async function buildManualShortlistWorkflow(input = {}, {
  traceLabelDefault = MANUAL_STEP1_PERSONALITIES.shortlist.traceLabelDefault
} = {}) {
  input = normaliseManualStep1Input(input);
  const personality = MANUAL_STEP1_PERSONALITIES.shortlist;
  const traceLabel = sanitizeAiText(input.traceLabel || traceLabelDefault, { maxChars: 120 }) || traceLabelDefault;
  const context = buildManualContext(input, personality);
  if (!hasMeaningfulManualNarrative(context.seedNarrative)) {
    return buildManualModeResponse(input, { personality, traceLabel });
  }

  const feedbackProfile = await resolveManualFeedbackProfile(input);
  const config = getCompassProviderConfig();
  if (!config.proxyConfigured) {
    return buildManualFallbackResult(input, { personality, feedbackProfile, traceLabel, aiUnavailable: true });
  }

  const feedbackPromptBlock = buildFeedbackLearningPromptBlock(feedbackProfile);
  const userPrompt = personality.buildUserPrompt({
    seedNarrative: context.seedNarrative,
    classification: context.classification,
    input,
    evidenceMeta: context.evidenceMeta,
    feedbackPromptBlock
  });

  try {
    const generation = await callAi(personality.systemPrompt, userPrompt, {
      taskName: 'manualShortlist',
      temperature: 0.15,
      maxCompletionTokens: 1600,
      maxPromptChars: 16000,
      timeoutMs: MANUAL_SHORTLIST_TIMEOUTS.liveMs,
      priorMessages: Array.isArray(input?.priorMessages) ? input.priorMessages : []
    });
    const parsed = await parseOrRepairStructuredJson(generation.text, MANUAL_SHORTLIST_SCHEMA, {
      taskName: 'repairManualShortlist',
      timeoutMs: MANUAL_SHORTLIST_TIMEOUTS.repairMs
    });
    const candidate = normaliseManualShortlistCandidate(parsed?.parsed || {}, {
      summary: workflowUtils.buildRiskContextSummary({
        classification: context.classification,
        asset: context.structuredScenario.assetService,
        impact: context.structuredScenario.effect,
        riskTitles: []
      }),
      linkAnalysis: workflowUtils.buildRiskContextLinkAnalysis({
        classification: context.classification,
        riskTitles: []
      }),
      workflowGuidance: personality.workflowGuidance,
      benchmarkBasis: personality.benchmarkBasis
    }, input);
    const finalClassification = workflowUtils.classifyScenario(context.seedNarrative, {
      guidedInput: input.guidedInput,
      businessUnit: input.businessUnit,
      scenarioLensHint: input.scenarioLensHint || context.classification?.key || ''
    });
    const fallbackExpansion = workflowUtils.buildScenarioExpansion({
      ...input,
      riskStatement: context.seedNarrative
    }, finalClassification);
    const rerankedCandidateRisks = rerankRiskCardsWithFeedback(candidate.risks, feedbackProfile);
    const rerankedFallbackRisks = rerankRiskCardsWithFeedback(fallbackExpansion.riskTitles, feedbackProfile);
    const shortlistCoherence = workflowUtils.enforceScenarioShortlistCoherence(rerankedCandidateRisks, {
      acceptedClassification: finalClassification,
      finalNarrative: context.seedNarrative,
      seedNarrative: context.seedNarrative,
      input,
      fallbackRisks: rerankedFallbackRisks
    });
    const finalRisks = shortlistCoherence.risks;
    const result = workflowUtils.withEvidenceMeta({
      mode: 'live',
      seedNarrative: context.seedNarrative,
      draftNarrative: context.seedNarrative,
      draftNarrativeSource: 'manual',
      draftNarrativeReason: 'accepted_manual_seed',
      enhancedStatement: context.seedNarrative,
      summary: candidate.summary || fallbackExpansion.summary,
      linkAnalysis: shortlistCoherence.mode === 'accepted'
        ? (candidate.linkAnalysis || workflowUtils.buildRiskContextLinkAnalysis({ classification: finalClassification, riskTitles: finalRisks }))
        : workflowUtils.buildRiskContextLinkAnalysis({ classification: finalClassification, riskTitles: finalRisks }),
      workflowGuidance: candidate.workflowGuidance?.length ? candidate.workflowGuidance : personality.workflowGuidance,
      benchmarkBasis: candidate.benchmarkBasis || personality.benchmarkBasis,
      scenarioLens: workflowUtils.buildScenarioLens(finalClassification),
      structuredScenario: workflowUtils.buildStructuredScenario({
        ...input,
        riskStatement: context.seedNarrative
      }, finalClassification),
      risks: finalRisks,
      regulations: Array.from(new Set([
        ...(Array.isArray(input.applicableRegulations) ? input.applicableRegulations : []),
        ...finalRisks.flatMap((risk) => risk.regulations || [])
      ].map(String).filter(Boolean))),
      citations: Array.isArray(input.citations) ? input.citations : [],
      usedFallback: false,
      aiUnavailable: false,
      trace: buildTraceEntry({
        label: traceLabel,
        promptSummary: generation.promptSummary,
        response: candidate.summary || context.seedNarrative,
        sources: input.citations || []
      })
    }, context.evidenceMeta);
    result.shortlistCoherence = shortlistCoherence;
    result.aiAlignment = workflowUtils.buildAiAlignment(input, result, {
      classification: finalClassification,
      seedNarrative: context.seedNarrative,
      fallbackScenarioExpansion: fallbackExpansion,
      shortlistCoherence
    });
    return result;
  } catch (error) {
    return buildFallbackFromError({
      error,
      buildFallbackResult: ({ normalisedError }) => {
        console.warn('manual shortlist server fallback:', normalisedError.message);
        return buildManualFallbackResult(input, {
          personality,
          feedbackProfile,
          traceLabel,
          aiUnavailable: true
        });
      }
    });
  }
}

async function buildManualDraftRefinementWorkflow(input = {}, { traceLabelDefault = MANUAL_STEP1_PERSONALITIES.refinement.traceLabelDefault } = {}) {
  return buildManualNarrativeWorkflow(input, {
    personality: MANUAL_STEP1_PERSONALITIES.refinement,
    traceLabelDefault
  });
}

async function buildManualIntakeAssistWorkflow(input = {}, { traceLabelDefault = MANUAL_STEP1_PERSONALITIES.intakeAssist.traceLabelDefault } = {}) {
  return buildManualNarrativeWorkflow(input, {
    personality: MANUAL_STEP1_PERSONALITIES.intakeAssist,
    traceLabelDefault
  });
}

module.exports = {
  buildManualDraftRefinementWorkflow,
  buildManualIntakeAssistWorkflow,
  buildManualShortlistWorkflow,
  normaliseManualStep1Input
};
