# Session Handoff

Use this file to avoid re-discovering repo context every session. Read it after `AGENTS.md`, then verify anything time-sensitive against the live repo state before changing code.

If this file conflicts with the code, git history, or GitHub workflow files, trust the live source of truth and update this document in the same change.

## Last Updated

- Date: 2026-06-22
- Updated by: Codex session in local repo `/Users/bhavuk.arora/risk-calculator`

## Read First

1. `AGENTS.md`
2. `SESSION_HANDOFF.md`
3. `PREVIEW_PROMOTION_FLOW.md`
4. `RELEASE_CHECKLIST.md`

## Branch And Deploy Invariants

- `test-poc` is retained as a validation branch name, but it is no longer a public preview deployment target.
- `master` is the live branch.
- `.github/workflows/test-poc.yml` validates `test-poc` with the app-integrity gate only.
- `.github/workflows/pages.yml` publishes `master` to `https://slackspac3.github.io/risk-calculator/` and replaces `/test/` with a noindex retired-preview placeholder so old public test assets are removed.
- Normal rule: changes are validated with local managed QA and any required protected preview before promotion to `master`; do not use `/test/` as release evidence.
- Do not test unfinished work on the live root URL.
- Do not use `gh-pages` as a working branch. It is publish output only.

## Current Git Snapshot

- Active working copy for the latest pass is `/Users/bhavuk.arora/risk-calculator`; the older `/Users/bhavuk.arora/Documents/GitHub/risk-calculator` worktree became macOS/TCC-blocked for existing-file reads during the session.
- `master` local started from `origin/master` at `21ba51c` before the 2026-05-14 results-cockpit changes.
- `test-poc` local == `origin/test-poc` at `802580f`
- `master` and `test-poc` are both in sync with their own upstream branches.
- `master` and `test-poc` are not currently a fast-forward pair.
- Merge base between `master` and `test-poc`: `d3ab3df` (`Switch Pages to fixed test PoC flow`)

### Commits On `test-poc` But Not On `master`

- `802580f` Add public landing and trust pages
- `c19dede` Publish Google verification files in test PoC
- `3e50482` Publish Google site verification file
- `c26caeb` Align smoke checks with fixed test PoC workflows
- `8cce5a6` Harden audit log route against malformed entries

### Commits On `master` But Not On `test-poc`

- `2bbd38b` Publish Google verification files in test PoC
- `dab27a7` Publish Google site verification file
- `c900559` Align smoke checks with fixed test PoC workflows

## Important Promotion Note

- Some `master` and `test-poc` commits have the same intent but different SHAs.
- That means promotion is not currently a simple "assume test branch fast-forwards master" workflow.
- Before promotion, compare `master..test-poc` and `test-poc..master` explicitly and choose the safe path: merge, cherry-pick, or a clean re-branch, depending on the change set.
- Do not force-push or rewrite shared branch history unless explicitly approved.

## Verified Baseline Through 2026-04-25

Latest active-context update on 2026-06-22 in `/Users/bhavuk.arora/risk-calculator`:

- Follow-up AI-first hardening was completed locally after `c2550a1`:
  - Basic Step 2 still uses two plain-language prompts, one build action, and a draft preview; build/continue readiness now requires business context plus event/impact text and a real built/staged draft.
  - Basic Step 2 continues to treat explicit unknown answers as tracked gaps, keeps local previews marked as local, and does not show the old dense live-memory sidecar.
  - AI routes now favor structured JSON outputs: `callAi` forwards JSON response format by default, `/api/compass` accepts only allowlisted client controls, fallback outputs are not completed-cached by workflow reuse, and company-context builds return transparent public-source fallback metadata instead of opaque failures.
  - Security-sensitive seams were tightened: session signing now requires a distinct `SESSION_SIGNING_SECRET`, browser audit events are forced to client provenance, org-intelligence assessment/decision writes require admin access, and evidence RAG re-indexing deletes stale chunks before upsert.
  - Results/export trust signals now let critical gates override stale green decision-brief posture in the cockpit, PDF, and PPTX exports.
  - Guardrails now include a blocking PR app-integrity job, validation-only `test-poc` workflow permissions/concurrency, and smoke checks for the release-bootstrap asset stamp triad.
  - Asset stamp is now `20260622v2`; build stamp is `2026-06-22-ai-first-security-structured-outputs`.
  - Validation passed:
    - `node --test tests/unit/apiSecurityHandlers.test.js tests/unit/apiAuth.test.js tests/unit/orgIntelligenceApi.test.js tests/unit/workflowReuse.test.js tests/unit/aiOrchestrator.test.js tests/unit/companyContextNews.test.js tests/unit/llmLiveFallbackMinimisation.test.js tests/unit/exportService.test.js tests/unit/resultsViewModelDecisionBrief.test.js tests/unit/intakeConversationModel.test.js tests/unit/step1AssistGuidedDraftFallback.test.js tests/unit/evidenceRag.test.js` (`61` tests)
    - `npm run test:unit` (`783` tests)
    - `npm run check:syntax`
    - `npm run check:smoke`
    - `npm run check:staleness`
    - `npm run test:e2e -- tests/e2e/smoke.spec.js` (`51` tests)
    - `git diff --check`

Latest active-context update on 2026-06-19 in `/Users/bhavuk.arora/risk-calculator`:

- Security hardening pass:
  - escaped retained organisation, entity, BU, and onboarding values before rendering them into known HTML attributes/options/summary markup
  - added frontend security guardrail tests for stored-content rendering and browser admin-secret regressions
  - removed frontend browser admin-secret fallback usage; admin account/settings actions now use the signed-in session path from the browser
  - changed the master Pages publish to retire the stale public `/test/` app surface with a noindex placeholder, and changed the default `test-poc` workflow source to validation-only
  - updated release/promotion docs so `/test/` is not treated as validation evidence
  - validation passed:
    - `npm run check:syntax`
    - `npm run check:smoke`
    - `npm run check:staleness`
    - `node --test tests/unit/frontendSecurityGuardrails.test.js`
    - `node --test tests/unit/authService.test.js`
    - `npm run test:unit` (`759` tests)
    - `npm run test:e2e -- tests/e2e/smoke.spec.js` (`51` tests)
    - `npm run qa:app` (`56` Playwright tests inside the gate)
    - `git diff --check`

- AI grounding corpus now includes ten additional seed references for ADHICS/UAE healthcare operations, health-data localisation and transfers, diagnostics/genomics secondary use, Diaverum-style clinical continuity, UAE financial-services operational resilience, project buyer/seller economics, geopolitical market access/export controls, and digital-health AI assurance.
- ADHICS and UAE health-data-law seed excerpts were validated against local official PDFs in `/Users/bhavuk.arora/Downloads/` (`ADHICS-v2-standard.pdf` and `Federal Law No. (2) of 2019, Concerning the Use of the Information and Communications Technology in Health Fields.pdf`). The PDFs were not committed; full-text grounding should use the existing server evidence upload/indexing path. Public official `sourceUrl` values were added only for CBUAE operational risk, BIS EAR, and FDA medical-device AI anchors.
- `assets/services/ragService.js` has focused keyword routing for those additions. Existing master eval retrieval hit rate over rows with `expected_doc_ids` was spot-checked at `71/75` rows with at least one expected top-4 hit after the update.
- Admin company-context website builds now use the shared LLM response extractor, so JSON returned through OpenAI-compatible `function_call.arguments` / `tool_calls[].function.arguments` is parsed before falling back.
- Follow-up hardening keeps parser diagnostics out of the user-facing company summary: common AI aliases such as `summary` are accepted, unusable AI output now yields a company-specific public-source fallback summary, and fallback state is carried through `usedFallback` / `responseMessage` for admin review copy.
- Company/entity context website builds now tolerate JavaScript-rendered landing pages with little server-rendered body text, using title/meta text as the public-source extract instead of failing with the generic 502. This covers sites such as SpiderSilk where the raw HTML mainly says JavaScript must be enabled.
- Validation passed:
  - `npm run check:syntax`
  - `npm run check:smoke`
  - `npm run test:unit` (`753` tests)
  - `npm run test:eval:fixture`
  - `node --test tests/unit/ragServiceRetrieval.test.js` (`27` tests)
  - `git diff --check`
