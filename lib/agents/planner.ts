import { Plan, ReconciliationPolicy } from '../types';
import { csvCells } from './normalize';

export const BASE_POLICY: ReconciliationPolicy = {
  amountTolerancePct: 0.1,
  amountToleranceMin: 5,
  dateOutlierDays: 7,
  partySimilarity: 0.82,
  roundAmountFloor: 5000,
};

/** Second-pass policy: the critic re-reads the same ledger with tighter thresholds. */
export const STRICT_POLICY: ReconciliationPolicy = {
  ...BASE_POLICY,
  dateOutlierDays: 3,
  partySimilarity: 0.72,
  roundAmountFloor: 1000,
};

/**
 * Planner agent: profiles the supplied evidence and fixes the reconciliation
 * policy before any record is touched, so every later decision is explainable.
 */
export function plan(csv: string, notes: string): Plan {
  const csvLines = csv.trim().split(/\r?\n/).filter(Boolean);
  const noteLines = notes.trim().split(/\r?\n/).filter(Boolean);
  const sources = { csv: csvLines.length > 1, notes: noteLines.length > 0 };
  const headers = sources.csv ? csvCells(csvLines[0]).map((h) => h.toLowerCase()) : [];
  const hasReferenceColumn = headers.some((h) => /ref|utr|rrn|txn|transaction id/.test(h));
  const observations: string[] = [];

  if (sources.csv) {
    observations.push(`UPI export detected with ${csvLines.length - 1} data row(s) and ${headers.length} column(s).`);
    observations.push(
      hasReferenceColumn
        ? 'A reference/UTR column is present, so exact-reference matching is available.'
        : 'No reference column found; matching must fall back to amount, party and date evidence.',
    );
  } else {
    observations.push('No usable UPI export supplied; notes are the only evidence.');
  }

  if (sources.notes) observations.push(`${noteLines.length} informal payment note(s) queued for extraction.`);
  else observations.push('No payment notes supplied; cross-source confirmation is not possible.');

  if (!sources.csv || !sources.notes) {
    observations.push('Single-source day: nothing can reach cross-source confidence, so more records will stay open.');
  }

  const policy: ReconciliationPolicy = {
    ...BASE_POLICY,
    // With no reference column the only remaining signals are weaker, so the
    // amount window is tightened to avoid confident-looking wrong matches.
    amountTolerancePct: hasReferenceColumn ? BASE_POLICY.amountTolerancePct : 0.05,
  };

  const steps = [
    'Profile inputs and detect formats',
    'Normalize money, dates, aliases and references',
    hasReferenceColumn
      ? 'Link cross-source records using reference, amount and party signals'
      : 'Link cross-source records using amount, party and date signals only',
    'Challenge weak links, duplicates, repeat amounts and split payments',
    'Explain ledger health in the owner’s chosen language',
  ];

  return { steps, policy, sources, observations };
}
