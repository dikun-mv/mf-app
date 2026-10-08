import { ProjectId } from '@baseline/delivery-contract';
import { ErrorBoundary } from '@baseline/ui';
import { describe, expect, it } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, project, renderWithApp } from '../../../shared/testing';
import { useProject, useProjects } from './useProjects';

function Names() {
  return (
    <ul>
      {useProjects().map(({ id, name }) => (
        <li key={id}>{name}</li>
      ))}
    </ul>
  );
}

function One({ id }: { id: string }) {
  const found = useProject(ProjectId.parse(id));
  return <p>{found ? found.name : `no ${id}`}</p>;
}

const guarded = (children: ReactNode) => (
  <ErrorBoundary fallback={({ error }) => <p>failed: {error instanceof RepositoryError ? error.code : 'other'}</p>}>
    <Suspense fallback={<p>loading</p>}>{children}</Suspense>
  </ErrorBoundary>
);

const ledger = project('prj-1', 'Ledger Consolidation');
const portal = project('prj-3', 'Client Portal Rebuild');

describe('useProjects', () => {
  it('suspends until the projects are loaded, then shows them in order', async () => {
    const repository = createFakeRepository({ projects: [ledger, portal] });
    const release = repository.holdReads('projects');
    renderWithApp(guarded(<Names />), { repository });
    expect(screen.getByText('loading')).toBeInTheDocument();

    act(() => {
      release();
    });
    expect(await screen.findByText('Ledger Consolidation')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ledger Consolidation',
      'Client Portal Rebuild',
    ]);
  });

  it('throws a failed load to the error boundary', async () => {
    const repository = createFakeRepository();
    repository.failReads('projects', new RepositoryError('unavailable', 'delivery'));
    renderWithApp(guarded(<Names />), { repository });
    expect(await screen.findByText('failed: unavailable')).toBeInTheDocument();
  });
});

describe('useProject', () => {
  it('finds one project by id, and gives undefined for an id nobody has', async () => {
    const repository = createFakeRepository({ projects: [ledger, portal] });
    renderWithApp(
      guarded(
        <>
          <One id="prj-3" />
          <One id="prj-9" />
        </>,
      ),
      { repository },
    );
    expect(await screen.findByText('Client Portal Rebuild')).toBeInTheDocument();
    expect(screen.getByText('no prj-9')).toBeInTheDocument();
  });
});
