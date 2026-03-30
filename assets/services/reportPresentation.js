const StructuredScenarioTools = (() => {
  if (typeof globalThis !== 'undefined' && globalThis.StructuredScenarioModel) {
    return globalThis.StructuredScenarioModel;
  }
  if (typeof module !== 'undefined' && module.exports) {
    try {
      return require('./structuredScenarioModel.js');
    } catch {}
  }
  return {
    normaliseStructuredScenario(value) {
      return value && typeof value === 'object' ? value : null;
    },
    getStructuredScenarioField(source, field) {
      const scenario = source && typeof source === 'object' ? source : {};
      if (field === 'primaryDriver') return String(scenario.primaryDriver || scenario.threatCommunity || '').trim();
      if (field === 'eventPath') return String(scenario.eventPath || scenario.attackType || '').trim();
      return String(scenario[field] || '').trim();
    }
  };
})();

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
    const structured = StructuredScenarioTools.normaliseStructuredScenario(assessment.structuredScenario) || {};
    const entity = assessment.buName || 'the organisation';
    const geographies = assessment.geography || 'the selected geographies';
    const asset = StructuredScenarioTools.getStructuredScenarioField(structured, 'assetService') || assessment.guidedInput?.asset || '';
    const eventPath = StructuredScenarioTools.getStructuredScenarioField(structured, 'eventPath') || assessment.guidedInput?.cause || '';
    const effect = StructuredScenarioTools.getStructuredScenarioField(structured, 'effect') || assessment.guidedInput?.impact || '';
    const rawNarrative = cleanExecutiveNarrativeText(assessment.enhancedNarrative || assessment.narrative || assessment.scenarioText || '');

    const openingParts = [];
    if (entity) openingParts.push(entity);
    openingParts.push('is assessing a material risk scenario');
    if (asset) openingParts.push(`centred on ${asset}`);
    let opening = openingParts.join(' ');
    if (!opening.endsWith('.')) opening += '.';

    const sentencePool = [];
    if (eventPath) sentencePool.push(`The most likely trigger is ${String(eventPath).toLowerCase()}.`);
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

    const geographySentence = geographies ? `This view should be read in the context of ${geographies}.` : '';
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
    const keyUncertainty = drivers.uncertainty?.[0]?.label || '';

    if (results.toleranceBreached) {
      return {
        decision: 'Escalate and reduce now',
        rationale: 'The severe-case loss is already above tolerance, so this should be handled as an active management decision with named actions, owners, and timing rather than passive monitoring.',
        priority: strongestUpward || 'The severe-event loss estimate is above tolerance and needs direct treatment focus.',
        managementFocus: strongestStabiliser
          ? `Preserve the control or resilience measures that are already helping, but direct the next action at the main upward driver. ${strongestStabiliser}`
          : 'Focus the next management discussion on the biggest upward driver and the fastest credible reduction lever.'
      };
    }
    if (results.nearTolerance || results.annualReviewTriggered) {
      return {
        decision: 'Actively reduce and review',
        rationale: 'The scenario is not yet above tolerance, but it is close enough to justify named actions, management review, and a reduction plan before the position worsens.',
        priority: strongestUpward || 'One or two material assumptions are still keeping the current estimate elevated and should be challenged first.',
        managementFocus: confidence?.label === 'Low confidence'
          ? `Reduce the exposure, but improve the evidence behind ${keyUncertainty || 'the broadest assumption'} before relying on this for longer-term decisions.`
          : (strongestStabiliser || 'Use the current position as the baseline and test which action would move the result down fastest.')
      };
    }
    return {
      decision: 'Monitor and improve where it matters',
      rationale: 'The scenario is currently within tolerance, so the priority is to preserve what is working, watch for change, and improve the most material weak point before it becomes urgent.',
      priority: strongestUpward || 'Use this as a monitored scenario and challenge the assumptions that could move it upward fastest.',
      managementFocus: strongestStabiliser || `Keep the strongest current control in place and refresh the assessment if ${keyUncertainty || 'the main assumptions'} changes materially.`
    };
  }

  function buildExecutiveConfidenceFrame(confidence, evidenceQuality, missingInformation = [], citations = []) {
    const label = confidence?.label || 'Moderate confidence';
    const evidenceCount = Array.isArray(citations) ? citations.length : 0;
    const topGap = Array.isArray(missingInformation) && missingInformation.length ? missingInformation[0] : '';
    const implication = /low/i.test(label)
      ? 'Use this as a directional management view and close the biggest evidence gap before relying on it for longer-term decisions.'
      : /high/i.test(label)
        ? 'The result is grounded enough for management action, but the main assumptions should still be reviewed before escalation.'
        : 'Use this as a working decision view and challenge the most material assumptions before treating it as settled.'
    ;
    const evidenceSummary = evidenceQuality
      ? `${evidenceQuality}. ${evidenceCount} supporting reference${evidenceCount === 1 ? '' : 's'} attached.`
      : `${evidenceCount} supporting reference${evidenceCount === 1 ? '' : 's'} attached.`;
    return {
      label,
      summary: confidence?.summary || implication,
      implication,
      evidenceSummary,
      topGap: topGap || 'No major evidence gap has been recorded yet.'
    };
  }

  function buildLifecycleNextStepPlan({ lifecycle, results, executiveDecision, comparison, confidenceFrame, missingInformation = [] } = {}) {
    const lifecycleStatus = String(lifecycle?.status || '').trim().toLowerCase();
    const topGap = Array.isArray(missingInformation) && missingInformation.length ? missingInformation[0] : confidenceFrame?.topGap;
    const isAboveTolerance = !!results?.toleranceBreached;
    const isNearTolerance = !!results?.nearTolerance;
    const needsAnnualReview = !!results?.annualReviewTriggered;
    const treatmentImproved = comparison?.severeEvent?.direction === 'down';

    if (lifecycleStatus === 'treatment_variant') {
      return [
        {
          label: 'Decision now',
          title: treatmentImproved ? 'Decide whether to sponsor this improvement path' : 'Refine the treatment before using it for a decision',
          copy: treatmentImproved
            ? (comparison?.treatmentNarrative || 'The treatment case is improving the current position enough to justify a management decision on whether to implement it.')
            : (comparison?.treatmentNarrative || 'The treatment case is not yet materially improving the current position, so the assumed improvement needs to be refined.')
        },
        {
          label: 'Validate next',
          title: 'Check the treatment assumptions',
          copy: topGap || 'Validate the assumptions behind the treatment case before relying on it for investment or prioritisation.'
        },
        {
          label: 'Lifecycle move',
          title: 'Keep the baseline protected',
          copy: 'Use the locked baseline as the comparison anchor, rerun this treatment case if assumptions change, then decide whether to promote it into a real action plan.'
        }
      ];
    }

    if (lifecycleStatus === 'baseline_locked') {
      return [
        {
          label: 'Decision now',
          title: 'Use this as the approved comparison baseline',
          copy: executiveDecision?.priority || 'This result is best used as the protected current-state view for future treatment comparisons.'
        },
        {
          label: 'Validate next',
          title: 'Keep the baseline evidence current',
          copy: topGap || 'Refresh the main evidence gap if this baseline is going to be used for governance or investment comparison.'
        },
        {
          label: 'Lifecycle move',
          title: 'Create treatment variants from this point',
          copy: 'Keep this record stable and compare alternative prevention, detection, response, or resilience actions against it.'
        }
      ];
    }

    if (isAboveTolerance || lifecycleStatus === 'ready_for_review') {
      return [
        {
          label: 'Decision now',
          title: 'Escalate with a named owner and timing',
          copy: executiveDecision?.rationale || 'This scenario is above tolerance or close enough to require explicit management review and action.'
        },
        {
          label: 'Validate next',
          title: 'Reduce the biggest uncertainty before formal escalation',
          copy: topGap || confidenceFrame?.implication || 'Tighten the broadest assumption before relying on this for follow-on decisions.'
        },
        {
          label: 'Lifecycle move',
          title: needsAnnualReview ? 'Schedule the annual review now' : 'Re-run after the first action lands',
          copy: needsAnnualReview
            ? 'The annual view is already strong enough to justify formal review cadence and follow-up.'
            : 'Use this saved result as the current-state view, then re-run once the first response action changes the assumptions.'
        }
      ];
    }

    if (isNearTolerance) {
      return [
        {
          label: 'Decision now',
          title: 'Assign a targeted reduction action',
          copy: executiveDecision?.priority || 'The scenario is near tolerance, so one targeted action should be agreed before the position worsens.'
        },
        {
          label: 'Validate next',
          title: 'Challenge the main upward driver',
          copy: topGap || 'Tighten the evidence behind the biggest upward driver before treating this as stable.'
        },
        {
          label: 'Lifecycle move',
          title: 'Keep it review-ready',
          copy: 'Treat this as an actively monitored scenario and re-run it if the threat, control posture, or business dependence changes.'
        }
      ];
    }

    return [
      {
        label: 'Decision now',
        title: 'Monitor and preserve what is working',
        copy: executiveDecision?.managementFocus || 'The scenario is within tolerance today, so the main job is to preserve the strongest current controls and resilience measures.'
      },
      {
        label: 'Validate next',
        title: 'Close the highest-value evidence gap',
        copy: topGap || confidenceFrame?.implication || 'Improve the evidence behind the broadest assumption so the next review is better grounded.'
      },
      {
        label: 'Lifecycle move',
        title: 'Use this as the current monitored baseline',
        copy: 'Keep this saved result as the current view and refresh it if conditions change materially or a new treatment option is proposed.'
      }
    ];
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

  function buildTreatmentDecisionSummary(comparison) {
    if (!comparison) {
      return {
        title: 'No treatment comparison selected yet',
        summary: 'Select a baseline or treatment case to show whether the proposed change is materially improving the management position.',
        action: 'Use a saved current-state assessment as the comparison anchor before discussing investment or prioritisation.'
      };
    }

    const severeDirection = String(comparison?.severeEvent?.direction || 'flat');
    const annualDirection = String(comparison?.annualExposure?.direction || 'flat');
    const severeAnnualDirection = String(comparison?.severeAnnual?.direction || 'flat');
    const keyDriver = comparison?.keyDriver || 'No dominant change driver has been recorded yet.';
    const secondaryDriver = comparison?.secondaryDriver || 'No secondary change driver has been recorded yet.';

    if (severeDirection === 'down' && (annualDirection === 'down' || severeAnnualDirection === 'down')) {
      return {
        title: 'The treatment path is materially improving the management position',
        summary: comparison?.treatmentNarrative || 'The treated case is reducing both the severe event burden and the annual exposure profile relative to the baseline.',
        action: `Validate the treatment assumptions, then decide whether to sponsor this path. Main lever: ${keyDriver} Supporting lever: ${secondaryDriver}`
      };
    }

    if (severeDirection === 'down') {
      return {
        title: 'The treatment path improves the severe case, but not the whole annual picture yet',
        summary: comparison?.treatmentNarrative || 'The treated case is improving the single-event position, but the annual exposure still needs more work before this becomes a clear management move.',
        action: `Keep the stronger severe-event assumptions, then refine the annual drivers before relying on this as the preferred path. Main lever: ${keyDriver}`
      };
    }

    if (severeDirection === 'up' || annualDirection === 'up' || severeAnnualDirection === 'up') {
      return {
        title: 'The current treatment assumptions are not yet improving the baseline',
        summary: comparison?.treatmentNarrative || 'The current case remains heavier than the baseline, so the proposed treatment path should be refined before it is taken forward.',
        action: `Challenge the assumptions that are still keeping the case above the baseline. Main lever: ${keyDriver} Supporting lever: ${secondaryDriver}`
      };
    }

    return {
      title: 'The treatment path is not yet materially changing the position',
      summary: comparison?.treatmentNarrative || 'The current case and baseline are directionally similar, so the proposed change is not yet creating a clear decision delta.',
      action: `Adjust the assumptions that should move the result most, then rerun the comparison. Main lever: ${keyDriver}`
    };
  }

  function buildAnalystAdvisorySummary({ assessment, results, executiveDecision, confidenceFrame, comparison, missingInformation = [], lifecycle } = {}) {
    const severeEvent = Number(results?.eventLoss?.p90 || results?.lm?.p90 || 0);
    const annualExposure = Number(results?.annualLoss?.mean || results?.ale?.mean || 0);
    const posture = results?.toleranceBreached
      ? 'is above tolerance'
      : results?.nearTolerance
        ? 'is close to tolerance'
        : 'is currently within tolerance';
    const lifecycleLabel = lifecycle?.label || 'Saved assessment';
    const topGap = Array.isArray(missingInformation) && missingInformation.length
      ? missingInformation[0]
      : confidenceFrame?.topGap || 'No material evidence gap has been recorded yet.';
    const confidenceLabel = confidenceFrame?.label || 'Moderate confidence';
    const treatmentRead = comparison
      ? `Treatment comparison indicates that the proposed change ${comparison.severeEvent?.direction === 'down' ? 'improves the severe-event position' : comparison.severeEvent?.direction === 'up' ? 'worsens the severe-event position' : 'does not yet materially change the severe-event position'}, with ${comparison.keyDriver || 'no single change driver called out yet'}.`
      : 'No treatment comparison is currently selected, so this read reflects the current-state scenario only.';

    return {
      title: 'Analyst Summary',
      opening: `This scenario ${posture}, with a severe single-event view of ${severeEvent > 0 ? 'the recorded high-stress loss' : 'the current saved loss view'} and an expected annual exposure that should be read as a management planning range rather than a precise forecast.`,
      meaning: executiveDecision?.rationale || 'The result should be used to support a management decision on whether to monitor, reduce, or escalate the scenario.',
      confidence: `${confidenceLabel} confidence. ${confidenceFrame?.implication || 'The broadest assumptions should still be challenged before relying on this for higher-stakes decisions.'}`,
      evidence: `Best next evidence move: ${topGap}`,
      treatment: treatmentRead,
      close: `${lifecycleLabel} status means the next best move is to ${String(executiveDecision?.decision || 'review the result').toLowerCase()} and preserve the saved result as the current reference point.`
    };
  }

  function buildFastestReductionLever(recommendations, executiveDecision) {
    const topRec = Array.isArray(recommendations) && recommendations.length
      ? recommendations[0]
      : null;
    if (!topRec) {
      return executiveDecision?.priority
        ? `The most important next action is: ${executiveDecision.priority}`
        : '';
    }
    const title = String(topRec.title || '').trim();
    const why = String(topRec.why || topRec.impact || '').trim();
    if (!title) return '';
    return why
      ? `The fastest credible reduction lever is ${title} — ${why.charAt(0).toLowerCase()}${why.slice(1).replace(/\.$/, '')}.`
      : `The fastest credible reduction lever is ${title}.`;
  }

  function buildMetricAnchorSentence(metricLabel, value, benchmarkReferences, geography) {
    const num = Number(value || 0);
    if (!num) return '';
    const geo = String(geography || '').toLowerCase();
    const isGcc = /uae|gcc|gulf|saudi|qatar|bahrain|kuwait|oman/.test(geo);
    const refs = Array.isArray(benchmarkReferences) ? benchmarkReferences : [];
    const topRef = refs[0] || null;

    if (num >= 10000000) {
      return isGcc
        ? 'This is within the range of material cyber losses reported by GCC financial institutions in recent regulatory disclosures.'
        : 'This is within the range of material cyber losses reported in recent regulatory enforcement actions.';
    }
    if (num >= 2000000) {
      return topRef
        ? `This is consistent with the ${topRef.sourceTitle || topRef.title || 'benchmark reference'} range for comparable scenarios.`
        : 'This is within the range that typically triggers board-level reporting and external incident response engagement.';
    }
    if (num >= 500000) {
      return 'This is within the range that typically requires senior management escalation and external advisory support.';
    }
    if (num >= 100000) {
      return 'This is within the range manageable through existing incident response retainer and internal resources.';
    }
    return 'This is within the range typically handled at team level without senior escalation.';
  }

  const exported = {
    clampNumber,
    cleanExecutiveNarrativeText,
    buildExecutiveScenarioSummary,
    buildExecutiveDecisionSupport,
    buildExecutiveConfidenceFrame,
    buildLifecycleNextStepPlan,
    buildExecutiveThresholdModel,
    buildExecutiveImpactMix,
    buildTreatmentDecisionSummary,
    buildAnalystAdvisorySummary,
    buildFastestReductionLever,
    buildMetricAnchorSentence
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  return exported;
})();
