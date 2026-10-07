import { EMPTY_CHANGE_SET, type ChangeSet } from '@baseline/delivery-domain';
import { IsoDateTime } from '@baseline/host-contract';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from '@rstest/core';
import { allocation, item } from '../testing';
import { applyRealtimeEvent, patchCollection, readCollection } from './cache';
import { applyOptimistically, rollBack, writeResult } from './changeSetCache';
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

describe('createQueryClient', () => {
  it('never refetches by itself, retries a read once and a write never', () => {
    const defaultOptions = createQueryClient().getDefaultOptions();
    expect(defaultOptions.queries).toMatchObject({ staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 });
    expect(defaultOptions.mutations).toMatchObject({ retry: 0 });
  });
});

describe('applyRealtimeEvent', () => {
  it('adds, replaces and removes by id', () => {
    const client = loaded();
    const added = allocation('alloc-2', 'wbs-2', 'emp-002', '2026-03', 1);
    applyRealtimeEvent(client, 'allocations', { action: 'create', record: added });
    expect(readCollection(client, 'allocations')).toEqual([effort, added]);
    const changed = { ...effort, amount: 0.75 };
    applyRealtimeEvent(client, 'allocations', { action: 'update', record: changed });
    expect(readCollection(client, 'allocations')).toEqual([changed, added]);
    applyRealtimeEvent(client, 'allocations', { action: 'delete', record: added });
    expect(readCollection(client, 'allocations')).toEqual([changed]);
  });

  it('keeps record references for an event that changes nothing', () => {
    const client = loaded();
    const before = readCollection(client, 'allocations');
    applyRealtimeEvent(client, 'allocations', { action: 'update', record: { ...effort } });
    expect(readCollection(client, 'allocations')).toBe(before);
  });

  it('leaves a collection that has not loaded alone', () => {
    const client = createQueryClient();
    applyRealtimeEvent(client, 'allocations', { action: 'create', record: effort });
    expect(readCollection(client, 'allocations')).toBeUndefined();
    patchCollection(client, 'allocations', () => []);
    expect(readCollection(client, 'allocations')).toBeUndefined();
  });
});

describe('applyOptimistically', () => {
  it('applies the change set to the cached tree and allocations', () => {
    const client = loaded();
    applyOptimistically(client, edit(0.75));
    expect(readCollection(client, 'allocations')).toEqual([{ ...effort, amount: 0.75 }]);
  });

  it('does nothing while the tree or the allocations have not loaded', () => {
    const client = createQueryClient();
    client.setQueryData(collectionKey('breakdownItems'), [root, leaf]);
    expect(applyOptimistically(client, edit(0.75)).allocations.size).toBe(0);
    expect(readCollection(client, 'allocations')).toBeUndefined();
  });
});

describe('rollBack', () => {
  it('puts back an edited, a deleted and a created record, and nothing else', () => {
    const client = loaded();
    const extra = item('wbs-3', 'prj-1', 'wbs-1', 'Extra');
    const created = item('wbs-4', 'prj-1', null, 'New');
    const changeSet: ChangeSet = {
      create: { items: [created], allocations: [] },
      update: { items: [], allocations: [{ ...effort, amount: 2 }] },
      delete: { itemIds: [], allocationIds: [] },
    };
    const touched = applyOptimistically(client, changeSet);
    // Another user's record arrives while the write is in flight.
    applyRealtimeEvent(client, 'breakdownItems', { action: 'create', record: extra });

    rollBack(client, touched);

    expect(readCollection(client, 'allocations')).toEqual([effort]);
    expect(readCollection(client, 'breakdownItems')).toEqual([root, leaf, extra]);
  });

  it('restores a deleted record', () => {
    const client = loaded();
    const touched = applyOptimistically(client, {
      ...EMPTY_CHANGE_SET,
      delete: { itemIds: [leaf.id], allocationIds: [effort.id] },
    });
    expect(readCollection(client, 'allocations')).toEqual([]);
    rollBack(client, touched);
    expect(readCollection(client, 'breakdownItems')).toEqual([root, leaf]);
    expect(readCollection(client, 'allocations')).toEqual([effort]);
  });
});

describe('writeResult', () => {
  it('takes the server’s version of what it wrote, editedAt included', () => {
    const client = loaded();
    applyOptimistically(client, edit(0.75));
    const stamped = { ...effort, amount: 0.75, editedAt: IsoDateTime.parse('2026-05-01T10:00:00.000Z') };
    writeResult(client, { items: [], allocations: [stamped] });
    expect(readCollection(client, 'allocations')).toEqual([stamped]);
  });
});
