import type { ProjectId } from '@baseline/delivery-contract';
import type { DisplayUnit } from '@baseline/delivery-domain';
import { InlineMessage, Spinner, StatusMessage } from '@baseline/ui';
import { clsx } from 'clsx';
import { useCallback, useId, useMemo, useState } from 'react';
import { describeGridError } from '../lib/describeGridError';
import { visibleRows } from '../lib/visibleRows';
import { GridActionsProvider, useGridAssignments, useGridFeedback } from '../model/GridActions';
import { useFocusedCell } from '../model/useFocusedCell';
import { useGridView } from '../model/useGridView';
import { PersonRow, SumRow } from './GridRows';
import { detailsSlot as Details } from './slots/details';
import { toolbarSlot as Toolbar } from './slots/toolbar';
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
 *
 * The toolbar above the table, the cell renderer and its adornment, the row actions and the details panel below are slots
 * (`ui/slots/`, see the widget's `index.ts`).
 */
export function StaffingGrid({ projectId, unit = 'personMonths' }: StaffingGridProps) {
  // People assigned to a leaf and not yet given a value: rows that exist only in this page (T6.7, D31).
  const { assigned, assign } = useGridAssignments();
  const { result, units, peopleLoading } = useGridView(projectId, unit, assigned);
  // What the features in the slots report (D33): the status line, and a failed write's message.
  const { status, failure, report } = useGridFeedback();
  const actions = useMemo(() => ({ report, assigned, assign }), [report, assigned, assign]);
  // Keys of the collapsed nodes: empty means everything is open, as on load. Local state (D31).
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  // The row whose actions are open: one at a time, and closed again by choosing an action (D36).
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);
  const { focus, onFocus } = useFocusedCell();
  // The details panel's id: the cells point their `aria-describedby` at it (D36).
  const detailsId = useId();

  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);
  const toggleActions = useCallback((key: string) => {
    setActionsOpen((current) => (current === key ? null : key));
  }, []);

  const rows = result.ok ? result.value.rows : null;
  const shown = useMemo(() => (rows === null ? [] : visibleRows(rows, collapsed)), [rows, collapsed]);

  // The toolbar is always there, so the unit can be changed out of a grid that can't be shown.
  const toolbar = Toolbar !== null && <Toolbar projectId={projectId} unit={unit} units={units} />;
  // A failed write at the top of the widget, the last result in the status line under the toolbar (D33).
  const failed = failure !== null && <InlineMessage tone={failure.tone}>{failure.text}</InlineMessage>;
  const statusLine = <StatusMessage>{status}</StatusMessage>;
  if (!result.ok) {
    // Hours and cost wait for People's data (which never suspends, D32), unless it has failed.
    const waiting = result.error.code === 'unitUnavailable' && peopleLoading;
    return (
      <GridActionsProvider value={actions}>
        <div className={styles.widget}>
          {failed}
          {toolbar}
          {statusLine}
          {waiting ? (
            <p className={styles.loading}>
              <Spinner aria-label="Loading staffing grid" />
              <span>Loading staffing grid…</span>
            </p>
          ) : (
            <InlineMessage tone="error">{describeGridError(result.error)}</InlineMessage>
          )}
        </div>
      </GridActionsProvider>
    );
  }
  const view = result.value;
  return (
    <GridActionsProvider value={actions}>
      <div className={styles.widget}>
        {failed}
        {toolbar}
        {statusLine}
        <div className={styles.scroll} onFocus={onFocus}>
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
                  <PersonRow key={row.key} row={row} months={view.months} unit={view.unit} describedById={detailsId} />
                ) : (
                  <SumRow
                    key={row.key}
                    row={row}
                    expandable={expandable}
                    expanded={expanded}
                    actionsOpen={actionsOpen === row.key}
                    onToggle={toggle}
                    onToggleActions={toggleActions}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
        {Details !== null && <Details id={detailsId} view={view} focus={focus} />}
      </div>
    </GridActionsProvider>
  );
}
