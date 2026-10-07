import type { RateRecord, RateRecordId } from '@baseline/people-contract';
import type { QueryClient } from '@tanstack/react-query';
import type { RealtimeAction } from './repository';

// What the app's rate writes have in flight (D26). TanStack Query runs `onMutate` at once even for a write
// queued behind another in its scope, so while one write waits for the server, others may already have
// applied their changes to the cache. Everything that reaches into that cache from outside a write (the
// realtime events, the connect refetch) asks this registry first, so none of them can undo what the
// user sees while a write is still on its way.

/** One write that has started (`onMutate` ran) and not settled. */
export interface InFlightWrite {
  /** The ids the write touches. */
  readonly touched: ReadonlySet<RateRecordId>;
  /**
   * What each touched record was before the write, or `undefined` if it was new: the snapshot a failed write
   * puts back. It is filled in once `onMutate` has read the cache, so an id is in it only after the snapshot
   * was taken. Records the server confirms meanwhile are written here too (`absorbServerRecord`).
   */
  readonly previous: Map<RateRecordId, RateRecord | undefined>;
}

export interface Writes {
  readonly inFlight: Map<symbol, InFlightWrite>;
  /** A write failed and the collection has not been refetched since. */
  failed: boolean;
  /** Work waiting for the writes to go idle. */
  readonly idle: Set<() => void>;
}

const writesOf = new WeakMap<QueryClient, Writes>();

export function writesFor(queryClient: QueryClient): Writes {
  let writes = writesOf.get(queryClient);
  if (!writes) {
    writes = { inFlight: new Map(), failed: false, idle: new Set() };
    writesOf.set(queryClient, writes);
  }
  return writes;
}

/** The ids touched by every in-flight write except `token`'s. */
export function touchedByOthers(writes: Writes, token: symbol): Set<RateRecordId> {
  const ids = new Set<RateRecordId>();
  for (const [other, { touched }] of writes.inFlight) {
    if (other !== token) for (const id of touched) ids.add(id);
  }
  return ids;
}

/** Takes a write out of the set and, when that leaves it empty, runs what was waiting. */
export function finishWrite(writes: Writes, token: symbol): void {
  writes.inFlight.delete(token);
  if (writes.inFlight.size > 0) return;
  const waiting = [...writes.idle];
  writes.idle.clear();
  for (const run of waiting) run();
}

/**
 * Runs `run` now when no write is in flight, otherwise when the last one has settled, whichever way. A refetch
 * that read the server before a batch committed, and landed after the write's result and echo, would put the
 * old rates back. Returns the function that drops the wait, for a caller that goes away first, or `null` when
 * `run` has already run.
 */
export function afterWrites(queryClient: QueryClient, run: () => void): (() => void) | null {
  const writes = writesFor(queryClient);
  if (writes.inFlight.size === 0) {
    run();
    return null;
  }
  writes.idle.add(run);
  return () => {
    writes.idle.delete(run);
  };
}

/**
 * A rate event from the server (an echo of a write, or an edit elsewhere) for a record a write still in
 * flight has changed. The cache shows that write's optimistic value, and the event may be older than it,
 * so it must not replace it. It is the server's latest word on the record, though, so it becomes what a
 * failure of the write puts back. Returns whether it was taken: `false` means nothing in flight is
 * concerned (or none has read the cache yet) and the event goes into the cache as usual.
 */
export function absorbServerRecord(queryClient: QueryClient, action: RealtimeAction, record: RateRecord): boolean {
  let absorbed = false;
  for (const write of writesFor(queryClient).inFlight.values()) {
    if (!write.previous.has(record.id)) continue;
    write.previous.set(record.id, action === 'delete' ? undefined : record);
    absorbed = true;
  }
  return absorbed;
}
