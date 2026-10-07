import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeRepository, renderWithApp, seedProjects } from '../../shared/testing';
import { routes } from './routes';

const renderAt = (route: string) =>
  renderWithApp(routes, { route, repository: createFakeRepository({ projects: seedProjects() }) });

describe('Delivery routes', () => {
  it('goes from the projects to a project and back', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();

    await user.click(await screen.findByRole('link', { name: 'Ledger Consolidation' }));
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/prj-1');

    await user.click(screen.getByRole('link', { name: 'Projects' }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('opens a project from its URL, as a reload does', async () => {
    renderAt('/prj-3');
    expect(await screen.findByRole('heading', { name: 'Client Portal Rebuild' })).toBeInTheDocument();
  });

  it('renders an inline "not found" for an unknown project', async () => {
    renderAt('/prj-9');
    expect(await screen.findByText(/there is no project "prj-9"/)).toBeInTheDocument();
  });

  it('renders an inline "not found" for an unknown path', () => {
    renderAt('/prj-1/unknown/deeper');
    expect(screen.getByText(/this page does not exist/i)).toBeInTheDocument();
  });
});
