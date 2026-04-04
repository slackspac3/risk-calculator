(function (globalScope) {
  'use strict';
  globalScope.__SCENARIO_TAXONOMY_PROJECTION_DATA__ = {
  "taxonomyVersion": "phase1.1.4-2026-04-04",
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
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 92,
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
      "typicalAssets": [
        "identity system",
        "tenant",
        "mailbox",
        "admin account",
        "directory"
      ],
      "typicalCauses": [
        "credential theft",
        "phishing",
        "token theft",
        "password reuse"
      ],
      "typicalConsequences": [
        "unauthorized access",
        "control change",
        "service disruption",
        "fraud exposure"
      ],
      "preferredRiskThemes": [
        "identity takeover",
        "privilege abuse",
        "tenant compromise"
      ],
      "defaultMechanisms": [
        "credential_theft",
        "token_theft",
        "privileged_access_abuse",
        "control_change"
      ],
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
      "cannotBePrimaryWith": [
        "payment_control_failure",
        "payment_fraud",
        "invoice_fraud"
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
      "examplePhrases": [
        "Azure global admin credentials discovered on the dark web",
        "compromised privileged account used to access the tenant",
        "mailbox takeover enabled unauthorized approvals"
      ],
      "counterExamples": [
        "a supplier missed delivery dates for hardware refresh",
        "a volumetric DDoS attack flooded the website"
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
      "fallbackNarrativePatterns": [
        "The event starts with account or tenant compromise and any financial, operational, or data impacts follow from that identity path.",
        "Keep the scenario in the identity-compromise lane unless the text explicitly moves to another primary event family."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "identity",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "key": "identity_compromise",
      "label": "Identity compromise",
      "domain": "cyber",
      "description": "Compromise or takeover of user, privileged, tenant, or mailbox identity leading to unauthorized access or control."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "mailbox",
        "user account",
        "approval workflow"
      ],
      "typicalCauses": [
        "phishing lure",
        "spoofing",
        "social engineering"
      ],
      "typicalConsequences": [
        "fraud exposure",
        "unauthorized approvals",
        "operational disruption"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "payment_fraud",
        "invoice_fraud"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "spoofed executive email",
        "phishing campaign captures approvals",
        "business email compromise attempt"
      ],
      "counterExamples": [
        "customer portal goes down under traffic flood",
        "supplier misses committed milestone"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "phishing",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "phishing",
      "key": "phishing_bec",
      "label": "Phishing / BEC",
      "domain": "cyber",
      "description": "Trust-channel compromise through phishing, spoofing, or business-email-compromise patterns."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "executive mailbox",
        "finance mailbox",
        "approval workflow"
      ],
      "typicalCauses": [
        "mailbox compromise",
        "spoofing",
        "credential theft"
      ],
      "typicalConsequences": [
        "fraud exposure",
        "control breakdown",
        "operational disruption"
      ],
      "preferredRiskThemes": [
        "approval-path compromise",
        "mailbox trust abuse",
        "payment or approval manipulation"
      ],
      "defaultMechanisms": [
        "credential_theft",
        "approval_override",
        "process_bypass"
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
      "cannotBePrimaryWith": [
        "payment_control_failure"
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
      "examplePhrases": [
        "a compromised executive mailbox sends false payment instructions",
        "business email compromise hijacks an approval path",
        "spoofed email triggers an unauthorised release of funds"
      ],
      "counterExamples": [
        "hostile traffic overwhelms the public website",
        "a supplier misses the committed hardware delivery date"
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
      "fallbackNarrativePatterns": [
        "A trusted mailbox or email route is compromised and used to trigger unauthorised workflow actions.",
        "The event path stays in the compromise of the email trust channel rather than a generic finance lens."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "phishing",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "phishing",
      "key": "business_email_compromise",
      "label": "Business email compromise",
      "domain": "cyber",
      "description": "Compromise of a mailbox or trusted email path that directly targets approvals, payments, or sensitive workflow action."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "servers",
        "endpoints",
        "shared drives"
      ],
      "typicalCauses": [
        "malware execution",
        "initial access compromise"
      ],
      "typicalConsequences": [
        "service outage",
        "recovery strain",
        "data exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "data_disclosure",
        "endpoint_compromise"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "ransomware encrypts critical services",
        "extortion event after initial access"
      ],
      "counterExamples": [
        "forced labour allegation in a supplier workforce",
        "regulatory filing submitted late"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ransomware",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "ransomware",
      "key": "ransomware",
      "label": "Ransomware",
      "domain": "cyber",
      "description": "Malware or extortion event that encrypts systems and disrupts availability."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 90,
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
      "typicalAssets": [
        "website",
        "public portal",
        "online service",
        "internet-facing application"
      ],
      "typicalCauses": [
        "botnet traffic",
        "volumetric attack",
        "application-layer flooding"
      ],
      "typicalConsequences": [
        "service outage",
        "customer harm",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "traffic saturation",
        "internet-facing outage",
        "customer channel disruption"
      ],
      "defaultMechanisms": [
        "hostile_traffic_saturation"
      ],
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
      "cannotBePrimaryWith": [
        "dr_gap",
        "failover_failure",
        "policy_breach",
        "privacy_non_compliance"
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
      "examplePhrases": [
        "DDoS traffic overwhelms the public website",
        "volumetric attack floods online services",
        "botnet traffic causes customer-facing services to crash"
      ],
      "counterExamples": [
        "weak payment approval controls allow an incorrect transfer",
        "modern slavery allegations emerge in a supplier workforce"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "availability-attack",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "general",
      "key": "availability_attack",
      "label": "Availability attack",
      "domain": "cyber",
      "description": "Hostile traffic saturation or denial-of-service activity degrading internet-facing service availability."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "cloud tenant",
        "storage bucket",
        "administrative plane"
      ],
      "typicalCauses": [
        "misconfiguration",
        "weak cloud controls",
        "exposed admin surface"
      ],
      "typicalConsequences": [
        "control breakdown",
        "service outage",
        "data exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "data_disclosure",
        "privileged_misuse"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "public cloud storage exposure",
        "cloud admin control weakness",
        "tenant misconfiguration opens access"
      ],
      "counterExamples": [
        "key supplier misses a committed delivery date",
        "payment released without valid approval"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "cloud",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "cloud",
      "key": "cloud_control_failure",
      "label": "Cloud control failure",
      "domain": "cyber",
      "description": "Cloud administrative or configuration weakness causing misuse, exposure, or control loss."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
      "positiveSignals": [
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "data breach",
          "strength": "strong"
        },
        {
          "text": "personal data breach",
          "strength": "strong"
        },
        {
          "text": "unauthorized disclosure",
          "strength": "strong"
        },
        {
          "text": "unauthorised disclosure",
          "strength": "strong"
        },
        {
          "text": "external disclosure",
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
          "text": "data breach",
          "strength": "strong"
        },
        {
          "text": "personal data breach",
          "strength": "strong"
        },
        {
          "text": "unauthorized disclosure",
          "strength": "strong"
        },
        {
          "text": "unauthorised disclosure",
          "strength": "strong"
        },
        {
          "text": "external disclosure",
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
      "typicalAssets": [
        "customer records",
        "sensitive data",
        "confidential files"
      ],
      "typicalCauses": [
        "exfiltration",
        "breach",
        "misrouted disclosure"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "customer harm",
        "legal exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "cloud_control_failure",
        "insider_misuse"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "leaked customer records",
        "stolen data from the tenant",
        "unauthorized disclosure of personal data"
      ],
      "counterExamples": [
        "website slowed down under hostile traffic",
        "supplier delivery date slips"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "data-breach",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "dataBreach",
      "key": "data_disclosure",
      "label": "Data disclosure",
      "domain": "cyber",
      "description": "Explicit breach, exfiltration, leakage, or unauthorized disclosure of data."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "endpoint",
        "workstation",
        "laptop"
      ],
      "typicalCauses": [
        "malware",
        "user compromise",
        "exploit"
      ],
      "typicalConsequences": [
        "unauthorized access",
        "service disruption",
        "data exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "ransomware"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "compromised employee workstation",
        "infected endpoint opens access path"
      ],
      "counterExamples": [
        "supplier insolvency delays deliveries",
        "permit filing submitted late"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "cyber",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "general",
      "key": "endpoint_compromise",
      "label": "Endpoint compromise",
      "domain": "cyber",
      "description": "Compromise of a workstation, laptop, or endpoint that opens a broader attack path."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "privileged tools",
        "internal systems",
        "data"
      ],
      "typicalCauses": [
        "malicious insider",
        "abuse of granted access"
      ],
      "typicalConsequences": [
        "data exposure",
        "control breakdown",
        "operational disruption"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "privileged_misuse",
        "data_disclosure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "malicious insider misuses access",
        "employee abuses privileged tools"
      ],
      "counterExamples": [
        "website outage caused by DDoS",
        "key supplier misses delivery date"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "insider",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "key": "insider_misuse",
      "label": "Insider misuse",
      "domain": "cyber",
      "description": "Malicious or unauthorized internal misuse of access, data, or administrative capability."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "tenant configuration",
        "security policy",
        "critical platform setting"
      ],
      "typicalCauses": [
        "compromised admin access",
        "insider misuse",
        "poor change control"
      ],
      "typicalConsequences": [
        "control breakdown",
        "operational disruption",
        "service outage"
      ],
      "preferredRiskThemes": [
        "control-plane abuse",
        "security setting tampering",
        "admin-plane manipulation"
      ],
      "defaultMechanisms": [
        "control_change",
        "privileged_access_abuse"
      ],
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
      "cannotBePrimaryWith": [
        "payment_control_failure"
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
      "examplePhrases": [
        "critical configurations are modified after the attacker gains access",
        "security settings are changed without authority",
        "controls are disabled through unauthorised tenant changes"
      ],
      "counterExamples": [
        "a supplier misses a delivery milestone",
        "modern slavery allegations emerge in a supplier workforce"
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
      "fallbackNarrativePatterns": [
        "The event path is a control or configuration change inside the platform itself, not a downstream financial consequence.",
        "Treat the change to critical settings as the primary event family and any outage or exposure as overlays."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "identity",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "key": "unauthorized_configuration_change",
      "label": "Unauthorised configuration change",
      "domain": "cyber",
      "description": "Critical platform, tenant, or security configuration is changed without authority and alters the control state."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "admin account",
        "tenant control",
        "privileged role"
      ],
      "typicalCauses": [
        "misused admin rights",
        "privilege abuse"
      ],
      "typicalConsequences": [
        "control breakdown",
        "service outage",
        "data exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "identity_compromise",
        "cloud_control_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "privileged user changes critical configurations",
        "admin account misused to disable controls"
      ],
      "counterExamples": [
        "supplier logistics disruption delays rollout",
        "safety incident harms a worker"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "identity_compromise",
      "legacyKey": "identity",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "identity",
      "key": "privileged_misuse",
      "label": "Privileged misuse",
      "domain": "cyber",
      "description": "Misuse of privileged or administrative capability to change controls or expand access."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
        },
        {
          "text": "no third-party access path",
          "strength": "strong"
        },
        {
          "text": "no third party access path",
          "strength": "strong"
        },
        {
          "text": "without third-party access",
          "strength": "strong"
        },
        {
          "text": "without third party access",
          "strength": "strong"
        },
        {
          "text": "external access is not involved",
          "strength": "strong"
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
        },
        {
          "text": "access path",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "vendor account",
        "supplier connection",
        "partner support access"
      ],
      "typicalCauses": [
        "compromised vendor credentials",
        "weak third-party access governance"
      ],
      "typicalConsequences": [
        "control breakdown",
        "operational disruption",
        "data exposure"
      ],
      "preferredRiskThemes": [
        "inherited access path",
        "supplier entry point",
        "partner trust abuse"
      ],
      "defaultMechanisms": [
        "access_control_weakness",
        "credential_theft"
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
      "cannotBePrimaryWith": [
        "delivery_slippage",
        "single_source_dependency"
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
      "examplePhrases": [
        "a vendor support account is compromised and used inside the environment",
        "third-party remote access becomes the intrusion path",
        "partner credentials are abused to reach critical systems"
      ],
      "counterExamples": [
        "a shipment delay pushes back deployment",
        "a late regulatory filing creates supervisor attention",
        "admin credentials are abused internally and no third-party access path is involved"
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
      "fallbackNarrativePatterns": [
        "The event starts with an inherited supplier or vendor access path rather than a pure procurement dependency issue.",
        "Treat the third-party access compromise as the primary event family and the supplier relationship as context."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "cyber",
      "lensLabel": "Cyber",
      "functionKey": "technology",
      "estimatePresetKey": "thirdParty",
      "key": "third_party_access_compromise",
      "label": "Third-party access compromise",
      "domain": "cyber",
      "description": "A vendor, partner, or supplier access path is compromised and becomes the attack route into the environment."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 74,
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
          "text": "workflow fails repeatedly",
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
          "text": "manual workaround",
          "strength": "medium"
        },
        {
          "text": "rework cycle",
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
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "hostile traffic",
          "strength": "medium"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "no failover",
          "strength": "medium"
        },
        {
          "text": "without dr",
          "strength": "medium"
        },
        {
          "text": "site intrusion",
          "strength": "medium"
        },
        {
          "text": "restricted operations area",
          "strength": "medium"
        },
        {
          "text": "industrial control",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "core workflow",
        "operating process",
        "service workflow"
      ],
      "typicalCauses": [
        "manual processing error",
        "workflow control lapse",
        "process handoff failure"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "service delay"
      ],
      "preferredRiskThemes": [
        "workflow collapse",
        "manual processing failure",
        "handoff breakdown"
      ],
      "defaultMechanisms": [
        "manual_processing_error",
        "manual_workaround"
      ],
      "allowedSecondaryFamilies": [
        "service_delivery_failure"
      ],
      "canCoExistWith": [
        "service_delivery_failure"
      ],
      "canEscalateTo": [
        "service_delivery_failure"
      ],
      "cannotBePrimaryWith": [
        "dr_gap",
        "failover_failure",
        "perimeter_breach",
        "ot_resilience_failure"
      ],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "availability_attack"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "backlog_growth",
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
      "examplePhrases": [
        "a core workflow fails repeatedly and manual workarounds create backlog",
        "a process breakdown disrupts fulfilment and delays service delivery"
      ],
      "counterExamples": [
        "dark web admin credentials found",
        "an unauthorised person enters a restricted operations area"
      ],
      "promptIdeaTemplates": [
        "A core workflow breaks down and manual workarounds start to drive backlog and delay",
        "A process handoff failure creates sustained operational disruption"
      ],
      "shortlistSeedThemes": [
        "workflow breakdown",
        "manual rework pressure",
        "handoff failure"
      ],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "process_breakdown",
      "label": "Process breakdown",
      "domain": "operational",
      "description": "A core workflow, handoff, or operating process breaks down and creates delivery strain before the issue becomes a continuity or physical-security scenario."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "service team",
        "operating process",
        "platform capacity"
      ],
      "typicalCauses": [
        "demand surge",
        "resourcing constraint"
      ],
      "typicalConsequences": [
        "service outage",
        "backlog growth"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "backlog_escalation"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "service desk capacity shortfall",
        "throughput bottleneck delays fulfilment"
      ],
      "counterExamples": [
        "cloud credentials exposed publicly",
        "regulatory filing missed deadline"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "service_delivery_failure",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "capacity_shortfall",
      "label": "Capacity shortfall",
      "domain": "operational",
      "description": "Compatibility alias for service delivery failure where insufficient throughput or staffing is the cause pattern."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "manual process",
        "operational task"
      ],
      "typicalCauses": [
        "human error",
        "manual processing weakness"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "process_breakdown"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "manual processing error causes outage",
        "human error disrupts a critical service"
      ],
      "counterExamples": [
        "website flooded by hostile traffic",
        "fake invoice submitted for payment"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "process_breakdown",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "manual_error",
      "label": "Manual error",
      "domain": "operational",
      "description": "Compatibility alias for process breakdown when a manual or human processing mistake is the cause pattern."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 73,
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
        },
        {
          "text": "repeated platform defects",
          "strength": "medium"
        },
        {
          "text": "recurring platform defects",
          "strength": "medium"
        },
        {
          "text": "repeated system failure",
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
        },
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "hostile traffic",
          "strength": "medium"
        },
        {
          "text": "no failover",
          "strength": "medium"
        },
        {
          "text": "without dr",
          "strength": "medium"
        },
        {
          "text": "site intrusion",
          "strength": "medium"
        },
        {
          "text": "industrial control",
          "strength": "medium"
        },
        {
          "text": "ics",
          "strength": "medium"
        },
        {
          "text": "scada",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "platform",
        "service",
        "core system"
      ],
      "typicalCauses": [
        "aging infrastructure",
        "recurring platform defects",
        "unreliable platform"
      ],
      "typicalConsequences": [
        "service outage",
        "operational disruption",
        "customer harm"
      ],
      "preferredRiskThemes": [
        "platform reliability weakness",
        "recurring defects",
        "aging-stack instability"
      ],
      "defaultMechanisms": [
        "capacity_constraint"
      ],
      "allowedSecondaryFamilies": [
        "service_delivery_failure"
      ],
      "canCoExistWith": [
        "service_delivery_failure"
      ],
      "canEscalateTo": [
        "service_delivery_failure"
      ],
      "cannotBePrimaryWith": [
        "dr_gap",
        "failover_failure",
        "perimeter_breach",
        "ot_resilience_failure"
      ],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "service_outage",
        "operational_disruption",
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
      "examplePhrases": [
        "repeated platform defects make the service unstable",
        "legacy infrastructure causes service instability and delay"
      ],
      "counterExamples": [
        "public website overwhelmed by hostile traffic",
        "there is no failover for the messaging platform"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "platform_instability",
      "label": "Platform instability",
      "domain": "operational",
      "description": "Instability in a core platform or system degrades reliability, but the event path remains operating performance rather than DR, physical, or OT failure."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 78,
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
          "text": "service becomes unstable",
          "strength": "medium"
        },
        {
          "text": "delivery delays",
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
        },
        {
          "text": "manual workaround",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "botnet",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "hostile traffic",
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
          "text": "no failover",
          "strength": "medium"
        },
        {
          "text": "without dr",
          "strength": "medium"
        },
        {
          "text": "site intrusion",
          "strength": "medium"
        },
        {
          "text": "industrial control",
          "strength": "medium"
        },
        {
          "text": "ics",
          "strength": "medium"
        },
        {
          "text": "scada",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "core service",
        "delivery path"
      ],
      "typicalCauses": [
        "delivery-path weakness",
        "repeated service failure",
        "capacity strain"
      ],
      "typicalConsequences": [
        "service outage",
        "customer harm",
        "backlog growth"
      ],
      "preferredRiskThemes": [
        "service instability",
        "delivery-path failure",
        "execution strain"
      ],
      "defaultMechanisms": [
        "capacity_constraint",
        "manual_workaround"
      ],
      "allowedSecondaryFamilies": [
        "process_breakdown",
        "critical_service_dependency_failure",
        "platform_instability"
      ],
      "canCoExistWith": [
        "process_breakdown",
        "platform_instability",
        "critical_service_dependency_failure"
      ],
      "canEscalateTo": [
        "dr_gap",
        "failover_failure"
      ],
      "cannotBePrimaryWith": [
        "availability_attack",
        "dr_gap",
        "failover_failure",
        "recovery_coordination_failure",
        "perimeter_breach",
        "ot_resilience_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "service_outage",
        "customer_harm",
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
      "examplePhrases": [
        "a customer-facing service becomes unstable because repeated defects are not contained",
        "service degradation and manual workarounds create delivery delays and rising backlog"
      ],
      "counterExamples": [
        "denial-of-service flood hits public site",
        "there is no failover or disaster recovery capability"
      ],
      "promptIdeaTemplates": [
        "A critical service becomes unstable and manual workarounds are no longer enough",
        "Delivery performance breaks down across a core service path"
      ],
      "shortlistSeedThemes": [
        "service instability",
        "delivery-path failure",
        "operational backlog"
      ],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "service_delivery_failure",
      "label": "Service delivery failure",
      "domain": "operational",
      "description": "A core service or delivery path becomes unstable, delayed, or repeatedly unavailable because normal operations are failing, not because DR/failover, physical security, or OT resilience has already become the primary event path."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 79,
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
          "text": "upstream service unavailable",
          "strength": "medium"
        },
        {
          "text": "shared service failure",
          "strength": "medium"
        },
        {
          "text": "shared service unavailable",
          "strength": "medium"
        },
        {
          "text": "core dependency unavailable",
          "strength": "medium"
        },
        {
          "text": "dependency becomes unavailable",
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
        },
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "missed delivery date",
          "strength": "medium"
        },
        {
          "text": "no failover",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "shared service",
        "critical dependency",
        "upstream platform"
      ],
      "typicalCauses": [
        "dependency failure",
        "shared service outage",
        "upstream service instability"
      ],
      "typicalConsequences": [
        "service outage",
        "operational disruption",
        "backlog growth"
      ],
      "preferredRiskThemes": [
        "shared dependency weakness",
        "upstream service failure",
        "operational knock-on effect"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "service_delivery_failure",
        "platform_instability"
      ],
      "canCoExistWith": [
        "service_delivery_failure",
        "platform_instability"
      ],
      "canEscalateTo": [
        "dr_gap",
        "failover_failure"
      ],
      "cannotBePrimaryWith": [
        "availability_attack",
        "delivery_slippage"
      ],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure",
        "delivery_slippage"
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
      "examplePhrases": [
        "a shared service outage disrupts multiple dependent applications",
        "a core dependency becomes unavailable and dependent internal services fail"
      ],
      "counterExamples": [
        "malicious traffic floods the public website",
        "unauthorised funds transfer follows a weak payment approval control"
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
      "fallbackNarrativePatterns": [
        "Treat the unavailable shared dependency as the event path, not a generic cyber or finance scenario.",
        "Keep the draft focused on operational dependency failure and its service consequences."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "critical_service_dependency_failure",
      "label": "Critical service dependency failure",
      "domain": "operational",
      "description": "A critical upstream or shared dependency becomes unavailable and pulls a dependent service path with it, without making continuity, supply-chain delivery, or cyber compromise the primary event."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "service queue",
        "operational workflow"
      ],
      "typicalCauses": [
        "service disruption",
        "capacity shortfall"
      ],
      "typicalConsequences": [
        "operational disruption",
        "customer harm"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "capacity_shortfall",
        "service_delivery_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "backlog growth after disruption",
        "queue escalation delays delivery"
      ],
      "counterExamples": [
        "credential theft in the tenant",
        "supplier labour allegation"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "service_delivery_failure",
      "legacyKey": "operational",
      "lensKey": "operational",
      "lensLabel": "Operational",
      "functionKey": "operations",
      "estimatePresetKey": "operational",
      "key": "backlog_escalation",
      "label": "Backlog escalation",
      "domain": "operational",
      "description": "Compatibility alias for service delivery failure when the visible consequence is queue or backlog growth rather than the triggering event itself."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 82,
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
        },
        {
          "text": "no disaster recovery capability",
          "strength": "medium"
        },
        {
          "text": "recovery capability missing",
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
        },
        {
          "text": "service becomes unstable",
          "strength": "medium"
        },
        {
          "text": "platform defects",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "no dr",
          "strength": "medium"
        },
        {
          "text": "without dr",
          "strength": "medium"
        },
        {
          "text": "disaster recovery",
          "strength": "medium"
        },
        {
          "text": "recovery capability",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "critical service",
        "core platform",
        "communications service"
      ],
      "typicalCauses": [
        "missing DR",
        "weak continuity planning",
        "outage survival gap"
      ],
      "typicalConsequences": [
        "service outage",
        "recovery strain"
      ],
      "preferredRiskThemes": [
        "disaster recovery gap",
        "outage survival weakness",
        "continuity capability missing"
      ],
      "defaultMechanisms": [
        "fallback_gap"
      ],
      "allowedSecondaryFamilies": [
        "failover_failure",
        "recovery_coordination_failure"
      ],
      "canCoExistWith": [
        "failover_failure"
      ],
      "canEscalateTo": [
        "recovery_coordination_failure"
      ],
      "cannotBePrimaryWith": [
        "service_delivery_failure",
        "platform_instability"
      ],
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
      "examplePhrases": [
        "there is no DR for the critical email system",
        "the service has no disaster recovery capability when the outage begins"
      ],
      "counterExamples": [
        "botnet floods the public website",
        "the service is unstable but failover and fallback are functioning"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "key": "dr_gap",
      "label": "DR gap",
      "domain": "business_continuity",
      "description": "A critical service lacks explicit disaster-recovery capability, recovery fallback, or outage-survival arrangements."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 81,
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
        },
        {
          "text": "fallback fails",
          "strength": "medium"
        },
        {
          "text": "failover does not work",
          "strength": "medium"
        },
        {
          "text": "fallback unavailable",
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
          "text": "repeated platform defects",
          "strength": "medium"
        },
        {
          "text": "site intrusion",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "failover",
          "strength": "medium"
        },
        {
          "text": "fallback",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "recovery platform",
        "fallback operations"
      ],
      "typicalCauses": [
        "missing failover",
        "fallback weakness",
        "failover failure"
      ],
      "typicalConsequences": [
        "service outage",
        "recovery strain"
      ],
      "preferredRiskThemes": [
        "failover weakness",
        "fallback not ready",
        "continuity path failure"
      ],
      "defaultMechanisms": [
        "fallback_gap"
      ],
      "allowedSecondaryFamilies": [
        "dr_gap",
        "recovery_coordination_failure"
      ],
      "canCoExistWith": [
        "dr_gap"
      ],
      "canEscalateTo": [
        "recovery_coordination_failure"
      ],
      "cannotBePrimaryWith": [
        "service_delivery_failure",
        "platform_instability"
      ],
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
      "examplePhrases": [
        "fallback operations are not ready for the outage",
        "no failover exists for the critical service"
      ],
      "counterExamples": [
        "dark-web credentials expose admin account",
        "the platform is unstable but fallback remains available"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "key": "failover_failure",
      "label": "Failover failure",
      "domain": "business_continuity",
      "description": "Failover or fallback arrangements are missing, ineffective, or not ready when the primary service path fails."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
      "positiveSignals": [
        {
          "text": "continuity escalation",
          "strength": "medium"
        },
        {
          "text": "recovery escalation",
          "strength": "medium"
        },
        {
          "text": "major incident recovery escalation",
          "strength": "medium"
        },
        {
          "text": "crisis coordination",
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
      "typicalAssets": [
        "crisis response",
        "continuity governance"
      ],
      "typicalCauses": [
        "weak recovery coordination",
        "continuity escalation"
      ],
      "typicalConsequences": [
        "service outage",
        "reputational damage"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "recovery_coordination_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "crisis escalation after a continuity event",
        "major incident outgrows planned response"
      ],
      "counterExamples": [
        "website traffic flood causes slowdown",
        "greenwashing claim under scrutiny"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "recovery_coordination_failure",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "key": "crisis_escalation",
      "label": "Crisis escalation",
      "domain": "business_continuity",
      "description": "Compatibility alias for recovery coordination failure when the visible pattern is major-incident or crisis-response escalation."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 76,
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
          "text": "restoration teams not aligned",
          "strength": "medium"
        },
        {
          "text": "continuity communications break down",
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
          "text": "service incident",
          "strength": "medium"
        },
        {
          "text": "platform defects",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "recovery",
          "strength": "medium"
        },
        {
          "text": "restoration",
          "strength": "medium"
        },
        {
          "text": "recovery team",
          "strength": "medium"
        },
        {
          "text": "continuity communications",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "recovery team",
        "fallback communications"
      ],
      "typicalCauses": [
        "poor coordination",
        "restoration delay",
        "continuity command failure"
      ],
      "typicalConsequences": [
        "recovery strain",
        "service outage"
      ],
      "preferredRiskThemes": [
        "restoration governance failure",
        "recovery coordination breakdown",
        "continuity communications failure"
      ],
      "defaultMechanisms": [
        "coordination_breakdown"
      ],
      "allowedSecondaryFamilies": [
        "dr_gap",
        "failover_failure"
      ],
      "canCoExistWith": [
        "dr_gap",
        "failover_failure"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "service_delivery_failure",
        "platform_instability"
      ],
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
      "examplePhrases": [
        "recovery coordination fails during restoration",
        "restoration delays grow because recovery teams are not aligned"
      ],
      "counterExamples": [
        "supplier delivery slip delays deployment",
        "management escalates a severe service incident without a recovery breakdown"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "key": "recovery_coordination_failure",
      "label": "Recovery coordination failure",
      "domain": "business_continuity",
      "description": "Recovery is delayed because restoration teams, fallback communications, or continuity coordination are ineffective after the event has already become a recovery problem."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "receivables balance",
        "customer exposure"
      ],
      "typicalCauses": [
        "insolvency",
        "default"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "liquidity strain",
        "legal exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "liquidity_strain",
        "valuation_provisioning_shock"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "major client files for bankruptcy",
        "counterparty default weakens recoverability"
      ],
      "counterExamples": [
        "dark-web admin credentials found",
        "website slows down under DDoS"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "key": "counterparty_default",
      "label": "Counterparty default",
      "domain": "finance",
      "description": "A customer or counterparty default threatens recoverability of expected value."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "cash position",
        "working capital"
      ],
      "typicalCauses": [
        "delayed collections",
        "loss event",
        "stress on inflows"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "control breakdown"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "counterparty_default",
        "valuation_provisioning_shock"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "cashflow strain after client failure",
        "working capital pressure grows quickly"
      ],
      "counterExamples": [
        "public website unavailable due to hostile traffic",
        "workforce fatigue weakens safe operations"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "key": "liquidity_strain",
      "label": "Liquidity strain",
      "domain": "finance",
      "description": "Cashflow or liquidity pressure emerges from delayed inflows, losses, or financial stress."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 84,
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
      "typicalAssets": [
        "payment process",
        "approval workflow",
        "treasury control"
      ],
      "typicalCauses": [
        "control gap",
        "approval weakness",
        "segregation failure"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "control breakdown",
        "regulatory scrutiny"
      ],
      "preferredRiskThemes": [
        "payment release weakness",
        "segregation failure",
        "approval-path breakdown"
      ],
      "defaultMechanisms": [
        "approval_override",
        "process_bypass"
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
      "cannotBePrimaryWith": [
        "identity_compromise",
        "business_email_compromise",
        "payment_fraud",
        "invoice_fraud"
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
      "examplePhrases": [
        "weak payment approval controls allow unauthorised funds transfer",
        "payment process weakness releases funds incorrectly",
        "approval gap leads to direct monetary loss"
      ],
      "counterExamples": [
        "DDoS traffic overwhelms the public website",
        "Azure credentials are used to access the tenant"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "key": "payment_control_failure",
      "label": "Payment control failure",
      "domain": "finance",
      "description": "Weak payment approval or release control causes unauthorized transfer or direct financial loss without an explicit deception narrative."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "balance sheet exposure",
        "provisioning assumption"
      ],
      "typicalCauses": [
        "loss recognition",
        "valuation weakness"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "regulatory scrutiny"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "counterparty_default",
        "liquidity_strain"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "valuation shock forces provision increase",
        "unexpected write-down changes provisioning"
      ],
      "counterExamples": [
        "website degraded by hostile traffic",
        "greenwashing allegation emerges"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "financial",
      "lensKey": "financial",
      "lensLabel": "Financial",
      "functionKey": "finance",
      "estimatePresetKey": "financial",
      "key": "valuation_provisioning_shock",
      "label": "Valuation / provisioning shock",
      "domain": "finance",
      "description": "Unexpected provisioning or valuation pressure hits reported financial expectations."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "invoice process",
        "accounts payable"
      ],
      "typicalCauses": [
        "deception",
        "fake invoice submission"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "fraud exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "payment_fraud",
        "payment_control_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "fake invoice submitted for payment",
        "invoice scam bypasses controls"
      ],
      "counterExamples": [
        "website flooded by botnet traffic",
        "supplier delivery delay blocks deployment"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "invoice_fraud",
      "label": "Invoice fraud",
      "domain": "fraud_integrity",
      "description": "Deception around invoices or payable instructions creates direct financial loss."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "payment workflow",
        "bank transfer"
      ],
      "typicalCauses": [
        "deception",
        "fraud",
        "manipulation"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "fraud exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "payment_control_failure",
        "approval_override"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "fraudulent payment released",
        "deceptive funds transfer",
        "payment manipulation caused loss"
      ],
      "counterExamples": [
        "critical website slows under DDoS",
        "safety incident injures a worker"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "payment_fraud",
      "label": "Payment fraud",
      "domain": "fraud_integrity",
      "description": "Deceptive payment manipulation or release of funds through fraud or abuse."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "approval path",
        "commercial relationship"
      ],
      "typicalCauses": [
        "corrupt payment",
        "kickback scheme"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure",
        "reputational damage"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "approval_override",
        "collusion"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "bribery allegation in contract award",
        "kickback scheme around approvals"
      ],
      "counterExamples": [
        "public site down from hostile traffic",
        "supplier misses a logistics commitment"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "bribery_corruption",
      "label": "Bribery / corruption",
      "domain": "fraud_integrity",
      "description": "Bribery, kickback, or corruption conduct creates integrity and legal exposure."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "approval control",
        "workflow"
      ],
      "typicalCauses": [
        "override abuse",
        "deceptive approval bypass"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "control breakdown"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "payment_fraud",
        "payment_control_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "approval override releases payment",
        "control override abused for gain"
      ],
      "counterExamples": [
        "website traffic flood knocks services offline",
        "supplier workforce faces modern slavery allegations"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "payment_control_failure",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "approval_override",
      "label": "Approval override abuse",
      "domain": "fraud_integrity",
      "description": "Abuse or override of approvals creates a deceptive or integrity-driven loss path."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "procurement process",
        "commercial decision"
      ],
      "typicalCauses": [
        "collusion scheme",
        "coordinated manipulation"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "regulatory scrutiny"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "bribery_corruption"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "supplier collusion distorts the bid",
        "price-fixing scheme inflates cost"
      ],
      "counterExamples": [
        "public site slowed by DDoS attack",
        "cloud control misconfiguration exposes storage"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "collusion",
      "label": "Collusion",
      "domain": "fraud_integrity",
      "description": "Coordinated collusion or manipulation weakens competitive or financial integrity."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 72,
      "positiveSignals": [
        {
          "text": "policy breach",
          "strength": "strong"
        },
        {
          "text": "policy violation",
          "strength": "strong"
        },
        {
          "text": "required internal control process",
          "strength": "strong"
        },
        {
          "text": "internal governance requirement breached",
          "strength": "strong"
        },
        {
          "text": "control process is not followed",
          "strength": "strong"
        },
        {
          "text": "policy expectations",
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
          "strength": "strong"
        },
        {
          "text": "botnet",
          "strength": "strong"
        },
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "privacy obligations",
          "strength": "strong"
        },
        {
          "text": "lawful basis",
          "strength": "strong"
        },
        {
          "text": "retention schedule",
          "strength": "strong"
        },
        {
          "text": "cross-border transfer",
          "strength": "strong"
        },
        {
          "text": "regulatory filing",
          "strength": "strong"
        },
        {
          "text": "sanctions restrictions",
          "strength": "strong"
        },
        {
          "text": "required permit",
          "strength": "strong"
        },
        {
          "text": "licence",
          "strength": "strong"
        },
        {
          "text": "license",
          "strength": "strong"
        },
        {
          "text": "contractual liability",
          "strength": "strong"
        },
        {
          "text": "indemnity",
          "strength": "strong"
        },
        {
          "text": "public sustainability claims",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "policy",
          "strength": "weak"
        },
        {
          "text": "internal control",
          "strength": "weak"
        },
        {
          "text": "process",
          "strength": "weak"
        },
        {
          "text": "governance",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "policy framework",
        "control environment",
        "internal governance requirement"
      ],
      "typicalCauses": [
        "internal policy failure",
        "control-process non-compliance",
        "required process not followed"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "control breakdown"
      ],
      "preferredRiskThemes": [
        "internal policy failure",
        "control process not followed",
        "governance obligation breach"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "regulatory_filing_failure",
        "privacy_non_compliance"
      ],
      "canCoExistWith": [
        "supplier_control_weakness"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "privacy_non_compliance",
        "records_retention_non_compliance",
        "cross_border_transfer_non_compliance",
        "regulatory_filing_failure",
        "sanctions_breach",
        "licensing_permit_issue",
        "contract_liability",
        "greenwashing_disclosure_gap"
      ],
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
      "examplePhrases": [
        "a required internal control process is not followed, breaching policy expectations",
        "an internal governance requirement is breached because the control process was not followed"
      ],
      "counterExamples": [
        "personal data is transferred across borders without required safeguards",
        "a supplier agreement breach creates contractual liability and indemnity exposure"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "compliance",
      "key": "policy_breach",
      "label": "Policy breach",
      "domain": "compliance",
      "description": "The event itself is an internal policy, control-process, or governance-obligation failure without a more specific privacy, regulatory, or contract family taking precedence."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "privacy obligations",
          "strength": "strong"
        },
        {
          "text": "data protection obligations",
          "strength": "strong"
        },
        {
          "text": "privacy governance failure",
          "strength": "medium"
        },
        {
          "text": "unlawful processing",
          "strength": "strong"
        },
        {
          "text": "processing without lawful basis",
          "strength": "strong"
        },
        {
          "text": "privacy non-compliance",
          "strength": "strong"
        },
        {
          "text": "privacy control failure",
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
          "strength": "weak"
        },
        {
          "text": "data protection",
          "strength": "weak"
        },
        {
          "text": "lawful basis",
          "strength": "weak"
        },
        {
          "text": "processing",
          "strength": "weak"
        },
        {
          "text": "personal data",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "personal data",
        "retention control",
        "processing activity"
      ],
      "typicalCauses": [
        "unlawful processing",
        "retention failure",
        "privacy obligation breach"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "data-protection obligation failure",
        "privacy control weakness",
        "processing governance failure"
      ],
      "defaultMechanisms": [
        "unlawful_processing",
        "records_retention_failure"
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
      "cannotBePrimaryWith": [
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
      "examplePhrases": [
        "privacy obligations were breached by unlawful processing",
        "retention breach exposes a data protection issue",
        "processing without lawful basis triggers privacy concern"
      ],
      "counterExamples": [
        "website flood slows customer-facing services",
        "supplier delivery slippage delays deployment"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "privacy_non_compliance",
      "label": "Privacy non-compliance",
      "domain": "compliance",
      "description": "A privacy or data-protection obligation is breached through unlawful processing, retention, or control failure."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 76,
      "positiveSignals": [
        {
          "text": "records retention failure",
          "strength": "strong"
        },
        {
          "text": "retention breach",
          "strength": "strong"
        },
        {
          "text": "records kept too long",
          "strength": "strong"
        },
        {
          "text": "retained beyond required deletion periods",
          "strength": "strong"
        },
        {
          "text": "required deletion periods",
          "strength": "medium"
        },
        {
          "text": "deletion obligations not met",
          "strength": "strong"
        },
        {
          "text": "retention schedule breach",
          "strength": "strong"
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
          "strength": "weak"
        },
        {
          "text": "records",
          "strength": "weak"
        },
        {
          "text": "deletion",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "records archive",
        "retention schedule",
        "regulated records"
      ],
      "typicalCauses": [
        "records retention failure",
        "deletion control weakness",
        "policy breach"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure",
        "control breakdown"
      ],
      "preferredRiskThemes": [
        "retention failure",
        "records governance weakness",
        "deletion-control breakdown"
      ],
      "defaultMechanisms": [
        "records_retention_failure"
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
      "cannotBePrimaryWith": [
        "data_disclosure"
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
      "examplePhrases": [
        "records are kept beyond the permitted retention period",
        "deletion obligations are not met for regulated records"
      ],
      "counterExamples": [
        "DDoS traffic floods the public website",
        "a supplier misses the committed delivery date"
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
      "fallbackNarrativePatterns": [
        "Treat the retention or deletion obligation failure as the event path rather than a generic data-breach scenario.",
        "Keep any disclosure or legal concern as an overlay unless the text explicitly says records were exposed."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "records_retention_non_compliance",
      "label": "Records retention non-compliance",
      "domain": "compliance",
      "description": "Records are retained or deleted inconsistently with legal, privacy, or internal retention obligations."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 77,
      "positiveSignals": [
        {
          "text": "cross-border transfer",
          "strength": "strong"
        },
        {
          "text": "cross border transfer",
          "strength": "strong"
        },
        {
          "text": "transferred across borders",
          "strength": "strong"
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
          "strength": "strong"
        },
        {
          "text": "required safeguards",
          "strength": "medium"
        },
        {
          "text": "transfer impact assessment missing",
          "strength": "strong"
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
          "strength": "weak"
        },
        {
          "text": "safeguards",
          "strength": "weak"
        },
        {
          "text": "across borders",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "cross-border data flow",
        "personal data transfer",
        "restricted dataset"
      ],
      "typicalCauses": [
        "transfer without safeguards",
        "missing assessment",
        "privacy governance gap"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "transfer governance failure",
        "privacy obligation breach",
        "data movement non-compliance"
      ],
      "defaultMechanisms": [
        "unlawful_processing"
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
      "cannotBePrimaryWith": [
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
        "reputational_damage"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "examplePhrases": [
        "personal data is transferred cross-border without the required safeguards",
        "an international data transfer occurs without lawful approval or assessment"
      ],
      "counterExamples": [
        "hostile traffic slows the customer website",
        "fake invoices trigger an accounts-payable fraud event"
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
      "fallbackNarrativePatterns": [
        "Treat the transfer-governance failure as the primary event path and keep any disclosure risk as a consequence.",
        "Do not collapse this into a cyber family unless the text explicitly says data was exposed or stolen."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "compliance",
      "lensKey": "compliance",
      "lensLabel": "Compliance",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "cross_border_transfer_non_compliance",
      "label": "Cross-border transfer non-compliance",
      "domain": "compliance",
      "description": "Personal or restricted data is transferred across borders without the required legal basis, safeguards, or approvals."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 81,
      "positiveSignals": [
        {
          "text": "regulatory filing",
          "strength": "strong"
        },
        {
          "text": "mandatory regulatory filing",
          "strength": "strong"
        },
        {
          "text": "missed filing",
          "strength": "strong"
        },
        {
          "text": "late filing",
          "strength": "strong"
        },
        {
          "text": "filing is not submitted on time",
          "strength": "strong"
        },
        {
          "text": "reporting deadline failure",
          "strength": "strong"
        },
        {
          "text": "mandatory reporting obligation not met",
          "strength": "strong"
        },
        {
          "text": "notification failure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "regulatory scrutiny",
          "strength": "medium"
        },
        {
          "text": "permit",
          "strength": "strong"
        },
        {
          "text": "licence",
          "strength": "strong"
        },
        {
          "text": "license",
          "strength": "strong"
        },
        {
          "text": "sanctions restrictions",
          "strength": "strong"
        },
        {
          "text": "legal exposure",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "filing",
          "strength": "weak"
        },
        {
          "text": "notification",
          "strength": "weak"
        },
        {
          "text": "reporting",
          "strength": "weak"
        },
        {
          "text": "submitted",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "regulatory filing",
        "mandatory report",
        "notification process"
      ],
      "typicalCauses": [
        "missed deadline",
        "reporting failure",
        "inaccurate submission"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure"
      ],
      "preferredRiskThemes": [
        "missed mandatory filing",
        "late regulatory submission",
        "reporting obligation failure"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "policy_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "policy_breach",
        "licensing_permit_issue",
        "sanctions_breach"
      ],
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
      "examplePhrases": [
        "a mandatory regulatory filing is not submitted on time",
        "a required notification to the regulator is missed"
      ],
      "counterExamples": [
        "regulatory scrutiny follows a cyber outage but no filing was missed",
        "operations continue without a required permit being valid"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "regulatory",
      "lensKey": "regulatory",
      "lensLabel": "Regulatory",
      "functionKey": "compliance",
      "estimatePresetKey": "regulatory",
      "key": "regulatory_filing_failure",
      "label": "Regulatory filing failure",
      "domain": "regulatory",
      "description": "A mandatory filing, notification, or reporting obligation is missed, late, or inaccurate."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "sanctions breach",
          "strength": "strong"
        },
        {
          "text": "sanctions restrictions",
          "strength": "strong"
        },
        {
          "text": "sanctions screening",
          "strength": "strong"
        },
        {
          "text": "screening control failure",
          "strength": "strong"
        },
        {
          "text": "restricted party",
          "strength": "strong"
        },
        {
          "text": "prohibited transaction",
          "strength": "strong"
        },
        {
          "text": "entity list",
          "strength": "medium"
        },
        {
          "text": "export control breach",
          "strength": "strong"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "supplier slippage",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "regulatory scrutiny",
          "strength": "medium"
        },
        {
          "text": "permit",
          "strength": "strong"
        },
        {
          "text": "licence",
          "strength": "strong"
        },
        {
          "text": "license",
          "strength": "strong"
        },
        {
          "text": "tariff",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "sanctions",
          "strength": "weak"
        },
        {
          "text": "screening",
          "strength": "weak"
        },
        {
          "text": "restricted party",
          "strength": "weak"
        },
        {
          "text": "prohibited transaction",
          "strength": "weak"
        },
        {
          "text": "entity list",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "trade control process",
        "screening control"
      ],
      "typicalCauses": [
        "screening failure",
        "sanctions non-compliance"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure",
        "reputational damage"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "market_access_restriction"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "policy_breach",
        "licensing_permit_issue"
      ],
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
      "examplePhrases": [
        "a transaction proceeds despite sanctions restrictions and screening control failure",
        "restricted-party screening is missed and a prohibited transaction proceeds"
      ],
      "counterExamples": [
        "general geopolitical concern rises but no sanctions control fails",
        "a mandatory filing is submitted late"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "regulatory",
      "lensKey": "regulatory",
      "lensLabel": "Regulatory",
      "functionKey": "compliance",
      "estimatePresetKey": "regulatory",
      "key": "sanctions_breach",
      "label": "Sanctions breach",
      "domain": "regulatory",
      "description": "The event itself is a sanctions or restricted-party compliance failure."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 82,
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
          "strength": "strong"
        },
        {
          "text": "licensing failure",
          "strength": "strong"
        },
        {
          "text": "required permit",
          "strength": "strong"
        },
        {
          "text": "permit being valid",
          "strength": "medium"
        },
        {
          "text": "invalid permit",
          "strength": "strong"
        },
        {
          "text": "expired licence",
          "strength": "strong"
        },
        {
          "text": "expired license",
          "strength": "strong"
        },
        {
          "text": "licence condition failure",
          "strength": "strong"
        },
        {
          "text": "operations continue without a required permit",
          "strength": "strong"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "regulatory scrutiny",
          "strength": "medium"
        },
        {
          "text": "sanctions restrictions",
          "strength": "strong"
        },
        {
          "text": "filing",
          "strength": "strong"
        },
        {
          "text": "notification",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "permit",
          "strength": "weak"
        },
        {
          "text": "licence",
          "strength": "weak"
        },
        {
          "text": "license",
          "strength": "weak"
        },
        {
          "text": "licensing",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "licence",
        "permit",
        "regulated activity"
      ],
      "typicalCauses": [
        "missed permit condition",
        "licensing non-compliance"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "operational disruption"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "policy_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "policy_breach",
        "regulatory_filing_failure",
        "sanctions_breach"
      ],
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
      "examplePhrases": [
        "operations continue without a required permit being valid",
        "a licence condition failure puts the regulated activity at risk"
      ],
      "counterExamples": [
        "general regulator concern rises but no permit issue is stated",
        "sanctions screening fails on a restricted-party transaction"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "regulatory",
      "lensKey": "regulatory",
      "lensLabel": "Regulatory",
      "functionKey": "compliance",
      "estimatePresetKey": "regulatory",
      "key": "licensing_permit_issue",
      "label": "Licensing / permit issue",
      "domain": "regulatory",
      "description": "A licence or permit obligation is not met, putting operation or expansion at risk."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 80,
      "positiveSignals": [
        {
          "text": "contract liability",
          "strength": "strong"
        },
        {
          "text": "contractual liability",
          "strength": "strong"
        },
        {
          "text": "supplier agreement breach",
          "strength": "strong"
        },
        {
          "text": "breach of contract",
          "strength": "strong"
        },
        {
          "text": "indemnity exposure",
          "strength": "strong"
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
          "text": "contractual claim",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "legal exposure",
          "strength": "medium"
        },
        {
          "text": "regulatory scrutiny",
          "strength": "medium"
        },
        {
          "text": "without lawful basis",
          "strength": "strong"
        },
        {
          "text": "exfiltration",
          "strength": "strong"
        },
        {
          "text": "data breach",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "contract",
          "strength": "weak"
        },
        {
          "text": "contractual",
          "strength": "weak"
        },
        {
          "text": "agreement",
          "strength": "weak"
        },
        {
          "text": "indemnity",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "contract",
        "supplier agreement",
        "liability clause"
      ],
      "typicalCauses": [
        "contract breach",
        "indemnity exposure",
        "terms failure"
      ],
      "typicalConsequences": [
        "legal exposure",
        "direct monetary loss"
      ],
      "preferredRiskThemes": [
        "contract breach exposure",
        "indemnity risk",
        "agreement liability"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "policy_breach",
        "data_disclosure"
      ],
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
      "examplePhrases": [
        "a supplier agreement breach creates contractual liability and indemnity exposure",
        "breach of contract terms creates a contractual claim against the organisation"
      ],
      "counterExamples": [
        "legal exposure follows an ESG disclosure issue but no contract terms are involved",
        "customer records are exposed externally after exfiltration"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "legal-contract",
      "lensKey": "legal-contract",
      "lensLabel": "Legal / contract",
      "functionKey": "compliance",
      "estimatePresetKey": "legalContract",
      "key": "contract_liability",
      "label": "Contract liability",
      "domain": "legal_contract",
      "description": "A contractual term, agreement breach, indemnity, or liability obligation is itself the event path."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 74,
      "positiveSignals": [
        {
          "text": "single-source dependency",
          "strength": "strong"
        },
        {
          "text": "single supplier",
          "strength": "strong"
        },
        {
          "text": "sole source",
          "strength": "strong"
        },
        {
          "text": "only supplier",
          "strength": "medium"
        },
        {
          "text": "no viable substitute",
          "strength": "strong"
        },
        {
          "text": "no alternative supplier",
          "strength": "strong"
        },
        {
          "text": "lack of alternate source",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "logistics disruption",
          "strength": "strong"
        },
        {
          "text": "supplier insolvency",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "source",
          "strength": "weak"
        },
        {
          "text": "substitute",
          "strength": "weak"
        },
        {
          "text": "vendor",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "critical material",
        "sole-source component",
        "sourcing category"
      ],
      "typicalCauses": [
        "single-source concentration",
        "lack of viable substitute",
        "no alternate source"
      ],
      "typicalConsequences": [
        "third-party dependency",
        "operational disruption",
        "backlog growth"
      ],
      "preferredRiskThemes": [
        "sole-source fragility",
        "lack of supplier substitute",
        "dependency concentration"
      ],
      "defaultMechanisms": [
        "sourcing_concentration"
      ],
      "allowedSecondaryFamilies": [
        "supplier_concentration_risk",
        "supplier_control_weakness"
      ],
      "canCoExistWith": [
        "supplier_concentration_risk"
      ],
      "canEscalateTo": [
        "delivery_slippage",
        "supplier_insolvency"
      ],
      "cannotBePrimaryWith": [
        "delivery_slippage",
        "logistics_disruption",
        "supplier_insolvency",
        "third_party_access_compromise"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "delivery_slippage",
        "third_party_access_compromise"
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
      "examplePhrases": [
        "a critical material is sourced from a single supplier with no viable substitute",
        "single-source dependency leaves no alternate supply path for a critical component"
      ],
      "counterExamples": [
        "a supplier misses the committed delivery date for a hardware refresh",
        "a vendor access path is compromised and used inside the environment"
      ],
      "promptIdeaTemplates": [
        "Single-source dependency leaves no viable substitute for a critical input",
        "Procurement resilience is weakened because one supplier dominates a critical material"
      ],
      "shortlistSeedThemes": [
        "sole-source fragility",
        "lack of supplier substitute",
        "concentrated sourcing dependence"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the procurement dependency lane unless the text moves into an actual delivery miss, insolvency event, or access compromise.",
        "This is a concentration and substitute-risk scenario rather than a live operational incident when no delay, insolvency, or compromise is explicit."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "single_source_dependency",
      "label": "Single-source dependency",
      "domain": "procurement",
      "description": "A sole-source dependency or lack of viable supplier substitute creates a concentrated sourcing fragility state."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 73,
      "positiveSignals": [
        {
          "text": "supplier concentration",
          "strength": "strong"
        },
        {
          "text": "concentrated spend",
          "strength": "medium"
        },
        {
          "text": "too few suppliers",
          "strength": "strong"
        },
        {
          "text": "small number of suppliers",
          "strength": "strong"
        },
        {
          "text": "dependency on one supplier group",
          "strength": "medium"
        },
        {
          "text": "category concentration risk",
          "strength": "medium"
        },
        {
          "text": "most critical component exposure",
          "strength": "strong"
        },
        {
          "text": "lack of supplier diversification",
          "strength": "strong"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "unlawful processing",
          "strength": "medium"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "transport disruption",
          "strength": "strong"
        },
        {
          "text": "supplier insolvency",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "suppliers",
          "strength": "weak"
        },
        {
          "text": "vendors",
          "strength": "weak"
        },
        {
          "text": "providers",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "sourcing category",
        "supplier portfolio",
        "critical component exposure"
      ],
      "typicalCauses": [
        "concentrated sourcing",
        "insufficient diversification",
        "too few viable suppliers"
      ],
      "typicalConsequences": [
        "third_party_dependency",
        "operational_disruption",
        "direct_monetary_loss"
      ],
      "preferredRiskThemes": [
        "supplier concentration",
        "reduced sourcing resilience",
        "commercial dependency"
      ],
      "defaultMechanisms": [
        "sourcing_concentration"
      ],
      "allowedSecondaryFamilies": [
        "single_source_dependency",
        "supplier_control_weakness"
      ],
      "canCoExistWith": [
        "single_source_dependency"
      ],
      "canEscalateTo": [
        "delivery_slippage",
        "supplier_insolvency"
      ],
      "cannotBePrimaryWith": [
        "delivery_slippage",
        "logistics_disruption",
        "supplier_insolvency",
        "third_party_access_compromise"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "delivery_slippage",
        "third_party_access_compromise"
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
      "examplePhrases": [
        "a small number of suppliers account for most critical component exposure",
        "supplier concentration risk leaves little diversification across a critical category"
      ],
      "counterExamples": [
        "a supplier misses committed delivery dates and delays installation",
        "a vendor access path is compromised and used to reach internal systems"
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
      "fallbackNarrativePatterns": [
        "This is a procurement concentration issue unless the text moves into actual delay, insolvency, or compromise.",
        "Keep the scenario in the sourcing-dependency lane rather than inventing a cyber or regulatory primary event."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "supplier_concentration_risk",
      "label": "Supplier concentration risk",
      "domain": "procurement",
      "description": "Commercial dependence is concentrated across too few suppliers, reducing resilience and negotiation leverage."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "committed delivery dates",
          "strength": "strong"
        },
        {
          "text": "late delivery",
          "strength": "medium"
        },
        {
          "text": "delayed deployment",
          "strength": "strong"
        },
        {
          "text": "delayed installation",
          "strength": "medium"
        },
        {
          "text": "delivery commitments missed",
          "strength": "strong"
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
        },
        {
          "text": "transport disruption",
          "strength": "strong"
        },
        {
          "text": "route blockage",
          "strength": "strong"
        },
        {
          "text": "shipment blocked",
          "strength": "strong"
        },
        {
          "text": "supplier insolvency",
          "strength": "strong"
        },
        {
          "text": "vendor insolvency",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "internal integration work",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "supplier delivery",
        "deployment timeline",
        "logistics path"
      ],
      "typicalCauses": [
        "supplier miss",
        "delivery delay",
        "schedule slippage from supplier dependency"
      ],
      "typicalConsequences": [
        "backlog growth",
        "operational disruption",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "supplier miss",
        "delivery dependency delay",
        "supplier-led schedule slip"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "programme_delivery_slippage",
        "supplier_control_weakness",
        "logistics_disruption"
      ],
      "canCoExistWith": [
        "single_source_dependency",
        "supplier_concentration_risk",
        "logistics_disruption"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "single_source_dependency",
        "supplier_insolvency",
        "third_party_access_compromise"
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
      "examplePhrases": [
        "key supplier misses committed delivery date",
        "dependent projects are delayed by a delivery miss",
        "infrastructure deployment slips because the supplier is late"
      ],
      "counterExamples": [
        "botnet traffic overwhelms the website",
        "compromised admin credentials are used to access the tenant"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "delivery_slippage",
      "label": "Delivery slippage",
      "domain": "supply_chain",
      "description": "A supplier misses a committed delivery obligation and delays dependent deployment, installation, or project work."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "logistics disruption",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "transport disruption",
          "strength": "strong"
        },
        {
          "text": "shipping disruption",
          "strength": "strong"
        },
        {
          "text": "route blockage",
          "strength": "strong"
        },
        {
          "text": "transit disruption",
          "strength": "strong"
        },
        {
          "text": "port closure",
          "strength": "strong"
        },
        {
          "text": "customs hold",
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
        },
        {
          "text": "supplier insolvency",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "single supplier",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "shipment",
          "strength": "weak"
        },
        {
          "text": "transport",
          "strength": "weak"
        },
        {
          "text": "logistics",
          "strength": "weak"
        },
        {
          "text": "route",
          "strength": "weak"
        },
        {
          "text": "transit",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "shipment",
        "transport route",
        "critical equipment"
      ],
      "typicalCauses": [
        "transport disruption",
        "route blockage",
        "transit failure"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "transport interruption",
        "shipment blockage",
        "route failure"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "delivery_slippage"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [
        "delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "supplier_insolvency",
        "third_party_access_compromise"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "third_party_access_compromise"
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
      "examplePhrases": [
        "transport disruption blocks shipment of critical equipment and delays installation",
        "route blockage stops shipment in transit and disrupts delivery commitments"
      ],
      "counterExamples": [
        "a key supplier misses delivery dates because manufacturing is late",
        "a vendor access path is compromised and used inside the environment"
      ],
      "promptIdeaTemplates": [
        "Transport disruption blocks shipment of a critical item",
        "A logistics interruption delays installation because goods cannot move"
      ],
      "shortlistSeedThemes": [
        "shipment blockage",
        "transport interruption",
        "route failure"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the logistics lane when transport, shipment, route, or transit disruption is the explicit cause.",
        "Do not collapse a shipment blockage into generic delivery slippage when the logistics cause is the event path."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "logistics_disruption",
      "label": "Logistics disruption",
      "domain": "supply_chain",
      "description": "A transport, shipping, or transit disruption blocks physical movement of goods and delays dependent work."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 77,
      "positiveSignals": [
        {
          "text": "supplier control weakness",
          "strength": "strong"
        },
        {
          "text": "weak supplier governance",
          "strength": "strong"
        },
        {
          "text": "poor supplier governance",
          "strength": "strong"
        },
        {
          "text": "weak control processes",
          "strength": "strong"
        },
        {
          "text": "vendor control gap",
          "strength": "medium"
        },
        {
          "text": "cannot evidence adequate assurance",
          "strength": "strong"
        },
        {
          "text": "insufficient supplier assurance",
          "strength": "strong"
        },
        {
          "text": "weak control posture at supplier",
          "strength": "medium"
        },
        {
          "text": "assurance evidence is incomplete",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "credential theft",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "external vendor accounts have excessive access",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "supplier insolvency",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "supplier relationship",
        "third-party controls",
        "supplier assurance evidence"
      ],
      "typicalCauses": [
        "weak governance",
        "poor supplier controls",
        "assurance gap"
      ],
      "typicalConsequences": [
        "third-party dependency",
        "control breakdown"
      ],
      "preferredRiskThemes": [
        "supplier assurance weakness",
        "inherited control posture",
        "governance gap at a critical third party"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "vendor_access_weakness",
        "single_source_dependency"
      ],
      "canCoExistWith": [
        "supplier_concentration_risk"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "third_party_access_compromise",
        "vendor_access_weakness",
        "delivery_slippage",
        "supplier_insolvency"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
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
      "examplePhrases": [
        "a supplier has weak control processes and cannot evidence adequate assurance over critical services",
        "weak supplier governance creates inherited assurance risk without an actual compromise event"
      ],
      "counterExamples": [
        "a vendor access path is compromised and used to reach internal systems",
        "a critical supplier enters insolvency and cannot continue delivery commitments"
      ],
      "promptIdeaTemplates": [
        "A supplier cannot evidence adequate control assurance over a critical service",
        "Inherited third-party risk grows because the supplier control environment is weak"
      ],
      "shortlistSeedThemes": [
        "supplier assurance weakness",
        "inherited control posture",
        "governance gap"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the third-party governance lane when the issue is weak supplier assurance or controls rather than a live compromise or delivery miss.",
        "Do not turn supplier assurance weakness into compliance-only or cyber-compromise primary unless the text explicitly moves there."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "third-party",
      "lensLabel": "Third-party",
      "functionKey": "procurement",
      "estimatePresetKey": "thirdParty",
      "key": "supplier_control_weakness",
      "label": "Supplier control weakness",
      "domain": "third_party",
      "description": "Weak supplier governance, assurance, or control environment creates inherited third-party risk without an actual compromise or delivery event."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "vendor access weakness",
          "strength": "strong"
        },
        {
          "text": "external vendor accounts have excessive access",
          "strength": "strong"
        },
        {
          "text": "excessive third-party access",
          "strength": "strong"
        },
        {
          "text": "weak vendor access controls",
          "strength": "strong"
        },
        {
          "text": "weak segregation across critical systems",
          "strength": "strong"
        },
        {
          "text": "poorly governed external access",
          "strength": "strong"
        },
        {
          "text": "third-party remote access weakness",
          "strength": "medium"
        },
        {
          "text": "supplier access is weakly controlled",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "third-party access compromised",
          "strength": "strong"
        },
        {
          "text": "external access is not involved",
          "strength": "strong"
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
          "text": "external",
          "strength": "weak"
        },
        {
          "text": "access",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "vendor account",
        "third-party remote connection",
        "external support access"
      ],
      "typicalCauses": [
        "weak access control",
        "poor vendor oversight",
        "weak access segregation"
      ],
      "typicalConsequences": [
        "control breakdown",
        "operational disruption"
      ],
      "preferredRiskThemes": [
        "over-privileged vendor access",
        "weak segregation for external accounts",
        "inherited remote-access risk"
      ],
      "defaultMechanisms": [
        "access_control_weakness"
      ],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness",
        "identity_compromise"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [
        "third_party_access_compromise"
      ],
      "cannotBePrimaryWith": [
        "third_party_access_compromise",
        "delivery_slippage"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage",
        "cloud_control_failure"
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
      "examplePhrases": [
        "external vendor accounts have excessive access and weak segregation across critical systems",
        "vendor access into the environment is weakly controlled and creates inherited remote-access risk"
      ],
      "counterExamples": [
        "a vendor access path is compromised and used to reach internal systems",
        "internal admin credentials are abused and no third-party access path is involved"
      ],
      "promptIdeaTemplates": [
        "External vendor access is over-privileged across critical systems",
        "Weak segregation and access governance create inherited third-party access risk"
      ],
      "shortlistSeedThemes": [
        "over-privileged vendor access",
        "weak external access governance",
        "segregation weakness"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the vendor-access weakness lane when external access governance is weak but no actual compromise has occurred.",
        "Do not collapse external-access weakness into generic cyber or generic supplier governance if the vendor-access path is the issue."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "third-party",
      "lensLabel": "Third-party",
      "functionKey": "procurement",
      "estimatePresetKey": "thirdParty",
      "key": "vendor_access_weakness",
      "label": "Vendor access weakness",
      "domain": "third_party",
      "description": "Third-party accounts or remote access paths are poorly governed, over-privileged, or weakly segregated without an actual compromise event."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "supplier insolvency",
          "strength": "strong"
        },
        {
          "text": "vendor insolvency",
          "strength": "strong"
        },
        {
          "text": "supplier enters insolvency",
          "strength": "strong"
        },
        {
          "text": "supplier bankruptcy",
          "strength": "strong"
        },
        {
          "text": "vendor bankruptcy",
          "strength": "strong"
        },
        {
          "text": "financial distress at supplier",
          "strength": "strong"
        },
        {
          "text": "cannot continue delivery commitments",
          "strength": "strong"
        },
        {
          "text": "unable to continue supply",
          "strength": "strong"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "strong"
        },
        {
          "text": "dark web credentials",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "medium"
        },
        {
          "text": "customer default",
          "strength": "strong"
        },
        {
          "text": "client default",
          "strength": "strong"
        },
        {
          "text": "receivables",
          "strength": "medium"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "vendor",
          "strength": "weak"
        },
        {
          "text": "provider",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "critical supplier relationship",
        "outsourced service",
        "delivery commitment"
      ],
      "typicalCauses": [
        "supplier insolvency",
        "financial distress",
        "bankruptcy"
      ],
      "typicalConsequences": [
        "third-party dependency",
        "operational disruption",
        "legal exposure",
        "direct_monetary_loss"
      ],
      "preferredRiskThemes": [
        "supplier financial failure",
        "delivery capacity collapse from insolvency",
        "vendor continuity loss"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "delivery_slippage",
        "contract_liability"
      ],
      "canCoExistWith": [
        "single_source_dependency",
        "supplier_concentration_risk"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "delivery_slippage",
        "counterparty_default"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "counterparty_default"
      ],
      "defaultOverlays": [
        "third_party_dependency",
        "operational_disruption",
        "legal_exposure",
        "direct_monetary_loss"
      ],
      "overlaysThatMustNeverPromotePrimary": [
        "direct_monetary_loss"
      ],
      "overlaysThatMayPromoteOnlyWithExplicitSignals": [
        "direct_monetary_loss",
        "regulatory_scrutiny",
        "data_exposure",
        "customer_harm"
      ],
      "examplePhrases": [
        "a critical supplier enters insolvency and cannot continue delivery commitments",
        "vendor bankruptcy prevents continued supply into a critical service path"
      ],
      "counterExamples": [
        "a major client files for bankruptcy and receivables are at risk",
        "a key supplier misses delivery dates but remains financially viable"
      ],
      "promptIdeaTemplates": [
        "A critical supplier enters insolvency and cannot continue supply commitments",
        "Financial distress at a key vendor disrupts continuity of supply"
      ],
      "shortlistSeedThemes": [
        "supplier bankruptcy",
        "vendor financial failure",
        "supply continuity loss"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the supplier-insolvency lane when the vendor cannot continue supply because of financial distress.",
        "Do not collapse supplier insolvency into generic finance or generic delivery delay when the supplier failure is explicit."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "third-party",
      "lensKey": "third-party",
      "lensLabel": "Third-party",
      "functionKey": "procurement",
      "estimatePresetKey": "thirdParty",
      "key": "supplier_insolvency",
      "label": "Supplier insolvency",
      "domain": "third_party",
      "description": "A supplier or provider enters financial distress or insolvency and cannot continue supply or delivery commitments."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
        },
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "missed delivery date",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "logistics disruption",
          "strength": "strong"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "programme milestone",
        "deployment plan",
        "dependent project"
      ],
      "typicalCauses": [
        "delivery miss",
        "dependency slippage"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "third-party dependency"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "delivery_slippage",
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "dependent business projects are delayed",
        "go-live is pushed back by a supplier miss",
        "programme milestone slips after delayed deployment"
      ],
      "counterExamples": [
        "public website flooded by hostile traffic",
        "dark-web credentials expose the tenant"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "transformation-delivery",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "transformationDelivery",
      "key": "programme_delivery_slippage",
      "label": "Programme delivery slippage",
      "domain": "strategic_transformation",
      "description": "A delivery-critical dependency slips and delays a programme, go-live, or dependent change milestone."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "integration programme",
        "deal thesis"
      ],
      "typicalCauses": [
        "poor integration execution",
        "unmet synergy assumption"
      ],
      "typicalConsequences": [
        "operational disruption",
        "direct monetary loss"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "benefits_realisation_failure",
        "portfolio_execution_drift"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "integration failure erodes synergy",
        "post-deal integration risk grows"
      ],
      "counterExamples": [
        "DDoS traffic degrades customer services",
        "supplier workforce faces forced labour allegation"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "investment-jv",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "investmentJv",
      "key": "integration_failure",
      "label": "Integration failure",
      "domain": "strategic_transformation",
      "description": "Integration assumptions or execution fail to deliver the intended operating model or synergy."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "portfolio",
        "strategic plan"
      ],
      "typicalCauses": [
        "execution drift",
        "weak prioritisation"
      ],
      "typicalConsequences": [
        "operational disruption",
        "reputational damage"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "portfolio execution drifts from plan",
        "strategic initiative slips across the portfolio"
      ],
      "counterExamples": [
        "customer portal is overwhelmed by hostile traffic",
        "privacy obligation is breached by unlawful processing"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "strategic",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "strategic",
      "key": "portfolio_execution_drift",
      "label": "Portfolio execution drift",
      "domain": "strategic_transformation",
      "description": "Portfolio or strategy execution drifts away from the intended plan or prioritisation."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "change programme",
        "benefits case"
      ],
      "typicalCauses": [
        "execution weakness",
        "missed benefits"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "reputational damage"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "programme_delivery_slippage"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "programme benefits are not being realised",
        "expected value from the change is slipping"
      ],
      "counterExamples": [
        "website flood creates outage",
        "supplier workforce faces modern slavery claim"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "strategic",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "strategic",
      "key": "benefits_realisation_failure",
      "label": "Benefits realisation failure",
      "domain": "strategic_transformation",
      "description": "Expected benefits from a change programme are not being realised through execution."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "market entry plan",
        "cross-border route"
      ],
      "typicalCauses": [
        "trade restriction",
        "geopolitical shift",
        "sovereign measure"
      ],
      "typicalConsequences": [
        "operational disruption",
        "regulatory scrutiny"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "sanctions_breach",
        "logistics_disruption"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "sanctions or tariff changes restrict market access",
        "cross-border restriction blocks execution"
      ],
      "counterExamples": [
        "botnet overwhelms the public site",
        "forced labour allegation emerges in a supplier workforce"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "geopolitical",
      "lensKey": "strategic",
      "lensLabel": "Strategic",
      "functionKey": "strategic",
      "estimatePresetKey": "geopolitical",
      "key": "market_access_restriction",
      "label": "Market access restriction",
      "domain": "strategic_transformation",
      "description": "External restrictions or geopolitical measures reduce market access or execution viability."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 75,
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
      "typicalAssets": [
        "integration programme",
        "workstream governance",
        "target operating model"
      ],
      "typicalCauses": [
        "coordination breakdown",
        "weak programme ownership",
        "dependency slippage"
      ],
      "typicalConsequences": [
        "operational disruption",
        "direct_monetary_loss",
        "backlog_growth"
      ],
      "preferredRiskThemes": [
        "integration coordination failure",
        "workstream drift",
        "operating-model delay"
      ],
      "defaultMechanisms": [
        "coordination_breakdown",
        "dependency_failure"
      ],
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
      "cannotBePrimaryWith": [
        "delivery_slippage"
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
      "examplePhrases": [
        "the post-merger integration programme loses control of key workstreams",
        "integration governance breaks down and delays target operating model delivery"
      ],
      "counterExamples": [
        "malicious traffic overwhelms the public website",
        "privacy obligations are breached through unlawful processing"
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
      "fallbackNarrativePatterns": [
        "Treat the failing integration programme as the event path rather than a generic strategic underperformance statement.",
        "Keep upstream supplier delay or cost pressure as supporting factors unless they are the explicit event family."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "transformation-delivery",
      "lensKey": "transformation-delivery",
      "lensLabel": "Transformation delivery",
      "functionKey": "strategic",
      "estimatePresetKey": "transformationDelivery",
      "key": "integration_programme_failure",
      "label": "Integration programme failure",
      "domain": "strategic_transformation",
      "description": "A major integration programme fails to coordinate dependencies, ownership, or execution, undermining the intended operating change."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 85,
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
        },
        {
          "text": "exploitative labour practices",
          "strength": "medium"
        },
        {
          "text": "labour exploitation",
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
        },
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "delivery date",
          "strength": "medium"
        },
        {
          "text": "documentation standards",
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
          "text": "human rights abuse",
          "strength": "medium"
        },
        {
          "text": "exploitative labour practices",
          "strength": "medium"
        },
        {
          "text": "labour exploitation",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "supplier workforce",
        "labour conditions",
        "supply base"
      ],
      "typicalCauses": [
        "weak due diligence",
        "poor labour oversight",
        "human-rights control failure"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "reputational damage",
        "third-party dependency",
        "legal exposure"
      ],
      "preferredRiskThemes": [
        "human-rights abuse",
        "supply-base exploitation",
        "supplier due-diligence failure"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "supplier_control_weakness",
        "policy_breach"
      ],
      "canCoExistWith": [
        "supplier_control_weakness",
        "contract_liability"
      ],
      "canEscalateTo": [
        "policy_breach",
        "contract_liability"
      ],
      "cannotBePrimaryWith": [
        "single_source_dependency",
        "supplier_concentration_risk"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "payment_control_failure",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "reputational_damage",
        "third_party_dependency",
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
      "examplePhrases": [
        "sub-tier suppliers are found to be using forced labour conditions",
        "modern slavery allegations emerge in a supplier workforce after due diligence missed the abuse"
      ],
      "counterExamples": [
        "a supplier misses delivery dates and documentation standards",
        "payment approval control fails"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "esg",
      "lensKey": "esg",
      "lensLabel": "ESG",
      "functionKey": "strategic",
      "estimatePresetKey": "esg",
      "key": "forced_labour_modern_slavery",
      "label": "Forced labour / modern slavery",
      "domain": "esg_hse_people",
      "description": "Human-rights abuse, forced labour, modern slavery, or exploitative labour practices are the event path, even when suppliers or third parties are involved."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 83,
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
        },
        {
          "text": "public sustainability claims",
          "strength": "medium"
        },
        {
          "text": "unsupported sustainability claims",
          "strength": "medium"
        },
        {
          "text": "claims differ materially from actual practice",
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
        },
        {
          "text": "internal environmental reporting process",
          "strength": "medium"
        },
        {
          "text": "privacy obligations",
          "strength": "medium"
        },
        {
          "text": "records retention",
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
        },
        {
          "text": "public sustainability claims",
          "strength": "medium"
        },
        {
          "text": "unsupported sustainability claims",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "disclosure process",
        "sustainability claim"
      ],
      "typicalCauses": [
        "weak evidence",
        "claim gap",
        "claim-practice mismatch"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "reputational damage",
        "legal exposure"
      ],
      "preferredRiskThemes": [
        "unsupported ESG claim",
        "claim-practice mismatch",
        "weak disclosure substantiation"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "policy_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [
        "policy_breach",
        "regulatory_filing_failure"
      ],
      "cannotBePrimaryWith": [
        "policy_breach"
      ],
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
      "examplePhrases": [
        "public sustainability claims cannot be evidenced and differ materially from actual operating practice",
        "a sustainability disclosure cannot be supported credibly"
      ],
      "counterExamples": [
        "an internal environmental reporting process was not followed",
        "admin credentials used to access tenant"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "esg",
      "lensKey": "esg",
      "lensLabel": "ESG",
      "functionKey": "strategic",
      "estimatePresetKey": "esg",
      "key": "greenwashing_disclosure_gap",
      "label": "Greenwashing / disclosure gap",
      "domain": "esg_hse_people",
      "description": "Public sustainability claims, ESG statements, or climate disclosures cannot be evidenced or differ materially from actual practice."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 81,
      "positiveSignals": [
        {
          "text": "safety incident",
          "strength": "medium"
        },
        {
          "text": "site safety incident",
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
          "text": "unsafe operating conditions",
          "strength": "medium"
        },
        {
          "text": "worker harmed",
          "strength": "medium"
        },
        {
          "text": "worker harm",
          "strength": "medium"
        },
        {
          "text": "contractor safety incident",
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
        },
        {
          "text": "customer portal",
          "strength": "medium"
        },
        {
          "text": "service degradation",
          "strength": "medium"
        },
        {
          "text": "delivery date",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "safety incident",
          "strength": "medium"
        },
        {
          "text": "site safety incident",
          "strength": "medium"
        },
        {
          "text": "injury",
          "strength": "medium"
        },
        {
          "text": "worker harmed",
          "strength": "medium"
        },
        {
          "text": "worker harm",
          "strength": "medium"
        },
        {
          "text": "unsafe condition",
          "strength": "medium"
        },
        {
          "text": "unsafe operating conditions",
          "strength": "medium"
        },
        {
          "text": "contractor safety incident",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "worker",
        "site operation",
        "safety control"
      ],
      "typicalCauses": [
        "unsafe condition",
        "site-safety control lapse",
        "unsafe work practice"
      ],
      "typicalConsequences": [
        "operational disruption",
        "regulatory scrutiny",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "worker safety harm",
        "site-safety control failure",
        "unsafe operating condition"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "workforce_fatigue_staffing_weakness",
        "environmental_spill"
      ],
      "canCoExistWith": [
        "workforce_fatigue_staffing_weakness",
        "environmental_spill"
      ],
      "canEscalateTo": [
        "environmental_spill"
      ],
      "cannotBePrimaryWith": [
        "process_breakdown",
        "service_delivery_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
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
      "examplePhrases": [
        "unsafe operating conditions lead to a site safety incident with potential worker harm",
        "a contractor safety incident halts activity at a critical site"
      ],
      "counterExamples": [
        "a customer-facing service becomes unstable because of platform defects",
        "payment released through control gap"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "hse",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "hse",
      "key": "safety_incident",
      "label": "Safety incident",
      "domain": "esg_hse_people",
      "description": "Unsafe conditions, site-safety failure, or an incident with explicit worker or public safety harm is the event path."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 80,
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
        },
        {
          "text": "containment failure",
          "strength": "medium"
        },
        {
          "text": "harmful material release",
          "strength": "medium"
        },
        {
          "text": "environmental discharge",
          "strength": "medium"
        },
        {
          "text": "contamination",
          "strength": "medium"
        },
        {
          "text": "pollution event",
          "strength": "medium"
        },
        {
          "text": "loss of containment",
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
        },
        {
          "text": "internal environmental reporting process",
          "strength": "medium"
        },
        {
          "text": "sustainability claims",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
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
          "text": "containment failure",
          "strength": "medium"
        },
        {
          "text": "harmful material release",
          "strength": "medium"
        },
        {
          "text": "environmental discharge",
          "strength": "medium"
        },
        {
          "text": "contamination",
          "strength": "medium"
        },
        {
          "text": "pollution event",
          "strength": "medium"
        },
        {
          "text": "loss of containment",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "site operation",
        "environmental control"
      ],
      "typicalCauses": [
        "containment failure",
        "release event",
        "loss of containment"
      ],
      "typicalConsequences": [
        "legal exposure",
        "regulatory scrutiny",
        "reputational damage",
        "operational disruption"
      ],
      "preferredRiskThemes": [
        "containment failure",
        "harmful release",
        "pollution event"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "safety_incident"
      ],
      "canCoExistWith": [
        "safety_incident"
      ],
      "canEscalateTo": [
        "policy_breach"
      ],
      "cannotBePrimaryWith": [
        "policy_breach"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "legal_exposure",
        "regulatory_scrutiny",
        "reputational_damage",
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
      "examplePhrases": [
        "a containment failure leads to release of harmful material into the surrounding environment",
        "an environmental spill triggers response and remediation"
      ],
      "counterExamples": [
        "an internal environmental reporting process was not followed",
        "customer default creates write-off"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "hse",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "hse",
      "key": "environmental_spill",
      "label": "Environmental spill",
      "domain": "esg_hse_people",
      "description": "A spill, discharge, contamination, or harmful release to the environment is the event path rather than a generic compliance consequence."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 78,
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
          "text": "sustained understaffing",
          "strength": "medium"
        },
        {
          "text": "unsafe staffing levels",
          "strength": "medium"
        },
        {
          "text": "staffing pressure",
          "strength": "medium"
        },
        {
          "text": "workforce strain",
          "strength": "medium"
        },
        {
          "text": "shift coverage weakness",
          "strength": "medium"
        },
        {
          "text": "fatigue",
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
        },
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "delivery date",
          "strength": "medium"
        },
        {
          "text": "environmental spill",
          "strength": "medium"
        },
        {
          "text": "sustainability claims",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "workforce fatigue",
          "strength": "medium"
        },
        {
          "text": "staffing weakness",
          "strength": "medium"
        },
        {
          "text": "understaffed",
          "strength": "medium"
        },
        {
          "text": "sustained understaffing",
          "strength": "medium"
        },
        {
          "text": "unsafe staffing levels",
          "strength": "medium"
        },
        {
          "text": "staffing pressure",
          "strength": "medium"
        },
        {
          "text": "fatigue",
          "strength": "medium"
        },
        {
          "text": "shift coverage weakness",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "workforce",
        "shift coverage",
        "critical team"
      ],
      "typicalCauses": [
        "fatigue",
        "staffing shortfall",
        "coverage weakness"
      ],
      "typicalConsequences": [
        "operational disruption",
        "control_breakdown",
        "reputational_damage"
      ],
      "preferredRiskThemes": [
        "safe-staffing weakness",
        "fatigue buildup",
        "workforce resilience strain"
      ],
      "defaultMechanisms": [
        "fatigue_staffing_pressure"
      ],
      "allowedSecondaryFamilies": [
        "safety_incident",
        "critical_staff_dependency"
      ],
      "canCoExistWith": [
        "safety_incident",
        "critical_staff_dependency"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "control_breakdown",
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
      "examplePhrases": [
        "sustained understaffing and fatigue increase the likelihood of unsafe delivery and control failure",
        "staffing weakness affects safe delivery over repeated shifts"
      ],
      "counterExamples": [
        "hostile traffic overwhelms the public website",
        "supplier delivery miss delays programme"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "people-workforce",
      "lensLabel": "People / workforce",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "key": "workforce_fatigue_staffing_weakness",
      "label": "Workforce fatigue / staffing weakness",
      "domain": "esg_hse_people",
      "description": "Sustained fatigue, understaffing, or workforce coverage weakness becomes a people-led resilience problem rather than generic operational capacity noise."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 77,
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
        },
        {
          "text": "small number of individuals",
          "strength": "medium"
        },
        {
          "text": "absence would materially disrupt execution",
          "strength": "medium"
        },
        {
          "text": "knowledge concentration",
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
        },
        {
          "text": "supplier delay",
          "strength": "medium"
        },
        {
          "text": "portfolio execution drift",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
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
        },
        {
          "text": "small number of individuals",
          "strength": "medium"
        },
        {
          "text": "absence would materially disrupt execution",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "critical team",
        "specialist role",
        "operational knowledge"
      ],
      "typicalCauses": [
        "key-person dependency",
        "insufficient cross-training",
        "knowledge concentration"
      ],
      "typicalConsequences": [
        "operational_disruption",
        "recovery_strain",
        "backlog_growth"
      ],
      "preferredRiskThemes": [
        "key-person fragility",
        "knowledge concentration",
        "people resilience gap"
      ],
      "defaultMechanisms": [
        "key_person_concentration"
      ],
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
      "cannotBePrimaryWith": [
        "identity_compromise"
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
      "examplePhrases": [
        "only one critical specialist can restore the platform",
        "delivery depends on a very small number of trained staff"
      ],
      "counterExamples": [
        "hostile traffic floods the website",
        "fake invoices are used to trigger payment release"
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
      "fallbackNarrativePatterns": [
        "Treat the dependence on a small critical team as the event path, not a generic operations issue.",
        "Keep any outage or backlog effects as overlays unless the text says a different primary event occurred first."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "people-workforce",
      "lensLabel": "People / workforce",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "key": "critical_staff_dependency",
      "label": "Critical staff dependency",
      "domain": "esg_hse_people",
      "description": "Delivery or resilience depends on too few critical people, creating a people-led fragility in the operating model."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 80,
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
        },
        {
          "text": "unauthorised site access",
          "strength": "medium"
        },
        {
          "text": "unauthorized site access",
          "strength": "medium"
        },
        {
          "text": "restricted operations area",
          "strength": "medium"
        },
        {
          "text": "restricted area entered",
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
          "text": "no failover",
          "strength": "medium"
        },
        {
          "text": "industrial control",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "site perimeter",
        "facility",
        "restricted operations area"
      ],
      "typicalCauses": [
        "intrusion",
        "perimeter weakness",
        "access-control lapse"
      ],
      "typicalConsequences": [
        "operational disruption",
        "control breakdown",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "restricted-area intrusion",
        "badge and visitor control failure",
        "protective-security weakness"
      ],
      "defaultMechanisms": [
        "access_control_weakness"
      ],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [
        "ot_resilience_failure"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "process_breakdown",
        "service_delivery_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "control_breakdown",
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
      "examplePhrases": [
        "an unauthorised person bypasses facility controls into a restricted operations area",
        "site intrusion bypasses the perimeter and exposes a restricted area"
      ],
      "counterExamples": [
        "botnet traffic floods the website",
        "weak payment approval control releases funds"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "physical-security",
      "lensKey": "physical-security",
      "lensLabel": "Physical security",
      "functionKey": "operations",
      "estimatePresetKey": "physicalSecurity",
      "key": "perimeter_breach",
      "label": "Perimeter breach",
      "domain": "physical_ot",
      "description": "Physical intrusion, unauthorised site access, or protective-security control failure compromises a facility or restricted area."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "facility",
        "badge control",
        "visitor process"
      ],
      "typicalCauses": [
        "badge control weakness",
        "visitor management lapse"
      ],
      "typicalConsequences": [
        "control breakdown",
        "operational disruption"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "perimeter_breach"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "badge control lapse exposes the site",
        "visitor management failure creates facility risk"
      ],
      "counterExamples": [
        "website flood degrades customer services",
        "counterparty default weakens collections"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "perimeter_breach",
      "legacyKey": "physical-security",
      "lensKey": "physical-security",
      "lensLabel": "Physical security",
      "functionKey": "operations",
      "estimatePresetKey": "physicalSecurity",
      "key": "facility_access_lapse",
      "label": "Facility access lapse",
      "domain": "physical_ot",
      "description": "Compatibility alias for perimeter breach when the physical-security event is described as a badge, visitor, or access-control lapse."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 81,
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
        },
        {
          "text": "industrial control environment becomes unstable",
          "strength": "medium"
        },
        {
          "text": "operational technology environment becomes unstable",
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
        },
        {
          "text": "public website",
          "strength": "medium"
        },
        {
          "text": "customer portal",
          "strength": "medium"
        },
        {
          "text": "dark web credentials",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "ot",
          "strength": "medium"
        },
        {
          "text": "operational technology",
          "strength": "medium"
        },
        {
          "text": "industrial control",
          "strength": "medium"
        },
        {
          "text": "ics",
          "strength": "medium"
        },
        {
          "text": "scada",
          "strength": "medium"
        },
        {
          "text": "control room",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "industrial control environment",
        "OT environment",
        "site systems",
        "control room"
      ],
      "typicalCauses": [
        "industrial control instability",
        "OT resilience gap",
        "controller instability"
      ],
      "typicalConsequences": [
        "operational disruption",
        "recovery strain",
        "service outage"
      ],
      "preferredRiskThemes": [
        "industrial control instability",
        "site-system resilience weakness",
        "OT operations pressure"
      ],
      "defaultMechanisms": [
        "industrial_control_instability"
      ],
      "allowedSecondaryFamilies": [
        "perimeter_breach"
      ],
      "canCoExistWith": [
        "perimeter_breach"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "availability_attack",
        "service_delivery_failure",
        "platform_instability"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "operational_disruption",
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
      "examplePhrases": [
        "an industrial control environment becomes unstable and site operations cannot be sustained safely",
        "OT resilience weakness destabilises site systems"
      ],
      "counterExamples": [
        "website is slowed by hostile traffic",
        "privacy obligation breached through unlawful processing"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ot-resilience",
      "lensKey": "ot-resilience",
      "lensLabel": "OT / site resilience",
      "functionKey": "operations",
      "estimatePresetKey": "otResilience",
      "key": "ot_resilience_failure",
      "label": "OT resilience failure",
      "domain": "physical_ot",
      "description": "Operational technology, industrial control, or site-system instability makes operations hard to sustain safely, without turning every technical outage into an OT event."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.4-2026-04-04",
      "priorityScore": 50,
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
      "typicalAssets": [
        "control room",
        "ICS",
        "SCADA"
      ],
      "typicalCauses": [
        "instability",
        "control failure"
      ],
      "typicalConsequences": [
        "operational disruption",
        "recovery strain"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
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
      "examplePhrases": [
        "control room instability affects operations",
        "ICS disruption creates site outage"
      ],
      "counterExamples": [
        "botnet traffic overwhelms the public website",
        "supplier delay pushes back deployment"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "ot_resilience_failure",
      "legacyKey": "ot-resilience",
      "lensKey": "ot-resilience",
      "lensLabel": "OT / site resilience",
      "functionKey": "operations",
      "estimatePresetKey": "otResilience",
      "key": "industrial_control_instability",
      "label": "Industrial control instability",
      "domain": "physical_ot",
      "description": "Compatibility alias for OT resilience failure when the visible pattern is ICS, SCADA, or control-room instability."
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
