const BenchmarkService = (() => {
  let _benchmarks = [];
  const ENTERPRISE_SCENARIO_BASELINES = Object.freeze({
    strategic: {
      title: 'Strategic scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a strategic scenario. The starting values favour lower event frequency but heavier reputation and execution drag.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 0.8, max: 3 },
        controlStrength: { min: 0.38, likely: 0.56, max: 0.76 },
        threatCapability: { min: 0.28, likely: 0.46, max: 0.68 },
        lossComponents: {
          incidentResponse: { min: 60000, likely: 180000, max: 550000 },
          businessInterruption: { min: 180000, likely: 640000, max: 2400000 },
          dataBreachRemediation: { min: 0, likely: 15000, max: 90000 },
          regulatoryLegal: { min: 20000, likely: 120000, max: 600000 },
          thirdPartyLiability: { min: 0, likely: 40000, max: 220000 },
          reputationContract: { min: 180000, likely: 700000, max: 2600000 }
        }
      }
    },
    operational: {
      title: 'Operational scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to an operational breakdown. The starting values emphasise service disruption and recovery effort.',
      suggestedInputs: {
        TEF: { min: 0.5, likely: 2, max: 9 },
        controlStrength: { min: 0.34, likely: 0.52, max: 0.74 },
        threatCapability: { min: 0.32, likely: 0.5, max: 0.72 },
        lossComponents: {
          incidentResponse: { min: 50000, likely: 170000, max: 520000 },
          businessInterruption: { min: 150000, likely: 620000, max: 2500000 },
          dataBreachRemediation: { min: 0, likely: 10000, max: 60000 },
          regulatoryLegal: { min: 10000, likely: 70000, max: 300000 },
          thirdPartyLiability: { min: 0, likely: 30000, max: 180000 },
          reputationContract: { min: 70000, likely: 250000, max: 900000 }
        }
      }
    },
    regulatory: {
      title: 'Regulatory scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a regulatory or licence-risk scenario. The starting values emphasise enforcement, remediation, and management response effort.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 1, max: 4 },
        controlStrength: { min: 0.4, likely: 0.58, max: 0.78 },
        threatCapability: { min: 0.3, likely: 0.48, max: 0.7 },
        lossComponents: {
          incidentResponse: { min: 40000, likely: 150000, max: 450000 },
          businessInterruption: { min: 60000, likely: 250000, max: 900000 },
          dataBreachRemediation: { min: 0, likely: 15000, max: 90000 },
          regulatoryLegal: { min: 120000, likely: 420000, max: 1800000 },
          thirdPartyLiability: { min: 0, likely: 20000, max: 160000 },
          reputationContract: { min: 90000, likely: 320000, max: 1200000 }
        }
      }
    },
    financial: {
      title: 'Financial scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a finance or fraud scenario. The starting values balance direct financial loss with control remediation and downstream contractual exposure.',
      suggestedInputs: {
        TEF: { min: 0.6, likely: 2.4, max: 10 },
        controlStrength: { min: 0.36, likely: 0.54, max: 0.76 },
        threatCapability: { min: 0.36, likely: 0.56, max: 0.8 },
        lossComponents: {
          incidentResponse: { min: 35000, likely: 120000, max: 380000 },
          businessInterruption: { min: 50000, likely: 210000, max: 850000 },
          dataBreachRemediation: { min: 0, likely: 10000, max: 65000 },
          regulatoryLegal: { min: 25000, likely: 130000, max: 700000 },
          thirdPartyLiability: { min: 15000, likely: 90000, max: 450000 },
          reputationContract: { min: 50000, likely: 220000, max: 950000 }
        }
      }
    },
    esg: {
      title: 'ESG scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to an ESG or sustainability scenario. The starting values emphasise disclosure remediation, stakeholder scrutiny, and contract or funding pressure.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 0.9, max: 4 },
        controlStrength: { min: 0.34, likely: 0.5, max: 0.72 },
        threatCapability: { min: 0.24, likely: 0.4, max: 0.64 },
        lossComponents: {
          incidentResponse: { min: 30000, likely: 110000, max: 340000 },
          businessInterruption: { min: 40000, likely: 180000, max: 700000 },
          dataBreachRemediation: { min: 0, likely: 5000, max: 25000 },
          regulatoryLegal: { min: 20000, likely: 110000, max: 520000 },
          thirdPartyLiability: { min: 0, likely: 15000, max: 120000 },
          reputationContract: { min: 120000, likely: 420000, max: 1500000 }
        }
      }
    },
    compliance: {
      title: 'Compliance scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a compliance-assurance scenario. The starting values emphasise remediation effort, assurance breakdown, and legal or disciplinary exposure.',
      suggestedInputs: {
        TEF: { min: 0.4, likely: 1.5, max: 6 },
        controlStrength: { min: 0.34, likely: 0.5, max: 0.72 },
        threatCapability: { min: 0.3, likely: 0.46, max: 0.68 },
        lossComponents: {
          incidentResponse: { min: 30000, likely: 100000, max: 320000 },
          businessInterruption: { min: 40000, likely: 180000, max: 650000 },
          dataBreachRemediation: { min: 0, likely: 8000, max: 45000 },
          regulatoryLegal: { min: 50000, likely: 180000, max: 780000 },
          thirdPartyLiability: { min: 0, likely: 20000, max: 130000 },
          reputationContract: { min: 60000, likely: 220000, max: 820000 }
        }
      }
    },
    'supply-chain': {
      title: 'Supply chain scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a supply chain scenario. The starting values emphasise delivery disruption, substitute cost, and contractual pressure.',
      suggestedInputs: {
        TEF: { min: 0.3, likely: 1.4, max: 6 },
        controlStrength: { min: 0.32, likely: 0.48, max: 0.7 },
        threatCapability: { min: 0.3, likely: 0.5, max: 0.74 },
        lossComponents: {
          incidentResponse: { min: 25000, likely: 90000, max: 300000 },
          businessInterruption: { min: 180000, likely: 700000, max: 2600000 },
          dataBreachRemediation: { min: 0, likely: 5000, max: 25000 },
          regulatoryLegal: { min: 10000, likely: 60000, max: 280000 },
          thirdPartyLiability: { min: 25000, likely: 120000, max: 600000 },
          reputationContract: { min: 70000, likely: 240000, max: 920000 }
        }
      }
    },
    procurement: {
      title: 'Procurement scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a procurement scenario. The starting values emphasise weak sourcing decisions, commercial leakage, and supplier-control gaps.',
      suggestedInputs: {
        TEF: { min: 0.3, likely: 1.1, max: 5 },
        controlStrength: { min: 0.34, likely: 0.5, max: 0.72 },
        threatCapability: { min: 0.28, likely: 0.46, max: 0.68 },
        lossComponents: {
          incidentResponse: { min: 20000, likely: 70000, max: 240000 },
          businessInterruption: { min: 120000, likely: 420000, max: 1600000 },
          dataBreachRemediation: { min: 0, likely: 5000, max: 30000 },
          regulatoryLegal: { min: 10000, likely: 70000, max: 320000 },
          thirdPartyLiability: { min: 25000, likely: 130000, max: 620000 },
          reputationContract: { min: 50000, likely: 180000, max: 760000 }
        }
      }
    },
    'business-continuity': {
      title: 'Business continuity calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a continuity scenario. The starting values emphasise outage duration, recovery slippage, and management escalation cost.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 1.1, max: 5 },
        controlStrength: { min: 0.34, likely: 0.52, max: 0.74 },
        threatCapability: { min: 0.26, likely: 0.44, max: 0.68 },
        lossComponents: {
          incidentResponse: { min: 50000, likely: 180000, max: 550000 },
          businessInterruption: { min: 220000, likely: 820000, max: 3200000 },
          dataBreachRemediation: { min: 0, likely: 5000, max: 35000 },
          regulatoryLegal: { min: 10000, likely: 60000, max: 280000 },
          thirdPartyLiability: { min: 0, likely: 25000, max: 180000 },
          reputationContract: { min: 90000, likely: 300000, max: 1200000 }
        }
      }
    },
    hse: {
      title: 'HSE scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a health, safety, or environmental scenario. The starting values emphasise shutdown, remediation, and regulatory scrutiny.',
      suggestedInputs: {
        TEF: { min: 0.15, likely: 0.8, max: 3 },
        controlStrength: { min: 0.38, likely: 0.56, max: 0.76 },
        threatCapability: { min: 0.24, likely: 0.42, max: 0.64 },
        lossComponents: {
          incidentResponse: { min: 50000, likely: 160000, max: 500000 },
          businessInterruption: { min: 150000, likely: 550000, max: 2200000 },
          dataBreachRemediation: { min: 0, likely: 0, max: 15000 },
          regulatoryLegal: { min: 80000, likely: 260000, max: 1200000 },
          thirdPartyLiability: { min: 15000, likely: 70000, max: 340000 },
          reputationContract: { min: 100000, likely: 320000, max: 1200000 }
        }
      }
    },
    general: {
      title: 'General enterprise scenario calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to the scenario. The starting values provide a challengeable cross-enterprise baseline rather than a cyber-specific assumption set.',
      suggestedInputs: {
        TEF: { min: 0.5, likely: 2, max: 8 },
        controlStrength: { min: 0.4, likely: 0.58, max: 0.78 },
        threatCapability: { min: 0.36, likely: 0.54, max: 0.76 },
        lossComponents: {
          incidentResponse: { min: 40000, likely: 140000, max: 420000 },
          businessInterruption: { min: 100000, likely: 420000, max: 1700000 },
          dataBreachRemediation: { min: 10000, likely: 50000, max: 220000 },
          regulatoryLegal: { min: 20000, likely: 90000, max: 500000 },
          thirdPartyLiability: { min: 0, likely: 50000, max: 250000 },
          reputationContract: { min: 70000, likely: 260000, max: 1000000 }
        }
      }
    }
  });

  function init(list) {
    _benchmarks = Array.isArray(list) ? list : [];
  }

  function _normalise(text) {
    return String(text || '').trim().toLowerCase();
  }

  function _detectScenarioType(query = '') {
    const q = _normalise(query);
    if (/gpu export|export control|export licence|export license|entity list|ear|bis|semiconductor equipment|china restrictions|sanctions breach/.test(q)) return 'export-control';
    if (/azure ad|entra|identity|credential|account takeover|sso|directory|mailbox compromise|session hijack/.test(q)) return 'identity';
    if (/ransom|encrypt|extortion/.test(q)) return 'ransomware';
    if (/cloud|storage bucket|misconfig|tenant|saas|public exposure/.test(q)) return 'cloud';
    if (/privacy|data breach|data exposure|pii|phi|privacy incident/.test(q)) return 'data-breach';
    // Treat labour-rights and supplier-diligence scenarios as procurement-first unless the text is clearly about logistics or continuity.
    if (/procurement|sourcing|tender|bid|bid rigging|contract award|vendor selection|purchasing|collusion|kickback|conflict of interest|supplier due diligence|modern slavery|forced labor|forced labour|exploitative labor|exploitative labour|human rights/.test(q)) return 'procurement';
    if (/supply chain|logistics|inventory|shipment|upstream|sub tier|sub-tier|single source|sole source|dependency/.test(q)) return 'supply-chain';
    if (/supplier|vendor|third party|third-party|outsourcing/.test(q)) return 'third-party';
    if (/business continuity|continuity|disaster recovery|recovery objective|recovery plan|rto|rpo|crisis management/.test(q)) return 'business-continuity';
    if (/health and safety|occupational safety|injury|worker safety|contractor safety|hse|ehs|environmental|spill|hazard|site shutdown|near miss/.test(q)) return 'hse';
    if (/strategy|strategic|market shift|competitive|transformation|portfolio|investment/.test(q)) return 'strategic';
    if (/operational|process failure|capacity|breakdown|service failure|backlog|workflow/.test(q)) return 'operational';
    if (/regulator|regulatory|licen|filing|supervisory|sanction|enforcement/.test(q)) return 'regulatory';
    if (/fraud|payment|invoice|treasury|liquidity|capital|financial control|misstatement|journal entry|revenue recognition/.test(q)) return 'financial';
    if (/compliance|non-compliance|policy breach|conduct|ethics|assurance|anti bribery|anti-bribery|corruption/.test(q)) return 'compliance';
    if (/esg|sustainability|climate|emission|carbon|greenwashing|disclosure|nature related|transition plan/.test(q)) return 'esg';
    return 'general';
  }

  function _detectIndustry(businessUnit = {}, query = '') {
    const text = _normalise([
      businessUnit?.name,
      businessUnit?.contextSummary,
      businessUnit?.notes,
      ...(businessUnit?.criticalServices || []),
      ...(businessUnit?.dataTypes || []),
      query
    ].filter(Boolean).join(' '));
    if (/health|patient|hospital|clinical|medical|phi/.test(text)) return 'healthcare';
    if (/bank|finance|payment|treasury|trading|fintech/.test(text)) return 'financial services';
    if (/semiconductor|gpu|chip|chips|foundry|eda|wafer|fab|export control/.test(text)) return 'semiconductor';
    if (/manufacturing|plant|factory|ot|ics/.test(text)) return 'manufacturing';
    return 'cross-sector';
  }

  function _detectGeographyLabels(geography = '') {
    const raw = Array.isArray(geography) ? geography.join(',') : String(geography || '');
    const text = _normalise(raw);
    const labels = ['Global'];
    if (/united arab emirates|uae/.test(text)) labels.unshift('United Arab Emirates');
    if (/middle east/.test(text)) labels.unshift('Middle East');
    if (/gcc|gulf/.test(text) || /united arab emirates|uae|saudi|qatar|oman|kuwait|bahrain/.test(text)) labels.unshift('GCC');
    return Array.from(new Set(labels));
  }

  function _score(entry, scenarioType, industry, geographyLabels) {
    let score = 0;
    if (entry.scenarioType === scenarioType) score += 10;
    if ((entry.industries || []).includes(industry)) score += 5;
    if ((entry.industries || []).includes('cross-sector')) score += 2;
    const labels = geographyLabels || [];
    if (labels.some(label => (entry.geographies || []).includes(label))) score += 6;
    if ((entry.scope || '') === 'regional' && labels.some(label => label !== 'Global')) score += 3;
    if ((entry.scope || '') === 'global') score += 1;
    return score;
  }

  function _cloneSuggestedInputs(inputs = {}) {
    return {
      TEF: { ...(inputs.TEF || {}) },
      controlStrength: { ...(inputs.controlStrength || {}) },
      threatCapability: { ...(inputs.threatCapability || {}) },
      lossComponents: {
        incidentResponse: { ...(inputs.lossComponents?.incidentResponse || {}) },
        businessInterruption: { ...(inputs.lossComponents?.businessInterruption || {}) },
        dataBreachRemediation: { ...(inputs.lossComponents?.dataBreachRemediation || {}) },
        regulatoryLegal: { ...(inputs.lossComponents?.regulatoryLegal || {}) },
        thirdPartyLiability: { ...(inputs.lossComponents?.thirdPartyLiability || {}) },
        reputationContract: { ...(inputs.lossComponents?.reputationContract || {}) }
      }
    };
  }

  function _buildCalibrationEntry(scenarioType, industry, geographyLabels) {
    const profile = ENTERPRISE_SCENARIO_BASELINES[scenarioType] || ENTERPRISE_SCENARIO_BASELINES.general;
    if (!profile) return null;
    const geographyMatch = Array.isArray(geographyLabels) && geographyLabels.length
      ? geographyLabels[0]
      : 'Global';
    return {
      id: `bm-calibration-${scenarioType}`,
      title: profile.title,
      scenarioType,
      geographies: Array.isArray(geographyLabels) && geographyLabels.length ? geographyLabels : ['Global'],
      industries: [industry || 'cross-sector', 'cross-sector'],
      scope: 'scenario',
      sourceType: 'calibration',
      sourceTitle: 'Enterprise scenario calibration baseline',
      sourceUrl: '',
      lastUpdated: '',
      summary: profile.summary,
      suggestedInputs: _cloneSuggestedInputs(profile.suggestedInputs),
      score: 12,
      scenarioMatch: scenarioType,
      industryMatch: industry || 'cross-sector',
      geographyMatch
    };
  }

  function _parseYear(lastUpdated = '') {
    const yearMatch = String(lastUpdated || '').match(/(20\d{2})/);
    return yearMatch ? Number(yearMatch[1]) : 0;
  }

  function _getCurrentYear() {
    return new Date().getFullYear();
  }

  function _humaniseSourceType(sourceType = '') {
    const value = _normalise(sourceType);
    if (value === 'calibration') return 'Scenario calibration';
    if (value === 'official') return 'Official report';
    if (value === 'regulatory') return 'Regulatory source';
    if (value === 'industry') return 'Industry research';
    if (value === 'internal') return 'Internal source';
    if (value === 'regional') return 'Regional research';
    return value ? `${sourceType}` : 'Published source';
  }

  function retrieveRelevantBenchmarks({ query = '', geography = '', businessUnit = null, topK = 3 } = {}) {
    const scenarioType = _detectScenarioType(query);
    const industry = _detectIndustry(businessUnit || {}, query);
    const geographyLabels = _detectGeographyLabels(geography || businessUnit?.geography || '');
    const ranked = _benchmarks
      .map(entry => ({
        ...entry,
        score: _score(entry, scenarioType, industry, geographyLabels),
        scenarioMatch: scenarioType,
        industryMatch: industry,
        geographyMatch: geographyLabels.find(label => (entry.geographies || []).includes(label)) || 'Global'
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const exactMatches = ranked.filter(entry => entry.scenarioType === scenarioType);
    if (exactMatches.length) {
      return exactMatches.slice(0, topK);
    }
    // Avoid silently borrowing an identity or breach profile for enterprise scenarios that have no published like-for-like benchmark entry yet.
    const calibration = _buildCalibrationEntry(scenarioType, industry, geographyLabels);
    return calibration ? [calibration].slice(0, topK) : ranked.slice(0, topK);
  }

  function deriveSuggestedInputs(entries = []) {
    const top = Array.isArray(entries) ? entries[0] : null;
    if (!top?.suggestedInputs) return null;
    return JSON.parse(JSON.stringify(top.suggestedInputs));
  }

  function summariseBenchmarkBasis(entries = []) {
    if (!entries.length) return '';
    const primary = entries[0];
    const fallback = entries[1];
    const parts = [
      primary.sourceType === 'calibration'
        ? 'A scenario calibration baseline was applied because no structured published benchmark mapped directly to this enterprise scenario.'
        : `${primary.scope === 'regional' ? 'Regional' : primary.scope === 'global' ? 'Global' : 'Industry'} benchmark logic was applied using ${primary.sourceTitle}.`
    ];
    if (fallback) parts.push(`A secondary ${fallback.scope} comparator from ${fallback.sourceTitle} was used as a fallback cross-check.`);
    return parts.join(' ');
  }

  function buildPromptBlock(entries = []) {
    if (!entries.length) return 'No structured numeric benchmark entries were matched for this scenario.';
    return entries.map((entry, idx) => {
      const inputs = entry.suggestedInputs || {};
      const loss = inputs.lossComponents || {};
      return [
        `${idx + 1}. ${entry.title}`,
        `Scope: ${entry.scope} | Geography match: ${entry.geographyMatch} | Industry match: ${entry.industryMatch}`,
        `Source: ${entry.sourceTitle}`,
        `TEF: ${inputs.TEF ? `${inputs.TEF.min}/${inputs.TEF.likely}/${inputs.TEF.max}` : 'n/a'}`,
        `Threat capability: ${inputs.threatCapability ? `${inputs.threatCapability.min}/${inputs.threatCapability.likely}/${inputs.threatCapability.max}` : 'n/a'}`,
        `Control strength: ${inputs.controlStrength ? `${inputs.controlStrength.min}/${inputs.controlStrength.likely}/${inputs.controlStrength.max}` : 'n/a'}`,
        `Business interruption: ${loss.businessInterruption ? `${loss.businessInterruption.min}/${loss.businessInterruption.likely}/${loss.businessInterruption.max}` : 'n/a'}`,
        `Regulatory and legal: ${loss.regulatoryLegal ? `${loss.regulatoryLegal.min}/${loss.regulatoryLegal.likely}/${loss.regulatoryLegal.max}` : 'n/a'}`,
        `Notes: ${entry.summary || ''}`
      ].join('\n');
    }).join('\n\n');
  }


  function _deriveFreshnessLabel(lastUpdated = '') {
    const year = _parseYear(lastUpdated);
    if (!year) return 'Date unknown';
    const currentYear = _getCurrentYear();
    const age = currentYear - year;
    if (age <= 1) return 'Recent source';
    if (age <= 3) return 'Established source';
    return 'Older source';
  }

  function _deriveConfidenceLabel(entry = {}) {
    if (entry.sourceType === 'calibration') return 'Directional baseline';
    if (entry.sourceType === 'regulatory') return 'High confidence';
    if (entry.sourceType === 'official' && (entry.scope === 'regional' || entry.scope === 'industry')) return 'High confidence';
    if (entry.sourceType === 'official') return 'Strong reference';
    if (entry.scope === 'regional' || entry.scope === 'industry') return 'Good fit';
    return 'Fallback reference';
  }

  function buildReferenceList(entries = []) {
    return (Array.isArray(entries) ? entries : []).map(entry => ({
      id: entry.id,
      title: entry.title,
      sourceTitle: entry.sourceTitle,
      sourceType: entry.sourceType,
      scope: entry.scope,
      geography: entry.geographyMatch || 'Global',
      url: entry.sourceUrl,
      summary: entry.summary || '',
      lastUpdated: entry.lastUpdated || '',
      sourceTypeLabel: _humaniseSourceType(entry.sourceType),
      freshnessLabel: _deriveFreshnessLabel(entry.lastUpdated),
      confidenceLabel: _deriveConfidenceLabel(entry)
    }));
  }

  function buildInputProvenance(entries = []) {
    const primary = Array.isArray(entries) && entries.length ? entries[0] : null;
    if (!primary) return [];
    const origin = primary.sourceType === 'calibration'
      ? 'Scenario calibration baseline'
      : primary.scope === 'regional'
        ? 'Regional benchmark'
        : primary.scope === 'global'
          ? 'Global benchmark'
          : primary.scope === 'industry'
            ? 'Industry benchmark'
            : 'Official benchmark';
    const reason = primary.summary || 'Starting values aligned to the closest structured benchmark profile for this scenario.';
    const sourceTitle = primary.sourceTitle || '';
    const lastUpdated = primary.lastUpdated || '';
    const sourceTypeLabel = _humaniseSourceType(primary.sourceType);
    const freshnessLabel = _deriveFreshnessLabel(lastUpdated);
    const confidenceLabel = _deriveConfidenceLabel(primary);
    return [
      { label: 'Event frequency', origin, scope: primary.scope, reason, sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel },
      { label: 'Threat capability and control strength', origin, scope: primary.scope, reason: 'Exposure starting points were aligned to the same benchmark profile before BU and user context were applied.', sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel },
      { label: 'Business disruption cost', origin, scope: primary.scope, reason: 'The business interruption range was seeded from the closest published benchmark profile for this scenario type.', sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel },
      { label: 'Regulatory and legal cost', origin, scope: primary.scope, reason: 'The regulatory and legal range was seeded from the same benchmark profile and is intended as a challengeable starting point.', sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel }
    ];
  }

  return {
    init,
    retrieveRelevantBenchmarks,
    deriveSuggestedInputs,
    summariseBenchmarkBasis,
    buildPromptBlock,
    buildReferenceList,
    buildInputProvenance
  };
})();
