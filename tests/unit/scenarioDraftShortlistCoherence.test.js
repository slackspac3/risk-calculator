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
  assert.ok(result.blockedFamilies.includes('payment_control_failure'));
  const titles = listTitles(result);
  assert.match(titles, /privileged|tenant|configuration/i);
  assert.doesNotMatch(titles, /payment|fraud controls/i);
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
  const titles = listTitles(result);
  assert.match(titles, /privileged|customer record disclosure|configuration/i);
});
