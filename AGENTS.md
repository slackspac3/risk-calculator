# AGENTS.md

## How To Use This File

- Read this once before changing any feature area.
- Use it to locate the owning module before you open files.
- Treat it as the repo-level guardrail for UX, discoverability, persistence, role behavior, and testing.
- Then read the local seam you are changing. This file does not replace code inspection.
- If this file and the live code appear to conflict, trust the live code and update this document in the same change.

## Change Approval Policy

- Ask for approval before hiding, moving, collapsing, demoting, regrouping, or relabeling any visible user-facing control, action, section, or workflow step.
- Do not silently reduce discoverability.
- Do not flatten role-specific behavior into generic behavior without approval.
- Do not change focus, scroll, sticky-footer, or route continuity casually.
- If a change affects navigation, results tabs, export actions, Step 1 pathing, admin entry points, or settings IA, treat it as approval-sensitive by default.

## 1. Product Purpose And Current Scope

### What this product is
- A role-aware, AI-assisted enterprise risk assessment SPA for pilot use.
- It guides a user from scenario framing through FAIR-style estimation, Monte Carlo simulation, review, and decision-ready results.
- It includes separate user and admin workspaces, shared settings/state sync, document-grounded AI assistance, export surfaces, and an evaluation harness for AI quality.

### What this product is not
- Not a generic SaaS CRUD app.
- Not a pure reporting dashboard.
- Not a production identity system yet. `assets/services/authService.js` is still pilot auth and explicitly carries Entra replacement markers.
- Not a collaborative workflow engine with multi-user live editing.
- Not a generic LLM playground. AI is embedded inside a governed assessment workflow.

### Target users
- Standard users doing guided or draft-led assessments.
- Function admins reviewing and shaping function-owned work.
- BU admins reviewing business-unit posture, reassessment lanes, and board-level summaries.
- Global admins managing structure, defaults, users, documents, and platform posture from a separate admin front door.

### Current maturity / pilot posture
- Release stamp in code: `0.10.0-pilot.1`.
- The UI and copy repeatedly position the product as pilot decision support.
- Security, auth, and some export/integration seams are intentionally marked as pilot or integration placeholders.
- Preserve the current posture: polished and decision-ready, but honest about pilot limitations.

## 2. End-To-End Workflow

### Dashboard / workspace
- Non-admin default route is `#/dashboard`; admin default route is `#/admin/home`.
- The non-admin dashboard is a working front door, not just a list of saved items.
- Key intents already in code:
  - start a new scenario
  - upload a register
  - use a sample/template
  - resume a live draft
  - open results needing attention
  - revisit saved work via a compact reassessment lane
- The dashboard also includes watchlist/reassessment logic, confidence trajectory signals, archived items, duplicate helpers, and board brief entry points where role-appropriate.

### Start / resume
- Draft state is auto-saved and recoverable.
- Dashboard actions can start guided assessment, register-first assessment, sample assessment, or template-based work.
- Admins can also open the user workspace in preview mode from `assets/admin/adminHomeSection.js`.

### Step 1: AI-Assisted Risk & Context Builder
- Owned by `assets/wizard/step1.js` with AI helpers in `assets/wizard/step1Assist.js`.
- Current composition is intentional:
  1. assessment context card
  2. path selector
  3. path-specific content
  4. scope section only when candidates exist
  5. selected-risks summary
  6. sticky continue footer
- Step 1 paths are:
  - `guided`
  - `draft`
  - `import`
- The path switcher is stateful and clears only path-specific fields when changing lanes.
- Examples, dry runs, register ingestion, prompt suggestions, regulations, and shortlist generation already exist. Reuse these seams before adding new ones.

### Step 2: Refine the Scenario
- Owned by `assets/wizard/step2.js`.
- This is the narrative-tightening step, not another broad support wall.
- Existing secondary layers already present:
  - AI narrative refinement
  - AI trace / “why this”
  - narrative diff
  - scenario quality coach
  - evidence gap plan
  - input provenance and citations
- Material rewrites intentionally invalidate stale AI trust/state. Do not reintroduce stale scenario identity, confidence, or evidence carry-over.

