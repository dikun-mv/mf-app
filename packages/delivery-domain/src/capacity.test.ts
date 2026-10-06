import { AllocationId } from '@baseline/delivery-contract';
import { Month } from '@baseline/host-contract';
import { EmployeeId } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { upsertAllocation } from './allocations';
import { CAPACITY_EPSILON, causingAllocation, compareByLastEdit, isOverCapacity, loadKey, loadsOf } from './capacity';
import { applyChangeSet } from './changeSet';
import { moveItem } from './tree';
import { BreakdownItemId } from '@baseline/delivery-contract';
import { IsoDateTime } from '@baseline/host-contract';
import { SEEDED_AT, seedAllocations, seedPlan } from './testing/seed';
import { allocation, item, plan, project } from './testing/stateBuilders';

describe('isOverCapacity', () => {
  it('is over only above one person-month, with a floating-point allowance', () => {
    expect(isOverCapacity(1)).toBe(false);
    expect(isOverCapacity(0.3 + 0.7)).toBe(false);
    expect(isOverCapacity(0.1 + 0.2 + 0.7)).toBe(false); // 1.0000000000000002
    expect(isOverCapacity(1 + 2 * CAPACITY_EPSILON)).toBe(true);
    expect(isOverCapacity(1.01)).toBe(true);
  });
});

describe('causingAllocation (D18)', () => {
  const at = (id: string, editedAt: string, amount = 0.5) =>
    allocation(id, 'wbs-1', 'emp-001', '2026-03', amount, editedAt);

  it('is the contributor with the latest editedAt', () => {
    const picked = causingAllocation([
      at('alloc-9', '2026-01-01T00:00:00.000Z'),
      at('alloc-1', '2026-02-01T00:00:00.000Z'),
    ]);
    expect(picked?.id).toBe('alloc-1');
  });

  it('breaks a tie with the highest id', () => {
    const picked = causingAllocation([
      at('alloc-280', SEEDED_AT),
      at('alloc-293', SEEDED_AT),
      at('alloc-100', SEEDED_AT),
    ]);
    expect(picked?.id).toBe('alloc-293');
  });

  it('ignores allocations that contribute nothing', () => {
    const picked = causingAllocation([
      at('alloc-1', '2026-01-01T00:00:00.000Z'),
      at('alloc-2', '2026-09-01T00:00:00.000Z', 0),
    ]);
    expect(picked?.id).toBe('alloc-1');
    expect(causingAllocation([at('alloc-2', SEEDED_AT, 0)])).toBeNull();
    expect(causingAllocation([])).toBeNull();
  });

  it('orders by editedAt first, then id', () => {
    expect(compareByLastEdit(at('alloc-2', SEEDED_AT), at('alloc-1', SEEDED_AT))).toBeGreaterThan(0);
    expect(
      compareByLastEdit(at('alloc-9', '2026-01-01T00:00:00.000Z'), at('alloc-1', '2026-02-01T00:00:00.000Z')),
    ).toBeLessThan(0);
    expect(compareByLastEdit(at('alloc-1', SEEDED_AT), at('alloc-1', SEEDED_AT))).toBe(0);
  });
});

