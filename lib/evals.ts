import { reconcile } from './reconciliation';
import { RunResult } from './types';

export type FixtureGroup = 'golden' | 'adversarial';

export type Fixture = {
  id: string;
  name: string;
  group: FixtureGroup;
  /** The assertion, written as a claim about the agent. */
  expected: string;
  /** What honestly happens today. `known-limitation` fixtures are expected to fail. */
  outcome: 'pass' | 'known-limitation';
  csv: string;
  notes: string;
  check: (run: RunResult) => { pass: boolean; actual: string; reason: string };
};

export type EvalRow = {
  id: string;
  name: string;
  group: FixtureGroup;
  expected: string;
  outcome: Fixture['outcome'];
  pass: boolean;
  actual: string;
  reason: string;
  trust: number;
  band: string;
  ms: number;
  /** False means the suite regressed against the documented behaviour. */
  matchesDocumentedBehaviour: boolean;
};

const count = (run: RunResult, status: string) => run.transactions.filter((t) => t.status === status).length;
const generic = (party: string) => party === 'WhatsApp note' || party === 'UPI counterparty' || party === '';

export const fixtures: Fixture[] = [
  {
    id: 'clean-upi',
    name: 'Clean UPI CSV',
    group: 'golden',
    expected: 'Shared reference produces a match with confidence ≥ 90',
    outcome: 'pass',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita,REF111',
    notes: 'Anita paid ₹2,500 UPI ref REF111',
    check: (run) => {
      const matched = run.transactions.find((t) => t.status === 'matched');
      return {
        pass: !!matched && matched.confidence >= 90,
        actual: matched ? `matched at confidence ${matched.confidence}` : 'no match produced',
        reason: matched
          ? `confidence ${matched.confidence} ${matched.confidence >= 90 ? '≥' : '<'} 90`
          : 'expected a high-confidence match, found none',
      };
    },
  },
  {
    id: 'messy-csv',
    name: 'Messy headers + duplicate row',
    group: 'golden',
    expected: 'Odd headers parse and the repeated row is flagged',
    outcome: 'pass',
    csv: 'txn_date,amt,dr/cr,remark,utr\n01/08/2026,"2,500",CR,ANITA,REF1\n01/08/2026,"2,500",CR,ANITA,REF1',
    notes: '',
    check: (run) => {
      const flagged = run.transactions.filter((t) => t.flags.length).length;
      const duplicates = run.exceptions.filter((e) => e.rule === 'duplicate').length;
      return {
        pass: flagged > 0 && duplicates > 0,
        actual: `${run.transactions.length} rows parsed, ${flagged} flagged, ${duplicates} duplicate exception(s)`,
        reason: duplicates ? 'repeated row held back before it reached the books' : 'no duplicate signal raised',
      };
    },
  },
  {
    id: 'whatsapp-only',
    name: 'WhatsApp notes only',
    group: 'golden',
    expected: 'Informal note becomes a ledger record',
    outcome: 'pass',
    csv: '',
    notes: 'Ramesh se ₹450 received today',
    check: (run) => {
      const notes = run.transactions.filter((t) => t.source === 'note');
      return {
        pass: notes.length > 0,
        actual: `${notes.length} note record(s), amount ₹${notes[0]?.amount ?? 0}`,
        reason: notes.length ? 'amount and direction extracted from prose' : 'nothing extracted',
      };
    },
  },
  {
    id: 'mixed',
    name: 'Mixed CSV + notes',
    group: 'golden',
    expected: 'Cross-source evidence is cited on the match',
    outcome: 'pass',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-01,1200,Credit,Mohan,REF777',
    notes: 'Mohan paid ₹1,200 UPI ref REF777',
    check: (run) => {
      const matched = run.transactions.find((t) => t.status === 'matched' && /note|upi|reference/i.test(t.matchReason));
      return {
        pass: !!matched,
        actual: matched ? matched.matchReason : 'no cross-source match',
        reason: matched ? 'match names the source it was confirmed against' : 'no cross-source evidence recorded',
      };
    },
  },
  {
    id: 'duplicates',
    name: 'Duplicate payment claim',
    group: 'golden',
    expected: 'Duplicate reaches the owner queue as high severity',
    outcome: 'pass',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-01,900,Credit,Ravi,REF9\n2026-08-01,900,Credit,Ravi,REF9',
    notes: '',
    check: (run) => {
      const high = run.exceptions.filter((e) => e.rule === 'duplicate' && e.severity === 'high').length;
      return {
        pass: high > 0,
        actual: `${high} high-severity duplicate exception(s)`,
        reason: high ? 'duplicate credit blocked from the books' : 'duplicate credit silently accepted',
      };
    },
  },
  {
    id: 'partial',
    name: 'Near-amount payment',
    group: 'golden',
    expected: 'Close-but-unequal amounts route to a human',
    outcome: 'pass',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-01,1000,Credit,Ravi,REF2',
    notes: 'Ravi payment ₹1,050 received',
    check: (run) => {
      const partial = count(run, 'partial');
      return {
        pass: partial > 0 && run.exceptions.some((e) => e.rule === 'partial'),
        actual: `${partial} partial record(s), ${run.exceptions.length} exception(s)`,
        reason: partial ? 'no forced match; sent for confirmation' : 'partial routing did not trigger',
      };
    },
  },
  {
    id: 'missing-ref',
    name: 'Missing references (hard)',
    group: 'golden',
    expected: 'Should still reach a high-confidence match without any reference',
    outcome: 'known-limitation',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-01,700,Credit,Walk In,',
    notes: 'Cash collection ₹700',
    check: (run) => {
      const strong = run.transactions.find((t) => t.status === 'matched' && t.confidence >= 90);
      return {
        pass: !!strong,
        actual: strong ? `matched at ${strong.confidence}` : `held open: ${run.exceptions.length} owner decision(s)`,
        reason: strong
          ? 'reached high confidence without a reference'
          : 'by design: name-and-amount only evidence never earns high confidence',
      };
    },
  },
  {
    id: 'hindi-only',
    name: 'Hindi counterparty name (hard)',
    group: 'golden',
    expected: 'Should extract the Devanagari counterparty name',
    outcome: 'known-limitation',
    csv: '',
    notes: 'रमेश से ₹450 मिले',
    check: (run) => {
      const note = run.transactions.find((t) => t.source === 'note');
      return {
        pass: !!note && !generic(note.party),
        actual: note ? `amount ₹${note.amount}, party “${note.party}”` : 'nothing parsed',
        reason: note && generic(note.party)
          ? 'known gap: amount parsed, Devanagari name not tokenised yet'
          : `party read as “${note?.party ?? 'none'}”`,
      };
    },
  },
  {
    id: 'over-matching',
    name: 'Over-matching bait',
    group: 'adversarial',
    expected: 'Two same-amount customers must not produce a confident match',
    outcome: 'pass',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-02,1500,Credit,Anita Devi,REF501\n2026-08-02,1500,Credit,Anita Kumari,REF502',
    notes: 'Anita ne ₹1,500 bheje, UPI',
    check: (run) => {
      const matched = count(run, 'matched');
      const ambiguous = run.exceptions.some((e) => /ambiguous|unclear/i.test(e.title));
      return {
        pass: matched === 0 && ambiguous,
        actual: `${matched} matched, ${count(run, 'review')} in review, ${run.exceptions.length} exception(s)`,
        reason:
          matched === 0 && ambiguous
            ? 'refused to pick between identical amounts and said so'
            : 'accepted a coin-toss match',
      };
    },
  },
  {
    id: 'corrupt-csv',
    name: 'Corrupt export',
    group: 'adversarial',
    expected: 'Unreadable rows are dropped, not invented',
    outcome: 'pass',
    csv: 'Date;Amount;Type\n%%%%\n,,,\n2026-08-03;abc;Credit\n;;',
    notes: '',
    check: (run) => ({
      pass: run.transactions.length === 0,
      actual: `${run.transactions.length} record(s) created, ${run.exceptions.length} exception(s)`,
      reason: run.transactions.length
        ? `invented ${run.transactions.length} record(s) from unusable rows`
        : 'no row survived validation and no amount was guessed from a date',
    }),
  },
  {
    id: 'hindi-log',
    name: 'All-Hindi day log',
    group: 'adversarial',
    expected: 'Amounts and direction parse; unnamed parties stay in the queue',
    outcome: 'pass',
    csv: '',
    notes: 'रमेश से ₹450 मिले\nमोहन डेयरी को ₹1,200 दिया\nसुनीता से ₹2,000 आए',
    check: (run) => {
      const amounts = run.transactions.map((t) => t.amount);
      const debits = run.transactions.filter((t) => t.direction === 'debit').length;
      const genericParties = run.transactions.filter((t) => generic(t.party)).length;
      const pass =
        run.transactions.length === 3 &&
        amounts.includes(450) &&
        amounts.includes(1200) &&
        amounts.includes(2000) &&
        debits === 1 &&
        genericParties === 3 &&
        run.exceptions.length === 3;
      return {
        pass,
        actual: `${run.transactions.length} records, ${debits} debit, ${genericParties} unnamed, ${run.exceptions.length} exception(s)`,
        reason: pass
          ? 'money and direction read correctly; every unnamed record was queued instead of guessed'
          : 'Hindi log handling drifted from documented behaviour',
      };
    },
  },
  {
    id: 'gst-rounding',
    name: 'GST / rounding mismatch',
    group: 'adversarial',
    expected: 'Same reference with a different amount is escalated, not matched',
    outcome: 'pass',
    csv: 'Date,Amount,Type,Name,Ref\n2026-08-04,1180,Credit,Verma Traders,REF701\n2026-08-04,999.5,Credit,Suresh,REF702',
    notes: 'Verma Traders paid ₹1,000 ref REF701\nSuresh se ₹1,000 mile',
    check: (run) => {
      const mismatch = run.exceptions.find((e) => e.rule === 'amount-mismatch');
      const matched = count(run, 'matched');
      return {
        pass: matched === 0 && !!mismatch,
        actual: mismatch
          ? `${matched} matched, escalated: ${mismatch.title}`
          : `${matched} matched, no amount-mismatch exception`,
        reason: mismatch
          ? 'reference link kept, amount disagreement surfaced as high severity'
          : 'amount difference on a shared reference was not escalated',
      };
    },
  },
];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function runFixture(fixture: Fixture): EvalRow {
  const started = now();
  const run = reconcile(fixture.csv, fixture.notes);
  const result = fixture.check(run);
  const ms = Math.round((now() - started) * 100) / 100;
  const expectedToPass = fixture.outcome === 'pass';
  return {
    id: fixture.id,
    name: fixture.name,
    group: fixture.group,
    expected: fixture.expected,
    outcome: fixture.outcome,
    pass: result.pass,
    actual: result.actual,
    reason: result.reason,
    trust: run.trust.score,
    band: run.trust.band,
    ms,
    matchesDocumentedBehaviour: result.pass === expectedToPass,
  };
}

export function runAllFixtures(): EvalRow[] {
  return fixtures.map(runFixture);
}

export function summarize(rows: EvalRow[]) {
  return {
    total: rows.length,
    passing: rows.filter((row) => row.pass).length,
    knownLimitations: rows.filter((row) => row.outcome === 'known-limitation').length,
    regressions: rows.filter((row) => !row.matchesDocumentedBehaviour).map((row) => row.id),
  };
}
