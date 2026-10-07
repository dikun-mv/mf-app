import type { RateRecord, RateRecordId } from '@baseline/people-contract';
import { useMutation, useQueryClient, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useRepository } from './context';
import { patchList } from './patch';
import { rateRecordKeys } from './queryKeys';
import { applyRateChangeSet, touchedRateIds } from './rateChangeSet';
import type { PeopleRepository, RateChangeSet } from './repository';

/** What `onMutate` keeps to undo an optimistic write: each touched record as it was, or `undefined` if it was new. */
interface Rollback {
  readonly previous: ReadonlyMap<RateRecordId, RateRecord | undefined>;
}

/** Replaces records by id and appends the unknown ones. The same array comes back when nothing differs. */
const upsertAll = (list: readonly RateRecord[], records: readonly RateRecord[]): readonly RateRecord[] =>
  records.reduce((acc, record) => patchList(acc, 'update', record, ({ id }) => id), list);

/**
 * The options of People's one write (D26). `onMutate` applies the change set to the cached rate records and
 * keeps the touched ones; `onSuccess` writes the records the batch returned into the cache, so it is right
 * even while realtime is down (the realtime echo then changes nothing); `onError` puts the touched records
 * back, not the whole list, so events that arrived meanwhile survive, and refetches the collection. Writes
 * share one scope, so they reach the server one at a time, in order.
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
      await queryClient.cancelQueries({ queryKey: rateRecordKeys.all });
      const cached = queryClient.getQueryData<readonly RateRecord[]>(rateRecordKeys.all);
      const previous = new Map<RateRecordId, RateRecord | undefined>(
        touchedRateIds(changes).map((id) => [id, cached?.find((record) => record.id === id)]),
      );
      // Nothing cached means nothing to show yet; the write still goes to the server.
      if (cached) queryClient.setQueryData(rateRecordKeys.all, applyRateChangeSet(cached, changes));
      return { previous };
    },
    onSuccess: (records) => {
      queryClient.setQueryData<readonly RateRecord[]>(rateRecordKeys.all, (old) => old && upsertAll(old, records));
    },
    onError: async (_error, _changes, rollback) => {
      if (rollback) {
        queryClient.setQueryData<readonly RateRecord[]>(rateRecordKeys.all, (old) => {
          if (!old) return old;
          const restored = old.filter(({ id }) => !rollback.previous.has(id));
          const originals = [...rollback.previous.values()].filter((record) => record !== undefined);
          return [...restored, ...originals];
        });
      }
      await queryClient.invalidateQueries({ queryKey: rateRecordKeys.all });
    },
  };
}

/** The one hook every People write goes through (D26). `mutate(changeSet)`; see `applyChangeSetOptions`. */
export function useApplyChangeSet() {
  const queryClient = useQueryClient();
  const repository = useRepository();
  return useMutation(applyChangeSetOptions(queryClient, repository));
}
