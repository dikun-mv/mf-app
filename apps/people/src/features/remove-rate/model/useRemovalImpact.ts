import type { Employee, RateRecord } from '@baseline/people-contract';
import { pricingImpact, type PricingImpact } from '@baseline/people-domain';
import { useMemo } from 'react';
import { useLoadFeed } from '../../../entities/capacity';

/**
 * The allocated months that removing `rate` leaves unpriced or partly priced (T1.13, screens 2.5), or `null`
 * when they can't be told because Delivery's load feed isn't available (D32). `history` is the employee's
 * records, oldest first. People doesn't see allocations (D8), so the feed is the only source of the months.
 */
export function useRemovalImpact(
  employee: Employee,
  history: readonly RateRecord[],
  rate: RateRecord | null,
): PricingImpact[] | null {
  const feed = useLoadFeed();
  return useMemo(() => {
    if (rate === null || feed.status !== 'known') return null;
    const own = feed.loads.filter(({ employeeId }) => employeeId === employee.id);
    return pricingImpact(
      history,
      history.filter(({ id }) => id !== rate.id),
      own,
    );
  }, [feed, employee.id, history, rate]);
}
