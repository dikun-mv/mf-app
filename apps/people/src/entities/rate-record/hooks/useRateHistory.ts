import type { EmployeeId, RateRecord } from '@baseline/people-contract';
import { historyOf } from '@baseline/people-domain';
import { useMemo } from 'react';
import { useRateRecords } from './useRateRecords';

/** One employee's rate records, oldest first (`historyOf`). Recomputed only when the cached records change. */
export function useRateHistory(employeeId: EmployeeId): readonly RateRecord[] {
  const records = useRateRecords();
  return useMemo(() => historyOf(records, employeeId), [records, employeeId]);
}
