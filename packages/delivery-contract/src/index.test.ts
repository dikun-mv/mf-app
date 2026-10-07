import { describe, expect, it } from '@rstest/core';
import {
  Allocation,
  AllocationId,
  BreakdownItem,
  DELIVERY_BASE_PATH,
  DELIVERY_COLLECTIONS,
  EmployeeMonthLoad,
  EmployeeMonthLoadRecord,
  Project,
  ProjectId,
} from './index';

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

describe('published names', () => {
  it('are the gateway path and the one published collection', () => {
    expect(DELIVERY_BASE_PATH).toBe('/api/delivery');
    expect(DELIVERY_COLLECTIONS).toEqual({ employeeMonthLoads: 'employee_month_loads' });
  });
});

describe('EmployeeMonthLoadRecord', () => {
  const row = {
    id: 'emp-003-2026-06',
    collectionId: 'pbc_123',
    collectionName: 'employee_month_loads',
    employeeId: 'emp-003',
    month: '2026-06',
    allocatedPersonMonths: 1.2,
    overCapacity: true,
    causingAllocationId: 'alloc-073',
  };

  it('parses a row into an EmployeeMonthLoad and drops the PocketBase fields', () => {
    expect(EmployeeMonthLoadRecord.parse(row)).toEqual({
      employeeId: 'emp-003',
      month: '2026-06',
      allocatedPersonMonths: 1.2,
      overCapacity: true,
      causingAllocationId: 'alloc-073',
    });
  });

  it('reads an empty causer as null', () => {
    const parsed = EmployeeMonthLoadRecord.parse({
      ...row,
      allocatedPersonMonths: 0.8,
      overCapacity: false,
      causingAllocationId: '',
    });
    expect(parsed.causingAllocationId).toBeNull();
    expect(EmployeeMonthLoad.safeParse(parsed).success).toBe(true);
  });

  it('refuses a record of another collection and a malformed causer', () => {
    expect(EmployeeMonthLoadRecord.safeParse({ ...row, collectionName: 'allocations' }).success).toBe(false);
    expect(EmployeeMonthLoadRecord.safeParse({ ...row, causingAllocationId: 'nope' }).success).toBe(false);
  });
});
