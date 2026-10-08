import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { EmployeeId } from '@baseline/people-contract';
import type { ActionReport } from '../../../shared/lib';
import { NO_ASSIGNMENTS, type PendingAssignment } from '../lib/pendingRows';

// What the slots' features share with the widget (D33): the status line's text lives in the widget, and the
// features reach it through `report`. A context rather than slot props because the toolbar, the rows and the
// cells are far apart, and rows must stay memoised: `report` has a context of its own and never changes, so
// a cell that reads it does not re-render when the assignments below do.

/** The widget's own feedback state: the last result, kept until the next action replaces it. */
export interface GridFeedback {
  readonly status: string;
  /** Stable for the life of the widget, so rows and dialogs that hold it don't re-render for it. */
  readonly report: ActionReport;
}

export function useGridFeedback(): GridFeedback {
  const [status, setStatus] = useState('');
  const report = useMemo<ActionReport>(
    () => ({
      done: setStatus,
      // A refused write is shown by the toolbar's `WriteFailedMessage`, which watches every write; the
      // status line keeps the last result it had.
      failed: () => undefined,
    }),
    [],
  );
  return { status, report };
}

/**
 * People added to leaves in this page and not given a value yet (T6.7, D31). They are the grid's local state:
 * a reload drops them, and nothing is written for an empty row.
 */
export interface PendingAssignments {
  readonly assigned: readonly PendingAssignment[];
  readonly assign: (itemId: BreakdownItemId, employeeId: EmployeeId) => void;
  /** Forgets assignments that are done with: their row is real, or their item stopped being a leaf. */
  readonly forget: (entries: readonly PendingAssignment[]) => void;
}

export function useGridAssignments(): PendingAssignments {
  const [assigned, setAssigned] = useState<readonly PendingAssignment[]>(NO_ASSIGNMENTS);
  const assign = useCallback((itemId: BreakdownItemId, employeeId: EmployeeId) => {
    setAssigned((current) => [...current, { itemId, employeeId }]);
  }, []);
  // By identity, so an assignment made since the stale ones were found is kept.
  const forget = useCallback((entries: readonly PendingAssignment[]) => {
    setAssigned((current) => current.filter((entry) => !entries.includes(entry)));
  }, []);
  return { assigned, assign, forget };
}

export interface GridActions extends PendingAssignments {
  readonly report: ActionReport;
}

const Actions = createContext<GridActions | null>(null);
const Report = createContext<ActionReport | null>(null);

export function GridActionsProvider({ value, children }: { value: GridActions; children: ReactNode }) {
  return (
    <Report.Provider value={value.report}>
      <Actions.Provider value={value}>{children}</Actions.Provider>
    </Report.Provider>
  );
}

export function useGridActions(): GridActions {
  const actions = useContext(Actions);
  if (!actions) throw new Error('useGridActions must be used inside the staffing grid');
  return actions;
}

/** Only where to report: what a cell needs, without being re-rendered when people are assigned. */
export function useGridReport(): ActionReport {
  const report = useContext(Report);
  if (!report) throw new Error('useGridReport must be used inside the staffing grid');
  return report;
}
