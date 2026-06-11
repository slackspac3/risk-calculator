/**
 * riskEngine.js — FAIR-based Monte Carlo simulation engine
 * 
 * Architecture:
 *  - Triangular and lognormal distributions
 *  - Compound Poisson ALE model
 *  - Vulnerability derived from ThreatCapability vs ControlStrength (sigmoid)
 *  - Loss Exceedance Curve (LEC) computation
 *  - Deterministic mode via seeded PRNG (Mulberry32)
 */

const RiskEngine = (() => {
  const DIST_TYPES = ['triangular', 'lognormal'];
  const MIN_ITERATIONS = 1000;
  const DEFAULT_ITERATIONS = 10000;
  const MAX_ITERATIONS = 100000;
  const HIGH_ITERATION_WARNING = 50000;
  const CORRELATION_LIMIT = 0.95;
  const PROJECT_ASSESSMENT_TYPES = ['project_buyer', 'project_seller'];
  const MAX_PROJECT_DURATION_MONTHS = 240;
  const COMPUTABLE_SOURCE_STATUSES = ['known', 'estimated', 'derived', 'evidence_supported', 'benchmark_proxy'];

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let _rand = Math.random;

  function sampleNormal(mean = 0, std = 1) {
    let u = 0, v = 0;
    while (u === 0) u = _rand();
    while (v === 0) v = _rand();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + std * z;
  }

  function sampleTriangular(min, mode, max) {
    return sampleTriangularFromU(_rand(), min, mode, max);
  }

  function sampleTriangularFromU(u, min, mode, max) {
    if (min >= max) return min;
    if (mode < min) mode = min;
    if (mode > max) mode = max;
    const fc = (mode - min) / (max - min);
    if (u < fc) {
      return min + Math.sqrt(u * (max - min) * (mode - min));
    }
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }

  function inverseStandardNormal(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const plow = 0.02425;
    const phigh = 1 - plow;
    if (p < plow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > phigh) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  function sampleLognormal(min, mode, max) {
    return sampleLognormalFromU(_rand(), min, mode, max);
  }

  function sampleLognormalFromU(u, min, mode, max) {
    const safeMin = Number.isFinite(min) && min > 0 ? min : Number.EPSILON;
    const safeMode = Number.isFinite(mode) && mode > safeMin ? mode : Math.max(safeMin * 2, 0.001);
    const safeMax = Number.isFinite(max) && max > safeMode ? max : safeMode * 2;
    const mu = Math.log(safeMode);
    const sigma = Math.log(safeMax / safeMode) / 1.645;
    const s = Math.abs(sigma) < 0.001 ? 0.001 : sigma;
    const z = inverseStandardNormal(Math.min(0.999999, Math.max(0.000001, u)));
    return Math.max(safeMin, Math.exp(mu + s * z));
  }

  function sampleDist(distType, min, likely, max) {
    if (distType === 'lognormal') return sampleLognormal(min, likely, max);
    return sampleTriangular(min, likely, max);
  }

  function sampleDistFromU(distType, u, min, likely, max) {
    if (distType === 'lognormal') return sampleLognormalFromU(u, min, likely, max);
    return sampleTriangularFromU(u, min, likely, max);
  }

  function sigmoid(x, k = 6) {
    return 1 / (1 + Math.exp(-k * x));
  }

  function sampleVulnerability(params) {
    if (params.vulnDirect) {
      return Math.min(1, Math.max(0, sampleDist(params.distType, params.vulnMin, params.vulnLikely, params.vulnMax)));
    }
    const tc = sampleDist(params.distType, params.threatCapMin, params.threatCapLikely, params.threatCapMax);
    const cs = sampleDist(params.distType, params.controlStrMin, params.controlStrLikely, params.controlStrMax);
    const raw = sigmoid(tc - cs);
    const noise = (_rand() - 0.5) * 0.05;
    return Math.min(1, Math.max(0, raw + noise));
  }

  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const t = 1 / (1 + 0.3275911 * absX);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
  }

  function normalToUnit(z) {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
  }

  function sampleCorrelatedPair(rho = 0) {
    const clamped = Math.max(-0.95, Math.min(0.95, Number(rho) || 0));
    const z1 = sampleNormal(0, 1);
    const z2 = sampleNormal(0, 1);
    const y1 = z1;
    const y2 = clamped * z1 + Math.sqrt(1 - (clamped * clamped)) * z2;
    return [
      Math.min(0.999999, Math.max(0.000001, normalToUnit(y1))),
      Math.min(0.999999, Math.max(0.000001, normalToUnit(y2)))
    ];
  }

  function samplePrimaryLoss(params) {
    const dt = params.distType;
    const [irU, biU] = sampleCorrelatedPair(params.corrBiIr || 0.3);
    const [rlU, rcU] = sampleCorrelatedPair(params.corrRlRc || 0.2);
    const ir = sampleDistFromU(dt, irU, params.irMin, params.irLikely, params.irMax);
    const bi = sampleDistFromU(dt, biU, params.biMin, params.biLikely, params.biMax);
    const db = sampleDist(dt, params.dbMin, params.dbLikely, params.dbMax);
    const rl = sampleDistFromU(dt, rlU, params.rlMin, params.rlLikely, params.rlMax);
    const tp = sampleDist(dt, params.tpMin, params.tpLikely, params.tpMax);
    const rc = sampleDistFromU(dt, rcU, params.rcMin, params.rcLikely, params.rcMax);
    return Math.max(0, ir) + Math.max(0, bi) + Math.max(0, db) + Math.max(0, rl) + Math.max(0, tp) + Math.max(0, rc);
  }

  function sampleSecondaryLoss(params) {
    if (!params.secondaryEnabled) return 0;
    const p = sampleDist(params.distType, params.secProbMin, params.secProbLikely, params.secProbMax);
    const prob = Math.min(1, Math.max(0, p));
    if (_rand() > prob) return 0;
    return sampleDist(params.distType, params.secMagMin, params.secMagLikely, params.secMagMax);
  }

  function samplePoisson(lambda) {
    if (lambda <= 0) return 0;
    if (lambda > 100) return Math.max(0, Math.round(sampleNormal(lambda, Math.sqrt(lambda))));
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= _rand();
    } while (p > L);
    return k - 1;
  }

  function percentile(sorted, p) {
    const idx = Math.floor(p * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  function stats(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    return {
      mean,
      p50: percentile(sorted, 0.50),
      p90: percentile(sorted, 0.90),
      p95: percentile(sorted, 0.95),
      min: sorted[0],
      max: sorted[n - 1]
    };
  }

  function buildLEC(aleSamples, numPoints = 50) {
    const sorted = [...aleSamples].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    if (max === min) return [{ x: min, p: 0.5 }];
    const logMin = Math.log10(Math.max(min, 1));
    const logMax = Math.log10(Math.max(max, 2));
    const points = [];
    for (let i = 0; i <= numPoints; i += 1) {
      const logX = logMin + (i / numPoints) * (logMax - logMin);
      const x = Math.pow(10, logX);
      let firstGreater = sorted.findIndex(v => v > x);
      if (firstGreater === -1) firstGreater = n;
      const exceed = (n - firstGreater) / n;
      points.push({ x, p: exceed });
    }
    return points;
  }

  function buildHistogram(samples, numBins = 40) {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;
    const lo = sorted[Math.floor(0.01 * n)];
    const hi = sorted[Math.floor(0.99 * n)];
    if (hi === lo) return [{ x: lo, count: n }];
    const binWidth = (hi - lo) / numBins;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      x: lo + i * binWidth + binWidth / 2,
      count: 0
    }));
    sorted.forEach(v => {
      const idx = Math.min(Math.floor((v - lo) / binWidth), numBins - 1);
      if (idx >= 0) bins[idx].count += 1;
    });
    return bins;
  }

  function cancelError() {
    const error = new Error('Simulation cancelled.');
    error.code = 'SIMULATION_CANCELLED';
    return error;
  }

  function assertNotCancelled(signal) {
    if (signal?.aborted) throw cancelError();
  }

  function normalizeInteger(value, fallback) {
    if (typeof value === 'number') return Number.isInteger(value) ? value : fallback;
    const text = String(value ?? '').trim();
    if (!/^-?\d+$/.test(text)) return fallback;
    const parsed = Number.parseInt(text, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
  }

  function normaliseSourceStatus(value, fallback = 'unknown') {
    const text = String(value || '').trim().toLowerCase().replace(/-/g, '_');
    if (!text) return fallback;
    if (['proxy', 'proxied', 'benchmark_proxied', 'benchmark_proxy_driver'].includes(text)) return 'benchmark_proxy';
    if (['evidence', 'evidence_supported', 'evidence_based'].includes(text)) return 'evidence_supported';
    if (['known', 'estimated', 'derived', 'benchmark_proxy', 'unknown', 'not_provided', 'not_applicable'].includes(text)) return text;
    return fallback;
  }

  function isComputableSourceStatus(status) {
    return COMPUTABLE_SOURCE_STATUSES.includes(normaliseSourceStatus(status));
  }

  function normaliseAssessmentType(value) {
    const text = String(value || '').trim().toLowerCase();
    return PROJECT_ASSESSMENT_TYPES.includes(text) ? text : 'enterprise_generic';
  }

  function normalisePositiveNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function normaliseOptionalNumber(value) {
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function buildProjectHorizonConfidenceLabel(config) {
    if (!config?.enabled) return 'Not computed';
    const statuses = [
      config.durationSourceStatus,
      config.projectValueSourceStatus,
      config.projectMarginSourceStatus
    ].filter(Boolean).map(status => normaliseSourceStatus(status));
    if (statuses.includes('benchmark_proxy')) return 'Proxy-based project horizon';
    if (statuses.includes('estimated') || statuses.includes('derived')) return 'Estimate-led project horizon';
    if (statuses.includes('evidence_supported')) return 'Evidence-supported project horizon';
    return 'Known-input project horizon';
  }

  function buildProjectHorizonCaveats(config) {
    const caveats = Array.isArray(config?.caveats) ? [...config.caveats] : [];
    if (!config?.enabled) return caveats;
    if (!normalisePositiveNumber(config.projectValue) || !isComputableSourceStatus(config.projectValueSourceStatus)) {
      caveats.push('Project value was not available with a usable source status, so loss as a percentage of project value is omitted.');
    }
    if (config.assessmentType === 'project_seller' && (!normalisePositiveNumber(config.projectMargin) || !isComputableSourceStatus(config.projectMarginSourceStatus))) {
      caveats.push('Seller contribution margin was not available with a usable source status, so margin percentage is omitted.');
    }
    if (normaliseSourceStatus(config.durationSourceStatus) === 'benchmark_proxy') {
      caveats.push('Project duration is benchmark-proxied; read project-horizon metrics as proxy-based, not observed.');
    }
    return Array.from(new Set(caveats.map(item => String(item || '').trim()).filter(Boolean))).slice(0, 8);
  }

  function normaliseProjectHorizonConfig(params = {}) {
    const assessmentType = normaliseAssessmentType(params.assessmentType);
    const isProjectAssessment = PROJECT_ASSESSMENT_TYPES.includes(assessmentType);
    if (!isProjectAssessment) return null;

    const requested = params.projectHorizonEnabled !== false;
    const base = {
      enabled: false,
      skippedReason: requested ? '' : 'project_horizon_disabled',
      assessmentType,
      durationMonths: null,
      durationYears: null,
      durationSourceStatus: normaliseSourceStatus(params.projectDurationSourceStatus, 'unknown'),
      durationConfidence: String(params.projectDurationConfidence || 'unknown').trim() || 'unknown',
      projectValue: normaliseOptionalNumber(params.projectValue),
      projectValueSourceStatus: normaliseSourceStatus(params.projectValueSourceStatus, params.projectValue == null ? 'unknown' : 'known'),
      projectMargin: normaliseOptionalNumber(params.projectMargin),
      projectMarginSourceStatus: normaliseSourceStatus(params.projectMarginSourceStatus, params.projectMargin == null ? 'unknown' : 'known'),
      caveats: []
    };
    if (!requested) return base;

    const rawYears = normaliseOptionalNumber(params.projectHorizonYears);
    const rawMonths = normaliseOptionalNumber(params.projectDurationMonths);
    if (rawYears === null && rawMonths === null) {
      return {
        ...base,
        skippedReason: 'project_duration_missing',
        caveats: ['Project duration is unknown, so project-horizon loss was not computed.']
      };
    }

    const sourceStatus = normaliseSourceStatus(params.projectDurationSourceStatus, 'known');
    const inputMonths = rawYears !== null ? rawYears * 12 : rawMonths;
    if (!(inputMonths > 0)) {
      return {
        ...base,
        durationMonths: inputMonths,
        durationYears: inputMonths === null ? null : inputMonths / 12,
        durationSourceStatus: sourceStatus,
        skippedReason: 'project_duration_invalid',
        caveats: ['Project duration must be greater than zero before project-horizon loss can be computed.']
      };
    }
    if (!isComputableSourceStatus(sourceStatus)) {
      return {
        ...base,
        durationMonths: inputMonths,
        durationYears: inputMonths / 12,
        durationSourceStatus: sourceStatus,
        skippedReason: 'project_duration_source_unknown',
        caveats: ['Project duration is present but its source status is unknown, so project-horizon loss was not computed.']
      };
    }

    const cappedMonths = Math.min(inputMonths, MAX_PROJECT_DURATION_MONTHS);
    const caveats = [];
    if (inputMonths > MAX_PROJECT_DURATION_MONTHS) {
      caveats.push(`Project duration was capped at ${MAX_PROJECT_DURATION_MONTHS} months for simulation guardrails.`);
    }
    return {
      ...base,
      enabled: true,
      skippedReason: '',
      durationMonths: cappedMonths,
      durationYears: cappedMonths / 12,
      durationSourceStatus: sourceStatus,
      durationConfidence: String(params.projectDurationConfidence || (sourceStatus === 'known' || sourceStatus === 'evidence_supported' ? 'medium' : 'low')).trim() || 'unknown',
      caveats
    };
  }

  function buildProjectHorizonValidationWarnings(params = {}) {
    const config = normaliseProjectHorizonConfig(params);
    if (!config || !config.skippedReason) return [];
    if (config.skippedReason === 'project_horizon_disabled') return [];
    return config.caveats.length ? config.caveats : [`Project-horizon metrics skipped: ${config.skippedReason}.`];
  }

  function validateOrderedRange(params, key, label, errors, options = {}) {
    const min = Number(params[`${key}Min`]);
    const likely = Number(params[`${key}Likely`]);
    const max = Number(params[`${key}Max`]);
    const lowerBound = options.min ?? 0;
    const upperBound = options.max ?? Number.POSITIVE_INFINITY;
    if (![min, likely, max].every(Number.isFinite)) {
      errors.push(`${label}: low, expected, and severe values are all required.`);
      return;
    }
    if (min < lowerBound || likely < lowerBound || max < lowerBound) {
      errors.push(`${label}: values cannot be below ${lowerBound}.`);
      return;
    }
    if (upperBound !== Number.POSITIVE_INFINITY && (min > upperBound || likely > upperBound || max > upperBound)) {
      errors.push(`${label}: values cannot be above ${upperBound}.`);
      return;
    }
    if (min > likely || likely > max) {
      errors.push(`${label}: values must follow low ≤ expected ≤ severe.`);
    }
  }

  function buildParameterSemanticsWarnings(normalizedParams) {
    const warnings = [];
    const midpointVulnerability = normalizedParams.vulnDirect
      ? Number(normalizedParams.vulnLikely)
      : sigmoid(Number(normalizedParams.threatCapLikely) - Number(normalizedParams.controlStrLikely));
    if (Number.isFinite(midpointVulnerability) && (midpointVulnerability <= 0.05 || midpointVulnerability >= 0.95)) {
      warnings.push('The current vulnerability setup sits near certainty or near-impossibility. Confirm the threat-capability and control-strength bands still reflect a challengeable FAIR view.');
    }
    if (normalizedParams.distType !== 'lognormal') return warnings;

    const lognormalRanges = [
      ['tef', 'Event frequency'],
      normalizedParams.vulnDirect ? ['vuln', 'Event success likelihood'] : null,
      !normalizedParams.vulnDirect ? ['threatCap', 'Threat capability'] : null,
      !normalizedParams.vulnDirect ? ['controlStr', 'Control strength'] : null,
      ['ir', 'Incident response'],
      ['bi', 'Business interruption'],
      ['db', 'Data remediation'],
      ['rl', 'Regulatory and legal'],
      ['tp', 'Third-party impact'],
      ['rc', 'Reputation and contract'],
      normalizedParams.secondaryEnabled ? ['secProb', 'Secondary-loss probability'] : null,
      normalizedParams.secondaryEnabled ? ['secMag', 'Secondary-loss magnitude'] : null
    ].filter(Boolean);

    const zeroLowLabels = [];
    const wideTailLabels = [];
    lognormalRanges.forEach(([key, label]) => {
      const min = Number(normalizedParams[`${key}Min`]);
      const likely = Number(normalizedParams[`${key}Likely`]);
      const max = Number(normalizedParams[`${key}Max`]);
      if (!Number.isFinite(min) || !Number.isFinite(likely) || !Number.isFinite(max) || likely <= 0 || max <= 0) return;
      if (min <= 0) zeroLowLabels.push(label);
      if ((max / likely) >= 25) wideTailLabels.push(label);
    });

    if (zeroLowLabels.length) {
      warnings.push(`Lognormal ${zeroLowLabels.join(', ')} use zero or non-positive lows. The model treats those as near-zero planning floors rather than true zeros.`);
    }
    if (wideTailLabels.length) {
      warnings.push(`Lognormal ${wideTailLabels.join(', ')} have very wide severe tails. Confirm the severe case is intentionally heavier than the expected case, not just uncertain.`);
    }
    return warnings;
  }

  function buildExpensiveSettingsWarnings(normalizedParams) {
    const warnings = [];
    if (normalizedParams.iterations >= HIGH_ITERATION_WARNING) {
      warnings.push(`High iteration count selected (${normalizedParams.iterations.toLocaleString()}). This run may take longer on some pilot devices.`);
    }
    if (normalizedParams.distType === 'lognormal' && normalizedParams.iterations >= HIGH_ITERATION_WARNING) {
      warnings.push('Lognormal sampling with a high iteration count increases runtime and tail sensitivity. Use it only when you need the heavier-tail shape.');
    }
    if (normalizedParams.secondaryEnabled && normalizedParams.iterations >= HIGH_ITERATION_WARNING) {
      warnings.push('Secondary loss is enabled on a high-volume run. This can increase runtime and widen the model tail.');
    }
    return warnings;
  }

  function validateRunParams(params = {}) {
    const rawIterations = normalizeInteger(params.iterations, NaN);
    const rawSeed = params.seed == null || params.seed === '' ? null : normalizeInteger(params.seed, NaN);
    const normalizedParams = {
      ...params,
      distType: DIST_TYPES.includes(String(params.distType || 'triangular')) ? String(params.distType || 'triangular') : 'triangular',
      iterations: clampNumber(rawIterations, MIN_ITERATIONS, MAX_ITERATIONS, DEFAULT_ITERATIONS),
      seed: rawSeed,
      threshold: Number.isFinite(Number(params.threshold)) ? Number(params.threshold) : 5000000,
      annualReviewThreshold: Number.isFinite(Number(params.annualReviewThreshold)) ? Number(params.annualReviewThreshold) : 12000000,
      corrBiIr: clampNumber(params.corrBiIr, -CORRELATION_LIMIT, CORRELATION_LIMIT, 0.3),
      corrRlRc: clampNumber(params.corrRlRc, -CORRELATION_LIMIT, CORRELATION_LIMIT, 0.2),
      vulnDirect: !!params.vulnDirect,
      secondaryEnabled: !!params.secondaryEnabled,
      assessmentType: normaliseAssessmentType(params.assessmentType),
      projectHorizonEnabled: params.projectHorizonEnabled !== false,
      projectDurationMonths: normaliseOptionalNumber(params.projectDurationMonths),
      projectDurationSourceStatus: normaliseSourceStatus(
        params.projectDurationSourceStatus,
        params.projectDurationMonths == null && params.projectHorizonYears == null ? 'unknown' : 'known'
      ),
      projectDurationConfidence: String(params.projectDurationConfidence || 'unknown').trim() || 'unknown',
      projectHorizonYears: normaliseOptionalNumber(params.projectHorizonYears),
      projectValue: normaliseOptionalNumber(params.projectValue),
      projectValueSourceStatus: normaliseSourceStatus(params.projectValueSourceStatus, params.projectValue == null ? 'unknown' : 'known'),
      projectMargin: normaliseOptionalNumber(params.projectMargin),
      projectMarginSourceStatus: normaliseSourceStatus(params.projectMarginSourceStatus, params.projectMargin == null ? 'unknown' : 'known')
    };
    const errors = [];

    if (!DIST_TYPES.includes(String(params.distType || 'triangular'))) {
      errors.push('Distribution type must be triangular or lognormal.');
    }
    if (!Number.isInteger(rawIterations)) {
      errors.push('Iterations must be a whole number.');
    } else if (rawIterations < MIN_ITERATIONS || rawIterations > MAX_ITERATIONS) {
      errors.push(`Iterations must stay between ${MIN_ITERATIONS.toLocaleString()} and ${MAX_ITERATIONS.toLocaleString()}.`);
    }
    if (params.seed != null && params.seed !== '' && !Number.isInteger(rawSeed)) {
      errors.push('Seed must be a whole number when provided.');
    }
    if (!(normalizedParams.threshold > 0)) errors.push('Event tolerance threshold must be greater than zero.');
    if (!(normalizedParams.annualReviewThreshold > 0)) errors.push('Annual review threshold must be greater than zero.');

    validateOrderedRange(normalizedParams, 'tef', 'Event frequency', errors, { min: 0 });

    if (normalizedParams.vulnDirect) {
      validateOrderedRange(normalizedParams, 'vuln', 'Event success likelihood', errors, { min: 0, max: 1 });
    } else {
      validateOrderedRange(normalizedParams, 'threatCap', 'Threat capability', errors, { min: 0, max: 1 });
      validateOrderedRange(normalizedParams, 'controlStr', 'Control strength', errors, { min: 0, max: 1 });
    }

    ['ir', 'bi', 'db', 'rl', 'tp', 'rc'].forEach(key => {
      const labels = {
        ir: 'Incident response',
        bi: 'Business interruption',
        db: 'Data remediation',
        rl: 'Regulatory and legal',
        tp: 'Third-party impact',
        rc: 'Reputation and contract'
      };
      validateOrderedRange(normalizedParams, key, labels[key], errors, { min: 0 });
    });

    if (normalizedParams.secondaryEnabled) {
      validateOrderedRange(normalizedParams, 'secProb', 'Secondary-loss probability', errors, { min: 0, max: 1 });
      validateOrderedRange(normalizedParams, 'secMag', 'Secondary-loss magnitude', errors, { min: 0 });
    }

    if (Math.abs(Number(params.corrBiIr ?? 0.3)) > CORRELATION_LIMIT) {
      errors.push(`Business interruption / incident response correlation must stay between -${CORRELATION_LIMIT} and ${CORRELATION_LIMIT}.`);
    }
    if (Math.abs(Number(params.corrRlRc ?? 0.2)) > CORRELATION_LIMIT) {
      errors.push(`Regulatory / reputation correlation must stay between -${CORRELATION_LIMIT} and ${CORRELATION_LIMIT}.`);
    }

    const expensiveSettings = buildExpensiveSettingsWarnings(normalizedParams);
    const semanticsWarnings = [
      ...buildParameterSemanticsWarnings(normalizedParams),
      ...buildProjectHorizonValidationWarnings(normalizedParams)
    ];
    return {
      valid: errors.length === 0,
      errors,
      warnings: [...expensiveSettings, ...semanticsWarnings],
      expensiveSettings,
      semanticsWarnings,
      normalizedParams
    };
  }

  function createRunMetadata(params = {}, context = {}) {
    return {
      seed: params.seed,
      iterations: params.iterations,
      distributions: {
        eventModel: params.distType,
        vulnerabilityMode: params.vulnDirect ? 'direct' : 'derived',
        correlations: {
          businessInterruptionVsIncidentResponse: params.corrBiIr,
          regulatoryVsReputation: params.corrRlRc
        }
      },
      assumptions: Array.isArray(context.assumptions) ? context.assumptions.map(item => item?.text || String(item || '')).filter(Boolean) : [],
      scenarioMultipliers: context.scenarioMultipliers || {},
      thresholdConfigUsed: context.thresholdConfigUsed || {
        warningThreshold: context.warningThreshold,
        eventToleranceThreshold: params.threshold,
        annualReviewThreshold: params.annualReviewThreshold
      },
      runtimeGuardrails: Array.isArray(context.runtimeGuardrails) ? context.runtimeGuardrails : [],
      currencyContext: context.currencyContext || {},
      projectHorizon: normaliseProjectHorizonConfig(params),
      inputSnapshot: {
        distType: params.distType,
        vulnDirect: !!params.vulnDirect,
        threshold: params.threshold,
        annualReviewThreshold: params.annualReviewThreshold,
        assessmentType: normaliseAssessmentType(params.assessmentType),
        projectHorizon: normaliseProjectHorizonConfig(params),
        tef: { min: params.tefMin, likely: params.tefLikely, max: params.tefMax },
        vulnerability: params.vulnDirect
          ? { min: params.vulnMin, likely: params.vulnLikely, max: params.vulnMax }
          : {
              threatCapability: { min: params.threatCapMin, likely: params.threatCapLikely, max: params.threatCapMax },
              controlStrength: { min: params.controlStrMin, likely: params.controlStrLikely, max: params.controlStrMax }
            },
        primaryLoss: {
          incidentResponse: { min: params.irMin, likely: params.irLikely, max: params.irMax },
          businessInterruption: { min: params.biMin, likely: params.biLikely, max: params.biMax },
          dataRemediation: { min: params.dbMin, likely: params.dbLikely, max: params.dbMax },
          regulatoryLegal: { min: params.rlMin, likely: params.rlLikely, max: params.rlMax },
          thirdParty: { min: params.tpMin, likely: params.tpLikely, max: params.tpMax },
          reputationContract: { min: params.rcMin, likely: params.rcLikely, max: params.rcMax }
        },
        secondaryLoss: params.secondaryEnabled ? {
          probability: { min: params.secProbMin, likely: params.secProbLikely, max: params.secProbMax },
          magnitude: { min: params.secMagMin, likely: params.secMagLikely, max: params.secMagMax }
        } : null
      }
    };
  }

  function _computeSamples(params, iterations, { onProgress = null, yieldEvery = 0, signal = null, projectHorizonConfig = null } = {}) {
    const lmSamples = [];
    const aleSamples = [];
    const projectHorizonSamples = projectHorizonConfig?.enabled ? [] : null;
    const projectEventIndicators = projectHorizonConfig?.enabled ? [] : null;

    const computeOne = () => {
      assertNotCancelled(signal);
      const tef = Math.max(0, sampleDist(params.distType, params.tefMin, params.tefLikely, params.tefMax));
      const vuln = sampleVulnerability(params);
      const lef = tef * vuln;
      const primaryLoss = samplePrimaryLoss(params);
      const secondaryLoss = sampleSecondaryLoss(params);
      const eventLoss = primaryLoss + secondaryLoss;
      lmSamples.push(eventLoss);

      const numEvents = samplePoisson(lef);
      let annualLoss = 0;
      for (let j = 0; j < numEvents; j += 1) {
        annualLoss += samplePrimaryLoss(params) + sampleSecondaryLoss(params);
      }
      aleSamples.push(annualLoss);

      if (projectHorizonConfig?.enabled) {
        const projectLambda = lef * projectHorizonConfig.durationYears;
        const projectEvents = samplePoisson(projectLambda);
        let projectLoss = 0;
        for (let j = 0; j < projectEvents; j += 1) {
          projectLoss += samplePrimaryLoss(params) + sampleSecondaryLoss(params);
        }
        projectHorizonSamples.push(projectLoss);
        projectEventIndicators.push(projectEvents > 0 ? 1 : 0);
      }
    };

    if (!yieldEvery) {
      for (let i = 0; i < iterations; i += 1) computeOne();
      return { lmSamples, aleSamples, projectHorizonSamples, projectEventIndicators };
    }

    return (async () => {
      for (let i = 0; i < iterations; i += 1) {
        computeOne();
        if ((i + 1) % yieldEvery === 0 || i === iterations - 1) {
          if (typeof onProgress === 'function') onProgress((i + 1) / iterations, i + 1, iterations);
          assertNotCancelled(signal);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      return { lmSamples, aleSamples, projectHorizonSamples, projectEventIndicators };
    })();
  }

  function buildProjectHorizonMetric(config, projectHorizonSamples, projectEventIndicators, thresholds, iterations) {
    if (!config) return null;
    if (!config.enabled) {
      return {
        enabled: false,
        skippedReason: config.skippedReason || 'project_horizon_not_available',
        durationMonths: config.durationMonths,
        durationYears: config.durationYears,
        durationSourceStatus: config.durationSourceStatus,
        durationConfidence: config.durationConfidence,
        eventProbability: null,
        loss: null,
        lossAsPctOfProjectValue: null,
        lossAsPctOfProjectValueSourceStatus: config.projectValueSourceStatus,
        lossAsPctOfMargin: null,
        lossAsPctOfMarginSourceStatus: config.projectMarginSourceStatus,
        metricSemantics: 'Project-horizon metrics were not computed because the required project duration was not available with a usable source status.',
        confidenceLabel: 'Not computed',
        caveats: buildProjectHorizonCaveats(config)
      };
    }

    const lossStats = stats(Array.isArray(projectHorizonSamples) ? projectHorizonSamples : []);
    const eventProbability = Array.isArray(projectEventIndicators) && projectEventIndicators.length
      ? projectEventIndicators.reduce((sum, value) => sum + (value ? 1 : 0), 0) / projectEventIndicators.length
      : 0;
    const loss = {
      ...lossStats,
      exceedProbabilities: {
        eventToleranceThreshold: projectHorizonSamples.filter(v => v > thresholds.eventToleranceThreshold).length / iterations,
        annualReviewThreshold: projectHorizonSamples.filter(v => v > thresholds.annualReviewThreshold).length / iterations
      }
    };
    const hasProjectValue = normalisePositiveNumber(config.projectValue) !== null && isComputableSourceStatus(config.projectValueSourceStatus);
    const hasProjectMargin = normalisePositiveNumber(config.projectMargin) !== null && isComputableSourceStatus(config.projectMarginSourceStatus);
    const pctStats = denominator => ({
      mean: lossStats.mean / denominator,
      p50: lossStats.p50 / denominator,
      p90: lossStats.p90 / denominator,
      p95: lossStats.p95 / denominator,
      min: lossStats.min / denominator,
      max: lossStats.max / denominator
    });
    return {
      enabled: true,
      skippedReason: '',
      durationMonths: config.durationMonths,
      durationYears: config.durationYears,
      durationSourceStatus: config.durationSourceStatus,
      durationConfidence: config.durationConfidence,
      eventProbability,
      loss,
      lossAsPctOfProjectValue: hasProjectValue ? pctStats(config.projectValue) : null,
      lossAsPctOfProjectValueSourceStatus: hasProjectValue ? config.projectValueSourceStatus : config.projectValueSourceStatus,
      lossAsPctOfMargin: hasProjectMargin ? pctStats(config.projectMargin) : null,
      lossAsPctOfMarginSourceStatus: hasProjectMargin ? config.projectMarginSourceStatus : config.projectMarginSourceStatus,
      metricSemantics: 'Project-horizon loss applies annualized event frequency and event-success logic over the project duration, while preserving the separate annualized enterprise-risk view.',
      confidenceLabel: buildProjectHorizonConfidenceLabel(config),
      caveats: buildProjectHorizonCaveats(config)
    };
  }

  function _buildResults(iterations, thresholds, lmSamples, aleSamples, projectHorizonConfig = null, projectHorizonSamples = null, projectEventIndicators = null) {
    const eventLossStats = stats(lmSamples);
    const annualLossStats = stats(aleSamples);
    const lec = buildLEC(aleSamples);
    const histogram = buildHistogram(aleSamples);
    const eventToleranceThreshold = thresholds.eventToleranceThreshold;
    const annualReviewThreshold = thresholds.annualReviewThreshold;
    const toleranceBreached = eventLossStats.p90 > eventToleranceThreshold;
    const annualReviewTriggered = annualLossStats.p90 > annualReviewThreshold;
    return {
      iterations,
      threshold: eventToleranceThreshold,
      annualReviewThreshold,
      lm: eventLossStats,
      eventLoss: eventLossStats,
      ale: annualLossStats,
      annualLoss: annualLossStats,
      lec,
      histogram,
      toleranceBreached,
      annualReviewTriggered,
      metricSemantics: {
        eventLoss: 'Conditional loss if a materially successful event occurs.',
        annualLoss: 'Annualized loss after applying event frequency and event success logic across the year.',
        ...(projectHorizonConfig ? {
          projectHorizon: 'Project-horizon loss applies the same event frequency and event-success logic over the selected project duration when the duration is known, estimated, derived, evidence-supported, or benchmark-proxied.'
        } : {})
      },
      toleranceDetail: {
        lmP90: eventLossStats.p90,
        aleP90: annualLossStats.p90,
        lmExceedProb: lmSamples.filter(v => v > eventToleranceThreshold).length / iterations,
        aleExceedProb: aleSamples.filter(v => v > eventToleranceThreshold).length / iterations
      },
      annualReviewDetail: {
        annualP90: annualLossStats.p90,
        annualExceedProb: aleSamples.filter(v => v > annualReviewThreshold).length / iterations
      },
      ...(projectHorizonConfig ? {
        projectHorizon: buildProjectHorizonMetric(projectHorizonConfig, projectHorizonSamples || [], projectEventIndicators || [], thresholds, iterations)
      } : {})
    };
  }

  function _prepareRun(params) {
    const validation = validateRunParams(params);
    if (!validation.valid) {
      const error = new Error(validation.errors[0] || 'Invalid simulation parameters.');
      error.code = 'INVALID_SIMULATION_PARAMS';
      error.validation = validation;
      throw error;
    }
    const normalizedParams = validation.normalizedParams;
    const seed = normalizedParams.seed == null
      ? Math.floor(Math.random() * 4294967295)
      : normalizedParams.seed;
    _rand = mulberry32(seed);
    return {
      params: {
        ...normalizedParams,
        seed
      },
      iterations: normalizedParams.iterations,
      thresholds: {
        eventToleranceThreshold: normalizedParams.threshold,
        annualReviewThreshold: normalizedParams.annualReviewThreshold
      },
      projectHorizonConfig: normaliseProjectHorizonConfig(normalizedParams),
      validation
    };
  }

  function run(params) {
    const prepared = _prepareRun(params);
    const { iterations, thresholds } = prepared;
    const { lmSamples, aleSamples, projectHorizonSamples, projectEventIndicators } = _computeSamples(prepared.params, iterations, {
      projectHorizonConfig: prepared.projectHorizonConfig
    });
    return _buildResults(iterations, thresholds, lmSamples, aleSamples, prepared.projectHorizonConfig, projectHorizonSamples, projectEventIndicators);
  }

  async function runAsync(params, { onProgress = null, yieldEvery = 500, signal = null } = {}) {
    const prepared = _prepareRun(params);
    const { iterations, thresholds } = prepared;
    const { lmSamples, aleSamples, projectHorizonSamples, projectEventIndicators } = await _computeSamples(prepared.params, iterations, {
      onProgress,
      yieldEvery,
      signal,
      projectHorizonConfig: prepared.projectHorizonConfig
    });
    return {
      ..._buildResults(iterations, thresholds, lmSamples, aleSamples, prepared.projectHorizonConfig, projectHorizonSamples, projectEventIndicators),
      runConfig: {
        seed: prepared.params.seed,
        iterations: prepared.params.iterations,
        distType: prepared.params.distType,
        threshold: prepared.params.threshold,
        annualReviewThreshold: prepared.params.annualReviewThreshold,
        vulnDirect: prepared.params.vulnDirect,
        secondaryEnabled: prepared.params.secondaryEnabled,
        corrBiIr: prepared.params.corrBiIr,
        corrRlRc: prepared.params.corrRlRc,
        assessmentType: prepared.params.assessmentType,
        projectHorizonEnabled: !!prepared.projectHorizonConfig,
        projectDurationMonths: prepared.params.projectDurationMonths,
        projectDurationSourceStatus: prepared.params.projectDurationSourceStatus,
        projectDurationConfidence: prepared.params.projectDurationConfidence,
        projectHorizonYears: prepared.params.projectHorizonYears,
        projectValue: prepared.params.projectValue,
        projectValueSourceStatus: prepared.params.projectValueSourceStatus,
        projectMargin: prepared.params.projectMargin,
        projectMarginSourceStatus: prepared.params.projectMarginSourceStatus
      },
      validation: prepared.validation
    };
  }

  return {
    run,
    runAsync,
    buildLEC,
    buildHistogram,
    stats,
    validateRunParams,
    createRunMetadata,
    constants: {
      DIST_TYPES,
      MIN_ITERATIONS,
      DEFAULT_ITERATIONS,
      MAX_ITERATIONS,
      HIGH_ITERATION_WARNING,
      CORRELATION_LIMIT,
      MAX_PROJECT_DURATION_MONTHS,
      COMPUTABLE_SOURCE_STATUSES
    }
  };
})();

if (typeof module !== 'undefined') module.exports = RiskEngine;
