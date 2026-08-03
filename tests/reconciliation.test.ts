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

describe('golden eval assertions mirrored from Evals Lab', () => {
  it('checks all eight fixtures with concrete outcomes', () => {
    const clean=reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita,REF111','Anita paid ₹2,500 UPI ref REF111');
    expect(clean.transactions.some(t=>t.status==='matched'&&t.confidence>=90)).toBe(true);
    const messy=reconcile('txn_date,amt,dr/cr,remark,utr\n01/08/2026,"2,500",CR,ANITA,REF1\n01/08/2026,"2,500",CR,ANITA,REF1','');
    expect(messy.transactions.some(t=>t.flags.length)||messy.exceptions.some(e=>e.title.toLowerCase().includes('duplicate'))).toBe(true);
    expect(reconcile('','Ramesh se ₹450 received').transactions.some(t=>t.source==='note')).toBe(true);
    const mixed=reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,1200,Credit,Mohan,REF777','Mohan paid ₹1,200 UPI ref REF777');
    expect(mixed.transactions.some(t=>t.status==='matched'&&/note|upi|cross/i.test(t.matchReason))).toBe(true);
    const duplicate=reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,900,Credit,Ravi,REF9\n2026-08-01,900,Credit,Ravi,REF9','');
    expect(duplicate.exceptions.some(e=>e.title.toLowerCase().includes('duplicate'))).toBe(true);
    const partial=reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,1000,Credit,Ravi,REF2','Ravi payment ₹1,050 received');
    expect(partial.transactions.some(t=>t.status==='partial')||partial.exceptions.some(e=>e.title.startsWith('Partial'))).toBe(true);
    const missing=reconcile('Date,Amount,Type,Name,Ref\n2026-08-01,700,Credit,Walk In,','Cash collection ₹700');
    expect(missing.transactions.some(t=>t.status==='matched'&&t.confidence>=90)).toBe(false);
    const hindi=reconcile('','रमेश से ₹450 मिले');
    expect(hindi.transactions.some(t=>t.source==='note'&&t.party!=='WhatsApp note'&&t.party!=='')).toBe(false);
  });
});
