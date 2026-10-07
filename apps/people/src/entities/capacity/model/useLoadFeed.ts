import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { employeeMonthLoadsQuery, useRealtimeStatus, useRepository } from '../../../shared/api';

/**
 * What People knows of Delivery's load feed. It is the other team's data, so it is never a suspended read or
 * a thrown error (D32): `loading` until the first answer, `unknown` when Delivery can't be reached, `known`
 * otherwise.
 */
export type LoadFeed =
  | { readonly status: 'loading' }
  | { readonly status: 'unknown' }
  | { readonly status: 'known'; readonly loads: readonly EmployeeMonthLoad[] };

const LOADING: LoadFeed = { status: 'loading' };
const UNKNOWN: LoadFeed = { status: 'unknown' };

/**
 * Delivery's `employee_month_loads` as a plain read (D32, T5.5). The feed is unknown when its read failed or
 * its realtime status is `down` (D29): rows cached before the loss may be stale, and showing
 * them as current would be worse than saying capacity is unknown. The provider holds the status at `down`
 * after a reconnect until the instance has been read again, so it is known again only with fresh rows.
 */
export function useLoadFeed(): LoadFeed {
  const { data, isError } = useQuery(employeeMonthLoadsQuery(useRepository()));
  const connection = useRealtimeStatus('delivery');
  return useMemo((): LoadFeed => {
    if (isError || connection === 'down') return UNKNOWN;
    return data === undefined ? LOADING : { status: 'known', loads: data };
  }, [data, isError, connection]);
}
