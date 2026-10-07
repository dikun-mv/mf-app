import type { BreakdownItem, BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from './changeSet';
import type { DomainError } from './errors';
import { PATH_SEPARATOR } from './itemPath';
import { at } from './lookup';
import { type Result, err, ok } from './result';
import { MAX_DEPTH, type TreeIndex, childrenOf, depthOf, indexItems, isLeaf, moveItem, rootsOf } from './tree';

// What a WBS row's `⋯` list and the move dialog offer (screens 3.4). Nothing is hidden: an action or
// target that can't apply is listed as refused, with the reason to show beside it. The checks are
// `tree.ts`'s own (`moveItem` is asked about every target), so the list can't disagree with what the
// operation then does.

const ORDINALS = ['first', 'second', 'third'] as const;

/** "third" for the deepest level the tree allows. */
const deepestLevel = (): string => at(ORDINALS, MAX_DEPTH - 1);

// ---- Move targets ----

interface TargetBase {
  /** The new parent, or null for the top level. */
  readonly parentId: BreakdownItemId | null;
  /** `Top level`, or the target's path inside the project: `Ledger migration › Discovery`. */
  readonly label: string;
  /** 0 for the top level, 1 for a root, and so on, for indenting the list. */
  readonly depth: number;
}

export type MoveTarget =
  | (TargetBase & {
      readonly allowed: true;
      /** Allocations of a leaf target that move onto the moved item (D9). */
      readonly movesAllocations: number;
    })
  | (TargetBase & { readonly allowed: false; readonly reason: string });

const notFound = (id: BreakdownItemId): DomainError => ({ code: 'notFound', entity: 'breakdownItem', id });

/** The reason text for a move that `moveItem` refused. */
export function describeMoveRefusal(
  error: DomainError,
  item: BreakdownItem,
  targetId: BreakdownItemId | null,
  depthOfTarget: number,
): string {
  switch (error.code) {
    case 'cycle':
      return targetId === item.id ? "can't move into itself" : `inside "${item.name}", which is being moved`;
    case 'tooDeep':
      return depthOfTarget >= MAX_DEPTH
        ? `${deepestLevel()} level: can't take a child`
        : `"${item.name}" and what is under it would go past the ${deepestLevel()} level`;
    case 'targetHasAllocations':
      return `holds allocations, and "${item.name}" has sub-items, so they have nowhere to go`;
    case 'allocationConflict':
      return `${String(error.conflicts)} of its allocations would clash with those of "${item.name}"`;
    default:
      return `can't move here (${error.code})`;
  }
}

function targetsOf(state: PlanState, index: TreeIndex, item: BreakdownItem): MoveTarget[] {
  const check = (parentId: BreakdownItemId | null, label: string, depth: number): MoveTarget => {
    const base = { parentId, label, depth };
    if (item.parentId === base.parentId) return { ...base, allowed: false, reason: 'current parent' };
    const moved = moveItem(state, item.id, base.parentId);
    return moved.ok
      ? { ...base, allowed: true, movesAllocations: moved.value.update.allocations.length }
      : { ...base, allowed: false, reason: describeMoveRefusal(moved.error, item, parentId, depth) };
  };

  const projectItems = state.items.filter((candidate) => candidate.projectId === item.projectId);
  const walk = (nodes: readonly BreakdownItem[], parents: readonly string[]): MoveTarget[] =>
    nodes.flatMap((node) => {
      const names = [...parents, node.name];
      return [check(node.id, names.join(PATH_SEPARATOR), names.length), ...walk(childrenOf(index, node.id), names)];
    });
  return [check(null, 'Top level', 0), ...walk(rootsOf(projectItems, item.projectId), [])];
}

/**
 * Every node of the item's own project (never another, D15) as a place to move it to, in tree order
 * after the top level. Each is allowed or refused with its reason: the item's current parent, the
 * item itself and what is under it, the depth limit, and the allocation clashes of D9.
 */
export function moveTargets(state: PlanState, itemId: BreakdownItemId): Result<readonly MoveTarget[], DomainError> {
  const index = indexItems(state.items);
  const item = index.byId.get(itemId);
  if (item === undefined) return err(notFound(itemId));
  return ok(targetsOf(state, index, item));
}

// ---- Row actions ----

export type RowActionId = 'rename' | 'addChild' | 'move' | 'delete' | 'assignPerson';

interface ActionBase {
  readonly id: RowActionId;
  /** The button's text. */
  readonly label: string;
}

export type RowAction =
  | (ActionBase & {
      readonly allowed: true;
      /** Allocations that move onto a new child, for `addChild` on a leaf that has them (D9). */
      readonly movesAllocations: number;
    })
  | (ActionBase & { readonly allowed: false; readonly reason: string });

/**
 * The actions of an item's `⋯` list, always in the same order, each allowed or refused with the
 * reason to show (screens 3.4). Deleting is always allowed: its dialog counts what goes (T1.12).
 */
export function rowActions(state: PlanState, itemId: BreakdownItemId): Result<readonly RowAction[], DomainError> {
  const index = indexItems(state.items);
  const item = index.byId.get(itemId);
  if (item === undefined) return err(notFound(itemId));

  const leaf = isLeaf(index, item.id);
  const allowed = (id: RowActionId, label: string, movesAllocations = 0): RowAction => ({
    id,
    label,
    allowed: true,
    movesAllocations,
  });
  const refused = (id: RowActionId, label: string, reason: string): RowAction => ({
    id,
    label,
    allowed: false,
    reason,
  });

  const heldAllocations = state.allocations.filter((allocation) => allocation.breakdownItemId === item.id).length;
  const canMove = targetsOf(state, index, item).some((target) => target.allowed);

  return ok([
    allowed('rename', 'Rename'),
    depthOf(index, item.id) >= MAX_DEPTH
      ? refused('addChild', 'Add child item', `${item.name} is at the ${deepestLevel()} level, the deepest`)
      : allowed('addChild', 'Add child item', leaf ? heldAllocations : 0),
    canMove ? allowed('move', 'Move…') : refused('move', 'Move…', `there is nowhere else to move ${item.name}`),
    allowed('delete', 'Delete…'),
    leaf
      ? allowed('assignPerson', 'Assign person…')
      : refused('assignPerson', 'Assign person…', `${item.name} has sub-items, and people are assigned to leaves`),
  ]);
}
