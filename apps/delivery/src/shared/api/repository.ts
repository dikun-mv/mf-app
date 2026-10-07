import type { Allocation, BreakdownItem } from '@baseline/delivery-contract';
import type { ChangeSet } from '@baseline/delivery-domain';
import type { CollectionKey, Instance, RecordOf } from './collections';

// The seam between the app and PocketBase (D30). Query and mutation hooks, the realtime provider and the
// tests see only this; the SDK implementation and the in-memory fake both implement it, so neither can
// drift from the other silently. Every method fails with a `RepositoryError` (errors.ts).

/** What a realtime event says happened to a record. `record` is the whole record, parsed (D6). */
export interface RealtimeEvent<K extends CollectionKey> {
  readonly action: 'create' | 'update' | 'delete';
  readonly record: RecordOf<K>;
}

/** Stops a subscription. Calling it twice is fine. */
export type Unsubscribe = () => Promise<void>;

/** The realtime connection of one instance: it came up (the first time, or again after a drop), or it dropped. */
export type ConnectionEvent = 'connected' | 'disconnected';

/**
 * The records a change set wrote, as the server holds them. They differ from what the client sent in
 * `editedAt`, which the server stamps (D18), so the cache takes these in place of its optimistic copies.
 */
export interface ChangeSetResult {
  readonly items: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
}

export interface Repository {
  /** The whole collection, parsed. Whatever the collection, one request (or one per 500 records). */
  list<K extends CollectionKey>(key: K): Promise<readonly RecordOf<K>[]>;
  /**
   * Writes a change set as one batch, so it commits or fails as a whole (ADR 035: every write is a batch,
   * a batch of one included). An empty change set sends nothing. Only Delivery's tree and allocations are
   * written; projects and People's collections are read-only here.
   */
  applyChangeSet(changeSet: ChangeSet): Promise<ChangeSetResult>;
  /**
   * Calls `onEvent` for each create, update and delete of a record in the collection. An event that
   * doesn't parse is logged and dropped. Rejects when the connection can't be made.
   */
  subscribe<K extends CollectionKey>(key: K, onEvent: (event: RealtimeEvent<K>) => void): Promise<Unsubscribe>;
  /**
   * Tells when an instance's realtime connection comes up and drops. Register it in the same tick as the
   * collection subscriptions: the first `connected` arrives as soon as the connection opens.
   */
  watchConnection(instance: Instance, onChange: (event: ConnectionEvent) => void): Promise<Unsubscribe>;
}
