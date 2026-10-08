import { describe, expect, it, rs } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData, seedProjects } from '../../../shared/testing';
import { ProjectScreen } from './ProjectScreen';

const renderAt = (route: string, repository = createFakeRepository({ projects: seedProjects() })) =>
  renderWithApp(<ProjectScreen />, { repository, route, path: ':projectId' });

describe('ProjectScreen', () => {
  it('shows the project’s name and dates under a link back to the projects', async () => {
    renderAt('/prj-1');
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
    expect(screen.getByText('1 Mar 2026 – 28 Feb 2027')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/');
  });

  it('shows the staffing grid under the header (screens 3.2)', async () => {
    renderWithApp(<ProjectScreen />, {
      repository: createFakeRepository(seedData()),
      route: '/prj-1',
      path: ':projectId',
    });
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
    expect(
      await screen.findByRole('table', { name: 'Staffing grid for Ledger Consolidation, in person-months' }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole('rowheader', { name: 'Adaeze Okafor' })).not.toHaveLength(0);
  });

  it('starts each project’s grid fresh: a node collapsed in one is open again on coming back', async () => {
    const { router } = renderWithApp(<ProjectScreen />, {
      repository: createFakeRepository(seedData()),
      route: '/prj-1',
      path: ':projectId',
    });
    const user = userEvent.setup();
    const toggle = async () => (await screen.findAllByRole('button', { name: 'Discovery' }))[0] as HTMLElement;

    await user.click(await toggle());
    expect(await toggle()).toHaveAttribute('aria-expanded', 'false');

    await act(() => router.navigate('/prj-2'));
    expect(await screen.findByRole('heading', { name: 'Reporting Platform' })).toBeInTheDocument();
    await act(() => router.navigate('/prj-1'));
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
    expect(await toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the header while the grid’s allocations load', async () => {
    const repository = createFakeRepository(seedData());
    const release = repository.holdReads('allocations');
    renderWithApp(<ProjectScreen />, { repository, route: '/prj-1', path: ':projectId' });

    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
    expect(screen.getByText('Loading staffing grid…')).toBeInTheDocument();
    act(() => {
      release();
    });
    expect(await screen.findByRole('table', { name: /Staffing grid/ })).toBeInTheDocument();
  });

  it('says there is no such project for an id nobody has (screens 3.7)', async () => {
    renderAt('/prj-9');
    expect(await screen.findByText('Project not found: there is no project "prj-9".')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('says so for an id that cannot be a project’s without reading any data', () => {
    const repository = createFakeRepository({ projects: seedProjects() });
    const list = rs.spyOn(repository, 'list');
    renderAt('/not-an-id', repository);
    expect(screen.getByText('Project not found: there is no project "not-an-id".')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it('keeps the back link and shows a loading line while the projects load', async () => {
    const repository = createFakeRepository({ projects: seedProjects() });
    const release = repository.holdReads('projects');
    renderAt('/prj-1', repository);

    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('Loading project…')).toBeInTheDocument();

    act(() => {
      release();
    });
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
  });

  it('says the project could not be loaded, and Try again loads it', async () => {
    const repository = createFakeRepository({ projects: seedProjects() });
    repository.failReads('projects', new RepositoryError('server', 'delivery'));
    renderAt('/prj-1', repository);
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Project couldn't be loaded: the Delivery service reported an error.",
    );
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();

    repository.failReads('projects', null);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Ledger Consolidation' })).toBeInTheDocument();
  });
});