describe('loadsOf', () => {
  it('sums across every project per (employee, month)', () => {
    const loads = loadsOf([
      allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.6),
      allocation('alloc-2', 'wbs-7', 'emp-001', '2026-03', 0.5),
      allocation('alloc-3', 'wbs-1', 'emp-001', '2026-04', 0.4),
    ]);
    expect(loads).toEqual([
      {
        employeeId: 'emp-001',
        month: '2026-03',
        allocatedPersonMonths: 1.1,
        overCapacity: true,
        causingAllocationId: 'alloc-2',
      },
      {
        employeeId: 'emp-001',
        month: '2026-04',
        allocatedPersonMonths: 0.4,
        overCapacity: false,
        causingAllocationId: null,
      },
    ]);
  });

  it('does not depend on input order', () => {
    const list = [
      allocation('alloc-3', 'wbs-1', 'emp-002', '2026-03', 0.7),
      allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.6),
      allocation('alloc-2', 'wbs-7', 'emp-001', '2026-03', 0.5),
    ];
    expect(loadsOf([...list].reverse())).toEqual(loadsOf(list));
  });

  it('sorts by employee, then by month', () => {
    const loads = loadsOf([
      allocation('alloc-1', 'wbs-1', 'emp-002', '2026-03', 0.1),
      allocation('alloc-2', 'wbs-1', 'emp-001', '2026-05', 0.1),
      allocation('alloc-3', 'wbs-1', 'emp-001', '2026-04', 0.1),
      allocation('alloc-4', 'wbs-1', 'emp-002', '2026-02', 0.1),
    ]);
    expect(loads.map((load) => `${load.employeeId} ${load.month}`)).toEqual([
      'emp-001 2026-04',
      'emp-001 2026-05',
      'emp-002 2026-02',
      'emp-002 2026-03',
    ]);
  });

  it('leaves out zero-effort allocations', () => {
    expect(loadsOf([allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0)])).toEqual([]);
  });

  describe('on the seed (plan §1)', () => {
    const loads = loadsOf(seedAllocations);
    const over = loads.filter((load) => load.overCapacity);

    it('finds exactly the six over-capacity person-months, each caused by the second id of its pair', () => {
      expect(over.map((load) => [load.employeeId, load.month, load.causingAllocationId])).toEqual([
        ['emp-002', '2026-09', 'alloc-293'],
        ['emp-003', '2026-06', 'alloc-073'],
        ['emp-012', '2026-05', 'alloc-043'],
        ['emp-023', '2026-06', 'alloc-101'],
        ['emp-031', '2026-12', 'alloc-613'],
        ['emp-043', '2026-10', 'alloc-421'],
      ]);
    });

    it('sums M. Brandt’s June 2026 from two projects (emp-003: alloc-050 + alloc-073)', () => {
      const brandt = loads.find((load) => load.employeeId === 'emp-003' && load.month === '2026-06');
      const parts = seedAllocations.filter((a) => a.id === 'alloc-050' || a.id === 'alloc-073');
      expect(brandt?.allocatedPersonMonths).toBeCloseTo(
        parts.reduce((sum, a) => sum + a.amount, 0),
        12,
      );
    });

    it('lets a later user edit take over as the causer', () => {
      const state = seedPlan();
      const brandt = seedAllocations.find((a) => a.id === 'alloc-050');
      if (brandt === undefined) throw new Error('alloc-050 is missing from the seed');
      const edit = upsertAllocation(
        state,
        {
          ...brandt,
          id: AllocationId.parse('alloc-00000000-0000-4000-8000-000000000000'),
          amount: brandt.amount + 0.01,
        },
        IsoDateTime.parse('2026-10-06T12:00:00.000Z'),
      );
      if (!edit.ok) throw new Error(JSON.stringify(edit.error));
      const after = applyChangeSet(state, edit.value);
      const june = loadsOf(after.allocations).find((l) => l.employeeId === 'emp-003' && l.month === '2026-06');
      expect(june?.causingAllocationId).toBe('alloc-050'); // beats the seed row alloc-073
    });
  });

  it('keeps the causer when an allocation moves, because moves do not touch editedAt (D18)', () => {
    const state = plan({
      projects: [project('prj-1'), project('prj-2')],
      items: [item('wbs-1', 'prj-1', null), item('wbs-2', 'prj-1', null), item('wbs-3', 'prj-2', null)],
      allocations: [
        allocation('alloc-1', 'wbs-1', 'emp-001', '2026-03', 0.7, '2026-02-01T00:00:00.000Z'),
        allocation('alloc-2', 'wbs-3', 'emp-001', '2026-03', 0.6, '2026-01-01T00:00:00.000Z'),
      ],
    });
    const before = loadsOf(state.allocations);
    expect(before[0]?.causingAllocationId).toBe('alloc-1');

    const moved = moveItem(state, BreakdownItemId.parse('wbs-1'), BreakdownItemId.parse('wbs-2'));
    if (!moved.ok) throw new Error(JSON.stringify(moved.error));
    const after = applyChangeSet(state, moved.value);
    expect(after.items.find((i) => i.id === 'wbs-1')?.parentId).toBe('wbs-2');
    expect(loadsOf(after.allocations)).toEqual(before);
  });

  it('keys a load by employee and month', () => {
    expect(loadKey(EmployeeId.parse('emp-001'), Month.parse('2026-03'))).toBe('emp-001|2026-03');
  });
});
