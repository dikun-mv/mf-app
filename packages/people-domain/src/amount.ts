import { type Result, err, ok } from './result';

/** Why a typed amount was refused. */
export type AmountError = 'empty' | 'notANumber' | 'negative';

// An optional minus, an optional currency symbol, the number, an optional `%` or `h`. The number is
// digits with an optional `.` fraction; `,` is allowed only as a group separator, between groups of
// three digits (`7,880.5`), so `0,5` and `1,23` don't match and are refused as ambiguous (D34).
const AMOUNT = /^(-)?\s*[€$£]?\s*(\d{1,3}(?:,\d{3})+|\d+)?(\.\d+)?\s*[%h]?$/;

/**
 * Parses the text of an amount field (D34). It trims, drops a leading currency symbol and a trailing
 * `%` or `h`, takes `.` as the decimal point and `,` only between groups of three digits. People's
 * own copy: `delivery-domain` has one too (T0.2 rule 2). Zero is a number; whether it is allowed is
 * the caller's rule (a rate must be above zero).
 */
export function parseAmount(text: string): Result<number, AmountError> {
  const trimmed = text.trim();
  if (trimmed === '') return err('empty');
  const match = AMOUNT.exec(trimmed);
  const [, minus, whole, fraction] = match ?? [];
  if (match === null || (whole === undefined && fraction === undefined)) return err('notANumber');
  const value = Number(`${(whole ?? '0').replaceAll(',', '')}${fraction ?? ''}`);
  if (!Number.isFinite(value)) return err('notANumber');
  return minus !== undefined && value !== 0 ? err('negative') : ok(value);
}
