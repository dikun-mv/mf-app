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
