import type { ProjectId } from '@baseline/delivery-contract';
import type { DisplayUnit } from '@baseline/delivery-domain';
import { InlineMessage } from '@baseline/ui';
import { clsx } from 'clsx';
import { useCallback, useMemo, useState } from 'react';
import { visibleRows } from '../lib/visibleRows';
import { useGridView } from '../model/useGridView';
import { PersonRow, SumRow } from './GridRows';
import styles from './StaffingGrid.module.css';

/** How each unit reads in the table's accessible name. */
const UNIT_NAMES: Record<DisplayUnit, string> = {
  hours: 'hours',
  personMonths: 'person-months',
  percent: '% of capacity',
  cost: 'cost',
};

export interface StaffingGridProps {
  projectId: ProjectId;
  /** What the cells show. Person-months until the unit switcher exists (T6.5). */
  unit?: DisplayUnit;
}

/**
 * The staffing grid of one project (screens 3.2): a project row, then the WBS with a row per person under
 * each leaf, a column per month and a Total. Every number comes from `gridView` (D35), already rounded so
 * that rows and columns add up. Nodes start expanded, and collapsing one hides its rows but keeps its
 * sums (D31). The label and Total columns stay in place while the months scroll sideways. Suspends until
 * Delivery's collections are loaded; the page shows that state (D32).
 */
export function StaffingGrid({ projectId, unit = 'personMonths' }: StaffingGridProps) {
  const { result } = useGridView(projectId, unit);
  // Keys of the collapsed nodes: empty means everything is open, as on load. Local state (D31).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const rows = result.ok ? result.value.rows : null;
  const shown = useMemo(() => (rows === null ? [] : visibleRows(rows, collapsed)), [rows, collapsed]);

  if (!result.ok) {
    return <InlineMessage tone="error">The grid can&apos;t be shown ({result.error.code}).</InlineMessage>;
  }
  const view = result.value;
  return (
    <div className={styles.scroll}>
      <table className={styles.grid}>
        <caption className={styles.visuallyHidden}>
          Staffing grid for {view.project.name}, in {UNIT_NAMES[view.unit]}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={clsx(styles.head, styles.label)}>
              Work package / person
            </th>
            {view.months.map((month) => (
              <th key={month.month} scope="col" className={clsx(styles.head, styles.numeric)} title={month.name}>
                {month.label}
              </th>
            ))}
            <th scope="col" className={clsx(styles.head, styles.numeric, styles.total)}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map(({ row, expandable, expanded }) =>
            row.kind === 'person' ? (
              <PersonRow key={row.key} row={row} />
            ) : (
              <SumRow key={row.key} row={row} expandable={expandable} expanded={expanded} onToggle={toggle} />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
