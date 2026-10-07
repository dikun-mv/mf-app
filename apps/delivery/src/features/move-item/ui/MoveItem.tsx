import { moveItem, moveTargets, PATH_SEPARATOR, type MoveTarget } from '@baseline/delivery-domain';
import { Button, Dialog, InlineMessage } from '@baseline/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useApplyChangeSet } from '../../../shared/api';
import { describeDomainError, plural, type ItemActionProps } from '../../../shared/lib';
import styles from './MoveItem.module.css';

// Layer 1 of D27: a choice was made. The domain then checks the move itself, as layer 2.
const MoveForm = z.object({ parent: z.string().min(1, 'Choose a new parent') });
type MoveValues = z.infer<typeof MoveForm>;

/** The radio value of the top level; item ids can't collide with it. */
const TOP_LEVEL = 'top-level';
const valueOf = (target: MoveTarget): string => target.parentId ?? TOP_LEVEL;

/** The last name of a path: `Migration` for `Ledger migration › Migration`. */
const nameOf = (label: string): string => label.split(PATH_SEPARATOR).at(-1) ?? label;

/**
 * Move an item, with its sub-items, under another parent (screens 3.4). The picker lists every node of
 * the item's own project (D15) and nothing else; options the domain refuses are disabled, each with its
 * reason. Moving onto a leaf that has allocations hands them to the moved item (D9), and the dialog says
 * so when that option is chosen.
 */
export function MoveItem({ state, itemId, report, onClose }: ItemActionProps) {
  const formId = useId();
  const apply = useApplyChangeSet();
  const item = state.items.find((candidate) => candidate.id === itemId);
  const projectName = state.projects.find((project) => project.id === item?.projectId)?.name ?? 'this project';
  const targets = useMemo(() => {
    const listed = moveTargets(state, itemId);
    return listed.ok ? listed.value : [];
  }, [state, itemId]);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<MoveValues>({ resolver: zodResolver(MoveForm), defaultValues: { parent: '' } });
  const picked = useWatch({ control, name: 'parent' });
  const chosen = targets.find((target) => valueOf(target) === picked);

  // Another user deleted the item while the list was open: its row is going, and there is nothing to move.
  if (item === undefined) return null;

  const submit = handleSubmit(async ({ parent }) => {
    const target = targets.find((candidate) => valueOf(candidate) === parent);
    const moved = target === undefined ? undefined : moveItem(state, itemId, target.parentId);
    if (target === undefined || moved === undefined || !target.allowed) {
      setError('parent', { message: 'Choose one of the places this item can move to.' });
      return;
    }
    if (!moved.ok) {
      setError('parent', { message: describeDomainError(moved.error) });
      return;
    }
    onClose();
    const handed = moved.value.update.allocations.length;
    try {
      await apply.mutateAsync(moved.value);
      const where = target.parentId === null ? 'to the top level' : `under "${target.label}"`;
      const allocations =
        handed === 0 ? '' : ` ${plural(handed, 'allocation')} moved from ${nameOf(target.label)} to ${item.name}.`;
      report.done(`Moved "${item.name}" ${where}.${allocations}`);
    } catch (error) {
      report.failed(error);
    }
  });

  return (
    <Dialog
      open
      className={styles.dialog}
      title={`Move "${item.name}"`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary">
            Move
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
        <fieldset className={styles.picker} aria-describedby={errors.parent ? `${formId}-error` : undefined}>
          <legend className={styles.legend}>New parent — {projectName} only</legend>
          {targets.map((target) => (
            <label
              key={valueOf(target)}
              className={styles.option}
              style={{ paddingInlineStart: `calc(${String(target.depth)} * 1rem)` }}
            >
              <input type="radio" value={valueOf(target)} disabled={!target.allowed} {...register('parent')} />
              <span className={styles.target}>{target.label}</span>
              {!target.allowed && <span className={styles.reason}>{target.reason}</span>}
            </label>
          ))}
        </fieldset>
        {errors.parent?.message !== undefined && (
          <InlineMessage id={`${formId}-error`} tone="error">
            {errors.parent.message}
          </InlineMessage>
        )}
        {chosen?.allowed === true && chosen.movesAllocations > 0 && (
          <InlineMessage tone="info">
            "{nameOf(chosen.label)}" holds {plural(chosen.movesAllocations, 'allocation')}. Only leaves hold
            allocations, so they move to "{item.name}".
          </InlineMessage>
        )}
      </form>
    </Dialog>
  );
}