### Step 3: Enter the core estimate
- Owned by `assets/wizard/step3.js`.
- This is the FAIR-style tuning step, with plain-language guidance over the model.
- Existing features include:
  - smart prefill
  - prior-user learning signals
  - estimate presets
  - advanced mode for direct exposure / secondary loss / tuning
  - treatment-improvement lane for better-outcome variants
- Most users should be able to stay in the main estimate path without opening all advanced disclosures.

### Step 4: Review & Run
- `renderWizard4()` lives in `assets/wizard/step4.js`.
- This step is a pre-run review surface, not a second results page.
- It includes:
  - pre-run validation rail
  - trust summary
  - quality coach
  - evidence-gap plan
  - challenge-first guidance
  - source audit
  - parameter explanation
  - run progress / cancellation
- Changes here can easily affect the results lifecycle. Treat this as a hotspot.

### Results
- Owned mainly by `assets/results/resultsRoute.js` and `assets/results/resultsViewModel.js`.
- Results are audience-split into:
  - executive
  - technical
  - appendix
- Boardroom mode compresses the executive layer into a more presentation-ready management read.
- Results already support:
  - lifecycle guidance
  - confidence and evidence framing
  - treatment comparison
  - challenge/reviewer brief seams
  - appendix/evidence surfaces
  - per-user tab persistence
  - per-assessment boardroom mode persistence

### Compare / export / revisit
- Saved assessments can become baselines, treatment variants, archived records, reassessment candidates, and board-brief inputs.
- Export/report logic already exists for:
  - JSON
  - print/PDF
  - decision memo
  - board note
  - PPTX JSON spec
- Revisit flows already exist on the dashboard and results surfaces. Extend those seams instead of inventing parallel revisit concepts.

## 3. Roles And Role-Specific Behavior

### Standard user
- Lands in `#/dashboard`.
- Sees personal dashboard and personal settings.
- Results copy is phrased as “what this means for you”.
- Uses executive results first; deeper technical detail is secondary.

### Function admin
- Still uses the non-admin workspace, but with oversight semantics.
- Dashboard prioritises function attention and review.
- Settings become more like role context than generic personal profile.
- Results framing shifts to function-owned review and validation.

### BU admin
- Uses non-admin workspace with business-unit oversight semantics.
- Dashboard emphasises attention queue, review, reassessment lane, and board brief.
- Results framing shifts to BU management action and escalation.

### Global admin
- Default route is `#/admin/home`.
- Admin front door is intentionally separate from the admin console.
- Must not be dropped straight into settings by default.
- Can open user workspace preview, then return to admin console.

### Preserve role semantics
- Role differences are not cosmetic.
- Dashboard copy, navigation labels, settings framing, and results guidance all change by role.
- Do not flatten role behavior into one generic experience.

## 4. Real Architecture And File Ownership

### App shell and routing
- `assets/router.js`: low-level hash router with simple pattern matching and route metadata.
- `assets/appRoutes.js`: actual route table. Change routes here, not in the router core.
- `assets/app.js`: monolithic shell and shared runtime glue. It still owns large amounts of cross-cutting behavior.
- `assets/ui/appShellNavigation.js`: top app bar, role-aware primary navigation, notifications, currency toggle.
- `assets/services/authGuards.js`: auth/admin route protection wrappers.

### Dashboard
- `assets/dashboard/userDashboard.js`: non-admin workspace, start paths, active queue, reassessment lane, watchlist, archive helpers, duplicate flows, board brief gating.
- `assets/admin/adminHomeSection.js`: admin front door, not the detailed console.

### Settings
- `assets/settings/userPreferences.js`: layered user settings IA.
- `assets/settings/userOnboarding.js`: first-run onboarding.
- Admin settings are rendered through admin sections and `safeRenderAdminSettings(...)` wiring in `assets/app.js`.

### Wizard steps
- `assets/wizard/step1.js`: context, path selection, shortlist creation.
- `assets/wizard/step1Assist.js`: Step 1 AI assist, RAG checks, AI trace links.
- `assets/wizard/step2.js`: narrative refinement, trust, quality coach, evidence plan.
- `assets/wizard/step3.js`: FAIR parameter entry, smart prefill, advanced mode, treatment lane.
- Review & Run lives in `assets/results/resultsRoute.js`.

