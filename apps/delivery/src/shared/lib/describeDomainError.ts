import { MAX_DEPTH, type DomainError } from '@baseline/delivery-domain';

/**
 * A domain refusal as a sentence for the field or dialog it concerns (D27 layer 2, D33). The tree
 * dialogs already offer only what the domain allows, so most of these are the case of another user's
 * change arriving first; every code is still covered, so none reaches a screen as a bare code.
 */
export function describeDomainError(error: DomainError): string {
  switch (error.code) {
    case 'notFound':
      return error.entity === 'project'
        ? 'This project was removed elsewhere.'
        : "This item was removed elsewhere, so the change can't be saved.";
    case 'emptyName':
      return 'Enter a name.';
    case 'invalidAmount':
      return 'Enter an amount of zero or more.';
    case 'notALeaf':
      return 'People are assigned to items that have no sub-items.';
    case 'monthOutsideProject':
      return "That month is outside the project's dates.";
    case 'tooDeep':
      return `Items go ${String(MAX_DEPTH)} levels deep at most.`;
    case 'parentInOtherProject':
      return 'That parent belongs to another project.';
    case 'duplicateId':
      return 'That item already exists.';
    case 'duplicateAllocation':
      return 'This person already has an allocation for that month.';
    case 'cycle':
      return "An item can't move inside itself.";
    case 'crossProjectMove':
      return 'An item stays in its own project.';
    case 'targetHasAllocations':
      return 'That item holds allocations and the moved one has sub-items, so they have nowhere to go.';
    case 'allocationConflict':
      return `${String(error.conflicts)} of its allocations would clash with those of the moved item.`;
  }
}

/** `1 allocation`, `3 allocations`: the count with its noun in the right number. */
export function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
