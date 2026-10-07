import type { GridRowView } from '@baseline/delivery-domain';

/** A row to draw, and how its label's expand or collapse control looks. */
export interface VisibleRow {
  readonly row: GridRowView;
  /** True when other rows sit under it, which are shown or hidden by its control. */
  readonly expandable: boolean;
  readonly expanded: boolean;
}

/**
 * The rows to draw for the nodes the user collapsed (D31). `rows` is in tree order, as `gridView` returns
 * it, so a row's parent comes before it. Collapsing a node only hides what is under it: its own row, with
 * its sums, stays. The project row has no control and is always open.
 */
export function visibleRows(rows: readonly GridRowView[], collapsed: ReadonlySet<string>): VisibleRow[] {
  const parents = new Set(rows.map((row) => row.parentKey));
  const open = new Map<string, boolean>();
  const shown: VisibleRow[] = [];
  for (const row of rows) {
    const reachable = row.parentKey === null || open.get(row.parentKey) === true;
    const expandable = row.kind !== 'project' && parents.has(row.key);
    const expanded = !(expandable && collapsed.has(row.key));
    // What is under a row is shown only when the row itself is shown and not collapsed.
    open.set(row.key, reachable && expanded);
    if (reachable) shown.push({ row, expandable, expanded });
  }
  return shown;
}
