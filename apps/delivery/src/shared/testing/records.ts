import { Allocation, BreakdownItem, Project } from '@baseline/delivery-contract';
import { IsoDateTime } from '@baseline/host-contract';
import { Employee, RateRecord } from '@baseline/people-contract';

// Small records for tests, written as the entities they are and checked by the contract schemas.

/** Seed rows share one edit time (D18). */
export const SEEDED_AT = IsoDateTime.parse('2026-01-01T00:00:00.000Z');

export const project = (id: string, name = `Project ${id}`, startDate = '2026-03-01', endDate = '2027-02-28') =>
  Project.parse({ id, name, startDate, endDate });

export const item = (id: string, projectId: string, parentId: string | null, name = `Item ${id}`) =>
  BreakdownItem.parse({ id, projectId, parentId, name });

export const allocation = (
  id: string,
  breakdownItemId: string,
  employeeId: string,
  month: string,
  amount: number,
  editedAt: string = SEEDED_AT,
) => Allocation.parse({ id, breakdownItemId, employeeId, month, amount, editedAt });

export const employee = (id: string, name: string, role = 'Engineer', weeklyHours = 40) =>
  Employee.parse({ id, name, role, weeklyHours });

export const rate = (id: string, employeeId: string, validFrom: string, hourlyCost: number) =>
  RateRecord.parse({ id, employeeId, validFrom, hourlyCost });

/** A record as PocketBase sends it: the entity's fields plus `collectionId` and `collectionName`. */
export const asPocketBase = (collectionName: string, record: object): Record<string, unknown> => ({
  collectionId: `pbc_${collectionName}`,
  collectionName,
  ...record,
});

/** The seed's four projects (.docs/data.json), for screens that list them. */
export const seedProjects = () => [
  project('prj-1', 'Ledger Consolidation', '2026-03-01', '2027-02-28'),
  project('prj-2', 'Reporting Platform', '2026-04-01', '2027-03-31'),
  project('prj-3', 'Client Portal Rebuild', '2026-06-01', '2027-03-31'),
  project('prj-4', 'Warehouse Data Migration', '2026-04-01', '2026-12-31'),
];
