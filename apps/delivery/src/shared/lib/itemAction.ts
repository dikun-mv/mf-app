import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { PlanState } from '@baseline/delivery-domain';

/**
 * Where an action reports to (D33): the widget's `role="status"` line for what it did, and the message at
 * the top of the widget for a write that failed. The widget that places the features gives each one the
 * same pair, so features never import the widget above them.
 */
export interface ActionReport {
  /** "Added …", "Deleted 2 items and 14 allocations.": kept until the next action. */
  done: (message: string) => void;
  /** A write was refused or didn't arrive; it has already been undone (D26). The widget words it. */
  failed: (error: unknown) => void;
}

/** What every action on a WBS row takes: the plan as it is now, the row's item, where to report, and how to close. */
export interface ItemActionProps {
  readonly state: PlanState;
  readonly itemId: BreakdownItemId;
  readonly report: ActionReport;
  readonly onClose: () => void;
}
