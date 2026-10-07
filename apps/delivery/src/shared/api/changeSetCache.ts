import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import { applyChangeSet, type ChangeSet } from '@baseline/delivery-domain';
import type { QueryClient } from '@tanstack/react-query';
import { patchCollection, readCollection } from './cache';
import { removeRecord, restoreRecord, upsertRecord } from './patch';
import type { ChangeSetResult } from './repository';

// The cache side of a write (D26): apply the change set at once, undo exactly its records if the server
// refuses, and take the server's version of what it wrote. They are plain functions of a `QueryClient`, so
// they are tested without React; `useApplyChangeSet` wires them to the mutation.
//
// Writes reach the server one at a time, but each is applied to the cache the moment it is made, so several
// can be pending together, each on top of the one before. A pending write keeps the records it touched as
// they were just before it (`previous`). When an earlier write ends, any record a later pending write also
// touched is not changed in the cache (the later write's value is the one on screen); the later write's
// `previous` for it is updated instead, so that undoing the later write goes back to what the earlier one
// left, not to what it had optimistically shown.

/** A pending write: the records it touches as they were before it, `undefined` for a record it creates. */
export interface Write {
  readonly items: Map<string, BreakdownItem | undefined>;
  readonly allocations: Map<string, Allocation | undefined>;
}

interface Pending {
  /** In the order the writes were made, which is the order they reach the server. */
  readonly writes: Write[];
  /** A write failed since the cache was last in step with the server, so a refetch is owed. */
  refetchOwed: boolean;
}

const pendingOf = new WeakMap<QueryClient, Pending>();

function pending(client: QueryClient): Pending {
  let state = pendingOf.get(client);
  if (!state) {
    state = { writes: [], refetchOwed: false };
    pendingOf.set(client, state);
  }
  return state;
}

/** Registers a write the moment it is made, before anything is awaited, so the pending count is right. */
export function beginWrite(client: QueryClient): Write {
  const write: Write = { items: new Map(), allocations: new Map() };
  pending(client).writes.push(write);
  return write;
}

/**
 * Applies the change set to the cached tree and allocations with the domain's `applyChangeSet`, and
 * records on `write` the records it touched as they were. With either collection not loaded there is
 * nothing to apply it to.
 */
export function applyOptimistically(client: QueryClient, write: Write, changeSet: ChangeSet): void {
  const items = readCollection(client, 'breakdownItems');
  const allocations = readCollection(client, 'allocations');
  if (items === undefined || allocations === undefined) return;
  const itemIds = [
    ...changeSet.create.items.map(({ id }) => id),
    ...changeSet.update.items.map(({ id }) => id),
    ...changeSet.delete.itemIds,
  ];
  const allocationIds = [
    ...changeSet.create.allocations.map(({ id }) => id),
    ...changeSet.update.allocations.map(({ id }) => id),
    ...changeSet.delete.allocationIds,
  ];
  const next = applyChangeSet({ projects: [], items, allocations }, changeSet);
  for (const id of itemIds)
    write.items.set(
      id,
      items.find((item) => item.id === id),
    );
  for (const id of allocationIds)
    write.allocations.set(
      id,
      allocations.find((allocation) => allocation.id === id),
    );
  patchCollection(client, 'breakdownItems', () => next.items);
  patchCollection(client, 'allocations', () => next.allocations);
}

/** The pending writes made after `write`. */
function laterThan(client: QueryClient, write: Write): Write[] {
  const { writes } = pending(client);
  return writes.slice(writes.indexOf(write) + 1);
}

function finish(client: QueryClient, write: Write): void {
  const { writes } = pending(client);
  const index = writes.indexOf(write);
  if (index !== -1) writes.splice(index, 1);
}

/**
 * Undoes a failed write, by record id and not by snapshot: a realtime event for any other record stays, and
 * so does the value of a record a later pending write has since changed. That write inherits this one's
 * `previous`, so it too goes back to what the server has if it fails.
 */
export function rollBack(client: QueryClient, write: Write): void {
  const later = laterThan(client, write);
  for (const [id, previous] of write.items) {
    const next = later.find((other) => other.items.has(id));
    if (next) next.items.set(id, previous);
    else patchCollection(client, 'breakdownItems', (records) => restoreRecord(records, id, previous));
  }
  for (const [id, previous] of write.allocations) {
    const next = later.find((other) => other.allocations.has(id));
    if (next) next.allocations.set(id, previous);
    else patchCollection(client, 'allocations', (records) => restoreRecord(records, id, previous));
  }
  finish(client, write);
  pending(client).refetchOwed = true;
}

/**
 * Takes the server's answer to a write into the cache, so it is right even while realtime is down: the
 * records it wrote with the server's `editedAt`, and the records it deleted removed. The realtime echo of
 * the same records then changes nothing. A record a later pending write has changed keeps that write's value,
 * and that write's `previous` becomes the server's version.
 */
export function writeResult(client: QueryClient, write: Write, changeSet: ChangeSet, result: ChangeSetResult): void {
  const later = laterThan(client, write);
  for (const item of result.items) {
    const next = later.find((other) => other.items.has(item.id));
    if (next) next.items.set(item.id, item);
    else patchCollection(client, 'breakdownItems', (records) => upsertRecord(records, item));
  }
  for (const allocation of result.allocations) {
    const next = later.find((other) => other.allocations.has(allocation.id));
    if (next) next.allocations.set(allocation.id, allocation);
    else patchCollection(client, 'allocations', (records) => upsertRecord(records, allocation));
  }
  for (const id of changeSet.delete.itemIds) {
    const next = later.find((other) => other.items.has(id));
    if (next) next.items.set(id, undefined);
    else patchCollection(client, 'breakdownItems', (records) => removeRecord(records, id));
  }
  for (const id of changeSet.delete.allocationIds) {
    const next = later.find((other) => other.allocations.has(id));
    if (next) next.allocations.set(id, undefined);
    else patchCollection(client, 'allocations', (records) => removeRecord(records, id));
  }
  finish(client, write);
}

/**
 * True once, when no write is pending any more and one has failed since the cache was last refetched: the
 * moment to refetch. Refetching while another write is pending would bring back the server's older records
 * over that write's optimistic ones.
 */
export function takeRefetch(client: QueryClient): boolean {
  const state = pending(client);
  if (state.writes.length > 0 || !state.refetchOwed) return false;
  state.refetchOwed = false;
  return true;
}
