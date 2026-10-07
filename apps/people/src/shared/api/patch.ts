import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import type { Employee, RateRecord } from '@baseline/people-contract';
import type { QueryClient } from '@tanstack/react-query';
import { employeeKeys, employeeMonthLoadKeys, rateRecordKeys } from './queryKeys';
import type { RealtimeAction, RecordEvent } from './repository';
import { absorbServerRecord } from './writes';

// Patching a cached collection by id (D29). A record that is already there and unchanged keeps its object,
// and a patch that changes nothing returns the same array, so the realtime echo of the app's own write
// re-renders nothing and the memoisation that relies on stable references holds (D35).

type Fields = Record<string, unknown>;

function sameFields(a: object, b: object): boolean {
  const left = Object.entries(a as Fields);
  const right = b as Fields;
  return left.length === Object.keys(right).length && left.every(([key, value]) => right[key] === value);
}

/** Replaces or adds `record` (create and update), or removes it (delete), by `keyOf`. */
export function patchList<T extends object>(
  list: readonly T[],
  action: RealtimeAction,
  record: T,
  keyOf: (record: T) => string,
): readonly T[] {
  const key = keyOf(record);
  const index = list.findIndex((item) => keyOf(item) === key);
  if (action === 'delete') return index === -1 ? list : list.filter((_, at) => at !== index);
  if (index === -1) return [...list, record];
  const existing = list[index];
  if (existing === undefined || sameFields(existing, record)) return list;
  return list.map((item, at) => (at === index ? record : item));
}

/** A load row's id is `<employeeId>-<month>` (ADR 035); the parsed row has no `id`, so the key is rebuilt. */
export const loadKey = (load: EmployeeMonthLoad): string => `${load.employeeId}-${load.month}`;
const idOf = (record: Employee | RateRecord): string => record.id;

/**
 * Applies one realtime event to the cached collection it belongs to. A collection not in the cache is left
 * alone. A rate that a write still in flight has changed is not patched: the cache shows that write's
 * optimistic value, which an older event (the echo of an earlier write) would flip back. The event is kept
 * as what the write's rollback restores instead (`absorbServerRecord`).
 */
export function patchCollection(queryClient: QueryClient, event: RecordEvent): void {
  switch (event.collection) {
    case 'employees':
      queryClient.setQueryData<readonly Employee[]>(
        employeeKeys.all,
        (old) => old && patchList(old, event.action, event.record, idOf),
      );
      return;
    case 'rateRecords':
      if (absorbServerRecord(queryClient, event.action, event.record)) return;
      queryClient.setQueryData<readonly RateRecord[]>(
        rateRecordKeys.all,
        (old) => old && patchList(old, event.action, event.record, idOf),
      );
      return;
    case 'employeeMonthLoads':
      queryClient.setQueryData<readonly EmployeeMonthLoad[]>(
        employeeMonthLoadKeys.all,
        (old) => old && patchList(old, event.action, event.record, loadKey),
      );
      return;
  }
}
