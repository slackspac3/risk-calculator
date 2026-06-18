# Function Admin Guide

Use this guide if you own one function or department in the pilot environment.

This role is still assessment-focused, but with a stronger oversight responsibility than a standard user. A function admin is responsible for keeping one function's context credible and reviewing the scenarios that matter to that function.

## What this role is for

Use the function-admin workspace to:
- review assessments that need attention for your function
- keep owned function context current
- challenge and explain results before they are escalated
- route reviews onward when the issue needs BU or wider management attention

This role is not for:
- changing platform-wide defaults
- acting as the BU owner
- changing shared AI tuning for everyone else

## Core function-admin surfaces

- `#/dashboard`
  - your main function review lane
  - use this first to see what needs attention
- `#/settings`
  - managed context for the function you own
- `#/help`
  - role-aware help for the current signed-in user
- results pages
  - executive and technical interpretation
  - review actions and escalation path

## Good use of this role

Use the role well when you:
- review the next function-level item that needs action
- keep the owned function context current
- challenge weak assumptions before the result leaves the function
- check whether project-linked assessments are buyer, seller, or generic enterprise routes before reading the financial story
- read the executive result first and only then inspect technical detail
- escalate when the issue is broader than the function you own

## What not to do

- do not use the function workspace as a generic dashboard
- do not force a cross-BU issue through function-only context
- do not escalate before the scenario is coherent
- do not ignore stale function context and then treat the result as fully trustworthy

## Suggested operating rhythm

### Daily or session start
- Open the dashboard.
- Review the next function-level item that genuinely needs attention.
- Revisit an existing scenario before starting a new one if that is the item that matters most.

### Before handing work onward
- check that the scenario still describes one coherent event path
- check that the result has an acceptable confidence and evidence posture
- make sure the management story is understandable without extra explanation

### Weekly function-context hygiene
- Open settings.
- Review the function summary and context.
- Update it if controls, operating assumptions, priorities, or key dependencies changed.

## How review works in this role

Current review behavior:
- you can review items assigned within your scope
- you can use the function workspace as the first structured challenge layer
- when the issue is wider than the owned function, involve the BU or global-admin path rather than forcing a narrow function-only view

Good escalation discipline:
- clarify what the function believes is happening
- show the key assumptions and evidence caveats
- explain why the issue now belongs above function level

## How to use results well

Use `Executive Summary` to answer:
- what the function needs to understand now
- whether the issue looks material
- what the next management action should be

Use `Technical Detail` to answer:
- which assumptions are driving the output
- whether the ranges are credible
- whether the evidence is strong enough to support escalation
- whether project economics were known, benchmark-proxied, or still missing

Use treatment comparison when:
- the function needs to test whether a specific better outcome materially changes the decision

## Managed context in this role

Your settings matter because function context shapes:
- future drafts
- evidence and guidance cues
- review framing for users in the same area

Good practice:
- keep the function context specific and current
- update it when the control environment, operating model, or priorities change
- when adding follow-up prompt feedback to context, review the AI update panel for changed draft fields before saving; if live AI is unavailable and no fields changed, retry later or edit the context manually
- when you use `AI Assist` on function context, read the grounding banner before saving:
  - `Grounded in saved context` means the draft is clearly inheriting saved BU or organisation context
  - `Partly grounded` means some saved context is showing through, but the draft still needs review
  - `Generic draft warning` means the draft is still too generic or the saved context is too thin

If the grounding banner is weak:
- enrich the function or BU context first
- check whether the relevant document library coverage exists
- do not save generic function context just because the prose sounds polished

## How AI should be treated

Practical rule:
- AI helps the function move faster
- it does not replace ownership judgment

If the output is weak:
1. check the scenario wording
2. check the function context
3. check the confidence, evidence, and freshness posture
4. then decide whether the issue is input quality, context quality, or something that needs wider review

## Pilot boundaries

This environment is still a PoC sandbox.

Practical rule:
- use dummy scenarios only
- do not use real company names, customer names, live incident details, or sensitive operational data
- use generic labels such as `supplier`, `customer`, `service provider`, `business unit`, or `operating site`

## Quick reminder

If you remember only five things:
1. Use the dashboard as a function review lane.
2. Keep your owned function context current.
3. Read the executive result first.
4. Escalate when the issue is broader than your function.
5. Leave platform-wide controls and tuning to the global-admin role.
