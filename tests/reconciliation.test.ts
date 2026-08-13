import { describe, expect, it } from 'vitest';
import { plan } from '../lib/agents/planner';
import { parseCsv, parseNotes, ingest } from '../lib/agents/ingestor';
import { match } from '../lib/agents/matcher';
import { critique } from '../lib/agents/critic';
import { isDateOnly, nameSimilarity, parseAmount, parseDate } from '../lib/agents/normalize';
import { reconcile, runCriticAgain } from '../lib/reconciliation';
import { buildAuditFiles } from '../lib/audit';
import { fixtures, runAllFixtures, summarize } from '../lib/evals';

describe('normalization primitives', () => {
  it('prefers currency-marked amounts over leading dates', () => {
    expect(parseAmount('01/08/2026 Anita Stores paid ₹2,500 UPI ref 427910018821')).toBe(2500);
    expect(parseAmount('2,500')).toBe(2500);
    expect(parseAmount('Rs 1,050.50 received')).toBe(1050.5);
  });
  it('refuses to read an amount out of a bare date or timestamp', () => {
    expect(parseAmount('2026-08-03')).toBe(0);
    expect(parseAmount('01/08/2026 10:30')).toBe(0);
    expect(isDateOnly('2026-08-03')).toBe(true);
    expect(isDateOnly('₹2,500')).toBe(false);
  });
  it('stores every date in ISO form', () => {
    expect(parseDate('01/08/2026 Anita paid', '2026-01-01')).toBe('2026-08-01');
    expect(parseDate('no date here', '2026-08-09')).toBe('2026-08-09');
  });
  it('treats shop suffixes as noise when comparing counterparties', () => {
    expect(nameSimilarity('ANITA', 'Anita Stores')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Anita Devi', 'Anita Kumari')).toBeLessThan(0.82);
  });
});

describe('planner agent', () => {
  it('detects both sources and keeps the reference-aware policy', () => {
    const result = plan('Date,Amount,Type,Name,Ref\n2026-08-01,100,Credit,A,R1', 'A paid ₹100 ref R1');
    expect(result.sources).toEqual({ csv: true, notes: true });
    expect(result.policy.amountTolerancePct).toBe(0.1);
    expect(result.steps).toHaveLength(5);
  });
  it('tightens the amount window when no reference column exists', () => {
    const result = plan('Date,Amount,Type,Name\n2026-08-01,100,Credit,A', '');
    expect(result.policy.amountTolerancePct).toBe(0.05);
    expect(result.observations.join(' ')).toContain('No reference column');
  });
});

describe('ingestor agent', () => {
  it('parses quoted Indian amounts without splitting the amount column', () => {
    const rows = parseCsv('txn_date,amt,dr/cr,remark,utr\n01/08/2026,"2,500",CR,ANITA STORE,REF-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 2500, direction: 'credit', party: 'ANITA STORE', reference: 'REF-1' });
  });
  it('reads semicolon-separated exports and drops unusable rows', () => {
    expect(parseCsv('Date;Amount;Type\n2026-08-03;1500;Credit')).toHaveLength(1);
    expect(parseCsv('Date;Amount;Type\n%%%%\n2026-08-03;abc;Credit')).toHaveLength(0);
  });
  it('extracts amounts and debit intent from Hindi-English notes', () => {
    const rows = parseNotes('मोहन डेयरी को ₹1,200 दिया, ref UTR-993');
    expect(rows[0]).toMatchObject({ amount: 1200, direction: 'debit', reference: 'UTR-993' });
  });
  it('attributes undated notes to the working day of the export', () => {
    const ledger = ingest('Date,Amount,Type,Name,Ref\n2026-08-01,100,Credit,A,R1', 'B paid ₹200');
    expect(ledger.every((row) => row.date === '2026-08-01')).toBe(true);
  });
});

describe('matcher agent', () => {
  const policy = plan('Date,Amount,Type,Name,Ref\n2026-08-01,1,Credit,A,R', 'x ₹1 ref R').policy;
  it('assigns high confidence only to shared-reference matches', () => {
    const ledger = match(
      ingest('Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita Stores,REF001', 'Anita Stores paid ₹2,500 UPI ref REF001'),
      policy,
    );
    expect(ledger.find((row) => row.source === 'upi')).toMatchObject({ status: 'matched', confidence: 96 });
  });
  it('caps name-and-amount only links at 82', () => {
    const ledger = match(ingest('Date,Amount,Type,Name,Ref\n2026-08-01,500,Credit,Walk In,', 'Walk In paid ₹500'), policy);
    expect(ledger.every((row) => row.confidence <= 82)).toBe(true);
  });
  it('flags a shared reference whose amounts disagree instead of matching it', () => {
    const ledger = match(
      ingest('Date,Amount,Type,Name,Ref\n2026-08-04,1180,Credit,Verma Traders,REF701', 'Verma Traders paid ₹1,000 ref REF701'),
      policy,
    );
    expect(ledger.every((row) => row.status === 'review')).toBe(true);
    expect(ledger[0].flags).toContain('Same reference, different amount');
  });
});

describe('critic agent', () => {
  const policy = plan('Date,Amount,Type,Name,Ref\n2026-08-01,1,Credit,A,R', '').policy;
  const run = (csv: string, notes = '') => critique(match(ingest(csv, notes), policy), policy);

  it('holds back a repeated row in the same export as high severity', () => {
    const result = run('Date,Amount,Type,Name,Ref\n2026-08-01,900,Credit,Ravi,REF9\n2026-08-01,900,Credit,Ravi,REF9');
    expect(result.exceptions.filter((e) => e.rule === 'duplicate' && e.severity === 'high')).toHaveLength(1);
    expect(result.transactions.filter((t) => t.status === 'review')).toHaveLength(1);
  });
  it('treats a normalised name collision on the same day as a duplicate', () => {
    const result = run('Date,Amount,Type,Name,Ref\n2026-08-01,900,Credit,ANITA,R1\n2026-08-01,900,Credit,Anita Stores,R2');
    expect(result.exceptions.some((e) => e.rule === 'duplicate')).toBe(true);
  });
  it('detects a misspelled name carrying the same amount', () => {
    const result = run('Date,Amount,Type,Name,Ref\n2026-08-01,900,Credit,Ravi Kumar,R1\n2026-08-01,900,Credit,Ravi Kumr,R2');
    expect(result.exceptions.some((e) => e.rule === 'similar-party')).toBe(true);
  });
  it('calls identical amounts weeks apart a repeat, not a duplicate', () => {
    const result = run('Date,Amount,Type,Name,Ref\n2026-08-01,4500,Credit,Ravi Kumar,R1\n2026-08-20,4500,Credit,Ravi Kumar,R2');
    expect(result.exceptions.some((e) => e.rule === 'date-outlier')).toBe(true);
    expect(result.exceptions.some((e) => e.rule === 'duplicate')).toBe(false);
  });
  it('asks for confirmation on suspiciously round open amounts', () => {
    const result = run('Date,Amount,Type,Name,Ref\n2026-08-01,25000,Credit,Ravi,R1');
    expect(result.exceptions.some((e) => e.rule === 'round-amount')).toBe(true);
  });
  it('refuses an ambiguous match when two counterparties share an amount', () => {
    const result = run(
      'Date,Amount,Type,Name,Ref\n2026-08-02,1500,Credit,Anita Devi,REF501\n2026-08-02,1500,Credit,Anita Kumari,REF502',
      'Anita ne ₹1,500 bheje, UPI',
    );
    expect(result.transactions.some((t) => t.status === 'matched')).toBe(false);
    expect(result.exceptions.some((e) => /Ambiguous match/.test(e.title))).toBe(true);
  });
});

describe('trust scoring', () => {
  const csv = 'Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita Stores,REF001\n2026-08-01,1200,Credit,Ravi,REF002';

  it('stays inside its published bounds and explains itself', () => {
    const run = reconcile(csv, '');
    expect(run.trust.score).toBeGreaterThanOrEqual(35);
    expect(run.trust.score).toBeLessThanOrEqual(96);
    expect(run.trust.reasons.length).toBeGreaterThan(0);
    expect(run.trust.breakdown.base + run.trust.breakdown.matchPoints - run.trust.breakdown.highSeverityPenalty).toBeCloseTo(
      run.trust.breakdown.raw,
      1,
    );
  });
  it('maps the score onto an interpretation band', () => {
    const clean = reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita,REF111', 'Anita paid ₹2,500 UPI ref REF111');
    expect(clean.trust.band).toBe('High');
    expect(reconcile(csv, '').trust.band).toBe('Low');
  });
  it('uses neutral/warning icons thresholds for match-rate reasons', () => {
    const highMatch = reconcile(
      'Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita,REF111',
      'Anita paid ₹2,500 UPI ref REF111',
    );
    expect(highMatch.trust.reasons.find((r) => r.text.includes('independent cross-source'))?.kind).toBe('positive');

    const mixed = reconcile(
      'Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita Stores,427910018821\n2026-08-01,2500,Credit,Anita Stores,427910018821',
      '01/08/2026 Anita Stores paid ₹2,500 UPI ref 427910018821',
    );
    // 2/3 matched (~67%) must not render as green-positive
    expect(mixed.trust.reasons.find((r) => r.text.includes('independent cross-source'))?.kind).toBe('neutral');

    const weak = runCriticAgain(mixed);
    expect(['neutral', 'warning']).toContain(
      weak.trust.reasons.find((r) => r.text.includes('independent cross-source'))?.kind,
    );
  });
  it('routes close amount-only signals to the human queue', () => {
    const run = reconcile(csv, 'Ravi payment ₹1,150 received');
    expect(run.transactions.find((x) => x.reference === 'REF002')?.status).toBe('partial');
    expect(run.exceptions.some((x) => x.title.startsWith('Partial match'))).toBe(true);
  });
  it('never lets a deeper critic pass raise trust', () => {
    const first = reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,500,Credit,Walk In,', 'Walk In paid ₹500');
    const second = runCriticAgain(first);
    const third = runCriticAgain(second);
    expect(second.criticPasses).toBe(2);
    expect(second.trust.score).toBeLessThanOrEqual(first.trust.score);
    expect(third.trust.score).toBeLessThanOrEqual(second.trust.score);
    expect(second.exceptions.length).toBeGreaterThanOrEqual(first.exceptions.length);
  });
});

describe('pipeline output', () => {
  const run = reconcile(
    'Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita Stores,427910018821\n2026-08-01,2500,Credit,Anita Stores,427910018821',
    '01/08/2026 Anita Stores paid ₹2,500 UPI ref 427910018821',
  );

  it('records one real timing per agent', () => {
    expect(run.timeline.map((event) => event.agent)).toEqual(['Planner', 'Ingestor', 'Matcher', 'Critic', 'Explainer']);
    expect(run.timeline.every((event) => event.ms >= 0)).toBe(true);
  });
  it('catches the duplicate credit the demo is built on', () => {
    expect(run.exceptions.some((e) => e.rule === 'duplicate')).toBe(true);
    expect(run.transactions.filter((t) => t.status === 'matched')).toHaveLength(2);
  });
  it('explains the same numbers in both languages', () => {
    expect(run.summary.en).toContain('Output Trust');
    expect(run.summary.hi).toContain('₹');
  });
  it('builds an audit pack that agrees with the run', () => {
    const files = buildAuditFiles(run);
    expect(files.map((file) => file.name)).toEqual(['summary.md', 'reconciled.csv', 'exceptions.csv', 'agent-trace.json']);
    expect(files[1].content.split('\n')).toHaveLength(run.transactions.length + 1);
    expect(files[0].content).toContain(`${run.trust.score}/100`);
    expect(() => JSON.parse(files[3].content)).not.toThrow();
  });
});

describe('eval suite', () => {
  it('ships four adversarial fixtures alongside the golden set', () => {
    expect(fixtures.filter((fixture) => fixture.group === 'adversarial')).toHaveLength(4);
    expect(fixtures.filter((fixture) => fixture.outcome === 'known-limitation')).toHaveLength(2);
  });
  it('matches documented behaviour on every fixture', () => {
    const rows = runAllFixtures();
    const stats = summarize(rows);
    expect(stats.regressions).toEqual([]);
    expect(stats.total).toBe(12);
    expect(stats.passing).toBe(10);
  });
  it('reports honest per-fixture trust instead of a constant', () => {
    const scores = new Set(runAllFixtures().map((row) => row.trust));
    expect(scores.size).toBeGreaterThan(1);
  });
});
