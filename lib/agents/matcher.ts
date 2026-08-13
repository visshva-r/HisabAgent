import { ReconciliationPolicy, Transaction } from '../types';
import { sameAmount, sharesToken } from './normalize';

const isGeneratedReference = (reference: string) => /^(CSV|NOTE)-\d+$/.test(reference);

export const MISMATCH_FLAG = 'Same reference, different amount';

/**
 * Matcher agent: links records across sources using reference, amount and
 * party evidence. It never upgrades a link it cannot justify — weak signals are
 * routed to `partial` so the critic and the owner can see them.
 */
export function match(transactions: Transaction[], policy: ReconciliationPolicy): Transaction[] {
  const ledger = transactions.map((transaction) => ({ ...transaction, flags: [...transaction.flags], linkedIds: [] as string[] }));

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
      transaction.status = 'matched';
      transaction.confidence = sharedReference ? 96 : 82;
      transaction.linkedIds = [crossSource.id];
      transaction.matchReason = sharedReference
        ? `Shared reference ${transaction.reference} confirmed by ${crossSource.source === 'upi' ? 'UPI export' : 'payment note'}`
        : `Cross-checked against ${crossSource.source === 'upi' ? 'UPI export' : 'payment note'}: ${crossSource.party} (amount and name only)`;
      return;
    }

    // Same reference, different amount: GST, platform fees and part payments
    // hide here. It is evidence of a link, but never evidence of agreement.
    const referenceConflict = ledger.find(
      (candidate, position) =>
        position !== index &&
        candidate.source !== transaction.source &&
        !isGeneratedReference(transaction.reference) &&
        candidate.reference === transaction.reference &&
        !sameAmount(candidate.amount, transaction.amount),
    );

    if (referenceConflict) {
      const delta = Math.abs(referenceConflict.amount - transaction.amount);
      transaction.status = 'review';
      transaction.confidence = 58;
      transaction.linkedIds = [referenceConflict.id];
      transaction.flags.push(MISMATCH_FLAG);
      transaction.matchReason = `Reference ${transaction.reference} also appears in the ${referenceConflict.source === 'upi' ? 'UPI export' : 'payment notes'} with a different amount (difference ₹${delta.toLocaleString('en-IN')})`;
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
      transaction.status = 'partial';
      transaction.confidence = 62;
      transaction.linkedIds = [nearAmount.id];
      transaction.matchReason = `Near amount signal with ${nearAmount.party}; human confirmation needed`;
    }
  });

  return ledger;
}
