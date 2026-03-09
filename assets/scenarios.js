/**
 * scenarios.js — Pre-built scenario templates
 * Each template pre-fills the full wizard with realistic FAIR inputs.
 * Based on common GCC/UAE enterprise cyber threat patterns.
 */

const ScenarioTemplates = [
  {
    id: 'ransomware-ops',
    label: 'Ransomware — Operational Systems',
    icon: 'RW',
    description: 'Ransomware deployment via phishing or exposed RDP, targeting operational or production systems. Double-extortion model (encrypt + exfiltrate).',
    tags: ['Ransomware', 'High Impact', 'Common'],
    suggestedBUTypes: ['bu-fintech', 'bu-health', 'bu-iot', 'bu-enterprise-it'],
    draft: {
      scenarioTitle: 'Ransomware Attack on Operational Systems',
      narrative: 'A threat actor gains initial access through a phishing email targeting an employee with elevated system privileges. After establishing persistence and conducting internal reconnaissance over several days, they deploy ransomware across connected systems, encrypting critical operational databases and file shares. The attacker simultaneously exfiltrates sensitive data and threatens public release unless a ransom is paid (double-extortion). Systems are offline; manual operations are impossible at scale.',
      structuredScenario: {
        assetService: 'Core operational systems and databases',
        threatCommunity: 'Organised ransomware-as-a-service groups (e.g. LockBit, BlackCat affiliates)',
        attackType: 'Phishing → credential theft → lateral movement → ransomware deployment',
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
        tpMin: 0, tpLikely: 80000, tpMax: 600000,
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
    description: 'CEO/CFO impersonation or email account takeover leading to fraudulent wire transfer authorisation. Among the highest-frequency financial threats in the GCC.',
    tags: ['BEC', 'Financial Loss', 'High Frequency'],
    suggestedBUTypes: ['bu-enterprise-it', 'bu-fintech'],
    draft: {
      scenarioTitle: 'Business Email Compromise — Fraudulent Wire Transfer',
      narrative: 'An attacker compromises or impersonates a senior executive email account and initiates urgent payment requests to finance personnel. The attacker uses social engineering and spoofed domains to bypass verification steps. Fraudulent transfers are authorised before the deception is detected. In some variants, the attacker first compromises the email account of a supplier, inserting themselves into existing payment threads (vendor email compromise).',
      structuredScenario: {
        assetService: 'Corporate email, finance systems, payment authorisation workflows',
        threatCommunity: 'BEC specialist threat actors (often West African or Eastern European organised groups)',
        attackType: 'Email account takeover or domain spoofing → social engineering of finance staff → fraudulent payment authorisation',
        effect: 'Direct financial loss via fraudulent wire transfer; reputational damage; regulatory scrutiny'
      },
      fairParams: {
        distType: 'lognormal',
        iterations: 10000,
        tefMin: 2, tefLikely: 8, tefMax: 30,
        threatCapMin: 0.40, threatCapLikely: 0.58, threatCapMax: 0.78,
        controlStrMin: 0.42, controlStrLikely: 0.60, controlStrMax: 0.80,
        irMin: 20000, irLikely: 80000, irMax: 300000,
        biMin: 0, biLikely: 50000, biMax: 400000,
        dbMin: 0, dbLikely: 20000, dbMax: 150000,
        rlMin: 0, rlLikely: 40000, rlMax: 500000,
        tpMin: 0, tpLikely: 0, tpMax: 100000,
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
    description: 'A trusted vendor or software supplier is compromised, providing attackers with a trusted pathway into the organisation. SolarWinds and MOVEit-style attack patterns.',
    tags: ['Supply Chain', 'Third Party', 'Stealthy'],
    suggestedBUTypes: ['bu-cloud', 'bu-enterprise-it', 'bu-cyber'],
    draft: {
      scenarioTitle: 'Supply Chain Compromise via Trusted Vendor',
      narrative: 'A critical technology vendor or managed service provider used by the organisation is compromised by a sophisticated threat actor. The attacker uses the vendor\'s trusted access or a trojanised software update to establish a persistent foothold within our environment. Because the access appears legitimate, detection is significantly delayed. The attacker conducts quiet reconnaissance for weeks before moving laterally to high-value targets including source code repositories, customer data, or financial systems.',
      structuredScenario: {
        assetService: 'Internal systems accessible via vendor/MSP trusted access; high-value data stores',
        threatCommunity: 'Nation-state or sophisticated organised criminal groups with supply chain targeting capability',
        attackType: 'Vendor compromise → trusted access abuse → lateral movement → data access or persistent implant',
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
    description: 'Misconfigured cloud storage, API, or access controls expose sensitive data publicly or to unauthorised parties. High frequency; often detected externally.',
    tags: ['Cloud', 'Data Exposure', 'High Frequency'],
    suggestedBUTypes: ['bu-cloud', 'bu-ai', 'bu-enterprise-it'],
    draft: {
      scenarioTitle: 'Cloud Misconfiguration Leading to Sensitive Data Exposure',
      narrative: 'A cloud storage bucket, database, or API endpoint is inadvertently exposed due to a misconfiguration during deployment or a change in cloud provider defaults. Sensitive data including customer records, internal documents, or credentials is accessible without authentication. The exposure is discovered by an external researcher, a threat actor, or during an internal security audit. Depending on the data involved, regulatory notification obligations are triggered.',
      structuredScenario: {
        assetService: 'Cloud-hosted data stores (blob storage, S3-equivalent, managed databases, APIs)',
        threatCommunity: 'Opportunistic attackers using automated cloud scanning tools; security researchers',
        attackType: 'Misconfiguration → public or unauthorised access → automated discovery → data access/exfiltration',
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
    description: 'A current or departing employee, contractor, or privileged user deliberately exfiltrates sensitive data. Often detected late; impact includes IP loss and regulatory consequences.',
    tags: ['Insider', 'Data Theft', 'Hard to Detect'],
    suggestedBUTypes: ['bu-ai', 'bu-cyber', 'bu-health', 'bu-fintech'],
    draft: {
      scenarioTitle: 'Insider Data Theft — Privileged User Exfiltration',
      narrative: 'A privileged employee — or a departing staff member in their notice period — deliberately exfiltrates sensitive intellectual property, customer data, or trade secrets. The exfiltration occurs gradually over time using authorised access channels (email, cloud sync, USB), making it difficult to distinguish from normal activity until DLP tools or behavioural analytics flag anomalies. In contractor scenarios, access may persist beyond contract end due to incomplete offboarding.',
      structuredScenario: {
        assetService: 'Sensitive data repositories: IP, customer records, financial data, research assets',
        threatCommunity: 'Malicious insider — employee, contractor, or recently departed staff with residual access',
        attackType: 'Authorised access abuse → gradual or bulk data exfiltration via email/USB/cloud → delayed detection',
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
  }
];
