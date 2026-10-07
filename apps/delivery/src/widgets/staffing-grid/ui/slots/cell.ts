import { ReportingCell } from '../ReportingCell';
import type { CellSlot } from './types';

/**
 * The cell renderer: T6.6's editor (`features/edit-cell`), given where to announce a save. It places the
 * `adornment` it is given (T6.9's markers, wired in `cellAdornment.ts`) and sets
 * `aria-describedby={describedById}` on its focusable element; `DefaultCell` is the read-only version
 * that shows where each goes.
 */
export const cellSlot: CellSlot = ReportingCell;
