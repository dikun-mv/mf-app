import type { DisplayUnit, GridMonthView, PersonRowView, SumRowView } from '@baseline/delivery-domain';
import { clsx } from 'clsx';
import { memo } from 'react';
import { RowLabel } from './RowLabel';
import { cellSlot as Cell } from './slots/cell';
import { rowActionsSlot as RowActions } from './slots/rowActions';
import styles from './StaffingGrid.module.css';

interface SumRowProps {
  row: SumRowView;
  expandable: boolean;
  expanded: boolean;
  /** Whether this row's actions are open; the grid keeps one row open at a time. */
  actionsOpen: boolean;
  /** One callback for the whole grid: the row passes its key, so rows keep their props between renders. */
  onToggle: (key: string) => void;
  onToggleActions: (key: string) => void;
}

/**
 * The project row and a WBS row: sums only. Their value cells are plain `<td>` text with nothing to
 * focus, so Tab skips them (D36, screens 3.2); only the label's controls are reachable. WBS rows get the
 * actions slot in their label.
 */
export const SumRow = memo(function SumRow({
  row,
  expandable,
  expanded,
  actionsOpen,
  onToggle,
  onToggleActions,
}: SumRowProps) {
  return (
    <tr className={row.kind === 'project' ? styles.project : styles.node}>
      <RowLabel row={row} expandable={expandable} expanded={expanded} onToggle={onToggle}>
        {row.kind === 'node' && RowActions !== null && (
          <RowActions
            row={row}
            open={actionsOpen}
            onToggle={() => {
              onToggleActions(row.key);
            }}
          />
        )}
      </RowLabel>
      {row.cells.map((cell, position) => (
        <td key={position} className={styles.value}>
          {cell.text}
        </td>
      ))}
      <td className={clsx(styles.value, styles.total)}>{row.total.text}</td>
    </tr>
  );
});

/**
 * A person under a leaf: the cells that hold allocations, drawn by the cell slot. Each `<td>` carries
 * its row and month so the grid can tell which cell has focus.
 */
export const PersonRow = memo(function PersonRow({
  row,
  months,
  unit,
}: {
  row: PersonRowView;
  months: readonly GridMonthView[];
  unit: DisplayUnit;
}) {
  return (
    <tr className={styles.person}>
      <RowLabel row={row} expandable={false} expanded onToggle={noop} />
      {row.cells.map((cell, position) => {
        const month = months[position];
        return (
          <td key={cell.month} className={styles.value} data-row-key={row.key} data-month-index={position}>
            {month !== undefined && <Cell row={row} cell={cell} month={month} unit={unit} />}
          </td>
        );
      })}
      <td className={clsx(styles.value, styles.total)}>{row.total.text}</td>
    </tr>
  );
});

function noop(): void {
  // A person row has nothing under it to toggle.
}
