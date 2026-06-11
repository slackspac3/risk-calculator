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

  function appendSignalValue(parts, value, depth = 0) {
    if (value == null || depth > 3 || parts.length > 80) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value || '').trim();
      if (text) parts.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 16).forEach(item => appendSignalValue(parts, item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).slice(0, 24).forEach(([key, item]) => {
        if (/^(results|fairParams|runMetadata|histogram|lec|chart|vector|embedding)$/i.test(String(key || ''))) return;
        appendSignalValue(parts, item, depth + 1);
      });
    }
  }

  function buildScenarioSignalText(assessment = {}) {
    const source = assessment && typeof assessment === 'object' ? assessment : {};
    const fields = [
      'scenarioTitle',
      'title',
      'narrative',
      'enhancedNarrative',
      'scenarioText',
      'sourceNarrative',
      'guidedDraftPreview',
      'intakeSummary',
      'linkAnalysis',
      'contextNotes',
      'benchmarkBasis',
      'learningNote',
      'riskStatement'
    ];
    const parts = [];
    fields.forEach(field => appendSignalValue(parts, source[field]));
    [
      'guidedInput',
      'structuredScenario',
      'scenarioLens',
      'selectedRisks',
      'riskCandidates',
      'recommendations',
      'missingInformation',
      'workflowGuidance',
      'applicableRegulations',
      'primaryGrounding',
      'supportingReferences'
    ].forEach(field => appendSignalValue(parts, source[field]));
    return parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function createCriticalCondition(key, {
    title,
    statusTitle,
    headline,
    action,
    blockingGap,
    owner,
    requiredControls = []
  } = {}) {
    const cleanTitle = String(title || 'Critical response condition').trim();
    const cleanAction = String(action || 'Confirm the mandatory response owner and containment evidence before sign-off.').trim();
    const cleanGap = String(blockingGap || 'Confirm the mandatory response condition is contained before treating this result as decision-ready.').trim();
    return {
      present: true,
      key,
      severity: 'critical',
      tone: 'danger',
      label: 'Critical condition',
      title: cleanTitle,
      statusTitle: String(statusTitle || 'Critical response gate open').trim(),
      headline: String(headline || 'This result has a mandatory response gate even if the financial estimate is below tolerance.').trim(),
      statusDetail: 'The quantitative result remains useful, but this scenario contains a hard response trigger that must be closed before management treats the position as decision-ready.',
      decision: 'Critical response required',
      action: cleanAction,
      priority: cleanAction,
      managementFocus: 'Assign the accountable owner, preserve evidence, complete containment or legal review, and rerun the assessment after the control condition is proven closed.',
      blockingGap: cleanGap,
      owner: String(owner || 'Risk owner').trim(),
      requiredControls: Array.from(new Set([
        ...requiredControls.map(item => String(item || '').trim()).filter(Boolean),
        cleanGap,
        'Record the named response owner and evidence of closure before final approval.'
      ])).slice(0, 5),
      statusIcon: '!',
      statusClass: 'above'
    };
  }

  function detectCriticalCondition(assessment = {}) {
    const text = buildScenarioSignalText(assessment);
    if (!text) return null;
    const has = pattern => pattern.test(text);
    const credentialSignal = has(/\b(credential|credentials|password|token|session|secret|api key|access key|login|ssh key|private key)\b/i);
    const exposureSignal = has(/\b(dark\s*web|darkweb|for sale|sold|marketplace|credential dump|dumped|leaked|stolen|exposed|broker|compromised|posted)\b/i);
    const privilegedSignal = has(/\b(admin|administrator|global admin|tenant admin|domain admin|root|privileged|superuser|break-glass|service account|azure|entra|azure ad|iam|okta|sso)\b/i);
    if (credentialSignal && exposureSignal && privilegedSignal) {
      return createCriticalCondition('privileged-access-exposure', {
        title: 'Privileged credential exposure',
        statusTitle: 'Critical access gate open',
        headline: 'Potentially valid privileged credentials create a critical response gate, even if the loss estimate is below tolerance.',
        action: 'Revoke exposed access, invalidate sessions and tokens, and verify no privileged tenant activity remains.',
        blockingGap: 'Confirm exposed privileged credentials are revoked or disabled, sessions and tokens are invalidated, and audit logs show no unauthorised privileged activity.',
        owner: 'Identity or Security operations owner',
        requiredControls: [
          'Disable or rotate the exposed privileged credentials.',
          'Invalidate active sessions, refresh tokens, and remembered MFA state.',
          'Review privileged audit logs for tenant changes, persistence, and data access.',
          'Confirm no attacker-controlled access path remains before sign-off.'
        ]
      });
    }

    const activeCompromiseSignal = has(/\b(active|ongoing|confirmed|currently|being used|used to|logged in|accessed|modified|changed|encrypted|exfiltrat(?:e|ed|ion)|unauthori[sz]ed)\b/i)
      && has(/\b(compromise|attacker|malware|ransomware|breach|unauthori[sz]ed access|credential|tenant|account takeover|intrusion)\b/i);
    if (activeCompromiseSignal) {
      return createCriticalCondition('active-compromise', {
        title: 'Active compromise indicator',
        statusTitle: 'Active incident gate open',
        headline: 'The scenario indicates active or confirmed compromise, so containment must lead the management decision.',
        action: 'Contain the active access path, preserve evidence, and confirm the incident owner before relying on the loss estimate.',
        blockingGap: 'Confirm the active compromise indicator is contained, evidence is preserved, and the incident owner has approved the current posture.',
        owner: 'Incident response owner',
        requiredControls: [
          'Record containment status and incident commander.',
          'Preserve logs and affected-system evidence.',
          'Confirm detection, eradication, and recovery actions before closure.'
        ]
      });
    }

    const dataBreachSignal = has(/\b(personal data|customer data|customer records|pii|payment card|health records|regulated data|confidential data|sensitive data)\b/i)
      && has(/\b(exfiltrat(?:e|ed|ion)|stolen|leaked|published|exposed|breach|sold|for sale)\b/i);
    if (dataBreachSignal) {
      return createCriticalCondition('regulated-data-exposure', {
        title: 'Regulated data exposure',
        statusTitle: 'Data breach review gate open',
        headline: 'The scenario may trigger legal or regulatory breach duties independent of the financial tolerance result.',
        action: 'Confirm breach assessment, notification duties, containment, and legal owner before sign-off.',
        blockingGap: 'Confirm whether regulated or sensitive data was exposed, whether notification duties apply, and which legal owner approved the decision.',
        owner: 'Privacy, Legal, or Compliance owner',
        requiredControls: [
          'Complete breach triage and data-scope confirmation.',
          'Check notification duties and regulatory deadlines.',
          'Record legal approval and customer/regulator communication path.'
        ]
      });
    }

    const legalTriggerSignal = has(/\b(sanction|sanctions|blocked party|bribery|bribe|corruption|money laundering|terrorist financing|export control|prohibited party)\b/i)
      && has(/\b(breach|violation|hit|confirmed|payment|transaction|counterparty|supplier|customer|contract)\b/i);
    if (legalTriggerSignal) {
      return createCriticalCondition('legal-compliance-hard-trigger', {
        title: 'Legal or compliance hard trigger',
        statusTitle: 'Legal review gate open',
        headline: 'The scenario contains a legal or compliance trigger that needs owner review regardless of expected loss.',
        action: 'Hold the decision for Legal or Compliance review and document the required regulatory response.',
        blockingGap: 'Confirm Legal or Compliance has reviewed the hard-trigger condition and recorded the required response path.',
        owner: 'Legal or Compliance owner',
        requiredControls: [
          'Stop or hold the implicated transaction or activity where required.',
          'Complete legal/compliance review and record the decision basis.',
          'Preserve evidence for audit and regulatory follow-up.'
        ]
      });
    }

    const safetySignal = has(/\b(fatalit(?:y|ies)|serious injury|life safety|worker safety|public safety|patient safety|safety incident|critical infrastructure|emergency service)\b/i)
      && has(/\b(active|ongoing|confirmed|incident|uncontrolled|outage|failure|exposure|harm)\b/i);
    if (safetySignal) {
      return createCriticalCondition('safety-critical-condition', {
        title: 'Safety-critical condition',
        statusTitle: 'Safety response gate open',
        headline: 'The scenario includes a safety-critical condition, so operational escalation takes priority over appetite status.',
        action: 'Confirm the safety owner, immediate controls, and escalation path before using the result for sign-off.',
        blockingGap: 'Confirm the safety condition is controlled, the accountable safety owner has reviewed it, and immediate escalation duties are complete.',
        owner: 'Safety or operational resilience owner',
        requiredControls: [
          'Confirm immediate safety controls and accountable owner.',
          'Record escalation, regulatory, and operational response duties.',
          'Do not close the result until the safety condition is controlled.'
        ]
      });
    }

    return null;
  }

  function buildExecutiveDecisionSupport(assessment, results, intelligence) {
    const criticalCondition = detectCriticalCondition(assessment);
    if (criticalCondition) {
      const quantitativeContext = results?.toleranceBreached
        ? 'The financial model is also above tolerance, so both the appetite result and the hard trigger support escalation.'
        : results?.nearTolerance
          ? 'The financial model is close to tolerance, but the hard trigger is the reason this cannot wait for ordinary review cadence.'
          : 'The financial model may be below tolerance, but the hard trigger still requires containment, owner review, and closure evidence.';
      return {
        decision: criticalCondition.decision,
        rationale: `${quantitativeContext} ${criticalCondition.statusDetail}`,
        priority: criticalCondition.priority,
        managementFocus: criticalCondition.managementFocus,
        criticalCondition
      };
    }
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
    const criticalCondition = executiveDecision?.criticalCondition || null;
    if (criticalCondition) {
      return [
        {
          label: 'Decision now',
          title: criticalCondition.action || 'Close the critical response gate',
          copy: criticalCondition.statusDetail || 'The hard-trigger condition must be controlled before the result is treated as decision-ready.'
        },
        {
          label: 'Validate next',
          title: criticalCondition.blockingGap || 'Confirm closure evidence',
          copy: 'Collect the evidence that proves the mandatory response condition is contained or no longer valid.'
        },
        {
          label: 'Lifecycle move',
          title: 'Rerun after containment evidence lands',
          copy: 'Keep the saved result as the current view, then rerun or update the assessment once closure evidence changes the scenario assumptions.'
        }
      ];
    }
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
    const tradeoffSummary = String(comparison?.treatmentTradeoff?.summary || '').trim();
    const tradeoffRecommendedPath = String(comparison?.treatmentTradeoff?.recommendedPath || '').trim();
    const withTradeoff = (payload) => ({
      ...payload,
      tradeoffSummary,
      tradeoffRecommendedPath
    });

    if (severeDirection === 'down' && (annualDirection === 'down' || severeAnnualDirection === 'down')) {
      return withTradeoff({
        title: 'The treatment path is materially improving the management position',
        summary: comparison?.treatmentNarrative || 'The treated case is reducing both the severe event burden and the annual exposure profile relative to the baseline.',
        action: `Validate the treatment assumptions, then decide whether to sponsor this path. Main lever: ${keyDriver} Supporting lever: ${secondaryDriver}`
      });
    }

    if (severeDirection === 'down') {
      return withTradeoff({
        title: 'The treatment path improves the severe case, but not the whole annual picture yet',
        summary: comparison?.treatmentNarrative || 'The treated case is improving the single-event position, but the annual exposure still needs more work before this becomes a clear management move.',
        action: `Keep the stronger severe-event assumptions, then refine the annual drivers before relying on this as the preferred path. Main lever: ${keyDriver}`
      });
    }

    if (severeDirection === 'up' || annualDirection === 'up' || severeAnnualDirection === 'up') {
      return withTradeoff({
        title: 'The current treatment assumptions are not yet improving the baseline',
        summary: comparison?.treatmentNarrative || 'The current case remains heavier than the baseline, so the proposed treatment path should be refined before it is taken forward.',
        action: `Challenge the assumptions that are still keeping the case above the baseline. Main lever: ${keyDriver} Supporting lever: ${secondaryDriver}`
      });
    }

    return withTradeoff({
      title: 'The treatment path is not yet materially changing the position',
      summary: comparison?.treatmentNarrative || 'The current case and baseline are directionally similar, so the proposed change is not yet creating a clear decision delta.',
      action: `Adjust the assumptions that should move the result most, then rerun the comparison. Main lever: ${keyDriver}`
    });
  }

  function buildAnalystAdvisorySummary({ assessment, results, executiveDecision, confidenceFrame, comparison, missingInformation = [], lifecycle } = {}) {
    const severeEvent = Number(results?.eventLoss?.p90 || results?.lm?.p90 || 0);
    const annualExposure = Number(results?.annualLoss?.mean || results?.ale?.mean || 0);
    const criticalCondition = executiveDecision?.criticalCondition || detectCriticalCondition(assessment);
    const posture = criticalCondition
      ? 'has a critical response gate'
      : results?.toleranceBreached
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

  function buildReviewerBriefSource({
    assessment,
    results,
    executiveHeadline = '',
    statusTitle = '',
    statusDetail = '',
    executiveDecision = null,
    executiveAction = '',
    confidenceFrame = null,
    assessmentIntelligence = null
  } = {}) {
    const scenarioSummary = buildExecutiveScenarioSummary(assessment || {});
    const criticalCondition = executiveDecision?.criticalCondition || detectCriticalCondition(assessment || {});
    const topAssumption = Array.isArray(assessmentIntelligence?.assumptions)
      ? assessmentIntelligence.assumptions.find(Boolean)
      : null;
    const topDriver = Array.isArray(assessmentIntelligence?.drivers?.upward)
      ? assessmentIntelligence.drivers.upward.find(Boolean)
      : '';
    const toleranceStatus = results?.toleranceBreached
      ? 'Above tolerance'
      : results?.nearTolerance
        ? 'Near tolerance'
        : results?.annualReviewTriggered
          ? 'Annual review triggered'
          : 'Within tolerance';
    const projectHorizon = results?.projectHorizon && typeof results.projectHorizon === 'object'
      ? results.projectHorizon
      : null;
    const projectHorizonLines = projectHorizon
      ? (projectHorizon.enabled
          ? [
              `Project-horizon expected loss: ${Number(projectHorizon.loss?.mean || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
              `Project event probability: ${(Number(projectHorizon.eventProbability || 0) * 100).toFixed(1)}% over ${Number(projectHorizon.durationMonths || 0).toFixed(1)} months`,
              projectHorizon.lossAsPctOfProjectValue ? `Project-horizon P90 as % of project value: ${(Number(projectHorizon.lossAsPctOfProjectValue.p90 || 0) * 100).toFixed(1)}% (${String(projectHorizon.lossAsPctOfProjectValueSourceStatus || 'unknown')})` : '',
              projectHorizon.lossAsPctOfMargin ? `Project-horizon P90 as % of margin: ${(Number(projectHorizon.lossAsPctOfMargin.p90 || 0) * 100).toFixed(1)}% (${String(projectHorizon.lossAsPctOfMarginSourceStatus || 'unknown')})` : '',
              `Project-horizon confidence: ${String(projectHorizon.confidenceLabel || 'Not labelled')}`
            ]
          : [`Project-horizon metrics skipped: ${String(projectHorizon.skippedReason || 'duration or value unavailable')}`])
      : [];
    return [
      `Scenario summary: ${scenarioSummary}`,
      `Executive headline: ${String(executiveHeadline || statusTitle || 'Management review needed').trim()}`,
      `Current posture: ${String(statusDetail || '').trim()}`,
      `Tolerance status: ${toleranceStatus}`,
      criticalCondition ? `Critical condition: ${criticalCondition.title}. Required action: ${criticalCondition.action}` : '',
      `Severe single-event loss (P90): ${Number(results?.eventLoss?.p90 || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      `Expected annualized loss: ${Number(results?.annualLoss?.mean || results?.ale?.mean || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      `Severe annualized loss (P90): ${Number(results?.annualLoss?.p90 || results?.ale?.p90 || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      ...projectHorizonLines,
      `Management decision: ${String(executiveDecision?.decision || 'Review').trim()}`,
      `Immediate focus: ${String(executiveAction || executiveDecision?.priority || '').trim()}`,
      `Confidence: ${String(confidenceFrame?.label || 'Moderate confidence').trim()}${confidenceFrame?.summary ? `. ${String(confidenceFrame.summary).trim()}` : ''}`,
      topAssumption ? `Key assumption: ${String(topAssumption.text || topAssumption).trim()}` : '',
      topDriver ? `Main upward driver: ${String(topDriver).trim()}` : ''
    ].filter(Boolean).join('\n');
  }

  function normaliseProjectResultsAssessmentType(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'project_buyer' || text === 'project_seller') return text;
    return 'enterprise_generic';
  }

  function formatProjectResultCurrency(value, fmtCurrency) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    if (typeof fmtCurrency === 'function') return fmtCurrency(numeric);
    return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  function projectResultMetaStatus(meta = {}, value = null) {
    const raw = meta && typeof meta === 'object' ? meta : {};
    const status = String(raw.status || '').trim().toLowerCase();
    if (status) return status;
    return value == null || value === '' || !Number.isFinite(Number(value)) ? 'unknown' : 'known';
  }

  function projectResultMetaConfidence(meta = {}, fallback = 'unknown') {
    const raw = meta && typeof meta === 'object' ? meta : {};
    return String(raw.confidence || fallback || 'unknown').trim() || 'unknown';
  }

  function buildProjectValueItem({ label, value, meta, fmtCurrency }) {
    const numeric = Number(value);
    const status = projectResultMetaStatus(meta, value);
    if (!Number.isFinite(numeric)) return null;
    return {
      label,
      value: formatProjectResultCurrency(numeric, fmtCurrency),
      rawValue: numeric,
      status,
      confidence: projectResultMetaConfidence(meta, status === 'known' ? 'medium' : 'unknown'),
      source: String(meta?.source || (status === 'unknown' ? 'not_provided' : 'user')).trim() || 'user'
    };
  }

  function buildProjectDriverItem(driver = {}, fmtCurrency) {
    const status = String(driver?.driverStatus || '').trim() || 'unquantified_driver';
    const hasRange = [driver?.low, driver?.likely, driver?.high]
      .every(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
    const missingInputs = Array.isArray(driver?.missingInputs)
      ? driver.missingInputs.map(item => typeof item === 'string' ? item : (item?.label || item?.field || '')).map(item => String(item || '').trim()).filter(Boolean)
      : [];
    return {
      id: String(driver?.id || driver?.label || '').trim(),
      label: String(driver?.label || driver?.driverType || 'Project exposure driver').trim(),
      type: String(driver?.driverType || 'other').trim(),
      status,
      statusLabel: status.replace(/_/g, ' '),
      low: hasRange ? Number(driver.low) : null,
      likely: hasRange ? Number(driver.likely) : null,
      high: hasRange ? Number(driver.high) : null,
      rangeLabel: hasRange
        ? `${formatProjectResultCurrency(driver.low, fmtCurrency)} / ${formatProjectResultCurrency(driver.likely, fmtCurrency)} / ${formatProjectResultCurrency(driver.high, fmtCurrency)}`
        : 'Not quantified',
      confidence: String(driver?.confidence || 'unknown').trim() || 'unknown',
      source: String(driver?.source || 'unknown').trim() || 'unknown',
      mapsTo: Array.isArray(driver?.mapsTo) ? driver.mapsTo.map(item => String(item || '').trim()).filter(Boolean) : [driver?.mapsTo].map(item => String(item || '').trim()).filter(Boolean),
      rationale: String(driver?.rationale || '').trim(),
      missingInputs
    };
  }

  function groupProjectDrivers(financialDrivers = [], fmtCurrency) {
    const groups = {
      quantified: [],
      proxyEstimated: [],
      unquantified: []
    };
    (Array.isArray(financialDrivers) ? financialDrivers : []).forEach(driver => {
      const item = buildProjectDriverItem(driver, fmtCurrency);
      if (item.status === 'unquantified_driver' || item.low == null || item.likely == null || item.high == null) {
        groups.unquantified.push(item);
      } else if (item.status === 'benchmark_proxy_driver' || item.status === 'estimated_driver') {
        groups.proxyEstimated.push(item);
      } else {
        groups.quantified.push(item);
      }
    });
    return groups;
  }

  function normaliseProjectMissingInputs(projectExposure = {}) {
    const missing = Array.isArray(projectExposure?.missingInputs) ? projectExposure.missingInputs : [];
    return missing.map(item => {
      if (typeof item === 'string') {
        return {
          field: item,
          label: item,
          importance: 'medium',
          whyItMatters: '',
          whoMightKnow: '',
          suggestedQuestion: '',
          mapsTo: ''
        };
      }
      return {
        field: String(item?.field || '').trim(),
        label: String(item?.label || item?.field || 'Missing project input').trim(),
        importance: String(item?.importance || 'medium').trim(),
        whyItMatters: String(item?.whyItMatters || '').trim(),
        whoMightKnow: String(item?.whoMightKnow || '').trim(),
        suggestedQuestion: String(item?.suggestedQuestion || '').trim(),
        mapsTo: Array.isArray(item?.mapsTo) ? item.mapsTo.join(', ') : String(item?.mapsTo || '').trim()
      };
    }).filter(item => item.label).slice(0, 12);
  }

  function buildProjectHorizonSummary(projectHorizon = {}, fmtCurrency) {
    if (!projectHorizon || typeof projectHorizon !== 'object') return null;
    if (!projectHorizon.enabled) {
      return {
        enabled: false,
        skippedReason: String(projectHorizon.skippedReason || 'Project duration or value unavailable').trim(),
        caveats: Array.isArray(projectHorizon.caveats) ? projectHorizon.caveats.map(item => String(item || '').trim()).filter(Boolean) : []
      };
    }
    return {
      enabled: true,
      expectedLoss: formatProjectResultCurrency(projectHorizon.loss?.mean || 0, fmtCurrency),
      p90Loss: formatProjectResultCurrency(projectHorizon.loss?.p90 || 0, fmtCurrency),
      eventProbabilityLabel: `${(Number(projectHorizon.eventProbability || 0) * 100).toFixed(1)}%`,
      durationLabel: `${Number(projectHorizon.durationMonths || 0).toFixed(1)} months`,
      confidenceLabel: String(projectHorizon.confidenceLabel || '').trim(),
      durationSourceStatus: String(projectHorizon.durationSourceStatus || 'unknown').trim(),
      lossAsPctOfProjectValueLabel: projectHorizon.lossAsPctOfProjectValue
        ? `${(Number(projectHorizon.lossAsPctOfProjectValue.p90 || 0) * 100).toFixed(1)}%`
        : '',
      lossAsPctOfMarginLabel: projectHorizon.lossAsPctOfMargin
        ? `${(Number(projectHorizon.lossAsPctOfMargin.p90 || 0) * 100).toFixed(1)}%`
        : '',
      caveats: Array.isArray(projectHorizon.caveats) ? projectHorizon.caveats.map(item => String(item || '').trim()).filter(Boolean) : []
    };
  }

  function buildProjectResultsModel(assessment = {}, results = {}, fmtCurrency = null) {
    const assessmentType = normaliseProjectResultsAssessmentType(assessment?.assessmentType || results?.runConfig?.assessmentType || results?.inputs?.assessmentType);
    const isProject = assessmentType === 'project_buyer' || assessmentType === 'project_seller';
    if (!isProject) {
      return {
        assessmentType,
        isProject: false,
        title: 'Enterprise risk estimate',
        metrics: [
          { label: 'Event loss', value: formatProjectResultCurrency(results?.eventLoss?.p90 || results?.lm?.p90 || 0, fmtCurrency), copy: 'Severe single-event view' },
          { label: 'Annualized loss', value: formatProjectResultCurrency(results?.annualLoss?.mean || results?.ale?.mean || 0, fmtCurrency), copy: 'Expected annual planning view' },
          { label: 'Tolerance exceedance', value: `${(Number(results?.toleranceDetail?.lmExceedProb || 0) * 100).toFixed(1)}%`, copy: 'Probability of exceeding event tolerance in the model' },
          { label: 'Annual review trigger', value: results?.annualReviewTriggered ? 'Triggered' : 'Not triggered', copy: 'Existing annual review logic' }
        ]
      };
    }

    const projectExposure = assessment?.projectExposure && typeof assessment.projectExposure === 'object'
      ? assessment.projectExposure
      : {};
    const hasProjectExposureSignal = !!String(projectExposure.projectExposureSummary || '').trim()
      || (Array.isArray(projectExposure.financialDrivers) && projectExposure.financialDrivers.length > 0)
      || (Array.isArray(projectExposure.missingInputs) && projectExposure.missingInputs.length > 0)
      || (projectExposure.projectInputQuality && typeof projectExposure.projectInputQuality === 'object' && Object.keys(projectExposure.projectInputQuality).length > 0);
    const quality = projectExposure.projectInputQuality && typeof projectExposure.projectInputQuality === 'object'
      ? projectExposure.projectInputQuality
      : {};
    const missingInputs = normaliseProjectMissingInputs(projectExposure);
    const unknownQuality = Array.isArray(quality.unknownHighImpactInputs)
      ? quality.unknownHighImpactInputs.map(item => typeof item === 'string' ? item : (item?.label || item?.field || '')).map(item => String(item || '').trim()).filter(Boolean)
      : [];
    const driverGroups = groupProjectDrivers(projectExposure.financialDrivers, fmtCurrency);
    const caveatSummary = !hasProjectExposureSignal || missingInputs.length || unknownQuality.length
      ? 'Project economics are thin. The estimate is directional until key values are confirmed.'
      : 'Project economics have enough support for a directional management read.';
    const buyerEconomics = assessment?.buyerEconomics && typeof assessment.buyerEconomics === 'object' ? assessment.buyerEconomics : {};
    const buyerMeta = assessment?.buyerEconomicsMeta && typeof assessment.buyerEconomicsMeta === 'object' ? assessment.buyerEconomicsMeta : {};
    const sellerEconomics = assessment?.sellerEconomics && typeof assessment.sellerEconomics === 'object' ? assessment.sellerEconomics : {};
    const sellerMeta = assessment?.sellerEconomicsMeta && typeof assessment.sellerEconomicsMeta === 'object' ? assessment.sellerEconomicsMeta : {};
    const knownValues = [];
    const estimatedValues = [];
    const pushValue = (item) => {
      if (!item) return;
      if (item.status === 'estimated' || item.status === 'benchmark_proxy' || item.status === 'derived') estimatedValues.push(item);
      else if (item.status !== 'unknown' && item.status !== 'not_applicable') knownValues.push(item);
    };
    if (assessmentType === 'project_buyer') {
      pushValue(buildProjectValueItem({ label: 'Project spend / budget', value: buyerEconomics.expectedSpend ?? buyerEconomics.approvedBudget, meta: buyerEconomics.expectedSpend != null ? buyerMeta.expectedSpend : buyerMeta.approvedBudget, fmtCurrency }));
      pushValue(buildProjectValueItem({ label: 'Amount paid or committed', value: buyerEconomics.amountPaid ?? buyerEconomics.amountCommitted, meta: buyerEconomics.amountPaid != null ? buyerMeta.amountPaid : buyerMeta.amountCommitted, fmtCurrency }));
      pushValue(buildProjectValueItem({ label: 'Recoveries / offsets', value: buyerEconomics.supplierCredits ?? buyerEconomics.insuranceRecoveries ?? buyerEconomics.liquidatedDamagesRecoverable, meta: buyerEconomics.supplierCredits != null ? buyerMeta.supplierCredits : buyerEconomics.insuranceRecoveries != null ? buyerMeta.insuranceRecoveries : buyerMeta.liquidatedDamagesRecoverable, fmtCurrency }));
    } else {
      pushValue(buildProjectValueItem({ label: 'Contract value', value: sellerEconomics.contractValue, meta: sellerMeta.contractValue, fmtCurrency }));
      pushValue(buildProjectValueItem({ label: 'Revenue at risk', value: sellerEconomics.expectedRevenue ?? sellerEconomics.revenueRecognitionAtRisk, meta: sellerEconomics.expectedRevenue != null ? sellerMeta.expectedRevenue : sellerMeta.revenueRecognitionAtRisk, fmtCurrency }));
      pushValue(buildProjectValueItem({ label: 'Expected margin', value: sellerEconomics.contributionMargin, meta: sellerMeta.contributionMargin, fmtCurrency }));
      pushValue(buildProjectValueItem({ label: 'Cost to cure', value: sellerEconomics.costToCure, meta: sellerMeta.costToCure, fmtCurrency }));
    }

    const summary = String(projectExposure.projectExposureSummary || '').trim() || caveatSummary;
    return {
      assessmentType,
      isProject: true,
      role: assessmentType === 'project_seller' ? 'seller' : 'buyer',
      title: assessmentType === 'project_seller' ? 'Project seller exposure' : 'Project buyer exposure',
      helperCopy: assessmentType === 'project_seller'
        ? 'Seller project results separate revenue at risk, margin at risk, delivery cost, penalties, termination, recoveries, and project-horizon exposure.'
        : 'Buyer project results separate spend, delay cost, reprocurement, sunk cost, recoveries, and project-horizon exposure.',
      summary,
      inputQuality: {
        score: Number.isFinite(Number(quality.score)) ? Number(quality.score) : null,
        label: String(quality.label || 'Thin project economics').trim(),
        canProceed: quality.canProceed !== false,
        recommendedNextInput: quality.recommendedNextInput && typeof quality.recommendedNextInput === 'object' ? quality.recommendedNextInput : null
      },
      knownValues,
      estimatedValues,
      unknownHighImpactValues: Array.from(new Set([
        ...unknownQuality,
        ...missingInputs.filter(item => item.importance === 'high').map(item => item.label)
      ])).slice(0, 12),
      decisionSensitiveUnknowns: missingInputs.filter(item => item.importance === 'high').slice(0, 6),
      driverGroups,
      capsAndOffsets: Array.isArray(projectExposure.capsAndOffsets) ? projectExposure.capsAndOffsets.slice(0, 8) : [],
      doubleCountingWarnings: Array.isArray(projectExposure.doubleCountingWarnings) ? projectExposure.doubleCountingWarnings.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8) : [],
      missingInputs,
      mapsToRiskParameters: projectExposure.mapsToRiskParameters && typeof projectExposure.mapsToRiskParameters === 'object' ? projectExposure.mapsToRiskParameters : {},
      projectHorizon: buildProjectHorizonSummary(results?.projectHorizon, fmtCurrency),
      caveatSummary
    };
  }

  function buildPortfolioBoardBriefSource({
    scopeLabel = '',
    completedAssessments = [],
    topAssessments = [],
    flaggedAssessments = []
  } = {}) {
    const safeCompleted = Array.isArray(completedAssessments) ? completedAssessments : [];
    const safeTop = Array.isArray(topAssessments) ? topAssessments : [];
    const safeFlagged = Array.isArray(flaggedAssessments) ? flaggedAssessments : [];
    const totalAle = safeCompleted.reduce((sum, item) => sum + Number(item?.aleMean || 0), 0);
    const aboveTolerance = safeCompleted.filter(item => /above tolerance/i.test(String(item?.treatmentStatus || item?.postureLabel || ''))).length;
    const nearTolerance = safeCompleted.filter(item => /near tolerance|review/i.test(String(item?.treatmentStatus || item?.postureLabel || ''))).length;
    const currentYear = new Date().getFullYear();
    const topRiskLines = safeTop.map((item, index) => [
      `${index + 1}. ${String(item?.title || 'Untitled assessment').trim()}`,
      `ALE range: ${String(item?.aleRange || 'Not stated').trim()}`,
      `Treatment status: ${String(item?.treatmentStatus || 'Monitor').trim()}`,
      `Primary risk category: ${String(item?.primaryRiskCategory || 'General enterprise').trim()}`,
      `Last run date: ${String(item?.lastRunDate || 'Not stated').trim()}`
    ].join('\n'));
    const flaggedLines = safeFlagged.map((item, index) => [
      `${index + 1}. ${String(item?.title || 'Untitled assessment').trim()}`,
      `Flag reason: ${String(item?.reason || item?.detail || item?.statusNote || 'Needs fresh review').trim()}`,
      `Current posture: ${String(item?.treatmentStatus || item?.postureLabel || 'Monitor').trim()}`
    ].join('\n'));
    return [
      scopeLabel ? `Portfolio scope: ${String(scopeLabel).trim()}` : '',
      `Portfolio size: ${safeCompleted.length} completed assessments`,
      `Combined expected annual exposure: ${Number(totalAle || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
      `Current posture mix: ${aboveTolerance} above tolerance, ${nearTolerance} near tolerance or already in review, ${safeCompleted.length - aboveTolerance - nearTolerance} currently within tolerance`,
      `Calendar context: ${currentYear} board update for an Abu Dhabi-headquartered technology organisation with global operations and US regulatory exposure`,
      safeTop.length ? `Top risks by ALE:\n${topRiskLines.join('\n\n')}` : '',
      safeFlagged.length ? `Flagged or watchlist items:\n${flaggedLines.join('\n\n')}` : ''
    ].filter(Boolean).join('\n\n');
  }

  const exported = {
    clampNumber,
    cleanExecutiveNarrativeText,
    buildExecutiveScenarioSummary,
    detectCriticalCondition,
    buildExecutiveDecisionSupport,
    buildExecutiveConfidenceFrame,
    buildLifecycleNextStepPlan,
    buildExecutiveThresholdModel,
    buildExecutiveImpactMix,
    buildTreatmentDecisionSummary,
    buildAnalystAdvisorySummary,
    buildFastestReductionLever,
    buildMetricAnchorSentence,
    buildProjectResultsModel,
    buildReviewerBriefSource,
    buildPortfolioBoardBriefSource
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  return exported;
})();
