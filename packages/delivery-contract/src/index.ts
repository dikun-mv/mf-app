import { IsoDate, IsoDateTime, Month, entityId } from '@baseline/host-contract';
import { EmployeeId } from '@baseline/people-contract';
import { z } from 'zod';

// Delivery's published types (T1.1). T3.2 adds the `load.changed` event.

export const ProjectId = entityId('prj', 'ProjectId');
export type ProjectId = z.infer<typeof ProjectId>;

export const BreakdownItemId = entityId('wbs', 'BreakdownItemId');
export type BreakdownItemId = z.infer<typeof BreakdownItemId>;

export const AllocationId = entityId('alloc', 'AllocationId');
export type AllocationId = z.infer<typeof AllocationId>;

export const Project = z.object({
  id: ProjectId,
  name: z.string().min(1),
  startDate: IsoDate,
  endDate: IsoDate,
});
export type Project = z.infer<typeof Project>;

/** A node of a project's work breakdown tree. `parentId` is null at the root. */
export const BreakdownItem = z.object({
  id: BreakdownItemId,
  projectId: ProjectId,
  parentId: BreakdownItemId.nullable(),
  name: z.string().min(1),
});
export type BreakdownItem = z.infer<typeof BreakdownItem>;

/**
 * Effort of one person on one leaf in one month, in person-months (D3). `editedAt` is set on
 * every effort edit, never null, and seed rows share one `seededAt` (D18).
 */
export const Allocation = z.object({
  id: AllocationId,
  breakdownItemId: BreakdownItemId,
  employeeId: EmployeeId,
  month: Month,
  amount: z.number().nonnegative(),
  editedAt: IsoDateTime,
});
export type Allocation = z.infer<typeof Allocation>;

/**
 * One person's total allocation in one month across every project (D8). `causingAllocationId` is
 * set exactly when `overCapacity` is true.
 */
export const EmployeeMonthLoad = z.object({
  employeeId: EmployeeId,
  month: Month,
  allocatedPersonMonths: z.number().nonnegative(),
  overCapacity: z.boolean(),
  causingAllocationId: AllocationId.nullable(),
});
export type EmployeeMonthLoad = z.infer<typeof EmployeeMonthLoad>;
