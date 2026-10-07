import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { StaffingGrid } from './StaffingGrid';

const LEDGER = ProjectId.parse('prj-1');

// The grid suspends until Delivery's collections load; the page owns that state, so the test supplies a boundary.
const renderGrid = (data = seedData()) =>
  renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={LEDGER} />
    </Suspense>,
    { repository: createFakeRepository(data) },
  );

/**
 * The `nth` row (0-based, in grid order) named `name`, once the grid has loaded. The seed repeats names
 * (two "Design" items, one person on several leaves), so the first one is the one under Ledger migration
 * › Discovery.
 */
async function rowOf(name: string, nth = 0): Promise<HTMLElement> {
  const header = (await screen.findAllByRole('rowheader', { name }))[nth];
  const row = header?.closest('tr');
  if (row === null || row === undefined) throw new Error(`No row ${String(nth)} for ${name}`);
  return row;
}

const countOf = (name: string): number => screen.queryAllByRole('rowheader', { name }).length;

/** What a row shows in its month columns, then its Total. */
const valuesOf = (row: HTMLElement): { months: string[]; total: string } => {
  const cells = within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
  return { months: cells.slice(0, -1).map(String), total: String(cells.at(-1)) };
};

describe('StaffingGrid', () => {
  it('lays out the months of the project and a Total as column headers', async () => {
    renderGrid();
    await screen.findByRole('rowheader', { name: 'Ledger Consolidation' });
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers.slice(0, 7)).toEqual([
      'Work package / person',
      'Mar 26',
      'Apr 26',
      'May 26',
      'Jun 26',
      'Jul 26',
      'Aug 26',
    ]);
    expect(headers).toHaveLength(1 + 12 + 1);
    expect(headers.at(-1)).toBe('Total');
    expect(
      screen.getByRole('table', { name: 'Staffing grid for Ledger Consolidation, in person-months' }),
    ).toBeInTheDocument();
  });

  it('adds up to the seed: the project row, Mar to Aug and its Total', async () => {
    renderGrid();
    const { months, total } = valuesOf(await rowOf('Ledger Consolidation'));
    expect(months.slice(0, 6)).toEqual(['0.50', '1.30', '2.65', '4.99', '5.35', '6.40']);
    expect(total).toBe('57.06');
  });

  it('shows the seed’s sums on a WBS row: Design in June is 1.29', async () => {
    renderGrid();
    const design = valuesOf(await rowOf('Design'));
    expect(design.months[3]).toBe('1.29');
    expect(design.total).toBe('6.69');
  });

  it('lists the people under a leaf by name, with · where nothing is stored', async () => {
    renderGrid();
    const okafor = await rowOf('Adaeze Okafor');
    const { months, total } = valuesOf(okafor);
    expect(months[0]).toBe('0.50');
    expect(months[1]).toBe('·0.00, no allocation');
    expect(total).toBe('0.50');
    expect(within(okafor).getAllByText('·')[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows employee ids as names when People’s employees are not there', async () => {
    renderGrid({ ...seedData(), employees: [], rateRecords: [] });
    expect(await screen.findAllByRole('rowheader', { name: 'emp-001' })).not.toHaveLength(0);
    expect(countOf('Adaeze Okafor')).toBe(0);
  });

  it('starts with every node expanded, and collapsing one keeps its row and its sums', async () => {
    renderGrid();
    const user = userEvent.setup();
    const discovery = await rowOf('Discovery');
    const before = valuesOf(discovery);
    expect(before.months[0]).toBe('0.50');
    expect(before.total).toBe('9.69');
    for (const toggle of screen.getAllByRole('button')) expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(countOf('Design')).toBe(2);
    // People's employees load apart from Delivery's data, so names appear a moment after the rows.
    expect(await screen.findAllByRole('rowheader', { name: 'Adaeze Okafor' })).toHaveLength(2);

    await user.click(within(discovery).getByRole('button', { name: 'Discovery' }));

    // Everything under this Discovery is gone; its own row, the project row and the nodes around it are not.
    expect(countOf('Design')).toBe(1);
    expect(countOf('Rework')).toBe(0);
    expect(countOf('Adaeze Okafor')).toBe(1);
    expect(within(discovery).getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'false');
    expect(valuesOf(discovery)).toEqual(before);
    expect(valuesOf(await rowOf('Ledger Consolidation')).total).toBe('57.06');
    expect(countOf('Migration')).toBe(1);

    await user.click(within(discovery).getByRole('button', { name: 'Discovery' }));
    expect(countOf('Adaeze Okafor')).toBe(2);
    expect(countOf('Rework')).toBe(1);
  });

  it('keeps a collapsed node’s inner nodes as they were when it opens again', async () => {
    renderGrid();
    const user = userEvent.setup();
    const ledgerMigration = await rowOf('Ledger migration');
    const discovery = await rowOf('Discovery');
    await user.click(within(discovery).getByRole('button', { name: 'Discovery' }));
    await user.click(within(ledgerMigration).getByRole('button', { name: 'Ledger migration' }));
    // Only the other Discovery (under Reporting cut-over) is left.
    expect(countOf('Discovery')).toBe(1);

    await user.click(within(ledgerMigration).getByRole('button', { name: 'Ledger migration' }));
    expect(countOf('Discovery')).toBe(2);
    // The first Discovery was collapsed before, and still is.
    expect(countOf('Design')).toBe(1);
  });

  it('makes the derived rows read-only: Tab reaches only the expand and collapse controls', async () => {
    renderGrid();
    const user = userEvent.setup();
    const project = await rowOf('Ledger Consolidation');
    const node = await rowOf('Ledger migration');

    for (const derived of [project, node]) {
      const values = within(derived).getAllByRole('cell');
      for (const value of values) {
        expect(value.matches('[tabindex]')).toBe(false);
        expect(value.querySelector('button, a, input, [tabindex]')).toBeNull();
      }
    }

    const reached: string[] = [];
    for (let step = 0; step < 40; step += 1) {
      await user.tab();
      if (document.activeElement === document.body) break;
      reached.push(document.activeElement?.getAttribute('aria-expanded') ?? 'not a toggle');
    }
    expect(reached.length).toBeGreaterThan(0);
    expect(reached.every((state) => state === 'true' || state === 'false')).toBe(true);
    // The project row has no control: the first stop is the first WBS row.
    expect(within(project).queryByRole('button')).not.toBeInTheDocument();
  });

  it('gives the project row and WBS rows no row actions until a task fills the slot', async () => {
    renderGrid();
    await screen.findByRole('rowheader', { name: 'Ledger Consolidation' });
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument();
  });
});
