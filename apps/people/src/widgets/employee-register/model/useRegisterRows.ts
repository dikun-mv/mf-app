import type { Employee, EmployeeId, RateRecord } from '@baseline/people-contract';
import { rateOn, searchEmployees } from '@baseline/people-domain';
import { useMemo } from 'react';
import { overCapacityMonthsLabel, useCapacity, type Capacity } from '../../../entities/capacity';
import { useEmployees } from '../../../entities/employee';
import { useRateRecords } from '../../../entities/rate-record';
import { today } from '../../../shared/lib';

/** What the Capacity column shows for one employee. `over` is the badge; any other text is plain. */
export interface CapacityCell {
  readonly text: string;
  readonly over: boolean;
}

const NOTHING: CapacityCell = { text: '', over: false };
const UNKNOWN: CapacityCell = { text: 'unknown', over: false };

export interface RegisterRow {
  readonly employee: Employee;
  /** The hourly cost in EUR in effect today, or `null` before the first rate (or with none). */
  readonly rateTodayEur: number | null;
  readonly capacity: CapacityCell;
}

/** The employee's rate in effect on `day`, for everyone (`rateOn` is the domain's rule, D7). */
function ratesOn(records: readonly RateRecord[], day: ReturnType<typeof today>): Map<EmployeeId, number> {
  const byEmployee = new Map<EmployeeId, RateRecord[]>();
  for (const record of records) {
    const history = byEmployee.get(record.employeeId);
    if (history) history.push(record);
    else byEmployee.set(record.employeeId, [record]);
  }
  const rates = new Map<EmployeeId, number>();
  for (const [employeeId, history] of byEmployee) {
    const inEffect = rateOn(history, day);
    if (inEffect) rates.set(employeeId, inEffect.hourlyCost);
  }
  return rates;
}

/**
 * The Capacity cell: the months over capacity, nothing for an employee within capacity or while the feed is
 * loading, and *unknown* when Delivery can't be reached (screens 2.1, 2.2).
 */
function capacityCell(capacity: Capacity, employeeId: EmployeeId): CapacityCell {
  if (capacity.status === 'unknown') return UNKNOWN;
  if (capacity.status === 'loading') return NOTHING;
  const own = capacity.of(employeeId);
  return own.status === 'over' ? { text: overCapacityMonthsLabel(own.months), over: true } : NOTHING;
}

/**
 * The register's rows for a search term: employees by name, filtered by `searchEmployees`, each with its rate
 * today and its capacity. `total` is everyone, for "2 of 60". Recomputed only when the cached collections, the
 * day, the capacity or the term change.
 */
export function useRegisterRows(term: string): { rows: readonly RegisterRow[]; total: number; capacity: Capacity } {
  const employees = useEmployees();
  const records = useRateRecords();
  const capacity = useCapacity();
  const day = today();
  const byName = useMemo(() => employees.toSorted((a, b) => a.name.localeCompare(b.name, 'en-GB')), [employees]);
  const rates = useMemo(() => ratesOn(records, day), [records, day]);
  const rows = useMemo(
    () =>
      searchEmployees(byName, term).map((employee) => ({
        employee,
        rateTodayEur: rates.get(employee.id) ?? null,
        capacity: capacityCell(capacity, employee.id),
      })),
    [byName, rates, capacity, term],
  );
  return { rows, total: employees.length, capacity };
}
