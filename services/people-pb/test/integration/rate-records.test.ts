import { RateRecordRecord } from '@baseline/people-contract';
import { afterEach, describe, expect, it } from '@rstest/core';
import type { RecordSubscription } from 'pocketbase';
import { batchRefusalOf, createClient, eventually, refusalOf } from './setup';

// rate_records is open for writes (T3.5): create, correct and delete work, one rate per
// (employeeId, validFrom), and every change reaches a realtime subscriber. Each test removes what it
// adds, so the seed counts stay what seed.test.ts expects.
const pb = createClient();
const rates = pb.collection('rate_records');

/** Far from the seed's dates (2025-2026), so a new record never clashes with one. */
const FUTURE = '2040-01-01';

const created: string[] = [];
const newId = (): string => {
  const id = `rate-${crypto.randomUUID()}`;
  created.push(id);
  return id;
};

afterEach(async () => {
  for (const id of created.splice(0)) await rates.delete(id).catch(() => undefined);
});

describe('rate_records writes', () => {
  it('creates a rate with a client-generated id, as the record id', async () => {
    const id = newId();
    const record = await rates.create({ id, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70.5 });
    expect(RateRecordRecord.parse(record)).toEqual({ id, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70.5 });
    expect(RateRecordRecord.parse(await rates.getOne(id)).hourlyCost).toBe(70.5);
  });

  it('corrects the cost and the start day of a rate', async () => {
    const id = newId();
    await rates.create({ id, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    await rates.update(id, { hourlyCost: 75 });
    await rates.update(id, { validFrom: '2040-02-01' });
    expect(RateRecordRecord.parse(await rates.getOne(id))).toEqual({
      id,
      employeeId: 'emp-002',
      validFrom: '2040-02-01',
      hourlyCost: 75,
    });
  });

  it('deletes a rate', async () => {
    const id = newId();
    await rates.create({ id, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    await rates.delete(id);
    await expect(rates.getOne(id)).rejects.toMatchObject({ status: 404 });
    expect((await rates.getFullList()).length).toBe(150);
  });

  it('commits a correction made of several writes as one batch', async () => {
    const [first, second] = [newId(), newId()];
    await rates.create({ id: first, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    const batch = pb.createBatch();
    batch.collection('rate_records').delete(first);
    batch.collection('rate_records').create({ id: second, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 72 });
    await batch.send();
    await expect(rates.getOne(first)).rejects.toMatchObject({ status: 404 });
    expect(RateRecordRecord.parse(await rates.getOne(second)).hourlyCost).toBe(72);
  });
});

describe('rate_records rules', () => {
  it('refuses a second rate on the same (employeeId, validFrom) with validation_not_unique on both columns', async () => {
    const first = newId();
    await rates.create({ id: first, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    const second = newId();
    const refusal = await refusalOf(
      rates.create({ id: second, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 71 }),
    );
    expect(refusal).toEqual({
      status: 400,
      fieldCodes: { employeeId: 'validation_not_unique', validFrom: 'validation_not_unique' },
    });
    await expect(rates.getOne(second)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a correction that moves a rate onto a day another rate holds', async () => {
    const id = newId();
    await rates.create({ id, employeeId: 'emp-001', validFrom: FUTURE, hourlyCost: 70 });
    // emp-001 has a seed rate from 2026-03-12.
    const refusal = await refusalOf(rates.update(id, { validFrom: '2026-03-12' }));
    expect(refusal.status).toBe(400);
    expect(refusal.fieldCodes).toEqual({ employeeId: 'validation_not_unique', validFrom: 'validation_not_unique' });
  });

  it('allows the same day for a different employee', async () => {
    const [a, b] = [newId(), newId()];
    await rates.create({ id: a, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
    await rates.create({ id: b, employeeId: 'emp-003', validFrom: FUTURE, hourlyCost: 70 });
    expect((await rates.getFullList({ filter: `validFrom = "${FUTURE}"` })).length).toBe(2);
  });

  it('refuses a duplicate record id with validation_pk_invalid on id', async () => {
    const refusal = await refusalOf(
      rates.create({ id: 'rate-001', employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 }),
    );
    expect(refusal).toEqual({ status: 400, fieldCodes: { id: 'validation_pk_invalid' } });
  });

  it('refuses a rate for an unknown employee, a bad date and a cost at or below zero', async () => {
    const valid = { employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 };
    expect((await refusalOf(rates.create({ ...valid, id: newId(), employeeId: 'emp-999' }))).fieldCodes).toEqual({
      employeeId: 'validation_missing_rel_records',
    });
    expect((await refusalOf(rates.create({ ...valid, id: newId(), validFrom: '2040-1-1' }))).fieldCodes).toEqual({
      validFrom: 'validation_invalid_format',
    });
    // A required number field counts 0 as blank.
    expect((await refusalOf(rates.create({ ...valid, id: newId(), hourlyCost: 0 }))).fieldCodes).toEqual({
      hourlyCost: 'validation_required',
    });
    expect((await refusalOf(rates.create({ ...valid, id: newId(), hourlyCost: -5 }))).fieldCodes).toEqual({
      hourlyCost: 'validation_min_number_constraint',
    });
    expect((await refusalOf(rates.create({ id: newId(), employeeId: 'emp-002' }))).fieldCodes).toEqual({
      validFrom: 'validation_required',
      hourlyCost: 'validation_required',
    });
  });
});

describe('rate_records realtime', () => {
  it('delivers a rate edit to a subscriber on rate_records', async () => {
    const id = newId();
    await rates.create({ id, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });

    const events: RecordSubscription[] = [];
    const unsubscribe = await rates.subscribe('*', (event) => events.push(event));
    try {
      await rates.update(id, { hourlyCost: 88 });
      const event = await eventually(() => events.find((e) => e.action === 'update' && e.record.id === id));
      // The event's record is a full record, and parses like one from a read.
      expect(RateRecordRecord.parse(event.record)).toEqual({
        id,
        employeeId: 'emp-002',
        validFrom: FUTURE,
        hourlyCost: 88,
      });

      await rates.delete(id);
      await eventually(() => events.find((e) => e.action === 'delete' && e.record.id === id));
    } finally {
      await unsubscribe();
    }
  });

  it('delivers one event per record of a committed batch, and none for a rolled-back one', async () => {
    const [a, b] = [newId(), newId()];
    const events: RecordSubscription[] = [];
    const unsubscribe = await rates.subscribe('*', (event) => events.push(event));
    try {
      const failing = pb.createBatch();
      failing.collection('rate_records').create({ id: a, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
      failing.collection('rate_records').create({ id: b, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 71 });
      const refusal = await batchRefusalOf(failing.send());
      expect(refusal.operations['1']?.fieldCodes).toEqual({
        employeeId: 'validation_not_unique',
        validFrom: 'validation_not_unique',
      });

      const committed = pb.createBatch();
      committed.collection('rate_records').create({ id: a, employeeId: 'emp-002', validFrom: FUTURE, hourlyCost: 70 });
      committed.collection('rate_records').create({ id: b, employeeId: 'emp-003', validFrom: FUTURE, hourlyCost: 71 });
      await committed.send();
      await eventually(() => (events.filter((e) => e.action === 'create').length >= 2 ? true : undefined));
      // Only the committed batch's two records were announced: the rolled-back one sent nothing.
      expect(events.map((e) => [e.action, e.record.id])).toEqual([
        ['create', a],
        ['create', b],
      ]);
    } finally {
      await unsubscribe();
    }
  });
});
