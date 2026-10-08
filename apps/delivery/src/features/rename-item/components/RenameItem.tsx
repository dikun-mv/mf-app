import { zodResolver } from '@hookform/resolvers/zod';
import { isEmptyChangeSet, renameItem } from '@baseline/delivery-domain';
import { Button, Dialog, TextField } from '@baseline/ui';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useApplyChangeSet } from '../../../shared/api';
import { describeDomainError, type ItemActionProps } from '../../../shared/lib';
import styles from './RenameItem.module.css';

// Layer 1 of D27: the shape. The domain then trims and refuses an empty name again, as layer 2.
const RenameForm = z.object({ name: z.string().trim().min(1, 'Enter a name') });
type RenameValues = z.infer<typeof RenameForm>;

/**
 * The dialog that renames an item (screens 3.4), like the one that adds one: a single Name field holding the
 * current name, selected, so typing replaces it. Enter or Rename saves; Cancel, the close button and Esc
 * close it without writing. The dialog closes as soon as the change is sent: the name is already the new one
 * in the grid (D26), and the result, or the reason it was undone, goes to the widget (D33). A name that
 * didn't change sends nothing. A name the domain refuses is shown on the field and the dialog stays open.
 */
export function RenameItem({ state, itemId, report, onClose }: ItemActionProps) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  const formId = useId();
  const apply = useApplyChangeSet();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<RenameValues>({ resolver: zodResolver(RenameForm), defaultValues: { name: item?.name ?? '' } });
  // After the dialog has opened, which would otherwise put focus on its close button.
  useEffect(() => {
    setFocus('name', { shouldSelect: true });
  }, [setFocus]);

  // Another user deleted the item while the dialog was open: its row is going, and there is nothing to rename.
  if (item === undefined) return null;

  const submit = handleSubmit(async ({ name }) => {
    const renamed = renameItem(state, itemId, name);
    if (!renamed.ok) {
      setError('name', { message: describeDomainError(renamed.error) });
      return;
    }
    onClose();
    if (isEmptyChangeSet(renamed.value)) return;
    try {
      await apply.mutateAsync(renamed.value);
      report.done(`Renamed "${item.name}" to "${name}".`);
    } catch (error) {
      report.failed(error);
    }
  });

  return (
    <Dialog
      open
      className={styles.dialog}
      title={`Rename "${item.name}"`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary">
            Rename
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
      </form>
    </Dialog>
  );
}
