# HisabAgent

**The MSME back-office agent for messy real-world money.** HisabAgent turns chaotic UPI exports and WhatsApp-style payment notes into a reconciled ledger, a short queue of owner decisions, bilingual explanations, and an inspectable audit pack.

Live demo: [hisab-agent.vercel.app](https://hisab-agent.vercel.app/)

## Why it matters

Indian kiranas and MSMEs reconcile UPI exports, cash records and payment messages by hand. Duplicate credits, missing references, GST/fee differences and part payments hide in plain sight. HisabAgent surfaces that uncertainty instead of pretending it does not exist. A payment it cannot justify is never silently marked as matched.

## Agent architecture

`Planner → Ingestor → Matcher → Critic → Explainer`

Each stage is its own typed module under `lib/agents/`, wired sequentially by `reconcile()` in `lib/reconciliation.ts`. Every stage is timed for real on each run (no artificial delays), and those timings ship in the audit pack.

| Module | Responsibility |
| --- | --- |
| `lib/agents/planner.ts` | Profiles the evidence and fixes the reconciliation policy (amount tolerance, date window, name-similarity threshold) *before* any record is touched. Without a reference column it tightens the amount window instead of guessing. |
| `lib/agents/ingestor.ts` | Parses comma, semicolon and tab exports plus informal notes into one canonical ledger. Amounts prefer a currency marker, dates are normalized to ISO, and undated notes inherit the ledger's working day. |
| `lib/agents/matcher.ts` | Links records across sources. Shared reference → 96; name and amount only → 82; near amount → `partial`. A shared reference with disagreeing amounts is escalated, never matched. |
| `lib/agents/critic.ts` | Attacks the matcher's output and computes Output Trust. Rules can only make the ledger more cautious. |
| `lib/agents/explainer.ts` | States the same numbers in English and Hindi, including what is still open. |

### What the critic actually checks

- Same payment entered twice in one source (identical reference or identical normalized name).
- Fuzzy party duplicates: the same amount under two spellings of one name, via suffix-stripped edit distance.
- Repeat-amount / date outliers: identical amounts more than 7 days apart, reported as a recurring payment or a stale copy rather than a duplicate.
- Amount mismatch on a shared reference: the GST, platform-fee and short-payment case, raised as high severity.
- Ambiguous matches: when two distinct counterparties carry the same amount, every record in the ambiguity loses its matched status.
- Suspiciously round open amounts (₹5,000+ multiples of 1,000 with no confirmed counterpart).
- Amount-only links, pulled back on a second pass.

`Run critic again` runs an additional pass with stricter thresholds (3-day date window, 72% name similarity, ₹1,000 round-amount floor) over the ledger that survived the previous pass. Penalties carry forward, so a deeper pass can never raise trust.

## Output Trust

Output Trust is a property of **the output of one run**, not a confidence claim about the software:

```
base 45
+ matched% × 0.45          (records with independent cross-source evidence)
− 5 per high-severity exception
− 4 per link a critic pass pulled back  (carried across passes)
= clamped to 35-96 (20-96 once a critic pass has run)
```

Bands: **80+ High**, **55-79 Moderate**, **below 55 Low**, each with a plain-language action line. The workspace shows the live arithmetic under “How is this calculated?”, and the same maths is written into `summary.md` in the audit pack. It is fully deterministic: the same evidence always produces the same score.

## Reliability / Evals

`lib/evals.ts` holds twelve fixtures shared by the Evals Lab page, `npm test` and `npm run eval`:

- **8 golden:** clean UPI CSV, messy headers with a duplicate row, notes only, mixed sources, duplicate claim, near-amount payment, plus two **documented limitations** that are expected to fail (no high confidence without a reference; Devanagari counterparty names are not tokenised).
- **4 adversarial:** over-matching bait (two same-amount customers), a corrupt export, an all-Hindi day log, and a GST/rounding mismatch.

Each fixture declares the behaviour it expects today, so a change in either direction (a fixture breaking, or a documented limitation quietly starting to pass) is reported as a regression. There is no fake latency and no random jitter anywhere in the suite.

```bash
npm run eval   # headless suite, exits non-zero on any regression
npm test       # unit tests for every agent module + the full fixture suite
npm run build  # production build
```

## Local setup

```bash
cd Project
npm install
npm run dev
```

Open `http://localhost:3000`. No login, no API key, no environment variables. The deterministic offline path powers the entire demo.

### Demo path

Open `/workspace` → the Sharma General Store sample is already loaded (a duplicate ₹2,500 credit is hidden in it) → **Run HisabAgent** → the duplicate lands in the decision queue with a copyable Hinglish WhatsApp reminder → **Run critic again** to watch trust fall as amount-only links are pulled back → expand the audit preview or download the ZIP → `/evals` for the twelve fixtures.

Runs are stored in this browser only: the last five in `hisabagent:runs` (with the newest also under `hisabagent:last-run`), reloadable from the **Recent runs** panel.

### Optional live explainer

The demo needs no key. If `OPENAI_API_KEY` is set (optionally `OPENAI_MODEL`), the **Rewrite wording (optional LLM)** button calls the server-only `/api/explain` route to reword the summary the deterministic agents already produced. It is never called automatically, the key never reaches the browser, and if it is missing or fails the offline explanation stands unchanged. No matching, scoring or reconciliation decision ever depends on an LLM.

## Why this is not a chat-invoice tool

HisabAgent does not generate invoices or put a chatbot in front of a ledger. Its edge is the inspectable multi-agent trace, confidence-banded evidence, an adversarial critic that argues with its own matcher, a human exception queue with ready-to-send owner messages, and a regression-guarded eval suite.

## Limitations

The parser is rule-based and built for demo-grade CSV and plain text, not bank-grade accounting. It does not replace a CA review, live bank APIs, OCR verification or statutory tax compliance. Devanagari counterparty names are not yet tokenised (fixture `hindi-only` keeps that gap visible). Ambiguous names, dates and split payments stay in the human queue by design.

## How Codex built this

OpenAI Codex (5.6 Terra, High effort) implemented the app architecture, deterministic agents, interface, sample evidence, audit export, automated tests and iterative review fixes. Product direction, requirements and judging narrative were supplied by the project owner.

Judge evidence pack:
- Process write-up: [`docs/codex-process.md`](docs/codex-process.md)
- Session screenshots: [`docs/codex-evidence/`](docs/codex-evidence/) (`00-spec-prompt.png` … `03-polish-review.png`)

A later hardening pass (the split into `lib/agents/`, the extra critic rules, the two ingestion bug fixes, the adversarial fixtures and the craft polish) was done after the submission deadline in Cursor, and is listed under “Post-submission hardening pass” in the same write-up.

## Deploy to Vercel

1. Push this `Project` folder to a Git repository.
2. In Vercel choose **Add New → Project**, import the repository, and set the Root Directory to `Project` if the repository contains other folders.
3. Keep the default Next.js build command (`npm run build`) and deploy. No environment variables are needed.
4. `OPENAI_API_KEY` can be added later for the optional explainer; it must never become a deployment requirement.

## Project map

- `lib/agents/`: planner, ingestor, matcher, critic, explainer and shared normalization
- `lib/reconciliation.ts`: sequential pipeline, per-agent timing, second critic pass
- `lib/evals.ts`: the twelve fixtures shared by the UI, the tests and the CLI
- `lib/audit.ts`: audit pack builder used by both the in-page preview and the ZIP
- `components/workspace.tsx`: intake, agent trace, ledger, trust meter, audit preview, run history
- `app/evals`: the fixture dashboard with Output Trust and documented limitations
- `app/process`: architecture and Codex evidence for judges
- `tests/`: Vitest unit and fixture suites, Playwright demo-path smoke test
