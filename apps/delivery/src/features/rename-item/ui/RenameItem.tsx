import { zodResolver } from '@hookform/resolvers/zod';
import { isEmptyChangeSet, renameItem } from '@baseline/delivery-domain';
import { TextField } from '@baseline/ui';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useApplyChangeSet } from '../../../shared/api';
import { describeDomainError, type ItemActionProps } from '../../../shared/lib';
import styles from './RenameItem.module.css';

// Layer 1 of D27: the shape. The domain then trims and refuses an empty name again, as layer 2.
const RenameForm = z.object({ name: z.string().trim().min(1, 'Enter a name') });
type RenameValues = z.infer<typeof RenameForm>;

/**
 * Rename in place (screens 3.4): one field in the row's label, holding the current name. Enter saves,
 * Esc cancels. The form closes as soon as the change is sent: the name is already the new one in the grid
 * (D26), and the result, or the reason it was undone, goes to the widget (D33). A name that didn't change
 * sends nothing.
 */
export function RenameItem({ state, itemId, report, onClose }: ItemActionProps) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  const apply = useApplyChangeSet();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<RenameValues>({ resolver: zodResolver(RenameForm), defaultValues: { name: item?.name ?? '' } });
  useEffect(() => {
    setFocus('name', { shouldSelect: true });
  }, [setFocus]);

  // Another user deleted the item while the field was open: its row is going, and there is nothing to rename.
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
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <TextField
        label={`New name for ${item.name}`}
        hideLabel
        error={errors.name?.message}
        hint="Enter saves · Esc cancels"
        autoComplete="off"
        {...register('name')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      />
    </form>
  );
}
