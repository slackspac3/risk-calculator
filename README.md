# Risk Intelligence Platform

Risk Intelligence Platform is an internal enterprise risk decision-support product. It combines guided scenario building, AI-assisted structuring, FAIR-style quant logic, Monte Carlo simulation, evidence-grounded retrieval, and executive-grade reporting in one role-aware workflow.

Important pilot boundary:
- this environment is still a PoC sandbox
- do not use real company names, customer data, or live incident details
- create dummy scenarios only
- prefer generic labels such as `supplier`, `customer`, `service provider`, or `business unit`

This repository contains:
- the GitHub Pages frontend SPA
- the Vercel-hosted serverless API routes used by the shared pilot environment

## What The Product Does

The platform helps a user move from a vague issue to a structured, challengeable, quantified management view.

Core capabilities:
- role-based dashboards for standard users, function admins, BU admins, and global admins
- AI-assisted risk and context builder
- grounded BU and function-context drafting with inline grounding feedback
- scenario refinement and structured scenario shaping
- plain-language estimation and advanced tuning
- FAIR-style Monte Carlo simulation
- executive, technical, and appendix result views
- treatment comparison and better-outcome analysis
- direct PDF export plus printable decision memo / board note outputs
- evidence, provenance, assumptions, confidence, and citation surfacing
- citation freshness labels, official external source links, and saved-assessment freshness advisories
- document-grounded retrieval across standards, frameworks, and regulations
- review submission and management sign-off workflow
- admin governance for organisation setup, defaults, users, audit, and document library

## Current Workflow

1. Dashboard
2. Start or resume an assessment
3. Step 1: AI-assisted risk and context builder
4. Step 2: scenario refinement and narrative shaping
5. Step 3: estimation and advanced tuning
6. Review & Run
7. Results
   - Executive Summary
   - Technical Detail
   - Appendix & Evidence
8. Compare a better outcome, export, submit for review, or revisit later

## Enterprise Risk Coverage

The product now supports a broader enterprise risk lens, not only cyber. Current first-class or actively modeled domains include:

- strategic
- operational
- cyber
- third-party
- regulatory
- financial
- ESG
- compliance
- supply chain
- procurement
- business continuity
- HSE
- AI / model risk
- data governance / privacy
- fraud / integrity
- legal / contract
- geopolitical / market access
- physical security
- OT / industrial resilience
- people / workforce / human rights
- investment / JV
- project / programme / transformation delivery

## Review And Approval Flow

Completed assessments that breach tolerance, approach tolerance, or trigger annual review can now move into a lightweight management-review workflow.

Current behavior:
- the results hero can prompt the user to submit the assessment for review
- submitters now choose an explicit reviewer instead of sending into an anonymous scope queue
- regular users can submit to reviewer-capable people in their own function, with BU fallback when no function reviewer exists
- `function_admin` users can route the assessment to any reviewer-capable person in their BU
- `bu_admin` users can escalate unresolved in-scope BU reviews to a named holding-company `admin`, even when they are not the current assignee
- submitted items are stored in the shared review queue API
- the queue item now stores:
  - submitter
  - assigned reviewer
  - review scope
  - a bounded shared results snapshot so the assignee can open the result even if it is not already in their local browser workspace
- results surfaces now show who the assessment is assigned to, not only that it is pending
- the assigned reviewer can approve or request changes from the results page
- BU heads can escalate from the results page to a named holding-company reviewer
- oversight dashboards now expose a compact review inbox for unresolved assigned items
- Platform Home still shows the central queue for admins, with named assignees surfaced there as well
- the central queue now supports the same named holding-company escalation path for BU heads instead of showing an inert escalate action
- results surfaces now reflect:
  - pending
  - approved
  - changes requested
  - escalated

Pilot note:
- the queue is backed by shared KV
- notifications are currently in-app/browser-scoped for the pilot
- there is no separate email or workflow-notification delivery path yet

## AI And Grounding Model

The product is assistant-driven, not chat-first. AI is used to:
- improve and structure scenario drafts
- refine narratives
- generate challenge prompts
- suggest likely risk groupings
- build evidence-backed interpretation

