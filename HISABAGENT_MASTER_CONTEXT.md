# HisabAgent — Master Chat Context (permanent)

Use this file for ANY Antigravity/Cursor chat in this workspace.
Rule: **one chat per workspace**. Do not start a new HisabAgent chat.

## Links
- Live: https://hisab-agent.vercel.app/
- GitHub: https://github.com/visshva-r/HisabAgent
- Track: AI Agents for Bharat's Businesses / Domain Agents

## Product (current)
- 5-agent pipeline, one typed module each under `lib/agents/`: planner, ingestor, matcher, critic, explainer
- Real per-agent timings on every run (no artificial delays); trace ships in the audit pack
- Critic rules: same-source duplicates, fuzzy-name duplicates, repeat amounts >7 days apart, shared-reference amount mismatch (GST/fees), ambiguous-match refusal, round-amount checks, amount-only downgrades on pass 2+
- Output Trust: published formula, live breakdown in the UI, High/Moderate/Low band with an action line, deeper critic passes can never raise it
- Workspace: sample auto-loaded with a dismissible note, ledger with status badges, audit pack preview accordion, last 5 runs in localStorage, optional click-only LLM rewrite
- Exceptions: natural Hinglish/Hindi WhatsApp reminders per rule type
- Evals Lab: 12 fixtures (8 golden + 4 adversarial), 2 documented limitations that are expected to fail, regression detection shared by UI / `npm test` / `npm run eval`
- UI craft: product-first landing (ledger preview, not DEMO KPIs); trust-first workspace; quieter status text (no pill spam); exception resolve/keep queue; single process pipeline; no float/pulse theater
- Typeface: IBM Plex Sans + IBM Plex Mono (no Georgia/Times/Inter)

## Built with
- Judged submission: OpenAI Codex (5.6 Terra High)
- Post-deadline hardening pass (agent modules, extra critic rules, ingestion bug fixes, adversarial evals, craft polish): Cursor
- Support: Antigravity QA

## Submission
- Locked on BlockseBlock; same live/GitHub/Drive URLs
- Post-deadline changes are documented in `docs/codex-process.md`

## Agent instructions
1. Read this file + live site/repo before answering.
2. Continue continuity in the single master chat only.
3. Never add fake eval latency, random scores, or LLM-matching claims.
4. Offline demo must keep working with zero env vars.
5. Do not redesign the visual system; keep the mint/teal identity.
