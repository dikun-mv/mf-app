import { Allocation, BreakdownItem, BreakdownItemId, Project } from '@baseline/delivery-contract';
import { EmployeeRecord, RateRecordRecord } from '@baseline/people-contract';
import { z } from 'zod';
import { COLLECTIONS, type CollectionKey, type RecordOf } from './collections';

// Delivery's own collections are not published, so the app parses them (T3.2, T6.0a). Like the contract's
// record schemas, each one needs `collectionName` to be its collection and returns only the entity's own
// fields: `collectionId`, `collectionName` and anything else PocketBase adds are dropped.

/** A record of `projects`, parsed into a `Project`. Projects are read-only through the API. */
export const ProjectRecord = Project.extend({ collectionName: z.literal(COLLECTIONS.projects.name) }).transform(
  ({ collectionName: _collectionName, ...project }): Project => project,
);

/**
 * A record of `breakdown_items`. PocketBase has no null, so a root's empty `parentId` reads back as `""`,
 * which becomes `null` (T3.2).
 */
export const BreakdownItemRecord = BreakdownItem.extend({
  collectionName: z.literal(COLLECTIONS.breakdownItems.name),
  parentId: z.union([z.literal('').transform((): null => null), BreakdownItemId]),
}).transform(({ collectionName: _collectionName, ...item }): BreakdownItem => item);

/** A record of `allocations`, parsed into an `Allocation`. */
export const AllocationRecord = Allocation.extend({
  collectionName: z.literal(COLLECTIONS.allocations.name),
}).transform(({ collectionName: _collectionName, ...allocation }): Allocation => allocation);

/**
 * The schema that parses a record of each collection, typed by collection so that a generic reader gets
 * back the right entity without a cast.
 */
export const RECORD_SCHEMAS: { readonly [K in CollectionKey]: z.ZodType<RecordOf<K>> } = {
  projects: ProjectRecord,
  breakdownItems: BreakdownItemRecord,
  allocations: AllocationRecord,
  employees: EmployeeRecord,
  rateRecords: RateRecordRecord,
};
