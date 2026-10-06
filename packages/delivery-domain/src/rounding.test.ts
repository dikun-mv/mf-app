import { describe, expect, it } from '@rstest/core';
import { formatRate, formatUnit } from './format';
import { CurrencyCode } from '@baseline/host-contract';
import { largestRemainder, largestRemainderSteps, roundSteps, roundValue, splitSteps, stepsOf } from './rounding';

describe('splitSteps', () => {
  it('splits into whole steps and a remainder in millionths', () => {
    expect(splitSteps(12.25)).toEqual({ whole: 12, remainder: 250_000 });
  });

  it('snaps float noise, so a typed 0.33 stays 0.33 (T1.8)', () => {
    expect(0.29 * 100).not.toBe(29); // 28.999999999999996
    expect(0.07 * 100).not.toBe(7); // 7.000000000000001
    expect(splitSteps(0.29 * 100)).toEqual({ whole: 29, remainder: 0 });
    expect(splitSteps(0.07 * 100)).toEqual({ whole: 7, remainder: 0 });
  });

  it('carries a remainder that rounds up to a whole step', () => {
    expect(splitSteps(5 - 4e-7)).toEqual({ whole: 5, remainder: 0 });
    expect(splitSteps(5 - 2e-6)).toEqual({ whole: 4, remainder: 999_998 });
  });
});

describe('roundSteps and roundValue', () => {
  it('rounds half up', () => {
    expect(roundSteps(2.5)).toBe(3);
    expect(roundSteps(2.4999)).toBe(2);
    expect(roundSteps(0.49999)).toBe(0);
  });

  it('rounds a single value to its unit', () => {
    expect(roundValue(0.3333, 'personMonths')).toBe(33);
    expect(roundValue(12.345, 'percent')).toBe(123);
    expect(roundValue(89.54545, 'cost')).toBe(8955);
    expect(stepsOf('hours')).toBe(100);
    expect(stepsOf('percent')).toBe(10);
  });
});

describe('largestRemainder', () => {
  it('adds up to the rounded total exactly', () => {
    const rounded = largestRemainder([0.333, 0.333, 0.334], 2);
    expect(rounded).toEqual([0.33, 0.33, 0.34]);
  });

  it('gives the owed steps to the largest remainders', () => {
    // 1.6 + 1.6 + 1.6 + 0.2 = 5.0: floors sum to 3, two steps are owed.
    expect(largestRemainderSteps([1.6, 1.6, 1.6, 0.2])).toEqual([2, 2, 1, 0]);
  });

  it('lets the earlier cell win a tie', () => {
    expect(largestRemainder([1 / 3, 1 / 3, 1 / 3], 2)).toEqual([0.34, 0.33, 0.33]);
    expect(largestRemainderSteps([0.5, 0.5])).toEqual([1, 0]);
  });

  it('keeps exact values untouched', () => {
    expect(largestRemainder([0.1, 0.2, 0.7], 2)).toEqual([0.1, 0.2, 0.7]);
  });

  it('rounds the total to the nearest step, half up', () => {
    // 0.004 × 3 = 0.012 → 1.2 steps → total 1; 0.005 × 3 = 0.015 → 1.5 steps → total 2.
    expect(largestRemainderSteps([0.4, 0.4, 0.4])).toEqual([1, 0, 0]);
    expect(largestRemainderSteps([0.5, 0.5, 0.5])).toEqual([1, 1, 0]);
  });

  it('works to one decimal for percentages', () => {
    expect(largestRemainder([33.33, 33.33, 33.34], 1)).toEqual([33.3, 33.3, 33.4]);
  });

  it('takes an explicit total in display units', () => {
    expect(largestRemainder([0.004, 0.004, 0.004], 2, 0.02)).toEqual([0.01, 0.01, 0]);
  });

  it('honours an explicit target and refuses an unreachable one', () => {
    expect(largestRemainderSteps([0.4, 0.4, 0.4], 2)).toEqual([1, 1, 0]);
    expect(() => largestRemainderSteps([0.4, 0.4, 0.4], 4)).toThrow(RangeError);
    expect(() => largestRemainderSteps([1, 1], 0)).toThrow(RangeError);
  });

  it('handles no values', () => {
    expect(largestRemainderSteps([])).toEqual([]);
  });
});

describe('formatUnit', () => {
  it('formats whole steps at each unit precision', () => {
    expect(formatUnit(8800, 'hours')).toBe('88.00');
    expect(formatUnit(123456, 'hours')).toBe('1,234.56');
    expect(formatUnit(33, 'personMonths')).toBe('0.33');
    expect(formatUnit(500, 'percent')).toBe('50.0%');
    expect(formatUnit(1005, 'percent')).toBe('100.5%');
    expect(formatUnit(788000, 'cost')).toBe('€7,880.00');
    expect(formatUnit(0, 'cost')).toBe('€0.00');
  });

  it('formats a cost in the display currency', () => {
    expect(formatUnit(1576000, 'cost', CurrencyCode.parse('USD'))).toBe('$15,760.00');
  });

  it('refuses a unit that was never added', () => {
    expect(() => formatUnit(1, 'fortnights' as never)).toThrow('Unhandled case');
  });

  it('refuses a value that was never rounded', () => {
    expect(() => formatUnit(33.5, 'personMonths')).toThrow(RangeError);
  });

  it('formats a rate at 4 decimal places', () => {
    expect(formatRate(1970 / 22)).toBe('€89.5455/h');
    expect(formatRate(95, CurrencyCode.parse('GBP'))).toBe('£95.0000/h');
  });
});
