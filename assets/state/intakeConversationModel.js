(function attachIntakeConversationModel(globalScope) {
  'use strict';

  const UNKNOWN_PATTERNS = [
    /\bunknown\b/i,
    /\bnot known\b/i,
    /\bdon'?t know\b/i,
    /\bdo not know\b/i,
    /\bnot sure\b/i,
    /\bunsure\b/i,
    /\bnot available\b/i,
    /\bunavailable\b/i,
    /\bpending\b/i,
    /\btbc\b/i,
    /\btbd\b/i,
    /\bto be confirmed\b/i,
    /\bnot provided\b/i,
    /\bno evidence yet\b/i,
    /\bno idea\b/i,
    /\bneed to confirm\b/i
  ];

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanText(value = '') {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function summarise(value = '', fallback = '', limit = 118) {
    const text = cleanText(value);
    if (!text) return cleanText(fallback);
    const maxLength = Math.max(12, Number(limit) || 118);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trim()}...`;
  }

  function isUnknownAnswer(value = '') {
    const text = cleanText(value);
    if (!text) return false;
    return UNKNOWN_PATTERNS.some((pattern) => pattern.test(text));
  }

  function coerceArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function extractItemText(item) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      return cleanText(item);
    }
    if (!isPlainObject(item)) return '';
    return cleanText(
      item.label
      || item.title
      || item.claim
      || item.field
      || item.text
      || item.summary
      || item.description
      || item.name
      || ''
    );
  }

  function uniqueTextItems(items = [], limit = 6) {
    const seen = new Set();
    const output = [];
    coerceArray(items).forEach((item) => {
      const text = summarise(extractItemText(item), '', 110);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      output.push(text);
    });
    return output.slice(0, Math.max(0, Number(limit) || 6));
  }

  function answerStatus(value = '', label = 'Input') {
    const text = cleanText(value);
    const explicitUnknown = isUnknownAnswer(text);
    return {
      label,
      value: text,
      summary: summarise(text, explicitUnknown ? `${label} marked unknown` : ''),
      hasAnswer: !!text,
      explicitUnknown,
      state: text ? (explicitUnknown ? 'unknown' : 'captured') : 'missing'
    };
  }

  function getDraftSourceKey(draft = {}) {
    const rawSource = cleanText(draft && (draft.guidedDraftSource || draft.aiQualityState)).toLowerCase();
    if (rawSource === 'live') return 'ai';
    if (rawSource === 'deterministic_fallback' || rawSource === 'stub') return 'fallback';
    if (rawSource === 'manual_only') return 'manual';
    if (rawSource === 'local') return 'local';
    if (!rawSource && draft?.llmAssisted && cleanText(draft.enhancedNarrative || draft.narrative || draft.guidedDraftPreview)) return 'ai';
    if (!rawSource && cleanText(draft?.guidedDraftPreview)) return 'fallback';
    return rawSource;
  }

  function hasStagedGuidedDraft(draft = {}) {
    const source = getDraftSourceKey(draft);
    if (!source || source === 'local') return false;
    if (cleanText(draft?.guidedDraftSource)) return true;
    return !!cleanText(draft?.guidedDraftPreview || draft?.aiNarrativeBaseline || draft?.enhancedNarrative);
  }

  function countEvidenceItems(draft = {}) {
    const evidenceMap = isPlainObject(draft.evidenceMap) ? draft.evidenceMap : {};
    const citationQuality = isPlainObject(evidenceMap.citationQuality) ? evidenceMap.citationQuality : {};
    return [
      ...coerceArray(draft.citations),
      ...coerceArray(draft.primaryGrounding),
      ...coerceArray(draft.supportingReferences),
      ...coerceArray(draft.inputProvenance),
      ...coerceArray(evidenceMap.supportedClaims),
      ...coerceArray(citationQuality.strong),
      ...coerceArray(citationQuality.medium)
    ].filter((item) => extractItemText(item)).length;
  }

  function collectProjectExposureGaps(projectExposure = {}) {
    if (!isPlainObject(projectExposure)) return [];
    const missing = uniqueTextItems(projectExposure.missingInputs, 5);
    coerceArray(projectExposure.financialDrivers).forEach((driver) => {
      uniqueTextItems(driver?.missingInputs || [], 3).forEach((item) => missing.push(item));
    });
    const quality = isPlainObject(projectExposure.projectInputQuality) ? projectExposure.projectInputQuality : {};
    uniqueTextItems(quality.unknownHighImpactInputs || [], 4).forEach((item) => missing.push(item));
    return uniqueTextItems(missing, 6);
  }

  function buildEvidenceStatus(draft = {}) {
    const evidenceMap = isPlainObject(draft.evidenceMap) ? draft.evidenceMap : {};
    const citationQuality = isPlainObject(evidenceMap.citationQuality) ? evidenceMap.citationQuality : {};
    const openItems = uniqueTextItems([
      ...coerceArray(evidenceMap.unsupportedClaims),
      ...coerceArray(evidenceMap.contradictions),
      ...coerceArray(citationQuality.weak),
      ...coerceArray(citationQuality.decorative)
    ], 4);
    const evidenceCount = countEvidenceItems(draft);
    if (openItems.length) {
      return {
        state: 'warning',
        tone: 'warning',
        label: 'Evidence gaps visible',
        detail: openItems[0],
        count: openItems.length,
        openItems
      };
    }
    if (evidenceCount > 0) {
      return {
        state: 'supported',
        tone: 'live',
        label: 'Evidence attached',
        detail: `${evidenceCount} supporting reference${evidenceCount === 1 ? '' : 's'} available for later review.`,
        count: evidenceCount,
        openItems: []
      };
    }
    return {
      state: 'none',
      tone: 'neutral',
      label: 'No evidence attached yet',
      detail: 'Evidence can be added later; unsupported claims will stay visible as gaps.',
      count: 0,
      openItems: []
    };
  }

  function buildKnownUnknowns(draft = {}, statuses = {}, evidenceStatus = null) {
    const gaps = [];
    Object.keys(statuses || {}).forEach((key) => {
      const status = statuses[key];
      if (status?.explicitUnknown) gaps.push(`${status.label} is marked unknown`);
    });
    uniqueTextItems(draft.missingInformation, 5).forEach((item) => gaps.push(item));
    collectProjectExposureGaps(draft.projectExposure).forEach((item) => gaps.push(item));
    if (evidenceStatus?.openItems?.length) {
      evidenceStatus.openItems.forEach((item) => gaps.push(item));
    }
    return uniqueTextItems(gaps, 6);
  }

  function buildContextStrength({ hasBusinessContext, statuses, evidenceStatus, hasStagedDraft }) {
    let score = 0;
    if (hasBusinessContext) score += 25;
    if (statuses.event?.hasAnswer) score += statuses.event.explicitUnknown ? 10 : 25;
    if (statuses.impact?.hasAnswer) score += statuses.impact.explicitUnknown ? 10 : 25;
    if (hasStagedDraft) score += 15;
    if (evidenceStatus?.state === 'supported') score += 10;
    if (evidenceStatus?.state === 'warning') score -= 5;
    const safeScore = Math.max(0, Math.min(100, score));
    if (!hasBusinessContext) {
      return {
        score: safeScore,
        tone: 'warning',
        label: 'Business context needed',
        detail: 'Select the business unit before building the AI draft.'
      };
    }
    if (statuses.event?.hasAnswer && statuses.impact?.hasAnswer) {
      return {
        score: safeScore,
        tone: hasStagedDraft ? 'live' : 'neutral',
        label: hasStagedDraft ? 'Draft context ready' : 'Ready for AI build',
        detail: hasStagedDraft
          ? 'A first draft is staged for review.'
          : statuses.event.explicitUnknown || statuses.impact.explicitUnknown
            ? 'Known gaps are captured and will be carried into the draft.'
            : 'The required situation and impact are captured.'
      };
    }
    if (safeScore >= 70) {
      return {
        score: safeScore,
        tone: 'live',
        label: hasStagedDraft ? 'Draft context ready' : 'Ready for AI build',
        detail: hasStagedDraft ? 'A first draft is staged for review.' : 'The required situation and impact are captured.'
      };
    }
    if (statuses.event?.hasAnswer || statuses.impact?.hasAnswer) {
      return {
        score: safeScore,
        tone: 'neutral',
        label: 'Partial context captured',
        detail: 'One more required input will make the first draft more useful.'
      };
    }
    return {
      score: safeScore,
      tone: 'neutral',
      label: 'Waiting for situation',
      detail: 'Start with the event or change the assessment should focus on.'
    };
  }

  function buildActiveQuestion({ hasBusinessContext, statuses, hasStagedDraft }) {
    if (!hasBusinessContext) {
      return {
        field: 'businessContext',
        label: 'Business context',
        question: 'Which business context should this assessment use?',
        state: 'blocked'
      };
    }
    if (!statuses.event?.hasAnswer) {
      return {
        field: 'event',
        label: 'Event',
        question: 'What event, failure, change, or decision should the assessment focus on?',
        state: 'needed'
      };
    }
    if (!statuses.impact?.hasAnswer) {
      return {
        field: 'impact',
        label: 'Impact',
        question: 'What business effect matters most if this happens?',
        state: 'needed'
      };
    }
    if (!hasStagedDraft) {
      return {
        field: 'draft',
        label: 'Draft',
        question: 'Build the first AI draft from the captured context.',
        state: 'ready'
      };
    }
    return {
      field: 'review',
      label: 'Review',
      question: 'Review the staged draft, then continue when it still fits.',
      state: 'ready'
    };
  }

  function buildNextBestAction({ activeQuestion, knownUnknowns }) {
    const field = cleanText(activeQuestion?.field);
    if (field === 'businessContext') {
      return {
        title: 'Choose business context',
        copy: 'Select the business unit so the AI can apply the right appetite, geography, and regulations.',
        kicker: 'Context required'
      };
    }
    if (field === 'event') {
      return {
        title: '1. Describe the event',
        copy: 'Add one concrete event, trigger, change, or failure signal.',
        kicker: 'Event first'
      };
    }
    if (field === 'impact') {
      return {
        title: '2. Name the main impact',
        copy: 'Add the business, customer, regulatory, operational, or financial effect you care about.',
        kicker: 'Impact needed'
      };
    }
    if (field === 'draft') {
      const gapCopy = knownUnknowns?.length
        ? 'Known gaps will be carried forward as unknowns, not silently treated as zero or complete.'
        : 'Your signal is ready. Build now, then review the draft and lens fit below.';
      return {
        title: '3. Build the first draft',
        copy: gapCopy,
        kicker: 'Ready to build'
      };
    }
    return {
      title: '4. Review the draft and continue',
      copy: 'Tighten the wording if needed, then continue into scenario review with a defensible draft.',
      kicker: 'Draft ready'
    };
  }

  function buildIntakeConversationModel({ draft = {}, riskCandidates = [] } = {}) {
    const guidedInput = isPlainObject(draft.guidedInput) ? draft.guidedInput : {};
    const statuses = {
      event: answerStatus(guidedInput.event, 'Event'),
      impact: answerStatus(guidedInput.impact, 'Impact'),
      asset: answerStatus(guidedInput.asset, 'Affected system'),
      cause: answerStatus(guidedInput.cause, 'Likely cause')
    };
    const hasBusinessContext = !!cleanText(draft.buId);
    const hasStagedDraft = hasStagedGuidedDraft(draft);
    const evidenceStatus = buildEvidenceStatus(draft);
    const knownUnknowns = buildKnownUnknowns(draft, statuses, evidenceStatus);
    const activeQuestion = buildActiveQuestion({ hasBusinessContext, statuses, hasStagedDraft });
    const nextBestAction = buildNextBestAction({ activeQuestion, knownUnknowns });
    const contextStrength = buildContextStrength({ hasBusinessContext, statuses, evidenceStatus, hasStagedDraft });
    const explicitUnknownFields = Object.keys(statuses).filter((key) => statuses[key]?.explicitUnknown);

    return {
      hasBusinessContext,
      hasEventSignal: statuses.event.hasAnswer,
      hasImpactSignal: statuses.impact.hasAnswer,
      hasStagedDraft,
      readyToBuild: hasBusinessContext && statuses.event.hasAnswer && statuses.impact.hasAnswer && !hasStagedDraft,
      facts: statuses,
      explicitUnknownFields,
      knownUnknowns,
      activeQuestion,
      nextBestAction,
      evidenceStatus,
      contextStrength,
      riskCandidateCount: Array.isArray(riskCandidates) ? riskCandidates.length : 0,
      repeatQuestionBlocked: explicitUnknownFields.includes(cleanText(activeQuestion?.field))
    };
  }

  const api = {
    cleanText,
    summarise,
    isUnknownAnswer,
    answerStatus,
    buildEvidenceStatus,
    buildKnownUnknowns,
    buildIntakeConversationModel
  };

  globalScope.IntakeConversationModel = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
