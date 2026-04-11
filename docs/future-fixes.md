# Future Fixes

## AI Prompt Shaping

- Replace the current entity-context prompt construction with compact summaries instead of large raw JSON dumps for `entity`, `parentEntity`, `currentContext`, and `parentLayer`.
- Move the non-negotiable grounding instructions to the top of the prompt so they are preserved even when prompt clipping happens.
- Build task-specific prompt budgets instead of relying on a single shared ceiling. Entity and company context generation should have their own tuned caps and truncation strategy.
- Emit explicit prompt-footprint telemetry before send for high-risk tasks so we can see which blocks consumed the budget, not just the final clipped limit.
