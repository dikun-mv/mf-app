import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import type { IsoDate, Month } from '@baseline/host-contract';
import type { RateRecord } from '@baseline/people-contract';
import { firstDayAfter, firstDayOf, workingDaysBetween } from './calendar';

/** How a month of an employee's work is priced, as Delivery will see it. */
export type MonthPricing = 'priced' | 'partiallyPriced' | 'unpriced';

const SEVERITY = { priced: 0, partiallyPriced: 1, unpriced: 2 } as const satisfies Record<MonthPricing, number>;

export interface PricingImpact {
  readonly month: Month;
  readonly before: MonthPricing;
  readonly after: MonthPricing;
  readonly allocatedPersonMonths: number;
}

const earliest = (history: readonly Pick<RateRecord, 'validFrom'>[]): IsoDate | null =>
  history.reduce<IsoDate | null>(
    (first, record) => (first === null || record.validFrom < first ? record.validFrom : first),
    null,
  );

/**
 * Whether the working days of a month have a rate, which depends only on the earliest rate:
 * priced when every working day is on or after it, unpriced when none is, otherwise partially
 * priced (the days before it cost nothing). The same rule Delivery prices by, so People can warn
 * before an edit does the damage.
 */
export function monthPricing(month: Month, firstRateFrom: IsoDate | null): MonthPricing {
  if (firstRateFrom === null) return 'unpriced';
  const start = firstDayOf(month);
  const end = firstDayAfter(month);
  if (firstRateFrom <= start) return 'priced';
  if (firstRateFrom >= end) return 'unpriced';
  if (workingDaysBetween(firstRateFrom, end) === 0) return 'unpriced';
  return workingDaysBetween(start, firstRateFrom) === 0 ? 'priced' : 'partiallyPriced';
}

/**
 * The months with work allocated that an edit would price worse than today: priced to partly or
 * not priced, or partly priced to not priced. People doesn't see allocations (D8), so the caller
 * passes this employee's entries from Delivery's load feed. The edit is never blocked; the result
 * is what to tell the user first.
 */
export function pricingImpact(
  before: readonly Pick<RateRecord, 'validFrom'>[],
  after: readonly Pick<RateRecord, 'validFrom'>[],
  loads: readonly Pick<EmployeeMonthLoad, 'month' | 'allocatedPersonMonths'>[],
): PricingImpact[] {
  const firstBefore = earliest(before);
  const firstAfter = earliest(after);
  return loads
    .filter((load) => load.allocatedPersonMonths > 0)
    .map((load) => ({
      month: load.month,
      before: monthPricing(load.month, firstBefore),
      after: monthPricing(load.month, firstAfter),
      allocatedPersonMonths: load.allocatedPersonMonths,
    }))
    .filter((impact) => SEVERITY[impact.after] > SEVERITY[impact.before])
    .sort((a, b) => (a.month < b.month ? -1 : 1)); // One entry per month in the feed.
}
