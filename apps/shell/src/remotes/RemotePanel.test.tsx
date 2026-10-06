import type { RemoteAppProps } from '@baseline/host-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { testContext } from '../testing/hostContext';
import { RemotePanel } from './RemotePanel';
import type { RemoteApp, RemoteLoader } from './remoteLoader';

function FakeApp({ ctx }: RemoteAppProps) {
  return <p>Remote running for {ctx.activeUser.name}</p>;
}

function CrashingApp(): never {
  throw new Error('render exploded');
}

function fakeLoader(load: RemoteLoader['load']): RemoteLoader {
  return {
    load: rs.fn(load),
    getStatus: () => 'idle',
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
    const loader = fakeLoader(() => new Promise<RemoteApp>((r) => (resolve = r)));
    render(<RemotePanel name="people" ctx={testContext()} loader={loader} />);

    expect(screen.getByText(/Loading People/)).toBeInTheDocument();
    resolve(FakeApp);
    expect(await screen.findByText('Remote running for Demo Planner')).toBeInTheDocument();
  });

  it('shows an in-place error with a retry when the load fails, leaving siblings alone', async () => {
    const user = userEvent.setup();
    silenceConsoleError();
    let healthy = false;
    const loader = fakeLoader(() => (healthy ? Promise.resolve(FakeApp) : Promise.reject(new Error('script 404'))));
    render(
      <>
        <button type="button">Nav still works</button>
        <RemotePanel name="people" ctx={testContext()} loader={loader} />
      </>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('People could not be shown.');
    expect(screen.getByRole('alert')).toHaveTextContent('script 404');
    expect(screen.getByRole('button', { name: 'Nav still works' })).toBeEnabled();

    healthy = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Remote running for Demo Planner')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the same in-place error when the remote throws while rendering', async () => {
    silenceConsoleError();
    render(<RemotePanel name="delivery" ctx={testContext()} loader={fakeLoader(() => Promise.resolve(CrashingApp))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Delivery could not be shown.');
    expect(screen.getByRole('alert')).toHaveTextContent('render exploded');
  });
});
