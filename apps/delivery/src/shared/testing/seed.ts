import { Allocation, BreakdownItem, Project } from '@baseline/delivery-contract';
import { IsoDateTime } from '@baseline/host-contract';
import { Employee, RateRecord } from '@baseline/people-contract';
import { z } from 'zod';
import seed from '../../../../../docs/data.json';
import type { FakeData } from './fakeRepository';

// The brief's fixtures (docs/data.json), parsed through the contract schemas, for tests that check the
// screens against the seed's own numbers. Test support only: nothing in the app imports it.

/** Seed rows have no edit time, so they all share one (D18). */
const SEEDED_AT = IsoDateTime.parse('2026-01-01T00:00:00.000Z');

/** Every collection of the seed, ready for `createFakeRepository`. */
export function seedData(): Required<FakeData> {
  return {
    projects: z.array(Project).parse(seed.projects),
    breakdownItems: z.array(BreakdownItem).parse(seed.breakdownItems),
    allocations: z
      .array(Allocation.omit({ editedAt: true }))
      .parse(seed.allocations)
      .map((allocation) => Allocation.parse({ ...allocation, editedAt: SEEDED_AT })),
    employees: z.array(Employee).parse(seed.employees),
    rateRecords: z.array(RateRecord).parse(seed.rateRecords),
  };
}
