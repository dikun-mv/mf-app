import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import { Suspense } from 'react';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import type { CellAdornmentSlotProps, DetailsSlotProps } from './slots/types';
import { StaffingGrid } from './StaffingGrid';

// The slots with something wired in, as a later task would: the default cell renderer stays, so these
// tests show what the grid hands it.
rs.mock('./slots/cellAdornment', () => ({
  cellAdornmentSlot: ({ cell }: CellAdornmentSlotProps) => (cell.allocationId === null ? null : <b>†</b>),
}));
rs.mock('./slots/details', () => ({
  detailsSlot: ({ id, focus }: DetailsSlotProps) => (
    <div id={id} data-testid="details">
      {focus === null ? 'no cell' : `${focus.rowKey}:${String(focus.monthIndex)}`}
    </div>
  ),
}));

const renderGrid = () =>
  renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} />
    </Suspense>,
    { repository: createFakeRepository(seedData()) },
  );

describe('StaffingGrid slots', () => {
  it('renders the cell adornment of each person cell and passes it to the cell renderer', async () => {
    renderGrid();
    const header = (await screen.findAllByRole('rowheader', { name: 'Adaeze Okafor' }))[0];
    const row = header?.closest('tr');
    if (row === null || row === undefined) throw new Error('No row');
    const cells = within(row).getAllByRole('cell');
    // Adaeze's March allocation is marked; April has none, so the slot returned nothing for it.
    expect(within(cells[0] as HTMLElement).getByText('†')).toBeInTheDocument();
    expect(within(cells[1] as HTMLElement).queryByText('†')).not.toBeInTheDocument();
  });

  it('points the cells at the details panel with one stable id', async () => {
    renderGrid();
    const panel = await screen.findByTestId('details');
    const marked = (await screen.findAllByText('†')).map((mark) => mark.closest('[aria-describedby]'));
    expect(marked.length).toBeGreaterThan(1);
    for (const element of marked) expect(element).toHaveAttribute('aria-describedby', panel.id);
    expect(panel.id).not.toBe('');
  });
});
