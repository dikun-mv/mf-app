import type { Employee, EmployeeId, RateRecord } from '@baseline/people-contract';
import { rateOn, searchEmployees } from '@baseline/people-domain';
import { useMemo } from 'react';
import { useEmployees } from '../../../entities/employee';
import { useRateRecords } from '../../../entities/rate-record';
import { today } from '../../../shared/lib';

export interface RegisterRow {
  readonly employee: Employee;
  /** The hourly cost in EUR in effect today, or `null` before the first rate (or with none). */
  readonly rateTodayEur: number | null;
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
 * The register's rows for a search term: employees by name, filtered by `searchEmployees`, each with its rate
 * today. `total` is everyone, for "2 of 60". Recomputed only when the cached collections, the day or the term change.
 */
export function useRegisterRows(term: string): { rows: readonly RegisterRow[]; total: number } {
  const employees = useEmployees();
  const records = useRateRecords();
  const day = today();
  const byName = useMemo(() => employees.toSorted((a, b) => a.name.localeCompare(b.name, 'en-GB')), [employees]);
  const rates = useMemo(() => ratesOn(records, day), [records, day]);
  const rows = useMemo(
    () => searchEmployees(byName, term).map((employee) => ({ employee, rateTodayEur: rates.get(employee.id) ?? null })),
    [byName, rates, term],
  );
  return { rows, total: employees.length };
}
