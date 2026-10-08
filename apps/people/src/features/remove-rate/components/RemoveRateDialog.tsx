import type { Employee, RateRecord } from '@baseline/people-contract';
import { formatDate, formatHourlyRate, formatMonth, type PricingImpact } from '@baseline/people-domain';
import { Button, Dialog, InlineMessage } from '@baseline/ui';
import { EMPTY_RATE_CHANGE_SET, useApplyChangeSet } from '../../../shared/api';
import { useHost } from '../../../shared/lib';
import { useRemovalImpact } from '../hooks/useRemovalImpact';
import styles from './RemoveRateDialog.module.css';

export interface RemoveRateDialogProps {
  employee: Employee;
  /** The rate to remove, or `null` while the dialog is closed. */
  rate: RateRecord | null;
  /** The employee's rate records, oldest first. */
  history: readonly RateRecord[];
  onClose: () => void;
  onStart: () => void;
  onSaved: (message: string) => void;
  onFailed: (error: unknown) => void;
}

/** One month of the warning, as screens 2.5 words it. */
function describeImpact({ month, after, firstRateFrom, workingDays, workingDaysBefore }: PricingImpact): string {
  const state = after === 'unpriced' ? 'unpriced' : 'partly priced';
  const why =
    firstRateFrom === null
      ? 'no rate is left'
      : `${String(workingDaysBefore)} of ${String(workingDays)} working days are before ${formatDate(firstRateFrom)}`;
  return `${formatMonth(month)} — ${state}: ${why}`;
}

/**
 * Asks before removing a rate (screens 2.5). Removing is never blocked, but the dialog says which allocated
 * months the removal leaves without a full rate, because Delivery costs the days before the first rate at 0.
 * The months come from Delivery's load feed through `pricingImpact`; without the feed the dialog says it
 * can't list them. Confirming closes the dialog and sends the removal.
 */
export function RemoveRateDialog({
  employee,
  rate,
  history,
  onClose,
  onStart,
  onSaved,
  onFailed,
}: RemoveRateDialogProps) {
  const { currency } = useHost();
  const write = useApplyChangeSet();
  const impacts = useRemovalImpact(employee, history, rate);
  const next = rate === null ? undefined : history.find(({ validFrom }) => validFrom > rate.validFrom);
  // Someone else may remove the rate while the dialog is open (D37): the dialog says so and cannot confirm.
  const gone = rate !== null && !history.some(({ id }) => id === rate.id);

  // `mutateAsync`, not `mutate` with callbacks: TanStack runs a call's callbacks only for the latest call of
  // a hook, so with two removals overlapping the first one's failure would be rolled back without a word.
  const confirm = async () => {
    if (rate === null || gone) return;
    onClose();
    onStart();
    try {
      await write.mutateAsync({ ...EMPTY_RATE_CHANGE_SET, delete: [rate.id] });
    } catch (error) {
      onFailed(error);
      return;
    }
    onSaved(`Rate from ${formatDate(rate.validFrom)} removed.`);
  };

  return (
    <Dialog
      open={rate !== null}
      title={rate === null ? '' : `Remove the rate from ${formatDate(rate.validFrom)}?`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={gone}
            onClick={() => {
              void confirm();
            }}
          >
            Remove rate
          </Button>
        </>
      }
    >
      {rate === null ? null : (
        <div className={styles.body}>
          {gone ? (
            <InlineMessage tone="warning">
              This rate was removed elsewhere, so there is nothing left to remove.
            </InlineMessage>
          ) : (
            <>
              <p className={styles.lead}>
                {formatHourlyRate(rate.hourlyCost, currency)} from {formatDate(rate.validFrom)} will be removed.
                {next === undefined ? '' : ` The next rate starts on ${formatDate(next.validFrom)}.`}
              </p>
              {impacts === null ? (
                <InlineMessage tone="info">
                  Months this leaves without a full rate can&apos;t be listed: Delivery&apos;s data isn&apos;t
                  available.
                </InlineMessage>
              ) : impacts.length > 0 ? (
                <InlineMessage tone="warning">
                  {employee.name} has allocations in months this leaves without a full rate:
                  <ul className={styles.months}>
                    {impacts.map((impact) => (
                      <li key={impact.month}>{describeImpact(impact)}</li>
                    ))}
                  </ul>
                  Delivery costs those days at 0.
                </InlineMessage>
              ) : null}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
