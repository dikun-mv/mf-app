import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { RepositoryError } from '../../../shared/api';
import { allocation, createFakeRepository, item, renderWithApp, seedData } from '../../../shared/testing';
import { StaffingGrid } from './StaffingGrid';

const renderGrid = (data = seedData()) => {
  const repository = createFakeRepository(data);
  const app = renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} />
    </Suspense>,
    { repository },
  );
  return { ...app, user: userEvent.setup() };
};

/** The `⋯` button of the first WBS row with this name. */
const moreOf = async (name: string): Promise<HTMLElement> =>
  (await screen.findAllByRole('button', { name: `Actions for ${name}` }))[0] as HTMLElement;

describe('Row actions', () => {
  it('opens the list under the row, in the label cell, and closes it with the same button', async () => {
    const { user } = renderGrid();
    const more = await moreOf('Discovery');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();

    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const label = more.closest('th');
    if (label === null) throw new Error('No label cell');
    for (const action of ['Rename', 'Add child item', 'Move…', 'Delete…', 'Assign person…']) {
      expect(within(label).getByRole('button', { name: action })).toBeInTheDocument();
    }

    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
  });

  it('keeps one list open at a time', async () => {
    const { user } = renderGrid();
    await user.click(await moreOf('Discovery'));
    await user.click(await moreOf('Migration'));
    expect(screen.getAllByRole('button', { name: 'Rename' })).toHaveLength(1);
    expect(await moreOf('Discovery')).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a refused action disabled, with the reason from the domain beside it', async () => {
    const { user } = renderGrid();
    // Design is at the third level, so it can take no child; and it is a leaf, so people can be assigned.
    await user.click(await moreOf('Design'));
    const addChild = screen.getByRole('button', { name: 'Add child item' });
    expect(addChild).toBeDisabled();
    expect(screen.getByText('Design is at the third level, the deepest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign person…' })).toBeEnabled();
  });

  it('refuses Assign person on an item with sub-items, and says why', async () => {
    const { user } = renderGrid();
    await user.click(await moreOf('Discovery'));
    expect(screen.getByRole('button', { name: 'Assign person…' })).toBeDisabled();
    expect(screen.getByText(/Discovery has sub-items, and people are assigned to leaves/)).toBeInTheDocument();
  });

  it('renames in place: the new name shows in the grid and the status line says so', async () => {
    const { user } = renderGrid();
    await user.click(await moreOf('Rework'));
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    // The list closed on choosing; the field took its place.
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    await user.keyboard('Rework 2{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent('Renamed "Rework" to "Rework 2".');
    expect(await screen.findByRole('rowheader', { name: /Rework 2/ })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('puts a refused write at the top of the widget and undoes the new name', async () => {
    const { user, repository } = renderGrid();
    repository.failWrites(new RepositoryError('unavailable', 'delivery'));
    await user.click(await moreOf('Rework'));
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await user.keyboard('Rework 2{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your change wasn't saved: the Delivery service didn't respond. It has been undone. Try again when the connection is back.",
    );
    expect(await screen.findByRole('rowheader', { name: /Rework/ })).not.toHaveTextContent('Rework 2');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('adds a child under a leaf that holds allocations, moving them, and says how many moved', async () => {
    // Every seed leaf is at the third level, so this one is made: Ledger migration › Data checks.
    const seed = seedData();
    const data = {
      ...seed,
      breakdownItems: [...seed.breakdownItems, item('wbs-100', 'prj-1', 'wbs-001', 'Data checks')],
      allocations: [
        ...seed.allocations,
        ...['2026-03', '2026-04', '2026-05'].map((month, at) =>
          allocation(`alloc-${String(900 + at)}`, 'wbs-100', 'emp-001', month, 0.25),
        ),
      ],
    };
    const { user, repository } = renderGrid(data);
    await user.click(await moreOf('Data checks'));
    await user.click(screen.getByRole('button', { name: 'Add child item' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an item under "Data checks"' });
    expect(within(dialog).getByText(/holds 3 allocations/)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Reconciliation');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));

    await waitFor(() => {
      expect(screen.getByText(/Added "Reconciliation"/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/3 allocations moved from Data checks to Data checks › Reconciliation\./),
    ).toBeInTheDocument();
    // The person row is now under the new item, and the project total did not change.
    const created = repository.stored('breakdownItems').find((candidate) => candidate.name === 'Reconciliation');
    expect(repository.stored('allocations').filter((a) => a.breakdownItemId === created?.id)).toHaveLength(3);
    expect(await screen.findByRole('rowheader', { name: /Reconciliation/ })).toBeInTheDocument();
  });

  it('adds a top-level item from the toolbar', async () => {
    const { user, repository } = renderGrid();
    await user.click(await screen.findByRole('button', { name: '+ Add top-level item' }));
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Governance{Enter}');
    expect(await screen.findByText('Added "Governance".')).toBeInTheDocument();
    expect(repository.stored('breakdownItems').find((candidate) => candidate.name === 'Governance')?.parentId).toBe(
      null,
    );
    expect(await screen.findByRole('rowheader', { name: /Governance/ })).toBeInTheDocument();
  });
});
