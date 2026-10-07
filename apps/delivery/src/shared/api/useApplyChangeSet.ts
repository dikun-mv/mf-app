import type { ChangeSet } from '@baseline/delivery-domain';
import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from '@tanstack/react-query';
import { applyOptimistically, rollBack, writeResult } from './changeSetCache';
import type { RepositoryError } from './errors';
import { beginWrite, takeRefetch, type Write } from './pendingWrites';
import { collectionKey } from './queries';
import type { ChangeSetResult } from './repository';
import { useRepository } from './RepositoryContext';

/** One scope for the app's writes, so they reach the server one at a time, in order (D26). */
const WRITES_SCOPE = { id: 'delivery-writes' } as const;

/** Refetches the two collections a write can change. Used once no write is pending (see `takeRefetch`). */
const refetchWrittenCollections = (client: QueryClient): Promise<unknown> =>
  Promise.all([
    client.invalidateQueries({ queryKey: collectionKey('breakdownItems') }),
    client.invalidateQueries({ queryKey: collectionKey('allocations') }),
  ]);

/**
 * The one way Delivery writes (D26). It applies the change set to the cache at once, sends it as one
 * batch, takes the server's version of the written records, and on failure puts the touched records back.
 * Mutations aren't retried (D33).
 *
 * `onMutate` runs at once even for a write queued behind another one; only `mutationFn` waits. So several
 * writes can be pending, each applied on top of the last (see `changeSetCache`), and the collections are
 * refetched after a failure only when none is left pending, so a refetch can't undo a pending write.
 */
export function useApplyChangeSet(): UseMutationResult<ChangeSetResult, RepositoryError, ChangeSet, Write> {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation<ChangeSetResult, RepositoryError, ChangeSet, Write>({
    scope: WRITES_SCOPE,
    mutationFn: (changeSet) => repository.applyChangeSet(changeSet),
    onMutate: async (changeSet) => {
      const write = beginWrite(client);
      try {
        // A read that finishes now would overwrite the optimistic records with older ones.
        await Promise.all([
          client.cancelQueries({ queryKey: collectionKey('breakdownItems') }),
          client.cancelQueries({ queryKey: collectionKey('allocations') }),
        ]);
        applyOptimistically(client, write, changeSet);
      } catch (error) {
        // A change set the cache can't take (made against another state): nothing was applied.
        rollBack(client, write);
        throw error;
      }
      return write;
    },
    onSuccess: async (result, changeSet, write) => {
      writeResult(client, write, changeSet, result);
      // An earlier write may have failed while this one was pending.
      if (takeRefetch(client)) await refetchWrittenCollections(client);
    },
    // Returning the refetch keeps the mutation pending until it is done.
    onError: async (_error, _changeSet, write) => {
      if (write) rollBack(client, write);
      if (takeRefetch(client)) await refetchWrittenCollections(client);
    },
  });
}
