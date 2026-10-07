import type { ActiveUser, Currency } from '@baseline/host-contract';
import { createContext, useContext } from 'react';
import type { RemoteName, Selection } from '../config';
import type { RemoteLoader } from '../federation';

/** What never changes while the page is open. The currency and user are in `SelectionState`, which does. */
export interface ShellState {
  readonly loader: RemoteLoader;
  /** The `remoteEntry.js` URL each remote is loaded from, as `config.json` resolved it (T4.4). */
  readonly remotes: Record<RemoteName, string>;
  /** From `?theme=`: a debug switch that re-themes the panels to prove the token override (T2.8a). */
  readonly theme: 'default' | 'contrast';
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const state = useContext(ShellContext);
  if (!state) throw new Error('useShell must be used inside ShellContext.Provider');
  return state;
}

/** The shell's two choices (D11) and the lists they are picked from. Both lists come from `config.json`. */
export interface SelectionState extends Selection {
  readonly currencies: readonly Currency[];
  readonly users: readonly ActiveUser[];
  /** Ignores a code that `config.json` doesn't list. */
  readonly selectCurrency: (code: string) => void;
  /** Ignores an id that `config.json` doesn't list. */
  readonly selectUser: (id: string) => void;
}

export const SelectionContext = createContext<SelectionState | null>(null);

export function useSelection(): SelectionState {
  const state = useContext(SelectionContext);
  if (!state) throw new Error('useSelection must be used inside SelectionContext.Provider');
  return state;
}
