import { InlineMessage } from '@baseline/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { describeError, RepositoryError } from '../../../shared/api';

/**
 * The message at the top of the grid when a write didn't reach the server (screens 4, D33). The optimistic
 * change has already been undone by `useApplyChangeSet`; this tells the user. It is the failure of any
 * write, also one that failed while a later write waited behind it, and it stays until the user starts the
 * next write: that is them trying again.
 *
 * The failure is kept in state, taken from the mutation cache as it happens. The cache drops a failed
 * mutation once nothing observes it, and the cell that wrote has long since turned back into a button, so
 * reading it from the cache later would let the message vanish by itself. A refusal that never left the
 * browser is shown beside its cell instead (`CellEditor`).
 */
export function WriteFailedMessage() {
  const client = useQueryClient();
  const [failure, setFailure] = useState<{ readonly error: unknown } | null>(null);
  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.type === 'added') setFailure(null);
        else if (event.type === 'updated' && event.action.type === 'error') setFailure({ error: event.action.error });
      }),
    [client],
  );
  if (failure === null) return null;
  const { error } = failure;
  // A conflict means someone else's change got there first; the collections were reloaded (D33).
  if (error instanceof RepositoryError && error.code === 'conflict') {
    return (
      <InlineMessage tone="info">
        This data was changed elsewhere and has been reloaded. Check it and try again.
      </InlineMessage>
    );
  }
  return (
    <InlineMessage tone="error">
      Your change wasn&apos;t saved: {describeError(error)}. It has been undone. Try again when the connection is back.
    </InlineMessage>
  );
}
