import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { RowActionId } from '@baseline/delivery-domain';
import { AddChildItem } from '../../../features/add-item';
import { DeleteItem } from '../../../features/delete-item';
import { MoveItem } from '../../../features/move-item';
import { RenameItem } from '../../../features/rename-item';
import { useGridActions } from '../model/GridActions';
import { usePlanState } from '../model/usePlanState';

interface ChosenActionProps {
  readonly action: RowActionId;
  readonly itemId: BreakdownItemId;
  readonly onClose: () => void;
}

/**
 * The feature behind the action the user chose. The widget composes the features because slices of one
 * layer can't import each other: each gets the plan as it is now, the item, where to report (D33) and
 * how to close, and knows nothing of the grid.
 */
export function ChosenAction({ action, itemId, onClose }: ChosenActionProps) {
  const state = usePlanState();
  const { report } = useGridActions();
  const props = { state, itemId, report, onClose };
  switch (action) {
    case 'rename':
      return <RenameItem {...props} />;
    case 'addChild':
      return <AddChildItem {...props} />;
    case 'move':
      return <MoveItem {...props} />;
    case 'delete':
      return <DeleteItem {...props} />;
    case 'assignPerson':
      return null;
  }
}
