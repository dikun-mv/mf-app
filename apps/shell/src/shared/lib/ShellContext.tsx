import { createContext, useContext } from 'react';
import type { Selection } from '../config';
import type { RemoteLoader } from '../federation';

export interface ShellState extends Selection {
  readonly loader: RemoteLoader;
  /** From `?theme=`: a debug switch that re-themes the panels to prove the token override (T2.8a). */
  readonly theme: 'default' | 'contrast';
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const state = useContext(ShellContext);
  if (!state) throw new Error('useShell must be used inside ShellContext.Provider');
  return state;
}
