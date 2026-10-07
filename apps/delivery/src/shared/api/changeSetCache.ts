import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import { applyChangeSet, type ChangeSet } from '@baseline/delivery-domain';
import type { QueryClient } from '@tanstack/react-query';
import { patchCollection, readCollection } from './cache';
import { restoreRecord, upsertRecord } from './patch';
import type { ChangeSetResult } from './repository';

// The cache side of a write (D26): apply the change set at once, undo exactly its records if the server
// refuses, and take the server's version of what it wrote. They are plain functions of a `QueryClient`, so
// they are tested without React; `useApplyChangeSet` wires them to the mutation.

/** The records a change set touches, as they were before it: `undefined` for a record it creates. */
export interface Touched {
  readonly items: ReadonlyMap<string, BreakdownItem | undefined>;
  readonly allocations: ReadonlyMap<string, Allocation | undefined>;
}

const NOTHING: Touched = { items: new Map(), allocations: new Map() };

function touchedBy(changeSet: ChangeSet, items: readonly BreakdownItem[], allocations: readonly Allocation[]): Touched {
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
  return {
    items: new Map(itemIds.map((id) => [id, items.find((item) => item.id === id)])),
    allocations: new Map(allocationIds.map((id) => [id, allocations.find((allocation) => allocation.id === id)])),
  };
}

/**
 * Applies the change set to the cached tree and allocations with the domain's `applyChangeSet`, and
 * returns the records it touched as they were, for `rollBack`. With either collection not loaded there
 * is nothing to apply it to.
 */
export function applyOptimistically(client: QueryClient, changeSet: ChangeSet): Touched {
  const items = readCollection(client, 'breakdownItems');
  const allocations = readCollection(client, 'allocations');
  if (items === undefined || allocations === undefined) return NOTHING;
  const touched = touchedBy(changeSet, items, allocations);
  const next = applyChangeSet({ projects: [], items, allocations }, changeSet);
  patchCollection(client, 'breakdownItems', () => next.items);
  patchCollection(client, 'allocations', () => next.allocations);
  return touched;
}

/**
 * Puts the touched records back, by id and not by snapshot: a realtime event for any other record that
 * arrived while the write was in flight stays.
 */
export function rollBack(client: QueryClient, touched: Touched): void {
  for (const [id, previous] of touched.items) {
    patchCollection(client, 'breakdownItems', (records) => restoreRecord(records, id, previous));
  }
  for (const [id, previous] of touched.allocations) {
    patchCollection(client, 'allocations', (records) => restoreRecord(records, id, previous));
  }
}

/**
 * Writes the records the server returned into the cache, so it is right even while realtime is down.
 * The realtime echo of the same records then changes nothing.
 */
export function writeResult(client: QueryClient, result: ChangeSetResult): void {
  for (const item of result.items) patchCollection(client, 'breakdownItems', (records) => upsertRecord(records, item));
  for (const allocation of result.allocations) {
    patchCollection(client, 'allocations', (records) => upsertRecord(records, allocation));
  }
}
