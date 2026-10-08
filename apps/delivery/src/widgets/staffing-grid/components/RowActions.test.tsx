import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { applyRealtimeEvent, RepositoryError } from '../../../shared/api';
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
    for (const action of ['Rename', 'Add child item', 'Move', 'Delete', 'Assign person']) {
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

  it('closes the list on Esc, and gives focus inside it back to the button', async () => {
    const { user } = renderGrid();
    const more = await moreOf('Discovery');
    await user.click(more);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });

  it('closes the list on a click outside it, but not on a click inside it', async () => {
    const { user } = renderGrid();
    const more = await moreOf('Discovery');
    await user.click(more);
    // A disabled action is part of the list: pressing it keeps the list open.
    await user.click(screen.getByRole('button', { name: 'Assign person' }));
    expect(more).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('columnheader', { name: 'Total' }));
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
  });

  it('shows a refused action disabled, with the reason from the domain in the tooltip of a ? beside it', async () => {
    const { user } = renderGrid();
    // Design is at the third level, so it can take no child; and it is a leaf, so people can be assigned.
    await user.click(await moreOf('Design'));
    const reason = 'Design is at the third level, the deepest';
    const addChild = screen.getByRole('button', { name: 'Add child item' });
    expect(addChild).toBeDisabled();
    expect(addChild).toHaveAccessibleDescription(reason);
    expect(screen.getByRole('tooltip')).toHaveTextContent(reason);
    // The disabled action can't take focus, so the keyboard reaches the reason through the `?`.
    expect(screen.getByRole('button', { name: 'Why Add child item is unavailable' })).toHaveAccessibleDescription(
      reason,
    );
    expect(screen.getByRole('button', { name: 'Assign person' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Why Assign person is unavailable' })).not.toBeInTheDocument();
  });

  it('refuses Assign person on an item with sub-items, and says why', async () => {
    const { user } = renderGrid();
    await user.click(await moreOf('Discovery'));
    expect(screen.getByRole('button', { name: 'Assign person' })).toHaveAccessibleDescription(
      /Discovery has sub-items, and people are assigned to leaves/,
    );
    expect(screen.getByRole('button', { name: 'Assign person' })).toBeDisabled();
  });

  it('renames in a dialog: the new name shows in the grid and the status line says so', async () => {
    const { user } = renderGrid();
    await user.click(await moreOf('Rework'));
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    // The list closed on choosing; the dialog took its place.
    expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
    const dialog = await screen.findByRole('dialog', { name: 'Rename "Rework"' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Rework');
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });
    await user.keyboard('Rework 2{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent('Renamed "Rework" to "Rework 2".');
    expect(await screen.findByRole('rowheader', { name: /Rework 2/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('puts a refused write at the top of the widget and undoes the new name', async () => {
    const { user, repository } = renderGrid();
    repository.failWrites(new RepositoryError('unavailable', 'delivery'));
    await user.click(await moreOf('Rework'));
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename "Rework"' });
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });
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

  it('moves an item from its row: the tree changes and the status line says where it went', async () => {
    const { user } = renderGrid();
    await user.click(await moreOf('Rework'));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await user.click(await screen.findByRole('radio', { name: 'Ledger migration › Migration' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));

    expect(await screen.findByText('Moved "Rework" under "Ledger migration › Migration".')).toBeInTheDocument();
    // Rework's 3.00 now count under Migration, which had 10.35.
    const migration = (await screen.findAllByRole('rowheader', { name: /^Migration/ }))[0]?.closest('tr');
    if (migration === null || migration === undefined) throw new Error('No Migration row');
    expect(within(migration).getAllByRole('cell').at(-1)).toHaveTextContent('13.35');
  });

  it('deletes an item from its row after counting, and the grid and totals follow', async () => {
    const { user, repository } = renderGrid();
    await user.click(await moreOf('Discovery'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete "Discovery"?' });
    expect(dialog).toHaveTextContent('This deletes 3 items (Discovery, Design, Rework) and their 24 allocations.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Deleted 3 items and 24 allocations.')).toBeInTheDocument();
    expect(repository.written).toHaveLength(1);
    // The project total loses Discovery's 9.69.
    const project = (await screen.findByRole('rowheader', { name: 'Ledger Consolidation' })).closest('tr');
    if (project === null) throw new Error('No project row');
    expect(within(project).getAllByRole('cell').at(-1)).toHaveTextContent('47.37');
  });

  it('assigns a person to a leaf as a row of empty cells, writing nothing until a value is saved', async () => {
    const { user, repository, unmount } = renderGrid();
    const before = (await screen.findAllByRole('rowheader', { name: 'Henrik Bauer' })).length;
    await user.click(await moreOf('Design'));
    await user.click(screen.getByRole('button', { name: 'Assign person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a person to "Design"' });
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: 'Employee' }), 'emp-023');
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

    expect(
      await screen.findByText('Added Henrik Bauer to Design. Enter a value in any month to save it.'),
    ).toBeInTheDocument();
    // Henrik Bauer has rows elsewhere in the seed; the new one is the one with nothing in it.
    const rows = screen.getAllByRole('rowheader', { name: 'Henrik Bauer' }).map((header) => header.closest('tr'));
    expect(rows).toHaveLength(before + 1);
    const empty = rows.filter((row) =>
      within(row as HTMLElement)
        .getAllByRole('cell')
        .slice(0, -1)
        .every((cell) => cell.textContent.includes('·')),
    );
    expect(empty).toHaveLength(1);
    expect(
      within(empty[0] as HTMLElement)
        .getAllByRole('cell')
        .at(-1),
    ).toHaveTextContent('0.00');
    // The sums did not move, and nothing was written.
    const project = (await screen.findByRole('rowheader', { name: 'Ledger Consolidation' })).closest('tr');
    if (project === null) throw new Error('No project row');
    expect(within(project).getAllByRole('cell').at(-1)).toHaveTextContent('57.06');
    expect(repository.written).toHaveLength(0);

    // Offered once only: he is on Design now.
    await user.click(await moreOf('Design'));
    await user.click(screen.getByRole('button', { name: 'Assign person' }));
    const again = await screen.findByRole('dialog', { name: 'Assign a person to "Design"' });
    await within(again).findByRole('option', { name: /Hanna Virtanen/ });
    expect(within(again).queryByRole('option', { name: /Henrik Bauer/ })).not.toBeInTheDocument();

    // A reload (a fresh page over the same data) has no such row.
    unmount();
    renderGrid();
    expect(await screen.findAllByRole('rowheader', { name: 'Henrik Bauer' })).toHaveLength(before);
  });

  it('keeps an assigned person’s row when the first value is saved with the real cell editor', async () => {
    const { user, repository } = renderGrid();
    await screen.findAllByRole('rowheader', { name: 'Adaeze Okafor' });
    const before = screen.queryAllByRole('rowheader', { name: 'Sara Lindholm' }).length;
    await user.click(await moreOf('Design'));
    await user.click(screen.getByRole('button', { name: 'Assign person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a person to "Design"' });
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: 'Employee' }), 'emp-060');
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

    // The new row is the one whose March cell has no allocation.
    const rows = screen.getAllByRole('rowheader', { name: 'Sara Lindholm' }).map((header) => header.closest('tr'));
    expect(rows).toHaveLength(before + 1);
    const empty = rows.find((row) =>
      within(row as HTMLElement).queryByRole('button', { name: /Mar 2026.*no allocation/ }),
    );
    await user.click(within(empty as HTMLElement).getByRole('button', { name: /Mar 2026.*no allocation/ }));
    await user.type(screen.getByRole('textbox', { name: /Edit Sara Lindholm, Mar 2026/ }), '0.25{Enter}');

    expect(await screen.findByText('Saved 0.25 PM for Sara Lindholm, Design, Mar 2026.')).toBeInTheDocument();
    expect(repository.written).toHaveLength(1);
    // The row is still there, now holding the value: one row more than before, not two and not none.
    expect(screen.getAllByRole('rowheader', { name: 'Sara Lindholm' })).toHaveLength(before + 1);
    expect(screen.getByRole('button', { name: /Sara Lindholm, Mar 2026, person-months: 0.25/ })).toBeInTheDocument();
  });

  it('keeps an assigned person’s empty row when the first value fails to save, so it can be retried', async () => {
    const { user, repository } = renderGrid();
    await screen.findAllByRole('rowheader', { name: 'Adaeze Okafor' });
    const before = screen.queryAllByRole('rowheader', { name: 'Sara Lindholm' }).length;
    await user.click(await moreOf('Design'));
    await user.click(screen.getByRole('button', { name: 'Assign person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a person to "Design"' });
    await user.selectOptions(await within(dialog).findByRole('combobox', { name: 'Employee' }), 'emp-060');
    await user.click(within(dialog).getByRole('button', { name: 'Assign' }));

    repository.failWrites(new RepositoryError('unavailable', 'delivery'));
    const release = repository.holdWrites();
    const empty = screen
      .getAllByRole('rowheader', { name: 'Sara Lindholm' })
      .map((header) => header.closest('tr') as HTMLElement)
      .find((row) => within(row).queryByRole('button', { name: /Mar 2026.*no allocation/ }));
    await user.click(within(empty as HTMLElement).getByRole('button', { name: /Mar 2026.*no allocation/ }));
    await user.type(screen.getByRole('textbox', { name: /Edit Sara Lindholm, Mar 2026/ }), '0.25{Enter}');

    // While the write is in flight the cell shows the value (optimistic); then the server refuses it.
    expect(await screen.findByRole('button', { name: /Sara Lindholm, Mar 2026, person-months: 0.25/ })).toBeVisible();
    act(() => {
      release();
    });
    // The write failed and was undone: the message is up, and the row is back to empty cells, not gone.
    expect(await screen.findByRole('alert')).toHaveTextContent("Your change wasn't saved");
    await waitFor(() => {
      expect(screen.getAllByRole('rowheader', { name: 'Sara Lindholm' })).toHaveLength(before + 1);
    });
    expect(screen.queryByRole('button', { name: /Sara Lindholm, Mar 2026, person-months: 0.25/ })).toBeNull();
    // ...and the retry works.
    repository.failWrites(null);
    const again = screen
      .getAllByRole('rowheader', { name: 'Sara Lindholm' })
      .map((header) => header.closest('tr') as HTMLElement)
      .find((row) => within(row).queryByRole('button', { name: /Mar 2026.*no allocation/ }));
    await user.click(within(again as HTMLElement).getByRole('button', { name: /Mar 2026.*no allocation/ }));
    await user.type(screen.getByRole('textbox', { name: /Edit Sara Lindholm, Mar 2026/ }), '0.25{Enter}');
    expect(await screen.findByText('Saved 0.25 PM for Sara Lindholm, Design, Mar 2026.')).toBeInTheDocument();
    expect(screen.getAllByRole('rowheader', { name: 'Sara Lindholm' })).toHaveLength(before + 1);
  });

  describe('an assigned person with no value yet', () => {
    // Ledger migration › Data checks, a leaf at the second level with nothing on it.
    const leafData = () => {
      const seed = seedData();
      return { ...seed, breakdownItems: [...seed.breakdownItems, item('wbs-100', 'prj-1', 'wbs-001', 'Data checks')] };
    };
    const rowsOf = (name: string) => screen.queryAllByRole('rowheader', { name }).length;

    async function assignSara(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await moreOf('Data checks'));
      await user.click(screen.getByRole('button', { name: 'Assign person' }));
      const dialog = await screen.findByRole('dialog', { name: 'Assign a person to "Data checks"' });
      await user.selectOptions(await within(dialog).findByRole('combobox', { name: 'Employee' }), 'emp-060');
      await user.click(within(dialog).getByRole('button', { name: 'Assign' }));
      await screen.findByText(/Added Sara Lindholm to Data checks/);
    }

    it('does not get its empty row back after a value is saved and then cleared', async () => {
      const { user, queryClient } = renderGrid(leafData());
      await screen.findAllByRole('rowheader', { name: /Data checks/ });
      const before = rowsOf('Sara Lindholm');
      await assignSara(user);
      expect(rowsOf('Sara Lindholm')).toBe(before + 1);

      // Saving the first value (what the cell editor does) makes the row real.
      const saved = allocation('alloc-950', 'wbs-100', 'emp-060', '2026-03', 0.5);
      act(() => {
        applyRealtimeEvent(queryClient, 'allocations', { action: 'create', record: saved });
      });
      await waitFor(() => {
        const checks = screen.getByRole('rowheader', { name: /Data checks/ }).closest('tr');
        expect(checks && within(checks).getAllByRole('cell').at(-1)).toHaveTextContent('0.50');
      });
      expect(rowsOf('Sara Lindholm')).toBe(before + 1);

      // Clearing it removes the allocation; the row goes with it instead of reverting to a pending one.
      act(() => {
        applyRealtimeEvent(queryClient, 'allocations', { action: 'delete', record: saved });
      });
      await waitFor(() => {
        expect(rowsOf('Sara Lindholm')).toBe(before);
      });
    });

    it('does not get its empty row back after a child is added under the leaf and then deleted', async () => {
      const { user } = renderGrid(leafData());
      await screen.findAllByRole('rowheader', { name: 'Data checks' });
      const before = rowsOf('Sara Lindholm');
      await assignSara(user);
      expect(rowsOf('Sara Lindholm')).toBe(before + 1);

      await user.click(await moreOf('Data checks'));
      await user.click(screen.getByRole('button', { name: 'Add child item' }));
      await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Checks{Enter}');
      await screen.findByText('Added "Checks".');
      // Data checks has a child, so it is not a leaf and has no people rows.
      expect(rowsOf('Sara Lindholm')).toBe(before);

      await user.click(await moreOf('Checks'));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
      await screen.findByText(/^Deleted 1 item/);
      // Data checks is a leaf again; the person was dropped when it stopped being one.
      expect(rowsOf('Sara Lindholm')).toBe(before);
    });
  });
});
