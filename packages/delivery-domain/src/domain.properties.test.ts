import { IsoDateTime } from '@baseline/host-contract';
import { describe, expect, it } from '@rstest/core';
import fc from 'fast-check';
import { firstDayAfter, firstDayOf, workingDaysIn } from './calendar';
import { causingAllocation, compareByLastEdit, isOverCapacity, loadsOf } from './capacity';
import {
  blendedRate,
  cellCost,
  cellPricing,
  euroEditRate,
  hoursFromPersonMonths,
  personMonthsFromValue,
  valueInUnit,
} from './pricing';
import { largestRemainderSteps } from './rounding';
import { sliceMonth } from './rates';
import { allocation } from './testing/stateBuilders';
import { fullyPricedHistory, month, personMonthsAmount, pricingScenario, weeklyHours } from './testing/arbitraries';
import { DISPLAY_UNITS, personMonths } from './units';

// T1.14. `FC_RUNS=5000 pnpm test` runs these much harder than the default.
const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 300) };

const isWeekday = (day: Date) => day.getUTCDay() !== 0 && day.getUTCDay() !== 6;

/** Every day of a month, counted the slow way, without the domain's calendar. */
function daysOf(monthValue: string): Date[] {
  const [year, monthNumber] = monthValue.split('-').map(Number);
  const days: Date[] = [];
  for (
    let date = new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1, 1));
    date.getUTCMonth() === (monthNumber ?? 1) - 1;
    date = new Date(date.getTime() + 86_400_000)
  ) {
    days.push(date);
  }
  return days;
}

/** The pricing rule applied day by day: the independent oracle for `cellCost`. */
function costByTheDay(
  pm: number,
  weekly: 40 | 32 | 20,
  monthValue: string,
  rates: readonly { validFrom: string; hourlyCost: number }[],
): { cost: number; pricedDays: number; days: number } {
  const workingDays = daysOf(monthValue).filter(isWeekday);
  const hoursPerDay = (pm * weekly * workingDays.length) / 5 / workingDays.length;
  let cost = 0;
  let pricedDays = 0;
  for (const day of workingDays) {
    const iso = day.toISOString().slice(0, 10);
    const effective = rates
      .filter((r) => r.validFrom <= iso)
      .sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))
      .at(-1);
    if (effective !== undefined) {
      cost += hoursPerDay * effective.hourlyCost;
      pricedDays += 1;
    }
  }
  return { cost, pricedDays, days: workingDays.length };
}

describe('calendar and slices', () => {
  it('counts working days as the day-by-day oracle does', () => {
    fc.assert(
      fc.property(month, (m) => {
        expect(workingDaysIn(m)).toBe(daysOf(m).filter(isWeekday).length);
      }),
      RUNS,
    );
  });

  it('has slices whose working days sum to the month’s working days, covering it without gaps', () => {
    fc.assert(
      fc.property(pricingScenario, ({ month: m, rates }) => {
        const slices = sliceMonth(m, rates);
        expect(slices.reduce((sum, slice) => sum + slice.workingDays, 0)).toBe(workingDaysIn(m));
        expect(slices[0]?.from).toBe(firstDayOf(m));
        expect(slices.at(-1)?.toExclusive).toBe(firstDayAfter(m));
        slices.slice(1).forEach((slice, index) => {
          expect(slice.from).toBe(slices[index]?.toExclusive);
        });
        const inside = rates.filter((r) => r.validFrom > firstDayOf(m) && r.validFrom < firstDayAfter(m)).length;
        expect(slices).toHaveLength(inside + 1);
      }),
      RUNS,
    );
  });
});

describe('cost', () => {
  it('equals the day-by-day oracle in every month, priced or not', () => {
    fc.assert(
      fc.property(pricingScenario, weeklyHours, personMonthsAmount, ({ month: m, rates }, weekly, pm) => {
        const expected = costByTheDay(pm, weekly, m, rates).cost;
        const got = cellCost(personMonths(pm), { weeklyHours: weekly, month: m, rates });
        expect(Math.abs(got - expected)).toBeLessThanOrEqual(1e-7 * Math.max(1, expected));
      }),
      RUNS,
    );
  });

  it('is hours × blended rate when every working day is priced', () => {
    fc.assert(
      fc.property(month, fullyPricedHistory, weeklyHours, personMonthsAmount, (m, rates, weekly, pm) => {
        expect(cellPricing(m, rates)).toEqual({ kind: 'priced' });
        const hours = hoursFromPersonMonths(personMonths(pm), weekly, m);
        const blended = blendedRate(m, rates) ?? Number.NaN;
        const cost = cellCost(personMonths(pm), { weeklyHours: weekly, month: m, rates });
        expect(Math.abs(cost - hours * blended)).toBeLessThanOrEqual(1e-7 * Math.max(1, cost));
      }),
      RUNS,
    );
  });

  it('is the cost of the priced slices alone in a partially priced month, and refuses € edits there (D17)', () => {
    fc.assert(
      fc.property(pricingScenario, weeklyHours, personMonthsAmount, ({ month: m, rates }, weekly, pm) => {
        const pricing = cellPricing(m, rates);
        const oracle = costByTheDay(pm, weekly, m, rates);
        const cost = cellCost(personMonths(pm), { weeklyHours: weekly, month: m, rates });
        expect(Math.abs(cost - oracle.cost)).toBeLessThanOrEqual(1e-7 * Math.max(1, oracle.cost));

        // What the oracle says the state must be, decided before anything is asserted.
        const expected =
          oracle.pricedDays === 0
            ? { pricing: { kind: 'unpriced' }, refusal: 'unpriced' }
            : oracle.pricedDays < oracle.days
              ? {
                  pricing: {
                    kind: 'partiallyPriced',
                    workingDays: oracle.days,
                    unpricedWorkingDays: oracle.days - oracle.pricedDays,
                  },
                  refusal: 'partiallyPriced',
                }
              : { pricing: { kind: 'priced' }, refusal: null };
        const edit = euroEditRate(m, rates);
        expect({ pricing, refusal: edit.ok ? null : edit.error }).toMatchObject(expected);
        expect(oracle.pricedDays === 0 ? cost : 0).toBe(0);
      }),
      RUNS,
    );
  });
});

