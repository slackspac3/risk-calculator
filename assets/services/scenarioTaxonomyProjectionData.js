(function (globalScope) {
  'use strict';
  globalScope.__SCENARIO_TAXONOMY_PROJECTION_DATA__ = {
  "taxonomyVersion": "phase1.1-2026-04-04",
  "domains": [
    {
      "key": "cyber",
      "label": "Cyber"
    },
    {
      "key": "operational",
      "label": "Operational"
    },
    {
      "key": "business_continuity",
      "label": "Business Continuity"
    },
    {
      "key": "finance",
      "label": "Finance"
    },
    {
      "key": "fraud_integrity",
      "label": "Fraud / Integrity"
    },
    {
      "key": "compliance",
      "label": "Compliance"
    },
    {
      "key": "regulatory",
      "label": "Regulatory"
    },
    {
      "key": "legal_contract",
      "label": "Legal / Contract"
    },
    {
      "key": "procurement",
      "label": "Procurement"
    },
    {
      "key": "supply_chain",
      "label": "Supply Chain"
    },
    {
      "key": "third_party",
      "label": "Third Party"
    },
    {
      "key": "strategic_transformation",
      "label": "Strategic / Transformation"
    },
    {
      "key": "esg_hse_people",
      "label": "ESG / HSE / People"
    },
    {
      "key": "physical_ot",
      "label": "Physical / OT"
    }
  ],
  "overlays": [
    {
      "key": "service_outage",
      "label": "Service outage",
      "group": "business_impact"
    },
    {
      "key": "customer_harm",
      "label": "Customer harm",
      "group": "business_impact"
    },
    {
      "key": "direct_monetary_loss",
      "label": "Direct monetary loss",
      "group": "business_impact"
    },
    {
      "key": "regulatory_scrutiny",
      "label": "Regulatory scrutiny",
      "group": "governance"
    },
    {
      "key": "backlog_growth",
      "label": "Backlog growth",
      "group": "operational"
    },
    {
      "key": "recovery_strain",
      "label": "Recovery strain",
      "group": "operational"
    },
    {
      "key": "reputational_damage",
      "label": "Reputational damage",
      "group": "business_impact"
    },
    {
      "key": "data_exposure",
      "label": "Data exposure",
      "group": "information"
    },
    {
      "key": "operational_disruption",
      "label": "Operational disruption",
      "group": "operational"
    },
    {
      "key": "control_breakdown",
      "label": "Control breakdown",
      "group": "governance"
    },
    {
      "key": "third_party_dependency",
      "label": "Third-party dependency",
      "group": "dependency"
    },
    {
      "key": "legal_exposure",
      "label": "Legal exposure",
      "group": "governance"
    }
  ],
  "families": [
    {
      "key": "identity_compromise",
      "label": "Identity compromise",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 92,
      "preferredFamilyKey": "",
      "legacyKey": "identity",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "positiveSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "admin credentials",
          "strength": "medium"
        },
        {
          "text": "account takeover",
          "strength": "medium"
        },
        {
          "text": "compromised account",
          "strength": "medium"
        },
        {
          "text": "tenant admin",
          "strength": "medium"
        },
        {
          "text": "global admin",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        },
        {
          "text": "mailbox takeover",
          "strength": "medium"
        },
        {
          "text": "email account hijacked",
          "strength": "medium"
        },
        {
          "text": "mailbox hijacked",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "volumetric attack",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "privileged_misuse",
        "data_disclosure",
        "cloud_control_failure"
      ],
      "canCoExistWith": [
        "unauthorized_configuration_change",
        "data_disclosure"
      ],
      "canEscalateTo": [
        "data_disclosure",
        "payment_fraud"
      ],
      "forbiddenDriftFamilies": [
        "payment_control_failure",
        "delivery_slippage",
        "greenwashing_disclosure_gap"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "data_exposure"
      ],
      "promptIdeaTemplates": [
        "Privileged identity is compromised and used to change control state",
        "Admin credentials are abused to access the tenant and alter critical settings"
      ],
      "shortlistSeedThemes": [
        "identity platform compromise",
        "privileged account takeover",
        "control-plane misuse"
      ],
      "examplePhrases": [
        "Azure global admin credentials discovered on the dark web",
        "compromised privileged account used to access the tenant",
        "mailbox takeover enabled unauthorized approvals"
      ]
    },
    {
      "key": "phishing_bec",
      "label": "Phishing / BEC",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "phishing",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "phishing",
      "positiveSignals": [
        {
          "text": "phishing",
          "strength": "medium"
        },
        {
          "text": "bec",
          "strength": "medium"
        },
        {
          "text": "business email compromise",
          "strength": "medium"
        },
        {
          "text": "spoofed email",
          "strength": "medium"
        },
        {
          "text": "impersonation",
          "strength": "medium"
        },
        {
          "text": "email lure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "payment_fraud",
        "invoice_fraud"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "greenwashing_disclosure_gap"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "spoofed executive email",
        "phishing campaign captures approvals",
        "business email compromise attempt"
      ]
    },
    {
      "key": "business_email_compromise",
      "label": "Business email compromise",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "phishing",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "phishing",
      "positiveSignals": [
        {
          "text": "business email compromise",
          "strength": "strong"
        },
        {
          "text": "mailbox takeover",
          "strength": "strong"
        },
        {
          "text": "spoofed executive email",
          "strength": "strong"
        },
        {
          "text": "email account compromise",
          "strength": "strong"
        },
        {
          "text": "approval request from compromised mailbox",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "mailbox",
          "strength": "weak"
        }
      ],
      "allowedSecondaryFamilies": [
        "phishing_bec",
        "identity_compromise",
        "payment_fraud"
      ],
      "canCoExistWith": [
        "payment_control_failure",
        "invoice_fraud"
      ],
      "canEscalateTo": [
        "payment_fraud"
      ],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "forced_labour_modern_slavery"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "legal_exposure"
      ],
      "promptIdeaTemplates": [
        "Compromised mailbox manipulates a sensitive approval path",
        "Business email compromise abuses email trust to trigger action"
      ],
      "shortlistSeedThemes": [
        "mailbox compromise",
        "approval abuse",
        "fraud exposure"
      ],
      "examplePhrases": [
        "a compromised executive mailbox sends false payment instructions",
        "business email compromise hijacks an approval path",
        "spoofed email triggers an unauthorised release of funds"
      ]
    },
    {
      "key": "ransomware",
      "label": "Ransomware",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "ransomware",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "ransomware",
      "positiveSignals": [
        {
          "text": "ransomware",
          "strength": "medium"
        },
        {
          "text": "encrypts systems",
          "strength": "medium"
        },
        {
          "text": "ransom note",
          "strength": "medium"
        },
        {
          "text": "extortion malware",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "data_disclosure",
        "endpoint_compromise"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "recovery_strain",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "ransomware encrypts critical services",
        "extortion event after initial access"
      ]
    },
    {
      "key": "availability_attack",
      "label": "Availability attack",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 90,
      "preferredFamilyKey": "",
      "legacyKey": "availability-attack",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "general",
      "positiveSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "denial of service",
          "strength": "medium"
        },
        {
          "text": "traffic flood",
          "strength": "medium"
        },
        {
          "text": "hostile traffic",
          "strength": "medium"
        },
        {
          "text": "volumetric attack",
          "strength": "medium"
        },
        {
          "text": "application-layer flood",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "service overwhelmed by requests",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "model",
          "strength": "medium"
        },
        {
          "text": "ai",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "regulatory filing",
          "strength": "strong"
        },
        {
          "text": "invoice fraud",
          "strength": "strong"
        },
        {
          "text": "policy breach",
          "strength": "medium"
        },
        {
          "text": "regulatory notice",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "cloud_control_failure"
      ],
      "canCoExistWith": [
        "service_delivery_failure",
        "recovery_coordination_failure"
      ],
      "canEscalateTo": [
        "recovery_coordination_failure"
      ],
      "forbiddenDriftFamilies": [
        "policy_breach",
        "greenwashing_disclosure_gap",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "operational_disruption",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "regulatory_scrutiny",
        "direct_monetary_loss"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "DDoS traffic overwhelms the public website",
        "volumetric attack floods online services",
        "botnet traffic causes customer-facing services to crash"
      ]
    },
    {
      "key": "cloud_control_failure",
      "label": "Cloud control failure",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "cloud",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "cloud",
      "positiveSignals": [
        {
          "text": "cloud misconfiguration",
          "strength": "medium"
        },
        {
          "text": "storage exposure",
          "strength": "medium"
        },
        {
          "text": "public bucket",
          "strength": "medium"
        },
        {
          "text": "tenant misconfig",
          "strength": "medium"
        },
        {
          "text": "cloud admin weakness",
          "strength": "medium"
        },
        {
          "text": "public exposure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "data_disclosure",
        "privileged_misuse"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "data_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "public cloud storage exposure",
        "cloud admin control weakness",
        "tenant misconfiguration opens access"
      ]
    },
    {
      "key": "data_disclosure",
      "label": "Data disclosure",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "data-breach",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "dataBreach",
      "positiveSignals": [
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "breach",
          "strength": "strong"
        },
        {
          "text": "disclosure",
          "strength": "medium"
        },
        {
          "text": "leaked data",
          "strength": "strong"
        },
        {
          "text": "exposed records",
          "strength": "strong"
        },
        {
          "text": "stolen data",
          "strength": "strong"
        },
        {
          "text": "data exposure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "permit breach",
          "strength": "medium"
        },
        {
          "text": "without lawful basis",
          "strength": "medium"
        },
        {
          "text": "retention breach",
          "strength": "medium"
        },
        {
          "text": "transfer without safeguards",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "breach",
          "strength": "strong"
        },
        {
          "text": "disclosure",
          "strength": "medium"
        },
        {
          "text": "leaked data",
          "strength": "strong"
        },
        {
          "text": "exposed records",
          "strength": "strong"
        },
        {
          "text": "stolen data",
          "strength": "strong"
        },
        {
          "text": "data exposure",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "cloud_control_failure",
        "insider_misuse"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "data_exposure",
        "regulatory_scrutiny",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "leaked customer records",
        "stolen data from the tenant",
        "unauthorized disclosure of personal data"
      ]
    },
    {
      "key": "endpoint_compromise",
      "label": "Endpoint compromise",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "cyber",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "general",
      "positiveSignals": [
        {
          "text": "endpoint compromise",
          "strength": "medium"
        },
        {
          "text": "workstation malware",
          "strength": "medium"
        },
        {
          "text": "infected laptop",
          "strength": "medium"
        },
        {
          "text": "compromised endpoint",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "ransomware"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "greenwashing_disclosure_gap"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "compromised employee workstation",
        "infected endpoint opens access path"
      ]
    },
    {
      "key": "insider_misuse",
      "label": "Insider misuse",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "insider",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "positiveSignals": [
        {
          "text": "insider misuse",
          "strength": "medium"
        },
        {
          "text": "malicious insider",
          "strength": "medium"
        },
        {
          "text": "employee misuse",
          "strength": "medium"
        },
        {
          "text": "internal privilege abuse",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "privileged_misuse",
        "data_disclosure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "greenwashing_disclosure_gap"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "data_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "malicious insider misuses access",
        "employee abuses privileged tools"
      ]
    },
    {
      "key": "unauthorized_configuration_change",
      "label": "Unauthorised configuration change",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "identity",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "positiveSignals": [
        {
          "text": "modify critical configurations",
          "strength": "strong"
        },
        {
          "text": "unauthorised configuration change",
          "strength": "strong"
        },
        {
          "text": "security settings changed",
          "strength": "medium"
        },
        {
          "text": "disable controls",
          "strength": "strong"
        },
        {
          "text": "critical configuration changed",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "cloud_control_failure",
        "insider_misuse"
      ],
      "canCoExistWith": [
        "data_disclosure",
        "availability_attack"
      ],
      "canEscalateTo": [
        "service_delivery_failure"
      ],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "forced_labour_modern_slavery"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "Compromised or misused admin access changes a critical configuration baseline",
        "A control-plane change weakens the service path and the control environment"
      ],
      "shortlistSeedThemes": [
        "configuration tampering",
        "control-plane misuse",
        "service disruption from change"
      ],
      "examplePhrases": [
        "critical configurations are modified after the attacker gains access",
        "security settings are changed without authority",
        "controls are disabled through unauthorised tenant changes"
      ]
    },
    {
      "key": "privileged_misuse",
      "label": "Privileged misuse",
      "domain": "cyber",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "identity_compromise",
      "legacyKey": "identity",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "positiveSignals": [
        {
          "text": "privileged misuse",
          "strength": "medium"
        },
        {
          "text": "admin account misuse",
          "strength": "medium"
        },
        {
          "text": "unauthorized admin changes",
          "strength": "medium"
        },
        {
          "text": "privileged escalation",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "modern slavery",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "cloud_control_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "payment_control_failure",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "privileged user changes critical configurations",
        "admin account misused to disable controls"
      ]
    },
    {
      "key": "third_party_access_compromise",
      "label": "Third-party access compromise",
      "domain": "cyber",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "thirdParty",
      "positiveSignals": [
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "third-party access compromised",
          "strength": "strong"
        },
        {
          "text": "supplier access path",
          "strength": "medium"
        },
        {
          "text": "partner account compromised",
          "strength": "strong"
        },
        {
          "text": "external support account abused",
          "strength": "medium"
        },
        {
          "text": "vendor credentials abused",
          "strength": "strong"
        },
        {
          "text": "third-party remote access",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "logistics disruption",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "weak supplier governance",
          "strength": "medium"
        },
        {
          "text": "vendor control gap",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "vendor",
          "strength": "weak"
        },
        {
          "text": "third-party",
          "strength": "weak"
        },
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "partner",
          "strength": "weak"
        },
        {
          "text": "support account",
          "strength": "weak"
        }
      ],
      "allowedSecondaryFamilies": [
        "vendor_access_weakness",
        "identity_compromise",
        "cloud_control_failure"
      ],
      "canCoExistWith": [
        "third_party_access_compromise",
        "data_disclosure"
      ],
      "canEscalateTo": [
        "data_disclosure"
      ],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "single_source_dependency"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "A compromised vendor access path becomes the route into the environment",
        "Third-party access is abused to change controls or reach sensitive services"
      ],
      "shortlistSeedThemes": [
        "vendor access compromise",
        "supplier trust path abuse",
        "control inheritance failure"
      ],
      "examplePhrases": [
        "a vendor support account is compromised and used inside the environment",
        "third-party remote access becomes the intrusion path",
        "partner credentials are abused to reach critical systems"
      ]
    },
    {
      "key": "process_breakdown",
      "label": "Process breakdown",
      "domain": "operational",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "process breakdown",
          "strength": "medium"
        },
        {
          "text": "workflow failure",
          "strength": "medium"
        },
        {
          "text": "process failed",
          "strength": "medium"
        },
        {
          "text": "operational breakdown",
          "strength": "medium"
        },
        {
          "text": "manual processing error",
          "strength": "medium"
        },
        {
          "text": "human error disrupts",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "service_delivery_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "availability_attack"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "backlog_growth"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "a process breakdown disrupts fulfilment",
        "workflow failure delays service delivery"
      ]
    },
    {
      "key": "capacity_shortfall",
      "label": "Capacity shortfall",
      "domain": "operational",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "service_delivery_failure",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "capacity shortfall",
          "strength": "medium"
        },
        {
          "text": "insufficient capacity",
          "strength": "medium"
        },
        {
          "text": "throughput constraint",
          "strength": "medium"
        },
        {
          "text": "resource bottleneck",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "invoice fraud",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "backlog_escalation"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "backlog_growth",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "service desk capacity shortfall",
        "throughput bottleneck delays fulfilment"
      ]
    },
    {
      "key": "manual_error",
      "label": "Manual error",
      "domain": "operational",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "process_breakdown",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "manual error",
          "strength": "medium"
        },
        {
          "text": "human error",
          "strength": "medium"
        },
        {
          "text": "operator error",
          "strength": "medium"
        },
        {
          "text": "mistaken processing",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "dark web credentials",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "process_breakdown"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "availability_attack"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "manual processing error causes outage",
        "human error disrupts a critical service"
      ]
    },
    {
      "key": "platform_instability",
      "label": "Platform instability",
      "domain": "operational",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "platform instability",
          "strength": "medium"
        },
        {
          "text": "system instability",
          "strength": "medium"
        },
        {
          "text": "aging infrastructure",
          "strength": "medium"
        },
        {
          "text": "legacy infrastructure",
          "strength": "medium"
        },
        {
          "text": "service degradation",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "service_delivery_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "recovery_strain"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "legacy infrastructure causes service instability",
        "platform instability degrades critical service"
      ]
    },
    {
      "key": "service_delivery_failure",
      "label": "Service delivery failure",
      "domain": "operational",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "service delivery failure",
          "strength": "medium"
        },
        {
          "text": "service failure",
          "strength": "medium"
        },
        {
          "text": "critical service disruption",
          "strength": "medium"
        },
        {
          "text": "service degradation",
          "strength": "medium"
        },
        {
          "text": "capacity shortfall",
          "strength": "medium"
        },
        {
          "text": "insufficient capacity",
          "strength": "medium"
        },
        {
          "text": "throughput constraint",
          "strength": "medium"
        },
        {
          "text": "resource bottleneck",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "process_breakdown",
        "critical_service_dependency_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "service_outage",
        "customer_harm"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "critical service delivery failure",
        "service degradation affects customer operations"
      ]
    },
    {
      "key": "critical_service_dependency_failure",
      "label": "Critical service dependency failure",
      "domain": "operational",
      "status": "active",
      "priorityScore": 74,
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "critical dependency failure",
          "strength": "medium"
        },
        {
          "text": "dependency failure",
          "strength": "medium"
        },
        {
          "text": "upstream service failure",
          "strength": "medium"
        },
        {
          "text": "shared service failure",
          "strength": "medium"
        },
        {
          "text": "core dependency unavailable",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "service_delivery_failure",
        "platform_instability"
      ],
      "canCoExistWith": [
        "service_delivery_failure"
      ],
      "canEscalateTo": [
        "dr_gap"
      ],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "operational_disruption",
        "backlog_growth"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "A critical upstream dependency fails and disrupts the service path",
        "A shared service outage creates a broader operational knock-on effect"
      ],
      "shortlistSeedThemes": [
        "shared service failure",
        "dependency outage",
        "service chain disruption"
      ],
      "examplePhrases": [
        "a shared identity service failure disrupts multiple dependent applications",
        "a critical upstream dependency becomes unavailable and delays core operations"
      ]
    },
    {
      "key": "backlog_escalation",
      "label": "Backlog escalation",
      "domain": "operational",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "service_delivery_failure",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "positiveSignals": [
        {
          "text": "backlog growth",
          "strength": "medium"
        },
        {
          "text": "backlog escalation",
          "strength": "medium"
        },
        {
          "text": "queue growth",
          "strength": "medium"
        },
        {
          "text": "deferred work",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "capacity_shortfall",
        "service_delivery_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "backlog_growth",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "backlog growth after disruption",
        "queue escalation delays delivery"
      ]
    },
    {
      "key": "dr_gap",
      "label": "DR gap",
      "domain": "business_continuity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "positiveSignals": [
        {
          "text": "no dr",
          "strength": "medium"
        },
        {
          "text": "without dr",
          "strength": "medium"
        },
        {
          "text": "disaster recovery gap",
          "strength": "medium"
        },
        {
          "text": "missing disaster recovery",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "failover_failure",
        "recovery_coordination_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "recovery_strain"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "there is no DR for the critical email system",
        "disaster recovery gap in a critical service"
      ]
    },
    {
      "key": "failover_failure",
      "label": "Failover failure",
      "domain": "business_continuity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "positiveSignals": [
        {
          "text": "failover failure",
          "strength": "medium"
        },
        {
          "text": "no failover",
          "strength": "medium"
        },
        {
          "text": "without failover",
          "strength": "medium"
        },
        {
          "text": "fallback not ready",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "dr_gap"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "recovery_strain"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "fallback operations are not ready",
        "no failover for the critical service"
      ]
    },
    {
      "key": "crisis_escalation",
      "label": "Crisis escalation",
      "domain": "business_continuity",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "recovery_coordination_failure",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "positiveSignals": [
        {
          "text": "crisis escalation",
          "strength": "medium"
        },
        {
          "text": "crisis management",
          "strength": "medium"
        },
        {
          "text": "major incident escalation",
          "strength": "medium"
        },
        {
          "text": "continuity escalation",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "recovery_coordination_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "crisis escalation after a continuity event",
        "major incident outgrows planned response"
      ]
    },
    {
      "key": "recovery_coordination_failure",
      "label": "Recovery coordination failure",
      "domain": "business_continuity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "positiveSignals": [
        {
          "text": "recovery coordination failure",
          "strength": "medium"
        },
        {
          "text": "recovery effort breaks down",
          "strength": "medium"
        },
        {
          "text": "restoration delayed",
          "strength": "medium"
        },
        {
          "text": "recovery team not aligned",
          "strength": "medium"
        },
        {
          "text": "crisis escalation",
          "strength": "medium"
        },
        {
          "text": "major incident escalation",
          "strength": "medium"
        },
        {
          "text": "crisis management",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "dr_gap",
        "failover_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "recovery_strain",
        "service_outage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "recovery coordination fails during outage",
        "restoration delays grow during the incident"
      ]
    },
    {
      "key": "counterparty_default",
      "label": "Counterparty default",
      "domain": "finance",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "positiveSignals": [
        {
          "text": "counterparty default",
          "strength": "medium"
        },
        {
          "text": "customer default",
          "strength": "medium"
        },
        {
          "text": "client default",
          "strength": "medium"
        },
        {
          "text": "bankruptcy",
          "strength": "medium"
        },
        {
          "text": "insolvency",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "liquidity_strain",
        "valuation_provisioning_shock"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "availability_attack"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "major client files for bankruptcy",
        "counterparty default weakens recoverability"
      ]
    },
    {
      "key": "liquidity_strain",
      "label": "Liquidity strain",
      "domain": "finance",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "positiveSignals": [
        {
          "text": "liquidity strain",
          "strength": "medium"
        },
        {
          "text": "cashflow strain",
          "strength": "medium"
        },
        {
          "text": "working capital pressure",
          "strength": "medium"
        },
        {
          "text": "short-term funding pressure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "counterparty_default",
        "valuation_provisioning_shock"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "availability_attack"
      ],
      "defaultOverlays": [
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "cashflow strain after client failure",
        "working capital pressure grows quickly"
      ]
    },
    {
      "key": "payment_control_failure",
      "label": "Payment control failure",
      "domain": "finance",
      "status": "active",
      "priorityScore": 84,
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "positiveSignals": [
        {
          "text": "payment approval control",
          "strength": "medium"
        },
        {
          "text": "control failed",
          "strength": "medium"
        },
        {
          "text": "approval gap",
          "strength": "medium"
        },
        {
          "text": "payment released incorrectly",
          "strength": "medium"
        },
        {
          "text": "direct monetary loss",
          "strength": "medium"
        },
        {
          "text": "payment process weakness",
          "strength": "medium"
        },
        {
          "text": "unauthorised funds transfer",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "permit breach",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "false invoice",
          "strength": "medium"
        },
        {
          "text": "invoice scam",
          "strength": "medium"
        },
        {
          "text": "fraudulent transfer",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "payment",
          "strength": "medium"
        },
        {
          "text": "funds transfer",
          "strength": "medium"
        },
        {
          "text": "treasury",
          "strength": "medium"
        },
        {
          "text": "invoice",
          "strength": "medium"
        },
        {
          "text": "accounts payable",
          "strength": "medium"
        },
        {
          "text": "approval",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "payment_fraud",
        "approval_override"
      ],
      "canCoExistWith": [
        "policy_breach"
      ],
      "canEscalateTo": [
        "payment_fraud"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "forced_labour_modern_slavery"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "control_breakdown",
        "regulatory_scrutiny"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "data_exposure",
        "service_outage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "weak payment approval controls allow unauthorised funds transfer",
        "payment process weakness releases funds incorrectly",
        "approval gap leads to direct monetary loss"
      ]
    },
    {
      "key": "valuation_provisioning_shock",
      "label": "Valuation / provisioning shock",
      "domain": "finance",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "positiveSignals": [
        {
          "text": "provisioning shock",
          "strength": "medium"
        },
        {
          "text": "valuation shock",
          "strength": "medium"
        },
        {
          "text": "provisioning increase",
          "strength": "medium"
        },
        {
          "text": "write-down",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "counterparty_default",
        "liquidity_strain"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "availability_attack"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "regulatory_scrutiny"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "valuation shock forces provision increase",
        "unexpected write-down changes provisioning"
      ]
    },
    {
      "key": "invoice_fraud",
      "label": "Invoice fraud",
      "domain": "fraud_integrity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "positiveSignals": [
        {
          "text": "invoice fraud",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "false invoice",
          "strength": "medium"
        },
        {
          "text": "duplicate invoice scam",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "invoice",
          "strength": "medium"
        },
        {
          "text": "accounts payable",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "payment_fraud",
        "payment_control_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "control_breakdown",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "fake invoice submitted for payment",
        "invoice scam bypasses controls"
      ]
    },
    {
      "key": "payment_fraud",
      "label": "Payment fraud",
      "domain": "fraud_integrity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "positiveSignals": [
        {
          "text": "payment fraud",
          "strength": "medium"
        },
        {
          "text": "fraudulent transfer",
          "strength": "medium"
        },
        {
          "text": "deception",
          "strength": "medium"
        },
        {
          "text": "payment manipulation",
          "strength": "medium"
        },
        {
          "text": "social engineering payment",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "payment",
          "strength": "medium"
        },
        {
          "text": "funds transfer",
          "strength": "medium"
        },
        {
          "text": "wire transfer",
          "strength": "medium"
        },
        {
          "text": "release of funds",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "payment_control_failure",
        "approval_override"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "control_breakdown",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "fraudulent payment released",
        "deceptive funds transfer",
        "payment manipulation caused loss"
      ]
    },
    {
      "key": "bribery_corruption",
      "label": "Bribery / corruption",
      "domain": "fraud_integrity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "positiveSignals": [
        {
          "text": "bribery",
          "strength": "medium"
        },
        {
          "text": "corruption",
          "strength": "medium"
        },
        {
          "text": "kickback",
          "strength": "medium"
        },
        {
          "text": "improper payment",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "website outage",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "approval_override",
        "collusion"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "bribery allegation in contract award",
        "kickback scheme around approvals"
      ]
    },
    {
      "key": "approval_override",
      "label": "Approval override abuse",
      "domain": "fraud_integrity",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "payment_control_failure",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "positiveSignals": [
        {
          "text": "approval override",
          "strength": "medium"
        },
        {
          "text": "approval abuse",
          "strength": "medium"
        },
        {
          "text": "bypass approval",
          "strength": "medium"
        },
        {
          "text": "override control",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "permit breach",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "payment_fraud",
        "payment_control_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "direct_monetary_loss",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "approval override releases payment",
        "control override abused for gain"
      ]
    },
    {
      "key": "collusion",
      "label": "Collusion",
      "domain": "fraud_integrity",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "positiveSignals": [
        {
          "text": "collusion",
          "strength": "medium"
        },
        {
          "text": "bid rigging",
          "strength": "medium"
        },
        {
          "text": "cartel",
          "strength": "medium"
        },
        {
          "text": "price fixing",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "privacy breach",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "bribery_corruption"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "supplier collusion distorts the bid",
        "price-fixing scheme inflates cost"
      ]
    },
    {
      "key": "policy_breach",
      "label": "Policy breach",
      "domain": "compliance",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "compliance",
      "positiveSignals": [
        {
          "text": "policy breach",
          "strength": "medium"
        },
        {
          "text": "policy violation",
          "strength": "medium"
        },
        {
          "text": "non-compliance",
          "strength": "medium"
        },
        {
          "text": "obligation failure",
          "strength": "medium"
        },
        {
          "text": "control non-compliance",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "supplier delay",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "regulatory_filing_failure",
        "privacy_non_compliance"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "policy breach creates assurance challenge",
        "control non-compliance surfaces in oversight"
      ]
    },
    {
      "key": "privacy_non_compliance",
      "label": "Privacy non-compliance",
      "domain": "compliance",
      "status": "active",
      "priorityScore": 82,
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "positiveSignals": [
        {
          "text": "privacy obligations",
          "strength": "medium"
        },
        {
          "text": "retention breach",
          "strength": "medium"
        },
        {
          "text": "unlawful processing",
          "strength": "medium"
        },
        {
          "text": "data protection obligations",
          "strength": "medium"
        },
        {
          "text": "processing without lawful basis",
          "strength": "medium"
        },
        {
          "text": "privacy non-compliance",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "website flood",
          "strength": "strong"
        },
        {
          "text": "supplier slippage",
          "strength": "medium"
        },
        {
          "text": "bribery",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "leaked data",
          "strength": "strong"
        },
        {
          "text": "stolen data",
          "strength": "strong"
        },
        {
          "text": "exposed records",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "privacy",
          "strength": "medium"
        },
        {
          "text": "data protection",
          "strength": "medium"
        },
        {
          "text": "lawful basis",
          "strength": "medium"
        },
        {
          "text": "processing",
          "strength": "medium"
        },
        {
          "text": "retention",
          "strength": "medium"
        },
        {
          "text": "personal data",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "policy_breach",
        "data_disclosure"
      ],
      "canCoExistWith": [
        "records_retention_non_compliance",
        "cross_border_transfer_non_compliance"
      ],
      "canEscalateTo": [
        "data_disclosure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage",
        "bribery_corruption"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "data_exposure",
        "service_outage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "privacy obligations were breached by unlawful processing",
        "retention breach exposes a data protection issue",
        "processing without lawful basis triggers privacy concern"
      ]
    },
    {
      "key": "records_retention_non_compliance",
      "label": "Records retention non-compliance",
      "domain": "compliance",
      "status": "active",
      "priorityScore": 76,
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "positiveSignals": [
        {
          "text": "records retention failure",
          "strength": "medium"
        },
        {
          "text": "retention breach",
          "strength": "medium"
        },
        {
          "text": "records kept too long",
          "strength": "medium"
        },
        {
          "text": "deletion obligations not met",
          "strength": "medium"
        },
        {
          "text": "retention schedule breach",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "website flood",
          "strength": "strong"
        },
        {
          "text": "supplier slippage",
          "strength": "medium"
        },
        {
          "text": "bribery",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "leaked data",
          "strength": "strong"
        },
        {
          "text": "stolen data",
          "strength": "strong"
        },
        {
          "text": "exposed records",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "retention",
          "strength": "medium"
        },
        {
          "text": "records",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "privacy_non_compliance",
        "policy_breach"
      ],
      "canCoExistWith": [
        "cross_border_transfer_non_compliance"
      ],
      "canEscalateTo": [
        "legal_exposure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "Records are retained or deleted outside required obligations",
        "Retention governance fails and creates regulatory exposure"
      ],
      "shortlistSeedThemes": [
        "retention failure",
        "records governance",
        "deletion control weakness"
      ],
      "examplePhrases": [
        "records are kept beyond the permitted retention period",
        "deletion obligations are not met for regulated records"
      ]
    },
    {
      "key": "cross_border_transfer_non_compliance",
      "label": "Cross-border transfer non-compliance",
      "domain": "compliance",
      "status": "active",
      "priorityScore": 77,
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "positiveSignals": [
        {
          "text": "cross-border transfer",
          "strength": "medium"
        },
        {
          "text": "international transfer restriction",
          "strength": "medium"
        },
        {
          "text": "data transfer obligations",
          "strength": "medium"
        },
        {
          "text": "transfer without safeguards",
          "strength": "medium"
        },
        {
          "text": "transfer impact assessment missing",
          "strength": "medium"
        },
        {
          "text": "data residency breach",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "website flood",
          "strength": "strong"
        },
        {
          "text": "supplier slippage",
          "strength": "medium"
        },
        {
          "text": "bribery",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "leaked data",
          "strength": "strong"
        },
        {
          "text": "stolen data",
          "strength": "strong"
        },
        {
          "text": "exposed records",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "transfer",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "privacy_non_compliance",
        "policy_breach"
      ],
      "canCoExistWith": [
        "records_retention_non_compliance"
      ],
      "canEscalateTo": [
        "regulatory_filing_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage",
        "bribery_corruption"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "Cross-border transfer controls fail and create privacy exposure",
        "Data moves internationally without the safeguards the obligation requires"
      ],
      "shortlistSeedThemes": [
        "cross-border transfer breach",
        "privacy safeguards missing",
        "international transfer exposure"
      ],
      "examplePhrases": [
        "personal data is transferred cross-border without the required safeguards",
        "an international data transfer occurs without lawful approval or assessment"
      ]
    },
    {
      "key": "regulatory_filing_failure",
      "label": "Regulatory filing failure",
      "domain": "regulatory",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "regulatory",
      "lensKey": "regulatory",
      "lensLabel": "Regulatory",
      "functionKey": "compliance",
      "estimatePresetKey": "regulatory",
      "positiveSignals": [
        {
          "text": "regulatory filing",
          "strength": "medium"
        },
        {
          "text": "missed filing",
          "strength": "medium"
        },
        {
          "text": "late filing",
          "strength": "medium"
        },
        {
          "text": "notification failure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "supplier delay",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "policy_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "late regulatory filing",
        "notification failure to regulator"
      ]
    },
    {
      "key": "sanctions_breach",
      "label": "Sanctions breach",
      "domain": "regulatory",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "regulatory",
      "lensKey": "regulatory",
      "lensLabel": "Regulatory",
      "functionKey": "compliance",
      "estimatePresetKey": "regulatory",
      "positiveSignals": [
        {
          "text": "sanctions breach",
          "strength": "medium"
        },
        {
          "text": "restricted party",
          "strength": "medium"
        },
        {
          "text": "entity list",
          "strength": "medium"
        },
        {
          "text": "export control breach",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "supplier slippage",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "market_access_restriction"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "screening failure creates a sanctions breach",
        "entity-list restriction was missed"
      ]
    },
    {
      "key": "licensing_permit_issue",
      "label": "Licensing / permit issue",
      "domain": "regulatory",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "regulatory",
      "lensKey": "regulatory",
      "lensLabel": "Regulatory",
      "functionKey": "compliance",
      "estimatePresetKey": "regulatory",
      "positiveSignals": [
        {
          "text": "licence issue",
          "strength": "medium"
        },
        {
          "text": "license issue",
          "strength": "medium"
        },
        {
          "text": "permit issue",
          "strength": "medium"
        },
        {
          "text": "permit breach",
          "strength": "medium"
        },
        {
          "text": "licensing failure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "policy_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "permit breach threatens operation",
        "licensing failure creates regulator attention"
      ]
    },
    {
      "key": "contract_liability",
      "label": "Contract liability",
      "domain": "legal_contract",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "legal-contract",
      "lensKey": "legal-contract",
      "lensLabel": "Legal / contract",
      "functionKey": "compliance",
      "estimatePresetKey": "legalContract",
      "positiveSignals": [
        {
          "text": "contract liability",
          "strength": "medium"
        },
        {
          "text": "indemnity",
          "strength": "medium"
        },
        {
          "text": "terms breach",
          "strength": "medium"
        },
        {
          "text": "contract dispute",
          "strength": "medium"
        },
        {
          "text": "liability claim",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "legal_exposure",
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "contract liability emerges from failed obligation",
        "indemnity clause creates exposure"
      ]
    },
    {
      "key": "single_source_dependency",
      "label": "Single-source dependency",
      "domain": "procurement",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "positiveSignals": [
        {
          "text": "single source",
          "strength": "medium"
        },
        {
          "text": "sole source",
          "strength": "medium"
        },
        {
          "text": "supplier concentration",
          "strength": "medium"
        },
        {
          "text": "single-source dependency",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness",
        "delivery_slippage"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "single-source dependency on a critical supplier",
        "sole source drives delivery risk"
      ]
    },
    {
      "key": "supplier_concentration_risk",
      "label": "Supplier concentration risk",
      "domain": "procurement",
      "status": "active",
      "priorityScore": 73,
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "positiveSignals": [
        {
          "text": "supplier concentration",
          "strength": "medium"
        },
        {
          "text": "concentrated spend",
          "strength": "medium"
        },
        {
          "text": "too few suppliers",
          "strength": "medium"
        },
        {
          "text": "dependency on one supplier group",
          "strength": "medium"
        },
        {
          "text": "category concentration risk",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "unlawful processing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "single_source_dependency",
        "supplier_control_weakness"
      ],
      "canCoExistWith": [
        "delivery_slippage"
      ],
      "canEscalateTo": [
        "delivery_slippage",
        "supplier_insolvency"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "Procurement concentration leaves too little supplier fallback",
        "Commercial dependency is concentrated into too few suppliers"
      ],
      "shortlistSeedThemes": [
        "supplier concentration",
        "commercial dependency",
        "limited fallback sourcing"
      ],
      "examplePhrases": [
        "spend is concentrated across too few critical suppliers",
        "supplier concentration risk leaves little fallback when a category fails"
      ]
    },
    {
      "key": "delivery_slippage",
      "label": "Delivery slippage",
      "domain": "supply_chain",
      "status": "active",
      "priorityScore": 83,
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "positiveSignals": [
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "missed delivery date",
          "strength": "medium"
        },
        {
          "text": "delayed deployment",
          "strength": "medium"
        },
        {
          "text": "delayed programme milestone",
          "strength": "medium"
        },
        {
          "text": "logistics disruption",
          "strength": "medium"
        },
        {
          "text": "dependent projects delayed",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "botnet",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "leaked records",
          "strength": "medium"
        },
        {
          "text": "privacy disclosure",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "programme_delivery_slippage",
        "supplier_control_weakness"
      ],
      "canCoExistWith": [
        "single_source_dependency",
        "supplier_concentration_risk"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "greenwashing_disclosure_gap"
      ],
      "defaultOverlays": [
        "backlog_growth",
        "operational_disruption",
        "third_party_dependency"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "direct_monetary_loss",
        "regulatory_scrutiny"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "key supplier misses committed delivery date",
        "dependent projects are delayed by a delivery miss",
        "infrastructure deployment slips because the supplier is late"
      ]
    },
    {
      "key": "logistics_disruption",
      "label": "Logistics disruption",
      "domain": "supply_chain",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "positiveSignals": [
        {
          "text": "logistics disruption",
          "strength": "medium"
        },
        {
          "text": "shipment delay",
          "strength": "medium"
        },
        {
          "text": "transport disruption",
          "strength": "medium"
        },
        {
          "text": "routing disruption",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "botnet",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "leaked records",
          "strength": "medium"
        },
        {
          "text": "privacy disclosure",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "delivery_slippage"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "backlog_growth",
        "third_party_dependency"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "shipment delay disrupts delivery commitments",
        "routing disruption blocks upstream supply"
      ]
    },
    {
      "key": "supplier_control_weakness",
      "label": "Supplier control weakness",
      "domain": "third_party",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "third-party",
      "lensLabel": "Third-party",
      "functionKey": "procurement",
      "estimatePresetKey": "thirdParty",
      "positiveSignals": [
        {
          "text": "supplier control weakness",
          "strength": "medium"
        },
        {
          "text": "weak supplier governance",
          "strength": "medium"
        },
        {
          "text": "vendor control gap",
          "strength": "medium"
        },
        {
          "text": "inherited supplier weakness",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "vendor_access_weakness",
        "single_source_dependency"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "weak supplier governance creates control risk",
        "vendor control gap becomes visible"
      ]
    },
    {
      "key": "vendor_access_weakness",
      "label": "Vendor access weakness",
      "domain": "third_party",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "third-party",
      "lensLabel": "Third-party",
      "functionKey": "procurement",
      "estimatePresetKey": "thirdParty",
      "positiveSignals": [
        {
          "text": "vendor access weakness",
          "strength": "medium"
        },
        {
          "text": "third-party access",
          "strength": "medium"
        },
        {
          "text": "supplier access",
          "strength": "medium"
        },
        {
          "text": "partner access control",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "shipment delay",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness",
        "identity_compromise"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "control_breakdown"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "vendor access into the environment is weakly controlled",
        "third-party connection creates inherited access risk"
      ]
    },
    {
      "key": "supplier_insolvency",
      "label": "Supplier insolvency",
      "domain": "third_party",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "third-party",
      "lensLabel": "Third-party",
      "functionKey": "procurement",
      "estimatePresetKey": "thirdParty",
      "positiveSignals": [
        {
          "text": "supplier insolvency",
          "strength": "medium"
        },
        {
          "text": "vendor insolvency",
          "strength": "medium"
        },
        {
          "text": "supplier bankruptcy",
          "strength": "medium"
        },
        {
          "text": "supplier failure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "delivery_slippage",
        "contract_liability"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "operational_disruption",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "critical supplier becomes insolvent",
        "vendor bankruptcy threatens service delivery"
      ]
    },
    {
      "key": "programme_delivery_slippage",
      "label": "Programme delivery slippage",
      "domain": "strategic_transformation",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "transformation-delivery",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "transformationDelivery",
      "positiveSignals": [
        {
          "text": "programme delivery slip",
          "strength": "medium"
        },
        {
          "text": "project delivery delay",
          "strength": "medium"
        },
        {
          "text": "deployment delayed",
          "strength": "medium"
        },
        {
          "text": "milestone slip",
          "strength": "medium"
        },
        {
          "text": "go-live delay",
          "strength": "medium"
        },
        {
          "text": "dependent projects delayed",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "botnet",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "leaked records",
          "strength": "medium"
        },
        {
          "text": "privacy disclosure",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "delivery_slippage",
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "backlog_growth",
        "third_party_dependency"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "dependent business projects are delayed",
        "go-live is pushed back by a supplier miss",
        "programme milestone slips after delayed deployment"
      ]
    },
    {
      "key": "integration_failure",
      "label": "Integration failure",
      "domain": "strategic_transformation",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "investment-jv",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "investmentJv",
      "positiveSignals": [
        {
          "text": "integration failure",
          "strength": "medium"
        },
        {
          "text": "integration risk",
          "strength": "medium"
        },
        {
          "text": "merger integration",
          "strength": "medium"
        },
        {
          "text": "synergy shortfall",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "benefits_realisation_failure",
        "portfolio_execution_drift"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "integration failure erodes synergy",
        "post-deal integration risk grows"
      ]
    },
    {
      "key": "portfolio_execution_drift",
      "label": "Portfolio execution drift",
      "domain": "strategic_transformation",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "strategic",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "strategic",
      "positiveSignals": [
        {
          "text": "portfolio execution drift",
          "strength": "medium"
        },
        {
          "text": "strategic drift",
          "strength": "medium"
        },
        {
          "text": "execution drift",
          "strength": "medium"
        },
        {
          "text": "portfolio reprioritisation failure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "bribery",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "portfolio execution drifts from plan",
        "strategic initiative slips across the portfolio"
      ]
    },
    {
      "key": "benefits_realisation_failure",
      "label": "Benefits realisation failure",
      "domain": "strategic_transformation",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "strategic",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "strategic",
      "positiveSignals": [
        {
          "text": "benefits realisation failure",
          "strength": "medium"
        },
        {
          "text": "benefits realization failure",
          "strength": "medium"
        },
        {
          "text": "expected benefits not realised",
          "strength": "medium"
        },
        {
          "text": "benefits shortfall",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "programme_delivery_slippage"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "programme benefits are not being realised",
        "expected value from the change is slipping"
      ]
    },
    {
      "key": "market_access_restriction",
      "label": "Market access restriction",
      "domain": "strategic_transformation",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "geopolitical",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "geopolitical",
      "positiveSignals": [
        {
          "text": "market access restriction",
          "strength": "medium"
        },
        {
          "text": "cross-border restriction",
          "strength": "medium"
        },
        {
          "text": "tariff shock",
          "strength": "medium"
        },
        {
          "text": "entity list",
          "strength": "medium"
        },
        {
          "text": "trade restriction",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "payment approval",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "sanctions_breach",
        "logistics_disruption"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "regulatory_scrutiny"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "sanctions or tariff changes restrict market access",
        "cross-border restriction blocks execution"
      ]
    },
    {
      "key": "integration_programme_failure",
      "label": "Integration programme failure",
      "domain": "strategic_transformation",
      "status": "active",
      "priorityScore": 75,
      "preferredFamilyKey": "",
      "legacyKey": "transformation-delivery",
      "lensKey": "transformation-delivery",
      "lensLabel": "Transformation delivery",
      "functionKey": "strategic",
      "estimatePresetKey": "transformationDelivery",
      "positiveSignals": [
        {
          "text": "integration programme failure",
          "strength": "medium"
        },
        {
          "text": "integration program failure",
          "strength": "medium"
        },
        {
          "text": "post-merger integration slips",
          "strength": "medium"
        },
        {
          "text": "integration workstream failure",
          "strength": "medium"
        },
        {
          "text": "integration governance breakdown",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "forced labour",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "integration_failure",
        "programme_delivery_slippage",
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [
        "portfolio_execution_drift"
      ],
      "canEscalateTo": [
        "benefits_realisation_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "backlog_growth",
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "Integration programme governance breaks down across key workstreams",
        "The operating-model integration fails to hold delivery dependencies together"
      ],
      "shortlistSeedThemes": [
        "integration programme drift",
        "workstream coordination failure",
        "post-merger delivery pressure"
      ],
      "examplePhrases": [
        "the post-merger integration programme loses control of key workstreams",
        "integration governance breaks down and delays target operating model delivery"
      ]
    },
    {
      "key": "forced_labour_modern_slavery",
      "label": "Forced labour / modern slavery",
      "domain": "esg_hse_people",
      "status": "active",
      "priorityScore": 82,
      "preferredFamilyKey": "",
      "legacyKey": "esg",
      "lensKey": "esg",
      "lensLabel": "ESG",
      "functionKey": "strategic",
      "estimatePresetKey": "esg",
      "positiveSignals": [
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "forced labor",
          "strength": "medium"
        },
        {
          "text": "modern slavery",
          "strength": "medium"
        },
        {
          "text": "child labour",
          "strength": "medium"
        },
        {
          "text": "child labor",
          "strength": "medium"
        },
        {
          "text": "human rights abuse",
          "strength": "medium"
        },
        {
          "text": "worker exploitation",
          "strength": "medium"
        },
        {
          "text": "exploitative labour",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        },
        {
          "text": "website flood",
          "strength": "medium"
        },
        {
          "text": "single source",
          "strength": "medium"
        },
        {
          "text": "supplier concentration",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "forced labor",
          "strength": "medium"
        },
        {
          "text": "modern slavery",
          "strength": "medium"
        },
        {
          "text": "child labour",
          "strength": "medium"
        },
        {
          "text": "child labor",
          "strength": "medium"
        },
        {
          "text": "human rights",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness",
        "policy_breach"
      ],
      "canCoExistWith": [
        "supplier_control_weakness",
        "contract_liability"
      ],
      "canEscalateTo": [
        "regulatory_scrutiny",
        "contract_liability"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "payment_control_failure",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "reputational_damage",
        "third_party_dependency"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "modern slavery allegations emerge in a supplier workforce",
        "forced labour practices appear in the supply base"
      ]
    },
    {
      "key": "greenwashing_disclosure_gap",
      "label": "Greenwashing / disclosure gap",
      "domain": "esg_hse_people",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "esg",
      "lensKey": "esg",
      "lensLabel": "ESG",
      "functionKey": "strategic",
      "estimatePresetKey": "esg",
      "positiveSignals": [
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "sustainability disclosure",
          "strength": "medium"
        },
        {
          "text": "climate disclosure",
          "strength": "medium"
        },
        {
          "text": "claim substantiation",
          "strength": "medium"
        },
        {
          "text": "esg disclosure gap",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "invoice fraud",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "sustainability disclosure",
          "strength": "medium"
        },
        {
          "text": "climate disclosure",
          "strength": "medium"
        },
        {
          "text": "claim substantiation",
          "strength": "medium"
        }
      ],
      "allowedSecondaryFamilies": [
        "policy_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "delivery_slippage"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "reputational_damage",
        "legal_exposure"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "greenwashing concern emerges",
        "sustainability disclosure cannot be supported"
      ]
    },
    {
      "key": "safety_incident",
      "label": "Safety incident",
      "domain": "esg_hse_people",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "hse",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "hse",
      "positiveSignals": [
        {
          "text": "safety incident",
          "strength": "medium"
        },
        {
          "text": "injury",
          "strength": "medium"
        },
        {
          "text": "unsafe condition",
          "strength": "medium"
        },
        {
          "text": "worker harmed",
          "strength": "medium"
        },
        {
          "text": "near miss",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "invoice fraud",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "workforce_fatigue_staffing_weakness"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "regulatory_scrutiny"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "safety incident injures a worker",
        "unsafe condition leads to operational interruption"
      ]
    },
    {
      "key": "environmental_spill",
      "label": "Environmental spill",
      "domain": "esg_hse_people",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "hse",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "hse",
      "positiveSignals": [
        {
          "text": "environmental spill",
          "strength": "medium"
        },
        {
          "text": "spill",
          "strength": "medium"
        },
        {
          "text": "release to environment",
          "strength": "medium"
        },
        {
          "text": "environmental incident",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "invoice fraud",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "safety_incident"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "legal_exposure",
        "regulatory_scrutiny",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "environmental spill triggers response",
        "release event causes regulator concern"
      ]
    },
    {
      "key": "workforce_fatigue_staffing_weakness",
      "label": "Workforce fatigue / staffing weakness",
      "domain": "esg_hse_people",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "positiveSignals": [
        {
          "text": "workforce fatigue",
          "strength": "medium"
        },
        {
          "text": "staffing weakness",
          "strength": "medium"
        },
        {
          "text": "attrition",
          "strength": "medium"
        },
        {
          "text": "understaffed",
          "strength": "medium"
        },
        {
          "text": "worker welfare concern",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "invoice fraud",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "safety_incident",
        "critical_staff_dependency"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "staffing weakness affects safe delivery",
        "fatigue undermines stable operations"
      ]
    },
    {
      "key": "critical_staff_dependency",
      "label": "Critical staff dependency",
      "domain": "esg_hse_people",
      "status": "active",
      "priorityScore": 72,
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "positiveSignals": [
        {
          "text": "critical staff dependency",
          "strength": "medium"
        },
        {
          "text": "single point of failure in the team",
          "strength": "medium"
        },
        {
          "text": "key-person dependency",
          "strength": "medium"
        },
        {
          "text": "too few trained staff",
          "strength": "medium"
        },
        {
          "text": "only one person knows",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "workforce_fatigue_staffing_weakness",
        "critical_service_dependency_failure"
      ],
      "canCoExistWith": [
        "workforce_fatigue_staffing_weakness"
      ],
      "canEscalateTo": [
        "safety_incident",
        "service_delivery_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "recovery_strain"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [
        "A key-person dependency weakens resilience across a critical service",
        "Too few trained staff hold the operating model together"
      ],
      "shortlistSeedThemes": [
        "key-person dependency",
        "people resilience gap",
        "knowledge concentration"
      ],
      "examplePhrases": [
        "only one critical specialist can restore the platform",
        "delivery depends on a very small number of trained staff"
      ]
    },
    {
      "key": "perimeter_breach",
      "label": "Perimeter breach",
      "domain": "physical_ot",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "physical-security",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "physicalSecurity",
      "positiveSignals": [
        {
          "text": "perimeter breach",
          "strength": "medium"
        },
        {
          "text": "site intrusion",
          "strength": "medium"
        },
        {
          "text": "intrusion into facility",
          "strength": "medium"
        },
        {
          "text": "perimeter failure",
          "strength": "medium"
        },
        {
          "text": "badge control lapse",
          "strength": "medium"
        },
        {
          "text": "visitor management failure",
          "strength": "medium"
        },
        {
          "text": "facility access lapse",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "reputational_damage"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "site intrusion bypasses the perimeter",
        "perimeter breach disrupts operations"
      ]
    },
    {
      "key": "facility_access_lapse",
      "label": "Facility access lapse",
      "domain": "physical_ot",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "perimeter_breach",
      "legacyKey": "physical-security",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "physicalSecurity",
      "positiveSignals": [
        {
          "text": "facility access lapse",
          "strength": "medium"
        },
        {
          "text": "badge control lapse",
          "strength": "medium"
        },
        {
          "text": "visitor management failure",
          "strength": "medium"
        },
        {
          "text": "facility breach",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "perimeter_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "control_breakdown",
        "operational_disruption"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "badge control lapse exposes the site",
        "visitor management failure creates facility risk"
      ]
    },
    {
      "key": "ot_resilience_failure",
      "label": "OT resilience failure",
      "domain": "physical_ot",
      "status": "active",
      "priorityScore": 50,
      "preferredFamilyKey": "",
      "legacyKey": "ot-resilience",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "otResilience",
      "positiveSignals": [
        {
          "text": "ot resilience failure",
          "strength": "medium"
        },
        {
          "text": "industrial control weakness",
          "strength": "medium"
        },
        {
          "text": "ics instability",
          "strength": "medium"
        },
        {
          "text": "scada weakness",
          "strength": "medium"
        },
        {
          "text": "site systems instability",
          "strength": "medium"
        },
        {
          "text": "industrial control instability",
          "strength": "medium"
        },
        {
          "text": "control room instability",
          "strength": "medium"
        },
        {
          "text": "ics outage",
          "strength": "medium"
        },
        {
          "text": "scada disruption",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "fake invoice",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "recovery_strain"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "OT resilience gap destabilises site systems",
        "industrial control weakness affects operations"
      ]
    },
    {
      "key": "industrial_control_instability",
      "label": "Industrial control instability",
      "domain": "physical_ot",
      "status": "compatibility_only",
      "priorityScore": 50,
      "preferredFamilyKey": "ot_resilience_failure",
      "legacyKey": "ot-resilience",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "otResilience",
      "positiveSignals": [
        {
          "text": "industrial control instability",
          "strength": "medium"
        },
        {
          "text": "control room instability",
          "strength": "medium"
        },
        {
          "text": "ics outage",
          "strength": "medium"
        },
        {
          "text": "scada disruption",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "recovery_strain"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "examplePhrases": [
        "control room instability affects operations",
        "ICS disruption creates site outage"
      ]
    }
  ],
  "unsupportedSignals": [
    {
      "key": "ai_model_risk",
      "pattern": "(?:^|[^a-z0-9])ai(?:$|[^a-z0-9])|model risk|responsible ai|hallucination|algorithmic bias|training data|\\bllm\\b|\\bgenai\\b",
      "label": "AI / model risk"
    }
  ]
};
})(typeof window !== 'undefined' ? window : globalThis);
