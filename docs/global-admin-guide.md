# Global Admin Guide

Use this guide if you are the platform owner for the shared pilot environment.

This role is different from the standard assessment workflow. A global admin is responsible for the platform baseline that everyone else inherits:
- organisation structure
- company and operating context
- platform defaults
- system access and pilot AI readiness
- shared documents and grounding coverage
- user access
- shared AI feedback and tuning policy

## What this role is for

Use the global-admin workbench to keep the platform credible for everyone else.

Good use of this role:
- verify the live AI path before demos, pilot reviews, and sign-off sessions
- keep the document library and company context current
- keep jurisdiction-specific baseline context current where it materially shapes drafting and retrieval
- watch shared AI feedback quality before changing tuning
- manage access, defaults, and inherited operating context
- use preview and oversight to understand downstream impact

What not to do:
- do not use the admin console as your normal assessment workspace
- do not treat one bad draft as a reason to retune the whole platform
- do not let local fallback output be mistaken for pilot-quality live AI

## Core admin surfaces

- `#/admin/home`
  - platform front door
  - use this first to decide what needs attention
- `#/admin/settings/access`
  - system access and pilot AI readiness
  - verify the live path in the current browser session before AI-quality-dependent activity
- `#/admin/settings/audit`
  - retained audit log
  - AI request failures now surface the failure stage and prompt-truncation status directly in the main row summary, without opening details first
- `#/admin/settings/feedback`
  - AI Feedback & Tuning
  - review draft, shortlist, and per-risk signal before changing shared tuning
- `#/admin/settings/company`
  - company context and inherited platform baseline
- `#/admin/settings/defaults`
  - platform defaults that shape downstream drafting and review
- `#/admin/settings/users`
  - user access, BU assignment, and function assignment
- `#/admin/docs`
  - document library and grounding coverage
- `#/help`
  - role-aware help page for the current signed-in user

Current baseline areas that deserve explicit review:
- UAE company baselines that should not collapse into one generic label
- ADGM holding-company obligations where they genuinely apply
- continuity and disaster-recovery references such as NCEMA, not only ISO continuity guidance
- official public source links and age labels for citeable documents

## Suggested operating rhythm

### Before a demo, review, or sign-off session
- Open `System Access` at `#/admin/settings/access`.
- Confirm the active runtime is live AI in the current browser session.
- If the session is in local fallback, do not treat the AI output as pilot-quality sign-off material.
- If an admin context action failed earlier in the session, inspect `Compass failure diagnostics` there as well. It now shows prompt footprint, truncation status, response preview, and attempt history for the browser session.

### Weekly admin quality review
- Open `AI Feedback & Tuning`.
- Check:
  - live-AI share
  - draft quality
  - shortlist quality
  - per-risk quality
  - top review issues
  - lens / function / BU concentration
- Ask:
  - is the weak pattern repeated?
  - is it coming from live AI, not fallback?
  - is it concentrated in one BU/function or broad enough to matter platform-wide?

### Before changing shared AI tuning
- Check company context and document coverage first.
- Confirm the issue is not caused by stale defaults, weak grounding, or bad user inputs.
- If BU or function admins are saving context with `Generic draft warning`, fix the inherited context or document coverage before retuning model behavior.
- If the issue looks domain-specific, run the affected eval slice and check retrieval precision / recall / F1 as well as primary-lens accuracy before changing shared tuning.
- Change one parameter at a time:
  - alignment priority
  - draft style
  - shortlist discipline
  - learning sensitivity
- Save, review downstream impact, and avoid multiple simultaneous tuning changes.

## How to use AI Feedback & Tuning well

Use the dashboard to decide whether feedback should stay local or influence the shared platform baseline.

What to look at:
- `Feedback events`
  - overall signal volume
- `Live AI share`
  - whether the signal is strong enough to trust for shared tuning
- `Draft quality`, `Shortlist quality`, `Per-risk quality`
  - where the problem is actually showing up
- `Top review issues`
  - whether the issue is wrong-domain drift, generic writing, missed risks, unrelated risks, weak citations, or something else
- shared-learning thresholds
  - whether the signal is strong enough to promote beyond one user
- grounding signals in BU and function context builders
  - whether the system is telling users that the saved context is actually showing up in the draft

Good tuning discipline:
- use `strict` alignment when the platform is drifting into adjacent lenses too often
- use `executive-brief` draft style when drafts are too generic or too long
- use `strict` shortlist discipline when off-path risks are surviving too easily
- use `balanced` or `conservative` learning sensitivity unless there is strong repeated live-AI evidence
- prefer taxonomy, retrieval, and source-coverage fixes before prompt-style fixes when the problem is isolated to one domain such as procurement, legal / contract, geopolitical, or OT

## When a weak output appears

Work through this order:
1. Was the active runtime live AI or fallback?
2. Did the user describe one coherent event path?
3. Is company / BU / function context still current?
4. Does the document library cover this scenario type well?
5. Is the weak pattern repeated in shared feedback?
6. Only then decide whether a shared tuning change is justified.

This matters because a weak output can come from:
- poor prompt input
- stale shared context
- thin document grounding
- old or weakly maintained citations
- local fallback mode
- real model drift

Do not assume all weak output is a prompt problem.

For the current PoC:
- entity and company-context admin flows temporarily run with a higher prompt ceiling to reduce premature clipping of inherited context
- if you still see weak or malformed output, check `Admin > Audit Log` for `failure stage` and `prompt truncated ... chars`
- the longer-term fix is prompt compaction and instruction-first prompt shaping, tracked in [future-fixes.md](./future-fixes.md)

## User access and governance

Use user-access changes carefully because role, BU, and function shape what context the user inherits and what the help page shows them.

Before changing access:
- confirm the user should really inherit that BU or function context
- confirm the change will not distort who owns the scenario
- keep global-admin powers restricted to actual platform owners

## Pilot boundaries

This environment is still a PoC sandbox.

Practical rule:
- do not use real company names, customer names, live incident details, or sensitive operational data
- use dummy scenarios and generic labels such as `supplier`, `customer`, `service provider`, `business unit`, or `operating site`

## Minimum release checks after admin-impacting changes

Run:

```bash
npm run qa:release
```

Do not swap that for raw `npx playwright test`.
For this static SPA, the package browser scripts provision a clean local static origin on purpose so cold-login, review-queue, and hosted-API-origin defects are not masked by whatever is already running on localhost.
Also note that `qa:release` now fails on explicit eval thresholds. If the deterministic or live eval is materially weak, that is treated as a release-quality issue, not only an analytics report.

If the change affects help, admin settings, or routes, verify:
- a cold login still hydrates shared org structure before the first authenticated workspace render
- the correct admin section opens on refresh
- the help page reflects the current logged-in role
- pilot AI readiness state still renders cleanly
- the AI Feedback & Tuning screen loads without client errors
- empty review surfaces show “no items” rather than a generic load error
- browser-side calls to shared APIs are still using the hosted API origin

If the change affects taxonomy, retrieval, or domain grounding, also verify:
- the affected eval slice still classifies the right primary lens
- retrieval metrics are still acceptable for rows carrying `expected_doc_ids`
- the document library now contains event-matching references rather than only generic governance material
