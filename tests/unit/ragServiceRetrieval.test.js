'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadRagService() {
  const filePath = path.resolve(__dirname, '../../assets/services/ragService.js');
  const source = `${fs.readFileSync(filePath, 'utf8')}\n;globalThis.__RAGService = RAGService;`;
  const context = {
    console,
    URL,
    Date,
    Math,
    JSON,
    Promise,
    Set,
    Map,
    Array,
    RegExp,
    window: {}
  };
  context.global = context;
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: filePath });
  return context.__RAGService;
}

const docs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/docs.json'), 'utf8'));
const buData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/bu.json'), 'utf8'));

function initService() {
  const service = loadRagService();
  service.init(docs, buData);
  return service;
}

test('retrieval surfaces vendor-access references for third-party access weakness wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Vendor accounts have broad access across critical systems without clear segregation.',
    scenarioLens: { key: 'third-party' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso27036-22', 'doc-nist-800161-53'].includes(doc.docId)), true);
});

test('retrieval surfaces sustainability-substantiation references for greenwashing wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Public sustainability claims cannot be substantiated because renewable energy attributes do not match the workload geography.',
    scenarioLens: { key: 'esg' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-ifrs-s1s2-27', 'doc-csrd-esrs-36', 'doc-cdp-74'].includes(doc.docId)), true);
});

test('retrieval surfaces scope-3 and MRV references for supplier-emissions evidence gaps', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Scope 3 reduction claims cannot be evidenced because supplier emissions data does not reconcile to underlying activity data.',
    scenarioLens: { key: 'esg' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-ghg-protocol-73', 'doc-cdp-74', 'doc-internal-esg-climate-82'].includes(doc.docId)), true);
});

test('retrieval surfaces disclosure-governance references for sustainability-linked KPI challenge wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'A sustainability-linked loan KPI cannot be evidenced and the claimed margin step-down is under assurance challenge.',
    scenarioLens: { key: 'esg' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-internal-esg-disclosure-81', 'doc-internal-esg-climate-82', 'doc-tcfd-72'].includes(doc.docId)), true);
});

test('retrieval surfaces workforce-fatigue references for understaffing wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Repeated weekend bid work, fatigue, and understaffing are creating unsafe delivery conditions.',
    scenarioLens: { key: 'people-workforce' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso45003-78', 'doc-ilo-osh-54'].includes(doc.docId)), true);
});

test('retrieval surfaces human-rights remediation references for labour-broker grievance wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Worker grievances reveal recruitment fees, passport retention, and delayed remediation in a labour-broker layer.',
    scenarioLens: { key: 'esg' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-oecd-rbc-48', 'doc-ungp-49', 'doc-internal-esg-humanrights-83'].includes(doc.docId)), true);
});

test('retrieval surfaces continuity references for alternate-workspace fallback wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'A site utility outage forces relocation, but alternate workspace and manual fallback steps are unclear.',
    scenarioLens: { key: 'business-continuity' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso22301-20', 'doc-iso22361-51'].includes(doc.docId)), true);
});

test('retrieval surfaces financial-control references for duplicate-payment wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Duplicate supplier payments were released after approval overrides and weak segregation of duties in the payment step.',
    scenarioLens: { key: 'financial' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-coso-ic-33'].includes(doc.docId)), true);
});

test('retrieval surfaces privacy retention and transfer safeguards references for novel obligation wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Records were kept too long and troubleshooting logs were transferred abroad without lawful basis or transfer safeguards.',
    scenarioLens: { key: 'compliance' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-data-05', 'doc-gdpr-06'].includes(doc.docId)), true);
});

test('retrieval surfaces privacy-governance references for DPIA and data-subject-rights wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'A data protection impact assessment is not completed for high-risk biometric processing, data subject rights requests are delayed, and controller-processor responsibilities are unclear.',
    scenarioLens: { key: 'compliance' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso27701-19', 'doc-gdpr-06', 'doc-internal-privacy-96'].includes(doc.docId)), true);
});

