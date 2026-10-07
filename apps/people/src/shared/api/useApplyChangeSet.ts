import type { RateRecord, RateRecordId } from '@baseline/people-contract';
import { useMutation, useQueryClient, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useRepository } from './context';
import { patchList } from './patch';
import { rateRecordKeys } from './queryKeys';
import { applyRateChangeSet, touchedRateIds } from './rateChangeSet';
import type { PeopleRepository, RateChangeSet } from './repository';
import { absorbServerRecord, finishWrite, touchedByOthers, writesFor } from './writes';

/**
 * What `onMutate` keeps to undo an optimistic write: each touched record as it was, or `undefined` if it was
 * new, and a token that names this write among the ones in flight. The map is the write's own entry in the
 * registry (`writes.ts`), which keeps it current while the write is on its way.
 */
interface Rollback {
  readonly previous: Map<RateRecordId, RateRecord | undefined>;
  readonly token: symbol;
}

/** Replaces records by id and appends the unknown ones. The same array comes back when nothing differs. */
const upsertAll = (list: readonly RateRecord[], records: readonly RateRecord[]): readonly RateRecord[] =>
  records.reduce((acc, record) => patchList(acc, 'update', record, ({ id }) => id), list);

/**
 * The options of People's one write (D26). `onMutate` applies the change set to the cached rate records and
 * keeps the touched ones; `onSuccess` writes the records the batch returned into the cache and drops the ones
 * it deleted, so the cache is right even while realtime is down (the realtime echo then changes nothing) and
 * even if a refetch brought a deleted record back; `onError` puts the touched records back, not the whole
 * list, so events that arrived meanwhile survive, and leaves alone the records another write still in flight
 * has changed. Writes share one scope, so they reach the server one at a time, in order.
 *
 * A failed write marks the collection for a refetch, but the refetch waits until no write is in flight:
 * refetching earlier would replace the optimistic changes of the writes queued behind it with the server's
 * older data. The last write to settle, whichever way, does it.
 */
export function applyChangeSetOptions(
  queryClient: QueryClient,
  repository: PeopleRepository,
): UseMutationOptions<RateRecord[], Error, RateChangeSet, Rollback> {
  return {
    mutationKey: ['people', 'apply-change-set'],
    scope: { id: 'people-writes' },
    retry: 0,
    mutationFn: (changes) => repository.applyRateChanges(changes),
    onMutate: async (changes) => {
      const token = Symbol('write');
      const writes = writesFor(queryClient);
      const touched = touchedRateIds(changes);
      // `previous` stays empty until the cache has been read, so a realtime event that lands before then
      // goes into the cache and is part of what is read.
      const previous = new Map<RateRecordId, RateRecord | undefined>();
      writes.inFlight.set(token, { touched: new Set(touched), previous });
      try {
        await queryClient.cancelQueries({ queryKey: rateRecordKeys.all });
        const cached = queryClient.getQueryData<readonly RateRecord[]>(rateRecordKeys.all);
        for (const id of touched)
          previous.set(
            id,
            cached?.find((record) => record.id === id),
          );
        // Nothing cached means nothing to show yet; the write still goes to the server.
        if (cached) queryClient.setQueryData(rateRecordKeys.all, applyRateChangeSet(cached, changes));
        return { previous, token };
      } catch (error) {
        // `onSettled` gets no context when `onMutate` throws, so this write must leave the set here, or no
        // failed write would ever refetch again.
        finishWrite(writes, token);
        throw error;
      }
    },
    onSuccess: (records, changes, rollback) => {
      // A record a later write in flight has changed keeps that write's value, as for a realtime event: what
      // this write saved becomes what the later one's failure restores.
      const later = touchedByOthers(writesFor(queryClient), rollback.token);
      for (const record of records) if (later.has(record.id)) absorbServerRecord(queryClient, 'update', record);
      const deleted = new Set<string>(changes.delete.filter((id) => !later.has(id)));
      const saved = records.filter(({ id }) => !later.has(id));
      queryClient.setQueryData<readonly RateRecord[]>(
        rateRecordKeys.all,
        (old) =>
          old &&
          upsertAll(
            old.filter(({ id }) => !deleted.has(id)),
            saved,
          ),
      );
    },
    onError: (_error, _changes, rollback) => {
      const writes = writesFor(queryClient);
      writes.failed = true;
      if (!rollback) return;
      const later = touchedByOthers(writes, rollback.token);
      queryClient.setQueryData<readonly RateRecord[]>(rateRecordKeys.all, (old) => {
        if (!old) return old;
        const mine = [...rollback.previous.keys()].filter((id) => !later.has(id));
        const restored = old.filter(({ id }) => !mine.includes(id));
        const originals = mine.flatMap((id) => rollback.previous.get(id) ?? []);
        return [...restored, ...originals];
      });
    },
    onSettled: async (_records, _error, _changes, rollback) => {
      const writes = writesFor(queryClient);
      if (rollback) finishWrite(writes, rollback.token);
      if (writes.inFlight.size === 0 && writes.failed) {
        writes.failed = false;
        await queryClient.invalidateQueries({ queryKey: rateRecordKeys.all });
      }
    },
  };
}

/** The one hook every People write goes through (D26). `mutate(changeSet)`; see `applyChangeSetOptions`. */
export function useApplyChangeSet() {
  const queryClient = useQueryClient();
  const repository = useRepository();
  return useMutation(applyChangeSetOptions(queryClient, repository));
}
