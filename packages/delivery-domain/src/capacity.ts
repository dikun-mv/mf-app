import type { Allocation } from '@baseline/delivery-contract';
import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import type { Month } from '@baseline/host-contract';
import type { EmployeeId } from '@baseline/people-contract';

// Capacity is cross-project: 100% of a person's person-month, summed over every project (brief
// §3.9). The grid uses this module, so the threshold and the causer rule are defined once here (D8,
// D18). `delivery-pb`'s `pb_hooks/lib/load.js` is the one plain-JS mirror of them, for the
// `employee_month_loads` rows it keeps; a property test holds it equal to `loadsOf` (T3.9).

/** A floating-point allowance only, like the brief's 0.01 tolerance; not a rounding budget. */
export const CAPACITY_EPSILON = 1e-9;

export const isOverCapacity = (allocatedPersonMonths: number): boolean => allocatedPersonMonths > 1 + CAPACITY_EPSILON;

export const loadKey = (employeeId: EmployeeId, month: Month): string => `${employeeId}|${month}`;

type Contribution = Pick<Allocation, 'id' | 'amount' | 'editedAt'>;

/** Orders by `editedAt`, then by `id`: the latest edit, the highest id breaking a tie (D18). */
export function compareByLastEdit(a: Contribution, b: Contribution): number {
  if (a.editedAt !== b.editedAt) return a.editedAt < b.editedAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** The contributing allocation edited most recently (D18), or null if nothing contributes. */
export function causingAllocation<T extends Contribution>(allocations: readonly T[]): T | null {
  let latest: T | null = null;
  for (const allocation of allocations) {
    if (allocation.amount > 0 && (latest === null || compareByLastEdit(allocation, latest) > 0)) latest = allocation;
  }
  return latest;
}

/**
 * One entry per (employee, month) that has effort, across every project, sorted by employee then
 * month. The causer is named only when the month is over capacity.
 */
export function loadsOf(allocations: readonly Allocation[]): EmployeeMonthLoad[] {
  const groups = new Map<string, { employeeId: EmployeeId; month: Month; contributors: Allocation[] }>();
  for (const allocation of allocations) {
    if (allocation.amount <= 0) continue;
    const key = loadKey(allocation.employeeId, allocation.month);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { employeeId: allocation.employeeId, month: allocation.month, contributors: [allocation] });
    } else {
      group.contributors.push(allocation);
    }
  }

  return [...groups.values()]
    .sort((a, b) =>
      a.employeeId === b.employeeId ? (a.month < b.month ? -1 : 1) : a.employeeId < b.employeeId ? -1 : 1,
    )
    .map(({ employeeId, month, contributors }) => {
      // Summed in id order so the total doesn't depend on the order the allocations arrived in.
      const allocatedPersonMonths = [...contributors]
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .reduce((sum, c) => sum + c.amount, 0);
      const overCapacity = isOverCapacity(allocatedPersonMonths);
      const causer = overCapacity ? causingAllocation(contributors) : null;
      return {
        employeeId,
        month,
        allocatedPersonMonths,
        overCapacity,
        causingAllocationId: causer === null ? null : causer.id,
      };
    });
}
