'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  History,
  Info,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { reconcile, runCriticAgain } from '@/lib/reconciliation';
import { buildAuditFiles } from '@/lib/audit';
import { Exception, RunResult, Status, TrustReason } from '@/lib/types';

const sampleCsv = `Date,Transaction ID,Payer Name,Amount,Type,UPI Ref
2026-08-01,TXN891,Anita Stores,2500,Credit,427910018821
2026-08-01,TXN892,Rahul Verma,780,Credit,427910018822
2026-08-01,TXN893,Mohan Dairy,1200,Debit,427910018823
2026-08-01,TXN894,Anita Stores,2500,Credit,427910018821`;

const sampleNotes = `01/08/2026 Anita Stores paid ₹2,500 UPI ref 427910018821
Rahul se ₹780 received today, UPI
Paid Mohan Dairy ₹1,200 ref 427910018823
Cash collection from Ramesh ₹450`;

const AGENTS = [
  ['Planner', 'Reads the evidence and fixes the reconciliation policy'],
  ['Ingestor', 'Normalizes CSV columns, dates and informal notes'],
  ['Matcher', 'Links records by reference, amount and counterparty'],
  ['Critic', 'Challenges duplicates, repeat amounts and weak links'],
  ['Explainer', 'Writes the bilingual owner summary'],
] as const;

const HISTORY_KEY = 'hisabagent:runs';
const LAST_RUN_KEY = 'hisabagent:last-run';
const HISTORY_LIMIT = 5;

type HistoryEntry = { csv: string; notes: string; run: RunResult };

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  matched: { label: 'Matched', className: 'text-mint' },
  partial: { label: 'Partial', className: 'text-sky' },
  review: { label: 'Review', className: 'text-amber' },
  unmatched: { label: 'Unmatched', className: 'text-danger' },
};

const BAND_STYLE = {
  High: 'text-mint',
  Moderate: 'text-amber',
  Low: 'text-danger',
} as const;

