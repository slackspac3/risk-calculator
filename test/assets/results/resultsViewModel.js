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
    const statusClass = r.toleranceBreached ? 'above' : r.nearTolerance ? 'warning' : 'within';
    const statusIcon = r.toleranceBreached ? '🔴' : r.nearTolerance ? '🟠' : '🟢';
    const statusTitle = r.toleranceBreached ? 'Needs leadership action' : r.nearTolerance ? 'Needs management attention' : 'Within current tolerance';
    const statusDetail = r.toleranceBreached
      ? `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} is above the tolerance threshold of ${fmtCurrency(r.threshold)}.`
      : r.nearTolerance
        ? `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} is above the warning trigger of ${fmtCurrency(r.warningThreshold)} but still below tolerance.`
        : `Conditional event-loss P90 ${fmtCurrency(r.eventLoss.p90)} remains below the warning trigger of ${fmtCurrency(r.warningThreshold)}.`;
    const executiveHeadline = rolePresentation.executiveHeadline(r);
    const executiveAction = rolePresentation.executiveAction(r);
    const executiveAnnualView = rolePresentation.annualView(r);
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
      corrRlRc: rawResults.runConfig.corrRlRc
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
      assessmentValue
    };
  }

  global.ResultsViewModel = {
    buildResultsRenderModel
  };
})(window);
