import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  RealtimeStatusContext,
  afterWrites,
  instanceKey,
  patchCollection,
  useRepository,
  type Instance,
  type RealtimeStatus,
} from '../shared/api';
import { watchReads } from './watchReads';

/**
 * Refetches what the instance's queries hold. A first fetch still in flight can't be restarted (TanStack
 * restarts only a fetch that has data), and the server may have read its answer before the subscription
 * went live, so it is refetched once it settles. Queries nobody observes are only marked stale.
 */
function refetchInstance(queryClient: QueryClient, instance: Instance): Promise<void> {
  const queryKey = instanceKey(instance);
  const loading = queryClient.getQueryCache().findAll({ queryKey, fetchStatus: 'fetching' });
  const invalidating = queryClient.invalidateQueries({ queryKey });
  const firstFetches = loading.filter(({ state }) => state.data === undefined);
  if (firstFetches.length === 0) return invalidating;
  const settled = Promise.allSettled(firstFetches.map((query) => query.fetch())).then(() =>
    queryClient.invalidateQueries({ queryKey, predicate: (query) => firstFetches.includes(query) }),
  );
  return Promise.all([invalidating, settled]).then(() => undefined);
}

/**
 * Keeps one PocketBase instance's cached collections fresh (D29). On mount it subscribes to the instance
 * through the repository and patches each event's record into its query by id. Every connect, the first
 * included, refetches the instance's queries: the first closes the gap between the page's first fetch and
 * the subscription going live, and later ones cover events missed while disconnected, which aren't replayed
 * (D6). On unmount it unsubscribes and cancels the instance's queries, so an unmounted remote leaves no open
 * connection. The status (`connecting`, `live`, `down`) is available to the widgets below through
 * `useRealtimeStatus`. After a drop it returns to `live` only when every active query of the instance has
 * succeeded again (`watchReads`), not when the refetch merely resolved: a read cancelled by a write, failed or
 * paused offline resolves it too.
 *
 * An app mounts one per instance it reads: `people`, and `delivery` for the load feed (T5.4).
 */
export function RealtimeProvider({ instance, children }: { instance: Instance; children: ReactNode }) {
  const queryClient = useQueryClient();
  const repository = useRepository();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    // A refetch waiting for rate writes to settle (`afterWrites`); one wait covers any number of connects.
    let waiting: (() => void) | null = null;
    let connected = false;
    // The connection has dropped since the cache was last read, so what it holds may be out of date.
    let lost = false;
    // Names the latest refetch, so only the last of several (a drop in the middle of one) says the cache is current.
    let latest = 0;
    // `live` after a drop needs more than a refetch that resolved: every active query must have succeeded again.
    const reads = watchReads(queryClient, instance, () => {
      if (!connected) return;
      lost = false;
      setStatus('live');
    });
    const refetch = (): void => {
      const mine = ++latest;
      reads.begin();
      void refetchInstance(queryClient, instance).then(() => {
        if (mine === latest) reads.check();
      });
    };
    const stop = repository.subscribe(instance, {
      onEvent: (event) => {
        patchCollection(queryClient, event);
      },
      onConnect: () => {
        connected = true;
        // After a drop the status stays `down` until the refetch has settled: `live` promises a cache that is
        // current, and until then it holds what was true before the outage.
        if (!lost) setStatus('live');
        // A refetch that read the server before a write committed would put the old rates back over the
        // write's result, so People's refetch waits until no write is in flight. Other instances hold no writes.
        if (instance !== 'people') {
          refetch();
        } else if (waiting === null) {
          waiting = afterWrites(queryClient, () => {
            waiting = null;
            refetch();
          });
        }
      },
      onDisconnect: () => {
        connected = false;
        lost = true;
        // A refetch already running started before the drop and may have read pre-outage data: it no longer counts.
        latest += 1;
        reads.drop();
        setStatus('down');
      },
    });
    return () => {
      connected = false;
      waiting?.();
      reads.stop();
      stop();
      void queryClient.cancelQueries({ queryKey: instanceKey(instance) });
    };
  }, [instance, queryClient, repository]);

  const parent = useContext(RealtimeStatusContext);
  const statuses = useMemo(() => ({ ...parent, [instance]: status }), [parent, instance, status]);
  return <RealtimeStatusContext.Provider value={statuses}>{children}</RealtimeStatusContext.Provider>;
}
