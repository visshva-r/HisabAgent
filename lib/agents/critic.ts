import { Exception, ReconciliationPolicy, Transaction, Trust, TrustBand, TrustReason } from '../types';
import { MISMATCH_FLAG } from './matcher';
import { dayGap, isRoundAmount, money, nameSimilarity, normalizeName, sameAmount, sharesToken } from './normalize';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const TRUST_BASE = 45;
const MATCH_WEIGHT = 0.45;
const HIGH_SEVERITY_PENALTY = 5;
export const CRITIC_PENALTY_PER_FINDING = 4;
const CEILING = 96;
const FLOOR = 35;
const CRITIC_FLOOR = 20;

export type CritiqueResult = { transactions: Transaction[]; exceptions: Exception[] };

function downgrade(transaction: Transaction, flag: string, status: Transaction['status'], confidenceCap: number) {
  if (!transaction.flags.includes(flag)) transaction.flags.push(flag);
  transaction.status = status;
  transaction.confidence = Math.min(transaction.confidence, confidenceCap);
}

/**
 * Critic agent: attacks the matcher's own output. Every rule here can only make
 * the ledger more cautious — it downgrades links and opens owner decisions, it
 * never promotes a record to a stronger status.
 */
export function critique(input: Transaction[], policy: ReconciliationPolicy, pass = 1): CritiqueResult {
  const transactions = input.map((transaction) => ({ ...transaction, flags: [...transaction.flags] }));
  const exceptions: Exception[] = [];
  const add = (exception: Exception) => {
    if (!exceptions.some((existing) => existing.id === exception.id)) exceptions.push(exception);
  };

  for (let i = 0; i < transactions.length; i += 1) {
    for (let j = i + 1; j < transactions.length; j += 1) {
      const first = transactions[i];
      const second = transactions[j];
      if (first.direction !== second.direction || !sameAmount(first.amount, second.amount)) continue;

      const linked = first.linkedIds.includes(second.id) || second.linkedIds.includes(first.id);
      const similarity = nameSimilarity(first.party, second.party);
      const sameSource = first.source === second.source;
      const sameReference = first.reference === second.reference;
      const gap = dayGap(first.date, second.date);
      const sameCounterparty = sameReference || similarity >= policy.partySimilarity || sharesToken(first.party, second.party);

      // Rule 4 — identical amounts far apart in time are usually a recurring
      // payment or a stale copy, not one entry made twice. Checked before the
      // duplicate rules so a monthly rent is never called a double entry.
      // A shared UPI reference is the exception: those are unique per payment.
      if (gap !== null && gap > policy.dateOutlierDays && sameCounterparty && !sameReference) {
        downgrade(second, `Repeat amount ${gap} days apart`, second.status === 'matched' ? 'review' : second.status, 70);
        add({
          id: `date-outlier-${first.id}-${second.id}`,
          rule: 'date-outlier',
          title: `Repeat ${money(second.amount)} ${gap} days apart`,
          detail: `${second.party} has the same amount on ${first.date} and ${second.date}. This is either a recurring payment or an old entry copied forward.`,
          severity: 'medium',
          suggestedAction: 'Confirm this is a new payment and not a re-entry of the earlier one.',
          transactionIds: [first.id, second.id],
          amount: second.amount,
          party: second.party,
        });
        continue;
      }

      // Rule 1 — the same payment entered twice in one source.
      if (sameSource && (sameReference || similarity >= 0.95)) {
        downgrade(second, 'Possible duplicate entry', 'review', 45);
        add({
          id: `duplicate-${first.id}-${second.id}`,
          rule: 'duplicate',
          title: `Possible duplicate ${money(second.amount)}`,
          detail: `${second.party} appears twice in the ${second.source === 'upi' ? 'UPI export' : 'payment notes'} with ${sameReference ? `the same reference ${second.reference}` : 'the same name'} and the same amount.`,
          severity: 'high',
          suggestedAction: 'Confirm with the customer whether this was paid once or twice, then delete the extra entry.',
          transactionIds: [first.id, second.id],
          amount: second.amount,
          party: second.party,
        });
        continue;
      }

      // Rule 2 — same amount, spellings differ: alias or double entry.
      if (sameSource && !sameReference && similarity >= policy.partySimilarity) {
        downgrade(second, 'Similar party name, same amount', 'review', 55);
        add({
          id: `similar-${first.id}-${second.id}`,
          rule: 'similar-party',
          title: `Same amount under two spellings: ${money(second.amount)}`,
          detail: `“${first.party}” and “${second.party}” look like the same counterparty (${Math.round(similarity * 100)}% name match) with an identical amount.`,
          severity: 'medium',
          suggestedAction: 'Decide whether this is one payment recorded twice or two genuine payments.',
          transactionIds: [first.id, second.id],
          amount: second.amount,
          party: second.party,
        });
        continue;
      }

      // Rule 3 — two sources hold the same amount but were never linked to each
      // other, so which record belongs to which payment is still open.
      if (!linked && !sameSource && sharesToken(first.party, second.party)) {
        downgrade(second, 'Unlinked same-amount record in the other source', 'review', 55);
        add({
          id: `ambiguous-${first.id}-${second.id}`,
          rule: 'low-evidence',
          title: `Unclear pairing for ${money(second.amount)}`,
          detail: `${second.party} has more than one possible counterpart of the same amount across sources.`,
          severity: 'medium',
          suggestedAction: 'Pick the correct pairing using the UPI reference before closing the day.',
          transactionIds: [first.id, second.id],
          amount: second.amount,
          party: second.party,
        });
      }
    }
  }

  // Rule 3b — amount-and-name matches where several distinct counterparties in
  // the other source carry the same amount: the match is a coin toss, so every
  // record involved in the ambiguity loses its claim to being matched.
  transactions.forEach((transaction) => {
    if (transaction.status !== 'matched' || transaction.confidence >= 96) return;
    const candidates = transactions.filter(
      (candidate) =>
        candidate.id !== transaction.id &&
        candidate.source !== transaction.source &&
        candidate.direction === transaction.direction &&
        sameAmount(candidate.amount, transaction.amount) &&
        sharesToken(candidate.party, transaction.party),
    );
    const distinctNames = new Set(candidates.map((candidate) => normalizeName(candidate.party)));
    if (distinctNames.size < 2) return;
    downgrade(transaction, `Critic: ${distinctNames.size} counterparties share this amount`, 'review', 55);
    candidates.forEach((candidate) => downgrade(candidate, 'Critic: competing claim on the same amount', 'review', 55));
    add({
      id: `over-match-${transaction.id}`,
      rule: 'low-evidence',
      title: `Ambiguous match: ${money(transaction.amount)}`,
      detail: `${distinctNames.size} different counterparties (${candidates.map((candidate) => candidate.party).join(', ')}) carry this exact amount, so the chosen link is a guess.`,
      severity: 'medium',
      suggestedAction: 'Match by UPI reference or ask the customer which payment this was.',
      transactionIds: [transaction.id, ...candidates.map((candidate) => candidate.id)],
      amount: transaction.amount,
      party: transaction.party,
    });
  });

  // Same reference on both sides but the amounts disagree — GST, platform fees
  // and short payments live here, and this is real money.
  transactions.forEach((transaction) => {
    if (!transaction.flags.includes(MISMATCH_FLAG)) return;
    const counterpart = transactions.find((candidate) => candidate.id === transaction.linkedIds[0]);
    if (!counterpart) return;
    const delta = Math.abs(counterpart.amount - transaction.amount);
    const pair = [transaction.id, counterpart.id].sort();
    add({
      id: `mismatch-${pair.join('_')}`,
      rule: 'amount-mismatch',
      title: `Same reference, ${money(delta)} difference`,
      detail: `Reference ${transaction.reference} appears as ${money(transaction.amount)} and ${money(counterpart.amount)}. Tax, platform charges or a short payment can explain it, but the books cannot assume which.`,
      severity: 'high',
      suggestedAction: 'Confirm the actual credited amount and record the difference (GST, charges or balance due) explicitly.',
      transactionIds: pair,
      amount: Math.max(transaction.amount, counterpart.amount),
      party: transaction.party,
    });
  });

  // Rule 6 — second and later passes distrust amount-only links.
  if (pass > 1) {
    transactions.forEach((transaction) => {
      if (transaction.status !== 'matched' || transaction.confidence >= 90) return;
      transaction.confidence = Math.max(0, transaction.confidence - 8);
      downgrade(transaction, 'Critic: match depends on amount only', 'review', transaction.confidence);
      add({
        id: `low-evidence-${transaction.id}`,
        rule: 'low-evidence',
        title: `Re-check low-evidence match: ${money(transaction.amount)}`,
        detail: `${transaction.party} was linked without an independent reference, so pass ${pass} of the critic pulled it back.`,
        severity: 'medium',
        suggestedAction: 'Confirm the UPI reference or the customer name before trusting this link.',
        transactionIds: [transaction.id],
        amount: transaction.amount,
        party: transaction.party,
      });
    });
  }

  // Rule 5 — suspiciously round open amounts are usually estimates, not records.
  transactions.forEach((transaction) => {
    if (transaction.status === 'matched' || !isRoundAmount(transaction.amount, policy.roundAmountFloor)) return;
    downgrade(transaction, 'Round-number amount', transaction.status, transaction.confidence);
    add({
      id: `round-${transaction.id}`,
      rule: 'round-amount',
      title: `Round amount to confirm: ${money(transaction.amount)}`,
      detail: `${transaction.party} shows an exactly round ${money(transaction.amount)} with no confirmed counterpart, which is often a remembered figure rather than a recorded one.`,
      severity: 'low',
      suggestedAction: 'Check the actual UPI amount before entering it in the books.',
      transactionIds: [transaction.id],
      amount: transaction.amount,
      party: transaction.party,
    });
  });

  transactions
    .filter((transaction) => transaction.status === 'partial')
    .forEach((transaction) =>
      add({
        id: `partial-${transaction.id}`,
        rule: 'partial',
        title: `Partial match: ${money(transaction.amount)}`,
        detail: `${transaction.party} has a near-amount match but no reliable shared reference.`,
        severity: 'medium',
        suggestedAction: 'Confirm whether this is a split payment or a separate collection.',
        transactionIds: [transaction.id],
        amount: transaction.amount,
        party: transaction.party,
      }),
    );

  transactions
    .filter((transaction) => transaction.status === 'unmatched')
    .forEach((transaction) =>
      add({
        id: `unmatched-${transaction.id}`,
        rule: 'unmatched',
        title: `Unmatched ${transaction.direction}: ${money(transaction.amount)}`,
        detail: `No supporting transaction was found across the supplied sources for ${transaction.party}.`,
        severity: 'medium',
        suggestedAction: 'Attach the missing payment message or mark it as cash/standalone.',
        transactionIds: [transaction.id],
        amount: transaction.amount,
        party: transaction.party,
      }),
    );

  exceptions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { transactions, exceptions };
}