Current AI behavior:
- the browser is now a thin client for the key AI workflows rather than the authoritative orchestration layer
- server routes own prompt construction, structured-output repair, quality gates, readiness evaluation, and fallback policy for the main guided, register, treatment, and reviewer/challenge flows
- browser-side admin context drafting and refinement currently use a temporary `28000`-character prompt ceiling for the PoC so long inherited context blocks are less likely to clip before send
- the longer-term fix is prompt shaping rather than prompt growth alone; that backlog is tracked in [docs/future-fixes.md](./docs/future-fixes.md)
- `Build scenario draft` remains the single authoritative Step 1 intelligence call; guided prompt ideas and pre-build preview are now deterministic/local so they do not add extra hosted backend traffic
- Step 1 pre-draft hinting is now projection-first:
  - the browser ranks competing taxonomy families, lenses, confidence, and separation before showing prompt ideas or a preferred local lens
  - ambiguous close-call wording stays soft instead of forcing a hard lane from a single generic token such as `payment`, `breach`, `outage`, or `supplier`
  - bounded browser fallback heuristics only run when the taxonomy projection is absent or clearly too weak
  - the committed browser projection snapshot is now parity-checked against the canonical taxonomy, and can be regenerated with `npm run sync:taxonomy-projection`
  - bounded novel-wording evals now cover paraphrase and near-miss phrasing across ransomware/extortion, privacy/retention/transfer, supplier delay, workforce fatigue, ESG, availability attack, payment-control-vs-fraud, and third-party access wording
- the authoritative Step 1 draft path is now tighter about event-path preservation:
  - prompt construction explicitly prioritises user event, trigger, affected asset/service, and main impact
  - server-side quality gates now reject more consequence-led or off-path rewrites and shortlist drift
  - weak inputs now get more specific missing-detail guidance instead of generic “add more context” nudges
- browser API base-URL resolution is now config-driven: Vercel-hosted fronts stay same-origin, while static fronts use the configured hosted API origin without extra discovery requests
- client workflow requests are normalized before transport so semantically identical inputs produce a stable request shape
- duplicate suppression now happens on both sides:
  - the browser suppresses same-input repeat clicks and very recent identical reruns
  - the server reuses identical in-flight work and short-lived recent results for the main AI routes
- server AI routes now emit lightweight operational metrics for invocation volume, latency, timeout pressure, fallback/manual rate, and duplicate/cache reuse
- wizard steps can still carry short-term runtime context memory across the draft flow
- bounded AI rewriting is used where draft quality matters
- explicit fallback and unavailable states are surfaced instead of silently masquerading as live AI
- retrieval uses a stronger local hybrid scorer with lens-aware and concept-aware matching, but browser-local learning weights no longer authoritatively shape inference quality
- domain guardrails now explicitly keep common continuity, counterparty-credit, ESG/human-rights, and geopolitical scenarios from drifting into adjacent cyber, fraud, or procurement lanes unless the user input actually supports that crossover
- remaining browser-side helper AI stays assistive-only for bounded UX features such as company-context drafting and scenario memory; it is not part of the trusted assessment or review path
- BU and function-context AI assist now inherits richer organisation context, parent-layer context, and saved regulations, then shows an inline grounding state:
  - `Grounded in saved context`
  - `Partly grounded`
  - `Generic draft warning`
- UAE default grounding now includes named national references for UAE contexts, including:
  - `UAE Information Assurance Standard`
  - `NCEMA 7000:2021 Business Continuity`
  - named UAE Cyber Security Council policies
  - ADGM holding-company obligations where the company baseline is relevant
- supporting documents and standards are cited into the workflow and results

The product is grounded by a growing enterprise corpus that includes ISO, NIST, COSO, IFRS/ESRS, OECD, UNGP, sector guidance, and UAE/GCC-relevant references.

Recent grounding improvements:
- retrieval metadata in [data/docs.json](./data/docs.json) is now sharper for high-drift Step 1 areas such as:
  - vendor access and subcontractor reach
  - ESG claim substantiation and Scope 2 disclosure supportability
  - forced labour / modern slavery due diligence
  - alternate workspace and manual fallback continuity language
  - fatigue, understaffing, and worker-welfare scenarios
