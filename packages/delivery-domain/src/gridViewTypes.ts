import type { AllocationId, BreakdownItemId, Project } from '@baseline/delivery-contract';
import type { CurrencyCode, IsoDate, Month } from '@baseline/host-contract';
import type { Employee, EmployeeId, RateRecord } from '@baseline/people-contract';
import type { DomainError } from './errors';
import type { DisplayUnit } from './units';

// What `gridView` returns (D35): everything the staffing grid and its details panel show, as plain
// data. Text is final (en-GB, the display currency), so components only place it.

/** People's side of the data: weekly hours and rates. Null in `gridView` when People can't be reached (D32). */
export interface PeopleData {
  readonly employees: readonly Employee[];
  readonly rates: readonly RateRecord[];
}

/** Why `gridView` can't produce a grid, besides the domain's own errors. */
export type GridViewError =
  | DomainError
  /** Hours and cost need People's data, which isn't there (screens 3.6). */
  | { readonly code: 'unitUnavailable'; readonly unit: DisplayUnit }
  /** Hours and cost need this employee's weekly hours, and People doesn't list them. */
  | { readonly code: 'unknownEmployee'; readonly employeeId: EmployeeId };

/** One number of the grid: exact in the display unit, as whole display steps after `roundGrid`, and as text. */
export interface GridValue {
  readonly exact: number;
  /** Whole steps of the unit (0.01, or 0.1 for %): what `formatUnit` takes. */
  readonly steps: number;
  readonly text: string;
}

// ---- Markers (T6.9) ----

export type MarkerKind = 'overCapacity' | 'partiallyPriced' | 'unpriced';

/** The glyph drawn on the cell for each marker. */
export const MARKER_SYMBOLS = { overCapacity: '†', partiallyPriced: '◐', unpriced: '○' } as const satisfies Record<
  MarkerKind,
  string
>;

export interface CellMarker {
  readonly kind: MarkerKind;
  readonly symbol: (typeof MARKER_SYMBOLS)[MarkerKind];
  /** The full text: the marker's `title`, and its entry in the details panel (D36, `aria-describedby`). */
  readonly text: string;
}

// ---- Cell details (T6.12) ----

/** The cell's person-month in hours, and the hours it works out to per working day. */
export interface PersonMonthDetails {
  readonly weeklyHours: number;
  readonly workingDays: number;
  readonly hoursPerPersonMonth: number;
  readonly hoursPerWorkingDay: number;
  /** `Person-month 176.00 h (40 h/week × 22 working days ÷ 5) · 4.00 h per working day` */
  readonly text: string;
}

/** A stretch of the month that one rate covers, in the display currency. */
export interface RateSliceDetails {
  readonly from: IsoDate;
  readonly workingDays: number;
  /** Null before the first rate. */
  readonly hourlyCost: number | null;
}

export interface PricingDetails {
  readonly slices: readonly RateSliceDetails[];
  /** In the display currency, over the priced days only (D17). Null when no day is priced. */
  readonly blendedRate: number | null;
  /** `22 working days: 8 before 12 Mar at €80.00/h, 14 from 12 Mar at €95.00/h` */
  readonly slicesText: string;
  /** `Blended rate €89.5455/h` */
  readonly blendedRateText: string;
}

export interface CellDetails {
  /** `Adaeze Okafor · Design · Mar 2026` */
  readonly title: string;
  /** `0.50 PM = 88.00 h = 50.0% of capacity = €7,880.00`; person-months and % only without People. */
  readonly conversion: string;
  /** The cell's value in each unit as text, null where People's data is needed and missing. */
  readonly values: {
    readonly personMonths: string;
    readonly hours: string | null;
    readonly percent: string;
    readonly cost: string | null;
  };
  /** Null without People's data (no weekly hours). */
  readonly personMonth: PersonMonthDetails | null;
  /** Null without People's data (no rates). */
  readonly pricing: PricingDetails | null;
  /** The same markers as the cell's, with their full text. */
  readonly markers: readonly CellMarker[];
}

// ---- Rows ----

/** A person's cell: editable, and the only kind with markers and details. */
export interface PersonCellView extends GridValue {
  readonly month: Month;
  /** Null while nothing is stored for this person, item and month (the grid shows `·`). */
  readonly allocationId: AllocationId | null;
  /** The stored person-months, 0 when there is no allocation. */
  readonly personMonths: number;
  readonly markers: readonly CellMarker[];
  /**
   * Why this cell can't be edited in cost, or null (D17). Shown inline when the user tries; hours,
   * person-months and % stay editable. Null without People's data, where cost is unavailable anyway.
   */
  readonly euroEditRefusal: string | null;
  readonly details: CellDetails;
}

interface RowBase {
  /** Unique in the grid: `project`, an item id, or `<itemId>/<employeeId>`. */
  readonly key: string;
  /** The row this one sits under; null for the project row. Collapsing a node hides what is under it. */
  readonly parentKey: string | null;
  /** 0 for the project row, 1 for a top-level item, one more for each level down. */
  readonly depth: number;
  readonly label: string;
  readonly total: GridValue;
}

/** The project row and every WBS row: derived from the rows under them, so read-only (D36). */
export interface SumRowView extends RowBase {
  readonly kind: 'project' | 'node';
  /** Null for the project row. */
  readonly itemId: BreakdownItemId | null;
  /** True for a WBS item with no children, which is where people are assigned. */
  readonly isLeaf: boolean;
  readonly cells: readonly GridValue[];
}

export interface PersonRowView extends RowBase {
  readonly kind: 'person';
  readonly itemId: BreakdownItemId;
  readonly employeeId: EmployeeId;
  readonly cells: readonly PersonCellView[];
}

export type GridRowView = SumRowView | PersonRowView;

export interface GridMonthView {
  readonly month: Month;
  /** `Mar 26`, for a column header. */
  readonly label: string;
  /** `Mar 2026` */
  readonly name: string;
}

export interface GridView {
  readonly project: Project;
  readonly unit: DisplayUnit;
  readonly currency: CurrencyCode;
  readonly months: readonly GridMonthView[];
  /** The project row, then WBS rows and person rows in tree order. */
  readonly rows: readonly GridRowView[];
}
