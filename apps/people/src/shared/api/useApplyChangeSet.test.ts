import { IsoDate } from '@baseline/host-contract';
import { EmployeeId, RateRecordId, type RateRecord } from '@baseline/people-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { ApiError } from './errors';
import { createQueryClient } from './queryClient';
import { rateRecordKeys } from './queryKeys';
import { EMPTY_RATE_CHANGE_SET, type PeopleRepository, type RateChangeSet } from './repository';
import { patchCollection } from './patch';
import { applyChangeSetOptions } from './useApplyChangeSet';
import { afterWrites } from './writes';

const rate = (n: number, validFrom: string, hourlyCost: number): RateRecord => ({
  id: RateRecordId.parse(`rate-${String(n)}`),
  employeeId: EmployeeId.parse('emp-001'),
  validFrom: IsoDate.parse(validFrom),
  hourlyCost,
});

/** A promise the test settles when it chooses. */
function deferred() {
  let resolve: (records: RateRecord[]) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<RateRecord[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const old = rate(1, '2025-01-01', 80);
const current = rate(2, '2026-03-12', 95);

/** A repository that only writes: the answer is the test's. */
function repositoryWriting(write: (changes: RateChangeSet) => Promise<RateRecord[]>) {
  const applyRateChanges = rs.fn(write);
  const repository: PeopleRepository = {
    listEmployees: () => Promise.resolve([]),
    listRateRecords: () => Promise.resolve([]),
    listEmployeeMonthLoads: () => Promise.resolve([]),
    applyRateChanges,
    subscribe: () => () => undefined,
  };
  return { repository, applyRateChanges };
}

function setup(write: (changes: RateChangeSet) => Promise<RateRecord[]>) {
  const client = createQueryClient({ retry: false });
  client.setQueryData(rateRecordKeys.all, [old, current]);
  const { repository, applyRateChanges } = repositoryWriting(write);
  const run = (changes: RateChangeSet) =>
    client.getMutationCache().build(client, applyChangeSetOptions(client, repository)).execute(changes);
  return { client, applyRateChanges, run, cached: () => client.getQueryData<RateRecord[]>(rateRecordKeys.all) };
}

describe('useApplyChangeSet', () => {
  it('shows the change at once, before the server has answered', async () => {
    const answer = deferred();
    const { run, cached } = setup(() => answer.promise);
    const added = rate(3, '2026-11-01', 98);

    const pending = run({ ...EMPTY_RATE_CHANGE_SET, create: [added] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, current, added]);
    });

    answer.resolve([added]);
    await pending;
    expect(cached()).toEqual([old, current, added]);
  });

  it("writes the server's records into the cache, so it is right while realtime is down", async () => {
    const stored = rate(2, '2026-03-12', 95.01);
    const { run, cached } = setup(() => Promise.resolve([stored]));
    await run({ ...EMPTY_RATE_CHANGE_SET, update: [rate(2, '2026-03-12', 95)] });
    expect(cached()).toEqual([old, stored]);
  });

  it('applies a delete and an update in one change set', async () => {
    const corrected = rate(2, '2026-03-12', 97);
    const { run, cached } = setup(() => Promise.resolve([corrected]));
    await run({ create: [], update: [corrected], delete: [old.id] });
    expect(cached()).toEqual([corrected]);
  });

  it('sends the whole change set to the repository once', async () => {
    const { run, applyRateChanges } = setup(() => Promise.resolve([]));
    const changes = { ...EMPTY_RATE_CHANGE_SET, delete: [old.id] };
    await run(changes);
    expect(applyRateChanges).toHaveBeenCalledTimes(1);
    expect(applyRateChanges).toHaveBeenCalledWith(changes);
  });

  it('puts the touched records back when the write fails, and refetches the collection', async () => {
    const { client, run, cached } = setup(() => Promise.reject(new ApiError('unavailable', 'people')));
    const refetch = rs.spyOn(client, 'invalidateQueries');
    const added = rate(3, '2026-11-01', 98);

    await expect(
      run({ create: [added], update: [rate(2, '2026-03-12', 120)], delete: [old.id] }),
    ).rejects.toMatchObject({ code: 'unavailable' });

    expect(cached()).toHaveLength(2);
    expect(cached()).toEqual(expect.arrayContaining([old, current]));
    expect(refetch).toHaveBeenCalledWith({ queryKey: rateRecordKeys.all });
  });

  it('keeps a record that arrived by realtime while the write was in flight', async () => {
    const answer = deferred();
    const { run, client, cached } = setup(() => answer.promise);
    const pending = run({ ...EMPTY_RATE_CHANGE_SET, delete: [old.id] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([current]);
    });

    const elsewhere = rate(9, '2027-01-01', 101);
    client.setQueryData(rateRecordKeys.all, [current, elsewhere]);
    answer.reject(new ApiError('server', 'people'));
    await expect(pending).rejects.toBeInstanceOf(ApiError);

    expect(cached()).toEqual(expect.arrayContaining([old, current, elsewhere]));
    expect(cached()).toHaveLength(3);
  });

  it('runs writes one at a time, in order, because they share a scope', async () => {
    const first = deferred();
    const writes: number[] = [];
    const { run } = setup((changes) => {
      writes.push(changes.create.length);
      return writes.length === 1 ? first.promise : Promise.resolve([]);
    });

    const one = run({ ...EMPTY_RATE_CHANGE_SET, create: [rate(3, '2026-11-01', 98)] });
    const two = run({ ...EMPTY_RATE_CHANGE_SET, create: [rate(4, '2026-12-01', 99), rate(5, '2027-01-01', 99)] });
    await rs.waitFor(() => {
      expect(writes).toEqual([1]);
    });
    first.resolve([]);
    await Promise.all([one, two]);
    expect(writes).toEqual([1, 2]);
  });
});

