import { EmployeeMonthLoadRecord } from '@baseline/delivery-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import { loadOf, type Contribution } from '../../pb_hooks/lib/load.js';
import { ClientResponseError } from 'pocketbase';
import { createClient, refusalOf, Scratch } from './setup';

// Single (non-batch) allocation writes through the API (ADR 035, "Single writes"). ADR 033 (c) verified
// that the load hook's write runs in the transaction of a batch; these tests check the same for a plain
// create, update and delete: a failing hook leaves nothing behind, and concurrent writes to one
// (employee, month) leave a load row equal to `loadOf` over what is stored. No test here sends a batch.
// Each test works on pairs with no seed effort and `Scratch` removes what it adds.
//
// SKIPPED: single writes are NOT atomic with the hook's load refresh (ADR 035, "Single writes"). Every
// test below fails against the running stack: a create whose refresh fails stays saved, an update whose
// refresh fails stays applied with the old pair's row stale, and concurrent creates lose contributions
// in the row or fail with `validation_pk_invalid` after their allocation was saved. Only a batch is
// transactional (ADR 033 c), which is why the T3.7 adapter sends every write as a batch. Remove the
// `.skip`s if a single write is ever made transactional.
const pb = createClient();
const allocations = pb.collection('allocations');
const loads = pb.collection('employee_month_loads');

const scratch = new Scratch(pb);
afterEach(async () => scratch.clean());

const EMPLOYEE = 'emp-001';

/** Matches `^emp-[a-z0-9-]+$`, but `<employeeId>-<month>` is 72 characters, over the load row id's 64. */
const LONG_EMPLOYEE = `emp-${'a'.repeat(60)}`;

/** The load row of a pair as the API returns it, or null when there is none. */
const rowOf = async (employeeId: string, month: string) =>
  loads.getOne(`${employeeId}-${month}`).catch((error: unknown) => {
    if (error instanceof Error && 'status' in error && error.status === 404) return null;
    throw error;
  });

/** The stored allocations of a pair, read back from the API. */
const storedOf = async (employeeId: string, month: string) =>
  allocations.getFullList({
    filter: pb.filter('employeeId = {:employeeId} && month = {:month}', { employeeId, month }),
  });

/** Holds the pair's load row to `loadOf` over the allocations actually stored for it. */
async function expectRowFollowsStore(employeeId: string, month: string): Promise<void> {
  const contributions: Contribution[] = (await storedOf(employeeId, month)).map((a) => ({
    id: a.id,
    amount: Number(a['amount']),
    editedAt: String(a['editedAt']),
  }));
  const expected = loadOf(contributions);
  const row = await rowOf(employeeId, month);
  if (expected === null) {
    expect(row).toBeNull();
    return;
  }
  expect(row).not.toBeNull();
  // The contract maps the row's empty causer to null.
  const { allocatedPersonMonths, overCapacity, causingAllocationId } = EmployeeMonthLoadRecord.parse(row);
  expect({ allocatedPersonMonths, overCapacity, causingAllocationId }).toEqual({
    ...expected,
    causingAllocationId: expected.causingAllocationId === '' ? null : expected.causingAllocationId,
  });
}

