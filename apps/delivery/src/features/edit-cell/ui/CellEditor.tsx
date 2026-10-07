import {
  formatUnit,
  isEmptyChangeSet,
  newAllocationId,
  upsertAllocation,
  type DomainError,
} from '@baseline/delivery-domain';
import { IsoDateTime } from '@baseline/host-contract';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useAllocations } from '../../../entities/allocation';
import { useBreakdownItems } from '../../../entities/breakdown-item';
import { useEmployees } from '../../../entities/employee';
import { useProjects } from '../../../entities/project';
import { useRateRecords } from '../../../entities/rate-record';
import { useApplyChangeSet } from '../../../shared/api';
import { useHost } from '../../../shared/lib';
import { openingText, resolveEdit } from '../lib/resolveEdit';
import styles from './EditableCell.module.css';
import type { EditableCellProps } from './cellProps';
import { UNIT_NAMES } from './unitNames';

/** Why a draft the editor accepted was still refused before it was sent (D33), as a sentence. */
function describeRefusal(error: DomainError): string {
  switch (error.code) {
    case 'duplicateAllocation':
      return 'This cell already has a value that this grid does not show yet. Reload the page and try again.';
    case 'monthOutsideProject':
      return "This month is outside the project's dates.";
    default:
      return "This value can't be saved.";
  }
}

export interface CellEditorProps extends Omit<EditableCellProps, 'adornment'> {
  /** Whether an adornment sits beside the cell, so the input points at the details panel too. */
  readonly hasAdornment: boolean;
  /** The editor is done. `returnFocus` is true when the user pressed Enter or Esc, and false on blur. */
  readonly onClose: (returnFocus: boolean) => void;
}

/**
 * The input a person cell turns into (T6.6, D36). The draft is local state, not a form (D27), and a
 * realtime change to the cell updates the cache but never the draft (D37). Enter or blur saves, Esc cancels.
 * A draft that can't be saved keeps the editor open with the reason beside it; a draft that changes nothing
 * closes it without a write. The save is optimistic and goes through `useApplyChangeSet` (D26): the cell
 * shows the new value at once, and a failure puts it back and is reported at the top of the grid, and a success in the status line.
 */
export function CellEditor({ row, cell, month, unit, describedById, report, hasAdornment, onClose }: CellEditorProps) {
  const host = useHost();
  const projects = useProjects();
  const items = useBreakdownItems();
  const allocations = useAllocations();
  const employees = useEmployees().data;
  const rateRecords = useRateRecords().data;
  const write = useApplyChangeSet();

  const [opened] = useState(() => openingText(unit, cell));
  const [draft, setDraft] = useState(opened);
  const touched = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Set once the editor has been settled by a key, so the blur that follows its removal does nothing.
  const settled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const messageId = useId();

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  /** A € edit is refused in a partly priced or unpriced month; say so as soon as the editor opens (D17). */
  const hint = unit === 'cost' ? cell.euroEditRefusal : null;
  const message = problem ?? hint;

  function commit(returnFocus: boolean): void {
    if (settled.current) return;
    const employee = employees?.find(({ id }) => id === row.employeeId);
    const outcome = resolveEdit({
      draft,
      touched: touched.current,
      unit,
      cell,
      employee:
        employee === undefined || rateRecords === undefined
          ? null
          : {
              weeklyHours: employee.weeklyHours,
              rates: rateRecords.filter(({ employeeId }) => employeeId === employee.id),
            },
      perEur: host.currency.perEur,
    });
    if (outcome.kind === 'rejected') {
      setProblem(outcome.message);
      return;
    }
    if (outcome.kind === 'save') {
      const changeSet = upsertAllocation(
        { projects, items, allocations },
        {
          id: cell.allocationId ?? newAllocationId(),
          breakdownItemId: row.itemId,
          employeeId: row.employeeId,
          month: cell.month,
          amount: outcome.amount,
        },
        IsoDateTime.parse(new Date().toISOString()),
      );
      if (!changeSet.ok) {
        setProblem(describeRefusal(changeSet.error));
        return;
      }
      if (!isEmptyChangeSet(changeSet.value)) {
        // Not `mutate`'s callbacks: they don't fire once this editor has closed, which is at once.
        const where = items.find(({ id }) => id === row.itemId)?.name ?? 'item';
        const saved = `Saved ${formatUnit(Math.round(outcome.amount * 100), 'personMonths')} PM for ${row.label}, ${where}, ${month.name}.`;
        write.mutateAsync(changeSet.value).then(
          () => {
            report.done(saved);
          },
          // A refused write is shown by `WriteFailedMessage`; the cache has already put the value back.
          report.failed,
        );
      }
    }
    settled.current = true;
    onClose(returnFocus);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      settled.current = true;
      onClose(true);
    }
  }

  const describedBy = [message === null ? null : messageId, hasAdornment ? describedById : null]
    .filter((id) => id !== null)
    .join(' ');
  return (
    <span className={styles.editor}>
      <span className={styles.field} data-invalid={problem === null ? undefined : ''}>
        <input
          ref={input}
          className={styles.input}
          style={{ '--digits': Math.max(opened.length, 4) + 1 } as CSSProperties}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={`Edit ${row.label}, ${month.name}, ${UNIT_NAMES[unit]}`}
          aria-invalid={problem === null ? undefined : true}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          value={draft}
          onChange={(event) => {
            touched.current = true;
            setDraft(event.target.value);
            setProblem(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            commit(false);
          }}
        />
      </span>
      {message !== null && (
        <span
          id={messageId}
          className={problem === null ? styles.hint : styles.problem}
          role={problem === null ? undefined : 'alert'}
        >
          {message}
        </span>
      )}
    </span>
  );
}
