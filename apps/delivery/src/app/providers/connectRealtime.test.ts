import { QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, rs } from '@rstest/core';
import { waitFor } from '@testing-library/react';
import {
  collectionKey,
  collectionQuery,
  createQueryClient,
  RepositoryError,
  type CollectionKey,
  type ConnectionStatus,
} from '../../shared/api';
import { allocation, createFakeRepository, item } from '../../shared/testing';
import { connectRealtime } from './connectRealtime';

const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);

/** An app with its allocations loaded and shown, and its tree still loading: a page mid-way through its first reads. */
async function setup() {
  const repository = createFakeRepository({ allocations: [effort], breakdownItems: [item('wbs-1', 'prj-1', null)] });
  const client = createQueryClient();
  const list = rs.spyOn(repository, 'list');
  const observe = (key: CollectionKey) =>
    new QueryObserver(client, collectionQuery(repository, key)).subscribe(() => undefined);
  const stopObserving = [observe('allocations')];
  await waitFor(() => {
    expect(client.getQueryData(collectionKey('allocations'))).toEqual([effort]);
  });
  repository.holdReads('breakdownItems');
  stopObserving.push(observe('breakdownItems'));

  const listed = (key: CollectionKey) => list.mock.calls.filter(([called]) => called === key).length;
  const statuses: ConnectionStatus[] = [];
  const connect = () =>
    connectRealtime({
      repository,
      client,
      instance: 'delivery',
      onStatus: (status) => statuses.push(status),
      retryDelay: () => 0,
    });
  return {
    repository,
    client,
    listed,
    statuses,
    connect,
    stopObserving: () => {
      for (const stop of stopObserving) stop();
    },
  };
}

describe('connectRealtime', () => {
  it('refetches everything on the first connect, a read still in flight included: edits made before it was live are in no read', async () => {
    const { repository, listed, statuses, connect, stopObserving } = await setup();
    expect(listed('allocations')).toBe(1);
    // Edited after the read was sent and before the subscription was live: no event will come for it.
    repository.replace('allocations', [{ ...effort, amount: 0.9 }]);

    const stop = connect();
    await waitFor(() => {
      expect(statuses).toEqual(['live']);
    });
    await waitFor(() => {
      expect(listed('allocations')).toBe(2);
    });
    // The tree is still on its first read, which may predate the subscription: it is restarted.
    await waitFor(() => {
      expect(listed('breakdownItems')).toBe(2);
    });
    stop();
    stopObserving();
  });

  it('retries a first connect that failed, and refetches once it is up', async () => {
    const { repository, listed, statuses, connect, stopObserving } = await setup();
    repository.failSubscribe('delivery', new RepositoryError('unavailable', 'delivery'));
    const stop = connect();
    await waitFor(() => {
      expect(statuses).toContain('down');
    });

    repository.failSubscribe('delivery', null);
    await waitFor(() => {
      expect(statuses.at(-1)).toBe('live');
    });
    await waitFor(() => {
      expect(listed('allocations')).toBe(2);
    });
    await waitFor(() => {
      expect(listed('breakdownItems')).toBe(2);
    });
    stop();
    stopObserving();
  });

  it('cancels the retry of a first connect that failed when stopped', async () => {
    const { repository, statuses, stopObserving } = await setup();
    repository.failSubscribe('delivery', new RepositoryError('unavailable', 'delivery'));
    const subscribe = rs.spyOn(repository, 'subscribe');
    const stop = connectRealtime({
      repository,
      client: createQueryClient(),
      instance: 'delivery',
      onStatus: (status) => statuses.push(status),
      retryDelay: () => 50,
    });
    await waitFor(() => {
      expect(statuses).toContain('down');
    });
    const tries = subscribe.mock.calls.length;

    stop();
    repository.failSubscribe('delivery', null);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(subscribe).toHaveBeenCalledTimes(tries);
    expect(statuses).not.toContain('live');
    stopObserving();
  });

  it('refetches again after a drop and reconnect', async () => {
    const { repository, listed, statuses, connect, stopObserving } = await setup();
    const stop = connect();
    await waitFor(() => {
      expect(listed('allocations')).toBe(2);
    });

    repository.setConnection('delivery', 'disconnected');
    expect(statuses.at(-1)).toBe('down');
    repository.setConnection('delivery', 'connected');
    expect(statuses.at(-1)).toBe('live');
    await waitFor(() => {
      expect(listed('allocations')).toBe(3);
    });
    stop();
    stopObserving();
  });

  it('stops patching and reporting once stopped', async () => {
    const { repository, client, statuses, connect, stopObserving } = await setup();
    const stop = connect();
    await waitFor(() => {
      expect(statuses).toEqual(['live']);
    });
    stop();

    repository.emit('allocations', 'update', { ...effort, amount: 0.7 });
    repository.setConnection('delivery', 'disconnected');
    expect(client.getQueryData(collectionKey('allocations'))).not.toContainEqual({ ...effort, amount: 0.7 });
    expect(statuses).toEqual(['live']);
    stopObserving();
  });

  it('gives up its subscriptions when stopped before it finished connecting', async () => {
    const { repository, client, connect, stopObserving } = await setup();
    const before = client.getQueryData(collectionKey('allocations'));
    const stop = connect();
    stop();
    // Let the subscriptions that were already in flight resolve and be released.
    await new Promise((resolve) => setTimeout(resolve, 0));
    repository.emit('allocations', 'update', { ...effort, amount: 0.7 });
    expect(client.getQueryData(collectionKey('allocations'))).toEqual(before);
    stopObserving();
  });
});