- first-class Step 1 hardening now covers a wider set of non-cyber domains, including:
  - geopolitical / market access
  - legal / contract
  - investment / JV
  - AI / model risk
  - data governance / privacy
  - fraud / integrity
  - physical security
  - OT / industrial resilience
  - people / workforce / human rights
  - supply chain
  - procurement
- procurement is now modeled with explicit pre-award sourcing patterns such as:
  - maverick or off-contract spend
  - tender-method and whole-life-cost failure
  - lotting and competition-design failure
  - constrained-market contracting under pressure
  - bundled-award and price-validity traps
  - urgent direct-negotiation readiness gaps
- official UAE and ADGM references are now included for document-grounded retrieval, including NCEMA continuity, ADGM annual filings, ADGM beneficial ownership, ADGM data protection, and named UAE Cyber Security Council policy references
- Step 1 citation selection now prefers event-matching references over generic governance references when both are available
- citations can now carry:
  - staleness warnings when a source is old
  - official external source links where a verified public source page exists

## Pilot AI Readiness Policy

Pilot and staging environments should be treated as live-AI-required when AI quality matters.

Current policy:
- live-vs-degraded status is determined server-side
- deterministic fallback is continuity support, not pilot-quality live AI
- the hosted proxy is the normal path for pilot and production
- browser-direct keys and runtime overrides are localhost-only debugging controls
- if pilot or staging users are relying on AI quality for sign-off, check the server-reported mode in `Admin > System Access`

Current product behavior:
- `Admin > System Access` now shows a `Pilot AI readiness` card
- that card distinguishes:
  - `Live`
  - `Degraded`
  - `Deterministic fallback`
  - `Manual only`
- `Refresh server status` triggers a new server-side health check
- localhost can still expose debugging overrides, but those do not replace the server-reported mode used for pilot/prod trust decisions
- migrated workflows now label deterministic fallback and manual states explicitly instead of presenting them as equivalent to live AI quality

Operational expectation:
- do not treat fallback-generated AI guidance as pilot-quality AI output
- verify the server-reported mode in `System Access` before AI-dependent review, demo, or sign-off activity
- if the platform is intentionally being exercised in deterministic fallback or manual mode, be explicit about that in the session context
- when AI drafting or refinement fails, use `Admin > System Access` for full Compass failure diagnostics and `Admin > Audit Log` for the short inline summary:
  - the audit row now exposes failure stage and whether the prompt was truncated before send
  - the diagnostics panel still carries the full prompt footprint, response preview, and attempt history

## Results And Exports

Results are intentionally split by audience:

- Executive Summary
  - management interpretation
  - tolerance posture
  - immediate action framing
  - benchmark/value context
- Technical Detail
  - FAIR inputs
  - histogram
  - loss exceedance curve
  - challenge and validation layer
- Appendix & Evidence
  - provenance
  - assumptions
  - citations
  - challenge review

Additional trust signals now shown in the workflow:
- citation age warnings in evidence views
- benchmark age labels and stale-benchmark warnings in estimation
- saved-assessment freshness advisories when older runs are reopened

Export options currently include:
- JSON export
- printable HTML/PDF-style report flow
- direct jsPDF download
- decision memo
- board note
- PPTX spec export stub

## Evaluation Harness

The repository now includes a benchmark fixture and two evaluation paths so quality is not judged only by static exact-match rules.

Benchmark fixture:
- [tests/fixtures/eval/g42_eval_master_repaired.jsonl](./tests/fixtures/eval/g42_eval_master_repaired.jsonl)
- [tests/fixtures/eval/g42_eval_growth_pack.jsonl](./tests/fixtures/eval/g42_eval_growth_pack.jsonl)
  - bounded supplemental pack for live PoC drift areas such as AI/model-risk abstention, privacy transfer/retention, supplier delay, vendor access, workforce fatigue, ESG substantiation, continuity fallback, and transformation-delivery drift
- fixture rows can also carry `expected_doc_ids` so the local eval can score retrieval quality, not only lens and risk-title quality

