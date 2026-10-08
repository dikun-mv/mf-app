import { BreakdownItemId, ProjectId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { RepositoryError } from '../../../shared/api';
import { allocation, createFakeRepository, item, project, renderWithApp } from '../../../shared/testing';
import { AddChildItem } from './AddChildItem';
import { AddTopLevelItem } from './AddTopLevelItem';

const PROJECT = ProjectId.parse('prj-1');
const LEDGER = BreakdownItemId.parse('wbs-1');
const DATA_CHECKS = BreakdownItemId.parse('wbs-2');
const EMPTY_LEAF = BreakdownItemId.parse('wbs-3');

// Ledger migration › Data checks (a leaf at the second level, with six allocations) and an empty leaf.
const MONTHS = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const state: PlanState = {
  projects: [project('prj-1', 'Ledger Consolidation')],
  items: [
    item('wbs-1', 'prj-1', null, 'Ledger migration'),
    item('wbs-2', 'prj-1', 'wbs-1', 'Data checks'),
    item('wbs-3', 'prj-1', 'wbs-1', 'Cut-over'),
  ],
  allocations: MONTHS.map((month, at) => allocation(`alloc-${String(at)}`, 'wbs-2', 'emp-001', month, 0.5)),
};

function setup(ui: (props: { report: { done: () => void; failed: () => void }; onClose: () => void }) => ReactElement) {
  const repository = createFakeRepository({
    projects: state.projects,
    breakdownItems: state.items,
    allocations: state.allocations,
  });
  const report = { done: rs.fn(), failed: rs.fn() };
  const onClose = rs.fn();
  renderWithApp(ui({ report, onClose }), { repository });
  return { repository, report, onClose, user: userEvent.setup() };
}

const addChild = (itemId: BreakdownItemId) =>
  setup(({ report, onClose }) => <AddChildItem state={state} itemId={itemId} report={report} onClose={onClose} />);

describe('AddChildItem', () => {
  it('says before anything changes that a leaf’s allocations move to the new item (D9)', async () => {
    const { user } = addChild(DATA_CHECKS);
    const dialog = await screen.findByRole('dialog', { name: 'Add an item under "Data checks"' });
    // The notice names the new item as it is typed.
    expect(within(dialog).getByText(/holds 6 allocations/)).toHaveTextContent(
      '"Data checks" holds 6 allocations. Only leaves hold allocations, so they move to "the new item".',
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Reconciliation');
    expect(within(dialog).getByText(/holds 6 allocations/)).toHaveTextContent(
      '"Data checks" holds 6 allocations. Only leaves hold allocations, so they move to "Reconciliation".',
    );
  });

  it('adds the item and moves the allocations onto it in one change set, then reports both', async () => {
    const { user, repository, report, onClose } = addChild(DATA_CHECKS);
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Reconciliation');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith(
        'Added "Reconciliation". 6 allocations moved from Data checks to Data checks › Reconciliation.',
      );
    });
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(1);
    const created = repository.stored('breakdownItems').find((candidate) => candidate.name === 'Reconciliation');
    expect(created?.parentId).toBe(DATA_CHECKS);
    // Every allocation now belongs to the new item; none is left on the parent.
    const stored = repository.stored('allocations');
    expect(stored).toHaveLength(6);
    expect(stored.every((allocation_) => allocation_.breakdownItemId === created?.id)).toBe(true);
  });

  it('has no notice, and nothing to move, under a leaf without allocations', async () => {
    const { user, repository, report } = addChild(EMPTY_LEAF);
    const dialog = await screen.findByRole('dialog', { name: 'Add an item under "Cut-over"' });
    expect(within(dialog).queryByText(/holds/)).not.toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Dry run{Enter}');
    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith('Added "Dry run".');
    });
    expect(repository.written[0]?.update.allocations).toHaveLength(0);
  });

  it('has no notice under an item that already has children', async () => {
    addChild(LEDGER);
    const dialog = await screen.findByRole('dialog', { name: 'Add an item under "Ledger migration"' });
    expect(within(dialog).queryByText(/holds/)).not.toBeInTheDocument();
  });

  it('asks for a name next to the field instead of sending an empty one', async () => {
    const { user, repository, onClose } = addChild(DATA_CHECKS);
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
    expect(onClose).not.toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
  });

  it('hands a refused write to the widget, which has already undone it', async () => {
    const { user, repository, report } = addChild(DATA_CHECKS);
    const error = new RepositoryError('unavailable', 'delivery');
    repository.failWrites(error);
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Reconciliation{Enter}');
    await waitFor(() => {
      expect(report.failed).toHaveBeenCalledWith(error);
    });
    expect(report.done).not.toHaveBeenCalled();
  });

  it('closes from Cancel without writing', async () => {
    const { user, repository, onClose } = addChild(DATA_CHECKS);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
  });
});

describe('AddTopLevelItem', () => {
  it('opens a dialog for a top-level item and adds it with no parent', async () => {
    const { user, repository, report } = setup(({ report: reporter }) => (
      <AddTopLevelItem state={state} projectId={PROJECT} report={reporter} />
    ));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add top-level item' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a top-level item' });
    expect(within(dialog).queryByText(/holds/)).not.toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Audit trail{Enter}');
    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith('Added "Audit trail".');
    });
    expect(repository.stored('breakdownItems').find((candidate) => candidate.name === 'Audit trail')?.parentId).toBe(
      null,
    );
    // The dialog closed, and the button is there to use again.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
