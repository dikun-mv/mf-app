import type { RemoteAppProps } from '@baseline/host-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoteLoadTimeoutError, type RemoteApp, type RemoteLoader } from '../../../shared/federation';
import { testContext } from '../../../shared/testing';
import { RemotePanel } from './RemotePanel';

const ENTRY = 'http://localhost/remotes/people/remoteEntry.js';

function FakeApp({ ctx }: RemoteAppProps) {
  return <p>Remote running for {ctx.activeUser.name}</p>;
}

function CrashingApp(): never {
  throw new Error('render exploded');
}

/** A loader whose status is whatever `status()` says at the moment the panel asks, as the real one's is. */
function fakeLoader(load: RemoteLoader['load'], status: () => ReturnType<RemoteLoader['getStatus']>): RemoteLoader {
  return {
    load: rs.fn(load),
    getStatus: status,
    getSnapshot: () => '',
    subscribe: () => () => undefined,
  };
}

// React logs caught errors to the console; keep the test output readable.
function silenceConsoleError(): void {
  rs.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('RemotePanel', () => {
  it('shows a spinner while loading, then the remote with its context', async () => {
    let resolve: (app: RemoteApp) => void = () => undefined;
    const loader = fakeLoader(
      () => new Promise<RemoteApp>((r) => (resolve = r)),
      () => 'loading',
    );
    render(<RemotePanel name="people" ctx={testContext()} loader={loader} entry={ENTRY} />);

    expect(screen.getByText(/Loading People…/)).toBeInTheDocument();
    resolve(FakeApp);
    expect(await screen.findByText('Remote running for Demo Planner')).toBeInTheDocument();
  });

  it('says which file did not load and why, that the rest still works, and offers Try again', async () => {
    const user = userEvent.setup();
    silenceConsoleError();
    let healthy = false;
    const loader = fakeLoader(
      () => (healthy ? Promise.resolve(FakeApp) : Promise.reject(new RemoteLoadTimeoutError('people', 10_000))),
      () => (healthy ? 'ready' : 'failed'),
    );
    render(
      <>
        <button type="button">Nav still works</button>
        <RemotePanel name="people" ctx={testContext()} loader={loader} entry={ENTRY} />
      </>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("People couldn't load");
    expect(alert).toHaveTextContent("/remotes/people/remoteEntry.js didn't load (timed out).");
    expect(alert).toHaveTextContent('The rest of Baseline still works.');
    expect(screen.getByRole('button', { name: 'Nav still works' })).toBeEnabled();

    healthy = true;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Remote running for Demo Planner')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('gives the error text as the reason when the failure was not a timeout', async () => {
    silenceConsoleError();
    const loader = fakeLoader(
      () => Promise.reject(new Error('script 404')),
      () => 'failed',
    );
    render(<RemotePanel name="delivery" ctx={testContext()} loader={loader} entry={ENTRY} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("didn't load (script 404).");
  });

  it('says the remote stopped working, not that it failed to load, when it throws while rendering', async () => {
    silenceConsoleError();
    const loader = fakeLoader(
      () => Promise.resolve(CrashingApp),
      () => 'ready',
    );
    render(<RemotePanel name="delivery" ctx={testContext()} loader={loader} entry={ENTRY} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Delivery stopped working');
    expect(alert).toHaveTextContent('render exploded');
    expect(alert).not.toHaveTextContent("couldn't load");
  });
});
