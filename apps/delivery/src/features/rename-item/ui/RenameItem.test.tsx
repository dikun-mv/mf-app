import { BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { RenameItem } from './RenameItem';

// Ledger Consolidation › Ledger migration › Discovery › Design.
const DESIGN = BreakdownItemId.parse('wbs-012');

const field = () => screen.getByRole('textbox', { name: 'New name for Design' });

async function setup() {
  const data = seedData();
  const state: PlanState = { projects: data.projects, items: data.breakdownItems, allocations: data.allocations };
  const repository = createFakeRepository(data);
  const report = { done: rs.fn(), failed: rs.fn() };
  const onClose = rs.fn();
  renderWithApp(<RenameItem state={state} itemId={DESIGN} report={report} onClose={onClose} />, { repository });
  // The field takes focus when it mounts, which is after the router's first render.
  await waitFor(() => {
    expect(field()).toHaveFocus();
  });
  return { repository, report, onClose, user: userEvent.setup() };
}

describe('RenameItem', () => {
  it('starts on the current name, selected, so typing replaces it', async () => {
    await setup();
    expect(field()).toHaveValue('Design');
  });

  it('saves on Enter, closes, and reports what was renamed', async () => {
    const { repository, report, onClose, user } = await setup();
    await user.keyboard('Design discovery{Enter}');

    await waitFor(() => {
      expect(report.done).toHaveBeenCalledWith('Renamed "Design" to "Design discovery".');
    });
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(1);
    expect(repository.stored('breakdownItems').find((item) => item.id === DESIGN)?.name).toBe('Design discovery');
  });

  it('cancels on Esc without writing', async () => {
    const { repository, report, onClose, user } = await setup();
    await user.keyboard('Something else{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
    expect(report.done).not.toHaveBeenCalled();
  });

  it('sends nothing when the name did not change', async () => {
    const { repository, report, onClose, user } = await setup();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(repository.written).toHaveLength(0);
    expect(report.done).not.toHaveBeenCalled();
  });

  it('refuses an empty name next to the field and stays open', async () => {
    const { repository, onClose, user } = await setup();
    await user.clear(field());
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(onClose).not.toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
  });

  it('hands a failed write to the widget instead of saying it was saved', async () => {
    const { repository, report, user } = await setup();
    const error = new RepositoryError('unavailable', 'delivery');
    repository.failWrites(error);
    await user.keyboard('Design discovery{Enter}');
    await waitFor(() => {
      expect(report.failed).toHaveBeenCalledWith(error);
    });
    expect(report.done).not.toHaveBeenCalled();
  });
});