- After the ADHICS/health-data-law PDF source-confirmation patch, focused validation passed:
  - `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('data/docs.json','utf8')); console.log('docs.json ok')"`
  - `npm run check:syntax`
  - `node --test tests/unit/ragServiceRetrieval.test.js` (`27` tests)
  - `npm run test:eval:fixture`
  - `git diff --check`
- After the admin company-context structured-response patch, validation passed:
  - `node --test tests/unit/companyContextNews.test.js` (`4` tests)
  - `npm run check:syntax`
  - `npm run test:unit` (`754` tests)
- After the company-context fallback-summary hardening, validation passed:
  - `node --test tests/unit/companyContextNews.test.js` (`5` tests)
  - `npm run check:syntax`
  - `npm run test:unit` (`755` tests)
  - `git diff --check`
- After the metadata-only website fallback for company/entity context builds, validation passed:
  - `node --test tests/unit/companyContextNews.test.js` (`6` tests)
  - `npm run check:syntax`
  - `npm run test:unit` (`756` tests)
  - `git diff --check`

- Maintenance backlog pass completed on `master` after the Ponytail audit follow-up.
- Local Stitch artifacts are ignored via `.gitignore` entries for `output/` and `.stitch/`; `DESIGN.md` is now intentionally committed as the current design-system reference.
- Smoke e2e setup now reuses shared helpers; sparse project buyer assertions moved into `tests/e2e/helpers/sparseProjectAssertions.js`; sparse seller and stale project exposure e2e coverage were added.
- `api/ai/manual-intake-assist.js` now uses the shared `createAiJsonRouteHandler` route shell, while preserving request/response behavior.
- Shared AI workflow normalizer helpers now live in `api/_aiWorkflowSupport.js`; HTML escaping and rounded currency formatting have central UI helpers.
- Step 1 project exposure rendering moved to `assets/wizard/step1ProjectExposurePanel.js`; Step 5 AI panels moved to `assets/wizard/step4AiPanels.js`; asset loading and freshness tests were updated.
- Conservative UI cleanup only: duplicate CSS declarations removed, Basic mode no longer renders current-stage decorative ambient shell markup, and draft snapshot clone call sites now use the existing JSON-safe helper instead of inline JSON clones.
- After the initial maintenance/docs pushes, GitHub Pages validation failed because `scripts/staleness-check.js` still looked for the stale project-exposure refresh prompt in `assets/wizard/step1.js`; the guardrail now follows `assets/wizard/step1ProjectExposurePanel.js`.
- Role guides under `docs/` now cover assessment-type route selection, project buyer/seller sparse economics, and context follow-up prompts that produce no visible AI changes.
- Validation passed:
  - `npm run check:syntax`
  - `npm run check:staleness`
  - `npm run qa:app` (`56` Playwright tests inside the gate)
  - `npm run test:unit` (`747` tests)
  - `npm run test:e2e -- tests/e2e/smoke.spec.js` (`51` tests)
  - `npm run test:e2e -- tests/e2e/sparse-project-buyer.spec.js tests/e2e/sparse-project-seller.spec.js` (`3` tests)
  - focused unit checks for assessment state, Step 1 project exposure panel, and Step 4 AI freshness
  - `git diff --check`

Latest active-context update on 2026-06-17 in `/Users/bhavuk.arora/risk-calculator`:

- Stitch project `305203100423572651` is the active design source for the redesigned screens.
- Current implemented pass targets all named redesigned Stitch screens at the app-shell level: Platform Landing Page, PoC Access Login, Risk Dashboard, Journey Selection, Assessment Intake, Scenario Refinement, Estimation Workspace, Simulation Review, Assessment Report, and BU Context Management.
- Step 1 now keeps the assessment-type cards in the main hero with a selected-journey summary, preserving existing assessment-type bindings and navigation.
- Step 2 Basic keeps the existing two-prompt intake, required-context behavior, provenance, and AI build bindings while adopting the darker Stitch workbench treatment.
- The broader pass adds scoped page classes and a Stitch-derived dark workbench CSS layer for public/login, dashboard, Step 3, Step 4, Step 5, results, and admin BU/settings surfaces while preserving existing IDs, controls, route bindings, and role semantics.
- The exported AI Studio/Stitch React app at `/Users/bhavuk.arora/Downloads/risk-intelligence-dashboard` was used only as a visual reference; no React, Tailwind, Motion, or Gemini scaffold was imported. Its darker cyan/emerald cockpit treatment now informs the final CSS override layer across app shell, dashboard, wizard, results, settings, and admin surfaces.
- Asset stamp is now `20260617v8`; build stamp is `2026-06-17-admin-conflict-autosave-guard`.
- AI response extraction now accepts OpenAI-compatible structured `function_call.arguments` / `tool_calls[].function.arguments` envelopes, and entity-context refinement now requests JSON mode with a larger completion budget so live AI returns usable structured output instead of falling back when JSON is not in `message.content`.
- Persistence conflict handling now keeps only one `Latest version available` modal open at a time and pauses normal workspace/admin-settings autosave queueing while a `WRITE_CONFLICT` is unresolved, so duplicate autosave conflicts cannot stack or block the `Load Latest` action.
- Context follow-up copy now treats live-AI-unavailable unchanged results as unchanged, rather than saying AI updated fields when no visible field changed.
- Entity context follow-up refinement now shows an explicit AI update in the modal history, lists changed draft fields, and reminds the user that `Save Context` is still required.
- Validation after the full export-guided redesign passed:
  - `npm run check:syntax`
  - `npm run check:smoke`
  - `npm run check:staleness`
  - `git diff --check`
  - `npm run test:e2e:smoke` (`51` tests)
  - Playwright visual capture across landing, login, dashboard, Step 1 guide, Step 2 intake, Step 3, Step 4, Step 5, results, and admin home in `/tmp/stitch-full-redesign-screens`.
Latest active-context update on 2026-06-09 in `/Users/bhavuk.arora/risk-calculator`:

- Results now distinguish financial appetite status from critical control or incident-response gates.
- Hard-trigger scenarios such as potentially valid privileged credentials, active compromise, regulated data exposure, legal/compliance triggers, and safety-critical conditions should block `Decision-ready` even when Monte Carlo expected loss is below tolerance.
- The critical gate is implemented as presentation/readiness logic, not as a change to the Monte Carlo simulation values.
- Older saved results can receive a critical-gate overlay when opened, so stale `Challenge passed` replay objects do not hide unresolved hard triggers.
- New changes in this area should keep `ReportPresentation.detectCriticalCondition()`, `buildDecisionReadinessModel()`, results replay, lifecycle review routing, exports, and docs aligned.

Latest validation on 2026-05-15 in `/Users/bhavuk.arora/risk-calculator`:

- The full e2e smoke cascade was cleaned up: Playwright mocks for the users API now intercept query-string variants (`**/api/users**`) in `tests/e2e/smoke.spec.js` and `tests/e2e/critical-path.spec.js`, keeping `?view=self` refreshes local instead of letting the hosted API expire seeded sessions.
- The prior `40/51` smoke failure was an auth-mock issue, not 40 independent stale UI assertions; focused auth-heavy smoke checks passed after the route-pattern fix.
- Validation passed:
  - `npm run test:e2e:smoke` (`51` tests)
  - `npm run test:e2e -- tests/e2e/critical-path.spec.js` (`2` tests)

Latest validation on 2026-05-14 in `/Users/bhavuk.arora/risk-calculator`:

