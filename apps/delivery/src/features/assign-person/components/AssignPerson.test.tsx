import { BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';
import { describe, expect, it, rs } from '@rstest/core';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryError } from '../../../shared/api';
import { createFakeRepository, renderWithApp, seedData } from '../../../shared/testing';
import { AssignPerson } from './AssignPerson';

// Ledger Consolidation › Ledger migration › Discovery › Design: five people already have rows.
const DESIGN = BreakdownItemId.parse('wbs-012');

function setup(failEmployees = false) {
  const data = seedData();
  const state: PlanState = { projects: data.projects, items: data.breakdownItems, allocations: data.allocations };
  const repository = createFakeRepository(data);
  if (failEmployees) repository.failReads('employees', new RepositoryError('unavailable', 'people'));
  const report = { done: rs.fn(), failed: rs.fn() };
  const onClose = rs.fn();
  const onAssign = rs.fn();
  renderWithApp(
    <AssignPerson state={state} itemId={DESIGN} report={report} onClose={onClose} pending={[]} onAssign={onAssign} />,
    { repository },
  );
  return { repository, report, onClose, onAssign, user: userEvent.setup() };
}

describe('AssignPerson', () => {
  it('lists the employees who are not on the leaf yet, and says the row starts empty', async () => {
    setup();
    const dialog = await screen.findByRole('dialog', { name: 'Assign a person to "Design"' });
    const select = await within(dialog).findByRole('combobox', { name: 'Employee' });
    await within(dialog).findByRole('option', { name: 'Henrik Bauer — QA Engineer, 20 h/week' });
    const names = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(names).toContain('Henrik Bauer — QA Engineer, 20 h/week');
    // Adaeze Okafor, Milan Brandt, Anja Keller, Clara Bergmann and Maja Jankovic have rows on Design already.
    for (const name of ['Adaeze Okafor', 'Milan Brandt', 'Anja Keller', 'Clara Bergmann', 'Maja Jankovic']) {
      expect(names.some((label) => label.startsWith(name))).toBe(false);
    }
    expect(within(dialog).getByText(/The row appears with empty cells/)).toBeInTheDocument();
  });

  it('hands the choice to the grid and writes nothing', async () => {
    const { user, repository, report, onAssign, onClose } = setup();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Employee' }), 'emp-023');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('emp-023');
    });
    expect(report.done).toHaveBeenCalledWith('Added Henrik Bauer to Design. Enter a value in any month to save it.');
    expect(onClose).toHaveBeenCalled();
    expect(repository.written).toHaveLength(0);
  });

  it('asks for an employee instead of assigning nobody', async () => {
    const { user, onAssign, onClose } = setup();
    await user.click(await screen.findByRole('button', { name: 'Assign' }));
    expect(await screen.findByText('Choose who to assign')).toBeInTheDocument();
    expect(onAssign).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says why when People cannot be reached, and cannot be assigned from', async () => {
    setup(true);
    expect(await screen.findByText(/Employees can't be listed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });
});
