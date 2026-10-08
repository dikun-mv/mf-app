import { EmployeeId } from '@baseline/people-contract';
import { Button, Dialog, InlineMessage, Select } from '@baseline/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEmployees } from '../../../entities/employee';
import type { ItemActionProps } from '../../../shared/lib';
import { assignableEmployees, describeEmployee } from '../lib/assignableEmployees';
import styles from './AssignPerson.module.css';

// Layer 1 of D27: an employee was chosen. The id is then checked against the contract's schema.
const AssignForm = z.object({ employeeId: z.string().min(1, 'Choose who to assign') });
type AssignValues = z.infer<typeof AssignForm>;

export interface AssignPersonProps extends ItemActionProps {
  /** People already added to this item on this page, with no allocation yet: they aren't offered again. */
  readonly pending: readonly EmployeeId[];
  /** Adds the person's row to the grid, in the page only (T6.7, D31): nothing is written. */
  readonly onAssign: (employeeId: EmployeeId) => void;
}

/**
 * Assign a person to a leaf (screens 3.5): choose among the employees not on it yet. It writes nothing:
 * the person's row appears with empty cells and exists only in this page until a value is saved in one of
 * its months, which creates the first allocation. So the dialog says what will happen to the row.
 */
export function AssignPerson({ state, itemId, report, onClose, pending, onAssign }: AssignPersonProps) {
  const formId = useId();
  const people = useEmployees();
  const item = state.items.find((candidate) => candidate.id === itemId);
  const available = useMemo(
    () => assignableEmployees(people.data ?? [], state.allocations, itemId, pending),
    [people.data, state.allocations, itemId, pending],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssignValues>({ resolver: zodResolver(AssignForm), defaultValues: { employeeId: '' } });

  // Another user deleted the item while the list was open: its row is going, and there is nothing to assign to.
  if (item === undefined) return null;

  // People's employees never suspend (D32): say which of the three states the list is in.
  const unavailable =
    people.data === undefined
      ? people.isPending
        ? 'Loading employees…'
        : "Employees can't be listed: the People service didn't respond. Try again in a moment."
      : available.length === 0
        ? `Everyone is already on "${item.name}".`
        : null;

  const submit = handleSubmit(({ employeeId }) => {
    const chosen = available.find((employee) => employee.id === employeeId);
    if (chosen === undefined) return;
    onAssign(EmployeeId.parse(chosen.id));
    report.done(`Added ${chosen.name} to ${item.name}. Enter a value in any month to save it.`);
    onClose();
  });

  return (
    <Dialog
      open
      className={styles.dialog}
      title={`Assign a person to "${item.name}"`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" disabled={unavailable !== null}>
            Assign
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        {unavailable === null ? (
          <>
            <Select label="Employee" error={errors.employeeId?.message} {...register('employeeId')}>
              <option value="">Choose an employee</option>
              {available.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {describeEmployee(employee)}
                </option>
              ))}
            </Select>
            <InlineMessage tone="info">
              The row appears with empty cells. Enter a value in any month to save it.
            </InlineMessage>
          </>
        ) : (
          <InlineMessage tone="warning">{unavailable}</InlineMessage>
        )}
      </form>
    </Dialog>
  );
}
