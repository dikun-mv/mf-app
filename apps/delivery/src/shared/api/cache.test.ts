import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from '@rstest/core';
import { allocation } from '../testing';
import { applyRealtimeEvent, patchCollection, readCollection } from './cache';
import { collectionKey, createQueryClient } from './queries';

const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);

function loaded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(collectionKey('allocations'), [effort]);
  return client;
}

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
