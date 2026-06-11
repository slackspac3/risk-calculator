'use strict';

(function attachMetricExplainerService(globalScope) {
  const SOURCE_BUCKETS = Object.freeze([
    'userProvided',
    'evidenceSupported',
    'derived',
    'benchmarkProxy',
    'unknown'
  ]);

  const LEGACY_METRIC_KEYS = Object.freeze({
    eventLossMean: 'eventLoss.mean',
    eventLossP50: 'eventLoss.p50',
    eventLossP90: 'eventLoss.p90',
    eventLossP95: 'eventLoss.p95',
    aleMean: 'annualLoss.mean',
    aleP50: 'annualLoss.p50',
    aleP90: 'annualLoss.p90',
    aleP95: 'annualLoss.p95',
    annualLossMean: 'annualLoss.mean',
    annualLossP50: 'annualLoss.p50',
    annualLossP90: 'annualLoss.p90',
    annualLossP95: 'annualLoss.p95'
  });

  const METRIC_DEFINITIONS = Object.freeze({
    'eventLoss.mean': {
      label: 'Expected conditional event loss',
      category: 'conditional_event_loss',
      plainEnglish: 'This is the average loss from one successful event before annual event frequency is applied.',
      calculationLogic: 'The risk engine samples the current single-event loss component ranges, then reports the mean of the conditional event-loss distribution.',
      whatWouldLowerIt: 'Lower impact rows, faster containment, stronger recoveries, or evidence that severe loss components are overstated would lower this number.',
      whatWouldIncreaseIt: 'Longer disruption, larger legal or third-party cost ranges, weaker recoveries, or evidence of higher tail costs would increase this number.'
    },
    'eventLoss.p50': {
      label: 'Typical conditional event loss',
      category: 'conditional_event_loss',
      plainEnglish: 'This is the midpoint loss from one successful event before annual event frequency is applied.',
      calculationLogic: 'The risk engine samples the current single-event loss component ranges, then reports the 50th percentile of the conditional event-loss distribution.',
      whatWouldLowerIt: 'Lower expected cost rows, shorter disruption, or better-supported offsets would lower the midpoint event view.',
      whatWouldIncreaseIt: 'Higher expected cost rows, slower recovery, or missing evidence that later proves adverse would increase the midpoint event view.'
    },
    'eventLoss.p90': {
      label: 'Severe conditional event loss',
      category: 'conditional_event_loss',
      plainEnglish: 'This is the severe-but-plausible loss from one successful event before annual event frequency is applied.',
      calculationLogic: 'The risk engine samples the current single-event loss component ranges, then reports the 90th percentile of the conditional event-loss distribution.',
      whatWouldLowerIt: 'Better containment, stronger contractual caps, evidence-supported recoveries, or a narrower severe-case tail would lower this number.',
      whatWouldIncreaseIt: 'A longer outage, larger remediation or legal tail, weaker caps, or adverse evidence about secondary loss would increase this number.'
    },
    'eventLoss.p95': {
      label: 'Very severe conditional event loss',
      category: 'conditional_event_loss',
      plainEnglish: 'This is a high-tail single-event view. It is useful when leadership wants to inspect a more conservative event-loss case.',
      calculationLogic: 'The risk engine samples the current single-event loss component ranges, then reports the 95th percentile of the conditional event-loss distribution.',
      whatWouldLowerIt: 'Clear evidence that the worst loss components are capped or unlikely would lower this tail view.',
      whatWouldIncreaseIt: 'Unbounded legal, reputation, third-party, or secondary loss assumptions would increase this tail view.'
    },
    'annualLoss.mean': {
      label: 'Expected annualized loss',
      category: 'annualized_loss',
      plainEnglish: 'This is the average annual exposure after event frequency and event success are applied to the conditional event-loss distribution.',
      calculationLogic: 'The risk engine combines annualized event frequency, success likelihood, and sampled single-event losses to produce the mean annualized loss.',
      whatWouldLowerIt: 'Lower event frequency, stronger control effectiveness, lower expected single-event impact, or evidence-supported offsets would lower this number.',
      whatWouldIncreaseIt: 'Higher frequency, weaker controls, repeated events, or larger expected-case impact rows would increase this number.'
    },
    'annualLoss.p50': {
      label: 'Typical annualized loss',
      category: 'annualized_loss',
      plainEnglish: 'This is the midpoint annual exposure after the model applies event frequency to the conditional event loss.',
      calculationLogic: 'The risk engine combines event frequency and sampled event losses, then reports the 50th percentile of annualized loss.',
      whatWouldLowerIt: 'Lower typical event frequency or lighter expected single-event losses would lower this annual midpoint.',
      whatWouldIncreaseIt: 'More frequent successful events or heavier expected single-event losses would increase this annual midpoint.'
    },
    'annualLoss.p90': {
      label: 'Severe annualized loss',
      category: 'annualized_loss',
      plainEnglish: 'This is the severe annual planning view after frequency and event-loss severity are combined.',
      calculationLogic: 'The risk engine combines annualized event frequency and sampled event losses, then reports the 90th percentile annualized loss.',
      whatWouldLowerIt: 'Lower bad-year frequency, better prevention, and better-bounded severe event losses would lower this number.',
      whatWouldIncreaseIt: 'Multiple events in a bad year, higher event success, or a fatter severe-loss tail would increase this number.'
    },
    'annualLoss.p95': {
      label: 'Very severe annualized loss',
      category: 'annualized_loss',
      plainEnglish: 'This is a high-tail annual planning view for stress discussion, not a forecast of what will happen.',
      calculationLogic: 'The risk engine combines event frequency and sampled event losses, then reports the 95th percentile annualized loss.',
      whatWouldLowerIt: 'Better prevention, lower recurrence potential, or evidence that severe annual compounding is unlikely would lower this tail view.',
      whatWouldIncreaseIt: 'Higher recurrence potential, correlated failures, or weak recovery evidence would increase this tail view.'
    },
    'toleranceDetail.lmExceedProb': {
      label: 'Event tolerance exceedance probability',
      category: 'modelled_probability',
      plainEnglish: 'This is the modelled share of single-event simulations that exceed the event-loss tolerance. It is not the probability that an incident will occur.',
      calculationLogic: 'The engine compares sampled conditional event-loss outcomes with the configured event-loss tolerance and reports the exceedance share.',
      whatWouldLowerIt: 'Lower severe single-event losses, a higher approved tolerance, or stronger evidence of caps and recoveries would lower the exceedance share.',
      whatWouldIncreaseIt: 'Higher severe single-event losses, a lower tolerance, or unbounded impact rows would increase the exceedance share.'
    },
    'toleranceDetail.aleExceedProb': {
      label: 'Annual loss tolerance exceedance probability',
      category: 'modelled_probability',
      plainEnglish: 'This is the modelled share of annualized simulations that exceed the annual loss tolerance. It is a model output, not certainty.',
      calculationLogic: 'The engine compares sampled annualized loss outcomes with the configured annual tolerance and reports the exceedance share.',
      whatWouldLowerIt: 'Lower event frequency, lower annualized loss severity, or a higher approved annual tolerance would lower the exceedance share.',
      whatWouldIncreaseIt: 'Higher frequency, larger repeated-event loss, or a lower annual tolerance would increase the exceedance share.'
    },
    'annualReviewDetail.annualExceedProb': {
      label: 'Annual review trigger probability',
      category: 'modelled_probability',
      plainEnglish: 'This is the modelled share of annualized outcomes that cross the annual review trigger. It indicates review pressure, not certainty.',
      calculationLogic: 'The engine compares sampled annualized loss outcomes with the configured annual review trigger and reports the exceedance share.',
      whatWouldLowerIt: 'Lower annualized exposure, better prevention, or a higher review trigger would lower this probability.',
      whatWouldIncreaseIt: 'Higher frequency, larger annualized tail loss, or a lower review trigger would increase this probability.'
    },
    'projectHorizon.loss.mean': {
      label: 'Expected project-horizon loss',
      category: 'project_horizon_loss',
      plainEnglish: 'This is the average loss over the project horizon. It is separate from the annualized enterprise-risk view.',
      calculationLogic: 'The engine scales the annualized event rate over the project duration, samples project-horizon event occurrence, and applies the current event-loss distribution to that project period.',
      whatWouldLowerIt: 'Shorter project exposure, lower event frequency, lighter project impact drivers, or confirmed recoveries would lower this number.',
      whatWouldIncreaseIt: 'Longer project exposure, higher event frequency, larger project-linked drivers, or unknown recoveries later proving weak would increase this number.'
    },
    'projectHorizon.loss.p90': {
      label: 'P90 project-horizon loss',
      category: 'project_horizon_loss',
      plainEnglish: 'This is the severe-but-plausible project-period loss. It is not the same as annualized loss.',
      calculationLogic: 'The engine scales event rate over the project duration, samples project-horizon outcomes, and reports the 90th percentile project-horizon loss.',
      whatWouldLowerIt: 'Shorter duration, lower frequency, validated caps, or lower project impact drivers would lower this number.',
      whatWouldIncreaseIt: 'Longer duration, higher frequency, larger delay or margin exposure, or unsupported recovery assumptions would increase this number.'
    },
    'projectHorizon.eventProbability': {
      label: 'Project event probability',
      category: 'modelled_probability',
      plainEnglish: 'This is the modelled probability of at least one event during the project horizon. It is a modelled probability, not certainty.',
      calculationLogic: 'The engine converts the annualized event rate into a project-period rate using project duration, then estimates the probability of at least one event over that period.',
      whatWouldLowerIt: 'Shorter project duration, lower annual event rate, or stronger prevention assumptions would lower this probability.',
      whatWouldIncreaseIt: 'Longer project duration, higher annual event rate, or weaker prevention assumptions would increase this probability.'
    },
    'projectHorizon.lossAsPctOfProjectValue': {
      label: 'Loss as % of project value',
      category: 'project_ratio',
      plainEnglish: 'This expresses project-horizon loss as a percentage of project value, spend, budget, or contract value where that denominator is available.',
      calculationLogic: 'The engine divides project-horizon loss by the project value denominator only when that denominator has a usable source status.',
      whatWouldLowerIt: 'A lower project-horizon loss, a larger confirmed denominator, or validated recoveries would lower this percentage.',
      whatWouldIncreaseIt: 'A higher project-horizon loss, a smaller confirmed denominator, or unsupported recovery assumptions would increase this percentage.'
    },
    'projectHorizon.lossAsPctOfMargin': {
      label: 'Loss as % of margin',
      category: 'project_ratio',
      plainEnglish: 'This expresses project-horizon loss as a percentage of contribution margin where margin is available.',
      calculationLogic: 'The engine divides project-horizon loss by contribution margin only when margin has a usable source status.',
      whatWouldLowerIt: 'A lower project-horizon loss, a larger confirmed margin denominator, or stronger recoveries would lower this percentage.',
      whatWouldIncreaseIt: 'A higher project-horizon loss, a smaller margin denominator, or unknown cost-to-cure and penalty inputs proving adverse would increase this percentage.'
    },
    'projectExposure.primaryDriver': {
      label: 'Primary project exposure driver',
      category: 'project_exposure_driver',
      plainEnglish: 'This identifies the project financial mechanism currently doing the most decision work, such as delay, reprocurement, margin, penalty, or cost-to-cure exposure.',
      calculationLogic: 'The service ranks project exposure drivers by quantified impact where available, then by relevant unquantified high-impact drivers. Unknown drivers stay unquantified.',
      whatWouldLowerIt: 'Evidence that the driver is capped, not applicable, recoverable, or less severe than assumed would lower its influence.',
      whatWouldIncreaseIt: 'Evidence that the driver is larger, less recoverable, or more decision-sensitive than assumed would increase its influence.'
    }
  });

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanText(value, maxLength = 220) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function capArray(value, limit = 5) {
    return (Array.isArray(value) ? value : [])
      .map(item => cleanText(item?.label || item?.statement || item?.claim || item?.field || item, 220))
      .filter(Boolean)
      .slice(0, limit);
  }

  function addSource(sourceContext, bucket, value, limit = 6) {
    const target = SOURCE_BUCKETS.includes(bucket) ? bucket : 'unknown';
    const text = cleanText(value, 240);
    if (!text) return;
    if (!sourceContext[target].includes(text) && sourceContext[target].length < limit) {
      sourceContext[target].push(text);
    }
  }

  function normaliseMetricKey(metricKey) {
    const key = cleanText(metricKey, 120);
    return LEGACY_METRIC_KEYS[key] || key;
  }

  function normaliseAssessmentType(context = {}) {
    const raw = cleanText(
      context.assessmentType
      || context.assessment?.assessmentType
      || context.results?.runConfig?.assessmentType
      || context.simulationResult?.runConfig?.assessmentType,
      80
    ).toLowerCase();
    if (raw === 'project_buyer' || raw === 'project_seller') return raw;
    return 'enterprise_generic';
  }

  function normaliseContext(context = {}) {
    const safe = isPlainObject(context) ? context : {};
    const assessment = isPlainObject(safe.assessment) ? safe.assessment : {};
    const results = isPlainObject(safe.results)
      ? safe.results
      : (isPlainObject(safe.simulationResult) ? safe.simulationResult : (isPlainObject(assessment.results) ? assessment.results : {}));
    return {
      ...safe,
      assessment,
      results,
      assessmentType: normaliseAssessmentType({ ...safe, assessment, results }),
      projectExposure: isPlainObject(safe.projectExposure) ? safe.projectExposure : (isPlainObject(assessment.projectExposure) ? assessment.projectExposure : {}),
      projectHorizon: isPlainObject(safe.projectHorizon) ? safe.projectHorizon : (isPlainObject(results.projectHorizon) ? results.projectHorizon : {}),
      decisionBrief: isPlainObject(safe.decisionBrief) ? safe.decisionBrief : (isPlainObject(assessment.decisionBrief) ? assessment.decisionBrief : {}),
      parameterCoach: isPlainObject(safe.parameterCoach) ? safe.parameterCoach : (isPlainObject(assessment.parameterCoach) ? assessment.parameterCoach : {}),
      assumptionRegister: isPlainObject(safe.assumptionRegister) ? safe.assumptionRegister : (isPlainObject(assessment.assumptionRegister) ? assessment.assumptionRegister : {}),
      evidenceMap: isPlainObject(safe.evidenceMap) ? safe.evidenceMap : (isPlainObject(assessment.evidenceMap) ? assessment.evidenceMap : {}),
      parameters: isPlainObject(safe.parameters) ? safe.parameters : (isPlainObject(results.inputs) ? results.inputs : {})
    };
  }

  function sourceBucketFromStatus(status = '', fallbackSource = '') {
    const value = cleanText(status, 80).toLowerCase();
    const source = cleanText(fallbackSource, 80).toLowerCase();
    if (value === 'evidence_supported' || source === 'document') return 'evidenceSupported';
    if (value === 'benchmark_proxy' || source === 'benchmark' || value === 'benchmark_proxy_driver') return 'benchmarkProxy';
    if (value === 'derived' || source === 'project_exposure_mapper' || value === 'calculated_driver') return 'derived';
    if (value === 'known' || value === 'estimated' || source === 'user') return 'userProvided';
    return 'unknown';
  }

  function sourceBucketFromDriver(driver = {}) {
    const status = cleanText(driver.driverStatus, 80).toLowerCase();
    const source = cleanText(driver.source, 80).toLowerCase();
    if (status === 'benchmark_proxy_driver' || source === 'benchmark') return 'benchmarkProxy';
    if (source === 'document' || source === 'evidence_supported') return 'evidenceSupported';
    if (status === 'estimated_driver' && source === 'user') return 'userProvided';
    if (status === 'calculated_driver' && source === 'user') return 'userProvided';
    if (status === 'calculated_driver' || source === 'project_exposure_mapper' || source === 'ai_inferred') return 'derived';
    if (status === 'estimated_driver') return 'userProvided';
    return 'unknown';
  }

  function describeDriver(driver = {}) {
    const label = cleanText(driver.label || driver.id || 'Project driver', 120);
    const status = cleanText(driver.driverStatus || driver.source || 'unknown', 80).replace(/_/g, ' ');
    const confidence = cleanText(driver.confidence, 40);
    const range = [driver.low, driver.likely, driver.high]
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));
    const rangeText = range.length === 3
      ? `; range ${Math.round(range[0]).toLocaleString('en-US')} to ${Math.round(range[2]).toLocaleString('en-US')}`
      : '';
    return `${label} (${status}${confidence ? `, ${confidence} confidence` : ''}${rangeText})`;
  }

  function getFinancialDrivers(projectExposure = {}) {
    return (Array.isArray(projectExposure.financialDrivers) ? projectExposure.financialDrivers : [])
      .filter(isPlainObject)
      .slice(0, 12);
  }

  function selectPrimaryProjectDriver(projectExposure = {}) {
    const drivers = getFinancialDrivers(projectExposure);
    if (!drivers.length) return null;
    const scored = drivers.map((driver, index) => {
      const high = Number(driver.high);
      const likely = Number(driver.likely);
      const numericScore = Number.isFinite(high) ? high : (Number.isFinite(likely) ? likely : 0);
      const quantifiedBonus = numericScore > 0 ? 1000000000000 : 0;
      const unknownBonus = cleanText(driver.driverStatus).toLowerCase() === 'unquantified_driver' ? 500000000 : 0;
      return { driver, score: quantifiedBonus + unknownBonus + numericScore - index };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.driver || null;
  }

  function gatherMainDrivers(metric, ctx) {
    const output = [];
    const add = value => {
      const text = cleanText(value, 220);
      if (text && !output.includes(text) && output.length < 6) output.push(text);
    };
    if (metric.startsWith('project')) {
      const primary = selectPrimaryProjectDriver(ctx.projectExposure);
      if (primary) add(describeDriver(primary));
      getFinancialDrivers(ctx.projectExposure).forEach(driver => {
        if (driver !== primary) add(describeDriver(driver));
      });
    }
    (Array.isArray(ctx.decisionBrief?.mainDrivers) ? ctx.decisionBrief.mainDrivers : []).forEach(item => {
      add(`${cleanText(item.driver || item.label || 'Driver', 100)}${item.impact ? `: ${cleanText(item.impact, 140)}` : ''}`);
    });
    (Array.isArray(ctx.parameterCoach?.parameterRationales) ? ctx.parameterCoach.parameterRationales : []).forEach(item => {
      add(`${cleanText(item.parameterKey || 'Parameter', 80)}: ${cleanText(item.rationale || item.suggestionType || '', 140)}`);
    });
    if (!output.length) {
      (Array.isArray(ctx.assumptionRegister?.assumptions) ? ctx.assumptionRegister.assumptions : []).forEach(item => {
        add(cleanText(item.statement || item, 180));
      });
    }
    return output.length ? output : ['Current model parameters and available evidence context.'];
  }

  function gatherSourceContext(metric, ctx, definition) {
    const sourceContext = {
      userProvided: [],
      evidenceSupported: [],
      derived: [],
      benchmarkProxy: [],
      unknown: []
    };

    addSource(sourceContext, 'derived', definition.category === 'annualized_loss'
      ? 'RiskEngine annualized simulation derived from event frequency and conditional event-loss samples.'
      : definition.category === 'conditional_event_loss'
        ? 'RiskEngine conditional event-loss simulation derived from current loss-component ranges.'
        : definition.category === 'modelled_probability'
          ? 'Modelled probability derived from simulation threshold comparisons.'
          : 'Deterministic metric derived from current saved assessment context.');

    const params = ctx.parameters;
    if (isPlainObject(params) && Object.keys(params).length) {
      addSource(sourceContext, 'userProvided', 'Current Step 4 parameter ranges are present in the saved run context.');
    }

    const evidenceMap = ctx.evidenceMap;
    (Array.isArray(evidenceMap.supportedClaims) ? evidenceMap.supportedClaims : []).forEach(item => {
      addSource(sourceContext, 'evidenceSupported', item.claim || item.whyItMatters || item);
    });
    (Array.isArray(evidenceMap.parameterEvidenceMap) ? evidenceMap.parameterEvidenceMap : []).forEach(item => {
      const support = cleanText(item.supportLevel, 40).toLowerCase();
      if (support === 'strong' || support === 'partial') addSource(sourceContext, 'evidenceSupported', `${cleanText(item.parameterKey || 'Parameter', 100)} has ${support} evidence support.`);
      if (support === 'weak' || support === 'none') addSource(sourceContext, 'unknown', `${cleanText(item.parameterKey || 'Parameter', 100)} has weak or no evidence support.`);
    });
    (Array.isArray(evidenceMap.projectFinancialEvidenceMap) ? evidenceMap.projectFinancialEvidenceMap : []).forEach(item => {
      const status = cleanText(item.status, 40).toLowerCase();
      const label = cleanText(item.field || item.commentary || 'Project financial value', 120);
      if (status === 'found') addSource(sourceContext, 'evidenceSupported', `${label} found in evidence.`);
      if (status === 'not_found' || status === 'unclear' || status === 'contradicted') addSource(sourceContext, 'unknown', `${label} is ${status.replace(/_/g, ' ')} in evidence.`);
    });

    (Array.isArray(ctx.decisionBrief?.mainDrivers) ? ctx.decisionBrief.mainDrivers : []).forEach(item => {
      addSource(sourceContext, sourceBucketFromStatus(item.sourceStatus), item.driver || item.impact || item);
    });
    (Array.isArray(ctx.decisionBrief?.projectQuantSummary?.proxyValuesUsed) ? ctx.decisionBrief.projectQuantSummary.proxyValuesUsed : []).forEach(item => {
      addSource(sourceContext, 'benchmarkProxy', item);
    });
    (Array.isArray(ctx.decisionBrief?.projectQuantSummary?.unknownHighImpactInputs) ? ctx.decisionBrief.projectQuantSummary.unknownHighImpactInputs : []).forEach(item => {
      addSource(sourceContext, 'unknown', item);
    });

    (Array.isArray(ctx.parameterCoach?.parameterRationales) ? ctx.parameterCoach.parameterRationales : []).forEach(item => {
      addSource(sourceContext, sourceBucketFromStatus(item.sourceStatus), `${cleanText(item.parameterKey || 'Parameter', 100)}: ${cleanText(item.suggestionType || item.rationale || '', 140)}`);
    });
    (Array.isArray(ctx.parameterCoach?.missingHighImpactInputs) ? ctx.parameterCoach.missingHighImpactInputs : []).forEach(item => {
      addSource(sourceContext, 'unknown', item.label || item.field || item.suggestedQuestion || item);
    });

    (Array.isArray(ctx.assumptionRegister?.assumptions) ? ctx.assumptionRegister.assumptions : []).forEach(item => {
      addSource(sourceContext, sourceBucketFromStatus(item.sourceStatus), item.statement || item);
    });
    (Array.isArray(ctx.assumptionRegister?.missingEvidence) ? ctx.assumptionRegister.missingEvidence : []).forEach(item => {
      addSource(sourceContext, 'unknown', item.item || item.suggestedQuestion || item);
    });

    if (metric.startsWith('projectHorizon')) {
      addProjectHorizonSources(metric, ctx, sourceContext);
    }
    if (metric.startsWith('projectExposure')) {
      addProjectExposureSources(ctx, sourceContext);
    }

    if (ctx.projectExposure && isPlainObject(ctx.projectExposure)) {
      const quality = ctx.projectExposure.projectInputQuality || {};
      capArray(quality.unknownHighImpactInputs, 6).forEach(item => addSource(sourceContext, 'unknown', item));
      (Array.isArray(ctx.projectExposure.missingInputs) ? ctx.projectExposure.missingInputs : []).forEach(item => {
        const label = item?.label || item?.field || item;
        addSource(sourceContext, 'unknown', label);
      });
    }

    SOURCE_BUCKETS.forEach(bucket => {
      sourceContext[bucket] = sourceContext[bucket].slice(0, 6);
    });
    return sourceContext;
  }

  function addProjectHorizonSources(metric, ctx, sourceContext) {
    const horizon = ctx.projectHorizon || {};
    if (!horizon.enabled) {
      addSource(sourceContext, 'unknown', `Project-horizon metric not computed: ${cleanText(horizon.skippedReason || 'project duration or value unavailable', 160)}.`);
      return;
    }
    addSource(sourceContext, sourceBucketFromStatus(horizon.durationSourceStatus), `Project duration: ${cleanText(horizon.durationSourceStatus || 'unknown', 80)}${horizon.durationMonths ? `, ${Number(horizon.durationMonths).toFixed(1)} months` : ''}.`);
    if (metric === 'projectHorizon.lossAsPctOfProjectValue') {
      addSource(sourceContext, sourceBucketFromStatus(horizon.lossAsPctOfProjectValueSourceStatus), `Project value denominator: ${cleanText(horizon.lossAsPctOfProjectValueSourceStatus || 'unknown', 80)}.`);
    }
    if (metric === 'projectHorizon.lossAsPctOfMargin') {
      addSource(sourceContext, sourceBucketFromStatus(horizon.lossAsPctOfMarginSourceStatus), `Margin denominator: ${cleanText(horizon.lossAsPctOfMarginSourceStatus || 'unknown', 80)}.`);
    }
    (Array.isArray(horizon.caveats) ? horizon.caveats : []).forEach(item => {
      const text = cleanText(item, 220);
      if (/proxy|benchmark/i.test(text)) addSource(sourceContext, 'benchmarkProxy', text);
      else if (/unknown|missing|not available|unavailable/i.test(text)) addSource(sourceContext, 'unknown', text);
      else addSource(sourceContext, 'derived', text);
    });
  }

  function addProjectExposureSources(ctx, sourceContext) {
    getFinancialDrivers(ctx.projectExposure).forEach(driver => {
      addSource(sourceContext, sourceBucketFromDriver(driver), describeDriver(driver));
      (Array.isArray(driver.missingInputs) ? driver.missingInputs : []).forEach(item => {
        addSource(sourceContext, 'unknown', item.label || item.field || item);
      });
    });
  }

  function buildCaveat(metric, sourceContext, ctx) {
    const parts = [];
    if (sourceContext.benchmarkProxy.length) {
      parts.push('Some inputs are benchmark proxies. Treat those values as directional until confirmed by project or enterprise evidence.');
    }
    if (sourceContext.unknown.length) {
      parts.push('Important inputs remain unknown. The explanation carries those unknowns forward rather than treating blanks as zero.');
    }
    if (metric.includes('ExceedProb') || metric === 'projectHorizon.eventProbability') {
      parts.push('This probability is a modelled output from current assumptions, not certainty and not a guarantee that an event will or will not occur.');
    }
    if (metric.startsWith('projectHorizon') && ctx.projectHorizon && ctx.projectHorizon.enabled === false) {
      parts.push('Project-horizon calculation was skipped because the required project duration or source status was not usable.');
    }
    return parts.join(' ');
  }

  function tailorProjectLabel(metric, label, ctx) {
    if (metric === 'projectHorizon.lossAsPctOfProjectValue') {
      if (ctx.assessmentType === 'project_buyer') return 'Loss as % of project spend/budget';
      if (ctx.assessmentType === 'project_seller') return 'Loss as % of contract value';
    }
    if (metric === 'projectHorizon.lossAsPctOfMargin' && ctx.assessmentType === 'project_seller') {
      return 'Loss as % of expected margin';
    }
    if (metric === 'projectExposure.primaryDriver') {
      if (ctx.assessmentType === 'project_buyer') return 'Primary buyer project exposure driver';
      if (ctx.assessmentType === 'project_seller') return 'Primary seller project exposure driver';
    }
    return label;
  }

  function explainMetric(metricKey, context = {}) {
    const metric = normaliseMetricKey(metricKey);
    const ctx = normaliseContext(context);
    const definition = METRIC_DEFINITIONS[metric];
    if (!definition) {
      const sourceContext = {
        userProvided: [],
        evidenceSupported: [],
        derived: [],
        benchmarkProxy: [],
        unknown: ['Metric key is not supported by the deterministic explainer.']
      };
      return {
        metric,
        label: 'Metric explanation unavailable',
        plainEnglish: 'This metric is not currently supported by the deterministic explainer.',
        calculationLogic: 'No calculation logic is available for this metric key.',
        mainDrivers: [],
        sourceContext,
        whatWouldLowerIt: '',
        whatWouldIncreaseIt: '',
        caveat: 'Use a supported metric key to generate a deterministic explanation.'
      };
    }
    const label = tailorProjectLabel(metric, definition.label, ctx);
    const sourceContext = gatherSourceContext(metric, ctx, definition);
    return {
      metric,
      label,
      plainEnglish: definition.plainEnglish,
      calculationLogic: definition.calculationLogic,
      mainDrivers: gatherMainDrivers(metric, ctx),
      sourceContext,
      whatWouldLowerIt: definition.whatWouldLowerIt,
      whatWouldIncreaseIt: definition.whatWouldIncreaseIt,
      caveat: buildCaveat(metric, sourceContext, ctx)
    };
  }

  const exported = {
    explainMetric,
    supportedMetricKeys: Object.freeze(Object.keys(METRIC_DEFINITIONS))
  };

  globalScope.MetricExplainerService = exported;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
