import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BreakdownItemId } from '@baseline/delivery-contract';
import type { EmployeeId } from '@baseline/people-contract';
import type { ActionReport } from '../../../shared/lib';
import { describeWriteFailure, type WriteFailure } from '../lib/describeWriteFailure';
import { NO_ASSIGNMENTS, type PendingAssignment } from './pendingRows';

// What the slots' features share with the widget (D33): the status line's text and the failed-write
// message live in the widget, and the features reach them through `report`. A context rather than slot
// props because the toolbar and the rows are siblings, and rows must stay memoised.

/** The widget's own feedback state: the last result, and a failed write until the next action succeeds. */
export interface GridFeedback {
  readonly status: string;
  readonly failure: WriteFailure | null;
  /** Stable for the life of the widget, so rows and dialogs that hold it don't re-render for it. */
  readonly report: ActionReport;
}

export function useGridFeedback(): GridFeedback {
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const report = useMemo<ActionReport>(
    () => ({
      done: (message) => {
        setStatus(message);
        setFailure(null);
      },
      failed: (error) => {
        setFailure(describeWriteFailure(error));
      },
    }),
    [],
  );
  return { status, failure, report };
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

export function GridActionsProvider({ value, children }: { value: GridActions; children: ReactNode }) {
  return <Actions.Provider value={value}>{children}</Actions.Provider>;
}

export function useGridActions(): GridActions {
  const actions = useContext(Actions);
  if (!actions) throw new Error('useGridActions must be used inside the staffing grid');
  return actions;
}
