import fc from 'fast-check';
import { describe, expect, it } from '@rstest/core';
import type { GridNode } from './grid';
import { largestRemainderSteps, stepsOf } from './rounding';
import { roundGrid } from './roundGrid';
import { displayUnit, gridArbitrary } from './testing/arbitraries';
import { ONE_STEP, expectAddsUp, expectWithinOneStep } from './testing/gridAssertions';

// T1.14: the guarantees of controlled rounding (D19) hold for random trees and values.

// `FC_RUNS=5000 pnpm test` runs the properties much harder than the default.
const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 400) };

describe('roundGrid properties', () => {
  it('keeps every displayed number within one step of its exact value', () => {
    fc.assert(
      fc.property(gridArbitrary(), displayUnit, ({ roots, monthCount }, unit) => {
        expectWithinOneStep(roots, unit, roundGrid(roots, monthCount, unit));
      }),
      RUNS,
    );
  });

  it('adds up in both directions: row Total = Σ month cells, parent cell = Σ displayed children', () => {
    fc.assert(
      fc.property(gridArbitrary(), displayUnit, ({ roots, monthCount }, unit) => {
        expectAddsUp(roots, roundGrid(roots, monthCount, unit));
      }),
      RUNS,
    );
  });

  it('rounds every cell down or up to a whole step, never further', () => {
    fc.assert(
      fc.property(gridArbitrary(), displayUnit, ({ roots, monthCount }, unit) => {
        const rounded = roundGrid(roots, monthCount, unit);
        const scale = stepsOf(unit);
        const visit = (node: GridNode): void => {
          for (const row of node.rows) {
            row.cells.forEach((cell, month) => {
              const got = rounded.rows.get(row.key)?.months[month] ?? Number.NaN;
              expect(Number.isInteger(got)).toBe(true);
              expect(Math.abs(got - cell * scale)).toBeLessThan(ONE_STEP);
            });
          }
          node.children.forEach(visit);
        };
        roots.forEach(visit);
      }),
      RUNS,
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(gridArbitrary(), displayUnit, ({ roots, monthCount }, unit) => {
        expect(roundGrid(roots, monthCount, unit)).toEqual(roundGrid(roots, monthCount, unit));
      }),
      RUNS,
    );
  });

  it('equals largest-remainder rounding on a single row', () => {
    fc.assert(
      fc.property(
        gridArbitrary({ maxNodes: 1 }).filter(({ roots }) => roots[0]?.rows.length === 1),
        displayUnit,
        ({ roots, monthCount }, unit) => {
          const only = roots[0]?.rows[0];
          if (only === undefined) return;
          const rounded = roundGrid(roots, monthCount, unit);
          expect(rounded.rows.get(only.key)?.months).toEqual(
            largestRemainderSteps(only.cells.map((cell) => cell * stepsOf(unit))),
          );
        },
      ),
      RUNS,
    );
  });
});
