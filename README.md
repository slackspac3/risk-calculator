# Risk Intelligence Platform

Risk Intelligence Platform is an internal enterprise risk decision-support product. It combines guided scenario building, AI-assisted structuring, FAIR-style quant logic, Monte Carlo simulation, evidence-grounded retrieval, and executive-grade reporting in one role-aware workflow.

This repository contains:
- the GitHub Pages frontend SPA
- the Vercel-hosted serverless API routes used by the shared pilot environment

## What The Product Does

The platform helps a user move from a vague issue to a structured, challengeable, quantified management view.

Core capabilities:
- role-based dashboards for standard users, function admins, BU admins, and global admins
- AI-assisted risk and context builder
- scenario refinement and structured scenario shaping
- plain-language estimation and advanced tuning
- FAIR-style Monte Carlo simulation
- executive, technical, and appendix result views
- treatment comparison and better-outcome analysis
- direct PDF export plus printable decision memo / board note outputs
- evidence, provenance, assumptions, confidence, and citation surfacing
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
- submitted items are stored in the shared review queue API
- admins and BU admins can view the review queue from Platform Home
- reviewers can approve, request changes, or escalate
- results surfaces now reflect:
  - pending
  - approved
  - changes requested
  - escalated

Pilot note:
- the queue is backed by shared KV
- notifications are currently local/browser-scoped for the pilot

## AI And Grounding Model

The product is assistant-driven, not chat-first. AI is used to:
- improve and structure scenario drafts
- refine narratives
- generate challenge prompts
- suggest likely risk groupings
- build evidence-backed interpretation

Current AI behavior:
- wizard steps can carry short-term LLM context memory across the draft flow
- bounded AI rewriting is used where draft quality matters
- explicit fallback and unavailable states are surfaced instead of silently masquerading as live AI
- retrieval uses a stronger local hybrid scorer with lens-aware and concept-aware matching
- supporting documents and standards are cited into the workflow and results

The product is grounded by a growing enterprise corpus that includes ISO, NIST, COSO, IFRS/ESRS, OECD, UNGP, sector guidance, and UAE/GCC-relevant references.

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

Export options currently include:
- JSON export
- printable HTML/PDF-style report flow
- direct jsPDF download
- decision memo
- board note
- PPTX spec export stub

## Product Quality Highlights

Current productization work now includes:
- premium UI polish across dashboard, wizard, results, settings, admin, and document library
- committed Step 1 start modes for guided, draft, and import/example paths instead of a single long scroll
- scenario memory, overlap checks, and learnt starting points in Step 1 so new assessments can reuse prior organisational precedent
- stronger AI quality and coherence signaling
- role-aware examples and focus areas
- broader enterprise taxonomy and standards coverage
- review queue and management decision workflow
- reviewer brief, challenge mediation, challenge synthesis, and consensus recommendation flows in results
- living risk register, AI flags, correlation spotting, and board brief generation on role-aware dashboards
- watchlist confidence trajectory signals so reassessment queues show whether confidence is improving, declining, or flat
- direct PDF download
- worker-based Monte Carlo execution so simulation no longer blocks the UI thread
- streaming AI narrative refinement in Step 2
- portfolio heat map on the dashboard
- persisted session preferences for results tabs and boardroom mode
- synced learning-store state across browser cache and shared user-state storage
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
- export generation: [assets/services/exportService.js](./assets/services/exportService.js)
- quant engine: [assets/engine/riskEngine.js](./assets/engine/riskEngine.js)
- worker simulation path: [assets/engine/riskEngineWorker.js](./assets/engine/riskEngineWorker.js)

### Backend

Serverless API routes hosted on Vercel.

Primary routes:
- [api/compass.js](./api/compass.js)
- [api/company-context.js](./api/company-context.js)
- [api/users.js](./api/users.js)
- [api/settings.js](./api/settings.js)
- [api/user-state.js](./api/user-state.js)
- [api/review-queue.js](./api/review-queue.js)
- [api/audit-log.js](./api/audit-log.js)

Shared backend helper:
- [api/_kvStore.js](./api/_kvStore.js)

### Persistence Model

Current persistence spans:
- saved assessments
- draft state and draft recovery
- personal user state
- shared admin settings
- organisation structure and scoped defaults
- learning patterns / templates
- AI interaction memory and acceptance signals
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
- Compass API access
- session signing
- shared KV/user store access
- bootstrap admin/account seeding

## Deployment

### Frontend
- GitHub Pages
- workflow: [.github/workflows/pages.yml](./.github/workflows/pages.yml)

### Backend
- deploy `api/` routes to Vercel
- configure KV and secrets there
- use [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md) for rollback steps

## Pilot Seed Data

Sample pilot seed/reference data:
- [data/pilot-seed/bootstrap-accounts.sample.json](./data/pilot-seed/bootstrap-accounts.sample.json)
- [data/pilot-seed/demo-assessments.sample.json](./data/pilot-seed/demo-assessments.sample.json)
- [data/pilot-seed/demo-user-state.sample.json](./data/pilot-seed/demo-user-state.sample.json)

Suggested usage:
- copy bootstrap accounts JSON into `BOOTSTRAP_ACCOUNTS_JSON` for pilot seeding
- import sample assessments through the dashboard when needed
- treat the sample user-state file as a reference shape, not a migration script

## QA

Core checks:

```bash
npm run check:syntax
npm run test:unit
npm run check:smoke
npm run test:e2e:smoke
```

Full pilot release gate:

```bash
npm run release:pilot
```

Release checklist:
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

Rollback playbook:
- [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md)

## Security Notes

This is still a pilot codebase, not a finished production security architecture, but the repo now includes stronger hardening than earlier iterations.

Current hardening includes:
- hashed password storage and legacy upgrade path
- session-token-based API authorization
- role-based API protection
- improved SSRF guardrails around company-context fetching
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