describe('useApplyChangeSet with writes queued behind each other', () => {
  /** Every write waits for the test to answer it; `answers[n]` exists once write n has reached the server. */
  function queued() {
    const answers: ReturnType<typeof deferred>[] = [];
    const app = setup(() => {
      const answer = deferred();
      answers.push(answer);
      return answer.promise;
    });
    const refetch = rs.spyOn(app.client, 'invalidateQueries');
    const reached = async (n: number) => {
      await rs.waitFor(() => {
        expect(answers.length).toBeGreaterThan(n);
      });
      return answers[n] ?? deferred();
    };
    return { ...app, refetch, reached };
  }

  const x = rate(3, '2026-11-01', 98);
  const y = rate(4, '2026-12-01', 99);

  it('keeps the queued write’s change when the first fails, and refetches only after the last settles', async () => {
    const { run, cached, refetch, reached } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, create: [x] });
    const b = run({ ...EMPTY_RATE_CHANGE_SET, create: [y] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, current, x, y]);
    });

    (await reached(0)).reject(new ApiError('unavailable', 'people'));
    await expect(a).rejects.toBeInstanceOf(ApiError);
    // A is undone, B's optimistic change is still shown, and nothing has replaced it with older server data.
    expect(cached()).toEqual([old, current, y]);
    expect(refetch).not.toHaveBeenCalled();

    (await reached(1)).resolve([y]);
    await b;
    expect(cached()).toEqual([old, current, y]);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith({ queryKey: rateRecordKeys.all });
  });

  it('refetches once, after both, when the queued write fails too', async () => {
    const { run, cached, refetch, reached } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, create: [x] });
    const b = run({ ...EMPTY_RATE_CHANGE_SET, create: [y] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, current, x, y]);
    });

    (await reached(0)).reject(new ApiError('unavailable', 'people'));
    await expect(a).rejects.toBeInstanceOf(ApiError);
    expect(refetch).not.toHaveBeenCalled();

    (await reached(1)).reject(new ApiError('unavailable', 'people'));
    await expect(b).rejects.toBeInstanceOf(ApiError);
    expect(cached()).toEqual([old, current]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not put back a record that a write still in flight has changed', async () => {
    const { run, cached, reached } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, update: [{ ...current, hourlyCost: 120 }] });
    const b = run({ ...EMPTY_RATE_CHANGE_SET, delete: [current.id] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old]);
    });

    (await reached(0)).reject(new ApiError('server', 'people'));
    await expect(a).rejects.toBeInstanceOf(ApiError);
    expect(cached()).toEqual([old]);

    (await reached(1)).resolve([]);
    await b;
    expect(cached()).toEqual([old]);
  });

  it('removes a deleted record again when a refetch brought it back before the write was confirmed', async () => {
    const { run, client, cached, reached } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, delete: [old.id] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([current]);
    });

    // Something refetched the collection while the delete was on its way: the server still had the record.
    client.setQueryData(rateRecordKeys.all, [old, current]);
    (await reached(0)).resolve([]);
    await a;
    expect(cached()).toEqual([current]);
  });

  it('still refetches after a failed write once an earlier write threw in onMutate', async () => {
    const { run, cached, refetch, reached } = queued();
    // Updating a record that is not cached makes the change set refuse to apply: `onMutate` throws.
    await expect(run({ ...EMPTY_RATE_CHANGE_SET, update: [x] })).rejects.toThrow(/rate-3/);
    expect(refetch).toHaveBeenCalledTimes(1);

    const next = run({ ...EMPTY_RATE_CHANGE_SET, create: [y] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, current, y]);
    });
    (await reached(0)).reject(new ApiError('unavailable', 'people'));
    await expect(next).rejects.toBeInstanceOf(ApiError);
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});