- Results executive surface now shows a compact top value strip before the tabs: estimated value created, estimated analyst time saved, and expected annual loss.
- Executive Summary now opens with a new decision cockpit that combines the management headline, breach likelihood, readiness, immediate management move, and the same value/time/exposure metrics.
- Results ordering now puts submit/review guidance and the `Read this result in 3 moves` command deck above deeper workflow replay, challenge, and technical panels.
- The `Explain this number` results metric drawer now uses a dark high-contrast surface with explicit copy colors so it remains readable inside the executive results page.
- A follow-up light-over-light audit used `/tmp/app_light_contrast_scan.js` across dashboard, wizard, results, settings, and admin routes; initial hits were active tabs/step dots, dashboard agent labels, Assessment Manager score text, plus static risky support-panel styles.
- Contrast hardening now covers active results tabs, active wizard step dots, dashboard featured-agent labels, Assessment Manager score text, notification hover rows, FAIR assumption panels, reviewer meeting-room context blocks, and meeting-room mediation output cards.
- Browser QA used a dummy saved result at `http://127.0.0.1:8080/?v=results-cockpit5#/results/qa-cockpit`; screenshot artifact: `.playwright-cli/page-2026-05-14T07-42-24-910Z.png`.
- Browser QA for the metric drawer used a seeded dummy result at `http://127.0.0.1:8080/?v=explainer-fix#/results/qa-cockpit` and verified readable computed colors for title, body, grid text, and panel copy.
- Light-over-light contrast hardening validation passed:
  - `node /tmp/app_light_contrast_scan.js` -> passed with no reported findings (`[]`)
  - `npm run check:syntax`
  - `npm run check:smoke`
  - `npm run test:unit` (`554` tests)
  - `git diff --check`
- Full e2e smoke was rerun after browser sandbox escalation and is not a useful signal for this CSS-only patch yet: `npm run test:e2e:smoke` launched Chromium successfully but failed `40/51` assertions against older route copy/selectors/seeded admin-user expectations.
- Metric drawer contrast fix validation passed:
  - `npm run check:syntax`
  - `npm run check:smoke`
  - `npm run test:unit` (`554` tests)
  - `git diff --check`
- Validation passed:
  - `npm run check:syntax`
  - `npm run check:smoke`
  - `npm run test:unit` (`554` tests)
  - `npm run test:e2e:smoke` (`51` tests)
- Note: `npm install` was run in the clean clone only to install the declared Playwright dependency for e2e validation; lockfile noise was reverted before handoff.

Executed in `/Users/bhavuk.arora/Documents/GitHub/risk-calculator` on `test-poc`:

- `npm run check:smoke` -> passed
- `npm run check:syntax` -> passed
- `npm run test:unit` -> passed (`551` tests)
- `git diff --check` -> passed after the latest local UI pass

Additional validation after the latest uncommitted UI changes on top of `test-poc`:

- `npm run check:smoke` -> passed
- `npm run check:syntax` -> passed
- `git diff --check` -> passed
- 2026-04-22 targeted overflow-menu regression checks:
  - `npm run check:syntax` -> passed
  - `npm run test:e2e:smoke -- --grep "dashboard archive helpers move the assessment into archived items after the confirm modal opens|dashboard duplicate assessment creates a new editable draft|admin user actions menu keeps only one current-user dropdown open at a time|admin user actions menu can reset a password from the floating menu|admin user actions menu blocks click-through and stays usable on the last row|admin document row actions menu can delete a document from the floating menu"` -> passed (`6` tests)
- 2026-04-22 app QA realignment and shell/admin fixes:
  - `npm run qa:app` -> passed
  - full Playwright suite -> passed (`46` tests)
  - unit tests -> passed (`551` tests)
  - static smoke, syntax, taxonomy projection, eval fixture, and README scan -> passed
  - runtime fixes included:
    - audit-log controls now bind to the active visible admin surface instead of stale hidden DOM during shell transitions
    - duplicate top-level admin page headings from the shared agent rail were removed
- 2026-04-22 AI release gate status:
  - `npm run qa:ai` -> failed
  - deterministic stub-mode metrics in `test-results/eval/qa-release-report.json` were below current thresholds:
    - `passRate: 0.000`
    - `primaryLensAccuracy: 0.538`
    - `avgValidRiskRecall: 0.313`
    - `avgInvalidRiskLeakageRate: 0.156`
    - `avgAnchorCoverage: 0.082`
  - retrieval metrics were above threshold, but `qa:ai` remained the release blocker after `qa:app` was green
- 2026-04-25 dashboard refresh / shortcut regression checks:
  - `npm run check:syntax` -> passed
  - `npm run test:e2e:smoke -- --grep "dashboard shortcuts ignore browser refresh modifiers"` -> passed (`1` test)
  - `npm run test:e2e:smoke` -> passed (`45` tests)
  - root cause: the global desktop shortcut handler accepted `Meta` as well as `Alt/Option`, so browser refresh chords like `Cmd+Shift+R` on the dashboard could be misread as `resume draft` and send the user to `/#/wizard/2`
  - fix: `handleGlobalDesktopShortcut()` in `assets/app.js` now honors only the documented `Alt/Option` shortcuts; a smoke regression test covers the dashboard refresh collision and confirms `Alt/Option + R` still resumes the draft
- 2026-04-25 follow-up code-review fix pass:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed
  - `npm run test:unit` -> passed (`551` tests)
  - `git diff --check` -> passed
  - `node --test tests/unit/step1PromptIdeas.test.js tests/unit/step1AssistGuidedDraftFallback.test.js tests/unit/step1AssistPromptIdeasLive.test.js tests/unit/step1RiskRemovalFeedback.test.js` -> passed (`46` tests)
  - final rerun after CTA-label cleanup: `npm run test:unit` -> passed (`551` tests), `node --test tests/unit/step1PromptIdeas.test.js tests/unit/step1AssistGuidedDraftFallback.test.js` -> passed (`42` tests), and `git diff --check` -> passed
  - `npm run test:e2e:smoke -- --grep "dashboard shortcuts ignore browser refresh modifiers|dashboard archive helpers move the assessment into archived items after the confirm modal opens|wizard handoff guidance carries the scenario cleanly into steps 3 and 4|wizard intake dry-run examples prefill the scenario and shortlist"` -> passed (`4` tests)
- 2026-04-25 desktop UI refinement pass:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed
  - `git diff --check` -> passed
  - `npm run test:e2e:smoke -- --grep "dashboard shortcuts ignore browser refresh modifiers|wizard intake dry-run examples prefill the scenario and shortlist|wizard handoff guidance carries the scenario cleanly into steps 3 and 4"` -> passed (`3` tests)
  - local browser sanity check at `http://127.0.0.1:8080` covered `/#/dashboard` and `/#/wizard/2`
  - refinements included route-specific agent-rail telemetry, a quieter blocked Step 2 sticky footer, explicit template-card transitions, and reduced-motion coverage for command-deck pseudo-elements
  - fixes included active-stage selector hardening, live Step 2 intake guidance refresh, safer wizard form interpolation, corrected Step 5 progress label, and broader reduced-motion handling for new continuous animations
- 2026-04-25 PoC login warning unblock:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260425v1`
  - `git diff --check` -> passed
  - `npm run test:e2e:smoke -- --grep "pressing Enter signs in and opens the personal workspace|repeated login submits keep the PoC warning acknowledgement clickable|cold login hydrates shared organisation context before the first authenticated workspace render"` -> passed (`3` tests)
  - root cause: repeated login submits could stack PoC warning modals, while the acknowledgement handler used a fixed global id lookup that could bind to the wrong modal instance
  - fix: login is now single-flight, the redundant submit-button click handler was removed, `UI.modal()` exposes its element for scoped bindings, and the PoC acknowledgement button gets a unique modal-scoped id
- 2026-04-25 Basic/Advanced experience mode pass:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260425v2`
  - `git diff --check` -> passed
  - `npm run test:e2e:smoke -- --grep "top bar experience mode toggle switches basic and advanced views|pressing Enter signs in and opens the personal workspace|repeated login submits keep the PoC warning acknowledgement clickable"` -> passed (`3` tests)
  - final focused rerun: `npm run test:e2e:smoke -- --grep "top bar experience mode toggle switches basic and advanced views"` -> passed (`1` test)
  - Basic mode is now the authenticated default, with a one-click app-bar Basic/Advanced toggle beside the currency switch
  - Basic hides the right-side agent rail and reduces ambient stage noise; Advanced restores the rail and expert inspector context
  - the existing Step 4 modelling Basic/Advanced toggle now uses the same global experience mode, so there are not two conflicting mode concepts
  - Personal Settings now stores a default interface mode and applies it immediately when changed
