import { describe, expect, it } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { allocation, createFakeRepository, renderWithApp } from '../../../shared/testing';
import { useAllocations } from './useAllocations';

function Amounts() {
  return (
    <p>
      {useAllocations()
        .map(({ id, amount }) => `${id}: ${String(amount)}`)
        .join(', ')}
    </p>
  );
}

describe('useAllocations', () => {
  it('suspends until the allocations are loaded, then shows them', async () => {
    const repository = createFakeRepository({
      allocations: [allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5)],
    });
    const release = repository.holdReads('allocations');
    renderWithApp(
      <Suspense fallback={<p>loading</p>}>
        <Amounts />
      </Suspense>,
      { repository },
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
    act(() => {
      release();
    });
    expect(await screen.findByText('alloc-1: 0.5')).toBeInTheDocument();
  });
});
