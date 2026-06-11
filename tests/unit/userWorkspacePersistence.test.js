'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applySavedAssessmentsDeltaPatch,
  buildDraftWorkspaceSection,
  buildSavedAssessmentsDeltaPatch,
  buildSavedAssessmentsSection,
  mergeUserWorkspacePatchSlices,
  normaliseUserWorkspaceState,
  serializeUserWorkspaceState
} = require('../../assets/state/userWorkspacePersistence.js');

test('normaliseUserWorkspaceState migrates legacy draft and assessments into bounded sections', () => {
  const state = normaliseUserWorkspaceState({
    userSettings: { geography: 'UAE' },
    draft: { id: 'draft-1', scenarioTitle: 'Draft one' },
    assessments: [{ id: 'a-1', scenarioTitle: 'Assessment one' }]
  });

  assert.equal(state.draftWorkspace.draft.id, 'draft-1');
  assert.equal(state.savedAssessments.index[0].id, 'a-1');
  assert.equal(state.assessments[0].scenarioTitle, 'Assessment one');
  assert.deepEqual(state.learningStore.caseMemories, []);
  assert.deepEqual(state.learningStore.aiFeedback, { events: [], structuredEvents: [] });
});

test('serializeUserWorkspaceState keeps the canonical bounded sections without duplicating legacy fields', () => {
  const serialized = serializeUserWorkspaceState({
    userSettings: { geography: 'UAE' },
    draftWorkspace: buildDraftWorkspaceSection({ id: 'draft-2', scenarioTitle: 'Draft two' }),
    savedAssessments: buildSavedAssessmentsSection([{ id: 'a-2', scenarioTitle: 'Assessment two' }]),
    _meta: { revision: 3, updatedAt: 55 }
  });

  assert.equal(Boolean(serialized.draftWorkspace), true);
  assert.equal(Boolean(serialized.savedAssessments), true);
  assert.equal(Object.prototype.hasOwnProperty.call(serialized, 'draft'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(serialized, 'assessments'), false);
});

test('workspace persistence keeps the project assessment shape compatible across draft and saved records', () => {
  const serialized = serializeUserWorkspaceState({
    draftWorkspace: buildDraftWorkspaceSection({
      id: 'draft-project',
      assessmentType: 'project_buyer',
      projectContext: {
        projectName: '  Data platform migration ',
        projectRole: 'seller',
        currency: ' aed ',
        projectDurationMonths: '12'
      },
      buyerEconomics: {
        expectedSpend: '1000000',
        reprocurementPremiumPct: '1.5'
      },
      step4ValuationMode: 'hybrid',
      projectExposure: {
        valuationMode: 'project_linked',
        financialDrivers: ['  budget overrun ']
      },
      parameterCoach: {
        suggestedChangesCount: 1,
        parameterRationales: [{
          parameterKey: 'businessInterruption',
          suggestionType: 'project_derived_range'
        }]
      },
      evidenceMap: {
        projectFinancialEvidenceMap: [{
          field: 'approvedBudget',
          status: 'found',
          value: 'USD 1,000,000'
        }],
        citationQuality: {
          strong: ['Business case']
        }
      }
    }),
    savedAssessments: buildSavedAssessmentsSection([{
      id: 'saved-project',
      assessmentType: 'project_seller',
      scenarioTitle: 'Seller delivery risk',
      aiAuditStory: {
        classification: 'Project seller assessment',
        fallbackUsed: true,
        proxyValuesUsed: [{ text: 'LD benchmark proxy' }],
        unknownsCarriedForward: [{ text: 'Gross margin percentage' }]
      },
      projectContext: {
        projectName: ' Managed services renewal ',
        projectRole: 'buyer'
      },
      sellerEconomics: {
        contractValue: '250000',
        grossMarginPct: '-0.2'
      }
    }])
  });

  const draft = serialized.draftWorkspace.draft;
  const saved = serialized.savedAssessments.itemsById['saved-project'];
  assert.equal(draft.assessmentType, 'project_buyer');
  assert.equal(draft.projectContext.projectName, 'Data platform migration');
  assert.equal(draft.projectContext.projectRole, 'buyer');
  assert.equal(draft.projectContext.currency, 'AED');
  assert.equal(draft.projectContext.projectDurationMonths, 12);
  assert.equal(draft.buyerEconomics.expectedSpend, 1000000);
  assert.equal(draft.buyerEconomics.reprocurementPremiumPct, 1);
  assert.equal(draft.step4ValuationMode, 'hybrid');
  assert.equal(draft.projectExposure.valuationMode, 'project_linked');
  assert.deepEqual(draft.projectExposure.financialDrivers, ['budget overrun']);
  assert.equal(draft.parameterCoach.suggestedChangesCount, 1);
  assert.equal(draft.parameterCoach.parameterRationales[0].parameterKey, 'businessInterruption');
  assert.equal(draft.evidenceMap.projectFinancialEvidenceMap[0].field, 'approvedBudget');
  assert.equal(draft.evidenceMap.projectFinancialEvidenceMap[0].status, 'found');
  assert.equal(draft.evidenceMap.citationQuality.strong[0], 'Business case');

  assert.equal(saved.assessmentType, 'project_seller');
  assert.equal(saved.projectContext.projectName, 'Managed services renewal');
  assert.equal(saved.projectContext.projectRole, 'seller');
  assert.equal(saved.sellerEconomics.contractValue, 250000);
  assert.equal(saved.sellerEconomics.grossMarginPct, 0);
  assert.equal(saved.aiAuditStory.classification, 'Project seller assessment');
  assert.equal(saved.aiAuditStory.fallbackUsed, true);
  assert.equal(saved.aiAuditStory.proxyValuesUsed[0].text, 'LD benchmark proxy');
  assert.equal(saved.aiAuditStory.unknownsCarriedForward[0].text, 'Gross margin percentage');
});

test('saved assessment delta patches preserve unrelated records while carrying upserts and removals', () => {
  const previous = buildSavedAssessmentsSection([
    { id: 'a-1', scenarioTitle: 'Assessment one', createdAt: 1 },
    { id: 'a-2', scenarioTitle: 'Assessment two', createdAt: 2 }
  ]);
  const next = buildSavedAssessmentsSection([
    { id: 'a-1', scenarioTitle: 'Assessment one revised', createdAt: 1 },
    { id: 'a-3', scenarioTitle: 'Assessment three', createdAt: 3 }
  ]);

  const delta = buildSavedAssessmentsDeltaPatch(next, previous);
  assert.deepEqual(delta.removedIds, ['a-2']);
  assert.equal(delta.upsertsById['a-1'].scenarioTitle, 'Assessment one revised');
  assert.equal(delta.upsertsById['a-3'].scenarioTitle, 'Assessment three');

  const applied = applySavedAssessmentsDeltaPatch(previous, delta);
  assert.deepEqual(
    applied.index.map(entry => entry.id).sort(),
    ['a-1', 'a-3']
  );
  assert.equal(applied.itemsById['a-1'].scenarioTitle, 'Assessment one revised');
  assert.equal(Boolean(applied.itemsById['a-2']), false);
  assert.equal(applied.itemsById['a-3'].scenarioTitle, 'Assessment three');
});

test('workspace patch merging keeps per-assessment saved-state deltas instead of replacing the full slice', () => {
  const merged = mergeUserWorkspacePatchSlices(
    {
      savedAssessments: {
        upsertsById: {
          'a-1': { id: 'a-1', scenarioTitle: 'Assessment one' }
        },
        removedIds: []
      }
    },
    {
      savedAssessments: {
        upsertsById: {
          'a-2': { id: 'a-2', scenarioTitle: 'Assessment two' }
        },
        removedIds: []
      }
    }
  );

  assert.equal(merged.savedAssessments.upsertsById['a-1'].scenarioTitle, 'Assessment one');
  assert.equal(merged.savedAssessments.upsertsById['a-2'].scenarioTitle, 'Assessment two');
  assert.deepEqual(merged.savedAssessments.removedIds, []);
});
