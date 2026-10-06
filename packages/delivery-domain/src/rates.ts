import type { IsoDate, Month } from '@baseline/host-contract';
import { firstDayAfter, firstDayOf, workingDaysBetween } from './calendar';
import { type Rate, rate } from './units';

/** What the domain needs of a rate record. People's `RateRecord` satisfies it. */
export interface RateInput {
  readonly validFrom: IsoDate;
  /** EUR per hour. */
  readonly hourlyCost: number;
}

/** A stretch of a month that one rate covers. `hourlyCost` is null before the first rate. */
export interface RateSlice {
  readonly from: IsoDate;
  readonly toExclusive: IsoDate;
  readonly workingDays: number;
  readonly hourlyCost: Rate | null;
}

const byValidFrom = (a: RateInput, b: RateInput): number =>
  a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0;

/**
 * Splits a month at every rate change inside it, so N changes give N+1 slices. `validFrom` is
 * inclusive and the last rate is open-ended. Days before the first rate are an unpriced slice.
 * A change on the first of the month isn't a change inside it. If two records share a `validFrom`
 * (People refuses that), the later one in the input wins.
 */
export function sliceMonth(month: Month, rates: readonly RateInput[]): RateSlice[] {
  const start = firstDayOf(month);
  const end = firstDayAfter(month);
  const sorted = [...rates].sort(byValidFrom);
  const cuts = [...new Set(sorted.map((r) => r.validFrom).filter((date) => date > start && date < end))];

  const slices: RateSlice[] = [];
  let from = start;
  for (const toExclusive of [...cuts, end]) {
    const effective = sorted.findLast((r) => r.validFrom <= from);
    slices.push({
      from,
      toExclusive,
      workingDays: workingDaysBetween(from, toExclusive),
      hourlyCost: effective === undefined ? null : rate(effective.hourlyCost),
    });
    from = toExclusive;
  }
  return slices;
}
