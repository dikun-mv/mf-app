import { AddTopLevelItem } from '../../../features/add-item';
import { WriteFailedMessage } from '../../../features/edit-cell';
import { PeopleUnreachableMessage, UnitSwitcher } from '../../../features/switch-unit';
import { useGridActions } from '../hooks/GridActions';
import { usePlanState } from '../hooks/usePlanState';
import type { ToolbarSlotProps } from './slots/types';
import styles from './Toolbar.module.css';

/**
 * The strip above the grid, in the order it reads: the write-failed message of T6.6 (screens 4: "at the
 * top of the widget"; it covers every write, cell and tree alike), T6.13's People-unreachable message,
 * then T6.5's unit switcher and T6.3's "+ Add top-level item". The grid's status line (D33) comes right
 * under it. It is a component of its own because the slot file holds one constant.
 */
export function Toolbar({ projectId, unit, units }: ToolbarSlotProps) {
  const state = usePlanState();
  const { report } = useGridActions();
  return (
    <>
      <WriteFailedMessage />
      <PeopleUnreachableMessage unit={unit} units={units} />
      <UnitSwitcher unit={unit} units={units} />
      <div className={styles.add}>
        <AddTopLevelItem state={state} projectId={projectId} report={report} />
      </div>
    </>
  );
}
