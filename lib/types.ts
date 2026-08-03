export type Status = 'matched' | 'partial' | 'unmatched' | 'review';
export type Transaction = { id:string; date:string; amount:number; direction:'credit'|'debit'; party:string; reference:string; source:'upi'|'note'; status:Status; confidence:number; matchReason:string; flags:string[] };
export type Exception = { id:string; title:string; detail:string; severity:'high'|'medium'|'low'; suggestedAction:string; transactionIds:string[] };
export type TimelineEvent = { agent:string; title:string; detail:string; status:'done'|'running'|'queued'; time:string };
export type RunResult = { id:string; shopName:string; language:string; transactions:Transaction[]; exceptions:Exception[]; timeline:TimelineEvent[]; plan:string[]; summary:{ en:string; hi:string }; trust:{ score:number; reasons:string[] }; createdAt:string; criticPasses:number };
