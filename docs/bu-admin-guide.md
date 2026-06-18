# BU Admin Guide

Use this guide if you own business-unit oversight in the pilot environment.

This role sits between the standard-user workflow and the global-admin workbench. A BU admin is responsible for keeping one business unit's context, review flow, and management view credible.

## What this role is for

Use the BU-admin workspace to:
- review assessments that matter to your business unit
- keep BU context and function summaries aligned
- decide when a scenario needs treatment, reassessment, or escalation
- route or escalate reviews when the issue needs a wider management decision

This role is not for:
- changing platform-wide defaults
- managing shared AI tuning for the whole platform
- acting as the overall platform owner

## Core BU-admin surfaces

- `#/dashboard`
  - your main oversight lane
  - use this first to review what needs attention across the business unit
- `#/settings`
  - managed context for your business unit and the functions beneath it
- `#/help`
  - role-aware help for the current signed-in user
- results pages
  - executive and technical interpretation
  - review actions
  - escalation path to holding-company reviewers when needed

## Good use of this role

Use the role well when you:
- review the next item that actually needs action
- keep business-unit context current before new assessments start
- read the executive result first, then open technical detail only when needed
- check project buyer/seller assessments for missing economics before treating the result as a precise value story
- use reassessment and watchlist behavior to keep important scenarios current
- escalate only when the scenario is coherent and the evidence posture is defendable

## What not to do

- do not use the BU workspace as a generic reporting page
- do not rewrite platform-wide defaults that belong to the global-admin role
- do not escalate just because the number is large
- do not leave stale BU context in place and then blame the output

## Suggested operating rhythm

### Daily or session start
- Open the dashboard.
- Review the active queue first.
- Clear the next item that genuinely needs BU attention before starting something new.

### Before a management decision
- Read the executive result first.
- Check confidence, evidence, and assumptions.
- For project assessments, check whether delay cost, margin, contract value, or benefit values were known, proxied, or left unquantified.
- Open technical detail only when you need to challenge a driver, range, or citation.

### Weekly context hygiene
- Open settings.
- Check whether the BU summary and function summaries still match reality.
- Update them before teams start new assessments if the business context changed.

## How review and escalation work in this role

Current review behavior:
- you can review unresolved in-scope items for your business unit
- you can keep work moving through the assigned-reviewer flow
- you can escalate unresolved in-scope BU reviews to a named holding-company `admin`

Good escalation discipline:
- confirm the scenario is coherent
- confirm the management question is clear
- confirm the evidence caveat is acceptable
- escalate with a clear reason, not only because the result feels severe

## How to use results well

Use `Executive Summary` to answer:
- what happened or could happen
- how material it looks
- what management should do next

Use `Technical Detail` to answer:
- which assumptions are carrying the result
- what ranges drive the loss
- where evidence is strong or weak

Use treatment comparison when:
- you want to test whether a better outcome materially changes the decision

## Managed context in this role

Your settings matter because BU context shapes:
- downstream drafting
- evidence cues
- review framing
- inherited assumptions for users working in that scope

Good practice:
- keep BU context short, specific, and current
- make sure function summaries below the BU still align with the real operating model
- use the BU and function-context `AI Assist` tools as drafting aids, then check the grounding banner before saving
- when using follow-up prompts, check the AI update panel for visible changed fields before saving; if live AI is unavailable and the draft is unchanged, retry later or edit directly
- if the banner says the draft is generic or only partly grounded, improve the saved context or the underlying document coverage before rolling it out downstream

## How AI should be treated

Practical rule:
- AI helps structure and explain
- it does not remove the need for judgment

If the output is weak:
1. check whether the scenario itself is coherent
2. check whether BU context is current
3. check confidence, evidence, and freshness posture
4. then decide whether the issue is local, contextual, or worth escalating

## Pilot boundaries

This environment is still a PoC sandbox.

Practical rule:
- use dummy scenarios only
- do not use real company names, customer names, live incident details, or sensitive operational data
- use generic labels such as `supplier`, `customer`, `service provider`, `business unit`, or `operating site`

## Quick reminder

If you remember only five things:
1. Use the dashboard as an oversight lane, not a report archive.
2. Keep BU and function context current.
3. Read the executive result first.
4. Escalate only when the scenario and evidence posture are clear.
5. Leave platform-wide tuning and defaults to global admins.
