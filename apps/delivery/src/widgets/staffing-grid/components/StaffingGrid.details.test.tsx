import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { act, screen, within } from '@testing-library/react';
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

/** Focuses the button of a person cell (T6.6), as Tab would. */
function focusCell(cell: HTMLElement): void {
  const button = within(cell).getByRole('button');
  act(() => {
    button.focus();
  });
}

const panel = (): HTMLElement => screen.getByRole('region', { name: /./ });

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
});

describe('Staffing grid cell details', () => {
  it('asks for a cell until one has focus', async () => {
    renderGrid();
    await cellOf('Adaeze Okafor', 0);
    expect(within(panel()).getByText(/Focus a person’s cell/)).toBeInTheDocument();
  });

  it('spells out the reference cell: Okafor, Design, Mar 2026', async () => {
    renderGrid();
    focusCell(await cellOf('Adaeze Okafor', 0));

    const details = within(panel());
    expect(details.getByRole('heading', { name: 'Adaeze Okafor · Design · Mar 2026' })).toBeInTheDocument();
    expect(details.getByText('0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00')).toBeInTheDocument();
    expect(
      details.getByText('Person-month 176.00 h (40 h/week × 22 working days ÷ 5) · 4.00 h per working day'),
    ).toBeInTheDocument();
    expect(
      details.getByText('22 working days: 8 before 12 Mar at €80.00/h, 14 from 12 Mar at €95.00/h'),
    ).toBeInTheDocument();
    expect(details.getByText('Blended rate €89.5455/h')).toBeInTheDocument();
    // Nothing is over capacity or unpriced there, so no marker is spelled out.
    expect(details.queryByRole('list')).not.toBeInTheDocument();
  });

  it('names the causer of a † cell in full, in the panel the cell points at', async () => {
    renderGrid();
    const cell = await cellOf('Milan Brandt', 3);
    focusCell(cell);

    const describedBy = cell.querySelector('[aria-describedby]')?.getAttribute('aria-describedby');
    expect(describedBy).toBe(panel().id);
    const note = within(panel()).getByRole('listitem');
    expect(note).toHaveTextContent(
      'Over capacity: Milan Brandt, Jun 2026 — 118.0% of capacity (1.18 PM) across all projects.',
    );
    expect(note).toHaveTextContent(`Caused by: ${CAUSER}, 0.59 PM`);
  });

  it('leaves out hours, rates and cost when People’s data is missing', async () => {
    renderWithApp(
      <Suspense fallback={null}>
        <StaffingGrid projectId={ProjectId.parse('prj-1')} />
      </Suspense>,
      { repository: createFakeRepository({ ...seedData(), employees: [], rateRecords: [] }) },
    );
    const header = (await screen.findAllByRole('rowheader', { name: 'emp-001' }))[0];
    const cell = header?.closest('tr')?.querySelector<HTMLElement>('[data-month-index="0"]');
    if (cell === null || cell === undefined) throw new Error('No cell');
    focusCell(cell);

    const details = within(panel());
    expect(details.getByText('0.50 PM = 50.0% of capacity')).toBeInTheDocument();
    expect(details.queryByText(/Person-month 176/)).not.toBeInTheDocument();
    expect(details.queryByText(/Blended rate/)).not.toBeInTheDocument();
  });

  it('follows focus from one cell to the next', async () => {
    renderGrid();
    focusCell(await cellOf('Adaeze Okafor', 0));
    expect(within(panel()).getByRole('heading')).toHaveTextContent('Adaeze Okafor · Design · Mar 2026');

    focusCell(await cellOf('Anja Keller', 1));
    expect(within(panel()).getByRole('heading')).toHaveTextContent('Anja Keller · Design · Apr 2026');
  });
});
