import type { EmployeeMonthLoad } from '@baseline/delivery-contract';
import type { Employee, RateRecord, RateRecordId } from '@baseline/people-contract';

// The seam between the app and its data (D30). Components and hooks reach PocketBase only through this
// interface, which the SDK implementation and the in-memory fake (shared/testing) both satisfy. Every record
// that crosses it has been parsed with a contract schema.

/** The two PocketBase instances People reads: its own, and Delivery's `employee_month_loads` feed. */
export type Instance = 'people' | 'delivery';

/** `connecting` until the first connect, `live` while connected, `down` after a disconnect (D29). */
export type RealtimeStatus = 'connecting' | 'live' | 'down';

export type RealtimeAction = 'create' | 'update' | 'delete';

/** A realtime event, its record already parsed. `delete` carries the record as it was. */
export type RecordEvent =
  | { readonly collection: 'employees'; readonly action: RealtimeAction; readonly record: Employee }
  | { readonly collection: 'rateRecords'; readonly action: RealtimeAction; readonly record: RateRecord }
  | { readonly collection: 'employeeMonthLoads'; readonly action: RealtimeAction; readonly record: EmployeeMonthLoad };

export interface RealtimeHandlers {
  onEvent(event: RecordEvent): void;
  /** Every time the connection is established, the first included. */
  onConnect(): void;
  /** The connection was lost, or could not be made. */
  onDisconnect(): void;
}

/**
 * The records a rate edit creates, replaces and deletes (T5.3). It is sent as one batch and applied to the
 * cache first, the way Delivery's `ChangeSet` is. Updates carry whole records.
 */
export interface RateChangeSet {
  readonly create: readonly RateRecord[];
  readonly update: readonly RateRecord[];
  readonly delete: readonly RateRecordId[];
}

export const EMPTY_RATE_CHANGE_SET: RateChangeSet = { create: [], update: [], delete: [] };

export interface PeopleRepository {
  /** The whole collection (D26). A record that fails its schema is skipped and logged, not fatal. */
  listEmployees(): Promise<Employee[]>;
  listRateRecords(): Promise<RateRecord[]>;
  /** The other team's feed. Callers must never suspend on it (D32). */
  listEmployeeMonthLoads(): Promise<EmployeeMonthLoad[]>;
  /**
   * Sends the change set as one batch, even for a single record (ADR 035), and resolves with the records
   * the server created and updated. It rejects with an `ApiError` and keeps nothing when any part fails.
   */
  applyRateChanges(changes: RateChangeSet): Promise<RateRecord[]>;
  /** Subscribes to every collection of the instance. Returns the function that stops it (D29). */
  subscribe(instance: Instance, handlers: RealtimeHandlers): () => void;
}
