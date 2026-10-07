import { ProjectId } from '@baseline/delivery-contract';
import type { DisplayUnit } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { act, screen, within } from '@testing-library/react';
import { Suspense } from 'react';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import type { CellAdornmentSlotProps, DetailsSlotProps, ToolbarSlotProps } from './slots/types';
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

rs.mock('./slots/toolbar', () => ({
  toolbarSlot: ({ unit, units }: ToolbarSlotProps) => (
    <div data-testid="toolbar">{`${unit} of ${units.join(',')}`}</div>
  ),
}));

const renderGrid = (unit?: DisplayUnit, repository = createFakeRepository(seedData())) =>
  renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} {...(unit === undefined ? {} : { unit })} />
    </Suspense>,
    { repository },
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

  it('keeps the toolbar when the grid can’t be shown, so the unit can be changed', async () => {
    const repository = createFakeRepository(seedData());
    repository.failReads('employees', new RepositoryError('server', 'people'));
    renderGrid('hours', repository);

    // People can't be reached: a sentence, never the error's code, and the toolbar offers the other units.
    expect(await screen.findByText(/People's data can't be reached/)).toBeInTheDocument();
    expect(screen.queryByText(/unitUnavailable/)).not.toBeInTheDocument();
    expect(screen.getByTestId('toolbar')).toHaveTextContent('hours of personMonths,percent');
  });

  it('waits for People’s data instead of reporting hours as unavailable, then shows the grid', async () => {
    const repository = createFakeRepository(seedData());
    const release = repository.holdReads('employees');
    renderGrid('hours', repository);

    expect(await screen.findByText('Loading staffing grid…')).toBeInTheDocument();
    expect(screen.queryByText(/can't be reached/)).not.toBeInTheDocument();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();

    act(() => {
      release();
    });
    expect(await screen.findByRole('table', { name: /in hours/ })).toBeInTheDocument();
  });
});
