# HisabAgent architecture

HisabAgent reconciles messy UPI exports and WhatsApp-style payment notes into a canonical ledger, a human decision queue, bilingual owner summaries, and an inspectable audit pack.

## Pipeline

`Planner → Ingestor → Matcher → Critic → Explainer`

| Module | Role |
| --- | --- |
| `lib/agents/planner.ts` | Profiles sources and fixes reconciliation policy before matching. |
| `lib/agents/ingestor.ts` | Normalizes CSV (comma / semicolon / tab) and informal notes. |
| `lib/agents/matcher.ts` | Links by reference, amount, and party. Weak signals stay partial or open. |
| `lib/agents/critic.ts` | Downgrades only: duplicates, fuzzy names, date outliers, amount mismatches, round amounts. Computes Output Trust. |
| `lib/agents/explainer.ts` | Writes English and Hindi summaries from the same deterministic facts. |

`lib/reconciliation.ts` runs the stages in order, records real per-stage timings, and supports a stricter second critic pass. Penalties carry forward so deeper passes cannot raise trust.

## Output Trust

```
base 45
+ matched% × 0.45
− 5 per high-severity exception
− 4 per link a critic pass pulled back
= clamped to 35-96 (20-96 after a critic re-pass)
```

Bands: 80+ High, 55-79 Moderate, below 55 Low.

## Reliability

`lib/evals.ts` is shared by the Evals Lab UI, `npm test`, and `npm run eval`:

- 8 golden fixtures
- 4 adversarial fixtures
- 2 documented limitations expected to fail (missing-reference high confidence; Devanagari counterparty names)

## Product constraints

- Offline demo works with zero environment variables.
- Optional `/api/explain` may reword summaries only; it never matches or scores.
- No fake latency and no random score jitter.
- Ambiguous money stays in the human queue.
