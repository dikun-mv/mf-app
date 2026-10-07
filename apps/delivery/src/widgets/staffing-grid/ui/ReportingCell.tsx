import { EditableCell } from '../../../features/edit-cell';
import { useGridReport } from '../model/GridActions';
import type { CellSlotProps } from './slots/types';

/**
 * The cell renderer with the grid's status line behind it: the editor announces what it saved through
 * `report`, and the widget is the one that knows where that goes (a feature can't import it).
 */
export function ReportingCell(props: CellSlotProps) {
  return <EditableCell {...props} report={useGridReport()} />;
}
