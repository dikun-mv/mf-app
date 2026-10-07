import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  RealtimeStatusContext,
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
 * An app mounts one per instance it reads. Nothing reads Delivery's feed yet (T5.4), so only `people` is mounted.
 */
export function RealtimeProvider({ instance, children }: { instance: Instance; children: ReactNode }) {
  const queryClient = useQueryClient();
  const repository = useRepository();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    const stop = repository.subscribe(instance, {
      onEvent: (event) => {
        patchCollection(queryClient, event);
      },
      onConnect: () => {
        refetchInstance(queryClient, instance);
        setStatus('live');
      },
      onDisconnect: () => {
        setStatus('down');
      },
    });
    return () => {
      stop();
      void queryClient.cancelQueries({ queryKey: instanceKey(instance) });
    };
  }, [instance, queryClient, repository]);

  const parent = useContext(RealtimeStatusContext);
  const statuses = useMemo(() => ({ ...parent, [instance]: status }), [parent, instance, status]);
  return <RealtimeStatusContext.Provider value={statuses}>{children}</RealtimeStatusContext.Provider>;
}
