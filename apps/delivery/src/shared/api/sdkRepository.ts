import { DELIVERY_BASE_PATH, type Allocation, type BreakdownItem } from '@baseline/delivery-contract';
import type { ChangeSet } from '@baseline/delivery-domain';
import { PEOPLE_BASE_PATH } from '@baseline/people-contract';
import PocketBase, { type RecordSubscription } from 'pocketbase';
import { batchOperations } from './batch';
import { COLLECTIONS, type CollectionKey, type Instance, type RecordOf } from './collections';
import { mapError } from './errors';
import { RECORD_SCHEMAS } from './records';
import type { ChangeSetResult, ConnectionEvent, RealtimeEvent, Repository, Unsubscribe } from './repository';

/** One SDK client per PocketBase instance, with the gateway's base path (ADR 031, 033). */
export type Clients = Readonly<Record<Instance, PocketBase>>;

/**
 * The clients for an app served from `origin`: the page's own origin, since the gateway serves the apps
 * and both instances (and the dev server proxies `/api`). Auto-cancellation is off, because TanStack Query
 * runs several reads at once and an SDK that cancelled the "duplicate" one would fail them.
 */
export function createClients(origin: string): Clients {
  const client = (basePath: string): PocketBase => {
    const pb = new PocketBase(`${origin}${basePath}`);
    pb.autoCancellation(false);
    return pb;
  };
  return { delivery: client(DELIVERY_BASE_PATH), people: client(PEOPLE_BASE_PATH) };
}

/**
 * Parses one realtime event with the collection's schema. An event with an unknown action or a record
 * that doesn't parse is logged and dropped (D29): it never reaches the cache.
 */
export function parseRealtimeEvent<K extends CollectionKey>(
  key: K,
  event: RecordSubscription<unknown>,
): RealtimeEvent<K> | null {
  const parsed = RECORD_SCHEMAS[key].safeParse(event.record);
  if (!parsed.success || !isAction(event.action)) {
    console.error(`Dropped a realtime event of ${COLLECTIONS[key].name}`, event.action, parsed.error);
    return null;
  }
  return { action: event.action, record: parsed.data };
}

/**
 * Parses a collection's records. One that fails its schema is logged and skipped, never cached (D29): a bad
 * row, which only a hand-made API call can make (ADR 034), must not fail the whole read and blank the page.
 */
function parseRecords<K extends CollectionKey>(key: K, records: readonly unknown[]): RecordOf<K>[] {
  const parsed: RecordOf<K>[] = [];
  for (const record of records) {
    const result = RECORD_SCHEMAS[key].safeParse(record);
    if (result.success) parsed.push(result.data);
    else console.error(`Skipped a record of ${COLLECTIONS[key].name} that fails its schema`, result.error);
  }
  return parsed;
}

function isAction(action: string): action is RealtimeEvent<CollectionKey>['action'] {
  return action === 'create' || action === 'update' || action === 'delete';
}

/**
 * Closes the realtime connection and cancels any reconnect still pending. Unsubscribing the last topic closes
 * a connection that is up, but not one in the SDK's own reconnect loop (no client id yet, a timer pending,
 * retries unbounded): an unmounted app would keep opening connections for as long as its service is down.
 * `disconnect` is private in the SDK's types; it is what the SDK itself calls to stop.
 */
function closeConnection(pb: PocketBase): void {
  (pb.realtime as unknown as { disconnect(): void }).disconnect();
}

/**
 * The SDK implementation of `Repository` (T6.0a). Only this file and `createClients` touch `pocketbase`.
 * Reads are typed by collection and parsed with the contracts' record schemas, or the adapter's own for
 * Delivery's private collections.
 */
export function createSdkRepository(clients: Clients): Repository {
  // Live subscriptions per instance. When the last one stops, the connection is closed outright.
  const open: Record<Instance, number> = { delivery: 0, people: 0 };

  /** Counts a subscription that is up; its stop function closes the connection once none is left. */
  const tracked = (instance: Instance, stop: Unsubscribe): Unsubscribe => {
    open[instance] += 1;
    let stopped = false;
    return async () => {
      if (stopped) return;
      stopped = true;
      try {
        await stop();
      } finally {
        open[instance] -= 1;
        if (open[instance] === 0) closeConnection(clients[instance]);
      }
    };
  };

  return {
    async list(key) {
      const { instance, name } = COLLECTIONS[key];
      try {
        // `@rowid` is insertion order, so siblings keep the order they were created in.
        const records = await clients[instance].collection(name).getFullList({ sort: '@rowid' });
        return parseRecords(key, records);
      } catch (error) {
        throw mapError(error, instance);
      }
    },

    async applyChangeSet(changeSet: ChangeSet): Promise<ChangeSetResult> {
      const operations = batchOperations(changeSet);
      if (operations.length === 0) return { items: [], allocations: [] };
      try {
        const batch = clients.delivery.createBatch();
        for (const operation of operations) {
          const target = batch.collection(COLLECTIONS[operation.collection].name);
          if (operation.op === 'create') target.create(operation.body);
          else if (operation.op === 'update') target.update(operation.id, operation.body);
          else target.delete(operation.id);
        }
        // Rejects on the first refused operation and keeps nothing (ADR 033 b). One result per operation, in order.
        const results = await batch.send();
        const items: BreakdownItem[] = [];
        const allocations: Allocation[] = [];
        for (const [index, operation] of operations.entries()) {
          if (operation.op === 'delete') continue;
          const body: unknown = results[index]?.body;
          if (operation.collection === 'breakdownItems') items.push(RECORD_SCHEMAS.breakdownItems.parse(body));
          else allocations.push(RECORD_SCHEMAS.allocations.parse(body));
        }
        return { items, allocations };
      } catch (error) {
        throw mapError(error, 'delivery');
      }
    },

    async subscribe(key, onEvent) {
      const { instance, name } = COLLECTIONS[key];
      const collection = clients[instance].collection(name);
      try {
        const stop = await collection.subscribe<unknown>('*', (event) => {
          const parsed = parseRealtimeEvent(key, event);
          if (parsed) onEvent(parsed);
        });
        return tracked(instance, stop);
      } catch (error) {
        // A failed connect leaves the listener registered, and the SDK doesn't retry a first connect
        // (the provider does), so take it out before the retry adds another.
        await collection.unsubscribe('*').catch(() => undefined);
        throw mapError(error, instance);
      }
    },

    async watchConnection(instance, onChange): Promise<Unsubscribe> {
      const { realtime } = clients[instance];
      const listener = (): void => {
        onChange('connected' satisfies ConnectionEvent);
      };
      // The SDK calls this when a live connection drops or is closed, and reconnects on its own.
      realtime.onDisconnect = () => {
        onChange('disconnected' satisfies ConnectionEvent);
      };
      try {
        // `PB_CONNECT` is the connection's own event: it fires on the first connect and after each reconnect.
        const stop = await realtime.subscribe('PB_CONNECT', listener);
        return tracked(instance, async () => {
          delete realtime.onDisconnect;
          await stop();
        });
      } catch (error) {
        delete realtime.onDisconnect;
        await realtime.unsubscribeByTopicAndListener('PB_CONNECT', listener).catch(() => undefined);
        throw mapError(error, instance);
      }
    },
  };
}
