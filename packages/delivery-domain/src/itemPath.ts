import type { BreakdownItem, BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from './changeSet';
import { type TreeIndex, depthOf, indexItems } from './tree';

export const PATH_SEPARATOR = ' › ';

/** The item and its ancestors, root first. Empty when the item isn't in the index. Assumes a valid tree. */
export function trailOf(index: TreeIndex, id: BreakdownItemId): BreakdownItem[] {
  const item = index.byId.get(id);
  if (item === undefined) return [];
  depthOf(index, id); // Throws on a cycle, which would otherwise loop forever.
  const parentOf = (child: BreakdownItem): BreakdownItem | undefined =>
    child.parentId === null ? undefined : index.byId.get(child.parentId);
  const trail = [item];
  for (let parent = parentOf(item); parent !== undefined; parent = parentOf(parent)) trail.unshift(parent);
  return trail;
}

/**
 * Where an item sits, as `Project › item › item` (screens 3.3). It names the causing assignment of
 * an over-capacity month (D18). Null when the item, or its project, isn't in the state. A caller
 * that names many items passes the state's `indexItems` once.
 */
export function itemPath(
  state: PlanState,
  itemId: BreakdownItemId,
  index: TreeIndex = indexItems(state.items),
): string | null {
  const trail = trailOf(index, itemId);
  const first = trail[0];
  if (first === undefined) return null;
  const project = state.projects.find((candidate) => candidate.id === first.projectId);
  if (project === undefined) return null;
  return [project.name, ...trail.map((item) => item.name)].join(PATH_SEPARATOR);
}
