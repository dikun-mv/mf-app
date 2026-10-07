import type { DisplayUnit, GridMonthView, PersonCellView, PersonRowView } from '@baseline/delivery-domain';
import type { ReactNode } from 'react';

/**
 * What the grid's cell slot hands a renderer (`CellSlotProps` in the staffing grid), written in
 * `delivery-domain`'s types alone: a feature can't import the widget that uses it.
 */
export interface EditableCellProps {
  readonly row: PersonRowView;
  readonly cell: PersonCellView;
  readonly month: GridMonthView;
  readonly unit: DisplayUnit;
  /** What to place beside the value (the markers), or null. */
  readonly adornment: ReactNode;
  /** The details panel's id, for `aria-describedby` on the focusable element when there is an adornment. */
  readonly describedById: string;
}
