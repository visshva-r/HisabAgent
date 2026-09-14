import { EMPTY_EVIDENCE, EvidenceSignal, MatchEvidence, ReconciliationPolicy, Transaction } from '../types';
import { dayGap, gstInclusiveRate, money, nameSimilarity, sameAmount, sharesToken } from './normalize';

const isGeneratedReference = (reference: string) => /^(CSV|NOTE)-\d+$/.test(reference);

export const MISMATCH_FLAG = 'Same reference, different amount';

function sourceLabel(source: Transaction['source']) {
  return source === 'upi' ? 'UPI export' : 'payment note';
}

function describeDate(gap: number | null): string {
  if (gap === null) return 'date unparsed';
  if (gap === 0) return 'same day';
  if (gap === 1) return '1 day apart';
  return `${gap} days apart`;
}

function evidenceOf(transaction: Transaction, counterpart: Transaction, extra: Partial<MatchEvidence> = {}): MatchEvidence {
  const sharedReference =
    extra.sharedReference ??
    (transaction.reference === counterpart.reference && !isGeneratedReference(transaction.reference));
  const amountDelta = Math.round(Math.abs(transaction.amount - counterpart.amount) * 100) / 100;
  const partySimilarity = Math.round(nameSimilarity(transaction.party, counterpart.party) * 100) / 100;
  const dateGapDays = extra.dateGapDays ?? dayGap(transaction.date, counterpart.date);
  // GST-shaped gaps are only claimed when a shared reference already ties the
  // two records. A coincidental 5% near-amount must not be labelled as tax.
  const gstRate =
    extra.gstRate !== undefined
      ? extra.gstRate
      : sharedReference
        ? gstInclusiveRate(transaction.amount, counterpart.amount)
        : null;
  const signals: EvidenceSignal[] = extra.signals ?? [
    ...(sharedReference ? (['reference'] as const) : []),
    ...(amountDelta < 0.01 ? (['amount'] as const) : []),
    ...(partySimilarity >= 0.5 ? (['party'] as const) : []),
    ...(dateGapDays !== null && dateGapDays <= 2 ? (['date'] as const) : []),
    ...(gstRate ? (['gst'] as const) : []),
  ];
  return { sharedReference, amountDelta, partySimilarity, dateGapDays, signals, gstRate };
}

/**
 * Matcher agent: links records across sources using reference, amount, party
 * and date evidence. Reasons name the signals used. Weak or conflicting
 * signals are never promoted to a clean match.
 */
export function match(transactions: Transaction[], policy: ReconciliationPolicy): Transaction[] {
  const ledger = transactions.map((transaction) => ({
    ...transaction,
    flags: [...transaction.flags],
    linkedIds: [] as string[],
    evidence: { ...EMPTY_EVIDENCE, ...transaction.evidence, signals: [...(transaction.evidence?.signals ?? [])] },
  }));

  ledger.forEach((transaction, index) => {
    const peers = ledger.filter(
      (candidate, position) =>
        position !== index &&
        candidate.direction === transaction.direction &&
        sameAmount(candidate.amount, transaction.amount) &&
        (candidate.reference === transaction.reference || sharesToken(candidate.party, transaction.party)),
    );
    const crossSource = peers.find((candidate) => candidate.source !== transaction.source);

    if (crossSource) {
      const sharedReference = transaction.reference === crossSource.reference && !isGeneratedReference(transaction.reference);
      const evidence = evidenceOf(transaction, crossSource, { sharedReference });
      transaction.status = 'matched';
      transaction.confidence = sharedReference ? 96 : 82;
      transaction.linkedIds = [crossSource.id];
      transaction.evidence = evidence;
      const namePct = Math.round(evidence.partySimilarity * 100);
      transaction.matchReason = sharedReference
        ? `Shared reference ${transaction.reference} on the ${sourceLabel(crossSource.source)} (${describeDate(evidence.dateGapDays)}, name ${namePct}%)`
        : `Amount and name only vs ${sourceLabel(crossSource.source)} ${crossSource.party} (${describeDate(evidence.dateGapDays)}, name ${namePct}%; no shared reference)`;
      return;
    }

    const referenceConflict = ledger.find(
      (candidate, position) =>
        position !== index &&
        candidate.source !== transaction.source &&
        !isGeneratedReference(transaction.reference) &&
        candidate.reference === transaction.reference &&
        !sameAmount(candidate.amount, transaction.amount),
    );

    if (referenceConflict) {
      const gstRate = gstInclusiveRate(transaction.amount, referenceConflict.amount);
      const evidence = evidenceOf(transaction, referenceConflict, {
        sharedReference: true,
        gstRate,
        signals: gstRate ? ['reference', 'gst'] : ['reference'],
      });
      const delta = evidence.amountDelta;
      transaction.status = 'review';
      transaction.confidence = 58;
      transaction.linkedIds = [referenceConflict.id];
      transaction.evidence = evidence;
      if (!transaction.flags.includes(MISMATCH_FLAG)) transaction.flags.push(MISMATCH_FLAG);
      transaction.matchReason = gstRate
        ? `Same reference ${transaction.reference} with a ${gstRate}% GST-shaped gap (${money(transaction.amount)} vs ${money(referenceConflict.amount)})`
        : `Same reference ${transaction.reference} on the ${sourceLabel(referenceConflict.source)} with a different amount (difference ${money(delta)})`;
      return;
    }

    const tolerance = Math.max(policy.amountToleranceMin, transaction.amount * policy.amountTolerancePct);
    const nearAmount = ledger.find(
      (candidate, position) =>
        position !== index &&
        candidate.direction === transaction.direction &&
        candidate.source !== transaction.source &&
        Math.abs(candidate.amount - transaction.amount) <= tolerance,
    );

    if (nearAmount) {
      const evidence = evidenceOf(transaction, nearAmount, { sharedReference: false, gstRate: null });
      transaction.status = 'partial';
      transaction.confidence = 62;
      transaction.linkedIds = [nearAmount.id];
      transaction.evidence = evidence;
      transaction.matchReason = `Near amount vs ${nearAmount.party} on the ${sourceLabel(nearAmount.source)} (delta ${money(evidence.amountDelta)}, ${describeDate(evidence.dateGapDays)}); needs confirmation`;
    }
  });

  return ledger;
}