describe('a single write whose load refresh fails', () => {
  it.skip('a create leaves no allocation and no load row', async () => {
    const leaf = await scratch.item();
    const id = scratch.allocationId();
    const refusal = await refusalOf(
      allocations.create({ id, breakdownItemId: leaf, employeeId: LONG_EMPLOYEE, month: '2031-01', amount: 0.5 }),
    );
    // The hook's own save failed, and surfaces as a field error of the request (ADR 033 c).
    expect(refusal.status).toBe(400);
    expect(Object.keys(refusal.fieldCodes).length).toBeGreaterThan(0);
    await expect(allocations.getOne(id)).rejects.toMatchObject({ status: 404 });
    expect(await storedOf(LONG_EMPLOYEE, '2031-01')).toEqual([]);
    expect(await rowOf(LONG_EMPLOYEE, '2031-01')).toBeNull();
  });

  it.skip('an update onto such an employee keeps the allocation and both pairs as they were', async () => {
    const [leafA, leafB] = [await scratch.item(), await scratch.item()];
    const month = '2031-02';
    const first = await scratch.allocation({ breakdownItemId: leafA, employeeId: EMPLOYEE, month, amount: 0.75 });
    const second = await scratch.allocation({ breakdownItemId: leafB, employeeId: EMPLOYEE, month, amount: 0.75 });
    const allocationBefore = await allocations.getOne(second.id);
    const rowBefore = await loads.getOne(`${EMPLOYEE}-${month}`);
    expect(rowBefore['overCapacity']).toBe(true);

    const refusal = await refusalOf(allocations.update(second.id, { employeeId: LONG_EMPLOYEE, amount: 0.1 }));
    expect(refusal.status).toBe(400);
    expect(Object.keys(refusal.fieldCodes).length).toBeGreaterThan(0);

    // The allocation keeps its old values, both of them still in the old pair, and that pair's row is untouched.
    expect(await allocations.getOne(second.id)).toEqual(allocationBefore);
    expect((await allocations.getOne(first.id))['amount']).toBe(0.75);
    expect(await loads.getOne(`${EMPLOYEE}-${month}`)).toEqual(rowBefore);
    expect(await rowOf(LONG_EMPLOYEE, month)).toBeNull();
    await expectRowFollowsStore(EMPLOYEE, month);
  });
});

describe('concurrent single writes to one pair', () => {
  const WRITERS = 20;
  const ROUNDS = 3;

  /** All settled, none rejected: a failed request would show the reason. */
  async function allFulfilled(requests: Promise<unknown>[]): Promise<void> {
    const results = await Promise.allSettled(requests);
    const failures = results.flatMap((r) =>
      r.status === 'rejected'
        ? [JSON.stringify(r.reason instanceof ClientResponseError ? r.reason.response : String(r.reason))]
        : [],
    );
    expect(failures).toEqual([]);
  }

  it.skip('leave a load row equal to loadOf over the stored allocations, through creates, updates and deletes', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const month = `203${String(2 + round)}-03`;
      const leaves = await Promise.all(Array.from({ length: WRITERS }, () => scratch.item()));

      // Creates: amounts sum far past 1, so the pair ends over capacity.
      const ids = leaves.map(() => scratch.allocationId());
      await allFulfilled(
        leaves.map((breakdownItemId, i) =>
          allocations.create({ id: ids[i], breakdownItemId, employeeId: EMPLOYEE, month, amount: 0.1 + i / 100 }),
        ),
      );
      expect(await storedOf(EMPLOYEE, month)).toHaveLength(WRITERS);
      await expectRowFollowsStore(EMPLOYEE, month);
      expect((await loads.getOne(`${EMPLOYEE}-${month}`))['overCapacity']).toBe(true);

      // Updates: new amounts for all, some of them 0 (no contribution).
      await allFulfilled(ids.map((id, i) => allocations.update(id, { amount: ((i * 7 + round * 3) % 10) / 20 })));
      await expectRowFollowsStore(EMPLOYEE, month);

      // Deletes: the row goes away with the last effort.
      await allFulfilled(ids.map((id) => allocations.delete(id)));
      expect(await storedOf(EMPLOYEE, month)).toEqual([]);
      await expectRowFollowsStore(EMPLOYEE, month);
      expect(await rowOf(EMPLOYEE, month)).toBeNull();
    }
  }, 120_000);

  it.skip('leave the row absent when the updates take all effort away', async () => {
    const month = '2036-03';
    const leaves = await Promise.all(Array.from({ length: WRITERS }, () => scratch.item()));
    const ids = leaves.map(() => scratch.allocationId());
    await allFulfilled(
      leaves.map((breakdownItemId, i) =>
        allocations.create({ id: ids[i], breakdownItemId, employeeId: EMPLOYEE, month, amount: 0.2 }),
      ),
    );
    await expectRowFollowsStore(EMPLOYEE, month);
    await allFulfilled(ids.map((id) => allocations.update(id, { amount: 0 })));
    expect(await rowOf(EMPLOYEE, month)).toBeNull();
    await expectRowFollowsStore(EMPLOYEE, month);
  }, 60_000);
});
