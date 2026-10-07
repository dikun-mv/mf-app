import type { PersonRowView, SumRowView } from '@baseline/delivery-domain';
import { clsx } from 'clsx';
import { memo } from 'react';
import { DefaultCell } from './DefaultCell';
import { RowLabel } from './RowLabel';
import styles from './StaffingGrid.module.css';

interface RowProps {
  expandable: boolean;
  expanded: boolean;
  /** One callback for the whole grid: the row passes its key, so rows keep their props between renders. */
  onToggle: (key: string) => void;
}

/**
 * The project row and a WBS row: sums only. Their value cells are plain `<td>` text with nothing to
 * focus, so Tab skips them (D36, screens 3.2); only the label's controls are reachable.
 */
export const SumRow = memo(function SumRow({ row, expandable, expanded, onToggle }: RowProps & { row: SumRowView }) {
  return (
    <tr className={row.kind === 'project' ? styles.project : styles.node}>
      <RowLabel row={row} expandable={expandable} expanded={expanded} onToggle={onToggle} />
      {row.cells.map((cell, position) => (
        <td key={position} className={styles.value}>
          {cell.text}
        </td>
      ))}
      <td className={clsx(styles.value, styles.total)}>{row.total.text}</td>
    </tr>
  );
});

/** A person under a leaf: the cells that hold allocations. */
export const PersonRow = memo(function PersonRow({ row }: { row: PersonRowView }) {
  return (
    <tr className={styles.person}>
      <RowLabel row={row} expandable={false} expanded onToggle={noop} />
      {row.cells.map((cell) => (
        <td key={cell.month} className={styles.value}>
          <DefaultCell cell={cell} />
        </td>
      ))}
      <td className={clsx(styles.value, styles.total)}>{row.total.text}</td>
    </tr>
  );
});

function noop(): void {
  // A person row has nothing under it to toggle.
}
