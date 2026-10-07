import { describe, expect, it, rs } from '@rstest/core';
import { waitFor } from '@testing-library/react';
import { collectionKey, createQueryClient, RepositoryError, type ConnectionStatus } from '../../shared/api';
import { allocation, createFakeRepository } from '../../shared/testing';
import { connectRealtime } from './connectRealtime';

const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);

function setup() {
  const repository = createFakeRepository({ allocations: [effort] });
  const client = createQueryClient();
  client.setQueryData(collectionKey('allocations'), [effort]);
  const invalidate = rs.spyOn(client, 'invalidateQueries');
  const statuses: ConnectionStatus[] = [];
  const connect = () =>
    connectRealtime({
      repository,
      client,
      instance: 'delivery',
      onStatus: (status) => statuses.push(status),
      retryDelay: () => 0,
    });
  return { repository, client, invalidate, statuses, connect };
}

describe('connectRealtime', () => {
  it('goes live on the first connect without refetching: nothing was missed', async () => {
    const { statuses, invalidate, connect } = setup();
    const stop = connect();
    await waitFor(() => {
      expect(statuses).toEqual(['live']);
    });
    expect(invalidate).not.toHaveBeenCalled();
    stop();
  });

  it('retries a first connect that failed, and refetches once it is up: events may have been missed', async () => {
    const { repository, statuses, invalidate, connect } = setup();
    repository.failSubscribe('delivery', new RepositoryError('unavailable', 'delivery'));
    const stop = connect();
    await waitFor(() => {
      expect(statuses).toContain('down');
    });

    repository.failSubscribe('delivery', null);
    await waitFor(() => {
      expect(statuses.at(-1)).toBe('live');
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['delivery'] });
    stop();
  });

  it('refetches after a drop and reconnect, and not after a second connect with no drop', async () => {
    const { repository, statuses, invalidate, connect } = setup();
    const stop = connect();
    await waitFor(() => {
      expect(statuses).toEqual(['live']);
    });
    repository.setConnection('delivery', 'disconnected');
    expect(statuses.at(-1)).toBe('down');
    repository.setConnection('delivery', 'connected');
    expect(statuses.at(-1)).toBe('live');
    expect(invalidate).toHaveBeenCalledTimes(1);
    repository.setConnection('delivery', 'connected');
    expect(invalidate).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops patching and reporting once stopped', async () => {
    const { repository, client, statuses, connect } = setup();
    const stop = connect();
    await waitFor(() => {
      expect(statuses).toEqual(['live']);
    });
    stop();

    repository.emit('allocations', 'update', { ...effort, amount: 0.9 });
    repository.setConnection('delivery', 'disconnected');
    expect(client.getQueryData(collectionKey('allocations'))).toEqual([effort]);
    expect(statuses).toEqual(['live']);
  });

  it('gives up its subscriptions when stopped before it finished connecting', async () => {
    const { repository, client, connect } = setup();
    const stop = connect();
    stop();
    // Let the subscriptions that were already in flight resolve and be released.
    await new Promise((resolve) => setTimeout(resolve, 0));
    repository.emit('allocations', 'update', { ...effort, amount: 0.9 });
    expect(client.getQueryData(collectionKey('allocations'))).toEqual([effort]);
  });
});
