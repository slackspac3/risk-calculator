'use strict';

const SPARSE_BUYER_USER = Object.freeze({
  username: 'sparse.project.buyer',
  displayName: 'Sparse Buyer Tester',
  role: 'user',
  businessUnitEntityId: '',
  departmentEntityId: ''
});

const SPARSE_BUYER_USER_SETTINGS = Object.freeze({
  userProfile: {
    fullName: 'Sparse Buyer Tester',
    jobTitle: 'Risk Manager',
    businessUnit: 'G42',
    department: 'Risk',
    focusAreas: ['Project risk'],
    preferredOutputs: 'Decision summaries',
    workingContext: 'Validate sparse project economics without false precision.'
  },
  onboardedAt: '2026-06-12T00:00:00.000Z',
  _overrideKeys: []
});

const DEFAULT_E2E_ADMIN_SETTINGS = Object.freeze({
  geography: 'United Arab Emirates',
  applicableRegulations: ['UAE PDPL'],
  entityContextLayers: [],
  companyStructure: [],
  aiInstructions: 'Use British English.',
  benchmarkStrategy: 'Prefer GCC and UAE benchmark references.',
  typicalDepartments: ['Risk'],
  _meta: { revision: 1, updatedAt: Date.now() }
});

function buildSparseBuyerExposureResponse() {
  return {
    mode: 'live',
    usedFallback: false,
    aiUnavailable: false,
    generatedAt: '2026-06-12T08:00:00.000Z',
    trace: { traceLabel: 'Buyer project exposure map' },
    projectExposure: {
      valuationMode: 'hybrid',
      projectExposureSummary: 'Buyer project exposure maps delay and supplier replacement as relevant, but the delay cost and reprocurement premium remain unknown.',
      projectInputQuality: {
        score: 36,
        label: 'Thin project economics',
        knownHighImpactInputs: ['Approved budget'],
        estimatedHighImpactInputs: [],
        unknownHighImpactInputs: ['Delay cost per day', 'Reprocurement premium %', 'Contractual recovery cap'],
        canProceed: true,
        recommendedNextInput: {
          field: 'delayCostPerDay',
          why: 'Delay cost is needed before the delay exposure can be quantified.',
          whoMightKnow: 'Project controls or finance business partner',
          suggestedQuestion: 'What is the approximate business cost per day if the supplier misses the go-live date?'
        }
      },
      financialDrivers: [
        {
          id: 'buyer-delay-cost',
          label: 'Delay cost',
          driverType: 'delay',
          driverStatus: 'unquantified_driver',
          formula: '',
          low: null,
          likely: null,
          high: null,
          mapsTo: 'businessInterruption',
          confidence: 'low',
          source: 'unknown',
          missingInputs: ['delayCostPerDay'],
          rationale: 'Delay appears relevant from the proxy answers, but the daily delay cost is unknown and is not treated as zero.'
        },
        {
          id: 'buyer-reprocurement-premium',
          label: 'Supplier replacement premium',
          driverType: 'reprocurement',
          driverStatus: 'unquantified_driver',
          formula: '',
          low: null,
          likely: null,
          high: null,
          mapsTo: 'thirdParty',
          confidence: 'low',
          source: 'unknown',
          missingInputs: ['remainingSpend', 'reprocurementPremiumPct'],
          rationale: 'Replacement is hard, but remaining spend and premium percentage are still unknown.'
        }
      ],
      capsAndOffsets: [],
      doubleCountingWarnings: [
        'Do not treat total project spend as automatic loss.',
        'Do not treat unknown recovery as zero recovery.'
      ],
      missingInputs: [
        {
          field: 'delayCostPerDay',
          label: 'Delay cost per day',
          importance: 'high',
          whyItMatters: 'This controls whether delay is a minor inconvenience or a material project exposure.',
          whoMightKnow: 'Project controls or finance business partner',
          suggestedQuestion: 'What is the approximate business cost per day if the supplier misses the go-live date?',
          mapsTo: 'businessInterruption'
        },
        {
          field: 'reprocurementPremiumPct',
          label: 'Reprocurement premium %',
          importance: 'high',
          whyItMatters: 'This is needed before supplier replacement can be quantified without using total project spend as loss.',
          whoMightKnow: 'Procurement or commercial owner',
          suggestedQuestion: 'If this supplier had to be replaced, what premium would a replacement likely charge?',
          mapsTo: 'thirdParty'
        }
      ],
      mapsToRiskParameters: {
        businessInterruption: ['buyer-delay-cost'],
        thirdParty: ['buyer-reprocurement-premium']
      }
    }
  };
}

module.exports = {
  DEFAULT_E2E_ADMIN_SETTINGS,
  SPARSE_BUYER_USER,
  SPARSE_BUYER_USER_SETTINGS,
  buildSparseBuyerExposureResponse
};
