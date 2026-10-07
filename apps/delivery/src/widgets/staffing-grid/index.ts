// widgets/staffing-grid (T6.4): the staffing grid of one project, read-only, and the five slots that
// later Delivery tasks fill from their own slices (plan §4, "The grid leaves slots").
//
// Slots. Each lives in its own file under `ui/slots/` and holds one exported constant, so a task changes
// only its file: one import and the one line that replaces the default. Props are in `ui/slots/types.ts`
// and use `delivery-domain` types only, so a feature slice can type its component without importing this
// widget (a feature can't import a widget).
//
//   cell        `ui/slots/cell.ts`        `cellSlot: ComponentType<CellSlotProps>`
//               What goes inside a person cell's `<td>`. Wired to the editor of `features/edit-cell`
//               (T6.6): a button with the value that becomes an input. `ui/DefaultCell.tsx` is the
//               read-only version, kept as the model for a renderer. Besides the cell it gets `adornment`
//               (the node the next slot returned, to place beside the value) and `describedById` (to
//               set as `aria-describedby` on its focusable element); `ui/DefaultCell.tsx` shows both.
//   adornment   `ui/slots/cellAdornment.ts` `cellAdornmentSlot: ComponentType<CellAdornmentSlotProps> | null`
//               Rendered by the grid for each person cell from the cell's view, and passed to the cell
//               renderer as `adornment`. Default: none. T6.9 wires the markers here, so editing (T6.6)
//               and markers never edit the same file.
//   row actions `ui/slots/rowActions.ts`  `rowActionsSlot: ComponentType<RowActionsSlotProps> | null`
//               Rendered after the name in the label cell of every WBS row (not the project row, not
//               person rows). The grid owns which row is open (`open`, `onToggle`). Default: none. T6.3.
//   toolbar     `ui/slots/toolbar.ts`     `toolbarSlot: ComponentType<ToolbarSlotProps> | null`
//               Above the table, always drawn, also when the grid can't be shown (hours or cost without
//               People's data), so the unit can be changed out of that state. Gets the project, the
//               unit and the units available. Wired to `ui/Toolbar.tsx` (T6.5, T6.6, T6.13): the unit switcher and
//               its messages.
//   details     `ui/slots/details.ts`     `detailsSlot: ComponentType<DetailsSlotProps> | null`
//               Below the table: the `GridView` and the cell that last had focus (row key and month
//               position). Set the `id` it receives on the panel: it is what `describedById` names.
//               Default: none. T6.12.
//
// The grid shows person-months unless given `unit`; the project page reads `?unit=` (T6.5) and passes it.
export { StaffingGrid, type StaffingGridProps } from './ui/StaffingGrid';
