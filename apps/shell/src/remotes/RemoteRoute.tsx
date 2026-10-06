import { BasePath, type HostContext } from '@baseline/host-contract';
import { clsx } from 'clsx';
import { useMemo } from 'react';
import type { RemoteName } from '../config/schema';
import { useShellNavigate } from '../routing/navigation';
import { useShell } from '../ShellContext';
import { RemotePanel } from './RemotePanel';
import styles from './RemoteRoute.module.css';

const BASE_PATHS: Record<RemoteName, BasePath> = {
  people: BasePath.parse('/people'),
  delivery: BasePath.parse('/delivery'),
};

/** A route's remote: builds its `HostContext` from the shell's state and hosts it in a panel. */
export function RemoteRoute({ name }: { name: RemoteName }) {
  const { currency, activeUser, loader, theme } = useShell();
  const navigate = useShellNavigate();
  const ctx = useMemo<HostContext>(
    () => ({ currency, activeUser, basePath: BASE_PATHS[name], navigate }),
    [currency, activeUser, name, navigate],
  );
  return (
    // The panel container is where the shell may override design tokens (`--bl-theme-*`).
    <div className={clsx(styles.container, { [styles.contrast]: theme === 'contrast' })}>
      <RemotePanel key={name} name={name} ctx={ctx} loader={loader} />
    </div>
  );
}
