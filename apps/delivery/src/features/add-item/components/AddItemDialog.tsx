import type { BreakdownItem, ProjectId } from '@baseline/delivery-contract';
import {
  createItem,
  newBreakdownItemId,
  PATH_SEPARATOR,
  rowActions,
  type ChangeSet,
  type PlanState,
} from '@baseline/delivery-domain';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, InlineMessage, TextField } from '@baseline/ui';
import { useEffect, useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useApplyChangeSet } from '../../../shared/api';
import { describeDomainError, plural, type ActionReport } from '../../../shared/lib';
import styles from './AddItemDialog.module.css';

// Layer 1 of D27: the shape. The domain then trims and checks the rest, as layer 2.
const AddForm = z.object({ name: z.string().trim().min(1, 'Enter a name') });
type AddValues = z.infer<typeof AddForm>;

interface AddItemDialogProps {
  readonly state: PlanState;
  readonly projectId: ProjectId;
  /** The item the new one goes under, or null for the top level. */
  readonly parent: BreakdownItem | null;
  readonly report: ActionReport;
  readonly onClose: () => void;
}

/** How many allocations the parent hands to a new child (D9): only a leaf holds any. */
function allocationsMoved(state: PlanState, parent: BreakdownItem | null): number {
  if (parent === null) return 0;
  const actions = rowActions(state, parent.id);
  const add = actions.ok ? actions.value.find((action) => action.id === 'addChild') : undefined;
  return add?.allowed === true ? add.movesAllocations : 0;
}

/** What the status line says afterwards, with the move of D9 spelled out (screens 3.4). */
function describeAdded(name: string, parent: BreakdownItem | null, changes: ChangeSet): string {
  const moved = changes.update.allocations.length;
  const added = `Added "${name}".`;
  if (parent === null || moved === 0) return added;
  return `${added} ${plural(moved, 'allocation')} moved from ${parent.name} to ${parent.name}${PATH_SEPARATOR}${name}.`;
}

/**
 * The dialog that adds an item (screens 3.4), under a parent or at the top level. When the parent is a
 * leaf with allocations it says, before anything changes, that they move to the new item (D9). The dialog
 * closes once the change is sent; the result, or the reason it was undone, goes to the widget (D33).
 */
export function AddItemDialog({ state, projectId, parent, report, onClose }: AddItemDialogProps) {
  const formId = useId();
  const apply = useApplyChangeSet();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors },
  } = useForm<AddValues>({ resolver: zodResolver(AddForm), defaultValues: { name: '' } });
  // After the dialog has opened, which would otherwise put focus on its close button.
  useEffect(() => {
    setFocus('name');
  }, [setFocus]);
  const typed = useWatch({ control, name: 'name' }).trim();
  const moving = allocationsMoved(state, parent);

  const submit = handleSubmit(async ({ name }) => {
    const created = createItem(state, {
      id: newBreakdownItemId(),
      projectId,
      parentId: parent?.id ?? null,
      name,
    });
    if (!created.ok) {
      setError('name', { message: describeDomainError(created.error) });
      return;
    }
    onClose();
    try {
      await apply.mutateAsync(created.value);
      report.done(describeAdded(name, parent, created.value));
    } catch (error) {
      report.failed(error);
    }
  });

  return (
    <Dialog
      open
      className={styles.dialog}
      title={parent === null ? 'Add a top-level item' : `Add an item under "${parent.name}"`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary">
            Add item
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
        <TextField label="Name" autoComplete="off" error={errors.name?.message} {...register('name')} />
        {parent !== null && moving > 0 && (
          <InlineMessage tone="info">
            "{parent.name}" holds {plural(moving, 'allocation')}. Only leaves hold allocations, so they move to "
            {typed === '' ? 'the new item' : typed}".
          </InlineMessage>
        )}
      </form>
    </Dialog>
  );
}