Commands:
- `npm run test:eval:fixture`
  - validates that the shipped benchmark fixture stays complete and balanced
- `npm run eval:local -- --mode stub`
  - runs the current Step 1 scenario-assist path against the fixture using the browser LLM service in fast local stub mode
- `npm run eval:local -- --mode live`
  - runs the same harness against live AI using `RC_COMPASS_API_KEY` / `RC_COMPASS_API_URL` / `RC_COMPASS_MODEL`
- `npm run eval:ai -- --report test-results/eval/local-eval-report.json`
  - uses a second AI pass as a semantic judge over the generated outputs, so the benchmark is not only a static deterministic score
- `npm run eval:harvest -- exported-user-state.json`
  - mines real user interaction exports for high-signal candidate scenarios that should feed the next benchmark revision

Outputs:
- local deterministic report: `test-results/eval/local-eval-report.json`
- AI judge report: `test-results/eval/ai-judge-report.json`
- harvested growth candidates: `test-results/eval/eval-growth-candidates.jsonl`

Current eval focus:
- targeted slices are now used to harden thin domains one by one instead of relying only on whole-fixture averages
- retrieval scoring now reports precision, recall, and F1 where `expected_doc_ids` are present
- recent targeted slices include geopolitical, legal / contract, investment / JV, AI / model risk, data governance / privacy, fraud / integrity, physical security, OT / industrial resilience, people / workforce, supply chain, and procurement

Additional regression coverage:
- targeted unit packs now lock:
  - projection parity against the canonical taxonomy snapshot
  - bounded novel-wording paraphrases for Step 1 browser hinting
  - retrieval relevance for the highest-drift grounding themes in `docs.json`
  - supplemental eval-growth rows that represent real PoC-style wording expansion rather than only the original gold set

The intended operating loop is:
1. run `eval:local`
2. run `eval:ai` on the failures or a targeted slice
3. review the overlap between deterministic failures and AI-judge failures
4. promote only the strongest real-world growth candidates into the fixture after human review

This keeps the benchmark grounded by a stable gold set while still using AI as a semantic checker and user behaviour as a source of new benchmark cases.

## AI Feedback Learning Loop

The product now includes a structured Step 1 AI feedback loop for:
- the generated scenario draft
- the generated risk shortlist
- individual generated risk cards when a user rates or removes them

Current behavior:
- users can rate each on a 1-5 scale
- users can attach concise reason tags such as:
  - wrong domain
  - too generic
  - missed key risk
  - unrelated risks
  - weak citations
  - useful with edits
- feedback is stored with the active runtime mode:
  - `live_ai`
  - `fallback`
  - `local`
- `Admin > AI Feedback & Tuning` now shows who submitted recent feedback events more clearly:
  - when the managed account directory has a matching person, the admin card shows display name plus `@username`
  - otherwise it falls back to the stored username
- when a user removes a generated risk, the product now asks why:
  - `Incorrect risk`
  - `Correct, but narrowing scope`
  - `Only partially relevant`

How that feedback improves the platform:
- feedback is still captured in the browser and shared to the server-backed org intelligence store
- authoritative learning-profile resolution now happens server-side
- repeated live-AI signals can then shape:
  - user-level server user-state priors
  - function-level priors
  - BU-level priors
  - global shared priors
- for the currently migrated Step 1 workflows, those priors are now applied server-side to prompt/context guidance and risk ordering
- only clearly incorrect generated risks are promoted into the AI tuning path when removed; scope-narrowing and partial-relevance removals stay analyst-only so the system does not learn to suppress valid adjacent risks

Important guardrails:
- fallback feedback is tracked separately from live-AI feedback
- deterministic fallback continuity does not automatically become shared pilot-quality learning
- repeated shared patterns are promoted upward only after enough corroborating live-AI signals
- this is not direct online model retraining
- raw production clicks are not direct model training; curated offline review is still the path for benchmark and model-training updates

Plain-language boundary:
- the base LLM is not being re-trained each time a user moves a slider or saves a rating
- instead, the platform can use reviewed live-AI feedback signals to improve server-side ranking and prompt/context guidance where that path has been migrated
- if the organisation later wants true model training, that should come from reviewed and curated feedback data, not raw production clicks

