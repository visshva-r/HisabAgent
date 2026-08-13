import { Exception, Transaction, Trust } from '../types';
import { money } from './normalize';

export type OwnerSummary = { en: string; hi: string };

/**
 * Explainer agent: states the same numbers the ledger holds, in the owner's
 * language, including what is still uncertain. It never smooths over gaps.
 */
export function explain(
  transactions: Transaction[],
  exceptions: Exception[],
  trust: Trust,
  shopName: string,
): OwnerSummary {
  const inflow = transactions.filter((t) => t.direction === 'credit').reduce((sum, t) => sum + t.amount, 0);
  const outflow = transactions.filter((t) => t.direction === 'debit').reduce((sum, t) => sum + t.amount, 0);
  const matched = transactions.filter((t) => t.status === 'matched').length;
  const open = transactions.filter((t) => t.status !== 'matched');
  const openValue = open.reduce((sum, t) => sum + t.amount, 0);
  const duplicates = exceptions.filter((e) => e.rule === 'duplicate').length;
  const pct = trust.breakdown.matchedPct;

  const en = [
    `${shopName}: ${money(inflow)} received and ${money(outflow)} paid across ${transactions.length} records.`,
    `${matched} records are confirmed by both sources (${pct}%).`,
    duplicates ? `${duplicates} possible duplicate credit(s) were held back before they entered the books.` : '',
    `${exceptions.length} decision(s) remain with you, covering ${money(openValue)}.`,
    `Output Trust is ${trust.score}/100 (${trust.band}). ${trust.guidance}`,
  ]
    .filter(Boolean)
    .join(' ');

  const hi = [
    `${shopName} के लिए ${money(inflow)} प्राप्त और ${money(outflow)} भुगतान दर्ज हुए (${transactions.length} रिकॉर्ड)।`,
    `${matched} रिकॉर्ड दोनों स्रोतों से मिलान हुए (${pct}%)।`,
    duplicates ? `${duplicates} संभावित दोहरी एंट्री रोक दी गई।` : '',
    `${exceptions.length} मामलों में आपकी पुष्टि चाहिए, कुल ${money(openValue)}।`,
    `Output Trust ${trust.score}/100 (${trust.band})।`,
  ]
    .filter(Boolean)
    .join(' ');

  return { en, hi };
}
