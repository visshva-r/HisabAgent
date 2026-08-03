import { Exception, RunResult, Transaction } from './types';

const amount = (s:string) => Number((s.match(/(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1] || '0').replace(/,/g,''));
const dateOf = (s:string) => { const m=s.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/); return m?.[1] || new Date().toISOString().slice(0,10); };
const words = (s:string) => s.replace(/[^a-zA-Z\s]/g,' ').trim().split(/\s+/).filter(w=>w.length>2);
const uid = () => Math.random().toString(36).slice(2,9);
const csvCells = (line:string) => line.match(/(?:,|^)("(?:[^"]|"")*"|[^,]*)/g)?.map(cell => cell.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];

export function parseCsv(text:string): Transaction[] {
  const lines=text.trim().split(/\r?\n/).filter(Boolean); if(lines.length<2) return [];
  const headers=csvCells(lines[0]).map(x=>x.toLowerCase());
  return lines.slice(1).map((line,i)=>{ const c=csvCells(line); const get=(keys:string[])=>c[headers.findIndex(h=>keys.some(k=>h.includes(k)))]||''; const getPreferred=(keys:string[])=>{ for(const key of keys){const index=headers.findIndex(h=>h===key || h.includes(key)); if(index>=0)return c[index]||'';} return ''; };
    const raw=[getPreferred(['amount','amt','value']), ...c].find(x=>amount(x)>0)||''; const d=getPreferred(['date','timestamp','time'])||dateOf(line); const note=getPreferred(['payer','payee','name','remark','note','vpa','merchant']) || 'UPI counterparty'; const ref=getPreferred(['upi ref','utr','rrn','transaction id','txn','ref']) || `CSV-${i+1}`;
    const type:Transaction['direction']=(get(['type','dr/cr','direction','debit credit']).toLowerCase()+line.toLowerCase()).includes('debit') || line.toLowerCase().includes('paid to') ? 'debit':'credit';
    return { id:`upi-${i}-${uid()}`,date:dateOf(d),amount:amount(raw),direction:type,party:note,reference:ref,source:'upi' as const,status:'unmatched' as const,confidence:38,matchReason:'Awaiting cross-source reconciliation',flags:[] };
  }).filter(t=>t.amount>0);
}
export function parseNotes(text:string): Transaction[] {
  return text.split(/\r?\n/).filter(l=>amount(l)>0).map((line,i)=>{ const lower=line.toLowerCase(); const debit=/^(paid|sent)\b|\bpaid to\b|\bdiya\b|दिया|भेजा/.test(lower); const ref=line.match(/(?:ref|utr|txn|upi)[\s:#-]*([A-Za-z0-9-]{5,})/i)?.[1] || `NOTE-${i+1}`; const named=words(line).filter(w=>!['paid','received','from','today','yesterday','payment','amount','cash','upi'].includes(w.toLowerCase())).slice(0,3).join(' ') || 'WhatsApp note';
    return {id:`note-${i}-${uid()}`,date:dateOf(line),amount:amount(line),direction:(debit?'debit':'credit') as Transaction['direction'],party:named,reference:ref,source:'note' as const,status:'unmatched' as const,confidence:32,matchReason:'Parsed from informal payment note',flags:[]};
  });
}
function similarity(a:string,b:string) { const aw=words(a.toLowerCase()), bw=words(b.toLowerCase()); return aw.some(w=>bw.includes(w)); }
export function reconcile(csv:string, notes:string, shopName='Sharma General Store', language='both'):RunResult {
 const transactions=[...parseCsv(csv),...parseNotes(notes)]; const plan=['Profile inputs and detect formats','Normalize money, dates, aliases and references','Link cross-source records using reference, amount and party signals','Challenge weak links, duplicates and split payments','Explain ledger health in the owner’s chosen language'];
 const exceptions:Exception[]=[];
 transactions.forEach((t,i)=> { const peers=transactions.filter((x,j)=>j!==i && x.direction===t.direction && Math.abs(x.amount-t.amount)<.01 && (x.reference===t.reference || similarity(x.party,t.party)));
  const cross=peers.find(x=>x.source!==t.source);
  if(cross) { t.status='matched'; t.confidence=t.reference===cross.reference && !t.reference.startsWith('NOTE') ? 96:82; t.matchReason=`Cross-checked against ${cross.source === 'upi' ? 'UPI export':'payment note'}: ${cross.party}`; }
  else { const close=transactions.find((x,j)=>j!==i && x.direction===t.direction && x.source!==t.source && Math.abs(x.amount-t.amount)<=Math.max(5,t.amount*.1)); if(close){t.status='partial';t.confidence=62;t.matchReason=`Near amount signal with ${close.party}; human confirmation needed`;}
  }
  if(peers.length>0 && !cross) { t.flags.push('Possible duplicate'); t.status='review'; t.confidence=Math.min(t.confidence,45); }
 });
 const dupes=transactions.filter(t=>t.flags.includes('Possible duplicate'));
 dupes.forEach((t,i)=>{if(i%2===0) exceptions.push({id:`dup-${i}`,title:`Possible duplicate ₹${t.amount.toLocaleString('en-IN')}`,detail:`${t.party} appears more than once with the same amount/reference signals.`,severity:'high',suggestedAction:'Verify the UPI reference before keeping both entries.',transactionIds:[t.id]});});
 transactions.filter(t=>t.status==='partial').forEach(t=>exceptions.push({id:`partial-${t.id}`,title:`Partial match: ₹${t.amount.toLocaleString('en-IN')}`,detail:`${t.party} has a near-amount match but no reliable shared reference.`,severity:'medium',suggestedAction:'Confirm whether this is a split payment or separate collection.',transactionIds:[t.id]}));
 transactions.filter(t=>t.status==='unmatched').forEach(t=>exceptions.push({id:`unmatched-${t.id}`,title:`Unmatched ${t.direction}: ₹${t.amount.toLocaleString('en-IN')}`,detail:`No supporting transaction was found across the supplied sources.`,severity:'low',suggestedAction:'Attach the missing payment message or mark as cash/standalone.',transactionIds:[t.id]}));
 const m=transactions.filter(t=>t.status==='matched').length, pct=transactions.length?Math.round(m/transactions.length*100):0; const trust=Math.max(35,Math.min(96,Math.round(45+pct*.45-exceptions.filter(e=>e.severity==='high').length*5)));
 const inflow=transactions.filter(t=>t.direction==='credit').reduce((s,t)=>s+t.amount,0), outflow=transactions.filter(t=>t.direction==='debit').reduce((s,t)=>s+t.amount,0);
 const en=`${shopName}: ₹${inflow.toLocaleString('en-IN')} received and ₹${outflow.toLocaleString('en-IN')} paid across ${transactions.length} records. ${m} records are cross-source matched (${pct}%). ${exceptions.length} decisions remain in the human queue; estimated attention risk is ₹${transactions.filter(t=>t.status!=='matched').reduce((s,t)=>s+t.amount,0).toLocaleString('en-IN')}.`;
 const hi=`${shopName} के लिए ₹${inflow.toLocaleString('en-IN')} प्राप्त और ₹${outflow.toLocaleString('en-IN')} भुगतान दर्ज हुए। ${m} रिकॉर्ड मिलान किए गए हैं (${pct}%)। ${exceptions.length} मामलों में आपकी पुष्टि चाहिए; ध्यान देने योग्य रकम लगभग ₹${transactions.filter(t=>t.status!=='matched').reduce((s,t)=>s+t.amount,0).toLocaleString('en-IN')} है।`;
 return {id:`run-${Date.now()}`,shopName,language,transactions,exceptions,timeline:[],plan,summary:{en,hi},trust:{score:trust,reasons:[`${m}/${transactions.length} records have cross-source evidence`,`${dupes.length} duplicate signals were challenged by the critic`,exceptions.length?`${exceptions.length} exceptions are explicitly held for a human`:'No exception queue remains']},createdAt:new Date().toISOString(),criticPasses:1};
}
export function runCriticAgain(run:RunResult):RunResult { const tx=run.transactions.map(t=>({...t, flags:[...t.flags]})); const extras:Exception[]=[]; tx.forEach(t=>{if(t.status==='matched' && t.confidence<90){t.confidence-=8;t.flags.push('Critic: match depends on amount only');t.status='review';extras.push({id:`critic-${t.id}`,title:`Re-check low-evidence match`,detail:`${t.party} was matched with insufficient independent evidence.`,severity:'medium',suggestedAction:'Confirm reference or customer name.',transactionIds:[t.id]})}}); return {...run,transactions:tx,exceptions:[...run.exceptions,...extras],criticPasses:run.criticPasses+1,trust:{...run.trust,score:Math.max(20,run.trust.score-extras.length*4),reasons:[...run.trust.reasons,extras.length?'Second critic pass downgraded amount-only links':'Second critic pass found no additional weak links']}}; }
