import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { ArrowRight, FileText, Image as ImageIcon } from 'lucide-react';

const agents = [
  ['01', 'Planner', 'Profiles the evidence and fixes policy before any record is touched.'],
  ['02', 'Ingestor', 'Normalizes CSV (comma / semicolon / tab) and informal payment notes.'],
  ['03', 'Matcher', 'Links by reference, amount and party — never upgrades weak evidence.'],
  ['04', 'Critic', 'Downgrades only: duplicates, fuzzy names, date outliers, GST mismatches.'],
  ['05', 'Explainer', 'States the same numbers in English and Hindi, including what is open.'],
] as const;

export default function Process() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="relative mx-auto max-w-6xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-mint">How it is built</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          A back-office agent
          <br />
          you can inspect.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          Built primarily with OpenAI Codex (5.6 Terra, High). Product direction stayed outside the loop; architecture,
          agents, UI, tests and review fixes were implemented inside it.
        </p>

        <div className="panel mt-10 rounded-2xl p-5 sm:p-7">
          <h2 className="font-semibold">Pipeline</h2>
          <p className="mt-1 text-sm text-slate-400">
            One module each under <span className="mono text-slate-300">lib/agents/</span>. Timed for real on every run;
            the same trace ships in the audit pack.
          </p>
          <ol className="mt-6 space-y-0">
            {agents.map((a, i) => (
              <li key={a[0]} className="flex gap-3 sm:gap-4">
                <div className="flex w-8 flex-col items-center">
                  <span className="mono grid h-8 w-8 place-items-center rounded-lg border border-mint/30 bg-ink text-xs text-mint">
                    {a[0]}
                  </span>
                  {i < agents.length - 1 && <span className="my-1 w-px flex-1 bg-white/10" />}
                </div>
                <div className={`min-w-0 flex-1 pb-5 ${i === agents.length - 1 ? 'pb-0' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{a[1]}</p>
                    {i < agents.length - 1 && (
                      <ArrowRight size={14} className="hidden text-mint/50 sm:inline" aria-hidden />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{a[2]}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <section className="mt-12 border-t border-white/10 pt-10">
          <h2 className="text-xl font-bold tracking-tight">OpenAI Codex evidence</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
            Judge-facing trail: locked charter, multi-file diffs, build verification, and polish/review screenshots.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-400">
            <li>
              <span className="font-medium text-slate-200">Locked charter</span> — Project folder, tracks, multi-agent
              architecture, no-key demo.
            </li>
            <li>
              <span className="font-medium text-slate-200">Agentic implementation</span> — engine, pages, samples, evals,
              docs in iterative Codex passes.
            </li>
            <li>
              <span className="font-medium text-slate-200">Verify + review</span> — build/eval loops, then QA remediation
              without changing product identity.
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/10 px-3 py-2 font-semibold text-mint hover:bg-mint/15"
              href="https://github.com/visshva-r/HisabAgent/blob/main/docs/codex-process.md"
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={16} />
              docs/codex-process.md
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 font-semibold text-slate-300 hover:border-sky/40 hover:text-sky"
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
