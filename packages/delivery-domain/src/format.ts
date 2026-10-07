import { CurrencyCode, type IsoDate, type Month } from '@baseline/host-contract';
import { at } from './lookup';
import { assertNever } from './never';
import { stepsOf } from './rounding';
import { DISPLAY_DECIMALS, type DisplayUnit, RATE_DECIMALS } from './units';

const EUR = CurrencyCode.parse('EUR');

/** The one display locale of every app (D34), so E2E strings and reference values read the same on every machine. */
export const LOCALE = 'en-GB';

const decimalFormats = new Map<number, Intl.NumberFormat>();
const currencyFormats = new Map<string, Intl.NumberFormat>();

function decimalFormat(decimals: number): Intl.NumberFormat {
  let format = decimalFormats.get(decimals);
  if (format === undefined) {
    format = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    decimalFormats.set(decimals, format);
  }
  return format;
}

function currencyFormat(currency: CurrencyCode, decimals: number): Intl.NumberFormat {
  const key = `${currency}/${String(decimals)}`;
  let format = currencyFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol', // €7,880.00, $… and £…, never US$ or CA$.
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    currencyFormats.set(key, format);
  }
  return format;
}

/**
 * Formats a value already rounded to whole display steps, such as a cell from `roundGrid`. It
 * never rounds: a fractional step count means a caller skipped the rounding, so it throws.
 */
export function formatUnit(steps: number, unit: DisplayUnit, currency: CurrencyCode = EUR): string {
  if (!Number.isInteger(steps)) throw new RangeError(`Expected whole display steps, got ${String(steps)}`);
  const value = steps / stepsOf(unit);
  switch (unit) {
    case 'hours':
    case 'personMonths':
      return decimalFormat(DISPLAY_DECIMALS[unit]).format(value);
    case 'percent':
      return `${decimalFormat(DISPLAY_DECIMALS.percent).format(value)}%`;
    case 'cost':
      return currencyFormat(currency, DISPLAY_DECIMALS.cost).format(value);
    default:
      return assertNever(unit);
  }
}

/** An hourly rate in the display currency, at 4 decimal places by default: `€89.5455/h`. */
export function formatRate(perHour: number, currency: CurrencyCode = EUR, decimals: number = RATE_DECIMALS): string {
  return `${currencyFormat(currency, decimals).format(perHour)}/h`;
}

// Dates are written out from fixed month names rather than through `Intl`, because the short name of
// September differs between ICU versions ("Sep" or "Sept") and the calendar module is the only
// place that handles `Date` objects.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const monthName = (monthNumber: string): string => at(MONTH_NAMES, Number(monthNumber) - 1);

/** `2026-03-12` as `12 Mar 2026`. */
export const formatDate = (date: IsoDate): string =>
  `${String(Number(date.slice(8, 10)))} ${monthName(date.slice(5, 7))} ${date.slice(0, 4)}`;

/** `2026-03` as `Mar 2026`. */
export const formatMonth = (month: Month): string => `${monthName(month.slice(5, 7))} ${month.slice(0, 4)}`;

/** `2026-03` as `Mar 26`, for a column header. */
export const formatMonthShort = (month: Month): string => `${monthName(month.slice(5, 7))} ${month.slice(2, 4)}`;
