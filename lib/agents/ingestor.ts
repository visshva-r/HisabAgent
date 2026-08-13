import { Transaction } from '../types';
import { csvCells, detectDelimiter, hasDate, isDateOnly, parseAmount, parseDate, today, tokens } from './normalize';

const NOTE_STOP_WORDS = [
  'paid',
  'received',
  'from',
  'today',
  'yesterday',
  'payment',
  'amount',
  'cash',
  'upi',
  'ref',
  'utr',
  'txn',
  'rrn',
  'collection',
  'transfer',
  'mile',
  'mila',
  'bheje',
  'bheja',
  'diya',
];
const DEBIT_HINTS = /^(paid|sent)\b|\bpaid to\b|\bdiya\b|दिया|भेजा/;

/**
 * Picks the working day for undated evidence: the most frequent date already
 * seen in the ledger, so undated WhatsApp notes are not scattered across the
 * calendar (which would otherwise look like repeat-amount risk to the critic).
 */
function workingDay(dates: string[]): string {
  const counts = new Map<string, number>();
  dates.forEach((date) => counts.set(date, (counts.get(date) || 0) + 1));
  let best = today();
  let bestCount = 0;
  counts.forEach((count, date) => {
    if (count > bestCount) {
      best = date;
      bestCount = count;
    }
  });
  return best;
}

export function parseCsv(text: string, fallbackDate = today()): Transaction[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = csvCells(lines[0], delimiter).map((header) => header.toLowerCase());

  return lines
    .slice(1)
    .map((line, index) => {
      const cells = csvCells(line, delimiter);
      const loose = (keys: string[]) => cells[headers.findIndex((h) => keys.some((k) => h.includes(k)))] || '';
      const exact = (keys: string[]) => {
        for (const key of keys) {
          const position = headers.findIndex((h) => h === key || h.includes(key));
          if (position >= 0) return cells[position] || '';
        }
        return '';
      };

      const rawAmount =
        [exact(['amount', 'amt', 'value']), ...cells].find((cell) => !isDateOnly(cell) && parseAmount(cell) > 0) || '';
      const rawDate = exact(['date', 'timestamp', 'time']) || line;
      const party = exact(['payer', 'payee', 'name', 'remark', 'note', 'vpa', 'merchant']) || 'UPI counterparty';
      const reference = exact(['upi ref', 'utr', 'rrn', 'transaction id', 'txn', 'ref']) || `CSV-${index + 1}`;
      const typeCell = loose(['type', 'dr/cr', 'direction', 'debit credit']).toLowerCase();
      const isDebit = (typeCell + line.toLowerCase()).includes('debit') || line.toLowerCase().includes('paid to');

      return {
        id: `upi-${index}`,
        date: parseDate(rawDate, fallbackDate),
        amount: parseAmount(rawAmount),
        direction: isDebit ? ('debit' as const) : ('credit' as const),
        party,
        reference,
        source: 'upi' as const,
        status: 'unmatched' as const,
        confidence: 38,
        matchReason: 'Awaiting cross-source reconciliation',
        flags: [],
        linkedIds: [],
      };
    })
    .filter((transaction) => transaction.amount > 0);
}

export function parseNotes(text: string, fallbackDate = today()): Transaction[] {
  return text
    .split(/\r?\n/)
    .filter((line) => parseAmount(line) > 0)
    .map((line, index) => {
      const lower = line.toLowerCase();
      const reference = line.match(/(?:ref|utr|txn|upi)[\s:#-]*([A-Za-z0-9-]{5,})/i)?.[1] || `NOTE-${index + 1}`;
      const party =
        tokens(line)
          .filter((word) => !NOTE_STOP_WORDS.includes(word.toLowerCase()))
          .slice(0, 3)
          .join(' ') || 'WhatsApp note';

      return {
        id: `note-${index}`,
        date: parseDate(line, fallbackDate),
        amount: parseAmount(line),
        direction: DEBIT_HINTS.test(lower) ? ('debit' as const) : ('credit' as const),
        party,
        reference,
        source: 'note' as const,
        status: 'unmatched' as const,
        confidence: 32,
        matchReason: 'Parsed from informal payment note',
        flags: [],
        linkedIds: [],
      };
    });
}

/**
 * Ingestor agent: turns both evidence sources into one canonical ledger and
 * attributes undated notes to the ledger's working day.
 */
export function ingest(csv: string, notes: string): Transaction[] {
  const dated = [
    ...csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .filter(hasDate)
      .map((line) => parseDate(line, today())),
    ...notes
      .split(/\r?\n/)
      .filter(hasDate)
      .map((line) => parseDate(line, today())),
  ];
  const fallbackDate = workingDay(dated);
  return [...parseCsv(csv, fallbackDate), ...parseNotes(notes, fallbackDate)];
}
