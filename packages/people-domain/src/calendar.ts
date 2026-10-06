import { IsoDate, Month } from '@baseline/host-contract';
import { UTCDate, utc } from '@date-fns/utc';
import { addMonths, eachDayOfInterval, format, isWeekend, parseISO, startOfMonth, subDays } from 'date-fns';

// The little calendar maths People needs: whether a month has working days before a given day.
// Everything runs on `UTCDate`, so the answer doesn't depend on the time zone (D20). People owns
// its own copy rather than importing Delivery's domain (T0.2); the two agree on Mon-Fri, no holidays.

const toUtc = (date: IsoDate): UTCDate => parseISO(date, { in: utc });

export const monthOf = (date: IsoDate): Month => Month.parse(date.slice(0, 7));

export const firstDayOf = (month: Month): IsoDate => IsoDate.parse(`${month}-01`);

export const firstDayAfter = (month: Month): IsoDate =>
  IsoDate.parse(format(addMonths(startOfMonth(toUtc(firstDayOf(month))), 1), 'yyyy-MM-dd'));

/** Mon-Fri days in `[from, toExclusive)`. */
export function workingDaysBetween(from: IsoDate, toExclusive: IsoDate): number {
  if (toExclusive <= from) return 0;
  return eachDayOfInterval({ start: toUtc(from), end: subDays(toUtc(toExclusive), 1) }).filter((day) => !isWeekend(day))
    .length;
}