describe('useApplyChangeSet and realtime events for a record a write has changed', () => {
  function queued() {
    const answers: ReturnType<typeof deferred>[] = [];
    const app = setup(() => {
      const answer = deferred();
      answers.push(answer);
      return answer.promise;
    });
    const reached = async (n: number) => {
      await rs.waitFor(() => {
        expect(answers.length).toBeGreaterThan(n);
      });
      return answers[n] ?? deferred();
    };
    const emit = (action: 'create' | 'update' | 'delete', record: RateRecord) => {
      patchCollection(app.client, { collection: 'rateRecords', action, record });
    };
    return { ...app, reached, emit };
  }

  const first = { ...current, hourlyCost: 120 };
  const second = { ...current, hourlyCost: 130 };

  it('keeps the later write’s value when the echo of an earlier one arrives', async () => {
    const { run, cached, reached, emit } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, update: [first] });
    const b = run({ ...EMPTY_RATE_CHANGE_SET, update: [second] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, second]);
    });

    (await reached(0)).resolve([first]);
    await a;
    emit('update', first);
    expect(cached()).toEqual([old, second]);

    (await reached(1)).resolve([second]);
    await b;
    expect(cached()).toEqual([old, second]);
  });

  it('shows the later write’s value when the earlier one is confirmed, and restores the confirmed one if it fails', async () => {
    const { run, cached, reached } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, update: [first] });
    const b = run({ ...EMPTY_RATE_CHANGE_SET, update: [second] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, second]);
    });

    (await reached(0)).resolve([first]);
    await a;
    expect(cached()).toEqual([old, second]);

    (await reached(1)).reject(new ApiError('unavailable', 'people'));
    await expect(b).rejects.toBeInstanceOf(ApiError);
    expect(cached()).toEqual([old, first]);
  });

  it('puts back what the server last said, not what was cached before, when the later write fails', async () => {
    const { run, cached, reached, emit } = queued();
    const a = run({ ...EMPTY_RATE_CHANGE_SET, update: [first] });
    const b = run({ ...EMPTY_RATE_CHANGE_SET, update: [second] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, second]);
    });

    (await reached(0)).resolve([first]);
    await a;
    // Another tab sets the same rate to 125; the cache still shows our pending 130.
    const elsewhere = { ...current, hourlyCost: 125 };
    emit('update', elsewhere);
    expect(cached()).toEqual([old, second]);

    (await reached(1)).reject(new ApiError('unavailable', 'people'));
    await expect(b).rejects.toBeInstanceOf(ApiError);
    expect(cached()).toEqual([old, elsewhere]);
  });

  it('keeps a record removed by the write removed when an older update arrives, and restores it as it is on failure', async () => {
    const { run, cached, reached, emit } = queued();
    const removal = run({ ...EMPTY_RATE_CHANGE_SET, delete: [current.id] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old]);
    });

    emit('update', first);
    expect(cached()).toEqual([old]);

    (await reached(0)).reject(new ApiError('unavailable', 'people'));
    await expect(removal).rejects.toBeInstanceOf(ApiError);
    expect(cached()).toEqual([old, first]);
  });

  it('reads the collection again when another user’s edit arrived before the write’s result, so a stale result does not stay', async () => {
    const { client, run, reached, emit } = queued();
    const refetch = rs.spyOn(client, 'invalidateQueries');
    const write = run({ ...EMPTY_RATE_CHANGE_SET, update: [first] });
    await reached(0);

    // The write committed, then someone else edited the rate; both events beat the HTTP response.
    emit('update', first);
    emit('update', { ...current, hourlyCost: 125 });
    expect(refetch).not.toHaveBeenCalled();

    (await reached(0)).resolve([first]);
    await write;
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith({ queryKey: rateRecordKeys.all });
  });

  it('owes no read for the echo of the write’s own change', async () => {
    const { client, run, reached, emit } = queued();
    const refetch = rs.spyOn(client, 'invalidateQueries');
    const write = run({ ...EMPTY_RATE_CHANGE_SET, update: [first] });
    await reached(0);

    emit('update', first);
    (await reached(0)).resolve([first]);
    await write;
    expect(refetch).not.toHaveBeenCalled();
  });

  it('applies an event for a record no write has changed as usual', async () => {
    const { run, cached, reached, emit } = queued();
    const pending = run({ ...EMPTY_RATE_CHANGE_SET, update: [first] });
    await rs.waitFor(() => {
      expect(cached()).toEqual([old, first]);
    });

    const elsewhere = { ...old, hourlyCost: 82 };
    emit('update', elsewhere);
    expect(cached()).toEqual([elsewhere, first]);

    (await reached(0)).resolve([first]);
    await pending;
  });
});

