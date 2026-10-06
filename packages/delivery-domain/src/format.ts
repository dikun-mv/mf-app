import { CurrencyCode } from '@baseline/host-contract';
import { assertNever } from './never';
import { stepsOf } from './rounding';
import { DISPLAY_DECIMALS, type DisplayUnit, RATE_DECIMALS } from './units';

const EUR = CurrencyCode.parse('EUR');
const LOCALE = 'en-US';

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

/** An hourly rate in the display currency, at 4 decimal places: `€89.5455/h`. */
export function formatRate(perHour: number, currency: CurrencyCode = EUR): string {
  return `${currencyFormat(currency, RATE_DECIMALS).format(perHour)}/h`;
}
