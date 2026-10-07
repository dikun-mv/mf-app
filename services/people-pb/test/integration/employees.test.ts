import { describe, expect, it } from '@rstest/core';
import { batchRefusalOf, createClient, refusalOf } from './setup';

// Employees are read-only through the API (D16): create, update and delete are locked rules, so every
// write is refused with 403 "Only superusers can perform this action." (ADR 033 h).
const pb = createClient();
const employees = pb.collection('employees');

describe('employees are read-only', () => {
  it('refuses a create, with and without an id', async () => {
    const body = { name: 'New Person', role: 'Engineer', weeklyHours: 40 };
    expect((await refusalOf(employees.create(body))).status).toBe(403);
    expect((await refusalOf(employees.create({ ...body, id: 'emp-900' }))).status).toBe(403);
    await expect(employees.getOne('emp-900')).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an update and leaves the record as it was', async () => {
    const before = await employees.getOne('emp-001');
    expect((await refusalOf(employees.update('emp-001', { name: 'Someone Else' }))).status).toBe(403);
    expect((await refusalOf(employees.update('emp-001', { weeklyHours: 20 }))).status).toBe(403);
    expect(await employees.getOne('emp-001')).toEqual(before);
  });

  it('refuses a delete', async () => {
    expect((await refusalOf(employees.delete('emp-001'))).status).toBe(403);
    expect(await employees.getOne('emp-001')).toMatchObject({ id: 'emp-001' });
  });

  it('refuses the same writes inside a batch, and keeps the rest of the batch out', async () => {
    const batch = pb.createBatch();
    batch.collection('rate_records').create({
      id: 'rate-batch-probe',
      employeeId: 'emp-001',
      validFrom: '2031-01-01',
      hourlyCost: 100,
    });
    batch.collection('employees').update('emp-001', { name: 'Someone Else' });
    // The batch fails as a whole (400), and names the employee update, operation 1, as the one refused (403).
    const refusal = await batchRefusalOf(batch.send());
    expect(refusal.status).toBe(400);
    expect(Object.keys(refusal.operations)).toEqual(['1']);
    expect(refusal.operations['1']?.status).toBe(403);
    // Nothing from the failed batch is left, and the employee is unchanged.
    await expect(pb.collection('rate_records').getOne('rate-batch-probe')).rejects.toMatchObject({ status: 404 });
    expect(await employees.getOne('emp-001')).toMatchObject({ name: 'Adaeze Okafor' });
  });

  it('still lists and views them (public read rules)', async () => {
    const page = await employees.getList(1, 5, { sort: 'id' });
    expect(page.totalItems).toBe(60);
    expect(page.items.map((record) => record.id)).toEqual(['emp-001', 'emp-002', 'emp-003', 'emp-004', 'emp-005']);
  });
});
