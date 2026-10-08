import { afterEach, describe, expect, it } from '@rstest/core';
import { act, render, screen, within } from '@testing-library/react';
import { version as reactVersion } from 'react';
import type { RemoteName } from '../../../shared/config';
import { reportShellReact } from '../../../shared/debug';
import type { RemoteLoader, RemoteStatus } from '../../../shared/federation';
import { fakeLoader } from '../../../shared/testing';
import { ShellContext } from '../../../shared/lib';
import { StatusStrip } from './StatusStrip';

const remotes = {
  people: `${window.location.origin}/remotes/people/remoteEntry.js`,
  delivery: 'http://localhost:3020/remoteEntry.js',
};

/** A loader whose statuses a test can change, telling subscribers as the real one does. */
function steerableLoader(initial: Record<RemoteName, RemoteStatus>) {
  const status = { ...initial };
  const listeners = new Set<() => void>();
  let snapshot = 0;
  const loader: RemoteLoader = {
    ...fakeLoader(),
    getStatus: (name) => status[name],
    getSnapshot: () => String(snapshot),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    loader,
    set(name: RemoteName, next: RemoteStatus) {
      status[name] = next;
      snapshot += 1;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

function renderStrip(loader: RemoteLoader) {
  return render(
    <ShellContext.Provider value={{ loader, remotes, theme: 'default' }}>
      <StatusStrip />
    </ShellContext.Provider>,
  );
}

describe('StatusStrip', () => {
  afterEach(() => {
    delete window.__BASELINE_REACT__;
  });

  it('shows each remote with its status and the URL it was loaded from', () => {
    reportShellReact();
    renderStrip(steerableLoader({ people: 'ready', delivery: 'failed' }).loader);

    const people = screen.getByText('people').closest('li');
    const delivery = screen.getByText('delivery').closest('li');
    expect(people).toHaveTextContent('loaded from /remotes/people/remoteEntry.js');
    expect(delivery).toHaveTextContent('failed');
    expect(delivery).toHaveTextContent('http://localhost:3020/remoteEntry.js');
    expect(delivery).not.toHaveTextContent('from');
  });

  it('follows a remote through loading to loaded', () => {
    reportShellReact();
    const steer = steerableLoader({ people: 'idle', delivery: 'idle' });
    renderStrip(steer.loader);
    const people = (): HTMLElement => screen.getByText('people').closest('li') as HTMLElement;
    expect(within(people()).getByText(/not loaded/)).toBeInTheDocument();

    act(() => {
      steer.set('people', 'loading');
    });
    expect(within(people()).getByText(/loading/)).toBeInTheDocument();

    act(() => {
      steer.set('people', 'ready');
    });
    expect(within(people()).getByText(/loaded/)).toBeInTheDocument();
  });

  it('gives the React version without a verdict until a remote has reported', () => {
    reportShellReact();
    renderStrip(steerableLoader({ people: 'loading', delivery: 'loading' }).loader);
    expect(screen.getByTestId('react-readout')).toHaveTextContent(`React ${reactVersion}`);
    expect(screen.getByTestId('react-readout')).not.toHaveTextContent('copy');
  });

  it('says one copy when the remotes hold the shell’s react', () => {
    reportShellReact();
    const shell = window.__BASELINE_REACT__?.['shell'];
    if (!shell) throw new Error('the shell did not report');
    window.__BASELINE_REACT__ = { shell, people: shell, delivery: shell };
    renderStrip(steerableLoader({ people: 'ready', delivery: 'ready' }).loader);
    expect(screen.getByTestId('react-readout')).toHaveTextContent(`React ${reactVersion} · one copy`);
  });

  it('says more than one copy when a remote holds its own', () => {
    reportShellReact();
    const shell = window.__BASELINE_REACT__?.['shell'];
    if (!shell) throw new Error('the shell did not report');
    window.__BASELINE_REACT__ = { shell, people: { ...shell, useState: () => undefined } };
    renderStrip(steerableLoader({ people: 'ready', delivery: 'loading' }).loader);
    expect(screen.getByTestId('react-readout')).toHaveTextContent('more than one copy');
  });
});
