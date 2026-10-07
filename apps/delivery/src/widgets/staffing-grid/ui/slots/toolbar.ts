import { UnitSwitcher } from '../../../../features/switch-unit';
import type { ToolbarSlot } from './types';

/**
 * The strip above the grid, for T6.5 (the unit switcher), the status line (D33) and T6.3's Add top-level
 * item. Wiring line: replace the component with the one that places them.
 */
export const toolbarSlot: ToolbarSlot | null = UnitSwitcher;
