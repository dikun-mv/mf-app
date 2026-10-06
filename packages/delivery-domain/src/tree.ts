import type { BreakdownItem, BreakdownItemId, ProjectId } from '@baseline/delivery-contract';
import { type ChangeSet, EMPTY_CHANGE_SET, type PlanState } from './changeSet';
import type { DomainError } from './errors';
import { type Result, err, ok } from './result';

/** A work breakdown tree is at most three levels deep (brief §3.2). */
export const MAX_DEPTH = 3;

export interface TreeIndex {
  readonly byId: ReadonlyMap<BreakdownItemId, BreakdownItem>;
  /** Children in the order the items were given. */
  readonly childrenOf: ReadonlyMap<BreakdownItemId, readonly BreakdownItem[]>;
}

export function indexItems(items: readonly BreakdownItem[]): TreeIndex {
  const byId = new Map<BreakdownItemId, BreakdownItem>();
  const childrenOf = new Map<BreakdownItemId, BreakdownItem[]>();
  for (const item of items) {
    byId.set(item.id, item);
    if (item.parentId !== null) {
      const siblings = childrenOf.get(item.parentId);
      if (siblings === undefined) childrenOf.set(item.parentId, [item]);
      else siblings.push(item);
    }
  }
  return { byId, childrenOf };
}

export const childrenOf = (index: TreeIndex, id: BreakdownItemId): readonly BreakdownItem[] =>
  index.childrenOf.get(id) ?? [];

export const isLeaf = (index: TreeIndex, id: BreakdownItemId): boolean => childrenOf(index, id).length === 0;

/** The roots of one project, in order. */
export const rootsOf = (items: readonly BreakdownItem[], projectId: ProjectId): BreakdownItem[] =>
  items.filter((item) => item.parentId === null && item.projectId === projectId);

/** 1 for a root. Assumes a valid tree; `checkInvariants` reports cycles. */
export function depthOf(index: TreeIndex, id: BreakdownItemId): number {
  let depth = 0;
  for (
    let current = index.byId.get(id);
    current !== undefined;
    current = current.parentId === null ? undefined : index.byId.get(current.parentId)
  ) {
    depth += 1;
    if (depth > index.byId.size) throw new RangeError(`Item ${id} is in a cycle`);
  }
  return depth;
}

/** 1 for a leaf. */
export function heightOf(index: TreeIndex, id: BreakdownItemId): number {
  return 1 + Math.max(0, ...childrenOf(index, id).map((child) => heightOf(index, child.id)));
}

/** An item and everything beneath it, parents first. */
export function subtreeOf(index: TreeIndex, id: BreakdownItemId): BreakdownItem[] {
  const item = index.byId.get(id);
  if (item === undefined) return [];
  return [item, ...childrenOf(index, id).flatMap((child) => subtreeOf(index, child.id))];
}

const changeSet = (parts: Partial<{ [K in keyof ChangeSet]: Partial<ChangeSet[K]> }>): ChangeSet => ({
  create: { ...EMPTY_CHANGE_SET.create, ...parts.create },
  update: { ...EMPTY_CHANGE_SET.update, ...parts.update },
  delete: { ...EMPTY_CHANGE_SET.delete, ...parts.delete },
});

const notFound = (id: string): DomainError => ({ code: 'notFound', entity: 'breakdownItem', id });

export interface NewItem {
  readonly id: BreakdownItemId;
  readonly projectId: ProjectId;
  readonly parentId: BreakdownItemId | null;
  readonly name: string;
}

/**
 * Adds an item. If the parent is a leaf with allocations they move onto the new child in the same
 * change set, so nothing is lost (D9); `update.allocations` lists what moved.
 */
