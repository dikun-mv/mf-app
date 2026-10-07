import { ErrorBoundary } from '@baseline/ui';
import { describe, expect, it } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, employee, renderWithApp } from '../../../shared/testing';
import { useEmployees } from './useEmployees';

function Employees() {
  const { data, isPending, isError } = useEmployees();
  if (isPending) return <p>waiting for people</p>;
  if (isError) return <p>people unavailable</p>;
  return <p>{data.map(({ name }) => name).join(', ')}</p>;
}

// A boundary and a Suspense that must never be reached: the other team's data doesn't use them (D32).
const unreached = (children: ReactNode) => (
  <ErrorBoundary fallback={() => <p>boundary reached</p>}>
    <Suspense fallback={<p>suspense reached</p>}>{children}</Suspense>
  </ErrorBoundary>
);

describe('useEmployees', () => {
  it('is pending without suspending, then shows the employees', async () => {
    const repository = createFakeRepository({ employees: [employee('emp-001', 'Adaeze Okafor')] });
    const release = repository.holdReads('employees');
    renderWithApp(unreached(<Employees />), { repository });
    expect(screen.getByText('waiting for people')).toBeInTheDocument();
    expect(screen.queryByText('suspense reached')).not.toBeInTheDocument();

    act(() => {
      release();
    });
    expect(await screen.findByText('Adaeze Okafor')).toBeInTheDocument();
  });

  it('reports a failed load without throwing', async () => {
    const repository = createFakeRepository();
    repository.failReads('employees', new RepositoryError('unavailable', 'people'));
    renderWithApp(unreached(<Employees />), { repository });
    expect(await screen.findByText('people unavailable')).toBeInTheDocument();
    expect(screen.queryByText('boundary reached')).not.toBeInTheDocument();
  });
});
