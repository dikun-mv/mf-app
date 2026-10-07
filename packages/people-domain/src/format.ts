import type { Currency, IsoDate, Month } from '@baseline/host-contract';
import { utc } from '@date-fns/utc';
import { format, parseISO } from 'date-fns';

// How People shows dates and money (D34, T5.6): one locale in every app, so the e2e strings and the
// reference values read the same on every machine. People can't use `delivery-domain`'s formatters
// (T0.2 rule 2), so this is its own small copy.

/** The display locale of every app (D34). */
export const LOCALE = 'en-GB';

// Month names come from date-fns, not `Intl`: recent ICU data spells September `Sept` in en-GB, and
// the screens (and the e2e strings) say `Sep`. Everything runs in UTC (D20).

/** A day as `12 Mar 2026`. */
export const formatDate = (date: IsoDate): string => format(parseISO(date, { in: utc }), 'd MMM yyyy');

/** A month as `Mar 2026`. */
export const formatMonth = (month: Month): string => format(parseISO(`${month}-01`, { in: utc }), 'MMM yyyy');

const currencyFormats = new Map<string, Intl.NumberFormat>();

function currencyFormat(code: Currency['code']): Intl.NumberFormat {
  let numberFormat = currencyFormats.get(code);
  if (numberFormat === undefined) {
    numberFormat = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    });
    currencyFormats.set(code, numberFormat);
  }
  return numberFormat;
}

// Plain digits with two decimals and no grouping, the text a rate field is prefilled with. It is also
// what "as displayed" means when a correction is compared with the stored rate.
const amountTextFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/** An EUR amount in the display currency, unrounded. Rates are stored in EUR (D11). */
export const toDisplayCurrency = (eur: number, currency: Currency): number => eur * currency.perEur;

/** An amount entered in the display currency as EUR, unrounded: `amount ÷ perEur` (D11). */
export const toEur = (amount: number, currency: Currency): number => amount / currency.perEur;

/** An EUR amount in the display currency: `$102.60`. */
export const formatMoney = (eur: number, currency: Currency): string =>
  currencyFormat(currency.code).format(toDisplayCurrency(eur, currency));

/** An EUR hourly rate in the display currency: `€95.00/h`. */
export const formatHourlyRate = (eur: number, currency: Currency): string => `${formatMoney(eur, currency)}/h`;

/** A stored EUR rate as the text of an amount field in the display currency: `102.60`. */
export const displayAmountText = (eur: number, currency: Currency): string =>
  amountTextFormat.format(toDisplayCurrency(eur, currency));

/**
 * Whether an amount entered in the display currency is the stored rate as the field shows it (two
 * decimals). An unchanged correction then makes no write, so retyping `102.60` for a stored 95 EUR
 * never turns it into 94.9999 or 95.0001 after a round trip through USD.
 */
export const equalsDisplayed = (entered: number, storedEur: number, currency: Currency): boolean =>
  amountTextFormat.format(entered) === displayAmountText(storedEur, currency);
