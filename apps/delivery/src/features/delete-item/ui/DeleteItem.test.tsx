import { BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { DeleteItem } from './DeleteItem';

// Ledger Consolidation › Ledger migration › Discovery: Design (18 allocations) and Rework (6) under it.
const DISCOVERY = BreakdownItemId.parse('wbs-004');

function setup(itemId = DISCOVERY) {
  const data = seedData();
  const state: PlanState = { projects: data.projects, items: data.breakdownItems, allocations: data.allocations };
  const repository = createFakeRepository(data);
  const report = { done: rs.fn(), failed: rs.fn() };
  const onClose = rs.fn();
  renderWithApp(<DeleteItem state={state} itemId={itemId} report={report} onClose={onClose} />, { repository });
  return { repository, report, onClose, user: userEvent.setup() };
}

describe('DeleteItem', () => {
  it('counts the items and allocations that go before anything is deleted', async () => {
    const { repository } = setup();
    const dialog = await screen.findByRole('dialog', { name: 'Delete "Discovery"?' });
    expect(dialog).toHaveTextContent('This deletes 3 items (Discovery, Design, Rework) and their 24 allocations.');
    expect(dialog).toHaveTextContent("It can't be undone.");
    expect(repository.written).toHaveLength(0);
  });

  it('deletes the subtree and its allocations in one change set, and reports the counts', async () => {
    const { user, repository, report, onClose } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith('Deleted 3 items and 24 allocations.');
    });
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(1);
    const names = repository.stored('breakdownItems').map((stored) => stored.id);
    for (const id of ['wbs-004', 'wbs-012', 'wbs-020']) expect(names).not.toContain(id);
    // Only those items' allocations went: 24 of the seed's, the 18 of Design and the 6 of Rework.
    expect(repository.stored('allocations')).toHaveLength(seedData().allocations.length - 24);
  });

  it('keeps everything when cancelled', async () => {
    const { user, repository, report, onClose } = setup();
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
    expect(report.done).not.toHaveBeenCalled();
  });

  it('hands a refused write to the widget instead of reporting counts', async () => {
    const { user, repository, report } = setup();
    const error = new RepositoryError('unavailable', 'delivery');
    repository.failWrites(error);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(report.failed).toHaveBeenCalledWith(error);
    });
    expect(report.done).not.toHaveBeenCalled();
    expect(repository.stored('breakdownItems').map((stored) => stored.id)).toContain('wbs-004');
  });
});
