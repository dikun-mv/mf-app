import type { Allocation, BreakdownItem, ProjectId } from '@baseline/delivery-contract';
import type { EmployeeId } from '@baseline/people-contract';
import type { PlanState } from './changeSet';
import { checkInvariants, type InvariantViolation } from './invariants';
import { assertNever } from './never';

/**
 * What `checkInvariants` finds wrong in one project, in words for the project page (T1.12b, D4). The server
 * doesn't re-check the tree and allocation rules, so only a change made outside the app can break them;
 * this is how the app shows it rather than hiding it. A violation belongs to the project of the item it is
 * about, or of the item its allocation is on; one with no such item (an allocation on a missing item, two
 * projects sharing an id) has no project page to show on and is left out.
 * `knownEmployees` is People's register; leave it out, while People's data is missing, to skip that check.
 */
export function projectProblems(
  state: PlanState,
  projectId: ProjectId,
  knownEmployees?: ReadonlySet<EmployeeId>,
): string[] {
  // Keyed by plain strings: a violation can name an id that no record has.
  const items = new Map<string, BreakdownItem>(state.items.map((item) => [item.id, item]));
  const allocations = new Map<string, Allocation>(state.allocations.map((allocation) => [allocation.id, allocation]));
  const itemOfAllocation = (id: string): BreakdownItem | undefined => {
    const allocation = allocations.get(id);
    return allocation === undefined ? undefined : items.get(allocation.breakdownItemId);
  };

  /** The problem in words, if it is about an item or allocation of the open project. */
  const describe = (violation: InvariantViolation): string | null => {
    const item = aboutItem(violation);
    if (item?.projectId !== projectId) return null;
    const name = `“${item.name}”`;
    switch (violation.kind) {
      case 'duplicateId':
        return `Two ${ENTITY_NAMES[violation.entity]} share the id ${violation.id}.`;
      case 'missingParent':
        return `${name} is under an item that doesn't exist (${violation.parentId}), so it isn't shown.`;
      case 'parentInOtherProject':
        return `${name} is under “${items.get(violation.parentId)?.name ?? violation.parentId}”, an item of another project.`;
      case 'cycle':
        return `${name} is in a loop of items that are each other's parents, so it isn't shown.`;
      case 'tooDeep':
        return `${name} is at level ${String(violation.depth)}; the tree has at most three.`;
      case 'allocationOnNonLeaf':
        return `Allocation ${violation.allocationId} is on ${name}, which has children; allocations belong on leaves.`;
      case 'allocationOutsideProject':
        return `Allocation ${violation.allocationId} is for ${allocations.get(violation.allocationId)?.month ?? ''}, outside the project's months, so it isn't shown.`;
      case 'duplicateAllocationKey':
        return `Allocations ${violation.allocationIds.join(', ')} are for the same person, item and month.`;
      case 'unknownEmployee':
        return `Allocation ${violation.allocationId} is for ${violation.employeeId}, who isn't in People's register.`;
      // Never reached: the first has no open project, the second no item.
      case 'itemInMissingProject':
      case 'allocationOnMissingItem':
        return null;
      default:
        return assertNever(violation);
    }
  };

  /** The item a violation concerns, when there is one in the state. */
  const aboutItem = (violation: InvariantViolation): BreakdownItem | undefined => {
    switch (violation.kind) {
      case 'duplicateId':
        if (violation.entity === 'project') return undefined;
        return violation.entity === 'breakdownItem' ? items.get(violation.id) : itemOfAllocation(violation.id);
      case 'itemInMissingProject':
      case 'missingParent':
      case 'parentInOtherProject':
      case 'cycle':
      case 'tooDeep':
        return items.get(violation.itemId);
      case 'allocationOnMissingItem':
      case 'allocationOnNonLeaf':
      case 'allocationOutsideProject':
      case 'unknownEmployee':
        return itemOfAllocation(violation.allocationId);
      case 'duplicateAllocationKey':
        return itemOfAllocation(violation.allocationIds[0] ?? '');
      default:
        return assertNever(violation);
    }
  };

  return checkInvariants(state, knownEmployees)
    .map(describe)
    .filter((problem) => problem !== null);
}

const ENTITY_NAMES = {
  project: 'projects',
  breakdownItem: 'items',
  allocation: 'allocations',
} satisfies Record<Extract<InvariantViolation, { kind: 'duplicateId' }>['entity'], string>;
