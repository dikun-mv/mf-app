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

/**
 * Refetches what the instance's queries hold. A first fetch still in flight can't be restarted (TanStack
 * restarts only a fetch that has data), and the server may have read its answer before the subscription
 * went live, so it is refetched once it settles. Queries nobody observes are only marked stale.
 */
function refetchInstance(queryClient: QueryClient, instance: Instance): void {
  const queryKey = instanceKey(instance);
  const loading = queryClient.getQueryCache().findAll({ queryKey, fetchStatus: 'fetching' });
  void queryClient.invalidateQueries({ queryKey });
  const firstFetches = loading.filter(({ state }) => state.data === undefined);
  if (firstFetches.length === 0) return;
  void Promise.allSettled(firstFetches.map((query) => query.fetch())).then(() =>
    queryClient.invalidateQueries({ queryKey, predicate: (query) => firstFetches.includes(query) }),
  );
}

/**
 * Keeps one PocketBase instance's cached collections fresh (D29). On mount it subscribes to the instance
 * through the repository and patches each event's record into its query by id. Every connect, the first
 * included, refetches the instance's queries: the first closes the gap between the page's first fetch and
 * the subscription going live, and later ones cover events missed while disconnected, which aren't replayed
 * (D6). On unmount it unsubscribes and cancels the instance's queries, so an unmounted remote leaves no open
 * connection. The status (`connecting`, `live`, `down`) is available to the widgets below through
 * `useRealtimeStatus`.
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
    const stop = repository.subscribe(instance, {
      onEvent: (event) => {
        patchCollection(queryClient, event);
      },
      onConnect: () => {
        setStatus('live');
        // A refetch that read the server before a write committed would put the old rates back over the
        // write's result, so People's refetch waits until no write is in flight. Other instances hold no writes.
        if (instance !== 'people') {
          refetchInstance(queryClient, instance);
        } else if (waiting === null) {
          waiting = afterWrites(queryClient, () => {
            waiting = null;
            refetchInstance(queryClient, instance);
          });
        }
      },
      onDisconnect: () => {
        setStatus('down');
      },
    });
    return () => {
      waiting?.();
      stop();
      void queryClient.cancelQueries({ queryKey: instanceKey(instance) });
    };
  }, [instance, queryClient, repository]);

  const parent = useContext(RealtimeStatusContext);
  const statuses = useMemo(() => ({ ...parent, [instance]: status }), [parent, instance, status]);
  return <RealtimeStatusContext.Provider value={statuses}>{children}</RealtimeStatusContext.Provider>;
}
