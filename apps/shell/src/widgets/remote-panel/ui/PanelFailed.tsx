import { Button, InlineMessage } from '@baseline/ui';
import { RemoteLoadTimeoutError } from '../../../shared/federation';
import { displayUrl } from '../../../shared/lib';
import styles from './PanelFailed.module.css';

interface PanelFailedProps {
  label: string;
  /** Where the remote's `remoteEntry.js` was fetched from. */
  entry: string;
  error: unknown;
  /** True when the remote's code never arrived; false when it arrived and then threw while rendering. */
  loadFailed: boolean;
  onRetry: () => void;
}

function reason(error: unknown): string {
  if (error instanceof RemoteLoadTimeoutError) return 'timed out';
  return error instanceof Error ? error.message : 'unknown error';
}

/** Screens 1.2: the failure in the panel's place. It says what failed, that the rest still works, and offers a retry. */
export function PanelFailed({ label, entry, error, loadFailed, onRetry }: PanelFailedProps) {
  return (
    <InlineMessage tone="error" className={styles.failed}>
      <div className={styles.text}>
        <p className={styles.title}>{loadFailed ? `${label} couldn't load` : `${label} stopped working`}</p>
        <p className={styles.detail}>
          {loadFailed
            ? `${displayUrl(entry, window.location.origin)} didn't load (${reason(error)}).`
            : `It hit an error while showing this page (${reason(error)}).`}{' '}
          The rest of Baseline still works.
        </p>
      </div>
      <Button onClick={onRetry}>Try again</Button>
    </InlineMessage>
  );
}