describe('units', () => {
  it('round-trips through every unit without changing the stored person-months', () => {
    fc.assert(
      fc.property(
        pricingScenario,
        weeklyHours,
        personMonthsAmount,
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        ({ month: m, rates }, weekly, pm, perEur) => {
          const context = { weeklyHours: weekly, month: m, rates };
          const problems = DISPLAY_UNITS.flatMap((unit) => {
            const shown = valueInUnit(unit, personMonths(pm), context, perEur);
            const back = personMonthsFromValue(unit, shown, context, perEur);
            if (back.ok) {
              return Math.abs(back.value - pm) <= 1e-9 * Math.max(1, pm)
                ? []
                : [`${unit} drifted to ${String(back.value)}`];
            }
            // Only a € edit can be refused, and only where no single rate applies.
            return unit === 'cost' && cellPricing(m, rates).kind !== 'priced'
              ? []
              : [`${unit} was refused: ${back.error}`];
          });
          expect(problems).toEqual([]);
        },
      ),
      RUNS,
    );
  });

  it('has % of capacity additive across people and months: % = PM × 100', () => {
    fc.assert(
      fc.property(personMonthsAmount, personMonthsAmount, month, weeklyHours, (a, b, m, weekly) => {
        const context = { weeklyHours: weekly, month: m, rates: [] };
        const total = valueInUnit('percent', personMonths(a + b), context, 1);
        const parts =
          valueInUnit('percent', personMonths(a), context, 1) + valueInUnit('percent', personMonths(b), context, 1);
        expect(Math.abs(total - parts)).toBeLessThanOrEqual(1e-9 * Math.max(1, total));
      }),
      RUNS,
    );
  });
});

describe('largest remainder', () => {
  it('always sums to the rounded total, moving each value by less than one step', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }), { maxLength: 24 }),
        (values) => {
          const rounded = largestRemainderSteps(values);
          const exactTotal = values.reduce((sum, value) => sum + value, 0);
          expect(rounded.reduce((sum, value) => sum + value, 0)).toBe(Math.round(exactTotal + 1e-9));
          rounded.forEach((count, index) => {
            expect(Number.isInteger(count)).toBe(true);
            expect(Math.abs(count - (values[index] ?? 0))).toBeLessThan(1 + 1e-5);
          });
        },
      ),
      RUNS,
    );
  });
});

describe('capacity', () => {
  const contribution = fc.record({
    amount: fc.constantFrom(0, 0.1, 0.25, 0.5, 0.75, 1),
    editedAt: fc.constantFrom('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.001Z', '2026-06-01T00:00:00.000Z'),
  });

  it('names a causer that contributes and that no contributor outranks (D18)', () => {
    fc.assert(
      fc.property(fc.array(contribution, { minLength: 1, maxLength: 8 }), (contributions) => {
        const allocations = contributions.map((c, index) =>
          allocation(
            `alloc-${String(index + 1).padStart(3, '0')}`,
            'wbs-1',
            'emp-001',
            '2026-03',
            c.amount,
            IsoDateTime.parse(c.editedAt),
          ),
        );
        const causer = causingAllocation(allocations);
        const contributors = allocations.filter((a) => a.amount > 0);
        // No contributor, no causer; otherwise the causer is one of them and none outranks it.
        expect(causer === null).toBe(contributors.length === 0);
        expect(causer === null || contributors.includes(causer)).toBe(true);
        expect(contributors.every((other) => causer === null || compareByLastEdit(other, causer) <= 0)).toBe(true);
      }),
      RUNS,
    );
  });

  it('flags a person-month over capacity exactly when its total is above 1, and names a causer only then', () => {
    fc.assert(
      fc.property(fc.array(contribution, { minLength: 1, maxLength: 8 }), (contributions) => {
        const allocations = contributions.map((c, index) =>
          allocation(
            `alloc-${String(index + 1).padStart(3, '0')}`,
            `wbs-${String((index % 3) + 1)}`,
            'emp-001',
            '2026-03',
            c.amount,
            IsoDateTime.parse(c.editedAt),
          ),
        );
        const total = allocations.reduce((sum, a) => sum + a.amount, 0);
        const [load] = loadsOf(allocations);
        const causerId = load?.causingAllocationId ?? null;
        expect(load === undefined).toBe(total === 0);
        expect(load?.overCapacity ?? false).toBe(isOverCapacity(total));
        expect(causerId !== null).toBe(isOverCapacity(total));
        expect(causerId === null || allocations.some((a) => a.id === causerId)).toBe(true);
      }),
      RUNS,
    );
  });
});
