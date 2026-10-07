import type { ProjectId } from '@baseline/delivery-contract';
import {
  availableUnits,
  gridView,
  type DisplayUnit,
  type GridView,
  type GridViewError,
  type PeopleData,
  type Result,
} from '@baseline/delivery-domain';
import { useMemo } from 'react';
import { useAllocations } from '../../../entities/allocation';
import { useBreakdownItems } from '../../../entities/breakdown-item';
import { useEmployees } from '../../../entities/employee';
import { useProjects } from '../../../entities/project';
import { useRateRecords } from '../../../entities/rate-record';
import { useHost } from '../../../shared/lib';

export interface GridModel {
  readonly result: Result<GridView, GridViewError>;
  /** The units that can be shown now: all four, or person-months and % while People's data is missing. */
  readonly units: readonly DisplayUnit[];
  /** People's employees or rates are still on their first load (not failed), so hours and cost may yet work. */
  readonly peopleLoading: boolean;
}

/**
 * The grid of one project in one unit (D35): the cached collections go into `gridView`, which does all
 * the work. Delivery's own collections suspend; People's never do (D32), so until both of its collections
 * have loaded the grid is built without them and shows employee ids.
 */
export function useGridView(projectId: ProjectId, unit: DisplayUnit): GridModel {
  const projects = useProjects();
  const items = useBreakdownItems();
  const allocations = useAllocations();
  const employeesQuery = useEmployees();
  const ratesQuery = useRateRecords();
  const employees = employeesQuery.data;
  const rates = ratesQuery.data;
  const { currency } = useHost();

  const people = useMemo<PeopleData | null>(
    () => (employees === undefined || rates === undefined ? null : { employees, rates }),
    [employees, rates],
  );
  const result = useMemo(
    () => gridView({ projects, items, allocations }, people, projectId, unit, currency),
    [projects, items, allocations, people, projectId, unit, currency],
  );
  const units = useMemo(() => availableUnits(people), [people]);
  const peopleLoading = employeesQuery.isPending || ratesQuery.isPending;
  return { result, units, peopleLoading };
}
