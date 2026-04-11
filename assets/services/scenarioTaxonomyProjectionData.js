(function (globalScope) {
  'use strict';
  globalScope.__SCENARIO_TAXONOMY_PROJECTION_DATA__ = {
  "taxonomyVersion": "phase1.1.19-2026-04-10",
  "domains": [
    {
      "key": "cyber",
      "label": "Cyber"
    },
    {
      "key": "ai_model",
      "label": "AI / Model Risk"
    },
    {
      "key": "data_governance",
      "label": "Data Governance / Privacy"
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 50,
      "positiveSignals": [
        {
          "text": "ransomware",
          "strength": "strong"
        },
        {
          "text": "encrypts systems",
          "strength": "strong"
        },
        {
          "text": "systems locked",
          "strength": "strong"
        },
        {
          "text": "servers encrypted",
          "strength": "strong"
        },
        {
          "text": "encrypt server",
          "strength": "strong"
        },
        {
          "text": "encrypt files",
          "strength": "strong"
        },
        {
          "text": "unlock files",
          "strength": "strong"
        },
        {
          "text": "payment to unlock",
          "strength": "strong"
        },
        {
          "text": "pending payment",
          "strength": "medium"
        },
        {
          "text": "ask for money",
          "strength": "medium"
        },
        {
          "text": "attackers ask for money",
          "strength": "strong"
        },
        {
          "text": "ransom note",
          "strength": "strong"
        },
        {
          "text": "extortion malware",
          "strength": "medium"
        },
        {
          "text": "extortion demand",
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
        "hackers encrypt servers and demand payment to unlock files",
        "extortion event after initial access"
      ],
      "counterExamples": [
        "forced labour allegation in a supplier workforce",
        "regulatory filing submitted late"
      ],
      "promptIdeaTemplates": [
        "Critical servers are encrypted and operations halt while attackers demand payment to unlock files",
        "Ransomware disruption creates recovery strain and extortion pressure across core services"
      ],
      "shortlistSeedThemes": [
        "ransomware outage",
        "extortion after encryption"
      ],
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "hostile traffic saturation",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "misrouted disclosure",
          "strength": "strong"
        },
        {
          "text": "misdirected disclosure",
          "strength": "strong"
        },
        {
          "text": "wrong recipient disclosure",
          "strength": "strong"
        },
        {
          "text": "personal data sent to the wrong recipient",
          "strength": "strong"
        },
        {
          "text": "exposing bank details to the wrong employees",
          "strength": "strong"
        },
        {
          "text": "bank details exposed to the wrong employees",
          "strength": "strong"
        },
        {
          "text": "bank details to the wrong employees",
          "strength": "strong"
        },
        {
          "text": "misroutes salary payments",
          "strength": "medium"
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
          "text": "misrouted disclosure",
          "strength": "strong"
        },
        {
          "text": "misdirected disclosure",
          "strength": "strong"
        },
        {
          "text": "wrong recipient disclosure",
          "strength": "strong"
        },
        {
          "text": "personal data sent to the wrong recipient",
          "strength": "strong"
        },
        {
          "text": "exposing bank details to the wrong employees",
          "strength": "strong"
        },
        {
          "text": "bank details exposed to the wrong employees",
          "strength": "strong"
        },
        {
          "text": "bank details to the wrong employees",
          "strength": "strong"
        },
        {
          "text": "misroutes salary payments",
          "strength": "medium"
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "insider information",
          "strength": "medium"
        },
        {
          "text": "inside information",
          "strength": "medium"
        },
        {
          "text": "material non-public",
          "strength": "medium"
        },
        {
          "text": "material non public",
          "strength": "medium"
        },
        {
          "text": "blackout period",
          "strength": "medium"
        },
        {
          "text": "trading window",
          "strength": "medium"
        },
        {
          "text": "disclosure controls",
          "strength": "medium"
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "vendor is compromised",
          "strength": "strong"
        },
        {
          "text": "compromised vendor",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 87,
      "positiveSignals": [
        {
          "text": "llm assistant",
          "strength": "medium"
        },
        {
          "text": "copilot",
          "strength": "medium"
        },
        {
          "text": "biased summarization",
          "strength": "medium"
        },
        {
          "text": "arabic translation",
          "strength": "medium"
        },
        {
          "text": "multilingual validation",
          "strength": "medium"
        },
        {
          "text": "language handling weakness",
          "strength": "medium"
        },
        {
          "text": "pilot validation",
          "strength": "medium"
        },
        {
          "text": "unsafe deployment readiness",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "unauthorized access",
          "strength": "medium"
        },
        {
          "text": "vendor collusion",
          "strength": "medium"
        },
        {
          "text": "retention schedule breach",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "AI assistant",
        "decision-support workflow",
        "pilot validation pack"
      ],
      "typicalCauses": [
        "weak multilingual validation",
        "translation loss",
        "biased output behaviour"
      ],
      "typicalConsequences": [
        "control breakdown",
        "reputational damage",
        "customer harm"
      ],
      "preferredRiskThemes": [
        "multilingual model bias",
        "unsafe deployment readiness",
        "translation-driven distortion"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "cloud_control_failure",
        "award_process_manipulation"
      ],
      "defaultOverlays": [
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
        "an LLM assistant overweights polished English submissions and misses technical caveats in Arabic attachments",
        "pilot testing finds multilingual summarization bias before broader deployment"
      ],
      "counterExamples": [
        "a bid portal is accessed by an unauthorized party",
        "vendors collude during an award process"
      ],
      "promptIdeaTemplates": [
        "A multilingual copilot looks deployment-ready until validation reveals systematic bias across translated content",
        "Model summarization quality is uneven across languages and undermines decision support"
      ],
      "shortlistSeedThemes": [
        "multilingual validation gap",
        "translation-driven bias",
        "unsafe AI pilot readiness"
      ],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ai-model-risk",
      "lensKey": "ai-model-risk",
      "lensLabel": "AI / model risk",
      "functionKey": "technology",
      "estimatePresetKey": "aiModelRisk",
      "key": "multilingual_validation_bias",
      "label": "Multilingual validation bias",
      "domain": "ai_model",
      "description": "A model or copilot behaves unevenly across language, translation, or representation conditions because validation was not strong enough for the deployed context."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "forecasting model",
          "strength": "medium"
        },
        {
          "text": "model drift",
          "strength": "medium"
        },
        {
          "text": "recalibration",
          "strength": "medium"
        },
        {
          "text": "customer mix shift",
          "strength": "medium"
        },
        {
          "text": "monitoring failure",
          "strength": "medium"
        },
        {
          "text": "capacity reservations",
          "strength": "medium"
        },
        {
          "text": "decision-support reliability erosion",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "supplier corruption",
          "strength": "medium"
        },
        {
          "text": "factory control-system outage",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "planning model",
        "monitoring dashboard",
        "capacity commitment process"
      ],
      "typicalCauses": [
        "environmental drift",
        "weak recalibration trigger",
        "outdated monitoring thresholds"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "operational disruption",
        "backlog growth"
      ],
      "preferredRiskThemes": [
        "planning-model drift",
        "monitoring and recalibration failure",
        "decision-support erosion"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "cloud_control_failure",
        "counterparty_default"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "a capacity-planning model drifts after customer patterns change and recalibration never occurs",
        "monitoring does not trigger challenge even though the model environment has shifted materially"
      ],
      "counterExamples": [
        "malicious tampering changes the model code",
        "a supplier reallocates production capacity away from the enterprise"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ai-model-risk",
      "lensKey": "ai-model-risk",
      "lensLabel": "AI / model risk",
      "functionKey": "technology",
      "estimatePresetKey": "aiModelRisk",
      "key": "model_drift_monitoring_failure",
      "label": "Model drift monitoring failure",
      "domain": "ai_model",
      "description": "A previously valid model is kept in use after the operating environment changes materially and monitoring fails to trigger recalibration or challenge."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 85,
      "positiveSignals": [
        {
          "text": "retraining",
          "strength": "medium"
        },
        {
          "text": "population segment",
          "strength": "medium"
        },
        {
          "text": "human in the loop",
          "strength": "medium"
        },
        {
          "text": "subgroup validation",
          "strength": "medium"
        },
        {
          "text": "fairness degradation",
          "strength": "medium"
        },
        {
          "text": "workflow reliance",
          "strength": "medium"
        },
        {
          "text": "precision trade-off",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "data retention schedule",
          "strength": "medium"
        },
        {
          "text": "contractual limitation-of-liability",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "decision-support model",
        "subgroup validation pack",
        "human-review workflow"
      ],
      "typicalCauses": [
        "underrepresented retraining data",
        "weak subgroup validation",
        "overreliance on rankings"
      ],
      "typicalConsequences": [
        "customer harm",
        "control breakdown",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "subgroup fairness failure",
        "human-oversight overreliance",
        "unsafe retraining release"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "privacy_governance_gap",
        "industrial_control_instability"
      ],
      "defaultOverlays": [
        "customer_harm",
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
        "retraining improves precision overall but worsens outcomes for a smaller population segment",
        "human reviewers remain in the loop but increasingly rely on the model ranking"
      ],
      "counterExamples": [
        "a hacker exposes the dataset externally",
        "a privacy team flags a retention schedule mismatch before retraining starts"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ai-model-risk",
      "lensKey": "ai-model-risk",
      "lensLabel": "AI / model risk",
      "functionKey": "technology",
      "estimatePresetKey": "aiModelRisk",
      "key": "fairness_retraining_degradation",
      "label": "Fairness degradation after retraining",
      "domain": "ai_model",
      "description": "Retraining improves aggregate performance while materially worsening subgroup outcomes or weakening real human oversight."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 88,
      "positiveSignals": [
        {
          "text": "agentic orchestration",
          "strength": "medium"
        },
        {
          "text": "unsafe tool chaining",
          "strength": "medium"
        },
        {
          "text": "authority overreach",
          "strength": "medium"
        },
        {
          "text": "fallback framework",
          "strength": "medium"
        },
        {
          "text": "stale policy variants",
          "strength": "medium"
        },
        {
          "text": "action recommendations exceed authority",
          "strength": "medium"
        },
        {
          "text": "end-to-end ai evaluation",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "lawful basis defect",
          "strength": "medium"
        },
        {
          "text": "emergency recovery site",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "agentic workflow",
        "tool orchestration layer",
        "authority control boundary"
      ],
      "typicalCauses": [
        "weak end-to-end evaluation",
        "immature fallback design",
        "unsafe tool sequencing"
      ],
      "typicalConsequences": [
        "control breakdown",
        "operational disruption",
        "legal exposure"
      ],
      "preferredRiskThemes": [
        "system-level AI control failure",
        "tool-chaining weakness",
        "authority-boundary overreach"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "cloud_control_failure",
        "identity_compromise",
        "business_continuity_plan_gap"
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
        "an agentic orchestration layer chains safe tools into unsafe overall behaviour",
        "action recommendations exceed business authority because fallback and control boundaries are immature"
      ],
      "counterExamples": [
        "a credential theft incident compromises the orchestration platform",
        "supplier concentration delays hardware refresh for the AI platform"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ai-model-risk",
      "lensKey": "ai-model-risk",
      "lensLabel": "AI / model risk",
      "functionKey": "technology",
      "estimatePresetKey": "aiModelRisk",
      "key": "agentic_control_boundary_failure",
      "label": "Agentic control-boundary failure",
      "domain": "ai_model",
      "description": "An agentic or tool-using AI system chains individually acceptable components into unsafe end-to-end behaviour because policy, fallback, and evaluation controls are immature."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 89,
      "positiveSignals": [
        {
          "text": "abstention failure",
          "strength": "medium"
        },
        {
          "text": "calibration failure",
          "strength": "medium"
        },
        {
          "text": "authoritative hallucination",
          "strength": "medium"
        },
        {
          "text": "stale policy retrieval",
          "strength": "medium"
        },
        {
          "text": "jurisdiction conflicts",
          "strength": "medium"
        },
        {
          "text": "confident reconciliations",
          "strength": "medium"
        },
        {
          "text": "control-sensitive copilot",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "cyber compromise",
          "strength": "medium"
        },
        {
          "text": "data misuse",
          "strength": "medium"
        },
        {
          "text": "generic compliance breach",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "policy copilot",
        "governance workflow",
        "escalation path"
      ],
      "typicalCauses": [
        "weak uncertainty handling",
        "poor calibration",
        "insufficient ambiguity evaluation"
      ],
      "typicalConsequences": [
        "control breakdown",
        "legal exposure",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "unsafe decision-support calibration",
        "failed abstention",
        "ambiguity-handling weakness"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "policy_breach",
        "privacy_governance_gap",
        "identity_compromise"
      ],
      "defaultOverlays": [
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
        "a multilingual policy copilot fails to abstain when jurisdictions conflict and stale sources look internally consistent",
        "overconfident reconciliations suppress escalation to human specialists"
      ],
      "counterExamples": [
        "a compliance team misses a filing deadline without any AI involvement",
        "hostile manipulation changes the knowledge base content"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ai-model-risk",
      "lensKey": "ai-model-risk",
      "lensLabel": "AI / model risk",
      "functionKey": "technology",
      "estimatePresetKey": "aiModelRisk",
      "key": "calibration_abstention_failure",
      "label": "Calibration and abstention failure",
      "domain": "ai_model",
      "description": "A control-sensitive AI assistant fails to abstain or escalate when evidence is stale, conflicting, or ambiguous, producing overconfident outputs."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 90,
      "positiveSignals": [
        {
          "text": "benchmark contamination",
          "strength": "medium"
        },
        {
          "text": "synthetic red-team",
          "strength": "medium"
        },
        {
          "text": "release gating",
          "strength": "medium"
        },
        {
          "text": "generalization",
          "strength": "medium"
        },
        {
          "text": "prompt-template reuse",
          "strength": "medium"
        },
        {
          "text": "arabic dialect variation",
          "strength": "medium"
        },
        {
          "text": "mixed-script queries",
          "strength": "medium"
        },
        {
          "text": "evaluation design failure",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "cyber leakage",
          "strength": "medium"
        },
        {
          "text": "data-governance defect",
          "strength": "medium"
        },
        {
          "text": "strategic platform positioning",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "benchmark suite",
        "release-gating pack",
        "red-team challenge set"
      ],
      "typicalCauses": [
        "evaluation contamination",
        "weak edge-case coverage",
        "false-confidence release governance"
      ],
      "typicalConsequences": [
        "control breakdown",
        "reputational damage",
        "customer harm"
      ],
      "preferredRiskThemes": [
        "benchmark contamination",
        "false-confidence release gating",
        "generalization overstatement"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "privacy_governance_gap",
        "portfolio_execution_drift"
      ],
      "defaultOverlays": [
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
        "benchmark tasks leak into tuning practice and overstate release readiness",
        "synthetic red-team prompts miss Arabic variation and low-frequency regulatory edge cases"
      ],
      "counterExamples": [
        "benchmark assets are stolen by an attacker",
        "the platform roadmap changes but evaluation validity remains sound"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "ai-model-risk",
      "lensKey": "ai-model-risk",
      "lensLabel": "AI / model risk",
      "functionKey": "technology",
      "estimatePresetKey": "aiModelRisk",
      "key": "evaluation_contamination_release_failure",
      "label": "Evaluation contamination and release failure",
      "domain": "ai_model",
      "description": "Benchmark design, red-team coverage, or release-gating evidence creates false confidence about model readiness and generalization."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 79,
      "positiveSignals": [
        {
          "text": "business impact analysis outdated",
          "strength": "medium"
        },
        {
          "text": "business impact analysis is stale",
          "strength": "medium"
        },
        {
          "text": "bia outdated",
          "strength": "medium"
        },
        {
          "text": "bia is stale",
          "strength": "medium"
        },
        {
          "text": "rto not defined",
          "strength": "medium"
        },
        {
          "text": "rtos are not defined",
          "strength": "medium"
        },
        {
          "text": "rpo not defined",
          "strength": "medium"
        },
        {
          "text": "recovery priorities not defined",
          "strength": "medium"
        },
        {
          "text": "alternate site not approved",
          "strength": "medium"
        },
        {
          "text": "alternate workspace not approved",
          "strength": "medium"
        },
        {
          "text": "manual fallback not documented",
          "strength": "medium"
        },
        {
          "text": "continuity plan not tested",
          "strength": "medium"
        },
        {
          "text": "business continuity plan not tested",
          "strength": "medium"
        },
        {
          "text": "disaster recovery plan not tested",
          "strength": "medium"
        },
        {
          "text": "recovery plan not exercised",
          "strength": "medium"
        },
        {
          "text": "continuity exercise overdue",
          "strength": "medium"
        },
        {
          "text": "dr exercise overdue",
          "strength": "medium"
        },
        {
          "text": "call tree outdated",
          "strength": "medium"
        },
        {
          "text": "call tree has not been exercised",
          "strength": "medium"
        },
        {
          "text": "incident escalation call tree",
          "strength": "medium"
        },
        {
          "text": "incident escalation matrix missing",
          "strength": "medium"
        },
        {
          "text": "crisis communication plan missing",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "hostile traffic",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        },
        {
          "text": "supplier delay",
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
          "text": "spill",
          "strength": "medium"
        },
        {
          "text": "release to environment",
          "strength": "medium"
        },
        {
          "text": "restoration delayed",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "business impact analysis",
          "strength": "medium"
        },
        {
          "text": "bia",
          "strength": "medium"
        },
        {
          "text": "rto",
          "strength": "medium"
        },
        {
          "text": "rpo",
          "strength": "medium"
        },
        {
          "text": "alternate site",
          "strength": "medium"
        },
        {
          "text": "alternate workspace",
          "strength": "medium"
        },
        {
          "text": "manual fallback",
          "strength": "medium"
        },
        {
          "text": "continuity plan",
          "strength": "medium"
        },
        {
          "text": "disaster recovery plan",
          "strength": "medium"
        },
        {
          "text": "recovery plan",
          "strength": "medium"
        },
        {
          "text": "call tree",
          "strength": "medium"
        },
        {
          "text": "incident escalation matrix",
          "strength": "medium"
        },
        {
          "text": "crisis communication plan",
          "strength": "medium"
        },
        {
          "text": "exercise",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "continuity programme",
        "recovery plan",
        "crisis management structure"
      ],
      "typicalCauses": [
        "stale BIA",
        "untested recovery planning",
        "undefined recovery targets"
      ],
      "typicalConsequences": [
        "recovery strain",
        "operational disruption",
        "control_breakdown"
      ],
      "preferredRiskThemes": [
        "continuity planning weakness",
        "crisis-readiness gap",
        "recovery-governance drift"
      ],
      "defaultMechanisms": [
        "fallback_gap",
        "coordination_breakdown"
      ],
      "allowedSecondaryFamilies": [
        "dr_gap",
        "failover_failure",
        "recovery_coordination_failure"
      ],
      "canCoExistWith": [
        "dr_gap",
        "failover_failure"
      ],
      "canEscalateTo": [
        "dr_gap",
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
        "recovery_strain",
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
        "The business impact analysis is stale, RTOs are undefined, and the call tree has not been exercised.",
        "Alternate site arrangements are not approved and recovery plans have not been tested for the critical service."
      ],
      "counterExamples": [
        "hostile traffic floods the public website",
        "a contractor safety incident injures a worker during site activity"
      ],
      "promptIdeaTemplates": [
        "Business continuity planning is stale for a critical service",
        "Crisis escalation and recovery-readiness assumptions are not current"
      ],
      "shortlistSeedThemes": [
        "continuity planning gap",
        "BIA and recovery target weakness",
        "crisis-readiness drift"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the business continuity lane when BIA quality, RTO or RPO definition, alternate-site readiness, call trees, or continuity exercises are the visible weakness.",
        "Do not flatten stale continuity planning into generic operational issues unless a separate outage or workflow breakdown clearly happens first."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "business-continuity",
      "lensKey": "business-continuity",
      "lensLabel": "Business continuity",
      "functionKey": "operations",
      "estimatePresetKey": "businessContinuity",
      "key": "continuity_planning_gap",
      "label": "Continuity planning gap",
      "domain": "business_continuity",
      "description": "Business continuity planning, crisis readiness, or recovery governance is stale, untested, or undefined before a live disruption becomes the primary event."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "invoice splitting",
          "strength": "medium"
        },
        {
          "text": "threshold avoidance",
          "strength": "medium"
        },
        {
          "text": "approval threshold",
          "strength": "medium"
        },
        {
          "text": "consulting invoices",
          "strength": "medium"
        },
        {
          "text": "duplicate narrative",
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
        },
        {
          "text": "approval threshold",
          "strength": "medium"
        },
        {
          "text": "sourcing review",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "facilitation payment",
          "strength": "medium"
        },
        {
          "text": "improper hospitality",
          "strength": "medium"
        },
        {
          "text": "improper gift",
          "strength": "medium"
        },
        {
          "text": "gifts and entertainment",
          "strength": "medium"
        },
        {
          "text": "gift and entertainment",
          "strength": "medium"
        },
        {
          "text": "sponsored travel",
          "strength": "medium"
        },
        {
          "text": "hospitality offered to a public official",
          "strength": "medium"
        },
        {
          "text": "public official",
          "strength": "medium"
        },
        {
          "text": "intermediary onboarding shortcut",
          "strength": "medium"
        },
        {
          "text": "undisclosed conflict of interest in supplier selection",
          "strength": "medium"
        },
        {
          "text": "intermediary",
          "strength": "medium"
        },
        {
          "text": "success fee",
          "strength": "medium"
        },
        {
          "text": "opaque introductions",
          "strength": "medium"
        },
        {
          "text": "books and records",
          "strength": "medium"
        },
        {
          "text": "change orders",
          "strength": "medium"
        },
        {
          "text": "approval thresholds",
          "strength": "medium"
        },
        {
          "text": "urgency narrative",
          "strength": "medium"
        },
        {
          "text": "public-sector opportunity",
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
        },
        {
          "text": "whistleblowing retaliation",
          "strength": "medium"
        },
        {
          "text": "non-retaliation",
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
        "collusion",
        "policy_breach"
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
        "kickback scheme around approvals",
        "sponsored travel and hospitality for a public official proceeds without the required anti-bribery approvals"
      ],
      "counterExamples": [
        "public site down from hostile traffic",
        "supplier misses a logistics commitment"
      ],
      "promptIdeaTemplates": [
        "Bribery / corruption",
        "Public-official interaction bypasses anti-bribery controls and creates integrity risk"
      ],
      "shortlistSeedThemes": [
        "bribery exposure",
        "improper hospitality",
        "public-official integrity risk"
      ],
      "fallbackNarrativePatterns": [
        "Keep bribery, gifts, hospitality, facilitation payments, or public-official conduct on the integrity event path rather than collapsing it into generic policy breach.",
        "Treat any policy or approval gap as secondary if the text explicitly points to corrupt or improper-value transfer risk."
      ],
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 50,
      "positiveSignals": [
        {
          "text": "channel partner",
          "strength": "medium"
        },
        {
          "text": "reseller",
          "strength": "medium"
        },
        {
          "text": "side letter",
          "strength": "medium"
        },
        {
          "text": "return rights",
          "strength": "medium"
        },
        {
          "text": "rebate support",
          "strength": "medium"
        },
        {
          "text": "quarter-end pressure",
          "strength": "medium"
        },
        {
          "text": "incentive targets",
          "strength": "medium"
        },
        {
          "text": "sham sale",
          "strength": "medium"
        },
        {
          "text": "channel stuffing",
          "strength": "medium"
        },
        {
          "text": "proof-of-performance",
          "strength": "medium"
        },
        {
          "text": "backdated certification",
          "strength": "medium"
        },
        {
          "text": "fabricated evidence",
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
          "text": "worker fatigue",
          "strength": "medium"
        },
        {
          "text": "records retention",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "channel programme",
        "rebate process",
        "revenue-support evidence"
      ],
      "typicalCauses": [
        "concealed commercial side arrangement",
        "fabricated eligibility support",
        "quarter-end manipulation"
      ],
      "typicalConsequences": [
        "misstated revenue",
        "improper payment",
        "books-and-records exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "policy_breach",
        "payment_control_failure",
        "bribery_corruption"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
        "control_breakdown",
        "legal_exposure",
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
        "channel partner uses side letter and informal return rights to secure quarter-end revenue",
        "rebate support is promised outside the signed agreement and later evidenced with backdated certifications"
      ],
      "counterExamples": [
        "cloud region outage delays service launch",
        "major supplier misses a logistics commitment"
      ],
      "promptIdeaTemplates": [
        "Channel side-arrangement and rebate manipulation",
        "Concealed commercial side letters and fabricated eligibility support distort the transaction substance"
      ],
      "shortlistSeedThemes": [
        "channel integrity risk",
        "books-and-records distortion",
        "rebate claim abuse"
      ],
      "fallbackNarrativePatterns": [
        "Keep side letters, return rights, rebate support, or quarter-end channel manipulation on the fraud and integrity path rather than flattening it into generic finance or partner management.",
        "Treat apparently complete paperwork as secondary if the fact pattern points to fabricated commercial evidence or concealed transaction substance."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "channel_rebate_manipulation",
      "label": "Channel side-arrangement and rebate manipulation",
      "domain": "fraud_integrity",
      "description": "Concealed side letters, return rights, or rebate support distort the true substance of channel transactions."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 50,
      "positiveSignals": [
        {
          "text": "ghost workers",
          "strength": "medium"
        },
        {
          "text": "attendance logs",
          "strength": "medium"
        },
        {
          "text": "false certification",
          "strength": "medium"
        },
        {
          "text": "site coordinator",
          "strength": "medium"
        },
        {
          "text": "related party",
          "strength": "medium"
        },
        {
          "text": "undisclosed relationship",
          "strength": "medium"
        },
        {
          "text": "backdated certification",
          "strength": "medium"
        },
        {
          "text": "duplicate proof",
          "strength": "medium"
        },
        {
          "text": "fabricated evidence",
          "strength": "medium"
        },
        {
          "text": "proof-of-performance",
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
          "text": "single source dependency",
          "strength": "medium"
        },
        {
          "text": "understaffing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "supporting evidence",
        "labour certification",
        "rebate claim pack"
      ],
      "typicalCauses": [
        "evidence fabrication",
        "related-party concealment",
        "false service certification"
      ],
      "typicalConsequences": [
        "improper payment",
        "investigation pressure",
        "books-and-records exposure"
      ],
      "preferredRiskThemes": [],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "policy_breach",
        "payment_control_failure",
        "bribery_corruption"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
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
        "ghost workers are certified through attendance logs despite contradictory site evidence",
        "backdated certifications and duplicate proof-of-performance documents support an unearned rebate claim"
      ],
      "counterExamples": [
        "customer portal slows under heavy traffic",
        "supplier delivery delays a deployment milestone"
      ],
      "promptIdeaTemplates": [
        "Certification and evidence falsification",
        "False certifications or fabricated proof are used to unlock payment, credit, or approval"
      ],
      "shortlistSeedThemes": [
        "false certification",
        "related-party concealment",
        "evidence fabrication"
      ],
      "fallbackNarrativePatterns": [
        "Keep ghost workers, false certifications, fabricated proof, or undisclosed related-party ties on the fraud and integrity path rather than collapsing them into workforce or compliance process issues.",
        "Treat attendance, certification, or rebate evidence as suspect if the scenario suggests deliberate falsification rather than innocent documentation weakness."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "fraud-integrity",
      "lensKey": "fraud-integrity",
      "lensLabel": "Fraud / integrity",
      "functionKey": "finance",
      "estimatePresetKey": "fraudIntegrity",
      "key": "certification_evidence_fraud",
      "label": "Certification and evidence falsification",
      "domain": "fraud_integrity",
      "description": "False certifications, related-party concealment, or fabricated proof are used to obtain payment, credit, or approval."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "whistleblowing process not followed",
          "strength": "strong"
        },
        {
          "text": "whistleblower",
          "strength": "strong"
        },
        {
          "text": "whistleblower retaliation",
          "strength": "strong"
        },
        {
          "text": "retaliation",
          "strength": "strong"
        },
        {
          "text": "retaliation against a reporter",
          "strength": "strong"
        },
        {
          "text": "non-retaliation commitment breached",
          "strength": "strong"
        },
        {
          "text": "speak-up concern mishandled",
          "strength": "strong"
        },
        {
          "text": "speak up concern mishandled",
          "strength": "strong"
        },
        {
          "text": "investigation protocol",
          "strength": "strong"
        },
        {
          "text": "code of conduct breach",
          "strength": "strong"
        },
        {
          "text": "ethics and compliance policy",
          "strength": "medium"
        },
        {
          "text": "compliance investigation protocol not followed",
          "strength": "strong"
        },
        {
          "text": "conflict of interest is not disclosed",
          "strength": "strong"
        },
        {
          "text": "insider information policy",
          "strength": "strong"
        },
        {
          "text": "insider information",
          "strength": "medium"
        },
        {
          "text": "inside information",
          "strength": "medium"
        },
        {
          "text": "material non-public information",
          "strength": "strong"
        },
        {
          "text": "material non public information",
          "strength": "strong"
        },
        {
          "text": "blackout period",
          "strength": "strong"
        },
        {
          "text": "blackout period breached",
          "strength": "strong"
        },
        {
          "text": "disclosure controls",
          "strength": "medium"
        },
        {
          "text": "material non-public information handled improperly",
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
          "text": "public official",
          "strength": "strong"
        },
        {
          "text": "facilitation payment",
          "strength": "strong"
        },
        {
          "text": "kickback",
          "strength": "strong"
        },
        {
          "text": "gifts and entertainment",
          "strength": "strong"
        },
        {
          "text": "gift and entertainment",
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
        },
        {
          "text": "whistleblowing",
          "strength": "weak"
        },
        {
          "text": "whistleblower",
          "strength": "weak"
        },
        {
          "text": "retaliation",
          "strength": "weak"
        },
        {
          "text": "code of conduct",
          "strength": "weak"
        },
        {
          "text": "conflict of interest",
          "strength": "weak"
        },
        {
          "text": "insider information",
          "strength": "weak"
        },
        {
          "text": "material non-public information",
          "strength": "weak"
        },
        {
          "text": "blackout period",
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
        "privacy_non_compliance",
        "bribery_corruption"
      ],
      "canCoExistWith": [
        "supplier_control_weakness"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "privacy_governance_gap",
        "privacy_non_compliance",
        "records_retention_non_compliance",
        "cross_border_transfer_non_compliance",
        "regulatory_filing_failure",
        "sanctions_breach",
        "licensing_permit_issue",
        "contract_liability",
        "greenwashing_disclosure_gap",
        "bribery_corruption"
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
        "an internal governance requirement is breached because the control process was not followed",
        "a whistleblowing concern is mishandled and the reporter faces retaliation despite a non-retaliation commitment",
        "a conflict of interest is not disclosed before the approval decision proceeds"
      ],
      "counterExamples": [
        "personal data is transferred across borders without required safeguards",
        "a supplier agreement breach creates contractual liability and indemnity exposure"
      ],
      "promptIdeaTemplates": [
        "Policy breach",
        "A speak-up, investigation, or conflict-disclosure process is not followed"
      ],
      "shortlistSeedThemes": [
        "policy breach",
        "speak-up mishandling",
        "conflict disclosure failure"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the compliance lane when the wording is about ethics policy, investigations, non-retaliation, or conflict-disclosure obligations rather than a more specific privacy, sanctions, or bribery family.",
        "Do not treat insider-information or public-official wording as generic policy breach if the text clearly points to market-conduct or bribery exposure."
      ],
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 74,
      "positiveSignals": [
        {
          "text": "risk appetite",
          "strength": "strong"
        },
        {
          "text": "risk tolerance",
          "strength": "strong"
        },
        {
          "text": "outside tolerance",
          "strength": "strong"
        },
        {
          "text": "above tolerance",
          "strength": "strong"
        },
        {
          "text": "residual risk",
          "strength": "strong"
        },
        {
          "text": "inherent risk",
          "strength": "medium"
        },
        {
          "text": "risk owner",
          "strength": "strong"
        },
        {
          "text": "risk register",
          "strength": "strong"
        },
        {
          "text": "project risk register",
          "strength": "strong"
        },
        {
          "text": "risk treatment plan",
          "strength": "strong"
        },
        {
          "text": "risk treatment owner",
          "strength": "medium"
        },
        {
          "text": "key risk indicator",
          "strength": "strong"
        },
        {
          "text": "kri",
          "strength": "medium"
        },
        {
          "text": "emerging risk",
          "strength": "strong"
        },
        {
          "text": "risk committee",
          "strength": "strong"
        },
        {
          "text": "erm committee",
          "strength": "strong"
        },
        {
          "text": "principal risk",
          "strength": "medium"
        },
        {
          "text": "risk reporting cadence",
          "strength": "strong"
        },
        {
          "text": "risk aggregation",
          "strength": "medium"
        },
        {
          "text": "three lines",
          "strength": "medium"
        },
        {
          "text": "three lines model",
          "strength": "strong"
        },
        {
          "text": "risk taxonomy",
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
          "text": "dark web credentials",
          "strength": "strong"
        },
        {
          "text": "exfiltration",
          "strength": "strong"
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
          "text": "go-live delay",
          "strength": "strong"
        },
        {
          "text": "milestone slip",
          "strength": "strong"
        },
        {
          "text": "public official",
          "strength": "strong"
        },
        {
          "text": "facilitation payment",
          "strength": "strong"
        },
        {
          "text": "whistleblower",
          "strength": "strong"
        },
        {
          "text": "retaliation",
          "strength": "strong"
        },
        {
          "text": "lawful basis",
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
          "text": "contractual liability",
          "strength": "strong"
        },
        {
          "text": "forced labour",
          "strength": "strong"
        },
        {
          "text": "greenwashing",
          "strength": "strong"
        },
        {
          "text": "material non-public information",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "risk appetite",
          "strength": "weak"
        },
        {
          "text": "risk tolerance",
          "strength": "weak"
        },
        {
          "text": "outside tolerance",
          "strength": "weak"
        },
        {
          "text": "above tolerance",
          "strength": "weak"
        },
        {
          "text": "residual risk",
          "strength": "weak"
        },
        {
          "text": "risk owner",
          "strength": "weak"
        },
        {
          "text": "risk register",
          "strength": "weak"
        },
        {
          "text": "project risk register",
          "strength": "weak"
        },
        {
          "text": "risk treatment",
          "strength": "weak"
        },
        {
          "text": "key risk indicator",
          "strength": "weak"
        },
        {
          "text": "kri",
          "strength": "weak"
        },
        {
          "text": "emerging risk",
          "strength": "weak"
        },
        {
          "text": "risk committee",
          "strength": "weak"
        },
        {
          "text": "erm committee",
          "strength": "weak"
        },
        {
          "text": "risk reporting",
          "strength": "weak"
        },
        {
          "text": "three lines",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "risk register",
        "KRI dashboard",
        "risk reporting cadence",
        "treatment-plan governance"
      ],
      "typicalCauses": [
        "weak ERM governance",
        "late escalation of material risk",
        "stale risk ownership or reporting"
      ],
      "typicalConsequences": [
        "control breakdown",
        "operational disruption"
      ],
      "preferredRiskThemes": [
        "risk appetite breach",
        "KRI escalation failure",
        "residual risk acceptance gap",
        "risk register and reporting drift"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "policy_breach",
        "programme_delivery_slippage",
        "portfolio_execution_drift",
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [
        "policy_breach",
        "programme_delivery_slippage",
        "portfolio_execution_drift",
        "benefits_realisation_failure"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage",
        "portfolio_execution_drift"
      ],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "delivery_slippage",
        "greenwashing_disclosure_gap"
      ],
      "defaultOverlays": [
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
        "KRIs move above tolerance and escalation does not happen in time",
        "residual risk is accepted without the required ERM committee escalation",
        "project risk registers and treatment plans are not maintained for a material programme risk"
      ],
      "counterExamples": [
        "a public official receives sponsored travel without anti-bribery approval",
        "a key vendor misses the committed delivery date for a rollout"
      ],
      "promptIdeaTemplates": [
        "Risk Appetite / Escalation Gap",
        "Risk Governance Gap"
      ],
      "shortlistSeedThemes": [
        "risk appetite breach",
        "KRI monitoring failure",
        "residual risk acceptance gap",
        "risk register reporting drift"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the general enterprise-risk lane when the wording is about risk appetite, tolerance, KRIs, risk registers, reporting cadence, or residual-risk acceptance rather than a more specific incident family.",
        "Do not flatten enterprise-risk governance wording into generic compliance if the core issue is risk ownership, escalation, aggregation, or treatment discipline."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "general",
      "lensKey": "general",
      "lensLabel": "General enterprise risk",
      "functionKey": "general",
      "estimatePresetKey": "general",
      "key": "risk_governance_gap",
      "label": "Risk governance gap",
      "domain": "strategic_transformation",
      "description": "Enterprise-risk governance, appetite, reporting, or escalation discipline weakens, leaving material risk outside tolerance or insufficiently managed."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 80,
      "positiveSignals": [
        {
          "text": "privacy by design",
          "strength": "strong"
        },
        {
          "text": "data protection impact assessment",
          "strength": "strong"
        },
        {
          "text": "privacy impact assessment",
          "strength": "strong"
        },
        {
          "text": "dpia",
          "strength": "strong"
        },
        {
          "text": "data subject rights",
          "strength": "strong"
        },
        {
          "text": "subject access request",
          "strength": "strong"
        },
        {
          "text": "subject access requests are delayed",
          "strength": "strong"
        },
        {
          "text": "privacy governance gap",
          "strength": "strong"
        },
        {
          "text": "record of processing activities",
          "strength": "strong"
        },
        {
          "text": "record of processing activities is incomplete",
          "strength": "strong"
        },
        {
          "text": "ropa",
          "strength": "strong"
        },
        {
          "text": "controller and processor responsibilities",
          "strength": "strong"
        },
        {
          "text": "controller and processor responsibilities are unclear",
          "strength": "strong"
        },
        {
          "text": "processor responsibilities unclear",
          "strength": "strong"
        },
        {
          "text": "data processing agreement missing",
          "strength": "strong"
        },
        {
          "text": "data processing agreement has not been updated",
          "strength": "strong"
        },
        {
          "text": "privacy incident response",
          "strength": "strong"
        },
        {
          "text": "supervisory authority notification delayed",
          "strength": "strong"
        },
        {
          "text": "72-hour notification",
          "strength": "medium"
        },
        {
          "text": "dpo not consulted",
          "strength": "medium"
        },
        {
          "text": "high-risk biometric processing",
          "strength": "strong"
        },
        {
          "text": "high-risk assessment is not completed",
          "strength": "strong"
        },
        {
          "text": "health data processing not assessed",
          "strength": "strong"
        },
        {
          "text": "patient data safeguards are incomplete",
          "strength": "strong"
        },
        {
          "text": "local safeguards for sensitive data are incomplete",
          "strength": "strong"
        },
        {
          "text": "medical records access logging is weak",
          "strength": "strong"
        },
        {
          "text": "medical-records access logging is weak",
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
          "text": "privacy",
          "strength": "weak"
        },
        {
          "text": "data protection",
          "strength": "weak"
        },
        {
          "text": "personal data",
          "strength": "weak"
        },
        {
          "text": "dpia",
          "strength": "weak"
        },
        {
          "text": "subject access",
          "strength": "weak"
        },
        {
          "text": "dpo",
          "strength": "weak"
        },
        {
          "text": "controller",
          "strength": "weak"
        },
        {
          "text": "processor",
          "strength": "weak"
        },
        {
          "text": "biometric",
          "strength": "weak"
        },
        {
          "text": "sensitive data",
          "strength": "weak"
        },
        {
          "text": "health data",
          "strength": "weak"
        },
        {
          "text": "patient data",
          "strength": "weak"
        },
        {
          "text": "medical records",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "privacy management system",
        "record of processing activities",
        "data subject rights workflow",
        "sensitive personal data"
      ],
      "typicalCauses": [
        "missing DPIA",
        "weak privacy-by-design controls",
        "unclear controller-processor accountability",
        "delayed privacy incident governance"
      ],
      "typicalConsequences": [
        "regulatory scrutiny",
        "legal exposure",
        "control breakdown"
      ],
      "preferredRiskThemes": [
        "privacy governance failure",
        "DPIA or privacy-by-design gap",
        "data subject rights handling weakness",
        "sensitive-data oversight gap"
      ],
      "defaultMechanisms": [
        "unlawful_processing"
      ],
      "allowedSecondaryFamilies": [
        "privacy_non_compliance",
        "records_retention_non_compliance",
        "cross_border_transfer_non_compliance",
        "policy_breach",
        "regulatory_filing_failure"
      ],
      "canCoExistWith": [
        "privacy_non_compliance",
        "records_retention_non_compliance",
        "cross_border_transfer_non_compliance"
      ],
      "canEscalateTo": [
        "regulatory_filing_failure",
        "data_disclosure"
      ],
      "cannotBePrimaryWith": [
        "data_disclosure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "delivery_slippage",
        "bribery_corruption",
        "third_party_access_compromise"
      ],
      "defaultOverlays": [
        "regulatory_scrutiny",
        "legal_exposure",
        "control_breakdown"
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
        "A DPIA was not completed for large-scale biometric processing",
        "Data subject rights requests are delayed because privacy governance is weak",
        "Patient-data processing proceeds without the privacy-by-design and logging controls the organisation requires"
      ],
      "counterExamples": [
        "Hostile traffic slows the public website",
        "A key supplier misses committed delivery dates"
      ],
      "promptIdeaTemplates": [
        "Privacy Governance Gap",
        "Sensitive Data Oversight Gap"
      ],
      "shortlistSeedThemes": [
        "privacy governance weakness",
        "DPIA gap",
        "data subject rights handling failure",
        "health-data privacy safeguard gap"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the privacy-governance lane when the wording is about DPIAs, privacy by design, data subject rights, records of processing, controller-processor accountability, or sensitive-data oversight rather than an actual disclosure event.",
        "Let records retention or cross-border transfer take precedence only when those more specific obligation failures are explicit."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "data-governance",
      "lensKey": "data-governance",
      "lensLabel": "Data Governance / Privacy",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "privacy_governance_gap",
      "label": "Privacy governance gap",
      "domain": "data_governance",
      "description": "Privacy management controls are missing, weak, or not followed for high-risk personal or sensitive data processing."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "legacyKey": "data-governance",
      "lensKey": "data-governance",
      "lensLabel": "Data Governance / Privacy",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "privacy_non_compliance",
      "label": "Privacy non-compliance",
      "domain": "data_governance",
      "description": "A privacy or data-protection obligation is breached through unlawful processing, retention, or control failure."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "retained for too long",
          "strength": "strong"
        },
        {
          "text": "kept too long against privacy rules",
          "strength": "strong"
        },
        {
          "text": "kept beyond stated privacy obligations",
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
      "legacyKey": "data-governance",
      "lensKey": "data-governance",
      "lensLabel": "Data Governance / Privacy",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "records_retention_non_compliance",
      "label": "Records retention non-compliance",
      "domain": "data_governance",
      "description": "Records are retained or deleted inconsistently with legal, privacy, or internal retention obligations."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "data transferred abroad without safeguards",
          "strength": "strong"
        },
        {
          "text": "transferred abroad without safeguards",
          "strength": "strong"
        },
        {
          "text": "transferred overseas without safeguards",
          "strength": "strong"
        },
        {
          "text": "moved to another jurisdiction without safeguards",
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
      "legacyKey": "data-governance",
      "lensKey": "data-governance",
      "lensLabel": "Data Governance / Privacy",
      "functionKey": "compliance",
      "estimatePresetKey": "dataGovernance",
      "key": "cross_border_transfer_non_compliance",
      "label": "Cross-border transfer non-compliance",
      "domain": "data_governance",
      "description": "Personal or restricted data is transferred across borders without the required legal basis, safeguards, or approvals."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "denied party screening",
          "strength": "strong"
        },
        {
          "text": "restricted jurisdiction",
          "strength": "strong"
        },
        {
          "text": "restricted jurisdictions",
          "strength": "strong"
        },
        {
          "text": "remote technical environment",
          "strength": "strong"
        },
        {
          "text": "work from home in a restricted jurisdiction",
          "strength": "strong"
        },
        {
          "text": "export-controlled technology",
          "strength": "strong"
        },
        {
          "text": "re-export",
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
        },
        {
          "text": "export control",
          "strength": "weak"
        },
        {
          "text": "restricted jurisdiction",
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
        "restricted-party screening is missed and a prohibited transaction proceeds",
        "export-controlled access is enabled from a restricted jurisdiction without the required trade-control clearance"
      ],
      "counterExamples": [
        "general geopolitical concern rises but no sanctions control fails",
        "a mandatory filing is submitted late"
      ],
      "promptIdeaTemplates": [
        "Sanctions breach",
        "Trade-control restrictions are bypassed for a restricted jurisdiction or prohibited party"
      ],
      "shortlistSeedThemes": [
        "sanctions screening failure",
        "export-control breach",
        "restricted-jurisdiction access"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the regulatory trade-controls lane when sanctions, export controls, denied-party screening, or restricted-jurisdiction restrictions are explicit.",
        "Do not collapse export-control or restricted-jurisdiction wording into generic policy breach unless no trade-control trigger is actually stated."
      ],
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "license scope",
          "strength": "strong"
        },
        {
          "text": "licence scope",
          "strength": "strong"
        },
        {
          "text": "affiliate-use rights",
          "strength": "strong"
        },
        {
          "text": "affiliate use rights",
          "strength": "strong"
        },
        {
          "text": "entitlement dispute",
          "strength": "strong"
        },
        {
          "text": "service data rights",
          "strength": "medium"
        },
        {
          "text": "derived insights",
          "strength": "medium"
        },
        {
          "text": "licensing rights",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "malware",
          "strength": "strong"
        },
        {
          "text": "ransomware",
          "strength": "strong"
        },
        {
          "text": "data breach",
          "strength": "strong"
        },
        {
          "text": "policy breach",
          "strength": "medium"
        },
        {
          "text": "regulatory filing",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "license",
          "strength": "weak"
        },
        {
          "text": "licence",
          "strength": "weak"
        },
        {
          "text": "entitlement",
          "strength": "weak"
        },
        {
          "text": "affiliate",
          "strength": "weak"
        },
        {
          "text": "rights",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "group licence",
        "service-data rights",
        "affiliate use entitlement"
      ],
      "typicalCauses": [
        "licence restatement",
        "rights ambiguity",
        "ownership challenge"
      ],
      "typicalConsequences": [
        "commercial dispute",
        "service restriction",
        "legal escalation"
      ],
      "preferredRiskThemes": [
        "licence entitlement ambiguity",
        "rights allocation dispute",
        "affiliate use restriction"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "contract_liability"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "data_disclosure",
        "privacy_non_compliance"
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
        "updated licence terms remove affiliate-use rights that operating companies have relied on",
        "service-data and derived-insights rights become contested under a software agreement"
      ],
      "counterExamples": [
        "a model produces inaccurate answers but no contract rights are disputed",
        "a privacy regulator challenges personal-data handling without a licence dispute"
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
      "key": "licensing_rights_entitlement_dispute",
      "label": "Licensing rights and entitlement dispute",
      "domain": "legal_contract",
      "description": "The event path is a dispute over licence scope, affiliate-use rights, service-data rights, or entitlement boundaries under an existing agreement."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 81,
      "positiveSignals": [
        {
          "text": "liability cap",
          "strength": "strong"
        },
        {
          "text": "liability caps",
          "strength": "strong"
        },
        {
          "text": "step-in rights",
          "strength": "strong"
        },
        {
          "text": "scope allocation",
          "strength": "strong"
        },
        {
          "text": "flow-down terms",
          "strength": "strong"
        },
        {
          "text": "consortium agreement",
          "strength": "strong"
        },
        {
          "text": "allocation of obligations",
          "strength": "medium"
        },
        {
          "text": "uncapped indemnity",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "award criteria",
          "strength": "medium"
        },
        {
          "text": "vendor selection",
          "strength": "medium"
        },
        {
          "text": "supplier onboarding",
          "strength": "medium"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "inventory shortfall",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "liability",
          "strength": "weak"
        },
        {
          "text": "scope",
          "strength": "weak"
        },
        {
          "text": "obligation",
          "strength": "weak"
        },
        {
          "text": "step-in",
          "strength": "weak"
        },
        {
          "text": "cap",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "consortium agreement",
        "subcontract",
        "liability schedule"
      ],
      "typicalCauses": [
        "cross-reference ambiguity",
        "scope carve-out dispute",
        "flow-down mismatch"
      ],
      "typicalConsequences": [
        "claim exposure",
        "renegotiation pressure",
        "delivery instability"
      ],
      "preferredRiskThemes": [
        "scope allocation ambiguity",
        "liability allocation dispute",
        "step-in rights uncertainty"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "contract_liability",
        "sovereignty_localisation_constraint"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "supplier_control_weakness",
        "delivery_slippage"
      ],
      "forbiddenDriftFamilies": [
        "single_source_dependency",
        "delivery_slippage"
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
        "consortium partners dispute whether localisation obligations and acceptance liabilities sit inside committed scope",
        "step-in rights and liability caps do not clearly allocate responsibility across delivery parties"
      ],
      "counterExamples": [
        "a supplier fails to deliver on time but the signed allocation of obligations is clear",
        "the sourcing process is weak before contract award"
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
      "key": "scope_and_liability_allocation_dispute",
      "label": "Scope and liability allocation dispute",
      "domain": "legal_contract",
      "description": "The event path is uncertainty over how signed agreements allocate scope, caps, indemnities, step-in rights, or delivery obligations across parties."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 79,
      "positiveSignals": [
        {
          "text": "technical equivalence",
          "strength": "strong"
        },
        {
          "text": "acceptance certificate",
          "strength": "strong"
        },
        {
          "text": "acceptance criteria",
          "strength": "strong"
        },
        {
          "text": "statement of work",
          "strength": "medium"
        },
        {
          "text": "schedule hierarchy",
          "strength": "strong"
        },
        {
          "text": "annex conflict",
          "strength": "strong"
        },
        {
          "text": "substitute performance",
          "strength": "medium"
        },
        {
          "text": "specification dispute",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "project delay",
          "strength": "medium"
        },
        {
          "text": "go-live",
          "strength": "medium"
        },
        {
          "text": "data breach",
          "strength": "strong"
        },
        {
          "text": "malicious insider",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "acceptance",
          "strength": "weak"
        },
        {
          "text": "specification",
          "strength": "weak"
        },
        {
          "text": "equivalence",
          "strength": "weak"
        },
        {
          "text": "statement of work",
          "strength": "weak"
        },
        {
          "text": "schedule",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "statement of work",
        "acceptance certificate",
        "technical specification"
      ],
      "typicalCauses": [
        "annex conflict",
        "specification ambiguity",
        "acceptance threshold dispute"
      ],
      "typicalConsequences": [
        "payment hold",
        "claim escalation",
        "delivery delay"
      ],
      "preferredRiskThemes": [
        "acceptance dispute",
        "specification hierarchy conflict",
        "technical equivalence disagreement"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "contract_liability",
        "scope_and_liability_allocation_dispute"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "delivery_slippage"
      ],
      "forbiddenDriftFamilies": [
        "delivery_slippage",
        "availability_attack"
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
        "annex conflicts and schedule hierarchy issues create a dispute about whether substitute performance meets contractual acceptance",
        "a project cannot close because the parties disagree over technical equivalence and acceptance criteria"
      ],
      "counterExamples": [
        "the delivery team misses a milestone but the specification and acceptance rules are undisputed",
        "service capacity degrades without any contract interpretation issue"
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
      "key": "acceptance_and_specification_dispute",
      "label": "Acceptance and specification dispute",
      "domain": "legal_contract",
      "description": "The event path is a dispute over technical equivalence, acceptance criteria, schedule hierarchy, or the legally binding specification baseline."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 85,
      "positiveSignals": [
        {
          "text": "maverick spend",
          "strength": "strong"
        },
        {
          "text": "off-contract",
          "strength": "strong"
        },
        {
          "text": "outside approved sourcing",
          "strength": "strong"
        },
        {
          "text": "bypassing procurement",
          "strength": "strong"
        },
        {
          "text": "enterprise agreement",
          "strength": "strong"
        },
        {
          "text": "duplicate licenses",
          "strength": "strong"
        },
        {
          "text": "duplicate licences",
          "strength": "strong"
        },
        {
          "text": "higher unit pricing",
          "strength": "strong"
        },
        {
          "text": "pricing leakage",
          "strength": "strong"
        },
        {
          "text": "change request directly to the reseller",
          "strength": "strong"
        },
        {
          "text": "strategic sourcing threshold",
          "strength": "medium"
        },
        {
          "text": "incumbent reseller",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "kickback",
          "strength": "strong"
        },
        {
          "text": "side letter",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "market access",
          "strength": "medium"
        },
        {
          "text": "export control",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "procurement",
          "strength": "weak"
        },
        {
          "text": "purchase",
          "strength": "weak"
        },
        {
          "text": "license",
          "strength": "weak"
        },
        {
          "text": "reseller",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "enterprise agreement",
        "software entitlement",
        "local purchase path"
      ],
      "typicalCauses": [
        "maverick spend",
        "weak framework discipline",
        "poor entitlement visibility"
      ],
      "typicalConsequences": [
        "excess cost",
        "duplicate entitlement",
        "weaker sourcing governance"
      ],
      "preferredRiskThemes": [
        "off-contract purchasing",
        "commercial value leakage",
        "software sourcing governance weakness"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "a local team bypasses procurement, duplicates licenses already held centrally, and pays higher unit pricing through a reseller",
        "software is bought outside the approved framework because the purchase is treated as below the strategic sourcing threshold"
      ],
      "counterExamples": [
        "a reseller conceals return rights or rebate evidence to misstate the commercial substance of the deal",
        "the primary issue is a delayed software deployment rather than how the purchase was sourced"
      ],
      "promptIdeaTemplates": [
        "Local software buying bypasses the group framework and creates duplicate spend",
        "Off-contract purchasing weakens leverage against an incumbent reseller"
      ],
      "shortlistSeedThemes": [
        "off-contract purchasing",
        "commercial value leakage",
        "framework bypass"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in procurement when the central failure is how a purchase was sourced and approved, even if excess cost is the visible consequence.",
        "Do not promote reseller language into fraud without explicit deception, kickbacks, or fabricated evidence."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "off_contract_purchase_value_leakage",
      "label": "Off-contract purchasing and value leakage",
      "domain": "procurement",
      "description": "Buying outside approved sourcing channels duplicates entitlements or weakens commercial leverage before any live supplier incident occurs."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "rfp",
          "strength": "strong"
        },
        {
          "text": "request for proposal",
          "strength": "strong"
        },
        {
          "text": "scoring template",
          "strength": "strong"
        },
        {
          "text": "whole-life cost",
          "strength": "strong"
        },
        {
          "text": "whole life cost",
          "strength": "strong"
        },
        {
          "text": "lifecycle operating costs",
          "strength": "strong"
        },
        {
          "text": "technical weighting",
          "strength": "strong"
        },
        {
          "text": "energy efficiency",
          "strength": "medium"
        },
        {
          "text": "serviceability",
          "strength": "medium"
        },
        {
          "text": "spare-parts lead times",
          "strength": "strong"
        },
        {
          "text": "lowest upfront bidder",
          "strength": "strong"
        },
        {
          "text": "cooling systems",
          "strength": "medium"
        },
        {
          "text": "gulf conditions",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "kickback",
          "strength": "strong"
        },
        {
          "text": "collusion",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "medium"
        },
        {
          "text": "service outage",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "tender",
          "strength": "weak"
        },
        {
          "text": "bid",
          "strength": "weak"
        },
        {
          "text": "score",
          "strength": "weak"
        },
        {
          "text": "award",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "rfp methodology",
        "evaluation model",
        "technical criteria"
      ],
      "typicalCauses": [
        "template reuse",
        "poor category tailoring",
        "wrong weighting design"
      ],
      "typicalConsequences": [
        "suboptimal award",
        "higher lifecycle cost",
        "operating burden"
      ],
      "preferredRiskThemes": [
        "tender design weakness",
        "whole-life cost procurement failure",
        "category capability gap"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "a scoring template overweights generic commercial factors and underweights energy efficiency, serviceability, and spare-parts lead times",
        "the lowest upfront bidder wins even though lifecycle cost and maintenance complexity are materially worse"
      ],
      "counterExamples": [
        "a supplier was selected on sound criteria but later failed to perform in service",
        "the fact pattern centers on bribery or bid rigging rather than poor evaluation methodology"
      ],
      "promptIdeaTemplates": [
        "Tender criteria emphasize the wrong measures for a specialist asset class",
        "Whole-life value is lost because the sourcing method optimizes the headline bid only"
      ],
      "shortlistSeedThemes": [
        "tender design weakness",
        "whole-life value misalignment",
        "category capability gap"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in procurement when the root failure is the evaluation method rather than later operational effects.",
        "Do not collapse a poor award methodology into operational or ESG primary just because efficiency or serviceability matter."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "tender_methodology_value_misalignment",
      "label": "Tender methodology and whole-life value misalignment",
      "domain": "procurement",
      "description": "The sourcing method or award criteria emphasize the wrong factors and lead to a procurement decision misaligned with technical and lifecycle value."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "lotting strategy",
          "strength": "strong"
        },
        {
          "text": "competition design",
          "strength": "strong"
        },
        {
          "text": "single aggregator",
          "strength": "strong"
        },
        {
          "text": "specialist suppliers",
          "strength": "strong"
        },
        {
          "text": "specialist provider",
          "strength": "medium"
        },
        {
          "text": "niche suppliers",
          "strength": "medium"
        },
        {
          "text": "price benchmarking proved weak",
          "strength": "strong"
        },
        {
          "text": "data-labeling services",
          "strength": "medium"
        },
        {
          "text": "multilingual medical annotation",
          "strength": "medium"
        },
        {
          "text": "one lot",
          "strength": "medium"
        },
        {
          "text": "single lot",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "kickback",
          "strength": "strong"
        },
        {
          "text": "delivery outage",
          "strength": "medium"
        },
        {
          "text": "data breach",
          "strength": "strong"
        },
        {
          "text": "business continuity incident",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "lot",
          "strength": "weak"
        },
        {
          "text": "package",
          "strength": "weak"
        },
        {
          "text": "competition",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "lot structure",
        "market package",
        "supplier field"
      ],
      "typicalCauses": [
        "over-bundling",
        "weak market making",
        "poor competition design"
      ],
      "typicalConsequences": [
        "reduced optionality",
        "weaker leverage",
        "supplier dependency"
      ],
      "preferredRiskThemes": [
        "poor market-making and lot strategy",
        "commercial leverage loss",
        "supplier lock-in created through procurement design"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "single_source_dependency",
        "supplier_concentration_risk"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [],
      "defaultOverlays": [
        "third_party_dependency",
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
        "one large aggregator bids for a bundled lot that locks out niche suppliers capable of delivering parts of the requirement",
        "weak lotting reduces competition and leaves price benchmarking thin before the service is delivered"
      ],
      "counterExamples": [
        "a specialist supplier is chosen through a well-structured lot design and later fails in performance",
        "the core issue is model quality rather than how annotation work was packaged and competed"
      ],
      "promptIdeaTemplates": [
        "Competition weakens because unlike services are bundled into one sourcing lot",
        "Procurement design creates lock-in before any live supplier failure occurs"
      ],
      "shortlistSeedThemes": [
        "lot strategy weakness",
        "competition design failure",
        "supplier lock-in through procurement"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in procurement when dependency is created by the market package itself.",
        "Do not promote data-labeling language into AI/model risk unless the event path is about model behavior rather than service sourcing."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "lotting_and_competition_design_failure",
      "label": "Lotting and competition design failure",
      "domain": "procurement",
      "description": "Package design or lot structure reduces competition, weakens price tension, and creates avoidable dependency before supplier performance is tested."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "alternative distributor",
          "strength": "strong"
        },
        {
          "text": "legal carve-outs",
          "strength": "strong"
        },
        {
          "text": "warranty coverage",
          "strength": "strong"
        },
        {
          "text": "origin declarations",
          "strength": "strong"
        },
        {
          "text": "support obligations",
          "strength": "strong"
        },
        {
          "text": "side emails",
          "strength": "strong"
        },
        {
          "text": "draft appendices",
          "strength": "strong"
        },
        {
          "text": "distributor terms",
          "strength": "strong"
        },
        {
          "text": "deposit immediately",
          "strength": "medium"
        },
        {
          "text": "deposit request",
          "strength": "medium"
        },
        {
          "text": "scarce capacity",
          "strength": "strong"
        },
        {
          "text": "substitution rights",
          "strength": "strong"
        }
      ],
      "antiSignals": [
        {
          "text": "kickback",
          "strength": "strong"
        },
        {
          "text": "business email compromise",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "medium"
        },
        {
          "text": "delivery slip",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "contract",
          "strength": "weak"
        },
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "terms",
          "strength": "weak"
        },
        {
          "text": "obligations",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "distributor proposal",
        "contract pack",
        "deposit approval"
      ],
      "typicalCauses": [
        "accelerated sourcing",
        "fragmented term formation",
        "scarcity pressure"
      ],
      "typicalConsequences": [
        "weak buyer protection",
        "ambiguous obligations",
        "remedy uncertainty"
      ],
      "preferredRiskThemes": [
        "contracting-through-procurement control failure",
        "inadequate sourcing due diligence under constrained supply",
        "procurement governance breakdown under market pressure"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "contract_liability",
        "scope_and_liability_allocation_dispute"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [],
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
        "obligations and substitution rights are spread across draft appendices, emails, and distributor terms while the team is pressed to place a deposit",
        "market pressure compresses the sourcing process before warranty, support, and origin protections are made clear"
      ],
      "counterExamples": [
        "the contract is clear and the supplier later defaults in delivery",
        "export-control restrictions are the primary event rather than the procurement response to them"
      ],
      "promptIdeaTemplates": [
        "Compressed sourcing leaves key obligations unresolved at commitment point",
        "Scarcity pressure turns contract formation into a procurement control failure"
      ],
      "shortlistSeedThemes": [
        "contracting-through-procurement control failure",
        "constrained-supply diligence gap",
        "weak remedy protection"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in procurement when urgency weakens contract formation inside the sourcing event.",
        "Do not promote geopolitical or legal context over the procurement failure that created the exposure."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "compressed_sourcing_contract_formation_gap",
      "label": "Compressed sourcing and contract-formation gap",
      "domain": "procurement",
      "description": "Urgency and constrained supply compress the sourcing process so that obligations, remedies, or substitution rights remain unclear at commitment point."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "bundled scope",
          "strength": "strong"
        },
        {
          "text": "price validity",
          "strength": "strong"
        },
        {
          "text": "evaluation criteria",
          "strength": "strong"
        },
        {
          "text": "award strategy",
          "strength": "strong"
        },
        {
          "text": "installation change orders",
          "strength": "medium"
        },
        {
          "text": "opaque assumptions",
          "strength": "strong"
        },
        {
          "text": "shortest lead times",
          "strength": "medium"
        },
        {
          "text": "volatile upstream component markets",
          "strength": "medium"
        },
        {
          "text": "negotiation approach",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "kickback",
          "strength": "strong"
        },
        {
          "text": "shipment slipped",
          "strength": "strong"
        },
        {
          "text": "port congestion",
          "strength": "strong"
        },
        {
          "text": "service outage",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "tender",
          "strength": "weak"
        },
        {
          "text": "award",
          "strength": "weak"
        },
        {
          "text": "pricing",
          "strength": "weak"
        },
        {
          "text": "supplier",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "bundled tender",
        "evaluation pack",
        "price-validity clause"
      ],
      "typicalCauses": [
        "over-bundling",
        "weak award discipline",
        "poor negotiation structure"
      ],
      "typicalConsequences": [
        "pricing traps",
        "reduced leverage",
        "avoidable dependency"
      ],
      "preferredRiskThemes": [
        "tender design weakness",
        "award strategy risk",
        "negotiation leverage erosion"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "single_source_dependency",
        "supplier_concentration_risk",
        "scope_and_liability_allocation_dispute"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "a technically attractive bidder couples short lead times to bundled scope, opaque change-order assumptions, and limited price validity",
        "the core decision is whether tender structure and negotiation approach are strong enough before award"
      ],
      "counterExamples": [
        "the award is clean and the problem arises later from live supply disruption",
        "pricing issues stem from proven misconduct rather than weak award design"
      ],
      "promptIdeaTemplates": [
        "Tender structure embeds pricing traps before the contract is signed",
        "Bundled scope weakens leverage in a high-value award decision"
      ],
      "shortlistSeedThemes": [
        "award strategy risk",
        "negotiation leverage erosion",
        "bundled tender weakness"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in procurement when the decisive risk sits in pre-award structure and leverage rather than post-award performance.",
        "Do not collapse hardware and lead-time language into supply chain when the event path is about the award design itself."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "bundled_award_leverage_erosion",
      "label": "Bundled award and negotiation leverage erosion",
      "domain": "procurement",
      "description": "A high-value tender is structured in a way that embeds avoidable dependence, price traps, or weak leverage before award."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "direct negotiation",
          "strength": "strong"
        },
        {
          "text": "incumbent-led consortium",
          "strength": "strong"
        },
        {
          "text": "incumbent consortium",
          "strength": "strong"
        },
        {
          "text": "scope creep",
          "strength": "strong"
        },
        {
          "text": "service baselines",
          "strength": "strong"
        },
        {
          "text": "should-cost",
          "strength": "strong"
        },
        {
          "text": "should cost",
          "strength": "strong"
        },
        {
          "text": "urgent sourcing",
          "strength": "medium"
        },
        {
          "text": "emergency sourcing exercise",
          "strength": "strong"
        },
        {
          "text": "time is limited",
          "strength": "medium"
        },
        {
          "text": "fragmented position",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "service outage",
          "strength": "strong"
        },
        {
          "text": "business continuity incident",
          "strength": "strong"
        },
        {
          "text": "supplier compromise",
          "strength": "strong"
        },
        {
          "text": "kickback",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "negotiation",
          "strength": "weak"
        },
        {
          "text": "scope",
          "strength": "weak"
        },
        {
          "text": "service",
          "strength": "weak"
        },
        {
          "text": "pricing",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "negotiation pack",
        "scope baseline",
        "should-cost model"
      ],
      "typicalCauses": [
        "compressed timeline",
        "weak demand normalization",
        "incumbent dependence"
      ],
      "typicalConsequences": [
        "inflated pricing",
        "poor service construct",
        "weak negotiation leverage"
      ],
      "preferredRiskThemes": [
        "demand-specification weakness",
        "single-source negotiation risk",
        "commercial readiness gap in urgent sourcing"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "supplier_concentration_risk"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "time pressure pushes the group into direct negotiation with an incumbent consortium before service baselines and should-cost models are stable",
        "scope creep and inconsistent service constructs leave the enterprise negotiating from a fragmented position"
      ],
      "counterExamples": [
        "an urgent supplier issue becomes a business continuity incident after service failure begins",
        "the scenario is about continuity or cyber sensitivity rather than the sourcing posture before award"
      ],
      "promptIdeaTemplates": [
        "Urgent sourcing narrows into direct negotiation before the demand baseline is mature",
        "The enterprise enters negotiation without a coherent should-cost and service baseline"
      ],
      "shortlistSeedThemes": [
        "demand-specification weakness",
        "single-source negotiation risk",
        "urgent sourcing readiness gap"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in procurement when the core problem is negotiation readiness under time pressure.",
        "Do not promote urgency into business continuity unless a live service interruption is already underway."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "procurement",
      "lensKey": "procurement",
      "lensLabel": "Procurement",
      "functionKey": "procurement",
      "estimatePresetKey": "procurement",
      "key": "urgent_direct_negotiation_readiness_gap",
      "label": "Urgent direct negotiation and readiness gap",
      "domain": "procurement",
      "description": "Emergency or time-pressured sourcing narrows into direct negotiation before scope, service baselines, or should-cost discipline are mature."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 86,
      "positiveSignals": [
        {
          "text": "single approved supplier",
          "strength": "strong"
        },
        {
          "text": "single approved source",
          "strength": "strong"
        },
        {
          "text": "production line shift",
          "strength": "strong"
        },
        {
          "text": "inventory buffers were minimal",
          "strength": "strong"
        },
        {
          "text": "minimal buffer inventory",
          "strength": "strong"
        },
        {
          "text": "insufficient safety stock",
          "strength": "strong"
        },
        {
          "text": "rack enclosures",
          "strength": "medium"
        },
        {
          "text": "shipment slipped",
          "strength": "strong"
        },
        {
          "text": "shipment delay",
          "strength": "strong"
        },
        {
          "text": "customer go-live dates",
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
          "text": "contract award",
          "strength": "strong"
        },
        {
          "text": "bid evaluation",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "export control",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "inventory",
          "strength": "weak"
        },
        {
          "text": "shipment",
          "strength": "weak"
        },
        {
          "text": "buffer",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "single-source component",
        "inventory buffer",
        "deployment commitment"
      ],
      "typicalCauses": [
        "production reallocation",
        "thin safety stock",
        "weak substitute planning"
      ],
      "typicalConsequences": [
        "backlog growth",
        "operational disruption",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "single-source delivery shortfall",
        "buffer fragility",
        "inbound material delay"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "single_source_dependency",
        "delivery_slippage",
        "supplier_concentration_risk"
      ],
      "canCoExistWith": [
        "single_source_dependency",
        "delivery_slippage"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "third_party_access_compromise",
        "supplier_insolvency"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "vendor_access_weakness"
      ],
      "defaultOverlays": [
        "backlog_growth",
        "operational_disruption",
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
        "a single approved supplier shifts production and thin inventory buffers now create a delivery shortfall",
        "minimal safety stock turns a live single-source slip into delayed downstream go-live dates"
      ],
      "counterExamples": [
        "a supplier category is concentrated but there is no live delivery pressure yet",
        "the issue is only whether a sourcing award was governed properly"
      ],
      "promptIdeaTemplates": [
        "A live single-source supplier slip is amplified by weak inventory buffers",
        "Thin safety stock turns a production reallocation into an inbound material delay"
      ],
      "shortlistSeedThemes": [
        "single-source delivery shortfall",
        "insufficient safety stock",
        "inbound material delay"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in supply chain when a live source-and-buffer failure creates a delivery shortfall, even if procurement concentration also exists.",
        "Do not collapse thin inventory and inbound delay into generic programme slippage when the physical supply path is explicit."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "single_source_buffer_shortfall",
      "label": "Single-source buffer shortfall",
      "domain": "supply_chain",
      "description": "A live single-source dependency, thin safety stock, or production reallocation creates a material delivery shortfall for downstream work."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "supplier delay",
          "strength": "strong"
        },
        {
          "text": "vendor delay",
          "strength": "strong"
        },
        {
          "text": "delivery slips",
          "strength": "strong"
        },
        {
          "text": "vendor delivery slips",
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
          "text": "blocks rollout",
          "strength": "strong"
        },
        {
          "text": "delays rollout",
          "strength": "strong"
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 88,
      "positiveSignals": [
        {
          "text": "port congestion",
          "strength": "strong"
        },
        {
          "text": "customs inspection",
          "strength": "strong"
        },
        {
          "text": "customs slowdown",
          "strength": "strong"
        },
        {
          "text": "missed generator arrival",
          "strength": "strong"
        },
        {
          "text": "generator delivery",
          "strength": "medium"
        },
        {
          "text": "installation sequence",
          "strength": "strong"
        },
        {
          "text": "site energization",
          "strength": "strong"
        },
        {
          "text": "critical-path inbound logistics",
          "strength": "strong"
        },
        {
          "text": "cross-border equipment flows",
          "strength": "strong"
        },
        {
          "text": "contractor teams stranded",
          "strength": "medium"
        },
        {
          "text": "commissioning delay",
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
          "text": "entity list",
          "strength": "strong"
        },
        {
          "text": "sanctions spillover",
          "strength": "strong"
        },
        {
          "text": "tariff shock",
          "strength": "strong"
        },
        {
          "text": "edge controller",
          "strength": "strong"
        },
        {
          "text": "telemetry gaps",
          "strength": "strong"
        },
        {
          "text": "regional grid disturbance",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "customs",
          "strength": "weak"
        },
        {
          "text": "port",
          "strength": "weak"
        },
        {
          "text": "installation",
          "strength": "weak"
        },
        {
          "text": "shipment",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "critical inbound equipment",
        "installation sequence",
        "commissioning path"
      ],
      "typicalCauses": [
        "port congestion",
        "customs delay",
        "sequencing fragility across inbound equipment"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "critical-path inbound logistics",
        "cross-border sequencing fragility",
        "equipment-arrival blockage"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "logistics_disruption",
        "delivery_slippage",
        "programme_delivery_slippage"
      ],
      "canCoExistWith": [
        "logistics_disruption",
        "delivery_slippage"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "market_access_restriction",
        "third_party_access_compromise"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "edge_logic_synchronisation_failure"
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
        "port congestion and customs inspection delays strand contractor teams because critical equipment misses the installation sequence",
        "a missed generator arrival blocks site energization across a tightly sequenced commissioning path"
      ],
      "counterExamples": [
        "a formal export-control restriction blocks the route before shipment starts",
        "site systems become unstable because the controller baseline is wrong"
      ],
      "promptIdeaTemplates": [
        "Critical inbound logistics fail on the installation path and delay commissioning",
        "Cross-border equipment sequencing breaks a tightly coupled energization plan"
      ],
      "shortlistSeedThemes": [
        "critical-path inbound logistics disruption",
        "material-flow sequencing fragility",
        "cross-border logistics dependency"
      ],
      "fallbackNarrativePatterns": [
        "Treat port, customs, and inbound-equipment sequencing as supply chain primary unless the text explicitly moves into a sovereignty restriction or OT control failure.",
        "Do not let energization or commissioning consequences pull a logistics-sequencing event into OT or transformation primary when the material path is clear."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "critical_path_logistics_sequencing",
      "label": "Critical-path logistics sequencing failure",
      "domain": "supply_chain",
      "description": "Cross-border transport, customs, or inbound-equipment sequencing breaks a critical installation or commissioning path."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 89,
      "positiveSignals": [
        {
          "text": "sub-tier supplier",
          "strength": "strong"
        },
        {
          "text": "shared sub-tier",
          "strength": "strong"
        },
        {
          "text": "board assembler",
          "strength": "strong"
        },
        {
          "text": "quality hold",
          "strength": "strong"
        },
        {
          "text": "shared dependency",
          "strength": "strong"
        },
        {
          "text": "component shortage",
          "strength": "strong"
        },
        {
          "text": "sub-tier bottlenecks",
          "strength": "strong"
        },
        {
          "text": "shipment windows",
          "strength": "strong"
        },
        {
          "text": "material flow",
          "strength": "strong"
        },
        {
          "text": "critical-component sequencing",
          "strength": "medium"
        },
        {
          "text": "upstream constraint propagation",
          "strength": "strong"
        },
        {
          "text": "custom busways",
          "strength": "medium"
        },
        {
          "text": "coolant distribution manifolds",
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
          "text": "contract award",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        },
        {
          "text": "entity list",
          "strength": "strong"
        },
        {
          "text": "licensing dispute",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "supplier",
          "strength": "weak"
        },
        {
          "text": "component",
          "strength": "weak"
        },
        {
          "text": "shipment",
          "strength": "weak"
        },
        {
          "text": "material",
          "strength": "weak"
        },
        {
          "text": "sub-tier",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "critical component flow",
        "multi-tier supply path",
        "installation sequence"
      ],
      "typicalCauses": [
        "hidden sub-tier dependency",
        "quality-triggered hold",
        "upstream bottleneck propagation"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "sub-tier concentration",
        "material-flow disruption",
        "upstream bottleneck propagation"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "supplier_concentration_risk",
        "delivery_slippage",
        "logistics_disruption"
      ],
      "canCoExistWith": [
        "delivery_slippage",
        "logistics_disruption"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "third_party_access_compromise",
        "market_access_restriction"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "contract_liability"
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
        "a hidden sub-tier quality hold creates shared component shortages across multiple programmes",
        "upstream bottlenecks cascade across shipment windows and break material sequencing for an integrated build"
      ],
      "counterExamples": [
        "a supplier category is concentrated but still delivering on time",
        "the issue is whether a step-in right or liability cap can be enforced"
      ],
      "promptIdeaTemplates": [
        "A hidden sub-tier dependency creates a quality-triggered material shortage",
        "Upstream bottlenecks cascade through shipment windows and disrupt integrated build sequencing"
      ],
      "shortlistSeedThemes": [
        "sub-tier concentration risk",
        "quality-triggered material shortage",
        "upstream constraint propagation"
      ],
      "fallbackNarrativePatterns": [
        "Keep hidden sub-tier dependence, quality holds, and upstream bottlenecks in the supply-chain lane even when supplier governance language is present.",
        "Do not collapse cascading material-flow disruption into procurement or third-party primary just because suppliers remain contractually engaged."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "multi_tier_material_flow_disruption",
      "label": "Multi-tier material flow disruption",
      "domain": "supply_chain",
      "description": "Hidden sub-tier dependency, quality holds, or cascading upstream bottlenecks disrupt physical material flow across multiple programmes or sites."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 87,
      "positiveSignals": [
        {
          "text": "allocation priority",
          "strength": "strong"
        },
        {
          "text": "allocation rights",
          "strength": "strong"
        },
        {
          "text": "original manufacturer",
          "strength": "medium"
        },
        {
          "text": "oem",
          "strength": "strong"
        },
        {
          "text": "fragmented forecast",
          "strength": "strong"
        },
        {
          "text": "non-binding forecast",
          "strength": "strong"
        },
        {
          "text": "demand aggregation",
          "strength": "strong"
        },
        {
          "text": "demand signal",
          "strength": "medium"
        },
        {
          "text": "constrained stock",
          "strength": "strong"
        },
        {
          "text": "internal competition",
          "strength": "medium"
        },
        {
          "text": "distributor priority shifted",
          "strength": "strong"
        },
        {
          "text": "forecast certainty",
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
          "text": "entity list",
          "strength": "strong"
        },
        {
          "text": "sanctions spillover",
          "strength": "strong"
        },
        {
          "text": "tariff shock",
          "strength": "strong"
        },
        {
          "text": "localization requirement",
          "strength": "strong"
        },
        {
          "text": "foreign-influence review",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "allocation",
          "strength": "weak"
        },
        {
          "text": "forecast",
          "strength": "weak"
        },
        {
          "text": "stock",
          "strength": "weak"
        },
        {
          "text": "distributor",
          "strength": "weak"
        },
        {
          "text": "oem",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "constrained component stock",
        "OEM allocation position",
        "aggregated demand signal"
      ],
      "typicalCauses": [
        "weak demand aggregation",
        "no OEM protection",
        "allocation reprioritisation under scarcity"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "allocation assurance risk",
        "demand aggregation weakness",
        "distributor dependency without OEM protection"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "supplier_concentration_risk",
        "market_access_restriction",
        "programme_delivery_slippage"
      ],
      "canCoExistWith": [
        "supplier_concentration_risk"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "market_access_restriction",
        "third_party_access_compromise"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "sovereignty_localisation_constraint"
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
        "fragmented forecasts and missing OEM allocation rights leave the group exposed when distributor priority shifts",
        "scarce stock is reallocated to stronger forecasts and multiple programmes now compete internally for constrained components"
      ],
      "counterExamples": [
        "sanctions or public-sector admissibility rules directly block the market",
        "the issue is only whether the original sourcing award met policy"
      ],
      "promptIdeaTemplates": [
        "Weak demand aggregation leaves the enterprise without reliable allocation under scarce supply",
        "Distributor dependency without OEM protection erodes assured access to constrained components"
      ],
      "shortlistSeedThemes": [
        "allocation and supply assurance risk",
        "demand aggregation weakness",
        "cross-program supply contention"
      ],
      "fallbackNarrativePatterns": [
        "Keep OEM allocation, forecast fragmentation, and constrained-stock competition in the supply-chain lane unless an explicit geopolitical restriction is the trigger.",
        "Do not collapse scarcity allocation into procurement-only or strategic-only primary when the event is assured access to physical stock."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "allocation_supply_assurance_erosion",
      "label": "Allocation and supply assurance erosion",
      "domain": "supply_chain",
      "description": "Scarcity allocation, fragmented demand signals, or missing OEM protection erode assured access to constrained physical stock."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 88,
      "positiveSignals": [
        {
          "text": "buffer hub",
          "strength": "strong"
        },
        {
          "text": "deployable inventory",
          "strength": "strong"
        },
        {
          "text": "inspection backlog",
          "strength": "strong"
        },
        {
          "text": "shipping re-routing",
          "strength": "strong"
        },
        {
          "text": "shipping rerouting",
          "strength": "strong"
        },
        {
          "text": "repair lead time",
          "strength": "strong"
        },
        {
          "text": "service-spares flow",
          "strength": "strong"
        },
        {
          "text": "service spares flow",
          "strength": "strong"
        },
        {
          "text": "replacement network modules",
          "strength": "medium"
        },
        {
          "text": "practically deployable",
          "strength": "strong"
        },
        {
          "text": "onward dispatch",
          "strength": "medium"
        },
        {
          "text": "field demand",
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
          "text": "continuity exercise",
          "strength": "strong"
        },
        {
          "text": "manual fallback exercise",
          "strength": "strong"
        },
        {
          "text": "edge controller",
          "strength": "strong"
        },
        {
          "text": "telemetry gaps",
          "strength": "strong"
        },
        {
          "text": "vendor access compromised",
          "strength": "strong"
        }
      ],
      "requiredSignals": [
        {
          "text": "inventory",
          "strength": "weak"
        },
        {
          "text": "hub",
          "strength": "weak"
        },
        {
          "text": "inspection",
          "strength": "weak"
        },
        {
          "text": "dispatch",
          "strength": "weak"
        },
        {
          "text": "spares",
          "strength": "weak"
        }
      ],
      "typicalAssets": [
        "buffer stock",
        "regional hub",
        "field-spares flow"
      ],
      "typicalCauses": [
        "inspection delays",
        "shipping rerouting",
        "packaging inconsistency",
        "dispatch instability"
      ],
      "typicalConsequences": [
        "operational disruption",
        "backlog growth",
        "third-party dependency"
      ],
      "preferredRiskThemes": [
        "deployable inventory readiness",
        "cross-border logistics fragility",
        "service-spares disruption"
      ],
      "defaultMechanisms": [
        "dependency_failure"
      ],
      "allowedSecondaryFamilies": [
        "logistics_disruption",
        "delivery_slippage",
        "programme_delivery_slippage"
      ],
      "canCoExistWith": [
        "logistics_disruption"
      ],
      "canEscalateTo": [
        "programme_delivery_slippage"
      ],
      "cannotBePrimaryWith": [
        "third_party_access_compromise",
        "market_access_restriction"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "edge_logic_synchronisation_failure"
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
        "a regional buffer hub holds stock that is technically available but not practically deployable because inspection and transit are unstable",
        "shipping rerouting and packaging inconsistency weaken service-spares flow and threaten repair lead times"
      ],
      "counterExamples": [
        "a continuity exercise finds the alternate site is not ready",
        "an industrial controller loses synchronization and destabilises the process"
      ],
      "promptIdeaTemplates": [
        "Deployable inventory readiness collapses even though nominal stock still exists",
        "Hub, inspection, and onward-dispatch instability degrade service-spares flow"
      ],
      "shortlistSeedThemes": [
        "deployable inventory readiness failure",
        "cross-border logistics fragility",
        "service-spares flow disruption"
      ],
      "fallbackNarrativePatterns": [
        "Treat hub readiness, inspection backlog, and practical deployability as supply chain primary unless the text explicitly becomes a continuity activation or OT control failure.",
        "Do not let spares and field-service language alone pull a logistics-readiness event into OT when the chain instability is the real cause."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "supply-chain",
      "lensKey": "supply-chain",
      "lensLabel": "Supply chain",
      "functionKey": "procurement",
      "estimatePresetKey": "supplyChain",
      "key": "deployable_inventory_readiness_failure",
      "label": "Deployable inventory readiness failure",
      "domain": "supply_chain",
      "description": "Stock is nominally available but transit, inspection, packaging, or dispatch instability makes it unreliable for field demand."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "business partner due diligence",
          "strength": "strong"
        },
        {
          "text": "business partner",
          "strength": "medium"
        },
        {
          "text": "beneficial ownership checks missing",
          "strength": "strong"
        },
        {
          "text": "beneficial ownership red flags",
          "strength": "strong"
        },
        {
          "text": "beneficial ownership screening incomplete",
          "strength": "strong"
        },
        {
          "text": "unresolved red flags",
          "strength": "strong"
        },
        {
          "text": "red flags remained unresolved",
          "strength": "strong"
        },
        {
          "text": "approved through escalation",
          "strength": "strong"
        },
        {
          "text": "approved through escalation despite red flags",
          "strength": "strong"
        },
        {
          "text": "ongoing monitoring gap",
          "strength": "medium"
        },
        {
          "text": "business partner code of conduct not evidenced",
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
        },
        {
          "text": "restricted party",
          "strength": "strong"
        },
        {
          "text": "sanctions restrictions",
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
        "weak supplier governance creates inherited assurance risk without an actual compromise event",
        "a business partner is approved through escalation even though beneficial ownership red flags remain unresolved"
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "vendor accounts have broad access",
          "strength": "strong"
        },
        {
          "text": "vendor credentials have standing access",
          "strength": "strong"
        },
        {
          "text": "support partner accounts can reach production systems",
          "strength": "strong"
        },
        {
          "text": "shared vendor account spans critical systems",
          "strength": "strong"
        },
        {
          "text": "broad vendor access",
          "strength": "strong"
        },
        {
          "text": "broad access across critical systems",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "minority investment",
          "strength": "medium"
        },
        {
          "text": "minority stake",
          "strength": "medium"
        },
        {
          "text": "value-creation thesis",
          "strength": "medium"
        },
        {
          "text": "cross-sell assumptions",
          "strength": "medium"
        },
        {
          "text": "revenue concentration",
          "strength": "medium"
        },
        {
          "text": "key-person dependence",
          "strength": "medium"
        },
        {
          "text": "influence limitation",
          "strength": "medium"
        },
        {
          "text": "investment thesis fragility",
          "strength": "medium"
        },
        {
          "text": "post-deal value realization",
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
          "text": "policy breach",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "investment thesis",
        "minority governance model",
        "value-creation plan"
      ],
      "typicalCauses": [
        "weak diligence",
        "concentrated revenue base",
        "unproven cross-sell logic"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "minority investment fragility",
        "value-creation thesis weakness",
        "post-deal assumption risk"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "portfolio_execution_drift",
        "integration_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "market_access_restriction"
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
        "a minority investment depends on concentrated revenue and unproven cross-sell assumptions",
        "key-person dependence and weak influence rights undermine the value-creation thesis"
      ],
      "counterExamples": [
        "sanctions tighten and block access to the market",
        "the acquired environment suffers a live credential compromise before close"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "investment-jv",
      "lensKey": "investment-jv",
      "lensLabel": "Investment / JV",
      "functionKey": "strategic",
      "estimatePresetKey": "investmentJv",
      "key": "investment_thesis_fragility",
      "label": "Investment thesis fragility",
      "domain": "strategic_transformation",
      "description": "A proposed investment thesis relies on concentrated revenue, key-person dependence, unproven value-creation assumptions, or weak influence rights that may not justify the investment case."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "controlling stake",
          "strength": "medium"
        },
        {
          "text": "control acquisition",
          "strength": "medium"
        },
        {
          "text": "quality of earnings",
          "strength": "medium"
        },
        {
          "text": "earnings quality",
          "strength": "medium"
        },
        {
          "text": "founder concentration",
          "strength": "medium"
        },
        {
          "text": "founder-centric",
          "strength": "medium"
        },
        {
          "text": "post-close control",
          "strength": "medium"
        },
        {
          "text": "one-off remediation projects",
          "strength": "medium"
        },
        {
          "text": "recurring managed-service margins",
          "strength": "medium"
        },
        {
          "text": "customer consent rights",
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
          "text": "shipment delay",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "control acquisition",
        "deal valuation",
        "post-close operating model"
      ],
      "typicalCauses": [
        "fragile earnings base",
        "founder dependence",
        "weak post-close control assumptions"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "operational disruption"
      ],
      "preferredRiskThemes": [
        "acquisition valuation fragility",
        "post-close control risk",
        "earnings quality dependence"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "integration_failure",
        "benefits_realisation_failure"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "market_access_restriction"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "headline growth masks weaker recurring margins and heavy founder dependence",
        "a control acquisition assumes post-close control that local management may resist"
      ],
      "counterExamples": [
        "a target misses an SLA after closing without any valuation issue",
        "a regulator blocks the deal on market-access grounds"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "investment-jv",
      "lensKey": "investment-jv",
      "lensLabel": "Investment / JV",
      "functionKey": "strategic",
      "estimatePresetKey": "investmentJv",
      "key": "control_acquisition_assumption_misalignment",
      "label": "Control acquisition assumption misalignment",
      "domain": "strategic_transformation",
      "description": "A control acquisition depends on fragile earnings quality, founder concentration, or post-close control assumptions that may not hold after closing."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 85,
      "positiveSignals": [
        {
          "text": "joint venture",
          "strength": "medium"
        },
        {
          "text": "reserved matters",
          "strength": "medium"
        },
        {
          "text": "reserved opportunities",
          "strength": "medium"
        },
        {
          "text": "pipeline ownership",
          "strength": "medium"
        },
        {
          "text": "transfer pricing",
          "strength": "medium"
        },
        {
          "text": "shared engineering resources",
          "strength": "medium"
        },
        {
          "text": "product-roadmap decisions",
          "strength": "medium"
        },
        {
          "text": "partner divergence",
          "strength": "medium"
        },
        {
          "text": "jv governance",
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
          "text": "battery-room hazard",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "joint venture vehicle",
        "reserved-matter framework",
        "shared resource model"
      ],
      "typicalCauses": [
        "ambiguous governance boundary",
        "weak decision-right design",
        "partner misalignment"
      ],
      "typicalConsequences": [
        "operational disruption",
        "reputational damage",
        "direct monetary loss"
      ],
      "preferredRiskThemes": [
        "JV governance ambiguity",
        "partner-alignment breakdown",
        "operationalized-boundary failure"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "integration_failure",
        "contract_liability"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "market_access_restriction"
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
        "a joint venture cannot agree which opportunities sit inside the vehicle and which remain with parents",
        "reserved matters and transfer-pricing boundaries are too broad to guide daily decisions"
      ],
      "counterExamples": [
        "the venture loses access because sanctions close the market",
        "the issue is only whether a single clause is enforceable"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "investment-jv",
      "lensKey": "investment-jv",
      "lensLabel": "Investment / JV",
      "functionKey": "strategic",
      "estimatePresetKey": "investmentJv",
      "key": "jv_governance_boundary_breakdown",
      "label": "JV governance boundary breakdown",
      "domain": "strategic_transformation",
      "description": "A joint venture becomes unstable because reserved matters, opportunity ownership, or decision rights are not operationally precise enough to govern the vehicle."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 86,
      "positiveSignals": [
        {
          "text": "capital calls",
          "strength": "medium"
        },
        {
          "text": "valuation reset",
          "strength": "medium"
        },
        {
          "text": "scope narrowing",
          "strength": "medium"
        },
        {
          "text": "seconded personnel",
          "strength": "medium"
        },
        {
          "text": "seconded specialists",
          "strength": "medium"
        },
        {
          "text": "parent-supplied software licenses",
          "strength": "medium"
        },
        {
          "text": "preferred-supplier arrangements",
          "strength": "medium"
        },
        {
          "text": "clean separation",
          "strength": "medium"
        },
        {
          "text": "exit discussion",
          "strength": "medium"
        },
        {
          "text": "restructuring complexity",
          "strength": "medium"
        },
        {
          "text": "entangled ownership structure",
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
        "JV vehicle",
        "shared licences and staff",
        "exit pathway"
      ],
      "typicalCauses": [
        "partner divergence",
        "commercial underperformance",
        "structural entanglement"
      ],
      "typicalConsequences": [
        "direct monetary loss",
        "operational disruption",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "JV viability breakdown",
        "exit entanglement",
        "stalled reset economics"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "jv_governance_boundary_breakdown",
        "integration_failure",
        "contract_liability"
      ],
      "canCoExistWith": [],
      "canEscalateTo": [
        "portfolio_execution_drift"
      ],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "market_access_restriction"
      ],
      "defaultOverlays": [
        "direct_monetary_loss",
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
        "capital calls, seconded staff, and parent licences make a JV hard to reset or unwind",
        "partner appetite diverges while exit and restructuring options are constrained by entanglement"
      ],
      "counterExamples": [
        "a programme misses milestones but the investment structure remains sound",
        "market-access restrictions, not JV economics, are the cause of the stress"
      ],
      "promptIdeaTemplates": [],
      "shortlistSeedThemes": [],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "investment-jv",
      "lensKey": "investment-jv",
      "lensLabel": "Investment / JV",
      "functionKey": "strategic",
      "estimatePresetKey": "investmentJv",
      "key": "jv_viability_exit_entanglement",
      "label": "JV viability and exit entanglement",
      "domain": "strategic_transformation",
      "description": "A maturing JV faces disputed capital support, partner divergence, and embedded dependencies that make reset, restructuring, or exit materially harder than expected."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "sanctions spillover",
          "strength": "medium"
        },
        {
          "text": "banking restriction",
          "strength": "medium"
        },
        {
          "text": "insurance withdrawal",
          "strength": "medium"
        },
        {
          "text": "travel approval restriction",
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
        "sovereign measure",
        "sanctions spillover across support channels"
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
        "cross-border restriction blocks execution",
        "banks, insurers, and travel approvals retreat before a formal prohibition exists"
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
      "lensKey": "geopolitical",
      "lensLabel": "Geopolitical / market access",
      "functionKey": "strategic",
      "estimatePresetKey": "geopolitical",
      "key": "market_access_restriction",
      "label": "Market access restriction",
      "domain": "strategic_transformation",
      "description": "External restrictions or geopolitical measures reduce market access or execution viability."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 76,
      "positiveSignals": [
        {
          "text": "localization requirement",
          "strength": "medium"
        },
        {
          "text": "localisation requirement",
          "strength": "medium"
        },
        {
          "text": "in-country autonomy",
          "strength": "medium"
        },
        {
          "text": "local board representation",
          "strength": "medium"
        },
        {
          "text": "foreign-influence review",
          "strength": "medium"
        },
        {
          "text": "ownership transparency requirement",
          "strength": "medium"
        },
        {
          "text": "technology-origin scrutiny",
          "strength": "medium"
        },
        {
          "text": "public-sector screening",
          "strength": "medium"
        },
        {
          "text": "public procurement screening",
          "strength": "medium"
        },
        {
          "text": "admissibility",
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
      "typicalAssets": [
        "public-sector bid",
        "market-entry operating model",
        "ownership and governance structure"
      ],
      "typicalCauses": [
        "sovereignty condition",
        "localisation rule",
        "public-sector admissibility filter",
        "foreign-influence screening"
      ],
      "typicalConsequences": [
        "operational disruption",
        "regulatory scrutiny",
        "reputational damage"
      ],
      "preferredRiskThemes": [
        "localisation-driven access restriction",
        "sovereign operating-model constraint",
        "public-sector admissibility erosion"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "market_access_restriction",
        "contract_liability"
      ],
      "canCoExistWith": [
        "market_access_restriction"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise",
        "delivery_slippage"
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
        "localization and sovereign operating conditions reshape whether the bid remains viable",
        "foreign-influence review and ownership transparency rules make a public-sector tender harder to access"
      ],
      "counterExamples": [
        "a routine contract redline slows signature",
        "a supplier misses delivery dates without any sovereignty or admissibility constraint"
      ],
      "promptIdeaTemplates": [
        "A public-sector opportunity becomes harder to pursue because sovereignty conditions change how the enterprise must govern and deliver the service",
        "A target market tightens admissibility filters around ownership, provenance, and localisation expectations"
      ],
      "shortlistSeedThemes": [
        "sovereign market-access friction",
        "localisation-driven bid constraint",
        "public-sector admissibility pressure"
      ],
      "fallbackNarrativePatterns": [],
      "preferredFamilyKey": "",
      "legacyKey": "geopolitical",
      "lensKey": "geopolitical",
      "lensLabel": "Geopolitical / market access",
      "functionKey": "strategic",
      "estimatePresetKey": "geopolitical",
      "key": "sovereignty_localisation_constraint",
      "label": "Sovereignty or localisation constraint",
      "domain": "strategic_transformation",
      "description": "Host-market sovereignty, localisation, ownership-transparency, or public-sector admissibility conditions materially constrain how the enterprise can bid, govern, or deliver in a target market."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
          "text": "forced labour practices",
          "strength": "medium"
        },
        {
          "text": "forced labor practices",
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
        },
        {
          "text": "recruitment fees",
          "strength": "medium"
        },
        {
          "text": "passport retention",
          "strength": "medium"
        },
        {
          "text": "passports held",
          "strength": "medium"
        },
        {
          "text": "passport confiscation",
          "strength": "medium"
        },
        {
          "text": "withheld passports",
          "strength": "medium"
        },
        {
          "text": "labour broker",
          "strength": "medium"
        },
        {
          "text": "labour agent abuse",
          "strength": "medium"
        },
        {
          "text": "debt bondage",
          "strength": "medium"
        },
        {
          "text": "worker grievance",
          "strength": "medium"
        },
        {
          "text": "grievance mechanism",
          "strength": "medium"
        },
        {
          "text": "remediation delayed",
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
          "text": "forced labour practices",
          "strength": "medium"
        },
        {
          "text": "forced labor practices",
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
        },
        {
          "text": "recruitment fees",
          "strength": "medium"
        },
        {
          "text": "passport retention",
          "strength": "medium"
        },
        {
          "text": "passports held",
          "strength": "medium"
        },
        {
          "text": "debt bondage",
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
        "human-rights control failure",
        "labour-broker layer not reached",
        "grievance escalation did not trigger remediation"
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
        "modern slavery allegations emerge in a supplier workforce after due diligence missed the abuse",
        "recruitment fees and passport retention are found in the labour-broker layer",
        "worker grievances reveal abusive labour practices and delayed remediation"
      ],
      "counterExamples": [
        "a supplier misses delivery dates and documentation standards",
        "payment approval control fails"
      ],
      "promptIdeaTemplates": [
        "Worker exploitation is discovered in the supply chain after weak due diligence",
        "Recruitment-fee abuse or passport retention exposes a human-rights control failure"
      ],
      "shortlistSeedThemes": [
        "forced labour / modern slavery",
        "human-rights due diligence failure",
        "supplier remediation pressure"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario anchored to human-rights abuse, labour-broker weakness, grievances, and remediation credibility when worker exploitation is explicit.",
        "Do not collapse labour-abuse wording into generic procurement or supplier-governance language."
      ],
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "cannot be substantiated",
          "strength": "medium"
        },
        {
          "text": "cannot be evidenced",
          "strength": "medium"
        },
        {
          "text": "cannot be verified",
          "strength": "medium"
        },
        {
          "text": "claims are unsupported",
          "strength": "medium"
        },
        {
          "text": "unsupported claim",
          "strength": "medium"
        },
        {
          "text": "scope 2 reduction unsupported",
          "strength": "medium"
        },
        {
          "text": "unsupported scope 2 reduction",
          "strength": "medium"
        },
        {
          "text": "renewable energy attributes not evidenced",
          "strength": "medium"
        },
        {
          "text": "renewable energy attributes",
          "strength": "medium"
        },
        {
          "text": "workload geography mismatch",
          "strength": "medium"
        },
        {
          "text": "scope 3 emissions not evidenced",
          "strength": "medium"
        },
        {
          "text": "scope 3 emissions claims",
          "strength": "medium"
        },
        {
          "text": "scope 3 reduction claims",
          "strength": "medium"
        },
        {
          "text": "supplier emissions data not reconciled",
          "strength": "medium"
        },
        {
          "text": "supplier emissions do not reconcile",
          "strength": "medium"
        },
        {
          "text": "supplier data does not reconcile",
          "strength": "medium"
        },
        {
          "text": "activity factors do not reconcile",
          "strength": "medium"
        },
        {
          "text": "transition milestone claim unsupported",
          "strength": "medium"
        },
        {
          "text": "transition plan claim unsupported",
          "strength": "medium"
        },
        {
          "text": "public transition claims",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked loan kpi",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked loan kpi not evidenced",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked financing kpi",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked financing kpi not evidenced",
          "strength": "medium"
        },
        {
          "text": "margin step-down",
          "strength": "medium"
        },
        {
          "text": "margin step-down claim unsupported",
          "strength": "medium"
        },
        {
          "text": "assurance prep found evidence gap",
          "strength": "medium"
        },
        {
          "text": "assurance challenge",
          "strength": "medium"
        },
        {
          "text": "under assurance challenge",
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
          "text": "internal transition programme",
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
        },
        {
          "text": "claims are unsupported",
          "strength": "medium"
        },
        {
          "text": "unsupported scope 2 reduction",
          "strength": "medium"
        },
        {
          "text": "renewable energy attributes",
          "strength": "medium"
        },
        {
          "text": "scope 3 emissions not evidenced",
          "strength": "medium"
        },
        {
          "text": "scope 3 emissions claims",
          "strength": "medium"
        },
        {
          "text": "scope 3 reduction claims",
          "strength": "medium"
        },
        {
          "text": "supplier emissions data not reconciled",
          "strength": "medium"
        },
        {
          "text": "supplier data does not reconcile",
          "strength": "medium"
        },
        {
          "text": "activity factors do not reconcile",
          "strength": "medium"
        },
        {
          "text": "transition milestone claim unsupported",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked loan kpi",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked loan kpi not evidenced",
          "strength": "medium"
        },
        {
          "text": "sustainability-linked financing kpi",
          "strength": "medium"
        },
        {
          "text": "margin step-down",
          "strength": "medium"
        },
        {
          "text": "margin step-down claim unsupported",
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
        "claim-practice mismatch",
        "assurance evidence gap",
        "supplier-emissions data mismatch",
        "transition milestone overstatement"
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
        "a sustainability disclosure cannot be supported credibly",
        "scope 3 emissions reduction claims cannot be reconciled to supplier activity data",
        "a sustainability-linked financing KPI cannot be evidenced in assurance preparation"
      ],
      "counterExamples": [
        "an internal environmental reporting process was not followed",
        "an internal transition programme milestone slips without any external claim",
        "admin credentials used to access tenant"
      ],
      "promptIdeaTemplates": [
        "A public sustainability, climate, or financing-linked KPI claim cannot be evidenced",
        "Disclosure confidence is running ahead of the evidence for emissions, transition, or impact claims"
      ],
      "shortlistSeedThemes": [
        "greenwashing / disclosure gap",
        "claim-evidence mismatch",
        "disclosure credibility pressure"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the ESG disclosure lane when public claims, transition milestones, supplier-emissions data, or financing-linked KPIs cannot be evidenced.",
        "Do not flatten unsupported sustainability claims into generic compliance unless the event is only an internal process miss with no external statement."
      ],
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "staff exhaustion",
          "strength": "medium"
        },
        {
          "text": "understaffing",
          "strength": "medium"
        },
        {
          "text": "fatigue",
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
        "safety_control_weakness",
        "workforce_fatigue_staffing_weakness",
        "environmental_spill"
      ],
      "canCoExistWith": [
        "safety_control_weakness",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 79,
      "positiveSignals": [
        {
          "text": "permit to work missing",
          "strength": "medium"
        },
        {
          "text": "permit to work bypassed",
          "strength": "medium"
        },
        {
          "text": "management of change not followed",
          "strength": "medium"
        },
        {
          "text": "corrective actions overdue",
          "strength": "medium"
        },
        {
          "text": "hazard identification incomplete",
          "strength": "medium"
        },
        {
          "text": "hazard controls missing",
          "strength": "medium"
        },
        {
          "text": "machine guards missing",
          "strength": "medium"
        },
        {
          "text": "interlocks not functioning",
          "strength": "medium"
        },
        {
          "text": "emergency stop devices unavailable",
          "strength": "medium"
        },
        {
          "text": "emergency drills overdue",
          "strength": "medium"
        },
        {
          "text": "emergency response plan missing",
          "strength": "medium"
        },
        {
          "text": "contractor safety controls weak",
          "strength": "medium"
        },
        {
          "text": "unsafe worker accommodation",
          "strength": "medium"
        },
        {
          "text": "unsafe dormitory conditions",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "injury",
          "strength": "medium"
        },
        {
          "text": "worker harmed",
          "strength": "medium"
        },
        {
          "text": "safety incident",
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
          "text": "staff exhaustion",
          "strength": "medium"
        },
        {
          "text": "understaffing",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "credential theft",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "permit to work",
          "strength": "medium"
        },
        {
          "text": "management of change",
          "strength": "medium"
        },
        {
          "text": "corrective action",
          "strength": "medium"
        },
        {
          "text": "hazard identification",
          "strength": "medium"
        },
        {
          "text": "hazard controls",
          "strength": "medium"
        },
        {
          "text": "machine guards",
          "strength": "medium"
        },
        {
          "text": "interlocks",
          "strength": "medium"
        },
        {
          "text": "emergency drills",
          "strength": "medium"
        },
        {
          "text": "emergency response plan",
          "strength": "medium"
        },
        {
          "text": "contractor safety",
          "strength": "medium"
        },
        {
          "text": "worker accommodation",
          "strength": "medium"
        },
        {
          "text": "dormitory",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "site operation",
        "safety control",
        "emergency readiness"
      ],
      "typicalCauses": [
        "weak permit discipline",
        "hazard-control gaps",
        "overdue corrective actions"
      ],
      "typicalConsequences": [
        "operational disruption",
        "control_breakdown",
        "regulatory_scrutiny"
      ],
      "preferredRiskThemes": [
        "HSE control weakness",
        "emergency-readiness gap",
        "unsafe control environment"
      ],
      "defaultMechanisms": [
        "process_bypass",
        "coordination_breakdown"
      ],
      "allowedSecondaryFamilies": [
        "safety_incident",
        "environmental_spill",
        "workforce_fatigue_staffing_weakness"
      ],
      "canCoExistWith": [
        "workforce_fatigue_staffing_weakness"
      ],
      "canEscalateTo": [
        "safety_incident",
        "environmental_spill"
      ],
      "cannotBePrimaryWith": [],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "control_breakdown",
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
        "Permit-to-work and management-of-change controls are bypassed while corrective actions remain overdue.",
        "Emergency drills are overdue and machine guards are missing on contractor-operated equipment."
      ],
      "counterExamples": [
        "a worker is injured during the incident",
        "hostile traffic knocks the customer portal offline"
      ],
      "promptIdeaTemplates": [
        "Critical HSE controls are weak before an incident occurs",
        "Emergency-readiness and permit-to-work discipline are not holding"
      ],
      "shortlistSeedThemes": [
        "safety control weakness",
        "permit-to-work weakness",
        "management-of-change failure"
      ],
      "fallbackNarrativePatterns": [
        "Keep the scenario in the HSE lane when permit-to-work, management-of-change, emergency drills, contractor safety, or corrective-action discipline is the visible problem before harm occurs.",
        "Do not promote the scenario into safety incident or environmental spill unless injury, worker harm, or a release is explicitly stated."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "hse",
      "lensKey": "hse",
      "lensLabel": "HSE",
      "functionKey": "hse",
      "estimatePresetKey": "hse",
      "key": "safety_control_weakness",
      "label": "Safety control weakness",
      "domain": "esg_hse_people",
      "description": "Permit-to-work, management-of-change, hazard-control, emergency-preparedness, or corrective-action weaknesses create unsafe operating exposure before an injury or spill becomes the primary event."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "staff exhaustion",
          "strength": "medium"
        },
        {
          "text": "unsafe delivery conditions",
          "strength": "medium"
        },
        {
          "text": "burnout",
          "strength": "medium"
        },
        {
          "text": "repeated weekend work",
          "strength": "medium"
        },
        {
          "text": "weekend bid work",
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
        },
        {
          "text": "staff exhaustion",
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
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "shrinking core of experienced staff",
          "strength": "medium"
        },
        {
          "text": "weak onboarding",
          "strength": "medium"
        },
        {
          "text": "limited coaching",
          "strength": "medium"
        },
        {
          "text": "critical knowledge dependencies",
          "strength": "medium"
        },
        {
          "text": "informal onboarding",
          "strength": "medium"
        },
        {
          "text": "succession plans are nominal",
          "strength": "medium"
        },
        {
          "text": "capability depth",
          "strength": "medium"
        },
        {
          "text": "contingent specialists",
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
        },
        {
          "text": "knowledge concentration",
          "strength": "medium"
        },
        {
          "text": "critical knowledge dependencies",
          "strength": "medium"
        },
        {
          "text": "shrinking core of experienced staff",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "voluntary attrition",
          "strength": "medium"
        },
        {
          "text": "internal transfer requests",
          "strength": "medium"
        },
        {
          "text": "role progression",
          "strength": "medium"
        },
        {
          "text": "weak onboarding",
          "strength": "medium"
        },
        {
          "text": "limited coaching",
          "strength": "medium"
        },
        {
          "text": "mentor new hires",
          "strength": "medium"
        },
        {
          "text": "mentoring load",
          "strength": "medium"
        },
        {
          "text": "weekend bid work",
          "strength": "medium"
        },
        {
          "text": "shrinking core of experienced staff",
          "strength": "medium"
        },
        {
          "text": "scarce talent",
          "strength": "medium"
        },
        {
          "text": "critical specialist team",
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
          "text": "data transfer",
          "strength": "medium"
        },
        {
          "text": "plant room",
          "strength": "medium"
        },
        {
          "text": "badge bypass",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "voluntary attrition",
          "strength": "medium"
        },
        {
          "text": "internal transfer requests",
          "strength": "medium"
        },
        {
          "text": "role progression",
          "strength": "medium"
        },
        {
          "text": "weak onboarding",
          "strength": "medium"
        },
        {
          "text": "limited coaching",
          "strength": "medium"
        },
        {
          "text": "shrinking core of experienced staff",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "specialist team",
        "talent pipeline",
        "onboarding model"
      ],
      "typicalCauses": [
        "workload concentration",
        "unclear progression",
        "weak development support"
      ],
      "typicalConsequences": [
        "operational_disruption",
        "backlog_growth",
        "recovery_strain"
      ],
      "preferredRiskThemes": [
        "critical talent retention risk",
        "capability depth erosion",
        "onboarding and development weakness"
      ],
      "defaultMechanisms": [
        "fatigue_staffing_pressure",
        "key_person_concentration"
      ],
      "allowedSecondaryFamilies": [
        "critical_staff_dependency",
        "workforce_fatigue_staffing_weakness"
      ],
      "canCoExistWith": [
        "critical_staff_dependency",
        "workforce_fatigue_staffing_weakness"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "identity_compromise",
        "records_retention_non_compliance"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "operational_disruption",
        "reputational_damage",
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
        "voluntary attrition rises after repeated weekend bid work and weak role progression in a specialist team",
        "new hires receive limited coaching while a shrinking core of experienced staff carries delivery and mentoring"
      ],
      "counterExamples": [
        "records are kept beyond the permitted period",
        "a contractor bypasses a secure door"
      ],
      "promptIdeaTemplates": [
        "Attrition and weak progression are eroding critical capability depth",
        "Onboarding and coaching gaps are increasing dependence on a shrinking specialist core"
      ],
      "shortlistSeedThemes": [
        "critical talent retention risk",
        "capability concentration in senior staff",
        "onboarding and development weakness"
      ],
      "fallbackNarrativePatterns": [
        "Treat attrition, progression, and capability-development weakness as the event path rather than a generic delivery slowdown.",
        "Keep operational strain as a consequence unless the text clearly starts with a service failure instead."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "people-workforce",
      "lensLabel": "People / workforce",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "key": "talent_retention_development_weakness",
      "label": "Talent retention and development weakness",
      "domain": "esg_hse_people",
      "description": "Attrition, weak progression design, and poor development support erode critical capability depth in specialist teams."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 81,
      "positiveSignals": [
        {
          "text": "return-to-office",
          "strength": "medium"
        },
        {
          "text": "return to office",
          "strength": "medium"
        },
        {
          "text": "return-to-campus",
          "strength": "medium"
        },
        {
          "text": "return to campus",
          "strength": "medium"
        },
        {
          "text": "one-size-fits-all policy",
          "strength": "medium"
        },
        {
          "text": "late-evening coordination",
          "strength": "medium"
        },
        {
          "text": "quiet space",
          "strength": "medium"
        },
        {
          "text": "employee experience",
          "strength": "medium"
        },
        {
          "text": "campus allocation",
          "strength": "medium"
        },
        {
          "text": "hybrid workforce",
          "strength": "medium"
        },
        {
          "text": "role-localization",
          "strength": "medium"
        },
        {
          "text": "localization push",
          "strength": "medium"
        },
        {
          "text": "hidden second-job behavior",
          "strength": "medium"
        },
        {
          "text": "disengagement",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "identity compromise",
          "strength": "medium"
        },
        {
          "text": "battery room",
          "strength": "medium"
        },
        {
          "text": "failover logic",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "return-to-office",
          "strength": "medium"
        },
        {
          "text": "return to office",
          "strength": "medium"
        },
        {
          "text": "return-to-campus",
          "strength": "medium"
        },
        {
          "text": "return to campus",
          "strength": "medium"
        },
        {
          "text": "one-size-fits-all policy",
          "strength": "medium"
        },
        {
          "text": "employee experience",
          "strength": "medium"
        },
        {
          "text": "hybrid workforce",
          "strength": "medium"
        },
        {
          "text": "role-localization",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "workforce policy",
        "campus design",
        "specialist work pattern"
      ],
      "typicalCauses": [
        "uniform policy assumptions",
        "poor workplace design fit",
        "misread operating reality"
      ],
      "typicalConsequences": [
        "operational_disruption",
        "reputational_damage",
        "backlog_growth"
      ],
      "preferredRiskThemes": [
        "workforce model misfit",
        "employee-experience and retention pressure",
        "productivity loss from workplace-design mismatch"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "workforce_fatigue_staffing_weakness"
      ],
      "canCoExistWith": [
        "workforce_fatigue_staffing_weakness"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "perimeter_breach",
        "records_retention_non_compliance"
      ],
      "forbiddenDriftFamilies": [
        "perimeter_breach",
        "availability_attack"
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
        "a return-to-campus policy clashes with late-evening coordination windows and quiet-space needs",
        "role-localization and attendance assumptions no longer fit how specialist teams support global customers"
      ],
      "counterExamples": [
        "a campus gate is tailgated by an unauthorised visitor",
        "sensitive records are kept longer than policy allows"
      ],
      "promptIdeaTemplates": [
        "A workplace policy no longer fits how specialist teams actually operate",
        "Return-to-campus and localization assumptions are creating retention and effectiveness pressure"
      ],
      "shortlistSeedThemes": [
        "workforce policy misfit",
        "employee experience and retention pressure",
        "work-model effectiveness gap"
      ],
      "fallbackNarrativePatterns": [
        "Treat the policy and operating-model mismatch as the primary event path rather than a generic office, facilities, or confidentiality issue.",
        "Keep any security, continuity, or compliance references as context unless they clearly start the scenario."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "people-workforce",
      "lensLabel": "People / workforce",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "key": "workforce_policy_model_mismatch",
      "label": "Workforce policy and operating-model mismatch",
      "domain": "esg_hse_people",
      "description": "A one-size-fits-all workplace or localization policy conflicts with how specialist teams actually create value, reducing retention and effectiveness."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 80,
      "positiveSignals": [
        {
          "text": "compensation disparities",
          "strength": "medium"
        },
        {
          "text": "materially higher packages",
          "strength": "medium"
        },
        {
          "text": "mentor resentment",
          "strength": "medium"
        },
        {
          "text": "internal mobility",
          "strength": "medium"
        },
        {
          "text": "acceptance rates",
          "strength": "medium"
        },
        {
          "text": "comparable roles",
          "strength": "medium"
        },
        {
          "text": "local hiring decisions",
          "strength": "medium"
        },
        {
          "text": "scarce technology skills",
          "strength": "medium"
        },
        {
          "text": "higher packages",
          "strength": "medium"
        },
        {
          "text": "retention sentiment",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "forced labour",
          "strength": "medium"
        },
        {
          "text": "payment fraud",
          "strength": "medium"
        },
        {
          "text": "construction incident",
          "strength": "medium"
        },
        {
          "text": "data residency",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "compensation disparities",
          "strength": "medium"
        },
        {
          "text": "materially higher packages",
          "strength": "medium"
        },
        {
          "text": "internal mobility",
          "strength": "medium"
        },
        {
          "text": "acceptance rates",
          "strength": "medium"
        },
        {
          "text": "comparable roles",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "specialist talent pool",
        "offer governance",
        "internal mobility framework"
      ],
      "typicalCauses": [
        "decentralized pay decisions",
        "weak enterprise talent governance",
        "uneven offer discipline"
      ],
      "typicalConsequences": [
        "reputational_damage",
        "operational_disruption",
        "backlog_growth"
      ],
      "preferredRiskThemes": [
        "compensation equity pressure",
        "internal trust and morale erosion",
        "fragmented talent-governance risk"
      ],
      "defaultMechanisms": [],
      "allowedSecondaryFamilies": [
        "talent_retention_development_weakness"
      ],
      "canCoExistWith": [
        "talent_retention_development_weakness"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "payment_control_failure",
        "records_retention_non_compliance"
      ],
      "forbiddenDriftFamilies": [
        "payment_control_failure",
        "forced_labour_modern_slavery"
      ],
      "defaultOverlays": [
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
        "materially higher packages for similar roles create mentor resentment and internal mobility friction",
        "local hiring decisions create visible compensation disparities across scarce technology roles"
      ],
      "counterExamples": [
        "invoice splitting is used to bypass approvals",
        "a worker is injured on site"
      ],
      "promptIdeaTemplates": [
        "Decentralized pay decisions are creating equity and trust pressure in scarce talent pools",
        "Compensation and mobility governance no longer align across comparable specialist roles"
      ],
      "shortlistSeedThemes": [
        "compensation equity pressure",
        "manager trust erosion",
        "fragmented talent-governance risk"
      ],
      "fallbackNarrativePatterns": [
        "Treat pay disparity, mobility friction, and morale pressure as a workforce-governance event path rather than forcing it into compliance or finance.",
        "Keep legal or compliance exposure as downstream context unless the text says a formal breach occurred first."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "people-workforce",
      "lensLabel": "People / workforce",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "key": "compensation_equity_mobility_fragmentation",
      "label": "Compensation equity and mobility fragmentation",
      "domain": "esg_hse_people",
      "description": "Uncoordinated pay and mobility decisions across comparable roles undermine morale, trust, and talent-market credibility."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "contingent specialists",
          "strength": "medium"
        },
        {
          "text": "succession planning",
          "strength": "medium"
        },
        {
          "text": "learning access",
          "strength": "medium"
        },
        {
          "text": "leadership visibility",
          "strength": "medium"
        },
        {
          "text": "internal opportunity pathways",
          "strength": "medium"
        },
        {
          "text": "mixed employment model",
          "strength": "medium"
        },
        {
          "text": "promotion pathways",
          "strength": "medium"
        },
        {
          "text": "critical knowledge dependencies",
          "strength": "medium"
        },
        {
          "text": "capability maps",
          "strength": "medium"
        },
        {
          "text": "contractor populations",
          "strength": "medium"
        },
        {
          "text": "uneven development",
          "strength": "medium"
        },
        {
          "text": "talent architecture",
          "strength": "medium"
        },
        {
          "text": "critical capability management",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "ddos",
          "strength": "medium"
        },
        {
          "text": "identity compromise",
          "strength": "medium"
        },
        {
          "text": "export control",
          "strength": "medium"
        },
        {
          "text": "failover logic",
          "strength": "medium"
        },
        {
          "text": "climate disclosure",
          "strength": "medium"
        }
      ],
      "requiredSignals": [
        {
          "text": "contingent specialists",
          "strength": "medium"
        },
        {
          "text": "succession planning",
          "strength": "medium"
        },
        {
          "text": "learning access",
          "strength": "medium"
        },
        {
          "text": "mixed employment model",
          "strength": "medium"
        },
        {
          "text": "promotion pathways",
          "strength": "medium"
        },
        {
          "text": "critical knowledge dependencies",
          "strength": "medium"
        },
        {
          "text": "capability maps",
          "strength": "medium"
        }
      ],
      "typicalAssets": [
        "mixed workforce model",
        "succession pipeline",
        "critical capability map"
      ],
      "typicalCauses": [
        "segmented development access",
        "weak succession design",
        "contingent knowledge outside normal pathways"
      ],
      "typicalConsequences": [
        "recovery_strain",
        "operational_disruption",
        "reputational_damage"
      ],
      "preferredRiskThemes": [
        "critical capability resilience gap",
        "unequal workforce development pathways",
        "fragile mixed-workforce operating model"
      ],
      "defaultMechanisms": [
        "key_person_concentration"
      ],
      "allowedSecondaryFamilies": [
        "critical_staff_dependency",
        "talent_retention_development_weakness"
      ],
      "canCoExistWith": [
        "critical_staff_dependency",
        "talent_retention_development_weakness"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "supplier_control_weakness",
        "ot_resilience_failure"
      ],
      "forbiddenDriftFamilies": [
        "ot_resilience_failure",
        "forced_labour_modern_slavery"
      ],
      "defaultOverlays": [
        "recovery_strain",
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
        "contingent specialists hold critical know-how outside the normal talent-development system",
        "succession planning, learning access, and promotion pathways vary sharply across comparable worker populations"
      ],
      "counterExamples": [
        "an industrial edge controller becomes unstable after restart",
        "a supplier workforce faces forced labour allegations"
      ],
      "promptIdeaTemplates": [
        "A segmented workforce model is creating fragile capability resilience",
        "Uneven development access across worker populations is weakening critical succession depth"
      ],
      "shortlistSeedThemes": [
        "critical capability concentration",
        "unequal workforce development architecture",
        "talent resilience weakness"
      ],
      "fallbackNarrativePatterns": [
        "Treat workforce segmentation, succession weakness, and uneven development access as the event path rather than collapsing it into continuity or OT language.",
        "Keep business continuity implications as overlays unless the scenario starts with a disruption event instead of a people-model weakness."
      ],
      "preferredFamilyKey": "",
      "legacyKey": "people-workforce",
      "lensKey": "people-workforce",
      "lensLabel": "People / workforce",
      "functionKey": "hse",
      "estimatePresetKey": "peopleWorkforce",
      "key": "mixed_workforce_capability_architecture_gap",
      "label": "Mixed-workforce capability architecture gap",
      "domain": "esg_hse_people",
      "description": "Capability resilience weakens because contingent, specialist, and employee populations are developed unevenly across succession, learning, and opportunity pathways."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
        },
        {
          "text": "door on bypass",
          "strength": "medium"
        },
        {
          "text": "unbadged individual",
          "strength": "medium"
        },
        {
          "text": "visitor escort lapse",
          "strength": "medium"
        },
        {
          "text": "restricted office area",
          "strength": "medium"
        },
        {
          "text": "fence-line alarms",
          "strength": "medium"
        },
        {
          "text": "camera blind spots",
          "strength": "medium"
        },
        {
          "text": "temporary gate protocol",
          "strength": "medium"
        },
        {
          "text": "after-hours service access",
          "strength": "medium"
        },
        {
          "text": "after-hours logistics",
          "strength": "medium"
        },
        {
          "text": "prototype facility",
          "strength": "medium"
        },
        {
          "text": "vehicle checks",
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
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 82,
      "positiveSignals": [
        {
          "text": "temporary badge privileges",
          "strength": "medium"
        },
        {
          "text": "event footprint",
          "strength": "medium"
        },
        {
          "text": "room-booking exceptions",
          "strength": "medium"
        },
        {
          "text": "catering access windows",
          "strength": "medium"
        },
        {
          "text": "vip escorts",
          "strength": "medium"
        },
        {
          "text": "restricted zones",
          "strength": "medium"
        },
        {
          "text": "executive movement",
          "strength": "medium"
        },
        {
          "text": "executive floor",
          "strength": "medium"
        },
        {
          "text": "legal war room",
          "strength": "medium"
        },
        {
          "text": "delegation visit",
          "strength": "medium"
        },
        {
          "text": "transition points",
          "strength": "medium"
        },
        {
          "text": "unauthorized movement",
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
          "text": "retention breach",
          "strength": "medium"
        },
        {
          "text": "worker injury",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "executive area",
        "war room",
        "restricted zone",
        "delegation route"
      ],
      "typicalCauses": [
        "temporary access exception",
        "weak privilege reversal",
        "poor physical segregation"
      ],
      "typicalConsequences": [
        "control breakdown",
        "reputational damage",
        "leadership assurance pressure"
      ],
      "preferredRiskThemes": [
        "event-access exception exposure",
        "restricted-zone dilution",
        "executive-area proximity risk"
      ],
      "defaultMechanisms": [
        "access_control_weakness"
      ],
      "allowedSecondaryFamilies": [
        "perimeter_breach"
      ],
      "canCoExistWith": [
        "perimeter_breach"
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
        "control_breakdown",
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
        "temporary event badges and catering access windows create uncontrolled movement around a legal war room",
        "executive movement and restricted prototype routes overlap during a delegation visit"
      ],
      "counterExamples": [
        "website traffic flood degrades the customer portal",
        "supplier insolvency delays a programme milestone"
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
      "key": "access_exception_exposure",
      "label": "Access-exception and sensitive-zone exposure",
      "domain": "physical_ot",
      "description": "Temporary badge privileges, event exceptions, or weak zone segregation create unauthorized proximity to sensitive people, areas, or materials."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "contractor badges",
          "strength": "medium"
        },
        {
          "text": "loading bay",
          "strength": "medium"
        },
        {
          "text": "secure cage",
          "strength": "medium"
        },
        {
          "text": "vehicle screening",
          "strength": "medium"
        },
        {
          "text": "unsupervised access",
          "strength": "medium"
        },
        {
          "text": "prototype hardware",
          "strength": "medium"
        },
        {
          "text": "prototype labs",
          "strength": "medium"
        },
        {
          "text": "hardware staging",
          "strength": "medium"
        },
        {
          "text": "encrypted storage devices",
          "strength": "medium"
        },
        {
          "text": "compute modules",
          "strength": "medium"
        },
        {
          "text": "pre-configuration cage",
          "strength": "medium"
        },
        {
          "text": "after-hours logistics",
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
          "text": "policy retention breach",
          "strength": "medium"
        },
        {
          "text": "compensation inequity",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "staging floor",
        "secure cage",
        "prototype hardware",
        "loading route"
      ],
      "typicalCauses": [
        "informal badge reissue",
        "weak escort discipline",
        "incomplete vehicle screening"
      ],
      "typicalConsequences": [
        "asset interference",
        "control breakdown",
        "operational disruption"
      ],
      "preferredRiskThemes": [
        "restricted staging access weakness",
        "hardware tampering exposure",
        "loading-bay supervision failure"
      ],
      "defaultMechanisms": [
        "access_control_weakness"
      ],
      "allowedSecondaryFamilies": [
        "perimeter_breach"
      ],
      "canCoExistWith": [
        "perimeter_breach"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "service_delivery_failure",
        "availability_attack"
      ],
      "forbiddenDriftFamilies": [
        "identity_compromise",
        "payment_control_failure"
      ],
      "defaultOverlays": [
        "control_breakdown",
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
        "temporary contractor badges and a loading-bay escort route expose a secure hardware cage",
        "vehicle-screening logs are incomplete around a restricted staging facility"
      ],
      "counterExamples": [
        "endpoint malware encrypts customer files",
        "a contractual liability dispute delays the launch"
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
      "key": "sensitive_asset_staging_exposure",
      "label": "Sensitive asset staging and loading exposure",
      "domain": "physical_ot",
      "description": "Weak badge, escort, vehicle-screening, or loading-bay control exposes sensitive hardware or restricted staging areas to theft, tampering, or covert access."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
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
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 83,
      "positiveSignals": [
        {
          "text": "edge computing room",
          "strength": "medium"
        },
        {
          "text": "temperature alarms",
          "strength": "medium"
        },
        {
          "text": "power fluctuation",
          "strength": "medium"
        },
        {
          "text": "airflow settings",
          "strength": "medium"
        },
        {
          "text": "workload throttling",
          "strength": "medium"
        },
        {
          "text": "heatwave",
          "strength": "medium"
        },
        {
          "text": "power quality fluctuations",
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
        },
        {
          "text": "worker injury",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "edge computing room",
        "gateway cluster",
        "local inference hardware"
      ],
      "typicalCauses": [
        "environmental drift",
        "airflow change",
        "power-quality instability"
      ],
      "typicalConsequences": [
        "operational disruption",
        "recovery strain",
        "manual workload reduction"
      ],
      "preferredRiskThemes": [
        "edge-site environmental instability",
        "facilities-induced OT stress",
        "reduced resilience margin at the edge"
      ],
      "defaultMechanisms": [
        "industrial_control_instability"
      ],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [
        "ot_resilience_failure"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "availability_attack",
        "perimeter_breach"
      ],
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
        "an edge computing room shows temperature alarms and power fluctuation after airflow settings are changed",
        "heat and power stress force workload throttling across field gateway clusters"
      ],
      "counterExamples": [
        "a cloud account is compromised through stolen credentials",
        "a customer contract dispute delays deployment"
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
      "key": "edge_environmental_instability",
      "label": "Edge environmental instability",
      "domain": "physical_ot",
      "description": "Environmental or facilities conditions destabilize edge or site-adjacent OT infrastructure without any malicious trigger."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "telemetry gaps",
          "strength": "medium"
        },
        {
          "text": "manual field verification",
          "strength": "medium"
        },
        {
          "text": "gateway clocks",
          "strength": "medium"
        },
        {
          "text": "telemetry replay",
          "strength": "medium"
        },
        {
          "text": "control confirmations",
          "strength": "medium"
        },
        {
          "text": "connectivity loss",
          "strength": "medium"
        },
        {
          "text": "state reconstruction",
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
          "text": "lawful basis",
          "strength": "medium"
        },
        {
          "text": "supplier bribery",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "edge gateway",
        "telemetry buffer",
        "controller event log"
      ],
      "typicalCauses": [
        "clock drift",
        "rollback mismatch",
        "state-recovery sequencing defect"
      ],
      "typicalConsequences": [
        "recovery strain",
        "manual fallback",
        "reduced confidence in local control state"
      ],
      "preferredRiskThemes": [
        "telemetry recovery weakness",
        "clock and sequencing drift",
        "hidden resilience defect after communications loss"
      ],
      "defaultMechanisms": [
        "industrial_control_instability"
      ],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [
        "ot_resilience_failure"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "availability_attack",
        "perimeter_breach"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "recovery_strain",
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
        "gateway clocks drift and telemetry replay no longer reconstructs state cleanly after connectivity loss",
        "manual field verification is triggered because control confirmations and alarm ordering cannot be trusted"
      ],
      "counterExamples": [
        "a phishing email steals credentials from an operator",
        "a retention rule is breached for personal data"
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
      "key": "telemetry_state_recovery_failure",
      "label": "Telemetry and state-recovery failure",
      "domain": "physical_ot",
      "description": "Telemetry buffering, replay, clocking, or recovery sequencing becomes unreliable after disruption, weakening safe control-state reconstruction."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 85,
      "positiveSignals": [
        {
          "text": "failover logic",
          "strength": "medium"
        },
        {
          "text": "backup power transfer",
          "strength": "medium"
        },
        {
          "text": "restart priorities",
          "strength": "medium"
        },
        {
          "text": "regional grid disturbance",
          "strength": "medium"
        },
        {
          "text": "uneven resilience profile",
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
          "text": "policy breach",
          "strength": "medium"
        },
        {
          "text": "visitor management failure",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "building management controller",
        "backup power transfer path",
        "restart logic"
      ],
      "typicalCauses": [
        "site-to-site inconsistency",
        "isolated testing blind spot",
        "misaligned restoration priorities"
      ],
      "typicalConsequences": [
        "unpredictable recovery",
        "equipment stress",
        "unsafe restoration sequence"
      ],
      "preferredRiskThemes": [
        "site failover inconsistency",
        "restart-priority conflict",
        "estate-level OT resilience blind spot"
      ],
      "defaultMechanisms": [
        "industrial_control_instability"
      ],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [
        "ot_resilience_failure"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "availability_attack",
        "recovery_coordination_failure"
      ],
      "forbiddenDriftFamilies": [
        "availability_attack",
        "identity_compromise"
      ],
      "defaultOverlays": [
        "recovery_strain",
        "service_outage",
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
        "backup power transfer and restart priorities are inconsistent across critical-service sites",
        "a regional grid disturbance exposes hidden failover-logic differences between controllers and edge workloads"
      ],
      "counterExamples": [
        "an unauthorised person enters a restricted site zone",
        "a public website slows under hostile traffic"
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
      "key": "failover_sequence_inconsistency",
      "label": "Failover and restart-sequence inconsistency",
      "domain": "physical_ot",
      "description": "Restart priorities or failover logic across controllers, power transfer, and supporting site systems are inconsistent enough to create unstable restoration behavior."
    },
    {
      "status": "active",
      "familyVersion": "phase1.1.19-2026-04-10",
      "priorityScore": 84,
      "positiveSignals": [
        {
          "text": "timing mismatch",
          "strength": "medium"
        },
        {
          "text": "edge controller",
          "strength": "medium"
        },
        {
          "text": "older configuration baseline",
          "strength": "medium"
        },
        {
          "text": "false rejects",
          "strength": "medium"
        },
        {
          "text": "supervised mode",
          "strength": "medium"
        },
        {
          "text": "edge inference",
          "strength": "medium"
        },
        {
          "text": "actuator timing",
          "strength": "medium"
        },
        {
          "text": "reject gate",
          "strength": "medium"
        },
        {
          "text": "restart instability",
          "strength": "medium"
        }
      ],
      "antiSignals": [
        {
          "text": "adversarial prompt",
          "strength": "medium"
        },
        {
          "text": "privacy breach",
          "strength": "medium"
        },
        {
          "text": "supplier insolvency",
          "strength": "medium"
        },
        {
          "text": "cashflow stress",
          "strength": "medium"
        }
      ],
      "requiredSignals": [],
      "typicalAssets": [
        "edge controller",
        "local inference hardware",
        "actuator timing path"
      ],
      "typicalCauses": [
        "configuration divergence",
        "restart mismatch",
        "baseline drift"
      ],
      "typicalConsequences": [
        "degraded automation",
        "manual supervision",
        "quality and control instability"
      ],
      "preferredRiskThemes": [
        "control-edge timing mismatch",
        "configuration baseline drift in OT",
        "reduced industrial recoverability"
      ],
      "defaultMechanisms": [
        "industrial_control_instability"
      ],
      "allowedSecondaryFamilies": [
        "ot_resilience_failure"
      ],
      "canCoExistWith": [
        "ot_resilience_failure"
      ],
      "canEscalateTo": [],
      "cannotBePrimaryWith": [
        "availability_attack",
        "model_drift_monitoring_failure"
      ],
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
        "an edge controller reverts to an older baseline and timing mismatch causes false rejects until supervised mode is used",
        "edge inference decisions and actuator timing drift apart after restart instability"
      ],
      "counterExamples": [
        "model fairness degrades for a minority subgroup",
        "a contract clause dispute delays launch"
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
      "key": "control_edge_sync_mismatch",
      "label": "Control and edge synchronization mismatch",
      "domain": "physical_ot",
      "description": "An industrial workflow becomes unstable because control, timing, and edge execution components lose synchronization after change or restart."
    },
    {
      "status": "compatibility_only",
      "familyVersion": "phase1.1.19-2026-04-10",
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
