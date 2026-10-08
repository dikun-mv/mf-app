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

/** Hands the server's version of a record to the pending write that touched it; true if there is one. */
type Claim<K extends CollectionKey> = (
  client: QueryClient,
  id: string,
  serverVersion: RecordOf<K> | undefined,
) => boolean;

/** The collections the app writes, keyed so that each claim takes its own collection's record. */
const CLAIMS: { readonly [K in CollectionKey]?: Claim<K> } = {
  breakdownItems: claimItem,
  allocations: claimAllocation,
};

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
  const claim: Claim<K> | undefined = CLAIMS[key];
  if (claim?.(client, id, record)) return;
  patchCollection(client, key, (records) => (record ? upsertRecord(records, record) : removeRecord(records, id)));
}
