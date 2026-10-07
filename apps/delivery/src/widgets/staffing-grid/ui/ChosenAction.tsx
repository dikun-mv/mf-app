import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { RowActionId } from '@baseline/delivery-domain';
import { useMemo } from 'react';
import { AddChildItem } from '../../../features/add-item';
import { AssignPerson } from '../../../features/assign-person';
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
  const { report, assigned, assign } = useGridActions();
  const props = { state, itemId, report, onClose };
  // Who was added to this item on this page and has no allocation yet.
  const pending = useMemo(
    () => assigned.filter((entry) => entry.itemId === itemId).map((entry) => entry.employeeId),
    [assigned, itemId],
  );
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
      return (
        <AssignPerson
          {...props}
          pending={pending}
          onAssign={(employeeId) => {
            assign(itemId, employeeId);
          }}
        />
      );
  }
}
