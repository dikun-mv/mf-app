import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import type { Employee, RateRecord } from '@baseline/people-contract';
import {
  applyRateChangeSet,
  type Instance,
  type PeopleRepository,
  type RateChangeSet,
  type RealtimeHandlers,
  type RecordEvent,
} from '../api';
import { EMPLOYEES, MONTH_LOADS, RATE_RECORDS } from './fixtures';

export interface FakeRepositoryData {
  readonly employees?: readonly Employee[];
  readonly rateRecords?: readonly RateRecord[];
  readonly employeeMonthLoads?: readonly EmployeeMonthLoad[];
}

/**
 * The in-memory repository (D30): the same interface as the SDK implementation, so a component test sees the
 * data layer's whole contract and none of its network. It also lets a test play the server: fail or hold
 * reads, fail writes, and push realtime events and connection changes.
 */
export interface FakeRepository extends PeopleRepository {
  /** Every change set written, in order. */
  readonly writes: readonly RateChangeSet[];
  /** How many subscriptions are open per instance. */
  openSubscriptions(instance: Instance): number;
  /** Makes every read reject with `error` until called with `null`. */
  failReads(error: Error | null): void;
  /** Makes only the read of Delivery's load feed reject with `error` until called with `null`. */
  failLoads(error: Error | null): void;
  /** Makes only the next write that reaches the server reject with `error`. */
  failNextWrite(error: Error): void;
  /** Makes every write reject with `error` until called with `null`. */
  failWrites(error: Error | null): void;
  /** Holds reads until the returned function is called. */
  holdReads(): () => void;
  /** Holds only the read of Delivery's load feed until the returned function is called. */
  holdLoads(): () => void;
  /** Holds writes (the server has not answered, nor committed) until the returned function is called. */
  holdWrites(): () => void;
  /** Changes the stored load rows without telling any subscriber, as an edit made while the connection was down. */
  setMonthLoadsSilently(loads: readonly EmployeeMonthLoad[]): void;
  /** Changes the stored rates without telling any subscriber, as an edit made while no subscription was live. */
  setRateRecordsSilently(records: readonly RateRecord[]): void;
  /** Delivers an event to the open subscriptions, as the server would after a commit. */
  emit(event: RecordEvent): void;
  /** The connection of `instance` was established (the first time, or again after a loss). */
  connect(instance: Instance): void;
  disconnect(instance: Instance): void;
}

export function createFakeRepository(data: FakeRepositoryData = {}): FakeRepository {
  const employees = [...(data.employees ?? EMPLOYEES)];
  let rateRecords = [...(data.rateRecords ?? RATE_RECORDS)];
  let employeeMonthLoads = [...(data.employeeMonthLoads ?? MONTH_LOADS)];
  const writes: RateChangeSet[] = [];
  const subscribers: Record<Instance, Set<RealtimeHandlers>> = { people: new Set(), delivery: new Set() };
  let readError: Error | null = null;
  let writeError: Error | null = null;
  let loadError: Error | null = null;
  let nextWriteError: Error | null = null;
  let gate: Promise<void> = Promise.resolve();
  let writeGate: Promise<void> = Promise.resolve();
  let loadGate: Promise<void> = Promise.resolve();

  // The records are read when the server answers, after any hold: a read held while the data changes sees the change.
  const read = async <T>(records: () => readonly T[]): Promise<T[]> => {
    await gate;
    if (readError) throw readError;
    return [...records()];
  };

  const emit = (event: RecordEvent): void => {
    const instance: Instance = event.collection === 'employeeMonthLoads' ? 'delivery' : 'people';
    for (const handlers of subscribers[instance]) handlers.onEvent(event);
  };

  return {
    get writes() {
      return writes;
    },
    listEmployees: () => read(() => employees),
    listRateRecords: () => read(() => rateRecords),
    listEmployeeMonthLoads: async () => {
      await loadGate;
      if (loadError) throw loadError;
      return read(() => employeeMonthLoads);
    },
    applyRateChanges: async (changes) => {
      await writeGate;
      if (writeError) throw writeError;
      if (nextWriteError) {
        const error = nextWriteError;
        nextWriteError = null;
        throw error;
      }
      writes.push(changes);
      const before = rateRecords;
      rateRecords = applyRateChangeSet(rateRecords, changes);
      // What the server answers, and then pushes: one event per record, deletes included.
      for (const record of changes.delete.flatMap((id) => before.filter((existing) => existing.id === id))) {
        emit({ collection: 'rateRecords', action: 'delete', record });
      }
      for (const record of changes.update) emit({ collection: 'rateRecords', action: 'update', record });
      for (const record of changes.create) emit({ collection: 'rateRecords', action: 'create', record });
      return [...changes.update, ...changes.create];
    },
    subscribe: (instance, handlers) => {
      subscribers[instance].add(handlers);
      return () => {
        subscribers[instance].delete(handlers);
      };
    },
    openSubscriptions: (instance) => subscribers[instance].size,
    failReads: (error) => {
      readError = error;
    },
    failLoads: (error) => {
      loadError = error;
    },
    failNextWrite: (error) => {
      nextWriteError = error;
    },
    failWrites: (error) => {
      writeError = error;
    },
    holdReads: () => {
      let release: () => void = () => undefined;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        release();
        gate = Promise.resolve();
      };
    },
    holdWrites: () => {
      let release: () => void = () => undefined;
      writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        release();
        writeGate = Promise.resolve();
      };
    },
    holdLoads: () => {
      let release: () => void = () => undefined;
      loadGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        release();
        loadGate = Promise.resolve();
      };
    },
    setMonthLoadsSilently: (loads) => {
      employeeMonthLoads = [...loads];
    },
    setRateRecordsSilently: (records) => {
      rateRecords = [...records];
    },
    emit,
    connect: (instance) => {
      for (const handlers of subscribers[instance]) handlers.onConnect();
    },
    disconnect: (instance) => {
      for (const handlers of subscribers[instance]) handlers.onDisconnect();
    },
  };
}
