import type { HostContext, RemoteAppProps } from '@baseline/host-contract';
import { ErrorBoundary, Spinner } from '@baseline/ui';
import { lazy, Suspense, useState, type ComponentType } from 'react';
import type { RemoteName } from '../../../shared/config';
import type { RemoteLoader } from '../../../shared/federation';
import { PanelFailed } from './PanelFailed';
import styles from './RemotePanel.module.css';

const LABELS: Record<RemoteName, string> = { people: 'People', delivery: 'Delivery' };

// A lazy component remembers its first result for good, so a retry needs a new one.
function lazyRemote(loader: RemoteLoader, name: RemoteName): ComponentType<RemoteAppProps> {
  return lazy(async () => ({ default: await loader.load(name) }));
}

interface RemotePanelProps {
  name: RemoteName;
  ctx: HostContext;
  loader: RemoteLoader;
  /** The URL the remote's `remoteEntry.js` is fetched from, named in the failure message. */
  entry: string;
}

/**
 * One remote's place on the page (T2.5, T4.3): a spinner while it loads, and in its place an error with
 * a retry if the load fails, times out or the remote throws while rendering. The nav and the other
 * panel are outside this boundary, so they keep working.
 */
export function RemotePanel({ name, ctx, loader, entry }: RemotePanelProps) {
  const [Remote, setRemote] = useState(() => lazyRemote(loader, name));
  const label = LABELS[name];
  return (
    <div className={styles.panel} data-panel={name}>
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <PanelFailed
            label={label}
            entry={entry}
            error={error}
            loadFailed={loader.getStatus(name) === 'failed'}
            onRetry={() => {
              setRemote(() => lazyRemote(loader, name));
              reset();
            }}
          />
        )}
      >
        <Suspense
          fallback={
            <p className={styles.loading}>
              <Spinner /> Loading {label}…
            </p>
          }
        >
          <Remote ctx={ctx} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
