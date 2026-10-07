import { Allocation, EmployeeMonthLoadRecord } from '@baseline/delivery-contract';
import { loadsOf } from '@baseline/delivery-domain';
import { describe, expect, it } from '@rstest/core';
import { createClient } from './setup';

// What the migrations seed (T3.6) and that every load row is what delivery-domain says it is. The other
// files in this folder remove what they add, so these hold on any run against a reset stack.
const pb = createClient();

const SEEDED_AT = '2026-01-01T00:00:00.000Z';

/** Plan §1: the 6 person-months over capacity at load, with the causer under D18 (the higher id of the pair). */
const OVER_CAPACITY = [
  ['emp-002', '2026-09', 'alloc-293'],
  ['emp-003', '2026-06', 'alloc-073'],
  ['emp-012', '2026-05', 'alloc-043'],
  ['emp-023', '2026-06', 'alloc-101'],
  ['emp-031', '2026-12', 'alloc-613'],
  ['emp-043', '2026-10', 'alloc-421'],
] as const;

describe('delivery-pb seed', () => {
  it('has the 4 projects, 90 breakdown items and 720 allocations', async () => {
    expect(await pb.collection('projects').getFullList()).toHaveLength(4);
    expect(await pb.collection('breakdown_items').getFullList()).toHaveLength(90);
    expect(await pb.collection('allocations').getFullList()).toHaveLength(720);
  });

  it('maps a root breakdown item to an empty parentId and keeps the seed ids', async () => {
    const root = await pb.collection('breakdown_items').getOne('wbs-001');
    expect(root).toMatchObject({ id: 'wbs-001', projectId: 'prj-1', parentId: '' });
    const child = await pb.collection('breakdown_items').getOne('wbs-090');
    expect(child).toMatchObject({ projectId: 'prj-4', parentId: 'wbs-075' });
  });

  it('gives every seed allocation the same editedAt', async () => {
    const allocations = Allocation.array().parse(await pb.collection('allocations').getFullList());
    expect(new Set(allocations.map((a) => a.editedAt))).toEqual(new Set([SEEDED_AT]));
  });

  it('has exactly 6 over-capacity rows, with the causers of plan §1', async () => {
    const loads = EmployeeMonthLoadRecord.array().parse(await pb.collection('employee_month_loads').getFullList());
    const over = loads.filter((load) => load.overCapacity);
    expect(over.map((l) => [l.employeeId, l.month, l.causingAllocationId]).sort()).toEqual(
      OVER_CAPACITY.map((row) => [...row]),
    );
    // Within capacity, PocketBase's empty causer reads as null.
    expect(loads.filter((load) => !load.overCapacity).every((load) => load.causingAllocationId === null)).toBe(true);
  });

  it('has a load row per (employee, month) with effort, each equal to delivery-domain loadsOf', async () => {
    const allocations = Allocation.array().parse(await pb.collection('allocations').getFullList());
    const loads = EmployeeMonthLoadRecord.array().parse(await pb.collection('employee_month_loads').getFullList());
    const byPair = (a: { employeeId: string; month: string }, b: { employeeId: string; month: string }): number =>
      `${a.employeeId}|${a.month}` < `${b.employeeId}|${b.month}` ? -1 : 1;
    expect(loads).toHaveLength(482);
    expect([...loads].sort(byPair)).toEqual(loadsOf(allocations));
  });
});
