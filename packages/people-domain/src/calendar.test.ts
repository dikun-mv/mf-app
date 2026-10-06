import { IsoDate, Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { firstDayAfter, firstDayOf, monthOf, workingDaysBetween } from './calendar';

const date = (value: string) => IsoDate.parse(value);

describe('people calendar', () => {
  it('counts Monday to Friday in a half-open range', () => {
    expect(workingDaysBetween(date('2026-03-01'), date('2026-03-12'))).toBe(8);
    expect(workingDaysBetween(date('2026-03-12'), date('2026-04-01'))).toBe(14);
  });

  it('is empty for an empty or reversed range', () => {
    expect(workingDaysBetween(date('2026-03-12'), date('2026-03-12'))).toBe(0);
    expect(workingDaysBetween(date('2026-03-12'), date('2026-03-01'))).toBe(0);
  });

  it('finds the month of a day and the days around it', () => {
    expect(monthOf(date('2026-12-31'))).toBe('2026-12');
    expect(firstDayOf(Month.parse('2026-12'))).toBe('2026-12-01');
    expect(firstDayAfter(Month.parse('2026-12'))).toBe('2027-01-01');
  });
});