export function createItem(state: PlanState, input: NewItem): Result<ChangeSet, DomainError> {
  const name = input.name.trim();
  if (name === '') return err({ code: 'emptyName' });
  if (!state.projects.some((project) => project.id === input.projectId)) {
    return err({ code: 'notFound', entity: 'project', id: input.projectId });
  }
  if (state.items.some((item) => item.id === input.id)) return err({ code: 'duplicateId', id: input.id });

  const index = indexItems(state.items);
  const item: BreakdownItem = { id: input.id, projectId: input.projectId, parentId: input.parentId, name };
  if (input.parentId === null) return ok(changeSet({ create: { items: [item] } }));

  const parent = index.byId.get(input.parentId);
  if (parent === undefined) return err(notFound(input.parentId));
  if (parent.projectId !== input.projectId) return err({ code: 'parentInOtherProject', parentId: parent.id });
  if (depthOf(index, parent.id) + 1 > MAX_DEPTH) return err({ code: 'tooDeep', maxDepth: MAX_DEPTH });

  const inherited = isLeaf(index, parent.id)
    ? state.allocations.filter((allocation) => allocation.breakdownItemId === parent.id)
    : [];
  return ok(
    changeSet({
      create: { items: [item] },
      update: { allocations: inherited.map((allocation) => ({ ...allocation, breakdownItemId: item.id })) },
    }),
  );
}

export function renameItem(state: PlanState, id: BreakdownItemId, newName: string): Result<ChangeSet, DomainError> {
  const name = newName.trim();
  if (name === '') return err({ code: 'emptyName' });
  const item = state.items.find((candidate) => candidate.id === id);
  if (item === undefined) return err(notFound(id));
  if (item.name === name) return ok(EMPTY_CHANGE_SET);
  return ok(changeSet({ update: { items: [{ ...item, name }] } }));
}

/**
 * Moves an item (with its subtree) under another parent, or to the root with `null`. Refused across
 * projects (D15), into its own subtree, and past three levels. Moving onto a leaf that has
 * allocations hands them to the moved item, as adding a child does (D9), which only works when the
 * moved item is itself a leaf whose allocations don't collide with them.
 */
export function moveItem(
  state: PlanState,
  id: BreakdownItemId,
  newParentId: BreakdownItemId | null,
): Result<ChangeSet, DomainError> {
  const index = indexItems(state.items);
  const item = index.byId.get(id);
  if (item === undefined) return err(notFound(id));
  if (item.parentId === newParentId) return ok(EMPTY_CHANGE_SET);
  const moved: BreakdownItem = { ...item, parentId: newParentId };
  if (newParentId === null) return ok(changeSet({ update: { items: [moved] } }));

  const parent = index.byId.get(newParentId);
  if (parent === undefined) return err(notFound(newParentId));
  if (parent.projectId !== item.projectId) {
    return err({ code: 'crossProjectMove', itemId: id, fromProjectId: item.projectId, toProjectId: parent.projectId });
  }
  if (subtreeOf(index, id).some((member) => member.id === parent.id)) {
    return err({ code: 'cycle', itemId: id, parentId: newParentId });
  }
  if (depthOf(index, parent.id) + heightOf(index, id) > MAX_DEPTH) return err({ code: 'tooDeep', maxDepth: MAX_DEPTH });

  const inherited = isLeaf(index, parent.id)
    ? state.allocations.filter((allocation) => allocation.breakdownItemId === parent.id)
    : [];
  if (inherited.length === 0) return ok(changeSet({ update: { items: [moved] } }));

  if (!isLeaf(index, id)) return err({ code: 'targetHasAllocations', parentId: parent.id });
  const own = new Set(
    state.allocations
      .filter((allocation) => allocation.breakdownItemId === id)
      .map((a) => `${a.employeeId}|${a.month}`),
  );
  const conflicts = inherited.filter((allocation) => own.has(`${allocation.employeeId}|${allocation.month}`)).length;
  if (conflicts > 0) return err({ code: 'allocationConflict', itemId: id, conflicts });

  return ok(
    changeSet({
      update: {
        items: [moved],
        allocations: inherited.map((allocation) => ({ ...allocation, breakdownItemId: id })),
      },
    }),
  );
}

/** Deletes an item, everything beneath it and their allocations. `delete.allocationIds` is the count to report. */
export function deleteItem(state: PlanState, id: BreakdownItemId): Result<ChangeSet, DomainError> {
  const index = indexItems(state.items);
  if (!index.byId.has(id)) return err(notFound(id));
  const itemIds = subtreeOf(index, id).map((item) => item.id);
  const removed = new Set<BreakdownItemId>(itemIds);
  const allocationIds = state.allocations
    .filter((allocation) => removed.has(allocation.breakdownItemId))
    .map((allocation) => allocation.id);
  return ok(changeSet({ delete: { itemIds, allocationIds } }));
}
