import type { ProjectId } from '@baseline/delivery-contract';
import type {
  DisplayUnit,
  GridMonthView,
  GridView,
  PersonCellView,
  PersonRowView,
  SumRowView,
} from '@baseline/delivery-domain';
import type { ComponentType, ReactNode } from 'react';
import type { FocusedCell } from '../../model/useFocusedCell';

// The props of the grid's five slots. They are written in `delivery-domain`'s types alone, so a feature
// slice can type its component without importing this widget (a feature can't import a widget upward).

/** What identifies a person cell: its row, its view, its month and the unit shown. */
export interface CellProps {
  readonly row: PersonRowView;
  readonly cell: PersonCellView;
  readonly month: GridMonthView;
  readonly unit: DisplayUnit;
}

/**
 * One person cell: render what goes inside its `<td>`, with the two extras the grid passes in. Place
 * `adornment` beside the value, and set `aria-describedby={describedById}` on the cell's focusable element
 * (the button or input), so a screen reader reads the details panel's text for the cell (D36).
 */
export interface CellSlotProps extends CellProps {
  /** The cell adornment slot's output (the markers), or null when that slot is empty. */
  readonly adornment: ReactNode;
  /** The id of the details panel (`DetailsSlotProps.id`), the same for every cell of the grid. */
  readonly describedById: string;
}

/** A small node placed next to a person cell's value (T6.9's markers), from the cell's view alone. */
export type CellAdornmentSlotProps = CellProps;

/**
 * One WBS row's actions, rendered in its label cell after the name. The grid owns which row's actions are
 * open (one at a time, D36): render the `⋯` disclosure button with `open` as its `aria-expanded` and
 * `onToggle` as its click, and the actions themselves only while `open`.
 */
export interface RowActionsSlotProps {
  readonly row: SumRowView;
  readonly open: boolean;
  readonly onToggle: () => void;
}

/** The strip above the table: the unit switcher, the status line, "Add top-level item". */
export interface ToolbarSlotProps {
  readonly projectId: ProjectId;
  readonly unit: DisplayUnit;
  /** The units that can be shown now; hours and cost need People's data (screens 3.6). */
  readonly units: readonly DisplayUnit[];
}

/** The panel under the table that follows the focused cell. `focus` is null until a cell has had focus. */
export interface DetailsSlotProps {
  /** Put this `id` on the panel's element: the cells' `aria-describedby` points at it. */
  readonly id: string;
  readonly view: GridView;
  readonly focus: FocusedCell | null;
}

export type CellSlot = ComponentType<CellSlotProps>;
export type CellAdornmentSlot = ComponentType<CellAdornmentSlotProps>;
export type RowActionsSlot = ComponentType<RowActionsSlotProps>;
export type ToolbarSlot = ComponentType<ToolbarSlotProps>;
export type DetailsSlot = ComponentType<DetailsSlotProps>;
