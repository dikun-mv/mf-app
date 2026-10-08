import type { ItemActionProps } from '../../../shared/lib';
import { AddItemDialog } from './AddItemDialog';

/** "Add child item" on a WBS row (screens 3.4): the dialog for a new item under that row's item. */
export function AddChildItem({ state, itemId, report, onClose }: ItemActionProps) {
  const parent = state.items.find((item) => item.id === itemId);
  // Another user deleted the parent while the list was open: its row is going, and there is nothing to add under.
  if (parent === undefined) return null;
  return <AddItemDialog state={state} projectId={parent.projectId} parent={parent} report={report} onClose={onClose} />;
}
