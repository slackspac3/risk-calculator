'use strict';

(function attachObligationResolution(globalScope) {
  const VALID_REQUIREMENT_LEVELS = new Set(['mandatory', 'conditional', 'guidance']);
  const VALID_FLOW_DOWN_MODES = new Set(['none', 'full', 'partial']);
  const VALID_OBLIGATION_TYPES = new Set(['regulatory', 'policy', 'contractual', 'governance', 'operational']);
  const REQUIREMENT_WEIGHT = Object.freeze({
    mandatory: 3,
    conditional: 2,
    guidance: 1
  });

  function toSafeString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
  }

  function slugifyValue(value = '') {
    return toSafeString(value, 160)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normaliseStringArray(value, { maxLength = 120, lowerCase = false } = {}) {
    const source = Array.isArray(value) ? value : [];
    const seen = new Set();
    const output = [];
    source.forEach(item => {
      const safe = toSafeString(item, maxLength);
      if (!safe) return;
      const normalised = lowerCase ? safe.toLowerCase() : safe;
      const key = normalised.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      output.push(normalised);
    });
    return output;
  }

  function makeObligationId(obligation = {}) {
    const explicitId = slugifyValue(obligation.id || '');
    if (explicitId) return explicitId;
    const parts = [
      slugifyValue(obligation.sourceEntityId || ''),
      slugifyValue(obligation.familyKey || ''),
      slugifyValue(obligation.title || '')
    ].filter(Boolean);
    return parts.join('--') || `oblg-${Date.now()}`;
  }

  function normaliseFlowDownTargets(targets = {}) {
    const source = targets && typeof targets === 'object' ? targets : {};
    return {
      entityTypes: normaliseStringArray(source.entityTypes, { maxLength: 120, lowerCase: true }),
      includeEntityIds: normaliseStringArray(source.includeEntityIds, { maxLength: 120 }),
      excludeEntityIds: normaliseStringArray(source.excludeEntityIds, { maxLength: 120 }),
      departmentIds: normaliseStringArray(source.departmentIds, { maxLength: 120 }),
      departmentNames: normaliseStringArray(source.departmentNames, { maxLength: 120, lowerCase: true }),
      geographies: normaliseStringArray(source.geographies, { maxLength: 120, lowerCase: true }),
      scenarioLenses: normaliseStringArray(source.scenarioLenses, { maxLength: 80, lowerCase: true })
    };
  }

  function normaliseEntityObligation(obligation = {}) {
    const source = obligation && typeof obligation === 'object' ? obligation : {};
    const title = toSafeString(source.title, 180);
    const familyKey = slugifyValue(source.familyKey || title);
    const type = VALID_OBLIGATION_TYPES.has(toSafeString(source.type, 60).toLowerCase())
      ? toSafeString(source.type, 60).toLowerCase()
      : 'regulatory';
    const requirementLevel = VALID_REQUIREMENT_LEVELS.has(toSafeString(source.requirementLevel, 40).toLowerCase())
      ? toSafeString(source.requirementLevel, 40).toLowerCase()
      : 'mandatory';
    const flowDownMode = VALID_FLOW_DOWN_MODES.has(toSafeString(source.flowDownMode, 20).toLowerCase())
      ? toSafeString(source.flowDownMode, 20).toLowerCase()
      : 'none';
    const inheritedRequirement = VALID_REQUIREMENT_LEVELS.has(toSafeString(source.inheritedView?.childRequirementLevel, 40).toLowerCase())
      ? toSafeString(source.inheritedView.childRequirementLevel, 40).toLowerCase()
      : requirementLevel;
    const regulationTags = normaliseStringArray(
      Array.isArray(source.regulationTags) ? source.regulationTags : source.applicableRegulations,
      { maxLength: 120 }
    );
    return {
      id: makeObligationId({ ...source, title, familyKey }),
      sourceEntityId: toSafeString(source.sourceEntityId, 120),
      title,
      familyKey,
      type,
      requirementLevel,
      text: toSafeString(source.text || source.obligationText, 1200),
      jurisdictions: normaliseStringArray(source.jurisdictions, { maxLength: 120 }),
      regulationTags,
      active: source.active !== false,
      sourceDocIds: normaliseStringArray(source.sourceDocIds, { maxLength: 120 }),
      visibleToChildUsers: source.visibleToChildUsers !== false,
      flowDownMode,
      flowDownTargets: normaliseFlowDownTargets(source.flowDownTargets),
      inheritedView: {
        childRequirementLevel: inheritedRequirement,
        childText: toSafeString(source.inheritedView?.childText, 1200)
      },
      review: {
        owner: toSafeString(source.review?.owner, 120),
        lastReviewedAt: Number(source.review?.lastReviewedAt || 0)
      }
    };
  }

  function normaliseEntityObligations(obligations = []) {
    const source = Array.isArray(obligations) ? obligations : [];
    const seen = new Set();
    const output = [];
    source.forEach(item => {
      const normalised = normaliseEntityObligation(item);
      if (!normalised.sourceEntityId || !normalised.title) return;
      const key = normalised.id || `${normalised.sourceEntityId}::${normalised.familyKey || normalised.title.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      output.push(normalised);
    });
    return output;
  }

  function getEntityById(structure = [], entityId = '') {
    const safeEntityId = toSafeString(entityId, 120);
    return (Array.isArray(structure) ? structure : []).find(node => String(node?.id || '') === safeEntityId) || null;
  }

  function getEntityLineage(structure = [], entityId = '') {
    const safeEntityId = toSafeString(entityId, 120);
    if (!safeEntityId) return [];
    const idToNode = new Map((Array.isArray(structure) ? structure : []).map(node => [String(node?.id || ''), node]).filter(([id]) => id));
    const seen = new Set();
    const lineage = [];
    let currentId = safeEntityId;
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = idToNode.get(currentId);
      if (!node) break;
      lineage.push(node);
      currentId = String(node.parentId || '').trim();
    }
    return lineage;
  }

  function normaliseGeographies(value) {
    if (Array.isArray(value)) {
      return normaliseStringArray(value, { maxLength: 120, lowerCase: true });
    }
    return normaliseStringArray([value], { maxLength: 120, lowerCase: true });
  }

  function hasFlowDownFilter(targets = {}) {
    return !!(
      targets.entityTypes?.length ||
      targets.includeEntityIds?.length ||
      targets.excludeEntityIds?.length ||
      targets.departmentIds?.length ||
      targets.departmentNames?.length ||
      targets.geographies?.length ||
      targets.scenarioLenses?.length
    );
  }

  function evaluateApplicability(obligation, options = {}) {
    const targets = obligation?.flowDownTargets || {};
    const selectedBusiness = options.selectedBusiness || null;
    const selectedDepartment = options.selectedDepartment || null;
    const businessEntityId = toSafeString(selectedBusiness?.id || options.businessUnitEntityId, 120);
    const departmentEntityId = toSafeString(selectedDepartment?.id || options.departmentEntityId, 120);
    const businessType = toSafeString(selectedBusiness?.type, 120).toLowerCase();
    const departmentName = toSafeString(selectedDepartment?.name, 120).toLowerCase();
    const geographies = normaliseGeographies(options.geographies || options.geography);
    const scenarioLens = toSafeString(options.scenarioLens, 80).toLowerCase();

    if (targets.excludeEntityIds?.includes(businessEntityId) || targets.excludeEntityIds?.includes(departmentEntityId)) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.includeEntityIds?.length && !targets.includeEntityIds.includes(businessEntityId) && !targets.includeEntityIds.includes(departmentEntityId)) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.entityTypes?.length && !targets.entityTypes.includes(businessType)) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.departmentIds?.length && !departmentEntityId) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.departmentIds?.length && !targets.departmentIds.includes(departmentEntityId)) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.departmentNames?.length && !departmentName) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.departmentNames?.length && !targets.departmentNames.includes(departmentName)) {
      return { matches: false, scenarioLensMatched: false };
    }
    if (targets.geographies?.length) {
      const geographyMatched = geographies.some(item => targets.geographies.includes(item));
      if (!geographyMatched) return { matches: false, scenarioLensMatched: false };
    }
    if (targets.scenarioLenses?.length) {
      if (!scenarioLens) return { matches: true, scenarioLensMatched: null };
      if (!targets.scenarioLenses.includes(scenarioLens)) return { matches: false, scenarioLensMatched: false };
      return { matches: true, scenarioLensMatched: true };
    }
    return { matches: true, scenarioLensMatched: true };
  }

  function compareResolvedItems(left, right, options = {}) {
    const selectedBusinessId = toSafeString(options.businessUnitEntityId, 120);
    const selectedDepartmentId = toSafeString(options.departmentEntityId, 120);
    const score = item => {
      let total = item.direct ? 200 : 100;
      total += REQUIREMENT_WEIGHT[item.requirementLevel] || 0;
      if (item.sourceEntityId === selectedDepartmentId) total += 20;
      else if (item.sourceEntityId === selectedBusinessId) total += 10;
      total += item.visibleToChildUsers ? 1 : 0;
      total += item.reviewedAt ? Math.min(9, Math.floor(item.reviewedAt / 100000000000)) : 0;
      return total;
    };
    return score(right) - score(left) || String(left.title || '').localeCompare(String(right.title || ''));
  }

  function shouldIncludeResolvedRegulation(item) {
    if (!item || !item.regulationTags?.length) return false;
    if (item.scenarioLensScoped && item.scenarioLensMatched !== true) return false;
    return item.type === 'regulatory' || item.regulationTags.length > 0;
  }

  function buildApplicabilityReason(item) {
    const parts = [];
    if (item.direct) {
      parts.push('Directly attached to the selected entity or function.');
    } else {
      parts.push(`Inherited from ${item.sourceEntityName || 'an ancestor entity'} through ${item.flowDownMode} flow-down.`);
    }
    if (item.appliesToDepartmentId && item.departmentScoped) {
      parts.push('Scoped to the selected function.');
    }
    if (item.geographyScoped) {
      parts.push('Matched the active geography filter.');
    }
    if (item.scenarioLensScoped) {
      if (item.scenarioLensMatched === true) parts.push('Matched the active scenario lens.');
      else if (item.scenarioLensMatched === null) parts.push('Carries a scenario-lens condition that will tighten once the scenario lens is explicit.');
    }
    return parts.join(' ');
  }

  function buildResolvedObligationSummary(context = {}) {
    const buckets = [
      ['Direct obligations', context.direct],
      ['Inherited mandatory obligations', context.inheritedMandatory],
      ['Inherited conditional obligations', context.inheritedConditional],
      ['Inherited guidance obligations', context.inheritedGuidance]
    ];
    return buckets
      .filter(([, items]) => Array.isArray(items) && items.length)
      .map(([label, items]) => `${label}:\n${items.map(item => `- ${item.title}${item.sourceEntityName ? ` | source: ${item.sourceEntityName}` : ''}${item.text ? ` | ${item.text.slice(0, 180)}` : ''}`).join('\n')}`)
      .join('\n');
  }

  function buildEntityObligationCatalogSummary(entityObligations = [], structure = []) {
    const obligations = normaliseEntityObligations(entityObligations);
    if (!obligations.length) return '';
    const idToNode = new Map((Array.isArray(structure) ? structure : []).map(node => [String(node?.id || ''), node]).filter(([id]) => id));
    return obligations.map(item => {
      const sourceNode = idToNode.get(item.sourceEntityId);
      const parts = [
        `${item.title}${item.type ? ` (${item.type})` : ''}`,
        `source: ${sourceNode?.name || item.sourceEntityId}`,
        `requirement: ${item.requirementLevel}`,
        `flow-down: ${item.flowDownMode}`
      ];
      if (item.flowDownTargets.entityTypes.length) parts.push(`entity types: ${item.flowDownTargets.entityTypes.join(', ')}`);
      if (item.flowDownTargets.departmentNames.length) parts.push(`functions: ${item.flowDownTargets.departmentNames.join(', ')}`);
      if (item.flowDownTargets.geographies.length) parts.push(`geographies: ${item.flowDownTargets.geographies.join(', ')}`);
      if (item.flowDownTargets.scenarioLenses.length) parts.push(`lenses: ${item.flowDownTargets.scenarioLenses.join(', ')}`);
      return `- ${parts.join(' | ')}`;
    }).join('\n');
  }

  function resolveObligationContext(options = {}) {
    const structure = Array.isArray(options.structure)
      ? options.structure
      : (Array.isArray(options.settings?.companyStructure) ? options.settings.companyStructure : []);
    const obligations = normaliseEntityObligations(
      Array.isArray(options.entityObligations)
        ? options.entityObligations
        : options.settings?.entityObligations
    );
    const selectedDepartment = getEntityById(structure, options.departmentEntityId);
    const selectedBusiness = getEntityById(structure, options.businessUnitEntityId)
      || (selectedDepartment?.parentId ? getEntityById(structure, selectedDepartment.parentId) : null);
    const businessEntityId = toSafeString(selectedBusiness?.id || options.businessUnitEntityId, 120);
    const departmentEntityId = toSafeString(selectedDepartment?.id || options.departmentEntityId, 120);
    const directSourceIds = new Set([businessEntityId, departmentEntityId].filter(Boolean));
    const lineage = getEntityLineage(structure, businessEntityId);
    const ancestorIds = new Set(lineage.slice(1).map(node => String(node.id || '')).filter(Boolean));
    const resolvedCandidates = [];

    obligations.forEach(obligation => {
      const isDirect = directSourceIds.has(obligation.sourceEntityId);
      const isAncestor = ancestorIds.has(obligation.sourceEntityId);
      if (!isDirect && !isAncestor) return;

      const applicability = evaluateApplicability(obligation, {
        businessUnitEntityId: businessEntityId,
        departmentEntityId,
        selectedBusiness,
        selectedDepartment,
        geography: options.geography,
        geographies: options.geographies,
        scenarioLens: options.scenarioLens
      });
      if (!applicability.matches) return;
      if (!isDirect) {
        if (obligation.flowDownMode === 'none') return;
        if (obligation.flowDownMode === 'partial' && !hasFlowDownFilter(obligation.flowDownTargets)) return;
      }

      const requirementLevel = isDirect
        ? obligation.requirementLevel
        : (obligation.inheritedView.childRequirementLevel || obligation.requirementLevel);
      const regulationTags = obligation.regulationTags.length
        ? obligation.regulationTags.slice()
        : (obligation.type === 'regulatory' && obligation.title ? [obligation.title] : []);
      const sourceNode = getEntityById(structure, obligation.sourceEntityId);
      resolvedCandidates.push({
        id: `${obligation.id}::${businessEntityId || 'global'}::${departmentEntityId || 'root'}::${isDirect ? 'direct' : 'inherited'}`,
        sourceObligationId: obligation.id,
        sourceEntityId: obligation.sourceEntityId,
        sourceEntityName: toSafeString(sourceNode?.name || obligation.sourceEntityId, 180),
        appliesToEntityId: businessEntityId,
        appliesToDepartmentId: departmentEntityId,
        title: obligation.title,
        familyKey: obligation.familyKey,
        type: obligation.type,
        requirementLevel,
        text: isDirect ? obligation.text : (obligation.inheritedView.childText || obligation.text),
        jurisdictions: obligation.jurisdictions.slice(),
        regulationTags,
        visibleToChildUsers: obligation.visibleToChildUsers,
        direct: isDirect,
        flowDownMode: obligation.flowDownMode,
        inheritanceType: isDirect ? 'direct' : `inherited-${requirementLevel}`,
        scenarioLensScoped: obligation.flowDownTargets.scenarioLenses.length > 0,
        scenarioLensMatched: applicability.scenarioLensMatched,
        geographyScoped: obligation.flowDownTargets.geographies.length > 0,
        departmentScoped: obligation.flowDownTargets.departmentIds.length > 0 || obligation.flowDownTargets.departmentNames.length > 0,
        reviewedAt: Number(obligation.review?.lastReviewedAt || 0)
      });
    });

    const bestByFamilyKey = new Map();
    resolvedCandidates.sort((left, right) => compareResolvedItems(left, right, {
      businessUnitEntityId: businessEntityId,
      departmentEntityId
    }));
    resolvedCandidates.forEach(item => {
      const key = item.familyKey || slugifyValue(item.title);
      if (!bestByFamilyKey.has(key)) {
        bestByFamilyKey.set(key, item);
      }
    });

    const kept = Array.from(bestByFamilyKey.values()).map(item => ({
      ...item,
      applicabilityReason: buildApplicabilityReason(item)
    }));
    const context = {
      selectedBusinessEntityId: businessEntityId,
      selectedDepartmentEntityId: departmentEntityId,
      lineageEntityIds: lineage.map(node => String(node.id || '')).filter(Boolean),
      direct: kept.filter(item => item.direct),
      inheritedMandatory: kept.filter(item => !item.direct && item.requirementLevel === 'mandatory'),
      inheritedConditional: kept.filter(item => !item.direct && item.requirementLevel === 'conditional'),
      inheritedGuidance: kept.filter(item => !item.direct && item.requirementLevel === 'guidance'),
      allResolved: kept,
      resolvedApplicableRegulations: normaliseStringArray(
        kept.filter(shouldIncludeResolvedRegulation).flatMap(item => item.regulationTags),
        { maxLength: 120 }
      ),
      summary: ''
    };
    context.summary = buildResolvedObligationSummary(context);
    return context;
  }

  const api = {
    normaliseEntityObligation,
    normaliseEntityObligations,
    getEntityLineage,
    resolveObligationContext,
    buildResolvedObligationSummary,
    buildEntityObligationCatalogSummary
  };

  Object.assign(globalScope, {
    ObligationResolution: api
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
