import { Allocation, BreakdownItem, Project } from '@baseline/delivery-contract';
import { IsoDateTime } from '@baseline/host-contract';
import { Employee, RateRecord } from '@baseline/people-contract';
import { z } from 'zod';
import type { PlanState } from '../changeSet';
import seed from '../../../../.docs/data.json';

// The brief's fixtures (.docs/data.json), parsed through the contract schemas. Test support only:
// it isn't exported from the package.

/** Seed rows have no edit time, so they all share one (D18). */
export const SEEDED_AT = IsoDateTime.parse('2026-01-01T00:00:00.000Z');

export const seedEmployees = z.array(Employee).parse(seed.employees);
export const seedRateRecords = z.array(RateRecord).parse(seed.rateRecords);
export const seedProjects = z.array(Project).parse(seed.projects);
export const seedItems = z.array(BreakdownItem).parse(seed.breakdownItems);
export const seedAllocations = z
  .array(Allocation.omit({ editedAt: true }))
  .parse(seed.allocations)
  .map((allocation) => Allocation.parse({ ...allocation, editedAt: SEEDED_AT }));

export function seedRatesOf(employeeId: string): RateRecord[] {
  return seedRateRecords.filter((record) => record.employeeId === employeeId);
}

export function seedEmployee(employeeId: string): Employee {
  const employee = seedEmployees.find((candidate) => candidate.id === employeeId);
  if (employee === undefined) throw new Error(`No seed employee ${employeeId}`);
  return employee;
}

/** The seed as a plan state, the way `delivery-api` loads it. */
export function seedPlan(): PlanState {
  return { projects: seedProjects, items: seedItems, allocations: seedAllocations };
}
