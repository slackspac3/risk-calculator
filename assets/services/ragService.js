/**
 * ragService.js — Retrieval-Augmented Generation service
 *
 * Local-file based hybrid retrieval with concept expansion, phrase
 * matching, and TF-IDF-style semantic weighting rather than literal
 * keyword hits alone.
 *
 * This browser retriever is assistive only. Server-owned assessment workflows
 * decide authoritative learning influence separately, so browser-local feedback
 * weights must stay neutralized here.
 *
 * Production can still replace this with native vector retrieval,
 * but the current scorer already behaves as a local hybrid retriever.
 * [RAG-INTEGRATION] marks integration points.
 */

const RAGService = (() => {
  function _escapeRegExp(value = '') {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  let _docs = [];
  let _buData = [];
  let _indexedDocs = [];
  let _docFrequency = new Map();
  let _inverseDocFrequency = new Map();
  let _docCount = 0;

  const LENS_TAGS = [
    'strategic',
    'operational',
    'cyber',
    'ai-model-risk',
    'data-governance',
    'third-party',
    'regulatory',
    'financial',
    'fraud-integrity',
    'esg',
    'compliance',
    'legal-contract',
    'geopolitical',
    'supply-chain',
    'procurement',
    'business-continuity',
    'physical-security',
    'ot-resilience',
    'people-workforce',
    'investment-jv',
    'transformation-delivery',
    'hse'
  ];

  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
    'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their',
    'them', 'there', 'this', 'to', 'with', 'within', 'would', 'could', 'should',
    'after', 'before', 'under', 'over', 'than', 'then', 'when', 'while', 'your'
  ]);

  const CONCEPT_RULES = [
    {
      key: 'procurement-governance',
      patterns: ['procurement', 'sourcing', 'tender', 'bid', 'bid rigging', 'contract award', 'supplier selection', 'purchasing', 'purchase order', 'maverick spend', 'off-contract', 'enterprise agreement', 'duplicate licenses', 'pricing leakage', 'rfp scoring', 'scoring template', 'whole-life cost', 'whole life cost', 'technical weighting', 'lotting strategy', 'competition design', 'single aggregator', 'specialist suppliers', 'distributor terms', 'deposit request', 'origin declaration', 'substitution rights', 'bundled scope', 'price validity', 'award strategy', 'direct negotiation', 'incumbent consortium', 'should-cost', 'service baselines'],
      docTags: ['procurement', 'sourcing', 'governance', 'compliance', 'tender-design', 'commercial-governance'],
      docIds: ['doc-iso20400-29', 'doc-uncitral-proc-46', 'doc-worldbank-proc-47', 'doc-iso37001-57', 'doc-proc-software-framework-148', 'doc-proc-tender-wholelife-149', 'doc-proc-lotting-150', 'doc-proc-constrained-contracting-151', 'doc-proc-bundled-award-152', 'doc-proc-direct-negotiation-153']
    },
    {
      key: 'supply-chain-dependency',
      patterns: ['supply chain', 'sub-tier', 'sub tier', 'upstream', 'logistics', 'inventory', 'shipment', 'single source', 'single approved supplier', 'single approved source', 'sole source', 'concentration risk', 'production line shift', 'inventory buffer', 'safety stock', 'rack enclosures', 'quality hold', 'component shortage', 'shipment windows', 'material flow', 'port congestion', 'customs inspection', 'installation sequence', 'allocation priority', 'allocation rights', 'oem', 'fragmented forecast', 'buffer hub', 'deployable inventory', 'service spares', 'repair lead time'],
      docTags: ['supply-chain', 'third-party', 'procurement', 'business-continuity'],
      docIds: ['doc-3p-08', 'doc-iso28000-23', 'doc-nist-800161-53', 'doc-supply-single-source-143', 'doc-supply-subtier-144', 'doc-supply-logistics-145', 'doc-supply-allocation-146', 'doc-supply-spares-147']
    },
    {
      key: 'human-rights-diligence',
      patterns: ['human rights', 'modern slavery', 'forced labour', 'forced labor', 'exploitative labour', 'exploitative labor', 'child labour', 'child labor', 'labour practices', 'labor practices', 'worker welfare', 'recruitment fees', 'passport retention', 'withheld passports', 'labour broker', 'labor broker', 'remediation', 'worker grievance'],
      docTags: ['human-rights', 'procurement', 'supply-chain', 'esg', 'compliance', 'people-workforce'],
      docIds: ['doc-oecd-rbc-48', 'doc-ungp-49', 'doc-iso20400-29', 'doc-ilo-osh-54', 'doc-sa8000-61', 'doc-internal-esg-humanrights-83']
    },
    {
      key: 'anti-bribery-integrity',
      patterns: ['bribery', 'corruption', 'kickback', 'kick back', 'collusion', 'conflict of interest', 'facilitation payment', 'gifts and entertainment', 'gift and entertainment', 'hospitality', 'sponsored travel', 'public official', 'intermediary onboarding', 'intermediary', 'success fee', 'opaque introductions', 'books and records', 'change-order steering', 'approval thresholds', 'urgency narrative'],
      docTags: ['compliance', 'procurement', 'anti-bribery', 'governance'],
      docIds: ['doc-iso37001-57', 'doc-worldbank-proc-47', 'doc-uncitral-proc-46', 'doc-internal-compliance-abc-85', 'doc-internal-compliance-thirdparty-87', 'doc-fraud-threshold-130']
    },
    {
      key: 'speak-up-investigation',
      patterns: ['whistleblowing', 'whistleblower', 'speak up', 'speak-up', 'non-retaliation', 'retaliation', 'report concern', 'reporting concern', 'ethics concern', 'compliance investigation', 'witness interview', 'investigation protocol', 'code of conduct'],
      docTags: ['compliance', 'ethics', 'investigation', 'governance'],
      docIds: ['doc-iso37301-26', 'doc-internal-compliance-speakup-84']
    },
    {
      key: 'business-continuity-crisis',
      patterns: ['business continuity', 'continuity', 'crisis management', 'recovery', 'downtime', 'outage', 'incident communications', 'emergency response', 'business impact analysis', 'bia', 'rto', 'rpo', 'incident management', 'service restoration', 'service resumption', 'tabletop exercise', 'alternate workspace', 'alternate site', 'manual fallback', 'relocation decision', 'alternate processing', 'call tree', 'incident escalation matrix', 'crisis communication plan', 'recovery plan', 'continuity exercise'],
      docTags: ['business-continuity', 'resilience', 'crisis-management', 'operational'],
      docIds: ['doc-bcp-10', 'doc-iso22301-20', 'doc-iso22313-21', 'doc-nfpa1600-32', 'doc-iso22361-51', 'doc-nist-80034-75', 'doc-iso22317-76', 'doc-iso22320-77', 'doc-internal-bcm-93']
    },
    {
      key: 'vendor-access-governance',
      patterns: ['standing privileged access', 'shared support account', 'subcontractor access', 'vendor account spans critical systems', 'broad access across critical systems', 'remote access path', 'no documented business need'],
      docTags: ['third-party', 'vendor-access', 'remote-access', 'subcontractor', 'compliance'],
      docIds: ['doc-3p-08', 'doc-iso27036-22', 'doc-nist-800161-53']
    },
    {
      key: 'trade-controls-compliance',
      patterns: ['sanctions screening', 'restricted party', 'denied party', 'entity list', 'export control', 'export-controlled', 're-export', 'restricted jurisdiction', 'remote technical environment', 'work from home in a restricted jurisdiction', 'shipment security', 'high-risk location'],
      docTags: ['regulatory', 'compliance', 'trade-controls', 'screening'],
      docIds: ['doc-bis-export-09', 'doc-ofac-11', 'doc-internal-compliance-tradecontrols-86', 'doc-internal-compliance-travel-security-89']
    },
    {
      key: 'business-partner-integrity',
      patterns: ['business partner due diligence', 'business partner code of conduct', 'beneficial ownership', 'beneficial owner', 'red flags', 'approved through escalation', 'ongoing monitoring', 'partner onboarding shortcut', 'third-party screening', 'side letter', 'return rights', 'rebate support'],
      docTags: ['third-party', 'compliance', 'due-diligence', 'governance'],
      docIds: ['doc-iso37301-26', 'doc-iso37001-57', 'doc-internal-compliance-thirdparty-87', 'doc-fraud-channel-128']
    },
    {
      key: 'insider-information-governance',
      patterns: ['insider information', 'inside information', 'material non-public', 'material non public', 'blackout period', 'trading window', 'disclosure controls', 'inside information list'],
      docTags: ['compliance', 'governance', 'market-conduct', 'disclosure'],
      docIds: ['doc-iso37301-26', 'doc-internal-compliance-insider-88']
    },
    {
      key: 'hse-incident',
      patterns: ['health and safety', 'worker safety', 'contractor safety', 'injury', 'fatality', 'near miss', 'spill', 'environmental release', 'hazard', 'site shutdown', 'process safety', 'loss of containment', 'permit to work', 'management of change', 'psychological safety', 'fatigue', 'contractor management', 'corrective action', 'hazard identification', 'machine guard', 'interlock', 'emergency stop', 'emergency drill', 'emergency response plan', 'worker accommodation', 'dormitory safety'],
      docTags: ['hse', 'environment', 'health-safety', 'operations', 'business-continuity'],
      docIds: ['doc-iso45001-30', 'doc-iso14001-31', 'doc-abu-dhabi-ehsms-44', 'doc-uae-fire-life-45', 'doc-ilo-osh-54', 'doc-iso45003-78', 'doc-api-rp754-79', 'doc-ccps-rbps-80', 'doc-internal-hse-94', 'doc-internal-qhse-95']
    },
    {
      key: 'sustainability-disclosure',
      patterns: ['esg', 'sustainability', 'climate', 'emissions', 'scope 1', 'scope 2', 'scope 3', 'greenwashing', 'transition plan', 'nature-related', 'tcfd', 'ghg protocol', 'cdp', 'double materiality', 'sustainability claim', 'water disclosure'],
      docTags: ['esg', 'sustainability', 'reporting', 'environment', 'strategic'],
      docIds: ['doc-ifrs-s1s2-27', 'doc-gri-28', 'doc-csrd-esrs-36', 'doc-sasb-55', 'doc-tnfd-56', 'doc-tcfd-72', 'doc-ghg-protocol-73', 'doc-cdp-74', 'doc-iso14064-59', 'doc-uae-sf-42', 'doc-adx-esg-43', 'doc-csddd-58']
    },
    {
      key: 'financial-control',
      patterns: ['invoice fraud', 'payment fraud', 'treasury', 'liquidity', 'financial control', 'financial reporting', 'misstatement', 'journal entry', 'revenue recognition', 'duplicate payment', 'payment approval', 'segregation of duties', 'receivable', 'counterparty default', 'customer insolvency', 'write off', 'write-off'],
      docTags: ['financial', 'compliance', 'controls', 'governance', 'data'],
      docIds: ['doc-coso-ic-33', 'doc-bcbs239-41']
    },
    {
      key: 'ai-governance',
      patterns: ['responsible ai', 'model risk', 'ai governance', 'model drift', 'hallucination', 'algorithmic bias', 'ai act', 'training data', 'large language model', 'llm assistant', 'ai assistant', 'policy copilot', 'agentic orchestration', 'unsafe tool chaining', 'authority overreach', 'multilingual validation', 'translation bias', 'abstention', 'calibration', 'benchmark contamination', 'release gating', 'generalization', 'generalisation', 'retraining', 'human in the loop', 'forecasting model', 'capacity planning model', 'recalibration', 'pilot validation', 'deployment readiness', 'machine-translated'],
      docTags: ['ai-model-risk', 'governance', 'compliance', 'data-governance'],
      docIds: ['doc-iso42001-62', 'doc-iso23894-63', 'doc-nist-airmf-64', 'doc-eu-ai-act-65', 'doc-sr11-7-66', 'doc-ai-multilingual-validation-120', 'doc-model-monitoring-drift-121', 'doc-agentic-ai-control-122', 'doc-ai-calibration-abstention-123', 'doc-ai-benchmark-release-124']
    },
    {
      key: 'data-governance',
      patterns: ['data governance', 'data lineage', 'data quality', 'data retention', 'retention schedule', 'purpose limitation', 'consent', 'data residency', 'master data', 'lawful basis', 'records retained too long', 'transfer safeguards', 'troubleshooting logs', 'overseas diagnostics', 'privacy by design', 'dpia', 'data protection impact assessment', 'privacy impact assessment', 'data subject rights', 'subject access request', 'right to erasure', 'rectification request', 'portability request', 'record of processing activities', 'ropa', 'data controller', 'data processor', 'controller-processor', 'data processing agreement', 'supervisory authority', 'breach notification', '72-hour notification', 'dpo', 'patient data', 'medical records', 'health data', 'special category data', 'biometric data', 'uae health data', 'adgm data protection', 'de-identification', 'deidentification', 'data minimization', 'data minimisation', 'secondary use', 'lineage metadata', 'free-text fields', 'live identifiers', 'passport details', 'medical appointment references', 'health references', 'identity graph', 'identity views', 'suppression flags', 'record resurrection', 'deletion propagation', 'derived datasets', 'offshore support queue', 'development environment', 'staging pipeline', 'data marketplace'],
      docTags: ['data-governance', 'privacy', 'compliance', 'controls'],
      docIds: ['doc-iso27701-19', 'doc-gdpr-06', 'doc-data-05', 'doc-cls-07', 'doc-hipaa-39', 'doc-internal-privacy-96', 'doc-internal-privacy-health-97', 'doc-adgm-dp-101', 'doc-data-minimization-125', 'doc-purpose-lineage-126', 'doc-deletion-suppression-127']
    },
    {
      key: 'fraud-integrity',
      patterns: ['financial crime', 'money laundering', 'kickback', 'bribery', 'corruption', 'integrity breakdown', 'embezzlement', 'invoice splitting', 'threshold avoidance', 'approval threshold', 'side letter', 'return rights', 'rebate support', 'quarter-end pressure', 'ghost workers', 'attendance logs', 'false certification', 'related party', 'intermediary', 'success fee', 'opaque introductions', 'books and records', 'urgency narrative', 'rebate claims', 'backdated certifications', 'duplicate proof', 'proof-of-performance', 'fabricated evidence'],
      docTags: ['fraud-integrity', 'financial', 'compliance', 'anti-bribery'],
      docIds: ['doc-iso37001-57', 'doc-uae-amlcft-12', 'doc-coso-ic-33', 'doc-fraud-channel-128', 'doc-fraud-labor-129', 'doc-fraud-threshold-130', 'doc-fraud-evidence-131']
    },
    {
      key: 'legal-contract',
      patterns: ['contract dispute', 'indemnity', 'licensing dispute', 'intellectual property', 'ip ownership', 'litigation', 'terms breach', 'rights and remedies', 'service credits', 'confidentiality clause', 'license scope', 'licence scope', 'affiliate-use rights', 'affiliate use rights', 'service data', 'derived insights', 'step-in rights', 'liability cap', 'liability caps', 'uncapped indemnity', 'technical equivalence', 'acceptance certificate', 'acceptance criteria', 'statement of work', 'schedule hierarchy', 'annex conflict', 'substitute performance', 'consortium agreement', 'flow-down terms', 'local-court exclusivity', 'termination rights'],
      docTags: ['legal-contract', 'contract-governance', 'licensing', 'acceptance', 'claims', 'data-rights', 'consortium'],
      docIds: ['doc-contract-governance-67', 'doc-contract-clauses-108', 'doc-licensing-rights-109', 'doc-data-rights-contract-110', 'doc-dispute-notice-111', 'doc-consortium-flowdown-112', 'doc-unidroit-contracts-113', 'doc-cisg-114', 'doc-wipo-ict-115']
    },
    {
      key: 'geopolitical-market-access',
      patterns: ['geopolitical', 'market access', 'entity list', 'export control', 'sovereign risk', 'cross-border restriction', 'tariff'],
      docTags: ['geopolitical', 'regulatory', 'strategic', 'supply-chain'],
      docIds: ['doc-bis-export-09', 'doc-ofac-11']
    },
    {
      key: 'ot-resilience',
      patterns: ['operational technology', 'industrial control', 'ics', 'scada', 'plant network', 'site systems', 'ot security', 'edge computing room', 'temperature alarms', 'power fluctuation', 'airflow settings', 'workload throttling', 'edge gateways', 'heatwave', 'power quality fluctuations', 'telemetry gaps', 'manual field verification', 'timing mismatch', 'edge controller', 'configuration baseline', 'older configuration baseline', 'false rejects', 'supervised mode', 'failover logic', 'backup power transfer', 'restart priorities', 'regional grid disturbance', 'gateway clocks', 'telemetry replay', 'control confirmations', 'connectivity loss', 'state reconstruction', 'edge inference', 'actuator timing', 'reject gate', 'restart instability'],
      docTags: ['ot-resilience', 'operational', 'facilities', 'engineering', 'critical-site', 'telemetry'],
      docIds: ['doc-iec62443-52', 'doc-ot-edge-environment-135', 'doc-ot-telemetry-recovery-136', 'doc-ot-failover-sequencing-137', 'doc-ot-vision-sync-138']
    },
    {
      key: 'physical-security',
      patterns: ['physical security', 'executive protection', 'badge control', 'visitor management', 'perimeter breach', 'facility intrusion', 'unbadged individual', 'restricted office area', 'door on bypass', 'visitor escort', 'temporary badge privileges', 'event footprint', 'legal war room', 'catering access windows', 'unauthorized movement', 'fence-line alarms', 'camera blind spots', 'temporary gate protocol', 'after-hours service access', 'prototype facility', 'restricted zones', 'executive movement', 'contractor badges', 'loading bay', 'secure cage', 'vehicle screening', 'unsupervised access', 'camera sight lines'],
      docTags: ['physical-security', 'facilities', 'executive-protection', 'restricted-site', 'visitor-management'],
      docIds: ['doc-physical-security-69', 'doc-physical-event-132', 'doc-physical-perimeter-133', 'doc-physical-staging-134', 'doc-uae-fire-life-45']
    },
    {
      key: 'people-workforce',
      patterns: ['workforce resilience', 'worker welfare', 'staffing pressure', 'labour rights', 'human rights', 'contractor welfare', 'fatigue', 'voluntary attrition', 'internal transfer requests', 'role progression', 'weak onboarding', 'limited coaching', 'weekend bid work', 'return-to-office', 'return to office', 'return-to-campus', 'return to campus', 'employee experience', 'compensation disparities', 'internal mobility', 'acceptance rates', 'contingent specialists', 'succession planning', 'learning access', 'promotion pathways', 'critical knowledge dependencies', 'mixed employment model'],
      docTags: ['people-workforce', 'human-rights', 'esg', 'hse', 'operational', 'employee-experience', 'talent-retention', 'succession-planning'],
      docIds: ['doc-ungp-49', 'doc-oecd-rbc-48', 'doc-ilo-osh-54', 'doc-sa8000-61', 'doc-workforce-retention-139', 'doc-workforce-policy-140', 'doc-workforce-equity-141', 'doc-workforce-architecture-142']
    },
    {
      key: 'investment-integration',
      patterns: ['m&a', 'merger integration', 'joint venture', 'deal thesis', 'synergy delivery', 'post-merger integration', 'minority investment', 'value-creation thesis', 'quality of earnings', 'controlling stake', 'reserved matters', 'capital calls', 'valuation reset'],
      docTags: ['investment-jv', 'deal-thesis', 'joint-venture', 'quality-of-earnings', 'governance'],
      docIds: ['doc-investment-jv-70', 'doc-minority-investment-116', 'doc-qoe-control-117', 'doc-jv-governance-118', 'doc-jv-restructuring-119', 'doc-coso-erm-25', 'doc-iso31000-24', 'doc-iso31010-50']
    },
    {
      key: 'transformation-delivery',
      patterns: ['transformation delivery', 'programme delivery', 'project delivery', 'go-live delay', 'milestone slippage', 'benefit realization', 'benefit realisation', 'target state', 'local exceptions', 'exception governance', 'site-access constraints', 'localisation constraints'],
      docTags: ['transformation-delivery', 'strategic', 'operational', 'governance'],
      docIds: ['doc-coso-erm-25', 'doc-iso31010-50', 'doc-transformation-delivery-71']
    },
    {
      key: 'enterprise-risk-governance',
      patterns: ['risk appetite', 'risk tolerance', 'outside tolerance', 'above tolerance', 'residual risk', 'inherent risk', 'risk owner', 'risk register', 'project risk register', 'risk treatment plan', 'risk treatment owner', 'key risk indicator', 'kri', 'emerging risk', 'risk committee', 'erm committee', 'risk reporting cadence', 'principal risk', 'three lines', 'three lines model'],
      docTags: ['risk-management', 'enterprise-risk', 'governance', 'risk-appetite', 'risk-register', 'kri'],
      docIds: ['doc-internal-erm-framework-90', 'doc-internal-erm-policy-91', 'doc-internal-erm-project-92', 'doc-iso31000-24', 'doc-coso-erm-25', 'doc-iso31010-50']
    },
    {
      key: 'risk-method',
      patterns: ['risk assessment', 'risk techniques', 'risk method', 'control baseline', 'enterprise risk', 'scenario analysis', 'risk appetite', 'risk tolerance', 'residual risk', 'key risk indicator', 'kri', 'risk register'],
      docTags: ['risk-management', 'enterprise-risk', 'governance', 'controls'],
      docIds: ['doc-iso31000-24', 'doc-coso-erm-25', 'doc-iso31010-50', 'doc-nist-rmf-14', 'doc-internal-erm-framework-90', 'doc-internal-erm-policy-91', 'doc-internal-erm-project-92']
    }
  ];

  const TOPIC_RULES = [
    {
      key: 'privacy',
      patterns: ['privacy', 'personal data', 'pii', 'phi', 'data protection', 'gdpr', 'pdpl', 'data subject', 'biometric', 'health data', 'patient data', 'medical records', 'privacy by design', 'dpia', 'data protection impact assessment', 'subject access request', 'record of processing activities', 'data controller', 'data processor', 'controller-processor', 'data processing agreement', 'breach notification', 'supervisory authority', 'adgm', 'uae health data'],
      docTags: ['privacy', 'data-protection', 'pims'],
      docIds: ['doc-iso27018-18', 'doc-iso27701-19', 'doc-data-05', 'doc-gdpr-06', 'doc-cls-07', 'doc-hipaa-39', 'doc-internal-privacy-96', 'doc-internal-privacy-health-97']
    },
    {
      key: 'ai-model-risk',
      patterns: ['responsible ai', 'model risk', 'ai governance', 'algorithmic bias', 'model drift', 'hallucination', 'training data', 'ai act', 'large language model', 'llm assistant', 'ai assistant', 'copilot', 'agentic', 'tool chaining', 'abstention', 'calibration', 'benchmark contamination', 'release gating', 'generalization', 'generalisation', 'retraining', 'human in the loop', 'multilingual validation', 'translation bias', 'unsafe output', 'forecasting model', 'capacity planning model', 'recalibration', 'pilot validation', 'deployment readiness', 'machine-translated', 'authority overreach', 'red-team'],
      docTags: ['ai-model-risk', 'governance', 'compliance', 'data-governance'],
      docIds: ['doc-iso42001-62', 'doc-iso23894-63', 'doc-nist-airmf-64', 'doc-eu-ai-act-65', 'doc-sr11-7-66', 'doc-ai-multilingual-validation-120', 'doc-model-monitoring-drift-121', 'doc-agentic-ai-control-122', 'doc-ai-calibration-abstention-123', 'doc-ai-benchmark-release-124']
    },
    {
      key: 'data-governance',
      patterns: ['data governance', 'data lineage', 'data quality', 'data retention', 'retention schedule', 'purpose limitation', 'consent', 'data residency', 'lawful basis', 'records retained too long', 'transfer safeguards', 'overseas diagnostics', 'privacy by design', 'dpia', 'data protection impact assessment', 'data subject rights', 'subject access request', 'record of processing activities', 'data controller', 'data processor', 'controller-processor', 'data processing agreement', 'breach notification', 'supervisory authority', 'patient data', 'medical records', 'health data', 'biometric data', 'de-identification', 'deidentification', 'data minimization', 'data minimisation', 'secondary use', 'lineage metadata', 'free-text fields', 'passport details', 'identity graph', 'identity views', 'suppression flags', 'record resurrection', 'deletion propagation', 'derived datasets', 'offshore support queue', 'development environment', 'staging pipeline', 'data marketplace'],
      docTags: ['data-governance', 'privacy', 'controls', 'compliance'],
      docIds: ['doc-iso27701-19', 'doc-gdpr-06', 'doc-data-05', 'doc-cls-07', 'doc-hipaa-39', 'doc-internal-privacy-96', 'doc-internal-privacy-health-97', 'doc-adgm-dp-101', 'doc-data-minimization-125', 'doc-purpose-lineage-126', 'doc-deletion-suppression-127']
    },
    {
      key: 'fraud-integrity',
      patterns: ['fraud', 'financial crime', 'kickback', 'bribery', 'corruption', 'embezzlement', 'money laundering', 'public official', 'hospitality', 'facilitation payment', 'invoice splitting', 'threshold avoidance', 'approval threshold', 'side letter', 'return rights', 'rebate support', 'quarter-end pressure', 'ghost workers', 'attendance logs', 'false certification', 'related party', 'intermediary', 'success fee', 'books and records', 'urgency narrative', 'rebate claims', 'backdated certifications', 'duplicate proof', 'fabricated evidence'],
      docTags: ['fraud-integrity', 'financial', 'anti-bribery', 'compliance'],
      docIds: ['doc-iso37001-57', 'doc-uae-amlcft-12', 'doc-coso-ic-33', 'doc-internal-compliance-abc-85', 'doc-fraud-channel-128', 'doc-fraud-labor-129', 'doc-fraud-threshold-130', 'doc-fraud-evidence-131']
    },
    {
      key: 'compliance',
      patterns: ['whistleblowing', 'non-retaliation', 'ethics and compliance', 'code of conduct', 'compliance investigation', 'gifts and entertainment', 'conflict of interest', 'business partner due diligence', 'sanctions screening', 'export control', 'insider information'],
      docTags: ['compliance', 'governance', 'controls', 'ethics'],
      docIds: ['doc-iso37301-26', 'doc-iso37001-57', 'doc-internal-compliance-speakup-84', 'doc-internal-compliance-abc-85', 'doc-internal-compliance-tradecontrols-86', 'doc-internal-compliance-thirdparty-87', 'doc-internal-compliance-insider-88']
    },
    {
      key: 'legal-contract',
      patterns: ['legal', 'contract', 'indemnity', 'licensing dispute', 'ip ownership', 'intellectual property', 'litigation', 'rights and remedies', 'service credits', 'confidentiality clause', 'license scope', 'licence scope', 'affiliate-use rights', 'affiliate use rights', 'service data', 'derived insights', 'step-in rights', 'liability cap', 'liability caps', 'technical equivalence', 'acceptance certificate', 'statement of work', 'schedule hierarchy', 'annex conflict', 'consortium agreement', 'flow-down terms', 'termination rights'],
      docTags: ['legal-contract', 'contract-governance', 'licensing', 'acceptance', 'claims', 'data-rights', 'consortium'],
      docIds: ['doc-contract-governance-67', 'doc-contract-clauses-108', 'doc-licensing-rights-109', 'doc-data-rights-contract-110', 'doc-dispute-notice-111', 'doc-consortium-flowdown-112', 'doc-unidroit-contracts-113', 'doc-cisg-114', 'doc-wipo-ict-115']
    },
    {
      key: 'geopolitical',
      patterns: ['geopolitical', 'market access', 'export control', 'sanctions', 'sovereign', 'cross-border restriction', 'entity list', 'restricted jurisdiction', 'denied party'],
      docTags: ['geopolitical', 'regulatory', 'strategic', 'supply-chain'],
      docIds: ['doc-bis-export-09', 'doc-ofac-11', 'doc-internal-compliance-tradecontrols-86']
    },
    {
      key: 'business-continuity',
      patterns: ['business continuity', 'continuity', 'resilience', 'disruption', 'downtime', 'outage', 'disaster recovery', 'recovery', 'crisis management', 'business impact analysis', 'bia', 'rto', 'rpo', 'incident management', 'service restoration', 'resumption', 'tabletop', 'alternate site', 'alternate workspace', 'manual fallback', 'call tree', 'incident escalation matrix', 'crisis communication plan', 'continuity exercise'],
      docTags: ['business-continuity', 'resilience', 'bcp', 'dr', 'crisis-management'],
      docIds: ['doc-iso22301-20', 'doc-iso22313-21', 'doc-bcp-10', 'doc-nfpa1600-32', 'doc-iso22361-51', 'doc-nist-80034-75', 'doc-iso22317-76', 'doc-iso22320-77', 'doc-internal-bcm-93']
    },
    {
      key: 'supply-chain',
      patterns: ['supplier', 'third-party', 'third party', 'vendor', 'supply chain', 'sub-tier', 'single source', 'single approved supplier', 'single approved source', 'fourth party', 'outsourcing', 'logistics', 'production line shift', 'inventory buffer', 'safety stock', 'rack enclosures', 'quality hold', 'material flow', 'shipment windows', 'port congestion', 'customs inspection', 'installation sequence', 'allocation priority', 'oem', 'buffer hub', 'deployable inventory', 'service spares', 'repair lead time'],
      docTags: ['supply-chain', 'third-party', 'supplier', 'vendor', 'procurement'],
      docIds: ['doc-iso27036-22', 'doc-iso28000-23', 'doc-3p-08', 'doc-nist-800161-53', 'doc-supply-single-source-143', 'doc-supply-subtier-144', 'doc-supply-logistics-145', 'doc-supply-allocation-146', 'doc-supply-spares-147']
    },
    {
      key: 'procurement',
      patterns: ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'supplier selection', 'maverick spend', 'off-contract', 'enterprise agreement', 'duplicate licenses', 'pricing leakage', 'rfp scoring', 'scoring template', 'whole-life cost', 'technical weighting', 'lotting strategy', 'competition design', 'single aggregator', 'specialist suppliers', 'distributor terms', 'deposit request', 'origin declaration', 'substitution rights', 'bundled scope', 'price validity', 'award strategy', 'direct negotiation', 'incumbent consortium', 'should-cost', 'service baselines'],
      docTags: ['procurement', 'sourcing', 'governance', 'tender-design', 'commercial-governance'],
      docIds: ['doc-iso20400-29', 'doc-worldbank-proc-47', 'doc-uncitral-proc-46', 'doc-proc-software-framework-148', 'doc-proc-tender-wholelife-149', 'doc-proc-lotting-150', 'doc-proc-constrained-contracting-151', 'doc-proc-bundled-award-152', 'doc-proc-direct-negotiation-153']
    },
    {
      key: 'human-rights',
      patterns: ['human rights', 'forced labour', 'forced labor', 'modern slavery', 'exploitative labour', 'exploitative labor', 'worker welfare', 'child labour', 'child labor'],
      docTags: ['human-rights', 'esg', 'procurement', 'supply-chain', 'compliance'],
      docIds: ['doc-oecd-rbc-48', 'doc-ungp-49', 'doc-ilo-osh-54', 'doc-iso20400-29']
    },
    {
      key: 'esg',
      patterns: ['esg', 'sustainability', 'climate', 'emissions', 'greenwashing', 'transition', 'disclosure', 'nature-related', 'tcfd', 'ghg protocol', 'cdp', 'double materiality', 'scope 1', 'scope 2', 'scope 3', 'sustainability claim', 'climate target'],
      docTags: ['esg', 'sustainability', 'reporting', 'environment'],
      docIds: ['doc-ifrs-s1s2-27', 'doc-gri-28', 'doc-csrd-esrs-36', 'doc-sasb-55', 'doc-tnfd-56', 'doc-tcfd-72', 'doc-ghg-protocol-73', 'doc-cdp-74', 'doc-iso14064-59', 'doc-uae-sf-42', 'doc-adx-esg-43', 'doc-csddd-58']
    },
    {
      key: 'hse',
      patterns: ['hse', 'qhse', 'health and safety', 'worker safety', 'contractor safety', 'injury', 'spill', 'hazard', 'environmental', 'process safety', 'loss of containment', 'permit to work', 'management of change', 'psychological safety', 'fatigue', 'major hazard', 'corrective action', 'hazard identification', 'machine guard', 'interlock', 'emergency drill', 'worker accommodation', 'hazardous waste'],
      docTags: ['hse', 'environment', 'health-safety', 'operations'],
      docIds: ['doc-iso45001-30', 'doc-iso14001-31', 'doc-abu-dhabi-ehsms-44', 'doc-uae-fire-life-45', 'doc-ilo-osh-54', 'doc-iso45003-78', 'doc-api-rp754-79', 'doc-ccps-rbps-80', 'doc-internal-hse-94', 'doc-internal-qhse-95']
    },
    {
      key: 'physical-security',
      patterns: ['physical security', 'facilities', 'executive protection', 'visitor management', 'badge control', 'perimeter breach', 'unbadged individual', 'restricted office area', 'door on bypass', 'visitor escort', 'temporary badge privileges', 'event footprint', 'legal war room', 'catering access windows', 'unauthorized movement', 'fence-line alarms', 'camera blind spots', 'temporary gate protocol', 'after-hours service access', 'prototype facility', 'restricted zones', 'executive movement', 'contractor badges', 'loading bay', 'secure cage', 'vehicle screening', 'unsupervised access', 'camera sight lines'],
      docTags: ['physical-security', 'facilities', 'executive-protection', 'operations', 'restricted-site'],
      docIds: ['doc-physical-security-69', 'doc-physical-event-132', 'doc-physical-perimeter-133', 'doc-physical-staging-134', 'doc-uae-fire-life-45']
    },
    {
      key: 'people-workforce',
      patterns: ['people risk', 'workforce', 'labour', 'labor', 'worker welfare', 'fatigue', 'staffing pressure', 'human rights', 'attrition', 'onboarding', 'employee experience', 'compensation disparities', 'internal mobility', 'succession planning', 'promotion pathways', 'contingent specialists', 'mixed employment model'],
      docTags: ['people-workforce', 'human-rights', 'esg', 'hse', 'operations', 'employee-experience', 'talent-retention', 'succession-planning'],
      docIds: ['doc-ungp-49', 'doc-oecd-rbc-48', 'doc-ilo-osh-54', 'doc-sa8000-61', 'doc-workforce-retention-139', 'doc-workforce-policy-140', 'doc-workforce-equity-141', 'doc-workforce-architecture-142']
    },
    {
      key: 'investment-jv',
      patterns: ['m&a', 'merger', 'acquisition', 'joint venture', 'jv', 'integration thesis', 'post-merger integration', 'minority investment', 'controlling stake', 'quality of earnings', 'founder concentration', 'reserved matters', 'pipeline ownership', 'transfer pricing', 'capital calls', 'valuation reset', 'seconded personnel', 'cross-sell assumptions', 'customer consent rights', 'post-close control'],
      docTags: ['investment-jv', 'deal-thesis', 'joint-venture', 'quality-of-earnings', 'governance'],
      docIds: ['doc-investment-jv-70', 'doc-minority-investment-116', 'doc-qoe-control-117', 'doc-jv-governance-118', 'doc-jv-restructuring-119', 'doc-coso-erm-25', 'doc-iso31000-24', 'doc-iso31010-50']
    },
    {
      key: 'transformation-delivery',
      patterns: ['transformation delivery', 'programme delivery', 'program delivery', 'project delivery', 'go-live', 'milestone slip', 'benefit realization', 'benefit realisation', 'target state', 'local exceptions', 'exception governance', 'site-access constraints', 'localisation constraints'],
      docTags: ['transformation-delivery', 'strategic', 'operational', 'governance'],
      docIds: ['doc-coso-erm-25', 'doc-iso31010-50', 'doc-transformation-delivery-71']
    },
    {
      key: 'risk-management',
      patterns: ['risk management', 'risk appetite', 'risk tolerance', 'risk assessment', 'governance', 'rmf', 'nist', 'control baseline', 'enterprise risk', 'residual risk', 'risk register', 'key risk indicator', 'kri', 'emerging risk', 'risk treatment plan'],
      docTags: ['risk-management', 'enterprise-risk', 'governance', 'controls', 'rmf', 'nist'],
      docIds: ['doc-nist-rmf-14', 'doc-nist-80053-13', 'doc-iso31000-24', 'doc-iso27005-16', 'doc-iso-02', 'doc-iso31010-50', 'doc-internal-erm-framework-90', 'doc-internal-erm-policy-91', 'doc-internal-erm-project-92']
    },
    {
      key: 'cloud',
      patterns: ['cloud', 'tenant', 'saas', 'iac', 'public cloud', 'configuration drift'],
      docTags: ['cloud'],
      docIds: ['doc-cloud-04', 'doc-iso27017-17', 'doc-iso27018-18']
    }
  ];

  function init(docs, buData) {
    _docs = Array.isArray(docs) ? docs : [];
    _buData = Array.isArray(buData) ? buData : [];
    _indexedDocs = _docs.map(doc => _buildDocIndex(doc));
    _rebuildCorpusStats();
  }

  function _normaliseText(text = '') {
    return String(text || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function _stemToken(token = '') {
    let value = String(token || '').trim();
    if (value.length <= 4) return value;
    if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
    if (value.endsWith('ing')) return value.slice(0, -3);
    if (value.endsWith('ed')) return value.slice(0, -2);
    if (value.endsWith('es')) return value.slice(0, -2);
    if (value.endsWith('s')) return value.slice(0, -1);
    return value;
  }

  function _tokeniseAll(text = '') {
    return _normaliseText(text)
      .split(/\s+/)
      .map(_stemToken)
      .filter(token => token.length > 2 && !STOP_WORDS.has(token));
  }

  function _tokenise(text = '') {
    return Array.from(new Set(
      _tokeniseAll(text)
    ));
  }

  function _countTerms(tokens = []) {
    const counts = new Map();
    tokens.forEach(token => {
      counts.set(token, (counts.get(token) || 0) + 1);
    });
    return counts;
  }

  function _rebuildCorpusStats() {
    _docCount = _indexedDocs.length;
    _docFrequency = new Map();
    _indexedDocs.forEach(indexedDoc => {
      indexedDoc.tokens.forEach(token => {
        _docFrequency.set(token, (_docFrequency.get(token) || 0) + 1);
      });
    });
    _inverseDocFrequency = new Map();
    _docFrequency.forEach((count, token) => {
      const idf = Math.log(1 + (_docCount + 1) / (1 + count));
      _inverseDocFrequency.set(token, idf);
    });
  }

  function _getIdf(token = '') {
    return _inverseDocFrequency.get(token) || Math.log(1 + (_docCount + 1));
  }

  function _coerceQueryInput(query = '') {
    if (typeof query === 'string') {
      return {
        raw: String(query || ''),
        scenarioLens: null,
        selectedRiskTitles: [],
        priorityTerms: []
      };
    }
    const source = query && typeof query === 'object' ? query : {};
    const guidedInput = source.guidedInput && typeof source.guidedInput === 'object' ? source.guidedInput : {};
    const structuredScenario = source.structuredScenario && typeof source.structuredScenario === 'object' ? source.structuredScenario : {};
    const selectedRiskTitles = Array.isArray(source.selectedRiskTitles)
      ? source.selectedRiskTitles.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    const applicableRegulations = Array.isArray(source.applicableRegulations)
      ? source.applicableRegulations.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    const priorityTerms = [
      ...selectedRiskTitles,
      ...applicableRegulations,
      String(source.businessUnitName || '').trim(),
      String(source.geography || '').trim(),
      String(source.treatmentRequest || '').trim(),
      String(structuredScenario.assetService || '').trim(),
      String(structuredScenario.primaryDriver || structuredScenario.threatCommunity || '').trim(),
      String(structuredScenario.eventPath || structuredScenario.attackType || '').trim(),
      String(structuredScenario.effect || '').trim()
    ].filter(Boolean);
    const raw = [
      String(source.text || source.narrative || source.riskStatement || '').trim(),
      String(guidedInput.event || '').trim(),
      String(guidedInput.asset || '').trim(),
      String(guidedInput.cause || '').trim(),
      String(guidedInput.impact || '').trim(),
      priorityTerms.length ? priorityTerms.join(' ') : ''
    ].filter(Boolean).join(' ');
    return {
      raw,
      scenarioLens: source.scenarioLens || null,
      selectedRiskTitles,
      priorityTerms
    };
  }

  function _queryIncludesAny(query, patterns = []) {
    const q = _normaliseText(query);
    return patterns.some(pattern => q.includes(_normaliseText(pattern)));
  }

  function _extractConceptKeys(text = '') {
    const normalized = _normaliseText(text);
    return CONCEPT_RULES
      .filter(rule => (rule.patterns || []).some(pattern => normalized.includes(_normaliseText(pattern))))
      .map(rule => rule.key);
  }

  function _getMatchingLensTags(query = '') {
    const q = _normaliseText(query);
    const aliases = new Map([
      ['ai-model-risk', ['ai-model-risk', 'ai risk', 'responsible ai', 'model risk', 'model governance', 'algorithmic bias', 'hallucination', 'model drift', 'large language model', 'llm assistant', 'copilot', 'agentic', 'tool chaining', 'abstention', 'calibration', 'benchmark contamination', 'release gating', 'generalization', 'generalisation', 'retraining', 'human in the loop', 'multilingual validation', 'translation bias', 'forecasting model', 'capacity planning model', 'recalibration', 'pilot validation', 'deployment readiness', 'machine-translated']],
      ['data-governance', ['data-governance', 'data governance', 'data protection', 'data privacy', 'privacy', 'data quality', 'lineage', 'data retention', 'retention schedule', 'consent', 'purpose limitation', 'secondary use', 'de-identification', 'data minimization', 'free-text fields', 'passport details', 'identity graph', 'identity views', 'suppression flags', 'record resurrection', 'deletion propagation', 'derived datasets', 'offshore support queue', 'development environment', 'data marketplace']],
      ['third-party', ['third-party', 'third party', 'vendor', 'supplier', 'outsourcing']],
      ['supply-chain', ['supply-chain', 'supply chain', 'logistics', 'inventory', 'sub-tier', 'single source', 'single approved supplier', 'upstream', 'production line shift', 'inventory buffer', 'safety stock', 'quality hold', 'material flow', 'shipment windows', 'port congestion', 'customs inspection', 'installation sequence', 'allocation priority', 'oem', 'buffer hub', 'deployable inventory', 'service spares', 'repair lead time']],
      ['business-continuity', ['business-continuity', 'business continuity', 'continuity', 'recovery', 'disaster recovery', 'crisis management', 'rto', 'rpo', 'business impact analysis', 'bia', 'incident management', 'service restoration', 'resumption']],
      ['fraud-integrity', ['fraud-integrity', 'fraud', 'integrity', 'financial crime', 'kickback', 'bribery', 'corruption', 'side letter', 'return rights', 'rebate support', 'quarter-end pressure', 'ghost workers', 'false certification', 'related party', 'intermediary', 'success fee', 'books and records', 'rebate claims', 'backdated certifications', 'duplicate proof', 'fabricated evidence']],
      ['esg', ['esg', 'sustainability', 'climate', 'emissions', 'greenwashing', 'human rights', 'tcfd', 'ghg protocol', 'cdp', 'double materiality', 'scope 3']],
      ['hse', ['hse', 'health and safety', 'worker safety', 'injury', 'environmental', 'spill', 'hazard', 'process safety', 'loss of containment', 'permit to work', 'management of change', 'psychological safety']],
      ['cyber', ['cyber', 'identity', 'phishing', 'ransomware', 'cloud', 'breach', 'ics', 'ot security']],
      ['operational', ['operational', 'process failure', 'breakdown', 'service failure', 'backlog', 'quality failure']],
      ['strategic', ['strategic', 'strategy', 'market', 'transformation', 'portfolio', 'investment']],
      ['legal-contract', ['legal-contract', 'legal', 'contract', 'litigation', 'indemnity', 'licensing dispute', 'ip ownership', 'rights and remedies', 'service credits', 'confidentiality clause', 'license scope', 'licence scope', 'affiliate use rights', 'service data', 'derived insights', 'step-in rights', 'liability cap', 'technical equivalence', 'acceptance certificate', 'schedule hierarchy', 'annex conflict', 'consortium agreement']],
      ['geopolitical', ['geopolitical', 'sanctions', 'market access', 'export control', 'sovereign', 'entity list']],
      ['regulatory', ['regulatory', 'regulator', 'licence', 'license', 'sanction', 'export control', 'filing']],
      ['financial', ['financial', 'fraud', 'payment', 'treasury', 'capital', 'misstatement']],
      ['compliance', ['compliance', 'non-compliance', 'policy breach', 'anti bribery', 'corruption', 'ethics', 'conduct']],
      ['procurement', ['procurement', 'sourcing', 'tender', 'bid', 'contract award', 'supplier due diligence', 'maverick spend', 'off-contract', 'enterprise agreement', 'duplicate licenses', 'pricing leakage', 'whole-life cost', 'lotting strategy', 'competition design', 'single aggregator', 'distributor terms', 'bundled scope', 'price validity', 'direct negotiation', 'should-cost', 'service baselines']],
      ['physical-security', ['physical-security', 'physical security', 'facilities', 'executive protection', 'perimeter', 'visitor management', 'unbadged individual', 'restricted office area', 'door on bypass', 'visitor escort', 'temporary badge privileges', 'event footprint', 'legal war room', 'catering access windows', 'unauthorized movement', 'fence-line alarms', 'camera blind spots', 'temporary gate protocol', 'after-hours service access', 'prototype facility', 'restricted zones', 'executive movement', 'contractor badges', 'loading bay', 'secure cage', 'vehicle screening', 'unsupervised access', 'camera sight lines']],
      ['ot-resilience', ['ot-resilience', 'ot', 'ics', 'scada', 'industrial control', 'site systems', 'plant network', 'edge computing room', 'temperature alarms', 'power fluctuation', 'airflow settings', 'workload throttling', 'edge gateways', 'heatwave', 'power quality fluctuations', 'telemetry gaps', 'manual field verification', 'timing mismatch', 'edge controller', 'configuration baseline', 'false rejects', 'supervised mode', 'failover logic', 'backup power transfer', 'restart priorities', 'regional grid disturbance', 'gateway clocks', 'telemetry replay', 'control confirmations', 'state reconstruction', 'edge inference', 'actuator timing', 'reject gate', 'restart instability']],
      ['people-workforce', ['people-workforce', 'people risk', 'workforce', 'labour', 'labor', 'staffing pressure', 'human rights', 'attrition', 'onboarding', 'employee experience', 'internal mobility', 'succession planning', 'contingent specialists', 'promotion pathways', 'mixed employment model', 'compensation disparities']],
      ['investment-jv', ['investment-jv', 'investment', 'm&a', 'merger', 'acquisition', 'joint venture', 'jv', 'integration thesis', 'minority investment', 'controlling stake', 'quality of earnings', 'reserved matters', 'capital calls', 'valuation reset', 'post-close control']],
      ['transformation-delivery', ['transformation-delivery', 'transformation delivery', 'programme delivery', 'program delivery', 'project delivery', 'go live', 'milestone slip']]
    ]);
    return LENS_TAGS.filter(tag => (aliases.get(tag) || [tag]).some(pattern => q.includes(_normaliseText(pattern))));
  }

  function _expandQuery(query = '') {
    const querySource = _coerceQueryInput(query);
    const raw = String(querySource.raw || '');
    const normalized = _normaliseText(raw);
    const concepts = Array.from(new Set(_extractConceptKeys(raw)));
    const lensTags = Array.from(new Set([
      ..._getMatchingLensTags(raw),
      ..._getMatchingLensTags(String(querySource.scenarioLens?.key || querySource.scenarioLens?.label || ''))
    ]));
    const phrases = Array.from(new Set(
      CONCEPT_RULES
        .flatMap(rule => rule.patterns || [])
        .filter(pattern => normalized.includes(_normaliseText(pattern)) && _normaliseText(pattern).includes(' '))
    ));
    const expandedTerms = new Set(_tokenise(raw));

    lensTags.forEach(tag => {
      _tokenise(tag).forEach(term => expandedTerms.add(term));
    });

    concepts.forEach(key => {
      const rule = CONCEPT_RULES.find(item => item.key === key);
      (rule?.patterns || []).forEach(pattern => {
        _tokenise(pattern).forEach(term => expandedTerms.add(term));
      });
      (rule?.docTags || []).forEach(tag => {
        _tokenise(tag).forEach(term => expandedTerms.add(term));
      });
    });

    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(raw, rule.patterns)) return;
      (rule.patterns || []).forEach(pattern => {
        _tokenise(pattern).forEach(term => expandedTerms.add(term));
      });
      (rule.docTags || []).forEach(tag => {
        _tokenise(tag).forEach(term => expandedTerms.add(term));
      });
    });

    (querySource.priorityTerms || []).forEach(term => {
      _tokenise(term).forEach(token => expandedTerms.add(token));
      if (_normaliseText(term).includes(' ')) phrases.push(term);
    });

    const termWeights = new Map();
    const addTermWeight = (term, weight) => {
      if (!term) return;
      termWeights.set(term, (termWeights.get(term) || 0) + weight);
    };

    Array.from(expandedTerms).forEach(term => addTermWeight(term, 1));
    (querySource.priorityTerms || []).forEach(term => {
      _tokenise(term).forEach(token => addTermWeight(token, 1.2));
    });
    lensTags.forEach(tag => {
      _tokenise(tag).forEach(token => addTermWeight(token, 0.6));
    });
    concepts.forEach(key => {
      const rule = CONCEPT_RULES.find(item => item.key === key);
      (rule?.patterns || []).forEach(pattern => {
        _tokenise(pattern).forEach(token => addTermWeight(token, 0.45));
      });
    });

    return {
      raw,
      normalized,
      concepts,
      lensTags,
      phrases: Array.from(new Set(phrases)),
      expandedTerms: Array.from(expandedTerms),
      priorityTerms: Array.from(new Set((querySource.priorityTerms || []).map(term => _normaliseText(term)).filter(Boolean))),
      termWeights
    };
  }

  function _buildDocIndex(doc = {}) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const text = `${doc.title || ''} ${doc.contentExcerpt || ''} ${doc.contentFull || ''} ${tags.join(' ')}`;
    const allTokens = _tokeniseAll(text);
    const titleTokens = _tokenise(doc.title || '');
    const tokenFrequency = _countTerms(allTokens);
    return {
      doc,
      tags,
      normalizedTitle: _normaliseText(doc.title || ''),
      normalizedText: _normaliseText(text),
      titleTokens: new Set(titleTokens),
      tokens: new Set(allTokens),
      tokenFrequency,
      maxTokenFrequency: Math.max(1, allTokens.length ? Math.max(...Array.from(tokenFrequency.values())) : 1),
      concepts: new Set(_extractConceptKeys(`${text} ${tags.join(' ')}`))
    };
  }

  function _tfidfWeight(term, frequencyMap, maxFrequency) {
    const tf = Number(frequencyMap?.get(term) || 0);
    if (!tf) return 0;
    return (0.5 + 0.5 * (tf / Math.max(1, maxFrequency || 1))) * _getIdf(term);
  }

  function _queryVectorWeight(term, queryInfo) {
    const base = Number(queryInfo?.termWeights?.get(term) || 0);
    if (!base) return 0;
    return base * _getIdf(term);
  }

  function _vectorSimilarity(indexedDoc, queryInfo) {
    const terms = Array.from(queryInfo?.termWeights?.keys?.() || []);
    if (!terms.length) return 0;
    let numerator = 0;
    let queryMagnitude = 0;
    let docMagnitude = 0;
    terms.forEach(term => {
      const queryWeight = _queryVectorWeight(term, queryInfo);
      const docWeight = _tfidfWeight(term, indexedDoc.tokenFrequency, indexedDoc.maxTokenFrequency);
      numerator += queryWeight * docWeight;
      queryMagnitude += queryWeight ** 2;
      docMagnitude += docWeight ** 2;
    });
    if (!numerator || !queryMagnitude || !docMagnitude) return 0;
    return numerator / (Math.sqrt(queryMagnitude) * Math.sqrt(docMagnitude));
  }

  function _classifyDocSource(doc) {
    const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag || '').toLowerCase()) : [];
    const text = `${doc.title || ''} ${doc.url || ''} ${tags.join(' ')}`.toLowerCase();
    if (tags.includes('regulatory') || /pdpl|gdpr|regulat|authority|ministry|policy|law|nist|iso|iec|oecd|ilo|ungp|united nations|ifrs|gri|tnfd|sasb|basel|bcbs|tcfd|ghg protocol|cdp|ccps|api rp/.test(text)) return 'Standards / regulatory';
    if (tags.includes('all-bu') || tags.includes('internal') || /playbook|policy|framework|baseline|mapping|program|standard/.test(text)) return 'Internal reference';
    if (/news|reuters|bloomberg|forbes|cnbc|zawya|gulf|khaleej|arabianbusiness/.test(text)) return 'External source';
    return 'Reference source';
  }

  function _buildRelevanceReasons(indexedDoc, queryInfo, buId) {
    const tags = indexedDoc.tags;
    const reasons = [];
    const exactLensMatches = (queryInfo.lensTags || []).filter(tag => tags.includes(tag));
    if (exactLensMatches.length) {
      reasons.push(`Exact ${exactLensMatches[0].replace(/-/g, ' ')} lens match`);
    }
    const semanticMatches = (queryInfo.concepts || []).filter(concept => indexedDoc.concepts.has(concept));
    if (semanticMatches.length) {
      reasons.push(`Semantic match: ${semanticMatches[0].replace(/-/g, ' ')}`);
    }
    const priorityMatches = (queryInfo.priorityTerms || []).filter(term => term && indexedDoc.normalizedTitle.includes(term));
    if (priorityMatches.length) {
      reasons.push(`Title match: ${priorityMatches[0].replace(/-/g, ' ')}`);
    }
    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(queryInfo.raw, rule.patterns)) return;
      if ((rule.docIds || []).includes(indexedDoc.doc.id) || (rule.docTags || []).some(tag => tags.includes(tag))) {
        reasons.push(`Matches ${rule.key.replace(/-/g, ' ')} context`);
      }
    });
    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(indexedDoc.doc.id)) {
      reasons.push('Mapped to the selected business unit');
    }
    if (Array.isArray(indexedDoc.doc.buIds) && indexedDoc.doc.buIds.includes(buId)) {
      reasons.push('Mapped to the selected business unit');
    }
    if (tags.includes('all-bu')) {
      reasons.push('Applies across the organisation');
    }
    if (tags.includes('nist') || tags.includes('iso') || tags.includes('oecd') || tags.includes('iec') || /tcfd|ghg protocol|cdp|ccps|api rp/.test(`${indexedDoc.doc.title || ''} ${indexedDoc.doc.url || ''}`.toLowerCase())) {
      reasons.push('Recognised control or governance reference');
    }
    if (!reasons.length && tags.length) {
      reasons.push(`Relevant tags: ${tags.slice(0, 2).join(', ')}`);
    }
    return reasons.slice(0, 2);
  }

  function _topicBoost(indexedDoc, query) {
    const tags = indexedDoc.tags;
    let boost = 0;
    TOPIC_RULES.forEach(rule => {
      if (!_queryIncludesAny(query, rule.patterns)) return;
      if ((rule.docIds || []).includes(indexedDoc.doc.id)) boost += 8;
      if ((rule.docTags || []).some(tag => tags.includes(tag))) boost += 5;
    });
    return boost;
  }

  function _semanticBoost(indexedDoc, queryInfo) {
    let boost = 0;

    const conceptOverlap = (queryInfo.concepts || []).filter(concept => indexedDoc.concepts.has(concept));
    boost += conceptOverlap.length * 5;
    conceptOverlap.forEach(concept => {
      const rule = CONCEPT_RULES.find(item => item.key === concept);
      if ((rule?.docIds || []).includes(indexedDoc.doc.id)) boost += 5;
      if ((rule?.docTags || []).some(tag => indexedDoc.tags.includes(tag))) boost += 4;
    });

    (queryInfo.phrases || []).forEach(phrase => {
      const normalizedPhrase = _normaliseText(phrase);
      if (normalizedPhrase && indexedDoc.normalizedText.includes(normalizedPhrase)) {
        boost += normalizedPhrase.split(' ').length > 1 ? 4 : 2;
      }
    });

    const tokenOverlap = (queryInfo.expandedTerms || []).filter(term => indexedDoc.tokens.has(term));
    boost += Math.min(tokenOverlap.length, 10) * 1.15;

    return boost;
  }

  function _sourcePriority(indexedDoc) {
    const label = _classifyDocSource(indexedDoc.doc);
    if (label === 'Standards / regulatory') return 0;
    if (label === 'Internal reference') return 1;
    if (label === 'Reference source') return 2;
    return 3;
  }

  function _getFeedbackRetrievalProfile(buId, queryInfo = {}) {
    // Neutralized compatibility shim: do not reintroduce browser-authoritative
    // feedback weighting into retrieval for server-owned workflows.
    void buId;
    void queryInfo;
    return null;
  }

  function _feedbackBoost(indexedDoc, feedbackProfile = null) {
    void indexedDoc;
    void feedbackProfile;
    return 0;
  }

  // Semantic-style overlap scoring with concept and phrase expansion
  function scoreDoc(indexedDoc, query, buId, feedbackProfile = null) {
    const queryInfo = typeof query === 'string' ? _expandQuery(query) : query;
    let score = 0;

    (queryInfo.expandedTerms || []).forEach(term => {
      const safeTerm = _escapeRegExp(term);
      if (!safeTerm) return;
      const hits = (indexedDoc.normalizedText.match(new RegExp(`\\b${safeTerm}\\b`, 'g')) || []).length;
      score += hits * 1.4;
      if (indexedDoc.titleTokens.has(term)) score += 2.3;
    });

    // Hybrid local semantic retrieval: TF-IDF cosine similarity helps nuanced enterprise phrasing match beyond direct literals.
    score += _vectorSimilarity(indexedDoc, queryInfo) * 16;

    const bu = _buData.find(b => b.id === buId);
    if (bu && bu.docIds && bu.docIds.includes(indexedDoc.doc.id)) {
      score += 5;
    }

    // Exact lens alignment should nudge ranking, not overwhelm textual relevance.
    (queryInfo.lensTags || []).forEach(tag => {
      if (indexedDoc.tags.includes(tag)) score += 4;
    });

    score += _semanticBoost(indexedDoc, queryInfo);
    score += _topicBoost(indexedDoc, queryInfo.raw);

    (queryInfo.priorityTerms || []).forEach(term => {
      if (!term) return;
      if (indexedDoc.normalizedTitle.includes(term)) score += 4.5;
      if (indexedDoc.normalizedText.includes(term)) score += 1.4;
    });

    if (indexedDoc.tags.includes('all-bu')) score += 0.75;
    if (indexedDoc.tags.includes('nist') || indexedDoc.tags.includes('iso') || indexedDoc.tags.includes('oecd') || indexedDoc.tags.includes('iec') || /tcfd|ghg protocol|cdp|ccps|api rp/.test((indexedDoc.doc.title || '').toLowerCase())) score += 0.6;
    score += _feedbackBoost(indexedDoc, feedbackProfile);

    const daysSince = (Date.now() - new Date(indexedDoc.doc.lastUpdated).getTime()) / 86400000;
    score += Math.max(0, 1 - daysSince / 365);

    return score;
  }

  /**
   * Retrieve relevant docs for a BU + narrative query
   * [RAG-INTEGRATION] Replace with Azure Cognitive Search vector query
   */
  function getDocStalenessWarning(doc = {}) {
    const updatedAt = Date.parse(String(doc?.lastUpdated || '').trim());
    if (!Number.isFinite(updatedAt)) return null;
    const ageMonths = (Date.now() - updatedAt) / (86400000 * 30.4375);
    if (ageMonths < 18) return null;
    if (ageMonths <= 36) {
      return {
        level: 'info',
        message: 'This source was last reviewed over 18 months ago.'
      };
    }
    return {
      level: 'warning',
      message: 'This source is over 3 years old and may no longer reflect current standards.'
    };
  }

  async function retrieveRelevantDocs(buId, query, topK = 4) {
    const isDemo = typeof LLMService !== 'undefined'
      && typeof LLMService.isUsingStub === 'function'
      && LLMService.isUsingStub();
    if (isDemo) await _simulateLatency(400);
    if (_indexedDocs.length === 0) {
      console.warn('RAGService: retrieveRelevantDocs called before docs were indexed. Citations will be empty.');
    }

    const queryInfo = _expandQuery(query);
    const feedbackProfile = _getFeedbackRetrievalProfile(buId, queryInfo);
    const scored = _indexedDocs.map(indexed => ({
      ...indexed.doc,
      _score: scoreDoc(indexed, queryInfo, buId, feedbackProfile),
      _relevanceReason: _buildRelevanceReasons(indexed, queryInfo, buId).join(' · ')
    }));

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const sourceDiff = _sourcePriority(_buildDocIndex(a)) - _sourcePriority(_buildDocIndex(b));
      if (sourceDiff !== 0) return sourceDiff;
      return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
    });

    const results = scored.filter(d => d._score > 0).slice(0, Math.max(topK, 6));

    const selected = results.slice(0, topK).map((d, index) => ({
      docId: d.id,
      title: d.title,
      url: d.url,
      sourceUrl: d.sourceUrl || null,
      excerpt: d.contentExcerpt,
      contentFull: index < 2
        ? (String(d.contentFull || '').trim() || '')
        : '',
      tags: d.tags,
      score: d._score,
      lastUpdated: d.lastUpdated,
      sourceType: _classifyDocSource(d),
      relevanceReason: d._relevanceReason,
      stalenessWarning: getDocStalenessWarning(d)
    }));
    try {
      if (typeof window !== 'undefined') {
        window._lastRagSources = selected.map((item) => ({
          title: item.title,
          url: item.url,
          sourceUrl: item.sourceUrl,
          sourceType: item.sourceType,
          relevanceReason: item.relevanceReason
        }));
      }
    } catch {}
    return selected;
  }

  function getDocsForBU(buId) {
    const bu = _buData.find(b => b.id === buId);
    if (!bu) return [];
    return _docs.filter(d => bu.docIds && bu.docIds.includes(d.id));
  }

  function addDocument(doc) {
    if (!doc || !doc.id) return;
    const existing = _docs.findIndex(d => d.id === doc.id);
    const normalised = {
      id: String(doc.id || '').trim(),
      title: String(doc.title || '').trim(),
      url: String(doc.url || '').trim(),
      sourceUrl: String(doc.sourceUrl || '').trim() || null,
      contentExcerpt: String(doc.contentExcerpt || doc.excerpt || '').slice(0, 500).trim(),
      contentFull: String(doc.contentFull || doc.content || doc.contentExcerpt || '').slice(0, 8000).trim(),
      tags: Array.isArray(doc.tags) ? doc.tags.map(String).filter(Boolean) : [],
      lastUpdated: doc.lastUpdated || new Date().toISOString(),
      buIds: Array.isArray(doc.buIds) ? doc.buIds : []
    };
    if (existing >= 0) {
      _docs[existing] = normalised;
    } else {
      _docs.push(normalised);
    }
    _indexedDocs = _docs.map(item => _buildDocIndex(item));
    _rebuildCorpusStats();
  }

  function bulkAddDocuments(docs = []) {
    (Array.isArray(docs) ? docs : []).forEach(doc => {
      if (!doc || !doc.id) return;
      const existing = _docs.findIndex(item => item.id === doc.id);
      const normalised = {
        id: String(doc.id || '').trim(),
        title: String(doc.title || '').trim(),
        url: String(doc.url || '').trim(),
        sourceUrl: String(doc.sourceUrl || '').trim() || null,
        contentExcerpt: String(doc.contentExcerpt || doc.excerpt || '').slice(0, 500).trim(),
        contentFull: String(doc.contentFull || doc.content || doc.contentExcerpt || '').slice(0, 8000).trim(),
        tags: Array.isArray(doc.tags) ? doc.tags.map(String).filter(Boolean) : [],
        lastUpdated: doc.lastUpdated || new Date().toISOString(),
        buIds: Array.isArray(doc.buIds) ? doc.buIds : []
      };
      if (existing >= 0) _docs[existing] = normalised;
      else _docs.push(normalised);
    });
    _indexedDocs = _docs.map(item => _buildDocIndex(item));
    _rebuildCorpusStats();
  }

  function _simulateLatency(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isReady() {
    return _indexedDocs.length > 0;
  }

  return { init, isReady, retrieveRelevantDocs, getDocStalenessWarning, getDocsForBU, addDocument, bulkAddDocuments };
})();
