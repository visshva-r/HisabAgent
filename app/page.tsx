import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <Nav />
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 lg:pb-24 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold tracking-tight text-mint">HisabAgent</p>
            <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-[-.03em] sm:text-5xl lg:text-6xl">
              Messy UPI and WhatsApp notes, turned into books you can defend.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300 sm:text-lg">
              A deterministic back-office agent for Indian MSMEs. It matches what it can prove, holds what it cannot,
              and explains the day in English and Hindi. Offline, with no API key.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/workspace"
                className="inline-flex items-center gap-2 rounded-lg bg-mint px-5 py-3 font-semibold text-ink transition hover:brightness-110"
              >
                Open workspace <ArrowRight size={17} />
              </Link>
              <Link href="/evals" className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-mint hover:underline">
                See 12 honest evals
              </Link>
            </div>
            <p className="mt-8 text-sm text-slate-500">No login · Hindi + English · Audit pack export</p>
          </div>

          <div className="grain panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold">Sharma General Store</p>
                <p className="mono text-[11px] text-slate-500">1 Aug 2026 · sample day</p>
              </div>
              <div className="text-right">
                <p className="tabular text-2xl font-bold text-mint">74</p>
                <p className="text-[10px] uppercase tracking-wide text-amber">Moderate trust</p>
              </div>
            </div>

            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Ledger</p>
              <ul className="mt-2 space-y-2 text-sm">
                <li className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-medium">Anita Stores</span>
                    <span className="mono ml-2 text-[10px] text-slate-500">427910018821</span>
                  </span>
                  <span className="tabular shrink-0 text-mint">₹2,500 · matched</span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-medium">Anita Stores</span>
                    <span className="mono ml-2 text-[10px] text-slate-500">same ref again</span>
                  </span>
                  <span className="tabular shrink-0 text-amber">₹2,500 · review</span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-medium">Ramesh</span>
                    <span className="ml-2 text-[10px] text-slate-500">cash note only</span>
                  </span>
                  <span className="tabular shrink-0 text-danger">₹450 · unmatched</span>
                </li>
              </ul>
            </div>

            <div className="px-4 py-3 sm:px-5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Owner decision</p>
              <p className="mt-2 text-sm font-medium">Possible duplicate ₹2,500</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Anita appears twice on the same UPI reference. Confirm with the customer before closing the day.
              </p>
              <p className="mt-3 text-xs text-mint">WhatsApp reminder ready · kept in the human queue</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-black/20">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-3">
          <div>
            <h2 className="font-semibold">Prove the match, or hold it.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Shared UPI references earn high confidence. Amount-only links and ambiguous counterparties stay open.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Output Trust is arithmetic.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Every score shows its formula. Deeper critic passes can only lower trust, never quietly restore it.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Tested against overreach.</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Twelve fixtures, including adversarial ones and two documented limitations that are expected to fail.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
