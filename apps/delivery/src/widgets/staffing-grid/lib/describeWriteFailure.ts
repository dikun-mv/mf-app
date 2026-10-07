import { describeError, RepositoryError } from '../../../shared/api';

/** A failed write as the widget shows it: an error, or for a clash with another user's change an information. */
export interface WriteFailure {
  readonly tone: 'error' | 'info';
  readonly text: string;
}

/**
 * What the user is told when a write didn't happen (screens 4, D33). The change has been undone by then
 * (D26), and the message says so. A `conflict` is not the user's fault or the network's: the data was
 * changed elsewhere and has been reloaded, so they check it and try again.
 */
export function describeWriteFailure(error: unknown): WriteFailure {
  if (error instanceof RepositoryError && error.code === 'conflict') {
    return { tone: 'info', text: 'This data was changed elsewhere and has been reloaded. Check it and try again.' };
  }
  const retry =
    error instanceof RepositoryError && error.code === 'unavailable' ? ' Try again when the connection is back.' : '';
  return { tone: 'error', text: `Your change wasn't saved: ${describeError(error)}. It has been undone.${retry}` };
}
