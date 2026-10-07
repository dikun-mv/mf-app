import { IsoDate } from '@baseline/host-contract';
import { EmployeeId, RateRecordId, type RateRecord } from '@baseline/people-contract';
import { describe, expect, it, rs } from '@rstest/core';
import { ApiError } from './errors';
import { createQueryClient } from './queryClient';
import { rateRecordKeys } from './queryKeys';
import { EMPTY_RATE_CHANGE_SET, type PeopleRepository, type RateChangeSet } from './repository';
import { applyChangeSetOptions } from './useApplyChangeSet';

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
