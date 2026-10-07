import type { ChangeSet } from '@baseline/delivery-domain';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { applyOptimistically, rollBack, writeResult, type Touched } from './changeSetCache';
import type { RepositoryError } from './errors';
import { collectionKey } from './queries';
import type { ChangeSetResult } from './repository';
import { useRepository } from './RepositoryContext';

/** One scope for the app's writes, so they reach the server one at a time, in order (D26). */
const WRITES_SCOPE = { id: 'delivery-writes' } as const;

/**
 * The one way Delivery writes (D26). It applies the change set to the cache at once, sends it as one
 * batch, takes the server's version of the written records, and on failure puts the touched records back
 * and refetches the two collections it could have changed. Mutations aren't retried (D33).
 */
export function useApplyChangeSet(): UseMutationResult<ChangeSetResult, RepositoryError, ChangeSet, Touched> {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation<ChangeSetResult, RepositoryError, ChangeSet, Touched>({
    scope: WRITES_SCOPE,
    mutationFn: (changeSet) => repository.applyChangeSet(changeSet),
    onMutate: async (changeSet) => {
      // A read that finishes now would overwrite the optimistic records with older ones.
      await Promise.all([
        client.cancelQueries({ queryKey: collectionKey('breakdownItems') }),
        client.cancelQueries({ queryKey: collectionKey('allocations') }),
      ]);
      return applyOptimistically(client, changeSet);
    },
    onSuccess: (result) => {
      writeResult(client, result);
    },
    // Returning the refetch keeps the mutation pending until it is done, so the next queued write starts
    // from the server's state.
    onError: async (_error, _changeSet, touched) => {
      if (touched) rollBack(client, touched);
      await Promise.all([
        client.invalidateQueries({ queryKey: collectionKey('breakdownItems') }),
        client.invalidateQueries({ queryKey: collectionKey('allocations') }),
      ]);
    },
  });
}
