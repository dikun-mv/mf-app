import type { QueryClient } from '@tanstack/react-query';
import { instanceKey, type Instance } from '../shared/api';

/**
 * Tells when every active query of an instance has been read again since `begin()`. A refetch that resolves
 * says nothing about that: a read cancelled by a write, one that failed, or one paused while offline all let
 * it resolve without new data, and the cache would then be called current while it still holds what was true
 * before an outage. Only a fetch that succeeded counts. `setQueryData` (a realtime patch, a write's result)
 * does not, because it is not a read of the server.
 *
 * A query nobody observes is not waited for: a refetch only marks it stale, and it is read when it is next used.
 */
export function watchReads(queryClient: QueryClient, instance: Instance, onAllRead: () => void) {
  let pending: Set<string> | null = null;

  const check = (): void => {
    if (pending?.size !== 0) return;
    pending = null;
    onAllRead();
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (pending === null) return;
    const read = event.type === 'updated' && event.action.type === 'success' && !event.action.manual;
    if (read || event.type === 'removed') {
      pending.delete(event.query.queryHash);
      check();
    }
  });

  return {
    /** Starts waiting for the instance's active queries, as they are now. */
    begin(): void {
      const active = queryClient.getQueryCache().findAll({ queryKey: instanceKey(instance) });
      pending = new Set(active.filter((query) => query.isActive()).map((query) => query.queryHash));
    },
    /** Reports if nothing is left to wait for, for a caller that knows the refetch has finished. */
    check,
    /** Stops waiting: a connection drop makes whatever was being read out of date. */
    drop(): void {
      pending = null;
    },
    stop(): void {
      pending = null;
      unsubscribe();
    },
  };
}
