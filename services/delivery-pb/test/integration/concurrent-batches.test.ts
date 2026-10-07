import { EmployeeMonthLoadRecord } from '@baseline/delivery-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import { ClientResponseError } from 'pocketbase';
import { loadOf, type Contribution } from '../../pb_hooks/lib/load.js';
import { createClient, Scratch, SEED_PROJECT } from './setup';

// Concurrent batches onto one (employee, month) pair (ADR 035, "Concurrent batches"). Single writes are
// not atomic with the load refresh (ADR 035, "Single writes"), but a batch is (ADR 033 c). This asks whether
// two batches running at once can still lose a load-row update: about 20 batches are sent in parallel at a
// time, and afterwards every batch must have answered 200 and each pair's load row must equal `loadOf` over
// the allocations stored for it (absent when `loadOf` gives null). Every write here, the setup of each step
// included, goes through `pb.createBatch()`; no test sends a single write. Each round works on fresh
// employees, so its pairs have no seed effort, and `Scratch` removes what it adds.
const pb = createClient();
const loads = pb.collection('employee_month_loads');
const allocations = pb.collection('allocations');

const scratch = new Scratch(pb);
afterEach(async () => scratch.clean());

const ROUNDS = 3;
const BATCHES = 20;
/** PocketBase's default limit is 50 requests per batch; stay well under it. */
const CHUNK = 25;

interface Pair {
  readonly employeeId: string;
  readonly month: string;
}

/** A pair no other test or run has touched: a fresh employee id (`emp-<uuid>`, which the contract accepts) in a far month. */
const freshPair = (month: string): Pair => ({ employeeId: `emp-${crypto.randomUUID()}`, month });

/** A month far from the seed's (2026-2027): the round picks the year, so any number of rounds gives a valid month. */
const monthOf = (round: number, month: number): string => `${String(2040 + round)}-${String(month).padStart(2, '0')}`;

/** The load row of a pair as the API returns it, or null when there is none. */
const rowOf = async ({ employeeId, month }: Pair) =>
  loads.getOne(`${employeeId}-${month}`).catch((error: unknown) => {
    if (error instanceof Error && 'status' in error && error.status === 404) return null;
    throw error;
  });

/** The stored allocations of a pair, read back from the API. */
const storedOf = async ({ employeeId, month }: Pair) =>
  allocations.getFullList({
    filter: pb.filter('employeeId = {:employeeId} && month = {:month}', { employeeId, month }),
  });

/** Holds the pair's load row to `loadOf` over the allocations actually stored for it, flag and causer included. */
async function expectRowFollowsStore(pair: Pair): Promise<void> {
  const contributions: Contribution[] = (await storedOf(pair)).map((a) => ({
    id: a.id,
    amount: Number(a['amount']),
    editedAt: String(a['editedAt']),
  }));
  const expected = loadOf(contributions);
  const row = await rowOf(pair);
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

/** A batch's failure as recorded for the ADR: the error body PocketBase answered with, or the thrown reason. */
const failureOf = (reason: unknown): string =>
  JSON.stringify(reason instanceof ClientResponseError ? reason.response : String(reason));

/**
 * Sends the batches at once. Every one must answer 200 as a whole (the SDK rejects anything else, with PocketBase's
 * error body) and succeed in each operation: 200 for a create or update, 204 for a delete.
 */
async function sendAllAtOnce(batches: { send: () => Promise<{ status: number }[]> }[]): Promise<void> {
  const settled = await Promise.allSettled(batches.map(async (batch) => batch.send()));
  const problems = settled.flatMap((result, i) => {
    if (result.status === 'rejected') return [`batch ${String(i)}: ${failureOf(result.reason)}`];
    const bad = result.value.filter((r) => r.status !== 200 && r.status !== 204);
    return bad.length > 0 ? [`batch ${String(i)}: operation statuses ${JSON.stringify(bad)}`] : [];
  });
  // On failure the list shows which batches failed and with what.
  expect(problems).toEqual([]);
}

/** `count` breakdown items, created by batches and registered for cleanup. They are leaves: nothing hangs under them. */
async function leaves(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => `wbs-${crypto.randomUUID()}`);
  scratch.items.push(...ids);
  for (let from = 0; from < count; from += CHUNK) {
    const batch = pb.createBatch();
    for (const id of ids.slice(from, from + CHUNK))
      batch.collection('breakdown_items').create({ id, projectId: SEED_PROJECT, parentId: '', name: 'scratch' });
    await batch.send();
  }
  return ids;
}

interface Planned {
  readonly id: string;
  readonly breakdownItemId: string;
  readonly amount: number;
}

/** Allocations of a pair, one per leaf, created by sequential batches (setup for the update, move and delete steps). */
async function seedPair(pair: Pair, leafIds: string[], amountOf: (i: number) => number): Promise<Planned[]> {
  const planned = leafIds.map((breakdownItemId, i) => ({
    id: scratch.allocationId(),
    breakdownItemId,
    amount: amountOf(i),
  }));
  for (let from = 0; from < planned.length; from += CHUNK) {
    const batch = pb.createBatch();
    for (const p of planned.slice(from, from + CHUNK)) batch.collection('allocations').create({ ...p, ...pair });
    await batch.send();
  }
  return planned;
}

