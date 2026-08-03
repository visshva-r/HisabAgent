import { reconcile } from '../lib/reconciliation';
const csv='Date,Amount,Type,Name,Ref\n2026-08-01,2500,Credit,Anita Stores,REF001\n2026-08-01,2500,Credit,Anita Stores,REF001';
const notes='Anita Stores paid ₹2,500 UPI ref REF001\nरमेश से ₹450 मिले';
const run=reconcile(csv,notes);
console.log(JSON.stringify({ suite:'HisabAgent golden smoke eval', trust:run.trust.score, transactions:run.transactions.length, exceptions:run.exceptions.length, status:run.transactions.length>0?'PASS':'FAIL' },null,2));
process.exit(run.transactions.length>0?0:1);
