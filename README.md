# Risk Intelligence Platform

Browser-based cyber and technology risk quantification platform with AI-assisted context building, FAIR-style scenario analysis, Monte Carlo simulation, executive reporting, and role-based administration.

This repository contains the GitHub Pages frontend and the Vercel-hosted serverless API routes used by the shared demo environment.

## What It Does

- lets a global admin manage organisation structure, users, governance defaults, and scoped defaults
- lets BU and function owners maintain retained operating context
- lets users complete onboarding, maintain personal context, and run assessments
- supports AI-assisted scenario drafting, refinement, FAIR input suggestions, and evidence-grounded explanations
- runs Monte Carlo simulation for conditional event loss and annualized loss
- produces executive and technical results views with export support
- keeps shared users, settings, assessments, and audit events in backend storage

## Core Product Areas

### Admin
- organisation tree management for entities and departments/functions
- user access management for `Standard user`, `Function admin`, and `BU admin`
- platform-wide defaults and scoped defaults
- audit log and runtime health review
- company context building and refinement
- internal document library for AI retrieval and citations

### Assessment Workflow
- guided scenario builder with dry-run examples
- scenario refinement and AI assist
- plain-language estimation mode plus advanced simulation mode
- Monte Carlo simulation and results review
- before/after comparison for treatment scenarios
- export, archive, restore, and delete flows

### AI Layer
- document-grounded context build and refine
- AI-assisted scenario enhancement and FAIR input drafting
- benchmark-aware input suggestions
- evidence quality, provenance, and confidence metadata
- role-aware guidance across onboarding, dashboard, settings, and results

## Roles

### Global Admin
- manage organisation structure, users, ownership, and defaults
- review audit events and shared configuration
- maintain shared context sources

### BU Admin
- maintain BU-level context and BU-owned function context
- review and manage function activity within the BU

### Function Admin
- maintain function-level retained context
- review assessments through a function-management lens

### Standard User
- complete onboarding
- maintain personal settings/context
- create, run, compare, archive, and export assessments

## Architecture

### Frontend
Static single-page application served by GitHub Pages.

Core entry points:
- [index.html](./index.html)
- [assets/app.js](./assets/app.js)
- [assets/app.css](./assets/app.css)
- [assets/tokens.css](./assets/tokens.css)

Feature modules:
- admin: [assets/admin/](./assets/admin)
- dashboard: [assets/dashboard/](./assets/dashboard)
- results: [assets/results/](./assets/results)
- settings: [assets/settings/](./assets/settings)
- wizard: [assets/wizard/](./assets/wizard)
- engine: [assets/engine/](./assets/engine)
- services: [assets/services/](./assets/services)
- shared state: [assets/state/](./assets/state)
- UI helpers: [assets/ui/](./assets/ui)

### Backend
Serverless API routes hosted separately on Vercel.

Main routes:
- [api/compass.js](./api/compass.js)
- [api/company-context.js](./api/company-context.js)
- [api/users.js](./api/users.js)
- [api/settings.js](./api/settings.js)
- [api/user-state.js](./api/user-state.js)
- [api/audit-log.js](./api/audit-log.js)

### Persistence Model
Shared backend persistence covers:
- users and access changes
- organisation structure and retained context
- platform defaults and scoped defaults
- user settings and saved assessments
- audit events

## Assessment Flow

1. User signs in and lands on the dashboard.
2. User starts or resumes an assessment.
3. `AI-Assisted Risk & Context Builder`
4. `Refine the Scenario`
5. `Estimate the Scenario in Plain Language`
6. Monte Carlo simulation
7. Executive and technical results review
8. Export or compare a better outcome

## Local Development

Run a simple local static server from the repo root:

```bash
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

Do not open the app as `file://`.

## Environment Configuration

Do not commit real secrets, credentials, or tokens into the repository.

For local/backend setup, use:
- [.env.example](./.env.example)

That file contains placeholder values only and shows the expected configuration shape for:
- frontend origin
- Compass API access
- session signing
- shared user store connection
- bootstrap admin account seeding

## Deployment

### Frontend
- hosted on GitHub Pages
- workflow: [.github/workflows/pages.yml](./.github/workflows/pages.yml)

### Backend
- deploy the `api/` routes to Vercel
- configure environment variables and shared storage there

## QA

Core checks:

```bash
node scripts/smoke-check.js
node --check assets/app.js
```

Browser smoke suite:

```bash
npm run test:e2e:smoke
```

Current browser smoke coverage includes:
- login render and Enter-to-login flow
- unauthenticated route redirects
- authenticated dashboard render
- authenticated admin shell render
- step-1 dry-run examples
- step-1 clear-all state regression
- dashboard archive and restore flow
- admin user-access update flow

Release checklist:
- [docs/release-checklist.md](./docs/release-checklist.md)

## Security Notes

This is still a PoC and should not be treated as production-grade security architecture.

Current hardening in the codebase includes:
- backend checks preventing normal users from reading or overwriting another user’s shared state
- backend checks preventing normal users from writing shared admin settings
- role-based access anchored to managed ownership and assignment state
- generic login failure handling to avoid exposing setup details to end users
- logout clearing user-scoped cached state to reduce same-browser residue risk

## Repository Notes

This codebase has been progressively modularised from an earlier monolithic PoC.

When changing behavior now:
- prefer the extracted feature modules over adding more logic into one large route file
- keep role logic in shared state helpers where possible
- reuse shared UI helpers for repeated surfaces
- run the smoke checks before pushing UI or workflow changes
