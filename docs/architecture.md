# HisabAgent architecture

HisabAgent reconciles messy UPI exports and WhatsApp-style payment notes into a canonical ledger, a human decision queue, bilingual owner summaries, and an inspectable audit pack.

## Pipeline

`Planner → Ingestor → Matcher → Critic → Explainer`

This is a **sequential agent pipeline**, not an autonomous swarm. `lib/reconciliation.ts` runs the five typed modules in order, records real per-stage timings, and supports a stricter second critic pass. No stage elects, votes, or retries on its own. Penalties carry forward so deeper critic passes cannot raise trust.

| Module | Role |
| --- | --- |
| `lib/agents/planner.ts` | Profiles sources and fixes reconciliation policy before matching. |
| `lib/agents/ingestor.ts` | Normalizes CSV (comma / semicolon / tab) and informal notes. Keeps Devanagari party names. |
| `lib/agents/matcher.ts` | Links by reference, amount, party and date. Writes structured `MatchEvidence` (signals, amount delta, name %, date gap, GST rate). Weak signals stay partial or open. GST rates are labelled only on a shared reference. |
| `lib/agents/critic.ts` | Downgrades only: duplicates, fuzzy names, date outliers, amount mismatches, GST-shaped gaps, split payments, round amounts, over-matches. Computes Output Trust. |
| `lib/agents/explainer.ts` | Writes English and Hindi summaries from the same deterministic facts. |

## Output Trust

```
base 45
+ matched% × 0.45
− 5 per high-severity exception
− 4 per link a critic pass pulled back
= clamped to 35-96 (20-96 after a critic re-pass)
```

Bands: 80+ High, 55-79 Moderate, below 55 Low.

The workspace shows this arithmetic with the live values from the current run. The same maths is written into `summary.md` in the audit pack.

## Reliability

`lib/evals.ts` is shared by the Evals Lab UI, `npm test`, and `npm run eval`:

- 12 golden fixtures (including Hindi names, fuzzy spellings, date outliers, round amounts, split payments)
- 4 adversarial fixtures (over-match bait, corrupt CSV, all-Hindi log, GST rounding)
- 1 documented limitation expected to fail (high confidence without a reference)

## Product constraints

- Offline demo works with zero environment variables.
- Optional `/api/explain` may reword summaries only; it is click-only and never matches or scores.
- No fake latency and no random score jitter.
- Ambiguous money stays in the human queue.
