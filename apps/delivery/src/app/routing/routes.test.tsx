import { describe, expect, it } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { HostContextProvider } from '../../shared/lib';
import { testContext } from '../../shared/testing';
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

describe('Delivery routes', () => {
  it('goes project picker, project, and back', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    expect(screen.getByRole('heading', { name: /project picker/i })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Open prj-1' }));
    expect(screen.getByRole('heading', { name: /Project prj-1/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/prj-1');

    await user.click(screen.getByRole('link', { name: /Back to the project picker/ }));
    expect(screen.getByRole('heading', { name: /project picker/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('renders an inline "not found" for an invalid project id', () => {
    renderAt('/not-an-id');
    expect(screen.getByText(/not a valid project id/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Project/ })).not.toBeInTheDocument();
  });

  it('renders an inline "not found" for an unknown path', () => {
    renderAt('/prj-1/unknown/deeper');
    expect(screen.getByText(/this page does not exist/i)).toBeInTheDocument();
  });

  it('keeps component state across a click, through the shared React', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /Clicked 0 times/ }));
    expect(screen.getByRole('button', { name: /Clicked 1 times/ })).toBeInTheDocument();
  });
});
