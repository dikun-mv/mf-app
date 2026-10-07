import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
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
});