- 2026-04-25 Step 2 Basic simplification pass:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260425v3`
  - `git diff --check` -> passed
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode|wizard intake dry-run examples|wizard handoff guidance|wizard intake shows per-risk|top bar experience mode|manual risk selection helpers"` -> passed (`5` tests)
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard intake clear all keeps manually added risks"` -> passed (`1` test)
  - full e2e smoke: `npm run test:e2e:smoke` -> passed (`48` tests)
  - Basic Step 2 now defaults to a calmer two-prompt intake card with a single build action and draft preview
  - setup, alternate start lanes, business/geography context, and risk shortlist review now sit behind support disclosures in Basic unless context is missing
  - Advanced Step 2 still renders the command deck, scout, lane dock, context dock, and full shortlist workflow
- 2026-04-25 Step 1 guide wow / lane-switch pass:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260425v4`
  - `git diff --check` -> passed
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard guide path changes keep the start options visible|wizard step 2 basic mode|wizard intake dry-run examples|wizard handoff guidance"` -> passed (`4` tests)
  - full e2e smoke: `npm run test:e2e:smoke` -> passed (`49` tests)
  - Step 1 now has a more cinematic, Basic-user friendly route picker in the hero with animated lane cards and simpler copy
  - selecting another start lane on Step 1 now re-renders the guide instead of jumping into the Step 2 intake screen
  - `ensureDraftShape()` now preserves `step1Path`, preventing the selected start lane from silently resetting to guided
- 2026-04-25 Step 1 full decision-stage redesign pass:
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260425v5`
  - `git diff --check` -> passed
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard guide path changes keep the start options visible|wizard step 2 basic mode|wizard intake dry-run examples|wizard handoff guidance"` -> passed (`4` tests)
  - full e2e smoke: `npm run test:e2e:smoke` -> passed (`49` tests)
  - visual check: `/tmp/step1_redesign_visual_check.cjs` captured `output/playwright/step1-redesign-v5.png`; active guide metrics were `3` route options, `1` Continue button, `0` lower briefs
  - Step 1 now uses one wide Basic-user decision stage instead of a hero plus duplicate lower dashboard
  - the selected-route explanation and Continue action moved into the hero so the user sees the action immediately
  - all three start choices stay visible as large route cards; changing `guided` / `draft` / `import` keeps the user on Step 1 and updates the selected route
  - the Basic width cap no longer compresses the Step 1 guide to 960px; `wizard-layout--guide` keeps this orientation surface desktop-wide without changing the Step 2 Basic intake cap
- 2026-04-25 Documentation alignment after Step 1 redesign:
  - `README.md` now reflects the current wizard split: Step 1 Guide, Step 2 Intake, Step 3 Scenario, Step 4 Estimate, Step 5 Review & Run
  - `README.md` now documents Basic/Advanced mode behavior and the desktop-first Step 1 decision-stage pattern
  - `AGENTS.md` now calls out keeping README workflow/UX language aligned with the current wizard split
- 2026-04-25 Step 2 test-scenario draft quality investigation:
  - user tested this dummy scenario: `A critical supplier for a customer-facing digital service experiences a prolonged platform outage during a peak business period...`
  - observed first draft began with `Medium-urgency General enterprise risk scenario:` and appended unsupported supplier-concentration / pricing-power language
  - finding: that wording strongly indicates the local `composeGuidedNarrative()` seed/fallback path, not a clean live-AI draft
  - exact local source found in `assets/app.js`: `composeGuidedNarrative()` used the mechanical urgency/lens prefix and matched `critical supplier` too broadly to the supplier-concentration template
  - next product requirement: Step 2 should visibly label draft source as `Live AI draft`, `Fallback draft`, `Manual/local draft`, or equivalent, so users can tell whether live AI actually generated the output
- 2026-04-26 Step 2 draft provenance and local-fallback quality pass:
  - `assets/app.js` local guided-draft fallback now preserves the user's event as the first sentence, strips trailing punctuation, avoids the mechanical `Medium-urgency ... scenario:` prefix, and routes supplier platform outages to a third-party service-resilience context instead of supplier concentration / pricing-power drift
  - `assets/wizard/step1.js` now labels Basic draft previews by source: `Live AI draft`, `Fallback draft`, `Manual draft`, or `Local preview`
  - `assets/wizard/step1.js` no longer treats a local preview as a completed built draft; after event + impact are entered, Basic Step 2 now stays on `Build draft` / `Build the draft` until the user actually triggers the build
  - the Basic draft title and source badge now live-update together, so the screen does not show `Draft will appear here` next to a local-preview body
  - `tests/unit/appGuidedNarrative.test.js` now covers the supplier platform outage scenario and asserts no concentration/pricing-power drift or double punctuation
  - `node --test tests/unit/appGuidedNarrative.test.js tests/unit/apiOriginResolver.test.js` -> passed (`8` tests)
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260426v2`
  - `git diff --check` -> passed
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode keeps the intake simple"` -> passed (`1` test)
- 2026-04-26 live-AI localhost diagnostic:
  - hosted endpoint check from `Origin: http://localhost:8080` returned CORS allowed plus `401 AUTH_REQUIRED` without a session token, so the fixed localhost origin is not currently blocked by hosted API CORS
  - local `.env.local` has `COMPASS_API_KEY`, `COMPASS_API_URL`, and `COMPASS_MODEL`, but a direct provider health check returned `400 Invalid API Key`
  - local `.env.local` did not contain `SESSION_SIGNING_SECRET` during this diagnostic, so a local Vercel serverless run would also be unable to mint/validate authenticated API session tokens until that value is added; `ADMIN_API_SECRET` is not a valid session-signing fallback
  - current conclusion: the Step 2 banner is consistent with live AI falling back because the available local provider credential is rejected; do not treat this as a UI-only issue
  - no secrets were printed during the diagnostic
- 2026-04-26 production redeploy verification:
  - after the user redeployed production, a read-only request with `Origin: http://localhost:8080` returned `Access-Control-Allow-Origin: http://localhost:8080`
  - unauthenticated `/api/ai/status?probe=0` still returns `401 AUTH_REQUIRED`, which is expected without a browser session token
  - user then verified `Admin > System Access` from `http://127.0.0.1:8080/#/admin/settings/access`; `Test local override` returned `connection successful` with the Compass URL set to the hosted proxy and no browser API key entered
  - interpretation: localhost CORS plus the authenticated hosted proxy path are working from the browser; next check is Step 2 draft generation and the `Server AI status` card lower in System Access
- 2026-04-26 Step 2 Basic first-click AI / graceful fallback pass:
  - Basic Step 2 no longer exposes the full local draft preview after the user types event and impact; it shows `Ready for AI build` and tells the user to click `Build draft` once
  - the first build action still calls the live/server AI workflow first; local preview text is only an internal seed, not a visible draft
  - if the live AI build throws or is unavailable, `assets/wizard/step1Assist.js` now stages a `Fallback draft` from the typed answers, sets `guidedDraftSource = 'fallback'`, seeds deterministic risk suggestions when available, saves, re-renders, and shows a warning toast instead of a retry-only dead end
  - `tests/unit/step1AssistGuidedDraftFallback.test.js` now asserts the fallback draft is staged automatically with no retry banner handler
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260426v3`
  - `node --test tests/unit/step1AssistGuidedDraftFallback.test.js tests/unit/appGuidedNarrative.test.js tests/unit/apiOriginResolver.test.js` -> passed (`9` tests)
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode keeps the intake simple"` -> passed (`1` test)
  - `git diff --check` -> passed
