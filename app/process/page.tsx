import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { ArrowRight } from 'lucide-react';

const agents = [
  ['01', 'Planner', 'Profiles the evidence and fixes policy before any record is touched.'],
  ['02', 'Ingestor', 'Normalizes CSV (comma / semicolon / tab) and informal payment notes.'],
  ['03', 'Matcher', 'Links by reference, amount and party. Never upgrades weak evidence.'],
  ['04', 'Critic', 'Downgrades only: duplicates, fuzzy names, date outliers, GST mismatches.'],
  ['05', 'Explainer', 'States the same numbers in English and Hindi, including what is open.'],
] as const;

const principles = [
  ['Offline first', 'The full reconciliation path runs in the browser with zero API keys.'],
  ['Prove or hold', 'Matches need independent evidence. Ambiguous money stays in a human queue.'],
  ['Trust is arithmetic', 'Output Trust is a published formula, not a vibe score or LLM claim.'],
  ['Test overreach', 'Golden and adversarial fixtures guard regressions, including known gaps.'],
] as const;

export default function Process() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="relative mx-auto max-w-6xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-mint">Architecture</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          A back-office agent
          <br />
          you can inspect.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          HisabAgent is a deterministic multi-agent pipeline for messy Indian MSME payments. Each stage is a typed
          module, timed for real, and recorded in the downloadable audit pack.
        </p>

        <div className="panel mt-10 rounded-2xl p-5 sm:p-7">
          <h2 className="font-semibold">Pipeline</h2>
          <p className="mt-1 text-sm text-slate-400">
            One module each under <span className="mono text-slate-300">lib/agents/</span>. The same trace ships in the
            audit pack after every run.
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

        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          {principles.map(([title, detail]) => (
            <article key={title} className="border-t border-white/10 pt-4">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{detail}</p>
            </article>
          ))}
        </section>

        <p className="mt-10 text-sm text-slate-500">
          Deeper write-up:{' '}
          <a className="text-mint hover:underline" href="https://github.com/visshva-r/HisabAgent/blob/main/docs/architecture.md">
            docs/architecture.md
          </a>
        </p>
      </div>
      <Footer />
    </main>
  );
}
