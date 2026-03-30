(function(global) {
  'use strict';

  const DOMAIN_CONFIG = Object.freeze({
    strategic: Object.freeze({ label: 'Strategic', manualHours: 12, externalDays: 3.5 }),
    operational: Object.freeze({ label: 'Operational', manualHours: 10, externalDays: 2.5 }),
    cyber: Object.freeze({ label: 'Cyber', manualHours: 12, externalDays: 3.25 }),
    'third-party': Object.freeze({ label: 'Third-party', manualHours: 9, externalDays: 2.5 }),
    regulatory: Object.freeze({ label: 'Regulatory', manualHours: 11, externalDays: 3.0 }),
    financial: Object.freeze({ label: 'Financial', manualHours: 9, externalDays: 2.75 }),
    esg: Object.freeze({ label: 'ESG', manualHours: 11, externalDays: 3.0 }),
    compliance: Object.freeze({ label: 'Compliance', manualHours: 10, externalDays: 3.0 }),
    'supply-chain': Object.freeze({ label: 'Supply chain', manualHours: 10, externalDays: 2.75 }),
    procurement: Object.freeze({ label: 'Procurement', manualHours: 8, externalDays: 2.5 }),
    'business-continuity': Object.freeze({ label: 'Business continuity', manualHours: 11, externalDays: 3.0 }),
    hse: Object.freeze({ label: 'HSE', manualHours: 11, externalDays: 3.0 }),
    general: Object.freeze({ label: 'General enterprise', manualHours: 9, externalDays: 2.5 })
  });

  const DEFAULT_BENCHMARK_SETTINGS = Object.freeze({
    internalHourlyRatesUsd: Object.freeze({
      strategic: 60,
      operational: 40,
      cyber: 45,
      'third-party': 40,
      regulatory: 48,
      financial: 42,
      esg: 40,
      compliance: 44,
      'supply-chain': 38,
      procurement: 37,
      'business-continuity': 42,
      hse: 43,
      general: 40
    }),
    externalDayRatesUsd: Object.freeze({
      // Seed the pilot with a blended Big 4-style UAE advisory benchmark rather than conservative individual-specialist rates.
      strategic: 5200,
      operational: 3900,
      cyber: 4600,
      'third-party': 4100,
      regulatory: 4700,
      financial: 4500,
      esg: 4300,
      compliance: 4500,
      'supply-chain': 4050,
      procurement: 3900,
      'business-continuity': 4300,
      hse: 4200,
      general: 4000
    })
  });

  const COMPLEXITY_MULTIPLIERS = Object.freeze({
    low: 0.85,
    medium: 1,
    high: 1.25
  });

  const DOMAIN_ORDER = Object.freeze([
    'strategic',
    'operational',
    'cyber',
    'third-party',
    'regulatory',
    'financial',
    'esg',
    'compliance',
    'supply-chain',
    'procurement',
    'business-continuity',
    'hse',
    'general'
  ]);

  const DOMAIN_ALIASES = Object.freeze({
    finance: 'financial',
    financial: 'financial',
    'third party': 'third-party',
    thirdparty: 'third-party',
    'third-party': 'third-party',
    'supply chain': 'supply-chain',
    supplychain: 'supply-chain',
    'supply-chain': 'supply-chain',
    'business continuity': 'business-continuity',
    businesscontinuity: 'business-continuity',
    'business-continuity': 'business-continuity'
  });

  const DOMAIN_KEYWORDS = Object.freeze({
    strategic: /\b(strategy|strategic|programme|program|portfolio|transformation|investment|merger|acquisition|partnership|business case|benefit realisation|value erosion)\b/i,
    operational: /\b(operations?|process|operational|service delivery|capacity|control failure|workflow|runbook|human error|process breakdown)\b/i,
    cyber: /\b(cyber|identity|phishing|ransomware|malware|credential|cloud security|mailbox|breach|vulnerability|privileged access|infosec)\b/i,
    'third-party': /\b(third[\s-]?party|outsourc|vendor|supplier dependency|partner dependency|service provider)\b/i,
    regulatory: /\b(regulat|licen[cs]e|supervisor|filing|sanction|privacy law|pdpl|gdpr|dora|nis2)\b/i,
    financial: /\b(financ|treasury|payment|fraud|transfer|ledger|liquidity|revenue|margin|impairment|control deficiency)\b/i,
    esg: /\b(esg|sustainab|climate|emission|environmental disclosure|ifrs s1|ifrs s2|gri|csrd|esrs)\b/i,
    compliance: /\b(compliance|policy breach|code of conduct|conflict of interest|assurance|monitoring breach|attestation)\b/i,
    'supply-chain': /\b(supply chain|logistics|inventory|shipment|transport|warehous|distribution|single-source)\b/i,
    procurement: /\b(procurement|tender|sourcing|bid|vendor selection|contract award|purchase order)\b/i,
    'business-continuity': /\b(business continuity|continuity|recovery|dr|resumption|rto|rpo|tabletop|fallback)\b/i,
    hse: /\b(hse|health and safety|environment|incident|injury|near miss|site safety|fire code|permit to work)\b/i
  });

  function clonePlain(value, fallback = {}) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { ...(fallback || {}) };
    }
  }

  function roundNumber(value, decimals = 1) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    const factor = 10 ** decimals;
    return Math.round(numeric * factor) / factor;
  }

  function formatHoursLabel(hours = 0) {
    const numeric = Math.max(0, Number(hours || 0));
    if (!numeric) return 'No measured cycle time yet';
    if (numeric < 1) {
      const minutes = Math.max(1, Math.round(numeric * 60));
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    const wholeHours = Math.floor(numeric);
    const minutes = Math.round((numeric - wholeHours) * 60);
    if (!wholeHours) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    if (!minutes) return `${wholeHours} hour${wholeHours === 1 ? '' : 's'}`;
    return `${wholeHours}h ${minutes}m`;
  }

  function formatDaysLabel(days = 0) {
    const numeric = Math.max(0, Number(days || 0));
    if (!numeric) return 'No specialist-day benchmark yet';
    const rounded = roundNumber(numeric, numeric >= 2 ? 1 : 2);
    return `${rounded} specialist day${rounded === 1 ? '' : 's'}`;
  }

  function getBenchmarkDomains() {
    return DOMAIN_ORDER.map(key => ({
      key,
      label: DOMAIN_CONFIG[key]?.label || key
    }));
  }

  function getDefaultBenchmarkSettings() {
    return clonePlain(DEFAULT_BENCHMARK_SETTINGS, {
      internalHourlyRatesUsd: {},
      externalDayRatesUsd: {}
    });
  }

  function normaliseBenchmarkSettings(settings = {}) {
    const defaults = getDefaultBenchmarkSettings();
    const next = {
      internalHourlyRatesUsd: {},
      externalDayRatesUsd: {}
    };
    DOMAIN_ORDER.forEach(key => {
      const internal = Number(settings?.internalHourlyRatesUsd?.[key]);
      const external = Number(settings?.externalDayRatesUsd?.[key]);
      next.internalHourlyRatesUsd[key] = Number.isFinite(internal) && internal > 0
        ? internal
        : defaults.internalHourlyRatesUsd[key];
      next.externalDayRatesUsd[key] = Number.isFinite(external) && external > 0
        ? external
        : defaults.externalDayRatesUsd[key];
    });
    return next;
  }

  function normaliseDomainKey(value = '') {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'general';
    return DOMAIN_ALIASES[raw] || raw;
  }

  function inferDomainKeyFromText(value = '') {
    const text = String(value || '').trim();
    if (!text) return 'general';
    const explicit = normaliseDomainKey(text);
    if (DOMAIN_CONFIG[explicit]) return explicit;
    return DOMAIN_ORDER.find(key => key !== 'general' && DOMAIN_KEYWORDS[key]?.test(text)) || 'general';
  }

  function resolveAssessmentDomain(assessment = {}) {
    const lensKey = normaliseDomainKey(assessment?.scenarioLens?.key || '');
    if (DOMAIN_CONFIG[lensKey]) {
      return {
        key: lensKey,
        label: DOMAIN_CONFIG[lensKey].label,
        source: 'scenario lens'
      };
    }

    const candidates = [
      getStructuredScenarioField(assessment?.structuredScenario, 'eventPath'),
      getStructuredScenarioField(assessment?.structuredScenario, 'primaryDriver'),
      assessment?.scenarioTitle,
      assessment?.narrative,
      assessment?.enhancedNarrative,
      ...(Array.isArray(assessment?.selectedRisks) ? assessment.selectedRisks.flatMap(item => [item?.title, item?.category, item?.description]) : [])
    ];
    const matched = candidates
      .map(item => inferDomainKeyFromText(item))
      .find(key => key && key !== 'general');
    const key = matched || 'general';
    return {
      key,
      label: DOMAIN_CONFIG[key]?.label || DOMAIN_CONFIG.general.label,
      source: matched ? 'scenario content' : 'fallback'
    };
  }

  function estimateAssessmentComplexity(assessment = {}) {
    const riskCount = Math.max(
      Array.isArray(assessment?.selectedRiskIds) ? assessment.selectedRiskIds.filter(Boolean).length : 0,
      Array.isArray(assessment?.selectedRisks) ? assessment.selectedRisks.filter(Boolean).length : 0,
      Number(assessment?.results?.selectedRiskCount || 0)
    );
    const missingCount = Array.isArray(assessment?.missingInformation) ? assessment.missingInformation.filter(Boolean).length : 0;
    const supportCount = (Array.isArray(assessment?.citations) ? assessment.citations.filter(Boolean).length : 0)
      + (Array.isArray(assessment?.supportingReferences) ? assessment.supportingReferences.filter(Boolean).length : 0);
    const regulationCount = Array.isArray(assessment?.applicableRegulations) ? assessment.applicableRegulations.filter(Boolean).length : 0;
    let score = 0;
    if (riskCount >= 3) score += 1;
    if (missingCount >= 3) score += 1;
    if (supportCount >= 4 || regulationCount >= 4) score += 1;
    const key = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
    return {
      key,
      label: key === 'high' ? 'High complexity' : key === 'medium' ? 'Medium complexity' : 'Low complexity',
      multiplier: COMPLEXITY_MULTIPLIERS[key] || 1
    };
  }

  function resolveModelledReduction(assessment = {}, pool = []) {
    const assessments = Array.isArray(pool) ? pool : [];
    const buildReduction = (baseline, candidate, sourceLabel) => {
      const baselineResults = baseline?.results || {};
      const candidateResults = candidate?.results || {};
      const annualReductionUsd = Math.max(0, Number(baselineResults.annualLoss?.mean || baselineResults.ale?.mean || 0) - Number(candidateResults.annualLoss?.mean || candidateResults.ale?.mean || 0));
      const severeAnnualReductionUsd = Math.max(0, Number(baselineResults.annualLoss?.p90 || baselineResults.ale?.p90 || 0) - Number(candidateResults.annualLoss?.p90 || candidateResults.ale?.p90 || 0));
      const eventReductionUsd = Math.max(0, Number(baselineResults.eventLoss?.p90 || baselineResults.lm?.p90 || 0) - Number(candidateResults.eventLoss?.p90 || candidateResults.lm?.p90 || 0));
      const hasValue = annualReductionUsd > 0 || severeAnnualReductionUsd > 0 || eventReductionUsd > 0;
      return {
        available: hasValue,
        annualReductionUsd,
        severeAnnualReductionUsd,
        eventReductionUsd,
        sourceLabel,
        baselineAssessmentId: baseline?.id || '',
        candidateAssessmentId: candidate?.id || '',
        title: hasValue
          ? sourceLabel
          : 'No modelled better-outcome reduction is available yet.'
      };
    };

    if (assessment?.comparisonBaselineId) {
      const baseline = assessment.comparisonBaseline
        || assessments.find(item => item?.id === assessment.comparisonBaselineId)
        || null;
      if (!baseline?.results || !assessment?.results) {
        return { available: false, annualReductionUsd: 0, severeAnnualReductionUsd: 0, eventReductionUsd: 0, sourceLabel: 'Treatment case comparison', title: 'No saved baseline is attached to this treatment case yet.' };
      }
      return buildReduction(baseline, assessment, 'Treatment case vs saved baseline');
    }

    const variants = assessments.filter(item => item?.comparisonBaselineId === assessment?.id && item?.results);
    if (!variants.length || !assessment?.results) {
      return { available: false, annualReductionUsd: 0, severeAnnualReductionUsd: 0, eventReductionUsd: 0, sourceLabel: 'Better-outcome comparison', title: 'Create a better-outcome comparison to quantify modelled reduction.' };
    }
    const bestVariant = variants
      .map(item => ({
        item,
        reduction: buildReduction(assessment, item, 'Best saved better-outcome case')
      }))
      .sort((left, right) => {
        const leftScore = Number(left.reduction.annualReductionUsd || 0) + Number(left.reduction.severeAnnualReductionUsd || 0);
        const rightScore = Number(right.reduction.annualReductionUsd || 0) + Number(right.reduction.severeAnnualReductionUsd || 0);
        return rightScore - leftScore;
      })[0];
    return bestVariant?.reduction || { available: false, annualReductionUsd: 0, severeAnnualReductionUsd: 0, eventReductionUsd: 0, sourceLabel: 'Better-outcome comparison', title: 'Create a better-outcome comparison to quantify modelled reduction.' };
  }

  function buildAssessmentValueModel(assessment = {}, options = {}) {
    const domain = resolveAssessmentDomain(assessment);
    const complexity = estimateAssessmentComplexity(assessment);
    const profile = DOMAIN_CONFIG[domain.key] || DOMAIN_CONFIG.general;
    const benchmarkSettings = normaliseBenchmarkSettings(
      options.benchmarkSettings
      || options.valueBenchmarkSettings
      || (typeof getAdminSettings === 'function' ? getAdminSettings()?.valueBenchmarkSettings : {})
      || {}
    );
    const startedAt = Number(assessment?.startedAt || assessment?.createdAt || 0);
    const completedAt = Number(assessment?.completedAt || assessment?.lifecycleUpdatedAt || assessment?.createdAt || 0);
    const elapsedHours = startedAt && completedAt && completedAt >= startedAt
      ? roundNumber((completedAt - startedAt) / 3600000, 1)
      : 0;
    const manualBaselineHours = roundNumber(profile.manualHours * complexity.multiplier, 1);
    const externalEquivalentDays = roundNumber(profile.externalDays * complexity.multiplier, 1);
    const internalHoursAvoided = Math.max(0, roundNumber(manualBaselineHours - elapsedHours, 1));
    const internalHourlyRateUsd = Number(benchmarkSettings.internalHourlyRatesUsd?.[domain.key] || 0);
    const externalDayRateUsd = Number(benchmarkSettings.externalDayRatesUsd?.[domain.key] || 0);
    const internalCostAvoidedUsd = roundNumber(internalHoursAvoided * internalHourlyRateUsd, 0);
    const externalEquivalentValueUsd = roundNumber(externalEquivalentDays * externalDayRateUsd, 0);
    const reduction = resolveModelledReduction(
      assessment,
      options.assessments || (typeof getAssessments === 'function' ? getAssessments() : [])
    );
    return {
      domain,
      complexity,
      measured: {
        platformHours: elapsedHours,
        platformDurationLabel: formatHoursLabel(elapsedHours),
        startedAt,
        completedAt
      },
      directional: {
        manualBaselineHours,
        manualBaselineLabel: `${roundNumber(manualBaselineHours, 1)} analyst hours`,
        internalHoursAvoided,
        internalHoursAvoidedLabel: `${roundNumber(internalHoursAvoided, 1)} hours`,
        externalEquivalentDays,
        externalEquivalentDaysLabel: formatDaysLabel(externalEquivalentDays)
      },
      cost: {
        internalHourlyRateUsd,
        externalDayRateUsd,
        internalCostAvoidedUsd,
        externalEquivalentValueUsd,
        totalDirectionalValueUsd: roundNumber(internalCostAvoidedUsd + externalEquivalentValueUsd, 0)
      },
      modelled: reduction
    };
  }

  function buildWorkspaceValueSummary(assessments = [], options = {}) {
    const completedAssessments = (Array.isArray(assessments) ? assessments : []).filter(item => item?.results);
    const models = completedAssessments.map(item => buildAssessmentValueModel(item, {
      ...options,
      assessments: completedAssessments
    }));
    const totalCompleted = models.length;
    const positiveCycleModels = models.filter(item => Number(item.measured.platformHours || 0) > 0);
    const averageCycleHours = positiveCycleModels.length
      ? roundNumber(
          positiveCycleModels.reduce((sum, item) => sum + Number(item.measured.platformHours || 0), 0) / positiveCycleModels.length,
          1
        )
      : 0;
    const totals = models.reduce((acc, item) => {
      acc.internalHoursAvoided += Number(item.directional.internalHoursAvoided || 0);
      acc.externalEquivalentDays += Number(item.directional.externalEquivalentDays || 0);
      acc.internalCostAvoidedUsd += Number(item.cost.internalCostAvoidedUsd || 0);
      acc.externalEquivalentValueUsd += Number(item.cost.externalEquivalentValueUsd || 0);
      return acc;
    }, {
      internalHoursAvoided: 0,
      externalEquivalentDays: 0,
      internalCostAvoidedUsd: 0,
      externalEquivalentValueUsd: 0
    });

    const bestReductionByBaseline = new Map();
    completedAssessments
      .filter(item => item?.comparisonBaselineId && item?.results)
      .forEach(item => {
        const reduction = resolveModelledReduction(item, completedAssessments);
        if (!reduction.available || !reduction.baselineAssessmentId) return;
        const existing = bestReductionByBaseline.get(reduction.baselineAssessmentId);
        if (!existing || Number(reduction.annualReductionUsd || 0) >= Number(existing.annualReductionUsd || 0)) {
          bestReductionByBaseline.set(reduction.baselineAssessmentId, reduction);
        }
      });

    const modelledReductions = Array.from(bestReductionByBaseline.values());
    const totalModelledReductionUsd = roundNumber(
      modelledReductions.reduce((sum, item) => sum + Number(item.annualReductionUsd || 0), 0),
      0
    );

    return {
      completedAssessments: totalCompleted,
      averageCycleHours,
      averageCycleLabel: formatHoursLabel(averageCycleHours),
      internalHoursAvoided: roundNumber(totals.internalHoursAvoided, 1),
      internalHoursAvoidedLabel: `${roundNumber(totals.internalHoursAvoided, 1)} hours`,
      externalEquivalentDays: roundNumber(totals.externalEquivalentDays, 1),
      externalEquivalentDaysLabel: formatDaysLabel(totals.externalEquivalentDays),
      internalCostAvoidedUsd: roundNumber(totals.internalCostAvoidedUsd, 0),
      externalEquivalentValueUsd: roundNumber(totals.externalEquivalentValueUsd, 0),
      totalDirectionalValueUsd: roundNumber(totals.internalCostAvoidedUsd + totals.externalEquivalentValueUsd, 0),
      totalModelledReductionUsd,
      trackedReductionCases: modelledReductions.length
    };
  }

  global.ValueQuantService = {
    DOMAIN_CONFIG,
    getBenchmarkDomains,
    getDefaultBenchmarkSettings,
    normaliseBenchmarkSettings,
    resolveAssessmentDomain,
    buildAssessmentValueModel,
    buildWorkspaceValueSummary,
    formatHoursLabel,
    formatDaysLabel
  };
})(window);
