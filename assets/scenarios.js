/**
 * scenarios.js — Pre-built scenario templates
 * Each template pre-fills the full wizard with realistic FAIR inputs.
 * Based on common GCC/UAE enterprise operating, control, resilience, and technology risk patterns.
 */

const ScenarioTemplates = [
  {
    id: 'ransomware-ops',
    label: 'Ransomware — Operational Systems',
    icon: 'RW',
    description: 'Ransomware against operational or production systems with outage, extortion, and executive recovery pressure. Useful when business interruption matters more than pure data loss.',
    tags: ['Ransomware', 'High Impact', 'Common'],
    suggestedBUTypes: ['bu-fintech', 'bu-health', 'bu-iot', 'bu-enterprise-it'],
    draft: {
      scenarioTitle: 'Ransomware Attack on Operational Systems',
      narrative: 'A threat actor gains initial access through a phishing email targeting an employee with elevated system privileges. After establishing persistence and conducting internal reconnaissance over several days, they deploy ransomware across connected systems, encrypting critical operational databases and file shares. The attacker simultaneously exfiltrates sensitive data and threatens public release unless a ransom is paid (double-extortion). Systems are offline; manual operations are impossible at scale.',
      structuredScenario: {
        assetService: 'Core operational systems and databases',
        primaryDriver: 'Organised ransomware-as-a-service groups (e.g. LockBit, BlackCat affiliates)',
        eventPath: 'Phishing → credential theft → lateral movement → ransomware deployment',
        effect: 'Encryption of operational systems; data exfiltration; service unavailability; extortion demand'
      },
      fairParams: {
        distType: 'lognormal',
        iterations: 10000,
        tefMin: 0.3, tefLikely: 1.2, tefMax: 4,
        threatCapMin: 0.55, threatCapLikely: 0.72, threatCapMax: 0.90,
        controlStrMin: 0.48, controlStrLikely: 0.65, controlStrMax: 0.82,
        irMin: 120000, irLikely: 380000, irMax: 1200000,
        biMin: 200000, biLikely: 900000, biMax: 5000000,
        dbMin: 80000, dbLikely: 300000, dbMax: 1500000,
        rlMin: 50000, rlLikely: 250000, rlMax: 2000000,
        tpMin: 5000, tpLikely: 80000, tpMax: 600000,
        rcMin: 100000, rcLikely: 500000, rcMax: 3000000,
        secondaryEnabled: true,
        secProbMin: 0.2, secProbLikely: 0.45, secProbMax: 0.75,
        secMagMin: 100000, secMagLikely: 600000, secMagMax: 3000000,
        corrBiIr: 0.45, corrRlRc: 0.30
      }
    }
  },
  {
    id: 'bec-financial',
    label: 'Business Email Compromise (BEC)',
    icon: 'BEC',
    description: 'Executive impersonation or mailbox takeover leading to fraudulent payment approval, supplier fraud, or urgent finance disruption.',
    tags: ['BEC', 'Financial Loss', 'High Frequency'],
    suggestedBUTypes: ['bu-enterprise-it', 'bu-fintech'],
    draft: {
      scenarioTitle: 'Business Email Compromise — Fraudulent Wire Transfer',
      narrative: 'An attacker compromises or impersonates a senior executive email account and initiates urgent payment requests to finance personnel. The attacker uses social engineering and spoofed domains to bypass verification steps. Fraudulent transfers are authorised before the deception is detected. In some variants, the attacker first compromises the email account of a supplier, inserting themselves into existing payment threads (vendor email compromise).',
      structuredScenario: {
        assetService: 'Corporate email, finance systems, payment authorisation workflows',
        primaryDriver: 'BEC specialist threat actors (often West African or Eastern European organised groups)',
        eventPath: 'Email account takeover or domain spoofing → social engineering of finance staff → fraudulent payment authorisation',
        effect: 'Direct financial loss via fraudulent wire transfer; reputational damage; regulatory scrutiny'
      },
      fairParams: {
        distType: 'lognormal',
        iterations: 10000,
        tefMin: 2, tefLikely: 8, tefMax: 30,
        threatCapMin: 0.40, threatCapLikely: 0.58, threatCapMax: 0.78,
        controlStrMin: 0.42, controlStrLikely: 0.60, controlStrMax: 0.80,
        irMin: 20000, irLikely: 80000, irMax: 300000,
        biMin: 1000, biLikely: 50000, biMax: 400000,
        dbMin: 1000, dbLikely: 20000, dbMax: 150000,
        rlMin: 1000, rlLikely: 40000, rlMax: 500000,
        tpMin: 1000, tpLikely: 5000, tpMax: 100000,
        rcMin: 50000, rcLikely: 300000, rcMax: 2000000,
        secondaryEnabled: true,
        secProbMin: 0.3, secProbLikely: 0.55, secProbMax: 0.80,
        secMagMin: 200000, secMagLikely: 1500000, secMagMax: 8000000,
        corrBiIr: 0.10, corrRlRc: 0.40
      }
    }
  },
  {
    id: 'supply-chain-compromise',
    label: 'Supply Chain / Third-Party Compromise',
    icon: '3P',
    description: 'A trusted vendor, software supplier, or MSP is compromised, creating an inherited pathway into critical services. Strong choice for resilience and concentration-risk discussions.',
    tags: ['Supply Chain', 'Third Party', 'Stealthy'],
    suggestedBUTypes: ['bu-cloud', 'bu-enterprise-it', 'bu-cyber'],
    draft: {
      scenarioTitle: 'Supply Chain Compromise via Trusted Vendor',
      narrative: 'A critical technology vendor or managed service provider used by the organisation is compromised by a sophisticated threat actor. The attacker uses the vendor\'s trusted access or a trojanised software update to establish a persistent foothold within our environment. Because the access appears legitimate, detection is significantly delayed. The attacker conducts quiet reconnaissance for weeks before moving laterally to high-value targets including source code repositories, customer data, or financial systems.',
      structuredScenario: {
        assetService: 'Internal systems accessible via vendor/MSP trusted access; high-value data stores',
        primaryDriver: 'Nation-state or sophisticated organised criminal groups with supply chain targeting capability',
        eventPath: 'Vendor compromise → trusted access abuse → lateral movement → data access or persistent implant',
        effect: 'Long dwell time; broad access to sensitive systems; potential data theft or sabotage capability'
      },
      fairParams: {
        distType: 'lognormal',
        iterations: 10000,
        tefMin: 0.1, tefLikely: 0.5, tefMax: 2,
        threatCapMin: 0.65, threatCapLikely: 0.80, threatCapMax: 0.95,
        controlStrMin: 0.35, controlStrLikely: 0.52, controlStrMax: 0.72,
        irMin: 200000, irLikely: 600000, irMax: 2500000,
        biMin: 100000, biLikely: 500000, biMax: 3000000,
        dbMin: 150000, dbLikely: 800000, dbMax: 5000000,
        rlMin: 100000, rlLikely: 600000, rlMax: 4000000,
        tpMin: 50000, tpLikely: 400000, tpMax: 3000000,
        rcMin: 200000, rcLikely: 1000000, rcMax: 6000000,
        secondaryEnabled: true,
        secProbMin: 0.15, secProbLikely: 0.35, secProbMax: 0.65,
        secMagMin: 500000, secMagLikely: 2000000, secMagMax: 10000000,
        corrBiIr: 0.40, corrRlRc: 0.45
      }
    }
  },
  {
    id: 'cloud-misconfiguration',
    label: 'Cloud Misconfiguration / Data Exposure',
    icon: 'CLD',
    description: 'Misconfigured cloud storage, API, or access controls expose sensitive data or critical services. Useful for privacy, legal, and customer-trust scenarios.',
    tags: ['Cloud', 'Data Exposure', 'High Frequency'],
    suggestedBUTypes: ['bu-cloud', 'bu-ai', 'bu-enterprise-it'],
    draft: {
      scenarioTitle: 'Cloud Misconfiguration Leading to Sensitive Data Exposure',
      narrative: 'A cloud storage bucket, database, or API endpoint is inadvertently exposed due to a misconfiguration during deployment or a change in cloud provider defaults. Sensitive data including customer records, internal documents, or credentials is accessible without authentication. The exposure is discovered by an external researcher, a threat actor, or during an internal security audit. Depending on the data involved, regulatory notification obligations are triggered.',
      structuredScenario: {
        assetService: 'Cloud-hosted data stores (blob storage, S3-equivalent, managed databases, APIs)',
        primaryDriver: 'Opportunistic attackers using automated cloud scanning tools; security researchers',
        eventPath: 'Misconfiguration → public or unauthorised access → automated discovery → data access/exfiltration',
        effect: 'Unauthorised data access; potential exfiltration; regulatory notification obligation; reputational impact'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 1, tefLikely: 4, tefMax: 18,
        threatCapMin: 0.30, threatCapLikely: 0.48, threatCapMax: 0.70,
        controlStrMin: 0.40, controlStrLikely: 0.58, controlStrMax: 0.78,
        irMin: 30000, irLikely: 120000, irMax: 500000,
        biMin: 20000, biLikely: 100000, biMax: 600000,
        dbMin: 80000, dbLikely: 400000, dbMax: 2000000,
        rlMin: 50000, rlLikely: 300000, rlMax: 2500000,
        tpMin: 0, tpLikely: 50000, tpMax: 400000,
        rcMin: 80000, rcLikely: 400000, rcMax: 2500000,
        secondaryEnabled: false,
        corrBiIr: 0.20, corrRlRc: 0.50
      }
    }
  },
  {
    id: 'insider-data-theft',
    label: 'Insider Threat — Data Theft',
    icon: 'INS',
    description: 'A current or departing employee, contractor, or privileged user deliberately exfiltrates sensitive data or IP. Useful for human-risk and offboarding-control cases.',
    tags: ['Insider', 'Data Theft', 'Hard to Detect'],
    suggestedBUTypes: ['bu-ai', 'bu-cyber', 'bu-health', 'bu-fintech'],
    draft: {
      scenarioTitle: 'Insider Data Theft — Privileged User Exfiltration',
      narrative: 'A privileged employee — or a departing staff member in their notice period — deliberately exfiltrates sensitive intellectual property, customer data, or trade secrets. The exfiltration occurs gradually over time using authorised access channels (email, cloud sync, USB), making it difficult to distinguish from normal activity until DLP tools or behavioural analytics flag anomalies. In contractor scenarios, access may persist beyond contract end due to incomplete offboarding.',
      structuredScenario: {
        assetService: 'Sensitive data repositories: IP, customer records, financial data, research assets',
        primaryDriver: 'Malicious insider — employee, contractor, or recently departed staff with residual access',
        eventPath: 'Authorised access abuse → gradual or bulk data exfiltration via email/USB/cloud → delayed detection',
        effect: 'Loss of confidential IP or regulated data; regulatory notification; legal action; reputational harm'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.5, tefLikely: 2, tefMax: 8,
        threatCapMin: 0.45, threatCapLikely: 0.65, threatCapMax: 0.85,
        controlStrMin: 0.38, controlStrLikely: 0.55, controlStrMax: 0.74,
        irMin: 60000, irLikely: 200000, irMax: 800000,
        biMin: 30000, biLikely: 150000, biMax: 800000,
        dbMin: 100000, dbLikely: 500000, dbMax: 3000000,
        rlMin: 80000, rlLikely: 400000, rlMax: 3000000,
        tpMin: 0, tpLikely: 100000, tpMax: 1000000,
        rcMin: 150000, rcLikely: 700000, rcMax: 4000000,
        secondaryEnabled: true,
        secProbMin: 0.15, secProbLikely: 0.35, secProbMax: 0.65,
        secMagMin: 200000, secMagLikely: 1000000, secMagMax: 5000000,
        corrBiIr: 0.25, corrRlRc: 0.55
      }
    }
  },
  {
    id: 'identity-shared-services',
    label: 'Privileged Identity Takeover',
    icon: 'IAM',
    description: 'A privileged identity is compromised and used across shared platforms, creating security, fraud, and service-disruption consequences. Strong for identity and executive-action discussions.',
    tags: ['Identity', 'Privileged Access', 'Cross-Platform'],
    suggestedBUTypes: ['bu-enterprise-it', 'bu-cloud', 'bu-cyber'],
    draft: {
      scenarioTitle: 'Privileged Identity Takeover Across Shared Platforms',
      narrative: 'A privileged administrator account is compromised through phishing-resistant MFA bypass, token theft, or a poorly governed support path. The attacker uses that identity to access shared cloud consoles, productivity tooling, and administrative workflows. Containment requires emergency account lockdown, forced session reset, and urgent review of high-privilege changes. The direct security impact is serious, but the wider business issue is that multiple shared services may be disrupted while the identity tier is stabilised.',
      structuredScenario: {
        assetService: 'Privileged identity tier, shared cloud administration, and business-critical collaboration services',
        primaryDriver: 'Identity-focused criminal actors or sophisticated adversaries targeting privileged access',
        eventPath: 'Credential theft or token abuse → privileged access misuse → emergency containment across shared platforms',
        effect: 'Administrative misuse, urgent containment, service disruption, and possible fraud or data access'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.6, tefLikely: 2.2, tefMax: 8,
        threatCapMin: 0.52, threatCapLikely: 0.70, threatCapMax: 0.88,
        controlStrMin: 0.42, controlStrLikely: 0.58, controlStrMax: 0.78,
        irMin: 90000, irLikely: 260000, irMax: 900000,
        biMin: 80000, biLikely: 350000, biMax: 1800000,
        dbMin: 20000, dbLikely: 140000, dbMax: 900000,
        rlMin: 20000, rlLikely: 120000, rlMax: 850000,
        tpMin: 0, tpLikely: 60000, tpMax: 400000,
        rcMin: 50000, rcLikely: 220000, rcMax: 1500000,
        secondaryEnabled: true,
        secProbMin: 0.10, secProbLikely: 0.25, secProbMax: 0.45,
        secMagMin: 50000, secMagLikely: 240000, secMagMax: 1200000,
        corrBiIr: 0.30, corrRlRc: 0.35
      }
    }
  },
  {
    id: 'service-recovery-shortfall',
    label: 'Critical Service Recovery Shortfall',
    icon: 'RES',
    description: 'A major outage exposes weak recovery readiness, forcing prolonged service disruption and management action. Strong for resilience and continuity treatment planning.',
    tags: ['Resilience', 'Continuity', 'Recovery'],
    suggestedBUTypes: ['bu-cloud', 'bu-enterprise-it', 'bu-health', 'bu-fintech'],
    draft: {
      scenarioTitle: 'Critical Service Recovery Shortfall During Major Outage',
      narrative: 'A major technology outage affects a critical customer-facing service, but recovery takes materially longer than the organisation planned for because dependencies, failover steps, and recovery decision rights are not as mature as assumed. The technical trigger could be cyber, infrastructure, or supplier related; the main risk being assessed is the resilience shortfall itself. Customer commitments are missed, backlogs build, and leadership must decide how to trade recovery speed, cost, and interim service levels.',
      structuredScenario: {
        assetService: 'Critical digital service, recovery runbooks, and supporting infrastructure dependencies',
        primaryDriver: 'Any severe disruption source that forces a real recovery event',
        eventPath: 'Material outage → weak recovery execution → extended disruption and backlog growth',
        effect: 'Extended service outage, customer impact, contract pressure, and executive escalation'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.4, tefLikely: 1.4, tefMax: 4.5,
        threatCapMin: 0.35, threatCapLikely: 0.50, threatCapMax: 0.72,
        controlStrMin: 0.38, controlStrLikely: 0.54, controlStrMax: 0.74,
        irMin: 70000, irLikely: 240000, irMax: 900000,
        biMin: 250000, biLikely: 1100000, biMax: 5500000,
        dbMin: 0, dbLikely: 30000, dbMax: 200000,
        rlMin: 20000, rlLikely: 120000, rlMax: 900000,
        tpMin: 50000, tpLikely: 250000, tpMax: 1500000,
        rcMin: 100000, rcLikely: 500000, rcMax: 2800000,
        secondaryEnabled: true,
        secProbMin: 0.10, secProbLikely: 0.22, secProbMax: 0.40,
        secMagMin: 120000, secMagLikely: 600000, secMagMax: 3000000,
        corrBiIr: 0.42, corrRlRc: 0.26
      }
    }
  },
  {
    id: 'procurement-single-source-shortfall',
    label: 'Procurement Single-Source Shortfall',
    icon: 'SRC',
    description: 'A critical spend category depends on one supplier and cover is weaker than management assumed. Useful for procurement, resilience, and concentration-risk decisions.',
    tags: ['Procurement', 'Supply Chain', 'Concentration'],
    suggestedBUTypes: ['bu-enterprise-it', 'bu-fintech', 'bu-health', 'bu-iot'],
    draft: {
      scenarioTitle: 'Single-Source Supplier Shortfall on a Critical Spend Category',
      narrative: 'A critical supplier for a high-value spend category can no longer meet demand at the expected volume or timing, and the organisation discovers that second-source cover, stock buffers, and contract escalation paths are materially weaker than management assumed. Procurement must decide how to stabilise continuity, manage cost pressure, and address governance questions around supplier concentration and sourcing resilience.',
      structuredScenario: {
        assetService: 'Critical supplier relationship, sourcing decisions, contract cover, and dependent operations',
        primaryDriver: 'Supplier concentration, weak fallback sourcing, and delayed escalation of sourcing risk',
        eventPath: 'Single-source dependency pressure → supply shortfall → expedited sourcing and continuity response',
        effect: 'Operational disruption, commercial pressure, contract strain, and management escalation'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.3, tefLikely: 1.1, tefMax: 4.5,
        threatCapMin: 0.28, threatCapLikely: 0.44, threatCapMax: 0.66,
        controlStrMin: 0.34, controlStrLikely: 0.50, controlStrMax: 0.72,
        irMin: 30000, irLikely: 110000, irMax: 360000,
        biMin: 140000, biLikely: 520000, biMax: 2400000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 20000, rlLikely: 90000, rlMax: 480000,
        tpMin: 40000, tpLikely: 160000, tpMax: 720000,
        rcMin: 140000, rcLikely: 560000, rcMax: 2800000,
        secondaryEnabled: true,
        secProbMin: 0.12, secProbLikely: 0.28, secProbMax: 0.48,
        secMagMin: 120000, secMagLikely: 620000, secMagMax: 3200000,
        corrBiIr: 0.34, corrRlRc: 0.24
      }
    }
  },
  {
    id: 'compliance-obligation-breakdown',
    label: 'Regulatory Monitoring Breakdown',
    icon: 'REG',
    description: 'A live obligation is missed because compliance monitoring, ownership, or evidence discipline is weaker than believed. Useful for compliance, privacy, and governance reviews.',
    tags: ['Compliance', 'Regulatory', 'Governance'],
    suggestedBUTypes: ['bu-health', 'bu-fintech', 'bu-enterprise-it'],
    draft: {
      scenarioTitle: 'Regulatory Monitoring Breakdown on a Live Obligation',
      narrative: 'A business unit misses a live regulatory or policy obligation because the control owner, evidence trail, and escalation path are not operating as management expected. The immediate issue is not a cyber event but a governance and assurance gap that could trigger scrutiny, rework, and enforcement pressure once the lapse is discovered.',
      structuredScenario: {
        assetService: 'Compliance monitoring routines, obligation mapping, and evidence-control workflow',
        primaryDriver: 'Weak monitoring discipline, fragmented ownership, and incomplete escalation of compliance drift',
        eventPath: 'Control monitoring weakness → missed obligation or delayed response → regulatory scrutiny and remediation',
        effect: 'Regulatory pressure, rework, executive escalation, and confidence loss in the control environment'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.5, tefLikely: 2, tefMax: 7,
        threatCapMin: 0.24, threatCapLikely: 0.40, threatCapMax: 0.62,
        controlStrMin: 0.32, controlStrLikely: 0.50, controlStrMax: 0.74,
        irMin: 25000, irLikely: 90000, irMax: 320000,
        biMin: 60000, biLikely: 220000, biMax: 960000,
        dbMin: 0, dbLikely: 0, dbMax: 20000,
        rlMin: 60000, rlLikely: 240000, rlMax: 1400000,
        tpMin: 0, tpLikely: 40000, tpMax: 220000,
        rcMin: 90000, rcLikely: 320000, rcMax: 1800000,
        secondaryEnabled: true,
        secProbMin: 0.15, secProbLikely: 0.34, secProbMax: 0.58,
        secMagMin: 80000, secMagLikely: 380000, secMagMax: 1900000,
        corrBiIr: 0.18, corrRlRc: 0.42
      }
    }
  },
  {
    id: 'ai-model-governance-failure',
    label: 'AI Model Governance Failure',
    icon: 'AI',
    description: 'An AI-enabled process produces an unreliable or non-compliant outcome because model governance, testing, or human review is weaker than assumed.',
    tags: ['AI', 'Model Risk', 'Governance'],
    suggestedBUTypes: ['bu-ai', 'bu-enterprise-it', 'bu-fintech', 'bu-health'],
    draft: {
      scenarioTitle: 'AI Model Governance Failure in a Live Decision Process',
      narrative: 'An AI-enabled workflow begins producing unreliable, biased, or weakly explainable outputs, but management discovers that model testing, challenge, and human review are not operating as assumed. The immediate issue is the governance failure around the model, not just the bad output itself. Leadership must decide whether to contain, pause, remediate, or continue under tighter controls.',
      structuredScenario: {
        assetService: 'AI-enabled decision workflow, model governance controls, and human-review checkpoints',
        primaryDriver: 'Weak model governance, incomplete validation, and inadequate monitoring of live model behaviour',
        eventPath: 'Model governance weakness → unreliable or non-compliant output → urgent containment and review',
        effect: 'Decision-quality degradation, compliance pressure, operational rework, and executive scrutiny'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.4, tefLikely: 1.6, tefMax: 5.5,
        threatCapMin: 0.26, threatCapLikely: 0.42, threatCapMax: 0.64,
        controlStrMin: 0.34, controlStrLikely: 0.52, controlStrMax: 0.76,
        irMin: 40000, irLikely: 130000, irMax: 420000,
        biMin: 100000, biLikely: 340000, biMax: 1500000,
        dbMin: 15000, dbLikely: 70000, dbMax: 360000,
        rlMin: 50000, rlLikely: 200000, rlMax: 1100000,
        tpMin: 0, tpLikely: 50000, tpMax: 260000,
        rcMin: 120000, rcLikely: 420000, rcMax: 2000000,
        secondaryEnabled: true,
        secProbMin: 0.14, secProbLikely: 0.30, secProbMax: 0.52,
        secMagMin: 100000, secMagLikely: 460000, secMagMax: 2200000,
        corrBiIr: 0.24, corrRlRc: 0.34
      }
    }
  },
  {
    id: 'transformation-delivery-slip',
    label: 'Transformation Delivery Slip',
    icon: 'XFM',
    description: 'A major transformation slips after weak dependency control and unclear ownership. Useful for strategic execution and programme-governance discussions.',
    tags: ['Strategic', 'Transformation', 'Programme'],
    suggestedBUTypes: ['bu-enterprise-it', 'bu-fintech', 'bu-health', 'bu-ai'],
    draft: {
      scenarioTitle: 'Transformation Delivery Slip After Weak Dependency Control',
      narrative: 'A major transformation programme slips after weak dependency control, delayed decisions, and unclear ownership across workstreams. The business risk is not a technical fault alone but the erosion of delivery confidence, rising cost, and delayed strategic value once the programme starts to drift materially off plan.',
      structuredScenario: {
        assetService: 'Transformation roadmap, milestone controls, and dependent operating changes',
        primaryDriver: 'Weak programme governance, late escalation of dependency drift, and unclear decision rights',
        eventPath: 'Dependency slippage → missed milestones and rework → delayed benefits and management reset',
        effect: 'Programme delay, cost growth, operating strain, and weaker strategic outcomes'
      },
      fairParams: {
        distType: 'triangular',
        iterations: 10000,
        tefMin: 0.25, tefLikely: 0.9, tefMax: 4,
        threatCapMin: 0.24, threatCapLikely: 0.40, threatCapMax: 0.62,
        controlStrMin: 0.32, controlStrLikely: 0.50, controlStrMax: 0.72,
        irMin: 30000, irLikely: 100000, irMax: 340000,
        biMin: 120000, biLikely: 420000, biMax: 1800000,
        dbMin: 0, dbLikely: 0, dbMax: 15000,
        rlMin: 15000, rlLikely: 70000, rlMax: 300000,
        tpMin: 0, tpLikely: 30000, tpMax: 180000,
        rcMin: 160000, rcLikely: 620000, rcMax: 2600000,
        secondaryEnabled: true,
        secProbMin: 0.12, secProbLikely: 0.28, secProbMax: 0.46,
        secMagMin: 120000, secMagLikely: 540000, secMagMax: 2400000,
        corrBiIr: 0.26, corrRlRc: 0.22
      }
    }
  }
];

