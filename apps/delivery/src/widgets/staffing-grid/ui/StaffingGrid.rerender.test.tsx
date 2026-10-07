import { ProjectId } from '@baseline/delivery-contract';
import type { DisplayUnit } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { applyRealtimeEvent } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import * as actual from './RowLabel' with { rstest: 'importActual' };
import type { RowLabelProps } from './RowLabel';
import { StaffingGrid } from './StaffingGrid';

// Which rows the grid renders again after a change (T6.11, D35). Every row draws a `RowLabel` exactly when it
// renders, so a wrapper around it counts the renders of each row by key; the rest of the grid is the real one.
const probe = rs.hoisted(() => ({ rendered: [] as string[] }));

rs.mock('./RowLabel', () => ({
  RowLabel: (props: RowLabelProps) => {
    probe.rendered.push(props.row.key);
    return <actual.RowLabel {...props} />;
  },
}));

/** The rows that rendered since the last call, once each. */
const takeRendered = (): string[] => [...new Set(probe.rendered.splice(0))].sort();

// prj-1 in the seed: Adaeze (emp-001) is under Design (wbs-012: Ledger migration > Discovery > Design) and
// Regression (wbs-015: Ledger migration > Migration > Regression); Anja (emp-016) is under Design alone.
const ADAEZE_ROWS = ['wbs-012/emp-001', 'wbs-015/emp-001'];
const ABOVE_ADAEZE = ['wbs-012', 'wbs-015', 'wbs-004', 'wbs-007', 'wbs-001', 'project'];
const ANJA_ROW = 'wbs-012/emp-016';
const ABOVE_ANJA = ['wbs-012', 'wbs-004', 'wbs-001', 'project'];

async function renderGrid(unit: DisplayUnit) {
  const repository = createFakeRepository(seedData());
  const app = renderWithApp(
    <Suspense fallback={null}>
      <StaffingGrid projectId={ProjectId.parse('prj-1')} unit={unit} />
    </Suspense>,
    { repository },
  );
  // People's names are the sign that its collections have arrived and the grid is complete.
  await screen.findAllByRole('rowheader', { name: 'Adaeze Okafor' });
  takeRendered();
  return { ...app, repository };
}

/** Adaeze's later rate (from 12 Mar 2026), changed on the "server" and arriving as a realtime update. */
function raiseAdaezesRate(queryClient: Parameters<typeof applyRealtimeEvent>[0]) {
  const current = seedData().rateRecords.find((record) => record.id === 'rate-002');
  if (current === undefined) throw new Error('The seed has no rate-002');
  act(() => {
    applyRealtimeEvent(queryClient, 'rateRecords', { action: 'update', record: { ...current, hourlyCost: 96 } });
  });
}

describe('StaffingGrid renders', () => {
  it('only the rows of the employee whose rate changed, when no sum shows a rate', async () => {
    const { queryClient } = await renderGrid('personMonths');
    raiseAdaezesRate(queryClient);
    // Nothing on screen changes with the rate, so wait for the first row to render, then see which did.
    await waitFor(() => {
      expect(probe.rendered).not.toHaveLength(0);
    });
    expect(takeRendered()).toEqual(ADAEZE_ROWS);
  });

  it('those rows and the rows above them, when the unit is cost and the sums change', async () => {
    const { queryClient } = await renderGrid('cost');
    raiseAdaezesRate(queryClient);
    expect(await screen.findByRole('button', { name: 'Adaeze Okafor, Mar 2026, cost: €7,936.00' })).toBeInTheDocument();
    expect(takeRendered()).toEqual([...ADAEZE_ROWS, ...ABOVE_ADAEZE].sort());
  });

  it('no row, when an event brings a record the cache already holds', async () => {
    const { queryClient } = await renderGrid('cost');
    const same = seedData().rateRecords.find((record) => record.id === 'rate-002');
    if (same === undefined) throw new Error('The seed has no rate-002');
    act(() => {
      applyRealtimeEvent(queryClient, 'rateRecords', { action: 'update', record: same });
    });
    expect(takeRendered()).toEqual([]);
  });

  it('only the edited row and the rows above it, when a cell is edited', async () => {
    const user = userEvent.setup();
    const { repository } = await renderGrid('personMonths');
    await user.click(screen.getByRole('button', { name: 'Anja Keller, Apr 2026, person-months: 0.20' }));
    takeRendered();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '0.25{Enter}');
    expect(
      await screen.findByRole('button', { name: 'Anja Keller, Apr 2026, person-months: 0.25' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(repository.written).toHaveLength(1);
    });
    expect(takeRendered()).toEqual([ANJA_ROW, ...ABOVE_ANJA].sort());
  });
});