test('retrieval surfaces UAE health-data privacy references for patient-data safeguard wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Patient-data processing in the UAE proceeds without a high-risk assessment, medical-records access logging is weak, and health-data transfer safeguards are incomplete.',
    scenarioLens: { key: 'compliance' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-internal-privacy-health-97', 'doc-hipaa-39', 'doc-gdpr-06'].includes(doc.docId)), true);
});

test('retrieval surfaces speak-up and investigation references for retaliation wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'A whistleblower reports misconduct and then faces retaliation while the investigation protocol is not followed.',
    scenarioLens: { key: 'compliance' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso37301-26', 'doc-internal-compliance-speakup-84'].includes(doc.docId)), true);
});

test('retrieval surfaces anti-bribery references for public-official hospitality wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Sponsored travel and hospitality for a public official proceed without the required anti-bribery approvals.',
    scenarioLens: { key: 'fraud-integrity' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso37001-57', 'doc-internal-compliance-abc-85'].includes(doc.docId)), true);
});

test('retrieval surfaces trade-control references for restricted-jurisdiction remote-access wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Remote technical access from a restricted jurisdiction was enabled for export-controlled systems before screening clearance was completed.',
    scenarioLens: { key: 'regulatory' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-bis-export-09', 'doc-ofac-11', 'doc-internal-compliance-tradecontrols-86'].includes(doc.docId)), true);
});

test('retrieval surfaces business-partner due-diligence references for unresolved red-flag wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'A business partner was approved through escalation even though beneficial ownership red flags remained unresolved.',
    scenarioLens: { key: 'third-party' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso37001-57', 'doc-internal-compliance-thirdparty-87'].includes(doc.docId)), true);
});

test('retrieval surfaces market-conduct references for insider-information blackout wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'An employee discusses material non-public information during a blackout period before disclosure controls are complete.',
    scenarioLens: { key: 'compliance' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-iso37301-26', 'doc-internal-compliance-insider-88'].includes(doc.docId)), true);
});

test('retrieval surfaces transformation delivery references for local exception governance wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'The target-state rollout is slipping because local exceptions, site-access constraints, and weak exception governance block delivery.',
    scenarioLens: { key: 'transformation-delivery' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-transformation-delivery-71'].includes(doc.docId)), true);
});

test('retrieval surfaces enterprise-risk governance references for appetite and KRI escalation wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'KRIs move above tolerance but escalation to the risk committee does not happen while residual risk remains outside appetite.',
    scenarioLens: { key: 'general' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-internal-erm-framework-90', 'doc-internal-erm-policy-91'].includes(doc.docId)), true);
});

test('retrieval surfaces project-risk register references for stale register and treatment-plan wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'The project risk register is stale, treatment plans are overdue, and emerging risks are not being aggregated for reporting.',
    scenarioLens: { key: 'general' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-internal-erm-project-92', 'doc-internal-erm-policy-91'].includes(doc.docId)), true);
});

test('retrieval surfaces internal continuity references for BIA, RTO, and call-tree weakness wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'The business impact analysis is stale, RTOs are not defined, and the incident escalation call tree has not been exercised.',
    scenarioLens: { key: 'business-continuity' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-internal-bcm-93', 'doc-iso22317-76', 'doc-iso22320-77'].includes(doc.docId)), true);
});

test('retrieval surfaces internal HSE references for permit-to-work and emergency-drill weakness wording', async () => {
  const service = initService();
  const results = await service.retrieveRelevantDocs('g42', {
    text: 'Permit-to-work controls are bypassed, emergency drills are overdue, and contractor safety corrective actions remain open.',
    scenarioLens: { key: 'hse' }
  }, 4);

  assert.equal(results.some((doc) => ['doc-internal-hse-94', 'doc-internal-qhse-95', 'doc-iso45001-30'].includes(doc.docId)), true);
});
