# 0004. Claude Haiku with structured outputs, quotas, and a heuristic fallback

- Status: accepted
- Date: 2026-10-30

## Context

There are four AI features: relationship summary, lead score, follow-up draft, and contact extraction. Each is a
single-step task over a small amount of text. A free plan must be affordable to run. The CRM text is written by
users, so it can contain instructions aimed at the model. The app must stay usable when the AI is not.

## Options considered

1. **Large model, free-form text answers**: best quality, but a high cost per call, and the answers need parsing.
2. **Small model (`claude-haiku-5-5`, low effort) with structured outputs** (JSON schema generated from Zod).
3. **No LLM, rules only**: cheap and predictable, but it cannot draft messages or read messy pasted text.

## Decision

Option 2, with option 3 as the fallback:

- The score, draft, and extraction requests carry a JSON schema generated from Zod, and the answer is validated
  again before use.
- CRM text is wrapped in tags with angle brackets neutralized, and the system prompt says to treat it as data.
- `consume_ai_quota()` reserves a call before Claude is called (daily plan quota plus 8 per minute per user); token
  usage is recorded afterwards.
- Without `ANTHROPIC_API_KEY`, every feature uses deterministic heuristics (`lib/ai/heuristics.ts`), and the UI says
  which engine produced the result.
- Refusals, truncation, rate limits, and auth errors map to user-facing messages.

## Consequences

- Good: the cost is predictable, and the demo and CI run with no key at all.
- Good: extraction never saves directly. The user reviews the parsed contacts first.
- Trade-off: quality is not measured yet. Next step: a labelled evaluation set to compare prompts and models.
- Trade-off: heuristic results are visibly weaker. They are labelled, not hidden.
