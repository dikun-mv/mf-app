import { z } from 'zod';

// Shared primitives (T1.1). Dates and months cross every boundary as strings: the
// delivery-domain calendar module is the only place they become `Date` objects (D20).

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** A calendar day, `YYYY-MM-DD`. */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate, 'not a calendar date')
  .brand<'IsoDate'>();
export type IsoDate = z.infer<typeof IsoDate>;

/**
 * An instant in UTC as `Date.prototype.toISOString()` writes it. Its fixed length means string
 * comparison sorts by time, which the capacity causer rule relies on (D18).
 */
export const IsoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/)
  .refine(isCalendarDate, 'not a calendar date')
  .brand<'IsoDateTime'>();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** A calendar month, `YYYY-MM`. */
export const Month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .brand<'Month'>();
export type Month = z.infer<typeof Month>;

/** An ISO 4217 currency code. */
export const CurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .brand<'CurrencyCode'>();
export type CurrencyCode = z.infer<typeof CurrencyCode>;

const SEED_SUFFIX = '\\d+';
const UUID_SUFFIX = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Builds the schema for an id like `wbs-012` (a seed id) or `wbs-<uuid>` (a client-generated one):
 * `entityId('emp', 'EmployeeId')`. The brand exists only in the type.
 */
export function entityId<B extends string>(prefix: string, _brand: B) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}-(${SEED_SUFFIX}|${UUID_SUFFIX})$`))
    .brand<B>();
}
