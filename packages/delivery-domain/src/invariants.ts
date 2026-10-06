import type { AllocationId, BreakdownItemId } from '@baseline/delivery-contract';
import type { EmployeeId } from '@baseline/people-contract';
import { monthOf } from './calendar';
import type { PlanState } from './changeSet';
import { allocationKey } from './allocations';
import { MAX_DEPTH, indexItems, isLeaf } from './tree';

export type InvariantViolation =
  | { readonly kind: 'duplicateId'; readonly entity: 'project' | 'breakdownItem' | 'allocation'; readonly id: string }
  | { readonly kind: 'itemInMissingProject'; readonly itemId: BreakdownItemId; readonly projectId: string }
  | { readonly kind: 'missingParent'; readonly itemId: BreakdownItemId; readonly parentId: string }
  | { readonly kind: 'parentInOtherProject'; readonly itemId: BreakdownItemId; readonly parentId: string }
  | { readonly kind: 'cycle'; readonly itemId: BreakdownItemId }
  | { readonly kind: 'tooDeep'; readonly itemId: BreakdownItemId; readonly depth: number }
  | { readonly kind: 'allocationOnMissingItem'; readonly allocationId: AllocationId; readonly itemId: string }
  | { readonly kind: 'allocationOnNonLeaf'; readonly allocationId: AllocationId; readonly itemId: BreakdownItemId }
  | { readonly kind: 'allocationOutsideProject'; readonly allocationId: AllocationId; readonly projectId: string }
  | { readonly kind: 'duplicateAllocationKey'; readonly allocationIds: readonly AllocationId[] }
  | { readonly kind: 'unknownEmployee'; readonly allocationId: AllocationId; readonly employeeId: EmployeeId };

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) (seen.has(id) ? repeated : seen).add(id);
  return [...repeated];
}

/**
 * Reports data the operations would never produce but a hand edit or a bug could: allocations on a
 * non-leaf or a missing item, unknown employees, broken or too-deep trees. The service runs it at
 * startup and the UI uses it to mark orphaned rows. `knownEmployees` is People's register; leave it
 * out to skip that check.
 */
export function checkInvariants(state: PlanState, knownEmployees?: ReadonlySet<EmployeeId>): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const index = indexItems(state.items);
  const projects = new Map(state.projects.map((project) => [project.id, project]));

  for (const id of duplicates(state.projects.map((p) => p.id)))
    violations.push({ kind: 'duplicateId', entity: 'project', id });
  for (const id of duplicates(state.items.map((i) => i.id)))
    violations.push({ kind: 'duplicateId', entity: 'breakdownItem', id });
  for (const id of duplicates(state.allocations.map((a) => a.id)))
    violations.push({ kind: 'duplicateId', entity: 'allocation', id });

  for (const item of state.items) {
    if (!projects.has(item.projectId)) {
      violations.push({ kind: 'itemInMissingProject', itemId: item.id, projectId: item.projectId });
    }
    if (item.parentId === null) continue;
    const parent = index.byId.get(item.parentId);
    if (parent === undefined) {
      violations.push({ kind: 'missingParent', itemId: item.id, parentId: item.parentId });
    } else if (parent.projectId !== item.projectId) {
      violations.push({ kind: 'parentInOtherProject', itemId: item.id, parentId: parent.id });
    }

    // Walk up: a repeated item is a cycle, otherwise count the levels.
    const seen = new Set<BreakdownItemId>([item.id]);
    let depth = 1;
    let cycle = false;
    for (
      let cursor = parent;
      cursor !== undefined;
      cursor = cursor.parentId === null ? undefined : index.byId.get(cursor.parentId)
    ) {
      if (seen.has(cursor.id)) {
        cycle = true;
        break;
      }
      seen.add(cursor.id);
      depth += 1;
    }
    if (cycle) violations.push({ kind: 'cycle', itemId: item.id });
    else if (depth > MAX_DEPTH) violations.push({ kind: 'tooDeep', itemId: item.id, depth });
  }

  const byKey = new Map<string, AllocationId[]>();
  for (const allocation of state.allocations) {
    const item = index.byId.get(allocation.breakdownItemId);
    if (item === undefined) {
      violations.push({
        kind: 'allocationOnMissingItem',
        allocationId: allocation.id,
        itemId: allocation.breakdownItemId,
      });
    } else {
      if (!isLeaf(index, item.id)) {
        violations.push({ kind: 'allocationOnNonLeaf', allocationId: allocation.id, itemId: item.id });
      }
      const project = projects.get(item.projectId);
      if (
        project !== undefined &&
        (allocation.month < monthOf(project.startDate) || allocation.month > monthOf(project.endDate))
      ) {
        violations.push({ kind: 'allocationOutsideProject', allocationId: allocation.id, projectId: project.id });
      }
    }
    if (knownEmployees !== undefined && !knownEmployees.has(allocation.employeeId)) {
      violations.push({ kind: 'unknownEmployee', allocationId: allocation.id, employeeId: allocation.employeeId });
    }
    const key = allocationKey(allocation);
    byKey.set(key, [...(byKey.get(key) ?? []), allocation.id]);
  }
  for (const allocationIds of byKey.values()) {
    if (allocationIds.length > 1) violations.push({ kind: 'duplicateAllocationKey', allocationIds });
  }
  return violations;
}
