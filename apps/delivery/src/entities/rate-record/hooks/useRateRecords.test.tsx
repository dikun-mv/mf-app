import { describe, expect, it } from '@rstest/core';
import { screen } from '@testing-library/react';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, rate, renderWithApp } from '../../../shared/testing';
import { useRateRecords } from './useRateRecords';

function Rates() {
  const { data, isPending, isError } = useRateRecords();
  if (isPending) return <p>waiting for rates</p>;
  if (isError) return <p>rates unavailable</p>;
  return <p>{data.map(({ id, hourlyCost }) => `${id}: ${String(hourlyCost)}`).join(', ')}</p>;
}

describe('useRateRecords', () => {
  it('shows the rates, or reports a failed load without throwing', async () => {
    const repository = createFakeRepository({ rateRecords: [rate('rate-001', 'emp-001', '2025-01-01', 80)] });
    const first = renderWithApp(<Rates />, { repository });
    expect(await screen.findByText('rate-001: 80')).toBeInTheDocument();
    first.unmount();

    const failing = createFakeRepository();
    failing.failReads('rateRecords', new RepositoryError('server', 'people'));
    renderWithApp(<Rates />, { repository: failing });
    expect(await screen.findByText('rates unavailable')).toBeInTheDocument();
  });
});
