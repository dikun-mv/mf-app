import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import type { Month } from '@baseline/host-contract';
import type { EmployeeId } from '@baseline/people-contract';

/** One month an employee is over capacity, as the register and the detail view list it. */
export interface OverCapacityMonth {
  readonly month: Month;
  /** Share of capacity, rounded to one decimal: `118` for 1.18 PM, shown `118.0%`. */
  readonly percent: number;
  /** The allocated person-months across all projects, as the feed has it. */
  readonly personMonths: number;
}

/** What the load feed says about one employee: within capacity, or the months over it, oldest first. */
export type EmployeeCapacity =
  { readonly status: 'within' } | { readonly status: 'over'; readonly months: readonly OverCapacityMonth[] };

/** Also what to show for an employee the feed has no row for: no effort allocated, so nothing over. */
export const WITHIN_CAPACITY: EmployeeCapacity = { status: 'within' };

/**
 * Per employee in the feed, the months over capacity or "within capacity" (screens 2.1, 2.6); an
 * `over` entry always has a month. The `overCapacity` flag is Delivery's verdict (D8, T1.11) and is trusted as it comes; PM is already
 * normalised to the person's capacity, so the percent is PM × 100. Employees with no row in the feed
 * aren't in the map: use `WITHIN_CAPACITY` for them. When Delivery can't be reached there is no feed
 * and nothing to summarise: the screen says "capacity unknown" instead (T5.5).
 */
export function capacitySummary(
  loads: readonly Pick<EmployeeMonthLoad, 'employeeId' | 'month' | 'allocatedPersonMonths' | 'overCapacity'>[],
): Map<EmployeeId, EmployeeCapacity> {
  const overByEmployee = new Map<EmployeeId, OverCapacityMonth[]>();
  const summary = new Map<EmployeeId, EmployeeCapacity>();
  for (const load of loads) {
    if (!load.overCapacity) {
      if (!summary.has(load.employeeId)) summary.set(load.employeeId, WITHIN_CAPACITY);
      continue;
    }
    const months = overByEmployee.get(load.employeeId) ?? [];
    months.push({
      month: load.month,
      percent: Math.round(load.allocatedPersonMonths * 1000) / 10,
      personMonths: load.allocatedPersonMonths,
    });
    overByEmployee.set(load.employeeId, months);
  }
  for (const [employeeId, months] of overByEmployee) {
    months.sort((a, b) => (a.month < b.month ? -1 : 1)); // One row per (employee, month) in the feed.
    summary.set(employeeId, { status: 'over', months });
  }
  return summary;
}
