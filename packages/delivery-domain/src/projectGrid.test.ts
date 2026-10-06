import { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { formatUnit } from './format';
import { DISPLAY_UNITS } from './units';
import { buildGrid, projectMonths, rowKey } from './projectGrid';
import { rollUp } from './grid';
import { roundGrid } from './roundGrid';
import { expectAddsUp, expectWithinOneStep } from './testing/gridAssertions';
import { seedAllocations, seedItems, seedProjects } from './testing/seed';
import { seedGrid } from './testing/seedGrid';
import { AllocationId, BreakdownItemId } from '@baseline/delivery-contract';
import { Month } from '@baseline/host-contract';

const [prj1] = seedProjects;
if (prj1 === undefined) throw new Error('seed has no projects');

describe('projectMonths', () => {
  it('derives columns from the project span, so the reference month is visible', () => {
    const months = projectMonths(prj1);
    expect(months[0]).toBe('2026-03');
    expect(months.at(-1)).toBe('2027-02');
    expect(months).toHaveLength(12);
  });
});

describe('buildGrid', () => {
  it('lays a project out as nodes with person rows under the leaves', () => {
    const months = projectMonths(prj1);
    const roots = buildGrid(prj1, seedItems, seedAllocations, months, (a) => a.amount);
    expect(roots.map((root) => root.id)).toEqual(['wbs-001', 'wbs-002', 'wbs-003']);

    const key = rowKey(BreakdownItemId.parse('wbs-012'), EmployeeId.parse('emp-001'));
    const totals = rollUp(roots, months.length);
    expect(totals.rows.get(key)?.months[0]).toBe(0.5); // alloc-001, 2026-03
  });

  it('puts rows only under leaves, ordered by employee', () => {
    const roots = buildGrid(prj1, seedItems, seedAllocations, projectMonths(prj1), (a) => a.amount);
    const all: typeof roots = [];
    const walk = (nodes: typeof roots): void => {
      nodes.forEach((n) => {
        all.push(n);
        walk([...n.children]);
      });
    };
    walk(roots);
    for (const node of all) {
      expect(node.children.length > 0 && node.rows.length > 0).toBe(false);
      const keys = node.rows.map((r) => r.key);
      expect(keys).toEqual([...keys].sort());
    }
  });

  it('leaves out an allocation outside the project’s months, for checkInvariants to report', () => {
    const stray = seedAllocations.find((a) => a.breakdownItemId === 'wbs-012');
    if (stray === undefined) throw new Error('expected a seed allocation on wbs-012');
    const months = projectMonths(prj1);
    const outside = {
      ...stray,
      id: AllocationId.parse('alloc-999'),
      employeeId: EmployeeId.parse('emp-060'),
      month: Month.parse('2030-01'),
    };
    const roots = buildGrid(prj1, seedItems, [outside], months, (a) => a.amount);
    expect(rollUp(roots, months.length).project.total).toBe(0);
  });

  it('sums every seed allocation of the project exactly once', () => {
    const months = projectMonths(prj1);
    const roots = buildGrid(prj1, seedItems, seedAllocations, months, (a) => a.amount);
    const inProject = new Set(seedItems.filter((i) => i.projectId === prj1.id).map((i) => i.id));
    const expected = seedAllocations.filter((a) => inProject.has(a.breakdownItemId)).reduce((s, a) => s + a.amount, 0);
    expect(rollUp(roots, months.length).project.total).toBeCloseTo(expected, 9);
  });
});

describe('the reference cell on the grid (alloc-001: wbs-012 × emp-001 × 2026-03 × 0.5)', () => {
  const key = rowKey(BreakdownItemId.parse('wbs-012'), EmployeeId.parse('emp-001'));
  const expected = { hours: '88.00', personMonths: '0.50', percent: '50.0%', cost: '€7,880.00' } as const;

  for (const unit of DISPLAY_UNITS) {
    it(`shows ${expected[unit]} in ${unit}`, () => {
      const { roots, monthCount } = seedGrid(prj1, unit);
      const cell = roundGrid(roots, monthCount, unit).rows.get(key)?.months[0];
      expect(formatUnit(cell ?? Number.NaN, unit)).toBe(expected[unit]);
    });
  }
});

describe('roundGrid on the seed (brief §3.7, D19)', () => {
  for (const project of seedProjects) {
    for (const unit of DISPLAY_UNITS) {
      it(`${project.id} in ${unit}: adds up both ways and stays within one step`, () => {
        const { roots, monthCount } = seedGrid(project, unit, 1.08);
        const rounded = roundGrid(roots, monthCount, unit);
        expectAddsUp(roots, rounded);
        expectWithinOneStep(roots, unit, rounded);
      });
    }
  }

  it('does so after ±10% edits to every cell, for 20 random edits of every project and unit (the D19 stress test)', () => {
    let state = 12345;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296; // A small deterministic generator.
      return state / 4294967296;
    };
    for (let run = 0; run < 20; run += 1) {
      const factors = new Map(seedAllocations.map((a) => [a.id, 0.9 + random() * 0.2]));
      for (const project of seedProjects) {
        for (const unit of DISPLAY_UNITS) {
          const { roots, monthCount } = seedGrid(project, unit, 1.08, (a) => factors.get(a.id) ?? 1);
          const rounded = roundGrid(roots, monthCount, unit);
          expectAddsUp(roots, rounded);
          expectWithinOneStep(roots, unit, rounded);
        }
      }
    }
  });

  it('rounds the largest project quickly enough to recompute on every edit', () => {
    const grids = seedProjects.map((project) => seedGrid(project, 'cost', 1.08));
    const start = performance.now();
    for (const { roots, monthCount } of grids) roundGrid(roots, monthCount, 'cost');
    const perGrid = (performance.now() - start) / grids.length;
    expect(perGrid).toBeLessThan(250);
  });
});
