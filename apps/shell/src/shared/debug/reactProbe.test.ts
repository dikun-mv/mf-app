import { describe, expect, it } from '@rstest/core';
import { summarizeProbes, type ProbeRow } from './reactProbe';

const shell: ProbeRow = { app: 'shell', reactVersion: '18.3.1', reactDomVersion: '18.3.1', sameAsShell: true };
const people: ProbeRow = { app: 'people', reactVersion: '18.3.1', reactDomVersion: '18.3.1', sameAsShell: true };

describe('summarizeProbes', () => {
  it('has no verdict while only the shell has reported', () => {
    expect(summarizeProbes([shell])).toMatchObject({ versions: '18.3.1', oneCopy: null });
  });

  it('says one copy when every app holds the shell’s react', () => {
    const summary = summarizeProbes([shell, people, { ...people, app: 'delivery' }]);
    expect(summary.oneCopy).toBe(true);
    expect(summary.versions).toBe('18.3.1');
  });

  it('says more than one copy when any app holds its own, and lists the versions', () => {
    const summary = summarizeProbes([shell, { ...people, reactVersion: '18.2.0', sameAsShell: false }]);
    expect(summary.oneCopy).toBe(false);
    expect(summary.versions).toBe('18.3.1 / 18.2.0');
  });

  it('describes each app on its own line', () => {
    const summary = summarizeProbes([shell, people, { ...people, app: 'delivery', sameAsShell: false }]);
    expect(summary.detail.split('\n')).toEqual([
      'shell: React 18.3.1, react-dom 18.3.1',
      "people: React 18.3.1, react-dom 18.3.1, the shell's copy",
      'delivery: React 18.3.1, react-dom 18.3.1, its own copy',
    ]);
  });
});
