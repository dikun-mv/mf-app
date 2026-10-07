import { BasePath, type HostContext } from '@baseline/host-contract';
import { clsx } from 'clsx';
import { useMemo } from 'react';
import type { RemoteName } from '../../../shared/config';
import { useSelection, useShell, useShellNavigate } from '../../../shared/lib';
import { RemotePanel } from './RemotePanel';
import styles from './RemoteRoute.module.css';

const BASE_PATHS: Record<RemoteName, BasePath> = {
  people: BasePath.parse('/people'),
  delivery: BasePath.parse('/delivery'),
};

/**
 * A route's remote: builds its `HostContext` from the shell's state and hosts it in a panel. A new currency
 * or user gives the panel new props, not a new key, so the remote re-renders in place (T4.2).
 */
export function RemoteRoute({ name }: { name: RemoteName }) {
  const { loader, remotes, theme } = useShell();
  const { currency, activeUser } = useSelection();
  const navigate = useShellNavigate();
  const ctx = useMemo<HostContext>(
    () => ({ currency, activeUser, basePath: BASE_PATHS[name], navigate }),
    [currency, activeUser, name, navigate],
  );
  return (
    // The panel container is where the shell may override design tokens (`--bl-theme-*`).
    <div className={clsx(styles.container, { [styles.contrast]: theme === 'contrast' })}>
      <RemotePanel key={name} name={name} ctx={ctx} loader={loader} entry={remotes[name]} />
    </div>
  );
}
