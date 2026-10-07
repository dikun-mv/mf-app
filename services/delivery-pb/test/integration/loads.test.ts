import { EmployeeMonthLoadRecord } from '@baseline/delivery-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import type { RecordSubscription } from 'pocketbase';
import { batchRefusalOf, createClient, eventually, refusalOf, Scratch } from './setup';

// employee_month_loads is published read-only (D8): anyone lists, views and subscribes, and only the
// allocation hook writes. Each test removes what it adds.
const pb = createClient();
const loads = pb.collection('employee_month_loads');
const allocations = pb.collection('allocations');

const scratch = new Scratch(pb);
afterEach(async () => scratch.clean());

const FORBIDDEN = { status: 403, fieldCodes: {} };

describe('employee_month_loads is read-only through the API', () => {
  const row = {
    id: 'emp-001-2032-01',
    employeeId: 'emp-001',
    month: '2032-01',
    allocatedPersonMonths: 0.5,
    overCapacity: false,
    causingAllocationId: '',
  };

  it('refuses create, update and delete with 403', async () => {
    expect(await refusalOf(loads.create(row))).toEqual(FORBIDDEN);
    expect(await refusalOf(loads.update('emp-003-2026-06', { overCapacity: false }))).toEqual(FORBIDDEN);
    expect(await refusalOf(loads.delete('emp-003-2026-06'))).toEqual(FORBIDDEN);
    await expect(loads.getOne(row.id)).rejects.toMatchObject({ status: 404 });
    expect((await loads.getOne('emp-003-2026-06')).overCapacity).toBe(true);
  });

  it('refuses a write inside a batch, and nothing of the batch is kept', async () => {
    const leaf = await scratch.item();
    const id = scratch.allocationId();
    const batch = pb.createBatch();
    batch
      .collection('allocations')
      .create({ id, breakdownItemId: leaf, employeeId: 'emp-001', month: '2032-01', amount: 0.5 });
    batch.collection('employee_month_loads').create({ ...row, id: 'emp-001-2032-02', month: '2032-02' });
    const refusal = await batchRefusalOf(batch.send());
    expect(refusal.operations['1']?.status).toBe(403);
    await expect(allocations.getOne(id)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses writes to projects, which are read-only too', async () => {
    expect(await refusalOf(pb.collection('projects').update('prj-1', { name: 'Renamed' }))).toEqual(FORBIDDEN);
  });
});

describe('employee_month_loads realtime', () => {
  it('delivers the row change of an allocation edit to a subscriber on employee_month_loads', async () => {
    const events: RecordSubscription[] = [];
    const unsubscribe = await loads.subscribe('*', (event) => events.push(event));
    try {
      const id = 'emp-001-2032-03';
      const leaf = await scratch.item();
      const created = await scratch.allocation({
        breakdownItemId: leaf,
        employeeId: 'emp-001',
        month: '2032-03',
        amount: 0.5,
      });
      const createEvent = await eventually(() => events.find((e) => e.action === 'create' && e.record.id === id));
      expect(EmployeeMonthLoadRecord.parse(createEvent.record).allocatedPersonMonths).toBe(0.5);

      await allocations.update(created.id, { amount: 1.25 });
      const updateEvent = await eventually(() => events.find((e) => e.action === 'update' && e.record.id === id));
      expect(EmployeeMonthLoadRecord.parse(updateEvent.record)).toEqual({
        employeeId: 'emp-001',
        month: '2032-03',
        allocatedPersonMonths: 1.25,
        overCapacity: true,
        causingAllocationId: created.id,
      });

      await allocations.delete(created.id);
      await eventually(() => events.find((e) => e.action === 'delete' && e.record.id === id));
    } finally {
      await unsubscribe();
    }
  });
});

describe('every load row', () => {
  it('parses with EmployeeMonthLoadRecord, and its id is <employeeId>-<month>', async () => {
    const rows = await loads.getFullList();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const load = EmployeeMonthLoadRecord.parse(row);
      expect(row.id).toBe(`${load.employeeId}-${load.month}`);
      // Set exactly when over capacity.
      expect(load.causingAllocationId !== null).toBe(load.overCapacity);
    }
  });
});
