import { EmployeeRecord, OKAFOR_RATE_RECORDS, RateRecord, RateRecordRecord } from '@baseline/people-contract';
import { describe, expect, it } from '@rstest/core';
import { createClient } from './setup';

// The seed (003_seed.js) as the plan's fixtures describe it, and the contract schemas on real records.
const pb = createClient();

describe('people-pb seed', () => {
  it('holds 60 employees and 150 rate records', async () => {
    expect(await pb.collection('employees').getFullList()).toHaveLength(60);
    expect(await pb.collection('rate_records').getFullList()).toHaveLength(150);
  });

  it('keeps the entity ids as record ids', async () => {
    const employee = await pb.collection('employees').getOne('emp-001');
    expect(employee).toMatchObject({ id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 });
    const rate = await pb.collection('rate_records').getOne('rate-002');
    expect(rate).toMatchObject({ employeeId: 'emp-001', validFrom: '2026-03-12', hourlyCost: 95 });
  });

  it('parses every employee with EmployeeRecord', async () => {
    const records = await pb.collection('employees').getFullList();
    const employees = records.map((record) => EmployeeRecord.parse(record));
    expect(employees).toHaveLength(60);
    // Only the entity's own fields are left.
    expect(Object.keys(employees[0] ?? {}).sort()).toEqual(['id', 'name', 'role', 'weeklyHours']);
  });

  it('parses every rate record with RateRecordRecord, each pointing at a seeded employee', async () => {
    const employeeIds = new Set((await pb.collection('employees').getFullList()).map((record) => record.id));
    const records = await pb.collection('rate_records').getFullList();
    const rates = records.map((record) => RateRecordRecord.parse(record));
    expect(rates).toHaveLength(150);
    expect(Object.keys(rates[0] ?? {}).sort()).toEqual(['employeeId', 'hourlyCost', 'id', 'validFrom']);
    for (const rate of rates) expect(employeeIds.has(rate.employeeId)).toBe(true);
  });

  it("matches the conformance fixture: A. Okafor's records are the ones the contract publishes", async () => {
    const records = await pb
      .collection('rate_records')
      .getFullList({ filter: 'employeeId = "emp-001"', sort: 'validFrom' });
    expect(records.map((record) => RateRecordRecord.parse(record))).toEqual(
      RateRecord.array().parse(OKAFOR_RATE_RECORDS),
    );
  });
});