- 2026-04-26 brand-inspired dashboard / agentic motion pass:
  - standard-user dashboard now has a `Featured risk workflows` strip inspired by the reference agent-dashboard pattern: large launch cards, teal directional markers, and clear actions for guided build, register/example intake, and sample preview
  - `assets/dashboard/userDashboard.js` wires the new cards to existing real start paths rather than decorative placeholders
  - `assets/app.css` adds the featured workflow strip, stronger teal section markers, dashboard/start-card sheens, Step 2 Basic scan motion, and reduced-motion coverage for the new continuous animations
  - `README.md` and `AGENTS.md` now record the agentic dashboard visual direction and guardrails
  - Playwright dashboard snapshot with local API routing confirmed the `Featured risk workflows` region renders with `Launch`, `Upload`, and `Preview` actions for a standard user
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260426v4`
  - focused e2e: `npm run test:e2e:smoke -- -g "pressing Enter signs in and opens the personal workspace|dashboard shortcuts ignore browser refresh modifiers|wizard step 2 basic mode keeps the intake simple"` -> passed (`3` tests)
  - `git diff --check` -> passed
- 2026-04-26 Step 2 required-context visibility pass:
  - Basic Step 2 now promotes missing business-unit/geography context into a visible `Required before AI build` band above the intake instead of relying on a buried `Required` badge inside setup support
  - the Basic `Build draft` action stays disabled until the business unit exists, with inline copy explaining that context is needed before AI drafting
  - the lower `Setup and alternate starts` disclosure is now labelled `Optional` when the required context band is already shown above the intake
  - `assets/wizard/step1.js`, `assets/app.css`, `tests/e2e/smoke.spec.js`, `README.md`, and `AGENTS.md` were updated for the new required-context rule
  - `npm run check:syntax` -> passed
  - focused e2e: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode keeps the intake simple|wizard step 2 basic mode surfaces required business context"` -> passed (`2` tests)
  - `npm run check:smoke` -> passed; asset version now `20260426v5`
  - final focused e2e rerun after the `20260426v5` asset bump -> passed (`2` tests)
  - `git diff --check` -> passed
- 2026-05-08 Parallax42-inspired Assessment Manager / readiness pass:
  - `assets/app.js` now has shared deterministic builders/renderers for `decisionReadiness`, `assessmentChallengePass`, and `assessmentManagerTrace`
  - Step 2 Basic now shows a compact Assessment Manager timeline and uses a tabbed setup support drawer instead of a long mixed support stack
  - Step 5 now shows Assessment Manager, Challenge Agent, and decision-readiness cards before the simulation action
  - `runSimulation()` persists `decisionReadiness`, `assessmentChallengePass`, and `assessmentManagerTrace` with completed assessments
  - Results now show an Assessment Manager replay and decision-readiness card, reusing persisted snapshots when available and reconstructing them for older saved assessments
  - `tests/unit/assessmentManagerJourney.test.js` adds a golden journey check for supplier outage readiness, challenge, and replay trace behavior
  - `npm run check:syntax` -> passed; asset version now `20260426v6`
  - `node --test tests/unit/assessmentManagerJourney.test.js` -> passed (`2` tests)
  - `node --test tests/unit/assessmentManagerJourney.test.js tests/unit/appGuidedNarrative.test.js tests/unit/step1AssistGuidedDraftFallback.test.js` -> passed (`7` tests)
  - `npm run check:smoke` -> passed
  - focused Step 2 browser smoke: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode"` -> passed (`2` tests)
  - focused Step 5/results critical path: `npm run test:e2e -- tests/e2e/critical-path.spec.js -g "critical path: step 5 review"` -> passed (`1` test); first sandbox run could not bind localhost (`EPERM`), rerun with approved localhost bind permission passed
  - `git diff --check` -> passed
- 2026-05-08 Parallax42-inspired agentic visual pass:
  - `assets/app.js` Assessment Manager renderer now includes a signal runway with stateful nodes, animated packets, and readiness score styling hooks
  - `assets/wizard/step1.js` Basic Step 2 intake now shows an agent strip that makes the AI build state visible before and after the first draft action
  - `assets/app.css` adds the slicker agent runway, packet motion, conic readiness gauge, hover polish, and reduced-motion coverage for the new continuous animation
  - `README.md` and `AGENTS.md` now document the runway as the preferred agentic visual layer so future UI work does not reintroduce competing panels
  - `npm run check:syntax` -> passed
  - `node --test tests/unit/assessmentManagerJourney.test.js` -> passed (`2` tests)
  - `npm run check:smoke` -> passed; asset version now `20260426v7`
  - focused Step 2 browser smoke: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode"` -> passed (`2` tests)
  - `git diff --check` -> passed
- 2026-05-08 landing dashboard agentic runway pass:
  - `assets/dashboard/userDashboard.js` standard-user featured workflow strip now includes a live launch runway above the three existing start routes
  - the runway reflects real workspace state: context readiness, draft state, live-first AI path, and decision-ready output
  - the existing dashboard actions remain intact: `Launch` guided builder, `Upload` register scout, and `Preview` sample path
  - `assets/app.css` upgrades the landing dashboard hero strip with a brighter Parallax-inspired gradient, packet motion, runway nodes, per-card agent status chips, and reduced-motion coverage
  - `README.md`, `AGENTS.md`, and `SESSION_HANDOFF.md` now record the dashboard runway as the preferred standard-user motion layer
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260426v8`
  - focused dashboard browser smoke: `npm run test:e2e:smoke -- -g "authenticated user dashboard renders without crashing"` -> passed (`1` test)
  - `git diff --check` -> passed
- 2026-05-08 BU/function oversight dashboard command-runway pass:
  - the user's screenshot was the BU oversight dashboard, not the standard-user dashboard, so the previous standard-user launch runway was correctly absent for that account
  - `assets/dashboard/userDashboard.js` now renders an oversight command runway inside the BU/function hero, tied to attention queue, context readiness, managed scope, and next action
  - `assets/app.css` adds the oversight runway visual system: wider hero content, live/hot nodes, animated packets, status metrics, responsive fallback, and reduced-motion coverage
  - asset version now `20260426v9`
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed
  - focused BU oversight browser smoke: `npm run test:e2e:smoke -- -g "business-unit oversight dashboard prioritises review and context actions"` -> passed (`1` test)
  - `git diff --check` -> passed
- 2026-05-08 Step 1 guide route-runway polish pass:
  - user screenshot showed Step 1 still felt too static: large empty hero space, route cards parked low, and no visible AI handoff motion before Step 2
  - `assets/wizard/step1.js` now renders a compact live route runway in the guide hero and adds a handoff confirmation inside the selected-route detail card
  - `assets/app.css` tightens the Step 1 hero spacing, lowers the route-card height, upgrades selected-card affordance, adds packet motion/status metrics, and covers the new packet animation under reduced-motion
  - `README.md`, `AGENTS.md`, and `SESSION_HANDOFF.md` now record the Step 1 runway as the preferred way to make the guide feel active without adding expert panels
  - asset version now `20260426v11`
  - `npm run check:syntax` -> passed
  - `npm run check:smoke` -> passed
  - focused Step 1 browser smoke: `npm run test:e2e:smoke -- -g "wizard guide path changes keep the start options visible"` -> passed (`1` test)
  - `git diff --check` -> passed
- 2026-05-09 Step 2 built-draft preview repair:
  - user screenshot showed a successful build toast and enabled Step 3 CTA while the Basic draft preview still said `Draft will appear here`
  - `assets/app.js` `ensureDraftShape()` now preserves `aiQualityState`, `guidedDraftPreview`, `guidedDraftSource`, and `guidedDraftStatus` so assisted-draft provenance survives refresh/re-render
  - `assets/wizard/step1.js` now infers a built assisted draft from `llmAssisted` plus saved narrative text when older state lacks explicit preview provenance
  - `tests/e2e/smoke.spec.js` now covers the required UX: Basic Step 2 must show `First draft ready`, the preview body, and `Draft is ready` before Step 3 is available
  - `npm run check:syntax` -> passed
  - focused Step 2 browser smoke: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode shows an existing built draft preview before step 3|wizard step 2 basic mode keeps the intake simple"` -> passed (`2` tests)
  - `npm run check:smoke` -> passed; asset version now `20260426v12`
  - `git diff --check` -> passed