/** Splits a list into consecutive runs whose sizes cycle through `sizes`, until the list ends. */
function runsOf<T>(items: T[], sizes: number[]): T[][] {
  const runs: T[][] = [];
  for (let at = 0, i = 0; at < items.length; i++) {
    const size = sizes[i % sizes.length] ?? 1;
    runs.push(items.slice(at, at + size));
    at += size;
  }
  return runs;
}

describe('concurrent batches onto one pair', () => {
  it('creates: 20 batches of 2-3 allocations each keep the row equal to loadOf', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const pair = freshPair(monthOf(round, 3));
      const sizes = Array.from({ length: BATCHES }, (_, i) => 2 + (i % 2));
      const leafIds = await leaves(sizes.reduce((a, b) => a + b, 0));
      let next = 0;
      const batches = sizes.map((size) => {
        const batch = pb.createBatch();
        for (let k = 0; k < size; k++, next++)
          batch.collection('allocations').create({
            id: scratch.allocationId(),
            breakdownItemId: leafIds[next],
            ...pair,
            amount: 0.05 + (next % 10) / 25,
          });
        return batch;
      });
      await sendAllAtOnce(batches);

      expect(await storedOf(pair)).toHaveLength(next);
      await expectRowFollowsStore(pair);
      expect((await rowOf(pair))?.['overCapacity']).toBe(true);
    }
  }, 120_000);

  it('updates: 20 batches changing the amounts of 2-3 allocations each, some to 0, keep the row equal to loadOf', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const pair = freshPair(monthOf(round, 4));
      const sizes = Array.from({ length: BATCHES }, (_, i) => 2 + (i % 2));
      const leafIds = await leaves(sizes.reduce((a, b) => a + b, 0));
      const planned = await seedPair(pair, leafIds, (i) => 0.1 + (i % 7) / 20);
      await expectRowFollowsStore(pair);

      let n = 0;
      const batches = runsOf(planned, [2, 3]).map((run) => {
        const batch = pb.createBatch();
        for (const p of run) {
          // Every fourth allocation goes to 0: no contribution. The rest get a new amount.
          batch.collection('allocations').update(p.id, { amount: n % 4 === 0 ? 0 : ((n * 7 + round * 3) % 10) / 20 });
          n++;
        }
        return batch;
      });
      await sendAllAtOnce(batches);
      await expectRowFollowsStore(pair);
    }
  }, 120_000);

  it('moves: 20 batches each moving one allocation between two pairs keep both rows equal to loadOf', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      // The two pairs differ in employee and month, so a move changes both fields.
      const a = freshPair(monthOf(round, 5));
      const b = freshPair(monthOf(round, 6));
      const leafIds = await leaves(BATCHES);
      // Half of the allocations start in A and half in B, 0.1 to 0.5 each: both pairs begin over capacity.
      const inA = await seedPair(a, leafIds.slice(0, BATCHES / 2), (i) => 0.1 + (i % 5) / 10);
      const inB = await seedPair(b, leafIds.slice(BATCHES / 2), (i) => 0.1 + (i % 5) / 10);
      await expectRowFollowsStore(a);
      await expectRowFollowsStore(b);

      const moves = [...inA.map((p) => ({ p, to: b })), ...inB.map((p) => ({ p, to: a }))];
      const batches = moves.map(({ p, to }) => {
        const batch = pb.createBatch();
        batch.collection('allocations').update(p.id, { employeeId: to.employeeId, month: to.month });
        return batch;
      });
      await sendAllAtOnce(batches);

      // Everything swapped sides.
      expect(await storedOf(a)).toHaveLength(inB.length);
      expect(await storedOf(b)).toHaveLength(inA.length);
      await expectRowFollowsStore(a);
      await expectRowFollowsStore(b);
    }
  }, 120_000);

  it('deletes: 20 batches of 1-2 deletions, then the rest, keep the row equal to loadOf and remove it with the last', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const pair = freshPair(monthOf(round, 7));
      const leafIds = await leaves(45);
      const planned = await seedPair(pair, leafIds, (i) => 0.1 + (i % 6) / 20);
      await expectRowFollowsStore(pair);

      const sendDeletes = async (runs: Planned[][]) =>
        sendAllAtOnce(
          runs.map((run) => {
            const batch = pb.createBatch();
            for (const p of run) batch.collection('allocations').delete(p.id);
            return batch;
          }),
        );

      // 20 batches delete 30 allocations (1 and 2 alternating); 15 stay and the row must follow them.
      const runs = runsOf(planned, [1, 2]).slice(0, BATCHES);
      const deleted = new Set(runs.flat().map((p) => p.id));
      await sendDeletes(runs);
      expect(await storedOf(pair)).toHaveLength(planned.length - deleted.size);
      await expectRowFollowsStore(pair);
      expect(await rowOf(pair)).not.toBeNull();

      // The rest, one batch each, at once: the last to commit removes the row.
      await sendDeletes(planned.filter((p) => !deleted.has(p.id)).map((p) => [p]));
      expect(await storedOf(pair)).toEqual([]);
      await expectRowFollowsStore(pair);
      expect(await rowOf(pair)).toBeNull();
    }
  }, 120_000);
});
