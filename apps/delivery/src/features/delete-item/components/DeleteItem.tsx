import { deleteItem } from '@baseline/delivery-domain';
import { Button, Dialog } from '@baseline/ui';
import { useApplyChangeSet } from '../../../shared/api';
import type { ItemActionProps } from '../../../shared/lib';
import { describeDeleted, describeDeletion } from '../lib/describeDeletion';
import styles from './DeleteItem.module.css';

/**
 * Delete an item with everything under it (screens 3.4). The dialog counts what goes, from the same change
 * set it then sends (T1.12), so the count and the delete can't disagree; afterwards the status line reports
 * the counts again (D33). It has no fields, so no form library (D27).
 */
export function DeleteItem({ state, itemId, report, onClose }: ItemActionProps) {
  const apply = useApplyChangeSet();
  const item = state.items.find((candidate) => candidate.id === itemId);
  const deletion = deleteItem(state, itemId);
  // Another user deleted the item while the list was open: its row is going with it.
  if (item === undefined || !deletion.ok) return null;

  const { itemIds, allocationIds } = deletion.value.delete;
  const names = itemIds.map((id) => state.items.find((candidate) => candidate.id === id)?.name ?? id);

  const confirm = async () => {
    onClose();
    try {
      await apply.mutateAsync(deletion.value);
      report.done(describeDeleted(itemIds.length, allocationIds.length));
    } catch (error) {
      report.failed(error);
    }
  };

  return (
    <Dialog
      open
      className={styles.dialog}
      title={`Delete "${item.name}"?`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              void confirm();
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <p className={styles.counts}>{describeDeletion({ names, allocations: allocationIds.length })}</p>
      <p className={styles.counts}>It can't be undone.</p>
    </Dialog>
  );
}
