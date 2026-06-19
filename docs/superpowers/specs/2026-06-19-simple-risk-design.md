# Simple Risk Design

## Goal

Build a separate product, **Simple Risk**, that keeps the intelligence of the current Risk Intelligence Platform while making the user experience understandable to non-technical users.

The new product is not a stripped-down risk calculator. It should keep the current platform's AI reasoning, evidence grounding, project economics, FAIR/Monte Carlo quantification, decision readiness, challenge logic, review flow, export surfaces, and admin governance. The simplification is in the interaction model and language.

## Approved Direction

- Product name: Simple Risk.
- Main audience: frontline non-risk staff and managers.
- Main interaction: conversational case builder.
- Quant model: keep full quant available, but hide it under advanced details by default.
- Admin model: keep full admin/org setup, redesigned in plain setup-task language.
- Backend strategy: start by calling the existing Risk Intelligence Platform backend APIs; split later only if the product needs an independent lifecycle.
- UI inspiration: build on the Parallax42 chat-first compliance workbench pattern.

## Product Shape

Simple Risk opens on a conversational workbench, not a wizard.

The first prompt is:

> Start with a short description of the issue, change, project, or decision.

The assistant should not follow a fixed question script. After each user message, it should analyse what the user already provided, decide what is missing, and ask the single highest-value follow-up question.

The normal user should not need to understand terms such as FAIR, Monte Carlo, taxonomy, TEF, vulnerability, or lens to complete an assessment. Plain labels come first. Technical terms can appear as small helper text or inside advanced details.

## Conversation Planner

Add a bounded AI conversation-planning step for the simple product.

The planner takes the current conversation, known organisation context, and any lightweight evidence summary. It returns structured JSON:

```json
{
  "understood": ["..."],
  "missing": ["..."],
  "nextQuestion": "...",
  "readyToDraft": false,
  "reason": "..."
}
```

Rules:

- Ask one question only.
- Use plain professional language.
- Do not ask generic checklist questions when the user has already provided the detail.
- Do not repeat questions.
- Skip irrelevant areas.
- Set `readyToDraft: true` when enough context exists to create a useful draft.
- If live AI is unavailable, fallback to deterministic missing-detail logic.

Examples:

- Vendor go-live delay: ask about deadline, business consequence, or customer commitment.
- UAE patient-data issue: ask about data type, geography, approval basis, or affected workflow.
- AI tool giving wrong advice: ask who relies on it and what decision it affects.
- If impact and owner are already known, do not ask for them again.

For v1, this can be a thin new backend route such as `/api/simple-risk/conversation-plan`, backed by existing taxonomy, missing-detail, and scenario-quality logic where practical.

## Main User Flow

1. User opens the workbench.
2. Assistant asks the first prompt.
3. User gives a plain-language description.
4. Conversation planner returns:
   - what the app understood
   - what is missing
   - the next best follow-up question
   - whether the draft is ready
5. Assistant renders a structured card, not a long chat blob.
6. Once ready, user clicks `Create risk assessment`.
7. The app maps the conversation state into existing risk-platform API requests.
8. Existing intelligence runs in the background:
   - taxonomy/lens detection
   - draft generation/refinement
   - evidence grounding
   - project buyer/seller economics
   - FAIR/Monte Carlo quantification
   - decision readiness
   - challenge/review logic
9. Result opens with a plain decision summary.
10. Advanced details expose the full method, evidence, quant, assumptions, challenge logic, and audit trail.

## Manager Flow

Managers use the same intake model, but their home view also shows:

- items waiting for review
- decisions needing proof
- escalations
- recently completed assessments

Manager result copy should focus on:

- approve
- ask for more proof
- escalate
- assign an owner
- revisit later

## Admin Flow

Keep full admin capability, but redesign it as setup tasks rather than an expert console:

- company and entity setup
- business units and departments
- users and roles
- context and obligations
- document library
- defaults and thresholds
- AI/system readiness
- audit log

The admin UI should explain each setup task in business language. Technical runtime detail belongs in advanced panels.

## Layout

Use a Parallax42-style conversational cockpit:

- Left column: conversation thread and composer.
- Right column: live understanding panel.
- Lower or expanded area: evidence, quant, assumptions, challenge, and audit details.

The first viewport should show:

- what to type
- what the assistant understood
- what is missing
- one clear next action

Avoid:

- wizard stepper as the primary model
- dense telemetry panels
- giant dashboard before the user starts
- jargon-heavy labels
- raw JSON or provider/runtime diagnostics in normal screens
- decorative agent animation in v1

## Assistant Card Shape

Assistant replies should render as structured cards:

- What I understood
- What I still need
- Why this matters
- Next question

The wording should be professional and calm. Avoid patronising phrases such as "what are you worried about".

## Result Summary Shape

Default result view should lead with:

- Recommended action
- Confidence
- Main reason
- What could change this
- Likely exposure
- Owner / next step

Advanced details reveal:

- FAIR model
- Monte Carlo distributions
- evidence citations
- challenge agent output
- assumptions and gaps
- audit trail

## Architecture

Create a new repo for the frontend. Working repo name can be `simple-risk`.

For v1:

- New frontend owns conversation state, simple UX, result presentation, and admin presentation.
- Existing backend owns intelligence and persistence-heavy workflows.
- Add only thin new backend adapters when the existing wizard-shaped APIs cannot support the conversation model cleanly.

Avoid extracting a shared package in v1. That is plumbing. Add it later only when both products actively duplicate changing client/core logic.

## API Adapter

The new frontend should have a small adapter layer that maps conversational state into existing request shapes.

Likely adapter responsibilities:

- convert conversation state into scenario draft inputs
- preserve business context and evidence references
- map project/supplier/contract cues into assessment type
- request project exposure only when relevant
- request parameter coaching and evidence maps after enough context exists
- convert results into Simple Risk cards

## Non-Goals For V1

- Do not copy the existing wizard UI.
- Do not rebuild the risk engine.
- Do not duplicate the whole backend.
- Do not introduce a rich animated agent council before the conversation and result flow work.
- Do not show full quant details by default.
- Do not make a marketing landing page the first authenticated screen.
- Do not make the assistant a generic chatbot; it is a guided risk-assessment interface.

## Validation

Minimum validation for v1:

- conversation planner asks a relevant follow-up for at least five different scenario types
- planner does not repeat known facts
- planner sets `readyToDraft` when enough context is present
- fallback planner works when live AI is unavailable
- a completed conversation can create a draft through the existing backend
- result summary hides technical mechanics by default
- advanced details still expose quant/evidence/challenge/audit
- admin setup remains discoverable in plain task language

## Open Implementation Questions

- Exact repo name and hosting target.
- Whether the v1 frontend should be vanilla or Vite.
- Which existing backend APIs need a thin conversation adapter route.
- How much current auth/session machinery should be reused directly.
- Whether Simple Risk should share the same user store or start with its own identity boundary.
