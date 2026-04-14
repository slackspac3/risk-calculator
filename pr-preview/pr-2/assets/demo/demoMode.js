'use strict';

const DemoMode = (() => {
  const DEMO_SCENARIO = {
    id: 'demo-identity-compromise',
    title: 'Privileged identity compromise across shared platforms',
    event: 'A privileged identity is compromised through a targeted credential theft campaign, giving an attacker administrative access to the shared identity platform used across business-critical services.',
    asset: 'Shared identity platform, cloud administration consoles, executive mailboxes, and regulated customer-facing services',
    cause: 'Credential theft via targeted spear-phishing, followed by session hijack and lateral movement through federated identity services',
    impact: 'Administrative misuse, business email compromise, fraud risk, service disruption, and regulatory exposure across connected platforms',
    urgency: 'critical',
    geographies: ['United Arab Emirates'],
    risks: [
      {
        title: 'Privileged account takeover via identity platform compromise',
        category: 'Identity & Access',
        source: 'demo',
        description: 'A compromised identity platform gives an attacker privileged access across all federated services, including cloud consoles, executive mailboxes, and regulated platforms.'
      },
      {
        title: 'Business email compromise and payment fraud',
        category: 'Financial Crime',
        source: 'demo',
        description: 'Mailbox access enables executive impersonation, manipulation of payment approvals, and supplier fraud with direct financial loss.'
      },
      {
        title: 'Regulatory and data exposure across connected services',
        category: 'Data Protection',
        source: 'demo',
        description: 'The same compromise exposes regulated data stored in identity-linked applications, triggering notification obligations and regulatory scrutiny.'
      }
    ]
  };

  const DEMO_FALLBACK_RESULT = {
    scenarioTitle: 'Privileged Identity Compromise — Critical Scenario',
    structuredScenario: {
      assetService: 'Shared identity platform and federated business services',
      primaryDriver: 'Targeted threat actors — credential theft and account takeover specialists',
      eventPath: 'Spear-phishing leading to credential theft, session hijack, and federated identity abuse',
      effect: 'Administrative access to shared platforms enabling fraud, data exposure, service disruption, and regulatory consequence across connected services'
    },
    confidenceLabel: 'Moderate confidence',
    evidenceQuality: 'Useful but incomplete evidence base',
    evidenceSummary: 'Evidence used: scenario narrative, BU context, UAE regulatory baseline, and identity-compromise benchmark patterns.',
    workflowGuidance: [
      'Confirm that phishing-resistant MFA is enforced on all privileged identities before any other action.',
      'Run a privileged account review to identify standing admin access that should be converted to just-in-time.',
      'Validate the business email compromise path — specifically whether supplier payment workflows have out-of-band verification.'
    ],
    inputRationale: {
      tef: 'Identity compromise events of this type occur roughly 1–4 times per year at organisations with equivalent footprint and control maturity. The likely case reflects current GCC threat actor activity patterns against enterprise identity platforms.',
      vulnerability: 'Attacker capability is assessed as high given the targeted nature of the scenario. Control strength is moderate — phishing-resistant MFA and conditional access reduce but do not eliminate the attack path.',
      lossComponents: 'Business interruption and incident response dominate because identity platform recovery requires coordinated credential resets, service verification, and forensic review across all federated systems. Regulatory and legal cost reflects UAE PDPL notification obligations.'
    },
    suggestedInputs: {
      TEF: { min: 1, likely: 2.5, max: 6 },
      controlStrength: { min: 0.45, likely: 0.62, max: 0.80 },
      threatCapability: { min: 0.55, likely: 0.72, max: 0.88 },
      lossComponents: {
        incidentResponse: { min: 120000, likely: 380000, max: 1200000 },
        businessInterruption: { min: 200000, likely: 750000, max: 3500000 },
        dataBreachRemediation: { min: 80000, likely: 240000, max: 800000 },
        regulatoryLegal: { min: 50000, likely: 180000, max: 950000 },
        thirdPartyLiability: { min: 30000, likely: 120000, max: 500000 },
        reputationContract: { min: 100000, likely: 320000, max: 1500000 }
      }
    },
    recommendations: [
      {
        title: 'Phishing-resistant MFA on all privileged identities',
        why: 'This directly closes the primary attack path. Credential theft cannot escalate to privileged access if MFA tokens cannot be replayed or hijacked.',
        impact: 'Estimated 70–80% reduction in successful privileged account takeover from this attack vector.'
      },
      {
        title: 'Just-in-time privileged access management',
        why: 'Standing admin access is the primary blast-radius amplifier. JIT access limits what an attacker can reach even after initial compromise.',
        impact: 'Materially reduces the scope of systems reachable from a single compromised identity.'
      },
      {
        title: 'Out-of-band payment verification controls',
        why: 'Mailbox access is the direct path to BEC fraud. A separate verification channel for payment approvals breaks the fraud chain.',
        impact: 'Cuts the primary financial loss path in BEC scenarios and is implementable without capital expenditure.'
      }
    ],
    missingInformation: [
      'Internal control evidence for the privileged identity tier has not been validated against the current platform configuration.',
      'Geographic scope of federated services has not been confirmed — cross-border data exposure may be wider than assumed.'
    ],
    inferredAssumptions: [
      'Attacker capability was inferred from the targeted spear-phishing scenario and current GCC threat actor patterns.',
      'Regulatory cost was estimated from UAE PDPL notification obligations assuming regulated data in connected services.'
    ],
    benchmarkBasis: 'Identity compromise frequency and loss ranges are anchored to GCC enterprise patterns where available, with fallback to FAIR-aligned global benchmarks for loss components not covered by regional data.',
    usedFallback: false,
    citations: []
  };

  let _demoRunning = false;
  let _demoStatus = '';

  function isDemoRunning() { return _demoRunning; }

  function _setStatus(message) {
    _demoStatus = message;
    const el = document.getElementById('demo-status-line');
    if (el) el.textContent = message;
    console.info('[Demo]', message);
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runDemo() {
    if (_demoRunning) return;
    _demoRunning = true;
    try {
      _setStatus('Loading scenario...');
      if (typeof resetDraft === 'function') resetDraft();
      if (typeof applyDryRunScenario === 'function') {
        applyDryRunScenario(DEMO_SCENARIO);
      } else if (typeof AppState !== 'undefined') {
        const settings = typeof getEffectiveSettings === 'function'
          ? getEffectiveSettings() : {};
        void settings;
        AppState.draft.guidedInput = {
          event: DEMO_SCENARIO.event,
          asset: DEMO_SCENARIO.asset,
          cause: DEMO_SCENARIO.cause,
          impact: DEMO_SCENARIO.impact,
          urgency: DEMO_SCENARIO.urgency
        };
        AppState.draft.narrative = DEMO_SCENARIO.event;
        AppState.draft.sourceNarrative = DEMO_SCENARIO.event;
        AppState.draft.riskCandidates = DEMO_SCENARIO.risks.map(
          (r, i) => ({ ...r, id: `demo-risk-${i + 1}` })
        );
        AppState.draft.selectedRiskIds =
          AppState.draft.riskCandidates.map(r => r.id);
        AppState.draft.selectedRisks =
          AppState.draft.riskCandidates.slice();
        AppState.draft.geographies = DEMO_SCENARIO.geographies;
        AppState.draft.geography = DEMO_SCENARIO.geographies.join(', ');
        AppState.draft.scenarioTitle = DEMO_SCENARIO.title;
        AppState.draft.loadedDryRunId = DEMO_SCENARIO.id;
        if (typeof saveDraft === 'function') saveDraft();
      }

      await _sleep(800);

      _setStatus('Analysing scenario with AI...');
      if (typeof Router !== 'undefined') Router.navigate('/wizard/2');
      await _sleep(1200);

      let aiResult = null;
      try {
        const bu = typeof getBUList === 'function'
          ? getBUList().find(b => b.id === AppState.draft.buId)
          : null;
        const aiContext = typeof buildCurrentAIAssistContext === 'function'
          ? buildCurrentAIAssistContext({ buId: AppState.draft.buId })
          : { businessUnit: bu, adminSettings: {} };
        const citations = typeof RAGService !== 'undefined' && typeof RAGService.retrieveRelevantDocs === 'function'
          ? await RAGService.retrieveRelevantDocs(
              AppState.draft.buId,
              DEMO_SCENARIO.event,
              5
            )
          : [];
        const benchmarkCandidates = typeof BenchmarkService !== 'undefined' && typeof BenchmarkService.retrieveRelevantBenchmarks === 'function'
          ? BenchmarkService.retrieveRelevantBenchmarks({
              query: DEMO_SCENARIO.event,
              geography: DEMO_SCENARIO.geographies[0],
              businessUnit: aiContext.businessUnit || bu,
              topK: 3
            })
          : [];
        aiResult = await LLMService.generateScenarioAndInputs(
          [
            DEMO_SCENARIO.event,
            DEMO_SCENARIO.cause,
            DEMO_SCENARIO.impact
          ].join('. '),
          {
            ...(aiContext.businessUnit || bu || {}),
            regulatoryTags: ['UAE PDPL', 'UAE Information Assurance Standard', 'UAE National Cyber Security Governance Framework', 'ISO 27001'],
            geography: DEMO_SCENARIO.geographies[0],
            benchmarkStrategy: aiContext.adminSettings?.benchmarkStrategy || '',
            companyContextProfile: aiContext.adminSettings?.companyContextProfile || '',
            companyStructureContext: aiContext.adminSettings?.companyStructureContext || '',
            userProfileSummary: aiContext.adminSettings?.userProfileSummary || ''
          },
          citations,
          benchmarkCandidates
        );
      } catch (aiError) {
        console.warn('[Demo] Live AI failed, using pre-baked result:', aiError?.message || aiError);
        _setStatus('AI took longer than expected — loading prepared result...');
        await _sleep(1000);
        aiResult = DEMO_FALLBACK_RESULT;
      }

      if (aiResult && typeof AppState !== 'undefined') {
        AppState.draft.scenarioTitle = aiResult.scenarioTitle || DEMO_SCENARIO.title;
        AppState.draft.structuredScenario = normaliseStructuredScenario(aiResult.structuredScenario, { preserveUnknown: true });
        AppState.draft.enhancedNarrative = AppState.draft.narrative;
        AppState.draft.llmAssisted = true;
        AppState.draft.confidenceLabel = aiResult.confidenceLabel || '';
        AppState.draft.evidenceQuality = aiResult.evidenceQuality || '';
        AppState.draft.evidenceSummary = aiResult.evidenceSummary || '';
        AppState.draft.workflowGuidance = aiResult.workflowGuidance || [];
        AppState.draft.benchmarkBasis = aiResult.benchmarkBasis || '';
        AppState.draft.inputRationale = aiResult.inputRationale || {};
        AppState.draft.recommendations = aiResult.recommendations || [];
        AppState.draft.missingInformation = aiResult.missingInformation || [];
        AppState.draft.inferredAssumptions = aiResult.inferredAssumptions || [];
        AppState.draft.citations = aiResult.citations || [];
        if (aiResult.suggestedInputs && typeof _buildAiFairInputPayload === 'function') {
          const payload = _buildAiFairInputPayload(aiResult, [], []);
          AppState.draft.fairParams = payload.fairParams;
          AppState.draft.inputAssignments = payload.inputAssignments;
          AppState.draft.fairParamOrigins = payload.keyOrigins;
        } else if (aiResult.suggestedInputs?.TEF) {
          const s = aiResult.suggestedInputs;
          const lc = s.lossComponents || {};
          AppState.draft.fairParams = {
            ...(AppState.draft.fairParams || {}),
            tefMin: s.TEF.min, tefLikely: s.TEF.likely, tefMax: s.TEF.max,
            controlStrMin: s.controlStrength.min,
            controlStrLikely: s.controlStrength.likely,
            controlStrMax: s.controlStrength.max,
            threatCapMin: s.threatCapability.min,
            threatCapLikely: s.threatCapability.likely,
            threatCapMax: s.threatCapability.max,
            irMin: lc.incidentResponse?.min, irLikely: lc.incidentResponse?.likely,
            irMax: lc.incidentResponse?.max,
            biMin: lc.businessInterruption?.min,
            biLikely: lc.businessInterruption?.likely,
            biMax: lc.businessInterruption?.max,
            dbMin: lc.dataBreachRemediation?.min,
            dbLikely: lc.dataBreachRemediation?.likely,
            dbMax: lc.dataBreachRemediation?.max,
            rlMin: lc.regulatoryLegal?.min,
            rlLikely: lc.regulatoryLegal?.likely,
            rlMax: lc.regulatoryLegal?.max,
            tpMin: lc.thirdPartyLiability?.min,
            tpLikely: lc.thirdPartyLiability?.likely,
            tpMax: lc.thirdPartyLiability?.max,
            rcMin: lc.reputationContract?.min,
            rcLikely: lc.reputationContract?.likely,
            rcMax: lc.reputationContract?.max
          };
        }
        if (typeof saveDraft === 'function') saveDraft();
      }

      await _sleep(600);

      _setStatus('Preparing simulation...');
      if (typeof Router !== 'undefined') Router.navigate('/wizard/3');
      await _sleep(1400);

      if (typeof Router !== 'undefined') Router.navigate('/wizard/4');
      await _sleep(800);

      _setStatus('Running Monte Carlo simulation...');
      if (typeof runSimulation === 'function') {
        await runSimulation();
      } else {
        const runButton = document.getElementById('btn-run-simulation')
          || document.getElementById('btn-run-sim')
          || document.querySelector('[data-action="run-simulation"]');
        if (runButton && !runButton.disabled) runButton.click();
        await _sleep(3000);
      }

      _setStatus('Opening results...');
      await _sleep(600);
      const currentRoute = typeof window !== 'undefined'
        ? String(window.location.hash || '').replace(/^#/, '')
        : '';
      const currentResultsId = typeof AppState !== 'undefined'
        ? String(AppState.currentResultsId || '').trim()
        : '';
      if (typeof Router !== 'undefined' && !/^\/results\/[^/]+/.test(currentRoute) && currentResultsId) {
        Router.navigate('/results/' + currentResultsId);
      }
      await _sleep(800);

      const execTab = document.querySelector('[data-results-tab="executive"]')
        || document.querySelector('[data-tab="executive"]');
      if (execTab) execTab.click();

      _setStatus('Demo complete.');
    } catch (err) {
      console.error('[Demo] Demo path failed:', err);
      _setStatus('Demo encountered an error — navigating to dashboard.');
      await _sleep(1200);
      if (typeof Router !== 'undefined') Router.navigate('/dashboard');
    } finally {
      _demoRunning = false;
    }
  }

  return { runDemo, isDemoRunning };
})();
