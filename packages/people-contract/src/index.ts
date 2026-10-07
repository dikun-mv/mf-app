import { IsoDate, entityId } from '@baseline/host-contract';
import { z } from 'zod';

// People's published contract (T1.1, T3.1): the entity types, where People's PocketBase instance is served
// (base path, collection names, which are also the realtime topics), the schemas that parse its records,
// and the conformance fixture for the effective-dating rule. Clients use PocketBase's own SDK for REST,
// batch and realtime, and each app writes its own adapter from what is published here.

export const EmployeeId = entityId('emp', 'EmployeeId');
export type EmployeeId = z.infer<typeof EmployeeId>;

export const RateRecordId = entityId('rate', 'RateRecordId');
export type RateRecordId = z.infer<typeof RateRecordId>;

/** Contracted hours per week. A const tuple, so adding an option is one edit. */
export const WEEKLY_HOURS = [40, 32, 20] as const;
export const WeeklyHours = z.literal(WEEKLY_HOURS);
export type WeeklyHours = z.infer<typeof WeeklyHours>;

export const Employee = z.object({
  id: EmployeeId,
  name: z.string().min(1),
  role: z.string().min(1),
  weeklyHours: WeeklyHours,
});
export type Employee = z.infer<typeof Employee>;

/**
 * A cost rate in EUR per hour. There is no end date: it applies from `validFrom` (inclusive)
 * until the employee's next record begins, and the last record is open-ended.
 */
export const RateRecord = z.object({
  id: RateRecordId,
  employeeId: EmployeeId,
  validFrom: IsoDate,
  hourlyCost: z.number().positive(),
});
export type RateRecord = z.infer<typeof RateRecord>;

/** Where People's PocketBase is served: the gateway cuts this prefix. The SDK's base URL is the origin plus this. */
export const PEOPLE_BASE_PATH = '/api/people';

/**
 * People's published collections. Each name is also its realtime topic: `pb.collection(name).subscribe('*', …)`
 * listens to every record of it (PocketBase's topic `<name>/*`), and `subscribe(id, …)` to one (`<name>/<id>`).
 */
export const PEOPLE_COLLECTIONS = { employees: 'employees', rateRecords: 'rate_records' } as const;
export type PeopleCollection = (typeof PEOPLE_COLLECTIONS)[keyof typeof PEOPLE_COLLECTIONS];

// The record schemas below parse a PocketBase record into the entity. A record must say it came from the
// right collection, and only the entity's own fields come out: `collectionId`, `collectionName` and anything
// else PocketBase adds are dropped. These collections have no `created` or `updated` fields. Writes send the
// entity's own fields, so there are no separate write schemas.

/** A record of the `employees` collection, parsed into an `Employee`. Employees are read-only through the API (D16). */
export const EmployeeRecord = Employee.extend({ collectionName: z.literal(PEOPLE_COLLECTIONS.employees) }).transform(
  ({ collectionName: _collectionName, ...employee }): Employee => employee,
);
export type EmployeeRecord = z.infer<typeof EmployeeRecord>;

/**
 * A record of the `rate_records` collection, parsed into a `RateRecord`. `employeeId` is a relation to
 * `employees`, which PocketBase returns as the employee's id (no `expand`).
 *
 * The effective-dating rule, which every reader of these records must honour (D7). A record applies from
 * its `validFrom` (inclusive) until the employee's next record begins; the last record is open-ended, and
 * days before the first record are unpriced. A rate change inside a month therefore splits it: the days
 * from `validFrom` on are priced at the new rate, the earlier days at the old one. Two records of one
 * employee never share a `validFrom` (a unique index on `(employeeId, validFrom)`). Records may be added,
 * corrected and removed retroactively, so a reader never caches a slice across a change.
 * `OKAFOR_RATE_RECORDS` and `OKAFOR_MARCH_2026_SLICES` pin the rule to numbers.
 */
export const RateRecordRecord = RateRecord.extend({
  collectionName: z.literal(PEOPLE_COLLECTIONS.rateRecords),
}).transform(({ collectionName: _collectionName, ...rate }): RateRecord => rate);
export type RateRecordRecord = z.infer<typeof RateRecordRecord>;

export * from './conformance';
