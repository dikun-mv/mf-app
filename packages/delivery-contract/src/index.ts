import { IsoDate, IsoDateTime, Month, entityId } from '@baseline/host-contract';
import { EmployeeId } from '@baseline/people-contract';
import { z } from 'zod';

// Delivery's published contract (T1.1, T3.2): the entity types, where Delivery's PocketBase instance is
// served (base path), and the one collection it publishes, `employee_month_loads` (D8), with the schema
// that parses its records. Delivery's own collections (projects, breakdown_items, allocations) are not
// published: its app adapter parses them (T3.7). Clients use PocketBase's own SDK for REST, batch and
// realtime, and each app writes its own adapter from what is published here.

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

/** Where Delivery's PocketBase is served: the gateway cuts this prefix. The SDK's base URL is the origin plus this. */
export const DELIVERY_BASE_PATH = '/api/delivery';

/**
 * Delivery's published collections: only the capacity load (D8). The name is also its realtime topic:
 * `pb.collection(name).subscribe('*', …)` listens to every row (PocketBase's topic `<name>/*`). Anyone may
 * read and subscribe; nobody writes it through the API, since the allocation hook keeps it (ADR 035).
 */
export const DELIVERY_COLLECTIONS = { employeeMonthLoads: 'employee_month_loads' } as const;
export type DeliveryCollection = (typeof DELIVERY_COLLECTIONS)[keyof typeof DELIVERY_COLLECTIONS];

/**
 * A record of `employee_month_loads`, parsed into an `EmployeeMonthLoad`. The record must say it came from
 * that collection. PocketBase has no null, so a row that isn't over capacity has `causingAllocationId: ""`,
 * which becomes `null`. Everything else PocketBase adds (`id`, which is `<employeeId>-<month>`,
 * `collectionId`, `collectionName`) is dropped. There is no row for a pair with no effort.
 */
export const EmployeeMonthLoadRecord = EmployeeMonthLoad.extend({
  collectionName: z.literal(DELIVERY_COLLECTIONS.employeeMonthLoads),
  causingAllocationId: z.union([z.literal('').transform((): null => null), AllocationId]),
}).transform(({ collectionName: _collectionName, ...load }): EmployeeMonthLoad => load);
export type EmployeeMonthLoadRecord = z.infer<typeof EmployeeMonthLoadRecord>;
