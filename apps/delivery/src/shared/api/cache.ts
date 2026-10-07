import type { QueryClient } from '@tanstack/react-query';
import type { CollectionKey, RecordOf } from './collections';
import { removeRecord, upsertRecord } from './patch';
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

/** Applies a realtime event to its collection by id (D29): create and update replace or add, delete removes. */
export function applyRealtimeEvent<K extends CollectionKey>(
  client: QueryClient,
  key: K,
  event: RealtimeEvent<K>,
): void {
  patchCollection(client, key, (records) =>
    event.action === 'delete' ? removeRecord(records, event.record.id) : upsertRecord(records, event.record),
  );
}
