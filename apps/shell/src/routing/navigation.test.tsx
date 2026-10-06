import { afterEach, describe, expect, it, rs } from '@rstest/core';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { Nav } from '../layout/Nav';
import { useShellNavigate } from './navigation';

// A stand-in for the mounted remote's router: it re-reads the URL on `popstate`.
function listenForPopState() {
  const seen: string[] = [];
  const listener = (): void => {
    seen.push(window.location.pathname);
  };
  window.addEventListener('popstate', listener);
  return {
    seen,
    stop: () => {
      window.removeEventListener('popstate', listener);
    },
  };
}

function Frame() {
  return (
    <>
      <Nav />
      <Outlet />
    </>
  );
}

function GoToDetail() {
  const navigate = useShellNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        navigate('/people/emp-003');
      }}
    >
      Open detail
    </button>
  );
}

function renderShell(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Frame />,
        children: [{ path: '*', element: <GoToDetail /> }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('shell navigation', () => {
  afterEach(() => {
    rs.restoreAllMocks();
  });

  it('dispatches popstate after its own navigation, with the router already updated', async () => {
    const user = userEvent.setup();
    const probe = listenForPopState();
    const router = renderShell('/people');

    await user.click(screen.getByRole('button', { name: 'Open detail' }));
    probe.stop();

    expect(router.state.location.pathname).toBe('/people/emp-003');
    expect(probe.seen).toHaveLength(1);
  });

  it('sends the nav links through the same function', async () => {
    const user = userEvent.setup();
    const probe = listenForPopState();
    const router = renderShell('/people/emp-003');

    await user.click(screen.getByRole('link', { name: 'Delivery' }));
    probe.stop();

    expect(router.state.location.pathname).toBe('/delivery');
    expect(probe.seen).toHaveLength(1);
  });

  it('marks the item of the first path segment as current, also after back', async () => {
    const user = userEvent.setup();
    const router = renderShell('/people/emp-003');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Delivery' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('link', { name: 'Delivery' }));
    expect(screen.getByRole('link', { name: 'Delivery' })).toHaveAttribute('aria-current', 'page');

    await act(() => router.navigate(-1));
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves modified clicks to the browser', async () => {
    const user = userEvent.setup();
    const router = renderShell('/people');
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Delivery' }));
    await user.keyboard('{/Control}');
    expect(router.state.location.pathname).toBe('/people');
  });
});
