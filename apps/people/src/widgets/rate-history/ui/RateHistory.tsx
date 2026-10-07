import type { Employee, RateRecord } from '@baseline/people-contract';
import { formatHourlyRate, rateOn } from '@baseline/people-domain';
import { InlineMessage, StatusMessage, Table, TableCell, TableHeaderCell } from '@baseline/ui';
import { useCallback, useMemo, useState } from 'react';
import { useRateHistory } from '../../../entities/rate-record';
import { AddRateForm } from '../../../features/add-rate';
import { CorrectRateForm } from '../../../features/correct-rate';
import { RemoveRateDialog } from '../../../features/remove-rate';
import { describeWriteFailure, isConflictError } from '../../../shared/api';
import { today, useHost } from '../../../shared/lib';
import styles from './RateHistory.module.css';
import { RateRow } from './RateRow';

/**
 * Rates newest first. A rate being corrected stays in its place even if it was removed elsewhere meanwhile,
 * so its form keeps the draft and can say so (D37).
 */
function listed(history: readonly RateRecord[], editing: RateRecord | null): RateRecord[] {
  const rows = editing !== null && !history.some(({ id }) => id === editing.id) ? [...history, editing] : history;
  return rows.toSorted((a, b) => (a.validFrom < b.validFrom ? 1 : a.validFrom > b.validFrom ? -1 : 0));
}

/**
 * An employee's rate history and its editor (screens 2.3 to 2.5): rates newest first with the one in effect
 * today marked *current*, each with Correct (an inline form in its row) and Remove (asks first), and a form to
 * add a rate. The widget owns the two places results go (D33): the `role="status"` line at its foot keeps the
 * last result until the next one, and a failed write is shown at its top, with the change already undone.
 */
export function RateHistory({ employee }: { employee: Employee }) {
  const { currency } = useHost();
  const history = useRateHistory(employee.id);
  const [editing, setEditing] = useState<RateRecord | null>(null);
  const [removing, setRemoving] = useState<RateRecord | null>(null);
  const [status, setStatus] = useState('');
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const current = rateOn(history, today());
  const rows = useMemo(() => listed(history, editing), [history, editing]);

  const saved = useCallback((message: string) => {
    setStatus(message);
    setFailure(null);
  }, []);
  const failed = useCallback((error: unknown) => {
    setFailure({ error });
  }, []);
  const stopEditing = useCallback(() => {
    setEditing(null);
  }, []);
  const stopRemoving = useCallback(() => {
    setRemoving(null);
  }, []);

  return (
    <section className={styles.section} aria-labelledby="rate-history-title">
      {failure === null ? null : (
        <InlineMessage tone={isConflictError(failure.error) ? 'info' : 'error'}>
          {describeWriteFailure(failure.error)}
        </InlineMessage>
      )}
      <h2 id="rate-history-title" className={styles.title}>
        Rate history
      </h2>
      <Table aria-labelledby="rate-history-title">
        <thead>
          <tr>
            <TableHeaderCell>Valid from</TableHeaderCell>
            <TableHeaderCell>Hourly cost</TableHeaderCell>
            <TableHeaderCell>
              <span className={styles.hidden}>Actions</span>
            </TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <TableCell colSpan={3} className={styles.empty}>
                No rates yet.
              </TableCell>
            </tr>
          ) : (
            rows.map((rate) =>
              rate.id === editing?.id ? (
                <CorrectRateForm
                  key={`${rate.id}-${currency.code}`}
                  opened={editing}
                  stored={history.find(({ id }) => id === rate.id)}
                  history={history}
                  onDone={stopEditing}
                  onSaved={saved}
                  onFailed={failed}
                />
              ) : (
                <RateRow
                  key={rate.id}
                  rate={rate}
                  cost={formatHourlyRate(rate.hourlyCost, currency)}
                  current={rate.id === current?.id}
                  onCorrect={setEditing}
                  onRemove={setRemoving}
                />
              ),
            )
          )}
        </tbody>
      </Table>
      <AddRateForm key={currency.code} employeeId={employee.id} history={history} onSaved={saved} onFailed={failed} />
      <StatusMessage>{status}</StatusMessage>
      <RemoveRateDialog
        employee={employee}
        rate={removing}
        history={history}
        onClose={stopRemoving}
        onSaved={saved}
        onFailed={failed}
      />
    </section>
  );
}
