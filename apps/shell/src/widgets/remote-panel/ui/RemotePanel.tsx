import type { HostContext, RemoteAppProps } from '@baseline/host-contract';
import { Button, ErrorBoundary, InlineMessage, Spinner } from '@baseline/ui';
import { lazy, Suspense, useState, type ComponentType } from 'react';
import type { RemoteName } from '../../../shared/config';
import type { RemoteLoader } from '../../../shared/federation';
import styles from './RemotePanel.module.css';

const LABELS: Record<RemoteName, string> = { people: 'People', delivery: 'Delivery' };

// A lazy component remembers its first result for good, so a retry needs a new one.
function lazyRemote(loader: RemoteLoader, name: RemoteName): ComponentType<RemoteAppProps> {
  return lazy(async () => ({ default: await loader.load(name) }));
}

function PanelFailed({ label, error, onRetry }: { label: string; error: unknown; onRetry: () => void }) {
  return (
    <InlineMessage tone="error">
      <p className={styles.failedTitle}>{label} could not be shown.</p>
      <p className={styles.failedDetail}>{error instanceof Error ? error.message : 'Unknown error'}</p>
      <Button onClick={onRetry}>Retry</Button>
    </InlineMessage>
  );
}

interface RemotePanelProps {
  name: RemoteName;
  ctx: HostContext;
  loader: RemoteLoader;
}

/**
 * One remote's place on the page (T2.5): a spinner while it loads, and in its place an error with
 * a retry if the load fails, times out or the remote throws while rendering. The nav and the other
 * panel are outside this boundary, so they keep working.
 */
export function RemotePanel({ name, ctx, loader }: RemotePanelProps) {
  const [Remote, setRemote] = useState(() => lazyRemote(loader, name));
  const label = LABELS[name];
  return (
    <div className={styles.panel} data-panel={name}>
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <PanelFailed
            label={label}
            error={error}
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