### Results
- `assets/results/resultsRoute.js`: Review & Run, results route, tab switching, boardroom mode, comparison, challenge/reviewer actions, exports.
- `assets/results/resultsViewModel.js`: role-aware results render model and normalization.
- `assets/services/reportPresentation.js`: executive/editorial wording and decision framing.

### Engine
- `assets/engine/riskEngine.js`: FAIR-based Monte Carlo engine and validation.

### Export and report logic
- `assets/services/exportService.js`: JSON, print/PDF, decision memo, board note, PPTX JSON spec.
- `assets/services/reportPresentation.js`: editorial language layer used by results and exports.

### AI / intelligence services
- `assets/services/llmService.js`: live + stub AI service, guardrails, retries, traces, structured-response handling, coherence logic.
- `assets/services/ragService.js`: local hybrid retrieval over document library plus BU/doc context.
- `assets/services/orgIntelligenceService.js`: cross-team drift and other org intelligence seams.

### Admin workbenches
- Under `assets/admin/`.
- Key modules include:
  - `adminHomeSection.js`
  - `documentLibrarySection.js`
  - `userAccountsSection.js`
  - org/defaults/governance/access/audit sections rendered through admin settings routing

### Persistence / shared-state seams
- `assets/state/userWorkspacePersistence.js`: schema normalization for user workspace state.
- Shared sync logic lives mainly in `assets/app.js`.
- Additional assessment, lifecycle, learning, and draft logic lives under `assets/state/`.

### Tests and evaluation
- `tests/e2e/smoke.spec.js`: route/auth/discoverability smoke coverage and living workflow spec.
- `tests/unit/`: unit coverage including eval harness tests.
- `scripts/run-eval-local.js`: deterministic benchmark run over fixture set.
- `scripts/run-eval-ai.js`: AI semantic judge over eval report.
- `scripts/harvest-eval-growth-candidates.js`: harvest real user interaction signals into future eval candidates.
- `tests/fixtures/eval/g42_eval_master_repaired.jsonl`: curated G42-relevant eval dataset.

## 5. Established UX / Product Principles

- One dominant task per screen or band.
- Progressive disclosure over flat density.
- Concise modules with strong reading order.
- Keep the top-level calm; open deeper detail only when needed.
- Role-true dashboards instead of one-size-fits-all landing pages.
- Results are editorial decision surfaces, not raw number dumps.
- Technical detail exists, but must stay one level below the management read.
- The product already moved away from cluttered card stacks and giant support walls. Do not drift back.
- Avoid document-like always-expanded states that bury the main task.
- Avoid generic SaaS drift in wording, layout, or interaction patterns.
- Preserve continuity: the same scenario should feel like one journey from dashboard to results, not disconnected tools.

## 6. UI Change Safety Rules

### Explicit approval required
- Before hiding, moving, collapsing, demoting, regrouping, or relabeling any visible button, action, control, section, or function, ask for approval first.
- This includes dashboard utilities, wizard actions, results tabs, export actions, admin entry points, settings sections, and help/disclosure affordances.

### Discoverability must not silently shrink
- Do not reduce discoverability without explicit approval.
- Do not “simplify” by burying important actions in extra disclosures or overflow menus unless asked.
- Do not change role-specific labels into generic ones if that weakens orientation.

### Preserve continuity
- Preserve current focus and scroll continuity when rerendering screens with active work.
- Preserve current sticky/footer patterns, especially Step 1 and results tab behavior.
- Preserve the current route-level mental model: users should not lose their place because of a cosmetic refactor.

## 7. Persistence, Sync, And Trust Model

### Shared user state
- The user workspace is schema-normalized in `assets/state/userWorkspacePersistence.js`.
- Current sections include:
  - `userSettings`
  - `learningStore`
  - `draftWorkspace`
  - `savedAssessments`
- `_meta.revision` and shared patching are part of the current trust model.

### Autosave and sync
- Shared user-state syncing is debounced and patch-based in `assets/app.js`.
- Conflicts are handled explicitly with user-facing recovery actions. Do not remove or bypass conflict handling.
- Drafts and settings are expected to auto-save. This is part of user trust and already visible in the UI.

