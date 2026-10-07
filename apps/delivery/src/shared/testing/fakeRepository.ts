import type { Allocation } from '@baseline/delivery-contract';
import { applyChangeSet, type ChangeSet } from '@baseline/delivery-domain';
import { IsoDateTime } from '@baseline/host-contract';
import {
  COLLECTIONS,
  RepositoryError,
  type ChangeSetResult,
  type CollectionKey,
  type ConnectionEvent,
  type Instance,
  type RealtimeEvent,
  type RecordOf,
  type Repository,
} from '../api';

type Records = { [K in CollectionKey]: RecordOf<K>[] };
type Handlers = { [K in CollectionKey]: Set<(event: RealtimeEvent<K>) => void> };

/** Starting records, by collection. A collection left out starts empty. */
export type FakeData = { readonly [K in CollectionKey]?: readonly RecordOf<K>[] };

/**
 * The in-memory fake of `Repository` (D30): the same interface as the SDK one, over arrays, with the
 * server behaviour the app depends on. A write is applied as a whole or not at all, `editedAt` is stamped
 * as `delivery-pb` does (D18), and each written record then reaches the subscribers as an event, as it
 * would after a commit. The extra methods are the test's hands on the "server".
 */
export interface FakeRepository extends Repository {
  /** What the "server" holds now. */
  stored<K extends CollectionKey>(key: K): readonly RecordOf<K>[];
  /** The change sets it accepted, in order. */
  readonly written: readonly ChangeSet[];
  /** Changes a record on the "server" as if another user did, and tells the subscribers. */
  emit<K extends CollectionKey>(key: K, action: RealtimeEvent<K>['action'], record: RecordOf<K>): void;
  /** Changes what the "server" holds without telling anyone: an event that was missed while disconnected. */
  replace<K extends CollectionKey>(key: K, next: readonly RecordOf<K>[]): void;
  /** The instance's realtime connection comes up or drops. */
  setConnection(instance: Instance, event: ConnectionEvent): void;
  /** Makes reads of a collection fail with `error` until called with `null`. */
  failReads(key: CollectionKey, error: RepositoryError | null): void;
  /** Makes the next `times` writes (all, by default) fail with `error`, keeping nothing; `null` stops it. */
  failWrites(error: RepositoryError | null, times?: number): void;
  /** Makes subscribing to an instance fail, as when its service is down, until called with `null`. */
  failSubscribe(instance: Instance, error: RepositoryError | null): void;
  /** Keeps reads of a collection pending until the returned function is called. */
  holdReads(key: CollectionKey): () => void;
  /** Keeps writes pending until the returned function is called, so a test can look at the optimistic state. */
  holdWrites(): () => void;
}

/** A promise that stays pending until `release` is called. */
function holdOn(): { gate: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
}

