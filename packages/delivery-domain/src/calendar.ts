import { IsoDate, Month } from '@baseline/host-contract';
import { UTCDate, utc } from '@date-fns/utc';
import { addMonths, eachDayOfInterval, format, isWeekend, parseISO, startOfMonth, subDays } from 'date-fns';

// The only module that handles `Date` objects (D20). Every calculation runs on `UTCDate`, so the
// result doesn't depend on the time zone of the browser or container. Working days are Monday to
// Friday with no public holidays (brief §3.3).

const toUtc = (date: IsoDate): UTCDate => parseISO(date, { in: utc });
const toIsoDate = (date: Date): IsoDate => IsoDate.parse(format(date, 'yyyy-MM-dd'));
const toMonth = (date: Date): Month => Month.parse(format(date, 'yyyy-MM'));

export const monthOf = (date: IsoDate): Month => Month.parse(date.slice(0, 7));

export const firstDayOf = (month: Month): IsoDate => IsoDate.parse(`${month}-01`);

export const firstDayAfter = (month: Month): IsoDate => toIsoDate(addMonths(startOfMonth(toUtc(firstDayOf(month))), 1));

export const nextMonth = (month: Month): Month => monthOf(firstDayAfter(month));

/** Mon-Fri days in `[from, toExclusive)`. Zero when the range is empty or reversed. */
export function workingDaysBetween(from: IsoDate, toExclusive: IsoDate): number {
  if (toExclusive <= from) return 0;
  const days = eachDayOfInterval({ start: toUtc(from), end: subDays(toUtc(toExclusive), 1) });
  return days.filter((day) => !isWeekend(day)).length;
}

const workingDaysCache = new Map<Month, number>();

export function workingDaysIn(month: Month): number {
  let count = workingDaysCache.get(month);
  if (count === undefined) {
    count = workingDaysBetween(firstDayOf(month), firstDayAfter(month));
    workingDaysCache.set(month, count);
  }
  return count;
}

/** Every month from `start` to `end`, both included. Empty when `end` is before `start`. */
export function monthsBetween(start: Month, end: Month): Month[] {
  const months: Month[] = [];
  let cursor = toUtc(firstDayOf(start));
  const last = toUtc(firstDayOf(end));
  while (cursor <= last) {
    months.push(toMonth(cursor));
    cursor = addMonths(cursor, 1);
  }
  return months;
}
