import { BreakdownItemId } from '@baseline/delivery-contract';
import { IsoDate, Month } from '@baseline/host-contract';
import { WEEKLY_HOURS } from '@baseline/people-contract';
import fc from 'fast-check';
import type { GridNode, GridRow } from '../grid';
import { DISPLAY_UNITS } from '../units';

// fast-check generators for the domain property tests (T1.14).

export const displayUnit = fc.constantFrom(...DISPLAY_UNITS);

/**
 * Exact cell values in a display unit. Mixes values already on a step, values exactly half a step
 * over, and arbitrary reals, since each exercises a different rounding path.
 */
export const cellValue = fc.oneof(
  fc.integer({ min: 0, max: 300 }).map((steps) => steps / 100),
  fc.integer({ min: 0, max: 300 }).map((steps) => (steps + 0.5) / 100),
  fc.double({ min: 0, max: 3, noNaN: true, noDefaultInfinity: true }),
  fc.constant(0),
);

interface GridSpec {
  readonly roots: GridNode[];
  readonly monthCount: number;
}

/** Random trees up to three levels deep with person rows under the leaves. */
export function gridArbitrary(
  options: { maxNodes?: number; maxMonths?: number; value?: fc.Arbitrary<number> } = {},
): fc.Arbitrary<GridSpec> {
  const { maxNodes = 7, maxMonths = 6, value = cellValue } = options;
  return fc
    .record({
      monthCount: fc.integer({ min: 1, max: maxMonths }),
      parents: fc.array(fc.option(fc.nat({ max: 1000 }), { nil: null }), { minLength: 1, maxLength: maxNodes }),
      rowsPerLeaf: fc.array(fc.integer({ min: 0, max: 3 }), { minLength: maxNodes, maxLength: maxNodes }),
      seed: fc.array(value, { minLength: 1, maxLength: 64 }),
    })
    .map(({ monthCount, parents, rowsPerLeaf, seed }) => {
      // Node i's parent is an earlier node, or none; a node under a level-3 node becomes a root.
      const parentOf: (number | null)[] = [];
      const depth: number[] = [];
      parents.forEach((pick, index) => {
        const candidate = pick === null || index === 0 ? null : pick % index;
        if (candidate === null || (depth[candidate] ?? 1) >= 3) {
          parentOf.push(null);
          depth.push(1);
        } else {
          parentOf.push(candidate);
          depth.push((depth[candidate] ?? 1) + 1);
        }
      });

      let cursor = 0;
      const nextValue = (): number => {
        const picked = seed[cursor % seed.length] ?? 0;
        cursor += 1;
        return picked;
      };

      const hasChildren = parentOf.map((_, index) => parentOf.includes(index));
      const build = (index: number): GridNode => {
        const id = BreakdownItemId.parse(`wbs-${String(index + 1)}`);
        const children = parentOf.flatMap((parent, child) => (parent === index ? [build(child)] : []));
        const rows: GridRow[] = hasChildren[index]
          ? []
          : Array.from({ length: rowsPerLeaf[index] ?? 0 }, (_, person) => ({
              key: `${id}/emp-${String(person + 1)}`,
              cells: Array.from({ length: monthCount }, nextValue),
            }));
        return { id, children, rows };
      };
      const roots = parentOf.flatMap((parent, index) => (parent === null ? [build(index)] : []));
      return { roots, monthCount };
    });
}

// ---- Pricing inputs ----

const DAY = 86_400_000;
const FIRST_DAY = Date.UTC(2024, 0, 1);

/** A day in 2024-2027 as `YYYY-MM-DD`, built without the domain's own calendar. */
export const isoDate = fc
  .integer({ min: 0, max: 4 * 365 })
  .map((offset) => IsoDate.parse(new Date(FIRST_DAY + offset * DAY).toISOString().slice(0, 10)));

/** A month in 2025-2027. */
export const month = fc
  .integer({ min: 0, max: 35 })
  .map((offset) => Month.parse(new Date(Date.UTC(2025, offset, 1)).toISOString().slice(0, 7)));

export const weeklyHours = fc.constantFrom(...WEEKLY_HOURS);

/** A rate history of 0 to 4 records with distinct `validFrom`, in any order. */
export const rateHistory = fc
  .uniqueArray(isoDate, { minLength: 0, maxLength: 4 })
  .chain((dates) =>
    fc.tuple(
      ...dates.map((validFrom) =>
        fc.integer({ min: 1000, max: 30000 }).map((cents) => ({ validFrom, hourlyCost: cents / 100 })),
      ),
    ),
  );

/**
 * A month with a rate history placed around it: dates from 60 days before to 40 days after its
 * first day, so rate changes inside the month, partially priced months and unpriced months are all
 * common. A history drawn independently of the month would almost never start inside it.
 */
export const pricingScenario = month.chain((m) => {
  const start = Date.parse(`${m}-01T00:00:00Z`);
  return fc.uniqueArray(fc.integer({ min: -60, max: 40 }), { minLength: 0, maxLength: 4 }).chain((offsets) =>
    fc
      .tuple(
        ...offsets.map((offset) =>
          fc.integer({ min: 1000, max: 30000 }).map((cents) => ({
            validFrom: IsoDate.parse(new Date(start + offset * DAY).toISOString().slice(0, 10)),
            hourlyCost: cents / 100,
          })),
        ),
      )
      .map((rates) => ({ month: m, rates })),
  );
});

/** A history whose first rate predates every month above, so every month is fully priced. */
export const fullyPricedHistory = rateHistory.map((rates) => [
  { validFrom: IsoDate.parse('2024-01-01'), hourlyCost: 80 },
  ...rates.filter((r) => r.validFrom > '2024-01-01'),
]);

export const personMonthsAmount = fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true });
