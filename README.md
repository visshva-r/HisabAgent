# HisabAgent

**The MSME back-office agent for messy real-world money.** HisabAgent turns chaotic UPI exports and WhatsApp-style payment notes into a reconciled ledger, a human decision queue, bilingual explanations, and an inspectable audit pack.

## Why it matters

Indian kiranas and MSMEs routinely reconcile UPI exports, cash records, and payment messages by hand. That leaves duplicate credits, missing references, and partial payments hidden in plain sight. HisabAgent surfaces uncertainty instead of pretending it does not exist.

## Agent architecture

`Planner → Ingestor → Matcher → Critic → Explainer`

- **Planner** prepares an explicit reconciliation strategy.
- **Ingestor** normalizes CSV columns and informal Hindi/English payment notes.
- **Matcher** applies reference, amount, party, and direction evidence.
- **Critic** challenges weak links, duplicate payments, splits, and missing references; it can run again on demand.
- **Explainer** creates owner-friendly English and Hindi summaries.

The timeline records every agent stage. The downloadable ZIP includes `summary.md`, `exceptions.csv`, `reconciled.csv`, and `agent-trace.json`.

## Reliability / Evals

The Evals Lab covers 8 golden scenarios: clean and messy UPI CSVs, WhatsApp-only notes, mixed sources, duplicates, partial matches, missing references, and mixed Hindi-English notes. `npm run eval` provides a quick offline smoke evaluation.

Golden case definitions live in `data/golden-scenarios.json`. Browser runs are persisted as JSON in local browser storage (`hisabagent:last-run`) for a local-first, Vercel-safe demo; every run can additionally be exported as a portable audit ZIP.

## Local setup

```bash
cd Project
npm install
npm run dev
```

Open `http://localhost:3000`. No login or API key is required. `OPENAI_API_KEY` is intentionally optional; the deterministic local agent path powers the full demo.

## Why this is not a chat-invoice tool

HisabAgent does not generate invoices or place a chatbot in front of a ledger. Its moat is the inspectable multi-agent reconciliation trace, confidence-banded evidence links, a human exception queue, bilingual owner explanation, and golden eval harness. It deliberately surfaces uncertainty instead of silently forcing a match.

## Limitations

The offline parser is rule-based and is designed for demo-grade CSV/plain text, not bank-grade accounting. It does not replace a CA review, live bank APIs, OCR verification, or statutory tax compliance. Ambiguous names, dates, and split payments must remain in the human queue.

## How Codex built this

OpenAI Codex (5.6 Terra, High effort) implemented the app architecture, deterministic agents, user interface, sample evidence, audit export, automated tests, and iterative review fixes. Product direction, requirements, and judging narrative were supplied by the project owner.

Judge evidence pack:
- Process write-up: [`docs/codex-process.md`](docs/codex-process.md)
- Session screenshots: [`docs/codex-evidence/`](docs/codex-evidence/) (`00-spec-prompt.png` … `03-polish-review.png`)

```bash
npm run build
npm run eval
npm test
```

## Deploy to Vercel

1. Push this `Project` folder to a Git repository.
2. In Vercel, choose **Add New → Project**, import the repository, and set the Root Directory to `Project` if the repository contains other folders.
3. Keep the default Next.js build command (`npm run build`) and deploy. No environment variables are needed.
4. Optionally add `OPENAI_API_KEY` later for enhanced natural-language planning; never make it a deployment requirement.

## Codex process

Built primarily with OpenAI Codex. Planning/positioning outside; application code and review loops inside Codex.

Full write-up: [`docs/codex-process.md`](docs/codex-process.md) · Screenshots: [`docs/codex-evidence/`](docs/codex-evidence/)

## Project map

- `lib/reconciliation.ts` — deterministic agent-compatible reconciliation and critic loop
- `components/workspace.tsx` — full demo workflow, activity timeline, audit ZIP
- `app/evals` — visible golden scenario dashboard
- `app/process` — architecture + Codex evidence links for judges
- `public/samples` — real kirana/MSME sample evidence
- `docs/codex-process.md` — Codex build evidence for judges
- `docs/codex-evidence/` — Codex session screenshots
