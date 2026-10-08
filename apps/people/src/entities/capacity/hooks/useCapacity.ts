import type { EmployeeId } from '@baseline/people-contract';
import { WITHIN_CAPACITY, capacitySummary, type EmployeeCapacity } from '@baseline/people-domain';
import { useMemo } from 'react';
import { useLoadFeed } from './useLoadFeed';

/** Every employee's capacity (screens 2.1, 2.3), or why there is none to show. */
export type Capacity =
  | { readonly status: 'loading' }
  | { readonly status: 'unknown' }
  | { readonly status: 'known'; readonly of: (employeeId: EmployeeId) => EmployeeCapacity };

/**
 * The months each employee is over capacity, from the load feed through `capacitySummary`. An employee the
 * feed has no row for has no effort allocated, so is within capacity. Recomputed only when the feed changes.
 */
export function useCapacity(): Capacity {
  const feed = useLoadFeed();
  return useMemo((): Capacity => {
    if (feed.status !== 'known') return feed;
    const summary = capacitySummary(feed.loads);
    return { status: 'known', of: (employeeId) => summary.get(employeeId) ?? WITHIN_CAPACITY };
  }, [feed]);
}
