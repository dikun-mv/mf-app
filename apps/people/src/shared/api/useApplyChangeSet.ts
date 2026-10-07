import type { RateRecord, RateRecordId } from '@baseline/people-contract';
import { useMutation, useQueryClient, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useRepository } from './context';
import { patchList } from './patch';
import { rateRecordKeys } from './queryKeys';
import { applyRateChangeSet, touchedRateIds } from './rateChangeSet';
import type { PeopleRepository, RateChangeSet } from './repository';

/**
 * What `onMutate` keeps to undo an optimistic write: each touched record as it was, or `undefined` if it was
 * new, and a token that names this write among the ones in flight.
 */
interface Rollback {
  readonly previous: ReadonlyMap<RateRecordId, RateRecord | undefined>;
  readonly token: symbol;
}

/**
 * The writes of one app that have started (`onMutate` ran) and not settled, with the ids each touches.
 * TanStack Query runs `onMutate` at once even for a write queued behind another in its scope, so while a
 * write is in flight others may already have applied their changes to the cache.
 */
interface Writes {
  readonly inFlight: Map<symbol, ReadonlySet<RateRecordId>>;
  /** A write failed and the collection has not been refetched since. */
  failed: boolean;
}

const writesOf = new WeakMap<QueryClient, Writes>();

function writesFor(queryClient: QueryClient): Writes {
  let writes = writesOf.get(queryClient);
  if (!writes) {
    writes = { inFlight: new Map(), failed: false };
    writesOf.set(queryClient, writes);
  }
  return writes;
}

/** The ids touched by every in-flight write except `token`'s. */
function touchedByOthers(writes: Writes, token: symbol): Set<RateRecordId> {
  const ids = new Set<RateRecordId>();
  for (const [other, touched] of writes.inFlight) {
    if (other !== token) for (const id of touched) ids.add(id);
  }
  return ids;
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
      writesFor(queryClient).inFlight.set(token, new Set(touchedRateIds(changes)));
      await queryClient.cancelQueries({ queryKey: rateRecordKeys.all });
      const cached = queryClient.getQueryData<readonly RateRecord[]>(rateRecordKeys.all);
      const previous = new Map<RateRecordId, RateRecord | undefined>(
        touchedRateIds(changes).map((id) => [id, cached?.find((record) => record.id === id)]),
      );
      // Nothing cached means nothing to show yet; the write still goes to the server.
      if (cached) queryClient.setQueryData(rateRecordKeys.all, applyRateChangeSet(cached, changes));
      return { previous, token };
    },
    onSuccess: (records, changes) => {
      const deleted = new Set<string>(changes.delete);
      queryClient.setQueryData<readonly RateRecord[]>(
        rateRecordKeys.all,
        (old) =>
          old &&
          upsertAll(
            old.filter(({ id }) => !deleted.has(id)),
            records,
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
      if (rollback) writes.inFlight.delete(rollback.token);
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
