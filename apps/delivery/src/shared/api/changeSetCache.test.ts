import { EMPTY_CHANGE_SET, type ChangeSet } from '@baseline/delivery-domain';
import { IsoDateTime } from '@baseline/host-contract';
import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from '@rstest/core';
import { allocation, item } from '../testing';
import { applyRealtimeEvent, readCollection } from './cache';
import { applyOptimistically, beginWrite, rollBack, takeRefetch, writeResult, type Write } from './changeSetCache';
import { collectionKey, createQueryClient } from './queries';

const root = item('wbs-1', 'prj-1', null, 'Root');
const leaf = item('wbs-2', 'prj-1', 'wbs-1', 'Leaf');
const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);

function loaded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(collectionKey('breakdownItems'), [root, leaf]);
  client.setQueryData(collectionKey('allocations'), [effort]);
  return client;
}

const edit = (amount: number): ChangeSet => ({
  ...EMPTY_CHANGE_SET,
  update: { items: [], allocations: [{ ...effort, amount }] },
});

const removing = (id: typeof leaf.id): ChangeSet => ({
  ...EMPTY_CHANGE_SET,
  delete: { itemIds: [id], allocationIds: [] },
});

const stamp = IsoDateTime.parse('2026-05-01T10:00:00.000Z');
const answer = (amount: number) => ({ items: [], allocations: [{ ...effort, amount, editedAt: stamp }] });

/** Makes a write the way the hook does: registered first, then applied. */
function make(client: QueryClient, changeSet: ChangeSet): Write {
  const write = beginWrite(client);
  applyOptimistically(client, write, changeSet);
  return write;
}

describe('applyOptimistically', () => {
  it('applies the change set to the cached tree and allocations', () => {
    const client = loaded();
    make(client, edit(0.75));
    expect(readCollection(client, 'allocations')).toEqual([{ ...effort, amount: 0.75 }]);
  });

  it('does nothing while the tree or the allocations have not loaded', () => {
    const client = createQueryClient();
    client.setQueryData(collectionKey('breakdownItems'), [root, leaf]);
    const write = make(client, edit(0.75));
    expect(write.allocations.size).toBe(0);
    expect(readCollection(client, 'allocations')).toBeUndefined();
  });
});

describe('rollBack', () => {
  it('puts back an edited and a created record, and nothing else', () => {
    const client = loaded();
    const extra = item('wbs-3', 'prj-1', 'wbs-1', 'Extra');
    const created = item('wbs-4', 'prj-1', null, 'New');
    const write = make(client, {
      create: { items: [created], allocations: [] },
      update: { items: [], allocations: [{ ...effort, amount: 2 }] },
      delete: { itemIds: [], allocationIds: [] },
    });
    // Another user's record arrives while the write is in flight.
    applyRealtimeEvent(client, 'breakdownItems', { action: 'create', record: extra });

    rollBack(client, write);

    expect(readCollection(client, 'allocations')).toEqual([effort]);
    expect(readCollection(client, 'breakdownItems')).toEqual([root, leaf, extra]);
  });

  it('restores a deleted record', () => {
    const client = loaded();
    const write = make(client, { ...EMPTY_CHANGE_SET, delete: { itemIds: [leaf.id], allocationIds: [effort.id] } });
    expect(readCollection(client, 'allocations')).toEqual([]);
    rollBack(client, write);
    expect(readCollection(client, 'breakdownItems')).toEqual([root, leaf]);
    expect(readCollection(client, 'allocations')).toEqual([effort]);
  });
});

describe('writeResult', () => {
  it('takes the server’s version of what it wrote, editedAt included', () => {
    const client = loaded();
    const change = edit(0.75);
    writeResult(client, make(client, change), change, answer(0.75));
    expect(readCollection(client, 'allocations')).toEqual([{ ...effort, amount: 0.75, editedAt: stamp }]);
  });

  it('removes what the change set deleted, even when it had come back in the meantime', () => {
    const client = loaded();
    const change = removing(leaf.id);
    const write = make(client, change);
    // A refetch or a stale event brought the record back while the write was in flight.
    applyRealtimeEvent(client, 'breakdownItems', { action: 'create', record: leaf });
    writeResult(client, write, change, { items: [], allocations: [] });
    expect(readCollection(client, 'breakdownItems')).toEqual([root]);
  });
});

describe('several pending writes', () => {
  // A edits an allocation, B deletes an item while A is in flight, and A fails.
  function aFailsThenB(laterFails: boolean): QueryClient {
    const client = loaded();
    const a = make(client, edit(0.75));
    const b = make(client, removing(leaf.id));
    rollBack(client, a);
    // A is undone, B's deletion is still shown, and no refetch is due while B is pending.
    expect(readCollection(client, 'allocations')).toEqual([effort]);
    expect(readCollection(client, 'breakdownItems')).toEqual([root]);
    expect(takeRefetch(client)).toBe(false);

    if (laterFails) rollBack(client, b);
    else writeResult(client, b, removing(leaf.id), { items: [], allocations: [] });
    return client;
  }

  it('keeps the later write when the earlier one fails and the later one succeeds, then refetches once', () => {
    const client = aFailsThenB(false);
    expect(readCollection(client, 'breakdownItems')).toEqual([root]);
    expect(readCollection(client, 'allocations')).toEqual([effort]);
    expect(takeRefetch(client)).toBe(true);
    expect(takeRefetch(client)).toBe(false);
  });

  it('undoes only the later write’s records when both fail, never the earlier one’s optimistic value', () => {
    const client = aFailsThenB(true);
    expect(readCollection(client, 'breakdownItems')).toEqual([root, leaf]);
    expect(readCollection(client, 'allocations')).toEqual([effort]);
    expect(takeRefetch(client)).toBe(true);
  });

  it('goes back to the server’s value, not the failed write’s, when both wrote the same record', () => {
    const client = loaded();
    const a = make(client, edit(0.75));
    const b = make(client, edit(0.9));
    rollBack(client, a);
    expect(readCollection(client, 'allocations')).toEqual([{ ...effort, amount: 0.9 }]);
    rollBack(client, b);
    expect(readCollection(client, 'allocations')).toEqual([effort]);
  });

  it('does not let an earlier success overwrite what a later pending write shows', () => {
    const client = loaded();
    const first = edit(0.75);
    const a = make(client, first);
    const b = make(client, edit(0.9));
    writeResult(client, a, first, answer(0.75));
    expect(readCollection(client, 'allocations')).toEqual([{ ...effort, amount: 0.9 }]);
    // If B now fails, it goes back to what A wrote.
    rollBack(client, b);
    expect(readCollection(client, 'allocations')).toEqual([{ ...effort, amount: 0.75, editedAt: stamp }]);
  });

  it('owes no refetch when every write succeeds', () => {
    const client = loaded();
    const change = edit(0.75);
    writeResult(client, make(client, change), change, answer(0.75));
    expect(takeRefetch(client)).toBe(false);
  });
});
