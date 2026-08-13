/**
 * Shared normalization primitives used by the ingestor, matcher and critic.
 * Everything here is deterministic: no randomness, no clock reads, no network.
 */

const CURRENCY_AMOUNT = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
const BARE_AMOUNT = /\d[\d,]*(?:\.\d{1,2})?/g;
const DATE = /(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
const DATE_ALL = /(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g;
const TIME_ALL = /\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b/gi;
const NAME_NOISE = /\b(stores?|store|traders?|trading|enterprises?|shop|and|co|pvt|ltd|the|ref|upi|txn|utr)\b/g;

const toNumber = (value: string) => Number(value.replace(/,/g, ''));

/**
 * Reads money out of a cell or a chat line. A currency marker always wins, so
 * "01/08/2026 Anita paid ₹2,500" is ₹2,500 and not ₹1 — dates and clock times
 * are stripped before any bare number is trusted.
 */
export function parseAmount(text: string): number {
  const marked = text.match(CURRENCY_AMOUNT);
  if (marked) return toNumber(marked[1]);
  const stripped = text.replace(DATE_ALL, ' ').replace(TIME_ALL, ' ');
  const bare = stripped.match(BARE_AMOUNT);
  return bare ? toNumber(bare[0]) : 0;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasDate(text: string): boolean {
  return DATE.test(text);
}

/** Every ledger date is stored as ISO `YYYY-MM-DD`, whatever the source used. */
export function parseDate(text: string, fallback: string): string {
  const found = text.match(DATE)?.[1];
  if (!found) return fallback;
  const parsed = toDate(found);
  if (!parsed) return fallback;
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

export function tokens(text: string): string[] {
  return text
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

/** Excel exports from Indian banks arrive comma, semicolon or tab separated. */
export function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  if (headerLine.includes(',')) return ',';
  if (headerLine.includes(';')) return ';';
  if (headerLine.includes('\t')) return '\t';
  return ',';
}

export function csvCells(line: string, delimiter: ',' | ';' | '\t' = ','): string[] {
  const pattern = new RegExp(`(?:${delimiter === '\t' ? '\\t' : delimiter}|^)("(?:[^"]|"")*"|[^${delimiter === '\t' ? '\\t' : delimiter}]*)`, 'g');
  return (
    line
      .match(pattern)
      ?.map((cell) =>
        cell
          .replace(new RegExp(`^${delimiter === '\t' ? '\\t' : delimiter}`), '')
          .replace(/^"|"$/g, '')
          .replace(/""/g, '"')
          .trim(),
      ) || []
  );
}

/**
 * True when a cell is only a date. Dates are excluded from the amount fallback
 * scan, otherwise a corrupt row like `2026-08-03;abc` would be read as ₹2026.
 */
export function isDateOnly(cell: string): boolean {
  const value = cell.trim();
  if (!value || !DATE.test(value)) return false;
  const remainder = value.replace(DATE, ' ').replace(/\b\d{1,2}:\d{2}(:\d{2})?\s?(am|pm)?\b/i, ' ');
  return !/\d/.test(remainder);
}

/** True when two party strings share at least one meaningful word. */
export function sharesToken(a: string, b: string): boolean {
  const left = tokens(a.toLowerCase());
  const right = tokens(b.toLowerCase());
  return left.some((word) => right.includes(word));
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(NAME_NOISE, ' ')
    .replace(/\s+/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Normalized edit-distance similarity (0-1) between two counterparty names.
 * Legal suffixes and reference words are stripped first so "ANITA" and
 * "Anita Stores" are recognised as the same shop.
 */
export function nameSimilarity(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

export function toDate(value: string): Date | null {
  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const local = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (local) {
    const year = Number(local[3]) < 100 ? 2000 + Number(local[3]) : Number(local[3]);
    return new Date(year, Number(local[2]) - 1, Number(local[1]));
  }
  return null;
}

/** Whole days between two ledger dates, or null when either date is unparseable. */
export function dayGap(a: string, b: string): number | null {
  const left = toDate(a);
  const right = toDate(b);
  if (!left || !right) return null;
  return Math.round(Math.abs(left.getTime() - right.getTime()) / 86_400_000);
}

export function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function isRoundAmount(amount: number, floor: number): boolean {
  return amount >= floor && amount % 1000 === 0;
}

export const money = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;
