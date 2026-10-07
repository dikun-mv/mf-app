import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, rs } from '@rstest/core';
import { act, screen, waitFor } from '@testing-library/react';
import {
  collectionQuery,
  RepositoryError,
  useConnectionStatus,
  useRepository,
  type CollectionKey,
  type Instance,
} from '../../shared/api';
import { allocation, createFakeRepository, employee, renderWithApp, type FakeRepository } from '../../shared/testing';
import { RealtimeProvider } from './RealtimeProvider';

const effort = allocation('alloc-1', 'wbs-2', 'emp-001', '2026-03', 0.5);

/** Shows a collection from the cache as ids and a field, and the connection status of an instance. */
function Probe({ collection, instance }: { collection: CollectionKey; instance: Instance }) {
  const { data = [] } = useQuery(collectionQuery(useRepository(), collection));
  const status = useConnectionStatus(instance);
  return (
    <>
      <p data-testid="status">{status}</p>
      <ul>
        {data.map((record) => (
          <li key={record.id}>{'amount' in record ? `${record.id}: ${String(record.amount)}` : record.id}</li>
        ))}
      </ul>
    </>
  );
}

function renderProbe(
  repository: FakeRepository,
  collection: CollectionKey = 'allocations',
  instance: Instance = 'delivery',
) {
  return renderWithApp(
    <RealtimeProvider instance={instance}>
      <Probe collection={collection} instance={instance} />
    </RealtimeProvider>,
    { repository },
  );
}

const status = () => screen.getByTestId('status').textContent;

describe('RealtimeProvider patching', () => {
  it('shows a created, updated and deleted record without refetching the collection', async () => {
    const repository = createFakeRepository({ allocations: [effort] });
    const list = rs.spyOn(repository, 'list');
    renderProbe(repository);
    expect(await screen.findByText('alloc-1: 0.5')).toBeInTheDocument();

    const added = allocation('alloc-2', 'wbs-2', 'emp-002', '2026-03', 1);
    act(() => {
      repository.emit('allocations', 'create', added);
    });
    expect(await screen.findByText('alloc-2: 1')).toBeInTheDocument();

    act(() => {
      repository.emit('allocations', 'update', { ...effort, amount: 0.75 });
    });
    expect(await screen.findByText('alloc-1: 0.75')).toBeInTheDocument();
    expect(screen.queryByText('alloc-1: 0.5')).not.toBeInTheDocument();

    act(() => {
      repository.emit('allocations', 'delete', added);
    });
    await waitFor(() => {
      expect(screen.queryByText('alloc-2: 1')).not.toBeInTheDocument();
    });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps a collection of the other instance out of this provider’s subscriptions', async () => {
    const repository = createFakeRepository({ employees: [employee('emp-001', 'Adaeze Okafor')] });
    const subscribe = rs.spyOn(repository, 'subscribe');
    renderProbe(repository, 'employees', 'delivery');
    await screen.findByText('emp-001');
    expect(subscribe.mock.calls.map(([key]) => key).sort()).toEqual(['allocations', 'breakdownItems', 'projects']);
  });
});

describe('RealtimeProvider connection', () => {
  it('goes from connecting to live', async () => {
    const repository = createFakeRepository();
    renderProbe(repository);
    expect(status()).toBe('connecting');
    await waitFor(() => {
      expect(status()).toBe('live');
    });
  });

  it('goes down when the connection drops, and refetches the instance once it is back', async () => {
    const repository = createFakeRepository({ allocations: [effort] });
    const list = rs.spyOn(repository, 'list');
    renderProbe(repository);
    await screen.findByText('alloc-1: 0.5');
    await waitFor(() => {
      expect(status()).toBe('live');
    });
    expect(list).toHaveBeenCalledTimes(1);

    // Missed while down: the server's record changed and no event arrived.
    act(() => {
      repository.setConnection('delivery', 'disconnected');
    });
    expect(status()).toBe('down');
    repository.replace('allocations', [{ ...effort, amount: 0.9 }]);

    act(() => {
      repository.setConnection('delivery', 'connected');
    });
    expect(await screen.findByText('alloc-1: 0.9')).toBeInTheDocument();
    expect(status()).toBe('live');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('reports one instance down without touching the other', async () => {
    const repository = createFakeRepository();
    repository.failSubscribe('people', new RepositoryError('unavailable', 'people'));
    renderWithApp(
      <RealtimeProvider instance="delivery">
        <RealtimeProvider instance="people">
          <Probe collection="employees" instance="people" />
          <DeliveryStatus />
        </RealtimeProvider>
      </RealtimeProvider>,
      { repository },
    );
    await waitFor(() => {
      expect(screen.getByTestId('delivery-status')).toHaveTextContent('live');
    });
    await waitFor(() => {
      expect(status()).toBe('down');
    });
  });
});

function DeliveryStatus() {
  return <p data-testid="delivery-status">{useConnectionStatus('delivery')}</p>;
}
