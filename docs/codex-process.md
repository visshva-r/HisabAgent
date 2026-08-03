# How OpenAI Codex built HisabAgent

**Product:** HisabAgent — MSME back-office agent for messy UPI + WhatsApp money  
**Track:** AI Agents for Bharat's Businesses + Domain Agents  
**Builder:** visshva-r  
**Live:** https://hisab-agent.vercel.app/  
**Repo:** https://github.com/visshva-r/HisabAgent  
**Codex model used for main build:** 5.6 Terra (High effort)

---

## Split of work

### Outside Codex
- Hackathon track selection and winning-positioning (Bharat MSME impact)
- Locked product spec before coding (Plan outside. Build inside.)
- Antigravity browser QA / red-team reports
- Submission packaging (BlockseBlock form, Google Doc presentation, demo video + Codex clip, Drive folder)
- GitHub/Vercel publish and evidence documentation

### Inside Codex (primary engineering)
- Next.js + TypeScript + Tailwind app scaffold in the locked `Project` folder
- Multi-agent pipeline: Planner → Ingestor → Matcher → Critic → Explainer
- Workspace UI: timeline, KPIs, exceptions, trust meter, bilingual explanation, audit ZIP
- Sample kirana/MSME evidence packs under `public/samples`
- Evals Lab + `npm run eval` smoke harness
- Vitest unit tests + Playwright smoke config
- Iterative fix loops from QA findings (ZIP download, mobile nav, honest landing metrics, Nav on workspace, footer)

---

## Agentic loops (what judges should credit)

1. **Charter → scaffold:** pasted a locked HisabAgent build charter into Codex; app created only in `Project/`
2. **Vertical implementation:** offline no-key reconciliation demo with visible 5-stage agent trace
3. **Self-verify:** Codex ran / confirmed `npm install`, `npm run build`, `npm run eval`, `npm run dev`
4. **Review / polish loops:** QA-driven remediation and submission polish while keeping product identity
5. **Evidence trail:** file diffs (28 files in core build), build-pass summaries, polish completion notes

---

## Key Codex prompts (actual sessions)

### Prompt 1 — Initial build charter (Terra High)
Locked-location HisabAgent brief:
- Build only in  
  `C:\Users\vissh\Documents\My Projects\Hackathon Projects\ChatGPT Codex Hackathon 2026\Project`
- Multi-agent architecture, bilingual explanations, trust meter, exception queue, audit ZIP, Evals Lab
- Offline deterministic demo (no API key required), Vercel-ready
- Winning-quality bar (not a rushed MVP)

Evidence: `docs/codex-evidence/00-spec-prompt.png`

### Prompt 2 — Core implementation pass
Codex implemented the product surface and engine, then reported production build passing with:
- five-agent workflow
- landing / workspace / evals / process pages
- real sample packs
- judge-oriented README

Evidence: `docs/codex-evidence/01-files-edited.png`, `docs/codex-evidence/02-build-complete.png`

### Prompt 3 — Submission polish pass
Codex applied quick polish only (no new product identity):
- honest landing “Example ledger health” demo labels
- reusable GitHub footer
- shared `<Nav/>` on `/workspace`
- build must pass

Evidence: `docs/codex-evidence/03-polish-review.png`

### Prompt 4 — QA remediation loops (additional Codex turns)
Applied Antigravity findings where implemented in-session, including:
- Audit Pack ZIP download reliability (`appendChild` before click)
- Mobile navigation hamburger
- Evals honesty (remove fake score floor)
- Critic re-run trust reason updates

---

## Verification evidence

Commands validated during Codex build/handoff:

```powershell
cd "C:\Users\vissh\Documents\My Projects\Hackathon Projects\ChatGPT Codex Hackathon 2026\Project"
npm install
npm run build
npm run eval
npm test
npm run dev
```

Deployed publicly on Vercel with **no required environment variables**.

---

## Screenshot index

| File | What it proves |
|------|----------------|
| `docs/codex-evidence/00-spec-prompt.png` | Locked HisabAgent charter pasted into Codex |
| `docs/codex-evidence/01-files-edited.png` | Codex multi-file implementation diff (+231 / −5 in core pass) |
| `docs/codex-evidence/02-build-complete.png` | Codex completion summary + verified build/eval/dev commands |
| `docs/codex-evidence/03-polish-review.png` | Codex review/polish loop with passing production build |

---

## Important distinction for judges

- **Use of Codex (hackathon criterion)** = Codex as the **engineering agent** that planned/built/reviewed the application.
- Runtime demo is intentionally **offline / no-key** so the public deploy stays judge-accessible without credentials.
- This matches the official playbook: plan outside, build inside Codex; prove agentic usage with process evidence.