- 2026-05-10 Parallax42 Step 2 workflow-ribbon pass:
  - rechecked `/Users/bhavuk.arora/Parallax42` screenshots and UI source for transferable patterns, and selected the compact source/workflow/status ribbon rather than copying the full light dashboard shell
  - `assets/wizard/step1.js` now renders a Basic Step 2 workflow ribbon with Source, Current workflow, Draft state, and Next action above the intake
  - the ribbon distinguishes no-draft, live-AI-first, live AI draft, fallback draft, manual draft, and preview-ready states so users can understand what happened without opening expert panels
  - `assets/app.css` styles the ribbon as a restrained cockpit/status layer with subtle scan motion and reduced-motion coverage
  - `tests/e2e/smoke.spec.js` covers the pre-build, ready-to-build, and saved built-draft ribbon states
  - `npm run check:syntax` -> passed
  - focused Step 2 browser smoke: `npm run test:e2e:smoke -- -g "wizard step 2 basic mode shows an existing built draft preview before step 3|wizard step 2 basic mode keeps the intake simple"` -> passed (`2` tests)
  - `npm run check:smoke` -> passed; asset version now `20260426v13`
  - `git diff --check` -> passed
- 2026-05-13 Parallax42 1-5 workflow/decision pass:
  - added shared workflow/status strip helpers in `assets/app.js` for Step 3, Step 5, and Results; it shows workflow stage, source, readiness, and next action without opening expert panels
  - added explicit provenance modeling for `Live AI`, `Fallback`, `Local preview`, `Saved result`, and `Imported source`, and surfaced the label on Step 3 AI output
  - added Results `Decision Stack` with recommendation, readiness, top blocker, next action, owner, and source
  - added a compact Challenge Agent story that explains why the decision posture changed
  - adjusted Assessment Manager copy to read as one manager-led run while keeping specialist timeline labels as trace detail
  - `npm run check:syntax` -> passed
  - `node --test tests/unit/assessmentManagerJourney.test.js` -> passed
  - focused Step 3 browser smoke: `npm run test:e2e:smoke -- -g "wizard handoff guidance carries the scenario cleanly into steps 3 and 4"` -> passed
  - focused Step 5/Results browser smoke: `npm run test:e2e -- tests/e2e/critical-path.spec.js -g "critical path: step 5 review"` -> passed
  - `npm run check:smoke` -> passed; asset version now `20260426v14`
  - `git diff --check` -> passed
- 2026-05-13 CI follow-up:
  - Test PoC deploy failed in `tests/unit/step1PromptIdeas.test.js` because `updateStep1GuidedPreview()` used `document.querySelector` against a unit-test document mock that only implements `getElementById`
  - `assets/wizard/step1.js` now guards the optional Basic preview shell lookup behind `typeof document.querySelector === 'function'`
  - `node --test tests/unit/step1PromptIdeas.test.js` -> passed (`41` tests)
  - `npm run check:syntax` -> passed
  - follow-up commit `7936511` on `test-poc` passed `Deploy Test PoC`
  - promoted to `master` by cherry-picking the missing `test-poc` commits onto `origin/master` without force-push
  - `master` promotion commits: `8fe7db8`, `145077e`, `e51d549`, `001ae32`
  - local promotion checks on `master`: `node --test tests/unit/step1PromptIdeas.test.js`, `npm run check:syntax`, and `npm run check:smoke` -> passed
  - `Deploy GitHub Pages` for `master` run `25813577225` -> passed
  - live root `https://slackspac3.github.io/risk-calculator/` fetched after deploy and is serving `20260426v14` assets
- 2026-05-13 full QA scan on production `master`:
  - baseline: `master` at `46ef6a4` with only generated `.playwright-cli/` and `output/` untracked
  - `npm run qa:app` passed all non-browser gates before the Playwright step: syntax, taxonomy projection, smoke guardrails, unit tests (`554`), eval fixture contract, and README scan (`145` checks)
  - the `qa:app` browser step initially failed with `listen EPERM` on `127.0.0.1`, which is a local sandbox/server-bind issue rather than an app failure
  - reran the package-managed browser suite with local-server permission: `npm run test:e2e` -> passed (`53` tests)
  - `npm run qa:ai` -> failed and remains the release-level AI-quality blocker
  - failing AI-quality metrics from `test-results/eval/qa-release-report.json`: `passRate 0.000 < 0.080`, `primaryLensAccuracy 0.538 < 0.650`, `avgValidRiskRecall 0.313 < 0.350`, `avgInvalidRiskLeakageRate 0.156 > 0.150`, `avgAnchorCoverage 0.082 < 0.200`
  - passing AI retrieval metrics: `retrievalCoverage 0.568 >= 0.550`, `avgRetrievalF1 0.474 >= 0.450`
  - weakest deterministic eval areas by primary-lens accuracy: Operational, Financial, Regulatory, Cyber, and Third-Party all at `0/6`; Business Continuity, Strategic, Transformation Delivery, and ESG remain low
  - latest `master` GitHub Pages workflows are green, and live root HTML still serves `20260426v14`
  - `git diff --check` -> passed after the QA scan docs update

Current local asset version under test:

- `20260426v14`

Current branch tip under test:

- `test-poc` -> `802580f` Add public landing and trust pages

## Current Working Context

- The repo root is `/Users/bhavuk.arora/Documents/GitHub/risk-calculator`.
- The public repo is `https://github.com/slackspac3/risk-calculator`.
- Recent working branch context is `test-poc`.
- Local live-AI testing should use `http://localhost:8080` against the hosted API, not a random localhost port.
- Production Vercel `ALLOWED_ORIGINS` now includes:
  - `https://slackspac3.github.io`
  - `http://localhost:8080`
  - `http://127.0.0.1:8080`
- After that allowlist was updated on 2026-04-21, the current production deployment was redeployed so the change took effect.
- Recent checked files against `origin/master` included:
  - `index.html`
  - `assets/app.js`
  - `assets/app.css`
  - `api/_audit.js`
  - `assets/admin/auditLogSection.js`
  - `scripts/smoke-check.js`
  - related unit and smoke tests