### Local + session persistence already in use
- `localStorage` is used as cache/persistence for user/admin state, drafts, learning memory, and some auth/session-adjacent pilot behavior.
- `sessionStorage` is used for session-specific UI state such as results tab persistence, boardroom mode per assessment, AI trace, and one-time warnings.

### Recovery trust
- Draft recovery after refresh is already smoke-tested.
- Results tab persistence and boardroom-mode persistence are already implemented.
- Logout clears relevant session-only state.
- Do not break:
  - stale draft recovery
  - results tab/session behavior
  - boardroom mode persistence
  - sync-state indicators
  - conflict dialogs

### AI trust signals
- Confidence labels, evidence quality, AI traces, citations, and fallback warnings are already part of the product.
- AI may run with live model or stub fallback. Surfaces already reflect that. Preserve this honesty.

## 8. Modeling And Simulation Semantics

### Underlying model
- `assets/engine/riskEngine.js` is a FAIR-style Monte Carlo engine.
- It supports:
  - triangular and lognormal distributions
  - seeded PRNG (`mulberry32`)
  - compound Poisson annualized loss behavior
  - correlation between selected loss components
  - optional secondary loss
  - direct or derived vulnerability

### Core semantic inputs
- Threat event frequency (`tef*`) is annual frequency.
- Threat capability and control strength are modeled on 0–1 scales.
- Vulnerability can be:
  - derived from threat capability vs control strength
  - entered directly in advanced mode
- Loss magnitude is entered per event across multiple loss rows.

### Loss model in practice
- Current loss rows include:
  - incident response / recovery
  - business interruption
  - data remediation
  - regulatory / legal
  - third-party impact
  - reputation / contract
- Secondary loss is optional and advanced.

### Correlation and thresholds
- Correlated pairs already modeled include:
  - business interruption vs incident response
  - regulatory vs reputation
- Warning, tolerance, and annual review thresholds are distinct.

### Iterations and seeded behavior
- Iteration bounds and warnings are enforced by the engine.
- Results should stay reproducible enough for peer review and explanation.
- The UI uses plain English, but the underlying logic is still a formal modeled estimate. Preserve both layers.

## 9. Existing Intelligence / Explanation Layers

Do not reinvent these. They already exist.

### Help / FAQ
- `#/help` is a real route and is covered by smoke tests.

### Quality coach and evidence-gap planning
- Present in Step 2, Step 4, and results surfaces.
- Reuse `buildScenarioQualityCoach(...)` and `buildEvidenceGapActionPlan(...)` rather than cloning new versions.

### Trust / confidence / provenance
- Already present in Step 2, Review & Run, results, exports, and AI traces.
- Confidence labels, evidence quality, primary grounding, supporting references, inferred assumptions, and input provenance are already part of the workflow.

### Parameter challenge / assumption explanation
- Pre-run and technical results surfaces already include assumption explanation and challenge layers.
- Results also include reviewer brief and challenge generation seams.

### Watchlist / reassessment lane
- Already present on the dashboard.
- Confidence trajectory and revisit logic already exist.

### Decision memo / board note / board brief seams
- Results and dashboard already support decision memo, board note, board-brief generation, and boardroom mode.
- Preserve the distinction between:
  - assessment-level board/document exports
  - portfolio/board brief flows

### Boardroom / presentation mode
- Already exists in results and is persisted by assessment in-session.
- This is a key product differentiator. Do not collapse it into a generic “fullscreen” or “presentation” toggle.

### AI evaluation and growth loop
- The repo now includes:
  - deterministic eval fixture/harness
  - AI semantic judge
  - harvested real-user candidate growth flow
- Do not replace this with static-only or AI-only evaluation. Both are currently intended.

## Current Unresolved Risks / Sensitive Areas

- `assets/app.js` is still a monolithic coordination layer.
  - Shared sync, admin settings glue, initialization, and older cross-cutting helpers still live here.
- `assets/results/resultsRoute.js` owns both Review & Run and Results.
  - Small edits can create regressions across pre-run review, saved-result lifecycle, and results rendering.
- Pilot auth is still local/session oriented.
  - `assets/services/authService.js` explicitly signals future Entra replacement.
- AI quality remains a sensitive product area.
  - `assets/services/llmService.js` already contains coherence, fallback, retry, and structured-response handling.
  - Changes here should be benchmarked, not judged by spot feel alone.
