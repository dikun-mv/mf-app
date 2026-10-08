import { describe, expect, it } from '@rstest/core';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedProjects } from '../../../shared/testing';
import { ProjectPickerScreen } from './ProjectPickerScreen';

describe('ProjectPickerScreen', () => {
  it('lists the projects with their dates and months (screens 3.1)', async () => {
    renderWithApp(<ProjectPickerScreen />, { repository: createFakeRepository({ projects: seedProjects() }) });

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Projects' });
    const rows = within(table)
      .getAllByRole('row')
      .map((row) => Array.from(row.children).map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['Name', 'Dates', 'Months'],
      ['Ledger Consolidation', '1 Mar 2026 – 28 Feb 2027', '12'],
      ['Reporting Platform', '1 Apr 2026 – 31 Mar 2027', '12'],
      ['Client Portal Rebuild', '1 Jun 2026 – 31 Mar 2027', '10'],
      ['Warehouse Data Migration', '1 Apr 2026 – 31 Dec 2026', '9'],
    ]);
  });

  it('links each name to the project’s page', async () => {
    renderWithApp(<ProjectPickerScreen />, { repository: createFakeRepository({ projects: seedProjects() }) });
    expect(await screen.findByRole('link', { name: 'Ledger Consolidation' })).toHaveAttribute('href', '/prj-1');
    expect(screen.getByRole('link', { name: 'Warehouse Data Migration' })).toHaveAttribute('href', '/prj-4');
  });

  it('shows the heading and a loading line while the projects load', async () => {
    const repository = createFakeRepository({ projects: seedProjects() });
    const release = repository.holdReads('projects');
    renderWithApp(<ProjectPickerScreen />, { repository });

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('Loading projects…')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    act(() => {
      release();
    });
    expect(await screen.findByRole('table', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByText('Loading projects…')).not.toBeInTheDocument();
  });

  it('says the projects could not be loaded, and Try again loads them', async () => {
    const repository = createFakeRepository({ projects: seedProjects() });
    repository.failReads('projects', new RepositoryError('unavailable', 'delivery'));
    renderWithApp(<ProjectPickerScreen />, { repository });
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Projects couldn't be loaded: the Delivery service didn't respond.",
    );
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();

    repository.failReads('projects', null);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Ledger Consolidation' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
