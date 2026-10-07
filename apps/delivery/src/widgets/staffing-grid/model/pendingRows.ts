import type { BreakdownItemId } from '@baseline/delivery-contract';
import {
  indexItems,
  isLeaf,
  ok,
  projectMonths,
  rowKey,
  type GridView,
  type GridViewError,
  type PlanState,
  type Result,
} from '@baseline/delivery-domain';
import { AllocationId } from '@baseline/delivery-contract';
import { IsoDateTime } from '@baseline/host-contract';
import type { EmployeeId } from '@baseline/people-contract';

// A person assigned to a leaf shows as a row with empty cells before any value is saved (T6.7, screens
// 3.5). Nothing is stored for it, so it lives in the page (D31): the grid keeps the list of assignments,
// and the pieces here show them without teaching `gridView` about rows it doesn't have a record for.

/** A person added to a leaf in this page, with no allocation saved for them yet. */
export interface PendingAssignment {
  readonly itemId: BreakdownItemId;
  readonly employeeId: EmployeeId;
}

export const NO_ASSIGNMENTS: readonly PendingAssignment[] = [];

/** Never stored, never shown: stands in for a pending row's first cell so `gridView` lays the row out. */
const PLACEHOLDER_EDITED_AT = IsoDateTime.parse('1970-01-01T00:00:00.000Z');

export interface PlanWithPending {
  readonly plan: PlanState;
  /** The keys of the rows that exist only because of a pending assignment. */
  readonly pendingKeys: ReadonlySet<string>;
}

/**
 * The plan with a placeholder of zero person-months for each pending assignment that still has no
 * allocation, in the project's first month. `gridView` then draws the person's row; zero adds nothing to
 * any sum, load or marker. A row whose first value was saved has real allocations by then and needs no
 * placeholder. Assignments to items that are gone, or are no longer leaves, are skipped (D9).
 */
export function withPendingRows(plan: PlanState, assigned: readonly PendingAssignment[]): PlanWithPending {
  const pendingKeys = new Set<string>();
  if (assigned.length === 0) return { plan, pendingKeys };

  const index = indexItems(plan.items);
  const held = new Set(plan.allocations.map((allocation) => rowKey(allocation.breakdownItemId, allocation.employeeId)));
  const placeholders = assigned.flatMap(({ itemId, employeeId }, position) => {
    const item = index.byId.get(itemId);
    const project = plan.projects.find((candidate) => candidate.id === item?.projectId);
    const month = project === undefined ? undefined : projectMonths(project)[0];
    const key = rowKey(itemId, employeeId);
    if (month === undefined || !isLeaf(index, itemId) || held.has(key) || pendingKeys.has(key)) return [];
    pendingKeys.add(key);
    return [
      {
        id: AllocationId.parse(`alloc-${String(position)}`),
        breakdownItemId: itemId,
        employeeId,
        month,
        amount: 0,
        editedAt: PLACEHOLDER_EDITED_AT,
      },
    ];
  });
  if (placeholders.length === 0) return { plan, pendingKeys };
  return { plan: { ...plan, allocations: [...plan.allocations, ...placeholders] }, pendingKeys };
}

/**
 * The view with the placeholders taken out of sight: a pending row's cells have no allocation, so they
 * read `·` and a value typed into one creates the first allocation, like any empty cell. The placeholder
 * month carries no marker either, since there is no allocation for it to describe.
 */
export function withoutPlaceholders(
  result: Result<GridView, GridViewError>,
  pendingKeys: ReadonlySet<string>,
): Result<GridView, GridViewError> {
  if (!result.ok || pendingKeys.size === 0) return result;
  return ok({
    ...result.value,
    rows: result.value.rows.map((row) =>
      row.kind === 'person' && pendingKeys.has(row.key)
        ? { ...row, cells: row.cells.map((cell) => ({ ...cell, allocationId: null, markers: [] })) }
        : row,
    ),
  });
}
