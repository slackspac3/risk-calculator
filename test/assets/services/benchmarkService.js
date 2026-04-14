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
    'ai-model-risk': {
      title: 'AI and model-risk calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to an AI-governance or model-risk scenario. The starting values emphasise governance challenge, remediation, and stakeholder trust rather than pure infrastructure loss.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 0.9, max: 4 },
        controlStrength: { min: 0.36, likely: 0.54, max: 0.76 },
        threatCapability: { min: 0.28, likely: 0.46, max: 0.68 },
        lossComponents: {
          incidentResponse: { min: 40000, likely: 140000, max: 420000 },
          businessInterruption: { min: 50000, likely: 220000, max: 900000 },
          dataBreachRemediation: { min: 10000, likely: 50000, max: 220000 },
          regulatoryLegal: { min: 50000, likely: 220000, max: 980000 },
          thirdPartyLiability: { min: 0, likely: 30000, max: 180000 },
          reputationContract: { min: 120000, likely: 420000, max: 1600000 }
        }
      }
    },
    'data-governance': {
      title: 'Data governance and privacy calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a data-governance scenario. The starting values emphasise lineage, retention, privacy remediation, and assurance-quality control gaps.',
      suggestedInputs: {
        TEF: { min: 0.3, likely: 1.4, max: 6 },
        controlStrength: { min: 0.36, likely: 0.54, max: 0.76 },
        threatCapability: { min: 0.3, likely: 0.48, max: 0.7 },
        lossComponents: {
          incidentResponse: { min: 35000, likely: 120000, max: 360000 },
          businessInterruption: { min: 50000, likely: 180000, max: 700000 },
          dataBreachRemediation: { min: 60000, likely: 220000, max: 900000 },
          regulatoryLegal: { min: 40000, likely: 180000, max: 900000 },
          thirdPartyLiability: { min: 0, likely: 30000, max: 160000 },
          reputationContract: { min: 80000, likely: 260000, max: 980000 }
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
    'fraud-integrity': {
      title: 'Fraud and integrity calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a fraud, integrity, or financial-crime scenario. The starting values emphasise direct loss, investigation, and downstream assurance or legal cost.',
      suggestedInputs: {
        TEF: { min: 0.4, likely: 1.8, max: 7 },
        controlStrength: { min: 0.34, likely: 0.52, max: 0.74 },
        threatCapability: { min: 0.38, likely: 0.58, max: 0.8 },
        lossComponents: {
          incidentResponse: { min: 50000, likely: 150000, max: 460000 },
          businessInterruption: { min: 40000, likely: 160000, max: 650000 },
          dataBreachRemediation: { min: 0, likely: 10000, max: 70000 },
          regulatoryLegal: { min: 50000, likely: 220000, max: 1100000 },
          thirdPartyLiability: { min: 40000, likely: 170000, max: 780000 },
          reputationContract: { min: 80000, likely: 280000, max: 1100000 }
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
    'legal-contract': {
      title: 'Legal and contract calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a legal or contract scenario. The starting values emphasise dispute cost, delay, and commercial pressure tied to rights, indemnities, or delivery obligations.',
      suggestedInputs: {
        TEF: { min: 0.25, likely: 1, max: 4 },
        controlStrength: { min: 0.36, likely: 0.54, max: 0.76 },
        threatCapability: { min: 0.28, likely: 0.46, max: 0.68 },
        lossComponents: {
          incidentResponse: { min: 25000, likely: 90000, max: 300000 },
          businessInterruption: { min: 70000, likely: 260000, max: 1000000 },
          dataBreachRemediation: { min: 0, likely: 5000, max: 25000 },
          regulatoryLegal: { min: 120000, likely: 460000, max: 2000000 },
          thirdPartyLiability: { min: 25000, likely: 120000, max: 620000 },
          reputationContract: { min: 100000, likely: 340000, max: 1300000 }
        }
      }
    },
    geopolitical: {
      title: 'Geopolitical and market-access calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a geopolitical scenario. The starting values emphasise delayed access, supplier restriction, and strategic reprioritisation rather than rapid high-frequency loss.',
      suggestedInputs: {
        TEF: { min: 0.1, likely: 0.6, max: 2.5 },
        controlStrength: { min: 0.34, likely: 0.5, max: 0.72 },
        threatCapability: { min: 0.2, likely: 0.36, max: 0.58 },
        lossComponents: {
          incidentResponse: { min: 25000, likely: 90000, max: 280000 },
          businessInterruption: { min: 150000, likely: 550000, max: 2200000 },
          dataBreachRemediation: { min: 0, likely: 0, max: 15000 },
          regulatoryLegal: { min: 50000, likely: 180000, max: 900000 },
          thirdPartyLiability: { min: 20000, likely: 90000, max: 420000 },
          reputationContract: { min: 180000, likely: 680000, max: 2600000 }
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
    'physical-security': {
      title: 'Physical security calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a physical-security scenario. The starting values emphasise site disruption, investigation, and safety or leadership assurance pressure.',
      suggestedInputs: {
        TEF: { min: 0.25, likely: 1.2, max: 5 },
        controlStrength: { min: 0.34, likely: 0.5, max: 0.72 },
        threatCapability: { min: 0.3, likely: 0.48, max: 0.7 },
        lossComponents: {
          incidentResponse: { min: 45000, likely: 150000, max: 460000 },
          businessInterruption: { min: 120000, likely: 420000, max: 1700000 },
          dataBreachRemediation: { min: 0, likely: 0, max: 15000 },
          regulatoryLegal: { min: 20000, likely: 90000, max: 420000 },
          thirdPartyLiability: { min: 10000, likely: 50000, max: 240000 },
          reputationContract: { min: 90000, likely: 280000, max: 1100000 }
        }
      }
    },
    'ot-resilience': {
      title: 'OT and site-resilience calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to an OT or site-systems scenario. The starting values emphasise unstable operations, recovery strain, and safety-linked shutdown decisions.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 1, max: 4.5 },
        controlStrength: { min: 0.34, likely: 0.52, max: 0.74 },
        threatCapability: { min: 0.3, likely: 0.5, max: 0.74 },
        lossComponents: {
          incidentResponse: { min: 60000, likely: 180000, max: 560000 },
          businessInterruption: { min: 180000, likely: 700000, max: 2800000 },
          dataBreachRemediation: { min: 0, likely: 15000, max: 90000 },
          regulatoryLegal: { min: 30000, likely: 120000, max: 520000 },
          thirdPartyLiability: { min: 10000, likely: 60000, max: 300000 },
          reputationContract: { min: 90000, likely: 300000, max: 1200000 }
        }
      }
    },
    'people-workforce': {
      title: 'People and workforce calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a people or workforce scenario. The starting values emphasise staffing strain, welfare, continuity pressure, and management intervention.',
      suggestedInputs: {
        TEF: { min: 0.3, likely: 1.2, max: 5 },
        controlStrength: { min: 0.36, likely: 0.54, max: 0.76 },
        threatCapability: { min: 0.26, likely: 0.42, max: 0.64 },
        lossComponents: {
          incidentResponse: { min: 30000, likely: 100000, max: 320000 },
          businessInterruption: { min: 100000, likely: 360000, max: 1500000 },
          dataBreachRemediation: { min: 0, likely: 0, max: 15000 },
          regulatoryLegal: { min: 30000, likely: 120000, max: 600000 },
          thirdPartyLiability: { min: 0, likely: 30000, max: 180000 },
          reputationContract: { min: 90000, likely: 320000, max: 1300000 }
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
    'investment-jv': {
      title: 'Investment and JV calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to an investment, M&A, or JV scenario. The starting values emphasise value erosion, integration drag, and executive reprioritisation.',
      suggestedInputs: {
        TEF: { min: 0.15, likely: 0.6, max: 2.5 },
        controlStrength: { min: 0.36, likely: 0.54, max: 0.76 },
        threatCapability: { min: 0.24, likely: 0.42, max: 0.64 },
        lossComponents: {
          incidentResponse: { min: 40000, likely: 120000, max: 360000 },
          businessInterruption: { min: 140000, likely: 480000, max: 1800000 },
          dataBreachRemediation: { min: 0, likely: 5000, max: 30000 },
          regulatoryLegal: { min: 25000, likely: 110000, max: 500000 },
          thirdPartyLiability: { min: 0, likely: 40000, max: 220000 },
          reputationContract: { min: 180000, likely: 700000, max: 2800000 }
        }
      }
    },
    'transformation-delivery': {
      title: 'Transformation-delivery calibration baseline',
      summary: 'Used when no structured published benchmark maps directly to a transformation or programme-delivery scenario. The starting values emphasise slippage, rising cost, and delayed benefit realisation.',
      suggestedInputs: {
        TEF: { min: 0.2, likely: 0.9, max: 4 },
        controlStrength: { min: 0.34, likely: 0.52, max: 0.74 },
        threatCapability: { min: 0.26, likely: 0.44, max: 0.66 },
        lossComponents: {
          incidentResponse: { min: 30000, likely: 100000, max: 320000 },
          businessInterruption: { min: 120000, likely: 420000, max: 1600000 },
          dataBreachRemediation: { min: 0, likely: 0, max: 15000 },
          regulatoryLegal: { min: 15000, likely: 70000, max: 320000 },
          thirdPartyLiability: { min: 0, likely: 30000, max: 180000 },
          reputationContract: { min: 140000, likely: 520000, max: 2100000 }
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
    _benchmarks = Array.isArray(list) ? list.map(_normaliseBenchmarkEntry) : [];
  }

  function _normalise(text) {
    return String(text || '').trim().toLowerCase();
  }

  function _canonicalSourceType(sourceType = '') {
    const value = _normalise(sourceType);
    if (!value) return '';
    if (value === 'calibration' || value === 'official' || value === 'regulatory' || value === 'industry' || value === 'internal' || value === 'benchmark') return value;
    if (value === 'global benchmark' || value === 'regional benchmark' || value === 'industry benchmark') return 'benchmark';
    if (value === 'government statistic' || value === 'official enforcement framework' || value === 'official enforcement cases') return 'official';
    if (value === 'regulatory / research') return 'regulatory';
    return value;
  }

  function _canonicalScope(entry = {}) {
    const scope = _normalise(entry.scope);
    if (scope === 'global' || scope === 'regional' || scope === 'industry' || scope === 'scenario') return scope;
    if (scope === 'official-statistic') return 'global';
    if (scope === 'regulatory') {
      return (Array.isArray(entry.geographies) && entry.geographies.some(label => label === 'EMEA' || label === 'European Union' || label === 'United Kingdom' || label === 'United States'))
        ? 'regional'
        : 'global';
    }
    const sourceType = _normalise(entry.sourceType);
    if (sourceType === 'global benchmark') return 'global';
    if (sourceType === 'regional benchmark') return 'regional';
    if (sourceType === 'industry benchmark') return 'industry';
    return scope || 'global';
  }

  function _normaliseBenchmarkEntry(entry = {}) {
    const normalized = {
      ...entry,
      rawSourceType: entry.sourceType,
      rawScope: entry.scope,
      sourceType: _canonicalSourceType(entry.sourceType),
      scope: _canonicalScope(entry)
    };
    if (normalized.sourceType === 'benchmark' && !['global', 'regional', 'industry'].includes(normalized.scope)) {
      normalized.scope = 'global';
    }
    return normalized;
  }

  function _detectScenarioType(query = '') {
    const q = _normalise(query);
    if (/responsible ai|model risk|ai governance|model drift|hallucination|algorithmic bias|training data|ai act/.test(q)) return 'ai-model-risk';
    if (/data governance|data quality|data lineage|record retention|records? of processing|ropa|approved use|approved-use|data retention|retention schedule|purpose limitation|consent|data residency|master data/.test(q)) return 'data-governance';
    if (/gpu export|export control|export licence|export license|entity list|ear|bis|semiconductor equipment|china restrictions|sanctions breach/.test(q)) return 'export-control';
    if (/azure ad|entra|identity|credential|account takeover|sso|directory|mailbox compromise|session hijack/.test(q)) return 'identity';
    if (/ransom|encrypt|extortion/.test(q)) return 'ransomware';
    if (/cloud|storage bucket|misconfig|tenant|saas|public exposure/.test(q)) return 'cloud';
    if (/privacy|data breach|data exposure|pii|phi|privacy incident|breach notification|notifiable breach|personal data exposure/.test(q)) return 'data-breach';
    if (/fraud|financial crime|money laundering|kickback|bribery|corruption|embezzlement|integrity breakdown/.test(q)) return 'fraud-integrity';
    if (/contract dispute|indemnity|licensing dispute|ip ownership|intellectual property|litigation|terms breach/.test(q)) return 'legal-contract';
    if (/geopolitical|market access|sovereign|cross-border restriction|tariff/.test(q)) return 'geopolitical';
    if (/modern slavery|forced labor|forced labour|exploitative labor|exploitative labour|human rights due diligence|human rights abuse|recruitment fees?|passport retention|withheld passports?|worker grievance|grievance mechanism|remediation plan|labou?r broker/.test(q)) return 'esg';
    if (/esg|sustainability|climate|emission|scope 1|scope 2|scope 3|carbon|greenwashing|disclosure|sustainability-related financial|ifrs s1|ifrs s2|value chain emissions|nature related|transition plan|transition risk|physical risk|metrics and targets|assurance challenge|sustainability-linked|grievance and remediation/.test(q)) return 'esg';
    if (/procurement|sourcing|tender|bid|bid rigging|contract award|vendor selection|purchasing|collusion|kickback|conflict of interest|supplier due diligence/.test(q)) return 'procurement';
    if (/supply chain|logistics|inventory|shipment|upstream|sub tier|sub-tier|single source|sole source|dependency/.test(q)) return 'supply-chain';
    if (/fraud|payment|invoice|wire transfer|payment diversion|treasury|liquidity|capital|financial control|misstatement|journal entry|revenue recognition/.test(q)) return 'financial';
    if (/supplier|vendor|third party|third-party|outsourcing/.test(q)) return 'third-party';
    if (/business continuity|continuity|outage|downtime|power event|disaster recovery|recovery objective|recovery plan|rto|rpo|crisis management/.test(q)) return 'business-continuity';
    if (/physical security|executive protection|facility breach|visitor management|badge control|perimeter breach|site intrusion/.test(q)) return 'physical-security';
    if (/\bot\b|operational technology|ics|scada|industrial control|plant network|site systems|control room/.test(q)) return 'ot-resilience';
    if (/workforce|labou?r|staffing pressure|fatigue|attrition|strike|worker welfare|contractor welfare/.test(q)) return 'people-workforce';
    if (/health and safety|occupational safety|injury|worker safety|contractor safety|hse|ehs|environmental|spill|hazard|site shutdown|near miss/.test(q)) return 'hse';
    if (/merger|acquisition|m&a|joint venture|jv|integration thesis|post-merger integration|deal value|synergy/.test(q)) return 'investment-jv';
    if (/transformation delivery|programme delivery|program delivery|project delivery|go-live|milestone slip|benefit realization|benefit realisation/.test(q)) return 'transformation-delivery';
    if (/strategy|strategic|market shift|competitive|transformation|portfolio|investment/.test(q)) return 'strategic';
    if (/operational|process failure|capacity|breakdown|service failure|backlog|workflow/.test(q)) return 'operational';
    if (/regulator|regulatory|licen|filing|supervisory|sanction|enforcement/.test(q)) return 'regulatory';
    if (/compliance|non-compliance|policy breach|conduct|ethics|assurance|anti bribery|anti-bribery|corruption|whistleblow|speak-up|speak up|retaliation|internal investigation|hotline|gift[s]? and entertainment|hospitality policy|conflicts? of interest|insider information|blackout period/.test(q)) return 'compliance';
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
    if (/manufacturing|plant|factory|\bot\b|\bics\b/.test(text)) return 'manufacturing';
    return 'cross-sector';
  }

  function _canonicalRequestedGeography(value = '') {
    const text = _normalise(value);
    if (!text) return '';
    if (/abu dhabi/.test(text)) return 'Abu Dhabi';
    if (/dubai/.test(text)) return 'Dubai';
    if (/united arab emirates|^uae$|\bemirates\b/.test(text)) return 'United Arab Emirates';
    if (/^gcc$|gulf/.test(text)) return 'GCC';
    if (/saudi/.test(text)) return 'Saudi Arabia';
    if (/qatar/.test(text)) return 'Qatar';
    if (/kuwait/.test(text)) return 'Kuwait';
    if (/bahrain/.test(text)) return 'Bahrain';
    if (/oman/.test(text)) return 'Oman';
    if (/north africa|n africa/.test(text)) return 'North Africa';
    if (/middle east|mena/.test(text)) return 'Middle East';
    if (/european union|\beu\b/.test(text)) return 'European Union';
    if (/europe/.test(text)) return 'Europe';
    if (/united kingdom|\buk\b|britain|england/.test(text)) return 'United Kingdom';
    if (/united states|u\.s\.a|u\.s\.|\busa\b|\bus\b|america|american/.test(text)) return 'United States';
    if (/india/.test(text)) return 'India';
    if (/asia pacific|^apac$/.test(text)) return 'Asia Pacific';
    if (/^emea$/.test(text)) return 'EMEA';
    if (/global|worldwide|cross-border/.test(text)) return 'Global';
    return String(value || '').trim();
  }

  function _normaliseRequestedGeographies(geography = '') {
    const input = Array.isArray(geography)
      ? geography
      : String(geography || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
    const seen = new Set();
    const list = [];
    input.forEach(item => {
      const label = _canonicalRequestedGeography(item);
      if (!label) return;
      const key = _normalise(label);
      if (seen.has(key)) return;
      seen.add(key);
      list.push(label);
    });
    return list.length ? list : ['Global'];
  }

  function _buildGeographyContext(label = '') {
    switch (label) {
      case 'United Arab Emirates':
        return { label, exactLabels: ['United Arab Emirates'], priorities: ['United Arab Emirates', 'GCC', 'Middle East', 'EMEA', 'Global'] };
      case 'Abu Dhabi':
      case 'Dubai':
        return { label, exactLabels: [], priorities: ['United Arab Emirates', 'GCC', 'Middle East', 'EMEA', 'Global'] };
      case 'GCC':
        return { label, exactLabels: ['GCC'], priorities: ['GCC', 'Middle East', 'EMEA', 'Global'] };
      case 'Saudi Arabia':
      case 'Qatar':
      case 'Kuwait':
      case 'Bahrain':
      case 'Oman':
        return { label, exactLabels: [label], priorities: [label, 'GCC', 'Middle East', 'EMEA', 'Global'] };
      case 'Middle East':
        return { label, exactLabels: ['Middle East'], priorities: ['Middle East', 'GCC', 'EMEA', 'Global'] };
      case 'North Africa':
        return { label, exactLabels: ['North Africa'], priorities: ['North Africa', 'EMEA', 'Global'] };
      case 'European Union':
        return { label, exactLabels: ['European Union', 'EU'], priorities: ['European Union', 'EU', 'EMEA', 'Global'] };
      case 'Europe':
        return { label, exactLabels: [], priorities: ['European Union', 'EU', 'United Kingdom', 'EMEA', 'Global'] };
      case 'United Kingdom':
        return { label, exactLabels: ['United Kingdom'], priorities: ['United Kingdom', 'EMEA', 'Global'] };
      case 'United States':
        return { label, exactLabels: ['United States'], priorities: ['United States', 'Global'] };
      case 'India':
        return { label, exactLabels: ['India'], priorities: ['India', 'APAC', 'Global'] };
      case 'Asia Pacific':
        return { label, exactLabels: ['APAC'], priorities: ['APAC', 'Global'] };
      case 'EMEA':
        return { label, exactLabels: ['EMEA'], priorities: ['EMEA', 'Global'] };
      case 'Global':
      default:
        return { label: label || 'Global', exactLabels: ['Global'], priorities: ['Global'] };
    }
  }

  function _resolveRequestedGeographyContexts(geography = '') {
    return _normaliseRequestedGeographies(geography).map(_buildGeographyContext);
  }

  function _detectGeographyLabels(geography = '') {
    return Array.from(new Set(
      _resolveRequestedGeographyContexts(geography)
        .flatMap(context => [...context.exactLabels, ...context.priorities, 'Global'])
        .filter(Boolean)
    ));
  }

  function _describeCoverageMatch(context = {}, matchedGeography = 'Global') {
    const requested = context?.label || 'Global';
    const exactLabels = Array.isArray(context?.exactLabels) ? context.exactLabels : [];
    if (matchedGeography === 'Global') {
      return {
        coverageType: 'global-fallback',
        coverageLabel: 'Global best practice',
        coverageSummary: `No direct ${requested} benchmark data was saved for this scenario family, so global best-practice comparator data was used.`
      };
    }
    if (exactLabels.includes(matchedGeography)) {
      return {
        coverageType: 'exact-region',
        coverageLabel: 'Exact region',
        coverageSummary: `The selected comparator matched the requested geography ${requested}.`
      };
    }
    if ((requested === 'Abu Dhabi' || requested === 'Dubai') && matchedGeography === 'United Arab Emirates') {
      return {
        coverageType: 'national-proxy',
        coverageLabel: 'National proxy',
        coverageSummary: `${requested} was normalised using United Arab Emirates benchmark data because city-specific FAIR comparators were not saved.`
      };
    }
    return {
      coverageType: 'regional-umbrella',
      coverageLabel: 'Regional comparator',
      coverageSummary: `${requested} was normalised using ${matchedGeography} comparator data because a direct like-for-like regional benchmark was not saved for this scenario family.`
    };
  }

  function _selectEntryForGeographyRequest(entries = [], context = {}, usedIds = new Set()) {
    const priorities = Array.isArray(context?.priorities) ? context.priorities : ['Global'];
    const requestedIndustry = String(context?.industry || 'cross-sector').trim() || 'cross-sector';
    const query = String(context?.query || '');
    const matches = [];
    entries.forEach(entry => {
      if (!entry || usedIds.has(entry.id)) return;
      const entryGeographies = Array.isArray(entry.geographies) ? entry.geographies : [];
      const entryIndustries = Array.isArray(entry.industries) ? entry.industries : [];
      const priorityIndex = priorities.findIndex(label => entryGeographies.includes(label));
      if (priorityIndex === -1) return;
      const industryFitRank = entryIndustries.includes(requestedIndustry)
        ? 3
        : entryIndustries.includes('cross-sector')
          ? 2
          : 1;
      const scopeRank = entry.scope === 'regional'
        ? 3
        : entry.scope === 'industry'
          ? 2
          : entry.scope === 'global'
            ? 1
            : 0;
      matches.push({
        entry,
        matchedGeography: priorities[priorityIndex],
        priorityIndex,
        industryFitRank,
        scopeRank,
        queryFitRank: _scoreQueryOverlap(entry, query)
      });
    });
    matches.sort((a, b) => {
      if (a.priorityIndex !== b.priorityIndex) return a.priorityIndex - b.priorityIndex;
      if (a.queryFitRank !== b.queryFitRank) return b.queryFitRank - a.queryFitRank;
      if (a.industryFitRank !== b.industryFitRank) return b.industryFitRank - a.industryFitRank;
      if (a.scopeRank !== b.scopeRank) return b.scopeRank - a.scopeRank;
      if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
      return _parseYear(b.entry.lastUpdated) - _parseYear(a.entry.lastUpdated);
    });
    return matches[0] || null;
  }

  function _buildSelectionContext({ scenarioType = 'general', industry = 'cross-sector', requestContexts = [], coverageRows = [], usedCalibration = false } = {}) {
    const requestedGeographies = requestContexts.map(context => context.label).filter(Boolean);
    const distinctMatchedGeographies = Array.from(new Set(coverageRows.map(row => row.matchedGeography).filter(Boolean)));
    return {
      scenarioType,
      industry,
      requestedGeographies,
      multiRegion: requestedGeographies.length > 1,
      usedCalibration: !!usedCalibration,
      usedGlobalFallback: coverageRows.some(row => row.coverageType === 'global-fallback'),
      usedRegionalProxy: coverageRows.some(row => row.coverageType === 'regional-umbrella' || row.coverageType === 'national-proxy'),
      matchedGeographies: distinctMatchedGeographies,
      coverageRows: coverageRows.map(row => ({
        requestedGeography: row.requestedGeography,
        matchedGeography: row.matchedGeography,
        coverageType: row.coverageType,
        coverageLabel: row.coverageLabel,
        coverageSummary: row.coverageSummary,
        benchmarkId: row.entry?.id || ''
      }))
    };
  }

  function _annotateEntrySelection(entry = {}, selectionContext = null, coverageMatches = [], selectionRole = 'primary') {
    const firstCoverage = Array.isArray(coverageMatches) && coverageMatches.length ? coverageMatches[0] : null;
    return {
      ...entry,
      selectionContext,
      selectionRole,
      coverageMatches: Array.isArray(coverageMatches) ? coverageMatches : [],
      requestedGeography: firstCoverage?.requestedGeography || entry.requestedGeography || '',
      geographyMatch: firstCoverage?.matchedGeography || entry.geographyMatch || 'Global',
      coverageType: firstCoverage?.coverageType || entry.coverageType || '',
      coverageLabel: firstCoverage?.coverageLabel || entry.coverageLabel || '',
      coverageSummary: firstCoverage?.coverageSummary || entry.coverageSummary || ''
    };
  }

  function _scoreQueryOverlap(entry, query = '') {
    const q = _normalise(query);
    if (!q) return 0;
    const referenceText = _normalise([
      entry?.title,
      entry?.summary,
      entry?.sourceTitle
    ].filter(Boolean).join(' '));
    if (!referenceText) return 0;
    const stopwords = new Set([
      'with', 'from', 'into', 'over', 'under', 'after', 'before', 'across', 'through',
      'their', 'there', 'where', 'which', 'while', 'because', 'cannot', 'could', 'would',
      'should', 'being', 'about', 'report', 'reported', 'reports', 'profile', 'global',
      'united', 'states', 'uae', 'gcc', 'risk', 'management'
    ]);
    const queryTokens = Array.from(new Set(
      q.match(/[a-z0-9][a-z0-9-]+/g) || []
    )).filter(token => {
      if (token === 'ifrs' || token === 'esg') return true;
      return token.length >= 4 && !stopwords.has(token);
    });
    let score = 0;
    for (const token of queryTokens) {
      if (referenceText.includes(token)) score += 1;
      if (score >= 6) break;
    }
    return score;
  }

  function _score(entry, scenarioType, industry, geographyLabels, query = '') {
    let score = 0;
    const entryGeographies = Array.isArray(entry.geographies) ? entry.geographies : [];
    const entryIndustries = Array.isArray(entry.industries) ? entry.industries : [];
    const labels = Array.isArray(geographyLabels) ? geographyLabels : [];
    const exactGeographyLabels = labels.filter(label => label !== 'Global');
    const hasExactGeographyMatch = exactGeographyLabels.some(label => entryGeographies.includes(label));
    const hasGlobalMatch = labels.includes('Global') && entryGeographies.includes('Global');
    if (entry.scenarioType === scenarioType) score += 10;
    if (entryIndustries.includes(industry)) score += 5;
    else if (entryIndustries.includes('cross-sector')) score += 2;
    else if (industry === 'cross-sector' && entryIndustries.length) score -= 2;
    if (hasExactGeographyMatch) score += 8;
    if (hasGlobalMatch) score += 2;
    if ((entry.scope || '') === 'regional' && hasExactGeographyMatch) score += 3;
    if ((entry.scope || '') === 'global') score += 1;
    score += _scoreQueryOverlap(entry, query);
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

  function _averageNumbers(values = [], digits = 4) {
    const usable = (Array.isArray(values) ? values : [])
      .map(value => Number(value))
      .filter(value => Number.isFinite(value));
    if (!usable.length) return 0;
    const average = usable.reduce((sum, value) => sum + value, 0) / usable.length;
    return Number(average.toFixed(digits));
  }

  function _blendRangeValues(ranges = [], digits = 4) {
    const usable = (Array.isArray(ranges) ? ranges : []).filter(Boolean);
    if (!usable.length) return null;
    const ordered = [
      _averageNumbers(usable.map(range => range.min), digits),
      _averageNumbers(usable.map(range => range.likely), digits),
      _averageNumbers(usable.map(range => range.max), digits)
    ].sort((a, b) => a - b);
    return {
      min: ordered[0],
      likely: ordered[1],
      max: ordered[2]
    };
  }

  function _blendSuggestedInputs(entries = []) {
    const usableEntries = (Array.isArray(entries) ? entries : []).filter(entry => entry?.suggestedInputs);
    if (!usableEntries.length) return null;
    if (usableEntries.length === 1) return _cloneSuggestedInputs(usableEntries[0].suggestedInputs);
    const tef = _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.TEF));
    const controlStrength = _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.controlStrength));
    const threatCapability = _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.threatCapability));
    const lossComponents = {
      incidentResponse: _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.lossComponents?.incidentResponse), 0),
      businessInterruption: _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.lossComponents?.businessInterruption), 0),
      dataBreachRemediation: _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.lossComponents?.dataBreachRemediation), 0),
      regulatoryLegal: _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.lossComponents?.regulatoryLegal), 0),
      thirdPartyLiability: _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.lossComponents?.thirdPartyLiability), 0),
      reputationContract: _blendRangeValues(usableEntries.map(entry => entry.suggestedInputs?.lossComponents?.reputationContract), 0)
    };
    return {
      TEF: tef,
      controlStrength,
      threatCapability,
      lossComponents
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

  function _humaniseSourceType(sourceType = '', scope = '') {
    const value = _canonicalSourceType(sourceType);
    const canonicalScope = _canonicalScope({ scope, sourceType });
    if (value === 'calibration') return 'Scenario calibration';
    if (value === 'benchmark') {
      if (canonicalScope === 'regional') return 'Regional benchmark';
      if (canonicalScope === 'industry') return 'Industry benchmark';
      return 'Global benchmark';
    }
    if (value === 'official') return 'Official source';
    if (value === 'regulatory') return 'Regulatory source';
    if (value === 'industry') return 'Industry research';
    if (value === 'internal') return 'Internal source';
    return value ? `${sourceType}` : 'Published source';
  }

  function retrieveRelevantBenchmarks({ query = '', geography = '', businessUnit = null, topK = 3 } = {}) {
    const scenarioType = _detectScenarioType(query);
    const industry = _detectIndustry(businessUnit || {}, query);
    const requestContexts = _resolveRequestedGeographyContexts(geography || businessUnit?.geography || '');
    const geographyLabels = Array.from(new Set(
      requestContexts.flatMap(context => [...context.exactLabels, ...context.priorities]).filter(Boolean)
    ));
    const ranked = _benchmarks
      .map(entry => ({
        ...entry,
        score: _score(entry, scenarioType, industry, geographyLabels, query),
        scenarioMatch: scenarioType,
        industryMatch: industry,
        geographyMatch: geographyLabels.find(label => (entry.geographies || []).includes(label)) || 'Global'
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const exactMatches = ranked.filter(entry => entry.scenarioType === scenarioType);
    if (exactMatches.length) {
      const primaryCoverage = [];
      requestContexts.forEach(context => {
        const match = _selectEntryForGeographyRequest(exactMatches, { ...context, industry, query });
        if (!match) return;
        const coverage = _describeCoverageMatch(context, match.matchedGeography);
        primaryCoverage.push({
          entry: match.entry,
          requestedGeography: context.label,
          matchedGeography: match.matchedGeography,
          ...coverage
        });
      });
      const selectionContext = _buildSelectionContext({
        scenarioType,
        industry,
        requestContexts,
        coverageRows: primaryCoverage
      });
      const primaryById = new Map();
      primaryCoverage.forEach(row => {
        const current = primaryById.get(row.entry.id) || { entry: row.entry, coverageMatches: [] };
        current.coverageMatches.push({
          requestedGeography: row.requestedGeography,
          matchedGeography: row.matchedGeography,
          coverageType: row.coverageType,
          coverageLabel: row.coverageLabel,
          coverageSummary: row.coverageSummary
        });
        primaryById.set(row.entry.id, current);
      });
      const selected = Array.from(primaryById.values()).map(item =>
        _annotateEntrySelection(item.entry, selectionContext, item.coverageMatches, 'primary')
      );
      const secondary = exactMatches
        .filter(entry => !primaryById.has(entry.id))
        .slice(0, Math.max(0, topK - selected.length))
        .map(entry => _annotateEntrySelection(entry, selectionContext, [], 'secondary'));
      return [...selected, ...secondary].slice(0, topK);
    }
    // Avoid silently borrowing an identity or breach profile for enterprise scenarios that have no published like-for-like benchmark entry yet.
    const calibration = _buildCalibrationEntry(scenarioType, industry, requestContexts.map(context => context.label));
    if (calibration) {
      const coverageRows = requestContexts.map(context => {
        const coverage = _describeCoverageMatch(context, 'Global');
        return {
          entry: calibration,
          requestedGeography: context.label,
          matchedGeography: 'Global',
          ...coverage
        };
      });
      const selectionContext = _buildSelectionContext({
        scenarioType,
        industry,
        requestContexts,
        coverageRows,
        usedCalibration: true
      });
      return [
        _annotateEntrySelection(calibration, selectionContext, coverageRows.map(row => ({
          requestedGeography: row.requestedGeography,
          matchedGeography: row.matchedGeography,
          coverageType: 'calibration',
          coverageLabel: 'Scenario baseline',
          coverageSummary: `No structured published benchmark mapped directly to ${row.requestedGeography}, so a scenario calibration baseline was used.`
        })), 'primary')
      ].slice(0, topK);
    }
    return ranked.slice(0, topK);
  }

  function deriveSuggestedInputs(entries = []) {
    const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
    const selectionContext = list[0]?.selectionContext || null;
    const primaryEntries = list.filter(entry => entry?.selectionRole === 'primary' && entry?.suggestedInputs);
    const usableEntries = primaryEntries.length ? primaryEntries : list.filter(entry => entry?.suggestedInputs);
    if (!usableEntries.length) return null;
    if (selectionContext?.multiRegion) {
      return _blendSuggestedInputs(usableEntries);
    }
    return _cloneSuggestedInputs(usableEntries[0].suggestedInputs);
  }

  function summariseBenchmarkBasis(entries = []) {
    if (!entries.length) return '';
    const primary = entries.find(entry => entry?.selectionRole === 'primary') || entries[0];
    const fallback = entries.find(entry => entry?.selectionRole === 'secondary') || entries[1];
    const selectionContext = primary?.selectionContext || null;
    const primaryType = _canonicalSourceType(primary?.sourceType);
    const coverageRows = Array.isArray(selectionContext?.coverageRows) ? selectionContext.coverageRows : [];
    const parts = [];

    if (primaryType === 'calibration') {
      if (selectionContext?.requestedGeographies?.length) {
        parts.push(`A scenario calibration baseline was applied because no structured published benchmark mapped directly to this enterprise scenario for ${selectionContext.requestedGeographies.join(', ')}.`);
      } else {
        parts.push('A scenario calibration baseline was applied because no structured published benchmark mapped directly to this enterprise scenario.');
      }
    } else if (selectionContext?.multiRegion && coverageRows.length) {
      const regionSummary = coverageRows
        .map(row => `${row.requestedGeography} (${row.coverageLabel.toLowerCase()} via ${row.matchedGeography})`)
        .join(', ');
      parts.push(`Benchmark inputs were normalised evenly across the selected geographies: ${regionSummary}.`);
    } else if (coverageRows.length) {
      const coverage = coverageRows[0];
      if (coverage.coverageType === 'exact-region') {
        parts.push(`Benchmark inputs were seeded from ${coverage.matchedGeography} comparator data for the selected geography.`);
      } else if (coverage.coverageType === 'national-proxy' || coverage.coverageType === 'regional-umbrella') {
        parts.push(coverage.coverageSummary);
      } else if (coverage.coverageType === 'global-fallback') {
        parts.push(coverage.coverageSummary);
      } else {
        parts.push(`${primary.scope === 'regional' ? 'Regional' : primary.scope === 'global' ? 'Global' : primary.scope === 'industry' ? 'Industry' : 'Published'} benchmark logic was applied using ${primary.sourceTitle}.`);
      }
    } else {
      parts.push(`${primary.scope === 'regional' ? 'Regional' : primary.scope === 'global' ? 'Global' : primary.scope === 'industry' ? 'Industry' : 'Published'} benchmark logic was applied using ${primary.sourceTitle}.`);
    }

    if (selectionContext?.usedGlobalFallback && primaryType !== 'calibration') {
      const fallbackGeographies = coverageRows
        .filter(row => row.coverageType === 'global-fallback')
        .map(row => row.requestedGeography);
      if (fallbackGeographies.length) {
        parts.push(`Where direct regional data was unavailable, global best-practice comparators were used for ${Array.from(new Set(fallbackGeographies)).join(', ')}.`);
      }
    }
    if (fallback) parts.push(`A secondary ${fallback.scope} comparator from ${fallback.sourceTitle} was retained as a cross-check.`);
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
    const sourceType = _canonicalSourceType(entry.sourceType);
    const scope = _canonicalScope(entry);
    if (sourceType === 'calibration') return 'Directional baseline';
    if (sourceType === 'regulatory') return 'High confidence';
    if (sourceType === 'official' && (scope === 'regional' || scope === 'industry')) return 'High confidence';
    if (sourceType === 'official') return 'Strong reference';
    if (sourceType === 'benchmark' && (scope === 'regional' || scope === 'industry')) return 'Strong comparator';
    if (sourceType === 'benchmark') return 'Published comparator';
    if (sourceType === 'industry') return 'Good fit';
    if (scope === 'regional' || scope === 'industry') return 'Good fit';
    return 'Fallback reference';
  }

  function buildReferenceList(entries = []) {
    return (Array.isArray(entries) ? entries : []).map(entry => {
      const coverageMatches = Array.isArray(entry?.coverageMatches) ? entry.coverageMatches : [];
      const requestedGeographies = coverageMatches.map(item => item.requestedGeography).filter(Boolean);
      const matchedGeographies = coverageMatches.map(item => item.matchedGeography).filter(Boolean);
      const coverageType = entry.selectionRole === 'secondary'
        ? 'secondary-cross-check'
        : entry.selectionContext?.multiRegion
          ? 'multi-region-normalized'
        : (coverageMatches[0]?.coverageType || entry.coverageType || '');
      const coverageLabel = entry.selectionRole === 'secondary'
        ? 'Cross-check comparator'
        : (entry.selectionContext?.multiRegion
            ? 'Multi-region input'
            : (coverageMatches[0]?.coverageLabel || entry.coverageLabel || 'Benchmark fit'));
      const coverageSummary = entry.selectionRole === 'secondary'
        ? 'Used as a secondary comparator to challenge the primary benchmark fit.'
        : (coverageMatches.length > 1
            ? coverageMatches.map(item => `${item.requestedGeography} → ${item.matchedGeography}`).join(' · ')
            : (coverageMatches[0]?.coverageSummary || entry.coverageSummary || ''));
      return {
        id: entry.id,
        title: entry.title,
        sourceTitle: entry.sourceTitle,
        sourceType: entry.sourceType,
        scope: entry.scope,
        geography: entry.geographyMatch || 'Global',
        requestedGeography: requestedGeographies[0] || entry.requestedGeography || '',
        requestedGeographies,
        matchedGeographies,
        coverageType,
        coverageLabel,
        coverageSummary,
        url: entry.sourceUrl,
        summary: entry.summary || '',
        lastUpdated: entry.lastUpdated || '',
        sourceTypeLabel: _humaniseSourceType(entry.sourceType, entry.scope),
        freshnessLabel: _deriveFreshnessLabel(entry.lastUpdated),
        confidenceLabel: _deriveConfidenceLabel(entry)
      };
    });
  }

  function buildInputProvenance(entries = []) {
    const primary = (Array.isArray(entries) ? entries : []).find(entry => entry?.selectionRole === 'primary') || (Array.isArray(entries) && entries.length ? entries[0] : null);
    if (!primary) return [];
    const sourceType = _canonicalSourceType(primary.sourceType);
    const coverageMatches = Array.isArray(primary.coverageMatches) ? primary.coverageMatches : [];
    const selectionContext = primary.selectionContext || null;
    const primaryCoverage = coverageMatches[0] || null;
    const origin = sourceType === 'calibration'
      ? 'Scenario calibration baseline'
      : selectionContext?.multiRegion
        ? 'Multi-region normalized benchmark'
        : primaryCoverage?.coverageType === 'exact-region'
          ? 'Exact regional benchmark'
          : primaryCoverage?.coverageType === 'global-fallback'
            ? 'Global best-practice comparator'
            : primaryCoverage?.coverageType === 'national-proxy' || primaryCoverage?.coverageType === 'regional-umbrella'
              ? 'Regional comparator'
              : primary.scope === 'regional'
                ? 'Regional benchmark'
                : primary.scope === 'global'
                  ? 'Global benchmark'
                  : primary.scope === 'industry'
                    ? 'Industry benchmark'
                    : sourceType === 'official'
                      ? 'Official reference'
                      : 'Published reference';
    const reason = primary.summary || 'Starting values aligned to the closest structured benchmark profile for this scenario.';
    const sourceTitle = primary.sourceTitle || '';
    const lastUpdated = primary.lastUpdated || '';
    const sourceTypeLabel = _humaniseSourceType(primary.sourceType, primary.scope);
    const freshnessLabel = _deriveFreshnessLabel(lastUpdated);
    const confidenceLabel = _deriveConfidenceLabel(primary);
    const coverageLabel = selectionContext?.multiRegion
      ? 'Multi-region input'
      : (primaryCoverage?.coverageLabel || '');
    const coverageSummary = selectionContext?.multiRegion
      ? selectionContext.coverageRows.map(row => `${row.requestedGeography} → ${row.matchedGeography}`).join(' · ')
      : (primaryCoverage?.coverageSummary || '');
    const requestedGeographies = selectionContext?.requestedGeographies || [];
    const matchedGeographies = selectionContext?.matchedGeographies || [];
    return [
      { label: 'Event frequency', origin, scope: primary.scope, reason, sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel, coverageLabel, coverageSummary, requestedGeographies, matchedGeographies },
      { label: 'Threat capability and control strength', origin, scope: primary.scope, reason: 'Exposure starting points were aligned to the same benchmark profile before BU and user context were applied.', sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel, coverageLabel, coverageSummary, requestedGeographies, matchedGeographies },
      { label: 'Business disruption cost', origin, scope: primary.scope, reason: 'The business interruption range was seeded from the closest published benchmark profile for this scenario type.', sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel, coverageLabel, coverageSummary, requestedGeographies, matchedGeographies },
      { label: 'Regulatory and legal cost', origin, scope: primary.scope, reason: 'The regulatory and legal range was seeded from the same benchmark profile and is intended as a challengeable starting point.', sourceTitle, sourceTypeLabel, lastUpdated, freshnessLabel, confidenceLabel, coverageLabel, coverageSummary, requestedGeographies, matchedGeographies }
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
