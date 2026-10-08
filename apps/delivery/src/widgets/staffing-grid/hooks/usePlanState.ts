import type { PlanState } from '@baseline/delivery-domain';
import { useMemo } from 'react';
import { useAllocations } from '../../../entities/allocation';
import { useBreakdownItems } from '../../../entities/breakdown-item';
import { useProjects } from '../../../entities/project';

/**
 * The plan as the cache holds it now, for the tree operations: they decide against this state and send
 * the change set it produces. Delivery's collections suspend and the grid is already showing, so they are
 * loaded; the object only changes when a collection does.
 */
export function usePlanState(): PlanState {
  const projects = useProjects();
  const items = useBreakdownItems();
  const allocations = useAllocations();
  return useMemo(() => ({ projects, items, allocations }), [projects, items, allocations]);
}
