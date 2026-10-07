import { ProjectId } from '@baseline/delivery-contract';
import { describe, expect, it } from '@rstest/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { useUnit } from '../../../features/switch-unit';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { StaffingGrid } from './StaffingGrid';

// The grid with the real unit switcher, cell editor and messages wired into its slots (T6.5, T6.6, T6.13),
// read the way the project page reads `?unit=`.
function Page() {
  const [unit] = useUnit();
  return (
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} unit={unit} />
    </Suspense>
  );
}

const renderPage = (repository = createFakeRepository(seedData()), route = '/') =>
  renderWithApp(<Page />, { repository, route });

/** The `nth` row named `name`; "Design" is first under Ledger migration › Discovery. */
async function rowOf(name: string, nth = 0): Promise<HTMLElement> {
  const row = (await screen.findAllByRole('rowheader', { name }))[nth]?.closest('tr');
  if (row === null || row === undefined) throw new Error(`No row for ${name}`);
  return row;
}

describe('StaffingGrid with units and editing', () => {
  it('reads the reference cell in all four units as the switcher changes ?unit=', async () => {
    const user = userEvent.setup();
    renderPage();
    await rowOf('Adaeze Okafor');
    const adaeze = () => screen.getAllByRole('button', { name: /^Adaeze Okafor, Mar 2026/ })[0];

    expect(adaeze()).toHaveAccessibleName('Adaeze Okafor, Mar 2026, person-months: 0.50');
    await user.click(screen.getByRole('radio', { name: 'Cost' }));
    expect(await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, cost: €7,880.00' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hours' }));
    expect(await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, hours: 88.00' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '% of capacity' }));
    expect(
      await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, % of capacity: 50.0%' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Person-months' }));
    expect(
      await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, person-months: 0.50' }),
    ).toBeInTheDocument();
  });

  it('leaves the reference cell as it is when its cost is typed back unchanged', async () => {
    const user = userEvent.setup();
    const repository = createFakeRepository(seedData());
    renderPage(repository, '/?unit=cost');
    await user.click(await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, cost: €7,880.00' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '7880{Enter}');
    await user.click(screen.getByRole('radio', { name: 'Person-months' }));

    expect(
      await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, person-months: 0.50' }),
    ).toBeInTheDocument();
    expect(repository.written).toHaveLength(0);
  });

  it('changes the sums above an edited cell with it', async () => {
    const user = userEvent.setup();
    const repository = createFakeRepository(seedData());
    renderPage(repository);
    const design = await rowOf('Design');
    const monthsOf = () =>
      within(design)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
    expect(monthsOf()[1]).toBe('0.20');
    expect(monthsOf().at(-1)).toBe('6.69');

    await user.click(await screen.findByRole('button', { name: 'Anja Keller, Apr 2026, person-months: 0.20' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3{Enter}');

    await waitFor(() => {
      expect(monthsOf()[1]).toBe('0.30');
    });
    expect(monthsOf().at(-1)).toBe('6.79');
    expect(repository.written).toHaveLength(1);
  });

  it('says so at the top of the grid when a save fails, and puts the old value back', async () => {
    const user = userEvent.setup();
    const repository = createFakeRepository(seedData());
    repository.failWrites(new RepositoryError('unavailable', 'delivery'));
    renderPage(repository);
    await user.click(await screen.findByRole('button', { name: 'Anja Keller, Apr 2026, person-months: 0.20' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Your change wasn't saved");
    expect(alert.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: 'Anja Keller, Apr 2026, person-months: 0.20' }),
    ).toBeInTheDocument();
  });

  describe('with People unreachable (screens 3.6)', () => {
    function peopleDown() {
      const repository = createFakeRepository(seedData());
      repository.failReads('employees', new RepositoryError('unavailable', 'people'));
      repository.failReads('rateRecords', new RepositoryError('unavailable', 'people'));
      return repository;
    }

    it('keeps the grid, says People is out of reach, disables Hours and Cost and shows ids', async () => {
      renderPage(peopleDown());
      expect(await screen.findByText(/People's data can't be reached/)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Hours (unavailable)' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Cost (unavailable)' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Person-months' })).toBeChecked();
      expect(await screen.findAllByRole('rowheader', { name: 'emp-001' })).not.toHaveLength(0);
      expect(screen.queryAllByRole('rowheader', { name: 'Adaeze Okafor' })).toHaveLength(0);
    });

    it('still edits person-months and %', async () => {
      const user = userEvent.setup();
      const repository = peopleDown();
      renderPage(repository);
      await user.click(await screen.findByRole('button', { name: /^emp-016, Apr 2026, person-months: 0.20/ }));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), '0.3{Enter}');

      await screen.findByRole('button', { name: /^emp-016, Apr 2026, person-months: 0.30/ });
      await waitFor(() => {
        expect(repository.written).toHaveLength(1);
      });
    });

    it('explains itself once, in the grid’s place, when Hours is asked for', async () => {
      renderPage(peopleDown(), '/?unit=hours');
      expect(await screen.findAllByText(/People's data can't be reached/)).toHaveLength(1);
      expect(screen.getByRole('radio', { name: 'Hours (unavailable)' })).toBeDisabled();
    });
  });
});
