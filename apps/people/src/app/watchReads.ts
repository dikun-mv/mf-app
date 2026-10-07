import type { QueryClient } from '@tanstack/react-query';
import { instanceKey, type Instance } from '../shared/api';

/**
 * Tells when every active query of an instance has been read again since `begin()`. A refetch that resolves
 * says nothing about that: a read cancelled by a write, one that failed, or one paused while offline all let
 * it resolve without new data, and the cache would then be called current while it still holds what was true
 * before an outage. Only a fetch that succeeded counts. `setQueryData` (a realtime patch, a write's result)
 * does not, because it is not a read of the server.
 *
 * A query whose first fetch (no data yet) is running when `begin()` is called can't be restarted, and that fetch may
 * have read the server before the subscription was live. Its end, successful or not, is let go by, and the
 * follow-up read the provider makes after it is the one that counts.
 *
 * A query nobody observes is not waited for: a refetch only marks it stale, and it is read when it is next used.
 */
export function watchReads(queryClient: QueryClient, instance: Instance, onAllRead: () => void) {
  let pending: Set<string> | null = null;
  // The queries in `pending` whose fetch in flight at `begin()` has not ended yet.
  let inFlight = new Set<string>();

  const check = (): void => {
    if (pending?.size !== 0) return;
    pending = null;
    onAllRead();
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (pending === null) return;
    const ended =
      event.type === 'updated' &&
      (event.action.type === 'error' || (event.action.type === 'success' && !event.action.manual));
    if (ended && inFlight.delete(event.query.queryHash)) return;
    const read = ended && event.action.type === 'success';
    if (read || event.type === 'removed') {
      inFlight.delete(event.query.queryHash);
      pending.delete(event.query.queryHash);
      check();
    }
  });

  return {
    /** Starts waiting for the instance's active queries, as they are now. */
    begin(): void {
      const active = queryClient.getQueryCache().findAll({ queryKey: instanceKey(instance) });
      const waited = active.filter((query) => query.isActive());
      pending = new Set(waited.map((query) => query.queryHash));
      inFlight = new Set(
        waited
          .filter(({ state }) => state.data === undefined && state.fetchStatus === 'fetching')
          .map((query) => query.queryHash),
      );
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
