import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { Allocation } from '@baseline/delivery-contract';
import type { Employee, EmployeeId } from '@baseline/people-contract';

/**
 * The employees who can still be added to a leaf (screens 3.5): everyone People lists except those who
 * already have a row on it, whether from allocations or from an assignment made on this page and not yet
 * given a value. By name, so the list can be scanned.
 */
export function assignableEmployees(
  employees: readonly Employee[],
  allocations: readonly Allocation[],
  itemId: BreakdownItemId,
  pending: readonly EmployeeId[],
): Employee[] {
  const taken = new Set<EmployeeId>(pending);
  for (const allocation of allocations) if (allocation.breakdownItemId === itemId) taken.add(allocation.employeeId);
  return employees.filter((employee) => !taken.has(employee.id)).sort((a, b) => a.name.localeCompare(b.name));
}

/** `Henrik Bauer — QA Engineer, 20 h/week`: what the select shows for an employee. */
export const describeEmployee = ({ name, role, weeklyHours }: Employee): string =>
  `${name} — ${role}, ${String(weeklyHours)} h/week`;
