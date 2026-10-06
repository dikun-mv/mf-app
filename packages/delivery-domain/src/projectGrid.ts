import type { Allocation, BreakdownItem, Project } from '@baseline/delivery-contract';
import type { Month } from '@baseline/host-contract';
import type { EmployeeId } from '@baseline/people-contract';
import { monthOf, monthsBetween } from './calendar';
import type { GridNode, GridRow } from './grid';
import { at } from './lookup';
import { childrenOf, indexItems, rootsOf } from './tree';

/** Grid columns come from the project's own span, so a project that starts before the planning horizon still shows its first month. */
export const projectMonths = (project: Project): Month[] =>
  monthsBetween(monthOf(project.startDate), monthOf(project.endDate));

export const rowKey = (itemId: BreakdownItem['id'], employeeId: EmployeeId): string => `${itemId}/${employeeId}`;

/**
 * Lays one project's tree out as a grid: a node per item, and a person row for each employee that
 * has an allocation on it. `valueOf` says what each allocation is worth in the unit being shown
 * (exact, not rounded). Rows are ordered by employee id and children keep their given order, which
 * is the order `roundGrid` breaks ties in.
 */
export function buildGrid(
  project: Project,
  items: readonly BreakdownItem[],
  allocations: readonly Allocation[],
  months: readonly Month[],
  valueOf: (allocation: Allocation) => number,
): GridNode[] {
  const projectItems = items.filter((item) => item.projectId === project.id);
  const index = indexItems(projectItems);
  const monthIndex = new Map(months.map((month, position) => [month, position]));

  const allocationsByItem = new Map<string, Allocation[]>();
  for (const allocation of allocations) {
    const list = allocationsByItem.get(allocation.breakdownItemId);
    if (list === undefined) allocationsByItem.set(allocation.breakdownItemId, [allocation]);
    else list.push(allocation);
  }

  const rowsOf = (item: BreakdownItem): GridRow[] => {
    const byEmployee = new Map<EmployeeId, number[]>();
    for (const allocation of allocationsByItem.get(item.id) ?? []) {
      const position = monthIndex.get(allocation.month);
      if (position === undefined) continue; // Outside the project's span: `checkInvariants` reports it.
      const cells = byEmployee.get(allocation.employeeId) ?? months.map(() => 0);
      cells[position] = at(cells, position) + valueOf(allocation);
      byEmployee.set(allocation.employeeId, cells);
    }
    return [...byEmployee.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([employeeId, cells]) => ({ key: rowKey(item.id, employeeId), cells }));
  };

  const nodeOf = (item: BreakdownItem): GridNode => ({
    id: item.id,
    children: childrenOf(index, item.id).map(nodeOf),
    rows: rowsOf(item),
  });
  return rootsOf(projectItems, project.id).map(nodeOf);
}
