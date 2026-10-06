import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { HostContextProvider } from '../host/HostContextProvider';
import { testContext } from '../testing/hostContext';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <HostContextProvider ctx={testContext()}>
      <RouterProvider router={router} />
    </HostContextProvider>,
  );
  return router;
}

describe('People routes', () => {
  it('goes register, detail, and back', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Open emp-003' }));
    expect(screen.getByRole('heading', { name: /Employee emp-003/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/emp-003');

    await user.click(screen.getByRole('link', { name: /Back to the register/ }));
    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('renders an inline "not found" for an invalid employee id', () => {
    renderAt('/not-an-id');
    expect(screen.getByText(/not a valid employee id/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Employee/ })).not.toBeInTheDocument();
  });

  it('renders an inline "not found" for an unknown path', () => {
    renderAt('/emp-003/unknown/deeper');
    expect(screen.getByText(/this page does not exist/i)).toBeInTheDocument();
  });

  it('keeps component state across a click, through the shared React', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /Clicked 0 times/ }));
    expect(screen.getByRole('button', { name: /Clicked 1 times/ })).toBeInTheDocument();
  });
});
