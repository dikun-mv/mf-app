import { WriteFailedMessage } from '../../../features/edit-cell';
import { PeopleUnreachableMessage, UnitSwitcher } from '../../../features/switch-unit';
import type { ToolbarSlotProps } from './slots/types';

/**
 * The strip above the grid, in the order it reads: the write-failed message of T6.6 (screens 4: "at the
 * top of the widget"), T6.13's People-unreachable message, then T6.5's unit switcher. Later tasks add the
 * status line (D33) and T6.3's Add top-level item here, a line each. It is a component of its own because
 * the slot file holds one constant.
 */
export function Toolbar({ unit, units }: ToolbarSlotProps) {
  return (
    <>
      <WriteFailedMessage />
      <PeopleUnreachableMessage unit={unit} units={units} />
      <UnitSwitcher unit={unit} units={units} />
    </>
  );
}