- There is current uncommitted local UI work on top of `test-poc` focused on making the shell and Step 1 feel more agentic before any promotion decision.
- `qa:app` is currently green on the local working tree after test realignment to the 5-step wizard and admin shell fixes.
- The remaining release blocker from the last full QA pass is `qa:ai`, not the app shell or browser suite.
- Recent local UI work now includes:
  - route-aware shell transitions and a persistent animated agent rail in `assets/ui/appShellPage.js` and `assets/app.css`
  - live ambient shell telemetry / pulse motion in the app shell
  - a reworked Step 1 launchpad and a guided `Scenario scout` workbench in `assets/wizard/step1.js`
  - the wizard opening flow is now split so `/wizard/1` is a guide/orientation step and `/wizard/2` is the action-first intake workspace
  - `/wizard/1` now uses a more cinematic briefing hero with a live intake preview board, stronger path-card motion, and a more visible Step 2 handoff
  - Step 2 is now being pushed toward a `Command Deck + Progressive Reveal` intake pattern rather than stacked equal-weight cards
  - Step 2 top controls are lighter than before:
    - the old start-mode cards in the top row are replaced by a compact lane dock with tab-like selectors
    - the business-unit and geography controls still sit near the top, but geography quick-picks now live behind a compact disclosure
    - appetite and regulation detail remain available behind a compact disclosure instead of an always-open wall
  - the guided path now renders as a single intake command deck:
    - a numbered intake sequence now signposts the primary path: describe the event, name the impact, build the first draft, then review and continue
    - a dynamic `Do this next` callout and matching Step 2 header hint now change with the draft state so the next action stays explicit
    - the event/impact inputs and the live scout share the same visual surface
    - the main build action is labelled as `Build first draft` / `Rebuild first draft` instead of generic AI wording
    - prompt ideas are now positioned as optional sharpening rather than a competing mini-flow
    - the empty `Review AI reasoning and related context` section is still suppressed when there is nothing useful to show
    - the old semi-circle scout graphic was replaced with a cleaner signal-scan visual so the intake panel feels more modern and less decorative
  - Step 4 estimate was reworked to feel less like a long form and more like a guided workspace:
    - the inner duplicate stepper was removed from the page header
    - a new estimate command deck now leads the page with a four-step sequence, a dynamic `Do this next` band, and an animated estimate-loop visual
    - the core estimate sections are explicitly labelled as `Step 1`, `Step 2`, and `Step 3` so the user sees the intended working order immediately
    - readiness, quick-start help, and calibration/support detail were pushed lower so they stop competing with the main estimate flow
  - the executive results tab was simplified after user review:
    - the first read now follows a clearer sequence: outcome hero, review status, a 3-step decision deck, then scenario and key numbers
    - the old results-page stack of value, benchmark, challenge, and trust modules was moved behind a single supporting-detail disclosure so the page stops reading like a long report
    - the new `Do this next` panel on results is intended to keep the management action visible without making the user scan the whole page
  - floating row action menus were hardened after a dashboard bug:
    - the shared `results-actions-disclosure` controller now mounts each floating menu into the page that owns the clicked disclosure instead of the first `main.page` in the DOM
    - this fixes dashboard row menus opening in the wrong place or ignoring clicks when stage-shell transitions leave multiple page nodes in the document briefly
  - QA drift from the old 4-step wizard was realigned to the current 5-step flow:
    - onboarding/dashboard/wizard/results smoke coverage now expects the split `/wizard/1` guide and `/wizard/2` intake flow
    - critical-path and smoke tests now target `/wizard/5` for the review/run stage
    - stale Step 1 prompt-ideas copy assertions were updated to the current `Optional sharpening` language
  - Step 2 hierarchy was tightened again after user review:
    - the old Step 2 command strip at the top was removed
    - the intake deck now renders before the lane/context dock so the working surface lands first
  - 2026-04-25 desktop UI refinement pass:
    - agent rail telemetry now prefers route-specific inspector rows, so dashboard/intake/estimate report state, blocker, and checkpoint instead of echoing page copy
    - Step 2 blocked sticky footer is now a softer validation rail with muted disabled CTA treatment
    - reduced-motion coverage now includes Step 1 and estimate command-deck pseudo-elements plus ambient stage telemetry/nodes
    - public template cards now transition explicit properties instead of `all`
    - the `Build first draft` CTA moved up into the main signal area instead of living lower in the page
    - the lane switcher is now a smaller dock instead of a second explanatory card
    - the context dock is more compact and keeps the editable inputs behind a disclosure unless context is missing
  - the persistent agent rail was tightened again after that:
    - the `Agent loop active` live module now has cleaner head-row alignment
    - status pills are kept on one line instead of wrapping awkwardly
    - the live-wave animation is smoother and less bouncy so the shell feels more modern than gimmicky
  - a shortened Step 1 regulation panel with preview + disclosure instead of a long always-open wall
  - wizard steps are now `Guide -> Intake -> Scenario -> Estimate -> Review & Run`
  - results-page reopen paths were remapped for the 5-step flow:
    - generic revise / mediation returns to `Estimate`
    - parameter challenge and consensus reruns return to `Review & Run`
  - dashboard hard refresh on macOS should now stay on `/#/dashboard`:
    - the earlier redirect to `/#/wizard/2` was not a route-table issue
    - it was caused by the global dashboard shortcut handler treating browser refresh chords using `Meta` as if they were the app’s `resume draft` shortcut
    - the documented desktop shortcuts are now `Alt/Option` only, which avoids collisions with browser-level refresh behavior
  - disclosure-state keys for the intake workspace now live under `/wizard/2::`
  - 2026-04-25 follow-up review fixes now in local working tree:
    - active stage shells are marked current synchronously so dashboard/results selectors do not bind to the previous animated shell clone
    - results tolerance styling now targets the active stage page before falling back to older `.page` selectors
    - Step 2 intake command guidance now live-updates while the event and impact fields change
    - local guided previews no longer count as staged first drafts until a built or saved narrative exists
    - changed wizard textarea/input render paths now escape saved draft values before inserting them into HTML
    - the top wizard progress label now uses `Review & Run` for Step 5
    - reduced-motion handling now disables the new rail, scout, estimate-loop, and guide-stage continuous animations
  - PoC login warning unblock:
    - repeated login submits are now ignored while a login is in flight
    - the PoC warning acknowledgement binds inside the created modal instance with a unique id, so stacked/stale modal ids cannot make `I Understand` inert
    - `UI.modal()` now returns its root element for scoped follow-up bindings
  - Basic/Advanced mode is now global:
    - the app bar exposes a one-click `Basic` / `Advanced` switch for every authenticated user
    - Basic is the default and removes the persistent agent rail; Advanced restores the inspector rail and expert mode
    - Step 4 estimate mode follows the same global setting
    - Personal Settings persists `experienceMode`
  - Step 2 Basic mode is now simplified:
    - the default `/wizard/2` intake shows two primary prompts, one build action, and a draft preview
    - the Basic opening screen does not show the workflow ribbon, Assessment Manager timeline, live-memory sidecar, or disabled sticky footer before the user can act
    - after event and impact are filled, the preview area stays in `Ready for AI build` state instead of showing a local draft before AI
    - live AI failure on the first build now stages an explicit fallback draft automatically instead of making the user retry before progress is possible
    - path switching, assessment context, regulation detail, and shortlist review are behind support disclosures unless required
    - Advanced still restores the command deck, live scout, optional prompt ideas, context dock, and full shortlist controls
  - Step 1 guide is now a wide Basic-user decision stage:
    - one headline, one selected-route explanation, one Continue action, and three persistent route cards
    - changing lanes keeps the user on Step 1 and keeps all options visible
    - `step1Path` is preserved in the draft normalizer, so selected lanes survive re-render
  - standard-user dashboard now has a featured risk-workflow strip:
    - three large agentic launch cards point to guided build, register/example intake, and sample preview
    - teal triangular markers and subtle sheens borrow the reference dashboard language without switching the app out of the dark risk-platform system
    - each card maps to an existing start path, so the visual treatment does not create fake or dead-end agent actions
  - required business context in Basic Step 2 is now shown above the intake:
    - missing business unit/geography renders a `Required before AI build` band before the two-prompt card
    - the build button is disabled until business context is selected
    - the lower setup disclosure stays optional instead of carrying the required prerequisite
  - asset cache-bust stamp `20260426v14` in `index.html`, `assets/app.js`, and `assets/releaseBootstrap.js`
- If a browser still shows the pre-split intake layout or stale wizard labels, refresh `http://127.0.0.1:8080/#/wizard/1` after the asset-version bump.

## Resume Here

- Latest validated local asset version: `20260426v14`
- Latest validated Step 2 draft-quality work:
  - supplier platform outage local fallback is covered by `tests/unit/appGuidedNarrative.test.js`
  - Basic Step 2 draft preview labels now distinguish live AI, fallback, manual, and local preview sources
  - local previews no longer make Basic Step 2 say `Review or continue` / `Rebuild draft` before an actual build
  - Basic Step 2 no longer shows the local preview body before build; event plus impact now shows `Ready for AI build`, and failed live-AI builds automatically stage an explicit fallback draft
  - Basic Step 2 now restores a built assisted/fallback draft preview from saved provenance or `llmAssisted` narrative state, so the screen cannot show `Draft will appear here` while Step 3 is available
  - Basic Step 2 opening now stays focused on required context, two prompts, one build action, and draft preview instead of showing the old workflow ribbon or manager timeline
  - Step 4 conditional-cost spacing, Step 5 run-action layout, and Assessment Manager text wrapping were validated with the critical-path e2e suite
  - focused Step 2 e2e smoke passed on the current local asset stamp
