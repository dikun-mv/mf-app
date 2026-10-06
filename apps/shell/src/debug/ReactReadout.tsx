import { useSyncExternalStore } from 'react';
import { useShell } from '../ShellContext';
import { probeRows } from './reactProbe';
import styles from './ReactReadout.module.css';

/**
 * The singleton proof (T2.7): the React version each app reports and whether its `react` and
 * `react-dom` are the shell's own instances. It re-renders when a remote finishes loading, because
 * that is when the remote writes its probe.
 */
export function ReactReadout() {
  const { loader } = useShell();
  useSyncExternalStore(loader.subscribe, loader.getSnapshot);
  const rows = probeRows(window.__BASELINE_REACT__);
  const allSame = rows.every((row) => row.sameAsShell);
  return (
    <section className={styles.readout} aria-label="React singleton check" data-testid="react-readout">
      <h2 className={styles.heading}>React singleton</h2>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.app}>
            {row.app}: React {row.reactVersion}, react-dom {row.reactDomVersion}
            {row.app === 'shell' ? '' : row.sameAsShell ? ' (same instance as shell)' : ' (DIFFERENT instance)'}
          </li>
        ))}
      </ul>
      <p className={styles.verdict}>
        {rows.length > 1 ? (allSame ? 'One React across all loaded apps.' : 'More than one React on the page.') : null}
      </p>
    </section>
  );
}
