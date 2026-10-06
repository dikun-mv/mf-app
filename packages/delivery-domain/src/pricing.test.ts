import { IsoDate, Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { expectTypeOf } from 'expect-type';
import {
  type CellState,
  type EmployeeMonth,
  blendedRate,
  cellCost,
  cellPricing,
  cellState,
  euroEditRate,
  hoursFromPersonMonths,
  percentFromPersonMonths,
  personMonthHours,
  personMonthsFromHours,
  personMonthsFromPercent,
  personMonthsFromValue,
  valueInUnit,
} from './pricing';
import type { RateInput } from './rates';
import { hours, percent, personMonths } from './units';

const rateFrom = (validFrom: string, hourlyCost: number): RateInput => ({
  validFrom: IsoDate.parse(validFrom),
  hourlyCost,
});
const month = (value: string) => Month.parse(value);
const employee = (
  monthValue: string,
  rates: RateInput[],
  weeklyHours: EmployeeMonth['weeklyHours'] = 40,
): EmployeeMonth => ({
  weeklyHours,
  month: month(monthValue),
  rates,
});

const fullHistory = [rateFrom('2025-01-01', 80), rateFrom('2026-03-12', 95)];
// emp-001 after the 2025-01-01 record is deleted: 12 Mar 2026 becomes the first rate (plan T8.1).
const partialHistory = [rateFrom('2026-03-12', 95)];

describe('person-month and capacity units', () => {
  it('varies by person and month: it is never a constant', () => {
    expect(personMonthHours(40, month('2026-03'))).toBe(176);
    expect(personMonthHours(32, month('2026-03'))).toBe(140.8);
    expect(personMonthHours(20, month('2026-03'))).toBe(88);
    expect(personMonthHours(40, month('2026-02'))).toBe(160);
  });

  it('converts PM, hours and % both ways', () => {
    const pm = personMonths(0.25);
    const asHours = hoursFromPersonMonths(pm, 32, month('2026-03'));
    expect(asHours).toBeCloseTo(35.2, 12);
    expect(personMonthsFromHours(asHours, 32, month('2026-03'))).toBeCloseTo(0.25, 12);
    expect(percentFromPersonMonths(pm)).toBe(25);
    expect(personMonthsFromPercent(percent(25))).toBe(0.25);
  });

  it('makes % of capacity additive for everyone: % = PM × 100', () => {
    for (const weeklyHours of [40, 32, 20] as const) {
      const context = employee('2026-05', fullHistory, weeklyHours);
      expect(valueInUnit('percent', personMonths(0.4), context, 1)).toBeCloseTo(40, 12);
    }
  });
});

describe('blendedRate', () => {
  it('weights each rate by its working days', () => {
    expect(blendedRate(month('2026-03'), fullHistory)).toBeCloseTo(1970 / 22, 12);
  });

  it('is defined for a month with one rate', () => {
    expect(blendedRate(month('2026-04'), fullHistory)).toBe(95);
  });

  it('averages over the priced days only in a partially priced month (D17)', () => {
    expect(blendedRate(month('2026-03'), partialHistory)).toBe(95);
  });

  it('is null when no working day is priced', () => {
    expect(blendedRate(month('2026-02'), partialHistory)).toBeNull();
    expect(blendedRate(month('2026-02'), [])).toBeNull();
  });
});

describe('cellCost', () => {
  it('splits a month at a rate change', () => {
    expect(cellCost(personMonths(0.5), employee('2026-03', fullHistory))).toBeCloseTo(7880, 9);
  });

  it('splits a month with two changes into three slices', () => {
    const rates = [rateFrom('2025-01-01', 80), rateFrom('2026-03-12', 95), rateFrom('2026-03-20', 120)];
    // 4 h/day over 8 days at 80, 6 days at 95 and 8 days at 120.
    expect(cellCost(personMonths(0.5), employee('2026-03', rates))).toBeCloseTo(4 * (8 * 80 + 6 * 95 + 8 * 120), 9);
  });

  it('costs 0 before the first rate', () => {
    expect(cellCost(personMonths(0.5), employee('2026-02', partialHistory))).toBe(0);
  });

  it('costs only the priced days in a partially priced month (D17)', () => {
    // 14 priced days × 4 h/day × €95 = €5,320.
    expect(cellCost(personMonths(0.5), employee('2026-03', partialHistory))).toBeCloseTo(5320, 9);
  });

  it('costs 0 for an empty cell', () => {
    expect(cellCost(personMonths(0), employee('2026-03', fullHistory))).toBe(0);
  });
});

describe('cell state', () => {
  it('is priced when every working day has a rate', () => {
    expect(cellPricing(month('2026-03'), fullHistory)).toEqual({ kind: 'priced' });
  });

  it('is partially priced when the first rate starts inside the month, and says how much (D17)', () => {
    expect(cellPricing(month('2026-03'), partialHistory)).toEqual({
      kind: 'partiallyPriced',
      workingDays: 22,
      unpricedWorkingDays: 8,
      firstRateFrom: '2026-03-12',
    });
  });

  it('is unpriced when the whole month is before the first rate, or there is no rate', () => {
    expect(cellPricing(month('2026-02'), partialHistory)).toEqual({ kind: 'unpriced' });
    expect(cellPricing(month('2026-02'), [])).toEqual({ kind: 'unpriced' });
  });

  it('ignores unpriced days that are not working days', () => {
    // 1 Mar 2026 is a Sunday, so a first rate on Monday 2 Mar leaves no working day unpriced.
    expect(cellPricing(month('2026-03'), [rateFrom('2026-03-02', 95)])).toEqual({ kind: 'priced' });
    // 30 May 2026 is a Saturday, so a first rate then leaves no working day priced.
    expect(cellPricing(month('2026-05'), [rateFrom('2026-05-30', 95)])).toEqual({ kind: 'unpriced' });
  });

  it('carries the over-capacity flag next to the pricing kind', () => {
    const state = cellState(month('2026-03'), partialHistory, true);
    expect(state).toMatchObject({ kind: 'partiallyPriced', overCapacity: true });
    expect(cellState(month('2026-03'), fullHistory, false)).toEqual({ kind: 'priced', overCapacity: false });
  });

  it('switches exhaustively over the kinds', () => {
    expectTypeOf<CellState['kind']>().toEqualTypeOf<'priced' | 'partiallyPriced' | 'unpriced'>();
  });
});

describe('units that were never added', () => {
  it('fail loudly instead of returning a wrong number', () => {
    const context = employee('2026-03', fullHistory);
    const unknown = 'fortnights' as never;
    expect(() => valueInUnit(unknown, personMonths(1), context, 1)).toThrow('Unhandled case');
    expect(() => personMonthsFromValue(unknown, 1, context, 1)).toThrow('Unhandled case');
  });
});

describe('euroEditRate (D17)', () => {
  it('is the blended rate in a fully priced month', () => {
    const result = euroEditRate(month('2026-03'), fullHistory);
    expect(result.ok && Math.abs(result.value - 1970 / 22) < 1e-9).toBe(true);
  });

  it('refuses an unpriced month', () => {
    expect(euroEditRate(month('2026-02'), partialHistory)).toEqual({ ok: false, error: 'unpriced' });
  });

  it('refuses a partially priced month', () => {
    expect(euroEditRate(month('2026-03'), partialHistory)).toEqual({ ok: false, error: 'partiallyPriced' });
  });
});

describe('personMonthsFromValue', () => {
  const context = employee('2026-03', fullHistory);

  it('reads hours, PM and % back to person-months', () => {
    expect(personMonthsFromValue('hours', 88, context, 1)).toEqual({ ok: true, value: 0.5 });
    expect(personMonthsFromValue('personMonths', 0.5, context, 1)).toEqual({ ok: true, value: 0.5 });
    expect(personMonthsFromValue('percent', 50, context, 1)).toEqual({ ok: true, value: 0.5 });
  });

  it('refuses a cost edit where no single rate applies', () => {
    expect(personMonthsFromValue('cost', 100, employee('2026-03', partialHistory), 1)).toEqual({
      ok: false,
      error: 'partiallyPriced',
    });
    expect(personMonthsFromValue('cost', 100, employee('2026-02', partialHistory), 1)).toEqual({
      ok: false,
      error: 'unpriced',
    });
  });

  it('still accepts hours, PM and % in those months', () => {
    expect(personMonthsFromValue('hours', 88, employee('2026-03', partialHistory), 1).ok).toBe(true);
    expect(personMonthsFromValue('percent', 50, employee('2026-02', partialHistory), 1).ok).toBe(true);
  });

  it('refuses a value that is not a finite number', () => {
    expect(personMonthsFromValue('hours', Number.NaN, context, 1)).toEqual({ ok: false, error: 'notANumber' });
    expect(personMonthsFromValue('cost', Infinity, context, 1)).toEqual({ ok: false, error: 'notANumber' });
  });

  it('keeps hours typed as branded values apart from person-months', () => {
    expectTypeOf(hours(1)).not.toEqualTypeOf(personMonths(1));
    // @ts-expect-error hours are not person-months
    const wrong: typeof personMonths extends (n: number) => infer R ? R : never = hours(1);
    expect(wrong).toBe(1);
  });
});
