import { IsoDate } from '@baseline/host-contract';
import { RateRecordId, type Employee, type RateRecord } from '@baseline/people-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { employeeKeys, rateRecordKeys, rateRecordsQuery, useRealtimeStatus, useRepository } from '../shared/api';
import {
  ADAEZE_FIRST_RATE,
  ADAEZE_OKAFOR,
  EMPLOYEES,
  RATE_RECORDS,
  createFakeRepository,
  renderWithApp,
} from '../shared/testing';
import { RealtimeProvider } from './RealtimeProvider';

function Status() {
  return <p>People is {useRealtimeStatus('people')}</p>;
}

/** A reader of the cache that fetches by itself, as a page does: Adaeze's highest rate (the one that starts in 2099). */
function Adaeze() {
  const { data } = useQuery(rateRecordsQuery(useRepository()));
  const top = data?.filter(({ employeeId }) => employeeId === ADAEZE_OKAFOR.id).at(-1);
  return top ? <p>Adaeze Okafor earns {top.hourlyCost} an hour</p> : null;
}

function renderProvider() {
  const app = renderWithApp(
    <RealtimeProvider instance="people">
      <Status />
    </RealtimeProvider>,
    { repository: createFakeRepository() },
  );
  app.queryClient.setQueryData(employeeKeys.all, [...EMPLOYEES]);
  app.queryClient.setQueryData(rateRecordKeys.all, [...RATE_RECORDS]);
  return app;
}

const cachedRates = (app: ReturnType<typeof renderProvider>) =>
  app.queryClient.getQueryData<readonly RateRecord[]>(rateRecordKeys.all);

const newRate: RateRecord = {
  id: RateRecordId.parse('rate-100'),
  employeeId: ADAEZE_OKAFOR.id,
  validFrom: IsoDate.parse('2026-11-01'),
  hourlyCost: 98,
};

describe('RealtimeProvider', () => {
  it('subscribes to People on mount and unsubscribes on unmount', () => {
    const app = renderProvider();
    expect(app.repository.openSubscriptions('people')).toBe(1);
    expect(app.repository.openSubscriptions('delivery')).toBe(0);
    app.unmount();
    expect(app.repository.openSubscriptions('people')).toBe(0);
  });

  it('cancels the instance’s queries on unmount, so nothing is left running', () => {
    const app = renderProvider();
    const cancel = rs.spyOn(app.queryClient, 'cancelQueries');
    app.unmount();
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['people'] });
  });

  it('adds a created record, replaces an updated one and removes a deleted one, by id', () => {
    const app = renderProvider();

    act(() => {
      app.repository.emit({ collection: 'rateRecords', action: 'create', record: newRate });
    });
    expect(cachedRates(app)).toContainEqual(newRate);

    act(() => {
      app.repository.emit({
        collection: 'rateRecords',
        action: 'update',
        record: { ...newRate, hourlyCost: 99 },
      });
    });
    expect(cachedRates(app)?.filter(({ id }) => id === newRate.id)).toEqual([{ ...newRate, hourlyCost: 99 }]);

    act(() => {
      app.repository.emit({ collection: 'rateRecords', action: 'delete', record: newRate });
    });
    expect(cachedRates(app)).toEqual(RATE_RECORDS);
  });

  it('patches employees the same way', () => {
    const app = renderProvider();
    const renamed: Employee = { ...ADAEZE_OKAFOR, name: 'Adaeze Okafor-Reyes' };
    act(() => {
      app.repository.emit({ collection: 'employees', action: 'update', record: renamed });
    });
    expect(
      app.queryClient.getQueryData<readonly Employee[]>(employeeKeys.all)?.find(({ id }) => id === renamed.id),
    ).toEqual(renamed);
  });

  it('keeps the cache as it was for the echo of a record it already has', () => {
    const app = renderProvider();
    const before = cachedRates(app);
    act(() => {
      app.repository.emit({ collection: 'rateRecords', action: 'update', record: { ...ADAEZE_FIRST_RATE } });
    });
    expect(cachedRates(app)).toBe(before);
  });

  it('shows connecting, then live, then down, then live again', () => {
    const app = renderProvider();
    expect(screen.getByText('People is connecting')).toBeInTheDocument();
    act(() => {
      app.repository.connect('people');
    });
    expect(screen.getByText('People is live')).toBeInTheDocument();
    act(() => {
      app.repository.disconnect('people');
    });
    expect(screen.getByText('People is down')).toBeInTheDocument();
    act(() => {
      app.repository.connect('people');
    });
    expect(screen.getByText('People is live')).toBeInTheDocument();
  });

  it('refetches everything after a reconnect, because missed events are not replayed', () => {
    const app = renderProvider();
    act(() => {
      app.repository.connect('people');
    });
    const invalidate = rs.spyOn(app.queryClient, 'invalidateQueries');

    act(() => {
      app.repository.disconnect('people');
      app.repository.connect('people');
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['people'] });
  });

  it('refetches at the first connect too, which closes the startup gap', () => {
    const app = renderProvider();
    const invalidate = rs.spyOn(app.queryClient, 'invalidateQueries');
    act(() => {
      app.repository.connect('people');
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['people'] });
  });

  it('refetches a query whose first fetch is still in flight, so it cannot keep what the server read earlier', async () => {
    const repository = createFakeRepository();
    const release = repository.holdReads();
    renderWithApp(
      <RealtimeProvider instance="people">
        <Adaeze />
      </RealtimeProvider>,
      { repository },
    );
    // The first fetch has read the old rates and waits to answer. An edit lands, then the subscription goes live.
    await rs.waitFor(() => {
      expect(screen.queryByText(/earns/)).not.toBeInTheDocument();
    });
    repository.setRateRecordsSilently(RATE_RECORDS.map((r) => ({ ...r, hourlyCost: r.hourlyCost + 1 })));
    act(() => {
      repository.connect('people');
    });
    release();

    expect(await screen.findByText('Adaeze Okafor earns 121 an hour')).toBeInTheDocument();
    expect(screen.queryByText('Adaeze Okafor earns 120 an hour')).not.toBeInTheDocument();
  });

  it('picks up an edit made between the first load and the subscription going live', async () => {
    const repository = createFakeRepository();
    const app = renderWithApp(
      <RealtimeProvider instance="people">
        <Adaeze />
      </RealtimeProvider>,
      { repository },
    );
    expect(await screen.findByText('Adaeze Okafor earns 120 an hour')).toBeInTheDocument();

    // Someone changes the rate after the page loaded and before the connection is up: no event reaches us.
    repository.setRateRecordsSilently(RATE_RECORDS.map((r) => ({ ...r, hourlyCost: r.hourlyCost + 1 })));
    act(() => {
      repository.connect('people');
    });
    expect(await screen.findByText('Adaeze Okafor earns 121 an hour')).toBeInTheDocument();
    app.unmount();
  });

  it('refetches at the first connect when an earlier attempt failed', () => {
    const app = renderProvider();
    const invalidate = rs.spyOn(app.queryClient, 'invalidateQueries');
    act(() => {
      app.repository.disconnect('people');
    });
    act(() => {
      app.repository.connect('people');
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