function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function Workspace() {
  const [csv, setCsv] = useState(sampleCsv);
  const [notes, setNotes] = useState(sampleNotes);
  const [shop, setShop] = useState('Sharma General Store');
  const [lang, setLang] = useState('both');
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sampleNote, setSampleNote] = useState(false);
  const [llmSummary, setLlmSummary] = useState<{ en: string; hi: string } | null>(null);
  const [llmState, setLlmState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

  useEffect(() => {
    const stored = readHistory();
    setHistory(stored);
    // First visit gets the sample day pre-loaded; a returning owner gets their
    // own last inputs back instead.
    if (!stored.length) {
      setSampleNote(true);
      return;
    }
    const [latest] = stored;
    setCsv(latest.csv);
    setNotes(latest.notes);
    setShop(latest.run.shopName);
    setLang(latest.run.language);
  }, []);

  const inputsEmpty = !csv.trim() && !notes.trim();

  const persist = useCallback((entry: HistoryEntry) => {
    try {
      const next = [entry, ...readHistory().filter((item) => item.run.id !== entry.run.id)].slice(0, HISTORY_LIMIT);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify(entry.run));
      setHistory(next);
    } catch {
      // Storage can be full or blocked; the run itself stays usable in memory.
    }
  }, []);

  function loadDemo() {
    setCsv(sampleCsv);
    setNotes(sampleNotes);
    setShop('Sharma General Store');
    setError('');
    setRun(null);
    resetLlm();
  }

  function resetLlm() {
    setLlmSummary(null);
    setLlmState('idle');
  }

  function execute() {
    if (inputsEmpty) {
      setError('Add a UPI CSV or payment notes first.');
      return;
    }
    const result = reconcile(csv, notes, shop.trim() || 'Your shop', lang);
    if (!result.transactions.length) {
      setRun(null);
      setError('Nothing usable was found. Every row needs an amount. Check the amount column or add ₹ values to the notes.');
      return;
    }
    setError('');
    resetLlm();
    setRun(result);
    setSampleNote(false);
    persist({ csv, notes, run: result });
  }

  function critiqueAgain() {
    if (!run) return;
    const deeper = runCriticAgain(run);
    setRun(deeper);
    resetLlm();
    persist({ csv, notes, run: deeper });
  }

  function restore(entry: HistoryEntry) {
    setCsv(entry.csv);
    setNotes(entry.notes);
    setShop(entry.run.shopName);
    setLang(entry.run.language);
    setRun(entry.run);
    setError('');
    setSampleNote(false);
    resetLlm();
  }

  async function requestLlmSummary() {
    if (!run) return;
    setLlmState('loading');
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: run.shopName,
          language: run.language,
          summary: run.summary,
          exceptions: run.exceptions,
          transactions: run.transactions,
        }),
      });
      const payload = await response.json();
      if (response.ok && payload.ok && typeof payload.en === 'string') {
        setLlmSummary({ en: payload.en, hi: payload.hi });
        setLlmState('ready');
      } else {
        setLlmState('unavailable');
      }
    } catch {
      setLlmState('unavailable');
    }
  }

  function importFile(event: React.ChangeEvent<HTMLInputElement>, target: 'csv' | 'note') {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (target === 'csv' ? setCsv(String(reader.result)) : setNotes(String(reader.result)));
    reader.readAsText(file);
  }

  async function download() {
    if (!run) return;
    const zip = new JSZip();
    buildAuditFiles(run).forEach((file) => zip.file(file.name, file.content));
    const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hisabagent-audit-${run.id}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const kpi = useMemo(() => {
    const ledger = run?.transactions ?? [];
    return {
      inflow: ledger.filter((t) => t.direction === 'credit').reduce((sum, t) => sum + t.amount, 0),
      outflow: ledger.filter((t) => t.direction === 'debit').reduce((sum, t) => sum + t.amount, 0),
      unmatched: ledger.filter((t) => t.status === 'unmatched').length,
      flagged: ledger.filter((t) => t.flags.length).length,
      risk: ledger.filter((t) => t.status !== 'matched').reduce((sum, t) => sum + t.amount, 0),
    };
  }, [run]);

  const shownSummary = llmState === 'ready' && llmSummary ? llmSummary : run?.summary;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-mint">{shop || 'Your shop'}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Reconciliation workspace</h1>
            <p className="mt-2 text-sm text-slate-400">
              Runs in this browser. Nothing leaves the page unless you export it.
              {run && <span className="mono text-slate-500"> · {run.id}</span>}
            </p>
          </div>
          <span className={`text-[11px] font-medium ${llmState === 'ready' ? 'text-sky' : 'text-slate-400'}`}>
            {llmState === 'ready' ? 'Live explainer wording' : 'Offline · no API key'}
          </span>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="panel rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Evidence intake</h2>
              <button
                onClick={loadDemo}
                className="rounded-lg border border-mint/35 bg-mint/10 px-3 py-2 text-xs font-semibold text-mint transition hover:bg-mint/20"
              >
                Load Sharma General Store demo
              </button>
            </div>

            {sampleNote && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky/25 bg-sky/10 px-3 py-2 text-xs text-sky">
                <Info size={14} className="mt-0.5 shrink-0" />
                <p className="flex-1">
                  Sample data loaded: one messy kirana day, including a duplicate ₹2,500 credit. Replace it with your own
                  export any time.
                </p>
                <button onClick={() => setSampleNote(false)} aria-label="Dismiss sample data note" className="shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InputCard title="UPI CSV export" icon={<Upload size={16} className="text-sky" />}>
                <input
                  aria-label="Upload UPI CSV"
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full text-xs"
                  onChange={(event) => importFile(event, 'csv')}
                />
                <textarea
                  aria-label="UPI CSV contents"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  className="mt-3 h-32 w-full resize-none rounded bg-ink/70 p-2 text-[10px] leading-relaxed text-slate-300 outline-none focus:ring-1 focus:ring-mint/40"
                />
              </InputCard>
              <InputCard title="WhatsApp-style notes" icon={<FileText size={16} className="text-mint" />}>
                <input
                  aria-label="Upload payment notes"
                  type="file"
                  accept=".txt"
                  className="w-full text-xs"
                  onChange={(event) => importFile(event, 'note')}
                />
                <textarea
                  aria-label="Payment notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-3 h-32 w-full resize-none rounded bg-ink/70 p-2 text-[11px] leading-relaxed text-slate-300 outline-none focus:ring-1 focus:ring-mint/40"
                />
              </InputCard>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                aria-label="Shop name"
                value={shop}
                onChange={(event) => setShop(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm outline-none focus:border-mint sm:flex-none"
              />
              <select
                aria-label="Language preference"
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm"
              >
                <option value="both">English + Hindi</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              {inputsEmpty && (
                <p className="text-xs text-amber">Add a UPI CSV or payment notes first.</p>
              )}
              <button
                onClick={execute}
                disabled={inputsEmpty}
                aria-disabled={inputsEmpty}
                title={inputsEmpty ? 'Add a UPI CSV or payment notes first' : 'Run the five agents on this evidence'}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-mint px-4 py-2 font-semibold text-ink transition hover:brightness-110 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Play size={17} />
                Run HisabAgent
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <Timeline run={run} />
            {history.length > 0 && <RunHistory history={history} current={run?.id} onRestore={restore} />}
          </div>
        </section>

        {run && (
          <section className="mt-6 space-y-6">
            <DayHealth run={run} kpi={kpi} />

            <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
              <aside className="space-y-5 lg:order-none">
                <Trust run={run} />
                <div className="panel rounded-2xl p-5">
                  <h2 className="font-semibold">Owner explanation</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {llmState === 'ready'
                      ? 'Optional LLM rewrite of wording only. Numbers still come from the deterministic run.'
                      : 'Deterministic Explainer output for this run.'}
                  </p>
                  {lang !== 'hi' && <p className="mt-3 text-sm leading-relaxed text-slate-300">{shownSummary?.en}</p>}
                  {lang !== 'en' && (
                    <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
                      {shownSummary?.hi}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {llmState !== 'ready' && (
                      <button
                        onClick={requestLlmSummary}
                        disabled={llmState === 'loading'}
                        title="Optional. Needs OPENAI_API_KEY on the server; the demo never requires it."
                        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-sky/40 hover:text-sky disabled:opacity-60"
                      >
                        {llmState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                        Rewrite wording (optional LLM)
                      </button>
                    )}
                    {llmState === 'ready' && (
                      <button
                        onClick={resetLlm}
                        className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300"
                      >
                        Show deterministic wording
                      </button>
                    )}
                    {llmState === 'unavailable' && (
                      <span className="text-xs text-slate-400">No API key. Offline explanation unchanged.</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={critiqueAgain}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber/35 bg-amber/10 px-4 py-3 text-sm font-semibold text-amber transition hover:bg-amber/15"
                >
                  <RefreshCw size={16} />
                  Run critic again (pass {run.criticPasses + 1})
                </button>
                <button
                  onClick={download}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky/40 bg-sky/15 px-4 py-3 text-sm font-semibold text-sky transition hover:bg-sky/20"
                >
                  <Download size={16} />
                  Download audit pack (.zip)
                </button>
              </aside>

              <div className="space-y-6">
                <Exceptions run={run} lang={lang} />
                <Transactions run={run} />
                <AuditPreview run={run} />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function InputCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="rounded-xl border border-dashed border-mint/30 bg-mint/5 p-4 text-sm">
      <span className="mb-2 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </span>
      {children}
    </label>
  );
}

function Timeline({ run }: { run: RunResult | null }) {
  return (
    <aside className="panel rounded-2xl p-5">
      <h2 className="font-semibold">Agent trace</h2>
      <p className="mt-1 text-xs text-slate-400">
        {run ? 'Measured on this run. No artificial delays.' : 'Runs top to bottom when you start the agent.'}
      </p>
      <div className="mt-4 space-y-4">
        {AGENTS.map(([agent, detail]) => {
          const event = run?.timeline.find((item) => item.agent === agent);
          return (
            <div key={agent} className="flex gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event ? 'bg-mint' : 'bg-slate-700'}`} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {agent}
                  {event && <span className="mono text-[10px] font-normal text-slate-500">{event.ms}ms</span>}
                </p>
                <p className="text-xs leading-relaxed text-slate-400">{event?.detail || detail}</p>
              </div>
            </div>
          );
        })}
        {run?.timeline
          .filter((event) => event.title.includes('pass'))
          .map((event) => (
            <div key={event.title} className="flex gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {event.title}
                  <span className="mono text-[10px] font-normal text-slate-500">{event.ms}ms</span>
                </p>
                <p className="text-xs leading-relaxed text-slate-400">{event.detail}</p>
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}

function RunHistory({
  history,
  current,
  onRestore,
}: {
  history: HistoryEntry[];
  current?: string;
  onRestore: (entry: HistoryEntry) => void;
}) {
  return (
    <aside className="panel rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <History size={16} className="text-mint" />
        <h2 className="font-semibold">Recent runs</h2>
      </div>
      <p className="mt-1 text-xs text-slate-400">Last {history.length} run(s), kept in this browser only.</p>
      <ul className="mt-3 space-y-2">
        {history.map((entry) => (
          <li key={entry.run.id}>
            <button
              onClick={() => onRestore(entry)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs transition hover:border-mint/40 ${
                entry.run.id === current ? 'border-mint/40 bg-mint/10' : 'border-white/10 bg-black/15'
              }`}
            >
              <Clock size={13} className="shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{entry.run.shopName}</span>
                <span className="text-slate-500">
                  {new Date(entry.run.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {entry.run.transactions.length} records · {entry.run.exceptions.length} open
                </span>
              </span>
              <span className={`mono shrink-0 tabular font-semibold ${BAND_STYLE[entry.run.trust.band]}`}>
                {entry.run.trust.score}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function DayHealth({
  run,
  kpi,
}: {
  run: RunResult;
  kpi: { inflow: number; outflow: number; unmatched: number; flagged: number; risk: number };
}) {
  return (
    <div className="panel rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Day health</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="tabular text-3xl font-bold text-mint">{run.trust.score}</span>
            <span className={`text-sm font-semibold ${BAND_STYLE[run.trust.band]}`}>{run.trust.band} Output Trust</span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-400">{run.trust.guidance}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
          <span>
            In <b className="tabular text-slate-200">{money(kpi.inflow)}</b>
          </span>
          <span>
            Out <b className="tabular text-slate-200">{money(kpi.outflow)}</b>
          </span>
          <span>
            Matched <b className="tabular text-slate-200">{run.trust.breakdown.matchedPct}%</b>
          </span>
          <span>
            Open <b className="tabular text-amber">{run.exceptions.length}</b>
          </span>
          <span>
            Risk <b className="tabular text-amber">{money(kpi.risk)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function ReasonIcon({ kind }: { kind: TrustReason['kind'] }) {
  if (kind === 'warning') return <AlertTriangle size={15} className="mt-px shrink-0 text-amber" />;
  if (kind === 'neutral') return <Info size={15} className="mt-px shrink-0 text-slate-400" />;
  return <CheckCircle2 size={15} className="mt-px shrink-0 text-mint" />;
}

function Trust({ run }: { run: RunResult }) {
  const { trust } = run;
  const breakdown = trust.breakdown;
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Output Trust</h2>
          <p className="mt-1 text-xs text-slate-400">How much of this output stands on independent evidence.</p>
        </div>
        <span className="tabular text-3xl font-bold text-mint">{trust.score}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded bg-white/10">
        <div className="h-full bg-mint/80" style={{ width: `${trust.score}%` }} />
      </div>
      <div className="mt-3 text-xs">
        <span className={`font-semibold ${BAND_STYLE[trust.band]}`}>{trust.band}</span>
        <span className="mt-1 block leading-relaxed text-slate-400">{trust.guidance}</span>
      </div>
      <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-300">
        {trust.reasons.map((reason) => (
          <li key={reason.text} className="flex gap-2">
            <ReasonIcon kind={reason.kind} />
            {reason.text}
          </li>
        ))}
      </ul>
      <details className="mt-4 border-t border-white/10 pt-3 text-xs">
        <summary className="cursor-pointer font-semibold text-mint">How is this calculated?</summary>
        <ul className="mono mt-3 space-y-1 text-[11px] text-slate-400">
          <li>base {breakdown.base}</li>
          <li>
            + {breakdown.matchPoints} for cross-source matches ({breakdown.matchedRecords}/{breakdown.totalRecords} ={' '}
            {breakdown.matchedPct}% × 0.45)
          </li>
          <li>
            − {breakdown.highSeverityPenalty} for {breakdown.highSeverityCount} high-severity exception(s) × 5
          </li>
          <li>− {breakdown.criticPenalty} carried from critic passes (4 per pulled-back link)</li>
          <li>
            = {breakdown.raw}, clamped to {breakdown.floor}-{breakdown.ceiling} → <b className="text-mint">{trust.score}</b>
          </li>
        </ul>
        <p className="mt-2 leading-relaxed text-slate-500">
          Bands: 80+ High, 55-79 Moderate, below 55 Low. Deterministic: the same evidence always produces the same score.
        </p>
      </details>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const style = STATUS_STYLE[status];
  return <span className={`text-[11px] font-semibold ${style.className}`}>{style.label}</span>;
}

function Transactions({ run }: { run: RunResult }) {
  return (
    <div className="panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
        <h2 className="font-semibold">Reconciled ledger</h2>
        <p className="text-xs text-slate-500 lg:hidden">Scroll sideways for evidence →</p>
      </div>
      <div className="scroll-shadow">
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-y border-white/10 bg-black/15 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="p-3 font-medium">Date</th>
                <th className="font-medium">Party / reference</th>
                <th className="font-medium">Amount</th>
                <th className="font-medium">Source</th>
                <th className="font-medium">Status</th>
                <th className="font-medium">Confidence</th>
                <th className="p-3 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {run.transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-white/5 align-top">
                  <td className="mono p-3 text-slate-400">{transaction.date}</td>
                  <td className="py-3">
                    <b className="font-semibold">{transaction.party}</b>
                    <p className="mono text-[10px] text-slate-500">{transaction.reference}</p>
                  </td>
                  <td className="tabular py-3">{money(transaction.amount)}</td>
                  <td className="py-3 text-slate-400">{transaction.source === 'upi' ? 'UPI' : 'Note'}</td>
                  <td className="py-3">
                    <StatusBadge status={transaction.status} />
                  </td>
                  <td className="tabular py-3">{transaction.confidence}%</td>
                  <td className="max-w-[260px] p-3 text-[11px] leading-relaxed text-slate-400">
                    {transaction.matchReason}
                    {transaction.flags.length > 0 && (
                      <span className="mt-1 flex items-start gap-1 text-amber">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        {transaction.flags.join(' · ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuditPreview({ run }: { run: RunResult }) {
  const files = useMemo(() => buildAuditFiles(run), [run]);
  return (
    <div className="panel rounded-2xl p-5">
      <h2 className="font-semibold">Audit pack preview</h2>
      <p className="mt-1 text-xs text-slate-400">
        Exactly what the ZIP contains. Same content, generated once for both the preview and the download.
      </p>
      <div className="mt-4 space-y-2">
        {files.map((file) => {
          const lines = file.content.split('\n');
          const preview = lines.slice(0, file.name.endsWith('.json') ? 12 : 5).join('\n');
          return (
            <details key={file.name} className="group rounded-lg border border-white/10 bg-black/15">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 text-xs">
                <ChevronRight size={13} className="shrink-0 text-mint transition group-open:rotate-90" />
                <span className="mono font-semibold">{file.name}</span>
                <span className="text-slate-500">{file.description}</span>
                <span className="mono ml-auto text-[10px] text-slate-600">{lines.length} lines</span>
              </summary>
              <pre className="mono max-h-56 overflow-auto border-t border-white/10 p-3 text-[10px] leading-relaxed text-slate-400">
                {preview}
                {lines.length > (file.name.endsWith('.json') ? 12 : 5) && '\n…'}
              </pre>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Turns an exception into a message a shop owner would actually send on
 * WhatsApp. No internal vocabulary, scores, or agent names.
 */
export function reminder(exception: Exception, shop: string, lang: string) {
  const amount = money(exception.amount);
  const templates: Record<string, { en: string; hi: string }> = {
    duplicate: {
      en: `Namaste! ${shop} se. Aapka ${amount} ka payment mere records me do baar aa gaya hai. Ek hi baar bheja tha na? UPI ka screenshot ya reference bhej dijiye, main hisaab theek kar deta hoon. Dhanyavaad!`,
      hi: `नमस्ते! ${shop} से। आपका ${amount} का पेमेंट मेरे रिकॉर्ड में दो बार आ गया है। एक ही बार भेजा था ना? UPI का स्क्रीनशॉट या रेफरेंस भेज दीजिए, मैं हिसाब ठीक कर देता हूँ। धन्यवाद!`,
    },
    'amount-mismatch': {
      en: `Namaste! ${shop} se. Aapke payment me ${amount} tak ka farak aa raha hai. Mere yahan alag amount dikh raha hai. Kitna bheja tha, ek baar bata dijiye? Baaki ka main adjust kar deta hoon.`,
      hi: `नमस्ते! ${shop} से। आपके पेमेंट में ${amount} तक का फ़र्क आ रहा है। मेरे यहाँ अलग रकम दिख रही है। कितना भेजा था, एक बार बता दीजिए? बाकी मैं ठीक कर देता हूँ।`,
    },
    partial: {
      en: `Namaste! ${shop} se. Aapka ${amount} ka payment aaya hai par pura amount match nahi ho raha. Baaki paisa baad me bhejna hai ya poora ho gaya? Bata dijiye.`,
      hi: `नमस्ते! ${shop} से। आपका ${amount} का पेमेंट आया है पर पूरी रकम मैच नहीं हो रही। बाकी पैसा बाद में भेजना है या पूरा हो गया? बता दीजिए।`,
    },
    unmatched: {
      en: `Namaste! ${shop} se. ${amount} ka payment mere UPI record me nahi mil raha hai. Aapne bheja tha? Screenshot bhej dijiye to main confirm kar leta hoon.`,
      hi: `नमस्ते! ${shop} से। ${amount} का पेमेंट मेरे UPI रिकॉर्ड में नहीं मिल रहा। आपने भेजा था? स्क्रीनशॉट भेज दीजिए तो मैं कन्फर्म कर लेता हूँ।`,
    },
    'date-outlier': {
      en: `Namaste! ${shop} se. ${amount} ka payment isse pehle bhi isi amount ka aaya tha. Ye naya payment hai ya wahi purana? Ek baar confirm kar dijiye.`,
      hi: `नमस्ते! ${shop} से। ${amount} का पेमेंट इससे पहले भी इसी रकम का आया था। ये नया पेमेंट है या वही पुराना? एक बार कन्फर्म कर दीजिए।`,
    },
    'round-amount': {
      en: `Namaste! ${shop} se. ${amount} likha hai par exact amount confirm karna tha. UPI ka screenshot bhej dijiye?`,
      hi: `नमस्ते! ${shop} से। ${amount} लिखा है पर एक्ज़ैक्ट रकम कन्फर्म करनी थी। UPI का स्क्रीनशॉट भेज दीजिए?`,
    },
    'similar-party': {
      en: `Namaste! ${shop} se. ${amount} ka payment do naam se dikh raha hai. Aapne ek baar bheja tha ya do baar? Bata dijiye to main theek kar deta hoon.`,
      hi: `नमस्ते! ${shop} से। ${amount} का पेमेंट दो नाम से दिख रहा है। आपने एक बार भेजा था या दो बार? बता दीजिए तो मैं ठीक कर देता हूँ।`,
    },
    'low-evidence': {
      en: `Namaste! ${shop} se. ${amount} ka payment aaya hai par kiska hai ye confirm nahi ho raha. UPI reference ya naam bhej dijiye to sahi jagah chadha deta hoon.`,
      hi: `नमस्ते! ${shop} से। ${amount} का पेमेंट आया है पर किसका है ये कन्फर्म नहीं हो रहा। UPI रेफरेंस या नाम भेज दीजिए तो मैं सही जगह चढ़ा देता हूँ।`,
    },
  };
  const copy = templates[exception.rule] || templates['low-evidence'];
  if (lang === 'en') return copy.en;
  if (lang === 'hi') return copy.hi;
  return `${copy.en}\n\n${copy.hi}`;
}

const SEVERITY_LABEL = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

const SEVERITY_COLOR = {
  high: 'text-danger',
  medium: 'text-amber',
  low: 'text-sky',
} as const;

function Exceptions({ run, lang }: { run: RunResult; lang: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, 'resolved' | 'kept'>>({});

  // Fresh run → clear local resolve state for that run id.
  useEffect(() => {
    setDone({});
  }, [run.id]);

  async function copy(exception: Exception) {
    try {
      await navigator.clipboard.writeText(reminder(exception, run.shopName, lang));
      setCopied(exception.id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  const open = run.exceptions.filter((e) => !done[e.id]);
  const closed = run.exceptions.filter((e) => done[e.id]);

  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="text-amber" size={18} />
          <h2 className="font-semibold">Your decision queue</h2>
        </div>
        <p className="text-xs text-slate-400">
          {open.length} open
          {closed.length > 0 && <span> · {closed.length} marked</span>}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">Items the agent refused to decide alone. Resolve locally for this session.</p>

      {run.exceptions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Nothing pending. Every record found independent evidence.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10">
          {run.exceptions.map((exception) => {
            const state = done[exception.id];
            return (
              <li
                key={exception.id}
                className={`flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between ${
                  state ? 'opacity-55' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium">
                    <span className={SEVERITY_COLOR[exception.severity]}>{SEVERITY_LABEL[exception.severity]}</span>
                    <span className="text-slate-500"> · {exception.rule}</span>
                    {state && (
                      <span className="ml-2 text-slate-400">
                        · {state === 'resolved' ? 'resolved' : 'kept open'}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 font-semibold">{exception.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{exception.detail}</p>
                  <p className="mt-2 text-xs text-mint">→ {exception.suggestedAction}</p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:items-stretch">
                  <button
                    onClick={() => copy(exception)}
                    className="rounded-lg border border-mint/30 px-3 py-1.5 text-xs font-semibold text-mint hover:bg-mint/10"
                  >
                    {copied === exception.id ? 'Copied' : 'Copy WhatsApp'}
                  </button>
                  {!state ? (
                    <>
                      <button
                        onClick={() => setDone((prev) => ({ ...prev, [exception.id]: 'resolved' }))}
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-mint/40 hover:text-mint"
                      >
                        Mark resolved
                      </button>
                      <button
                        onClick={() => setDone((prev) => ({ ...prev, [exception.id]: 'kept' }))}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Keep open
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() =>
                        setDone((prev) => {
                          const next = { ...prev };
                          delete next[exception.id];
                          return next;
                        })
                      }
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