export function createFakeRepository(data: FakeData = {}): FakeRepository {
  const records: Records = {
    projects: [...(data.projects ?? [])],
    breakdownItems: [...(data.breakdownItems ?? [])],
    allocations: [...(data.allocations ?? [])],
    employees: [...(data.employees ?? [])],
    rateRecords: [...(data.rateRecords ?? [])],
  };
  const handlers: Handlers = {
    projects: new Set(),
    breakdownItems: new Set(),
    allocations: new Set(),
    employees: new Set(),
    rateRecords: new Set(),
  };
  const connectionListeners: Record<Instance, Set<(event: ConnectionEvent) => void>> = {
    delivery: new Set(),
    people: new Set(),
  };
  const written: ChangeSet[] = [];
  const readFailures = new Map<CollectionKey, RepositoryError>();
  const subscribeFailures = new Map<Instance, RepositoryError>();
  const gates = new Map<CollectionKey, Promise<void>>();
  let writeGate: Promise<void> | undefined;
  let writeFailure: RepositoryError | null = null;
  let writeFailuresLeft = 0;

  /** Updates the stored record and tells the subscribers, like a committed write. */
  function emit<K extends CollectionKey>(key: K, action: RealtimeEvent<K>['action'], record: RecordOf<K>): void {
    const list: RecordOf<K>[] = records[key];
    const index = list.findIndex(({ id }) => id === record.id);
    if (action === 'delete') {
      if (index !== -1) list.splice(index, 1);
    } else if (index === -1) list.push(record);
    else list[index] = record;
    for (const handler of handlers[key]) handler({ action, record });
  }

  function replace<K extends CollectionKey>(key: K, next: readonly RecordOf<K>[]): void {
    const list: RecordOf<K>[] = records[key];
    list.splice(0, list.length, ...next);
  }

  function setConnection(instance: Instance, event: ConnectionEvent): void {
    for (const listener of connectionListeners[instance]) listener(event);
  }

  return {
    stored: (key) => records[key],
    written,
    emit,
    replace,
    setConnection,
    failReads: (key, error) => {
      if (error) readFailures.set(key, error);
      else readFailures.delete(key);
    },
    failWrites: (error, times = Infinity) => {
      writeFailure = error;
      writeFailuresLeft = times;
    },
    failSubscribe: (instance, error) => {
      if (error) subscribeFailures.set(instance, error);
      else subscribeFailures.delete(instance);
    },
    holdReads: (key) => {
      const { gate, release } = holdOn();
      gates.set(key, gate);
      return () => {
        gates.delete(key);
        release();
      };
    },
    holdWrites: () => {
      const { gate, release } = holdOn();
      writeGate = gate;
      return () => {
        writeGate = undefined;
        release();
      };
    },

    async list<K extends CollectionKey>(key: K): Promise<readonly RecordOf<K>[]> {
      await gates.get(key);
      const failure = readFailures.get(key);
      if (failure) throw failure;
      const list: readonly RecordOf<K>[] = records[key];
      return [...list];
    },

    async applyChangeSet(changeSet): Promise<ChangeSetResult> {
      await writeGate;
      if (writeFailure && writeFailuresLeft > 0) {
        writeFailuresLeft -= 1;
        throw writeFailure;
      }
      const before = { projects: records.projects, items: records.breakdownItems, allocations: records.allocations };
      try {
        // A change set that updates a record that isn't there was made against another state: refused whole.
        applyChangeSet(before, changeSet);
      } catch (cause) {
        throw new RepositoryError('validation', 'delivery', { cause });
      }
      written.push(changeSet);

      // The server stamps `editedAt` on create and when the amount changes (D18).
      const now = IsoDateTime.parse(new Date().toISOString());
      const stamped = (record: Allocation): Allocation => {
        const previous = before.allocations.find(({ id }) => id === record.id);
        return previous?.amount === record.amount
          ? { ...record, editedAt: previous.editedAt }
          : { ...record, editedAt: now };
      };
      const createdAllocations = changeSet.create.allocations.map(stamped);
      const updatedAllocations = changeSet.update.allocations.map(stamped);

      // After the commit, one event per record, children before parents on delete.
      for (const id of changeSet.delete.allocationIds) {
        const record = before.allocations.find((candidate) => candidate.id === id);
        if (record) emit('allocations', 'delete', record);
      }
      for (const id of changeSet.delete.itemIds.toReversed()) {
        const record = before.items.find((candidate) => candidate.id === id);
        if (record) emit('breakdownItems', 'delete', record);
      }
      for (const record of changeSet.create.items) emit('breakdownItems', 'create', record);
      for (const record of changeSet.update.items) emit('breakdownItems', 'update', record);
      for (const record of createdAllocations) emit('allocations', 'create', record);
      for (const record of updatedAllocations) emit('allocations', 'update', record);

      return {
        items: [...changeSet.create.items, ...changeSet.update.items],
        allocations: [...createdAllocations, ...updatedAllocations],
      };
    },

    subscribe(key, onEvent) {
      const failure = subscribeFailures.get(COLLECTIONS[key].instance);
      if (failure) return Promise.reject(failure);
      handlers[key].add(onEvent);
      return Promise.resolve(() => {
        handlers[key].delete(onEvent);
        return Promise.resolve();
      });
    },

    watchConnection(instance, onChange) {
      const failure = subscribeFailures.get(instance);
      if (failure) return Promise.reject(failure);
      connectionListeners[instance].add(onChange);
      // The SDK reports the first connect as soon as the connection opens.
      queueMicrotask(() => {
        if (connectionListeners[instance].has(onChange)) onChange('connected');
      });
      return Promise.resolve(() => {
        connectionListeners[instance].delete(onChange);
        return Promise.resolve();
      });
    },
  };
}
