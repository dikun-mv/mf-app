import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import { Suspense } from 'react';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { StaffingGrid } from './StaffingGrid';

// The grid with its real markers and details panel wired in, against the seed (screens 3.2, 3.3).

const CAUSER = 'Client Portal Rebuild › Account management › Core build › Implementation';

const renderGrid = () =>
  renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} />
    </Suspense>,
    { repository: createFakeRepository(seedData()) },
  );

/** The person cell of `name`'s first row in `monthIndex`, once People's names have loaded. */
async function cellOf(name: string, monthIndex: number): Promise<HTMLElement> {
  const header = (await screen.findAllByRole('rowheader', { name }))[0];
  const cell = header?.closest('tr')?.querySelector<HTMLElement>(`[data-month-index="${String(monthIndex)}"]`);
  if (cell === null || cell === undefined) throw new Error(`No cell ${String(monthIndex)} for ${name}`);
  return cell;
}

describe('Staffing grid markers', () => {
  it('marks the over-capacity cell with † and gives the causer as its title', async () => {
    renderGrid();
    // Milan Brandt, June 2026: 118.0% across projects, though the causer sits in another project.
    const cell = await cellOf('Milan Brandt', 3);
    const marker = within(cell).getByText('†').closest('[title]');
    expect(marker).toHaveAttribute('title', expect.stringContaining(`Caused by: ${CAUSER}`));
    expect(marker).toHaveTextContent('Over capacity');
  });

  it('leaves cells that are not over capacity and fully priced without a marker', async () => {
    renderGrid();
    const cell = await cellOf('Adaeze Okafor', 0);
    expect(cell).toHaveTextContent(/^0\.50$/);
    expect(cell.querySelector('[title]')).toBeNull();
  });

  it('points a marked cell at the details panel', async () => {
    renderGrid();
    const cell = await cellOf('Milan Brandt', 3);
    const describedBy = cell.querySelector('[aria-describedby]')?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
  });
});
