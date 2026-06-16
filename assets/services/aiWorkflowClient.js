const AiWorkflowClient = (() => {
  const RECENT_RESULT_TTL_MS = 10000;
  const MAX_RECENT_RESULTS = 24;

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function stableStringify(value) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (isPlainObject(value)) {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function cloneJsonValue(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normaliseInlineText(value = '') {
    return String(value || '')
      .replace(/\r?\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normaliseBlockText(value = '') {
    return String(value || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normaliseUrlLike(value = '') {
    return String(value || '').trim();
  }

  function normaliseNumber(value) {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && !value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function compactValue(value) {
    if (Array.isArray(value)) {
      const next = value
        .map((item) => compactValue(item))
        .filter((item) => item !== undefined);
      return next.length ? next : undefined;
    }
    if (isPlainObject(value)) {
      const next = {};
      Object.entries(value).forEach(([key, item]) => {
        const compacted = compactValue(item);
        if (compacted !== undefined) next[key] = compacted;
      });
      return Object.keys(next).length ? next : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? value : undefined;
    }
    if (value == null) return undefined;
    return value;
  }

  function normaliseLooseWorkflowValue(value, depth = 0) {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') return normaliseBlockText(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      if (depth >= 3) return undefined;
      const next = value
        .slice(0, 30)
        .map((item) => normaliseLooseWorkflowValue(item, depth + 1))
        .filter((item) => item !== undefined && item !== '');
      return next.length ? next : undefined;
    }
    if (isPlainObject(value)) {
      if (depth >= 3) return undefined;
      const next = {};
      Object.entries(value).slice(0, 40).forEach(([key, item]) => {
        const cleanKey = normaliseInlineText(key);
        const cleanItem = normaliseLooseWorkflowValue(item, depth + 1);
        if (cleanKey && cleanItem !== undefined && cleanItem !== '') next[cleanKey] = cleanItem;
      });
      return Object.keys(next).length ? next : undefined;
    }
    return undefined;
  }

  function normaliseLooseWorkflowObject(value = {}) {
    const next = normaliseLooseWorkflowValue(value);
    return isPlainObject(next) ? next : undefined;
  }

  function normaliseStringList(items = [], {
    maxItems = 12,
    block = false,
    dedupe = true
  } = {}) {
    const source = Array.isArray(items) ? items : [];
    const seen = new Set();
    const result = [];
    source.forEach((item) => {
      const value = block ? normaliseBlockText(item) : normaliseInlineText(item);
      if (!value) return;
      const key = value.toLowerCase();
      if (dedupe && seen.has(key)) return;
      seen.add(key);
      if (result.length < maxItems) result.push(value);
    });
    return result;
  }

  function normaliseCitation(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      title: normaliseInlineText(item.title || item.sourceTitle || item.note || ''),
      sourceTitle: normaliseInlineText(item.sourceTitle || ''),
      excerpt: normaliseBlockText(item.excerpt || item.description || item.text || item.note || ''),
      url: normaliseUrlLike(item.url || item.link || ''),
      sourceUrl: normaliseUrlLike(item.sourceUrl || ''),
      relevanceReason: normaliseBlockText(item.relevanceReason || ''),
      score: normaliseNumber(item.score)
    });
  }

  function normaliseCitations(items = [], { maxItems = 8 } = {}) {
    return (Array.isArray(items) ? items : [])
      .map((item) => normaliseCitation(item))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  function normaliseEvidenceRagMatch(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      id: normaliseInlineText(item.id || ''),
      evidenceId: normaliseInlineText(item.evidenceId || ''),
      documentId: normaliseInlineText(item.documentId || ''),
      chunkId: normaliseInlineText(item.chunkId || ''),
      title: normaliseInlineText(item.title || item.sourceTitle || item.name || ''),
      sourceTitle: normaliseInlineText(item.sourceTitle || ''),
      fileName: normaliseInlineText(item.fileName || ''),
      excerpt: normaliseBlockText(item.excerpt || item.text || item.content || item.chunkText || item.snippet || ''),
      text: normaliseBlockText(item.text || item.snippet || item.excerpt || ''),
      url: normaliseUrlLike(item.url || item.sourceUrl || item.link || ''),
      relevanceReason: normaliseBlockText(item.relevanceReason || item.reason || ''),
      score: normaliseNumber(item.score),
      citation: isPlainObject(item.citation) ? compactValue({
        evidenceId: normaliseInlineText(item.citation.evidenceId || ''),
        chunkId: normaliseInlineText(item.citation.chunkId || ''),
        title: normaliseInlineText(item.citation.title || '')
      }) : undefined,
      metadata: isPlainObject(item.metadata) ? normaliseLooseWorkflowObject(item.metadata) : undefined
    });
  }

  function normaliseEvidenceDocument(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      evidenceId: normaliseInlineText(item.evidenceId || item.id || item.documentId || ''),
      documentId: normaliseInlineText(item.documentId || item.evidenceId || item.id || ''),
      title: normaliseInlineText(item.title || item.name || ''),
      fileName: normaliseInlineText(item.fileName || item.name || ''),
      text: normaliseBlockText(item.text || item.content || ''),
      summary: normaliseBlockText(item.summary || ''),
      excerpt: normaliseBlockText(item.excerpt || item.snippet || ''),
      sourceType: normaliseInlineText(item.sourceType || ''),
      extractionStatus: normaliseInlineText(item.extractionStatus || ''),
      documentType: normaliseInlineText(item.documentType || ''),
      tags: normaliseStringList(item.tags, { maxItems: 16 }),
      domains: normaliseStringList(item.domains, { maxItems: 16 })
    });
  }

  function normaliseEvidenceIndexPayload(source = {}) {
    const documents = Array.isArray(source.documents)
      ? source.documents.map(normaliseEvidenceDocument).filter(Boolean).slice(0, 24)
      : undefined;
    return compactValue({
      caseId: normaliseInlineText(source.caseId || ''),
      documents,
      evidenceId: normaliseInlineText(source.evidenceId || ''),
      title: normaliseInlineText(source.title || ''),
      fileName: normaliseInlineText(source.fileName || ''),
      text: normaliseBlockText(source.text || ''),
      summary: normaliseBlockText(source.summary || ''),
      excerpt: normaliseBlockText(source.excerpt || ''),
      sourceType: normaliseInlineText(source.sourceType || ''),
      extractionStatus: normaliseInlineText(source.extractionStatus || ''),
      purpose: normaliseInlineText(source.purpose || '')
    }) || {};
  }

  function normaliseEvidenceSearchPayload(source = {}) {
    return compactValue({
      caseId: normaliseInlineText(source.caseId || ''),
      query: normaliseBlockText(source.query || ''),
      topK: normaliseNumber(source.topK),
      limit: normaliseNumber(source.limit),
      purpose: normaliseInlineText(source.purpose || '')
    }) || {};
  }

  function normaliseResolvedObligationEntry(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      title: normaliseInlineText(item.title || ''),
      sourceEntityName: normaliseInlineText(item.sourceEntityName || ''),
      text: normaliseBlockText(item.text || '')
    });
  }

  function normaliseResolvedObligationContext(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      summary: normaliseBlockText(value.summary || ''),
      direct: (Array.isArray(value.direct) ? value.direct : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6),
      inheritedMandatory: (Array.isArray(value.inheritedMandatory) ? value.inheritedMandatory : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6),
      inheritedConditional: (Array.isArray(value.inheritedConditional) ? value.inheritedConditional : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6),
      inheritedGuidance: (Array.isArray(value.inheritedGuidance) ? value.inheritedGuidance : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6)
    });
  }

  function normaliseBusinessUnit(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      id: normaliseInlineText(value.id || ''),
      buId: normaliseInlineText(value.buId || ''),
      name: normaliseInlineText(value.name || ''),
      geography: normaliseInlineText(value.geography || ''),
      functionKey: normaliseInlineText(value.functionKey || ''),
      selectedDepartmentKey: normaliseInlineText(value.selectedDepartmentKey || ''),
      scenarioLensHint: normaliseInlineText(value.scenarioLensHint || ''),
      contextSummary: normaliseBlockText(value.contextSummary || ''),
      notes: normaliseBlockText(value.notes || ''),
      selectedDepartmentContext: normaliseBlockText(value.selectedDepartmentContext || ''),
      aiGuidance: normaliseBlockText(value.aiGuidance || '')
    });
  }

  function normaliseAdminSettings(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      geography: normaliseInlineText(value.geography || ''),
      applicableRegulations: normaliseStringList(value.applicableRegulations, { maxItems: 12 }),
      businessUnitContext: normaliseBlockText(value.businessUnitContext || ''),
      departmentContext: normaliseBlockText(value.departmentContext || ''),
      companyContextProfile: normaliseBlockText(value.companyContextProfile || ''),
      companyStructureContext: normaliseBlockText(value.companyStructureContext || ''),
      inheritedContextSummary: normaliseBlockText(value.inheritedContextSummary || ''),
      personalContextSummary: normaliseBlockText(value.personalContextSummary || ''),
      userProfileSummary: normaliseBlockText(value.userProfileSummary || ''),
      adminContextSummary: normaliseBlockText(value.adminContextSummary || ''),
      benchmarkStrategy: normaliseBlockText(value.benchmarkStrategy || ''),
      resolvedObligationSummary: normaliseBlockText(value.resolvedObligationSummary || ''),
      resolvedObligationContext: normaliseResolvedObligationContext(value.resolvedObligationContext)
    });
  }

  function normalisePriorMessages(items = [], { maxItems = 6 } = {}) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        if (!isPlainObject(item)) return undefined;
        return compactValue({
          role: normaliseInlineText(item.role || '').toLowerCase(),
          content: normaliseBlockText(item.content || '')
        });
      })
      .filter((item) => item?.role && item?.content)
      .slice(-maxItems);
  }

  function normaliseProjectContext(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      projectName: normaliseInlineText(value.projectName || ''),
      projectDescription: normaliseBlockText(value.projectDescription || ''),
      projectRole: normaliseInlineText(value.projectRole || ''),
      projectStage: normaliseInlineText(value.projectStage || ''),
      contractType: normaliseInlineText(value.contractType || ''),
      currency: normaliseInlineText(value.currency || ''),
      projectDurationMonths: normaliseNumber(value.projectDurationMonths),
      criticalMilestoneDate: normaliseInlineText(value.criticalMilestoneDate || ''),
      strategicImportance: normaliseInlineText(value.strategicImportance || '')
    });
  }

  function normaliseFinancialMetaMap(value = {}) {
    if (!isPlainObject(value)) return undefined;
    const output = {};
    Object.entries(value).slice(0, 40).forEach(([field, meta]) => {
      if (!isPlainObject(meta)) return;
      const key = normaliseInlineText(field);
      if (!key) return;
      const next = compactValue({
        status: normaliseInlineText(meta.status || ''),
        confidence: normaliseInlineText(meta.confidence || ''),
        source: normaliseInlineText(meta.source || ''),
        note: normaliseInlineText(meta.note || '')
      });
      if (next) output[key] = next;
    });
    return Object.keys(output).length ? output : undefined;
  }

  function normaliseFinancialMap(value = {}) {
    if (!isPlainObject(value)) return undefined;
    const output = {};
    Object.entries(value).slice(0, 40).forEach(([field, rawValue]) => {
      const key = normaliseInlineText(field);
      if (!key) return;
      const next = normaliseNumber(rawValue);
      if (next !== undefined) output[key] = next;
    });
    return Object.keys(output).length ? output : undefined;
  }

  function normaliseProxyAnswers(value = {}) {
    if (!isPlainObject(value)) return undefined;
    const output = {};
    Object.entries(value).slice(0, 30).forEach(([field, rawValue]) => {
      const key = normaliseInlineText(field);
      const next = normaliseInlineText(rawValue || '');
      if (key && next) output[key] = next;
    });
    return Object.keys(output).length ? output : undefined;
  }

  function normaliseProjectExposureSummary(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      valuationMode: normaliseInlineText(value.valuationMode || ''),
      projectExposureSummary: normaliseBlockText(value.projectExposureSummary || ''),
      projectInputQuality: isPlainObject(value.projectInputQuality) ? compactValue({
        score: normaliseNumber(value.projectInputQuality.score),
        label: normaliseInlineText(value.projectInputQuality.label || ''),
        knownHighImpactInputs: normaliseStringList(value.projectInputQuality.knownHighImpactInputs, { maxItems: 12 }),
        estimatedHighImpactInputs: normaliseStringList(value.projectInputQuality.estimatedHighImpactInputs, { maxItems: 12 }),
        unknownHighImpactInputs: normaliseStringList(value.projectInputQuality.unknownHighImpactInputs, { maxItems: 12 }),
        canProceed: value.projectInputQuality.canProceed === false ? false : true,
        recommendedNextInput: isPlainObject(value.projectInputQuality.recommendedNextInput) ? compactValue({
          field: normaliseInlineText(value.projectInputQuality.recommendedNextInput.field || ''),
          why: normaliseBlockText(value.projectInputQuality.recommendedNextInput.why || ''),
          whoMightKnow: normaliseInlineText(value.projectInputQuality.recommendedNextInput.whoMightKnow || ''),
          suggestedQuestion: normaliseBlockText(value.projectInputQuality.recommendedNextInput.suggestedQuestion || '')
        }) : undefined
      }) : undefined,
      financialDrivers: Array.isArray(value.financialDrivers) ? value.financialDrivers.slice(0, 20).map(compactValue).filter(Boolean) : undefined,
      capsAndOffsets: Array.isArray(value.capsAndOffsets) ? value.capsAndOffsets.slice(0, 20).map(compactValue).filter(Boolean) : undefined,
      doubleCountingWarnings: normaliseStringList(value.doubleCountingWarnings, { maxItems: 20, block: true }),
      missingInputs: Array.isArray(value.missingInputs) ? value.missingInputs.slice(0, 20).map(compactValue).filter(Boolean) : undefined,
      mapsToRiskParameters: isPlainObject(value.mapsToRiskParameters) ? compactValue(value.mapsToRiskParameters) : undefined
    });
  }

  function normaliseProjectExposureWorkflowPayload(source = {}) {
    return compactValue({
      assessmentType: normaliseInlineText(source.assessmentType || ''),
      riskStatement: normaliseBlockText(source.riskStatement || ''),
      projectContext: normaliseProjectContext(source.projectContext),
      buyerEconomics: normaliseFinancialMap(source.buyerEconomics),
      buyerEconomicsMeta: normaliseFinancialMetaMap(source.buyerEconomicsMeta),
      sellerEconomics: normaliseFinancialMap(source.sellerEconomics),
      sellerEconomicsMeta: normaliseFinancialMetaMap(source.sellerEconomicsMeta),
      buyerProxyAnswers: normaliseProxyAnswers(source.buyerProxyAnswers || source.buyerProxyQuestions),
      sellerProxyAnswers: normaliseProxyAnswers(source.sellerProxyAnswers || source.sellerProxyQuestions),
      businessUnit: normaliseBusinessUnit(source.businessUnit),
      geography: normaliseInlineText(source.geography || ''),
      applicableRegulations: normaliseStringList(source.applicableRegulations, { maxItems: 40 }),
      citations: normaliseCitations(source.citations, { maxItems: 10 }),
      adminSettings: normaliseAdminSettings(source.adminSettings),
      traceLabel: normaliseInlineText(source.traceLabel || ''),
      priorMessages: normalisePriorMessages(source.priorMessages, { maxItems: 8 })
    }) || {};
  }

  function normaliseValidationSummary(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      valid: value.valid === true ? true : value.valid === false ? false : undefined,
      errors: normaliseStringList(value.errors, { maxItems: 12, block: true }),
      warnings: normaliseStringList(value.warnings, { maxItems: 12, block: true })
    });
  }

  function normaliseParameterCoachPayload(source = {}) {
    return compactValue({
      assessmentType: normaliseInlineText(source.assessmentType || ''),
      scenario: normaliseBlockText(source.scenario || source.riskStatement || source.narrative || ''),
      structuredScenario: normaliseLooseWorkflowObject(source.structuredScenario),
      scenarioLens: isPlainObject(source.scenarioLens)
        ? normaliseLooseWorkflowObject(source.scenarioLens)
        : normaliseInlineText(source.scenarioLens || ''),
      projectContext: normaliseProjectContext(source.projectContext),
      projectExposure: normaliseProjectExposureSummary(source.projectExposure),
      parameters: normaliseFairParams(source.parameters || source.fairParams),
      validation: normaliseValidationSummary(source.validation),
      assumptionRegister: normaliseLooseWorkflowObject(source.assumptionRegister),
      evidenceMap: normaliseLooseWorkflowObject(source.evidenceMap),
      citations: normaliseCitations(source.citations, { maxItems: 10 }),
      businessContext: normaliseLooseWorkflowObject(source.businessContext),
      adminSettings: normaliseAdminSettings(source.adminSettings),
      results: normaliseResults(source.results),
      traceLabel: normaliseInlineText(source.traceLabel || ''),
      priorMessages: normalisePriorMessages(source.priorMessages, { maxItems: 8 })
    }) || {};
  }

  function normaliseEvidenceMapPayload(source = {}) {
    return compactValue({
      assessmentType: normaliseInlineText(source.assessmentType || ''),
      scenario: normaliseBlockText(source.scenario || source.narrative || ''),
      structuredScenario: normaliseLooseWorkflowObject(source.structuredScenario),
      riskStatement: normaliseBlockText(source.riskStatement || source.scenario || source.narrative || ''),
      projectContext: normaliseProjectContext(source.projectContext),
      projectExposure: normaliseProjectExposureSummary(source.projectExposure),
      assumptions: Array.isArray(source.assumptions)
        ? source.assumptions.slice(0, 30).map(normaliseLooseWorkflowValue).filter(Boolean)
        : undefined,
      parameters: normaliseFairParams(source.parameters || source.fairParams),
      citations: normaliseCitations(source.citations, { maxItems: 20 }),
      ragMatches: Array.isArray(source.ragMatches)
        ? source.ragMatches.slice(0, 20).map(normaliseEvidenceRagMatch).filter(Boolean)
        : undefined,
      businessContext: normaliseLooseWorkflowObject(source.businessContext),
      adminSettings: normaliseAdminSettings(source.adminSettings),
      traceLabel: normaliseInlineText(source.traceLabel || '')
    }) || {};
  }

  function normaliseDecisionChallengePayload(source = {}) {
    return compactValue({
      assessmentType: normaliseInlineText(source.assessmentType || ''),
      scenario: normaliseBlockText(source.scenario || source.riskStatement || source.narrative || ''),
      structuredScenario: normaliseLooseWorkflowObject(source.structuredScenario),
      scenarioLens: isPlainObject(source.scenarioLens)
        ? normaliseLooseWorkflowObject(source.scenarioLens)
        : normaliseInlineText(source.scenarioLens || ''),
      projectContext: normaliseProjectContext(source.projectContext),
      projectExposure: normaliseProjectExposureSummary(source.projectExposure),
      parameters: normaliseFairParams(source.parameters || source.fairParams),
      simulationResult: normaliseResults(source.simulationResult || source.results),
      assumptionRegister: normaliseLooseWorkflowObject(source.assumptionRegister),
      parameterCoach: normaliseLooseWorkflowObject(source.parameterCoach),
      evidenceMap: normaliseLooseWorkflowObject(source.evidenceMap),
      treatments: Array.isArray(source.treatments)
        ? source.treatments.slice(0, 20).map(normaliseLooseWorkflowValue).filter(Boolean)
        : undefined,
      riskAppetite: normaliseLooseWorkflowObject(source.riskAppetite),
      adminSettings: normaliseAdminSettings(source.adminSettings),
      traceLabel: normaliseInlineText(source.traceLabel || ''),
      priorMessages: normalisePriorMessages(source.priorMessages, { maxItems: 8 })
    }) || {};
  }

  function normaliseDecisionBriefPayload(source = {}) {
    return compactValue({
      assessmentType: normaliseInlineText(source.assessmentType || ''),
      scenario: normaliseBlockText(source.scenario || source.riskStatement || source.narrative || ''),
      structuredScenario: normaliseLooseWorkflowObject(source.structuredScenario),
      scenarioLens: isPlainObject(source.scenarioLens)
        ? normaliseLooseWorkflowObject(source.scenarioLens)
        : normaliseInlineText(source.scenarioLens || ''),
      projectContext: normaliseProjectContext(source.projectContext),
      projectExposure: normaliseProjectExposureSummary(source.projectExposure),
      simulationResult: normaliseResults(source.simulationResult || source.results),
      parameters: normaliseFairParams(source.parameters || source.fairParams),
      assumptionRegister: normaliseLooseWorkflowObject(source.assumptionRegister),
      parameterCoach: normaliseLooseWorkflowObject(source.parameterCoach),
      evidenceMap: normaliseLooseWorkflowObject(source.evidenceMap),
      decisionChallenge: normaliseLooseWorkflowObject(source.decisionChallenge),
      treatments: Array.isArray(source.treatments)
        ? source.treatments.slice(0, 20).map(normaliseLooseWorkflowValue).filter(Boolean)
        : undefined,
      riskAppetite: normaliseLooseWorkflowObject(source.riskAppetite),
      adminSettings: normaliseAdminSettings(source.adminSettings),
      traceLabel: normaliseInlineText(source.traceLabel || ''),
      priorMessages: normalisePriorMessages(source.priorMessages, { maxItems: 8 })
    }) || {};
  }

  function normaliseGuidedInput(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      event: normaliseBlockText(value.event || ''),
      impact: normaliseBlockText(value.impact || ''),
      cause: normaliseBlockText(value.cause || ''),
      asset: normaliseBlockText(value.asset || ''),
      urgency: normaliseInlineText(value.urgency || '').toLowerCase()
    });
  }

  function normaliseRegisterMeta(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      scenarioLensKey: normaliseInlineText(value.scenarioLensKey || ''),
      type: normaliseInlineText(value.type || '').toLowerCase(),
      extension: normaliseInlineText(value.extension || '').toLowerCase(),
      sheetSelectionMode: normaliseInlineText(value.sheetSelectionMode || '').toLowerCase()
    });
  }

  function normaliseScenarioLensHint(value = '') {
    if (isPlainObject(value)) {
      return compactValue({
        key: normaliseInlineText(value.key || ''),
        label: normaliseInlineText(value.label || ''),
        functionKey: normaliseInlineText(value.functionKey || ''),
        estimatePresetKey: normaliseInlineText(value.estimatePresetKey || ''),
        secondaryKeys: normaliseStringList(value.secondaryKeys, { maxItems: 4 })
      });
    }
    return normaliseInlineText(value || '');
  }

  function normaliseManualStep1Payload(source = {}) {
    return compactValue({
      riskStatement: normaliseBlockText(source.riskStatement || ''),
      registerText: normaliseBlockText(source.registerText || ''),
      registerMeta: normaliseRegisterMeta(source.registerMeta),
      scenarioLensHint: normaliseScenarioLensHint(source.scenarioLensHint),
      scenarioFingerprint: normaliseInlineText(source.scenarioFingerprint || ''),
      businessUnit: normaliseBusinessUnit(source.businessUnit),
      geography: normaliseInlineText(source.geography || ''),
      applicableRegulations: normaliseStringList(source.applicableRegulations, { maxItems: 12 }),
      citations: normaliseCitations(source.citations),
      adminSettings: normaliseAdminSettings(source.adminSettings),
      traceLabel: normaliseInlineText(source.traceLabel || ''),
      priorMessages: normalisePriorMessages(source.priorMessages)
    }) || {};
  }

  function normaliseFairParams(value = {}) {
    if (!isPlainObject(value)) return undefined;
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      const number = normaliseNumber(item);
      if (number !== undefined) next[key] = number;
    });
    return Object.keys(next).length ? next : undefined;
  }

  function normaliseResults(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      inputs: normaliseFairParams(value.inputs),
      threshold: normaliseNumber(value.threshold),
      annualReviewThreshold: normaliseNumber(value.annualReviewThreshold),
      annualLoss: compactValue({
        mean: normaliseNumber(value?.annualLoss?.mean),
        p50: normaliseNumber(value?.annualLoss?.p50),
        p90: normaliseNumber(value?.annualLoss?.p90),
        p95: normaliseNumber(value?.annualLoss?.p95)
      }),
      ale: compactValue({
        mean: normaliseNumber(value?.ale?.mean),
        p50: normaliseNumber(value?.ale?.p50),
        p90: normaliseNumber(value?.ale?.p90),
        p95: normaliseNumber(value?.ale?.p95)
      }),
      eventLoss: compactValue({
        mean: normaliseNumber(value?.eventLoss?.mean),
        p50: normaliseNumber(value?.eventLoss?.p50),
        p90: normaliseNumber(value?.eventLoss?.p90),
        p95: normaliseNumber(value?.eventLoss?.p95)
      }),
      projectHorizon: normaliseLooseWorkflowObject(value.projectHorizon)
    });
  }

  function normaliseBaselineAssessment(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      scenarioTitle: normaliseInlineText(value.scenarioTitle || ''),
      narrative: normaliseBlockText(value.narrative || ''),
      enhancedNarrative: normaliseBlockText(value.enhancedNarrative || ''),
      structuredScenario: normaliseStructuredScenario(value.structuredScenario),
      scenarioLens: normaliseScenarioLens(value.scenarioLens),
      selectedRisks: (Array.isArray(value.selectedRisks) ? value.selectedRisks : []).map((item) => normaliseSelectedRisk(item)).filter(Boolean).slice(0, 8),
      geography: normaliseInlineText(value.geography || ''),
      applicableRegulations: normaliseStringList(value.applicableRegulations, { maxItems: 12 }),
      fairParams: normaliseFairParams(value.fairParams),
      results: normaliseResults(value.results)
    });
  }

  function normaliseConfidence(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      label: normaliseInlineText(value.label || ''),
      summary: normaliseBlockText(value.summary || ''),
      score: normaliseNumber(value.score)
    });
  }

  function normaliseSensitivityDriver(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      label: normaliseInlineText(item.label || ''),
      why: normaliseBlockText(item.why || '')
    });
  }

  function normaliseDrivers(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      upward: normaliseStringList(value.upward, { maxItems: 6, block: true }),
      stabilisers: normaliseStringList(value.stabilisers, { maxItems: 6, block: true }),
      sensitivity: (Array.isArray(value.sensitivity) ? value.sensitivity : [])
        .map((item) => normaliseSensitivityDriver(item))
        .filter(Boolean)
        .slice(0, 6)
    });
  }

  function normaliseAssumption(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      category: normaliseInlineText(item.category || ''),
      text: normaliseBlockText(item.text || item.label || '')
    });
  }

  function normaliseAssumptions(items = [], { maxItems = 8 } = {}) {
    return (Array.isArray(items) ? items : [])
      .map((item) => normaliseAssumption(item))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  function normaliseAssessmentIntelligence(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      assumptions: normaliseAssumptions(value.assumptions, { maxItems: 8 }),
      drivers: compactValue({
        sensitivity: (Array.isArray(value?.drivers?.sensitivity) ? value.drivers.sensitivity : [])
          .map((item) => normaliseSensitivityDriver(item))
          .filter(Boolean)
          .slice(0, 6)
      })
    });
  }

  function normaliseObligationBasis(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      resolvedObligationSummary: normaliseBlockText(value.resolvedObligationSummary || ''),
      resolvedObligationContext: normaliseResolvedObligationContext(value.resolvedObligationContext),
      direct: (Array.isArray(value.direct) ? value.direct : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6),
      inheritedMandatory: (Array.isArray(value.inheritedMandatory) ? value.inheritedMandatory : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6),
      inheritedConditional: (Array.isArray(value.inheritedConditional) ? value.inheritedConditional : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6),
      inheritedGuidance: (Array.isArray(value.inheritedGuidance) ? value.inheritedGuidance : []).map(normaliseResolvedObligationEntry).filter(Boolean).slice(0, 6)
    });
  }

  function normaliseScenarioLens(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      key: normaliseInlineText(value.key || ''),
      label: normaliseInlineText(value.label || ''),
      functionKey: normaliseInlineText(value.functionKey || ''),
      estimatePresetKey: normaliseInlineText(value.estimatePresetKey || ''),
      secondaryKeys: normaliseStringList(value.secondaryKeys, { maxItems: 4 })
    });
  }

  function normaliseStructuredScenario(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      assetService: normaliseInlineText(value.assetService || ''),
      primaryDriver: normaliseInlineText(value.primaryDriver || ''),
      eventPath: normaliseBlockText(value.eventPath || ''),
      effect: normaliseBlockText(value.effect || '')
    });
  }

  function normaliseSelectedRisk(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      title: normaliseInlineText(item.title || ''),
      category: normaliseInlineText(item.category || ''),
      description: normaliseBlockText(item.description || '')
    });
  }

  function normaliseParameterAdjustment(value = {}) {
    if (!isPlainObject(value)) return undefined;
    return compactValue({
      param: normaliseInlineText(value.param || ''),
      suggestedValue: normaliseNumber(value.suggestedValue),
      aleImpact: normaliseBlockText(value.aleImpact || ''),
      rationale: normaliseBlockText(value.rationale || '')
    });
  }

  function normaliseChallengeRecord(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      parameter: normaliseInlineText(item.parameter || ''),
      concern: normaliseBlockText(item.concern || ''),
      reviewerAdjustment: normaliseParameterAdjustment(item.reviewerAdjustment)
    });
  }

  function normaliseConsensusChallenge(item = {}) {
    if (!isPlainObject(item)) return undefined;
    return compactValue({
      ref: normaliseInlineText(item.ref || ''),
      parameter: normaliseInlineText(item.parameter || ''),
      concern: normaliseBlockText(item.concern || ''),
      proposedValue: normaliseInlineText(item.proposedValue || ''),
      impactPct: normaliseNumber(item.impactPct),
      aleImpact: normaliseBlockText(item.aleImpact || '')
    });
  }

  function normaliseWorkflowPayload(path = '', payload = {}) {
    const source = isPlainObject(payload) ? payload : {};
    switch (path) {
      case '/api/ai/scenario-draft':
        return compactValue({
          assessmentType: normaliseInlineText(source.assessmentType || ''),
          riskStatement: normaliseBlockText(source.riskStatement || ''),
          guidedInput: normaliseGuidedInput(source.guidedInput),
          scenarioLensHint: normaliseInlineText(source.scenarioLensHint || ''),
          projectContext: normaliseProjectContext(source.projectContext),
          buyerEconomics: normaliseFinancialMap(source.buyerEconomics),
          buyerEconomicsMeta: normaliseFinancialMetaMap(source.buyerEconomicsMeta),
          sellerEconomics: normaliseFinancialMap(source.sellerEconomics),
          sellerEconomicsMeta: normaliseFinancialMetaMap(source.sellerEconomicsMeta),
          buyerProxyAnswers: normaliseProxyAnswers(source.buyerProxyAnswers || source.buyerProxyQuestions),
          sellerProxyAnswers: normaliseProxyAnswers(source.sellerProxyAnswers || source.sellerProxyQuestions),
          projectExposure: normaliseProjectExposureSummary(source.projectExposure),
          scenarioFingerprint: normaliseInlineText(source.scenarioFingerprint || ''),
          businessUnit: normaliseBusinessUnit(source.businessUnit),
          geography: normaliseInlineText(source.geography || ''),
          applicableRegulations: normaliseStringList(source.applicableRegulations, { maxItems: 12 }),
          citations: normaliseCitations(source.citations),
          adminSettings: normaliseAdminSettings(source.adminSettings),
          traceLabel: normaliseInlineText(source.traceLabel || ''),
          priorMessages: normalisePriorMessages(source.priorMessages)
        }) || {};
      case '/api/ai/project-exposure-map':
        return normaliseProjectExposureWorkflowPayload(source);
      case '/api/ai/parameter-coach':
        return normaliseParameterCoachPayload(source);
      case '/api/ai/evidence-map':
        return normaliseEvidenceMapPayload(source);
      case '/api/ai/decision-challenge':
        return normaliseDecisionChallengePayload(source);
      case '/api/ai/decision-brief':
        return normaliseDecisionBriefPayload(source);
      case '/api/evidence/index':
        return normaliseEvidenceIndexPayload(source);
      case '/api/evidence/search':
        return normaliseEvidenceSearchPayload(source);
      case '/api/ai/manual-intake-assist':
      case '/api/ai/manual-draft-refinement':
      case '/api/ai/manual-shortlist':
        return normaliseManualStep1Payload(source);
      case '/api/ai/register-analysis':
        return compactValue({
          registerText: normaliseBlockText(source.registerText || ''),
          registerMeta: normaliseRegisterMeta(source.registerMeta),
          scenarioFingerprint: normaliseInlineText(source.scenarioFingerprint || ''),
          businessUnit: normaliseBusinessUnit(source.businessUnit),
          geography: normaliseInlineText(source.geography || ''),
          applicableRegulations: normaliseStringList(source.applicableRegulations, { maxItems: 12 }),
          adminSettings: normaliseAdminSettings(source.adminSettings),
          priorMessages: normalisePriorMessages(source.priorMessages),
          traceLabel: normaliseInlineText(source.traceLabel || ''),
          citations: normaliseCitations(source.citations)
        }) || {};
      case '/api/ai/treatment-suggestion':
        return compactValue({
          baselineAssessment: normaliseBaselineAssessment(source.baselineAssessment),
          improvementRequest: normaliseBlockText(source.improvementRequest || ''),
          businessUnit: normaliseBusinessUnit(source.businessUnit),
          adminSettings: normaliseAdminSettings(source.adminSettings),
          citations: normaliseCitations(source.citations),
          priorMessages: normalisePriorMessages(source.priorMessages),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      case '/api/ai/reviewer-brief':
        return compactValue({
          assessmentData: normaliseBlockText(source.assessmentData || ''),
          preferredSection: normaliseInlineText(source.preferredSection || ''),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      case '/api/ai/challenge-assessment':
        return compactValue({
          scenarioTitle: normaliseInlineText(source.scenarioTitle || ''),
          narrative: normaliseBlockText(source.narrative || ''),
          geography: normaliseInlineText(source.geography || ''),
          businessUnitName: normaliseInlineText(source.businessUnitName || ''),
          businessUnit: normaliseBusinessUnit(source.businessUnit),
          adminSettings: normaliseAdminSettings(source.adminSettings),
          confidence: normaliseConfidence(source.confidence),
          drivers: normaliseDrivers(source.drivers),
          assumptions: normaliseAssumptions(source.assumptions, { maxItems: 8 }),
          missingInformation: normaliseStringList(source.missingInformation, { maxItems: 8, block: true }),
          applicableRegulations: normaliseStringList(source.applicableRegulations, { maxItems: 12 }),
          citations: normaliseCitations(source.citations),
          results: normaliseResults(source.results),
          fairParams: normaliseFairParams(source.fairParams),
          assessmentIntelligence: normaliseAssessmentIntelligence(source.assessmentIntelligence),
          obligationBasis: normaliseObligationBasis(source.obligationBasis),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      case '/api/ai/review-mediation':
        return compactValue({
          narrative: normaliseBlockText(source.narrative || ''),
          fairParams: normaliseFairParams(source.fairParams),
          results: normaliseResults(source.results),
          assessmentIntelligence: normaliseAssessmentIntelligence(source.assessmentIntelligence),
          reviewerView: normaliseBlockText(source.reviewerView || ''),
          analystView: normaliseBlockText(source.analystView || ''),
          disputedFocus: normaliseInlineText(source.disputedFocus || ''),
          scenarioLens: normaliseScenarioLens(source.scenarioLens),
          citations: normaliseCitations(source.citations, { maxItems: 4 }),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      case '/api/ai/parameter-challenge':
        return compactValue({
          parameterKey: normaliseInlineText(source.parameterKey || ''),
          parameterLabel: normaliseInlineText(source.parameterLabel || ''),
          currentValue: source.currentValue,
          currentValueLabel: normaliseInlineText(source.currentValueLabel || ''),
          scenarioSummary: normaliseBlockText(source.scenarioSummary || ''),
          reviewerConcern: normaliseBlockText(source.reviewerConcern || ''),
          currentAle: normaliseInlineText(source.currentAle || ''),
          allowedParams: normaliseStringList(source.allowedParams, { maxItems: 8 }),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      case '/api/ai/challenge-synthesis':
        return compactValue({
          scenarioTitle: normaliseInlineText(source.scenarioTitle || ''),
          scenarioSummary: normaliseBlockText(source.scenarioSummary || ''),
          baseAleRange: normaliseInlineText(source.baseAleRange || ''),
          records: (Array.isArray(source.records) ? source.records : [])
            .map((item) => normaliseChallengeRecord(item))
            .filter(Boolean)
            .slice(0, 8),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      case '/api/ai/consensus-recommendation':
        return compactValue({
          scenarioTitle: normaliseInlineText(source.scenarioTitle || ''),
          scenarioSummary: normaliseBlockText(source.scenarioSummary || ''),
          originalAleRange: normaliseInlineText(source.originalAleRange || ''),
          adjustedAleRange: normaliseInlineText(source.adjustedAleRange || ''),
          projectedAleRange: normaliseInlineText(source.projectedAleRange || ''),
          aleChangePct: normaliseNumber(source.aleChangePct),
          originalParameters: normaliseFairParams(source.originalParameters),
          adjustedParameters: normaliseFairParams(source.adjustedParameters),
          challenges: (Array.isArray(source.challenges) ? source.challenges : [])
            .map((item) => normaliseConsensusChallenge(item))
            .filter(Boolean)
            .slice(0, 8),
          traceLabel: normaliseInlineText(source.traceLabel || '')
        }) || {};
      default:
        return compactValue(source) || {};
    }
  }

  function resolveWorkflowPath(endpoint = '') {
    try {
      return new URL(String(endpoint || '')).pathname || '';
    } catch {
      return String(endpoint || '').trim();
    }
  }

  function buildWorkflowFingerprint(endpoint = '', payload = {}) {
    const workflowPath = resolveWorkflowPath(endpoint);
    const normalisedPayload = normaliseWorkflowPayload(workflowPath, payload);
    return `${String(workflowPath || '').trim()}::${stableStringify(normalisedPayload || {})}`;
  }

  function createActionCooldownStore({
    cooldownMs = 4000,
    maxEntries = 48
  } = {}) {
    const entries = new Map();

    function prune(now = Date.now()) {
      entries.forEach((entry, key) => {
        if (!entry || Number(entry.expiresAt || 0) <= now) {
          entries.delete(key);
        }
      });
      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (!oldestKey) break;
        entries.delete(oldestKey);
      }
    }

    function buildKey(endpoint = '', payload = {}, scope = '') {
      const fingerprint = buildWorkflowFingerprint(endpoint, payload);
      if (!fingerprint) return '';
      return `${String(scope || '').trim()}::${fingerprint}`;
    }

    function getRemainingMs(endpoint = '', payload = {}, { scope = '' } = {}) {
      prune();
      const key = buildKey(endpoint, payload, scope);
      if (!key) return 0;
      const entry = entries.get(key);
      if (!entry) return 0;
      return Math.max(0, Number(entry.expiresAt || 0) - Date.now());
    }

    function markCompleted(endpoint = '', payload = {}, { scope = '' } = {}) {
      const key = buildKey(endpoint, payload, scope);
      if (!key) return 0;
      entries.delete(key);
      entries.set(key, {
        expiresAt: Date.now() + cooldownMs
      });
      prune();
      return cooldownMs;
    }

    function clear(endpoint = '', payload = {}, { scope = '' } = {}) {
      const key = buildKey(endpoint, payload, scope);
      if (!key) return;
      entries.delete(key);
    }

    return {
      getRemainingMs,
      markCompleted,
      clear
    };
  }

  function buildWorkflowUrl(baseUrl, path, {
    defaultBaseUrl = '',
    isDirectCompassUrl = null,
    disableWhenDirect = false
  } = {}) {
    const resolvedDefaultBaseUrl = String(defaultBaseUrl || '').trim();
    const rawBaseUrl = String(baseUrl || resolvedDefaultBaseUrl).trim() || resolvedDefaultBaseUrl;
    if (!rawBaseUrl) return '';
    if (disableWhenDirect && typeof isDirectCompassUrl === 'function' && isDirectCompassUrl(rawBaseUrl)) {
      return '';
    }
    const effectiveBaseUrl = (typeof isDirectCompassUrl === 'function' && isDirectCompassUrl(rawBaseUrl))
      ? resolvedDefaultBaseUrl
      : rawBaseUrl;
    try {
      const url = new URL(effectiveBaseUrl);
      if (url.pathname.endsWith('/api/compass')) {
        url.pathname = url.pathname.replace(/\/api\/compass$/, path);
        url.search = '';
        return url.toString();
      }
      return new URL(path, resolvedDefaultBaseUrl || effectiveBaseUrl).toString();
    } catch {
      return '';
    }
  }

  function createClient({
    defaultBaseUrl = '',
    getBaseUrl,
    isDirectCompassUrl,
    getSessionToken,
    normaliseError,
    storeTraceEntry
  } = {}) {
    const pendingRequests = new Map();
    const recentResults = new Map();

    function currentBaseUrl() {
      return typeof getBaseUrl === 'function'
        ? String(getBaseUrl() || '').trim()
        : String(defaultBaseUrl || '').trim();
    }

    function buildUrl(path, options = {}) {
      return buildWorkflowUrl(currentBaseUrl(), path, {
        defaultBaseUrl,
        isDirectCompassUrl,
        ...options
      });
    }

    function pruneRecentResults(now = Date.now()) {
      recentResults.forEach((entry, key) => {
        if (!entry || Number(entry.expiresAt || 0) <= now) {
          recentResults.delete(key);
        }
      });
      while (recentResults.size > MAX_RECENT_RESULTS) {
        const oldestKey = recentResults.keys().next().value;
        if (!oldestKey) break;
        recentResults.delete(oldestKey);
      }
    }

    function buildFingerprint(path, normalisedPayload) {
      return `${String(path || '').trim()}::${stableStringify(normalisedPayload || {})}`;
    }

    function readRecentResult(fingerprint) {
      const entry = recentResults.get(fingerprint);
      if (!entry) return undefined;
      if (Number(entry.expiresAt || 0) <= Date.now()) {
        recentResults.delete(fingerprint);
        return undefined;
      }
      return cloneJsonValue(entry.result);
    }

    function writeRecentResult(fingerprint, result) {
      if (result === null || result === undefined) return;
      recentResults.delete(fingerprint);
      recentResults.set(fingerprint, {
        result: cloneJsonValue(result),
        expiresAt: Date.now() + RECENT_RESULT_TTL_MS
      });
      pruneRecentResults();
    }

    async function postWorkflow(endpoint, payload, { nullOnError = false } = {}) {
      if (!endpoint) {
        if (nullOnError) return null;
        throw new Error('AI workflow endpoint is unavailable.');
      }
      const workflowPath = resolveWorkflowPath(endpoint);
      const normalisedPayload = normaliseWorkflowPayload(workflowPath, payload);
      const fingerprint = buildFingerprint(workflowPath, normalisedPayload);
      pruneRecentResults();
      const recentResult = readRecentResult(fingerprint);
      if (recentResult !== undefined) {
        return recentResult;
      }
      if (pendingRequests.has(fingerprint)) {
        return pendingRequests.get(fingerprint).then((result) => cloneJsonValue(result));
      }
      const sessionToken = typeof getSessionToken === 'function' ? String(getSessionToken() || '') : '';
      const requestPromise = (async () => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'x-session-token': sessionToken } : {})
          },
          body: JSON.stringify(normalisedPayload)
        });
        if (!response.ok) {
          const text = await response.text();
          if (nullOnError) return null;
          const error = new Error(`LLM API error ${response.status}: ${text}`);
          const normalised = typeof normaliseError === 'function' ? normaliseError(error) : error;
          throw Object.assign(new Error(normalised?.message || text || 'AI request failed'), {
            code: 'LLM_UNAVAILABLE',
            retriable: true
          });
        }
        const result = await response.json();
        if (result?.trace && typeof result.trace === 'object' && typeof storeTraceEntry === 'function') {
          storeTraceEntry(result.trace);
        }
        writeRecentResult(fingerprint, result);
        return result;
      })();
      pendingRequests.set(fingerprint, requestPromise);
      try {
        const result = await requestPromise;
        return cloneJsonValue(result);
      } finally {
        if (pendingRequests.get(fingerprint) === requestPromise) {
          pendingRequests.delete(fingerprint);
        }
      }
    }

    return {
      getCompanyContextUrl() {
        return buildUrl('/api/company-context', { disableWhenDirect: true });
      },
      getScenarioDraftUrl() {
        return buildUrl('/api/ai/scenario-draft');
      },
      getProjectExposureMapUrl() {
        return buildUrl('/api/ai/project-exposure-map');
      },
      getParameterCoachUrl() {
        return buildUrl('/api/ai/parameter-coach');
      },
      getEvidenceMapUrl() {
        return buildUrl('/api/ai/evidence-map');
      },
      getEvidenceIndexUrl() {
        return buildUrl('/api/evidence/index');
      },
      getEvidenceSearchUrl() {
        return buildUrl('/api/evidence/search');
      },
      getDecisionChallengeUrl() {
        return buildUrl('/api/ai/decision-challenge');
      },
      getDecisionBriefUrl() {
        return buildUrl('/api/ai/decision-brief');
      },
      getManualIntakeAssistUrl() {
        return buildUrl('/api/ai/manual-intake-assist');
      },
      getManualDraftRefinementUrl() {
        return buildUrl('/api/ai/manual-draft-refinement');
      },
      getManualShortlistUrl() {
        return buildUrl('/api/ai/manual-shortlist');
      },
      getRegisterAnalysisUrl() {
        return buildUrl('/api/ai/register-analysis');
      },
      getTreatmentSuggestionUrl() {
        return buildUrl('/api/ai/treatment-suggestion');
      },
      getReviewerBriefUrl() {
        return buildUrl('/api/ai/reviewer-brief');
      },
      getChallengeAssessmentUrl() {
        return buildUrl('/api/ai/challenge-assessment');
      },
      getParameterChallengeUrl() {
        return buildUrl('/api/ai/parameter-challenge');
      },
      getChallengeSynthesisUrl() {
        return buildUrl('/api/ai/challenge-synthesis');
      },
      getConsensusRecommendationUrl() {
        return buildUrl('/api/ai/consensus-recommendation');
      },
      getReviewMediationUrl() {
        return buildUrl('/api/ai/review-mediation');
      },
      getStatusUrl() {
        return buildUrl('/api/ai/status');
      },
      generateProjectExposureMap(payload = {}) {
        return postWorkflow(buildUrl('/api/ai/project-exposure-map'), payload);
      },
      generateParameterCoach(payload = {}) {
        return postWorkflow(buildUrl('/api/ai/parameter-coach'), payload);
      },
      generateEvidenceMap(payload = {}) {
        return postWorkflow(buildUrl('/api/ai/evidence-map'), payload);
      },
      indexEvidence(payload = {}) {
        return postWorkflow(buildUrl('/api/evidence/index'), payload);
      },
      searchEvidence(payload = {}) {
        return postWorkflow(buildUrl('/api/evidence/search'), payload, { nullOnError: true });
      },
      generateDecisionChallenge(payload = {}) {
        return postWorkflow(buildUrl('/api/ai/decision-challenge'), payload);
      },
      generateDecisionBrief(payload = {}) {
        return postWorkflow(buildUrl('/api/ai/decision-brief'), payload);
      },
      postWorkflow
    };
  }

  return {
    createClient,
    buildWorkflowFingerprint,
    createActionCooldownStore
  };
})();
