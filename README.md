# Risk Intelligence Platform

Risk Intelligence Platform is a premium internal risk decision-support product. It is not just a calculator, not just an AI drafting tool, and not a generic dashboard app.

The product combines:
- role-based dashboards
- personal settings and role/context shaping
- AI-assisted scenario drafting and refinement
- plain-language estimation plus advanced simulation mode
- FAIR-style logic
- Monte Carlo simulation
- executive and technical results
- treatment comparison
- decision memo / board note export
- confidence, evidence, provenance, assumptions, and citation logic
- document-grounded retrieval and citations
- admin governance, defaults, org setup, user access, and document library

This repository contains:
- the GitHub Pages frontend SPA
- the Vercel-hosted serverless API routes used by the shared demo/pilot environment

## Product Thesis

The platform helps users move from a vague risk concern to a structured, challengeable, quantified management view.

It is designed to make complex risk estimation feel easier than the underlying complexity suggests by using:
- strong workflow staging
- progressive disclosure
- summary-first review surfaces
- assistant-style guidance instead of generic AI chat
- role-aware dashboards instead of generic dashboard chrome

## Current Workflow

1. Dashboard
2. Start or resume an assessment
3. `AI-Assisted Risk & Context Builder`
4. `Refine the Scenario`
5. `Estimate the Scenario`
6. `Review & Run` Monte Carlo simulation
7. Results review
   - `Executive Summary`
   - `Technical Detail`
   - `Appendix & Evidence`
8. Export, compare a better outcome, or revisit later

## Current Product Areas

### Dashboard And Work Queues
- standard-user dashboard with live work, revisit/watchlist, and workspace tools
- role-specific oversight dashboards for function admins and BU admins
- reassessment/watchlist lane driven by tolerance, confidence, evidence age, annual review, and treatment-validation signals
- clearer separation between:
  - work starts
  - attention queues
  - workspace utilities

### Wizard Flow
- `Step 1` AI-assisted risk/context builder
- `Step 2` scenario refinement and structured narrative shaping
- `Step 3` plain-language estimation plus advanced tuning
- `Review & Run` pre-simulation review gate

Recent workflow support layers include:
- Scenario Quality Coach
- Evidence Gap Action Plan
- plain-English Step 3 modeling guidance for non-technical users

### Results
- executive results surface for management interpretation
- technical detail surface for challenge and inspection
- appendix/evidence layer for methodology, citations, and reproducibility
- treatment comparison
- Evidence-Backed Parameter Challenge
- boardroom-style executive review mode
- decision memo / board note export

### Settings And Context
- personal profile snapshot
- `About me`
- `Context you own operationally`
- `How the assistant should work for me`
- autosave-first persistence model with explicit sync states

### Admin And Governance
- organisation structure
- scoped defaults
- user access management
- audit log
- company context management
- document library for retrieval/citations

## Roles

### Standard User
- start, refine, estimate, run, compare, export, and revisit assessments

### Function Admin
- review function-level work needing attention
- maintain owned function/department context
- start new assessments when appropriate
- keep function framing/defaults aligned

### BU Admin
- oversee broader business-unit assessment activity
- manage BU-owned context and review priorities
- coordinate reassessment and context quality

### Global Admin
- manage organisation structure, ownership, defaults, governance inputs, user access, and shared document sources

## Key Product Behaviors

### AI Is Assistive, Not Authoritative
The product uses AI to help draft, refine, structure, challenge, and explain. It does not hide the user’s inputs or present AI suggestions as automatically correct.

### Trust And Evidence Are First-Class
The app already tracks and surfaces:
- confidence posture
- evidence quality
- missing information
- primary grounding
- supporting references
- inferred assumptions
- citations
- provenance / input basis

Those signals are reused across the wizard, review surfaces, and results.

### Results Are Deliberately Split
- `Executive Summary` is management-grade interpretation
- `Technical Detail` is challenge-oriented inspection
- `Appendix & Evidence` is methodology, audit, and reproducibility support

### Treatment Comparison Is A Core Decision Surface
The product is designed not only to estimate current-state risk, but to compare a better-outcome treatment path and explain whether the improvement is credible enough to sponsor.

## Recent Productization Work

The current pilot branch includes several focused product-quality passes:
- role-specific dashboard hierarchy improvements
- calmer function-admin oversight workspace
- layered personal settings workspace
- dark-canvas continuity fixes
- results continuity, focus, and keyboard polish
- compact watchlist / reassessment lane
- FAQ/help page structured by product flow
- Evidence Gap Action Plan
- Scenario Quality Coach
- Evidence-Backed Parameter Challenge
- Decision Memo / Board Note Generator
- Boardroom Review Mode

Recent commit highlights:
- `637235d` Add executive boardroom review mode
- `5ebe5bf` Strengthen treatment comparison spotlight
- `11eabad` Polish results tab continuity and focus behavior
- `bdc85c7` Clarify Personal Settings autosave model
- `105f549` Extend dashboard watchlist review cues
- `43d28ff` Add scenario quality coaching
- `7e0b934` Add printable decision memo export
- `6120a93` Add evidence gap action plan
- `03a173d` Add product-flow help and FAQ page

