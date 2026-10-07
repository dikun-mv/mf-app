import type { GridRowView } from '@baseline/delivery-domain';
import type { ReactNode } from 'react';
import styles from './StaffingGrid.module.css';

export interface RowLabelProps {
  row: GridRowView;
  /** True when rows sit under this one: its name then toggles them. */
  expandable: boolean;
  expanded: boolean;
  onToggle: (key: string) => void;
  /** After the name, still inside the label cell: the row's actions. */
  children?: ReactNode;
}

/**
 * The row header: the name indented by depth, a control to expand or collapse the rows under it, and
 * whatever else belongs to the row's label. The control is the only focusable thing on a derived row
 * besides its actions (D36), and its state is `aria-expanded`.
 */
export function RowLabel({ row, expandable, expanded, onToggle, children }: RowLabelProps) {
  // The project row and the top-level items start at the edge; each level below steps in.
  const indent = Math.max(row.depth - 1, 0);
  return (
    <th
      scope="row"
      className={styles.label}
      style={{ paddingInlineStart: `calc(var(--bl-space-3) + ${String(indent)} * 1.25rem)` }}
    >
      <div className={styles.labelContent}>
        {expandable ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            onClick={() => {
              onToggle(row.key);
            }}
          >
            <span aria-hidden="true" className={styles.twisty}>
              {expanded ? '▾' : '▸'}
            </span>
            {row.label}
          </button>
        ) : (
          <span className={styles.name}>{row.label}</span>
        )}
        {children}
      </div>
    </th>
  );
}
