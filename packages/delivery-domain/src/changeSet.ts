import type { Allocation, AllocationId, BreakdownItem, BreakdownItemId, Project } from '@baseline/delivery-contract';

/** Everything the plan holds that Delivery owns. */
export interface PlanState {
  readonly projects: readonly Project[];
  readonly items: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
}

/**
 * The records an operation creates, replaces and deletes. The server applies it atomically and the
 * client applies the same set optimistically. Updates carry whole records.
 *
 * What a caller reports from it: a delete removes `delete.allocationIds.length` allocations, and a
 * tree operation that re-points allocations (D9) moves `update.allocations.length` of them.
 */
export interface ChangeSet {
  readonly create: { readonly items: readonly BreakdownItem[]; readonly allocations: readonly Allocation[] };
  readonly update: { readonly items: readonly BreakdownItem[]; readonly allocations: readonly Allocation[] };
  readonly delete: { readonly itemIds: readonly BreakdownItemId[]; readonly allocationIds: readonly AllocationId[] };
}

export const EMPTY_CHANGE_SET: ChangeSet = {
  create: { items: [], allocations: [] },
  update: { items: [], allocations: [] },
  delete: { itemIds: [], allocationIds: [] },
};

export function isEmptyChangeSet(changeSet: ChangeSet): boolean {
  return (
    changeSet.create.items.length === 0 &&
    changeSet.create.allocations.length === 0 &&
    changeSet.update.items.length === 0 &&
    changeSet.update.allocations.length === 0 &&
    changeSet.delete.itemIds.length === 0 &&
    changeSet.delete.allocationIds.length === 0
  );
}

function replaceById<T extends { readonly id: string }>(records: readonly T[], updates: readonly T[]): T[] {
  const byId = new Map(updates.map((record) => [record.id, record]));
  const replaced = records.map((record) => byId.get(record.id) ?? record);
  const known = new Set(records.map((record) => record.id));
  const missing = updates.find((record) => !known.has(record.id));
  if (missing !== undefined) throw new Error(`Change set updates ${missing.id}, which is not in the state`);
  return replaced;
}

/**
 * Applies a change set: deletes, then replaces, then appends. Pure. A change set made against a
 * different state (it updates a record that isn't there) is a bug, so that throws.
 */
export function applyChangeSet(state: PlanState, changeSet: ChangeSet): PlanState {
  const deletedItems = new Set<string>(changeSet.delete.itemIds);
  const deletedAllocations = new Set<string>(changeSet.delete.allocationIds);
  return {
    projects: state.projects,
    items: [
      ...replaceById(
        state.items.filter((item) => !deletedItems.has(item.id)),
        changeSet.update.items,
      ),
      ...changeSet.create.items,
    ],
    allocations: [
      ...replaceById(
        state.allocations.filter((allocation) => !deletedAllocations.has(allocation.id)),
        changeSet.update.allocations,
      ),
      ...changeSet.create.allocations,
    ],
  };
}
