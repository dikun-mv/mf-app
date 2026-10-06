import type { Allocation, AllocationId, BreakdownItemId } from '@baseline/delivery-contract';
import type { IsoDateTime, Month } from '@baseline/host-contract';
import type { EmployeeId } from '@baseline/people-contract';
import { monthOf } from './calendar';
import { type ChangeSet, EMPTY_CHANGE_SET, type PlanState } from './changeSet';
import type { DomainError } from './errors';
import { type Result, err, ok } from './result';
import { indexItems, isLeaf } from './tree';

/** What a user enters for one cell; the server adds `editedAt`. */
export interface AllocationDraft {
  readonly id: AllocationId;
  readonly breakdownItemId: BreakdownItemId;
  readonly employeeId: EmployeeId;
  readonly month: Month;
  /** Person-months. */
  readonly amount: number;
}

/** The natural key of a cell: one allocation per (item, employee, month). */
export const allocationKey = (allocation: Pick<Allocation, 'breakdownItemId' | 'employeeId' | 'month'>): string =>
  `${allocation.breakdownItemId}|${allocation.employeeId}|${allocation.month}`;

/**
 * The rules an allocation must obey, shared by the grid and `delivery-api`: on an existing leaf,
 * within the project's span, an amount of zero or more, and the only one for its (item, employee,
 * month). People are not checked here: Delivery doesn't know who exists (D7).
 */
export function validateAllocation(state: PlanState, draft: AllocationDraft): Result<AllocationDraft, DomainError> {
  const index = indexItems(state.items);
  const item = index.byId.get(draft.breakdownItemId);
  if (item === undefined) return err({ code: 'notFound', entity: 'breakdownItem', id: draft.breakdownItemId });
  if (!isLeaf(index, item.id)) return err({ code: 'notALeaf', itemId: item.id });

  const project = state.projects.find((candidate) => candidate.id === item.projectId);
  if (project === undefined) return err({ code: 'notFound', entity: 'project', id: item.projectId });
  if (draft.month < monthOf(project.startDate) || draft.month > monthOf(project.endDate)) {
    return err({ code: 'monthOutsideProject', month: draft.month, projectId: project.id });
  }

  if (!Number.isFinite(draft.amount) || draft.amount < 0) return err({ code: 'invalidAmount', amount: draft.amount });

  const key = allocationKey(draft);
  const clash = state.allocations.find((other) => other.id !== draft.id && allocationKey(other) === key);
  if (clash !== undefined) return err({ code: 'duplicateAllocation', existingId: clash.id });
  return ok(draft);
}

/**
 * Sets the effort of one cell. An existing (item, employee, month) is updated and keeps its id;
 * otherwise a new allocation is created with the draft's id. Only a changed amount is an edit: it
 * stamps `editedAt = now` (D18), and an unchanged amount returns an empty change set.
 */
export function upsertAllocation(
  state: PlanState,
  draft: AllocationDraft,
  now: IsoDateTime,
): Result<ChangeSet, DomainError> {
  const key = allocationKey(draft);
  const existing = state.allocations.find((allocation) => allocationKey(allocation) === key);

  if (existing === undefined && state.allocations.some((allocation) => allocation.id === draft.id)) {
    return err({ code: 'duplicateId', id: draft.id });
  }
  const checked = validateAllocation(state, existing === undefined ? draft : { ...draft, id: existing.id });
  if (!checked.ok) return checked;

  if (existing === undefined) {
    const created: Allocation = { ...checked.value, editedAt: now };
    return ok({ ...EMPTY_CHANGE_SET, create: { items: [], allocations: [created] } });
  }
  if (existing.amount === draft.amount) return ok(EMPTY_CHANGE_SET);
  const updated: Allocation = { ...existing, amount: draft.amount, editedAt: now };
  return ok({ ...EMPTY_CHANGE_SET, update: { items: [], allocations: [updated] } });
}

export function removeAllocation(state: PlanState, id: AllocationId): Result<ChangeSet, DomainError> {
  if (!state.allocations.some((allocation) => allocation.id === id)) {
    return err({ code: 'notFound', entity: 'allocation', id });
  }
  return ok({ ...EMPTY_CHANGE_SET, delete: { itemIds: [], allocationIds: [id] } });
}
