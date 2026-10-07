// Types for load.js, which is plain CommonJS run by PocketBase. Written by hand: the JS has no TypeScript.

/** One allocation of the pair. `editedAt` is an `IsoDateTime` string, which sorts by time (D18). */
export interface Contribution {
  readonly id: string;
  readonly amount: number;
  readonly editedAt: string;
}

/** The fields of an `employee_month_loads` row, apart from its `employeeId` and `month`. */
export interface LoadFields {
  readonly allocatedPersonMonths: number;
  readonly overCapacity: boolean;
  /** The id of the causing allocation, or "" when the pair is not over capacity (PocketBase has no null). */
  readonly causingAllocationId: string;
}

/** The load of one (employeeId, month) pair, or `null` when no allocation has `amount > 0`. */
export function loadOf(contributions: readonly Contribution[]): LoadFields | null;
