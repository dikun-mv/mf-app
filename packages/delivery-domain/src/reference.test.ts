import { IsoDate, Month } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import { workingDaysBetween, workingDaysIn } from './calendar';
import { formatRate, formatUnit } from './format';
import {
  type EmployeeMonth,
  blendedRate,
  cellCost,
  euroEditRate,
  hoursFromPersonMonths,
  percentFromPersonMonths,
  personMonthHours,
  personMonthsFromValue,
  valueInUnit,
} from './pricing';
import { roundValue } from './rounding';
import { seedEmployee, seedRatesOf } from './testing/seed';
import { DISPLAY_UNITS, hours, money, personMonths } from './units';

// Brief §3.4, the reference calculation and the gate for everything else: A. Okafor, 40 h/week,
// €80.00/h from 2025-01-01 and €95.00/h from 2026-03-12, 0.50 person-months in March 2026.

const march = Month.parse('2026-03');
const okafor: EmployeeMonth = {
  weeklyHours: 40,
  month: march,
  rates: [
    { validFrom: IsoDate.parse('2025-01-01'), hourlyCost: 80 },
    { validFrom: IsoDate.parse('2026-03-12'), hourlyCost: 95 },
  ],
};
const stored = personMonths(0.5);

/** What the grid shows for one value: rounded to whole steps, then formatted. */
const shown = (value: number, unit: (typeof DISPLAY_UNITS)[number]) => formatUnit(roundValue(value, unit), unit);

describe('reference calculation (brief §3.4)', () => {
  it('has 22 working days in March 2026: 8 before the 12th and 14 from it', () => {
    expect(workingDaysIn(march)).toBe(22);
    expect(workingDaysBetween(IsoDate.parse('2026-03-01'), IsoDate.parse('2026-03-12'))).toBe(8);
    expect(workingDaysBetween(IsoDate.parse('2026-03-12'), IsoDate.parse('2026-04-01'))).toBe(14);
  });

  it('has 176.00 h in one person-month', () => {
    expect(personMonthHours(40, march)).toBe(176);
    expect(formatUnit(roundValue(personMonthHours(40, march), 'hours'), 'hours')).toBe('176.00');
  });

  it('turns 0.50 PM into 88.00 h, or 4.00 h per working day', () => {
    const effort = hoursFromPersonMonths(stored, 40, march);
    expect(effort).toBe(88);
    expect(shown(effort, 'hours')).toBe('88.00');
    expect(shown(effort / workingDaysIn(march), 'hours')).toBe('4.00');
  });

  it('costs €7,880.00: 8 × 4 × 80 + 14 × 4 × 95 = 2,560 + 5,320', () => {
    expect(cellCost(stored, okafor)).toBeCloseTo(7880, 9);
    expect(shown(cellCost(stored, okafor), 'cost')).toBe('€7,880.00');
  });

  it('is 50.0% of capacity', () => {
    expect(percentFromPersonMonths(stored)).toBe(50);
    expect(shown(percentFromPersonMonths(stored), 'percent')).toBe('50.0%');
  });

  it('has an implied blended rate of €89.5455/h', () => {
    const blended = blendedRate(march, okafor.rates);
    expect(blended).toBeCloseTo(1970 / 22, 9);
    expect(formatRate(blended ?? 0)).toBe('€89.5455/h');
    // The implied rate is cost ÷ hours.
    expect(cellCost(stored, okafor) / hoursFromPersonMonths(stored, 40, march)).toBeCloseTo(blended ?? 0, 9);
  });

  it('shows 0.50 person-months', () => {
    expect(shown(stored, 'personMonths')).toBe('0.50');
  });

  it('round-trips a € edit of 7,880 back to 0.5 PM within 1e-9', () => {
    const edited = personMonthsFromValue('cost', 7880, okafor, 1);
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(Math.abs(edited.value - 0.5)).toBeLessThan(1e-9);
    expect(shown(edited.value, 'personMonths')).toBe('0.50');
  });

  it('reads the same inputs from the seed fixture (alloc-001 is wbs-012 × emp-001 × 2026-03 × 0.5)', () => {
    const fromSeed: EmployeeMonth = {
      weeklyHours: seedEmployee('emp-001').weeklyHours,
      month: march,
      rates: seedRatesOf('emp-001'),
    };
    expect(cellCost(stored, fromSeed)).toBeCloseTo(7880, 9);
    const edit = euroEditRate(march, fromSeed.rates);
    expect(edit.ok ? edit.value : Number.NaN).toBeCloseTo(1970 / 22, 9);
  });

  it('converts a € edit in another display currency through the shell rate (D11)', () => {
    // At 2 USD per EUR the same cell costs 15,760 USD, and typing that stores 0.5 PM again.
    expect(valueInUnit('cost', stored, okafor, 2)).toBeCloseTo(15760, 9);
    const edited = personMonthsFromValue('cost', 15760, okafor, 2);
    expect(edited.ok && Math.abs(edited.value - 0.5) < 1e-9).toBe(true);
  });

  it('gives all four units from the one stored value, and back', () => {
    const expected = { hours: 88, personMonths: 0.5, percent: 50, cost: 7880 } as const;
    for (const unit of DISPLAY_UNITS) {
      const value = valueInUnit(unit, stored, okafor, 1);
      expect(value).toBeCloseTo(expected[unit], 9);
      const back = personMonthsFromValue(unit, value, okafor, 1);
      expect(back.ok && Math.abs(back.value - stored) < 1e-9).toBe(true);
    }
    // Branded wrappers for the compiler's sake: hours and money are not interchangeable.
    expect(hours(88)).toBe(88);
    expect(money(7880)).toBe(7880);
  });
});