- RAG readiness and document-library grounding are intentionally non-blocking.
  - AI can still run without citations; the product surfaces warnings rather than hard-failing.
- Shared-state trust is sensitive.
  - Draft recovery, conflict handling, session-persisted results state, and autosave cues are already part of user trust.
- The curated eval fixture is a `v1` benchmark, not the only source of truth.
  - Keep the deterministic fixture, AI judge, and harvested growth-candidate flow working together.

## 10. Code Hotspots, Safe Change Workflow, And Testing Discipline

### Densest / most fragile files
- `assets/app.js`
  - Monolithic shell, sync, admin settings wiring, shared utilities, initialization.
- `assets/results/resultsRoute.js`
  - Owns both Review & Run and the main results route.
- `assets/services/llmService.js`
  - Structured AI responses, retries, fallback, traces, and coherence logic.
- `assets/wizard/step1.js`
  - High discoverability surface with path-specific composition and many bindings.
- `assets/dashboard/userDashboard.js`
  - Role-aware front door plus board brief/watchlist/archive/duplicate/reassessment logic.

### Why they are risky
- They mix rendering, state mutation, and cross-module coordination.
- Small regressions here often appear as discoverability loss, stale state, broken persistence, or role drift rather than obvious crashes.

### Safe change workflow
1. Inspect the live seam first. Search for an existing helper before adding a new one.
2. Check whether the behavior is smoke-tested already.
3. Confirm whether the change affects discoverability, role semantics, persistence, or results wording.
4. Make the smallest viable change that extends current seams.
5. Run the relevant test set.
6. Visually sanity-check affected routes if the UI changed.

### What to inspect before changing something
- Dashboard changes:
  - `assets/dashboard/userDashboard.js`
  - `assets/admin/adminHomeSection.js`
  - `tests/e2e/smoke.spec.js`
- Wizard changes:
  - affected step file
  - `assets/wizard/step1Assist.js` or `assets/services/llmService.js` if AI is involved
  - persistence/state helpers under `assets/state/`
- Results changes:
  - `assets/results/resultsRoute.js`
  - `assets/results/resultsViewModel.js`
  - `assets/services/reportPresentation.js`
  - `assets/services/exportService.js`
- Settings/admin changes:
  - `assets/settings/userPreferences.js`
  - relevant admin section under `assets/admin/`
  - auth guard and route behavior if navigation changes

### Minimum test discipline
- Always run `npm run check:syntax`.
- Run `npm run check:smoke` for workflow-affecting UI/state changes.
- Run `npm run test:unit` when touching shared logic, evaluation scripts, or normalization/model helpers.
- Run `npm run test:e2e:smoke` for route/auth/discoverability-sensitive changes.
- Use:
  - `npm run test:eval:fixture`
  - `npm run eval:local`
  - `npm run eval:ai`
  when changing AI classification/coherence behavior.

### Flows that require visual / interaction verification
- login and role landing route
- dashboard start paths and attention lanes
- Step 1 path selector and sticky continue footer
- Step 2 narrative refinement and AI trace / diff
- Step 3 smart prefill, advanced mode, and treatment lane
- Review & Run progress / cancellation
- results tab switching, boardroom mode, comparison, and export buttons
- admin home front door and admin console navigation

## Definition Of Done For Future Changes

- The change uses an existing seam where possible instead of introducing duplicate logic.
- Role semantics still hold for standard user, function admin, BU admin, and global admin.
- Discoverability did not shrink without explicit approval.
- Draft autosave, shared sync, and recovery behavior still work.
- Any touched AI flow still preserves trust cues:
  - confidence
  - evidence/provenance
  - fallback honesty
  - citations/warnings where applicable
- Any touched results flow still preserves:
  - executive-first reading order
  - technical/app appendix separation
  - boardroom/export intent
- Relevant tests were run for the change scope.
- If the change altered real workflow, ownership, or boundaries, `AGENTS.md` was updated too.

## 11. Design System / Visual Intent

- The current visual system is intentionally premium and dark-surface, with layered gradients and restrained motion.
- Typography is deliberate:
  - display: `Syne`
  - body: `DM Sans`
  - mono: `JetBrains Mono`
