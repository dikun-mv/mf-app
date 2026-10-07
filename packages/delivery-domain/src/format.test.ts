import { CurrencyCode, IsoDate, Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { LOCALE, formatDate, formatDayMonth, formatMonth, formatMonthShort, formatRate, formatUnit } from './format';

const code = (value: string) => CurrencyCode.parse(value);

describe('formatUnit (D34: en-GB, narrow currency symbols)', () => {
  it('uses one locale everywhere', () => {
    expect(LOCALE).toBe('en-GB');
  });

  it('formats the four units from whole steps', () => {
    expect(formatUnit(8800, 'hours')).toBe('88.00');
    expect(formatUnit(50, 'personMonths')).toBe('0.50');
    expect(formatUnit(500, 'percent')).toBe('50.0%');
    expect(formatUnit(788000, 'cost')).toBe('€7,880.00');
  });

  it('shows the narrow symbol of every display currency, never US$ or A$', () => {
    expect(formatUnit(788000, 'cost', code('USD'))).toBe('$7,880.00');
    expect(formatUnit(788000, 'cost', code('GBP'))).toBe('£7,880.00');
    expect(formatUnit(788000, 'cost', code('AUD'))).toBe('$7,880.00');
  });

  it('throws when given a fractional step count, because a caller skipped the rounding', () => {
    expect(() => formatUnit(0.5, 'hours')).toThrow(RangeError);
  });
});

describe('formatRate', () => {
  it('shows four decimals by default and any other count on request', () => {
    expect(formatRate(1970 / 22)).toBe('€89.5455/h');
    expect(formatRate(80, code('EUR'), 2)).toBe('€80.00/h');
    expect(formatRate(86.4, code('USD'), 2)).toBe('$86.40/h');
  });
});

describe('dates', () => {
  it('writes a day as 12 Mar 2026, without a leading zero', () => {
    expect(formatDate(IsoDate.parse('2026-03-12'))).toBe('12 Mar 2026');
    expect(formatDate(IsoDate.parse('2026-09-01'))).toBe('1 Sep 2026');
    expect(formatDate(IsoDate.parse('2027-02-28'))).toBe('28 Feb 2027');
  });

  it('writes a day and month alone as 12 Mar', () => {
    expect(formatDayMonth(IsoDate.parse('2026-03-12'))).toBe('12 Mar');
    expect(formatDayMonth(IsoDate.parse('2026-11-01'))).toBe('1 Nov');
  });

  it('writes a month in full and short forms', () => {
    expect(formatMonth(Month.parse('2026-03'))).toBe('Mar 2026');
    expect(formatMonthShort(Month.parse('2026-03'))).toBe('Mar 26');
    expect(formatMonthShort(Month.parse('2026-12'))).toBe('Dec 26');
  });
});