Practical implication:
- better-quality repeated feedback can improve similar scenarios first at the governed server user tier, then for the wider function, BU, and platform once the signal is strong enough

## Global Admin Guide

Global admins now have a dedicated operating guide:
- [docs/global-admin-guide.md](./docs/global-admin-guide.md)

Use it alongside the role-aware in-product help on `#/help`.

Current global-admin priorities:
- use `#/admin/home` as the front door for platform work
- verify pilot AI readiness in `Admin > System Access` before demos, reviews, or sign-off sessions where AI quality matters
- review `Admin > AI Feedback & Tuning` before changing shared AI alignment, draft style, shortlist discipline, or learning sensitivity
- use the AI Feedback & Tuning drill-down to inspect recent events and low-scoring live-AI cases before changing shared policy
- if signal quality is contaminated or you need a clean restart, use the guarded reset flow in `Admin > AI Feedback & Tuning` to clear shared feedback, wipe saved user-tier AI feedback signals, and restore default tuning without deleting assessments
- keep company context, document library coverage, defaults, and access current before assuming a weak output is only a model problem
- treat platform-wide tuning as a governed change, not as an ad hoc reaction to one noisy session

## Product Quality Highlights

Current productization work now includes:
- premium UI polish across dashboard, wizard, results, settings, admin, and document library
- committed Step 1 start modes for guided, draft, and import/example paths instead of a single long scroll
- Step 1 now avoids background AI preview/prompt-idea traffic and keeps the authoritative draft path on one explicit server call
- tighter Step 1 domain hardening for continuity, finance, ESG, and geopolitical scenarios so shortlist and narrative drift is reduced even in deterministic fallback mode
- scenario memory and overlap checks in Step 1 without letting browser-local precedent silently steer inference quality
- stronger AI quality and coherence signaling
- role-aware examples and focus areas
- broader enterprise taxonomy and standards coverage
- review queue and management decision workflow
- clickable audit-log summary cards that drill recent platform activity by sign-in event and actor role
- reviewer brief, challenge mediation, challenge synthesis, and consensus recommendation flows in results
- living risk register, AI flags, correlation spotting, and board brief generation on role-aware dashboards
- watchlist confidence trajectory signals so reassessment queues show whether confidence is improving, declining, or flat
- direct PDF download
- worker-based Monte Carlo execution so simulation no longer blocks the UI thread
- streaming AI narrative refinement in Step 2
- portfolio heat map on the dashboard
- persisted session preferences for results tabs and boardroom mode
- server-authoritative AI status, orchestration, fallback, and learning-profile application
- normalized AI request shaping, duplicate suppression, and lightweight route analytics for the hosted AI paths
- KV-backed API rate limiting and login throttling for the shared pilot environment

## Architecture

### Frontend

Static single-page application served by GitHub Pages.

Key entry points:
- [index.html](./index.html)
- [assets/app.js](./assets/app.js)
- [assets/app.css](./assets/app.css)
- [assets/tokens.css](./assets/tokens.css)

Main frontend areas:
- dashboard: [assets/dashboard/](./assets/dashboard)
- wizard: [assets/wizard/](./assets/wizard)
- results: [assets/results/](./assets/results)
- settings: [assets/settings/](./assets/settings)
- admin: [assets/admin/](./assets/admin)
- services: [assets/services/](./assets/services)
- state: [assets/state/](./assets/state)
- engine: [assets/engine/](./assets/engine)
- UI helpers: [assets/ui/](./assets/ui)

