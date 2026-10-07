import { probeRows, summarizeProbes } from '../../../shared/debug';
import styles from './ReactReadout.module.css';

/**
 * The singleton proof (T2.7, T4.4): the React version on the page and whether every app that has loaded
 * holds the shell's own `react` and `react-dom`. The per-app versions are in the tooltip. It is rendered
 * by the status strip, which re-renders when a remote finishes loading, because that is when the remote
 * writes its probe.
 */
export function ReactReadout() {
  const { versions, oneCopy, detail } = summarizeProbes(probeRows(window.__BASELINE_REACT__));
  return (
    <p className={styles.readout} title={detail} data-testid="react-readout">
      React {versions}
      {oneCopy === null ? null : oneCopy ? (
        <>
          {' · '}
          <span className={styles.good}>
            one copy <span aria-hidden="true">✓</span>
          </span>
        </>
      ) : (
        <>
          {' · '}
          <span className={styles.bad}>
            more than one copy <span aria-hidden="true">✕</span>
          </span>
        </>
      )}
    </p>
  );
}
