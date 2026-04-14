(function(global) {
  'use strict';

  const GENERIC_RISK_TITLES = new Set([
    'material technology and cyber risk requiring structured assessment',
    'technology outage affecting core business services'
  ]);

  function normaliseRiskSource(source = '', fallback = 'manual') {
    const lowered = String(source || '').trim().toLowerCase();
    if (!lowered) return String(fallback || 'manual').trim().toLowerCase() || 'manual';
    if (lowered === 'manual') return 'manual';
    if (['dry-run', 'example', 'sample', 'learned-pattern'].includes(lowered)) return 'dry-run';
    if (['register', 'upload', 'import'].includes(lowered)) return 'register';
    if (['ai+register', 'register+ai', 'ai-register', 'upload+ai'].includes(lowered)) return 'ai+register';
    if (['scenario-draft', 'built-draft', 'built draft', 'scenario draft'].includes(lowered)) return 'scenario-draft';
    if (
      lowered === 'ai'
      || lowered.includes('legacy')
      || lowered.includes('generated')
      || lowered.includes('fallback')
      || lowered.includes('local')
    ) {
      return 'ai';
    }
    return lowered;
  }

  function isRefreshableSuggestedRiskSource(source = '') {
    return normaliseRiskSource(source, '') !== 'manual';
  }

  function normaliseRisk(risk, source = 'manual') {
    const parsedLine = typeof risk === 'string' ? parseStructuredRiskLine(risk) : parseStructuredRiskLine(risk?.title);
    const title = prettifyRiskText(parsedLine?.title || risk?.title || risk?.name || risk || '');
    if (!title || isNoiseRiskText(title)) return null;
    const description = prettifyRiskText(parsedLine?.description || risk?.description || '');
    const category = prettifyRiskText(parsedLine?.category || risk?.category || 'General');
    if (title === '-' || category === '-') return null;
    return {
      id: risk?.id || ('risk-' + slugify(title) + '-' + Math.random().toString(36).slice(2, 7)),
      title,
      category,
      description,
      source: normaliseRiskSource(risk?.source || source, source),
      regulations: Array.isArray(risk?.regulations) ? risk.regulations : [],
      linkedTo: Array.isArray(risk?.linkedTo) ? risk.linkedTo : []
    };
  }

  function mergeRisks(existing, incoming) {
    const map = new Map();
    [...existing, ...incoming]
      .map((risk) => normaliseRisk(risk))
      .filter(Boolean)
      .forEach((risk) => {
        const key = risk.title.toLowerCase();
        if (!map.has(key)) {
          map.set(key, risk);
          return;
        }
        const previous = map.get(key);
        map.set(key, {
          ...previous,
          ...risk,
          regulations: Array.from(new Set([...(previous.regulations || []), ...(risk.regulations || [])])),
          linkedTo: Array.from(new Set([...(previous.linkedTo || []), ...(risk.linkedTo || [])]))
        });
      });
    return Array.from(map.values());
  }

  function getRiskCandidates() {
    return mergeRisks(AppState.draft.riskCandidates || [], AppState.draft.selectedRisks || []);
  }

  function syncRiskSelection(defaultSelectAll = false) {
    const candidates = getRiskCandidates();
    const validIds = new Set(candidates.map((risk) => risk.id));
    let selectedIds = Array.isArray(AppState.draft.selectedRiskIds)
      ? AppState.draft.selectedRiskIds.filter((id) => validIds.has(id))
      : [];
    if (!selectedIds.length && defaultSelectAll && candidates.length) {
      selectedIds = candidates.map((risk) => risk.id);
    }
    AppState.draft.riskCandidates = candidates;
    AppState.draft.selectedRiskIds = selectedIds;
    AppState.draft.selectedRisks = candidates.filter((risk) => selectedIds.includes(risk.id));
    return AppState.draft.selectedRisks;
  }

  function getSelectedRisks() {
    return syncRiskSelection().filter(Boolean);
  }

  function appendRiskCandidates(incoming, { selectNew = true } = {}) {
    const incomingRisks = mergeRisks([], incoming || []);
    const incomingTitles = new Set(incomingRisks.map((risk) => risk.title.toLowerCase()));
    const hasSpecificIncoming = incomingRisks.some((risk) => !GENERIC_RISK_TITLES.has(risk.title.toLowerCase()));
    const baseCandidates = hasSpecificIncoming
      ? getRiskCandidates().filter((risk) => !GENERIC_RISK_TITLES.has(String(risk.title || '').toLowerCase()))
      : getRiskCandidates();
    const merged = mergeRisks(baseCandidates, incomingRisks);
    const existingIds = new Set(Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
    const selectedIds = merged
      .filter((risk) => existingIds.has(risk.id) || (selectNew && incomingTitles.has(risk.title.toLowerCase())))
      .map((risk) => risk.id);
    AppState.draft.riskCandidates = merged;
    AppState.draft.selectedRiskIds = selectedIds;
    AppState.draft.selectedRisks = merged.filter((risk) => selectedIds.includes(risk.id));
  }

  function replaceSuggestedRiskCandidates(incoming, { selectNew = true } = {}) {
    const incomingRisks = mergeRisks([], incoming || []);
    const incomingTitles = new Set(incomingRisks.map((risk) => risk.title.toLowerCase()));
    const existingIds = new Set(Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
    // When the analyst refreshes Step 1 suggestions, stale AI/register cards from the previous draft make the shortlist look unrelated.
    const preservedCandidates = getRiskCandidates().filter((risk) => !isRefreshableSuggestedRiskSource(risk?.source));
    const merged = mergeRisks(preservedCandidates, incomingRisks);
    const selectedIds = merged
      .filter((risk) => existingIds.has(risk.id) || (selectNew && incomingTitles.has(risk.title.toLowerCase())))
      .map((risk) => risk.id);
    AppState.draft.riskCandidates = merged;
    AppState.draft.selectedRiskIds = selectedIds;
    AppState.draft.selectedRisks = merged.filter((risk) => selectedIds.includes(risk.id));
  }

  function normaliseLensKey(lens) {
    const rawValues = lens && typeof lens === 'object'
      ? [lens.key, lens.label, lens.functionKey, lens.estimatePresetKey]
      : [lens];
    const aliasMap = {
      ransomware: 'ransomware',
      identity: 'identity',
      phishing: 'phishing',
      insider: 'insider',
      cloud: 'cloud',
      'data breach': 'data-breach',
      'data-breach': 'data-breach',
      technology: 'cyber',
      cyber: 'cyber',
      ai: 'ai-model-risk',
      'ai risk': 'ai-model-risk',
      'ai-model-risk': 'ai-model-risk',
      'model risk': 'ai-model-risk',
      'responsible ai': 'ai-model-risk',
      'data governance': 'data-governance',
      'data-governance': 'data-governance',
      privacy: 'data-governance',
      'data governance / privacy': 'data-governance',
      'fraud-integrity': 'fraud-integrity',
      'fraud / integrity': 'fraud-integrity',
      fraud: 'fraud-integrity',
      integrity: 'fraud-integrity',
      'financial crime': 'fraud-integrity',
      legal: 'legal-contract',
      contract: 'legal-contract',
      litigation: 'legal-contract',
      ip: 'legal-contract',
      'legal / contract': 'legal-contract',
      'legal-contract': 'legal-contract',
      geopolitical: 'geopolitical',
      sanctions: 'geopolitical',
      sovereign: 'geopolitical',
      'market access': 'geopolitical',
      'physical security': 'physical-security',
      'physical-security': 'physical-security',
      facilities: 'physical-security',
      'executive protection': 'physical-security',
      ot: 'ot-resilience',
      'ot resilience': 'ot-resilience',
      'ot-resilience': 'ot-resilience',
      'industrial control': 'ot-resilience',
      'site systems': 'ot-resilience',
      people: 'people-workforce',
      workforce: 'people-workforce',
      labour: 'people-workforce',
      labor: 'people-workforce',
      'human rights': 'people-workforce',
      'people / workforce': 'people-workforce',
      'people-workforce': 'people-workforce',
      investment: 'investment-jv',
      'joint venture': 'investment-jv',
      'investment-jv': 'investment-jv',
      'transformation delivery': 'transformation-delivery',
      'transformation-delivery': 'transformation-delivery',
      'third party': 'third-party',
      'third-party': 'third-party',
      procurement: 'procurement',
      'supply chain': 'supply-chain',
      'supply-chain': 'supply-chain',
      strategic: 'strategic',
      operations: 'operational',
      operational: 'operational',
      regulatory: 'regulatory',
      finance: 'financial',
      financial: 'financial',
      esg: 'esg',
      compliance: 'compliance',
      continuity: 'business-continuity',
      'business continuity': 'business-continuity',
      'business-continuity': 'business-continuity',
      hse: 'hse',
      general: 'general'
    };
    for (const raw of rawValues) {
      const key = String(raw || '').trim().toLowerCase();
      if (!key) continue;
      if (aliasMap[key]) return aliasMap[key];
    }
    return '';
  }

  function riskMatchesLens(risk, lens) {
    const lensKey = normaliseLensKey(lens);
    const secondaryKeys = Array.isArray(lens?.secondaryKeys)
      ? lens.secondaryKeys.map(item => normaliseLensKey(item)).filter(Boolean)
      : [];
    const activeLensKeys = [lensKey, ...secondaryKeys].filter((value, index, list) => value && list.indexOf(value) === index);
    if (!activeLensKeys.length || (activeLensKeys.length === 1 && activeLensKeys[0] === 'general')) return true;
    const category = String(risk?.category || '').trim().toLowerCase();
    const title = String(risk?.title || '').trim().toLowerCase();
    const compatibility = {
      'ai-model-risk': ['ai / model risk', 'ai-model-risk', 'data governance', 'compliance', 'cyber'],
      'data-governance': ['data governance', 'privacy', 'regulatory', 'compliance', 'cyber'],
      procurement: ['procurement', 'supply chain', 'third-party', 'third party'],
      'supply-chain': ['supply chain', 'procurement', 'third-party', 'third party'],
      'third-party': ['third-party', 'third party', 'procurement', 'supply chain'],
      compliance: ['compliance', 'regulatory'],
      regulatory: ['regulatory', 'compliance'],
      operational: ['operational', 'business continuity'],
      'business-continuity': ['business continuity', 'operational'],
      strategic: ['strategic'],
      financial: ['financial'],
      'fraud-integrity': ['fraud / integrity', 'financial', 'compliance', 'regulatory'],
      'legal-contract': ['legal / contract', 'compliance', 'regulatory', 'procurement'],
      geopolitical: ['geopolitical', 'strategic', 'regulatory', 'supply chain'],
      'physical-security': ['physical security', 'operational', 'business continuity', 'hse'],
      'ot-resilience': ['ot resilience', 'operational', 'cyber', 'hse', 'business continuity'],
      'people-workforce': ['people / workforce', 'hse', 'esg', 'operational', 'compliance'],
      'investment-jv': ['investment / jv', 'strategic', 'financial'],
      'transformation-delivery': ['transformation delivery', 'strategic', 'operational'],
      esg: ['esg'],
      hse: ['hse'],
      cyber: ['cyber', 'identity', 'data protection', 'operational resilience', 'financial crime']
    };
    return activeLensKeys.some((key) => (compatibility[key] || [key]).some(term => category.includes(term) || title.includes(term)));
  }

  function getAlignedRiskSeed(aiRisks, narrative, lens, { riskSource = 'ai', serverAuthoritative = false } = {}) {
    const resolvedAiRisks = (Array.isArray(aiRisks) ? aiRisks : []).map((risk) => ({
      ...risk,
      source: normaliseRiskSource(risk?.source, riskSource)
    }));
    const hintedRisks = guessRisksFromText(narrative, { lensHint: lens }).map((risk) => ({
      ...risk,
      source: normaliseRiskSource(risk?.source, riskSource)
    }));
    const alignedAiRisks = resolvedAiRisks.filter((risk) => riskMatchesLens(risk, lens));
    if (alignedAiRisks.length) return serverAuthoritative ? alignedAiRisks : mergeRisks(alignedAiRisks, hintedRisks);
    if (serverAuthoritative && resolvedAiRisks.length) return resolvedAiRisks;
    return hintedRisks.length ? hintedRisks : resolvedAiRisks;
  }

  function getLinkedRiskRecommendations(selectedRisks) {
    const groups = [
      {
        label: 'Technology control weakness -> service disruption',
        test: (risk) => /patch|monitor|control|documentation|issue tracking|assessment/i.test(`${risk.title} ${risk.description}`)
      },
      {
        label: 'Third-party governance -> operational disruption',
        test: (risk) => /vendor|supplier|third-party|supplier assurance|due diligence/i.test(`${risk.title} ${risk.description}`)
      },
      {
        label: 'Compliance lapse -> regulatory exposure',
        test: (risk) => /compliance|certification|policy|attestation/i.test(`${risk.title} ${risk.description}`)
      }
    ];
    return groups
      .map((group) => ({
        label: group.label,
        risks: selectedRisks.filter(group.test).map((risk) => risk.title)
      }))
      .filter((group) => group.risks.length > 1);
  }

  function getScenarioMultipliers() {
    const riskCount = Math.max(1, getSelectedRisks().length);
    const linked = !!AppState.draft.linkedRisks && riskCount > 1;
    return {
      riskCount,
      linked,
      tefMultiplier: 1 + (riskCount - 1) * (linked ? 0.35 : 0.18),
      lossMultiplier: 1 + (riskCount - 1) * (linked ? 0.22 : 0.10),
      secondaryMultiplier: 1 + (riskCount - 1) * (linked ? 0.25 : 0.08)
    };
  }

  function deriveApplicableRegulations(bu, selectedRisks = [], geographies = getScenarioGeographies()) {
    const settings = getEffectiveSettings();
    const tags = [
      ...settings.applicableRegulations,
      ...(bu?.regulatoryTags || []),
      ...deriveGeographyRegulations(geographies),
      ...selectedRisks.flatMap((risk) => risk.regulations || [])
    ].filter(Boolean);
    return Array.from(new Set(tags));
  }

  function buildCitationIdentityKey(citation = {}) {
    return [
      citation?.docId || '',
      citation?.title || '',
      citation?.url || '',
      citation?.excerpt || ''
    ]
      .join('|')
      .trim()
      .toLowerCase();
  }

  function mergeCitationMetadata(citations, metadataCitations) {
    const metadataByKey = new Map(
      (Array.isArray(metadataCitations) ? metadataCitations : [])
        .map((citation) => [buildCitationIdentityKey(citation), citation])
        .filter(([key]) => !!key)
    );
    return (Array.isArray(citations) ? citations : []).map((citation) => {
      const metadata = metadataByKey.get(buildCitationIdentityKey(citation));
      return metadata ? { ...metadata, ...citation } : citation;
    });
  }

  function normaliseCitations(citations) {
    const list = Array.isArray(citations) ? citations : [];
    const seen = new Set();
    const unique = list.filter((citation) => {
      const key = buildCitationIdentityKey(citation);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const sourcePriority = (citation) => {
      const type = String(citation?.sourceType || '').toLowerCase();
      if (type.includes('standard') || type.includes('regulatory')) return 0;
      if (type.includes('internal')) return 1;
      if (type.includes('reference')) return 2;
      return 3;
    };
    return unique.sort((a, b) => {
      const scoreDiff = Number(b?.score || 0) - Number(a?.score || 0);
      if (scoreDiff) return scoreDiff;
      const sourceDiff = sourcePriority(a) - sourcePriority(b);
      if (sourceDiff) return sourceDiff;
      return new Date(b?.lastUpdated || 0).getTime() - new Date(a?.lastUpdated || 0).getTime();
    });
  }

  function getScenarioAssistSeedNarrative(currentValue) {
    const current = String(currentValue || '').trim();
    const enhanced = String(AppState.draft.enhancedNarrative || '').trim();
    const base = String(AppState.draft.narrative || '').trim();
    if (current && enhanced && base && current === enhanced) return base;
    return current || enhanced || base;
  }

  function clearScenarioAssistArtifacts({ clearGeneratedRisks = false } = {}) {
    AppState.draft.llmAssisted = false;
    AppState.draft.step1ConversationFingerprint = '';
    AppState.draft.scenarioTitle = '';
    AppState.draft.enhancedNarrative = '';
    AppState.draft.aiNarrativeBaseline = '';
    AppState.draft.intakeSummary = '';
    AppState.draft.linkAnalysis = '';
    AppState.draft.workflowGuidance = [];
    AppState.draft.benchmarkBasis = '';
    AppState.draft.confidenceLabel = '';
    AppState.draft.evidenceQuality = '';
    AppState.draft.evidenceSummary = '';
    AppState.draft.aiQualityState = '';
    AppState.draft.primaryGrounding = [];
    AppState.draft.supportingReferences = [];
    AppState.draft.inferredAssumptions = [];
    AppState.draft.missingInformation = [];
    AppState.draft.aiAlignment = null;
    AppState.draft.citations = [];
    if (!clearGeneratedRisks) return;
    const preservedCandidates = getRiskCandidates().filter((risk) => !isRefreshableSuggestedRiskSource(risk?.source));
    const selectedIds = new Set(Array.isArray(AppState.draft.selectedRiskIds) ? AppState.draft.selectedRiskIds : []);
    AppState.draft.riskCandidates = preservedCandidates;
    AppState.draft.selectedRiskIds = preservedCandidates
      .filter((risk) => selectedIds.has(risk.id))
      .map((risk) => risk.id);
    AppState.draft.selectedRisks = preservedCandidates.filter((risk) => AppState.draft.selectedRiskIds.includes(risk.id));
  }

  function normaliseScenarioSeedText(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const sentences = raw.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    const seen = new Set();
    const filtered = sentences.filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      if (/^in .*faces a material .*scenario in which/i.test(sentence)) return false;
      if (/^this scenario should be assessed/i.test(sentence)) return false;
      if (/^a likely progression is/i.test(sentence)) return false;
      if (/^in practice, this can drive/i.test(sentence)) return false;
      if (/^given the stated urgency/i.test(sentence)) return false;
      if (/^current urgency is assessed as /i.test(sentence)) return false;
      return true;
    });
    return filtered.join(' ').trim() || raw;
  }

  function getIntakeAssistSeedNarrative(currentValue) {
    const current = normaliseScenarioSeedText(currentValue);
    const source = normaliseScenarioSeedText(AppState.draft.sourceNarrative || '');
    const base = normaliseScenarioSeedText(AppState.draft.narrative || '');
    const enhanced = normaliseScenarioSeedText(AppState.draft.enhancedNarrative || '');
    const continuitySeeds = [source, base, enhanced].filter(Boolean);
    if (current && continuitySeeds.length) {
      const currentTokens = Array.from(new Set(String(current || '').split(/[^a-z0-9]+/).filter(Boolean)));
      const bestContinuity = continuitySeeds.reduce((bestScore, seed) => {
        const seedTokens = Array.from(new Set(String(seed || '').split(/[^a-z0-9]+/).filter(Boolean)));
        if (!currentTokens.length || !seedTokens.length) return bestScore;
        const seedTokenSet = new Set(seedTokens);
        const overlap = currentTokens.filter((token) => seedTokenSet.has(token)).length;
        const score = (overlap * 2) / (currentTokens.length + seedTokens.length);
        return Math.max(bestScore, score);
      }, 0);
      if (bestContinuity < 0.55) return current;
    }
    if (current && enhanced && current === enhanced && (source || base)) return source || base;
    return source || current || base || enhanced;
  }

  function buildScenarioNarrative(introOverride = '') {
    const selected = getSelectedRisks();
    const titles = selected.map((risk) => risk.title);
    const intro = String(introOverride || AppState.draft.enhancedNarrative || AppState.draft.narrative || '').trim();
    if (!titles.length) return intro;
    const linkage = AppState.draft.linkedRisks && titles.length > 1
      ? 'These risks should be treated as linked and capable of cascading into one another.'
      : 'These risks may be assessed together but should be treated as distinct drivers.';
    return `${intro}\n\nSelected risks:\n- ${titles.join('\n- ')}\n\n${linkage}`.trim();
  }

  // Keep scenario-assist and register-ingestion mutations in one seam so Step 1 orchestration
  // no longer owns the draft-shaping rules itself.
  function applyScenarioAssistResultToDraft(result, {
    narrative = '',
    assistSeed = '',
    bu = null,
    citations = [],
    nextNarrative = ''
  } = {}) {
    const resolvedNarrative = nextNarrative || result.enhancedStatement || narrative;
    const suggestedRiskSource = AppState.draft.registerFindings ? 'ai+register' : 'ai';
    const nextScenarioLens = result?.scenarioLens && typeof result.scenarioLens === 'object'
      ? { ...result.scenarioLens }
      : (AppState.draft.scenarioLens || null);
    const alignedRisks = getAlignedRiskSeed(result.risks, resolvedNarrative || narrative, nextScenarioLens, {
      riskSource: suggestedRiskSource,
      serverAuthoritative: true
    });
    AppState.draft.llmAssisted = true;
    AppState.draft.sourceNarrative = assistSeed || narrative;
    AppState.draft.narrative = assistSeed || narrative;
    AppState.draft.enhancedNarrative = resolvedNarrative;
    AppState.draft.aiNarrativeBaseline = resolvedNarrative;
    AppState.draft.intakeSummary = result.summary || AppState.draft.intakeSummary || '';
    AppState.draft.linkAnalysis = result.linkAnalysis || AppState.draft.linkAnalysis || '';
    // Keep one canonical scenario lens on the draft so Step 3, learning, and benchmarking stop re-inferring the scenario in different ways.
    AppState.draft.scenarioLens = nextScenarioLens;
    AppState.draft.workflowGuidance = Array.isArray(result.workflowGuidance) ? result.workflowGuidance : AppState.draft.workflowGuidance;
    AppState.draft.benchmarkBasis = result.benchmarkBasis || AppState.draft.benchmarkBasis;
    AppState.draft.aiAlignment = result?.aiAlignment && typeof result.aiAlignment === 'object'
      ? { ...result.aiAlignment }
      : (AppState.draft.aiAlignment || null);
    // Keep one canonical structured-scenario object on the draft so later steps stop reading mixed legacy keys.
    AppState.draft.structuredScenario = normaliseStructuredScenario(result?.structuredScenario || AppState.draft.structuredScenario, {
      preserveUnknown: true
    });
    AppState.draft.aiQualityState = result.usedFallback ? 'fallback' : 'ai';
    AppState.draft.confidenceLabel = result.confidenceLabel || AppState.draft.confidenceLabel || '';
    AppState.draft.evidenceQuality = result.evidenceQuality || AppState.draft.evidenceQuality || '';
    AppState.draft.evidenceSummary = result.evidenceSummary || AppState.draft.evidenceSummary || '';
    AppState.draft.primaryGrounding = Array.isArray(result.primaryGrounding) ? result.primaryGrounding : (AppState.draft.primaryGrounding || []);
    AppState.draft.supportingReferences = Array.isArray(result.supportingReferences) ? result.supportingReferences : (AppState.draft.supportingReferences || []);
    AppState.draft.inferredAssumptions = Array.isArray(result.inferredAssumptions) ? result.inferredAssumptions : (AppState.draft.inferredAssumptions || []);
    AppState.draft.missingInformation = Array.isArray(result.missingInformation) ? result.missingInformation : (AppState.draft.missingInformation || []);
    // Refresh AI-generated suggestions from the current scenario so old AI/register cards do not stay selected after the analyst rewrites the draft.
    replaceSuggestedRiskCandidates(alignedRisks, { selectNew: true });
    AppState.draft.applicableRegulations = Array.from(new Set([
      ...(deriveApplicableRegulations(bu, getSelectedRisks(), getScenarioGeographies()) || []),
      ...(result.regulations || [])
    ]));
    AppState.draft.citations = normaliseCitations(result.citations || citations);
    AppState.draft.scenarioTitle = typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle({
          ...AppState.draft,
          scenarioTitle: String(result?.scenarioTitle || AppState.draft.scenarioTitle || '').trim(),
          narrative: assistSeed || narrative || AppState.draft.narrative,
          sourceNarrative: assistSeed || narrative || AppState.draft.sourceNarrative,
          enhancedNarrative: resolvedNarrative || AppState.draft.enhancedNarrative,
          selectedRisks: getSelectedRisks()
        })
      : (String(result?.scenarioTitle || '').trim() || getSelectedRisks()[0]?.title || AppState.draft.scenarioTitle || '');
  }

  function applyScenarioShortlistResultToDraft(result, {
    narrative = '',
    bu = null,
    citations = []
  } = {}) {
    const resolvedNarrative = String(narrative || AppState.draft.enhancedNarrative || AppState.draft.narrative || AppState.draft.sourceNarrative || '').trim();
    const suggestedRiskSource = AppState.draft.registerFindings ? 'ai+register' : 'ai';
    const nextScenarioLens = result?.scenarioLens && typeof result.scenarioLens === 'object'
      ? { ...result.scenarioLens }
      : (AppState.draft.scenarioLens || null);
    const alignedRisks = getAlignedRiskSeed(result.risks, resolvedNarrative, nextScenarioLens, {
      riskSource: suggestedRiskSource,
      serverAuthoritative: true
    });
    AppState.draft.llmAssisted = true;
    AppState.draft.intakeSummary = result.summary || AppState.draft.intakeSummary || '';
    AppState.draft.linkAnalysis = result.linkAnalysis || AppState.draft.linkAnalysis || '';
    AppState.draft.scenarioLens = nextScenarioLens;
    AppState.draft.workflowGuidance = Array.isArray(result.workflowGuidance) ? result.workflowGuidance : AppState.draft.workflowGuidance;
    AppState.draft.benchmarkBasis = result.benchmarkBasis || AppState.draft.benchmarkBasis;
    AppState.draft.aiAlignment = result?.aiAlignment && typeof result.aiAlignment === 'object'
      ? { ...result.aiAlignment }
      : (AppState.draft.aiAlignment || null);
    AppState.draft.structuredScenario = normaliseStructuredScenario(result?.structuredScenario || AppState.draft.structuredScenario, {
      preserveUnknown: true
    });
    AppState.draft.aiQualityState = result.usedFallback ? 'fallback' : (result.mode === 'manual' ? '' : 'ai');
    AppState.draft.confidenceLabel = result.confidenceLabel || AppState.draft.confidenceLabel || '';
    AppState.draft.evidenceQuality = result.evidenceQuality || AppState.draft.evidenceQuality || '';
    AppState.draft.evidenceSummary = result.evidenceSummary || AppState.draft.evidenceSummary || '';
    AppState.draft.primaryGrounding = Array.isArray(result.primaryGrounding) ? result.primaryGrounding : (AppState.draft.primaryGrounding || []);
    AppState.draft.supportingReferences = Array.isArray(result.supportingReferences) ? result.supportingReferences : (AppState.draft.supportingReferences || []);
    AppState.draft.inferredAssumptions = Array.isArray(result.inferredAssumptions) ? result.inferredAssumptions : (AppState.draft.inferredAssumptions || []);
    AppState.draft.missingInformation = Array.isArray(result.missingInformation) ? result.missingInformation : (AppState.draft.missingInformation || []);
    replaceSuggestedRiskCandidates(alignedRisks, { selectNew: true });
    AppState.draft.applicableRegulations = Array.from(new Set([
      ...(deriveApplicableRegulations(bu, getSelectedRisks(), getScenarioGeographies()) || []),
      ...(result.regulations || [])
    ]));
    AppState.draft.citations = normaliseCitations(result.citations || citations || AppState.draft.citations || []);
    AppState.draft.scenarioTitle = typeof resolveScenarioDisplayTitle === 'function'
      ? resolveScenarioDisplayTitle({
          ...AppState.draft,
          scenarioTitle: String(result?.scenarioTitle || AppState.draft.scenarioTitle || '').trim(),
          narrative: resolvedNarrative || AppState.draft.narrative,
          sourceNarrative: resolvedNarrative || AppState.draft.sourceNarrative,
          enhancedNarrative: AppState.draft.enhancedNarrative,
          selectedRisks: getSelectedRisks()
        })
      : (String(result?.scenarioTitle || '').trim() || getSelectedRisks()[0]?.title || AppState.draft.scenarioTitle || '');
    return alignedRisks;
  }

  function applyRegisterAnalysisResultToDraft(result, { parsedFallback = [] } = {}) {
    const defaultRegisterRiskSource = result?.usedFallback ? 'register' : 'ai+register';
    const extractedRisks = (Array.isArray(result?.risks) && result.risks.length ? result.risks : parsedFallback)
      .map((risk) => ({
        ...risk,
        source: normaliseRiskSource(risk?.source, defaultRegisterRiskSource)
      }));
    replaceSuggestedRiskCandidates(extractedRisks, { selectNew: true });
    const workbookSummary = AppState.draft.registerMeta?.sheetCount > 1 ? ` across ${AppState.draft.registerMeta.sheetCount} sheets` : '';
    AppState.draft.intakeSummary = result.summary || `Extracted ${getSelectedRisks().length} risks from ${AppState.draft.uploadedRegisterName}${workbookSummary}.`;
    AppState.draft.linkAnalysis = result.linkAnalysis || AppState.draft.linkAnalysis;
    AppState.draft.scenarioLens = result?.scenarioLens && typeof result.scenarioLens === 'object'
      ? { ...result.scenarioLens }
      : (AppState.draft.scenarioLens || null);
    AppState.draft.workflowGuidance = Array.isArray(result.workflowGuidance) ? result.workflowGuidance : AppState.draft.workflowGuidance;
    AppState.draft.benchmarkBasis = result.benchmarkBasis || AppState.draft.benchmarkBasis;
    AppState.draft.aiAlignment = result?.aiAlignment && typeof result.aiAlignment === 'object'
      ? { ...result.aiAlignment }
      : (AppState.draft.aiAlignment || null);
    AppState.draft.aiQualityState = result.usedFallback ? 'fallback' : 'ai';
    AppState.draft.confidenceLabel = result.confidenceLabel || AppState.draft.confidenceLabel || '';
    AppState.draft.evidenceQuality = result.evidenceQuality || AppState.draft.evidenceQuality || '';
    AppState.draft.evidenceSummary = result.evidenceSummary || AppState.draft.evidenceSummary || '';
    AppState.draft.primaryGrounding = Array.isArray(result.primaryGrounding) ? result.primaryGrounding : (AppState.draft.primaryGrounding || []);
    AppState.draft.supportingReferences = Array.isArray(result.supportingReferences) ? result.supportingReferences : (AppState.draft.supportingReferences || []);
    AppState.draft.inferredAssumptions = Array.isArray(result.inferredAssumptions) ? result.inferredAssumptions : (AppState.draft.inferredAssumptions || []);
    AppState.draft.missingInformation = Array.isArray(result.missingInformation) ? result.missingInformation : (AppState.draft.missingInformation || []);
    return extractedRisks;
  }

  global.DraftScenarioState = {
    normaliseRisk,
    mergeRisks,
    getRiskCandidates,
    syncRiskSelection,
    getSelectedRisks,
    appendRiskCandidates,
    replaceSuggestedRiskCandidates,
    clearScenarioAssistArtifacts,
    riskMatchesLens,
    getLinkedRiskRecommendations,
    getScenarioMultipliers,
    deriveApplicableRegulations,
    normaliseCitations,
    normaliseScenarioSeedText,
    getScenarioAssistSeedNarrative,
    getIntakeAssistSeedNarrative,
    buildScenarioNarrative,
    applyScenarioAssistResultToDraft,
    applyScenarioShortlistResultToDraft,
    applyRegisterAnalysisResultToDraft
  };

  Object.assign(global, {
    normaliseRisk,
    mergeRisks,
    getRiskCandidates,
    syncRiskSelection,
    getSelectedRisks,
    appendRiskCandidates,
    replaceSuggestedRiskCandidates,
    clearScenarioAssistArtifacts,
    riskMatchesLens,
    getLinkedRiskRecommendations,
    getScenarioMultipliers,
    deriveApplicableRegulations,
    normaliseCitations,
    normaliseScenarioSeedText,
    getScenarioAssistSeedNarrative,
    getIntakeAssistSeedNarrative,
    buildScenarioNarrative
  });
})(window);
