import { AddTopLevelItem } from '../../../features/add-item';
import { useGridActions } from '../model/GridActions';
import { usePlanState } from '../model/usePlanState';
import styles from './GridToolbar.module.css';
import type { ToolbarSlotProps } from './slots/types';

/**
 * What the strip above the grid holds from the tree operations: "+ Add top-level item" (screens 3.2). The
 * unit switcher (T6.5) joins it when that task wires the slot.
 */
export function GridToolbar({ projectId }: ToolbarSlotProps) {
  const state = usePlanState();
  const { report } = useGridActions();
  return (
    <div className={styles.toolbar}>
      <AddTopLevelItem state={state} projectId={projectId} report={report} />
    </div>
  );
}