Important runtime seams:
- results rendering and interactions: [assets/results/resultsRoute.js](./assets/results/resultsRoute.js)
- dashboard rendering: [assets/dashboard/userDashboard.js](./assets/dashboard/userDashboard.js)
- wizard steps: [assets/wizard/step1.js](./assets/wizard/step1.js), [assets/wizard/step2.js](./assets/wizard/step2.js), [assets/wizard/step3.js](./assets/wizard/step3.js)
- LLM integration: [assets/services/llmService.js](./assets/services/llmService.js)
- workflow transport, payload normalization, and client duplicate suppression: [assets/services/aiWorkflowClient.js](./assets/services/aiWorkflowClient.js)
- server-status client: [assets/services/aiStatusClient.js](./assets/services/aiStatusClient.js)
- runtime trace store: [assets/services/aiTraceRuntime.js](./assets/services/aiTraceRuntime.js)
- export generation: [assets/services/exportService.js](./assets/services/exportService.js)
- quant engine: [assets/engine/riskEngine.js](./assets/engine/riskEngine.js)
- worker simulation path: [assets/engine/riskEngineWorker.js](./assets/engine/riskEngineWorker.js)

### Backend

Serverless API routes hosted on Vercel.

Primary routes:
- [api/compass.js](./api/compass.js)
- [api/ai/status.js](./api/ai/status.js)
- [api/ai/scenario-draft.js](./api/ai/scenario-draft.js)
- [api/ai/register-analysis.js](./api/ai/register-analysis.js)
- [api/ai/treatment-suggestion.js](./api/ai/treatment-suggestion.js)
- [api/ai/reviewer-brief.js](./api/ai/reviewer-brief.js)
- [api/ai/challenge-assessment.js](./api/ai/challenge-assessment.js)
- [api/ai/parameter-challenge.js](./api/ai/parameter-challenge.js)
- [api/ai/challenge-synthesis.js](./api/ai/challenge-synthesis.js)
- [api/ai/consensus-recommendation.js](./api/ai/consensus-recommendation.js)
- [api/ai/review-mediation.js](./api/ai/review-mediation.js)
- [api/company-context.js](./api/company-context.js)
- [api/users.js](./api/users.js)
- [api/settings.js](./api/settings.js)
- [api/user-state.js](./api/user-state.js)
- [api/review-queue.js](./api/review-queue.js)
- [api/audit-log.js](./api/audit-log.js)

Shared backend helper:
- [api/_kvStore.js](./api/_kvStore.js)
- [api/_apiAuth.js](./api/_apiAuth.js)
- [api/_audit.js](./api/_audit.js)
- [api/_aiRuntime.js](./api/_aiRuntime.js)
- [api/_aiOrchestrator.js](./api/_aiOrchestrator.js)
- [api/_aiRouteMetrics.js](./api/_aiRouteMetrics.js)
- [api/_aiWorkflowSupport.js](./api/_aiWorkflowSupport.js)
- [api/_learningAuthority.js](./api/_learningAuthority.js)
- [api/_request.js](./api/_request.js)
- [api/_rateLimit.js](./api/_rateLimit.js)
- [api/_passwordPolicy.js](./api/_passwordPolicy.js)
- [api/_workflowReuse.js](./api/_workflowReuse.js)

Current AI runtime efficiency measures:
- register-analysis inputs are trimmed server-side before live model use to remove empty rows, repeated headers, and noisy workbook-style columns while preserving meaningful row order
- the main AI routes keep explicit `live`, `deterministic_fallback`, and `manual` semantics even when reuse or early-return paths are taken
- route metrics are in-memory and aggregate-only; no prompt, payload, or user content is logged in the lightweight analytics summaries

### Persistence Model

Current persistence spans:
- saved assessments
- draft state and draft recovery
- shared/server draft workspace is preferred on refresh; local browser draft recovery is now a one-time safety net instead of the default restore source
- personal user state
- shared admin settings
- shared admin settings and shared user state both use revision-based conflict detection on the server-backed APIs rather than last-write-wins
- settings screens now cancel stale autosave timers on rerender or `Load Latest`, so reloading the latest shared settings snapshot does not immediately re-trigger an old save callback from the previous screen instance
- organisation structure and scoped defaults
- feedback capture, templates, and local history caches
- server-applied learning profiles and shared AI feedback state
- review queue items
- audit events
- local pilot notifications
- session-scoped results preferences such as active tab and boardroom mode

## Local Development

Preferred Node version:

```bash
nvm use
```

Pinned in:
- [.nvmrc](./.nvmrc)
- [.node-version](./.node-version)
- [package.json](./package.json)

