import { describe, expect, it } from '@rstest/core';
import { Allocation, AllocationId, BreakdownItem, EmployeeMonthLoad, Project, ProjectId } from './index';

describe('delivery ids', () => {
  it('accept seed and client-generated forms', () => {
    expect(ProjectId.safeParse('prj-1').success).toBe(true);
    expect(AllocationId.safeParse('alloc-720').success).toBe(true);
    expect(AllocationId.safeParse(`alloc-${crypto.randomUUID()}`).success).toBe(true);
  });
});

describe('entities', () => {
  it('parse the seed shapes', () => {
    expect(
      Project.safeParse({ id: 'prj-1', name: 'Ledger', startDate: '2026-03-01', endDate: '2027-02-28' }).success,
    ).toBe(true);
    expect(
      BreakdownItem.safeParse({ id: 'wbs-001', projectId: 'prj-1', parentId: null, name: 'Ledger migration' }).success,
    ).toBe(true);
    expect(
      Allocation.safeParse({
        id: 'alloc-001',
        breakdownItemId: 'wbs-012',
        employeeId: 'emp-001',
        month: '2026-03',
        amount: 0.5,
        editedAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('refuses a negative amount', () => {
    expect(
      Allocation.safeParse({
        id: 'alloc-001',
        breakdownItemId: 'wbs-012',
        employeeId: 'emp-001',
        month: '2026-03',
        amount: -0.1,
        editedAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('EmployeeMonthLoad', () => {
  it('allows no causer when the month is within capacity', () => {
    expect(
      EmployeeMonthLoad.safeParse({
        employeeId: 'emp-003',
        month: '2026-06',
        allocatedPersonMonths: 0.8,
        overCapacity: false,
        causingAllocationId: null,
      }).success,
    ).toBe(true);
  });
});
