import { describe, expect, it } from '@rstest/core';
import { largestRemainderSteps } from './rounding';
import { roundGrid } from './roundGrid';
import { expectAddsUp, expectWithinOneStep } from './testing/gridAssertions';
import { leaf, parent, row } from './testing/gridBuilders';

describe('roundGrid', () => {
  it('leaves values that are already on a step untouched (brief §3.6 example, Apr-Sep 26)', () => {
    const roots = [
      parent(
        '1',
        leaf('11', row('a', 0.8, 1.0, 1.15, 0.9, 0.6, 0.25)),
        leaf('12', row('b', 0.7, 0.95, 1.18, 0.8, 0.65, 0.4)),
        leaf('13', row('c', 0.6, 0.9, 0.72, 0.7, 0.5, 0.25)),
      ),
      parent('2', leaf('21', row('d', 0, 0.45, 1.6, 2.2, 2.05, 1.1))),
    ];
    const rounded = roundGrid(roots, 6, 'personMonths');
    expect(rounded.rows.get('b')?.months).toEqual([70, 95, 118, 80, 65, 40]);
    expect(rounded.rows.get('b')?.total).toBe(468);
    expect(rounded.nodes.get(roots[0]?.id ?? ('' as never))?.months).toEqual([210, 285, 305, 240, 175, 90]);
    expect(rounded.nodes.get(roots[0]?.id ?? ('' as never))?.total).toBe(1305);
    expect(rounded.project.total).toBe(1305 + 740);
    expectAddsUp(roots, rounded);
  });

  it('makes a single row equal largest-remainder rounding (T1.9)', () => {
    const cells = [0.1234, 0.5555, 0.3333, 0.0049, 0.7777, 0.2501];
    const rounded = roundGrid([leaf('1', row('r', ...cells))], cells.length, 'hours');
    expect(rounded.rows.get('r')?.months).toEqual(largestRemainderSteps(cells.map((c) => c * 100)));
  });

  it('rounds a total to nearest when every cell is below half a step', () => {
    // Exact total 1.2 steps: largest remainder gives 1, not the ceiling 2.
    const rounded = roundGrid([leaf('1', row('r', 0.004, 0.004, 0.004))], 3, 'personMonths');
    expect(rounded.rows.get('r')?.months).toEqual([1, 0, 0]);
  });

  it('keeps a parent within one step where top-down rounding drifts (D19)', () => {
    // Three people each have 0.4 steps in month 1 and 0.6 in month 2 (0.004 and 0.006 PM). Each row
    // Total is exactly 1 step, so top-down largest remainder puts the whole step in month 2 for all
    // three rows: the parent reads 0 and 3 for exact values 1.2 and 1.8.
    const roots = [leaf('1', row('a', 0.004, 0.006), row('b', 0.004, 0.006), row('c', 0.004, 0.006))];
    const rounded = roundGrid(roots, 2, 'personMonths');
    expect(rounded.nodes.get(roots[0]?.id ?? ('' as never))?.months).toEqual([1, 2]);
    expect(rounded.project.months).toEqual([1, 2]);
    expect(rounded.project.total).toBe(3);
    expectAddsUp(roots, rounded);
    expectWithinOneStep(roots, 'personMonths', rounded);
  });

  it('works to one decimal for percentages', () => {
    // Exact values are in the display unit: 33.33 % is 333.3 steps of 0.1 %.
    const roots = [leaf('1', row('r', 33.33, 33.33, 33.34))];
    const rounded = roundGrid(roots, 3, 'percent');
    expect(rounded.rows.get('r')?.months).toEqual([333, 333, 334]);
  });

  it('handles an empty grid and empty nodes', () => {
    expect(roundGrid([], 3, 'hours').project).toEqual({ months: [0, 0, 0], total: 0 });
    const roots = [parent('1', leaf('2'))];
    const rounded = roundGrid(roots, 2, 'hours');
    expect(rounded.nodes.get(roots[0]?.id ?? ('' as never))).toEqual({ months: [0, 0], total: 0 });
  });

  it('is deterministic', () => {
    const roots = [
      parent(
        '1',
        leaf('2', row('a', 0.004, 0.005, 0.0051), row('b', 0.0049, 0.005, 0.006)),
        leaf('3', row('c', 0.004, 0.004, 0.004)),
      ),
    ];
    expect(roundGrid(roots, 3, 'personMonths')).toEqual(roundGrid(roots, 3, 'personMonths'));
  });

  it('refuses a grid too large to round exactly rather than rounding it wrongly', () => {
    expect(() =>
      roundGrid([leaf('1', row('r', ...Array.from({ length: 100_000 }, () => 0.5)))], 100_000, 'hours'),
    ).toThrow('too large');
  });

  it('rejects a row with the wrong number of cells, and duplicate ids', () => {
    expect(() => roundGrid([leaf('1', row('r', 1, 2))], 3, 'hours')).toThrow(RangeError);
    expect(() => roundGrid([leaf('1', row('r', 1)), leaf('2', row('r', 1))], 1, 'hours')).toThrow(RangeError);
    expect(() => roundGrid([leaf('1'), leaf('1')], 1, 'hours')).toThrow(RangeError);
  });
});
