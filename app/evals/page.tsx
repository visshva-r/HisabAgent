'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Play, Timer } from 'lucide-react';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { EvalRow, fixtures, runAllFixtures, summarize } from '@/lib/evals';

const GROUP_STYLE = {
  golden: 'text-mint',
  adversarial: 'text-violet',
} as const;

const BAND_STYLE = {
  High: 'text-mint',
  Moderate: 'text-amber',
  Low: 'text-danger',
} as const;

export default function Evals() {
  const [rows, setRows] = useState<EvalRow[] | null>(null);
  const stats = rows ? summarize(rows) : null;

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-mint">Measured behaviour</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Evals Lab</h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-slate-400">
          Twelve fixtures run in your browser against the same deterministic engine the workspace uses: eight golden
          scenarios and four adversarial ones built to make the agent overreach. Two fixtures are documented limitations
          and are expected to fail — they stay in the suite so the gap cannot be quietly lost.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={() => setRows(runAllFixtures())}
            className="inline-flex items-center gap-2 rounded-xl bg-mint px-5 py-3 font-semibold text-ink transition hover:brightness-110"
          >
            <Play size={17} />
            Run all {fixtures.length} evals
          </button>
          {stats && (
            <p className="text-sm text-slate-300">
              <b className="text-mint">{stats.passing}</b> passing · <b className="text-amber">{stats.knownLimitations}</b>{' '}
              documented limitation(s) ·{' '}
              {stats.regressions.length ? (
                <b className="text-danger">{stats.regressions.length} regression(s)</b>
              ) : (
                <span className="text-slate-400">no regressions against documented behaviour</span>
              )}
            </p>
          )}
        </div>

        <dl className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs leading-relaxed sm:grid-cols-2">
          <div className="flex gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint" />
            <div>
              <dt className="font-semibold">PASS / FAIL</dt>
              <dd className="text-slate-400">
                The result of that fixture&apos;s assertion. FAIL on a documented limitation is the honest, expected
                outcome — not a crash.
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <HelpCircle size={15} className="mt-0.5 shrink-0 text-sky" />
            <div>
              <dt className="font-semibold">Output Trust</dt>
              <dd className="text-slate-400">
                The trust score the engine assigned to that fixture&apos;s own output (0–100). It measures the reconciled
                result, not whether the assertion passed — a correctly cautious run scores low on purpose.
              </dd>
            </div>
          </div>
        </dl>

        <p className="mt-6 text-xs text-slate-500 lg:hidden">Scroll the table sideways to see trust and reasons →</p>
        <div className="scroll-shadow mt-3 rounded-2xl border border-white/10">
          <div className="overflow-auto rounded-2xl">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="p-4 font-medium">Scenario</th>
                  <th className="font-medium">Expected check</th>
                  <th className="font-medium">Actual observed</th>
                  <th className="font-medium">Result</th>
                  <th className="font-medium" title="Trust score of this fixture's reconciled output, 0-100">
                    Output Trust
                  </th>
                  <th className="font-medium">Latency</th>
                  <th className="p-4 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((fixture, index) => {
                  const row = rows?.[index];
                  return (
                    <tr key={fixture.id} className="border-t border-white/10 align-top">
                      <td className="p-4">
                        <p className="font-semibold">{fixture.name}</p>
                        <span className={`mt-1 block text-[10px] font-medium uppercase tracking-wide ${GROUP_STYLE[fixture.group]}`}>
                          {fixture.group}
                        </span>
                        {fixture.outcome === 'known-limitation' && (
                          <span className="mt-1 block text-[10px] font-medium text-amber">
                            documented limitation
                          </span>
                        )}
                      </td>
                      <td className="max-w-[190px] py-4 text-xs leading-relaxed text-slate-300">{fixture.expected}</td>
                      <td className="max-w-[190px] py-4 text-xs leading-relaxed text-slate-400">{row?.actual || '—'}</td>
                      <td className="py-4">
                        {row ? (
                          row.pass ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-mint">
                              <CheckCircle2 size={14} />
                              PASS
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber">
                              <AlertTriangle size={14} />
                              FAIL
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-500">Ready</span>
                        )}
                        {row && !row.matchesDocumentedBehaviour && (
                          <span className="mt-1 block text-[10px] font-semibold uppercase text-danger">regression</span>
                        )}
                      </td>
                      <td className="tabular py-4 text-xs">
                        {row ? (
                          <>
                            <b>{row.trust}</b>
                            <span className="text-slate-500">/100</span>
                            <span className={`mt-0.5 block text-[10px] ${BAND_STYLE[row.band as 'High']}`}>{row.band}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="tabular py-4 text-xs text-slate-400">
                        {row ? (
                          <span className="flex items-center gap-1">
                            <Timer size={13} />
                            {row.ms < 1 ? '<1ms' : `${Math.round(row.ms)}ms`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-[240px] p-4 text-xs leading-relaxed text-slate-400">{row?.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-slate-500">
          The same fixtures run headless via <span className="mono text-slate-400">npm run eval</span> and are asserted in{' '}
          <span className="mono text-slate-400">npm test</span>, where any change of behaviour on a fixture — including a
          documented limitation starting to pass — is reported as a regression to review.
        </p>
      </div>
      <Footer />
    </main>
  );
}
