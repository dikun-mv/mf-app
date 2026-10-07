import { useSyncExternalStore } from 'react';
import { REMOTE_NAMES, type RemoteName } from '../../../shared/config';
import type { RemoteStatus } from '../../../shared/federation';
import { displayUrl, useShell } from '../../../shared/lib';
import { ReactReadout } from './ReactReadout';
import styles from './StatusStrip.module.css';

// The glyph repeats what the word says, so it is hidden from assistive technology.
const STATUS: Record<RemoteStatus, { glyph: string; word: string; className: string }> = {
  idle: { glyph: '○', word: 'not loaded', className: styles.idle },
  loading: { glyph: '◌', word: 'loading', className: styles.loading },
  ready: { glyph: '●', word: 'loaded', className: styles.ready },
  failed: { glyph: '✕', word: 'failed', className: styles.failed },
};

function RemoteLine({ name, status, entry }: { name: RemoteName; status: RemoteStatus; entry: string }) {
  const { glyph, word, className } = STATUS[status];
  return (
    <li className={styles.remote} data-remote={name}>
      <span className={styles.name}>{name}</span>{' '}
      <span className={className}>
        <span aria-hidden="true">{glyph} </span>
        {word}
      </span>{' '}
      <span className={styles.entry}>
        {status === 'ready' ? 'from ' : ''}
        <code className={styles.url}>{displayUrl(entry, window.location.origin)}</code>
      </span>
    </li>
  );
}

/**
 * The shell's status strip (screens 1.1, 1.2): each remote's load status and the `remoteEntry.js` URL it was
 * fetched from, which `config.json` supplied at runtime, and the React singleton readout.
 */
export function StatusStrip() {
  const { loader, remotes } = useShell();
  // The snapshot changes whenever any remote's status does; the statuses themselves are read below.
  useSyncExternalStore(loader.subscribe, loader.getSnapshot);
  return (
    <footer className={styles.strip} aria-label="Status">
      <ul className={styles.remotes}>
        {REMOTE_NAMES.map((name) => (
          <RemoteLine key={name} name={name} status={loader.getStatus(name)} entry={remotes[name]} />
        ))}
      </ul>
      <ReactReadout />
    </footer>
  );
}
