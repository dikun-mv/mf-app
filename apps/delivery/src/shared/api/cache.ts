import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import type { QueryClient } from '@tanstack/react-query';
import type { CollectionKey, RecordOf } from './collections';
import { removeRecord, upsertRecord } from './patch';
import { claimAllocation, claimItem } from './pendingWrites';
import { collectionKey } from './queries';
import type { RealtimeEvent } from './repository';

// Reading and patching one collection's cached records. The cache is the only copy of the data (D26), and
// these three functions are the only places that type what is in it.

/** The cached collection, or `undefined` while it hasn't loaded. */
export function readCollection<K extends CollectionKey>(
  client: QueryClient,
  key: K,
): readonly RecordOf<K>[] | undefined {
  return client.getQueryData<readonly RecordOf<K>[]>(collectionKey(key));
}

/**
 * Replaces a loaded collection with `patch` of it. A collection that hasn't loaded is left alone: its
 * first fetch will bring the current state, so there is nothing to patch.
 */
export function patchCollection<K extends CollectionKey>(
  client: QueryClient,
  key: K,
  patch: (records: readonly RecordOf<K>[]) => readonly RecordOf<K>[],
): void {
  client.setQueryData<readonly RecordOf<K>[]>(collectionKey(key), (records) =>
    records === undefined ? undefined : patch(records),
  );
}

/**
 * Applies a realtime event to its collection by id (D29): create and update replace or add, delete removes.
 * A record a pending write has changed is not touched: the cache shows that write's value, and the event
 * (typically the echo of an earlier write) becomes that write's `previous`, so a later undo goes back to it.
 */
export function applyRealtimeEvent<K extends CollectionKey>(
  client: QueryClient,
  key: K,
  event: RealtimeEvent<K>,
): void {
  const { id } = event.record;
  const record = event.action === 'delete' ? undefined : event.record;
  // `key` says which entity `record` is; TypeScript can't carry that through the generic.
  if (key === 'breakdownItems' && claimItem(client, id, record as BreakdownItem | undefined)) return;
  if (key === 'allocations' && claimAllocation(client, id, record as Allocation | undefined)) return;
  patchCollection(client, key, (records) => (record ? upsertRecord(records, record) : removeRecord(records, id)));
}
