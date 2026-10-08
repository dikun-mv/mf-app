import type { Currency } from '@baseline/host-contract';
import { RateRecord } from '@baseline/people-contract';
import { formatDate, parseAmount, toEur, type AmountError, type RateHistoryError } from '@baseline/people-domain';
import { z } from 'zod';

// The shared part of the rate forms (D27): what the add and correct forms check before sending, and how a
// refusal from `people-domain` lands on a field. Each rule stays where it lives: shapes in the contract,
// the amount's text in `parseAmount`, the history's rules in `checkRateHistory`.

/** What the two text fields hold, as typed. */
export interface RateFormFields {
  validFrom: string;
  amount: string;
}

/** What a valid form gives: the day, the amount as entered, and the same amount in EUR, as stored (D11). */
export interface RateFormValues {
  validFrom: RateRecord['validFrom'];
  entered: number;
  hourlyCost: number;
}

const AMOUNT_MESSAGES = {
  empty: 'Enter the hourly cost.',
  notANumber: 'Enter the cost as a number, for example 98.00.',
  negative: 'The cost must be above 0.',
} as const satisfies Record<AmountError, string>;

const NOT_POSITIVE = 'The cost must be above 0.';

/**
 * The first layer of D27: the shapes. The day must be a real date (the contract's `IsoDate`); the amount is
 * parsed with `parseAmount` (D34) and converted to EUR with the display currency, and it is the converted
 * value that must be above 0 (the contract's `hourlyCost`), so an amount that rounds to nothing in EUR is
 * refused too. The schema depends on the currency, so a form builds it again when the currency changes.
 */
export const rateFormSchema = (currency: Currency) =>
  z
    .object({
      validFrom: z.string().transform((text, ctx) => {
        const day = RateRecord.shape.validFrom.safeParse(text);
        if (day.success) return day.data;
        ctx.issues.push({
          code: 'custom',
          message: text === '' ? 'Enter the day the rate starts.' : 'Enter a valid date.',
          input: text,
        });
        return z.NEVER;
      }),
      amount: z.string().transform((text, ctx) => {
        const parsed = parseAmount(text);
        const entered = parsed.ok ? parsed.value : null;
        const cost = RateRecord.shape.hourlyCost.safeParse(entered === null ? NaN : toEur(entered, currency));
        if (entered !== null && cost.success) return { entered, hourlyCost: cost.data };
        ctx.issues.push({
          code: 'custom',
          message: parsed.ok ? NOT_POSITIVE : AMOUNT_MESSAGES[parsed.error],
          input: text,
        });
        return z.NEVER;
      }),
    })
    .transform(({ validFrom, amount }): RateFormValues => ({ validFrom, ...amount }));

/** Where a refusal from `people-domain` is shown: at the field it concerns, or for the whole form. */
export interface FieldRefusal {
  readonly field: 'validFrom' | 'amount' | 'root.server';
  readonly message: string;
}

/**
 * The second layer of D27: a `DomainError` from `addRate` or `correctRate` becomes a message at its field. A
 * clash with another rate's start day belongs to the day, a cost that is not above 0 to the amount. The other
 * two (a rate that is no longer there, an id used twice) cannot come from a form that has just been checked
 * against the live history, so they are shown for the whole form.
 */
export function refusalOf(error: RateHistoryError): FieldRefusal {
  switch (error.code) {
    case 'duplicateValidFrom':
      return { field: 'validFrom', message: `Another rate already starts on ${formatDate(error.validFrom)}.` };
    case 'nonPositiveRate':
      return { field: 'amount', message: NOT_POSITIVE };
    case 'notFound':
      return { field: 'root.server', message: "This rate was removed elsewhere, so the change can't be saved." };
    case 'duplicateId':
      return { field: 'root.server', message: 'This rate was already added.' };
  }
}
