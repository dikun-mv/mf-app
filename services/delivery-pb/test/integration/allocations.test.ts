import { Allocation, EmployeeMonthLoadRecord, type EmployeeMonthLoad } from '@baseline/delivery-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import { batchRefusalOf, createClient, refusalOf, Scratch, tick } from './setup';

// The two allocation hooks, through the API (T3.6, D8, D18): `editedAt` is stamped by the server on effort
// edits only, and `employee_month_loads` follows every write inside its transaction. Each test works on a
// (employee, month) pair with no seed effort, and `Scratch` removes what it adds.
const pb = createClient();
const allocations = pb.collection('allocations');
const loads = pb.collection('employee_month_loads');

const EMPLOYEE = 'emp-001';
const MONTH = '2031-05';
const scratch = new Scratch(pb);

afterEach(async () => scratch.clean());

const allocationOf = async (id: string) => Allocation.parse(await allocations.getOne(id));
const loadOfPair = async (month = MONTH): Promise<EmployeeMonthLoad> =>
  EmployeeMonthLoadRecord.parse(await loads.getOne(`${EMPLOYEE}-${month}`));

/** Two leaves with 0.75 each in the same pair: over capacity (1.5), the second write the causer. */
async function overCapacityPair() {
  const [leafA, leafB] = [await scratch.item(), await scratch.item()];
  const first = Allocation.parse(
    await scratch.allocation({ breakdownItemId: leafA, employeeId: EMPLOYEE, month: MONTH, amount: 0.75 }),
  );
  await tick();
  const second = Allocation.parse(
    await scratch.allocation({ breakdownItemId: leafB, employeeId: EMPLOYEE, month: MONTH, amount: 0.75 }),
  );
  return { leafA, leafB, first, second };
}

describe('editedAt', () => {
  it('is stamped by the server on create, whatever the client sends', async () => {
    const leaf = await scratch.item();
    const before = Date.now();
    const created = Allocation.parse(
      await allocations.create({
        id: scratch.allocationId(),
        breakdownItemId: leaf,
        employeeId: EMPLOYEE,
        month: MONTH,
        amount: 0.3,
        editedAt: '1999-01-01T00:00:00.000Z',
      }),
    );
    expect(Date.parse(created.editedAt)).toBeGreaterThanOrEqual(before);
  });

  it('is renewed by an amount edit, and the edited allocation becomes the causer', async () => {
    const { first, second } = await overCapacityPair();
    expect((await loadOfPair()).causingAllocationId).toBe(second.id);

    await tick();
    await allocations.update(first.id, { amount: 0.5, editedAt: '1999-01-01T00:00:00.000Z' });
    const edited = await allocationOf(first.id);
    expect(edited.editedAt > second.editedAt).toBe(true);
    expect(edited.amount).toBe(0.5);
    expect(await loadOfPair()).toEqual({
      employeeId: EMPLOYEE,
      month: MONTH,
      allocatedPersonMonths: 1.25,
      overCapacity: true,
      causingAllocationId: first.id,
    });
  });

  it('is kept when an update does not change the amount, whatever the client sends', async () => {
    const { first } = await overCapacityPair();
    await tick();
    await allocations.update(first.id, { amount: 0.75, editedAt: '2099-01-01T00:00:00.000Z' });
    expect((await allocationOf(first.id)).editedAt).toBe(first.editedAt);
  });

  it('lets a user edit beat the seed rows as causer, and gives the seed causer back on delete', async () => {
    // emp-003 2026-06 is over capacity with alloc-050 and alloc-073, seeded together: alloc-073 is the causer.
    const pairId = 'emp-003-2026-06';
    const seedLoad = EmployeeMonthLoadRecord.parse(await loads.getOne(pairId));
    expect(seedLoad.causingAllocationId).toBe('alloc-073');

    const added = Allocation.parse(
      await scratch.allocation({
        breakdownItemId: await scratch.item(),
        employeeId: 'emp-003',
        month: '2026-06',
        amount: 0.01,
      }),
    );
    const during = EmployeeMonthLoadRecord.parse(await loads.getOne(pairId));
    expect(during.causingAllocationId).toBe(added.id);
    expect(during.allocatedPersonMonths).toBeCloseTo(seedLoad.allocatedPersonMonths + 0.01, 10);

    await allocations.delete(added.id);
    expect(EmployeeMonthLoadRecord.parse(await loads.getOne(pairId))).toEqual(seedLoad);
  });
});

