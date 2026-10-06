import { IsoDate, Month } from '@baseline/host-contract';
import { afterAll, describe, expect, it } from '@rstest/core';
import {
  firstDayAfter,
  firstDayOf,
  monthOf,
  monthsBetween,
  nextMonth,
  workingDaysBetween,
  workingDaysIn,
} from './calendar';

const date = (value: string) => IsoDate.parse(value);
const month = (value: string) => Month.parse(value);

describe('workingDaysIn', () => {
  it('counts Monday to Friday with no holidays', () => {
    expect(workingDaysIn(month('2026-03'))).toBe(22);
    expect(workingDaysIn(month('2026-02'))).toBe(20);
    expect(workingDaysIn(month('2026-05'))).toBe(21);
    expect(workingDaysIn(month('2026-08'))).toBe(21);
  });

  it('handles leap Februaries', () => {
    expect(workingDaysIn(month('2028-02'))).toBe(21);
    expect(workingDaysIn(month('2027-02'))).toBe(20);
  });
});

describe('workingDaysBetween', () => {
  it('splits March 2026 around the 12th: 8 before, 14 from (brief §3.4)', () => {
    expect(workingDaysBetween(date('2026-03-01'), date('2026-03-12'))).toBe(8);
    expect(workingDaysBetween(date('2026-03-12'), date('2026-04-01'))).toBe(14);
  });

  it('is empty for an empty or reversed range', () => {
    expect(workingDaysBetween(date('2026-03-12'), date('2026-03-12'))).toBe(0);
    expect(workingDaysBetween(date('2026-03-12'), date('2026-03-01'))).toBe(0);
  });

  it('excludes the end day and includes the start day', () => {
    // 2026-03-13 is a Friday, 03-14 a Saturday.
    expect(workingDaysBetween(date('2026-03-13'), date('2026-03-14'))).toBe(1);
    expect(workingDaysBetween(date('2026-03-14'), date('2026-03-16'))).toBe(0);
  });
});

describe('month helpers', () => {
  it('finds the month of a day and the days around it', () => {
    expect(monthOf(date('2026-03-12'))).toBe('2026-03');
    expect(firstDayOf(month('2026-03'))).toBe('2026-03-01');
    expect(firstDayAfter(month('2026-03'))).toBe('2026-04-01');
    expect(firstDayAfter(month('2026-12'))).toBe('2027-01-01');
    expect(nextMonth(month('2026-12'))).toBe('2027-01');
  });

  it('lists months inclusively, across a year end', () => {
    expect(monthsBetween(month('2026-11'), month('2027-02'))).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween(month('2026-03'), month('2026-03'))).toEqual(['2026-03']);
  });

  it('is empty when the end is before the start', () => {
    expect(monthsBetween(month('2026-04'), month('2026-03'))).toEqual([]);
  });
});

describe('time zone independence (D20)', () => {
  const original = process.env.TZ;
  afterAll(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  const zones = ['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Asia/Kolkata'];

  it('really switches the process time zone, so the check below is not vacuous', () => {
    const offsets = zones.map((zone) => {
      process.env.TZ = zone;
      return new Date(2026, 2, 1).getTimezoneOffset();
    });
    expect(new Set(offsets).size).toBe(zones.length);
  });

  it('gives the same 22 / 8 / 14 split and month lists in every zone', () => {
    const results = zones.map((zone) => {
      process.env.TZ = zone;
      return {
        march: workingDaysIn(month('2026-03')),
        before: workingDaysBetween(date('2026-03-01'), date('2026-03-12')),
        from: workingDaysBetween(date('2026-03-12'), date('2026-04-01')),
        next: firstDayAfter(month('2026-10')),
        months: monthsBetween(month('2026-03'), month('2026-11')),
        // Daylight-saving changes fall inside these ranges in the zones above.
        dstSpan: workingDaysBetween(date('2026-03-01'), date('2026-11-30')),
      };
    });
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
    expect(results[0]).toMatchObject({ march: 22, before: 8, from: 14, next: '2026-11-01' });
  });
});
