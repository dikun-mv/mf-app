import { BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryError } from '../../../shared/api';
import { allocation, createFakeRepository, item, project, renderWithApp, seedData } from '../../../shared/testing';
import { MoveItem } from './MoveItem';

function setup(state: PlanState, itemId: BreakdownItemId) {
  const repository = createFakeRepository({
    projects: state.projects,
    breakdownItems: state.items,
    allocations: state.allocations,
  });
  const report = { done: rs.fn(), failed: rs.fn() };
  const onClose = rs.fn();
  renderWithApp(<MoveItem state={state} itemId={itemId} report={report} onClose={onClose} />, { repository });
  return { repository, report, onClose, user: userEvent.setup() };
}

// Ledger Consolidation › Ledger migration › Discovery › Rework, in the seed.
const REWORK = BreakdownItemId.parse('wbs-020');
const seed = seedData();
const seedState: PlanState = { projects: seed.projects, items: seed.breakdownItems, allocations: seed.allocations };

describe('MoveItem', () => {
  it('lists the places in the open project only, with the reason beside each one that is refused', async () => {
    setup(seedState, REWORK);
    const dialog = await screen.findByRole('dialog', { name: 'Move "Rework"' });
    expect(within(dialog).getByText('New parent — Ledger Consolidation only')).toBeInTheDocument();

    const labels = within(dialog)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent);
    expect(labels).toContain('Top level');
    expect(labels).toContain('Ledger migration › Migration');
    // Nodes of Client Portal Rebuild and the other projects are not offered (D15).
    expect(labels.some((label) => label?.includes('Account management'))).toBe(false);
    expect(within(dialog).getByRole('radio', { name: /Ledger migration › Discovery\s*current parent/ })).toBeDisabled();
    expect(
      within(dialog).getByRole('radio', { name: /Discovery › Design\s*third level: can't take a child/ }),
    ).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: 'Ledger migration › Migration' })).toBeEnabled();
  });

  it('moves the item under the chosen parent and says where', async () => {
    const { user, repository, report, onClose } = setup(seedState, REWORK);
    await user.click(await screen.findByRole('radio', { name: 'Ledger migration › Migration' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith('Moved "Rework" under "Ledger migration › Migration".');
    });
    expect(onClose).toHaveBeenCalled();
    expect(repository.stored('breakdownItems').find((candidate) => candidate.id === REWORK)?.parentId).toBe('wbs-007');
  });

  it('moves an item to the top level', async () => {
    const { user, repository, report } = setup(seedState, REWORK);
    await user.click(await screen.findByRole('radio', { name: 'Top level' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith('Moved "Rework" to the top level.');
    });
    expect(repository.stored('breakdownItems').find((candidate) => candidate.id === REWORK)?.parentId).toBeNull();
  });

  it('hands a leaf’s allocations to the moved item and says so before and after (D9)', async () => {
    // Ledger migration › Data checks holds six allocations; Cut-over is an empty leaf beside it.
    const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
    const state: PlanState = {
      projects: [project('prj-1', 'Ledger Consolidation')],
      items: [
        item('wbs-1', 'prj-1', null, 'Ledger migration'),
        item('wbs-2', 'prj-1', 'wbs-1', 'Data checks'),
        item('wbs-3', 'prj-1', 'wbs-1', 'Cut-over'),
      ],
      allocations: months.map((month, at) => allocation(`alloc-${String(at)}`, 'wbs-2', 'emp-001', month, 0.5)),
    };
    const { user, repository, report } = setup(state, BreakdownItemId.parse('wbs-3'));
    await user.click(await screen.findByRole('radio', { name: 'Ledger migration › Data checks' }));
    expect(screen.getByText(/"Data checks" holds 6 allocations/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith(
        'Moved "Cut-over" under "Ledger migration › Data checks". 6 allocations moved from Data checks to Cut-over.',
      );
    });
    expect(repository.stored('allocations').every((stored) => stored.breakdownItemId === 'wbs-3')).toBe(true);
  });

  it('asks for a choice instead of sending nothing', async () => {
    const { user, repository, onClose } = setup(seedState, REWORK);
    await user.click(await screen.findByRole('button', { name: 'Move' }));
    expect(await screen.findByText('Choose a new parent')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
  });

  it('hands a refused write to the widget', async () => {
    const { user, repository, report } = setup(seedState, REWORK);
    const error = new RepositoryError('server', 'delivery');
    repository.failWrites(error);
    await user.click(await screen.findByRole('radio', { name: 'Top level' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(() => {
      expect(report.failed).toHaveBeenCalledWith(error);
    });
    expect(report.done).not.toHaveBeenCalled();
  });
});
