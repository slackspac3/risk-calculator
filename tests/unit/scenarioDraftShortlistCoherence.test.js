'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyScenario } = require('../../api/_scenarioClassification');
const { workflowUtils } = require('../../api/_scenarioDraftWorkflow');

function enforceShortlist(candidateRisks, {
  narrative,
  fallbackRisks,
  guidedInput
} = {}) {
  return workflowUtils.enforceScenarioShortlistCoherence(candidateRisks, {
    acceptedClassification: classifyScenario(narrative, { guidedInput }),
    finalNarrative: narrative,
    seedNarrative: narrative,
    input: {
      guidedInput,
      applicableRegulations: ['ISO 27001']
    },
    fallbackRisks
  });
}

function listTitles(result = {}) {
  return (Array.isArray(result.risks) ? result.risks : []).map((risk) => String(risk?.title || '')).join(' | ');
}

function assertCoherenceMetadata(result = {}) {
  assert.match(String(result.mode || ''), /accepted|filtered|fallback_replaced/);
  assert.equal(typeof result.totalCount, 'number');
  assert.equal(typeof result.alignedCount, 'number');
  assert.equal(typeof result.filteredOutCount, 'number');
  assert.equal(typeof result.blockedCount, 'number');
  assert.equal(typeof result.weakOverlayOnlyCount, 'number');
  assert.equal(typeof result.confidenceScore, 'number');
  assert.match(String(result.confidenceBand || ''), /high|medium|low/);
  assert.ok(Array.isArray(result.confidenceDrivers));
  assert.equal(typeof result.calibrationMode, 'string');
  assert.ok(Array.isArray(result.dominantFamilies));
  assert.ok(Array.isArray(result.blockedFamilies));
  assert.ok(Array.isArray(result.reasonCodes));
  assert.equal(typeof result.taxonomyVersion, 'string');
}