Run a local static server from the repo root:

```bash
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

Do not use `file://`.

## Environment Configuration

Do not commit real secrets, credentials, or tokens.

Reference shape:
- [.env.example](./.env.example)

That file covers the expected configuration for:
- frontend origin
- frontend origin allowlists
- Compass API access
- eval-harness Compass overrides
- session signing
- audit retention
- shared KV/user store access
- KV compatibility aliases still supported by the current codebase
- bootstrap admin/account seeding

AI environment notes:
- server-side pilot environments should provide real `COMPASS_API_KEY`, `COMPASS_API_URL`, and `COMPASS_MODEL` values
- the frontend defaults to the hosted proxy path and should normally run keyless in the browser
- pilot and production should rely on the hosted proxy plus the server-reported mode in `Admin > System Access`
- localhost-only overrides exist for debugging, but they do not replace the server-reported mode used for operational trust

## Deployment

### Frontend
- GitHub Pages
- workflow: [.github/workflows/pages.yml](./.github/workflows/pages.yml)

### Backend
- deploy `api/` routes to Vercel
- configure KV and secrets there
- use [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md) for rollback steps

## PoC Architecture Limits And Azure Path

Current PoC architecture limits:
- the product is currently split across a static GitHub Pages frontend and Vercel-hosted serverless APIs, so hosting, routing, secrets, and rollback are not yet managed inside one enterprise platform boundary
- shared persistence is intentionally pilot-grade:
  - Vercel/serverless APIs plus shared KV are sufficient for the PoC review queue, shared settings, and shared user-state flows
  - they are not yet positioned as a full enterprise system of record with durable workflow orchestration, enterprise reporting pipelines, or broad downstream integrations
- some resilience and UX safeguards are still browser-scoped by design:
  - local draft recovery
  - session-scoped preferences
  - in-app pilot notifications
  - bounded shared-result snapshots so reviewers can open work across browser sessions
- notifications and review routing are currently in-app only; there is no separate email, Teams, workflow-engine, or ticketing integration path yet
- identity and account management are still pilot-oriented:
  - managed accounts and signed session tokens exist
  - enterprise SSO, Entra ID lifecycle management, conditional access, and group-driven provisioning are not yet the active runtime model in this repo
- observability is intentionally lightweight for the PoC:
  - AI route metrics are aggregate and in-memory
  - admin/runtime status views are product-facing rather than a full central operations stack

Expected Azure deployment improvements:
- a more unified hosting model instead of the current GitHub Pages plus Vercel split
- enterprise identity integration, expected to move toward Microsoft Entra ID rather than shared PoC-style account handling
- stronger centralised data, audit, and operational controls than the current pilot KV/browser safety-net mix
- better support for durable notifications, richer management workflow routing, and broader enterprise integration patterns
- fuller observability, access governance, and environment control than the current pilot-grade runtime surfaces

Important note:
- the Azure items above describe the intended improvement direction, not features already implemented in this repository today
- until that deployment path is complete, treat the current system as a pilot architecture with deliberate PoC constraints

## Pilot Seed Data

Sample pilot seed/reference data:
- [data/pilot-seed/bootstrap-accounts.sample.json](./data/pilot-seed/bootstrap-accounts.sample.json)
- [data/pilot-seed/demo-assessments.sample.json](./data/pilot-seed/demo-assessments.sample.json)
- [data/pilot-seed/demo-user-state.sample.json](./data/pilot-seed/demo-user-state.sample.json)

Suggested usage:
- copy bootstrap accounts JSON into `BOOTSTRAP_ACCOUNTS_JSON` for pilot seeding
- import sample assessments through the dashboard when needed
- treat the sample user-state file as a reference shape, not a migration script

## Managed Pilot Accounts

Current managed-account behavior:
- global admins can create, reset, and delete shared pilot users from `Admin > User Account Control`
- usernames are still derived from the display name in a predictable dot-normalised format such as `andy.ben.dyke`
- passwords are now issued server-side on both account creation and password reset
- issued passwords are random, policy-compliant credentials rather than sequential `RiskPilot!/PilotRisk!` style strings
- new or reset passwords are shown only in the current admin session, so admins should copy or hand them over immediately

