import { DefaultCell } from '../DefaultCell';
import type { CellSlot } from './types';

/**
 * The cell renderer. Wiring line for T6.6 (editing, e.g. `features/edit-cell`): replace `DefaultCell` with
 * the editor, which can render `DefaultCell`'s text where it doesn't edit. T6.9's markers are drawn around
 * the value by the same renderer; if both tasks wire it, compose the two here.
 */
export const cellSlot: CellSlot = DefaultCell;