- Latest validated Parallax42 1-5 UX pass:
  - Step 3, Step 5, and Results now reuse a shared workflow/status strip for workflow stage, source, readiness, and next action
  - Results now lead with a Decision Stack covering recommendation, readiness, top blocker, next action, owner, and source
  - Challenge Agent output now includes a concise decision-change story
  - source labels now distinguish `Live AI`, `Fallback`, `Local preview`, `Saved result`, and `Imported source` on the main AI/result surfaces
  - focused Step 3 and Step 5/Results e2e checks passed on asset stamp `20260426v14`
- Current live-AI blocker found on 2026-04-26:
  - local provider health check against `.env.local` returned `400 Invalid API Key` from the Compass/Core42 endpoint
  - local serverless API testing also needs `SESSION_SIGNING_SECRET`; `ADMIN_API_SECRET` is not accepted as a session-signing fallback
  - hosted API CORS for `http://localhost:8080` was verified as allowed after the production redeploy
  - browser-side `Test local override` now succeeds through the hosted proxy from a signed-in localhost session; verify Step 2 no longer shows the AI-unavailable fallback banner
- Latest UI bug fixed locally:
  - Step 1 was fully redesigned into one desktop-wide Basic-user decision stage: the selected-route panel and Continue action are in the hero, all route choices remain visible, and the duplicate lower "What happens next" section is gone
  - Step 1 start-lane selection now stays on the guide and keeps all options visible; the selected lane no longer resets to guided during draft normalization
  - Step 2 Basic intake is now visibly simpler for non-expert users: two prompts, one build action, draft preview, and support disclosures for setup/context/risk review
  - Step 2 Basic no longer shows the workflow ribbon, Assessment Manager timeline, or live-memory sidecar on first load; the opening screen now focuses on required business context, two prompts, one build action, and draft preview
  - Step 2 Basic first-click UX now goes from typed answers directly to `Build draft`; fallback happens automatically and visibly if live AI fails
  - Step 2 Basic built-draft preview now survives refresh/re-render: successful build state must show `First draft ready` on Step 2 before continuing to Step 3
  - Step 2 Basic required business context is now visible above the intake and locks the draft build until selected, so users do not miss a prerequisite buried lower on the page
  - Step 4 estimate now adds breathing room before the optional conditional-cost drawer so it does not sit flush against the final core cost row
  - Step 5 Review & Run now keeps the Monte Carlo run button on one line at desktop width
  - Assessment Manager timeline and mission cards now have wrapping/min-width guards so long provenance phrases like `evidence/provenance` do not spill into neighboring cards
  - standard-user dashboard now opens with a more agentic featured workflow strip, stronger section markers, and animated workflow cards for the main start paths
  - global Basic/Advanced view mode now defaults to Basic and is switchable from the app bar on every authenticated route
  - PoC login warning `I Understand` now closes reliably after repeated login submits; modal button binding is unique and scoped, and login is single-flight
  - animated app-stage shells now mark the incoming shell as current before route-specific event binding runs, avoiding stale dashboard/results DOM targeting during transitions
  - Step 2 intake command guidance now updates while the user types, and local preview text no longer incorrectly marks the first-draft step complete
  - saved wizard textarea/input values touched in the latest pass are escaped before HTML insertion
  - reduced-motion users no longer receive the new rail, scout, estimate-loop, or guide-stage continuous animations
  - dashboard BU attention queue `More` menu now mounts to the correct page shell instead of drifting to another page instance during stage transitions
  - shared floating overflow menus now anchor to the active stage shell coordinate space, and the dashboard action host no longer binds to a stale `main.page` during shell transitions
  - dashboard hard refresh should no longer jump to `/#/wizard/2`; browser refresh chords and the app’s draft-resume shortcut are no longer conflated
  - admin audit-log controls now bind to the active visible section instead of stale hidden shell DOM
- Best first check after restart:
  - run `python3 -m http.server 8080`
  - open `http://127.0.0.1:8080/#/`
  - hard refresh once so `20260426v14` assets load
  - verify the top-bar `Basic` / `Advanced` switch toggles the right-side agent rail
  - verify `/#/wizard/1` shows one wide decision stage with one Continue action and keeps all route cards visible when switching between guided, draft, and import
  - verify `/#/wizard/2` in Basic shows the simplified two-prompt intake and hides the dense command deck until Advanced is selected
  - verify `/#/wizard/2` does not show the workflow ribbon, Assessment Manager timeline, live-memory sidecar, or disabled sticky footer on the Basic opening screen
  - verify `/#/wizard/2` after `Build draft` shows `First draft ready` in the draft preview before the Step 3 continue action is used
  - verify `/#/wizard/2` with no business unit selected shows `Required before AI build` above the intake and keeps `Build draft` disabled until the business unit is selected
  - verify `/#/wizard/4` keeps the conditional cost areas drawer separated from the core cost rows
  - verify `/#/wizard/5` keeps `Run Monte Carlo simulation (...)` on one line and Assessment Manager evidence text inside its cards
  - verify PoC login warning `I Understand` closes and reaches the dashboard
  - verify `/#/dashboard` stays on the dashboard after a hard refresh
  - verify `/#/dashboard` shows the `Featured risk workflows` strip and that its `Launch`, `Upload`, and `Preview` actions start the expected guided, register/example, and sample flows
  - verify `Alt/Option + R` still resumes the active draft, while browser refresh shortcuts do not
  - verify BU attention queue row `More` actions now open beside the row and respond correctly
- Most likely next product/UI focus:
  - first: verify the live Step 2 build from `http://127.0.0.1:8080/#/wizard/2` now produces a `Live AI draft` when the hosted proxy/provider are healthy, and otherwise stages a clearly labelled fallback draft without blocking the user
  - 2026-04-25 UI quality assessment found the strongest desktop surfaces are the Step 1 guide and Step 4 estimate command deck: premium dark-surface system, clear route signposting, strong type, and useful agentic motion
  - desktop-only priority remains simplifying dense results and later wizard surfaces so the primary action is obvious without scanning multiple cards; the new dashboard featured-workflow treatment is the reference pattern to review before spreading it further
  - mobile layout hardening is intentionally deferred because the user said the app will be used in desktop browser only
  - keep pushing the app toward a more agentic feel through clearer signposting and restrained live motion, not more panels
  - if the goal is release readiness rather than more UI work, take `qa:ai` next because that is the remaining known gate failure after `qa:app` went green

## Start-Of-Session Routine

1. `git fetch origin --prune`
2. `git status --short --branch`
3. Confirm branch sync:
   - `git rev-list --left-right --count origin/master...master`
   - `git rev-list --left-right --count origin/test-poc...test-poc`
4. Confirm branch divergence before promotion work:
   - `git rev-list --left-right --count origin/master...test-poc`
   - `git log --oneline master..test-poc`
   - `git log --oneline test-poc..master`
5. Re-read `PREVIEW_PROMOTION_FLOW.md` and `RELEASE_CHECKLIST.md` before any release or promotion step.
6. If local testing needs live hosted AI, run `python3 -m http.server 8080` and open `http://localhost:8080`.
7. Run the smallest relevant validation set before editing, then the relevant checks again before finishing.

## End-Of-Session Routine

1. Update this file if branch status, workflow expectations, checks run, or current focus changed.
2. Record the exact branch and commit you validated.
3. Note any unpromoted branch work that still needs live promotion.
4. If something was promoted, record the source commit and confirm the local/protected-preview validation used before `master`.

## If Promotion Is The Goal

1. Validate the candidate change with the relevant local managed QA and any required protected preview.
2. Do not use `https://slackspac3.github.io/risk-calculator/test/` as validation evidence; it is a retired placeholder.
3. Run the release checks from `RELEASE_CHECKLIST.md`.
4. Promote the tested change to `master` without skipping branch comparison.
5. Re-check the live root URL after GitHub Pages publishes.
