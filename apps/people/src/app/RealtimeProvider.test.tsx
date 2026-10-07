import { IsoDate } from '@baseline/host-contract';
import { RateRecordId, type Employee, type RateRecord } from '@baseline/people-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { act, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  EMPTY_RATE_CHANGE_SET,
  applyChangeSetOptions,
  employeeKeys,
  employeesQuery,
  rateRecordKeys,
  rateRecordsQuery,
  useRealtimeStatus,
  useRepository,
} from '../shared/api';
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

/** A reader of the employees, whose refetch a rate write does not cancel. */
function Employees() {
  const { data } = useQuery(employeesQuery(useRepository()));
  return <p>{data?.length ?? 0} employees</p>;
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

  it('shows connecting, then live, then down, then live again', async () => {
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
    expect(await screen.findByText('People is live')).toBeInTheDocument();
  });

  it('stays down after a reconnect until the queries have been read again, because the cache is not current before', async () => {
    const repository = createFakeRepository();
    renderWithApp(
      <RealtimeProvider instance="people">
        <Status />
        <Adaeze />
      </RealtimeProvider>,
      { repository },
    );
    expect(await screen.findByText('Adaeze Okafor earns 120 an hour')).toBeInTheDocument();
    act(() => {
      repository.connect('people');
    });
    expect(await screen.findByText('People is live')).toBeInTheDocument();
    act(() => {
      repository.disconnect('people');
    });
    expect(screen.getByText('People is down')).toBeInTheDocument();

    const release = repository.holdReads();
    act(() => {
      repository.connect('people');
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('People is down')).toBeInTheDocument();

    release();
    expect(await screen.findByText('People is live')).toBeInTheDocument();
  });

  it('does not go live on a refetch that started before a drop, when the reconnect waits for a write', async () => {
    const repository = createFakeRepository();
    const app = renderWithApp(
      <RealtimeProvider instance="people">
        <Status />
        <Employees />
        <Adaeze />
      </RealtimeProvider>,
      { repository },
    );
    expect(await screen.findByText('Adaeze Okafor earns 120 an hour')).toBeInTheDocument();

    // The first connect starts a refetch whose read is slow.
    const releaseReads = repository.holdReads();
    act(() => {
      repository.connect('people');
    });
    // The connection drops and returns while a rate write is in flight, so the new refetch has to wait for it.
    act(() => {
      repository.disconnect('people');
    });
    const releaseWrites = repository.holdWrites();
    const write = app.queryClient
      .getMutationCache()
      .build(app.queryClient, applyChangeSetOptions(app.queryClient, repository))
      .execute({ ...EMPTY_RATE_CHANGE_SET, create: [newRate] });
    await rs.waitFor(() => {
      expect(cachedRates(app)).toContainEqual(newRate);
    });
    act(() => {
      repository.connect('people');
    });

    // The first refetch answers now, from before the outage: that must not say the cache is current.
    releaseReads();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('People is down')).toBeInTheDocument();

    releaseWrites();
    await write;
    expect(await screen.findByText('People is live')).toBeInTheDocument();
  });

  describe('a reconnect read that did not bring new data', () => {
    /** Reconnects the instance at the moment it matters: the rates are loaded, the connection has dropped. */
    async function droppedConnection() {
      const repository = createFakeRepository();
      const app = renderWithApp(
        <RealtimeProvider instance="people">
          <Status />
          <Adaeze />
        </RealtimeProvider>,
        { repository },
      );
      expect(await screen.findByText('Adaeze Okafor earns 120 an hour')).toBeInTheDocument();
      act(() => {
        repository.connect('people');
      });
      expect(await screen.findByText('People is live')).toBeInTheDocument();
      act(() => {
        repository.disconnect('people');
      });
      return { repository, app };
    }
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    const bumpRates = (repository: ReturnType<typeof createFakeRepository>) => {
      repository.setRateRecordsSilently(RATE_RECORDS.map((r) => ({ ...r, hourlyCost: r.hourlyCost + 1 })));
    };

    it('stays down when a write cancelled the read, and goes live once the read it owed has run', async () => {
      const { repository, app } = await droppedConnection();
      const release = repository.holdReads();
      act(() => {
        repository.connect('people');
      });
      // A write starts while the reconnect read is running: its first step cancels that read.
      const write = app.queryClient
        .getMutationCache()
        .build(app.queryClient, applyChangeSetOptions(app.queryClient, repository))
        .execute({ ...EMPTY_RATE_CHANGE_SET, create: [newRate] });
      await settle();
      expect(screen.getByText('People is down')).toBeInTheDocument();

      // The write has committed; the read it owes then sees the server as it is now.
      bumpRates(repository);
      release();
      await write;
      expect(await screen.findByText('People is live')).toBeInTheDocument();
      expect(await screen.findByText('Adaeze Okafor earns 121 an hour')).toBeInTheDocument();
    });

    it('does not count a first fetch that was already running at the reconnect, only the read that follows it', async () => {
      const repository = createFakeRepository();
      // The page's first fetch is slow: it is still running across a drop and a reconnect.
      const releaseFirst = repository.holdReads();
      renderWithApp(
        <RealtimeProvider instance="people">
          <Status />
          <Adaeze />
        </RealtimeProvider>,
        { repository },
      );
      act(() => {
        repository.connect('people');
        repository.disconnect('people');
        repository.connect('people');
      });
      expect(screen.getByText('People is down')).toBeInTheDocument();

      // The first fetch ends, and the read that follows it is slow too.
      releaseFirst();
      const releaseFollowUp = repository.holdReads();
      expect(await screen.findByText('Adaeze Okafor earns 120 an hour')).toBeInTheDocument();
      await settle();
      expect(screen.getByText('People is down')).toBeInTheDocument();

      releaseFollowUp();
      expect(await screen.findByText('People is live')).toBeInTheDocument();
    });

    it('stays down when the read failed, and goes live at the next reconnect that succeeds', async () => {
      const { repository } = await droppedConnection();
      repository.failReads(new ApiError('unavailable', 'people'));
      act(() => {
        repository.connect('people');
      });
      await settle();
      expect(screen.getByText('People is down')).toBeInTheDocument();

      repository.failReads(null);
      bumpRates(repository);
      act(() => {
        repository.disconnect('people');
        repository.connect('people');
      });
      expect(await screen.findByText('People is live')).toBeInTheDocument();
      expect(await screen.findByText('Adaeze Okafor earns 121 an hour')).toBeInTheDocument();
    });
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

  describe('while a rate write is in flight', () => {
    /** Starts a write the fake holds, and waits until its optimistic change is in the cache. */
    async function startWrite(app: ReturnType<typeof renderProvider>) {
      const release = app.repository.holdWrites();
      const write = app.queryClient
        .getMutationCache()
        .build(app.queryClient, applyChangeSetOptions(app.queryClient, app.repository))
        .execute({ ...EMPTY_RATE_CHANGE_SET, create: [newRate] });
      await rs.waitFor(() => {
        expect(cachedRates(app)).toContainEqual(newRate);
      });
      return { release, write };
    }

    it('waits to refetch at connect until the write has settled, so older server data cannot replace it', async () => {
      const app = renderProvider();
      const { release, write } = await startWrite(app);
      const invalidate = rs.spyOn(app.queryClient, 'invalidateQueries');

      act(() => {
        app.repository.connect('people');
      });
      expect(screen.getByText('People is live')).toBeInTheDocument();
      expect(invalidate).not.toHaveBeenCalled();

      release();
      await write;
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['people'] });
    });

    it('refetches once for several connects', async () => {
      const app = renderProvider();
      const { release, write } = await startWrite(app);
      const invalidate = rs.spyOn(app.queryClient, 'invalidateQueries');

      act(() => {
        app.repository.connect('people');
        app.repository.disconnect('people');
        app.repository.connect('people');
      });
      release();
      await write;
      expect(invalidate).toHaveBeenCalledTimes(1);
    });

    it('does not refetch after it was unmounted', async () => {
      const app = renderProvider();
      const { release, write } = await startWrite(app);
      const invalidate = rs.spyOn(app.queryClient, 'invalidateQueries');

      act(() => {
        app.repository.connect('people');
      });
      app.unmount();
      release();
      await write;
      expect(invalidate).not.toHaveBeenCalled();
    });
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
