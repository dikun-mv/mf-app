import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithApp } from '../../shared/testing';
import { routes } from './routes';

function renderAt(route: string) {
  return renderWithApp(routes, { route });
}

describe('People routes', () => {
  it('goes register, detail, and back', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();

    await user.click(await screen.findByRole('link', { name: 'Milan Brandt' }));
    expect(await screen.findByRole('heading', { name: 'Milan Brandt' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/emp-003');

    await user.click(screen.getByRole('link', { name: 'All employees' }));
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('renders an inline "not found" for an invalid employee id', () => {
    renderAt('/not-an-id');
    expect(screen.getByText('Employee not found: there is no employee "not-an-id".')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders an inline "not found" for an unknown path', () => {
    renderAt('/emp-003/unknown/deeper');
    expect(screen.getByText(/this page does not exist/i)).toBeInTheDocument();
  });
});