- “Premium” in this repo means:
  - calm top-level layouts
  - purposeful type hierarchy
  - editorial reading order
  - elevated but restrained surfaces
  - motion that supports orientation, not novelty
- Do not regress visually into:
  - flat white enterprise CRUD
  - purple default SaaS styling
  - giant busy card stacks
  - document-like pages with everything expanded at once

## 12. Dashboard Semantics

- The dashboard is a working front door.
- It currently combines:
  - start paths
  - current attention
  - recent work
  - reassessment lane
  - archive / duplicate helpers
  - board-brief entry point where justified
- For oversight users, it becomes a workspace with review and revisit intent, not just “my items”.
- The watchlist lane is intentionally secondary to the active queue.
- Board brief must only appear when visible completed assessments justify it.

## 13. Settings IA Intent

- User settings are intentionally layered, not flat.
- Current sections in `assets/settings/userPreferences.js`:
  - Profile And Role Context
  - Working View And Output Style
  - Core Defaults And AI Notes
  - AI Personalization Workspace
  - Personal Company Context
- Do not flatten these into one long general settings form.
- Keep role/focus/context high; deeper AI and company-context tuning lower.
- Admin structure/default/access editing belongs in admin console, not personal settings.

## 14. Results Surface Intent

- Executive tab is the primary management surface.
- Technical tab is for challenge, peer review, and evidence validation.
- Appendix is for methodology, auditability, evidence, and supporting detail.
- Boardroom mode is a compression of the executive surface for presentation, not a replacement for the normal results page.
- Treatment comparison should stay decision-oriented, not just numerical delta reporting.
- Export surfaces should preserve the distinction between:
  - executive decision artifact
  - board note / memo
  - appendix / evidence

## 15. Reuse-Before-Build Guidance

- Before building a new subsystem, search for:
  - existing render helpers
  - disclosure helpers
  - report-presentation helpers
  - export model builders
  - state normalizers
  - AI trace / provenance / confidence helpers
  - dashboard intelligence builders
- Common reuse seams already present:
  - `ReportPresentation`
  - `ExportService`
  - `RAGService`
  - `LLMService`
  - scenario quality / evidence-gap builders
  - assessment lifecycle helpers
  - org intelligence helpers
  - evaluation harness scripts
- If a behavior already exists in one surface, extend it before duplicating it elsewhere.

## 16. Anti-Patterns / Things Not To Do

- Do not add new top-level complexity casually.
- Do not solve clarity problems by hiding functionality without approval.
- Do not make dense screens denser.
- Do not reintroduce giant support walls in the wizard.
- Do not turn results into a raw metrics dump.
- Do not flatten role-specific behavior into generic copy.
- Do not bypass shared-state normalization or sync queues with ad hoc storage writes.
- Do not silently break draft recovery, sync-state indicators, or session-persisted results behavior.
- Do not rebuild a feature that already exists in another module under a different name.
- Do not claim production-grade identity, governance, or explainability that the current code does not actually implement.

## 17. Practical Starting Points For Future Agents

### If you need to change…
- **Landing/navigation:** start with `assets/appRoutes.js`, `assets/router.js`, `assets/ui/appShellNavigation.js`.
- **Dashboard behavior:** start with `assets/dashboard/userDashboard.js`.
- **Personal settings:** start with `assets/settings/userPreferences.js`.
- **Step 1:** start with `assets/wizard/step1.js` and `assets/wizard/step1Assist.js`.
- **Step 2:** start with `assets/wizard/step2.js`.
- **Step 3:** start with `assets/wizard/step3.js`.
- **Review & Run / Results:** start with `assets/results/resultsRoute.js` and `assets/results/resultsViewModel.js`.
- **Simulation semantics:** start with `assets/engine/riskEngine.js`.
- **Exports:** start with `assets/services/exportService.js` and `assets/services/reportPresentation.js`.
- **Admin:** start with the specific `assets/admin/*.js` section that owns the screen.
- **Persistence/sync:** start with `assets/state/userWorkspacePersistence.js` and the sync logic in `assets/app.js`.
- **AI quality/coherence:** start with `assets/services/llmService.js`, `assets/services/ragService.js`, and the eval scripts under `scripts/`.

Use this file as a guardrail, not a substitute for reading the local seam you are changing.