test('identity compromise shortlist coherence replaces finance-led drift with taxonomy-safe cyber risks', () => {
  const narrative = 'Azure global admin credentials discovered on the dark web are used to access the tenant and modify critical configurations.';
  const result = enforceShortlist([
    {
      title: 'Privileged account takeover through exposed admin credentials',
      category: 'Identity & Access',
      description: 'Exposed global admin credentials enable tenant access and privileged control changes.'
    },
    {
      title: 'Direct financial loss from payment-control weakness',
      category: 'Finance',
      description: 'Monetary loss follows because payment controls are weak.'
    },
    {
      title: 'Payment process exposure from approval gap',
      category: 'Finance',
      description: 'The event exposes payment approval weaknesses.'
    },
    {
      title: 'Fraud controls review after suspicious activity',
      category: 'Fraud / Integrity',
      description: 'Fraud controls require review after the suspicious activity.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: [
      {
        title: 'Privileged account takeover through exposed admin credentials',
        category: 'Identity & Access',
        description: 'Exposed global admin credentials enable tenant access and privilege abuse.'
      },
      {
        title: 'Unauthorized configuration change after tenant compromise',
        category: 'Cloud Security',
        description: 'Compromised administrative access can change critical tenant settings and weaken controls.'
      },
      {
        title: 'Operational disruption from privileged control changes',
        category: 'Operational Resilience',
        description: 'Control changes made through the compromised tenant can disrupt critical services and recovery work.'
      }
    ]
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assert.equal(result.usedFallbackShortlist, true);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'identity_compromise');
  assert.ok(Array.isArray(result.acceptedSecondaryFamilyKeys));
  assert.ok(Array.isArray(result.acceptedMechanismKeys));
  assert.ok(Array.isArray(result.acceptedOverlayKeys));
  assert.equal(typeof result.filteredOutCount, 'number');
  assert.ok(result.filteredOutCount >= 1);
  assert.ok(result.blockedFamilies.includes('payment_control_failure'));
  assertCoherenceMetadata(result);
  const titles = listTitles(result);
  assert.match(titles, /privileged|tenant|configuration/i);
  assert.doesNotMatch(titles, /payment|fraud controls/i);
});

test('shortlist confidence calibrates down from accepted to filtered to fallback-replaced', () => {
  const narrative = 'Azure global admin credentials are used to access the tenant and modify critical configurations.';
  const accepted = enforceShortlist([
    {
      title: 'Privileged account takeover through exposed admin credentials',
      category: 'Identity & Access',
      description: 'Exposed privileged credentials enable tenant access and control abuse.'
    },
    {
      title: 'Unauthorized configuration change after tenant compromise',
      category: 'Cloud Security',
      description: 'Compromised administrative access can change critical tenant settings.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });
  const filtered = enforceShortlist([
    {
      title: 'Privileged account takeover through exposed admin credentials',
      category: 'Identity & Access',
      description: 'Exposed privileged credentials enable tenant access and control abuse.'
    },
    {
      title: 'Direct financial loss from weak payment approvals',
      category: 'Finance',
      description: 'The scenario should focus on treasury approvals and financial loss.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });
  const replaced = enforceShortlist([
    {
      title: 'Treasury control redesign after payment loss',
      category: 'Finance',
      description: 'Focus on payment approval redesign and direct monetary loss.'
    },
    {
      title: 'Regulatory remediation after control weakness',
      category: 'Compliance',
      description: 'Regulatory scrutiny and policy remediation are the main issues.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.equal(accepted.mode, 'accepted');
  assert.equal(filtered.mode, 'filtered');
  assert.equal(replaced.mode, 'fallback_replaced');
  assert.equal(accepted.confidenceBand, 'high');
  assert.equal(replaced.confidenceBand, 'low');
  assert.ok(accepted.confidenceScore > filtered.confidenceScore);
  assert.ok(filtered.confidenceScore > replaced.confidenceScore);
});

test('availability attack shortlist coherence blocks compliance and AI drift', () => {
  const narrative = 'A volumetric DDoS attack floods the public website and degrades customer-facing services.';
  const result = enforceShortlist([
    {
      title: 'Public website outage from hostile traffic saturation',
      category: 'Cyber',
      description: 'Traffic flooding overwhelms the internet-facing service and degrades availability.'
    },
    {
      title: 'Compliance assurance gap after disruption',
      category: 'Compliance',
      description: 'Assurance activity is required after the disruption.'
    },
    {
      title: 'Policy breach response and control remediation',
      category: 'Compliance',
      description: 'The disruption prompts a policy review response.'
    },
    {
      title: 'AI model governance review',
      category: 'AI / Model Risk',
      description: 'Model governance is reviewed because the service was disrupted.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: [
      {
        title: 'Customer-facing service outage from traffic flooding',
        category: 'Cyber',
        description: 'Hostile traffic saturation overwhelms the public website and degrades customer services.'
      },
      {
        title: 'Recovery strain and backlog growth after disruption',
        category: 'Operational Resilience',
        description: 'Once the outage starts, restoration work and deferred demand can accumulate quickly.'
      },
      {
        title: 'Reputational damage from visible availability loss',
        category: 'Customer Impact',
        description: 'Public service degradation can damage customer confidence and external perception.'
      }
    ]
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assertCoherenceMetadata(result);
  const titles = listTitles(result);
  assert.match(titles, /traffic|outage|recovery|availability/i);
  assert.doesNotMatch(titles, /compliance|policy|ai model/i);
});

test('privacy non-compliance shortlist coherence filters disclosure cards without explicit disclosure signals', () => {
  const narrative = 'Customer records are retained and processed in breach of privacy obligations and lawful-basis requirements.';
  const result = enforceShortlist([
    {
      title: 'Privacy obligation failure from unlawful processing',
      category: 'Compliance',
      description: 'Personal data is retained and processed outside permitted privacy obligations.'
    },
    {
      title: 'External breach and data exfiltration from retained records',
      category: 'Data Exposure',
      description: 'Retained records could be exfiltrated and disclosed externally.'
    },
    {
      title: 'Leaked customer records after storage exposure',
      category: 'Data Exposure',
      description: 'Customer records are leaked from exposed storage.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: [
      {
        title: 'Privacy obligation failure from unlawful processing',
        category: 'Compliance',
        description: 'Processing and retention activity breaches data-protection obligations.'
      },
      {
        title: 'Regulatory scrutiny from privacy control weakness',
        category: 'Compliance',
        description: 'The obligation failure can trigger data-protection scrutiny and legal exposure.'
      },
      {
        title: 'Legal exposure from non-compliant records handling',
        category: 'Legal / Contract',
        description: 'Retention and processing failures can create legal challenge and remediation pressure.'
      }
    ]
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assertCoherenceMetadata(result);
  const titles = listTitles(result);
  assert.match(titles, /privacy|regulatory|legal/i);
  assert.doesNotMatch(titles, /exfiltration|leaked/i);
});

test('delivery slippage shortlist coherence removes cyber cards when no cyber cause is present', () => {
  const narrative = 'A key supplier misses committed delivery dates, delaying infrastructure deployment and dependent projects.';
  const result = enforceShortlist([
    {
      title: 'Supplier delivery slippage delays deployment milestones',
      category: 'Supply Chain',
      description: 'Missed delivery dates push back infrastructure deployment and downstream work.'
    },
    {
      title: 'Cyber compromise of supplier platform',
      category: 'Cyber',
      description: 'A supplier platform compromise disrupts the deployment schedule.'
    },
    {
      title: 'Credential theft in vendor access path',
      category: 'Cyber',
      description: 'Credentials are stolen from the supplier portal.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: [
      {
        title: 'Supplier delivery slippage delays deployment milestones',
        category: 'Supply Chain',
        description: 'Missed delivery dates push back infrastructure deployment and downstream work.'
      },
      {
        title: 'Backlog growth across dependent projects',
        category: 'Operational',
        description: 'Delayed delivery forces dependent projects to queue and re-sequence work.'
      },
      {
        title: 'Third-party dependency strain on critical delivery path',
        category: 'Supply Chain',
        description: 'The supplier miss exposes dependency concentration on the deployment schedule.'
      }
    ]
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assertCoherenceMetadata(result);
  const titles = listTitles(result);
  assert.match(titles, /supplier|deployment|backlog|dependency/i);
  assert.doesNotMatch(titles, /cyber|credential/i);
});

test('mixed identity and disclosure scenarios can keep explicit disclosure risks as secondaries', () => {
  const narrative = 'Azure global admin credentials discovered on the dark web are used to access the tenant, modify critical configurations, and extract customer records.';
  const result = enforceShortlist([
    {
      title: 'Privileged account takeover through exposed admin credentials',
      category: 'Identity & Access',
      description: 'Exposed global admin credentials enable tenant access and privilege abuse.'
    },
    {
      title: 'Customer record disclosure after tenant compromise',
      category: 'Data Exposure',
      description: 'The compromised tenant is used to extract and expose customer records.'
    },
    {
      title: 'Unauthorized configuration change after tenant compromise',
      category: 'Cloud Security',
      description: 'Administrative abuse changes critical tenant controls.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.equal(result.usedFallbackShortlist, false);
  assert.notEqual(result.mode, 'fallback_replaced');
  assertCoherenceMetadata(result);
  const titles = listTitles(result);
  assert.match(titles, /privileged|customer record disclosure|configuration/i);
});

test('shortlist coherence rebuilds a deterministic aligned shortlist when both candidate and fallback lists drift off-lane', () => {
  const narrative = 'A volumetric DDoS attack floods the public website and degrades customer-facing services.';
  const result = enforceShortlist([
    {
      title: 'Compliance assurance gap after disruption',
      category: 'Compliance',
      description: 'Assurance work is required after the website incident.'
    },
    {
      title: 'Regulatory filing issue after service degradation',
      category: 'Regulatory',
      description: 'A regulator-facing filing issue emerges after the disruption.'
    },
    {
      title: 'AI model governance concern after outage',
      category: 'AI / Model Risk',
      description: 'Model governance is reviewed after the public website outage.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: [
      {
        title: 'Policy breach response and remediation',
        category: 'Compliance',
        description: 'Policy remediation is prioritised after the event.'
      },
      {
        title: 'Regulatory assurance issue after website incident',
        category: 'Regulatory',
        description: 'Regulatory assurance follow-up is triggered by the incident.'
      }
    ]
  });

  assert.equal(result.mode, 'fallback_replaced');
  assert.equal(result.usedFallbackShortlist, true);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'availability_attack');
  assert.equal(typeof result.filteredOutCount, 'number');
  assert.ok(result.filteredOutCount >= 3);
  assert.ok(Array.isArray(result.allowedSecondaryFamilyKeys));
  assert.ok(result.reasonCodes.includes('DETERMINISTIC_SHORTLIST_REBUILT'));
  assertCoherenceMetadata(result);
  const titles = listTitles(result);
  assert.match(titles, /website|availability|traffic|recovery|attack/i);
  assert.doesNotMatch(titles, /compliance|policy breach|regulatory|ai model/i);
});

test('operational service failure shortlist stays operational when fallback controls are working', () => {
  const narrative = 'A customer-facing service becomes unstable due to repeated platform defects, but failover and fallback controls continue working.';
  const result = enforceShortlist([
    {
      title: 'Repeated platform defects destabilise the customer-facing service',
      category: 'Operational',
      description: 'Defects and unstable releases drive recurring service disruption and manual workarounds.'
    },
    {
      title: 'Business continuity failover gap during the incident',
      category: 'Business Continuity',
      description: 'A failover weakness is assumed even though fallback and recovery controls are functioning.'
    },
    {
      title: 'Backlog growth from unstable service recovery work',
      category: 'Operational',
      description: 'Repeated service instability creates manual rework, delayed processing, and rising backlog.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: [
      {
        title: 'Repeated platform defects destabilise the customer-facing service',
        category: 'Operational',
        description: 'Defects and unstable releases drive recurring service disruption and manual workarounds.'
      },
      {
        title: 'Backlog growth from unstable service recovery work',
        category: 'Operational',
        description: 'Repeated instability creates rework, backlog, and service pressure.'
      }
    ]
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'service_delivery_failure');
  const titles = listTitles(result);
  assert.match(titles, /platform defects|service|backlog/i);
  assert.doesNotMatch(titles, /failover gap|business continuity/i);
});

test('explicit no-DR shortlist stays continuity-led instead of generic operational outage', () => {
  const narrative = 'A critical messaging platform fails and there is no failover or disaster recovery capability.';
  const result = enforceShortlist([
    {
      title: 'No failover for the critical messaging platform',
      category: 'Business Continuity',
      description: 'The platform outage outlasts recovery assumptions because no failover path exists.'
    },
    {
      title: 'Disaster recovery gap extends the messaging outage',
      category: 'Business Continuity',
      description: 'The organisation cannot restore the service within expected recovery objectives.'
    },
    {
      title: 'General service instability in core communications',
      category: 'Operational',
      description: 'The outage causes operational disruption across the communications service.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.equal(result.mode, 'filtered');
  assertCoherenceMetadata(result);
  assert.match(String(result.acceptedPrimaryFamilyKey || ''), /dr_gap|failover_failure/);
  const titles = listTitles(result);
  assert.match(titles, /failover|disaster recovery|messaging outage/i);
  assert.doesNotMatch(titles, /general service instability/i);
});

test('physical intrusion shortlist keeps the perimeter-breach lane and filters generic operational drift', () => {
  const narrative = 'An unauthorised person bypasses facility controls and enters a restricted operations area.';
  const result = enforceShortlist([
    {
      title: 'Restricted-area intrusion through failed facility controls',
      category: 'Physical Security',
      description: 'Unauthorised access bypasses site controls and reaches the restricted operations area.'
    },
    {
      title: 'Operational disruption after the site incident',
      category: 'Operational',
      description: 'Operational disruption follows after the facility incident.'
    },
    {
      title: 'Perimeter access control breach at the restricted site',
      category: 'Physical Security',
      description: 'Perimeter and site-access controls fail to stop entry into a controlled area.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.match(String(result.mode || ''), /accepted|filtered/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'perimeter_breach');
  assert.equal(String(result.dominantFamilies?.[0]?.familyKey || ''), 'perimeter_breach');
  const titles = listTitles(result);
  assert.match(titles, /restricted|facility|perimeter|access control/i);
});

test('OT resilience shortlist keeps the industrial-control event path', () => {
  const narrative = 'An industrial control environment becomes unstable and site operations cannot be sustained safely.';
  const result = enforceShortlist([
    {
      title: 'Industrial control instability disrupts safe site operations',
      category: 'OT / Site Resilience',
      description: 'Control-system instability makes site operations unsafe to sustain.'
    },
    {
      title: 'Generic operational outage across site systems',
      category: 'Operational',
      description: 'Operational outage language obscures the industrial-control event path.'
    },
    {
      title: 'OT resilience failure across critical control systems',
      category: 'OT / Site Resilience',
      description: 'Control-system resilience fails and safe site operation cannot continue.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'ot_resilience_failure');
  const titles = listTitles(result);
  assert.match(titles, /industrial control|ot resilience|control systems/i);
});

test('payment control weakness shortlist stays in finance when deception is absent', () => {
  const narrative = 'A payment approval control is weak and manual overrides can bypass segregation, but no deceptive instruction is identified.';
  const result = enforceShortlist([
    {
      title: 'Payment approval control weakness bypasses segregation',
      category: 'Financial Controls',
      description: 'Weak approval and override controls create direct payment-control exposure.'
    },
    {
      title: 'Fake invoice deception in the payment flow',
      category: 'Fraud / Integrity',
      description: 'Invoice deception is assumed even though no fraudulent instruction is identified.'
    },
    {
      title: 'Treasury review after control weakness',
      category: 'Financial',
      description: 'Treasury and finance controls need review after the weakness is found.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.match(String(result.mode || ''), /filtered|accepted/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'payment_control_failure');
  const titles = listTitles(result);
  assert.match(titles, /payment approval|treasury|control weakness/i);
  assert.doesNotMatch(titles, /fake invoice deception/i);
});

test('explicit invoice deception shortlist stays in the fraud lane', () => {
  const narrative = 'A fake invoice is submitted and approved, creating payment loss through deceptive vendor instructions.';
  const result = enforceShortlist([
    {
      title: 'Fake invoice approval through deceptive vendor instructions',
      category: 'Fraud / Integrity',
      description: 'Deceptive instructions drive approval of a fake invoice and payment loss.'
    },
    {
      title: 'Payment control weakness in the approval chain',
      category: 'Financial Controls',
      description: 'Control weaknesses sit in the background of the deceptive approval path.'
    },
    {
      title: 'Direct monetary loss after the false invoice payment',
      category: 'Financial',
      description: 'Loss follows from the deceptive payment event.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assertCoherenceMetadata(result);
  assert.match(String(result.acceptedPrimaryFamilyKey || ''), /invoice_fraud|payment_fraud/);
  const titles = listTitles(result);
  assert.match(titles, /fake invoice|deceptive|false invoice|fraud/i);
});

test('third-party access compromise shortlist retains the vendor-access event path', () => {
  const narrative = 'A vendor access path is compromised and used to reach internal systems.';
  const result = enforceShortlist([
    {
      title: 'Compromised vendor access path reaches internal systems',
      category: 'Third-Party Access',
      description: 'An external provider access route is abused to reach internal systems and controls.'
    },
    {
      title: 'Internal administrator credential misuse',
      category: 'Cyber',
      description: 'Generic internal identity misuse language omits the third-party access path.'
    },
    {
      title: 'Weak vendor access segregation before compromise',
      category: 'Third-Party Access',
      description: 'Weak access segregation in the vendor path makes the compromise easier to execute.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.match(String(result.mode || ''), /filtered|accepted/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'third_party_access_compromise');
  const titles = listTitles(result);
  assert.match(titles, /vendor access|third-party access|compromised vendor/i);
  assert.doesNotMatch(titles, /internal administrator credential misuse/i);
});

test('forced labour shortlist stays ESG-led instead of procurement-only', () => {
  const narrative = 'Sub-tier suppliers are found to be using forced labour conditions that were not identified through due diligence.';
  const result = enforceShortlist([
    {
      title: 'Forced labour conditions in the supplier workforce',
      category: 'ESG',
      description: 'Human-rights abuse and forced labour are found in the sub-tier workforce.'
    },
    {
      title: 'Supplier concentration and sourcing exposure',
      category: 'Procurement',
      description: 'Procurement concentration becomes the only focus despite explicit labour abuse.'
    },
    {
      title: 'Human-rights due-diligence gap in the supply base',
      category: 'ESG',
      description: 'Due diligence misses explicit labour exploitation in the supply chain.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.equal(result.mode, 'filtered');
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'forced_labour_modern_slavery');
  const titles = listTitles(result);
  assert.match(titles, /forced labour|human-rights|due-diligence/i);
  assert.doesNotMatch(titles, /supplier concentration/i);
});

test('greenwashing shortlist stays in the ESG disclosure lane instead of generic policy breach', () => {
  const narrative = 'Public sustainability claims cannot be evidenced and differ materially from actual operating practice.';
  const result = enforceShortlist([
    {
      title: 'Unsupported public sustainability claims',
      category: 'ESG',
      description: 'Public sustainability statements cannot be evidenced against actual operating practice.'
    },
    {
      title: 'Generic policy breach in the reporting process',
      category: 'Compliance',
      description: 'Policy language appears, but the explicit event path is misleading external ESG disclosure.'
    },
    {
      title: 'Mismatch between sustainability claim and operating practice',
      category: 'ESG',
      description: 'The public claim differs materially from what operations can evidence.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.match(String(result.mode || ''), /filtered|fallback_replaced/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'greenwashing_disclosure_gap');
  const titles = listTitles(result);
  assert.match(titles, /esg disclosure|unsupported esg claim|sustainability claims|greenwashing/i);
  assert.doesNotMatch(titles, /generic policy breach/i);
});

test('safety-incident shortlist stays in the HSE lane instead of generic operational disruption', () => {
  const narrative = 'Unsafe operating conditions lead to a site safety incident with potential worker harm.';
  const result = enforceShortlist([
    {
      title: 'Unsafe operating conditions create a site safety incident',
      category: 'HSE',
      description: 'Unsafe conditions lead directly to a site safety incident and worker-harm risk.'
    },
    {
      title: 'Operational disruption after the site issue',
      category: 'Operational',
      description: 'Operational disruption language follows but does not define the primary safety event path.'
    },
    {
      title: 'Worker-harm risk from unsafe site conditions',
      category: 'HSE',
      description: 'Unsafe site conditions create a credible worker-harm event path.'
    }
  ], {
    narrative,
    guidedInput: { event: narrative },
    fallbackRisks: []
  });

  assert.match(String(result.mode || ''), /accepted|filtered/);
  assertCoherenceMetadata(result);
  assert.equal(String(result.acceptedPrimaryFamilyKey || ''), 'safety_incident');
  assert.equal(String(result.dominantFamilies?.[0]?.familyKey || ''), 'safety_incident');
  const titles = listTitles(result);
  assert.match(titles, /site safety incident|worker-harm|unsafe/i);
});
