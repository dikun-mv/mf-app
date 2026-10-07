import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ConnectionStatusProvider, useRepository, type ConnectionStatus, type Instance } from '../../shared/api';
import { connectRealtime } from './connectRealtime';

/**
 * The realtime subscriptions of one PocketBase instance, owned by the app root so their lifetime is the
 * app's `mount` and `unmount` (D29). Render one per instance the app reads. It tells everything below its
 * connection status, for widgets that degrade while the other team's service is down.
 */
export function RealtimeProvider({ instance, children }: { instance: Instance; children: ReactNode }) {
  const repository = useRepository();
  const client = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  useEffect(
    () => connectRealtime({ repository, client, instance, onStatus: setStatus }),
    [repository, client, instance],
  );
  return (
    <ConnectionStatusProvider instance={instance} status={status}>
      {children}
    </ConnectionStatusProvider>
  );
}
