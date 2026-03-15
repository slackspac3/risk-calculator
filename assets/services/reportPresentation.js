const ReportPresentation = (() => {
  function clampNumber(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function cleanExecutiveNarrativeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\.\./g, '.')
      .replace(/\bIn [^,]+(?:, [^,]+)*, [^,]+ faces a material [^.]+ scenario in which\s*/gi, '')
      .replace(/\bThe main asset, service, or team affected is\s*/gi, 'The scenario centres on ')
      .replace(/\bThe likely trigger or threat driver is\s*/gi, 'It is most likely triggered by ')
      .replace(/\bThe expected business, operational, or regulatory impact is\s*/gi, 'The main consequence is ')
      .replace(/\bGiven the stated urgency, this should be treated as\s*/gi, 'This should be treated as ')
      .replace(/\bA likely progression is\s*/gi, 'The most likely path is ')
      .trim();
  }

  function buildExecutiveScenarioSummary(assessment) {
    const structured = assessment.structuredScenario || {};
    const entity = assessment.buName || 'the organisation';
    const geographies = assessment.geography || 'the selected geographies';
    const asset = structured.assetService || assessment.guidedInput?.asset || '';
    const attack = structured.attackType || assessment.guidedInput?.cause || '';
    const effect = structured.effect || assessment.guidedInput?.impact || '';
    const rawNarrative = cleanExecutiveNarrativeText(assessment.enhancedNarrative || assessment.narrative || assessment.scenarioText || '');

    const openingParts = [];
    if (entity) openingParts.push(entity);
    openingParts.push('is assessing an identity and access scenario');
    if (asset) openingParts.push(`centred on ${asset}`);
    let opening = openingParts.join(' ');
    if (!opening.endsWith('.')) opening += '.';

    const sentencePool = [];
    if (attack) sentencePool.push(`The most likely trigger is ${String(attack).toLowerCase()}.`);
    if (effect) sentencePool.push(`The main business consequence is ${String(effect).replace(/\.$/, '').toLowerCase()}.`);
    if (rawNarrative) {
      const cleanedSentences = rawNarrative
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.trim())
        .filter(Boolean)
        .filter(sentence => !/^the main consequence is /i.test(sentence))
        .filter(sentence => !/^it is most likely triggered by /i.test(sentence))
        .filter(sentence => !/^the scenario centres on /i.test(sentence));
      sentencePool.push(...cleanedSentences);
    }

    const deduped = [];
    const seen = new Set();
    for (const sentence of sentencePool) {
      const normalised = sentence.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!normalised || seen.has(normalised)) continue;
      seen.add(normalised);
      deduped.push(sentence.replace(/^([a-z])/, (_, firstChar) => firstChar.toUpperCase()));
      if (deduped.length >= 3) break;
    }

    const geographySentence = geographies ? `This assessment is being considered across ${geographies}.` : '';
    return [opening, ...deduped, geographySentence]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .trim();
  }

  function buildExecutiveDecisionSupport(assessment, results, intelligence) {
    const confidence = intelligence?.confidence || null;
    const drivers = intelligence?.drivers || { upward: [], stabilisers: [] };
    const strongestUpward = drivers.upward?.[0] || '';
    const strongestStabiliser = drivers.stabilisers?.[0] || '';

    if (results.toleranceBreached) {
      return {
        decision: 'Escalate and reduce now',
        rationale: 'The scenario is already above tolerance on a severe single-event basis, so leadership should treat it as an active risk reduction decision rather than a monitoring case.',
        priority: strongestUpward || 'The severe-event loss estimate is above tolerance and needs direct treatment focus.',
        managementFocus: strongestStabiliser
          ? `Preserve the controls that are currently helping, but focus immediate action on the main upward driver. ${strongestStabiliser}`
          : 'Focus the next management discussion on the biggest upward driver and the fastest credible reduction lever.'
      };
    }
    if (results.nearTolerance || results.annualReviewTriggered) {
      return {
        decision: 'Actively reduce and review',
        rationale: 'The scenario is not yet above tolerance, but it is close enough to justify named actions, management review, and a clear reduction plan before exposure worsens.',
        priority: strongestUpward || 'The current estimate is being pushed up by one or two material assumptions that should be challenged and improved.',
        managementFocus: confidence?.label === 'Low confidence'
          ? 'Reduce the exposure, but also improve the evidence behind the estimate before relying on it for long-term decisions.'
          : (strongestStabiliser || 'Use the current control position as the baseline and test which action would move the result down fastest.')
      };
    }
    return {
      decision: 'Monitor and improve selectively',
      rationale: 'The scenario is currently within tolerance, so the priority is to preserve the stabilisers, watch for change, and improve the most material weak point before it becomes urgent.',
      priority: strongestUpward || 'Use this as a monitored scenario and challenge the assumptions that could move it upward fastest.',
      managementFocus: strongestStabiliser || 'Keep the strongest current control in place and refresh the assessment if the threat picture, geography, or business dependence changes.'
    };
  }

  function buildExecutiveThresholdModel(results, formatCurrency) {
    const singleCurrent = Number(results?.lm?.p90 || 0);
    const warning = Number(results?.warningThreshold || results?.threshold || 0);
    const tolerance = Number(results?.threshold || 0);
    const annualCurrent = Number(results?.ale?.p90 || 0);
    const annualReview = Number(results?.annualReviewThreshold || annualCurrent || 0);
    return {
      single: {
        title: 'Single-event severe view',
        current: singleCurrent,
        benchmark: tolerance,
        secondaryBenchmark: warning,
        status: singleCurrent >= tolerance ? 'Above tolerance' : singleCurrent >= warning ? 'Above warning' : 'Within warning',
        statusTone: singleCurrent >= tolerance ? 'danger' : singleCurrent >= warning ? 'warning' : 'success',
        ratio: clampNumber((singleCurrent / Math.max(tolerance, 1)) * 100, 0, 100),
        summary: singleCurrent >= tolerance
          ? `${formatCurrency(singleCurrent - tolerance)} above tolerance. Warning trigger: ${formatCurrency(warning)}.`
          : singleCurrent >= warning
            ? `${formatCurrency(tolerance - singleCurrent)} below tolerance, but above warning.`
            : `${formatCurrency(warning - singleCurrent)} below warning. Tolerance: ${formatCurrency(tolerance)}.`
      },
      annual: {
        title: 'Annual severe view',
        current: annualCurrent,
        benchmark: annualReview,
        status: annualCurrent >= annualReview ? 'Review triggered' : 'Below annual review',
        statusTone: annualCurrent >= annualReview ? 'warning' : 'success',
        ratio: clampNumber((annualCurrent / Math.max(annualReview, 1)) * 100, 0, 100),
        summary: annualCurrent >= annualReview
          ? `${formatCurrency(annualCurrent - annualReview)} above the annual review trigger.`
          : `${formatCurrency(annualReview - annualCurrent)} below the annual review trigger.`
      }
    };
  }

  function buildExecutiveImpactMix(inputs = {}) {
    const catalog = [
      ['Business interruption', Number(inputs.biLikely || 0)],
      ['Incident response', Number(inputs.irLikely || 0)],
      ['Reputation and contracts', Number(inputs.rcLikely || 0)],
      ['Regulatory and legal', Number(inputs.rlLikely || 0)],
      ['Data remediation', Number(inputs.dbLikely || 0)],
      ['Third-party liability', Number(inputs.tpLikely || 0)]
    ].filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const max = Math.max(...catalog.map(([, value]) => value), 1);
    return catalog.map(([label, value]) => ({
      label,
      value,
      width: clampNumber((value / max) * 100)
    }));
  }

  return {
    clampNumber,
    cleanExecutiveNarrativeText,
    buildExecutiveScenarioSummary,
    buildExecutiveDecisionSupport,
    buildExecutiveThresholdModel,
    buildExecutiveImpactMix
  };
})();
