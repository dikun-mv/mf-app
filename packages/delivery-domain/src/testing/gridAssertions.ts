import { expect } from '@rstest/core';
import { type GridNode, type GridTotals, mapRows, rollUp } from '../grid';
import { stepsOf } from '../rounding';
import type { DisplayUnit } from '../units';

// The guarantees a rounded grid must keep (brief §3.7, D19), shared by every test that rounds one.

/** One step, plus the millionth-of-a-step quantum `roundGrid` works in. */
export const ONE_STEP = 1 + 1e-5;

const sum = (values: readonly (number | undefined)[]): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

/** Every displayed sum equals the sum of what it is made of, in both directions. */
export function expectAddsUp(roots: readonly GridNode[], rounded: GridTotals): void {
  const visit = (node: GridNode): void => {
    const sums = rounded.nodes.get(node.id);
    expect(sums).toBeDefined();
    const members = [
      ...node.rows.map((row) => rounded.rows.get(row.key)),
      ...node.children.map((child) => rounded.nodes.get(child.id)),
    ];
    sums?.months.forEach((value, month) => {
      expect(value).toBe(sum(members.map((member) => member?.months[month])));
    });
    expect(sums?.total).toBe(sum(members.map((member) => member?.total)));
    expect(sums?.total).toBe(sum(sums?.months ?? []));
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  for (const sums of rounded.rows.values()) expect(sums.total).toBe(sum(sums.months));
  rounded.project.months.forEach((value, month) => {
    expect(value).toBe(sum(roots.map((root) => rounded.nodes.get(root.id)?.months[month])));
  });
  expect(rounded.project.total).toBe(sum(rounded.project.months));
}

/** Every displayed number, cell or sum, is within one step of its exact value. */
export function expectWithinOneStep(roots: readonly GridNode[], unit: DisplayUnit, rounded: GridTotals): void {
  const scale = stepsOf(unit);
  const exact = rollUp(
    mapRows(roots, (row) => row.cells.map((cell) => cell * scale)),
    rounded.project.months.length,
  );
  const near = (got: number | undefined, want: number): void => {
    expect(Math.abs((got ?? Number.NaN) - want)).toBeLessThanOrEqual(ONE_STEP);
  };
  for (const [id, sums] of exact.nodes) {
    sums.months.forEach((value, month) => {
      near(rounded.nodes.get(id)?.months[month], value);
    });
    near(rounded.nodes.get(id)?.total, sums.total);
  }
  for (const [key, sums] of exact.rows) {
    sums.months.forEach((value, month) => {
      near(rounded.rows.get(key)?.months[month], value);
    });
    near(rounded.rows.get(key)?.total, sums.total);
  }
  exact.project.months.forEach((value, month) => {
    near(rounded.project.months[month], value);
  });
  near(rounded.project.total, exact.project.total);
}
