import { Toolbar } from '../Toolbar';
import type { ToolbarSlot } from './types';

/**
 * The strip above the grid, for T6.5 (the unit switcher), T6.6's write-failed message, the status line (D33)
 * and T6.3's Add top-level item. Wiring line: the component that places them is `components/Toolbar.tsx`.
 */
export const toolbarSlot: ToolbarSlot | null = Toolbar;
