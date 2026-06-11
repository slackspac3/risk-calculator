(function(global) {
  'use strict';

  const ROLE_PRESENTATIONS = {
    standard_user: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This result needs attention now and should be reviewed with the person who owns the response.'
        : r.nearTolerance
          ? 'This result is close to tolerance and should be reviewed before it worsens.'
          : 'This result is within tolerance today, so the main task is to monitor and revisit it if conditions change.',
      executiveAction: r => r.toleranceBreached
        ? 'Review the result with your manager or risk owner and confirm the next response step.'
        : r.nearTolerance
          ? 'Check the main assumptions and agree the next improvement step with the owner of this area.'
          : 'Keep monitoring the scenario and update it when the threat, scope, or controls change.',
      annualView: r => r.annualReviewTriggered ? 'Annual review is worth scheduling.' : 'No annual review trigger is currently indicated.',
      executiveNoteTitle: 'What this means for you',
      executiveNote: 'Use the executive summary first. Open deeper detail only if you need to challenge the assumptions or explain the result to someone else.',
      technicalNoteTitle: 'How to use the technical view',
      technicalNote: 'Use this tab only when you need to understand the ranges, evidence, or model assumptions in more detail.',
      coreSummary: 'Show core numbers',
      aiSummary: 'Show how AI built this result'
    },
    function_admin: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This function-level scenario is above tolerance and needs action from the function owner now.'
        : r.nearTolerance
          ? 'This function-level scenario is close to tolerance and should be actively managed.'
          : 'This function-level scenario is within tolerance, but the owned function context should stay current.',
      executiveAction: r => r.toleranceBreached
        ? 'Confirm the immediate function-level response, owner, and control actions for this scenario.'
        : r.nearTolerance
          ? 'Review the main drivers for your function and agree a targeted reduction action.'
          : 'Keep the function context and assumptions current so future assessments stay grounded.',
      annualView: r => r.annualReviewTriggered ? 'A function-level annual review is warranted.' : 'No annual function review trigger is currently indicated.',
      executiveNoteTitle: 'What this means for your function',
      executiveNote: 'Focus first on what this result means for the function or department you own, then open deeper detail only when you need to validate the assumptions.',
      technicalNoteTitle: 'Function review view',
      technicalNote: 'Use this tab to validate drivers, assumptions, and evidence that affect the function context you own.',
      coreSummary: 'Show core function outputs',
      aiSummary: 'Show AI reasoning for this function result'
    },
    bu_admin: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This business-unit scenario is above tolerance and needs management action now.'
        : r.nearTolerance
          ? 'This business-unit scenario is close to tolerance and should be managed before it escalates.'
          : 'This business-unit scenario is within tolerance, but should stay under active review.',
      executiveAction: r => r.toleranceBreached
        ? 'Confirm the BU owner, escalation path, and immediate treatment actions for this scenario.'
        : r.nearTolerance
          ? 'Review the main drivers across the business unit and agree a targeted management response.'
          : 'Keep the BU context aligned and review again if conditions change materially.',
      annualView: r => r.annualReviewTriggered ? 'A business-unit annual review is warranted.' : 'No business-unit annual review trigger is currently indicated.',
      executiveNoteTitle: 'What this means for the business unit',
      executiveNote: 'Use this view to decide whether the business unit needs review, escalation, or updated context before more work starts.',
      technicalNoteTitle: 'Business unit review view',
      technicalNote: 'Use this tab for management review, challenge, and comparison across scenarios in the business unit.',
      coreSummary: 'Show core business-unit outputs',
      aiSummary: 'Show AI reasoning for this BU result'
    },
    bu_and_function: {
      executiveHeadline: r => r.toleranceBreached
        ? 'This scenario is above tolerance and needs both business-unit oversight and function-level action now.'
        : r.nearTolerance
          ? 'This scenario is close to tolerance and should be managed across the business unit and the owned function.'
          : 'This scenario is within tolerance, but both the BU and function context should stay aligned.',
      executiveAction: r => r.toleranceBreached
        ? 'Confirm the BU-level decision, then agree the immediate function-level response and control actions.'
        : r.nearTolerance
          ? 'Review the main drivers from both the BU and function perspective and agree the next action.'
          : 'Keep both the BU and function context current so new assessments stay aligned.',
      annualView: r => r.annualReviewTriggered ? 'A BU and function-level annual review is warranted.' : 'No annual review trigger is currently indicated for the BU or owned function.',
      executiveNoteTitle: 'What this means across your role',
      executiveNote: 'Use this view first for the BU-level decision, then check whether the owned function needs a more direct follow-up action.',
      technicalNoteTitle: 'Oversight and execution view',
      technicalNote: 'Use this tab when you need to challenge the assumptions from both the management and owned-function perspective.',
      coreSummary: 'Show core oversight outputs',
      aiSummary: 'Show AI reasoning and evidence'
    }
  };

  function resolveFreshnessTimestamp(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : (value > 1e9 ? value * 1000 : 0);
    const parsed = Date.parse(String(value || '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildAssessmentFreshnessWarning(assessment) {
    const referenceAt = [
      assessment?.lastRunAt,
      assessment?.savedAt,
      assessment?.completedAt,
      assessment?.lifecycleUpdatedAt,
      assessment?.createdAt
    ].map(resolveFreshnessTimestamp).find((value) => value > 0) || 0;
    if (!referenceAt) return '';
    const ageDays = Math.max(0, Math.floor((Date.now() - referenceAt) / 86400000));
    if (ageDays <= 30) return '';
    return `This assessment was last run ${ageDays} day${ageDays === 1 ? '' : 's'} ago. Consider re-running the simulation if conditions have changed.`;
  }

  function normaliseRuntimeResults(assessment, rawResults) {
    return {
      ...rawResults,
      lm: rawResults.lm || rawResults.eventLoss || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
      eventLoss: rawResults.eventLoss || rawResults.lm || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
      ale: rawResults.ale || rawResults.annualLoss || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
      annualLoss: rawResults.annualLoss || rawResults.ale || { mean: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 },
      toleranceDetail: rawResults.toleranceDetail && typeof rawResults.toleranceDetail === 'object'
        ? rawResults.toleranceDetail
        : null,
      annualReviewDetail: rawResults.annualReviewDetail || { annualExceedProb: 0, annualP90: 0 },
      projectHorizon: rawResults.projectHorizon && typeof rawResults.projectHorizon === 'object'
        ? rawResults.projectHorizon
        : null,
      metricSemantics: rawResults.metricSemantics || {
        eventLoss: 'Conditional loss if a materially successful event occurs.',
        annualLoss: 'Annualized loss across the year after event frequency is applied.'
      },
      histogram: Array.isArray(rawResults.histogram) ? rawResults.histogram : [],
      lec: Array.isArray(rawResults.lec) ? rawResults.lec : [],
      warningThreshold: Number(rawResults.warningThreshold || getWarningThreshold() || 0),
      threshold: Number(rawResults.threshold || getToleranceThreshold() || 0),
      annualReviewThreshold: Number(rawResults.annualReviewThreshold || getAnnualReviewThreshold() || 0),
      iterations: Number(rawResults.iterations || rawResults.runMetadata?.iterations || assessment.fairParams?.iterations || 0),
      distType: rawResults.runMetadata?.distributions?.eventModel || rawResults.runConfig?.distType || assessment.fairParams?.distType || 'triangular'
    };
  }

  function resolveResultsRolePresentation(capability) {
    const roleMode = capability?.canManageBusinessUnit && capability?.canManageDepartment
      ? 'bu_and_function'
      : capability?.canManageBusinessUnit
        ? 'bu_admin'
        : capability?.canManageDepartment
          ? 'function_admin'
          : 'standard_user';
    return {
      roleMode,
      rolePresentation: ROLE_PRESENTATIONS[roleMode]
    };
  }

  function cleanCockpitText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function humanizeCockpitToken(value, fallback = 'Not stated') {
    const text = cleanCockpitText(value);
    if (!text) return fallback;
    return text
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function normaliseCockpitAssessmentType(value) {
    const text = cleanCockpitText(value).toLowerCase();
    if (text === 'project_buyer' || text === 'project_seller') return text;
    return 'enterprise_generic';
  }

  function uniqueCockpitStrings(items = [], limit = 8) {
    const seen = new Set();
    const output = [];
    (Array.isArray(items) ? items : [items]).forEach(item => {
      const text = cleanCockpitText(
        typeof item === 'string'
          ? item
          : item?.label || item?.field || item?.driver || item?.title || item?.item || item?.claim || ''
      );
      if (!text || seen.has(text.toLowerCase())) return;
      seen.add(text.toLowerCase());
      output.push(text);
    });
    return output.slice(0, Math.max(0, Number(limit) || 0));
  }

  function normalizeCockpitValueItems(items = [], limit = 6) {
    return (Array.isArray(items) ? items : [])
      .map(item => {
        const label = cleanCockpitText(item?.label || item?.field || item?.title || '');
        const value = cleanCockpitText(item?.value || item?.rangeLabel || item?.status || '');
        if (!label && !value) return null;
        return {
          label: label || value,
          value,
          status: cleanCockpitText(item?.status || item?.statusLabel || item?.sourceStatus || 'known'),
          confidence: cleanCockpitText(item?.confidence || 'unknown'),
          source: cleanCockpitText(item?.source || '')
        };
      })
      .filter(Boolean)
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function formatCockpitPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : 'Not computable';
  }

  function buildCockpitBadge(label, value, tone = 'neutral') {
    return {
      label: cleanCockpitText(label),
      value: cleanCockpitText(value, 'Not stated'),
      tone: cleanCockpitText(tone, 'neutral')
    };
  }

  function resolveCockpitPostureTone(posture = '') {
    const text = cleanCockpitText(posture).toLowerCase();
    if (/reject|escalate|above|critical/.test(text)) return 'danger';
    if (/defer|evidence|review|attention|near|control/.test(text)) return 'warning';
    if (/proceed|within|ready|approved/.test(text)) return 'success';
    return 'neutral';
  }

  function buildCockpitEvidenceConfidence(assessment = {}) {
    const evidenceMap = assessment?.evidenceMap && typeof assessment.evidenceMap === 'object' ? assessment.evidenceMap : null;
    const citations = Array.isArray(assessment?.citations) ? assessment.citations.filter(Boolean) : [];
    const contradictions = Array.isArray(evidenceMap?.contradictions) ? evidenceMap.contradictions.filter(Boolean) : [];
    const unsupported = Array.isArray(evidenceMap?.unsupportedClaims) ? evidenceMap.unsupportedClaims.filter(Boolean) : [];
    const strong = Array.isArray(evidenceMap?.citationQuality?.strong) ? evidenceMap.citationQuality.strong.filter(Boolean) : [];
    const weak = Array.isArray(evidenceMap?.citationQuality?.weak) ? evidenceMap.citationQuality.weak.filter(Boolean) : [];
    if (contradictions.length) return { label: 'Contradicted evidence', tone: 'danger' };
    if (strong.length) return { label: 'Evidence supported', tone: 'success' };
    if (unsupported.length || weak.length || citations.length) return { label: 'Partial evidence', tone: 'warning' };
    return { label: 'No evidence', tone: 'neutral' };
  }

  function buildCockpitAssumptionConfidence(assessment = {}, assessmentIntelligence = {}) {
    const register = assessment?.assumptionRegister && typeof assessment.assumptionRegister === 'object'
      ? assessment.assumptionRegister
      : null;
    const confidence = cleanCockpitText(register?.overallConfidence || assessmentIntelligence?.confidence?.label || '');
    const assumptions = Array.isArray(register?.assumptions)
      ? register.assumptions
      : (Array.isArray(assessmentIntelligence?.assumptions) ? assessmentIntelligence.assumptions : []);
    if (confidence) {
      const tone = /high|strong/i.test(confidence) ? 'success' : /low|weak|unknown/i.test(confidence) ? 'warning' : 'neutral';
      return { label: humanizeCockpitToken(confidence, 'Working assumptions'), tone };
    }
    return assumptions.length
      ? { label: 'Assumptions listed', tone: 'neutral' }
      : { label: 'No assumptions', tone: 'warning' };
  }

  function buildCockpitCurrentFingerprints(assessment = {}, r = {}) {
    const service = global.AiProductStateService;
    if (!service || typeof service.buildFingerprint !== 'function') return {};
    const scenario = {
      assessmentType: assessment?.assessmentType || 'enterprise_generic',
      scenario: assessment?.enhancedNarrative || assessment?.narrative || assessment?.scenarioTitle || '',
      structuredScenario: assessment?.structuredScenario || {},
      scenarioLens: assessment?.scenarioLens || {}
    };
    const project = {
      assessmentType: assessment?.assessmentType || 'enterprise_generic',
      projectContext: assessment?.projectContext || {},
      buyerEconomics: assessment?.buyerEconomics || {},
      buyerEconomicsMeta: assessment?.buyerEconomicsMeta || {},
      sellerEconomics: assessment?.sellerEconomics || {},
      sellerEconomicsMeta: assessment?.sellerEconomicsMeta || {},
      buyerProxyQuestions: assessment?.buyerProxyQuestions || {},
      sellerProxyQuestions: assessment?.sellerProxyQuestions || {}
    };
    const parameters = assessment?.fairParams || r?.inputs || {};
    const simulation = {
      eventLoss: r?.eventLoss || r?.lm || {},
      annualLoss: r?.annualLoss || r?.ale || {},
      projectHorizon: r?.projectHorizon || {}
    };
    return {
      projectExposure: service.buildFingerprint(project),
      assumptionRegister: service.buildFingerprint({
        ...scenario,
        projectExposure: assessment?.projectExposure || {},
        parameters,
        results: simulation,
        citations: assessment?.citations || []
      }),
      parameterCoach: service.buildFingerprint({
        ...scenario,
        projectExposure: assessment?.projectExposure || {},
        parameters,
        evidenceMap: assessment?.evidenceMap || {},
        citations: assessment?.citations || []
      }),
      evidenceMap: service.buildFingerprint({
        ...scenario,
        projectExposure: assessment?.projectExposure || {},
        citations: assessment?.citations || [],
        primaryGrounding: assessment?.primaryGrounding || [],
        supportingReferences: assessment?.supportingReferences || []
      }),
      decisionChallenge: service.buildFingerprint({
        ...scenario,
        projectExposure: assessment?.projectExposure || {},
        parameters,
        simulation,
        assumptionRegister: assessment?.assumptionRegister || {},
        parameterCoach: assessment?.parameterCoach || {},
        evidenceMap: assessment?.evidenceMap || {}
      }),
      decisionBrief: service.buildFingerprint({
        ...scenario,
        projectExposure: assessment?.projectExposure || {},
        simulation,
        assumptionRegister: assessment?.assumptionRegister || {},
        parameterCoach: assessment?.parameterCoach || {},
        evidenceMap: assessment?.evidenceMap || {},
        decisionChallenge: assessment?.decisionChallenge || {}
      })
    };
  }

  function buildCockpitAiJourney(assessment = {}, r = {}) {
    const service = global.AiProductStateService;
    if (!service || typeof service.buildAssessmentAiState !== 'function') return null;
    return service.buildAssessmentAiState(assessment, {
      currentFingerprints: buildCockpitCurrentFingerprints(assessment, r)
    });
  }

  function buildCockpitAiMode(assessment = {}, aiJourney = null) {
    if (aiJourney && typeof aiJourney === 'object') {
      return { label: aiJourney.modeLabel || 'No AI outputs', tone: aiJourney.tone || 'neutral' };
    }
    const metaCandidates = [
      assessment?.decisionBriefMeta,
      assessment?.decisionChallengeMeta,
      assessment?.projectExposureMeta,
      assessment?.assumptionRegisterMeta,
      assessment?.parameterCoachMeta,
      assessment?.evidenceMapMeta
    ].filter(item => item && typeof item === 'object');
    const hasOutputs = !!(
      assessment?.decisionBrief
      || assessment?.decisionChallenge
      || assessment?.assumptionRegister
      || assessment?.parameterCoach
      || assessment?.evidenceMap
      || assessment?.projectExposure
    );
    if (!metaCandidates.length && !hasOutputs) return { label: 'No AI outputs', tone: 'neutral' };
    const modes = metaCandidates.map(meta => cleanCockpitText(meta.mode || (meta.usedFallback ? 'fallback' : ''))).filter(Boolean);
    const hasFallback = modes.some(mode => /fallback|deterministic/i.test(mode)) || metaCandidates.some(meta => meta.usedFallback === true);
    const hasLive = modes.some(mode => /live|ai/i.test(mode) && !/fallback/i.test(mode));
    if (hasLive && hasFallback) return { label: 'Mixed AI/fallback', tone: 'warning' };
    if (hasLive) return { label: 'Live AI', tone: 'success' };
    if (hasFallback) return { label: 'Deterministic fallback', tone: 'warning' };
    return { label: hasOutputs ? 'Saved support outputs' : 'No AI outputs', tone: hasOutputs ? 'neutral' : 'warning' };
  }

  function buildCockpitChallengeSummary(assessment = {}) {
    const challenge = assessment?.decisionChallenge && typeof assessment.decisionChallenge === 'object'
      ? assessment.decisionChallenge
      : null;
    const changedDecisionIf = Array.isArray(challenge?.changedDecisionIf)
      ? challenge.changedDecisionIf.map(item => cleanCockpitText(item?.condition || item?.reason || item)).filter(Boolean)
      : [];
    const decisionRisks = Array.isArray(challenge?.decisionRisks)
      ? challenge.decisionRisks.map(item => ({
          title: cleanCockpitText(item?.title || 'Decision risk'),
          severity: cleanCockpitText(item?.severity || 'medium'),
          explanation: cleanCockpitText(item?.explanation || item?.recommendedAction || '')
        })).filter(item => item.title).slice(0, 3)
      : [];
    const stressTests = Array.isArray(challenge?.recommendedStressTests)
      ? challenge.recommendedStressTests.map(item => ({
          id: cleanCockpitText(item?.id || item?.title || ''),
          title: cleanCockpitText(item?.title || 'Stress case'),
          rationale: cleanCockpitText(item?.rationale || item?.expectedDecisionImpact || ''),
          confidence: cleanCockpitText(item?.confidence || 'medium')
        })).filter(item => item.title).slice(0, 2)
      : [];
    return {
      saved: !!challenge,
      summary: cleanCockpitText(challenge?.challengeSummary || ''),
      changedDecisionIf: changedDecisionIf.slice(0, 3),
      decisionRisks,
      stressTests
    };
  }

  function buildDecisionCockpitModel({
    assessment = {},
    r = {},
    projectResultsModel = null,
    decisionBrief = null,
    executiveDecision = {},
    confidenceFrame = {},
    evidenceGapPlan = [],
    assessmentIntelligence = {},
    lifecycle = {},
    statusTitle = '',
    executiveAction = ''
  } = {}) {
    const assessmentType = normaliseCockpitAssessmentType(assessment?.assessmentType || projectResultsModel?.assessmentType);
    const isProject = assessmentType === 'project_buyer' || assessmentType === 'project_seller';
    const typeLabel = assessmentType === 'project_buyer'
      ? 'Project risk - buyer'
      : assessmentType === 'project_seller'
        ? 'Project risk - seller'
        : 'Generic enterprise risk';
    const quant = decisionBrief?.quantSummary && typeof decisionBrief.quantSummary === 'object' ? decisionBrief.quantSummary : {};
    const projectQuant = decisionBrief?.projectQuantSummary && typeof decisionBrief.projectQuantSummary === 'object' ? decisionBrief.projectQuantSummary : {};
    const posture = cleanCockpitText(decisionBrief?.decisionPosture || executiveDecision?.decision || statusTitle || 'review');
    const postureLabel = humanizeCockpitToken(posture, 'Review');
    const postureTone = resolveCockpitPostureTone(`${posture} ${statusTitle}`);
    const challenge = buildCockpitChallengeSummary(assessment);
    const aiJourney = buildCockpitAiJourney(assessment, r);
    const knownValues = normalizeCockpitValueItems(projectResultsModel?.knownValues, 6);
    const estimatedValues = normalizeCockpitValueItems(projectResultsModel?.estimatedValues, 6);
    const proxyDriverValues = (Array.isArray(projectResultsModel?.driverGroups?.proxyEstimated) ? projectResultsModel.driverGroups.proxyEstimated : [])
      .map(item => ({
        label: cleanCockpitText(item?.label || 'Proxy driver'),
        value: cleanCockpitText(item?.rangeLabel || 'Proxy range'),
        status: cleanCockpitText(item?.statusLabel || 'benchmark proxy'),
        confidence: cleanCockpitText(item?.confidence || 'low'),
        source: cleanCockpitText(item?.source || 'benchmark')
      }))
      .slice(0, 4);
    const proxyValuesUsed = uniqueCockpitStrings([
      ...(Array.isArray(projectQuant.proxyValuesUsed) ? projectQuant.proxyValuesUsed : []),
      ...proxyDriverValues.map(item => `${item.label}: ${item.value}`)
    ], 8);
    const unknownHighImpactValues = uniqueCockpitStrings([
      ...(Array.isArray(projectQuant.unknownHighImpactInputs) ? projectQuant.unknownHighImpactInputs : []),
      ...(Array.isArray(projectResultsModel?.unknownHighImpactValues) ? projectResultsModel.unknownHighImpactValues : []),
      ...(Array.isArray(projectResultsModel?.decisionSensitiveUnknowns) ? projectResultsModel.decisionSensitiveUnknowns : [])
    ], 8);
    const mainDriverCandidates = [
      ...(Array.isArray(decisionBrief?.mainDrivers) ? decisionBrief.mainDrivers.map(item => item?.driver || item?.impact || item) : []),
      projectQuant.primaryProjectDriver,
      ...(Array.isArray(projectResultsModel?.driverGroups?.quantified) ? projectResultsModel.driverGroups.quantified.map(item => item.label) : []),
      ...(Array.isArray(projectResultsModel?.driverGroups?.proxyEstimated) ? projectResultsModel.driverGroups.proxyEstimated.map(item => item.label) : []),
      ...(Array.isArray(projectResultsModel?.driverGroups?.unquantified) ? projectResultsModel.driverGroups.unquantified.map(item => item.label) : []),
      ...(Array.isArray(assessmentIntelligence?.drivers?.upward) ? assessmentIntelligence.drivers.upward : [])
    ];
    const mainDriver = uniqueCockpitStrings(mainDriverCandidates, 1)[0] || 'Main driver not identified yet';
    const nextAction = decisionBrief?.nextAction && typeof decisionBrief.nextAction === 'object'
      ? {
          owner: cleanCockpitText(decisionBrief.nextAction.owner || 'Owner not set'),
          action: cleanCockpitText(decisionBrief.nextAction.action || executiveAction || executiveDecision?.priority || 'Confirm the next management step.'),
          due: cleanCockpitText(decisionBrief.nextAction.due || ''),
          controlOrTreatment: cleanCockpitText(decisionBrief.nextAction.controlOrTreatment || '')
        }
      : {
          owner: 'Owner not set',
          action: cleanCockpitText(executiveAction || executiveDecision?.priority || 'Confirm the next management step.'),
          due: '',
          controlOrTreatment: ''
        };
    const projectHorizon = projectResultsModel?.projectHorizon && typeof projectResultsModel.projectHorizon === 'object'
      ? projectResultsModel.projectHorizon
      : null;
    const findValue = (...patterns) => {
      const pool = [...knownValues, ...estimatedValues, ...proxyDriverValues];
      return pool.find(item => patterns.some(pattern => new RegExp(pattern, 'i').test(`${item.label} ${item.status}`))) || null;
    };
    const spendOrBudget = findValue('spend', 'budget');
    const contractOrRevenue = findValue('contract', 'revenue');
    const margin = findValue('margin');
    const projectDriverLabel = cleanCockpitText(projectQuant.primaryProjectDriver || mainDriver);
    const metrics = isProject
      ? (assessmentType === 'project_buyer'
          ? [
              { label: 'Project spend / budget', value: spendOrBudget?.value || 'Unknown', copy: spendOrBudget ? `${humanizeCockpitToken(spendOrBudget.status)} input` : 'No confirmed spend or budget denominator yet.', tone: spendOrBudget ? 'success' : 'warning' },
              { label: 'Project-horizon loss', value: projectHorizon?.enabled ? projectHorizon.p90Loss : 'Not computed', copy: projectHorizon?.enabled ? `${projectHorizon.eventProbabilityLabel} event probability over ${projectHorizon.durationLabel}` : (projectHorizon?.skippedReason || 'Duration or value source status is not usable yet.'), tone: projectHorizon?.enabled ? 'warning' : 'neutral', explain: projectHorizon?.enabled ? 'projectHorizon.loss.p90' : '' },
              { label: 'Loss as % of spend/budget', value: projectHorizon?.lossAsPctOfProjectValueLabel || 'Not computable', copy: 'Only shown when the denominator is known, estimated, derived, or proxied.', tone: projectHorizon?.lossAsPctOfProjectValueLabel ? 'neutral' : 'warning', explain: projectHorizon?.lossAsPctOfProjectValueLabel ? 'projectHorizon.lossAsPctOfProjectValue' : '' },
              { label: 'Main project driver', value: projectDriverLabel, copy: unknownHighImpactValues.length ? 'High-impact unknowns remain visible below.' : 'No high-impact unknowns currently flagged.', tone: 'neutral' }
            ]
          : [
              { label: 'Contract / revenue context', value: contractOrRevenue?.value || 'Unknown', copy: contractOrRevenue ? `${humanizeCockpitToken(contractOrRevenue.status)} input` : 'No confirmed contract value or revenue denominator yet.', tone: contractOrRevenue ? 'success' : 'warning' },
              { label: 'Project-horizon loss', value: projectHorizon?.enabled ? projectHorizon.p90Loss : 'Not computed', copy: projectHorizon?.enabled ? `${projectHorizon.eventProbabilityLabel} event probability over ${projectHorizon.durationLabel}` : (projectHorizon?.skippedReason || 'Duration or margin/value source status is not usable yet.'), tone: projectHorizon?.enabled ? 'warning' : 'neutral', explain: projectHorizon?.enabled ? 'projectHorizon.loss.p90' : '' },
              { label: 'Loss as % of margin', value: projectHorizon?.lossAsPctOfMarginLabel || 'Not computable', copy: margin ? `${humanizeCockpitToken(margin.status)} margin basis` : 'Margin denominator is unavailable or not usable yet.', tone: projectHorizon?.lossAsPctOfMarginLabel ? 'neutral' : 'warning', explain: projectHorizon?.lossAsPctOfMarginLabel ? 'projectHorizon.lossAsPctOfMargin' : '' },
              { label: 'LD / SLA / cost-to-cure driver', value: projectDriverLabel, copy: unknownHighImpactValues.length ? 'Unknown caps or margin can change the decision.' : 'No high-impact unknowns currently flagged.', tone: 'neutral' }
            ])
      : [
          { label: 'Event loss', value: fmtCurrency(quant.eventLossP90 ?? r?.eventLoss?.p90 ?? r?.lm?.p90 ?? 0), copy: 'Severe single-event management view.', tone: postureTone, explain: 'eventLoss.p90' },
          { label: 'Annualized loss', value: fmtCurrency(quant.annualLossMean ?? r?.annualLoss?.mean ?? r?.ale?.mean ?? 0), copy: 'Expected annual planning view.', tone: 'neutral', explain: 'annualLoss.mean' },
          { label: 'Main driver', value: mainDriver, copy: 'Primary factor behind the current read.', tone: 'neutral' },
          { label: 'Next action', value: nextAction.action, copy: nextAction.owner, tone: 'success' }
        ];
    const evidenceConfidence = buildCockpitEvidenceConfidence(assessment);
    const assumptionConfidence = buildCockpitAssumptionConfidence(assessment, assessmentIntelligence);
    const aiMode = buildCockpitAiMode(assessment, aiJourney);
    const inputQualityLabel = isProject
      ? cleanCockpitText(projectResultsModel?.inputQuality?.label || 'Thin project economics')
      : 'Enterprise input set';
    const inputQualityTone = /strong|usable/i.test(inputQualityLabel) ? 'success' : /thin|unknown|missing/i.test(inputQualityLabel) ? 'warning' : 'neutral';
    const valuationMode = isProject
      ? cleanCockpitText(assessment?.projectExposure?.valuationMode || projectResultsModel?.valuationMode || 'hybrid')
      : 'benchmark_led';
    const evidenceGaps = uniqueCockpitStrings([
      ...(Array.isArray(evidenceGapPlan) ? evidenceGapPlan : []),
      ...(Array.isArray(assessment?.evidenceMap?.unsupportedClaims) ? assessment.evidenceMap.unsupportedClaims : []),
      ...(Array.isArray(assessment?.assumptionRegister?.missingEvidence) ? assessment.assumptionRegister.missingEvidence : [])
    ], 5);
    const assumptions = uniqueCockpitStrings(
      Array.isArray(assessment?.assumptionRegister?.assumptions)
        ? assessment.assumptionRegister.assumptions.map(item => item?.statement || item)
        : (Array.isArray(assessmentIntelligence?.assumptions) ? assessmentIntelligence.assumptions.map(item => item?.text || item) : []),
      4
    );
    const emptyStates = [];
    if (aiMode.label === 'No AI outputs') emptyStates.push({ key: 'no_ai', label: 'No AI configured', copy: 'Deterministic outputs are still shown where available.' });
    if (evidenceConfidence.label === 'No evidence') emptyStates.push({ key: 'no_evidence', label: 'No evidence', copy: 'Evidence gaps remain visible instead of being treated as support.' });
    if (isProject && !knownValues.length && !estimatedValues.length && !unknownHighImpactValues.length) emptyStates.push({ key: 'no_project_economics', label: 'No project economics', copy: 'Project economics have not been supplied yet; unknowns are not treated as zero.' });
    if (isProject && (/thin/i.test(inputQualityLabel) || unknownHighImpactValues.length)) emptyStates.push({ key: 'thin_project_economics', label: 'Thin project economics', copy: 'The estimate is directional until key values are confirmed.' });
    if (!assumptions.length) emptyStates.push({ key: 'no_assumptions', label: 'No assumptions', copy: 'No structured assumption register has been saved yet.' });
    if (!challenge.saved) emptyStates.push({ key: 'no_challenge', label: 'No challenge', copy: 'Run the Challenge Agent to capture decision-sensitive stress cases.' });

    return {
      assessmentType,
      assessmentTypeLabel: typeLabel,
      isProject,
      role: assessmentType === 'project_seller' ? 'seller' : assessmentType === 'project_buyer' ? 'buyer' : 'generic',
      valuationModeLabel: humanizeCockpitToken(valuationMode, 'Benchmark Led'),
      recommendation: cleanCockpitText(decisionBrief?.recommendation || executiveDecision?.decision || statusTitle || 'Review result'),
      why: cleanCockpitText(decisionBrief?.why || executiveDecision?.rationale || confidenceFrame?.summary || 'Use the current result as a decision-support view and confirm the strongest assumptions.'),
      decisionPostureLabel: postureLabel,
      decisionPostureTone: postureTone,
      reviewReadinessLabel: cleanCockpitText(lifecycle?.label || 'Ready for review'),
      evidenceConfidence,
      assumptionConfidence,
      aiMode,
      aiJourney,
      inputQualityLabel,
      inputQualityScore: Number.isFinite(Number(projectResultsModel?.inputQuality?.score)) ? Number(projectResultsModel.inputQuality.score) : null,
      inputQualityTone,
      proxyValuesUsed,
      unknownHighImpactValues,
      knownValues,
      estimatedValues: [...estimatedValues, ...proxyDriverValues].slice(0, 8),
      economicsMetrics: metrics,
      mainDriver,
      nextAction,
      evidenceGaps,
      assumptions,
      challenge,
      sparseDataWarning: cleanCockpitText(decisionBrief?.sparseDataWarning || (isProject && unknownHighImpactValues.length ? 'Project economics are thin. The estimate is directional until key values are confirmed.' : '')),
      emptyStates,
      badges: [
        buildCockpitBadge('Assessment type', typeLabel, isProject ? 'support' : 'neutral'),
        buildCockpitBadge('Valuation mode', humanizeCockpitToken(valuationMode, 'Benchmark Led'), isProject ? 'support' : 'neutral'),
        buildCockpitBadge('Project input quality', inputQualityLabel, inputQualityTone),
        buildCockpitBadge('Decision posture', postureLabel, postureTone),
        buildCockpitBadge('Evidence confidence', evidenceConfidence.label, evidenceConfidence.tone),
        buildCockpitBadge('Assumption confidence', assumptionConfidence.label, assumptionConfidence.tone),
        buildCockpitBadge('AI mode', aiMode.label, aiMode.tone),
        buildCockpitBadge('Proxy values used', proxyValuesUsed.length ? String(proxyValuesUsed.length) : 'None', proxyValuesUsed.length ? 'warning' : 'neutral'),
        buildCockpitBadge('Review readiness', cleanCockpitText(lifecycle?.label || 'Ready for review'), 'neutral')
      ]
    };
  }

  function buildResultsRenderModel(assessment, { isShared = false } = {}) {
    const currentUser = AuthService.getCurrentUser();
    const capability = (!isShared && currentUser && currentUser.role !== 'admin')
      ? getNonAdminCapabilityState(currentUser, getUserSettings(), getAdminSettings())
      : null;
    const { rolePresentation } = resolveResultsRolePresentation(capability);
    const rawResults = hydrateResultsRuntimeState(assessment);
    const r = normaliseRuntimeResults(assessment, rawResults);
    const requestedTab = String(AppState.resultsTab || 'executive');
    const activeTab = ['executive', 'technical', 'appendix'].includes(requestedTab) ? requestedTab : 'executive';
    const boardroomMode = !!AppState.resultsBoardroomMode;
    const criticalCondition = typeof ReportPresentation.detectCriticalCondition === 'function'
      ? ReportPresentation.detectCriticalCondition(assessment)
      : null;
    if (criticalCondition) r.criticalCondition = criticalCondition;
    const statusClass = criticalCondition ? 'above' : r.toleranceBreached ? 'above' : r.nearTolerance ? 'warning' : 'within';
    const statusIcon = criticalCondition ? (criticalCondition.statusIcon || '!') : r.toleranceBreached ? '🔴' : r.nearTolerance ? '🟠' : '🟢';
    const statusTitle = criticalCondition ? criticalCondition.statusTitle : r.toleranceBreached ? 'Needs leadership action' : r.nearTolerance ? 'Needs management attention' : 'Within current tolerance';
    const statusDetail = criticalCondition
      ? `${criticalCondition.statusDetail} Conditional event-loss P90 is ${fmtCurrency(r.eventLoss.p90)} against a tolerance threshold of ${fmtCurrency(r.threshold)}.`
      : r.toleranceBreached
        ? `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} is above the tolerance threshold of ${fmtCurrency(r.threshold)}.`
        : r.nearTolerance
          ? `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} is above the warning trigger of ${fmtCurrency(r.warningThreshold)} but still below tolerance.`
          : `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} remains below the warning trigger of ${fmtCurrency(r.warningThreshold)}.`;
    const executiveHeadline = criticalCondition?.headline || rolePresentation.executiveHeadline(r);
    const executiveAction = criticalCondition?.action || rolePresentation.executiveAction(r);
    const executiveAnnualView = criticalCondition
      ? 'Review is required because a hard response condition is open, independent of the annual-loss trigger.'
      : rolePresentation.annualView(r);
    const scenarioScopeSummary = r.portfolioMeta?.linked
      ? `${r.selectedRiskCount || assessment.selectedRisks?.length || 1} linked risks are being treated as one connected scenario.`
      : `${r.selectedRiskCount || assessment.selectedRisks?.length || 1} risks are being assessed together without linked uplift.`;
    const hasToleranceData = r?.toleranceDetail != null
      && typeof r.toleranceDetail.lmExceedProb === 'number';
    const exceedancePct = hasToleranceData
      ? (r.toleranceDetail.lmExceedProb * 100).toFixed(1)
      : null;
    const completedLabel = new Date(assessment.completedAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' });
    const assessmentFreshnessWarning = buildAssessmentFreshnessWarning(assessment);
    const lifecycle = getAssessmentLifecyclePresentation(assessment);
    const scenarioNarrative = ReportPresentation.buildExecutiveScenarioSummary(assessment) || 'No scenario narrative available.';
    const technicalInputs = r.inputs || assessment.fairParams || {};
    const runMetadata = rawResults.runMetadata || (rawResults.runConfig ? RiskEngine.createRunMetadata({
      ...technicalInputs,
      seed: rawResults.runConfig.seed,
      iterations: rawResults.runConfig.iterations,
      distType: rawResults.runConfig.distType,
      threshold: rawResults.runConfig.threshold,
      annualReviewThreshold: rawResults.runConfig.annualReviewThreshold,
      vulnDirect: rawResults.runConfig.vulnDirect,
      secondaryEnabled: rawResults.runConfig.secondaryEnabled,
      corrBiIr: rawResults.runConfig.corrBiIr,
      corrRlRc: rawResults.runConfig.corrRlRc,
      assessmentType: rawResults.runConfig.assessmentType || assessment.assessmentType,
      projectHorizonEnabled: rawResults.runConfig.projectHorizonEnabled,
      projectDurationMonths: rawResults.runConfig.projectDurationMonths,
      projectDurationSourceStatus: rawResults.runConfig.projectDurationSourceStatus,
      projectDurationConfidence: rawResults.runConfig.projectDurationConfidence,
      projectHorizonYears: rawResults.runConfig.projectHorizonYears,
      projectValue: rawResults.runConfig.projectValue,
      projectValueSourceStatus: rawResults.runConfig.projectValueSourceStatus,
      projectMargin: rawResults.runConfig.projectMargin,
      projectMarginSourceStatus: rawResults.runConfig.projectMarginSourceStatus
    }, {
      scenarioMultipliers: rawResults.portfolioMeta || {},
      warningThreshold: rawResults.warningThreshold,
      thresholdConfigUsed: {
        warningThreshold: rawResults.warningThreshold,
        eventToleranceThreshold: rawResults.threshold,
        annualReviewThreshold: rawResults.annualReviewThreshold
      }
    }) : null);
    const workflowGuidance = Array.isArray(assessment.workflowGuidance) ? assessment.workflowGuidance : [];
    const recommendations = Array.isArray(assessment.recommendations) ? assessment.recommendations : [];
    const citations = Array.isArray(assessment.citations) ? assessment.citations : [];
    const primaryGrounding = Array.isArray(assessment.primaryGrounding) ? assessment.primaryGrounding : [];
    const supportingReferences = Array.isArray(assessment.supportingReferences) ? assessment.supportingReferences : [];
    const inferredAssumptions = Array.isArray(assessment.inferredAssumptions) ? assessment.inferredAssumptions : [];
    const missingInformation = Array.isArray(assessment.missingInformation) ? assessment.missingInformation : [];
    const assessmentIntelligence = assessment.assessmentIntelligence || buildAssessmentIntelligence(assessment, r, technicalInputs, r.portfolioMeta || {});
    const evidenceGapPlan = buildEvidenceGapActionPlan({
      confidenceLabel: assessment.confidenceLabel,
      evidenceQuality: assessment.evidenceQuality,
      missingInformation,
      primaryGrounding,
      supportingReferences,
      inputProvenance: assessment.inputProvenance,
      inferredAssumptions,
      citations,
      assumptions: Array.isArray(assessmentIntelligence?.assumptions) ? assessmentIntelligence.assumptions : []
    });
    const assessmentChallenge = assessment.assessmentChallenge || null;
    const executiveDecision = ReportPresentation.buildExecutiveDecisionSupport(assessment, r, assessmentIntelligence);
    const confidenceFrame = ReportPresentation.buildExecutiveConfidenceFrame(assessmentIntelligence.confidence, assessment.evidenceQuality, missingInformation, citations);
    const thresholdModel = ReportPresentation.buildExecutiveThresholdModel(r, fmtCurrency);
    const impactMix = ReportPresentation.buildExecutiveImpactMix(technicalInputs);
    const projectResultsModel = typeof ReportPresentation.buildProjectResultsModel === 'function'
      ? ReportPresentation.buildProjectResultsModel(assessment, r, fmtCurrency)
      : null;
    const decisionBrief = assessment.decisionBrief && typeof assessment.decisionBrief === 'object'
      ? (typeof DecisionSupportModel !== 'undefined' && DecisionSupportModel?.buildDecisionBrief
          ? DecisionSupportModel.buildDecisionBrief(assessment.decisionBrief)
          : assessment.decisionBrief)
      : null;
    const comparisonOptions = getAssessments()
      .filter(item => deriveAssessmentLifecycleStatus(item) !== ASSESSMENT_LIFECYCLE_STATUS.ARCHIVED && item.id !== assessment.id && item.results)
      .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())
      .slice(0, 12)
      .map(item => ({
        id: item.id,
        label: `${typeof resolveScenarioDisplayTitle === 'function' ? resolveScenarioDisplayTitle(item) : (item.scenarioTitle || 'Untitled assessment')} · ${item.buName || '—'} · ${new Date(item.completedAt || item.createdAt || Date.now()).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}`
      }));
    const activeComparisonId = AppState.resultsComparisonId || assessment.comparisonBaselineId || '';
    const baselineAssessment = activeComparisonId ? getAssessmentById(activeComparisonId) : null;
    const comparison = baselineAssessment ? buildAssessmentComparison(assessment, baselineAssessment) : null;
    const nextStepPlan = ReportPresentation.buildLifecycleNextStepPlan({
      lifecycle,
      results: r,
      executiveDecision,
      comparison,
      confidenceFrame,
      missingInformation
    });
    const recommendationCards = renderResultsActionBlock(recommendations, executiveAction, missingInformation, nextStepPlan);
    const confidenceNeedsBlock = renderResultsConfidenceNeedsBlock(confidenceFrame, assessment.evidenceQuality, missingInformation, citations, baselineAssessment);
    const comparisonHighlight = renderResultsComparisonHighlight(comparison);
    const treatmentRecommendationLens = renderTreatmentRecommendationLens(comparison, recommendations, executiveDecision, nextStepPlan);
    const explanationPanel = renderResultsExplanationPanel(assessmentIntelligence, comparison, runMetadata);
    const analystSummary = ReportPresentation.buildAnalystAdvisorySummary({
      assessment,
      results: r,
      executiveDecision,
      confidenceFrame,
      comparison,
      missingInformation,
      lifecycle
    });
    const assessmentValue = typeof ValueQuantService !== 'undefined'
      ? ValueQuantService.buildAssessmentValueModel(assessment, {
          assessments: getAssessments(),
          benchmarkSettings: getAdminSettings().valueBenchmarkSettings
        })
      : null;
    const decisionCockpitModel = buildDecisionCockpitModel({
      assessment,
      r,
      projectResultsModel,
      decisionBrief,
      executiveDecision,
      confidenceFrame,
      evidenceGapPlan,
      assessmentIntelligence,
      lifecycle,
      statusTitle,
      executiveAction
    });
    return {
      capability,
      rolePresentation,
      rawResults,
      r,
      activeTab,
      boardroomMode,
      statusClass,
      statusIcon,
      statusTitle,
      statusDetail,
      executiveHeadline,
      executiveAction,
      executiveAnnualView,
      scenarioScopeSummary,
      exceedancePct,
      completedLabel,
      assessmentFreshnessWarning,
      lifecycle,
      scenarioNarrative,
      technicalInputs,
      runMetadata,
      workflowGuidance,
      recommendations,
      citations,
      primaryGrounding,
      supportingReferences,
      inferredAssumptions,
      missingInformation,
      assessmentIntelligence,
      evidenceGapPlan,
      assessmentChallenge,
      executiveDecision,
      confidenceFrame,
      thresholdModel,
      impactMix,
      projectResultsModel,
      decisionBrief,
      comparisonOptions,
      activeComparisonId,
      baselineAssessment,
      comparison,
      nextStepPlan,
      recommendationCards,
      confidenceNeedsBlock,
      comparisonHighlight,
      treatmentRecommendationLens,
      explanationPanel,
      analystSummary,
      assessmentValue,
      decisionCockpitModel
    };
  }

  global.ResultsViewModel = {
    buildResultsRenderModel
  };
})(window);
