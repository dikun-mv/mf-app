import { ProjectId, type Allocation } from '@baseline/delivery-contract';
import { gridView, type DisplayUnit } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import type { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { Suspense, useState, type ReactNode } from 'react';
import { useAllocations } from '../../../entities/allocation';
import { useBreakdownItems } from '../../../entities/breakdown-item';
import { useEmployees } from '../../../entities/employee';
import { useProjects } from '../../../entities/project';
import { useRateRecords } from '../../../entities/rate-record';
import { collectionKey, RepositoryError } from '../../../shared/api';
import { useHost } from '../../../shared/lib';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { EditableCell } from './EditableCell';
import { WriteFailedMessage } from './WriteFailedMessage';

interface Which {
  /** The person, under the Design item of Ledger Consolidation. */
  readonly person: string;
  /** `2026-04` */
  readonly month: string;
}

/**
 * One person cell of the Ledger Consolidation grid, drawn by `EditableCell` from a live `gridView`, as the
 * staffing grid does: so the cell shows what a save leaves in the cache. (A feature can't import the widget.)
 */
function OneCell({ unit, person, month, adornment = null }: Which & { unit: DisplayUnit; adornment?: ReactNode }) {
  const plan = { projects: useProjects(), items: useBreakdownItems(), allocations: useAllocations() };
  const employees = useEmployees().data;
  const rates = useRateRecords().data;
  const { currency } = useHost();
  const result = gridView(
    plan,
    employees && rates ? { employees, rates } : null,
    ProjectId.parse('prj-1'),
    unit,
    currency,
  );
  if (!result.ok) return null;
  const { rows, months } = result.value;
  const row = rows.find(
    (candidate) =>
      candidate.kind === 'person' &&
      candidate.label === person &&
      rows.find(({ key }) => key === candidate.parentKey)?.label === 'Design',
  );
  const position = months.findIndex((candidate) => candidate.month === month);
  const monthView = months[position];
  const cell = row?.kind === 'person' ? row.cells[position] : undefined;
  if (row?.kind !== 'person' || cell === undefined || monthView === undefined) return null;
  return (
    <EditableCell
      row={row}
      cell={cell}
      month={monthView}
      unit={unit}
      adornment={adornment}
      describedById="details"
      report={announcements}
    />
  );
}

/** What the grid's status line would hear. */
const announcements = { done: rs.fn(), failed: rs.fn() };

function setup(which: Which, unit: DisplayUnit = 'personMonths', data = seedData()) {
  announcements.done.mockClear();
  announcements.failed.mockClear();
  const repository = createFakeRepository(data);
  const rendered = renderWithApp(
    <Suspense fallback={null}>
      <WriteFailedMessage />
      <OneCell unit={unit} {...which} />
    </Suspense>,
    { repository },
  );
  return { ...rendered, repository, user: userEvent.setup() };
}

const ANJA_APRIL = { person: 'Anja Keller', month: '2026-04' };
const ADAEZE_MARCH = { person: 'Adaeze Okafor', month: '2026-03' };

/** What the realtime echo of another user's edit does to the cache: Anja's April cell takes a new amount. */
function changeElsewhere(queryClient: QueryClient, amount: number): void {
  act(() => {
    queryClient.setQueryData(collectionKey('allocations'), (current: readonly Allocation[] | undefined) =>
      current?.map((stored) =>
        stored.employeeId === 'emp-016' && stored.month === '2026-04' ? { ...stored, amount } : stored,
      ),
    );
  });
}

const cellButton = (name: string) => screen.findByRole('button', { name });
const allocationOf = (repository: ReturnType<typeof createFakeRepository>, person: string, month: string) =>
  repository.stored('allocations').find((stored) => stored.employeeId === person && stored.month === month);

describe('EditableCell', () => {
  it('shows the value in a button named after the row, month and unit', async () => {
    setup(ANJA_APRIL);
    const button = await cellButton('Anja Keller, Apr 2026, person-months: 0.20');
    expect(button).toHaveTextContent('0.20');
    expect(button.tagName).toBe('BUTTON');
  });

  it('saves on Enter: the cell shows the new value at once, the server holds it, and focus returns to the button', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    const input = screen.getByRole('textbox', { name: 'Edit Anja Keller, Apr 2026, person-months' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('0.20');

    await user.clear(input);
    await user.type(input, '0.3{Enter}');

    const button = await cellButton('Anja Keller, Apr 2026, person-months: 0.30');
    expect(button).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
    expect(repository.written[0]?.update.allocations.map(({ amount }) => amount)).toEqual([0.3]);
    expect(repository.stored('allocations').some(({ amount }) => amount === 0.3)).toBe(true);
  });

  it('announces the save for the status line, once the server has it', async () => {
    const { user } = setup(ANJA_APRIL);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3{Enter}');
    await waitFor(() => {
      expect(announcements.done).toHaveBeenCalledWith('Saved 0.30 PM for Anja Keller, Design, Apr 2026.');
    });
  });

  it('announces nothing for a save the server refused', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    const error = new RepositoryError('unavailable', 'delivery');
    repository.failWrites(error);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3{Enter}');
    await waitFor(() => {
      expect(announcements.failed).toHaveBeenCalledWith(error);
    });
    expect(announcements.done).not.toHaveBeenCalled();
  });

  it('saves on blur and leaves the focus where the user moved it', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.35');
    await user.tab();

    await cellButton('Anja Keller, Apr 2026, person-months: 0.35');
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: /Apr 2026, person-months: 0.35/ }));
  });

  it('cancels on Esc: nothing is written and the old value stays', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3{Escape}');

    const button = await cellButton('Anja Keller, Apr 2026, person-months: 0.20');
    expect(button).toHaveFocus();
    expect(repository.written).toHaveLength(0);
  });

  it('makes no write when the value is unchanged, however it is left', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    const name = 'Anja Keller, Apr 2026, person-months: 0.20';

    await user.click(await cellButton(name));
    await user.keyboard('{Enter}');
    await cellButton(name);

    await user.click(screen.getByRole('button', { name }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.2{Enter}');
    await cellButton(name);

    await user.click(screen.getByRole('button', { name }));
    await user.tab();
    await cellButton(name);

    expect(repository.written).toHaveLength(0);
  });

  it('creates an allocation for a cell with nothing stored, and none for an empty or zero draft', async () => {
    const { user, repository } = setup({ person: 'Anja Keller', month: '2026-03' });
    const name = 'Anja Keller, Mar 2026, person-months: no allocation';
    await user.click(await cellButton(name));
    await user.type(screen.getByRole('textbox'), '0{Enter}');
    expect(repository.written).toHaveLength(0);

    await user.click(await cellButton(name));
    await user.type(screen.getByRole('textbox'), '0.15{Enter}');
    await cellButton('Anja Keller, Mar 2026, person-months: 0.15');
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
    expect(repository.written[0]?.create.allocations).toHaveLength(1);
  });

  it('keeps the editor open, with the reason, for a draft that is not a number', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0,5{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a number');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(repository.written).toHaveLength(0);
  });

  it('edits in hours, converting to person-months', async () => {
    // Anja works 32 h a week and April 2026 has 22 working days: one person-month is 140.80 h.
    const { user, repository } = setup(ANJA_APRIL, 'hours');
    await user.click(await cellButton('Anja Keller, Apr 2026, hours: 28.16'));
    await user.clear(screen.getByRole('textbox', { name: 'Edit Anja Keller, Apr 2026, hours' }));
    await user.type(screen.getByRole('textbox'), '35.2{Enter}');

    await cellButton('Anja Keller, Apr 2026, hours: 35.20');
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
    expect(repository.written[0]?.update.allocations.map(({ amount }) => amount)).toEqual([0.25]);
  });

  it('leaves Cost unchanged when the typed amount is the one shown', async () => {
    const { user, repository } = setup(ADAEZE_MARCH, 'cost');
    await user.click(await cellButton('Adaeze Okafor, Mar 2026, cost: €7,880.00'));
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('7880.00');
    await user.clear(input);
    await user.type(input, '7880{Enter}');

    await cellButton('Adaeze Okafor, Mar 2026, cost: €7,880.00');
    expect(repository.written).toHaveLength(0);
  });

  it('edits in Cost where the month is fully priced', async () => {
    const { user, repository } = setup(ADAEZE_MARCH, 'cost');
    await user.click(await cellButton('Adaeze Okafor, Mar 2026, cost: €7,880.00'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '3940{Enter}');

    await screen.findByRole('button', { name: /Adaeze Okafor, Mar 2026, cost: €3,9/ });
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
  });

  describe('where the month is partly priced (D17)', () => {
    // Without her 1 Jan 2025 rate, the first rate starts on 12 Mar: 8 of March's 22 working days aren't costed.
    const withoutFirstRate = () => {
      const data = seedData();
      return { ...data, rateRecords: data.rateRecords.filter(({ id }) => id !== 'rate-001') };
    };

    it('refuses a € edit with the reason, writes nothing and keeps the editor open', async () => {
      const { user, repository } = setup(ADAEZE_MARCH, 'cost', withoutFirstRate());
      await user.click(await cellButton('Adaeze Okafor, Mar 2026, cost: €5,320.00'));
      // The reason is there from the start, as a hint.
      expect(screen.getByText(/8 of 22 working days/)).toBeInTheDocument();
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), '5000{Enter}');

      const reason = await screen.findByRole('alert');
      expect(reason).toHaveTextContent(/8 of 22 working days/);
      expect(screen.getByRole('textbox')).toHaveValue('5000');
      expect(screen.getByRole('textbox')).toHaveAccessibleDescription(/8 of 22 working days/);
      expect(repository.written).toHaveLength(0);
    });

    it('still edits the same cell in person-months', async () => {
      const { user, repository } = setup(ADAEZE_MARCH, 'personMonths', withoutFirstRate());
      await user.click(await cellButton('Adaeze Okafor, Mar 2026, person-months: 0.50'));
      await user.clear(screen.getByRole('textbox'));
      await user.type(screen.getByRole('textbox'), '0.4{Enter}');
      await cellButton('Adaeze Okafor, Mar 2026, person-months: 0.40');
      await waitFor(() => {
        expect(repository.written).toHaveLength(1);
      });
    });
  });

  it('puts the old value back and says so when the write fails (screens 4)', async () => {
    const { user, repository } = setup(ANJA_APRIL);
    repository.failWrites(new RepositoryError('unavailable', 'delivery'));
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your change wasn't saved: the Delivery service didn't respond. It has been undone.",
    );
    await cellButton('Anja Keller, Apr 2026, person-months: 0.20');
    expect(allocationOf(repository, 'emp-016', '2026-04')).toBeDefined();
  });

  it('does not overwrite the draft when the cell changes elsewhere while it is open (D37)', async () => {
    const { user, queryClient } = setup(ANJA_APRIL);
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.3');

    changeElsewhere(queryClient, 0.9);

    expect(screen.getByRole('textbox')).toHaveValue('0.3');
    await user.keyboard('{Enter}');
    await cellButton('Anja Keller, Apr 2026, person-months: 0.30');
  });

  it('closes an open editor when the unit changes, and does not bring it back with the unit', async () => {
    const repository = createFakeRepository(seedData());
    function Switch() {
      const [unit, setUnit] = useState<DisplayUnit>('personMonths');
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setUnit(unit === 'personMonths' ? 'hours' : 'personMonths');
            }}
          >
            Switch unit
          </button>
          <OneCell unit={unit} {...ANJA_APRIL} />
        </>
      );
    }
    const user = userEvent.setup();
    renderWithApp(
      <Suspense fallback={null}>
        <Switch />
      </Suspense>,
      { repository },
    );
    await user.click(await cellButton('Anja Keller, Apr 2026, person-months: 0.20'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'abc');
    // The refused draft keeps the editor open through blur.
    await user.click(screen.getByRole('button', { name: 'Switch unit' }));
    expect(await screen.findByRole('button', { name: /Apr 2026, hours/ })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch unit' }));
    await cellButton('Anja Keller, Apr 2026, person-months: 0.20');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch unit' })).toHaveFocus();
    expect(repository.written).toHaveLength(0);
  });

  it('writes the exact text the editor opened with when it is typed over a remote change, and nothing for an untouched draft', async () => {
    const { user, repository, queryClient } = setup(ANJA_APRIL);
    const name = 'Anja Keller, Apr 2026, person-months: 0.20';
    // Untouched: the other change stands.
    await user.click(await cellButton(name));
    changeElsewhere(queryClient, 0.9);
    await user.keyboard('{Enter}');
    await cellButton('Anja Keller, Apr 2026, person-months: 0.90');
    expect(repository.written).toHaveLength(0);

    // Touched, with the very text it opened with: a real edit back to 0.20.
    await user.click(screen.getByRole('button', { name: 'Anja Keller, Apr 2026, person-months: 0.90' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.20{Enter}');
    await cellButton(name);
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
  });

  it('keeps the reason out of the layout, so opening, refusing and closing an editor shift no cell', () => {
    // jsdom lays nothing out, so read the rules. A reason in the flow made a tall row, and closing the editor
    // on a click elsewhere moved the target between mouse down and up: the click opened nothing.
    const css = readFileSync(new URL('./EditableCell.module.css', import.meta.url), 'utf8');
    const rule = (selector: string) =>
      new RegExp(`^${selector.replaceAll('.', '\\.')} \\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
    expect(rule('.editor')).toMatch(/position:\s*relative/);
    expect(rule('.hint,\n.problem')).toMatch(/position:\s*absolute/);
    // It covers the cells below, and a mouse down on it would blur the editor and lose the click.
    expect(rule('.hint,\n.problem')).toMatch(/pointer-events:\s*none/);
  });

  it('points the button at the details panel when markers sit beside the value', async () => {
    const repository = createFakeRepository(seedData());
    renderWithApp(
      <Suspense fallback={null}>
        <OneCell unit="personMonths" {...ANJA_APRIL} adornment={<b>†</b>} />
      </Suspense>,
      { repository },
    );
    const button = await cellButton('Anja Keller, Apr 2026, person-months: 0.20');
    expect(button).toHaveAttribute('aria-describedby', 'details');
    expect(button).toHaveTextContent('0.20†');
  });
});
