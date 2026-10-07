import { InlineMessage } from '@baseline/ui';
import { useMutationState } from '@tanstack/react-query';
import { describeError, RepositoryError } from '../../../shared/api';

/**
 * The message at the top of the grid when the last write didn't reach the server (screens 4, D33). The
 * optimistic change has already been undone by `useApplyChangeSet`; this tells the user. It stays until
 * the next write starts, then goes: that write is the user trying again.
 *
 * It reads the app's mutations rather than a mutation of its own, because the cell that wrote has long
 * since turned back into a button. Every mutation in Delivery is a change set, so the newest one is the
 * last write. A refusal that never left the browser is shown beside its cell instead (`CellEditor`).
 */
export function WriteFailedMessage() {
  const writes = useMutationState({ select: ({ state }) => ({ status: state.status, error: state.error }) });
  const last = writes.at(-1);
  if (last?.status !== 'error') return null;
  const { error } = last;
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
