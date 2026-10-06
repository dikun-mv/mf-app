/**
 * Why a domain function refused. The service maps each `code` to an HTTP status in one place
 * (400 validation, 404 missing, 409 conflict) and the client switches over the same codes.
 */
export type DomainError =
  // Missing records -> 404
  | { readonly code: 'notFound'; readonly entity: 'project' | 'breakdownItem' | 'allocation'; readonly id: string }
  // Invalid input -> 400
  | { readonly code: 'emptyName' }
  | { readonly code: 'invalidAmount'; readonly amount: number }
  | { readonly code: 'notALeaf'; readonly itemId: string }
  | { readonly code: 'monthOutsideProject'; readonly month: string; readonly projectId: string }
  | { readonly code: 'tooDeep'; readonly maxDepth: number }
  | { readonly code: 'parentInOtherProject'; readonly parentId: string }
  // Conflicts with existing state -> 409
  | { readonly code: 'duplicateId'; readonly id: string }
  | { readonly code: 'duplicateAllocation'; readonly existingId: string }
  | { readonly code: 'cycle'; readonly itemId: string; readonly parentId: string }
  | {
      readonly code: 'crossProjectMove';
      readonly itemId: string;
      readonly fromProjectId: string;
      readonly toProjectId: string;
    }
  /** The target leaf has allocations and the moved item has children, so they have nowhere to go (D9). */
  | { readonly code: 'targetHasAllocations'; readonly parentId: string }
  /** Moving the target leaf's allocations onto the moved leaf would collide with its own (D9). */
  | { readonly code: 'allocationConflict'; readonly itemId: string; readonly conflicts: number };
