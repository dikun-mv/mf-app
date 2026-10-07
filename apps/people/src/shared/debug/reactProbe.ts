import { version as reactVersion, useState } from 'react';
import { flushSync, version as reactDomVersion } from 'react-dom';

/**
 * What one app saw when it imported react and react-dom (T2.7). The shell compares the function
 * references: if react is a singleton, every app holds the very same `useState` and `flushSync`.
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

/** Records this app's react in a page-wide registry the shell's debug readout reads. */
export function reportReact(app: string): void {
  (window.__BASELINE_REACT__ ??= {})[app] = { reactVersion, reactDomVersion, useState, flushSync };
}