## Architecture

### Frontend
Static single-page application served by GitHub Pages.

Core entry points:
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
- state helpers: [assets/state/](./assets/state)
- engine: [assets/engine/](./assets/engine)
- UI helpers: [assets/ui/](./assets/ui)

### Backend
Serverless API routes hosted separately on Vercel.

Primary routes:
- [api/compass.js](./api/compass.js)
- [api/company-context.js](./api/company-context.js)
- [api/users.js](./api/users.js)
- [api/settings.js](./api/settings.js)
- [api/user-state.js](./api/user-state.js)
- [api/audit-log.js](./api/audit-log.js)

### Persistence Model
Current persistence spans:
- user settings
- shared admin settings
- organisation structure and scoped defaults
- saved assessments
- user draft state and recovery state
- learning/templates
- audit events

### Main Runtime Seams
When extending the product, prefer these seams before inventing new ones:
- results rendering and interactions: [assets/results/resultsRoute.js](./assets/results/resultsRoute.js)
- app state, shared builders, and helpers: [assets/app.js](./assets/app.js)
- AI/service integration: [assets/services/llmService.js](./assets/services/llmService.js)
- export/report generation: [assets/services/exportService.js](./assets/services/exportService.js)
- report language builders: [assets/services/reportPresentation.js](./assets/services/reportPresentation.js)
- quant engine: [assets/engine/riskEngine.js](./assets/engine/riskEngine.js)
- dashboard IA and actions: [assets/dashboard/userDashboard.js](./assets/dashboard/userDashboard.js)
- step modules: [assets/wizard/step1.js](./assets/wizard/step1.js), [assets/wizard/step2.js](./assets/wizard/step2.js), [assets/wizard/step3.js](./assets/wizard/step3.js)

## Notable Shared Builders And Patterns

The product now has several shared builders intended to reduce drift:
- trust/readiness builders in [assets/app.js](./assets/app.js)
- results presentation block helpers in [assets/ui/components.js](./assets/ui/components.js)
- report framing builders in [assets/services/reportPresentation.js](./assets/services/reportPresentation.js)

Examples:
- evidence/trust summary
- review readiness
- quant readiness
- result trust basis
- evidence gap planning
- scenario quality coach
- parameter challenge entries

## Local Development

Preferred local Node version:

```bash
nvm use
```

Pinned in:
- [.nvmrc](./.nvmrc)
- [.node-version](./.node-version)
- [package.json](./package.json)

Run a simple local static server from the repo root:

```bash
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

Do not use `file://`.

## Environment Configuration

Do not commit real secrets, credentials, or tokens.

Use:
- [.env.example](./.env.example)

That file shows the expected configuration shape for:
- frontend origin
- Compass API access
- session signing
- shared user store connection
- bootstrap admin account seeding

## Deployment

### Frontend
- GitHub Pages
- workflow: [.github/workflows/pages.yml](./.github/workflows/pages.yml)

### Backend
- deploy `api/` routes to Vercel
- configure shared storage and env vars there
- use [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md) for rollback steps

## Pilot Seed Data

Sample seed/reference data:
- [data/pilot-seed/bootstrap-accounts.sample.json](./data/pilot-seed/bootstrap-accounts.sample.json)
- [data/pilot-seed/demo-assessments.sample.json](./data/pilot-seed/demo-assessments.sample.json)
- [data/pilot-seed/demo-user-state.sample.json](./data/pilot-seed/demo-user-state.sample.json)

Suggested usage:
- copy bootstrap accounts JSON into `BOOTSTRAP_ACCOUNTS_JSON` for non-production pilot seeding
- import sample assessments through dashboard import
- use the sample user-state file as a reference shape, not a production migration artifact

## QA

Core checks:

```bash
npm run check:syntax
npm run check:smoke
```

Browser smoke suite:

```bash
npm run test:e2e:smoke
```

Current smoke coverage includes:
- login and auth redirects
- dashboard render
- admin shell render
- wizard step 1 sample flow
- draft recovery
- archive/duplicate dashboard flows
- help page render
- admin user-access update flow

Release checklist:
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

Rollback playbook:
- [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md)

## Security Notes

This remains a pilot/PoC codebase and should not be treated as production-grade security architecture.

Current hardening includes:
- role-based access anchored to managed ownership and assignment state
- backend checks for shared admin settings writes
- backend checks for user-state isolation
- logout clearing user-scoped local state
- generic login failure handling

## Change Guidance

When modifying the product:
- preserve one dominant task per screen or band
- prefer progressive disclosure over permanent support clutter
- preserve role-specific dashboard semantics
- preserve the executive vs technical results split
- avoid adding heavy top-level navigation or analytics sprawl
- reuse existing seams before inventing new subsystems
- run syntax, smoke, and relevant e2e checks before pushing
