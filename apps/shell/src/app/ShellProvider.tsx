import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  initialSelection,
  storeSelection,
  type RemoteName,
  type SelectionStorage,
  type ShellConfig,
} from '../shared/config';
import type { RemoteLoader } from '../shared/federation';
import { SelectionContext, ShellContext, type SelectionState, type ShellState } from '../shared/lib';

interface ShellProviderProps {
  config: ShellConfig;
  loader: RemoteLoader;
  remotes: Record<RemoteName, string>;
  theme: ShellState['theme'];
  storage: SelectionStorage;
  children: ReactNode;
}

/**
 * Owns what the shell decides for the whole page: the loader, and the display currency and active user
 * (D11). A choice is saved in `storage` and replaces the context value, so the panels get new props
 * and re-render in place; nothing here changes a panel's key or position, so none is remounted (T4.2).
 */
export function ShellProvider({ config, loader, remotes, theme, storage, children }: ShellProviderProps) {
  const [selection, setSelection] = useState(() => initialSelection(config, storage));
  const { currencies, users } = config;

  const selectCurrency = useCallback(
    (code: string) => {
      const currency = currencies.find((candidate) => candidate.code === code);
      if (!currency) return;
      const next = { ...selection, currency };
      storeSelection(next, storage);
      setSelection(next);
    },
    [currencies, selection, storage],
  );
  const selectUser = useCallback(
    (id: string) => {
      const activeUser = users.find((candidate) => candidate.id === id);
      if (!activeUser) return;
      const next = { ...selection, activeUser };
      storeSelection(next, storage);
      setSelection(next);
    },
    [users, selection, storage],
  );

  const shell = useMemo<ShellState>(() => ({ loader, remotes, theme }), [loader, remotes, theme]);
  const choices = useMemo<SelectionState>(
    () => ({ ...selection, currencies, users, selectCurrency, selectUser }),
    [selection, currencies, users, selectCurrency, selectUser],
  );

  return (
    <ShellContext.Provider value={shell}>
      <SelectionContext.Provider value={choices}>{children}</SelectionContext.Provider>
    </ShellContext.Provider>
  );
}
