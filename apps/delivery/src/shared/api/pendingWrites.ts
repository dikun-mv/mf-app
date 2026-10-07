import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import type { QueryClient } from '@tanstack/react-query';

// The writes that have been applied to the cache but not yet answered by the server.
//
// Writes reach the server one at a time, but each is applied to the cache the moment it is made, so several
// can be pending together, each on top of the one before. A pending write keeps the records it touched as
// they were just before it (`previous`). Whatever else changes one of those records meanwhile (an earlier
// write ending, a realtime echo) must not change what the cache shows, which is the pending write's value:
// it updates that write's `previous` instead, so that undoing the write goes back to what the server has.

/** A pending write: the records it touches as they were before it, `undefined` for a record it creates. */
export interface Write {
  readonly items: Map<string, BreakdownItem | undefined>;
  readonly allocations: Map<string, Allocation | undefined>;
  /**
   * The ids of the records whose `previous` is a realtime event that arrived while the write was pending,
   * not the record as it was before the write. When the write ends, the server's answer is checked
   * against these events (see `writeResult`).
   */
  readonly absorbedItems: Set<string>;
  readonly absorbedAllocations: Set<string>;
  /**
   * Versions of a record that earlier writes' answers showed the server to hold, handed on when they ended
   * while this write was pending. Their realtime echoes may arrive late, after the earlier write has ended,
   * and are then absorbed here: they are expected, not another user's edit (see `writeResult`).
   */
  readonly knownItems: Map<string, (BreakdownItem | undefined)[]>;
  readonly knownAllocations: Map<string, (Allocation | undefined)[]>;
}

interface Pending {
  /** In the order the writes were made, which is the order they reach the server. */
  readonly writes: Write[];
  /** The cache has been disturbed since it was last in step with the server, so a refetch is owed. */
  refetchOwed: boolean;
  /** Run once, the next time no write is pending. */
  readonly whenIdle: (() => void)[];
}

const pendingOf = new WeakMap<QueryClient, Pending>();

function pending(client: QueryClient): Pending {
  let state = pendingOf.get(client);
  if (!state) {
    state = { writes: [], refetchOwed: false, whenIdle: [] };
    pendingOf.set(client, state);
  }
  return state;
}

/** Registers a write the moment it is made, before anything is awaited, so the pending count is right. */
export function beginWrite(client: QueryClient): Write {
  const write: Write = {
    items: new Map(),
    allocations: new Map(),
    absorbedItems: new Set(),
    absorbedAllocations: new Set(),
    knownItems: new Map(),
    knownAllocations: new Map(),
  };
  pending(client).writes.push(write);
  return write;
}

/** Forgets a write that has been answered (or abandoned), and runs what was waiting for the last one. */
export function endWrite(client: QueryClient, write: Write): void {
  const state = pending(client);
  const index = state.writes.indexOf(write);
  if (index !== -1) state.writes.splice(index, 1);
  if (state.writes.length > 0) return;
  const waiting = state.whenIdle.splice(0);
  for (const run of waiting) run();
}

/** The pending writes made after `write`. */
export function writesAfter(client: QueryClient, write: Write): Write[] {
  const { writes } = pending(client);
  return writes.slice(writes.indexOf(write) + 1);
}

/** Runs `run` now when no write is pending, or when the last pending one has ended. */
export function afterWrites(client: QueryClient, run: () => void): void {
  const state = pending(client);
  if (state.writes.length === 0) run();
  else state.whenIdle.push(run);
}

/** Notes that a refetch is due once nothing is pending (see `takeRefetch`). */
export function oweRefetch(client: QueryClient): void {
  pending(client).refetchOwed = true;
}

/**
 * True once, when no write is pending any more and a refetch is owed: the moment to refetch. Refetching
 * while a write is pending would bring back the server's older records over that write's optimistic ones.
 */
export function takeRefetch(client: QueryClient): boolean {
  const state = pending(client);
  if (state.writes.length > 0 || !state.refetchOwed) return false;
  state.refetchOwed = false;
  return true;
}

/**
 * Hands the server's version of an item to the first pending write that touched it, as that write's
 * `previous`. True when there is one: the cache must then be left alone, since it shows that write's value.
 */
export function claimItem(client: QueryClient, id: string, serverVersion: BreakdownItem | undefined): boolean {
  const owner = pending(client).writes.find((write) => write.items.has(id));
  owner?.items.set(id, serverVersion);
  owner?.absorbedItems.add(id);
  return owner !== undefined;
}

/** `claimItem` for an allocation. */
export function claimAllocation(client: QueryClient, id: string, serverVersion: Allocation | undefined): boolean {
  const owner = pending(client).writes.find((write) => write.allocations.has(id));
  owner?.allocations.set(id, serverVersion);
  owner?.absorbedAllocations.add(id);
  return owner !== undefined;
}