describe('employee_month_loads follows the allocations', () => {
  it('creates, updates and deletes the row with the allocations of the pair', async () => {
    const leaf = await scratch.item();
    const only = Allocation.parse(
      await scratch.allocation({ breakdownItemId: leaf, employeeId: EMPLOYEE, month: MONTH, amount: 0.4 }),
    );
    expect(await loadOfPair()).toMatchObject({
      allocatedPersonMonths: 0.4,
      overCapacity: false,
      causingAllocationId: null,
    });

    await allocations.update(only.id, { amount: 0 });
    // No effort left: the row goes away, and a zero amount is a valid value.
    await expect(loads.getOne(`${EMPLOYEE}-${MONTH}`)).rejects.toMatchObject({ status: 404 });

    await allocations.update(only.id, { amount: 0.5 });
    expect((await loadOfPair()).allocatedPersonMonths).toBe(0.5);
    await allocations.delete(only.id);
    await expect(loads.getOne(`${EMPLOYEE}-${MONTH}`)).rejects.toMatchObject({ status: 404 });
  });

  it('refreshes both pairs when an allocation changes month', async () => {
    const leaf = await scratch.item();
    const moved = Allocation.parse(
      await scratch.allocation({ breakdownItemId: leaf, employeeId: EMPLOYEE, month: MONTH, amount: 0.4 }),
    );
    await allocations.update(moved.id, { month: '2031-06' });
    await expect(loads.getOne(`${EMPLOYEE}-${MONTH}`)).rejects.toMatchObject({ status: 404 });
    expect((await loadOfPair('2031-06')).allocatedPersonMonths).toBe(0.4);
    // A change of month is not an effort edit.
    expect((await allocationOf(moved.id)).editedAt).toBe(moved.editedAt);
    await allocations.delete(moved.id);
  });
});

describe('a move', () => {
  it('keeps editedAt and the load when the allocation gets a new breakdownItemId', async () => {
    const { first, second, leafB } = await overCapacityPair();
    const leafC = await scratch.item();
    const loadBefore = await loadOfPair();

    await allocations.update(second.id, { breakdownItemId: leafC });
    expect(await allocationOf(second.id)).toEqual({ ...second, breakdownItemId: leafC });
    expect(await loadOfPair()).toEqual(loadBefore);
    expect(loadBefore.causingAllocationId).toBe(second.id);
    expect((await allocationOf(first.id)).editedAt).toBe(first.editedAt);
    expect(leafB).not.toBe(leafC);
  });
});

describe('a D9 batch', () => {
  it('creates a child under a leaf and re-points its allocations as one commit, keeping editedAt and the load', async () => {
    const { leafA, first, second } = await overCapacityPair();
    // Re-pointing the leaf's own allocations (here one, the first) to the new child.
    const loadBefore = await loadOfPair();
    const child = `wbs-${crypto.randomUUID()}`;
    scratch.items.push(child);

    await tick();
    const batch = pb.createBatch();
    batch
      .collection('breakdown_items')
      .create({ id: child, projectId: 'prj-1', parentId: leafA, name: 'scratch child' });
    batch.collection('allocations').update(first.id, { breakdownItemId: child });
    const results = await batch.send();
    expect(results.map((r) => r.status)).toEqual([200, 200]);

    expect(await allocationOf(first.id)).toEqual({ ...first, breakdownItemId: child });
    expect((await allocationOf(second.id)).editedAt).toBe(second.editedAt);
    expect(await loadOfPair()).toEqual(loadBefore);
    expect(await pb.collection('breakdown_items').getOne(child)).toMatchObject({ parentId: leafA });
  });
});

describe('a batch with one bad operation', () => {
  it('leaves no allocation and no load row behind', async () => {
    const leaf = await scratch.item();
    const good = scratch.allocationId();
    const batch = pb.createBatch();
    const base = { breakdownItemId: leaf, employeeId: EMPLOYEE, month: MONTH };
    batch.collection('allocations').create({ id: good, ...base, amount: 0.5 });
    batch.collection('allocations').create({ id: scratch.allocationId(), ...base, month: '2031-13', amount: 0.5 });

    const refusal = await batchRefusalOf(batch.send());
    expect(refusal.status).toBe(400);
    expect(refusal.operations['1']).toEqual({ status: 400, fieldCodes: { month: 'validation_invalid_format' } });
    await expect(allocations.getOne(good)).rejects.toMatchObject({ status: 404 });
    await expect(loads.getOne(`${EMPLOYEE}-${MONTH}`)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the earlier allocations and the load row as they were', async () => {
    const { first, second } = await overCapacityPair();
    const loadBefore = await loadOfPair();

    const batch = pb.createBatch();
    batch.collection('allocations').update(first.id, { amount: 0.1 });
    batch.collection('allocations').update(second.id, { amount: -1 });
    await batchRefusalOf(batch.send());

    expect(await allocationOf(first.id)).toEqual(first);
    expect(await allocationOf(second.id)).toEqual(second);
    expect(await loadOfPair()).toEqual(loadBefore);
  });
});

describe('the unique index', () => {
  it('refuses a second allocation on the same (breakdownItemId, employeeId, month)', async () => {
    const leaf = await scratch.item();
    const cell = { breakdownItemId: leaf, employeeId: EMPLOYEE, month: MONTH };
    await scratch.allocation({ ...cell, amount: 0.2 });

    const second = scratch.allocationId();
    const refusal = await refusalOf(allocations.create({ id: second, ...cell, amount: 0.3 }));
    expect(refusal).toEqual({
      status: 400,
      fieldCodes: {
        breakdownItemId: 'validation_not_unique',
        employeeId: 'validation_not_unique',
        month: 'validation_not_unique',
      },
    });
    await expect(allocations.getOne(second)).rejects.toMatchObject({ status: 404 });
    expect((await loadOfPair()).allocatedPersonMonths).toBe(0.2);
  });
});
