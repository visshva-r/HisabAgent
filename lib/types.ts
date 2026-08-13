export type Status = 'matched' | 'partial' | 'unmatched' | 'review';
export type Direction = 'credit' | 'debit';
export type Source = 'upi' | 'note';

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  direction: Direction;
  party: string;
  reference: string;
  source: Source;
  status: Status;
  confidence: number;
  matchReason: string;
  flags: string[];
  linkedIds: string[];
};

export type ExceptionRule =
  | 'duplicate'
  | 'amount-mismatch'
  | 'similar-party'
  | 'date-outlier'
  | 'round-amount'
  | 'partial'
  | 'unmatched'
  | 'low-evidence';

export type Exception = {
  id: string;
  rule: ExceptionRule;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  suggestedAction: string;
  transactionIds: string[];
  amount: number;
  party: string;
};

export type TimelineEvent = {
  agent: string;
  title: string;
  detail: string;
  status: 'done' | 'running' | 'queued';
  time: string;
  ms: number;
};

export type ReconciliationPolicy = {
  /** Relative tolerance used when only amounts are comparable. */
  amountTolerancePct: number;
  /** Absolute floor for the amount tolerance, in rupees. */
  amountToleranceMin: number;
  /** Same-amount records further apart than this are treated as repeat-amount risk. */
  dateOutlierDays: number;
  /** Normalized name similarity (0-1) required to treat two parties as the same. */
  partySimilarity: number;
  /** Round amounts at or above this value are surfaced for confirmation. */
  roundAmountFloor: number;
};

export type Plan = {
  steps: string[];
  policy: ReconciliationPolicy;
  sources: { csv: boolean; notes: boolean };
  observations: string[];
};

export type TrustReason = { text: string; kind: 'positive' | 'warning' | 'neutral' };
export type TrustBand = 'High' | 'Moderate' | 'Low';

export type TrustBreakdown = {
  base: number;
  matchedRecords: number;
  totalRecords: number;
  matchedPct: number;
  matchPoints: number;
  highSeverityCount: number;
  highSeverityPenalty: number;
  criticPenalty: number;
  raw: number;
  floor: number;
  ceiling: number;
  score: number;
};

export type Trust = {
  score: number;
  band: TrustBand;
  guidance: string;
  reasons: TrustReason[];
  breakdown: TrustBreakdown;
};

export type RunResult = {
  id: string;
  shopName: string;
  language: string;
  transactions: Transaction[];
  exceptions: Exception[];
  timeline: TimelineEvent[];
  plan: Plan;
  summary: { en: string; hi: string };
  trust: Trust;
  createdAt: string;
  criticPasses: number;
};
