import type { DisplayUnit } from '@baseline/delivery-domain';
import { InlineMessage } from '@baseline/ui';
import { usePeopleUnreachable } from '../hooks/usePeopleUnreachable';

export interface PeopleUnreachableMessageProps {
  /** The unit the grid shows now. */
  unit: DisplayUnit;
  /** The units that can be shown now. */
  units: readonly DisplayUnit[];
}

/**
 * The grid's degraded state while People can't be reached (screens 3.6, T6.13, D32): Delivery's own data
 * is all there, so person-months and % keep working and can be edited, hours and cost are disabled in the
 * switcher, and people show as ids. This says so. It goes away by itself when People's data arrives.
 *
 * When the grid is asked for hours or cost meanwhile it can't be drawn at all, and the grid's own message
 * says the same thing there, so this one stays out of its way.
 */
export function PeopleUnreachableMessage({ unit, units }: PeopleUnreachableMessageProps) {
  const unreachable = usePeopleUnreachable();
  if (!unreachable || !units.includes(unit)) return null;
  return (
    <InlineMessage tone="warning">
      People&apos;s data can&apos;t be reached. Hours and cost need weekly hours and rates, so only Person-months and %
      are shown, and people show as ids. Retrying…
    </InlineMessage>
  );
}
