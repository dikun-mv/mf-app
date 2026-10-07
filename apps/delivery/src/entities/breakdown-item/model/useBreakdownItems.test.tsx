import { describe, expect, it } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { createFakeRepository, item, renderWithApp } from '../../../shared/testing';
import { useBreakdownItems } from './useBreakdownItems';

function Names() {
  return (
    <p>
      {useBreakdownItems()
        .map(({ name }) => name)
        .join(' > ')}
    </p>
  );
}

describe('useBreakdownItems', () => {
  it('suspends until the tree is loaded, then shows it in creation order, a root’s parent as null', async () => {
    const repository = createFakeRepository({
      breakdownItems: [item('wbs-1', 'prj-1', null, 'Ledger migration'), item('wbs-2', 'prj-1', 'wbs-1', 'Discovery')],
    });
    const release = repository.holdReads('breakdownItems');
    renderWithApp(
      <Suspense fallback={<p>loading</p>}>
        <Names />
      </Suspense>,
      { repository },
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
    act(() => {
      release();
    });
    expect(await screen.findByText('Ledger migration > Discovery')).toBeInTheDocument();
  });
});
