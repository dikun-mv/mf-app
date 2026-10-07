import type { Employee, RateRecord } from '@baseline/people-contract';
import { formatDate, formatHourlyRate, formatMonth, type PricingImpact } from '@baseline/people-domain';
import { Button, Dialog, InlineMessage } from '@baseline/ui';
import { EMPTY_RATE_CHANGE_SET, useApplyChangeSet } from '../../../shared/api';
import { useHost } from '../../../shared/lib';
import { useRemovalImpact } from '../model/useRemovalImpact';
import styles from './RemoveRateDialog.module.css';

export interface RemoveRateDialogProps {
  employee: Employee;
  /** The rate to remove, or `null` while the dialog is closed. */
  rate: RateRecord | null;
  /** The employee's rate records, oldest first. */
  history: readonly RateRecord[];
  onClose: () => void;
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
export function RemoveRateDialog({ employee, rate, history, onClose, onSaved, onFailed }: RemoveRateDialogProps) {
  const { currency } = useHost();
  const write = useApplyChangeSet();
  const impacts = useRemovalImpact(employee, history, rate);
  const next = rate === null ? undefined : history.find(({ validFrom }) => validFrom > rate.validFrom);

  const confirm = () => {
    if (rate === null) return;
    onClose();
    write.mutate(
      { ...EMPTY_RATE_CHANGE_SET, delete: [rate.id] },
      {
        onSuccess: () => {
          onSaved(`Rate from ${formatDate(rate.validFrom)} removed.`);
        },
        onError: onFailed,
      },
    );
  };

  return (
    <Dialog
      open={rate !== null}
      title={rate === null ? '' : `Remove the rate from ${formatDate(rate.validFrom)}?`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={confirm}>
            Remove rate
          </Button>
        </>
      }
    >
      {rate === null ? null : (
        <div className={styles.body}>
          <p className={styles.lead}>
            {formatHourlyRate(rate.hourlyCost, currency)} from {formatDate(rate.validFrom)} will be removed.
            {next === undefined ? '' : ` The next rate starts on ${formatDate(next.validFrom)}.`}
          </p>
          {impacts === null ? (
            <InlineMessage tone="info">
              Months this leaves without a full rate can&apos;t be listed: Delivery&apos;s data isn&apos;t available.
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
        </div>
      )}
    </Dialog>
  );
}
