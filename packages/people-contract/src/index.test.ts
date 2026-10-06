import { describe, expect, it } from '@rstest/core';
import { EmployeeId, Employee, RateRecord, RateRecordId, WEEKLY_HOURS, WeeklyHours } from './index';

describe('people ids', () => {
  it('accept seed and client-generated forms', () => {
    expect(EmployeeId.safeParse('emp-001').success).toBe(true);
    expect(RateRecordId.safeParse('rate-150').success).toBe(true);
    expect(RateRecordId.safeParse(`rate-${crypto.randomUUID()}`).success).toBe(true);
  });

  it('do not accept each other', () => {
    expect(EmployeeId.safeParse('rate-001').success).toBe(false);
    expect(RateRecordId.safeParse('emp-001').success).toBe(false);
  });
});

describe('WeeklyHours', () => {
  it('is exactly the listed options', () => {
    expect(WEEKLY_HOURS).toEqual([40, 32, 20]);
    for (const hours of WEEKLY_HOURS) expect(WeeklyHours.safeParse(hours).success).toBe(true);
    expect(WeeklyHours.safeParse(35).success).toBe(false);
  });
});

describe('Employee and RateRecord', () => {
  it('parse the seed shape', () => {
    expect(
      Employee.safeParse({ id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 }).success,
    ).toBe(true);
    expect(
      RateRecord.safeParse({ id: 'rate-002', employeeId: 'emp-001', validFrom: '2026-03-12', hourlyCost: 95 }).success,
    ).toBe(true);
  });

  it('refuse a non-positive or non-finite rate', () => {
    const base = { id: 'rate-002', employeeId: 'emp-001', validFrom: '2026-03-12' };
    expect(RateRecord.safeParse({ ...base, hourlyCost: 0 }).success).toBe(false);
    expect(RateRecord.safeParse({ ...base, hourlyCost: -1 }).success).toBe(false);
    expect(RateRecord.safeParse({ ...base, hourlyCost: Infinity }).success).toBe(false);
  });
});
