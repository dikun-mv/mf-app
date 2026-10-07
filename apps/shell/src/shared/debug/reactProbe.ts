import { useState, version as reactVersion } from 'react';
import { flushSync, version as reactDomVersion } from 'react-dom';

/**
 * What one app saw when it imported react and react-dom (T2.7). Each app writes its probe into a
 * page-wide registry; the shell compares the function references. If react is a singleton, every
 * app holds the very same `useState` and `flushSync`.
 */
export interface ReactProbe {
  readonly reactVersion: string;
  readonly reactDomVersion: string;
  readonly useState: unknown;
  readonly flushSync: unknown;
}

declare global {
  interface Window {
    __BASELINE_REACT__?: Record<string, ReactProbe>;
  }
}

const own: ReactProbe = { reactVersion, reactDomVersion, useState, flushSync };

/** Records the shell's own react in the registry, next to the remotes'. */
export function reportShellReact(): void {
  (window.__BASELINE_REACT__ ??= {})['shell'] = own;
}

export interface ProbeRow {
  readonly app: string;
  readonly reactVersion: string;
  readonly reactDomVersion: string;
  /** True when this app's react and react-dom are the shell's own instances. */
  readonly sameAsShell: boolean;
}

/** One row per app that has reported, the shell first. */
export function probeRows(registry: Record<string, ReactProbe> | undefined): ProbeRow[] {
  return Object.entries(registry ?? {})
    .map(([app, probe]) => ({
      app,
      reactVersion: probe.reactVersion,
      reactDomVersion: probe.reactDomVersion,
      sameAsShell: probe.useState === own.useState && probe.flushSync === own.flushSync,
    }))
    .sort((a, b) => (a.app === 'shell' ? -1 : b.app === 'shell' ? 1 : a.app.localeCompare(b.app)));
}

export interface ReactReadoutSummary {
  /** The distinct React versions on the page, the shell's first: `18.3.1`. */
  readonly versions: string;
  /** Whether every app that has reported holds the shell's own `react` and `react-dom`; `null` until a remote has reported. */
  readonly oneCopy: boolean | null;
  /** One line per app, for a tooltip. */
  readonly detail: string;
}

/** What the status strip shows (T4.4): the version, and whether it is one copy across the apps loaded so far. */
export function summarizeProbes(rows: readonly ProbeRow[]): ReactReadoutSummary {
  const versions = [...new Set(rows.map((row) => row.reactVersion))].join(' / ');
  const detail = rows
    .map((row) => {
      const copy = row.app === 'shell' ? '' : row.sameAsShell ? ", the shell's copy" : ', its own copy';
      return `${row.app}: React ${row.reactVersion}, react-dom ${row.reactDomVersion}${copy}`;
    })
    .join('\n');
  return { versions, oneCopy: rows.length > 1 ? rows.every((row) => row.sameAsShell) : null, detail };
}
