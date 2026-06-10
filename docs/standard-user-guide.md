# Standard User Guide

Use this guide if you are a normal assessment user rather than a BU admin, function admin, or global admin.

This is the quickest way to use the pilot well without needing to learn the full platform architecture.

## What this role is for

Use the standard-user workspace to:
- turn one real issue into one clear scenario
- estimate the likely loss path in plain language
- review the result in executive and technical views
- export or submit the result for review when it is ready

This role is for doing the assessment work itself.

It is not for:
- changing platform defaults
- managing other users
- changing BU or function context for the wider platform
- tuning shared AI behavior

## Pilot boundaries

This environment is still a PoC sandbox.

Practical rule:
- use dummy scenarios only
- do not use real company names, customer names, live incident details, or sensitive operational data
- use generic labels such as `supplier`, `customer`, `service provider`, `business unit`, or `operating site`

## What good use looks like

The platform works best when you:
- keep the scenario focused on one event path
- describe what happened or what could happen in plain language
- keep only the risks that genuinely belong in that one scenario
- estimate honestly rather than forcing false precision
- read the executive result first, then open technical detail only when needed

## Main workflow

### 1. Dashboard

Use the dashboard to:
- resume your current draft
- reopen an existing result
- start a new assessment only when you have one real scenario to work through

Do not use the dashboard as a reporting page. It is mainly a front door and work queue.

### 2. Step 1: Assessment guide

Purpose:
- choose how you want to start the assessment
- understand what the intake will ask for before you begin drafting

Start options:
- answer two questions
- paste an existing draft
- use an example or register

Use Step 1 well:
- choose one start option
- keep the selected option visible
- continue to Quick Assessment when the route matches your situation

### 3. Step 2: Quick Assessment intake

Purpose:
- get to one plausible scenario draft
- shortlist the risks that actually belong in scope

Best input:
- one triggering condition
- one main asset, service, team, or dependency
- one clear impact path

Good example:
- `Hackers encrypt a core service environment, disrupt operations, and demand payment to restore access.`

Weak example:
- `Cyber issues could hurt the business badly.`

Use Step 2 well:
- choose the business unit first if the page asks for business context
- describe the event once in plain language
- name the main impact
- click `Build draft with AI` once and wait
- keep the wording simple and specific
- use the optional affected-system/cause drawer only when it helps
- remove shortlist risks that do not belong in this event path
- rate the draft or shortlist if the AI output is weak
- read the grounding cues before you carry the draft forward:
  - stronger grounding means the scenario is clearly tied to saved context and retrieved references
  - weaker grounding means the draft still needs more challenge or evidence

### 4. Step 3: Refine the scenario

Purpose:
- turn the first draft into one coherent narrative that another person can challenge

What to do:
- rewrite the scenario in your own words where needed
- keep what matches reality
- remove wording that feels generic, overstated, or off-path

Good discipline:
- one scenario
- one main event path
- one explainable business impact chain

### 5. Step 4: Estimate the scenario

Purpose:
- express the likely frequency, exposure, and loss path clearly enough for the model to run

What to do:
- use the plain-language guidance first
- widen ranges when you are unsure
- complete the core cost rows before opening conditional cost areas
- open conditional cost areas only when regulatory, third-party, or reputation/contract costs realistically apply
- only use advanced tuning when it materially improves the assessment

Do not:
- force precise numbers without a reason
- use advanced controls just because they are available

## Grounding and freshness signals

The product now shows more explicit trust signals.

What to watch:
- Step 1 and results grounding cues tell you whether the current scenario is strongly grounded, lightly grounded, or still relying mainly on working judgment.
- Citation labels can show when a source is old. If a citation says it was last reviewed years ago, use it as directional support rather than current proof.
- Some citations now open to an official public source page when one exists.
- If you reopen an older saved assessment, the results page may warn that the run is stale. Treat that as a prompt to reassess before escalating.

## Review and results

### Step 5: Review & Run

Use this stage to challenge the scenario before you run it.

Ask:
- is the scenario still coherent
- are the major assumptions visible
- is the loss path believable
- is any key evidence missing

When ready:
- use the single `Run Monte Carlo simulation` action
- treat the Assessment Manager and Challenge Agent cards as review evidence, not extra forms to complete

### Results

Start with:
- `Executive Summary`

Then open:
- `Technical Detail` only when you need to understand drivers, ranges, evidence, or confidence

Use results well:
- read the management story first
- check confidence and caveats before escalating
- do not assume `below tolerance` means `safe`; some scenarios have a critical response gate because the issue itself must be closed first
- use treatment comparison only when you want to test whether a better outcome materially changes the decision

Critical response gates can appear when the scenario suggests potentially valid privileged credentials, active compromise, regulated data exposure, legal or compliance triggers, or safety-critical conditions. In those cases, the number still matters, but the first action is to confirm containment, owner review, and closure evidence.

## Submit for review

If the platform prompts you to submit for review:
- choose the correct reviewer
- make sure the scenario is coherent first
- check confidence, evidence, and assumptions before handing it off
- if a critical response gate is shown, confirm the required owner and closure evidence rather than treating the assessment as ordinary monitoring

Do not submit a scenario just because the number looks large. Make sure the story and the evidence posture are defendable.

## How AI works in this role

Practical rule:
- AI is an assistant, not an authority

What that means:
- use AI to help draft, structure, and challenge the scenario
- do not treat AI wording as automatically correct
- keep what matches the business reality
- edit or remove what does not

If AI looks weak:
- improve the scenario wording
- check that the event path is clear
- check whether the grounding and evidence cues still look thin
- use the feedback controls
- rerun only if the input actually changed

## Best way to give feedback

For Step 1 AI quality:
- rate the generated scenario draft
- rate the generated shortlist
- use the reason tags
- rate individual risk suggestions where relevant
- save the feedback

That is the best in-app path for improving AI quality in the pilot.

## Best way to avoid slowdowns and waste

Please:
- use one tab where possible
- click AI actions once and wait
- do not refresh while something is loading
- only rerun AI when the input actually changed
- keep uploads small and relevant

The heaviest actions are usually:
- `Build scenario draft`
- `Upload risk register`
- reviewer or challenge AI actions in results
- treatment suggestion or better-outcome assistance

## If something goes wrong

If you hit a bug or confusing output, send:
- which page or step you were on
- what you entered
- what you expected
- what actually happened
- a screenshot
- the time it happened

If the issue is AI quality rather than a product bug, use the in-app feedback controls as well.

## Quick reminder

If you remember only five things:
1. Use dummy scenarios only.
2. Keep one clear event path in focus.
3. Click AI actions once and wait.
4. Read the executive result first.
5. Use feedback controls when the AI is weak.
