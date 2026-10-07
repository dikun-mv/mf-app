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

/**
 * A short, plain reason for a failed load. The Federation runtime's own message (an error code, a JSON of
 * arguments, a docs link) is too long and means nothing to a user, so it is never shown in the text; it stays
 * in the `title` and in the console.
 */
function loadReason(error: unknown): string {
  return error instanceof RemoteLoadTimeoutError ? 'timed out' : 'not found or not reachable';
}

function rawMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Screens 1.2: the failure in the panel's place. It says what failed, that the rest still works, and offers a retry. */
export function PanelFailed({ label, entry, error, loadFailed, onRetry }: PanelFailedProps) {
  return (
    <InlineMessage tone="error" className={styles.failed}>
      <div className={styles.text}>
        <p className={styles.title}>{loadFailed ? `${label} couldn't load` : `${label} stopped working`}</p>
        <p className={styles.detail} title={rawMessage(error)}>
          {loadFailed
            ? `${displayUrl(entry, window.location.origin)} didn't load (${loadReason(error)}).`
            : `It hit an error while showing this page (${rawMessage(error)}).`}{' '}
          The rest of Baseline still works.
        </p>
      </div>
      <Button onClick={onRetry}>Try again</Button>
    </InlineMessage>
  );
}