describe('afterWrites', () => {
  it('runs at once when no write is in flight', () => {
    const { client } = setup(() => Promise.resolve([]));
    const run = rs.fn();
    expect(afterWrites(client, run)).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for the last write in flight to settle, whichever way', async () => {
    const answers: ReturnType<typeof deferred>[] = [];
    const { client, run: write } = setup(() => {
      const answer = deferred();
      answers.push(answer);
      return answer.promise;
    });
    const a = write({ ...EMPTY_RATE_CHANGE_SET, delete: [old.id] });
    const b = write({ ...EMPTY_RATE_CHANGE_SET, delete: [current.id] });
    await rs.waitFor(() => {
      expect(answers).toHaveLength(1);
    });

    const run = rs.fn();
    expect(afterWrites(client, run)).toBeTypeOf('function');
    answers[0]?.resolve([]);
    await a;
    expect(run).not.toHaveBeenCalled();

    await rs.waitFor(() => {
      expect(answers).toHaveLength(2);
    });
    answers[1]?.reject(new ApiError('unavailable', 'people'));
    await expect(b).rejects.toBeInstanceOf(ApiError);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run once the wait is dropped', async () => {
    const answer = deferred();
    const { client, run: write } = setup(() => answer.promise);
    const pending = write({ ...EMPTY_RATE_CHANGE_SET, delete: [old.id] });
    await rs.waitFor(() => {
      expect(client.getQueryData<RateRecord[]>(rateRecordKeys.all)).toEqual([current]);
    });

    const run = rs.fn();
    afterWrites(client, run)?.();
    answer.resolve([]);
    await pending;
    expect(run).not.toHaveBeenCalled();
  });
});
