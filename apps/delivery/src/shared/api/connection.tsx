import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Instance } from './collections';

/** The state of an instance's realtime connection (D29): opening, up, or dropped (the SDK keeps retrying). */
export type ConnectionStatus = 'connecting' | 'live' | 'down';

type Statuses = Readonly<Partial<Record<Instance, ConnectionStatus>>>;

const ConnectionContext = createContext<Statuses>({});

/**
 * Adds one instance's status to what the providers above it report. `RealtimeProvider` (in `app/`) renders
 * this once per instance, so Delivery's and People's statuses sit in one context.
 */
export function ConnectionStatusProvider({
  instance,
  status,
  children,
}: {
  instance: Instance;
  status: ConnectionStatus;
  children: ReactNode;
}) {
  const outer = useContext(ConnectionContext);
  const value = useMemo(() => ({ ...outer, [instance]: status }), [outer, instance, status]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

/**
 * The realtime status of an instance, for widgets that show a degraded state while the other team's
 * service is down (T6.13). With no provider (a test, or an app with no realtime) there is nothing to
 * degrade, so it reads as `live`.
 */
export function useConnectionStatus(instance: Instance): ConnectionStatus {
  return useContext(ConnectionContext)[instance] ?? 'live';
}
