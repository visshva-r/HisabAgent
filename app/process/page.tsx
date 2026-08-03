import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { ArrowRight, FileText, Image as ImageIcon, ShieldCheck } from 'lucide-react';

const agents = [
  ['01', 'Planner', 'Reads the source shape and sets a transparent reconciliation strategy.'],
  ['02', 'Ingestor', 'Normalizes CSV columns and loose payment prose into canonical entries.'],
  ['03', 'Matcher', 'Links records using reference, amount, date and party evidence.'],
  ['04', 'Critic', 'Challenges weak links, duplicate signals and suspicious splits.'],
  ['05', 'Explainer', 'Turns the ledger into clear Hindi and English for the owner.'],
] as const;

const evidence = [
  ['Locked charter in Codex', 'Build prompt fixed the Project folder, tracks, multi-agent architecture, and no-key demo constraints.'],
  ['Multi-file agentic implementation', 'Codex generated the engine, pages, samples, evals, and docs in iterative passes (including a 28-file core build).'],
  ['Verify + review loops', 'Production build/eval verification, then polish/QA remediation loops while keeping HisabAgent identity.'],
] as const;

export default function Process() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="relative mx-auto max-w-6xl px-5 py-12">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-mint">How it is built</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight">
          A back-office agent
          <br />
          you can inspect.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          HisabAgent was implemented primarily with OpenAI Codex (5.6 Terra, High effort): application architecture,
          parsing and reconciliation code, interface implementation, test/review loops, and documentation. Product
          direction and judging narrative were defined outside the implementation loop.
        </p>

        <div className="gridline panel mt-10 overflow-auto rounded-2xl p-7">
          <div className="flex min-w-[780px] items-center justify-between gap-3">
            {agents.map((a, i) => (
              <div key={a[0]} className="contents">
                <div className="w-32 rounded-xl border border-mint/25 bg-ink/80 p-3">
                  <p className="text-xs text-mint">{a[0]}</p>
                  <p className="mt-1 font-bold">{a[1]}</p>
                </div>
                {i < 4 && <ArrowRight className="text-mint/70" />}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Every transition is recorded in the Activity Timeline and included in the downloadable audit pack.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {agents.map((a) => (
            <article key={a[0]} className="panel rounded-xl p-4">
              <p className="text-xs text-mint">AGENT {a[0]}</p>
              <h2 className="mt-2 font-bold">{a[1]}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{a[2]}</p>
            </article>
          ))}
        </div>

        <section className="panel mt-12 rounded-2xl p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="text-mint" size={22} />
            <h2 className="text-2xl font-black tracking-tight">OpenAI Codex evidence</h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
            This page is the product architecture. The repository holds the judge-facing process trail: the locked
            Codex charter, multi-file diffs, build verification, and polish/review screenshots.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {evidence.map(([title, detail]) => (
              <article key={title} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="font-bold text-mint">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 px-3 py-2 font-bold text-mint hover:bg-mint/15"
              href="https://github.com/visshva-r/HisabAgent/blob/main/docs/codex-process.md"
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={16} />
              docs/codex-process.md
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-sky/30 bg-sky/10 px-3 py-2 font-bold text-sky hover:bg-sky/15"
              href="https://github.com/visshva-r/HisabAgent/tree/main/docs/codex-evidence"
              target="_blank"
              rel="noreferrer"
            >
              <ImageIcon size={16} />
              docs/codex-evidence/
            </a>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
