# Agent Notes

Keep HisabAgent an inspectable reconciliation cockpit.

## Non-negotiables

- Preserve the `Planner → Ingestor → Matcher → Critic → Explainer` sequence, one module per stage in `lib/agents/`.
- The offline deterministic path must work with zero environment variables. `/api/explain` is optional, click-only and may never gate the demo.
- No fake delays, no random score jitter, no claiming that an LLM performs the matching.
- The critic may only make the ledger more cautious. Never promote a record to a stronger status.
- Keep the human exception queue, bilingual explanation, audit export and eval harness.
- Documented limitations stay visible in `lib/evals.ts` rather than being quietly removed.

## Before handoff

```bash
npm test
npm run eval
npm run build
```
