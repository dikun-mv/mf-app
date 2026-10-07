import { BreakdownItemId, ProjectId } from '@baseline/delivery-contract';
import { gridView, type PlanState } from '@baseline/delivery-domain';
import { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { allocation, item, project, testContext } from '../../../shared/testing';
import { NO_ASSIGNMENTS, withPendingRows, withoutPlaceholders } from './pendingRows';

const PROJECT = ProjectId.parse('prj-1');
const LEAF = BreakdownItemId.parse('wbs-2');
const NEW_PERSON = EmployeeId.parse('emp-009');
const { currency } = testContext();

// Ledger migration › Data checks, a leaf where emp-001 has 0.50 PM in March.
const plan: PlanState = {
  projects: [project('prj-1', 'Ledger Consolidation')],
  items: [item('wbs-1', 'prj-1', null, 'Ledger migration'), item('wbs-2', 'prj-1', 'wbs-1', 'Data checks')],
  allocations: [allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5)],
};

const projectTotal = (state: PlanState): string | undefined => {
  const view = gridView(state, null, PROJECT, 'personMonths', currency);
  return view.ok ? view.value.rows[0]?.total.text : undefined;
};

const personRows = (state: PlanState, assigned: Parameters<typeof withPendingRows>[1]) => {
  const { plan: shown, pendingKeys } = withPendingRows(state, assigned);
  const view = withoutPlaceholders(gridView(shown, null, PROJECT, 'personMonths', currency), pendingKeys);
  if (!view.ok) throw new Error('No grid');
  return view.value.rows.flatMap((row) => (row.kind === 'person' ? [row] : []));
};

describe('withPendingRows', () => {
  it('changes nothing without assignments', () => {
    const { plan: shown, pendingKeys } = withPendingRows(plan, NO_ASSIGNMENTS);
    expect(shown).toBe(plan);
    expect(pendingKeys.size).toBe(0);
  });

  it('draws a row of empty cells for an assigned person, with the sums unchanged', () => {
    const rows = personRows(plan, [{ itemId: LEAF, employeeId: NEW_PERSON }]);
    const added = rows.find((row) => row.employeeId === NEW_PERSON);
    expect(rows.map((row) => row.employeeId)).toEqual(['emp-001', 'emp-009']);
    // No allocation behind any cell, so each reads as empty and a value typed in creates the first one.
    expect(added?.cells.every((cell) => cell.allocationId === null && cell.markers.length === 0)).toBe(true);
    expect(added?.total.text).toBe('0.00');

    // The project row's total is the same with and without the placeholder.
    expect(projectTotal(withPendingRows(plan, [{ itemId: LEAF, employeeId: NEW_PERSON }]).plan)).toBe(
      projectTotal(plan),
    );
  });

  it('adds no row for someone who already has allocations on the leaf', () => {
    const rows = personRows(plan, [{ itemId: LEAF, employeeId: EmployeeId.parse('emp-001') }]);
    expect(rows.map((row) => row.employeeId)).toEqual(['emp-001']);
    expect(rows[0]?.cells.at(0)?.allocationId).toBe('alloc-1');
  });

  it('draws a person assigned twice once', () => {
    const twice = { itemId: LEAF, employeeId: NEW_PERSON };
    expect(personRows(plan, [twice, twice])).toHaveLength(2);
  });

  it('skips an item that has gone or has since gained a child (D9)', () => {
    const gone = { itemId: BreakdownItemId.parse('wbs-9'), employeeId: NEW_PERSON };
    expect(personRows(plan, [gone]).map((row) => row.employeeId)).toEqual(['emp-001']);

    const withChild: PlanState = { ...plan, items: [...plan.items, item('wbs-3', 'prj-1', 'wbs-2', 'Checks')] };
    const rows = personRows(withChild, [{ itemId: LEAF, employeeId: NEW_PERSON }]);
    expect(rows.some((row) => row.employeeId === NEW_PERSON)).toBe(false);
  });
});
