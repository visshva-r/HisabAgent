import { describe, expect, it } from 'vitest';
import { parseCsv, parseNotes, reconcile, runCriticAgain } from '../lib/reconciliation';

describe('HisabAgent evidence ingestion', () => {
  it('parses quoted Indian amounts without splitting the amount column', () => {
    const rows = parseCsv('txn_date,amt,dr/cr,remark,utr\n01/08/2026,"2,500",CR,ANITA STORE,REF-1');
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ amount: 2500, direction: 'credit', party: 'ANITA STORE', reference: 'REF-1' });
  });
  it('extracts amounts and debit intent from Hindi-English notes', () => {
    const rows=parseNotes('मोहन डेयरी को ₹1,200 दिया, ref UTR-993');
    expect(rows[0]).toMatchObject({amount:1200,direction:'debit',reference:'UTR-993'});
  });
});
describe('HisabAgent matching and critic bands', () => {
  const csv='Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita Stores,REF001\n2026-08-01,1200,Credit,Ravi,REF002';
  it('assigns high confidence to exact shared-reference matches', () => {
    const run=reconcile(csv,'Anita Stores paid ₹2,500 UPI ref REF001');
    expect(run.transactions.find(x=>x.reference==='REF001')?.confidence).toBe(96);
    expect(run.transactions.find(x=>x.reference==='REF001')?.status).toBe('matched');
  });
  it('routes close amount-only signals to the human queue', () => {
    const run=reconcile(csv,'Ravi payment ₹1,150 received');
    expect(run.transactions.find(x=>x.reference==='REF002')?.status).toBe('partial');
    expect(run.exceptions.some(x=>x.title.startsWith('Partial match'))).toBe(true);
  });
  it('second critic pass downgrades non-reference matches and lowers trust', () => {
    const run=reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,500,Credit,Walk In,','Walk In paid ₹500');
    const reviewed=runCriticAgain(run);
    expect(reviewed.criticPasses).toBe(2); expect(reviewed.trust.score).toBeLessThanOrEqual(run.trust.score);
  });
  it('trust score is bounded and gives reasons', () => {
    const run=reconcile(csv,''); expect(run.trust.score).toBeGreaterThanOrEqual(35); expect(run.trust.score).toBeLessThanOrEqual(96); expect(run.trust.reasons.length).toBeGreaterThan(0);
  });
});
