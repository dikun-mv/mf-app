import { describe, expect, it } from '@rstest/core';
import {
  EmployeeId,
  Employee,
  EmployeeRecord,
  OKAFOR_MARCH_2026_SLICES,
  OKAFOR_RATE_RECORDS,
  PEOPLE_BASE_PATH,
  PEOPLE_COLLECTIONS,
  RateRecord,
  RateRecordId,
  RateRecordRecord,
  WEEKLY_HOURS,
  WeeklyHours,
} from './index';

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

describe('published paths and topics', () => {
  it('are the ones the gateway and the migrations use', () => {
    expect(PEOPLE_BASE_PATH).toBe('/api/people');
    expect(PEOPLE_COLLECTIONS).toEqual({ employees: 'employees', rateRecords: 'rate_records' });
  });
});

// What PocketBase sends for a record: the entity's fields plus collectionId and collectionName.
const pbEmployee = {
  collectionId: 'pbc_1234567890',
  collectionName: 'employees',
  id: 'emp-001',
  name: 'Adaeze Okafor',
  role: 'Tech Lead',
  weeklyHours: 40,
};
const pbRate = {
  collectionId: 'pbc_0987654321',
  collectionName: 'rate_records',
  id: 'rate-002',
  employeeId: 'emp-001',
  validFrom: '2026-03-12',
  hourlyCost: 95,
};

describe('EmployeeRecord', () => {
  it('parses a PocketBase record into an Employee and drops its own fields', () => {
    expect(EmployeeRecord.parse(pbEmployee)).toEqual({
      id: 'emp-001',
      name: 'Adaeze Okafor',
      role: 'Tech Lead',
      weeklyHours: 40,
    });
  });

  it('refuses a record of another collection and a value the entity refuses', () => {
    expect(EmployeeRecord.safeParse({ ...pbEmployee, collectionName: 'rate_records' }).success).toBe(false);
    expect(EmployeeRecord.safeParse({ ...pbEmployee, weeklyHours: 35 }).success).toBe(false);
    expect(EmployeeRecord.safeParse({ ...pbEmployee, name: '' }).success).toBe(false);
  });
});

describe('RateRecordRecord', () => {
  it('parses a PocketBase record into a RateRecord and drops its own fields', () => {
    expect(RateRecordRecord.parse(pbRate)).toEqual({
      id: 'rate-002',
      employeeId: 'emp-001',
      validFrom: '2026-03-12',
      hourlyCost: 95,
    });
  });

  it('accepts a client-generated id and refuses an employee relation that is empty or not an id', () => {
    expect(RateRecordRecord.safeParse({ ...pbRate, id: `rate-${crypto.randomUUID()}` }).success).toBe(true);
    expect(RateRecordRecord.safeParse({ ...pbRate, employeeId: '' }).success).toBe(false);
    expect(RateRecordRecord.safeParse({ ...pbRate, employeeId: 'rate-001' }).success).toBe(false);
  });

  it('refuses a record of another collection, a bad date and a non-positive rate', () => {
    expect(RateRecordRecord.safeParse({ ...pbRate, collectionName: 'employees' }).success).toBe(false);
    expect(RateRecordRecord.safeParse({ ...pbRate, validFrom: '2026-02-30' }).success).toBe(false);
    expect(RateRecordRecord.safeParse({ ...pbRate, hourlyCost: 0 }).success).toBe(false);
  });
});

describe('conformance fixture', () => {
  it('holds records the schemas accept, in order, for one employee', () => {
    const records = RateRecord.array().parse(OKAFOR_RATE_RECORDS);
    expect(records.map((record) => [record.employeeId, record.validFrom, record.hourlyCost])).toEqual([
      ['emp-001', '2025-01-01', 80],
      ['emp-001', '2026-03-12', 95],
    ]);
  });

  it('expects 8 working days at 80 and 14 at 95, covering March 2026 without gaps', () => {
    expect(OKAFOR_MARCH_2026_SLICES.map((slice) => [slice.workingDays, slice.hourlyCost])).toEqual([
      [8, 80],
      [14, 95],
    ]);
    expect(OKAFOR_MARCH_2026_SLICES[0].from).toBe('2026-03-01');
    expect(OKAFOR_MARCH_2026_SLICES[0].toExclusive).toBe(OKAFOR_MARCH_2026_SLICES[1].from);
    expect(OKAFOR_MARCH_2026_SLICES[1].toExclusive).toBe('2026-04-01');
  });

  it('counts the weekdays of each slice as written', () => {
    // An independent count, so the fixture's numbers are not only compared with themselves.
    const weekdays = (from: string, toExclusive: string): number => {
      let count = 0;
      for (let day = Date.parse(from); day < Date.parse(toExclusive); day += 86_400_000) {
        const weekday = new Date(day).getUTCDay();
        if (weekday !== 0 && weekday !== 6) count += 1;
      }
      return count;
    };
    for (const slice of OKAFOR_MARCH_2026_SLICES) {
      expect(weekdays(slice.from, slice.toExclusive)).toBe(slice.workingDays);
    }
  });

  it('switches rate on the second record, whose own day is priced at the new rate', () => {
    expect(OKAFOR_MARCH_2026_SLICES[1].from).toBe(OKAFOR_RATE_RECORDS[1].validFrom);
    expect(OKAFOR_MARCH_2026_SLICES[0].hourlyCost).toBe(OKAFOR_RATE_RECORDS[0].hourlyCost);
    expect(OKAFOR_MARCH_2026_SLICES[1].hourlyCost).toBe(OKAFOR_RATE_RECORDS[1].hourlyCost);
  });
});