function bandOf(score: number): { band: TrustBand; guidance: string } {
  if (score >= 80)
    return {
      band: 'High',
      guidance: 'Cross-source evidence is strong. Clear the remaining exceptions and the day can be closed.',
    };
  if (score >= 55)
    return { band: 'Moderate', guidance: 'Review exceptions before treating these books as clean.' };
  return {
    band: 'Low',
    guidance: 'Do not treat this as reconciled. Most records still need owner confirmation.',
  };
}

/**
 * Output Trust: how much of this run stands on independent cross-source
 * evidence, minus what the critic had to hold back. It is a property of the
 * output, not a confidence claim about the software.
 */
export function assessTrust(
  transactions: Transaction[],
  exceptions: Exception[],
  options: { criticFindings?: number; pass?: number } = {},
): Trust {
  const criticFindings = options.criticFindings || 0;
  const pass = options.pass || 1;
  const total = transactions.length;
  const matchedRecords = transactions.filter((transaction) => transaction.status === 'matched').length;
  const matchedPct = total ? Math.round((matchedRecords / total) * 100) : 0;
  const highSeverityCount = exceptions.filter((exception) => exception.severity === 'high').length;
  const matchPoints = matchedPct * MATCH_WEIGHT;
  const highSeverityPenalty = highSeverityCount * HIGH_SEVERITY_PENALTY;
  const criticPenalty = criticFindings * CRITIC_PENALTY_PER_FINDING;
  const raw = TRUST_BASE + matchPoints - highSeverityPenalty - criticPenalty;
  const floor = pass > 1 ? CRITIC_FLOOR : FLOOR;
  const score = Math.max(floor, Math.min(CEILING, Math.round(raw)));
  const { band, guidance } = bandOf(score);

  const duplicateRisk = transactions.filter((transaction) =>
    transaction.flags.some((flag) => /duplicate|similar party|repeat amount/i.test(flag)),
  ).length;
  const reasons: TrustReason[] = [
    total
      ? {
          text: `${matchedRecords}/${total} records have independent cross-source evidence`,
          kind: matchedPct >= 75 ? 'positive' : matchedPct >= 50 ? 'neutral' : 'warning',
        }
      : { text: 'No records could be read from the supplied evidence', kind: 'warning' },
    duplicateRisk
      ? { text: `${duplicateRisk} record(s) held back as duplicate or repeat-amount risk`, kind: 'warning' }
      : { text: 'No duplicate or repeat-amount risk detected', kind: 'positive' },
    exceptions.length
      ? { text: `${exceptions.length} decision(s) kept in the human queue`, kind: 'warning' }
      : { text: 'No exception queue remains', kind: 'positive' },
  ];
  if (pass > 1) {
    reasons.push(
      criticFindings
        ? { text: `Critic pass ${pass} pulled back ${criticFindings} weak link(s)`, kind: 'warning' }
        : { text: `Critic pass ${pass} found no additional weak links`, kind: 'neutral' },
    );
  }

  return {
    score,
    band,
    guidance,
    reasons,
    breakdown: {
      base: TRUST_BASE,
      matchedRecords,
      totalRecords: total,
      matchedPct,
      matchPoints: Math.round(matchPoints * 10) / 10,
      highSeverityCount,
      highSeverityPenalty,
      criticPenalty,
      raw: Math.round(raw * 10) / 10,
      floor,
      ceiling: CEILING,
      score,
    },
  };
}