Operational note:
- the API still accepts an explicitly supplied password for controlled/manual administration paths, but the normal product flow now relies on server-issued random credentials so create and reset stay aligned

## QA

Core checks:

```bash
npm run check:syntax
npm run test:unit
npm run check:smoke
npm run test:e2e
npm run test:eval:fixture
npm run eval:local
node scripts/readme-scan.js
```

Release-grade deterministic gate:

```bash
npm run qa:release
```

What `qa:release` covers for this application:
- static syntax and smoke guardrails
- taxonomy projection consistency
- full unit coverage
- deterministic eval-fixture and local stub eval coverage for AI/RAG drift
- explicit AI/RAG release thresholds over the eval report rather than a report-only artifact
- full Playwright coverage, not just the smoke subset
- documentation and release-contract consistency
- a managed ephemeral static SPA origin for browser verification, so the gate does not inherit whatever already happens to be running on localhost

For this SPA plus hosted-API architecture, the browser release bar now also expects:
- cold-session `/#/login -> sign in -> first authenticated render` coverage
- role-capability checks that depend on hydrated shared org structure
- empty-state verification for review surfaces so failures do not masquerade as “empty”
- hosted API origin usage from browser modules instead of raw relative `/api/...` fetches

Browser test best practice for this repository:
- use `npm run test:e2e` or `npm run test:e2e:smoke`, not raw `npx playwright test`
- the package scripts provision a clean localhost static server automatically unless `PLAYWRIGHT_BASE_URL` is already set
- that matters here because warm or reused localhost origins can hide the exact cold-session hydration and wrong-origin browser/API issues this application is most exposed to

Eval gate best practice for this repository:
- do not treat `eval:local` as an informational report only; `qa:release` now fails when release thresholds are missed
- the release checker is mode-aware:
  - `stub` mode gates taxonomy, risk recall/leakage, anchor coverage, retrieval coverage, and retrieval F1
  - `live` mode gates those same metrics and also limits fallback dependence
- for this product, a green browser suite is not enough if the scenario eval still shows weak lane discipline, weak grounding, or excessive AI fallback

Repository consistency scan:
- `node scripts/readme-scan.js`
- verifies expected file structure, config pins, package scripts, FAIR engine markers, role/review states, feedback-learning tags, evidence-contract fields, export seams, API security markers, eval harness presence, and pilot seed data
- use it when updating the README, release docs, repo layout, or other documented platform contracts

Targeted security coverage now also checks:
- signed session-token validation and tamper rejection
- blocked origins on protected API routes
- fail-closed throttling when the shared KV store is unavailable
- rejected unexpected fields on sensitive auth requests
- timing-safe admin-secret comparison paths

Full pilot release gate:

```bash
npm run qa:release
```

Release checklist:
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

Rollback playbook:
- [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md)

## Security Notes

This is still a pilot codebase, not a finished production security architecture, but the repo now includes stronger hardening than earlier iterations.

Current hardening includes:
- hashed password storage and legacy upgrade path
- server-issued random password generation for managed account create and reset flows
- session-token-based API authorization
- timing-safe session-signature and admin-secret validation
- role-based API protection
- strict request parsing with unexpected-field rejection on shared API routes
- fail-closed rate limiting and login throttling in the shared pilot environment
- validated origin allowlists before CORS echoing
- improved SSRF guardrails around company-context fetching
- degraded-safe audit persistence so audit-store failures do not silently corrupt core auth responses
- safer escaping on admin/settings surfaces that render stored names, context, and other retained content
- central route guards
- unit, syntax, smoke, and E2E release gating

Still treat the system as pilot-grade and continue hardening before any production use.

## Change Guidance

When modifying the product:
- preserve the executive vs technical results split
- preserve role-specific dashboard semantics
- preserve progressive disclosure rather than adding persistent clutter
- prefer existing seams over inventing new subsystems
- keep visible trust, evidence, and workflow state coherent
- keep premium polish calm, not flashy
- run syntax, unit, smoke, and relevant E2E checks before pushing
