import type { HostContext } from '@baseline/host-contract';
import { createContext, useContext, type ReactNode } from 'react';

const Host = createContext<HostContext | null>(null);

/** Makes the shell's context (currency, user, navigate) available below the router. */
export function HostContextProvider({ ctx, children }: { ctx: HostContext; children: ReactNode }) {
  return <Host.Provider value={ctx}>{children}</Host.Provider>;
}

export function useHost(): HostContext {
  const ctx = useContext(Host);
  if (!ctx) throw new Error('useHost must be used inside HostContextProvider');
  return ctx;
}
