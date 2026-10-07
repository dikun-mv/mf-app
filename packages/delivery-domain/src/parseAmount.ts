import { type Result, err, ok } from './result';

// What the user typed into a cell, as a number (D34). One pure function, so the same text means the
// same everywhere. `delivery-domain` and `people-domain` each keep their own copy (T0.2 rule 2).

export type AmountError = 'empty' | 'notANumber' | 'negative';

/** Digits with `,` only between groups of three, or plain digits, then an optional `.` and decimals. */
const NUMBER = /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/;

/**
 * Trims, drops a leading currency symbol and a trailing `%` or `h`, accepts `.` as the decimal point
 * and `,` only between groups of three digits: `7,880.5` is accepted and `0,5` is refused as
 * ambiguous (a decimal comma or a thousands comma?), which is safer than guessing in a cost grid.
 */
export function parseAmount(text: string): Result<number, AmountError> {
  const trimmed = text.trim();
  if (trimmed === '') return err('empty');

  let rest = trimmed.replace(/\s*[%h]$/i, '');
  /** Removes what `pattern` matches at the start, and returns it (or an empty string). */
  const take = (pattern: RegExp): string => {
    const taken = pattern.exec(rest)?.[0] ?? '';
    rest = rest.slice(taken.length).trimStart();
    return taken;
  };
  // A sign may stand before or after the currency symbol (`-€5`, `€-5`), but not in both places.
  const signBefore = take(/^[-+]/);
  take(/^\p{Sc}/u);
  const signAfter = take(/^[-+]/);
  if ((signBefore !== '' && signAfter !== '') || !NUMBER.test(rest)) return err('notANumber');

  const value = Number(rest.replaceAll(',', ''));
  return signBefore + signAfter === '-' && value > 0 ? err('negative') : ok(value);
}
