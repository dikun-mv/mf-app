import { useQueryClient } from '@tanstack/react-query';
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
 * Keeps one PocketBase instance's cached collections fresh (D29). On mount it subscribes to the instance
 * through the repository and patches each event's record into its query by id. Events missed while
 * disconnected aren't replayed (D6), so every connect after the first, and the first after a failed attempt,
 * refetches the instance's queries. On unmount it unsubscribes and cancels the instance's queries, so an
 * unmounted remote leaves no open connection. The status (`connecting`, `live`, `down`) is available
 * to the widgets below through `useRealtimeStatus`.
 *
 * An app mounts one per instance it reads. Nothing reads Delivery's feed yet (T5.4), so only `people` is mounted.
 */
export function RealtimeProvider({ instance, children }: { instance: Instance; children: ReactNode }) {
  const queryClient = useQueryClient();
  const repository = useRepository();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    let connects = 0;
    let wasDown = false;
    const stop = repository.subscribe(instance, {
      onEvent: (event) => {
        patchCollection(queryClient, event);
      },
      onConnect: () => {
        if (connects > 0 || wasDown) void queryClient.invalidateQueries({ queryKey: instanceKey(instance) });
        connects += 1;
        setStatus('live');
      },
      onDisconnect: () => {
        wasDown = true;
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
