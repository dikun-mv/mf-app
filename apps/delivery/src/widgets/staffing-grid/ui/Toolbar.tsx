import { StatusMessage } from '@baseline/ui';
import { WriteFailedMessage } from '../../../features/edit-cell';
import { PeopleUnreachableMessage, UnitSwitcher } from '../../../features/switch-unit';
import { useAnnouncement } from '../../../shared/lib';
import type { ToolbarSlotProps } from './slots/types';

/**
 * The strip above the grid, in the order it reads: the write-failed message of T6.6 (screens 4: "at the
 * top of the widget"), T6.13's People-unreachable message, T6.5's unit switcher, then the status line (D33).
 * The status line is always rendered, so a screen reader announces its changes; features fill it with
 * `useAnnounce()`. T6.3's Add top-level item goes here as a line. It is a component of its own because the
 * slot file holds one constant.
 */
export function Toolbar({ unit, units }: ToolbarSlotProps) {
  const announcement = useAnnouncement();
  return (
    <>
      <WriteFailedMessage />
      <PeopleUnreachableMessage unit={unit} units={units} />
      <UnitSwitcher unit={unit} units={units} />
      <StatusMessage>{announcement}</StatusMessage>
    </>
  );
}