const ScenarioTemplateRecommendations = Object.freeze({
  general: ['procurement-single-source-shortfall', 'compliance-obligation-breakdown', 'ai-model-governance-failure', 'transformation-delivery-slip'],
  finance: ['bec-financial', 'compliance-obligation-breakdown'],
  procurement: ['procurement-single-source-shortfall', 'supply-chain-compromise'],
  compliance: ['compliance-obligation-breakdown', 'cloud-misconfiguration'],
  operations: ['service-recovery-shortfall', 'procurement-single-source-shortfall'],
  technology: ['identity-shared-services', 'ai-model-governance-failure', 'cloud-misconfiguration'],
  strategic: ['transformation-delivery-slip', 'procurement-single-source-shortfall'],
  hse: ['service-recovery-shortfall', 'procurement-single-source-shortfall']
});

function pickScenarioTemplateForContext(options = {}) {
  const functionKey = String(options.functionKey || 'general').trim().toLowerCase() || 'general';
  const preferredIds = Array.isArray(ScenarioTemplateRecommendations[functionKey]) && ScenarioTemplateRecommendations[functionKey].length
    ? ScenarioTemplateRecommendations[functionKey]
    : ScenarioTemplateRecommendations.general;
  return preferredIds
    .map(id => ScenarioTemplates.find(template => template.id === id))
    .find(Boolean)
    || ScenarioTemplates[0]
    || null;
}

window.pickScenarioTemplateForContext = pickScenarioTemplateForContext;
