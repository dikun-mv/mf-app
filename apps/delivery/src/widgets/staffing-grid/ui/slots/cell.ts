import { DefaultCell } from '../DefaultCell';
import type { CellSlot } from './types';

/**
 * The cell renderer. Wiring line for T6.6 (editing, e.g. `features/edit-cell`): replace `DefaultCell` with
 * the editor. It places the `adornment` it is given (T6.9's markers, wired in `cellAdornment.ts`) and sets
 * `aria-describedby={describedById}` on its focusable element; `DefaultCell` shows where each goes.
 */
export const cellSlot: CellSlot = DefaultCell;
