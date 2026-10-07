import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import { applyChangeSet, type ChangeSet } from '@baseline/delivery-domain';
import type { QueryClient } from '@tanstack/react-query';
import { patchCollection, readCollection } from './cache';
import { removeRecord, restoreRecord, sameRecord, upsertRecord } from './patch';
import { endWrite, oweRefetch, writesAfter, type Write } from './pendingWrites';
import type { ChangeSetResult } from './repository';

// The cache side of a write (D26): apply the change set at once, undo exactly its records if the server
// refuses, and take the server's version of what it wrote. They are plain functions of a `QueryClient`, so
// they are tested without React; `useApplyChangeSet` wires them to the mutation. The pending writes they
// keep, and the rule that a later pending write's records are left alone, are in `pendingWrites`.

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

/**
 * Undoes a failed write, by record id and not by snapshot: a realtime event for any other record stays, and
 * so does the value of a record a later pending write has since changed. That write inherits this one's
 * `previous`, so it too goes back to what the server has if it fails.
 */
export function rollBack(client: QueryClient, write: Write): void {
  const later = writesAfter(client, write);
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
  endWrite(client, write);
  oweRefetch(client);
}

/** True when a realtime event and the server's answer describe the same record (or both say it is gone). */
const agree = (event: object | undefined, answer: object | undefined): boolean =>
  event === undefined || answer === undefined ? event === answer : sameRecord(event, answer);

/** True when `event` is none of the versions the server's answer or an earlier write's answer account for. */
const unexpected = <T extends object>(
  event: T | undefined,
  answer: T | undefined,
  known: readonly (T | undefined)[] = [],
): boolean => !agree(event, answer) && !known.some((version) => agree(event, version));

/**
 * Whether a realtime event that arrived while `write` was pending is neither its own answer nor the answer of
 * an earlier write whose echo came late. The answer carries the write's own value, but another user's edit
 * may have committed after it, with its event and the answer arriving in either order; the answer alone
 * can't tell, and the records carry no clock to compare (items have none), so the cache can't know which is
 * newer. The echo of the write itself, or of an earlier write on the same record, costs nothing.
 */
function eventsDisagree(write: Write, result: ChangeSetResult): boolean {
  const itemAnswers = new Map<string, BreakdownItem | undefined>(result.items.map((item) => [item.id, item]));
  const allocationAnswers = new Map<string, Allocation | undefined>(
    result.allocations.map((allocation) => [allocation.id, allocation]),
  );
  // What the change set deleted has no answer: the server's version of it is "gone".
  return (
    [...write.absorbedItems].some((id) =>
      unexpected(write.items.get(id), itemAnswers.get(id), write.knownItems.get(id)),
    ) ||
    [...write.absorbedAllocations].some((id) =>
      unexpected(write.allocations.get(id), allocationAnswers.get(id), write.knownAllocations.get(id)),
    )
  );
}

/** Hands a later write the versions of record `id` that this write's answer and its own `known` account for. */
function handOn<T>(
  from: Map<string, (T | undefined)[]>,
  to: Map<string, (T | undefined)[]>,
  id: string,
  answer: T | undefined,
): void {
  to.set(id, [...(to.get(id) ?? []), answer, ...(from.get(id) ?? [])]);
}

/**
 * Takes the server's answer to a write into the cache, so it is right even while realtime is down: the
 * records it wrote with the server's `editedAt`, and the records it deleted removed. The realtime echo of
 * the same records then changes nothing. A record a later pending write has changed keeps that write's value,
 * and that write's `previous` becomes the server's version.
 *
 * A realtime event for one of its records that arrived while it was pending is discarded with the write's
 * `previous`. If it disagrees with the answer it may be a newer edit by someone else, so a refetch is owed
 * for when no write is pending (`takeRefetch`) instead of leaving the older answer in the cache.
 */
export function writeResult(client: QueryClient, write: Write, changeSet: ChangeSet, result: ChangeSetResult): void {
  if (eventsDisagree(write, result)) oweRefetch(client);
  const later = writesAfter(client, write);
  for (const item of result.items) {
    const next = later.find((other) => other.items.has(item.id));
    if (next) {
      next.items.set(item.id, item);
      handOn(write.knownItems, next.knownItems, item.id, item);
    } else patchCollection(client, 'breakdownItems', (records) => upsertRecord(records, item));
  }
  for (const allocation of result.allocations) {
    const next = later.find((other) => other.allocations.has(allocation.id));
    if (next) {
      next.allocations.set(allocation.id, allocation);
      handOn(write.knownAllocations, next.knownAllocations, allocation.id, allocation);
    } else patchCollection(client, 'allocations', (records) => upsertRecord(records, allocation));
  }
  for (const id of changeSet.delete.itemIds) {
    const next = later.find((other) => other.items.has(id));
    if (next) {
      next.items.set(id, undefined);
      handOn(write.knownItems, next.knownItems, id, undefined);
    } else patchCollection(client, 'breakdownItems', (records) => removeRecord(records, id));
  }
  for (const id of changeSet.delete.allocationIds) {
    const next = later.find((other) => other.allocations.has(id));
    if (next) {
      next.allocations.set(id, undefined);
      handOn(write.knownAllocations, next.knownAllocations, id, undefined);
    } else patchCollection(client, 'allocations', (records) => removeRecord(records, id));
  }
  endWrite(client, write);
}
